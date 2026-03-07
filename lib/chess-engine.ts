// ═══════════════════════════════════════════════════════════════
//  444 Chess Engine — Pure chess logic (no React dependencies)
// ═══════════════════════════════════════════════════════════════

export type PieceColor = 'white' | 'black'
export type Board = string[][]
export interface CastlingRights { whiteKing: boolean; whiteQueen: boolean; blackKing: boolean; blackQueen: boolean }
export interface ChessMove { from: [number, number]; to: [number, number]; piece: string; captured?: string; promotion?: string; castle?: 'kingside' | 'queenside'; enPassant?: boolean }
export interface GameState { board: Board; turn: PieceColor; castling: CastlingRights; enPassantTarget: [number, number] | null; moveHistory: ChessMove[]; halfMoves: number; fullMoves: number }

// ── Piece helpers ──
export const isWhite = (p: string) => p !== '' && p === p.toUpperCase()
export const isBlack = (p: string) => p !== '' && p === p.toLowerCase()
export const pieceColor = (p: string): PieceColor | null => p === '' ? null : isWhite(p) ? 'white' : 'black'
export const isOwnPiece = (p: string, color: PieceColor) => color === 'white' ? isWhite(p) : isBlack(p)
export const isEnemyPiece = (p: string, color: PieceColor) => p !== '' && !isOwnPiece(p, color)
const inBounds = (r: number, c: number) => r >= 0 && r < 8 && c >= 0 && c < 8

// ── Initial board ──
export function createInitialBoard(): Board {
  return [
    ['r','n','b','q','k','b','n','r'],
    ['p','p','p','p','p','p','p','p'],
    ['','','','','','','',''],
    ['','','','','','','',''],
    ['','','','','','','',''],
    ['','','','','','','',''],
    ['P','P','P','P','P','P','P','P'],
    ['R','N','B','Q','K','B','N','R'],
  ]
}

export function createInitialState(): GameState {
  return { board: createInitialBoard(), turn: 'white', castling: { whiteKing: true, whiteQueen: true, blackKing: true, blackQueen: true }, enPassantTarget: null, moveHistory: [], halfMoves: 0, fullMoves: 1 }
}

export function cloneBoard(b: Board): Board { return b.map(r => [...r]) }

// ── Unicode pieces ──
export const PIECE_SYMBOLS: Record<string, string> = {
  K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘', P: '♙',
  k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟',
}

// ── Find king ──
export function findKing(board: Board, color: PieceColor): [number, number] {
  const king = color === 'white' ? 'K' : 'k'
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) if (board[r][c] === king) return [r, c]
  return [-1, -1]
}

// ── Is square attacked? ──
export function isSquareAttacked(board: Board, row: number, col: number, byColor: PieceColor): boolean {
  // Knight attacks
  const knightOffsets = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]
  const enemyKnight = byColor === 'white' ? 'N' : 'n'
  for (const [dr, dc] of knightOffsets) {
    const r = row + dr, c = col + dc
    if (inBounds(r, c) && board[r][c] === enemyKnight) return true
  }

  // Pawn attacks
  const pawnDir = byColor === 'white' ? 1 : -1 // white pawns attack upward (row-1 from target)
  const enemyPawn = byColor === 'white' ? 'P' : 'p'
  if (inBounds(row + pawnDir, col - 1) && board[row + pawnDir][col - 1] === enemyPawn) return true
  if (inBounds(row + pawnDir, col + 1) && board[row + pawnDir][col + 1] === enemyPawn) return true

  // King attacks
  const enemyKing = byColor === 'white' ? 'K' : 'k'
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
    if (dr === 0 && dc === 0) continue
    const r = row + dr, c = col + dc
    if (inBounds(r, c) && board[r][c] === enemyKing) return true
  }

  // Sliding pieces (rook/queen for straight, bishop/queen for diagonal)
  const enemyRook = byColor === 'white' ? 'R' : 'r'
  const enemyBishop = byColor === 'white' ? 'B' : 'b'
  const enemyQueen = byColor === 'white' ? 'Q' : 'q'

  // Straight lines (rook + queen)
  const straightDirs = [[-1,0],[1,0],[0,-1],[0,1]]
  for (const [dr, dc] of straightDirs) {
    let r = row + dr, c = col + dc
    while (inBounds(r, c)) {
      if (board[r][c] !== '') {
        if (board[r][c] === enemyRook || board[r][c] === enemyQueen) return true
        break
      }
      r += dr; c += dc
    }
  }

  // Diagonals (bishop + queen)
  const diagDirs = [[-1,-1],[-1,1],[1,-1],[1,1]]
  for (const [dr, dc] of diagDirs) {
    let r = row + dr, c = col + dc
    while (inBounds(r, c)) {
      if (board[r][c] !== '') {
        if (board[r][c] === enemyBishop || board[r][c] === enemyQueen) return true
        break
      }
      r += dr; c += dc
    }
  }

  return false
}

