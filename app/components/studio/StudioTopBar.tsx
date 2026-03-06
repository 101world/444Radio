'use client'

import { useRef, useEffect, useCallback, useState } from 'react'
import { Play, Square, Volume2, VolumeX, Zap, Code2, Circle } from 'lucide-react'

// â”€â”€â”€ Visualization modes â”€â”€â”€
const VIZ_MODES = [
  { id: 'waveform', label: 'WAVE' },
  { id: 'bars', label: 'BARS' },
  { id: 'mirror', label: 'MIRROR' },
  { id: 'circle', label: 'CIRCLE' },
  { id: 'dots', label: 'DOTS' },
  { id: 'line-fill', label: 'FILL' },
  { id: 'spectrum', label: 'SPECTRUM' },
  { id: 'scope-xy', label: 'LISSA' },
] as const

type VizMode = typeof VIZ_MODES[number]['id']

interface StudioTopBarProps {
  status: 'loading' | 'ready' | 'playing' | 'error'
  loadingMsg: string
  error: string | null
  isPlaying: boolean
  masterVolume: number
  codeVisible?: boolean
  analyserNode?: AnalyserNode | null
  onPlay: () => void
  onUpdate: () => void
  onVolumeChange: (v: number) => void
  onToggleCode?: () => void
  isRecording?: boolean
  onRecord?: () => void
}

