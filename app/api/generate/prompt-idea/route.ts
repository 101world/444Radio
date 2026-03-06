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

export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthUserId(request)
    if (!userId) {
      return corsResponse(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
    }

    const { genre, promptType } = await request.json()

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

    console.log(`🎨 Generating ${promptType} prompt${genre ? ` for ${genre}` : ''}...`)

    let fullPrompt: string

    if (promptType === 'visualizer') {
      fullPrompt = `Generate a vivid, cinematic visual scene description for a music video or visualizer. Include specific camera movement, lighting, atmosphere, color palette, and mood. Pick ONE of these styles randomly: photorealistic cinematic, anime/stylized, dreamy/atmospheric, or abstract/experimental. The description should be 120-180 characters, visually rich and evocative. Examples: "Rain-soaked neon streets of Tokyo at midnight, slow camera drift, reflections on wet asphalt, hyper-realistic" or "An anime girl with headphones on a cyberpunk rooftop, neon rain, lo-fi aesthetic". Generate ONLY the scene description, nothing else:`
    } else {
      const typeDescription = promptType === 'song' 
        ? 'a complete song with vocals, lyrics, and full melodic vocal performance' 
        : 'a pure instrumental beat with absolutely NO vocals, NO voice, NO singing, NO humming - purely instrumental'
      
      fullPrompt = promptType === 'beat'
        ? `You are an elite music producer and sound designer.\nGenerate a professional INSTRUMENTAL music production prompt in the ${genre} genre.\n\nRULES:\n- Every prompt must sound UNIQUE.\n- Never repeat the same instrument combinations or phrases from previous prompts.\n- Use varied sonic descriptions, studio techniques, textures, and production terminology.\n- Include: tempo, rhythm style, instrumentation, production techniques, atmosphere.\n- Avoid repeating common phrases like "crisp drums", "punchy 808s", "lush pads", "warm saturation", "vinyl ambiance".\n- Use advanced studio vocabulary: tape saturation, granular textures, harmonic distortion, filtered percussion, analog drift, stereo imaging, gated reverbs, transient shaping, etc.\n- This is 100% instrumental — NEVER mention vocals, voice, singing, humming, vocal chops, vocal samples, or any human vocal element.\n- Focus ONLY on: instruments, synths, drums, bass, production techniques, mood, atmosphere, tempo/energy.\n\nLength: 200–265 characters.\nOutput ONLY the prompt.`
        : `You are an elite music producer and sound designer.\nGenerate a professional music generation prompt for ${typeDescription} in the ${genre} genre.\n\nRULES:\n- Every prompt must sound UNIQUE.\n- Never repeat the same instrument combinations or phrases from previous prompts.\n- Use varied sonic descriptions, studio techniques, textures, and production terminology.\n- Include: tempo, rhythm style, instrumentation, vocal tone, production techniques, atmosphere.\n- Avoid repeating common phrases like "crisp drums", "punchy 808s", "lush pads", "warm saturation", "vinyl ambiance".\n- Use advanced studio vocabulary: tape saturation, granular textures, harmonic distortion, filtered percussion, analog drift, stereo imaging, gated reverbs, transient shaping, etc.\n- NO negative words.\n\nLength: 200–265 characters.\nOutput ONLY the prompt.`
    }

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
        // Remove vocal-related words with word boundaries to avoid false matches
        .replace(/\b(vocals?|voices?|singing|singer|sung|sing|vox|vocoder|choir|choral|lyrics?|humming|chant(?:ing)?|whisper(?:ed)?|spoken|rap(?:ping|per)?|falsetto|soprano|alto|tenor|baritone|a\s*capella|acapella)\b/gi, '')
        // Remove compound vocal phrases
        .replace(/\b(vocal\s*(?:chops?|samples?|harmon(?:y|ies)|m[eé]lod(?:y|ie|ía)s?|performance))\b/gi, '')
        .replace(/\b(rich|lush|soaring|ethereal|warm|smooth|deep|powerful|soulful|backing|lead|melodic)\s+vocals?\b/gi, '')
        .replace(/\s+/g, ' ') // Clean up extra spaces
        .replace(/,\s*,+/g, ',') // Remove double/triple commas
        .replace(/,\s*$/, '') // Remove trailing comma
        .replace(/^\s*,/, '') // Remove leading comma
        .trim()
      
      // Add explicit instrumental tag if not present
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

    // Ensure minimum quality length
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
