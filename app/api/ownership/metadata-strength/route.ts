import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { corsResponse, handleOptions } from '@/lib/cors'
import { calculateMetadataStrength } from '@/lib/track-id-444'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

async function supabaseRest(path: string, options?: RequestInit) {
  return fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...options,
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
      ...(options?.headers || {}),
    },
  })
}

export async function OPTIONS() {
  return handleOptions()
}

/**
 * GET /api/ownership/metadata-strength?trackId=xxx
 * 
 * Get the metadata strength score for a track.
 * Returns the score and a breakdown of what's filled vs missing.
 */
export async function GET(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return corsResponse(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  }

  const trackId = request.nextUrl.searchParams.get('trackId')
  if (!trackId) {
    return corsResponse(NextResponse.json({ error: 'trackId required' }, { status: 400 }))
  }

  try {
    const trackRes = await supabaseRest(
      `combined_media?id=eq.${trackId}&select=title,description,genre,mood,tags,bpm,key_signature,image_url,instruments,mood_tags,keywords,lyrics,creation_type,generation_prompt,generation_model,license_type_444,energy_level,danceability,tempo_feel,atmosphere,era_vibe,audio_prompt`
    )

    if (!trackRes.ok) {
      return corsResponse(NextResponse.json({ error: 'Track not found' }, { status: 404 }))
    }

    const tracks = await trackRes.json()
    const track = tracks?.[0]
    if (!track) {
      return corsResponse(NextResponse.json({ error: 'Track not found' }, { status: 404 }))
    }

    const score = calculateMetadataStrength({
      title: track.title,
      description: track.description,
      genre: track.genre,
      mood: track.mood,
      tags: track.tags,
      bpm: track.bpm,
      keySignature: track.key_signature,
      imageUrl: track.image_url,
      instruments: track.instruments,
      moodTags: track.mood_tags,
      keywords: track.keywords,
      lyrics: track.lyrics,
      creationType: track.creation_type,
      generationPrompt: track.generation_prompt || track.audio_prompt,
      generationModel: track.generation_model,
      licenseType444: track.license_type_444,
      energyLevel: track.energy_level,
      danceability: track.danceability,
      tempoFeel: track.tempo_feel,
      atmosphere: track.atmosphere,
      eraVibe: track.era_vibe,
    })

    // Build breakdown
    const breakdown = {
      coreIdentity: {
        score: 0,
        max: 30,
        fields: {
          title: { filled: !!track.title && track.title.length > 2, points: 5 },
          description: { filled: !!track.description && track.description.length > 10, points: 5 },
          genre: { filled: !!track.genre, points: 5 },
          creationType: { filled: !!track.creation_type, points: 5 },
          coverArt: { filled: !!track.image_url, points: 5 },
          licenseType: { filled: !!track.license_type_444, points: 5 },
        },
      },
      sonicDNA: {
        score: 0,
        max: 25,
        fields: {
          bpm: { filled: !!track.bpm, points: 5 },
          keySignature: { filled: !!track.key_signature, points: 5 },
          energyLevel: { filled: track.energy_level != null, points: 5 },
          danceability: { filled: track.danceability != null, points: 5 },
          atmosphere: { filled: !!track.atmosphere, points: 5 },
        },
      },
      discoverySignals: {
        score: 0,
        max: 25,
        fields: {
          mood: { filled: !!track.mood, points: 5 },
          tags: { filled: !!track.tags && track.tags.length >= 2, points: 5 },
          instruments: { filled: !!track.instruments && track.instruments.length > 0, points: 5 },
          moodTags: { filled: !!track.mood_tags && track.mood_tags.length > 0, points: 5 },
          tempoFeel: { filled: !!track.tempo_feel, points: 5 },
        },
      },
      aiProvenance: {
        score: 0,
        max: 15,
        fields: {
          generationPrompt: { filled: !!(track.generation_prompt || track.audio_prompt), points: 5 },
          generationModel: { filled: !!track.generation_model, points: 5 },
          eraVibe: { filled: !!track.era_vibe, points: 5 },
        },
      },
      bonus: {
        score: 0,
        max: 5,
        fields: {
          lyrics: { filled: !!track.lyrics, points: 3 },
          keywords: { filled: !!track.keywords && track.keywords.length >= 3, points: 2 },
        },
      },
    }

    // Calculate section scores
    for (const section of Object.values(breakdown)) {
      for (const field of Object.values(section.fields)) {
        if (field.filled) section.score += field.points
      }
    }

    return corsResponse(NextResponse.json({
      trackId,
      metadataStrength: score,
      breakdown,
      label: score >= 80 ? 'Excellent' : score >= 60 ? 'Good' : score >= 40 ? 'Fair' : 'Needs Work',
    }))
  } catch (error) {
    console.error('Metadata strength error:', error)
    return corsResponse(
      NextResponse.json({ error: 'Failed to calculate strength' }, { status: 500 })
    )
  }
}

