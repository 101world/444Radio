import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { handleOptions, corsResponse } from '@/lib/cors'

// Route verified working - Jan 20, 2026
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function OPTIONS() {
  return handleOptions()
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const limit = Number(searchParams.get('limit')) || 500 // Increased to show all tracks
    const offset = Number(searchParams.get('offset')) || 0

    // Fetch ONLY properly released tracks
    // Real releases always have audio_url AND (image_url OR video_url)
    // Tool outputs (effects, boosts, stems, loops, video-to-audio) never have image_url or video_url
    //
    // Supabase PostgREST doesn't support OR across columns natively,
    // so we use the `or` filter: must have cover art OR a visualizer video.
    const { data, error } = await supabase
      .from('combined_media')
      .select('*')
      // Only show explicitly released tracks
      .eq('is_public', true)
      // Must have audio
      .not('audio_url', 'is', null)
      .neq('audio_url', '')
      // Must have cover art OR a visualizer video — this ensures proper releases only
      .or('and(image_url.not.is.null,image_url.neq.),and(video_url.not.is.null,video_url.neq.)')
      // Exclude internal tool genres + standalone visualizers (safety net)
      .not('genre', 'in', '(stem,effects,loop,boosted,visualizer)')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('❌ Database error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch combined media', details: error.message },
        { status: 500 }
      )
    }

    console.log(`✅ Explore API: Fetched ${data?.length || 0} public tracks (is_public=true)`)
    if (data && data.length > 0) {
      console.log(`📊 First track: "${data[0].title}" by ${data[0].user_id}`)
      console.log(`📊 Last track: "${data[data.length - 1].title}" by ${data[data.length - 1].user_id}`)
      
      // Log unique user count
      const uniqueUsers = new Set(data.map(d => d.user_id))
      console.log(`📊 Total unique users: ${uniqueUsers.size}`)
      
      // Log count per user
      const userCounts = new Map()
      data.forEach(d => {
        userCounts.set(d.user_id, (userCounts.get(d.user_id) || 0) + 1)
      })
      console.log(`📊 Tracks per user:`, Object.fromEntries(userCounts))
    } else {
      console.warn('⚠️ No tracks returned! Check if is_public is set to true in database.')
    }

    // Fetch usernames and avatars for all user_ids
    const userIds = [...new Set((data || []).map(m => m.user_id))]
    const { data: usersData } = await supabase
      .from('users')
      .select('clerk_user_id, username, avatar_url')
      .in('clerk_user_id', userIds)

    // Create user data lookup map
    const userDataMap = new Map(
      (usersData || []).map(u => [u.clerk_user_id, { username: u.username, avatar_url: u.avatar_url }])
    )

    // Add username and avatar to each media item and normalize field names
    // IMPORTANT: strip track_id_444 — it's private to the owner / buyer only
    const mediaWithUsers = (data || []).map((media) => {
      const userData = userDataMap.get(media.user_id)
      const username = userData?.username || 'Unknown User'
      const avatar_url = userData?.avatar_url || null
      const { track_id_444, ...publicMedia } = media
      
      return {
        ...publicMedia,
        audioUrl: media.audio_url, // Normalize for AudioPlayerContext
        imageUrl: media.image_url, // Normalize for AudioPlayerContext
        video_url: media.video_url || null, // Ensure video_url is always present
        users: { username, avatar_url }
      }
    })

    return corsResponse(NextResponse.json({
      success: true,
      combinedMedia: mediaWithUsers
    }))
  } catch (error) {
    console.error('Fetch explore error:', error)
    return corsResponse(NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    ))
  }
}

