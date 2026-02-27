'use client'

import { useState, useCallback, useRef, useEffect } from 'react'

// ═══════════════════════════════════════════════════════════════
//  NDE DRUM SEQUENCER — step sequencer for drum/sample nodes
//
//  Parses Strudel mini-notation  →  visual step grid  →  generates notation back
//  Pattern format:  s("bd [~ bd] ~ ~, ~ cp ~ ~, hh*8")
//    • Commas separate polyphonic sound layers (one per grid row)
//    • Spaces separate time slots within a layer
//    • [x y] subdivides a time slot
//    • *N repeats a sound N times across the cycle
//    • ~ is a rest (silence)
//
//  Architecture: Like FL Studio Channel Rack / Ableton Drum Rack
//    Rows = individual drum sounds  |  Columns = 16th-note steps
//    1 bar = 4 beats × 4 subdivisions = 16 steps (default)
//
//  ┌─────────────────────────────────────────────────────────┐
//  │  🥁 SEQUENCER   [16][32]  [▶ Presets] [Clear][🎲][✓][✕]│
//  ├──────┬─────────────────────────────────────────────┬────┤
//  │      │  1  ·  ·  ·  2  ·  ·  ·  3  ·  ·  ·  4   │    │
//  │  BD  │  ●  ○  ○  ○  ○  ○  ●  ○  ○  ○  ○  ○  ○   │    │
//  │  CP  │  ○  ○  ○  ○  ●  ○  ○  ○  ○  ○  ○  ○  ●   │    │
//  │  HH  │  ●  ○  ●  ○  ●  ○  ●  ○  ●  ○  ●  ○  ●   │    │
//  │  + Add sound                                       │    │
//  └─────────────────────────────────────────────────────┘
//            ▲ playhead (synced to Strudel scheduler)
// ═══════════════════════════════════════════════════════════════

// ── Types ──

interface DrumRow {
  sound: string
  steps: boolean[]
  muted: boolean
}

interface DrumSequencerProps {
  isOpen: boolean
  onClose: () => void
  currentPattern: string
  nodeColor: string
  onPatternChange: (pattern: string, bars: number) => void
  isPlaying?: boolean
  bpm?: number
  getCyclePosition?: () => number
  bankName?: string
  /** Number of bars this pattern spans (from .slow() detection) */
  patternBars?: number
}

// ── Palette (matches NodeEditor / PianoRoll / SoundSlicer) ──

const HW = {
  bg:          '#0a0a0c',
  surface:     '#111114',
  surfaceAlt:  '#18181b',
  raised:      '#1e1e22',
  border:      'rgba(255,255,255,0.06)',
  borderLight: 'rgba(255,255,255,0.08)',
  text:        '#888',
  textDim:     '#555',
  textBright:  '#ccc',
}

// ── Sound-specific colours (FL Studio / Ableton inspired) ──

const SOUND_COLORS: Record<string, string> = {
  bd: '#ef4444', kick: '#ef4444',
  sd: '#f59e0b', snare: '#f59e0b',
  cp: '#eab308', clap: '#eab308',
  hh: '#22d3ee', hihat: '#22d3ee',
  oh: '#3b82f6', openhat: '#3b82f6',
  ch: '#06b6d4',
  rim: '#a78bfa', rs: '#a78bfa',
  lt: '#fb923c', mt: '#f97316', ht: '#f59e0b',
  cy: '#818cf8', cr: '#818cf8', rd: '#818cf8',
  cb: '#f97316',
  sh: '#34d399', ma: '#34d399',
  cl: '#c084fc',
  perc: '#94a3b8', tb: '#fb923c', tom: '#fb923c',
}

function soundColor(sound: string): string {
  return SOUND_COLORS[sound.toLowerCase().replace(/[^a-z]/g, '')] || '#94a3b8'
}

// ── Sound picker catalogue ──

