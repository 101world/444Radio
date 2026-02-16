import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import Replicate from 'replicate'
import { uploadToR2 } from '@/lib/r2-upload'
import { logCreditTransaction } from '@/lib/credit-transactions'
import { corsResponse, handleOptions } from '@/lib/cors'

export const maxDuration = 60

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_KEY_LATEST2!,
})

export async function OPTIONS() {
  return handleOptions()
}

/**
 * POST /api/generate/autotune
 * Pitch-correct audio to a specific musical scale
 * Cost: 1 credit
 * 
 * Body:
 *   audio_file: URL to audio file (required)
 *   scale: Musical scale (e.g., "Gb:min", "C:maj") (required)
 *   output_format: "wav" | "mp3" (default: "wav")
 *   trackTitle: Optional title for saved audio
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return corsResponse(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
    }

    const body = await req.json()
    const { audio_file, scale, output_format = 'wav', trackTitle } = body

    // Validate required fields
    if (!audio_file || !scale) {
      return corsResponse(NextResponse.json({
        error: 'Missing required fields: audio_file and scale are required',
      }, { status: 400 }))
    }

    // Validate audio URL
    try {
      const urlObj = new URL(audio_file)
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        throw new Error('URL must use HTTP or HTTPS protocol')
      }
    } catch (e) {
      return corsResponse(NextResponse.json({ 
        error: 'Invalid audio URL format',
        details: e instanceof Error ? e.message : String(e)
      }, { status: 400 }))
    }

    // Validate output format
    if (!['wav', 'mp3'].includes(output_format)) {
      return corsResponse(NextResponse.json({
        error: 'Invalid output_format. Must be "wav" or "mp3"',
      }, { status: 400 }))
    }

    const CREDIT_COST = 1
    console.log(`🎵 Autotune request for ${userId}`)
    console.log(` - Audio: ${audio_file}`)
    console.log(` - Scale: ${scale}`)
    console.log(` - Cost: ${CREDIT_COST} credit`)

    // Check user credits
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    
    const userRes = await fetch(
      `${supabaseUrl}/rest/v1/users?clerk_user_id=eq.${userId}&select=credits`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        }
      }
    )
    
    const userData = await userRes.json()
    const user = userData?.[0]
    
    if (!user || user.credits < CREDIT_COST) {
      return corsResponse(NextResponse.json({ 
        error: `Insufficient credits. Autotune requires ${CREDIT_COST} credit.`,
        creditsNeeded: CREDIT_COST,
        creditsAvailable: user?.credits || 0
      }, { status: 402 }))
    }

    // Deduct credits atomically BEFORE generation
    const deductRes = await fetch(
      `${supabaseUrl}/rest/v1/rpc/deduct_credits`,
      {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ p_clerk_user_id: userId, p_amount: CREDIT_COST })
      }
    )
    
    let deductResult: { success: boolean; new_credits: number; error_message: string | null } | null = null
    if (deductRes.ok) {
      const raw = await deductRes.json()
      deductResult = Array.isArray(raw) ? raw[0] ?? null : raw
    }
    
    if (!deductRes.ok || !deductResult?.success) {
      const errorMsg = deductResult?.error_message || 'Failed to deduct credits'
      console.error('❌ Credit deduction blocked:', errorMsg)
      await logCreditTransaction({ 
        userId, 
        amount: -CREDIT_COST, 
        type: 'generation_autotune',
        status: 'failed', 
        description: `Autotune (${scale})`,
        metadata: { audio_file, scale, output_format }
      })
      return corsResponse(NextResponse.json({ error: errorMsg }, { status: 402 }))
    }
    
    console.log(`✅ Credits deducted. Remaining: ${deductResult.new_credits}`)
    await logCreditTransaction({ 
      userId, 
      amount: -CREDIT_COST, 
      balanceAfter: deductResult.new_credits,
      type: 'generation_autotune',
      description: `Autotune (${scale})`,
      metadata: { audio_file, scale, output_format }
    })

    // Run autotune via Replicate
    console.log('🎵 Running pitch correction...')
    const output = await replicate.run(
      "nateraw/autotune:53d58aea27ccd949e5f9d77e4b2a74ffe90e1fa534295b257cea50f011e233dd",
      {
        input: {
          scale,
          audio_file,
          output_format
        }
      }
    ) as any

    // Output is a FileOutput object with url() method
    let audioUrl: string
    if (typeof output === 'string') {
      audioUrl = output
    } else if (output && typeof output.url === 'function') {
      audioUrl = output.url()
    } else if (output && typeof output.url === 'string') {
      audioUrl = output.url
    } else {
      throw new Error('Unexpected output format from Replicate')
    }

    console.log('✅ Autotune complete:', audioUrl)

    // Download and upload to R2 for permanent storage
    console.log('📥 Downloading autotuned audio...')
    const dlRes = await fetch(audioUrl)
    if (!dlRes.ok) {
      throw new Error('Failed to download autotuned audio')
    }

    const buffer = Buffer.from(await dlRes.arrayBuffer())
    const fileName = `${userId}/autotune-${Date.now()}.${output_format}`
    
    const r2Result = await uploadToR2(buffer, 'audio-files', fileName)
    if (!r2Result.success) {
      throw new Error('Failed to upload to R2')
    }

    audioUrl = r2Result.url!
    console.log('✅ Uploaded to R2:', audioUrl)

    // Save to combined_media
    const title = trackTitle || `Autotuned (${scale})`
    console.log('💾 Saving to library...')
    const saveRes = await fetch(
      `${supabaseUrl}/rest/v1/combined_media`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          user_id: userId,
          type: 'audio',
          title,
          prompt: `Pitch-corrected to ${scale}`,
          audio_url: audioUrl,
          is_public: false,
          genre: 'processed'
        })
      }
    )

    if (!saveRes.ok) {
      console.error('⚠️ Failed to save to library')
    } else {
      const saved = await saveRes.json()
      console.log('✅ Saved to library:', saved[0]?.id)
    }

    console.log('✅ Autotune complete')

    // Quest progress: fire-and-forget
    const { trackQuestProgress } = await import('@/lib/quest-progress')
    trackQuestProgress(userId, 'generate_songs').catch(() => {})

    return corsResponse(NextResponse.json({ 
      success: true, 
      audioUrl,
      scale,
      output_format,
      title,
      creditsRemaining: deductResult!.new_credits,
      message: 'Audio pitch-corrected successfully'
    }))

  } catch (error) {
    console.error('Autotune error:', error)
    
    // Log generation failure
    try {
      const { userId } = await auth()
      if (userId) {
        await logCreditTransaction({
          userId,
          amount: 0,
          type: 'generation_autotune',
          status: 'failed',
          description: 'Autotune generation failed (post-deduction)',
          metadata: { error: error instanceof Error ? error.message : String(error) }
        })
      }
    } catch { /* ignore logging errors */ }
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return corsResponse(NextResponse.json(
      { error: `Failed to autotune audio: ${errorMessage}` },
      { status: 500 }
    ))
  }
}