export default function StudioTopBar({
  status,
  loadingMsg,
  error,
  isPlaying,
  masterVolume,
  codeVisible,
  analyserNode,
  onPlay,
  onUpdate,
  onVolumeChange,
  onToggleCode,
  isRecording = false,
  onRecord,
}: StudioTopBarProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)
  const [vizMode, setVizMode] = useState<VizMode>('waveform')

  const cycleVizMode = useCallback(() => {
    setVizMode(prev => {
      const idx = VIZ_MODES.findIndex(m => m.id === prev)
      return VIZ_MODES[(idx + 1) % VIZ_MODES.length].id
    })
  }, [])

  const vizLabel = VIZ_MODES.find(m => m.id === vizMode)?.label ?? 'WAVE'

  // â”€â”€ Drawing loop â”€â”€
  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const w = canvas.width
    const h = canvas.height
    ctx.clearRect(0, 0, w, h)

    if (!isPlaying || !analyserNode) {
      // Idle â€” dim flat line
      ctx.strokeStyle = 'rgba(127,169,152,0.12)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(0, h / 2)
      ctx.lineTo(w, h / 2)
      ctx.stroke()
      return
    }

    const bufLen = analyserNode.frequencyBinCount
    const timeData = new Uint8Array(bufLen)
    const freqData = new Uint8Array(bufLen)
    analyserNode.getByteTimeDomainData(timeData)
    analyserNode.getByteFrequencyData(freqData)

    switch (vizMode) {
      case 'waveform': {
        ctx.strokeStyle = '#7fa998'
        ctx.lineWidth = 1.5
        ctx.beginPath()
        const sw = w / bufLen
        for (let i = 0; i < bufLen; i++) {
          const v = timeData[i] / 128.0
          const y = (v * h) / 2
          if (i === 0) ctx.moveTo(i * sw, y); else ctx.lineTo(i * sw, y)
        }
        ctx.stroke()
        break
      }

      case 'bars': {
        const barCount = 48
        const barW = w / barCount
        for (let i = 0; i < barCount; i++) {
          const idx = Math.floor((i / barCount) * bufLen * 0.6)
          const val = freqData[idx] / 255
          const barH = val * h * 0.9
          const hue = 150 + i * 2
          ctx.fillStyle = `hsla(${hue}, 30%, 55%, ${0.3 + val * 0.5})`
          ctx.fillRect(i * barW + 1, h - barH, barW - 2, barH)
        }
        break
      }

      case 'mirror': {
        ctx.strokeStyle = '#7fa998'
        ctx.lineWidth = 1.2
        const sw2 = w / bufLen
        ctx.beginPath()
        for (let i = 0; i < bufLen; i++) {
          const v = (timeData[i] - 128) / 128
          const y = h / 2 - v * h / 2
          if (i === 0) ctx.moveTo(i * sw2, y); else ctx.lineTo(i * sw2, y)
        }
        ctx.stroke()
        ctx.strokeStyle = 'rgba(127,169,152,0.3)'
        ctx.beginPath()
        for (let i = 0; i < bufLen; i++) {
          const v = (timeData[i] - 128) / 128
          const y = h / 2 + v * h / 2
          if (i === 0) ctx.moveTo(i * sw2, y); else ctx.lineTo(i * sw2, y)
        }
        ctx.stroke()
        break
      }

      case 'circle': {
        const cx = w / 2, cy = h / 2
        const r = Math.min(cx, cy) * 0.7
        const slices = 128
        ctx.strokeStyle = '#7fa998'
        ctx.lineWidth = 1.2
        ctx.beginPath()
        for (let i = 0; i <= slices; i++) {
          const idx = Math.floor((i / slices) * bufLen)
          const v = (timeData[idx] - 128) / 128
          const angle = (i / slices) * Math.PI * 2 - Math.PI / 2
          const dist = r + v * r * 0.5
          const x = cx + Math.cos(angle) * dist
          const y = cy + Math.sin(angle) * dist
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
        }
        ctx.closePath()
        ctx.stroke()
        break
      }

      case 'dots': {
        const count = 64
        for (let i = 0; i < count; i++) {
          const idx = Math.floor((i / count) * bufLen * 0.6)
          const val = freqData[idx] / 255
          const x = (i / count) * w + w / count / 2
          const y = h / 2 - (timeData[idx] - 128) / 128 * h / 2.5
          const size = 1 + val * 3
          ctx.beginPath()
          ctx.arc(x, y, size, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(127,169,152,${0.2 + val * 0.6})`
          ctx.fill()
        }
        break
      }

      case 'line-fill': {
        const sw3 = w / bufLen
        ctx.beginPath()
        ctx.moveTo(0, h)
        for (let i = 0; i < bufLen; i++) {
          const v = timeData[i] / 128.0
          const y = (v * h) / 2
          ctx.lineTo(i * sw3, y)
        }
        ctx.lineTo(w, h)
        ctx.closePath()
        const grad = ctx.createLinearGradient(0, 0, 0, h)
        grad.addColorStop(0, 'rgba(127,169,152,0.25)')
        grad.addColorStop(1, 'rgba(127,169,152,0.02)')
        ctx.fillStyle = grad
        ctx.fill()
        ctx.strokeStyle = '#7fa998'
        ctx.lineWidth = 1
        ctx.beginPath()
        for (let i = 0; i < bufLen; i++) {
          const v = timeData[i] / 128.0
          const y = (v * h) / 2
          if (i === 0) ctx.moveTo(i * sw3, y); else ctx.lineTo(i * sw3, y)
        }
        ctx.stroke()
        break
      }

      case 'spectrum': {
        const barCount2 = 96
        const barW2 = w / barCount2
        for (let i = 0; i < barCount2; i++) {
          const idx = Math.floor((i / barCount2) * bufLen * 0.5)
          const val = freqData[idx] / 255
          const barH = val * h
          const grad = ctx.createLinearGradient(0, h - barH, 0, h)
          grad.addColorStop(0, `rgba(111,143,179,${val * 0.6})`)
          grad.addColorStop(1, `rgba(127,169,152,${val * 0.3})`)
          ctx.fillStyle = grad
          ctx.fillRect(i * barW2, h - barH, barW2 - 1, barH)
        }
        break
      }

      case 'scope-xy': {
        ctx.strokeStyle = 'rgba(127,169,152,0.5)'
        ctx.lineWidth = 1
        const cx2 = w / 2, cy2 = h / 2
        const scale = Math.min(cx2, cy2) * 0.8
        ctx.beginPath()
        for (let i = 0; i < bufLen - 1; i++) {
          const x = cx2 + ((timeData[i] - 128) / 128) * scale
          const y = cy2 + ((timeData[i + 1] - 128) / 128) * scale
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
        }
        ctx.stroke()
        break
      }
    }

    rafRef.current = requestAnimationFrame(draw)
  }, [isPlaying, analyserNode, vizMode])

  useEffect(() => {
    if (isPlaying) {
      rafRef.current = requestAnimationFrame(draw)
    } else {
      draw()
    }
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [isPlaying, draw])

  return (
    <div
      className="h-10 shrink-0 flex items-center justify-between px-3 relative z-20"
      style={{
        background: '#111318',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        boxShadow: '4px 4px 8px #050607, -2px -2px 6px #1a1d22',
      }}
    >
      {/* â”€â”€ Visualizer canvas (behind everything) â”€â”€ */}
      <div
        className="absolute inset-0 cursor-pointer z-0 overflow-hidden"
        onClick={cycleVizMode}
        title={`Visualizer: ${vizLabel} â€” click to change`}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'repeating-linear-gradient(0deg, transparent 0px, transparent 2px, rgba(0,0,0,0.04) 2px, rgba(0,0,0,0.04) 3px)',
          }}
        />
        <canvas
          ref={canvasRef}
          width={800}
          height={40}
          className="w-full h-full"
        />
      </div>

      {/* â”€â”€ Viz mode label â”€â”€ */}
      <div className="absolute right-14 bottom-0.5 z-10 pointer-events-none">
        <span className="text-[5px] font-mono font-bold tracking-wider" style={{ color: '#5a616b' }}>
          {vizLabel}
        </span>
      </div>

      {/* Left: Logo + Status LED */}
      <div className="flex items-center gap-2.5 relative z-10">
        <div className="flex items-center gap-1.5">
          <div
            className="w-2 h-2 rounded-full"
            style={{
              background: isPlaying ? '#7fa998' : status === 'error' ? '#b86f6f' : '#3b3f44',
              boxShadow: isPlaying
                ? '0 0 4px rgba(127,169,152,0.4)'
                : 'inset 0 1px 2px rgba(0,0,0,0.5)',
            }}
          />
          <span className="text-[12px] font-black tracking-[.25em]" style={{ color: '#e8ecf0' }}>444</span>
          <span className="text-[8px] font-bold tracking-[.15em] uppercase" style={{ color: '#5a616b' }}>STUDIO</span>
        </div>

        <span
          className="text-[7px] font-mono font-bold px-2 py-0.5 rounded-full"
          style={{
            color: status === 'loading'
              ? '#b8a47f'
              : status === 'playing'
                ? '#7fa998'
                : status === 'error'
                  ? '#b86f6f'
                  : '#5a616b',
            background: '#0a0b0d',
            border: '1px solid rgba(255,255,255,0.05)',
            boxShadow: 'inset 2px 2px 4px #050607, inset -2px -2px 4px #1a1d22',
          }}
        >
          {status === 'loading' ? loadingMsg : status === 'playing' ? 'â— LIVE' : status.toUpperCase()}
        </span>
        {error && (
          <span className="text-[7px] font-mono truncate max-w-[200px]" style={{ color: '#b86f6f' }}>{error}</span>
        )}
      </div>

      {/* Center: Transport */}
      <div className="flex items-center gap-2 relative z-10">
        {/* Record button */}
        {onRecord && (
          <button
            onClick={onRecord}
            className="cursor-pointer transition-all duration-[180ms] ease-in-out active:translate-y-[1px]"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 32, height: 32,
              borderRadius: '50%',
              color: isRecording ? '#ff4444' : '#5a616b',
              background: isRecording ? '#1a0808' : '#111318',
              border: 'none',
              boxShadow: isRecording
                ? 'inset 2px 2px 4px #0a0404, inset -2px -2px 4px #2a1010, 0 0 12px rgba(255,68,68,0.25)'
                : '3px 3px 6px #050607, -3px -3px 6px #1a1d22',
              animation: isRecording ? 'pulse 1.5s ease-in-out infinite' : 'none',
            }}
            title={isRecording ? 'Stop recording drum input' : 'Record drum input (captures pad hits → Strudel code)'}
          >
            <Circle size={12} className={isRecording ? 'fill-current' : ''} />
          </button>
        )}

        <button
          onClick={onPlay}
          disabled={status === 'loading'}
          className="cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-[180ms] ease-in-out active:translate-y-[1px]"
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '6px 22px',
            fontSize: '11px', fontWeight: 900, letterSpacing: '.15em',
            color: isPlaying ? '#e8ecf0' : '#0a0b0d',
            background: isPlaying ? '#16181d' : '#7fa998',
            border: 'none',
            borderRadius: '24px',
            boxShadow: '4px 4px 8px #050607, -4px -4px 8px #1a1d22',
          }}
        >
          {isPlaying ? <Square size={11} className="fill-current" /> : <Play size={11} className="fill-current" />}
          {isPlaying ? 'STOP' : 'PLAY'}
        </button>

        {isPlaying && (
          <button
            onClick={onUpdate}
            className="cursor-pointer transition-all duration-[180ms] ease-in-out active:translate-y-[1px]"
            style={{
              display: 'flex', alignItems: 'center', gap: '5px',
              padding: '5px 14px',
              fontSize: '10px', fontWeight: 900, letterSpacing: '.15em',
              color: '#e8ecf0',
              background: '#16181d',
              border: 'none',
              borderRadius: '20px',
              boxShadow: '3px 3px 6px #050607, -3px -3px 6px #1a1d22',
            }}
            title="Re-evaluate code (Ctrl+Enter)"
          >
            <Zap size={10} />
            UPDATE
          </button>
        )}
      </div>

      {/* Right: Volume + Code toggle */}
      <div className="flex items-center gap-2 relative z-10">
        <div
          className="flex items-center gap-1.5 px-2.5 py-1"
          style={{
            background: '#0a0b0d',
            borderRadius: '14px',
            boxShadow: 'inset 3px 3px 6px #050607, inset -3px -3px 6px #1a1d22',
          }}
        >
          {masterVolume === 0 ? (
            <VolumeX size={10} style={{ color: '#b86f6f' }} />
          ) : (
            <Volume2 size={10} style={{ color: '#5a616b' }} />
          )}
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={masterVolume}
            onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
            className="w-14 h-[3px] cursor-pointer"
          />
          <span className="text-[7px] font-mono w-5 text-right tabular-nums font-bold" style={{ color: '#7fa998' }}>
            {Math.round(masterVolume * 100)}
          </span>
        </div>

        {onToggleCode && (
          <button
            onClick={onToggleCode}
            className="cursor-pointer transition-all duration-[180ms] ease-in-out active:scale-95"
            style={{
              display: 'flex', alignItems: 'center', gap: '4px',
              padding: '5px 12px',
              fontSize: '8px', fontWeight: 900, letterSpacing: '.12em', textTransform: 'uppercase' as const,
              borderRadius: '14px',
              color: codeVisible ? '#7fa998' : '#5a616b',
              background: codeVisible ? '#16181d' : '#111318',
              border: 'none',
              boxShadow: codeVisible
                ? 'inset 3px 3px 6px #050607, inset -3px -3px 6px #1a1d22'
                : '3px 3px 6px #050607, -3px -3px 6px #1a1d22',
            }}
          >
            <Code2 size={10} />
            CODE
          </button>
        )}
      </div>
    </div>
  )
}
