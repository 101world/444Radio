'use client'

// ═══════════════════════════════════════════════════════════════
//  STUDIO VOCAL PAD SAMPLER — MPC-style drum pad for vocal chops
//
//  Deep Strudel integration:
//  • Uses slice(N, n("pattern")) for proper chop-based playback
//  • 4×4 pad grid with keyboard mapping (1-4/Q-R/A-F/Z-V)
//  • "Selected pad" concept: click grid cells to paint hits
//  • Real-time loop recording with quantize
//  • Multi-layer: can stack multiple pad hits at same step
//  • Mini step-sequencer grid for visual editing
//  • Generates clean Strudel code that maps 1:1 to timing
// ═══════════════════════════════════════════════════════════════

import { useState, useCallback, useMemo, useRef, useEffect } from 'react'

// ─── Types ───

interface VocalChop {
  idx: number
  label: string
  begin: number
  end: number
  color: string
}

interface RecordedHit {
  padIdx: number
  step: number
}

// ─── Constants ───

const PAD_COLORS = [
  '#f43f5e', '#fb923c', '#facc15', '#4ade80',
  '#22d3ee', '#818cf8', '#c084fc', '#f472b6',
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#06b6d4', '#6366f1', '#a855f7', '#ec4899',
]

const LOOP_BAR_OPTIONS = [1, 2, 4, 8, 16, 32] as const
const CHOP_OPTIONS = [4, 8, 16, 32, 64] as const
const STEPS_PER_BAR = 16

// Test beat step pattern (simple boom-bap)
const TEST_KICK_STEPS = [0, 8]          // beats 1, 3
const TEST_SNARE_STEPS = [4, 12]        // beats 2, 4
const TEST_HH_STEPS = [0, 2, 4, 6, 8, 10, 12, 14] // 8th notes

// ─── Utility: auto-slice sample into N equal chops ───
// When trimBegin/trimEnd are provided, slices are mapped to the trimmed region
// so chop boundaries stay in sync with the user's waveform trim.

function generateChops(count: number, trimBegin = 0, trimEnd = 1): VocalChop[] {
  const chops: VocalChop[] = []
  const range = trimEnd - trimBegin
  for (let i = 0; i < count; i++) {
    chops.push({
      idx: i,
      label: `${i + 1}`,
      begin: trimBegin + (i / count) * range,
      end: trimBegin + ((i + 1) / count) * range,
      color: PAD_COLORS[i % PAD_COLORS.length],
    })
  }
  return chops
}

// ─── Utility: compress pattern by collapsing trailing rests ───

function compressPattern(tokens: string[]): string {
  // Remove trailing rests
  let last = tokens.length - 1
  while (last >= 0 && tokens[last] === '~') last--
  if (last < 0) return '~'

  // Keep full 16-step bars (don't compress within bars) for alignment
  return tokens.join(' ')
}

/** Build slice-based pattern from recorded hits.
 *  Output: slice indices for n() — e.g. "0 ~ 3 ~ 7 ~ ~ ~"
 *  Strudel form: n("pattern").s("sample").slice(chopCount).loopAt(bars)
 */
function buildSlicePattern(hits: RecordedHit[], chopCount: number, bars: number): string {
  const barPatterns: string[] = []

  for (let bar = 0; bar < bars; bar++) {
    const tokens: string[] = []
    for (let s = 0; s < STEPS_PER_BAR; s++) {
      const step = bar * STEPS_PER_BAR + s
      const hit = hits.find(h => h.step === step)
      if (hit) {
        tokens.push(String(hit.padIdx))
      } else {
        tokens.push('~')
      }
    }
    barPatterns.push(compressPattern(tokens))
  }

  if (bars === 1) return barPatterns[0]
  return `<${barPatterns.map(b => `[${b}]`).join(' ')}>`
}

// ═══════════════════════════════════════════════════════════════
//  COMPONENT
// ═══════════════════════════════════════════════════════════════

interface StudioVocalPadSamplerProps {
  sampleName: string
  color: string
  channelName: string
  channelRawCode: string
  chopCount?: number
  /** Trim begin from waveform viewer (0–1). Chops map to this region. */
  trimBegin?: number
  /** Trim end from waveform viewer (0–1). Chops map to this region. */
  trimEnd?: number
  onPatternChange: (newRawCode: string) => void
  onClose: () => void
  onPreviewPad?: (sampleName: string, begin: number, end: number, speed?: number) => void
  /** Play a drum sound for test beat (e.g. 'bd', 'sd', 'hh') */
  onPreviewDrum?: (sound: string, gain?: number) => void
  projectBpm?: number
  /** Is the main Strudel transport currently playing? */
  isTransportPlaying?: boolean
  /** Toggle the main transport play/stop */
  onToggleTransport?: () => void
}

