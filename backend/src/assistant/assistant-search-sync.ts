import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { Task, TaskAttachment } from "@prisma/client";
import { AssistantContextStore } from "./assistant-context-store";
import { AssistantDocumentExtractor } from "./assistant-document-extractor";
import {
  AssistantSearchDocumentRecord,
  AssistantSearchDocumentStore,
  AssistantSearchDocumentUpsertInput,
  AssistantSearchSourceType,
} from "./assistant-search-document-store";
import { AssistantEmbeddingClient } from "./assistant-embedding-client";
import { AttachmentStore } from "../attachments/attachment-store";
import { CommentStore } from "../comments/comment-store";
import { formatDateOnly, TaskStore } from "../tasks/task-store";

export type AssistantSearchSyncSummary = {
  documentCount: number;
  changedCount: number;
};

export type AssistantSearchSyncService = {
  syncUserWorkspace(userId: string): Promise<AssistantSearchSyncSummary>;
};

export type AssistantSearchSyncServiceOptions = {
  taskStore?: TaskStore;
  commentStore?: CommentStore;
  attachmentStore?: AttachmentStore;
  assistantContextStore?: AssistantContextStore;
  searchDocumentStore: AssistantSearchDocumentStore;
  documentExtractor: AssistantDocumentExtractor;
  embeddingClient: AssistantEmbeddingClient;
  embeddingModel: string;
};

type SearchDocumentDraft = AssistantSearchDocumentUpsertInput & {
  shouldEmbed: boolean;
};

