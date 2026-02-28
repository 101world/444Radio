'use client'

// ═══════════════════════════════════════════════════════════════
//  STUDIO MIXER RACK v2 — Right sidebar hardware rack mixer
//  Features:
//    - Auto-parses code into channel strips with knobs
//    - Solo (S) / Mute (M) per channel — affects evaluation only
//    - Drag & drop effects from palette onto channels
//    - Knobs use position-based code replacement (never fails)
//    - Visual indicators for complex/modulated params (~)
// ═══════════════════════════════════════════════════════════════

import { useMemo, useCallback, useState, useEffect, useRef } from 'react'
import { ChevronDown, ChevronRight, Plus, Volume2, Layers, VolumeX, Headphones, GripVertical } from 'lucide-react'
import StudioKnob from './StudioKnob'
import {
  parseStrudelCode, updateParamInCode, insertEffectInChannel,
  getParamDef,
  DRAGGABLE_EFFECTS, type ParsedChannel,
} from '@/lib/strudel-code-parser'

// ─── Effect category grouping for nested rack display ───

const FX_GROUPS: { label: string; icon: string; keys: string[] }[] = [
  { label: 'FILTER', icon: '🔽', keys: ['lpf', 'hpf', 'lpq', 'lpenv', 'lps', 'lpd'] },
  { label: 'DRIVE',  icon: '🔥', keys: ['shape', 'distort', 'crush'] },
  { label: 'SPACE',  icon: '🌌', keys: ['room', 'delay', 'delayfeedback', 'delaytime'] },
  { label: 'DUCK',   icon: '🦆', keys: ['duckdepth', 'duckattack'] },
  { label: 'PITCH',  icon: '🎵', keys: ['detune', 'speed', 'rel', 'velocity'] },
]

// ─── Draggable Effect Badge ───

function EffectBadge({ effect }: { effect: typeof DRAGGABLE_EFFECTS[number] }) {
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('application/x-strudel-fx', JSON.stringify(effect))
        e.dataTransfer.effectAllowed = 'copy'
      }}
      className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/[0.03] border border-white/[0.06]
        hover:bg-white/[0.06] hover:border-white/[0.12] cursor-grab active:cursor-grabbing
        transition-all text-[8px] select-none shrink-0"
      title={`Drag onto a channel to add ${effect.label}`}
    >
      <span className="text-[9px]">{effect.icon}</span>
      <span className="text-white/30 font-bold uppercase tracking-wide">{effect.label}</span>
    </div>
  )
}

// ─── Single Channel Strip ───

