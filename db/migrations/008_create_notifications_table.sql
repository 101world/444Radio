-- 008_create_notifications_table.sql
-- Creates a notifications table for user notifications (likes, wallet, billing, etc)

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(clerk_user_id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- e.g. 'like', 'wallet', 'billing', 'generation', etc
  data JSONB NOT NULL, -- event-specific data (e.g. { "by": "userId", "mediaId": "..." })
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
