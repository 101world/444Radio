import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { corsResponse, handleOptions } from '@/lib/cors'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

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

export async function OPTIONS() {
  return handleOptions()
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const filter = searchParams.get('filter') || 'trending'
    const genre = searchParams.get('genre') || ''
    const q = searchParams.get('q') || ''

    // Build query for tracks listed on earn marketplace
    let query = `combined_media?listed_on_earn=eq.true&select=id,title,audio_url,image_url,user_id,genre,secondary_genre,plays,likes,downloads,created_at,earn_price,artist_share,admin_share,mood,bpm,key_signature,vocals,language,tags,description,instruments,is_explicit,duration_seconds`

    // Genre filter
    if (genre) {
      query += `&genre=ilike.*${encodeURIComponent(genre)}*`
    }

    // Search — title is filtered server-side, username/genre filtering happens client-side
    // since username lives in the users table, not combined_media
    if (q) {
      // Don't filter server-side so artist name search works client-side
    }

    // Sort
    switch (filter) {
      case 'most_downloaded':
        query += '&order=downloads.desc.nullslast'
        break
      case 'latest':
        query += '&order=created_at.desc'
        break
      case 'trending':
      default:
        query += '&order=plays.desc.nullslast'
        break
    }

    query += '&limit=100'

    const res = await supabaseRest(query)
    const tracks = await res.json()

    // If column doesn't exist OR no tracks are listed, use fallback
    if (!res.ok || !tracks || tracks.length === 0) {
      // Return all public tracks as fallback
      const fallbackQuery = `combined_media?select=id,title,audio_url,image_url,user_id,genre,secondary_genre,plays,likes,downloads,created_at,mood,bpm,key_signature,vocals,language,tags,description,instruments,is_explicit,duration_seconds&is_public=eq.true&order=plays.desc.nullslast&limit=50`
      const fallbackRes = await supabaseRest(fallbackQuery)
      const fallbackTracks = await fallbackRes.json()

      // Fetch usernames for each unique user_id
      const userIds = [...new Set((fallbackTracks || []).map((t: any) => t.user_id))]
      const usersQuery = `users?clerk_user_id=in.(${userIds.join(',')})`
      const usersRes = await supabaseRest(usersQuery + '&select=clerk_user_id,username,avatar_url')
      const users = await usersRes.json()
      const userMap = new Map<string, any>((users || []).map((u: any) => [u.clerk_user_id, u]))

      const enrichedTracks = (fallbackTracks || []).map((t: any) => {
        const userInfo = userMap.get(t.user_id)
        return {
          ...t,
          username: userInfo?.username || 'Unknown',
          avatar_url: userInfo?.avatar_url || null,
          downloads: t.downloads || 0,
          listed_on_earn: true,
          earn_price: 5,
          artist_share: 1,
          admin_share: 4,
        }
      })

      // Extract genres
      const genreSet = new Set<string>()
      enrichedTracks.forEach((t: any) => { if (t.genre) genreSet.add(t.genre) })

      return corsResponse(NextResponse.json({
        success: true,
        tracks: enrichedTracks,
        genres: Array.from(genreSet).sort()
      }))
    }

    // Fetch usernames
    const userIds = [...new Set(tracks.map((t: any) => t.user_id))]
    let userMap = new Map<string, any>()

    if (userIds.length > 0) {
      const usersRes = await supabaseRest(
        `users?clerk_user_id=in.(${userIds.join(',')})`+ '&select=clerk_user_id,username,avatar_url'
      )
      const users = await usersRes.json()
      userMap = new Map((users || []).map((u: any) => [u.clerk_user_id, u]))
    }

    const enrichedTracks = tracks.map((t: any) => {
      const userInfo = userMap.get(t.user_id)
      return {
        ...t,
        username: userInfo?.username || 'Unknown',
        avatar_url: userInfo?.avatar_url || null,
        downloads: t.downloads || 0,
        earn_price: t.earn_price || 5,
        artist_share: t.artist_share || 1,
        admin_share: t.admin_share || 4,
      }
    })

    // ── Enrich bare tracks with metadata from their released sibling ──
    // Some tracks were listed on Earn before being released, so their
    // combined_media record has NULL genre/mood/bpm while a separate
    // "released" record (same audio_url, same user) has full metadata.
    const bareTracks = enrichedTracks.filter((t: any) => !t.genre && t.audio_url)
    if (bareTracks.length > 0) {
      try {
        const bareAudioUrls = bareTracks.map((t: any) => `"${t.audio_url}"`).join(',')
        const siblingsRes = await supabaseRest(
          `combined_media?audio_url=in.(${bareAudioUrls})&genre=not.is.null&listed_on_earn=not.eq.true&select=audio_url,user_id,genre,secondary_genre,mood,bpm,key_signature,vocals,language,description,instruments,tags,is_explicit,duration_seconds,artist_name,featured_artists,contributors,songwriters,copyright_holder,copyright_year,record_label,publisher,release_type,version_tag,image_url`
        )
        if (siblingsRes.ok) {
          const siblings = await siblingsRes.json()
          // Build map: audio_url+user_id → sibling with metadata
          const sibMap = new Map<string, any>()
          for (const s of (siblings || [])) {
            const key = `${s.audio_url}|${s.user_id}`
            if (!sibMap.has(key)) sibMap.set(key, s)
          }
          // Merge into bare tracks
          const metaFields = [
            'genre', 'secondary_genre', 'mood', 'bpm', 'key_signature', 'vocals',
            'language', 'description', 'instruments', 'tags', 'is_explicit',
            'duration_seconds', 'artist_name', 'featured_artists', 'contributors',
            'songwriters', 'copyright_holder', 'copyright_year', 'record_label',
            'publisher', 'release_type', 'version_tag'
          ]
          for (const t of bareTracks) {
            const sib = sibMap.get(`${t.audio_url}|${t.user_id}`)
            if (sib) {
              for (const f of metaFields) {
                if (sib[f] != null && t[f] == null) {
                  t[f] = sib[f]
                }
              }
              if (sib.image_url && !t.image_url) t.image_url = sib.image_url
            }
          }
        }
      } catch (e) {
        console.warn('[EARN-TRACKS] Sibling metadata enrichment failed:', e)
      }
    }

    // Extract genres
    const genreSet = new Set<string>()
    enrichedTracks.forEach((t: any) => { if (t.genre) genreSet.add(t.genre) })

    return corsResponse(NextResponse.json({
      success: true,
      tracks: enrichedTracks,
      genres: Array.from(genreSet).sort()
    }))

  } catch (error) {
    console.error('Earn tracks error:', error)
    return corsResponse(NextResponse.json({ success: false, error: 'Failed to fetch tracks' }, { status: 500 }))
  }
}
