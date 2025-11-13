import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const url = searchParams.get('url')
    if (!url) return NextResponse.json({ error: 'Missing url' }, { status: 400 })

    // Basic validation - only allow env configured R2 hosts
    const allowedHosts = [
      process.env.NEXT_PUBLIC_R2_AUDIO_URL,
      process.env.NEXT_PUBLIC_R2_IMAGES_URL,
      process.env.NEXT_PUBLIC_R2_VIDEOS_URL
    ].filter(Boolean) as string[]

    const parsed = new URL(url)
    const hostAllowed = allowedHosts.some(h => parsed.host.includes(new URL(h).host))

    if (!hostAllowed) {
      return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
    }

    // Fetch the resource server-side and stream it back
    const resp = await fetch(url)
    if (!resp.ok) {
      return NextResponse.json({ error: 'Failed to fetch file', status: resp.status }, { status: 500 })
    }

    // Clone headers required for correct content-type behavior
    const headers: any = {}
    const contentType = resp.headers.get('content-type')
    const contentLength = resp.headers.get('content-length')
    if (contentType) headers['Content-Type'] = contentType
    if (contentLength) headers['Content-Length'] = contentLength

    // Return streamed response so audio/video can play
    const body = resp.body

    return new NextResponse(body, { headers })
  } catch (error) {
    console.error('R2 proxy error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
