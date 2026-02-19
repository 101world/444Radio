-- =====================================================
-- 444 RADIO: ACTIVITY LOGGING SYSTEM
-- Migration: activity_logs table
-- Purpose: Track ALL user actions for analytics and auditing
-- =====================================================

-- Create activity_logs table
CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL, -- Clerk user ID
  action_type TEXT NOT NULL, -- 'login', 'play', 'like', 'follow', 'generate', 'upload', 'search', 'profile_view', 'share'
  resource_type TEXT, -- 'media', 'user', 'credit', 'profile', 'playlist', 'comment'
  resource_id TEXT, -- ID of the resource being acted upon
  metadata JSONB DEFAULT '{}', -- Flexible additional data
  ip_address TEXT,
  user_agent TEXT,
  session_id TEXT, -- To group actions by session
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action_type ON activity_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_activity_logs_session_id ON activity_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_created ON activity_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action_created ON activity_logs(action_type, created_at DESC);

-- Create composite index for common queries
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_action_created 
  ON activity_logs(user_id, action_type, created_at DESC);

-- Enable RLS (optional - admin uses service role)
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies (restrictive - only admin can read via service role)
DROP POLICY IF EXISTS "Only admins can view activity logs" ON activity_logs;
CREATE POLICY "Only admins can view activity logs" ON activity_logs
  FOR SELECT USING (false); -- Blocks all non-service-role access

-- Create helper function to get active users count
CREATE OR REPLACE FUNCTION get_active_users_count(minutes INTEGER DEFAULT 5)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(DISTINCT user_id)
    FROM activity_logs
    WHERE created_at > NOW() - (minutes || ' minutes')::INTERVAL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create helper function to get user last activity
CREATE OR REPLACE FUNCTION get_user_last_activity(p_user_id TEXT)
RETURNS TIMESTAMPTZ AS $$
BEGIN
  RETURN (
    SELECT MAX(created_at)
    FROM activity_logs
    WHERE user_id = p_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add helpful comments
COMMENT ON TABLE activity_logs IS 'Centralized activity tracking for all user actions (plays, likes, follows, generations, etc.)';
COMMENT ON COLUMN activity_logs.action_type IS 'Type of action: login, play, like, follow, generate, upload, search, profile_view, share, etc.';
COMMENT ON COLUMN activity_logs.resource_type IS 'Type of resource: media, user, credit, profile, playlist, comment';
COMMENT ON COLUMN activity_logs.resource_id IS 'ID of the resource (e.g., media UUID, user clerk_id)';
COMMENT ON COLUMN activity_logs.metadata IS 'Flexible JSONB field for action-specific data (e.g., play duration, search query, generation params)';
COMMENT ON COLUMN activity_logs.session_id IS 'Session identifier to group related actions';

-- Test query examples
-- Find active users in last 5 minutes:
-- SELECT COUNT(DISTINCT user_id) FROM activity_logs WHERE created_at > NOW() - INTERVAL '5 minutes';

-- Get user's recent activity:
-- SELECT * FROM activity_logs WHERE user_id = 'user_xxx' ORDER BY created_at DESC LIMIT 20;

-- Get most played tracks today:
-- SELECT resource_id, COUNT(*) as play_count 
-- FROM activity_logs 
-- WHERE action_type = 'play' AND created_at > CURRENT_DATE 
-- GROUP BY resource_id ORDER BY play_count DESC LIMIT 10;

-- Get most active users this week:
-- SELECT user_id, COUNT(*) as action_count 
-- FROM activity_logs 
-- WHERE created_at > NOW() - INTERVAL '7 days'
-- GROUP BY user_id ORDER BY action_count DESC LIMIT 20;
