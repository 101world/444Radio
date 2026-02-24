import { NextRequest, NextResponse } from 'next/server'
import { getAuthUserId } from '@/lib/hybrid-auth'
import Replicate from 'replicate'
import { corsResponse, handleOptions } from '@/lib/cors'

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_KEY_LATEST2!,
})

export async function OPTIONS() {
  return handleOptions()
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getAuthUserId(req)
    if (!userId) {
      return corsResponse(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
    }

    const body = await req.json()
    const prompt = (body.prompt as string || '').trim()
    const style = (body.style as string || '').trim()

    let fullPrompt: string
    if (prompt) {
      // Enhance existing prompt
      fullPrompt = `You are a world-class album cover art director. Take this concept and transform it into a stunning, highly detailed image generation prompt for an AI image model. Make it cinematic, abstract, visually striking, and artistic. Add specific visual elements like lighting, color palette, composition, texture, and mood. Keep it under 400 characters.\n\nUser concept: "${prompt}"${style ? `\nStyle direction: ${style}` : ''}\n\nRespond ONLY with the enhanced image prompt, nothing else:`
    } else {
      // Generate fresh random prompt
      const styles = [
        'cyberpunk neon city reflections with glitch art and holographic overlays',
        'dark surreal dreamscape with floating geometric shapes and bioluminescent fog',
        'abstract liquid chrome sculpture with iridescent rainbow refractions on black',
        'retro-futuristic VHS aesthetic with scan lines, warped grids, and sunset gradients',
        'ethereal underwater cathedral with jellyfish light trails and coral architecture',
        'brutalist concrete architecture with dramatic golden hour shadows and film grain',
        'cosmic nebula explosion with crystalline fractals and deep space aurora',
        'oil painting style dark forest with mystical light shafts and particle effects',
        'Japanese ukiyo-e wave reimagined with electric blue neon and circuit patterns',
        'macro photography of melting vinyl records with prismatic light dispersion',
        'deconstructed portrait with double exposure, smoke tendrils, and gold leaf',
        'abandoned futuristic train station overgrown with luminous alien vegetation',
      ]
      const randomStyle = styles[Math.floor(Math.random() * styles.length)]
      fullPrompt = `Generate a stunning, highly detailed image generation prompt for album cover art. The visual concept is: ${randomStyle}. Include specific details about lighting, color palette, composition, texture, depth, and mood. Make it cinematic and visually striking. Keep it under 400 characters. Respond ONLY with the image prompt, nothing else:`
    }

    const output = await replicate.run("openai/gpt-5-nano", {
      input: { prompt: fullPrompt, temperature: 0.85, max_tokens: 200 }
    })
    let coverPrompt = Array.isArray(output) ? output.join('').trim() : String(output).trim()
    coverPrompt = coverPrompt.replace(/^["']|["']$/g, '').replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim()
    if (coverPrompt.length > 450) coverPrompt = coverPrompt.substring(0, 447) + '...'
    if (coverPrompt.length < 10) {
      coverPrompt = 'Cinematic neon cityscape at midnight, reflections on wet asphalt, holographic billboards with glitch artifacts, deep purple and electric cyan color palette, atmospheric fog with volumetric lighting, wide-angle composition'
    }

    return corsResponse(NextResponse.json({ success: true, prompt: coverPrompt }))
  } catch (error: any) {
    console.error('[atom-cover-art] Error:', error?.message || error)
    return corsResponse(NextResponse.json({
      error: '444 radio is locking in, please try again in few minutes'
    }, { status: 500 }))
  }
}
