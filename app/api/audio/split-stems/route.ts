import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import Replicate from 'replicate'
import { uploadToR2 } from '@/lib/r2-upload'

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN!
})

export async function POST(request: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { audioUrl } = await request.json()

    if (!audioUrl) {
      return NextResponse.json({ error: 'Audio URL required' }, { status: 400 })
    }

    // Run stem separation
    const output = await replicate.run(
      "erickluis00/all-in-one-audio:f2a8516c9084ef460592deaa397acd4a97f60f18c3d15d273644c72500cdff0e",
      {
        input: {
          music_input: audioUrl,
          audioSeparator: true,
          sonify: false,
          visualize: false,
          model: "harmonix-all",
          audioSeparatorModel: "Kim_Vocal_2.onnx"
        }
      }
    ) as any

    console.log('[Stem Split] Replicate output:', output)

    // Download stems from Replicate and upload to R2
    const vocalsUrl = Array.isArray(output.mdx_vocals) ? output.mdx_vocals[0] : output.mdx_vocals
    const instrumentalUrl = Array.isArray(output.mdx_other) ? output.mdx_other[0] : output.mdx_other

    // Download vocals
    const vocalsResponse = await fetch(vocalsUrl)
    const vocalsBlob = await vocalsResponse.blob()
    const vocalsFile = new File([vocalsBlob], 'vocals.mp3', { type: 'audio/mpeg' })

    // Download instrumental
    const instrumentalResponse = await fetch(instrumentalUrl)
    const instrumentalBlob = await instrumentalResponse.blob()
    const instrumentalFile = new File([instrumentalBlob], 'instrumental.mp3', { type: 'audio/mpeg' })

    // Upload to R2
    const timestamp = Date.now()
    const vocalsKey = `stems/${userId}/vocals-${timestamp}.mp3`
    const instrumentalKey = `stems/${userId}/instrumental-${timestamp}.mp3`

    const vocalsUpload = await uploadToR2(vocalsFile, 'audio-files', vocalsKey)
    const instrumentalUpload = await uploadToR2(instrumentalFile, 'audio-files', instrumentalKey)

    if (!vocalsUpload.success || !instrumentalUpload.success) {
      throw new Error('Failed to upload stems to R2')
    }

    return NextResponse.json({ 
      success: true,
      stems: {
        vocals: vocalsUpload.url,
        instrumental: instrumentalUpload.url
      }
    })
  } catch (error) {
    console.error('Stem separation error:', error)
    return NextResponse.json({ error: 'Failed to split stems' }, { status: 500 })
  }
}
