import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { corsResponse, handleOptions } from '@/lib/cors'
import { createClient } from '@supabase/supabase-js'

export async function OPTIONS() { return handleOptions() }

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) {
      return corsResponse(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
    }

    const diagnostics: Record<string, unknown> = { userId, timestamp: new Date().toISOString() }

    // Check env vars
    diagnostics.hasSupabaseUrl = !!process.env.NEXT_PUBLIC_SUPABASE_URL
    diagnostics.hasServiceRoleKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY
    diagnostics.serviceRoleKeyPrefix = process.env.SUPABASE_SERVICE_ROLE_KEY?.substring(0, 10) + '...'

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      diagnostics.error = 'Missing env vars'
      return corsResponse(NextResponse.json(diagnostics))
    }

    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

    // Check user_likes table exists and is accessible
    const { data: likesTable, error: likesErr } = await supabase
      .from('user_likes')
      .select('id')
      .limit(1)

    diagnostics.userLikesTable = {
      accessible: !likesErr,
      error: likesErr ? { message: likesErr.message, code: likesErr.code, details: likesErr.details } : null,
      sampleCount: likesTable?.length || 0
    }

    // Check combined_media likes column
    const { data: mediaRow, error: mediaErr } = await supabase
      .from('combined_media')
      .select('id, likes, likes_count')
      .limit(1)

    diagnostics.combinedMediaLikes = {
      accessible: !mediaErr,
      error: mediaErr ? { message: mediaErr.message, code: mediaErr.code, details: mediaErr.details } : null,
      sampleRow: mediaRow?.[0] || null,
      hasLikesColumn: mediaRow?.[0] ? 'likes' in mediaRow[0] : 'unknown',
      hasLikesCountColumn: mediaRow?.[0] ? 'likes_count' in mediaRow[0] : 'unknown'
    }

    // Check user's total likes
    const { data: userLikes, error: userLikesErr } = await supabase
      .from('user_likes')
      .select('id, release_id')
      .eq('user_id', userId)
      .limit(5)

    diagnostics.currentUserLikes = {
      count: userLikes?.length || 0,
      error: userLikesErr ? userLikesErr.message : null,
      releases: userLikes?.map(l => l.release_id) || []
    }

    // Count total rows in user_likes
    const { data: allLikes, error: allErr } = await supabase
      .from('user_likes')
      .select('id')

    diagnostics.totalLikesInTable = allLikes?.length || 0
    diagnostics.totalLikesError = allErr?.message || null

    // Test a write — insert and immediately delete
    const testId = '00000000-0000-0000-0000-000000000000'
    const { error: testInsert } = await supabase
      .from('user_likes')
      .insert({ user_id: userId, release_id: testId })

    diagnostics.writeTest = {
      insertError: testInsert ? { message: testInsert.message, code: testInsert.code, hint: testInsert.hint } : null,
      insertSuccess: !testInsert,
      cleanedUp: false
    }

    // Clean up test row
    if (!testInsert) {
      await supabase.from('user_likes').delete().eq('user_id', userId).eq('release_id', testId)
      ;(diagnostics.writeTest as any).cleanedUp = true
    }

    return corsResponse(NextResponse.json(diagnostics))
  } catch (error) {
    return corsResponse(NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 }))
  }
}
