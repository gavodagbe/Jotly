import { Prisma, PrismaClient } from "@prisma/client";

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
  | "noteAttachment";

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
};

export type SearchDirectResult = {
  results: AssistantSearchResult[];
  totalCount: number;
};

export type AssistantSearchDocumentStore = {
  listByUser(userId: string): Promise<AssistantSearchDocumentRecord[]>;
  replaceUserDocuments(userId: string, documents: AssistantSearchDocumentUpsertInput[]): Promise<void>;
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

type PrismaFullTextRow = {
  sourceType: AssistantSearchSourceType;
  sourceId: string;
  title: string | null;
  bodyText: string;
  metadataJson: Prisma.JsonValue | null;
  updatedAt: Date;
  score: number | string | null;
  snippet: string | null;
};

type PrismaVectorRow = PrismaFullTextRow;

function keyForSource(
  userId: string,
  sourceType: AssistantSearchSourceType,
  sourceId: string
): string {
  return `${userId}:${sourceType}:${sourceId}`;
}

function uniqueSourceKeys(documents: AssistantSearchDocumentUpsertInput[]): Set<string> {
  return new Set(
    documents.map((document) =>
      keyForSource(document.userId, document.sourceType, document.sourceId)
    )
  );
}

function parseScore(value: number | string | null | undefined): number {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function buildVectorLiteral(values: number[]): string {
  return `[${values.map((value) => Number(value).toFixed(12)).join(",")}]`;
}

function toResult(
  row: PrismaFullTextRow | PrismaVectorRow,
  matchedBy: "fulltext" | "vector"
): AssistantSearchResult {
  return {
    sourceType: row.sourceType,
    sourceId: row.sourceId,
    title: row.title,
    bodyText: row.bodyText,
    snippet: row.snippet?.trim() || row.bodyText.slice(0, 280),
    score: parseScore(row.score),
    matchedBy,
    metadataJson: row.metadataJson,
    updatedAt: new Date(row.updatedAt),
  };
}

function toSourceType(sourceType: string): AssistantSearchSourceType {
  return sourceType as AssistantSearchSourceType;
}

function toNullableJsonInput(
  value: Prisma.InputJsonObject | null
): Prisma.InputJsonObject | Prisma.NullableJsonNullValueInput | undefined {
  return value === null ? Prisma.JsonNull : value;
}

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
    async listByUser(userId) {
      return [...records.values()]
        .filter((record) => record.userId === userId)
        .sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime());
    },

    async replaceUserDocuments(userId, documents) {
      const nextKeys = uniqueSourceKeys(documents);

      for (const [key, record] of records.entries()) {
        if (record.userId === userId && !nextKeys.has(key)) {
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

      const candidates = [...records.values()].filter((row) => {
        if (row.userId !== userId) return false;
        if (!filterBySourceTypes(options?.sourceTypes, row)) return false;
        if (options?.from && row.updatedAt < options.from) return false;
        if (options?.to && row.updatedAt > options.to) return false;
        return rankFullText(trimmed, row) > 0;
      });

      candidates.sort((a, b) => {
        const scoreDiff = rankFullText(trimmed, b) - rankFullText(trimmed, a);
        if (scoreDiff !== 0) return scoreDiff;
        return b.updatedAt.getTime() - a.updatedAt.getTime();
      });

      const totalCount = candidates.length;
      const offset = (page - 1) * limit;
      const paged = candidates.slice(offset, offset + limit);

      return {
        totalCount,
        results: paged.map((row) => {
          const score = rankFullText(trimmed, row);
          return {
            sourceType: row.sourceType,
            sourceId: row.sourceId,
            title: row.title,
            bodyText: row.bodyText,
            snippet: row.bodyText.slice(0, 280),
            score,
            matchedBy: "fulltext" as const,
            metadataJson: row.metadataJson,
            updatedAt: row.updatedAt,
          };
        }),
      };
    },

    async supportsVectorSearch() {
      return [...records.values()].some((row) => Array.isArray(row.embedding));
    },
  };
}

export function createPrismaAssistantSearchDocumentStore(
  prisma = new PrismaClient()
): AssistantSearchDocumentStore {
  let vectorSupport: boolean | null = null;

  async function checkVectorSupport(): Promise<boolean> {
    if (vectorSupport !== null) {
      return vectorSupport;
    }

    const rows = await prisma.$queryRaw<Array<{ supported: boolean }>>(Prisma.sql`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'AssistantSearchDocument'
          AND column_name = 'embedding'
      ) AS supported
    `);

    vectorSupport = rows[0]?.supported ?? false;
    return vectorSupport;
  }

  function buildSourceTypeWhere(sourceTypes?: AssistantSearchSourceType[]) {
    if (!sourceTypes || sourceTypes.length === 0) {
      return Prisma.empty;
    }

    return Prisma.sql`AND "sourceType" IN (${Prisma.join(sourceTypes)})`;
  }

  async function applyEmbedding(
    document: AssistantSearchDocumentUpsertInput
  ): Promise<void> {
    if (document.embedding === undefined || !(await checkVectorSupport())) {
      return;
    }

    if (document.embedding === null) {
      await prisma.$executeRaw(
        Prisma.sql`
          UPDATE "AssistantSearchDocument"
          SET embedding = NULL
          WHERE "userId" = ${document.userId}
            AND "sourceType" = ${document.sourceType}
            AND "sourceId" = ${document.sourceId}
        `
      );
      return;
    }

    const vectorLiteral = buildVectorLiteral(document.embedding);
    await prisma.$executeRaw(
      Prisma.sql`
        UPDATE "AssistantSearchDocument"
        SET embedding = ${vectorLiteral}::vector
        WHERE "userId" = ${document.userId}
          AND "sourceType" = ${document.sourceType}
          AND "sourceId" = ${document.sourceId}
      `
    );
  }

  return {
    async listByUser(userId) {
      const rows = await prisma.assistantSearchDocument.findMany({
        where: { userId },
        orderBy: { updatedAt: "desc" },
      });

      return rows.map((row) => ({
        ...row,
        sourceType: toSourceType(row.sourceType),
      }));
    },

    async replaceUserDocuments(userId, documents) {
      const existing = await prisma.assistantSearchDocument.findMany({
        where: { userId },
        select: { sourceType: true, sourceId: true },
      });
      const nextKeys = uniqueSourceKeys(documents);
      const staleSources = existing.filter(
        (document) =>
          !nextKeys.has(keyForSource(userId, document.sourceType as AssistantSearchSourceType, document.sourceId))
      );

      await prisma.$transaction(async (tx) => {
        for (const document of documents) {
          await tx.assistantSearchDocument.upsert({
            where: {
              userId_sourceType_sourceId: {
                userId: document.userId,
                sourceType: document.sourceType,
                sourceId: document.sourceId,
              },
            },
            create: {
              userId: document.userId,
              sourceType: document.sourceType,
              sourceId: document.sourceId,
              title: document.title,
              bodyText: document.bodyText,
              metadataJson: toNullableJsonInput(document.metadataJson),
              contentHash: document.contentHash,
              sourceUpdatedAt: document.sourceUpdatedAt,
              extractionStatus: document.extractionStatus ?? null,
              extractionWarning: document.extractionWarning ?? null,
              embeddingModel: document.embeddingModel ?? null,
            },
            update: {
              title: document.title,
              bodyText: document.bodyText,
              metadataJson: toNullableJsonInput(document.metadataJson),
              contentHash: document.contentHash,
              sourceUpdatedAt: document.sourceUpdatedAt,
              extractionStatus: document.extractionStatus ?? null,
              extractionWarning: document.extractionWarning ?? null,
              embeddingModel: document.embeddingModel ?? null,
            },
          });
        }

        if (staleSources.length > 0) {
          await tx.assistantSearchDocument.deleteMany({
            where: {
              userId,
              OR: staleSources.map((document) => ({
                sourceType: document.sourceType,
                sourceId: document.sourceId,
              })),
            },
          });
        }
      });

      for (const document of documents) {
        await applyEmbedding(document);
      }
    },

    async fullTextSearch(userId, query, options) {
      const trimmedQuery = query.trim();
      if (trimmedQuery.length === 0) {
        return [];
      }

      const limit = options?.limit ?? 5;
      const sourceTypeWhere = buildSourceTypeWhere(options?.sourceTypes);

      const rows = await prisma.$queryRaw<PrismaFullTextRow[]>(Prisma.sql`
        SELECT
          "sourceType",
          "sourceId",
          "title",
          "bodyText",
          "metadataJson",
          "updatedAt",
          ts_rank_cd(search_vector, websearch_to_tsquery('simple', ${trimmedQuery})) AS score,
          ts_headline(
            'simple',
            concat_ws(' ', COALESCE("title", ''), COALESCE("bodyText", '')),
            websearch_to_tsquery('simple', ${trimmedQuery}),
            'MaxWords=26, MinWords=8, ShortWord=2, HighlightAll=false'
          ) AS snippet
        FROM "AssistantSearchDocument"
        WHERE "userId" = ${userId}
          ${sourceTypeWhere}
          AND search_vector @@ websearch_to_tsquery('simple', ${trimmedQuery})
        ORDER BY score DESC, "updatedAt" DESC
        LIMIT ${limit}
      `);

      return rows.map((row) => toResult(row, "fulltext"));
    },

    async vectorSearch(userId, embedding, options) {
      if (!(await checkVectorSupport()) || embedding.length === 0) {
        return [];
      }

      const vectorLiteral = buildVectorLiteral(embedding);
      const limit = options?.limit ?? 5;
      const sourceTypeWhere = buildSourceTypeWhere(options?.sourceTypes);

      const rows = await prisma.$queryRaw<PrismaVectorRow[]>(Prisma.sql`
        SELECT
          "sourceType",
          "sourceId",
          "title",
          "bodyText",
          "metadataJson",
          "updatedAt",
          1 - (embedding <=> ${vectorLiteral}::vector) AS score,
          left(concat_ws(' ', COALESCE("title", ''), COALESCE("bodyText", '')), 280) AS snippet
        FROM "AssistantSearchDocument"
        WHERE "userId" = ${userId}
          ${sourceTypeWhere}
          AND embedding IS NOT NULL
        ORDER BY embedding <=> ${vectorLiteral}::vector ASC, "updatedAt" DESC
        LIMIT ${limit}
      `);

      return rows.map((row) => toResult(row, "vector"));
    },

    async searchDirect(userId, query, options) {
      const trimmedQuery = query.trim();
      if (trimmedQuery.length === 0) {
        return { results: [], totalCount: 0 };
      }

      const page = Math.max(1, options?.page ?? 1);
      const limit = Math.min(50, Math.max(1, options?.limit ?? 20));
      const offset = (page - 1) * limit;

      const sourceTypeWhere = buildSourceTypeWhere(options?.sourceTypes);
      const fromWhere = options?.from ? Prisma.sql`AND "updatedAt" >= ${options.from}` : Prisma.empty;
      const toWhere = options?.to ? Prisma.sql`AND "updatedAt" <= ${options.to}` : Prisma.empty;

      const countRows = await prisma.$queryRaw<Array<{ total: bigint }>>(Prisma.sql`
        SELECT COUNT(*) AS total
        FROM "AssistantSearchDocument"
        WHERE "userId" = ${userId}
          ${sourceTypeWhere}
          ${fromWhere}
          ${toWhere}
          AND search_vector @@ websearch_to_tsquery('simple', ${trimmedQuery})
      `);

      const totalCount = Number(countRows[0]?.total ?? 0);

      const rows = await prisma.$queryRaw<PrismaFullTextRow[]>(Prisma.sql`
        SELECT
          "sourceType",
          "sourceId",
          "title",
          "bodyText",
          "metadataJson",
          "updatedAt",
          ts_rank_cd(search_vector, websearch_to_tsquery('simple', ${trimmedQuery})) AS score,
          ts_headline(
            'simple',
            concat_ws(' ', COALESCE("title", ''), COALESCE("bodyText", '')),
            websearch_to_tsquery('simple', ${trimmedQuery}),
            'MaxWords=26, MinWords=8, ShortWord=2, HighlightAll=false'
          ) AS snippet
        FROM "AssistantSearchDocument"
        WHERE "userId" = ${userId}
          ${sourceTypeWhere}
          ${fromWhere}
          ${toWhere}
          AND search_vector @@ websearch_to_tsquery('simple', ${trimmedQuery})
        ORDER BY score DESC, "updatedAt" DESC
        LIMIT ${limit} OFFSET ${offset}
      `);

      return {
        totalCount,
        results: rows.map((row) => toResult(row, "fulltext")),
      };
    },

    supportsVectorSearch: checkVectorSupport,

    async close() {
      await prisma.$disconnect();
    },
  };
}
