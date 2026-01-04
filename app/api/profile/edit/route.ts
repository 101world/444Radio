import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'

// Use service role key to bypass RLS
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  try {
    const { userId: clerkUserId } = await auth()
    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { bio } = await request.json()

    // Update only bio (other fields don't exist in DB yet)
    const { error } = await supabaseAdmin
      .from('users')
      .update({
        bio,
        updated_at: new Date().toISOString()
      })
      .eq('clerk_user_id', clerkUserId)

    if (error) throw error

    return NextResponse.json({ 
      success: true,
      profile: { bio }
    })
  } catch (error) {
    console.error('Profile update API error:', error)
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
  }
}
