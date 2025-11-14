import { NextRequest, NextResponse } from 'next/server'

export async function OPTIONS() {
  return new NextResponse(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Range'
    }
  })
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const url = searchParams.get('url')
    if (!url) return NextResponse.json({ error: 'Missing url' }, { status: 400 })

    // Basic validation - allow R2 domains and env configured hosts
    const parsed = new URL(url)
    
    // Allow any R2.dev domain or configured R2 URLs
    const isR2Domain = parsed.hostname.endsWith('.r2.dev') || parsed.hostname.endsWith('.r2.cloudflarestorage.com')
    
    const allowedHosts = [
      process.env.NEXT_PUBLIC_R2_AUDIO_URL,
      process.env.NEXT_PUBLIC_R2_IMAGES_URL,
      process.env.NEXT_PUBLIC_R2_VIDEOS_URL
    ].filter(Boolean) as string[]
    
    const isConfiguredHost = allowedHosts.some(h => {
      try {
        const hostUrl = new URL(h)
        return parsed.hostname === hostUrl.hostname
      } catch {
        return false
      }
    })

    if (!isR2Domain && !isConfiguredHost) {
      console.error('Proxy blocked - not allowed:', parsed.hostname)
      return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
    }

    // Fetch the resource server-side and stream it back
    const resp = await fetch(url)
    if (!resp.ok) {
      return NextResponse.json({ error: 'Failed to fetch file', status: resp.status }, { status: 500 })
    }

    // Clone headers required for correct content-type behavior
    const headers: any = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Range',
      'Cache-Control': 'public, max-age=31536000'
    }
    const contentType = resp.headers.get('content-type')
    const contentLength = resp.headers.get('content-length')
    const acceptRanges = resp.headers.get('accept-ranges')
    const contentRange = resp.headers.get('content-range')
    
    if (contentType) headers['Content-Type'] = contentType
    if (contentLength) headers['Content-Length'] = contentLength
    if (acceptRanges) headers['Accept-Ranges'] = acceptRanges
    if (contentRange) headers['Content-Range'] = contentRange

    // Return streamed response so audio/video can play
    const body = resp.body

    return new NextResponse(body, { headers })
  } catch (error) {
    console.error('R2 proxy error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
