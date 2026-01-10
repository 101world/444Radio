import { auth, currentUser } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { corsResponse, handleOptions } from '@/lib/cors'

export async function OPTIONS() {
  return handleOptions()
}

export async function POST() {
  try {
    // Step 1: Authenticate user
    const { userId } = await auth()
    if (!userId) {
      return corsResponse(
        NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      )
    }

    // Step 2: Get user email
    const user = await currentUser()
    const userEmail = user?.emailAddresses?.[0]?.emailAddress

    if (!userEmail) {
      console.error('[Subscription] No email for user:', userId)
      return corsResponse(
        NextResponse.json({ error: 'Email not found' }, { status: 400 })
      )
    }

    console.log('[Subscription] Starting for user:', userId, 'email:', userEmail)

    // Step 3: Check credentials
    const keyId = process.env.RAZORPAY_KEY_ID
    const keySecret = process.env.RAZORPAY_KEY_SECRET
    const planId = process.env.RAZORPAY_CREATOR_PLAN_ID || 'plan_S2DGVK6J270rtt'

    if (!keyId || !keySecret) {
      console.error('[Subscription] Missing Razorpay credentials')
      return corsResponse(
        NextResponse.json({ error: 'Configuration error' }, { status: 500 })
      )
    }

    const authHeader = Buffer.from(`${keyId}:${keySecret}`).toString('base64')

    // Step 4: Get or create Razorpay customer (required for subscriptions)
    console.log('[Subscription] Getting Razorpay customer for:', userEmail)
    const customerRes = await fetch('https://api.razorpay.com/v1/customers', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${authHeader}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: userEmail,
        fail_existing: '0' // Returns existing customer if found
      })
    })

    console.log('[Subscription] Customer API status:', customerRes.status)

    if (!customerRes.ok) {
      const error = await customerRes.text()
      console.error('[Subscription] Customer API error:', error)
      console.error('[Subscription] Status:', customerRes.status)
      return corsResponse(
        NextResponse.json({ 
          error: 'Failed to setup payment account',
          status: customerRes.status,
          details: error
        }, { status: 500 })
      )
    }

    const customer = await customerRes.json()
    const customerId = customer.id
    console.log('[Subscription] Customer ready:', customerId)

    // Step 5: Create subscription
    console.log('[Subscription] Creating subscription with plan:', planId)
    const subRes = await fetch('https://api.razorpay.com/v1/subscriptions', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${authHeader}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        plan_id: planId,
        customer_id: customerId,
        total_count: 12,
        quantity: 1,
        customer_notify: 1,
        notes: {
          clerk_user_id: userId,
          email: userEmail
        }
      })
    })

    console.log('[Subscription] Subscription API status:', subRes.status)

    if (!subRes.ok) {
      const error = await subRes.text()
      console.error('[Subscription] Subscription API error:', error)
      console.error('[Subscription] Status:', subRes.status)
      return corsResponse(
        NextResponse.json({ 
          error: 'Failed to create subscription',
          status: subRes.status,
          details: error
        }, { status: 500 })
      )
    }

    const subscription = await subRes.json()
    console.log('[Subscription] Success! ID:', subscription.id)
    console.log('[Subscription] Payment URL:', subscription.short_url)

    // Step 6: Return payment URL
    return corsResponse(
      NextResponse.json({
        success: true,
        subscription_id: subscription.id,
        short_url: subscription.short_url,
        customer_id: customerId
      })
    )

  } catch (error: any) {
    console.error('[Subscription] Fatal error:', error)
    return corsResponse(
      NextResponse.json({ 
        error: 'Internal server error',
        message: error.message 
      }, { status: 500 })
    )
  }
}
