/**
 * Chess API — Create and manage multiplayer chess games with credit wagers
 * POST /api/chess
 * Actions: create, accept, decline, settle, move
 * GET /api/chess?gameId=X — fetch game state (for polling)
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
    if (action === 'move') return await handleMove(userId, body)
    if (action === 'draw_response') return await handleDrawResponse(userId, body)

    return corsResponse(NextResponse.json({ error: 'Unknown action' }, { status: 400 }))
  } catch (error) {
    console.error('[chess] Error:', error)
    return corsResponse(NextResponse.json({ error: 'Internal server error' }, { status: 500 }))
  }
}

// ─── GET: fetch game details by ID ───
export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return corsResponse(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  }

  const gameId = req.nextUrl.searchParams.get('gameId')
  if (!gameId) {
    return corsResponse(NextResponse.json({ error: 'gameId required' }, { status: 400 }))
  }

  const { data: game, error } = await supabase
    .from('chess_games')
    .select('*')
    .eq('id', gameId)
    .single()

  if (error || !game) {
    return corsResponse(NextResponse.json({ error: 'Game not found' }, { status: 404 }))
  }

  // Only allow players in this game to see details
  if (game.white_player_id !== userId && game.black_player_id !== userId) {
    return corsResponse(NextResponse.json({ error: 'Not your game' }, { status: 403 }))
  }

  // Get opponent username
  const opponentId = game.white_player_id === userId ? game.black_player_id : game.white_player_id
  const opponentUsername = await getUsername(opponentId)

  return corsResponse(NextResponse.json({ game, opponentUsername }))
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

  // If wager > 0, check challenger has enough credits (paid + free)
  if (wagerAmount > 0) {
    const { data: challenger } = await supabase
      .from('users')
      .select('credits, free_credits')
      .eq('clerk_user_id', userId)
      .single()

    const totalCredits = (challenger?.credits || 0) + (challenger?.free_credits || 0)
    if (!challenger || totalCredits < wagerAmount) {
      return corsResponse(NextResponse.json({ error: `You don't have enough credits for this wager (need ${wagerAmount}, have ${totalCredits})` }, { status: 400 }))
    }

    // Deduct wager from challenger (escrow)
    const { data: deductResult, error: deductError } = await supabase.rpc('deduct_credits', {
      p_clerk_user_id: userId,
      p_amount: wagerAmount,
      p_type: 'chess_wager',
      p_description: `Chess wager vs @${opponentUser.username}`,
      p_metadata: {},
    })

    if (deductError || !deductResult?.[0]?.success) {
      console.error('[chess] Create escrow failed:', deductError, deductResult)
      return corsResponse(NextResponse.json({ error: deductResult?.[0]?.error_message || 'Failed to escrow credits' }, { status: 500 }))
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
      .select('credits, free_credits')
      .eq('clerk_user_id', userId)
      .single()

    const totalCredits = (opp?.credits || 0) + (opp?.free_credits || 0)
    if (!opp || totalCredits < game.wager) {
      return corsResponse(NextResponse.json({ error: `You need ${game.wager} credits to accept this wager (you have ${totalCredits})` }, { status: 400 }))
    }

    const { data: deductResult, error: deductError } = await supabase.rpc('deduct_credits', {
      p_clerk_user_id: userId,
      p_amount: game.wager,
      p_type: 'chess_wager',
      p_description: `Chess wager accepted — ${game.wager} credits escrowed`,
      p_metadata: { gameId },
    })

    if (deductError || !deductResult?.[0]?.success) {
      console.error('[chess] Accept escrow failed:', deductError, deductResult)
      return corsResponse(NextResponse.json({ error: deductResult?.[0]?.error_message || 'Failed to escrow your credits' }, { status: 500 }))
    }
  }

  // Update game status to active
  await supabase
    .from('chess_games')
    .update({ status: 'active' })
    .eq('id', gameId)

  // Mark the chess_challenge notification as read so it stops polling
  await markChallengeNotificationRead(userId, gameId)

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

// ─── Helper: mark chess_challenge notification as read ───
async function markChallengeNotificationRead(userId: string, gameId: string) {
  try {
    // Mark all chess_challenge notifications for this user as read
    // Table uses is_read (boolean), not read_at
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('type', 'chess_challenge')

    if (error) {
      console.error('[chess] Failed to mark notification read (supabase):', error)
    } else {
      console.log(`[chess] Marked chess_challenge notifications as read for user ${userId}`)
    }
  } catch (err) {
    console.error('[chess] Failed to mark notification as read:', err)
  }
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
    // If already declined/completed, return success (idempotent) and clean up notification
    if (game.status === 'declined' || game.status === 'completed' || game.status === 'active') {
      await markChallengeNotificationRead(userId, gameId)
      return corsResponse(NextResponse.json({ success: true, message: 'Challenge already handled.' }))
    }
    return corsResponse(NextResponse.json({ error: 'This challenge is no longer pending' }, { status: 400 }))
  }

  // Refund challenger's wager — must succeed before marking game declined
  if (game.wager > 0) {
    const { data: refundResult, error: refundError } = await supabase.rpc('award_credits', {
      p_clerk_user_id: game.white_player_id,
      p_amount: game.wager,
      p_type: 'chess_wager_refund',
      p_description: `Chess wager refund — challenge declined (${game.wager} credits returned)`,
      p_metadata: { gameId },
    })

    if (refundError || !refundResult?.[0]?.success) {
      console.error('[chess] Decline refund failed:', refundError, refundResult)
      return corsResponse(NextResponse.json({ error: 'Failed to refund challenger credits. Please try again.' }, { status: 500 }))
    }
  }

  await supabase
    .from('chess_games')
    .update({ status: 'declined' })
    .eq('id', gameId)

  // Mark the chess_challenge notification as read so it stops polling
  await markChallengeNotificationRead(userId, gameId)

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
  let creditsAwarded = 0

  // Award credits to winner (or refund both on draw)
  // CRITICAL: credits MUST be awarded before marking game completed
  if (game.wager > 0) {
    if (result === 'draw') {
      // Don't refund immediately — enter draw_pending so players can choose rematch or refund
      if (game.wager > 0) {
        await supabase
          .from('chess_games')
          .update({
            status: 'draw_pending',
            result: 'draw',
            completed_at: new Date().toISOString(),
            draw_rematch_white: false,
            draw_rematch_black: false,
          })
          .eq('id', gameId)

        // Notify both players
        const whiteUsername = await getUsername(game.white_player_id)
        const blackUsername = await getUsername(game.black_player_id)
        await supabase.from('notifications').insert([
          {
            user_id: game.white_player_id,
            type: 'chess_draw',
            title: '🤝 Chess Draw!',
            message: `Your game vs @${blackUsername} ended in a draw. Choose rematch or take your ${game.wager} credits back.`,
            metadata: { gameId, wager: game.wager },
          },
          {
            user_id: game.black_player_id,
            type: 'chess_draw',
            title: '🤝 Chess Draw!',
            message: `Your game vs @${whiteUsername} ended in a draw. Choose rematch or take your ${game.wager} credits back.`,
            metadata: { gameId, wager: game.wager },
          },
        ])

        return corsResponse(NextResponse.json({
          success: true,
          result: 'draw',
          drawPending: true,
          creditsAwarded: 0,
        }))
      }

      // No wager — just mark completed
      creditsAwarded = 0
    } else if (winnerId) {
      // Winner gets the full pool (both wagers combined)
      const loserId = winnerId === game.white_player_id ? game.black_player_id : game.white_player_id
      const winnerUsername = await getUsername(winnerId)
      const loserUsername = await getUsername(loserId)

      const { data: awardResult, error: awardError } = await supabase.rpc('award_credits', {
        p_clerk_user_id: winnerId,
        p_amount: totalPool,
        p_type: 'chess_win',
        p_description: `Chess victory vs @${loserUsername} — won ${totalPool} credits`,
        p_metadata: { gameId, pool: totalPool, loserId, loserUsername },
      })

      if (awardError || !awardResult?.[0]?.success) {
        console.error('[chess] Win award failed:', awardError, awardResult)
        return corsResponse(NextResponse.json({ error: 'Failed to award winning credits. Please contact support.' }, { status: 500 }))
      }

      creditsAwarded = totalPool

      // Notify both players
      await supabase.from('notifications').insert([
        {
          user_id: winnerId,
          type: 'chess_win',
          title: '👑 Chess Victory!',
          message: `You won ${totalPool} credits in chess vs @${loserUsername}!`,
          metadata: { gameId, credits: totalPool },
        },
        {
          user_id: loserId,
          type: 'chess_loss',
          title: '♟️ Chess Defeat',
          message: `@${winnerUsername} won the chess match. ${game.wager} credits wagered.`,
          metadata: { gameId, credits: game.wager },
        },
      ])
    }
  }

  // Only mark completed AFTER credits are successfully processed
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
    creditsAwarded,
  }))
}

// ─── DRAW RESPONSE: player chooses rematch or refund after a draw ───
async function handleDrawResponse(userId: string, body: { gameId: string; choice: 'rematch' | 'refund' }) {
  const { gameId, choice } = body
  if (!gameId || !choice || !['rematch', 'refund'].includes(choice)) {
    return corsResponse(NextResponse.json({ error: 'gameId and choice (rematch|refund) required' }, { status: 400 }))
  }

  const { data: game, error } = await supabase
    .from('chess_games')
    .select('*')
    .eq('id', gameId)
    .single()

  if (error || !game) {
    return corsResponse(NextResponse.json({ error: 'Game not found' }, { status: 404 }))
  }

  if (game.status !== 'draw_pending') {
    return corsResponse(NextResponse.json({ error: 'Game is not in draw_pending state' }, { status: 400 }))
  }

  if (game.white_player_id !== userId && game.black_player_id !== userId) {
    return corsResponse(NextResponse.json({ error: 'Not your game' }, { status: 403 }))
  }

  const isWhite = game.white_player_id === userId
  const opponentId = isWhite ? game.black_player_id : game.white_player_id
  const playerUsername = await getUsername(userId)
  const opponentUsername = await getUsername(opponentId)

  // ── REFUND: either player requesting refund → refund BOTH immediately ──
  if (choice === 'refund') {
    const totalPool = game.wager * 2

    const { data: refundWhite, error: errWhite } = await supabase.rpc('award_credits', {
      p_clerk_user_id: game.white_player_id,
      p_amount: game.wager,
      p_type: 'chess_draw_refund',
      p_description: `Chess draw refund — ${game.wager} credits returned`,
      p_metadata: { gameId, pool: totalPool },
    })

    const { data: refundBlack, error: errBlack } = await supabase.rpc('award_credits', {
      p_clerk_user_id: game.black_player_id,
      p_amount: game.wager,
      p_type: 'chess_draw_refund',
      p_description: `Chess draw refund — ${game.wager} credits returned`,
      p_metadata: { gameId, pool: totalPool },
    })

    if (errWhite || !refundWhite?.[0]?.success || errBlack || !refundBlack?.[0]?.success) {
      console.error('[chess] Draw refund failed:', { errWhite, refundWhite, errBlack, refundBlack })
      return corsResponse(NextResponse.json({ error: 'Failed to refund credits. Please contact support.' }, { status: 500 }))
    }

    await supabase
      .from('chess_games')
      .update({ status: 'completed', result: 'draw' })
      .eq('id', gameId)

    // Notify opponent that refund was chosen
    await supabase.from('notifications').insert({
      user_id: opponentId,
      type: 'chess_draw_refund',
      title: '💰 Draw Refund',
      message: `@${playerUsername} chose refund. Your ${game.wager} credits have been returned.`,
      metadata: { gameId },
    })

    return corsResponse(NextResponse.json({
      success: true,
      action: 'refunded',
      creditsRefunded: game.wager,
    }))
  }

  // ── REMATCH: player wants to play again with same wager ──
  // Update this player's rematch flag
  const updateField = isWhite ? { draw_rematch_white: true } : { draw_rematch_black: true }
  await supabase
    .from('chess_games')
    .update(updateField)
    .eq('id', gameId)

  // Re-fetch to check if BOTH players have now chosen rematch
  const { data: updatedGame } = await supabase
    .from('chess_games')
    .select('draw_rematch_white, draw_rematch_black, wager, white_player_id, black_player_id')
    .eq('id', gameId)
    .single()

  if (updatedGame?.draw_rematch_white && updatedGame?.draw_rematch_black) {
    // BOTH players want rematch! Create a new game with swapped colors, same wager.
    // Credits are already escrowed from the original game (no new deduction).
    const { data: newGame, error: createError } = await supabase
      .from('chess_games')
      .insert({
        white_player_id: game.black_player_id,  // Swap colors
        black_player_id: game.white_player_id,
        wager: game.wager,
        status: 'active',
        moves: [],
        parent_game_id: gameId,
      })
      .select('id')
      .single()

    if (createError || !newGame) {
      console.error('[chess] Rematch create failed:', createError)
      return corsResponse(NextResponse.json({ error: 'Failed to create rematch game' }, { status: 500 }))
    }

    // Mark original game as completed with draw_rematch result
    await supabase
      .from('chess_games')
      .update({ status: 'completed', result: 'draw_rematch' })
      .eq('id', gameId)

    // Notify both players about the rematch
    await supabase.from('notifications').insert([
      {
        user_id: game.white_player_id,
        type: 'chess_rematch',
        title: '♟️ Rematch!',
        message: `Rematch vs @${await getUsername(game.black_player_id)}! Colors swapped. Same ${game.wager} credit wager.`,
        metadata: { gameId: newGame.id, oldGameId: gameId, wager: game.wager },
      },
      {
        user_id: game.black_player_id,
        type: 'chess_rematch',
        title: '♟️ Rematch!',
        message: `Rematch vs @${await getUsername(game.white_player_id)}! Colors swapped. Same ${game.wager} credit wager.`,
        metadata: { gameId: newGame.id, oldGameId: gameId, wager: game.wager },
      },
    ])

    return corsResponse(NextResponse.json({
      success: true,
      action: 'rematch_created',
      newGameId: newGame.id,
    }))
  }

  // Only this player chose rematch so far — notify opponent
  await supabase.from('notifications').insert({
    user_id: opponentId,
    type: 'chess_rematch_request',
    title: '♟️ Rematch Request',
    message: `@${playerUsername} wants a rematch! Same ${game.wager} credit wager. Accept or take your refund.`,
    metadata: { gameId, wager: game.wager },
  })

  return corsResponse(NextResponse.json({
    success: true,
    action: 'rematch_requested',
    waitingForOpponent: true,
  }))
}

// ─── MOVE: store a move in the game ───
async function handleMove(userId: string, body: { gameId: string; move: any; moveIndex: number }) {
  const { gameId, move, moveIndex } = body
  if (!gameId || !move) {
    return corsResponse(NextResponse.json({ error: 'gameId and move required' }, { status: 400 }))
  }

  const { data: game, error } = await supabase
    .from('chess_games')
    .select('*')
    .eq('id', gameId)
    .single()

  if (error || !game) {
    return corsResponse(NextResponse.json({ error: 'Game not found' }, { status: 404 }))
  }

  if (game.status !== 'active') {
    return corsResponse(NextResponse.json({ error: 'Game is not active' }, { status: 400 }))
  }

  // Verify it's this player's game
  if (game.white_player_id !== userId && game.black_player_id !== userId) {
    return corsResponse(NextResponse.json({ error: 'Not your game' }, { status: 403 }))
  }

  // Verify it's this player's turn
  const currentMoves = game.moves || []
  const isWhiteTurn = currentMoves.length % 2 === 0
  const isPlayerWhite = game.white_player_id === userId
  if (isWhiteTurn !== isPlayerWhite) {
    return corsResponse(NextResponse.json({ error: 'Not your turn' }, { status: 400 }))
  }

  // Verify move index matches (prevent duplicates / race conditions)
  if (typeof moveIndex === 'number' && moveIndex !== currentMoves.length) {
    return corsResponse(NextResponse.json({ error: 'Move out of sync', currentMoveCount: currentMoves.length }, { status: 409 }))
  }

  // Append the move
  const updatedMoves = [...currentMoves, move]

  const { error: updateError } = await supabase
    .from('chess_games')
    .update({
      moves: updatedMoves,
      updated_at: new Date().toISOString(),
    })
    .eq('id', gameId)

  if (updateError) {
    console.error('[chess] Move update error:', updateError)
    return corsResponse(NextResponse.json({ error: 'Failed to save move' }, { status: 500 }))
  }

  return corsResponse(NextResponse.json({ success: true, moveCount: updatedMoves.length }))
}
