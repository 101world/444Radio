import { NextRequest, NextResponse } from 'next/server'
import { getAuthUserId } from '@/lib/hybrid-auth'
import Replicate from 'replicate'
import { corsResponse, handleOptions } from '@/lib/cors'
import { SAFE_ERROR_MESSAGE } from '@/lib/sanitize-error'

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

    // --------------- STEP 2: HINDI LYRICS ---------------
    let lyrics = ''

    if (!instrumental) {
      const lyricsSystemMsg = `You are a professional Hindi/Urdu songwriter who writes highly musical, singable lyrics.

Your lyrics must sound like a real recorded song — simple, rhythmic, and catchy.

CRITICAL RULES:

LANGUAGE
• Write in ROMANIZED HINDI/URDU using English letters only.
• Never output Devanagari, Urdu script, or any non-Latin characters.
• Example: "teri yaad" (NOT "तेरी याद").
• NO English lyrics unless the user specifically asks for Hinglish.

LYRIC STYLE
• Lines must be SHORT (2–6 words per line).
• Prioritize RHYME and rhythm over complex sentences.
• Use repeating phrases for musical hooks.
• Avoid long descriptive lines.
• Avoid production or instrument words (no beat, drums, piano, synth, etc).
• Use rich Hindi/Urdu poetic vocabulary naturally — "dil", "ishq", "roshan", "shaam", "khwab", "sitaara", "raaste", "zindagi", "mohabbat", "junoon", "aasmaan", "chaand", "dariya", etc.

STRUCTURE
Use ONLY these tags: [Intro], [Verse], [Chorus], [Bridge], [Instrumental], [Outro].
NO other tags like [Pre-Chorus], [Hook], [Final Chorus], [Verse 1], [Verse 2], [Drop], etc.

SECTION RULES
• Intro: 1–2 short lines, repetition allowed.
• Verse: 4–6 short lines, simple rhyming scheme.
• Chorus: 4–6 lines, strongest rhyme, repeat key phrase. This IS the hook.
• Bridge: 2–3 lines, emotional shift.
• Instrumental: ONLY the tag — no lyrics.
• Outro: 1–2 lines, repetition allowed.

WRITING STYLE
• melodic, emotional, easy to sing
• rhythmic flow with strong rhyme endings

CHARACTER LIMIT
Under 550 characters total.

OUTPUT
Return ONLY the lyrics with tags. No commentary.

EXAMPLE OUTPUT:
[Intro]
teri yaad
teri yaad

[Verse]
raat dheemi
dil nami
khwab tere
saath mere
naam tera
saans meri

[Chorus]
tu hi roshni
tu hi zindagi
tu hi roshni
tu hi zindagi

[Bridge]
raat ruk ja
dil keh ja

[Instrumental]

[Outro]
tu hi roshni
tu hi roshni`

      const lyricsUserMsg = `Write Hindi/Urdu lyrics for this song idea: "${prompt.trim()}"
Genre: ${enhancedPrompt.substring(0, 80)}
Mood: based on the user prompt above
Language: Romanized Hindi/Urdu

Keep lines short and rhyming. Under 550 characters. Return ONLY lyrics with tags.`

      console.log('🇮🇳 [ATOM-HINDI] Generating lyrics...')
      const lyricsOutput = await replicate.run(
        "openai/gpt-5-nano",
        {
          input: {
            system_prompt: lyricsSystemMsg,
            prompt: lyricsUserMsg,
            max_tokens: 700,
            temperature: 0.9,
          }
        }
      )

      if (Array.isArray(lyricsOutput)) {
        lyrics = lyricsOutput.join('')
      } else if (typeof lyricsOutput === 'string') {
        lyrics = lyricsOutput
      }

      // Clean up
      lyrics = lyrics.trim()

      // Post-process: fix unsupported structure tags to MiniMax v2 compatible ones
      lyrics = lyrics.replace(/\[hook\]/gi, '[Chorus]')
      lyrics = lyrics.replace(/\[pre[- ]?chorus\]/gi, '')
      lyrics = lyrics.replace(/\[verse\s*\d+\]/gi, '[Verse]')
      lyrics = lyrics.replace(/\[chorus\s*\d+\]/gi, '[Chorus]')
      lyrics = lyrics.replace(/\[final\s*chorus\]/gi, '[Chorus]')
      lyrics = lyrics.replace(/\[refrain\]/gi, '[Chorus]')
      lyrics = lyrics.replace(/\[interlude\]/gi, '[Bridge]')
      lyrics = lyrics.replace(/\[drop\]/gi, '[Chorus]')
      // Remove any other unsupported tags
      lyrics = lyrics.replace(/\[(?!Intro\]|Verse\]|Chorus\]|Bridge\]|Instrumental\]|Outro\])([^\]]*)\ ]/gi, '')
      lyrics = lyrics.replace(/\n{3,}/g, '\n\n').trim()

      // Remove any "(instrumental)" or meta annotations
      lyrics = lyrics.replace(/\(instrumental[^)]*\)/gi, '').replace(/\(music[^)]*\)/gi, '').replace(/\(no vocals[^)]*\)/gi, '').trim()
      lyrics = lyrics.replace(/\n{3,}/g, '\n\n').trim()

      // SAFETY: Strip any non-Latin script characters the LLM may have produced
      // Keep only Latin letters, digits, punctuation, whitespace, and structural tags
      lyrics = lyrics.replace(/[\u0900-\u097F\u0980-\u09FF\u0A00-\u0A7F\u0A80-\u0AFF\u0B00-\u0B7F\u0B80-\u0BFF\u0C00-\u0C7F\u0C80-\u0CFF\u0D00-\u0D7F\u0600-\u06FF\u0750-\u077F\u4E00-\u9FFF\u3040-\u309F\u30A0-\u30FF\uAC00-\uD7AF\u0E00-\u0E7F\u0E80-\u0EFF\u1000-\u109F\u1780-\u17FF]/g, '').replace(/\n{3,}/g, '\n\n').trim()

      // Enforce 600 char limit (MiniMax limit)
      if (lyrics.length > 600) {
        lyrics = lyrics.substring(0, 597).trim()
        const lastNewline = lyrics.lastIndexOf('\n')
        if (lastNewline > 450) {
          lyrics = lyrics.substring(0, lastNewline)
        }
      }

      console.log('✅ [ATOM-HINDI] Lyrics generated:', lyrics.substring(0, 120) + '...')
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
