import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params

    // Fetch user's combined media (music + image)
    const { data: combinedData, error: combinedError } = await supabase
      .from('combined_media')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (combinedError) {
      console.error('Combined media error:', combinedError)
    }

    // Fetch user's profile media (standalone images/videos)
    const { data: profileData, error: profileError } = await supabase
      .from('profile_media')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (profileError) {
      console.error('Profile media error:', profileError)
    }

    // Fetch user's uploads (images and videos)
    const { data: uploadsData, error: uploadsError } = await supabase
      .from('user_uploads')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (uploadsError) {
      console.error('Uploads error:', uploadsError)
    }

    // Fetch user profile basics (including banner fields)
    const { data: userData } = await supabase
      .from('users')
      .select('username, avatar_url, bio, tagline, banner_url, banner_type')
      .eq('clerk_user_id', userId)
      .single()

    // Combine all media with type indicator
    const allMedia = [
      ...(combinedData || []).map((item) => ({ ...item, media_type: 'music-image' })),
      ...(profileData || []).map((item) => ({ ...item, media_type: item.content_type }))
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    // Format uploads data
    const uploads = (uploadsData || []).map((item) => ({
      id: item.id,
      type: item.content_type?.startsWith('video/') ? 'video' : 'image',
      url: item.url,
      thumbnail_url: item.thumbnail_url,
      title: item.title,
      created_at: item.created_at,
      file_size: item.file_size
    }))

    return NextResponse.json({
      success: true,
      combinedMedia: allMedia,
      uploads: uploads,
      username: userData?.username || 'Unknown User',
      avatar: userData?.avatar_url || null,
      bio: userData?.bio || null,
      tagline: userData?.tagline || null,
      banner_url: userData?.banner_url || null,
      banner_type: userData?.banner_type || null,
      trackCount: allMedia.length,
      totalPlays: allMedia.reduce((sum, media) => sum + (media.plays || media.views || 0), 0)
    })
  } catch (error) {
    console.error('Error fetching user media:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
