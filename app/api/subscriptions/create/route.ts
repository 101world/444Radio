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

    // Step 1: Get or create customer
    const custRes = await fetch('https://api.razorpay.com/v1/customers', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${authHeader}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: customerName,
        email: userEmail,
        fail_existing: '0' // Return existing customer if email exists
      })
    })

    if (!custRes.ok) {
      const error = await custRes.text()
      console.error('[Subscription] Customer error:', error)
      return corsResponse(
        NextResponse.json({ error: 'Customer error', details: error }, { status: 500 })
      )
    }

    const customer = await custRes.json()
    console.log('[Subscription] Customer:', customer.id)

    // Step 2: Update customer name (in case it's an old customer with wrong name)
    await fetch(`https://api.razorpay.com/v1/customers/${customer.id}`, {
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

    // Step 3: Create subscription
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

    // Step 4: Create payment link for the subscription
    const linkRes = await fetch('https://api.razorpay.com/v1/payment_links', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${authHeader}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        amount: 45000,
        currency: 'INR',
        description: `444Radio Creator - ${customerName}`,
        customer: {
          name: customerName,
          email: userEmail
        },
        notify: {
          email: true
        },
        reminder_enable: true,
        notes: {
          subscription_id: subscription.id,
          clerk_user_id: userId
        },
        callback_url: 'https://444radio.co.in/profile',
        callback_method: 'get'
      })
    })

    if (!linkRes.ok) {
      const error = await linkRes.text()
      console.error('[Subscription] Payment link failed:', error)
      return corsResponse(
        NextResponse.json({ error: 'Payment link creation failed', details: error }, { status: 500 })
      )
    }

    const link = await linkRes.json()
    console.log('[Subscription] Payment link:', link.short_url)

    return corsResponse(
      NextResponse.json({
        success: true,
        short_url: link.short_url
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
