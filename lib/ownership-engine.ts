/**
 * 444Radio Ownership Engine
 * 
 * Central service for:
 * - Tracking content ownership and lineage
 * - Recording download/purchase/remix events
 * - Detecting reuploads via fingerprint comparison
 * - Enforcing creator locks and license restrictions
 * - Embedding ownership metadata into audio files
 * 
 * This is the core IP protection layer of 444Radio.
 */

import { generate444TrackId, calculateMetadataStrength, type LicenseType444 } from './track-id-444'
import {
  generateFingerprint,
  computeAudioHash,
  computePromptHash,
  compareFingerprints,
  REUPLOAD_BLOCK_THRESHOLD,
  REUPLOAD_FLAG_THRESHOLD,
  type AudioFingerprint,
  type FingerprintMatch,
} from './audio-fingerprint'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// ============================================================
// SUPABASE REST HELPER
// ============================================================

async function supabaseRest(path: string, options?: RequestInit) {
  const res = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...options,
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
      ...(options?.headers || {}),
    },
  })
  return res
}

// ============================================================
// 444 TRACK ID MANAGEMENT
// ============================================================

/**
 * Assign a 444 Track ID to a track that doesn't have one yet.
 * The DB trigger handles this on INSERT, but this can be called
 * manually for tracks that were created before the system.
 */
export async function assign444TrackId(trackId: string, userId: string): Promise<string | null> {
  const trackId444 = generate444TrackId(userId)
  
  const res = await supabaseRest(`combined_media?id=eq.${trackId}&track_id_444=is.null`, {
    method: 'PATCH',
    body: JSON.stringify({ track_id_444: trackId444 }),
  })
  
  if (!res.ok) {
    console.error('Failed to assign 444 Track ID:', await res.text())
    return null
  }
  
  return trackId444
}

// ============================================================
// OWNERSHIP LOG
// ============================================================

export type OwnershipTransactionType =
  | 'creation'
  | 'download'
  | 'purchase'
  | 'remix'
  | 'stem_split'
  | 'transfer'
  | 'license_grant'

interface OwnershipLogEntry {
  trackId: string
  originalCreatorId: string
  currentOwnerId: string
  transactionType: OwnershipTransactionType
  parentTrackId?: string
  licenseType: LicenseType444
  derivativeAllowed: boolean
  audioHash?: string
  trackId444?: string
  metadata?: Record<string, unknown>
}

/**
 * Record an ownership event in the lineage log
 */
export async function logOwnershipEvent(entry: OwnershipLogEntry): Promise<boolean> {
  const res = await supabaseRest('track_ownership_log', {
    method: 'POST',
    body: JSON.stringify({
      track_id: entry.trackId,
      original_creator_id: entry.originalCreatorId,
      current_owner_id: entry.currentOwnerId,
      transaction_type: entry.transactionType,
      parent_track_id: entry.parentTrackId || null,
      license_type: entry.licenseType,
      derivative_allowed: entry.derivativeAllowed,
      audio_hash: entry.audioHash || null,
      track_id_444: entry.trackId444 || null,
      metadata: entry.metadata || {},
    }),
  })

  if (!res.ok) {
    console.error('Failed to log ownership event:', await res.text())
    return false
  }

  return true
}

/**
 * Get the full ownership lineage for a track
 */
export async function getTrackLineage(trackId: string) {
  const res = await supabaseRest(
    `track_ownership_log?track_id=eq.${trackId}&order=created_at.asc&select=*`
  )
  if (!res.ok) return []
  return res.json()
}

/**
 * Get all tracks created by a user
 */
export async function getCreatorTracks(creatorId: string) {
  const res = await supabaseRest(
    `track_ownership_log?original_creator_id=eq.${creatorId}&transaction_type=eq.creation&order=created_at.desc&select=*`
  )
  if (!res.ok) return []
  return res.json()
}

// ============================================================
// DOWNLOAD LINEAGE
// ============================================================

