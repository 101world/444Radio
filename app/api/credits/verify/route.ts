import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { corsResponse, handleOptions } from '@/lib/cors'
import { supabaseAdmin } from '@/lib/supabase-admin'
import crypto from 'crypto'

export async function OPTIONS() {
  return handleOptions()
}

// ── Instant verification for wallet deposits ──
// Called from frontend after Razorpay Checkout completes.
// 1. Verifies HMAC signature
// 2. Deposits dollars to wallet_balance via deposit_wallet_safe() RPC (atomic — no double deposits)
// 3. Returns new wallet balance (user converts to credits manually via /api/wallet/convert)
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
    } = body

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return corsResponse(
        NextResponse.json({ error: 'Missing required payment fields' }, { status: 400 })
      )
    }

    console.log('[Wallet Verify] Processing:', { orderId: razorpay_order_id, paymentId: razorpay_payment_id })

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
      console.error('[Wallet Verify] ❌ Signature mismatch')
      return corsResponse(
        NextResponse.json({ error: 'Payment verification failed' }, { status: 400 })
      )
    }

    console.log('[Wallet Verify] ✅ Signature verified')

    // ── Fetch order from Razorpay API ──
    const authHeader = Buffer.from(`${keyId}:${keySecret}`).toString('base64')
    const orderRes = await fetch(`https://api.razorpay.com/v1/orders/${razorpay_order_id}`, {
      headers: { Authorization: `Basic ${authHeader}` },
    })

    if (!orderRes.ok) {
      console.error('[Wallet Verify] ❌ Failed to fetch order:', orderRes.status)
      throw new Error('Could not verify order with Razorpay')
    }

    const order = await orderRes.json()

    if (order.status !== 'paid') {
      console.error('[Wallet Verify] ❌ Order not paid:', order.status)
      return corsResponse(
        NextResponse.json({ error: 'Order has not been paid' }, { status: 400 })
      )
    }

    // ── Get deposit amount from order notes ──
    const depositUsd = parseFloat(order.notes?.deposit_usd)
    if (!depositUsd || depositUsd <= 0) {
      console.error('[Wallet Verify] ❌ No deposit_usd in order notes')
      return corsResponse(
        NextResponse.json({ error: 'Invalid order — no deposit amount' }, { status: 400 })
      )
    }

    // ── ATOMIC deposit via deposit_wallet_safe (locks user row + checks idempotency + deposits + logs in one transaction) ──
    const { data: depositData, error: depositError } = await supabaseAdmin.rpc('deposit_wallet_safe', {
      p_clerk_user_id: userId,
      p_amount_usd: depositUsd,
      p_order_id: razorpay_order_id,
      p_payment_id: razorpay_payment_id,
      p_description: `Wallet deposit: +$${depositUsd}`,
      p_metadata: {
        razorpay_order_id,
        order_amount: order.amount,
        order_currency: order.currency,
        credit_source: 'verify_route',
        purchase_type: 'wallet_deposit',
      },
    })

    const result = Array.isArray(depositData) ? depositData[0] : depositData
    if (depositError || !result?.success) {
      console.error('[Wallet Verify] ❌ Deposit failed:', depositError || result?.error_message)
      throw new Error(result?.error_message || 'Wallet deposit failed')
    }

    if (result.already_processed) {
      console.log('[Wallet Verify] ⏭ Already processed (webhook or duplicate):', razorpay_order_id)
    } else {
      console.log(`[Wallet Verify] ✅ Deposited $${depositUsd} → wallet=$${result.new_balance}`)
    }

    return corsResponse(
      NextResponse.json({
        success: true,
        depositUsd: result.already_processed ? 0 : depositUsd,
        creditsAdded: 0,
        walletBalance: parseFloat(result.new_balance),
        credits: result.credits || 0,
        alreadyProcessed: result.already_processed || false,
      })
    )
  } catch (error: any) {
    console.error('[Wallet Verify] Error:', error)
    return corsResponse(
      NextResponse.json({
        error: 'Payment verification failed',
        message: error.message
      }, { status: 500 })
    )
  }
}
