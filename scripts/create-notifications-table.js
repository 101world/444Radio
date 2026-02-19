// Create notifications table by directly querying Supabase
require('dotenv').config({ path: '.env.local' });

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SB_URL || !SB_KEY) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const sql = `
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(clerk_user_id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  data JSONB NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
`;

async function createTable() {
  try {
    console.log('🔨 Creating notifications table via Supabase...\n');
    console.log('SQL to execute:');
    console.log('═'.repeat(60));
    console.log(sql);
    console.log('═'.repeat(60));
    console.log('\n📋 INSTRUCTIONS:');
    console.log('1. Go to: https://supabase.com/dashboard/project/yirjulakkgignzbrqnth/sql/new');
    console.log('2. Copy the SQL above');
    console.log('3. Paste and click "Run"');
    console.log('4. Verify success message\n');
    console.log('⚠️  Automated execution via REST API is not supported.');
    console.log('    Please run manually in Supabase SQL Editor.');
  } catch (error) {
    console.error('Error:', error.message);
  }
}

createTable();
