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

    const { full_name, bio, location, website, social_links } = await request.json()

    // Update user profile in Supabase
    const { error } = await supabaseAdmin
      .from('users')
      .update({
        full_name,
        bio,
        location,
        website,
        social_links,
        updated_at: new Date().toISOString()
      })
      .eq('clerk_user_id', clerkUserId)

    if (error) throw error

    return NextResponse.json({ 
      success: true,
      profile: {
        full_name,
        bio,
        location,
        website,
        social_links
      }
    })
  } catch (error) {
    console.error('Profile update API error:', error)
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
  }
}
