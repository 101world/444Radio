import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { uploadToR2 } from '@/lib/r2-upload'
import { corsResponse, handleOptions } from '@/lib/cors'

export async function OPTIONS() {
  return handleOptions()
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return corsResponse(NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 }))
    }

    const contentType = req.headers.get('content-type') || ''
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

    let bannerUrl: string | null = null
    let bannerType: 'image' | 'video' | null = null

    if (contentType.includes('application/json')) {
      // JSON body variant: { useLatestCover?: boolean, coverUrl?: string }
      const { useLatestCover, coverUrl } = await req.json()
      if (useLatestCover) {
        // Pick latest image from combined_media
        const res = await fetch(
          `${supabaseUrl}/rest/v1/combined_media?user_id=eq.${userId}&image_url=not.is.null&select=image_url,created_at&order=created_at.desc&limit=1`,
          {
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`
            }
          }
        )
        const rows = await res.json()
        if (!Array.isArray(rows) || rows.length === 0 || !rows[0].image_url) {
          return corsResponse(NextResponse.json({ success: false, error: 'No recent cover art found' }, { status: 404 }))
        }
        bannerUrl = rows[0].image_url
        bannerType = 'image'
      } else if (typeof coverUrl === 'string' && coverUrl.trim()) {
        // Directly set from provided URL
        bannerUrl = coverUrl.trim()
        bannerType = bannerUrl.match(/\.(mp4|webm|mov)(\?.*)?$/i) ? 'video' : 'image'
      } else {
        return corsResponse(NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 }))
      }
    } else {
      // Multipart form-data: file + kind (image|video)
      const form = await req.formData()
      const file = form.get('file') as File | null
      const kind = (form.get('kind') as string | null)?.toLowerCase() as 'image' | 'video' | null
      if (!file || !kind || (kind !== 'image' && kind !== 'video')) {
        return corsResponse(NextResponse.json({ success: false, error: 'Missing file or kind' }, { status: 400 }))
      }

      const key = `${userId}/banner-${Date.now()}-${file.name}`
      const bucket = kind === 'image' ? 'images' : 'videos'
      const upload = await uploadToR2(file, bucket, key)
      if (!upload.success || !upload.url) {
        return corsResponse(NextResponse.json({ success: false, error: upload.error || 'Upload failed' }, { status: 500 }))
      }
      bannerUrl = upload.url
      bannerType = kind
    }

    // Persist to users table
    const patchRes = await fetch(`${supabaseUrl}/rest/v1/users?clerk_user_id=eq.${userId}`, {
      method: 'PATCH',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({ banner_url: bannerUrl, banner_type: bannerType })
    })

    if (!patchRes.ok) {
      const errText = await patchRes.text()
      console.error('Failed updating user banner:', errText)
      return corsResponse(NextResponse.json({ success: false, error: 'Failed to update banner' }, { status: 500 }))
    }

    const updated = await patchRes.json()
    return corsResponse(NextResponse.json({ success: true, banner_url: bannerUrl, banner_type: bannerType, user: updated?.[0] }))

  } catch (error) {
    console.error('Banner update error:', error)
    return corsResponse(NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 }))
  }
}
