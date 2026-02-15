import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { logCreditTransaction } from '@/lib/credit-transactions'
import crypto from 'crypto'

/**
 * PayPal Webhook Handler
 * 
 * Processes PayPal subscription events:
 * - BILLING.SUBSCRIPTION.CREATED: Subscription created
 * - BILLING.SUBSCRIPTION.ACTIVATED: Subscription activated (charge user)
 * - BILLING.SUBSCRIPTION.CANCELLED: Subscription cancelled
 * - BILLING.SUBSCRIPTION.SUSPENDED: Payment failed
 * - BILLING.SUBSCRIPTION.EXPIRED: Subscription expired
 * 
 * Webhook URL: https://444radio.co.in/api/webhooks/paypal
 */

// Verify PayPal webhook signature
async function verifyWebhookSignature(
  req: NextRequest,
  webhookId: string,
  body: any
): Promise<boolean> {
  try {
    const authAlgo = req.headers.get('paypal-auth-algo')
    const certUrl = req.headers.get('paypal-cert-url')
    const transmissionId = req.headers.get('paypal-transmission-id')
    const transmissionSig = req.headers.get('paypal-transmission-sig')
    const transmissionTime = req.headers.get('paypal-transmission-time')

    if (!authAlgo || !certUrl || !transmissionId || !transmissionSig || !transmissionTime) {
      console.error('❌ Missing PayPal webhook headers')
      return false
    }

    // Verify with PayPal API
    const accessToken = await getPayPalAccessToken()
    
    const verifyResponse = await fetch(`https://api-m.paypal.com/v1/notifications/verify-webhook-signature`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        auth_algo: authAlgo,
        cert_url: certUrl,
        transmission_id: transmissionId,
        transmission_sig: transmissionSig,
        transmission_time: transmissionTime,
        webhook_id: webhookId,
        webhook_event: body
      })
    })

    const verifyData = await verifyResponse.json()
    return verifyData.verification_status === 'SUCCESS'
  } catch (error) {
    console.error('❌ PayPal signature verification error:', error)
    return false
  }
}

