import { Webhook } from 'svix'
import { headers } from 'next/headers'
import { WebhookEvent } from '@clerk/nextjs/server'
import { supabase } from '../../../lib/supabase'

export async function POST(req: Request) {
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
            profile_image_url: image_url || existingUser.profile_image_url,
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
          profile_image_url: image_url || null,
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

    // Update user in Supabase
    const { error } = await supabase
      .from('users')
      .update({
        email: email_addresses[0]?.email_address || '',
        username: username || null,
        profile_image_url: image_url || null,
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

