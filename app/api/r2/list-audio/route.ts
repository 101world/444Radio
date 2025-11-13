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

    const bucketName = process.env.R2_BUCKET_NAME || 'audio-files'
    console.log('🪣 Listing bucket:', bucketName)

    const command = new ListObjectsV2Command({
      Bucket: bucketName
    })
    
    const response = await s3Client.send(command)
    const files = response.Contents || []
    
    const audioBaseUrl = process.env.NEXT_PUBLIC_R2_AUDIO_URL!
    
    // Transform R2 files to library format
    const tracks = files.map((file, index) => ({
      id: file.Key || `r2-${index}`,
      title: file.Key?.replace('.mp3', '').replace('.wav', '') || `Track ${index + 1}`,
      prompt: 'Generated music',
      lyrics: null,
      audio_url: `${audioBaseUrl}/${file.Key}`,
      created_at: file.LastModified?.toISOString() || new Date().toISOString(),
      file_size: file.Size || 0,
      source: 'r2'
    }))

    return NextResponse.json({
      success: true,
      music: tracks,
      count: tracks.length
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
