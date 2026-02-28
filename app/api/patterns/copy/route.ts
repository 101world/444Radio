import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { corsResponse, handleOptions } from '@/lib/cors'

export async function OPTIONS() {
  return handleOptions()
}

// POST — increment copy count for a pattern
export async function POST(request: Request) {
  try {
    const { patternId } = await request.json()
    if (!patternId) {
      return corsResponse(NextResponse.json({ error: 'patternId required' }, { status: 400 }))
    }

    const { error } = await supabase.rpc('increment_pattern_copies', { pattern_id: patternId })

    // Fallback: read current value and increment manually if RPC doesn't exist
    if (error) {
      const { data: current } = await supabase
        .from('patterns')
        .select('copies')
        .eq('id', patternId)
        .single()

      if (current) {
        await supabase
          .from('patterns')
          .update({ copies: (current.copies || 0) + 1 })
          .eq('id', patternId)
      }
    }

    return corsResponse(NextResponse.json({ success: true }))
  } catch (err) {
    console.error('Pattern copy track error:', err)
    return corsResponse(NextResponse.json({ error: 'Internal server error' }, { status: 500 }))
  }
}
