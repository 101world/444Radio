import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { corsResponse, handleOptions } from '@/lib/cors'

export async function OPTIONS() {
  return handleOptions()
}

/**
 * GET /api/library/likes
 * Get all tracks the user has liked (alias for /api/library/liked)
 */
export async function GET() {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return corsResponse(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

    // Fetch from user_likes table (the actual likes table)
    const likesRes = await fetch(
      `${supabaseUrl}/rest/v1/user_likes?user_id=eq.${userId}&select=release_id,created_at&order=created_at.desc`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        }
      }
    )

    if (!likesRes.ok) {
      console.log('❤️ user_likes query failed:', likesRes.status)
      return corsResponse(NextResponse.json({ success: true, likes: [], total: 0 }))
    }

    const likes = await likesRes.json()
    const likedTracks = Array.isArray(likes) ? likes : []

    console.log(`❤️ Likes: Fetched ${likedTracks.length} liked tracks`)

    return corsResponse(NextResponse.json({
      success: true,
      likes: likedTracks,
      total: likedTracks.length
    }))

  } catch (error) {
    console.error('Error fetching likes:', error)
    return corsResponse(NextResponse.json(
      { error: 'Failed to fetch likes' },
      { status: 500 }
    ))
  }
}
