import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { AssistantDocumentExtractor } from "./assistant-document-extractor";
import {
  AssistantSearchDocumentRecord,
  AssistantSearchDocumentStore,
  AssistantSearchDocumentUpsertInput,
  AssistantSearchSourceType,
} from "./assistant-search-document-store";
import { AssistantEmbeddingClient } from "./assistant-embedding-client";

export type AssistantSearchSyncSummary = {
  documentCount: number;
  changedCount: number;
};

export type AssistantSearchSyncService = {
  syncUserWorkspace(userId: string): Promise<AssistantSearchSyncSummary>;
};

/**
 * A single searchable entry returned by a SearchIndexPlugin.
 * If `attachment` is set, the sync service will run OCR/extraction automatically.
 */
export type SearchIndexEntry = {
  sourceType: AssistantSearchSourceType;
  sourceId: string;
  title: string | null;
  /** Plain-text body (for text docs). Leave empty string for attachment entries. */
  bodyText: string;
  /** Additional metadata stored alongside the document. */
  metadata: Record<string, unknown>;
  updatedAt: Date;
  /** If set, OCR/extraction is run on this file. Omit for plain-text entries. */
  attachment?: {
    name: string;
    url: string;
    contentType: string | null;
  };
};

/**
 * Implement this interface for each domain that needs to be searchable.
 * Register the plugin in app.ts — the sync service handles everything else.
 */
export type SearchIndexPlugin = {
  fetchEntries(userId: string): Promise<SearchIndexEntry[]>;
};

export type AssistantSearchSyncServiceOptions = {
  plugins: SearchIndexPlugin[];
  searchDocumentStore: AssistantSearchDocumentStore;
  documentExtractor: AssistantDocumentExtractor;
  embeddingClient: AssistantEmbeddingClient;
  embeddingModel: string;
};

type SearchDocumentDraft = AssistantSearchDocumentUpsertInput & {
  shouldEmbed: boolean;
};

export function normalizePlainText(...parts: Array<string | null | undefined>): string {
  return parts
    .map((part) => (part ? stripRichTextToPlainText(part) : ""))
    .filter((part) => part.length > 0)
    .join("\n\n")
    .trim();
}

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

export function createAssistantSearchSyncService(
  options: AssistantSearchSyncServiceOptions
): AssistantSearchSyncService {
  const {
    plugins,
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

      for (const plugin of plugins) {
        const entries = await plugin.fetchEntries(userId);

        for (const entry of entries) {
          const existing =
            existingByKey.get(keyForDocument(entry.sourceType, entry.sourceId)) ?? null;

          if (entry.attachment) {
            // File attachment entry: use content signature for extraction caching
            const contentSig = hashContent(
              JSON.stringify({
                name: entry.attachment.name,
                url: entry.attachment.url,
                contentType: entry.attachment.contentType,
              })
            );

            const existingSig =
              existing && existing.metadataJson && typeof existing.metadataJson === "object" && !Array.isArray(existing.metadataJson)
                ? (existing.metadataJson as Record<string, unknown>)._contentSig as string | undefined
                : undefined;

            if (existing && existingSig === contentSig) {
              // Reuse existing extraction result — no re-OCR needed
              drafts.push(
                draftDocument({
                  userId,
                  sourceType: entry.sourceType,
                  sourceId: entry.sourceId,
                  title: entry.title,
                  bodyText: existing.bodyText,
                  metadataJson: buildBaseMetadata(entry.sourceType, {
                    ...entry.metadata,
                    _contentSig: contentSig,
                  }),
                  sourceUpdatedAt: entry.updatedAt,
                  extractionStatus: existing.extractionStatus,
                  extractionWarning: existing.extractionWarning,
                  reuseExisting: existing,
                })
              );
            } else {
              // Extract fresh (new attachment or content changed)
              const extraction = await documentExtractor.extractFromAttachment({
                name: entry.attachment.name,
                url: entry.attachment.url,
                contentType: entry.attachment.contentType,
              });

              drafts.push(
                draftDocument({
                  userId,
                  sourceType: entry.sourceType,
                  sourceId: entry.sourceId,
                  title: entry.title,
                  bodyText: extraction.text,
                  metadataJson: buildBaseMetadata(entry.sourceType, {
                    ...entry.metadata,
                    _contentSig: contentSig,
                    parser: extraction.parser,
                  }),
                  sourceUpdatedAt: entry.updatedAt,
                  extractionStatus: extraction.status,
                  extractionWarning: extraction.warning,
                  reuseExisting: existing,
                })
              );
            }
          } else {
            // Plain-text document entry
            drafts.push(
              draftDocument({
                userId,
                sourceType: entry.sourceType,
                sourceId: entry.sourceId,
                title: entry.title,
                bodyText: entry.bodyText,
                metadataJson: buildBaseMetadata(entry.sourceType, entry.metadata),
                sourceUpdatedAt: entry.updatedAt,
                reuseExisting: existing,
              })
            );
          }
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
