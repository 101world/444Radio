-- =====================================================
-- 444 RADIO: USER SESSIONS TRACKING
-- Migration: user_sessions table
-- Purpose: Track user login sessions, devices, and activity
-- =====================================================

-- Create user_sessions table
CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL, -- Clerk user ID
  session_id TEXT NOT NULL UNIQUE, -- Unique session identifier
  ip_address TEXT,
  user_agent TEXT,
  device_type TEXT, -- 'mobile', 'desktop', 'tablet', 'unknown'
  browser TEXT, -- 'Chrome', 'Safari', 'Firefox', etc.
  os TEXT, -- 'Windows', 'macOS', 'iOS', 'Android', etc.
  country TEXT, -- 'US', 'IN', etc.
  city TEXT,
  last_activity_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ -- Null if session still active
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_session_id ON user_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_created_at ON user_sessions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_sessions_last_activity ON user_sessions(last_activity_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_sessions_active ON user_sessions(user_id, ended_at) WHERE ended_at IS NULL;

-- Enable RLS
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policy (restrictive - only admin can read via service role)
DROP POLICY IF EXISTS "Only admins can view sessions" ON user_sessions;
CREATE POLICY "Only admins can view sessions" ON user_sessions
  FOR SELECT USING (false);

-- Create helper function to get active sessions count
CREATE OR REPLACE FUNCTION get_active_sessions_count(minutes INTEGER DEFAULT 5)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)
    FROM user_sessions
    WHERE ended_at IS NULL 
      AND last_activity_at > NOW() - (minutes || ' minutes')::INTERVAL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create helper function to end inactive sessions
CREATE OR REPLACE FUNCTION end_inactive_sessions(timeout_minutes INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
  ended_count INTEGER;
BEGIN
  UPDATE user_sessions
  SET ended_at = last_activity_at
  WHERE ended_at IS NULL
    AND last_activity_at < NOW() - (timeout_minutes || ' minutes')::INTERVAL;
  
  GET DIAGNOSTICS ended_count = ROW_COUNT;
  RETURN ended_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create helper function to update session activity
CREATE OR REPLACE FUNCTION update_session_activity(p_session_id TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE user_sessions
  SET last_activity_at = NOW()
  WHERE session_id = p_session_id AND ended_at IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add helpful comments
COMMENT ON TABLE user_sessions IS 'Tracks user login sessions with device, location, and activity data';
COMMENT ON COLUMN user_sessions.session_id IS 'Unique session identifier (can be Clerk session ID or custom UUID)';
COMMENT ON COLUMN user_sessions.device_type IS 'Device category: mobile, desktop, tablet, or unknown';
COMMENT ON COLUMN user_sessions.last_activity_at IS 'Last activity timestamp - updated on each request';
COMMENT ON COLUMN user_sessions.ended_at IS 'Session end timestamp - NULL for active sessions';

-- Add column to users table for quick "last active" lookup
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'last_active_at'
  ) THEN
    ALTER TABLE users ADD COLUMN last_active_at TIMESTAMPTZ DEFAULT NOW();
    CREATE INDEX idx_users_last_active ON users(last_active_at DESC);
    COMMENT ON COLUMN users.last_active_at IS 'Last activity timestamp (denormalized from user_sessions for quick queries)';
  END IF;
END $$;

-- Create trigger to update users.last_active_at when session activity updates
CREATE OR REPLACE FUNCTION sync_user_last_active()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE users
  SET last_active_at = NEW.last_activity_at
  WHERE clerk_user_id = NEW.user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_sync_user_last_active ON user_sessions;
CREATE TRIGGER trigger_sync_user_last_active
  AFTER INSERT OR UPDATE OF last_activity_at ON user_sessions
  FOR EACH ROW
  EXECUTE FUNCTION sync_user_last_active();

-- Test queries examples
-- Get active sessions:
-- SELECT * FROM user_sessions WHERE ended_at IS NULL ORDER BY last_activity_at DESC;

-- Get user's session history:
-- SELECT * FROM user_sessions WHERE user_id = 'user_xxx' ORDER BY created_at DESC;

-- Get most active users by session count:
-- SELECT user_id, COUNT(*) as session_count FROM user_sessions GROUP BY user_id ORDER BY session_count DESC LIMIT 10;

-- Get device distribution:
-- SELECT device_type, COUNT(*) as count FROM user_sessions GROUP BY device_type;

-- Get browser distribution:
-- SELECT browser, COUNT(*) as count FROM user_sessions GROUP BY browser ORDER BY count DESC;

-- End inactive sessions (run periodically):
-- SELECT end_inactive_sessions(30); -- End sessions inactive for 30+ minutes
