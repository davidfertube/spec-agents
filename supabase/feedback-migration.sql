-- ============================================
-- FEEDBACK TABLE — User/Coworker Issue Flagging
-- ============================================
-- Run this in Supabase SQL Editor to add the feedback table.
-- This enables the feedback loop where users flag incorrect answers,
-- and the diagnostic script identifies root causes for fixing.

CREATE TABLE IF NOT EXISTS feedback (
  id BIGSERIAL PRIMARY KEY,
  -- Query context
  query TEXT NOT NULL,
  response TEXT NOT NULL,
  sources JSONB DEFAULT '[]'::jsonb,
  confidence JSONB DEFAULT '{}'::jsonb,
  -- Feedback data
  rating TEXT NOT NULL CHECK (rating IN ('correct', 'incorrect', 'partial')),
  issue_type TEXT CHECK (issue_type IN (
    'false_refusal',    -- model refused but answer was in the docs
    'wrong_data',       -- response had incorrect numbers/facts
    'missing_info',     -- answer was incomplete
    'wrong_source',     -- cited wrong document or page
    'hallucination',    -- made up information not in source docs
    'other'             -- free-text explanation
  )),
  comment TEXT,          -- optional free-text from user
  -- Metadata
  flagged_by TEXT,       -- user name or identifier
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- Allow anonymous users to insert feedback (demo mode)
CREATE POLICY "Allow anonymous feedback inserts" ON feedback
  FOR INSERT TO anon WITH CHECK (true);

-- Allow anonymous users to read feedback (for diagnostic script)
CREATE POLICY "Allow anonymous feedback reads" ON feedback
  FOR SELECT TO anon USING (true);

-- Index for querying recent feedback
CREATE INDEX IF NOT EXISTS feedback_created_at_idx ON feedback (created_at DESC);
CREATE INDEX IF NOT EXISTS feedback_rating_idx ON feedback (rating);
CREATE INDEX IF NOT EXISTS feedback_issue_type_idx ON feedback (issue_type);
