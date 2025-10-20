import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await req.formData()
    const title = formData.get('title') as string
    const type = formData.get('type') as 'music-image' | 'image' | 'video'

    if (!title || !type) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 })
    }

    interface UploadData {
      user_id: string
      title: string
      content_type: string
      is_public: boolean
      created_at: string
      audio_url?: string
      image_url?: string
      video_url?: string
    }

    const uploadData: UploadData = {
      user_id: userId,
      title,
      content_type: type,
      is_public: true,
      created_at: new Date().toISOString()
    }

    // Handle different upload types
    if (type === 'music-image') {
      const audioFile = formData.get('audio') as File
      const imageFile = formData.get('image') as File

      if (!audioFile || !imageFile) {
        return NextResponse.json({ success: false, error: 'Missing audio or image file' }, { status: 400 })
      }

      // Upload audio to Supabase Storage
      const audioFileName = `${userId}/${Date.now()}-${audioFile.name}`
      const audioBuffer = await audioFile.arrayBuffer()
      const { error: audioError } = await supabase.storage
        .from('audio-files')
        .upload(audioFileName, audioBuffer, {
          contentType: audioFile.type,
          upsert: false
        })

      if (audioError) {
        console.error('Audio upload error:', audioError)
        return NextResponse.json({ success: false, error: 'Audio upload failed' }, { status: 500 })
      }

      // Upload image to Supabase Storage
      const imageFileName = `${userId}/${Date.now()}-${imageFile.name}`
      const imageBuffer = await imageFile.arrayBuffer()
      const { error: imageError } = await supabase.storage
        .from('images')
        .upload(imageFileName, imageBuffer, {
          contentType: imageFile.type,
          upsert: false
        })

      if (imageError) {
        console.error('Image upload error:', imageError)
        return NextResponse.json({ success: false, error: 'Image upload failed' }, { status: 500 })
      }

      // Get public URLs
      const { data: audioUrlData } = supabase.storage.from('audio-files').getPublicUrl(audioFileName)
      const { data: imageUrlData } = supabase.storage.from('images').getPublicUrl(imageFileName)

      uploadData.audio_url = audioUrlData.publicUrl
      uploadData.image_url = imageUrlData.publicUrl

      // Save to combined_media table
      const { data, error } = await supabase
        .from('combined_media')
        .insert([uploadData])
        .select()

      if (error) {
        console.error('Database error:', error)
        return NextResponse.json({ success: false, error: 'Failed to save to database' }, { status: 500 })
      }

      return NextResponse.json({ success: true, data: data[0] })

    } else if (type === 'image') {
      const imageFile = formData.get('image') as File

      if (!imageFile) {
        return NextResponse.json({ success: false, error: 'Missing image file' }, { status: 400 })
      }

      // Upload image to Supabase Storage
      const imageFileName = `${userId}/${Date.now()}-${imageFile.name}`
      const imageBuffer = await imageFile.arrayBuffer()
      const { error: imageError } = await supabase.storage
        .from('images')
        .upload(imageFileName, imageBuffer, {
          contentType: imageFile.type,
          upsert: false
        })

      if (imageError) {
        console.error('Image upload error:', imageError)
        return NextResponse.json({ success: false, error: 'Image upload failed' }, { status: 500 })
      }

      // Get public URL
      const { data: imageUrlData } = supabase.storage.from('images').getPublicUrl(imageFileName)

      uploadData.image_url = imageUrlData.publicUrl

      // Save to profile_media table (we'll create this for standalone images/videos)
      const { data, error } = await supabase
        .from('profile_media')
        .insert([uploadData])
        .select()

      if (error) {
        console.error('Database error:', error)
        return NextResponse.json({ success: false, error: 'Failed to save to database' }, { status: 500 })
      }

      return NextResponse.json({ success: true, data: data[0] })

    } else if (type === 'video') {
      const videoFile = formData.get('video') as File

      if (!videoFile) {
        return NextResponse.json({ success: false, error: 'Missing video file' }, { status: 400 })
      }

      // Upload video to Supabase Storage
      const videoFileName = `${userId}/${Date.now()}-${videoFile.name}`
      const videoBuffer = await videoFile.arrayBuffer()
      const { error: videoError } = await supabase.storage
        .from('videos')
        .upload(videoFileName, videoBuffer, {
          contentType: videoFile.type,
          upsert: false
        })

      if (videoError) {
        console.error('Video upload error:', videoError)
        return NextResponse.json({ success: false, error: 'Video upload failed' }, { status: 500 })
      }

      // Get public URL
      const { data: videoUrlData } = supabase.storage.from('videos').getPublicUrl(videoFileName)

      uploadData.video_url = videoUrlData.publicUrl

      // Save to profile_media table
      const { data, error } = await supabase
        .from('profile_media')
        .insert([uploadData])
        .select()

      if (error) {
        console.error('Database error:', error)
        return NextResponse.json({ success: false, error: 'Failed to save to database' }, { status: 500 })
      }

      return NextResponse.json({ success: true, data: data[0] })
    }

    return NextResponse.json({ success: false, error: 'Invalid upload type' }, { status: 400 })

  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
