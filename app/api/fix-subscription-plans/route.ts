import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { handleOptions } from '@/lib/cors'

export async function OPTIONS() {
  return handleOptions()
}

// Admin endpoint to fix subscription_plan field for existing users
export async function POST() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  try {
    // Get all active subscriptions
    const { data: users, error: fetchError } = await supabase
      .from('users')
      .select('clerk_user_id, subscription_plan, subscription_id')
      .eq('subscription_status', 'active')
      .or('subscription_plan.like.sub_%,subscription_plan.like.plan_%')

    if (fetchError) throw fetchError

    console.log(`Found ${users?.length || 0} users to fix`)

    let fixed = 0
    for (const user of users || []) {
      const subId = (user.subscription_id || '').toLowerCase()
      let planType = 'creator' // default

      // Determine plan type from subscription_id
      if (subId.includes('studio') || subId.includes('s2di') || subId.includes('s2do')) {
        planType = 'studio'
      } else if (subId.includes('pro') || subId.includes('s2dh') || subId.includes('s2dn')) {
        planType = 'pro'
      }

      // Update the user
      const { error: updateError } = await supabase
        .from('users')
        .update({ subscription_plan: planType })
        .eq('clerk_user_id', user.clerk_user_id)

      if (!updateError) {
        console.log(`✅ Fixed ${user.clerk_user_id}: ${user.subscription_plan} → ${planType}`)
        fixed++
      } else {
        console.error(`❌ Failed to fix ${user.clerk_user_id}:`, updateError)
      }
    }

    return NextResponse.json({
      success: true,
      message: `Fixed ${fixed} out of ${users?.length || 0} users`,
      fixed,
      total: users?.length || 0
    })
  } catch (error: any) {
    console.error('Error fixing subscription plans:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
