import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

/**
 * GET /api/library/bought
 * Get tracks the user purchased from the Earn marketplace.
 * Sources:
 *   1. earn_purchases table (definitive)
 *   2. music_library where prompt contains "Purchased from EARN"
 */
export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

    const headers = {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
    }

    // 1. Get from earn_purchases for this buyer
    const [purchasesRes, musicLibRes] = await Promise.all([
      fetch(
        `${supabaseUrl}/rest/v1/earn_purchases?buyer_id=eq.${userId}&order=created_at.desc&select=*`,
        { headers }
      ),
      fetch(
        `${supabaseUrl}/rest/v1/music_library?clerk_user_id=eq.${userId}&prompt=ilike.*purchased*from*earn*&order=created_at.desc&select=*`,
        { headers }
      ),
    ])

    const purchases = purchasesRes.ok ? await purchasesRes.json() : []
    const musicLib = musicLibRes.ok ? await musicLibRes.json() : []

    // For each purchase, try to get the full track info from combined_media
    const trackIds = Array.isArray(purchases) ? purchases.map((p: any) => p.track_id) : []
    let fullTracks: any[] = []

    if (trackIds.length > 0) {
      const idsParam = `(${trackIds.join(',')})`
      const tracksRes = await fetch(
        `${supabaseUrl}/rest/v1/combined_media?id=in.${idsParam}&select=*`,
        { headers }
      )
      if (tracksRes.ok) {
        fullTracks = await tracksRes.json()
      }
    }

    // Build a map of track_id → full track data
    const trackMap = new Map<string, any>()
    for (const t of fullTracks) {
      trackMap.set(t.id, t)
    }

    // Resolve seller usernames
    const sellerIds = [...new Set((Array.isArray(purchases) ? purchases : []).map((p: any) => p.seller_id).filter(Boolean))]
    const sellerMap = new Map<string, string>()
    if (sellerIds.length > 0) {
      const idsParam = `(${sellerIds.join(',')})`
      const sellersRes = await fetch(
        `${supabaseUrl}/rest/v1/users?clerk_user_id=in.${idsParam}&select=clerk_user_id,username`,
        { headers }
      )
      if (sellersRes.ok) {
        const sellers = await sellersRes.json()
        for (const s of sellers) {
          if (s.clerk_user_id && s.username) sellerMap.set(s.clerk_user_id, s.username)
        }
      }
    }

    // Combine: prefer full track info, fall back to purchase record + music_library
    const musicLibMap = new Map<string, any>()
    for (const m of (Array.isArray(musicLib) ? musicLib : [])) {
      if (m.audio_url) musicLibMap.set(m.audio_url, m)
    }

    const boughtTracks = (Array.isArray(purchases) ? purchases : []).map((p: any) => {
      const full = trackMap.get(p.track_id)
      return {
        id: p.track_id,
        title: full?.title || p.track_title || 'Untitled',
        audio_url: full?.audio_url || null,
        image_url: full?.image_url || null,
        genre: full?.genre || null,
        secondary_genre: full?.secondary_genre || null,
        mood: full?.mood || null,
        bpm: full?.bpm || null,
        key_signature: full?.key_signature || null,
        vocals: full?.vocals || null,
        language: full?.language || null,
        tags: full?.tags || null,
        description: full?.description || null,
        instruments: full?.instruments || null,
        is_explicit: full?.is_explicit || false,
        duration_seconds: full?.duration_seconds || null,
        artist_name: full?.artist_name || null,
        featured_artists: full?.featured_artists || null,
        contributors: full?.contributors || null,
        songwriters: full?.songwriters || null,
        copyright_holder: full?.copyright_holder || null,
        copyright_year: full?.copyright_year || null,
        record_label: full?.record_label || null,
        publisher: full?.publisher || null,
        release_type: full?.release_type || null,
        version_tag: full?.version_tag || null,
        plays: full?.plays || 0,
        likes: full?.likes || 0,
        downloads: full?.downloads || 0,
        created_at: full?.created_at || p.created_at,
        user_id: full?.user_id || p.seller_id,
        username: full?.username || null,
        seller_username: sellerMap.get(p.seller_id) || null,
        seller_id: p.seller_id,
        amount_paid: p.amount_paid,
        purchased_at: p.created_at,
        source: 'earn_purchase',
      }
    })

    // Also add music_library entries that weren't in earn_purchases (edge case)
    const purchasedAudioUrls = new Set(boughtTracks.map((t: any) => t.audio_url).filter(Boolean))
    for (const m of (Array.isArray(musicLib) ? musicLib : [])) {
      if (m.audio_url && !purchasedAudioUrls.has(m.audio_url)) {
        boughtTracks.push({
          id: m.id,
          title: m.title || 'Untitled',
          audio_url: m.audio_url,
          image_url: null,
          genre: null,
          secondary_genre: null,
          mood: null,
          bpm: null,
          key_signature: null,
          vocals: null,
          language: null,
          tags: null,
          description: null,
          instruments: null,
          is_explicit: false,
          duration_seconds: null,
          artist_name: null,
          featured_artists: null,
          contributors: null,
          songwriters: null,
          copyright_holder: null,
          copyright_year: null,
          record_label: null,
          publisher: null,
          release_type: null,
          version_tag: null,
          plays: 0,
          likes: 0,
          downloads: 0,
          created_at: m.created_at,
          user_id: null,
          username: null,
          seller_username: null,
          seller_id: null,
          amount_paid: null,
          purchased_at: m.created_at,
          source: 'music_library',
        })
      }
    }

    // ── Enrich bare tracks with metadata from their released sibling ──
    // Same audio_url may have a separate "released" combined_media row with genre/mood/bpm
    const bareEarn = boughtTracks.filter((t: any) => !t.genre && t.audio_url && t.source === 'earn_purchase')
    if (bareEarn.length > 0) {
      try {
        const bareAudioUrls = bareEarn.map((t: any) => `"${t.audio_url}"`).join(',')
        const siblingsRes = await fetch(
          `${supabaseUrl}/rest/v1/combined_media?audio_url=in.(${bareAudioUrls})&genre=not.is.null&select=audio_url,user_id,genre,secondary_genre,mood,bpm,key_signature,vocals,language,description,instruments,tags,is_explicit,duration_seconds,artist_name,featured_artists,contributors,songwriters,copyright_holder,copyright_year,record_label,publisher,release_type,version_tag,image_url`,
          { headers }
        )
        if (siblingsRes.ok) {
          const siblings = await siblingsRes.json()
          const sibMap = new Map<string, any>()
          for (const s of (siblings || [])) {
            const key = `${s.audio_url}|${s.user_id}`
            if (!sibMap.has(key)) sibMap.set(key, s)
          }
          const metaFields = [
            'genre', 'secondary_genre', 'mood', 'bpm', 'key_signature', 'vocals',
            'language', 'description', 'instruments', 'tags', 'is_explicit',
            'duration_seconds', 'artist_name', 'featured_artists', 'contributors',
            'songwriters', 'copyright_holder', 'copyright_year', 'record_label',
            'publisher', 'release_type', 'version_tag'
          ]
          for (const t of bareEarn) {
            const sib = sibMap.get(`${(t as any).audio_url}|${(t as any).user_id}`)
            if (sib) {
              for (const f of metaFields) {
                if (sib[f] != null && (t as any)[f] == null) {
                  (t as any)[f] = sib[f]
                }
              }
              if (sib.image_url && !(t as any).image_url) (t as any).image_url = sib.image_url
            }
          }
        }
      } catch (e) {
        console.warn('[BOUGHT] Sibling metadata enrichment failed:', e)
      }
    }

    return NextResponse.json({ success: true, bought: boughtTracks })
  } catch (error) {
    console.error('Error fetching bought tracks:', error)
    return NextResponse.json({ error: 'Failed to fetch bought tracks' }, { status: 500 })
  }
}
