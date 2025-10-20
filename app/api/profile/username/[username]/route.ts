import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

// GET /api/profile/username/[username] - Fetch user profile and songs by username
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { userId: currentUserId } = await auth()
    const { username } = await params
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    
    // 1. Find user by username (case-insensitive)
    const userResponse = await fetch(
      `${supabaseUrl}/rest/v1/users?username=ilike.${username}&select=*`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        }
      }
    )
    
    if (!userResponse.ok) {
      throw new Error('Failed to fetch user profile')
    }
    
    const userData = await userResponse.json()
    const profile = userData?.[0]
    
    if (!profile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    
    // 2. Check if viewing own profile
    const isOwnProfile = currentUserId === profile.clerk_user_id
    
    // 3. Fetch combined media (all if own profile, only public if viewing others)
    let mediaQuery = `${supabaseUrl}/rest/v1/combined_media?user_id=eq.${profile.clerk_user_id}&order=created_at.desc&select=*`
    
    if (!isOwnProfile) {
      mediaQuery += '&is_public=eq.true' // Only show public media for others
    }
    
    const mediaResponse = await fetch(mediaQuery, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      }
    })
    
    if (!mediaResponse.ok) {
      throw new Error('Failed to fetch user media')
    }
    
    const combinedMedia = await mediaResponse.json()
    
    return NextResponse.json({
      success: true,
      profile,
      combinedMedia: Array.isArray(combinedMedia) ? combinedMedia : [],
      isOwnProfile
    })
    
  } catch (error) {
    console.error('Profile fetch error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch profile'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
