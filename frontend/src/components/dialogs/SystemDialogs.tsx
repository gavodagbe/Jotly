"use client";

import { controlButtonClass, dangerButtonClass } from "@/components/ui/constants";
import { CloseIcon, TrashIcon } from "@/components/ui/icons";

type UserLocale = "en" | "fr";

type Task = {
  id: string;
  title: string;
};

export type NavigationBlockersDialogProps = {
  blockers: string[];
  locale: UserLocale;
  onDismiss: () => void;
};

export function NavigationBlockersDialog({
  blockers,
  locale,
  onDismiss,
}: NavigationBlockersDialogProps) {
  if (blockers.length === 0) return null;

  const isFrench = locale === "fr";

  return (
    <div className="animate-fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <section
        role="dialog"
        aria-modal="true"
        aria-label={isFrench ? "Navigation bloquee" : "Navigation blocked"}
        className="animate-scale-in w-full max-w-md rounded-2xl border border-line bg-surface p-5 shadow-2xl sm:p-6"
      >
        <h3 className="text-lg font-semibold text-foreground">
          {isFrench ? "Compléter les champs requis" : "Complete required fields"}
        </h3>
        <p className="mt-2 text-sm text-muted">
          {isFrench
            ? "Vous devez remplir les éléments suivants avant de changer de date :"
            : "You must complete the following before navigating to another date:"}
        </p>
        <ul className="mt-3 space-y-1">
          {blockers.map((blocker) => (
            <li key={blocker} className="flex items-center gap-2 text-sm text-foreground">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500" />
              {blocker}
            </li>
          ))}
        </ul>
        <div className="mt-5 flex justify-end">
          <button
            type="button"
            className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            onClick={onDismiss}
          >
            {isFrench ? "Compris" : "Got it"}
          </button>
        </div>
      </section>
    </div>
  );
}

export type DeleteTaskDialogProps = {
  task: Task | null;
  locale: UserLocale;
  errorMessage: string | null;
  isDeleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function DeleteTaskDialog({
  task,
  locale,
  errorMessage,
  isDeleting,
  onCancel,
  onConfirm,
}: DeleteTaskDialogProps) {
  if (!task) return null;

  const isFrench = locale === "fr";

  return (
    <div
      className="animate-fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onCancel();
        }
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label={isFrench ? "Confirmation de suppression de tache" : "Delete task confirmation"}
        className="animate-scale-in w-full max-w-md rounded-2xl border border-line bg-surface p-5 shadow-2xl sm:p-6"
      >
        <h3 className="text-lg font-semibold text-foreground">
          {isFrench ? "Supprimer la tache ?" : "Delete task?"}
        </h3>
        <p className="mt-2 text-sm text-muted">
          {isFrench ? "Cette action supprimera definitivement " : "This will permanently remove "}
          <span className="font-semibold text-foreground">{task.title}</span>.
        </p>

        {errorMessage ? (
          <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {errorMessage}
          </p>
        ) : null}

        <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            className={controlButtonClass}
            onClick={onCancel}
            disabled={isDeleting}
          >
            <CloseIcon />
            {isFrench ? "Annuler" : "Cancel"}
          </button>
          <button
            type="button"
            className={dangerButtonClass}
            onClick={onConfirm}
            disabled={isDeleting}
          >
            <TrashIcon />
            {isDeleting
              ? isFrench
                ? "Suppression..."
                : "Deleting..."
              : isFrench
                ? "Supprimer la tache"
                : "Delete task"}
          </button>
        </div>
      </section>
    </div>
  );
}
