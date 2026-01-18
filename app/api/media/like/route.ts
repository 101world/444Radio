import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { corsResponse, handleOptions } from '@/lib/cors'

/**
 * SIMPLIFIED Like API - increments/decrements likes counter
 * without user_likes table tracking
 */

export async function OPTIONS() {
  return handleOptions()
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return corsResponse(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
    }

    const body = await req.json()
    const releaseId = body.releaseId || body.mediaId
    
    if (!releaseId) {
      return corsResponse(NextResponse.json(
        { error: 'Release ID is required' },
        { status: 400 }
      ))
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

    // Get current likes count
    const getResponse = await fetch(
      `${supabaseUrl}/rest/v1/combined_media?id=eq.${releaseId}&select=likes`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        }
      }
    )

    if (!getResponse.ok) {
      return corsResponse(NextResponse.json({ error: 'Media not found' }, { status: 404 }))
    }

    const media = await getResponse.json()
    if (!media || media.length === 0) {
      return corsResponse(NextResponse.json({ error: 'Media not found' }, { status: 404 }))
    }

    const currentLikes = media[0].likes || 0
    
    // For now, just increment (will implement proper toggle later with user_likes table)
    const newLikes = currentLikes + 1
    
    // Update likes count
    const updateResponse = await fetch(
      `${supabaseUrl}/rest/v1/combined_media?id=eq.${releaseId}`,
      {
        method: 'PATCH',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({ likes: newLikes })
      }
    )

    if (!updateResponse.ok) {
      throw new Error('Failed to update likes count')
    }

    return corsResponse(NextResponse.json({
      success: true,
      liked: true,
      likesCount: newLikes
    }))

  } catch (error) {
    console.error('[Like API] Error:', error)
    return corsResponse(NextResponse.json(
      { 
        error: 'Failed to update like status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    ))
  }
}

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return corsResponse(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
    }

    const { searchParams } = new URL(req.url)
    const releaseId = searchParams.get('releaseId')
    
    if (!releaseId) {
      return corsResponse(NextResponse.json(
        { error: 'Release ID is required' },
        { status: 400 }
      ))
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

    // Get likes count
    const countResponse = await fetch(
      `${supabaseUrl}/rest/v1/combined_media?id=eq.${releaseId}&select=likes`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        }
      }
    )

    const countData = await countResponse.json()
    const likesCount = countData[0]?.likes || 0

    return corsResponse(NextResponse.json({
      liked: false, // Can't tell without user_likes table
      likesCount
    }))

  } catch (error) {
    console.error('[Like API] GET Error:', error)
    return corsResponse(NextResponse.json(
      { error: 'Failed to get like status' },
      { status: 500 }
    ))
  }
}
