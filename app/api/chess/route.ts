/**
 * Chess API — Create and manage multiplayer chess games with credit wagers
 * POST /api/chess
 * Actions: create (new game with opponent + wager)
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'
import { corsResponse, handleOptions } from '@/lib/cors'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function OPTIONS() {
  return handleOptions()
}

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return corsResponse(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  }

  try {
    const body = await req.json()
    const { action } = body

    if (action === 'create') {
      return await handleCreate(userId, body)
    }

    return corsResponse(NextResponse.json({ error: 'Unknown action' }, { status: 400 }))
  } catch (error) {
    console.error('[chess] Error:', error)
    return corsResponse(NextResponse.json({ error: 'Internal server error' }, { status: 500 }))
  }
}

async function handleCreate(userId: string, body: { opponent: string; wager: number }) {
  const { opponent, wager = 0 } = body

  if (!opponent) {
    return corsResponse(NextResponse.json({ error: 'Opponent username required' }, { status: 400 }))
  }

  // Look up opponent by username
  const { data: opponentUser, error: lookupError } = await supabase
    .from('users')
    .select('clerk_user_id, username')
    .eq('username', opponent.toLowerCase())
    .single()

  if (lookupError || !opponentUser) {
    return corsResponse(NextResponse.json({ error: `User @${opponent} not found` }, { status: 404 }))
  }

  if (opponentUser.clerk_user_id === userId) {
    return corsResponse(NextResponse.json({ error: 'You cannot challenge yourself' }, { status: 400 }))
  }

  const wagerAmount = Math.max(0, Math.floor(wager))

  // If wager > 0, check both players have enough credits
  if (wagerAmount > 0) {
    const { data: challenger } = await supabase
      .from('users')
      .select('credits')
      .eq('clerk_user_id', userId)
      .single()

    if (!challenger || challenger.credits < wagerAmount) {
      return corsResponse(NextResponse.json({ error: 'Insufficient credits for wager' }, { status: 400 }))
    }

    const { data: opp } = await supabase
      .from('users')
      .select('credits')
      .eq('clerk_user_id', opponentUser.clerk_user_id)
      .single()

    if (!opp || opp.credits < wagerAmount) {
      return corsResponse(NextResponse.json({ error: `@${opponent} doesn't have enough credits for this wager` }, { status: 400 }))
    }

    // Deduct wager from challenger (escrow)
    const { data: deductResult } = await supabase.rpc('deduct_credits', {
      p_clerk_user_id: userId,
      p_amount: wagerAmount,
      p_type: 'chess_wager',
      p_description: `Chess wager vs @${opponent}`,
      p_metadata: {},
    })

    if (!deductResult?.[0]?.success) {
      return corsResponse(NextResponse.json({ error: 'Failed to escrow credits' }, { status: 500 }))
    }
  }

  // Create the game
  const { data: game, error: createError } = await supabase
    .from('chess_games')
    .insert({
      white_player_id: userId,
      black_player_id: opponentUser.clerk_user_id,
      wager: wagerAmount,
      status: 'pending', // Waiting for opponent to accept
      moves: [],
    })
    .select('id')
    .single()

  if (createError) {
    console.error('[chess] Create error:', createError)
    // Refund wager if game creation failed
    if (wagerAmount > 0) {
      await supabase.rpc('award_credits', {
        p_clerk_user_id: userId,
        p_amount: wagerAmount,
        p_type: 'chess_wager_refund',
        p_description: 'Chess wager refund — game creation failed',
        p_metadata: {},
      })
    }
    return corsResponse(NextResponse.json({ error: 'Failed to create game' }, { status: 500 }))
  }

  return corsResponse(NextResponse.json({
    success: true,
    gameId: game.id,
    message: `Challenge sent to @${opponent}${wagerAmount > 0 ? ` for ${wagerAmount} credits` : ''}`,
  }))
}
