import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { corsResponse, handleOptions } from '@/lib/cors'

export async function OPTIONS() {
  return handleOptions()
}

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return corsResponse(
        NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      )
    }

    const searchParams = request.nextUrl.searchParams
    const url = searchParams.get('url')
    const filename = searchParams.get('filename') || 'download.mp3'

    if (!url) {
      return corsResponse(
        NextResponse.json({ error: 'URL parameter required' }, { status: 400 })
      )
    }

    // Fetch the file from R2
    const response = await fetch(url)
    if (!response.ok) {
      return corsResponse(
        NextResponse.json({ error: 'Failed to fetch file' }, { status: response.status })
      )
    }

    const blob = await response.blob()
    const buffer = await blob.arrayBuffer()

    // Return the file with proper headers for download
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': blob.type || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': buffer.byteLength.toString(),
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    })
  } catch (error) {
    console.error('Download error:', error)
    return corsResponse(
      NextResponse.json({ error: 'Download failed' }, { status: 500 })
    )
  }
}
