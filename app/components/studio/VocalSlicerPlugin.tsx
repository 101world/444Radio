'use client'

// ═══════════════════════════════════════════════════════════════
//  VOCAL SLICER PLUGIN — Futuristic Piano + Pad + Slicer
//
//  Combined vocal manipulation tool:
//  • Upload or use existing vocal/audio sample
//  • Auto-slice into configurable number of chops
//  • Piano roll: pitched playback of selected slice
//  • Drum pads: trigger slices with keyboard/MIDI/click
//  • Slices auto-place on piano roll + pads when sliced
//  • Controllable by MIDI, keyboard, or on-screen pads
//  • Generates Strudel code: slice(N, n("pattern"))
// ═══════════════════════════════════════════════════════════════

import { useState, useCallback, useMemo, useRef, useEffect, memo } from 'react'
import {
  X, Upload, Scissors, Music, Grid3X3, Piano, Play, Square,
  ChevronLeft, ChevronRight, Minus, Plus, Volume2, Zap,
} from 'lucide-react'

// ─── Types ───

interface VocalSlice {
  idx: number
  label: string
  begin: number    // 0–1 normalized position
  end: number      // 0–1 normalized position
  color: string
  /** MIDI note assigned to this slice */
  midiNote: number
}

interface PianoNote {
  slice: number    // which slice index
  step: number     // grid position (0-based, 16ths)
  duration: number // length in 16th-note steps
  velocity: number // 0–1
  pitch: number    // semitone offset from original (0 = unchanged)
}

interface PadHit {
  padIdx: number
  step: number
}

// ─── Constants ───

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

const SLICE_COLORS = [
  '#f43f5e', '#fb923c', '#facc15', '#4ade80',
  '#22d3ee', '#818cf8', '#c084fc', '#f472b6',
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#06b6d4', '#6366f1', '#a855f7', '#ec4899',
  '#10b981', '#3b82f6', '#8b5cf6', '#e11d48',
  '#d97706', '#059669', '#7c3aed', '#db2777',
  '#14b8a6', '#2563eb', '#9333ea', '#be185d',
  '#0d9488', '#1d4ed8', '#7e22ce', '#9f1239',
]

const STEPS_PER_BAR = 16
const PX_PER_STEP = 28
const KEY_H = 20
const PIANO_W = 56

// Keyboard mapping for pads (4 rows)
const PAD_KEYBOARD_ROWS: string[][] = [
  ['1','2','3','4','5','6','7','8'],
  ['q','w','e','r','t','y','u','i'],
  ['a','s','d','f','g','h','j','k'],
  ['z','x','c','v','b','n','m',','],
]
const ALL_PAD_KEYS = PAD_KEYBOARD_ROWS.flat()

// ─── Generate slices ───

function generateSlices(count: number, trimBegin = 0, trimEnd = 1): VocalSlice[] {
  const range = trimEnd - trimBegin
  return Array.from({ length: count }, (_, i) => ({
    idx: i,
    label: `${i + 1}`,
    begin: trimBegin + (i / count) * range,
    end: trimBegin + ((i + 1) / count) * range,
    color: SLICE_COLORS[i % SLICE_COLORS.length],
    midiNote: 60 + i, // C4 + slice index
  }))
}

// ─── Build Strudel pattern from pad hits ───

function buildSlicePattern(hits: PadHit[], sliceCount: number, bars: number): string {
  const barPatterns: string[] = []
  for (let bar = 0; bar < bars; bar++) {
    const tokens: string[] = []
    for (let s = 0; s < STEPS_PER_BAR; s++) {
      const step = bar * STEPS_PER_BAR + s
      const hit = hits.find(h => h.step === step)
      tokens.push(hit ? String(hit.padIdx) : '~')
    }
    // Trim trailing rests
    let last = tokens.length - 1
    while (last >= 0 && tokens[last] === '~') last--
    barPatterns.push(last < 0 ? '~' : tokens.join(' '))
  }
  if (bars === 1) return barPatterns[0]
  return `<${barPatterns.map(b => `[${b}]`).join(' ')}>`
}

// ─── Build Strudel code from piano notes ───

