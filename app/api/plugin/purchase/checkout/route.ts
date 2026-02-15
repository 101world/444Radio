/**
 * Plugin Purchase Checkout API
 * POST /api/plugin/purchase/checkout
 * Auth: Clerk session
 *
 * Creates a Razorpay order for the $4 one-time plugin purchase.
 * After payment, client calls /api/plugin/purchase/verify to confirm.
 */

import { auth, currentUser } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { corsResponse, handleOptions } from '@/lib/cors'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function OPTIONS() {
  return handleOptions()
}

// Plugin price in each currency (one-time)
const PLUGIN_PRICE = {
  INR: 340,   // ~$4 USD
  USD: 4,
}

export async function POST(request: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return corsResponse(
        NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      )
    }

    const user = await currentUser()
    const userEmail = user?.emailAddresses?.[0]?.emailAddress

    if (!userEmail) {
      return corsResponse(
        NextResponse.json({ error: 'Email not found' }, { status: 400 })
      )
    }

    // Check if user already has a purchase
    const { data: existing } = await supabaseAdmin
      .from('plugin_purchases')
      .select('id')
      .eq('clerk_user_id', userId)
      .eq('status', 'completed')
      .limit(1)
      .maybeSingle()

    if (existing) {
      return corsResponse(
        NextResponse.json({ error: 'You already own the plugin!' }, { status: 409 })
      )
    }

    const body = await request.json()
    const currency = (body.currency || 'USD') as 'INR' | 'USD'
    const price = PLUGIN_PRICE[currency]

    if (!price) {
      return corsResponse(
        NextResponse.json({ error: 'Invalid currency' }, { status: 400 })
      )
    }

    const keyId = process.env.RAZORPAY_KEY_ID
    const keySecret = process.env.RAZORPAY_KEY_SECRET

    if (!keyId || !keySecret) {
      return corsResponse(
        NextResponse.json({ error: 'Payment configuration error' }, { status: 500 })
      )
    }

    const authHeader = Buffer.from(`${keyId}:${keySecret}`).toString('base64')
    const customerName = user.firstName && user.lastName
      ? `${user.firstName} ${user.lastName}`.trim()
      : user.firstName || user.username || userEmail.split('@')[0]

    const shortUserId = userId.slice(-8)
    const timestamp = Date.now().toString().slice(-8)
    const shortReceipt = `plg_${shortUserId}_${timestamp}`

    const orderPayload = {
      amount: price * 100, // paise/cents
      currency,
      receipt: shortReceipt,
      notes: {
        clerk_user_id: userId,
        customer_name: customerName,
        type: 'plugin_purchase',
        amount_usd: '25.00',
      },
    }

    console.log('[Plugin Purchase] Creating order:', orderPayload)

    const orderRes = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${authHeader}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(orderPayload),
    })

    const order = await orderRes.json()

    if (!orderRes.ok || !order.id) {
      console.error('[Plugin Purchase] Order creation failed:', order)
      return corsResponse(
        NextResponse.json({
          error: order.error?.description || 'Order creation failed',
          razorpay_error: order.error?.code || 'UNKNOWN',
        }, { status: 500 })
      )
    }

    console.log('[Plugin Purchase] ✅ Order created:', order.id)

    return corsResponse(
      NextResponse.json({
        success: true,
        orderId: order.id,
        amount: price * 100,
        currency,
        keyId,
        customerName,
        customerEmail: userEmail,
        type: 'plugin_purchase',
      })
    )
  } catch (error: any) {
    console.error('[Plugin Purchase] Error:', error)
    return corsResponse(
      NextResponse.json({ error: 'Checkout creation failed', message: error.message }, { status: 500 })
    )
  }
}
