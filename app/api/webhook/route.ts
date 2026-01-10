import { Webhook } from 'svix'
import { headers } from 'next/headers'
import { WebhookEvent } from '@clerk/nextjs/server'
import { supabase } from '../../../lib/supabase'
import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  // Check for special admin fix request
  const url = new URL(req.url)
  if (url.searchParams.get('fix_subscriptions') === 'true') {
    console.log('[ADMIN] Running subscription plan fix...')
    return fixSubscriptionPlans()
  }
  
  // Check if it's a Razorpay webhook (has x-razorpay-signature header)
  const razorpaySignature = req.headers.get('x-razorpay-signature')
  
  if (razorpaySignature) {
    console.log('[SHARED WEBHOOK] Razorpay webhook detected')
    return handleRazorpayWebhook(req, razorpaySignature)
  }
  
  // Otherwise, handle as Clerk webhook
  console.log('[SHARED WEBHOOK] Clerk webhook detected')
  return handleClerkWebhook(req)
}

async function fixSubscriptionPlans() {
  try {
    // Get all active subscriptions
    const { data: users, error: fetchError } = await supabaseAdmin
      .from('users')
      .select('clerk_user_id, subscription_plan, subscription_id')
      .eq('subscription_status', 'active')

    if (fetchError) throw fetchError

    const usersToFix = users?.filter(u => 
      u.subscription_plan && (
        u.subscription_plan.startsWith('sub_') || 
        u.subscription_plan.startsWith('plan_')
      )
    ) || []

    console.log(`[FIX] Found ${usersToFix.length} users to fix`)

    let fixed = 0
    for (const user of usersToFix) {
      const subId = (user.subscription_id || '').toLowerCase()
      const planId = (user.subscription_plan || '').toLowerCase()
      let planType = 'creator' // default

      // Determine plan type from subscription_id OR subscription_plan (which might have plan_id)
      const combinedId = `${subId} ${planId}`
      
      if (combinedId.includes('studio') || combinedId.includes('s2di') || combinedId.includes('s2do')) {
        planType = 'studio'
      } else if (combinedId.includes('pro') || combinedId.includes('s2dh') || combinedId.includes('s2dn')) {
        planType = 'pro'
      } else if (combinedId.includes('creator') || combinedId.includes('s2dg') || combinedId.includes('s2dj')) {
        planType = 'creator'
      }

      // Update the user
      const { error: updateError } = await supabaseAdmin
        .from('users')
        .update({ subscription_plan: planType })
        .eq('clerk_user_id', user.clerk_user_id)

      if (!updateError) {
        console.log(`[FIX] ✅ ${user.clerk_user_id}: ${user.subscription_plan} → ${planType} (from: ${subId.substring(0, 15)}, ${planId.substring(0, 15)})`)
        fixed++
      } else {
        console.error(`[FIX] ❌ ${user.clerk_user_id}:`, updateError)
      }
    }

    return new Response(JSON.stringify({
      success: true,
      message: `Fixed ${fixed} out of ${usersToFix.length} users`,
      fixed,
      total: usersToFix.length
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error: any) {
    console.error('[FIX] Error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

async function handleRazorpayWebhook(req: Request, signature: string) {
  try {
    const body = await req.text()
    
    // Verify signature
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET!)
      .update(body)
      .digest('hex')

    if (signature !== expectedSignature) {
      console.error('[Razorpay] Invalid signature')
      return new Response('Invalid signature', { status: 401 })
    }

    const event = JSON.parse(body)
    console.log('[Razorpay] Event:', event.event)

    // Handle payment.captured
    if (event.event === 'payment.captured') {
      // Razorpay payload: event.payload.payment.entity (entity has the actual data)
      const paymentEntity = event.payload.payment?.entity || event.payload.payment
      const amount = paymentEntity.amount
      const notes = paymentEntity.notes || {}
      
      console.log('[Razorpay] Payment captured:', paymentEntity.id, 'Amount:', amount, 'Notes:', JSON.stringify(notes))
      
      // Extract credits from notes (sent from subscription creation)
      const creditsToAdd = notes.credits ? parseInt(notes.credits) : 0
      let planType = notes.plan_type || 'creator'
      const billingCycle = notes.billing_cycle || 'monthly'
      
      // If plan_type is missing, try to extract from subscription_id (for recurring charges)
      if (!notes.plan_type && notes.subscription_id) {
        const subId = notes.subscription_id.toLowerCase()
        if (subId.includes('studio')) planType = 'studio'
        else if (subId.includes('pro')) planType = 'pro'
        else planType = 'creator'
      }
      
      if (creditsToAdd > 0 && notes.clerk_user_id) {
        const { data: user } = await supabaseAdmin
          .from('users')
          .select('credits')
          .eq('clerk_user_id', notes.clerk_user_id)
          .single()

        if (user) {
          const newCredits = user.credits + creditsToAdd
          
          await supabaseAdmin
            .from('users')
            .update({
              credits: newCredits,
              subscription_status: 'active',
              subscription_plan: planType,
              subscription_id: notes.subscription_id
            })
            .eq('clerk_user_id', notes.clerk_user_id)
          
          console.log(`[Razorpay] ✅ ${creditsToAdd} credits delivered to ${notes.clerk_user_id} (${planType} ${billingCycle})`)
          console.log(`[Razorpay] New balance: ${newCredits} credits`)
        } else {
          console.error('[Razorpay] User not found:', notes.clerk_user_id)
        }
      } else {
        console.log('[Razorpay] No credits to add or missing user ID')
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('[Razorpay] Error:', error)
    return new Response(JSON.stringify({ error: 'Webhook failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

async function handleClerkWebhook(req: Request) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET

  if (!WEBHOOK_SECRET) {
    throw new Error('Please add CLERK_WEBHOOK_SECRET from Clerk Dashboard to .env or .env.local')
  }

  // Get the headers
  const headerPayload = await headers()
  const svix_id = headerPayload.get('svix-id')
  const svix_timestamp = headerPayload.get('svix-timestamp')
  const svix_signature = headerPayload.get('svix-signature')

  // If there are no headers, error out
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response('Error occured -- no svix headers', {
      status: 400,
    })
  }

  // Get the body
  const payload = await req.json()
  const body = JSON.stringify(payload)

  // Create a new Svix instance with your secret.
  const wh = new Webhook(WEBHOOK_SECRET)

  let evt: WebhookEvent

  // Verify the payload with the headers
  try {
    evt = wh.verify(body, {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    }) as WebhookEvent
  } catch (err) {
    console.error('Error verifying webhook:', err)
    return new Response('Error occured', {
      status: 400,
    })
  }

  // Handle the webhook
  const eventType = evt.type

  if (eventType === 'user.created') {
    const { id, email_addresses, username, image_url } = evt.data
    const emailAddress = email_addresses[0]?.email_address || ''
    
    // Validate image URL - reject invalid data URLs
    const validImageUrl = (image_url && image_url.startsWith('http')) ? image_url : null

    try {
      // Check if user already exists from Razorpay subscription (temp_ user)
      const { data: existingUser } = await supabase
        .from('users')
        .select('*')
        .eq('email', emailAddress)
        .single()

      if (existingUser && existingUser.clerk_user_id.startsWith('temp_')) {
        // Update temp user with real Clerk ID (preserve their subscription & credits)
        console.log('[Clerk Webhook] Linking existing Razorpay subscriber:', emailAddress)
        const { error } = await supabase
          .from('users')
          .update({
            clerk_user_id: id,
            username: username || existingUser.username,
            profile_image_url: validImageUrl || existingUser.profile_image_url,
            updated_at: new Date().toISOString()
          })
          .eq('email', emailAddress)

        if (error) {
          console.error('Error updating temp user:', error)
          return new Response('Error updating user', { status: 500 })
        }
      } else {
        // New user - create normally
        const { error } = await supabase.from('users').upsert({
          clerk_user_id: id,
          email: emailAddress,
          username: username || null,
          profile_image_url: validImageUrl,
          credits: 20, // Give 20 credits automatically on signup
        }, { onConflict: 'clerk_user_id' })

        if (error) {
          console.error('Error creating user in Supabase:', error)
          return new Response('Error creating user', { status: 500 })
        }
      }
    } catch (err) {
      console.error('Unexpected error in user.created webhook:', err)
      return new Response('Internal server error', { status: 500 })
    }
  }

  if (eventType === 'user.updated') {
    const { id, email_addresses, username, image_url } = evt.data
    
    // Validate image URL
    const validImageUrl = (image_url && image_url.startsWith('http')) ? image_url : null

    // Update user in Supabase
    const { error } = await supabase
      .from('users')
      .update({
        email: email_addresses[0]?.email_address || '',
        username: username || null,
        profile_image_url: validImageUrl,
      })
      .eq('clerk_user_id', id)

    if (error) {
      console.error('Error updating user in Supabase:', error)
      return new Response('Error updating user', { status: 500 })
    }
  }

  if (eventType === 'user.deleted') {
    const { id } = evt.data

    // Delete user from Supabase (cascade will delete related records)
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('clerk_user_id', id)

    if (error) {
      console.error('Error deleting user from Supabase:', error)
      return new Response('Error deleting user', { status: 500 })
    }
  }

  return new Response('Webhook processed successfully', { status: 200 })
}

