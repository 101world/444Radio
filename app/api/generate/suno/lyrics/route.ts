import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { corsResponse, handleOptions } from '@/lib/cors'
import {
  generateLyrics,
  pollLyricsUntilDone,
  sanitizeSunoError,
} from '@/lib/suno-api'

export const maxDuration = 120

/**
 * POST /api/generate/suno/lyrics
 *
 * Generate lyrics using Suno's AI lyrics engine (FREE — 0 credits).
 *
 * Body: { prompt (max 200 chars), genre?, language? }
 *
 * Returns: { success, lyrics, title }
 */
export async function POST(req: NextRequest) {
  console.log('📝 [444-LYRICS] POST /api/generate/suno/lyrics')
  try {
    const { userId } = await auth()
    if (!userId) return corsResponse(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))

    const body = await req.json()
    const { prompt, genre, language } = body

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length < 3) {
      return corsResponse(NextResponse.json({ error: 'Prompt is required (3+ characters)' }, { status: 400 }))
    }

    // Build a richer prompt if genre/language are provided (max 200 chars for Suno)
    let lyricsPrompt = prompt.trim()
    const extras: string[] = []
    if (genre) extras.push(genre)
    if (language && language.toLowerCase() !== 'english') extras.push(`in ${language}`)
    if (extras.length) {
      const suffix = ` [${extras.join(', ')}]`
      // Ensure we stay within 200 char limit
      const maxBase = 200 - suffix.length
      lyricsPrompt = lyricsPrompt.slice(0, maxBase) + suffix
    }
    lyricsPrompt = lyricsPrompt.slice(0, 200)

    console.log(`📝 Generating lyrics for: "${lyricsPrompt.substring(0, 60)}..."`)

    // Submit lyrics task
    const task = await generateLyrics({
      prompt: lyricsPrompt,
      callBackUrl: 'https://www.444radio.co.in/api/webhook/generation-callback',
    })

    const taskId = task.data?.taskId
    if (!taskId) {
      console.error('❌ No taskId returned from lyrics API:', task)
      return corsResponse(NextResponse.json({ success: false, error: 'Failed to start lyrics generation' }, { status: 500 }))
    }

    console.log(`📝 Lyrics task started: ${taskId}`)

    // Poll until done (max 120s)
    const completed = await pollLyricsUntilDone(taskId)
    const lyricsData = completed.data?.response?.data
    if (!lyricsData?.length || !lyricsData[0]?.text) {
      console.error('❌ No lyrics in result:', completed)
      return corsResponse(NextResponse.json({ success: false, error: 'Lyrics generation returned empty result' }, { status: 500 }))
    }

    const generatedLyrics = lyricsData[0].text
    const generatedTitle = lyricsData[0].title || ''

    console.log(`✅ Lyrics generated: "${generatedTitle}" (${generatedLyrics.length} chars)`)

    return corsResponse(NextResponse.json({
      success: true,
      lyrics: generatedLyrics,
      title: generatedTitle,
      taskId,
    }))
  } catch (error) {
    console.error('❌ Lyrics generation error:', error)
    return corsResponse(NextResponse.json({
      success: false,
      error: sanitizeSunoError(error),
    }, { status: 500 }))
  }
}

export function OPTIONS() {
  return handleOptions()
}
