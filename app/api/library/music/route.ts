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

    // Fetch from BOTH tables using both user_id and clerk_user_id to catch all user's music
    const [combinedMediaResponse, libraryResponse] = await Promise.all([
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
      )
    ])

    const combinedMediaData = await combinedMediaResponse.json()
    const libraryData = await libraryResponse.json()

    // Transform combined_media format
    const combinedMediaMusic = Array.isArray(combinedMediaData) ? combinedMediaData.map(item => ({
      id: item.id,
      clerk_user_id: item.user_id,
      user_id: item.user_id,
      title: item.title || 'Untitled',
      prompt: item.audio_prompt || item.music_prompt || 'Generated music',
      lyrics: item.lyrics,
      audio_url: item.audio_url,
      image_url: item.image_url,
      duration: item.duration,
      audio_format: 'mp3',
      status: 'ready',
      created_at: item.created_at,
      updated_at: item.updated_at
    })) : []

    // Transform combined_media_library format
    const libraryMusic = Array.isArray(libraryData) ? libraryData.map(item => ({
      id: item.id,
      clerk_user_id: item.clerk_user_id,
      user_id: item.clerk_user_id,
      title: item.title || 'Untitled',
      prompt: item.music_prompt || 'Generated music',
      lyrics: item.lyrics,
      audio_url: item.audio_url,
      image_url: item.image_url,
      duration: item.duration,
      audio_format: 'mp3',
      status: 'ready',
      created_at: item.created_at,
      updated_at: item.updated_at
    })) : []

    // Combine and deduplicate by audio_url
    const allMusic = [...combinedMediaMusic, ...libraryMusic]
    const uniqueMusic = Array.from(
      new Map(allMusic.map(item => [item.audio_url, item])).values()
    )

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

