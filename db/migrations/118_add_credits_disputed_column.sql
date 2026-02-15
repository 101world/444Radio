-- ============================================================================
-- ADD credits_disputed COLUMN
-- Used by dispute webhook handlers to flag users with active payment disputes.
-- Date: 2026-02-16
-- ============================================================================

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS credits_disputed BOOLEAN DEFAULT false;

-- Index for quick admin queries on disputed users
CREATE INDEX IF NOT EXISTS idx_users_credits_disputed
ON public.users(credits_disputed) WHERE credits_disputed = true;

-- ============================================================================
-- END
-- ============================================================================
