import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { corsResponse, handleOptions } from '@/lib/cors'

export const maxDuration = 10

export async function OPTIONS() {
  return handleOptions()
}

/**
 * GET /api/generate/check-recent
 * 
 * Returns recently completed generations for the current user.
 * Used by the client to recover generations that completed while
 * the user was on a different page / tab.
 * 
 * Query params:
 *   since - ISO timestamp (default: 15 minutes ago)
 *   types - comma-separated list: music,effects,loops,images (default: all)
 */
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const sinceParam = searchParams.get('since')
    const typesParam = searchParams.get('types')

    // Default: look back 15 minutes
    const since = sinceParam
      ? new Date(sinceParam).toISOString()
      : new Date(Date.now() - 15 * 60 * 1000).toISOString()

    const types = typesParam ? typesParam.split(',') : ['music', 'effects', 'loops', 'images']

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

    const results: Array<{
      id: string
      type: string
      title: string
      audioUrl?: string
      imageUrl?: string
      createdAt: string
    }> = []

    // Check music_library
    if (types.includes('music')) {
      const res = await fetch(
        `${supabaseUrl}/rest/v1/music_library?clerk_user_id=eq.${userId}&created_at=gte.${since}&status=eq.ready&order=created_at.desc&limit=10`,
        {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`
          }
        }
      )
      if (res.ok) {
        const data = await res.json()
        for (const item of data) {
          results.push({
            id: item.id,
            type: 'music',
            title: item.title || 'Untitled',
            audioUrl: item.audio_url,
            createdAt: item.created_at
          })
        }
      }
    }

    // Check combined_media for effects and loops
    if (types.includes('effects') || types.includes('loops')) {
      const mediaTypes: string[] = []
      if (types.includes('effects')) mediaTypes.push('effect')
      if (types.includes('loops')) mediaTypes.push('loop')

      const typeFilter = mediaTypes.length === 1
        ? `type=eq.${mediaTypes[0]}`
        : `type=in.(${mediaTypes.join(',')})`

      const res = await fetch(
        `${supabaseUrl}/rest/v1/combined_media?user_id=eq.${userId}&created_at=gte.${since}&${typeFilter}&order=created_at.desc&limit=10`,
        {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`
          }
        }
      )
      if (res.ok) {
        const data = await res.json()
        for (const item of data) {
          results.push({
            id: item.id,
            type: item.type === 'effect' ? 'effects' : 'loops',
            title: item.title || 'Untitled',
            audioUrl: item.audio_url,
            createdAt: item.created_at
          })
        }
      }
    }

    // Check images_library
    if (types.includes('images')) {
      const res = await fetch(
        `${supabaseUrl}/rest/v1/images_library?user_id=eq.${userId}&created_at=gte.${since}&order=created_at.desc&limit=10`,
        {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`
          }
        }
      )
      if (res.ok) {
        const data = await res.json()
        for (const item of data) {
          results.push({
            id: item.id,
            type: 'images',
            title: item.prompt?.substring(0, 50) || 'Cover Art',
            imageUrl: item.image_url,
            createdAt: item.created_at
          })
        }
      }
    }

    // Sort by created_at desc
    results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    return corsResponse(NextResponse.json({ results }))
  } catch (error) {
    console.error('[check-recent] Error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
