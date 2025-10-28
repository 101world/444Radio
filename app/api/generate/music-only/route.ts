import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import Replicate from 'replicate'
import { downloadAndUploadToR2 } from '@/lib/storage'
import { findBestMatchingLyrics } from '@/lib/lyrics-matcher'

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN!,
})

/**
 * Expand lyrics to reach target length based on duration
 * Short: 200-300 chars, Medium: 350-500 chars, Long: 500-600 chars
 */
function expandLyricsForDuration(baseLyrics: string, duration: 'short' | 'medium' | 'long' = 'medium'): string {
  const targetLengths = {
    short: { min: 200, max: 300 },
    medium: { min: 350, max: 500 },
    long: { min: 500, max: 600 }
  }
  
  const target = targetLengths[duration]
  
  // If lyrics are already long enough, return them (trimmed if needed)
  if (baseLyrics.length >= target.min) {
    return baseLyrics.length > 600 ? baseLyrics.substring(0, 597) + '...' : baseLyrics
  }
  
  // Add song structure to expand lyrics
  let expandedLyrics = baseLyrics
  
  // Add verse 2 if needed
  if (expandedLyrics.length < target.min) {
    expandedLyrics += `\n\n[Verse 2]\n${baseLyrics}`
  }
  
  // Add chorus if still needed
  if (expandedLyrics.length < target.min) {
    const chorusLines = baseLyrics.split('\n').slice(0, 2).join('\n')
    expandedLyrics += `\n\n[Chorus]\n${chorusLines}`
  }
  
  // Add bridge for long songs
  if (duration === 'long' && expandedLyrics.length < target.min) {
    const bridgeLines = baseLyrics.split('\n').slice(0, 2).join('\n')
    expandedLyrics += `\n\n[Bridge]\n${bridgeLines}`
  }
  
  // Add outro for long songs
  if (duration === 'long' && expandedLyrics.length < target.max) {
    const outroLines = baseLyrics.split('\n').slice(0, 1).join('\n')
    expandedLyrics += `\n\n[Outro]\n${outroLines}`
  }
  
  // Trim if too long
  if (expandedLyrics.length > 600) {
    expandedLyrics = expandedLyrics.substring(0, 597) + '...'
  }
  
  return expandedLyrics
}

