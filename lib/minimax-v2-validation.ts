/**
 * MiniMax Music v2 (fal-ai/minimax-music/v2) Input Validation & Builder
 *
 * fal.ai charges for EVERY request, even 422 validation failures.
 * This module validates all inputs BEFORE calling the API to prevent wasted money.
 *
 * API Schema (from https://fal.ai/models/fal-ai/minimax-music/v2/api):
 *
 * REQUIRED:
 *   - prompt (string, 10-300 chars): Music style/mood/scenario description
 *   - lyrics_prompt (string, 10-3000 chars): Song lyrics with optional structure tags
 *     Supported tags: [Intro], [Verse], [Chorus], [Bridge], [Outro]
 *
 * OPTIONAL:
 *   - audio_setting.sample_rate: 8000 | 16000 | 22050 | 24000 | 32000 | 44100
 *   - audio_setting.bitrate: 32000 | 64000 | 128000 | 256000
 *   - audio_setting.format: 'mp3' | 'pcm' | 'flac'
 */

// ── Allowed enums per fal.ai schema ─────────────────────────────────────────

const ALLOWED_SAMPLE_RATES = [8000, 16000, 22050, 24000, 32000, 44100] as const
const ALLOWED_BITRATES = [32000, 64000, 128000, 256000] as const
const ALLOWED_FORMATS = ['mp3', 'pcm', 'flac'] as const

// Prompt limits
const PROMPT_MIN = 10
const PROMPT_MAX = 300

// Lyrics limits
const LYRICS_MIN = 10
const LYRICS_MAX = 3000

// Only these structure tags are supported by MiniMax v2
const SUPPORTED_TAGS = ['intro', 'verse', 'chorus', 'bridge', 'outro']

// ── Types ───────────────────────────────────────────────────────────────────

export interface MiniMaxV2Input {
  prompt: string
  lyrics_prompt: string
  audio_setting?: {
    sample_rate?: number
    bitrate?: number
    format?: string
  }
  [key: string]: unknown
}

export type MiniMaxV2ValidationResult =
  | { valid: true; input: MiniMaxV2Input }
  | { valid: false; error: string }

export interface MiniMaxV2BuildOptions {
  /** Music style/mood description (10-300 chars) */
  prompt: string
  /** Raw lyrics from user (can be empty/null for instrumental) */
  lyrics?: string | null
  /** Audio format preference — 'wav' is mapped to 'flac' since MiniMax v2 doesn't support wav */
  audioFormat?: string
  /** Sample rate (default 44100) */
  sampleRate?: number
  /** Bitrate (default 256000) */
  bitrate?: number
}

// ── Lyrics Sanitization ─────────────────────────────────────────────────────

/**
 * Sanitize lyrics for MiniMax v2:
 * - Replace unsupported tags (e.g. [hook] → [chorus])
 * - Remove any tags not in the supported set
 * - Remove trailing empty tags (tag at end with no content)
 * - Ensure minimum length (10 chars)
 */
function sanitizeLyrics(raw: string): string {
  let lyrics = raw.trim()

  // Replace common unsupported tags with closest supported equivalent
  lyrics = lyrics.replace(/\[hook\]/gi, '[Chorus]')
  lyrics = lyrics.replace(/\[pre[- ]?chorus\]/gi, '[Verse]')
  lyrics = lyrics.replace(/\[refrain\]/gi, '[Chorus]')
  lyrics = lyrics.replace(/\[interlude\]/gi, '[Bridge]')
  lyrics = lyrics.replace(/\[drop\]/gi, '[Chorus]')
  lyrics = lyrics.replace(/\[breakdown\]/gi, '[Bridge]')

  // Remove any remaining unsupported tags (keep only intro/verse/chorus/bridge/outro)
  lyrics = lyrics.replace(
    /\[(?!intro\]|verse\]|chorus\]|bridge\]|outro\])([^\]]*)\]/gi,
    ''
  )

  // Remove trailing empty tags (tag at end with no content after it)
  lyrics = lyrics.replace(/\[(intro|verse|chorus|bridge|outro)\]\s*$/gi, '').trim()

  // Clean up excessive whitespace / blank lines
  lyrics = lyrics.replace(/\n{3,}/g, '\n\n')

  return lyrics
}

/**
 * Check if text appears to be instrumental (no actual lyrics content)
 */
function isInstrumental(text: string | null | undefined): boolean {
  if (!text || text.trim().length === 0) return true
  const lower = text.toLowerCase().trim()
  if (lower.includes('[instrumental]')) return true
  if (lower === 'instrumental' || lower === 'no vocals' || lower === 'no lyrics') return true
  // If after stripping tags there's no real text content
  const withoutTags = lower.replace(/\[[^\]]*\]/g, '').trim()
  if (withoutTags.length < 5) return true
  return false
}

/**
 * Generate a minimal lyrics_prompt for instrumental tracks.
 * MiniMax v2 REQUIRES lyrics_prompt (10-3000 chars) even for instrumentals.
 * ONLY '[instrumental]' works — adding more text causes random lyrics to generate.
 */
