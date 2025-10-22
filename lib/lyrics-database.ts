/**
 * Lyrics Database for Random Generation
 * 
 * This file contains a curated collection of lyrics that can be used
 * for randomized suggestions in the music creation interface.
 */

export interface LyricsSuggestion {
  title: string
  genre: 'lofi' | 'hiphop' | 'jazz' | 'chill' | 'rnb'
  lyrics: string
  mood?: string
  tags?: string[]
}

export const LYRICS_DATABASE: LyricsSuggestion[] = [
  {
    title: "City Moons",
    genre: "lofi",
    lyrics: "Soft beats whisper through midnight air, faded dreams tangled in electric glare. Coffee cools, the street hums slow, I drift between echoes only night can know.",
    mood: "melancholic",
    tags: ["night", "urban", "coffee", "dreams"]
  },
  {
    title: "Paper Crown",
    genre: "hiphop",
    lyrics: "Born from dust with a voice too loud, I built my throne in a paper crowd. Hustle divine, struggle refined, broke my chains and redrew the line.",
    mood: "empowering",
    tags: ["hustle", "struggle", "success", "determination"]
  },
  {
    title: "Amber Wine",
    genre: "jazz",
    lyrics: "Golden sax sighs in a smoky hall, hearts collide where shadows fall. Notes drift soft, lost in time, lovers sway to the amber chime.",
    mood: "romantic",
    tags: ["love", "jazz club", "saxophone", "vintage"]
  },
  {
    title: "Moonline Drive",
    genre: "chill",
    lyrics: "Car lights fade, the skyline sleeps, silence hums where the ocean weeps. Miles unwind beneath soft rain, peace returns in silver chain.",
    mood: "peaceful",
    tags: ["driving", "ocean", "rain", "solitude"]
  },
  {
    title: "Velvet Night",
    genre: "rnb",
    lyrics: "Your touch glows warm in the rhythm slow, heartbeats echo where lovers go. Sweet confusion in your eyes, love's a storm beneath calm skies.",
    mood: "sensual",
    tags: ["love", "romance", "passion", "intimacy"]
  },
  {
    title: "Echo Park Dreams",
    genre: "lofi",
    lyrics: "Tape hiss hums beneath my soul, raindrops loop, stories unfold. Through fogged glass and fading lights, I breathe in quiet city nights.",
    mood: "nostalgic",
    tags: ["rain", "city", "memories", "vintage"]
  },
  {
    title: "Iron Petals",
    genre: "hiphop",
    lyrics: "Street lights blink on cracked concrete, words hit hard but the rhythm sweet. Every bar's a war I won, bleeding ink till the night is done.",
    mood: "intense",
    tags: ["street", "battle", "poetry", "perseverance"]
  },
  {
    title: "Soft Sapphire",
    genre: "jazz",
    lyrics: "Piano drips in twilight tone, trumpet hums like a lover alone. Smoke curls high, hearts rewind, lost in the glow that jazz defined.",
    mood: "smooth",
    tags: ["piano", "trumpet", "twilight", "sophistication"]
  },
  {
    title: "Seafoam Sky",
    genre: "chill",
    lyrics: "Gentle waves kiss the sand below, hearts drift where soft winds blow. Time dissolves in teal and gray, peace hums low in the end of day.",
    mood: "serene",
    tags: ["ocean", "beach", "sunset", "tranquility"]
  },
  {
    title: "Crimson Sway",
    genre: "rnb",
    lyrics: "Your shadow slides across the floor, I chase your rhythm wanting more. Eyes like wine, lips divine, our pulse aligns in a velvet line.",
    mood: "seductive",
    tags: ["dance", "desire", "night", "chemistry"]
  },
  {
    title: "Glass Radio",
    genre: "lofi",
    lyrics: "Old tunes hum from the window's edge, static dreams on the vinyl's pledge. Faded mornings, coffee haze, drifting slow through quiet days.",
    mood: "dreamy",
    tags: ["vinyl", "morning", "nostalgia", "coffee"]
  },
  {
    title: "Northside Code",
    genre: "hiphop",
    lyrics: "Every corner taught me pain, concrete rain, I built my name. Hustle steady, scars to fame, truth in bars, never the same.",
    mood: "gritty",
    tags: ["street", "resilience", "authenticity", "journey"]
  },
  {
    title: "Cobalt Sun",
    genre: "jazz",
    lyrics: "Saxophone spins a gentle flame, lovers dance without a name. Smoke curls blue through amber haze, jazz rewrites the clock of days.",
    mood: "timeless",
    tags: ["saxophone", "dance", "romance", "evening"]
  },
  {
    title: "Frozen Wave",
    genre: "chill",
    lyrics: "Still water sings beneath the moon, slow tides hum an ancient tune. Every breath dissolves to light, peace becomes my endless night.",
    mood: "meditative",
    tags: ["moon", "water", "meditation", "calm"]
  },
  {
    title: "Neon Verse",
    genre: "rnb",
    lyrics: "Your voice hums through static lines, tracing warmth in frozen signs. I melt again where you begin, lost in light beneath my skin.",
    mood: "longing",
    tags: ["electronic", "connection", "emotion", "modern"]
  },
  {
    title: "Cloud Balcony",
    genre: "lofi",
    lyrics: "Rain taps slow against the frame, soft beats whisper your name. Steam curls up in quiet grace, I find your ghost in this place.",
    mood: "wistful",
    tags: ["rain", "memories", "solitude", "reflection"]
  },
  {
    title: "Steel Halo",
    genre: "hiphop",
    lyrics: "Dreams in motion, I break the mold, stories written in scars and gold. Crown myself in midnight fire, chasing pain through raw desire.",
    mood: "fierce",
    tags: ["ambition", "transformation", "power", "rebirth"]
  },
  {
    title: "Golden Steam",
    genre: "jazz",
    lyrics: "Trumpet sighs in gentle blue, candle flame reflects on you. Every note a soft embrace, time dissolves in smoky grace.",
    mood: "intimate",
    tags: ["trumpet", "candlelight", "romance", "atmosphere"]
  },
  {
    title: "Wanderlight",
    genre: "chill",
    lyrics: "Lanterns float across the breeze, I lose my weight with gentle ease. Nights unfold in faded hue, peace hums low, the sky feels new.",
    mood: "floating",
    tags: ["lanterns", "night", "freedom", "wandering"]
  },
  {
    title: "Honey Mirage",
    genre: "rnb",
    lyrics: "Your laugh drips sweet through heavy air, golden skin and tangled hair. Every glance a spell undone, you're my moon and my rising sun.",
    mood: "enchanted",
    tags: ["beauty", "magic", "adoration", "sunlight"]
  }
]