interface DownloadLineageEntry {
  trackId: string
  parentTrackId?: string
  downloadUserId: string
  originalCreatorId: string
  derivativeAllowed: boolean
  remixAllowed: boolean
  licenseType: LicenseType444
  embeddedTrackId444?: string
  downloadHash?: string
}

/**
 * Record a download event with lineage tracking
 */
export async function recordDownloadLineage(entry: DownloadLineageEntry): Promise<boolean> {
  const res = await supabaseRest('download_lineage', {
    method: 'POST',
    body: JSON.stringify({
      track_id: entry.trackId,
      parent_track_id: entry.parentTrackId || null,
      download_user_id: entry.downloadUserId,
      original_creator_id: entry.originalCreatorId,
      derivative_allowed: entry.derivativeAllowed,
      remix_allowed: entry.remixAllowed,
      license_type: entry.licenseType,
      embedded_track_id_444: entry.embeddedTrackId444 || null,
      download_hash: entry.downloadHash || null,
    }),
  })

  if (!res.ok) {
    console.error('Failed to record download lineage:', await res.text())
    return false
  }

  return true
}

/**
 * Check if a user is allowed to create derivatives of a track
 */
export async function canCreateDerivative(trackId: string, userId: string): Promise<{
  allowed: boolean
  reason: string
  originalCreator?: string
  licenseType?: string
}> {
  // Get the track's ownership info
  const trackRes = await supabaseRest(
    `combined_media?id=eq.${trackId}&select=user_id,original_creator_id,license_type_444,remix_allowed,derivative_allowed,track_id_444`
  )
  if (!trackRes.ok) return { allowed: false, reason: 'Track not found' }
  
  const tracks = await trackRes.json()
  const track = tracks?.[0]
  if (!track) return { allowed: false, reason: 'Track not found' }

  // Original creator can always remix their own work
  if (track.user_id === userId || track.original_creator_id === userId) {
    return { allowed: true, reason: 'You are the original creator' }
  }

  // Check license type
  if (track.license_type_444 === 'no_derivatives' || track.license_type_444 === 'streaming_only') {
    return {
      allowed: false,
      reason: `This track's license (${track.license_type_444}) does not allow derivatives`,
      originalCreator: track.original_creator_id,
      licenseType: track.license_type_444,
    }
  }

  // Check explicit remix/derivative flags
  if (track.remix_allowed || track.derivative_allowed) {
    return { allowed: true, reason: 'Remix/derivative explicitly allowed by creator' }
  }

  // Check if user purchased the track
  const purchaseRes = await supabaseRest(
    `earn_purchases?buyer_id=eq.${userId}&track_id=eq.${trackId}&select=id`
  )
  if (purchaseRes.ok) {
    const purchases = await purchaseRes.json()
    if (purchases && purchases.length > 0) {
      // Check download lineage for derivative permission
      const lineageRes = await supabaseRest(
        `download_lineage?track_id=eq.${trackId}&download_user_id=eq.${userId}&select=derivative_allowed`
      )
      if (lineageRes.ok) {
        const lineage = await lineageRes.json()
        if (lineage?.[0]?.derivative_allowed) {
          return { allowed: true, reason: 'You purchased this track with derivative rights' }
        }
      }
      return {
        allowed: false,
        reason: 'You purchased this track but without derivative rights',
        originalCreator: track.original_creator_id,
        licenseType: track.license_type_444,
      }
    }
  }

  return {
    allowed: false,
    reason: 'No permission to create derivatives of this track',
    originalCreator: track.original_creator_id,
    licenseType: track.license_type_444,
  }
}

// ============================================================
// FINGERPRINT MANAGEMENT
// ============================================================

/**
 * Store an audio fingerprint for a track
 */
