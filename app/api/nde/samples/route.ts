import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
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
 * GET /api/nde/samples — list user's custom NDE samples
 */
export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) {
      return corsResponse(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
    }

    const { data, error } = await supabase
      .from('nde_samples')
      .select('id, name, url, original_filename, duration_ms, file_size, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[NDE samples] fetch error:', error)
      return corsResponse(NextResponse.json({ error: 'Failed to fetch samples' }, { status: 500 }))
    }

    return corsResponse(NextResponse.json({ samples: data || [] }))
  } catch (err) {
    console.error('[NDE samples] GET error:', err)
    return corsResponse(NextResponse.json({ error: 'Internal error' }, { status: 500 }))
  }
}

/**
 * POST /api/nde/samples — upload a custom sample
 * FormData: file (audio), name (string)
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return corsResponse(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const name = (formData.get('name') as string || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_')

    if (!file) {
      return corsResponse(NextResponse.json({ error: 'No file provided' }, { status: 400 }))
    }
    if (!name || name.length < 2 || name.length > 32) {
      return corsResponse(NextResponse.json({ error: 'Name must be 2-32 characters (lowercase, no spaces)' }, { status: 400 }))
    }
    if (!file.type.startsWith('audio/')) {
      return corsResponse(NextResponse.json({ error: 'File must be audio' }, { status: 400 }))
    }

    // 4MB limit (Vercel serverless body limit is ~4.5MB)
    const MAX_SIZE = 4 * 1024 * 1024
    if (file.size > MAX_SIZE) {
      return corsResponse(NextResponse.json({ error: 'Sample must be under 4MB' }, { status: 400 }))
    }

    // Check user doesn't exceed 50 custom samples
    const { count } = await supabase
      .from('nde_samples')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)

    if ((count || 0) >= 50) {
      return corsResponse(NextResponse.json({ error: 'Maximum 50 custom samples reached. Delete some to upload more.' }, { status: 400 }))
    }

    // Check name uniqueness for this user
    const { data: existing } = await supabase
      .from('nde_samples')
      .select('id')
      .eq('user_id', userId)
      .eq('name', name)
      .limit(1)

    if (existing && existing.length > 0) {
      return corsResponse(NextResponse.json({ error: `Sample name "${name}" already exists. Choose a different name.` }, { status: 400 }))
    }

    // Upload to R2
    const ext = file.name.split('.').pop()?.toLowerCase() || 'wav'
    const timestamp = Date.now()
    const r2Key = `nde-samples/${userId}/${timestamp}-${name}.${ext}`
    const buffer = Buffer.from(await file.arrayBuffer())

    await s3Client.send(new PutObjectCommand({
      Bucket: '444radio-media',
      Key: r2Key,
      Body: buffer,
      ContentType: file.type,
    }))

    const baseUrl = process.env.R2_PUBLIC_URL || process.env.NEXT_PUBLIC_R2_AUDIO_URL || 'https://media.444radio.co.in'
    const publicUrl = `${baseUrl}/${r2Key}`

    // Save metadata to Supabase
    const { data: inserted, error: insertError } = await supabase
      .from('nde_samples')
      .insert({
        user_id: userId,
        name,
        url: publicUrl,
        r2_key: r2Key,
        original_filename: file.name,
        file_size: file.size,
        content_type: file.type,
      })
      .select('id, name, url, original_filename, file_size, created_at')
      .single()

    if (insertError) {
      console.error('[NDE samples] insert error:', insertError)
      return corsResponse(NextResponse.json({ error: 'Failed to save sample metadata' }, { status: 500 }))
    }

    console.log(`✅ [NDE] Custom sample uploaded: ${name} → ${publicUrl}`)

    return corsResponse(NextResponse.json({
      success: true,
      sample: inserted,
    }))
  } catch (err) {
    console.error('[NDE samples] POST error:', err)
    return corsResponse(NextResponse.json({ error: 'Upload failed' }, { status: 500 }))
  }
}

/**
 * DELETE /api/nde/samples?id=xxx — delete a custom sample
 */
export async function DELETE(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return corsResponse(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
    }

    const id = req.nextUrl.searchParams.get('id')
    if (!id) {
      return corsResponse(NextResponse.json({ error: 'Missing sample id' }, { status: 400 }))
    }

    // Get the sample to check ownership and get R2 key
    const { data: sample, error: fetchErr } = await supabase
      .from('nde_samples')
      .select('id, user_id, r2_key, name')
      .eq('id', id)
      .single()

    if (fetchErr || !sample) {
      return corsResponse(NextResponse.json({ error: 'Sample not found' }, { status: 404 }))
    }
    if (sample.user_id !== userId) {
      return corsResponse(NextResponse.json({ error: 'Not your sample' }, { status: 403 }))
    }

    // Delete from R2
    try {
      await s3Client.send(new DeleteObjectCommand({
        Bucket: '444radio-media',
        Key: sample.r2_key,
      }))
    } catch (r2Err) {
      console.warn('[NDE samples] R2 delete failed (non-fatal):', r2Err)
    }

    // Delete from Supabase
    const { error: delErr } = await supabase
      .from('nde_samples')
      .delete()
      .eq('id', id)

    if (delErr) {
      console.error('[NDE samples] delete error:', delErr)
      return corsResponse(NextResponse.json({ error: 'Failed to delete' }, { status: 500 }))
    }

    console.log(`🗑️ [NDE] Custom sample deleted: ${sample.name}`)

    return corsResponse(NextResponse.json({ success: true, deletedName: sample.name }))
  } catch (err) {
    console.error('[NDE samples] DELETE error:', err)
    return corsResponse(NextResponse.json({ error: 'Delete failed' }, { status: 500 }))
  }
}
