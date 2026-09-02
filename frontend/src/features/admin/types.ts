import type { ComponentType } from "react";

export type AdminLocale = "en" | "fr";

/** Thrown by the CRUD client; carries the backend error code + HTTP status. */
export class AdminApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string | null
  ) {
    super(message);
    this.name = "AdminApiError";
  }
}

export type AdminResourceContext = {
  token: string;
  locale: AdminLocale;
};

/**
 * One administrable domain. Register a descriptor in `resources.ts` and the
 * admin shell renders it in the sidebar + content area. Each resource owns its
 * own view (list, tree, board…) so it is not constrained to a generic table.
 */
export type AdminResourceDescriptor = {
  /** Stable key, also used in the URL hash (`/admin#projects`). */
  key: string;
  labelEn: string;
  labelFr: string;
  descriptionEn: string;
  descriptionFr: string;
  Component: ComponentType<AdminResourceContext>;
};

export function pickLabel(locale: AdminLocale, en: string, fr: string): string {
  return locale === "fr" ? fr : en;
}
