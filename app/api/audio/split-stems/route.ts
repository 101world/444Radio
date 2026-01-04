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
    const extractUrl = (val: any): string | null => {
      if (!val) return null
      if (Array.isArray(val)) return val.find(Boolean) || null
      if (typeof val === 'string') return val
      if (typeof val === 'object') {
        if (typeof (val as any).url === 'string') return (val as any).url
        if ((val as any).audio?.download_uri) return (val as any).audio.download_uri
      }
      return null
    }

    const stemKeyMap: Record<string, string[]> = {
      vocals: ['mdx_vocals', 'demucs_vocals', 'vocals', 'vocal', 'voice', 'Vocals', 'mdxnet_vocals'],
      instrumental: ['mdx_instrumental', 'mdx_other', 'instrumental', 'music', 'accompaniment', 'Instrumental', 'mdxnet_other', 'no_vocals'],
      drums: ['demucs_drums', 'drums'],
      bass: ['demucs_bass', 'bass'],
      other: ['demucs_other', 'other'],
      guitar: ['demucs_guitar', 'guitar'],
      piano: ['demucs_piano', 'piano']
    }

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

    const primaryOutput = output && output.output && typeof output.output === 'object' ? output.output : output
    console.log('[Stem Split] Using output source keys:', Object.keys(primaryOutput || {}))

    // Normalize stems from output
    const detectedStems: Record<string, string> = {}

    for (const [stemName, keys] of Object.entries(stemKeyMap)) {
      for (const key of keys) {
        const url = primaryOutput ? extractUrl((primaryOutput as any)[key]) : null
        if (url) {
          detectedStems[stemName] = url
          console.log(`[Stem Split] Found ${stemName} at key: ${key}`)
          break
        }
      }
    }

    // Fallback: array-like output
    if ((!detectedStems.vocals || !detectedStems.instrumental) && primaryOutput) {
      console.log('[Stem Split] Trying alternative output format detection...')
      const asArray = Array.isArray(primaryOutput) ? primaryOutput : Array.isArray(primaryOutput?.output) ? primaryOutput.output : null
      if (asArray && asArray.length >= 2) {
        detectedStems.vocals = extractUrl(asArray[0]) || detectedStems.vocals
        detectedStems.instrumental = extractUrl(asArray[1]) || detectedStems.instrumental
        console.log('[Stem Split] Using array format for vocals/instrumental fallback')
      }
    }

    const vocalsUrl = detectedStems.vocals
    const instrumentalUrl = detectedStems.instrumental

    // Check if we got mandatory URLs
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

    // Merge uploaded URLs with any additional stems detected (demucs_* etc.)
    const responseStems = {
      ...detectedStems,
      vocals: vocalsUpload.url,
      instrumental: instrumentalUpload.url
    }

    return NextResponse.json({ 
      success: true,
      stems: responseStems,
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
