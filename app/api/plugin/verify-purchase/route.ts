/**
 * Plugin Purchase Verification API
 * POST /api/plugin/verify-purchase — Verifies Razorpay payment and records completed purchase
 * 
 * Auth: Bearer token (plugin token)
 */

import { NextRequest, NextResponse } from 'next/server'
import { corsResponse, handleOptions } from '@/lib/cors'
import { logCreditTransaction } from '@/lib/credit-transactions'
import crypto from 'crypto'

export async function OPTIONS() {
  return handleOptions()
}

export async function POST(req: NextRequest) {
  try {
    // Extract token
    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return corsResponse(NextResponse.json({ error: 'No token provided' }, { status: 401 }))
    }
    const token = authHeader.substring(7).trim()

    // Look up user from token
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

    const tokenRes = await fetch(`${supabaseUrl}/rest/v1/plugin_tokens?token=eq.${encodeURIComponent(token)}&is_active=eq.true&select=clerk_user_id`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      }
    })
    const tokens = await tokenRes.json()
    const tokenRow = Array.isArray(tokens) ? tokens[0] : null
    if (!tokenRow?.clerk_user_id) {
      return corsResponse(NextResponse.json({ error: 'Invalid token' }, { status: 401 }))
    }

    const clerkUserId = tokenRow.clerk_user_id

    // Parse payment details
    const body = await req.json()
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return corsResponse(NextResponse.json({ error: 'Missing payment details' }, { status: 400 }))
    }

    // Verify HMAC signature
    const keySecret = process.env.RAZORPAY_KEY_SECRET
    if (!keySecret) {
      return corsResponse(NextResponse.json({ error: 'Payment system error' }, { status: 500 }))
    }

    const generatedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex')

    if (generatedSignature !== razorpay_signature) {
      console.error('[plugin/verify-purchase] ❌ Signature mismatch for order:', razorpay_order_id)
      return corsResponse(NextResponse.json({ error: 'Payment verification failed' }, { status: 400 }))
    }

    // Update the purchase record to completed
    const updateRes = await fetch(`${supabaseUrl}/rest/v1/plugin_purchases?order_id=eq.${encodeURIComponent(razorpay_order_id)}&clerk_user_id=eq.${encodeURIComponent(clerkUserId)}`, {
      method: 'PATCH',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
      },
      body: JSON.stringify({
        payment_id: razorpay_payment_id,
        status: 'completed',
        updated_at: new Date().toISOString(),
      }),
    })

    const updated = await updateRes.json()
    
    if (!updateRes.ok || !Array.isArray(updated) || updated.length === 0) {
      // No matching pending purchase — insert a new completed record as fallback
      console.warn('[plugin/verify-purchase] No pending purchase found, inserting directly')
      await fetch(`${supabaseUrl}/rest/v1/plugin_purchases`, {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({
          clerk_user_id: clerkUserId,
          order_id: razorpay_order_id,
          payment_id: razorpay_payment_id,
          amount: 2500,
          currency: 'USD',
          status: 'completed',
        }),
      })
    }

    console.log('[plugin/verify-purchase] ✅ Purchase completed for user:', clerkUserId, 'order:', razorpay_order_id)

    // Log in credit_transactions for wallet visibility + admin tracking
    await logCreditTransaction({
      userId: clerkUserId,
      amount: 0, // No credits added — this is a product purchase, not credits
      type: 'plugin_purchase',
      status: 'success',
      description: 'Plugin one-time purchase — $25 USD — unlimited access',
      metadata: {
        razorpay_order_id,
        razorpay_payment_id,
        amount_cents: 2500,
        currency: 'USD',
        product: 'plugin_unlimited',
      },
    })

    return corsResponse(NextResponse.json({
      success: true,
      message: 'Plugin purchased successfully! You now have unlimited access.',
    }))
  } catch (error: any) {
    console.error('[plugin/verify-purchase] Error:', error)
    return corsResponse(NextResponse.json({ error: 'Verification failed' }, { status: 500 }))
  }
}
