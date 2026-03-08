'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  X, Maximize2, Minimize2, RotateCcw, Flag, BookOpen, Crown,
  Users, Zap, Trophy, ChevronDown, Play, Pause, Volume2
} from 'lucide-react'
import {
  createInitialState, cloneBoard, applyMove, getLegalMoves,
  isCheckmate, isStalemate, isInCheck, updateCastling, getEnPassantTarget,
  moveToNotation, getBestMove, PIECE_SYMBOLS, pieceColor,
  type GameState, type ChessMove, type Difficulty, type PieceColor, type Board
} from '@/lib/chess-engine'

// ─── Types ──────────────────────────────────────────────────────
interface ChessGameProps {
  isOpen: boolean
  onClose: () => void
  currentUserId?: string
  embedded?: boolean  // When used inside profile page
  activeGameId?: string  // When joining a multiplayer game from notification
}

type GameMode = 'menu' | 'cpu' | 'multiplayer' | 'wager'
type GameResult = 'white' | 'black' | 'draw' | null

// ─── Piece rendering helpers ────────────────────────────────────
const PIECE_DISPLAY: Record<string, { symbol: string; white: boolean }> = {
  K: { symbol: '♔', white: true }, Q: { symbol: '♕', white: true }, R: { symbol: '♖', white: true },
  B: { symbol: '♗', white: true }, N: { symbol: '♘', white: true }, P: { symbol: '♙', white: true },
  k: { symbol: '♚', white: false }, q: { symbol: '♛', white: false }, r: { symbol: '♜', white: false },
  b: { symbol: '♝', white: false }, n: { symbol: '♞', white: false }, p: { symbol: '♟', white: false },
}

// ─── Chess rules content ────────────────────────────────────────
const RULES = [
  { title: 'Objective', text: 'Checkmate your opponent\'s king. The game ends when the king is in check and cannot escape.' },
  { title: 'Pawn', text: 'Moves forward 1 square (2 from start). Captures diagonally. Can promote to any piece upon reaching the last rank. En passant available.' },
  { title: 'Rook', text: 'Moves any number of squares horizontally or vertically. Involved in castling.' },
  { title: 'Knight', text: 'Moves in an L-shape: 2 squares in one direction and 1 perpendicular. Only piece that can jump over others.' },
  { title: 'Bishop', text: 'Moves any number of squares diagonally. Each bishop stays on its starting color.' },
  { title: 'Queen', text: 'Combines rook and bishop — moves any number of squares in any direction.' },
  { title: 'King', text: 'Moves 1 square in any direction. Cannot move into check. Can castle with a rook if neither has moved.' },
  { title: 'Castling', text: 'King moves 2 squares toward a rook; the rook jumps over. Requires: neither piece moved, no pieces between, king not in/through check.' },
  { title: 'Stalemate', text: 'If the player to move has no legal moves and is NOT in check, the game is a draw (stalemate).' },
]

