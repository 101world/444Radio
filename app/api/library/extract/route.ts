import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'
import { corsResponse, handleOptions } from '@/lib/cors'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function OPTIONS() {
  return handleOptions()
}

/**
 * GET /api/library/extract
 * Returns extract items grouped by parent track.
 * Includes both video-to-audio and audio-to-audio extractions.
 */
export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) {
      return corsResponse(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
    }

    // Fetch all extract entries for this user
    const { data: extracts, error } = await supabase
      .from('combined_media')
      .select('id, title, audio_url, image_url, genre, stem_type, parent_track_id, description, metadata, created_at')
      .eq('user_id', userId)
      .eq('genre', 'extract')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[Extract API] Error:', error.message)
      return corsResponse(NextResponse.json({ error: 'Failed to fetch extracts' }, { status: 500 }))
    }

    if (!extracts || extracts.length === 0) {
      return corsResponse(NextResponse.json({ success: true, groups: [] }))
    }

    // Collect unique parent_track_ids for batch lookup
    const parentIds = [...new Set(extracts.filter(e => e.parent_track_id).map(e => e.parent_track_id))]

    let parentTracks: Record<string, { title: string; image_url: string | null; audio_url: string | null }> = {}
    if (parentIds.length > 0) {
      const { data: parents } = await supabase
        .from('combined_media')
        .select('id, title, image_url, audio_url')
        .in('id', parentIds)

      if (parents) {
        for (const p of parents) {
          parentTracks[p.id] = { title: p.title, image_url: p.image_url, audio_url: p.audio_url }
        }
      }
    }

    // Group extracts by parent_track_id or by timestamp proximity
    const groupMap = new Map<string, {
      parentId: string | null
      parentTitle: string
      parentImage: string | null
      parentAudioUrl: string | null
      extracts: typeof extracts
      createdAt: string
    }>()

    for (const extract of extracts) {
      let groupKey: string
      let parentTitle: string
      let parentImage: string | null = null
      let parentAudioUrl: string | null = null

      if (extract.parent_track_id && parentTracks[extract.parent_track_id]) {
        groupKey = extract.parent_track_id
        const parent = parentTracks[extract.parent_track_id]
        parentTitle = parent.title || 'Unknown Track'
        parentImage = parent.image_url
        parentAudioUrl = parent.audio_url
      } else {
        // Group by timestamp (within 2 minutes)
        const ts = new Date(extract.created_at).getTime()
        let foundGroup = false
        for (const [key, group] of groupMap.entries()) {
          const groupTs = new Date(group.createdAt).getTime()
          if (Math.abs(ts - groupTs) < 120000) {
            groupKey = key
            foundGroup = true
            break
          }
        }
        if (!foundGroup) {
          groupKey = `extract-${extract.id}`
        }
        // Parse title from description
        parentTitle = extract.description?.replace(/^(.*?) extracted from: /, '').replace(/Audio extracted from video/, 'Video Extract') || extract.title || 'Extract'
      }

      if (!groupMap.has(groupKey!)) {
        groupMap.set(groupKey!, {
          parentId: extract.parent_track_id || null,
          parentTitle,
          parentImage,
          parentAudioUrl,
          extracts: [],
          createdAt: extract.created_at,
        })
      }
      groupMap.get(groupKey!)!.extracts.push(extract)
    }

    // Convert to array
    const groups = Array.from(groupMap.values()).map(group => ({
      parentId: group.parentId,
      parentTitle: group.parentTitle,
      parentImage: group.parentImage,
      parentAudioUrl: group.parentAudioUrl,
      extracts: group.extracts.map(e => {
        // Determine extract type from metadata or description
        let meta: Record<string, unknown> = {}
        try {
          meta = typeof e.metadata === 'string' ? JSON.parse(e.metadata) : (e.metadata || {})
        } catch {}

        return {
          id: e.id,
          title: e.title,
          audioUrl: e.audio_url,
          stemType: e.stem_type || (meta.source === 'video-to-audio' ? 'video-extract' : 'unknown'),
          source: (meta.source as string) || 'unknown',
          createdAt: e.created_at,
        }
      }),
    }))

    return corsResponse(NextResponse.json({ success: true, groups }))
  } catch (error) {
    console.error('[Extract Library] Error:', error)
    return corsResponse(NextResponse.json({ error: 'Internal server error' }, { status: 500 }))
  }
}
