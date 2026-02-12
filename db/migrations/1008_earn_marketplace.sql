-- Earn marketplace columns + transaction tables
-- Run: npm run migrate

-- Add earn marketplace columns to combined_media
ALTER TABLE combined_media ADD COLUMN IF NOT EXISTS listed_on_earn BOOLEAN DEFAULT false;
ALTER TABLE combined_media ADD COLUMN IF NOT EXISTS earn_price INTEGER DEFAULT 4;
ALTER TABLE combined_media ADD COLUMN IF NOT EXISTS artist_share INTEGER DEFAULT 2;
ALTER TABLE combined_media ADD COLUMN IF NOT EXISTS admin_share INTEGER DEFAULT 2;
ALTER TABLE combined_media ADD COLUMN IF NOT EXISTS downloads INTEGER DEFAULT 0;

-- Index for earn marketplace queries
CREATE INDEX IF NOT EXISTS idx_combined_media_listed_on_earn ON combined_media(listed_on_earn) WHERE listed_on_earn = true;
CREATE INDEX IF NOT EXISTS idx_combined_media_downloads ON combined_media(downloads DESC NULLS LAST);

-- Earn transactions table
CREATE TABLE IF NOT EXISTS earn_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  buyer_id TEXT NOT NULL,
  seller_id TEXT NOT NULL,
  admin_id TEXT NOT NULL,
  track_id UUID NOT NULL,
  total_cost INTEGER NOT NULL DEFAULT 4,
  artist_share INTEGER NOT NULL DEFAULT 2,
  admin_share INTEGER NOT NULL DEFAULT 2,
  split_stems BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_earn_transactions_buyer ON earn_transactions(buyer_id);
CREATE INDEX IF NOT EXISTS idx_earn_transactions_seller ON earn_transactions(seller_id);
CREATE INDEX IF NOT EXISTS idx_earn_transactions_track ON earn_transactions(track_id);

-- Stem split jobs table
CREATE TABLE IF NOT EXISTS earn_split_jobs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  track_id UUID NOT NULL,
  user_id TEXT NOT NULL,
  status TEXT DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'done', 'failed')),
  output_paths TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_earn_split_jobs_user ON earn_split_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_earn_split_jobs_status ON earn_split_jobs(status) WHERE status IN ('queued', 'processing');
