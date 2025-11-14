import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import Replicate from 'replicate'
import { corsResponse, handleOptions } from '@/lib/cors'

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN!,
})

export async function OPTIONS() {
  return handleOptions()
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return corsResponse(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
    }

    const { prompt } = await req.json()

    if (!prompt || !prompt.trim()) {
      return corsResponse(NextResponse.json({ error: 'Missing prompt' }, { status: 400 }))
    }

    console.log(`🔬 [ATOM] Generating lyrics for user ${userId}`)
    console.log('🔬 [ATOM] User prompt:', prompt)

    // Construct the full prompt for GPT-5 Nano
    const fullPrompt = `Generate lyrics based on my prompt - ${prompt} and the lyrics should be structured in [intro] [verse] [chorus] [hook] [bridge] [hook] [chorus] [outro] format under 600 characters`

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
    console.error('🔬 [ATOM] Error:', error)
    
    let errorMessage = 'Failed to generate lyrics with Atom'
    if (error instanceof Error) {
      errorMessage = error.message
    }
    
    return corsResponse(NextResponse.json({ 
      success: false,
      error: errorMessage
    }, { status: 500 }))
  }
}
