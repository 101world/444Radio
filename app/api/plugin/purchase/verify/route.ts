/**
 * Plugin Purchase Verify API
 * POST /api/plugin/purchase/verify
 * Auth: Clerk session
 *
 * Verifies Razorpay payment signature and records the $25 one-time plugin purchase.
 * Inserts into plugin_purchases + credit_transactions for audit trail.
 */

import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { corsResponse, handleOptions } from '@/lib/cors'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function OPTIONS() {
  return handleOptions()
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
    } = body

    // Validate required fields
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return corsResponse(
        NextResponse.json({ error: 'Missing required payment fields' }, { status: 400 })
      )
    }

    console.log('[Plugin Purchase Verify] Processing:', {
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      userId,
    })

    // Verify HMAC signature
    const keySecret = process.env.RAZORPAY_KEY_SECRET
    if (!keySecret) {
      throw new Error('Razorpay credentials not configured')
    }

    const generatedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex')

    if (generatedSignature !== razorpay_signature) {
      console.error('[Plugin Purchase Verify] ❌ Signature mismatch')
      return corsResponse(
        NextResponse.json({ error: 'Payment verification failed' }, { status: 400 })
      )
    }

    console.log('[Plugin Purchase Verify] ✅ Signature verified')

    // Idempotency: check if this payment_id was already processed
    const { data: existingPurchase } = await supabaseAdmin
      .from('plugin_purchases')
      .select('id')
      .eq('payment_id', razorpay_payment_id)
      .limit(1)
      .maybeSingle()

    if (existingPurchase) {
      console.log('[Plugin Purchase Verify] ⚠️ Already processed:', razorpay_payment_id)
      return corsResponse(
        NextResponse.json({ success: true, message: 'Already purchased', alreadyProcessed: true })
      )
    }

    // Also check if user already has a completed purchase
    const { data: existingUserPurchase } = await supabaseAdmin
      .from('plugin_purchases')
      .select('id')
      .eq('clerk_user_id', userId)
      .eq('status', 'completed')
      .limit(1)
      .maybeSingle()

    if (existingUserPurchase) {
      console.log('[Plugin Purchase Verify] ⚠️ User already owns plugin:', userId)
      return corsResponse(
        NextResponse.json({ success: true, message: 'Already owned', alreadyProcessed: true })
      )
    }

    // Insert into plugin_purchases table
    const { error: purchaseError } = await supabaseAdmin
      .from('plugin_purchases')
      .insert({
        clerk_user_id: userId,
        payment_id: razorpay_payment_id,
        payment_method: 'razorpay',
        amount_usd: 25.00,
        status: 'completed',
        platform: 'all',
      })

    if (purchaseError) {
      console.error('[Plugin Purchase Verify] ❌ Insert failed:', purchaseError)
      return corsResponse(
        NextResponse.json({ error: 'Failed to record purchase' }, { status: 500 })
      )
    }

    // Log to credit_transactions for audit trail (column is user_id, not clerk_user_id)
    const { error: txnError } = await supabaseAdmin
      .from('credit_transactions')
      .insert({
        user_id: userId,
        type: 'plugin_purchase',
        amount: 0, // No credits involved — this is a feature unlock
        balance_after: 0,
        description: 'Plugin one-time purchase ($25 USD)',
        metadata: {
          razorpay_order_id,
          razorpay_payment_id,
          amount_usd: 25.00,
          currency: 'USD',
          product: 'vst3_plugin_license',
        },
      })

    if (txnError) {
      // Non-fatal — purchase is already recorded
      console.warn('[Plugin Purchase Verify] ⚠️ Transaction log failed:', txnError)
    }

    console.log('[Plugin Purchase Verify] ✅ Purchase recorded for user:', userId)

    return corsResponse(
      NextResponse.json({
        success: true,
        message: 'Plugin purchased successfully! You now have unlimited access.',
      })
    )
  } catch (error: any) {
    console.error('[Plugin Purchase Verify] Error:', error)
    return corsResponse(
      NextResponse.json({ error: 'Verification failed', message: error.message }, { status: 500 })
    )
  }
}
