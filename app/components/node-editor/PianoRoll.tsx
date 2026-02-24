'use client'

import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import {
  ALL_PRESETS, PRESET_CATEGORY_META, getPresetsForType, searchPresets,
  type MusicalPreset, type PresetStep, type PresetCategory,
} from './PianoRollPresets'

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

function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12)
}

// ═══════════════════════════════════════════════════════════════
//  AUDIO PREVIEW
// ═══════════════════════════════════════════════════════════════

let audioCtx: AudioContext | null = null
let activeOscs: OscillatorNode[] = []

function soundToOscType(sound: string): OscillatorType {
  const s = sound.toLowerCase()
  if (s === 'sine') return 'sine'
  if (s === 'sawtooth' || s === 'saw') return 'sawtooth'
  if (s === 'square') return 'square'
  if (s === 'triangle') return 'triangle'
  if (s.includes('bass') || s.includes('synth_bass')) return 'sawtooth'
  if (s.includes('organ') || s.includes('accordion')) return 'square'
  if (s.includes('string') || s.includes('violin') || s.includes('cello')) return 'sawtooth'
  if (s.includes('flute') || s.includes('whistle') || s.includes('ocarina')) return 'sine'
  if (s.includes('trumpet') || s.includes('brass') || s.includes('trombone')) return 'sawtooth'
  if (s.includes('piano') || s.includes('epiano') || s.includes('rhodes')) return 'triangle'
  if (s.includes('choir') || s.includes('voice') || s.includes('vocal')) return 'sine'
  if (s.includes('pad') || s.includes('sweep') || s.includes('halo')) return 'sine'
  if (s.includes('guitar')) return 'triangle'
  return 'triangle'
}

function playNotePreview(midi: number, durationMs = 200, sound = '') {
  if (!audioCtx) audioCtx = new AudioContext()
  if (audioCtx.state === 'suspended') audioCtx.resume()

  const osc = audioCtx.createOscillator()
  const gain = audioCtx.createGain()
  osc.type = sound ? soundToOscType(sound) : 'triangle'
  osc.frequency.value = midiToFreq(midi)

  // Nicer ADSR: quick attack → sustain → smooth release
  const now = audioCtx.currentTime
  const dur = durationMs / 1000
  gain.gain.setValueAtTime(0, now)
  gain.gain.linearRampToValueAtTime(0.12, now + 0.01)  // attack
  gain.gain.setValueAtTime(0.12, now + dur * 0.7)       // sustain
  gain.gain.exponentialRampToValueAtTime(0.001, now + dur) // release

  osc.connect(gain).connect(audioCtx.destination)
  osc.start()
  osc.stop(now + dur + 0.05)
  activeOscs.push(osc)
  osc.onended = () => { activeOscs = activeOscs.filter(o => o !== osc) }
}

// ═══════════════════════════════════════════════════════════════
//  PIANO ROLL — DAW-Style (modeled on Logic Pro / FL Studio)
//
//  Features:
//  - Variable note durations (drag right edge to resize)
//  - Velocity per note with visual feedback + velocity lane
//  - Snap grid: 1/4, 1/8, 1/16, off
//  - Zoom in/out (5 levels)
//  - Select tool with multi-select (shift-click)
//  - Keyboard shortcuts: D=Draw, E=Erase, S=Select, +/- zoom, Del
//  - 8-bar support
//  - Preset browser with visual categorization
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
  soundSource?: string
  onPatternChange: (newPattern: string) => void
}

const ZOOM_LEVELS = [
  { label: '50%',  cellW: 16, cellH: 10 },
  { label: '75%',  cellW: 24, cellH: 13 },
  { label: '100%', cellW: 32, cellH: 16 },
  { label: '125%', cellW: 40, cellH: 20 },
  { label: '150%', cellW: 48, cellH: 24 },
] as const

const PIANO_KEY_W = 48
const DOCK_HEIGHT = 420
const PRESET_PANEL_W = 200
const VELOCITY_LANE_H = 40

const SNAP_OPTIONS = [
  { label: '1/4',  value: 4,  desc: 'Quarter note' },
  { label: '1/8',  value: 2,  desc: 'Eighth note' },
  { label: '1/16', value: 1,  desc: 'Sixteenth note' },
  { label: 'Off',  value: 0,  desc: 'Free placement' },
] as const

const STEP_OPTIONS = [
  { label: '1 bar',  value: 16,  desc: '16 steps' },
  { label: '2 bars', value: 32,  desc: '32 steps' },
  { label: '4 bars', value: 64,  desc: '64 steps' },
  { label: '8 bars', value: 128, desc: '128 steps' },
] as const

