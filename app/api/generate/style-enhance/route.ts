/**
 * POST /api/generate/style-enhance
 *
 * Style DNA — AI-powered style tag enhancer.
 * Takes a rough style description and expands it into optimised,
 * detailed style/genre tags for better AI music generation.
 *
 * FREE — costs 0 credits. Uses Suno's /style/generate endpoint.
 *
 * Body: { content: string }   (the raw style description, e.g. "chill lofi beats")
 * Returns: { success, result, original }
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { corsResponse, handleOptions } from '@/lib/cors'
import { boostStyle, sanitizeSunoError } from '@/lib/suno-api'

export function OPTIONS() {
  return handleOptions()
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return corsResponse(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
    }

    const body = await req.json()
    const { content } = body

    if (!content || typeof content !== 'string' || content.trim().length < 2) {
      return corsResponse(
        NextResponse.json(
          { error: 'Please enter a style description (at least 2 characters)' },
          { status: 400 },
        ),
      )
    }

    if (content.trim().length > 1000) {
      return corsResponse(
        NextResponse.json(
          { error: 'Style description must be 1000 characters or less' },
          { status: 400 },
        ),
      )
    }

    const cleanContent = content.trim()
    console.log(`✨ [Style DNA] User ${userId} — "${cleanContent.slice(0, 80)}"`)

    const response = await boostStyle({ content: cleanContent })

    if (!response?.data?.result) {
      console.error('[Style DNA] Empty result from API:', response)
      return corsResponse(
        NextResponse.json({ error: 'Could not enhance style — please try again' }, { status: 500 }),
      )
    }

    console.log(`✅ [Style DNA] Enhanced: "${response.data.result.slice(0, 120)}"`)

    return corsResponse(
      NextResponse.json({
        success: true,
        result: response.data.result,
        original: cleanContent,
      }),
    )
  } catch (error) {
    console.error('[Style DNA] Error:', error)
    return corsResponse(
      NextResponse.json({ error: sanitizeSunoError(error) }, { status: 500 }),
    )
  }
}
