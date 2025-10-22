import { NextResponse } from 'next/server'
import { getRandomLyrics, getRandomLyricsByGenre, getRandomLyricsByMood } from '@/lib/lyrics-database'

/**
 * GET /api/lyrics/random
 * 
 * Get random lyrics for inspiration
 * 
 * Query params:
 * - genre: Filter by genre (lofi, hiphop, jazz, chill, rnb)
 * - mood: Filter by mood (melancholic, empowering, romantic, etc.)
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const genre = searchParams.get('genre')
    const mood = searchParams.get('mood')

    let lyrics

    if (genre) {
      lyrics = getRandomLyricsByGenre(genre)
      if (!lyrics) {
        return NextResponse.json(
          { error: `No lyrics found for genre: ${genre}` },
          { status: 404 }
        )
      }
    } else if (mood) {
      lyrics = getRandomLyricsByMood(mood)
      if (!lyrics) {
        return NextResponse.json(
          { error: `No lyrics found for mood: ${mood}` },
          { status: 404 }
        )
      }
    } else {
      lyrics = getRandomLyrics()
    }

    return NextResponse.json({
      success: true,
      lyrics
    })
  } catch (error) {
    console.error('Error getting random lyrics:', error)
    return NextResponse.json(
      { error: 'Failed to get random lyrics' },
      { status: 500 }
    )
  }
}
