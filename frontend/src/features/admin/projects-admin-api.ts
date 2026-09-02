import { createCrudClient } from "./crud-client";

export type ProjectOverviewNode = {
  id: string;
  name: string;
  parentId: string | null;
  taskCount: number;
  reminderCount: number;
  children?: ProjectOverviewNode[];
};

type ProjectRecord = {
  id: string;
  name: string;
  parentId: string | null;
};

type CreateProjectInput = { name: string; parentId?: string | null };
type RenameProjectInput = { name: string };

export function createProjectsAdminClient(token: string) {
  const crud = createCrudClient<ProjectRecord, CreateProjectInput, RenameProjectInput>(
    "/projects",
    token
  );

  return {
    loadOverview: () => crud.get<ProjectOverviewNode[]>("/overview"),
    create: (name: string, parentId: string | null) => crud.create({ name, parentId }),
    rename: (id: string, name: string) => crud.update(id, { name }),
    remove: (id: string) => crud.remove(id),
    move: (id: string, parentId: string | null) =>
      crud.action<ProjectRecord>(id, "move", { parentId }),
  };
}

export type ProjectsAdminClient = ReturnType<typeof createProjectsAdminClient>;
