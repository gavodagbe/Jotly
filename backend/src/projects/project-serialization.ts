import { ProjectRecord } from "./project-store";

export type SerializedProject = {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SerializedProjectOverviewNode = {
  id: string;
  name: string;
  parentId: string | null;
  taskCount: number;
  reminderCount: number;
  children?: SerializedProjectOverviewNode[];
};

export function serializeProject(project: ProjectRecord): SerializedProject {
  return {
    id: project.id,
    name: project.name,
    parentId: project.parentId,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  };
}

function groupChildren(projects: ProjectRecord[]): Map<string, ProjectRecord[]> {
  const childrenByParent = new Map<string, ProjectRecord[]>();
  for (const project of projects) {
    if (project.parentId === null) continue;
    const bucket = childrenByParent.get(project.parentId) ?? [];
    bucket.push(project);
    childrenByParent.set(project.parentId, bucket);
  }
  return childrenByParent;
}

export function serializeProjectTree(projects: ProjectRecord[]) {
  const roots = projects.filter((project) => project.parentId === null);
  const childrenByParent = groupChildren(projects);

  return roots.map((root) => ({
    ...serializeProject(root),
    children: (childrenByParent.get(root.id) ?? []).map(serializeProject),
  }));
}

/**
 * Tree of projects annotated with the number of tasks/reminders that point at
 * each exact node (descendants are not rolled up into the parent). Powers the
 * admin overview screen.
 */
export function serializeProjectOverview(
  projects: ProjectRecord[],
  taskCounts: Record<string, number>,
  reminderCounts: Record<string, number>
): SerializedProjectOverviewNode[] {
  const roots = projects.filter((project) => project.parentId === null);
  const childrenByParent = groupChildren(projects);

  const toNode = (project: ProjectRecord): SerializedProjectOverviewNode => ({
    id: project.id,
    name: project.name,
    parentId: project.parentId,
    taskCount: taskCounts[project.id] ?? 0,
    reminderCount: reminderCounts[project.id] ?? 0,
  });

  return roots.map((root) => ({
    ...toNode(root),
    children: (childrenByParent.get(root.id) ?? []).map(toNode),
  }));
}
