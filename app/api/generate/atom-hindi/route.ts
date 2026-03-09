import { NextRequest, NextResponse } from 'next/server'
import { getAuthUserId } from '@/lib/hybrid-auth'
import Replicate from 'replicate'
import { corsResponse, handleOptions } from '@/lib/cors'
import { SAFE_ERROR_MESSAGE } from '@/lib/sanitize-error'
import { generateLyrics, pollLyricsUntilDone } from '@/lib/suno-api'

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_KEY_LATEST2!,
})

export async function OPTIONS() {
  return handleOptions()
}

/**
 * POST /api/generate/atom-hindi
 *
 * Given a user's short idea/prompt, generates:
 *   1. An enhanced production prompt (for MiniMax 2.0) — vivid, genre-tagged,
 *      atmospheric description of the song (in English).
 *   2. Full Hindi/Urdu lyrics in ROMANIZED ENGLISH letters — structured with
 *      [Verse], [Pre-Chorus], [Chorus], [Bridge], [Outro] tags.
 *
 * Body: { prompt: string, instrumental?: boolean }
 * Returns: { success, prompt, lyrics }
 */
export async function POST(req: NextRequest) {
  try {
    const userId = await getAuthUserId(req)
    if (!userId) {
      return corsResponse(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
    }

    const { prompt, instrumental = false } = await req.json()

    if (!prompt || !prompt.trim()) {
      return corsResponse(NextResponse.json({ error: 'Missing prompt' }, { status: 400 }))
    }

    console.log(`🇮🇳 [ATOM-HINDI] Generating for user ${userId}`)
    console.log('🇮🇳 [ATOM-HINDI] User prompt:', prompt)
    console.log('🇮🇳 [ATOM-HINDI] Instrumental:', instrumental)

    // --------------- STEP 1: ENHANCED PROMPT ---------------
    const promptSystemMsg = `You are an expert South-Asian music producer. Given the user's idea, write a vivid, richly detailed music production prompt in English (max 280 characters).

RULES:
- Describe the sonic palette: instruments (sitar, tabla, dholak, tanpura, sarangi, harmonium, flute, piano, synths), textures (warm vinyl, lo-fi haze, cinematic strings, ambient pads), rhythm feel (groovy, mellow, bouncy, driving).
- Include mood/atmosphere words: nostalgic, romantic, melancholic, euphoric, night-drive, rainy, dreamy, intimate, epic.
- Tag genre/sub-genre: bollywood, desi lofi, hindi pop, urdu ghazal, qawwali, punjabi, sufi, indie hindi, R&B hindi, chill desi, trap desi.
- If the idea mentions a specific vibe or era (90s bollywood, modern trap, classical fusion), reflect that.
- Do NOT include lyrics in the prompt.
- Keep it under 280 characters total.
- Write in fluent English — this is a production description, not lyrics.

EXAMPLE OUTPUT:
Chill Urdu lofi song with soft emotional male vocals, warm vinyl texture, mellow piano chords, subtle lo-fi drums, deep ambient pads, light bass groove, rainy night atmosphere, nostalgic romantic vibe, minimal production, intimate recording, cinematic emotional tone`

    const promptUserMsg = `User idea: "${prompt.trim()}"`

    console.log('🇮🇳 [ATOM-HINDI] Generating enhanced prompt...')
    const promptOutput = await replicate.run(
      "openai/gpt-5-nano",
      {
        input: {
          system_prompt: promptSystemMsg,
          prompt: promptUserMsg,
          max_tokens: 350,
          temperature: 0.85,
        }
      }
    )

    let enhancedPrompt = ''
    if (Array.isArray(promptOutput)) {
      enhancedPrompt = promptOutput.join('')
    } else if (typeof promptOutput === 'string') {
      enhancedPrompt = promptOutput
    }

    // Clean: remove surrounding quotes, trim
    enhancedPrompt = enhancedPrompt.replace(/^["'\s]+|["'\s]+$/g, '').trim()
    // Enforce 280 char limit
    if (enhancedPrompt.length > 280) {
      enhancedPrompt = enhancedPrompt.substring(0, 277).trim() + '...'
    }

    console.log('✅ [ATOM-HINDI] Enhanced prompt:', enhancedPrompt)

    // --------------- STEP 2: HINDI LYRICS (via 444 Lyrics Engine) ---------------
    let lyrics = ''

    if (!instrumental) {
      console.log('🇮🇳 [ATOM-HINDI] Generating lyrics via 444 lyrics engine...')
      try {
        // Build a prompt that hints at Hindi/Urdu + the genre feel
        let lyricsPrompt = prompt.trim()
        const suffix = ` [Hindi, ${enhancedPrompt.substring(0, 60)}]`
        const maxBase = 200 - suffix.length
        lyricsPrompt = lyricsPrompt.slice(0, maxBase) + suffix
        lyricsPrompt = lyricsPrompt.slice(0, 200)

        const task = await generateLyrics({
          prompt: lyricsPrompt,
          callBackUrl: 'https://www.444radio.co.in/api/webhook/generation-callback',
        })

        const taskId = task.data?.taskId
        if (taskId) {
          const completed = await pollLyricsUntilDone(taskId)
          const lyricsData = completed.data?.response?.data
          if (lyricsData?.length && lyricsData[0]?.text) {
            lyrics = lyricsData[0].text.trim()
          }
        }
      } catch (lyricsErr) {
        console.error('🇮🇳 [ATOM-HINDI] Lyrics engine failed:', lyricsErr)
      }

      // Fallback: if lyrics engine returned nothing, set a minimal placeholder
      if (!lyrics) {
        lyrics = ''
        console.warn('⚠️ [ATOM-HINDI] No lyrics generated — returning empty')
      } else {
        // Post-process: fix unsupported structure tags to MiniMax v2 compatible ones
        lyrics = lyrics.replace(/\[hook\]/gi, '[Chorus]')
        lyrics = lyrics.replace(/\[pre[- ]?chorus\]/gi, '')
        lyrics = lyrics.replace(/\[verse\s*\d+\]/gi, '[Verse]')
        lyrics = lyrics.replace(/\[chorus\s*\d+\]/gi, '[Chorus]')
        lyrics = lyrics.replace(/\[final\s*chorus\]/gi, '[Chorus]')
        lyrics = lyrics.replace(/\[refrain\]/gi, '[Chorus]')
        lyrics = lyrics.replace(/\[interlude\]/gi, '[Bridge]')
        lyrics = lyrics.replace(/\[drop\]/gi, '[Chorus]')
        lyrics = lyrics.replace(/\[(?!Intro\]|Verse\]|Chorus\]|Bridge\]|Instrumental\]|Outro\])([^\]]*)\]/gi, '')
        lyrics = lyrics.replace(/\n{3,}/g, '\n\n').trim()

        // Enforce 2900 char limit (MiniMax 2.0 supports up to 3000)
        if (lyrics.length > 2900) {
          lyrics = lyrics.substring(0, 2900).trim()
          const lastNewline = lyrics.lastIndexOf('\n\n')
          if (lastNewline > 2000) {
            lyrics = lyrics.substring(0, lastNewline)
          }
        }

        console.log('✅ [ATOM-HINDI] Lyrics generated:', lyrics.substring(0, 120) + '...')
      }
    } else {
      lyrics = '[Instrumental]'
      console.log('🎹 [ATOM-HINDI] Instrumental mode — no lyrics')
    }

    return corsResponse(NextResponse.json({
      success: true,
      prompt: enhancedPrompt,
      lyrics,
      message: 'Hindi prompt & lyrics generated successfully',
    }))

  } catch (error: any) {
    console.error('🇮🇳 [ATOM-HINDI] Error:', {
      message: error?.message,
      status: error?.response?.status,
      stack: error?.stack?.substring(0, 300),
    })

    return corsResponse(NextResponse.json({
      success: false,
      error: SAFE_ERROR_MESSAGE,
    }, { status: 500 }))
  }
}
