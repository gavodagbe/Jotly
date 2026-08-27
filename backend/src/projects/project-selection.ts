import { ProjectStore, resolveProjectDenormalization } from "./project-store";

export type ProjectSelectionFields = {
  project: string | null;
  subProject: string | null;
  projectId: string | null;
};

export type ProjectSelectionResult =
  | { ok: true; fields: Partial<ProjectSelectionFields> }
  | { ok: false; error: "PROJECT_UNAVAILABLE" | "PROJECT_NOT_FOUND" };

function normalizeNullableText(value: string | null | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/**
 * Resolves the project selection on a task/reminder write.
 *
 * `projectId` (a real Project node) takes precedence and fills the denormalized
 * `project` / `subProject` name cache. The legacy free-text `project` field is
 * still honored when no `projectId` is supplied.
 *
 * In "create" mode the result always carries all three fields (so defaults are
 * written); in "update" mode only the fields that should change are returned.
 */
export async function resolveProjectSelection(
  body: { project?: string | null; projectId?: string | null },
  userId: string,
  projectStore: ProjectStore | undefined,
  mode: "create" | "update"
): Promise<ProjectSelectionResult> {
  if (body.projectId !== undefined) {
    if (body.projectId === null) {
      return { ok: true, fields: { projectId: null, project: null, subProject: null } };
    }
    if (!projectStore) {
      return { ok: false, error: "PROJECT_UNAVAILABLE" };
    }
    const node = await projectStore.getById(body.projectId, userId);
    if (!node) {
      return { ok: false, error: "PROJECT_NOT_FOUND" };
    }
    const denorm = await resolveProjectDenormalization(projectStore, node.id, userId);
    return {
      ok: true,
      fields: {
        projectId: denorm.projectId,
        project: denorm.project,
        subProject: denorm.subProject,
      },
    };
  }

  if (body.project !== undefined) {
    const project = normalizeNullableText(body.project) ?? null;
    return {
      ok: true,
      fields: mode === "create" ? { project, subProject: null, projectId: null } : { project },
    };
  }

  return {
    ok: true,
    fields: mode === "create" ? { project: null, subProject: null, projectId: null } : {},
  };
}