function ChannelStrip({
  channel,
  channelIdx,
  isExpanded,
  isMuted,
  isSoloed,
  isDragOver,
  onToggle,
  onParamChange,
  onMute,
  onSolo,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  channel: ParsedChannel
  channelIdx: number
  isExpanded: boolean
  isMuted: boolean
  isSoloed: boolean
  isDragOver: boolean
  onToggle: () => void
  onParamChange: (channelIdx: number, paramKey: string, value: number) => void
  onMute: (idx: number) => void
  onSolo: (idx: number, exclusive: boolean) => void
  onDragOver: (e: React.DragEvent) => void
  onDragLeave: () => void
  onDrop: (e: React.DragEvent) => void
}) {
  const gainParam = channel.params.find(p => p.key === 'gain')

  // Group effects by category
  const fxGroups = useMemo(() => {
    return FX_GROUPS.map(group => ({
      ...group,
      params: channel.params.filter(p => group.keys.includes(p.key)),
      active: group.keys.some(k => channel.effects.includes(k)),
    })).filter(g => g.active || g.params.length > 0)
  }, [channel])

  // Track drag enter/leave count to prevent flicker from child elements
  const dragCountRef = useRef(0)

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    dragCountRef.current++
    if (dragCountRef.current === 1) onDragOver(e)
  }, [onDragOver])

  const handleDragLeaveLocal = useCallback((e: React.DragEvent) => {
    dragCountRef.current--
    if (dragCountRef.current <= 0) {
      dragCountRef.current = 0
      onDragLeave()
    }
  }, [onDragLeave])

  const handleDropLocal = useCallback((e: React.DragEvent) => {
    dragCountRef.current = 0
    onDrop(e)
  }, [onDrop])

  return (
    <div
      className={`border rounded-lg overflow-hidden transition-all ${
        isDragOver
          ? 'border-cyan-400/40 bg-cyan-400/[0.03] shadow-lg shadow-cyan-500/10'
          : isExpanded
            ? 'border-white/[0.08]'
            : 'border-white/[0.06]'
      } ${isMuted ? 'opacity-40' : ''}`}
      style={{ borderColor: isExpanded && !isDragOver ? `${channel.color}20` : undefined }}
      onDragOver={(e) => e.preventDefault()}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeaveLocal}
      onDrop={handleDropLocal}
    >
      {/* ── Channel Header ── */}
      <div className="flex items-center gap-1 px-2 py-1.5">
        {/* Solo button */}
        <button
          onClick={(e) => { e.stopPropagation(); onSolo(channelIdx, !e.ctrlKey && !e.shiftKey) }}
          className={`w-4 h-4 rounded text-[7px] font-black flex items-center justify-center transition-all cursor-pointer ${
            isSoloed
              ? 'bg-amber-400/20 text-amber-400 border border-amber-400/40'
              : 'bg-white/[0.02] text-white/15 border border-white/[0.06] hover:text-white/30'
          }`}
          title={`Solo${'\n'}Ctrl+click for multi-solo`}
        >
          S
        </button>

        {/* Mute button */}
        <button
          onClick={(e) => { e.stopPropagation(); onMute(channelIdx) }}
          className={`w-4 h-4 rounded text-[7px] font-black flex items-center justify-center transition-all cursor-pointer ${
            isMuted
              ? 'bg-red-400/20 text-red-400 border border-red-400/40'
              : 'bg-white/[0.02] text-white/15 border border-white/[0.06] hover:text-white/30'
          }`}
          title="Mute"
        >
          M
        </button>

        {/* Expand toggle + channel info */}
        <button
          onClick={onToggle}
          className="flex-1 flex items-center gap-1.5 min-w-0 hover:bg-white/[0.02] rounded px-1 py-0.5 transition-colors cursor-pointer"
        >
          {/* Source icon */}
          <span className="text-sm shrink-0">{channel.icon}</span>

          {/* Name + source */}
          <div className="flex-1 text-left min-w-0">
            <div className="flex items-center gap-1">
              <span
                className="text-[10px] font-bold tracking-wide uppercase"
                style={{ color: channel.color }}
              >
                {channel.name}
              </span>
              {channel.sourceType === 'stack' && (
                <Layers size={8} className="text-white/20" />
              )}
            </div>
            <div className="text-[7px] text-white/20 font-mono truncate">
              {channel.source}
            </div>
          </div>

          {/* FX count badge */}
          {channel.effects.length > 0 && (
            <span
              className="text-[7px] font-bold px-1 py-0.5 rounded-full shrink-0"
              style={{
                backgroundColor: `${channel.color}15`,
                color: `${channel.color}90`,
              }}
            >
              {channel.effects.length}fx
            </span>
          )}

          {/* Expand arrow */}
          {isExpanded ? (
            <ChevronDown size={10} className="text-white/20 shrink-0" />
          ) : (
            <ChevronRight size={10} className="text-white/20 shrink-0" />
          )}
        </button>

        {/* Quick gain knob (always visible) */}
        <div
          className="shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <StudioKnob
            label=""
            value={gainParam?.value ?? 0.8}
            min={0}
            max={2}
            step={0.01}
            size={28}
            color={channel.color}
            isComplex={gainParam?.isComplex}
            onChange={(v) => onParamChange(channelIdx, 'gain', v)}
          />
        </div>
      </div>

      {/* ── Drop indicator ── */}
      {isDragOver && (
        <div className="px-3 py-1 text-[8px] text-cyan-400/60 text-center bg-cyan-400/[0.05] border-t border-cyan-400/20 font-mono">
          ⬇ DROP TO ADD EFFECT
        </div>
      )}

      {/* ── Expanded: Nested Effect Racks ── */}
      {isExpanded && (
        <div className="border-t border-white/[0.04] bg-[#08080c]">
          {/* Visuals indicator */}
          {(channel.effects.includes('scope') || channel.effects.includes('pianoroll')) && (
            <div className="flex items-center gap-1.5 px-3 py-1 border-b border-white/[0.04]">
              <span className="text-[7px]">📊</span>
              <span className="text-[7px] text-white/20 font-mono uppercase tracking-wider">
                {channel.effects.filter(e => e === 'scope' || e === 'pianoroll').join(' + ')}
              </span>
            </div>
          )}

          {/* FX Group racks */}
          {fxGroups.map((group) => (
            <div
              key={group.label}
              className="border-b border-white/[0.03] last:border-b-0"
            >
              {/* Group header */}
              <div className="flex items-center gap-1.5 px-3 py-1">
                <span className="text-[8px]">{group.icon}</span>
                <span className="text-[7px] font-bold text-white/15 uppercase tracking-[.15em]">
                  {group.label}
                </span>
                <div className="flex-1 h-px bg-white/[0.03]" />
              </div>

              {/* Knobs row */}
              <div className="flex flex-wrap gap-1 px-2 pb-2 justify-center">
                {group.params.map((param) => {
                  const def = getParamDef(param.key)
                  if (!def) return null
                  return (
                    <StudioKnob
                      key={param.key}
                      label={def.label}
                      value={param.value}
                      min={def.min}
                      max={def.max}
                      step={def.step}
                      size={32}
                      color={channel.color}
                      unit={def.unit}
                      isComplex={param.isComplex}
                      onChange={(v) => onParamChange(channelIdx, param.key, v)}
                    />
                  )
                })}
              </div>
            </div>
          ))}

          {/* Orbit indicator */}
          {channel.params.find(p => p.key === 'orbit') && (
            <div className="flex items-center gap-1.5 px-3 py-1 border-t border-white/[0.03]">
              <span className="text-[7px]">🔀</span>
              <span className="text-[7px] text-white/15 font-mono">
                ORBIT {channel.params.find(p => p.key === 'orbit')?.value}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Mixer Rack (right sidebar) ───

interface StudioMixerRackProps {
  code: string
  onCodeChange: (code: string) => void
  onMixerStateChange?: (state: { muted: Set<number>; soloed: Set<number> }) => void
}

export default function StudioMixerRack({ code, onCodeChange, onMixerStateChange }: StudioMixerRackProps) {
  const channels = useMemo(() => parseStrudelCode(code), [code])
  const [expandedChannels, setExpandedChannels] = useState<Set<string>>(new Set())
  const [mutedChannels, setMutedChannels] = useState<Set<number>>(new Set())
  const [soloedChannels, setSoloedChannels] = useState<Set<number>>(new Set())
  const [dragOverChannel, setDragOverChannel] = useState<number | null>(null)

  // Keep a ref to code so callbacks always see the latest value
  // (prevents stale closure during fast knob drags)
  const codeRef = useRef(code)
  codeRef.current = code

  // Reset mute/solo when channel count changes (user added/removed blocks)
  const prevChannelCount = useRef(0)
  useEffect(() => {
    if (channels.length !== prevChannelCount.current) {
      prevChannelCount.current = channels.length
      setMutedChannels(new Set())
      setSoloedChannels(new Set())
    }
  }, [channels.length])

  // Notify parent when mute/solo state changes
  useEffect(() => {
    onMixerStateChange?.({ muted: mutedChannels, soloed: soloedChannels })
  }, [mutedChannels, soloedChannels, onMixerStateChange])

  const toggleChannel = useCallback((id: string) => {
    setExpandedChannels(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  // ── Solo handler ──
  // Click = exclusive solo (only this channel).
  // Ctrl/Shift+click = additive (toggle this channel in solo set).
  const handleSolo = useCallback((idx: number, exclusive: boolean) => {
    setSoloedChannels(prev => {
      if (exclusive) {
        // If already the only solo → clear all solos
        if (prev.has(idx) && prev.size === 1) return new Set()
        // Otherwise solo only this channel
        return new Set([idx])
      } else {
        // Additive toggle
        const next = new Set(prev)
        if (next.has(idx)) next.delete(idx)
        else next.add(idx)
        return next
      }
    })
  }, [])

  // ── Mute handler ──
  const handleMute = useCallback((idx: number) => {
    setMutedChannels(prev => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }, [])

  // ── Param change handler ──
  // Uses codeRef (not closure `code`) to always read latest code.
  // NO insert fallback — if the param doesn't exist or has a pattern
  // value, the knob simply does nothing. Use drag-and-drop to add
  // new effects. This prevents the duplicate-insert bug where
  // identical-value replacements triggered the fallback.
  const handleParamChange = useCallback(
    (channelIdx: number, paramKey: string, value: number) => {
      const currentCode = codeRef.current
      const newCode = updateParamInCode(currentCode, channelIdx, paramKey, value)
      if (newCode !== currentCode) {
        onCodeChange(newCode)
      }
    },
    [onCodeChange],
  )

  // ── Drag & drop handlers ──
  const handleDragOver = useCallback((idx: number) => {
    setDragOverChannel(idx)
  }, [])

  const handleDragLeave = useCallback(() => {
    setDragOverChannel(null)
  }, [])

  const handleDrop = useCallback(
    (channelIdx: number, e: React.DragEvent) => {
      e.preventDefault()
      setDragOverChannel(null)

      try {
        const data = e.dataTransfer.getData('application/x-strudel-fx')
        if (!data) return
        const effect = JSON.parse(data)
        const currentCode = codeRef.current
        const newCode = insertEffectInChannel(currentCode, channelIdx, effect.code)
        if (newCode !== currentCode) onCodeChange(newCode)
      } catch {
        // Invalid drop data
      }
    },
    [onCodeChange],
  )

  return (
    <div className="h-full flex flex-col bg-[#0b0b0f] overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-3 py-2 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <Volume2 size={10} className="text-cyan-400/40" />
          <span className="text-[8px] font-bold uppercase tracking-[.2em] text-cyan-400/40">
            MIXER RACK
          </span>
          <span className="text-[8px] font-mono text-white/15 ml-auto">
            {channels.length} ch
          </span>
        </div>

        {/* Solo/Mute status indicators */}
        {(soloedChannels.size > 0 || mutedChannels.size > 0) && (
          <div className="flex items-center gap-2 mt-1">
            {soloedChannels.size > 0 && (
              <span className="text-[7px] font-bold text-amber-400/60 flex items-center gap-0.5">
                <Headphones size={8} />
                {soloedChannels.size} SOLO
              </span>
            )}
            {mutedChannels.size > 0 && (
              <span className="text-[7px] font-bold text-red-400/60 flex items-center gap-0.5">
                <VolumeX size={8} />
                {mutedChannels.size} MUTED
              </span>
            )}
            <button
              onClick={() => { setMutedChannels(new Set()); setSoloedChannels(new Set()) }}
              className="text-[7px] text-white/20 hover:text-white/40 ml-auto cursor-pointer"
            >
              CLEAR
            </button>
          </div>
        )}
      </div>

      {/* Channel Strips */}
      <div className="flex-1 overflow-y-auto px-1.5 py-1.5 space-y-1">
        {channels.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-center">
            <Plus size={16} className="text-white/10 mb-2" />
            <span className="text-[9px] text-white/15">
              Add <code className="text-cyan-400/40">$:</code> blocks
            </span>
            <span className="text-[8px] text-white/10 mt-0.5">
              to see channels here
            </span>
          </div>
        ) : (
          channels.map((ch, idx) => (
            <ChannelStrip
              key={ch.id}
              channel={ch}
              channelIdx={idx}
              isExpanded={expandedChannels.has(ch.id)}
              isMuted={mutedChannels.has(idx)}
              isSoloed={soloedChannels.has(idx)}
              isDragOver={dragOverChannel === idx}
              onToggle={() => toggleChannel(ch.id)}
              onParamChange={handleParamChange}
              onMute={handleMute}
              onSolo={handleSolo}
              onDragOver={() => handleDragOver(idx)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(idx, e)}
            />
          ))
        )}
      </div>

      {/* ── FX Palette (draggable effects) ── */}
      {channels.length > 0 && (
        <div className="shrink-0 border-t border-white/[0.06] px-2 py-2">
          <div className="flex items-center gap-1.5 mb-1.5">
            <GripVertical size={8} className="text-white/15" />
            <span className="text-[7px] font-bold uppercase tracking-[.2em] text-white/20">
              FX PALETTE
            </span>
            <span className="text-[7px] text-white/10 ml-auto">drag → channel</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {DRAGGABLE_EFFECTS.map(fx => (
              <EffectBadge key={fx.id} effect={fx} />
            ))}
          </div>
        </div>
      )}

      {/* Signal flow indicator */}
      {channels.length > 0 && (
        <div className="shrink-0 px-3 py-1.5 border-t border-white/[0.06]">
          <div className="flex items-center justify-center gap-1">
            {channels.map((ch, i) => (
              <span key={ch.id} className="flex items-center gap-1">
                <span
                  className={`w-1.5 h-1.5 rounded-full transition-opacity ${
                    mutedChannels.has(i) || (soloedChannels.size > 0 && !soloedChannels.has(i))
                      ? 'opacity-10' : 'opacity-50'
                  }`}
                  style={{ backgroundColor: ch.color }}
                />
                {i < channels.length - 1 && (
                  <span className="text-white/10 text-[6px]">·</span>
                )}
              </span>
            ))}
            <span className="text-[6px] text-white/10 ml-1 font-mono">→ OUT</span>
          </div>
        </div>
      )}
    </div>
  )
}
