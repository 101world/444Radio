import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { corsResponse, handleOptions } from '@/lib/cors'
import { supabase } from '@/lib/supabase'

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

    console.log('[Like API] User', userId, 'toggling like for', releaseId)

    // Check if user already liked this release
    const { data: existing, error: checkError } = await supabase
      .from('user_likes')
      .select('*')
      .eq('user_id', userId)
      .eq('release_id', releaseId)

    if (checkError) {
      console.error('[Like API] Check error:', checkError)
      throw new Error(`Failed to check like status: ${checkError.message}`)
    }

    const isCurrentlyLiked = existing && existing.length > 0

    if (isCurrentlyLiked) {
      // Unlike: Delete from user_likes
      const { error: deleteError } = await supabase
        .from('user_likes')
        .delete()
        .eq('user_id', userId)
        .eq('release_id', releaseId)

      if (deleteError) {
        console.error('[Like API] Delete error:', deleteError)
        throw new Error(`Failed to unlike: ${deleteError.message}`)
      }

      console.log('[Like API] User unliked release')

      // Recount total likes for this release
      const { data: allLikes, error: countError } = await supabase
        .from('user_likes')
        .select('id')
        .eq('release_id', releaseId)

      const newCount = allLikes ? allLikes.length : 0

      // Update combined_media likes count
      await supabase
        .from('combined_media')
        .update({ likes: newCount })
        .eq('id', releaseId)

      return corsResponse(NextResponse.json({
        success: true,
        liked: false,
        likesCount: newCount
      }))
    } else {
      // Like: Insert into user_likes
      const { error: insertError } = await supabase
        .from('user_likes')
        .insert({
          user_id: userId,
          release_id: releaseId
        })

      if (insertError) {
        console.error('[Like API] Insert error:', insertError)
        throw new Error(`Failed to like: ${insertError.message}`)
      }

      console.log('[Like API] User liked release')

      // Recount total likes for this release
      const { data: allLikes, error: countError } = await supabase
        .from('user_likes')
        .select('id')
        .eq('release_id', releaseId)

      const newCount = allLikes ? allLikes.length : 0

      // Update combined_media likes count
      await supabase
        .from('combined_media')
        .update({ likes: newCount })
        .eq('id', releaseId)

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

    // Check if user liked this release
    const { data: likes, error: likeError } = await supabase
      .from('user_likes')
      .select('*')
      .eq('user_id', userId)
      .eq('release_id', releaseId)

    const liked = likes && likes.length > 0

    // Get total likes count
    const { data: countData, error: countError } = await supabase
      .from('combined_media')
      .select('likes')
      .eq('id', releaseId)
      .single()

    const likesCount = countData?.likes || 0

    return corsResponse(NextResponse.json({
      success: true,
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
