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

// ── Genre-aware system prompts for richer lyrics ──────────────────────────

const GENRE_PROMPTS: Record<string, string> = {
  lofi: `You write dreamy, intimate lo-fi lyrics — soft imagery, rainy nights, coffee shops, nostalgia, gentle heartache. Short poetic lines, conversational tone, wistful and warm. Think bedroom poetry over mellow beats.`,
  hiphop: `You write hard-hitting hip-hop lyrics — confident wordplay, vivid street imagery, clever metaphors, punchy bars with internal rhymes. Mix braggadocio with real talk. Think Kendrick, Cole, or Drake — authentic and quotable.`,
  rap: `You write sharp, rhythmic rap lyrics — tight rhyme schemes, rapid-fire flow, double entendres, cultural references. Lines that punch hard and stick in your head. Raw, authentic, unapologetic.`,
  jazz: `You write sophisticated jazz-inflected lyrics — smoky club vibes, midnight elegance, poetic imagery of city nights, whiskey, slow dances. Smooth and sultry with literary flair. Think Billie Holiday meets spoken word.`,
  chill: `You write easygoing chill lyrics — breezy ocean vibes, sunset drives, floating feelings, carefree moments. Warm, relaxed, and effortlessly cool. Lines that feel like a deep breath on a perfect day.`,
  rnb: `You write soulful R&B lyrics — deep romantic emotion, sensual imagery, heartfelt confessions, smooth grooves. Vulnerability meets confidence. Think Frank Ocean, SZA, or The Weeknd — raw feeling wrapped in silk.`,
  techno: `You write hypnotic electronic/techno lyrics — futuristic imagery, pulsing energy, neon-lit nights, digital dreams, euphoric drops. Repetitive hooks that lock into the beat. Minimal but magnetic.`,
  pop: `You write catchy, universal pop lyrics — big hooks, relatable emotions, anthemic choruses that everyone can sing along to. Bright, energetic, emotionally resonant. Every line serves the hook.`,
  rock: `You write raw, powerful rock lyrics — rebellion, passion, driving energy, electric emotion. Guitar-soaked imagery, arena-filling choruses. Think Arctic Monkeys or Foo Fighters — visceral and alive.`,
  indie: `You write quirky, introspective indie lyrics — clever observations, offbeat metaphors, vulnerability hidden behind wit. Poetic but accessible. Think Phoebe Bridgers or Bon Iver — beautifully honest.`,
  soul: `You write deep, moving soul lyrics — gospel-influenced emotion, powerful declarations of love and pain, soaring feelings. Rich in metaphor, heavy in heart. Every word carries weight.`,
  reggae: `You write positive, rhythmic reggae lyrics — themes of love, unity, resilience, good vibes. Island warmth, sun-soaked imagery, uplifting messages. Conscious and groovy.`,
  country: `You write storytelling country lyrics — vivid narratives, small-town imagery, heartfelt emotion, whiskey and dirt roads. Honest, conversational, and deeply human.`,
  latin: `You write passionate Latin-flavored lyrics — fiery romance, dance-floor energy, tropical heat. Mix of celebration and deep emotion. Rhythmic lines that move the body and the heart.`,
  bollywood: `You write dramatic Bollywood-style lyrics — epic romance, monsoon imagery, destiny and devotion. Grand emotions in poetic language. Cinematic and sweeping.`,
  ambient: `You write ethereal ambient lyrics — sparse, evocative, dreamlike. Whispered phrases, cosmic imagery, meditative calm. Less is more — every word floats.`,
}

const DEFAULT_GENRE_PROMPT = `You write emotionally rich, genre-appropriate song lyrics — vivid imagery, authentic feeling, memorable hooks. Adapt your style to match the mood and vibe described in the prompt.`

/**
 * Detect genre from user prompt text
 */
function detectGenre(prompt: string): string {
  const lower = prompt.toLowerCase()
  const genreMap: [string, string[]][] = [
    ['lofi', ['lofi', 'lo-fi', 'lo fi', 'study beats', 'chill hop']],
    ['hiphop', ['hip hop', 'hiphop', 'hip-hop', 'trap', 'boom bap']],
    ['rap', ['rap', 'bars', 'spit', 'freestyle', 'mcee']],
    ['jazz', ['jazz', 'smooth jazz', 'bebop', 'swing', 'blues']],
    ['chill', ['chill', 'relaxing', 'calm', 'peaceful', 'mellow', 'easy listening']],
    ['rnb', ['rnb', 'r&b', 'r and b', 'rhythm and blues', 'neo soul']],
    ['techno', ['techno', 'electronic', 'edm', 'house', 'trance', 'rave', 'club']],
    ['pop', ['pop', 'catchy', 'mainstream', 'radio hit', 'pop song']],
    ['rock', ['rock', 'guitar', 'grunge', 'punk', 'metal', 'alternative']],
    ['indie', ['indie', 'alternative', 'bedroom pop', 'folk']],
    ['soul', ['soul', 'gospel', 'motown', 'neo-soul']],
    ['reggae', ['reggae', 'dancehall', 'ska', 'dub', 'island']],
    ['country', ['country', 'bluegrass', 'folk', 'americana', 'nashville']],
    ['latin', ['latin', 'reggaeton', 'salsa', 'bachata', 'cumbia', 'tropical']],
    ['bollywood', ['bollywood', 'desi', 'hindi', 'filmi']],
    ['ambient', ['ambient', 'atmospheric', 'ethereal', 'drone', 'soundscape']],
  ]
  for (const [genre, keywords] of genreMap) {
    for (const kw of keywords) {
      if (lower.includes(kw)) return genre
    }
  }
  return 'default'
}

