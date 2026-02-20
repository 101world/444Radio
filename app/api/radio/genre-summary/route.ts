import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { corsResponse, handleOptions } from '@/lib/cors'

export async function OPTIONS() {
  return handleOptions()
}

export async function GET() {
  try {
    // Get all unique genres from combined_media
    const { data: mediaData, error: mediaError } = await supabase
      .from('combined_media')
      .select('genre')
      .not('genre', 'is', null)

    if (mediaError) {
      console.error('Error fetching genres:', mediaError)
      return corsResponse(NextResponse.json({ error: 'Failed to fetch genres' }, { status: 500 }))
    }

    // Extract unique genres
    const genreSet = new Set<string>()
    mediaData?.forEach(item => {
      if (item.genre) genreSet.add(item.genre)
    })

    // Add default genres if none found
    if (genreSet.size === 0) {
      ['lofi', 'hiphop', 'jazz', 'chill', 'rnb', 'techno'].forEach(genre => genreSet.add(genre))
    }

    const genres = Array.from(genreSet).sort()

    // Get count of media per genre
    const genreCounts: { [key: string]: number } = {}
    genres.forEach(genre => {
      genreCounts[genre] = mediaData?.filter(item => item.genre === genre).length || 0
    })

    return corsResponse(NextResponse.json({
      success: true,
      genres,
      genreCounts,
      totalGenres: genres.length
    }))

  } catch (error) {
    console.error('Error in genre summary:', error)
    return corsResponse(NextResponse.json({ error: 'Internal server error' }, { status: 500 }))
  }
}