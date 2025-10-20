import { NextRequest, NextResponse } from 'next/server'

// GET /api/songs/explore - Fetch PUBLIC songs from all users
export async function GET(req: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    
    const { searchParams } = new URL(req.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    
    // Fetch only PUBLIC songs that are COMPLETE
    const response = await fetch(
      `${supabaseUrl}/rest/v1/songs?is_public=eq.true&status=eq.complete&order=created_at.desc&limit=${limit}&offset=${offset}&select=*,users(username,avatar_url)`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        }
      }
    )
    
    if (!response.ok) {
      throw new Error('Failed to fetch songs')
    }
    
    const songs = await response.json()
    
    return NextResponse.json({ 
      success: true,
      songs,
      count: songs.length
    })

  } catch (error) {
    console.error('Explore fetch error:', error)
    return NextResponse.json({ 
      success: false,
      error: 'Failed to fetch songs',
      songs: []
    }, { status: 500 })
  }
}