// ── Check detection ──
export function isInCheck(board: Board, color: PieceColor): boolean {
  const [kr, kc] = findKing(board, color)
  if (kr === -1) return false
  const enemy = color === 'white' ? 'black' : 'white'
  return isSquareAttacked(board, kr, kc, enemy)
}

// ── Apply move (returns new board) ──
export function applyMove(board: Board, move: ChessMove): Board {
  const b = cloneBoard(board)
  const [fr, fc] = move.from
  const [tr, tc] = move.to

  b[tr][tc] = move.promotion || b[fr][fc]
  b[fr][fc] = ''

  // En passant capture
  if (move.enPassant) {
    const captureRow = move.piece === 'P' ? tr + 1 : tr - 1
    b[captureRow][tc] = ''
  }

  // Castling — move rook
  if (move.castle === 'kingside') {
    b[fr][5] = b[fr][7]; b[fr][7] = ''
  } else if (move.castle === 'queenside') {
    b[fr][3] = b[fr][0]; b[fr][0] = ''
  }

  return b
}

// ── Generate pseudo-legal moves (no check validation) ──
function generatePseudoMoves(board: Board, color: PieceColor, enPassant: [number, number] | null, castling: CastlingRights): ChessMove[] {
  const moves: ChessMove[] = []
  const dir = color === 'white' ? -1 : 1
  const startRow = color === 'white' ? 6 : 1
  const promoRow = color === 'white' ? 0 : 7
  const promos = color === 'white' ? ['Q','R','B','N'] : ['q','r','b','n']

  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const piece = board[r][c]
    if (piece === '' || !isOwnPiece(piece, color)) continue
    const pt = piece.toUpperCase()

    if (pt === 'P') {
      // Forward
      if (inBounds(r + dir, c) && board[r + dir][c] === '') {
        if (r + dir === promoRow) {
          promos.forEach(p => moves.push({ from: [r, c], to: [r + dir, c], piece, promotion: p }))
        } else {
          moves.push({ from: [r, c], to: [r + dir, c], piece })
          // Double push
          if (r === startRow && board[r + 2 * dir][c] === '') {
            moves.push({ from: [r, c], to: [r + 2 * dir, c], piece })
          }
        }
      }
      // Captures
      for (const dc of [-1, 1]) {
        const tr = r + dir, tc = c + dc
        if (!inBounds(tr, tc)) continue
        if (board[tr][tc] !== '' && isEnemyPiece(board[tr][tc], color)) {
          if (tr === promoRow) {
            promos.forEach(p => moves.push({ from: [r, c], to: [tr, tc], piece, captured: board[tr][tc], promotion: p }))
          } else {
            moves.push({ from: [r, c], to: [tr, tc], piece, captured: board[tr][tc] })
          }
        }
        // En passant
        if (enPassant && enPassant[0] === tr && enPassant[1] === tc) {
          moves.push({ from: [r, c], to: [tr, tc], piece, enPassant: true, captured: color === 'white' ? 'p' : 'P' })
        }
      }
    }

    if (pt === 'N') {
      for (const [dr, dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]) {
        const tr = r + dr, tc = c + dc
        if (!inBounds(tr, tc) || isOwnPiece(board[tr][tc], color)) continue
        moves.push({ from: [r, c], to: [tr, tc], piece, captured: board[tr][tc] || undefined })
      }
    }

    const slideDirs = pt === 'R' ? [[-1,0],[1,0],[0,-1],[0,1]] :
                      pt === 'B' ? [[-1,-1],[-1,1],[1,-1],[1,1]] :
                      pt === 'Q' ? [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]] : null

    if (slideDirs) {
      for (const [dr, dc] of slideDirs) {
        let tr = r + dr, tc = c + dc
        while (inBounds(tr, tc)) {
          if (isOwnPiece(board[tr][tc], color)) break
          moves.push({ from: [r, c], to: [tr, tc], piece, captured: board[tr][tc] || undefined })
          if (board[tr][tc] !== '') break
          tr += dr; tc += dc
        }
      }
    }

    if (pt === 'K') {
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue
        const tr = r + dr, tc = c + dc
        if (!inBounds(tr, tc) || isOwnPiece(board[tr][tc], color)) continue
        moves.push({ from: [r, c], to: [tr, tc], piece, captured: board[tr][tc] || undefined })
      }

      // Castling
      const enemy = color === 'white' ? 'black' : 'white'
      const row = color === 'white' ? 7 : 0
      if (r === row && c === 4) {
        // Kingside
        const canKS = color === 'white' ? castling.whiteKing : castling.blackKing
        if (canKS && board[row][5] === '' && board[row][6] === '' && board[row][7] === (color === 'white' ? 'R' : 'r')) {
          if (!isSquareAttacked(board, row, 4, enemy) && !isSquareAttacked(board, row, 5, enemy) && !isSquareAttacked(board, row, 6, enemy)) {
            moves.push({ from: [r, c], to: [row, 6], piece, castle: 'kingside' })
          }
        }
        // Queenside
        const canQS = color === 'white' ? castling.whiteQueen : castling.blackQueen
        if (canQS && board[row][3] === '' && board[row][2] === '' && board[row][1] === '' && board[row][0] === (color === 'white' ? 'R' : 'r')) {
          if (!isSquareAttacked(board, row, 4, enemy) && !isSquareAttacked(board, row, 3, enemy) && !isSquareAttacked(board, row, 2, enemy)) {
            moves.push({ from: [r, c], to: [row, 2], piece, castle: 'queenside' })
          }
        }
      }
    }
  }

  return moves
}

