import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import Replicate from 'replicate'
import { createClient } from '@supabase/supabase-js'

export const maxDuration = 300

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_KEY_LATEST2!
})

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const STEM_SPLIT_COST = 5

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

    // Send to Replicate and wait for result
    const prediction = await replicate.predictions.create({
      version: "f2a8516c9084ef460592deaa397acd4a97f60f18c3d15d273644c72500cdff0e",
      input: {
        music_input: audioUrl,
        model: "harmonix-all",
        sonify: false,
        visualize: false,
        audioSeparator: true,
        include_embeddings: false,
        audioSeparatorModel: "Kim_Vocal_2.onnx",
        include_activations: false
      }
    })

    const result = await replicate.wait(prediction, { interval: 5000 })
    const raw = result?.output ?? result

    // Simple: grab every key that has an audio URL, skip nulls/json/non-strings
    const stems: Record<string, string> = {}
    for (const [key, value] of Object.entries(raw || {})) {
      if (typeof value === 'string' && value.startsWith('http') && !value.includes('.json')) {
        // Clean display name: demucs_vocals → vocals, mdx_instrumental → instrumental
        const name = key.replace(/^(demucs_|mdx_)/, '')
        stems[name] = value
      }
    }

    if (Object.keys(stems).length === 0) {
      return NextResponse.json({ error: 'No stems returned. Try a different audio file.' }, { status: 500 })
    }

    // Deduct credits after success
    const { data: deductResultRaw } = await supabase
      .rpc('deduct_credits', { p_clerk_user_id: userId, p_amount: STEM_SPLIT_COST })
      .single()

    const deductResult = deductResultRaw as { success: boolean; new_credits: number } | null

    return NextResponse.json({ 
      success: true,
      stems,
      creditsUsed: STEM_SPLIT_COST,
      creditsRemaining: deductResult?.new_credits ?? (userData.credits - STEM_SPLIT_COST)
    })
  } catch (error) {
    console.error('[Stem Split] Error:', error)
    return NextResponse.json({ 
      error: '444 radio is locking in, please try again in few minutes'
    }, { status: 500 })
  }
}
}
