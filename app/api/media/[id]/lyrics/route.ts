import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabase } from '@/lib/supabase'

// GET /api/media/[id]/lyrics - Get lyrics for a media item
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: mediaId } = await params

    // Fetch lyrics from combined_media table
    const { data, error } = await supabase
      .from('combined_media')
      .select('lyrics, title, type')
      .eq('id', mediaId)
      .single()

    if (error) {
      console.error('Error fetching lyrics:', error)
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to fetch lyrics' 
      }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({ 
        success: false, 
        error: 'Media not found' 
      }, { status: 404 })
    }

    // Only audio/music types have lyrics (type can be 'audio', 'music', or null for older tracks)
    const hasLyrics = !data.type || data.type === 'audio' || data.type === 'music'
    if (!hasLyrics) {
      return NextResponse.json({ 
        success: false, 
        error: 'This media type does not have lyrics' 
      }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      lyrics: data.lyrics || null,
      title: data.title
    })

  } catch (error) {
    console.error('Lyrics API error:', error)
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}
