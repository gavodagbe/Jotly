import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { AuthService } from "../auth/auth-service";
import {
  PROJECT_CANNOT_PARENT_TO_SELF,
  PROJECT_HAS_CHILDREN,
  PROJECT_NAME_TAKEN,
  PROJECT_NESTING_TOO_DEEP,
  PROJECT_PARENT_NOT_FOUND,
  ProjectStore,
} from "../projects/project-store";
import {
  serializeProject,
  serializeProjectOverview,
  serializeProjectTree,
} from "../projects/project-serialization";
import {
  getBearerToken,
  isStorageNotInitializedPrismaError,
  sendError,
  sendStorageNotInitializedError,
  zodIssuesToStrings,
} from "./route-helpers";
import { TaskStore } from "../tasks/task-store";
import { ReminderStore } from "../reminders/reminder-store";

type ProjectsRoutesOptions = {
  authService: AuthService;
  projectStore: ProjectStore;
  taskStore?: TaskStore;
  reminderStore?: ReminderStore;
};

const projectNameSchema = z
  .string()
  .trim()
  .min(1, "name is required")
  .max(200, "name is too long");

const createProjectBodySchema = z.object({
  name: projectNameSchema,
  parentId: z.string().trim().min(1).optional().nullable(),
});

const updateProjectBodySchema = z.object({
  name: projectNameSchema,
});

const moveProjectBodySchema = z.object({
  parentId: z.string().trim().min(1).nullable(),
});

const projectIdParamsSchema = z.object({
  id: z.string().trim().min(1, "Project id is required"),
});

function getAuthenticatedUserId(request: { authUserId?: string }): string | null {
  if (!request.authUserId || request.authUserId.trim() === "") {
    return null;
  }
  return request.authUserId;
}

function mapStructuralError(
  reply: Parameters<typeof sendError>[0],
  message: string
): unknown | null {
  switch (message) {
    case PROJECT_PARENT_NOT_FOUND:
      return sendError(reply, 404, "NOT_FOUND", "Parent project not found");
    case PROJECT_NESTING_TOO_DEEP:
      return sendError(
        reply,
        400,
        "VALIDATION_ERROR",
        "A sub-project cannot contain further sub-projects"
      );
    case PROJECT_NAME_TAKEN:
      return sendError(reply, 409, "CONFLICT", "A project with this name already exists here");
    case PROJECT_HAS_CHILDREN:
      return sendError(
        reply,
        409,
        "CONFLICT",
        "Move or delete the sub-projects first"
      );
    case PROJECT_CANNOT_PARENT_TO_SELF:
      return sendError(reply, 400, "VALIDATION_ERROR", "A project cannot be moved into itself");
    default:
      return null;
  }
}

