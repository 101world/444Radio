import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabase as supabaseClient } from '@/lib/supabase'
import { createClient } from '@supabase/supabase-js'

// Use service role for admin operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const {
      audioUrl,
      imageUrl,
      title,
      audioPrompt,
      imagePrompt,
      isPublic,
      metadata
    } = await req.json()

    console.log('🔍 [COMBINE DEBUG] Title received:', title)
    console.log('🔍 [COMBINE DEBUG] Full request body:', JSON.stringify({ audioUrl, imageUrl, title, audioPrompt, imagePrompt, isPublic, metadata }, null, 2))

    if (!audioUrl || !imageUrl) {
      return NextResponse.json(
        { error: 'Audio URL and Image URL are required' },
        { status: 400 }
      )
    }

    // Extract metadata fields
    const genre = metadata?.genre || null
    const mood = metadata?.mood || null
    const bpm = metadata?.bpm || null
    const vocals = metadata?.vocals || null
    const language = metadata?.language || null
    const description = metadata?.description || null
    const tags = metadata?.tags || []

    // Insert combined media into database with full metadata
    const { data, error } = await supabase
      .from('combined_media')
      .insert({
        user_id: userId,
        audio_url: audioUrl,
        image_url: imageUrl,
        title: title || 'Untitled Track',
        genre: genre,
        mood: mood,
        bpm: bpm,
        vocals: vocals,
        language: language,
        description: description,
        tags: tags,
        created_at: new Date().toISOString(),
        likes: 0,
        plays: 0
      })
      .select()
      .single()

    if (error) {
      console.error('Database error:', error)
      console.error('Full error details:', JSON.stringify(error, null, 2))
      console.error('Attempted insert data:', {
        user_id: userId,
        audio_url: audioUrl,
        image_url: imageUrl,
        title: title || 'Untitled Track',
        created_at: new Date().toISOString(),
        likes: 0,
        plays: 0
      })
      return NextResponse.json(
        { error: 'Failed to save combined media', details: error.message, code: error.code },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      combinedMedia: {
        ...data,
        audioUrl: data.audio_url,
        imageUrl: data.image_url
      },
      combinedId: data.id,
      message: 'Combined media saved successfully!'
    })
  } catch (error) {
    console.error('Save combined media error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// GET endpoint to fetch user's combined media
export async function GET() {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('combined_media')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch combined media' },
        { status: 500 }
      )
    }

    // Normalize field names for AudioPlayerContext compatibility
    const normalizedData = (data || []).map((item: any) => ({
      ...item,
      audioUrl: item.audio_url,
      imageUrl: item.image_url
    }))

    return NextResponse.json({
      success: true,
      combinedMedia: normalizedData
    })
  } catch (error) {
    console.error('Fetch combined media error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