const AVAILABLE_SOUNDS = [
  { id: 'bd', label: 'Kick' },
  { id: 'sd', label: 'Snare' },
  { id: 'cp', label: 'Clap' },
  { id: 'hh', label: 'Hi-Hat' },
  { id: 'oh', label: 'Open Hat' },
  { id: 'rim', label: 'Rim' },
  { id: 'lt', label: 'Lo Tom' },
  { id: 'mt', label: 'Mid Tom' },
  { id: 'ht', label: 'Hi Tom' },
  { id: 'cy', label: 'Cymbal' },
  { id: 'cb', label: 'Cowbell' },
  { id: 'cl', label: 'Clave' },
  { id: 'sh', label: 'Shaker' },
  { id: 'ma', label: 'Maracas' },
  { id: 'cr', label: 'Crash' },
  { id: 'rd', label: 'Ride' },
]

// ── Preset patterns ──

const DRUM_PRESETS = [
  { name: 'Rock',        pattern: 'bd ~ bd ~, ~ ~ cp ~, hh*8' },
  { name: 'Pop',         pattern: 'bd ~ ~ bd ~ ~ bd ~, ~ ~ ~ ~ cp ~ ~ ~, hh*8' },
  { name: 'Hip Hop',     pattern: 'bd ~ [~ bd] ~, ~ cp ~ ~, hh*8' },
  { name: '4-on-Floor',  pattern: 'bd*4, ~ cp ~ cp, [hh hh hh oh]*4' },
  { name: 'Boom Bap',    pattern: 'bd ~ ~ ~, ~ ~ cp ~, hh*4' },
  { name: 'Trap',        pattern: 'bd ~ ~ [~ bd], ~ ~ cp ~, hh*16' },
  { name: 'Breakbeat',   pattern: '[bd ~] ~ [~ bd] ~, ~ cp ~ [~ cp], hh*4' },
  { name: 'Minimal',     pattern: 'bd ~ ~ ~, ~ ~ cp ~, [~ hh]*4' },
  { name: 'Reggaeton',   pattern: 'bd ~ ~ bd, ~ ~ cp ~, [~ hh]*8' },
  { name: 'Shuffle',     pattern: 'bd [~ bd] bd ~, ~ [~ cp] ~ ~, [hh ~ hh]*4' },
]

// ═══════════════════════════════════════════════════════════════
//  MINI-NOTATION PARSER
//
//  Parse  "bd [~ bd] ~ ~, ~ cp ~ ~, hh*8"
//    →  [ { sound:'bd', steps:[T,F,F,F, F,F,T,F, ...] },
//         { sound:'cp', steps:[F,F,F,F, T,F,F,F, ...] },
//         { sound:'hh', steps:[T,F,T,F, T,F,T,F, ...] } ]
// ═══════════════════════════════════════════════════════════════

/** Split by top-level commas (not inside brackets) → polyphonic layers */
function splitByComma(pattern: string): string[] {
  const layers: string[] = []
  let depth = 0, cur = ''
  for (const ch of pattern) {
    if (ch === '[' || ch === '<' || ch === '{') depth++
    else if (ch === ']' || ch === '>' || ch === '}') depth--
    if (ch === ',' && depth === 0) {
      if (cur.trim()) layers.push(cur.trim())
      cur = ''
    } else {
      cur += ch
    }
  }
  if (cur.trim()) layers.push(cur.trim())
  return layers
}

/** Split by whitespace at the top level (brackets stay grouped) */
function splitTopLevel(token: string): string[] {
  const out: string[] = []
  let depth = 0, cur = ''
  for (const ch of token) {
    if (ch === '[' || ch === '<' || ch === '{') { depth++; cur += ch }
    else if (ch === ']' || ch === '>' || ch === '}') { depth--; cur += ch }
    else if (/\s/.test(ch) && depth === 0) {
      if (cur.trim()) out.push(cur.trim())
      cur = ''
    } else { cur += ch }
  }
  if (cur.trim()) out.push(cur.trim())
  return out
}

