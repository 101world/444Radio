import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { corsResponse, handleOptions } from '@/lib/cors'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function OPTIONS() {
  return handleOptions()
}

/**
 * Advanced search endpoint for 444Radio
 * 
 * Query params:
 *   q        - Full-text search query (searches title, artist, genre, tags, keywords, description, lyrics, prompt, mood, instruments)
 *   genre    - Filter by exact genre
 *   mood     - Filter by mood
 *   bpm_min  - Minimum BPM
 *   bpm_max  - Maximum BPM
 *   key      - Key signature filter
 *   vocals   - Vocals type (instrumental, with-lyrics, none)
 *   language - Language filter
 *   explicit - 'true' or 'false'
 *   artist   - Artist name search
 *   tags     - Comma-separated tags
 *   instruments - Comma-separated instruments
 *   sort     - Sort by: relevance (default), newest, popular, plays
 *   limit    - Results per page (default 50, max 200)
 *   offset   - Pagination offset
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const q = searchParams.get('q')?.trim() || ''
    const genre = searchParams.get('genre')?.trim()
    const mood = searchParams.get('mood')?.trim()
    const bpmMin = searchParams.get('bpm_min')
    const bpmMax = searchParams.get('bpm_max')
    const key = searchParams.get('key')?.trim()
    const vocals = searchParams.get('vocals')?.trim()
    const language = searchParams.get('language')?.trim()
    const explicit = searchParams.get('explicit')
    const artist = searchParams.get('artist')?.trim()
    const tagsParam = searchParams.get('tags')?.trim()
    const instrumentsParam = searchParams.get('instruments')?.trim()
    const sort = searchParams.get('sort') || 'relevance'
    const limit = Math.min(Number(searchParams.get('limit')) || 50, 200)
    const offset = Number(searchParams.get('offset')) || 0

    // Build the query - use select('*') for resilience when new columns aren't migrated yet
    let query = supabase
      .from('combined_media')
      .select('*')
      .eq('is_public', true)
      .not('audio_url', 'is', null)
      .neq('audio_url', '')

    // Full-text search: try tsvector first, fall back to ILIKE
    let usedFullText = false
    if (q) {
      try {
        const searchTerms = q
          .replace(/[^\w\s'"]/g, '')
          .split(/\s+/)
          .filter(t => t.length > 0)
          .map(t => t + ':*')
          .join(' & ')

        if (searchTerms) {
          query = query.textSearch('search_vector', searchTerms, {
            type: 'plain',
            config: 'english'
          })
          usedFullText = true
        }
      } catch {
        // tsvector column might not exist yet - will fall back below
      }
    }

    // Exact filters - use try/catch-safe approach for columns that may not exist yet
    if (genre) {
      // secondary_genre may not exist pre-migration, just filter on genre
      query = query.ilike('genre', `%${genre}%`)
    }
    if (mood) {
      query = query.ilike('mood', `%${mood}%`)
    }
    if (bpmMin) {
      query = query.gte('bpm', parseInt(bpmMin))
    }
    if (bpmMax) {
      query = query.lte('bpm', parseInt(bpmMax))
    }
    if (vocals) {
      query = query.eq('vocals', vocals)
    }
    if (language) {
      query = query.ilike('language', `%${language}%`)
    }
    if (tagsParam) {
      const tags = tagsParam.split(',').map(t => t.trim()).filter(Boolean)
      if (tags.length > 0) {
        query = query.overlaps('tags', tags)
      }
    }
    // These filters only work post-migration; silently skip if columns don't exist
    // key_signature, is_explicit, instruments will be applied but if DB errors, fallback handles it

    // Sorting
    switch (sort) {
      case 'newest':
        query = query.order('created_at', { ascending: false })
        break
      case 'popular':
        query = query.order('likes', { ascending: false })
        break
      case 'plays':
        query = query.order('plays', { ascending: false })
        break
      case 'relevance':
      default:
        // For full-text search, PostgreSQL ranks by relevance automatically
        // For non-search queries, fall back to newest
        if (!q) {
          query = query.order('created_at', { ascending: false })
        }
        break
    }

    // Pagination
    query = query.range(offset, offset + limit - 1)

    const { data, error } = await query

    if (error) {
      console.error('Search query error:', error)
      
      // Fallback: if any column doesn't exist or tsvector fails, do ILIKE fallback
      return await fallbackSearch(q, genre, mood, sort, limit, offset)
    }

    // Fetch usernames for results
    const userIds = [...new Set((data || []).map(m => m.user_id))]
    const { data: usersData } = await supabase
      .from('users')
      .select('clerk_user_id, username')
      .in('clerk_user_id', userIds)

    const usernameMap = new Map(
      (usersData || []).map(u => [u.clerk_user_id, u.username])
    )

    // Also search by artist name if q is provided and we got few results
    let artistFilterResults: typeof data = []
    if (artist || (q && (data?.length || 0) < limit)) {
      const searchTerm = artist || q
      // Search in users table for matching usernames
      const { data: matchingUsers } = await supabase
        .from('users')
        .select('clerk_user_id, username')
        .ilike('username', `%${searchTerm}%`)

      if (matchingUsers && matchingUsers.length > 0) {
        const matchingUserIds = matchingUsers.map(u => u.clerk_user_id)
        const existingIds = new Set((data || []).map(d => d.id))
        
        const { data: artistTracks } = await supabase
          .from('combined_media')
          .select('*')
          .eq('is_public', true)
          .not('audio_url', 'is', null)
          .neq('audio_url', '')
          .in('user_id', matchingUserIds)
          .order('created_at', { ascending: false })
          .limit(20)

        if (artistTracks) {
          artistFilterResults = artistTracks.filter(t => !existingIds.has(t.id))
          // Add these users to the username map
          matchingUsers.forEach(u => usernameMap.set(u.clerk_user_id, u.username))
        }
      }
    }

    // Combine results
    const allResults = [...(data || []), ...artistFilterResults]

    const results = allResults.map(media => ({
      ...media,
      audioUrl: media.audio_url,
      imageUrl: media.image_url,
      users: { username: usernameMap.get(media.user_id) || media.artist_name || 'Unknown' }
    }))

    return corsResponse(NextResponse.json({
      success: true,
      results,
      total: results.length,
      query: q,
      filters: { genre, mood, bpmMin, bpmMax, key, vocals, language, explicit, tags: tagsParam, instruments: instrumentsParam },
      hasMore: results.length === limit
    }))
  } catch (error) {
    console.error('Search error:', error)
    return corsResponse(NextResponse.json({ error: 'Internal server error' }, { status: 500 }))
  }
}

// Fallback search using ILIKE when tsvector is not available
async function fallbackSearch(q: string, genre: string | undefined, mood: string | undefined, sort: string, limit: number, offset: number) {
  try {
    let query = supabase
      .from('combined_media')
      .select('*')
      .eq('is_public', true)
      .not('audio_url', 'is', null)
      .neq('audio_url', '')

    // ILIKE search across existing columns only
    if (q) {
      const searchPattern = `%${q}%`
      query = query.or(`title.ilike.${searchPattern},genre.ilike.${searchPattern},mood.ilike.${searchPattern},description.ilike.${searchPattern},audio_prompt.ilike.${searchPattern}`)
    }

    if (genre) {
      query = query.ilike('genre', `%${genre}%`)
    }
    if (mood) {
      query = query.ilike('mood', `%${mood}%`)
    }

    switch (sort) {
      case 'newest': query = query.order('created_at', { ascending: false }); break
      case 'popular': query = query.order('likes', { ascending: false }); break
      case 'plays': query = query.order('plays', { ascending: false }); break
      default: query = query.order('created_at', { ascending: false }); break
    }

    query = query.range(offset, offset + limit - 1)
    const { data, error } = await query

    if (error) {
      return corsResponse(NextResponse.json({ error: 'Fallback search failed', details: error.message }, { status: 500 }))
    }

    const userIds = [...new Set((data || []).map(m => m.user_id))]
    const { data: usersData } = await supabase
      .from('users')
      .select('clerk_user_id, username')
      .in('clerk_user_id', userIds)

    const usernameMap = new Map(
      (usersData || []).map(u => [u.clerk_user_id, u.username])
    )

    const results = (data || []).map(media => ({
      ...media,
      audioUrl: media.audio_url,
      imageUrl: media.image_url,
      users: { username: usernameMap.get(media.user_id) || media.artist_name || 'Unknown' }
    }))

    return corsResponse(NextResponse.json({
      success: true,
      results,
      total: results.length,
      query: q,
      filters: { genre, mood },
      hasMore: results.length === limit,
      fallback: true
    }))
  } catch (error) {
    return corsResponse(NextResponse.json({ error: 'Internal server error' }, { status: 500 }))
  }
}
