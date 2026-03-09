import { NextRequest, NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

/**
 * POST /api/webhook/generation-callback
 *
 * Receives callbacks from the music generation engine (V5).
 * V5 delivers track data via callback instead of embedding it in the poll response.
 * We store the payload in Supabase so the generate route can retrieve it.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    console.log('🔔 [Generation Callback] Received:', JSON.stringify(body).substring(0, 500))

    // Extract taskId from the callback payload
    const taskId = body?.data?.taskId || body?.taskId || body?.task_id
    if (taskId && supabaseUrl && supabaseKey) {
      // Store the callback data keyed by taskId
      await fetch(`${supabaseUrl}/rest/v1/generation_callbacks`, {
        method: 'POST',
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates',
        },
        body: JSON.stringify({
          task_id: taskId,
          payload: body,
          created_at: new Date().toISOString(),
        }),
      }).catch(err => {
        // If table doesn't exist yet, just log - polling retry will handle it
        console.warn('⚠️ [Generation Callback] Failed to store:', err)
      })
    }
  } catch {
    // Silently ignore parse errors
  }
  return NextResponse.json({ received: true })
}

export async function GET() {
  return NextResponse.json({ status: 'ok' })
}
