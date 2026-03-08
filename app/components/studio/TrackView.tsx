'use client'

// ═══════════════════════════════════════════════════════════════
//  TRACK VIEW v2 — Vertical stacked DAW-style track lanes
//
//  Features:
//    - Per-track multi-mode scope (waveform/bars/mirror) — click to cycle
//    - Selected track highlighting with bottom effects panel
//    - All FX knobs organized by groups, context-aware per channel type
//    - Inline knobs on expanded tracks
//    - Synced playhead + beat grid + peak meters
// ═══════════════════════════════════════════════════════════════

import { useRef, useEffect, useCallback, useState, useMemo, memo } from 'react'
import { ChevronDown, ChevronRight, Plus, Piano, Grid3X3, MoreVertical, Copy, RotateCcw, Trash2, Link, Unlink, X, Pencil, Layers, VolumeX, Volume2 } from 'lucide-react'

// ─── Rack type: a named group of channels ───
export type Rack = {
  id: string
  name: string
  color: string
  channelIndices: number[]
  collapsed: boolean
}
import ArrangementTimeline, { type ArrangementSection, type PatternVariant } from './ArrangementTimeline'
import type { AudioClip, AudioTrack, ClipClipboard } from '@/lib/audio-clip-engine'
import AutomationLane from './AutomationLane'
import TrackTimeline from './TrackTimeline'
import StudioKnob from './StudioKnob'
import HardwareKnob from './HardwareKnob'
import { getOrbitAnalyser } from '@/lib/studio-analysers'
import { PARAM_DEFS, getParamDef, getTranspose, getArpInfo, ARP_MODES, parseAutoKey, type ParsedChannel, type ParamDef, type StackRow } from '@/lib/strudel-code-parser'
import { FX_GROUPS, TYPE_RELEVANT_GROUPS, FX_DESCRIPTIONS } from './StudioEffectsPanel'

// Sidechain routing info (mirrors ChannelStrip's sidechainInfo prop)
type SidechainInfo = {
  isSource: boolean
  duckTargetOrbit: number | null
  targetChannels: { idx: number; name: string; color: string; icon: string }[]
  isDucked: boolean
  duckedBySource: { name: string; color: string; orbit: number } | null
  isKickLike: boolean
  availableTargets: { idx: number; name: string }[]
  hasDuckParams: boolean
}

// ─── Scope types for per-track visualization ───
const TRACK_SCOPE_TYPES = [
  { id: 'waveform', label: 'WAVE' },
  { id: 'bars',     label: 'FREQ' },
  { id: 'mirror',   label: 'MIRROR' },
  { id: 'timeline', label: 'LANE' },
] as const
type TrackScopeType = typeof TRACK_SCOPE_TYPES[number]['id']

// Type-specific effect key filtering
const INSTRUMENT_ONLY_KEYS = new Set(['detune'])
const SAMPLE_ONLY_KEYS = new Set(['speed', 'loopAt', 'loop', 'begin', 'end', 'chop', 'stretch', 'slice', 'splice', 'striate', 'fit', 'scrub', 'loopBegin', 'loopEnd', 'cut', 'n', 'hurry', 'unit'])

// Sound/Bank dropdown data — shared with StudioMixerRack
const INSTRUMENT_GROUPS = new Set(['Synth', 'Keys', 'Organ', 'Guitar & Bass', 'Strings', 'Brass & Sax', 'Flute & Pipe', 'Voice', 'Synth Leads', 'Synth Pads', 'SFX & Ethnic'])
const SOUND_GROUPS = new Set(['Drums', 'Samples', 'SFX & Ethnic'])

const SOUND_OPTIONS: { group: string; sounds: [string, string][] }[] = [
  { group: 'Synth', sounds: [['sawtooth', 'Sawtooth'], ['supersaw', 'Supersaw'], ['sine', 'Sine'], ['square', 'Square'], ['triangle', 'Triangle']] },
  { group: 'Drums', sounds: [['bd', 'Kick'], ['sd', 'Snare'], ['cp', 'Clap'], ['hh', 'Hi-hat'], ['oh', 'Open HH'], ['rim', 'Rim'], ['tom', 'Tom'], ['ride', 'Ride'], ['crash', 'Crash'], ['perc', 'Perc']] },
  { group: 'Keys', sounds: [['gm_piano', 'Piano'], ['gm_epiano1', 'E.Piano (Rhodes)'], ['gm_epiano2', 'E.Piano (DX7)'], ['gm_music_box', 'Music Box'], ['gm_vibraphone', 'Vibes'], ['gm_marimba', 'Marimba']] },
  { group: 'Organ', sounds: [['gm_drawbar_organ', 'Drawbar Organ'], ['gm_percussive_organ', 'Perc. Organ'], ['gm_rock_organ', 'Rock Organ']] },
  { group: 'Guitar & Bass', sounds: [['gm_acoustic_guitar_nylon', 'Nylon Gtr'], ['gm_electric_guitar_jazz', 'Jazz Gtr'], ['gm_acoustic_bass', 'Acoustic Bass'], ['gm_synth_bass_1', 'Synth Bass 1'], ['gm_synth_bass_2', 'Synth Bass 2']] },
  { group: 'Strings', sounds: [['gm_violin', 'Violin'], ['gm_cello', 'Cello'], ['gm_string_ensemble_1', 'String Ens.'], ['gm_orchestral_harp', 'Harp']] },
  { group: 'Brass & Sax', sounds: [['gm_trumpet', 'Trumpet'], ['gm_trombone', 'Trombone'], ['gm_alto_sax', 'Alto Sax'], ['gm_tenor_sax', 'Tenor Sax']] },
  { group: 'Flute & Pipe', sounds: [['gm_flute', 'Flute'], ['gm_piccolo', 'Piccolo'], ['gm_pan_flute', 'Pan Flute']] },
  { group: 'Voice', sounds: [['gm_choir_aahs', 'Choir Aahs'], ['gm_voice_oohs', 'Voice Oohs'], ['gm_synth_choir', 'Synth Choir']] },
  { group: 'Synth Leads', sounds: [['gm_lead_1_square', 'Lead Square'], ['gm_lead_2_sawtooth', 'Lead Saw'], ['gm_lead_8_bass_lead', 'Bass+Lead']] },
  { group: 'Synth Pads', sounds: [['gm_pad_new_age', 'New Age'], ['gm_pad_warm', 'Warm'], ['gm_pad_poly', 'Polysynth']] },
  { group: 'SFX & Ethnic', sounds: [['gm_kalimba', 'Kalimba'], ['gm_sitar', 'Sitar'], ['gm_steel_drums', 'Steel Drums']] },
  { group: 'Samples', sounds: [['casio', 'Casio'], ['jazz', 'Jazz Kit'], ['metal', 'Metal'], ['mouth', 'Mouth'], ['gabba', 'Gabba']] },
]

const BANK_OPTIONS: [string, string][] = [
  ['RolandTR808', 'TR-808'], ['RolandTR909', 'TR-909'], ['RolandTR707', 'TR-707'],
  ['RolandTR606', 'TR-606'], ['RolandTR626', 'TR-626'], ['RolandTR505', 'TR-505'],
  ['KorgDDM110', 'KorgDDM-110'], ['KorgMinipops', 'Minipops'],
  ['AkaiLinn', 'Akai/Linn'], ['AkaiMPC60', 'MPC60'], ['LinnDrum', 'LinnDrum'],
  ['BossDR110', 'DR-110'], ['BossDR220', 'DR-220'], ['BossDR55', 'DR-55'],
  ['EmuDrumulator', 'Drumulator'], ['OberheimDMX', 'DMX'],
  ['AlesisHR16', 'HR-16'], ['AlesisSR16', 'SR-16'],
]

// ─── Helper: get orbit from channel ───
function getChannelOrbit(channel: ParsedChannel): number {
  const p = channel.params.find(p => p.key === 'orbit')
  if (p && !p.isComplex) {
    const n = parseFloat(String(p.value))
    if (!isNaN(n)) return n
  }
  return 1
}

// ─────────────────────────────────────────────────────────────
//  TrackScope — per-track multi-mode audio visualizer
//  Click to cycle through: waveform → bars → mirror
// ─────────────────────────────────────────────────────────────
function TrackScope({
  channel, isPlaying, isMuted, scopeType, collapsed,
}: {
  channel: ParsedChannel
  isPlaying: boolean
  isMuted: boolean
  scopeType: TrackScopeType
  collapsed: boolean
  isSelected: boolean
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)
  const peakRef = useRef(0)
  const scopeTypeRef = useRef(scopeType)
  useEffect(() => { scopeTypeRef.current = scopeType }, [scopeType])

  const orbit = getChannelOrbit(channel)
  const color = channel.color

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const w = canvas.width
    const h = canvas.height
    const type = scopeTypeRef.current

    // Clear with subtle trail
    ctx.fillStyle = 'rgba(10, 11, 13, 0.35)'
    ctx.fillRect(0, 0, w, h)

    if (!isPlaying || isMuted) {
      peakRef.current = 0
      // Idle center line
      ctx.strokeStyle = `${color}15`
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(0, h / 2)
      ctx.lineTo(w, h / 2)
      ctx.stroke()
      rafRef.current = requestAnimationFrame(draw)
      return
    }

    const analyser = getOrbitAnalyser(orbit)
    if (!analyser) {
      // No analyser — dim dots
      ctx.fillStyle = `${color}20`
      for (let i = 0; i < 12; i++) {
        ctx.fillRect((i / 12) * w + w / 24 - 1, h / 2 - 1, 2, 2)
      }
      rafRef.current = requestAnimationFrame(draw)
      return
    }

    const bufLen = analyser.frequencyBinCount
    const timeData = new Uint8Array(bufLen)
    const freqData = new Uint8Array(bufLen)
    analyser.getByteTimeDomainData(timeData)
    analyser.getByteFrequencyData(freqData)

    // Compute peak
    let maxAmp = 0
    for (let i = 0; i < timeData.length; i++) {
      const abs = Math.abs(timeData[i] - 128)
      if (abs > maxAmp) maxAmp = abs
    }
    peakRef.current = Math.max(maxAmp, peakRef.current * 0.9)

    const intensity = Math.min(1, peakRef.current / 80)

    switch (type) {
      case 'waveform':
        drawWaveform(ctx, timeData, w, h, color, intensity)
        break
      case 'bars':
        drawBars(ctx, freqData, w, h, color, intensity)
        break
      case 'mirror':
        drawMirror(ctx, timeData, w, h, color, intensity)
        break
    }

    rafRef.current = requestAnimationFrame(draw)
  }, [isPlaying, isMuted, orbit, color])

  useEffect(() => {
    rafRef.current = requestAnimationFrame(draw)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [draw])

  const canvasH = collapsed ? 28 : 72

  return (
    <canvas
      ref={canvasRef}
      width={1200}
      height={canvasH}
      className="w-full h-full"
      style={{ display: 'block' }}
    />
  )
}

// ─── Drawing functions ───

function drawWaveform(
  ctx: CanvasRenderingContext2D, data: Uint8Array,
  w: number, h: number, color: string, intensity: number,
) {
  const cy = h / 2

  // Glow layer
  ctx.strokeStyle = `${color}50`
  ctx.lineWidth = 2.5 + intensity * 2
  ctx.beginPath()
  for (let x = 0; x < w; x++) {
    const idx = Math.floor((x / w) * data.length)
    const v = (data[idx] - 128) / 128
    const y = cy + v * cy * 0.85
    if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
  }
  ctx.stroke()

  // Sharp line
  ctx.strokeStyle = color
  ctx.lineWidth = 1.5
  ctx.beginPath()
  for (let x = 0; x < w; x++) {
    const idx = Math.floor((x / w) * data.length)
    const v = (data[idx] - 128) / 128
    const y = cy + v * cy * 0.85
    if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
  }
  ctx.stroke()

  // Fill under curve
  ctx.lineTo(w, cy)
  ctx.lineTo(0, cy)
  ctx.closePath()
  ctx.fillStyle = `${color}08`
  ctx.fill()
}