function generateInstrumentalLyrics(): string {
  return '[instrumental]'
}

// ── Main Validation & Builder ───────────────────────────────────────────────

/**
 * Validate and build a MiniMax v2 API input payload.
 *
 * Catches all validation issues BEFORE the request, preventing 422s from fal.ai
 * that still cost money.
 *
 * @returns validated input ready to POST to fal.ai, or an error message
 */
export function buildMiniMaxV2Input(options: MiniMaxV2BuildOptions): MiniMaxV2ValidationResult {
  const { prompt, lyrics, audioFormat, sampleRate = 44100, bitrate = 256000 } = options

  // ── Validate prompt ───────────────────────────────────────────────────────
  if (!prompt || typeof prompt !== 'string') {
    return { valid: false, error: 'Prompt is required (music style/mood description)' }
  }

  const trimmedPrompt = prompt.trim()
  if (trimmedPrompt.length < PROMPT_MIN) {
    return { valid: false, error: `Prompt must be at least ${PROMPT_MIN} characters (got ${trimmedPrompt.length})` }
  }

  // Truncate if too long (don't reject, just cap)
  const finalPrompt = trimmedPrompt.substring(0, PROMPT_MAX)

  // ── Build lyrics_prompt (REQUIRED by fal.ai) ──────────────────────────────
  let lyricsPrompt: string

  if (isInstrumental(lyrics)) {
    // No lyrics / instrumental mode — just '[instrumental]', nothing more
    lyricsPrompt = generateInstrumentalLyrics()
    console.log('🎵 [MiniMax2 Validation] Instrumental mode — generated placeholder lyrics_prompt')
  } else {
    // User provided lyrics — sanitize them
    lyricsPrompt = sanitizeLyrics(lyrics!)

    // If sanitization reduced it below minimum, pad with structure
    if (lyricsPrompt.length < LYRICS_MIN) {
      // Wrap short lyrics in a verse tag to meet minimum
      lyricsPrompt = `[Verse]\n${lyricsPrompt}\n\n[Chorus]\n${lyricsPrompt}`
    }
  }

  // Enforce max length
  if (lyricsPrompt.length > LYRICS_MAX) {
    lyricsPrompt = lyricsPrompt.substring(0, LYRICS_MAX)
  }

  // Final safety check — lyrics_prompt must be 10-3000 chars
  if (lyricsPrompt.length < LYRICS_MIN) {
    return { valid: false, error: `Lyrics are too short after processing (min ${LYRICS_MIN} chars). Please provide more lyrics or use instrumental mode.` }
  }

  // ── Validate audio_setting ────────────────────────────────────────────────
  // Map 'wav' to 'flac' since MiniMax v2 doesn't support wav
  let format: string = 'mp3'
  if (audioFormat === 'wav' || audioFormat === 'flac') {
    format = 'flac'
  } else if (audioFormat === 'pcm') {
    format = 'pcm'
  } else {
    format = 'mp3'
  }

  // Validate against allowed enums
  if (!ALLOWED_FORMATS.includes(format as any)) {
    format = 'mp3' // fallback
  }

  const validSampleRate = ALLOWED_SAMPLE_RATES.includes(sampleRate as any)
    ? sampleRate
    : 44100

  const validBitrate = ALLOWED_BITRATES.includes(bitrate as any)
    ? bitrate
    : 256000

  // ── Build final input ─────────────────────────────────────────────────────
  const input: MiniMaxV2Input = {
    prompt: finalPrompt,
    lyrics_prompt: lyricsPrompt,
    audio_setting: {
      sample_rate: validSampleRate,
      bitrate: validBitrate,
      format,
    },
  }

  console.log('✅ [MiniMax2 Validation] Input validated successfully:')
  console.log('   prompt length:', finalPrompt.length)
  console.log('   lyrics_prompt length:', lyricsPrompt.length)
  console.log('   format:', format, '| sample_rate:', validSampleRate, '| bitrate:', validBitrate)

  return { valid: true, input }
}

/**
 * Pre-flight validation that can be called early (before credit deduction)
 * to fail fast without costing the user any credits.
 *
 * Returns null if valid, or an error message string if invalid.
 */
export function preValidateMiniMaxV2(prompt: string, lyrics?: string | null): string | null {
  if (!prompt || typeof prompt !== 'string' || prompt.trim().length < PROMPT_MIN) {
    return `Prompt must be at least ${PROMPT_MIN} characters`
  }
  if (prompt.trim().length > PROMPT_MAX) {
    // This is fine — we'll truncate, not reject
  }

  // If lyrics are provided, check they'll survive sanitization
  if (lyrics && !isInstrumental(lyrics)) {
    const sanitized = sanitizeLyrics(lyrics)
    if (sanitized.length < LYRICS_MIN) {
      return `Lyrics are too short after processing (min ${LYRICS_MIN} chars). Add more lyrics or leave empty for instrumental.`
    }
  }

  return null // valid
}
