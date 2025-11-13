import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { corsResponse, handleOptions } from '@/lib/cors'

export async function OPTIONS() {
  return handleOptions()
}

/**
 * GET /api/library/music
 * Get all music files from user's library
 */
export async function GET() {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return corsResponse(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

    // All historical user IDs
    const allUserIds = [
      userId,
      'user_34TAjF6JtnxUyWn8nXx9tq7A3VC',
      'user_35HWELeD4pRQTRxTfGvWP28TnIP',
      'user_34vm60RVmcQgL18b0bpS1sTYhZ',
      'user_34ThsuzQnqd8zqkK5dGPrfREyoU',
      'user_34tKVS04YVAZHi7iHSr3aaZlU60',
      'user_34StnaXDJ3yZTYmz1Wmv3sYcqcB'
    ]

    // Fetch from music_library using ALL user IDs in BOTH columns
    const mlResponse = await fetch(
      `${supabaseUrl}/rest/v1/music_library?or=(clerk_user_id.in.(${allUserIds.join(',')}),user_id.in.(${allUserIds.join(',')}))&order=created_at.desc`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        }
      }
    )
    const musicLibraryData = await mlResponse.json()

    // ALSO fetch from combined_media where audio exists (uses user_id)
    // NOTE: Fetching for ALL known user IDs to show ALL historical songs
    const cmResponse = await fetch(
      `${supabaseUrl}/rest/v1/combined_media?user_id=in.(${allUserIds.join(',')})&audio_url=not.is.null&order=created_at.desc`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        }
      }
    )
    const combinedMediaData = await cmResponse.json()

    // Combine both sources, removing duplicates by audio_url
    const allMusic = [
      ...(Array.isArray(musicLibraryData) ? musicLibraryData : []),
      ...(Array.isArray(combinedMediaData) ? combinedMediaData.map(item => ({
        id: item.id,
        clerk_user_id: item.user_id,
        title: item.title || 'Untitled',
        prompt: item.audio_prompt || 'Generated music',
        lyrics: item.lyrics,
        audio_url: item.audio_url,
        duration: item.duration,
        audio_format: 'mp3',
        status: 'ready',
        created_at: item.created_at,
        updated_at: item.updated_at
      })) : [])
    ]

    // Remove duplicates by audio_url
    const seen = new Set()
    const musicArray = allMusic.filter(item => {
      if (seen.has(item.audio_url)) return false
      seen.add(item.audio_url)
      return true
    })

    return corsResponse(NextResponse.json({
      success: true,
      music: musicArray
    }))

  } catch (error) {
    console.error('Error fetching music library:', error)
    return corsResponse(NextResponse.json(
      { error: 'Failed to fetch music library' },
      { status: 500 }
    ))
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
      return corsResponse(NextResponse.json({ error: 'Missing music ID' }, { status: 400 }))
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

    return corsResponse(NextResponse.json({ success: true }))

  } catch (error) {
    console.error('Error deleting music:', error)
    return corsResponse(NextResponse.json(
      { error: 'Failed to delete music' },
      { status: 500 }
    ))
  }
}

