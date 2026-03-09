import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/webhook/generation-callback
 *
 * Receives callbacks from the music generation engine.
 * We primarily poll for results, but the engine requires a valid callback URL.
 * This endpoint acknowledges the callback silently.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    console.log('🔔 [Generation Callback] Received:', JSON.stringify(body).substring(0, 200))
  } catch {
    // Silently ignore parse errors
  }
  return NextResponse.json({ received: true })
}

export async function GET() {
  return NextResponse.json({ status: 'ok' })
}
