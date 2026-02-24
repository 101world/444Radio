'use client'

import { useState, useCallback, useMemo, useRef, useEffect } from 'react'

// ═══════════════════════════════════════════════════════════════
//  MUSIC THEORY — key-aware note generation
// ═══════════════════════════════════════════════════════════════

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

const SCALE_INTERVALS: Record<string, number[]> = {
  'major':            [0, 2, 4, 5, 7, 9, 11],
  'minor':            [0, 2, 3, 5, 7, 8, 10],
  'harmonic minor':   [0, 2, 3, 5, 7, 8, 11],
  'major pentatonic': [0, 2, 4, 7, 9],
  'minor pentatonic': [0, 3, 5, 7, 10],
  'blues':            [0, 3, 5, 6, 7, 10],
  'dorian':           [0, 2, 3, 5, 7, 9, 10],
  'phrygian':         [0, 1, 3, 5, 7, 8, 10],
  'lydian':           [0, 2, 4, 6, 7, 9, 11],
  'mixolydian':       [0, 2, 4, 5, 7, 9, 10],
  'chromatic':        [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  'whole tone':       [0, 2, 4, 6, 8, 10],
  'diminished':       [0, 2, 3, 5, 6, 8, 9, 11],
}

function parseScale(scaleStr: string): { root: string; octave: number; mode: string } {
  const m = scaleStr.match(/^([A-G]#?)(\d+):(.+)$/)
  if (!m) return { root: 'C', octave: 4, mode: 'major' }
  return { root: m[1], octave: parseInt(m[2]), mode: m[3] }
}

function noteNameToMidi(name: string, octave: number): number {
  const idx = NOTE_NAMES.indexOf(name)
  return idx >= 0 ? (octave + 1) * 12 + idx : 60
}

function midiToNoteName(midi: number): string {
  const name = NOTE_NAMES[midi % 12]
  const oct = Math.floor(midi / 12) - 1
  return `${name.toLowerCase().replace('#', 's')}${oct}`
}

function getScaleNotes(scaleStr: string, octaveRange: [number, number] = [2, 6]): number[] {
  const { root, mode } = parseScale(scaleStr)
  const intervals = SCALE_INTERVALS[mode] || SCALE_INTERVALS['major']
  const rootIdx = NOTE_NAMES.indexOf(root)
  if (rootIdx < 0) return []

  const notes: number[] = []
  for (let oct = octaveRange[0]; oct <= octaveRange[1]; oct++) {
    for (const interval of intervals) {
      const midi = (oct + 1) * 12 + rootIdx + interval
      if (midi >= (octaveRange[0] + 1) * 12 && midi <= (octaveRange[1] + 1) * 12 + 11) {
        notes.push(midi)
      }
    }
  }
  return notes
}

function isBlackKey(midi: number): boolean {
  return [1, 3, 6, 8, 10].includes(midi % 12)
}

// ═══════════════════════════════════════════════════════════════
//  PIANO ROLL COMPONENT
// ═══════════════════════════════════════════════════════════════

interface PianoRollNote {
  midi: number
  step: number    // which beat/step (0-indexed)
  duration: number // in steps
  velocity: number
}

interface PianoRollProps {
  isOpen: boolean
  onClose: () => void
  scale: string         // e.g. "C4:major"
  currentPattern: string // current pattern from node
  nodeType: 'melody' | 'chords' | 'bass' | 'pad' | 'vocal' | 'other'
  nodeColor: string
  onPatternChange: (newPattern: string) => void
}

const CELL_W = 28
const CELL_H = 14
const PIANO_KEY_W = 48
const TOTAL_STEPS = 16

export default function PianoRoll({ isOpen, onClose, scale, currentPattern, nodeType, nodeColor, onPatternChange }: PianoRollProps) {
  const [notes, setNotes] = useState<PianoRollNote[]>([])
  const [tool, setTool] = useState<'draw' | 'erase'>('draw')
  const scrollRef = useRef<HTMLDivElement>(null)
  const isDrawing = useRef(false)

  // Get the full range of MIDI notes available in this scale
  const octaveRange: [number, number] = useMemo(() => {
    switch (nodeType) {
      case 'bass': return [1, 3]
      case 'pad': return [2, 5]
      case 'chords': return [2, 5]
      default: return [3, 6]
    }
  }, [nodeType])

  const scaleNotes = useMemo(() => getScaleNotes(scale, octaveRange), [scale, octaveRange])
  // For the grid, show ALL chromatic notes in range but highlight scale notes
  const allMidiNotes = useMemo(() => {
    const notes: number[] = []
    for (let midi = (octaveRange[1] + 1) * 12 + 11; midi >= (octaveRange[0] + 1) * 12; midi--) {
      notes.push(midi)
    }
    return notes
  }, [octaveRange])

  const scaleNoteSet = useMemo(() => new Set(scaleNotes), [scaleNotes])

  // Parse existing pattern into notes on mount
  useEffect(() => {
    if (!isOpen) return
    const parsed = parsePatternToNotes(currentPattern, scale, octaveRange)
    setNotes(parsed)
  }, [isOpen, currentPattern, scale, octaveRange])

  // Auto-scroll to middle range
  useEffect(() => {
    if (isOpen && scrollRef.current) {
      const middleRow = Math.floor(allMidiNotes.length / 2)
      scrollRef.current.scrollTop = middleRow * CELL_H - scrollRef.current.clientHeight / 2
    }
  }, [isOpen, allMidiNotes.length])

  const toggleNote = useCallback((midi: number, step: number) => {
    setNotes(prev => {
      const existing = prev.findIndex(n => n.midi === midi && n.step === step)
      if (existing >= 0) {
        return prev.filter((_, i) => i !== existing)
      } else {
        return [...prev, { midi, step, duration: 1, velocity: 0.8 }]
      }
    })
  }, [])

  const handleCellMouseDown = useCallback((midi: number, step: number) => {
    isDrawing.current = true
    toggleNote(midi, step)
  }, [toggleNote])

  const handleCellMouseEnter = useCallback((midi: number, step: number) => {
    if (!isDrawing.current) return
    toggleNote(midi, step)
  }, [toggleNote])

  const handleMouseUp = useCallback(() => {
    isDrawing.current = false
  }, [])

  // Convert notes to a Strudel pattern string
  const generatePattern = useCallback(() => {
    if (notes.length === 0) {
      onPatternChange('~ ~ ~ ~')
      onClose()
      return
    }

    // Group notes by step
    const stepMap = new Map<number, number[]>()
    for (const note of notes) {
      const arr = stepMap.get(note.step) || []
      arr.push(note.midi)
      stepMap.set(note.step, arr)
    }

    // Build Strudel pattern
    const parts: string[] = []
    for (let step = 0; step < TOTAL_STEPS; step++) {
      const midiNotes = stepMap.get(step)
      if (!midiNotes || midiNotes.length === 0) {
        parts.push('~')
      } else if (midiNotes.length === 1) {
        parts.push(midiToNoteName(midiNotes[0]))
      } else {
        // Chord: [note1,note2,note3]
        parts.push(`[${midiNotes.map(m => midiToNoteName(m)).join(',')}]`)
      }
    }

    // For chords, wrap in < > for one-per-cycle behavior
    if (nodeType === 'chords') {
      onPatternChange(`<${parts.join(' ')}>`)
    } else {
      onPatternChange(parts.join(' '))
    }
    onClose()
  }, [notes, nodeType, onPatternChange, onClose])

  const clearAll = useCallback(() => setNotes([]), [])

  if (!isOpen) return null

  const gridW = TOTAL_STEPS * CELL_W
  const gridH = allMidiNotes.length * CELL_H

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.85)' }}
      onMouseUp={handleMouseUp}>
      <div className="flex flex-col rounded-xl shadow-2xl overflow-hidden"
        style={{
          width: Math.min(900, PIANO_KEY_W + gridW + 40),
          maxWidth: '95vw',
          maxHeight: '85vh',
          background: '#0a0a0c',
          border: `1px solid ${nodeColor}30`,
        }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2"
          style={{ borderBottom: `1px solid rgba(255,255,255,0.05)`, background: `${nodeColor}08` }}>
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-bold tracking-[0.15em] uppercase" style={{ color: nodeColor }}>
              🎹 PIANO ROLL
            </span>
            <span className="text-[9px] px-2 py-0.5 rounded" style={{ color: '#777', background: '#1a1a1e' }}>
              {scale} · {TOTAL_STEPS} steps
            </span>
            <span className="text-[8px] px-1.5 py-0.5 rounded" style={{
              color: nodeColor, background: `${nodeColor}15`, border: `1px solid ${nodeColor}25`
            }}>
              {notes.length} note{notes.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {/* Tool buttons */}
            <button onClick={() => setTool('draw')}
              className="px-2 py-1 rounded text-[9px] font-bold cursor-pointer"
              style={{
                background: tool === 'draw' ? `${nodeColor}20` : '#1a1a1e',
                color: tool === 'draw' ? nodeColor : '#777',
                border: `1px solid ${tool === 'draw' ? `${nodeColor}40` : 'rgba(255,255,255,0.05)'}`,
              }}>
              ✏️ Draw
            </button>
            <button onClick={() => setTool('erase')}
              className="px-2 py-1 rounded text-[9px] font-bold cursor-pointer"
              style={{
                background: tool === 'erase' ? '#ef444420' : '#1a1a1e',
                color: tool === 'erase' ? '#ef4444' : '#777',
                border: `1px solid ${tool === 'erase' ? '#ef444440' : 'rgba(255,255,255,0.05)'}`,
              }}>
              🗑️ Erase
            </button>
            <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.05)' }} />
            <button onClick={clearAll}
              className="px-2 py-1 rounded text-[9px] font-bold cursor-pointer"
              style={{ background: '#1a1a1e', color: '#777', border: '1px solid rgba(255,255,255,0.05)' }}>
              Clear
            </button>
            <button onClick={generatePattern}
              className="px-3 py-1 rounded text-[9px] font-bold cursor-pointer"
              style={{ background: `${nodeColor}20`, color: nodeColor, border: `1px solid ${nodeColor}40` }}>
              ✓ Apply
            </button>
            <button onClick={onClose}
              className="px-2 py-1 rounded text-[9px] cursor-pointer"
              style={{ color: '#777', background: '#1a1a1e', border: '1px solid rgba(255,255,255,0.05)' }}>
              ✕
            </button>
          </div>
        </div>

        {/* Scale note indicator */}
        <div className="flex items-center gap-1 px-4 py-1" style={{ background: '#0e0e11', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
          <span className="text-[7px] font-bold uppercase tracking-wider" style={{ color: '#444' }}>Scale notes:</span>
          <div className="flex gap-[2px]">
            {scaleNotes.slice(0, 12).map((midi, i) => (
              <span key={i} className="px-1 py-[1px] rounded text-[7px] font-bold"
                style={{ background: `${nodeColor}12`, color: `${nodeColor}cc` }}>
                {NOTE_NAMES[midi % 12]}
              </span>
            ))}
          </div>
        </div>

        {/* Step numbers header */}
        <div className="flex" style={{ marginLeft: PIANO_KEY_W, paddingRight: 16 }}>
          {Array.from({ length: TOTAL_STEPS }, (_, i) => (
            <div key={i} className="flex items-center justify-center text-[7px] font-mono"
              style={{
                width: CELL_W, height: 18,
                color: i % 4 === 0 ? '#777' : '#333',
                background: i % 4 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent',
                borderRight: '1px solid rgba(255,255,255,0.03)',
              }}>
              {i + 1}
            </div>
          ))}
        </div>

        {/* Grid area */}
        <div ref={scrollRef} className="flex-1 overflow-auto relative"
          style={{ scrollbarWidth: 'thin', scrollbarColor: `${nodeColor}30 transparent` }}>
          <div style={{ display: 'flex', width: PIANO_KEY_W + gridW, minHeight: gridH }}>

            {/* Piano keys column */}
            <div className="sticky left-0 z-10 shrink-0" style={{ width: PIANO_KEY_W }}>
              {allMidiNotes.map(midi => {
                const isBlack = isBlackKey(midi)
                const isInScale = scaleNoteSet.has(midi)
                const noteName = NOTE_NAMES[midi % 12]
                const octave = Math.floor(midi / 12) - 1
                const isC = midi % 12 === 0

                return (
                  <div key={midi} className="flex items-center justify-end pr-1"
                    style={{
                      height: CELL_H,
                      background: isBlack ? '#0e0e11' : '#16161a',
                      borderBottom: `1px solid ${isC ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.02)'}`,
                      borderRight: '1px solid rgba(255,255,255,0.06)',
                    }}>
                    <span className="text-[7px] font-mono" style={{
                      color: isInScale ? nodeColor : (isBlack ? '#333' : '#444'),
                      fontWeight: isInScale ? 700 : 400,
                    }}>
                      {noteName}{octave}
                    </span>
                  </div>
                )
              })}
            </div>

            {/* Note grid */}
            <div style={{ width: gridW }}>
              {allMidiNotes.map(midi => {
                const isBlack = isBlackKey(midi)
                const isInScale = scaleNoteSet.has(midi)
                const isC = midi % 12 === 0

                return (
                  <div key={midi} className="flex" style={{ height: CELL_H }}>
                    {Array.from({ length: TOTAL_STEPS }, (_, step) => {
                      const hasNote = notes.some(n => n.midi === midi && n.step === step)
                      const isBeat = step % 4 === 0

                      return (
                        <div key={step}
                          className="cursor-pointer transition-colors"
                          style={{
                            width: CELL_W,
                            height: CELL_H,
                            background: hasNote
                              ? `${nodeColor}cc`
                              : isInScale
                                ? (isBeat ? `${nodeColor}08` : `${nodeColor}04`)
                                : (isBlack ? '#0a0a0c' : (isBeat ? 'rgba(255,255,255,0.02)' : 'transparent')),
                            borderRight: `1px solid ${isBeat ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.02)'}`,
                            borderBottom: `1px solid ${isC ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.02)'}`,
                            boxShadow: hasNote ? `inset 0 0 4px ${nodeColor}40` : 'none',
                            borderRadius: hasNote ? 2 : 0,
                          }}
                          onMouseDown={() => handleCellMouseDown(midi, step)}
                          onMouseEnter={() => handleCellMouseEnter(midi, step)}
                        />
                      )
                    })}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-1.5"
          style={{ borderTop: '1px solid rgba(255,255,255,0.05)', background: '#0e0e11' }}>
          <span className="text-[8px]" style={{ color: '#444' }}>
            Click to place notes · Highlighted rows = in-scale · Pattern outputs as Strudel note()
          </span>
          <span className="text-[8px] font-mono" style={{ color: `${nodeColor}60` }}>
            {nodeType} · {scale}
          </span>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
//  PATTERN PARSER — converts Strudel pattern to MIDI notes
// ═══════════════════════════════════════════════════════════════

function parsePatternToNotes(pattern: string, scale: string, octaveRange: [number, number]): PianoRollNote[] {
  if (!pattern) return []
  const notes: PianoRollNote[] = []

  // Remove < > wrappers
  let clean = pattern.replace(/^<\s*/, '').replace(/\s*>$/, '').trim()
  if (!clean) return notes

  // Split into steps by space (respecting brackets)
  const steps: string[] = []
  let depth = 0
  let current = ''
  for (const ch of clean) {
    if (ch === '[') depth++
    if (ch === ']') depth--
    if (ch === ' ' && depth === 0) {
      if (current.trim()) steps.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }
  if (current.trim()) steps.push(current.trim())

  steps.forEach((step, idx) => {
    if (step === '~') return

    // Handle chord [note1,note2,...]
    if (step.startsWith('[') && step.endsWith(']')) {
      const inner = step.slice(1, -1)
      const chordNotes = inner.split(',').map(s => s.trim())
      for (const noteName of chordNotes) {
        const midi = noteNameToMidiFromStrudel(noteName)
        if (midi >= 0) {
          notes.push({ midi, step: idx, duration: 1, velocity: 0.8 })
        }
      }
    } else {
      // Single note or scale degree
      const midi = noteNameToMidiFromStrudel(step)
      if (midi >= 0) {
        notes.push({ midi, step: idx, duration: 1, velocity: 0.8 })
      }
    }
  })

  return notes
}

function noteNameToMidiFromStrudel(name: string): number {
  // Handle note names like c3, fs3, eb4, gs2, etc.
  const m = name.match(/^([a-g])([sb#]?)(\d+)$/i)
  if (!m) return -1

  const noteMap: Record<string, number> = {
    'c': 0, 'd': 2, 'e': 4, 'f': 5, 'g': 7, 'a': 9, 'b': 11,
  }
  let base = noteMap[m[1].toLowerCase()]
  if (base === undefined) return -1

  if (m[2] === 's' || m[2] === '#') base++
  else if (m[2] === 'b') base--

  const octave = parseInt(m[3])
  return (octave + 1) * 12 + base
}