/** Find the first non-rest token in a layer → the drum sound name */
function extractSoundName(layer: string): string {
  const stripped = layer.replace(/[\[\]<>{}]/g, ' ').replace(/\*\d+/g, '')
  const tokens = stripped.split(/\s+/).filter(Boolean)
  for (const t of tokens) {
    if (t !== '~' && !/^-+$/.test(t)) return t
  }
  return 'bd'
}

/** Check if a token represents silence (rest) — supports ~ and - variants */
function isRest(token: string): boolean {
  return token === '~' || /^-+$/.test(token)
}

/**
 * Recursively expand a mini-notation token into `numSteps` boolean slots.
 * Each true = a hit at that 16th-note position.
 */
function expandToSteps(token: string, numSteps: number): boolean[] {
  token = token.trim()
  if (!token || isRest(token)) return new Array(numSteps).fill(false)

  // ── *N repetition (e.g. "hh*8", "[bd ~]*4") ──
  const repeatMatch = token.match(/^(.+)\*(\d+)$/)
  if (repeatMatch) {
    const base = repeatMatch[1].trim()
    const n = parseInt(repeatMatch[2])
    // Simple sound → place n evenly-spaced hits
    if (!base.includes(' ') && !base.startsWith('[') && !base.startsWith('<')) {
      const result = new Array(numSteps).fill(false)
      for (let i = 0; i < n; i++) {
        const pos = Math.round(i * numSteps / n)
        if (pos < numSteps) result[pos] = true
      }
      return result
    }
    // Complex group → repeat the sub-pattern n times
    const result = new Array(numSteps).fill(false)
    const per = numSteps / n
    for (let i = 0; i < n; i++) {
      const s = Math.round(i * per), e = Math.round((i + 1) * per)
      const sub = expandToSteps(base, e - s)
      for (let j = 0; j < sub.length && (s + j) < numSteps; j++) result[s + j] = sub[j]
    }
    return result
  }

  // ── Strip outer brackets and recurse ──
  if (token.startsWith('[') && token.endsWith(']'))
    return expandToSteps(token.slice(1, -1), numSteps)

  // ── Angle brackets (alternation) → use first element ──
  if (token.startsWith('<') && token.endsWith('>')) {
    const els = splitTopLevel(token.slice(1, -1))
    return els.length ? expandToSteps(els[0], numSteps) : new Array(numSteps).fill(false)
  }

  // ── Multiple space-separated elements → divide time equally ──
  const elements = splitTopLevel(token)
  if (elements.length <= 1) {
    if (isRest(elements[0])) return new Array(numSteps).fill(false)
    // Check for nested *N
    if (elements[0]?.includes('*')) return expandToSteps(elements[0], numSteps)
    // Hit on first step
    const result = new Array(numSteps).fill(false)
    if (numSteps > 0) result[0] = true
    return result
  }

  const result = new Array(numSteps).fill(false)
  for (let i = 0; i < elements.length; i++) {
    const s = Math.round(i * numSteps / elements.length)
    const e = Math.round((i + 1) * numSteps / elements.length)
    if (e - s > 0) {
      const sub = expandToSteps(elements[i], e - s)
      for (let j = 0; j < sub.length && (s + j) < numSteps; j++) result[s + j] = sub[j]
    }
  }
  return result
}

/** Parse a full drum pattern string → array of DrumRows */
function parsePattern(pattern: string, numSteps: number): DrumRow[] {
  if (!pattern?.trim()) return []
  return splitByComma(pattern).map(layer => ({
    sound: extractSoundName(layer),
    steps: expandToSteps(layer, numSteps),
    muted: false,
  }))
}

// ═══════════════════════════════════════════════════════════════
//  MINI-NOTATION GENERATOR
//
//  Grid  →  "bd [~ ~ bd ~] ~ ~, ~ cp ~ ~, hh*8"
//
//  Simplifications applied:
//    • Even spacing → sound*N   (e.g. hh every 2nd step → hh*8)
//    • All 4 subdivisions off  → ~
//    • Only first subdivision  → sound  (no brackets needed)
//    • Otherwise              → [sound/~ sound/~ sound/~ sound/~]
// ═══════════════════════════════════════════════════════════════

