import { Webhook } from 'svix'
import { headers } from 'next/headers'
import { WebhookEvent } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET

  if (!WEBHOOK_SECRET) {
    throw new Error('Please add CLERK_WEBHOOK_SECRET to .env.local')
  }

  // Get the headers
  const headerPayload = await headers()
  const svix_id = headerPayload.get('svix-id')
  const svix_timestamp = headerPayload.get('svix-timestamp')
  const svix_signature = headerPayload.get('svix-signature')

  // If there are no headers, error out
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return NextResponse.json({ error: 'Missing svix headers' }, { status: 400 })
  }

  // Get the body
  const payload = await req.json()
  const body = JSON.stringify(payload)

  // Create a new Svix instance with your secret
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
    return NextResponse.json({ error: 'Verification failed' }, { status: 400 })
  }

  // Handle the webhook
  const eventType = evt.type
  
  if (eventType === 'user.created' || eventType === 'user.updated') {
    const { id, email_addresses, username, first_name, last_name, image_url } = evt.data

    // Sync to Supabase users table
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

    try {
      const response = await fetch(
        `${supabaseUrl}/rest/v1/users`,
        {
          method: 'POST',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'resolution=merge-duplicates'
          },
          body: JSON.stringify({
            clerk_user_id: id,
            username: username || first_name || email_addresses[0]?.email_address?.split('@')[0] || `user_${id.slice(-8)}`,
            email: email_addresses[0]?.email_address || '',
            first_name: first_name || '',
            last_name: last_name || '',
            avatar_url: image_url || '',
            updated_at: new Date().toISOString()
          })
        }
      )

      const data = await response.json()
      console.log('User synced to Supabase:', data)

      return NextResponse.json({ success: true, message: 'User synced' })
    } catch (error) {
      console.error('Error syncing user to Supabase:', error)
      return NextResponse.json({ error: 'Failed to sync user' }, { status: 500 })
    }
  }

  return NextResponse.json({ success: true, message: 'Webhook received' })
}
