import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import Replicate from 'replicate'
import { downloadAndUploadToR2 } from '@/lib/storage'
import { logCreditTransaction, updateTransactionMedia } from '@/lib/credit-transactions'
import { sanitizeCreditError, SAFE_ERROR_MESSAGE } from '@/lib/sanitize-error'
import { refundCredits } from '@/lib/refund-credits'

// Allow up to 5 minutes for image generation (Vercel Pro limit: 300s)
export const maxDuration = 300

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_KEY_LATEST2!,
})

// POST /api/generate/image-only - Generate ONLY image (no song record)
// For standalone cover art generation with preview
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { prompt, params } = await req.json()

    if (!prompt) {
      return NextResponse.json({ error: 'Missing prompt' }, { status: 400 })
    }

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
    
    if (!user || user.credits < 1) {
      return NextResponse.json({ 
        error: 'Insufficient credits. Image generation requires 1 credit.',
        creditsNeeded: 1,
        creditsAvailable: user?.credits || 0
      }, { status: 402 })
    }

    console.log(`💰 User has ${user.credits} credits. Image requires 1 credit.`)

    // ✅ DEDUCT 1 CREDIT atomically BEFORE generation (blocks if wallet < $1)
    const deductRes = await fetch(
      `${supabaseUrl}/rest/v1/rpc/deduct_credits`,
      {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ p_clerk_user_id: userId, p_amount: 1 })
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
      await logCreditTransaction({ userId, amount: -1, type: 'generation_image', status: 'failed', description: `Image: ${prompt.substring(0, 80)}`, metadata: { prompt } })
      return NextResponse.json({ error: sanitizeCreditError(errorMsg) }, { status: 402 })
    }
    console.log(`✅ Credit deducted. Remaining: ${deductResult.new_credits}`)
    await logCreditTransaction({ userId, amount: -1, balanceAfter: deductResult.new_credits, type: 'generation_image', description: `Image: ${prompt.substring(0, 80)}`, metadata: { prompt } })

    // Generate image directly with Flux Schnell (with retry logic for 502 errors)
    console.log('🎨 Generating standalone image with Flux Schnell')
    console.log('🎨 Prompt:', prompt)
    console.log('🎨 Parameters:', params)
    
    let output;
    const maxRetries = 3
    let lastError: any = null
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🎨 Generation attempt ${attempt}/${maxRetries} with FLUX.2 Klein 9B`)
        output = await replicate.run(
          "black-forest-labs/flux-2-klein-9b-base",
          {
            input: {
              prompt,
              aspect_ratio: params?.aspect_ratio ?? "1:1",
              output_format: params?.output_format ?? "jpg",
              output_quality: params?.output_quality ?? 95,
              output_megapixels: params?.output_megapixels ?? "1",
              guidance: params?.guidance ?? 4,
              go_fast: params?.go_fast ?? true,
              images: [] // For potential image-to-image in future
            }
          }
        )
        console.log('✅ FLUX.2 Klein generation succeeded in ~2-3s')
        break // Success, exit retry loop
      } catch (genError) {
        lastError = genError
        const errorMessage = genError instanceof Error ? genError.message : String(genError)
        const is502Error = errorMessage.includes('502') || errorMessage.includes('Bad Gateway')
        
        if (is502Error && attempt < maxRetries) {
          const waitTime = attempt * 3 // 3s, 6s exponential backoff
          console.log(`⚠️ 502 Bad Gateway (attempt ${attempt}/${maxRetries}), retrying in ${waitTime}s...`)
          await new Promise(resolve => setTimeout(resolve, waitTime * 1000))
          continue
        }
        
        // Either not a 502 or we're out of retries
        console.error(`❌ Image generation failed after ${attempt} attempts:`, genError)
        
        // Refund credit since generation failed
        await refundCredits({ userId, amount: 1, type: 'generation_image', reason: `Image generation failed after ${attempt} attempts`, metadata: { prompt, retriesAttempted: attempt, error: errorMessage.substring(0, 200) } })
        
        return NextResponse.json(
          { 
            success: false, 
            error: SAFE_ERROR_MESSAGE,
            creditsRefunded: true,
            creditsRemaining: user.credits,
            retriesAttempted: attempt
          },
          { status: 500 }
        )
      }
    }
    
    if (!output) {
      await refundCredits({ userId, amount: 1, type: 'generation_image', reason: 'No output after all retries', metadata: { prompt, retriesAttempted: maxRetries } })
      return NextResponse.json(
        { 
          success: false, 
          error: SAFE_ERROR_MESSAGE,
          creditsRefunded: true,
          creditsRemaining: user.credits,
          retriesAttempted: maxRetries
        },
        { status: 500 }
      )
    }

    console.log('✅ Generation succeeded, processing output...')

    // Handle output format
    let imageUrl: string
    if (Array.isArray(output)) {
      const firstItem = output[0]
      // Check if it's an object with url() method
      imageUrl = typeof firstItem?.url === 'function' ? firstItem.url() : firstItem
    } else {
      imageUrl = output as unknown as string
    }

    if (!imageUrl) {
      throw new Error('No image generated')
    }

    // Upload to R2 for permanent storage
    console.log('📦 Uploading image to R2 for permanent storage...')
    const outputFormat = params?.output_format ?? 'webp'
    const fileName = `${prompt.substring(0, 30).replace(/[^a-zA-Z0-9]/g, '-')}-${Date.now()}.${outputFormat}`
    
    const r2Result = await downloadAndUploadToR2(
      imageUrl,
      userId,
      'images',
      fileName
    )

    if (!r2Result.success) {
      console.error('⚠️ R2 upload failed, using Replicate URL:', r2Result.error)
      throw new Error(`Failed to upload image to permanent storage: ${r2Result.error}`)
    } else {
      console.log('✅ R2 upload successful:', r2Result.url)
      // Use permanent R2 URL instead of temporary Replicate URL
      imageUrl = r2Result.url
    }

    // Save to images_library table first
    console.log('💾 Saving to images library...')
    const libraryEntry = {
      clerk_user_id: userId,
      title: prompt.substring(0, 100), // Use first 100 chars as title
      prompt: prompt,
      image_url: imageUrl,
      aspect_ratio: params?.aspect_ratio ?? "1:1",
      image_format: params?.output_format ?? "webp",
      generation_params: {
        num_outputs: params?.num_outputs ?? 1,
        aspect_ratio: params?.aspect_ratio ?? "1:1",
        output_format: params?.output_format ?? "webp",
        output_quality: params?.output_quality ?? 80,
        num_inference_steps: params?.num_inference_steps ?? 4
      },
      status: 'ready'
    }

    const saveResponse = await fetch(
      `${supabaseUrl}/rest/v1/images_library`,
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

    const savedImage = await saveResponse.json()
    console.log('✅ Saved to library:', savedImage)

    const creditsAfter = deductResult!.new_credits
    console.log('✅ Standalone image generated:', imageUrl)

    // Update transaction with output media
    updateTransactionMedia({ userId, type: 'generation_image', mediaUrl: imageUrl, mediaType: 'image', title: `Image: ${prompt.substring(0, 50)}` }).catch(() => {})

    return NextResponse.json({ 
      success: true, 
      imageUrl,
      libraryId: savedImage[0]?.id,
      message: 'Image generated successfully',
      creditsRemaining: creditsAfter,
      creditsDeducted: 1
    })

  } catch (error) {
    console.error('Standalone image generation error:', error)
    try {
      const { userId: uid } = await auth()
      if (uid) {
        await refundCredits({ userId: uid, amount: 1, type: 'generation_image', reason: `Image failed: ${String(error).substring(0, 80)}`, metadata: { error: String(error).substring(0, 200) } })
      }
    } catch { /* auth failed in catch — skip logging */ }
    return NextResponse.json({ 
      success: false,
      error: SAFE_ERROR_MESSAGE,
      creditsRefunded: true
    }, { status: 500 })
  }
}

