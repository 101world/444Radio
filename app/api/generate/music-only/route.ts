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

    const { prompt, lyrics = '', bitrate = 256000, sample_rate = 44100, audio_format = 'mp3' } = await req.json()

    if (!prompt || prompt.length < 10 || prompt.length > 300) {
      return NextResponse.json({ error: 'Prompt must be 10-300 characters' }, { status: 400 })
    }

    if (lyrics && (lyrics.length < 10 || lyrics.length > 600)) {
      return NextResponse.json({ error: 'Lyrics must be 10-600 characters' }, { status: 400 })
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

    // Generate music directly with MiniMax Music-1.5
    console.log('🎵 Generating standalone music with MiniMax Music-1.5')
    console.log('🎵 Prompt:', prompt)
    console.log('🎵 Lyrics:', lyrics || '(none)')
    console.log('🎵 Parameters:', { bitrate, sample_rate, audio_format })
    
    const output = await replicate.run(
      "minimax/music-01",
      {
        input: {
          prompt,
          lyrics: lyrics || '',
          bitrate,
          sample_rate,
          audio_format
        }
      }
    )

    console.log('🎵 MusicGen output:', output)

    // MusicGen returns a URL string directly
    const audioUrl = output as unknown as string
    
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
