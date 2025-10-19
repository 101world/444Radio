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

    // Generate video using Wan2.2
    console.log('🎬 Generating video with Wan2.2 for:', prompt)
    
    // Create a visual prompt for music video
    const videoPrompt = `Music video visualization for: ${prompt}. Abstract, colorful, dynamic motion, artistic, cinematic`
    
    const output = (await replicate.run(
      "genmo/mochi-1-preview", // Using Mochi as proxy for Wan2.2 - update when Wan2.2 is available
      {
        input: {
          prompt: videoPrompt,
          num_frames: 120, // ~4 seconds at 30fps
        }
      }
    )) as string | string[]

    // The output is the video URL
    const videoUrl = Array.isArray(output) ? output[0] : output

    if (!videoUrl) {
      throw new Error('No video generated')
    }

    // Update song in database with cover video URL
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
        cover_url: videoUrl,
        cover_prompt: videoPrompt,
        status: 'processing_final'
      })
    })

    if (!updateRes.ok) {
      throw new Error('Failed to update song with video URL')
    }

    console.log('✅ Video generated:', videoUrl)

    return NextResponse.json({ 
      success: true, 
      coverUrl: videoUrl,
      message: 'Cover video generated successfully' 
    })

  } catch (error) {
    console.error('Video generation error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to generate cover video'
    return NextResponse.json({ 
      success: false,
      error: errorMessage
    }, { status: 500 })
  }
}
