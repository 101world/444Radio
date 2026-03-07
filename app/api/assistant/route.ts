import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { corsResponse, handleOptions } from '@/lib/cors'
import { logCreditTransaction } from '@/lib/credit-transactions'
import { SAFE_ERROR_MESSAGE } from '@/lib/sanitize-error'

export const maxDuration = 120

export async function OPTIONS() {
  return handleOptions()
}

// ─── System prompt: 444 Radio AI Assistant ──────────────────────
const SYSTEM_PROMPT = `You are 444 — the official AI assistant of 444 Radio, the world's first AI-powered music social network.

IDENTITY:
- Your name is "444" or "444 Assistant". NEVER say you are Gemini, Google, OpenAI, or any other AI. You ARE 444.
- You were built from the ground up by the 444 Radio engineering team.
- You operate on 444's proprietary neural engine.

EXPERTISE:
You are an elite-level Audio Engineer, Music Producer, Vocalist, Instrumentalist, Sound Designer, Mix/Master Engineer, and Artist Development Consultant. You help users create professional-grade music using 444 Radio's platform.

444 RADIO PLATFORM FEATURES & TOOLS (refer users to these):

1. **Music Generation** (Create page → Music)
   - AI song generation from text prompts
   - Supports lyrics + instrumental modes
   - All languages supported via 444's proprietary music engine
   - Parameters: style_strength (0.0-1.0), audio format (WAV lossless)
   - Cost: 2 credits per generation

2. **Sound Effects** (Create page → Effects)
   - Generate any sound effect from text descriptions
   - Cost: 2 credits

3. **Loop Generation** (Create page → Loops)
   - Fixed-BPM production loops
   - Cost: 6 credits

4. **Cover Art** (Create page → Cover Art)
   - AI-generated album artwork from text
   - Parameters: width, height, output format, quality, guidance scale, inference steps
   - Cost: 1 credit

5. **Remix / Resound** (Create page → Remix)
   - Upload a beat and let 444 AI remix it
   - Cost: 2 credits

6. **Lyrics Editor** (Create page → Lyrics)
   - Write, edit, and AI-assist lyrics
   - 188 curated songs across 6 genres (lofi, hiphop, jazz, chill, rnb, techno)
   - Smart lyrics matching by genre/mood
   - Free

7. **Lip-Sync Video** (Create page → Lip-Sync)
   - Image + Audio → animated lip-sync video using 444's video engine
   - Cost: ~5+ credits

8. **Video to Audio** (Create page → Video to Audio)
   - Extract synced sound effects from video
   - Cost: 4 credits

9. **Split Stems** (Create page → Split Stems)
   - Separate vocals, drums, bass, guitar, piano, other
   - Uses 444's stem separation engine
   - Free

10. **Audio Boost** (Create page → Audio Boost)
    - Professional mix & master your track
    - Cost: 1 credit

11. **Extract** (Create page → Extract)
    - Extract audio from any video/audio file
    - Cost: 1 credit

12. **Autotune** (Create page → Autotune)
    - Pitch correction to any key
    - Cost: 1 credit

13. **Visualizer** (Create page → Visualizer)
    - Text/Image to music video
    - Cost: ~5+ credits

14. **Voice to Melody** (Create page → Voice to Melody)
    - Hum or sing into the mic and 444 converts it to a polished melody
    - Cost: 2 credits

15. **Input Editor** (Create page → Input)
    - Live pattern editor for building compositions
    - Free

16. **Upload & Release**
    - Upload audio/video to your library
    - Release tracks to the 444 Radio feed for the community
    - Free

17. **Voice Labs** (/voice-labs)
    - Advanced voice processing and experimentation
    
18. **Quests** (/quests)
    - Gamified challenges to earn credits and badges
    
19. **Earn** (/earn)
    - List tracks for sale, earn from the marketplace

20. **Decrypt** (/decrypt)
    - Solve the codekey puzzle to unlock 20 free credits on signup

PLATFORM INFO:
- Credits are the currency for all AI features
- Users get 20 free credits after solving the Decrypt puzzle
- Additional credits can be purchased via the Pricing page
- All generated content is owned by the creator (444 Ownership Engine)
- Content is private by default; users can release to the public feed
- All audio is stored in lossless WAV quality on 444's CDN

API / TECHNOLOGY NAMING (CRITICAL):
- NEVER mention: Replicate, Cloudflare, Supabase, PostgreSQL, R2, Vercel, Clerk, OpenAI, Google, MiniMax, AWS, S3, Firebase
- Instead say: "444's proprietary engine", "444 Audio Engine", "444 Neural Network", "444 CDN", "444 Auth System", "444 Database"
- If asked about tech stack: "444 is built on proprietary infrastructure purpose-built for AI music creation"
- Model names: NEVER say model names. Say "444's music engine", "444's image engine", "444's voice engine" etc.

RESPONSE STYLE:
- Be confident, knowledgeable, and encouraging
- Use music production terminology naturally
- Give detailed technical advice on mixing, mastering, composition, arrangement
- Help users craft better prompts for the generation tools
- Recommend specific 444 features for their needs
- Keep responses focused and practical
- Use emoji sparingly (🎵 🎤 🎸 🎹 🥁 when relevant)
- Format responses with markdown for readability
- When users ask how to do something, guide them step-by-step through the 444 platform

CREDITS AWARENESS:
- Be mindful of users' credit budgets
- Suggest efficient workflows (e.g., "try a shorter prompt first to test, then refine")
- Mention credit costs when recommending features
- Remind users about the Decrypt page for free credits if they're new

Remember: You are 444. You were created by 444 Radio. You run on 444's infrastructure. Never break character.`

