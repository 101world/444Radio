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
    console.log('[Subscription] User name:', user.firstName, user.lastName, user.username)

    // Step 3: Check credentials
    const keyId = process.env.RAZORPAY_KEY_ID
    const keySecret = process.env.RAZORPAY_KEY_SECRET
    const planId = process.env.RAZORPAY_CREATOR_PLAN_ID || 'plan_S2DGVK6J270rtt'

    console.log('[Subscription] Key ID (first 10 chars):', keyId?.substring(0, 10))
    console.log('[Subscription] Key Secret exists:', !!keySecret)
    console.log('[Subscription] Plan ID:', planId)

    if (!keyId || !keySecret) {
      console.error('[Subscription] Missing Razorpay credentials')
      return corsResponse(
        NextResponse.json({ error: 'Configuration error' }, { status: 500 })
      )
    }

    const authHeader = Buffer.from(`${keyId}:${keySecret}`).toString('base64')
    console.log('[Subscription] Auth header (first 20 chars):', authHeader.substring(0, 20))

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

    // Update customer name (in case it's an old customer with wrong name)
    const customerName = user.firstName && user.lastName 
      ? `${user.firstName} ${user.lastName}`.trim()
      : user.firstName || user.username || userEmail.split('@')[0]
    
    console.log('[Subscription] Updating customer name to:', customerName)
    
    await fetch(`https://api.razorpay.com/v1/customers/${customerId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Basic ${authHeader}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: customerName,
        email: userEmail
      })
    })

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
        addons: [],
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

    // Step 6: Create payment link for subscription
    console.log('[Subscription] Creating payment link...')
    
    const linkRes = await fetch('https://api.razorpay.com/v1/payment_links', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${authHeader}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        amount: 45000, // ₹450 in paise
        currency: 'INR',
        accept_partial: false,
        description: 'Creator 444 Monthly Subscription',
        customer_id: customerId,
        notify: {
          sms: false,
          email: true
        },
        reminder_enable: true,
        callback_url: 'https://444radio.co.in/library',
        callback_method: 'get',
        notes: {
          subscription_id: subscription.id,
          clerk_user_id: userId,
          plan_id: planId
        }
      })
    })

    if (!linkRes.ok) {
      const error = await linkRes.text()
      console.error('[Subscription] Payment link creation failed:', error)
      return corsResponse(
        NextResponse.json({ 
          error: 'Failed to create payment link',
          details: error
        }, { status: 500 })
      )
    }

    const paymentLink = await linkRes.json()
    console.log('[Subscription] Payment link created:', paymentLink.short_url)

    // Return payment link URL
    return corsResponse(
      NextResponse.json({
        success: true,
        subscription_id: subscription.id,
        short_url: paymentLink.short_url,
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