/** Convert scale-degree presets to MIDI notes, respecting resolution */
function presetToNotes(
  preset: MusicalPreset,
  scaleStr: string,
  octaveRange: [number, number],
): PianoRollNote[] {
  const { root, mode } = parseScale(scaleStr)
  const intervals = SCALE_INTERVALS[mode] || SCALE_INTERVALS['major']
  const rootMidi = NOTE_NAMES.indexOf(root)
  if (rootMidi < 0) return []

  const centerOct = Math.floor((octaveRange[0] + octaveRange[1]) / 2)
  const baseOctMidi = (centerOct + 1) * 12 + rootMidi + (preset.octaveOffset ? preset.octaveOffset * 12 : 0)

  // Resolution → how many 16th-note grid cells per preset step
  const res = preset.resolution ?? 'sixteenth'
  const resFactor = res === 'bar' ? 16 : res === 'beat' ? 4 : 1

  function degreeToMidi(deg: number): number {
    const octShift = Math.floor(deg / 7)
    const degInScale = ((deg % 7) + 7) % 7
    const interval = intervals[degInScale % intervals.length] ?? 0
    return baseOctMidi + octShift * 12 + interval
  }

  const notes: PianoRollNote[] = []
  preset.steps.forEach((step, idx) => {
    if (step === null) return
    const gridPos = idx * resFactor
    if (Array.isArray(step)) {
      for (const deg of step) {
        const midi = degreeToMidi(deg)
        if (midi >= 0 && midi <= 127) notes.push({ midi, step: gridPos, duration: resFactor, velocity: 0.8 })
      }
    } else {
      const midi = degreeToMidi(step)
      if (midi >= 0 && midi <= 127) notes.push({ midi, step: gridPos, duration: resFactor, velocity: 0.8 })
    }
  })
  return notes
}

