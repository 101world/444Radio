import { auth, currentUser } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { corsResponse, handleOptions } from '@/lib/cors'

export async function OPTIONS() {
  return handleOptions()
}

export async function POST() {
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

    const keyId = process.env.RAZORPAY_KEY_ID
    const keySecret = process.env.RAZORPAY_KEY_SECRET
    const planId = 'plan_S2DGVK6J270rtt' // Creator 444 plan

    if (!keyId || !keySecret) {
      return corsResponse(
        NextResponse.json({ error: 'Configuration error' }, { status: 500 })
      )
    }

    const authHeader = Buffer.from(`${keyId}:${keySecret}`).toString('base64')
    const customerName = user.firstName && user.lastName 
      ? `${user.firstName} ${user.lastName}`.trim()
      : user.firstName || user.username || userEmail.split('@')[0]

    console.log('[Subscription] Creating for:', customerName, userEmail)

    // Step 1: Create NEW customer (fresh, no reuse)
    const custRes = await fetch('https://api.razorpay.com/v1/customers', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${authHeader}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: customerName,
        email: userEmail,
        fail_existing: '1' // Create new customer every time
      })
    })

    if (!custRes.ok) {
      const error = await custRes.text()
      console.error('[Subscription] Customer creation failed:', error)
      return corsResponse(
        NextResponse.json({ error: 'Customer creation failed', details: error }, { status: 500 })
      )
    }

    const customer = await custRes.json()
    console.log('[Subscription] Customer created:', customer.id)

    // Step 2: Create subscription
    const subRes = await fetch('https://api.razorpay.com/v1/subscriptions', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${authHeader}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        plan_id: planId,
        customer_id: customer.id,
        quantity: 1,
        total_count: 12,
        customer_notify: 1,
        notes: {
          clerk_user_id: userId
        }
      })
    })

    if (!subRes.ok) {
      const error = await subRes.text()
      console.error('[Subscription] Subscription creation failed:', error)
      return corsResponse(
        NextResponse.json({ error: 'Subscription creation failed', details: error }, { status: 500 })
      )
    }

    const subscription = await subRes.json()
    console.log('[Subscription] Created:', subscription.id)

    return corsResponse(
      NextResponse.json({
        success: true,
        short_url: subscription.short_url
      })
    )

  } catch (error) {
    console.error('[Subscription] Error:', error)
    return corsResponse(
      NextResponse.json({ 
        error: 'Internal error',
        details: error instanceof Error ? error.message : 'Unknown'
      }, { status: 500 })
    )
  }
}
