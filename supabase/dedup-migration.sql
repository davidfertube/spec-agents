-- ============================================
-- DEDUP MIGRATION — Delete Duplicate Documents
-- ============================================
-- Run this in Supabase SQL Editor to:
-- 1. Add DELETE policy (missing from original schema)
-- 2. Remove 46 duplicate documents and their 7,454 chunks
--
-- After dedup: 15 unique documents remain

-- Step 1: Add DELETE policy (currently missing, causing dedup script to silently fail)
CREATE POLICY "Allow anonymous document deletes" ON documents
  FOR DELETE TO anon USING (true);

CREATE POLICY "Allow anonymous chunk deletes" ON chunks
  FOR DELETE TO anon USING (true);

-- Step 2: Delete duplicate chunks (CASCADE would handle this, but be explicit)
-- Keep only the most recent copy of each unique filename
-- IDs to keep: 69, 25, 78, 77, 55, 74, 80, 82, 85, 83, 79, 84, 70, 23, 81
DELETE FROM chunks WHERE document_id NOT IN (
  23, 25, 55, 69, 70, 74, 77, 78, 79, 80, 81, 82, 83, 84, 85
);

-- Step 3: Delete duplicate document records
DELETE FROM documents WHERE id NOT IN (
  23, 25, 55, 69, 70, 74, 77, 78, 79, 80, 81, 82, 83, 84, 85
);

-- Verify: Should show 15 documents
SELECT id, filename, status FROM documents ORDER BY id;