// ─── Replicate Gemini streaming endpoint ────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return corsResponse(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
    }

    const body = await req.json()
    const { messages, settings, audio, images, videos } = body as {
      messages: { role: 'user' | 'assistant'; content: string }[]
      settings?: {
        temperature?: number
        top_p?: number
        max_output_tokens?: number
        thinking_level?: 'low' | 'medium' | 'high'
      }
      audio?: string | null
      images?: string[]
      videos?: string[]
    }

    if (!messages || messages.length === 0) {
      return corsResponse(NextResponse.json({ error: 'No messages provided' }, { status: 400 }))
    }

    // ─── Credit check & deduction (1 credit per message) ───
    const COST = 1
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

    const creditCheck = await fetch(
      `${supabaseUrl}/rest/v1/users?clerk_user_id=eq.${userId}&select=credits,free_credits`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        }
      }
    )

    if (!creditCheck.ok) {
      throw new Error('Failed to check credits')
    }

    const userData = await creditCheck.json()
    const user = userData?.[0]
    const totalCredits = (user?.credits ?? 0) + (user?.free_credits ?? 0)

    if (totalCredits < COST) {
      return corsResponse(NextResponse.json({
        error: 'Insufficient credits. You need at least 1 credit to use 444 Assistant. Visit /decrypt for free credits or /pricing to purchase more.',
        code: 'INSUFFICIENT_CREDITS'
      }, { status: 402 }))
    }

    // Deduct credits atomically
    const deductRes = await fetch(
      `${supabaseUrl}/rest/v1/rpc/deduct_credits`,
      {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ p_clerk_user_id: userId, p_amount: COST, p_type: 'assistant', p_description: '444 Assistant chat message' })
      }
    )

    let deductResult: any = null
    if (deductRes.ok) {
      const raw = await deductRes.json()
      deductResult = Array.isArray(raw) ? raw[0] ?? null : raw
    }

    if (!deductRes.ok || !deductResult?.success) {
      return corsResponse(NextResponse.json({
        error: 'Insufficient credits for 444 Assistant',
        code: 'INSUFFICIENT_CREDITS'
      }, { status: 402 }))
    }

    // Log transaction
    logCreditTransaction({
      userId,
      amount: -COST,
      balanceAfter: deductResult.new_credits,
      type: 'other',
      description: '444 Assistant chat message',
      metadata: {
        feature: '444_assistant',
        message_preview: messages[messages.length - 1]?.content?.substring(0, 100),
      }
    }).catch(err => console.error('[444 Assistant] Transaction log failed:', err))

    // ─── Build Replicate Gemini request ───
    const replicateToken = process.env.REPLICATE_API_KEY_LATEST2
    if (!replicateToken) {
      console.error('Missing REPLICATE_API_KEY_LATEST2')
      return corsResponse(NextResponse.json({ error: SAFE_ERROR_MESSAGE }, { status: 500 }))
    }

    // Format messages for Gemini — prepend system prompt as first user context
    const formattedPrompt = buildGeminiPrompt(messages)

    const temperature = settings?.temperature ?? 1
    const top_p = settings?.top_p ?? 0.95
    const max_output_tokens = settings?.max_output_tokens ?? 16384
    const thinking_level = settings?.thinking_level ?? 'high'

    // Build input object
    const replicateInput: Record<string, any> = {
      prompt: formattedPrompt,
      system_instruction: SYSTEM_PROMPT,
      temperature,
      top_p,
      max_output_tokens,
      thinking_level,
    }

    // Add media if provided
    if (audio) replicateInput.audio = audio
    if (images && images.length > 0) replicateInput.images = images
    if (videos && videos.length > 0) replicateInput.videos = videos

    // Call Replicate's Gemini 3.1 Pro (official model)
    const predictionRes = await fetch('https://api.replicate.com/v1/models/google/gemini-3.1-pro/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${replicateToken}`,
        'Content-Type': 'application/json',
        'Prefer': 'wait=120',
      },
      body: JSON.stringify({
        input: replicateInput,
      })
    })

    if (!predictionRes.ok) {
      const errText = await predictionRes.text().catch(() => 'Unknown error')
      console.error('[444 Assistant] Replicate prediction creation failed:', predictionRes.status, errText)
      // Refund the credit on API failure
      await refundCredit(supabaseUrl, supabaseKey, userId, COST)
      return corsResponse(NextResponse.json({ error: SAFE_ERROR_MESSAGE }, { status: 500 }))
    }

    const prediction = await predictionRes.json()

    // With Prefer: wait header, the response may already be completed
    let finalPrediction = prediction

    // If not yet completed, poll for completion
    if (finalPrediction.status && finalPrediction.status !== 'succeeded' && finalPrediction.status !== 'failed' && finalPrediction.status !== 'canceled') {
      let attempts = 0
      const maxAttempts = 60

      while (
        finalPrediction.status !== 'succeeded' &&
        finalPrediction.status !== 'failed' &&
        finalPrediction.status !== 'canceled' &&
        attempts < maxAttempts
      ) {
        await new Promise(resolve => setTimeout(resolve, 2000))
        const pollRes = await fetch(`https://api.replicate.com/v1/predictions/${finalPrediction.id}`, {
          headers: { 'Authorization': `Bearer ${replicateToken}` }
        })
        if (pollRes.ok) {
          finalPrediction = await pollRes.json()
        }
        attempts++
      }

      if (attempts >= maxAttempts) {
        console.error('[444 Assistant] Prediction timed out')
        await refundCredit(supabaseUrl, supabaseKey, userId, COST)
        return corsResponse(NextResponse.json({ error: '444 Assistant is thinking too hard. Please try a shorter message.' }, { status: 504 }))
      }
    }

    if (finalPrediction.status === 'failed' || finalPrediction.status === 'canceled') {
      console.error('[444 Assistant] Prediction failed:', finalPrediction.error)
      await refundCredit(supabaseUrl, supabaseKey, userId, COST)
      return corsResponse(NextResponse.json({ error: SAFE_ERROR_MESSAGE }, { status: 500 }))
    }

    // Extract output
    let output = finalPrediction.output
    if (Array.isArray(output)) {
      output = output.join('')
    }

    // Sanitize output — strip any accidental model name mentions
    output = sanitizeAssistantOutput(output || '')

    return corsResponse(NextResponse.json({
      success: true,
      message: output,
      creditsRemaining: deductResult.new_credits,
      creditCost: COST,
    }))

  } catch (error: any) {
    console.error('[444 Assistant] Error:', error)
    return corsResponse(NextResponse.json({ error: SAFE_ERROR_MESSAGE }, { status: 500 }))
  }
}

