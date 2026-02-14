/**
 * Plugin Atom API — LLM auto-fill for title, lyrics, genre, and prompt ideas.
 * 
 * POST /api/plugin/atom
 * Auth: Bearer <plugin_token>
 * Body: { action: 'title' | 'lyrics' | 'genre' | 'prompt-idea', prompt: string, genre?: string, promptType?: string }
 * 
 * Mirrors the website's /api/generate/atom-* endpoints but uses plugin token auth.
 */

import { NextRequest, NextResponse } from 'next/server'
import Replicate from 'replicate'
import { authenticatePlugin } from '@/lib/plugin-auth'
import { corsResponse, handleOptions } from '@/lib/cors'

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_KEY_LATEST2!,
})

export async function OPTIONS() {
  return handleOptions()
}

export async function POST(req: NextRequest) {
  const authResult = await authenticatePlugin(req)
  if (!authResult.valid) {
    return corsResponse(NextResponse.json({ error: authResult.error }, { status: authResult.status }))
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return corsResponse(NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }))
  }

  const action = body.action as string
  const prompt = (body.prompt as string || '').trim()

  if (!action) {
    return corsResponse(NextResponse.json({ error: 'Missing action' }, { status: 400 }))
  }

  try {
    switch (action) {
      case 'title': {
        if (!prompt) return corsResponse(NextResponse.json({ error: 'Missing prompt' }, { status: 400 }))
        const titlePrompts = [
          `Create a unique 2-word song title inspired by: "${prompt}". Be creative and original.`,
          `Generate a fresh 2-word music title based on: "${prompt}". Avoid common words.`,
          `Make a creative 2-word song name from this concept: "${prompt}". Be innovative.`,
          `Invent a catchy 2-word track title for: "${prompt}". Use unexpected word combinations.`,
          `Craft an original 2-word song title that captures: "${prompt}". Be unique.`
        ]
        const randomPrompt = titlePrompts[Math.floor(Math.random() * titlePrompts.length)]
        const output = await replicate.run("openai/gpt-5-nano", {
          input: { prompt: randomPrompt, temperature: 0.9, max_tokens: 10 }
        })
        let title = Array.isArray(output) ? output.join('') : String(output)
        title = title.trim().replace(/["'`]/g, '').replace(/\n/g, ' ').split(' ').slice(0, 4).join(' ')
        if (title.length > 60) title = title.substring(0, 60)
        if (title.length < 2) title = prompt.split(' ').slice(0, 2).join(' ')
        return corsResponse(NextResponse.json({ success: true, title }))
      }

      case 'lyrics': {
        if (!prompt) return corsResponse(NextResponse.json({ error: 'Missing prompt' }, { status: 400 }))
        const fullPrompt = `Generate lyrics based on my prompt - ${prompt} and the lyrics should be structured in [intro] [verse] [chorus] [hook] [bridge] [hook] [chorus] [outro] format under 600 characters`
        const output = await replicate.run("openai/gpt-5-nano", { input: { prompt: fullPrompt } })
        let lyrics = Array.isArray(output) ? output.join('') : String(output)
        if (lyrics.length > 600) {
          lyrics = lyrics.substring(0, 600).trim()
          const lastNewline = lyrics.lastIndexOf('\n')
          if (lastNewline > 500) lyrics = lyrics.substring(0, lastNewline)
        }
        return corsResponse(NextResponse.json({ success: true, lyrics }))
      }

      case 'genre': {
        if (!prompt) return corsResponse(NextResponse.json({ error: 'Missing prompt' }, { status: 400 }))
        const fullPrompt = `Based on this music prompt: "${prompt}", what is the most appropriate music genre? Choose ONE from: pop, rock, jazz, hip-hop, electronic, classical, country, blues, reggae, metal, folk, lofi. Only respond with the single genre word, nothing else.`
        const output = await replicate.run("openai/gpt-5-nano", { input: { prompt: fullPrompt } })
        let genre = Array.isArray(output) ? output.join('') : String(output)
        genre = genre.trim().toLowerCase().replace(/["'`]/g, '').replace(/\n/g, '').split(' ')[0]
        const validGenres = ['pop', 'rock', 'jazz', 'hip-hop', 'electronic', 'classical', 'country', 'blues', 'reggae', 'metal', 'folk', 'lofi']
        if (!validGenres.includes(genre)) genre = 'pop'
        return corsResponse(NextResponse.json({ success: true, genre }))
      }

      case 'prompt-idea': {
        const genre = (body.genre as string || 'electronic').trim()
        const promptType = (body.promptType as string || 'song')
        const fullPrompt = promptType === 'beat'
          ? `Generate a professional INSTRUMENTAL music production prompt in the ${genre} genre. CRITICAL RULES: This is 100% instrumental — NEVER mention vocals, voice, singing. Focus ONLY on: instruments, synths, drums, bass, production techniques, mood, atmosphere, tempo/energy. The prompt should be 200-265 characters. Generate ONLY the music prompt, nothing else:`
          : `Generate a professional music generation prompt for a complete song with vocals in the ${genre} genre. The prompt should be 200-265 characters, include specific instruments, production techniques, mood, atmosphere, tempo/energy, and sound professional. Generate ONLY the music prompt, nothing else:`
        const output = await replicate.run("openai/gpt-5-nano", { input: { prompt: fullPrompt } })
        let generatedPrompt = Array.isArray(output) ? output.join('').trim() : String(output).trim()
        generatedPrompt = generatedPrompt.replace(/^["']|["']$/g, '').replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim()
        if (promptType === 'beat') {
          generatedPrompt = generatedPrompt
            .replace(/\b(vocals?|voices?|singing|singer|sung|sing|vox|humming|chant(?:ing)?)\b/gi, '')
            .replace(/\s+/g, ' ').replace(/,\s*,+/g, ',').replace(/,\s*$/, '').replace(/^\s*,/, '').trim()
          if (!generatedPrompt.toLowerCase().includes('no vocal')) {
            generatedPrompt += ', no vocals, instrumental only'
          }
        }
        if (generatedPrompt.length > 300) generatedPrompt = generatedPrompt.substring(0, 297) + '...'
        return corsResponse(NextResponse.json({ success: true, prompt: generatedPrompt }))
      }

      default:
        return corsResponse(NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 }))
    }
  } catch (error: any) {
    console.error(`[plugin/atom] Error (${action}):`, error?.message || error)
    return corsResponse(NextResponse.json({
      error: '444 radio is locking in, please try again in few minutes'
    }, { status: 500 }))
  }
}
