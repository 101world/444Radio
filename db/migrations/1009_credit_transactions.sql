-- Credit transactions ledger — tracks every credit event
-- Run: npm run migrate

CREATE TABLE IF NOT EXISTS credit_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  amount INTEGER NOT NULL,                    -- positive = earned, negative = spent
  balance_after INTEGER,                      -- credits remaining after this transaction
  type TEXT NOT NULL CHECK (type IN (
    'generation_music',
    'generation_effects',
    'generation_loops',
    'generation_image',
    'generation_video_to_audio',
    'generation_cover_art',
    'generation_stem_split',
    'earn_list',           -- listing fee on earn marketplace
    'earn_purchase',       -- buying a track
    'earn_sale',           -- artist revenue from a sale
    'earn_admin',          -- admin share from a sale/listing
    'credit_award',        -- awarded via decrypt puzzle or admin
    'credit_refund',       -- manual refund
    'subscription_bonus',  -- bonus credits from subscription
    'other'
  )),
  status TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'failed', 'pending')),
  description TEXT,                           -- human-readable description
  metadata JSONB DEFAULT '{}',                -- extra data (track title, model, error, etc.)
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'credit_transactions'
      AND policyname = 'Service role full access on credit_transactions'
  ) THEN
    CREATE POLICY "Service role full access on credit_transactions"
      ON credit_transactions FOR ALL
      USING (auth.role() = 'service_role');
  END IF;
END $$;

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user ON credit_transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_type ON credit_transactions(type);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_status ON credit_transactions(status) WHERE status != 'success';
