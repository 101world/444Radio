import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

/**
 * GET /api/library/music
 * Get all music files from user's library
 */
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

    // Fetch user's music library
    const response = await fetch(
      `${supabaseUrl}/rest/v1/music_library?clerk_user_id=eq.${userId}&order=created_at.desc`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        }
      }
    )

    const music = await response.json()

    // Ensure it's always an array
    const musicArray = Array.isArray(music) ? music : []

    return NextResponse.json({
      success: true,
      music: musicArray
    })

  } catch (error) {
    console.error('Error fetching music library:', error)
    return NextResponse.json(
      { error: 'Failed to fetch music library' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/library/music?id=xxx
 * Delete a music file from library
 */
export async function DELETE(req: NextRequest) {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Missing music ID' }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

    // Delete from music_library
    await fetch(
      `${supabaseUrl}/rest/v1/music_library?id=eq.${id}&clerk_user_id=eq.${userId}`,
      {
        method: 'DELETE',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        }
      }
    )

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Error deleting music:', error)
    return NextResponse.json(
      { error: 'Failed to delete music' },
      { status: 500 }
    )
  }
}
