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

    // All historical user IDs to fetch ALL songs
    const allUserIds = [
      userId,
      'user_34tKVS04YVAZHi7iHSr3aaZlU60',
      'user_34J8MP3KCfczODGn9yKMolWPX9R',
      'user_34ThsuzQnqd8zqkK5dGPrfREyoU',
      'user_34vm60RVmcQgL18b0bpS1sTYhZ',
      'user_34StnaXDJ3yZTYmz1Wmv3sYcqcB',
      'user_35HWELeD4pRQTRxTfGvWP28TnIP',
      'user_34TAjF6JtnxUyWn8nXx9tq7A3VC'
    ]

    // Fetch user's music library from ALL historical user IDs
    const response = await fetch(
      `${supabaseUrl}/rest/v1/music_library?or=(clerk_user_id.in.(${allUserIds.join(',')}),user_id.in.(${allUserIds.join(',')}))&order=created_at.desc`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        }
      }
    )

    const music = await response.json()

    // Ensure it's always an array
    const musicArray = Array.isArray(music) ? music : []

    return NextResponse.json({
      success: true,
      music: musicArray
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

