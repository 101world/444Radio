// Find users affected by double-deposit bug
// Looks for users who got multiple wallet_deposit + wallet_conversion
// transactions for the same order_id
require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function main() {
  // 1. Find user by username/display name containing riri or iruya
  const { data: users1 } = await supabase
    .from('users')
    .select('clerk_user_id, credits, wallet_balance, email, username, display_name, updated_at')
    .or('username.ilike.%riri%,username.ilike.%iruya%,display_name.ilike.%riri%,display_name.ilike.%iruya%,email.ilike.%riri%,email.ilike.%iruya%')

  console.log('Users matching riri/iruya:')
  for (const u of (users1 || [])) {
    console.log(`  ${u.clerk_user_id} | credits=${u.credits} | wallet=$${u.wallet_balance} | user=${u.username} | name=${u.display_name} | email=${u.email} | updated=${u.updated_at}`)
  }

  if (!users1?.length) {
    console.log('No users found by riri/iruya. Listing ALL users:')
    const { data: allUsers, error: allErr } = await supabase
      .from('users')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(30)
    if (allErr) console.error('Error:', allErr)
    if (allUsers?.length > 0) {
      console.log('Columns:', Object.keys(allUsers[0]).join(', '))
    }
    for (const u of (allUsers || [])) {
      console.log(`  ${u.clerk_user_id} | c=${u.credits} | w=$${u.wallet_balance} | ${JSON.stringify({user: u.username, name: u.display_name, first: u.first_name, last: u.last_name, email: u.email, image: u.image_url?.substring(0,30)})}`)
    }
  }

  // 2. For matched users, get ALL transactions
  for (const u of (users1 || [])) {
    console.log(`\n═══ ALL transactions for ${u.username || u.display_name} (${u.clerk_user_id}) ═══`)
    const { data: txns } = await supabase
      .from('credit_transactions')
      .select('id, type, status, amount, balance_after, description, metadata, created_at')
      .eq('user_id', u.clerk_user_id)
      .order('created_at', { ascending: false })
      .limit(50)
    for (const t of (txns || [])) {
      const m = t.metadata || {}
      console.log(`  ${t.created_at} | ${t.type} | status=${t.status} | amt=${t.amount} | bal=${t.balance_after}`)
      console.log(`    desc: ${t.description}`)
      if (m.order_id || m.razorpay_payment_id || m.razorpay_id || m.deposit_usd || m.credit_source) {
        console.log(`    meta: order=${m.order_id||'?'} pay=${m.razorpay_payment_id||m.razorpay_id||'?'} deposit=$${m.deposit_usd||'?'} source=${m.credit_source||m.source||m.event_type||'?'}`)
      }
    }
  }

  // dummy to satisfy the rest of the script
  const txns = []; const error = null;

  if (error) { console.error('Query error:', error); return }

  console.log(`Found ${txns.length} wallet transactions in last 7 days:\n`)

  // Group by user
  const byUser = {}
  for (const t of txns) {
    if (!byUser[t.user_id]) byUser[t.user_id] = []
    byUser[t.user_id].push(t)
  }

  for (const [userId, userTxns] of Object.entries(byUser)) {
    console.log(`\n═══ User: ${userId} ═══`)
    for (const t of userTxns) {
      const m = t.metadata || {}
      console.log(`  ${t.created_at} | ${t.type} | amount=${t.amount} | balance_after=${t.balance_after}`)
      console.log(`    desc: ${t.description}`)
      console.log(`    source: ${m.credit_source || m.source || m.event_type || '?'} | order: ${m.order_id || m.razorpay_order_id || '?'} | payment: ${m.razorpay_id || m.razorpay_payment_id || '?'}`)
      console.log(`    deposit_usd: ${m.deposit_usd || m.usd_converted || '?'} | credits_added: ${m.credits_added || m.credits_added || t.amount}`)
    }
  }

  // 2. Get current state for these users
  const userIds = Object.keys(byUser)
  if (userIds.length > 0) {
    const { data: users } = await supabase
      .from('users')
      .select('clerk_user_id, credits, wallet_balance, email')
      .in('clerk_user_id', userIds)

    console.log('\n\n═══ Current User States ═══')
    for (const u of (users || [])) {
      console.log(`  ${u.clerk_user_id} | credits=${u.credits} | wallet=$${u.wallet_balance} | ${u.email}`)
    }
  }
}

main().catch(console.error)