/**
 * Detect mood from user prompt text
 */
function detectMood(prompt: string): string {
  const lower = prompt.toLowerCase()
  if (/sad|heartbreak|lonely|pain|cry|tear|missing|lost|broken/.test(lower)) return 'melancholic'
  if (/happy|joy|celebration|party|fun|dance|hype|turn up|lit/.test(lower)) return 'upbeat'
  if (/love|romance|crush|desire|passion|tender|intimate/.test(lower)) return 'romantic'
  if (/angry|rage|fight|war|aggressive|fierce|furious/.test(lower)) return 'intense'
  if (/dream|float|haze|surreal|ethereal|cosmic|space/.test(lower)) return 'dreamy'
  if (/nostalgia|remember|memories|past|old times|back then/.test(lower)) return 'nostalgic'
  if (/confident|boss|hustle|grind|success|money|flex/.test(lower)) return 'empowering'
  if (/dark|night|shadow|mystery|haunted|eerie/.test(lower)) return 'dark'
  if (/calm|peace|zen|meditat|tranquil|still/.test(lower)) return 'serene'
  return 'emotional'
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getAuthUserId(req)
    if (!userId) {
      return corsResponse(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
    }

    const { prompt, language } = await req.json()

    if (!prompt || !prompt.trim()) {
      return corsResponse(NextResponse.json({ error: 'Missing prompt' }, { status: 400 }))
    }

    const lang = (language && language !== 'English') ? language : null
    const detectedGenre = detectGenre(prompt)
    const detectedMood = detectMood(prompt)

    console.log(`🔬 [ATOM] Generating lyrics for user ${userId}${lang ? ` (language: ${lang})` : ''}`)
    console.log('🔬 [ATOM] User prompt:', prompt)
    console.log('🔬 [ATOM] Detected genre:', detectedGenre, '| Mood:', detectedMood)

    // Build genre-aware system prompt
    const genreGuidance = GENRE_PROMPTS[detectedGenre] || DEFAULT_GENRE_PROMPT

    const languageInstruction = lang
      ? `\n\nLANGUAGE: The lyrics MUST be in ${lang} language but written using ROMANIZED ENGLISH LETTERS (transliteration). Do NOT use native ${lang} script — write every word phonetically in English alphabet. For example, Hindi "मैं तुमसे प्यार करता हूँ" should be written as "Main tumse pyaar karta hoon".`
      : ''

    const systemPrompt = `You are a professional songwriter with deep expertise in ${detectedGenre !== 'default' ? detectedGenre : 'multiple genres'}. ${genreGuidance}

RULES YOU MUST FOLLOW:
1. Write REAL, EMOTIONAL lyrics with vivid imagery and authentic human feeling. NO generic filler words. NO placeholder text. NO "instrumental" or "(music plays)" annotations.
2. Every line must contain actual words that a singer would sing — real sentences with meaning, emotion, and narrative.
3. Structure MUST use ONLY these tags: [Intro], [Verse], [Chorus], [Bridge], [Outro]. NO other tags like [Hook], [Pre-Chorus], [Drop], [Verse 1], [Verse 2], etc.
4. The [Chorus] is the emotional peak — make it catchy, memorable, singable. The hook lives HERE.
5. [Verse] sections tell the story — paint vivid pictures, use specific details, not vague abstractions.
6. [Bridge] provides contrast — a shift in perspective, key change moment, or emotional turn.
7. Keep rhyme schemes natural — don't force awkward rhymes. Slant rhymes and near-rhymes are fine.
8. Total lyrics must be 200-550 characters. Quality over quantity.
9. Match the MOOD: ${detectedMood}. Let this mood infuse every line.
10. NO meta-commentary like "here's a verse about..." — just write the lyrics directly.
11. Use sensory language — sounds, textures, colors, temperatures, tastes, smells.
12. Each line should be 4-10 words. Short, punchy, singable.${languageInstruction}

EXAMPLE of GOOD lyrics (${detectedMood} mood):
[Intro]
Streetlights flicker on the rain

[Verse]
Every corner holds a name I used to know
Sidewalk cracks where we let our secrets go
Your jacket's still hanging by the door
I keep reaching for a hand that isn't there anymore

[Chorus]
We were golden in the fading light
Two hearts burning through the longest night
Now I'm standing where the echoes play
Holding on to words you'll never say

[Bridge]
Maybe time will teach me how to breathe
Without you tangled up in every dream

[Outro]
Streetlights flicker, and I walk alone`

    const userPrompt = `Write song lyrics for this idea: "${prompt.trim()}"

Remember: Real emotional words only. Structure with [Intro], [Verse], [Chorus], [Bridge], [Outro] tags ONLY. 200-550 characters total.`

    console.log('🔬 [ATOM] System prompt genre:', detectedGenre, '| Mood:', detectedMood)

    // Use OpenAI GPT-5 Nano for lyrics generation
    const output = await replicate.run(
      "openai/gpt-5-nano",
      {
        input: {
          system_prompt: systemPrompt,
          prompt: userPrompt,
          max_tokens: 700,
          temperature: 0.85,
        }
      }
    )

    console.log('🔬 [ATOM] Generation complete')

    // Get the generated lyrics from output
    let lyrics = ''

    if (Array.isArray(output)) {
      lyrics = output.join('')
    } else if (typeof output === 'string') {
      lyrics = output
    } else {
      throw new Error('Unexpected output format')
    }

    // Post-process: fix unsupported structure tags
    lyrics = lyrics.replace(/\[hook\]/gi, '[Chorus]')
    lyrics = lyrics.replace(/\[pre[- ]?chorus\]/gi, '')
    lyrics = lyrics.replace(/\[verse\s*\d+\]/gi, '[Verse]')
    lyrics = lyrics.replace(/\[chorus\s*\d+\]/gi, '[Chorus]')
    lyrics = lyrics.replace(/\[final\s*chorus\]/gi, '[Chorus]')
    lyrics = lyrics.replace(/\[refrain\]/gi, '[Chorus]')
    lyrics = lyrics.replace(/\[interlude\]/gi, '[Bridge]')
    lyrics = lyrics.replace(/\[drop\]/gi, '[Chorus]')
    lyrics = lyrics.replace(/\[breakdown\]/gi, '[Bridge]')
    // Remove any other unsupported tags
    lyrics = lyrics.replace(/\[(?!Intro\]|Verse\]|Chorus\]|Bridge\]|Outro\])([^\]]*)\]/gi, '')
    // Clean up double newlines from removed tags
    lyrics = lyrics.replace(/\n{3,}/g, '\n\n').trim()

    // SAFETY: If non-English language was requested, strip any native script the LLM may have produced
    if (lang) {
      lyrics = lyrics.replace(/[\u0900-\u097F\u0980-\u09FF\u0A00-\u0A7F\u0A80-\u0AFF\u0B00-\u0B7F\u0B80-\u0BFF\u0C00-\u0C7F\u0C80-\u0CFF\u0D00-\u0D7F\u0600-\u06FF\u0750-\u077F\u4E00-\u9FFF\u3040-\u309F\u30A0-\u30FF\uAC00-\uD7AF\u0E00-\u0E7F\u0E80-\u0EFF\u1000-\u109F\u1780-\u17FF]/g, '').replace(/\n{3,}/g, '\n\n').trim()
    }

    // Remove any "(instrumental)" or meta annotations the LLM might still add
    lyrics = lyrics.replace(/\(instrumental[^)]*\)/gi, '').replace(/\(music[^)]*\)/gi, '').replace(/\(no vocals[^)]*\)/gi, '').trim()
    lyrics = lyrics.replace(/\n{3,}/g, '\n\n').trim()

    // Trim to 600 characters max
    if (lyrics.length > 600) {
      lyrics = lyrics.substring(0, 600).trim()
      const lastNewline = lyrics.lastIndexOf('\n')
      if (lastNewline > 500) {
        lyrics = lyrics.substring(0, lastNewline)
      }
    }

    console.log('✅ [ATOM] Lyrics generated:', lyrics.substring(0, 100) + '...')
    console.log('✅ [ATOM] Lyrics length:', lyrics.length)

    return corsResponse(NextResponse.json({ 
      success: true, 
      lyrics,
      genre: detectedGenre !== 'default' ? detectedGenre : undefined,
      mood: detectedMood,
      message: 'Lyrics generated successfully with Atom' 
    }))

  } catch (error: any) {
    console.error('🔬 [ATOM] Error details:', {
      message: error?.message,
      status: error?.response?.status,
      data: error?.response?.data,
      stack: error?.stack
    })
    
    return corsResponse(NextResponse.json({ 
      success: false,
      error: SAFE_ERROR_MESSAGE
    }, { status: 500 }))
  }
}
