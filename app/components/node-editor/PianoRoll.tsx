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

function midiToNoteName(midi: number): string {
  const name = NOTE_NAMES[midi % 12]
  const oct = Math.floor(midi / 12) - 1
  return `${name.toLowerCase().replace('#', 's')}${oct}`
}

function getScaleNotes(scaleStr: string, octaveRange: [number, number] = [3, 6]): number[] {
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

/** Convert MIDI note number to frequency (Hz) */
function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12)
}

// ═══════════════════════════════════════════════════════════════
//  AUDIO PREVIEW — play notes when clicked in the piano roll
// ═══════════════════════════════════════════════════════════════

let audioCtx: AudioContext | null = null
let activeOscs: OscillatorNode[] = []

function playNotePreview(midi: number, durationMs = 200) {
  if (!audioCtx) audioCtx = new AudioContext()
  if (audioCtx.state === 'suspended') audioCtx.resume()

  const osc = audioCtx.createOscillator()
  const gain = audioCtx.createGain()
  osc.type = 'triangle'
  osc.frequency.value = midiToFreq(midi)
  gain.gain.setValueAtTime(0.15, audioCtx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + durationMs / 1000)
  osc.connect(gain).connect(audioCtx.destination)
  osc.start()
  osc.stop(audioCtx.currentTime + durationMs / 1000 + 0.05)
  activeOscs.push(osc)
  osc.onended = () => { activeOscs = activeOscs.filter(o => o !== osc) }
}

// ═══════════════════════════════════════════════════════════════
//  PIANO ROLL — BOTTOM DOCK PANEL
//
//  Slides up from the bottom of the node editor. Users can
//  interact with other panels while it's open.
// ═══════════════════════════════════════════════════════════════

interface PianoRollNote {
  midi: number
  step: number
  duration: number
  velocity: number
}

interface PianoRollProps {
  isOpen: boolean
  onClose: () => void
  scale: string
  currentPattern: string
  nodeType: 'melody' | 'chords' | 'bass' | 'pad' | 'vocal' | 'other'
  nodeColor: string
  onPatternChange: (newPattern: string) => void
}

const CELL_W = 32
const CELL_H = 16
const PIANO_KEY_W = 52
const TOTAL_STEPS = 16
const DOCK_HEIGHT = 320

