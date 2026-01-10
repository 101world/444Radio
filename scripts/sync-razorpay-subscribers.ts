import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * BULK SYNC ALL RAZORPAY SUBSCRIBERS
 * 
 * This script fetches all active subscriptions from Razorpay
 * and syncs them to your database with credits
 */

async function syncAllSubscribers() {
  const razorpayAuth = Buffer.from(
    `${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`
  ).toString('base64')

  console.log('Fetching all subscriptions from Razorpay...')

  // Fetch all subscriptions from Razorpay
  const response = await fetch('https://api.razorpay.com/v1/subscriptions?count=100', {
    headers: {
      'Authorization': `Basic ${razorpayAuth}`
    }
  })

  const data = await response.json()
  const subscriptions = data.items || []

  console.log(`Found ${subscriptions.length} subscriptions`)

  let synced = 0
  let errors = 0

  for (const sub of subscriptions) {
    if (sub.status !== 'active') {
      console.log(`Skipping ${sub.id} - status: ${sub.status}`)
      continue
    }

    try {
      // Fetch customer details
      const customerResponse = await fetch(
        `https://api.razorpay.com/v1/customers/${sub.customer_id}`,
        {
          headers: { 'Authorization': `Basic ${razorpayAuth}` }
        }
      )

      const customer = await customerResponse.json()
      const email = customer.email

      if (!email) {
        console.log(`No email for customer ${sub.customer_id}`)
        errors++
        continue
      }

      console.log(`Processing: ${email} (${sub.id})`)

      // Check if user exists
      const { data: existingUser } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .single()

      if (existingUser) {
        // User exists - update their subscription
        const { error } = await supabase
          .from('users')
          .update({
            credits: existingUser.credits + 100,
            subscription_status: 'active',
            subscription_plan: sub.plan_id,
            subscription_id: sub.id,
            razorpay_customer_id: sub.customer_id,
            subscription_start: sub.start_at,
            subscription_end: sub.end_at,
            updated_at: new Date().toISOString()
          })
          .eq('email', email)

        if (error) {
          console.error(`Error updating ${email}:`, error)
          errors++
        } else {
          console.log(`✓ Updated ${email} (+100 credits)`)
          synced++
        }
      } else {
        // User doesn't exist yet - create placeholder
        // Will be linked when they sign up via Clerk webhook
        const { error } = await supabase
          .from('users')
          .insert({
            clerk_user_id: `temp_${sub.customer_id}`,
            email: email,
            credits: 100,
            subscription_status: 'active',
            subscription_plan: sub.plan_id,
            subscription_id: sub.id,
            razorpay_customer_id: sub.customer_id,
            subscription_start: sub.start_at,
            subscription_end: sub.end_at,
            total_generated: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })

        if (error) {
          console.error(`Error creating ${email}:`, error)
          errors++
        } else {
          console.log(`✓ Created ${email} (100 credits)`)
          synced++
        }
      }

      // Rate limit: wait 500ms between API calls
      await new Promise(resolve => setTimeout(resolve, 500))

    } catch (error) {
      console.error(`Error processing ${sub.id}:`, error)
      errors++
    }
  }

  console.log('\n=== SYNC COMPLETE ===')
  console.log(`✓ Synced: ${synced}`)
  console.log(`✗ Errors: ${errors}`)
  console.log(`Total: ${subscriptions.length}`)
}

// Run it
syncAllSubscribers().catch(console.error)
