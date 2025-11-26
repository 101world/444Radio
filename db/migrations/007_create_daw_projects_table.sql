-- Create table for storing DAW projects
CREATE TABLE IF NOT EXISTS daw_projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  bpm INTEGER NOT NULL DEFAULT 120,
  tracks JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_daw_projects_user_id ON daw_projects(user_id);
CREATE INDEX IF NOT EXISTS idx_daw_projects_updated_at ON daw_projects(updated_at DESC);

-- Add RLS policies
ALTER TABLE daw_projects ENABLE ROW LEVEL SECURITY;

-- Users can only see their own projects
CREATE POLICY "Users can view own projects" ON daw_projects
  FOR SELECT USING (auth.uid()::text = user_id);

-- Users can insert their own projects
CREATE POLICY "Users can create own projects" ON daw_projects
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);

-- Users can update their own projects
CREATE POLICY "Users can update own projects" ON daw_projects
  FOR UPDATE USING (auth.uid()::text = user_id);

-- Users can delete their own projects
CREATE POLICY "Users can delete own projects" ON daw_projects
  FOR DELETE USING (auth.uid()::text = user_id);