export default function PianoRoll({ isOpen, onClose, scale, currentPattern, nodeType, nodeColor, soundSource, onPatternChange }: PianoRollProps) {
  const [notes, setNotes] = useState<PianoRollNote[]>([])
  const [tool, setTool] = useState<'draw' | 'erase' | 'select'>('draw')
  const [totalSteps, setTotalSteps] = useState(16)
  const [zoomIdx, setZoomIdx] = useState(2)
  const [snapValue, setSnapValue] = useState(1)
  const [presetPanelOpen, setPresetPanelOpen] = useState(true)
  const [presetSearch, setPresetSearch] = useState('')
  const [presetCategory, setPresetCategory] = useState<PresetCategory | 'all'>('all')
  const [showVelocity, setShowVelocity] = useState(false)
  const [selectedNotes, setSelectedNotes] = useState<Set<string>>(new Set())
  const scrollRef = useRef<HTMLDivElement>(null)
  const isDrawing = useRef(false)
  const drawStartNote = useRef<{ midi: number; step: number } | null>(null)
  const resizingNote = useRef<{ midi: number; step: number } | null>(null)
  const lastDrawnCell = useRef<string | null>(null)

  const zoom = ZOOM_LEVELS[zoomIdx]
  const CELL_W = zoom.cellW
  const CELL_H = zoom.cellH

  const octaveRange: [number, number] = useMemo(() => {
    switch (nodeType) {
      case 'bass': return [2, 4]
      case 'pad': return [3, 5]
      case 'chords': return [3, 5]
      case 'vocal': return [3, 5]
      default: return [4, 6]
    }
  }, [nodeType])

  const filteredPresets = useMemo(() => {
    let results = presetSearch ? searchPresets(presetSearch, nodeType) : getPresetsForType(nodeType)
    if (presetCategory !== 'all') results = results.filter(p => p.category === presetCategory)
    return results
  }, [nodeType, presetSearch, presetCategory])

  const applyPreset = useCallback((preset: MusicalPreset) => {
    const pNotes = presetToNotes(preset, scale, octaveRange)
    setNotes(pNotes)
    setSelectedNotes(new Set())
    // Calculate actual grid cells needed based on resolution
    const res = preset.resolution ?? 'sixteenth'
    const resFactor = res === 'bar' ? 16 : res === 'beat' ? 4 : 1
    const neededSteps = preset.steps.length * resFactor
    // Snap to the nearest valid grid length (16/32/64/128)
    const newTotalSteps = neededSteps <= 16 ? 16 : neededSteps <= 32 ? 32 : neededSteps <= 64 ? 64 : 128
    setTotalSteps(newTotalSteps)
  }, [scale, octaveRange])

  const scaleNotes = useMemo(() => getScaleNotes(scale, octaveRange), [scale, octaveRange])
  const allMidiNotes = useMemo(() => {
    const result: number[] = []
    for (let midi = (octaveRange[1] + 1) * 12 + 11; midi >= (octaveRange[0] + 1) * 12; midi--) result.push(midi)
    return result
  }, [octaveRange])
  const scaleNoteSet = useMemo(() => new Set(scaleNotes), [scaleNotes])

  // O(1) note lookup map
  const noteMap = useMemo(() => {
    const map = new Map<string, PianoRollNote>()
    for (const n of notes) map.set(`${n.midi}:${n.step}`, n)
    return map
  }, [notes])

  const findNoteAtCell = useCallback((midi: number, step: number): PianoRollNote | undefined => {
    const direct = noteMap.get(`${midi}:${step}`)
    if (direct) return direct
    for (const n of notes) {
      if (n.midi === midi && step >= n.step && step < n.step + n.duration) return n
    }
    return undefined
  }, [noteMap, notes])

  useEffect(() => {
    if (!isOpen) return
    const parsed = parsePatternToNotes(currentPattern, scale, octaveRange)
    setNotes(parsed)
    setSelectedNotes(new Set())
    // Auto-size grid to fit all notes
    if (parsed.length > 0) {
      const maxEnd = Math.max(...parsed.map(n => n.step + n.duration))
      const needed = maxEnd <= 16 ? 16 : maxEnd <= 32 ? 32 : maxEnd <= 64 ? 64 : 128
      setTotalSteps(needed)
    }
  }, [isOpen, currentPattern, scale, octaveRange])

  useEffect(() => {
    if (isOpen && scrollRef.current) {
      const mid = Math.floor(allMidiNotes.length / 2)
      scrollRef.current.scrollTop = mid * CELL_H - scrollRef.current.clientHeight / 2
    }
  }, [isOpen, allMidiNotes.length, CELL_H])

  const nid = (midi: number, step: number) => `${midi}:${step}`

  const addNote = useCallback((midi: number, step: number) => {
    setNotes(prev => {
      if (prev.some(n => n.midi === midi && step >= n.step && step < n.step + n.duration)) return prev
      playNotePreview(midi, 180, soundSource)
      return [...prev, { midi, step, duration: 1, velocity: 0.8 }]
    })
  }, [soundSource])

  const removeNote = useCallback((midi: number, step: number) => {
    setNotes(prev => prev.filter(n => !(n.midi === midi && step >= n.step && step < n.step + n.duration)))
  }, [])

  const handleCellMouseDown = useCallback((midi: number, step: number, e: React.MouseEvent) => {
    e.preventDefault()
    const existingNote = findNoteAtCell(midi, step)

    if (tool === 'erase') {
      isDrawing.current = true
      lastDrawnCell.current = nid(midi, step)
      if (existingNote) removeNote(existingNote.midi, existingNote.step)
      return
    }

    if (tool === 'select') {
      const id = existingNote ? nid(existingNote.midi, existingNote.step) : null
      if (id && existingNote) {
        // Play preview of all notes at this step (hear the chord)
        const chordNotes = notes.filter(n => n.step === existingNote.step)
        for (const cn of chordNotes) {
          playNotePreview(cn.midi, 500, soundSource)
        }
        setSelectedNotes(prev => {
          const next = new Set(prev)
          if (e.shiftKey) { next.has(id) ? next.delete(id) : next.add(id) }
          else { next.clear(); next.add(id) }
          return next
        })
      } else if (!e.shiftKey) {
        setSelectedNotes(new Set())
      }
      return
    }

    // Draw tool
    isDrawing.current = true
    lastDrawnCell.current = nid(midi, step)

    if (existingNote) {
      // Resize handle: right 8px of the cell
      const rect = e.currentTarget.getBoundingClientRect()
      if (existingNote.step === step && (e.clientX - rect.left) > rect.width - 8 && existingNote.duration >= 1) {
        resizingNote.current = { midi: existingNote.midi, step: existingNote.step }
        return
      }
      removeNote(existingNote.midi, existingNote.step)
    } else {
      drawStartNote.current = { midi, step }
      addNote(midi, step)
    }
  }, [tool, findNoteAtCell, addNote, removeNote])

  const handleCellMouseEnter = useCallback((midi: number, step: number) => {
    if (!isDrawing.current) return
    const cellId = nid(midi, step)
    if (cellId === lastDrawnCell.current) return
    lastDrawnCell.current = cellId

    if (resizingNote.current) {
      const { midi: rM, step: rS } = resizingNote.current
      setNotes(prev => prev.map(n => n.midi === rM && n.step === rS ? { ...n, duration: Math.max(1, step - rS + 1) } : n))
      return
    }

    if (tool === 'erase') {
      const ex = findNoteAtCell(midi, step)
      if (ex) removeNote(ex.midi, ex.step)
      return
    }

    if (tool === 'draw') {
      if (drawStartNote.current && drawStartNote.current.midi === midi) {
        const startStep = drawStartNote.current.step
        setNotes(prev => prev.map(n => n.midi === midi && n.step === startStep ? { ...n, duration: Math.max(1, step - startStep + 1) } : n))
      } else {
        addNote(midi, step)
      }
    }
  }, [tool, findNoteAtCell, addNote, removeNote])

  const handleMouseUp = useCallback(() => {
    isDrawing.current = false
    drawStartNote.current = null
    resizingNote.current = null
    lastDrawnCell.current = null
  }, [])

  const handleKeyClick = useCallback((midi: number) => { playNotePreview(midi, 350, soundSource) }, [soundSource])

  const handleVelocityDrag = useCallback((step: number, normalizedY: number) => {
    const vel = Math.max(0.1, Math.min(1, 1 - normalizedY))
    setNotes(prev => prev.map(n => n.step === step ? { ...n, velocity: vel } : n))
  }, [])

  const generatePattern = useCallback(() => {
    if (notes.length === 0) { onPatternChange('~ ~ ~ ~'); return }

    // ── For chord/pad nodes: produce CLEAN bar-level or beat-level patterns ──
    // Strudel <...> = one entry per cycle. We want exactly 1/2/4/8 bars
    // worth of items (not 16/32/64/128 16th-note steps).
    if (nodeType === 'chords' || nodeType === 'pad') {
      // Determine beat grouping: 4 steps = 1 beat, 16 steps = 1 bar
      const STEPS_PER_BEAT = 4
      const totalBeats = Math.floor(totalSteps / STEPS_PER_BEAT)

      // Collect which notes are active at each beat boundary
      const beatChords: string[] = []
      for (let beat = 0; beat < totalBeats; beat++) {
        const beatStart = beat * STEPS_PER_BEAT
        // Find all notes that are sounding at this beat start
        const sounding: number[] = []
        for (const n of notes) {
          const noteEnd = n.step + n.duration
          if (n.step <= beatStart && noteEnd > beatStart) sounding.push(n.midi)
          else if (n.step === beatStart) sounding.push(n.midi)
        }
        // Deduplicate
        const unique = [...new Set(sounding)].sort((a, b) => a - b)
        if (unique.length === 0) {
          beatChords.push('~')
        } else if (unique.length === 1) {
          beatChords.push(midiToNoteName(unique[0]))
        } else {
          beatChords.push(`[${unique.map(m => midiToNoteName(m)).join(',')}]`)
        }
      }

      // Consolidate: merge consecutive identical chords into one entry
      // per bar (4 beats) when all beats in a bar are the same chord.
      // This turns 16 beats into 4 bars when chords hold for full bars.
      const BEATS_PER_BAR = 4
      const totalBars = Math.floor(totalBeats / BEATS_PER_BAR)
      const barChords: string[] = []
      let allBarsIdentical = true

      for (let bar = 0; bar < totalBars; bar++) {
        const barStart = bar * BEATS_PER_BAR
        const barBeats = beatChords.slice(barStart, barStart + BEATS_PER_BAR)
        const allSame = barBeats.every(b => b === barBeats[0])
        if (allSame) {
          barChords.push(barBeats[0])
        } else {
          allBarsIdentical = false
        }
      }

      // Use bar-level output if all bars had uniform chords
      if (allBarsIdentical && barChords.length > 0) {
        // Remove trailing rests
        while (barChords.length > 1 && barChords[barChords.length - 1] === '~') barChords.pop()
        onPatternChange(`<${barChords.join(' ')}>`)
      } else {
        // Fall back to beat-level output but trim trailing rests
        const trimmed = [...beatChords]
        while (trimmed.length > 1 && trimmed[trimmed.length - 1] === '~') trimmed.pop()
        onPatternChange(`<${trimmed.join(' ')}>`)
      }
      return
    }

    // ── For melody/bass/other: 16th-note resolution ──
    const stepMap = new Map<number, { midi: number; dur: number }[]>()
    for (const n of notes) {
      const arr = stepMap.get(n.step) || []
      arr.push({ midi: n.midi, dur: n.duration })
      stepMap.set(n.step, arr)
    }

    const covered = new Set<number>()
    for (const n of notes) {
      for (let s = n.step + 1; s < n.step + n.duration && s < totalSteps; s++) {
        if (!stepMap.has(s)) covered.add(s)
      }
    }

    const parts: string[] = []
    for (let step = 0; step < totalSteps; step++) {
      if (covered.has(step)) continue
      const mns = stepMap.get(step)
      if (!mns || mns.length === 0) parts.push('~')
      else if (mns.length === 1) parts.push(midiToNoteName(mns[0].midi))
      else parts.push(`[${mns.map(m => midiToNoteName(m.midi)).join(',')}]`)
    }

    onPatternChange(parts.join(' '))
  }, [notes, nodeType, onPatternChange, totalSteps])

  const clearAll = useCallback(() => { setNotes([]); setSelectedNotes(new Set()) }, [])

  /** Preview: play the sequence step by step to hear it */
  const previewSequence = useCallback(() => {
    if (notes.length === 0) return
    // Kill any currently playing preview
    activeOscs.forEach(o => { try { o.stop() } catch {} })
    activeOscs.length = 0

    // Group notes by their step position
    const stepGroups = new Map<number, number[]>()
    for (const n of notes) {
      const arr = stepGroups.get(n.step) || []
      arr.push(n.midi)
      stepGroups.set(n.step, arr)
    }
    const sortedSteps = [...stepGroups.keys()].sort((a, b) => a - b)

    // Calculate time per beat (16th note)
    // We'll use a moderate speed: ~120bpm = 500ms/beat = 125ms per 16th
    const msPerSixteenth = 125
    let baseDelay = 0
    for (let i = 0; i < sortedSteps.length; i++) {
      const step = sortedSteps[i]
      const nextStep = sortedSteps[i + 1]
      const midis = stepGroups.get(step) || []
      // Duration in 16th notes until next chord (or use note's own duration)
      const sampleNote = notes.find(n => n.step === step)
      const durSteps = nextStep !== undefined ? nextStep - step : (sampleNote?.duration ?? 16)
      const durMs = Math.max(200, durSteps * msPerSixteenth)

      for (const midi of midis) {
        setTimeout(() => playNotePreview(midi, durMs, soundSource), baseDelay)
      }
      baseDelay += durSteps * msPerSixteenth
    }
  }, [notes, soundSource])

  const deleteSelected = useCallback(() => {
    if (selectedNotes.size === 0) return
    setNotes(prev => prev.filter(n => !selectedNotes.has(nid(n.midi, n.step))))
    setSelectedNotes(new Set())
  }, [selectedNotes])

  // Keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => {
      // Don't capture when typing in an input
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return
      if (e.key === 'Delete' || e.key === 'Backspace') deleteSelected()
      else if (e.key === 'd' || e.key === 'D') setTool('draw')
      else if (e.key === 'e' || e.key === 'E') setTool('erase')
      else if (e.key === 's' || e.key === 'S') { if (!e.ctrlKey && !e.metaKey) setTool('select') }
      else if (e.key === 'Escape') onClose()
      else if (e.key === '+' || e.key === '=') setZoomIdx(p => Math.min(p + 1, ZOOM_LEVELS.length - 1))
      else if (e.key === '-') setZoomIdx(p => Math.max(p - 1, 0))
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, deleteSelected, onClose])

  if (!isOpen) return null

  const gridW = totalSteps * CELL_W
  const gridH = allMidiNotes.length * CELL_H

  // ═══════════════════════════════════════════════════════════
  //  RENDER — DAW-style layout
  // ═══════════════════════════════════════════════════════════
  return (
    <div
      className="absolute bottom-0 left-0 right-0 z-[100] flex flex-col select-none"
      style={{
        height: DOCK_HEIGHT,
        background: '#0a0a0c',
        borderTop: `2px solid ${nodeColor}50`,
        boxShadow: `0 -8px 40px rgba(0,0,0,0.7), inset 0 1px 0 ${nodeColor}15`,
      }}
      onMouseUp={handleMouseUp}
      onClick={e => e.stopPropagation()}
    >
      {/* ═══ TOOLBAR ═══ */}
      <div className="flex items-center justify-between px-2 py-1 shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: '#111114' }}>

        <div className="flex items-center gap-1">
          <button onClick={() => setPresetPanelOpen(p => !p)}
            className="px-1.5 py-0.5 rounded text-[8px] font-bold cursor-pointer transition-all"
            style={{
              color: presetPanelOpen ? '#f59e0b' : '#666',
              background: presetPanelOpen ? 'rgba(245,158,11,0.1)' : 'transparent',
              border: `1px solid ${presetPanelOpen ? 'rgba(245,158,11,0.25)' : 'transparent'}`,
            }}>
            {presetPanelOpen ? '◀' : '▶'} Presets
          </button>

          <div className="w-px h-4 mx-0.5" style={{ background: 'rgba(255,255,255,0.06)' }} />

          {/* Tools */}
          {([
            { id: 'draw' as const, icon: '✏️', label: 'Draw', key: 'D', color: nodeColor },
            { id: 'select' as const, icon: '◻️', label: 'Select', key: 'S', color: '#60a5fa' },
            { id: 'erase' as const, icon: '🗑️', label: 'Erase', key: 'E', color: '#ef4444' },
          ]).map(t => (
            <button key={t.id} onClick={() => setTool(t.id)}
              className="px-1.5 py-0.5 rounded text-[8px] font-medium cursor-pointer transition-all"
              title={`${t.label} (${t.key})`}
              style={{
                background: tool === t.id ? `${t.color}18` : 'transparent',
                color: tool === t.id ? t.color : '#555',
                border: `1px solid ${tool === t.id ? `${t.color}30` : 'transparent'}`,
              }}>
              {t.icon} {t.label}
            </button>
          ))}

          <div className="w-px h-4 mx-0.5" style={{ background: 'rgba(255,255,255,0.06)' }} />

          {/* Snap */}
          <span className="text-[7px]" style={{ color: '#555' }}>SNAP</span>
          {SNAP_OPTIONS.map(s => (
            <button key={s.value} onClick={() => setSnapValue(s.value)}
              className="px-1 py-0.5 rounded text-[7px] font-bold cursor-pointer"
              title={s.desc}
              style={{
                background: snapValue === s.value ? `${nodeColor}15` : 'transparent',
                color: snapValue === s.value ? nodeColor : '#444',
                border: `1px solid ${snapValue === s.value ? `${nodeColor}25` : 'transparent'}`,
              }}>
              {s.label}
            </button>
          ))}

          <div className="w-px h-4 mx-0.5" style={{ background: 'rgba(255,255,255,0.06)' }} />

          {/* Length */}
          <span className="text-[7px]" style={{ color: '#555' }}>BARS</span>
          {STEP_OPTIONS.map(opt => (
            <button key={opt.value} onClick={() => setTotalSteps(opt.value)}
              className="px-1 py-0.5 rounded text-[7px] font-bold cursor-pointer"
              title={opt.desc}
              style={{
                background: totalSteps === opt.value ? `${nodeColor}15` : 'transparent',
                color: totalSteps === opt.value ? nodeColor : '#444',
                border: `1px solid ${totalSteps === opt.value ? `${nodeColor}25` : 'transparent'}`,
              }}>
              {opt.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1">
          <span className="text-[7px] px-1.5 py-0.5 rounded" style={{ color: '#666', background: '#1a1a1e' }}>
            {scale}
          </span>

          {/* Zoom */}
          <button onClick={() => setZoomIdx(Math.max(0, zoomIdx - 1))}
            className="w-5 h-5 flex items-center justify-center rounded cursor-pointer text-[10px]"
            style={{ color: '#666', background: '#151518' }}>−</button>
          <span className="text-[7px] w-7 text-center" style={{ color: '#888' }}>{zoom.label}</span>
          <button onClick={() => setZoomIdx(Math.min(ZOOM_LEVELS.length - 1, zoomIdx + 1))}
            className="w-5 h-5 flex items-center justify-center rounded cursor-pointer text-[10px]"
            style={{ color: '#666', background: '#151518' }}>+</button>

          <div className="w-px h-4 mx-0.5" style={{ background: 'rgba(255,255,255,0.06)' }} />

          <button onClick={() => setShowVelocity(v => !v)}
            className="px-1.5 py-0.5 rounded text-[7px] font-bold cursor-pointer"
            title="Velocity lane"
            style={{
              color: showVelocity ? '#f59e0b' : '#555',
              background: showVelocity ? 'rgba(245,158,11,0.08)' : 'transparent',
            }}>VEL</button>

          <span className="text-[7px] px-1 py-0.5 rounded" style={{
            color: nodeColor, background: `${nodeColor}10`,
          }}>
            {notes.length} note{notes.length !== 1 ? 's' : ''}
          </span>

          <div className="w-px h-4 mx-0.5" style={{ background: 'rgba(255,255,255,0.06)' }} />

          <button onClick={previewSequence}
            className="px-1.5 py-0.5 rounded text-[8px] font-bold cursor-pointer"
            title="Preview sequence (hear chords)"
            style={{ color: '#22c55e', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}>▶</button>
          <button onClick={clearAll}
            className="px-1.5 py-0.5 rounded text-[8px] cursor-pointer"
            style={{ color: '#555', background: '#151518', border: '1px solid rgba(255,255,255,0.04)' }}>Clear</button>
          <button onClick={generatePattern}
            className="px-2 py-0.5 rounded text-[8px] font-bold cursor-pointer"
            style={{ background: `${nodeColor}20`, color: nodeColor, border: `1px solid ${nodeColor}40` }}>✓ Apply</button>
          <button onClick={onClose}
            className="px-1.5 py-0.5 rounded text-[8px] cursor-pointer"
            title="Esc"
            style={{ color: '#555', background: '#151518', border: '1px solid rgba(255,255,255,0.04)' }}>✕</button>
        </div>
      </div>

      {/* ═══ BODY ═══ */}
      <div className="flex-1 flex min-h-0">

        {/* Preset panel */}
        {presetPanelOpen && (
          <div className="shrink-0 flex flex-col border-r overflow-hidden"
            style={{ width: PRESET_PANEL_W, borderColor: 'rgba(255,255,255,0.05)', background: '#0c0c10' }}>
            <div className="px-2 py-1.5 shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <input type="text" value={presetSearch} onChange={e => setPresetSearch(e.target.value)}
                placeholder="Search presets..."
                className="w-full px-2 py-1 rounded text-[9px] outline-none"
                style={{ background: '#151518', border: '1px solid rgba(255,255,255,0.06)', color: '#ccc' }}
                onClick={e => e.stopPropagation()} />
            </div>
            <div className="flex flex-wrap gap-0.5 px-2 py-1 shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <button onClick={() => setPresetCategory('all')}
                className="px-1 py-0.5 rounded text-[7px] font-bold cursor-pointer"
                style={{
                  background: presetCategory === 'all' ? 'rgba(245,158,11,0.12)' : 'transparent',
                  color: presetCategory === 'all' ? '#f59e0b' : '#555',
                }}>All</button>
              {(Object.entries(PRESET_CATEGORY_META) as [PresetCategory, typeof PRESET_CATEGORY_META[PresetCategory]][]).map(([catId, meta]) => {
                const count = ALL_PRESETS.filter(p => p.category === catId && p.forTypes.includes(nodeType as any)).length
                if (count === 0) return null
                return (
                  <button key={catId} onClick={() => setPresetCategory(catId)}
                    className="px-1 py-0.5 rounded text-[7px] font-bold cursor-pointer"
                    style={{
                      background: presetCategory === catId ? `${meta.color}12` : 'transparent',
                      color: presetCategory === catId ? meta.color : '#555',
                    }}>{meta.icon} {meta.label}</button>
                )
              })}
            </div>
            <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#333 transparent' }}>
              {filteredPresets.length === 0 ? (
                <div className="p-3 text-[9px] text-center" style={{ color: '#444' }}>No presets for {nodeType}</div>
              ) : filteredPresets.map(preset => {
                const cm = PRESET_CATEGORY_META[preset.category]
                const res = preset.resolution ?? 'sixteenth'
                const rf = res === 'bar' ? 16 : res === 'beat' ? 4 : 1
                const gridCells = preset.steps.length * rf
                const bar = gridCells <= 16 ? '1bar' : gridCells <= 32 ? '2bar' : gridCells <= 64 ? '4bar' : '8bar+'
                return (
                  <div key={preset.id} className="px-2 py-1.5 cursor-pointer transition-colors"
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}
                    onClick={() => applyPreset(preset)}
                    onMouseEnter={e => { e.currentTarget.style.background = `${cm.color}08` }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
                    <div className="flex items-center gap-1">
                      <span className="text-[8px]">{cm.icon}</span>
                      <span className="text-[8px] font-medium flex-1 truncate" style={{ color: '#ddd' }}>{preset.name}</span>
                      <span className="text-[6px] px-1 py-px rounded shrink-0" style={{ color: cm.color, background: `${cm.color}10` }}>{bar}</span>
                    </div>
                    <div className="text-[7px] mt-0.5 truncate" style={{ color: '#555' }}>{preset.desc}</div>
                  </div>
                )
              })}
            </div>
            <div className="px-2 py-1 shrink-0 text-[7px]" style={{ color: '#444', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
              {filteredPresets.length} preset{filteredPresets.length !== 1 ? 's' : ''} · click to load
            </div>
          </div>
        )}

        {/* Grid + Velocity */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Bar/beat ruler — click bar number to hear that bar's chord */}
          <div className="flex shrink-0" style={{ marginLeft: PIANO_KEY_W, height: 18 }}>
            {Array.from({ length: totalSteps }, (_, i) => {
              const isBar = i % 16 === 0
              const isBeat = i % 4 === 0
              return (
                <div key={i} className={`flex items-center justify-center text-[7px] font-mono shrink-0${isBar ? ' cursor-pointer hover:brightness-150' : ''}`}
                  style={{
                    width: CELL_W, height: 18,
                    color: isBar ? '#999' : (isBeat ? '#555' : '#2a2a2a'),
                    background: isBar ? 'rgba(255,255,255,0.03)' : 'transparent',
                    borderRight: `1px solid ${isBar ? 'rgba(255,255,255,0.08)' : (isBeat ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.015)')}`,
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                    fontWeight: isBar ? 700 : 400,
                  }}
                  title={isBar ? `Click to hear bar ${Math.floor(i / 16) + 1}` : undefined}
                  onClick={isBar ? () => {
                    // Play all notes that sound within this bar
                    const barStart = i
                    const barEnd = i + 16
                    const barNotes = notes.filter(n => n.step < barEnd && n.step + n.duration > barStart)
                    const uniqueMidis = [...new Set(barNotes.map(n => n.midi))]
                    for (const midi of uniqueMidis) playNotePreview(midi, 600, soundSource)
                  } : undefined}>
                  {isBar ? `${Math.floor(i / 16) + 1}` : (isBeat ? `${Math.floor(i / 16) + 1}.${(Math.floor(i / 4) % 4) + 1}` : '')}
                </div>
              )
            })}
          </div>

          {/* Scrollable grid */}
          <div ref={scrollRef} className="overflow-auto relative"
            style={{ flex: '1', scrollbarWidth: 'thin', scrollbarColor: `${nodeColor}25 transparent` }}>
            <div style={{ display: 'flex', width: PIANO_KEY_W + gridW, minHeight: gridH }}>
              {/* Piano keys */}
              <div className="sticky left-0 z-10 shrink-0" style={{ width: PIANO_KEY_W }}>
                {allMidiNotes.map(midi => {
                  const black = isBlackKey(midi)
                  const inScale = scaleNoteSet.has(midi)
                  const isC = midi % 12 === 0
                  return (
                    <div key={midi}
                      className="flex items-center justify-end pr-1 cursor-pointer hover:brightness-125 transition-all"
                      style={{
                        height: CELL_H,
                        background: black ? (inScale ? '#18181c' : '#0c0c0f') : (inScale ? '#1a1a20' : '#141418'),
                        borderBottom: `1px solid ${isC ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.015)'}`,
                        borderRight: '1px solid rgba(255,255,255,0.06)',
                      }}
                      onMouseDown={() => handleKeyClick(midi)}>
                      <span className="text-[6px] font-mono select-none" style={{
                        color: inScale ? (isC ? '#fff' : nodeColor) : (black ? '#2a2a2a' : '#333'),
                        fontWeight: isC ? 800 : (inScale ? 600 : 400),
                      }}>
                        {NOTE_NAMES[midi % 12]}{Math.floor(midi / 12) - 1}
                      </span>
                    </div>
                  )
                })}
              </div>

              {/* Grid cells */}
              <div style={{ width: gridW, position: 'relative' }}>
                {allMidiNotes.map(midi => {
                  const black = isBlackKey(midi)
                  const inScale = scaleNoteSet.has(midi)
                  const isC = midi % 12 === 0
                  return (
                    <div key={midi} className="flex" style={{ height: CELL_H }}>
                      {Array.from({ length: totalSteps }, (_, step) => {
                        const isBeat = step % 4 === 0
                        const isBar = step % 16 === 0
                        const noteAtStart = noteMap.get(`${midi}:${step}`)
                        const coveredBy = !noteAtStart ? findNoteAtCell(midi, step) : null
                        const isSelected = !!noteAtStart && selectedNotes.has(nid(midi, step))

                        // Note start cell — render note block
                        if (noteAtStart) {
                          const note = noteAtStart
                          const noteW = note.duration * CELL_W - 1
                          const velAlpha = Math.round((0.4 + note.velocity * 0.6) * 255).toString(16).padStart(2, '0')
                          return (
                            <div key={step} className="relative cursor-pointer group"
                              style={{
                                width: CELL_W, height: CELL_H,
                                borderRight: `1px solid ${isBar ? 'rgba(255,255,255,0.08)' : (isBeat ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.015)')}`,
                                borderBottom: `1px solid ${isC ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.015)'}`,
                                background: inScale ? `${nodeColor}04` : (black ? '#090909' : 'transparent'),
                              }}
                              onMouseDown={e => handleCellMouseDown(midi, step, e)}
                              onMouseEnter={() => handleCellMouseEnter(midi, step)}>
                              <div className="absolute top-0 left-0 rounded-sm z-[5]"
                                style={{
                                  width: noteW, height: CELL_H - 1,
                                  background: `${nodeColor}${velAlpha}`,
                                  border: isSelected ? '1.5px solid #fff' : `1px solid ${nodeColor}80`,
                                  boxShadow: isSelected
                                    ? `0 0 8px ${nodeColor}60, inset 0 1px 0 rgba(255,255,255,0.2)`
                                    : `inset 0 1px 0 rgba(255,255,255,0.15), inset 0 -1px 0 rgba(0,0,0,0.3)`,
                                }}>
                                {note.duration > 0 && (
                                  <div className="absolute right-0 top-0 bottom-0 w-1.5 cursor-ew-resize opacity-0 group-hover:opacity-100 transition-opacity"
                                    style={{ background: 'rgba(255,255,255,0.3)', borderRadius: '0 2px 2px 0' }} />
                                )}
                                {noteW > 30 && (
                                  <span className="absolute left-1 top-0 text-[6px] font-mono select-none"
                                    style={{ color: 'rgba(255,255,255,0.6)', lineHeight: `${CELL_H - 1}px` }}>
                                    {NOTE_NAMES[midi % 12]}{Math.floor(midi / 12) - 1}
                                  </span>
                                )}
                              </div>
                            </div>
                          )
                        }

                        // Covered by extended note
                        if (coveredBy) {
                          return (
                            <div key={step} className="cursor-pointer"
                              style={{
                                width: CELL_W, height: CELL_H,
                                borderRight: `1px solid ${isBar ? 'rgba(255,255,255,0.08)' : (isBeat ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.015)')}`,
                                borderBottom: `1px solid ${isC ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.015)'}`,
                              }}
                              onMouseDown={e => handleCellMouseDown(midi, step, e)}
                              onMouseEnter={() => handleCellMouseEnter(midi, step)} />
                          )
                        }

                        // Empty cell
                        return (
                          <div key={step} className="cursor-crosshair"
                            style={{
                              width: CELL_W, height: CELL_H,
                              background: inScale
                                ? (isBeat ? `${nodeColor}06` : `${nodeColor}03`)
                                : (black ? '#090909' : (isBeat ? 'rgba(255,255,255,0.012)' : 'transparent')),
                              borderRight: `1px solid ${isBar ? 'rgba(255,255,255,0.08)' : (isBeat ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.015)')}`,
                              borderBottom: `1px solid ${isC ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.015)'}`,
                            }}
                            onMouseDown={e => handleCellMouseDown(midi, step, e)}
                            onMouseEnter={() => handleCellMouseEnter(midi, step)} />
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Velocity lane */}
          {showVelocity && (
            <div className="shrink-0" style={{ height: VELOCITY_LANE_H, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex h-full" style={{ marginLeft: PIANO_KEY_W }}>
                {Array.from({ length: totalSteps }, (_, step) => {
                  const stepNotes = notes.filter(n => n.step === step)
                  const maxVel = stepNotes.length > 0 ? Math.max(...stepNotes.map(n => n.velocity)) : 0
                  const isBeat = step % 4 === 0
                  const isBar = step % 16 === 0
                  return (
                    <div key={step} className="relative cursor-ns-resize"
                      style={{
                        width: CELL_W, height: VELOCITY_LANE_H,
                        borderRight: `1px solid ${isBar ? 'rgba(255,255,255,0.08)' : (isBeat ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.015)')}`,
                        background: '#0a0a0c',
                      }}
                      onMouseDown={e => {
                        const rect = e.currentTarget.getBoundingClientRect()
                        handleVelocityDrag(step, (e.clientY - rect.top) / rect.height)
                      }}>
                      {maxVel > 0 && (
                        <div className="absolute bottom-0 left-0.5 right-0.5 rounded-t-sm"
                          style={{
                            height: `${maxVel * 100}%`,
                            background: `${nodeColor}${Math.round((0.4 + maxVel * 0.6) * 255).toString(16).padStart(2, '0')}`,
                          }} />
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
//  PATTERN PARSER — Strudel pattern → MIDI notes
// ═══════════════════════════════════════════════════════════════

function parsePatternToNotes(pattern: string, scale: string, octaveRange: [number, number]): PianoRollNote[] {
  if (!pattern) return []
  const notes: PianoRollNote[] = []

  // Detect <...> wrapping: each entry = 1 bar (1 cycle in Strudel)
  const trimmed = pattern.trim()
  const isBarLevel = trimmed.startsWith('<') && trimmed.endsWith('>')

  let clean = trimmed.replace(/^<\s*/, '').replace(/\s*>$/, '').trim()
  if (!clean) return notes

  const steps: string[] = []
  let depth = 0, current = ''
  for (const ch of clean) {
    if (ch === '[') depth++
    if (ch === ']') depth--
    if (ch === ' ' && depth === 0) { if (current.trim()) steps.push(current.trim()); current = '' }
    else current += ch
  }
  if (current.trim()) steps.push(current.trim())

  // Position & duration: bar-level (16 cells) for <...>, or 1 cell for plain patterns
  const stepFactor = isBarLevel ? 16 : 1
  const noteDuration = isBarLevel ? 16 : 1

  steps.forEach((step, idx) => {
    if (step === '~') return
    const gridPos = idx * stepFactor
    if (step.startsWith('[') && step.endsWith(']')) {
      const inner = step.slice(1, -1)
      for (const name of inner.split(',').map(s => s.trim())) {
        const midi = noteNameToMidiFromStrudel(name)
        if (midi >= 0) notes.push({ midi, step: gridPos, duration: noteDuration, velocity: 0.8 })
      }
    } else {
      const midi = noteNameToMidiFromStrudel(step)
      if (midi >= 0) notes.push({ midi, step: gridPos, duration: noteDuration, velocity: 0.8 })
    }
  })
  return notes
}

function noteNameToMidiFromStrudel(name: string): number {
  const m = name.match(/^([a-g])([sb#]?)(\d+)$/i)
  if (!m) return -1
  const map: Record<string, number> = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 }
  let base = map[m[1].toLowerCase()]
  if (base === undefined) return -1
  if (m[2] === 's' || m[2] === '#') base++
  else if (m[2] === 'b') base--
  return (parseInt(m[3]) + 1) * 12 + base
}
