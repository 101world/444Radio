/**
 * Chess API — Create and manage multiplayer chess games with credit wagers
 * POST /api/chess
 * Actions: create, accept, decline, settle
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

    if (action === 'create') return await handleCreate(userId, body)
    if (action === 'accept') return await handleAccept(userId, body)
    if (action === 'decline') return await handleDecline(userId, body)
    if (action === 'settle') return await handleSettle(userId, body)

    return corsResponse(NextResponse.json({ error: 'Unknown action' }, { status: 400 }))
  } catch (error) {
    console.error('[chess] Error:', error)
    return corsResponse(NextResponse.json({ error: 'Internal server error' }, { status: 500 }))
  }
}

// ─── Helper: look up username from clerk_user_id ───
async function getUsername(clerkUserId: string): Promise<string> {
  const { data } = await supabase
    .from('users')
    .select('username')
    .eq('clerk_user_id', clerkUserId)
    .single()
  return data?.username || 'Unknown'
}

// ─── CREATE: challenge a player ───
async function handleCreate(userId: string, body: { opponent: string; wager: number }) {
  const { opponent, wager = 0 } = body

  if (!opponent) {
    return corsResponse(NextResponse.json({ error: 'Opponent username required' }, { status: 400 }))
  }

  // Look up opponent by username (case-insensitive exact match)
  const opponentClean = opponent.toLowerCase().replace('@', '').trim()

  const { data: opponentUser, error: lookupError } = await supabase
    .from('users')
    .select('clerk_user_id, username')
    .ilike('username', opponentClean)
    .single()

  if (lookupError || !opponentUser) {
    // Try partial match to suggest correct username
    const { data: suggestions } = await supabase
      .from('users')
      .select('username')
      .ilike('username', `%${opponentClean}%`)
      .limit(3)

    const suggestionText = suggestions && suggestions.length > 0
      ? ` Did you mean: ${suggestions.map(s => `@${s.username}`).join(', ')}?`
      : ''

    return corsResponse(NextResponse.json({ error: `User @${opponentClean} not found.${suggestionText}` }, { status: 404 }))
  }

  if (opponentUser.clerk_user_id === userId) {
    return corsResponse(NextResponse.json({ error: 'You cannot challenge yourself' }, { status: 400 }))
  }

  const wagerAmount = Math.max(0, Math.floor(wager))

  // If wager > 0, check challenger has enough credits
  if (wagerAmount > 0) {
    const { data: challenger } = await supabase
      .from('users')
      .select('credits')
      .eq('clerk_user_id', userId)
      .single()

    if (!challenger || challenger.credits < wagerAmount) {
      return corsResponse(NextResponse.json({ error: 'You don\'t have enough credits for this wager' }, { status: 400 }))
    }

    // Deduct wager from challenger (escrow)
    const { data: deductResult } = await supabase.rpc('deduct_credits', {
      p_clerk_user_id: userId,
      p_amount: wagerAmount,
      p_type: 'chess_wager',
      p_description: `Chess wager vs @${opponentUser.username}`,
      p_metadata: {},
    })

    if (!deductResult?.[0]?.success) {
      return corsResponse(NextResponse.json({ error: 'Failed to escrow credits' }, { status: 500 }))
    }
  }

  const challengerUsername = await getUsername(userId)

  // Create the game
  const { data: game, error: createError } = await supabase
    .from('chess_games')
    .insert({
      white_player_id: userId,
      black_player_id: opponentUser.clerk_user_id,
      wager: wagerAmount,
      status: 'pending',
      moves: [],
    })
    .select('id')
    .single()

  if (createError) {
    console.error('[chess] Create error:', createError)
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

  // Send notification to opponent
  const insertResult = await supabase.from('notifications').insert({
    user_id: opponentUser.clerk_user_id,
    type: 'chess_challenge',
    title: '♟️ Chess Challenge!',
    message: `@${challengerUsername} challenged you to chess${wagerAmount > 0 ? ` for ${wagerAmount} credits` : ''}!`,
    metadata: {
      gameId: game.id,
      challengerId: userId,
      challengerUsername,
      wager: wagerAmount,
    },
  })
  if (insertResult.error) {
    console.error('[chess] Notification insert error:', insertResult.error)
  }

  return corsResponse(NextResponse.json({
    success: true,
    gameId: game.id,
    message: `Challenge sent to @${opponentUser.username}${wagerAmount > 0 ? ` for ${wagerAmount} credits` : ''}! They'll get a notification.`,
  }))
}

// ─── ACCEPT: opponent accepts challenge ───
async function handleAccept(userId: string, body: { gameId: string }) {
  const { gameId } = body
  if (!gameId) return corsResponse(NextResponse.json({ error: 'Game ID required' }, { status: 400 }))

  const { data: game, error } = await supabase
    .from('chess_games')
    .select('*')
    .eq('id', gameId)
    .single()

  if (error || !game) {
    return corsResponse(NextResponse.json({ error: 'Game not found' }, { status: 404 }))
  }

  if (game.black_player_id !== userId) {
    return corsResponse(NextResponse.json({ error: 'Only the challenged player can accept' }, { status: 403 }))
  }

  if (game.status !== 'pending') {
    return corsResponse(NextResponse.json({ error: 'This challenge is no longer pending' }, { status: 400 }))
  }

  // If wager > 0, escrow opponent's credits too
  if (game.wager > 0) {
    const { data: opp } = await supabase
      .from('users')
      .select('credits')
      .eq('clerk_user_id', userId)
      .single()

    if (!opp || opp.credits < game.wager) {
      return corsResponse(NextResponse.json({ error: `You need ${game.wager} credits to accept this wager` }, { status: 400 }))
    }

    const { data: deductResult } = await supabase.rpc('deduct_credits', {
      p_clerk_user_id: userId,
      p_amount: game.wager,
      p_type: 'chess_wager',
      p_description: `Chess wager accepted — ${game.wager} credits escrowed`,
      p_metadata: { gameId },
    })

    if (!deductResult?.[0]?.success) {
      return corsResponse(NextResponse.json({ error: 'Failed to escrow your credits' }, { status: 500 }))
    }
  }

  // Update game status to active
  await supabase
    .from('chess_games')
    .update({ status: 'active' })
    .eq('id', gameId)

  // Notify challenger
  const accepterUsername = await getUsername(userId)
  await supabase.from('notifications').insert({
    user_id: game.white_player_id,
    type: 'chess_accepted',
    title: '♟️ Challenge Accepted!',
    message: `@${accepterUsername} accepted your chess challenge${game.wager > 0 ? ` (${game.wager} credits each)` : ''}!`,
    metadata: { gameId },
  })

  return corsResponse(NextResponse.json({ success: true, message: 'Challenge accepted! Game is now active.' }))
}

// ─── DECLINE: opponent declines challenge ───
async function handleDecline(userId: string, body: { gameId: string }) {
  const { gameId } = body
  if (!gameId) return corsResponse(NextResponse.json({ error: 'Game ID required' }, { status: 400 }))

  const { data: game, error } = await supabase
    .from('chess_games')
    .select('*')
    .eq('id', gameId)
    .single()

  if (error || !game) {
    return corsResponse(NextResponse.json({ error: 'Game not found' }, { status: 404 }))
  }

  if (game.black_player_id !== userId) {
    return corsResponse(NextResponse.json({ error: 'Only the challenged player can decline' }, { status: 403 }))
  }

  if (game.status !== 'pending') {
    return corsResponse(NextResponse.json({ error: 'This challenge is no longer pending' }, { status: 400 }))
  }

  // Refund challenger's wager
  if (game.wager > 0) {
    await supabase.rpc('award_credits', {
      p_clerk_user_id: game.white_player_id,
      p_amount: game.wager,
      p_type: 'chess_wager_refund',
      p_description: 'Chess wager refund — challenge declined',
      p_metadata: { gameId },
    })
  }

  await supabase
    .from('chess_games')
    .update({ status: 'declined' })
    .eq('id', gameId)

  // Notify challenger
  const declinerUsername = await getUsername(userId)
  await supabase.from('notifications').insert({
    user_id: game.white_player_id,
    type: 'chess_declined',
    title: '♟️ Challenge Declined',
    message: `@${declinerUsername} declined your chess challenge${game.wager > 0 ? `. Your ${game.wager} credits have been refunded.` : '.'}`,
    metadata: { gameId },
  })

  return corsResponse(NextResponse.json({ success: true, message: 'Challenge declined.' }))
}

// ─── SETTLE: finalize game result and award credits ───
async function handleSettle(userId: string, body: { gameId: string; result: 'white' | 'black' | 'draw' }) {
  const { gameId, result } = body
  if (!gameId || !result) {
    return corsResponse(NextResponse.json({ error: 'Game ID and result required' }, { status: 400 }))
  }

  const { data: game, error } = await supabase
    .from('chess_games')
    .select('*')
    .eq('id', gameId)
    .single()

  if (error || !game) {
    return corsResponse(NextResponse.json({ error: 'Game not found' }, { status: 404 }))
  }

  if (game.status === 'completed') {
    return corsResponse(NextResponse.json({ error: 'Game already settled' }, { status: 400 }))
  }

  // Only game participants can settle
  if (game.white_player_id !== userId && game.black_player_id !== userId) {
    return corsResponse(NextResponse.json({ error: 'Only game participants can settle' }, { status: 403 }))
  }

  const winnerId = result === 'white' ? game.white_player_id : result === 'black' ? game.black_player_id : null
  const totalPool = game.wager * 2

  // Award credits to winner (or refund both on draw)
  if (game.wager > 0) {
    if (result === 'draw') {
      // Refund both players
      await supabase.rpc('award_credits', {
        p_clerk_user_id: game.white_player_id,
        p_amount: game.wager,
        p_type: 'chess_draw_refund',
        p_description: 'Chess draw — wager refunded',
        p_metadata: { gameId },
      })
      await supabase.rpc('award_credits', {
        p_clerk_user_id: game.black_player_id,
        p_amount: game.wager,
        p_type: 'chess_draw_refund',
        p_description: 'Chess draw — wager refunded',
        p_metadata: { gameId },
      })
    } else if (winnerId) {
      // Winner gets the full pool
      await supabase.rpc('award_credits', {
        p_clerk_user_id: winnerId,
        p_amount: totalPool,
        p_type: 'chess_win',
        p_description: `Chess victory — won ${totalPool} credits`,
        p_metadata: { gameId },
      })
    }
  }

  // Update game record
  await supabase
    .from('chess_games')
    .update({
      status: 'completed',
      result,
      winner_id: winnerId,
      completed_at: new Date().toISOString(),
    })
    .eq('id', gameId)

  return corsResponse(NextResponse.json({
    success: true,
    result,
    creditsAwarded: game.wager > 0 ? (result === 'draw' ? game.wager : totalPool) : 0,
  }))
}
