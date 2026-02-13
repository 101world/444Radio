import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { corsResponse, handleOptions } from '@/lib/cors'
import { getTrackLineage, canCreateDerivative } from '@/lib/ownership-engine'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

async function supabaseRest(path: string) {
  return fetch(`${supabaseUrl}/rest/v1/${path}`, {
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
    },
  })
}

export async function OPTIONS() {
  return handleOptions()
}

/**
 * GET /api/ownership/track/[trackId]
 * 
 * Get full ownership info for a track:
 * - 444 Track ID
 * - Original creator
 * - Creation type
 * - License type
 * - Sonic DNA
 * - Ownership lineage
 * - Whether current user can remix/derive
 * - Metadata strength
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ trackId: string }> }
) {
  const { userId } = await auth()
  if (!userId) {
    return corsResponse(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  }

  try {
    const { trackId } = await params

    // Fetch the track's full ownership metadata
    const trackRes = await supabaseRest(
      `combined_media?id=eq.${trackId}&select=id,user_id,title,track_id_444,creation_type,original_creator_id,prompt_author_id,stem_owner_id,voice_model_used,license_type_444,remix_allowed,derivative_allowed,generation_prompt,generation_model,generation_seed,generation_date,generation_params,prompt_visibility,energy_level,danceability,tempo_feel,atmosphere,era_vibe,metadata_strength,version_number,previous_version_id,genre,mood,bpm,key_signature,tags,instruments,mood_tags,keywords,audio_prompt`
    )

    if (!trackRes.ok) {
      return corsResponse(NextResponse.json({ error: 'Track not found' }, { status: 404 }))
    }

    const tracks = await trackRes.json()
    const track = tracks?.[0]
    if (!track) {
      return corsResponse(NextResponse.json({ error: 'Track not found' }, { status: 404 }))
    }

    // Get creator username
    const creatorRes = await supabaseRest(
      `users?clerk_user_id=eq.${track.original_creator_id || track.user_id}&select=username,profile_image_url`
    )
    const creators = creatorRes.ok ? await creatorRes.json() : []
    const creator = creators?.[0]

    // Get ownership lineage
    const lineage = await getTrackLineage(trackId)

    // Check if current user can create derivatives
    const derivativeCheck = await canCreateDerivative(trackId, userId)

    // Get fingerprint if it exists
    const fpRes = await supabaseRest(
      `audio_fingerprints?track_id=eq.${trackId}&select=waveform_hash,ai_fingerprint,duration_ms,detected_bpm,detected_key,created_at`
    )
    const fingerprints = fpRes.ok ? await fpRes.json() : []
    const fingerprint = fingerprints?.[0]

    // Determine what prompt info to show based on visibility
    const showPrompt = track.prompt_visibility === 'public' || track.user_id === userId

    return corsResponse(NextResponse.json({
      // Core identity
      id: track.id,
      title: track.title,
      trackId444: track.track_id_444,
      creationType: track.creation_type,

      // Ownership
      originalCreator: {
        id: track.original_creator_id || track.user_id,
        username: creator?.username || null,
        profileImage: creator?.profile_image_url || null,
      },
      promptAuthorId: track.prompt_author_id,
      stemOwnerId: track.stem_owner_id,
      voiceModelUsed: track.voice_model_used,

      // License
      licenseType: track.license_type_444,
      remixAllowed: track.remix_allowed,
      derivativeAllowed: track.derivative_allowed,

      // AI provenance (respect visibility)
      generationPrompt: showPrompt ? (track.generation_prompt || track.audio_prompt) : null,
      generationModel: track.generation_model,
      generationSeed: showPrompt ? track.generation_seed : null,
      generationDate: track.generation_date,
      promptVisibility: track.prompt_visibility,

      // Sonic DNA
      sonicDNA: {
        genre: track.genre,
        mood: track.mood,
        bpm: track.bpm,
        keySignature: track.key_signature,
        energyLevel: track.energy_level,
        danceability: track.danceability,
        tempoFeel: track.tempo_feel,
        atmosphere: track.atmosphere,
        eraVibe: track.era_vibe,
        tags: track.tags,
        instruments: track.instruments,
        moodTags: track.mood_tags,
        keywords: track.keywords,
      },

      // Metadata strength
      metadataStrength: track.metadata_strength,

      // Version tracking
      versionNumber: track.version_number,
      previousVersionId: track.previous_version_id,

      // Content DNA fingerprint
      fingerprint: fingerprint ? {
        waveformHash: fingerprint.waveform_hash?.substring(0, 12) + '...', // partial for privacy
        aiFingerprint: fingerprint.ai_fingerprint?.substring(0, 12) + '...',
        durationMs: fingerprint.duration_ms,
        detectedBpm: fingerprint.detected_bpm,
        detectedKey: fingerprint.detected_key,
        createdAt: fingerprint.created_at,
      } : null,

      // Lineage
      lineage,

      // Permissions for current user
      currentUserPermissions: {
        isOwner: track.user_id === userId,
        isOriginalCreator: (track.original_creator_id || track.user_id) === userId,
        canRemix: derivativeCheck.allowed,
        remixReason: derivativeCheck.reason,
      },

      // Branding
      mintedOn: '444Radio • AI-Native Music Network',
    }))
  } catch (error) {
    console.error('Track ownership fetch error:', error)
    return corsResponse(
      NextResponse.json({ error: 'Failed to fetch ownership info' }, { status: 500 })
    )
  }
}
