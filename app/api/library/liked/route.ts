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

    // Step 1: Fetch the user's liked release IDs from user_likes
    const likesRes = await fetch(
      `${supabaseUrl}/rest/v1/user_likes?user_id=eq.${userId}&select=release_id,created_at&order=created_at.desc&limit=1000`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        }
      }
    )

    if (!likesRes.ok) {
      const err = await likesRes.text()
      console.error('❤️ Liked: Failed to fetch user_likes:', likesRes.status, err)
      return NextResponse.json({ success: true, liked: [], total: 0 })
    }

    const likes = await likesRes.json()
    if (!Array.isArray(likes) || likes.length === 0) {
      return NextResponse.json({ success: true, liked: [], total: 0 })
    }


    // Step 2: Fetch all likes for these releases (who liked what)
    const releaseIds = likes.map((l: any) => l.release_id).filter(Boolean)
    if (releaseIds.length === 0) {
      return NextResponse.json({ success: true, liked: [], total: 0 })
    }
    const idsParam = `(${releaseIds.join(',')})`
    // Fetch all likes for these releases
    const allLikesRes = await fetch(
      `${supabaseUrl}/rest/v1/user_likes?release_id=in.${idsParam}&select=release_id,user_id,created_at`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        }
      }
    )
    const allLikes = allLikesRes.ok ? await allLikesRes.json() : []
    // Map: release_id -> [{user_id, created_at}]
    const likesMap: Record<string, Array<{user_id: string, created_at: string}>> = {}
    for (const l of allLikes) {
      if (!likesMap[l.release_id]) likesMap[l.release_id] = []
      likesMap[l.release_id].push({ user_id: l.user_id, created_at: l.created_at })
    }
    // Fetch media
    const mediaRes = await fetch(
      `${supabaseUrl}/rest/v1/combined_media?id=in.${idsParam}&select=*`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        }
      }
    )
    if (!mediaRes.ok) {
      const err = await mediaRes.text()
      console.error('❤️ Liked: Failed to fetch combined_media:', mediaRes.status, err)
      return NextResponse.json({ success: true, liked: [], total: 0 })
    }
    const mediaRows = await mediaRes.json()
    // Build a liked_at map for ordering
    const likedAtMap: Record<string, string> = {}
    for (const l of likes) {
      likedAtMap[l.release_id] = l.created_at
    }
    // Step 3: Normalize and sort by liked_at descending, include who liked what
    const likedTracks = Array.isArray(mediaRows)
      ? mediaRows
          .map((m: any) => ({
            ...m,
            audioUrl: m.audio_url,
            imageUrl: m.image_url,
            liked_at: likedAtMap[m.id] || m.created_at,
            likes: likesMap[m.id] || [], // who liked this track
          }))
          .sort((a: any, b: any) => new Date(b.liked_at).getTime() - new Date(a.liked_at).getTime())
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
