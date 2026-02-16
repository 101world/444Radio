/**
 * Run Migration 123: Convert ALL Wallet to Credits
 * 
 * Removes $1 retention from convert_wallet_to_credits() function.
 * Now ALL wallet balance converts to credits immediately upon deposit.
 * $1 gate is only enforced during generation (in deduct_credits function).
 * 
 * Usage: node run-migration-123.js
 */

const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Missing SUPABASE env vars');
  process.exit(1);
}

async function runMigration() {
  const migrationPath = path.join(__dirname, 'db', 'migrations', '123_convert_all_wallet_to_credits.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');

  console.log('🚀 Running migration 123: convert_all_wallet_to_credits...');
  console.log('📄 SQL length:', sql.length, 'chars');

  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'apikey': SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  });

  if (res.ok) {
    console.log('✅ Migration 123 applied successfully!');
    console.log('');
    console.log('Changes:');
    console.log('  - convert_wallet_to_credits() now converts ALL wallet balance');
    console.log('  - No $1 retention during conversion');
    console.log('  - $1 gate only enforced during generation (deduct_credits)');
    console.log('');
    console.log('Example: Deposit $2 → 57 credits (not 28)');
    console.log('         Rate: $2 / 0.035 = 57.14 → floor = 57 credits');
  } else {
    const error = await res.text();
    console.error('❌ Migration 123 failed:', res.status, error);
    process.exit(1);
  }
}

runMigration().catch(err => {
  console.error('❌ Migration error:', err);
  process.exit(1);
});
