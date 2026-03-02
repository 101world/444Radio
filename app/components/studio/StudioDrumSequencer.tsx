'use client'

// ═══════════════════════════════════════════════════════════════
//  STUDIO DRUM SEQUENCER — Visual step sequencer for drum channels
//
//  Designed for the Studio workflow:
//  • Rows = drum instruments (BD, SD, HH, CP, etc.)
//  • 16 steps = 1 Strudel cycle (bar). Supports 1/2/4 bars.
//  • Single channels → 1 row; stack() channels → multi-row
//  • Click to toggle hits, velocity via brightness
//  • Pattern presets: "4-on-floor", "Breakbeat", "Boom Bap", etc.
//  • Only writes to code on user interaction (never on mount)
//  • Outputs clean mini-notation that maps 1:1 to Strudel timing
// ═══════════════════════════════════════════════════════════════

import { useState, useCallback, useMemo, useRef, useEffect } from 'react'

// ─── Drum instrument definitions ───

interface DrumInstrument {
  id: string         // Strudel sample name
  label: string      // Display label
  icon: string       // Emoji
  color: string      // Hex color for the row
  shortcut?: string  // Keyboard shortcut
}

const DRUM_KIT: DrumInstrument[] = [
  { id: 'bd',    label: 'KICK',    icon: '🥁', color: '#ef4444', shortcut: 'K' },
  { id: 'sd',    label: 'SNARE',   icon: '🪘', color: '#f59e0b', shortcut: 'S' },
  { id: 'cp',    label: 'CLAP',    icon: '👏', color: '#ec4899', shortcut: 'C' },
  { id: 'rim',   label: 'RIM',     icon: '🔔', color: '#a855f7', shortcut: 'R' },
  { id: 'hh',    label: 'HI-HAT',  icon: '🎩', color: '#22d3ee', shortcut: 'H' },
  { id: 'oh',    label: 'OPEN HH', icon: '💿', color: '#06b6d4', shortcut: 'O' },
  { id: 'tom',   label: 'TOM',     icon: '🥁', color: '#10b981', shortcut: 'T' },
  { id: 'ride',  label: 'RIDE',    icon: '🔔', color: '#6366f1', shortcut: 'I' },
  { id: 'crash', label: 'CRASH',   icon: '💥', color: '#f43f5e' },
  { id: 'perc',  label: 'PERC',    icon: '🎵', color: '#84cc16' },
]

// ─── Drum pattern presets ───

interface DrumPreset {
  id: string
  name: string
  icon: string
  desc: string
  /** Map of drum ID → 16-step pattern (1=hit, 0=rest). Multi-bar uses array of arrays. */
  pattern: Record<string, number[]>
}

const DRUM_PRESETS: DrumPreset[] = [
  {
    id: '4floor',
    name: 'Four on the Floor',
    icon: '🏠',
    desc: 'Classic house/techno kick',
    pattern: {
      bd: [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0],
      sd: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
      hh: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0],
    },
  },
  {
    id: 'boombap',
    name: 'Boom Bap',
    icon: '🎤',
    desc: 'Classic hip-hop groove',
    pattern: {
      bd: [1,0,0,0, 0,0,1,0, 0,0,1,0, 0,0,0,0],
      sd: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,1],
      hh: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0],
    },
  },
  {
    id: 'breakbeat',
    name: 'Breakbeat',
    icon: '💥',
    desc: 'Syncopated break pattern',
    pattern: {
      bd: [1,0,0,0, 0,0,1,0, 0,1,0,0, 0,0,0,0],
      sd: [0,0,0,0, 1,0,0,1, 0,0,0,0, 1,0,1,0],
      hh: [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1],
    },
  },
  {
    id: 'dnb',
    name: 'Drum & Bass',
    icon: '⚡',
    desc: 'Fast two-step pattern',
    pattern: {
      bd: [1,0,0,0, 0,0,1,0, 0,0,0,0, 1,0,0,0],
      sd: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,1],
      hh: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0],
    },
  },
  {
    id: 'halftime',
    name: 'Half-Time',
    icon: '🐢',
    desc: 'Slow, heavy feel',
    pattern: {
      bd: [1,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
      sd: [0,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0],
      hh: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0],
    },
  },
  {
    id: 'reggaeton',
    name: 'Reggaeton',
    icon: '🌴',
    desc: 'Dembow riddim',
    pattern: {
      bd: [1,0,0,0, 0,0,0,1, 0,0,1,0, 0,0,0,0],
      sd: [0,0,0,1, 0,0,0,0, 0,0,0,1, 0,0,0,0],
      hh: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0],
      rim:[0,0,0,1, 0,0,0,0, 0,0,0,1, 0,0,0,0],
    },
  },
  {
    id: 'trap',
    name: 'Trap',
    icon: '🔥',
    desc: 'Rolling hi-hats trap',
    pattern: {
      bd: [1,0,0,0, 0,0,0,0, 1,0,1,0, 0,0,0,0],
      sd: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
      hh: [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1],
      oh: [0,0,0,0, 0,0,0,1, 0,0,0,0, 0,0,0,1],
    },
  },
  {
    id: 'empty',
    name: 'Clear All',
    icon: '🗑️',
    desc: 'Empty grid',
    pattern: {},
  },
]

