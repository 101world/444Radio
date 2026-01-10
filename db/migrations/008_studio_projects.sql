-- Create studio_projects table for multi-track DAW projects
CREATE TABLE IF NOT EXISTS studio_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  title text NOT NULL,
  tracks jsonb NOT NULL DEFAULT '[]'::jsonb,
  tempo integer NOT NULL DEFAULT 120,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE studio_projects ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own projects
DROP POLICY IF EXISTS "Users can view own projects" ON studio_projects;
CREATE POLICY "Users can view own projects"
  ON studio_projects FOR SELECT
  USING (auth.uid()::text = user_id);

-- Policy: Users can insert their own projects
DROP POLICY IF EXISTS "Users can create own projects" ON studio_projects;
CREATE POLICY "Users can create own projects"
  ON studio_projects FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

-- Policy: Users can update their own projects
DROP POLICY IF EXISTS "Users can update own projects" ON studio_projects;
CREATE POLICY "Users can update own projects"
  ON studio_projects FOR UPDATE
  USING (auth.uid()::text = user_id);

-- Policy: Users can delete their own projects
DROP POLICY IF EXISTS "Users can delete own projects" ON studio_projects;
CREATE POLICY "Users can delete own projects"
  ON studio_projects FOR DELETE
  USING (auth.uid()::text = user_id);

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_studio_projects_updated_at ON studio_projects;

CREATE TRIGGER update_studio_projects_updated_at
  BEFORE UPDATE ON studio_projects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_studio_projects_user_id ON studio_projects(user_id);
CREATE INDEX IF NOT EXISTS idx_studio_projects_updated_at ON studio_projects(updated_at DESC);