export async function storeFingerprint(
  trackId: string,
  fingerprint: AudioFingerprint
): Promise<boolean> {
  const res = await supabaseRest('audio_fingerprints', {
    method: 'POST',
    headers: { 'Prefer': 'resolution=merge-duplicates' },
    body: JSON.stringify({
      track_id: trackId,
      waveform_hash: fingerprint.waveformHash,
      stem_hash_vocals: fingerprint.stemHashVocals || null,
      stem_hash_drums: fingerprint.stemHashDrums || null,
      stem_hash_bass: fingerprint.stemHashBass || null,
      stem_hash_melody: fingerprint.stemHashMelody || null,
      stem_hash_other: fingerprint.stemHashOther || null,
      prompt_hash: fingerprint.promptHash || null,
      ai_fingerprint: fingerprint.aiFingerprint,
      duration_ms: fingerprint.durationMs || null,
      detected_bpm: fingerprint.detectedBpm || null,
      detected_key: fingerprint.detectedKey || null,
    }),
  })

  if (!res.ok) {
    console.error('Failed to store fingerprint:', await res.text())
    return false
  }

  return true
}

/**
 * Check if an audio buffer matches any existing fingerprint
 * Returns matches sorted by similarity score (highest first)
 */
export async function checkForDuplicates(
  audioBuffer: Buffer | ArrayBuffer,
  options?: {
    prompt?: string
    seed?: string
    model?: string
    excludeTrackId?: string  // Exclude this track from results (for updates)
  }
): Promise<FingerprintMatch[]> {
  const fingerprint = generateFingerprint(audioBuffer, options)
  const matches: FingerprintMatch[] = []

  // Layer 1: Exact waveform hash match (fastest)
  const exactRes = await supabaseRest(
    `audio_fingerprints?waveform_hash=eq.${fingerprint.waveformHash}&select=track_id`
  )
  if (exactRes.ok) {
    const exactMatches = await exactRes.json()
    for (const match of exactMatches || []) {
      if (options?.excludeTrackId && match.track_id === options.excludeTrackId) continue
      
      const trackInfo = await getTrackInfo(match.track_id)
      if (trackInfo) {
        matches.push({
          trackId: match.track_id,
          trackId444: trackInfo.track_id_444 || '',
          originalCreatorId: trackInfo.original_creator_id || trackInfo.user_id,
          detectionMethod: 'exact_hash',
          similarityScore: 1.0,
          title: trackInfo.title || 'Unknown',
        })
      }
    }
  }

  // If we found exact matches, return immediately
  if (matches.length > 0) return matches

  // Layer 2: AI fingerprint match
  const aiRes = await supabaseRest(
    `audio_fingerprints?ai_fingerprint=eq.${fingerprint.aiFingerprint}&select=track_id`
  )
  if (aiRes.ok) {
    const aiMatches = await aiRes.json()
    for (const match of aiMatches || []) {
      if (options?.excludeTrackId && match.track_id === options.excludeTrackId) continue
      
      const trackInfo = await getTrackInfo(match.track_id)
      if (trackInfo) {
        matches.push({
          trackId: match.track_id,
          trackId444: trackInfo.track_id_444 || '',
          originalCreatorId: trackInfo.original_creator_id || trackInfo.user_id,
          detectionMethod: 'waveform_similarity',
          similarityScore: 0.98,
          title: trackInfo.title || 'Unknown',
        })
      }
    }
  }

  if (matches.length > 0) return matches

  // Layer 3: Prompt hash match (if prompt provided)
  if (fingerprint.promptHash) {
    const promptRes = await supabaseRest(
      `audio_fingerprints?prompt_hash=eq.${fingerprint.promptHash}&select=track_id`
    )
    if (promptRes.ok) {
      const promptMatches = await promptRes.json()
      for (const match of promptMatches || []) {
        if (options?.excludeTrackId && match.track_id === options.excludeTrackId) continue
        
        const trackInfo = await getTrackInfo(match.track_id)
        if (trackInfo) {
          matches.push({
            trackId: match.track_id,
            trackId444: trackInfo.track_id_444 || '',
            originalCreatorId: trackInfo.original_creator_id || trackInfo.user_id,
            detectionMethod: 'prompt_similarity',
            similarityScore: 0.85,
            title: trackInfo.title || 'Unknown',
          })
        }
      }
    }
  }

  return matches.sort((a, b) => b.similarityScore - a.similarityScore)
}

