'use client'

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'

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
  const [duration, setDuration] = useState(0)

  // Computed pitch shift from speed
  const pitchShiftSt = useMemo(() => speedToSemitones(speed), [speed])

  // BPM-mismatch pitch shift (what loopAt causes)
  const bpmPitchShift = useMemo(() => {
    if (!sampleBpm || !projectBpm || sampleBpm === projectBpm) return null
    return 12 * Math.log2(projectBpm / sampleBpm)
  }, [sampleBpm, projectBpm])

  // Speed needed to compensate BPM pitch shift
  const compensationSpeed = useMemo(() => {
    if (!sampleBpm || !projectBpm || sampleBpm === projectBpm) return null
    return sampleBpm / projectBpm
  }, [sampleBpm, projectBpm])

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
    }
  }, [isOpen, beginValue, endValue, speedValue])

  // â”€â”€ Load audio + compute waveform â”€â”€
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
  }, [begin, end, color, duration])

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
      const x = getX(e)
      if (dragging === 'begin') setBegin(Math.min(x, end - 0.01))
      else setEnd(Math.max(x, begin + 0.01))
    }
    const onUp = () => setDragging(null)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [dragging, begin, end])

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
    src.playbackRate.value = speed // Strudel-style: speed changes pitch + time
    src.connect(audioCtxRef.current.destination)
    const startTime = begin * audioBufferRef.current.duration
    const dur = (end - begin) * audioBufferRef.current.duration
    src.start(0, startTime, dur / speed) // adjusted for speed
    src.onended = () => { setIsPreviewPlaying(false); sourceRef.current = null }
    sourceRef.current = src
    setIsPreviewPlaying(true)
  }, [begin, end, speed, isPreviewPlaying])

  // Stop preview on close
  useEffect(() => {
    if (!isOpen && sourceRef.current) {
      sourceRef.current.stop()
      sourceRef.current = null
      setIsPreviewPlaying(false)
    }
  }, [isOpen])

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
        {/* Header â€” minimal */}
        <div className="flex items-center justify-between px-5 py-3"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-[.15em]" style={{ color }}>
              âœ‚ TRIM / PITCH
            </span>
            {sampleName && (
              <span className="text-[9px] font-mono" style={{ color: 'rgba(255,255,255,0.3)' }}>
                {sampleName}
              </span>
            )}
          </div>
          <button onClick={onClose} className="text-white/20 hover:text-white/60 transition-colors cursor-pointer text-sm font-bold">
            ESC
          </button>
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
              title={`Set speed to ${compensationSpeed.toFixed(4)} to cancel BPM pitch shift (${sampleBpm}â†’${projectBpm} BPM)`}
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