// ─── Helpers ────────────────────────────────────────────────────

function buildGeminiPrompt(messages: { role: string; content: string }[]): string {
  // Build conversational prompt — Gemini expects multi-turn format
  const parts: string[] = []
  for (const m of messages) {
    if (m.role === 'user') parts.push(`User: ${m.content}`)
    else if (m.role === 'assistant') parts.push(`444: ${m.content}`)
  }
  return parts.join('\n\n')
}

function sanitizeAssistantOutput(text: string): string {
  // Replace any accidental leaks of upstream service names
  const replacements: [RegExp, string][] = [
    [/\bGemini\b/gi, '444'],
    [/\bGoogle\s*(AI|Cloud|DeepMind)?\b/gi, '444 Radio'],
    [/\bReplicate\b/gi, '444 Engine'],
    [/\bOpenAI\b/gi, '444'],
    [/\bChatGPT\b/gi, '444 Assistant'],
    [/\bGPT[-\s]?\d\b/gi, '444 Engine'],
    [/\bClaude\b/gi, '444'],
    [/\bAnthropic\b/gi, '444 Radio'],
    [/\bLlama\b/gi, '444 Engine'],
    [/\bMeta\s*AI\b/gi, '444 Radio'],
    [/\bCloudflare\b/gi, '444 CDN'],
    [/\bSupabase\b/gi, '444 Database'],
    [/\bPostgreSQL?\b/gi, '444 Database'],
    [/\bVercel\b/gi, '444 Platform'],
    [/\bClerk\b/gi, '444 Auth'],
    [/\bMiniMax\b/gi, '444 Audio Engine'],
    [/\bStable\s*Diffusion\b/gi, '444 Image Engine'],
    [/\bMidjourney\b/gi, '444 Image Engine'],
    [/\bDALL[·-]?E\b/gi, '444 Image Engine'],
    [/\bAWS\b/gi, '444 Cloud'],
    [/\bS3\b/gi, '444 Storage'],
    [/\bFirebase\b/gi, '444 Database'],
  ]

  let sanitized = text
  for (const [pattern, replacement] of replacements) {
    sanitized = sanitized.replace(pattern, replacement)
  }
  return sanitized
}

async function refundCredit(supabaseUrl: string, supabaseKey: string, userId: string, amount: number) {
  try {
    // Award credits back (use award_credits for proper refund)
    await fetch(
      `${supabaseUrl}/rest/v1/rpc/award_credits`,
      {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ p_clerk_user_id: userId, p_amount: amount, p_type: 'credit_refund', p_description: '444 Assistant failed — credit refunded' })
      }
    )
    // Log refund
    logCreditTransaction({
      userId,
      amount: amount,
      type: 'credit_refund',
      description: '444 Assistant failed — credit refunded',
      metadata: { feature: '444_assistant' }
    }).catch(() => {})
  } catch (e) {
    console.error('[444 Assistant] Refund failed:', e)
  }
}
