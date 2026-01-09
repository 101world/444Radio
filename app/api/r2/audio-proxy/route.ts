import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the audio URL from query params
    const { searchParams } = new URL(request.url);
    const audioUrl = searchParams.get('url');

    if (!audioUrl) {
      return NextResponse.json({ error: 'URL parameter required' }, { status: 400 });
    }

    // Fetch the audio from R2
    const response = await fetch(audioUrl, {
      headers: {
        'Accept': 'audio/*',
      },
    });

    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to fetch audio' }, { status: response.status });
    }

    // Get the audio data
    const audioData = await response.arrayBuffer();

    // Return with proper CORS headers
    return new NextResponse(audioData, {
      status: 200,
      headers: {
        'Content-Type': response.headers.get('Content-Type') || 'audio/mpeg',
        'Content-Length': audioData.byteLength.toString(),
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Cache-Control': 'public, max-age=31536000', // Cache for 1 year
      },
    });
  } catch (error) {
    console.error('Audio proxy error:', error);
    return NextResponse.json({ error: 'Proxy error' }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