/**
 * PATCH /api/ownership/metadata-strength
 * 
 * Update Sonic DNA / ownership fields and recalculate strength.
 * Body: { trackId, ...fields }
 */
export async function PATCH(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return corsResponse(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  }

  try {
    const body = await request.json()
    const { trackId, ...updates } = body

    if (!trackId) {
      return corsResponse(NextResponse.json({ error: 'trackId required' }, { status: 400 }))
    }

    // Verify ownership
    const trackRes = await supabaseRest(
      `combined_media?id=eq.${trackId}&select=user_id`
    )
    const tracks = trackRes.ok ? await trackRes.json() : []
    if (!tracks?.[0] || tracks[0].user_id !== userId) {
      return corsResponse(NextResponse.json({ error: 'Not your track' }, { status: 403 }))
    }

    // Whitelist allowed update fields
    const allowedFields = [
      'energy_level', 'danceability', 'tempo_feel', 'atmosphere', 'era_vibe',
      'license_type_444', 'remix_allowed', 'derivative_allowed',
      'prompt_visibility', 'voice_model_used',
      'creation_type', 'generation_prompt', 'generation_model', 'generation_seed',
    ]

    const safeUpdates: Record<string, unknown> = {}
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        safeUpdates[field] = updates[field]
      }
    }

    if (Object.keys(safeUpdates).length === 0) {
      return corsResponse(NextResponse.json({ error: 'No valid fields to update' }, { status: 400 }))
    }

    // Apply updates
    const updateRes = await supabaseRest(`combined_media?id=eq.${trackId}`, {
      method: 'PATCH',
      body: JSON.stringify(safeUpdates),
    })

    if (!updateRes.ok) {
      return corsResponse(NextResponse.json({ error: 'Update failed' }, { status: 500 }))
    }

    // Recalculate metadata strength
    const refreshRes = await supabaseRest(
      `combined_media?id=eq.${trackId}&select=title,description,genre,mood,tags,bpm,key_signature,image_url,instruments,mood_tags,keywords,lyrics,creation_type,generation_prompt,generation_model,license_type_444,energy_level,danceability,tempo_feel,atmosphere,era_vibe,audio_prompt`
    )
    const refreshed = refreshRes.ok ? await refreshRes.json() : []
    const t = refreshed?.[0]

    if (t) {
      const newScore = calculateMetadataStrength({
        title: t.title, description: t.description, genre: t.genre, mood: t.mood,
        tags: t.tags, bpm: t.bpm, keySignature: t.key_signature, imageUrl: t.image_url,
        instruments: t.instruments, moodTags: t.mood_tags, keywords: t.keywords,
        lyrics: t.lyrics, creationType: t.creation_type,
        generationPrompt: t.generation_prompt || t.audio_prompt,
        generationModel: t.generation_model, licenseType444: t.license_type_444,
        energyLevel: t.energy_level, danceability: t.danceability,
        tempoFeel: t.tempo_feel, atmosphere: t.atmosphere, eraVibe: t.era_vibe,
      })

      await supabaseRest(`combined_media?id=eq.${trackId}`, {
        method: 'PATCH',
        body: JSON.stringify({ metadata_strength: newScore }),
      })

      return corsResponse(NextResponse.json({
        success: true,
        metadataStrength: newScore,
        updated: Object.keys(safeUpdates),
      }))
    }

    return corsResponse(NextResponse.json({ success: true, updated: Object.keys(safeUpdates) }))
  } catch (error) {
    console.error('Metadata update error:', error)
    return corsResponse(
      NextResponse.json({ error: 'Update failed' }, { status: 500 })
    )
  }
}
