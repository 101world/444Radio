import { NextRequest, NextResponse } from 'next/server'
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

// GET - Fetch metadata for a specific track
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return corsResponse(NextResponse.json({ error: 'Missing track id' }, { status: 400 }))
    }

    const { data, error } = await supabase
      .from('combined_media')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      return corsResponse(NextResponse.json({ error: 'Track not found' }, { status: 404 }))
    }

    return corsResponse(NextResponse.json({ success: true, track: data }))
  } catch (error) {
    console.error('Fetch metadata error:', error)
    return corsResponse(NextResponse.json({ error: 'Internal server error' }, { status: 500 }))
  }
}

// PUT - Update metadata for a track
export async function PUT(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return corsResponse(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
    }

    const body = await req.json()
    const { id, ...metadata } = body

    if (!id) {
      return corsResponse(NextResponse.json({ error: 'Missing track id' }, { status: 400 }))
    }

    // Verify ownership
    const { data: track } = await supabase
      .from('combined_media')
      .select('user_id')
      .eq('id', id)
      .single()

    if (!track || track.user_id !== userId) {
      return corsResponse(NextResponse.json({ error: 'Not authorized to edit this track' }, { status: 403 }))
    }

    // Build update object with only the fields that were provided
    const updateData: Record<string, unknown> = {}
    const allowedFields = [
      'title', 'artist_name', 'featured_artists', 'release_type', 'release_date',
      'genre', 'secondary_genre', 'mood', 'mood_tags', 'bpm', 'key_signature',
      'vocals', 'language', 'is_explicit', 'is_cover', 'description', 'tags',
      'keywords', 'instruments', 'version_tag', 'lyrics', 'songwriters',
      'contributors', 'publisher', 'publishing_splits', 'copyright_holder',
      'copyright_year', 'record_label', 'catalogue_number', 'pro_affiliation',
      'isrc', 'upc', 'iswc', 'territories', 'audio_format', 'sample_rate',
      'bit_depth', 'duration_seconds'
    ]

    for (const field of allowedFields) {
      if (field in metadata) {
        updateData[field] = metadata[field]
      }
    }

    updateData.updated_at = new Date().toISOString()

    const { data, error } = await supabase
      .from('combined_media')
      .update(updateData)
      .eq('id', id)
      .select()

    if (error) {
      console.error('Update metadata error:', error)
      return corsResponse(NextResponse.json({ error: 'Failed to update metadata' }, { status: 500 }))
    }

    return corsResponse(NextResponse.json({ success: true, track: data?.[0] }))
  } catch (error) {
    console.error('Update metadata error:', error)
    return corsResponse(NextResponse.json({ error: 'Internal server error' }, { status: 500 }))
  }
}
