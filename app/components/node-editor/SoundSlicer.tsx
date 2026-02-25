'use client'

import { useState, useRef, useCallback, useEffect, useMemo } from 'react'

// ═══════════════════════════════════════════════════════════════
//  NDE SOUND SLICER
//
//  Displays the waveform of a node's custom audio sample.
//  Users can scroll/zoom the waveform, set start/end markers
//  to define the sample region, and audition the selection.
//
//  The selection maps to Strudel .begin()/.end() or .slice().
// ═══════════════════════════════════════════════════════════════

interface SoundSlicerProps {
  /** URL of the audio file to slice (optional if soundName resolves via API) */
  audioUrl?: string
  /** Display name for the sound */
  soundName: string
  /** Node accent colour */
  nodeColor: string
  /** Current begin value (0–1) */
  begin?: number
  /** Current end value (0–1) */
  end?: number
  /** When the user changes the selection region */
  onRegionChange: (begin: number, end: number) => void
  /** Close the slicer panel */
  onClose: () => void
}

const HW = {
  bg: '#0a0a0c',
  surface: '#131316',
  surfaceAlt: '#18181b',
  raised: '#1e1e22',
  border: '#2a2a30',
  textBright: '#f4f4f5',
  text: '#a1a1aa',
  textDim: '#52525b',
}

const WAVEFORM_H = 100
const SLICER_H = 180

