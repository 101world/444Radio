import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { corsResponse, handleOptions } from '@/lib/cors'
import crypto from 'crypto'

export async function OPTIONS() {
  return handleOptions()
}

export async function POST(request: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return corsResponse(
        NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      )
    }

    const body = await request.json()
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      plan,
      billing,
      credits
    } = body

    console.log('[Payment Verify] Processing payment:', {
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      plan,
      billing,
      credits
    })

    // Verify signature
    const keySecret = process.env.RAZORPAY_KEY_SECRET
    if (!keySecret) {
      throw new Error('Razorpay key secret not configured')
    }

    const generatedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex')

    if (generatedSignature !== razorpay_signature) {
      console.error('[Payment Verify] Signature mismatch')
      return corsResponse(
        NextResponse.json({ error: 'Payment verification failed' }, { status: 400 })
      )
    }

    console.log('[Payment Verify] ✅ Signature verified')

    // Update user credits in Supabase
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase configuration missing')
    }

    // First, fetch current user credits
    const fetchRes = await fetch(
      `${supabaseUrl}/rest/v1/users?clerk_user_id=eq.${userId}&select=credits`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`
        }
      }
    )

    const users = await fetchRes.json()
    const currentCredits = users?.[0]?.credits || 0

    console.log('[Payment Verify] Current credits:', currentCredits, '+ Adding:', credits)

    // Add credits to existing balance
    const newCredits = currentCredits + credits
    
    const updateRes = await fetch(
      `${supabaseUrl}/rest/v1/users?clerk_user_id=eq.${userId}`,
      {
        method: 'PATCH',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
          credits: newCredits,
          subscription_status: 'active',
          subscription_plan: plan,
          subscription_updated_at: new Date().toISOString()
        })
      }
    )

    if (!updateRes.ok) {
      console.error('[Payment Verify] Failed to update credits')
      throw new Error('Failed to update credits')
    }

    console.log('[Payment Verify] ✅ Credits updated:', currentCredits, '→', newCredits)

    return corsResponse(
      NextResponse.json({
        success: true,
        message: 'Payment verified and credits added',
        creditsAdded: credits,
        totalCredits: newCredits
      })
    )

  } catch (error: any) {
    console.error('[Payment Verify] Error:', error)
    return corsResponse(
      NextResponse.json({ 
        error: 'Payment verification failed', 
        message: error.message 
      }, { status: 500 })
    )
  }
}