// ─── Audio preview ───

let previewCtx: AudioContext | null = null

function playDrumPreview(instrument: string) {
  if (!previewCtx) previewCtx = new AudioContext()
  if (previewCtx.state === 'suspended') previewCtx.resume()

  // Simple noise-based drum preview
  const now = previewCtx.currentTime

  if (instrument === 'bd' || instrument === 'kick') {
    // Kick: sine sweep down
    const osc = previewCtx.createOscillator()
    const gain = previewCtx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(150, now)
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.1)
    gain.gain.setValueAtTime(0.3, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15)
    osc.connect(gain).connect(previewCtx.destination)
    osc.start()
    osc.stop(now + 0.2)
  } else if (instrument === 'sd' || instrument === 'snare') {
    // Snare: noise burst + tone
    const bufferSize = previewCtx.sampleRate * 0.08
    const buffer = previewCtx.createBuffer(1, bufferSize, previewCtx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize)
    const noise = previewCtx.createBufferSource()
    noise.buffer = buffer
    const gain = previewCtx.createGain()
    gain.gain.setValueAtTime(0.15, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1)
    noise.connect(gain).connect(previewCtx.destination)
    noise.start()
  } else if (instrument === 'hh' || instrument === 'oh' || instrument === 'ride' || instrument === 'crash') {
    // Hihat/cymbal: filtered noise
    const bufferSize = previewCtx.sampleRate * (instrument === 'oh' || instrument === 'crash' ? 0.15 : 0.04)
    const buffer = previewCtx.createBuffer(1, bufferSize, previewCtx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize)
    const noise = previewCtx.createBufferSource()
    noise.buffer = buffer
    const hpf = previewCtx.createBiquadFilter()
    hpf.type = 'highpass'
    hpf.frequency.value = instrument === 'ride' || instrument === 'crash' ? 3000 : 6000
    const gain = previewCtx.createGain()
    gain.gain.setValueAtTime(0.1, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08)
    noise.connect(hpf).connect(gain).connect(previewCtx.destination)
    noise.start()
  } else {
    // Generic click
    const osc = previewCtx.createOscillator()
    const gain = previewCtx.createGain()
    osc.type = 'triangle'
    osc.frequency.value = 800
    gain.gain.setValueAtTime(0.1, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05)
    osc.connect(gain).connect(previewCtx.destination)
    osc.start()
    osc.stop(now + 0.06)
  }
}

// ─── Pattern parsing ───

/** Parse a drum channel's s() pattern into step hits */
function parseDrumPattern(pattern: string, stepsPerBar: number = 16): { hits: Set<number>; bars: number } {
  const hits = new Set<number>()
  if (!pattern || !pattern.trim()) return { hits, bars: 1 }

  const trimmed = pattern.trim()

  // Handle pure repetitions: "bd!4" → "bd bd bd bd", "hh*8" → 8 evenly spaced
  // We normalize the mini-notation into stepsPerBar steps

  // First strip the instrument name to get the rhythm part
  // Patterns like "bd!4", "bd*4", "hh*8", "bd [~ bd] ~ bd", etc.

  // Check for multi-bar: "<...>"
  const isMultiBar = trimmed.startsWith('<') && trimmed.endsWith('>')
  if (isMultiBar) {
    const inner = trimmed.slice(1, -1).trim()
    const entries = splitTopLevel(inner)
    entries.forEach((entry, barIdx) => {
      const offset = barIdx * stepsPerBar
      const clean = entry.startsWith('[') && entry.endsWith(']')
        ? entry.slice(1, -1).trim() : entry
      parseRhythmToSteps(clean, stepsPerBar).forEach(s => hits.add(offset + s))
    })
    return { hits, bars: entries.length }
  }

  // Single bar
  parseRhythmToSteps(trimmed, stepsPerBar).forEach(s => hits.add(s))
  return { hits, bars: 1 }
}

/** Parse a mini-notation rhythm string into step positions (0-15) */
function parseRhythmToSteps(pattern: string, totalSteps: number): number[] {
  const steps: number[] = []

  // Handle *N multiplier: "hh*8" means 8 evenly spaced hits in 16 steps
  const mulMatch = pattern.match(/^\w+\*(\d+)$/)
  if (mulMatch) {
    const count = parseInt(mulMatch[1])
    const spacing = totalSteps / count
    for (let i = 0; i < count; i++) {
      steps.push(Math.round(i * spacing))
    }
    return steps
  }

  // Handle !N repeat: "bd!4" means same sample repeated 4 times
  const repMatch = pattern.match(/^\w+!(\d+)$/)
  if (repMatch) {
    const count = parseInt(repMatch[1])
    const spacing = totalSteps / count
    for (let i = 0; i < count; i++) {
      steps.push(Math.round(i * spacing))
    }
    return steps
  }

  // Parse space-separated tokens: "bd [~ bd] ~ bd"
  const tokens = tokenize(pattern)
  const stepPer = totalSteps / tokens.length
  tokens.forEach((tok, i) => {
    if (tok === '~' || tok === '-' || tok === 'silence') return
    const step = Math.round(i * stepPer)
    if (tok.startsWith('[') && tok.endsWith(']')) {
      // Sub-group: [~ bd] = subdivide
      const inner = tok.slice(1, -1).trim().split(/\s+/)
      const subStep = stepPer / inner.length
      inner.forEach((sub, j) => {
        if (sub !== '~' && sub !== '-') {
          steps.push(Math.round(step + j * subStep))
        }
      })
    } else {
      steps.push(step)
    }
  })

  return steps.filter(s => s < totalSteps)
}

