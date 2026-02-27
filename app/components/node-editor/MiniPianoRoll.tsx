'use client'

// ═══════════════════════════════════════════════════════════════
//  MINI PIANO ROLL — compact visual representation of MIDI notes
//
//  Shows a tiny Ableton-style clip preview on node cards.
//  Replaces the truncated text pattern display.
//  Click to open the full PianoRoll dock editor.
//
//  ┌────────────────────────────────────────────┐
//  │  ▪▪         ▪▪▪           ▪▪              │  ← note bars
//  │     ▪▪▪          ▪▪   ▪▪▪                 │
//  │              ▪▪                            │
//  │  1  ·  ·  ·  2  ·  ·  ·  3  ·  ·  ·  4   │  ← beat grid
//  └────────────────────────────────────────────┘
// ═══════════════════════════════════════════════════════════════

import { useMemo } from 'react'

// ── Music theory (subset from PianoRoll.tsx) ──

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

const SCALE_INTERVALS: Record<string, number[]> = {
  'major': [0, 2, 4, 5, 7, 9, 11], 'minor': [0, 2, 3, 5, 7, 8, 10],
  'harmonic minor': [0, 2, 3, 5, 7, 8, 11], 'major pentatonic': [0, 2, 4, 7, 9],
  'minor pentatonic': [0, 3, 5, 7, 10], 'blues': [0, 3, 5, 6, 7, 10],
  'dorian': [0, 2, 3, 5, 7, 9, 10], 'phrygian': [0, 1, 3, 5, 7, 8, 10],
  'lydian': [0, 2, 4, 6, 7, 9, 11], 'mixolydian': [0, 2, 4, 5, 7, 9, 10],
  'chromatic': [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  'whole tone': [0, 2, 4, 6, 8, 10], 'diminished': [0, 2, 3, 5, 6, 8, 9, 11],
}

function parseScale(s: string) {
  const m = s.match(/^([A-G]#?)(\d+):(.+)$/)
  if (!m) return { root: 'C', octave: 4, mode: 'major' }
  return { root: m[1], octave: parseInt(m[2]), mode: m[3] }
}

function isScaleDegreePattern(pattern: string): boolean {
  const clean = pattern.replace(/[<>\[\],~*\s.\-]/g, '')
  if (!clean) return false
  return !/[a-g]/i.test(clean) && /\d/.test(clean)
}

function scaleDegreeToMidi(degree: number, scaleStr: string): number {
  const { root, octave, mode } = parseScale(scaleStr)
  const intervals = SCALE_INTERVALS[mode] || SCALE_INTERVALS['major']
  const rootIdx = NOTE_NAMES.indexOf(root)
  if (rootIdx < 0) return 60
  const baseMidi = (octave + 1) * 12 + rootIdx
  const scaleLen = intervals.length
  const octShift = degree >= 0 ? Math.floor(degree / scaleLen) : Math.ceil(degree / scaleLen) - (degree % scaleLen === 0 ? 0 : 1)
  const degInScale = ((degree % scaleLen) + scaleLen) % scaleLen
  return baseMidi + octShift * 12 + (intervals[degInScale] ?? 0)
}

function noteNameToMidi(name: string): number {
  const m = name.match(/^([a-g])([sb#]?)(\d+)$/i)
  if (!m) return -1
  const map: Record<string, number> = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 }
  let base = map[m[1].toLowerCase()]
  if (base === undefined) return -1
  if (m[2] === 's' || m[2] === '#') base++
  else if (m[2] === 'b') base--
  return (parseInt(m[3]) + 1) * 12 + base
}

// ── Mini-notation parser (matches PianoRoll logic) ──

interface MiniNote { midi: number; step: number; duration: number }

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

function resolveToMidi(token: string, usesDegrees: boolean, scale: string): number {
  token = token.trim()
  if (!token || token === '~') return -1
  if (usesDegrees) { const num = parseInt(token, 10); return isNaN(num) ? -1 : scaleDegreeToMidi(num, scale) }
  return noteNameToMidi(token)
}

function parseEntryToNotes(
  entry: string, gridPos: number, cellsAvailable: number, duration: number,
  usesDegrees: boolean, scale: string, notes: MiniNote[],
): void {
  entry = entry.trim()
  if (!entry || entry === '~') return
  const repMatch = entry.match(/^(.+?)\*(\d+)$/)
  if (repMatch && !repMatch[1].startsWith('[')) {
    const base = repMatch[1], times = parseInt(repMatch[2])
    const subCells = Math.max(1, Math.floor(cellsAvailable / times))
    for (let i = 0; i < times; i++) parseEntryToNotes(base, gridPos + i * subCells, subCells, subCells, usesDegrees, scale, notes)
    return
  }
  if (entry.startsWith('[') && entry.endsWith(']')) {
    const inner = entry.slice(1, -1).trim()
    if (inner.includes(',')) {
      for (const part of inner.split(',')) {
        const midi = resolveToMidi(part.trim(), usesDegrees, scale)
        if (midi >= 0 && midi <= 127) notes.push({ midi, step: gridPos, duration })
      }
      return
    }
    const subs = inner.split(/\s+/).filter(Boolean)
    const subCells = Math.max(1, Math.floor(cellsAvailable / subs.length))
    subs.forEach((sub, i) => parseEntryToNotes(sub, gridPos + i * subCells, subCells, subCells, usesDegrees, scale, notes))
    return
  }
  const midi = resolveToMidi(entry, usesDegrees, scale)
  if (midi >= 0 && midi <= 127) notes.push({ midi, step: gridPos, duration })
}

function parsePattern(pattern: string, scale: string): MiniNote[] {
  if (!pattern) return []
  const notes: MiniNote[] = []
  const trimmed = pattern.trim()
  const isBarLevel = trimmed.startsWith('<') && trimmed.endsWith('>')
  const usesDegrees = isScaleDegreePattern(trimmed)
  let clean = trimmed.replace(/^<\s*/, '').replace(/\s*>$/, '').trim()
  if (!clean) return notes
  const entries = splitTopLevel(clean)
  if (entries.length === 0) return notes
  const cellsPerEntry = isBarLevel ? 16 : Math.max(1, Math.floor(16 / entries.length))
  const entryDuration = isBarLevel ? 16 : cellsPerEntry
  entries.forEach((entry, idx) => {
    parseEntryToNotes(entry, idx * cellsPerEntry, cellsPerEntry, entryDuration, usesDegrees, scale, notes)
  })
  return notes
}

// ═══════════════════════════════════════════════════════════════
//  COMPONENT
// ═══════════════════════════════════════════════════════════════

interface MiniPianoRollProps {
  pattern: string
  scale: string
  color: string
  onClick?: () => void
  height?: number
}

export default function MiniPianoRoll({ pattern, scale, color, onClick, height = 32 }: MiniPianoRollProps) {
  const notes = useMemo(() => parsePattern(pattern, scale), [pattern, scale])

  const { minMidi, maxMidi, totalSteps } = useMemo(() => {
    if (notes.length === 0) return { minMidi: 60, maxMidi: 72, totalSteps: 16 }
    const midis = notes.map(n => n.midi)
    const min = Math.min(...midis)
    const max = Math.max(...midis)
    const maxStep = Math.max(...notes.map(n => n.step + n.duration))
    // Pad range by 2 semitones each side for visual breathing room
    return {
      minMidi: min - 2,
      maxMidi: max + 2,
      totalSteps: Math.max(16, Math.ceil(maxStep / 16) * 16),
    }
  }, [notes])

  const midiRange = Math.max(1, maxMidi - minMidi)

  if (notes.length === 0) {
    return (
      <div
        onClick={onClick}
        className="flex items-center justify-center rounded cursor-pointer transition-all hover:brightness-125"
        style={{ height, background: `${color}06`, border: `1px solid ${color}12` }}
      >
        <span className="text-[7px] italic" style={{ color: `${color}30` }}>empty — click to edit</span>
      </div>
    )
  }

  return (
    <div
      onClick={onClick}
      className="relative rounded cursor-pointer transition-all hover:brightness-125 overflow-hidden group"
      style={{
        height,
        background: '#0a0a0c',
        border: `1px solid ${color}15`,
      }}
    >
      {/* Beat grid lines */}
      {Array.from({ length: Math.floor(totalSteps / 4) }, (_, i) => {
        const x = ((i * 4) / totalSteps) * 100
        const isBar = i % 4 === 0
        return (
          <div key={i} className="absolute top-0 bottom-0" style={{
            left: `${x}%`,
            width: 1,
            background: isBar ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.04)',
          }} />
        )
      })}

      {/* Note bars */}
      {notes.map((note, i) => {
        const x = (note.step / totalSteps) * 100
        const w = Math.max(0.5, (note.duration / totalSteps) * 100)
        // Invert Y: higher MIDI = higher visually
        const y = ((maxMidi - note.midi) / midiRange) * 100
        const noteH = Math.max(4, (1 / midiRange) * 100 * 1.2)
        return (
          <div key={i} className="absolute rounded-[1px]" style={{
            left: `${x}%`,
            width: `${w}%`,
            top: `${y}%`,
            height: `${noteH}%`,
            minHeight: 2,
            minWidth: 2,
            background: color,
            opacity: 0.75,
            boxShadow: `0 0 3px ${color}40`,
          }} />
        )
      })}

      {/* Hover overlay */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
        style={{ background: `${color}08` }}>
        <span className="text-[7px] font-bold tracking-wider" style={{ color: `${color}90`, textShadow: '0 0 4px rgba(0,0,0,0.8)' }}>
          🎹 EDIT
        </span>
      </div>
    </div>
  )
}
