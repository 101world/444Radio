import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { corsResponse, handleOptions } from '@/lib/cors'

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
 * GET /api/ownership/search
 * 
 * Prompt-indexed music discovery engine.
 * Search by natural language queries that match against:
 * - Generation prompts (public only)
 * - Sonic DNA fields (atmosphere, energy, era)
 * - Full-text search vector (title, genre, tags, etc.)
 * 
 * Query params:
 * - q: search query text
 * - atmosphere: dark|dreamy|uplifting|aggressive|calm|melancholic|euphoric|mysterious
 * - tempoFeel: slow|mid|fast
 * - eraVibe: 70s|80s|90s|2000s|2010s|futuristic|retro|timeless
 * - energyMin: 0-100
 * - energyMax: 0-100
 * - danceMin: 0-100
 * - danceMax: 0-100
 * - creationType: ai_generated|ai_assisted|human_upload|remix_444
 * - remixable: true (only tracks that allow remixes)
 * - limit: number (default 20)
 * - offset: number (default 0)
 */
export async function GET(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return corsResponse(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  }

  try {
    const params = request.nextUrl.searchParams
    const query = params.get('q')
    const atmosphere = params.get('atmosphere')
    const tempoFeel = params.get('tempoFeel')
    const eraVibe = params.get('eraVibe')
    const energyMin = params.get('energyMin')
    const energyMax = params.get('energyMax')
    const danceMin = params.get('danceMin')
    const danceMax = params.get('danceMax')
    const creationType = params.get('creationType')
    const remixable = params.get('remixable')
    const limit = Math.min(parseInt(params.get('limit') || '20'), 50)
    const offset = parseInt(params.get('offset') || '0')

    // Build the query string
    const filters: string[] = [
      'is_public=eq.true',
      'audio_url=not.is.null',
    ]

    // Sonic DNA filters
    if (atmosphere) filters.push(`atmosphere=eq.${atmosphere}`)
    if (tempoFeel) filters.push(`tempo_feel=eq.${tempoFeel}`)
    if (eraVibe) filters.push(`era_vibe=eq.${eraVibe}`)
    if (energyMin) filters.push(`energy_level=gte.${energyMin}`)
    if (energyMax) filters.push(`energy_level=lte.${energyMax}`)
    if (danceMin) filters.push(`danceability=gte.${danceMin}`)
    if (danceMax) filters.push(`danceability=lte.${danceMax}`)
    if (creationType) filters.push(`creation_type=eq.${creationType}`)
    if (remixable === 'true') filters.push(`remix_allowed=eq.true`)

    // Exclude stems from search results
    filters.push('stem_type=is.null')

    // Select fields
    const select = 'id,title,audio_url,image_url,user_id,genre,mood,bpm,plays,likes,track_id_444,creation_type,atmosphere,tempo_feel,era_vibe,energy_level,danceability,metadata_strength,license_type_444,remix_allowed,generation_model,prompt_visibility,created_at'

    let url: string

    if (query) {
      // Full-text search using tsvector
      const tsQuery = query
        .trim()
        .split(/\s+/)
        .filter(w => w.length > 1)
        .map(w => `${w}:*`)
        .join(' & ')

      if (tsQuery) {
        filters.push(`search_vector=fts.${encodeURIComponent(tsQuery)}`)
      }
    }

    url = `combined_media?${filters.join('&')}&select=${select}&order=metadata_strength.desc.nullsfirst,plays.desc&limit=${limit}&offset=${offset}`

    const res = await supabaseRest(url)
    if (!res.ok) {
      console.error('Search error:', await res.text())
      return corsResponse(NextResponse.json({ error: 'Search failed' }, { status: 500 }))
    }

    const tracks = await res.json()

    // If query matches prompt patterns, also search public generation prompts
    let promptMatches: unknown[] = []
    if (query && query.length > 5) {
      const promptRes = await supabaseRest(
        `combined_media?generation_prompt=ilike.*${encodeURIComponent(query)}*&prompt_visibility=eq.public&is_public=eq.true&select=${select}&order=plays.desc&limit=10`
      )
      if (promptRes.ok) {
        promptMatches = await promptRes.json()
      }
    }

    // Merge and deduplicate
    const seenIds = new Set(tracks.map((t: { id: string }) => t.id))
    const mergedResults = [...tracks]
    for (const pm of promptMatches) {
      if (!seenIds.has((pm as { id: string }).id)) {
        mergedResults.push(pm)
        seenIds.add((pm as { id: string }).id)
      }
    }

    return corsResponse(NextResponse.json({
      tracks: mergedResults,
      total: mergedResults.length,
      query: query || null,
      filters: {
        atmosphere, tempoFeel, eraVibe,
        energyRange: energyMin || energyMax ? [energyMin, energyMax] : null,
        danceRange: danceMin || danceMax ? [danceMin, danceMax] : null,
        creationType, remixable,
      },
      pagination: { limit, offset },
    }))
  } catch (error) {
    console.error('Search error:', error)
    return corsResponse(
      NextResponse.json({ error: 'Search failed' }, { status: 500 })
    )
  }
}