export default function StudioVocalPadSampler({
  sampleName,
  color,
  channelName,
  channelRawCode,
  chopCount = 16,
  trimBegin = 0,
  trimEnd = 1,
  onPatternChange,
  onClose,
  onPreviewPad,
  onPreviewDrum,
  projectBpm = 120,
  isTransportPlaying = false,
  onToggleTransport,
}: StudioVocalPadSamplerProps) {
  // ─── State ───
  const [localChopCount, setLocalChopCount] = useState(chopCount)
  const [chops, setChops] = useState(() => generateChops(chopCount, trimBegin, trimEnd))
  const [loopBars, setLoopBars] = useState<number>(4)
  const [isRecording, setIsRecording] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [recordedHits, setRecordedHits] = useState<RecordedHit[]>([])  
  const [flashPad, setFlashPad] = useState<number | null>(null)
  const [currentStep, setCurrentStep] = useState(0)
  const [quantize, setQuantize] = useState(true)
  const [padLayout, setPadLayout] = useState<4 | 8 | 16>(16)
  const [hasEdited, setHasEdited] = useState(false)
  const [selectedPad, setSelectedPad] = useState<number | null>(null) // for grid painting

  // ─── New: Pitch / Sidechain / Test Beat state ───
  const [pitchSemitones, setPitchSemitones] = useState(() => {
    // Parse existing .speed() from channel code to initialize
    const speedMatch = channelRawCode.match(/\.speed\(\s*([\d.]+)\s*\)/)
    if (speedMatch) {
      const spd = parseFloat(speedMatch[1])
      if (spd > 0) return Math.round(12 * Math.log2(spd))
    }
    return 0
  })
  const [sidechainEnabled, setSidechainEnabled] = useState(() => /\.duck\(/.test(channelRawCode))
  const [sidechainOrbit, setSidechainOrbit] = useState(() => {
    const dm = channelRawCode.match(/\.duck\(\s*"?(\d+)"?\s*\)/)
    return dm ? parseInt(dm[1]) : 0
  })
  const [sidechainDepth, setSidechainDepth] = useState(() => {
    const dm = channelRawCode.match(/\.duckdepth\(\s*([\d.]+)\s*\)/)
    return dm ? parseFloat(dm[1]) : 0.8
  })
  const [testBeatOn, setTestBeatOn] = useState(false)

  // Re-generate chops when trim bounds or chop count change
  useEffect(() => {
    setChops(generateChops(localChopCount, trimBegin, trimEnd))
    // Trim any hits that reference pads beyond the new count
    setRecordedHits(prev => prev.filter(h => h.padIdx < localChopCount))
  }, [localChopCount, trimBegin, trimEnd])

  // Refs for animation/timing
  const recordStartTime = useRef(0)
  const loopTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const stepTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastPlayedStepRef = useRef(-1) // avoid double-triggering same step
  const recordedHitsRef = useRef(recordedHits) // keep ref in sync for timer callback
  useEffect(() => { recordedHitsRef.current = recordedHits }, [recordedHits])
  const chopsRef = useRef(chops)
  useEffect(() => { chopsRef.current = chops }, [chops])
  const pitchSemitonesRef = useRef(pitchSemitones)
  useEffect(() => { pitchSemitonesRef.current = pitchSemitones }, [pitchSemitones])

  const totalSteps = loopBars * STEPS_PER_BAR
  const stepDurationMs = (60000 / projectBpm) / (STEPS_PER_BAR / 4) // ms per step

  // ─── Pad playback ───
  const playPad = useCallback((padIdx: number) => {
    const chop = chops[padIdx]
    if (!chop) return

    // Visual flash
    setFlashPad(padIdx)
    setTimeout(() => setFlashPad(null), 120)

    // Audio preview (with pitch shift)
    if (onPreviewPad) {
      const pitchSpeed = pitchSemitones !== 0 ? Math.pow(2, pitchSemitones / 12) : undefined
      onPreviewPad(sampleName, chop.begin, chop.end, pitchSpeed)
    }

    // If recording, add hit to recorded pattern
    if (isRecording) {
      const elapsed = Date.now() - recordStartTime.current
      const rawStep = elapsed / stepDurationMs
      const step = quantize
        ? Math.round(rawStep) % totalSteps
        : Math.floor(rawStep) % totalSteps

      setRecordedHits(prev => {
        // Remove any existing hit at same step (overdub/replace)
        const filtered = prev.filter(h => h.step !== step)
        return [...filtered, { padIdx, step }]
      })
      setHasEdited(true)
    }
  }, [chops, sampleName, isRecording, quantize, totalSteps, stepDurationMs, onPreviewPad, pitchSemitones])

  // ─── Internal playback: trigger pad sounds on step hits ───
  const triggerStepHits = useCallback((step: number) => {
    if (step === lastPlayedStepRef.current) return
    lastPlayedStepRef.current = step
    const hits = recordedHitsRef.current.filter(h => h.step === step)
    for (const hit of hits) {
      const chop = chopsRef.current[hit.padIdx]
      if (!chop) continue
      // Visual flash
      setFlashPad(hit.padIdx)
      setTimeout(() => setFlashPad(null), 80)
      // Audio
      if (onPreviewPad) {
        const pitchSpeed = pitchSemitonesRef.current !== 0 ? Math.pow(2, pitchSemitonesRef.current / 12) : undefined
        onPreviewPad(sampleName, chop.begin, chop.end, pitchSpeed)
      }
    }
  }, [sampleName, onPreviewPad])

  // ─── Start/Stop internal loop (shared by REC and PLAY) ───
  const startLoop = useCallback((recording: boolean) => {
    recordStartTime.current = Date.now()
    lastPlayedStepRef.current = -1
    if (recording) setIsRecording(true)
    setIsPlaying(true)
    setCurrentStep(0)

    // Step indicator + audio trigger timer
    if (stepTimerRef.current) clearInterval(stepTimerRef.current)
    stepTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - recordStartTime.current
      const step = Math.floor(elapsed / stepDurationMs) % totalSteps
      setCurrentStep(step)
      triggerStepHits(step)
    }, stepDurationMs / 2) // update at 2× rate for smooth display

    // Loop boundary — wrap around
    if (loopTimerRef.current) clearInterval(loopTimerRef.current)
    const loopDurationMs = totalSteps * stepDurationMs
    loopTimerRef.current = setInterval(() => {
      recordStartTime.current = Date.now()
      lastPlayedStepRef.current = -1
    }, loopDurationMs)
  }, [totalSteps, stepDurationMs, triggerStepHits])

  const stopLoop = useCallback(() => {
    setIsRecording(false)
    setIsPlaying(false)
    if (stepTimerRef.current) { clearInterval(stepTimerRef.current); stepTimerRef.current = null }
    if (loopTimerRef.current) { clearInterval(loopTimerRef.current); loopTimerRef.current = null }
    setCurrentStep(0)
    lastPlayedStepRef.current = -1
  }, [])

  // ─── Test beat timer ───
  const testBeatRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const testBeatStepRef = useRef(0)

  useEffect(() => {
    if (testBeatOn && onPreviewDrum) {
      const stepMs = (60000 / projectBpm) / 4 // 16th note duration
      testBeatStepRef.current = 0
      testBeatRef.current = setInterval(() => {
        const step = testBeatStepRef.current % 16
        if (TEST_KICK_STEPS.includes(step)) onPreviewDrum('bd', 0.8)
        if (TEST_SNARE_STEPS.includes(step)) onPreviewDrum('sd', 0.6)
        if (TEST_HH_STEPS.includes(step)) onPreviewDrum('hh', 0.25)
        testBeatStepRef.current++
      }, stepMs)
    } else {
      if (testBeatRef.current) { clearInterval(testBeatRef.current); testBeatRef.current = null }
      testBeatStepRef.current = 0
    }
    return () => { if (testBeatRef.current) { clearInterval(testBeatRef.current); testBeatRef.current = null } }
  }, [testBeatOn, projectBpm, onPreviewDrum])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (stepTimerRef.current) clearInterval(stepTimerRef.current)
      if (loopTimerRef.current) clearInterval(loopTimerRef.current)
      if (testBeatRef.current) clearInterval(testBeatRef.current)
    }
  }, [])

  // ─── Apply recorded pattern to code ───
  const applyPattern = useCallback(() => {
    if (recordedHits.length === 0) return

    const pattern = buildSlicePattern(recordedHits, localChopCount, loopBars)

    // Extract orbit and other effects from existing code
    const orbitMatch = channelRawCode.match(/\.orbit\(\s*(\d+)\s*\)/)
    const orbit = orbitMatch ? orbitMatch[1] : '0'

    // Extract existing effects — keep them (but NOT speed/duck, we handle those)
    const effectsToKeep: string[] = []
    const effectRegex = /\.(gain|room|delay|delaytime|delayfeedback|lpf|lpq|shape|pan|vowel|crush|hpf)\(\s*([^)]+)\s*\)/g
    let m
    while ((m = effectRegex.exec(channelRawCode)) !== null) {
      effectsToKeep.push(`.${m[1]}(${m[2]})`)
    }

    // Build channel name
    const nameMatch = channelRawCode.match(/^\s*\$(\w+):/)
    const name = nameMatch ? nameMatch[1] : channelName

    // Pitch shift via .speed() — speed = 2^(semitones/12)
    let pitchStr = ''
    if (pitchSemitones !== 0) {
      const spd = Math.pow(2, pitchSemitones / 12)
      pitchStr = `\n  .speed(${spd.toFixed(4)})`
    }

    // Sidechain via .duck()
    let sidechainStr = ''
    if (sidechainEnabled) {
      sidechainStr = `\n  .duck("${sidechainOrbit}").duckdepth(${sidechainDepth.toFixed(2)})`
    }

    // slice(N, pat) divides sample into N equal-length parts; second arg selects which part
    const effectsStr = effectsToKeep.length > 0 ? '\n  ' + effectsToKeep.join('\n  ') : ''
    const newCode = `$${name}: s("${sampleName}")\n  .slice(${localChopCount}, "${pattern}")\n  .loopAt(${loopBars})${pitchStr}${sidechainStr}${effectsStr}\n  .orbit(${orbit})._scope()`

    onPatternChange(newCode)
    setHasEdited(false)
  }, [recordedHits, localChopCount, loopBars, sampleName, channelRawCode, channelName, onPatternChange, pitchSemitones, sidechainEnabled, sidechainOrbit, sidechainDepth])

  // ─── Clear recorded pattern ───
  const clearPattern = useCallback(() => {
    setRecordedHits([])
    setHasEdited(true)
  }, [])

  // ─── Parse existing pattern from code ───
  useEffect(() => {
    // Try to parse slice(N, "...") or n("...") pattern from the channel code
    const sliceMatch = channelRawCode.match(/\.slice\(\s*\d+\s*,\s*"([^"]*)"\s*\)/)
    const nMatch = sliceMatch || channelRawCode.match(/\bn\(\s*"([^"]*)"\s*\)/)
    if (!nMatch) return

    const pattern = nMatch[1]
    if (!pattern || pattern === '~') return

    // Parse the pattern into hits
    const parsedHits: RecordedHit[] = []
    const isMultiBar = pattern.startsWith('<') && pattern.endsWith('>')

    if (isMultiBar) {
      const inner = pattern.slice(1, -1).trim()
      // Split by top-level entries
      const entries: string[] = []
      let depth = 0, cur = ''
      for (const ch of inner) {
        if (ch === '[') { depth++; cur += ch }
        else if (ch === ']') { depth--; cur += ch }
        else if (ch === ' ' && depth === 0) { if (cur.trim()) entries.push(cur.trim()); cur = '' }
        else cur += ch
      }
      if (cur.trim()) entries.push(cur.trim())

      entries.forEach((entry, barIdx) => {
        const clean = entry.startsWith('[') && entry.endsWith(']') ? entry.slice(1, -1).trim() : entry
        const tokens = clean.split(/\s+/)
        tokens.forEach((tok, s) => {
          if (tok !== '~') {
            const padIdx = parseInt(tok)
            if (!isNaN(padIdx) && padIdx >= 0 && padIdx < localChopCount) {
              parsedHits.push({ padIdx, step: barIdx * STEPS_PER_BAR + s })
            }
          }
        })
      })
      setLoopBars(Math.max(1, entries.length))
    } else {
      const tokens = pattern.split(/\s+/)
      tokens.forEach((tok, s) => {
        if (tok !== '~') {
          const padIdx = parseInt(tok)
          if (!isNaN(padIdx) && padIdx >= 0 && padIdx < localChopCount) {
            parsedHits.push({ padIdx, step: s })
          }
        }
      })
    }

    if (parsedHits.length > 0) {
      setRecordedHits(parsedHits)
    }
  }, []) // Only on mount

  // ─── Keyboard shortcuts for pads ───
  useEffect(() => {
    const keyMap: Record<string, number> = {
      '1': 0, '2': 1, '3': 2, '4': 3,
      'q': 4, 'w': 5, 'e': 6, 'r': 7,
      'a': 8, 's': 9, 'd': 10, 'f': 11,
      'z': 12, 'x': 13, 'c': 14, 'v': 15,
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return

      const padIdx = keyMap[e.key.toLowerCase()]
      if (padIdx !== undefined && padIdx < padLayout) {
        e.preventDefault()
        playPad(padIdx)
        // Also set as selected pad for grid painting
        setSelectedPad(padIdx)
      }

      // Space = toggle record
      if (e.key === ' ') {
        e.preventDefault()
        if (isRecording || isPlaying) stopLoop()
        else startLoop(true)
      }

      // Escape = deselect pad
      if (e.key === 'Escape') {
        setSelectedPad(null)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [playPad, padLayout, isRecording, isPlaying, startLoop, stopLoop])

  // ─── Grid visualization of recorded hits ───
  const gridCols = padLayout <= 4 ? 2 : 4
  const gridRows = Math.ceil(padLayout / gridCols)
  const visibleChops = chops.slice(0, padLayout)

  // Progress bar percentage
  const progressPct = totalSteps > 0 ? (currentStep / totalSteps) * 100 : 0

  // ─── Step sequencer mini-grid for recorded hits ───
  const miniGridBars = useMemo(() => {
    const bars: { bar: number; steps: (number | null)[] }[] = []
    for (let b = 0; b < loopBars; b++) {
      const steps: (number | null)[] = []
      for (let s = 0; s < STEPS_PER_BAR; s++) {
        const step = b * STEPS_PER_BAR + s
        const hit = recordedHits.find(h => h.step === step)
        steps.push(hit ? hit.padIdx : null)
      }
      bars.push({ bar: b, steps })
    }
    return bars
  }, [recordedHits, loopBars])

  // ═══════════════════════════════════════════════════════════════
  //  RENDER
  // ═══════════════════════════════════════════════════════════════

  return (
    <div
      className="w-full flex flex-col"
      style={{
        background: '#0d0e12',
        borderTop: `1px solid ${color}30`,
      }}
    >
      {/* ─── Header ─── */}
      <div className="flex items-center gap-2 px-3 py-1.5 shrink-0"
        style={{ background: '#0a0b0d', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        {/* Title */}
        <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color }}>
          🎛️ PAD SAMPLER
        </span>
        <span className="text-[8px] font-mono" style={{ color: '#5a616b' }}>
          {channelName}
        </span>
        <span className="text-[7px] font-mono px-1.5 py-0.5 rounded"
          style={{ background: '#16181d', color: '#5a616b' }}>
          {sampleName}
        </span>

        <div className="flex-1" />

        {/* Pad count selector */}
        <span className="text-[7px] uppercase tracking-wider font-bold" style={{ color: '#5a616b' }}>Pads</span>
        {([4, 8, 16] as const).map(p => (
          <button
            key={p}
            onClick={() => setPadLayout(p)}
            className="px-1.5 py-0.5 text-[8px] font-bold cursor-pointer transition-all"
            style={{
              background: padLayout === p ? '#16181d' : '#0a0b0d',
              color: padLayout === p ? color : '#5a616b',
              border: 'none',
              borderRadius: '8px',
              boxShadow: padLayout === p
                ? 'inset 2px 2px 4px #050607, inset -2px -2px 4px #1a1d22'
                : '2px 2px 4px #050607, -2px -2px 4px #1a1d22',
            }}
          >
            {p}
          </button>
        ))}

        <div className="w-px h-3.5 bg-white/[0.08]" />

        {/* Loop length selector */}
        <span className="text-[7px] uppercase tracking-wider font-bold" style={{ color: '#5a616b' }}>Loop</span>
        {LOOP_BAR_OPTIONS.map(b => (
          <button
            key={b}
            onClick={() => { setLoopBars(b); setHasEdited(true) }}
            className="px-1.5 py-0.5 text-[8px] font-bold cursor-pointer transition-all"
            style={{
              background: loopBars === b ? '#16181d' : '#0a0b0d',
              color: loopBars === b ? color : '#5a616b',
              border: 'none',
              borderRadius: '8px',
              boxShadow: loopBars === b
                ? 'inset 2px 2px 4px #050607, inset -2px -2px 4px #1a1d22'
                : '2px 2px 4px #050607, -2px -2px 4px #1a1d22',
            }}
          >
            {b}
          </button>
        ))}

        <div className="w-px h-3.5 bg-white/[0.08]" />

        {/* Quantize toggle */}
        <button
          onClick={() => setQuantize(q => !q)}
          className="px-2 py-0.5 text-[8px] font-bold cursor-pointer transition-all rounded-lg"
          style={{
            background: quantize ? '#16181d' : '#0a0b0d',
            color: quantize ? '#4ade80' : '#5a616b',
            boxShadow: quantize
              ? 'inset 2px 2px 4px #050607, inset -2px -2px 4px #1a1d22'
              : '2px 2px 4px #050607, -2px -2px 4px #1a1d22',
          }}
          title="Quantize recorded hits to grid"
        >
          Q
        </button>

        <div className="w-px h-3.5 bg-white/[0.08]" />

        {/* Transport controls */}
        {/* PLAY button — plays back pattern with audio */}
        <button
          onClick={isPlaying && !isRecording ? stopLoop : () => startLoop(false)}
          className="px-2.5 py-0.5 text-[8px] font-bold cursor-pointer transition-all rounded-lg flex items-center gap-1"
          style={{
            background: isPlaying && !isRecording ? '#16493020' : '#16181d',
            color: isPlaying && !isRecording ? '#4ade80' : '#5a616b',
            boxShadow: isPlaying && !isRecording
              ? 'inset 2px 2px 4px #050607, inset -2px -2px 4px #1a1d22'
              : '2px 2px 4px #050607, -2px -2px 4px #1a1d22',
          }}
          title="Play back recorded pattern with audio"
        >
          {isPlaying && !isRecording ? '⏹ STOP' : '▶ PLAY'}
        </button>
        {/* REC button */}
        <button
          onClick={isRecording ? stopLoop : () => startLoop(true)}
          className="px-2.5 py-0.5 text-[8px] font-bold cursor-pointer transition-all rounded-lg flex items-center gap-1"
          style={{
            background: isRecording ? '#7f1d1d' : '#16181d',
            color: isRecording ? '#fca5a5' : '#ef4444',
            boxShadow: isRecording
              ? 'inset 2px 2px 4px #050607, inset -2px -2px 4px #1a1d22'
              : '2px 2px 4px #050607, -2px -2px 4px #1a1d22',
            ...(isRecording ? { animation: 'pulse 1s ease-in-out infinite' } : {}),
          }}
          title="Record (Space)"
        >
          ⏺ {isRecording ? 'STOP' : 'REC'}
        </button>

        {/* Apply button */}
        {recordedHits.length > 0 && (
          <button
            onClick={applyPattern}
            className="px-2.5 py-0.5 text-[8px] font-bold cursor-pointer transition-all rounded-lg"
            style={{
              background: '#16181d',
              color: '#4ade80',
              boxShadow: '2px 2px 4px #050607, -2px -2px 4px #1a1d22',
            }}
            title="Apply recorded pattern to channel code"
          >
            ✓ APPLY
          </button>
        )}

        {/* Clear button */}
        {recordedHits.length > 0 && (
          <button
            onClick={clearPattern}
            className="px-2 py-0.5 text-[8px] font-bold cursor-pointer transition-all rounded-lg"
            style={{
              background: '#16181d',
              color: '#f87171',
              boxShadow: '2px 2px 4px #050607, -2px -2px 4px #1a1d22',
            }}
            title="Clear all recorded hits"
          >
            ✕
          </button>
        )}

        {/* Close button */}
        <button
          onClick={onClose}
          className="px-1 py-0.5 text-[9px] cursor-pointer transition-all hover:text-white/60"
          style={{ color: '#5a616b' }}
          title="Close pad sampler"
        >
          ✕
        </button>
      </div>

      {/* ─── Progress bar (when recording) ─── */}
      {isPlaying && (
        <div className="h-0.5 w-full relative" style={{ background: '#16181d' }}>
          <div
            className="absolute top-0 left-0 h-full transition-none"
            style={{
              width: `${progressPct}%`,
              background: isRecording ? '#ef4444' : color,
            }}
          />
        </div>
      )}

      {/* ─── Main content: Pads + Mini grid ─── */}
      <div className="flex gap-3 px-3 py-2" style={{ minHeight: 200 }}>
        {/* Pad grid */}
        <div
          className="shrink-0 grid gap-1.5"
          style={{
            gridTemplateColumns: `repeat(${gridCols}, 1fr)`,
            gridTemplateRows: `repeat(${gridRows}, 1fr)`,
          }}
        >
          {visibleChops.map(chop => {
            const isFlashing = flashPad === chop.idx
            const hasHits = recordedHits.some(h => h.padIdx === chop.idx)
            const isSelected = selectedPad === chop.idx
            const keyHint = ['1','2','3','4','Q','W','E','R','A','S','D','F','Z','X','C','V'][chop.idx]

            return (
              <button
                key={chop.idx}
                onMouseDown={() => {
                  playPad(chop.idx)
                  setSelectedPad(chop.idx)
                }}
                className="relative cursor-pointer transition-all duration-75 active:scale-95 select-none"
                style={{
                  width: padLayout <= 4 ? 72 : padLayout <= 8 ? 56 : 44,
                  height: padLayout <= 4 ? 72 : padLayout <= 8 ? 56 : 44,
                  background: isFlashing ? chop.color : isSelected ? chop.color + '25' : '#16181d',
                  borderRadius: '10px',
                  boxShadow: isFlashing
                    ? `inset 2px 2px 4px ${chop.color}80, 0 0 12px ${chop.color}40`
                    : isSelected
                    ? `inset 2px 2px 4px #050607, inset -2px -2px 4px #1a1d22, 0 0 8px ${chop.color}30`
                    : '3px 3px 6px #050607, -3px -3px 6px #1a1d22',
                  border: `1px solid ${isSelected ? chop.color + '80' : hasHits ? chop.color + '40' : 'rgba(255,255,255,0.04)'}`,
                }}
                title={`Pad ${chop.idx + 1} (${keyHint}) · slice ${(chop.begin * 100).toFixed(0)}%–${(chop.end * 100).toFixed(0)}%${isSelected ? ' · SELECTED (click grid to paint)' : ''}`}
              >
                {/* Pad number */}
                <span className="text-[10px] font-bold font-mono" style={{ color: isFlashing ? '#fff' : isSelected ? chop.color : chop.color + '90' }}>
                  {chop.label}
                </span>
                {/* Key hint */}
                <span className="absolute bottom-1 right-1.5 text-[6px] font-mono" style={{ color: '#5a616b' }}>
                  {keyHint}
                </span>
                {/* Hit indicator dot */}
                {hasHits && (
                  <span className="absolute top-1 right-1.5 w-1.5 h-1.5 rounded-full" style={{ background: chop.color }} />
                )}
                {/* Selected indicator */}
                {isSelected && (
                  <span className="absolute top-0.5 left-1 text-[5px] font-black" style={{ color: chop.color }}>✎</span>
                )}
              </button>
            )
          })}
        </div>

        {/* Mini step grid — shows recorded pattern */}
        <div className="flex-1 overflow-x-auto overflow-y-hidden">
          <div className="flex flex-col gap-0.5" style={{ minWidth: loopBars * STEPS_PER_BAR * 12 }}>
            {/* Bar labels */}
            <div className="flex">
              {miniGridBars.map(({ bar }) => (
                <div key={bar} className="flex-shrink-0 text-[6px] font-mono text-center"
                  style={{ width: STEPS_PER_BAR * 12, color: '#5a616b' }}>
                  Bar {bar + 1}
                </div>
              ))}
            </div>

            {/* Step cells */}
            <div className="flex">
              {miniGridBars.map(({ bar, steps }) => (
                <div key={bar} className="flex flex-shrink-0">
                  {steps.map((padIdx, s) => {
                    const globalStep = bar * STEPS_PER_BAR + s
                    const isCurrentStep = isPlaying && currentStep === globalStep
                    const isBarLine = s % 4 === 0
                    const hitColor = padIdx !== null ? chops[padIdx]?.color || color : undefined

                    return (
                      <div
                        key={s}
                        className="relative cursor-pointer transition-colors"
                        onClick={() => {
                          setRecordedHits(prev => {
                            const existing = prev.find(h => h.step === globalStep)
                            if (existing) {
                              // Click on existing hit = remove it
                              return prev.filter(h => h.step !== globalStep)
                            }
                            // Paint with selected pad if one is active
                            if (selectedPad !== null && selectedPad < padLayout) {
                              // Preview the pad sound on paint
                              if (onPreviewPad) {
                                const chop = chops[selectedPad]
                                if (chop) {
                                  const pitchSpeed = pitchSemitones !== 0 ? Math.pow(2, pitchSemitones / 12) : undefined
                                  onPreviewPad(sampleName, chop.begin, chop.end, pitchSpeed)
                                }
                              }
                              return [...prev, { padIdx: selectedPad, step: globalStep }]
                            }
                            return prev
                          })
                          setHasEdited(true)
                        }}
                        style={{
                          width: 11,
                          height: 20,
                          cursor: selectedPad !== null ? 'crosshair' : 'pointer',
                          background: hitColor
                            ? hitColor + (isCurrentStep ? 'cc' : '80')
                            : isCurrentStep ? '#ffffff15' : (s % 4 === 0 ? '#1a1d22' : '#14161a'),
                          borderLeft: isBarLine ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(255,255,255,0.02)',
                          borderRadius: '2px',
                        }}
                        title={`Step ${globalStep + 1}${padIdx !== null ? ` · Pad ${padIdx + 1}` : ''}`}
                      >
                        {padIdx !== null && (
                          <span className="absolute inset-0 flex items-center justify-center text-[5px] font-mono font-bold" style={{ color: '#fff' }}>
                            {padIdx + 1}
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>

            {/* Playback position indicator */}
            {isPlaying && (
              <div className="relative h-0.5" style={{ width: loopBars * STEPS_PER_BAR * 12 }}>
                <div
                  className="absolute top-0 h-full w-0.5"
                  style={{
                    left: currentStep * 12,
                    background: isRecording ? '#ef4444' : color,
                    transition: 'left 50ms linear',
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── Tools Row: Chops / Pitch / Transport / Sidechain / Test Beat ─── */}
      <div className="flex items-center gap-2 px-3 py-1.5 flex-wrap"
        style={{ background: '#0c0d10', borderTop: '1px solid rgba(255,255,255,0.03)' }}>

        {/* ── CHOPS selector ── */}
        <div className="flex items-center gap-1.5">
          <span className="text-[7px] font-bold uppercase tracking-widest" style={{ color: '#5a616b' }}>CHOPS</span>
          {CHOP_OPTIONS.map(c => (
            <button
              key={c}
              onClick={() => { setLocalChopCount(c); setHasEdited(true) }}
              className="px-1.5 py-0.5 text-[8px] font-bold cursor-pointer transition-all"
              style={{
                background: localChopCount === c ? `${color}20` : '#0a0b0d',
                color: localChopCount === c ? color : '#5a616b',
                border: 'none',
                borderRadius: '6px',
                boxShadow: localChopCount === c
                  ? `inset 2px 2px 4px #050607, inset -2px -2px 4px #1a1d22, 0 0 6px ${color}20`
                  : '2px 2px 4px #050607, -2px -2px 4px #1a1d22',
              }}
            >
              {c}
            </button>
          ))}
        </div>

        <div className="w-px h-4 bg-white/[0.06]" />

        {/* ── PITCH knob (semitones) ── */}
        <div className="flex items-center gap-1.5">
          <span className="text-[7px] font-bold uppercase tracking-widest" style={{ color: '#5a616b' }}>PITCH</span>
          <button
            onClick={() => setPitchSemitones(p => Math.max(-24, p - 1))}
            className="w-4 h-4 flex items-center justify-center text-[9px] font-bold cursor-pointer rounded"
            style={{
              background: '#16181d', color: '#818cf8', border: 'none',
              boxShadow: '2px 2px 4px #050607, -2px -2px 4px #1a1d22',
            }}
          >−</button>
          <input
            type="range"
            min={-24}
            max={24}
            step={1}
            value={pitchSemitones}
            onChange={e => setPitchSemitones(parseInt(e.target.value))}
            className="w-20 h-1 rounded-full appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, #818cf8 ${((pitchSemitones + 24) / 48) * 100}%, #16181d ${((pitchSemitones + 24) / 48) * 100}%)`,
              accentColor: '#818cf8',
            }}
          />
          <button
            onClick={() => setPitchSemitones(p => Math.min(24, p + 1))}
            className="w-4 h-4 flex items-center justify-center text-[9px] font-bold cursor-pointer rounded"
            style={{
              background: '#16181d', color: '#818cf8', border: 'none',
              boxShadow: '2px 2px 4px #050607, -2px -2px 4px #1a1d22',
            }}
          >+</button>
          <span className="text-[9px] font-mono font-bold w-10 text-center px-1 py-0.5 rounded"
            style={{
              background: pitchSemitones !== 0 ? '#818cf820' : '#16181d',
              color: pitchSemitones !== 0 ? '#818cf8' : '#5a616b',
            }}>
            {pitchSemitones > 0 ? '+' : ''}{pitchSemitones} st
          </span>
          {pitchSemitones !== 0 && (
            <button
              onClick={() => setPitchSemitones(0)}
              className="text-[7px] font-bold cursor-pointer px-1 py-0.5 rounded"
              style={{ background: '#16181d', color: '#f87171', border: 'none' }}
              title="Reset pitch to 0"
            >RST</button>
          )}
        </div>

        <div className="w-px h-4 bg-white/[0.06]" />

        {/* ── PLAY WITH SONG ── */}
        {onToggleTransport && (
          <button
            onClick={() => {
              // Auto-apply pattern before toggling transport so vocal plays with song
              if (!isTransportPlaying && recordedHits.length > 0) {
                applyPattern()
              }
              onToggleTransport()
            }}
            className="flex items-center gap-1 px-2 py-0.5 text-[8px] font-bold cursor-pointer transition-all rounded-lg"
            style={{
              background: isTransportPlaying ? '#4ade8020' : '#16181d',
              color: isTransportPlaying ? '#4ade80' : '#5a616b',
              boxShadow: isTransportPlaying
                ? `inset 2px 2px 4px #050607, inset -2px -2px 4px #1a1d22, 0 0 8px #4ade8020`
                : '2px 2px 4px #050607, -2px -2px 4px #1a1d22',
            }}
            title={isTransportPlaying ? 'Stop song playback' : 'Apply pattern & play full song — test vocal pitch against the mix'}
          >
            {isTransportPlaying ? '⏹' : '▶'} PLAY W/ SONG
          </button>
        )}

        <div className="w-px h-4 bg-white/[0.06]" />

        {/* ── TEST BEAT ── */}
        <button
          onClick={() => setTestBeatOn(t => !t)}
          className="flex items-center gap-1 px-2 py-0.5 text-[8px] font-bold cursor-pointer transition-all rounded-lg"
          style={{
            background: testBeatOn ? '#fb923c20' : '#16181d',
            color: testBeatOn ? '#fb923c' : '#5a616b',
            boxShadow: testBeatOn
              ? 'inset 2px 2px 4px #050607, inset -2px -2px 4px #1a1d22'
              : '2px 2px 4px #050607, -2px -2px 4px #1a1d22',
            ...(testBeatOn ? { animation: 'pulse 2s ease-in-out infinite' } : {}),
          }}
          title="Play a simple kick-snare-hihat pattern at project BPM to test vocal timing"
        >
          🥁 TEST BEAT
        </button>

        <div className="w-px h-4 bg-white/[0.06]" />

        {/* ── SIDECHAIN ── */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => { setSidechainEnabled(s => !s); setHasEdited(true) }}
            className="flex items-center gap-1 px-2 py-0.5 text-[8px] font-bold cursor-pointer transition-all rounded-lg"
            style={{
              background: sidechainEnabled ? '#7fa99820' : '#16181d',
              color: sidechainEnabled ? '#7fa998' : '#5a616b',
              boxShadow: sidechainEnabled
                ? 'inset 2px 2px 4px #050607, inset -2px -2px 4px #1a1d22'
                : '2px 2px 4px #050607, -2px -2px 4px #1a1d22',
            }}
            title="Sidechain duck this vocal to a drum orbit — vocal ducks when the kick hits"
          >
            🦆 DUCK
          </button>
          {sidechainEnabled && (
            <>
              <span className="text-[6px] font-bold" style={{ color: '#5a616b' }}>ORB</span>
              <select
                value={sidechainOrbit}
                onChange={e => { setSidechainOrbit(parseInt(e.target.value)); setHasEdited(true) }}
                className="text-[8px] font-mono px-1 py-0.5 rounded cursor-pointer outline-none"
                style={{ background: '#16181d', color: '#7fa998', border: '1px solid rgba(255,255,255,0.05)' }}
              >
                {[0,1,2,3,4,5].map(o => <option key={o} value={o}>Orbit {o}</option>)}
              </select>
              <span className="text-[6px] font-bold" style={{ color: '#5a616b' }}>DEPTH</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={sidechainDepth}
                onChange={e => { setSidechainDepth(parseFloat(e.target.value)); setHasEdited(true) }}
                className="w-12 h-1 rounded-full appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, #7fa998 ${sidechainDepth * 100}%, #16181d ${sidechainDepth * 100}%)`,
                  accentColor: '#7fa998',
                }}
              />
              <span className="text-[7px] font-mono" style={{ color: '#7fa998' }}>
                {sidechainDepth.toFixed(2)}
              </span>
            </>
          )}
        </div>
      </div>

      {/* ─── Keyboard hints + selected pad indicator ─── */}
      <div className="flex items-center gap-3 px-3 pb-1.5">
        <span className="text-[6px] font-mono" style={{ color: '#3a3f48' }}>
          KEYS: 1-4 / Q-R / A-F / Z-V = pads · SPACE = record · ESC = deselect
        </span>
        {selectedPad !== null && (
          <span className="flex items-center gap-1 text-[7px] font-bold px-1.5 py-0.5 rounded"
            style={{ background: chops[selectedPad]?.color + '20', color: chops[selectedPad]?.color }}>
            ✎ Pad {selectedPad + 1} — click grid to paint
          </span>
        )}
        <div className="flex-1" />
        <span className="text-[7px] font-mono" style={{ color: '#5a616b' }}>
          {recordedHits.length} hits · {loopBars} bars · {totalSteps} steps
        </span>
        {hasEdited && recordedHits.length > 0 && (
          <span className="text-[7px] font-bold" style={{ color: '#facc15' }}>
            unsaved
          </span>
        )}
      </div>
    </div>
  )
}
