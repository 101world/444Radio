/**
 * Plugin Purchase Create Order API (Clerk-authed)
 * POST /api/plugin/purchase/create-order — Creates Razorpay order for settings page
 * 
 * Auth: Clerk session
 */

import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { corsResponse, handleOptions } from '@/lib/cors'

export async function OPTIONS() {
  return handleOptions()
}

export async function POST() {
  const { userId } = await auth()
  if (!userId) {
    return corsResponse(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  try {
    // Check if user already has a completed purchase
    const purchaseRes = await fetch(
      `${supabaseUrl}/rest/v1/plugin_purchases?clerk_user_id=eq.${encodeURIComponent(userId)}&status=eq.completed&select=id&limit=1`,
      { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` } }
    )
    const purchases = await purchaseRes.json()
    if (Array.isArray(purchases) && purchases.length > 0) {
      return corsResponse(NextResponse.json({ error: 'You already own the plugin!' }, { status: 409 }))
    }

    // Get user info for Razorpay prefill
    const userRes = await fetch(
      `${supabaseUrl}/rest/v1/users?clerk_user_id=eq.${encodeURIComponent(userId)}&select=email,username`,
      { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` } }
    )
    const users = await userRes.json()
    const user = Array.isArray(users) ? users[0] : null

    // Create Razorpay order
    const keyId = process.env.RAZORPAY_KEY_ID
    const keySecret = process.env.RAZORPAY_KEY_SECRET
    if (!keyId || !keySecret) {
      return corsResponse(NextResponse.json({ error: 'Payment system not configured' }, { status: 500 }))
    }

    const authB64 = Buffer.from(`${keyId}:${keySecret}`).toString('base64')
    const shortId = userId.slice(-8)
    const ts = Date.now().toString().slice(-8)

    const orderRes = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${authB64}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: 2500,
        currency: 'USD',
        receipt: `plug_${shortId}_${ts}`,
        notes: {
          clerk_user_id: userId,
          purchase_type: 'plugin_one_time',
          amount_display: '$25',
        },
      }),
    })

    const order = await orderRes.json()
    if (!orderRes.ok || !order.id) {
      console.error('[plugin/purchase/create-order] Order creation failed:', order)
      return corsResponse(NextResponse.json({ error: 'Could not create payment order' }, { status: 500 }))
    }

    // Insert pending purchase record
    await fetch(`${supabaseUrl}/rest/v1/plugin_purchases`, {
      method: 'POST',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({
        clerk_user_id: userId,
        order_id: order.id,
        amount: 2500,
        currency: 'USD',
        status: 'pending',
      }),
    })

    console.log('[plugin/purchase/create-order] ✅ Order:', order.id, 'user:', userId)

    return corsResponse(NextResponse.json({
      success: true,
      order_id: order.id,
      razorpay_key_id: keyId,
      amount: 2500,
      currency: 'USD',
      customer_email: user?.email || '',
      customer_name: user?.username || '',
    }))
  } catch (error: any) {
    console.error('[plugin/purchase/create-order] Error:', error)
    return corsResponse(NextResponse.json({ error: 'Purchase failed' }, { status: 500 }))
  }
}
