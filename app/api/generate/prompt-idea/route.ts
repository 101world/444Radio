import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
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
    const { userId } = await auth()
    if (!userId) {
      return corsResponse(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
    }

    const { genre, promptType } = await request.json()

    if (!genre || !promptType) {
      return corsResponse(NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      ))
    }

    console.log(`🎨 Generating ${promptType} prompt for ${genre}...`)

    const typeDescription = promptType === 'song' 
      ? 'a complete song with vocals, lyrics, and full melodic vocal performance' 
      : 'a pure instrumental beat with absolutely NO vocals, NO voice, NO singing, NO humming - purely instrumental'
    
    const fullPrompt = promptType === 'beat'
      ? `Generate a professional INSTRUMENTAL music production prompt in the ${genre} genre. CRITICAL RULES: This is 100% instrumental — NEVER mention vocals, voice, singing, humming, melody vocals, vocal chops, vocal samples, or any human vocal element. Focus ONLY on: instruments, synths, drums, bass, production techniques, mood, atmosphere, tempo/energy. The prompt should be 200-265 characters. Use vivid, descriptive language about sonic qualities. Example: "Hard-hitting trap beat at 140 BPM with distorted 808 bass, crisp hi-hats, dark synth pads, eerie atmospheric textures, punchy kicks, and aggressive energy." Generate ONLY the music prompt, nothing else:`
      : `Generate a professional music generation prompt for ${typeDescription} in the ${genre} genre. The prompt should be 200-265 characters, include specific instruments, production techniques, mood, atmosphere, tempo/energy, and sound professional. Use vivid, descriptive language about sonic qualities. NO negative words. Example: "Euphoric progressive house at 128 BPM with soaring synth leads, deep sub-bass, crisp percussion, ethereal vocal chops, lush pads, warm analog saturation." Generate ONLY the music prompt, nothing else:`

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

    // For beats/instrumentals: Aggressively remove all vocal-related words and add "no vocals"
    if (promptType === 'beat') {
      cleanPrompt = cleanPrompt
        // Remove vocal-related words (including accented variants like mélodie)
        .replace(/(vocal|vocals|voice|voices|singing|singer|sung|sing|vox|vocoder|choir|choral|lyrics|lyric|humming|hum|chant|chanting|whisper|whispered|spoken|rap|rapping|rapper|melodic\s*vocal|vocal\s*melody|vocal\s*m[eé]lod[iíy]e?|rich\s*vocal|m[eé]lod[iíy]e?\s*vocal|lush\s*vocal|soaring\s*vocal|ethereal\s*vocal|warm\s*vocal|smooth\s*vocal|deep\s*vocal|powerful\s*vocal|soulful\s*vocal|vocal\s*chop|vocal\s*sample|vocal\s*harmony|vocal\s*performance|harmony\s*vocal|backing\s*vocal|lead\s*vocal|falsetto|soprano|alto|tenor|baritone|a\s*capella|acapella)/gi, '')
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

    // Ensure it's within character limit
    if (cleanPrompt.length > 265) {
      cleanPrompt = cleanPrompt.slice(0, 265).trim()
    }

    // Ensure minimum quality length
    if (cleanPrompt.length < 150) {
      cleanPrompt += ` with professional mixing, warm analog character, and spatial depth`
      if (cleanPrompt.length > 265) {
        cleanPrompt = cleanPrompt.slice(0, 265).trim()
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
        error: '444 radio is locking in, please try again in few minutes',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    ))
  }
}
