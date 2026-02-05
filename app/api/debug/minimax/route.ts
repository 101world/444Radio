import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { corsResponse, handleOptions } from '@/lib/cors'

export async function OPTIONS() {
  return handleOptions()
}

export async function GET() {
  const { userId } = await auth()
  if (!userId) {
    return corsResponse(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  }

  try {
    const token = process.env.REPLICATE_API_KEY_LATEST2
    if (!token) {
      return corsResponse(NextResponse.json({ success: false, error: 'Missing REPLICATE_API_KEY_LATEST2' }, { status: 500 }))
    }

    // Ping Replicate model endpoint for MiniMax Music 1.5
    const resp = await fetch('https://api.replicate.com/v1/models/minimax/music-1.5', {
      headers: {
        Authorization: `Token ${token}`,
        'Content-Type': 'application/json'
      }
    })

    const ok = resp.ok
    let modelInfo: any = null
    try {
      modelInfo = await resp.json()
    } catch {
      modelInfo = null
    }

    return corsResponse(NextResponse.json({
      success: ok,
      reachable: ok,
      status: resp.status,
      model: modelInfo?.name || 'minimax/music-1.5',
      latest_version: modelInfo?.latest_version?.id || null,
      expected_input: {
        lyrics: 'string (required by MiniMax)',
        title: 'string (optional but recommended)',
        genre: 'string (free text)'
      },
      example_request: {
        model: 'minimax/music-1.5',
        input: {
          lyrics: '[verse] ... [chorus] ...',
          title: 'My Song Title',
          genre: 'Pop'
        }
      },
      example_response: {
        output: 'https://replicate.delivery/pb/.../audio.mp3'
      }
    }))
  } catch (error) {
    console.error('MiniMax debug error:', error)
    return corsResponse(NextResponse.json({ success: false, error: 'Failed to reach Replicate MiniMax' }, { status: 500 }))
  }
}
