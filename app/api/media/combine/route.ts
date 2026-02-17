import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabase as supabaseClient } from '@/lib/supabase'
import { createClient } from '@supabase/supabase-js'
import { logCreditTransaction } from '@/lib/credit-transactions'

// Use service role for admin operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const {
      audioUrl,
      imageUrl,
      videoUrl,
      title,
      audioPrompt,
      imagePrompt,
      isPublic,
      metadata
    } = await req.json()

    console.log('🔍 [COMBINE DEBUG] Title received:', title)
    console.log('🔍 [COMBINE DEBUG] Full request body:', JSON.stringify({ audioUrl, imageUrl, videoUrl, title, audioPrompt, imagePrompt, isPublic, metadata }, null, 2))

    if (!audioUrl || (!imageUrl && !videoUrl)) {
      return NextResponse.json(
        { error: 'Audio URL and either Image URL or Video URL are required' },
        { status: 400 }
      )
    }

    // Extract metadata fields (basic - always exist)
    const genre = metadata?.genre || null
    const mood = metadata?.mood || null
    const bpm = metadata?.bpm || null
    const vocals = metadata?.vocals || null
    const language = metadata?.language || null
    const description = metadata?.description || null
    const tags = metadata?.tags || []

    // Build insert object - start with required fields
    const insertData: Record<string, unknown> = {
      user_id: userId,
      audio_url: audioUrl,
      image_url: imageUrl || null,
      title: title || 'Untitled Track',
      genre,
      mood,
      bpm,
      vocals,
      language,
      description,
      tags,
      created_at: new Date().toISOString(),
      likes: 0,
      plays: 0,
    }

    // Attach video URL for Spotify Canvas–style looping on Explore
    if (videoUrl) {
      insertData.video_url = videoUrl
    }

    // ─── Block purchased tracks from re-release ───
    // Check if this audio_url was purchased from Earn
    const { data: purchaseCheck } = await supabase
      .from('music_library')
      .select('prompt')
      .eq('audio_url', audioUrl)
      .eq('user_id', userId)
      .single()
    if (purchaseCheck?.prompt?.toLowerCase().includes('purchased from earn')) {
      return NextResponse.json(
        { error: 'Purchased tracks cannot be released. Only your original creations can be released on 444Radio.' },
        { status: 403 }
      )
    }

    // Distribution-quality metadata (post-migration fields)
    // These are added conditionally - if column doesn't exist yet, the insert still works for core fields
    if (metadata?.secondary_genre) insertData.secondary_genre = metadata.secondary_genre
    if (metadata?.mood_tags?.length) insertData.mood_tags = metadata.mood_tags
    if (metadata?.key_signature) insertData.key_signature = metadata.key_signature
    if (metadata?.instruments?.length) insertData.instruments = metadata.instruments
    if (metadata?.keywords?.length) insertData.keywords = metadata.keywords
    if (metadata?.artist_name) insertData.artist_name = metadata.artist_name
    if (metadata?.featured_artists?.length) insertData.featured_artists = metadata.featured_artists
    if (metadata?.release_type) insertData.release_type = metadata.release_type
    if (metadata?.version_tag) insertData.version_tag = metadata.version_tag
    if (metadata?.is_explicit !== undefined) insertData.is_explicit = metadata.is_explicit
    if (metadata?.is_cover !== undefined) insertData.is_cover = metadata.is_cover
    if (metadata?.lyrics) insertData.lyrics = metadata.lyrics
    if (metadata?.copyright_holder) insertData.copyright_holder = metadata.copyright_holder
    if (metadata?.copyright_year) insertData.copyright_year = metadata.copyright_year
    if (metadata?.pro_affiliation) insertData.pro_affiliation = metadata.pro_affiliation
    if (metadata?.territories?.length) insertData.territories = metadata.territories
    if (metadata?.release_date) insertData.release_date = metadata.release_date
    if (metadata?.songwriters?.length) insertData.songwriters = metadata.songwriters
    if (metadata?.contributors?.length) insertData.contributors = metadata.contributors

    // 444 Ownership Protocol — hardcode label/publisher + accept new fields
    insertData.record_label = '444 Radio'
    insertData.publisher = '444 Radio'
    if (metadata?.energy_level != null) insertData.energy_level = metadata.energy_level
    if (metadata?.danceability != null) insertData.danceability = metadata.danceability
    if (metadata?.tempo_feel) insertData.tempo_feel = metadata.tempo_feel
    if (metadata?.atmosphere) insertData.atmosphere = metadata.atmosphere
    if (metadata?.era_vibe) insertData.era_vibe = metadata.era_vibe
    if (metadata?.license_type_444) insertData.license_type_444 = metadata.license_type_444
    if (metadata?.remix_allowed !== undefined) insertData.remix_allowed = metadata.remix_allowed
    if (metadata?.derivative_allowed !== undefined) insertData.derivative_allowed = metadata.derivative_allowed
    if (metadata?.prompt_visibility) insertData.prompt_visibility = metadata.prompt_visibility
    if (metadata?.creation_type) insertData.creation_type = metadata.creation_type
    if (metadata?.metadata_strength != null) insertData.metadata_strength = metadata.metadata_strength
    if (metadata?.parent_track_id) insertData.parent_track_id = metadata.parent_track_id

    // Insert combined media into database with full metadata
    const { data, error } = await supabase
      .from('combined_media')
      .insert(insertData)
      .select()
      .single()

    if (error) {
      console.error('Database error:', error)
      console.error('Full error details:', JSON.stringify(error, null, 2))
      console.error('Attempted insert data:', {
        user_id: userId,
        audio_url: audioUrl,
        image_url: imageUrl,
        title: title || 'Untitled Track',
        created_at: new Date().toISOString(),
        likes: 0,
        plays: 0
      })
      return NextResponse.json(
        { error: 'Failed to save combined media', details: error.message, code: error.code },
        { status: 500 }
      )
    }

    // Log release as a transaction (0 cost — just for the record)
    logCreditTransaction({
      userId,
      amount: 0,
      type: 'release',
      description: `Released: ${data.title || 'Untitled'}`,
      metadata: {
        trackId: data.id,
        trackId444: data.track_id_444 || null,
        title: data.title,
        genre: data.genre,
        artist_name: data.artist_name,
        featured_artists: data.featured_artists,
        contributors: data.contributors,
      },
    }).catch(() => {}) // fire-and-forget

    // Track quest progress — "Social Butterfly" (share_tracks) quest
    const { trackQuestProgress } = await import('@/lib/quest-progress')
    trackQuestProgress(userId, 'share_tracks').catch(() => {})

    return NextResponse.json({
      success: true,
      combinedMedia: {
        ...data,
        audioUrl: data.audio_url,
        imageUrl: data.image_url
      },
      combinedId: data.id,
      message: 'Combined media saved successfully!'
    })
  } catch (error) {
    console.error('Save combined media error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// GET endpoint to fetch user's combined media
export async function GET() {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('combined_media')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch combined media' },
        { status: 500 }
      )
    }

    // Normalize field names for AudioPlayerContext compatibility
    const normalizedData = (data || []).map((item: any) => ({
      ...item,
      audioUrl: item.audio_url,
      imageUrl: item.image_url
    }))

    return NextResponse.json({
      success: true,
      combinedMedia: normalizedData
    })
  } catch (error) {
    console.error('Fetch combined media error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
