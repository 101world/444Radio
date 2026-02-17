/**
 * Plugin Credits API
 * GET /api/plugin/credits - Check user's credits via plugin token
 */

import { NextRequest, NextResponse } from 'next/server'
import { authenticatePlugin, getPluginUserCredits } from '@/lib/plugin-auth'
import { corsResponse, handleOptions } from '@/lib/cors'

export async function OPTIONS() {
  return handleOptions()
}

export async function GET(req: NextRequest) {
  const authResult = await authenticatePlugin(req)
  if (!authResult.valid) {
    return corsResponse(NextResponse.json({ error: authResult.error }, { status: authResult.status }))
  }

  try {
    const { credits, totalGenerated } = await getPluginUserCredits(authResult.userId)

    return corsResponse(NextResponse.json({
      credits,
      totalGenerated,
      costs: {
        music: 2,
        image: 1,
        effects: 2,
        loops_short: 6,
        loops_long: 7,
        stems: 1,
        stems_pro: 3,
        audio_boost: 1,
        cover_art: 1,
        extract: 1,
        video_to_audio: 2,
      }
    }))
  } catch (error) {
    console.error('[plugin/credits] Error:', error)
    return corsResponse(NextResponse.json({ error: 'Failed to fetch credits' }, { status: 500 }))
  }
}
