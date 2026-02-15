// check-trigger.js — Investigate protect_subscriber_credits trigger state
const SUPABASE_URL = "https://yirjulakkgignzbrqnth.supabase.co";
const SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlpcmp1bGFra2dpZ256YnJxbnRoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTkxOTk2MSwiZXhwIjoyMDc1NDk1OTYxfQ.Do8wKOZd1fswfo32D3Vi7kfN4EVKIXnMQ6iUehnA8oM";

const headers = {
  'apikey': SERVICE_KEY,
  'Authorization': `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation'
};

async function query(sql) {
  // Use the Supabase RPC endpoint to run raw SQL via a helper
  // Supabase doesn't have a direct raw SQL REST endpoint, but we can use the
  // pg_catalog views via PostgREST if they're exposed, or use rpc.
  // Let's try calling the SQL via the management API or a workaround.
  
  // Actually, we can query system catalog views if they're in the API schema.
  // But they usually aren't. Let's try a different approach.
  return null;
}

async function main() {
  console.log("=== TRIGGER INVESTIGATION SCRIPT ===\n");

  // ─── 1. Try calling protect_subscriber_credits as RPC ───
  console.log("--- 1. Calling RPC protect_subscriber_credits (expect error, but error reveals info) ---");
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/protect_subscriber_credits`, {
      method: 'POST',
      headers,
      body: JSON.stringify({})
    });
    const body = await res.text();
    console.log(`Status: ${res.status}`);
    console.log(`Response: ${body}`);
  } catch (e) {
    console.log(`Error: ${e.message}`);
  }

  // ─── 2. Check migration_log table ───
  console.log("\n--- 2. Checking migration_log table ---");
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/migration_log?order=applied_at.desc&limit=20`, {
      headers
    });
    const body = await res.text();
    console.log(`Status: ${res.status}`);
    if (res.ok) {
      const data = JSON.parse(body);
      if (data.length === 0) {
        console.log("migration_log table exists but is EMPTY");
      } else {
        console.log(`Found ${data.length} entries:`);
        data.forEach(row => {
          console.log(`  - ${row.migration_name || row.name || JSON.stringify(row)}`);
        });
      }
    } else {
      console.log(`Response: ${body}`);
    }
  } catch (e) {
    console.log(`Error: ${e.message}`);
  }

  // ─── 3. Check schema_migrations table ───
  console.log("\n--- 3. Checking schema_migrations table ---");
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/schema_migrations?order=id.desc&limit=20`, {
      headers
    });
    const body = await res.text();
    console.log(`Status: ${res.status}`);
    if (res.ok) {
      const data = JSON.parse(body);
      console.log(`Found ${data.length} entries:`);
      data.forEach(row => console.log(`  - ${JSON.stringify(row)}`));
    } else {
      console.log(`Response: ${body}`);
    }
  } catch (e) {
    console.log(`Error: ${e.message}`);
  }

  // ─── 4. Check 101world's current credits (read-only) ───
  console.log("\n--- 4. Checking 101world's current credits (READ ONLY) ---");
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/users?or=(username.eq.101world,username.eq.101World)&select=clerk_user_id,username,credits,total_generated,is_subscriber,subscription_tier,subscription_status`, {
      headers
    });
    const body = await res.text();
    console.log(`Status: ${res.status}`);
    if (res.ok) {
      const data = JSON.parse(body);
      if (data.length === 0) {
        console.log("No user found with username '101world'");
        // Try broader search
        const res2 = await fetch(`${SUPABASE_URL}/rest/v1/users?username=ilike.*101*&select=clerk_user_id,username,credits,total_generated,is_subscriber,subscription_tier,subscription_status`, {
          headers
        });
        const data2 = await res2.json();
        console.log("Broader search (*101*): ", JSON.stringify(data2, null, 2));
      } else {
        data.forEach(u => {
          console.log(`  Username: ${u.username}`);
          console.log(`  Clerk ID: ${u.clerk_user_id}`);
          console.log(`  Credits: ${u.credits}`);
          console.log(`  Total Generated: ${u.total_generated}`);
          console.log(`  Is Subscriber: ${u.is_subscriber}`);
          console.log(`  Subscription Tier: ${u.subscription_tier}`);
          console.log(`  Subscription Status: ${u.subscription_status}`);
        });
      }
    } else {
      console.log(`Response: ${body}`);
    }
  } catch (e) {
    console.log(`Error: ${e.message}`);
  }

  // ─── 5. List all subscribers ───
  console.log("\n--- 5. All subscribers (is_subscriber=true) ---");
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/users?is_subscriber=eq.true&select=clerk_user_id,username,credits,total_generated,subscription_tier,subscription_status`, {
      headers
    });
    if (res.ok) {
      const data = await res.json();
      console.log(`Found ${data.length} subscribers:`);
      data.forEach(u => {
        console.log(`  ${u.username || '(no username)'} — credits: ${u.credits}, tier: ${u.subscription_tier}, status: ${u.subscription_status}`);
      });
    } else {
      console.log(`Status: ${res.status}, Body: ${await res.text()}`);
    }
  } catch (e) {
    console.log(`Error: ${e.message}`);
  }

  // ─── 6. Try to get trigger/function info via information_schema ───
  console.log("\n--- 6. Checking information_schema.triggers (if exposed) ---");
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/information_schema.triggers?trigger_name=eq.protect_subscriber_credits_trigger`, {
      headers
    });
    console.log(`Status: ${res.status}`);
    console.log(`Response: ${await res.text()}`);
  } catch (e) {
    console.log(`Error: ${e.message}`);
  }

  // ─── 7. Try querying pg_proc via PostgREST (unlikely to work but worth trying) ───
  console.log("\n--- 7. Attempting pg_proc query via PostgREST ---");
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/pg_proc?proname=eq.protect_subscriber_credits&select=proname,prosrc`, {
      headers
    });
    console.log(`Status: ${res.status}`);
    console.log(`Response: ${await res.text()}`);
  } catch (e) {
    console.log(`Error: ${e.message}`);
  }

  // ─── 8. Try to get function definition via pg_catalog RPC ───
  console.log("\n--- 8. Trying to get routines from information_schema ---");
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/information_schema.routines?routine_name=eq.protect_subscriber_credits&select=routine_name,routine_definition,routine_type`, {
      headers
    });
    console.log(`Status: ${res.status}`);
    console.log(`Response: ${await res.text()}`);
  } catch (e) {
    console.log(`Error: ${e.message}`);
  }

  // ─── 9. Check if there's an RPC we can use to run arbitrary SQL ───
  console.log("\n--- 9. Checking for exec_sql or run_sql RPC ---");
  for (const fn of ['exec_sql', 'run_sql', 'execute_sql', 'raw_sql']) {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ query: "SELECT 1" })
      });
      console.log(`  ${fn}: Status ${res.status} — ${(await res.text()).substring(0, 200)}`);
    } catch (e) {
      console.log(`  ${fn}: Error — ${e.message}`);
    }
  }

  // ─── 10. Check boost_logs table (related to current file) ───
  console.log("\n--- 10. Checking boost_logs table ---");
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/boost_logs?limit=5&order=created_at.desc`, {
      headers
    });
    console.log(`Status: ${res.status}`);
    if (res.ok) {
      const data = await res.json();
      console.log(`Found ${data.length} entries`);
      data.forEach(row => console.log(`  ${JSON.stringify(row)}`));
    } else {
      console.log(`Response: ${await res.text()}`);
    }
  } catch (e) {
    console.log(`Error: ${e.message}`);
  }

  // ─── 11. Try Supabase Management API to get function body (needs different auth) ───
  // This won't work without a management API token, but let's document it
  console.log("\n--- 11. Attempting to query via Supabase SQL endpoint ---");
  try {
    // Supabase has a /pg endpoint for running SQL in some setups
    const res = await fetch(`${SUPABASE_URL}/pg`, {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: "SELECT prosrc FROM pg_proc WHERE proname = 'protect_subscriber_credits'"
      })
    });
    console.log(`Status: ${res.status}`);
    console.log(`Response: ${(await res.text()).substring(0, 500)}`);
  } catch (e) {
    console.log(`Error: ${e.message}`);
  }

  // ─── 12. Check what tables exist that might track migrations ───
  console.log("\n--- 12. Probing for migration/tracking tables ---");
  const tableNames = [
    'migration_log', 'schema_migrations', 'migrations', '_migrations',
    'supabase_migrations', 'flyway_schema_history', 'knex_migrations',
    'prisma_migrations', '_prisma_migrations', 'drizzle_migrations'
  ];
  for (const table of tableNames) {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?limit=1`, { headers });
      if (res.ok) {
        const data = await res.json();
        console.log(`  ✅ ${table} EXISTS (${data.length} sample rows)`);
        if (data.length > 0) console.log(`     Sample: ${JSON.stringify(data[0])}`);
      } else if (res.status === 404) {
        // Table doesn't exist in API
      } else {
        const txt = await res.text();
        if (txt.includes('does not exist') || txt.includes('relation')) {
          // doesn't exist
        } else {
          console.log(`  ⚠️ ${table}: ${res.status} — ${txt.substring(0, 100)}`);
        }
      }
    } catch (e) {}
  }

  // ─── 13. Check all users table columns to understand schema ───
  console.log("\n--- 13. Users table — checking columns by fetching one row ---");
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/users?limit=1&select=*`, { headers });
    if (res.ok) {
      const data = await res.json();
      if (data.length > 0) {
        console.log(`Columns: ${Object.keys(data[0]).join(', ')}`);
      }
    }
  } catch (e) {}

  // ─── 14. Check the DATABASE_URL connection string availability ───
  console.log("\n--- 14. Can we connect directly via pg? ---");
  try {
    // Check if pg module is available
    require.resolve('pg');
    console.log("pg module IS available — attempting direct SQL query...");
    const { Client } = require('pg');
    
    // Try the Supabase connection string (need actual password)
    // The .env.local has a placeholder [YOUR_PASSWORD], so let's try the service role approach
    // Actually, Supabase provides a connection pooler. Let's try constructing from known info.
    // The service role key JWT contains the password for the postgres user.
    
    // Try alternative: use the supabase-js SQL feature
    console.log("DATABASE_URL has placeholder password — can't connect directly via pg");
    console.log("Would need actual Supabase DB password to query pg_proc directly");
    
  } catch (e) {
    console.log("pg module not available — skipping direct connection");
  }

  // ─── 15. Indirect test: Check if the trigger prevents credit zeroing ───
  // We'll do a DRY RUN approach — check what the trigger SHOULD do based on migration files
  console.log("\n--- 15. Checking local migration files for protect_subscriber_credits ---");
  const fs = require('fs');
  const path = require('path');
  const migDir = path.join(__dirname, 'db', 'migrations');
  try {
    const files = fs.readdirSync(migDir).sort();
    const relevant = files.filter(f => {
      try {
        const content = fs.readFileSync(path.join(migDir, f), 'utf8');
        return content.includes('protect_subscriber_credits');
      } catch { return false; }
    });
    console.log(`Files referencing protect_subscriber_credits:`);
    relevant.forEach(f => {
      const content = fs.readFileSync(path.join(migDir, f), 'utf8');
      console.log(`\n  📄 ${f}:`);
      // Show key lines
      const lines = content.split('\n');
      lines.forEach((line, i) => {
        if (line.includes('credits') || line.includes('NEW.') || line.includes('OLD.') || 
            line.includes('RETURN') || line.includes('protect_subscriber') || 
            line.includes('BEGIN') || line.includes('IF ') || line.includes('THEN') ||
            line.includes('END') || line.includes('subscriber') || line.includes('trigger')) {
          console.log(`    L${i+1}: ${line.trim()}`);
        }
      });
    });
  } catch (e) {
    console.log(`Error reading migrations: ${e.message}`);
  }

  console.log("\n=== INVESTIGATION COMPLETE ===");
}

main().catch(console.error);
