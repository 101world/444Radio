import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { corsResponse, handleOptions } from '@/lib/cors'
import { supabase } from '@/lib/supabase'

export const maxDuration = 60

export async function OPTIONS() {
  return handleOptions()
}

const s3Client = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT!,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
})

/**
 * GET /api/studio/samples — list user's custom studio samples
 * Reuses the same nde_samples table (samples work across NDE and Studio)
 */
export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) {
      return corsResponse(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
    }

    const { data, error } = await supabase
      .from('nde_samples')
      .select('id, name, url, original_filename, duration_ms, file_size, content_type, original_bpm, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[Studio samples] fetch error:', error)
      return corsResponse(NextResponse.json({ error: 'Failed to fetch samples' }, { status: 500 }))
    }

    return corsResponse(NextResponse.json({ samples: data || [] }))
  } catch (err) {
    console.error('[Studio samples] GET error:', err)
    return corsResponse(NextResponse.json({ error: 'Internal error' }, { status: 500 }))
  }
}

/**
 * POST /api/studio/samples — upload a custom sample (supports large files via presigned URL)
 * 
 * Two modes:
 * 1. JSON body { name, fileName, fileType, fileSize } → returns presigned URL + sample record
 *    Client uploads directly to R2 via presigned URL, then calls PATCH to confirm.
 * 2. FormData { file, name } → server-side upload (files under 4MB only, Vercel limit)
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return corsResponse(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
    }

    const contentType = req.headers.get('content-type') || ''

    // ── MODE 1: Presigned URL for large files (up to 50MB) ──
    if (contentType.includes('application/json')) {
      let body
      try { body = await req.json() }
      catch { return corsResponse(NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })) }

      const { name: rawName, fileName, fileType, fileSize, durationMs, originalBpm } = body
      const name = (rawName || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_')

      if (!name || name.length < 2 || name.length > 32) {
        return corsResponse(NextResponse.json({ error: 'Name must be 2-32 chars' }, { status: 400 }))
      }
      if (!fileName || !fileType) {
        return corsResponse(NextResponse.json({ error: 'Missing fileName or fileType' }, { status: 400 }))
      }
      if (!fileType.startsWith('audio/')) {
        return corsResponse(NextResponse.json({ error: 'File must be audio' }, { status: 400 }))
      }

      const MAX_SIZE = 50 * 1024 * 1024 // 50MB for studio samples
      if (fileSize && fileSize > MAX_SIZE) {
        return corsResponse(NextResponse.json({ error: 'File must be under 50MB' }, { status: 400 }))
      }

      // Check sample limit
      const { count } = await supabase
        .from('nde_samples')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)

      if ((count || 0) >= 50) {
        return corsResponse(NextResponse.json({ error: 'Max 50 samples. Delete some first.' }, { status: 400 }))
      }

      // Check name uniqueness
      const { data: existing } = await supabase
        .from('nde_samples')
        .select('id')
        .eq('user_id', userId)
        .eq('name', name)
        .limit(1)

      if (existing && existing.length > 0) {
        return corsResponse(NextResponse.json({ error: `"${name}" already exists` }, { status: 400 }))
      }

      // Generate R2 key and presigned URL
      const ext = fileName.split('.').pop()?.toLowerCase() || 'wav'
      const timestamp = Date.now()
      const r2Key = `studio-samples/${userId}/${timestamp}-${name}.${ext}`

      const command = new PutObjectCommand({
        Bucket: '444radio-media',
        Key: r2Key,
        ContentType: fileType,
      })
      const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 600 })

      const baseUrl = process.env.R2_PUBLIC_URL || process.env.NEXT_PUBLIC_R2_AUDIO_URL || 'https://media.444radio.co.in'
      const publicUrl = `${baseUrl}/${r2Key}`

      // Pre-create the Supabase record (status: 'uploading')
      const { data: inserted, error: insertErr } = await supabase
        .from('nde_samples')
        .insert({
          user_id: userId,
          name,
          url: publicUrl,
          r2_key: r2Key,
          original_filename: fileName,
          file_size: fileSize || 0,
          content_type: fileType,
          duration_ms: durationMs || null,
          original_bpm: originalBpm || null,
        })
        .select('id, name, url, original_filename, file_size, duration_ms, original_bpm, created_at')
        .single()

      if (insertErr) {
        console.error('[Studio samples] insert error:', insertErr)
        return corsResponse(NextResponse.json({ error: 'Failed to create sample record' }, { status: 500 }))
      }

      console.log(`🎤 [Studio] Presigned URL for "${name}" (${(fileSize / (1024 * 1024)).toFixed(1)}MB)`)

      return corsResponse(NextResponse.json({
        success: true,
        mode: 'presigned',
        uploadUrl: presignedUrl,
        sample: inserted,
      }))
    }

    // ── MODE 2: Server-side FormData upload (small files ≤4MB) ──
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData()
      const file = formData.get('file') as File | null
      const rawName = (formData.get('name') as string || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_')
      const originalBpmStr = formData.get('originalBpm') as string | null
      const originalBpm = originalBpmStr ? parseInt(originalBpmStr) || null : null

      if (!file) return corsResponse(NextResponse.json({ error: 'No file' }, { status: 400 }))
      if (!rawName || rawName.length < 2 || rawName.length > 32) {
        return corsResponse(NextResponse.json({ error: 'Name 2-32 chars' }, { status: 400 }))
      }
      if (!file.type.startsWith('audio/')) {
        return corsResponse(NextResponse.json({ error: 'Audio only' }, { status: 400 }))
      }
      if (file.size > 4 * 1024 * 1024) {
        return corsResponse(NextResponse.json({ error: 'Use presigned mode for files >4MB' }, { status: 400 }))
      }

      const { count } = await supabase
        .from('nde_samples')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
      if ((count || 0) >= 50) {
        return corsResponse(NextResponse.json({ error: 'Max 50 samples' }, { status: 400 }))
      }

      const { data: existing } = await supabase
        .from('nde_samples')
        .select('id')
        .eq('user_id', userId)
        .eq('name', rawName)
        .limit(1)
      if (existing && existing.length > 0) {
        return corsResponse(NextResponse.json({ error: `"${rawName}" exists` }, { status: 400 }))
      }

      const ext = file.name.split('.').pop()?.toLowerCase() || 'wav'
      const timestamp = Date.now()
      const r2Key = `studio-samples/${userId}/${timestamp}-${rawName}.${ext}`
      const buffer = Buffer.from(await file.arrayBuffer())

      await s3Client.send(new PutObjectCommand({
        Bucket: '444radio-media',
        Key: r2Key,
        Body: buffer,
        ContentType: file.type,
      }))

      const baseUrl = process.env.R2_PUBLIC_URL || process.env.NEXT_PUBLIC_R2_AUDIO_URL || 'https://media.444radio.co.in'
      const publicUrl = `${baseUrl}/${r2Key}`

      const { data: inserted, error: insertErr } = await supabase
        .from('nde_samples')
        .insert({
          user_id: userId,
          name: rawName,
          url: publicUrl,
          r2_key: r2Key,
          original_filename: file.name,
          file_size: file.size,
          content_type: file.type,
          original_bpm: originalBpm,
        })
        .select('id, name, url, original_filename, file_size, original_bpm, created_at')
        .single()

      if (insertErr) {
        console.error('[Studio samples] insert error:', insertErr)
        return corsResponse(NextResponse.json({ error: 'Save failed' }, { status: 500 }))
      }

      console.log(`✅ [Studio] Sample uploaded: ${rawName} → ${publicUrl}`)
      return corsResponse(NextResponse.json({ success: true, mode: 'server', sample: inserted }))
    }

    return corsResponse(NextResponse.json({ error: 'Invalid content type' }, { status: 400 }))
  } catch (err) {
    console.error('[Studio samples] POST error:', err)
    return corsResponse(NextResponse.json({ error: 'Upload failed' }, { status: 500 }))
  }
}

/**
 * DELETE /api/studio/samples?id=xxx — delete a custom sample
 */
