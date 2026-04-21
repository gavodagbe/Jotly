"use client";

import { type RefObject } from "react";
import { RichTextEditor } from "@/components/ui/RichTextEditor";
import {
  controlButtonClass,
  primaryButtonClass,
  textFieldClass,
  controlIconButtonClass,
} from "@/components/ui/constants";
import { CloseIcon, SaveIcon, PlusIcon, TrashIcon } from "@/components/ui/icons";

type UserLocale = "en" | "fr";

type ReminderFormValues = {
  title: string;
  description: string;
  project: string;
  assignees: string;
  remindAt: string;
};

type ReminderAttachment = {
  id: string;
  reminderId: string;
  name: string;
  url: string;
  contentType: string | null;
  sizeBytes: number | null;
  createdAt: string;
};

export type ReminderDialogProps = {
  reminderDialogMode: "create" | "edit" | null;
  reminderFormValues: ReminderFormValues;
  setReminderFormValues: React.Dispatch<React.SetStateAction<ReminderFormValues>>;
  editingReminderId: string | null;
  isSubmittingReminder: boolean;
  reminderErrorMessage: string | null;
  setReminderErrorMessage: React.Dispatch<React.SetStateAction<string | null>>;
  reminderAttachments: Record<string, ReminderAttachment[]>;
  pendingReminderAttachmentIds: string[];
  reminderAttachmentNameDraft: string;
  setReminderAttachmentNameDraft: React.Dispatch<React.SetStateAction<string>>;
  setReminderAttachmentFileDraft: React.Dispatch<React.SetStateAction<File | null>>;
  reminderAttachmentFileInputRef: RefObject<HTMLInputElement | null>;
  isCreatingReminderAttachment: boolean;
  reminderAttachmentErrorMessage: string | null;
  projectSelectOptions: string[];
  assigneeOptions: string[];
  selectedReminderAssignees: string[];
  newAssigneeDraft: string;
  setNewAssigneeDraft: React.Dispatch<React.SetStateAction<string>>;
  handleAddNewAssigneeToReminder: () => void;
  handleReminderFormSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  closeReminderDialog: () => void;
  handleDeleteReminderAttachment: (reminderId: string, attachmentId: string) => Promise<void>;
  handleCreateReminderAttachment: (reminderId: string) => Promise<void>;
  isFrench: boolean;
  activeLocale: UserLocale;
  isDataUrl: (value: string) => boolean;
  formatFileSize: (sizeBytes: number) => string;
  formatAssignees: (list: string[]) => string;
};