// ── Legal moves (filters out moves leaving king in check) ──
export function getLegalMoves(board: Board, color: PieceColor, enPassant: [number, number] | null, castling: CastlingRights): ChessMove[] {
  const pseudo = generatePseudoMoves(board, color, enPassant, castling)
  return pseudo.filter(move => {
    const newBoard = applyMove(board, move)
    return !isInCheck(newBoard, color)
  })
}

export function isCheckmate(board: Board, color: PieceColor, enPassant: [number, number] | null, castling: CastlingRights): boolean {
  return isInCheck(board, color) && getLegalMoves(board, color, enPassant, castling).length === 0
}

export function isStalemate(board: Board, color: PieceColor, enPassant: [number, number] | null, castling: CastlingRights): boolean {
  return !isInCheck(board, color) && getLegalMoves(board, color, enPassant, castling).length === 0
}

// ── Update castling rights after a move ──
export function updateCastling(castling: CastlingRights, move: ChessMove): CastlingRights {
  const c = { ...castling }
  const [fr, fc] = move.from
  // King moved
  if (move.piece === 'K') { c.whiteKing = false; c.whiteQueen = false }
  if (move.piece === 'k') { c.blackKing = false; c.blackQueen = false }
  // Rook moved or captured
  if (fr === 7 && fc === 0) c.whiteQueen = false
  if (fr === 7 && fc === 7) c.whiteKing = false
  if (fr === 0 && fc === 0) c.blackQueen = false
  if (fr === 0 && fc === 7) c.blackKing = false
  const [tr, tc] = move.to
  if (tr === 7 && tc === 0) c.whiteQueen = false
  if (tr === 7 && tc === 7) c.whiteKing = false
  if (tr === 0 && tc === 0) c.blackQueen = false
  if (tr === 0 && tc === 7) c.blackKing = false
  return c
}

// ── En passant target after a move ──
export function getEnPassantTarget(move: ChessMove): [number, number] | null {
  const pt = move.piece.toUpperCase()
  if (pt !== 'P') return null
  const [fr] = move.from
  const [tr, tc] = move.to
  if (Math.abs(tr - fr) === 2) return [(fr + tr) / 2, tc]
  return null
}

