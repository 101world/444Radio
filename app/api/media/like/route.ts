import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { corsResponse, handleOptions } from '@/lib/cors'

/**
 * Like API - Toggle like/unlike with user_likes table tracking
 */

export async function OPTIONS() {
  return handleOptions()
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return corsResponse(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
    }

    const body = await req.json()
    const releaseId = body.releaseId || body.mediaId
    
    if (!releaseId) {
      return corsResponse(NextResponse.json(
        { error: 'Release ID is required' },
        { status: 400 }
      ))
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

    // Check if user already liked this release
    const checkResponse = await fetch(
      `${supabaseUrl}/rest/v1/user_likes?user_id=eq.${userId}&release_id=eq.${releaseId}`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        }
      }
    )

    if (!checkResponse.ok) {
      throw new Error('Failed to check like status')
    }

    const existing = await checkResponse.json()
    const isCurrentlyLiked = existing.length > 0

    if (isCurrentlyLiked) {
      // Unlike: Delete from user_likes
      const deleteResponse = await fetch(
        `${supabaseUrl}/rest/v1/user_likes?user_id=eq.${userId}&release_id=eq.${releaseId}`,
        {
          method: 'DELETE',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          }
        }
      )

      if (!deleteResponse.ok) {
        throw new Error('Failed to unlike')
      }

      // Recount total likes for this release
      const countResponse = await fetch(
        `${supabaseUrl}/rest/v1/user_likes?release_id=eq.${releaseId}&select=id`,
        {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          }
        }
      )
      const allLikes = await countResponse.json()
      const newCount = allLikes.length

      // Update combined_media likes count
      await fetch(
        `${supabaseUrl}/rest/v1/combined_media?id=eq.${releaseId}`,
        {
          method: 'PATCH',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ likes: newCount })
        }
      )

      return corsResponse(NextResponse.json({
        success: true,
        liked: false,
        likesCount: newCount
      }))
    } else {
      // Like: Insert into user_likes
      const insertResponse = await fetch(
        `${supabaseUrl}/rest/v1/user_likes`,
        {
          method: 'POST',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            user_id: userId,
            release_id: releaseId
          })
        }
      )

      if (!insertResponse.ok) {
        throw new Error('Failed to like')
      }

      // Recount total likes for this release
      const countResponse = await fetch(
        `${supabaseUrl}/rest/v1/user_likes?release_id=eq.${releaseId}&select=id`,
        {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          }
        }
      )
      const allLikes = await countResponse.json()
      const newCount = allLikes.length

      // Update combined_media likes count
      await fetch(
        `${supabaseUrl}/rest/v1/combined_media?id=eq.${releaseId}`,
        {
          method: 'PATCH',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ likes: newCount })
        }
      )

      return corsResponse(NextResponse.json({
        success: true,
        liked: true,
        likesCount: newCount
      }))
    }

  } catch (error) {
    console.error('[Like API] Error:', error)
    return corsResponse(NextResponse.json(
      { 
        error: 'Failed to update like status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    ))
  }
}

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return corsResponse(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
    }

    const { searchParams } = new URL(req.url)
    const releaseId = searchParams.get('releaseId')
    
    if (!releaseId) {
      return corsResponse(NextResponse.json(
        { error: 'Release ID is required' },
        { status: 400 }
      ))
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

    // Check if user liked this release
    const likeResponse = await fetch(
      `${supabaseUrl}/rest/v1/user_likes?user_id=eq.${userId}&release_id=eq.${releaseId}`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        }
      }
    )

    const likes = await likeResponse.json()
    const liked = likes.length > 0

    // Get total likes count
    const countResponse = await fetch(
      `${supabaseUrl}/rest/v1/combined_media?id=eq.${releaseId}&select=likes`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        }
      }
    )

    const countData = await countResponse.json()
    const likesCount = countData[0]?.likes || 0

    return corsResponse(NextResponse.json({
      liked,
      likesCount
    }))

  } catch (error) {
    console.error('[Like API] GET Error:', error)
    return corsResponse(NextResponse.json(
      { error: 'Failed to get like status' },
      { status: 500 }
    ))
  }
}
