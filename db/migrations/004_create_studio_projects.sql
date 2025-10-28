-- 004_create_studio_projects.sql
-- Per-user project storage for Studio integrations (e.g., OpenDAW JSON blobs)

CREATE TABLE IF NOT EXISTS studio_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_studio_projects_user ON studio_projects (clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_studio_projects_updated ON studio_projects (updated_at DESC);

-- Optional: trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_studio_projects_updated ON studio_projects;
CREATE TRIGGER trg_studio_projects_updated
BEFORE UPDATE ON studio_projects
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