/**
 * Record a reupload detection event
 */
export async function recordReuploadDetection(data: {
  flaggedTrackId?: string
  flaggedUserId: string
  originalTrackId: string
  originalCreatorId: string
  originalTrackId444: string
  detectionMethod: string
  similarityScore: number
  resolution?: string
  details?: Record<string, unknown>
}): Promise<boolean> {
  const res = await supabaseRest('reupload_detections', {
    method: 'POST',
    body: JSON.stringify({
      flagged_track_id: data.flaggedTrackId || null,
      flagged_user_id: data.flaggedUserId,
      original_track_id: data.originalTrackId,
      original_creator_id: data.originalCreatorId,
      original_track_id_444: data.originalTrackId444,
      detection_method: data.detectionMethod,
      similarity_score: data.similarityScore,
      resolution: data.resolution || 'pending',
      details: data.details || {},
    }),
  })

  if (!res.ok) {
    console.error('Failed to record reupload detection:', await res.text())
    return false
  }

  return true
}

// ============================================================
// UPLOAD VALIDATION (Anti-Reupload Protection)
// ============================================================

export interface UploadValidationResult {
  allowed: boolean
  isOriginal: boolean
  matches: FingerprintMatch[]
  blockReason?: string
  suggestedAction?: 'upload_as_remix' | 'credit_original' | 'cancel'
  originalCreator?: {
    userId: string
    username?: string
    trackId444: string
    title: string
  }
}

/**
 * Validate an upload against existing content
 * This is the main anti-reupload gate.
 */
export async function validateUpload(
  audioBuffer: Buffer | ArrayBuffer,
  uploaderId: string,
  options?: {
    prompt?: string
    seed?: string
    model?: string
    claimedAsOriginal?: boolean
  }
): Promise<UploadValidationResult> {
  // Check for duplicate fingerprints
  const matches = await checkForDuplicates(audioBuffer, {
    prompt: options?.prompt,
    seed: options?.seed,
    model: options?.model,
  })

  // No matches = original content
  if (matches.length === 0) {
    return { allowed: true, isOriginal: true, matches: [] }
  }

  const topMatch = matches[0]

  // If the uploader is the original creator, always allow
  if (topMatch.originalCreatorId === uploaderId) {
    return { allowed: true, isOriginal: true, matches }
  }

  // High similarity = likely reupload
  if (topMatch.similarityScore >= REUPLOAD_BLOCK_THRESHOLD) {
    // Get original creator username
    const userRes = await supabaseRest(
      `users?clerk_user_id=eq.${topMatch.originalCreatorId}&select=username`
    )
    const users = userRes.ok ? await userRes.json() : []
    const username = users?.[0]?.username

    // Record the detection
    await recordReuploadDetection({
      flaggedUserId: uploaderId,
      originalTrackId: topMatch.trackId,
      originalCreatorId: topMatch.originalCreatorId,
      originalTrackId444: topMatch.trackId444,
      detectionMethod: topMatch.detectionMethod,
      similarityScore: topMatch.similarityScore,
      resolution: 'pending',
    })

    return {
      allowed: false,
      isOriginal: false,
      matches,
      blockReason: `This track originates from @${username || topMatch.originalCreatorId}. Original Track ID: ${topMatch.trackId444}`,
      suggestedAction: 'upload_as_remix',
      originalCreator: {
        userId: topMatch.originalCreatorId,
        username: username || undefined,
        trackId444: topMatch.trackId444,
        title: topMatch.title,
      },
    }
  }

  // Medium similarity = flagged but allowed with warning
  if (topMatch.similarityScore >= REUPLOAD_FLAG_THRESHOLD) {
    return {
      allowed: true,
      isOriginal: false,
      matches,
      suggestedAction: 'credit_original',
      originalCreator: {
        userId: topMatch.originalCreatorId,
        trackId444: topMatch.trackId444,
        title: topMatch.title,
      },
    }
  }

  // Low similarity = probably fine
  return { allowed: true, isOriginal: true, matches }
}

