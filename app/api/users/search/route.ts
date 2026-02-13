import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'
import { corsResponse, handleOptions } from '@/lib/cors'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export function OPTIONS() { return handleOptions() }

// GET /api/users/search?q=username_query
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return corsResponse(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
    }

    const { searchParams } = new URL(req.url)
    const q = searchParams.get('q')?.trim()

    if (!q || q.length < 1) {
      return corsResponse(NextResponse.json({ users: [] }))
    }

    // Strip leading @ if present
    const query = q.startsWith('@') ? q.slice(1) : q

    if (!query) {
      return corsResponse(NextResponse.json({ users: [] }))
    }

    const { data, error } = await supabase
      .from('users')
      .select('clerk_user_id, username, avatar_url')
      .ilike('username', `%${query}%`)
      .limit(8)

    if (error) {
      console.error('User search error:', error)
      return corsResponse(NextResponse.json({ users: [] }))
    }

    const users = (data || []).map(u => ({
      id: u.clerk_user_id,
      username: u.username || 'Unknown',
      avatar_url: u.avatar_url || '/default-avatar.png',
    }))

    return corsResponse(NextResponse.json({ users }))
  } catch (error) {
    console.error('User search error:', error)
    return corsResponse(NextResponse.json({ users: [] }))
  }
}
