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

    // Step 2: Get user details
    const user = await currentUser()
    const userEmail = user?.emailAddresses?.[0]?.emailAddress

    if (!userEmail) {
      console.error('[Subscription] No email for user:', userId)
      return corsResponse(
        NextResponse.json({ error: 'Email not found' }, { status: 400 })
      )
    }

    console.log('[Subscription] Creating payment link for:', userId, userEmail)

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

    // Prepare customer name
    const customerName = user.firstName && user.lastName 
      ? `${user.firstName} ${user.lastName}`.trim()
      : user.firstName || user.username || userEmail.split('@')[0]

    // Step 4: Create standalone payment link (no pre-created subscription/customer)
    console.log('[Subscription] Creating standalone payment link for:', customerName)
    const linkRes = await fetch('https://api.razorpay.com/v1/payment_links', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${authHeader}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        amount: 45000, // ₹450
        currency: 'INR',
        accept_partial: false,
        description: `444Radio Creator Subscription for ${customerName}`,
        customer: {
          name: customerName,
          email: userEmail
        },
        notify: {
          sms: false,
          email: true
        },
        reminder_enable: true,
        notes: {
          clerk_user_id: userId,
          plan_id: planId,
          subscription_type: 'creator'
        },
        callback_url: 'https://444radio.co.in/profile',
        callback_method: 'get'
      })
    })

    console.log('[Subscription] Payment link API status:', linkRes.status)

    if (!linkRes.ok) {
      const error = await linkRes.text()
      console.error('[Subscription] Payment link error:', error)
      return corsResponse(
        NextResponse.json({ 
          error: 'Failed to create payment link',
          details: error
        }, { status: 500 })
      )
    }

    const link = await linkRes.json()
    console.log('[Subscription] Payment link created:', link.id)

    return corsResponse(
      NextResponse.json({
        success: true,
        short_url: link.short_url,
        payment_link_id: link.id
      })
    )

  } catch (error) {
    console.error('[Subscription] Unexpected error:', error)
    return corsResponse(
      NextResponse.json({ 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 })
    )
  }
}

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
    // CRITICAL FIX: Don't pass customer OR reference_id
    // reference_id links to subscription which has customer_id -> Razorpay pulls old name
    // Solution: Standalone payment link, track via notes, webhook links after payment
    console.log('[Subscription] Creating payment link...')
    console.log('[Subscription] For user:', customerName, userEmail)
    console.log('[Subscription] Subscription ID:', subscription.id)
    
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
        description: `444Radio Creator Plan for ${customerName}`,
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
          plan_id: planId,
          customer_id: customerId,
          customer_name: customerName,
          customer_email: userEmail
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
