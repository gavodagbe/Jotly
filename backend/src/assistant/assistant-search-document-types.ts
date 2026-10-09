import { Prisma } from "@prisma/client";

export type AssistantSearchSourceType =
  | "task"
  | "comment"
  | "affirmation"
  | "bilan"
  | "reminder"
  | "calendarEvent"
  | "calendarNote"
  | "attachment"
  | "note"
  | "noteAttachment"
  | "weeklyObjective"
  | "weeklyReview"
  | "monthlyObjective"
  | "monthlyReview";

export type AssistantSearchDocumentRecord = {
  id: string;
  userId: string;
  sourceType: AssistantSearchSourceType;
  sourceId: string;
  title: string | null;
  bodyText: string;
  metadataJson: Prisma.JsonValue | null;
  contentHash: string;
  sourceUpdatedAt: Date;
  extractionStatus: string | null;
  extractionWarning: string | null;
  embeddingModel: string | null;
  createdAt: Date;
  updatedAt: Date;
  embedding?: number[] | null;
};

export type AssistantSearchDocumentUpsertInput = {
  userId: string;
  sourceType: AssistantSearchSourceType;
  sourceId: string;
  title: string | null;
  bodyText: string;
  metadataJson: Prisma.InputJsonObject | null;
  contentHash: string;
  sourceUpdatedAt: Date;
  extractionStatus?: string | null;
  extractionWarning?: string | null;
  embeddingModel?: string | null;
  embedding?: number[] | null;
};

export type AssistantSearchResult = {
  sourceType: AssistantSearchSourceType;
  sourceId: string;
  title: string | null;
  bodyText: string;
  snippet: string;
  score: number;
  matchedBy: "fulltext" | "vector";
  metadataJson: Prisma.JsonValue | null;
  updatedAt: Date;
};

export type SearchDirectOptions = {
  sourceTypes?: AssistantSearchSourceType[];
  from?: Date;
  to?: Date;
  page?: number;
  limit?: number;
  /**
   * Optional pre-computed query embedding. When provided and vector search is
   * supported, the store runs a hybrid full-text + vector search and merges
   * the results before returning the requested page.
   */
  embedding?: number[];
};

export type SearchDirectResult = {
  results: AssistantSearchResult[];
  totalCount: number;
};

export type AssistantSearchDocumentStore = {
  listByUser(
    userId: string,
    options?: { sourceTypes?: AssistantSearchSourceType[] }
  ): Promise<AssistantSearchDocumentRecord[]>;
  listRecentByUser(userId: string, limit: number): Promise<AssistantSearchResult[]>;
  /**
   * Upserts `documents` and deletes the user's other documents. When
   * `sourceTypes` is set, only documents of those types are considered stale,
   * so a partial sync never wipes the index of unrelated domains.
   */
  replaceUserDocuments(
    userId: string,
    documents: AssistantSearchDocumentUpsertInput[],
    options?: { sourceTypes?: AssistantSearchSourceType[] }
  ): Promise<void>;
  fullTextSearch(
    userId: string,
    query: string,
    options?: { sourceTypes?: AssistantSearchSourceType[]; limit?: number }
  ): Promise<AssistantSearchResult[]>;
  vectorSearch(
    userId: string,
    embedding: number[],
    options?: { sourceTypes?: AssistantSearchSourceType[]; limit?: number }
  ): Promise<AssistantSearchResult[]>;
  searchDirect(
    userId: string,
    query: string,
    options?: SearchDirectOptions
  ): Promise<SearchDirectResult>;
  supportsVectorSearch(): Promise<boolean>;
  close?: () => Promise<void>;
};

export function keyForSource(
  userId: string,
  sourceType: AssistantSearchSourceType,
  sourceId: string
): string {
  return `${userId}:${sourceType}:${sourceId}`;
}

export function uniqueSourceKeys(documents: AssistantSearchDocumentUpsertInput[]): Set<string> {
  return new Set(
    documents.map((document) =>
      keyForSource(document.userId, document.sourceType, document.sourceId)
    )
  );
}
