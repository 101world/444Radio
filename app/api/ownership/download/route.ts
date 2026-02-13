import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { corsResponse, handleOptions } from '@/lib/cors'
import { recordDownloadLineage, logOwnershipEvent, generateEmbedMetadata } from '@/lib/ownership-engine'
import { computeAudioHash } from '@/lib/audio-fingerprint'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

async function supabaseRest(path: string, options?: RequestInit) {
  return fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...options,
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
      ...(options?.headers || {}),
    },
  })
}

export async function OPTIONS() {
  return handleOptions()
}

/**
 * POST /api/ownership/download
 * 
 * Track a download with full lineage + embed ownership metadata.
 * This replaces the basic /api/download for marketplace purchases.
 * 
 * Body: { trackId, transactionType: 'download' | 'purchase' }
 * 
 * Returns the download URL with embedded 444 metadata instructions.
 */
export async function POST(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return corsResponse(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  }

  try {
    const { trackId, transactionType = 'download' } = await request.json()

    if (!trackId) {
      return corsResponse(NextResponse.json({ error: 'trackId required' }, { status: 400 }))
    }

    // Fetch track details
    const trackRes = await supabaseRest(
      `combined_media?id=eq.${trackId}&select=id,user_id,title,audio_url,track_id_444,original_creator_id,license_type_444,remix_allowed,derivative_allowed`
    )
    const tracks = trackRes.ok ? await trackRes.json() : []
    const track = tracks?.[0]

    if (!track) {
      return corsResponse(NextResponse.json({ error: 'Track not found' }, { status: 404 }))
    }

    // Get creator username
    const creatorRes = await supabaseRest(
      `users?clerk_user_id=eq.${track.original_creator_id || track.user_id}&select=username`
    )
    const creators = creatorRes.ok ? await creatorRes.json() : []
    const creatorUsername = creators?.[0]?.username

    // Get buyer username
    const buyerRes = await supabaseRest(
      `users?clerk_user_id=eq.${userId}&select=username`
    )
    const buyers = buyerRes.ok ? await buyerRes.json() : []
    const buyerUsername = buyers?.[0]?.username

    // Record download lineage
    await recordDownloadLineage({
      trackId: track.id,
      downloadUserId: userId,
      originalCreatorId: track.original_creator_id || track.user_id,
      derivativeAllowed: track.derivative_allowed || false,
      remixAllowed: track.remix_allowed || false,
      licenseType: track.license_type_444 || 'download_only',
      embeddedTrackId444: track.track_id_444,
    })

    // Log ownership event
    await logOwnershipEvent({
      trackId: track.id,
      originalCreatorId: track.original_creator_id || track.user_id,
      currentOwnerId: userId,
      transactionType: transactionType === 'purchase' ? 'purchase' : 'download',
      licenseType: track.license_type_444 || 'download_only',
      derivativeAllowed: track.derivative_allowed || false,
      trackId444: track.track_id_444,
      metadata: {
        buyerUsername,
        creatorUsername,
        title: track.title,
      },
    })

    // Generate embed metadata for the client to display
    const embedMetadata = generateEmbedMetadata({
      trackId444: track.track_id_444 || 'PENDING',
      originalCreatorId: track.original_creator_id || track.user_id,
      originalCreatorUsername: creatorUsername,
      buyerId: userId,
      buyerUsername,
      licenseType: track.license_type_444 || 'download_only',
    })

    return corsResponse(NextResponse.json({
      success: true,
      audioUrl: track.audio_url,
      title: track.title,
      trackId444: track.track_id_444,
      embedMetadata,
      license: {
        type: track.license_type_444 || 'download_only',
        remixAllowed: track.remix_allowed || false,
        derivativeAllowed: track.derivative_allowed || false,
      },
      signature: 'Minted on 444Radio • AI-Native Music Network',
    }))
  } catch (error) {
    console.error('Download lineage error:', error)
    return corsResponse(
      NextResponse.json({ error: 'Download tracking failed' }, { status: 500 })
    )
  }
}
