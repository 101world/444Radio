'use client'

// ═══════════════════════════════════════════════════════════════
//  STUDIO EFFECTS PANEL v2 — Full Channel Inspector + FX Rack
//
//  Matrix-style header with dark teal accents, cassette-tape texture.
//  Shows: channel name, source/bank, volume, center-based pan knob,
//  piano roll / drum seq buttons, sidechain routing, ALL FX groups.
// ═══════════════════════════════════════════════════════════════

import { useRef, useEffect, useCallback, useState, useMemo } from 'react'
import { Piano, Grid3X3, Mic, Link, Unlink, X, Volume2, Scissors } from 'lucide-react'
import HardwareKnob from './HardwareKnob'
import StudioKnob from './StudioKnob'
import FxLcdMonitor from './FxLcdMonitor'
import { PARAM_DEFS, getParamDef, getTranspose, type ParsedChannel, type ParamDef, type StackRow } from '@/lib/strudel-code-parser'

// ─── FX groups definition ───
export const FX_GROUPS: { label: string; icon: string; keys: string[] }[] = [
  { label: 'FILTER', icon: '🔽', keys: ['lpf', 'lp', 'hpf', 'hp', 'lpq', 'hpq', 'lpenv', 'hpenv', 'bpenv', 'lpattack', 'lpa', 'lprelease', 'lpr', 'lps', 'lpd', 'bpf', 'bpq', 'ftype', 'vowel'] },
  { label: 'DRIVE',  icon: '🔥', keys: ['shape', 'distort', 'crush', 'coarse', 'compressor'] },
  { label: 'SPACE',  icon: '🌌', keys: ['room', 'roomsize', 'roomfade', 'roomlp', 'roomdim', 'delay', 'delayfeedback', 'delaytime', 'dry', 'echo'] },
  { label: 'MOD',    icon: '🎵', keys: ['detune', 'pan', 'velocity', 'postgain', 'vib', 'vibmod', 'phaser', 'phaserdepth', 'phasercenter', 'phasersweep', 'tremolosync', 'tremolodepth', 'tremoloskew', 'tremolophase', 'tremoloshape', 'fast', 'slow'] },
  { label: 'FM',     icon: '📻', keys: ['fm', 'fmh', 'fmattack', 'fmdecay', 'fmsustain'] },
  { label: 'PITCH',  icon: '📈', keys: ['penv', 'pattack', 'pdecay', 'prelease', 'pcurve', 'panchor'] },
  { label: 'ENV',    icon: '⏳', keys: ['attack', 'decay', 'sustain', 'rel', 'release', 'legato', 'clip'] },
  { label: 'CHAIN',  icon: '🦆', keys: ['duckdepth', 'duckattack'] },
  { label: 'SAMPLE', icon: '🎤', keys: ['loopAt', 'loop', 'begin', 'end', 'speed', 'chop', 'stretch', 'slice', 'splice', 'striate', 'loopBegin', 'loopEnd', 'cut', 'n', 'hurry', 'unit'] },
]

// Channel type → relevant FX group labels
export const TYPE_RELEVANT_GROUPS: Record<string, Set<string>> = {
  synth:  new Set(['FILTER', 'DRIVE', 'SPACE', 'MOD', 'FM', 'PITCH', 'ENV']),
  note:   new Set(['FILTER', 'DRIVE', 'SPACE', 'MOD', 'FM', 'PITCH', 'ENV']),
  sample: new Set(['FILTER', 'DRIVE', 'SPACE', 'MOD', 'PITCH', 'ENV', 'SAMPLE', 'CHAIN']),
  stack:  new Set(['FILTER', 'DRIVE', 'SPACE', 'MOD', 'ENV', 'CHAIN']),
}

// ─── FX Descriptions ───
export const FX_DESCRIPTIONS: Record<string, string> = {
  lpf: 'Low-pass filter cutoff — makes sound darker.', lp: 'Low-pass filter cutoff (alias).',
  hpf: 'High-pass filter cutoff — thins out the sound.', hp: 'High-pass filter cutoff (alias).',
  lpq: 'Low-pass resonance (Q) — adds peak near cutoff.', hpq: 'High-pass resonance (Q).',
  lpenv: 'LP envelope depth — adds pluck/sweep.', hpenv: 'HP envelope depth.',
  bpenv: 'Band-pass envelope depth.', lpattack: 'LP filter attack time.',
  lpa: 'LP filter attack (alias).', lprelease: 'LP filter release.',
  lpr: 'LP filter release (alias).', lps: 'LP filter sustain.',
  lpd: 'LP filter decay.', bpf: 'Band-pass filter center frequency.',
  bpq: 'Band-pass Q/width.', ftype: 'Filter type selector.',
  vowel: 'Vowel filter — voice-like resonances.',
  shape: 'Waveshaper distortion.', distort: 'Hard distortion/clipping.',
  crush: 'Bit crusher — lo-fi grit.', coarse: 'Sample rate reduction.',
  compressor: 'Dynamic compressor ratio.',
  room: 'Reverb amount.', roomsize: 'Reverb room size.',
  roomfade: 'Reverb fade time.', roomlp: 'Reverb low-pass.',
  roomdim: 'Reverb damping.', delay: 'Delay wet amount.',
  delayfeedback: 'Delay feedback.', delaytime: 'Delay time.',
  dry: 'Dry signal level.', echo: 'Echo effect amount.',
  detune: 'Oscillator detune.', pan: 'Stereo panning (-1 L to +1 R).',
  velocity: 'Note velocity/dynamics.', postgain: 'Post-processing gain.',
  vib: 'Vibrato depth.', vibmod: 'Vibrato rate.',
  phaser: 'Phaser speed.', phaserdepth: 'Phaser depth.',
  phasercenter: 'Phaser center frequency.', phasersweep: 'Phaser sweep range.',
  tremolosync: 'Tremolo sync.', tremolodepth: 'Tremolo depth.',
  tremoloskew: 'Tremolo skew.', tremolophase: 'Tremolo stereo phase.',
  tremoloshape: 'Tremolo wave shape.', fast: 'Leslie fast speed.',
  slow: 'Leslie slow speed.',
  fm: 'FM synthesis depth.', fmh: 'FM harmonicity ratio.',
  fmattack: 'FM envelope attack.', fmdecay: 'FM envelope decay.',
  fmsustain: 'FM envelope sustain.',
  penv: 'Pitch envelope depth.', pattack: 'Pitch envelope attack.',
  pdecay: 'Pitch envelope decay.', prelease: 'Pitch envelope release.',
  pcurve: 'Pitch envelope curve.', panchor: 'Pitch anchor point.',
  attack: 'Amplitude attack.', decay: 'Amplitude decay.',
  sustain: 'Amplitude sustain level.', rel: 'Amplitude release.',
  release: 'Amplitude release (alias).', legato: 'Legato mode.',
  clip: 'Hard clip level.',
  duckdepth: 'Sidechain duck depth.', duckattack: 'Sidechain duck attack.',
  loopAt: 'Loop point.', loop: 'Loop on/off.',
  begin: 'Sample start point.', end: 'Sample end point.',
  speed: 'Playback speed/pitch.', chop: 'Chop into N slices.',
  stretch: 'Time-stretch mode.', slice: 'Slice selector.',
  splice: 'Splice mode.', striate: 'Striate granular.',
  loopBegin: 'Loop region start.', loopEnd: 'Loop region end.',
  cut: 'Cut group.', n: 'Sample index.',
  hurry: 'Hurry playback.', unit: 'Speed unit mode.',
}

