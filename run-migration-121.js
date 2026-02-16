// Run migration 121 via Supabase REST API (since direct PG connection is unavailable)
require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function main() {
  // Step 1: Drop old constraint and recreate with wallet types
  // We can't run raw SQL via REST, but we CAN test by inserting
  // We need to use the Supabase SQL editor or a different approach
  
  // Actually, let's use the supabase management API to run SQL
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\./)?.[1]
  
  console.log('Project ref:', projectRef)
  console.log('Note: Cannot run DDL via REST API.')
  console.log('')
  console.log('Please run this SQL in your Supabase SQL Editor:')
  console.log('================================================')
  console.log(`
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'credit_transactions'
      AND constraint_type = 'CHECK'
      AND constraint_name = 'credit_transactions_type_check'
  ) THEN
    ALTER TABLE credit_transactions DROP CONSTRAINT credit_transactions_type_check;
  END IF;

  ALTER TABLE credit_transactions ADD CONSTRAINT credit_transactions_type_check
    CHECK (type IN (
      'generation_music',
      'generation_effects',
      'generation_loops',
      'generation_image',
      'generation_video_to_audio',
      'generation_cover_art',
      'generation_stem_split',
      'generation_audio_boost',
      'generation_extract',
      'earn_list',
      'earn_purchase',
      'earn_sale',
      'earn_admin',
      'credit_award',
      'credit_refund',
      'wallet_deposit',
      'wallet_conversion',
      'subscription_bonus',
      'plugin_purchase',
      'code_claim',
      'release',
      'other'
    ));
END $$;
`)
  console.log('================================================')
  console.log('')
  
  // Step 2: Also output the credit correction for user riri
  // User riri: clerk_user_id = user_34LKhAX7aYSnMboQLn5S8vVbzoQ
  // Current: 159 credits, $1 wallet
  // They bought $2. With $1 kept in wallet, correct conversion = FLOOR(($2-$1)/0.035) = 28 credits
  // They had 20 credits before. So correct total = 20 + 28 = 48
  // They used some credits since (generation_music -2, generation_audio_boost -1 = -3 used)
  // So correct current = 48 - 3 = 45
  // Actual current = 159
  // Excess = 159 - 45 = 114
  //
  // BUT WAIT — let me verify: if the user already had $0 wallet before deposit,
  // then $2 deposit → wallet=$2 → convert(all available above $1) → $1 converts → 28 credits
  // Remaining wallet = $1. This matches current state (wallet=$1).
  //
  // Triple deposit scenario:
  // 1. verify route: deposit $2 → wallet=$2, convert $1 → 28 credits, wallet=$1
  // 2. payment.captured: deposit $2 AGAIN → wallet=$3, convert $2 → 57 credits, wallet=$1  
  // 3. order.paid: deposit $2 AGAIN → wallet=$3, convert $2 → 57 credits, wallet=$1
  // Total: 28 + 57 + 57 = 142 credits... close to 147 but not exact.
  //
  // Or maybe verify deposited but conversion partially failed, then webhook deposited again:
  // Actually the RPC log failed silently, so the route-level logCreditTransaction also
  // used 'wallet_deposit' type which ALSO failed the constraint!
  // So NO transaction logs exist → ALL idempotency checks return "not processed" → ALL paths fire.
  
  // Let's just compute from known facts:
  // User said: had 20 credits, bought $2, ended up with 167 total (147 new)
  // Used 3 credits since (music -2, audio_boost -1) → now at 159 + 5 (double clawback from wrong user?) 
  // Wait, the clawback was on user_34StnaXDJ3yZTYmz1Wmv3sYcqcB not this user.
  
  // Simple: correct new credits from $2 deposit = 28 (after keeping $1)
  // User should have: 20 (original) + 28 (from purchase) - 3 (used) = 45
  // User has: 159
  // Excess: 159 - 45 = 114
  
  console.log('CREDIT CORRECTION for user riri:')
  console.log('================================')
  console.log(`
-- Correct riri's credits (user_34LKhAX7aYSnMboQLn5S8vVbzoQ)
-- Had 20 credits, bought $2, correct conversion = 28 credits ($1 of $2 converts, $1 stays)
-- Used 3 credits since purchase (music -2, audio_boost -1)
-- Correct balance = 20 + 28 - 3 = 45
-- Current balance = 159
-- Excess = 114

UPDATE users
SET credits = 45,
    updated_at = NOW()
WHERE clerk_user_id = 'user_34LKhAX7aYSnMboQLn5S8vVbzoQ';

INSERT INTO credit_transactions (user_id, amount, balance_after, type, status, description, metadata)
VALUES (
  'user_34LKhAX7aYSnMboQLn5S8vVbzoQ',
  -114,
  45,
  'credit_refund',
  'success',
  'Correction: triple-deposit bug — removed 114 excess credits',
  '{"reason": "check_constraint_blocked_wallet_deposit_type_breaking_idempotency", "bug_fix": true, "original_purchase_usd": 2, "correct_credits_from_purchase": 28}'::jsonb
);
`)
}

main().catch(console.error)
