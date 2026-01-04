import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import Replicate from 'replicate'

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

    return NextResponse.json({ 
      success: true,
      stems: {
        vocals: output.mdx_vocals,
        instrumental: output.mdx_other
      }
    })
  } catch (error) {
    console.error('Stem separation error:', error)
    return NextResponse.json({ error: 'Failed to split stems' }, { status: 500 })
  }
}
