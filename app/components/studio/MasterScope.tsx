'use client'

import { useRef, useEffect, useCallback, useState } from 'react'

// ─── Scope type definitions ───
const SCOPE_TYPES = [
  { id: 'waveform', label: 'WAVE', icon: '∿' },
  { id: 'bars', label: 'FREQ', icon: '▮' },
  { id: 'circular', label: 'RING', icon: '◎' },
  { id: 'lissajous', label: 'XY', icon: '∞' },
  { id: 'mirror', label: 'MIRROR', icon: '⬡' },
] as const

type ScopeType = typeof SCOPE_TYPES[number]['id']

interface MasterScopeProps {
  analyserNode: AnalyserNode | null
  isPlaying: boolean
}

export default function MasterScope({ analyserNode, isPlaying }: MasterScopeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)
  const [scopeType, setScopeType] = useState<ScopeType>('waveform')
  const scopeTypeRef = useRef<ScopeType>(scopeType)
  const peakRef = useRef(0)
  const historyRef = useRef<Float32Array[]>([])

  useEffect(() => { scopeTypeRef.current = scopeType }, [scopeType])

  const cycleScope = useCallback(() => {
    setScopeType(prev => {
      const idx = SCOPE_TYPES.findIndex(s => s.id === prev)
      return SCOPE_TYPES[(idx + 1) % SCOPE_TYPES.length].id
    })
  }, [])

  // ── Main draw loop ──
  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const w = canvas.width
    const h = canvas.height
    const type = scopeTypeRef.current

    // Clear with slight trail for smoothness
    ctx.fillStyle = 'rgba(10, 11, 13, 0.3)'
    ctx.fillRect(0, 0, w, h)

    if (!isPlaying || !analyserNode) {
      // Idle state — subtle center line
      ctx.strokeStyle = 'rgba(127, 169, 152, 0.08)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(0, h / 2)
      ctx.lineTo(w, h / 2)
      ctx.stroke()

      // Idle label
      ctx.fillStyle = 'rgba(90, 97, 107, 0.3)'
      ctx.font = '9px monospace'
      ctx.textAlign = 'center'
      ctx.fillText('SCOPE', w / 2, h / 2 + 3)
      rafRef.current = requestAnimationFrame(draw)
      return
    }

    const bufLen = analyserNode.frequencyBinCount
    const timeData = new Uint8Array(bufLen)
    const freqData = new Uint8Array(bufLen)
    analyserNode.getByteTimeDomainData(timeData)
    analyserNode.getByteFrequencyData(freqData)

    // Compute peak
    let maxAmp = 0
    for (let i = 0; i < timeData.length; i++) {
      const abs = Math.abs(timeData[i] - 128)
      if (abs > maxAmp) maxAmp = abs
    }
    peakRef.current = Math.max(maxAmp, peakRef.current * 0.92)

    // Accent color based on peak amplitude
    const intensity = Math.min(1, peakRef.current / 80)
    const accentR = Math.round(127 + 50 * intensity)
    const accentG = Math.round(169 - 30 * intensity)
    const accentB = Math.round(152 - 40 * intensity)
    const accent = `rgb(${accentR}, ${accentG}, ${accentB})`
    const accentDim = `rgba(${accentR}, ${accentG}, ${accentB}, 0.15)`
    const accentGlow = `rgba(${accentR}, ${accentG}, ${accentB}, 0.4)`

    switch (type) {
      case 'waveform':
        drawWaveform(ctx, timeData, w, h, accent, accentDim, accentGlow, intensity)
        break
      case 'bars':
        drawBars(ctx, freqData, w, h, accent, intensity)
        break
      case 'circular':
        drawCircular(ctx, timeData, w, h, accent, accentGlow, intensity)
        break
      case 'lissajous':
        drawLissajous(ctx, timeData, w, h, accent, accentGlow, intensity, historyRef)
        break
      case 'mirror':
        drawMirror(ctx, timeData, w, h, accent, accentDim, accentGlow, intensity)
        break
    }

    rafRef.current = requestAnimationFrame(draw)
  }, [analyserNode, isPlaying])

  useEffect(() => {
    rafRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(rafRef.current)
  }, [draw])

  const currentScope = SCOPE_TYPES.find(s => s.id === scopeType) || SCOPE_TYPES[0]

  return (
    <div
      className="shrink-0 relative cursor-pointer select-none group"
      style={{
        height: '48px',
        background: '#0a0b0d',
        borderTop: '1px solid rgba(255,255,255,0.04)',
        boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.4)',
      }}
      onClick={cycleScope}
      title={`Click to change scope · ${currentScope.label}`}
    >
      <canvas
        ref={canvasRef}
        width={800}
        height={48}
        className="w-full h-full"
        style={{ display: 'block' }}
      />
      {/* Scope type label */}
      <div
        className="absolute top-1 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
        style={{ pointerEvents: 'none' }}
      >
        <span className="text-[8px] font-black uppercase tracking-[.15em] px-1.5 py-0.5 rounded-full"
          style={{
            color: '#7fa998',
            background: 'rgba(10, 11, 13, 0.8)',
            border: '1px solid rgba(127,169,152,0.15)',
          }}
        >
          {currentScope.icon} {currentScope.label}
        </span>
      </div>
      {/* Scanline texture overlay */}
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 1px, rgba(0,0,0,0.1) 1px, rgba(0,0,0,0.1) 2px)',
        opacity: 0.3,
      }} />
    </div>
  )
}


