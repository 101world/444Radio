import { auth, currentUser } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { corsResponse, handleOptions } from '@/lib/cors'

export async function OPTIONS() {
  return handleOptions()
}

// Plan configuration for both INR and USD (Razorpay Checkout with instant verification)
// Credit allocation: 1 credit = $0.03 retail value
// Formula: Price / 0.03 = Credits (rounded up)
const PLANS = {
  INR: {
    creator: {
      monthly: { credits: 167, price: 450 },      // $5 / $0.03 = 166.66 → 167 credits (83 songs)
      annual: { credits: 1667, price: 4420 }      // $50 / $0.03 = 1666.66 → 1667 credits
    },
    pro: {
      monthly: { credits: 535, price: 1355 },     // $16 / $0.03 = 533.33 → 535 credits (267 songs)
      annual: { credits: 5167, price: 13090 }     // $155 / $0.03 = 5166.66 → 5167 credits
    },
    studio: {
      monthly: { credits: 1235, price: 3160 },    // $37 / $0.03 = 1233.33 → 1235 credits (617 songs)
      annual: { credits: 11967, price: 30330 }    // $359 / $0.03 = 11966.66 → 11967 credits
    }
  },
  USD: {
    creator: {
      monthly: { credits: 167, price: 5 },        // $5 / $0.03 = 166.66 → 167 credits (83 songs)
      annual: { credits: 1667, price: 50 }        // $50 / $0.03 = 1666.66 → 1667 credits
    },
    pro: {
      monthly: { credits: 535, price: 16 },       // $16 / $0.03 = 533.33 → 535 credits (267 songs)
      annual: { credits: 5167, price: 155 }       // $155 / $0.03 = 5166.66 → 5167 credits
    },
    studio: {
      monthly: { credits: 1235, price: 37 },      // $37 / $0.03 = 1233.33 → 1235 credits (617 songs)
      annual: { credits: 11967, price: 359 }      // $359 / $0.03 = 11966.66 → 11967 credits
    }
  }
} as const

export async function POST(request: Request) {
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

    const body = await request.json()
    const planType = (body.plan || 'creator') as 'creator' | 'pro' | 'studio'
    const billing = (body.billing || 'monthly') as 'monthly' | 'annual'
    const currency = (body.currency || 'USD') as 'INR' | 'USD'
    
    const planConfig = PLANS[currency]?.[planType]?.[billing]
    
    if (!planConfig) {
      return corsResponse(
        NextResponse.json({ error: 'Invalid plan or currency' }, { status: 400 })
      )
    }

    console.log(`[Checkout] Creating ${currency} checkout for ${planType} ${billing}:`, userId, userEmail)

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

    // Create short receipt (max 40 chars) - use last 8 chars of userId + timestamp
    const shortUserId = userId.slice(-8)
    const timestamp = Date.now().toString().slice(-8) // Last 8 digits
    const shortReceipt = `ord_${shortUserId}_${timestamp}` // ~25 chars

    // Create Razorpay Order for checkout
    const orderPayload = {
      amount: planConfig.price * 100, // Convert to smallest currency unit (cents/paise)
      currency: currency,
      receipt: shortReceipt,
      notes: {
        clerk_user_id: userId,
        customer_name: customerName,
        plan_type: planType,
        billing_cycle: billing,
        credits: planConfig.credits.toString()
      }
    }

    console.log('[Checkout] Creating order with payload:', orderPayload)

    const orderRes = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${authHeader}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(orderPayload)
    })

    const order = await orderRes.json()
    
    console.log('[Checkout] Razorpay response status:', orderRes.status)
    console.log('[Checkout] Razorpay response:', order)

    if (!orderRes.ok || !order.id) {
      console.error('[Checkout] Order creation failed:', {
        status: orderRes.status,
        error: order.error || order,
        description: order.error?.description
      })
      return corsResponse(
        NextResponse.json({ 
          error: order.error?.description || 'Order creation failed',
          razorpay_error: order.error?.code || 'UNKNOWN',
          details: order 
        }, { status: 500 })
      )
    }

    console.log('[Checkout] ✅ Order created:', order.id)

    // Return order details for frontend Razorpay Checkout
    return corsResponse(
      NextResponse.json({
        success: true,
        orderId: order.id,
        amount: planConfig.price * 100,
        currency: currency,
        keyId: keyId,
        customerName: customerName,
        customerEmail: userEmail,
        plan: planType,
        billing,
        credits: planConfig.credits
      })
    )

  } catch (error: any) {
    console.error('[Checkout] Error:', error)
    return corsResponse(
      NextResponse.json({ 
        error: 'Checkout creation failed', 
        message: error.message 
      }, { status: 500 })
    )
  }
}
