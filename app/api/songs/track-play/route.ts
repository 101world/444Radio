import { NextResponse } from 'next/server'
import { corsResponse, handleOptions } from '@/lib/cors'

// DEPRECATED: Use /api/media/track-play instead
// This route redirects to the consolidated media API

export async function OPTIONS() {
  return handleOptions()
}

export async function POST(req: Request) {
  console.warn('⚠️ [DEPRECATED] /api/songs/track-play called, redirecting to /api/media/track-play')
  
  const body = await req.json()
  const url = new URL(req.url)
  const newUrl = url.toString().replace('/api/songs/track-play', '/api/media/track-play')
  
  // Forward to the new endpoint
  const response = await fetch(newUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body)
  })
  
  const data = await response.json()
  return corsResponse(NextResponse.json(data, { status: response.status }))
}
