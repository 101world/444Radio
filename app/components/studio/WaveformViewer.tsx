'use client'

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { detectPitch, semitonesBetweenRoots, semitonesToSpeed, type PitchResult } from '@/lib/pitch-detection'

interface WaveformViewerProps {
  url: string
  isOpen: boolean
  onClose: () => void
  /** Current begin value (0â€“1), from the channel code */
  beginValue?: number
  /** Current end value (0â€“1), from the channel code */
  endValue?: number
  /** Current .speed() value from the channel code */
  speedValue?: number
  /** Original BPM of the sample (stored metadata) */
  sampleBpm?: number
  /** Current project BPM */
  projectBpm?: number
  /** Called when user applies â€” writes begin/end/speed into channel code */
  onApply?: (params: { begin: number; end: number; speed: number }) => void
  /** Channel color accent */
  color?: string
  /** Sample name for display */
  sampleName?: string
  /** Project master scale root (e.g. "C", "F#") for auto-pitch */
  scaleRoot?: string | null
}

/** Semitones from speed ratio: 12 Ã— logâ‚‚(speed) */
function speedToSemitones(speed: number): number {
  return 12 * Math.log2(speed)
}

export default function WaveformViewer({
  url, isOpen, onClose,
  beginValue = 0, endValue = 1,
  speedValue = 1, sampleBpm, projectBpm,
  onApply, color = '#22d3ee', sampleName,
  scaleRoot = null,
}: WaveformViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const waveformRef = useRef<{ min: number; max: number }[]>([])
  const audioCtxRef = useRef<AudioContext | null>(null)
  const audioBufferRef = useRef<AudioBuffer | null>(null)
  const sourceRef = useRef<AudioBufferSourceNode | null>(null)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [begin, setBegin] = useState(beginValue)
  const [end, setEnd] = useState(endValue)
  const [speed, setSpeed] = useState(speedValue)
  const [dragging, setDragging] = useState<'begin' | 'end' | null>(null)
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false)
  const [isLooping, setIsLooping] = useState(false)
  const [duration, setDuration] = useState(0)
  const [showBeatGrid, setShowBeatGrid] = useState(true)
  const [snapToBeats, setSnapToBeats] = useState(false)
  const [manualBpm, setManualBpm] = useState<number | null>(null)
  const [tapTimes, setTapTimes] = useState<number[]>([])
  const [tapBpm, setTapBpm] = useState<number | null>(null)
  const [detectedPitch, setDetectedPitch] = useState<PitchResult | null>(null)
  const [isDetectingPitch, setIsDetectingPitch] = useState(false)

  // Effective sample BPM: manual override > tap tempo > auto-detected > null
  const effectiveSampleBpm = manualBpm ?? tapBpm ?? sampleBpm ?? null

  // Computed pitch shift from speed
  const pitchShiftSt = useMemo(() => speedToSemitones(speed), [speed])

  // BPM-mismatch pitch shift (what loopAt causes)
  const bpmPitchShift = useMemo(() => {
    if (!effectiveSampleBpm || !projectBpm || effectiveSampleBpm === projectBpm) return null
    return 12 * Math.log2(projectBpm / effectiveSampleBpm)
  }, [effectiveSampleBpm, projectBpm])

  // Speed needed to compensate BPM pitch shift
  const compensationSpeed = useMemo(() => {
    if (!effectiveSampleBpm || !projectBpm || effectiveSampleBpm === projectBpm) return null
    return effectiveSampleBpm / projectBpm
  }, [effectiveSampleBpm, projectBpm])

  // Net pitch after both loopAt shift and speed compensation
  const netPitchSt = useMemo(() => {
    const fromSpeed = speedToSemitones(speed)
    const fromBpm = bpmPitchShift ?? 0
    return fromBpm + fromSpeed
  }, [speed, bpmPitchShift])

  // Sync from props when modal opens
  useEffect(() => {
    if (isOpen) {
      setBegin(beginValue)
      setEnd(endValue)
      setSpeed(speedValue)
      setManualBpm(null)
      setTapTimes([])
      setTapBpm(null)
    }
  }, [isOpen, beginValue, endValue, speedValue])

  // Beat positions (0-1 normalized) for the grid overlay
  const beatPositions = useMemo(() => {
    if (!showBeatGrid || !projectBpm || duration <= 0) return []
    const beatDuration = 60 / projectBpm // seconds per beat
    const positions: number[] = []
    for (let t = 0; t < duration; t += beatDuration) {
      positions.push(t / duration)
    }
    return positions
  }, [showBeatGrid, projectBpm, duration])

  // Snap a normalized position to nearest beat
  const snapToBeat = useCallback((pos: number): number => {
    if (!snapToBeats || beatPositions.length === 0) return pos
    let closest = pos
    let minDist = Infinity
    for (const bp of beatPositions) {
      const d = Math.abs(pos - bp)
      if (d < minDist) { minDist = d; closest = bp }
    }
    return closest
  }, [snapToBeats, beatPositions])

  // Tap tempo handler
  const handleTap = useCallback(() => {
    const now = performance.now()
    setTapTimes(prev => {
      const recent = prev.filter(t => now - t < 5000) // keep last 5s of taps
      const next = [...recent, now]
      if (next.length >= 3) {
        // Calculate average interval from consecutive taps
        const intervals: number[] = []
        for (let i = 1; i < next.length; i++) {
          intervals.push(next[i] - next[i - 1])
        }
        const avgMs = intervals.reduce((a, b) => a + b, 0) / intervals.length
        const bpm = Math.round(60000 / avgMs)
        if (bpm >= 40 && bpm <= 300) {
          setTapBpm(bpm)
          setManualBpm(null) // tap overrides manual until user types again
        }
      }
      return next
    })
  }, [])

  // ── Load audio + compute waveform ──
  useEffect(() => {
    if (!isOpen || !url) return
    setLoading(true)
    setError(null)

    const load = async () => {
      try {
        const resp = await fetch(url)
        const buf = await resp.arrayBuffer()
        if (!audioCtxRef.current) audioCtxRef.current = new AudioContext()
        const ab = await audioCtxRef.current.decodeAudioData(buf)
        audioBufferRef.current = ab
        setDuration(ab.duration)

        const ch = ab.getChannelData(0)
        const samples = 1200
        const block = Math.floor(ch.length / samples)
        const wave: { min: number; max: number }[] = []
        for (let i = 0; i < samples; i++) {
          const s = i * block
          let mn = 1, mx = -1
          for (let j = 0; j < block; j++) {
            const v = ch[s + j]
            if (v < mn) mn = v
            if (v > mx) mx = v
          }
          wave.push({ min: mn, max: mx })
        }
        waveformRef.current = wave
        drawWaveform()

        // Auto-detect pitch after audio loads
        setIsDetectingPitch(true)
        try {
          const pitchResult = detectPitch(ab, {
            regionStart: beginValue,
            regionEnd: endValue,
          })
          setDetectedPitch(pitchResult)
        } catch {
          setDetectedPitch(null)
        } finally {
          setIsDetectingPitch(false)
        }
      } catch {
        setError('Failed to load audio')
      } finally {
        setLoading(false)
      }
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, url])

  // â”€â”€ Draw waveform + trim overlay â”€â”€
  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const w = canvas.width, h = canvas.height, hh = h / 2
    const wave = waveformRef.current
    if (!wave.length) return

    ctx.clearRect(0, 0, w, h)

    // Background
    ctx.fillStyle = '#0c0e12'
    ctx.fillRect(0, 0, w, h)

    // Dimmed regions (outside trim)
    const bx = begin * w, ex = end * w
    ctx.fillStyle = 'rgba(0,0,0,0.65)'
    ctx.fillRect(0, 0, bx, h)
    ctx.fillRect(ex, 0, w - ex, h)

    // Center line
    ctx.strokeStyle = 'rgba(255,255,255,0.04)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, hh); ctx.lineTo(w, hh)
    ctx.stroke()

    // Waveform
    for (let i = 0; i < wave.length; i++) {
      const x = (i / wave.length) * w
      const inTrim = x >= bx && x <= ex
      ctx.strokeStyle = inTrim ? color : `${color}30`
      ctx.lineWidth = inTrim ? 1.5 : 0.8
      ctx.beginPath()
      ctx.moveTo(x, hh + wave[i].min * hh)
      ctx.lineTo(x, hh + wave[i].max * hh)
      ctx.stroke()
    }

    // Beat grid overlay
    if (beatPositions.length > 0) {
      const beatDur = projectBpm ? 60 / projectBpm : 0
      for (let i = 0; i < beatPositions.length; i++) {
        const bpx = beatPositions[i] * w
        const isBar = i % 4 === 0 // every 4 beats = bar line
        ctx.strokeStyle = isBar ? 'rgba(255,200,50,0.35)' : 'rgba(255,200,50,0.12)'
        ctx.lineWidth = isBar ? 1.5 : 0.5
        ctx.beginPath()
        ctx.moveTo(bpx, 0)
        ctx.lineTo(bpx, h)
        ctx.stroke()
        // Bar number labels (every 4 beats)
        if (isBar && beatDur > 0) {
          const barNum = Math.floor(i / 4) + 1
          ctx.font = '8px monospace'
          ctx.fillStyle = 'rgba(255,200,50,0.4)'
          ctx.textAlign = 'center'
          ctx.fillText(`${barNum}`, bpx, 10)
        }
      }
    }

    // Begin handle
    ctx.fillStyle = '#10b981'
    ctx.fillRect(bx - 1.5, 0, 3, h)
    ctx.beginPath()
    ctx.moveTo(bx, 0); ctx.lineTo(bx + 10, 0); ctx.lineTo(bx, 12); ctx.closePath()
    ctx.fill()
    // End handle
    ctx.fillStyle = '#f43f5e'
    ctx.fillRect(ex - 1.5, 0, 3, h)
    ctx.beginPath()
    ctx.moveTo(ex, 0); ctx.lineTo(ex - 10, 0); ctx.lineTo(ex, 12); ctx.closePath()
    ctx.fill()

    // Time labels
    ctx.font = '10px monospace'
    ctx.fillStyle = '#10b981'
    ctx.textAlign = 'left'
    ctx.fillText(`${(begin * duration).toFixed(2)}s`, bx + 4, h - 4)
    ctx.fillStyle = '#f43f5e'
    ctx.textAlign = 'right'
    ctx.fillText(`${(end * duration).toFixed(2)}s`, ex - 4, h - 4)
  }, [begin, end, color, duration, beatPositions, projectBpm])

  // Redraw on trim change
  useEffect(() => { drawWaveform() }, [drawWaveform])

  // â”€â”€ Drag handles â”€â”€
  const getX = (e: MouseEvent | React.MouseEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return 0
    const rect = canvas.getBoundingClientRect()
    return Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    const x = getX(e)
    const bDist = Math.abs(x - begin)
    const eDist = Math.abs(x - end)
    if (bDist < 0.02 || (bDist < eDist && bDist < 0.05)) {
      setDragging('begin')
    } else if (eDist < 0.02 || eDist < 0.05) {
      setDragging('end')
    }
  }

  useEffect(() => {
    if (!dragging) return
    const onMove = (e: MouseEvent) => {
      const x = snapToBeat(getX(e))
      if (dragging === 'begin') setBegin(Math.min(x, end - 0.01))
      else setEnd(Math.max(x, begin + 0.01))
    }
    const onUp = () => setDragging(null)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [dragging, begin, end, snapToBeat])

  // â”€â”€ Preview trimmed audio at current speed â”€â”€
  const togglePreview = useCallback(() => {
    if (isPreviewPlaying && sourceRef.current) {
      sourceRef.current.stop()
      sourceRef.current = null
      setIsPreviewPlaying(false)
      return
    }
    if (!audioBufferRef.current || !audioCtxRef.current) return
    const src = audioCtxRef.current.createBufferSource()
    src.buffer = audioBufferRef.current
    src.playbackRate.value = speed
    src.loop = isLooping
    if (isLooping) {
      src.loopStart = begin * audioBufferRef.current.duration
      src.loopEnd = end * audioBufferRef.current.duration
    }
    src.connect(audioCtxRef.current.destination)
    const startTime = begin * audioBufferRef.current.duration
    const dur = (end - begin) * audioBufferRef.current.duration
    if (isLooping) {
      src.start(0, startTime)
    } else {
      src.start(0, startTime, dur / speed)
    }
    src.onended = () => { setIsPreviewPlaying(false); sourceRef.current = null }
    sourceRef.current = src
    setIsPreviewPlaying(true)
  }, [begin, end, speed, isPreviewPlaying, isLooping])

  // Stop preview on close
  useEffect(() => {
    if (!isOpen && sourceRef.current) {
      sourceRef.current.stop()
      sourceRef.current = null
      setIsPreviewPlaying(false)
    }
  }, [isOpen])

  // Re-detect pitch for the current trimmed region
  const redetectPitch = useCallback(() => {
    const ab = audioBufferRef.current
    if (!ab) return
    setIsDetectingPitch(true)
    try {
      const pitchResult = detectPitch(ab, {
        regionStart: begin,
        regionEnd: end,
      })
      setDetectedPitch(pitchResult)
    } catch {
      setDetectedPitch(null)
    } finally {
      setIsDetectingPitch(false)
    }
  }, [begin, end])

  // Auto-pitch to project scale root
  const autoPitchToScale = useCallback(() => {
    if (!detectedPitch || !scaleRoot) return
    const st = semitonesBetweenRoots(detectedPitch.noteName, scaleRoot)
    if (st === 0) return // already in key
    const pitchSpeed = semitonesToSpeed(st)
    // Combine with existing speed (preserve any BPM compensation)
    setSpeed(pitchSpeed)
  }, [detectedPitch, scaleRoot])

  // Computed: semitone offset from detected key to scale root
  const pitchToScaleOffset = useMemo(() => {
    if (!detectedPitch || !scaleRoot) return null
    return semitonesBetweenRoots(detectedPitch.noteName, scaleRoot)
  }, [detectedPitch, scaleRoot])

  const handleApply = () => {
    onApply?.({
      begin: Math.round(begin * 100) / 100,
      end: Math.round(end * 100) / 100,
      speed: Math.round(speed * 10000) / 10000,
    })
    onClose()
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-[999] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        ref={containerRef}
        className="w-full max-w-3xl mx-4 rounded-2xl overflow-hidden select-none"
        style={{
          background: '#050607',
          border: '1px solid rgba(255,255,255,0.06)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.7)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-[.15em]" style={{ color }}>
              TRIM / PITCH
            </span>
            {sampleName && (
              <span className="text-[9px] font-mono" style={{ color: 'rgba(255,255,255,0.3)' }}>
                {sampleName}
              </span>
            )}

            {/* Detected pitch badge */}
            {isDetectingPitch && (
              <span className="text-[8px] font-mono px-1.5 py-0.5 rounded animate-pulse"
                style={{ background: '#a78bfa15', color: '#a78bfa' }}>
                detecting…
              </span>
            )}
            {detectedPitch && !isDetectingPitch && (
              <span className="flex items-center gap-1.5">
                <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded"
                  style={{
                    background: detectedPitch.confidence > 0.7 ? '#22c55e18' : '#f59e0b18',
                    color: detectedPitch.confidence > 0.7 ? '#22c55e' : '#f59e0b',
                    border: `1px solid ${detectedPitch.confidence > 0.7 ? '#22c55e30' : '#f59e0b30'}`,
                  }}
                  title={`Detected: ${detectedPitch.noteString} (${detectedPitch.frequency}Hz) · confidence: ${(detectedPitch.confidence * 100).toFixed(0)}%${detectedPitch.cents !== 0 ? ` · ${detectedPitch.cents > 0 ? '+' : ''}${detectedPitch.cents}¢` : ''}`}
                >
                  🎵 {detectedPitch.noteString}
                  {detectedPitch.cents !== 0 && (
                    <span style={{ opacity: 0.6 }}> {detectedPitch.cents > 0 ? '+' : ''}{detectedPitch.cents}¢</span>
                  )}
                </span>
                {/* Re-detect button */}
                <button
                  onClick={redetectPitch}
                  className="text-[7px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded cursor-pointer transition-all hover:scale-105"
                  style={{ background: '#16181d', color: '#a78bfa', border: '1px solid #a78bfa25' }}
                  title="Re-detect pitch for current trim region"
                >
                  ↻
                </button>
                {/* Auto-pitch to scale button */}
                {scaleRoot && pitchToScaleOffset !== null && pitchToScaleOffset !== 0 && (
                  <button
                    onClick={autoPitchToScale}
                    className="text-[8px] font-bold uppercase tracking-wider px-2 py-0.5 rounded cursor-pointer transition-all hover:scale-105"
                    style={{
                      background: '#7fa99815',
                      color: '#7fa998',
                      border: '1px solid #7fa99830',
                    }}
                    title={`Pitch-shift ${detectedPitch.noteName}→${scaleRoot} (${pitchToScaleOffset > 0 ? '+' : ''}${pitchToScaleOffset}st)`}
                  >
                    → {scaleRoot} ({pitchToScaleOffset > 0 ? '+' : ''}{pitchToScaleOffset}st)
                  </button>
                )}
                {scaleRoot && pitchToScaleOffset === 0 && (
                  <span className="text-[7px] font-bold px-1.5 py-0.5 rounded" style={{ background: '#22c55e15', color: '#22c55e' }}>
                    ✓ in key
                  </span>
                )}
              </span>
            )}
            {!detectedPitch && !isDetectingPitch && !loading && (
              <button
                onClick={redetectPitch}
                className="text-[7px] font-bold uppercase tracking-wider px-2 py-0.5 rounded cursor-pointer transition-all hover:scale-105"
                style={{ background: '#16181d', color: '#a78bfa', border: '1px solid #a78bfa25' }}
                title="Detect sample pitch"
              >
                🎵 DETECT KEY
              </button>
            )}
          </div>
          <button onClick={onClose} className="text-white/20 hover:text-white/60 transition-colors cursor-pointer text-sm font-bold">
            ESC
          </button>
        </div>

        {/* Sync toolbar — beat grid, tap tempo, manual BPM, snap */}
        <div className="flex items-center gap-2 px-5 py-2 flex-wrap"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', background: '#0a0b0e' }}>
          {/* Beat grid toggle */}
          <button
            onClick={() => setShowBeatGrid(!showBeatGrid)}
            className="px-2 py-1 rounded text-[8px] font-bold uppercase tracking-wider cursor-pointer transition-all"
            style={{
              background: showBeatGrid ? '#ffc83220' : '#0a0b0d',
              color: showBeatGrid ? '#ffc832' : 'rgba(255,255,255,0.2)',
              border: `1px solid ${showBeatGrid ? '#ffc83240' : 'rgba(255,255,255,0.04)'}`,
            }}
          >
            GRID
          </button>

          {/* Snap to beats toggle */}
          <button
            onClick={() => setSnapToBeats(!snapToBeats)}
            className="px-2 py-1 rounded text-[8px] font-bold uppercase tracking-wider cursor-pointer transition-all"
            style={{
              background: snapToBeats ? '#10b98120' : '#0a0b0d',
              color: snapToBeats ? '#10b981' : 'rgba(255,255,255,0.2)',
              border: `1px solid ${snapToBeats ? '#10b98140' : 'rgba(255,255,255,0.04)'}`,
            }}
          >
            SNAP
          </button>

          {/* Loop toggle */}
          <button
            onClick={() => setIsLooping(!isLooping)}
            className="px-2 py-1 rounded text-[8px] font-bold uppercase tracking-wider cursor-pointer transition-all"
            style={{
              background: isLooping ? `${color}20` : '#0a0b0d',
              color: isLooping ? color : 'rgba(255,255,255,0.2)',
              border: `1px solid ${isLooping ? `${color}40` : 'rgba(255,255,255,0.04)'}`,
            }}
          >
            LOOP
          </button>

          <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.06)' }} />

          {/* Tap tempo */}
          <button
            onClick={handleTap}
            className="px-2.5 py-1 rounded text-[8px] font-bold uppercase tracking-wider cursor-pointer transition-all active:scale-95"
            style={{
              background: tapBpm ? '#a78bfa20' : '#0a0b0d',
              color: tapBpm ? '#a78bfa' : 'rgba(255,255,255,0.25)',
              border: `1px solid ${tapBpm ? '#a78bfa40' : 'rgba(255,255,255,0.04)'}`,
            }}
          >
            TAP {tapBpm ? `${tapBpm}` : ''}
          </button>

          {/* Manual BPM input */}
          <div className="flex items-center gap-1">
            <span className="text-[7px] font-bold uppercase tracking-[.1em]" style={{ color: 'rgba(255,255,255,0.2)' }}>
              BPM
            </span>
            <input
              type="number"
              min={40}
              max={300}
              step={1}
              placeholder={effectiveSampleBpm ? String(effectiveSampleBpm) : '—'}
              value={manualBpm ?? ''}
              onChange={e => {
                const v = parseInt(e.target.value)
                if (!isNaN(v) && v >= 40 && v <= 300) { setManualBpm(v); setTapBpm(null) }
                else if (e.target.value === '') { setManualBpm(null) }
              }}
              className="w-14 text-center text-[10px] font-mono rounded px-1 py-0.5 outline-none"
              style={{ background: '#0c0e12', color: effectiveSampleBpm ? '#a78bfa' : 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.08)' }}
            />
          </div>

          {/* Show detected/effective BPM info */}
          <div className="flex items-center gap-1 ml-auto">
            {sampleBpm && (
              <span className="text-[8px] font-mono px-1.5 py-0.5 rounded" style={{ background: '#16181d', color: 'rgba(255,255,255,0.25)' }}>
                detected: {sampleBpm}
              </span>
            )}
            {projectBpm && (
              <span className="text-[8px] font-mono px-1.5 py-0.5 rounded" style={{ background: '#16181d', color: 'rgba(255,255,255,0.25)' }}>
                project: {projectBpm}
              </span>
            )}
            {effectiveSampleBpm && projectBpm && effectiveSampleBpm !== projectBpm && (
              <span className="text-[8px] font-mono font-bold px-1.5 py-0.5 rounded" style={{
                background: '#f59e0b15',
                color: '#f59e0b',
              }}>
                {effectiveSampleBpm > projectBpm ? '-' : '+'}{Math.abs(12 * Math.log2(projectBpm / effectiveSampleBpm)).toFixed(1)}st
              </span>
            )}
          </div>
        </div>

        {/* Waveform canvas area */}
        <div className="px-4 py-3">
          {loading && (
            <div className="flex items-center justify-center h-[140px]" style={{ color: 'rgba(255,255,255,0.2)' }}>
              <span className="text-xs animate-pulse">Loading waveformâ€¦</span>
            </div>
          )}
          {error && (
            <div className="flex items-center justify-center h-[140px]" style={{ color: '#f43f5e' }}>
              <span className="text-xs">{error}</span>
            </div>
          )}
          <canvas
            ref={canvasRef}
            width={1200}
            height={140}
            className="w-full rounded-lg"
            style={{
              cursor: dragging ? 'ew-resize' : 'default',
              height: '140px',
            }}
            onMouseDown={handleMouseDown}
          />
        </div>

        {/* Speed / Pitch controls */}
        <div className="flex items-center gap-3 px-5 py-2"
          style={{ borderTop: '1px solid rgba(255,255,255,0.04)', background: '#18191d' }}>
          {/* Speed slider */}
          <div className="flex items-center gap-2 flex-1">
            <span className="text-[7px] font-bold uppercase tracking-[.1em] shrink-0" style={{ color: '#6f8fb3' }}>
              .speed
            </span>
            <input
              type="range"
              min={0.25}
              max={4}
              step={0.01}
              value={speed}
              onChange={e => setSpeed(parseFloat(e.target.value))}
              className="flex-1 h-1 rounded-full appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, #6f8fb3 ${((speed - 0.25) / 3.75) * 100}%, #16181d ${((speed - 0.25) / 3.75) * 100}%)`,
                accentColor: '#6f8fb3',
              }}
            />
            <input
              type="number"
              min={0.25}
              max={4}
              step={0.05}
              value={speed}
              onChange={e => {
                const v = parseFloat(e.target.value)
                if (!isNaN(v) && v >= 0.25 && v <= 4) setSpeed(v)
              }}
              className="w-14 text-center text-xs font-mono rounded px-1 py-0.5 outline-none"
              style={{ background: '#0c0e12', color: '#6f8fb3', border: '1px solid rgba(255,255,255,0.08)' }}
            />
          </div>

          {/* Pitch shift from speed */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[7px] font-bold uppercase tracking-[.1em]" style={{ color: 'rgba(255,255,255,0.2)' }}>
              PITCH
            </span>
            <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded" style={{
              background: Math.abs(pitchShiftSt) > 0.05 ? (Math.abs(pitchShiftSt) > 3 ? '#ef444420' : '#f59e0b20') : '#22c55e18',
              color: Math.abs(pitchShiftSt) > 0.05 ? (Math.abs(pitchShiftSt) > 3 ? '#ef4444' : '#f59e0b') : '#22c55e',
            }}>
              {pitchShiftSt > 0.05 ? '+' : ''}{Math.abs(pitchShiftSt) < 0.05 ? '0' : pitchShiftSt.toFixed(1)} st
            </span>
          </div>

          {/* BPM match button */}
          {compensationSpeed !== null && (
            <button
              onClick={() => setSpeed(compensationSpeed)}
              className="shrink-0 px-2 py-1 rounded-lg text-[8px] font-bold uppercase tracking-wider cursor-pointer transition-all hover:scale-105"
              style={{
                background: '#7fa99815',
                color: '#7fa998',
                border: '1px solid #7fa99830',
              }}
              title={`Set speed to ${compensationSpeed.toFixed(4)} to cancel BPM pitch shift (${effectiveSampleBpm}\u2192${projectBpm} BPM)`}
            >
              Match BPM
            </button>
          )}

          {/* Quick speed presets */}
          <div className="flex items-center gap-0.5 shrink-0">
            {[0.5, 1, 2].map(s => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                className="px-1.5 py-0.5 rounded text-[8px] font-mono cursor-pointer transition-all"
                style={{
                  background: Math.abs(speed - s) < 0.01 ? `${color}20` : '#0a0b0d',
                  color: Math.abs(speed - s) < 0.01 ? color : 'rgba(255,255,255,0.2)',
                  border: `1px solid ${Math.abs(speed - s) < 0.01 ? `${color}40` : 'rgba(255,255,255,0.04)'}`,
                }}
              >
                {s}Ã—
              </button>
            ))}
          </div>
        </div>

        {/* Net pitch info (when BPM mismatch exists) */}
        {bpmPitchShift !== null && (
          <div className="flex items-center justify-center gap-3 px-5 py-1.5 text-[9px] font-mono"
            style={{ borderTop: '1px solid rgba(255,255,255,0.02)', background: '#15171a' }}>
            <span style={{ color: 'rgba(255,255,255,0.15)' }}>
              loopAt pitch: <span style={{ color: '#f59e0b' }}>{bpmPitchShift > 0 ? '+' : ''}{bpmPitchShift.toFixed(1)}st</span>
            </span>
            <span style={{ color: 'rgba(255,255,255,0.08)' }}>+</span>
            <span style={{ color: 'rgba(255,255,255,0.15)' }}>
              speed: <span style={{ color: '#6f8fb3' }}>{pitchShiftSt > 0.05 ? '+' : ''}{pitchShiftSt.toFixed(1)}st</span>
            </span>
            <span style={{ color: 'rgba(255,255,255,0.08)' }}>=</span>
            <span style={{
              color: Math.abs(netPitchSt) < 0.2 ? '#22c55e' : Math.abs(netPitchSt) > 3 ? '#ef4444' : '#f59e0b',
              fontWeight: 700,
            }}>
              net: {netPitchSt > 0.05 ? '+' : ''}{Math.abs(netPitchSt) < 0.05 ? '0' : netPitchSt.toFixed(1)}st
              {Math.abs(netPitchSt) < 0.2 && ' âœ“'}
            </span>
          </div>
        )}

        {/* Controls bar */}
        <div className="flex items-center justify-between px-5 py-3"
          style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
          {/* Begin / End readouts */}
          <div className="flex items-center gap-4">
            <div className="flex flex-col items-center">
              <span className="text-[7px] font-bold uppercase tracking-[.1em]" style={{ color: '#10b981' }}>BEGIN</span>
              <span className="text-xs font-mono font-bold" style={{ color: '#10b981' }}>
                {begin.toFixed(2)}
              </span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-[7px] font-bold uppercase tracking-[.1em]" style={{ color: '#f43f5e' }}>END</span>
              <span className="text-xs font-mono font-bold" style={{ color: '#f43f5e' }}>
                {end.toFixed(2)}
              </span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-[7px] font-bold uppercase tracking-[.1em]" style={{ color: 'rgba(255,255,255,0.25)' }}>LENGTH</span>
              <span className="text-xs font-mono" style={{ color: 'rgba(255,255,255,0.25)' }}>
                {((end - begin) * duration).toFixed(2)}s
              </span>
            </div>
            {projectBpm && duration > 0 && (
              <div className="flex flex-col items-center">
                <span className="text-[7px] font-bold uppercase tracking-[.1em]" style={{ color: '#ffc832' }}>BEATS</span>
                <span className="text-xs font-mono font-bold" style={{ color: '#ffc832' }}>
                  {(((end - begin) * duration * projectBpm) / 60).toFixed(1)}
                </span>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            {/* Reset */}
            <button
              onClick={() => { setBegin(0); setEnd(1); setSpeed(1) }}
              className="px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider cursor-pointer transition-all"
              style={{
                background: '#0a0b0d',
                color: 'rgba(255,255,255,0.3)',
                border: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              Reset
            </button>
            {/* Preview */}
            <button
              onClick={togglePreview}
              className="px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider cursor-pointer transition-all"
              style={{
                background: isPreviewPlaying ? `${color}20` : '#0a0b0d',
                color: isPreviewPlaying ? color : 'rgba(255,255,255,0.4)',
                border: `1px solid ${isPreviewPlaying ? `${color}40` : 'rgba(255,255,255,0.06)'}`,
              }}
            >
              {isPreviewPlaying ? 'â–  Stop' : 'â–¶ Preview'}
            </button>
            {/* Apply */}
            <button
              onClick={handleApply}
              className="px-4 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider cursor-pointer transition-all active:scale-95"
              style={{
                background: `${color}20`,
                color,
                border: `1px solid ${color}40`,
                boxShadow: `0 0 12px ${color}15`,
              }}
            >
              Apply
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}