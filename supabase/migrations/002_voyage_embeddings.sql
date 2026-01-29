-- Migration: Switch from Google (3072 dim) to Voyage AI (1024 dim) embeddings
-- Run this in Supabase SQL Editor
--
-- IMPORTANT: This will DELETE existing embeddings since dimensions are changing.
-- You'll need to re-upload documents after running this.

-- 1. Delete existing chunks (embeddings are incompatible)
TRUNCATE chunks;

-- 2. Drop the existing embedding column
ALTER TABLE chunks DROP COLUMN IF EXISTS embedding;

-- 3. Add new embedding column with 1024 dimensions (Voyage AI)
ALTER TABLE chunks ADD COLUMN embedding vector(1024);

-- 4. Drop and recreate the index for the new dimension
DROP INDEX IF EXISTS chunks_embedding_idx;
CREATE INDEX chunks_embedding_idx ON chunks
  USING hnsw (embedding vector_cosine_ops);

-- 5. Update the search function for 1024 dimensions
CREATE OR REPLACE FUNCTION search_chunks(
  query_embedding vector(1024),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id bigint,
  document_id bigint,
  content text,
  page_number int,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    chunks.id,
    chunks.document_id,
    chunks.content,
    chunks.page_number,
    1 - (chunks.embedding <=> query_embedding) AS similarity
  FROM chunks
  WHERE 1 - (chunks.embedding <=> query_embedding) > match_threshold
  ORDER BY chunks.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 6. Also delete documents (since their chunks are gone)
DELETE FROM documents;

-- Done! Now re-upload your PDFs to index with Voyage AI embeddings.
