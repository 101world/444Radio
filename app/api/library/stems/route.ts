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
 * GET /api/library/stems
 * Returns stems grouped by parent track (or source description).
 * Each group has { parentTitle, parentImage, stems: [...] }
 */
export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) {
      return corsResponse(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
    }

    // Fetch all stem entries for this user
    const { data: stems, error } = await supabase
      .from('combined_media')
      .select('id, title, audio_url, image_url, genre, stem_type, parent_track_id, description, created_at')
      .eq('user_id', userId)
      .eq('genre', 'stem')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[Stems API] Error:', error.message)
      return corsResponse(NextResponse.json({ error: 'Failed to fetch stems' }, { status: 500 }))
    }

    if (!stems || stems.length === 0) {
      return corsResponse(NextResponse.json({ success: true, groups: [] }))
    }

    // Collect unique parent_track_ids for batch lookup
    const parentIds = [...new Set(stems.filter(s => s.parent_track_id).map(s => s.parent_track_id))]
    
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

    // Group stems: by parent_track_id if available, otherwise by timestamp similarity
    const groupMap = new Map<string, {
      parentId: string | null
      parentTitle: string
      parentImage: string | null
      parentAudioUrl: string | null
      stems: typeof stems
      createdAt: string
    }>()

    for (const stem of stems) {
      let groupKey: string
      let parentTitle: string
      let parentImage: string | null = null
      let parentAudioUrl: string | null = null

      if (stem.parent_track_id && parentTracks[stem.parent_track_id]) {
        groupKey = stem.parent_track_id
        const parent = parentTracks[stem.parent_track_id]
        parentTitle = parent.title || 'Unknown Track'
        parentImage = parent.image_url
        parentAudioUrl = parent.audio_url
      } else {
        // Fall back to grouping by description (contains source info) or by creation timestamp (within 60s)
        const descMatch = stem.description?.match(/Stem split from: (.+)/)
        const source = descMatch?.[1] || 'Unknown Source'
        
        // Group stems created within 60 seconds of each other with same source
        const stemTime = new Date(stem.created_at).getTime()
        let foundGroup = false
        for (const [key, group] of groupMap) {
          if (key.startsWith('time_')) {
            const groupTime = new Date(group.createdAt).getTime()
            if (Math.abs(stemTime - groupTime) < 60000) {
              groupKey = key
              parentTitle = group.parentTitle
              parentImage = group.parentImage
              parentAudioUrl = group.parentAudioUrl
              foundGroup = true
              break
            }
          }
        }
        if (!foundGroup) {
          groupKey = `time_${stem.created_at}`
          parentTitle = source.startsWith('http') ? 'Uploaded Audio' : source
          parentImage = stem.image_url
        }
      }

      if (!groupMap.has(groupKey!)) {
        groupMap.set(groupKey!, {
          parentId: stem.parent_track_id,
          parentTitle: parentTitle!,
          parentImage: parentImage!,
          parentAudioUrl,
          stems: [],
          createdAt: stem.created_at
        })
      }
      groupMap.get(groupKey!)!.stems.push(stem)
    }

    // Convert to array sorted by most recent first
    const groups = Array.from(groupMap.values())
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map(g => ({
        parentId: g.parentId,
        parentTitle: g.parentTitle,
        parentImage: g.parentImage,
        parentAudioUrl: g.parentAudioUrl,
        stems: g.stems.map(s => ({
          id: s.id,
          title: s.title,
          audioUrl: s.audio_url,
          stemType: s.stem_type || s.title?.replace(/\s*\(Stem\)/, '').split(' — ').pop()?.toLowerCase() || 'unknown',
          createdAt: s.created_at,
        }))
      }))

    return corsResponse(NextResponse.json({ success: true, groups }))
  } catch (error) {
    console.error('[Stems API] Error:', error)
    return corsResponse(NextResponse.json({ error: 'Internal server error' }, { status: 500 }))
  }
}
