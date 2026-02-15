-- Create chat_messages table for plugin chat sync
CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    clerk_user_id TEXT NOT NULL,
    message_type TEXT NOT NULL,  -- 'user' or 'assistant'
    content TEXT NOT NULL DEFAULT '',
    generation_type TEXT,        -- 'music', 'image', 'video', etc.
    generation_id TEXT,          -- links to a generation queue item
    result JSONB,               -- generation result data
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for efficient per-user queries
CREATE INDEX IF NOT EXISTS idx_chat_messages_user ON chat_messages (clerk_user_id, timestamp);
