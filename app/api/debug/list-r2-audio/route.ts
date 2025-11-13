import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

/**
 * GET /api/debug/list-r2-audio
 * Shows all database entries across all 3 tables with full details
 * Only accessible to authenticated users
 */
export async function GET() {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('🔍 Fetching all database entries for user:', userId)
    console.log('Expected user ID: user_34J8MP3KCfczODGn9yKMolWPX9R')
    console.log('Match:', userId === 'user_34J8MP3KCfczODGn9yKMolWPX9R')

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

    // Fetch from all 3 tables with FULL data
    const [cmRes, cmlRes, mlRes] = await Promise.all([
      fetch(`${supabaseUrl}/rest/v1/combined_media?user_id=eq.${userId}&select=*&order=created_at.desc`, {
        headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
      }),
      fetch(`${supabaseUrl}/rest/v1/combined_media_library?clerk_user_id=eq.${userId}&select=*&order=created_at.desc`, {
        headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
      }),
      fetch(`${supabaseUrl}/rest/v1/music_library?clerk_user_id=eq.${userId}&select=*&order=created_at.desc`, {
        headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
      })
    ])

    const cmData = await cmRes.json()
    const cmlData = await cmlRes.json()
    const mlData = await mlRes.json()

    console.log('Raw data from tables:')
    console.log('combined_media:', Array.isArray(cmData) ? cmData.length : 'error', cmData.error || '')
    console.log('combined_media_library:', Array.isArray(cmlData) ? cmlData.length : 'error', cmlData.error || '')
    console.log('music_library:', Array.isArray(mlData) ? mlData.length : 'error', mlData.error || '')

    // Transform all data to consistent format
    const cmSongs = Array.isArray(cmData) ? cmData.filter((r: any) => r.audio_url).map((r: any) => ({
      source: 'combined_media',
      id: r.id,
      title: r.title,
      audio_url: r.audio_url,
      image_url: r.image_url,
      prompt: r.audio_prompt || r.music_prompt,
      lyrics: r.lyrics,
      created_at: r.created_at,
      duration: r.duration
    })) : []

    const cmlSongs = Array.isArray(cmlData) ? cmlData.filter((r: any) => r.audio_url).map((r: any) => ({
      source: 'combined_media_library',
      id: r.id,
      title: r.title,
      audio_url: r.audio_url,
      image_url: r.image_url,
      prompt: r.music_prompt,
      lyrics: r.lyrics,
      created_at: r.created_at,
      duration: r.duration
    })) : []

    const mlSongs = Array.isArray(mlData) ? mlData.map((r: any) => ({
      source: 'music_library',
      id: r.id,
      title: r.title,
      audio_url: r.audio_url,
      image_url: null,
      prompt: r.prompt,
      lyrics: r.lyrics,
      created_at: r.created_at,
      duration: r.duration
    })) : []

    // All songs combined
    const allSongs = [...cmSongs, ...cmlSongs, ...mlSongs]

    // Get unique audio URLs
    const uniqueUrls = new Set(allSongs.map(s => s.audio_url))
    
    // Group duplicates
    const urlGroups = new Map<string, typeof cmSongs>()
    allSongs.forEach(song => {
      const existing = urlGroups.get(song.audio_url) || []
      urlGroups.set(song.audio_url, [...existing, song])
    })

    const duplicates = Array.from(urlGroups.entries())
      .filter(([_, songs]) => songs.length > 1)
      .map(([url, songs]) => ({
        audio_url: url,
        count: songs.length,
        tables: songs.map(s => s.source).join(' + '),
        songs
      }))

    return NextResponse.json({
      success: true,
      summary: {
        combined_media: cmSongs.length,
        combined_media_library: cmlSongs.length,
        music_library: mlSongs.length,
        totalRows: allSongs.length,
        uniqueSongs: uniqueUrls.size,
        duplicateCount: duplicates.length,
        expectedTotal: 40,
        missing: 40 - uniqueUrls.size
      },
      byTable: {
        combined_media: cmSongs,
        combined_media_library: cmlSongs,
        music_library: mlSongs
      },
      allSongs,
      duplicates,
      uniqueUrls: Array.from(uniqueUrls)
    })

  } catch (error: any) {
    console.error('Error fetching database:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch database',
        details: error.message 
      },
      { status: 500 }
    )
  }
}
