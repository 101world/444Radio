import { NextRequest, NextResponse } from 'next/server'
import { getAuthUserId } from '@/lib/hybrid-auth'
import Replicate from 'replicate'
import { corsResponse, handleOptions } from '@/lib/cors'

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_KEY_LATEST2!
})

export async function OPTIONS() {
  return handleOptions()
}

// ── Variety pools: the LLM is instructed to pick randomly from these so
//    consecutive prompts within the same genre/mood still sound different. ──

const SONIC_TEXTURES = [
  'tape-saturated warmth', 'granular shimmer', 'bitcrushed grit', 'ring-modulated tones',
  'frequency-shifted pads', 'wavefolder distortion', 'spectral freezing', 'formant-filtered sweeps',
  'convolution reverb decay', 'pitch-drifting oscillators', 'sample-and-hold modulation',
  'phaser-washed chords', 'comb-filtered resonance', 'envelope-followed bass',
  'karplus-strong plucks', 'vocoder textures', 'wavetable morphing',
  'resonant self-oscillation', 'granular time-stretch', 'half-speed tape echo',
  'spring reverb crunch', 'tube-driven harmonics', 'glitch-cut stutters',
  'stochastic percussion', 'filtered white-noise risers', 'shimmer-verb cascades',
  'flanged feedback loops', 'stereo haas widening', 'mid-side compression',
  'transient-sculpted clicks', 'lo-fi vinyl crackle', 'metallic FM bells',
]

const PRODUCTION_TECHNIQUES = [
  'parallel compression on drums', 'sidechain-pumped pads', 'NY-style bus compression',
  'mid-side EQ sculpting', 'multiband saturation', 'dynamic stereo panning',
  'ghost-note hi-hats', 'polyrhythmic layering', 'tempo-synced delay throws',
  'reverse reverb swells', 'sub-harmonic synthesis', 'needle-drop transitions',
  'tape-stop effects', 'pitch-riser builds', 'gated-reverb snares',
  'ducked atmospheric layers', 'swing-quantized grooves', 'micro-timing humanization',
  'send-return distortion', 'frequency-dependent gating', 'crossfeed stereo imaging',
  'analog drift detuning', 'harmonic exciter sheen', 'dynamic EQ ducking',
]

const ATMOSPHERE_WORDS = [
  'nocturnal', 'sun-drenched', 'subterranean', 'celestial', 'post-apocalyptic',
  'neon-lit', 'rain-soaked', 'fog-wrapped', 'crystalline', 'volcanic',
  'arctic', 'desert-baked', 'oceanic', 'forest-deep', 'metropolitan',
  'space-station', 'cathedral', 'basement club', 'rooftop sunset', 'abandoned warehouse',
  'late-night highway', 'dawn patrol', 'twilight haze', 'midnight laboratory',
  'coastal cliffside', 'underground tunnel', 'floating observatory', 'neon arcade',
]

const VOCAL_STYLES = [
  'intimate whispered delivery', 'soaring chest-voice belting', 'smoky low-register croon',
  'airy falsetto harmonies', 'raw throat-sung intensity', 'double-tracked unison',
  'call-and-response layers', 'rhythmic staccato phrasing', 'legato melodic flow',
  'breathy R&B runs', 'punk-shouted energy', 'jazz-scatted improvisation',
  'gospel-powered ad-libs', 'monotone spoken word', 'pitch-bent auto-tune glide',
  'lo-fi bedroom intimacy', 'stadium anthem projection', 'chopped vocal fragments',
]

function pickRandom<T>(arr: T[], count: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, count)
}

function buildMusicPrompt(opts: {
  genre: string
  promptType: 'song' | 'beat'
  mood?: string
  energy?: string
  era?: string
}): string {
  const { genre, promptType, mood, energy, era } = opts
  const isBeat = promptType === 'beat'

  // Pick random variety seeds so repeated calls with the same inputs diverge
  const textures = pickRandom(SONIC_TEXTURES, 3).join(', ')
  const techniques = pickRandom(PRODUCTION_TECHNIQUES, 2).join(', ')
  const atmospheres = pickRandom(ATMOSPHERE_WORDS, 2).join(' / ')
  const vocalHint = isBeat ? '' : `\nVocal direction hint: ${pickRandom(VOCAL_STYLES, 1)[0]}.`

  const moodLine = mood ? `Target mood/vibe: "${mood}".` : ''
  const energyLine = energy ? `Energy level: ${energy}.` : ''
  const eraLine = era ? `Sonic era/influence: ${era}.` : ''
  const contextLines = [moodLine, energyLine, eraLine].filter(Boolean).join(' ')

  const typeInstruction = isBeat
    ? 'a purely INSTRUMENTAL beat — absolutely NO vocals, singing, humming, chanting, or voice of any kind'
    : 'a complete song with expressive vocals, lyrics, and melodic vocal performance'

  return `You are a world-class music producer, sound designer, and A&R creative director with encyclopedic knowledge of every genre from vintage analog to cutting-edge electronic.

TASK: Write ONE unique, vivid music-generation prompt for ${typeInstruction} in the "${genre}" genre.

${contextLines ? `USER PREFERENCES:\n${contextLines}\n` : ''}CREATIVE SEEDS (use 1-2 of these as starting inspiration, then go beyond them):
• Textures: ${textures}
• Techniques: ${techniques}
• Atmosphere: ${atmospheres}${vocalHint}

PROMPT-WRITING RULES:
1. Start with the dominant sonic character — describe what the listener HEARS first.
2. Layer in rhythm, tempo feel, and groove description (don't just say "120 BPM" — describe the FEEL).
3. Paint a spatial/atmospheric picture — where does this music live?
4. ${isBeat ? 'NEVER mention any vocal element — no singing, humming, voice, rap, chanting, vocal chops, or vocal samples.' : 'Include vocal character — tone, delivery, emotion, and placement in the mix.'}
5. Use SPECIFIC, uncommon descriptors — avoid generic phrases like "crisp drums", "punchy 808s", "lush pads", "warm saturation".
6. Every prompt must feel like it describes a DIFFERENT song, even within the same genre.
7. No negative words. No meta commentary. No quotation marks around the output.
8. Length: 200–265 characters. Output ONLY the prompt text, nothing else.`
}

