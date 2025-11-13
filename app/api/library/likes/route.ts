import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { corsResponse, handleOptions } from '@/lib/cors'

export async function OPTIONS() {
  return handleOptions()
}

/**
 * GET /api/library/likes
 * Get all tracks the user has liked
 */
export async function GET() {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return corsResponse(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

    // TODO: Update this query once we confirm likes table structure
    // For now, check if 'likes' table exists
    try {
      const response = await fetch(
        `${supabaseUrl}/rest/v1/likes?user_id=eq.${userId}&order=created_at.desc`,
        {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          }
        }
      )

      if (response.ok) {
        const likes = await response.json()
        const likedTracks = Array.isArray(likes) ? likes : []

        console.log(`❤️ Likes: Fetched ${likedTracks.length} liked tracks`)

        return corsResponse(NextResponse.json({
          success: true,
          likes: likedTracks,
          total: likedTracks.length
        }))
      } else {
        // Table doesn't exist or different structure
        console.log('❤️ Likes table not found, returning empty array')
        return corsResponse(NextResponse.json({
          success: true,
          likes: [],
          total: 0,
          message: 'Likes feature not yet implemented'
        }))
      }
    } catch (tableError) {
      // Table doesn't exist
      console.log('❤️ Likes table not accessible:', tableError)
      return corsResponse(NextResponse.json({
        success: true,
        likes: [],
        total: 0,
        message: 'Likes feature not yet implemented'
      }))
    }

  } catch (error) {
    console.error('Error fetching likes:', error)
    return corsResponse(NextResponse.json(
      { error: 'Failed to fetch likes' },
      { status: 500 }
    ))
  }
}
