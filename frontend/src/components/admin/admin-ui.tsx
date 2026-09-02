"use client";

import { useState, type ReactNode } from "react";

import { dangerButtonClass, primaryButtonClass, textFieldClass } from "@/components/ui/constants";
import { CloseIcon, PencilIcon } from "@/components/ui/icons";

export const adminGhostButtonClass =
  "inline-flex items-center justify-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-foreground/80 transition-all duration-200 hover:border-accent/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/25 disabled:cursor-not-allowed disabled:opacity-50";

export { primaryButtonClass, dangerButtonClass };

export function AdminPanel({ children }: { children: ReactNode }) {
  return <section className="rounded-xl border border-line bg-surface p-6 shadow-sm">{children}</section>;
}

export function AdminSectionHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="text-base font-semibold text-foreground pl-3 border-l-[3px] border-accent">{title}</h2>
        {description ? <p className="mt-1 pl-3 text-sm text-muted">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function AdminErrorBanner({ message, onDismiss }: { message: string; onDismiss?: () => void }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
      <span>{message}</span>
      {onDismiss ? (
        <button type="button" onClick={onDismiss} className="shrink-0 text-red-500 hover:text-red-700" aria-label="Dismiss">
          <CloseIcon />
        </button>
      ) : null}
    </div>
  );
}

export function AdminEmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-dashed border-line bg-surface-soft px-4 py-10 text-center text-sm text-muted">
      {message}
    </div>
  );
}

export function AdminCountBadge({ label, value }: { label: string; value: number }) {
  const muted = value === 0;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${
        muted ? "border-line bg-surface-soft text-muted" : "border-accent/30 bg-accent-soft text-accent"
      }`}
    >
      <span className="tabular-nums">{value}</span>
      {label}
    </span>
  );
}

/** Inline text editor: click the pencil, edit, save / cancel. */
export function AdminInlineEdit({
  value,
  busy,
  saveLabel,
  cancelLabel,
  editLabel,
  onSave,
  children,
}: {
  value: string;
  busy: boolean;
  saveLabel: string;
  cancelLabel: string;
  editLabel: string;
  onSave: (next: string) => Promise<string | null> | void;
  children: ReactNode;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (!isEditing) {
    return (
      <span className="inline-flex items-center gap-2">
        {children}
        <button
          type="button"
          className="text-muted transition-colors hover:text-foreground"
          onClick={() => {
            setDraft(value);
            setIsEditing(true);
          }}
          aria-label={editLabel}
          title={editLabel}
        >
          <PencilIcon />
        </button>
      </span>
    );
  }

  return (
    <form
      className="flex items-center gap-2"
      onSubmit={async (event) => {
        event.preventDefault();
        const trimmed = draft.trim();
        if (trimmed.length === 0 || trimmed === value) {
          setIsEditing(false);
          return;
        }
        const error = await onSave(trimmed);
        if (!error) setIsEditing(false);
      }}
    >
      <input
        autoFocus
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        className={`${textFieldClass} mt-0 h-9 py-0`}
        disabled={busy}
      />
      <button type="submit" className={adminGhostButtonClass} disabled={busy}>
        {saveLabel}
      </button>
      <button
        type="button"
        className={adminGhostButtonClass}
        onClick={() => setIsEditing(false)}
        disabled={busy}
      >
        {cancelLabel}
      </button>
    </form>
  );
}

/** Two-step confirm button (click once to arm, again to confirm). */
export function AdminConfirmButton({
  label,
  confirmLabel,
  busy,
  disabled,
  onConfirm,
}: {
  label: string;
  confirmLabel: string;
  busy: boolean;
  disabled?: boolean;
  onConfirm: () => void;
}) {
  const [armed, setArmed] = useState(false);

  return (
    <button
      type="button"
      className={armed ? dangerButtonClass.replace("px-3.5 py-2", "px-3 py-1.5 text-xs") : adminGhostButtonClass}
      disabled={busy || disabled}
      onClick={() => {
        if (armed) {
          onConfirm();
          setArmed(false);
        } else {
          setArmed(true);
        }
      }}
      onBlur={() => setArmed(false)}
    >
      {armed ? confirmLabel : label}
    </button>
  );
}
