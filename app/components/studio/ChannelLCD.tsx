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

  // Peak hold — retains max amplitude across frames so percussive hits stay visible
  const peakHoldRef = useRef(0)
  // Rolling waveform buffer — blends old/new so brief transients don't vanish
  const waveBufferRef = useRef<Float32Array | null>(null)

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
      peakHoldRef.current = 0
      waveBufferRef.current = null
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
      const bufLen = analyser.frequencyBinCount
      const data = new Uint8Array(bufLen)
      analyser.getByteTimeDomainData(data)

      // Compute current frame peak amplitude (128 = silence for byte data)
      let maxAmp = 0
      for (let i = 0; i < data.length; i++) {
        const abs = Math.abs(data[i] - 128)
        if (abs > maxAmp) maxAmp = abs
      }

      // Peak hold with decay — keeps percussive transients visible for ~200ms
      peakHoldRef.current = Math.max(maxAmp, peakHoldRef.current * 0.9)
      const displayPeak = peakHoldRef.current

      // Normalize waveform samples to canvas width
      const normalized = new Float32Array(w)
      for (let x = 0; x < w; x++) {
        const idx = Math.floor((x / w) * data.length)
        normalized[x] = (data[idx] - 128) / 128 // -1..1
      }

      // Blend with previous frame — keeps waveform visible between transient gaps
      if (waveBufferRef.current && waveBufferRef.current.length === w) {
        const blend = maxAmp > 3 ? 0 : 0.5 // Fresh signal = full override; silence = fade
        for (let x = 0; x < w; x++) {
          normalized[x] = normalized[x] * (1 - blend) + waveBufferRef.current[x] * blend
        }
      }
      waveBufferRef.current = new Float32Array(normalized)

      if (displayPeak > 1) {
        // ── Draw waveform with channel color ──
        ctx.strokeStyle = color
        ctx.lineWidth = 1.5
        ctx.beginPath()
        for (let x = 0; x < w; x++) {
          const y = (1 - normalized[x]) * h / 2
          if (x === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        ctx.stroke()

        // Fill under waveform
        ctx.lineTo(w, h / 2)
        ctx.lineTo(0, h / 2)
        ctx.closePath()
        ctx.fillStyle = `${color}12`
        ctx.fill()

        // Peak bar indicators at edges — uses displayPeak (which holds)
        const peak = Math.min(displayPeak / 32, 1)
        const peakHex = Math.round(peak * 100).toString(16).padStart(2, '0')
        ctx.fillStyle = `${color}${peakHex}`
        ctx.fillRect(0, 0, 2, h)
        ctx.fillRect(w - 2, 0, 2, h)

        // Percussive flash — when peak is held but current signal gone, show a decaying glow
        if (displayPeak > 8 && maxAmp < 3) {
          const glowStr = Math.min(displayPeak / 80, 0.35)
          const glowHex = Math.round(glowStr * 255).toString(16).padStart(2, '0')
          ctx.fillStyle = `${color}${glowHex}`
          const barH = Math.min((displayPeak / 128) * h, h)
          ctx.fillRect(0, (h - barH) / 2, w, barH)
        }
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
