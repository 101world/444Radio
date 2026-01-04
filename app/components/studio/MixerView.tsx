'use client'

import { useState } from 'react'
import { X, Sliders } from 'lucide-react'
import { GlassPanel, GlassButton } from './glass'
import MixerChannel from './MixerChannel'
import MasterChannel from './MasterChannel'
import type { Track } from '@/lib/audio/TrackManager'

interface MixerViewProps {
  isOpen: boolean
  onClose: () => void
  tracks: Track[]
  masterVolume: number
  masterVULevel: number
  onMasterVolumeChange: (volume: number) => void
  onTrackVolumeChange: (trackId: string, volume: number) => void
  onTrackPanChange: (trackId: string, pan: number) => void
  onTrackMuteToggle: (trackId: string) => void
  onTrackSoloToggle: (trackId: string) => void
  onTrackEQChange: (trackId: string, band: 'low' | 'mid' | 'high', value: number) => void
  onTrackCompressionChange: (trackId: string, value: number) => void
  onTrackReverbChange: (trackId: string, value: number) => void
}

export default function MixerView({
  isOpen,
  onClose,
  tracks,
  masterVolume,
  masterVULevel,
  onMasterVolumeChange,
  onTrackVolumeChange,
  onTrackPanChange,
  onTrackMuteToggle,
  onTrackSoloToggle,
  onTrackEQChange,
  onTrackCompressionChange,
  onTrackReverbChange
}: MixerViewProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-6">
      <GlassPanel blur="xl" glow="cyan" className="w-full max-w-7xl h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <Sliders className="w-6 h-6 text-cyan-500" />
            <h2 className="text-2xl font-bold text-white">Mixer</h2>
            <div className="text-sm text-gray-400">
              {tracks.length} channels
            </div>
          </div>
          <GlassButton variant="ghost" size="sm" onClick={onClose} icon={<X className="w-5 h-5" />}>
            Close
          </GlassButton>
        </div>

        {/* Mixer channels */}
        <div className="flex-1 overflow-x-auto overflow-y-hidden p-6">
          <div className="flex gap-4 h-full items-start min-w-max">
            {/* Track channels */}
            {tracks.map((track) => (
              <MixerChannel
                key={track.id}
                trackId={track.id}
                trackName={track.name}
                volume={track.volume}
                pan={track.pan}
                isMuted={track.muted}
                isSolo={track.solo}
                vuLevel={0} // TODO: Connect to actual VU meter
                onVolumeChange={(volume) => onTrackVolumeChange(track.id, volume)}
                onPanChange={(pan) => onTrackPanChange(track.id, pan)}
                onMuteToggle={() => onTrackMuteToggle(track.id)}
                onSoloToggle={() => onTrackSoloToggle(track.id)}
                onEQChange={(band, value) => onTrackEQChange(track.id, band, value)}
                onCompressionChange={(value) => onTrackCompressionChange(track.id, value)}
                onReverbChange={(value) => onTrackReverbChange(track.id, value)}
              />
            ))}

            {/* Master channel */}
            <MasterChannel
              volume={masterVolume}
              vuLevel={masterVULevel}
              onVolumeChange={onMasterVolumeChange}
            />
          </div>
        </div>

        {/* Footer info */}
        <div className="px-6 py-3 border-t border-white/10 flex items-center justify-between text-xs text-gray-400">
          <div>Tip: Adjust EQ, compression, and reverb for each track</div>
          <div className="flex items-center gap-4">
            <div>Sample Rate: 48kHz</div>
            <div>Bit Depth: 24-bit</div>
          </div>
        </div>
      </GlassPanel>
    </div>
  )
}
