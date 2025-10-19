import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import Replicate from 'replicate'

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN!,
})

// POST /api/generate/music-only - Generate ONLY music (no song record)
// For standalone music generation with preview
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { prompt, duration = 8 } = await req.json()

    if (!prompt) {
      return NextResponse.json({ error: 'Missing prompt' }, { status: 400 })
    }

    // Check user credits (music costs 2 credits)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    
    const userRes = await fetch(
      `${supabaseUrl}/rest/v1/users?clerk_user_id=eq.${userId}&select=credits`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`
        }
      }
    )
    
    const users = await userRes.json()
    if (!users || users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const userCredits = users[0].credits || 0
    if (userCredits < 2) {
      return NextResponse.json({ 
        error: 'Insufficient credits. Music generation requires 2 credits.' 
      }, { status: 402 })
    }

    // Generate music directly with MusicGen
    console.log('🎵 Generating standalone music with MusicGen')
    console.log('🎵 Prompt:', prompt)
    console.log('🎵 Duration:', duration)
    
    const output = await replicate.run(
      "meta/musicgen",
      {
        input: {
          prompt,
          duration: duration,
          temperature: 1,
          top_k: 250,
          top_p: 0,
          classifier_free_guidance: 3
        }
      }
    )

    console.log('🎵 MusicGen output:', output)

    // MusicGen returns a URL string directly
    let audioUrl = output as unknown as string
    
    if (!audioUrl) {
      throw new Error('No audio generated')
    }

    // Deduct credits (-2 for music)
    await fetch(
      `${supabaseUrl}/rest/v1/users?clerk_user_id=eq.${userId}`,
      {
        method: 'PATCH',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
          credits: userCredits - 2
        })
      }
    )

    console.log('✅ Music generated successfully:', audioUrl)
    
    return NextResponse.json({
      success: true,
      audioUrl,
      creditsRemaining: userCredits - 2
    })

  } catch (error) {
    console.error('❌ Music generation error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Music generation failed' 
      },
      { status: 500 }
    )
  }
}
