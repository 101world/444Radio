import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { corsResponse, handleOptions } from '@/lib/cors'

export async function OPTIONS() {
  return handleOptions()
}

/**
 * GET /api/library/images
 * Get all images from user's library
 */
export async function GET() {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return corsResponse(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

    // Fetch from BOTH tables using both user_id and clerk_user_id
    const [imagesLibraryResponse, combinedMediaResponse] = await Promise.all([
      // images_library - uses clerk_user_id
      fetch(
        `${supabaseUrl}/rest/v1/images_library?clerk_user_id=eq.${userId}&order=created_at.desc&limit=1000`,
        {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          }
        }
      ),
      // combined_media - has image_url, uses user_id column
      fetch(
        `${supabaseUrl}/rest/v1/combined_media?image_url=not.is.null&user_id=eq.${userId}&order=created_at.desc`,
        {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          }
        }
      )
    ])

    const imagesLibraryData = await imagesLibraryResponse.json()
    const combinedMediaData = await combinedMediaResponse.json()

    // Transform images_library format
    const libraryImages = Array.isArray(imagesLibraryData) ? imagesLibraryData : []

    // Transform combined_media format to match images_library
    const combinedImages = Array.isArray(combinedMediaData) ? combinedMediaData.map(item => ({
      id: item.id,
      clerk_user_id: item.user_id,
      title: item.title || 'Untitled',
      prompt: item.image_prompt || 'Generated image',
      image_url: item.image_url,
      created_at: item.created_at,
      updated_at: item.updated_at
    })) : []

    // Combine and deduplicate by image_url
    const allImages = [...libraryImages, ...combinedImages]
    const uniqueImages = Array.from(
      new Map(allImages.map(item => [item.image_url, item])).values()
    )

    console.log(`📸 Images Library: Fetched ${uniqueImages.length} unique images (${libraryImages.length} from library + ${combinedImages.length} from combined_media)`)

    return corsResponse(NextResponse.json({
      success: true,
      images: uniqueImages,
      total: uniqueImages.length
    }))

  } catch (error) {
    console.error('Error fetching images library:', error)
    return corsResponse(NextResponse.json(
      { error: 'Failed to fetch images library' },
      { status: 500 }
    ))
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
      return corsResponse(NextResponse.json({ error: 'Missing image ID' }, { status: 400 }))
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

    return corsResponse(NextResponse.json({ success: true }))

  } catch (error) {
    console.error('Error deleting image:', error)
    return corsResponse(NextResponse.json(
      { error: 'Failed to delete image' },
      { status: 500 }
    ))
  }
}

