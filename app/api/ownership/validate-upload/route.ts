import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { corsResponse, handleOptions } from '@/lib/cors'
import { validateUpload } from '@/lib/ownership-engine'

export async function OPTIONS() {
  return handleOptions()
}

/**
 * POST /api/ownership/validate-upload
 * 
 * Anti-reupload gate. Call before finalizing any upload.
 * Checks the audio against all existing fingerprints.
 * 
 * Body: FormData with 'audio' file + optional 'prompt', 'seed', 'model'
 * 
 * Returns:
 * - allowed: boolean
 * - isOriginal: boolean
 * - matches: FingerprintMatch[]
 * - blockReason?: string
 * - suggestedAction?: 'upload_as_remix' | 'credit_original' | 'cancel'
 * - originalCreator?: { userId, username, trackId444, title }
 */
export async function POST(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return corsResponse(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  }

  try {
    const formData = await request.formData()
    const audioFile = formData.get('audio') as File | null
    const prompt = formData.get('prompt') as string | null
    const seed = formData.get('seed') as string | null
    const model = formData.get('model') as string | null

    if (!audioFile) {
      return corsResponse(
        NextResponse.json({ error: 'Audio file required' }, { status: 400 })
      )
    }

    const audioBuffer = await audioFile.arrayBuffer()

    const result = await validateUpload(audioBuffer, userId, {
      prompt: prompt || undefined,
      seed: seed || undefined,
      model: model || undefined,
      claimedAsOriginal: true,
    })

    return corsResponse(NextResponse.json(result))
  } catch (error) {
    console.error('Upload validation error:', error)
    return corsResponse(
      NextResponse.json({ error: 'Validation failed' }, { status: 500 })
    )
  }
}
