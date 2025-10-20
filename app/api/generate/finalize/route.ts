import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { songId, audioUrl, coverUrl } = await req.json()

    if (!songId || !audioUrl || !coverUrl) {
      return NextResponse.json({ error: 'Missing required data' }, { status: 400 })
    }

    // Update song status to complete
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    
    const updateRes = await fetch(`${supabaseUrl}/rest/v1/songs?id=eq.${songId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        status: 'complete',
        audio_url: audioUrl,
        cover_url: coverUrl
      })
    })

    if (!updateRes.ok) {
      throw new Error('Failed to finalize song')
    }

    console.log('✅ Song finalized:', songId)

    return NextResponse.json({ 
      success: true,
      finalUrl: coverUrl, // For now, just return the cover URL
      message: 'Song finalized successfully'
    })

  } catch (error) {
    console.error('Finalization error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to finalize song'
    return NextResponse.json({ 
      success: false,
      error: errorMessage
    }, { status: 500 })
  }
}

