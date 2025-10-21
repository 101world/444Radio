import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import Replicate from 'replicate'
import { downloadAndUploadToR2 } from '@/lib/storage'

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

    const { prompt, lyrics, bitrate = 256000, sample_rate = 44100, audio_format = 'mp3' } = await req.json()

    // Prompt is REQUIRED
    if (!prompt || prompt.length < 10 || prompt.length > 300) {
      return NextResponse.json({ error: 'Prompt is required (10-300 characters)' }, { status: 400 })
    }

    // If lyrics not provided, generate default lyrics based on prompt
    let formattedLyrics: string
    if (!lyrics || lyrics.trim().length === 0) {
      // Generate simple default lyrics from prompt
      console.log('⚡ No custom lyrics provided, generating defaults from prompt')
      formattedLyrics = `[verse]\n${prompt}\nFeeling the rhythm all night long\nThis is where I belong\n\n[chorus]\n${prompt}\nLet the music play on and on\nUntil the break of dawn`
    } else {
      // Validate user-provided lyrics
      if (lyrics.trim().length < 10 || lyrics.length > 600) {
        return NextResponse.json({ error: 'Lyrics must be 10-600 characters. Please add structure tags like [verse] [chorus]' }, { status: 400 })
      }
      formattedLyrics = lyrics.trim()
    }
    
    // Log for debugging
    console.log('🎵 Music Generation Request:')
    console.log('  Prompt:', prompt)
    console.log('  Lyrics length:', formattedLyrics.length)
    console.log('  Lyrics preview:', formattedLyrics.substring(0, 100) + '...')
    console.log('  Bitrate:', bitrate)
    console.log('  Sample rate:', sample_rate)
    console.log('  Format:', audio_format)

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
        error: 'Insufficient credits. Music generation requires 2 credits.',
        creditsNeeded: 2,
        creditsAvailable: userCredits
      }, { status: 402 })
    }

    console.log(`💰 User has ${userCredits} credits. Music requires 2 credits.`)

    // Generate music directly with MiniMax Music-1.5
    console.log('🎵 Calling MiniMax Music-1.5 API...')
    
    let output;
    try {
      output = await replicate.run(
        "minimax/music-1.5",
        {
          input: {
            prompt: prompt.trim(),
            lyrics: formattedLyrics,
            bitrate,
            sample_rate,
            audio_format
          }
        }
      )
      console.log('✅ MiniMax Music-1.5 API response received')
    } catch (genError) {
      console.error('❌ Music generation failed:', genError)
      // NO credits deducted since generation failed
      return NextResponse.json(
        { 
          success: false, 
          error: genError instanceof Error ? genError.message : 'Music generation failed',
          creditsRefunded: false, // No deduction happened
          creditsRemaining: userCredits
        },
        { status: 500 }
      )
    }

    console.log('✅ Generation succeeded, processing output...')
    console.log('🎵 Output type:', typeof output)
    console.log('🎵 Output:', output)

    // Output is a file object with url() method
    let audioUrl: string
    
    if (typeof output === 'string') {
      audioUrl = output
    } else if (output && typeof (output as { url?: () => string }).url === 'function') {
      audioUrl = (output as { url: () => string }).url()
    } else if (output && typeof output === 'object' && 'url' in output) {
      audioUrl = (output as { url: string }).url
    } else {
      console.error('❌ Unexpected output format:', output)
      throw new Error('Invalid output format from API')
    }
    
    if (!audioUrl) {
      throw new Error('No audio URL in response')
    }

    console.log('🎵 Audio URL extracted:', audioUrl)

    // Upload to R2 for permanent storage
    console.log('📦 Uploading to R2 for permanent storage...')
    const fileName = `${prompt.substring(0, 30).replace(/[^a-zA-Z0-9]/g, '-')}-${Date.now()}.${audio_format}`
    
    const r2Result = await downloadAndUploadToR2(
      audioUrl,
      userId,
      'music',
      fileName
    )

    if (!r2Result.success) {
      console.error('⚠️ R2 upload failed, using Replicate URL:', r2Result.error)
      // Continue with Replicate URL if R2 fails
    } else {
      console.log('✅ R2 upload successful:', r2Result.url)
      // Use permanent R2 URL instead of temporary Replicate URL
      audioUrl = r2Result.url
    }

    // Save to music_library table first
    console.log('💾 Saving to music library...')
    const libraryEntry = {
      clerk_user_id: userId,
      title: prompt.substring(0, 100), // Use first 100 chars of prompt as title
      prompt: prompt,
      lyrics: formattedLyrics,
      audio_url: audioUrl,
      audio_format: audio_format,
      bitrate: bitrate,
      sample_rate: sample_rate,
      generation_params: {
        bitrate,
        sample_rate,
        audio_format
      },
      status: 'ready'
    }

    const saveResponse = await fetch(
      `${supabaseUrl}/rest/v1/music_library`,
      {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(libraryEntry)
      }
    )

    const savedMusic = await saveResponse.json()
    console.log('✅ Saved to library:', savedMusic)

    // NOW deduct credits (-2 for music) since everything succeeded
    console.log(`💰 Deducting 2 credits from user (${userCredits} → ${userCredits - 2})`)
    const creditDeductRes = await fetch(
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

    if (!creditDeductRes.ok) {
      console.error('⚠️ Failed to deduct credits, but generation succeeded')
      // Continue anyway - better to give free generation than lose the work
    } else {
      console.log('✅ Credits deducted successfully')
    }

    console.log('✅ Music generated successfully:', audioUrl)
    
    return NextResponse.json({
      success: true,
      audioUrl,
      libraryId: savedMusic[0]?.id,
      creditsRemaining: userCredits - 2,
      creditsDeducted: 2
    })

  } catch (error) {
    console.error('❌ Music generation error:', error)
    console.log('💰 No credits deducted due to error')
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Music generation failed',
        creditsRefunded: false, // No deduction happened
        // Note: We don't have userCredits here if error happened before credit check
      },
      { status: 500 }
    )
  }
}