export default function PianoRoll({ isOpen, onClose, scale, currentPattern, nodeType, nodeColor, onPatternChange }: PianoRollProps) {
  const [notes, setNotes] = useState<PianoRollNote[]>([])
  const [tool, setTool] = useState<'draw' | 'erase'>('draw')
  const scrollRef = useRef<HTMLDivElement>(null)
  const isDrawing = useRef(false)

  // Audible octave ranges — raised for better audibility
  const octaveRange: [number, number] = useMemo(() => {
    switch (nodeType) {
      case 'bass': return [2, 4]
      case 'pad': return [3, 5]
      case 'chords': return [3, 5]
      case 'vocal': return [3, 5]
      default: return [4, 6]
    }
  }, [nodeType])

  const scaleNotes = useMemo(() => getScaleNotes(scale, octaveRange), [scale, octaveRange])
  const allMidiNotes = useMemo(() => {
    const result: number[] = []
    for (let midi = (octaveRange[1] + 1) * 12 + 11; midi >= (octaveRange[0] + 1) * 12; midi--) {
      result.push(midi)
    }
    return result
  }, [octaveRange])

  const scaleNoteSet = useMemo(() => new Set(scaleNotes), [scaleNotes])

  useEffect(() => {
    if (!isOpen) return
    const parsed = parsePatternToNotes(currentPattern, scale, octaveRange)
    setNotes(parsed)
  }, [isOpen, currentPattern, scale, octaveRange])

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
        playNotePreview(midi, 180)
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

  const handleKeyClick = useCallback((midi: number) => {
    playNotePreview(midi, 350)
  }, [])

  const generatePattern = useCallback(() => {
    if (notes.length === 0) {
      onPatternChange('~ ~ ~ ~')
      return
    }

    const stepMap = new Map<number, number[]>()
    for (const note of notes) {
      const arr = stepMap.get(note.step) || []
      arr.push(note.midi)
      stepMap.set(note.step, arr)
    }

    const parts: string[] = []
    for (let step = 0; step < TOTAL_STEPS; step++) {
      const midiNotes = stepMap.get(step)
      if (!midiNotes || midiNotes.length === 0) {
        parts.push('~')
      } else if (midiNotes.length === 1) {
        parts.push(midiToNoteName(midiNotes[0]))
      } else {
        parts.push(`[${midiNotes.map(m => midiToNoteName(m)).join(',')}]`)
      }
    }

    if (nodeType === 'chords') {
      onPatternChange(`<${parts.join(' ')}>`)
    } else {
      onPatternChange(parts.join(' '))
    }
  }, [notes, nodeType, onPatternChange])

  const clearAll = useCallback(() => setNotes([]), [])

  if (!isOpen) return null

  const gridW = TOTAL_STEPS * CELL_W
  const gridH = allMidiNotes.length * CELL_H

  return (
    <div
      className="absolute bottom-0 left-0 right-0 z-[100] flex flex-col"
      style={{
        height: DOCK_HEIGHT,
        background: '#08080a',
        borderTop: `2px solid ${nodeColor}40`,
        boxShadow: `0 -4px 30px rgba(0,0,0,0.6), inset 0 1px 0 ${nodeColor}15`,
      }}
      onMouseUp={handleMouseUp}
      onClick={e => e.stopPropagation()}
    >
      {/* ═══ HEADER BAR ═══ */}
      <div className="flex items-center justify-between px-3 py-1.5 shrink-0"
        style={{ borderBottom: `1px solid rgba(255,255,255,0.05)`, background: `${nodeColor}06` }}>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold tracking-[0.15em] uppercase" style={{ color: nodeColor }}>
            🎹 PIANO ROLL
          </span>
          <span className="text-[8px] px-1.5 py-0.5 rounded" style={{ color: '#666', background: '#1a1a1e' }}>
            {scale} · {TOTAL_STEPS} steps
          </span>
          <span className="text-[7px] px-1 py-0.5 rounded" style={{
            color: nodeColor, background: `${nodeColor}12`, border: `1px solid ${nodeColor}20`
          }}>
            {notes.length} note{notes.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="flex gap-px mr-2">
            {scaleNotes.slice(0, 12).map((midi, i) => (
              <span key={i} className="px-1 py-[1px] rounded text-[6px] font-bold"
                style={{ background: `${nodeColor}10`, color: `${nodeColor}aa` }}>
                {NOTE_NAMES[midi % 12]}
              </span>
            ))}
          </div>
          <button onClick={() => setTool('draw')}
            className="px-2 py-0.5 rounded text-[8px] font-bold cursor-pointer"
            style={{
              background: tool === 'draw' ? `${nodeColor}18` : '#151518',
              color: tool === 'draw' ? nodeColor : '#555',
              border: `1px solid ${tool === 'draw' ? `${nodeColor}35` : 'rgba(255,255,255,0.04)'}`,
            }}>
            ✏ Draw
          </button>
          <button onClick={() => setTool('erase')}
            className="px-2 py-0.5 rounded text-[8px] font-bold cursor-pointer"
            style={{
              background: tool === 'erase' ? '#ef44441a' : '#151518',
              color: tool === 'erase' ? '#ef4444' : '#555',
              border: `1px solid ${tool === 'erase' ? '#ef444435' : 'rgba(255,255,255,0.04)'}`,
            }}>
            🗑 Erase
          </button>
          <div style={{ width: 1, height: 14, background: 'rgba(255,255,255,0.04)' }} />
          <button onClick={clearAll}
            className="px-2 py-0.5 rounded text-[8px] font-bold cursor-pointer"
            style={{ background: '#151518', color: '#555', border: '1px solid rgba(255,255,255,0.04)' }}>
            Clear
          </button>
          <button onClick={generatePattern}
            className="px-2.5 py-0.5 rounded text-[8px] font-bold cursor-pointer"
            style={{ background: `${nodeColor}18`, color: nodeColor, border: `1px solid ${nodeColor}35` }}>
            ✓ Apply
          </button>
          <button onClick={onClose}
            className="px-1.5 py-0.5 rounded text-[9px] cursor-pointer ml-1"
            style={{ color: '#555', background: '#151518', border: '1px solid rgba(255,255,255,0.04)' }}>
            ▼
          </button>
        </div>
      </div>

      {/* ═══ STEP NUMBERS ═══ */}
      <div className="flex shrink-0" style={{ marginLeft: PIANO_KEY_W }}>
        {Array.from({ length: TOTAL_STEPS }, (_, i) => (
          <div key={i} className="flex items-center justify-center text-[7px] font-mono"
            style={{
              width: CELL_W, height: 16,
              color: i % 4 === 0 ? '#666' : '#2a2a2a',
              background: i % 4 === 0 ? 'rgba(255,255,255,0.015)' : 'transparent',
              borderRight: '1px solid rgba(255,255,255,0.025)',
            }}>
            {i + 1}
          </div>
        ))}
      </div>

      {/* ═══ GRID AREA ═══ */}
      <div ref={scrollRef} className="flex-1 overflow-auto relative"
        style={{ scrollbarWidth: 'thin', scrollbarColor: `${nodeColor}25 transparent` }}>
        <div style={{ display: 'flex', width: PIANO_KEY_W + gridW, minHeight: gridH }}>

          {/* Piano keys column */}
          <div className="sticky left-0 z-10 shrink-0" style={{ width: PIANO_KEY_W }}>
            {allMidiNotes.map(midi => {
              const black = isBlackKey(midi)
              const inScale = scaleNoteSet.has(midi)
              const noteName = NOTE_NAMES[midi % 12]
              const octave = Math.floor(midi / 12) - 1
              const isC = midi % 12 === 0

              return (
                <div key={midi}
                  className="flex items-center justify-end pr-1.5 cursor-pointer hover:brightness-125 transition-all"
                  style={{
                    height: CELL_H,
                    background: black ? '#0c0c0f' : '#141418',
                    borderBottom: `1px solid ${isC ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.015)'}`,
                    borderRight: '1px solid rgba(255,255,255,0.05)',
                  }}
                  onMouseDown={() => handleKeyClick(midi)}
                >
                  <span className="text-[7px] font-mono select-none" style={{
                    color: inScale ? nodeColor : (black ? '#2a2a2a' : '#3a3a3a'),
                    fontWeight: inScale ? 700 : 400,
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
              const black = isBlackKey(midi)
              const inScale = scaleNoteSet.has(midi)
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
                            : inScale
                              ? (isBeat ? `${nodeColor}06` : `${nodeColor}03`)
                              : (black ? '#090909' : (isBeat ? 'rgba(255,255,255,0.015)' : 'transparent')),
                          borderRight: `1px solid ${isBeat ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.015)'}`,
                          borderBottom: `1px solid ${isC ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.015)'}`,
                          boxShadow: hasNote ? `inset 0 0 6px ${nodeColor}50, 0 0 2px ${nodeColor}30` : 'none',
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
