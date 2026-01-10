import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { corsResponse, handleOptions } from '@/lib/cors'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function OPTIONS() {
  return handleOptions()
}

export async function GET() {
  return corsResponse(NextResponse.json({ 
    message: 'Use POST to sync subscribers',
    endpoint: '/api/admin/sync-subscribers'
  }))
}

export async function POST(request: Request) {
  try {
    // Check env vars exist
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      console.error('[Sync] Missing Razorpay credentials')
      return corsResponse(NextResponse.json({ 
        error: 'Missing Razorpay credentials',
        details: 'RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be set in environment variables'
      }, { status: 500 }))
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('[Sync] Missing Supabase credentials')
      return corsResponse(NextResponse.json({ 
        error: 'Missing Supabase credentials',
        details: 'NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set'
      }, { status: 500 }))
    }

    const razorpayAuth = Buffer.from(
      `${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`
    ).toString('base64')

    console.log('[Sync] Fetching subscriptions from Razorpay...')
    console.log('[Sync] Using key:', process.env.RAZORPAY_KEY_ID?.substring(0, 15) + '...')

    // Fetch all subscriptions
    const response = await fetch('https://api.razorpay.com/v1/subscriptions?count=100', {
      headers: {
        'Authorization': `Basic ${razorpayAuth}`
      }
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('[Sync] Razorpay API error:', response.status, error)
      return corsResponse(NextResponse.json({ 
        error: 'Razorpay API failed', 
        status: response.status,
        details: error 
      }, { status: 500 }))
    }

    const data = await response.json()
    const subscriptions = data.items || []

    console.log(`[Sync] Found ${subscriptions.length} subscriptions`)

    let synced = 0
    let errors = 0
    const results = []

    for (const sub of subscriptions) {
      if (sub.status !== 'active') {
        console.log(`[Sync] Skipping ${sub.id} - status: ${sub.status}`)
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

        if (!customerResponse.ok) {
          errors++
          results.push({ subscription: sub.id, status: 'error', reason: 'Customer not found' })
          continue
        }

        const customer = await customerResponse.json()
        const email = customer.email

        if (!email) {
          errors++
          results.push({ subscription: sub.id, status: 'error', reason: 'No email' })
          continue
        }

        console.log(`[Sync] Processing: ${email}`)

        // Check if user exists
        const { data: existingUser } = await supabaseAdmin
          .from('users')
          .select('*')
          .eq('email', email)
          .single()

        if (existingUser) {
          // Update existing user
          const { error } = await supabaseAdmin
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
            errors++
            results.push({ email, status: 'error', reason: error.message })
          } else {
            synced++
            results.push({ email, status: 'updated', credits_added: 100 })
          }
        } else {
          // Create new placeholder user
          const { error } = await supabaseAdmin
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
            errors++
            results.push({ email, status: 'error', reason: error.message })
          } else {
            synced++
            results.push({ email, status: 'created', credits: 100 })
          }
        }

        // Rate limit
        await new Promise(resolve => setTimeout(resolve, 500))

      } catch (error: any) {
        errors++
        results.push({ subscription: sub.id, status: 'error', reason: error.message })
      }
    }

    return corsResponse(NextResponse.json({
      success: true,
      total: subscriptions.length,
      synced,
      errors,
      results
    }))

  } catch (error: any) {
    console.error('[Sync] Unexpected error:', error)
    console.error('[Sync] Stack:', error.stack)
    return corsResponse(NextResponse.json({ 
      error: error.message,
      details: error.stack,
      type: error.name
    }, { status: 500 }))
  }
}
