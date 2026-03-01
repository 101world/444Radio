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
      const lyricsSystemMsg = `You are a gifted Hindi/Urdu songwriter who writes deeply poetic, emotional, and catchy song lyrics that move the soul.

CRITICAL RULES:
1. Write lyrics in ROMANIZED ENGLISH LETTERS (transliteration) — do NOT use Devanagari, Urdu script, or any non-Latin characters.
   Example: "raat ki khamoshi mein, teri yaad chalti hai" (NOT "रात की खामोशी में").
2. Structure with ONLY these tags: [Intro], [Verse], [Chorus], [Bridge], [Outro]. NO other tags like [Pre-Chorus], [Hook], [Final Chorus], [Verse 1], [Verse 2], [Drop], etc.
3. Keep total lyrics under 550 characters.
4. Make them melodic and singable — short lines, rhyming couplets, emotional hooks that stick.
5. Match the mood/vibe described by the user — romantic, party, sad, empowering, devotional, etc.
6. Use rich Hindi/Urdu poetic vocabulary naturally — "dil", "ishq", "roshan", "shaam", "khwab", "sitaara", "raaste", "zindagi", "mohabbat", "junoon", "aasmaan", "chaand", "dariya", etc.
7. The [Chorus] must be the catchiest, most memorable part — something you'd hum for days. This IS the hook.
8. Each verse 4-6 lines, chorus 4-8 lines, bridge 2-4 lines.
9. Write REAL emotional words a singer would sing — NO "(instrumental)", NO "(music plays)", NO filler.
10. Every line must paint a vivid picture or express deep feeling — use metaphors, nature imagery, sensory details.
11. NO English lyrics unless the user specifically asks for Hinglish.

EXAMPLE OUTPUT:
[Intro]
raat ke sannate mein ek awaaz hai

[Verse]
raat ki khamoshi mein
teri yaad chalti hai
bheegi si in hawaon mein
teri baat jalti hai
dil ke sheher mein ab bhi
tera hi noor hai
main tanha sahi lekin
tera hi suroor hai

[Chorus]
tu hi meri kahani hai
tu hi mera armaan
tere bina lagta nahi
yeh dil ka samaan
tu hi meri roshni hai
andheron ke darmiyan
tere bina jeena bhi
lagta hai anjaan

[Verse]
khwabon ke kinare par
tera naam likha hai
har dhadkan ke andar
tera ishq chhupa hai

[Bridge]
agar tu paas hoti
toh raat theher jaati
yeh waqt ki gardish bhi
shayad ruk si jaati

[Outro]
tu hi meri kahani hai
tu hi mera armaan`

      const lyricsUserMsg = `Write Hindi/Urdu lyrics for this song idea: "${prompt.trim()}"

The production style is: ${enhancedPrompt}

Remember: Romanized English letters ONLY. Use ONLY these structure tags: [Intro], [Verse], [Chorus], [Bridge], [Outro]. Under 550 characters. Write REAL emotional lyrics — no instrumental placeholders.`

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
      lyrics = lyrics.replace(/\[(?!Intro\]|Verse\]|Chorus\]|Bridge\]|Outro\])([^\]]*)\]/gi, '')
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
