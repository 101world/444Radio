import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import { logCreditTransaction } from '@/lib/credit-transactions'

// ─────────────────────────────────────────────────────────────
// CANONICAL Razorpay webhook handler (consolidated Feb 2026)
// All Razorpay webhook traffic should point to /api/webhooks/razorpay
// ─────────────────────────────────────────────────────────────

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ── Plan → credits mapping (fallback when notes.credits is missing) ──
const PLAN_CREDITS: Record<string, { credits: number; label: string }> = {
  // Creator plans
  'plan_S2DGVK6J270rtt': { credits: 167, label: 'Creator Monthly' },
  'plan_S2DGkl8VQJiZvV': { credits: 1667, label: 'Creator Annual' },
  'plan_S2DJv0bFnWoNLS': { credits: 1667, label: 'Creator Annual (alt)' },
  // Pro plans
  'plan_S2DHUGo7n1m6iv': { credits: 535, label: 'Pro Monthly' },
  'plan_S2DNEvy1YzYWNh': { credits: 5167, label: 'Pro Annual' },
  // Studio plans
  'plan_S2DIdCKNcV6TtA': { credits: 1235, label: 'Studio Monthly' },
  'plan_S2DOABOeGedJHk': { credits: 11967, label: 'Studio Annual' },
}

// Detect human-readable plan type from plan ID
function detectPlanType(planId: string): string {
  const id = (planId || '').toUpperCase()
  if (id.includes('S2DI') || id.includes('S2DO')) return 'studio'
  if (id.includes('S2DH') || id.includes('S2DN')) return 'pro'
  if (id.includes('S2DG') || id.includes('S2DJ')) return 'creator'
  return 'creator' // safe default
}

// ── Idempotency: check if we already processed this event ──
async function isAlreadyProcessed(razorpayId: string, eventType: string): Promise<boolean> {
  try {
    const { data, error } = await supabaseAdmin
      .from('credit_transactions')
      .select('id')
      .eq('type', 'subscription_bonus')
      .contains('metadata', { razorpay_id: razorpayId, event_type: eventType })
      .limit(1)

    if (error) {
      console.error('[Razorpay] Idempotency check failed:', error)
      return false // fail open — better to risk double than block
    }

    return (data?.length ?? 0) > 0
  } catch (err) {
    console.error('[Razorpay] Idempotency check error:', err)
    return false
  }
}

