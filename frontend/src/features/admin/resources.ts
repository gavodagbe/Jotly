import { ProjectsAdmin } from "@/components/admin/resources/ProjectsAdmin";

import type { AdminResourceDescriptor } from "./types";

/**
 * Registry of administrable domains. Add an entry here plus a matching
 * component under `components/admin/resources/` to expose a new CRUD screen.
 */
export const adminResources: AdminResourceDescriptor[] = [
  {
    key: "projects",
    labelEn: "Projects",
    labelFr: "Projets",
    descriptionEn: "Organise projects and sub-projects",
    descriptionFr: "Organiser les projets et sous-projets",
    Component: ProjectsAdmin,
  },
];

export function findAdminResource(key: string | null): AdminResourceDescriptor {
  return adminResources.find((resource) => resource.key === key) ?? adminResources[0];
}
