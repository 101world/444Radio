/**
 * Smart Lyrics Matcher
 * 
 * Analyzes user input and finds the most relevant lyrics from the database
 */

import { LYRICS_DATABASE, LyricsSuggestion } from './lyrics-database'

interface MatchScore {
  lyrics: LyricsSuggestion
  score: number
  matchedKeywords: string[]
}

// Genre keywords mapping
const GENRE_KEYWORDS: Record<string, string[]> = {
  lofi: ['lofi', 'lo-fi', 'chill', 'study', 'relax', 'mellow', 'tape', 'vinyl', 'coffee', 'rain', 'ambient', 'slow', 'quiet', 'soft'],
  hiphop: ['hip hop', 'hiphop', 'rap', 'urban', 'street', 'hustle', 'bars', 'beats', 'rhyme', 'flow', 'city', 'struggle', 'grind'],
  jazz: ['jazz', 'smooth', 'saxophone', 'sax', 'trumpet', 'piano', 'swing', 'blue', 'smoky', 'elegant', 'sophisticated', 'club'],
  chill: ['chill', 'calm', 'peaceful', 'tranquil', 'serene', 'ocean', 'waves', 'breeze', 'floating', 'drift', 'relax', 'meditation'],
  rnb: ['rnb', 'r&b', 'soul', 'love', 'romance', 'sensual', 'smooth', 'groove', 'rhythm', 'passion', 'heartbeat', 'desire']
}

// Mood keywords mapping
const MOOD_KEYWORDS: Record<string, string[]> = {
  melancholic: ['sad', 'melancholy', 'lonely', 'blue', 'sorrow', 'tears', 'faded', 'lost', 'missing', 'nostalgia'],
  empowering: ['strong', 'power', 'rise', 'overcome', 'victory', 'triumph', 'confidence', 'boss', 'winner', 'champion'],
  romantic: ['love', 'romance', 'heart', 'kiss', 'embrace', 'together', 'valentine', 'crush', 'date', 'lovers'],
  peaceful: ['peace', 'calm', 'quiet', 'tranquil', 'serene', 'gentle', 'soft', 'still', 'silence', 'zen'],
  sensual: ['sensual', 'touch', 'skin', 'intimate', 'desire', 'passion', 'fire', 'heat', 'close', 'body'],
  nostalgic: ['nostalgia', 'memory', 'remember', 'past', 'old', 'vintage', 'yesterday', 'used to', 'back then'],
  intense: ['intense', 'fire', 'burn', 'fight', 'battle', 'war', 'fierce', 'aggressive', 'hard', 'raw'],
  smooth: ['smooth', 'silky', 'velvet', 'gentle', 'flowing', 'glide', 'elegant', 'refined', 'polished'],
  serene: ['serene', 'peaceful', 'calm', 'tranquil', 'zen', 'meditation', 'mindful', 'balance', 'harmony'],
  seductive: ['seductive', 'tempting', 'alluring', 'magnetic', 'hypnotic', 'enchanting', 'captivating'],
  dreamy: ['dream', 'dreamy', 'haze', 'foggy', 'clouds', 'fantasy', 'ethereal', 'surreal', 'floating'],
  gritty: ['gritty', 'raw', 'rough', 'real', 'authentic', 'street', 'hard', 'tough', 'concrete', 'dirty'],
  timeless: ['timeless', 'classic', 'eternal', 'forever', 'endless', 'infinite', 'ageless', 'immortal'],
  meditative: ['meditative', 'meditation', 'zen', 'mindful', 'centered', 'breathe', 'spiritual', 'peace'],
  longing: ['longing', 'yearning', 'missing', 'wanting', 'wishing', 'hoping', 'distant', 'far away'],
  wistful: ['wistful', 'longing', 'pensive', 'thoughtful', 'reflective', 'contemplative', 'wondering'],
  fierce: ['fierce', 'wild', 'untamed', 'savage', 'bold', 'fearless', 'daring', 'brave', 'courageous'],
  intimate: ['intimate', 'close', 'personal', 'private', 'secret', 'whisper', 'quiet', 'tender'],
  floating: ['floating', 'drifting', 'soaring', 'flying', 'weightless', 'airborne', 'hovering', 'suspended'],
  enchanted: ['enchanted', 'magical', 'spell', 'charm', 'bewitched', 'mesmerized', 'captivated', 'entranced']
}

/**
 * Analyze text and extract relevant keywords
 */
function extractKeywords(text: string): string[] {
  const normalized = text.toLowerCase()
  const words = normalized.split(/\s+/)
  return words.filter(word => word.length > 3)
}

/**
 * Calculate match score between user input and lyrics
 */
function calculateMatchScore(userInput: string, lyrics: LyricsSuggestion): MatchScore {
  let score = 0
  const matchedKeywords: string[] = []
  const normalizedInput = userInput.toLowerCase()

  // Check genre match (high weight)
  const genreKeywords = GENRE_KEYWORDS[lyrics.genre] || []
  for (const keyword of genreKeywords) {
    if (normalizedInput.includes(keyword)) {
      score += 10
      matchedKeywords.push(keyword)
    }
  }

  // Check mood match (medium weight)
  if (lyrics.mood) {
    const moodKeywords = MOOD_KEYWORDS[lyrics.mood] || []
    for (const keyword of moodKeywords) {
      if (normalizedInput.includes(keyword)) {
        score += 5
        matchedKeywords.push(keyword)
      }
    }
  }

  // Check tag match (medium weight)
  if (lyrics.tags) {
    for (const tag of lyrics.tags) {
      if (normalizedInput.includes(tag)) {
        score += 3
        matchedKeywords.push(tag)
      }
    }
  }

  // Check lyrics content match (low weight)
  const userKeywords = extractKeywords(userInput)
  const lyricsText = lyrics.lyrics.toLowerCase()
  for (const keyword of userKeywords) {
    if (lyricsText.includes(keyword)) {
      score += 1
      matchedKeywords.push(keyword)
    }
  }

  return { lyrics, score, matchedKeywords }
}

/**
 * Find the best matching lyrics for user input
 */
export function findBestMatchingLyrics(userInput: string): LyricsSuggestion {
  if (!userInput || userInput.trim().length === 0) {
    // Return random if no input
    const randomIndex = Math.floor(Math.random() * LYRICS_DATABASE.length)
    return LYRICS_DATABASE[randomIndex]
  }

  // Calculate scores for all lyrics
  const scores = LYRICS_DATABASE.map(lyrics => 
    calculateMatchScore(userInput, lyrics)
  )

  // Sort by score (highest first)
  scores.sort((a, b) => b.score - a.score)

  // If best score is 0, return random
  if (scores[0].score === 0) {
    const randomIndex = Math.floor(Math.random() * LYRICS_DATABASE.length)
    return LYRICS_DATABASE[randomIndex]
  }

  // Return the best match
  return scores[0].lyrics
}

/**
 * Get suggested lyrics based on partial genre/mood input
 */
export function getSuggestedLyrics(input: string): LyricsSuggestion[] {
  const matches = LYRICS_DATABASE.map(lyrics => 
    calculateMatchScore(input, lyrics)
  ).filter(match => match.score > 0)
  
  matches.sort((a, b) => b.score - a.score)
  
  return matches.slice(0, 5).map(m => m.lyrics)
}
