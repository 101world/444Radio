import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { corsResponse, handleOptions } from '@/lib/cors'

/**
 * POST /api/media/like
 * Like or unlike a release (toggle)
 * 
 * Body: { releaseId: string }
 * Returns: { success: true, liked: boolean, likesCount: number }
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    
    console.log('[Like API] POST request, userId:', userId)
    
    if (!userId) {
      return corsResponse(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
    }

    const { releaseId } = await req.json()
    
    console.log('[Like API] releaseId:', releaseId)

    if (!releaseId) {
      return corsResponse(NextResponse.json(
        { error: 'Release ID is required' },
        { status: 400 }
      ))
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    
    if (!supabaseKey) {
      console.error('[Like API] SUPABASE_SERVICE_ROLE_KEY is not set!')
      return corsResponse(NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      ))
    }

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

    const existingLikes = await checkResponse.json()
    const alreadyLiked = Array.isArray(existingLikes) && existingLikes.length > 0

    if (alreadyLiked) {
      // Unlike: Delete the like
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
        throw new Error('Failed to unlike release')
      }

      console.log(`💔 User ${userId} unliked release ${releaseId}`)
      // Recompute likes_count and write to combined_media
      const computeLikesRes = await fetch(
        `${supabaseUrl}/rest/v1/user_likes?release_id=eq.${releaseId}&select=id`,
        {
          headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
        }
      )
      const likesArr = await computeLikesRes.json()
      const newCount = Array.isArray(likesArr) ? likesArr.length : 0
      await fetch(
        `${supabaseUrl}/rest/v1/combined_media?id=eq.${releaseId}`,
        {
          method: 'PATCH',
          headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
          body: JSON.stringify({ likes_count: newCount })
        }
      )
    } else {
      // Like: Insert new like
      const insertResponse = await fetch(
        `${supabaseUrl}/rest/v1/user_likes`,
        {
          method: 'POST',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({
            user_id: userId,
            release_id: releaseId
          })
        }
      )

      if (!insertResponse.ok) {
        throw new Error('Failed to like release')
      }

      console.log(`❤️ User ${userId} liked release ${releaseId}`)
        // Recompute likes_count and write to combined_media
        const computeLikesRes2 = await fetch(
          `${supabaseUrl}/rest/v1/user_likes?release_id=eq.${releaseId}&select=id`,
          {
            headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
          }
        )
        const likesArr2 = await computeLikesRes2.json()
        const newCount2 = Array.isArray(likesArr2) ? likesArr2.length : 0
        await fetch(
          `${supabaseUrl}/rest/v1/combined_media?id=eq.${releaseId}`,
          {
            method: 'PATCH',
            headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
            body: JSON.stringify({ likes_count: newCount2 })
          }
        )
    }

    // Get updated likes count
    const countResponse = await fetch(
      `${supabaseUrl}/rest/v1/combined_media?id=eq.${releaseId}&select=likes_count`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        }
      }
    )

    const countData = await countResponse.json()
    const likesCount = countData[0]?.likes_count || 0

    return corsResponse(NextResponse.json({
      success: true,
      liked: !alreadyLiked,
      likesCount
    }))

  } catch (error) {
    console.error('[Like API] Error:', error)
    console.error('[Like API] Error stack:', error instanceof Error ? error.stack : 'No stack')
    return corsResponse(NextResponse.json(
      { 
        error: 'Failed to update like status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    ))
  }
}

/**
 * GET /api/media/like?releaseId=xxx
 * Check if current user has liked a release
 * 
 * Returns: { liked: boolean, likesCount: number }
 */
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth()
    
    console.log('[Like API] GET request, userId:', userId)
    
    if (!userId) {
      return corsResponse(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
    }

    const { searchParams } = new URL(req.url)
    const releaseId = searchParams.get('releaseId')
    
    console.log('[Like API] GET releaseId:', releaseId)

    if (!releaseId) {
      return corsResponse(NextResponse.json(
        { error: 'Release ID is required' },
        { status: 400 }
      ))
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    
    if (!supabaseKey) {
      console.error('[Like API] SUPABASE_SERVICE_ROLE_KEY is not set!')
      return corsResponse(NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      ))
    }

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
    const liked = Array.isArray(likes) && likes.length > 0

    // Get total likes count
    const countResponse = await fetch(
      `${supabaseUrl}/rest/v1/combined_media?id=eq.${releaseId}&select=likes_count`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        }
      }
    )

    const countData = await countResponse.json()
    const likesCount = countData[0]?.likes_count || 0

    return corsResponse(NextResponse.json({
      success: true,
      liked,
      likesCount
    }))

  } catch (error) {
    console.error('[Like API] GET Error:', error)
    console.error('[Like API] GET Error stack:', error instanceof Error ? error.stack : 'No stack')
    return corsResponse(NextResponse.json(
      { 
        error: 'Failed to check like status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    ))
  }
}

export function OPTIONS() {
  return handleOptions()
}