function drawBars(
  ctx: CanvasRenderingContext2D, data: Uint8Array,
  w: number, h: number, color: string, _intensity: number,
) {
  const barCount = 64
  const barW = w / barCount - 1
  const gap = 1

  for (let i = 0; i < barCount; i++) {
    const dataIdx = Math.floor((i / barCount) * data.length * 0.6)
    const val = data[dataIdx] / 255
    const barH = val * h * 0.92
    const x = i * (barW + gap)
    const y = h - barH

    // Color varies by frequency
    const alpha = 0.25 + val * 0.65
    ctx.fillStyle = `${color}${Math.round(alpha * 255).toString(16).padStart(2, '0')}`
    ctx.fillRect(x, y, barW, barH)

    // Top cap
    if (barH > 2) {
      ctx.fillStyle = color
      ctx.fillRect(x, y, barW, 1.5)
    }
  }
}

function drawMirror(
  ctx: CanvasRenderingContext2D, data: Uint8Array,
  w: number, h: number, color: string, _intensity: number,
) {
  const cy = h / 2

  // Top half
  ctx.strokeStyle = `${color}60`
  ctx.lineWidth = 1.5
  ctx.beginPath()
  for (let x = 0; x < w; x++) {
    const idx = Math.floor((x / w) * data.length)
    const v = Math.abs(data[idx] - 128) / 128
    const y = cy - v * cy * 0.85
    if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
  }
  ctx.stroke()

  // Fill top
  ctx.lineTo(w, cy)
  ctx.lineTo(0, cy)
  ctx.closePath()
  ctx.fillStyle = `${color}10`
  ctx.fill()

  // Bottom half (mirror)
  ctx.strokeStyle = `${color}40`
  ctx.lineWidth = 1
  ctx.beginPath()
  for (let x = 0; x < w; x++) {
    const idx = Math.floor((x / w) * data.length)
    const v = Math.abs(data[idx] - 128) / 128
    const y = cy + v * cy * 0.85
    if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
  }
  ctx.stroke()

  // Fill bottom
  ctx.lineTo(w, cy)
  ctx.lineTo(0, cy)
  ctx.closePath()
  ctx.fillStyle = `${color}08`
  ctx.fill()

  // Center line
  ctx.strokeStyle = `${color}25`
  ctx.lineWidth = 0.5
  ctx.beginPath()
  ctx.moveTo(0, cy)
  ctx.lineTo(w, cy)
  ctx.stroke()
}

// ─── Mini peak meter ───
function PeakMeter({ channel, isPlaying, isMuted }: { channel: ParsedChannel; isPlaying: boolean; isMuted: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)
  const peakRef = useRef(0)

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const w = canvas.width
    const h = canvas.height
    ctx.clearRect(0, 0, w, h)

    if (!isPlaying || isMuted) {
      ctx.fillStyle = 'rgba(255,255,255,0.03)'
      ctx.fillRect(0, 0, w, h)
      peakRef.current = 0
      rafRef.current = requestAnimationFrame(draw)
      return
    }

    const orbit = getChannelOrbit(channel)
    const analyser = getOrbitAnalyser(orbit)
    if (analyser) {
      const data = new Uint8Array(analyser.frequencyBinCount)
      analyser.getByteTimeDomainData(data)
      let maxAmp = 0
      for (let i = 0; i < data.length; i++) {
        const abs = Math.abs(data[i] - 128)
        if (abs > maxAmp) maxAmp = abs
      }
      peakRef.current = Math.max(maxAmp, peakRef.current * 0.88)
    }

    const level = Math.min(peakRef.current / 100, 1)
    const barH = level * h
    ctx.fillStyle = 'rgba(255,255,255,0.02)'
    ctx.fillRect(0, 0, w, h)
    const gradient = ctx.createLinearGradient(0, h, 0, 0)
    gradient.addColorStop(0, `${channel.color}80`)
    gradient.addColorStop(0.7, `${channel.color}60`)
    gradient.addColorStop(1, '#b86f6f80')
    ctx.fillStyle = gradient
    ctx.fillRect(0, h - barH, w, barH)
    if (level > 0.05) {
      ctx.fillStyle = channel.color
      ctx.fillRect(0, h - barH, w, 1)
    }
    rafRef.current = requestAnimationFrame(draw)
  }, [isPlaying, isMuted, channel])

  useEffect(() => {
    rafRef.current = requestAnimationFrame(draw)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [draw])

  return (
    <canvas ref={canvasRef} width={4} height={60} className="rounded-sm"
      style={{ width: 3, height: '100%', minHeight: 20 }} />
  )
}

