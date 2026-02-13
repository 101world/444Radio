import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { corsResponse, handleOptions } from '@/lib/cors'
import { processNewTrack } from '@/lib/ownership-engine'
import { generateFingerprint, computeAudioHash } from '@/lib/audio-fingerprint'

export async function OPTIONS() {
  return handleOptions()
}

/**
 * POST /api/ownership/register
 * 
 * Register a new track in the 444 ownership system.
 * Call after a track has been inserted into combined_media.
 * 
 * Body JSON: { trackId, prompt?, seed?, model?, licenseType?, remixAllowed?, derivativeAllowed? }
 * 
 * This will:
 * 1. Fetch the audio from R2
 * 2. Generate fingerprint
 * 3. Store fingerprint
 * 4. Log creation ownership event
 * 5. Calculate metadata strength
 */
export async function POST(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return corsResponse(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  }

  try {
    const {
      trackId,
      prompt,
      seed,
      model,
      licenseType,
      remixAllowed,
      derivativeAllowed,
    } = await request.json()

    if (!trackId) {
      return corsResponse(NextResponse.json({ error: 'trackId required' }, { status: 400 }))
    }

    // Fetch the track's audio URL from combined_media
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    
    const trackRes = await fetch(`${supabaseUrl}/rest/v1/combined_media?id=eq.${trackId}&select=audio_url,user_id,title,genre,mood,bpm,key_signature,tags,instruments,mood_tags,keywords,description,audio_prompt,prompt,lyrics`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
    })

    if (!trackRes.ok) {
      return corsResponse(NextResponse.json({ error: 'Track not found' }, { status: 404 }))
    }

    const tracks = await trackRes.json()
    const track = tracks?.[0]
    if (!track) {
      return corsResponse(NextResponse.json({ error: 'Track not found' }, { status: 404 }))
    }

    // Verify the user owns this track
    if (track.user_id !== userId) {
      return corsResponse(NextResponse.json({ error: 'Not your track' }, { status: 403 }))
    }

    // Fetch the actual audio file
    let audioBuffer: ArrayBuffer
    try {
      const audioRes = await fetch(track.audio_url)
      if (!audioRes.ok) throw new Error('Failed to fetch audio')
      audioBuffer = await audioRes.arrayBuffer()
    } catch {
      // If audio not available yet (still processing), create a placeholder fingerprint
      // based on prompt data only
      if (prompt) {
        const { computePromptHash, computeAIFingerprint } = await import('@/lib/audio-fingerprint')
        const promptHash = computePromptHash(prompt, seed, model)
        
        // Store a partial fingerprint
        await fetch(`${supabaseUrl}/rest/v1/audio_fingerprints`, {
          method: 'POST',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation',
          },
          body: JSON.stringify({
            track_id: trackId,
            waveform_hash: 'pending-' + promptHash.substring(0, 32),
            prompt_hash: promptHash,
            ai_fingerprint: computeAIFingerprint('pending', promptHash),
          }),
        })

        return corsResponse(NextResponse.json({
          success: true,
          status: 'partial',
          message: 'Prompt fingerprint registered. Full fingerprint will be created when audio is available.',
        }))
      }

      return corsResponse(NextResponse.json({ error: 'Audio not available yet' }, { status: 202 }))
    }

    // Update generation metadata on the track
    const genMetadata: Record<string, unknown> = {}
    if (prompt) genMetadata.generation_prompt = prompt
    if (seed) genMetadata.generation_seed = seed
    if (model) genMetadata.generation_model = model
    if (prompt || seed || model) genMetadata.generation_date = new Date().toISOString()
    if (licenseType) genMetadata.license_type_444 = licenseType
    if (remixAllowed !== undefined) genMetadata.remix_allowed = remixAllowed
    if (derivativeAllowed !== undefined) genMetadata.derivative_allowed = derivativeAllowed

    if (Object.keys(genMetadata).length > 0) {
      await fetch(`${supabaseUrl}/rest/v1/combined_media?id=eq.${trackId}`, {
        method: 'PATCH',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(genMetadata),
      })
    }

    // Process the track through the ownership engine
    const result = await processNewTrack({
      trackId,
      userId,
      audioBuffer,
      prompt: prompt || track.audio_prompt || track.prompt,
      seed,
      model,
      licenseType: licenseType || 'fully_ownable',
      remixAllowed: remixAllowed ?? false,
      derivativeAllowed: derivativeAllowed ?? false,
      trackMetadata: {
        title: track.title,
        description: track.description,
        genre: track.genre,
        mood: track.mood,
        bpm: track.bpm,
        keySignature: track.key_signature,
        tags: track.tags,
        instruments: track.instruments,
        moodTags: track.mood_tags,
        keywords: track.keywords,
        lyrics: track.lyrics,
      },
    })

    return corsResponse(NextResponse.json({
      success: true,
      trackId444: result.trackId444,
      metadataStrength: result.metadataStrength,
      fingerprintHash: result.fingerprint.aiFingerprint.substring(0, 16),
      ownershipLogged: result.ownershipLogged,
    }))
  } catch (error) {
    console.error('Ownership registration error:', error)
    return corsResponse(
      NextResponse.json({ error: 'Registration failed' }, { status: 500 })
    )
  }
}
