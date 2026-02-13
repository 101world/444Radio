import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { corsResponse, handleOptions } from '@/lib/cors'
import { createClient } from '@supabase/supabase-js'

/**
 * Like API - Toggle like/unlike with user_likes table tracking
 * Uses service role key to bypass RLS (auth via Clerk)
 */

export async function OPTIONS() {
  return handleOptions()
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return corsResponse(NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 }))
    }

    // Validate env
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('[Like API] Missing SUPABASE env vars')
      return corsResponse(NextResponse.json({ success: false, error: 'Server config error' }, { status: 500 }))
    }

    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

    const body = await req.json()
    const releaseId = body.releaseId || body.mediaId
    if (!releaseId) {
      return corsResponse(NextResponse.json({ success: false, error: 'Release ID is required' }, { status: 400 }))
    }

    console.log('[Like API] POST user=', userId, 'release=', releaseId)

    // Step 1 — Check existing like
    const { data: existing, error: checkErr } = await supabase
      .from('user_likes')
      .select('id')
      .eq('user_id', userId)
      .eq('release_id', releaseId)

    if (checkErr) {
      console.error('[Like API] check error:', JSON.stringify(checkErr))
      return corsResponse(NextResponse.json({ success: false, error: checkErr.message, code: checkErr.code }, { status: 500 }))
    }

    const alreadyLiked = existing && existing.length > 0
    let liked: boolean

    if (alreadyLiked) {
      // Unlike — remove row
      const { error: delErr } = await supabase
        .from('user_likes')
        .delete()
        .eq('user_id', userId)
        .eq('release_id', releaseId)

      if (delErr) {
        console.error('[Like API] delete error:', JSON.stringify(delErr))
        return corsResponse(NextResponse.json({ success: false, error: delErr.message }, { status: 500 }))
      }
      liked = false
    } else {
      // Like — insert row
      const { error: insErr } = await supabase
        .from('user_likes')
        .insert({ user_id: userId, release_id: releaseId })

      if (insErr) {
        console.error('[Like API] insert error:', JSON.stringify(insErr))
        return corsResponse(NextResponse.json({ success: false, error: insErr.message }, { status: 500 }))
      }
      liked = true
    }

    // Step 2 — Recount likes from user_likes table
    const { data: countRows, error: countErr } = await supabase
      .from('user_likes')
      .select('id')
      .eq('release_id', releaseId)

    const newCount = countErr ? 0 : (countRows?.length || 0)

    // Step 3 — Update likes on combined_media (only the 'likes' column)
    // The 'likes_count' column is maintained by a DB trigger automatically
    const { error: updateErr } = await supabase
      .from('combined_media')
      .update({ likes: newCount })
      .eq('id', releaseId)

    if (updateErr) {
      console.error('[Like API] combined_media update error:', JSON.stringify(updateErr))
      // Don't fail — the like itself succeeded
    }

    console.log('[Like API] success: liked=', liked, 'count=', newCount)
    return corsResponse(NextResponse.json({ success: true, liked, likesCount: newCount }))

  } catch (error) {
    console.error('[Like API] Unhandled POST error:', error)
    return corsResponse(NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 }))
  }
}

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return corsResponse(NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 }))
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return corsResponse(NextResponse.json({ success: false, error: 'Server config error' }, { status: 500 }))
    }

    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

    const releaseId = new URL(req.url).searchParams.get('releaseId')
    if (!releaseId) {
      return corsResponse(NextResponse.json({ success: false, error: 'Release ID required' }, { status: 400 }))
    }

    // Check user's like
    const { data: likes } = await supabase
      .from('user_likes')
      .select('id')
      .eq('user_id', userId)
      .eq('release_id', releaseId)

    const liked = !!(likes && likes.length > 0)

    // Get total count
    const { data: countData } = await supabase
      .from('combined_media')
      .select('likes')
      .eq('id', releaseId)
      .single()

    return corsResponse(NextResponse.json({
      success: true,
      liked,
      likesCount: countData?.likes || 0
    }))
  } catch (error) {
    console.error('[Like API] Unhandled GET error:', error)
    return corsResponse(NextResponse.json({ success: false, error: 'Failed to get like status' }, { status: 500 }))
  }
}
