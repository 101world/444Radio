'use client'

// ═══════════════════════════════════════════════════════════════
//  STUDIO MIXER RACK — Right sidebar hardware rack mixer
//  Auto-parses code into channel strips. Each channel shows:
//    - Sound source with icon
//    - Gain knob (main fader equivalent)
//    - Nested effect racks with knobs for each parameter
//    - Visual indicators for active effects
//  Turning knobs directly updates the code (bidirectional sync).
// ═══════════════════════════════════════════════════════════════

import { useMemo, useCallback, useState } from 'react'
import { ChevronDown, ChevronRight, Plus, Volume2, Layers } from 'lucide-react'
import StudioKnob from './StudioKnob'
import { parseStrudelCode, updateParamInCode, getParamDef, type ParsedChannel } from '@/lib/strudel-code-parser'

// ─── Effect category grouping for nested rack display ───

const FX_GROUPS: { label: string; icon: string; keys: string[] }[] = [
  { label: 'FILTER', icon: '🔽', keys: ['lpf', 'hpf', 'lpq', 'lpenv'] },
  { label: 'DRIVE',  icon: '🔥', keys: ['shape', 'distort', 'crush'] },
  { label: 'SPACE',  icon: '🌌', keys: ['room', 'delay', 'delayfeedback'] },
  { label: 'DUCK',   icon: '🦆', keys: ['duckdepth', 'duckattack'] },
  { label: 'PITCH',  icon: '🎵', keys: ['detune', 'speed', 'rel'] },
]

// ─── Single Channel Strip ───

function ChannelStrip({
  channel,
  channelIdx,
  isExpanded,
  onToggle,
  onParamChange,
}: {
  channel: ParsedChannel
  channelIdx: number
  isExpanded: boolean
  onToggle: () => void
  onParamChange: (channelIdx: number, paramKey: string, value: number) => void
}) {
  const gainParam = channel.params.find(p => p.key === 'gain')

  // Group effects by category for nesting
  const fxGroups = useMemo(() => {
    return FX_GROUPS.map(group => ({
      ...group,
      params: channel.params.filter(p => group.keys.includes(p.key)),
      active: group.keys.some(k => channel.effects.includes(k)),
    })).filter(g => g.active || g.params.length > 0)
  }, [channel])

  return (
    <div
      className="border border-white/[0.06] rounded-lg overflow-hidden transition-all"
      style={{ borderColor: isExpanded ? `${channel.color}20` : undefined }}
    >
      {/* ── Channel Header ── */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-2.5 py-2 hover:bg-white/[0.02] transition-colors cursor-pointer"
      >
        {/* Source icon */}
        <span className="text-sm">{channel.icon}</span>

        {/* Name + source */}
        <div className="flex-1 text-left min-w-0">
          <div className="flex items-center gap-1.5">
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
          <div className="text-[8px] text-white/20 font-mono truncate">
            {channel.source}
          </div>
        </div>

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
            onChange={(v) => onParamChange(channelIdx, 'gain', v)}
          />
        </div>

        {/* FX count badge */}
        {channel.effects.length > 0 && (
          <span
            className="text-[7px] font-bold px-1 py-0.5 rounded-full"
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
}

export default function StudioMixerRack({ code, onCodeChange }: StudioMixerRackProps) {
  const channels = useMemo(() => parseStrudelCode(code), [code])
  const [expandedChannels, setExpandedChannels] = useState<Set<string>>(new Set())

  const toggleChannel = useCallback((id: string) => {
    setExpandedChannels(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const handleParamChange = useCallback(
    (channelIdx: number, paramKey: string, value: number) => {
      const newCode = updateParamInCode(code, channelIdx, paramKey, value)
      if (newCode !== code) {
        onCodeChange(newCode)
      }
    },
    [code, onCodeChange],
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
              onToggle={() => toggleChannel(ch.id)}
              onParamChange={handleParamChange}
            />
          ))
        )}
      </div>

      {/* Signal flow indicator at bottom */}
      {channels.length > 0 && (
        <div className="shrink-0 px-3 py-1.5 border-t border-white/[0.06]">
          <div className="flex items-center justify-center gap-1">
            {channels.map((ch, i) => (
              <span key={ch.id} className="flex items-center gap-1">
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: ch.color, opacity: 0.5 }}
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