export async function POST(req: Request) {
  console.log('[Razorpay Webhook] POST request received')
  try {
    const body = await req.text()
    const signature = req.headers.get('x-razorpay-signature')

    if (!signature) {
      console.error('[Razorpay Webhook] No signature provided')
      return new Response('No signature', { status: 400 })
    }

    // Verify webhook signature
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET!)
      .update(body)
      .digest('hex')

    if (signature !== expectedSignature) {
      console.error('[Razorpay Webhook] Invalid signature')
      return new Response('Invalid signature', { status: 401 })
    }

    const event = JSON.parse(body)
    console.log('[Razorpay Webhook] Event:', event.event)

    switch (event.event) {
      case 'payment.captured':
        await handlePaymentCaptured(event.payload.payment, event.event)
        break

      case 'payment.authorized':
        console.log('[Razorpay] Payment authorized (no credit action)')
        break

      case 'subscription.activated':
        await handleSubscriptionActivated(event.payload.subscription)
        break

      case 'subscription.charged':
        await handleSubscriptionCharged(event.payload.subscription, event.event)
        break

      case 'subscription.paused':
        await handleSubscriptionPaused(event.payload.subscription)
        break

      case 'subscription.resumed':
        await handleSubscriptionResumed(event.payload.subscription)
        break

      case 'subscription.cancelled':
      case 'subscription.expired':
        await handleSubscriptionEnd(event.payload.subscription)
        break

      case 'subscription.updated':
        await handleSubscriptionUpdated(event.payload.subscription)
        break

      case 'payment.failed':
        await handlePaymentFailed(event.payload.payment)
        break

      default:
        console.log('[Razorpay Webhook] Unhandled event:', event.event)
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('[Razorpay Webhook] Error:', error)
    return new Response(JSON.stringify({ error: 'Webhook processing failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// ── Resolve user from Razorpay customer ID (shared helper) ──
async function resolveUser(customerId: string) {
  // First try: direct lookup by customer ID
  let { data: user, error } = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('razorpay_customer_id', customerId)
    .single()

  if (!error && user) return user

  // Second try: fetch customer email from Razorpay API
  try {
    const razorpayAuth = Buffer.from(
      `${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`
    ).toString('base64')
    const res = await fetch(`https://api.razorpay.com/v1/customers/${customerId}`, {
      headers: { Authorization: `Basic ${razorpayAuth}` },
    })
    if (res.ok) {
      const customer = await res.json()
      const { data: userByEmail, error: emailError } = await supabaseAdmin
        .from('users')
        .select('*')
        .eq('email', customer.email)
        .single()

      if (!emailError && userByEmail) {
        // Store customer ID for future lookups
        await supabaseAdmin
          .from('users')
          .update({ razorpay_customer_id: customerId })
          .eq('clerk_user_id', userByEmail.clerk_user_id)
        return userByEmail
      }
    }
  } catch (e) {
    console.error('[Razorpay] Failed to fetch customer from API:', e)
  }

  return null
}

// ── Verify subscription status via Razorpay API ──
async function verifySubscriptionWithRazorpay(subscriptionId: string): Promise<{ active: boolean; status: string; paidCount: number } | null> {
  try {
    const razorpayAuth = Buffer.from(
      `${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`
    ).toString('base64')
    const res = await fetch(`https://api.razorpay.com/v1/subscriptions/${subscriptionId}`, {
      headers: { Authorization: `Basic ${razorpayAuth}` },
    })
    if (!res.ok) {
      console.error('[Razorpay] API verify failed:', res.status, await res.text())
      return null
    }
    const sub = await res.json()
    return {
      active: sub.status === 'active' || sub.status === 'authenticated',
      status: sub.status,
      paidCount: sub.paid_count || 0,
    }
  } catch (e) {
    console.error('[Razorpay] Failed to verify subscription via API:', e)
    return null
  }
}

// ── subscription.activated → status-only, NO credits ──
// Credits are awarded ONLY via subscription.charged to prevent double-awarding
async function handleSubscriptionActivated(subscription: any) {
  const entity = subscription.entity || subscription
  console.log('[Razorpay] Subscription activated (status-only, no credits):', entity.id)

  const customerId = entity.customer_id
  const user = await resolveUser(customerId)
  if (!user) {
    console.error('[Razorpay] User not found for customer:', customerId)
    return
  }

  const planType = detectPlanType(entity.plan_id)

  const { error } = await supabaseAdmin
    .from('users')
    .update({
      subscription_status: 'active',
      subscription_plan: planType,
      subscription_id: entity.id,
      subscription_start: entity.start_at,
      subscription_end: entity.end_at,
      razorpay_customer_id: customerId,
      updated_at: new Date().toISOString(),
    })
    .eq('clerk_user_id', user.clerk_user_id)

  if (error) console.error('[Razorpay] Failed to update subscription status:', error)
  else console.log(`[Razorpay] ✅ Subscription ${entity.id} activated for ${user.clerk_user_id} (status-only)`)
}

// ── subscription.charged → validates + awards credits ──
async function handleSubscriptionCharged(subscription: any, eventType: string) {
  const subscriptionEntity = subscription.entity || subscription
  const paidCount = subscriptionEntity.paid_count || 0
  console.log('[Razorpay] Subscription charged:', subscriptionEntity.id, 'paid_count:', paidCount)

  const customerId = subscriptionEntity.customer_id
  const planId = subscriptionEntity.plan_id

  // ── Idempotency: include paid_count so monthly renewals each get processed ──
  const idempotencyKey = `${subscriptionEntity.id}_charged_${paidCount}`

  if (await isAlreadyProcessed(idempotencyKey, eventType)) {
    console.log('[Razorpay] ⏭ Already processed:', idempotencyKey)
    return
  }

  // ── Verify subscription is actually active via Razorpay API ──
  const verification = await verifySubscriptionWithRazorpay(subscriptionEntity.id)
  if (verification) {
    if (!verification.active) {
      console.warn(`[Razorpay] ❌ Subscription ${subscriptionEntity.id} status is "${verification.status}" — NOT active. Skipping credit award.`)
      // Log the blocked event for admin visibility
      await logCreditTransaction({
        userId: 'system',
        amount: 0,
        balanceAfter: 0,
        type: 'subscription_bonus',
        status: 'failed',
        description: `BLOCKED: subscription.charged but status="${verification.status}" — credits NOT awarded`,
        metadata: {
          razorpay_id: idempotencyKey,
          event_type: eventType,
          subscription_id: subscriptionEntity.id,
          subscription_status: verification.status,
          plan_id: planId,
          customer_id: customerId,
          blocked_reason: 'subscription_not_active',
        },
      })
      return
    }
    console.log(`[Razorpay] ✓ API verified: subscription is "${verification.status}", paid_count=${verification.paidCount}`)
  } else {
    // API verification failed — proceed cautiously with webhook data
    console.warn('[Razorpay] ⚠ Could not verify via API, proceeding with webhook data')
  }

  // ── Check subscription end date hasn't passed ──
  if (subscriptionEntity.end_at) {
    const endDate = new Date(subscriptionEntity.end_at * 1000) // Razorpay uses Unix timestamps
    if (endDate < new Date()) {
      console.warn(`[Razorpay] ❌ Subscription ${subscriptionEntity.id} end_at (${endDate.toISOString()}) is in the past. Skipping credit award.`)
      return
    }
  }

  const user = await resolveUser(customerId)
  if (!user) {
    console.error('[Razorpay] User not found for customer:', customerId)
    return
  }

  // ── Double-check user's subscription status in our DB ──
  if (user.subscription_status === 'cancelled' || user.subscription_status === 'expired') {
    console.warn(`[Razorpay] ⚠ User ${user.clerk_user_id} subscription_status="${user.subscription_status}" in DB but got charged event. Verifying...`)
    // If API said active, trust the API and update status. Otherwise skip.
    if (!verification?.active) {
      console.warn(`[Razorpay] ❌ Both DB and API indicate inactive. Skipping credit award.`)
      return
    }
  }

  // ── Determine credits to add ──
  let creditsToAdd = 0
  let creditSource = 'unknown'

  const orderNotesCredits = subscriptionEntity.notes?.credits
  if (orderNotesCredits) {
    creditsToAdd = parseInt(orderNotesCredits, 10)
    creditSource = 'notes.credits'
  } else {
    const plan = PLAN_CREDITS[planId]
    if (plan) {
      creditsToAdd = plan.credits
      creditSource = `planMapping (${plan.label})`
    } else {
      console.warn('[Razorpay] Unknown plan ID:', planId, '— 0 credits')
    }
  }

  if (creditsToAdd <= 0) {
    console.warn('[Razorpay] No credits to award for subscription:', subscriptionEntity.id)
    return
  }

  const planType = detectPlanType(planId)
  const newBalance = (user.credits || 0) + creditsToAdd

  console.log(`[Razorpay] Awarding ${creditsToAdd} credits (${creditSource}) to ${user.clerk_user_id} [paid_count=${paidCount}]`)

  // ── Update user ──
  const { error: updateError } = await supabaseAdmin
    .from('users')
    .update({
      credits: newBalance,
      subscription_status: 'active',
      subscription_plan: planType,
      subscription_id: subscriptionEntity.id,
      subscription_start: subscriptionEntity.start_at,
      subscription_end: subscriptionEntity.end_at,
      razorpay_customer_id: customerId,
      updated_at: new Date().toISOString(),
    })
    .eq('clerk_user_id', user.clerk_user_id)

  if (updateError) {
    console.error('[Razorpay] Failed to update user:', updateError)
    return
  }

  // ── Log transaction (idempotency record) ──
  await logCreditTransaction({
    userId: user.clerk_user_id,
    amount: creditsToAdd,
    balanceAfter: newBalance,
    type: 'subscription_bonus',
    status: 'success',
    description: `Subscription charged (cycle #${paidCount}): +${creditsToAdd} credits (${planType})`,
    metadata: {
      razorpay_id: idempotencyKey,
      event_type: eventType,
      plan_id: planId,
      plan_type: planType,
      subscription_id: subscriptionEntity.id,
      credit_source: creditSource,
      previous_balance: user.credits || 0,
      paid_count: paidCount,
    },
  })

  console.log(`[Razorpay] ✅ ${creditsToAdd} credits → ${user.clerk_user_id} (${user.credits || 0} → ${newBalance}) [cycle #${paidCount}]`)
}

async function handleSubscriptionEnd(subscription: any) {
  const entity = subscription.entity || subscription
  console.log('[Razorpay] Subscription ended:', entity.id)

  const { error } = await supabaseAdmin
    .from('users')
    .update({
      subscription_status: 'cancelled',
      updated_at: new Date().toISOString()
    })
    .eq('subscription_id', entity.id)

  if (error) console.error('[Razorpay] Failed to cancel subscription:', error)
}

async function handleSubscriptionPaused(subscription: any) {
  const entity = subscription.entity || subscription
  console.log('[Razorpay] Subscription paused:', entity.id)

  const { error } = await supabaseAdmin
    .from('users')
    .update({
      subscription_status: 'paused',
      updated_at: new Date().toISOString()
    })
    .eq('subscription_id', entity.id)

  if (error) console.error('[Razorpay] Failed to pause subscription:', error)
}

async function handleSubscriptionResumed(subscription: any) {
  const entity = subscription.entity || subscription
  console.log('[Razorpay] Subscription resumed:', entity.id)

  const { error } = await supabaseAdmin
    .from('users')
    .update({
      subscription_status: 'active',
      updated_at: new Date().toISOString()
    })
    .eq('subscription_id', entity.id)

  if (error) console.error('[Razorpay] Failed to resume subscription:', error)
}

async function handleSubscriptionUpdated(subscription: any) {
  const entity = subscription.entity || subscription
  console.log('[Razorpay] Subscription updated:', entity.id)

  const { error } = await supabaseAdmin
    .from('users')
    .update({
      subscription_plan: detectPlanType(entity.plan_id),
      subscription_end: entity.end_at,
      updated_at: new Date().toISOString()
    })
    .eq('subscription_id', entity.id)

  if (error) console.error('[Razorpay] Failed to update subscription:', error)
}

async function handlePaymentCaptured(payment: any, eventType: string) {
  // Razorpay sends payment.entity in webhook payloads
  const entity = payment.entity || payment
  const paymentId = entity.id

  console.log('[Razorpay] Payment captured:', paymentId, 'Amount:', entity.amount)

  // ── Idempotency check ──
  if (await isAlreadyProcessed(paymentId, eventType)) {
    console.log('[Razorpay] ⏭ Payment already processed:', paymentId)
    return
  }

  const notes = entity.notes || {}
  const clerkUserId = notes.clerk_user_id
  const creditsFromNotes = notes.credits ? parseInt(notes.credits, 10) : 0

  if (!clerkUserId || creditsFromNotes <= 0) {
    console.log('[Razorpay] No clerk_user_id or credits in notes — skipping payment.captured')
    return
  }

  // Get current user
  const { data: user, error: fetchError } = await supabaseAdmin
    .from('users')
    .select('credits, email')
    .eq('clerk_user_id', clerkUserId)
    .single()

  if (fetchError || !user) {
    console.error('[Razorpay] User not found:', clerkUserId, fetchError)
    return
  }

  const newBalance = (user.credits || 0) + creditsFromNotes
  const planType = notes.plan_type || detectPlanType(notes.plan_id || '')

  // ── Update user ──
  const { error: updateError } = await supabaseAdmin
    .from('users')
    .update({
      credits: newBalance,
      subscription_status: 'active',
      subscription_plan: planType,
      razorpay_customer_id: notes.customer_id,
      subscription_id: notes.subscription_id,
      updated_at: new Date().toISOString(),
    })
    .eq('clerk_user_id', clerkUserId)

  if (updateError) {
    console.error('[Razorpay] Failed to deliver credits:', updateError)
    return
  }

  // ── Log transaction (idempotency record) ──
  await logCreditTransaction({
    userId: clerkUserId,
    amount: creditsFromNotes,
    balanceAfter: newBalance,
    type: 'subscription_bonus',
    status: 'success',
    description: `Payment captured: +${creditsFromNotes} credits (${planType})`,
    metadata: {
      razorpay_id: paymentId,
      event_type: eventType,
      plan_type: planType,
      payment_amount: entity.amount,
      previous_balance: user.credits || 0,
    },
  })

  console.log(`[Razorpay] ✅ Payment ${paymentId}: +${creditsFromNotes} credits → ${user.email} (${user.credits || 0} → ${newBalance})`)
}

async function handlePaymentFailed(payment: any) {
  const entity = payment.entity || payment
  console.log('[Razorpay] Payment failed:', entity.id, entity.error_code, entity.error_description)
}