// ============================================================
// METADATA EMBEDDING (ID3 Tags for ownership tracking)
// ============================================================

/**
 * Generate ownership metadata to embed in downloaded audio files.
 * This creates a metadata object that can be written as ID3 tags.
 * 
 * For actual ID3 tag embedding, we use the API route which handles
 * binary audio manipulation server-side.
 */
export function generateEmbedMetadata(track: {
  trackId444: string
  originalCreatorId: string
  originalCreatorUsername?: string
  buyerId?: string
  buyerUsername?: string
  licenseType: string
  audioHash?: string
}): Record<string, string> {
  return {
    '444TrackID': track.trackId444,
    '444OriginalCreator': track.originalCreatorUsername || track.originalCreatorId,
    '444CreatorID': track.originalCreatorId,
    '444Buyer': track.buyerUsername || track.buyerId || 'N/A',
    '444BuyerID': track.buyerId || 'N/A',
    '444License': track.licenseType,
    '444Hash': track.audioHash || 'N/A',
    '444Platform': '444Radio • AI-Native Music Network',
    '444Timestamp': new Date().toISOString(),
  }
}

// ============================================================
// HELPER: Get track info by ID
// ============================================================

async function getTrackInfo(trackId: string) {
  const res = await supabaseRest(
    `combined_media?id=eq.${trackId}&select=id,user_id,title,original_creator_id,track_id_444,license_type_444,remix_allowed,derivative_allowed`
  )
  if (!res.ok) return null
  const tracks = await res.json()
  return tracks?.[0] || null
}

// ============================================================
// CREATION EVENT (Call after upload/generation)
// ============================================================

/**
 * Full creation pipeline: fingerprint + ownership log + metadata strength
 * Call this after a track is uploaded or generated.
 */
export async function processNewTrack(params: {
  trackId: string
  userId: string
  audioBuffer: Buffer | ArrayBuffer
  prompt?: string
  seed?: string
  model?: string
  licenseType?: LicenseType444
  remixAllowed?: boolean
  derivativeAllowed?: boolean
  trackMetadata?: Record<string, unknown>
}): Promise<{
  trackId444: string | null
  fingerprint: AudioFingerprint
  metadataStrength: number
  ownershipLogged: boolean
}> {
  // 1. Generate fingerprint
  const fingerprint = generateFingerprint(params.audioBuffer, {
    prompt: params.prompt,
    seed: params.seed,
    model: params.model,
  })

  // 2. Store fingerprint
  await storeFingerprint(params.trackId, fingerprint)

  // 3. Get the track's 444 ID (auto-assigned by DB trigger)
  const trackRes = await supabaseRest(
    `combined_media?id=eq.${params.trackId}&select=track_id_444`
  )
  const tracks = trackRes.ok ? await trackRes.json() : []
  const trackId444 = tracks?.[0]?.track_id_444

  // 4. Log creation event
  const ownershipLogged = await logOwnershipEvent({
    trackId: params.trackId,
    originalCreatorId: params.userId,
    currentOwnerId: params.userId,
    transactionType: 'creation',
    licenseType: params.licenseType || 'fully_ownable',
    derivativeAllowed: params.derivativeAllowed ?? false,
    audioHash: computeAudioHash(params.audioBuffer),
    trackId444: trackId444 || undefined,
    metadata: {
      prompt: params.prompt,
      model: params.model,
      seed: params.seed,
    },
  })

  // 5. Calculate and update metadata strength
  const metadataStrength = calculateMetadataStrength({
    ...(params.trackMetadata as Record<string, string | string[] | number | undefined>),
    creationType: params.prompt ? 'ai_generated' : 'human_upload',
    generationPrompt: params.prompt,
    generationModel: params.model,
    licenseType444: params.licenseType || 'fully_ownable',
  })

  await supabaseRest(`combined_media?id=eq.${params.trackId}`, {
    method: 'PATCH',
    body: JSON.stringify({ metadata_strength: metadataStrength }),
  })

  return {
    trackId444,
    fingerprint,
    metadataStrength,
    ownershipLogged,
  }
}
