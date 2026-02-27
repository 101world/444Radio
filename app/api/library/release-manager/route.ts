import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { corsResponse, handleOptions } from '@/lib/cors'

export function OPTIONS() {
  return handleOptions()
}

/**
 * GET /api/library/release-manager
 * Fetch user's generated tracks from combined_media for the Release Manager.
 * Returns actual is_public status so user can see what's published vs unpublished.
 * Excludes derivative content (stems, effects, loops, etc.) and non-audio items.
 */
export async function GET() {
  try {
    const { userId } = await auth()

    if (!userId) {
      return corsResponse(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

    // Exclude derivative/tool content
    const excludedGenres = ['stem', 'extract', 'loop', 'effects', 'processed', 'chords', 'voice-over', 'boosted', 'visualizer', 'beatmaker']
    const genreFilter = excludedGenres.map(g => `genre.neq.${g}`).join('&')

    const response = await fetch(
      `${supabaseUrl}/rest/v1/combined_media?user_id=eq.${userId}&audio_url=not.is.null&parent_track_id=is.null&${genreFilter}&order=created_at.desc`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        }
      }
    )

    const data = await response.json()
    const items = Array.isArray(data) ? data : []

    // Filter out non-music items (videos, visualizers by title, etc.)
    const releases = items
      .filter(item => {
        const imgUrl = (item.image_url || '').toLowerCase()
        if (imgUrl.endsWith('.mp4') || imgUrl.endsWith('.webm') || imgUrl.includes('/videos/')) return false
        if (item.title?.startsWith('Visualizer:')) return false
        if (item.type === 'video') return false
        return true
      })
      .map(item => ({
        id: item.id,
        title: item.title || 'Untitled',
        audio_url: item.audio_url,
        image_url: item.image_url,
        lyrics: item.lyrics,
        music_prompt: item.audio_prompt || item.music_prompt || null,
        image_prompt: item.image_prompt || null,
        genre: item.genre || null,
        is_published: item.is_public === true,
        created_at: item.created_at,
      }))

    return corsResponse(NextResponse.json({
      success: true,
      releases,
      total: releases.length,
    }))

  } catch (error) {
    console.error('Error fetching release manager data:', error)
    return corsResponse(NextResponse.json(
      { error: 'Failed to fetch releases' },
      { status: 500 }
    ))
  }
}

/**
 * PATCH /api/library/release-manager
 * Update title or publish status on combined_media.
 * Publishing sets is_public=true so the track appears on Radio/Explore.
 */
export async function PATCH(req: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return corsResponse(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
    }

    const body = await req.json()
    const { id, title, is_published } = body

    if (!id) {
      return corsResponse(NextResponse.json({ error: 'Missing track ID' }, { status: 400 }))
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

    // Build update payload
    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    }

    if (title !== undefined) {
      updatePayload.title = title
    }

    if (is_published !== undefined) {
      updatePayload.is_public = is_published
      updatePayload.is_published = is_published
    }

    const response = await fetch(
      `${supabaseUrl}/rest/v1/combined_media?id=eq.${id}&user_id=eq.${userId}`,
      {
        method: 'PATCH',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation',
        },
        body: JSON.stringify(updatePayload),
      }
    )

    const updated = await response.json()

    if (!response.ok) {
      console.error('Supabase PATCH error:', updated)
      return corsResponse(NextResponse.json(
        { error: updated.message || 'Failed to update' },
        { status: response.status }
      ))
    }

    if (!Array.isArray(updated) || updated.length === 0) {
      return corsResponse(NextResponse.json(
        { error: 'Track not found or not owned by you' },
        { status: 404 }
      ))
    }

    // If publishing, also update username on the record for display
    if (is_published && updated.length > 0) {
      try {
        const { clerkClient } = await import('@clerk/nextjs/server')
        const client = await clerkClient()
        const clerkUser = await client.users.getUser(userId)
        const username = clerkUser?.username || clerkUser?.firstName || `user_${userId.slice(-8)}`

        await fetch(
          `${supabaseUrl}/rest/v1/combined_media?id=eq.${id}&user_id=eq.${userId}`,
          {
            method: 'PATCH',
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username }),
          }
        )
      } catch (err) {
        console.error('Failed to update username on publish:', err)
      }
    }

    // Quest progress tracking (fire-and-forget)
    if (is_published) {
      import('@/lib/quest-progress').then(({ trackQuestProgress, trackReleaseStreak }) => {
        trackQuestProgress(userId!, 'share_tracks').catch(() => {})
        trackReleaseStreak(userId!).catch(() => {})
      }).catch(() => {})
    }

    console.log(`✅ Release manager: updated track ${id} for user ${userId}`)

    return corsResponse(NextResponse.json({
      success: true,
      track: updated[0],
    }))

  } catch (error) {
    console.error('Error updating release:', error)
    return corsResponse(NextResponse.json(
      { error: 'Failed to update release' },
      { status: 500 }
    ))
  }
}
