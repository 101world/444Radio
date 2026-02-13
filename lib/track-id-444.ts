/**
 * 444Radio Track ID Generator
 * 
 * Format: 444-{YYYY}-{USER_SHORT}-{HASH}
 * Example: 444-2026-A91K-3F8B2C
 * 
 * This is the core identification system replacing ISRC/UPC.
 * Every piece of content on 444Radio gets a unique, immutable Track ID.
 */

import crypto from 'crypto'

/**
 * Generate a 444 Track ID for a given user
 * Format: 444-YYYY-XXXX-YYYYYY
 *   YYYY = current year
 *   XXXX = 4-char user hash (derived from Clerk user ID)
 *   YYYYYY = 6-char random hash
 */
export function generate444TrackId(userId: string): string {
  const year = new Date().getFullYear()
  const userShort = crypto
    .createHash('md5')
    .update(userId)
    .digest('hex')
    .substring(0, 4)
    .toUpperCase()
  const randomHash = crypto
    .randomBytes(4)
    .toString('hex')
    .substring(0, 6)
    .toUpperCase()

  return `444-${year}-${userShort}-${randomHash}`
}

/**
 * Validate a 444 Track ID format
 */
export function isValid444TrackId(trackId: string): boolean {
  return /^444-\d{4}-[A-F0-9]{4}-[A-F0-9]{6}$/.test(trackId)
}

/**
 * Extract year from a 444 Track ID
 */
export function extractYear(trackId: string): number | null {
  const match = trackId.match(/^444-(\d{4})-/)
  return match ? parseInt(match[1], 10) : null
}

/**
 * Creation types for 444Radio content
 */
export type CreationType =
  | 'ai_generated'      // Fully AI-generated via Replicate
  | 'ai_assisted'       // Human-created with AI enhancement
  | 'human_upload'      // Pure human upload
  | 'remix_444'         // Remix of an existing 444Radio track
  | 'stem_derivative'   // Stems extracted from a parent track

/**
 * License types for 444 ecosystem
 */
export type LicenseType444 =
  | 'fully_ownable'    // Full ownership rights
  | 'non_exclusive'    // Non-exclusive license
  | 'remix_allowed'    // Remixing explicitly permitted
  | 'download_only'    // Can download but not redistribute
  | 'streaming_only'   // Stream only, no download
  | 'no_derivatives'   // No remixes or derivative works

/**
 * Prompt visibility options
 */
export type PromptVisibility = 'public' | 'private'

/**
 * Atmosphere types for Sonic DNA
 */
export type Atmosphere =
  | 'dark' | 'dreamy' | 'uplifting' | 'aggressive'
  | 'calm' | 'melancholic' | 'euphoric' | 'mysterious'

/**
 * Era vibe types for Sonic DNA
 */
export type EraVibe =
  | '70s' | '80s' | '90s' | '2000s' | '2010s'
  | 'futuristic' | 'retro' | 'timeless'

/**
 * Tempo feel categories
 */
export type TempoFeel = 'slow' | 'mid' | 'fast'

/**
 * Full 444 metadata for a track
 */
export interface Track444Metadata {
  trackId444: string
  creationType: CreationType
  licenseType444: LicenseType444
  
  // Ownership lock
  originalCreatorId: string
  promptAuthorId?: string
  stemOwnerId?: string
  voiceModelUsed?: string
  
  // AI generation
  generationPrompt?: string
  generationModel?: string
  generationSeed?: string
  generationDate?: string
  generationParams?: Record<string, unknown>
  promptVisibility: PromptVisibility
  
  // Sonic DNA
  energyLevel?: number
  danceability?: number
  tempoFeel?: TempoFeel
  atmosphere?: Atmosphere
  eraVibe?: EraVibe
  
  // Permissions
  remixAllowed: boolean
  derivativeAllowed: boolean
  
  // Version tracking
  versionNumber: number
  previousVersionId?: string
  
  // Metadata completeness
  metadataStrength: number
}

/**
 * Calculate metadata strength score (0-100)
 * Gamifies complete metadata — higher score = better discoverability
 */
export function calculateMetadataStrength(track: Partial<Track444Metadata> & {
  title?: string
  description?: string
  genre?: string
  mood?: string
  tags?: string[]
  bpm?: number
  keySignature?: string
  imageUrl?: string
  instruments?: string[]
  moodTags?: string[]
  keywords?: string[]
  lyrics?: string
}): number {
  let score = 0
  const weights: Array<{ field: string; check: boolean; points: number }> = [
    // Core identity (30 points)
    { field: 'title', check: !!track.title && track.title.length > 2, points: 5 },
    { field: 'description', check: !!track.description && track.description.length > 10, points: 5 },
    { field: 'genre', check: !!track.genre, points: 5 },
    { field: 'creationType', check: !!track.creationType, points: 5 },
    { field: 'coverArt', check: !!track.imageUrl, points: 5 },
    { field: 'licenseType', check: !!track.licenseType444, points: 5 },

    // Sonic DNA (25 points)
    { field: 'bpm', check: !!track.bpm, points: 5 },
    { field: 'keySignature', check: !!track.keySignature, points: 5 },
    { field: 'energyLevel', check: track.energyLevel != null, points: 5 },
    { field: 'danceability', check: track.danceability != null, points: 5 },
    { field: 'atmosphere', check: !!track.atmosphere, points: 5 },

    // Discovery signals (25 points)
    { field: 'mood', check: !!track.mood, points: 5 },
    { field: 'tags', check: !!track.tags && track.tags.length >= 2, points: 5 },
    { field: 'instruments', check: !!track.instruments && track.instruments.length > 0, points: 5 },
    { field: 'moodTags', check: !!track.moodTags && track.moodTags.length > 0, points: 5 },
    { field: 'tempoFeel', check: !!track.tempoFeel, points: 5 },

    // AI provenance (15 points)
    { field: 'generationPrompt', check: !!track.generationPrompt, points: 5 },
    { field: 'generationModel', check: !!track.generationModel, points: 5 },
    { field: 'eraVibe', check: !!track.eraVibe, points: 5 },

    // Bonus (5 points)
    { field: 'lyrics', check: !!track.lyrics, points: 3 },
    { field: 'keywords', check: !!track.keywords && track.keywords.length >= 3, points: 2 },
  ]

  for (const w of weights) {
    if (w.check) score += w.points
  }

  return Math.min(100, score)
}
