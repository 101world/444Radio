import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import Replicate from 'replicate'
import { downloadAndUploadToR2 } from '@/lib/storage'

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN!,
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
      return NextResponse.json({ error: 'Insufficient credits' }, { status: 402 })
    }

    // Generate image directly with Flux Schnell
    console.log('🎨 Generating standalone image with Flux Schnell')
    console.log('🎨 Prompt:', prompt)
    console.log('🎨 Parameters:', params)
    
    const output = await replicate.run(
      "black-forest-labs/flux-schnell",
      {
        input: {
          prompt,
          num_outputs: params?.num_outputs ?? 1,
          aspect_ratio: params?.aspect_ratio ?? "1:1",
          output_format: params?.output_format ?? "webp",
          output_quality: params?.output_quality ?? 80,
          go_fast: params?.go_fast ?? true,
          num_inference_steps: params?.num_inference_steps ?? 4,
          disable_safety_checker: false
        }
      }
    )

    console.log('🎨 Flux output:', output)

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
      // Continue with Replicate URL if R2 fails
    } else {
      console.log('✅ R2 upload successful:', r2Result.url)
      // Use permanent R2 URL instead of temporary Replicate URL
      imageUrl = r2Result.url
    }

    // Deduct 1 credit
    await fetch(`${supabaseUrl}/rest/v1/users?clerk_user_id=eq.${userId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        credits: user.credits - 1
      })
    })

    console.log('✅ Standalone image generated:', imageUrl)

    return NextResponse.json({ 
      success: true, 
      imageUrl,
      message: 'Image generated successfully',
      creditsRemaining: user.credits - 1
    })

  } catch (error) {
    console.error('Standalone image generation error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to generate image'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
