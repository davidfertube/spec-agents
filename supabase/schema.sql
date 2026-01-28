-- Steel Agent - Supabase Schema
-- Run this in Supabase SQL Editor (left sidebar) > New query > Paste > Run

-- ============================================
-- IMPORTANT: STORAGE BUCKET SETUP (Do this first!)
-- ============================================
-- 1. Go to Supabase Dashboard > Storage (left sidebar)
-- 2. Click "New bucket"
-- 3. Name: "documents"
-- 4. Check "Public bucket" (for demo simplicity)
-- 5. Click "Create bucket"
--
-- Then run the SQL below to set up tables.

-- Create leads table
CREATE TABLE IF NOT EXISTS leads (
  id BIGSERIAL PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

-- Allow anonymous users to insert leads (for the waitlist form)
CREATE POLICY "Allow anonymous inserts" ON leads
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Allow authenticated users to read all leads (for admin)
CREATE POLICY "Allow authenticated reads" ON leads
  FOR SELECT
  TO authenticated
  USING (true);

-- ============================================
-- DOCUMENTS TABLE (for uploaded PDFs)
-- ============================================
CREATE TABLE IF NOT EXISTS documents (
  id BIGSERIAL PRIMARY KEY,
  filename TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  file_size BIGINT,
  status TEXT DEFAULT 'pending', -- pending, processing, indexed, error
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Allow anonymous users to insert documents
CREATE POLICY "Allow anonymous document inserts" ON documents
  FOR INSERT TO anon WITH CHECK (true);

-- Allow anonymous users to read documents
CREATE POLICY "Allow anonymous document reads" ON documents
  FOR SELECT TO anon USING (true);

-- Allow anonymous users to update documents (for status changes during processing)
CREATE POLICY "Allow anonymous document updates" ON documents
  FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- ============================================
-- PGVECTOR EXTENSION (for embeddings)
-- ============================================
CREATE EXTENSION IF NOT EXISTS vector;

-- Document chunks with embeddings
CREATE TABLE IF NOT EXISTS chunks (
  id BIGSERIAL PRIMARY KEY,
  document_id BIGINT REFERENCES documents(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  page_number INT,
  embedding vector(3072), -- Google gemini-embedding-001 dimension
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for vector similarity search (HNSW supports >2000 dimensions)
CREATE INDEX IF NOT EXISTS chunks_embedding_idx ON chunks
  USING hnsw (embedding vector_cosine_ops);

ALTER TABLE chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous chunk inserts" ON chunks
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Allow anonymous chunk reads" ON chunks
  FOR SELECT TO anon USING (true);

-- Function to search similar chunks
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
