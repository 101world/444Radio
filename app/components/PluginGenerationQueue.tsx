'use client'

import { useState, useEffect, useRef } from 'react'
import { Square, Cpu, Zap } from 'lucide-react'

interface GenerationJob {
  id: string
  type: string
  startedAt: number
  label?: string
}

interface PluginGenerationQueueProps {
  jobs: GenerationJob[]
  onCancel: (id: string) => void
}

export default function PluginGenerationQueue({ jobs, onCancel }: PluginGenerationQueueProps) {
  if (jobs.length === 0) return null

  return (
    <div className="space-y-2">
      {jobs.map((job, idx) => (
        <GenerationCard key={job.id} job={job} position={idx + 1} total={jobs.length} onCancel={onCancel} />
      ))}
    </div>
  )
}

function GenerationCard({ job, position, total, onCancel }: {
  job: GenerationJob; position: number; total: number; onCancel: (id: string) => void
}) {
  const [elapsed, setElapsed] = useState(0)
  const barRef = useRef<HTMLDivElement>(null)
  const glowRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - job.startedAt) / 1000))
    }, 200)
    return () => clearInterval(interval)
  }, [job.startedAt])

  // Phase colors: cyan < 30s, yellow-green 30-59s, orange tungsten >= 60s
  const phase = elapsed >= 60 ? 'hot' : elapsed >= 30 ? 'warm' : 'cool'

  const barColor = phase === 'hot'
    ? 'from-orange-500 via-amber-400 to-orange-600'
    : phase === 'warm'
    ? 'from-yellow-400 via-lime-400 to-cyan-400'
    : 'from-cyan-500 via-cyan-400 to-blue-500'

  const glowColor = phase === 'hot'
    ? 'shadow-orange-500/50'
    : phase === 'warm'
    ? 'shadow-yellow-400/30'
    : 'shadow-cyan-500/30'

  const bgGlow = phase === 'hot'
    ? 'border-orange-500/40 bg-gradient-to-r from-orange-950/30 via-black/50 to-orange-950/30'
    : phase === 'warm'
    ? 'border-yellow-500/30 bg-gradient-to-r from-yellow-950/20 via-black/50 to-yellow-950/20'
    : 'border-cyan-500/30 bg-gradient-to-r from-cyan-950/20 via-black/50 to-cyan-950/20'

  const statusText = phase === 'hot'
    ? '🔥 GPU at full throttle...'
    : phase === 'warm'
    ? '⚡ Processing intensely...'
    : position > 1
    ? `⏳ Queued (#${position} of ${total})`
    : '🎵 Generating...'

  // Fake progress: logarithmic curve that slows down approaching 95%
  const maxSec = 120
  const progress = Math.min(0.95, 1 - Math.exp(-elapsed / (maxSec * 0.35)))

  const fmtTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`

  return (
    <div className={`relative rounded-xl border overflow-hidden transition-all duration-500 ${bgGlow}`}>
      {/* Scanline overlay for futuristic feel */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.1) 2px, rgba(255,255,255,0.1) 4px)',
        }}
      />

      <div className="relative px-4 py-3">
        {/* Header row */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className={`relative ${phase === 'hot' ? 'animate-pulse' : ''}`}>
              <Cpu size={14} className={phase === 'hot' ? 'text-orange-400' : phase === 'warm' ? 'text-yellow-400' : 'text-cyan-400'} />
              {phase === 'hot' && (
                <div className="absolute -inset-1 rounded-full bg-orange-500/30 animate-ping" />
              )}
            </div>
            <span className="text-[11px] font-semibold text-white">
              {job.label || job.type.charAt(0).toUpperCase() + job.type.slice(1)}
            </span>
            <span className={`text-[10px] font-mono ${
              phase === 'hot' ? 'text-orange-400' : phase === 'warm' ? 'text-yellow-400' : 'text-cyan-400'
            }`}>
              {fmtTime(elapsed)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-gray-500">{(progress * 100).toFixed(0)}%</span>
            <button onClick={() => onCancel(job.id)}
              className="p-1 hover:bg-white/10 rounded transition-colors group" title="Cancel">
              <Square size={11} className="text-red-400 group-hover:text-red-300" />
            </button>
          </div>
        </div>

        {/* Status text */}
        <p className={`text-[10px] mb-2 ${
          phase === 'hot' ? 'text-orange-300/80' : phase === 'warm' ? 'text-yellow-300/60' : 'text-gray-400'
        }`}>
          {statusText}
        </p>

        {/* Mechanical progress bar */}
        <div className="relative h-2 bg-gray-800/80 rounded-full overflow-hidden">
          {/* Track notches — mechanical feel */}
          <div className="absolute inset-0 flex">
            {Array.from({ length: 20 }).map((_, i) => (
              <div key={i} className="flex-1 border-r border-white/[0.04] last:border-r-0" />
            ))}
          </div>

          {/* Fill */}
          <div
            ref={barRef}
            className={`absolute top-0 left-0 h-full rounded-full bg-gradient-to-r ${barColor} transition-all duration-500 shadow-lg ${glowColor}`}
            style={{ width: `${progress * 100}%` }}
          />

          {/* Leading edge glow */}
          <div
            ref={glowRef}
            className={`absolute top-0 h-full w-3 rounded-full transition-all duration-500 ${
              phase === 'hot' ? 'bg-orange-300/60 shadow-lg shadow-orange-400/60' :
              phase === 'warm' ? 'bg-yellow-300/40 shadow-lg shadow-yellow-400/40' :
              'bg-cyan-300/50 shadow-lg shadow-cyan-400/50'
            }`}
            style={{ left: `calc(${progress * 100}% - 6px)`, filter: 'blur(2px)' }}
          />
        </div>

        {/* Bottom detail strip */}
        <div className="flex items-center justify-between mt-1.5">
          <div className="flex items-center gap-1">
            <Zap size={8} className={phase === 'hot' ? 'text-orange-500 animate-pulse' : 'text-gray-600'} />
            <span className="text-[8px] text-gray-600 font-mono uppercase tracking-wider">
              {phase === 'hot' ? 'MAX LOAD' : phase === 'warm' ? 'HIGH LOAD' : 'PROCESSING'}
            </span>
          </div>
          <span className="text-[8px] text-gray-600 font-mono">
            {job.type.toUpperCase()}
          </span>
        </div>
      </div>
    </div>
  )
}
