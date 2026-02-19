import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { corsResponse, handleOptions } from '@/lib/cors'
import { notifyLike } from '@/lib/notifications'
import { logLike, logUnlike } from '@/lib/activity-logger'

/**
 * Like API v4 — Uses raw Supabase REST (same pattern as working earn routes)
 * Bypasses @supabase/supabase-js entirely to eliminate client library issues
 */

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

async function sb(path: string, options?: RequestInit) {
  const res = await fetch(`${SB_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SB_KEY,
      Authorization: `Bearer ${SB_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(options?.headers || {}),
    },
  })
  return res
}

export async function OPTIONS() {
  return handleOptions()
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return corsResponse(NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 }))
    }

    let releaseId: string
    let body: any
    try {
      body = await req.json()
      releaseId = body.releaseId
      console.log('[Like API] Incoming body:', JSON.stringify(body))
      console.log('[Like API] Parsed releaseId:', releaseId)
    } catch (err) {
      console.error('[Like API] JSON parse error:', err)
      return corsResponse(NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 }))
    }

    if (!releaseId) {
      console.error('[Like API] Missing releaseId in body:', JSON.stringify(body))
      return corsResponse(NextResponse.json({ success: false, error: 'Release ID is required' }, { status: 400 }))
    }

    // Step 1 — Check existing like
    const checkRes = await sb(
      `user_likes?user_id=eq.${userId}&release_id=eq.${releaseId}&select=id`
    )
    if (!checkRes.ok) {
      const err = await checkRes.text()
      console.error('[Like API] check failed:', checkRes.status, err)
      return corsResponse(NextResponse.json({ success: false, error: 'DB check failed', detail: err }, { status: 500 }))
    }

    const existing = await checkRes.json()
    const alreadyLiked = Array.isArray(existing) && existing.length > 0
    let liked: boolean

    if (alreadyLiked) {
      // Unlike — delete row
      const delRes = await sb(
        `user_likes?user_id=eq.${userId}&release_id=eq.${releaseId}`,
        { method: 'DELETE' }
      )
      if (!delRes.ok) {
        const err = await delRes.text()
        console.error('[Like API] delete failed:', delRes.status, err)
        return corsResponse(NextResponse.json({ success: false, error: 'Unlike failed', detail: err }, { status: 500 }))
      }
      liked = false
    } else {
      // Like — insert row
      const insRes = await sb('user_likes', {
        method: 'POST',
        body: JSON.stringify({ user_id: userId, release_id: releaseId }),
      })
      if (!insRes.ok) {
        const err = await insRes.text()
        console.error('[Like API] insert failed:', insRes.status, err)
        return corsResponse(NextResponse.json({ success: false, error: 'Like failed', detail: err }, { status: 500 }))
      }
      liked = true

      // Notification: fetch media owner and insert notification if not self-like
      const mediaRes = await sb(`combined_media?id=eq.${releaseId}&select=user_id,title`)
      if (mediaRes.ok) {
        const mediaRows = await mediaRes.json()
        if (Array.isArray(mediaRows) && mediaRows.length > 0) {
          const mediaOwnerId = mediaRows[0].user_id
          const mediaTitle = mediaRows[0].title
          if (mediaOwnerId && mediaOwnerId !== userId) {
            // Notify owner of the like
            await notifyLike(mediaOwnerId, userId, releaseId, mediaTitle)
          }
        }
      }
    }

    // Step 2 — Count likes for this release
    const countRes = await sb(
      `user_likes?release_id=eq.${releaseId}&select=id`
    )
    const countRows = countRes.ok ? await countRes.json() : []
    const newCount = Array.isArray(countRows) ? countRows.length : 0

    // Step 3 — Update likes column on combined_media (non-fatal)
    const upRes = await sb(
      `combined_media?id=eq.${releaseId}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ likes: newCount }),
      }
    )
    if (!upRes.ok) {
      console.warn('[Like API] combined_media update failed:', await upRes.text())
    }

    // Log the activity (non-blocking)
    if (liked) {
      logLike(userId, releaseId).catch(err => console.error('[Like API] Activity log failed:', err))
    } else {
      logUnlike(userId, releaseId).catch(err => console.error('[Like API] Activity log failed:', err))
    }

    return corsResponse(NextResponse.json({ success: true, liked, likesCount: newCount }))
  } catch (error) {
    console.error('[Like API] POST crash:', error)
    return corsResponse(NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack?.split('\n').slice(0, 3) : undefined,
    }, { status: 500 }))
  }
}

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return corsResponse(NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 }))
    }

    const releaseId = new URL(req.url).searchParams.get('releaseId')
    if (!releaseId) {
      return corsResponse(NextResponse.json({ success: false, error: 'Release ID required' }, { status: 400 }))
    }

    // Check user's like
    const checkRes = await sb(
      `user_likes?user_id=eq.${userId}&release_id=eq.${releaseId}&select=id`
    )
    const rows = checkRes.ok ? await checkRes.json() : []
    const liked = Array.isArray(rows) && rows.length > 0

    // Get total count from combined_media
    const countRes = await sb(
      `combined_media?id=eq.${releaseId}&select=likes`
    )
    const media = countRes.ok ? await countRes.json() : []
    const likesCount = Array.isArray(media) && media.length > 0 ? (media[0].likes || 0) : 0

    return corsResponse(NextResponse.json({ success: true, liked, likesCount }))
  } catch (error) {
    console.error('[Like API] GET crash:', error)
    return corsResponse(NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 }))
  }
}
