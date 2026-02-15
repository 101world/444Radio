/**
 * Plugin Purchase API
 * POST /api/plugin/purchase — Creates a Razorpay order for $25 one-time plugin purchase
 * 
 * Auth: Bearer token (plugin token, NOT Clerk session)
 * The token must be valid structurally but can be from a denied_no_purchase user.
 */

import { NextRequest, NextResponse } from 'next/server'
import { corsResponse, handleOptions } from '@/lib/cors'

export async function OPTIONS() {
  return handleOptions()
}

export async function POST(req: NextRequest) {
  try {
    // Extract token — we only need the user identity, not full access check
    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return corsResponse(NextResponse.json({ error: 'No token provided' }, { status: 401 }))
    }
    const token = authHeader.substring(7).trim()
    if (!token || token.length < 32) {
      return corsResponse(NextResponse.json({ error: 'Invalid token' }, { status: 401 }))
    }

    // Look up token in DB to get clerk_user_id (don't use full validate — that would deny no_purchase users)
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
      return corsResponse(NextResponse.json({ error: 'Invalid or revoked token' }, { status: 401 }))
    }

    const clerkUserId = tokenRow.clerk_user_id

    // Check if user already has a completed purchase
    const purchaseRes = await fetch(`${supabaseUrl}/rest/v1/plugin_purchases?clerk_user_id=eq.${encodeURIComponent(clerkUserId)}&status=eq.completed&select=id&limit=1`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      }
    })
    const purchases = await purchaseRes.json()
    if (Array.isArray(purchases) && purchases.length > 0) {
      return corsResponse(NextResponse.json({ error: 'You already own the plugin!' }, { status: 409 }))
    }

    // Get user email for Razorpay prefill
    const userRes = await fetch(`${supabaseUrl}/rest/v1/users?clerk_user_id=eq.${encodeURIComponent(clerkUserId)}&select=email,username`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      }
    })
    const users = await userRes.json()
    const user = Array.isArray(users) ? users[0] : null

    // Create Razorpay Order for $25 plugin purchase
    const keyId = process.env.RAZORPAY_KEY_ID
    const keySecret = process.env.RAZORPAY_KEY_SECRET
    if (!keyId || !keySecret) {
      return corsResponse(NextResponse.json({ error: 'Payment system not configured' }, { status: 500 }))
    }

    const authB64 = Buffer.from(`${keyId}:${keySecret}`).toString('base64')
    const shortId = clerkUserId.slice(-8)
    const ts = Date.now().toString().slice(-8)

    const orderRes2 = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${authB64}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: 2500, // $25.00 in cents
        currency: 'USD',
        receipt: `plug_${shortId}_${ts}`,
        notes: {
          clerk_user_id: clerkUserId,
          purchase_type: 'plugin_one_time',
          amount_display: '$25',
        },
      }),
    })

    const order = await orderRes2.json()
    if (!orderRes2.ok || !order.id) {
      console.error('[plugin/purchase] Order creation failed:', order)
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
        clerk_user_id: clerkUserId,
        order_id: order.id,
        amount: 2500,
        currency: 'USD',
        status: 'pending',
      }),
    })

    console.log('[plugin/purchase] ✅ Order created:', order.id, 'for user:', clerkUserId)

    return corsResponse(NextResponse.json({
      success: true,
      orderId: order.id,
      amount: 2500,
      currency: 'USD',
      keyId,
      customerEmail: user?.email || '',
      customerName: user?.username || '',
    }))
  } catch (error: any) {
    console.error('[plugin/purchase] Error:', error)
    return corsResponse(NextResponse.json({ error: 'Purchase failed' }, { status: 500 }))
  }
}