/** Tokenize mini-notation respecting brackets */
function tokenize(str: string): string[] {
  const tokens: string[] = []
  let depth = 0, current = ''
  for (const ch of str) {
    if (ch === '[') { depth++; current += ch }
    else if (ch === ']') { depth--; current += ch }
    else if (ch === ' ' && depth === 0) {
      if (current.trim()) tokens.push(current.trim())
      current = ''
    } else current += ch
  }
  if (current.trim()) tokens.push(current.trim())
  return tokens
}

/** Same as piano roll — split top-level entries in <...> */
function splitTopLevel(str: string): string[] {
  const entries: string[] = []
  let depth = 0, current = ''
  for (const ch of str) {
    if (ch === '[') { depth++; current += ch }
    else if (ch === ']') { depth--; current += ch }
    else if (ch === ' ' && depth === 0) { if (current.trim()) entries.push(current.trim()); current = '' }
    else current += ch
  }
  if (current.trim()) entries.push(current.trim())
  return entries
}

// ─── Generate pattern from grid ───

/** Convert a Set<step> into Strudel mini-notation for a drum instrument */
function hitsToPattern(hits: Set<number>, bars: number, instrument: string, stepsPerBar: number = 16): string {
  const totalSteps = bars * stepsPerBar

  const barPatterns: string[] = []
  for (let bar = 0; bar < bars; bar++) {
    const tokens: string[] = []
    for (let s = 0; s < stepsPerBar; s++) {
      const step = bar * stepsPerBar + s
      tokens.push(hits.has(step) ? instrument : '~')
    }

    // Compress: detect simple repeats
    const compressed = compressPattern(tokens, instrument)
    barPatterns.push(compressed)
  }

  if (bars === 1) return barPatterns[0]
  return `<${barPatterns.map(b => `[${b}]`).join(' ')}>`
}

/** Try to compress "bd ~ ~ ~ bd ~ ~ ~ bd ~ ~ ~ bd ~ ~ ~" → "bd*4" */
function compressPattern(tokens: string[], instrument: string): string {
  const len = tokens.length // 16

  // Check if all hits are evenly spaced
  const hitPositions = tokens.reduce<number[]>((arr, t, i) => {
    if (t !== '~') arr.push(i)
    return arr
  }, [])

  if (hitPositions.length === 0) return '~'

  // Check even spacing
  if (hitPositions.length >= 2) {
    const spacing = hitPositions[1] - hitPositions[0]
    const isEven = hitPositions.every((pos, i) => pos === hitPositions[0] + i * spacing)
    if (isEven && hitPositions[0] === 0 && hitPositions.length * spacing === len) {
      if (hitPositions.length === len) {
        // Every step: "bd*16"
        return `${instrument}*${len}`
      }
      return `${instrument}*${hitPositions.length}`
    }
  }

  // Check for !N pattern (all same, evenly spaced, including first)
  if (hitPositions.length >= 2 && hitPositions[0] === 0) {
    const spacing = len / hitPositions.length
    const isRepeat = hitPositions.every((pos, i) => pos === Math.round(i * spacing))
    if (isRepeat && Number.isInteger(spacing)) {
      return `${instrument}!${hitPositions.length}`
    }
  }

  // Fall back to full token list
  return tokens.join(' ')
}

// ─── Parse stack channel into sub-patterns ───

interface DrumRow {
  instrument: string
  pattern: string        // Original mini-notation pattern
  bank?: string          // e.g. "RolandTR808"
  isGenerative: boolean  // Has perlin, irand, etc.
}

/** Extract the drum instrument name from a pattern string.
 *  e.g. "hh*8" → "hh", "~ sd ~ sd" → "sd", "bd!4" → "bd", "[~ hh]*4" → "hh" */
function extractInstrumentName(fullPattern: string): string {
  // Find the first alphabetic word that isn't a rest token
  const words = fullPattern.match(/\b([a-zA-Z_][a-zA-Z0-9_]*)\b/g)
  if (!words) return 'perc'
  for (const w of words) {
    if (w === 'silence') continue
    return w
  }
  return 'perc'
}

