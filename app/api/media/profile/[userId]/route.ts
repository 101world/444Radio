import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { clerkClient } from '@clerk/nextjs/server'

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
    // Shows ALL user tracks regardless of is_public status
    const { data: combinedData, error: combinedError } = await supabase
      .from('combined_media')
      .select('*')
      .eq('user_id', userId)
      // NO .eq('is_public', true) - shows everything
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

    // Note: user_uploads table doesn't exist, using combined_media instead

    // Fetch user profile basics (including banner fields)
    const { data: userData } = await supabase
      .from('users')
      .select('username, avatar_url, bio, tagline, banner_url, banner_type')
      .eq('clerk_user_id', userId)
      .single()

    // If no user found, create one with minimal data
    if (!userData) {
      await supabase
        .from('users')
        .insert({
          clerk_user_id: userId,
          email: '',
          username: null,
          credits: 0
        })
    }

    // If username or avatar is missing in Supabase, fetch from Clerk and sync
    let finalUsername = userData?.username
    let finalAvatar = userData?.avatar_url
    if (!finalUsername || !finalAvatar) {
      try {
        const client = await clerkClient()
        const clerkUser = await client.users.getUser(userId)
        finalUsername = clerkUser.username || clerkUser.firstName || 'User'
        // Try to fetch profile image from Clerk
        const clerkProfileImage = (clerkUser as any).profileImageUrl || (clerkUser as any).imageUrl || null
        finalAvatar = finalAvatar || clerkProfileImage || null
        
        // Sync the username/avatar to Supabase for future lookups
        const updatePayload: any = {}
        if (clerkUser.username) updatePayload.username = clerkUser.username
        if (clerkProfileImage) updatePayload.avatar_url = clerkProfileImage
        if (Object.keys(updatePayload).length > 0) {
          await supabase
            .from('users')
            .update(updatePayload)
            .eq('clerk_user_id', userId)
        }
      } catch (clerkError) {
        console.error('Error fetching from Clerk:', clerkError)
        finalUsername = 'User'
      }
    }

    // Combine all media with type indicator and normalize field names
    const allMedia = [
      ...(combinedData || []).map((item) => ({ 
        ...item, 
        media_type: 'music-image',
        audioUrl: item.audio_url, // Normalize for AudioPlayerContext
        imageUrl: item.image_url, // Normalize for AudioPlayerContext
      })),
      ...(profileData || []).map((item) => ({ ...item, media_type: item.content_type }))
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    return NextResponse.json({
      success: true,
      combinedMedia: allMedia,
      uploads: [], // user_uploads table doesn't exist, using combined_media instead
      username: finalUsername,
      avatar: userData?.avatar_url || finalAvatar || null,
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
