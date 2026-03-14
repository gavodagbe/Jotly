CREATE TABLE "AssistantSearchDocument" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "sourceType" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "title" TEXT,
  "bodyText" TEXT NOT NULL,
  "metadataJson" JSONB,
  "contentHash" TEXT NOT NULL,
  "sourceUpdatedAt" TIMESTAMP(3) NOT NULL,
  "extractionStatus" TEXT,
  "extractionWarning" TEXT,
  "embeddingModel" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AssistantSearchDocument_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AssistantSearchDocument_userId_fkey"
    FOREIGN KEY ("userId")
    REFERENCES "User"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "AssistantSearchDocument_userId_sourceType_sourceId_key"
  ON "AssistantSearchDocument"("userId", "sourceType", "sourceId");

CREATE INDEX "AssistantSearchDocument_userId_sourceType_idx"
  ON "AssistantSearchDocument"("userId", "sourceType");

CREATE INDEX "AssistantSearchDocument_userId_updatedAt_idx"
  ON "AssistantSearchDocument"("userId", "updatedAt");

CREATE INDEX "AssistantSearchDocument_userId_sourceUpdatedAt_idx"
  ON "AssistantSearchDocument"("userId", "sourceUpdatedAt");

ALTER TABLE "AssistantSearchDocument"
  ADD COLUMN search_vector tsvector;

CREATE OR REPLACE FUNCTION assistant_search_document_update_search_vector()
RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    to_tsvector(
      'simple',
      concat_ws(' ', COALESCE(NEW."title", ''), COALESCE(NEW."bodyText", ''))
    );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER assistant_search_document_search_vector_trigger
BEFORE INSERT OR UPDATE OF "title", "bodyText"
ON "AssistantSearchDocument"
FOR EACH ROW
EXECUTE FUNCTION assistant_search_document_update_search_vector();

UPDATE "AssistantSearchDocument"
SET search_vector = to_tsvector('simple', concat_ws(' ', COALESCE("title", ''), COALESCE("bodyText", '')));

CREATE INDEX "AssistantSearchDocument_search_vector_idx"
  ON "AssistantSearchDocument"
  USING GIN (search_vector);

DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS vector;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'pgvector extension is not available; assistant vector search will stay disabled.';
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
    ALTER TABLE "AssistantSearchDocument"
      ADD COLUMN IF NOT EXISTS embedding vector(1536);

    EXECUTE 'CREATE INDEX IF NOT EXISTS "AssistantSearchDocument_embedding_idx" ON "AssistantSearchDocument" USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)';
  END IF;
END;
$$;
