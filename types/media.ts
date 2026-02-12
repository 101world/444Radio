// Centralized types for combined_media / track metadata
// Matches the database schema after migration 1012

export interface TrackMetadata {
  // Core identifiers
  id: string
  user_id: string
  
  // Media URLs
  audio_url: string | null
  image_url: string | null
  media_url?: string | null
  
  // Basic info
  title: string | null
  type: string // audio, image, video, effects
  
  // Prompts (AI-generated content)
  prompt?: string | null
  audio_prompt?: string | null
  image_prompt?: string | null
  
  // Release metadata
  release_type: 'single' | 'ep' | 'album'
  artist_name?: string | null
  featured_artists?: string[]
  release_date?: string | null
  
  // Genre & mood
  genre?: string | null
  secondary_genre?: string | null
  mood?: string | null
  mood_tags?: string[]
  
  // Musical properties
  bpm?: number | null
  key_signature?: string | null
  vocals?: string | null // instrumental, with-lyrics, none
  language?: string | null
  duration_seconds?: number | null
  
  // Content flags
  is_explicit: boolean
  is_cover: boolean
  is_public: boolean
  is_published: boolean
  
  // Distribution identifiers
  isrc?: string | null
  upc?: string | null
  iswc?: string | null
  
  // Credits
  songwriters?: Contributor[]
  contributors?: Contributor[]
  publisher?: string | null
  publishing_splits?: Record<string, number> | null
  
  // Rights
  copyright_holder?: string | null
  copyright_year?: number | null
  record_label?: string | null
  catalogue_number?: string | null
  pro_affiliation?: string | null
  
  // Technical
  audio_format?: string | null
  sample_rate?: number | null
  bit_depth?: number | null
  
  // Discoverability
  tags?: string[]
  keywords?: string[]
  instruments?: string[]
  description?: string | null
  version_tag?: string | null
  territories?: string[]
  lyrics?: string | null
  
  // Stats
  likes: number
  likes_count?: number
  plays: number
  downloads?: number
  
  // Timestamps
  created_at: string
  updated_at?: string
  
  // Earn marketplace
  listed_on_earn?: boolean
  earn_price?: number
  artist_share?: number
  admin_share?: number
  
  // Studio
  metadata?: Record<string, unknown> | null
  effects?: Record<string, unknown> | null
  beat_metadata?: Record<string, unknown> | null
  stems?: Record<string, unknown> | null
  is_multi_track?: boolean
}

export interface Contributor {
  name: string
  role: string // songwriter, composer, producer, engineer, remixer, vocalist, etc.
}

// For the explore page / audio player
export interface CombinedMedia {
  id: string
  title: string
  audio_url: string
  audioUrl?: string
  image_url: string
  imageUrl?: string
  audio_prompt?: string
  image_prompt?: string
  user_id: string
  username?: string
  artist_name?: string
  likes: number
  plays: number
  created_at: string
  users?: { username: string }
  genre?: string
  secondary_genre?: string
  mood?: string
  mood_tags?: string[]
  bpm?: number
  vocals?: string
  language?: string
  tags?: string[]
  keywords?: string[]
  description?: string
  is_explicit?: boolean
  version_tag?: string
  key_signature?: string
  instruments?: string[]
  featured_artists?: string[]
  duration_seconds?: number
  release_type?: string
  record_label?: string
  isrc?: string
  lyrics?: string
}

// For the audio player context
export interface Track {
  id: string
  audioUrl: string
  title: string
  artist?: string
  imageUrl?: string
  userId?: string
}

// Search result type
export interface SearchResult extends CombinedMedia {
  rank?: number
  highlight?: string
}

// Metadata form data (for the release form)
export interface ReleaseFormData {
  title: string
  artist_name: string
  featured_artists: string[]
  release_type: 'single' | 'ep' | 'album'
  genre: string
  secondary_genre: string
  mood: string
  mood_tags: string[]
  bpm: number | null
  key_signature: string
  vocals: string
  language: string
  is_explicit: boolean
  is_cover: boolean
  description: string
  tags: string[]
  keywords: string[]
  instruments: string[]
  version_tag: string
  lyrics: string
  // Credits
  songwriters: Contributor[]
  contributors: Contributor[]
  publisher: string
  copyright_holder: string
  copyright_year: number | null
  record_label: string
  catalogue_number: string
  pro_affiliation: string
  // Distribution
  isrc: string
  upc: string
  territories: string[]
  release_date: string
}

// Common genre options
export const GENRE_OPTIONS = [
  'lofi', 'hiphop', 'jazz', 'chill', 'rnb', 'techno', 'electronic',
  'pop', 'rock', 'indie', 'classical', 'ambient', 'trap', 'drill',
  'house', 'dubstep', 'reggae', 'soul', 'funk', 'blues', 'country',
  'metal', 'punk', 'experimental', 'afrobeats', 'latin', 'kpop',
  'world', 'cinematic', 'lo-fi hip hop', 'vaporwave', 'synthwave',
  'drum and bass', 'boom bap', 'phonk', 'effects', 'loop'
]

// Common mood options
export const MOOD_OPTIONS = [
  'chill', 'energetic', 'dark', 'uplifting', 'melancholic', 'aggressive',
  'romantic', 'dreamy', 'epic', 'peaceful', 'mysterious', 'happy',
  'sad', 'angry', 'confident', 'nostalgic', 'ethereal', 'playful',
  'intense', 'smooth', 'gritty', 'atmospheric', 'motivational'
]

// Key signatures
export const KEY_OPTIONS = [
  'C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B',
  'Cm', 'C#m', 'Dm', 'D#m', 'Ebm', 'Em', 'Fm', 'F#m', 'Gm', 'G#m', 'Am', 'A#m', 'Bbm', 'Bm'
]

// Common instruments
export const INSTRUMENT_OPTIONS = [
  'piano', 'guitar', 'bass', 'drums', 'synth', 'violin', 'cello',
  'trumpet', 'saxophone', 'flute', 'harp', 'ukulele', 'organ',
  'percussion', 'strings', 'brass', 'woodwinds', 'vocals', '808',
  'sampler', 'turntable', 'theremin', 'banjo', 'sitar', 'tabla'
]

// Contributor roles
export const CONTRIBUTOR_ROLES = [
  'songwriter', 'composer', 'producer', 'engineer', 'mixer',
  'mastering engineer', 'remixer', 'vocalist', 'featured artist',
  'instrumentalist', 'arranger', 'lyricist', 'beatmaker'
]

// PRO affiliations
export const PRO_OPTIONS = [
  'BMI', 'ASCAP', 'SESAC', 'PRS', 'SOCAN', 'GEMA', 'SACEM',
  'JASRAC', 'APRA AMCOS', 'IMRO', 'STIM', 'BUMA/STEMRA', 'None'
]

// Language options
export const LANGUAGE_OPTIONS = [
  'English', 'Spanish', 'French', 'Portuguese', 'German', 'Italian',
  'Japanese', 'Korean', 'Chinese', 'Hindi', 'Arabic', 'Russian',
  'Dutch', 'Swedish', 'Turkish', 'Thai', 'Vietnamese', 'Indonesian',
  'Instrumental', 'Other'
]
