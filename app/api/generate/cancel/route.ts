import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import Replicate from 'replicate'
import { corsResponse, handleOptions } from '@/lib/cors'

export async function OPTIONS() {
  return handleOptions()
}

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return corsResponse(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  }

  const { predictionId } = await req.json()
  if (!predictionId || typeof predictionId !== 'string') {
    return corsResponse(NextResponse.json({ error: 'Missing predictionId' }, { status: 400 }))
  }

  const replicate = new Replicate({
    auth: process.env.REPLICATE_API_KEY_LATEST2!,
  })

  try {
    await replicate.predictions.cancel(predictionId)
    console.log(`[Cancel] Prediction ${predictionId} cancelled by ${userId}`)
    return corsResponse(NextResponse.json({ success: true, cancelled: true }))
  } catch (error) {
    // Prediction may have already completed, been cancelled, or doesn't exist
    console.log(`[Cancel] Could not cancel ${predictionId}:`, error instanceof Error ? error.message : error)
    return corsResponse(NextResponse.json({ success: true, cancelled: false, note: 'Prediction may have already completed' }))
  }
}
