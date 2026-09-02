import {
  PROJECT_CANNOT_PARENT_TO_SELF,
  PROJECT_HAS_CHILDREN,
  PROJECT_NAME_TAKEN,
  PROJECT_NESTING_TOO_DEEP,
  PROJECT_PARENT_NOT_FOUND,
  ProjectCreateInput,
  ProjectRecord,
  ProjectStore,
  normalizeProjectName,
} from "./project-store";

/**
 * In-memory `ProjectStore` mirroring the Prisma implementation's structural
 * rules. Shared by the project route test suites.
 */
export class InMemoryProjectStore implements ProjectStore {
  private readonly projects = new Map<string, ProjectRecord>();
  private counter = 1;

  async listByUser(userId: string): Promise<ProjectRecord[]> {
    return [...this.projects.values()]
      .filter((project) => project.userId === userId)
      .sort((left, right) => {
        const parentCmp = (left.parentId ?? "").localeCompare(right.parentId ?? "");
        return parentCmp !== 0 ? parentCmp : left.name.localeCompare(right.name);
      });
  }

  async getById(id: string, userId: string): Promise<ProjectRecord | null> {
    const project = this.projects.get(id);
    return project && project.userId === userId ? project : null;
  }

  async listChildren(parentId: string, userId: string): Promise<ProjectRecord[]> {
    return [...this.projects.values()].filter(
      (project) => project.userId === userId && project.parentId === parentId
    );
  }

  private assertNameAvailable(
    userId: string,
    parentId: string | null,
    name: string,
    excludeId?: string
  ): void {
    const key = name.toLocaleLowerCase();
    const clash = [...this.projects.values()].some(
      (project) =>
        project.userId === userId &&
        project.parentId === parentId &&
        project.id !== excludeId &&
        project.name.toLocaleLowerCase() === key
    );
    if (clash) throw new Error(PROJECT_NAME_TAKEN);
  }

  private hasChildren(id: string): boolean {
    return [...this.projects.values()].some((project) => project.parentId === id);
  }

  async create(input: ProjectCreateInput): Promise<ProjectRecord> {
    const name = normalizeProjectName(input.name);
    const parentId = input.parentId ?? null;

    if (parentId) {
      const parent = this.projects.get(parentId);
      if (!parent || parent.userId !== input.userId) throw new Error(PROJECT_PARENT_NOT_FOUND);
      if (parent.parentId) throw new Error(PROJECT_NESTING_TOO_DEEP);
    }

    this.assertNameAvailable(input.userId, parentId, name);

    const now = new Date();
    const project: ProjectRecord = {
      id: `project-${this.counter++}`,
      userId: input.userId,
      name,
      parentId,
      createdAt: now,
      updatedAt: now,
    };
    this.projects.set(project.id, project);
    return project;
  }

  async rename(id: string, userId: string, name: string): Promise<ProjectRecord | null> {
    const existing = await this.getById(id, userId);
    if (!existing) return null;
    const normalized = normalizeProjectName(name);
    this.assertNameAvailable(userId, existing.parentId, normalized, id);
    const updated: ProjectRecord = { ...existing, name: normalized, updatedAt: new Date() };
    this.projects.set(id, updated);
    return updated;
  }

  async move(
    id: string,
    userId: string,
    newParentId: string | null
  ): Promise<ProjectRecord | null> {
    const existing = await this.getById(id, userId);
    if (!existing) return null;

    const targetParentId = newParentId ?? null;
    if (targetParentId === existing.parentId) return existing;
    if (targetParentId === id) throw new Error(PROJECT_CANNOT_PARENT_TO_SELF);

    if (targetParentId) {
      const parent = await this.getById(targetParentId, userId);
      if (!parent) throw new Error(PROJECT_PARENT_NOT_FOUND);
      if (parent.parentId) throw new Error(PROJECT_NESTING_TOO_DEEP);
      if (this.hasChildren(id)) throw new Error(PROJECT_HAS_CHILDREN);
    }

    this.assertNameAvailable(userId, targetParentId, existing.name, id);

    const updated: ProjectRecord = {
      ...existing,
      parentId: targetParentId,
      updatedAt: new Date(),
    };
    this.projects.set(id, updated);
    return updated;
  }

  async remove(id: string, userId: string): Promise<ProjectRecord | null> {
    const existing = await this.getById(id, userId);
    if (!existing) return null;
    if (this.hasChildren(id)) throw new Error(PROJECT_HAS_CHILDREN);
    this.projects.delete(id);
    return existing;
  }
}
