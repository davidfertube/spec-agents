-- Migration: Update embedding dimension from 768 to 3072
-- Run this in Supabase SQL Editor

-- Step 1: Drop the existing index (it's on the wrong dimension)
DROP INDEX IF EXISTS chunks_embedding_idx;

-- Step 2: Drop existing chunks (they have wrong dimensions anyway)
TRUNCATE TABLE chunks;

-- Step 3: Alter the column to new dimension
ALTER TABLE chunks
  ALTER COLUMN embedding TYPE vector(3072);

-- Step 4: Recreate the index using HNSW (supports >2000 dimensions, ivfflat doesn't)
CREATE INDEX chunks_embedding_idx ON chunks
  USING hnsw (embedding vector_cosine_ops);

-- Step 5: Update the search function
CREATE OR REPLACE FUNCTION search_chunks(
  query_embedding vector(3072),
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

-- Step 6: Reset document status so they can be reprocessed
UPDATE documents SET status = 'pending' WHERE status IN ('processing', 'error', 'indexed');

-- Done! Now re-upload and process your PDFs.
SELECT 'Migration complete! Vector dimension updated from 768 to 3072.' AS status;
