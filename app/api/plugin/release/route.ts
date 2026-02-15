/**
 * Plugin Release API — Publish a track to Explore from the plugin.
 *
 * POST /api/plugin/release
 * Auth: Bearer <plugin_token>
 * Body: { audioUrl, imageUrl?, title, prompt?, lyrics? }
 *
 * Inserts a row into combined_media with is_public=true so
 * the track appears on the Explore page and the user's public profile.
 */

import { NextRequest, NextResponse } from 'next/server'
import { authenticatePlugin } from '@/lib/plugin-auth'
import { corsResponse, handleOptions } from '@/lib/cors'

export async function OPTIONS() {
  return handleOptions()
}

export async function POST(req: NextRequest) {
  // ── Auth ──
  const authResult = await authenticatePlugin(req)
  if (!authResult.valid) {
    return corsResponse(NextResponse.json({ error: authResult.error }, { status: authResult.status }))
  }
  const userId = authResult.userId

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return corsResponse(NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }))
  }

  const audioUrl = body.audioUrl as string
  const imageUrl = (body.imageUrl as string) || null
  const title = (body.title as string) || 'Untitled'
  const prompt = (body.prompt as string) || ''
  const lyrics = (body.lyrics as string) || null
  const genre = (body.genre as string) || null
  const mood = (body.mood as string) || null
  const bpm = body.bpm ? Number(body.bpm) : null

  if (!audioUrl) {
    return corsResponse(NextResponse.json({ error: 'Missing audioUrl' }, { status: 400 }))
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  try {
    // Look up username for the explore page display
    const userRes = await fetch(
      `${supabaseUrl}/rest/v1/users?clerk_user_id=eq.${userId}&select=username,avatar_url`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      }
    )
    const userData = await userRes.json()
    const username = Array.isArray(userData) && userData.length > 0
      ? userData[0].username || `user_${userId.slice(-8)}`
      : `user_${userId.slice(-8)}`

    // Check for duplicate — don't release the same audio URL twice
    const dupeRes = await fetch(
      `${supabaseUrl}/rest/v1/combined_media?audio_url=eq.${encodeURIComponent(audioUrl)}&user_id=eq.${userId}&select=id&limit=1`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      }
    )
    const dupeData = await dupeRes.json()
    if (Array.isArray(dupeData) && dupeData.length > 0) {
      return corsResponse(NextResponse.json({
        success: true,
        message: 'Track already released to Explore',
        alreadyReleased: true,
        id: dupeData[0].id,
      }))
    }

    // Insert into combined_media (Explore / Profile)
    const insertRes = await fetch(
      `${supabaseUrl}/rest/v1/combined_media`,
      {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation',
        },
        body: JSON.stringify({
          user_id: userId,
          username,
          audio_url: audioUrl,
          image_url: imageUrl || 'https://images.444radio.co.in/default-cover.jpg',
          audio_prompt: prompt,
          title,
          lyrics,
          genre,
          mood,
          bpm,
          is_public: true,
          is_published: true,
          type: 'audio',
        }),
      }
    )

    const inserted = await insertRes.json()

    if (!insertRes.ok) {
      console.error('[plugin/release] Supabase error:', inserted)
      return corsResponse(NextResponse.json({
        error: inserted.message || 'Failed to release track',
      }, { status: insertRes.status }))
    }

    const record = Array.isArray(inserted) ? inserted[0] : inserted

    console.log(`[plugin/release] ✅ Track "${title}" released by ${username} (${userId})`)

    return corsResponse(NextResponse.json({
      success: true,
      id: record?.id,
      message: `Track "${title}" is now live on Explore!`,
    }))
  } catch (error) {
    console.error('[plugin/release] Error:', error)
    return corsResponse(NextResponse.json({ error: 'Release failed' }, { status: 500 }))
  }
}
