#!/usr/bin/env node
/**
 * cancel-all-subscriptions.js
 * 
 * One-time script to cancel ALL active Razorpay subscriptions.
 * Run after migrating to the wallet + pay-per-usage model.
 *
 * Usage:
 *   node scripts/cancel-all-subscriptions.js
 *
 * Env vars required:
 *   RAZORPAY_KEY_ID
 *   RAZORPAY_KEY_SECRET
 *
 * Options:
 *   --dry-run    List subscriptions without cancelling (default)
 *   --execute    Actually cancel all active subscriptions
 *   --at-end     Cancel at end of billing cycle (default: immediate)
 */

require('dotenv').config({ path: '.env.local' })

const KEY_ID = process.env.RAZORPAY_KEY_ID
const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET

if (!KEY_ID || !KEY_SECRET) {
  console.error('❌ Missing RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET in .env.local')
  process.exit(1)
}

const AUTH = Buffer.from(`${KEY_ID}:${KEY_SECRET}`).toString('base64')
const args = process.argv.slice(2)
const DRY_RUN = !args.includes('--execute')
const CANCEL_AT_END = args.includes('--at-end')

async function fetchAllSubscriptions() {
  const all = []
  let skip = 0
  const count = 100

  while (true) {
    const url = `https://api.razorpay.com/v1/subscriptions?count=${count}&skip=${skip}`
    const res = await fetch(url, {
      headers: { Authorization: `Basic ${AUTH}` },
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      console.error(`❌ Razorpay API error (${res.status}):`, err)
      break
    }

    const data = await res.json()
    const items = data.items || []
    all.push(...items)

    if (items.length < count) break
    skip += count
  }

  return all
}

async function cancelSubscription(subId) {
  const url = `https://api.razorpay.com/v1/subscriptions/${subId}/cancel`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${AUTH}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      cancel_at_cycle_end: CANCEL_AT_END ? 1 : 0,
    }),
  })

  const data = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, data }
}

async function main() {
  console.log('═══════════════════════════════════════════════════')
  console.log(' 444Radio — Cancel All Razorpay Subscriptions')
  console.log(`═══════════════════════════════════════════════════`)
  console.log(`Mode:       ${DRY_RUN ? '🔍 DRY RUN (preview only)' : '🔥 EXECUTE (will cancel!)'}`)
  console.log(`Cancel at:  ${CANCEL_AT_END ? 'End of billing cycle' : 'Immediately'}`)
  console.log(`Key ID:     ${KEY_ID.slice(0, 12)}...`)
  console.log('')

  console.log('Fetching all subscriptions from Razorpay...')
  const subs = await fetchAllSubscriptions()
  console.log(`Found ${subs.length} total subscriptions\n`)

  // Filter active/authenticated/pending
  const cancellable = subs.filter(s =>
    ['active', 'authenticated', 'pending'].includes(s.status)
  )

  const alreadyCancelled = subs.filter(s =>
    ['cancelled', 'completed', 'halted', 'expired'].includes(s.status)
  )

  console.log(`  Active/authenticated/pending: ${cancellable.length}`)
  console.log(`  Already cancelled/completed:  ${alreadyCancelled.length}`)
  console.log('')

  if (cancellable.length === 0) {
    console.log('✅ No active subscriptions to cancel. All clear!')
    return
  }

  // List each one
  console.log('── Subscriptions to cancel ──────────────────────')
  for (const sub of cancellable) {
    const notes = sub.notes || {}
    const userId = notes.clerk_user_id || notes.user_id || '?'
    const plan = notes.plan || notes.plan_name || '?'
    const created = new Date(sub.created_at * 1000).toISOString().split('T')[0]
    console.log(
      `  ${sub.id}  status=${sub.status}  plan=${plan}  user=${userId}  created=${created}`
    )
  }
  console.log('')

  if (DRY_RUN) {
    console.log('🔍 DRY RUN — no subscriptions were cancelled.')
    console.log('   Run with --execute to actually cancel them:')
    console.log('   node scripts/cancel-all-subscriptions.js --execute')
    console.log('   node scripts/cancel-all-subscriptions.js --execute --at-end')
    return
  }

  // Actually cancel
  console.log('── Cancelling ──────────────────────────────────')
  let succeeded = 0
  let failed = 0

  for (const sub of cancellable) {
    process.stdout.write(`  ${sub.id} ... `)
    const result = await cancelSubscription(sub.id)

    if (result.ok) {
      console.log(`✅ cancelled (${result.data.status || 'done'})`)
      succeeded++
    } else {
      console.log(`❌ failed (${result.status}): ${JSON.stringify(result.data?.error || result.data)}`)
      failed++
    }

    // Small delay to avoid rate limits
    await new Promise(r => setTimeout(r, 200))
  }

  console.log('')
  console.log('── Summary ─────────────────────────────────────')
  console.log(`  ✅ Cancelled: ${succeeded}`)
  console.log(`  ❌ Failed:    ${failed}`)
  console.log(`  Total:       ${cancellable.length}`)
  console.log('')
  console.log('Done! All active subscriptions have been processed.')
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
