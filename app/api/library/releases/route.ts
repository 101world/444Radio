import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { corsResponse, handleOptions } from '@/lib/cors'

export async function OPTIONS() {
  return handleOptions()
}

/**
 * GET /api/library/releases
 * Get all published releases (tracks with both audio and image) from user's library
 */
export async function GET() {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return corsResponse(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

    // Fetch published releases from BOTH tables
    // Note: We fetch items with EITHER is_published=true OR is_public=true to catch all releases
    const [combinedMediaResponse, libraryResponse] = await Promise.all([
      // combined_media - items with both audio and image, uses user_id
      // Fetch all items with audio+image, then filter by is_published OR is_public in code
      fetch(
        `${supabaseUrl}/rest/v1/combined_media?user_id=eq.${userId}&audio_url=not.is.null&image_url=not.is.null&order=created_at.desc`,
        {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          }
        }
      ),
      // combined_media_library - uses clerk_user_id
      fetch(
        `${supabaseUrl}/rest/v1/combined_media_library?clerk_user_id=eq.${userId}&order=created_at.desc`,
        {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          }
        }
      )
    ])

    const combinedMediaData = await combinedMediaResponse.json()
    const libraryData = await libraryResponse.json()

    // Transform combined_media format - only include items that are published (is_published=true OR is_public=true)
    const combinedReleases = Array.isArray(combinedMediaData) 
      ? combinedMediaData
          .filter(item => item.is_published === true || item.is_public === true)
          .map(item => ({
            id: item.id,
            clerk_user_id: item.user_id,
            title: item.title || 'Untitled',
            music_prompt: item.audio_prompt || item.music_prompt,
            image_prompt: item.image_prompt,
            audio_url: item.audio_url,
            image_url: item.image_url,
            lyrics: item.lyrics,
            is_published: true,
            created_at: item.created_at,
            updated_at: item.updated_at
          }))
      : []

    // Transform combined_media_library format - only include published items
    const libraryReleases = Array.isArray(libraryData) 
      ? libraryData
          .filter(item => item.is_published === true || item.is_public === true)
          .map(item => ({
            id: item.id,
            clerk_user_id: item.clerk_user_id,
            title: item.title || 'Untitled',
            music_prompt: item.music_prompt,
            image_prompt: item.image_prompt,
            audio_url: item.audio_url,
            image_url: item.image_url,
            lyrics: item.lyrics,
            is_published: true,
            created_at: item.created_at,
            updated_at: item.updated_at
          }))
      : []

    // Combine and deduplicate by audio_url
    const allReleases = [...combinedReleases, ...libraryReleases]
    const uniqueReleases = Array.from(
      new Map(allReleases.map(item => [item.audio_url, item])).values()
    )

    console.log(`🎵 Releases: Fetched ${uniqueReleases.length} published releases`)

    return corsResponse(NextResponse.json({
      success: true,
      releases: uniqueReleases,
      total: uniqueReleases.length
    }))

  } catch (error) {
    console.error('Error fetching releases:', error)
    return corsResponse(NextResponse.json(
      { error: 'Failed to fetch releases' },
      { status: 500 }
    ))
  }
}
