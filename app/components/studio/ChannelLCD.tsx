'use client'

import { useRef, useEffect, useCallback } from 'react'
import type { ParsedChannel } from '@/lib/strudel-code-parser'
import { getOrbitAnalyser } from '@/lib/studio-analysers'

interface ChannelLCDProps {
  channel: ParsedChannel
  isPlaying: boolean
  isMuted: boolean
}

/** Extract orbit number from channel params, default to 0 */
function getChannelOrbit(channel: ParsedChannel): number {
  const orbitParam = channel.params.find(p => p.key === 'orbit')
  if (orbitParam && !orbitParam.isComplex) {
    const n = parseFloat(String(orbitParam.value))
    if (!isNaN(n)) return n
  }
  return 0
}

export default function ChannelLCD({ channel, isPlaying, isMuted }: ChannelLCDProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)
  const orbit = getChannelOrbit(channel)

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const w = canvas.width
    const h = canvas.height
    ctx.clearRect(0, 0, w, h)

    const color = channel.color

    // ── Not playing or muted: show idle state ──
    if (!isPlaying || isMuted) {
      ctx.strokeStyle = '#5a616b20'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(0, h / 2)
      ctx.lineTo(w, h / 2)
      ctx.stroke()
      return
    }

    // ── Playing: get real orbit analyser data ──
    const analyser = getOrbitAnalyser(orbit)

    if (analyser) {
      // Allocate data array each frame (avoids TS ArrayBuffer generic issues)
      const bufLen = analyser.frequencyBinCount
      const data = new Uint8Array(bufLen)
      analyser.getByteTimeDomainData(data)

      // Check if there's any signal (not just silence — 128 = zero crossing for byte data)
      let maxAmp = 0
      for (let i = 0; i < data.length; i++) {
        const abs = Math.abs(data[i] - 128)
        if (abs > maxAmp) maxAmp = abs
      }

      if (maxAmp > 1) {
        // ── Draw real waveform with channel color ──
        ctx.strokeStyle = color
        ctx.lineWidth = 1.5
        ctx.beginPath()
        for (let x = 0; x < w; x++) {
          const idx = Math.floor((x / w) * data.length)
          const sample = (data[idx] - 128) / 128  // normalize to -1..1
          const y = (1 - sample) * h / 2
          if (x === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        ctx.stroke()

        // Subtle fill under waveform
        ctx.lineTo(w, h / 2)
        ctx.lineTo(0, h / 2)
        ctx.closePath()
        ctx.fillStyle = `${color}12`
        ctx.fill()

        // Peak indicators at edges with channel color
        const peak = Math.min(maxAmp / 32, 1)
        ctx.fillStyle = `${color}${Math.round(peak * 76).toString(16).padStart(2, '0')}`
        ctx.fillRect(0, 0, 2, h)
        ctx.fillRect(w - 2, 0, 2, h)
      } else {
        // Silent — dim flatline
        ctx.strokeStyle = '#5a616b20'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(0, h / 2)
        ctx.lineTo(w, h / 2)
        ctx.stroke()
      }
    } else {
      // No analyser — show dim dots placeholder
      ctx.fillStyle = '#5a616b30'
      const dotCount = 8
      const dotW = w / dotCount
      for (let i = 0; i < dotCount; i++) {
        ctx.fillRect(i * dotW + dotW / 2 - 1, h / 2 - 1, 2, 2)
      }
    }

    rafRef.current = requestAnimationFrame(draw)
  }, [isPlaying, isMuted, channel.color, orbit])

  useEffect(() => {
    draw()
    if (isPlaying && !isMuted) {
      rafRef.current = requestAnimationFrame(draw)
    }
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [isPlaying, isMuted, draw])

  return (
    <div
      className="mx-1 mb-1 rounded-lg overflow-hidden relative transition-all duration-300"
      style={{
        height: 28,
        background: '#1c1e22',
        border: isPlaying && !isMuted
          ? `1px solid ${channel.color}20`
          : '1px solid rgba(255,255,255,0.03)',
        boxShadow: isPlaying && !isMuted
          ? `inset 3px 3px 6px #14161a, inset -3px -3px 6px #2c3036, 0 0 6px ${channel.color}10`
          : 'inset 3px 3px 6px #14161a, inset -3px -3px 6px #2c3036',
      }}
    >
      {/* Subtle texture overlay */}
      <div
        className="absolute inset-0 pointer-events-none z-10"
        style={{
          background: 'repeating-linear-gradient(0deg, transparent 0px, transparent 2px, rgba(0,0,0,0.08) 2px, rgba(0,0,0,0.08) 3px)',
        }}
      />
      <canvas
        ref={canvasRef}
        width={200}
        height={24}
        className="w-full h-full"
      />
    </div>
  )
}