// ═══════════════════════════════════════════════════════════════
//  CHESS GAME COMPONENT
// ═══════════════════════════════════════════════════════════════
export default function ChessGame({ isOpen, onClose, currentUserId, embedded, activeGameId }: ChessGameProps) {
  // ── Game state ──
  const [gameState, setGameState] = useState<GameState>(createInitialState())
  const [selectedSquare, setSelectedSquare] = useState<[number, number] | null>(null)
  const [validMoves, setValidMoves] = useState<[number, number][]>([])
  const [lastMove, setLastMove] = useState<{ from: [number, number]; to: [number, number] } | null>(null)
  const [gameResult, setGameResult] = useState<GameResult>(null)
  const [resultMessage, setResultMessage] = useState('')
  const [moveNotations, setMoveNotations] = useState<string[]>([])
  const [capturedWhite, setCapturedWhite] = useState<string[]>([]) // captured by black
  const [capturedBlack, setCapturedBlack] = useState<string[]>([]) // captured by white

  // ── UI state ──
  const [gameMode, setGameMode] = useState<GameMode>('menu')
  const [difficulty, setDifficulty] = useState<Difficulty>('medium')
  const [playerColor, setPlayerColor] = useState<PieceColor>('white')
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [is3DView, setIs3DView] = useState(false)
  const [showRules, setShowRules] = useState(false)
  const [isThinking, setIsThinking] = useState(false)
  const [boardFlipped, setBoardFlipped] = useState(false)
  const [promotionPending, setPromotionPending] = useState<{ move: ChessMove; options: string[] } | null>(null)

  // ── Wager state ──
  const [wagerAmount, setWagerAmount] = useState(0)
  const [inviteUsername, setInviteUsername] = useState('')
  const [showWagerSetup, setShowWagerSetup] = useState(false)
  const [inviteStatus, setInviteStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [inviteMessage, setInviteMessage] = useState('')
  const [userSearchResults, setUserSearchResults] = useState<{ id: string; username: string; avatar_url: string }[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [showSearchDropdown, setShowSearchDropdown] = useState(false)
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // ── Multiplayer game state ──
  const [multiplayerGameId, setMultiplayerGameId] = useState<string | null>(null)
  const [opponentName, setOpponentName] = useState<string>('')
  const [multiplayerColor, setMultiplayerColor] = useState<PieceColor>('white')

  const boardRef = useRef<HTMLDivElement>(null)
  const moveListRef = useRef<HTMLDivElement>(null)
  const cpuThinkingRef = useRef(false)

  // ── Debounced user search ──
  useEffect(() => {
    const query = inviteUsername.replace('@', '').trim()
    if (query.length < 1) {
      setUserSearchResults([])
      setShowSearchDropdown(false)
      return
    }
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearching(true)
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`)
        const data = await res.json()
        setUserSearchResults(data.users || [])
        setShowSearchDropdown((data.users || []).length > 0)
      } catch {
        setUserSearchResults([])
      } finally {
        setIsSearching(false)
      }
    }, 250)
    return () => { if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current) }
  }, [inviteUsername])

  // ── Auto-join multiplayer game from notification ──
  useEffect(() => {
    if (!activeGameId || !currentUserId) return
    // Fetch game details and enter game mode
    async function loadGame() {
      try {
        const res = await fetch(`/api/chess?gameId=${encodeURIComponent(activeGameId!)}`)
        if (!res.ok) return
        const data = await res.json()
        const game = data.game
        if (!game) return

        // Determine player color
        const isWhite = game.white_player_id === currentUserId
        const color: PieceColor = isWhite ? 'white' : 'black'

        setMultiplayerGameId(game.id)
        setMultiplayerColor(color)
        setPlayerColor(color)
        setBoardFlipped(color === 'black')
        setOpponentName(data.opponentUsername || 'Opponent')
        setWagerAmount(game.wager || 0)
        setGameMode('multiplayer')
        resetGame()
      } catch (err) {
        console.error('[chess] Failed to load game:', err)
      }
    }
    loadGame()
  }, [activeGameId, currentUserId])

  // ── Auto-scroll move list ──
  useEffect(() => {
    moveListRef.current?.scrollTo({ top: moveListRef.current.scrollHeight, behavior: 'smooth' })
  }, [moveNotations])

  // ── Reset game ──
  const resetGame = useCallback(() => {
    setGameState(createInitialState())
    setSelectedSquare(null)
    setValidMoves([])
    setLastMove(null)
    setGameResult(null)
    setResultMessage('')
    setMoveNotations([])
    setCapturedWhite([])
    setCapturedBlack([])
    setPromotionPending(null)
    setIsThinking(false)
  }, [])

  // ── Process a move ──
  const executeMove = useCallback((move: ChessMove) => {
    setGameState(prev => {
      const newBoard = applyMove(prev.board, move)
      const newCastling = updateCastling(prev.castling, move)
      const newEp = getEnPassantTarget(move)
      const nextTurn: PieceColor = prev.turn === 'white' ? 'black' : 'white'

      // Record notation
      const allMoves = getLegalMoves(prev.board, prev.turn, prev.enPassantTarget, prev.castling)
      const notation = moveToNotation(prev.board, move, allMoves)
      setMoveNotations(n => [...n, notation])

      // Track captured pieces
      if (move.captured) {
        if (pieceColor(move.captured) === 'white') setCapturedWhite(c => [...c, move.captured!])
        else setCapturedBlack(c => [...c, move.captured!])
      }

      setLastMove({ from: move.from, to: move.to })
      setSelectedSquare(null)
      setValidMoves([])

      // Check game end
      const enemyMoves = getLegalMoves(newBoard, nextTurn, newEp, newCastling)
      if (enemyMoves.length === 0) {
        if (isInCheck(newBoard, nextTurn)) {
          setGameResult(prev.turn)
          setResultMessage(`${prev.turn === 'white' ? 'White' : 'Black'} wins by checkmate!`)
        } else {
          setGameResult('draw')
          setResultMessage('Draw by stalemate!')
        }
      }

      return {
        ...prev,
        board: newBoard,
        turn: nextTurn,
        castling: newCastling,
        enPassantTarget: newEp,
        moveHistory: [...prev.moveHistory, move],
        halfMoves: move.captured || move.piece.toUpperCase() === 'P' ? 0 : prev.halfMoves + 1,
        fullMoves: prev.turn === 'black' ? prev.fullMoves + 1 : prev.fullMoves,
      }
    })
  }, [])

  // ── Handle square click ──
  const handleSquareClick = useCallback((row: number, col: number) => {
    if (gameResult) return
    if (isThinking) return
    if (gameMode === 'cpu' && gameState.turn !== playerColor) return
    if (promotionPending) return

    const piece = gameState.board[row][col]

    if (selectedSquare) {
      // Try to move
      const legalMoves = getLegalMoves(gameState.board, gameState.turn, gameState.enPassantTarget, gameState.castling)
      const move = legalMoves.find(m => m.from[0] === selectedSquare[0] && m.from[1] === selectedSquare[1] && m.to[0] === row && m.to[1] === col)

      if (move) {
        // Check for promotion
        if (move.piece.toUpperCase() === 'P' && (row === 0 || row === 7)) {
          const promos = gameState.turn === 'white' ? ['Q', 'R', 'B', 'N'] : ['q', 'r', 'b', 'n']
          setPromotionPending({ move: { ...move, promotion: promos[0] }, options: promos })
          return
        }
        executeMove(move)
        return
      }

      // Clicked own piece — re-select
      if (piece && pieceColor(piece) === gameState.turn) {
        setSelectedSquare([row, col])
        const moves = getLegalMoves(gameState.board, gameState.turn, gameState.enPassantTarget, gameState.castling)
        setValidMoves(moves.filter(m => m.from[0] === row && m.from[1] === col).map(m => m.to))
        return
      }

      setSelectedSquare(null)
      setValidMoves([])
      return
    }

    // Select a piece
    if (piece && pieceColor(piece) === gameState.turn) {
      setSelectedSquare([row, col])
      const moves = getLegalMoves(gameState.board, gameState.turn, gameState.enPassantTarget, gameState.castling)
      setValidMoves(moves.filter(m => m.from[0] === row && m.from[1] === col).map(m => m.to))
    }
  }, [gameState, selectedSquare, gameResult, isThinking, gameMode, playerColor, promotionPending, executeMove])

  // ── Handle promotion choice ──
  const handlePromotion = useCallback((promo: string) => {
    if (!promotionPending) return
    executeMove({ ...promotionPending.move, promotion: promo })
    setPromotionPending(null)
  }, [promotionPending, executeMove])

  // ── CPU move ──
  useEffect(() => {
    if (gameMode !== 'cpu' || gameState.turn === playerColor || gameResult || cpuThinkingRef.current) return

    cpuThinkingRef.current = true
    setIsThinking(true)

    const timer = setTimeout(() => {
      const move = getBestMove(gameState.board, gameState.turn, difficulty, gameState.enPassantTarget, gameState.castling)
      if (move) executeMove(move)
      cpuThinkingRef.current = false
      setIsThinking(false)
    }, 300 + Math.random() * 500) // Small delay for natural feel

    return () => {
      clearTimeout(timer)
      cpuThinkingRef.current = false
    }
  }, [gameState.turn, gameMode, playerColor, gameResult, difficulty, gameState, executeMove])

  // ── Resign ──
  const handleResign = () => {
    const winner = gameState.turn === 'white' ? 'black' : 'white'
    setGameResult(winner)
    setResultMessage(`${winner === 'white' ? 'White' : 'Black'} wins by resignation!`)
  }

  // ── Start CPU game ──
  const startCpuGame = (color: PieceColor, diff: Difficulty) => {
    resetGame()
    setPlayerColor(color)
    setDifficulty(diff)
    setBoardFlipped(color === 'black')
    setGameMode('cpu')
  }

  // ── Handle fullscreen ──
  const toggleFullscreen = () => {
    setIsFullscreen(f => !f)
  }

  if (!isOpen) return null

  // ── Board display helpers ──
  const displayBoard = boardFlipped ? [...gameState.board].reverse().map(r => [...r].reverse()) : gameState.board
  const getActualPos = (displayRow: number, displayCol: number): [number, number] => {
    if (boardFlipped) return [7 - displayRow, 7 - displayCol]
    return [displayRow, displayCol]
  }

  const inCheck = isInCheck(gameState.board, gameState.turn)
  const kingPos = (() => {
    const king = gameState.turn === 'white' ? 'K' : 'k'
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) if (gameState.board[r][c] === king) return [r, c]
    return null
  })()

  // ═══ RENDER ═══
  const containerClass = isFullscreen
    ? 'fixed inset-0 z-[100] bg-black flex items-center justify-center'
    : embedded
    ? 'relative bg-black/95 rounded-2xl border border-cyan-500/20 overflow-hidden'
    : 'fixed inset-0 z-[60] bg-black/90 backdrop-blur-xl flex items-center justify-center p-4'

  return (
    <div className={containerClass}>
      <div className={`${isFullscreen ? 'w-full h-full' : 'w-full max-w-5xl max-h-[95vh]'} flex flex-col ${isFullscreen ? '' : 'rounded-2xl border border-cyan-500/20 overflow-hidden'} bg-gradient-to-b from-gray-950 via-black to-gray-950`}>

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-cyan-500/10 bg-black/80 backdrop-blur-xl">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <Crown size={16} className="text-white" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">444 Chess</h2>
              <p className="text-[9px] text-cyan-400/50">
                {gameMode === 'menu' ? 'Choose your battle' :
                  gameMode === 'cpu' ? `vs CPU (${difficulty})` :
                  `vs @${opponentName || 'Opponent'}${wagerAmount > 0 ? ` • ${wagerAmount} credits` : ''}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {/* Rules */}
            <button onClick={() => setShowRules(!showRules)} className="p-2 rounded-lg hover:bg-white/5 transition-colors text-white/30 hover:text-cyan-400" title="Rules Guide">
              <BookOpen size={14} />
            </button>
            {/* 3D toggle */}
            {gameMode !== 'menu' && (
              <button onClick={() => setIs3DView(!is3DView)} className={`p-2 rounded-lg transition-colors text-xs font-bold ${is3DView ? 'bg-cyan-500/20 text-cyan-400' : 'text-white/30 hover:text-white/60 hover:bg-white/5'}`} title="3D View">
                3D
              </button>
            )}
            {/* Fullscreen */}
            <button onClick={toggleFullscreen} className="p-2 rounded-lg hover:bg-white/5 transition-colors text-white/30 hover:text-white/60">
              {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </button>
            {/* Close */}
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-red-500/10 transition-colors text-white/30 hover:text-red-400">
              <X size={14} />
            </button>
          </div>
        </div>

        {/* ── Rules overlay ── */}
        {showRules && (
          <div className="absolute inset-0 z-50 bg-black/95 backdrop-blur-xl overflow-y-auto p-6 flex flex-col">
            <div className="max-w-lg mx-auto w-full">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-cyan-300 flex items-center gap-2">
                  <BookOpen size={18} /> Chess Rules
                </h3>
                <button onClick={() => setShowRules(false)} className="p-2 hover:bg-white/10 rounded-lg text-white/40 hover:text-white">
                  <X size={16} />
                </button>
              </div>
              <div className="space-y-4">
                {RULES.map((rule, i) => (
                  <div key={i} className="bg-white/[0.02] border border-cyan-500/10 rounded-xl p-4">
                    <h4 className="text-sm font-bold text-cyan-400 mb-1">♟ {rule.title}</h4>
                    <p className="text-xs text-white/60 leading-relaxed">{rule.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Content ── */}
        <div className="flex-1 overflow-y-auto">
          {/* ═══ MENU ═══ */}
          {gameMode === 'menu' && (
            <div className="flex flex-col items-center justify-center min-h-[500px] px-6 py-10 gap-8">
              {/* Logo */}
              <div className="text-center">
                <div className="text-5xl mb-3" style={{ textShadow: '0 0 30px rgba(6,182,212,0.3)' }}>♚</div>
                <h2 className="text-2xl font-black text-white tracking-tight">444 Chess</h2>
                <p className="text-xs text-white/30 mt-1">The producer&apos;s game. Play, compete, win credits.</p>
              </div>

              {/* Game modes */}
              <div className="w-full max-w-sm space-y-3">
                {/* CPU */}
                <div className="bg-white/[0.02] border border-cyan-500/15 rounded-xl p-4">
                  <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                    <Play size={14} className="text-cyan-400" /> vs CPU
                  </h3>
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    {(['easy', 'medium', 'hard'] as Difficulty[]).map(d => (
                      <button key={d} onClick={() => setDifficulty(d)} className={`px-3 py-2 rounded-lg text-xs font-bold transition-all ${difficulty === d ? 'bg-cyan-500/20 border border-cyan-500/40 text-cyan-300' : 'bg-white/[0.03] border border-white/10 text-white/50 hover:text-white/80'}`}>
                        {d.charAt(0).toUpperCase() + d.slice(1)}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => startCpuGame('white', difficulty)} className="flex-1 px-4 py-2.5 bg-gradient-to-r from-white/10 to-white/5 border border-white/20 rounded-lg text-xs font-bold text-white hover:from-white/15 transition-all">
                      ♔ Play White
                    </button>
                    <button onClick={() => startCpuGame('black', difficulty)} className="flex-1 px-4 py-2.5 bg-gradient-to-r from-gray-800 to-gray-900 border border-white/10 rounded-lg text-xs font-bold text-white/80 hover:border-white/20 transition-all">
                      ♚ Play Black
                    </button>
                  </div>
                </div>

                {/* Challenge with wager */}
                <div className="bg-white/[0.02] border border-purple-500/15 rounded-xl p-4">
                  <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                    <Trophy size={14} className="text-purple-400" /> Challenge a Producer
                  </h3>
                  <div className="space-y-2">
                    <div className="relative">
                      <input
                        type="text"
                        value={inviteUsername}
                        onChange={e => { setInviteUsername(e.target.value); setInviteStatus('idle'); setInviteMessage(''); setShowSearchDropdown(true) }}
                        onFocus={() => { if (userSearchResults.length > 0) setShowSearchDropdown(true) }}
                        onBlur={() => setTimeout(() => setShowSearchDropdown(false), 200)}
                        placeholder="Search @username..."
                        className="w-full bg-black/60 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-white/25 focus:border-purple-500/40 focus:outline-none"
                        autoComplete="off"
                      />
                      {isSearching && (
                        <div className="absolute right-2 top-1/2 -translate-y-1/2">
                          <div className="w-3 h-3 border-2 border-white/20 border-t-purple-400 rounded-full animate-spin" />
                        </div>
                      )}
                      {showSearchDropdown && userSearchResults.length > 0 && (
                        <div className="absolute left-0 right-0 top-full mt-1 bg-gray-950 border border-white/10 rounded-lg overflow-hidden z-50 shadow-xl shadow-black/50 max-h-[200px] overflow-y-auto">
                          {userSearchResults.map(u => (
                            <button
                              key={u.id}
                              type="button"
                              onMouseDown={e => e.preventDefault()}
                              onClick={() => {
                                setInviteUsername(u.username)
                                setShowSearchDropdown(false)
                                setUserSearchResults([])
                                setInviteStatus('idle')
                                setInviteMessage('')
                              }}
                              className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-purple-500/10 transition-colors text-left"
                            >
                              <img
                                src={u.avatar_url || '/default-avatar.png'}
                                alt=""
                                className="w-6 h-6 rounded-full object-cover bg-white/5 flex-shrink-0"
                                onError={e => { (e.target as HTMLImageElement).src = '/default-avatar.png' }}
                              />
                              <span className="text-xs text-white/80 font-medium">@{u.username}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 flex-1">
                        <Zap size={12} className="text-yellow-400" />
                        <input
                          type="number"
                          value={wagerAmount}
                          onChange={e => setWagerAmount(Math.max(0, parseInt(e.target.value) || 0))}
                          placeholder="0"
                          min={0}
                          className="w-20 bg-black/60 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white placeholder-white/25 focus:border-yellow-500/40 focus:outline-none"
                        />
                        <span className="text-[10px] text-white/30">credits wager</span>
                      </div>
                    </div>
                    <p className="text-[10px] text-white/20 leading-relaxed">
                      Set 0 for a free game. Winner takes the wager. Credits are held in escrow during the match.
                    </p>
                    <button
                      onClick={async () => {
                        const cleanUsername = inviteUsername.replace('@', '').trim()
                        if (!cleanUsername) return
                        setInviteStatus('sending')
                        setInviteMessage('')
                        try {
                          const res = await fetch('/api/chess', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              action: 'create',
                              opponent: cleanUsername,
                              wager: wagerAmount,
                            })
                          })
                          const data = await res.json()
                          if (data.success) {
                            setInviteStatus('sent')
                            setInviteMessage(data.message || `Challenge sent to @${cleanUsername}!`)
                          } else {
                            setInviteStatus('error')
                            setInviteMessage(data.error || 'Failed to create game')
                          }
                        } catch {
                          setInviteStatus('error')
                          setInviteMessage('Network error. Please try again.')
                        }
                      }}
                      disabled={!inviteUsername.replace('@', '').trim() || inviteStatus === 'sending'}
                      className="w-full px-4 py-2.5 bg-gradient-to-r from-purple-600/30 to-cyan-600/30 border border-purple-500/30 rounded-lg text-xs font-bold text-white hover:from-purple-600/40 hover:to-cyan-600/40 transition-all disabled:opacity-30"
                    >
                      {inviteStatus === 'sending' ? (
                        <span className="flex items-center justify-center gap-2">
                          <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Sending...
                        </span>
                      ) : (
                        <>
                          <Users size={12} className="inline mr-2" />
                          Send Challenge {wagerAmount > 0 ? `(${wagerAmount} credits)` : '(Free)'}
                        </>
                      )}
                    </button>
                    {/* Invite status feedback */}
                    {inviteStatus === 'sent' && (
                      <div className="flex items-center gap-2 px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                        <span className="text-emerald-400 text-[10px]">✓</span>
                        <span className="text-[10px] text-emerald-300/80">{inviteMessage}</span>
                      </div>
                    )}
                    {inviteStatus === 'error' && (
                      <div className="flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg">
                        <span className="text-red-400 text-[10px]">✕</span>
                        <span className="text-[10px] text-red-300/80">{inviteMessage}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═══ GAME BOARD ═══ */}
          {gameMode !== 'menu' && (
            <div className={`flex ${isFullscreen ? 'flex-row items-center justify-center gap-6 h-full p-8' : 'flex-col lg:flex-row items-center lg:items-start gap-4 p-4'}`}>
              {/* Board container */}
              <div className="flex flex-col items-center gap-2">
                {/* Opponent info bar */}
                <div className="flex items-center gap-2 w-full max-w-[400px] px-2">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-gray-600 to-gray-800 flex items-center justify-center text-[10px]">
                    {gameMode === 'cpu' ? '🤖' : '👤'}
                  </div>
                  <span className="text-xs text-white/60 font-medium">
                    {gameMode === 'cpu' ? `CPU (${difficulty})` : opponentName || inviteUsername || 'Opponent'}
                  </span>
                  {gameMode === 'multiplayer' && wagerAmount > 0 && (
                    <span className="text-[10px] text-amber-400 font-medium flex items-center gap-1">
                      <Zap size={10} /> {wagerAmount} credits
                    </span>
                  )}
                  <div className="flex-1" />
                  {/* Captured pieces */}
                  <div className="flex gap-0.5">
                    {(boardFlipped ? capturedBlack : capturedWhite).map((p, i) => (
                      <span key={i} className="text-[10px] opacity-60">{PIECE_SYMBOLS[p]}</span>
                    ))}
                  </div>
                </div>

                {/* Chess Board */}
                <div
                  ref={boardRef}
                  className="relative select-none"
                  style={is3DView ? {
                    perspective: '1000px',
                    perspectiveOrigin: '50% 30%',
                  } : {}}
                >
                  <div
                    className="grid grid-cols-8 rounded-xl overflow-hidden shadow-2xl shadow-cyan-500/10"
                    style={{
                      ...(is3DView ? {
                        transform: 'rotateX(35deg) rotateZ(0deg)',
                        transformStyle: 'preserve-3d',
                      } : {}),
                      width: isFullscreen ? '520px' : '360px',
                      height: isFullscreen ? '520px' : '360px',
                      border: '2px solid rgba(6,182,212,0.15)',
                    }}
                  >
                    {displayBoard.map((row, dr) =>
                      row.map((piece, dc) => {
                        const [ar, ac] = getActualPos(dr, dc)
                        const isLight = (dr + dc) % 2 === 0
                        const isSelected = selectedSquare && selectedSquare[0] === ar && selectedSquare[1] === ac
                        const isValidTarget = validMoves.some(([r, c]) => r === ar && c === ac)
                        const isLastMoveSquare = lastMove && ((lastMove.from[0] === ar && lastMove.from[1] === ac) || (lastMove.to[0] === ar && lastMove.to[1] === ac))
                        const isKingInDanger = inCheck && kingPos && kingPos[0] === ar && kingPos[1] === ac

                        const squareSize = isFullscreen ? '65px' : '45px'

                        return (
                          <div
                            key={`${dr}-${dc}`}
                            onClick={() => handleSquareClick(ar, ac)}
                            className="relative flex items-center justify-center cursor-pointer transition-all duration-150 hover:brightness-110"
                            style={{
                              width: squareSize,
                              height: squareSize,
                              background: isKingInDanger
                                ? 'radial-gradient(circle, rgba(255,50,50,0.6), rgba(180,20,20,0.3))'
                                : isSelected
                                ? 'radial-gradient(circle, rgba(6,182,212,0.4), rgba(6,182,212,0.15))'
                                : isLastMoveSquare
                                ? isLight
                                  ? 'linear-gradient(135deg, rgba(180,210,180,0.5), rgba(140,185,140,0.4))'
                                  : 'linear-gradient(135deg, rgba(120,160,100,0.5), rgba(90,130,80,0.4))'
                                : isLight
                                ? 'linear-gradient(135deg, #c8ccd4, #b8bcc4)'
                                : 'linear-gradient(135deg, #3a4a5c, #2d3a4a)',
                              boxShadow: isSelected ? 'inset 0 0 20px rgba(6,182,212,0.3)' : 'inset 0 1px 0 rgba(255,255,255,0.05)',
                              ...(is3DView ? { transformStyle: 'preserve-3d' as const } : {}),
                            }}
                          >
                            {/* Valid move indicator */}
                            {isValidTarget && (
                              <div
                                className="absolute z-10 rounded-full"
                                style={{
                                  width: piece ? '85%' : '28%',
                                  height: piece ? '85%' : '28%',
                                  background: piece
                                    ? 'radial-gradient(circle, transparent 55%, rgba(6,182,212,0.5) 56%)'
                                    : 'radial-gradient(circle, rgba(6,182,212,0.4), rgba(6,182,212,0.15))',
                                }}
                              />
                            )}

                            {/* Piece */}
                            {piece && (
                              <span
                                className="relative z-20 select-none transition-transform duration-100"
                                style={{
                                  fontSize: isFullscreen ? '40px' : '28px',
                                  lineHeight: 1,
                                  color: PIECE_DISPLAY[piece]?.white ? '#fff' : '#1a1a2e',
                                  textShadow: PIECE_DISPLAY[piece]?.white
                                    ? '0 2px 4px rgba(0,0,0,0.5), 0 0 12px rgba(255,255,255,0.15), 1px 1px 0 rgba(200,200,200,0.3)'
                                    : '0 2px 4px rgba(0,0,0,0.3), 0 0 8px rgba(0,0,0,0.2), 1px 1px 0 rgba(60,60,80,0.5)',
                                  filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.4))',
                                  transform: isSelected ? 'scale(1.15)' : 'scale(1)',
                                  cursor: 'pointer',
                                }}
                              >
                                {PIECE_DISPLAY[piece]?.symbol}
                              </span>
                            )}

                            {/* File/rank labels */}
                            {dc === 0 && (
                              <span className="absolute left-0.5 top-0.5 text-[8px] font-bold z-30" style={{ color: isLight ? 'rgba(60,70,90,0.5)' : 'rgba(180,190,210,0.4)' }}>
                                {boardFlipped ? dr + 1 : 8 - dr}
                              </span>
                            )}
                            {dr === 7 && (
                              <span className="absolute right-0.5 bottom-0 text-[8px] font-bold z-30" style={{ color: isLight ? 'rgba(60,70,90,0.5)' : 'rgba(180,190,210,0.4)' }}>
                                {'abcdefgh'[boardFlipped ? 7 - dc : dc]}
                              </span>
                            )}
                          </div>
                        )
                      })
                    )}
                  </div>

                  {/* Promotion dialog */}
                  {promotionPending && (
                    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm rounded-xl">
                      <div className="bg-gray-900 border border-cyan-500/30 rounded-xl p-4 shadow-2xl">
                        <p className="text-xs text-white/60 mb-3 text-center">Promote pawn to:</p>
                        <div className="flex gap-2">
                          {promotionPending.options.map(p => (
                            <button
                              key={p}
                              onClick={() => handlePromotion(p)}
                              className="w-14 h-14 rounded-lg bg-white/10 hover:bg-cyan-500/20 border border-white/20 hover:border-cyan-500/40 flex items-center justify-center text-3xl transition-all"
                              style={{
                                color: p === p.toUpperCase() ? '#fff' : '#1a1a2e',
                                textShadow: '0 2px 4px rgba(0,0,0,0.5)',
                              }}
                            >
                              {PIECE_SYMBOLS[p]}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Game result overlay */}
                  {gameResult && (
                    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm rounded-xl">
                      <div className="text-center p-6">
                        <div className="text-4xl mb-3">
                          {gameResult === 'draw' ? '🤝' : '👑'}
                        </div>
                        <h3 className="text-lg font-black text-white mb-1">{resultMessage}</h3>
                        {wagerAmount > 0 && gameResult !== 'draw' && (
                          <p className="text-sm text-yellow-400 mb-3">
                            <Zap size={14} className="inline" /> {wagerAmount * 2} credits to the winner!
                          </p>
                        )}
                        <div className="flex gap-2 justify-center mt-4">
                          <button onClick={() => { resetGame(); setGameMode('menu') }} className="px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-xs font-bold text-white hover:bg-white/20 transition-all">
                            Menu
                          </button>
                          <button onClick={() => { resetGame(); if (gameMode === 'cpu') startCpuGame(playerColor, difficulty) }} className="px-4 py-2 bg-cyan-500/20 border border-cyan-500/30 rounded-lg text-xs font-bold text-cyan-300 hover:bg-cyan-500/30 transition-all">
                            Play Again
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Player info bar */}
                <div className="flex items-center gap-2 w-full max-w-[400px] px-2">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-[10px]">
                    👤
                  </div>
                  <span className="text-xs text-white/60 font-medium">You ({playerColor})</span>
                  <div className="flex-1" />
                  <div className="flex gap-0.5">
                    {(boardFlipped ? capturedWhite : capturedBlack).map((p, i) => (
                      <span key={i} className="text-[10px] opacity-60">{PIECE_SYMBOLS[p]}</span>
                    ))}
                  </div>
                </div>

                {/* Controls */}
                <div className="flex items-center gap-2 mt-2">
                  {isThinking && (
                    <span className="text-[10px] text-cyan-400/60 flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" /> CPU thinking...
                    </span>
                  )}
                  <div className="flex-1" />
                  <button onClick={() => setBoardFlipped(f => !f)} className="p-2 rounded-lg hover:bg-white/5 text-white/30 hover:text-white/60 transition-colors" title="Flip board">
                    <RotateCcw size={14} />
                  </button>
                  {!gameResult && (
                    <button onClick={handleResign} className="px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400/70 hover:bg-red-500/20 transition-all">
                      <Flag size={10} className="inline mr-1" /> Resign
                    </button>
                  )}
                </div>
              </div>

              {/* Move list */}
              <div className={`${isFullscreen ? 'w-64' : 'w-full lg:w-52'} bg-white/[0.02] border border-white/5 rounded-xl p-3`}>
                <h4 className="text-[10px] uppercase tracking-wider text-white/30 font-bold mb-2">Moves</h4>
                <div ref={moveListRef} className={`${isFullscreen ? 'max-h-[400px]' : 'max-h-40 lg:max-h-72'} overflow-y-auto space-y-0.5 pr-1`}>
                  {moveNotations.length === 0 && (
                    <p className="text-[10px] text-white/15 text-center py-4">No moves yet</p>
                  )}
                  {Array.from({ length: Math.ceil(moveNotations.length / 2) }).map((_, i) => (
                    <div key={i} className="flex items-center text-xs font-mono gap-1">
                      <span className="w-5 text-white/15 text-right text-[10px]">{i + 1}.</span>
                      <span className="flex-1 text-white/70 px-1">{moveNotations[i * 2]}</span>
                      {moveNotations[i * 2 + 1] && (
                        <span className="flex-1 text-white/50 px-1">{moveNotations[i * 2 + 1]}</span>
                      )}
                    </div>
                  ))}
                </div>

                {/* Game info */}
                <div className="mt-3 pt-3 border-t border-white/5">
                  <div className="text-[10px] text-white/20 space-y-1">
                    <div className="flex justify-between">
                      <span>Turn</span>
                      <span className="text-white/40">{gameState.turn}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Mode</span>
                      <span className="text-white/40">{gameMode === 'cpu' ? `CPU ${difficulty}` : 'PvP'}</span>
                    </div>
                    {wagerAmount > 0 && (
                      <div className="flex justify-between">
                        <span>Wager</span>
                        <span className="text-yellow-400/60">{wagerAmount} credits</span>
                      </div>
                    )}
                    {inCheck && !gameResult && (
                      <div className="text-red-400 font-bold text-center mt-2 animate-pulse">CHECK!</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
