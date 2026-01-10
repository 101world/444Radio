import { auth, currentUser } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { corsResponse, handleOptions } from '@/lib/cors'

export async function OPTIONS() {
  return handleOptions()
}

export async function POST(request: Request) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return corsResponse(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
    }

    // Get user email from Clerk
    const user = await currentUser()
    
    if (!user?.emailAddresses?.[0]?.emailAddress) {
      console.error('[Create Subscription] No email found for user:', userId)
      return corsResponse(NextResponse.json({ error: 'Email not found' }, { status: 400 }))
    }

    const userEmail = user.emailAddresses[0].emailAddress

    // Razorpay credentials
    const razorpayAuth = Buffer.from(
      `${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`
    ).toString('base64')

    console.log('[Create Subscription] User:', userId, 'Email:', userEmail)

    // Step 1: Create or fetch customer
    let customerId: string | undefined

    // Try to find existing customer by email
    const searchResponse = await fetch(
      `https://api.razorpay.com/v1/customers?email=${encodeURIComponent(userEmail)}`,
      {
        headers: {
          'Authorization': `Basic ${razorpayAuth}`
        }
      }
    )

    if (searchResponse.ok) {
      const searchData = await searchResponse.json()
      if (searchData.items && searchData.items.length > 0) {
        customerId = searchData.items[0].id
        console.log('[Create Subscription] Found existing customer:', customerId)
      }
    }

    // Create customer if not found
    if (!customerId) {
      const createCustomerResponse = await fetch(
        'https://api.razorpay.com/v1/customers',
        {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${razorpayAuth}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            email: userEmail,
            fail_existing: '0' // Don't fail if customer already exists
          })
        }
      )

      if (!createCustomerResponse.ok) {
        const error = await createCustomerResponse.text()
        console.error('[Create Subscription] Customer creation failed:', error)
        return corsResponse(NextResponse.json({ 
          error: 'Failed to create customer',
          details: error 
        }, { status: 500 }))
      }

      const customerData = await createCustomerResponse.json()
      customerId = customerData.id
      console.log('[Create Subscription] Created new customer:', customerId)
    }

    // Step 2: Create subscription
    const planId = process.env.RAZORPAY_CREATOR_PLAN_ID || 'plan_S2DGVK6J270rtt'
    
    const subscriptionResponse = await fetch(
      'https://api.razorpay.com/v1/subscriptions',
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${razorpayAuth}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          plan_id: planId,
          customer_id: customerId,
          total_count: 12, // 12 months
          quantity: 1,
          customer_notify: 1,
          notes: {
            clerk_user_id: userId,
            email: userEmail
          }
        })
      }
    )

    if (!subscriptionResponse.ok) {
      const error = await subscriptionResponse.text()
      console.error('[Create Subscription] Subscription creation failed:', error)
      return corsResponse(NextResponse.json({ 
        error: 'Failed to create subscription',
        details: error 
      }, { status: 500 }))
    }

    const subscriptionData = await subscriptionResponse.json()
    console.log('[Create Subscription] Created subscription:', subscriptionData.id)

    // Return the short URL for payment
    return corsResponse(NextResponse.json({
      success: true,
      subscription_id: subscriptionData.id,
      short_url: subscriptionData.short_url,
      customer_id: customerId
    }))

  } catch (error: any) {
    console.error('[Create Subscription] Error:', error)
    return corsResponse(NextResponse.json({ 
      error: error.message,
      details: error.stack 
    }, { status: 500 }))
  }
}
