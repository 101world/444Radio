import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import Replicate from 'replicate'
import { createClient } from '@supabase/supabase-js'

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_KEY_LATEST!
})

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const STEM_SPLIT_COST = 8

export async function POST(request: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { audioUrl } = await request.json()

    if (!audioUrl) {
      return NextResponse.json({ error: 'Audio URL required' }, { status: 400 })
    }

    // Validate audio URL is accessible
    console.log('[Stem Split] Validating audio URL accessibility:', audioUrl)
    try {
      const headResponse = await fetch(audioUrl, { method: 'HEAD' })
      if (!headResponse.ok) {
        console.error('[Stem Split] Audio URL not accessible:', headResponse.status, headResponse.statusText)
        return NextResponse.json({ 
          error: `Audio file not accessible (HTTP ${headResponse.status}). Please try with a publicly accessible audio URL.`,
          audioUrl,
          statusCode: headResponse.status 
        }, { status: 400 })
      }
      console.log('[Stem Split] Audio URL is accessible, content-type:', headResponse.headers.get('content-type'))
    } catch (urlError) {
      console.error('[Stem Split] Failed to validate audio URL:', urlError)
      return NextResponse.json({ 
        error: 'Audio URL is not accessible. Please ensure the audio file is publicly available.',
        audioUrl,
        urlError: urlError instanceof Error ? urlError.message : 'Unknown error'
      }, { status: 400 })
    }

    // Check credits
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('credits')
      .eq('clerk_user_id', userId)
      .single()

    if (userError || !userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (userData.credits < STEM_SPLIT_COST) {
      return NextResponse.json({ 
        error: `Insufficient credits. Need ${STEM_SPLIT_COST} credits but have ${userData.credits}` 
      }, { status: 402 })
    }

    // Deduct credits first
    const { error: deductError } = await supabase
      .from('users')
      .update({ credits: userData.credits - STEM_SPLIT_COST })
      .eq('clerk_user_id', userId)

    if (deductError) {
      console.error('[Stem Split] Credit deduction error:', deductError)
      return NextResponse.json({ error: 'Failed to deduct credits' }, { status: 500 })
    }

    console.log(`[Stem Split] Processing audio: ${audioUrl}`)
    console.log('[Stem Split] Calling Replicate API...')

    // Run stem separation with proper parameters from schema
    let output: any
    try {
      output = await replicate.run(
        "erickluis00/all-in-one-audio:f2a8516c9084ef460592deaa397acd4a97f60f18c3d15d273644c72500cdff0e",
        {
          input: {
            music_input: audioUrl,
            audioSeparator: true,
            audioSeparatorModel: "Kim_Vocal_2.onnx",
            model: "harmonix-all",
            sonify: false,
            visualize: false,
            include_embeddings: false,
            include_activations: false
          }
        }
      ) as any
      console.log('[Stem Split] Replicate API call completed')
    } catch (replicateError) {
      console.error('[Stem Split] Replicate API error:', replicateError)
      // Refund credits
      await supabase
        .from('users')
        .update({ credits: userData.credits })
        .eq('clerk_user_id', userId)
      throw new Error(`Replicate API failed: ${replicateError instanceof Error ? replicateError.message : 'Unknown error'}`)
    }

    console.log('[Stem Split] Replicate output:', JSON.stringify(output, null, 2))
    console.log('[Stem Split] Output keys:', Object.keys(output || {}))

    // Simple stem normalization - extract all available stems from output
    function normalizeStems(replicateOutput: any): Record<string, string> | null {
      console.log('[Stem Split] normalizeStems input:', JSON.stringify(replicateOutput, null, 2))
      
      if (!replicateOutput) return null
      
      // The output might be nested under 'output' property or be direct
      const actualOutput = replicateOutput.output || replicateOutput
      console.log('[Stem Split] actualOutput:', JSON.stringify(actualOutput, null, 2))
      
      if (typeof actualOutput === 'object' && !Array.isArray(actualOutput)) {
        const stems: Record<string, string> = {}
        
        for (const [key, value] of Object.entries(actualOutput)) {
          console.log(`[Stem Split] Processing key: ${key}, value:`, value)
          
          // Skip null values and empty arrays
          if (value === null || value === undefined) {
            console.log(`[Stem Split] Skipping ${key}: null/undefined`)
            continue
          }
          
          if (Array.isArray(value) && value.length === 0) {
            console.log(`[Stem Split] Skipping ${key}: empty array`)
            continue
          }
          
          // Extract URL from various formats
          let url: string | null = null
          
          if (typeof value === 'string' && value.startsWith('http')) {
            // Direct URL string
            url = value
          } else if (value && typeof value === 'object' && !Array.isArray(value)) {
            // Object - check for nested URL properties
            if (typeof (value as any).url === 'string') {
              url = (value as any).url
            } else if ((value as any).audio && typeof (value as any).audio.download_uri === 'string') {
              url = (value as any).audio.download_uri
            } else {
              // Look for any property that contains a URL string
              for (const [nestedKey, nestedValue] of Object.entries(value)) {
                if (typeof nestedValue === 'string' && nestedValue.startsWith('http')) {
                  console.log(`[Stem Split] Found nested URL in ${key}.${nestedKey}:`, nestedValue)
                  url = nestedValue
                  break
                }
              }
            }
          }
          
          console.log(`[Stem Split] Extracted URL for ${key}:`, url)
          
          // Include if it's a valid URL and looks like a stem
          if (url) {
            const isAudioFile = url.includes('.wav') || url.includes('.mp3') || url.includes('.flac')
            const isStemKey = key.includes('vocal') || key.includes('drum') || key.includes('bass') || 
                             key.includes('instrumental') || key.includes('other') || key.includes('guitar') || 
                             key.includes('piano') || key.includes('stem') || key.includes('demucs') || key.includes('mdx')
            
            if (isAudioFile || isStemKey) {
              stems[key] = url
              console.log(`[Stem Split] Added stem: ${key} -> ${url}`)
            } else {
              console.log(`[Stem Split] Skipped ${key}: not audio file or stem key`)
            }
          }
        }
        
        console.log(`[Stem Split] Final stems object:`, stems)
        return Object.keys(stems).length > 0 ? stems : null
      }
      
      console.log('[Stem Split] actualOutput is not an object, returning null')
      return null
    }

    const allStems = normalizeStems(output)
    
    if (!allStems || Object.keys(allStems).length === 0) {
      console.error('[Stem Split] Could not find any stems in output. Full output:', JSON.stringify(output, null, 2))
      
      // Check if the output has empty objects - this might indicate the model couldn't process the audio
      const hasEmptyObjects = output && typeof output === 'object' && Object.values(output).some(v => 
        v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0
      )
      
      if (hasEmptyObjects) {
        console.error('[Stem Split] Output contains empty objects - model may have failed to process audio URL:', audioUrl)
        // Refund credits
        await supabase
          .from('users')
          .update({ credits: userData.credits })
          .eq('clerk_user_id', userId)
        return NextResponse.json({ 
          error: 'Audio processing failed - the AI model could not access or process the audio file. Please try with a different audio file.',
          debug: 'Model returned empty objects instead of audio URLs',
          audioUrlTested: audioUrl,
          rawOutput: output
        }, { status: 500 })
      }
      
      // Refund credits
      await supabase
        .from('users')
        .update({ credits: userData.credits })
        .eq('clerk_user_id', userId)
      return NextResponse.json({ 
        error: 'Could not find separated audio in Replicate output',
        availableKeys: Object.keys(output || {}),
        rawOutput: output,
        debug: 'Check server logs for detailed stem extraction debug info'
      }, { status: 500 })
    }

    console.log(`[Stem Split] Success! Found ${Object.keys(allStems).length} stems:`, Object.keys(allStems))

    return NextResponse.json({ 
      success: true,
      stems: allStems,
      creditsUsed: STEM_SPLIT_COST,
      creditsRemaining: userData.credits - STEM_SPLIT_COST,
      rawOutputKeys: Object.keys(output || {})
    })
  } catch (error) {
    console.error('[Stem Split] Error:', error)
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Failed to split stems',
      details: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}
