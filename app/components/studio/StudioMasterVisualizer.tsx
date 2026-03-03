'use client'

import { useRef, useEffect, useCallback } from 'react'

interface StudioMasterVisualizerProps {
  isPlaying: boolean
  audioContext?: AudioContext | null
  analyserNode?: AnalyserNode | null
}

export default function StudioMasterVisualizer({ isPlaying, analyserNode }: StudioMasterVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const w = canvas.width
    const h = canvas.height

    ctx.clearRect(0, 0, w, h)

    if (!isPlaying || !analyserNode) {
      // Idle state â€” flat line
      ctx.strokeStyle = 'rgba(127,169,152,0.15)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(0, h / 2)
      ctx.lineTo(w, h / 2)
      ctx.stroke()
      return
    }

    const bufferLength = analyserNode.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)
    analyserNode.getByteTimeDomainData(dataArray)

    // Waveform
    ctx.strokeStyle = '#7fa998'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    const sliceWidth = w / bufferLength
    let x = 0
    for (let i = 0; i < bufferLength; i++) {
      const v = dataArray[i] / 128.0
      const y = (v * h) / 2
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
      x += sliceWidth
    }
    ctx.stroke()

    // Frequency bars overlay (subtle)
    const freqData = new Uint8Array(analyserNode.frequencyBinCount)
    analyserNode.getByteFrequencyData(freqData)
    const barCount = 32
    const barW = w / barCount
    for (let i = 0; i < barCount; i++) {
      const idx = Math.floor((i / barCount) * freqData.length * 0.5)
      const val = freqData[idx] / 255
      const barH = val * h * 0.6
      ctx.fillStyle = `rgba(127,169,152,${val * 0.08})`
      ctx.fillRect(i * barW, h - barH, barW - 1, barH)
    }

    rafRef.current = requestAnimationFrame(draw)
  }, [isPlaying, analyserNode])

  useEffect(() => {
    if (isPlaying) {
      rafRef.current = requestAnimationFrame(draw)
    }
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [isPlaying, draw])

  return (
    <div
      className="shrink-0 relative overflow-hidden"
      style={{
        height: 32,
        background: '#0a0b0d',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
        boxShadow: 'inset 3px 3px 6px #050607, inset -3px -3px 6px #1a1d22',
      }}
    >
      {/* Subtle texture overlay */}
      <div
        className="absolute inset-0 pointer-events-none z-10"
        style={{
          background: 'repeating-linear-gradient(0deg, transparent 0px, transparent 2px, rgba(0,0,0,0.06) 2px, rgba(0,0,0,0.06) 3px)',
        }}
      />
      {/* Label */}
      <div className="absolute left-2 top-1 z-10">
        <span className="text-[6px] font-mono font-bold tracking-wider" style={{ color: '#5a616b' }}>
          MASTER OUT
        </span>
      </div>
      <canvas
        ref={canvasRef}
        width={800}
        height={32}
        className="w-full h-full"
      />
    </div>
  )
}
