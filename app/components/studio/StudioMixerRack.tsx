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
  swapSoundInChannel, swapBankInChannel,
  getParamDef,
  DRAGGABLE_EFFECTS, type ParsedChannel,
} from '@/lib/strudel-code-parser'

// ─── Sound / Bank pick-lists for dropdown ───

const SOUND_OPTIONS: { group: string; sounds: [string, string][] }[] = [
  { group: 'Synth', sounds: [
    ['sawtooth', 'Sawtooth'], ['supersaw', 'Supersaw'], ['sine', 'Sine'],
    ['square', 'Square'], ['triangle', 'Triangle'],
  ]},
  { group: 'Drums', sounds: [
    ['bd', 'Kick'], ['sd', 'Snare'], ['cp', 'Clap'], ['hh', 'Hi-hat'],
    ['oh', 'Open HH'], ['rim', 'Rim'], ['tom', 'Tom'], ['ride', 'Ride'],
    ['crash', 'Crash'], ['perc', 'Perc'],
  ]},
  { group: 'Keys', sounds: [
    ['gm_piano', 'Piano'], ['gm_epiano1', 'E.Piano (Rhodes)'],
    ['gm_epiano2', 'E.Piano (DX7)'], ['gm_music_box', 'Music Box'],
    ['gm_vibraphone', 'Vibes'], ['gm_marimba', 'Marimba'],
    ['gm_celesta', 'Celesta'], ['gm_clavinet', 'Clavinet'],
  ]},
  { group: 'Organ', sounds: [
    ['gm_organ1', 'Drawbar Organ'], ['gm_organ2', 'Perc. Organ'],
    ['gm_organ3', 'Rock Organ'], ['gm_church_organ', 'Church'],
    ['gm_accordion', 'Accordion'], ['gm_harmonica', 'Harmonica'],
  ]},
  { group: 'Guitar & Bass', sounds: [
    ['gm_acoustic_guitar_nylon', 'Nylon Gtr'], ['gm_acoustic_guitar_steel', 'Steel Gtr'],
    ['gm_electric_guitar_jazz', 'Jazz Gtr'], ['gm_electric_guitar_clean', 'Clean Gtr'],
    ['gm_overdriven_guitar', 'Overdrive'], ['gm_distortion_guitar', 'Distortion'],
    ['gm_acoustic_bass', 'Acoustic Bass'], ['gm_electric_bass_finger', 'Finger Bass'],
    ['gm_slap_bass1', 'Slap Bass'], ['gm_synth_bass1', 'Synth Bass 1'],
    ['gm_synth_bass2', 'Synth Bass 2'],
  ]},
  { group: 'Strings', sounds: [
    ['gm_violin', 'Violin'], ['gm_viola', 'Viola'], ['gm_cello', 'Cello'],
    ['gm_contrabass', 'Contrabass'], ['gm_string_ensemble1', 'String Ens.'],
    ['gm_synth_strings1', 'Synth Strings'], ['gm_orchestral_harp', 'Harp'],
    ['gm_pizzicato_strings', 'Pizzicato'],
  ]},
  { group: 'Brass & Sax', sounds: [
    ['gm_trumpet', 'Trumpet'], ['gm_trombone', 'Trombone'],
    ['gm_french_horn', 'French Horn'], ['gm_brass_section', 'Brass Section'],
    ['gm_alto_sax', 'Alto Sax'], ['gm_tenor_sax', 'Tenor Sax'],
    ['gm_soprano_sax', 'Soprano Sax'],
  ]},
  { group: 'Flute & Pipe', sounds: [
    ['gm_flute', 'Flute'], ['gm_piccolo', 'Piccolo'],
    ['gm_pan_flute', 'Pan Flute'], ['gm_recorder', 'Recorder'],
  ]},
  { group: 'Voice', sounds: [
    ['gm_choir_aahs', 'Choir Aahs'], ['gm_voice_oohs', 'Voice Oohs'],
    ['gm_synth_voice', 'Synth Voice'],
  ]},
  { group: 'Synth Leads', sounds: [
    ['gm_lead1_square', 'Lead Square'], ['gm_lead2_sawtooth', 'Lead Saw'],
    ['gm_lead5_charang', 'Charang'], ['gm_lead7_fifths', 'Fifths'],
  ]},
  { group: 'Synth Pads', sounds: [
    ['gm_pad1_new_age', 'New Age'], ['gm_pad2_warm', 'Warm'],
    ['gm_pad3_polysynth', 'Polysynth'], ['gm_pad4_choir', 'Choir Pad'],
    ['gm_pad7_halo', 'Halo'], ['gm_pad8_sweep', 'Sweep'],
  ]},
  { group: 'SFX & Ethnic', sounds: [
    ['gm_fx3_crystal', 'Crystal'], ['gm_fx4_atmosphere', 'Atmosphere'],
    ['gm_fx7_echoes', 'Echoes'], ['gm_fx8_scifi', 'Sci-Fi'],
    ['gm_kalimba', 'Kalimba'], ['gm_steel_drums', 'Steel Drums'],
    ['gm_sitar', 'Sitar'], ['gm_koto', 'Koto'],
  ]},
  { group: 'Samples', sounds: [
    ['casio', 'Casio'], ['jazz', 'Jazz Kit'], ['metal', 'Metal'],
    ['mouth', 'Mouth'], ['gabba', 'Gabba'], ['space', 'Space'],
    ['noise', 'Noise'],
  ]},
]

