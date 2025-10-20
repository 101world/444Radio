import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'
import { uploadToR2 } from '@/lib/r2-upload'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET - Fetch artist's private lists
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth()
    const { searchParams } = new URL(req.url)
    const artistId = searchParams.get('artistId')

    if (!artistId) {
      return NextResponse.json({ error: 'Artist ID required' }, { status: 400 })
    }

    // Fetch all active lists for this artist
    const { data: lists, error: listsError } = await supabase
      .from('private_lists')
      .select('*')
      .eq('artist_id', artistId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (listsError) {
      console.error('Error fetching lists:', listsError)
      return NextResponse.json({ error: 'Failed to fetch lists' }, { status: 500 })
    }

    // Get member counts and check if current user is a member
    const listsWithDetails = await Promise.all(
      (lists || []).map(async (list) => {
        const { count } = await supabase
          .from('private_list_members')
          .select('*', { count: 'exact', head: true })
          .eq('list_id', list.id)

        let isMember = false
        if (userId) {
          const { data: membership } = await supabase
            .from('private_list_members')
            .select('id')
            .eq('list_id', list.id)
            .eq('user_id', userId)
            .single()

          isMember = !!membership
        }

        return {
          ...list,
          member_count: count || 0,
          is_member: isMember
        }
      })
    )

    return NextResponse.json({ success: true, lists: listsWithDetails })
  } catch (error) {
    console.error('Error in GET /api/private-lists:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Create new private list
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await req.formData()
    const title = formData.get('title') as string
    const description = formData.get('description') as string
    const location = formData.get('location') as string
    const event_date = formData.get('event_date') as string
    const price_credits = parseInt(formData.get('price_credits') as string) || 0
    const max_capacity = parseInt(formData.get('max_capacity') as string) || 100
    const hype_text = formData.get('hype_text') as string
    const requirements = formData.get('requirements') as string
    const coverImage = formData.get('cover_image') as File | null
    const videoFile = formData.get('video') as File | null

    if (!title || !location) {
      return NextResponse.json({ error: 'Title and location are required' }, { status: 400 })
    }

    let coverImageUrl = null
    let videoUrl = null

    // Upload cover image to R2
    if (coverImage) {
      const imageKey = `private-lists/${userId}/${Date.now()}-${coverImage.name}`
      const imageUpload = await uploadToR2(coverImage, 'images', imageKey)
      if (imageUpload.success) {
        coverImageUrl = imageUpload.url
      }
    }

    // Upload video to R2
    if (videoFile) {
      const videoKey = `private-lists/${userId}/${Date.now()}-${videoFile.name}`
      const videoUpload = await uploadToR2(videoFile, 'videos', videoKey)
      if (videoUpload.success) {
        videoUrl = videoUpload.url
      }
    }

    const { data, error } = await supabase
      .from('private_lists')
      .insert([{
        artist_id: userId,
        title,
        description: description || null,
        location,
        event_date: event_date || null,
        price_credits,
        max_capacity,
        cover_image_url: coverImageUrl,
        video_url: videoUrl,
        hype_text: hype_text || null,
        requirements: requirements || null,
        is_active: true
      }])
      .select()
      .single()

    if (error) {
      console.error('Error creating list:', error)
      return NextResponse.json({ error: 'Failed to create list' }, { status: 500 })
    }

    return NextResponse.json({ success: true, list: data })
  } catch (error) {
    console.error('Error in POST /api/private-lists:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
