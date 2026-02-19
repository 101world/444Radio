import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import { logCreditTransaction } from '@/lib/credit-transactions'
import { notifyWalletDeposit, notifyBilling } from '@/lib/notifications'

// ─────────────────────────────────────────────────────────────
// CANONICAL Razorpay webhook handler — PAY-PER-USAGE model
// Switched from subscription billing to credit-pack purchases.
// Active events (12):
//   payment.authorized, payment.captured, payment.failed
//   payment.dispute.created, payment.dispute.won, payment.dispute.lost
//   order.paid, order.notification.delivered, order.notification.failed
//   refund.created, refund.processed, refund.failed
// ─────────────────────────────────────────────────────────────

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ── Razorpay API helper ──
function razorpayAuth(): string {
  return Buffer.from(
    `${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`
  ).toString('base64')
}

// ── Idempotency: check if we already processed this event ──
async function isAlreadyProcessed(razorpayId: string, eventType: string): Promise<boolean> {
  try {
    const { data, error } = await supabaseAdmin
      .from('credit_transactions')
      .select('id')
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

// ── Resolve user from Razorpay customer ID or notes.clerk_user_id ──
async function resolveUser(customerId?: string, clerkUserId?: string) {
  // Direct lookup by clerk_user_id (preferred — set in order notes)
  if (clerkUserId) {
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('clerk_user_id', clerkUserId)
      .single()
    if (!error && user) return user
  }

  if (!customerId) return null

  // Try razorpay_customer_id
  const { data: user, error } = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('razorpay_customer_id', customerId)
    .single()
  if (!error && user) return user

  // Fallback: fetch customer email from Razorpay API
  try {
    const res = await fetch(`https://api.razorpay.com/v1/customers/${customerId}`, {
      headers: { Authorization: `Basic ${razorpayAuth()}` },
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

// ═══════════════════════════════════════════════════════════════
// WEBHOOK ENTRY POINT
// ═══════════════════════════════════════════════════════════════
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
      // ── Payment events ──
      case 'payment.captured':
        await handlePaymentCaptured(event.payload.payment, event.event)
        break
      case 'payment.authorized':
        await handlePaymentAuthorized(event.payload.payment)
        break
      case 'payment.failed':
        await handlePaymentFailed(event.payload.payment)
        break

      // ── Dispute events ──
      case 'payment.dispute.created':
        await handleDisputeCreated(event.payload.dispute)
        break
      case 'payment.dispute.won':
        await handleDisputeWon(event.payload.dispute)
        break
      case 'payment.dispute.lost':
        await handleDisputeLost(event.payload.dispute)
        break

      // ── Order events ──
      case 'order.paid':
        await handleOrderPaid(event.payload.order)
        break
      case 'order.notification.delivered':
        console.log('[Razorpay] Order notification delivered:', event.payload.order?.entity?.id)
        break
      case 'order.notification.failed':
        console.log('[Razorpay] Order notification failed:', event.payload.order?.entity?.id)
        break

      // ── Refund events ──
      case 'refund.created':
        await handleRefundCreated(event.payload.refund)
        break
      case 'refund.processed':
        await handleRefundProcessed(event.payload.refund)
        break
      case 'refund.failed':
        await handleRefundFailed(event.payload.refund)
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

// ═══════════════════════════════════════════════════════════════
// PAYMENT HANDLERS
// ═══════════════════════════════════════════════════════════════

/**
 * payment.captured — PRIMARY webhook handler.
 * Uses deposit_wallet_safe() RPC for atomic, race-free deposits.
 */
async function handlePaymentCaptured(payment: any, eventType: string) {
  const entity = payment.entity || payment
  const paymentId = entity.id

  console.log('[Razorpay] Payment captured:', paymentId, 'Amount:', entity.amount)

  const notes = entity.notes || {}
  const clerkUserId = notes.clerk_user_id
  const depositUsd = notes.deposit_usd ? parseFloat(notes.deposit_usd) : 0

  if (!clerkUserId || depositUsd <= 0) {
    console.log('[Razorpay] No clerk_user_id or deposit_usd in notes — skipping payment.captured')
    return
  }

  // Get current user (for customer_id storage)
  const user = await resolveUser(entity.customer_id, clerkUserId)
  if (!user) {
    console.error('[Razorpay] User not found:', clerkUserId)
    return
  }

  // Store razorpay_customer_id if not already
  if (entity.customer_id && entity.customer_id !== user.razorpay_customer_id) {
    await supabaseAdmin
      .from('users')
      .update({ razorpay_customer_id: entity.customer_id })
      .eq('clerk_user_id', user.clerk_user_id)
  }

  // ── ATOMIC deposit — locks user row, checks idempotency, deposits, logs in one transaction ──
  const { data: depositData, error: depositErr } = await supabaseAdmin.rpc('deposit_wallet_safe', {
    p_clerk_user_id: user.clerk_user_id,
    p_amount_usd: depositUsd,
    p_order_id: entity.order_id,
    p_payment_id: paymentId,
    p_description: `Wallet deposit: +$${depositUsd}`,
    p_metadata: {
      event_type: eventType,
      payment_amount: entity.amount,
      currency: entity.currency,
      credit_source: 'webhook_payment_captured',
    },
  })

  const result = Array.isArray(depositData) ? depositData[0] : depositData
  if (depositErr || !result?.success) {
    console.error('[Razorpay] Wallet deposit failed:', depositErr || result?.error_message)
    return
  }

  if (result.already_processed) {
    console.log(`[Razorpay] ⏭ Payment ${paymentId} already deposited (verify or order.paid won)`)
  } else {
    console.log(`[Razorpay] ✅ Payment ${paymentId}: +$${depositUsd} →wallet=$${result.new_balance} → ${user.email}`)
    
    // Notify user of successful wallet deposit
    await notifyWalletDeposit(user.clerk_user_id, depositUsd, 'INR', paymentId)
    await notifyBilling(user.clerk_user_id, depositUsd, 'Wallet deposit', true)
  }
}

/**
 * payment.authorized — logged for visibility (auto-capture should handle the rest).
 */
async function handlePaymentAuthorized(payment: any) {
  const entity = payment.entity || payment
  console.log('[Razorpay] Payment authorized:', entity.id, 'Amount:', entity.amount, entity.currency)
}

/**
 * payment.failed — log for debugging, no credit action.
 */
async function handlePaymentFailed(payment: any) {
  const entity = payment.entity || payment
  const notes = entity.notes || {}
  console.error('[Razorpay] Payment failed:', entity.id, entity.error_code, entity.error_description)

  // Log failed attempt for admin visibility
  if (notes.clerk_user_id) {
    await logCreditTransaction({
      userId: notes.clerk_user_id,
      amount: 0,
      type: 'credit_award',
      status: 'failed',
      description: `Payment failed: ${entity.error_description || entity.error_code || 'Unknown error'}`,
      metadata: {
        razorpay_id: entity.id,
        event_type: 'payment.failed',
        error_code: entity.error_code,
        error_description: entity.error_description,
        error_reason: entity.error_reason,
        payment_amount: entity.amount,
        currency: entity.currency,
        order_id: entity.order_id,
      },
    })
  }
}

// ═══════════════════════════════════════════════════════════════
// ORDER HANDLERS
// ═══════════════════════════════════════════════════════════════

/**
 * order.paid — secondary confirmation. Uses same atomic deposit_wallet_safe()
 * so if verify or payment.captured already deposited, this is a no-op.
 */
async function handleOrderPaid(order: any) {
  const entity = order.entity || order
  const orderId = entity.id
  console.log('[Razorpay] Order paid:', orderId, 'Amount:', entity.amount)

  const notes = entity.notes || {}
  const clerkUserId = notes.clerk_user_id
  const depositUsd = notes.deposit_usd ? parseFloat(notes.deposit_usd) : 0

  if (!clerkUserId || depositUsd <= 0) {
    console.log('[Razorpay] No clerk_user_id or deposit_usd in order notes — skipping order.paid')
    return
  }

  const user = await resolveUser(undefined, clerkUserId)
  if (!user) {
    console.error('[Razorpay] User not found for order:', clerkUserId)
    return
  }

  // ── ATOMIC deposit — same RPC, same lock, impossible to double ──
  const { data: depositData, error: depositErr } = await supabaseAdmin.rpc('deposit_wallet_safe', {
    p_clerk_user_id: user.clerk_user_id,
    p_amount_usd: depositUsd,
    p_order_id: orderId,
    p_payment_id: null,
    p_description: `Wallet deposit: +$${depositUsd} (order.paid)`,
    p_metadata: {
      event_type: 'order.paid',
      payment_amount: entity.amount,
      currency: entity.currency,
      credit_source: 'webhook_order_paid',
    },
  })

  const result = Array.isArray(depositData) ? depositData[0] : depositData
  if (depositErr || !result?.success) {
    console.error('[Razorpay] order.paid — deposit failed:', depositErr || result?.error_message)
    return
  }

  if (result.already_processed) {
    console.log(`[Razorpay] ⏭ Order ${orderId} already deposited (verify or payment.captured won)`)
  } else {
    console.log(`[Razorpay] ✅ Order ${orderId}: +$${depositUsd} → wallet=$${result.new_balance} → ${user.email}`)
  }
}

// ═══════════════════════════════════════════════════════════════
// DISPUTE HANDLERS
// ═══════════════════════════════════════════════════════════════

/**
 * payment.dispute.created — Freeze (flag) the credited amount.
 * We don't claw back immediately — just flag the user and log it.
 */
async function handleDisputeCreated(dispute: any) {
  const entity = dispute.entity || dispute
  const paymentId = entity.payment_id
  const disputeId = entity.id
  const amountInPaise = entity.amount // Razorpay amounts are in paise

  console.warn('[Razorpay] ⚠ Dispute created:', disputeId, 'for payment:', paymentId, 'amount:', amountInPaise)

  // Find the original credit transaction for this payment
  const { data: txn } = await supabaseAdmin
    .from('credit_transactions')
    .select('user_id, amount, metadata')
    .in('type', ['wallet_deposit', 'credit_award'])
    .eq('status', 'success')
    .contains('metadata', { razorpay_id: paymentId })
    .limit(1)

  const userId = txn?.[0]?.user_id
  const creditsAwarded = txn?.[0]?.amount || 0

  if (userId) {
    // Flag user as disputed
    await supabaseAdmin
      .from('users')
      .update({
        credits_disputed: true,
        updated_at: new Date().toISOString(),
      })
      .eq('clerk_user_id', userId)
  }

  await logCreditTransaction({
    userId: userId || 'unknown',
    amount: 0, // no credit change yet
    type: 'other',
    status: 'pending',
    description: `Dispute opened on payment ${paymentId} — ${creditsAwarded} credits at risk`,
    metadata: {
      razorpay_id: disputeId,
      event_type: 'payment.dispute.created',
      payment_id: paymentId,
      dispute_amount: amountInPaise,
      credits_at_risk: creditsAwarded,
      reason: entity.reason_code,
    },
  })
}

/**
 * payment.dispute.won — Merchant won the dispute, unfreeze credits.
 */
async function handleDisputeWon(dispute: any) {
  const entity = dispute.entity || dispute
  const paymentId = entity.payment_id
  const disputeId = entity.id

  console.log('[Razorpay] ✅ Dispute won:', disputeId, 'for payment:', paymentId)

  // Find the user and clear the dispute flag
  const { data: txn } = await supabaseAdmin
    .from('credit_transactions')
    .select('user_id')
    .in('type', ['wallet_deposit', 'credit_award'])
    .eq('status', 'success')
    .contains('metadata', { razorpay_id: paymentId })
    .limit(1)

  const userId = txn?.[0]?.user_id

  if (userId) {
    await supabaseAdmin
      .from('users')
      .update({
        credits_disputed: false,
        updated_at: new Date().toISOString(),
      })
      .eq('clerk_user_id', userId)
  }

  await logCreditTransaction({
    userId: userId || 'unknown',
    amount: 0,
    type: 'other',
    status: 'success',
    description: `Dispute WON for payment ${paymentId} — credits safe`,
    metadata: {
      razorpay_id: disputeId,
      event_type: 'payment.dispute.won',
      payment_id: paymentId,
    },
  })
}

/**
 * payment.dispute.lost — Chargeback lost. Claw back the credited amount.
 */
async function handleDisputeLost(dispute: any) {
  const entity = dispute.entity || dispute
  const paymentId = entity.payment_id
  const disputeId = entity.id

  console.error('[Razorpay] ❌ Dispute LOST:', disputeId, 'for payment:', paymentId)

  // Find how many credits were awarded for this payment
  const { data: txn } = await supabaseAdmin
    .from('credit_transactions')
    .select('user_id, amount')
    .in('type', ['wallet_deposit', 'credit_award'])
    .eq('status', 'success')
    .contains('metadata', { razorpay_id: paymentId })
    .limit(1)

  const userId = txn?.[0]?.user_id
  const creditsToClawBack = txn?.[0]?.amount || 0

  if (!userId || creditsToClawBack <= 0) {
    console.warn('[Razorpay] Could not find original credit transaction for clawback:', paymentId)
    await logCreditTransaction({
      userId: userId || 'unknown',
      amount: 0,
      type: 'other',
      status: 'failed',
      description: `Dispute LOST but could not find credits to claw back for payment ${paymentId}`,
      metadata: { razorpay_id: disputeId, event_type: 'payment.dispute.lost', payment_id: paymentId },
    })
    return
  }

  // Get current balance
  const { data: user } = await supabaseAdmin
    .from('users')
    .select('credits')
    .eq('clerk_user_id', userId)
    .single()

  const currentCredits = user?.credits || 0
  // Don't go below 0
  const newBalance = Math.max(0, currentCredits - creditsToClawBack)

  const { error: updateError } = await supabaseAdmin
    .from('users')
    .update({
      credits: newBalance,
      credits_disputed: false,
      updated_at: new Date().toISOString(),
    })
    .eq('clerk_user_id', userId)

  if (updateError) {
    console.error('[Razorpay] Clawback failed:', updateError)
  }

  await logCreditTransaction({
    userId,
    amount: -creditsToClawBack,
    balanceAfter: newBalance,
    type: 'credit_refund',
    status: 'success',
    description: `Dispute LOST — clawed back ${creditsToClawBack} credits for payment ${paymentId}`,
    metadata: {
      razorpay_id: disputeId,
      event_type: 'payment.dispute.lost',
      payment_id: paymentId,
      previous_balance: currentCredits,
    },
  })

  console.log(`[Razorpay] Clawed back ${creditsToClawBack} credits from ${userId} (${currentCredits} → ${newBalance})`)
}

// ═══════════════════════════════════════════════════════════════
// REFUND HANDLERS
// ═══════════════════════════════════════════════════════════════

/**
 * refund.created — Log that a refund was initiated. No credit change yet.
 */
async function handleRefundCreated(refund: any) {
  const entity = refund.entity || refund
  const refundId = entity.id
  const paymentId = entity.payment_id

  console.log('[Razorpay] Refund created:', refundId, 'for payment:', paymentId, 'amount:', entity.amount)

  // Find original user
  const { data: txn } = await supabaseAdmin
    .from('credit_transactions')
    .select('user_id, amount')
    .in('type', ['wallet_deposit', 'credit_award'])
    .eq('status', 'success')
    .contains('metadata', { razorpay_id: paymentId })
    .limit(1)

  await logCreditTransaction({
    userId: txn?.[0]?.user_id || 'unknown',
    amount: 0,
    type: 'credit_refund',
    status: 'pending',
    description: `Refund initiated for payment ${paymentId} — amount: ${entity.amount} ${entity.currency}`,
    metadata: {
      razorpay_id: refundId,
      event_type: 'refund.created',
      payment_id: paymentId,
      refund_amount: entity.amount,
      currency: entity.currency,
    },
  })
}

/**
 * refund.processed — Refund complete. Deduct the refunded credits from user.
 */
async function handleRefundProcessed(refund: any) {
  const entity = refund.entity || refund
  const refundId = entity.id
  const paymentId = entity.payment_id

  console.log('[Razorpay] Refund processed:', refundId, 'for payment:', paymentId)

  // ── Idempotency ──
  if (await isAlreadyProcessed(refundId, 'refund.processed')) {
    console.log('[Razorpay] ⏭ Refund already processed:', refundId)
    return
  }

  // Find original credit transaction
  const { data: txn } = await supabaseAdmin
    .from('credit_transactions')
    .select('user_id, amount, metadata')
    .in('type', ['wallet_deposit', 'credit_award'])
    .eq('status', 'success')
    .contains('metadata', { razorpay_id: paymentId })
    .limit(1)

  const userId = txn?.[0]?.user_id
  const originalCredits = txn?.[0]?.amount || 0
  const originalPaymentAmount = (txn?.[0]?.metadata as any)?.payment_amount || 0

  if (!userId) {
    console.warn('[Razorpay] Could not find user for refund:', paymentId)
    await logCreditTransaction({
      userId: 'unknown',
      amount: 0,
      type: 'credit_refund',
      status: 'failed',
      description: `Refund processed but could not find user for payment ${paymentId}`,
      metadata: { razorpay_id: refundId, event_type: 'refund.processed', payment_id: paymentId },
    })
    return
  }

  // Calculate proportional credits to deduct (handles partial refunds)
  let creditsToDeduct = originalCredits
  if (originalPaymentAmount > 0 && entity.amount < originalPaymentAmount) {
    // Partial refund — pro-rate the credits
    creditsToDeduct = Math.ceil(originalCredits * (entity.amount / originalPaymentAmount))
  }

  const { data: user } = await supabaseAdmin
    .from('users')
    .select('credits')
    .eq('clerk_user_id', userId)
    .single()

  const currentCredits = user?.credits || 0
  const newBalance = Math.max(0, currentCredits - creditsToDeduct)

  const { error: updateError } = await supabaseAdmin
    .from('users')
    .update({
      credits: newBalance,
      updated_at: new Date().toISOString(),
    })
    .eq('clerk_user_id', userId)

  if (updateError) {
    console.error('[Razorpay] Refund credit deduction failed:', updateError)
    return
  }

  await logCreditTransaction({
    userId,
    amount: -creditsToDeduct,
    balanceAfter: newBalance,
    type: 'credit_refund',
    status: 'success',
    description: `Refund processed: -${creditsToDeduct} credits for payment ${paymentId}`,
    metadata: {
      razorpay_id: refundId,
      event_type: 'refund.processed',
      payment_id: paymentId,
      refund_amount: entity.amount,
      original_credits: originalCredits,
      previous_balance: currentCredits,
      partial: entity.amount < originalPaymentAmount,
    },
  })

  console.log(`[Razorpay] ✅ Refund ${refundId}: -${creditsToDeduct} credits from ${userId} (${currentCredits} → ${newBalance})`)
}

/**
 * refund.failed — Log the failure for admin visibility.
 */
async function handleRefundFailed(refund: any) {
  const entity = refund.entity || refund
  console.error('[Razorpay] Refund failed:', entity.id, 'for payment:', entity.payment_id)

  await logCreditTransaction({
    userId: 'unknown',
    amount: 0,
    type: 'credit_refund',
    status: 'failed',
    description: `Refund failed for payment ${entity.payment_id}`,
    metadata: {
      razorpay_id: entity.id,
      event_type: 'refund.failed',
      payment_id: entity.payment_id,
      refund_amount: entity.amount,
    },
  })
}
