"use client";

import { useCallback, useMemo, useState } from "react";

import {
  AdminConfirmButton,
  AdminCountBadge,
  AdminEmptyState,
  AdminErrorBanner,
  AdminInlineEdit,
  AdminPanel,
  AdminSectionHeader,
  adminGhostButtonClass,
  primaryButtonClass,
} from "@/components/admin/admin-ui";
import { textFieldClass } from "@/components/ui/constants";
import { PlusIcon } from "@/components/ui/icons";
import {
  createProjectsAdminClient,
  type ProjectOverviewNode,
} from "@/features/admin/projects-admin-api";
import type { AdminResourceContext } from "@/features/admin/types";
import { useAdminResource } from "@/features/admin/use-admin-resource";
import {
  deleteBlockedReason,
  getMoveTargets,
  isNodeDeletable,
  validateNewName,
} from "./projects-admin-helpers";

function t(locale: "en" | "fr", en: string, fr: string): string {
  return locale === "fr" ? fr : en;
}

export function ProjectsAdmin({ token, locale }: AdminResourceContext) {
  const client = useMemo(() => createProjectsAdminClient(token), [token]);
  const loader = useCallback(() => client.loadOverview(), [client]);
  const { data, isLoading, isMutating, error, run, clearError } = useAdminResource(loader);

  const roots = data ?? [];
  const [newProjectName, setNewProjectName] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [addSubFor, setAddSubFor] = useState<string | null>(null);
  const [subName, setSubName] = useState("");

  const busy = isMutating || isLoading;

  async function handleCreateTopLevel() {
    const validation = validateNewName(newProjectName, roots, locale);
    if (validation) {
      setLocalError(validation);
      return;
    }
    setLocalError(null);
    const failure = await run(() => client.create(newProjectName.trim(), null));
    if (!failure) setNewProjectName("");
  }

  async function handleCreateSub(parent: ProjectOverviewNode) {
    const validation = validateNewName(subName, parent.children ?? [], locale);
    if (validation) {
      setLocalError(validation);
      return;
    }
    setLocalError(null);
    const failure = await run(() => client.create(subName.trim(), parent.id));
    if (!failure) {
      setSubName("");
      setAddSubFor(null);
    }
  }

  return (
    <AdminPanel>
      <AdminSectionHeader
        title={t(locale, "Projects & sub-projects", "Projets & sous-projets")}
        description={t(
          locale,
          "Rename, move, or remove project nodes. Moving a top-level project under another one turns it into a sub-project.",
          "Renommez, déplacez ou supprimez les projets. Déplacer un projet racine sous un autre le transforme en sous-projet."
        )}
      />

      {error ? <AdminErrorBanner message={error} onDismiss={clearError} /> : null}
      {localError ? <AdminErrorBanner message={localError} onDismiss={() => setLocalError(null)} /> : null}

      <form
        className="mb-6 flex flex-wrap items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void handleCreateTopLevel();
        }}
      >
        <input
          value={newProjectName}
          onChange={(event) => setNewProjectName(event.target.value)}
          placeholder={t(locale, "New project name", "Nom du nouveau projet")}
          className={`${textFieldClass} mt-0 h-10 max-w-xs py-0`}
          disabled={busy}
        />
        <button type="submit" className={primaryButtonClass} disabled={busy || newProjectName.trim().length === 0}>
          <PlusIcon />
          {t(locale, "Add project", "Ajouter un projet")}
        </button>
      </form>

      {isLoading ? (
        <AdminEmptyState message={t(locale, "Loading…", "Chargement…")} />
      ) : roots.length === 0 ? (
        <AdminEmptyState message={t(locale, "No projects yet.", "Aucun projet pour le moment.")} />
      ) : (
        <ul className="space-y-3">
          {roots.map((root) => (
            <li key={root.id} className="rounded-lg border border-line bg-surface-soft/40">
              <ProjectRow
                node={root}
                roots={roots}
                locale={locale}
                busy={busy}
                onRename={(name) => run(() => client.rename(root.id, name))}
                onMove={(parentId) => run(() => client.move(root.id, parentId))}
                onDelete={() => run(() => client.remove(root.id))}
              />

              {addSubFor === root.id ? (
                <form
                  className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-3"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void handleCreateSub(root);
                  }}
                >
                  <input
                    autoFocus
                    value={subName}
                    onChange={(event) => setSubName(event.target.value)}
                    placeholder={t(locale, "Sub-project name", "Nom du sous-projet")}
                    className={`${textFieldClass} mt-0 h-9 max-w-xs py-0`}
                    disabled={busy}
                  />
                  <button type="submit" className={adminGhostButtonClass} disabled={busy || subName.trim().length === 0}>
                    {t(locale, "Add", "Ajouter")}
                  </button>
                  <button
                    type="button"
                    className={adminGhostButtonClass}
                    onClick={() => {
                      setAddSubFor(null);
                      setSubName("");
                    }}
                    disabled={busy}
                  >
                    {t(locale, "Cancel", "Annuler")}
                  </button>
                </form>
              ) : (
                <div className="border-t border-line px-4 py-2">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline disabled:opacity-50"
                    onClick={() => {
                      setAddSubFor(root.id);
                      setSubName("");
                    }}
                    disabled={busy}
                  >
                    <PlusIcon />
                    {t(locale, "Add sub-project", "Ajouter un sous-projet")}
                  </button>
                </div>
              )}

              {(root.children ?? []).length > 0 ? (
                <ul className="divide-y divide-line border-t border-line">
                  {(root.children ?? []).map((child) => (
                    <li key={child.id} className="pl-6">
                      <ProjectRow
                        node={child}
                        roots={roots}
                        locale={locale}
                        busy={busy}
                        onRename={(name) => run(() => client.rename(child.id, name))}
                        onMove={(parentId) => run(() => client.move(child.id, parentId))}
                        onDelete={() => run(() => client.remove(child.id))}
                      />
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </AdminPanel>
  );
}

function ProjectRow({
  node,
  roots,
  locale,
  busy,
  onRename,
  onMove,
  onDelete,
}: {
  node: ProjectOverviewNode;
  roots: ProjectOverviewNode[];
  locale: "en" | "fr";
  busy: boolean;
  onRename: (name: string) => Promise<string | null>;
  onMove: (parentId: string | null) => Promise<string | null>;
  onDelete: () => Promise<string | null>;
}) {
  const moveTargets = getMoveTargets(
    node,
    roots,
    t(locale, "↑ Promote to top-level project", "↑ Promouvoir en projet racine")
  );
  const blockedReason = deleteBlockedReason(node, locale);
  const deletable = isNodeDeletable(node);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <AdminInlineEdit
          value={node.name}
          busy={busy}
          editLabel={t(locale, "Rename", "Renommer")}
          saveLabel={t(locale, "Save", "Enregistrer")}
          cancelLabel={t(locale, "Cancel", "Annuler")}
          onSave={onRename}
        >
          <span className={node.parentId === null ? "font-semibold text-foreground" : "text-foreground/90"}>
            {node.name}
          </span>
        </AdminInlineEdit>
        <AdminCountBadge label={t(locale, "tasks", "tâches")} value={node.taskCount} />
        <AdminCountBadge label={t(locale, "reminders", "rappels")} value={node.reminderCount} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {node.parentId === null && (node.children?.length ?? 0) > 0 ? (
          <span className="text-xs text-muted">
            {t(locale, "Move sub-projects out first to convert", "Sortez les sous-projets pour convertir")}
          </span>
        ) : (
          <select
            className={`${textFieldClass} mt-0 h-9 w-auto py-0 text-xs`}
            value=""
            disabled={busy || moveTargets.length === 0}
            onChange={(event) => {
              const raw = event.target.value;
              if (raw === "") return;
              void onMove(raw === "__promote__" ? null : raw);
              event.target.value = "";
            }}
          >
            <option value="">{t(locale, "Move to…", "Déplacer vers…")}</option>
            {moveTargets.map((target) => (
              <option key={target.id ?? "__promote__"} value={target.id ?? "__promote__"}>
                {target.label}
              </option>
            ))}
          </select>
        )}

        {blockedReason ? (
          <span className="text-xs text-muted" title={blockedReason}>
            {t(locale, "Can't delete", "Suppression bloquée")}
          </span>
        ) : (
          <AdminConfirmButton
            label={t(locale, "Delete", "Supprimer")}
            confirmLabel={t(locale, "Confirm", "Confirmer")}
            busy={busy}
            disabled={!deletable}
            onConfirm={() => void onDelete()}
          />
        )}
      </div>
    </div>
  );
}
