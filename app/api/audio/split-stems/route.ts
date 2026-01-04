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
    function normalizeStems(output: any): Record<string, string> | null {
      if (!output) return null
      
      // Check if output has an 'output' property (nested structure)
      const actualOutput = output.output || output
      
      if (typeof actualOutput === 'object' && !Array.isArray(actualOutput)) {
        const stems: Record<string, string> = {}
        for (const [key, value] of Object.entries(actualOutput)) {
          // Extract URL from various formats
          let url: string | null = null
          if (typeof value === 'string' && value.startsWith('http')) {
            url = value
          } else if (value && typeof value === 'object') {
            if (typeof (value as any).url === 'string') {
              url = (value as any).url
            } else if ((value as any).audio && typeof (value as any).audio.download_uri === 'string') {
              url = (value as any).audio.download_uri
            }
          }
          
          // Only include audio stems (skip null, arrays, non-audio files)
          if (url && (
            url.includes('.wav') || url.includes('.mp3') || url.includes('.flac') ||
            key.includes('vocal') || key.includes('drum') || key.includes('bass') || 
            key.includes('instrumental') || key.includes('other') || key.includes('guitar') || 
            key.includes('piano') || key.includes('stem')
          )) {
            stems[key] = url
          }
        }
        return Object.keys(stems).length > 0 ? stems : null
      }
      
      return null
    }

    const allStems = normalizeStems(output)
    
    if (!allStems || Object.keys(allStems).length === 0) {
      console.error('[Stem Split] Could not find any stems in output:', output)
      // Refund credits
      await supabase
        .from('users')
        .update({ credits: userData.credits })
        .eq('clerk_user_id', userId)
      return NextResponse.json({ 
        error: 'Could not find separated audio in Replicate output',
        availableKeys: Object.keys(output || {}),
        rawOutput: output
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
