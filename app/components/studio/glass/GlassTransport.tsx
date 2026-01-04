'use client'

import { Play, Pause, Square, SkipBack, SkipForward, Rewind, FastForward } from 'lucide-react'
import GlassButton from './GlassButton'
import GlassTooltip from './GlassTooltip'

interface GlassTransportProps {
  isPlaying: boolean
  onPlay: () => void
  onPause: () => void
  onStop: () => void
  onRewind?: () => void
  onFastForward?: () => void
  onSkipBack?: () => void
  onSkipForward?: () => void
  showSkipButtons?: boolean
  showSeekButtons?: boolean
  className?: string
}

export default function GlassTransport({
  isPlaying,
  onPlay,
  onPause,
  onStop,
  onRewind,
  onFastForward,
  onSkipBack,
  onSkipForward,
  showSkipButtons = false,
  showSeekButtons = true,
  className = ''
}: GlassTransportProps) {
  return (
    <div className={`flex items-center gap-2 p-3 bg-black/40 backdrop-blur-lg rounded-xl border border-white/10 shadow-lg ${className}`}>
      {/* Skip Back */}
      {showSkipButtons && onSkipBack && (
        <GlassTooltip content="Previous Track">
          <GlassButton
            onClick={onSkipBack}
            variant="secondary"
            size="sm"
            icon={<SkipBack className="w-4 h-4" />}
          >{''}</GlassButton>
        </GlassTooltip>
      )}

      {/* Rewind */}
      {showSeekButtons && onRewind && (
        <GlassTooltip content="Rewind">
          <GlassButton
            onClick={onRewind}
            variant="secondary"
            size="sm"
            icon={<Rewind className="w-4 h-4" />}
          >{''}</GlassButton>
        </GlassTooltip>
      )}

      {/* Stop */}
      <GlassTooltip content="Stop">
        <GlassButton
          onClick={onStop}
          variant="danger"
          size="sm"
          icon={<Square className="w-4 h-4 fill-current" />}
        >{''}</GlassButton>
      </GlassTooltip>

      {/* Play/Pause */}
      <GlassTooltip content={isPlaying ? 'Pause (Space)' : 'Play (Space)'}>
        <GlassButton
          onClick={isPlaying ? onPause : onPlay}
          variant="primary"
          size="md"
          icon={isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
        >{''}</GlassButton>
      </GlassTooltip>

      {/* Fast Forward */}
      {showSeekButtons && onFastForward && (
        <GlassTooltip content="Fast Forward">
          <GlassButton
            onClick={onFastForward}
            variant="secondary"
            size="sm"
            icon={<FastForward className="w-4 h-4" />}
          >{''}</GlassButton>
        </GlassTooltip>
      )}

      {/* Skip Forward */}
      {showSkipButtons && onSkipForward && (
        <GlassTooltip content="Next Track">
          <GlassButton
            onClick={onSkipForward}
            variant="secondary"
            size="sm"
            icon={<SkipForward className="w-4 h-4" />}
          >{''}</GlassButton>
        </GlassTooltip>
      )}
    </div>
  )
}
