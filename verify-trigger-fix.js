// verify-trigger-fix.js
// Tests whether the subscriber credit refill trigger bug is fixed.
// Uses Supabase REST API with service role key.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const headers = {
  'apikey': SERVICE_ROLE_KEY,
  'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation',
};

async function readUser() {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/users?username=eq.101world&select=credits,subscription_status,subscription_plan`,
    { headers }
  );
  if (!res.ok) throw new Error(`Read failed: ${res.status} ${await res.text()}`);
  const rows = await res.json();
  if (rows.length === 0) throw new Error('User 101world not found');
  return rows[0];
}

async function updateCredits(value) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/users?username=eq.101world`,
    {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ credits: value }),
    }
  );
  if (!res.ok) throw new Error(`Update failed: ${res.status} ${await res.text()}`);
  return await res.json();
}

async function main() {
  console.log('=== Subscriber Credit Refill Trigger Verification ===\n');

  // Step 1: Read current state
  const before = await readUser();
  console.log('Step 1 — Current state:');
  console.log(`  credits: ${before.credits}`);
  console.log(`  subscription_status: ${before.subscription_status}`);
  console.log(`  subscription_plan: ${before.subscription_plan}\n`);

  // Step 2: Set credits to 0
  console.log('Step 2 — Setting credits to 0...');
  await updateCredits(0);

  // Step 3: Read back — should be 0 if trigger is fixed, 100 if buggy
  const after0 = await readUser();
  console.log(`  credits after setting to 0: ${after0.credits}`);
  if (after0.credits === 0) {
    console.log('  ✅ PASS — trigger did NOT auto-refill (correct)\n');
  } else {
    console.log(`  ❌ FAIL — trigger auto-refilled to ${after0.credits} (BUG still present)\n`);
  }

  // Step 4: Set credits to 20
  console.log('Step 4 — Setting credits to 20...');
  await updateCredits(20);

  // Step 5: Read back — should be 20 if fixed (OLD=0 is NOT > 20), 100 if buggy
  const after20 = await readUser();
  console.log(`  credits after setting to 20: ${after20.credits}`);
  if (after20.credits === 20) {
    console.log('  ✅ PASS — trigger did NOT auto-refill (correct)\n');
  } else {
    console.log(`  ❌ FAIL — trigger auto-refilled to ${after20.credits} (BUG still present)\n`);
  }

  // Step 6: Restore original credits
  console.log(`Step 6 — Restoring original credits (${before.credits})...`);
  await updateCredits(before.credits);
  const restored = await readUser();
  console.log(`  credits restored to: ${restored.credits}\n`);

  // Summary
  const test1Pass = after0.credits === 0;
  const test2Pass = after20.credits === 20;
  if (test1Pass && test2Pass) {
    console.log('🎉 ALL TESTS PASSED — Trigger bug is FIXED.');
  } else {
    console.log('⚠️  SOME TESTS FAILED — Trigger bug is still present.');
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
