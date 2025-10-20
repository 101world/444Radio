import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

/**
 * GET /api/library/combined
 * Get all combined media from user's library
 */
export async function GET(req: NextRequest) {
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
 * Delete a combined media from library
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
    } = await req.json()

    if (!combinedId) {
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
            audio_url: combined.audio_url,
            image_url: combined.image_url,
            audio_prompt: combined.music_prompt || '',
            image_prompt: combined.image_prompt || '',
            title: combined.title || 'Untitled',
            genre: combined.genre,
            mood: combined.mood,
            bpm: combined.bpm,
            key: combined.key,
            copyright_owner: combined.copyright_owner,
            license_type: combined.license_type,
            price: combined.price,
            tags: combined.tags,
            is_public: true
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

