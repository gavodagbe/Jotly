-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column (1536 dimensions for text-embedding-3-small)
ALTER TABLE "AssistantSearchDocument" ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- HNSW index for fast approximate nearest-neighbour search (cosine distance)
CREATE INDEX IF NOT EXISTS "AssistantSearchDocument_embedding_hnsw_idx"
  ON "AssistantSearchDocument"
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
