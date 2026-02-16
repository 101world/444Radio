/**
 * Run Migration 122: Plugin Free for All
 * 
 * Replaces validate_plugin_token DB function to allow all authenticated users
 * regardless of subscription or purchase status.
 * 
 * Usage: node run-migration-122.js
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
  const migrationPath = path.join(__dirname, 'db', 'migrations', '122_plugin_free_for_all.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');

  console.log('🚀 Running migration 122: plugin_free_for_all...');
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
    console.log('✅ Migration 122 applied successfully!');
    console.log('');
    console.log('Plugin is now free for all authenticated users:');
    console.log('  - Studio tier: unlimited (0 daily limit)');
    console.log('  - Pro tier: 2000/day');
    console.log('  - Free tier: 2000/day (new!)');
    console.log('  - Purchased tier: 2000/day (legacy one-time purchase)');
  } else {
    const error = await res.text();
    console.error('❌ Migration 122 failed:', res.status, error);
    process.exit(1);
  }
}

runMigration().catch(err => {
  console.error('❌ Migration error:', err);
  process.exit(1);
});
