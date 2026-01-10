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

    // Step 4: Find or create customer
    let customerId: string = ''

    // Try to find existing customer
    const searchUrl = `https://api.razorpay.com/v1/customers?email=${encodeURIComponent(userEmail)}`
    const searchRes = await fetch(searchUrl, {
      headers: { Authorization: `Basic ${authHeader}` }
    })

    if (searchRes.ok) {
      const searchData = await searchRes.json()
      if (searchData.items?.length > 0) {
        customerId = searchData.items[0].id
        console.log('[Subscription] Found existing customer:', customerId)
      }
    }

    // Create customer if not found
    if (!customerId) {
      console.log('[Subscription] Creating new customer')
      const createRes = await fetch('https://api.razorpay.com/v1/customers', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${authHeader}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: userEmail,
          fail_existing: '0'
        })
      })

      if (!createRes.ok) {
        const error = await createRes.text()
        console.error('[Subscription] Customer creation failed:', error)
        return corsResponse(
          NextResponse.json({ error: 'Failed to create customer' }, { status: 500 })
        )
      }

      const customer = await createRes.json()
      customerId = customer.id
      console.log('[Subscription] Created customer:', customerId)
    }

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

    if (!subRes.ok) {
      const error = await subRes.text()
      console.error('[Subscription] Subscription creation failed:', error)
      return corsResponse(
        NextResponse.json({ error: 'Failed to create subscription' }, { status: 500 })
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
