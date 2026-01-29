-- Migration: Add Hybrid Search (BM25 + Vector)
-- Purpose: Enable exact code matching for UNS numbers, ASTM standards, etc.
-- This combines full-text search (BM25) with vector similarity for better accuracy.

-- ============================================================================
-- Step 1: Add tsvector column for efficient full-text search
-- ============================================================================

ALTER TABLE chunks ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- ============================================================================
-- Step 2: Populate search_vector from existing content
-- ============================================================================

UPDATE chunks SET search_vector = to_tsvector('english', content)
WHERE search_vector IS NULL;

-- ============================================================================
-- Step 3: Create GIN index for fast full-text search
-- ============================================================================

CREATE INDEX IF NOT EXISTS chunks_search_idx ON chunks USING GIN (search_vector);

-- ============================================================================
-- Step 4: Create trigger to auto-update search_vector on insert/update
-- ============================================================================

CREATE OR REPLACE FUNCTION chunks_search_vector_trigger() RETURNS trigger AS $$
BEGIN
  NEW.search_vector := to_tsvector('english', NEW.content);
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS chunks_search_update ON chunks;
CREATE TRIGGER chunks_search_update
  BEFORE INSERT OR UPDATE OF content ON chunks
  FOR EACH ROW EXECUTE FUNCTION chunks_search_vector_trigger();

-- ============================================================================
-- Step 5: Create hybrid search function
-- Combines BM25-style full-text search with vector similarity
-- ============================================================================

CREATE OR REPLACE FUNCTION hybrid_search_chunks(
  query_text text,
  query_embedding vector(3072),
  match_count int DEFAULT 10,
  bm25_weight float DEFAULT 0.3,
  vector_weight float DEFAULT 0.7
)
RETURNS TABLE (
  id bigint,
  document_id bigint,
  content text,
  page_number int,
  bm25_score float,
  vector_score float,
  combined_score float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH
  -- BM25-style full-text search using PostgreSQL's ts_rank_cd
  -- ts_rank_cd uses cover density ranking which works well for technical content
  bm25_results AS (
    SELECT
      c.id,
      c.document_id,
      c.content,
      c.page_number,
      ts_rank_cd(c.search_vector, plainto_tsquery('english', query_text), 32) AS score
    FROM chunks c
    WHERE c.search_vector @@ plainto_tsquery('english', query_text)
  ),
  -- Vector similarity search using cosine distance
  -- Lower threshold (0.3) to capture more candidates for fusion
  vector_results AS (
    SELECT
      c.id,
      c.document_id,
      c.content,
      c.page_number,
      (1 - (c.embedding <=> query_embedding)) AS score
    FROM chunks c
    WHERE (1 - (c.embedding <=> query_embedding)) > 0.3
  ),
  -- Combine all unique chunk IDs from both result sets
  all_chunk_ids AS (
    SELECT b.id FROM bm25_results b
    UNION
    SELECT v.id FROM vector_results v
  ),
  -- Score each chunk using weighted combination
  scored_results AS (
    SELECT
      a.id,
      c.document_id,
      c.content,
      c.page_number,
      COALESCE(b.score, 0)::float AS bm25_score,
      COALESCE(v.score, 0)::float AS vector_score,
      (
        (bm25_weight * COALESCE(b.score, 0)) +
        (vector_weight * COALESCE(v.score, 0))
      )::float AS combined_score
    FROM all_chunk_ids a
    JOIN chunks c ON c.id = a.id
    LEFT JOIN bm25_results b ON b.id = a.id
    LEFT JOIN vector_results v ON v.id = a.id
  )
  SELECT
    sr.id,
    sr.document_id,
    sr.content,
    sr.page_number,
    sr.bm25_score,
    sr.vector_score,
    sr.combined_score
  FROM scored_results sr
  WHERE sr.combined_score > 0
  ORDER BY sr.combined_score DESC
  LIMIT match_count;
END;
$$;

-- ============================================================================
-- Step 6: Create helper function for BM25-only search (useful for debugging)
-- ============================================================================

CREATE OR REPLACE FUNCTION bm25_search_chunks(
  query_text text,
  match_count int DEFAULT 10
)
RETURNS TABLE (
  id bigint,
  document_id bigint,
  content text,
  page_number int,
  score float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.document_id,
    c.content,
    c.page_number,
    ts_rank_cd(c.search_vector, plainto_tsquery('english', query_text), 32)::float AS score
  FROM chunks c
  WHERE c.search_vector @@ plainto_tsquery('english', query_text)
  ORDER BY score DESC
  LIMIT match_count;
END;
$$;

-- ============================================================================
-- Grant permissions (adjust based on your Supabase setup)
-- ============================================================================

GRANT EXECUTE ON FUNCTION hybrid_search_chunks TO anon, authenticated;
GRANT EXECUTE ON FUNCTION bm25_search_chunks TO anon, authenticated;
