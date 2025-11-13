import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3'

/**
 * GET /api/r2/list-audio
 * Lists ALL audio files from R2 bucket
 */
export async function GET() {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const s3Client = new S3Client({
      region: 'auto',
      endpoint: process.env.R2_ENDPOINT!,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!
      }
    })

    const primaryBucket = (process.env.R2_BUCKET_NAME || '').trim()
    const fallbackBucket = 'audio-files'
    const bucketsToTry = Array.from(new Set([primaryBucket, fallbackBucket].filter(Boolean)))

    const audioBaseUrl = process.env.NEXT_PUBLIC_R2_AUDIO_URL!

    const listAll = async (bucket: string) => {
      let isTruncated: boolean = true
      let continuationToken: string | undefined = undefined
      const objects: any[] = []
      while (isTruncated) {
        const resp: any = await s3Client.send(new ListObjectsV2Command({
          Bucket: bucket,
          ContinuationToken: continuationToken
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
        console.log('🪣 Trying to list bucket:', b)
        const listed = await listAll(b)
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

    const tracks = (files || []).map((file, index) => ({
      id: file.Key || `r2-${index}`,
      title: (file.Key || '').replace(/\.(mp3|wav|ogg)$/i, '') || `Track ${index + 1}`,
      prompt: 'Generated music',
      lyrics: null,
      audio_url: `${audioBaseUrl}/${file.Key}`,
      created_at: (file.LastModified ? new Date(file.LastModified).toISOString() : new Date().toISOString()),
      file_size: file.Size || 0,
      source: 'r2'
    }))

    return NextResponse.json({
      success: true,
      bucketTried: bucketsToTry,
      bucketUsed: usedBucket,
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
