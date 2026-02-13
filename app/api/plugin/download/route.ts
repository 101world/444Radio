/**
 * Plugin Download API
 * GET /api/plugin/download?url=<R2_URL>&filename=<name>
 * Auth: Bearer <plugin_token>
 * 
 * Proxies the file from R2 with proper Content-Disposition headers
 * so the JUCE plugin can download audio files for DAW import.
 * Returns the raw audio bytes.
 */

import { NextRequest, NextResponse } from 'next/server'
import { authenticatePlugin } from '@/lib/plugin-auth'
import { corsResponse, handleOptions } from '@/lib/cors'

export const maxDuration = 60

export async function OPTIONS() {
  return handleOptions()
}

export async function GET(req: NextRequest) {
  const authResult = await authenticatePlugin(req)
  if (!authResult.valid) {
    return corsResponse(NextResponse.json({ error: authResult.error }, { status: authResult.status }))
  }

  const { searchParams } = new URL(req.url)
  const url = searchParams.get('url')
  const filename = searchParams.get('filename') || 'download.mp3'

  if (!url) {
    return corsResponse(NextResponse.json({ error: 'Missing url parameter' }, { status: 400 }))
  }

  // Security: only allow downloads from our R2 CDN
  const allowedDomains = [
    'media.444radio.co.in',
    'audio.444radio.co.in',
    'images.444radio.co.in',
    'videos.444radio.co.in',
  ]

  try {
    const parsedUrl = new URL(url)
    if (!allowedDomains.includes(parsedUrl.hostname)) {
      return corsResponse(NextResponse.json({ error: 'URL not from 444 Radio CDN' }, { status: 403 }))
    }
  } catch {
    return corsResponse(NextResponse.json({ error: 'Invalid URL' }, { status: 400 }))
  }

  try {
    const res = await fetch(url)
    if (!res.ok) {
      return corsResponse(NextResponse.json({ error: `Download failed: ${res.status}` }, { status: 502 }))
    }

    const contentType = res.headers.get('content-type') || 'application/octet-stream'
    const body = res.body

    return new Response(body, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'private, max-age=3600',
      },
    })
  } catch (error) {
    console.error('[plugin/download] Error:', error)
    return corsResponse(NextResponse.json({ error: 'Download failed' }, { status: 500 }))
  }
}
