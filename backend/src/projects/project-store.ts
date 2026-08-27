import { PrismaClient } from "@prisma/client";

export type ProjectRecord = {
  id: string;
  userId: string;
  name: string;
  parentId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ProjectCreateInput = {
  userId: string;
  name: string;
  parentId?: string | null;
};

/**
 * Structural errors surfaced by the store. Routes map these to HTTP responses.
 */
export const PROJECT_PARENT_NOT_FOUND = "PROJECT_PARENT_NOT_FOUND";
export const PROJECT_NESTING_TOO_DEEP = "PROJECT_NESTING_TOO_DEEP";
export const PROJECT_NAME_TAKEN = "PROJECT_NAME_TAKEN";
export const PROJECT_HAS_CHILDREN = "PROJECT_HAS_CHILDREN";

export type ProjectStore = {
  listByUser(userId: string): Promise<ProjectRecord[]>;
  getById(id: string, userId: string): Promise<ProjectRecord | null>;
  listChildren(parentId: string, userId: string): Promise<ProjectRecord[]>;
  create(input: ProjectCreateInput): Promise<ProjectRecord>;
  rename(id: string, userId: string, name: string): Promise<ProjectRecord | null>;
  remove(id: string, userId: string): Promise<ProjectRecord | null>;
  close?: () => Promise<void>;
};

export function normalizeProjectName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export type ProjectDenormalization = {
  projectId: string | null;
  project: string | null;
  subProject: string | null;
};

/**
 * Resolves a selected project node to the denormalized name cache stored on
 * tasks and reminders: `project` is always the top-level project name and
 * `subProject` is the leaf name when a sub-project was selected.
 * Returns an all-null result when the id is missing or not owned by the user —
 * callers should validate ownership first when they need to reject the request.
 */
export async function resolveProjectDenormalization(
  projectStore: Pick<ProjectStore, "getById">,
  projectId: string | null | undefined,
  userId: string
): Promise<ProjectDenormalization> {
  if (!projectId) {
    return { projectId: null, project: null, subProject: null };
  }

  const node = await projectStore.getById(projectId, userId);
  if (!node) {
    return { projectId: null, project: null, subProject: null };
  }

  if (node.parentId === null) {
    return { projectId: node.id, project: node.name, subProject: null };
  }

  const parent = await projectStore.getById(node.parentId, userId);
  return { projectId: node.id, project: parent?.name ?? null, subProject: node.name };
}

export function createPrismaProjectStore(prisma = new PrismaClient()): ProjectStore {
  async function assertNameAvailable(
    userId: string,
    parentId: string | null,
    name: string,
    excludeId?: string
  ): Promise<void> {
    const siblings = await prisma.project.findMany({
      where: { userId, parentId },
      select: { id: true, name: true },
    });
    const normalizedKey = name.toLocaleLowerCase();
    const clash = siblings.some(
      (sibling) =>
        sibling.id !== excludeId && sibling.name.toLocaleLowerCase() === normalizedKey
    );
    if (clash) {
      throw new Error(PROJECT_NAME_TAKEN);
    }
  }

  return {
    async listByUser(userId) {
      return prisma.project.findMany({
        where: { userId },
        orderBy: [{ parentId: "asc" }, { name: "asc" }],
      });
    },

    async getById(id, userId) {
      return prisma.project.findFirst({ where: { id, userId } });
    },

    async listChildren(parentId, userId) {
      return prisma.project.findMany({
        where: { userId, parentId },
        orderBy: { name: "asc" },
      });
    },

    async create(input) {
      const name = normalizeProjectName(input.name);
      const parentId = input.parentId ?? null;

      if (parentId) {
        const parent = await prisma.project.findFirst({
          where: { id: parentId, userId: input.userId },
        });
        if (!parent) {
          throw new Error(PROJECT_PARENT_NOT_FOUND);
        }
        if (parent.parentId) {
          throw new Error(PROJECT_NESTING_TOO_DEEP);
        }
      }

      await assertNameAvailable(input.userId, parentId, name);

      return prisma.project.create({
        data: { userId: input.userId, name, parentId },
      });
    },

    async rename(id, userId, name) {
      const existing = await prisma.project.findFirst({ where: { id, userId } });
      if (!existing) {
        return null;
      }

      const normalized = normalizeProjectName(name);
      await assertNameAvailable(userId, existing.parentId, normalized, id);

      return prisma.project.update({
        where: { id },
        data: { name: normalized },
      });
    },

    async remove(id, userId) {
      const existing = await prisma.project.findFirst({ where: { id, userId } });
      if (!existing) {
        return null;
      }

      const childCount = await prisma.project.count({ where: { parentId: id } });
      if (childCount > 0) {
        throw new Error(PROJECT_HAS_CHILDREN);
      }

      return prisma.project.delete({ where: { id } });
    },

    async close() {
      await prisma.$disconnect();
    },
  };
}