// ─── Playhead overlay ───
function PlayheadOverlay({ getCyclePosition, isPlaying, trackCount }: {
  getCyclePosition?: () => number | null; isPlaying: boolean; trackCount: number
}) {
  const lineRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number>(0)

  const animate = useCallback(() => {
    if (!isPlaying || !getCyclePosition || !lineRef.current) {
      if (lineRef.current) lineRef.current.style.opacity = '0'
      rafRef.current = requestAnimationFrame(animate)
      return
    }
    const pos = getCyclePosition()
    if (pos === null) {
      lineRef.current.style.opacity = '0'
      rafRef.current = requestAnimationFrame(animate)
      return
    }
    const frac = pos - Math.floor(pos)
    lineRef.current.style.left = `${frac * 100}%`
    lineRef.current.style.opacity = '1'
    rafRef.current = requestAnimationFrame(animate)
  }, [isPlaying, getCyclePosition])

  useEffect(() => {
    rafRef.current = requestAnimationFrame(animate)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [animate])

  if (trackCount === 0) return null

  return (
    <div ref={lineRef}
      className="absolute top-0 bottom-0 z-20 pointer-events-none"
      style={{
        width: 2, opacity: 0,
        background: 'linear-gradient(180deg, #00e5c7 0%, #00e5c780 50%, #00e5c7 100%)',
        boxShadow: '0 0 8px #00e5c760, 0 0 16px #00e5c730',
      }}
    >
      <div className="absolute -top-1 -translate-x-1/2 left-1/2"
        style={{ width: 0, height: 0, borderLeft: '4px solid transparent', borderRight: '4px solid transparent', borderTop: '5px solid #00e5c7' }} />
    </div>
  )
}

// ─── Beat grid ───
function BeatGrid() {
  return (
    <div className="absolute inset-0 pointer-events-none z-[1]">
      {[0.25, 0.5, 0.75].map((pct) => (
        <div key={pct} className="absolute top-0 bottom-0"
          style={{ left: `${pct * 100}%`, width: 1,
            background: pct === 0.5 ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.025)' }} />
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  Track Expansion Panel — full controls matching grid ChannelStrip
//  Sound/Bank selectors, effect tags, grouped FX knobs, stack rows,
//  pitch/transpose, action row with overflow menu
// ─────────────────────────────────────────────────────────────
function TrackExpansionPanel({
  channel, channelIdx,
  onParamChange, onRemoveEffect,
  onSoundChange, onBankChange,
  onRename, onDuplicate, onDelete, onReset,
  onTranspose, onAddSound, onPreview,
  onStackRowSoundChange, onStackRowGainChange, onStackRowBankChange, onRemoveStackRow,
  stackRows, scaleRoot, onAutoPitchMatch,
  getAutoKnobValue,
  // Sidechain routing
  sidechainInfo, onEnableSidechain, onDisableSidechain, onAddSidechainTarget, onRemoveSidechainTarget, onDisconnectSidechain,
}: {
  channel: ParsedChannel; channelIdx: number
  onParamChange: (channelIdx: number, key: string, value: number) => void
  onRemoveEffect?: (channelIdx: number, effectKey: string) => void
  onSoundChange?: (idx: number, sound: string) => void
  onBankChange?: (idx: number, bank: string) => void
  onRename?: (channelIdx: number, newName: string) => void
  onDuplicate?: (channelIdx: number) => void
  onDelete?: (channelIdx: number) => void
  onReset?: (channelIdx: number) => void
  onTranspose?: (channelIdx: number, semitones: number) => void
  onAddSound?: (channelIdx: number, sound: string) => void
  onPreview?: (soundCode: string) => void
  onStackRowSoundChange?: (channelIdx: number, rowIdx: number, newSound: string) => void
  onStackRowGainChange?: (channelIdx: number, rowIdx: number, newGain: number) => void
  onStackRowBankChange?: (channelIdx: number, rowIdx: number, newBank: string) => void
  onRemoveStackRow?: (channelIdx: number, rowIdx: number) => void
  stackRows: StackRow[]
  scaleRoot?: string | null
  onAutoPitchMatch?: (channelIdx: number) => void
  getAutoKnobValue?: (chIdx: number, paramKey: string, staticVal: number) => number
  // Sidechain routing
  sidechainInfo?: SidechainInfo
  onEnableSidechain?: () => void
  onDisableSidechain?: () => void
  onAddSidechainTarget?: (targetIdx: number) => void
  onRemoveSidechainTarget?: (targetIdx: number) => void
  onDisconnectSidechain?: () => void
}) {
  const [showMoreMenu, setShowMoreMenu] = useState(false)
  const moreMenuRef = useRef<HTMLDivElement>(null)

  const isMelodic = channel.sourceType === 'synth' || channel.sourceType === 'note'
  const isSample = channel.sourceType === 'sample' || channel.sourceType === 'stack'

  // Filtered effect knobs (same logic as ChannelStrip)
  const effectKnobs = useMemo(() => {
    const skipKeys = new Set(['gain', 'orbit', 'duck'])
    if (channel.sourceType === 'sample') skipKeys.add('speed')
    if (isMelodic) SAMPLE_ONLY_KEYS.forEach(k => skipKeys.add(k))
    if (isSample) INSTRUMENT_ONLY_KEYS.forEach(k => skipKeys.add(k))
    return channel.params.filter(p => !skipKeys.has(p.key))
  }, [channel, isMelodic, isSample])

  // FX groups with active state
  const fxGroups = useMemo(() => {
    const relevantGroups = TYPE_RELEVANT_GROUPS[channel.sourceType] || TYPE_RELEVANT_GROUPS.sample
    return FX_GROUPS.map(group => ({
      ...group,
      params: channel.params.filter(p => group.keys.includes(p.key)),
      active: group.keys.some(k => channel.effects.includes(k)),
      isRelevant: relevantGroups.has(group.label),
    })).filter(g => g.active || g.params.length > 0)
  }, [channel])

  // Close more menu on outside click
  useEffect(() => {
    if (!showMoreMenu) return
    const handler = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) setShowMoreMenu(false)
    }
    document.addEventListener('pointerdown', handler)
    return () => document.removeEventListener('pointerdown', handler)
  }, [showMoreMenu])

  return (
    <div className="flex flex-col gap-0.5 py-1 overflow-y-auto max-h-[260px]" onClick={(e) => e.stopPropagation()}
      style={{ scrollbarWidth: 'thin', scrollbarColor: `${channel.color}30 transparent` }}>

      {/* ── Pitch (sample channels) ── */}
      {channel.sourceType === 'sample' && (() => {
        const speedParam = channel.params.find(p => p.key === 'speed')
        const currentSpeed = speedParam ? speedParam.value : 1
        const currentSemitones = Math.round(12 * Math.log2(currentSpeed))
        return (
          <div className="flex items-center gap-1 px-1.5 py-0.5">
            <StudioKnob label="PITCH" value={currentSemitones} min={-24} max={24} step={1} size={20} color="#2dd4bf"
              formatValue={(v: number) => (v > 0 ? `+${v}` : `${v}`)}
              onChange={(v: number) => { const newSpeed = Math.pow(2, v / 12); onParamChange(channelIdx, 'speed', parseFloat(newSpeed.toFixed(4))) }} />
            {scaleRoot && onAutoPitchMatch && (
              <button onClick={() => onAutoPitchMatch(channelIdx)}
                className="cursor-pointer transition-all duration-100 active:scale-90"
                style={{ width: 14, height: 14, borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '6px', color: '#2dd4bf', background: '#0a0b0d', border: 'none',
                  boxShadow: '2px 2px 4px #050607, -2px -2px 4px #1a1d22' }}
                title={`Auto-match pitch to ${scaleRoot}`}>🎯</button>
            )}
          </div>
        )
      })()}

      {/* ── Transpose (synth/note channels) ── */}
      {(channel.sourceType === 'synth' || channel.sourceType === 'note') && (() => {
        const currentTranspose = getTranspose(channel.rawCode)
        return (
          <div className="flex items-center gap-0.5 px-1.5 py-0.5">
            <button onClick={() => onTranspose?.(channelIdx, currentTranspose - 12)}
              className="cursor-pointer transition-all duration-100 active:scale-90"
              style={{ width: 14, height: 12, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '5px', fontWeight: 900, color: '#6f8fb3', background: '#0a0b0d', border: 'none',
                boxShadow: '2px 2px 4px #050607, -2px -2px 4px #1a1d22' }}
              title="-1 octave">−12</button>
            <StudioKnob label="TRANS" value={currentTranspose} min={-24} max={24} step={1} size={20} color="#6f8fb3"
              formatValue={(v: number) => (v > 0 ? `+${v}` : `${v}`)}
              onChange={(v: number) => onTranspose?.(channelIdx, v)} />
            <button onClick={() => onTranspose?.(channelIdx, currentTranspose + 12)}
              className="cursor-pointer transition-all duration-100 active:scale-90"
              style={{ width: 14, height: 12, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '5px', fontWeight: 900, color: '#6f8fb3', background: '#0a0b0d', border: 'none',
                boxShadow: '2px 2px 4px #050607, -2px -2px 4px #1a1d22' }}
              title="+1 octave">+12</button>
          </div>
        )
      })()}

      {/* ── Sound / Bank selectors (non-stack) ── */}
      {channel.sourceType !== 'stack' && onSoundChange && (channel.isSimpleSource || channel.bank || channel.sourceType === 'sample' || channel.sourceType === 'synth') && (
        <div className="flex flex-col gap-0.5 px-1.5 py-0.5" style={{ borderTop: '1px solid rgba(255,255,255,0.03)' }}>
          <div className="flex items-center justify-between">
            <span className="text-[5px] font-black uppercase tracking-[.12em]" style={{ color: '#5a616b' }}>
              {isMelodic ? 'INSTRUMENT' : 'SOUND'}
            </span>
            {channel.sourceType === 'sample' && channel.isSimpleSource && onAddSound && (
              <select value="" onChange={(e) => { if (e.target.value) onAddSound(channelIdx, e.target.value) }}
                className="text-[5px] font-mono rounded px-0.5 py-0 outline-none cursor-pointer"
                style={{ color: '#00e5c7', background: '#0a0b0d', border: '1px solid rgba(0,229,199,0.2)', borderRadius: '4px', maxWidth: '50px' }}>
                <option value="">+ ADD</option>
                {SOUND_OPTIONS.filter(g => SOUND_GROUPS.has(g.group)).map(g => (
                  <optgroup key={g.group} label={g.group}>
                    {g.sounds.map(([val, label]) => (<option key={val} value={val}>{label}</option>))}
                  </optgroup>
                ))}
              </select>
            )}
          </div>
          {channel.isSimpleSource ? (
            <div className="flex items-center gap-0.5">
              <select value={channel.source} onChange={(e) => onSoundChange(channelIdx, e.target.value)}
                className="text-[6px] font-mono rounded px-0.5 py-0.5 outline-none cursor-pointer flex-1 min-w-0"
                style={{ color: '#e8ecf0', background: '#111318', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '6px' }}>
                <option value={channel.source}>{channel.source}</option>
                {SOUND_OPTIONS.filter(g => isMelodic ? INSTRUMENT_GROUPS.has(g.group) : SOUND_GROUPS.has(g.group)).map(g => (
                  <optgroup key={g.group} label={g.group}>
                    {g.sounds.filter(([val]) => val !== channel.source).map(([val, label]) => (<option key={val} value={val}>{label}</option>))}
                  </optgroup>
                ))}
              </select>
              {onPreview && (
                <button onClick={() => onPreview(`s("${channel.source}")`)}
                  className="shrink-0 rounded-md p-0.5 transition-all cursor-pointer hover:opacity-100"
                  style={{ color: '#00e5c7', opacity: 0.5 }} title={`Preview ${channel.source}`}>
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
                </button>
              )}
            </div>
          ) : (
            <span className="text-[5px] text-white/20 font-mono truncate">{channel.source}</span>
          )}
          {/* Bank selector */}
          {channel.sourceType !== 'synth' && channel.sourceType !== 'note' && onBankChange && (
            <select value={channel.bank || ''} onChange={(e) => onBankChange(channelIdx, e.target.value)}
              className="text-[6px] font-mono rounded px-0.5 py-0.5 outline-none cursor-pointer"
              style={{ color: '#06b6d4', background: '#111318', border: '1px solid rgba(6,182,212,0.12)', borderRadius: '6px' }}>
              <option value="">{channel.bank || 'No Bank'}</option>
              {BANK_OPTIONS.filter(([val]) => val !== channel.bank).map(([val, label]) => (<option key={val} value={val}>{label}</option>))}
            </select>
          )}
        </div>
      )}

      {/* ── Stack rows (drum machine per-row controls) ── */}
      {channel.sourceType === 'stack' && stackRows.length > 0 && (
        <div className="px-1.5 py-0.5" style={{ borderTop: '1px solid rgba(255,255,255,0.03)' }}>
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-[5px] font-black uppercase tracking-[.12em]" style={{ color: '#5a616b' }}>STACK SOUNDS</span>
            {onAddSound && (
              <select value="" onChange={(e) => { if (e.target.value) onAddSound(channelIdx, e.target.value) }}
                className="text-[5px] font-mono rounded px-0.5 py-0 outline-none cursor-pointer"
                style={{ color: '#00e5c7', background: '#0a0b0d', border: '1px solid rgba(0,229,199,0.2)', borderRadius: '4px', maxWidth: '50px' }}>
                <option value="">+ ADD</option>
                {SOUND_OPTIONS.filter(g => SOUND_GROUPS.has(g.group)).map(g => (
                  <optgroup key={g.group} label={g.group}>
                    {g.sounds.map(([val, label]) => (<option key={val} value={val}>{label}</option>))}
                  </optgroup>
                ))}
              </select>
            )}
          </div>
          {stackRows.map((row, ri) => (
            <div key={ri} className="flex items-center gap-0.5 py-0.5" style={{ borderBottom: ri < stackRows.length - 1 ? '1px solid rgba(255,255,255,0.02)' : 'none' }}>
              <select value={row.instrument} onChange={(e) => onStackRowSoundChange?.(channelIdx, ri, e.target.value)}
                className="text-[6px] font-mono rounded px-0.5 py-0.5 outline-none cursor-pointer flex-1 min-w-0"
                style={{ color: '#e8ecf0', background: '#111318', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '6px' }}>
                <option value={row.instrument}>{row.instrument}</option>
                {SOUND_OPTIONS.filter(g => SOUND_GROUPS.has(g.group)).map(g => (
                  <optgroup key={g.group} label={g.group}>
                    {g.sounds.filter(([val]) => val !== row.instrument).map(([val, label]) => (<option key={val} value={val}>{label}</option>))}
                  </optgroup>
                ))}
              </select>
              <StudioKnob label="G" value={row.gain} min={0} max={1.5} step={0.01} size={16} color={channel.color}
                onChange={(v: number) => onStackRowGainChange?.(channelIdx, ri, v)} />
              {stackRows.length > 1 && onRemoveStackRow && (
                <button onClick={() => onRemoveStackRow(channelIdx, ri)}
                  className="cursor-pointer transition-all hover:text-red-400" style={{ color: '#5a616b', fontSize: '7px', background: 'none', border: 'none' }}>×</button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Active effect tags (removable) ── */}
      {channel.effects.length > 0 && (
        <div className="flex flex-wrap gap-[2px] px-1.5 py-0.5" style={{ borderTop: '1px solid rgba(255,255,255,0.03)' }}>
          {channel.effects
            .filter(fx => !['scope', 'pianoroll', 'orbit', 'gain'].includes(fx))
            .map(fx => {
              const isOffType = (isMelodic && SAMPLE_ONLY_KEYS.has(fx)) || (isSample && INSTRUMENT_ONLY_KEYS.has(fx))
              const tagColor = (fx === 'arp' || fx === 'arpeggiate') ? '#06b6d4' : isOffType ? '#4a6068' : channel.color
              return (
                <span key={fx} className="inline-flex items-center gap-[1px] rounded-full transition-all group/tag"
                  style={{ padding: '0px 3px 0px 4px', fontSize: '5px', fontWeight: 800, letterSpacing: '.06em',
                    textTransform: 'uppercase', color: tagColor, background: `${tagColor}12`, border: `1px solid ${tagColor}25` }}>
                  {fx}
                  {onRemoveEffect && (
                    <button onClick={() => onRemoveEffect(channelIdx, fx)}
                      className="cursor-pointer opacity-0 group-hover/tag:opacity-100 transition-opacity hover:text-red-400"
                      style={{ fontSize: '6px', padding: '0 1px', background: 'none', border: 'none', color: 'inherit' }}
                      title={`Remove .${fx}()`}>×</button>
                  )}
                </span>
              )
            })}
        </div>
      )}

      {/* ── Effect knobs — grouped by FX category ── */}
      {fxGroups.length > 0 && (
        <div className="px-1 py-0.5" style={{ borderTop: '1px solid rgba(255,255,255,0.03)' }}>
          {fxGroups.map((group) => (
            <div key={group.label} className="mb-0.5">
              <div className="flex items-center gap-0.5 px-0.5 py-0.5">
                <span className="text-[6px]">{group.icon}</span>
                <span className="text-[5px] font-bold uppercase tracking-[.08em]" style={{ color: group.isRelevant ? '#5a616b' : '#3a3f46' }}>{group.label}</span>
                {!group.isRelevant && <span className="text-[4px] opacity-30">⚠</span>}
                <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.03)' }} />
              </div>
              <div className="flex flex-wrap gap-px px-0.5 justify-start">
                {group.params.map((param) => {
                  const def = getParamDef(param.key)
                  if (!def) return null
                  return (
                    <StudioKnob key={param.key} label={def.label} value={getAutoKnobValue ? getAutoKnobValue(channelIdx, param.key, param.value) : param.value} min={def.min} max={def.max} step={def.step}
                      size={20} color={channel.color} unit={def.unit} isComplex={param.isComplex}
                      onChange={(v: number) => onParamChange(channelIdx, param.key, v)}
                      onRemove={onRemoveEffect ? () => onRemoveEffect(channelIdx, param.key) : undefined} />
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Sidechain section ── */}
      {sidechainInfo && (sidechainInfo.isSource || sidechainInfo.isKickLike || sidechainInfo.hasDuckParams || sidechainInfo.isDucked) && (
        <div className="px-1.5 py-0.5" style={{ borderTop: '1px solid rgba(255,255,255,0.03)' }}>
          <div className="flex items-center gap-1 py-0.5">
            <Link size={7} style={{ color: '#00e5c7', opacity: 0.5 }} />
            <span className="text-[5px] font-bold uppercase tracking-[.12em]" style={{ color: '#00e5c7', opacity: 0.5 }}>SIDECHAIN</span>
            <div className="flex-1 h-px" style={{ background: 'rgba(0,229,199,0.08)' }} />
          </div>

          {/* Enable button (kick-like channel without sidechain yet) */}
          {!sidechainInfo.isSource && !sidechainInfo.hasDuckParams && sidechainInfo.isKickLike && onEnableSidechain && (
            <button
              onClick={onEnableSidechain}
              className="w-full flex items-center justify-center gap-1 px-1.5 py-1 rounded-lg transition-all text-[6px] font-bold uppercase tracking-wider cursor-pointer"
              style={{ background: '#111318', color: '#00e5c7', boxShadow: '2px 2px 4px #050607, -2px -2px 4px #1a1d22' }}
            >
              <Link size={6} /> Enable
            </button>
          )}

          {/* Source: target list + add dropdown + duck knobs + remove */}
          {sidechainInfo.isSource && (
            <div className="space-y-1">
              {sidechainInfo.targetChannels.length > 0 ? (
                <div className="space-y-0.5">
                  {sidechainInfo.targetChannels.map((t) => (
                    <div key={t.idx} className="flex items-center gap-1 px-1 py-0.5 rounded text-[6px] bg-white/[0.02] border border-white/[0.04]">
                      <span style={{ color: t.color }} className="font-bold uppercase truncate flex-1">{t.name}</span>
                      {onRemoveSidechainTarget && (
                        <button onClick={() => onRemoveSidechainTarget(t.idx)} className="text-white/15 hover:text-red-400/60 cursor-pointer"><X size={7} /></button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-[6px] text-white/15 italic px-1">No targets</div>
              )}
              {sidechainInfo.availableTargets.length > 0 && onAddSidechainTarget && (
                <select value="" onChange={(e) => { if (e.target.value) onAddSidechainTarget(parseInt(e.target.value)) }}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full text-[6px] font-mono rounded-lg px-1 py-0.5 outline-none cursor-pointer"
                  style={{ background: '#111318', color: '#00e5c7', border: '1px solid rgba(0,229,199,0.12)' }}>
                  <option value="">+ Target…</option>
                  {sidechainInfo.availableTargets.map((t) => <option key={t.idx} value={t.idx}>{t.name}</option>)}
                </select>
              )}
              {/* Duck depth / attack knobs */}
              {channel.params.some(p => p.key === 'duckdepth' || p.key === 'duckattack') && (
                <div className="flex flex-wrap gap-0.5 justify-center pt-0.5">
                  {channel.params.filter(p => p.key === 'duckdepth' || p.key === 'duckattack').map((param) => {
                    const def = getParamDef(param.key); if (!def) return null
                    return <StudioKnob key={param.key} label={def.label} value={getAutoKnobValue ? getAutoKnobValue(channelIdx, param.key, param.value) : param.value} min={def.min} max={def.max} step={def.step}
                      size={20} color="#fb923c" unit={def.unit} isComplex={param.isComplex}
                      onChange={(v: number) => onParamChange(channelIdx, param.key, v)}
                      onRemove={onRemoveEffect ? () => onRemoveEffect(channelIdx, param.key) : undefined} />
                  })}
                </div>
              )}
              {onDisableSidechain && (
                <button onClick={onDisableSidechain}
                  className="w-full flex items-center justify-center gap-1 px-1 py-0.5 rounded-lg transition-all text-[6px] font-bold uppercase cursor-pointer"
                  style={{ background: '#111318', color: '#b86f6f', boxShadow: '2px 2px 4px #050607, -2px -2px 4px #1a1d22' }}>
                  <Unlink size={6} /> Remove
                </button>
              )}
            </div>
          )}

          {/* Non-source with duck params (target side knobs) */}
          {!sidechainInfo.isSource && sidechainInfo.hasDuckParams && (
            <div className="flex flex-wrap gap-0.5 justify-center">
              {channel.params.filter(p => p.key === 'duckdepth' || p.key === 'duckattack').map((param) => {
                const def = getParamDef(param.key); if (!def) return null
                return <StudioKnob key={param.key} label={def.label} value={getAutoKnobValue ? getAutoKnobValue(channelIdx, param.key, param.value) : param.value} min={def.min} max={def.max} step={def.step}
                  size={20} color="#fb923c" unit={def.unit} isComplex={param.isComplex}
                  onChange={(v: number) => onParamChange(channelIdx, param.key, v)}
                  onRemove={onRemoveEffect ? () => onRemoveEffect(channelIdx, param.key) : undefined} />
              })}
            </div>
          )}

          {/* Ducked-by indicator */}
          {sidechainInfo.isDucked && sidechainInfo.duckedBySource && (
            <div className="flex items-center gap-1 py-0.5">
              <span className="text-[6px]">🦆</span>
              <span className="text-[6px] font-bold uppercase" style={{ color: sidechainInfo.duckedBySource.color }}>{sidechainInfo.duckedBySource.name}</span>
              {onDisconnectSidechain && (
                <button onClick={onDisconnectSidechain} className="ml-auto text-white/15 hover:text-red-400/60 cursor-pointer"><X size={7} /></button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Overflow menu (Duplicate/Reset/Delete) ── */}
      <div className="flex items-center justify-end px-1.5 py-0.5" style={{ borderTop: '1px solid rgba(255,255,255,0.03)' }}>
        <div className="flex items-center gap-0.5">
          {effectKnobs.length > 0 && (
            <span className="text-[5px] font-bold font-mono px-0.5" style={{ color: `${channel.color}50` }}>{effectKnobs.length}fx</span>
          )}
          <div ref={moreMenuRef} className="relative">
            <button onClick={() => setShowMoreMenu(v => !v)}
              className="p-0.5 rounded transition-all cursor-pointer hover:opacity-80"
              style={{ color: '#5a616b', opacity: 0.5 }} title="More actions">
              <MoreVertical size={9} />
            </button>
            {showMoreMenu && (
              <div className="absolute bottom-full right-0 mb-1 rounded-lg overflow-hidden z-50"
                style={{ background: '#16181d', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 8px 24px rgba(0,0,0,0.6)', minWidth: '80px' }}>
                {onDuplicate && (
                  <button onClick={() => { setShowMoreMenu(false); onDuplicate(channelIdx) }}
                    className="flex items-center gap-1 w-full px-2 py-1 text-left transition-colors cursor-pointer hover:bg-white/5"
                    style={{ color: '#00e5c7', fontSize: '7px', fontWeight: 700 }}>
                    <Copy size={8} /> Duplicate
                  </button>
                )}
                {onReset && (
                  <button onClick={() => { setShowMoreMenu(false); if (confirm('Reset channel?')) onReset(channelIdx) }}
                    className="flex items-center gap-1 w-full px-2 py-1 text-left transition-colors cursor-pointer hover:bg-white/5"
                    style={{ color: '#06b6d4', fontSize: '7px', fontWeight: 700 }}>
                    <RotateCcw size={8} /> Reset
                  </button>
                )}
                {onDelete && (
                  <button onClick={() => { setShowMoreMenu(false); if (confirm('Delete this channel?')) onDelete(channelIdx) }}
                    className="flex items-center gap-1 w-full px-2 py-1 text-left transition-colors cursor-pointer hover:bg-white/5"
                    style={{ color: '#b86f6f', fontSize: '7px', fontWeight: 700 }}>
                    <Trash2 size={8} /> Delete
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  Main TrackView component
// ─────────────────────────────────────────────────────────────

interface TrackViewProps {
  channels: ParsedChannel[]
  isPlaying: boolean
  mutedChannels: Set<number>
  soloedChannels: Set<number>
  trackCollapsed: Set<number>
  dragOverChannel: number | null
  getCyclePosition?: () => number | null
  projectBpm: number
  onToggleCollapse: (idx: number) => void
  onSolo: (idx: number, exclusive: boolean) => void
  onMute: (idx: number) => void
  // ── Rack system ──
  racks: Rack[]
  onCreateRack?: (channelIndices: number[], name: string) => void
  onDissolveRack?: (rackId: string) => void
  onToggleRackCollapse?: (rackId: string) => void
  onRenameRack?: (rackId: string, name: string) => void
  onRemoveFromRack?: (rackId: string, channelIdx: number) => void
  onToggleChannel: (id: string) => void
  onParamChange: (channelIdx: number, key: string, value: number) => void
  onEffectInsert: (channelIdx: number, effectCode: string) => void
  onRemoveEffect: (channelIdx: number, effectKey: string) => void
  onOpenPianoRoll?: (idx: number) => void
  onOpenDrumSequencer?: (idx: number) => void
  onOpenPadSampler?: (idx: number) => void
  onDragOver: (idx: number) => void
  onDragLeave: () => void
  onDrop: (idx: number, e: React.DragEvent) => void
  onShowAddMenu: () => void
  getSourceIcon: (source: string, sourceType: string) => string
  // ── New: match grid ChannelStrip feature parity ──
  onSoundChange?: (idx: number, sound: string) => void
  onBankChange?: (idx: number, bank: string) => void
  onRename?: (channelIdx: number, newName: string) => void
  onDuplicate?: (channelIdx: number) => void
  onDelete?: (channelIdx: number) => void
  onReset?: (channelIdx: number) => void
  onTranspose?: (channelIdx: number, semitones: number) => void
  onAddSound?: (channelIdx: number, sound: string) => void
  onPreview?: (soundCode: string) => void
  onAutoPitchMatch?: (channelIdx: number) => void
  scaleRoot?: string | null
  stackRowsMap: Map<number, StackRow[]>
  onStackRowSoundChange?: (channelIdx: number, rowIdx: number, newSound: string) => void
  onStackRowGainChange?: (channelIdx: number, rowIdx: number, newGain: number) => void
  onStackRowBankChange?: (channelIdx: number, rowIdx: number, newBank: string) => void
  onRemoveStackRow?: (channelIdx: number, rowIdx: number) => void
  // ── Sidechain routing ──
  getSidechainInfo?: (idx: number) => SidechainInfo
  onEnableSidechain?: (sourceIdx: number) => void
  onDisableSidechain?: (sourceIdx: number) => void
  onAddSidechainTarget?: (sourceIdx: number, targetIdx: number) => void
  onRemoveSidechainTarget?: (sourceIdx: number, targetIdx: number) => void
  onDisconnectSidechain?: (targetIdx: number) => void
  // ── FX Panel communication ──
  onSelectedTrackChange?: (trackIdx: number) => void
  // ── Arrangement timeline ──
  arrangeSections?: ArrangementSection[]
  arrangeOpen?: boolean
  onArrangeToggle?: () => void
  onArrangeSectionsChange?: (sections: ArrangementSection[]) => void
  onDuplicateAutomation?: (fromSectionId: string, toSectionId: string) => void
  onSeek?: (barPosition: number) => void
  // ── Pattern variants ──
  patternVariants?: PatternVariant[]
  onPatternVariantsChange?: (variants: PatternVariant[]) => void
  onCreateVariant?: (channelIdx: number, name: string) => void
  // ── Automation recording ──
  automationData?: Map<string, number>
  isRecording?: boolean
  onRecordToggle?: () => void
  onClearAutomation?: (sectionId: string) => void
  onSetAutomation?: (sectionId: string, channelIdx: number, paramKey: string, value: number, barOffset?: number) => void
  onClearParamAutomation?: (channelIdx: number, paramKey: string) => void
  onDeleteKeyframe?: (sectionId: string, channelIdx: number, paramKey: string, barOffset?: number) => void
  // ── Audio clip tracks ──
  audioClips?: AudioClip[]
  audioTracks?: AudioTrack[]
  audioClipboard?: ClipClipboard | null
  onAudioClipsChange?: (clips: AudioClip[]) => void
  onAudioTracksChange?: (tracks: AudioTrack[]) => void
  onAudioClipboardChange?: (cb: ClipClipboard | null) => void
  onDeleteAudioClip?: (clipId: string) => void
  onAutoSyncClip?: (clipId: string) => void
  onAutoPitchClip?: (clipId: string) => void
  onCreateInstrumentFromClip?: (clipId: string) => void
  projectKey?: string
  onAddAudioTrack?: () => void
  onStartRecording?: (trackIndex: number) => void
  onStopRecording?: () => void
  onUploadAudio?: (trackIndex: number) => void
  isAudioRecording?: boolean
  recordingTrackIndex?: number
}

const TrackView = memo(function TrackView({
  channels,
  isPlaying,
  mutedChannels,
  soloedChannels,
  trackCollapsed,
  dragOverChannel,
  getCyclePosition,
  projectBpm,
  onToggleCollapse,
  onSolo,
  onMute,
  // Rack system
  racks,
  onCreateRack,
  onDissolveRack,
  onToggleRackCollapse,
  onRenameRack,
  onRemoveFromRack,
  onParamChange,
  onEffectInsert,
  onRemoveEffect,
  onOpenPianoRoll,
  onOpenDrumSequencer,
  onOpenPadSampler,
  onDragOver,
  onDragLeave,
  onDrop,
  onShowAddMenu,
  getSourceIcon,
  // New props
  onSoundChange,
  onBankChange,
  onRename,
  onDuplicate,
  onDelete,
  onReset,
  onTranspose,
  onAddSound,
  onPreview,
  onAutoPitchMatch,
  scaleRoot,
  stackRowsMap,
  onStackRowSoundChange,
  onStackRowGainChange,
  onStackRowBankChange,
  onRemoveStackRow,
  // Sidechain routing
  getSidechainInfo,
  onEnableSidechain,
  onDisableSidechain,
  onAddSidechainTarget,
  onRemoveSidechainTarget,
  onDisconnectSidechain,
  onSelectedTrackChange,
  // Arrangement
  arrangeSections,
  arrangeOpen,
  onArrangeToggle,
  onArrangeSectionsChange,
  onDuplicateAutomation,
  onSeek,
  // Pattern variants
  patternVariants,
  onPatternVariantsChange,
  onCreateVariant,
  // Automation
  automationData,
  isRecording,
  onRecordToggle,
  onClearAutomation,
  onSetAutomation,
  onClearParamAutomation,
  onDeleteKeyframe,
  // Audio clip tracks
  audioClips,
  audioTracks,
  audioClipboard,
  onAudioClipsChange,
  onAudioTracksChange,
  onAudioClipboardChange,
  onDeleteAudioClip,
  onAutoSyncClip,
  onAutoPitchClip,
  onCreateInstrumentFromClip,
  projectKey,
  onAddAudioTrack,
  onStartRecording,
  onStopRecording,
  onUploadAudio,
  isAudioRecording,
  recordingTrackIndex,
}: TrackViewProps) {
  // Selected track: always one is selected (default 0)
  const [selectedTrack, setSelectedTrack] = useState(0)
  // Per-track scope type
  const [trackScopes, setTrackScopes] = useState<Record<number, TrackScopeType>>({})
  // Per-channel automation lane visibility
  const [automationVisible, setAutomationVisible] = useState<Set<number>>(new Set())
  // Per-channel selected automation param (defaults to 'gain')
  const [autoParamPerChannel, setAutoParamPerChannel] = useState<Record<number, string>>({})
  // Inline rename state
  // Notify parent when selected track changes
  useEffect(() => {
    onSelectedTrackChange?.(selectedTrack)
  }, [selectedTrack, onSelectedTrackChange])

  const [renamingTrack, setRenamingTrack] = useState<number | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const renameInputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (channels.length > 0 && selectedTrack >= channels.length) {
      setSelectedTrack(0)
    }
  }, [channels.length, selectedTrack])

  const cycleScopeType = useCallback((idx: number) => {
    setTrackScopes(prev => {
      const current = prev[idx] || 'waveform'
      const currentIdx = TRACK_SCOPE_TYPES.findIndex(s => s.id === current)
      const nextIdx = (currentIdx + 1) % TRACK_SCOPE_TYPES.length
      return { ...prev, [idx]: TRACK_SCOPE_TYPES[nextIdx].id }
    })
  }, [])

  const selectedChannel = channels[selectedTrack]

  // ── Context menu state ──
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; channelIdx: number } | null>(null)
  const [selectedChannels, setSelectedChannels] = useState<Set<number>>(new Set())
  const [rackRenaming, setRackRenaming] = useState<string | null>(null)
  const [rackRenameValue, setRackRenameValue] = useState('')
  const rackRenameRef = useRef<HTMLInputElement>(null)
  const ctxMenuRef = useRef<HTMLDivElement>(null)

  // Close context menu on outside click
  useEffect(() => {
    if (!ctxMenu) return
    const handler = (e: MouseEvent) => {
      if (ctxMenuRef.current && ctxMenuRef.current.contains(e.target as Node)) return
      setCtxMenu(null)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [ctxMenu])

  // ── Build render items: racks (with their channels) and ungrouped channels ──
  const renderItems = useMemo(() => {
    const racked = new Set<number>()
    racks.forEach(r => r.channelIndices.forEach(i => racked.add(i)))

    const items: ({ type: 'rack'; rack: Rack } | { type: 'channel'; idx: number })[] = []
    const rackInserted = new Set<string>()

    channels.forEach((_, idx) => {
      if (racked.has(idx)) {
        // Find which rack this belongs to
        const rack = racks.find(r => r.channelIndices.includes(idx))
        if (rack && !rackInserted.has(rack.id)) {
          rackInserted.add(rack.id)
          items.push({ type: 'rack', rack })
        }
        // Individual channels inside racks are rendered by the rack item
      } else {
        items.push({ type: 'channel', idx })
      }
    })
    return items
  }, [channels, racks])

  // ── Live automation value display (knobs track interpolated values during playback) ──
  const liveAutoRef = useRef<Record<string, number>>({})
  const [liveAutoTick, setLiveAutoTick] = useState(0)
  const liveAutoTickRef = useRef(0)

  useEffect(() => {
    if (!isPlaying || !automationData || automationData.size === 0 || !arrangeSections || arrangeSections.length === 0) {
      // Clear live values when stopped
      if (Object.keys(liveAutoRef.current).length > 0) {
        liveAutoRef.current = {}
        setLiveAutoTick(t => t + 1)
      }
      return
    }

    // Build section layout once
    const secStartBar: number[] = []
    let ba = 0
    for (const s of arrangeSections) { secStartBar.push(ba); ba += s.bars }
    const totalBars = ba
    if (totalBars === 0) return

    // Group keyframes by channelIdx:paramKey for quick interpolation
    const groups = new Map<string, { bar: number; value: number }[]>()
    for (const [key, value] of automationData) {
      const parsed = parseAutoKey(key)
      if (!parsed) continue
      const secIdx = arrangeSections.findIndex(s => s.id === parsed.sectionId)
      if (secIdx === -1) continue
      const absoluteBar = secStartBar[secIdx] + Math.min(parsed.barOffset, arrangeSections[secIdx].bars - 1)
      const groupKey = `${parsed.channelIdx}:${parsed.paramKey}`
      if (!groups.has(groupKey)) groups.set(groupKey, [])
      groups.get(groupKey)!.push({ bar: absoluteBar, value })
    }
    // Sort each group
    for (const kfs of groups.values()) kfs.sort((a, b) => a.bar - b.bar)

    // Catmull-Rom helper
    const cmr = (p0: number, p1: number, p2: number, p3: number, t: number) => {
      const t2 = t * t, t3 = t2 * t
      return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
    }

    let rafId: number
    let lastUpdate = 0
    const tick = () => {
      const now = performance.now()
      // Throttle to ~12fps to avoid excessive re-renders
      if (now - lastUpdate > 83) {
        lastUpdate = now
        const pos = getCyclePosition?.()
        if (pos !== null && pos !== undefined) {
          const barPos = pos % totalBars
          const newVals: Record<string, number> = {}
          for (const [groupKey, kfs] of groups) {
            if (kfs.length === 0) continue
            let val: number
            if (kfs.length === 1) {
              val = kfs[0].value
            } else {
              let ri = kfs.findIndex(kf => kf.bar >= barPos)
              if (ri === -1) { val = kfs[kfs.length - 1].value }
              else if (ri === 0) { val = kfs[0].value }
              else {
                const left = kfs[ri - 1], right = kfs[ri]
                const p0 = ri > 1 ? kfs[ri - 2].value : left.value
                const p3 = ri < kfs.length - 1 ? kfs[ri + 1].value : right.value
                const t = (barPos - left.bar) / Math.max(0.001, right.bar - left.bar)
                val = cmr(p0, left.value, right.value, p3, t)
              }
            }
            newVals[groupKey] = val
          }
          liveAutoRef.current = newVals
          // Trigger re-render
          liveAutoTickRef.current++
          setLiveAutoTick(liveAutoTickRef.current)
        }
      }
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [isPlaying, automationData, arrangeSections, getCyclePosition])

  /** Get live automation-overridden value for a knob, or the static value if no automation */
  const getAutoKnobValue = useCallback((chIdx: number, paramKey: string, staticVal: number): number => {
    // Reference liveAutoTick to ensure React knows about the dependency
    void liveAutoTick
    const key = `${chIdx}:${paramKey}`
    return key in liveAutoRef.current ? liveAutoRef.current[key] : staticVal
  }, [liveAutoTick])

  // ── Render a single track lane (used for both racked and ungrouped channels) ──
  const renderTrackLane = (ch: ParsedChannel, idx: number) => {
    const isMuted = mutedChannels.has(idx)
    const isSoloed = soloedChannels.has(idx)
    const isActive = isPlaying && !isMuted
    const collapsed = trackCollapsed.has(idx)
    const isSelected = selectedTrack === idx
    const gainParam = ch.params.find((p: { key: string }) => p.key === 'gain')
    const scopeType = trackScopes[idx] || 'waveform'
    const isInRack = racks.some(r => r.channelIndices.includes(idx))

    // Editor type
    const isVocal = ch.sourceType === 'sample' && ch.effects.includes('loopAt')
    const isMelodic = ch.sourceType === 'synth' || ch.sourceType === 'note'
    const isDrum = (ch.sourceType === 'sample' && !ch.effects.includes('loopAt')) || ch.sourceType === 'stack'
    const primaryEditor = isVocal ? 'sampler' : isMelodic ? 'piano' : isDrum ? 'drum' : 'piano'

    return (
      <div key={ch.id}>
      <div
        className={`flex transition-all duration-200 ${isMuted ? 'opacity-35' : ''}`}
        style={{
          background: isSelected ? '#131620' : '#111318',
          borderBottom: automationVisible.has(idx) ? 'none' : '1px solid rgba(255,255,255,0.04)',
          minHeight: collapsed ? 32 : 80,
          borderLeft: isSelected ? `2px solid ${ch.color}60` : isInRack ? `2px solid ${racks.find(r => r.channelIndices.includes(idx))?.color || 'transparent'}20` : '2px solid transparent',
        }}
        onContextMenu={(e) => {
          e.preventDefault()
          // Ctrl+right-click: add to selection
          if (e.ctrlKey || e.metaKey) {
            setSelectedChannels(prev => { const n = new Set(prev); n.add(idx); return n })
          } else if (!selectedChannels.has(idx)) {
            // Plain right-click on unselected channel: select only it
            setSelectedChannels(new Set([idx]))
          }
          // If channel is already selected, preserve current multi-selection
          setCtxMenu({ x: e.clientX, y: e.clientY, channelIdx: idx })
        }}
      >
        {/* ── LEFT PANEL ── */}
        <div
          className="shrink-0 flex flex-col border-r relative overflow-hidden cursor-pointer"
          style={{ width: 158, borderColor: `${ch.color}18`, background: isSelected ? '#0e1016' : '#0d0e11' }}
          onClick={(e) => {
            if (e.ctrlKey || e.metaKey) {
              setSelectedChannels(prev => { const n = new Set(prev); n.has(idx) ? n.delete(idx) : n.add(idx); return n })
            } else {
              setSelectedTrack(idx)
            }
          }}
        >
          {/* Color accent */}
          <div className="absolute top-0 left-0 right-0"
            style={{
              height: 2,
              background: `linear-gradient(90deg, ${ch.color} 0%, ${ch.color}40 100%)`,
              opacity: isMuted ? 0.15 : isActive ? 1 : 0.5,
              boxShadow: isActive ? `0 0 8px ${ch.color}50` : 'none',
            }} />

          {/* Controls row */}
          <div className="flex items-center gap-1 px-2 pt-2 pb-0.5">
            <button onClick={(e) => { e.stopPropagation(); onToggleCollapse(idx) }}
              className="cursor-pointer" style={{ color: '#5a616b', background: 'none', border: 'none', padding: 0 }}>
              {collapsed ? <ChevronRight size={10} /> : <ChevronDown size={10} />}
            </button>

            <button onClick={(e) => { e.stopPropagation(); onSolo(idx, !e.ctrlKey && !e.shiftKey) }}
              className="cursor-pointer transition-all duration-100 active:scale-90"
              style={{
                width: 16, height: 16, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '7px', fontWeight: 900, lineHeight: 1,
                color: isSoloed ? '#06b6d4' : '#5a616b', background: isSoloed ? '#1a1a16' : '#0a0b0d', border: 'none',
                boxShadow: isSoloed ? `inset 2px 2px 4px #050607, inset -2px -2px 4px #1a1d22, 0 0 4px #06b6d430` : '2px 2px 4px #050607, -2px -2px 4px #1a1d22',
              }}
              title="Solo (Ctrl+click for multi)">S</button>

            <button onClick={(e) => { e.stopPropagation(); onMute(idx) }}
              className="cursor-pointer transition-all duration-100 active:scale-90"
              style={{
                width: 16, height: 16, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '7px', fontWeight: 900, lineHeight: 1,
                color: isMuted ? '#b86f6f' : '#5a616b', background: isMuted ? '#1a1114' : '#0a0b0d', border: 'none',
                boxShadow: isMuted ? `inset 2px 2px 4px #050607, inset -2px -2px 4px #1a1d22, 0 0 4px #b86f6f30` : '2px 2px 4px #050607, -2px -2px 4px #1a1d22',
              }}>M</button>

            {/* Automation toggle */}
            {arrangeSections && arrangeSections.length > 0 && (
              <button onClick={(e) => {
                e.stopPropagation()
                setAutomationVisible(prev => {
                  const next = new Set(prev)
                  next.has(idx) ? next.delete(idx) : next.add(idx)
                  return next
                })
              }}
                className="cursor-pointer transition-all duration-100 active:scale-90"
                style={{
                  width: 16, height: 16, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '7px', fontWeight: 900, lineHeight: 1,
                  color: automationVisible.has(idx) ? '#22d3ee' : '#5a616b',
                  background: automationVisible.has(idx) ? '#0d1a1e' : '#0a0b0d',
                  border: 'none',
                  boxShadow: automationVisible.has(idx) ? `inset 2px 2px 4px #050607, inset -2px -2px 4px #1a1d22, 0 0 4px #22d3ee30` : '2px 2px 4px #050607, -2px -2px 4px #1a1d22',
                }}
                title="Toggle automation lane">A</button>
            )}

            {/* Peak meter — only expanded */}
            {!collapsed && <PeakMeter channel={ch} isPlaying={isPlaying} isMuted={isMuted} />}

            {/* Track name — inline rename on pencil click */}
            {renamingTrack === idx ? (
              <input
                ref={renameInputRef}
                autoFocus
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value.replace(/[^\w]/g, '').toLowerCase().slice(0, 12))}
                onBlur={() => {
                  if (renameValue.trim() && renameValue !== ch.name && onRename) {
                    onRename(idx, renameValue)
                  }
                  setRenamingTrack(null)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.currentTarget.blur()
                  else if (e.key === 'Escape') { setRenameValue(ch.name); setRenamingTrack(null) }
                }}
                onClick={(e) => e.stopPropagation()}
                className="flex-1 min-w-0 text-[8px] font-extrabold uppercase tracking-[.1em] outline-none font-mono"
                style={{
                  color: `${ch.color}cc`, background: 'rgba(255,255,255,0.06)',
                  border: `1px solid ${ch.color}40`, borderRadius: 3, padding: '1px 4px',
                  caretColor: ch.color, maxWidth: '70px',
                }}
                maxLength={12} spellCheck={false}
              />
            ) : (
              <span className="flex-1 min-w-0 truncate text-[8px] font-extrabold uppercase tracking-[.12em] font-mono"
                style={{ color: ch.color }} title={`${ch.name} · Double-click to rename`}
                onDoubleClick={(e) => {
                  e.stopPropagation()
                  if (onRename) { setRenameValue(ch.name); setRenamingTrack(idx) }
                }}>
                <span className="text-[9px] mr-0.5 opacity-60">{getSourceIcon(ch.source, ch.sourceType)}</span>
                {ch.name}
              </span>
            )}

            {/* Pencil rename button — only expanded */}
            {!collapsed && onRename && renamingTrack !== idx && (
              <button onClick={(e) => { e.stopPropagation(); setRenameValue(ch.name); setRenamingTrack(idx) }}
                className="cursor-pointer opacity-30 hover:opacity-70 transition-opacity"
                style={{ background: 'none', border: 'none', padding: 0, color: ch.color }}
                title="Rename track">
                <Pencil size={8} />
              </button>
            )}

            {/* Selected indicator for multi-select */}
            {selectedChannels.has(idx) && (
              <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#00e5c7', boxShadow: '0 0 4px #00e5c780' }} />
            )}
          </div>

          {/* Expanded: gain knob + editor + full expansion panel */}
          {!collapsed && (
            <div className="flex flex-col gap-0.5 px-2 pb-1">
              <div className="flex items-center gap-1">
                <div onClick={(e) => e.stopPropagation()} className="shrink-0">
                  <StudioKnob label="" value={getAutoKnobValue(idx, 'gain', gainParam?.value ?? 0.8)} min={0} max={2} step={0.01} size={22}
                    color={ch.color} isComplex={gainParam?.isComplex} onChange={(v: number) => onParamChange(idx, 'gain', v)} />
                </div>
                {primaryEditor === 'piano' && onOpenPianoRoll && (
                  <button onClick={(e) => { e.stopPropagation(); onOpenPianoRoll(idx) }}
                    className="flex items-center gap-0.5 px-1.5 py-1 rounded cursor-pointer transition-all hover:opacity-100 active:scale-95"
                    style={{ color: '#6f8fb3', opacity: 0.8, background: 'rgba(111,143,179,0.08)', border: '1px solid rgba(111,143,179,0.12)', fontSize: 0 }}>
                    <Piano size={10} /><span className="text-[6px] font-bold leading-none">NOTES</span>
                  </button>
                )}
                {primaryEditor === 'drum' && onOpenDrumSequencer && (
                  <button onClick={(e) => { e.stopPropagation(); onOpenDrumSequencer(idx) }}
                    className="flex items-center gap-0.5 px-1.5 py-1 rounded cursor-pointer transition-all hover:opacity-100 active:scale-95"
                    style={{ color: '#06b6d4', opacity: 0.8, background: 'rgba(6,182,212,0.08)', border: '1px solid rgba(6,182,212,0.12)', fontSize: 0 }}>
                    <Grid3X3 size={10} /><span className="text-[6px] font-bold leading-none">STEPS</span>
                  </button>
                )}
                {primaryEditor === 'sampler' && onOpenPadSampler && (
                  <button onClick={(e) => { e.stopPropagation(); onOpenPadSampler(idx) }}
                    className="flex items-center gap-0.5 px-1.5 py-1 rounded cursor-pointer transition-all hover:opacity-100 active:scale-95"
                    style={{ color: '#22d3ee', opacity: 0.8, background: 'rgba(34,211,238,0.08)', border: '1px solid rgba(34,211,238,0.12)', fontSize: 0 }}>
                    <span className="text-[9px]">🎹</span><span className="text-[6px] font-bold leading-none">PAD</span>
                  </button>
                )}
              </div>
              {/* Full expansion panel — sound/bank, effect tags, grouped FX knobs, stack rows, actions */}
              <TrackExpansionPanel
                channel={ch}
                channelIdx={idx}
                onParamChange={onParamChange}
                onRemoveEffect={onRemoveEffect}
                onSoundChange={onSoundChange}
                onBankChange={onBankChange}
                onRename={onRename}
                onDuplicate={onDuplicate}
                onDelete={onDelete}
                onReset={onReset}
                onTranspose={onTranspose}
                onAddSound={onAddSound}
                onPreview={onPreview}
                onStackRowSoundChange={onStackRowSoundChange}
                onStackRowGainChange={onStackRowGainChange}
                onStackRowBankChange={onStackRowBankChange}
                onRemoveStackRow={onRemoveStackRow}
                stackRows={stackRowsMap.get(idx) || []}
                scaleRoot={scaleRoot}
                onAutoPitchMatch={onAutoPitchMatch}
                sidechainInfo={getSidechainInfo ? getSidechainInfo(idx) : undefined}
                onEnableSidechain={onEnableSidechain ? () => onEnableSidechain(idx) : undefined}
                onDisableSidechain={onDisableSidechain ? () => onDisableSidechain(idx) : undefined}
                onAddSidechainTarget={onAddSidechainTarget ? (targetIdx: number) => onAddSidechainTarget(idx, targetIdx) : undefined}
                onRemoveSidechainTarget={onRemoveSidechainTarget ? (targetIdx: number) => onRemoveSidechainTarget(idx, targetIdx) : undefined}
                onDisconnectSidechain={onDisconnectSidechain ? () => onDisconnectSidechain(idx) : undefined}
                getAutoKnobValue={getAutoKnobValue}
              />
            </div>
          )}
        </div>

        {/* ── RIGHT SCOPE ── */}
        <div
          className="flex-1 min-w-0 relative overflow-hidden cursor-pointer"
          style={{
            background: '#0a0b0d',
            borderLeft: isActive ? `1px solid ${ch.color}35` : '1px solid rgba(255,255,255,0.02)',
          }}
          onClick={() => cycleScopeType(idx)}
          onDragOver={(e) => { e.preventDefault(); onDragOver(idx) }}
          onDragLeave={onDragLeave}
          onDrop={(e) => onDrop(idx, e)}
          title="Click to change visualizer"
        >
          {/* Scope or Timeline */}
          {scopeType === 'timeline' ? (
            <div className="absolute inset-0 z-[2]">
              <TrackTimeline
                channelIdx={idx}
                channelColor={ch.color}
                sections={arrangeSections || []}
                automationData={automationData}
                autoParam={autoParamPerChannel[idx] || 'gain'}
                isPlaying={isPlaying}
                isMuted={isMuted}
                getCyclePosition={getCyclePosition}
                collapsed={collapsed}
              />
            </div>
          ) : (
            <>
              <BeatGrid />
              <div className="absolute inset-0 z-[2]">
                <TrackScope
                  channel={ch} isPlaying={isPlaying} isMuted={isMuted}
                  scopeType={scopeType} collapsed={collapsed} isSelected={isSelected}
                />
              </div>
              {/* Active glow */}
              {isActive && (
                <div className="absolute inset-0 pointer-events-none z-[3]"
                  style={{
                    background: `linear-gradient(90deg, ${ch.color}06 0%, transparent 15%, transparent 85%, ${ch.color}04 100%)`,
                    borderTop: `1px solid ${ch.color}08`, borderBottom: `1px solid ${ch.color}08`,
                  }} />
              )}
            </>
          )}

          {/* Scope type label */}
          <div className="absolute top-1 right-2 z-[5]">
            <span className="text-[6px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full opacity-30 hover:opacity-80 transition-opacity"
              style={{ color: `${ch.color}`, background: 'rgba(10,11,13,0.8)', border: `1px solid ${ch.color}20` }}>
              {TRACK_SCOPE_TYPES.find(s => s.id === scopeType)?.label || 'WAVE'}
            </span>
          </div>

          {/* Channel type badge */}
          <div className="absolute bottom-1 right-2 z-[5] text-[5px] font-bold uppercase tracking-widest font-mono"
            style={{ color: `${ch.color}25` }}>
            {ch.sourceType === 'synth' ? 'SYNTH' :
             ch.sourceType === 'note' ? 'INST' :
             ch.sourceType === 'stack' ? 'DRUM' :
             ch.sourceType === 'sample' ? (ch.effects.includes('loopAt') ? 'VOCAL' : 'SAMPLE') : 'CH'}
          </div>

          {/* Selected indicator */}
          {isSelected && (
            <div className="absolute top-0 bottom-0 left-0 w-0.5 z-[6]"
              style={{ background: ch.color, boxShadow: `0 0 6px ${ch.color}40` }} />
          )}

          {/* Drop FX indicator */}
          {dragOverChannel === idx && (
            <div className="absolute inset-0 flex items-center justify-center z-10"
              style={{ background: 'rgba(0,229,199,0.1)', border: '2px solid rgba(0,229,199,0.4)', borderRadius: 4 }}>
              <span className="text-[10px] font-bold" style={{ color: '#00e5c7' }}>⬇ DROP FX</span>
            </div>
          )}
        </div>
      </div>

      {/* ═══ AUTOMATION LANE — per-channel, toggled by A button ═══ */}
      {automationVisible.has(idx) && arrangeSections && arrangeSections.length > 0 && automationData && onSetAutomation && onClearParamAutomation && (() => {
        const selectedParam = autoParamPerChannel[idx] || 'gain'
        const pdef = getParamDef(selectedParam)
        const currentParamObj = ch.params.find((p: { key: string }) => p.key === selectedParam)
        const currentVal = currentParamObj?.value ?? (pdef?.min ?? 0)
        // Automatable params: only show params that exist on this channel OR common ones
        const COMMON_AUTO_PARAMS = ['gain', 'lpf', 'hpf', 'room', 'delay', 'pan', 'shape', 'distort', 'crush']
        const channelParamKeys = new Set(ch.params.map((p: { key: string }) => p.key))
        const autoParams = COMMON_AUTO_PARAMS.filter(k => channelParamKeys.has(k) || k === 'gain')

        return (
          <div style={{
            background: '#08090c',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            borderLeft: `2px solid ${ch.color}30`,
          }}>
            {/* Param selector row */}
            <div className="flex items-center gap-1 px-1" style={{ height: 18, background: '#0a0b0d', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <span className="text-[6px] font-black uppercase tracking-widest shrink-0 pl-1" style={{ color: '#5a616b', width: 52 }}>AUTO</span>
              {autoParams.map(pk => {
                const pd = getParamDef(pk)
                return (
                  <button
                    key={pk}
                    onClick={(e) => { e.stopPropagation(); setAutoParamPerChannel(prev => ({ ...prev, [idx]: pk })) }}
                    className="px-1.5 py-0.5 rounded cursor-pointer transition-all text-[6px] font-bold uppercase tracking-wider"
                    style={{
                      color: selectedParam === pk ? ch.color : '#5a616b',
                      background: selectedParam === pk ? `${ch.color}15` : 'transparent',
                      border: selectedParam === pk ? `1px solid ${ch.color}30` : '1px solid transparent',
                    }}
                  >
                    {pd?.label || pk}
                  </button>
                )
              })}
              {/* Recording indicator */}
              {isRecording && (
                <div className="flex items-center gap-1 ml-auto pr-1">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#ef4444', boxShadow: '0 0 4px #ef444480' }}>
                    <style>{`@keyframes recpulse { 0%,100% { opacity: 0.4 } 50% { opacity: 1 } }`}</style>
                    <div style={{ animation: 'recpulse 1s infinite', width: '100%', height: '100%', borderRadius: '50%', background: '#ef4444' }} />
                  </div>
                  <span className="text-[5px] font-bold uppercase" style={{ color: '#ef4444' }}>REC</span>
                </div>
              )}
            </div>
            {/* Automation curve */}
            <AutomationLane
              channelIdx={idx}
              channelColor={ch.color}
              paramKey={selectedParam}
              paramLabel={pdef?.label || selectedParam}
              paramMin={pdef?.min ?? 0}
              paramMax={pdef?.max ?? 1}
              currentValue={getAutoKnobValue(idx, selectedParam, currentVal)}
              sections={arrangeSections}
              automationData={automationData}
              isRecording={isRecording ?? false}
              isPlaying={isPlaying}
              getCyclePosition={getCyclePosition}
              onSetAutomation={onSetAutomation}
              onClearParamAutomation={onClearParamAutomation}
              onDeleteKeyframe={onDeleteKeyframe}
            />
          </div>
        )
      })()}
    </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* ── Tracks area (scrollable) ── */}
      <div className="flex-1 flex flex-col overflow-auto relative">
        {/* Beat ruler */}
        <div className="h-5 flex items-end relative shrink-0 sticky top-0 z-30"
          style={{ background: '#0d0e11', borderBottom: '1px solid rgba(255,255,255,0.05)', marginLeft: 160 }}>
          {[1, 2, 3, 4].map((beat) => (
            <div key={beat} className="flex-1 text-center"
              style={{ borderLeft: beat > 1 ? '1px solid rgba(255,255,255,0.04)' : undefined }}>
              <span className="text-[7px] font-mono font-bold" style={{ color: '#5a616b60' }}>{beat}</span>
            </div>
          ))}
        </div>

        {/* Tracks container */}
        <div className="relative">
          {/* Playhead */}
          <div className="absolute top-0 bottom-0 right-0 z-20 pointer-events-none" style={{ left: 160 }}>
            <PlayheadOverlay getCyclePosition={getCyclePosition} isPlaying={isPlaying} trackCount={channels.length} />
          </div>

          {/* Track lanes — rack-aware rendering */}
          {renderItems.map((item) => {
            if (item.type === 'rack') {
              const rack = item.rack
              const rackChannels = rack.channelIndices.filter(i => i < channels.length)
              const allMuted = rackChannels.every(i => mutedChannels.has(i))
              const anySoloed = rackChannels.some(i => soloedChannels.has(i))

              return (
                <div key={rack.id}>
                  {/* ── Rack Header Node ── */}
                  <div
                    className="flex transition-all duration-200"
                    style={{
                      background: `linear-gradient(180deg, ${rack.color}08 0%, #0e1016 100%)`,
                      borderBottom: `1px solid ${rack.color}20`,
                      borderLeft: `3px solid ${rack.color}`,
                      minHeight: rack.collapsed ? 38 : 32,
                      boxShadow: rack.collapsed ? `inset 0 0 12px ${rack.color}06, 0 2px 8px rgba(0,0,0,0.3)` : `0 1px 4px rgba(0,0,0,0.2)`,
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault()
                      setSelectedChannels(new Set(rackChannels))
                      setCtxMenu({ x: e.clientX, y: e.clientY, channelIdx: rackChannels[0] })
                    }}
                  >
                    {/* Rack left panel */}
                    <div className="shrink-0 flex flex-col justify-center border-r relative overflow-hidden" style={{ width: 158, borderColor: `${rack.color}20`, background: '#0c0d10' }}>
                      {/* Color accent bar */}
                      <div className="absolute top-0 left-0 right-0" style={{
                        height: 2,
                        background: `linear-gradient(90deg, ${rack.color} 0%, ${rack.color}60 100%)`,
                        boxShadow: `0 0 6px ${rack.color}40`,
                      }} />

                      {/* Controls row */}
                      <div className="flex items-center gap-1 px-2 py-1">
                        {/* Collapse toggle */}
                        <button
                          onClick={() => onToggleRackCollapse?.(rack.id)}
                          className="cursor-pointer"
                          style={{ color: rack.color, background: 'none', border: 'none', padding: 0 }}
                        >
                          {rack.collapsed ? <ChevronRight size={11} /> : <ChevronDown size={11} />}
                        </button>

                        {/* Rack Solo — solos all channels in rack */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            for (const i of rackChannels) onSolo(i, false)
                          }}
                          className="cursor-pointer transition-all duration-100 active:scale-90"
                          style={{
                            width: 16, height: 16, borderRadius: 4,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '7px', fontWeight: 900, lineHeight: 1,
                            color: anySoloed ? '#06b6d4' : '#5a616b',
                            background: anySoloed ? '#1a1a16' : '#0a0b0d',
                            border: 'none',
                            boxShadow: anySoloed
                              ? `inset 2px 2px 4px #050607, inset -2px -2px 4px #1a1d22, 0 0 4px #06b6d430`
                              : '2px 2px 4px #050607, -2px -2px 4px #1a1d22',
                          }}
                          title="Solo all in rack"
                        >S</button>

                        {/* Rack Mute — mutes/unmutes all channels in rack */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            const shouldMute = !allMuted
                            for (const i of rackChannels) {
                              if (shouldMute && !mutedChannels.has(i)) onMute(i)
                              if (!shouldMute && mutedChannels.has(i)) onMute(i)
                            }
                          }}
                          className="cursor-pointer transition-all duration-100 active:scale-90"
                          style={{
                            width: 16, height: 16, borderRadius: 4,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '7px', fontWeight: 900, lineHeight: 1,
                            color: allMuted ? '#b86f6f' : '#5a616b',
                            background: allMuted ? '#1a1114' : '#0a0b0d',
                            border: 'none',
                            boxShadow: allMuted
                              ? `inset 2px 2px 4px #050607, inset -2px -2px 4px #1a1d22, 0 0 4px #b86f6f30`
                              : '2px 2px 4px #050607, -2px -2px 4px #1a1d22',
                          }}
                          title="Mute all in rack"
                        >M</button>

                        {/* Rack icon */}
                        <Layers size={11} style={{ color: rack.color, opacity: 0.8, filter: `drop-shadow(0 0 3px ${rack.color}40)` }} />

                        {/* Rack name — editable */}
                        {rackRenaming === rack.id ? (
                          <input
                            ref={rackRenameRef}
                            autoFocus
                            value={rackRenameValue}
                            onChange={(e) => setRackRenameValue(e.target.value.slice(0, 16))}
                            onBlur={() => {
                              if (rackRenameValue.trim() && rackRenameValue !== rack.name) {
                                onRenameRack?.(rack.id, rackRenameValue.trim())
                              }
                              setRackRenaming(null)
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') e.currentTarget.blur()
                              if (e.key === 'Escape') { setRackRenameValue(rack.name); setRackRenaming(null) }
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="flex-1 min-w-0 text-[8px] font-extrabold uppercase tracking-[.1em] outline-none font-mono"
                            style={{
                              color: rack.color, background: 'rgba(255,255,255,0.06)',
                              border: `1px solid ${rack.color}40`, borderRadius: 3, padding: '1px 4px',
                              caretColor: rack.color, maxWidth: '60px',
                            }}
                            maxLength={16} spellCheck={false}
                          />
                        ) : (
                          <span
                            className="text-[8px] font-extrabold uppercase tracking-[.12em] font-mono truncate cursor-pointer"
                            style={{ color: rack.color }}
                            onDoubleClick={(e) => {
                              e.stopPropagation()
                              setRackRenameValue(rack.name)
                              setRackRenaming(rack.id)
                            }}
                            title="Double-click to rename rack"
                          >
                            {rack.name}
                          </span>
                        )}
                      </div>

                      {/* Mini channel icons row — always visible for quick mute toggles */}
                      <div className="flex items-center gap-1 px-2 pb-1">
                        {rackChannels.map(chIdx => {
                          const ch = channels[chIdx]
                          if (!ch) return null
                          const chMuted = mutedChannels.has(chIdx)
                          return (
                            <button
                              key={chIdx}
                              onClick={(e) => { e.stopPropagation(); onMute(chIdx) }}
                              className="cursor-pointer transition-all duration-100 active:scale-90"
                              style={{
                                width: 18, height: 18, borderRadius: 4,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '9px', lineHeight: 1,
                                background: chMuted ? '#0a0b0d' : `${ch.color}12`,
                                border: `1px solid ${chMuted ? 'rgba(255,255,255,0.04)' : ch.color + '35'}`,
                                opacity: chMuted ? 0.3 : 1,
                                boxShadow: chMuted
                                  ? 'inset 1px 1px 2px #050607'
                                  : `1px 1px 3px #050607, -1px -1px 3px #1a1d22, 0 0 4px ${ch.color}10`,
                              }}
                              title={`${ch.name} — click to ${chMuted ? 'unmute' : 'mute'}`}
                            >
                              <span style={{ color: ch.color, filter: chMuted ? 'grayscale(1) brightness(0.5)' : `drop-shadow(0 0 2px ${ch.color}40)` }}>
                                {getSourceIcon(ch.source, ch.sourceType)}
                              </span>
                            </button>
                          )
                        })}
                        {/* Channel count badge */}
                        <span className="text-[6px] font-bold ml-auto font-mono" style={{ color: `${rack.color}50` }}>
                          {rackChannels.length}CH
                        </span>
                      </div>
                    </div>

                    {/* Rack right area — combined mini scopes */}
                    <div className="flex-1 min-w-0 relative overflow-hidden" style={{ background: '#0a0b0d' }}>
                      <BeatGrid />
                      {/* Stacked color bars representing each channel */}
                      <div className="absolute inset-0 flex flex-col justify-center z-[2] px-3 gap-px">
                        {rackChannels.map(chIdx => {
                          const ch = channels[chIdx]
                          if (!ch) return null
                          const chMuted = mutedChannels.has(chIdx)
                          return (
                            <div key={chIdx} className="flex items-center gap-1.5" style={{ opacity: chMuted ? 0.1 : 0.7 }}>
                              <span className="text-[6px] font-bold font-mono w-8 truncate" style={{ color: `${ch.color}80` }}>{ch.name}</span>
                              <div className="h-[3px] rounded-full flex-1" style={{
                                background: `linear-gradient(90deg, ${ch.color}60 0%, ${ch.color}15 80%, transparent 100%)`,
                                boxShadow: chMuted ? 'none' : `0 0 4px ${ch.color}20`,
                              }} />
                            </div>
                          )
                        })}
                      </div>
                      {/* Rack badge */}
                      <div className="absolute bottom-1 right-2 z-[5] text-[5px] font-bold uppercase tracking-widest font-mono"
                        style={{ color: `${rack.color}35` }}>
                        RACK
                      </div>
                      {/* Rack expand hint when collapsed */}
                      {rack.collapsed && (
                        <div className="absolute top-1 right-2 z-[5]">
                          <span className="text-[5px] font-bold uppercase tracking-widest font-mono px-1 py-0.5 rounded"
                            style={{ color: `${rack.color}50`, background: `${rack.color}08`, border: `1px solid ${rack.color}15` }}>
                            ▶ EXPAND
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ── Expanded: show individual tracks inside rack ── */}
                  {!rack.collapsed && rackChannels.map(idx => {
                    const ch = channels[idx]
                    if (!ch) return null
                    return renderTrackLane(ch, idx)
                  })}
                </div>
              )
            }

            // ── Regular (ungrouped) channel ──
            return renderTrackLane(channels[item.idx], item.idx)
          })}

          {/* Context Menu (right-click) */}
          {ctxMenu && (
            <div
              ref={ctxMenuRef}
              className="fixed z-[100] py-1 rounded-lg overflow-hidden"
              style={{
                left: ctxMenu.x, top: ctxMenu.y,
                background: '#16181d',
                border: '1px solid rgba(255,255,255,0.08)',
                boxShadow: '0 8px 24px rgba(0,0,0,0.6), 4px 4px 8px #050607',
                minWidth: '160px',
              }}
            >
              {/* Create Rack — when 2+ channels selected and not already in a rack */}
              {selectedChannels.size >= 2 && !racks.some(r => Array.from(selectedChannels).every(i => r.channelIndices.includes(i))) && onCreateRack && (
                <button
                  className="w-full text-left px-3 py-1.5 text-[9px] font-bold cursor-pointer hover:bg-white/[0.06] transition-colors flex items-center gap-2"
                  style={{ color: '#00e5c7', border: 'none', background: 'none' }}
                  onClick={() => {
                    const sorted = Array.from(selectedChannels).sort((a, b) => a - b)
                    onCreateRack(sorted, `Rack ${racks.length + 1}`)
                    setSelectedChannels(new Set())
                    setCtxMenu(null)
                  }}
                >
                  <Layers size={10} /> Create Rack ({selectedChannels.size})
                </button>
              )}

              {/* Dissolve Rack */}
              {racks.some(r => r.channelIndices.includes(ctxMenu.channelIdx)) && onDissolveRack && (
                <button
                  className="w-full text-left px-3 py-1.5 text-[9px] font-bold cursor-pointer hover:bg-white/[0.06] transition-colors flex items-center gap-2"
                  style={{ color: '#06b6d4', border: 'none', background: 'none' }}
                  onClick={() => {
                    const rack = racks.find(r => r.channelIndices.includes(ctxMenu.channelIdx))
                    if (rack) onDissolveRack(rack.id)
                    setSelectedChannels(new Set())
                    setCtxMenu(null)
                  }}
                >
                  <X size={10} /> Dissolve Rack
                </button>
              )}

              {/* Solo all in selection (Ctrl+right-click behavior) */}
              {selectedChannels.size >= 2 && (
                <button
                  className="w-full text-left px-3 py-1.5 text-[9px] font-bold cursor-pointer hover:bg-white/[0.06] transition-colors flex items-center gap-2"
                  style={{ color: '#06b6d4', border: 'none', background: 'none' }}
                  onClick={() => {
                    for (const idx of selectedChannels) {
                      onSolo(idx, false) // additive solo
                    }
                    setCtxMenu(null)
                  }}
                >
                  <Volume2 size={10} /> Solo Selection ({selectedChannels.size})
                </button>
              )}

              {/* Mute all in selection */}
              {selectedChannels.size >= 2 && (
                <button
                  className="w-full text-left px-3 py-1.5 text-[9px] font-bold cursor-pointer hover:bg-white/[0.06] transition-colors flex items-center gap-2"
                  style={{ color: '#b86f6f', border: 'none', background: 'none' }}
                  onClick={() => {
                    for (const idx of selectedChannels) {
                      if (!mutedChannels.has(idx)) onMute(idx)
                    }
                    setCtxMenu(null)
                  }}
                >
                  <VolumeX size={10} /> Mute Selection ({selectedChannels.size})
                </button>
              )}

              {/* Duplicate */}
              {onDuplicate && selectedChannels.size <= 1 && (
                <button
                  className="w-full text-left px-3 py-1.5 text-[9px] font-bold cursor-pointer hover:bg-white/[0.06] transition-colors flex items-center gap-2"
                  style={{ color: '#6f8fb3', border: 'none', background: 'none' }}
                  onClick={() => { onDuplicate(ctxMenu.channelIdx); setCtxMenu(null) }}
                >
                  <Copy size={10} /> Duplicate
                </button>
              )}

              {/* Delete */}
              {onDelete && (
                <>
                  <div className="mx-2 my-0.5" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }} />
                  <button
                    className="w-full text-left px-3 py-1.5 text-[9px] font-bold cursor-pointer hover:bg-white/[0.06] transition-colors flex items-center gap-2"
                    style={{ color: '#b86f6f', border: 'none', background: 'none' }}
                    onClick={() => { onDelete(ctxMenu.channelIdx); setCtxMenu(null) }}
                  >
                    <Trash2 size={10} /> Delete
                  </button>
                </>
              )}
            </div>
          )}

          {/* Add Track button */}
          <button onClick={onShowAddMenu}
            className="flex items-center justify-center gap-2 py-3 w-full cursor-pointer transition-all duration-200 hover:bg-white/[0.02] group"
            style={{ background: '#0d0e11', color: '#5a616b', border: 'none' }}>
            <div className="w-5 h-5 rounded-full flex items-center justify-center transition-all group-hover:scale-110"
              style={{ background: '#111318', boxShadow: '2px 2px 4px #050607, -2px -2px 4px #1a1d22' }}>
              <Plus size={11} style={{ color: '#00e5c7' }} />
            </div>
            <span className="text-[9px] font-bold tracking-wide group-hover:text-white/50 transition-colors">Add Track</span>
          </button>
        </div>
      </div>

      {/* ═══ ARRANGEMENT TIMELINE — section sequencer ═══ */}
      {onArrangeSectionsChange && onArrangeToggle && (
        <ArrangementTimeline
          channels={channels}
          sections={arrangeSections ?? []}
          isOpen={arrangeOpen ?? false}
          isPlaying={isPlaying}
          getCyclePosition={getCyclePosition}
          automationData={automationData}
          onToggle={onArrangeToggle}
          onSectionsChange={onArrangeSectionsChange}
          onDuplicateAutomation={onDuplicateAutomation}
          onSeek={onSeek}
          patternVariants={patternVariants}
          onPatternVariantsChange={onPatternVariantsChange}
          onCreateVariant={onCreateVariant}
          audioClips={audioClips}
          audioTracks={audioTracks}
          audioClipboard={audioClipboard}
          bpm={projectBpm}
          onAudioClipsChange={onAudioClipsChange}
          onAudioTracksChange={onAudioTracksChange}
          onAudioClipboardChange={onAudioClipboardChange}
          onDeleteAudioClip={onDeleteAudioClip}
          onAutoSyncClip={onAutoSyncClip}
          onAutoPitchClip={onAutoPitchClip}
          onCreateInstrumentFromClip={onCreateInstrumentFromClip}
          projectKey={projectKey}
          onAddAudioTrack={onAddAudioTrack}
          onStartRecording={onStartRecording}
          onStopRecording={onStopRecording}
          onUploadAudio={onUploadAudio}
          isRecording={isAudioRecording}
          recordingTrackIndex={recordingTrackIndex}
        />
      )}

    </div>
  )
})

export default TrackView