// POST /api/generate/music-only - Generate ONLY music (no song record)
// For standalone music generation with preview
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { prompt, lyrics, duration = 'medium', bitrate = 256000, sample_rate = 44100, audio_format = 'mp3', language = 'English', audio_length_in_s, num_inference_steps, guidance_scale, denoising_strength } = await req.json()

    // Prompt is REQUIRED
    if (!prompt || prompt.length < 10 || prompt.length > 300) {
      return NextResponse.json({ error: 'Prompt is required (10-300 characters)' }, { status: 400 })
    }

    // If lyrics not provided, use intelligent default from dataset
    let formattedLyrics: string
    let used444Radio = false
    
    if (!lyrics || typeof lyrics !== 'string' || lyrics.trim().length === 0) {
      // Use smart lyrics matcher based on prompt (supports 444 trigger and genre matching)
      console.log('⚡ No custom lyrics provided, using smart lyrics matcher')
      console.log('  Received lyrics value:', lyrics, 'Type:', typeof lyrics)
      console.log('  Requested duration:', duration)
      
      // Check if user wants 444 Radio lyrics
      const wants444 = prompt.toLowerCase().includes('444')
      
      if (wants444) {
        // Check daily limit for 444 Radio lyrics
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
        
        const userCheckRes = await fetch(
          `${supabaseUrl}/rest/v1/users?clerk_user_id=eq.${userId}&select=last_444_radio_date`,
          {
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`
            }
          }
        )
        
        const userCheckData = await userCheckRes.json()
        const userRecord = userCheckData?.[0]
        
        const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD
        const lastUsedDate = userRecord?.last_444_radio_date
        
        if (lastUsedDate === today) {
          // User already used 444 Radio lyrics today
          return NextResponse.json({ 
            error: 'Daily 444 Radio limit reached',
            message: '444 Radio lyrics can only be generated once per day. Try again tomorrow or use custom lyrics!'
          }, { status: 429 })
        }
        
        used444Radio = true
      }
      
      const matchedSong = findBestMatchingLyrics(prompt)
      const baseLyrics = matchedSong.lyrics
      // Expand lyrics based on requested duration
      formattedLyrics = expandLyricsForDuration(baseLyrics, duration as 'short' | 'medium' | 'long')
      console.log('📝 Selected lyrics from smart matcher')
      console.log('  Song title:', matchedSong.title)
      console.log('  Genre:', matchedSong.genre)
      console.log('  Base lyrics length:', baseLyrics.length)
      console.log('  Expanded lyrics length:', formattedLyrics.length)
      console.log('  Duration:', duration)
      console.log('  Used 444 Radio:', used444Radio)
    } else {
      // Validate and expand user-provided lyrics
      console.log('📝 Using custom user-provided lyrics')
      console.log('  Original lyrics length:', lyrics.length)
      console.log('  Requested duration:', duration)
      // Expand user's custom lyrics based on duration
      formattedLyrics = expandLyricsForDuration(lyrics.trim(), duration as 'short' | 'medium' | 'long')
      console.log('  Final lyrics length:', formattedLyrics.length)
    }
    
    // CRITICAL: Ensure lyrics are NEVER empty and within API limits before sending to Replicate
    if (!formattedLyrics || formattedLyrics.length < 10) {
      console.error('❌ CRITICAL: Formatted lyrics are invalid!', formattedLyrics)
      // Fallback to a safe default
      const fallbackSong = findBestMatchingLyrics('chill vibes')
      formattedLyrics = fallbackSong.lyrics
      console.log('  ⚠️ Using fallback lyrics, length:', formattedLyrics.length)
    }
    
    // CRITICAL: Validate lyrics length for API (10-600 characters)
    if (formattedLyrics.length > 600) {
      console.warn('⚠️ Lyrics too long for API, trimming to 600 characters')
      console.log('  Original length:', formattedLyrics.length)
      // Trim to 600 characters at a word boundary
      formattedLyrics = formattedLyrics.substring(0, 597).trim() + '...'
      console.log('  Trimmed length:', formattedLyrics.length)
    }
    
    // Log for debugging
  console.log('🎵 Music Generation Request:')
    console.log('  Prompt:', prompt)
    console.log('  Lyrics length:', formattedLyrics.length)
    console.log('  Lyrics preview:', formattedLyrics.substring(0, 100) + '...')
    console.log('  Bitrate:', bitrate)
    console.log('  Sample rate:', sample_rate)
    console.log('  Format:', audio_format)
  console.log('  Language:', language)

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

    // Choose model based on language
    const isEnglish = typeof language === 'string' && (language.toLowerCase() === 'english' || language.toLowerCase() === 'en')

    let audioUrl: string
    if (isEnglish) {
      // Generate music with MiniMax Music-1.5 (English)
      console.log('🎵 Using MiniMax Music-1.5 (English) ...')
      let output
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
        console.error('❌ Music generation failed (MiniMax):', genError)
        // NO credits deducted since generation failed
        return NextResponse.json(
          { 
            success: false, 
            error: genError instanceof Error ? genError.message : 'Music generation failed',
            creditsRefunded: false,
            creditsRemaining: userCredits
          },
          { status: 500 }
        )
      }

      console.log('✅ Generation succeeded, processing output...')
      console.log('🎵 Output type:', typeof output)
      console.log('🎵 Output:', output)

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
    } else {
      // Generate music with ACE-Step for non-English
      console.log('🎵 Using ACE-Step (Multi-language) ...')
      try {
        // Use provided ACE-Step parameters or fallback to defaults
        const finalAudioLength = audio_length_in_s || 45
        const finalInferenceSteps = num_inference_steps || 50
        const finalGuidanceScale = guidance_scale || 7.0
        const finalDenoisingStrength = denoising_strength || 0.8

        console.log('🎵 ACE-Step Parameters:', {
          audio_length_in_s: finalAudioLength,
          num_inference_steps: finalInferenceSteps,
          guidance_scale: finalGuidanceScale,
          denoising_strength: finalDenoisingStrength
        })

        const prediction = await replicate.predictions.create({
          version: "lucataco/ace-step:latest",
          input: {
            // Include the lyrics inline to guide melody/words when supported
            prompt: `${prompt.trim()}\n\nLyrics:\n${formattedLyrics.substring(0, 600)}`,
            audio_length_in_s: finalAudioLength,
            num_inference_steps: finalInferenceSteps,
            guidance_scale: finalGuidanceScale,
            seed: Math.floor(Math.random() * 1_000_000),
            denoising_strength: finalDenoisingStrength
          }
        })

        console.log('🎵 ACE-Step prediction created:', prediction.id)

        let finalPrediction = prediction
        let attempts = 0
        const maxAttempts = 60 // ~2 minutes

        while (finalPrediction.status !== 'succeeded' && finalPrediction.status !== 'failed' && attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 2000))
          finalPrediction = await replicate.predictions.get(prediction.id)
          console.log('🎵 ACE-Step generation status:', finalPrediction.status)
          attempts++
        }

        if (finalPrediction.status !== 'succeeded') {
          const err = typeof finalPrediction.error === 'string' ? finalPrediction.error : 'Music generation failed'
          throw new Error(attempts >= maxAttempts ? 'Music generation timed out' : err)
        }

        const output = finalPrediction.output
        audioUrl = Array.isArray(output) ? output[0] : output
        if (!audioUrl) {
          throw new Error('No audio generated')
        }
      } catch (genError) {
        console.error('❌ Music generation failed (ACE-Step):', genError)
        // NO credits deducted since generation failed
        return NextResponse.json(
          { 
            success: false, 
            error: genError instanceof Error ? genError.message : 'Music generation failed',
            creditsRefunded: false,
            creditsRemaining: userCredits
          },
          { status: 500 }
        )
      }
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
    
    // Prepare update body
    const updateBody: { credits: number; last_444_radio_date?: string } = {
      credits: userCredits - 2
    }
    
    // If user used 444 Radio lyrics, record today's date
    if (used444Radio) {
      const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD
      updateBody.last_444_radio_date = today
      console.log('📅 Recording 444 Radio usage date:', today)
    }
    
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
        body: JSON.stringify(updateBody)
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