/** Extract individual drum lines from a stack channel or single channel */
function parseChannelDrumRows(rawCode: string): DrumRow[] {
  const rows: DrumRow[] = []

  // Check if it's a stack
  const isStack = /stack\s*\(/.test(rawCode)

  if (isStack) {
    // Find the stack(...) contents and split by comma-delimited s() calls
    const stackMatch = rawCode.match(/stack\s*\(/)
    if (!stackMatch) return rows
    const openIdx = rawCode.indexOf('(', stackMatch.index!)
    const closeIdx = findStackClosingParen(rawCode, openIdx)
    if (closeIdx === -1) return rows

    const stackBody = rawCode.substring(openIdx + 1, closeIdx)
    // Split by top-level commas (respecting parentheses)
    const parts = splitByTopLevelComma(stackBody)

    for (const part of parts) {
      const sMatch = part.match(/s\(\s*"([^"]+)"/)
      if (sMatch) {
        const fullPattern = sMatch[1]
        const instrument = extractInstrumentName(fullPattern)
        const bankMatch = part.match(/\.bank\(\s*"([^"]*)"/)
        const isGen = /perlin|irand|rand|sine|saw/.test(part.replace(/\.bank\([^)]*\)/g, ''))
        rows.push({
          instrument,
          pattern: fullPattern,
          bank: bankMatch?.[1],
          isGenerative: isGen,
        })
      }
    }
  } else {
    // Single s() channel
    const sMatch = rawCode.match(/s\(\s*"([^"]+)"/)
    if (sMatch) {
      const fullPattern = sMatch[1]
      const instrument = extractInstrumentName(fullPattern)
      const bankMatch = rawCode.match(/\.bank\(\s*"([^"]*)"/)
      const isGen = /perlin|irand|rand|sine|saw/.test(rawCode.replace(/\.bank\([^)]*\)/g, '').replace(/s\("[^"]*"\)/g, ''))
      rows.push({
        instrument,
        pattern: fullPattern,
        bank: bankMatch?.[1],
        isGenerative: isGen,
      })
    }
  }

  return rows
}

function findStackClosingParen(str: string, openIdx: number): number {
  let depth = 1
  for (let i = openIdx + 1; i < str.length; i++) {
    if (str[i] === '(') depth++
    else if (str[i] === ')') { depth--; if (depth === 0) return i }
  }
  return -1
}

function splitByTopLevelComma(str: string): string[] {
  const parts: string[] = []
  let depth = 0, current = ''
  for (const ch of str) {
    if (ch === '(' || ch === '[' || ch === '<') { depth++; current += ch }
    else if (ch === ')' || ch === ']' || ch === '>') { depth--; current += ch }
    else if (ch === ',' && depth === 0) {
      if (current.trim()) parts.push(current.trim())
      current = ''
    } else current += ch
  }
  if (current.trim()) parts.push(current.trim())
  return parts
}

// ═══════════════════════════════════════════════════════════════
//  COMPONENT
// ═══════════════════════════════════════════════════════════════

interface StudioDrumSequencerProps {
  /** Raw code of the channel block */
  channelRawCode: string
  /** Channel color for theming */
  color: string
  /** Channel name */
  channelName: string
  /** Bank name if any (e.g. "RolandTR909") */
  bank?: string
  /** Called when user edits — receives new code block (modified rawCode) */
  onPatternChange: (newRawCode: string) => void
  /** Close the sequencer */
  onClose: () => void
}

const CELL_W_BASE = 28
const CELL_H_BASE = 22
const LABEL_W = 60
const BAR_OPTIONS = [1, 2, 4] as const
const GRID_OPTIONS = [16, 32] as const

export default function StudioDrumSequencer({
  channelRawCode,
  color,
  channelName,
  bank,
  onPatternChange,
  onClose,
}: StudioDrumSequencerProps) {
  const [bars, setBars] = useState(1)
  // Grid state: Map<instrumentId, Set<step>>
  const [grid, setGrid] = useState<Map<string, Set<number>>>(new Map())
  const [activeRows, setActiveRows] = useState<string[]>([])
  const [hasUserEdited, setHasUserEdited] = useState(false)
  const [showPresets, setShowPresets] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(1)
  const [stepsPerBar, setStepsPerBar] = useState<16 | 32>(16)
  const cellW = Math.round(CELL_W_BASE * zoom)
  const cellH = Math.round(CELL_H_BASE * zoom)
  const isDrawing = useRef(false)
  const drawMode = useRef<'add' | 'remove'>('add')
  const lastCell = useRef<string | null>(null)
  const gridRef = useRef(grid)
  gridRef.current = grid
  const activeRowsRef = useRef(activeRows)
  activeRowsRef.current = activeRows
  const isStackRef = useRef(false)
  const drumRowsRef = useRef<DrumRow[]>([])

  // ── Parse channel on mount / prop change ──
  useEffect(() => {
    const drumRows = parseChannelDrumRows(channelRawCode)
    drumRowsRef.current = drumRows
    isStackRef.current = /stack\s*\(/.test(channelRawCode)

    const newGrid = new Map<string, Set<number>>()
    const rowIds: string[] = []

    for (const row of drumRows) {
      const { hits, bars: parsedBars } = parseDrumPattern(row.pattern, stepsPerBar)
      newGrid.set(row.instrument, hits)
      rowIds.push(row.instrument)
      if (parsedBars > 1) setBars(parsedBars as 1 | 2 | 4)
    }

    // If only one instrument, also show complementary drums
    if (rowIds.length === 1) {
      const existing = rowIds[0]
      const defaults = ['bd', 'sd', 'hh', 'cp']
      for (const d of defaults) {
        if (!rowIds.includes(d) && d !== existing) {
          rowIds.push(d)
          newGrid.set(d, new Set())
        }
      }
    }

    setGrid(newGrid)
    setActiveRows(rowIds)
    setHasUserEdited(false)
  }, [channelRawCode])

  // ── Emit pattern change (debounced) ──
  const emitTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!hasUserEdited) return
    if (emitTimer.current) clearTimeout(emitTimer.current)
    emitTimer.current = setTimeout(() => {
      const newCode = buildCodeFromGrid(
        gridRef.current,
        activeRowsRef.current,
        bars,
        channelRawCode,
        drumRowsRef.current,
        isStackRef.current,
        stepsPerBar,
      )
      onPatternChange(newCode)
    }, 150)
    return () => { if (emitTimer.current) clearTimeout(emitTimer.current) }
  }, [grid, hasUserEdited, bars, channelRawCode, onPatternChange, stepsPerBar])

  // ── Toggle hit ──
  const toggleHit = useCallback((instrument: string, step: number, forceMode?: 'add' | 'remove') => {
    setGrid(prev => {
      const next = new Map(prev)
      const hits = new Set(prev.get(instrument) || new Set<number>())
      const mode = forceMode || (hits.has(step) ? 'remove' : 'add')
      if (mode === 'remove') {
        hits.delete(step)
      } else {
        hits.add(step)
        playDrumPreview(instrument)
      }
      next.set(instrument, hits)
      return next
    })
    setHasUserEdited(true)
  }, [])

  // ── Mouse handlers ──
  const handleCellDown = useCallback((instrument: string, step: number, e: React.MouseEvent) => {
    e.preventDefault()
    const key = `${instrument}:${step}`
    isDrawing.current = true
    const hits = grid.get(instrument) || new Set<number>()
    drawMode.current = hits.has(step) ? 'remove' : 'add'
    lastCell.current = key
    toggleHit(instrument, step, drawMode.current)
  }, [grid, toggleHit])

  const handleCellEnter = useCallback((instrument: string, step: number) => {
    if (!isDrawing.current) return
    const key = `${instrument}:${step}`
    if (key === lastCell.current) return
    lastCell.current = key
    toggleHit(instrument, step, drawMode.current)
  }, [toggleHit])

  useEffect(() => {
    const up = () => { isDrawing.current = false; lastCell.current = null }
    window.addEventListener('mouseup', up)
    return () => window.removeEventListener('mouseup', up)
  }, [])

  // ── Keyboard ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  // ── Add row ──
  const addRow = useCallback((instrumentId: string) => {
    if (activeRows.includes(instrumentId)) return
    setActiveRows(prev => [...prev, instrumentId])
    setGrid(prev => {
      const next = new Map(prev)
      if (!next.has(instrumentId)) next.set(instrumentId, new Set())
      return next
    })
  }, [activeRows])

  // ── Remove row ──
  const removeRow = useCallback((instrumentId: string) => {
    setActiveRows(prev => prev.filter(r => r !== instrumentId))
    setGrid(prev => {
      const next = new Map(prev)
      next.delete(instrumentId)
      return next
    })
    setHasUserEdited(true)
  }, [])

  // ── Clear all ──
  const clearAll = useCallback(() => {
    setGrid(prev => {
      const next = new Map<string, Set<number>>()
      prev.forEach((_, key) => next.set(key, new Set()))
      return next
    })
    setHasUserEdited(true)
  }, [])

  // ── Load preset ──
  const loadPreset = useCallback((preset: DrumPreset) => {
    const newGrid = new Map<string, Set<number>>()
    const newRows = new Set(activeRows)

    // Load preset patterns
    for (const [instrument, steps] of Object.entries(preset.pattern)) {
      const hits = new Set<number>()
      steps.forEach((v, i) => { if (v) hits.add(i) })
      newGrid.set(instrument, hits)
      newRows.add(instrument)
    }

    // Keep existing rows but clear them if not in preset
    for (const row of activeRows) {
      if (!newGrid.has(row)) newGrid.set(row, new Set())
    }

    setGrid(newGrid)
    setActiveRows([...newRows])
    setBars(1)
    setHasUserEdited(true)
    setShowPresets(false)
  }, [activeRows])

  // ── Instruments not yet in grid (for "add row" menu) ──
  const availableInstruments = useMemo(
    () => DRUM_KIT.filter(d => !activeRows.includes(d.id)),
    [activeRows],
  )

  // ── Drum info lookup ──
  const getDrum = useCallback((id: string): DrumInstrument => {
    return DRUM_KIT.find(d => d.id === id) || {
      id, label: id.toUpperCase(), icon: '🔊', color: '#888',
    }
  }, [])

  const totalSteps = bars * stepsPerBar
  const totalHits = useMemo(() => {
    let count = 0
    grid.forEach(hits => count += hits.size)
    return count
  }, [grid])

  return (
    <div
      className="absolute bottom-0 left-0 right-0 z-[100] flex flex-col select-none"
      style={{
        height: Math.min(activeRows.length * cellH + 100, 360),
        background: '#23262b',
        borderTop: '1px solid rgba(255,255,255,0.04)',
        boxShadow: '0 -8px 16px #14161a',
      }}
      onClick={e => e.stopPropagation()}
    >
      {/* ═══ TOOLBAR ═══ */}
      <div className="flex items-center justify-between px-3 py-1.5 shrink-0"
        style={{ background: '#2a2e34', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color }}>
            🥁 {channelName}
          </span>
          {bank && (
            <span className="text-[7px] font-mono" style={{ color: '#b8a47f', opacity: 0.5 }}>{bank}</span>
          )}

          <div className="w-px h-3.5 bg-white/[0.08]" />

          {/* Bars */}
          <span className="text-[7px] uppercase tracking-wider" style={{ color: '#5a616b' }}>Bars</span>
          {BAR_OPTIONS.map(b => (
            <button
              key={b}
              onClick={() => { setBars(b); setHasUserEdited(true) }}
              className="px-1.5 py-0.5 rounded text-[8px] font-bold cursor-pointer transition-all"
              style={{
                background: bars === b ? '#2a2e34' : 'transparent',
                color: bars === b ? color : '#5a616b',
                border: 'none',
                borderRadius: '8px',
                boxShadow: bars === b
                  ? 'inset 2px 2px 4px #14161a, inset -2px -2px 4px #2c3036'
                  : 'none',
              }}
            >
              {b}
            </button>
          ))}

          <div className="w-px h-3.5 bg-white/[0.08]" />

          {/* Grid resolution */}
          <span className="text-[7px] uppercase tracking-wider font-bold" style={{ color: '#5a616b' }}>Grid</span>
          {GRID_OPTIONS.map(g => (
            <button
              key={g}
              onClick={() => {
                if (g === stepsPerBar) return
                const ratio = g / stepsPerBar
                setStepsPerBar(g)
                setGrid(prev => {
                  const next = new Map<string, Set<number>>()
                  prev.forEach((hits, instrumentId) => {
                    const newHits = new Set<number>()
                    hits.forEach(step => newHits.add(Math.round(step * ratio)))
                    next.set(instrumentId, newHits)
                  })
                  return next
                })
                setHasUserEdited(true)
              }}
              className="px-1.5 py-0.5 text-[8px] font-bold cursor-pointer transition-all"
              style={{
                background: stepsPerBar === g ? '#2a2e34' : '#1c1e22',
                color: stepsPerBar === g ? color : '#5a616b',
                border: 'none',
                borderRadius: '8px',
                boxShadow: stepsPerBar === g
                  ? 'inset 2px 2px 4px #14161a, inset -2px -2px 4px #2c3036'
                  : '2px 2px 4px #14161a, -2px -2px 4px #2c3036',
              }}
            >
              1/{g}
            </button>
          ))}

          <div className="w-px h-3.5 bg-white/[0.08]" />

          {/* Zoom controls */}
          <span className="text-[7px] uppercase tracking-wider font-bold" style={{ color: '#5a616b' }}>Zoom</span>
          <button
            onClick={() => setZoom(z => Math.max(0.4, +(z - 0.2).toFixed(1)))}
            className="px-1 py-0.5 text-[9px] font-bold cursor-pointer transition-all"
            style={{ background: '#1c1e22', color: '#c8cdd2', border: 'none', borderRadius: '8px', boxShadow: '2px 2px 4px #14161a, -2px -2px 4px #2c3036', lineHeight: 1 }}
          >−</button>
          <span className="text-[7px] font-mono font-bold" style={{ color: '#c8cdd2' }}>{Math.round(zoom * 100)}%</span>
          <button
            onClick={() => setZoom(z => Math.min(3, +(z + 0.2).toFixed(1)))}
            className="px-1 py-0.5 text-[9px] font-bold cursor-pointer transition-all"
            style={{ background: '#1c1e22', color: '#c8cdd2', border: 'none', borderRadius: '8px', boxShadow: '2px 2px 4px #14161a, -2px -2px 4px #2c3036', lineHeight: 1 }}
          >+</button>

          <div className="w-px h-3.5 bg-white/[0.08]" />

          {/* Presets button */}
          <div className="relative">
            <button
              onClick={() => setShowPresets(p => !p)}
              className="px-2 py-0.5 rounded-xl text-[7px] font-bold uppercase tracking-wider cursor-pointer transition-all duration-[180ms]"
              style={{ background: '#2a2e34', color: '#6f8fb3', boxShadow: '2px 2px 4px #14161a, -2px -2px 4px #2c3036' }}
            >
              ✨ Presets
            </button>

            {/* Preset dropdown */}
            {showPresets && (
              <div className="absolute top-full left-0 mt-1 w-52 rounded-2xl z-50 overflow-hidden"
                style={{ background: '#2a2e34', border: '1px solid rgba(255,255,255,0.04)', boxShadow: '8px 8px 16px #14161a, -8px -8px 16px #2c3036' }}>
                <div className="text-[7px] font-bold uppercase tracking-wider px-2 py-1.5" style={{ color: '#5a616b', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  DRUM PATTERNS
                </div>
                {DRUM_PRESETS.map(p => (
                  <button
                    key={p.id}
                    onClick={() => loadPreset(p)}
                    className="flex items-center gap-2 w-full px-2 py-1.5 text-left cursor-pointer
                      transition-colors duration-[180ms] last:border-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}
                  >
                    <span className="text-xs">{p.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[8px] font-bold" style={{ color: '#c8cdd2' }}>{p.name}</div>
                      <div className="text-[7px]" style={{ color: '#5a616b' }}>{p.desc}</div>
                    </div>
                    {/* Mini preview */}
                    <div className="flex gap-px shrink-0">
                      {Array.from({ length: 16 }, (_, i) => {
                        const hasHit = Object.values(p.pattern).some(arr => arr[i])
                        return (
                          <div key={i} className="rounded-sm" style={{
                            width: 3, height: 8,
                            background: hasHit ? `${color}80` : 'rgba(255,255,255,0.04)',
                          }} />
                        )
                      })}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-1.5">
          {hasUserEdited && (
            <span className="text-[7px] font-bold px-1.5 py-0.5 rounded-lg"
              style={{ color: '#7fa998', background: '#1c1e22', boxShadow: 'inset 1px 1px 3px #14161a, inset -1px -1px 3px #2c3036' }}>
              ● LIVE
            </span>
          )}
          <span className="text-[7px] font-mono" style={{ color: '#5a616b' }}>
            {totalHits} hit{totalHits !== 1 ? 's' : ''}
          </span>
          <button onClick={clearAll}
            className="px-1.5 py-0.5 rounded-lg text-[7px] cursor-pointer
              transition-all duration-[180ms]"
            style={{ background: '#1c1e22', color: '#5a616b', boxShadow: '2px 2px 4px #14161a, -2px -2px 4px #2c3036' }}>
            Clear
          </button>
          <button onClick={onClose}
            className="px-1.5 py-0.5 rounded-lg text-[7px] cursor-pointer
              transition-all duration-[180ms]"
            style={{ background: '#1c1e22', color: '#5a616b', boxShadow: '2px 2px 4px #14161a, -2px -2px 4px #2c3036' }}
            title="Esc">
            ✕
          </button>
        </div>
      </div>

      {/* ═══ GRID ═══ */}
      <div ref={scrollRef} className="flex-1 overflow-auto"
        style={{ scrollbarWidth: 'thin', scrollbarColor: `${color}25 transparent` }}
        onWheel={(e) => {
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault()
            setZoom(z => Math.max(0.4, Math.min(3, +(z + (e.deltaY > 0 ? -0.1 : 0.1)).toFixed(2))))
          }
        }}
      >
        <div style={{ width: LABEL_W + totalSteps * cellW, position: 'relative' }}>

          {/* Beat ruler (sticky top) */}
          <div className="flex sticky top-0 z-20" style={{ height: 18, background: '#2a2e34' }}>
            <div className="sticky left-0 z-30 shrink-0"
              style={{
                width: LABEL_W, height: 18, background: '#2a2e34',
                borderBottom: '1px solid rgba(255,255,255,0.04)',
                borderRight: '1px solid rgba(255,255,255,0.04)',
              }} />
            <div className="flex">
              {Array.from({ length: totalSteps }, (_, i) => {
                const beatInterval = stepsPerBar / 4
                const isBar = i % stepsPerBar === 0
                const isBeat = i % beatInterval === 0
                const barNum = Math.floor(i / stepsPerBar) + 1
                return (
                  <div key={i} className="shrink-0 flex items-end justify-start"
                    style={{
                      width: cellW, height: 18,
                      borderLeft: isBar ? '1px solid rgba(255,255,255,0.12)' : isBeat ? '1px solid rgba(255,255,255,0.06)' : 'none',
                      borderBottom: '1px solid rgba(255,255,255,0.06)',
                    }}>
                    {isBar && (
                      <span className="text-[7px] font-bold pl-1" style={{ color: `${color}60` }}>
                        {barNum}
                      </span>
                    )}
                    {isBeat && !isBar && (
                      <span className="text-[6px] pl-0.5" style={{ color: '#5a616b' }}>
                        {(i % stepsPerBar) / beatInterval + 1}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Drum rows */}
          {activeRows.map(instrumentId => {
            const drum = getDrum(instrumentId)
            const hits = grid.get(instrumentId) || new Set<number>()

            return (
              <div key={instrumentId} className="flex" style={{ height: cellH }}>
                {/* Row label (sticky left) */}
                <div
                  className="sticky left-0 z-10 shrink-0 flex items-center gap-1 px-1"
                  style={{
                    width: LABEL_W, height: cellH,
                    background: '#1c1e22',
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                    borderRight: '1px solid rgba(255,255,255,0.04)',
                  }}
                >
                  <span className="text-[9px]">{drum.icon}</span>
                  <span className="text-[7px] font-bold uppercase tracking-wide" style={{ color: drum.color }}>
                    {drum.label}
                  </span>
                  {/* Preview button */}
                  <button
                    onClick={() => playDrumPreview(instrumentId)}
                    className="ml-auto text-[7px] cursor-pointer transition-colors duration-[180ms]"
                    style={{ color: '#5a616b' }}
                    title="Preview"
                  >
                    ▶
                  </button>
                </div>

                {/* Step cells */}
                {Array.from({ length: totalSteps }, (_, step) => {
                  const hasHit = hits.has(step)
                  const beatInterval = stepsPerBar / 4
                  const isBar = step % stepsPerBar === 0
                  const isBeat = step % beatInterval === 0

                  return (
                    <div
                      key={step}
                      className="shrink-0 cursor-crosshair transition-all duration-75"
                      style={{
                        width: cellW, height: cellH,
                        background: hasHit
                          ? drum.color
                          : isBeat
                            ? 'rgba(255,255,255,0.025)'
                            : 'rgba(255,255,255,0.012)',
                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                        borderLeft: isBar
                          ? '1px solid rgba(255,255,255,0.15)'
                          : isBeat
                            ? '1px solid rgba(255,255,255,0.06)'
                            : '1px solid rgba(255,255,255,0.02)',
                        borderRadius: hasHit ? 3 : 1,
                        margin: hasHit ? '1px' : '0',
                        boxShadow: hasHit ? `inset 0 1px 0 rgba(255,255,255,0.15)` : 'none',
                        opacity: hasHit ? 1 : 0.8,
                      }}
                      onMouseDown={(e) => handleCellDown(instrumentId, step, e)}
                      onMouseEnter={() => handleCellEnter(instrumentId, step)}
                    />
                  )
                })}
              </div>
            )
          })}

          {/* Add row button */}
          {availableInstruments.length > 0 && (
            <div className="flex items-center gap-1 px-2 py-1" style={{ marginLeft: LABEL_W }}>
              <span className="text-[7px]" style={{ color: '#5a616b' }}>+ Add:</span>
              {availableInstruments.slice(0, 6).map(d => (
                <button
                  key={d.id}
                  onClick={() => { addRow(d.id); setHasUserEdited(true) }}
                  className="px-1.5 py-0.5 rounded-lg text-[7px] cursor-pointer transition-all duration-[180ms]"
                  style={{ background: '#1c1e22', border: 'none', color: `${d.color}70`, boxShadow: '2px 2px 4px #14161a, -2px -2px 4px #2c3036' }}
                  title={`Add ${d.label} row`}
                >
                  {d.icon} {d.id.toUpperCase()}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
//  BUILD CODE FROM GRID — reconstruct the channel's Strudel code
// ═══════════════════════════════════════════════════════════════

function buildCodeFromGrid(
  grid: Map<string, Set<number>>,
  activeRows: string[],
  bars: number,
  originalRawCode: string,
  originalDrumRows: DrumRow[],
  isStack: boolean,
  stepsPerBar: number = 16,
): string {
  // Filter out empty rows
  const rowsWithHits = activeRows.filter(id => {
    const hits = grid.get(id)
    return hits && hits.size > 0
  })

  if (rowsWithHits.length === 0) return originalRawCode

  // Extract the effects chain from the original code (everything after the main s()/stack())
  const effectsChain = extractEffectsChain(originalRawCode, isStack)

  // Get bank from original
  const bankMatch = originalRawCode.match(/\.bank\(\s*"([^"]*)"/)
  const bankStr = bankMatch ? `.bank("${bankMatch[1]}")` : ''

  if (rowsWithHits.length === 1 && !isStack) {
    // Single instrument → simple s("pattern") format
    const instrument = rowsWithHits[0]
    const hits = grid.get(instrument)!
    const pattern = hitsToPattern(hits, bars, instrument, stepsPerBar)

    // Reconstruct: find the $name: prefix
    const prefixMatch = originalRawCode.match(/^\s*(\$\w*:)\s*/)
    const prefix = prefixMatch ? prefixMatch[1] : '$:'
    return `${prefix} s("${pattern}")${bankStr}${effectsChain}`
  }

  // Multiple instruments → stack() format
  const stackLines: string[] = []
  for (const instrument of rowsWithHits) {
    const hits = grid.get(instrument)!
    const pattern = hitsToPattern(hits, bars, instrument, stepsPerBar)

    // Find bank for this specific instrument from original
    const origRow = originalDrumRows.find(r => r.instrument === instrument)
    const rowBank = origRow?.bank ? `.bank("${origRow.bank}")` : bankStr
    stackLines.push(`  s("${pattern}")${rowBank}`)
  }

  const prefixMatch = originalRawCode.match(/^\s*(\$\w*:)\s*/)
  const prefix = prefixMatch ? prefixMatch[1] : '$:'
  return `${prefix} stack(\n${stackLines.join(',\n')}\n)${effectsChain}`
}

/** Extract the effects chain after s()/stack() — e.g. ".duck(2).scope()" */
function extractEffectsChain(rawCode: string, isStack: boolean): string {
  if (isStack) {
    // Find closing paren of stack() then get everything after
    const stackMatch = rawCode.match(/stack\s*\(/)
    if (!stackMatch) return ''
    const openIdx = rawCode.indexOf('(', stackMatch.index!)
    const closeIdx = findStackClosingParen(rawCode, openIdx)
    if (closeIdx === -1) return ''
    const after = rawCode.substring(closeIdx + 1).trim()
    // Filter out .bank() since we handle it per-row
    return after ? after.replace(/\.bank\(\s*"[^"]*"\s*\)/g, '') : ''
  }

  // Single channel: find closing paren of s() then get everything after
  const sMatch = rawCode.match(/s\(\s*"/)
  if (!sMatch) return ''
  // Find the closing quote and paren
  const quoteStart = rawCode.indexOf('"', sMatch.index! + 2)
  const quoteEnd = rawCode.indexOf('"', quoteStart + 1)
  if (quoteEnd === -1) return ''

  // After the closing paren of s("...")
  const closeParen = rawCode.indexOf(')', quoteEnd)
  if (closeParen === -1) return ''

  const after = rawCode.substring(closeParen + 1).trim()
  // Keep effects but filter out .bank() since we re-add it
  return after ? '\n  ' + after.replace(/\.bank\(\s*"[^"]*"\s*\)/g, '') : ''
}
