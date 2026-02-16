import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { corsResponse, handleOptions } from '@/lib/cors'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { logCreditTransaction } from '@/lib/credit-transactions'
import crypto from 'crypto'

export async function OPTIONS() {
  return handleOptions()
}

// ── Instant verification for wallet deposits ──
// Called from frontend after Razorpay Checkout completes.
// 1. Verifies HMAC signature
// 2. Deposits dollars to wallet_balance via deposit_wallet() RPC
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

    // ── Idempotency: check by payment_id ──
    const { data: existingTxn } = await supabaseAdmin
      .from('credit_transactions')
      .select('id')
      .eq('user_id', userId)
      .eq('type', 'wallet_deposit')
      .eq('status', 'success')
      .contains('metadata', { razorpay_payment_id })
      .limit(1)
      .maybeSingle()

    if (existingTxn) {
      console.warn('[Wallet Verify] ⏭ Already processed:', razorpay_payment_id)
      // Return current state
      const { data: user } = await supabaseAdmin
        .from('users')
        .select('credits, wallet_balance')
        .eq('clerk_user_id', userId)
        .single()
      return corsResponse(
        NextResponse.json({
          success: true,
          message: 'Already processed',
          alreadyProcessed: true,
          walletBalance: parseFloat(user?.wallet_balance || '0'),
          credits: user?.credits || 0,
        })
      )
    }

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

    // ── Also check if webhook already handled via order_id ──
    const { data: webhookTxn } = await supabaseAdmin
      .from('credit_transactions')
      .select('id')
      .eq('user_id', userId)
      .in('type', ['wallet_deposit', 'credit_award'])
      .eq('status', 'success')
      .contains('metadata', { order_id: razorpay_order_id })
      .limit(1)
      .maybeSingle()

    if (webhookTxn) {
      console.log('[Wallet Verify] ⏭ Webhook already processed this order')
      const { data: user } = await supabaseAdmin
        .from('users')
        .select('credits, wallet_balance')
        .eq('clerk_user_id', userId)
        .single()
      return corsResponse(
        NextResponse.json({
          success: true,
          message: 'Already processed by webhook',
          alreadyProcessed: true,
          walletBalance: parseFloat(user?.wallet_balance || '0'),
          credits: user?.credits || 0,
        })
      )
    }

    // ── Step 1: Deposit to wallet ──
    const { data: depositData, error: depositError } = await supabaseAdmin.rpc('deposit_wallet', {
      p_clerk_user_id: userId,
      p_amount_usd: depositUsd,
    })

    const depositRow = Array.isArray(depositData) ? depositData[0] : depositData
    if (depositError || !depositRow?.success) {
      console.error('[Wallet Verify] ❌ Deposit failed:', depositError || depositRow?.error_message)
      throw new Error(depositRow?.error_message || 'Wallet deposit failed')
    }

    console.log(`[Wallet Verify] ✅ Deposited $${depositUsd} → wallet=$${depositRow.new_balance}`)

    // Dollars stay in wallet — user converts to credits manually via /api/wallet/convert
    const finalWallet = parseFloat(depositRow.new_balance)

    // Fetch current credits for response
    const { data: currentUser } = await supabaseAdmin
      .from('users')
      .select('credits')
      .eq('clerk_user_id', userId)
      .single()
    const finalCredits = currentUser?.credits || 0

    // ── Log the deposit transaction with payment metadata ──
    // Note: razorpay_id + order_id must match the keys used by the webhook
    // handlers so cross-path idempotency checks work in both directions.
    await logCreditTransaction({
      userId,
      amount: 0,
      balanceAfter: finalCredits,
      type: 'wallet_deposit',
      status: 'success',
      description: `Wallet deposit: +$${depositUsd} → wallet $${finalWallet}`,
      metadata: {
        razorpay_id: razorpay_payment_id,
        razorpay_payment_id,
        razorpay_order_id,
        order_id: razorpay_order_id,
        order_amount: order.amount,
        order_currency: order.currency,
        deposit_usd: depositUsd,
        wallet_balance: finalWallet,
        credit_source: 'verify_route',
        purchase_type: 'wallet_deposit',
      },
    })

    console.log(`[Wallet Verify] ✅ Complete: ${userId} deposited $${depositUsd}, wallet=$${finalWallet}`)

    return corsResponse(
      NextResponse.json({
        success: true,
        depositUsd,
        creditsAdded: 0,
        walletBalance: finalWallet,
        credits: finalCredits,
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
