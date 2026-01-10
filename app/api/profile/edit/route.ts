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

    const body = await request.json()
    const { full_name, bio, location, website, social_links } = body

    console.log('[Profile Edit] Updating profile for user:', clerkUserId)
    console.log('[Profile Edit] Body:', { full_name, bio, location, website, social_links })

    // Check if Supabase client is initialized
    if (!supabaseAdmin) {
      console.error('[Profile Edit] Supabase client not initialized')
      return corsResponse(NextResponse.json({ 
        error: 'Database connection failed',
        details: 'Supabase client not initialized'
      }, { status: 500 }))
    }

    // Update all profile fields
    const { error, data } = await supabaseAdmin
      .from('users')
      .update({
        full_name: full_name || null,
        bio: bio || null,
        location: location || null,
        website: website || null,
        social_links: social_links || null,
        updated_at: new Date().toISOString()
      })
      .eq('clerk_user_id', clerkUserId)
      .select()

    if (error) {
      console.error('[Profile Edit] Supabase error:', JSON.stringify(error, null, 2))
      return corsResponse(NextResponse.json({ 
        error: 'Database update failed',
        details: error.message,
        code: error.code
      }, { status: 500 }))
    }

    if (!data || data.length === 0) {
      console.error('[Profile Edit] No user found with clerk_user_id:', clerkUserId)
      return corsResponse(NextResponse.json({ 
        error: 'User not found',
        details: 'No user record found for this account'
      }, { status: 404 }))
    }

    console.log('[Profile Edit] Update successful:', data)

    return corsResponse(NextResponse.json({ 
      success: true,
      profile: data[0]
    }))
  } catch (error) {
    console.error('[Profile Edit] API error:', error)
    console.error('[Profile Edit] Error stack:', error instanceof Error ? error.stack : 'No stack')
    return corsResponse(NextResponse.json({ 
      error: 'Failed to update profile',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 }))
  }
}
