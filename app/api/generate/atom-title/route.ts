import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import Replicate from 'replicate'
import { corsResponse, handleOptions } from '@/lib/cors'

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_KEY_LATEST!,
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

    console.log(`🎵 [ATOM-TITLE] Generating title for user ${userId}`)
    console.log('🎵 [ATOM-TITLE] User prompt:', prompt)

    // Construct the prompt for GPT-5 Nano to generate a natural 2-word song title
    const fullPrompt = `Based on this music prompt: "${prompt}", generate a natural-sounding 2-word song title. Only respond with the 2-word title, nothing else.`

    console.log('🎵 [ATOM-TITLE] Full prompt:', fullPrompt)

    // Use OpenAI GPT-5 Nano for title generation
    const output = await replicate.run(
      "openai/gpt-5-nano",
      {
        input: {
          prompt: fullPrompt
        }
      }
    )

    console.log('🎵 [ATOM-TITLE] Generation complete')

    // Get the generated title from output
    let title = ''

    if (Array.isArray(output)) {
      title = output.join('')
    } else if (typeof output === 'string') {
      title = output
    } else {
      throw new Error('Unexpected output format')
    }

    // Clean up the title - remove quotes, extra whitespace, newlines
    title = title.trim()
      .replace(/["'`]/g, '')
      .replace(/\n/g, ' ')
      .split(' ')
      .slice(0, 2) // Ensure only 2 words
      .join(' ')

    console.log('✅ [ATOM-TITLE] Title generated:', title)

    return corsResponse(NextResponse.json({ 
      success: true, 
      title,
      message: 'Title generated successfully with Atom' 
    }))

  } catch (error: any) {
    console.error('🎵 [ATOM-TITLE] Error details:', {
      message: error?.message,
      status: error?.response?.status,
      data: error?.response?.data,
      stack: error?.stack
    })
    
    let errorMessage = 'Failed to generate title with Atom'
    if (error instanceof Error) {
      errorMessage = error.message
    }
    
    if (error?.response?.data) {
      errorMessage = `Replicate API error: ${JSON.stringify(error.response.data)}`
    }
    
    return corsResponse(NextResponse.json({ 
      success: false,
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error?.message : undefined
    }, { status: 500 }))
  }
}
