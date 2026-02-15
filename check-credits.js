const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://yirjulakkgignzbrqnth.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlpcmp1bGFra2dpZ256YnJxbnRoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTkxOTk2MSwiZXhwIjoyMDc1NDk1OTYxfQ.Do8wKOZd1fswfo32D3Vi7kfN4EVKIXnMQ6iUehnA8oM';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  console.log('=== Checking 101world user credits ===\n');

  // 1. Find users matching 101world
  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('clerk_user_id, username, credits, total_generated')
    .or("username.eq.101world,username.ilike.%101%");

  if (usersError) {
    console.error('Error fetching users:', usersError.message);
    return;
  }

  if (!users || users.length === 0) {
    console.log('No users found matching "101world" or "%101%"');
    return;
  }

  console.log(`Found ${users.length} user(s):\n`);
  console.table(users);

  for (const user of users) {
    const uid = user.clerk_user_id;
    console.log(`\n--- Code Redemptions for ${user.username} (${uid}) ---`);

    // 2. code_redemptions
    const { data: redemptions, error: redError } = await supabase
      .from('code_redemptions')
      .select('*')
      .eq('clerk_user_id', uid);

    if (redError) {
      console.log('  Error or table missing:', redError.message);
    } else if (!redemptions || redemptions.length === 0) {
      console.log('  No code redemptions found.');
    } else {
      console.table(redemptions);
    }

    console.log(`\n--- Credit Transactions for ${user.username} (${uid}) ---`);

    // 3. credit_transactions
    const { data: txns, error: txnError } = await supabase
      .from('credit_transactions')
      .select('id, amount, balance_after, type, description, created_at')
      .eq('user_id', uid)
      .order('created_at', { ascending: false })
      .limit(20);

    if (txnError) {
      console.log('  Error or table missing:', txnError.message);
    } else if (!txns || txns.length === 0) {
      console.log('  No credit transactions found.');
    } else {
      console.table(txns);
    }
  }

  console.log('\n=== Done ===');
}

main().catch(console.error);
