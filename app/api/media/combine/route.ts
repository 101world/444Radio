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

    const { audioUrl, imageUrl, title, audioPrompt, imagePrompt, isPublic, metadata } = await req.json()

    if (!audioUrl || !imageUrl) {
      return NextResponse.json(
        { error: 'Audio URL and Image URL are required' },
        { status: 400 }
      )
    }

    // Build insert object with only core fields (combined_media table has limited columns)
    const insertData: any = {
      user_id: userId,
      audio_url: audioUrl,
      image_url: imageUrl,
      title: title || 'Untitled Track',
      audio_prompt: audioPrompt || '',
      image_prompt: imagePrompt || '',
      is_public: isPublic !== false, // Default to true
      is_published: true // Mark as published so releases tab can find it
    }

    // Add metadata fields only if they exist in the schema
    if (metadata) {
      if (metadata.genre) insertData.genre = metadata.genre
      if (metadata.mood) insertData.mood = metadata.mood
      if (metadata.tags) insertData.tags = metadata.tags
      if (metadata.description) insertData.description = metadata.description
      if (metadata.bpm) insertData.bpm = metadata.bpm
      if (metadata.vocals) insertData.vocals = metadata.vocals
      if (metadata.language) insertData.language = metadata.language
    }

    // Insert combined media into database
    const { data, error } = await supabase
      .from('combined_media')
      .insert(insertData)
      .select()
      .single()

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json(
        { error: 'Failed to save combined media', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      combinedMedia: data,
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

    return NextResponse.json({
      success: true,
      combinedMedia: data
    })
  } catch (error) {
    console.error('Fetch combined media error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

