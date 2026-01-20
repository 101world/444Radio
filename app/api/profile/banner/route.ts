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
      
      console.log('[Banner API] JSON request:', { useLatestCover, coverUrl: coverUrl?.substring(0, 50) })
      
      if (useLatestCover) {
        // Pick latest image from combined_media
        const apiUrl = `${supabaseUrl}/rest/v1/combined_media?user_id=eq.${userId}&image_url=not.is.null&select=image_url,created_at&order=created_at.desc&limit=1`
        console.log('[Banner API] Fetching latest cover from:', apiUrl)
        
        const res = await fetch(apiUrl, {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`
          }
        })
        
        if (!res.ok) {
          console.error('[Banner API] Supabase query failed:', res.status, await res.text())
          return corsResponse(NextResponse.json({ success: false, error: 'Failed to query database' }, { status: 500 }))
        }
        
        const rows = await res.json()
        console.log('[Banner API] Query returned:', rows?.length, 'rows')
        
        if (!Array.isArray(rows) || rows.length === 0 || !rows[0].image_url) {
          return corsResponse(NextResponse.json({ success: false, error: 'No recent cover art found' }, { status: 404 }))
        }
        bannerUrl = rows[0].image_url
        bannerType = 'image'
        console.log('[Banner API] Using latest cover:', bannerUrl)
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
      
      console.log('[Banner API] File upload:', { 
        hasFile: !!file, 
        fileName: file?.name, 
        fileSize: file?.size, 
        fileType: file?.type,
        kind 
      })
      
      if (!file || !kind || (kind !== 'image' && kind !== 'video')) {
        return corsResponse(NextResponse.json({ success: false, error: 'Missing file or kind' }, { status: 400 }))
      }

      const key = `${userId}/banner-${Date.now()}-${file.name.replace(/[^\w.-]/g, '_')}`
      const bucket = '444radio-media' // Single bucket for all content
      
      console.log('[Banner API] Uploading to R2:', { bucket, key })
      
      const upload = await uploadToR2(file, bucket, key)
    console.log('[Banner API] Final banner URL:', bannerUrl, 'type:', bannerType)

      
      console.log('[Banner API] R2 upload result:', upload)
      
      if (!upload.success || !upload.url) {
        return corsResponse(NextResponse.json({ success: false, error: upload.error || 'Upload failed' }, { status: 500 }))
      }
      bannerUrl = upload.url
      bannerType = kind
    }

    // Sanitize URL to remove invalid characters (like \a newlines)
    if (bannerUrl) {
      bannerUrl = ban[Banner API] Failed updating user banner:', patchRes.status, errText)
      return corsResponse(NextResponse.json({ success: false, error: 'Failed to update banner in database' }, { status: 500 }))
    }

    const updated = await patchRes.json()
    console.log('[Banner API] ✅ Banner updated successfully for user:', userIdbaseUrl}/rest/v1/users?clerk_user_id=eq.${userId}`, {
      method: 'PATCH',
      headers: {
        'apikey': s[Banner API] ❌ Error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Internal server error'
    return corsResponse(NextResponse.json({ success: false, error: errorMessage
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
