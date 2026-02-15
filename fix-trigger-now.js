#!/usr/bin/env node
/**
 * EMERGENCY FIX: Apply the protect_subscriber_credits trigger fix
 * 
 * The buggy trigger (from migration 1003) refills subscriber credits to 100/600/1500
 * whenever credits hit exactly 0 or 20. This gives subscribers infinite credits.
 * 
 * The fix (from migration 1016): Only protect against bulk resets where credits
 * are forcefully set to 20 from a higher value. Credits=0 passes through normally.
 */
require('dotenv').config({ path: '.env.local' })

const fixSQL = `
-- Replace the trigger function with the safe version (from migration 1016)
CREATE OR REPLACE FUNCTION public.protect_subscriber_credits()
RETURNS TRIGGER AS $$
DECLARE
  correct_credits INTEGER;
BEGIN
  -- Only protect active subscribers
  IF NEW.subscription_status = 'active' THEN
    -- Determine correct credits based on subscription plan
    IF NEW.subscription_plan LIKE '%creator%' OR 
       NEW.subscription_plan IN ('plan_S2DGVK6J270rtt', 'plan_S2DJv0bFnWoNLS') THEN
      correct_credits := 100;
    ELSIF NEW.subscription_plan LIKE '%pro%' OR 
          NEW.subscription_plan IN ('plan_S2DHUGo7n1m6iv', 'plan_S2DNEvy1YzYWNh') THEN
      correct_credits := 600;
    ELSIF NEW.subscription_plan LIKE '%studio%' OR 
          NEW.subscription_plan IN ('plan_S2DIdCKNcV6TtA', 'plan_S2DOABOeGedJHk') THEN
      correct_credits := 1500;
    ELSE
      correct_credits := 100;
    END IF;
    
    -- ONLY protect against external bulk resets that set credits to exactly 20
    -- DO NOT protect credits = 0. That is a legitimate state when a subscriber
    -- has used all their credits. They must wait for renewal or buy more.
    IF TG_OP = 'INSERT' AND NEW.credits = 20 THEN
      NEW.credits := correct_credits;
      RAISE NOTICE 'Subscriber credit protection (INSERT): Set % to % credits', 
        NEW.email, correct_credits;
    ELSIF TG_OP = 'UPDATE' AND NEW.credits = 20 AND OLD.credits > 20 THEN
      -- Something tried to reset subscriber from actual credits down to 20
      NEW.credits := correct_credits;
      RAISE NOTICE 'Subscriber credit protection (UPDATE): Restored % from 20 to % credits (was %)', 
        NEW.email, correct_credits, OLD.credits;
    END IF;
    -- All other cases (including credits = 0) pass through normally
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;

-- Recreate the trigger
DROP TRIGGER IF EXISTS ensure_subscriber_credits ON public.users;

CREATE TRIGGER ensure_subscriber_credits
  BEFORE INSERT OR UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_subscriber_credits();
`

async function run() {
  const pgConnection = process.env.PG_CONNECTION_STRING || process.env.DATABASE_URL
  if (!pgConnection) {
    console.error('ERROR: No PG_CONNECTION_STRING or DATABASE_URL found in .env.local')
    process.exit(1)
  }

  const { Client } = require('pg')
  const client = new Client({ connectionString: pgConnection })

  try {
    await client.connect()
    console.log('Connected to database')

    // First: check what version is currently live
    const { rows: procRows } = await client.query(
      "SELECT prosrc FROM pg_proc WHERE proname = 'protect_subscriber_credits'"
    )

    if (procRows.length > 0) {
      const src = procRows[0].prosrc
      const hasBug = src.includes('NEW.credits = 0')
      const hasFix = src.includes('OLD.credits > 20')
      console.log(`Current trigger: ${hasBug ? '🐛 BUGGY (refills at 0)' : hasFix ? '✅ Already fixed' : '❓ Unknown version'}`)

      if (hasFix && !hasBug) {
        console.log('Trigger already has the fix applied. No action needed.')
        await client.end()
        return
      }
    } else {
      console.log('No protect_subscriber_credits function found — will create it')
    }

    // Apply the fix
    console.log('Applying trigger fix...')
    await client.query(fixSQL)
    console.log('✅ Trigger fix applied successfully!')

    // Verify
    const { rows: verifyRows } = await client.query(
      "SELECT prosrc FROM pg_proc WHERE proname = 'protect_subscriber_credits'"
    )
    if (verifyRows.length > 0) {
      const src = verifyRows[0].prosrc
      const hasFix = src.includes('OLD.credits > 20')
      console.log(`Verification: ${hasFix ? '✅ Fix confirmed live' : '❌ Fix NOT applied (check errors)'}`)
    }

    // Now fix 101world's credits back to correct value
    // He had 20 credits before the phantom injection. The last legitimate balance was 20.
    // But the subagent accidentally ran safe_reset_free_user_credits which set him to 100.
    // Let's set him back to the correct value.
    console.log('')
    console.log('--- 101world credit correction ---')
    const { rows: userRows } = await client.query(
      "SELECT credits FROM users WHERE username = '101world'"
    )
    if (userRows.length > 0) {
      console.log(`101world current credits: ${userRows[0].credits}`)
      // Don't auto-correct — let the admin decide
      console.log('NOTE: Run manually if you want to correct: UPDATE users SET credits = 20 WHERE username = \'101world\'')
    }

    await client.end()
  } catch (err) {
    console.error('ERROR:', err.message || err)
    try { await client.end() } catch {}
    process.exit(1)
  }
}

run()
