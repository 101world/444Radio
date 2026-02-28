'use client'

import { Play, Square, Volume2, VolumeX, Zap } from 'lucide-react'

interface StudioTopBarProps {
  status: 'loading' | 'ready' | 'playing' | 'error'
  loadingMsg: string
  error: string | null
  isPlaying: boolean
  masterVolume: number
  onPlay: () => void
  onUpdate: () => void
  onVolumeChange: (v: number) => void
}

export default function StudioTopBar({
  status,
  loadingMsg,
  error,
  isPlaying,
  masterVolume,
  onPlay,
  onUpdate,
  onVolumeChange,
}: StudioTopBarProps) {
  return (
    <div className="h-10 shrink-0 flex items-center justify-between px-3 border-b border-white/[0.06] bg-[#0e0e12]">
      {/* Left: Logo + Status */}
      <div className="flex items-center gap-3">
        <span className="text-[13px] font-black tracking-[.15em] text-cyan-400">444 STUDIO</span>
        <span
          className={`text-[9px] font-mono px-2 py-0.5 rounded-full border ${
            status === 'loading'
              ? 'text-amber-400/60 border-amber-500/20 bg-amber-500/5'
              : status === 'playing'
                ? 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5 animate-pulse'
                : status === 'error'
                  ? 'text-red-400 border-red-500/20 bg-red-500/5'
                  : 'text-white/30 border-white/[0.06]'
          }`}
        >
          {status === 'loading' ? loadingMsg : status.toUpperCase()}
        </span>
        {error && (
          <span className="text-[9px] text-red-400/80 font-mono truncate max-w-[300px]">{error}</span>
        )}
      </div>

      {/* Center: Transport */}
      <div className="flex items-center gap-2">
        <button
          onClick={onPlay}
          disabled={status === 'loading'}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg font-bold text-[11px] tracking-wide transition-all cursor-pointer ${
            isPlaying
              ? 'bg-red-500/15 text-red-400 border border-red-500/25 hover:bg-red-500/25'
              : 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/25 hover:bg-cyan-500/25'
          } disabled:opacity-30`}
        >
          {isPlaying ? (
            <Square size={12} className="fill-current" />
          ) : (
            <Play size={12} className="fill-current" />
          )}
          {isPlaying ? 'STOP' : 'PLAY'}
        </button>
        {isPlaying && (
          <button
            onClick={onUpdate}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg font-bold text-[11px] tracking-wide bg-purple-500/15 text-purple-400 border border-purple-500/25 hover:bg-purple-500/25 transition-all cursor-pointer"
            title="Re-evaluate code (Ctrl+Enter)"
          >
            <Zap size={11} />
            UPDATE
          </button>
        )}
        <span className="text-[8px] text-white/15 font-mono">Ctrl+Space · Ctrl+Enter</span>
      </div>

      {/* Right: Volume */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md border border-white/[0.06] bg-white/[0.02]">
          {masterVolume === 0 ? (
            <VolumeX size={11} className="text-red-400/40" />
          ) : (
            <Volume2 size={11} className="text-white/25" />
          )}
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={masterVolume}
            onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
            className="w-20 h-1 accent-cyan-400 cursor-pointer"
          />
          <span className="text-[9px] text-white/20 font-mono w-6 text-right">
            {Math.round(masterVolume * 100)}
          </span>
        </div>
      </div>
    </div>
  )
}