function buildPianoPattern(notes: PianoNote[], bars: number): string {
  if (notes.length === 0) return '~'
  const totalSteps = bars * STEPS_PER_BAR
  const barPatterns: string[] = []
  for (let bar = 0; bar < bars; bar++) {
    const tokens: string[] = []
    for (let s = 0; s < STEPS_PER_BAR; s++) {
      const step = bar * STEPS_PER_BAR + s
      const note = notes.find(n => n.step === step)
      tokens.push(note ? String(note.slice) : '~')
    }
    let last = tokens.length - 1
    while (last >= 0 && tokens[last] === '~') last--
    barPatterns.push(last < 0 ? '~' : tokens.join(' '))
  }
  if (bars === 1) return barPatterns[0]
  return `<${barPatterns.map(b => `[${b}]`).join(' ')}>`
}

// ─── Mini Waveform SVG ───

const MiniWaveform = memo(function MiniWaveform({
  buffer, width, height, color, slices, activeSlice,
}: {
  buffer: AudioBuffer | null
  width: number
  height: number
  color: string
  slices: VocalSlice[]
  activeSlice: number | null
}) {
  if (!buffer) return <div style={{ width, height, background: '#111' }} />
  const data = buffer.getChannelData(0)
  const samples = data.length
  const step = Math.max(1, Math.floor(samples / width))
  const points: string[] = []
  const mid = height / 2

  for (let x = 0; x < width; x++) {
    const i = Math.floor((x / width) * samples)
    let max = 0
    for (let j = 0; j < step && i + j < samples; j++) {
      const abs = Math.abs(data[i + j])
      if (abs > max) max = abs
    }
    const y = mid - max * mid * 0.9
    points.push(`${x},${y}`)
  }

  return (
    <svg width={width} height={height} className="block">
      {/* Slice regions */}
      {slices.map(s => (
        <rect
          key={s.idx}
          x={s.begin * width}
          y={0}
          width={(s.end - s.begin) * width}
          height={height}
          fill={activeSlice === s.idx ? s.color + '30' : s.color + '10'}
          stroke={s.color + '40'}
          strokeWidth={0.5}
        />
      ))}
      {/* Waveform line */}
      <polyline
        points={points.join(' ')}
        fill="none"
        stroke={color}
        strokeWidth={1.2}
        opacity={0.7}
      />
      {/* Mirror */}
      <polyline
        points={points.map(p => {
          const [x, y] = p.split(',').map(Number)
          return `${x},${height - y}`
        }).join(' ')}
        fill="none"
        stroke={color}
        strokeWidth={1.2}
        opacity={0.4}
      />
      {/* Slice boundary lines */}
      {slices.map(s => (
        <line
          key={`line-${s.idx}`}
          x1={s.begin * width}
          y1={0}
          x2={s.begin * width}
          y2={height}
          stroke={s.color}
          strokeWidth={activeSlice === s.idx ? 2 : 0.5}
          opacity={0.6}
        />
      ))}
    </svg>
  )
})

// ═══════════════════════════════════════════════════════════════
//  COMPONENT
// ═══════════════════════════════════════════════════════════════

interface VocalSlicerPluginProps {
  sampleName: string
  sampleBuffer: AudioBuffer | null
  color: string
  channelName: string
  channelRawCode: string
  chopCount?: number
  trimBegin?: number
  trimEnd?: number
  onPatternChange: (newRawCode: string) => void
  onClose: () => void
  onPreviewSlice?: (sampleName: string, begin: number, end: number, speed?: number) => void
  onUploadAudio?: () => void
  projectBpm?: number
  isTransportPlaying?: boolean
  onToggleTransport?: () => void
}