export function ReminderDialog({
  reminderDialogMode,
  reminderFormValues,
  setReminderFormValues,
  editingReminderId,
  isSubmittingReminder,
  reminderErrorMessage,
  setReminderErrorMessage,
  reminderAttachments,
  pendingReminderAttachmentIds,
  reminderAttachmentNameDraft,
  setReminderAttachmentNameDraft,
  setReminderAttachmentFileDraft,
  reminderAttachmentFileInputRef,
  isCreatingReminderAttachment,
  reminderAttachmentErrorMessage,
  projectSelectOptions,
  assigneeOptions,
  selectedReminderAssignees,
  newAssigneeDraft,
  setNewAssigneeDraft,
  handleAddNewAssigneeToReminder,
  handleReminderFormSubmit,
  closeReminderDialog,
  handleDeleteReminderAttachment,
  handleCreateReminderAttachment,
  isFrench,
  activeLocale,
  isDataUrl,
  formatFileSize,
  formatAssignees,
}: ReminderDialogProps) {
  if (!reminderDialogMode) return null;

  return (
    <div
      className="animate-fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closeReminderDialog();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label={
          reminderDialogMode === "edit"
            ? isFrench ? "Modifier le rappel" : "Edit Reminder"
            : isFrench ? "Ajouter un rappel" : "Add Reminder"
        }
        className="animate-scale-in flex h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-line bg-surface p-5 shadow-2xl sm:p-6"
      >
        <header className="mb-3 flex shrink-0 items-center justify-between gap-2">
          <div>
            <h2 className="text-xl font-semibold text-foreground">
              {reminderDialogMode === "edit"
                ? isFrench ? "Modifier le rappel" : "Edit Reminder"
                : isFrench ? "Ajouter un rappel" : "Add Reminder"}
            </h2>
            <p className="mt-1 text-sm text-muted">
              {isFrench
                ? "Definissez un titre, une description et l'heure du rappel."
                : "Set a title, description, and the reminder time."}
            </p>
          </div>
          <button
            type="button"
            className={controlIconButtonClass}
            onClick={closeReminderDialog}
            disabled={isSubmittingReminder}
            aria-label={isFrench ? "Fermer" : "Close"}
            title={isFrench ? "Fermer" : "Close"}
          >
            <CloseIcon />
          </button>
        </header>

        <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleReminderFormSubmit}>
          <div className="flex-1 space-y-4 overflow-y-auto pr-1">
            <label className="block text-sm font-semibold text-foreground">
              {isFrench ? "Titre" : "Title"}
              <input
                type="text"
                value={reminderFormValues.title}
                onChange={(event) => {
                  setReminderFormValues((v) => ({ ...v, title: event.target.value }));
                  setReminderErrorMessage(null);
                }}
                className={textFieldClass}
                maxLength={200}
                placeholder={isFrench ? "Titre du rappel" : "Reminder title"}
                required
                disabled={isSubmittingReminder}
              />
            </label>

            <div className="block text-sm font-semibold text-foreground">
              <span>{isFrench ? "Description (optionnel)" : "Description (optional)"}</span>
              <RichTextEditor
                locale={activeLocale}
                value={reminderFormValues.description}
                onChange={(nextValue) => {
                  setReminderFormValues((v) => ({ ...v, description: nextValue }));
                }}
                disabled={isSubmittingReminder}
              />
            </div>

            <label className="block text-sm font-semibold text-foreground">
              {isFrench ? "Projet (optionnel)" : "Project (optional)"}
              <select
                value={reminderFormValues.project}
                onChange={(event) => {
                  setReminderFormValues((v) => ({ ...v, project: event.target.value }));
                }}
                className={textFieldClass}
                disabled={isSubmittingReminder}
              >
                <option value="">{isFrench ? "Aucun projet" : "No project"}</option>
                {projectSelectOptions.map((projectName) => (
                  <option key={projectName} value={projectName}>
                    {projectName}
                  </option>
                ))}
              </select>
            </label>

            <div>
              <p className="text-sm font-semibold text-foreground">
                {isFrench ? "Assignes" : "Assignees"}
              </p>
              {selectedReminderAssignees.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {selectedReminderAssignees.map((name) => (
                    <span
                      key={name}
                      className="inline-flex items-center gap-1 rounded-full border border-accent/30 bg-accent/10 px-2.5 py-0.5 text-xs font-medium text-accent"
                    >
                      {name}
                      <button
                        type="button"
                        aria-label={isFrench ? `Retirer ${name}` : `Remove ${name}`}
                        onClick={() => {
                          setReminderFormValues((v) => ({
                            ...v,
                            assignees: formatAssignees(selectedReminderAssignees.filter((n) => n !== name)),
                          }));
                        }}
                        disabled={isSubmittingReminder}
                        className="ml-0.5 rounded-full text-accent/70 hover:text-accent disabled:cursor-not-allowed"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <select
                value=""
                onChange={(event) => {
                  if (!event.target.value) return;
                  if (!selectedReminderAssignees.includes(event.target.value)) {
                    setReminderFormValues((v) => ({
                      ...v,
                      assignees: formatAssignees([...selectedReminderAssignees, event.target.value]),
                    }));
                  }
                  event.target.value = "";
                }}
                className={textFieldClass}
                disabled={isSubmittingReminder}
              >
                <option value="">
                  {isFrench ? "— Ajouter une personne —" : "— Add a person —"}
                </option>
                {assigneeOptions
                  .filter((name) => !selectedReminderAssignees.includes(name))
                  .map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
              </select>
              <div className="mt-1.5 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                <input
                  type="text"
                  value={newAssigneeDraft}
                  onChange={(event) => setNewAssigneeDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      handleAddNewAssigneeToReminder();
                    }
                  }}
                  placeholder={isFrench ? "Nouveau nom ou email" : "New name or email"}
                  className={textFieldClass}
                  disabled={isSubmittingReminder}
                  maxLength={200}
                />
                <button
                  type="button"
                  className={controlButtonClass}
                  onClick={handleAddNewAssigneeToReminder}
                  disabled={isSubmittingReminder}
                >
                  <PlusIcon />
                  {isFrench ? "Ajouter" : "Add"}
                </button>
              </div>
            </div>

            <label className="block text-sm font-semibold text-foreground">
              {isFrench ? "Date et heure" : "Date & Time"}
              <input
                type="datetime-local"
                value={reminderFormValues.remindAt}
                onChange={(event) => {
                  setReminderFormValues((v) => ({ ...v, remindAt: event.target.value }));
                  setReminderErrorMessage(null);
                }}
                className={textFieldClass}
                required
                disabled={isSubmittingReminder}
              />
            </label>

            {reminderErrorMessage ? (
              <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                {reminderErrorMessage}
              </p>
            ) : null}

            {reminderDialogMode === "edit" && editingReminderId ? (
              <div className="border-t border-line pt-4">
                <p className="mb-2 text-sm font-semibold text-foreground">
                  {isFrench ? "Documents" : "Documents"} ({(reminderAttachments[editingReminderId] ?? []).length})
                </p>
                {(reminderAttachments[editingReminderId] ?? []).length > 0 ? (
                  <ul className="mb-3 flex flex-col gap-1.5">
                    {(reminderAttachments[editingReminderId] ?? []).map((attachment) => (
                      <li key={attachment.id} className="flex items-center justify-between gap-2 rounded-lg border border-line bg-surface px-3 py-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-foreground">{attachment.name}</p>
                          <a
                            href={attachment.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs font-medium text-accent underline-offset-2 hover:underline"
                            download={isDataUrl(attachment.url) ? attachment.name : undefined}
                          >
                            {isDataUrl(attachment.url) ? (isFrench ? "Ouvrir le fichier" : "Open file") : attachment.url}
                          </a>
                          {attachment.contentType || typeof attachment.sizeBytes === "number" ? (
                            <p className="mt-0.5 text-[11px] text-muted">
                              {[attachment.contentType ?? null, typeof attachment.sizeBytes === "number" ? formatFileSize(attachment.sizeBytes) : null].filter((v): v is string => Boolean(v)).join(" · ")}
                            </p>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          className="shrink-0 rounded-md px-2 py-1 text-xs text-rose-500 transition-colors hover:bg-rose-50 disabled:opacity-50"
                          disabled={pendingReminderAttachmentIds.includes(attachment.id)}
                          onClick={() => { void handleDeleteReminderAttachment(editingReminderId, attachment.id); }}
                        >
                          {pendingReminderAttachmentIds.includes(attachment.id) ? "…" : <TrashIcon />}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mb-3 rounded-xl border border-dashed border-line bg-surface px-3 py-2 text-sm text-muted">
                    {isFrench ? "Aucun document pour le moment." : "No documents yet."}
                  </p>
                )}
                {reminderAttachmentErrorMessage ? (
                  <p className="mb-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">{reminderAttachmentErrorMessage}</p>
                ) : null}
                <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_auto] sm:items-end">
                  <label className="block text-xs font-medium text-muted">
                    {isFrench ? "Nom" : "Name"}
                    <input
                      type="text"
                      value={reminderAttachmentNameDraft}
                      onChange={(e) => setReminderAttachmentNameDraft(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-line bg-white px-2 py-1.5 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50"
                      placeholder={isFrench ? "Nom du fichier" : "File name"}
                      disabled={isCreatingReminderAttachment}
                    />
                  </label>
                  <label className="block text-xs font-medium text-muted">
                    {isFrench ? "Fichier" : "File"}
                    <input
                      ref={reminderAttachmentFileInputRef}
                      type="file"
                      onChange={(e) => setReminderAttachmentFileDraft(e.target.files?.[0] ?? null)}
                      className="mt-1 w-full rounded-lg border border-line bg-white px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50"
                      disabled={isCreatingReminderAttachment}
                    />
                  </label>
                  <button
                    type="button"
                    className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-accent/90 disabled:opacity-50"
                    disabled={isCreatingReminderAttachment}
                    onClick={() => { void handleCreateReminderAttachment(editingReminderId); }}
                  >
                    {isCreatingReminderAttachment ? "…" : isFrench ? "Ajouter" : "Add"}
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-line pt-3 mt-3">
            <button
              type="button"
              className={controlButtonClass}
              onClick={closeReminderDialog}
              disabled={isSubmittingReminder}
            >
              <CloseIcon />
              {isFrench ? "Annuler" : "Cancel"}
            </button>
            <button type="submit" className={primaryButtonClass} disabled={isSubmittingReminder}>
              <SaveIcon />
              {isSubmittingReminder
                ? isFrench ? "Enregistrement..." : "Saving..."
                : reminderDialogMode === "edit"
                ? isFrench ? "Mettre a jour" : "Update"
                : isFrench ? "Creer le rappel" : "Create Reminder"}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
