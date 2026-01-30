import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import Replicate from 'replicate'
import { downloadAndUploadToR2 } from '@/lib/storage'
import { findBestMatchingLyrics } from '@/lib/lyrics-matcher'

// Allow up to 5 minutes for music generation (Vercel Pro limit: 300s)
export const maxDuration = 300

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_KEY_LATEST!,
})

/**
 * Sanitize error messages to hide technical details from users
 */
function sanitizeError(error: any): string {
  const errorStr = error instanceof Error ? error.message : String(error)
  
  // Hide all technical details - users should only see generic message
  if (errorStr.includes('429') || 
      errorStr.includes('rate limit') || 
      errorStr.includes('replicate') ||
      errorStr.includes('supabase') ||
      errorStr.includes('cloudflare') ||
      errorStr.includes('vercel') ||
      errorStr.includes('API') ||
      errorStr.includes('throttled') ||
      errorStr.includes('prediction') ||
      errorStr.includes('status') ||
      errorStr.includes('failed with')) {
    return '444 radio is locking in, please try again in few minutes'
  }
  
  // Generic fallback for any other technical errors
  return '444 radio is locking in, please try again in few minutes'
}

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

    const { title, prompt, lyrics, duration = 'medium', genre, bpm, bitrate = 256000, sample_rate = 44100, audio_format = 'mp3', language = 'English', audio_length_in_s, num_inference_steps, guidance_scale, denoising_strength, generateCoverArt = false } = await req.json()

    // Title is REQUIRED (3-100 characters)
    if (!title || typeof title !== 'string' || title.trim().length < 3 || title.trim().length > 100) {
      return NextResponse.json({ error: 'Title is required (3-100 characters)' }, { status: 400 })
    }

    // Prompt is REQUIRED
    if (!prompt || prompt.length < 10 || prompt.length > 300) {
      return NextResponse.json({ error: 'Prompt is required (10-300 characters)' }, { status: 400 })
    }
    
    console.log('🎵 Music Generation Parameters:')
    console.log('  Title:', title)
    console.log('  Prompt:', prompt)
    console.log('  Genre:', genre || 'not specified')
    console.log('  BPM:', bpm || 'not specified')
    console.log('  Duration:', duration)
    console.log('  Language:', language)

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
    
    console.log('🎵 Music Generation Request:')
    console.log('  Prompt:', prompt)
    console.log('  Lyrics length:', formattedLyrics.length)
    console.log('  Lyrics preview:', formattedLyrics.substring(0, 100) + '...')
    console.log('  Bitrate:', bitrate)
    console.log('  Sample rate:', sample_rate)
    console.log('  Format:', audio_format)
    console.log('  Language:', language)

    // Check user credits (music costs 2 credits) - REVERTED to old system
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

    // Generate music with MiniMax Music-1.5 (all languages)
    console.log('🎵 Using MiniMax Music-1.5 ...')
    let audioUrl: string
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
          error: sanitizeError(genError),
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

    console.log('🎵 Audio URL extracted:', audioUrl)

    // Upload to R2 for permanent storage (MANDATORY)
    console.log('📦 Uploading to R2 for permanent storage...')
    const fileName = `${title.substring(0, 30).replace(/[^a-zA-Z0-9]/g, '-')}-${Date.now()}.${audio_format}`
    
    let finalAudioUrl: string
    
    try {
      // Log R2 credentials status (without exposing actual values)
      console.log('🔑 R2 Config check:', {
        hasEndpoint: !!process.env.R2_ENDPOINT,
        hasAccessKey: !!process.env.R2_ACCESS_KEY_ID,
        hasSecretKey: !!process.env.R2_SECRET_ACCESS_KEY,
        bucketName: process.env.R2_BUCKET_NAME,
        publicUrl: process.env.R2_PUBLIC_URL
      })

      const r2Result = await downloadAndUploadToR2(
        audioUrl,
        userId,
        'music',
        fileName
      )

      if (!r2Result.success) {
        console.error('❌ R2 UPLOAD FAILED:', {
          error: r2Result.error,
          replicateUrl: audioUrl,
          fileName: fileName,
          userId: userId
        })
        throw new Error(`Failed to upload to permanent storage: ${r2Result.error}`)
      } else {
        console.log('✅ R2 upload successful!', {
          r2Url: r2Result.url,
          key: r2Result.key,
          size: `${(r2Result.size / 1024 / 1024).toFixed(2)} MB`
        })
        // Use permanent R2 URL
        finalAudioUrl = r2Result.url
      }
    } catch (r2Error) {
      console.error('❌ R2 UPLOAD EXCEPTION:', r2Error)
      console.error('Exception details:', {
        message: r2Error instanceof Error ? r2Error.message : 'Unknown error',
        stack: r2Error instanceof Error ? r2Error.stack : undefined,
        replicateUrl: audioUrl
      })
      throw new Error(`Failed to upload to permanent storage: ${r2Error instanceof Error ? r2Error.message : 'Unknown error'}`)
    }
    
    audioUrl = finalAudioUrl

    // Log that we're saving permanent R2 URL
    console.log(`💾 Saving to database with PERMANENT R2 URL:`, audioUrl)

    // Save to music_library table first
    console.log('💾 Saving to music library...')
    console.log('💾 Title being saved:', title)
    console.log('💾 Audio URL being saved:', audioUrl)
    console.log('💾 R2 key from upload:', r2Result.key)
    const libraryEntry = {
      clerk_user_id: userId,
      title: title, // Use the actual title from request - NOT the filename
      prompt: prompt,
      lyrics: formattedLyrics,
      audio_url: audioUrl,
      audio_format: audio_format,
      bitrate: bitrate,
      sample_rate: sample_rate,
      generation_params: {
        bitrate,
        sample_rate,
        audio_format,
        language
      },
      status: 'ready'
    }
    console.log('💾 Full library entry being saved:', JSON.stringify(libraryEntry, null, 2))

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

    let savedMusic: any = null
    if (!saveResponse.ok) {
      const errorText = await saveResponse.text()
      console.error('❌ Failed to save to music_library:', saveResponse.status, errorText)
      console.error('❌ Library entry that failed:', JSON.stringify(libraryEntry, null, 2))
      // Continue anyway - don't fail the whole generation
      // The audio was generated successfully, just failed to save metadata
    } else {
      const saveData = await saveResponse.json()
      savedMusic = Array.isArray(saveData) ? saveData[0] : saveData
      console.log('✅ Saved to library:', savedMusic)
      console.log('✅ Confirmed title in DB:', savedMusic?.title)
    }

    // NOW deduct credits (-2 for music) atomically to prevent race conditions
    console.log(`💰 Deducting 2 credits from user atomically (${userCredits} → ${userCredits - 2})`)
    
    const deductRes = await fetch(
      `${supabaseUrl}/rest/v1/rpc/deduct_credits`,
      {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          p_clerk_user_id: userId,
          p_amount: 2
        })
      }
    )

    const deductResult: { success: boolean; new_credits: number; error_message: string | null } | null = 
      deductRes.ok ? await deductRes.json() : null

    if (!deductRes.ok || !deductResult?.success) {
      console.error('⚠️ Failed to deduct credits atomically:', deductResult?.error_message || deductRes.statusText)
      // Continue anyway - better to give free generation than lose the work
    } else {
      console.log('✅ Credits deducted successfully (atomic operation)')
    }
    
    // If user used 444 Radio lyrics, record today's date (separate update)
    if (used444Radio) {
      const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD
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
          body: JSON.stringify({ last_444_radio_date: today })
        }
      )
      console.log('📅 Recording 444 Radio usage date:', today)
    }

    console.log('✅ Music generated successfully:', audioUrl)
    
    // Return proper response with all required fields
    const response: any = {
      success: true,
      audioUrl,
      title: title, // Use the actual title from request
      lyrics: formattedLyrics, // Return the formatted lyrics
      libraryId: savedMusic?.id || null,
      creditsRemaining: deductResult?.new_credits ?? (userCredits - 2),
      creditsDeducted: 2
    }

    // Generate cover art if requested
    if (generateCoverArt) {
      console.log('🎨 Generating cover art for the track...')
      
      try {
        // Check if user has enough credits for image (1 credit)
        if (userCredits - 2 < 1) {
          console.warn('⚠️ Not enough credits for cover art, skipping')
        } else {
          // Generate image using Replicate
          const imagePrompt = `${prompt} music album cover art, ${genre || 'electronic'} style, professional music artwork`
          
          try {
            // Use FLUX.2 Klein 9B Base for faster, better cover art
            const imagePrediction = await replicate.predictions.create({
              model: "black-forest-labs/flux-2-klein-9b-base",
              input: {
                prompt: imagePrompt,
                aspect_ratio: "1:1",
                output_format: "jpg",
                output_quality: 95,
                output_megapixels: "1",
                guidance: 4,
                go_fast: true,
                images: []
              }
            })

            // Poll for completion
            let imageResult = await replicate.predictions.get(imagePrediction.id)
            let attempts = 0
            while (imageResult.status !== 'succeeded' && imageResult.status !== 'failed' && attempts < 40) { // ~40 seconds max (reduced from 60s)
              await new Promise(resolve => setTimeout(resolve, 1000))
              imageResult = await replicate.predictions.get(imagePrediction.id)
              attempts++
            }

            if (imageResult.status === 'succeeded' && imageResult.output) {
            const imageUrls = Array.isArray(imageResult.output) ? imageResult.output : [imageResult.output]
            let imageUrl = imageUrls[0]
            
            // Handle FLUX.2 Klein output format with .url() method
            if (typeof imageUrl === 'object' && 'url' in imageUrl && typeof imageUrl.url === 'function') {
              imageUrl = imageUrl.url()
            }

            // Upload image to R2
            const imageFileName = `${title.substring(0, 30).replace(/[^a-zA-Z0-9]/g, '-')}-cover-${Date.now()}.jpg`
            
            const imageR2Result = await downloadAndUploadToR2(
              imageUrl,
              userId,
              'images',
              imageFileName
            )

            if (imageR2Result.success) {
              console.log('✅ Cover art uploaded to R2:', imageR2Result.url)
              response.imageUrl = imageR2Result.url
              response.creditsRemaining -= 1
              response.creditsDeducted += 1
            } else {
              console.error('❌ Cover art R2 upload failed:', imageR2Result.error)
              // Continue without image
            }
          } else {
              console.error('❌ Cover art generation failed:', imageResult.error)
              // Continue without image
            }
          } catch (innerImageError) {
            console.error('❌ Cover art generation error:', innerImageError)
            const errorMessage = innerImageError instanceof Error ? innerImageError.message : String(innerImageError)
            const is502Error = errorMessage.includes('502') || errorMessage.includes('Bad Gateway')
            
            if (is502Error) {
              console.warn('🔒 444 radio is lockin in - Replicate API temporarily unavailable')
            }
            // Continue without image
          }
        }
      } catch (imageError) {
        console.error('❌ Cover art generation outer error:', imageError)
        // Continue without image
      }
    }

    // Save generated image to images_library if cover art was generated
    if (response.imageUrl) {
      console.log('💾 Saving cover art to images_library...')
      try {
        const imageEntry = {
          user_id: userId,
          image_url: response.imageUrl,
          prompt: `${prompt} music album cover art`,
          created_at: new Date().toISOString()
        }

        const imageRes = await fetch(
          `${supabaseUrl}/rest/v1/images_library`,
          {
            method: 'POST',
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json',
              'Prefer': 'return=representation'
            },
            body: JSON.stringify(imageEntry)
          }
        )

        if (imageRes.ok) {
          const savedImage = await imageRes.json()
          console.log('✅ Cover art saved to images_library:', savedImage)
          response.imageLibraryId = Array.isArray(savedImage) ? savedImage[0].id : savedImage.id
        } else {
          console.error('❌ Failed to save to images_library:', imageRes.status)
        }
      } catch (imageError) {
        console.error('❌ Error saving to images_library:', imageError)
      }
    }

    // Note: User must manually combine audio + image using /api/media/combine to release
    return NextResponse.json(response)

  } catch (error) {
    console.error('❌ Music generation error:', error)
    console.log('💰 No credits deducted due to error')
    return NextResponse.json(
      { 
        success: false, 
        error: sanitizeError(error),
        creditsRefunded: false, // No deduction happened
        // Note: We don't have userCredits here if error happened before credit check
      },
      { status: 500 }
    )
  }
}

