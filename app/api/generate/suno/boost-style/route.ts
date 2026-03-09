import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import {
  boostStyle,
  sanitizeSunoError,
  SUNO_CREDIT_COSTS,
} from '@/lib/suno-api'

export const maxDuration = 30

/**
 * POST /api/generate/suno/boost-style
 *
 * 444 Pro Boost Style — enhance a style description for better generation results.
 * FREE (0 credits). Returns JSON with the enhanced style text.
 *
 * Body: { content }
 */
export async function POST(req: NextRequest) {
  console.log('🎵 [444-BOOST] POST /api/generate/suno/boost-style')
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { content } = body

    if (!content || typeof content !== 'string' || content.trim().length < 3) {
      return NextResponse.json({ error: 'Style description is required (min 3 characters)' }, { status: 400 })
    }

    const cleanContent = content.trim().slice(0, 2000)

    const result = await boostStyle({ content: cleanContent })

    return NextResponse.json({
      success: true,
      original: cleanContent,
      enhanced: result.data?.result || cleanContent,
      creditsDeducted: SUNO_CREDIT_COSTS.boostStyle,
    })
  } catch (error) {
    console.error('❌ Boost Style error:', error)
    return NextResponse.json({ success: false, error: sanitizeSunoError(error) }, { status: 500 })
  }
}
