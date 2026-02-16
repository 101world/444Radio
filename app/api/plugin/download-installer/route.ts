/**
 * Plugin Installer Download API
 * GET /api/plugin/download-installer
 * Auth: Clerk session (any signed-in user — plugin is FREE for all)
 *
 * Proxies the plugin zip from R2 to prevent direct-link sharing.
 */

import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

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

    // Plugin is FREE for all signed-in users — no purchase/subscription check needed

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
