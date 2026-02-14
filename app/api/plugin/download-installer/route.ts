/**
 * Plugin Installer Download API
 * GET /api/plugin/download-installer
 * Auth: Clerk session (subscriber only)
 *
 * Proxies the plugin zip from R2 — only active subscribers can download.
 * This prevents direct-link sharing of the public R2 URL.
 */

import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const PLUGIN_R2_URL = 'https://media.444radio.co.in/downloads/444Radio-Plugin-v2-Windows.zip'
const PLUGIN_FILENAME = '444Radio-Plugin-v2-Windows.zip'

export const maxDuration = 60

export async function GET() {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json(
        { error: 'Please sign in to download the plugin.' },
        { status: 401 }
      )
    }

    // Check subscription status
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('subscription_status')
      .eq('clerk_user_id', userId)
      .single()

    if (userError || !user) {
      return NextResponse.json(
        { error: 'User not found. Please sign in again.' },
        { status: 404 }
      )
    }

    if (user.subscription_status !== 'active') {
      return NextResponse.json(
        { error: 'An active subscription is required to download the plugin.' },
        { status: 403 }
      )
    }

    // Proxy the download from R2
    const r2Response = await fetch(PLUGIN_R2_URL)

    if (!r2Response.ok) {
      console.error('[plugin/download-installer] R2 fetch failed:', r2Response.status)
      return NextResponse.json(
        { error: 'Download temporarily unavailable. Please try again.' },
        { status: 502 }
      )
    }

    const contentLength = r2Response.headers.get('content-length')

    return new Response(r2Response.body, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${PLUGIN_FILENAME}"`,
        ...(contentLength ? { 'Content-Length': contentLength } : {}),
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (error) {
    console.error('[plugin/download-installer] Error:', error)
    return NextResponse.json(
      { error: 'Download failed. Please try again.' },
      { status: 500 }
    )
  }
}
