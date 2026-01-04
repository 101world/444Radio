import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import Replicate from 'replicate'
import { uploadToR2 } from '@/lib/r2-upload'
import { createClient } from '@supabase/supabase-js'

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN!
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

    // Run stem separation
    const output = await replicate.run(
      "erickluis00/all-in-one-audio:f2a8516c9084ef460592deaa397acd4a97f60f18c3d15d273644c72500cdff0e",
      {
        input: {
          music_input: audioUrl,
          audioSeparator: true,
          sonify: false,
          visualize: false,
          model: "harmonix-all",
          audioSeparatorModel: "Kim_Vocal_2.onnx"
        }
      }
    ) as any

    console.log('[Stem Split] Replicate output:', JSON.stringify(output, null, 2))

    // Check if output has the expected structure
    if (!output || (!output.mdx_vocals && !output.mdx_other)) {
      console.error('[Stem Split] Unexpected output format:', output)
      // Refund credits
      await supabase
        .from('users')
        .update({ credits: userData.credits })
        .eq('clerk_user_id', userId)
      return NextResponse.json({ error: 'Stem separation returned invalid output' }, { status: 500 })
    }

    // Download stems from Replicate and upload to R2
    const vocalsUrl = Array.isArray(output.mdx_vocals) ? output.mdx_vocals[0] : output.mdx_vocals
    const instrumentalUrl = Array.isArray(output.mdx_other) ? output.mdx_other[0] : output.mdx_other

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
    const vocalsResponse = await fetch(vocalsUrl)
    if (!vocalsResponse.ok) {
      throw new Error(`Failed to download vocals: ${vocalsResponse.status}`)
    }
    const vocalsBlob = await vocalsResponse.blob()
    const vocalsFile = new File([vocalsBlob], 'vocals.mp3', { type: 'audio/mpeg' })

    // Download instrumental
    console.log('[Stem Split] Downloading instrumental from:', instrumentalUrl)
    const instrumentalResponse = await fetch(instrumentalUrl)
    if (!instrumentalResponse.ok) {
      throw new Error(`Failed to download instrumental: ${instrumentalResponse.status}`)
    }
    const instrumentalBlob = await instrumentalResponse.blob()
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