function generateMiniNotation(rows: DrumRow[]): string {
  const active = rows.filter(r => !r.muted && r.steps.some(Boolean))
  if (active.length === 0) return '~ ~ ~ ~'

  return active.map(row => {
    const { sound, steps } = row
    const N = steps.length
    const beatsPerBar = 4
    const spb = N / beatsPerBar  // steps per beat

    // Gather hit positions
    const on: number[] = []
    steps.forEach((v, i) => { if (v) on.push(i) })
    if (on.length === 0) return null

    // Shorthand: evenly-spaced hits → sound*N
    if (on.length >= 2) {
      const spacing = N / on.length
      const roundSp = Math.round(spacing)
      if (Math.abs(spacing - roundSp) < 0.01 && on.every((s, i) => s === i * roundSp)) {
        return `${sound}*${on.length}`
      }
    }
    // Single hit: check for shorthand
    if (on.length === 1 && on[0] === 0) {
      const rest = Array(beatsPerBar - 1).fill('~').join(' ')
      return `${sound} ${rest}`
    }

    // General: group into beats, each beat = [s/~ s/~ s/~ s/~]
    const beats: string[] = []
    for (let b = 0; b < beatsPerBar; b++) {
      const bs = steps.slice(b * spb, (b + 1) * spb)
      if (bs.every(x => !x)) {
        beats.push('~')
      } else if (bs[0] && bs.slice(1).every(x => !x)) {
        beats.push(sound)   // only first sub is on → clean shorthand
      } else {
        beats.push(`[${bs.map(x => x ? sound : '~').join(' ')}]`)
      }
    }
    return beats.join(' ')
  }).filter(Boolean).join(', ')
}

// ═══════════════════════════════════════════════════════════════
//  LAYOUT CONSTANTS
// ═══════════════════════════════════════════════════════════════

const DOCK_HEIGHT = 300
const STEP_W = 28
const STEP_H = 28
const LABEL_W = 60
const TOOLBAR_H = 32
const HEADER_H = 20
const BEATS_PER_BAR = 4

