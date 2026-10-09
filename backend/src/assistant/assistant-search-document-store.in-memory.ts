import { Prisma } from "@prisma/client";
import {
  AssistantSearchDocumentRecord,
  AssistantSearchDocumentStore,
  AssistantSearchSourceType,
  keyForSource,
  uniqueSourceKeys,
} from "./assistant-search-document-types";

export function createInMemoryAssistantSearchDocumentStore(): AssistantSearchDocumentStore {
  const records = new Map<string, AssistantSearchDocumentRecord>();

  function filterBySourceTypes(
    sourceTypes: AssistantSearchSourceType[] | undefined,
    row: AssistantSearchDocumentRecord
  ): boolean {
    return !sourceTypes || sourceTypes.length === 0 || sourceTypes.includes(row.sourceType);
  }

  function tokenize(value: string): string[] {
    return value
      .toLowerCase()
      .split(/[^a-z0-9]+/i)
      .filter((token) => token.length > 2 && token !== "or");
  }

  function rankFullText(query: string, row: AssistantSearchDocumentRecord): number {
    const haystack = `${row.title ?? ""} ${row.bodyText}`.toLowerCase();
    return tokenize(query).reduce(
      (score, token) => score + (haystack.includes(token) ? 1 : 0),
      0
    );
  }

  function cosineSimilarity(left: number[], right: number[]): number {
    if (left.length === 0 || right.length === 0 || left.length !== right.length) {
      return 0;
    }

    let dot = 0;
    let leftNorm = 0;
    let rightNorm = 0;

    for (let index = 0; index < left.length; index += 1) {
      dot += left[index] * right[index];
      leftNorm += left[index] * left[index];
      rightNorm += right[index] * right[index];
    }

    if (leftNorm === 0 || rightNorm === 0) {
      return 0;
    }

    return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
  }

  return {
    async listByUser(userId, options) {
      return [...records.values()]
        .filter((record) => record.userId === userId && filterBySourceTypes(options?.sourceTypes, record))
        .sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime());
    },

    async listRecentByUser(userId, limit) {
      const rows = [...records.values()]
        .filter((row) => row.userId === userId)
        .sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime())
        .slice(0, limit);
      return rows.map((row) => ({
        sourceType: row.sourceType,
        sourceId: row.sourceId,
        title: row.title,
        bodyText: row.bodyText,
        snippet: row.bodyText.slice(0, 120),
        score: 0,
        matchedBy: "fulltext" as const,
        metadataJson: row.metadataJson,
        updatedAt: row.updatedAt,
      }));
    },

    async replaceUserDocuments(userId, documents, options) {
      const nextKeys = uniqueSourceKeys(documents);

      for (const [key, record] of records.entries()) {
        if (
          record.userId === userId &&
          filterBySourceTypes(options?.sourceTypes, record) &&
          !nextKeys.has(key)
        ) {
          records.delete(key);
        }
      }

      for (const document of documents) {
        const key = keyForSource(document.userId, document.sourceType, document.sourceId);
        const existing = records.get(key);
        records.set(key, {
          id: existing?.id ?? key,
          userId: document.userId,
          sourceType: document.sourceType,
          sourceId: document.sourceId,
          title: document.title,
          bodyText: document.bodyText,
          metadataJson: (document.metadataJson as Prisma.JsonValue | null) ?? null,
          contentHash: document.contentHash,
          sourceUpdatedAt: document.sourceUpdatedAt,
          extractionStatus: document.extractionStatus ?? null,
          extractionWarning: document.extractionWarning ?? null,
          embeddingModel: document.embeddingModel ?? null,
          createdAt: existing?.createdAt ?? new Date(),
          updatedAt: new Date(),
          embedding:
            document.embedding === undefined ? existing?.embedding ?? null : document.embedding,
        });
      }
    },

    async fullTextSearch(userId, query, options) {
      const rows = [...records.values()]
        .filter((row) => row.userId === userId && filterBySourceTypes(options?.sourceTypes, row))
        .map((row) => ({
          row,
          score: rankFullText(query, row),
        }))
        .filter((row) => row.score > 0)
        .sort(
          (left, right) =>
            right.score - left.score ||
            right.row.updatedAt.getTime() - left.row.updatedAt.getTime()
        )
        .slice(0, options?.limit ?? 5);

      return rows.map(({ row, score }) => ({
        sourceType: row.sourceType,
        sourceId: row.sourceId,
        title: row.title,
        bodyText: row.bodyText,
        snippet: row.bodyText.slice(0, 280),
        score,
        matchedBy: "fulltext" as const,
        metadataJson: row.metadataJson,
        updatedAt: row.updatedAt,
      }));
    },

    async vectorSearch(userId, embedding, options) {
      const rows = [...records.values()]
        .filter(
          (row) =>
            row.userId === userId &&
            filterBySourceTypes(options?.sourceTypes, row) &&
            Array.isArray(row.embedding)
        )
        .map((row) => ({
          row,
          score: cosineSimilarity(embedding, row.embedding ?? []),
        }))
        .filter((row) => row.score > 0)
        .sort(
          (left, right) =>
            right.score - left.score ||
            right.row.updatedAt.getTime() - left.row.updatedAt.getTime()
        )
        .slice(0, options?.limit ?? 5);

      return rows.map(({ row, score }) => ({
        sourceType: row.sourceType,
        sourceId: row.sourceId,
        title: row.title,
        bodyText: row.bodyText,
        snippet: row.bodyText.slice(0, 280),
        score,
        matchedBy: "vector" as const,
        metadataJson: row.metadataJson,
        updatedAt: row.updatedAt,
      }));
    },

    async searchDirect(userId, query, options) {
      const trimmed = query.trim();
      const page = Math.max(1, options?.page ?? 1);
      const limit = Math.min(50, Math.max(1, options?.limit ?? 20));

      const allRows = [...records.values()].filter((row) => {
        if (row.userId !== userId) return false;
        if (!filterBySourceTypes(options?.sourceTypes, row)) return false;
        if (options?.from && row.updatedAt < options.from) return false;
        if (options?.to && row.updatedAt > options.to) return false;
        return true;
      });

      // Build a score map keyed by sourceType:sourceId, preferring the higher score
      const scoreMap = new Map<
        string,
        { row: AssistantSearchDocumentRecord; score: number; matchedBy: "fulltext" | "vector" }
      >();

      // Full-text candidates
      for (const row of allRows) {
        const ftScore = rankFullText(trimmed, row);
        if (ftScore > 0) {
          const key = `${row.sourceType}:${row.sourceId}`;
          const existing = scoreMap.get(key);
          if (!existing || ftScore > existing.score) {
            scoreMap.set(key, { row, score: ftScore, matchedBy: "fulltext" });
          }
        }
      }

      // Vector candidates (when embedding is provided)
      if (options?.embedding && options.embedding.length > 0) {
        for (const row of allRows) {
          if (!Array.isArray(row.embedding) || row.embedding.length === 0) continue;
          const vecScore = cosineSimilarity(options.embedding, row.embedding);
          if (vecScore > 0) {
            const key = `${row.sourceType}:${row.sourceId}`;
            const existing = scoreMap.get(key);
            if (!existing || vecScore > existing.score) {
              scoreMap.set(key, { row, score: vecScore, matchedBy: "vector" });
            }
          }
        }
      }

      const candidates = [...scoreMap.values()].sort((a, b) => {
        const scoreDiff = b.score - a.score;
        if (scoreDiff !== 0) return scoreDiff;
        return b.row.updatedAt.getTime() - a.row.updatedAt.getTime();
      });

      const totalCount = candidates.length;
      const offset = (page - 1) * limit;
      const paged = candidates.slice(offset, offset + limit);

      return {
        totalCount,
        results: paged.map(({ row, score, matchedBy }) => ({
          sourceType: row.sourceType,
          sourceId: row.sourceId,
          title: row.title,
          bodyText: row.bodyText,
          snippet: row.bodyText.slice(0, 280),
          score,
          matchedBy,
          metadataJson: row.metadataJson,
          updatedAt: row.updatedAt,
        })),
      };
    },

    async supportsVectorSearch() {
      return [...records.values()].some((row) => Array.isArray(row.embedding));
    },
  };
}