const BANK_OPTIONS: [string, string][] = [
  ['RolandTR808', 'TR-808'],
  ['RolandTR909', 'TR-909'],
  ['RolandCR78', 'CR-78'],
  ['AkaiLinn', 'LinnDrum'],
  ['RhythmAce', 'Rhythm Ace'],
  ['ViscoSpaceDrum', 'Space Drum'],
]

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
  onSoundChange,
  onBankChange,
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
  onSoundChange: (idx: number, sound: string) => void
  onBankChange: (idx: number, bank: string) => void
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
      <div className="px-2 py-1.5">
        {/* Top row: S M expand-area gain */}
        <div className="flex items-center gap-1">
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

            {/* Name */}
            <span
              className="text-[10px] font-bold tracking-wide uppercase truncate"
              style={{ color: channel.color }}
            >
              {channel.name}
            </span>
            {channel.sourceType === 'stack' && (
              <Layers size={8} className="text-white/20" />
            )}

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

        {/* Row 2: Sound / Bank dropdowns */}
        {(channel.isSimpleSource || channel.bank || channel.sourceType === 'sample') && (
          <div className="flex items-center gap-1.5 mt-0.5 ml-10">
            {/* Sound dropdown */}
            {channel.isSimpleSource ? (
              <select
                value={channel.source}
                onChange={(e) => onSoundChange(channelIdx, e.target.value)}
                className="text-[8px] font-mono bg-white/[0.03] text-white/50 border border-white/[0.06] rounded px-1 py-0.5 outline-none cursor-pointer hover:border-white/[0.15] hover:text-cyan-400/70 transition-colors max-w-[90px] truncate"
                title="Change sound / instrument"
              >
                <option value={channel.source}>{channel.source}</option>
                {SOUND_OPTIONS.map(g => (
                  <optgroup key={g.group} label={g.group}>
                    {g.sounds
                      .filter(([val]) => val !== channel.source)
                      .map(([val, label]) => (
                        <option key={val} value={val}>{label}</option>
                      ))}
                  </optgroup>
                ))}
              </select>
            ) : (
              <span className="text-[7px] text-white/20 font-mono truncate max-w-[80px]">
                {channel.source}
              </span>
            )}

            {/* Bank dropdown */}
            {(channel.bank || channel.sourceType === 'sample') && (
              <select
                value={channel.bank || ''}
                onChange={(e) => onBankChange(channelIdx, e.target.value)}
                className="text-[8px] font-mono bg-amber-400/[0.04] text-amber-400/50 border border-amber-400/[0.1] rounded px-1 py-0.5 outline-none cursor-pointer hover:border-amber-400/30 hover:text-amber-400/80 transition-colors max-w-[72px] truncate"
                title="Change drum bank"
              >
                {channel.bank ? (
                  <option value={channel.bank}>{channel.bank}</option>
                ) : (
                  <option value="">No Bank</option>
                )}
                {BANK_OPTIONS
                  .filter(([val]) => val !== channel.bank)
                  .map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
              </select>
            )}
          </div>
        )}
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

  // ── Sound / Bank swap handlers ──
  const handleSoundChange = useCallback(
    (channelIdx: number, newSound: string) => {
      const currentCode = codeRef.current
      const newCode = swapSoundInChannel(currentCode, channelIdx, newSound)
      if (newCode !== currentCode) onCodeChange(newCode)
    },
    [onCodeChange],
  )

  const handleBankChange = useCallback(
    (channelIdx: number, newBank: string) => {
      if (!newBank) return // user picked "No Bank", ignore
      const currentCode = codeRef.current
      const newCode = swapBankInChannel(currentCode, channelIdx, newBank)
      if (newCode !== currentCode) onCodeChange(newCode)
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
              onSoundChange={handleSoundChange}
              onBankChange={handleBankChange}
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
