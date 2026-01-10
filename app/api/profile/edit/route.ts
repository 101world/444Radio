import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'
import { corsResponse, handleOptions } from '@/lib/cors'

// Use service role key to bypass RLS
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function OPTIONS() {
  return handleOptions()
}

export async function POST(request: Request) {
  try {
    const { userId: clerkUserId } = await auth()
    if (!clerkUserId) {
      return corsResponse(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
    }

    const { full_name, bio, location, website, social_links } = await request.json()

    console.log('[Profile Edit] Updating profile for user:', clerkUserId, { full_name, bio, location, website })

    // Update all profile fields
    const { error, data } = await supabaseAdmin
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
      .select()

    if (error) {
      console.error('[Profile Edit] Supabase error:', error)
      throw error
    }

    console.log('[Profile Edit] Update successful:', data)

    return corsResponse(NextResponse.json({ 
      success: true,
      profile: { full_name, bio, location, website, social_links }
    }))
  } catch (error) {
    console.error('[Profile Edit] API error:', error)
    return corsResponse(NextResponse.json({ 
      error: 'Failed to update profile',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 }))
  }
}
