import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

/**
 * GET /api/library/combined
 * Get all combined media from user's library
 */
export async function GET() {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

    // Fetch user's combined media library
    const response = await fetch(
      `${supabaseUrl}/rest/v1/combined_media_library?clerk_user_id=eq.${userId}&order=created_at.desc`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        }
      }
    )

    const combined = await response.json()
    const combinedArray = Array.isArray(combined) ? combined : []

    return NextResponse.json({
      success: true,
      combined: combinedArray
    })

  } catch (error) {
    console.error('Error fetching combined media library:', error)
    return NextResponse.json(
      { error: 'Failed to fetch combined media library' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/library/combined
 * Create a new combined media entry
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { music_id, image_id, audio_url, image_url, music_prompt, image_prompt, title } = await req.json()

    if (!audio_url || !image_url) {
      return NextResponse.json(
        { error: 'Missing required fields: audio_url, image_url' },
        { status: 400 }
      )
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

    // Fetch lyrics from music_library if music_id is provided
    let lyrics = null
    if (music_id) {
      const musicResponse = await fetch(
        `${supabaseUrl}/rest/v1/music_library?id=eq.${music_id}&select=lyrics`,
        {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`
          }
        }
      )
      const musicData = await musicResponse.json()
      if (Array.isArray(musicData) && musicData.length > 0 && musicData[0].lyrics) {
        lyrics = musicData[0].lyrics
        console.log('✅ Fetched lyrics from music_library:', lyrics.substring(0, 50) + '...')
      }
    }

    // Save to combined_media_library
    const response = await fetch(
      `${supabaseUrl}/rest/v1/combined_media_library`,
      {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          clerk_user_id: userId,
          music_id,
          image_id,
          audio_url,
          image_url,
          music_prompt,
          image_prompt,
          title,
          lyrics, // Include lyrics from music_library
          is_published: false // Not published to profile yet
        })
      }
    )

    const combined = await response.json()
    console.log('Supabase response:', combined)

    // Check if Supabase returned an error
    if (!response.ok || combined.error || combined.message) {
      console.error('Supabase error:', combined)
      return NextResponse.json(
        { 
          error: combined.message || combined.error || 'Database error',
          details: combined.hint || 'Table may not exist. Run migrations in Supabase SQL Editor.'
        },
        { status: response.status || 500 }
      )
    }

    // Check if we got data back
    if (!Array.isArray(combined) || combined.length === 0) {
      console.error('No data returned from Supabase:', combined)
      return NextResponse.json(
        { error: 'No data returned after insert. Table may not exist.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      combined: combined[0]
    })

  } catch (error) {
    console.error('Error creating combined media:', error)
    return NextResponse.json(
      { error: 'Failed to create combined media' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/library/combined?id=xxx
 * Delete a combined media from library and published releases
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
      return NextResponse.json({ error: 'Missing combined media ID' }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

    // First, get the audio_url and image_url to find related records in combined_media table
    const getResponse = await fetch(
      `${supabaseUrl}/rest/v1/combined_media_library?id=eq.${id}&clerk_user_id=eq.${userId}&select=audio_url,image_url`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        }
      }
    )
    
    const combinedData = await getResponse.json()
    const audioUrl = Array.isArray(combinedData) && combinedData.length > 0 ? combinedData[0].audio_url : null
    const imageUrl = Array.isArray(combinedData) && combinedData.length > 0 ? combinedData[0].image_url : null

    // Delete from combined_media_library
    await fetch(
      `${supabaseUrl}/rest/v1/combined_media_library?id=eq.${id}&clerk_user_id=eq.${userId}`,
      {
        method: 'DELETE',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        }
      }
    )

    // If this was published, also delete from combined_media table (explore/profile pages)
    if (audioUrl && imageUrl) {
      await fetch(
        `${supabaseUrl}/rest/v1/combined_media?audio_url=eq.${encodeURIComponent(audioUrl)}&image_url=eq.${encodeURIComponent(imageUrl)}&user_id=eq.${userId}`,
        {
          method: 'DELETE',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          }
        }
      )
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Error deleting combined media:', error)
    return NextResponse.json(
      { error: 'Failed to delete combined media' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/library/combined
 * Publish combined media to profile/explore with metadata
 */
export async function PATCH(req: NextRequest) {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    console.log('🔍 PATCH Request Body:', body)
    
    const { 
      combinedId,
      is_published, 
      title,
      genre,
      mood,
      bpm,
      key,
      copyright_owner,
      license_type,
      price,
      tags
    } = body

    console.log('🔍 Extracted combinedId:', combinedId)
    console.log('🔍 Extracted metadata:', { title, genre, mood, bpm, key })

    if (!combinedId) {
      console.error('❌ Missing combinedId in request body')
      return NextResponse.json({ error: 'Missing combined media ID' }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

    // Update the combined_media_library record with all metadata
    const response = await fetch(
      `${supabaseUrl}/rest/v1/combined_media_library?id=eq.${combinedId}&clerk_user_id=eq.${userId}`,
      {
        method: 'PATCH',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          is_published: is_published !== undefined ? is_published : true,
          title: title || undefined,
          genre: genre || undefined,
          mood: mood || undefined,
          bpm: bpm || undefined,
          key: key || undefined,
          copyright_owner: copyright_owner || undefined,
          license_type: license_type || undefined,
          price: price || undefined,
          tags: tags || undefined,
          updated_at: new Date().toISOString()
        })
      }
    )

    const updated = await response.json()

    if (!response.ok) {
      console.error('Supabase PATCH error:', updated)
      return NextResponse.json(
        { error: updated.message || 'Failed to update' },
        { status: response.status }
      )
    }

    // Also save to combined_media table for explore page if publishing
    if (is_published && Array.isArray(updated) && updated.length > 0) {
      const combined = updated[0]
      
      // Get username from Clerk for display on explore page
      const { clerkClient } = await import('@clerk/nextjs/server')
      const client = await clerkClient()
      const clerkUser = await client.users.getUser(userId)
      const username = clerkUser?.username || clerkUser?.firstName || clerkUser?.emailAddresses?.[0]?.emailAddress?.split('@')[0] || `user_${userId.slice(-8)}`
      
      // Insert into combined_media table (for Explore/Profile pages)
      await fetch(
        `${supabaseUrl}/rest/v1/combined_media`,
        {
          method: 'POST',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
          },
          body: JSON.stringify({
            user_id: userId,
            username: username,
            audio_url: combined.audio_url,
            image_url: combined.image_url,
            audio_prompt: combined.music_prompt || '',
            image_prompt: combined.image_prompt || '',
            title: combined.title || 'Untitled',
            lyrics: combined.lyrics || null, // Include lyrics
            genre: combined.genre,
            mood: combined.mood,
            bpm: combined.bpm,
            key: combined.key,
            copyright_owner: combined.copyright_owner,
            license_type: combined.license_type,
            price: combined.price,
            tags: combined.tags,
            is_public: true,
            is_published: true
          })
        }
      )
    }

    return NextResponse.json({
      success: true,
      combined: updated[0]
    })

  } catch (error) {
    console.error('Error publishing combined media:', error)
    return NextResponse.json(
      { error: 'Failed to publish combined media' },
      { status: 500 }
    )
  }
}