function stripRichTextToPlainText(value: string): string {
  return value
    .replace(/<input\b[^>]*type=["']checkbox["'][^>]*checked[^>]*>/gi, "[x] ")
    .replace(/<input\b[^>]*type=["']checkbox["'][^>]*>/gi, "[ ] ")
    .replace(/<li\b[^>]*>/gi, "- ")
    .replace(/<(?:br|hr)\s*\/?>/gi, "\n")
    .replace(/<\/(?:p|div|blockquote|li|ul|ol)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function normalizePlainText(...parts: Array<string | null | undefined>): string {
  return parts
    .map((part) => (part ? stripRichTextToPlainText(part) : ""))
    .filter((part) => part.length > 0)
    .join("\n\n")
    .trim();
}

function hashContent(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function keyForDocument(
  sourceType: AssistantSearchSourceType,
  sourceId: string
): string {
  return `${sourceType}:${sourceId}`;
}

function buildBaseMetadata(
  sourceType: AssistantSearchSourceType,
  data: Record<string, unknown>
): Prisma.InputJsonObject {
  return {
    sourceType,
    ...data,
  };
}

function toInputJsonObject(
  value: Record<string, unknown> | Prisma.JsonValue | null | undefined
): Prisma.InputJsonObject | null {
  if (!value || Array.isArray(value) || typeof value !== "object") {
    return null;
  }

  return value as Prisma.InputJsonObject;
}

function shouldEmbedDocument(title: string | null, bodyText: string): boolean {
  return `${title ?? ""}\n${bodyText}`.trim().length >= 40;
}

function draftDocument(input: {
  userId: string;
  sourceType: AssistantSearchSourceType;
  sourceId: string;
  title: string | null;
  bodyText: string;
  metadataJson: Prisma.InputJsonObject | null;
  sourceUpdatedAt: Date;
  extractionStatus?: string | null;
  extractionWarning?: string | null;
  reuseExisting?: AssistantSearchDocumentRecord | null;
}): SearchDocumentDraft {
  const title = input.title?.trim() || null;
  const bodyText =
    input.bodyText.trim().length > 0
      ? input.bodyText.trim()
      : input.reuseExisting?.bodyText?.trim() ?? "";
  const contentHash = hashContent(
    JSON.stringify({
      title,
      bodyText,
      metadataJson: input.metadataJson,
      sourceUpdatedAt: input.sourceUpdatedAt.toISOString(),
      extractionStatus: input.extractionStatus ?? input.reuseExisting?.extractionStatus ?? null,
      extractionWarning: input.extractionWarning ?? input.reuseExisting?.extractionWarning ?? null,
    })
  );

  return {
    userId: input.userId,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    title,
    bodyText,
    metadataJson: input.metadataJson,
    contentHash,
    sourceUpdatedAt: input.sourceUpdatedAt,
    extractionStatus:
      input.extractionStatus ?? input.reuseExisting?.extractionStatus ?? null,
    extractionWarning:
      input.extractionWarning ?? input.reuseExisting?.extractionWarning ?? null,
    embeddingModel: input.reuseExisting?.embeddingModel ?? null,
    shouldEmbed: shouldEmbedDocument(title, bodyText),
  };
}

async function buildAttachmentDraft(
  userId: string,
  task: Task,
  attachment: TaskAttachment,
  existingByKey: Map<string, AssistantSearchDocumentRecord>,
  documentExtractor: AssistantDocumentExtractor
): Promise<SearchDocumentDraft> {
  const existing =
    existingByKey.get(keyForDocument("attachment", attachment.id)) ?? null;
  const attachmentHash = hashContent(
    JSON.stringify({
      taskId: task.id,
      name: attachment.name,
      url: attachment.url,
      contentType: attachment.contentType,
      sizeBytes: attachment.sizeBytes,
    })
  );

  if (existing && existing.contentHash === attachmentHash) {
    return draftDocument({
      userId,
      sourceType: "attachment",
      sourceId: attachment.id,
      title: attachment.name,
      bodyText: existing.bodyText,
      metadataJson:
        toInputJsonObject(existing.metadataJson) ??
        buildBaseMetadata("attachment", {
          taskId: task.id,
          taskTitle: task.title,
          contentType: attachment.contentType,
          sizeBytes: attachment.sizeBytes,
        }),
      sourceUpdatedAt: attachment.createdAt,
      extractionStatus: existing.extractionStatus,
      extractionWarning: existing.extractionWarning,
      reuseExisting: existing,
    });
  }

  const extraction = await documentExtractor.extractFromAttachment({
    name: attachment.name,
    url: attachment.url,
    contentType: attachment.contentType,
  });

  return draftDocument({
    userId,
    sourceType: "attachment",
    sourceId: attachment.id,
    title: attachment.name,
    bodyText: extraction.text,
    metadataJson: buildBaseMetadata("attachment", {
      taskId: task.id,
      taskTitle: task.title,
      contentType: attachment.contentType,
      sizeBytes: attachment.sizeBytes,
      parser: extraction.parser,
    }),
    sourceUpdatedAt: attachment.createdAt,
    extractionStatus: extraction.status,
    extractionWarning: extraction.warning,
    reuseExisting: existing,
  });
}

export function createAssistantSearchSyncService(
  options: AssistantSearchSyncServiceOptions
): AssistantSearchSyncService {
  const {
    taskStore,
    commentStore,
    attachmentStore,
    assistantContextStore,
    searchDocumentStore,
    documentExtractor,
    embeddingClient,
    embeddingModel,
  } = options;

  return {
    async syncUserWorkspace(userId) {
      const existingDocuments = await searchDocumentStore.listByUser(userId);
      const existingByKey = new Map(
        existingDocuments.map((document) => [
          keyForDocument(document.sourceType, document.sourceId),
          document,
        ])
      );

      const drafts: SearchDocumentDraft[] = [];
      const tasks = taskStore ? await taskStore.listByUser(userId) : [];

      for (const task of tasks) {
        drafts.push(
          draftDocument({
            userId,
            sourceType: "task",
            sourceId: task.id,
            title: task.title,
            bodyText: normalizePlainText(task.description, task.project),
            metadataJson: buildBaseMetadata("task", {
              targetDate: formatDateOnly(task.targetDate),
              dueDate: task.dueDate ? formatDateOnly(task.dueDate) : null,
              status: task.status,
              priority: task.priority,
              plannedTime: task.plannedTime,
              project: task.project,
            }),
            sourceUpdatedAt: task.updatedAt,
            reuseExisting: existingByKey.get(keyForDocument("task", task.id)) ?? null,
          })
        );

        if (commentStore) {
          const comments = await commentStore.listByTaskId(task.id);
          for (const comment of comments) {
            drafts.push(
              draftDocument({
                userId,
                sourceType: "comment",
                sourceId: comment.id,
                title: `Comment on ${task.title}`,
                bodyText: normalizePlainText(comment.body),
                metadataJson: buildBaseMetadata("comment", {
                  taskId: task.id,
                  taskTitle: task.title,
                  createdAt: comment.createdAt.toISOString(),
                }),
                sourceUpdatedAt: comment.updatedAt,
                reuseExisting:
                  existingByKey.get(keyForDocument("comment", comment.id)) ?? null,
              })
            );
          }
        }

        if (attachmentStore) {
          const attachments = await attachmentStore.listByTaskId(task.id);
          const attachmentDrafts = await Promise.all(
            attachments.map((attachment) =>
              buildAttachmentDraft(
                userId,
                task,
                attachment,
                existingByKey,
                documentExtractor
              )
            )
          );
          drafts.push(...attachmentDrafts);
        }
      }

      if (assistantContextStore) {
        const snapshot = await assistantContextStore.getByUserId(userId);
        const eventTitlesById = new Map(
          snapshot.calendarEvents.map((event) => [event.id, event.title])
        );

        for (const affirmation of snapshot.dayAffirmations) {
          drafts.push(
            draftDocument({
              userId,
              sourceType: "affirmation",
              sourceId: affirmation.id,
              title: `Affirmation ${formatDateOnly(affirmation.targetDate)}`,
              bodyText: normalizePlainText(affirmation.text),
              metadataJson: buildBaseMetadata("affirmation", {
                targetDate: formatDateOnly(affirmation.targetDate),
                isCompleted: affirmation.isCompleted,
              }),
              sourceUpdatedAt: affirmation.updatedAt,
              reuseExisting:
                existingByKey.get(keyForDocument("affirmation", affirmation.id)) ?? null,
            })
          );
        }

        for (const bilan of snapshot.dayBilans) {
          drafts.push(
            draftDocument({
              userId,
              sourceType: "bilan",
              sourceId: bilan.id,
              title: `Bilan ${formatDateOnly(bilan.targetDate)}`,
              bodyText: normalizePlainText(
                bilan.wins,
                bilan.blockers,
                bilan.lessonsLearned,
                bilan.tomorrowTop3
              ),
              metadataJson: buildBaseMetadata("bilan", {
                targetDate: formatDateOnly(bilan.targetDate),
                mood: bilan.mood,
              }),
              sourceUpdatedAt: bilan.updatedAt,
              reuseExisting:
                existingByKey.get(keyForDocument("bilan", bilan.id)) ?? null,
            })
          );
        }

        for (const reminder of snapshot.reminders) {
          drafts.push(
            draftDocument({
              userId,
              sourceType: "reminder",
              sourceId: reminder.id,
              title: reminder.title,
              bodyText: normalizePlainText(
                reminder.description,
                reminder.project,
                reminder.assignees
              ),
              metadataJson: buildBaseMetadata("reminder", {
                remindAt: reminder.remindAt.toISOString(),
                isDismissed: reminder.isDismissed,
                isFired: reminder.isFired,
              }),
              sourceUpdatedAt: reminder.updatedAt,
              reuseExisting:
                existingByKey.get(keyForDocument("reminder", reminder.id)) ?? null,
            })
          );
        }

        for (const event of snapshot.calendarEvents) {
          drafts.push(
            draftDocument({
              userId,
              sourceType: "calendarEvent",
              sourceId: event.id,
              title: event.title,
              bodyText: normalizePlainText(
                event.description,
                event.location,
                event.organizer,
                event.attendees
              ),
              metadataJson: buildBaseMetadata("calendarEvent", {
                startTime: event.startTime.toISOString(),
                endTime: event.endTime.toISOString(),
                isAllDay: event.isAllDay,
              }),
              sourceUpdatedAt: event.updatedAt,
              reuseExisting:
                existingByKey.get(keyForDocument("calendarEvent", event.id)) ?? null,
            })
          );
        }

        for (const note of snapshot.calendarEventNotes) {
          drafts.push(
            draftDocument({
              userId,
              sourceType: "calendarNote",
              sourceId: note.id,
              title: `Calendar note for ${eventTitlesById.get(note.calendarEventId) ?? note.calendarEventId}`,
              bodyText: normalizePlainText(note.body),
              metadataJson: buildBaseMetadata("calendarNote", {
                calendarEventId: note.calendarEventId,
                calendarEventTitle: eventTitlesById.get(note.calendarEventId) ?? null,
              }),
              sourceUpdatedAt: note.updatedAt,
              reuseExisting:
                existingByKey.get(keyForDocument("calendarNote", note.id)) ?? null,
            })
          );
        }
      }

      const changedDrafts = drafts.filter((draft) => {
        const existing = existingByKey.get(keyForDocument(draft.sourceType, draft.sourceId));
        return (
          !existing ||
          existing.contentHash !== draft.contentHash ||
          existing.embeddingModel !== draft.embeddingModel
        );
      });

      if (embeddingClient.isEnabled()) {
        const embeddableDrafts = changedDrafts.filter((draft) => draft.shouldEmbed);
        const embeddings = await embeddingClient.embedTexts(
          embeddableDrafts.map((draft) =>
            `${draft.title ?? ""}\n${draft.bodyText}`.trim()
          )
        );

        for (let index = 0; index < embeddableDrafts.length; index += 1) {
          embeddableDrafts[index].embedding = embeddings[index] ?? null;
          embeddableDrafts[index].embeddingModel = embeddingModel;
        }

        for (const draft of changedDrafts.filter((draft) => !draft.shouldEmbed)) {
          draft.embedding = null;
          draft.embeddingModel = null;
        }
      } else {
        for (const draft of changedDrafts) {
          draft.embedding = null;
          draft.embeddingModel = null;
        }
      }

      await searchDocumentStore.replaceUserDocuments(userId, drafts);

      return {
        documentCount: drafts.length,
        changedCount: changedDrafts.length,
      };
    },
  };
}
