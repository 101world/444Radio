import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import Replicate from 'replicate'
import { uploadToR2 } from '@/lib/r2-upload'
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

    // Handle different possible output formats from Replicate
    let vocalsUrl: string | null = null
    let instrumentalUrl: string | null = null

    // Try multiple possible key names for vocals
    const possibleVocalsKeys = ['mdx_vocals', 'vocals', 'vocal', 'voice', 'Vocals', 'mdxnet_vocals']
    const possibleInstrumentalKeys = ['mdx_other', 'instrumental', 'music', 'accompaniment', 'Instrumental', 'mdxnet_other', 'no_vocals']

    for (const key of possibleVocalsKeys) {
      if (output && output[key]) {
        vocalsUrl = Array.isArray(output[key]) ? output[key][0] : output[key]
        console.log(`[Stem Split] Found vocals at key: ${key}`)
        break
      }
    }

    for (const key of possibleInstrumentalKeys) {
      if (output && output[key]) {
        instrumentalUrl = Array.isArray(output[key]) ? output[key][0] : output[key]
        console.log(`[Stem Split] Found instrumental at key: ${key}`)
        break
      }
    }

    // If still not found, check if output is an array or object with file URLs
    if (!vocalsUrl && !instrumentalUrl && output) {
      console.log('[Stem Split] Trying alternative output format detection...')
      
      // If output is an array of URLs
      if (Array.isArray(output) && output.length >= 2) {
        vocalsUrl = output[0]
        instrumentalUrl = output[1]
        console.log('[Stem Split] Using array format - [0] vocals, [1] instrumental')
      }
      // If output has 'output' property
      else if (output.output) {
        const outputData = output.output
        if (Array.isArray(outputData) && outputData.length >= 2) {
          vocalsUrl = outputData[0]
          instrumentalUrl = outputData[1]
          console.log('[Stem Split] Using output.output array format')
        }
      }
    }

    // Check if we got valid URLs
    if (!vocalsUrl || !instrumentalUrl) {
      console.error('[Stem Split] Could not find vocal/instrumental URLs in output:', output)
      console.error('[Stem Split] Available keys:', Object.keys(output || {}))
      // Refund credits
      await supabase
        .from('users')
        .update({ credits: userData.credits })
        .eq('clerk_user_id', userId)
      return NextResponse.json({ 
        error: 'Could not find separated audio in Replicate output',
        availableKeys: Object.keys(output || {})
      }, { status: 500 })
    }

    if (!vocalsUrl || !instrumentalUrl) {
      console.error('[Stem Split] Missing URLs - vocals:', vocalsUrl, 'instrumental:', instrumentalUrl)
      // Refund credits
      await supabase
        .from('users')
        .update({ credits: userData.credits })
        .eq('clerk_user_id', userId)
      return NextResponse.json({ error: 'Stem URLs not found in output' }, { status: 500 })
    }

    // Download vocals
    console.log('[Stem Split] Downloading vocals from:', vocalsUrl)
    let vocalsBlob: Blob
    try {
      const vocalsResponse = await fetch(vocalsUrl, {
        signal: AbortSignal.timeout(60000) // 60 second timeout
      })
      if (!vocalsResponse.ok) {
        throw new Error(`HTTP ${vocalsResponse.status}: ${vocalsResponse.statusText}`)
      }
      vocalsBlob = await vocalsResponse.blob()
      console.log('[Stem Split] Vocals downloaded:', vocalsBlob.size, 'bytes')
    } catch (downloadError) {
      console.error('[Stem Split] Vocals download failed:', downloadError)
      // Refund credits
      await supabase
        .from('users')
        .update({ credits: userData.credits })
        .eq('clerk_user_id', userId)
      throw new Error(`Failed to download vocals: ${downloadError instanceof Error ? downloadError.message : 'Unknown error'}`)
    }
    const vocalsFile = new File([vocalsBlob], 'vocals.mp3', { type: 'audio/mpeg' })

    // Download instrumental
    console.log('[Stem Split] Downloading instrumental from:', instrumentalUrl)
    let instrumentalBlob: Blob
    try {
      const instrumentalResponse = await fetch(instrumentalUrl, {
        signal: AbortSignal.timeout(60000) // 60 second timeout
      })
      if (!instrumentalResponse.ok) {
        throw new Error(`HTTP ${instrumentalResponse.status}: ${instrumentalResponse.statusText}`)
      }
      instrumentalBlob = await instrumentalResponse.blob()
      console.log('[Stem Split] Instrumental downloaded:', instrumentalBlob.size, 'bytes')
    } catch (downloadError) {
      console.error('[Stem Split] Instrumental download failed:', downloadError)
      // Refund credits
      await supabase
        .from('users')
        .update({ credits: userData.credits })
        .eq('clerk_user_id', userId)
      throw new Error(`Failed to download instrumental: ${downloadError instanceof Error ? downloadError.message : 'Unknown error'}`)
    }
    const instrumentalFile = new File([instrumentalBlob], 'instrumental.mp3', { type: 'audio/mpeg' })

    // Upload to R2
    const timestamp = Date.now()
    const vocalsKey = `stems/${userId}/vocals-${timestamp}.mp3`
    const instrumentalKey = `stems/${userId}/instrumental-${timestamp}.mp3`

    console.log('[Stem Split] Uploading to R2...')
    const vocalsUpload = await uploadToR2(vocalsFile, 'audio-files', vocalsKey)
    const instrumentalUpload = await uploadToR2(instrumentalFile, 'audio-files', instrumentalKey)

    if (!vocalsUpload.success || !instrumentalUpload.success) {
      console.error('[Stem Split] R2 upload failed - vocals:', vocalsUpload, 'instrumental:', instrumentalUpload)
      // Refund credits
      await supabase
        .from('users')
        .update({ credits: userData.credits })
        .eq('clerk_user_id', userId)
      throw new Error('Failed to upload stems to R2')
    }

    console.log('[Stem Split] Success! Vocals:', vocalsUpload.url, 'Instrumental:', instrumentalUpload.url)

    return NextResponse.json({ 
      success: true,
      stems: {
        vocals: vocalsUpload.url,
        instrumental: instrumentalUpload.url
      },
      creditsUsed: STEM_SPLIT_COST,
      creditsRemaining: userData.credits - STEM_SPLIT_COST
    })
  } catch (error) {
    console.error('[Stem Split] Error:', error)
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Failed to split stems',
      details: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}