const projectsRoutes: FastifyPluginAsync<ProjectsRoutesOptions> = async (app, options) => {
  const { authService, projectStore, taskStore, reminderStore } = options;

  async function countProjectReferences(userId: string, projectIds: string[]): Promise<number> {
    const [taskCount, reminderCount] = await Promise.all([
      taskStore?.countByProjectIds?.(userId, projectIds) ?? Promise.resolve(0),
      reminderStore?.countByProjectIds?.(userId, projectIds) ?? Promise.resolve(0),
    ]);
    return taskCount + reminderCount;
  }

  async function propagateRename(
    userId: string,
    renamed: { id: string; parentId: string | null; name: string }
  ): Promise<void> {
    if (renamed.parentId === null) {
      const children = await projectStore.listChildren(renamed.id, userId);
      const scopedIds = [renamed.id, ...children.map((child) => child.id)];
      await Promise.all([
        taskStore?.updateDenormalizedProjectFields?.(scopedIds, { project: renamed.name }),
        reminderStore?.updateDenormalizedProjectFields?.(scopedIds, { project: renamed.name }),
      ]);
      return;
    }
    await Promise.all([
      taskStore?.updateDenormalizedProjectFields?.([renamed.id], { subProject: renamed.name }),
      reminderStore?.updateDenormalizedProjectFields?.([renamed.id], { subProject: renamed.name }),
    ]);
  }

  /**
   * Rebuilds the denormalized `project` / `subProject` name cache for tasks and
   * reminders pointing at a node whose place in the hierarchy just changed.
   */
  async function propagateMove(
    userId: string,
    moved: { id: string; parentId: string | null; name: string }
  ): Promise<void> {
    const fields =
      moved.parentId === null
        ? { project: moved.name, subProject: null }
        : {
            project: (await projectStore.getById(moved.parentId, userId))?.name ?? null,
            subProject: moved.name,
          };
    await Promise.all([
      taskStore?.updateDenormalizedProjectFields?.([moved.id], fields),
      reminderStore?.updateDenormalizedProjectFields?.([moved.id], fields),
    ]);
  }

  async function groupProjectReferenceCounts(
    userId: string
  ): Promise<{ tasks: Record<string, number>; reminders: Record<string, number> }> {
    const [tasks, reminders] = await Promise.all([
      taskStore?.groupCountByProject?.(userId) ?? Promise.resolve({}),
      reminderStore?.groupCountByProject?.(userId) ?? Promise.resolve({}),
    ]);
    return { tasks, reminders };
  }

  app.addHook("preHandler", async (request, reply) => {
    const token = getBearerToken(request.headers.authorization);
    if (!token) {
      return sendError(reply, 401, "UNAUTHORIZED", "Authentication is required");
    }
    const authContext = await authService.authenticateBearerToken(token);
    if (!authContext) {
      return sendError(reply, 401, "UNAUTHORIZED", "Authentication is required");
    }
    (request as { authUserId?: string }).authUserId = authContext.user.id;
  });

  app.get("/api/projects", async (request, reply) => {
    const authUserId = getAuthenticatedUserId(request as { authUserId?: string });
    if (!authUserId) return sendError(reply, 401, "UNAUTHORIZED", "Authentication is required");

    try {
      const projects = await projectStore.listByUser(authUserId);
      return reply.send({ data: serializeProjectTree(projects) });
    } catch (error) {
      if (isStorageNotInitializedPrismaError(error)) return sendStorageNotInitializedError(reply, "Project");
      request.log.error(error, "Failed to list projects");
      return sendError(reply, 500, "INTERNAL_ERROR", "Unable to list projects");
    }
  });

  app.get("/api/projects/overview", async (request, reply) => {
    const authUserId = getAuthenticatedUserId(request as { authUserId?: string });
    if (!authUserId) return sendError(reply, 401, "UNAUTHORIZED", "Authentication is required");

    try {
      const [projects, counts] = await Promise.all([
        projectStore.listByUser(authUserId),
        groupProjectReferenceCounts(authUserId),
      ]);
      return reply.send({
        data: serializeProjectOverview(projects, counts.tasks, counts.reminders),
      });
    } catch (error) {
      if (isStorageNotInitializedPrismaError(error)) return sendStorageNotInitializedError(reply, "Project");
      request.log.error(error, "Failed to build project overview");
      return sendError(reply, 500, "INTERNAL_ERROR", "Unable to load the project overview");
    }
  });

  app.post("/api/projects", async (request, reply) => {
    const authUserId = getAuthenticatedUserId(request as { authUserId?: string });
    if (!authUserId) return sendError(reply, 401, "UNAUTHORIZED", "Authentication is required");

    const bodyResult = createProjectBodySchema.safeParse(request.body);
    if (!bodyResult.success) {
      const details = zodIssuesToStrings(bodyResult.error);
      return sendError(reply, 400, "VALIDATION_ERROR", details[0] ?? "Invalid request body", details);
    }

    try {
      const project = await projectStore.create({
        userId: authUserId,
        name: bodyResult.data.name,
        parentId: bodyResult.data.parentId ?? null,
      });
      return reply.code(201).send({ data: serializeProject(project) });
    } catch (error) {
      if (isStorageNotInitializedPrismaError(error)) return sendStorageNotInitializedError(reply, "Project");
      const mapped =
        error instanceof Error ? mapStructuralError(reply, error.message) : null;
      if (mapped !== null) return mapped;
      request.log.error(error, "Failed to create project");
      return sendError(reply, 500, "INTERNAL_ERROR", "Unable to create project");
    }
  });

  app.patch("/api/projects/:id", async (request, reply) => {
    const authUserId = getAuthenticatedUserId(request as { authUserId?: string });
    if (!authUserId) return sendError(reply, 401, "UNAUTHORIZED", "Authentication is required");

    const paramsResult = projectIdParamsSchema.safeParse(request.params);
    if (!paramsResult.success) {
      return sendError(reply, 400, "VALIDATION_ERROR", "Project id is required");
    }

    const bodyResult = updateProjectBodySchema.safeParse(request.body);
    if (!bodyResult.success) {
      const details = zodIssuesToStrings(bodyResult.error);
      return sendError(reply, 400, "VALIDATION_ERROR", details[0] ?? "Invalid request body", details);
    }

    try {
      const project = await projectStore.rename(paramsResult.data.id, authUserId, bodyResult.data.name);
      if (!project) return sendError(reply, 404, "NOT_FOUND", "Project not found");
      await propagateRename(authUserId, project);
      return reply.send({ data: serializeProject(project) });
    } catch (error) {
      if (isStorageNotInitializedPrismaError(error)) return sendStorageNotInitializedError(reply, "Project");
      const mapped =
        error instanceof Error ? mapStructuralError(reply, error.message) : null;
      if (mapped !== null) return mapped;
      request.log.error(error, "Failed to rename project");
      return sendError(reply, 500, "INTERNAL_ERROR", "Unable to rename project");
    }
  });

  app.patch("/api/projects/:id/move", async (request, reply) => {
    const authUserId = getAuthenticatedUserId(request as { authUserId?: string });
    if (!authUserId) return sendError(reply, 401, "UNAUTHORIZED", "Authentication is required");

    const paramsResult = projectIdParamsSchema.safeParse(request.params);
    if (!paramsResult.success) {
      return sendError(reply, 400, "VALIDATION_ERROR", "Project id is required");
    }

    const bodyResult = moveProjectBodySchema.safeParse(request.body);
    if (!bodyResult.success) {
      const details = zodIssuesToStrings(bodyResult.error);
      return sendError(reply, 400, "VALIDATION_ERROR", details[0] ?? "Invalid request body", details);
    }

    try {
      const project = await projectStore.move(
        paramsResult.data.id,
        authUserId,
        bodyResult.data.parentId
      );
      if (!project) return sendError(reply, 404, "NOT_FOUND", "Project not found");
      await propagateMove(authUserId, project);
      return reply.send({ data: serializeProject(project) });
    } catch (error) {
      if (isStorageNotInitializedPrismaError(error)) return sendStorageNotInitializedError(reply, "Project");
      const mapped = error instanceof Error ? mapStructuralError(reply, error.message) : null;
      if (mapped !== null) return mapped;
      request.log.error(error, "Failed to move project");
      return sendError(reply, 500, "INTERNAL_ERROR", "Unable to move project");
    }
  });

  app.delete("/api/projects/:id", async (request, reply) => {
    const authUserId = getAuthenticatedUserId(request as { authUserId?: string });
    if (!authUserId) return sendError(reply, 401, "UNAUTHORIZED", "Authentication is required");

    const paramsResult = projectIdParamsSchema.safeParse(request.params);
    if (!paramsResult.success) {
      return sendError(reply, 400, "VALIDATION_ERROR", "Project id is required");
    }

    try {
      const target = await projectStore.getById(paramsResult.data.id, authUserId);
      if (!target) return sendError(reply, 404, "NOT_FOUND", "Project not found");

      const children = await projectStore.listChildren(target.id, authUserId);
      const scopedIds = [target.id, ...children.map((child) => child.id)];
      const referenceCount = await countProjectReferences(authUserId, scopedIds);
      if (referenceCount > 0) {
        return sendError(
          reply,
          409,
          "CONFLICT",
          "Reassign the tasks and reminders using this project before deleting it"
        );
      }

      const project = await projectStore.remove(paramsResult.data.id, authUserId);
      if (!project) return sendError(reply, 404, "NOT_FOUND", "Project not found");
      return reply.send({ data: serializeProject(project) });
    } catch (error) {
      if (isStorageNotInitializedPrismaError(error)) return sendStorageNotInitializedError(reply, "Project");
      const mapped =
        error instanceof Error ? mapStructuralError(reply, error.message) : null;
      if (mapped !== null) return mapped;
      request.log.error(error, "Failed to delete project");
      return sendError(reply, 500, "INTERNAL_ERROR", "Unable to delete project");
    }
  });
};

export default projectsRoutes;
