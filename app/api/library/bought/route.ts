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
        mood: full?.mood || null,
        bpm: full?.bpm || null,
        seller_id: p.seller_id,
        amount_paid: p.amount_paid,
        purchased_at: p.created_at,
        created_at: p.created_at,
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
          mood: null,
          bpm: null,
          seller_id: null,
          amount_paid: null,
          purchased_at: m.created_at,
          created_at: m.created_at,
          source: 'music_library',
        })
      }
    }

    return NextResponse.json({ success: true, bought: boughtTracks })
  } catch (error) {
    console.error('Error fetching bought tracks:', error)
    return NextResponse.json({ error: 'Failed to fetch bought tracks' }, { status: 500 })
  }
}
