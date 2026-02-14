/**
 * Plugin Info API
 * GET /api/plugin/info - Plugin health check and version info
 * No auth required — used by plugin to check connectivity.
 */

import { NextResponse } from 'next/server'
import { corsResponse, handleOptions } from '@/lib/cors'

export async function OPTIONS() {
  return handleOptions()
}

export async function GET() {
  return corsResponse(NextResponse.json({
    name: '444 Radio Plugin API',
    version: '1.0.0',
    status: 'online',
    endpoints: {
      auth: 'POST /api/plugin/token (website auth) — generates a token',
      credits: 'GET /api/plugin/credits — check credits',
      generate: 'POST /api/plugin/generate — start generation',
      jobs: 'GET /api/plugin/jobs — list jobs',
      jobStatus: 'GET /api/plugin/jobs/:jobId — poll job status',
      download: 'GET /api/plugin/download?url=...&filename=... — download file',
      cancel: 'POST /api/plugin/cancel — cancel generation',
    },
    generationTypes: {
      music: { cost: 2, description: 'Full AI music track with lyrics' },
      image: { cost: 1, description: 'Cover art / AI image' },
      effects: { cost: 2, description: 'Sound effects (SFX)' },
      loops: { cost: '6-7', description: 'BPM-locked loops (1-2 variations)' },
      stems: { cost: 5, description: 'Stem extraction (vocals, drums, bass, etc.)' },
      'audio-boost': { cost: 1, description: 'Mix & master audio' },
      extract: { cost: 1, description: 'Extract audio from video/audio' },
      'video-to-audio': { cost: '2-10', description: 'Generate synced SFX from video' },
    },
    webviewUrl: 'https://444radio.co.in/plugin',
    docs: 'https://444radio.co.in/docs/plugin-api',
  }))
}
