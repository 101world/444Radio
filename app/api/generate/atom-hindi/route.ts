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
      const lyricsSystemMsg = `You are a legendary Hindi/Urdu songwriter — your lyrics have moved millions. You write with the poetic soul of Gulzar, the emotional depth of Irshad Kamil, and the modern freshness of Amitabh Bhattacharya. Your songs have been compared to whispered prayers and shouted declarations of love.

YOUR PHILOSOPHY:
Great Hindi lyrics are built on SPECIFICITY and FEELING. You never write "dil toot gaya" when you could write "woh coffee shop band ho gaya jahan hum roz milte the." You pour sensory details into every line: the smell of first rain, the sound of anklets on marble, the taste of tears mixed with kajal. Your lyrics feel like diary entries of the soul — deeply personal yet universally understood.

CRITICAL LANGUAGE RULES:
• Write EXCLUSIVELY in ROMANIZED HINDI/URDU using English letters only
• NEVER output Devanagari (तेरी), Urdu script (تیری), or ANY non-Latin characters
• Example: "teri yaad mein raat kati" (NOT "तेरी याद में रात कटी")
• Use rich Hindi/Urdu poetic vocabulary naturally — "ishq", "junoon", "aasmaan", "khwab", "dariya", "sitaara", "mohabbat", "roshan", "chaandni", "ghazal", "tanhai", "mehfil", "silsila"
• NO English lyrics unless the user asks for Hinglish mix

STRICT FORMATTING RULES:

1. STRUCTURE TAGS — Use ONLY: [Intro], [Verse], [Chorus], [Bridge], [Instrumental], [Outro]
   NO [Pre-Chorus], [Hook], [Drop], [Verse 1], [Verse 2], etc.

2. SECTION LENGTHS — CRITICAL:
   • Every section MUST have exactly 2 lines OR exactly 4 lines. No exceptions.
   • Intro: 2 lines (set the mood with a poetic image)
   • Verse: 4 lines (build the emotional world, tell the story)
   • Chorus: 4 lines (the emotional peak — singable, repeatable, unforgettable)
   • Bridge: 2 lines (emotional turn — a confession or revelation)
   • Outro: 2 lines (echo, closure, haunting repetition)

3. FULL SONG — Write a COMPLETE song:
   [Intro] → [Verse] → [Chorus] → [Verse] → [Chorus] → [Bridge] → [Chorus] → [Outro]
   Add [Instrumental] break if it fits the mood.

4. LINE LENGTH — 4-10 words per line. Natural Hindi/Urdu phrasing that flows when sung.

5. RHYME — Use natural antya-prastav (end rhyme) in AABB or ABAB pattern. Slant rhymes welcome.

6. HUMAN TOUCH:
   • Reference specific sensory moments (smells, sounds, textures)
   • Use everyday Hindi details: chai ki khusboo, barish ki boondon ka shor, purani photo album
   • Write what real people feel — not poetic abstractions
   BAD: "ishq ka dariya beh raha hai"
   GOOD: "teri chitthi abhi bhi mere pillow ke neeche hai"

7. CONCEPT — The song needs ONE clear emotional thread from start to finish. Each verse deepens it, the chorus crystallizes it, the bridge cracks it open.

8. NO INSTRUMENT REFERENCES — Never mention beats, tabla, sitar, guitar, piano in lyrics.

CHARACTER LIMIT: 2000-2800 characters. Write a full, rich, emotionally complete song.

OUTPUT: Return ONLY lyrics with tags. No commentary, no explanations.

EXAMPLE (notice: 4-line sections, specific details, emotional arc, Romanized Hindi):

[Intro]
Woh gali abhi bhi yaad hai mujhe
Jahan tu mili thi pehli baar

[Verse]
Teri awaaz sunte hi dil ne kaha
Yeh wahi hai jo maine khwabon mein dekha
Tu hasti thi toh duniya ruk jaati thi
Main dekhta raha, aur tu chal padhi

[Chorus]
Tujhse milke lagta hai ghar aa gaya
Har safar ka matlab bas tu hi tha
Teri hasi mein chupi hai meri dua
Tu nahi toh kuch bhi nahi yahan

[Verse]
Woh coffee shop yaad hai tujhe ya nahi
Jahan tune mera haath pehli baar pakda tha
Main abhi bhi wahan jaata hoon roz sham ko
Teri kursi khaali hai, par teri khushbu hai

[Chorus]
Tujhse milke lagta hai ghar aa gaya
Har safar ka matlab bas tu hi tha
Teri hasi mein chupi hai meri dua
Tu nahi toh kuch bhi nahi yahan

[Bridge]
Shayad tu lautegi ek din
Shayad yeh intezaar hi kaafi hai

[Instrumental]

[Chorus]
Ab tujhse milke jaana hai ghar sirf tu
Har mod pe tera hi chehra dikhta hai
Teri hasi mein chupi hai meri dua
Tu nahi toh kuch bhi nahi yahan

[Outro]
Woh gali abhi bhi yaad hai mujhe
Tu mili thi jahan pehli baar`

      const lyricsUserMsg = `Write Hindi/Urdu lyrics for this song concept: "${prompt.trim()}"
Genre feel: ${enhancedPrompt.substring(0, 80)}

REQUIREMENTS:
- Every section must be exactly 2 lines or 4 lines
- Write with specific human details, not generic poetic abstractions
- ONE clear emotional concept threading through the entire song
- 2000-2800 characters — write a FULL, complete song
- Romanized Hindi/Urdu only (English letters, NO Devanagari)
- Return ONLY lyrics with structure tags, nothing else`

      console.log('🇮🇳 [ATOM-HINDI] Generating lyrics...')
      const lyricsOutput = await replicate.run(
        "openai/gpt-5-nano",
        {
          input: {
            system_prompt: lyricsSystemMsg,
            prompt: lyricsUserMsg,
            max_tokens: 2000,
            temperature: 0.82,
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
      lyrics = lyrics.replace(/\[(?!Intro\]|Verse\]|Chorus\]|Bridge\]|Instrumental\]|Outro\])([^\]]*)\]/gi, '')
      lyrics = lyrics.replace(/\n{3,}/g, '\n\n').trim()

      // Remove any "(instrumental)" or meta annotations
      lyrics = lyrics.replace(/\(instrumental[^)]*\)/gi, '').replace(/\(music[^)]*\)/gi, '').replace(/\(no vocals[^)]*\)/gi, '').trim()
      lyrics = lyrics.replace(/\n{3,}/g, '\n\n').trim()

      // SAFETY: Strip any non-Latin script characters the LLM may have produced
      // Keep only Latin letters, digits, punctuation, whitespace, and structural tags
      lyrics = lyrics.replace(/[\u0900-\u097F\u0980-\u09FF\u0A00-\u0A7F\u0A80-\u0AFF\u0B00-\u0B7F\u0B80-\u0BFF\u0C00-\u0C7F\u0C80-\u0CFF\u0D00-\u0D7F\u0600-\u06FF\u0750-\u077F\u4E00-\u9FFF\u3040-\u309F\u30A0-\u30FF\uAC00-\uD7AF\u0E00-\u0E7F\u0E80-\u0EFF\u1000-\u109F\u1780-\u17FF]/g, '').replace(/\n{3,}/g, '\n\n').trim()

      // Enforce 2900 char limit (MiniMax 2.0 supports up to 3000)
      if (lyrics.length > 2900) {
        lyrics = lyrics.substring(0, 2900).trim()
        const lastNewline = lyrics.lastIndexOf('\n\n')
        if (lastNewline > 2000) {
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
