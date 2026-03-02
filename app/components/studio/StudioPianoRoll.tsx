'use client'

// ═══════════════════════════════════════════════════════════════
//  STUDIO PIANO ROLL — Strudel-native note editor
//
//  Designed for the Studio workflow:
//  • Scale-degree mode: outputs numbers for n().scale("root:mode")
//  • 16 steps = 1 Strudel cycle (bar). Supports 1/2/4 bars.
//  • Only writes to code on user interaction (never on mount)
//  • Click to place/remove notes, hear preview
//  • Auto-detects scale from code, highlights in-scale rows
//  • Outputs clean mini-notation that maps 1:1 to Strudel timing
// ═══════════════════════════════════════════════════════════════

import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import type { ParsedChannel } from '@/lib/strudel-code-parser'
import { getParamDef, getArpInfo, getTranspose, ARP_MODES, DRAGGABLE_EFFECTS } from '@/lib/strudel-code-parser'
import StudioKnob from './StudioKnob'

// ─── Music theory ───

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

const SCALE_INTERVALS: Record<string, number[]> = {
  major:            [0, 2, 4, 5, 7, 9, 11],
  minor:            [0, 2, 3, 5, 7, 8, 10],
  'harmonic minor': [0, 2, 3, 5, 7, 8, 11],
  dorian:           [0, 2, 3, 5, 7, 9, 10],
  phrygian:         [0, 1, 3, 5, 7, 8, 10],
  lydian:           [0, 2, 4, 6, 7, 9, 11],
  mixolydian:       [0, 2, 4, 5, 7, 9, 10],
  'minor pentatonic': [0, 3, 5, 7, 10],
  'major pentatonic': [0, 2, 4, 7, 9],
  blues:            [0, 3, 5, 6, 7, 10],
  chromatic:        [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
}

function parseScaleStr(s: string): { root: string; octave: number; mode: string } {
  const m = s.match(/^([A-Ga-g]#?)(\d+):(.+)$/)
  if (!m) return { root: 'C', octave: 4, mode: 'minor' }
  return { root: m[1].toUpperCase(), octave: parseInt(m[2]), mode: m[3] }
}

/** Build the set of MIDI notes that belong to the scale */
function getScaleMidiSet(scale: string, lo: number, hi: number): Set<number> {
  const { root, mode } = parseScaleStr(scale)
  const intervals = SCALE_INTERVALS[mode] || SCALE_INTERVALS.minor
  const rootIdx = NOTE_NAMES.indexOf(root)
  if (rootIdx < 0) return new Set()
  const set = new Set<number>()
  for (let oct = Math.floor(lo / 12) - 1; oct <= Math.ceil(hi / 12) + 1; oct++) {
    for (const iv of intervals) {
      const midi = (oct + 1) * 12 + rootIdx + iv
      if (midi >= lo && midi <= hi) set.add(midi)
    }
  }
  return set
}

/** Convert scale degree → MIDI (matches Strudel n().scale() behaviour) */
function degreeToMidi(deg: number, scale: string): number {
  const { root, octave, mode } = parseScaleStr(scale)
  const intervals = SCALE_INTERVALS[mode] || SCALE_INTERVALS.minor
  const rootIdx = NOTE_NAMES.indexOf(root)
  const baseMidi = (octave + 1) * 12 + rootIdx
  const len = intervals.length
  const octShift = deg >= 0
    ? Math.floor(deg / len)
    : Math.ceil(deg / len) - (deg % len === 0 ? 0 : 1)
  const inScale = ((deg % len) + len) % len
  return baseMidi + octShift * 12 + (intervals[inScale] ?? 0)
}

/** Convert MIDI → closest scale degree */
function midiToDegree(midi: number, scale: string): number | null {
  const { root, octave, mode } = parseScaleStr(scale)
  const intervals = SCALE_INTERVALS[mode] || SCALE_INTERVALS.minor
  const rootIdx = NOTE_NAMES.indexOf(root)
  const baseMidi = (octave + 1) * 12 + rootIdx
  const offset = midi - baseMidi
  const octShift = Math.floor(offset / 12)
  const semitone = ((offset % 12) + 12) % 12
  const degIdx = intervals.indexOf(semitone)
  if (degIdx === -1) return null
  return octShift * intervals.length + degIdx
}

function midiNoteName(midi: number): string {
  return NOTE_NAMES[midi % 12] + (Math.floor(midi / 12) - 1)
}

function isBlackKey(midi: number): boolean {
  return [1, 3, 6, 8, 10].includes(midi % 12)
}

// ─── Note name conversions (for note() mode) ───

const STRUDEL_NOTE_MAP: Record<string, number> = {
  'c': 0, 'cs': 1, 'db': 1, 'd': 2, 'ds': 3, 'eb': 3,
  'e': 4, 'fb': 4, 'f': 5, 'es': 5, 'fs': 6, 'gb': 6,
  'g': 7, 'gs': 8, 'ab': 8, 'a': 9, 'as': 10, 'bb': 10,
  'b': 11, 'cb': 11, 'bs': 0,
}

const STRUDEL_NOTE_NAMES_OUT = ['c', 'cs', 'd', 'ds', 'e', 'f', 'fs', 'g', 'gs', 'a', 'as', 'b']

/** Parse Strudel note name (e.g. "d3", "fs4", "eb2") → MIDI number */
function strudelNoteToMidi(name: string): number | null {
  const m = name.trim().toLowerCase().match(/^([a-g])([#sb]?)(\d+)$/)
  if (!m) return null
  let accidental = m[2]
  if (accidental === '#') accidental = 's'
  const key = m[1] + (accidental === 's' || accidental === 'b' ? accidental : '')
  const semitone = STRUDEL_NOTE_MAP[key]
  if (semitone === undefined) return null
  return (parseInt(m[3]) + 1) * 12 + semitone
}

/** MIDI number → Strudel lowercase note name (e.g. 50 → "d3") */
function midiToStrudelNote(midi: number): string {
  return STRUDEL_NOTE_NAMES_OUT[midi % 12] + (Math.floor(midi / 12) - 1)
}

// ─── Audio preview ───

let previewCtx: AudioContext | null = null

function playPreview(midi: number, source: string) {
  if (!previewCtx) previewCtx = new AudioContext()
  if (previewCtx.state === 'suspended') previewCtx.resume()
  const osc = previewCtx.createOscillator()
  const gain = previewCtx.createGain()
  // Map Strudel source names to oscillator types
  const type: OscillatorType =
    source === 'sawtooth' || source === 'supersaw' ? 'sawtooth'
    : source === 'square' ? 'square'
    : source === 'sine' ? 'sine'
    : source === 'triangle' ? 'triangle'
    : source.startsWith('gm_') ? 'triangle' // GM instruments → softer triangle
    : 'triangle'
  osc.type = type
  osc.frequency.value = 440 * Math.pow(2, (midi - 69) / 12)
  const now = previewCtx.currentTime
  gain.gain.setValueAtTime(0, now)
  gain.gain.linearRampToValueAtTime(0.12, now + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25)
  osc.connect(gain).connect(previewCtx.destination)
  osc.start()
  osc.stop(now + 0.3)
}

// ─── Pattern parsing ───

/** Parse a single token into notes on the grid (handles chords, rests, sub-groups, numbers/names) */
function parseToken(tok: string, step: number, scale: string, notes: Map<string, NoteData>, mode: 'degree' | 'note' = 'degree', defaultLength: number = 1) {
  // Rest: ~, ~~, -, etc.
  if (/^[~\-]+$/.test(tok)) return

  // Strip @length sustain — if no @ present, use the calculated span (defaultLength)
  const parseSustain = (s: string): { clean: string; length: number } => {
    const m = s.match(/^(.+?)@(\d+)$/)
    if (m) return { clean: m[1], length: parseInt(m[2]) }
    return { clean: s, length: defaultLength }
  }

  // Sub-group: [~ c2] or [a3 ~ b3 ~] — brackets with spaces, NOT commas (those are chords)
  // Recursively subdivide this token's span among sub-tokens
  if (tok.startsWith('[') && tok.endsWith(']') && !tok.includes(',')) {
    const inner = tok.slice(1, -1).trim()
    const subTokens = tokenizePattern(inner)
    if (subTokens.length > 0) {
      const subWeights = subTokens.map(tokenWeight)
      const subTotal = subWeights.reduce((a, b) => a + b, 0)
      let subCum = 0
      subTokens.forEach((subTok, si) => {
        const subStep = subTotal > 0
          ? step + Math.round(subCum * defaultLength / subTotal)
          : step + si
        const subSpan = subTotal > 0
          ? Math.max(1, Math.round(subWeights[si] * defaultLength / subTotal))
          : 1
        parseToken(subTok, subStep, scale, notes, mode, subSpan)
        subCum += subWeights[si]
      })
    }
    return
  }

  // Chord: [d3,f3,a3,c4] or [2,5] or [1,3,5]
  if (tok.startsWith('[') && tok.includes(',')) {
    const inner = tok.replace(/^\[|\]$/g, '')
    for (const part of inner.split(',')) {
      const { clean: trimmed, length } = parseSustain(part.trim())
      if (mode === 'note') {
        const midi = strudelNoteToMidi(trimmed)
        if (midi !== null) notes.set(`${midi}:${step}`, { length })
      } else {
        const num = parseInt(trimmed, 10)
        if (!isNaN(num)) {
          const midi = degreeToMidi(num, scale)
          notes.set(`${midi}:${step}`, { length })
        }
      }
    }
    return
  }

  const { clean: cleanTok, length } = parseSustain(tok)

  if (mode === 'note') {
    // Note name: d3, fs4, eb2, etc.
    const midi = strudelNoteToMidi(cleanTok)
    if (midi !== null) notes.set(`${midi}:${step}`, { length })
  } else {
    // Single scale degree
    const num = parseInt(cleanTok, 10)
    if (!isNaN(num)) {
      const midi = degreeToMidi(num, scale)
      notes.set(`${midi}:${step}`, { length })
    }
  }
}

/** Tokenize a pattern string respecting brackets (so [2,5] stays as one token) */
function tokenizePattern(str: string): string[] {
  const tokens: string[] = []
  let depth = 0, current = ''
  for (const ch of str) {
    if (ch === '[' || ch === '<') { depth++; current += ch }
    else if (ch === ']' || ch === '>') { depth--; current += ch }
    else if (ch === ' ' && depth === 0) {
      if (current.trim()) tokens.push(current.trim())
      current = ''
    } else current += ch
  }
  if (current.trim()) tokens.push(current.trim())
  return tokens
}

/** Strip trailing Strudel speed modifiers like *2, /4, *1.5 */
function stripSpeedMod(p: string): { clean: string; speedMod: string } {
  // Match >*2, >/4, >*1.5 at end of angle-bracket patterns
  const m = p.match(/^(<[\s\S]*>)([*/]\d+(?:\.\d+)?)$/)
  if (m) return { clean: m[1], speedMod: m[2] }
  // Also match standalone *2, /4 at end (non angle-bracket)
  const m2 = p.match(/^([\s\S]+?)([*/]\d+(?:\.\d+)?)$/)
  if (m2 && !m2[1].endsWith('>')) return { clean: m2[1], speedMod: m2[2] }
  return { clean: p, speedMod: '' }
}

/** Get the @-weight of a token ("c3@4" → 4, "~" → 1) */
function tokenWeight(tok: string): number {
  const m = tok.trim().match(/@(\d+)(?:\])?$/)
  return m ? parseInt(m[1]) : 1
}

/** Map tokens to step positions using cumulative weight (respects @N sustain) */
function mapTokensToSteps(
  tokens: string[],
  barOffset: number,
  scale: string,
  notes: Map<string, NoteData>,
  mode: 'degree' | 'note',
  stepsPerBar: number = 16,
) {
  const weights = tokens.map(tokenWeight)
  const totalWeight = weights.reduce((a, b) => a + b, 0)
  let cumWeight = 0
  tokens.forEach((tok, i) => {
    const step = totalWeight > 0
      ? barOffset + Math.round(cumWeight * stepsPerBar / totalWeight)
      : barOffset + i
    // Calculate how many grid steps this token actually spans
    const span = totalWeight > 0
      ? Math.max(1, Math.round(weights[i] * stepsPerBar / totalWeight))
      : 1
    parseToken(tok, step, scale, notes, mode, span)
    cumWeight += weights[i]
  })
}

/** Parse a Strudel mini-notation pattern into grid positions */
function parsePattern(
  pattern: string,
  scale: string,
  mode: 'degree' | 'note' = 'degree',
  stepsPerBar: number = 16,
): { notes: Map<string, NoteData>; bars: number; speedMod: string } {
  const notes = new Map<string, NoteData>()
  if (!pattern || !pattern.trim()) return { notes, bars: 1, speedMod: '' }

  const { clean: stripped, speedMod } = stripSpeedMod(pattern.trim())
  const trimmed = stripped.trim()
  const isMultiBar = trimmed.startsWith('<') && trimmed.endsWith('>')

  if (isMultiBar) {
    // <[bar1] [bar2] ...> or <entry1 entry2 ...>
    const inner = trimmed.slice(1, -1).trim()
    const entries = splitTopLevel(inner)
    entries.forEach((entry, barIdx) => {
      const barOffset = barIdx * stepsPerBar
      // Unwrap structural grouping brackets [0 ~ ~ ~] → inner,
      // but keep chord brackets [d3,f3,a3,c4] intact (they contain commas, not spaces)
      const isChord = entry.startsWith('[') && entry.endsWith(']') && entry.includes(',')
      const isGrouping = entry.startsWith('[') && entry.endsWith(']') && !isChord
      const clean = isGrouping ? entry.slice(1, -1).trim() : entry
      const tokens = tokenizePattern(clean)
      mapTokensToSteps(tokens, barOffset, scale, notes, mode, stepsPerBar)
    })
    return { notes, bars: entries.length, speedMod }
  }

  // Single bar: "0 ~ [2,5] ~ 3 ~ ~ ~" or "d3 ~ f3 ~ g3 ~ ~ ~"
  const tokens = tokenizePattern(trimmed)
  mapTokensToSteps(tokens, 0, scale, notes, mode, stepsPerBar)
  return { notes, bars: 1, speedMod }
}

/** Split top-level entries respecting brackets */
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

/**
 * Compute which steps are "safe" to skip (pure held continuations with
 * NO note starts on ANY MIDI row) and compute effective @-lengths that
 * are truncated when another note starts within the span.
 */
function buildHeldInfo(
  noteMap: Map<string, NoteData>,
  totalSteps: number,
): {
  /** Steps that are ONLY held continuations (no new note starts) — safe to skip */
  safeHeldSteps: Set<number>
  /** For a note starting at `step`, return the max @-length we can emit */
  effectiveLength: (startStep: number, fullLength: number) => number
} {
  // Collect all steps where at least one note STARTS
  const noteStartSteps = new Set<number>()
  noteMap.forEach((_data, key) => {
    const step = parseInt(key.split(':')[1])
    if (step < totalSteps) noteStartSteps.add(step)
  })

  // Build safe held steps: held continuation AND no note starts there
  const safeHeldSteps = new Set<number>()
  noteMap.forEach((data, key) => {
    const startStep = parseInt(key.split(':')[1])
    for (let s = startStep + 1; s < startStep + data.length && s < totalSteps; s++) {
      if (!noteStartSteps.has(s)) {
        safeHeldSteps.add(s)
      }
    }
  })

  // Effective length: truncate at first conflict (note start on any row)
  function effectiveLength(startStep: number, fullLength: number): number {
    for (let i = 1; i < fullLength; i++) {
      const s = startStep + i
      if (s >= totalSteps || noteStartSteps.has(s)) return i
    }
    return fullLength
  }

  return { safeHeldSteps, effectiveLength }
}

function gridToPattern(
  noteMap: Map<string, NoteData>,
  bars: number,
  scale: string,
  mode: 'degree' | 'note' = 'degree',
  stepsPerBar: number = 16,
): string {
  const totalSteps = bars * stepsPerBar
  const { safeHeldSteps, effectiveLength } = buildHeldInfo(noteMap, totalSteps)

  if (mode === 'note') {
    // ── Note-name mode: output MIDI as Strudel note names ──
    const stepMap = new Map<number, { midi: number; length: number }[]>()
    noteMap.forEach((data, key) => {
      const [midiStr, stepStr] = key.split(':')
      const midi = parseInt(midiStr)
      const step = parseInt(stepStr)
      if (step < totalSteps) {
        const arr = stepMap.get(step) || []
        arr.push({ midi, length: data.length })
        stepMap.set(step, arr)
      }
    })

    const barPatterns: string[] = []
    for (let bar = 0; bar < bars; bar++) {
      const tokens: string[] = []
      for (let s = 0; s < stepsPerBar; s++) {
        const step = bar * stepsPerBar + s
        // Only skip steps that are pure held continuations (no note starts)
        if (safeHeldSteps.has(step)) continue

        const notes = stepMap.get(step)
        if (!notes || notes.length === 0) {
          tokens.push('~')
        } else if (notes.length === 1) {
          const n = notes[0]
          const eff = effectiveLength(step, n.length)
          const name = midiToStrudelNote(n.midi)
          tokens.push(eff > 1 ? `${name}@${eff}` : name)
        } else {
          const chord = notes.sort((a, b) => a.midi - b.midi).map(n => {
            const eff = effectiveLength(step, n.length)
            const name = midiToStrudelNote(n.midi)
            return eff > 1 ? `${name}@${eff}` : name
          }).join(',')
          tokens.push(`[${chord}]`)
        }
      }
      barPatterns.push(tokens.join(' '))
    }
    if (bars === 1) return barPatterns[0]
    return `<${barPatterns.map(b => `[${b}]`).join(' ')}>`
  }

  // ── Degree mode: output scale degree numbers ──
  const stepMap = new Map<number, { deg: number; length: number }[]>()
  noteMap.forEach((data, key) => {
    const [midiStr, stepStr] = key.split(':')
    const midi = parseInt(midiStr)
    const step = parseInt(stepStr)
    const deg = midiToDegree(midi, scale)
    if (deg !== null && step < totalSteps) {
      const arr = stepMap.get(step) || []
      arr.push({ deg, length: data.length })
      stepMap.set(step, arr)
    }
  })

  const barPatterns: string[] = []
  for (let bar = 0; bar < bars; bar++) {
    const tokens: string[] = []
    for (let s = 0; s < stepsPerBar; s++) {
      const step = bar * stepsPerBar + s
      // Only skip steps that are pure held continuations (no note starts)
      if (safeHeldSteps.has(step)) continue

      const degs = stepMap.get(step)
      if (!degs || degs.length === 0) {
        tokens.push('~')
      } else if (degs.length === 1) {
        const d = degs[0]
        const eff = effectiveLength(step, d.length)
        tokens.push(eff > 1 ? `${d.deg}@${eff}` : String(d.deg))
      } else {
        const chord = degs.sort((a, b) => a.deg - b.deg).map(d => {
          const eff = effectiveLength(step, d.length)
          return eff > 1 ? `${d.deg}@${eff}` : String(d.deg)
        }).join(',')
        tokens.push(`[${chord}]`)
      }
    }
    barPatterns.push(tokens.join(' '))
  }

  if (bars === 1) return barPatterns[0]
  return `<${barPatterns.map(b => `[${b}]`).join(' ')}>`
}

// ═══════════════════════════════════════════════════════════════
//  COMPONENT
// ═══════════════════════════════════════════════════════════════

interface StudioPianoRollProps {
  /** The channel's current pattern (mini-notation string) */
  currentPattern: string
  /** Scale string like "C4:minor" */
  scale: string
  /** Channel color for theming */
  color: string
  /** Channel name */
  channelName: string
  /** Sound source for preview */
  soundSource: string
  /** Whether the channel's pattern is generative (irand, perlin, etc.) */
  isGenerative: boolean
  /** Pattern type: 'n' = scale degrees, 'note' = absolute note names, 's' = sample */
  patternType?: 'n' | 'note' | 's'
  /** Full channel data for effects panel */
  channelData?: ParsedChannel
  /** Channel index in parsed code */
  channelIdx?: number
  /** Called when user edits notes — receives new mini-notation */
  onPatternChange: (pattern: string) => void
  /** Called when an effect param is changed from the effects panel */
  onEffectChange?: (paramKey: string, value: number) => void
  /** Called to add an effect to the channel */
  onEffectAdd?: (effectCode: string) => void
  /** Called to remove an effect from the channel */
  onEffectRemove?: (effectKey: string) => void
  /** Called when arp mode changes */
  onArpChange?: (mode: string) => void
  /** Called when arp rate changes */
  onArpRateChange?: (rate: number) => void
  /** Called when transpose changes */
  onTransposeChange?: (semitones: number) => void
  /** Preview a note via superdough (real instrument sound) */
  onNotePreview?: (midi: number) => void
  /** Close the piano roll */
  onClose: () => void
}

const CELL_W_BASE = 28
const CELL_H_BASE = 16
const PIANO_W = 44
const BAR_OPTIONS = [1, 2, 4] as const
const GRID_OPTIONS = [16, 32] as const
const RESIZE_HANDLE_W = 6

/** Note data: a note starts at step with a given length (in steps) */
interface NoteData { length: number }

export default function StudioPianoRoll({
  currentPattern,
  scale,
  color,
  channelName,
  soundSource,
  isGenerative,
  patternType = 'n',
  channelData,
  channelIdx,
  onPatternChange,
  onEffectChange,
  onEffectAdd,
  onEffectRemove,
  onArpChange,
  onArpRateChange,
  onTransposeChange,
  onNotePreview,
  onClose,
}: StudioPianoRollProps) {
  const isNoteMode = patternType === 'note'
  const parseMode = isNoteMode ? 'note' as const : 'degree' as const
  const [bars, setBars] = useState(1)
  // Map of "midi:step" → NoteData (length in steps)
  const [noteMap, setNoteMap] = useState<Map<string, NoteData>>(new Map())
  const [hasUserEdited, setHasUserEdited] = useState(false)
  const speedModRef = useRef('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(1)
  const [stepsPerBar, setStepsPerBar] = useState<16 | 32>(16)
  const hasInitScrolled = useRef(false)
  const cellW = Math.round(CELL_W_BASE * zoom)
  const cellH = Math.round(CELL_H_BASE * zoom)
  const isDrawing = useRef(false)
  const drawMode = useRef<'add' | 'remove'>('add')
  const lastCell = useRef<string | null>(null)
  const isResizing = useRef(false)
  const resizeKey = useRef<string | null>(null)
  const noteMapRef = useRef(noteMap)
  noteMapRef.current = noteMap

  // ── Selection state (multi-select, copy/paste, duplicate) ──
  const [selectedNotes, setSelectedNotes] = useState<Set<string>>(new Set())
  const clipboardRef = useRef<{ midi: number; step: number; length: number }[]>([])
  // Box selection (Shift+drag)
  const [boxSelect, setBoxSelect] = useState<{ startX: number; startY: number; curX: number; curY: number } | null>(null)
  const isBoxSelecting = useRef(false)
  const boxStartCell = useRef<{ midi: number; step: number } | null>(null)

  // ── Effects panel state ──
  const [showEffectsPanel, setShowEffectsPanel] = useState(true)

  // ── Derived: Arp/Transpose info from channel data ──
  const arpInfo = useMemo(() => {
    if (!channelData) return { mode: 'off', rate: 1 }
    return getArpInfo(channelData.rawCode)
  }, [channelData])

  const transposeValue = useMemo(() => {
    if (!channelData) return 0
    return getTranspose(channelData.rawCode)
  }, [channelData])

  // Effect params (everything except gain, orbit, duck)
  const effectParams = useMemo(() => {
    if (!channelData) return []
    const skipKeys = new Set(['gain', 'orbit', 'duck'])
    return channelData.params.filter(p => !skipKeys.has(p.key))
  }, [channelData])

  // FX category groups
  const FX_GROUPS = useMemo(() => [
    { label: 'FILTER', icon: '🔽', keys: ['lpf', 'lp', 'hpf', 'hp', 'lpq', 'lpenv', 'lps', 'lpd'] },
    { label: 'DRIVE',  icon: '🔥', keys: ['shape', 'distort', 'crush'] },
    { label: 'SPACE',  icon: '🌌', keys: ['room', 'delay', 'delayfeedback', 'delaytime'] },
    { label: 'MOD',    icon: '🎵', keys: ['detune', 'speed', 'pan', 'velocity', 'postgain'] },
    { label: 'ENV',    icon: '⏳', keys: ['attack', 'decay', 'rel', 'release', 'legato', 'clip'] },
  ], [])

  const activeFxGroups = useMemo(() => {
    if (!channelData) return []
    return FX_GROUPS.map(group => ({
      ...group,
      params: channelData.params.filter(p => group.keys.includes(p.key)),
    })).filter(g => g.params.length > 0)
  }, [channelData, FX_GROUPS])

  /** Helper: create a simple Set<string> of all occupied cells for quick "is covered" checks */
  const coveredCells = useMemo(() => {
    const set = new Set<string>()
    noteMap.forEach((data, key) => {
      const [midiStr, stepStr] = key.split(':')
      const midi = parseInt(midiStr)
      const startStep = parseInt(stepStr)
      for (let s = startStep; s < startStep + data.length; s++) {
        set.add(`${midi}:${s}`)
      }
    })
    return set
  }, [noteMap])

  // ── Octave range ──
  const { rows } = useMemo(() => {
    let lo: number, hi: number
    if (isNoteMode) {
      // Note mode: wide chromatic range C1–C6; expand if notes go lower/higher
      lo = 24; hi = 84
      const { notes: existing } = parsePattern(currentPattern, scale, 'note')
      existing.forEach((_data, key) => {
        const midi = parseInt(key.split(':')[0])
        lo = Math.min(lo, Math.max(midi - 5, 21))
        hi = Math.max(hi, Math.min(midi + 5, 108))
      })
    } else {
      lo = degreeToMidi(-7, scale)
      hi = degreeToMidi(14, scale)
    }
    const rows: number[] = []
    for (let m = hi; m >= lo; m--) rows.push(m)
    return { rows }
  }, [scale, isNoteMode, currentPattern])

  const scaleMidiSet = useMemo(
    () => getScaleMidiSet(scale, rows[rows.length - 1], rows[0]),
    [scale, rows],
  )

  // ── Parse initial pattern (only on mount / pattern prop change) ──
  // Track whether user is actively drawing to avoid re-parse during live edits
  const hasUserEditedRef = useRef(false)
  hasUserEditedRef.current = hasUserEdited
  const lastEmittedPattern = useRef('')

  useEffect(() => {
    // If user is actively editing, skip re-parse — the user's noteMap is the source of truth.
    // Only re-parse if the incoming pattern differs from what we last emitted (external change).
    if (hasUserEditedRef.current && currentPattern === lastEmittedPattern.current) return

    console.log('[PianoRoll] parsing:', { currentPattern, parseMode, patternType, isGenerative, isNoteMode })
    const { notes: parsed, bars: parsedBars, speedMod } = parsePattern(currentPattern, scale, parseMode, stepsPerBar)
    speedModRef.current = speedMod
    console.log('[PianoRoll] result:', { notesCount: parsed.size, bars: parsedBars, speedMod })
    setNoteMap(parsed)
    setBars(Math.max(1, parsedBars) as 1 | 2 | 4)
    setHasUserEdited(false)

    // Auto-scroll to center on notes (only on first open)
    if (!hasInitScrolled.current) {
      hasInitScrolled.current = true
      requestAnimationFrame(() => {
        if (!scrollRef.current) return
        if (parsed.size > 0) {
          const midis = [...parsed.keys()].map(k => parseInt(k.split(':')[0]))
          const avg = midis.reduce((a, b) => a + b, 0) / midis.length
          const idx = rows.findIndex(m => m <= avg)
          scrollRef.current.scrollTop = Math.max(0, (idx >= 0 ? idx : rows.length / 2) * cellH - scrollRef.current.clientHeight / 2)
        } else {
          scrollRef.current.scrollTop = (rows.length / 2) * cellH - scrollRef.current.clientHeight / 2
        }
      })
    }
  }, [currentPattern, scale]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Emit pattern when user edits (debounced) ──
  const emitTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!hasUserEdited) return
    if (emitTimer.current) clearTimeout(emitTimer.current)
    emitTimer.current = setTimeout(() => {
      // Pass noteMap directly to gridToPattern so it can encode note lengths with @
      const pat = gridToPattern(noteMapRef.current, bars, scale, parseMode, stepsPerBar)
      const fullPat = speedModRef.current ? pat + speedModRef.current : pat
      lastEmittedPattern.current = fullPat
      onPatternChange(fullPat)
    }, 120)
    return () => { if (emitTimer.current) clearTimeout(emitTimer.current) }
  }, [noteMap, hasUserEdited, bars, scale, onPatternChange, stepsPerBar])

  // ── Toggle note ──
  const toggleNote = useCallback((midi: number, step: number, forceMode?: 'add' | 'remove') => {
    // Block out-of-scale notes in ALL modes (scale is mandatory)
    if (!scaleMidiSet.has(midi)) return
    const key = `${midi}:${step}`
    setNoteMap(prev => {
      const next = new Map(prev)
      const mode = forceMode || (prev.has(key) ? 'remove' : 'add')
      if (mode === 'remove') {
        // Also check if this cell is covered by a longer note
        let found = false
        prev.forEach((data, k) => {
          const [mStr, sStr] = k.split(':')
          if (parseInt(mStr) === midi) {
            const s = parseInt(sStr)
            if (step >= s && step < s + data.length) {
              next.delete(k)
              found = true
            }
          }
        })
        if (!found) next.delete(key)
      } else {
        next.set(key, { length: 1 })
        if (onNotePreview) {
          onNotePreview(midi)
        } else {
          playPreview(midi, soundSource)
        }
      }
      return next
    })
    setHasUserEdited(true)
  }, [soundSource, scaleMidiSet, isNoteMode, onNotePreview])

  // ── Resize note (drag right edge) ──
  const handleResizeStart = useCallback((key: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    isResizing.current = true
    resizeKey.current = key
    const startX = e.clientX
    const startLen = noteMapRef.current.get(key)?.length || 1
    const cw = cellW
    const maxSteps = stepsPerBar

    const onMove = (ev: MouseEvent) => {
      if (!isResizing.current || resizeKey.current !== key) return
      const delta = Math.round((ev.clientX - startX) / cw)
      const newLen = Math.max(1, Math.min(startLen + delta, maxSteps))
      setNoteMap(prev => {
        const next = new Map(prev)
        const data = next.get(key)
        if (data) next.set(key, { ...data, length: newLen })
        return next
      })
    }
    const onUp = () => {
      isResizing.current = false
      resizeKey.current = null
      setHasUserEdited(true)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [cellW, stepsPerBar])

  // ── Mouse handlers for click+drag painting ──
  const handleCellDown = useCallback((midi: number, step: number, e: React.MouseEvent) => {
    if (isResizing.current) return
    if (e.shiftKey) return // Let grid-level box selection handle shift+drag
    e.preventDefault()
    const key = `${midi}:${step}`
    isDrawing.current = true
    // Check if this cell is covered by any note
    let isCovered = false
    noteMap.forEach((data, k) => {
      const [mStr, sStr] = k.split(':')
      if (parseInt(mStr) === midi) {
        const s = parseInt(sStr)
        if (step >= s && step < s + data.length) isCovered = true
      }
    })
    drawMode.current = isCovered ? 'remove' : 'add'
    lastCell.current = key
    toggleNote(midi, step, drawMode.current)
  }, [noteMap, toggleNote])

  const handleCellEnter = useCallback((midi: number, step: number) => {
    if (!isDrawing.current || isBoxSelecting.current) return
    const key = `${midi}:${step}`
    if (key === lastCell.current) return
    lastCell.current = key
    toggleNote(midi, step, drawMode.current)
  }, [toggleNote])

  useEffect(() => {
    const up = () => {
      isDrawing.current = false
      lastCell.current = null
      // End box selection — compute selected notes
      if (isBoxSelecting.current && boxStartCell.current) {
        isBoxSelecting.current = false
      }
    }
    window.addEventListener('mouseup', up)
    return () => window.removeEventListener('mouseup', up)
  }, [])

  // ── Box selection handlers ──
  const handleGridMouseDown = useCallback((e: React.MouseEvent) => {
    if (!e.shiftKey) return
    e.preventDefault()
    const rect = scrollRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = e.clientX - rect.left + (scrollRef.current?.scrollLeft || 0)
    const y = e.clientY - rect.top + (scrollRef.current?.scrollTop || 0)
    isBoxSelecting.current = true
    setBoxSelect({ startX: x, startY: y, curX: x, curY: y })
  }, [])

  const handleGridMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isBoxSelecting.current || !scrollRef.current) return
    const rect = scrollRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left + scrollRef.current.scrollLeft
    const y = e.clientY - rect.top + scrollRef.current.scrollTop
    setBoxSelect(prev => prev ? { ...prev, curX: x, curY: y } : null)

    // Compute selected notes within box
    const left = Math.min(x, boxSelect?.startX ?? x) - PIANO_W
    const right = Math.max(x, boxSelect?.startX ?? x) - PIANO_W
    const top = Math.min(y, boxSelect?.startY ?? y) - 16 // ruler height
    const bottom = Math.max(y, boxSelect?.startY ?? y) - 16

    const stepL = Math.floor(left / cellW)
    const stepR = Math.ceil(right / cellW)
    const rowT = Math.floor(top / cellH)
    const rowB = Math.ceil(bottom / cellH)

    const newSel = new Set<string>()
    noteMapRef.current.forEach((data, key) => {
      const [midiStr, stepStr] = key.split(':')
      const midi = parseInt(midiStr)
      const step = parseInt(stepStr)
      const rowIdx = rows.indexOf(midi)
      if (rowIdx >= rowT && rowIdx <= rowB && step >= stepL && step < stepR) {
        newSel.add(key)
      }
    })
    setSelectedNotes(newSel)
  }, [rows, boxSelect, cellW, cellH])

  const handleGridMouseUp = useCallback(() => {
    if (isBoxSelecting.current) {
      isBoxSelecting.current = false
      setBoxSelect(null)
    }
  }, [])

  // ── Keyboard: Escape, Ctrl+C/V/D/A, Delete ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selectedNotes.size > 0) {
          setSelectedNotes(new Set())
        } else {
          onClose()
        }
        return
      }

      // Select all: Ctrl+A
      if (e.key === 'a' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        setSelectedNotes(new Set(noteMapRef.current.keys()))
        return
      }

      // Copy: Ctrl+C
      if (e.key === 'c' && (e.ctrlKey || e.metaKey) && selectedNotes.size > 0) {
        e.preventDefault()
        const notes: { midi: number; step: number; length: number }[] = []
        selectedNotes.forEach(key => {
          const [midiStr, stepStr] = key.split(':')
          const data = noteMapRef.current.get(key)
          if (data) notes.push({ midi: parseInt(midiStr), step: parseInt(stepStr), length: data.length })
        })
        clipboardRef.current = notes
        return
      }

      // Paste: Ctrl+V
      if (e.key === 'v' && (e.ctrlKey || e.metaKey) && clipboardRef.current.length > 0) {
        e.preventDefault()
        const clip = clipboardRef.current
        const minStep = Math.min(...clip.map(n => n.step))
        // Paste starting 1 step to the right of the highest selected step, or at the original position if nothing selected
        let pasteOffset = 0
        if (selectedNotes.size > 0) {
          const maxSelStep = Math.max(...[...selectedNotes].map(k => {
            const s = parseInt(k.split(':')[1])
            const data = noteMapRef.current.get(k)
            return s + (data?.length || 1)
          }))
          pasteOffset = maxSelStep - minStep
        }
        setNoteMap(prev => {
          const next = new Map(prev)
          const newSel = new Set<string>()
          clip.forEach(n => {
            const newStep = n.step + pasteOffset
            if (newStep < bars * stepsPerBar) {
              const key = `${n.midi}:${newStep}`
              next.set(key, { length: Math.min(n.length, bars * stepsPerBar - newStep) })
              newSel.add(key)
            }
          })
          setSelectedNotes(newSel)
          return next
        })
        setHasUserEdited(true)
        return
      }

      // Duplicate: Ctrl+D
      if (e.key === 'd' && (e.ctrlKey || e.metaKey) && selectedNotes.size > 0) {
        e.preventDefault()
        const notes: { midi: number; step: number; length: number }[] = []
        let maxEnd = 0
        let minStep = Infinity
        selectedNotes.forEach(key => {
          const [midiStr, stepStr] = key.split(':')
          const data = noteMapRef.current.get(key)
          if (data) {
            const step = parseInt(stepStr)
            notes.push({ midi: parseInt(midiStr), step, length: data.length })
            maxEnd = Math.max(maxEnd, step + data.length)
            minStep = Math.min(minStep, step)
          }
        })
        // Duplicate to the right: shift by the span of the selection
        const span = maxEnd - minStep
        setNoteMap(prev => {
          const next = new Map(prev)
          const newSel = new Set<string>()
          notes.forEach(n => {
            const newStep = n.step + span
            if (newStep < bars * stepsPerBar) {
              const key = `${n.midi}:${newStep}`
              next.set(key, { length: Math.min(n.length, bars * stepsPerBar - newStep) })
              newSel.add(key)
            }
          })
          setSelectedNotes(newSel)
          return next
        })
        setHasUserEdited(true)
        return
      }

      // Delete selected: Delete or Backspace
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedNotes.size > 0) {
        e.preventDefault()
        setNoteMap(prev => {
          const next = new Map(prev)
          selectedNotes.forEach(key => next.delete(key))
          return next
        })
        setSelectedNotes(new Set())
        setHasUserEdited(true)
        return
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose, selectedNotes, bars, stepsPerBar])

  // ── Clear all ──
  const clearAll = useCallback(() => {
    setNoteMap(new Map())
    setSelectedNotes(new Set())
    setHasUserEdited(true)
  }, [])

  const totalSteps = bars * stepsPerBar
  const gridW = totalSteps * cellW

  return (
    <div
      className="absolute bottom-0 left-0 right-0 z-[100] flex flex-col select-none"
      style={{
        height: 340,
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
          {/* Channel name + source */}
          <span className="text-[9px] font-black uppercase tracking-wider" style={{ color }}>
            🎹 {channelName}
          </span>
          {channelData && (
            <span className="text-[6px] font-mono px-1 py-0.5 rounded" style={{ color: '#5a616b', background: '#1c1e22' }}>
              {channelData.source}
            </span>
          )}
          {isNoteMode ? (
            <span className="text-[7px] font-bold font-mono px-1 py-0.5" style={{ color: '#b8a47f', background: '#1c1e22', borderRadius: '8px', boxShadow: 'inset 1px 1px 3px #14161a, inset -1px -1px 3px #2c3036' }}>
              NOTE ♯♭
            </span>
          ) : (
            <>
              <span className="text-[7px] font-mono" style={{ color: '#5a616b' }}>🎵 {scale.replace(/\d+:/, ':')}</span>
              <span className="text-[7px] font-mono" style={{ color: '#5a616b' }}>({scaleMidiSet.size} notes)</span>
            </>
          )}

          <div className="w-px h-3.5 bg-white/[0.08]" />

          {/* Arp indicator */}
          {arpInfo.mode !== 'off' && (
            <>
              <span className="text-[7px] font-bold px-1.5 py-0.5 rounded-lg flex items-center gap-1"
                style={{ color: '#b8a47f', background: '#1c1e22', boxShadow: 'inset 1px 1px 3px #14161a, inset -1px -1px 3px #2c3036' }}>
                🎹 ARP {arpInfo.mode.toUpperCase()} ×{arpInfo.rate}
              </span>
              <div className="w-px h-3.5 bg-white/[0.08]" />
            </>
          )}

          {/* Transpose indicator */}
          {transposeValue !== 0 && (
            <>
              <span className="text-[7px] font-bold px-1.5 py-0.5 rounded-lg"
                style={{ color: '#6f8fb3', background: '#1c1e22', boxShadow: 'inset 1px 1px 3px #14161a, inset -1px -1px 3px #2c3036' }}>
                ⬆ TRANS {transposeValue > 0 ? `+${transposeValue}` : transposeValue}
              </span>
              <div className="w-px h-3.5 bg-white/[0.08]" />
            </>
          )}

          {/* Active effects count */}
          {effectParams.length > 0 && (
            <>
              <span className="text-[7px] font-bold px-1.5 py-0.5 rounded-lg"
                style={{ color: `${color}90`, background: '#1c1e22', boxShadow: 'inset 1px 1px 3px #14161a, inset -1px -1px 3px #2c3036' }}>
                {effectParams.length} FX
              </span>
              <div className="w-px h-3.5 bg-white/[0.08]" />
            </>
          )}

          {/* Bars selector */}
          <span className="text-[7px] uppercase tracking-wider font-bold" style={{ color: '#5a616b' }}>Bars</span>
          {BAR_OPTIONS.map(b => (
            <button
              key={b}
              onClick={() => { setBars(b); setHasUserEdited(true) }}
              className="px-1.5 py-0.5 text-[8px] font-bold cursor-pointer transition-all"
              style={{
                background: bars === b ? '#2a2e34' : '#1c1e22',
                color: bars === b ? color : '#5a616b',
                border: 'none',
                borderRadius: '8px',
                boxShadow: bars === b
                  ? 'inset 2px 2px 4px #14161a, inset -2px -2px 4px #2c3036'
                  : '2px 2px 4px #14161a, -2px -2px 4px #2c3036',
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
                setNoteMap(prev => {
                  const next = new Map<string, NoteData>()
                  prev.forEach((data, key) => {
                    const [midiStr, stepStr] = key.split(':')
                    const newStep = Math.round(parseInt(stepStr) * ratio)
                    const newLen = Math.max(1, Math.round(data.length * ratio))
                    next.set(`${midiStr}:${newStep}`, { length: newLen })
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

          {isGenerative && !hasUserEdited && (
            <>
              <div className="w-px h-3.5 bg-white/[0.08]" />
              <span className="text-[7px] font-mono font-bold" style={{ color: '#b8a47f' }}>
                ⚡ generative — click grid to compose
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {hasUserEdited && (
            <span className="text-[7px] font-black px-1.5 py-0.5 rounded-lg"
              style={{ color: '#7fa998', background: '#1c1e22', boxShadow: 'inset 1px 1px 3px #14161a, inset -1px -1px 3px #2c3036' }}>
              ● LIVE
            </span>
          )}
          <span className="text-[7px] font-mono font-bold" style={{ color: '#5a616b' }}>
            {noteMap.size} note{noteMap.size !== 1 ? 's' : ''}
          </span>
          {selectedNotes.size > 0 && (
            <>
              <span className="text-[7px] font-mono font-bold px-1.5 py-0.5 rounded-lg" style={{ color, background: '#1c1e22', boxShadow: 'inset 1px 1px 3px #14161a, inset -1px -1px 3px #2c3036' }}>
                {selectedNotes.size} sel
              </span>
              <button onClick={() => {
                const notes: { midi: number; step: number; length: number }[] = []
                selectedNotes.forEach(key => { const [m, s] = key.split(':'); const d = noteMap.get(key); if (d) notes.push({ midi: parseInt(m), step: parseInt(s), length: d.length }) })
                clipboardRef.current = notes
              }}
                className="px-1.5 py-0.5 text-[7px] cursor-pointer transition-all duration-[180ms] font-bold rounded-lg"
                style={{ background: '#1c1e22', color: '#6f8fb3', boxShadow: '2px 2px 4px #14161a, -2px -2px 4px #2c3036' }}
                title="Copy (Ctrl+C)">Copy</button>
              <button onClick={() => {
                const notes: { midi: number; step: number; length: number }[] = []; let maxEnd = 0; let minStep = Infinity
                selectedNotes.forEach(key => { const [m, s] = key.split(':'); const d = noteMap.get(key); if (d) { const st = parseInt(s); notes.push({ midi: parseInt(m), step: st, length: d.length }); maxEnd = Math.max(maxEnd, st + d.length); minStep = Math.min(minStep, st) } })
                const span = maxEnd - minStep
                setNoteMap(prev => { const next = new Map(prev); const newSel = new Set<string>(); notes.forEach(n => { const ns = n.step + span; if (ns < totalSteps) { const k = `${n.midi}:${ns}`; next.set(k, { length: Math.min(n.length, totalSteps - ns) }); newSel.add(k) } }); setSelectedNotes(newSel); return next })
                setHasUserEdited(true)
              }}
                className="px-1.5 py-0.5 text-[7px] cursor-pointer transition-all duration-[180ms] font-bold rounded-lg"
                style={{ background: '#1c1e22', color: '#b8a47f', boxShadow: '2px 2px 4px #14161a, -2px -2px 4px #2c3036' }}
                title="Duplicate (Ctrl+D)">Dup</button>
              <button onClick={() => {
                setNoteMap(prev => { const next = new Map(prev); selectedNotes.forEach(key => next.delete(key)); return next })
                setSelectedNotes(new Set())
                setHasUserEdited(true)
              }}
                className="px-1.5 py-0.5 text-[7px] cursor-pointer transition-all duration-[180ms] font-bold rounded-lg"
                style={{ background: '#1c1e22', color: '#b86f6f', boxShadow: '2px 2px 4px #14161a, -2px -2px 4px #2c3036' }}
                title="Delete (Del)">Del</button>
            </>
          )}
          {clipboardRef.current.length > 0 && (
            <button onClick={() => {
              const clip = clipboardRef.current; const minStep = Math.min(...clip.map(n => n.step))
              let pasteOffset = 0
              if (selectedNotes.size > 0) { const maxSelStep = Math.max(...[...selectedNotes].map(k => { const s = parseInt(k.split(':')[1]); const d = noteMap.get(k); return s + (d?.length || 1) })); pasteOffset = maxSelStep - minStep }
              setNoteMap(prev => { const next = new Map(prev); const newSel = new Set<string>(); clip.forEach(n => { const ns = n.step + pasteOffset; if (ns < totalSteps) { const k = `${n.midi}:${ns}`; next.set(k, { length: Math.min(n.length, totalSteps - ns) }); newSel.add(k) } }); setSelectedNotes(newSel); return next })
              setHasUserEdited(true)
            }}
              className="px-1.5 py-0.5 text-[7px] cursor-pointer transition-all duration-[180ms] font-bold rounded-lg"
              style={{ background: '#1c1e22', color: '#7fa998', boxShadow: '2px 2px 4px #14161a, -2px -2px 4px #2c3036' }}
              title="Paste (Ctrl+V)">Paste</button>
          )}
          <button onClick={clearAll}
            className="px-1.5 py-0.5 text-[7px] cursor-pointer transition-all duration-[180ms] font-bold rounded-lg"
            style={{ background: '#1c1e22', color: '#5a616b', boxShadow: '2px 2px 4px #14161a, -2px -2px 4px #2c3036' }}>
            Clear
          </button>
          {channelData && (
            <button onClick={() => setShowEffectsPanel(p => !p)}
              className="px-1.5 py-0.5 text-[7px] cursor-pointer transition-all duration-[180ms] font-bold rounded-lg"
              style={{
                background: showEffectsPanel ? '#2a2e34' : '#1c1e22',
                color: showEffectsPanel ? color : '#5a616b',
                boxShadow: showEffectsPanel
                  ? 'inset 2px 2px 4px #14161a, inset -2px -2px 4px #2c3036'
                  : '2px 2px 4px #14161a, -2px -2px 4px #2c3036',
              }}
              title="Toggle Effects Panel">
              ✦ FX
            </button>
          )}
          <button onClick={onClose}
            className="px-1.5 py-0.5 text-[7px] cursor-pointer transition-all duration-[180ms] font-bold rounded-lg"
            style={{ background: '#1c1e22', color: '#5a616b', boxShadow: '2px 2px 4px #14161a, -2px -2px 4px #2c3036' }}
            title="Esc">
            ✕
          </button>
        </div>
      </div>

      {/* ═══ MAIN CONTENT: Effects Panel + Grid ═══ */}
      <div className="flex-1 flex overflow-hidden">

        {/* ── EFFECTS SIDE PANEL ── */}
        {showEffectsPanel && channelData && (
          <div
            className="shrink-0 overflow-y-auto"
            style={{
              width: 180,
              background: '#1c1e22',
              borderRight: '1px solid rgba(255,255,255,0.04)',
              scrollbarWidth: 'thin',
              scrollbarColor: `${color}25 transparent`,
            }}
          >
            {/* ── Node header ── */}
            <div className="px-2 py-1.5 sticky top-0 z-10" style={{ background: '#1c1e22', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
                <span className="text-[8px] font-black uppercase tracking-wider" style={{ color: `${color}cc` }}>{channelName}</span>
              </div>
              <div className="text-[6px] font-mono mt-0.5" style={{ color: '#5a616b' }}>
                {channelData.source} · {channelData.sourceType}
              </div>
            </div>

            {/* ── Gain ── */}
            {(() => {
              const gainParam = channelData.params.find(p => p.key === 'gain')
              if (!gainParam) return null
              return (
                <div className="flex justify-center py-1.5 px-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                  <StudioKnob
                    label="GAIN"
                    value={gainParam.value}
                    min={0}
                    max={2}
                    step={0.01}
                    size={28}
                    color={color}
                    isComplex={gainParam.isComplex}
                    onChange={(v) => onEffectChange?.('gain', v)}
                  />
                </div>
              )
            })()}

            {/* ── Transpose ── */}
            <div className="px-2 py-1.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
              <div className="flex items-center gap-1 mb-1">
                <span className="text-[6px] font-bold uppercase tracking-wider" style={{ color: '#6f8fb3' }}>⬆ Transpose</span>
                <span className="text-[7px] font-mono font-bold ml-auto" style={{ color: transposeValue !== 0 ? '#6f8fb3' : '#5a616b' }}>
                  {transposeValue > 0 ? `+${transposeValue}` : transposeValue}
                </span>
              </div>
              <div className="flex items-center justify-center gap-1">
                <button
                  onClick={() => onTransposeChange?.(transposeValue - 1)}
                  className="cursor-pointer transition-all duration-100 active:scale-90"
                  style={{
                    width: 18, height: 16, borderRadius: 5,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '7px', fontWeight: 900, color: '#6f8fb3',
                    background: '#23262b', border: 'none',
                    boxShadow: '2px 2px 4px #14161a, -2px -2px 4px #2c3036',
                  }}
                >−</button>
                <StudioKnob
                  label=""
                  value={transposeValue}
                  min={-24}
                  max={24}
                  step={1}
                  size={24}
                  color="#6f8fb3"
                  formatValue={(v) => (v > 0 ? `+${v}` : `${v}`)}
                  onChange={(v) => onTransposeChange?.(v)}
                />
                <button
                  onClick={() => onTransposeChange?.(transposeValue + 1)}
                  className="cursor-pointer transition-all duration-100 active:scale-90"
                  style={{
                    width: 18, height: 16, borderRadius: 5,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '7px', fontWeight: 900, color: '#6f8fb3',
                    background: '#23262b', border: 'none',
                    boxShadow: '2px 2px 4px #14161a, -2px -2px 4px #2c3036',
                  }}
                >+</button>
              </div>
            </div>

            {/* ── ARP ── */}
            <div className="px-2 py-1.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
              <div className="flex items-center gap-1 mb-1">
                <span className="text-[6px] font-bold uppercase tracking-wider" style={{ color: arpInfo.mode !== 'off' ? '#b8a47f' : '#5a616b' }}>🎹 Arp</span>
                {arpInfo.mode !== 'off' && (
                  <span className="text-[5px] font-bold ml-auto" style={{ color: '#b8a47f' }}>{arpInfo.mode.toUpperCase()} ×{arpInfo.rate}</span>
                )}
              </div>
              <div className="flex flex-wrap gap-0.5 justify-center">
                {(typeof ARP_MODES !== 'undefined' ? ARP_MODES : [
                  { id: 'off', label: 'Off', icon: '○' },
                  { id: 'up', label: 'Up', icon: '↑' },
                  { id: 'down', label: 'Down', icon: '↓' },
                  { id: 'updown', label: 'Up/Down', icon: '↕' },
                  { id: 'random', label: 'Random', icon: '?' },
                ]).map((mode: { id: string; label: string; icon: string }) => (
                  <button
                    key={mode.id}
                    onClick={() => onArpChange?.(mode.id)}
                    className="cursor-pointer transition-all duration-100 active:scale-90"
                    style={{
                      width: 22, height: 16, borderRadius: 6,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '8px', fontWeight: 900,
                      color: arpInfo.mode === mode.id ? '#b8a47f' : '#5a616b',
                      background: arpInfo.mode === mode.id ? '#2a2e34' : '#23262b',
                      border: 'none',
                      boxShadow: arpInfo.mode === mode.id
                        ? 'inset 2px 2px 4px #14161a, inset -2px -2px 4px #2c3036'
                        : '2px 2px 4px #14161a, -2px -2px 4px #2c3036',
                    }}
                    title={`Arp: ${mode.label}`}
                  >
                    {mode.icon}
                  </button>
                ))}
              </div>
              {arpInfo.mode !== 'off' && (
                <div className="flex justify-center mt-1">
                  <StudioKnob
                    label="RATE"
                    value={arpInfo.rate}
                    min={1}
                    max={8}
                    step={1}
                    size={24}
                    color="#b8a47f"
                    formatValue={(v) => `×${v}`}
                    onChange={(v) => onArpRateChange?.(v)}
                  />
                </div>
              )}
            </div>

            {/* ── Effect groups ── */}
            {activeFxGroups.map((group) => (
              <div key={group.label} className="px-2 py-1.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                <div className="flex items-center gap-1 mb-1">
                  <span className="text-[7px]">{group.icon}</span>
                  <span className="text-[6px] font-bold uppercase tracking-wider" style={{ color: '#5a616b' }}>{group.label}</span>
                </div>
                <div className="flex flex-wrap gap-0.5 justify-center">
                  {group.params.map((param) => {
                    const def = getParamDef(param.key)
                    if (!def) return null
                    return (
                      <StudioKnob
                        key={param.key}
                        label={def.label}
                        value={param.value}
                        min={def.min}
                        max={def.max}
                        step={def.step}
                        size={24}
                        color={color}
                        unit={def.unit}
                        isComplex={param.isComplex}
                        onChange={(v) => onEffectChange?.(param.key, v)}
                        onRemove={onEffectRemove ? () => onEffectRemove(param.key) : undefined}
                      />
                    )
                  })}
                </div>
              </div>
            ))}

            {/* ── Quick-add effects ── */}
            {onEffectAdd && (
              <div className="px-2 py-1.5">
                <div className="flex items-center gap-1 mb-1">
                  <span className="text-[6px] font-bold uppercase tracking-wider" style={{ color: '#5a616b' }}>+ ADD FX</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {[
                    { label: 'LPF', code: '.lpf(2000)' },
                    { label: 'HPF', code: '.hpf(200)' },
                    { label: 'Reverb', code: '.room(0.5)' },
                    { label: 'Delay', code: '.delay(0.25)' },
                    { label: 'Dist', code: '.distort(0.3)' },
                    { label: 'Shape', code: '.shape(0.3)' },
                    { label: 'Crush', code: '.crush(8)' },
                    { label: 'Detune', code: '.detune(0.1)' },
                  ].filter(fx => !channelData.effects.includes(fx.label.toLowerCase().replace(/[^a-z]/g, ''))).map(fx => (
                    <button
                      key={fx.label}
                      onClick={() => onEffectAdd(fx.code)}
                      className="px-1.5 py-0.5 text-[6px] font-bold cursor-pointer transition-all duration-100 active:scale-95 rounded-lg"
                      style={{
                        background: '#23262b',
                        color: '#7fa998',
                        boxShadow: '2px 2px 4px #14161a, -2px -2px 4px #2c3036',
                        border: 'none',
                      }}
                    >
                      + {fx.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

      {/* ═══ GRID ═══ */}
      <div ref={scrollRef} className="flex-1 overflow-auto relative"
        style={{ scrollbarWidth: 'thin', scrollbarColor: `${color}25 transparent` }}
        onMouseDown={handleGridMouseDown}
        onMouseMove={handleGridMouseMove}
        onMouseUp={handleGridMouseUp}
        onWheel={(e) => {
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault()
            setZoom(z => Math.max(0.4, Math.min(3, +(z + (e.deltaY > 0 ? -0.1 : 0.1)).toFixed(2))))
          }
        }}
      >

        {/* Box selection rectangle */}
        {boxSelect && (
          <div className="absolute z-40 pointer-events-none" style={{
            left: Math.min(boxSelect.startX, boxSelect.curX),
            top: Math.min(boxSelect.startY, boxSelect.curY),
            width: Math.abs(boxSelect.curX - boxSelect.startX),
            height: Math.abs(boxSelect.curY - boxSelect.startY),
            border: `1px solid ${color}80`,
            background: `${color}15`,
            borderRadius: 2,
          }} />
        )}

        {/* Generative pattern overlay */}
        {isGenerative && !hasUserEdited && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center pointer-events-none"
            style={{ background: 'rgba(28,30,34,0.85)' }}>
            <div className="text-sm font-bold mb-1" style={{ color: '#b8a47f' }}>⚡ Generative Pattern</div>
            <div className="text-xs text-center max-w-[280px]" style={{ color: '#5a616b' }}>
              This channel uses a random/algorithmic pattern (<span className="font-mono" style={{ color: '#b8a47f', opacity: 0.7 }}>irand, perlin</span> etc.)
            </div>
            <div className="text-[10px] mt-2" style={{ color: '#5a616b' }}>Click any cell to start composing a static pattern</div>
          </div>
        )}

        <div style={{ width: PIANO_W + gridW, position: 'relative' }}>

          {/* ── Beat ruler (sticky top) ── */}
          <div className="flex sticky top-0 z-20" style={{ height: 16, background: '#2a2e34' }}>
            <div className="sticky left-0 z-30 shrink-0"
              style={{ width: PIANO_W, height: 16, background: '#2a2e34', borderBottom: '1px solid rgba(255,255,255,0.04)', borderRight: '1px solid rgba(255,255,255,0.04)' }} />
            <div className="flex">
              {Array.from({ length: totalSteps }, (_, i) => {
                const beatInterval = stepsPerBar / 4
                const isBar = i % stepsPerBar === 0
                const isBeat = i % beatInterval === 0
                const barNum = Math.floor(i / stepsPerBar) + 1
                return (
                  <div key={i} className="shrink-0 flex items-end justify-start"
                    style={{
                      width: cellW, height: 16,
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

          {/* ── Piano keys + Grid rows ── */}
          {rows.map(midi => {
            const name = midiNoteName(midi)
            const black = isBlackKey(midi)
            const inScale = scaleMidiSet.has(midi)
            const isRoot = midi % 12 === NOTE_NAMES.indexOf(parseScaleStr(scale).root)
            const canClick = inScale

            // Collect note-bar starts for this MIDI row
            const rowNotes: { step: number; length: number; key: string }[] = []
            noteMap.forEach((data, key) => {
              const [mStr, sStr] = key.split(':')
              if (parseInt(mStr) === midi) {
                rowNotes.push({ step: parseInt(sStr), length: data.length, key })
              }
            })

            // Collect transpose ghost notes — notes written at (midi - transposeValue) that sound here
            const ghostNotes: { step: number; length: number }[] = []
            if (transposeValue !== 0) {
              const sourceMidi = midi - transposeValue
              noteMap.forEach((data, key) => {
                const [mStr, sStr] = key.split(':')
                if (parseInt(mStr) === sourceMidi) {
                  ghostNotes.push({ step: parseInt(sStr), length: data.length })
                }
              })
            }

            return (
              <div key={midi} className="flex relative" style={{ height: cellH }}>
                {/* Piano key label (sticky left) */}
                <div
                  className="sticky left-0 z-10 shrink-0 flex items-center justify-end pr-1.5"
                  style={{
                    width: PIANO_W, height: cellH,
                      background: black ? '#1c1e22' : '#23262b',
                      borderBottom: '1px solid rgba(255,255,255,0.03)',
                      borderRight: '1px solid rgba(255,255,255,0.04)',
                  }}
                >
                  <span className="text-[7px] font-mono" style={{
                    color: isRoot ? `${color}` : inScale ? '#c8cdd2' : '#5a616b',
                    fontWeight: isRoot ? 700 : inScale ? 500 : 300,
                    opacity: isRoot ? 1 : inScale ? 0.5 : 0.25,
                  }}>
                    {isRoot ? `● ${name}` : name}
                  </span>
                </div>

                {/* Grid cells (empty background) */}
                {Array.from({ length: totalSteps }, (_, step) => {
                  const beatInterval = stepsPerBar / 4
                  const isBarLine = step % stepsPerBar === 0
                  const isBeatLine = step % beatInterval === 0
                  const isCovered = coveredCells.has(`${midi}:${step}`)

                  return (
                    <div
                      key={step}
                      className={`shrink-0 ${canClick ? 'cursor-crosshair' : 'cursor-not-allowed'}`}
                      style={{
                        width: cellW, height: cellH,
                        background: !inScale
                            ? 'rgba(0,0,0,0.25)'
                            : isRoot
                              ? `${color}08`
                              : (black ? 'rgba(255,255,255,0.015)' : 'rgba(255,255,255,0.025)'),
                        borderBottom: '1px solid rgba(255,255,255,0.03)',
                        borderLeft: isBarLine
                          ? '1px solid rgba(255,255,255,0.12)'
                          : isBeatLine
                            ? '1px solid rgba(255,255,255,0.06)'
                            : '1px solid rgba(255,255,255,0.02)',
                        opacity: canClick ? 1 : 0.35,
                      }}
                      onMouseDown={canClick ? (e) => handleCellDown(midi, step, e) : undefined}
                      onMouseEnter={canClick ? () => handleCellEnter(midi, step) : undefined}
                    />
                  )
                })}

                {/* Note bars (rendered on top of grid cells) */}
                {rowNotes.map(({ step, length, key }) => {
                  const isSelected = selectedNotes.has(key)
                  return (
                  <div
                    key={key}
                    className="absolute z-[5] group cursor-pointer"
                    style={{
                      left: PIANO_W + step * cellW + 1,
                      top: 1,
                      width: length * cellW - 2,
                      height: cellH - 2,
                      background: isSelected ? `${color}` : `${color}cc`,
                      borderRadius: 3,
                      boxShadow: isSelected
                        ? `0 0 0 1.5px #fff, inset 0 1px 0 ${color}60`
                        : `inset 0 1px 0 ${color}30`,
                      pointerEvents: 'auto',
                    }}
                    onMouseDown={(e) => {
                      if (isResizing.current) return
                      // Ctrl/Cmd click toggles selection
                      if (e.ctrlKey || e.metaKey) {
                        e.preventDefault()
                        e.stopPropagation()
                        setSelectedNotes(prev => {
                          const next = new Set(prev)
                          if (next.has(key)) next.delete(key)
                          else next.add(key)
                          return next
                        })
                        return
                      }
                      // Shift+click is for box select, ignore here
                      if (e.shiftKey) return
                      e.preventDefault()
                      e.stopPropagation()
                      // If clicking a selected note without Ctrl, start drag-remove normally
                      if (!isSelected) setSelectedNotes(new Set())
                      isDrawing.current = true
                      drawMode.current = 'remove'
                      lastCell.current = key
                      toggleNote(midi, step, 'remove')
                    }}
                    onMouseEnter={() => {
                      if (!isDrawing.current || drawMode.current !== 'remove') return
                      const cellKey = `${midi}:${step}`
                      if (cellKey === lastCell.current) return
                      lastCell.current = cellKey
                      toggleNote(midi, step, 'remove')
                    }}
                  >
                    {/* Arp stripe overlay */}
                    {arpInfo && arpInfo.mode !== 'off' && (
                      <div
                        className="absolute inset-0 pointer-events-none overflow-hidden rounded-[3px]"
                        style={{
                          background: `repeating-linear-gradient(
                            ${arpInfo.mode === 'up' ? '45deg' : arpInfo.mode === 'down' ? '-45deg' : '90deg'},
                            transparent, transparent 2px,
                            ${color}20 2px, ${color}20 4px
                          )`,
                          opacity: 0.7,
                        }}
                      />
                    )}
                    {/* Resize handle on right edge */}
                    <div
                      className="absolute right-0 top-0 bottom-0 cursor-ew-resize opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{
                        width: RESIZE_HANDLE_W,
                        background: `linear-gradient(90deg, transparent, ${color})`,
                        borderRadius: '0 3px 3px 0',
                      }}
                      onMouseDown={(e) => handleResizeStart(key, e)}
                    />
                  </div>
                  )
                })}

                {/* Transpose ghost notes — show where transposed notes will sound */}
                {ghostNotes.map(({ step, length }, gi) => (
                  <div
                    key={`ghost-${gi}`}
                    className="absolute z-[4] pointer-events-none"
                    style={{
                      left: PIANO_W + step * cellW + 1,
                      top: 1,
                      width: length * cellW - 2,
                      height: cellH - 2,
                      border: `1px dashed ${color}60`,
                      borderRadius: 3,
                      background: `${color}08`,
                    }}
                  />
                ))}
              </div>
            )
          })}
        </div>
      </div>
      </div>{/* ═══ END MAIN CONTENT ═══ */}
    </div>
  )
}
