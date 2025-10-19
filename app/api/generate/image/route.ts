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

    // Generate cover art using Flux Schnell
    console.log('🎨 Generating cover art with Flux Schnell for:', prompt)
    
    // Create a visual prompt for album cover
    const coverPrompt = `Album cover art for: ${prompt}. Professional music album artwork, vibrant colors, artistic, high quality, studio lighting`
    
    const output = (await replicate.run(
      "black-forest-labs/flux-schnell",
      {
        input: {
          prompt: coverPrompt,
          num_outputs: 1,
          aspect_ratio: "1:1",
          output_format: "webp",
          output_quality: 90
        }
      }
    )) as string | string[]

    // The output is the image URL
    const imageUrl = Array.isArray(output) ? output[0] : output

    if (!imageUrl) {
      throw new Error('No image generated')
    }

    // Update song in database with cover URL
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
        cover_url: imageUrl,
        cover_prompt: coverPrompt,
        status: 'processing_final'
      })
    })

    if (!updateRes.ok) {
      throw new Error('Failed to update song with cover URL')
    }

    console.log('✅ Cover art generated:', imageUrl)

    return NextResponse.json({ 
      success: true, 
      coverUrl: imageUrl,
      message: 'Cover art generated successfully' 
    })

  } catch (error) {
    console.error('Image generation error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to generate cover art'
    return NextResponse.json({ 
      success: false,
      error: errorMessage
    }, { status: 500 })
  }
}
