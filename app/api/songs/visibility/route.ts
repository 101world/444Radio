import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

export async function PATCH(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { songId, isPublic } = await req.json()

    if (!songId || typeof isPublic !== 'boolean') {
      return NextResponse.json({ error: 'Missing songId or isPublic' }, { status: 400 })
    }

    // Update song visibility (only if user owns the song)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    
    // First verify ownership
    const verifyRes = await fetch(`${supabaseUrl}/rest/v1/songs?id=eq.${songId}&user_id=eq.${userId}&select=id`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      }
    })
    
    const verifyData = await verifyRes.json()
    if (!verifyData || verifyData.length === 0) {
      return NextResponse.json({ error: 'Song not found or unauthorized' }, { status: 404 })
    }

    // Update visibility
    const updateRes = await fetch(`${supabaseUrl}/rest/v1/songs?id=eq.${songId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        is_public: isPublic
      })
    })

    if (!updateRes.ok) {
      throw new Error('Failed to update song visibility')
    }

    console.log(`✅ Song ${songId} visibility updated to: ${isPublic ? 'PUBLIC' : 'PRIVATE'}`)

    // Track quest progress when making a song public — "Social Butterfly" quest
    if (isPublic) {
      const { trackQuestProgress } = await import('@/lib/quest-progress')
      trackQuestProgress(userId, 'share_tracks').catch(() => {})
    }

    return NextResponse.json({ 
      success: true,
      isPublic,
      message: `Song is now ${isPublic ? 'public' : 'private'}`
    })

  } catch (error) {
    console.error('Song visibility update error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to update song visibility'
    return NextResponse.json({ 
      success: false,
      error: errorMessage
    }, { status: 500 })
  }
}