// ════════════════════════════════════════════════
//  Drawing functions for each scope type
// ════════════════════════════════════════════════

function drawWaveform(
  ctx: CanvasRenderingContext2D,
  data: Uint8Array,
  w: number, h: number,
  accent: string, accentDim: string, accentGlow: string,
  intensity: number
) {
  const cy = h / 2

  // Subtle center line
  ctx.strokeStyle = accentDim
  ctx.lineWidth = 0.5
  ctx.beginPath()
  ctx.moveTo(0, cy)
  ctx.lineTo(w, cy)
  ctx.stroke()

  // Glow layer
  ctx.strokeStyle = accentGlow
  ctx.lineWidth = 3 + intensity * 2
  ctx.beginPath()
  for (let x = 0; x < w; x++) {
    const idx = Math.floor((x / w) * data.length)
    const v = (data[idx] - 128) / 128
    const y = cy + v * cy * 0.85
    if (x === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.stroke()

  // Sharp line
  ctx.strokeStyle = accent
  ctx.lineWidth = 1.5
  ctx.beginPath()
  for (let x = 0; x < w; x++) {
    const idx = Math.floor((x / w) * data.length)
    const v = (data[idx] - 128) / 128
    const y = cy + v * cy * 0.85
    if (x === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.stroke()

  // Fill below waveform
  ctx.lineTo(w, cy)
  ctx.lineTo(0, cy)
  ctx.closePath()
  const grad = ctx.createLinearGradient(0, 0, 0, h)
  grad.addColorStop(0, 'rgba(127, 169, 152, 0.06)')
  grad.addColorStop(0.5, 'rgba(127, 169, 152, 0.02)')
  grad.addColorStop(1, 'rgba(127, 169, 152, 0.06)')
  ctx.fillStyle = grad
  ctx.fill()
}

function drawBars(
  ctx: CanvasRenderingContext2D,
  data: Uint8Array,
  w: number, h: number,
  accent: string,
  intensity: number
) {
  const barCount = 48
  const barWidth = w / barCount - 1
  const barGap = 1

  for (let i = 0; i < barCount; i++) {
    // Map bar index to frequency data
    const dataIdx = Math.floor((i / barCount) * data.length * 0.6)
    const val = data[dataIdx] / 255

    const barH = val * h * 0.9
    const x = i * (barWidth + barGap)
    const y = h - barH

    // Gradient by frequency position
    const hue = 150 + (i / barCount) * 40 // Teal to green range
    const sat = 30 + intensity * 20
    const lum = 25 + val * 30

    ctx.fillStyle = `hsla(${hue}, ${sat}%, ${lum}%, ${0.4 + val * 0.5})`
    ctx.fillRect(x, y, barWidth, barH)

    // Top cap
    if (barH > 2) {
      ctx.fillStyle = accent
      ctx.fillRect(x, y, barWidth, 1.5)
    }
  }
}

function drawCircular(
  ctx: CanvasRenderingContext2D,
  data: Uint8Array,
  w: number, h: number,
  accent: string, accentGlow: string,
  intensity: number
) {
  const cx = w / 2
  const cy = h / 2
  const baseR = Math.min(cx, cy) * 0.5
  const points = data.length

  // Glow
  ctx.strokeStyle = accentGlow
  ctx.lineWidth = 2 + intensity * 2
  ctx.beginPath()
  for (let i = 0; i <= points; i++) {
    const angle = (i / points) * Math.PI * 2 - Math.PI / 2
    const val = (data[i % points] - 128) / 128
    const r = baseR + val * baseR * 0.7
    const x = cx + Math.cos(angle) * r
    const y = cy + Math.sin(angle) * r
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.closePath()
  ctx.stroke()

  // Sharp line
  ctx.strokeStyle = accent
  ctx.lineWidth = 1
  ctx.beginPath()
  for (let i = 0; i <= points; i++) {
    const angle = (i / points) * Math.PI * 2 - Math.PI / 2
    const val = (data[i % points] - 128) / 128
    const r = baseR + val * baseR * 0.7
    const x = cx + Math.cos(angle) * r
    const y = cy + Math.sin(angle) * r
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.closePath()
  ctx.stroke()

  // Center dot
  ctx.fillStyle = accent
  ctx.beginPath()
  ctx.arc(cx, cy, 1.5 + intensity, 0, Math.PI * 2)
  ctx.fill()
}

function drawLissajous(
  ctx: CanvasRenderingContext2D,
  data: Uint8Array,
  w: number, h: number,
  accent: string, accentGlow: string,
  intensity: number,
  historyRef: React.MutableRefObject<Float32Array[]>
) {
  const cx = w / 2
  const cy = h / 2
  const scale = Math.min(cx, cy) * 0.7

  // Create X/Y from time data (odd=X, even=Y for pseudo-stereo Lissajous)
  const halfLen = Math.floor(data.length / 2)
  const current = new Float32Array(halfLen * 2)

  for (let i = 0; i < halfLen; i++) {
    current[i * 2] = (data[i * 2] - 128) / 128
    current[i * 2 + 1] = (data[i * 2 + 1] - 128) / 128
  }

  // Draw trail from history
  const history = historyRef.current
  history.push(current)
  if (history.length > 3) history.shift()

  for (let hi = 0; hi < history.length; hi++) {
    const frame = history[hi]
    const alpha = (hi + 1) / (history.length + 1) * 0.4
    ctx.strokeStyle = `rgba(127, 169, 152, ${alpha})`
    ctx.lineWidth = 0.5
    ctx.beginPath()
    for (let i = 0; i < halfLen; i++) {
      const x = cx + frame[i * 2] * scale
      const y = cy + frame[i * 2 + 1] * scale
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()
  }

  // Current frame
  ctx.strokeStyle = accentGlow
  ctx.lineWidth = 2
  ctx.beginPath()
  for (let i = 0; i < halfLen; i++) {
    const x = cx + current[i * 2] * scale
    const y = cy + current[i * 2 + 1] * scale
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.stroke()

  ctx.strokeStyle = accent
  ctx.lineWidth = 1
  ctx.beginPath()
  for (let i = 0; i < halfLen; i++) {
    const x = cx + current[i * 2] * scale
    const y = cy + current[i * 2 + 1] * scale
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.stroke()
}

function drawMirror(
  ctx: CanvasRenderingContext2D,
  data: Uint8Array,
  w: number, h: number,
  accent: string, accentDim: string, accentGlow: string,
  intensity: number
) {
  const cy = h / 2

  // Draw mirrored waveform (top half + bottom half reflection)
  // Glow layer
  ctx.strokeStyle = accentGlow
  ctx.lineWidth = 2 + intensity

  // Top waveform
  ctx.beginPath()
  for (let x = 0; x < w; x++) {
    const idx = Math.floor((x / w) * data.length)
    const v = Math.abs((data[idx] - 128) / 128)
    const y = cy - v * cy * 0.85
    if (x === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.stroke()

  // Bottom reflection
  ctx.beginPath()
  for (let x = 0; x < w; x++) {
    const idx = Math.floor((x / w) * data.length)
    const v = Math.abs((data[idx] - 128) / 128)
    const y = cy + v * cy * 0.85
    if (x === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.stroke()

  // Sharp lines
  ctx.strokeStyle = accent
  ctx.lineWidth = 1

  ctx.beginPath()
  for (let x = 0; x < w; x++) {
    const idx = Math.floor((x / w) * data.length)
    const v = Math.abs((data[idx] - 128) / 128)
    const y = cy - v * cy * 0.85
    if (x === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.stroke()

  ctx.beginPath()
  for (let x = 0; x < w; x++) {
    const idx = Math.floor((x / w) * data.length)
    const v = Math.abs((data[idx] - 128) / 128)
    const y = cy + v * cy * 0.85
    if (x === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.stroke()

  // Fill between
  ctx.beginPath()
  for (let x = 0; x < w; x++) {
    const idx = Math.floor((x / w) * data.length)
    const v = Math.abs((data[idx] - 128) / 128)
    const y = cy - v * cy * 0.85
    if (x === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  for (let x = w - 1; x >= 0; x--) {
    const idx = Math.floor((x / w) * data.length)
    const v = Math.abs((data[idx] - 128) / 128)
    const y = cy + v * cy * 0.85
    ctx.lineTo(x, y)
  }
  ctx.closePath()
  const grad = ctx.createLinearGradient(0, 0, 0, h)
  grad.addColorStop(0, `rgba(127, 169, 152, ${0.05 + intensity * 0.1})`)
  grad.addColorStop(0.5, 'rgba(127, 169, 152, 0.02)')
  grad.addColorStop(1, `rgba(127, 169, 152, ${0.05 + intensity * 0.1})`)
  ctx.fillStyle = grad
  ctx.fill()

  // Center line
  ctx.strokeStyle = accentDim
  ctx.lineWidth = 0.5
  ctx.beginPath()
  ctx.moveTo(0, cy)
  ctx.lineTo(w, cy)
  ctx.stroke()
}
