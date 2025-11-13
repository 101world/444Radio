import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { corsResponse, handleOptions } from '@/lib/cors'

export async function OPTIONS() {
  return handleOptions()
}

/**
 * GET /api/library/all
 * Get all content (music + images) from user's library, combined and sorted
 */
export async function GET() {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return corsResponse(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

    // Fetch music library
    const musicResponse = await fetch(
      `${supabaseUrl}/rest/v1/music_library?clerk_user_id=eq.${userId}&order=created_at.desc`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        }
      }
    )

    // Fetch images library
    const imagesResponse = await fetch(
      `${supabaseUrl}/rest/v1/images_library?clerk_user_id=eq.${userId}&order=created_at.desc`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        }
      }
    )

    const music = await musicResponse.json()
    const images = await imagesResponse.json()

    // Ensure arrays
    const musicArray = Array.isArray(music) ? music : []
    const imagesArray = Array.isArray(images) ? images : []

    // Add type field to each item
    const musicWithType = musicArray.map(item => ({ ...item, type: 'music' }))
    const imagesWithType = imagesArray.map(item => ({ ...item, type: 'image' }))

    // Combine and sort by created_at
    const combined = [...musicWithType, ...imagesWithType].sort((a, b) => {
      const dateA = new Date(a.created_at).getTime()
      const dateB = new Date(b.created_at).getTime()
      return dateB - dateA // Descending order (newest first)
    })

    return corsResponse(NextResponse.json({
      success: true,
      items: combined,
      counts: {
        music: musicArray.length,
        images: imagesArray.length,
        total: combined.length
      }
    }))

  } catch (error) {
    console.error('Error fetching library:', error)
    return corsResponse(NextResponse.json(
      { error: 'Failed to fetch library' },
      { status: 500 }
    ))
  }
}
