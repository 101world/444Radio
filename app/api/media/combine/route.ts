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

    const { audioUrl, imageUrl, title, audioPrompt, imagePrompt, isPublic, metadata } = await req.json()

    if (!audioUrl || !imageUrl) {
      return NextResponse.json(
        { error: 'Audio URL and Image URL are required' },
        { status: 400 }
      )
    }

    // Get username from users table
    const { data: userData } = await supabase
      .from('users')
      .select('username')
      .eq('clerk_user_id', userId)
      .single()

    // Insert combined media into database with metadata
    const { data, error } = await supabase
      .from('combined_media')
      .insert({
        user_id: userId,
        username: userData?.username || 'anonymous',
        audio_url: audioUrl,
        image_url: imageUrl,
        title: title || 'Untitled Track',
        audio_prompt: audioPrompt || '',
        image_prompt: imagePrompt || '',
        is_public: isPublic !== undefined ? isPublic : true,
        // Metadata for filtering and monetization
        genre: metadata?.genre || null,
        mood: metadata?.mood || null,
        bpm: metadata?.bpm || null,
        key: metadata?.key || null,
        copyright_owner: metadata?.copyrightOwner || userData?.username || 'anonymous',
        license_type: metadata?.license || 'exclusive',
        price: metadata?.price || null,
        tags: metadata?.tags || [],
        published_at: metadata?.publishedAt || new Date().toISOString()
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

