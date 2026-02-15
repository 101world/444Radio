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
  let url: string | null = null;
  try {
    const { searchParams } = new URL(request.url)
    url = searchParams.get('url')
    if (!url) return NextResponse.json({ error: 'Missing url' }, { status: 400 })

    // Basic validation - allow R2 domains and env configured hosts
    const parsed = new URL(url)
    
    // Allow any R2.dev domain or configured R2 URLs
    const isR2Domain = parsed.hostname.endsWith('.r2.dev') || parsed.hostname.endsWith('.r2.cloudflarestorage.com')
    
    // Allow Replicate delivery URLs (for AI-generated content)
    const isReplicate = parsed.hostname.includes('replicate.delivery') || parsed.hostname.includes('replicate.com')
    
    // Allow the media CDN domain directly (covers all R2 content)
    const isMediaDomain = parsed.hostname === 'media.444radio.co.in'
    
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

    if (!isR2Domain && !isConfiguredHost && !isReplicate && !isMediaDomain) {
      console.error('Proxy blocked - not allowed:', parsed.hostname)
      return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
    }

    console.log('🔄 Proxying URL:', url);

    // Fetch the resource server-side and stream it back
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout for large audio files
    
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      signal: controller.signal
    }).finally(() => clearTimeout(timeoutId))
    
    console.log('📡 Upstream response:', resp.status, resp.statusText);
    
    if (!resp.ok) {
      console.error('❌ Upstream fetch failed:', resp.status, resp.statusText);
      const errorText = await resp.text().catch(() => 'Unknown error');
      console.error('Error body:', errorText);
      
      // Return the actual status code from upstream (e.g., 404 for expired URLs)
      return NextResponse.json({ 
        error: resp.status === 404 ? 'File not found or expired' : 'Failed to fetch file', 
        status: resp.status, 
        statusText: resp.statusText,
        url: url 
      }, { status: resp.status })
    }

    // Clone headers required for correct content-type behavior
    const headers: any = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Range',
      'Cache-Control': 'public, max-age=31536000'
    }

    // If a filename is requested (for DAW drag-and-drop), set Content-Disposition
    const filename = searchParams.get('filename')
    if (filename) {
      headers['Content-Disposition'] = `attachment; filename="${filename}"`
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

    console.log('✅ Proxy successful for:', url);
    
    return new NextResponse(body, { headers })
  } catch (error) {
    console.error('❌ R2 proxy error:', error)
    console.error('Failed URL:', url)
    return NextResponse.json({ 
      error: 'Internal server error', 
      message: error instanceof Error ? error.message : 'Unknown error',
      url: url 
    }, { status: 500 })
  }
}