/**
 * Get a random lyric suggestion
 */
export function getRandomLyrics(): LyricsSuggestion {
  const randomIndex = Math.floor(Math.random() * LYRICS_DATABASE.length)
  return LYRICS_DATABASE[randomIndex]
}

/**
 * Get a random lyric by genre
 */
export function getRandomLyricsByGenre(genre: string): LyricsSuggestion | null {
  const filtered = LYRICS_DATABASE.filter(l => l.genre === genre.toLowerCase())
  if (filtered.length === 0) return null
  const randomIndex = Math.floor(Math.random() * filtered.length)
  return filtered[randomIndex]
}

/**
 * Get a random lyric by mood
 */
export function getRandomLyricsByMood(mood: string): LyricsSuggestion | null {
  const filtered = LYRICS_DATABASE.filter(l => l.mood === mood.toLowerCase())
  if (filtered.length === 0) return null
  const randomIndex = Math.floor(Math.random() * filtered.length)
  return filtered[randomIndex]
}

/**
 * Get all available genres
 */
export function getAvailableGenres(): string[] {
  return [...new Set(LYRICS_DATABASE.map(l => l.genre))]
}

/**
 * Get all available moods
 */
export function getAvailableMoods(): string[] {
  return [...new Set(LYRICS_DATABASE.map(l => l.mood).filter(Boolean))] as string[]
}
