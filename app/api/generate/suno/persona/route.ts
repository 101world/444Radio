import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { logCreditTransaction } from '@/lib/credit-transactions'
import {
  generatePersona,
  sanitizeSunoError,
  SUNO_CREDIT_COSTS,
} from '@/lib/suno-api'

export const maxDuration = 60

/**
 * POST /api/generate/suno/persona
 *
 * 444 Pro Persona — create a reusable voice/style persona from a generated track.
 * FREE (0 credits). Returns JSON.
 *
 * Body: { taskId, audioId, name, description, vocalStart?, vocalEnd?, style? }
 */
export async function POST(req: NextRequest) {
  console.log('🎵 [444-PERSONA] POST /api/generate/suno/persona')
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { taskId, audioId, name, description, vocalStart, vocalEnd, style } = body

    if (!taskId || !audioId) return NextResponse.json({ error: 'taskId and audioId are required' }, { status: 400 })
    if (!name || typeof name !== 'string') return NextResponse.json({ error: 'Persona name is required' }, { status: 400 })
    if (!description || typeof description !== 'string') return NextResponse.json({ error: 'Persona description is required' }, { status: 400 })

    const cleanName = name.trim().slice(0, 80)
    const cleanDesc = description.trim().slice(0, 500)

    const result = await generatePersona({
      taskId,
      audioId,
      name: cleanName,
      description: cleanDesc,
      vocalStart,
      vocalEnd,
      style: style?.trim(),
    })

    // Log free usage
    await logCreditTransaction({
      userId,
      amount: 0,
      type: 'generation_music',
      description: `444 Persona created: ${cleanName}`,
      metadata: { taskId, audioId, personaId: result.data?.personaId, engine: '444-persona' },
    }).catch(() => {})

    return NextResponse.json({
      success: true,
      personaId: result.data?.personaId,
      name: result.data?.name || cleanName,
      description: result.data?.description || cleanDesc,
      creditsDeducted: SUNO_CREDIT_COSTS.persona,
    })
  } catch (error) {
    console.error('❌ Persona error:', error)
    return NextResponse.json({ success: false, error: sanitizeSunoError(error) }, { status: 500 })
  }
}