// Get PayPal access token
async function getPayPalAccessToken(): Promise<string> {
  const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID!
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET!
  
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
  
  const response = await fetch('https://api-m.paypal.com/v1/oauth2/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  })
  
  const data = await response.json()
  return data.access_token
}

export async function POST(req: NextRequest) {
  try {
    console.log('🔔 PayPal webhook received')
    
    const body = await req.json()
    const eventType = body.event_type
    
    console.log('📦 Event type:', eventType)
    console.log('📦 Event ID:', body.id)

    // Verify webhook signature (IMPORTANT for production)
    const webhookId = process.env.PAYPAL_WEBHOOK_ID
    if (webhookId) {
      const isValid = await verifyWebhookSignature(req, webhookId, body)
      if (!isValid) {
        console.error('❌ Invalid PayPal webhook signature')
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
      }
      console.log('✅ Webhook signature verified')
    } else {
      console.error('❌ PAYPAL_WEBHOOK_ID not set — rejecting webhook for security')
      return NextResponse.json({ error: 'Webhook verification not configured' }, { status: 500 })
    }

    // Extract subscription data
    const resource = body.resource
    const subscriptionId = resource.id
    const planId = resource.plan_id
    const subscriberEmail = resource.subscriber?.email_address
    const customId = resource.custom_id // We'll use this to store Clerk user ID

    console.log('📋 Subscription ID:', subscriptionId)
    console.log('📋 Plan ID:', planId)
    console.log('📋 Subscriber email:', subscriberEmail)
    console.log('📋 Custom ID (Clerk user ID):', customId)

    // Handle different event types
    switch (eventType) {
      case 'BILLING.SUBSCRIPTION.CREATED':
        console.log('✅ Subscription created (waiting for activation)')
        // Just log for now - actual credits granted on ACTIVATED
        break

      case 'BILLING.SUBSCRIPTION.ACTIVATED':
        console.log('🎉 Subscription activated - granting credits')
        
        // Determine credits based on plan (PayPal currently only supports Creator)
        let creditsToAdd = 0
        const planMapping: Record<string, number> = {
          [process.env.NEXT_PUBLIC_PAYPAL_CREATOR_PLAN_ID || '']: 167,  // Creator monthly: 167 credits
        }
        
        creditsToAdd = planMapping[planId] || 167 // Default to Creator monthly
        console.log('[PayPal] Credits for plan', planId, ':', creditsToAdd)

        // Find user by email if customId not provided
        let userId = customId
        if (!userId && subscriberEmail) {
          const { data: users } = await supabase
            .from('users')
            .select('clerk_user_id')
            .ilike('email', subscriberEmail)
            .limit(1)
          
          if (users && users.length > 0) {
            userId = users[0].clerk_user_id
          }
        }

        if (!userId) {
          console.error('❌ Cannot identify user - no custom_id or matching email')
          return NextResponse.json({ error: 'User not found' }, { status: 404 })
        }

        // ── Idempotency check: skip if this event was already processed ──
        {
          const idempotencyKey = `paypal_${body.id}`
          const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
          const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
          if (supabaseUrl && supabaseKey) {
            const checkRes = await fetch(
              `${supabaseUrl}/rest/v1/credit_transactions?user_id=eq.${userId}&metadata->>paypal_event_id=eq.${body.id}&limit=1`,
              { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
            )
            if (checkRes.ok) {
              const existing = await checkRes.json()
              if (existing.length > 0) {
                console.log('⚠️ PayPal event already processed (idempotency):', body.id)
                return NextResponse.json({ success: true, message: 'Already processed' })
              }
            }
          }
        }

        // Fetch current user data
        const { data: currentUser, error: fetchError } = await supabase
          .from('users')
          .select('credits')
          .eq('clerk_user_id', userId)
          .single()

        if (fetchError || !currentUser) {
          console.error('❌ Failed to fetch user:', fetchError)
          return NextResponse.json({ error: 'User not found' }, { status: 404 })
        }

        const newCredits = (currentUser.credits || 0) + creditsToAdd

        // Update user: add credits + set subscription status (same pattern as Razorpay)
        const { error: updateError } = await supabase
          .from('users')
          .update({
            credits: newCredits,
            subscription_status: 'active',
            subscription_plan: 'creator',
            paypal_subscription_id: subscriptionId,
            subscription_id: subscriptionId, // Store in same field as Razorpay for consistency
            updated_at: new Date().toISOString()
          })
          .eq('clerk_user_id', userId)

        if (updateError) {
          console.error('❌ Failed to update user:', updateError)
          return NextResponse.json({ error: 'Database update failed' }, { status: 500 })
        }

        // ── Log the credit transaction ──
        await logCreditTransaction({
          userId,
          amount: creditsToAdd,
          balanceAfter: newCredits,
          type: 'subscription_bonus',
          status: 'success',
          description: `PayPal subscription activated — Creator plan (+${creditsToAdd} credits)`,
          metadata: {
            paypal_event_id: body.id,
            paypal_subscription_id: subscriptionId,
            paypal_plan_id: planId,
            plan_type: 'creator',
            credit_source: 'paypal',
            previous_balance: currentUser.credits || 0,
          },
        })

        console.log(`✅ Successfully added ${creditsToAdd} credits to user ${userId} (total: ${newCredits})`)
        break

      case 'BILLING.SUBSCRIPTION.CANCELLED':
      case 'BILLING.SUBSCRIPTION.SUSPENDED':
      case 'BILLING.SUBSCRIPTION.EXPIRED':
        console.log(`⚠️  Subscription ${eventType.split('.').pop()?.toLowerCase()}`)
        
        // Update subscription status to cancelled/suspended
        const { error: cancelError } = await supabase
          .from('users')
          .update({
            subscription_status: eventType === 'BILLING.SUBSCRIPTION.CANCELLED' ? 'cancelled' : 'suspended',
            updated_at: new Date().toISOString()
          })
          .eq('paypal_subscription_id', subscriptionId)

        if (cancelError) {
          console.error('❌ Failed to update subscription status:', cancelError)
        }
        break

      case 'BILLING.SUBSCRIPTION.PAYMENT.FAILED':
        console.error('❌ Payment failed for subscription:', subscriptionId)
        // Optionally notify user or suspend account
        break

      default:
        console.log(`ℹ️  Unhandled event type: ${eventType}`)
    }

    return NextResponse.json({ 
      success: true,
      message: 'Webhook processed',
      eventType 
    })

  } catch (error: any) {
    console.error('❌ PayPal webhook error:', error)
    return NextResponse.json({ 
      error: 'Webhook processing failed',
      details: error.message 
    }, { status: 500 })
  }
}

// OPTIONS for CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, paypal-auth-algo, paypal-cert-url, paypal-transmission-id, paypal-transmission-sig, paypal-transmission-time'
    }
  })
}
