import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { corsResponse, handleOptions } from '@/lib/cors'

export async function OPTIONS() {
  return handleOptions()
}

// GET /api/media/recent-loops - Fetch user's recent loop generations for recovery
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return corsResponse(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

    // Fetch loops created in the last 10 minutes (generous window for timeout recovery)
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()
    
    const loopsRes = await fetch(
      `${supabaseUrl}/rest/v1/combined_media?user_id=eq.${userId}&type=eq.audio&genre=eq.loop&created_at=gte.${tenMinutesAgo}&order=created_at.desc&limit=10`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        }
      }
    )

    if (!loopsRes.ok) {
      const errorText = await loopsRes.text()
      console.error('Failed to fetch recent loops:', errorText)
      return corsResponse(NextResponse.json({ error: 'Failed to fetch loops' }, { status: 500 }))
    }

    const loops = await loopsRes.json()
    
    return corsResponse(NextResponse.json({ 
      success: true,
      loops: loops,
      count: loops.length
    }))

  } catch (error) {
    console.error('Recent loops fetch error:', error)
    return corsResponse(NextResponse.json(
      { error: 'Failed to fetch recent loops' },
      { status: 500 }
    ))
  }
}
