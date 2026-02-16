import { NextRequest, NextResponse } from 'next/server'
import { getAuthUserId } from '@/lib/hybrid-auth'
import Replicate from 'replicate'
import { corsResponse, handleOptions } from '@/lib/cors'
import { SAFE_ERROR_MESSAGE } from '@/lib/sanitize-error'
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
    const userId = await getAuthUserId(req)
    if (!userId) {
      return corsResponse(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
    }

    const { prompt } = await req.json()

    if (!prompt || !prompt.trim()) {
      return corsResponse(NextResponse.json({ error: 'Missing prompt' }, { status: 400 }))
    }

    console.log(`🎵 [ATOM-TITLE] Generating title for user ${userId}`)
    console.log('🎵 [ATOM-TITLE] User prompt:', prompt)

    // Construct a more diverse prompt for title generation
    const titlePrompts = [
      `Create a unique 2-word song title inspired by: "${prompt}". Be creative and original.`,
      `Generate a fresh 2-word music title based on: "${prompt}". Avoid common words.`,
      `Make a creative 2-word song name from this concept: "${prompt}". Be innovative.`,
      `Invent a catchy 2-word track title for: "${prompt}". Use unexpected word combinations.`,
      `Craft an original 2-word song title that captures: "${prompt}". Be unique.`
    ]
    
    // Select random prompt variation to increase diversity
    const randomPrompt = titlePrompts[Math.floor(Math.random() * titlePrompts.length)]

    console.log('🎵 [ATOM-TITLE] Using diverse prompt:', randomPrompt)

    // Use OpenAI GPT-5 Nano for title generation with diverse prompting
    const output = await replicate.run(
      "openai/gpt-5-nano",
      {
        input: {
          prompt: randomPrompt,
          temperature: 0.9, // Higher temperature for more creativity
          max_tokens: 10
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

    // Check for overused words and regenerate if needed
    const overusedWords = ['midnight', 'shadow', 'echo', 'dream', 'night']
    const titleWords = title.toLowerCase().split(' ')
    const hasOverusedWord = overusedWords.some(word => titleWords.includes(word))
    
    if (hasOverusedWord) {
      console.log('⚡ [ATOM-TITLE] Detected overused word, generating alternative...')
      
      // Use fallback creative word combinations
      const adjectives = ['Velvet', 'Crimson', 'Azure', 'Golden', 'Silver', 'Electric', 'Cosmic', 'Mystic', 'Urban', 'Wild']
      const nouns = ['Pulse', 'Flow', 'Vibe', 'Rush', 'Spark', 'Wave', 'Beat', 'Soul', 'Fire', 'Storm']
      
      const randomAdjective = adjectives[Math.floor(Math.random() * adjectives.length)]
      const randomNoun = nouns[Math.floor(Math.random() * nouns.length)]
      
      title = `${randomAdjective} ${randomNoun}`
      console.log('✨ [ATOM-TITLE] Generated fresh alternative:', title)
    }

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
    
    return corsResponse(NextResponse.json({ 
      success: false,
      error: SAFE_ERROR_MESSAGE
    }, { status: 500 }))
  }
}