// ─── Sound / Bank dropdown data ───
const INSTRUMENT_GROUPS = new Set(['Synth', 'Keys', 'Organ', 'Guitar & Bass', 'Strings', 'Brass & Sax', 'Flute & Pipe', 'Voice', 'Synth Leads', 'Synth Pads', 'SFX & Ethnic'])
const SOUND_GROUPS = new Set(['Drums', 'Samples', 'SFX & Ethnic'])

const SOUND_OPTIONS: { group: string; sounds: [string, string][] }[] = [
  { group: 'Synth', sounds: [['sawtooth', 'Sawtooth'], ['supersaw', 'Supersaw'], ['sine', 'Sine'], ['square', 'Square'], ['triangle', 'Triangle']] },
  { group: 'Drums', sounds: [['bd', 'Kick'], ['sd', 'Snare'], ['cp', 'Clap'], ['hh', 'Hi-hat'], ['oh', 'Open HH'], ['rim', 'Rim'], ['tom', 'Tom'], ['ride', 'Ride'], ['crash', 'Crash'], ['perc', 'Perc']] },
  { group: 'Keys', sounds: [['gm_piano', 'Piano'], ['gm_epiano1', 'Rhodes'], ['gm_epiano2', 'DX7'], ['gm_music_box', 'Music Box'], ['gm_vibraphone', 'Vibes'], ['gm_marimba', 'Marimba']] },
  { group: 'Organ', sounds: [['gm_drawbar_organ', 'Drawbar'], ['gm_percussive_organ', 'Perc. Organ'], ['gm_rock_organ', 'Rock Organ']] },
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

// Sidechain info type
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

// ─── Group label badge ───
function GroupBadge({ label, icon, isActive, hasActiveKnobs, color, onClick }: {
  label: string; icon: string; isActive: boolean; hasActiveKnobs: boolean; color: string; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded transition-all duration-150 cursor-pointer border"
      style={{
        background: isActive
          ? 'linear-gradient(180deg, #162020 0%, #0f1818 100%)'
          : 'linear-gradient(180deg, #0e1214 0%, #0a0e10 100%)',
        border: isActive
          ? `1px solid ${color}40`
          : '1px solid #141e1e',
        boxShadow: isActive
          ? `inset 0 1px 0 rgba(0,229,199,0.04), 0 0 6px ${color}10`
          : 'inset 0 1px 0 rgba(255,255,255,0.02), 0 1px 3px rgba(0,0,0,0.3)',
        color: isActive ? color : '#2a4040',
        fontSize: '8px',
        fontWeight: 800,
        letterSpacing: '0.12em',
        fontFamily: 'monospace',
      }}
    >
      <span className="text-[10px]">{icon}</span>
      <span>{label}</span>
      {hasActiveKnobs && (
        <div className="w-1.5 h-1.5 rounded-full"
          style={{ background: color, boxShadow: `0 0 4px ${color}80` }} />
      )}
    </button>
  )
}

// ─── Center-based Pan Knob ───
function PanKnob({ value, onChange, size = 36, color = '#06b6d4' }: {
  value: number; onChange: (v: number) => void; size?: number; color?: string
}) {
  const dragRef = useRef<{ startY: number; startX: number; startVal: number } | null>(null)

  const clamped = Math.max(-1, Math.min(1, value))
  const rotation = clamped * 135

  const label = clamped === 0 ? 'C' : clamped < 0 ? `L${Math.abs(Math.round(clamped * 100))}` : `R${Math.round(clamped * 100)}`

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragRef.current = { startY: e.clientY, startX: e.clientX, startVal: clamped }
    const onMove = (ev: PointerEvent) => {
      if (!dragRef.current) return
      const dy = dragRef.current.startY - ev.clientY
      const dx = ev.clientX - dragRef.current.startX
      const delta = (dy * 0.008) + (dx * 0.004)
      const newVal = Math.max(-1, Math.min(1, dragRef.current.startVal + delta))
      onChange(Math.abs(newVal) < 0.03 ? 0 : parseFloat(newVal.toFixed(2)))
    }
    const onUp = () => {
      dragRef.current = null
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }, [clamped, onChange])

  const handleDoubleClick = useCallback(() => { onChange(0) }, [onChange])

  const r = size / 2
  const indicatorLen = r * 0.55

  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-[5px] font-black uppercase tracking-[.2em]" style={{ color: '#2a4a4a', fontFamily: 'monospace' }}>PAN</span>
      <div
        className="relative cursor-ns-resize select-none"
        style={{ width: size, height: size }}
        onPointerDown={handlePointerDown}
        onDoubleClick={handleDoubleClick}
        title={`Pan: ${label} (double-click to center)`}
      >
        {/* Knob body */}
        <div className="absolute inset-0 rounded-full" style={{
          background: `radial-gradient(circle at 35% 35%, #283838 0%, #182020 50%, #101818 100%)`,
          boxShadow: `inset 2px 2px 4px rgba(0,229,199,0.04), inset -2px -2px 4px rgba(0,0,0,0.5), 0 2px 6px rgba(0,0,0,0.5)`,
        }} />
        {/* Center dot */}
        <div className="absolute rounded-full" style={{
          width: 4, height: 4, top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          background: clamped === 0 ? color : '#2a4a4a',
          boxShadow: clamped === 0 ? `0 0 4px ${color}60` : 'none',
        }} />
        {/* Indicator line */}
        <div className="absolute" style={{
          width: 2, height: indicatorLen,
          top: r - indicatorLen, left: r - 1,
          borderRadius: 1,
          background: `linear-gradient(180deg, ${color} 0%, ${color}40 100%)`,
          transformOrigin: `1px ${indicatorLen}px`,
          transform: `rotate(${rotation}deg)`,
          boxShadow: `0 0 4px ${color}50`,
        }} />
        {/* L / R labels */}
        <span className="absolute text-[5px] font-black" style={{ left: -2, top: '50%', transform: 'translateY(-50%)', color: clamped < 0 ? color : '#1a3030', fontFamily: 'monospace' }}>L</span>
        <span className="absolute text-[5px] font-black" style={{ right: -3, top: '50%', transform: 'translateY(-50%)', color: clamped > 0 ? color : '#1a3030', fontFamily: 'monospace' }}>R</span>
      </div>
      <span className="text-[7px] font-mono font-black tabular-nums" style={{ color: clamped === 0 ? color : '#5a8080' }}>
        {label}
      </span>
    </div>
  )
}