// ── Algebraic notation ──
export function moveToNotation(board: Board, move: ChessMove, allMoves: ChessMove[]): string {
  if (move.castle === 'kingside') return 'O-O'
  if (move.castle === 'queenside') return 'O-O-O'
  const pt = move.piece.toUpperCase()
  const files = 'abcdefgh'
  const toStr = files[move.to[1]] + (8 - move.to[0])
  let notation = ''
  if (pt === 'P') {
    if (move.captured || move.enPassant) notation = files[move.from[1]] + 'x' + toStr
    else notation = toStr
    if (move.promotion) notation += '=' + move.promotion.toUpperCase()
  } else {
    notation = pt
    // Disambiguation
    const same = allMoves.filter(m => m.piece === move.piece && m.to[0] === move.to[0] && m.to[1] === move.to[1] && (m.from[0] !== move.from[0] || m.from[1] !== move.from[1]))
    if (same.length > 0) {
      if (same.every(m => m.from[1] !== move.from[1])) notation += files[move.from[1]]
      else if (same.every(m => m.from[0] !== move.from[0])) notation += (8 - move.from[0])
      else notation += files[move.from[1]] + (8 - move.from[0])
    }
    if (move.captured) notation += 'x'
    notation += toStr
  }
  // Check/checkmate
  const newBoard = applyMove(board, move)
  const enemy = pieceColor(move.piece) === 'white' ? 'black' : 'white'
  if (isCheckmate(newBoard, enemy, null, { whiteKing: true, whiteQueen: true, blackKing: true, blackQueen: true })) notation += '#'
  else if (isInCheck(newBoard, enemy)) notation += '+'
  return notation
}

// ═══════════════════════════════════════════════════════════════
//  AI — Minimax with Alpha-Beta Pruning
// ═══════════════════════════════════════════════════════════════

// Piece values
const PIECE_VALUES: Record<string, number> = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 }

// Piece-square tables (from white's perspective, index 0 = rank 8)
const PST_PAWN = [
  [0,0,0,0,0,0,0,0],[50,50,50,50,50,50,50,50],[10,10,20,30,30,20,10,10],[5,5,10,25,25,10,5,5],
  [0,0,0,20,20,0,0,0],[5,-5,-10,0,0,-10,-5,5],[5,10,10,-20,-20,10,10,5],[0,0,0,0,0,0,0,0]
]
const PST_KNIGHT = [
  [-50,-40,-30,-30,-30,-30,-40,-50],[-40,-20,0,0,0,0,-20,-40],[-30,0,10,15,15,10,0,-30],[-30,5,15,20,20,15,5,-30],
  [-30,0,15,20,20,15,0,-30],[-30,5,10,15,15,10,5,-30],[-40,-20,0,5,5,0,-20,-40],[-50,-40,-30,-30,-30,-30,-40,-50]
]
const PST_BISHOP = [
  [-20,-10,-10,-10,-10,-10,-10,-20],[-10,0,0,0,0,0,0,-10],[-10,0,5,10,10,5,0,-10],[-10,5,5,10,10,5,5,-10],
  [-10,0,10,10,10,10,0,-10],[-10,10,10,10,10,10,10,-10],[-10,5,0,0,0,0,5,-10],[-20,-10,-10,-10,-10,-10,-10,-20]
]
const PST_ROOK = [
  [0,0,0,0,0,0,0,0],[5,10,10,10,10,10,10,5],[-5,0,0,0,0,0,0,-5],[-5,0,0,0,0,0,0,-5],
  [-5,0,0,0,0,0,0,-5],[-5,0,0,0,0,0,0,-5],[-5,0,0,0,0,0,0,-5],[0,0,0,5,5,0,0,0]
]
const PST_QUEEN = [
  [-20,-10,-10,-5,-5,-10,-10,-20],[-10,0,0,0,0,0,0,-10],[-10,0,5,5,5,5,0,-10],[-5,0,5,5,5,5,0,-5],
  [0,0,5,5,5,5,0,-5],[-10,5,5,5,5,5,0,-10],[-10,0,5,0,0,0,0,-10],[-20,-10,-10,-5,-5,-10,-10,-20]
]
const PST_KING_MID = [
  [-30,-40,-40,-50,-50,-40,-40,-30],[-30,-40,-40,-50,-50,-40,-40,-30],[-30,-40,-40,-50,-50,-40,-40,-30],[-30,-40,-40,-50,-50,-40,-40,-30],
  [-20,-30,-30,-40,-40,-30,-30,-20],[-10,-20,-20,-20,-20,-20,-20,-10],[20,20,0,0,0,0,20,20],[20,30,10,0,0,10,30,20]
]

