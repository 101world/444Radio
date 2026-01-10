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

    if (!keyId || !keySecret) {
      return corsResponse(
        NextResponse.json({ error: 'Configuration error' }, { status: 500 })
      )
    }

    const authHeader = Buffer.from(`${keyId}:${keySecret}`).toString('base64')
    const customerName = user.firstName && user.lastName 
      ? `${user.firstName} ${user.lastName}`.trim()
      : user.firstName || user.username || userEmail.split('@')[0]

    console.log('[Payment] Creating standalone payment for:', customerName, userEmail)

    // Create ONLY payment link (no subscription yet - create in webhook after payment)
    const linkRes = await fetch('https://api.razorpay.com/v1/payment_links', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${authHeader}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        amount: 45000,
        currency: 'INR',
        description: `444Radio Creator Subscription - ${customerName}`,
        notify: {
          email: true
        },
        notes: {
          clerk_user_id: userId,
          user_email: userEmail,
          user_name: customerName,
          plan_type: 'creator'
        },
        callback_url: 'https://444radio.co.in/profile',
        callback_method: 'get'
      })
    })

    if (!linkRes.ok) {
      const error = await linkRes.text()
      console.error('[Payment] Failed:', error)
      return corsResponse(
        NextResponse.json({ error: 'Payment creation failed', details: error }, { status: 500 })
      )
    }

    const link = await linkRes.json()
    console.log('[Payment] Created:', link.short_url)

    return corsResponse(
      NextResponse.json({
        success: true,
        short_url: link.short_url
      })
    )

  } catch (error) {
    console.error('[Payment] Error:', error)
    return corsResponse(
      NextResponse.json({ 
        error: 'Internal error',
        details: error instanceof Error ? error.message : 'Unknown'
      }, { status: 500 })
    )
  }
}
