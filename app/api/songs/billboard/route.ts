import { NextRequest, NextResponse } from 'next/server'

// GET /api/songs/billboard - Fetch trending PUBLIC songs
export async function GET(req: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    
    const { searchParams } = new URL(req.url)
    const timeframe = searchParams.get('timeframe') || 'all' // today, week, month, all
    const limit = parseInt(searchParams.get('limit') || '100')
    
    // Calculate date filter based on timeframe
    let dateFilter = ''
    const now = new Date()
    
    switch (timeframe) {
      case 'today':
        const today = new Date(now.setHours(0, 0, 0, 0))
        dateFilter = `&created_at=gte.${today.toISOString()}`
        break
      case 'week':
        const weekAgo = new Date(now.setDate(now.getDate() - 7))
        dateFilter = `&created_at=gte.${weekAgo.toISOString()}`
        break
      case 'month':
        const monthAgo = new Date(now.setMonth(now.getMonth() - 1))
        dateFilter = `&created_at=gte.${monthAgo.toISOString()}`
        break
      default:
        dateFilter = ''
    }
    
    // Fetch PUBLIC songs sorted by engagement (plays + likes)
    // For now, just sort by likes desc, then plays desc
    const response = await fetch(
      `${supabaseUrl}/rest/v1/songs?is_public=eq.true&status=eq.complete${dateFilter}&order=likes.desc,plays.desc&limit=${limit}&select=*,users(username,avatar_url)`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        }
      }
    )
    
    if (!response.ok) {
      throw new Error('Failed to fetch billboard')
    }
    
    const songs = await response.json()
    
    // Add rank numbers
    const rankedSongs = songs.map((song: unknown, index: number) => ({
      ...(song as Record<string, unknown>),
      rank: index + 1,
      // Simple trend calculation (placeholder)
      trend: index % 3 === 0 ? 'up' : index % 3 === 1 ? 'down' : 'same'
    }))
    
    return NextResponse.json({ 
      success: true,
      songs: rankedSongs,
      timeframe,
      count: rankedSongs.length
    })

  } catch (error) {
    console.error('Billboard fetch error:', error)
    return NextResponse.json({ 
      success: false,
      error: 'Failed to fetch billboard',
      songs: []
    }, { status: 500 })
  }
}

