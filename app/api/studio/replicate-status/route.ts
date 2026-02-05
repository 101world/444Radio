import { NextResponse } from 'next/server'
import Replicate from 'replicate'
import { corsResponse, handleOptions } from '@/lib/cors'

export async function OPTIONS() {
  return handleOptions()
}

export async function GET() {
  const token = process.env.REPLICATE_API_KEY_LATEST2
  if (!token) {
    return corsResponse(NextResponse.json({ ok: false, error: 'REPLICATE_API_KEY_LATEST2 missing' }, { status: 500 }))
  }
  try {
    const resp = await fetch('https://api.replicate.com/v1/models/cjwbw/demucs', {
      headers: { Authorization: `Token ${token}` },
    })
    if (!resp.ok) {
      const text = await resp.text()
      console.error('Replicate model check failed:', resp.status, text)
      return corsResponse(NextResponse.json({ ok: false, status: resp.status, error: text }, { status: 503 }))
    }
    const body = await resp.json()
    return corsResponse(NextResponse.json({ ok: true, model: { id: body?.id, name: body?.name, versions: body?.versions?.length ?? 0 } }))
  } catch (error: any) {
    console.error('Replicate status check error:', error?.message || error)
    return corsResponse(NextResponse.json({ ok: false, error: error?.message || String(error) }, { status: 503 }))
  }
}