// ─── Layout mode ───
export type EffectsPanelLayout = 'bottom' | 'sidebar'

// ─── Main Effects Panel ───
export default function StudioEffectsPanel({
  channel, channelIdx,
  onParamChange, onEffectInsert, onRemoveEffect,
  layout = 'sidebar',
  onClose,
  // Extended props for full channel control
  onSoundChange, onBankChange, onAddSound,
  onOpenPianoRoll, onOpenDrumSequencer, onOpenPadSampler, onOpenVocalSlicer,
  onTranspose, onPreview,
  // Sidechain
  sidechainInfo, onEnableSidechain, onDisableSidechain,
  onAddSidechainTarget, onRemoveSidechainTarget, onDisconnectSidechain,
  // Stack rows
  stackRows, onStackRowSoundChange, onStackRowGainChange, onStackRowBankChange, onRemoveStackRow,
}: {
  channel: ParsedChannel
  channelIdx: number
  onParamChange: (channelIdx: number, key: string, value: number) => void
  onEffectInsert: (channelIdx: number, effectCode: string) => void
  onRemoveEffect: (channelIdx: number, effectKey: string) => void
  layout?: EffectsPanelLayout
  onClose?: () => void
  onSoundChange?: (idx: number, sound: string) => void
  onBankChange?: (idx: number, bank: string) => void
  onAddSound?: (idx: number, sound: string) => void
  onOpenPianoRoll?: (idx: number) => void
  onOpenDrumSequencer?: (idx: number) => void
  onOpenPadSampler?: (idx: number) => void
  onOpenVocalSlicer?: (idx: number) => void
  onTranspose?: (channelIdx: number, semitones: number) => void
  onPreview?: (soundCode: string) => void
  sidechainInfo?: SidechainInfo
  onEnableSidechain?: (sourceIdx: number) => void
  onDisableSidechain?: (sourceIdx: number) => void
  onAddSidechainTarget?: (sourceIdx: number, targetIdx: number) => void
  onRemoveSidechainTarget?: (sourceIdx: number, targetIdx: number) => void
  onDisconnectSidechain?: (targetIdx: number) => void
  stackRows?: StackRow[]
  onStackRowSoundChange?: (channelIdx: number, rowIdx: number, newSound: string) => void
  onStackRowGainChange?: (channelIdx: number, rowIdx: number, newGain: number) => void
  onStackRowBankChange?: (channelIdx: number, rowIdx: number, newBank: string) => void
  onRemoveStackRow?: (channelIdx: number, rowIdx: number) => void
}) {
  const [activeGroup, setActiveGroup] = useState<string | null>(null)
  const [panelHeight, setPanelHeight] = useState(220)
  const resizeRef = useRef<{ startY: number; startH: number } | null>(null)

  // LCD monitor — tracks which knob the user is currently tweaking
  const [activeParam, setActiveParam] = useState<{ key: string; value: number; min: number; max: number; unit?: string } | null>(null)

  const relevantGroupNames = TYPE_RELEVANT_GROUPS[channel.sourceType] || TYPE_RELEVANT_GROUPS.sample

  const gainParam = channel.params.find(p => p.key === 'gain')
  const panParam = channel.params.find(p => p.key === 'pan')
  const isMelodic = channel.sourceType === 'synth' || channel.sourceType === 'note'
  const isDrum = (channel.sourceType === 'sample' && !channel.effects.includes('loopAt')) || channel.sourceType === 'stack'
  const isVocal = channel.sourceType === 'sample' && channel.effects.includes('loopAt')
  const primaryEditor = isVocal ? 'sampler' : isMelodic ? 'piano' : isDrum ? 'drum' : 'piano'

  const groups = useMemo(() => {
    return FX_GROUPS
      .filter(g => relevantGroupNames.has(g.label))
      .map(group => {
        const knobs = group.keys
          .map(key => {
            const paramDef = PARAM_DEFS.find((p: ParamDef) => p.key === key)
            if (!paramDef) return null
            const existingParam = channel.params.find(p => p.key === key)
            return { paramDef, existingParam, key }
          })
          .filter(Boolean) as { paramDef: ParamDef; existingParam: ParsedChannel['params'][number] | undefined; key: string }[]
        return { ...group, knobs, hasActive: knobs.some(k => k.existingParam) }
      })
  }, [channel, relevantGroupNames])

  useEffect(() => {
    if (activeGroup === null || !groups.find(g => g.label === activeGroup)) {
      const firstActive = groups.find(g => g.hasActive)
      setActiveGroup(firstActive?.label || groups[0]?.label || null)
    }
  }, [groups, activeGroup])

  const currentGroup = groups.find(g => g.label === activeGroup)

  // LCD tweak callbacks
  const handleTweakStart = useCallback((paramKey: string) => {
    const group = currentGroup || groups.find(g => g.knobs.some(k => k.key === paramKey))
    const knob = group?.knobs.find(k => k.key === paramKey)
    if (knob) {
      setActiveParam({ key: paramKey, value: knob.existingParam?.value ?? knob.paramDef.min, min: knob.paramDef.min, max: knob.paramDef.max, unit: knob.paramDef.unit })
    }
  }, [currentGroup, groups])
  const tweakEndTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const handleTweakEnd = useCallback(() => {
    // Keep showing the last-tweaked param for 3s so user can read the display
    if (tweakEndTimer.current) clearTimeout(tweakEndTimer.current)
    tweakEndTimer.current = setTimeout(() => setActiveParam(null), 3000)
  }, [])

  const handleResizeDown = useCallback((e: React.PointerEvent) => {
    if (layout !== 'bottom') return
    e.preventDefault()
    resizeRef.current = { startY: e.clientY, startH: panelHeight }
    const onMove = (ev: PointerEvent) => {
      if (!resizeRef.current) return
      const dy = resizeRef.current.startY - ev.clientY
      setPanelHeight(Math.max(160, Math.min(450, resizeRef.current.startH + dy)))
    }
    const onUp = () => {
      resizeRef.current = null
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }, [panelHeight, layout])

  const typeLabel = channel.sourceType === 'synth' ? 'SYNTHESIZER' :
    channel.sourceType === 'note' ? 'INSTRUMENT' :
    channel.sourceType === 'stack' ? 'DRUM MACHINE' :
    channel.sourceType === 'sample' ? (isVocal ? 'VOCAL' : 'SAMPLER') : 'CHANNEL'

  const typeShort = channel.sourceType === 'synth' ? 'SYN' :
    channel.sourceType === 'note' ? 'INST' :
    channel.sourceType === 'stack' ? 'DRM' :
    channel.sourceType === 'sample' ? (isVocal ? 'VOC' : 'SMP') : 'CH'

  const isSidebar = layout === 'sidebar'

  // ── Knobs renderer (shared by both layouts) ──
  const renderKnobs = (knobSize: number) => currentGroup ? (
    <div className="flex-1 overflow-y-auto px-3 pt-3 pb-4"
      style={{ scrollbarWidth: 'thin', scrollbarColor: `${channel.color}20 transparent` }}>
      <div className="flex items-center gap-2 mb-3">
        <div className="px-2 py-0.5 rounded-sm" style={{
          background: 'linear-gradient(180deg, #0a1015 0%, #0c1218 100%)',
          border: '1px solid #1a3030',
          boxShadow: 'inset 0 1px 4px rgba(0,0,0,0.6)',
        }}>
          <span className="text-[8px] font-black tracking-[.2em] uppercase"
            style={{ color: `${channel.color}90`, fontFamily: 'monospace' }}>
            {currentGroup.icon} {currentGroup.label}
          </span>
        </div>
        <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, #1a303030 0%, transparent 100%)' }} />
        <span className="text-[7px] font-bold font-mono" style={{ color: '#1a4040' }}>
          {currentGroup.knobs.filter(k => k.existingParam).length}/{currentGroup.knobs.length}
        </span>
      </div>
      <div className="flex flex-wrap gap-x-2 gap-y-3 justify-start">
        {currentGroup.knobs.map(({ paramDef, existingParam, key }) => {
          const hasValue = !!existingParam
          const knobValue = existingParam ? existingParam.value : paramDef.min
          const isComplex = existingParam?.isComplex
          return (
            <HardwareKnob
              key={key} label={paramDef.label} value={knobValue}
              min={paramDef.min} max={paramDef.max} step={paramDef.step}
              size={knobSize} color={hasValue ? channel.color : '#4a4e56'}
              unit={paramDef.unit} isComplex={isComplex} active={hasValue}
              paramKey={key} description={FX_DESCRIPTIONS[key]}
              onTweakStart={handleTweakStart}
              onTweakEnd={handleTweakEnd}
              onRemove={hasValue ? () => onRemoveEffect(channelIdx, key) : undefined}
              onChange={(v: number) => {
                if (hasValue) { onParamChange(channelIdx, key, v) }
                else { onEffectInsert(channelIdx, `.${key}(${v})`) }
                // Keep LCD in sync while dragging
                setActiveParam(prev => prev?.key === key ? { ...prev, value: v } : prev)
              }}
            />
          )
        })}
      </div>
    </div>
  ) : null

  // ── Channel controls section (shared) ──
  const renderChannelControls = () => (
    <>
      {/* ═══ SOUND / BANK SECTION ═══ */}
      {channel.sourceType !== 'stack' && onSoundChange && (channel.isSimpleSource || channel.bank || channel.sourceType === 'sample' || channel.sourceType === 'synth') && (
        <div className="px-3 py-2 shrink-0" style={{ borderBottom: '1px solid #111a1a' }}>
          <div className="flex items-center gap-1 mb-1.5">
            <span className="text-[6px] font-black uppercase tracking-[.2em]"
              style={{ color: '#1a5050', fontFamily: 'monospace' }}>
              {isMelodic ? '◆ INSTRUMENT' : '◆ SOUND SOURCE'}
            </span>
            {channel.sourceType === 'sample' && channel.isSimpleSource && onAddSound && (
              <select value="" onChange={(e) => { if (e.target.value) onAddSound(channelIdx, e.target.value) }}
                className="text-[6px] font-mono rounded px-1 py-0 outline-none cursor-pointer ml-auto"
                style={{ color: '#00e5c7', background: '#0a0b0d', border: '1px solid #1a3030', borderRadius: '4px', maxWidth: '60px' }}>
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
            <select value={channel.source} onChange={(e) => onSoundChange(channelIdx, e.target.value)}
              className="w-full text-[8px] font-mono rounded px-2 py-1 outline-none cursor-pointer"
              style={{ color: '#c0d0d8', background: 'linear-gradient(180deg, #0a1015 0%, #0c1218 100%)',
                border: '1px solid #1a3030', borderRadius: '6px', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.4)' }}>
              <option value={channel.source}>{channel.source}</option>
              {SOUND_OPTIONS.filter(g => isMelodic ? INSTRUMENT_GROUPS.has(g.group) : SOUND_GROUPS.has(g.group)).map(g => (
                <optgroup key={g.group} label={g.group}>
                  {g.sounds.filter(([val]) => val !== channel.source).map(([val, label]) => (<option key={val} value={val}>{label}</option>))}
                </optgroup>
              ))}
            </select>
          ) : (
            <span className="text-[7px] text-white/20 font-mono truncate block">{channel.source}</span>
          )}
          {channel.sourceType !== 'synth' && channel.sourceType !== 'note' && onBankChange && (
            <select value={channel.bank || ''} onChange={(e) => onBankChange(channelIdx, e.target.value)}
              className="w-full text-[8px] font-mono rounded px-2 py-1 outline-none cursor-pointer mt-1"
              style={{ color: '#06b6d4', background: 'linear-gradient(180deg, #0a1015 0%, #0c1218 100%)',
                border: '1px solid #0f2525', borderRadius: '6px', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.4)' }}>
              <option value="">{channel.bank || 'No Bank'}</option>
              {BANK_OPTIONS.filter(([val]) => val !== channel.bank).map(([val, label]) => (<option key={val} value={val}>{label}</option>))}
            </select>
          )}
        </div>
      )}

      {/* ═══ STACK ROWS ═══ */}
      {channel.sourceType === 'stack' && stackRows && stackRows.length > 0 && (
        <div className="px-3 py-2 shrink-0" style={{ borderBottom: '1px solid #111a1a' }}>
          <div className="flex items-center gap-1 mb-1.5">
            <span className="text-[6px] font-black uppercase tracking-[.2em]"
              style={{ color: '#1a5050', fontFamily: 'monospace' }}>◆ STACK SOUNDS</span>
            {onAddSound && (
              <select value="" onChange={(e) => { if (e.target.value) onAddSound(channelIdx, e.target.value) }}
                className="text-[6px] font-mono rounded px-1 py-0 outline-none cursor-pointer ml-auto"
                style={{ color: '#00e5c7', background: '#0a0b0d', border: '1px solid #1a3030', borderRadius: '4px', maxWidth: '60px' }}>
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
            <div key={ri} className="flex items-center gap-1 py-0.5" style={{ borderBottom: ri < stackRows.length - 1 ? '1px solid #0f1818' : 'none' }}>
              <select value={row.instrument} onChange={(e) => onStackRowSoundChange?.(channelIdx, ri, e.target.value)}
                className="text-[7px] font-mono rounded px-1 py-0.5 outline-none cursor-pointer flex-1 min-w-0"
                style={{ color: '#c0d0d8', background: '#0c1218', border: '1px solid #1a3030', borderRadius: '6px' }}>
                <option value={row.instrument}>{row.instrument}</option>
                {SOUND_OPTIONS.filter(g => SOUND_GROUPS.has(g.group)).map(g => (
                  <optgroup key={g.group} label={g.group}>
                    {g.sounds.filter(([val]) => val !== row.instrument).map(([val, label]) => (<option key={val} value={val}>{label}</option>))}
                  </optgroup>
                ))}
              </select>
              <StudioKnob label="G" value={row.gain} min={0} max={1.5} step={0.01} size={18} color={channel.color}
                onChange={(v: number) => onStackRowGainChange?.(channelIdx, ri, v)} />
              {stackRows.length > 1 && onRemoveStackRow && (
                <button onClick={() => onRemoveStackRow(channelIdx, ri)}
                  className="cursor-pointer transition-all hover:text-red-400"
                  style={{ color: '#2a4040', fontSize: '8px', background: 'none', border: 'none' }}>×</button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ═══ TRANSPOSE ═══ */}
      {(channel.sourceType === 'synth' || channel.sourceType === 'note') && onTranspose && (
        <div className="px-3 py-2 shrink-0 flex items-center gap-2" style={{ borderBottom: '1px solid #111a1a' }}>
          <span className="text-[6px] font-black uppercase tracking-[.2em]"
            style={{ color: '#1a5050', fontFamily: 'monospace' }}>◆ TRANSPOSE</span>
          {(() => {
            const currentTranspose = getTranspose(channel.rawCode)
            return (
              <div className="flex items-center gap-1 ml-auto">
                <button onClick={() => onTranspose(channelIdx, currentTranspose - 12)}
                  className="cursor-pointer transition-all active:scale-90"
                  style={{ width: 18, height: 16, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '6px', fontWeight: 900, color: '#6f8fb3', background: '#0a1015', border: '1px solid #1a3030',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.3)', fontFamily: 'monospace' }}>−12</button>
                <StudioKnob label="ST" value={currentTranspose} min={-24} max={24} step={1} size={24} color="#6f8fb3"
                  formatValue={(v: number) => (v > 0 ? `+${v}` : `${v}`)}
                  onChange={(v: number) => onTranspose(channelIdx, v)} />
                <button onClick={() => onTranspose(channelIdx, currentTranspose + 12)}
                  className="cursor-pointer transition-all active:scale-90"
                  style={{ width: 18, height: 16, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '6px', fontWeight: 900, color: '#6f8fb3', background: '#0a1015', border: '1px solid #1a3030',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.3)', fontFamily: 'monospace' }}>+12</button>
              </div>
            )
          })()}
        </div>
      )}

      {/* ═══ PITCH (sample) ═══ */}
      {channel.sourceType === 'sample' && (
        <div className="px-3 py-2 shrink-0 flex items-center gap-2" style={{ borderBottom: '1px solid #111a1a' }}>
          <span className="text-[6px] font-black uppercase tracking-[.2em]"
            style={{ color: '#1a5050', fontFamily: 'monospace' }}>◆ PITCH</span>
          {(() => {
            const speedParam = channel.params.find(p => p.key === 'speed')
            const currentSpeed = speedParam ? speedParam.value : 1
            const currentSemitones = Math.round(12 * Math.log2(currentSpeed))
            return (
              <div className="ml-auto">
                <StudioKnob label="SEMI" value={currentSemitones} min={-24} max={24} step={1} size={24} color="#2dd4bf"
                  formatValue={(v: number) => (v > 0 ? `+${v}` : `${v}`)}
                  onChange={(v: number) => { const s = Math.pow(2, v / 12); onParamChange(channelIdx, 'speed', parseFloat(s.toFixed(4))) }} />
              </div>
            )
          })()}
        </div>
      )}

      {/* ═══ SIDECHAIN ═══ */}
      {sidechainInfo && (sidechainInfo.isSource || sidechainInfo.isKickLike || sidechainInfo.hasDuckParams || sidechainInfo.isDucked) && (
        <div className="px-3 py-2 shrink-0" style={{ borderBottom: '1px solid #111a1a' }}>
          <div className="flex items-center gap-1 mb-1.5">
            <Link size={8} style={{ color: '#00e5c7', opacity: 0.4 }} />
            <span className="text-[6px] font-black uppercase tracking-[.2em]"
              style={{ color: '#1a5050', fontFamily: 'monospace' }}>◆ SIDECHAIN</span>
          </div>

          {!sidechainInfo.isSource && !sidechainInfo.hasDuckParams && sidechainInfo.isKickLike && onEnableSidechain && (
            <button onClick={() => onEnableSidechain(channelIdx)}
              className="w-full flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg transition-all cursor-pointer active:scale-95"
              style={{ background: 'linear-gradient(180deg, #111820 0%, #0d1418 100%)', color: '#00e5c7',
                border: '1px solid #1a3535', fontSize: '7px', fontWeight: 800, letterSpacing: '0.1em',
                boxShadow: '0 1px 4px rgba(0,0,0,0.3)', fontFamily: 'monospace' }}>
              <Link size={8} /> ENABLE SIDECHAIN
            </button>
          )}

          {sidechainInfo.isSource && (
            <div className="space-y-1">
              {sidechainInfo.targetChannels.length > 0 ? (
                <div className="space-y-0.5">
                  {sidechainInfo.targetChannels.map((t) => (
                    <div key={t.idx} className="flex items-center gap-1 px-2 py-0.5 rounded text-[7px]"
                      style={{ background: '#0c1218', border: '1px solid #1a3030' }}>
                      <span style={{ color: t.color }} className="font-bold uppercase truncate flex-1 font-mono">{t.name}</span>
                      {onRemoveSidechainTarget && (
                        <button onClick={() => onRemoveSidechainTarget(channelIdx, t.idx)}
                          className="text-white/15 hover:text-red-400/60 cursor-pointer"><X size={8} /></button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-[7px] italic px-1" style={{ color: '#1a4040', fontFamily: 'monospace' }}>No targets</div>
              )}
              {sidechainInfo.availableTargets.length > 0 && onAddSidechainTarget && (
                <select value="" onChange={(e) => { if (e.target.value) onAddSidechainTarget(channelIdx, parseInt(e.target.value)) }}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full text-[7px] font-mono rounded-lg px-2 py-1 outline-none cursor-pointer"
                  style={{ background: '#0c1218', color: '#00e5c7', border: '1px solid #1a3535' }}>
                  <option value="">+ Add Target…</option>
                  {sidechainInfo.availableTargets.map((t) => <option key={t.idx} value={t.idx}>{t.name}</option>)}
                </select>
              )}
              {channel.params.some(p => p.key === 'duckdepth' || p.key === 'duckattack') && (
                <div className="flex flex-wrap gap-2 justify-center pt-1">
                  {channel.params.filter(p => p.key === 'duckdepth' || p.key === 'duckattack').map((param) => {
                    const def = getParamDef(param.key); if (!def) return null
                    return <StudioKnob key={param.key} label={def.label} value={param.value}
                      min={def.min} max={def.max} step={def.step} size={22} color="#fb923c"
                      unit={def.unit} isComplex={param.isComplex}
                      onChange={(v: number) => onParamChange(channelIdx, param.key, v)}
                      onRemove={() => onRemoveEffect(channelIdx, param.key)} />
                  })}
                </div>
              )}
              {onDisableSidechain && (
                <button onClick={() => onDisableSidechain(channelIdx)}
                  className="w-full flex items-center justify-center gap-1 px-2 py-1 rounded-lg transition-all cursor-pointer active:scale-95"
                  style={{ background: '#0c1218', color: '#b86f6f', border: '1px solid #2a1a1a', fontSize: '7px', fontWeight: 800, fontFamily: 'monospace' }}>
                  <Unlink size={8} /> REMOVE
                </button>
              )}
            </div>
          )}

          {sidechainInfo.isDucked && sidechainInfo.duckedBySource && (
            <div className="flex items-center gap-1 py-1 px-1">
              <span className="text-[8px]">🦆</span>
              <span className="text-[7px] font-bold uppercase font-mono" style={{ color: sidechainInfo.duckedBySource.color }}>{sidechainInfo.duckedBySource.name}</span>
              {onDisconnectSidechain && (
                <button onClick={() => onDisconnectSidechain(channelIdx)}
                  className="ml-auto text-white/15 hover:text-red-400/60 cursor-pointer"><X size={8} /></button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ═══ ACTIVE EFFECTS TAGS ═══ */}
      {channel.effects.length > 0 && (
        <div className="px-3 py-1.5 shrink-0 flex flex-wrap gap-[3px]" style={{ borderBottom: '1px solid #111a1a' }}>
          {channel.effects
            .filter(fx => !['scope', 'pianoroll', 'orbit', 'gain', 'pan'].includes(fx))
            .map(fx => {
              const tagColor = (fx === 'arp' || fx === 'arpeggiate') ? '#06b6d4' : channel.color
              return (
                <span key={fx} className="inline-flex items-center gap-[2px] rounded-sm transition-all group/tag"
                  style={{ padding: '1px 5px', fontSize: '6px', fontWeight: 800, letterSpacing: '.06em',
                    textTransform: 'uppercase', color: tagColor, background: `${tagColor}10`,
                    border: `1px solid ${tagColor}20`, fontFamily: 'monospace' }}>
                  {fx}
                  <button onClick={() => onRemoveEffect(channelIdx, fx)}
                    className="cursor-pointer opacity-0 group-hover/tag:opacity-100 transition-opacity hover:text-red-400"
                    style={{ fontSize: '7px', padding: '0 1px', background: 'none', border: 'none', color: 'inherit' }}
                    title={`Remove .${fx}()`}>×</button>
                </span>
              )
            })}
        </div>
      )}
    </>
  )

  // ═══════════════════════════════════════════════════════════
  //  SIDEBAR LAYOUT
  // ═══════════════════════════════════════════════════════════
  if (isSidebar) {
    return (
      <div className="h-full flex flex-col overflow-hidden"
        style={{
          width: 300,
          background: `linear-gradient(180deg, #0e1014 0%, #0c0e12 30%, #0a0c10 60%, #090b0e 100%)`,
          borderLeft: '2px solid #1a2a2a',
          boxShadow: 'inset 2px 0 8px rgba(0,0,0,0.6), inset 0 0 40px rgba(0,60,60,0.03)',
        }}
      >
        {/* ═══ CASSETTE HEADER — Matrix-style dark teal ═══ */}
        <div className="shrink-0 relative overflow-hidden"
          style={{
            background: `linear-gradient(180deg, #0a1215 0%, #0d1418 40%, #0b1114 100%)`,
            borderBottom: '1px solid #1a3535',
            boxShadow: 'inset 0 -1px 0 rgba(0,229,199,0.06), 0 2px 8px rgba(0,0,0,0.4)',
          }}
        >
          {/* Scanline texture */}
          <div className="absolute inset-0 pointer-events-none" style={{
            backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,200,180,0.015) 2px, rgba(0,200,180,0.015) 4px)`,
            mixBlendMode: 'overlay',
          }} />
          {/* Top glow line */}
          <div className="absolute top-0 left-0 right-0 h-px" style={{
            background: 'linear-gradient(90deg, transparent 0%, #00e5c740 20%, #00e5c780 50%, #00e5c740 80%, transparent 100%)',
          }} />

          {/* Row 1: Brand + Type Badge + Close */}
          <div className="flex items-center gap-2 px-3 pt-2.5 pb-1 relative z-10">
            <div className="relative shrink-0" style={{ width: 8, height: 8 }}>
              <div className="absolute inset-0 rounded-full" style={{
                background: `radial-gradient(circle, ${channel.color} 20%, ${channel.color}80 50%, transparent 70%)`,
                boxShadow: `0 0 8px ${channel.color}80, 0 0 3px ${channel.color}`,
              }} />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[11px] font-black tracking-[.3em] uppercase leading-none"
                style={{ color: '#00e5c7', textShadow: '0 0 12px rgba(0,229,199,0.4), 0 0 4px rgba(0,229,199,0.2)',
                  fontFamily: '"Courier New", "Consolas", monospace' }}>
                444 FX
              </span>
              <span className="text-[5px] font-bold tracking-[.25em] uppercase leading-none mt-0.5"
                style={{ color: '#1a4a4a', fontFamily: 'monospace' }}>
                CHANNEL INSPECTOR
              </span>
            </div>
            <div className="flex-1" />
            <div className="px-2 py-0.5 rounded-sm shrink-0" style={{
              background: 'linear-gradient(180deg, #111820 0%, #0d1418 100%)',
              border: '1px solid #1a3030',
              boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.5), 0 0 6px rgba(0,229,199,0.05)',
            }}>
              <span className="text-[6px] font-black tracking-[.2em] uppercase"
                style={{ color: '#1a5555', fontFamily: 'monospace' }}>{typeShort}</span>
            </div>
            {onClose && (
              <button onClick={onClose}
                className="p-1 rounded transition-all cursor-pointer hover:bg-white/5"
                style={{ color: '#2a4a4a' }}><X size={12} /></button>
            )}
          </div>

          {/* Row 2: Channel name LCD */}
          <div className="px-3 pb-1 relative z-10">
            <div className="px-3 py-1.5 rounded-sm" style={{
              background: 'linear-gradient(180deg, #060a0c 0%, #081012 50%, #060a0c 100%)',
              border: '1px solid #0f2222',
              boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.6), inset 0 -1px 0 rgba(0,229,199,0.03)',
            }}>
              <div className="flex items-center gap-2">
                <span className="text-[7px]">{channel.icon}</span>
                <span className="text-[12px] font-black tracking-[.15em] uppercase truncate"
                  style={{ color: channel.color, textShadow: `0 0 8px ${channel.color}50, 0 0 3px ${channel.color}30`,
                    fontFamily: '"Courier New", "Consolas", monospace' }}>
                  {channel.name}
                </span>
                <div className="flex-1" />
                <span className="text-[6px] font-bold tracking-[.15em] uppercase"
                  style={{ color: '#1a5050', fontFamily: 'monospace' }}>{typeLabel}</span>
              </div>
            </div>
          </div>

          {/* Row 3: Vol / Pan / Editor Buttons */}
          <div className="flex items-center gap-3 px-3 pb-2.5 pt-1 relative z-10">
            {/* Volume */}
            <HardwareKnob label="VOL" value={gainParam ? gainParam.value : 0.8}
              min={0} max={1.5} step={0.01} size={36} color={channel.color}
              active={!!gainParam} paramKey="gain" description="Channel volume"
              onChange={(v: number) => {
                if (gainParam) { onParamChange(channelIdx, 'gain', v) }
                else { onEffectInsert(channelIdx, `.gain(${v})`) }
              }}
              onRemove={gainParam ? () => onRemoveEffect(channelIdx, 'gain') : undefined}
            />

            {/* Pan */}
            <PanKnob value={panParam ? panParam.value : 0} color="#06b6d4" size={36}
              onChange={(v: number) => {
                if (panParam) { onParamChange(channelIdx, 'pan', v) }
                else { onEffectInsert(channelIdx, `.pan(${v})`) }
              }}
            />

            {/* Divider */}
            <div className="w-px h-8 mx-1" style={{ background: '#1a3030' }} />

            {/* Editor Buttons */}
            <div className="flex flex-col gap-1">
              {primaryEditor === 'piano' && onOpenPianoRoll && (
                <button onClick={() => onOpenPianoRoll(channelIdx)}
                  className="flex items-center gap-1 px-2 py-1 rounded transition-all cursor-pointer active:scale-95"
                  style={{ background: 'linear-gradient(180deg, #111820 0%, #0d1418 100%)', border: '1px solid #1a3535',
                    color: '#06b6d4', fontSize: '7px', fontWeight: 800, letterSpacing: '0.1em',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.3)', fontFamily: 'monospace' }}>
                  <Piano size={10} /> PIANO ROLL
                </button>
              )}
              {primaryEditor === 'drum' && onOpenDrumSequencer && (
                <button onClick={() => onOpenDrumSequencer(channelIdx)}
                  className="flex items-center gap-1 px-2 py-1 rounded transition-all cursor-pointer active:scale-95"
                  style={{ background: 'linear-gradient(180deg, #111820 0%, #0d1418 100%)', border: '1px solid #1a3535',
                    color: '#22d3ee', fontSize: '7px', fontWeight: 800, letterSpacing: '0.1em',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.3)', fontFamily: 'monospace' }}>
                  <Grid3X3 size={10} /> DRUM SEQ
                </button>
              )}
              {primaryEditor === 'sampler' && onOpenPadSampler && (
                <button onClick={() => onOpenPadSampler(channelIdx)}
                  className="flex items-center gap-1 px-2 py-1 rounded transition-all cursor-pointer active:scale-95"
                  style={{ background: 'linear-gradient(180deg, #111820 0%, #0d1418 100%)', border: '1px solid #1a3535',
                    color: '#c77dba', fontSize: '7px', fontWeight: 800, letterSpacing: '0.1em',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.3)', fontFamily: 'monospace' }}>
                  <Mic size={10} /> PAD SAMPLER
                </button>
              )}
              {primaryEditor === 'sampler' && onOpenVocalSlicer && (
                <button onClick={() => onOpenVocalSlicer(channelIdx)}
                  className="flex items-center gap-1 px-2 py-1 rounded transition-all cursor-pointer active:scale-95"
                  style={{ background: 'linear-gradient(180deg, #111820 0%, #0d1418 100%)', border: '1px solid #1a3535',
                    color: '#f472b6', fontSize: '7px', fontWeight: 800, letterSpacing: '0.1em',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.3)', fontFamily: 'monospace' }}>
                  <Scissors size={10} /> SLICER
                </button>
              )}
              {onPreview && channel.isSimpleSource && (
                <button onClick={() => onPreview(`s("${channel.source}")`)}
                  className="flex items-center gap-1 px-2 py-0.5 rounded transition-all cursor-pointer active:scale-95"
                  style={{ background: 'transparent', border: '1px solid #1a3030', color: '#1a5555',
                    fontSize: '6px', fontWeight: 700, letterSpacing: '0.08em', fontFamily: 'monospace' }}
                  title={`Preview ${channel.source}`}>
                  <Volume2 size={8} /> PREVIEW
                </button>
              )}
            </div>
          </div>

          <div className="absolute bottom-0 left-0 right-0 h-px" style={{
            background: 'linear-gradient(90deg, transparent 0%, #1a353540 30%, #1a353560 50%, #1a353540 70%, transparent 100%)',
          }} />
        </div>

        {/* SCROLLABLE BODY: channel controls + FX */}
        <div className="flex-1 flex flex-col overflow-hidden min-h-0">
          <div className="overflow-y-auto flex-1"
            style={{ scrollbarWidth: 'thin', scrollbarColor: `${channel.color}15 transparent` }}>
            {renderChannelControls()}

            {/* FX Group selector */}
            <div className="flex flex-wrap gap-1 px-3 py-2" style={{ borderBottom: '1px solid #111a1a' }}>
              {groups.map(g => (
                <GroupBadge key={g.label} label={g.label} icon={g.icon}
                  isActive={activeGroup === g.label} hasActiveKnobs={g.hasActive}
                  color={channel.color} onClick={() => setActiveGroup(g.label)} />
              ))}
            </div>

            {/* LCD Monitor */}
            <div className="px-3 py-2" style={{ borderBottom: '1px solid #111a1a' }}>
              <FxLcdMonitor
                paramKey={activeParam?.key ?? null}
                paramLabel={activeParam?.key ? (FX_DESCRIPTIONS[activeParam.key] || activeParam.key) : ''}
                value={activeParam?.value ?? 0}
                min={activeParam?.min ?? 0}
                max={activeParam?.max ?? 1}
                color={channel.color}
                unit={activeParam?.unit}
                width={240}
                height={72}
              />
            </div>

            {/* Knobs */}
            {renderKnobs(44)}
          </div>
        </div>

        {/* Bottom branding */}
        <div className="shrink-0 flex items-center justify-between px-3 py-1.5 relative"
          style={{ background: 'linear-gradient(180deg, transparent 0%, rgba(0,20,20,0.3) 100%)',
            borderTop: '1px solid #0f1a1a' }}>
          <span className="text-[5px] font-bold tracking-[.3em] uppercase"
            style={{ color: '#0f2020', fontFamily: '"Courier New", monospace' }}>
            444RADIO ◆ EFFECTS RACK
          </span>
          <span className="text-[5px] font-bold tracking-[.2em]"
            style={{ color: '#0f2020', fontFamily: 'monospace' }}>v2.0</span>
          <div className="absolute inset-0 pointer-events-none" style={{
            backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 1px, rgba(0,200,180,0.008) 1px, rgba(0,200,180,0.008) 2px)`,
            mixBlendMode: 'overlay',
          }} />
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════
  //  BOTTOM LAYOUT (original)
  // ═══════════════════════════════════════════════════════════
  return (
    <div className="shrink-0 relative overflow-hidden"
      style={{
        height: panelHeight,
        background: `linear-gradient(180deg, #0e1014 0%, #0c0e12 3%, #0a0c10 50%, #090b0e 97%, #0e1014 100%)`,
        borderTop: '2px solid #1a2a2a',
        boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.4), inset 0 -1px 0 rgba(0,229,199,0.03)',
      }}
    >
      {/* Resize handle */}
      <div className="absolute top-0 left-0 right-0 h-2 cursor-ns-resize z-30 flex items-center justify-center"
        onPointerDown={handleResizeDown}
        style={{ background: 'linear-gradient(180deg, #1a2a2a 0%, transparent 100%)' }}>
        <div style={{ width: 32, height: 2, borderRadius: 1, background: 'rgba(0,229,199,0.08)' }} />
      </div>

      {/* Header */}
      <div className="flex items-center gap-3 px-8 pt-3 pb-1.5" style={{ borderBottom: '1px solid #111a1a' }}>
        <div className="flex items-center gap-2 shrink-0">
          <div className="rounded-full" style={{
            width: 6, height: 6,
            background: `radial-gradient(circle, ${channel.color} 30%, ${channel.color}60 70%, transparent 100%)`,
            boxShadow: `0 0 6px ${channel.color}60, 0 0 2px ${channel.color}`,
          }} />
          <div className="flex flex-col">
            <span className="text-[10px] font-black tracking-[.25em] uppercase leading-none"
              style={{ color: '#00e5c7', textShadow: '0 0 8px rgba(0,229,199,0.3)',
                fontFamily: '"Courier New", monospace' }}>444 FX</span>
            <span className="text-[6px] font-bold tracking-[.2em] uppercase leading-none mt-0.5"
              style={{ color: '#1a5050', fontFamily: 'monospace' }}>{typeLabel}</span>
          </div>
        </div>
        <div className="px-3 py-1 rounded" style={{
          background: 'linear-gradient(180deg, #060a0c 0%, #081012 100%)',
          border: '1px solid #0f2222',
          boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.5)',
        }}>
          <span className="text-[9px] font-extrabold uppercase tracking-[.15em]"
            style={{ color: channel.color, fontFamily: '"Courier New", monospace' }}>{channel.name}</span>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-1 overflow-x-auto">
          {groups.map(g => (
            <GroupBadge key={g.label} label={g.label} icon={g.icon}
              isActive={activeGroup === g.label} hasActiveKnobs={g.hasActive}
              color={channel.color} onClick={() => setActiveGroup(g.label)} />
          ))}
        </div>
      </div>

      {/* Knobs area */}
      {currentGroup && (
        <div className="flex-1 overflow-y-auto px-6 pt-3 pb-4" style={{ height: panelHeight - 56 }}>
          {/* LCD Monitor */}
          <div className="flex items-center gap-4 mb-3">
            <FxLcdMonitor
              paramKey={activeParam?.key ?? null}
              paramLabel={activeParam?.key ? (FX_DESCRIPTIONS[activeParam.key] || activeParam.key) : ''}
              value={activeParam?.value ?? 0}
              min={activeParam?.min ?? 0}
              max={activeParam?.max ?? 1}
              color={channel.color}
              unit={activeParam?.unit}
              width={280}
              height={80}
            />
            <div className="flex flex-col gap-1">
              <div className="px-3 py-1 rounded-sm" style={{
                background: 'linear-gradient(180deg, #0a1015 0%, #0c1218 100%)',
                border: '1px solid #1a3030', boxShadow: 'inset 0 1px 4px rgba(0,0,0,0.6)',
              }}>
                <span className="text-[8px] font-black tracking-[.2em] uppercase"
                  style={{ color: `${channel.color}90`, fontFamily: 'monospace' }}>
                  {currentGroup.icon} {currentGroup.label}
                </span>
              </div>
              <span className="text-[7px] font-bold font-mono" style={{ color: '#1a4040' }}>
                {currentGroup.knobs.filter(k => k.existingParam).length}/{currentGroup.knobs.length} ACTIVE
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-x-2 gap-y-3 justify-start">
            {currentGroup.knobs.map(({ paramDef, existingParam, key }) => {
              const hasValue = !!existingParam
              const knobValue = existingParam ? existingParam.value : paramDef.min
              const isComplex = existingParam?.isComplex
              return (
                <HardwareKnob key={key} label={paramDef.label} value={knobValue}
                  min={paramDef.min} max={paramDef.max} step={paramDef.step}
                  size={48} color={hasValue ? channel.color : '#4a4e56'}
                  unit={paramDef.unit} isComplex={isComplex} active={hasValue}
                  paramKey={key} description={FX_DESCRIPTIONS[key]}
                  onTweakStart={handleTweakStart}
                  onTweakEnd={handleTweakEnd}
                  onRemove={hasValue ? () => onRemoveEffect(channelIdx, key) : undefined}
                  onChange={(v: number) => {
                    if (hasValue) { onParamChange(channelIdx, key, v) }
                    else { onEffectInsert(channelIdx, `.${key}(${v})`) }
                    setActiveParam(prev => prev?.key === key ? { ...prev, value: v } : prev)
                  }}
                />
              )
            })}
          </div>
        </div>
      )}

      {/* Bottom strip */}
      <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-8 py-1"
        style={{ background: 'linear-gradient(180deg, transparent 0%, rgba(0,20,20,0.2) 100%)',
          borderTop: '1px solid #0f1a1a' }}>
        <span className="text-[6px] font-bold tracking-[.3em] uppercase"
          style={{ color: '#0f2020', fontFamily: 'monospace' }}>444RADIO EFFECTS RACK</span>
        <span className="text-[6px] font-bold tracking-[.2em]" style={{ color: '#0f2020', fontFamily: 'monospace' }}>v2.0</span>
      </div>

      {/* Texture overlay */}
      <div className="absolute inset-0 pointer-events-none z-10" style={{
        backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 1px, rgba(0,200,180,0.005) 1px, rgba(0,200,180,0.005) 2px)`,
        mixBlendMode: 'overlay',
      }} />
    </div>
  )
}
