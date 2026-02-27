import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { corsResponse, handleOptions } from '@/lib/cors'

export async function OPTIONS() {
  return handleOptions()
}

/**
 * GET /api/library/releases
 * Get all published releases (tracks with both audio and image) from user's library
 */
export async function GET() {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return corsResponse(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

    // Fetch published releases from BOTH tables
    // Exclude stems, extracts, effects, loops, visualizers, processed, chords, voice-over, boosted
    const excludedGenres = ['stem', 'extract', 'loop', 'effects', 'processed', 'chords', 'voice-over', 'boosted', 'visualizer']
    const genreFilter = excludedGenres.map(g => `genre.neq.${g}`).join('&')

    const [combinedMediaResponse, libraryResponse] = await Promise.all([
      // combined_media - items with both audio and image, uses user_id
      // Exclude derivative content (stems, extracts, etc.) and items without a parent_track_id
      fetch(
        `${supabaseUrl}/rest/v1/combined_media?user_id=eq.${userId}&audio_url=not.is.null&image_url=not.is.null&parent_track_id=is.null&${genreFilter}&order=created_at.desc`,
        {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          }
        }
      ),
      // combined_media_library - uses clerk_user_id
      fetch(
        `${supabaseUrl}/rest/v1/combined_media_library?clerk_user_id=eq.${userId}&order=created_at.desc`,
        {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          }
        }
      )
    ])

    const combinedMediaData = await combinedMediaResponse.json()
    const libraryData = await libraryResponse.json()

    // Transform combined_media format - exclude derivative content
    // (is_published can be true, false, or null - we show all complete releases)
    const combinedReleases = Array.isArray(combinedMediaData) 
      ? combinedMediaData
          .filter(item => {
            // Extra safety: exclude items whose image_url is actually a video
            const imgUrl = (item.image_url || '').toLowerCase()
            if (imgUrl.endsWith('.mp4') || imgUrl.endsWith('.webm') || imgUrl.includes('/videos/')) return false
            // Exclude visualizer-titled items that slipped through
            if (item.title?.startsWith('Visualizer:')) return false
            return true
          })
          .map(item => ({
            id: item.id,
            clerk_user_id: item.user_id,
            title: item.title || 'Untitled',
            music_prompt: item.audio_prompt || item.music_prompt,
            image_prompt: item.image_prompt,
            audioUrl: item.audio_url, // Normalized for AudioPlayerContext
            audio_url: item.audio_url, // Keep for backward compat
            imageUrl: item.image_url, // Normalized for AudioPlayerContext
            image_url: item.image_url, // Keep for backward compat
            lyrics: item.lyrics,
            is_published: true,
            created_at: item.created_at,
            updated_at: item.updated_at
          }))
      : []

    // Transform combined_media_library format - include ALL items with both audio and image
    const libraryReleases = Array.isArray(libraryData) 
      ? libraryData
          .filter(item => item.audio_url && item.image_url)
          .map(item => ({
            id: item.id,
            clerk_user_id: item.clerk_user_id,
            title: item.title || 'Untitled',
            music_prompt: item.music_prompt,
            image_prompt: item.image_prompt,
            audioUrl: item.audio_url, // Normalized for AudioPlayerContext
            audio_url: item.audio_url, // Keep for backward compat
            imageUrl: item.image_url, // Normalized for AudioPlayerContext
            image_url: item.image_url, // Keep for backward compat
            lyrics: item.lyrics,
            is_published: true,
            created_at: item.created_at,
            updated_at: item.updated_at
          }))
      : []

    // Combine and deduplicate by audio_url
    const allReleases = [...combinedReleases, ...libraryReleases]
    const uniqueReleases = Array.from(
      new Map(allReleases.map(item => [item.audio_url, item])).values()
    )

    console.log(`🎵 Releases: Fetched ${uniqueReleases.length} published releases`)

    return corsResponse(NextResponse.json({
      success: true,
      releases: uniqueReleases,
      total: uniqueReleases.length
    }))

  } catch (error) {
    console.error('Error fetching releases:', error)
    return corsResponse(NextResponse.json(
      { error: 'Failed to fetch releases' },
      { status: 500 }
    ))
  }
}

/**
 * DELETE /api/library/releases?id=xxx
 * Delete a release from the library
 */
export async function DELETE(request: Request) {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return corsResponse(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return corsResponse(NextResponse.json({ error: 'Release ID required' }, { status: 400 }))
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

    // Delete from both tables
    const [combinedMediaResponse, libraryResponse] = await Promise.all([
      // combined_media
      fetch(
        `${supabaseUrl}/rest/v1/combined_media?id=eq.${id}&user_id=eq.${userId}`,
        {
          method: 'DELETE',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          }
        }
      ),
      // combined_media_library
      fetch(
        `${supabaseUrl}/rest/v1/combined_media_library?id=eq.${id}&clerk_user_id=eq.${userId}`,
        {
          method: 'DELETE',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          }
        }
      )
    ])

    if (!combinedMediaResponse.ok && !libraryResponse.ok) {
      console.error('Failed to delete release from both tables')
      return corsResponse(NextResponse.json(
        { error: 'Failed to delete release' },
        { status: 500 }
      ))
    }

    console.log(`🗑️ Deleted release ${id} for user ${userId}`)

    return corsResponse(NextResponse.json({
      success: true,
      message: 'Release deleted successfully'
    }))

  } catch (error) {
    console.error('Error deleting release:', error)
    return corsResponse(NextResponse.json(
      { error: 'Failed to delete release' },
      { status: 500 }
    ))
  }
}
