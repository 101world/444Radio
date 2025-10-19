import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import Replicate from 'replicate'

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN!,
})

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { songId, prompt } = await req.json()

    if (!songId || !prompt) {
      return NextResponse.json({ error: 'Missing songId or prompt' }, { status: 400 })
    }

    // Generate music using MiniMax
    console.log('🎵 Generating music with MiniMax for:', prompt)
    
    const output = (await replicate.run(
      "minimax/music-01",
      {
        input: {
          prompt: prompt,
          model: "music-01",
        }
      }
    )) as string | string[]

    // The output is the audio URL
    const audioUrl = Array.isArray(output) ? output[0] : output

    if (!audioUrl) {
      throw new Error('No audio generated')
    }

    // Update song in database with audio URL and status
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
        audio_url: audioUrl,
        status: 'processing_cover'
      })
    })

    if (!updateRes.ok) {
      throw new Error('Failed to update song with audio URL')
    }

    console.log('✅ Music generated:', audioUrl)

    return NextResponse.json({ 
      success: true, 
      audioUrl,
      message: 'Music generated successfully' 
    })

  } catch (error) {
    console.error('Music generation error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to generate music'
    return NextResponse.json({ 
      success: false,
      error: errorMessage
    }, { status: 500 })
  }
}