const PST: Record<string, number[][]> = { p: PST_PAWN, n: PST_KNIGHT, b: PST_BISHOP, r: PST_ROOK, q: PST_QUEEN, k: PST_KING_MID }

function evaluate(board: Board): number {
  let score = 0
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const piece = board[r][c]
    if (piece === '') continue
    const pt = piece.toLowerCase()
    const val = PIECE_VALUES[pt] || 0
    const pst = PST[pt]
    const posVal = pst ? (isWhite(piece) ? pst[r][c] : pst[7 - r][c]) : 0
    score += isWhite(piece) ? (val + posVal) : -(val + posVal)
  }
  return score
}

function orderMoves(moves: ChessMove[]): ChessMove[] {
  return moves.sort((a, b) => {
    let sa = 0, sb = 0
    if (a.captured) sa += PIECE_VALUES[a.captured.toLowerCase()] || 100
    if (b.captured) sb += PIECE_VALUES[b.captured.toLowerCase()] || 100
    if (a.promotion) sa += 800
    if (b.promotion) sb += 800
    return sb - sa
  })
}

function minimax(board: Board, depth: number, alpha: number, beta: number, isMax: boolean, color: PieceColor, ep: [number, number] | null, castling: CastlingRights): number {
  if (depth === 0) return evaluate(board)
  const moves = getLegalMoves(board, color, ep, castling)
  if (moves.length === 0) {
    if (isInCheck(board, color)) return isMax ? -99999 + (10 - depth) : 99999 - (10 - depth)
    return 0 // Stalemate
  }
  const ordered = orderMoves(moves)
  const nextColor = color === 'white' ? 'black' : 'white'

  if (isMax) {
    let maxEval = -Infinity
    for (const move of ordered) {
      const newBoard = applyMove(board, move)
      const newCastling = updateCastling(castling, move)
      const newEp = getEnPassantTarget(move)
      const ev = minimax(newBoard, depth - 1, alpha, beta, false, nextColor, newEp, newCastling)
      maxEval = Math.max(maxEval, ev)
      alpha = Math.max(alpha, ev)
      if (beta <= alpha) break
    }
    return maxEval
  } else {
    let minEval = Infinity
    for (const move of ordered) {
      const newBoard = applyMove(board, move)
      const newCastling = updateCastling(castling, move)
      const newEp = getEnPassantTarget(move)
      const ev = minimax(newBoard, depth - 1, alpha, beta, true, nextColor, newEp, newCastling)
      minEval = Math.min(minEval, ev)
      beta = Math.min(beta, ev)
      if (beta <= alpha) break
    }
    return minEval
  }
}

export type Difficulty = 'easy' | 'medium' | 'hard'

export function getBestMove(board: Board, color: PieceColor, difficulty: Difficulty, ep: [number, number] | null, castling: CastlingRights): ChessMove | null {
  const moves = getLegalMoves(board, color, ep, castling)
  if (moves.length === 0) return null

  const depth = difficulty === 'easy' ? 2 : difficulty === 'medium' ? 3 : 4
  const isMax = color === 'white'
  let bestMove = moves[0]
  let bestEval = isMax ? -Infinity : Infinity

  const ordered = orderMoves([...moves])

  for (const move of ordered) {
    const newBoard = applyMove(board, move)
    const newCastling = updateCastling(castling, move)
    const newEp = getEnPassantTarget(move)
    const nextColor = color === 'white' ? 'black' : 'white'
    const ev = minimax(newBoard, depth - 1, -Infinity, Infinity, !isMax, nextColor, newEp, newCastling)

    if (isMax ? ev > bestEval : ev < bestEval) {
      bestEval = ev
      bestMove = move
    }
  }

  // Add randomness on easy
  if (difficulty === 'easy' && Math.random() < 0.3) {
    return moves[Math.floor(Math.random() * moves.length)]
  }

  return bestMove
}

// ── Coordinate helpers ──
export const toAlgebraic = (r: number, c: number): string => 'abcdefgh'[c] + (8 - r)
export const fromAlgebraic = (s: string): [number, number] => [8 - parseInt(s[1]), 'abcdefgh'.indexOf(s[0])]
