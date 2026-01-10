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
    console.log('[Profile Edit] Raw body:', body)

    // Only update username and bio (columns that definitely exist)
    const updateData: any = {
      updated_at: new Date().toISOString()
    }
    
    // Map frontend fields to database columns
    if (body.username !== undefined) updateData.username = body.username || null
    if (body.bio !== undefined) updateData.bio = body.bio || null
    
    console.log('[Profile Edit] Update data:', updateData)

    const { error, data } = await supabaseAdmin
      .from('users')
      .update(updateData)
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
