// check-trigger2.js — Follow-up queries with correct column names
const SUPABASE_URL = "https://yirjulakkgignzbrqnth.supabase.co";
const SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlpcmp1bGFra2dpZ256YnJxbnRoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTkxOTk2MSwiZXhwIjoyMDc1NDk1OTYxfQ.Do8wKOZd1fswfo32D3Vi7kfN4EVKIXnMQ6iUehnA8oM";
const headers = {
  'apikey': SERVICE_KEY,
  'Authorization': `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation'
};

async function main() {
  // ─── 1. 101world's credits with correct columns ───
  console.log("--- 1. 101world user data (correct columns) ---");
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/users?or=(username.eq.101world,username.eq.101World,username.ilike.*101*)&select=clerk_user_id,username,credits,total_generated,subscription_status,subscription_plan,subscription_id,subscription_start,subscription_end`, {
      headers
    });
    const data = await res.json();
    console.log(`Found ${data.length} matching users:`);
    data.forEach(u => console.log(JSON.stringify(u, null, 2)));
  } catch (e) { console.log(`Error: ${e.message}`); }

  // ─── 2. ALL users with active subscription ───
  console.log("\n--- 2. All users with subscription_status = 'active' ---");
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/users?subscription_status=eq.active&select=clerk_user_id,username,credits,subscription_status,subscription_plan,subscription_id`, {
      headers
    });
    const data = await res.json();
    console.log(`Found ${data.length} active subscribers:`);
    data.forEach(u => console.log(`  ${u.username || '(none)'} | credits: ${u.credits} | plan: ${u.subscription_plan} | sub_id: ${u.subscription_id}`));
  } catch (e) { console.log(`Error: ${e.message}`); }

  // ─── 3. All users with any subscription_id (even non-active) ───
  console.log("\n--- 3. Users with any subscription_id set ---");
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/users?subscription_id=not.is.null&select=clerk_user_id,username,credits,subscription_status,subscription_plan,subscription_id`, {
      headers
    });
    const data = await res.json();
    console.log(`Found ${data.length} users with subscription_id:`);
    data.forEach(u => console.log(`  ${u.username || '(none)'} | credits: ${u.credits} | status: ${u.subscription_status} | plan: ${u.subscription_plan}`));
  } catch (e) { console.log(`Error: ${e.message}`); }

  // ─── 4. Try calling safe_reset_free_user_credits (DRY RUN — just to see what it returns) ───
  // DON'T run this — it actually resets credits. Instead, just confirm it exists.
  console.log("\n--- 4. Confirming safe_reset_free_user_credits exists (info only, NOT calling it) ---");
  console.log("  Confirmed via RPC hint in test 1 of previous script: function exists in schema cache");

  // ─── 5. Check if there's a way to read the trigger definition ───
  // Try querying pg_triggers or information_schema via an RPC if one exists
  console.log("\n--- 5. Probing for get_trigger_info or introspection RPCs ---");
  for (const fn of ['get_trigger_info', 'get_function_source', 'pg_get_functiondef', 'list_triggers', 'introspect']) {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
        method: 'POST', headers, body: JSON.stringify({})
      });
      const status = res.status;
      if (status !== 404) {
        console.log(`  ${fn}: Status ${status} — ${(await res.text()).substring(0, 200)}`);
      }
    } catch (e) {}
  }
  console.log("  (Only non-404 results shown)");

  // ─── 6. Check which migration files exist locally from 1001 to 1020 ───
  console.log("\n--- 6. Local migration files (1001-1020) ---");
  const fs = require('fs');
  const path = require('path');
  const migDir = path.join(__dirname, 'db', 'migrations');
  try {
    const files = fs.readdirSync(migDir).filter(f => f.match(/^10[0-2]\d/)).sort();
    files.forEach(f => {
      const stat = fs.statSync(path.join(migDir, f));
      console.log(`  ${f} (${stat.size} bytes, modified ${stat.mtime.toISOString().slice(0,16)})`);
    });
  } catch (e) { console.log(`Error: ${e.message}`); }

  // ─── 7. Check the 1016 fix content specifically — what SHOULD be live ───
  console.log("\n--- 7. The 1016 fix — key logic (what SHOULD be the live trigger) ---");
  try {
    const content = fs.readFileSync(path.join(migDir, '1016_fix_subscriber_credit_refill_bug.sql'), 'utf8');
    // Extract the core IF block
    const lines = content.split('\n');
    let inFunction = false;
    lines.forEach((line, i) => {
      if (line.includes('BEGIN') && !inFunction) inFunction = true;
      if (inFunction) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('--')) {
          console.log(`  L${i+1}: ${trimmed}`);
        }
      }
      if (line.includes('$$ LANGUAGE') && inFunction) inFunction = false;
    });
  } catch (e) { console.log(`Error: ${e.message}`); }

  // ─── 8. Key question: Was 1016 ever applied? Check git log ───
  console.log("\n--- 8. Summary of findings ---");
  console.log(`
FINDINGS:
=========

1. USERS TABLE SCHEMA: The 'users' table does NOT have 'is_subscriber' or 
   'subscription_tier' columns. It HAS: subscription_status, subscription_plan, 
   subscription_id, subscription_start, subscription_end.

2. TRIGGER EXISTS: protect_subscriber_credits function exists in the DB 
   (confirmed by RPC 404 error saying "Searched for the function 
   public.protect_subscriber_credits without parameters").

3. MIGRATION TRACKING: NO migration log/tracking tables exist in the public 
   schema (migration_log, schema_migrations, etc. all returned 404).
   This means there's NO way to confirm which migrations have been applied
   just from the REST API.

4. CANNOT READ FUNCTION BODY: pg_proc, information_schema.routines, and 
   information_schema.triggers are NOT exposed via PostgREST. We cannot 
   read the actual function body via the REST API.

5. The critical question is whether the LIVE function has:
   - 1003 bug: "IF NEW.credits = 20 OR NEW.credits = 0 THEN" (refills at 0)
   - 1016 fix: "IF TG_OP = 'UPDATE' AND NEW.credits = 20 AND OLD.credits > 20"
     (only protects against bulk resets, allows credits = 0)

6. TO DEFINITIVELY CHECK: You need to either:
   a) Run the SQL directly in Supabase Dashboard SQL Editor:
      SELECT prosrc FROM pg_proc WHERE proname = 'protect_subscriber_credits';
   b) OR create an RPC function that returns the function source
   c) OR test empirically: try to deduct a subscriber's credits to 0 and see 
      if they bounce back
`);
}

main().catch(console.error);
