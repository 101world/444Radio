'use client'

import { useState } from 'react'
import { Scissors, Volume2, ArrowLeftRight, Trash2 } from 'lucide-react'
import { GlassPanel, GlassButton, GlassTooltip } from './glass'

interface ClipEditorProps {
  clipId: string
  clipName: string
  startTime: number
  duration: number
  fadeIn: number
  fadeOut: number
  onSplit: (splitTime: number) => void
  onTrim: (newStart: number, newDuration: number) => void
  onFadeChange: (fadeIn: number, fadeOut: number) => void
  onDelete: () => void
  onClose: () => void
}

export default function ClipEditor({
  clipId,
  clipName,
  startTime,
  duration,
  fadeIn,
  fadeOut,
  onSplit,
  onTrim,
  onFadeChange,
  onDelete,
  onClose
}: ClipEditorProps) {
  const [newFadeIn, setNewFadeIn] = useState(fadeIn)
  const [newFadeOut, setNewFadeOut] = useState(fadeOut)
  const [trimStart, setTrimStart] = useState(0)
  const [trimEnd, setTrimEnd] = useState(duration)
  const [splitPosition, setSplitPosition] = useState(duration / 2)

  const handleApplyFades = () => {
    onFadeChange(newFadeIn, newFadeOut)
  }

  const handleApplyTrim = () => {
    onTrim(startTime + trimStart, trimEnd - trimStart)
  }

  const handleSplit = () => {
    onSplit(startTime + splitPosition)
  }

  return (
    <GlassPanel blur="lg" glow="cyan" className="w-full max-w-2xl p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-bold text-white">Clip Editor</h3>
          <div className="text-sm text-gray-400">{clipName}</div>
        </div>
        <GlassButton variant="ghost" size="sm" onClick={onClose}>
          Close
        </GlassButton>
      </div>

      {/* Clip Info */}
      <div className="grid grid-cols-3 gap-4 mb-6 p-4 bg-black/20 rounded-lg border border-white/10">
        <div>
          <div className="text-xs text-gray-400">Start Time</div>
          <div className="text-sm font-medium text-white">{startTime.toFixed(2)}s</div>
        </div>
        <div>
          <div className="text-xs text-gray-400">Duration</div>
          <div className="text-sm font-medium text-white">{duration.toFixed(2)}s</div>
        </div>
        <div>
          <div className="text-xs text-gray-400">End Time</div>
          <div className="text-sm font-medium text-white">{(startTime + duration).toFixed(2)}s</div>
        </div>
      </div>

      {/* Fade Controls */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Volume2 className="w-4 h-4 text-cyan-500" />
          <h4 className="text-sm font-medium text-white">Fade In/Out</h4>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-gray-400 mb-2 block">Fade In (seconds)</label>
            <input
              type="number"
              value={newFadeIn}
              onChange={(e) => setNewFadeIn(parseFloat(e.target.value) || 0)}
              min={0}
              max={duration / 2}
              step={0.1}
              className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-white text-sm outline-none focus:border-cyan-500/50"
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-2 block">Fade Out (seconds)</label>
            <input
              type="number"
              value={newFadeOut}
              onChange={(e) => setNewFadeOut(parseFloat(e.target.value) || 0)}
              min={0}
              max={duration / 2}
              step={0.1}
              className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-white text-sm outline-none focus:border-cyan-500/50"
            />
          </div>
        </div>
        <GlassButton
          variant="secondary"
          size="sm"
          className="mt-3 w-full"
          onClick={handleApplyFades}
          icon={<Volume2 className="w-4 h-4" />}
        >
          Apply Fades
        </GlassButton>
      </div>

      {/* Trim Controls */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <ArrowLeftRight className="w-4 h-4 text-purple-500" />
          <h4 className="text-sm font-medium text-white">Trim Clip</h4>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-gray-400 mb-2 block">Trim Start (seconds)</label>
            <input
              type="number"
              value={trimStart}
              onChange={(e) => setTrimStart(Math.max(0, Math.min(parseFloat(e.target.value) || 0, trimEnd - 0.1)))}
              min={0}
              max={duration}
              step={0.1}
              className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-white text-sm outline-none focus:border-purple-500/50"
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-2 block">Trim End (seconds)</label>
            <input
              type="number"
              value={trimEnd}
              onChange={(e) => setTrimEnd(Math.max(trimStart + 0.1, Math.min(parseFloat(e.target.value) || duration, duration)))}
              min={0}
              max={duration}
              step={0.1}
              className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-white text-sm outline-none focus:border-purple-500/50"
            />
          </div>
        </div>
        <div className="mt-2 text-xs text-gray-400">
          New duration: {(trimEnd - trimStart).toFixed(2)}s
        </div>
        <GlassButton
          variant="secondary"
          size="sm"
          className="mt-3 w-full"
          onClick={handleApplyTrim}
          icon={<ArrowLeftRight className="w-4 h-4" />}
        >
          Apply Trim
        </GlassButton>
      </div>

      {/* Split Controls */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Scissors className="w-4 h-4 text-pink-500" />
          <h4 className="text-sm font-medium text-white">Split Clip</h4>
        </div>
        <div>
          <label className="text-xs text-gray-400 mb-2 block">Split Position (seconds from start)</label>
          <input
            type="number"
            value={splitPosition}
            onChange={(e) => setSplitPosition(Math.max(0.1, Math.min(parseFloat(e.target.value) || 0, duration - 0.1)))}
            min={0.1}
            max={duration - 0.1}
            step={0.1}
            className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-white text-sm outline-none focus:border-pink-500/50"
          />
        </div>
        <div className="mt-2 text-xs text-gray-400">
          Will create 2 clips: {splitPosition.toFixed(2)}s + {(duration - splitPosition).toFixed(2)}s
        </div>
        <GlassButton
          variant="secondary"
          size="sm"
          className="mt-3 w-full"
          onClick={handleSplit}
          icon={<Scissors className="w-4 h-4" />}
        >
          Split at Position
        </GlassButton>
      </div>

      {/* Delete */}
      <div className="pt-6 border-t border-white/10">
        <GlassButton
          variant="danger"
          className="w-full"
          onClick={onDelete}
          icon={<Trash2 className="w-4 h-4" />}
        >
          Delete Clip
        </GlassButton>
      </div>
    </GlassPanel>
  )
}
