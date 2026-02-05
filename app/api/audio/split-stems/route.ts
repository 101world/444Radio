import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import Replicate from 'replicate'
import { createClient } from '@supabase/supabase-js'

// Allow up to 5 minutes for stem splitting (Vercel Pro limit: 300s)
export const maxDuration = 300

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_KEY_LATEST2!
})

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * Sanitize error messages to hide technical details from users
 */
function sanitizeError(error: any): string {
  // Hide all technical details - users should only see generic message
  return '444 radio is locking in, please try again in few minutes'
}

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

    // Check credits - REVERTED to old system
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

    console.log(`[Stem Split] User has ${userData.credits} credits, stem split needs ${STEM_SPLIT_COST}`)

    console.log(`[Stem Split] Processing audio: ${audioUrl}`)
    console.log('[Stem Split] Calling Replicate API...')

    // Run stem separation with proper parameters and extended timeout
    let output: any
    try {
      const prediction = await replicate.predictions.create({
        version: "f2a8516c9084ef460592deaa397acd4a97f60f18c3d15d273644c72500cdff0e",
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
      })

      console.log('[Stem Split] Prediction created, waiting for completion...')
      
      // Wait for completion with proper API syntax
      output = await replicate.wait(prediction, { 
        interval: 5000 // check every 5 seconds
      })
      
      console.log('[Stem Split] Replicate completed successfully')
    } catch (replicateError) {
      console.error('[Stem Split] Replicate API error:', replicateError)
      
      return NextResponse.json({ 
        error: `AI service failed: ${replicateError instanceof Error ? replicateError.message : 'Unknown error'}.`,
        refunded: false 
      }, { status: 500 })
    }

    console.log('[Stem Split] Replicate output:', JSON.stringify(output, null, 2))
    console.log('[Stem Split] Output keys:', Object.keys(output || {}))

    // BULLETPROOF stem extraction - find ANY valid audio URLs
    function normalizeStems(replicateOutput: any): Record<string, string> | null {
      console.log('[Stem Split] Starting bulletproof stem extraction...')
      
      if (!replicateOutput) {
        console.log('[Stem Split] No output received')
        return null
      }
      
      const stems: Record<string, string> = {}
      
      // Recursive function to find all URLs in any nested object
      function findAllUrls(obj: any, path = ''): void {
        if (!obj) return
        
        if (typeof obj === 'string' && obj.startsWith('http')) {
          // Found a URL string - check if it's audio (exclude .json files)
          if ((obj.includes('.wav') || obj.includes('.mp3') || obj.includes('.flac')) && !obj.includes('.json')) {
            // Filter out unwanted stems and empty URLs
            if (!path.includes('other') && !path.includes('analyzer_result') && obj.trim().length > 10) {
              const key = path || `stem_${Object.keys(stems).length + 1}`
              stems[key] = obj
              console.log(`[Stem Split] ✅ Found audio URL at ${path}: ${obj}`)
            } else {
              console.log(`[Stem Split] ⏭️ Skipped unwanted/empty stem: ${path}`)
            }
          } else if (obj.includes('.json')) {
            console.log(`[Stem Split] ⏭️ Skipped JSON file: ${path}`)
          }
        } else if (typeof obj === 'object' && !Array.isArray(obj)) {
          // Recursively search object properties
          for (const [key, value] of Object.entries(obj)) {
            const newPath = path ? `${path}.${key}` : key
            findAllUrls(value, newPath)
          }
        } else if (Array.isArray(obj)) {
          // Search array elements
          obj.forEach((item, index) => {
            const newPath = path ? `${path}[${index}]` : `[${index}]`
            findAllUrls(item, newPath)
          })
        }
      }
      
      // Find all URLs in the entire response
      findAllUrls(replicateOutput)
      
      console.log(`[Stem Split] Bulletproof extraction found ${Object.keys(stems).length} stems:`, Object.keys(stems))
      
      return Object.keys(stems).length > 0 ? stems : null
    }

    const allStems = normalizeStems(output)
    
    if (!allStems || Object.keys(allStems).length === 0) {
      console.error('[Stem Split] No audio stems found in Replicate output')
      console.error('[Stem Split] Raw output:', JSON.stringify(output, null, 2))
      
      return NextResponse.json({ 
        error: 'No audio stems could be extracted from the AI response. Please try with a different audio file.',
        refunded: false,
        debug: {
          outputKeys: Object.keys(output || {}),
          outputType: typeof output
        }
      }, { status: 500 })
    }

    // Deduct credits AFTER success (atomically to prevent race conditions)
    const { data: deductResultRaw, error: deductError } = await supabase
      .rpc('deduct_credits', {
        p_clerk_user_id: userId,
        p_amount: STEM_SPLIT_COST
      })
      .single()

    const deductResult = deductResultRaw as { success: boolean; new_credits: number; error_message: string | null } | null

    if (deductError || !deductResult?.success) {
      console.error('[Stem Split] Credit deduction error:', deductError || deductResult?.error_message)
    } else {
      console.log('[Stem Split] Credits deducted successfully (atomic operation)')
    }

    console.log(`[Stem Split] Success! Found ${Object.keys(allStems).length} stems:`, Object.keys(allStems))

    return NextResponse.json({ 
      success: true,
      stems: allStems,
      creditsUsed: STEM_SPLIT_COST,
      creditsRemaining: deductResult?.new_credits ?? (userData.credits - STEM_SPLIT_COST),
      rawOutputKeys: Object.keys(output || {})
    })
  } catch (error) {
    console.error('[Stem Split] Error:', error)
    return NextResponse.json({ 
      error: sanitizeError(error),
      details: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.stack : undefined) : undefined
    }, { status: 500 })
  }
}
