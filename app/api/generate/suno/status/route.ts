import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getTaskStatus, sanitizeSunoError } from '@/lib/suno-api'

export const maxDuration = 30

/**
 * GET /api/generate/suno/status?taskId=xxx
 *
 * Check the status of a 444 Pro generation task.
 * Used by the client to poll long-running generations.
 */
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const taskId = req.nextUrl.searchParams.get('taskId')
    if (!taskId) return NextResponse.json({ error: 'taskId query parameter is required' }, { status: 400 })

    const status = await getTaskStatus(taskId)

    return NextResponse.json({
      taskId: status.data.taskId,
      status: status.data.status,
      tracks: status.data.response?.data?.map((t) => ({
        id: t.id,
        title: t.title,
        audioUrl: t.audio_url,
        imageUrl: t.image_url,
        duration: t.duration,
        lyrics: t.lyric,
      })) || [],
    })
  } catch (error) {
    console.error('❌ Status check error:', error)
    return NextResponse.json({ error: sanitizeSunoError(error) }, { status: 500 })
  }
}