export async function DELETE(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return corsResponse(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
    }

    const id = req.nextUrl.searchParams.get('id')
    if (!id) return corsResponse(NextResponse.json({ error: 'Missing id' }, { status: 400 }))

    const { data: sample, error: fetchErr } = await supabase
      .from('nde_samples')
      .select('id, user_id, r2_key, name')
      .eq('id', id)
      .single()

    if (fetchErr || !sample) {
      return corsResponse(NextResponse.json({ error: 'Not found' }, { status: 404 }))
    }
    if (sample.user_id !== userId) {
      return corsResponse(NextResponse.json({ error: 'Not yours' }, { status: 403 }))
    }

    try {
      await s3Client.send(new DeleteObjectCommand({
        Bucket: '444radio-media',
        Key: sample.r2_key,
      }))
    } catch (r2Err) {
      console.warn('[Studio samples] R2 delete warning:', r2Err)
    }

    await supabase.from('nde_samples').delete().eq('id', id)

    console.log(`🗑️ [Studio] Sample deleted: ${sample.name}`)
    return corsResponse(NextResponse.json({ success: true, deletedName: sample.name }))
  } catch (err) {
    console.error('[Studio samples] DELETE error:', err)
    return corsResponse(NextResponse.json({ error: 'Delete failed' }, { status: 500 }))
  }
}
