-- Track who bought what from Earn marketplace
-- Prevents re-listing / re-releasing purchased tracks

-- Add buyer tracking columns to earn_transactions (if missing)
ALTER TABLE earn_transactions ADD COLUMN IF NOT EXISTS buyer_username TEXT;
ALTER TABLE earn_transactions ADD COLUMN IF NOT EXISTS seller_username TEXT;
ALTER TABLE earn_transactions ADD COLUMN IF NOT EXISTS track_title TEXT;
ALTER TABLE earn_transactions ADD COLUMN IF NOT EXISTS transaction_type TEXT DEFAULT 'purchase'
  CHECK (transaction_type IN ('purchase', 'listing', 'stem_split'));

-- Track which users have purchased which tracks (for re-release prevention)
CREATE TABLE IF NOT EXISTS earn_purchases (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  buyer_id TEXT NOT NULL,
  seller_id TEXT NOT NULL,
  track_id UUID NOT NULL,
  track_title TEXT,
  amount_paid INTEGER NOT NULL DEFAULT 5,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(buyer_id, track_id)  -- One purchase per buyer per track
);

ALTER TABLE earn_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on earn_purchases"
  ON earn_purchases FOR ALL
  USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_earn_purchases_buyer ON earn_purchases(buyer_id);
CREATE INDEX IF NOT EXISTS idx_earn_purchases_seller ON earn_purchases(seller_id);
CREATE INDEX IF NOT EXISTS idx_earn_purchases_track ON earn_purchases(track_id);

-- Add purchased_from_earn flag to combined_media to mark tracks that came from earn
ALTER TABLE combined_media ADD COLUMN IF NOT EXISTS purchased_from_earn BOOLEAN DEFAULT false;
ALTER TABLE combined_media ADD COLUMN IF NOT EXISTS original_track_id UUID;
