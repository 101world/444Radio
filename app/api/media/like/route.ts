import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { corsResponse, handleOptions } from '@/lib/cors'
import { createClient } from '@supabase/supabase-js'

// Lazy-init service role client to avoid build-time env issues
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

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

    const supabase = getSupabase()
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
      .select('id')
      .eq('user_id', userId)
      .eq('release_id', releaseId)

    if (checkError) {
      console.error('[Like API] Check error:', checkError)
      return corsResponse(NextResponse.json({
        success: false, error: `Check failed: ${checkError.message}`
      }, { status: 500 }))
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
        return corsResponse(NextResponse.json({
          success: false, error: `Unlike failed: ${deleteError.message}`
        }, { status: 500 }))
      }

      // Recount total likes
      const { count } = await supabase
        .from('user_likes')
        .select('id', { count: 'exact', head: true })
        .eq('release_id', releaseId)

      const newCount = count || 0

      // Update both likes columns (likes and likes_count may both exist)
      await supabase
        .from('combined_media')
        .update({ likes: newCount, likes_count: newCount })
        .eq('id', releaseId)

      return corsResponse(NextResponse.json({
        success: true, liked: false, likesCount: newCount
      }))
    } else {
      // Like: Insert into user_likes
      const { error: insertError } = await supabase
        .from('user_likes')
        .insert({ user_id: userId, release_id: releaseId })

      if (insertError) {
        console.error('[Like API] Insert error:', insertError)
        return corsResponse(NextResponse.json({
          success: false, error: `Like failed: ${insertError.message}`
        }, { status: 500 }))
      }

      // Recount total likes
      const { count } = await supabase
        .from('user_likes')
        .select('id', { count: 'exact', head: true })
        .eq('release_id', releaseId)

      const newCount = count || 0

      // Update both likes columns
      await supabase
        .from('combined_media')
        .update({ likes: newCount, likes_count: newCount })
        .eq('id', releaseId)

      return corsResponse(NextResponse.json({
        success: true, liked: true, likesCount: newCount
      }))
    }

  } catch (error) {
    console.error('[Like API] Error:', error)
    return corsResponse(NextResponse.json(
      { success: false, error: 'Failed to update like status',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 }
    ))
  }
}

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return corsResponse(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
    }

    const supabase = getSupabase()
    const { searchParams } = new URL(req.url)
    const releaseId = searchParams.get('releaseId')
    
    if (!releaseId) {
      return corsResponse(NextResponse.json(
        { error: 'Release ID is required' },
        { status: 400 }
      ))
    }

    // Check if user liked this release
    const { data: likes } = await supabase
      .from('user_likes')
      .select('id')
      .eq('user_id', userId)
      .eq('release_id', releaseId)

    const liked = !!(likes && likes.length > 0)

    // Get total likes count
    const { data: countData } = await supabase
      .from('combined_media')
      .select('likes')
      .eq('id', releaseId)
      .single()

    const likesCount = countData?.likes || 0

    return corsResponse(NextResponse.json({
      success: true, liked, likesCount
    }))

  } catch (error) {
    console.error('[Like API] GET Error:', error)
    return corsResponse(NextResponse.json(
      { error: 'Failed to get like status' },
      { status: 500 }
    ))
  }
}
