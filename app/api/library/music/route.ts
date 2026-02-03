import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

/**
 * GET /api/library/music
 * Get all music files from user's library
 */
export async function GET() {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

    // Fetch from ALL sources: 3 database tables + R2 direct listing (for old files without DB entries)
    const [combinedMediaResponse, combinedLibraryResponse, musicLibraryResponse, r2Response] = await Promise.all([
      // combined_media - has audio_url directly, uses user_id column
      fetch(
        `${supabaseUrl}/rest/v1/combined_media?audio_url=not.is.null&user_id=eq.${userId}&order=created_at.desc`,
        {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          }
        }
      ),
      // combined_media_library - uses clerk_user_id column
      fetch(
        `${supabaseUrl}/rest/v1/combined_media_library?clerk_user_id=eq.${userId}&order=created_at.desc`,
        {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          }
        }
      ),
      // music_library - uses clerk_user_id column
      fetch(
        `${supabaseUrl}/rest/v1/music_library?clerk_user_id=eq.${userId}&order=created_at.desc`,
        {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          }
        }
      ),
      // R2 direct listing - catches old files that were uploaded but not saved to DB
      fetch(
        `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/r2/list-audio`,
        {
          headers: {
            'Cookie': `__session=${userId}` // Pass auth context
          }
        }
      ).catch(err => {
        console.warn('⚠️ R2 listing failed, continuing without R2 files:', err.message)
        return { ok: false, json: async () => ({ music: [] }) }
      })
    ])

    const combinedMediaData = await combinedMediaResponse.json()
    const combinedLibraryData = await combinedLibraryResponse.json()
    const musicLibraryData = await musicLibraryResponse.json()
    const r2Data = r2Response.ok ? await r2Response.json() : { music: [] }

    // Transform combined_media format
    const combinedMediaMusic = Array.isArray(combinedMediaData) ? combinedMediaData.map(item => ({
      id: item.id,
      clerk_user_id: item.user_id,
      user_id: item.user_id,
      title: item.title || 'Untitled',
      prompt: item.prompt || item.audio_prompt || item.music_prompt || 'Generated audio',
      lyrics: item.lyrics,
      audioUrl: item.audio_url || item.audioUrl, // Normalize to audioUrl
      audio_url: item.audio_url, // Keep for backward compat
      imageUrl: item.image_url || item.imageUrl, // Normalize to imageUrl
      image_url: item.image_url, // Keep for backward compat
      duration: item.duration,
      audio_format: 'mp3',
      status: 'ready',
      created_at: item.created_at,
      updated_at: item.updated_at
    })) : []

    // Transform combined_media_library format
    const combinedLibraryMusic = Array.isArray(combinedLibraryData) ? combinedLibraryData.map(item => ({
      id: item.id,
      clerk_user_id: item.clerk_user_id,
      user_id: item.clerk_user_id,
      title: item.title || 'Untitled',
      prompt: item.music_prompt || 'Generated music',
      lyrics: item.lyrics,
      audioUrl: item.audio_url || item.audioUrl, // Normalize to audioUrl
      audio_url: item.audio_url, // Keep for backward compat
      imageUrl: item.image_url || item.imageUrl, // Normalize to imageUrl
      image_url: item.image_url, // Keep for backward compat
      duration: item.duration,
      audio_format: 'mp3',
      status: 'ready',
      created_at: item.created_at,
      updated_at: item.updated_at
    })) : []

    // Transform music_library format
    const musicLibraryMusic = Array.isArray(musicLibraryData) ? musicLibraryData.map(item => ({
      id: item.id,
      clerk_user_id: item.clerk_user_id,
      user_id: item.clerk_user_id,
      title: item.title || 'Untitled',
      prompt: item.prompt || 'Generated music',
      lyrics: item.lyrics,
      audio_url: item.audio_url,
      image_url: null,
      duration: item.duration,
      audio_format: item.audio_format || 'mp3',
      status: item.status || 'ready',
      created_at: item.created_at,
      updated_at: item.updated_at
    })) : []

    // Transform R2 files (old files without DB entries - will have UUID/number filenames as titles)
    const r2Music = Array.isArray(r2Data.music) ? r2Data.music.map((item: any) => ({
      id: `r2_${item.id}`, // Prefix to distinguish from DB records
      clerk_user_id: userId,
      user_id: userId,
      title: item.title || 'Untitled R2 Track', // Will be UUID filename for old files
      prompt: item.prompt || 'Legacy R2 file',
      lyrics: item.lyrics || null,
      audio_url: item.audio_url,
      image_url: null,
      duration: item.duration || null,
      audio_format: 'mp3',
      status: 'ready',
      created_at: item.created_at,
      updated_at: item.created_at,
      source: 'r2' // Mark as R2-only file
    })) : []

    // Combine ALL FOUR sources and deduplicate by audio_url (DB entries take precedence over R2)
    const allMusic = [...combinedMediaMusic, ...combinedLibraryMusic, ...musicLibraryMusic, ...r2Music]
    const uniqueMusic = Array.from(
      new Map(allMusic.map(item => [item.audio_url, item])).values()
    )

    console.log(`🎵 Music Library: ${uniqueMusic.length} tracks (DB: ${allMusic.length - r2Music.length}, R2-only: ${r2Music.length})`)

    // Sort by created_at descending (newest first) after deduplication
    uniqueMusic.sort((a, b) => {
      const dateA = new Date(a.created_at || 0).getTime()
      const dateB = new Date(b.created_at || 0).getTime()
      return dateB - dateA // Descending: newest first
    })

    return NextResponse.json({
      success: true,
      music: uniqueMusic
    })

  } catch (error) {
    console.error('Error fetching music library:', error)
    return NextResponse.json(
      { error: 'Failed to fetch music library' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/library/music?id=xxx
 * Delete a music file from library and all related combined media
 */
export async function DELETE(req: NextRequest) {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Missing music ID' }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

    // First, get the audio_url from music_library to find related records
    const getResponse = await fetch(
      `${supabaseUrl}/rest/v1/music_library?id=eq.${id}&clerk_user_id=eq.${userId}&select=audio_url`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        }
      }
    )
    
    const musicData = await getResponse.json()
    const audioUrl = Array.isArray(musicData) && musicData.length > 0 ? musicData[0].audio_url : null

    // Delete from music_library
    await fetch(
      `${supabaseUrl}/rest/v1/music_library?id=eq.${id}&clerk_user_id=eq.${userId}`,
      {
        method: 'DELETE',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        }
      }
    )

    // If we found the audio_url, also delete from combined_media table (published releases)
    if (audioUrl) {
      await fetch(
        `${supabaseUrl}/rest/v1/combined_media?audio_url=eq.${encodeURIComponent(audioUrl)}&user_id=eq.${userId}`,
        {
          method: 'DELETE',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          }
        }
      )

      // Also delete from combined_media_library (unpublished library items)
      await fetch(
        `${supabaseUrl}/rest/v1/combined_media_library?audio_url=eq.${encodeURIComponent(audioUrl)}&clerk_user_id=eq.${userId}`,
        {
          method: 'DELETE',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          }
        }
      )
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Error deleting music:', error)
    return NextResponse.json(
      { error: 'Failed to delete music' },
      { status: 500 }
    )
  }
}