// ═══════════════════════════════════════════════════════════════
//  COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function DrumSequencer({
  isOpen,
  onClose,
  currentPattern,
  nodeColor,
  onPatternChange,
  isPlaying = false,
  bpm = 120,
  getCyclePosition,
  bankName,
  patternBars = 1,
}: DrumSequencerProps) {

  const [rows, setRows] = useState<DrumRow[]>([])
  const [numSteps, setNumSteps] = useState(16)
  const [playheadStep, setPlayheadStep] = useState(0)
  const [addPickerOpen, setAddPickerOpen] = useState(false)
  const [presetOpen, setPresetOpen] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const autoApplyTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const initialLoadRef = useRef(true)

  const stepsPerBeat = numSteps / BEATS_PER_BAR

  // ── Parse pattern on open ──
  useEffect(() => {
    if (!isOpen) return
    initialLoadRef.current = true // reset on re-open
    // Initialize step count from pattern bars (1 bar = 16 steps, 2 bars = 32 steps)
    const initSteps = patternBars > 1 ? Math.min(patternBars * 16, 32) : 16
    setNumSteps(initSteps)
    const parsed = parsePattern(currentPattern, initSteps)
    if (parsed.length > 0) {
      setRows(parsed)
    } else {
      // Empty pattern → seed with default empty rows
      setRows([
        { sound: 'bd', steps: new Array(initSteps).fill(false), muted: false },
        { sound: 'cp', steps: new Array(initSteps).fill(false), muted: false },
        { sound: 'hh', steps: new Array(initSteps).fill(false), muted: false },
      ])
    }
    setPresetOpen(false)
    setAddPickerOpen(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  // How many bars the current step count represents
  const barCount = numSteps / 16
  // Steps per Strudel cycle: if pattern uses .slow(2) → 1 cycle = 16 steps over 2 bars
  // But scheduler reports fractional cycles, so 1 cycle always = 16 grid positions at base rate
  const stepsPerCycle = 16 // Strudel's 1 cycle = 1 bar = 16 sixteenth notes

  // ── Playhead — synced to Strudel scheduler clock ──
  useEffect(() => {
    if (!isPlaying || !isOpen) { setPlayheadStep(0); return }
    let raf: number
    if (getCyclePosition) {
      const tick = () => {
        const cycle = getCyclePosition()
        // For multi-bar patterns (.slow(N)), the scheduler still counts in cycles.
        // barCount bars = barCount cycles worth of steps.
        // At 32 steps / 2 bars: position = (cycle * 16) % 32 → wraps correctly.
        setPlayheadStep((cycle * stepsPerCycle) % numSteps)
        raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)
    } else {
      // Fallback: independent clock
      const cps = bpm > 0 ? bpm / 60 / 4 : 0.5
      const msPerStep = 1000 / (cps * stepsPerCycle)
      const t0 = performance.now()
      const tick = () => {
        setPlayheadStep(((performance.now() - t0) / msPerStep) % numSteps)
        raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)
    }
    return () => cancelAnimationFrame(raf)
  }, [isPlaying, bpm, numSteps, isOpen, getCyclePosition, stepsPerCycle])

  // ── Toggle step cell ──
  const toggleStep = useCallback((ri: number, si: number) => {
    setRows(p => p.map((r, i) =>
      i !== ri ? r : { ...r, steps: r.steps.map((v, j) => j === si ? !v : v) }
    ))
  }, [])

  // ── Row mute ──
  const toggleRowMute = useCallback((ri: number) => {
    setRows(p => p.map((r, i) => i === ri ? { ...r, muted: !r.muted } : r))
  }, [])

  // ── Remove row ──
  const removeRow = useCallback((ri: number) => {
    setRows(p => p.filter((_, i) => i !== ri))
  }, [])

  // ── Add row ──
  const addRow = useCallback((sound: string) => {
    setRows(p => [...p, { sound, steps: new Array(numSteps).fill(false), muted: false }])
    setAddPickerOpen(false)
  }, [numSteps])

  // ── Clear all steps ──
  const clearAll = useCallback(() => {
    setRows(p => p.map(r => ({ ...r, steps: new Array(r.steps.length).fill(false) })))
  }, [])

  // ── Randomize with musical density per sound type ──
  const randomize = useCallback(() => {
    setRows(p => p.map(row => {
      const s = row.sound.toLowerCase()
      return {
        ...row,
        steps: row.steps.map((_, i) => {
          // Kick: tend to land on strong beats
          if (s === 'bd' || s === 'kick') return i % 4 === 0 ? Math.random() < 0.7 : Math.random() < 0.12
          // Snare/clap: beats 2 & 4
          if (s === 'cp' || s === 'sd' || s === 'snare' || s === 'clap') return i % 8 === 4 ? Math.random() < 0.85 : Math.random() < 0.06
          // Hi-hat: high density
          if (s === 'hh' || s === 'ch') return Math.random() < 0.5
          // Open hat: sparse
          if (s === 'oh') return Math.random() < 0.1
          // Everything else: medium-sparse
          return Math.random() < 0.18
        }),
      }
    }))
  }, [])

  // ── Load preset pattern ──
  const loadPreset = useCallback((pattern: string) => {
    setRows(parsePattern(pattern, numSteps))
    setPresetOpen(false)
  }, [numSteps])

  // ── Apply grid → mini-notation → parent ──
  const applyPattern = useCallback(() => {
    const bars = numSteps / 16
    onPatternChange(generateMiniNotation(rows), bars)
  }, [rows, numSteps, onPatternChange])

  // ── Change step count (preserve existing steps) ──
  const changeStepCount = useCallback((n: number) => {
    setRows(p => p.map(r => ({
      ...r,
      steps: n > r.steps.length
        ? [...r.steps, ...new Array(n - r.steps.length).fill(false)]
        : r.steps.slice(0, n),
    })))
    setNumSteps(n)
  }, [])

  // ── Phase 2: Auto-apply on every row/step change (debounced 150ms) ──
  useEffect(() => {
    if (!isOpen) return
    if (initialLoadRef.current) { initialLoadRef.current = false; return }
    if (autoApplyTimer.current) clearTimeout(autoApplyTimer.current)
    autoApplyTimer.current = setTimeout(() => { applyPattern() }, 150)
    return () => { if (autoApplyTimer.current) clearTimeout(autoApplyTimer.current) }
  }, [rows, isOpen]) // intentionally omit applyPattern to avoid stale closure loops

  // ── Keyboard shortcuts ──
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose() }
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); applyPattern() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, onClose, applyPattern])

  const currentStepInt = Math.floor(playheadStep) % numSteps

  if (!isOpen) return null

  // ═══════════════════════════════════════════════════════════
  //  RENDER — docked at bottom of canvas (matches PianoRoll)
  // ═══════════════════════════════════════════════════════════

  return (
    <div
      className="absolute bottom-0 left-0 right-0 z-[100] flex flex-col select-none"
      style={{
        height: DOCK_HEIGHT,
        background: HW.bg,
        borderTop: `2px solid ${nodeColor}50`,
        boxShadow: `0 -8px 40px rgba(0,0,0,0.7), inset 0 1px 0 ${nodeColor}15`,
      }}
      onClick={e => e.stopPropagation()}
    >

      {/* ═══ TOOLBAR ═══ */}
      <div className="flex items-center justify-between px-2 shrink-0"
        style={{ height: TOOLBAR_H, borderBottom: `1px solid ${HW.border}`, background: HW.surface }}>

        {/* Left group */}
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] font-bold tracking-wide" style={{ color: nodeColor }}>🥁 SEQUENCER</span>

          {bankName && (
            <span className="text-[7px] px-1.5 py-0.5 rounded" style={{ color: HW.textDim, background: HW.raised }}>
              {bankName}
            </span>
          )}

          <div className="w-px h-3.5" style={{ background: HW.border }} />

          {/* Step count */}
          <span className="text-[7px]" style={{ color: HW.textDim }}>STEPS</span>
          {[16, 32].map(n => (
            <button key={n} onClick={() => changeStepCount(n)}
              className="px-1 py-0.5 rounded text-[7px] font-bold cursor-pointer"
              style={{
                background: numSteps === n ? `${nodeColor}15` : 'transparent',
                color: numSteps === n ? nodeColor : HW.textDim,
                border: `1px solid ${numSteps === n ? `${nodeColor}25` : 'transparent'}`,
              }}>
              {n}
            </button>
          ))}

          <div className="w-px h-3.5" style={{ background: HW.border }} />

          {/* Presets dropdown */}
          <div className="relative">
            <button onClick={() => { setPresetOpen(p => !p); setAddPickerOpen(false) }}
              className="px-1.5 py-0.5 rounded text-[8px] font-bold cursor-pointer"
              style={{
                color: presetOpen ? '#f59e0b' : HW.text,
                background: presetOpen ? 'rgba(245,158,11,0.1)' : 'transparent',
                border: `1px solid ${presetOpen ? 'rgba(245,158,11,0.25)' : 'transparent'}`,
              }}>
              {presetOpen ? '◀' : '▶'} Presets
            </button>

            {presetOpen && (
              <div className="absolute top-full left-0 mt-1 w-40 rounded-lg overflow-hidden z-50"
                style={{ background: HW.raised, border: `1px solid ${HW.borderLight}`, boxShadow: '0 8px 24px rgba(0,0,0,0.6)' }}>
                {DRUM_PRESETS.map(p => (
                  <button key={p.name} onClick={() => loadPreset(p.pattern)}
                    className="w-full text-left px-3 py-1.5 text-[9px] cursor-pointer transition-colors"
                    style={{ color: HW.textBright, borderBottom: `1px solid ${HW.border}` }}
                    onMouseEnter={e => { (e.target as HTMLElement).style.background = 'rgba(255,255,255,0.04)' }}
                    onMouseLeave={e => { (e.target as HTMLElement).style.background = 'transparent' }}>
                    {p.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right group */}
        <div className="flex items-center gap-1">
          <span className="text-[7px] px-1 py-0.5 rounded" style={{ color: HW.textDim, background: HW.raised }}>
            {rows.reduce((sum, r) => sum + (r.muted ? 0 : r.steps.filter(Boolean).length), 0)} hits
          </span>

          <button onClick={clearAll}
            className="px-1.5 py-0.5 rounded text-[7px] cursor-pointer"
            style={{ color: HW.textDim, background: HW.raised, border: `1px solid ${HW.border}` }}>
            Clear
          </button>
          <button onClick={randomize}
            className="px-1.5 py-0.5 rounded text-[7px] cursor-pointer"
            title="Randomize"
            style={{ color: HW.textDim, background: HW.raised, border: `1px solid ${HW.border}` }}>
            🎲
          </button>
          <span className="px-1.5 py-0.5 rounded text-[7px] font-bold tracking-wider"
            style={{ color: '#22c55e', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.15)' }}>
            ● LIVE
          </span>
          <button onClick={onClose}
            className="px-1.5 py-0.5 rounded text-[8px] cursor-pointer"
            title="Close (Esc)"
            style={{ color: HW.textDim, background: HW.raised, border: `1px solid ${HW.border}` }}>
            ✕
          </button>
        </div>
      </div>

      {/* ═══ GRID AREA ═══ */}
      <div className="flex-1 overflow-auto relative" ref={scrollRef}>

        {/* Step-number header (sticky) */}
        <div className="flex sticky top-0 z-10" style={{ background: HW.bg }}>
          <div className="shrink-0" style={{ width: LABEL_W, minWidth: LABEL_W }} />
          <div className="flex">
            {Array.from({ length: numSteps }, (_, i) => {
              const isBeatStart = i % stepsPerBeat === 0
              return (
                <div key={i} className="flex items-center justify-center text-[7px] font-mono"
                  style={{
                    width: STEP_W, height: HEADER_H,
                    color: isBeatStart ? HW.text : HW.textDim,
                    borderRight: (i + 1) % stepsPerBeat === 0
                      ? `2px solid ${HW.borderLight}` : `1px solid ${HW.border}`,
                    background: currentStepInt === i && isPlaying ? `${nodeColor}08` : 'transparent',
                  }}>
                  {isBeatStart ? Math.floor(i / stepsPerBeat) + 1 : '·'}
                </div>
              )
            })}
          </div>
        </div>

        {/* Sound rows */}
        {rows.map((row, ri) => {
          const color = soundColor(row.sound)
          return (
            <div key={`${row.sound}-${ri}`} className="flex group" style={{
              opacity: row.muted ? 0.3 : 1,
              borderBottom: `1px solid ${HW.border}`,
            }}>
              {/* Sound label + controls */}
              <div className="shrink-0 flex items-center gap-1 px-1.5"
                style={{ width: LABEL_W, minWidth: LABEL_W, height: STEP_H, background: HW.surfaceAlt }}>
                <div className="w-2 h-2 rounded-sm shrink-0" style={{ background: color }} />
                <span className="text-[9px] font-bold uppercase truncate flex-1" style={{ color }}>
                  {row.sound}
                </span>
                <button onClick={() => toggleRowMute(ri)}
                  className="opacity-0 group-hover:opacity-100 w-3.5 h-3.5 flex items-center justify-center rounded text-[7px] font-bold cursor-pointer transition-opacity"
                  style={{ color: row.muted ? '#ef4444' : HW.textDim, background: row.muted ? 'rgba(239,68,68,0.15)' : 'transparent' }}
                  title={row.muted ? 'Unmute' : 'Mute'}>
                  M
                </button>
                <button onClick={() => removeRow(ri)}
                  className="opacity-0 group-hover:opacity-100 w-3.5 h-3.5 flex items-center justify-center rounded text-[7px] cursor-pointer transition-opacity"
                  style={{ color: '#ef4444' }}
                  title="Remove row">
                  ×
                </button>
              </div>

              {/* Step cells */}
              <div className="flex">
                {row.steps.map((on, si) => {
                  const isCurrentStep = currentStepInt === si && isPlaying
                  // Alternate shading per beat pair for visual grouping
                  const beatGroup = Math.floor(si / stepsPerBeat)
                  const altBeat = beatGroup % 2 === 0
                  return (
                    <button
                      key={si}
                      onClick={() => toggleStep(ri, si)}
                      className="cursor-pointer transition-colors duration-75 shrink-0"
                      style={{
                        width: STEP_W,
                        height: STEP_H,
                        background: on
                          ? (isCurrentStep ? color : `${color}88`)
                          : (isCurrentStep ? `${nodeColor}10` : (altBeat ? HW.raised : HW.surfaceAlt)),
                        border: `1px solid ${on ? `${color}35` : HW.border}`,
                        borderRight: (si + 1) % stepsPerBeat === 0
                          ? `2px solid ${HW.borderLight}` : undefined,
                        boxShadow: on ? `inset 0 0 10px ${color}30` : 'none',
                        borderRadius: 2,
                      }}
                    />
                  )
                })}
              </div>
            </div>
          )
        })}

        {/* Add sound row */}
        <div className="relative" style={{ borderBottom: `1px solid ${HW.border}` }}>
          <button onClick={() => { setAddPickerOpen(p => !p); setPresetOpen(false) }}
            className="flex items-center gap-1.5 px-3 w-full text-[9px] cursor-pointer"
            style={{ color: HW.textDim, height: 30 }}
            onMouseEnter={e => { (e.target as HTMLElement).style.background = HW.raised }}
            onMouseLeave={e => { (e.target as HTMLElement).style.background = 'transparent' }}>
            <span style={{ color: nodeColor, fontSize: 11 }}>+</span> Add sound
          </button>

          {addPickerOpen && (
            <div className="flex flex-wrap gap-1 px-3 py-2" style={{ background: HW.raised }}>
              {AVAILABLE_SOUNDS
                .filter(s => !rows.some(r => r.sound === s.id))
                .map(s => (
                  <button key={s.id} onClick={() => addRow(s.id)}
                    className="flex items-center gap-1 px-2 py-1 rounded text-[8px] font-medium cursor-pointer"
                    style={{
                      background: `${soundColor(s.id)}12`,
                      color: soundColor(s.id),
                      border: `1px solid ${soundColor(s.id)}20`,
                    }}
                    onMouseEnter={e => { (e.target as HTMLElement).style.borderColor = soundColor(s.id) }}
                    onMouseLeave={e => { (e.target as HTMLElement).style.borderColor = `${soundColor(s.id)}20` }}>
                    {s.label}
                  </button>
                ))}
              {/* All sounds already added */}
              {AVAILABLE_SOUNDS.filter(s => !rows.some(r => r.sound === s.id)).length === 0 && (
                <span className="text-[8px] py-1" style={{ color: HW.textDim }}>All sounds added</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ═══ PLAYHEAD LINE ═══ */}
      {isPlaying && (
        <div className="absolute pointer-events-none"
          style={{
            left: LABEL_W + playheadStep * STEP_W,
            top: TOOLBAR_H + HEADER_H,
            bottom: 0,
            width: 2,
            background: nodeColor,
            opacity: 0.6,
            boxShadow: `0 0 6px ${nodeColor}60`,
            zIndex: 20,
          }}
        />
      )}
    </div>
  )
}
