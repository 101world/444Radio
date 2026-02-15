import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { corsResponse, handleOptions } from '@/lib/cors'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { logCreditTransaction } from '@/lib/credit-transactions'
import crypto from 'crypto'

export async function OPTIONS() {
  return handleOptions()
}

// ── Server-side plan config (single source of truth) ──
// NEVER trust client-sent credits values
const PLAN_CREDITS: Record<string, Record<string, number>> = {
  creator:  { monthly: 167,   annual: 1667 },
  pro:      { monthly: 535,   annual: 5167 },
  studio:   { monthly: 1235,  annual: 11967 },
}

export async function POST(request: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return corsResponse(
        NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      )
    }

    const body = await request.json()
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      plan,
      billing,
    } = body

    // ── Validate required fields ──
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !plan || !billing) {
      return corsResponse(
        NextResponse.json({ error: 'Missing required payment fields' }, { status: 400 })
      )
    }

    console.log('[Payment Verify] Processing payment:', {
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      plan,
      billing,
    })

    // ── Verify HMAC signature ──
    const keySecret = process.env.RAZORPAY_KEY_SECRET
    const keyId = process.env.RAZORPAY_KEY_ID
    if (!keySecret || !keyId) {
      throw new Error('Razorpay credentials not configured')
    }

    const generatedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex')

    if (generatedSignature !== razorpay_signature) {
      console.error('[Payment Verify] ❌ Signature mismatch')
      return corsResponse(
        NextResponse.json({ error: 'Payment verification failed' }, { status: 400 })
      )
    }

    console.log('[Payment Verify] ✅ Signature verified')

    // ── IDEMPOTENCY: Check if this payment_id was already processed ──
    const { data: existingTxn } = await supabaseAdmin
      .from('credit_transactions')
      .select('id')
      .eq('metadata->>razorpay_payment_id', razorpay_payment_id)
      .eq('type', 'subscription_bonus')
      .limit(1)
      .maybeSingle()

    if (existingTxn) {
      console.warn('[Payment Verify] ⏭ Payment already processed:', razorpay_payment_id)
      return corsResponse(
        NextResponse.json({
          success: true,
          message: 'Payment already processed',
          alreadyProcessed: true,
        })
      )
    }

    // ── SERVER-SIDE: Fetch actual order from Razorpay to get real credits ──
    const authHeader = Buffer.from(`${keyId}:${keySecret}`).toString('base64')
    const orderRes = await fetch(`https://api.razorpay.com/v1/orders/${razorpay_order_id}`, {
      headers: { Authorization: `Basic ${authHeader}` },
    })

    if (!orderRes.ok) {
      console.error('[Payment Verify] ❌ Failed to fetch order from Razorpay:', orderRes.status)
      throw new Error('Could not verify order with Razorpay')
    }

    const order = await orderRes.json()

    // ── Validate order status ──
    if (order.status !== 'paid') {
      console.error('[Payment Verify] ❌ Order not paid:', order.status)
      return corsResponse(
        NextResponse.json({ error: 'Order has not been paid' }, { status: 400 })
      )
    }

    // ── Determine credits from SERVER-SIDE plan config (ignore client-sent credits) ──
    const planType = (plan || '').toLowerCase()
    const billingCycle = (billing || '').toLowerCase()
    const serverCredits = PLAN_CREDITS[planType]?.[billingCycle]

    if (!serverCredits) {
      console.error('[Payment Verify] ❌ Invalid plan/billing:', planType, billingCycle)
      return corsResponse(
        NextResponse.json({ error: 'Invalid plan configuration' }, { status: 400 })
      )
    }

    // ── Cross-check: validate credits match order notes (if present) ──
    const orderNoteCredits = order.notes?.credits ? parseInt(order.notes.credits, 10) : null
    if (orderNoteCredits && orderNoteCredits !== serverCredits) {
      console.warn(`[Payment Verify] ⚠ Order notes credits (${orderNoteCredits}) ≠ plan credits (${serverCredits}). Using plan config.`)
    }

    const creditsToAdd = serverCredits

    console.log(`[Payment Verify] Awarding ${creditsToAdd} credits for ${planType}/${billingCycle}`)

    // ── Fetch current user ──
    const { data: user, error: fetchError } = await supabaseAdmin
      .from('users')
      .select('credits, subscription_status, subscription_plan')
      .eq('clerk_user_id', userId)
      .single()

    if (fetchError || !user) {
      console.error('[Payment Verify] ❌ User not found:', userId, fetchError)
      throw new Error('User not found')
    }

    const currentCredits = user.credits || 0
    const newCredits = currentCredits + creditsToAdd

    console.log('[Payment Verify] Credits:', currentCredits, '+', creditsToAdd, '=', newCredits)

    // ── Update user record ──
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({
        credits: newCredits,
        subscription_status: 'active',
        subscription_plan: planType,
        updated_at: new Date().toISOString(),
      })
      .eq('clerk_user_id', userId)

    if (updateError) {
      console.error('[Payment Verify] ❌ Failed to update credits:', updateError)
      throw new Error('Failed to update credits')
    }

    // ── Log transaction (audit trail + idempotency record) ──
    await logCreditTransaction({
      userId,
      amount: creditsToAdd,
      balanceAfter: newCredits,
      type: 'subscription_bonus',
      status: 'success',
      description: `Payment verified: +${creditsToAdd} credits (${planType} ${billingCycle})`,
      metadata: {
        razorpay_payment_id,
        razorpay_order_id,
        plan_type: planType,
        billing_cycle: billingCycle,
        order_amount: order.amount,
        order_currency: order.currency,
        previous_balance: currentCredits,
        credit_source: 'verify_route',
      },
    })

    console.log(`[Payment Verify] ✅ ${creditsToAdd} credits → ${userId} (${currentCredits} → ${newCredits})`)

    return corsResponse(
      NextResponse.json({
        success: true,
        message: 'Payment verified and credits added',
        creditsAdded: creditsToAdd,
        totalCredits: newCredits,
      })
    )

  } catch (error: any) {
    console.error('[Payment Verify] Error:', error)
    return corsResponse(
      NextResponse.json({ 
        error: 'Payment verification failed', 
        message: error.message 
      }, { status: 500 })
    )
  }
}
