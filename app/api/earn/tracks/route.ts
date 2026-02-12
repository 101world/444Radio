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
    let query = `combined_media?listed_on_earn=eq.true&select=id,title,audio_url,image_url,user_id,genre,plays,likes,downloads,created_at,earn_price,artist_share,admin_share`

    // Genre filter
    if (genre) {
      query += `&genre=ilike.*${encodeURIComponent(genre)}*`
    }

    // Search
    if (q) {
      query += `&or=(title.ilike.*${encodeURIComponent(q)}*)`
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

    if (!res.ok) {
      // If listed_on_earn column doesn't exist yet, return all tracks as fallback
      const fallbackQuery = `combined_media?select=id,title,audio_url,image_url,user_id,genre,plays,likes,downloads,created_at&is_public=eq.true&order=plays.desc.nullslast&limit=50`
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
          earn_price: 4,
          artist_share: 2,
          admin_share: 2,
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
        earn_price: t.earn_price || 4,
        artist_share: t.artist_share || 2,
        admin_share: t.admin_share || 2,
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

  } catch (error) {
    console.error('Earn tracks error:', error)
    return corsResponse(NextResponse.json({ success: false, error: 'Failed to fetch tracks' }, { status: 500 }))
  }
}
