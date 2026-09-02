import type { ProjectOverviewNode } from "@/features/admin/projects-admin-api";

export type MoveTarget = { id: string | null; label: string };

/**
 * Valid re-parent destinations for a node, given the full top-level list.
 * - a top-level project may become a sub-project of any *other* top-level
 *   project, but only when it has no sub-projects of its own
 * - a sub-project may be promoted to top level or moved under another top-level
 *   project (never under its current parent)
 */
export function getMoveTargets(
  node: ProjectOverviewNode,
  roots: ProjectOverviewNode[],
  promoteLabel: string
): MoveTarget[] {
  const isTopLevel = node.parentId === null;
  const hasChildren = (node.children?.length ?? 0) > 0;

  if (isTopLevel && hasChildren) {
    return [];
  }

  const targets: MoveTarget[] = [];
  if (!isTopLevel) {
    targets.push({ id: null, label: promoteLabel });
  }
  for (const root of roots) {
    if (root.id === node.id || root.id === node.parentId) continue;
    targets.push({ id: root.id, label: root.name });
  }
  return targets;
}

export function isNodeDeletable(node: ProjectOverviewNode): boolean {
  const hasChildren = (node.children?.length ?? 0) > 0;
  return !hasChildren && node.taskCount === 0 && node.reminderCount === 0;
}

export function deleteBlockedReason(
  node: ProjectOverviewNode,
  locale: "en" | "fr"
): string | null {
  const fr = locale === "fr";
  if ((node.children?.length ?? 0) > 0) {
    return fr ? "Déplacez ou supprimez d'abord les sous-projets." : "Move or delete the sub-projects first.";
  }
  if (node.taskCount > 0 || node.reminderCount > 0) {
    return fr
      ? "Des tâches ou rappels utilisent ce projet."
      : "Tasks or reminders still use this project.";
  }
  return null;
}

export function validateNewName(
  name: string,
  siblings: ProjectOverviewNode[],
  locale: "en" | "fr"
): string | null {
  const trimmed = name.trim();
  const fr = locale === "fr";
  if (trimmed.length === 0) {
    return fr ? "Le nom est requis." : "Name is required.";
  }
  const key = trimmed.toLocaleLowerCase();
  if (siblings.some((sibling) => sibling.name.toLocaleLowerCase() === key)) {
    return fr ? "Ce nom existe déjà ici." : "That name already exists here.";
  }
  return null;
}