export default function SoundSlicer({
  audioUrl: propUrl,
  soundName,
  nodeColor,
  begin: initBegin = 0,
  end: initEnd = 1,
  onRegionChange,
  onClose,
}: SoundSlicerProps) {
  const [resolvedUrl, setResolvedUrl] = useState(propUrl || '')
  const [waveformData, setWaveformData] = useState<Float32Array | null>(null)
  const [duration, setDuration] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [begin, setBegin] = useState(initBegin)
  const [end, setEnd] = useState(initEnd)
  const [isAuditioning, setIsAuditioning] = useState(false)
  const [playbackPos, setPlaybackPos] = useState(0) // 0–1 within full sample
  const [zoom, setZoom] = useState(1)        // 1 = fit all, >1 = zoomed in
  const [scrollX, setScrollX] = useState(0)  // 0–1 normalised scroll position

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const audioBufferRef = useRef<AudioBuffer | null>(null)
  const sourceRef = useRef<AudioBufferSourceNode | null>(null)
  const rafRef = useRef<number>(0)
  const dragRef = useRef<'begin' | 'end' | 'region' | null>(null)
  const dragStartRef = useRef({ x: 0, begin: 0, end: 0 })

  // Resolve URL from API if not provided directly
  useEffect(() => {
    if (propUrl) { setResolvedUrl(propUrl); return }
    // Fetch user's samples and find matching name
    fetch('/api/nde/samples')
      .then(r => r.json())
      .then(data => {
        const match = data.samples?.find((s: { name: string; url: string }) => s.name === soundName)
        if (match) setResolvedUrl(match.url)
        else setError(`Sample "${soundName}" not found`)
      })
      .catch(() => setError('Failed to resolve sample URL'))
  }, [propUrl, soundName])

  // Decode audio and extract waveform peaks
  useEffect(() => {
    if (!resolvedUrl) return
    setLoading(true)
    setError(null)

    const ctx = audioCtxRef.current || new AudioContext()
    audioCtxRef.current = ctx

    fetch(resolvedUrl)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.arrayBuffer()
      })
      .then(buf => ctx.decodeAudioData(buf))
      .then(decoded => {
        audioBufferRef.current = decoded
        setDuration(decoded.duration)
        // Down-sample to ~800 peak values for waveform display
        const ch = decoded.getChannelData(0)
        const buckets = 800
        const perBucket = Math.max(1, Math.floor(ch.length / buckets))
        const peaks = new Float32Array(buckets)
        for (let b = 0; b < buckets; b++) {
          let max = 0
          const start = b * perBucket
          for (let i = start; i < start + perBucket && i < ch.length; i++) {
            const v = Math.abs(ch[i])
            if (v > max) max = v
          }
          peaks[b] = max
        }
        setWaveformData(peaks)
        setLoading(false)
      })
      .catch(err => {
        console.error('[SoundSlicer] decode error:', err)
        setError('Failed to load audio')
        setLoading(false)
      })

    return () => {
      // Don't close AudioContext — might be shared
    }
  }, [resolvedUrl])

  // Draw waveform
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !waveformData) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    canvas.width = w * dpr
    canvas.height = h * dpr
    ctx.scale(dpr, dpr)

    ctx.clearRect(0, 0, w, h)

    const totalBuckets = waveformData.length
    // Visible range (normalised 0–1)
    const viewSpan = 1 / zoom
    const viewStart = scrollX
    const viewEnd = Math.min(1, viewStart + viewSpan)

    // Map to bucket indices
    const bStart = Math.floor(viewStart * totalBuckets)
    const bEnd = Math.ceil(viewEnd * totalBuckets)
    const visibleCount = bEnd - bStart
    const pxPerBucket = w / visibleCount

    // Draw region background (selected area)
    const regionLeft = Math.max(0, ((begin - viewStart) / viewSpan) * w)
    const regionRight = Math.min(w, ((end - viewStart) / viewSpan) * w)
    if (regionRight > 0 && regionLeft < w) {
      ctx.fillStyle = `${nodeColor}15`
      ctx.fillRect(regionLeft, 0, regionRight - regionLeft, h)
    }

    // Draw waveform bars
    const mid = h / 2
    for (let i = 0; i < visibleCount; i++) {
      const idx = bStart + i
      if (idx < 0 || idx >= totalBuckets) continue
      const peak = waveformData[idx]
      const x = i * pxPerBucket
      const barH = peak * mid * 0.9
      const normPos = (viewStart + (i / visibleCount) * viewSpan)
      const inRegion = normPos >= begin && normPos <= end

      ctx.fillStyle = inRegion ? `${nodeColor}cc` : 'rgba(255,255,255,0.15)'
      ctx.fillRect(x, mid - barH, Math.max(1, pxPerBucket - 0.5), barH * 2)
    }

    // Draw begin/end markers
    const drawMarker = (pos: number, label: string, color: string) => {
      const x = ((pos - viewStart) / viewSpan) * w
      if (x < -2 || x > w + 2) return
      ctx.strokeStyle = color
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, h)
      ctx.stroke()
      // Handle triangle
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.moveTo(x - 6, 0)
      ctx.lineTo(x + 6, 0)
      ctx.lineTo(x, 10)
      ctx.closePath()
      ctx.fill()
      // Label
      ctx.font = '9px monospace'
      ctx.fillStyle = color
      ctx.fillText(label, x + 4, h - 4)
    }
    drawMarker(begin, `S ${(begin * duration).toFixed(2)}s`, '#22d3ee')
    drawMarker(end, `E ${(end * duration).toFixed(2)}s`, '#f59e0b')

    // Draw playback position
    if (isAuditioning && playbackPos >= viewStart && playbackPos <= viewEnd) {
      const px = ((playbackPos - viewStart) / viewSpan) * w
      ctx.strokeStyle = '#ef4444'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(px, 0)
      ctx.lineTo(px, h)
      ctx.stroke()
    }
  }, [waveformData, begin, end, zoom, scrollX, nodeColor, duration, isAuditioning, playbackPos])

  // Convert screen X to normalised position (0–1)
  const xToNorm = useCallback((clientX: number): number => {
    const canvas = canvasRef.current
    if (!canvas) return 0
    const rect = canvas.getBoundingClientRect()
    const px = clientX - rect.left
    const viewSpan = 1 / zoom
    return scrollX + (px / rect.width) * viewSpan
  }, [zoom, scrollX])

  // Mouse handling for dragging markers / region
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const norm = xToNorm(e.clientX)
    const threshold = 0.015 / zoom // adaptive threshold

    if (Math.abs(norm - begin) < threshold) {
      dragRef.current = 'begin'
    } else if (Math.abs(norm - end) < threshold) {
      dragRef.current = 'end'
    } else if (norm > begin && norm < end) {
      dragRef.current = 'region'
      dragStartRef.current = { x: e.clientX, begin, end }
    } else {
      // Click outside region — set new begin
      const newB = Math.max(0, Math.min(1, norm))
      setBegin(newB)
      dragRef.current = 'end'
    }
  }, [xToNorm, begin, end, zoom])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragRef.current) return
    const norm = Math.max(0, Math.min(1, xToNorm(e.clientX)))

    if (dragRef.current === 'begin') {
      setBegin(Math.min(norm, end - 0.005))
    } else if (dragRef.current === 'end') {
      setEnd(Math.max(norm, begin + 0.005))
    } else if (dragRef.current === 'region') {
      const canvas = canvasRef.current
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      const dx = (e.clientX - dragStartRef.current.x) / rect.width / zoom
      const newB = Math.max(0, dragStartRef.current.begin + dx)
      const span = dragStartRef.current.end - dragStartRef.current.begin
      const newE = Math.min(1, newB + span)
      setBegin(newE - span >= 0 ? newE - span : newB)
      setEnd(newE)
    }
  }, [xToNorm, begin, end, zoom])

  const handleMouseUp = useCallback(() => {
    if (dragRef.current) {
      dragRef.current = null
      onRegionChange(begin, end)
    }
  }, [begin, end, onRegionChange])

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [handleMouseMove, handleMouseUp])

  // Zoom with mouse wheel
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? -0.2 : 0.2
    setZoom(prev => {
      const newZoom = Math.max(1, Math.min(20, prev + delta * prev))
      // Keep cursor position stable
      const canvas = canvasRef.current
      if (canvas) {
        const rect = canvas.getBoundingClientRect()
        const cursorRatio = (e.clientX - rect.left) / rect.width
        const oldSpan = 1 / prev
        const newSpan = 1 / newZoom
        const cursorNorm = scrollX + cursorRatio * oldSpan
        setScrollX(Math.max(0, Math.min(1 - newSpan, cursorNorm - cursorRatio * newSpan)))
      }
      return newZoom
    })
  }, [scrollX])

  // Scroll bar for zoomed view
  const handleScrollBar = useCallback((e: React.MouseEvent) => {
    const target = e.currentTarget
    const rect = target.getBoundingClientRect()
    const ratio = (e.clientX - rect.left) / rect.width
    const viewSpan = 1 / zoom
    setScrollX(Math.max(0, Math.min(1 - viewSpan, ratio - viewSpan / 2)))
  }, [zoom])

  // Audition selection
  const audition = useCallback(() => {
    if (!audioBufferRef.current || !audioCtxRef.current) return
    // Stop any current playback
    if (sourceRef.current) {
      try { sourceRef.current.stop() } catch {}
    }
    cancelAnimationFrame(rafRef.current)

    const ctx = audioCtxRef.current
    if (ctx.state === 'suspended') ctx.resume()

    const buf = audioBufferRef.current
    const source = ctx.createBufferSource()
    source.buffer = buf
    source.connect(ctx.destination)

    const startSec = begin * buf.duration
    const endSec = end * buf.duration
    const durSec = endSec - startSec

    source.start(0, startSec, durSec)
    sourceRef.current = source
    setIsAuditioning(true)

    const startTime = ctx.currentTime
    const tick = () => {
      const elapsed = ctx.currentTime - startTime
      if (elapsed >= durSec) {
        setIsAuditioning(false)
        setPlaybackPos(0)
        return
      }
      setPlaybackPos(begin + (elapsed / durSec) * (end - begin))
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)

    source.onended = () => {
      setIsAuditioning(false)
      setPlaybackPos(0)
      cancelAnimationFrame(rafRef.current)
    }
  }, [begin, end])

  const stopAudition = useCallback(() => {
    if (sourceRef.current) {
      try { sourceRef.current.stop() } catch {}
    }
    cancelAnimationFrame(rafRef.current)
    setIsAuditioning(false)
    setPlaybackPos(0)
  }, [])

  // Computed info
  const regionDuration = useMemo(() => duration * (end - begin), [duration, begin, end])
  const viewSpan = 1 / zoom

  return (
    <div className="flex flex-col select-none" style={{ height: SLICER_H, background: HW.bg, borderTop: `1px solid ${nodeColor}30` }}
      onClick={e => e.stopPropagation()}>

      {/* Header */}
      <div className="flex items-center justify-between px-2 py-1 shrink-0"
        style={{ background: HW.surfaceAlt, borderBottom: `1px solid ${HW.border}` }}>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px]">🔊</span>
          <span className="text-[9px] font-bold" style={{ color: nodeColor }}>{soundName}</span>
          <span className="text-[8px] font-mono px-1 py-px rounded" style={{ color: HW.textDim, background: HW.bg }}>
            {duration.toFixed(1)}s
          </span>
        </div>
        <div className="flex items-center gap-1">
          {/* Audition */}
          <button onClick={isAuditioning ? stopAudition : audition}
            className="px-2 py-0.5 rounded text-[8px] font-bold cursor-pointer"
            style={{
              color: isAuditioning ? '#ef4444' : '#22c55e',
              background: isAuditioning ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.08)',
              border: `1px solid ${isAuditioning ? 'rgba(239,68,68,0.2)' : 'rgba(34,197,94,0.2)'}`,
            }}>
            {isAuditioning ? '⏹ Stop' : '▶ Play'}
          </button>
          <button onClick={onClose}
            className="w-5 h-5 flex items-center justify-center rounded text-[9px] cursor-pointer"
            style={{ background: HW.raised, color: HW.textDim, border: `1px solid ${HW.border}` }}>
            ✕
          </button>
        </div>
      </div>

      {/* Waveform canvas */}
      <div ref={containerRef} className="flex-1 relative min-h-0 cursor-crosshair"
        onWheel={handleWheel}>
        {loading ? (
          <div className="flex items-center justify-center h-full text-[10px]" style={{ color: HW.textDim }}>
            Loading waveform…
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full text-[10px]" style={{ color: '#ef4444' }}>
            {error}
          </div>
        ) : (
          <canvas
            ref={canvasRef}
            className="w-full h-full"
            style={{ display: 'block' }}
            onMouseDown={handleMouseDown}
          />
        )}
      </div>

      {/* Footer: region info + zoom scroll bar */}
      <div className="flex items-center gap-2 px-2 py-1 shrink-0"
        style={{ background: HW.surfaceAlt, borderTop: `1px solid ${HW.border}` }}>
        {/* Region info */}
        <div className="flex items-center gap-2 text-[8px] font-mono" style={{ color: HW.text }}>
          <span style={{ color: '#22d3ee' }}>S: {(begin * duration).toFixed(2)}s</span>
          <span style={{ color: HW.textDim }}>→</span>
          <span style={{ color: '#f59e0b' }}>E: {(end * duration).toFixed(2)}s</span>
          <span style={{ color: nodeColor }}>({regionDuration.toFixed(2)}s)</span>
        </div>

        <div className="flex-1" />

        {/* Zoom scroll bar */}
        {zoom > 1.05 && (
          <div className="relative h-2 rounded-full cursor-pointer" style={{ width: 100, background: HW.raised }}
            onMouseDown={handleScrollBar}>
            <div className="absolute top-0 h-full rounded-full"
              style={{
                left: `${scrollX * 100}%`,
                width: `${viewSpan * 100}%`,
                background: `${nodeColor}40`,
                border: `1px solid ${nodeColor}60`,
              }} />
          </div>
        )}

        {/* Zoom controls */}
        <button onClick={() => setZoom(z => Math.max(1, z * 0.7))}
          className="w-4 h-4 flex items-center justify-center rounded text-[8px] cursor-pointer"
          style={{ color: HW.textDim, background: HW.raised }}>−</button>
        <span className="text-[7px] w-6 text-center" style={{ color: HW.textDim }}>{zoom.toFixed(1)}×</span>
        <button onClick={() => setZoom(z => Math.min(20, z * 1.4))}
          className="w-4 h-4 flex items-center justify-center rounded text-[8px] cursor-pointer"
          style={{ color: HW.textDim, background: HW.raised }}>+</button>

        {/* Apply .begin/.end */}
        <button onClick={() => { onRegionChange(begin, end); onClose() }}
          className="px-2 py-0.5 rounded text-[8px] font-bold cursor-pointer"
          style={{ background: `${nodeColor}20`, color: nodeColor, border: `1px solid ${nodeColor}40` }}>
          ✓ Apply
        </button>
      </div>
    </div>
  )
}
