import { NextRequest, NextResponse } from 'next/server'
import { getAuthUserId } from '@/lib/hybrid-auth'
import { uploadToR2 } from '@/lib/r2-upload'

export async function POST(req: NextRequest) {
  try {
    const userId = await getAuthUserId(req)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await req.formData()
    const imageFile = formData.get('image') as File | null
    const audioFile = formData.get('audio') as File | null

    if (!imageFile && !audioFile) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 })
    }

    const result: { imageUrl?: string; audioUrl?: string } = {}

    // Upload image if provided
    if (imageFile) {
      const imageExt = imageFile.name.split('.').pop() || 'jpg'
      const imageKey = `lipsync/image-${userId}-${Date.now()}.${imageExt}`
      const imageUpload = await uploadToR2(imageFile, 'images', imageKey)
      
      if (!imageUpload.success || !imageUpload.url) {
        return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 })
      }
      
      result.imageUrl = imageUpload.url
    }

    // Upload audio if provided
    if (audioFile) {
      const audioExt = audioFile.name.split('.').pop() || 'mp3'
      const audioKey = `lipsync/audio-${userId}-${Date.now()}.${audioExt}`
      const audioUpload = await uploadToR2(audioFile, 'audio-files', audioKey)
      
      if (!audioUpload.success || !audioUpload.url) {
        return NextResponse.json({ error: 'Failed to upload audio' }, { status: 500 })
      }
      
      result.audioUrl = audioUpload.url
    }

    return NextResponse.json(result)

  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
