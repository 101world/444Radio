import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { notifyGenerationComplete } from '@/lib/notifications'

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { songId, audioUrl, coverUrl } = await req.json()

    if (!songId || !audioUrl || !coverUrl) {
      return NextResponse.json({ error: 'Missing required data' }, { status: 400 })
    }

    // Update song status to complete
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    
    const updateRes = await fetch(`${supabaseUrl}/rest/v1/songs?id=eq.${songId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        status: 'complete',
        audio_url: audioUrl,
        cover_url: coverUrl
      })
    })

    if (!updateRes.ok) {
      throw new Error('Failed to finalize song')
    }

    // ALSO save to music_library for new library system
    console.log('💾 Saving to music_library...')
    
    // Get song details first
    const songRes = await fetch(`${supabaseUrl}/rest/v1/songs?id=eq.${songId}&select=*`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      }
    })
    const [songData] = await songRes.json()
    
    if (songData) {
      const libraryEntry = {
        clerk_user_id: userId,
        user_id: userId, // Save to BOTH columns
        title: songData.title || songData.prompt?.substring(0, 100) || 'Untitled',
        prompt: songData.prompt || 'Generated music',
        lyrics: songData.lyrics,
        audio_url: audioUrl,
        duration: songData.duration,
        audio_format: 'mp3',
        status: 'ready'
      }

      const saveRes = await fetch(`${supabaseUrl}/rest/v1/music_library`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify(libraryEntry)
      })

      if (saveRes.ok) {
        console.log('✅ Saved to music_library')
      } else {
        console.error('⚠️ Failed to save to music_library:', await saveRes.text())
      }
    }

    console.log('✅ Song finalized:', songId)

    // Notify user that generation is complete
    if (songData) {
      await notifyGenerationComplete(
        userId,
        songId,
        'music',
        songData.title || songData.prompt?.substring(0, 50) || 'Your track'
      )
    }

    return NextResponse.json({ 
      success: true,
      finalUrl: coverUrl, // For now, just return the cover URL
      message: 'Song finalized successfully'
    })

  } catch (error) {
    console.error('Finalization error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to finalize song'
    return NextResponse.json({ 
      success: false,
      error: errorMessage
    }, { status: 500 })
  }
}

