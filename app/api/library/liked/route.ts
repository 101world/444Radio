import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

/**
 * GET /api/library/liked
 * Get all tracks the user has liked
 */
export async function GET() {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

    // Fetch user's liked tracks with full combined_media details
    // Join user_likes with combined_media to get complete track info
    const response = await fetch(
      `${supabaseUrl}/rest/v1/user_likes?user_id=eq.${userId}&select=*,combined_media!inner(*)&order=created_at.desc&limit=1000`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        }
      }
    )

    const likes = await response.json()

    // Extract the combined_media objects from the likes and normalize field names
    const likedTracks = Array.isArray(likes) 
      ? likes.map((like: any) => ({
          ...like.combined_media,
          audioUrl: like.combined_media?.audio_url, // Normalized for AudioPlayerContext
          imageUrl: like.combined_media?.image_url, // Normalized for AudioPlayerContext
          liked_at: like.created_at // When user liked it
        }))
      : []

    console.log(`❤️ Liked Songs: Fetched ${likedTracks.length} liked tracks for user ${userId}`)

    return NextResponse.json({
      success: true,
      liked: likedTracks,
      total: likedTracks.length
    })

  } catch (error) {
    console.error('Error fetching liked songs:', error)
    return NextResponse.json(
      { error: 'Failed to fetch liked songs' },
      { status: 500 }
    )
  }
}
