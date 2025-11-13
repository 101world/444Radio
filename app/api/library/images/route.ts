import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

/**
 * GET /api/library/images
 * Get all images from user's library
 */
export async function GET() {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

    // Fetch user's images library (with explicit limit to get all)
    const response = await fetch(
      `${supabaseUrl}/rest/v1/images_library?clerk_user_id=eq.${userId}&order=created_at.desc&limit=1000`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Prefer': 'count=exact'
        }
      }
    )

    const images = await response.json()
    const totalCount = response.headers.get('Content-Range')?.split('/')[1] || '0'

    // Ensure it's always an array
    const imageArray = Array.isArray(images) ? images : []

    console.log(`📸 Images Library: Fetched ${imageArray.length} images (total: ${totalCount})`)

    return NextResponse.json({
      success: true,
      images: imageArray,
      total: parseInt(totalCount)
    })

  } catch (error) {
    console.error('Error fetching images library:', error)
    return NextResponse.json(
      { error: 'Failed to fetch images library' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/library/images?id=xxx
 * Delete an image from library and all related combined media
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
      return NextResponse.json({ error: 'Missing image ID' }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

    // First, get the image_url from images_library to find related records
    const getResponse = await fetch(
      `${supabaseUrl}/rest/v1/images_library?id=eq.${id}&clerk_user_id=eq.${userId}&select=image_url`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        }
      }
    )
    
    const imageData = await getResponse.json()
    const imageUrl = Array.isArray(imageData) && imageData.length > 0 ? imageData[0].image_url : null

    // Delete from images_library
    await fetch(
      `${supabaseUrl}/rest/v1/images_library?id=eq.${id}&clerk_user_id=eq.${userId}`,
      {
        method: 'DELETE',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        }
      }
    )

    // If we found the image_url, also delete from combined_media table (published releases)
    // Note: Only delete if it's a standalone image (no audio_url), otherwise keep the release
    if (imageUrl) {
      await fetch(
        `${supabaseUrl}/rest/v1/combined_media?image_url=eq.${encodeURIComponent(imageUrl)}&user_id=eq.${userId}&audio_url=is.null`,
        {
          method: 'DELETE',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          }
        }
      )

      // Also delete from combined_media_library where image is used alone
      await fetch(
        `${supabaseUrl}/rest/v1/combined_media_library?image_url=eq.${encodeURIComponent(imageUrl)}&clerk_user_id=eq.${userId}&audio_url=is.null`,
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
    console.error('Error deleting image:', error)
    return NextResponse.json(
      { error: 'Failed to delete image' },
      { status: 500 }
    )
  }
}

