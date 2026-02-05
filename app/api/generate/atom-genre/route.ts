import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import Replicate from 'replicate'
import { corsResponse, handleOptions } from '@/lib/cors'

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_KEY_LATEST2!,
})

/**
 * Sanitize error messages to hide technical details from users
 */
function sanitizeError(error: any): string {
  // Hide all technical details - users should only see generic message
  return '444 radio is locking in, please try again in few minutes'
}

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

    console.log(`🎸 [ATOM-GENRE] Generating genre for user ${userId}`)
    console.log('🎸 [ATOM-GENRE] User prompt:', prompt)

    // Construct the prompt for GPT-5 Nano to detect genre
    const fullPrompt = `Based on this music prompt: "${prompt}", what is the most appropriate music genre? Choose ONE from: pop, rock, jazz, hip-hop, electronic, classical, country, blues, reggae, metal, folk, lofi. Only respond with the single genre word, nothing else.`

    console.log('🎸 [ATOM-GENRE] Full prompt:', fullPrompt)

    // Use OpenAI GPT-5 Nano for genre detection
    const output = await replicate.run(
      "openai/gpt-5-nano",
      {
        input: {
          prompt: fullPrompt
        }
      }
    )

    console.log('🎸 [ATOM-GENRE] Generation complete')

    // Get the generated genre from output
    let genre = ''

    if (Array.isArray(output)) {
      genre = output.join('')
    } else if (typeof output === 'string') {
      genre = output
    } else {
      throw new Error('Unexpected output format')
    }

    // Clean up the genre - lowercase, remove extra whitespace
    genre = genre.trim().toLowerCase()
      .replace(/["'`]/g, '')
      .replace(/\n/g, '')
      .split(' ')[0] // Take first word only

    // Validate against known genres
    const validGenres = ['pop', 'rock', 'jazz', 'hip-hop', 'electronic', 'classical', 'country', 'blues', 'reggae', 'metal', 'folk', 'lofi']
    if (!validGenres.includes(genre)) {
      console.warn('⚠️ [ATOM-GENRE] Invalid genre detected, falling back to pop:', genre)
      genre = 'pop'
    }

    console.log('✅ [ATOM-GENRE] Genre detected:', genre)

    return corsResponse(NextResponse.json({ 
      success: true, 
      genre,
      message: 'Genre detected successfully with Atom' 
    }))

  } catch (error: any) {
    console.error('🎸 [ATOM-GENRE] Error details:', {
      message: error?.message,
      status: error?.response?.status,
      data: error?.response?.data,
      stack: error?.stack
    })
    
    // Use sanitized error message for users
    const errorMessage = sanitizeError(error)
    
    return corsResponse(NextResponse.json({ 
      success: false,
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error?.message : undefined
    }, { status: 500 }))
  }
}
