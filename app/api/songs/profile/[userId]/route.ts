import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

// GET /api/songs/profile/[userId] - Fetch user's songs (all if own profile, public if other's profile)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId: currentUserId } = await auth()
    const { userId: profileUserId } = await params
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    
    // If viewing own profile, show ALL songs (public + private)
    // If viewing someone else's profile, show only PUBLIC songs
    const isOwnProfile = currentUserId === profileUserId
    
    let queryUrl = `${supabaseUrl}/rest/v1/songs?user_id=eq.${profileUserId}&status=eq.complete&order=created_at.desc&select=*`
    
    if (!isOwnProfile) {
      queryUrl += '&is_public=eq.true' // Only show public songs for others
    }
    
    const response = await fetch(queryUrl, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      }
    })
    
    if (!response.ok) {
      throw new Error('Failed to fetch user songs')
    }
    
    const songs = await response.json()
    
    // Fetch user profile data
    const userResponse = await fetch(
      `${supabaseUrl}/rest/v1/users?clerk_user_id=eq.${profileUserId}&select=*`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        }
      }
    )
    
    const userData = await userResponse.json()
    const user = userData?.[0] || null
    
    return NextResponse.json({ 
      success: true,
      songs,
      user,
      isOwnProfile,
      count: songs.length
    })

  } catch (error) {
    console.error('Profile fetch error:', error)
    return NextResponse.json({ 
      success: false,
      error: 'Failed to fetch profile',
      songs: [],
      user: null
    }, { status: 500 })
  }
}
