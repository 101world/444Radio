'use client'

import { useState } from 'react'
import { GlassPanel, GlassKnob, GlassFader, GlassMeter } from './glass'

interface MixerChannelProps {
  trackId: string
  trackName: string
  volume: number
  pan: number
  isMuted: boolean
  isSolo: boolean
  vuLevel: number
  onVolumeChange: (volume: number) => void
  onPanChange: (pan: number) => void
  onMuteToggle: () => void
  onSoloToggle: () => void
  onEQChange: (band: 'low' | 'mid' | 'high', value: number) => void
  onCompressionChange: (value: number) => void
  onReverbChange: (value: number) => void
}

export default function MixerChannel({
  trackId,
  trackName,
  volume,
  pan,
  isMuted,
  isSolo,
  vuLevel,
  onVolumeChange,
  onPanChange,
  onMuteToggle,
  onSoloToggle,
  onEQChange,
  onCompressionChange,
  onReverbChange
}: MixerChannelProps) {
  const [eqLow, setEqLow] = useState(0.5)
  const [eqMid, setEqMid] = useState(0.5)
  const [eqHigh, setEqHigh] = useState(0.5)
  const [compression, setCompression] = useState(0)
  const [reverb, setReverb] = useState(0)

  const handleEQLow = (value: number) => {
    setEqLow(value)
    onEQChange('low', value)
  }

  const handleEQMid = (value: number) => {
    setEqMid(value)
    onEQChange('mid', value)
  }

  const handleEQHigh = (value: number) => {
    setEqHigh(value)
    onEQChange('high', value)
  }

  const handleCompression = (value: number) => {
    setCompression(value)
    onCompressionChange(value)
  }

  const handleReverb = (value: number) => {
    setReverb(value)
    onReverbChange(value)
  }

  return (
    <GlassPanel blur="md" glow="none" className="w-32 p-3 flex flex-col gap-4">
      {/* Track name */}
      <div className="text-center">
        <div className="text-xs font-bold text-white truncate">{trackName}</div>
      </div>

      {/* EQ Section */}
      <div className="flex flex-col gap-2">
        <div className="text-[10px] text-gray-400 text-center">EQ</div>
        <div className="flex justify-around">
          <div className="flex flex-col items-center gap-1">
            <GlassKnob
              value={eqLow}
              onChange={handleEQLow}
              color="green"
              className="scale-75"
            />
            <span className="text-[8px] text-gray-500">Low</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <GlassKnob
              value={eqMid}
              onChange={handleEQMid}
              color="cyan"
              className="scale-75"
            />
            <span className="text-[8px] text-gray-500">Mid</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <GlassKnob
              value={eqHigh}
              onChange={handleEQHigh}
              color="purple"
              className="scale-75"
            />
            <span className="text-[8px] text-gray-500">High</span>
          </div>
        </div>
      </div>

      {/* Effects Section */}
      <div className="flex flex-col gap-2">
        <div className="text-[10px] text-gray-400 text-center">FX</div>
        <div className="flex justify-around">
          <div className="flex flex-col items-center gap-1">
            <GlassKnob
              value={compression}
              onChange={handleCompression}
              color="pink"
              className="scale-75"
            />
            <span className="text-[8px] text-gray-500">Comp</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <GlassKnob
              value={reverb}
              onChange={handleReverb}
              color="purple"
              className="scale-75"
            />
            <span className="text-[8px] text-gray-500">Rev</span>
          </div>
        </div>
      </div>

      {/* Pan knob */}
      <div className="flex flex-col items-center gap-1">
        <div className="text-[10px] text-gray-400">Pan</div>
        <GlassKnob
          value={(pan + 1) / 2}
          onChange={(val) => onPanChange(val * 2 - 1)}
          color="purple"
          showValue
          className="scale-90"
        />
      </div>

      {/* Volume fader + VU meter */}
      <div className="flex justify-center gap-2 flex-1 min-h-[120px]">
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
        />
      </div>

      {/* Solo/Mute buttons */}
      <div className="flex gap-1">
        <button
          onClick={onSoloToggle}
          className={`flex-1 py-1 text-[10px] font-bold rounded-lg transition-all duration-200 ${
            isSolo
              ? 'bg-cyan-500/30 text-cyan-400 border border-cyan-500/50 shadow-lg shadow-cyan-500/20'
              : 'bg-white/5 text-gray-400 border border-white/10 hover:border-cyan-500/30'
          }`}
        >
          S
        </button>
        <button
          onClick={onMuteToggle}
          className={`flex-1 py-1 text-[10px] font-bold rounded-lg transition-all duration-200 ${
            isMuted
              ? 'bg-red-500/30 text-red-400 border border-red-500/50 shadow-lg shadow-red-500/20'
              : 'bg-white/5 text-gray-400 border border-white/10 hover:border-red-500/30'
          }`}
        >
          M
        </button>
      </div>
    </GlassPanel>
  )
}
