import { Prisma, PrismaClient } from "@prisma/client";
import {
  AssistantSearchDocumentStore,
  AssistantSearchDocumentUpsertInput,
  AssistantSearchResult,
  AssistantSearchSourceType,
  keyForSource,
  uniqueSourceKeys,
} from "./assistant-search-document-types";

export * from "./assistant-search-document-types";

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

  function buildSourceTypeFilter(sourceTypes?: AssistantSearchSourceType[]) {
    return sourceTypes && sourceTypes.length > 0 ? { sourceType: { in: sourceTypes } } : {};
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
    async listByUser(userId, options) {
      const rows = await prisma.assistantSearchDocument.findMany({
        where: { userId, ...buildSourceTypeFilter(options?.sourceTypes) },
        orderBy: { updatedAt: "desc" },
      });

      return rows.map((row) => ({
        ...row,
        sourceType: toSourceType(row.sourceType),
      }));
    },

    async listRecentByUser(userId, limit) {
      const rows = await prisma.assistantSearchDocument.findMany({
        where: { userId },
        orderBy: { updatedAt: "desc" },
        take: limit,
      });
      return rows.map((row) => ({
        sourceType: toSourceType(row.sourceType),
        sourceId: row.sourceId,
        title: row.title,
        bodyText: row.bodyText,
        snippet: row.bodyText.slice(0, 120),
        score: 0,
        matchedBy: "fulltext" as const,
        metadataJson: row.metadataJson,
        updatedAt: new Date(row.updatedAt),
      }));
    },

    async replaceUserDocuments(userId, documents, options) {
      const existing = await prisma.assistantSearchDocument.findMany({
        where: { userId, ...buildSourceTypeFilter(options?.sourceTypes) },
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
      }, { timeout: 60000 });

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
            'MaxWords=80, MinWords=20, ShortWord=2, HighlightAll=true, StartSel=[[, StopSel=]]'
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

      const vectorEnabled =
        options?.embedding &&
        options.embedding.length > 0 &&
        (await checkVectorSupport());

      if (vectorEnabled && options?.embedding) {
        // Hybrid mode: combine full-text and vector results, deduplicate by sourceId, re-rank
        const vectorLiteral = buildVectorLiteral(options.embedding);

        const ftRows = await prisma.$queryRaw<PrismaFullTextRow[]>(Prisma.sql`
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
              'MaxWords=80, MinWords=20, ShortWord=2, HighlightAll=true, StartSel=[[, StopSel=]]'
            ) AS snippet
          FROM "AssistantSearchDocument"
          WHERE "userId" = ${userId}
            ${sourceTypeWhere}
            ${fromWhere}
            ${toWhere}
            AND search_vector @@ websearch_to_tsquery('simple', ${trimmedQuery})
          ORDER BY score DESC, "updatedAt" DESC
          LIMIT 100
        `);

        const vecRows = await prisma.$queryRaw<PrismaVectorRow[]>(Prisma.sql`
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
            ${fromWhere}
            ${toWhere}
            AND embedding IS NOT NULL
          ORDER BY embedding <=> ${vectorLiteral}::vector ASC, "updatedAt" DESC
          LIMIT 100
        `);

        // Merge: keep highest score per (sourceType, sourceId)
        const merged = new Map<string, { row: PrismaFullTextRow | PrismaVectorRow; matchedBy: "fulltext" | "vector" }>();

        for (const row of ftRows) {
          const key = `${row.sourceType}:${row.sourceId}`;
          const existing = merged.get(key);
          if (!existing || parseScore(row.score) > parseScore(existing.row.score)) {
            merged.set(key, { row, matchedBy: "fulltext" });
          }
        }

        for (const row of vecRows) {
          const key = `${row.sourceType}:${row.sourceId}`;
          const existing = merged.get(key);
          if (!existing || parseScore(row.score) > parseScore(existing.row.score)) {
            merged.set(key, { row, matchedBy: "vector" });
          }
        }

        const sorted = [...merged.values()].sort((a, b) => {
          const scoreDiff = parseScore(b.row.score) - parseScore(a.row.score);
          if (scoreDiff !== 0) return scoreDiff;
          return new Date(b.row.updatedAt).getTime() - new Date(a.row.updatedAt).getTime();
        });

        const totalCount = sorted.length;
        const paged = sorted.slice(offset, offset + limit);

        return {
          totalCount,
          results: paged.map(({ row, matchedBy }) => toResult(row, matchedBy)),
        };
      }

      // Full-text only mode
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
            'MaxWords=80, MinWords=20, ShortWord=2, HighlightAll=true, StartSel=[[, StopSel=]]'
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
