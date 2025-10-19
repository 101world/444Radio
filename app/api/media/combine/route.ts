import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'

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

    const { audioUrl, imageUrl, title, audioPrompt, imagePrompt, isPublic } = await req.json()

    if (!audioUrl || !imageUrl) {
      return NextResponse.json(
        { error: 'Audio URL and Image URL are required' },
        { status: 400 }
      )
    }

    // Insert combined media into database
    const { data, error } = await supabase
      .from('combined_media')
      .insert({
        user_id: userId,
        audio_url: audioUrl,
        image_url: imageUrl,
        title: title || 'Untitled Track',
        audio_prompt: audioPrompt || '',
        image_prompt: imagePrompt || '',
        is_public: isPublic !== undefined ? isPublic : true
      })
      .select()
      .single()

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json(
        { error: 'Failed to save combined media' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      combinedMedia: data,
      message: 'Combined media saved successfully!'
    })
  } catch (error) {
    console.error('Save combined media error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET endpoint to fetch user's combined media
export async function GET(req: NextRequest) {
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
