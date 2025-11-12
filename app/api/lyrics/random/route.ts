import { NextResponse } from 'next/server'
import { getRandomLyrics, getRandomLyricsByGenre, getRandomLyricsByMood } from '@/lib/lyrics-database'
import { findBestMatchingLyrics } from '@/lib/lyrics-matcher'
import { corsResponse, handleOptions } from '@/lib/cors'

/**
 * GET /api/lyrics/random
 * 
 * Get random lyrics for inspiration
 * 
 * Query params:
 * - description: User's prompt/description to match against (smart matching)
 * - genre: Filter by genre (lofi, hiphop, jazz, chill, rnb)
 * - mood: Filter by mood (melancholic, empowering, romantic, etc.)
 */

export async function OPTIONS() {
  return handleOptions()
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const description = searchParams.get('description')
    const genre = searchParams.get('genre')
    const mood = searchParams.get('mood')

    let lyrics

    // Priority 1: Smart matching based on description
    if (description && description.trim().length > 0) {
      lyrics = findBestMatchingLyrics(description)
    }
    // Priority 2: Filter by genre
    else if (genre) {
      lyrics = getRandomLyricsByGenre(genre)
      if (!lyrics) {
        return corsResponse(NextResponse.json(
          { error: `No lyrics found for genre: ${genre}` },
          { status: 404 }
        ))
      }
    } 
    // Priority 3: Filter by mood
    else if (mood) {
      lyrics = getRandomLyricsByMood(mood)
      if (!lyrics) {
        return corsResponse(NextResponse.json(
          { error: `No lyrics found for mood: ${mood}` },
          { status: 404 }
        ))
      }
    } 
    // Priority 4: Pure random
    else {
      lyrics = getRandomLyrics()
    }

    return corsResponse(NextResponse.json({
      success: true,
      lyrics
    }))
  } catch (error) {
    console.error('Error getting random lyrics:', error)
    return corsResponse(NextResponse.json(
      { error: 'Failed to get random lyrics' },
      { status: 500 }
    ))
  }
}
