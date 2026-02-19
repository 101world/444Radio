import { Webhook } from 'svix'
import { headers } from 'next/headers'
import { WebhookEvent } from '@clerk/nextjs/server'
import { supabase } from '../../../lib/supabase'
import { logActivity } from '@/lib/activity-logger'

// ─────────────────────────────────────────────────────────────
// Clerk-only webhook handler
// Razorpay webhooks are now handled exclusively at /api/webhooks/razorpay
// ─────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  // Check for Razorpay signature — reject with guidance
  const razorpaySignature = req.headers.get('x-razorpay-signature')
  if (razorpaySignature) {
    console.warn('[Webhook] Razorpay event sent to /api/webhook — should use /api/webhooks/razorpay')
    return new Response(
      JSON.stringify({ error: 'Razorpay webhooks moved to /api/webhooks/razorpay' }),
      { status: 410, headers: { 'Content-Type': 'application/json' } }
    )
  }

  // Clerk webhook
  return handleClerkWebhook(req)
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
          credits: 0, // Users start with 0 credits - must visit /decrypt to get 20
        }, { onConflict: 'clerk_user_id' })

        if (error) {
          console.error('Error creating user in Supabase:', error)
          return new Response('Error creating user', { status: 500 })
        }

        // Log signup activity (non-blocking)
        logActivity({
          userId: id,
          actionType: 'signup',
          metadata: {
            email: emailAddress,
            username: username || null,
            has_avatar: !!validImageUrl
          }
        }).catch(err => console.error('[Webhook] Activity log failed:', err))
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

