/**
 * MasterChannel - Master track mixer strip with glassmorphism
 * Always visible in mixer view, controls master output with spectrum analyzer
 */

'use client'

import { useState, useRef, useEffect } from 'react'
import { GlassPanel, GlassFader, GlassMeter } from './glass'

interface MasterChannelProps {
  volume: number
  vuLevel: number
  onVolumeChange: (volume: number) => void
}

export default function MasterChannel({ volume, vuLevel, onVolumeChange }: MasterChannelProps) {
  const [analyserData, setAnalyserData] = useState<Uint8Array>(new Uint8Array(32))
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Spectrum analyzer visualization
  useEffect(() => {
    if (!canvasRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animationId: number

    const draw = () => {
      const width = canvas.width
      const height = canvas.height

      // Clear canvas
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)'
      ctx.fillRect(0, 0, width, height)

      // Draw spectrum bars
      const barWidth = width / analyserData.length
      const gradient = ctx.createLinearGradient(0, height, 0, 0)
      gradient.addColorStop(0, '#06B6D4')
      gradient.addColorStop(0.5, '#A855F7')
      gradient.addColorStop(1, '#EC4899')

      analyserData.forEach((value, index) => {
        const barHeight = (value / 255) * height
        const x = index * barWidth

        ctx.fillStyle = gradient
        ctx.fillRect(x, height - barHeight, barWidth - 2, barHeight)
      })

      animationId = requestAnimationFrame(draw)
    }

    draw()

    return () => {
      if (animationId) cancelAnimationFrame(animationId)
    }
  }, [analyserData])

  return (
    <GlassPanel blur="lg" glow="cyan" className="w-40 p-4 flex flex-col gap-4">
      {/* Master label */}
      <div className="text-center">
        <div className="text-sm font-bold text-white">MASTER</div>
        <div className="text-[10px] text-cyan-400">Output</div>
      </div>

      {/* Spectrum analyzer */}
      <div className="bg-black/40 rounded-lg p-2 border border-white/10">
        <canvas
          ref={canvasRef}
          width={120}
          height={80}
          className="w-full h-20"
        />
      </div>

      {/* Limiter indicator */}
      <div className="flex flex-col gap-1">
        <div className="flex justify-between text-[10px]">
          <span className="text-gray-400">Limiter</span>
          <span className={`font-mono ${vuLevel > 0.95 ? 'text-red-400' : 'text-gray-500'}`}>
            {vuLevel > 0.95 ? 'ACTIVE' : 'OFF'}
          </span>
        </div>
        <div className="h-1 bg-black/40 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-100 ${
              vuLevel > 0.95 ? 'bg-red-500' : 'bg-gray-600'
            }`}
            style={{ width: `${Math.min(100, (vuLevel / 0.95) * 100)}%` }}
          />
        </div>
      </div>

      {/* Volume fader + VU meter */}
      <div className="flex justify-center gap-3 flex-1 min-h-[160px]">
        <GlassFader
          value={volume}
          onChange={onVolumeChange}
          color="cyan"
          orientation="vertical"
          showValue
          className="h-full"
        />
        <GlassMeter
          level={vuLevel}
          color="cyan"
          orientation="vertical"
          className="h-full"
          showPeak
        />
      </div>

      {/* Output level display */}
      <div className="text-center">
        <div className="text-xs font-mono text-white">
          {(vuLevel * 100).toFixed(1)}%
        </div>
        <div className="text-[10px] text-gray-400">Level</div>
      </div>
    </GlassPanel>
  )
}

