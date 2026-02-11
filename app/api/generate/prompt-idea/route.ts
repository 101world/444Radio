import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import Replicate from 'replicate'

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN!
})

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { genre, promptType, systemPrompt } = await request.json()

    if (!genre || !promptType || !systemPrompt) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    console.log(`🎨 Generating ${promptType} prompt for ${genre}...`)

    // Use Meta Llama for fast, high-quality prompt generation
    const output = await replicate.run(
      "meta/meta-llama-3-70b-instruct:fbfb20b472b2f3bdd101412a9f70a0ed4fc0ced78a77ff00970ee7a2383c575d",
      {
        input: {
          top_p: 0.9,
          prompt: systemPrompt,
          max_tokens: 512,
          temperature: 0.85,
          system_prompt: "You are a professional music producer. Generate ONLY the prompt text with no explanations or extra text.",
          length_penalty: 1,
          max_new_tokens: 512,
          stop_sequences: "\n\n",
          prompt_template: "{prompt}",
          presence_penalty: 0,
          log_performance_metrics: false
        }
      }
    ) as string[]

    const generatedPrompt = Array.isArray(output) ? output.join('').trim() : String(output).trim()

    // Clean up the prompt
    let cleanPrompt = generatedPrompt
      .replace(/^["']|["']$/g, '') // Remove quotes
      .replace(/\n+/g, ' ') // Remove newlines
      .replace(/\s+/g, ' ') // Normalize spaces
      .trim()

    // Ensure it's within character limit
    if (cleanPrompt.length > 265) {
      cleanPrompt = cleanPrompt.slice(0, 265).trim()
    }

    // Ensure it's at least 200 characters for quality
    if (cleanPrompt.length < 200) {
      cleanPrompt += `. Professional mixing and mastering with warm analog character and spatial depth.`
      if (cleanPrompt.length > 265) {
        cleanPrompt = cleanPrompt.slice(0, 265).trim()
      }
    }

    console.log(`✅ Generated prompt (${cleanPrompt.length} chars):`, cleanPrompt)

    return NextResponse.json({
      success: true,
      prompt: cleanPrompt,
      genre,
      type: promptType
    })
  } catch (error: any) {
    console.error('❌ Prompt generation error:', error)
    return NextResponse.json(
      {
        error: error.message || 'Failed to generate prompt',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}
