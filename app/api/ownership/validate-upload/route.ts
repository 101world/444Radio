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
    let audioBuffer: ArrayBuffer
    let prompt: string | undefined
    let seed: string | undefined
    let model: string | undefined

    const contentType = request.headers.get('content-type') || ''

    if (contentType.includes('application/json')) {
      // Client sends { audioUrl } — fetch the audio from R2/CDN
      const body = await request.json()
      const { audioUrl } = body
      prompt = body.prompt
      seed = body.seed
      model = body.model

      if (!audioUrl) {
        return corsResponse(
          NextResponse.json({ error: 'audioUrl required' }, { status: 400 })
        )
      }

      const audioRes = await fetch(audioUrl)
      if (!audioRes.ok) {
        // Can't fetch audio — allow upload (don't block on infra issues)
        return corsResponse(NextResponse.json({ allowed: true, isOriginal: true, matches: [] }))
      }
      audioBuffer = await audioRes.arrayBuffer()
    } else {
      // FormData upload with raw audio file
      const formData = await request.formData()
      const audioFile = formData.get('audio') as File | null
      prompt = (formData.get('prompt') as string) || undefined
      seed = (formData.get('seed') as string) || undefined
      model = (formData.get('model') as string) || undefined

      if (!audioFile) {
        return corsResponse(
          NextResponse.json({ error: 'Audio file required' }, { status: 400 })
        )
      }
      audioBuffer = await audioFile.arrayBuffer()
    }

    const result = await validateUpload(audioBuffer, userId, {
      prompt,
      seed,
      model,
      claimedAsOriginal: true,
    })

    return corsResponse(NextResponse.json(result))
  } catch (error) {
    console.error('Upload validation error:', error)
    // On any failure, don't block the release — just allow it
    return corsResponse(
      NextResponse.json({ allowed: true, isOriginal: true, matches: [], error: 'Validation unavailable' })
    )
  }
}
