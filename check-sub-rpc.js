// check-sub-rpc.js — Query 101world subscription + credit functions
const { createClient } = require('@supabase/supabase-js');
const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PROJECT_REF = SUPABASE_URL.replace('https://', '').replace('.supabase.co', '');

async function main() {
  // ── 1. 101world subscription fields (via Supabase JS) ──
  console.log('=== 1. 101world subscription fields ===');
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data, error } = await supabase
    .from('users')
    .select('subscription_status, subscription_plan, subscription_id, razorpay_customer_id, updated_at')
    .eq('username', '101world')
    .single();
  if (error) console.log('Error:', error.message);
  else console.log(JSON.stringify(data, null, 2));

  // ── 2–4. Raw SQL queries via PG ──
  const attempts = [
    // New Supavisor format (transaction mode)
    { host: `${PROJECT_REF}.pooler.supabase.com`, port: 6543, user: `postgres.${PROJECT_REF}` },
    // New Supavisor format (session mode)
    { host: `${PROJECT_REF}.pooler.supabase.com`, port: 5432, user: `postgres.${PROJECT_REF}` },
    // Old pooler format (various regions)
    ...['us-east-1','us-west-1','ap-south-1','eu-west-1','ap-southeast-1'].map(r => ({
      host: `aws-0-${r}.pooler.supabase.com`, port: 6543, user: `postgres.${PROJECT_REF}`
    })),
    // Direct DB
    { host: `db.${PROJECT_REF}.supabase.co`, port: 5432, user: 'postgres' },
  ];

  let pool = null;
  for (const { host, port, user } of attempts) {
    const p = new Pool({
      host, port, database: 'postgres', user,
      password: SERVICE_KEY,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 8000,
    });
    try {
      await p.query('SELECT 1');
      console.log(`\n[Connected: ${user}@${host}:${port}]`);
      pool = p;
      break;
    } catch (e) {
      console.log(`${host}:${port} => ${e.message}`);
      await p.end().catch(() => {});
    }
  }

  if (!pool) {
    console.log('\nAll PG connections failed. Using Supabase RPC probing...');

    // 2. deduct_credits — correct params: p_clerk_user_id, p_amount
    console.log('\n=== 2. deduct_credits (RPC probe with correct params) ===');
    try {
      const { data: d2, error: e2 } = await supabase.rpc('deduct_credits', { p_clerk_user_id: '__probe__', p_amount: 0 });
      console.log('RPC result:', JSON.stringify(d2, null, 2));
      if (e2) console.log('Error:', e2.message, e2.code);
    } catch (e) { console.log('Not callable:', e.message); }

    // 3. cron — can't check without PG. Check if cron extension exists.
    console.log('\n=== 3. Scheduled / cron jobs ===');
    console.log('Cannot query cron.job without direct PG access.');
    console.log('Searching migrations for cron references...');
    console.log('  Found: 1000_fix_security_issues.sql mentions "Cron job/admin operation" in comments only.');
    console.log('  No pg_cron CREATE EXTENSION or cron.schedule() calls found in migrations.');

    // 4. Probe all known credit functions via RPC
    console.log('\n=== 4. All credit-related functions (RPC probes) ===');
    const fns = [
      { name: 'deduct_credits', params: { p_clerk_user_id: '__probe__', p_amount: 0 } },
      { name: 'deduct_generation_credit', params: { user_id: '__probe__', amount: 0 } },
      { name: 'add_signup_credits', params: { user_id: '__probe__' } },
      { name: 'protect_subscriber_credits', params: {} },
      { name: 'safe_reset_free_user_credits', params: {} },
      { name: 'replenish_credits', params: {} },
      { name: 'add_credits', params: {} },
      { name: 'reset_credits', params: {} },
      { name: 'check_credits', params: {} },
      { name: 'get_credits', params: {} },
    ];
    for (const { name, params } of fns) {
      try {
        const { data, error } = await supabase.rpc(name, params);
        if (error) {
          // "not found in schema cache" means function doesn't exist
          if (error.message.includes('not found')) {
            console.log(`  ${name}: DOES NOT EXIST`);
          } else {
            console.log(`  ${name}: EXISTS (error: ${error.message})`);
          }
        } else {
          console.log(`  ${name}: EXISTS — returned: ${JSON.stringify(data)}`);
        }
      } catch (e) { console.log(`  ${name}: exception: ${e.message}`); }
    }

    console.log('\n=== Source code from migration files (latest versions) ===');
    console.log('See db/migrations/116_fix_deduct_credits_race_condition.sql for deduct_credits');
    console.log('See db/migrations/1016_fix_subscriber_credit_refill_bug.sql for protect_subscriber_credits');
    console.log('See db/migrations/1003_permanent_subscriber_protection_CORRECT.sql for safe_reset_free_user_credits');
    console.log('\nDone (RPC fallback).');
    return;
  }

  // 2. deduct_credits source
  console.log('\n=== 2. deduct_credits function source ===');
  try {
    const { rows } = await pool.query(
      `SELECT proname, prosrc FROM pg_proc WHERE proname = 'deduct_credits'`
    );
    if (rows.length === 0) console.log('(not found)');
    rows.forEach(r => { console.log(`--- ${r.proname} ---`); console.log(r.prosrc); });
  } catch (e) { console.log('Error:', e.message); }

  // 3. cron jobs
  console.log('\n=== 3. Scheduled / cron jobs ===');
  try {
    const { rows } = await pool.query(`SELECT * FROM cron.job`);
    if (rows.length === 0) console.log('(no cron jobs)');
    rows.forEach(r => console.log(JSON.stringify(r, null, 2)));
  } catch (e) {
    console.log('cron extension not available or no access:', e.message);
  }

  // 4. All credit-related functions
  console.log('\n=== 4. All credit-related functions ===');
  try {
    const { rows } = await pool.query(
      `SELECT proname, prosrc FROM pg_proc WHERE proname ILIKE '%credit%'`
    );
    if (rows.length === 0) console.log('(none found)');
    rows.forEach(r => { console.log(`\n--- ${r.proname} ---`); console.log(r.prosrc); });
  } catch (e) { console.log('Error:', e.message); }

  await pool.end();
  console.log('\nDone.');
}

main().catch(e => console.error('Fatal:', e.message));
