// Credit Audit for user 101world
// Reads .env.local for Supabase credentials

const fs = require('fs');
const https = require('https');
const path = require('path');

// Parse .env.local
const envPath = path.join(__dirname, '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
for (const line of envContent.split('\n')) {
  const match = line.match(/^([A-Z_][A-Z0-9_]*)="?(.*?)"?\s*$/);
  if (match) env[match[1]] = match[2];
}

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SERVICE_ROLE_KEY');
  process.exit(1);
}

function supabaseRpc(query) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${SUPABASE_URL}/rest/v1/rpc/`);
    // We'll use the PostgREST query interface instead
    reject('use query method');
  });
}

function supabaseQuery(table, params = '') {
  return new Promise((resolve, reject) => {
    const url = `${SUPABASE_URL}/rest/v1/${table}?${params}`;
    const parsed = new URL(url);
    const options = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: 'GET',
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'count=exact'
      }
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const count = res.headers['content-range'];
          resolve({ data: JSON.parse(data), count });
        } catch (e) {
          reject(new Error(`Parse error: ${data}`));
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  console.log('='.repeat(80));
  console.log('CREDIT AUDIT FOR USER: 101world');
  console.log('Date:', new Date().toISOString());
  console.log('='.repeat(80));

  // STEP 1: Get user record
  console.log('\n' + '='.repeat(80));
  console.log('STEP 1: USER RECORD');
  console.log('='.repeat(80));

  const userResult = await supabaseQuery('users', 
    'select=clerk_user_id,username,email,credits,total_generated,subscription_status,subscription_plan,subscription_id,razorpay_customer_id,updated_at&username=eq.101world'
  );

  if (!userResult.data || userResult.data.length === 0) {
    console.error('User 101world not found!');
    process.exit(1);
  }

  const user = userResult.data[0];
  const clerkId = user.clerk_user_id;

  for (const [key, value] of Object.entries(user)) {
    console.log(`  ${key}: ${value}`);
  }

  // STEP 2: Get ALL credit_transactions
  console.log('\n' + '='.repeat(80));
  console.log('STEP 2: ALL CREDIT TRANSACTIONS');
  console.log('='.repeat(80));

  // Fetch in batches to get ALL records (PostgREST default limit is 1000)
  let allTransactions = [];
  let offset = 0;
  const batchSize = 1000;
  
  while (true) {
    const txResult = await supabaseQuery('credit_transactions',
      `select=id,amount,balance_after,type,description,metadata,created_at&user_id=eq.${clerkId}&order=created_at.asc&offset=${offset}&limit=${batchSize}`
    );
    
    if (!txResult.data || txResult.data.length === 0) break;
    allTransactions = allTransactions.concat(txResult.data);
    if (txResult.data.length < batchSize) break;
    offset += batchSize;
  }

  console.log(`\nTotal transactions found: ${allTransactions.length}\n`);

  if (allTransactions.length === 0) {
    console.log('  No credit_transactions found for this user.');
  } else {
    console.log('  #  | Date/Time                 | Type              | Amount | Balance | Description');
    console.log('  ' + '-'.repeat(110));
    
    allTransactions.forEach((tx, i) => {
      const date = new Date(tx.created_at).toISOString().replace('T', ' ').substring(0, 19);
      const amt = (tx.amount >= 0 ? '+' : '') + tx.amount;
      const meta = tx.metadata ? JSON.stringify(tx.metadata) : '';
      console.log(`  ${String(i+1).padStart(3)} | ${date} | ${(tx.type || '').padEnd(17)} | ${amt.padStart(6)} | ${String(tx.balance_after).padStart(7)} | ${tx.description || ''}`);
      if (meta && meta !== '{}' && meta !== 'null') {
        console.log(`       metadata: ${meta}`);
      }
    });
  }

  // STEP 3: Code redemptions
  console.log('\n' + '='.repeat(80));
  console.log('STEP 3: CODE REDEMPTIONS');
  console.log('='.repeat(80));

  const redemptionsResult = await supabaseQuery('code_redemptions',
    `select=*&clerk_user_id=eq.${clerkId}&order=created_at.asc`
  );

  if (!redemptionsResult.data || redemptionsResult.data.length === 0) {
    console.log('  No code redemptions found.');
  } else {
    console.log(`\n  Total redemptions: ${redemptionsResult.data.length}\n`);
    redemptionsResult.data.forEach((r, i) => {
      console.log(`  Redemption #${i+1}:`);
      for (const [key, value] of Object.entries(r)) {
        console.log(`    ${key}: ${value}`);
      }
      console.log();
    });
  }

  // STEP 4 & 5: CRITICAL ANALYSIS - Walk through chronologically
  console.log('\n' + '='.repeat(80));
  console.log('STEP 4 & 5: CRITICAL BALANCE ANALYSIS');
  console.log('='.repeat(80));

  if (allTransactions.length === 0) {
    console.log('  No transactions to analyze.');
    console.log(`  Current credits: ${user.credits}`);
    console.log(`  Total generated: ${user.total_generated}`);
    console.log('\n  WARNING: User has credits but no transaction history. Credits may have been set directly in the database.');
    return;
  }

  let anomalies = [];
  let prevBalance = null;
  let knownBalance = null; // last known non-null balance

  // First pass: find the first transaction with a non-null balance_after to anchor
  const firstAnchored = allTransactions.find(t => t.balance_after !== null && t.balance_after !== undefined);
  
  console.log('\n  BALANCE PROGRESSION TIMELINE:');
  console.log('  ' + '-'.repeat(120));
  console.log('  #   | Date/Time               | Type              | Amount | Expected | Actual   | Status');
  console.log('  ' + '-'.repeat(120));

  for (let i = 0; i < allTransactions.length; i++) {
    const tx = allTransactions[i];
    const date = new Date(tx.created_at).toISOString().replace('T', ' ').substring(0, 19);
    const amt = tx.amount ?? 0;
    const balanceAfter = tx.balance_after;
    const balStr = balanceAfter !== null && balanceAfter !== undefined ? String(balanceAfter) : 'NULL';

    if (knownBalance === null && balanceAfter !== null && balanceAfter !== undefined) {
      // First anchored transaction - infer starting balance
      // Sum all amounts before this one (they had null balance_after)
      let preSum = 0;
      for (let j = 0; j < i; j++) preSum += (allTransactions[j].amount ?? 0);
      const impliedStart = balanceAfter - amt - preSum;
      console.log(`  [START] implied starting balance: ${impliedStart} (derived from first recorded balance_after at tx #${i+1})`);
      
      // Print all previous null-balance transactions
      let runningFromStart = impliedStart;
      for (let j = 0; j < i; j++) {
        const ptx = allTransactions[j];
        const pdate = new Date(ptx.created_at).toISOString().replace('T', ' ').substring(0, 19);
        const pamt = ptx.amount ?? 0;
        runningFromStart += pamt;
        console.log(`  ${String(j+1).padStart(4)} | ${pdate} | ${(ptx.type || '').padEnd(17)} | ${String((pamt >= 0 ? '+' : '') + pamt).padStart(6)} | ${String(runningFromStart).padStart(8)} | ${'NULL'.padStart(8)} | balance_after=NULL (inferred: ${runningFromStart})`);
      }
      
      // Now print this anchored one
      const expected = runningFromStart + amt;
      const isAnomaly = expected !== balanceAfter;
      const gap = balanceAfter - expected;
      const status = isAnomaly ? `*** ANOMALY gap=${gap >= 0 ? '+' : ''}${gap} ***` : 'OK';
      
      console.log(`  ${String(i+1).padStart(4)} | ${date} | ${(tx.type || '').padEnd(17)} | ${String((amt >= 0 ? '+' : '') + amt).padStart(6)} | ${String(expected).padStart(8)} | ${balStr.padStart(8)} | ${status}`);
      
      if (isAnomaly) {
        anomalies.push({ index: i, date, type: tx.type, amount: amt, expected, actual: balanceAfter, gap, description: tx.description });
      }
      
      knownBalance = balanceAfter;
      prevBalance = balanceAfter;
      continue;
    }
    
    if (knownBalance === null) {
      // Still before any anchor - just print with null
      console.log(`  ${String(i+1).padStart(4)} | ${date} | ${(tx.type || '').padEnd(17)} | ${String((amt >= 0 ? '+' : '') + amt).padStart(6)} | ${'?'.padStart(8)} | ${'NULL'.padStart(8)} | (no anchor yet)`);
      continue;
    }

    // Normal case: we have a previous known balance
    const expected = prevBalance + amt;
    
    if (balanceAfter === null || balanceAfter === undefined) {
      // NULL balance_after - assume it was correct (expected)
      console.log(`  ${String(i+1).padStart(4)} | ${date} | ${(tx.type || '').padEnd(17)} | ${String((amt >= 0 ? '+' : '') + amt).padStart(6)} | ${String(expected).padStart(8)} | ${'NULL'.padStart(8)} | balance_after=NULL (assuming ${expected})`);
      prevBalance = expected; // carry forward the expected
      continue;
    }

    const isAnomaly = expected !== balanceAfter;
    const gap = balanceAfter - expected;
    const status = isAnomaly ? `*** ANOMALY gap=${gap >= 0 ? '+' : ''}${gap} ***` : 'OK';

    console.log(`  ${String(i+1).padStart(4)} | ${date} | ${(tx.type || '').padEnd(17)} | ${String((amt >= 0 ? '+' : '') + amt).padStart(6)} | ${String(expected).padStart(8)} | ${balStr.padStart(8)} | ${status}`);

    if (isAnomaly) {
      anomalies.push({ index: i, date, type: tx.type, amount: amt, expected, actual: balanceAfter, gap, description: tx.description });
    }

    prevBalance = balanceAfter;
  }

  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('AUDIT SUMMARY');
  console.log('='.repeat(80));

  const lastTx = allTransactions[allTransactions.length - 1];
  const totalCreditsAdded = allTransactions.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const totalCreditsSpent = allTransactions.filter(t => t.amount < 0).reduce((s, t) => s + t.amount, 0);
  const totalAnomalyGap = anomalies.reduce((s, a) => s + a.gap, 0);

  console.log(`\n  Current credits in users table:   ${user.credits}`);
  console.log(`  Last transaction balance_after:    ${lastTx.balance_after}`);
  console.log(`  Match:                             ${user.credits === lastTx.balance_after ? 'YES' : 'NO - MISMATCH!'}`);
  console.log(`\n  Total credits added (positive tx): +${totalCreditsAdded}`);
  console.log(`  Total credits spent (negative tx): ${totalCreditsSpent}`);
  console.log(`  Net from transactions:             ${totalCreditsAdded + totalCreditsSpent}`);
  console.log(`  Total generated (users table):     ${user.total_generated}`);
  console.log(`\n  Total transactions:                ${allTransactions.length}`);
  console.log(`  Anomalies found:                   ${anomalies.length}`);
  console.log(`  Total unexplained gap:             ${totalAnomalyGap >= 0 ? '+' : ''}${totalAnomalyGap}`);

  if (anomalies.length > 0) {
    console.log('\n  ' + '='.repeat(60));
    console.log('  *** ANOMALOUS TRANSACTIONS (Balance Jumps) ***');
    console.log('  ' + '='.repeat(60));
    
    anomalies.forEach((a, i) => {
      console.log(`\n  Anomaly #${i+1}:`);
      console.log(`    Transaction #:  ${a.index + 1}`);
      console.log(`    Date:           ${a.date}`);
      console.log(`    Type:           ${a.type}`);
      console.log(`    Amount:         ${a.amount >= 0 ? '+' : ''}${a.amount}`);
      console.log(`    Expected after: ${a.expected}`);
      console.log(`    Actual after:   ${a.actual}`);
      console.log(`    Unexplained:    ${a.gap >= 0 ? '+' : ''}${a.gap} credits`);
      console.log(`    Description:    ${a.description}`);
    });
  } else {
    console.log('\n  *** NO ANOMALIES DETECTED - All balance transitions are consistent ***');
  }

  // Check final balance vs current
  if (prevBalance !== null) {
    const diff = user.credits - prevBalance;
    if (diff !== 0) {
      console.log(`\n  *** WARNING: Current credits (${user.credits}) != last computed balance (${prevBalance}). Diff: ${diff >= 0 ? '+' : ''}${diff} ***`);
    }
  }

  // Type breakdown
  console.log('\n  TRANSACTION TYPE BREAKDOWN:');
  const typeCounts = {};
  const typeAmounts = {};
  for (const tx of allTransactions) {
    const t = tx.type || 'unknown';
    typeCounts[t] = (typeCounts[t] || 0) + 1;
    typeAmounts[t] = (typeAmounts[t] || 0) + (tx.amount ?? 0);
  }
  for (const [t, count] of Object.entries(typeCounts).sort((a, b) => a[1] - b[1])) {
    console.log(`    ${t.padEnd(25)} count: ${String(count).padStart(4)}  net: ${typeAmounts[t] >= 0 ? '+' : ''}${typeAmounts[t]}`);
  }

  console.log('\n' + '='.repeat(80));
  console.log('END OF AUDIT');
  console.log('='.repeat(80));
}

main().catch(err => {
  console.error('Audit failed:', err.message || err);
  process.exit(1);
});
