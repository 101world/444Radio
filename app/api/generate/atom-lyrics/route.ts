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

    console.log(`🔬 [ATOM] Generating lyrics for user ${userId}${lang ? ` (language: ${lang})` : ''}`)
    console.log('🔬 [ATOM] User prompt:', prompt)

    // Construct the full prompt for GPT-5 Nano
    const languageInstruction = lang
      ? `The lyrics MUST be in ${lang} language but written using ROMANIZED ENGLISH LETTERS (transliteration). Do NOT use native ${lang} script — write every word phonetically in English alphabet. For example, Hindi "मैं तुमसे प्यार करता हूँ" should be written as "Main tumse pyaar karta hoon". Japanese "さくらが咲く" should be "Sakura ga saku". Apply this romanization rule to ALL ${lang} words.`
      : ''
    const fullPrompt = `Generate lyrics based on my prompt - ${prompt}. ${languageInstruction} The lyrics should be structured in [intro] [verse] [chorus] [hook] [bridge] [hook] [chorus] [outro] format under 600 characters`

    console.log('🔬 [ATOM] Full prompt:', fullPrompt)

    // Use OpenAI GPT-5 Nano for lyrics generation
    // https://replicate.com/openai/gpt-5-nano
    const output = await replicate.run(
      "openai/gpt-5-nano",
      {
        input: {
          prompt: fullPrompt
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

    // SAFETY: If non-English language was requested, strip any native script the LLM may have produced
    // Keep only Latin letters, digits, punctuation, whitespace, and structural tags like [Verse]
    if (lang) {
      lyrics = lyrics.replace(/[\u0900-\u097F\u0980-\u09FF\u0A00-\u0A7F\u0A80-\u0AFF\u0B00-\u0B7F\u0B80-\u0BFF\u0C00-\u0C7F\u0C80-\u0CFF\u0D00-\u0D7F\u0600-\u06FF\u0750-\u077F\u4E00-\u9FFF\u3040-\u309F\u30A0-\u30FF\uAC00-\uD7AF\u0E00-\u0E7F\u0E80-\u0EFF\u1000-\u109F\u1780-\u17FF]/g, '').replace(/\n{3,}/g, '\n\n').trim()
    }

    // Trim to 600 characters max
    if (lyrics.length > 600) {
      lyrics = lyrics.substring(0, 600).trim()
      // Try to end at a complete line
      const lastNewline = lyrics.lastIndexOf('\n')
      if (lastNewline > 500) {
        lyrics = lyrics.substring(0, lastNewline)
      }
    }

    console.log('✅ [ATOM] Lyrics generated:', lyrics.substring(0, 100) + '...')

    return corsResponse(NextResponse.json({ 
      success: true, 
      lyrics,
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
