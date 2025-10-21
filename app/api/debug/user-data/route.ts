import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { auth } from '@clerk/nextjs/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get the user ID from query params or use current user
    const searchParams = req.nextUrl.searchParams
    const targetUserId = searchParams.get('userId') || userId

    // 1. Check users table
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('clerk_user_id', targetUserId)
      .single()

    // 2. Check all tables for this user
    const { data: combinedMedia } = await supabase
      .from('combined_media')
      .select('*')
      .eq('user_id', targetUserId)
      .limit(5)

    const { data: profileMedia } = await supabase
      .from('profile_media')
      .select('*')
      .eq('user_id', targetUserId)
      .limit(5)

    // 3. Get all users to check structure
    const { data: allUsers } = await supabase
      .from('users')
      .select('clerk_user_id, username, created_at')
      .limit(10)

    return NextResponse.json({
      success: true,
      targetUserId,
      userData: userData || null,
      userError: userError?.message || null,
      combinedMediaCount: combinedMedia?.length || 0,
      combinedMediaSample: combinedMedia?.[0] || null,
      profileMediaCount: profileMedia?.length || 0,
      profileMediaSample: profileMedia?.[0] || null,
      allUsers: allUsers || [],
      diagnosis: {
        hasUserRecord: !!userData,
        username: userData?.username || 'NOT FOUND',
        clerk_user_id: userData?.clerk_user_id || 'NOT FOUND',
        created_at: userData?.created_at || 'NOT FOUND'
      }
    })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error('Debug error:', error)
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    )
  }
}
