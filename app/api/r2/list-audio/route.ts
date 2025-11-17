import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3'

/**
 * GET /api/r2/list-audio
 * Lists ALL audio files from R2 bucket
 */
export async function GET(request: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if R2 credentials are configured
    if (!process.env.R2_ENDPOINT || !process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY) {
      console.warn('⚠️ R2 credentials not configured, returning empty list')
      return NextResponse.json({
        success: true,
        music: [],
        count: 0,
        message: 'R2 storage not configured'
      })
    }

    // Allow optional query param all=true for admin/full listing (not filtered by user)
    const url = new URL(request.url)
    const listAllParam = url.searchParams.get('all') === 'true'
    // Don't use folder prefix - R2 files may be stored flat or in various structures
    // We'll filter by userId in the filename/metadata instead
    const userPrefix = undefined // Disabled prefix filtering to catch all user files

    const s3Client = new S3Client({
      region: 'auto',
      endpoint: process.env.R2_ENDPOINT!,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!
      }
    })

    const primaryBucket = (process.env.R2_AUDIO_BUCKET_NAME || process.env.R2_BUCKET_NAME || '').trim()
    const fallbackBucket = 'audio-files'
    const bucketsToTry = Array.from(new Set([primaryBucket, fallbackBucket].filter(Boolean)))

    const audioBaseUrl = process.env.NEXT_PUBLIC_R2_AUDIO_URL!

    const listAll = async (bucket: string, prefix?: string) => {
      let isTruncated: boolean = true
      let continuationToken: string | undefined = undefined
      const objects: any[] = []
      while (isTruncated) {
        const resp: any = await s3Client.send(new ListObjectsV2Command({
          Bucket: bucket,
          ContinuationToken: continuationToken,
          Prefix: prefix
        }))
        const page: any[] = resp?.Contents || []
        objects.push(...page)
        isTruncated = !!resp?.IsTruncated
        continuationToken = resp?.NextContinuationToken
      }
      return objects
    }

    let files: any[] = []
    let usedBucket = ''
    let lastError: any = null

    for (const b of bucketsToTry) {
      try {
        console.log('🪣 Listing bucket:', b, 'user:', userId, 'scope:', listAllParam ? 'ALL' : 'user files')
        const listed = await listAll(b, undefined) // List all files, we'll filter later
        if (listed.length > 0) {
          files = listed
          usedBucket = b
          break
        }
        // If zero, still accept but continue to try fallback
        if (files.length === 0) {
          files = listed
          usedBucket = b
        }
      } catch (err) {
        lastError = err
        console.warn('⚠️ Failed listing bucket', b, err)
        continue
      }
    }

    const tracks = (files || [])
      .filter(f => !!f.Key && /\.(mp3|wav|ogg)$/i.test(f.Key))
      // Filter files that belong to this user (by checking if Key contains userId or belongs to user's folder)
      .filter(f => !listAllParam && (f.Key.includes(userId) || f.Key.startsWith(`users/${userId}/`) || f.Key.startsWith(`${userId}/`)))
      .map((file, index) => {
      const key: string = file.Key
      // Extract original filename for title
      const baseName = key.split('/').pop() || key
      const title = baseName.replace(/\.(mp3|wav|ogg)$/i, '')
      return {
        id: key,
        title: title || `Track ${index + 1}`,
        prompt: 'Generated music',
        lyrics: null,
        audio_url: `${audioBaseUrl}/${key}`,
        created_at: (file.LastModified ? new Date(file.LastModified).toISOString() : new Date().toISOString()),
        file_size: file.Size || 0,
        source: 'r2'
      }
    })

    return NextResponse.json({
      success: true,
      bucketTried: bucketsToTry,
      bucketUsed: usedBucket,
      prefixUsed: listAllParam ? null : userPrefix,
      scope: listAllParam ? 'all' : 'user',
      music: tracks,
      count: tracks.length,
      error: tracks.length === 0 && lastError ? String(lastError) : undefined
    })

  } catch (error: any) {
    console.error('Error listing R2 files:', error)
    
    // If R2 listing fails, return empty array instead of error
    return NextResponse.json({
      success: true,
      music: [],
      count: 0,
      error: error.message
    })
  }
}