function buildVisualizerPrompt(): string {
  const styles = [
    'photorealistic cinematic with volumetric lighting',
    'hand-painted anime with cel-shading and bloom',
    'abstract geometric with kaleidoscopic patterns',
    'dreamy impressionist with soft particle effects',
    'cyberpunk holographic with glitch artifacts',
    'organic bioluminescent with fluid dynamics',
    'retro VHS analog with scan lines and color bleed',
    'surrealist collage with impossible architecture',
  ]
  const style = pickRandom(styles, 1)[0]
  const atmo = pickRandom(ATMOSPHERE_WORDS, 2).join(', ')

  return `Generate a vivid visual scene description for a music visualizer video.
Style: ${style}.
Atmosphere hints: ${atmo}.
Include: specific camera movement, lighting quality, color palette, texture, and emotional tone.
Length: 120–180 characters. Output ONLY the scene description, nothing else.`
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthUserId(request)
    if (!userId) {
      return corsResponse(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
    }

    const { genre, promptType, mood, energy, era } = await request.json()

    if (!promptType) {
      return corsResponse(NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      ))
    }

    // Visualizer prompts don't require genre
    if (promptType !== 'visualizer' && !genre) {
      return corsResponse(NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      ))
    }

    console.log(`🎨 Generating ${promptType} prompt${genre ? ` for ${genre}` : ''}${mood ? ` (mood: ${mood})` : ''}${energy ? ` (energy: ${energy})` : ''}${era ? ` (era: ${era})` : ''}...`)

    const fullPrompt = promptType === 'visualizer'
      ? buildVisualizerPrompt()
      : buildMusicPrompt({ genre, promptType, mood, energy, era })

    // Use GPT-5 Nano
    const output = await replicate.run(
      "openai/gpt-5-nano",
      {
        input: {
          prompt: fullPrompt
        }
      }
    )

    let generatedPrompt = ''
    if (Array.isArray(output)) {
      generatedPrompt = output.join('').trim()
    } else {
      generatedPrompt = String(output).trim()
    }

    // Clean up the prompt
    let cleanPrompt = generatedPrompt
      .replace(/^["']|["']$/g, '') // Remove quotes
      .replace(/\n+/g, ' ') // Remove newlines
      .replace(/\s+/g, ' ') // Normalize spaces
      .trim()

    // For beats/instrumentals: Remove vocal-related words and add "no vocals"
    if (promptType === 'beat') {
      cleanPrompt = cleanPrompt
        .replace(/\b(vocals?|voices?|singing|singer|sung|sing|vox|vocoder|choir|choral|lyrics?|humming|chant(?:ing)?|whisper(?:ed)?|spoken|rap(?:ping|per)?|falsetto|soprano|alto|tenor|baritone|a\s*capella|acapella)\b/gi, '')
        .replace(/\b(vocal\s*(?:chops?|samples?|harmon(?:y|ies)|m[eé]lod(?:y|ie|ía)s?|performance))\b/gi, '')
        .replace(/\b(rich|lush|soaring|ethereal|warm|smooth|deep|powerful|soulful|backing|lead|melodic)\s+vocals?\b/gi, '')
        .replace(/\s+/g, ' ')
        .replace(/,\s*,+/g, ',')
        .replace(/,\s*$/, '')
        .replace(/^\s*,/, '')
        .trim()
      
      if (!cleanPrompt.toLowerCase().includes('no vocal') && !cleanPrompt.toLowerCase().includes('instrumental only')) {
        cleanPrompt += ', no vocals, instrumental only'
      } else if (!cleanPrompt.toLowerCase().includes('no vocal')) {
        cleanPrompt += ', no vocals'
      }
    }

    // Character limits vary by type
    const maxLen = promptType === 'visualizer' ? 200 : 265
    const minLen = promptType === 'visualizer' ? 80 : 150

    if (cleanPrompt.length > maxLen) {
      cleanPrompt = cleanPrompt.slice(0, maxLen).trim()
    }

    if (cleanPrompt.length < minLen) {
      const filler = promptType === 'visualizer'
        ? ', cinematic lighting, volumetric atmosphere, slow camera drift'
        : ' with professional mixing, warm analog character, and spatial depth'
      cleanPrompt += filler
      if (cleanPrompt.length > maxLen) {
        cleanPrompt = cleanPrompt.slice(0, maxLen).trim()
      }
    }

    console.log(`✅ Generated prompt (${cleanPrompt.length} chars):`, cleanPrompt)

    return corsResponse(NextResponse.json({
      success: true,
      prompt: cleanPrompt,
      genre,
      type: promptType
    }))
  } catch (error: any) {
    console.error('❌ Prompt generation error:', error)
    return corsResponse(NextResponse.json(
      {
        error: '444 Radio locking in. Please try again.'
      },
      { status: 500 }
    ))
  }
}