const VocalSlicerPlugin = memo(function VocalSlicerPlugin({
  sampleName,
  sampleBuffer,
  color,
  channelName,
  channelRawCode,
  chopCount = 16,
  trimBegin = 0,
  trimEnd = 1,
  onPatternChange,
  onClose,
  onPreviewSlice,
  onUploadAudio,
  projectBpm = 120,
  isTransportPlaying = false,
  onToggleTransport,
}: VocalSlicerPluginProps) {

  // ─── Mode: 'pads' | 'piano' ───
  const [mode, setMode] = useState<'pads' | 'piano'>('pads')

  // ─── Slice state ───
  const [sliceCount, setSliceCount] = useState(chopCount)
  const [slices, setSlices] = useState(() => generateSlices(chopCount, trimBegin, trimEnd))
  const [selectedSlice, setSelectedSlice] = useState<number | null>(null)
  const [loopBars, setLoopBars] = useState(4)
  const totalSteps = loopBars * STEPS_PER_BAR

  // ─── Pad mode state ───
  const [padHits, setPadHits] = useState<PadHit[]>([])
  const [flashPad, setFlashPad] = useState<number | null>(null)

  // ─── Piano mode state ───
  const [pianoNotes, setPianoNotes] = useState<PianoNote[]>([])

  // ─── Common state ───
  const [currentStep, setCurrentStep] = useState(0)
  const [hasEdited, setHasEdited] = useState(false)
  const [pitchSemitones, setPitchSemitones] = useState(0)
  const stepTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Regenerate slices when count or trim changes
  useEffect(() => {
    setSlices(generateSlices(sliceCount, trimBegin, trimEnd))
    setPadHits(prev => prev.filter(h => h.padIdx < sliceCount))
    setPianoNotes(prev => prev.filter(n => n.slice < sliceCount))
  }, [sliceCount, trimBegin, trimEnd])

  // ─── Slice the audio ───
  const handleSlice = useCallback(() => {
    const newSlices = generateSlices(sliceCount, trimBegin, trimEnd)
    setSlices(newSlices)

    // Auto-distribute slices across the piano roll / pads
    const stepsPerSlice = Math.max(1, Math.floor(totalSteps / sliceCount))
    const newHits: PadHit[] = []
    const newNotes: PianoNote[] = []
    for (let i = 0; i < sliceCount && i * stepsPerSlice < totalSteps; i++) {
      const step = i * stepsPerSlice
      newHits.push({ padIdx: i, step })
      newNotes.push({ slice: i, step, duration: stepsPerSlice, velocity: 0.8, pitch: 0 })
    }
    setPadHits(newHits)
    setPianoNotes(newNotes)
    setHasEdited(true)
  }, [sliceCount, trimBegin, trimEnd, totalSteps])

  // ─── Pad click ───
  const handlePadClick = useCallback((idx: number) => {
    setSelectedSlice(idx)
    setFlashPad(idx)
    setTimeout(() => setFlashPad(null), 150)

    // Preview slice
    if (onPreviewSlice && slices[idx]) {
      const s = slices[idx]
      const speed = pitchSemitones !== 0 ? Math.pow(2, pitchSemitones / 12) : undefined
      onPreviewSlice(sampleName, s.begin, s.end, speed)
    }
  }, [slices, sampleName, onPreviewSlice, pitchSemitones])

  // ─── Grid cell click (pads mode) ───
  const handlePadGridClick = useCallback((step: number) => {
    if (selectedSlice === null) return
    setPadHits(prev => {
      const existing = prev.findIndex(h => h.step === step)
      if (existing >= 0) {
        // Remove if same pad, replace if different
        if (prev[existing].padIdx === selectedSlice) {
          return prev.filter((_, i) => i !== existing)
        }
        return prev.map((h, i) => i === existing ? { ...h, padIdx: selectedSlice } : h)
      }
      return [...prev, { padIdx: selectedSlice, step }]
    })
    setHasEdited(true)
  }, [selectedSlice])

  // ─── Grid cell click (piano mode) ───
  const handlePianoGridClick = useCallback((sliceIdx: number, step: number) => {
    setPianoNotes(prev => {
      const existing = prev.findIndex(n => n.step === step && n.slice === sliceIdx)
      if (existing >= 0) {
        return prev.filter((_, i) => i !== existing)
      }
      return [...prev, { slice: sliceIdx, step, duration: 1, velocity: 0.8, pitch: 0 }]
    })
    setHasEdited(true)
    // Preview
    if (onPreviewSlice && slices[sliceIdx]) {
      const s = slices[sliceIdx]
      onPreviewSlice(sampleName, s.begin, s.end)
    }
  }, [slices, sampleName, onPreviewSlice])

  // ─── Keyboard handler ───
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return
      const key = e.key.toLowerCase()
      const padIdx = ALL_PAD_KEYS.indexOf(key)
      if (padIdx >= 0 && padIdx < sliceCount) {
        handlePadClick(padIdx)
      }
      if (key === 'escape') setSelectedSlice(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [sliceCount, handlePadClick])

  // ─── Step playback ───
  useEffect(() => {
    if (isTransportPlaying && hasEdited) {
      const msPerStep = (60000 / projectBpm) / 4
      stepTimerRef.current = setInterval(() => {
        setCurrentStep(prev => (prev + 1) % totalSteps)
      }, msPerStep)
    } else {
      if (stepTimerRef.current) clearInterval(stepTimerRef.current)
      setCurrentStep(0)
    }
    return () => { if (stepTimerRef.current) clearInterval(stepTimerRef.current) }
  }, [isTransportPlaying, hasEdited, projectBpm, totalSteps])

  // Preview on current step
  useEffect(() => {
    if (!isTransportPlaying || !onPreviewSlice) return
    if (mode === 'pads') {
      const hit = padHits.find(h => h.step === currentStep)
      if (hit && slices[hit.padIdx]) {
        const s = slices[hit.padIdx]
        const speed = pitchSemitones !== 0 ? Math.pow(2, pitchSemitones / 12) : undefined
        onPreviewSlice(sampleName, s.begin, s.end, speed)
      }
    } else {
      const notes = pianoNotes.filter(n => n.step === currentStep)
      for (const note of notes) {
        if (slices[note.slice]) {
          const s = slices[note.slice]
          const speed = note.pitch !== 0 ? Math.pow(2, note.pitch / 12) : undefined
          onPreviewSlice(sampleName, s.begin, s.end, speed)
        }
      }
    }
  }, [currentStep, isTransportPlaying, mode, padHits, pianoNotes, slices, sampleName, onPreviewSlice, pitchSemitones])

  // ─── Apply / generate code ───
  const handleApply = useCallback(() => {
    const pattern = mode === 'pads'
      ? buildSlicePattern(padHits, sliceCount, loopBars)
      : buildPianoPattern(pianoNotes, loopBars)

    const speed = pitchSemitones !== 0 ? Math.pow(2, pitchSemitones / 12) : 1
    const speedStr = speed !== 1 ? `\n  .speed(${speed.toFixed(4)})` : ''

    const code = `s("${sampleName}")\n  .slice(${sliceCount}, "${pattern}")\n  .loopAt(${loopBars * 4})${speedStr}\n  .gain(0.7)\n  .room(0.15).delay(0.1).delaytime(0.125).delayfeedback(0.2)`

    onPatternChange(code)
    setHasEdited(false)
  }, [mode, padHits, pianoNotes, sliceCount, loopBars, pitchSemitones, sampleName, onPatternChange])

  // ─── Layout calculations ───
  const gridWidth = totalSteps * PX_PER_STEP
  const visibleSlices = slices.slice(0, Math.min(sliceCount, 32))
  // For pad mode: which slice rows to show in the pad grid
  const padRows = Math.ceil(Math.min(sliceCount, 32) / 8)

  return (
    <div
      ref={containerRef}
      className="flex flex-col select-none"
      style={{
        background: '#0a0b0f',
        borderTop: `2px solid ${color}40`,
        height: mode === 'piano' ? 480 : 420,
      }}
    >
      {/* ═══ HEADER BAR ═══ */}
      <div
        className="shrink-0 flex items-center gap-2 px-3 py-1.5"
        style={{
          background: '#0f1015',
          borderBottom: `1px solid ${color}20`,
        }}
      >
        {/* Title */}
        <div className="flex items-center gap-2">
          <Scissors size={12} style={{ color }} />
          <span className="text-[10px] font-black uppercase tracking-wider" style={{ color }}>
            Vocal Slicer
          </span>
          <span className="text-[9px] font-mono" style={{ color: '#5a616b' }}>
            {channelName}
          </span>
        </div>

        {/* Mode toggle */}
        <div className="flex items-center gap-0.5 ml-3 rounded-md overflow-hidden" style={{ border: '1px solid #222' }}>
          <button
            onClick={() => setMode('pads')}
            className="flex items-center gap-1 px-2 py-1 text-[8px] font-bold uppercase cursor-pointer transition-all"
            style={{
              background: mode === 'pads' ? color + '20' : 'transparent',
              color: mode === 'pads' ? color : '#5a616b',
            }}
          >
            <Grid3X3 size={10} /> Pads
          </button>
          <button
            onClick={() => setMode('piano')}
            className="flex items-center gap-1 px-2 py-1 text-[8px] font-bold uppercase cursor-pointer transition-all"
            style={{
              background: mode === 'piano' ? color + '20' : 'transparent',
              color: mode === 'piano' ? color : '#5a616b',
            }}
          >
            <Piano size={10} /> Piano
          </button>
        </div>

        {/* Slice count */}
        <div className="flex items-center gap-1 ml-2">
          <span className="text-[7px] font-bold uppercase" style={{ color: '#5a616b' }}>Slices</span>
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => setSliceCount(Math.max(2, sliceCount / 2))}
              className="w-4 h-4 flex items-center justify-center rounded cursor-pointer hover:bg-white/[0.06]"
              style={{ color: '#888', background: 'none', border: 'none' }}
            >
              <Minus size={8} />
            </button>
            <span className="text-[9px] font-mono font-bold w-5 text-center" style={{ color }}>{sliceCount}</span>
            <button
              onClick={() => setSliceCount(Math.min(64, sliceCount * 2))}
              className="w-4 h-4 flex items-center justify-center rounded cursor-pointer hover:bg-white/[0.06]"
              style={{ color: '#888', background: 'none', border: 'none' }}
            >
              <Plus size={8} />
            </button>
          </div>
        </div>

        {/* Bars */}
        <div className="flex items-center gap-1 ml-2">
          <span className="text-[7px] font-bold uppercase" style={{ color: '#5a616b' }}>Bars</span>
          <select
            value={loopBars}
            onChange={e => setLoopBars(parseInt(e.target.value))}
            className="text-[8px] font-mono px-1 py-0.5 rounded cursor-pointer outline-none"
            style={{ background: '#16181d', color, border: '1px solid rgba(255,255,255,0.05)' }}
          >
            {[1, 2, 4, 8, 16].map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>

        {/* Pitch */}
        <div className="flex items-center gap-1 ml-2">
          <span className="text-[7px] font-bold uppercase" style={{ color: '#5a616b' }}>Pitch</span>
          <button
            onClick={() => setPitchSemitones(v => Math.max(-12, v - 1))}
            className="w-3.5 h-3.5 flex items-center justify-center rounded cursor-pointer"
            style={{ background: '#16181d', color: '#888', border: 'none', fontSize: 8 }}
          >-</button>
          <span className="text-[8px] font-mono w-5 text-center" style={{ color: pitchSemitones !== 0 ? '#facc15' : '#5a616b' }}>
            {pitchSemitones > 0 ? `+${pitchSemitones}` : pitchSemitones}
          </span>
          <button
            onClick={() => setPitchSemitones(v => Math.min(12, v + 1))}
            className="w-3.5 h-3.5 flex items-center justify-center rounded cursor-pointer"
            style={{ background: '#16181d', color: '#888', border: 'none', fontSize: 8 }}
          >+</button>
        </div>

        <div className="flex-1" />

        {/* Slice button */}
        <button
          onClick={handleSlice}
          className="flex items-center gap-1 px-2.5 py-1 rounded text-[8px] font-bold uppercase cursor-pointer transition-all hover:brightness-125"
          style={{
            background: `${color}18`,
            color,
            border: `1px solid ${color}40`,
          }}
        >
          <Scissors size={10} /> Slice
        </button>

        {/* Upload */}
        {onUploadAudio && (
          <button
            onClick={onUploadAudio}
            className="flex items-center gap-1 px-2 py-1 rounded text-[8px] font-bold uppercase cursor-pointer transition-all hover:bg-white/[0.06]"
            style={{ color: '#5a616b', background: 'none', border: '1px solid #222' }}
          >
            <Upload size={9} /> Load
          </button>
        )}

        {/* Apply */}
        <button
          onClick={handleApply}
          disabled={!hasEdited}
          className="flex items-center gap-1 px-2.5 py-1 rounded text-[8px] font-bold uppercase cursor-pointer transition-all"
          style={{
            background: hasEdited ? '#00e5c720' : '#16181d',
            color: hasEdited ? '#00e5c7' : '#333',
            border: hasEdited ? '1px solid #00e5c740' : '1px solid transparent',
          }}
        >
          <Zap size={9} /> Apply
        </button>

        {/* Play/Stop */}
        {onToggleTransport && (
          <button
            onClick={onToggleTransport}
            className="w-6 h-6 flex items-center justify-center rounded cursor-pointer transition-all"
            style={{
              background: isTransportPlaying ? '#ef444420' : '#16181d',
              color: isTransportPlaying ? '#ef4444' : '#5a616b',
              border: 'none',
            }}
          >
            {isTransportPlaying ? <Square size={10} /> : <Play size={10} />}
          </button>
        )}

        {/* Close */}
        <button
          onClick={onClose}
          className="w-6 h-6 flex items-center justify-center rounded cursor-pointer hover:bg-white/[0.06] transition-colors"
          style={{ color: '#5a616b', background: 'none', border: 'none' }}
        >
          <X size={12} />
        </button>
      </div>

      {/* ═══ WAVEFORM + SLICE MARKERS ═══ */}
      <div className="shrink-0 px-3 py-1.5" style={{ borderBottom: '1px solid #1a1c22' }}>
        <div className="rounded overflow-hidden" style={{ background: '#08090c', border: '1px solid #1a1c22' }}>
          <MiniWaveform
            buffer={sampleBuffer}
            width={600}
            height={56}
            color={color}
            slices={slices}
            activeSlice={selectedSlice}
          />
        </div>
      </div>

      {/* ═══ MAIN CONTENT ═══ */}
      <div className="flex-1 flex overflow-hidden">

        {/* ─── LEFT: Drum Pads (always visible) ─── */}
        <div className="shrink-0 flex flex-col" style={{ width: 280, borderRight: '1px solid #1a1c22' }}>
          <div className="px-2 py-1" style={{ borderBottom: '1px solid #151720' }}>
            <span className="text-[7px] font-black uppercase tracking-wider" style={{ color: '#5a616b' }}>
              Pads · {sliceCount} slices
            </span>
          </div>
          <div className="flex-1 overflow-auto p-2">
            <div
              className="grid gap-1"
              style={{ gridTemplateColumns: `repeat(${Math.min(8, sliceCount)}, 1fr)` }}
            >
              {visibleSlices.map(s => {
                const isActive = selectedSlice === s.idx
                const isFlash = flashPad === s.idx
                const hasHits = padHits.some(h => h.padIdx === s.idx) || pianoNotes.some(n => n.slice === s.idx)
                return (
                  <button
                    key={s.idx}
                    onClick={() => handlePadClick(s.idx)}
                    className="flex flex-col items-center justify-center rounded-lg cursor-pointer transition-all active:scale-[0.92]"
                    style={{
                      aspectRatio: '1',
                      background: isFlash
                        ? s.color
                        : isActive
                          ? s.color + '35'
                          : s.color + '12',
                      border: isActive
                        ? `2px solid ${s.color}`
                        : `1px solid ${s.color}30`,
                      boxShadow: isFlash
                        ? `0 0 16px ${s.color}80`
                        : isActive
                          ? `0 0 8px ${s.color}30, inset 0 0 8px ${s.color}10`
                          : 'none',
                      minHeight: 32,
                    }}
                  >
                    <span className="text-[9px] font-black" style={{ color: isFlash ? '#000' : s.color }}>
                      {s.label}
                    </span>
                    {hasHits && (
                      <div className="w-1.5 h-1.5 rounded-full mt-0.5" style={{ background: s.color }} />
                    )}
                    {/* Keyboard hint */}
                    {ALL_PAD_KEYS[s.idx] && (
                      <span className="text-[6px] font-mono mt-0.5" style={{ color: s.color + '60' }}>
                        {ALL_PAD_KEYS[s.idx].toUpperCase()}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* ─── RIGHT: Step Grid (pads mode) or Piano Roll (piano mode) ─── */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Bar ruler */}
          <div className="shrink-0 flex" style={{ height: 18, background: '#0f1015', borderBottom: '1px solid #1a1c22' }}>
            {mode === 'piano' && <div style={{ width: PIANO_W }} />}
            <div className="flex-1 overflow-hidden">
              <div className="flex" style={{ width: gridWidth }}>
                {Array.from({ length: loopBars }, (_, bar) => (
                  <div
                    key={bar}
                    className="shrink-0 flex items-center px-1"
                    style={{ width: STEPS_PER_BAR * PX_PER_STEP, borderRight: '1px solid #222' }}
                  >
                    <span className="text-[7px] font-mono" style={{ color: '#5a616b' }}>{bar + 1}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Grid content */}
          <div className="flex-1 overflow-auto">
            <div className="flex" style={{ minHeight: '100%' }}>
              {mode === 'piano' && (
                /* Piano keys column */
                <div className="shrink-0 sticky left-0 z-10" style={{ width: PIANO_W, background: '#0d0e12' }}>
                  {visibleSlices.map(s => (
                    <div
                      key={s.idx}
                      className="flex items-center gap-1 px-1 cursor-pointer transition-colors hover:bg-white/[0.04]"
                      style={{
                        height: KEY_H,
                        borderBottom: `1px solid ${s.color}15`,
                        background: selectedSlice === s.idx ? s.color + '15' : 'transparent',
                      }}
                      onClick={() => handlePadClick(s.idx)}
                    >
                      <div className="w-2 h-2 rounded-sm shrink-0" style={{ background: s.color }} />
                      <span className="text-[7px] font-mono truncate" style={{ color: s.color }}>
                        S{s.label}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Grid cells */}
              <div className="flex-1">
                {mode === 'pads' ? (
                  /* ─── PAD STEP GRID ─── */
                  <div className="relative" style={{ width: gridWidth, height: 200 }}>
                    {/* Grid lines */}
                    {Array.from({ length: totalSteps }, (_, step) => (
                      <div
                        key={step}
                        className="absolute top-0 bottom-0 cursor-pointer hover:bg-white/[0.03] transition-colors"
                        style={{
                          left: step * PX_PER_STEP,
                          width: PX_PER_STEP,
                          borderRight: step % 4 === 3 ? '1px solid #222' : '1px solid #151720',
                          borderLeft: step % 16 === 0 ? '1px solid #333' : 'none',
                        }}
                        onClick={() => handlePadGridClick(step)}
                      >
                        {/* Render hits at this step */}
                        {padHits.filter(h => h.step === step).map(hit => {
                          const s = slices[hit.padIdx]
                          if (!s) return null
                          return (
                            <div
                              key={`${hit.padIdx}-${hit.step}`}
                              className="absolute left-0.5 right-0.5 rounded-sm"
                              style={{
                                top: '10%',
                                bottom: '10%',
                                background: s.color + '60',
                                border: `1px solid ${s.color}`,
                                boxShadow: `0 0 4px ${s.color}40`,
                              }}
                            >
                              <span className="absolute inset-0 flex items-center justify-center text-[7px] font-black" style={{ color: s.color }}>
                                {s.label}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    ))}
                    {/* Playhead */}
                    {isTransportPlaying && (
                      <div
                        className="absolute top-0 bottom-0 pointer-events-none"
                        style={{
                          left: currentStep * PX_PER_STEP,
                          width: 2,
                          background: '#00e5c7',
                          boxShadow: '0 0 6px #00e5c7',
                          zIndex: 10,
                        }}
                      />
                    )}
                  </div>
                ) : (
                  /* ─── PIANO ROLL GRID ─── */
                  <div className="relative" style={{ width: gridWidth, height: visibleSlices.length * KEY_H }}>
                    {/* Row backgrounds */}
                    {visibleSlices.map(s => (
                      <div
                        key={`row-${s.idx}`}
                        className="absolute left-0"
                        style={{
                          top: s.idx * KEY_H,
                          width: gridWidth,
                          height: KEY_H,
                          background: s.idx % 2 === 0 ? '#0c0d11' : '#0e0f14',
                          borderBottom: `1px solid ${s.color}08`,
                        }}
                      />
                    ))}
                    {/* Grid vertical lines */}
                    {Array.from({ length: totalSteps }, (_, step) => (
                      <div
                        key={`vline-${step}`}
                        className="absolute top-0 bottom-0"
                        style={{
                          left: step * PX_PER_STEP,
                          width: 1,
                          background: step % 16 === 0 ? '#333' : step % 4 === 0 ? '#222' : '#181a20',
                        }}
                      />
                    ))}
                    {/* Click areas */}
                    {visibleSlices.map(s => (
                      Array.from({ length: totalSteps }, (_, step) => (
                        <div
                          key={`cell-${s.idx}-${step}`}
                          className="absolute cursor-pointer hover:bg-white/[0.03] transition-colors"
                          style={{
                            left: step * PX_PER_STEP,
                            top: s.idx * KEY_H,
                            width: PX_PER_STEP,
                            height: KEY_H,
                          }}
                          onClick={() => handlePianoGridClick(s.idx, step)}
                        />
                      ))
                    ))}
                    {/* Render placed notes */}
                    {pianoNotes.map((note, i) => {
                      const s = slices[note.slice]
                      if (!s) return null
                      return (
                        <div
                          key={`note-${i}`}
                          className="absolute rounded-sm pointer-events-none"
                          style={{
                            left: note.step * PX_PER_STEP + 1,
                            top: note.slice * KEY_H + 2,
                            width: note.duration * PX_PER_STEP - 2,
                            height: KEY_H - 4,
                            background: s.color + '80',
                            border: `1px solid ${s.color}`,
                            boxShadow: `0 0 4px ${s.color}30`,
                          }}
                        >
                          <span className="text-[6px] font-bold px-0.5" style={{ color: '#fff' }}>
                            S{s.label}
                          </span>
                        </div>
                      )
                    })}
                    {/* Playhead */}
                    {isTransportPlaying && (
                      <div
                        className="absolute top-0 bottom-0 pointer-events-none"
                        style={{
                          left: currentStep * PX_PER_STEP,
                          width: 2,
                          background: '#00e5c7',
                          boxShadow: '0 0 6px #00e5c7',
                          zIndex: 10,
                        }}
                      />
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ FOOTER STATUS ═══ */}
      <div
        className="shrink-0 flex items-center gap-3 px-3 py-1"
        style={{ background: '#0f1015', borderTop: '1px solid #1a1c22' }}
      >
        <span className="text-[6px] font-mono" style={{ color: '#3a3f48' }}>
          KEYS: {PAD_KEYBOARD_ROWS[0].slice(0, 8).join(' ').toUpperCase()} · ESC = deselect
        </span>
        {selectedSlice !== null && slices[selectedSlice] && (
          <span className="flex items-center gap-1 text-[7px] font-bold px-1.5 py-0.5 rounded"
            style={{ background: slices[selectedSlice].color + '20', color: slices[selectedSlice].color }}>
            ✎ Slice {selectedSlice + 1} — {mode === 'pads' ? 'click step grid to place' : 'click piano grid to place'}
          </span>
        )}
        <div className="flex-1" />
        <span className="text-[7px] font-mono" style={{ color: '#5a616b' }}>
          {mode === 'pads' ? padHits.length : pianoNotes.length} hits · {loopBars} bars · {sliceCount} slices
        </span>
        {hasEdited && (
          <span className="text-[7px] font-bold" style={{ color: '#facc15' }}>
            unsaved — click Apply
          </span>
        )}
      </div>
    </div>
  )
})

export default VocalSlicerPlugin
