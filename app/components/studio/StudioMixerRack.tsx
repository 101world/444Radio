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
import { ChevronDown, ChevronRight, Plus, Volume2, VolumeX, Headphones, GripVertical, Link, Unlink, X, Music, Clock, Piano, Grid3X3, Copy, Trash2 } from 'lucide-react'
import StudioKnob from './StudioKnob'
import ChannelLCD from './ChannelLCD'
import {
  parseStrudelCode, updateParamInCode, insertEffectInChannel,
  swapSoundInChannel, swapBankInChannel, addSoundToChannel, renameChannel, duplicateChannel,
  addChannel, removeChannel,
  getParamDef, findNextFreeOrbit, setChannelOrbit,
  enableSidechain, disableSidechain, removeEffectFromChannel,
  parseBPM, updateBPM, parseScale, updateScale, insertScale,
  parseChannelPattern,
  parseStackRows, swapSoundInStackRow, setGainInStackRow,
  setBankInStackRow, removeSoundFromStack,
  getArpInfo, setArpMode, setArpRate, ARP_MODES,
  getTranspose, setTranspose,
  STRUDEL_SCALES, SCALE_ROOTS,
  DRAGGABLE_EFFECTS, type ParsedChannel, type StackRow,
} from '@/lib/strudel-code-parser'

// ─── Sound / Bank pick-lists for dropdown ───

// Groups that are melodic instruments (for n()/note() channels)
const INSTRUMENT_GROUPS = new Set(['Synth', 'Keys', 'Organ', 'Guitar & Bass', 'Strings', 'Brass & Sax', 'Flute & Pipe', 'Voice', 'Synth Leads', 'Synth Pads', 'SFX & Ethnic'])
// Groups that are drum/sample sounds (for s() channels)
const SOUND_GROUPS = new Set(['Drums', 'Samples', 'SFX & Ethnic'])

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
    ['gm_drawbar_organ', 'Drawbar Organ'], ['gm_percussive_organ', 'Perc. Organ'],
    ['gm_rock_organ', 'Rock Organ'], ['gm_church_organ', 'Church'],
    ['gm_accordion', 'Accordion'], ['gm_harmonica', 'GM Harmonica'],
  ]},
  { group: 'Guitar & Bass', sounds: [
    ['gm_acoustic_guitar_nylon', 'Nylon Gtr'], ['gm_acoustic_guitar_steel', 'Steel Gtr'],
    ['gm_electric_guitar_jazz', 'Jazz Gtr'], ['gm_electric_guitar_clean', 'Clean Gtr'],
    ['gm_overdriven_guitar', 'Overdrive'], ['gm_distortion_guitar', 'Distortion'],
    ['gm_acoustic_bass', 'Acoustic Bass'], ['gm_electric_bass_finger', 'Finger Bass'],
    ['gm_slap_bass_1', 'Slap Bass 1'], ['gm_slap_bass_2', 'Slap Bass 2'],
    ['gm_fretless_bass', 'Fretless Bass'],
    ['gm_synth_bass_1', 'Synth Bass 1'], ['gm_synth_bass_2', 'Synth Bass 2'],
  ]},
  { group: 'Strings', sounds: [
    ['gm_violin', 'Violin'], ['gm_viola', 'Viola'], ['gm_cello', 'Cello'],
    ['gm_contrabass', 'Contrabass'], ['gm_string_ensemble_1', 'String Ens. 1'],
    ['gm_string_ensemble_2', 'String Ens. 2'],
    ['gm_synth_strings_1', 'Synth Strings 1'], ['gm_synth_strings_2', 'Synth Strings 2'],
    ['gm_orchestral_harp', 'Harp'],
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
    ['gm_synth_choir', 'Synth Choir'], ['gm_orchestra_hit', 'Orchestra Hit'],
  ]},
  { group: 'Synth Leads', sounds: [
    ['gm_lead_1_square', 'Lead Square'], ['gm_lead_2_sawtooth', 'Lead Saw'],
    ['gm_lead_5_charang', 'Charang'], ['gm_lead_7_fifths', 'Fifths'],
    ['gm_lead_8_bass_lead', 'Bass+Lead'],
  ]},
  { group: 'Synth Pads', sounds: [
    ['gm_pad_new_age', 'New Age'], ['gm_pad_warm', 'Warm'],
    ['gm_pad_poly', 'Polysynth'], ['gm_pad_choir', 'Choir Pad'],
    ['gm_pad_halo', 'Halo'], ['gm_pad_sweep', 'Sweep'],
  ]},
  { group: 'SFX & Ethnic', sounds: [
    ['gm_fx_crystal', 'Crystal'], ['gm_fx_atmosphere', 'Atmosphere'],
    ['gm_fx_echoes', 'Echoes'], ['gm_fx_sci_fi', 'Sci-Fi'],
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
  // ── Roland ──
  ['RolandTR808', 'TR-808'],
  ['RolandTR909', 'TR-909'],
  ['RolandTR707', 'TR-707'],
  ['RolandTR606', 'TR-606'],
  ['RolandTR626', 'TR-626'],
  ['RolandTR505', 'TR-505'],
  ['RolandTR727', 'TR-727 Latin'],
  ['RolandCompurhythm78', 'CR-78'],
  ['RolandCompurhythm1000', 'CR-1000'],
  ['RolandCompurhythm8000', 'CR-8000'],
  ['RolandR8', 'R-8'],
  ['RolandD110', 'D-110'],
  ['RolandD70', 'D-70'],
  ['RolandDDR30', 'DDR-30'],
  ['RolandJD990', 'JD-990'],
  ['RolandMC202', 'MC-202'],
  ['RolandMC303', 'MC-303'],
  ['RolandMT32', 'MT-32'],
  ['RolandS50', 'S-50'],
  ['RolandSH09', 'SH-09'],
  ['RolandSystem100', 'System-100'],
  // ── Korg ──
  ['KorgDDM110', 'KorgDDM-110'],
  ['KorgKPR77', 'KPR-77'],
  ['KorgKR55', 'KR-55'],
  ['KorgKRZ', 'KR-Z'],
  ['KorgM1', 'Korg M1'],
  ['KorgMinipops', 'Minipops'],
  ['KorgPoly800', 'Poly-800'],
  ['KorgT3', 'Korg T3'],
  // ── Linn & Akai ──
  ['AkaiLinn', 'Akai/Linn'],
  ['AkaiMPC60', 'MPC60'],
  ['AkaiXR10', 'XR-10'],
  ['Linn9000', 'Linn 9000'],
  ['LinnDrum', 'LinnDrum'],
  ['LinnLM1', 'LM-1'],
  ['LinnLM2', 'LM-2'],
  ['MPC1000', 'MPC1000'],
  // ── Boss & Yamaha ──
  ['BossDR110', 'DR-110'],
  ['BossDR220', 'DR-220'],
  ['BossDR55', 'DR-55'],
  ['BossDR550', 'DR-550'],
  ['YamahaRM50', 'RM50'],
  ['YamahaRX21', 'RX21'],
  ['YamahaRX5', 'RX5'],
  ['YamahaRY30', 'RY30'],
  ['YamahaTG33', 'TG33'],
  // ── Emu & Oberheim ──
  ['EmuDrumulator', 'Drumulator'],
  ['EmuModular', 'Emu Modular'],
  ['EmuSP12', 'SP-12'],
  ['OberheimDMX', 'DMX'],
  // ── More Machines ──
  ['AJKPercusyn', 'Percusyn'],
  ['AlesisHR16', 'HR-16'],
  ['AlesisSR16', 'SR-16'],
  ['CasioRZ1', 'Casio RZ-1'],
  ['CasioSK1', 'Casio SK-1'],
  ['CasioVL1', 'Casio VL-1'],
  ['DoepferMS404', 'MS-404'],
  ['MFB512', 'MFB-512'],
  ['MoogConcertMateMG1', 'Moog MG-1'],
  ['RhodesPolaris', 'Polaris'],
  ['RhythmAce', 'Rhythm Ace'],
  ['SakataDPM48', 'DPM-48'],
  ['SequentialCircuitsDrumtracks', 'Drumtraks'],
  ['SequentialCircuitsTom', 'SCI Tom'],
  ['SergeModular', 'Serge Mod.'],
  ['SimmonsSDS400', 'SDS-400'],
  ['SimmonsSDS5', 'SDS-5'],
  ['SoundmastersR88', 'SR-88'],
  ['UnivoxMicroRhythmer12', 'MicroRhythmer'],
  ['ViscoSpaceDrum', 'Space Drum'],
  ['XdrumLM8953', 'LM8953'],
  // ── Wavetable ──
  ['wt_digital', 'WT Digital'],
  ['wt_digital_bad_day', 'WT Bad Day'],
  ['wt_digital_basique', 'WT Basique'],
  ['wt_digital_crickets', 'WT Crickets'],
  ['wt_digital_curses', 'WT Curses'],
  ['wt_digital_echoes', 'WT Echoes'],
  ['wt_vgame', 'WT Video Game'],
]

// ─── Quick-add presets for Add Channel menu ───

const ADD_CHANNEL_PRESETS: { section: string; type: 'synth' | 'sample'; items: [string, string][] }[] = [
  { section: '🎹 Instruments', type: 'synth', items: [
    ['sawtooth', 'Sawtooth'], ['supersaw', 'Supersaw'], ['sine', 'Sine'],
    ['square', 'Square'], ['triangle', 'Triangle'],
    ['gm_piano', 'Piano'], ['gm_epiano1', 'E.Piano'],
    ['gm_violin', 'Violin'], ['gm_trumpet', 'Trumpet'],
    ['gm_flute', 'Flute'], ['gm_alto_sax', 'Alto Sax'],
    ['gm_acoustic_bass', 'Ac. Bass'], ['gm_synth_bass_1', 'Synth Bass'],
  ]},
  { section: '🥁 Drums', type: 'sample', items: [
    ['bd', 'Kick'], ['sd', 'Snare'], ['cp', 'Clap'], ['hh', 'Hi-hat'],
    ['oh', 'Open HH'], ['rim', 'Rim'], ['tom', 'Tom'], ['ride', 'Ride'],
    ['crash', 'Crash'], ['perc', 'Perc'],
  ]},
  { section: '🎵 Samples', type: 'sample', items: [
    ['casio', 'Casio'], ['jazz', 'Jazz Kit'], ['gabba', 'Gabba'],
    ['metal', 'Metal'], ['mouth', 'Mouth'], ['space', 'Space'],
  ]},
]

// ─── Effect category grouping for nested rack display ───

const FX_GROUPS: { label: string; icon: string; keys: string[] }[] = [
  { label: 'FILTER', icon: '🔽', keys: ['lpf', 'lp', 'hpf', 'hp', 'lpq', 'lpenv', 'lps', 'lpd'] },
  { label: 'DRIVE',  icon: '🔥', keys: ['shape', 'distort', 'crush'] },
  { label: 'SPACE',  icon: '🌌', keys: ['room', 'delay', 'delayfeedback', 'delaytime'] },
  { label: 'MOD',    icon: '🎵', keys: ['detune', 'speed', 'pan', 'velocity', 'postgain'] },
  { label: 'ENV',    icon: '⏳', keys: ['attack', 'decay', 'rel', 'release', 'legato', 'clip'] },
]

// ─── Draggable Effect Badge ───

function EffectBadge({ effect }: { effect: typeof DRAGGABLE_EFFECTS[number] }) {
  const targetIcon = effect.target === 'instrument' ? '🎹' : effect.target === 'sound' ? '🥁' : ''
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('application/x-strudel-fx', JSON.stringify(effect))
        e.dataTransfer.effectAllowed = 'copy'
      }}
      className="flex items-center gap-1.5 px-2 py-1 cursor-grab active:cursor-grabbing
        transition-all text-[8px] select-none shrink-0 hover:scale-105 duration-[180ms]"
      style={{
        background: '#2a2e34',
        border: '1px solid rgba(255,255,255,0.04)',
        borderRadius: '12px',
        boxShadow: '3px 3px 6px #14161a, -3px -3px 6px #2c3036',
      }}
      title={`Drag onto a channel to add ${effect.label}${effect.target !== 'both' ? ` (${effect.target} only)` : ''}`}
    >
      <span className="text-[9px]">{effect.icon}</span>
      <span className="font-bold uppercase tracking-wide" style={{ color: '#9aa7b3' }}>{effect.label}</span>
      {targetIcon && <span className="text-[7px] opacity-40">{targetIcon}</span>}
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
  isPlaying,
  onToggle,
  onParamChange,
  onMute,
  onSolo,
  onSoundChange,
  onBankChange,
  onDragOver,
  onDragLeave,
  onDrop,
  // Sidechain routing
  sidechainInfo,
  onEnableSidechain,
  onDisableSidechain,
  onAddSidechainTarget,
  onRemoveSidechainTarget,
  onDisconnectSidechain,
  onOpenPianoRoll,
  onOpenDrumSequencer,
  onRename,
  onDuplicate,
  onDelete,
  onStackRowSoundChange,
  onStackRowGainChange,
  onStackRowBankChange,
  onRemoveStackRow,
  onRemoveEffect,
  onArpChange,
  onArpRateChange,
  onTranspose,
  onAddSound,
  onPreview,
  stackRows,
}: {
  channel: ParsedChannel
  channelIdx: number
  isExpanded: boolean
  isMuted: boolean
  isSoloed: boolean
  isDragOver: boolean
  isPlaying: boolean
  onToggle: () => void
  onParamChange: (channelIdx: number, paramKey: string, value: number) => void
  onMute: (idx: number) => void
  onSolo: (idx: number, exclusive: boolean) => void
  onSoundChange: (idx: number, sound: string) => void
  onBankChange: (idx: number, bank: string) => void
  onDragOver: (e: React.DragEvent) => void
  onDragLeave: () => void
  onDrop: (e: React.DragEvent) => void
  // Sidechain routing
  sidechainInfo: {
    isSource: boolean
    duckTargetOrbit: number | null
    targetChannels: { idx: number; name: string; color: string; icon: string }[]
    isDucked: boolean
    duckedBySource: { name: string; color: string; orbit: number } | null
    isKickLike: boolean
    availableTargets: { idx: number; name: string }[]
    hasDuckParams: boolean
  }
  onEnableSidechain: () => void
  onDisableSidechain: () => void
  onAddSidechainTarget: (targetIdx: number) => void
  onRemoveSidechainTarget: (targetIdx: number) => void
  onDisconnectSidechain: () => void
  onOpenPianoRoll?: () => void
  onOpenDrumSequencer?: () => void
  onRename: (channelIdx: number, newName: string) => void
  onDuplicate?: (channelIdx: number) => void
  onDelete?: (channelIdx: number) => void
  onStackRowSoundChange?: (channelIdx: number, rowIdx: number, newSound: string) => void
  onStackRowGainChange?: (channelIdx: number, rowIdx: number, newGain: number) => void
  onStackRowBankChange?: (channelIdx: number, rowIdx: number, newBank: string) => void
  onRemoveStackRow?: (channelIdx: number, rowIdx: number) => void
  onRemoveEffect?: (channelIdx: number, effectKey: string) => void
  onArpChange?: (channelIdx: number, mode: string) => void
  onArpRateChange?: (channelIdx: number, rate: number) => void
  onTranspose?: (channelIdx: number, semitones: number) => void
  onAddSound?: (channelIdx: number, sound: string) => void
  onPreview?: (soundCode: string) => void
  stackRows: StackRow[]
}) {
  const gainParam = channel.params.find(p => p.key === 'gain')
  const [isRenaming, setIsRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState(channel.name)
  const renameInputRef = useRef<HTMLInputElement>(null)

  // All effect params (everything except gain, orbit, duck routing)
  const effectKnobs = useMemo(() => {
    const skipKeys = new Set(['gain', 'orbit', 'duck'])
    return channel.params.filter(p => !skipKeys.has(p.key))
  }, [channel])

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

  // Determine if this node is actively producing sound
  const isActiveNode = isPlaying && !isMuted

  return (
    <div
      className={`rounded-xl overflow-hidden transition-all duration-[180ms] ease-in-out ${isMuted ? 'opacity-30' : ''}`}
      style={{
        gridColumn: isExpanded ? 'span 2' : undefined,
        background: '#23262b',
        border: isDragOver
          ? '1px solid rgba(127,169,152,0.25)'
          : isActiveNode
            ? `1px solid ${channel.color}40`
            : '1px solid rgba(255,255,255,0.04)',
        boxShadow: isDragOver
          ? '6px 6px 12px #14161a, -6px -6px 12px #2c3036, inset 0 0 0 1px rgba(127,169,152,0.1)'
          : isActiveNode
            ? `4px 4px 8px #14161a, -4px -4px 8px #2c3036, 0 0 12px ${channel.color}20, 0 0 4px ${channel.color}15`
            : isExpanded
              ? '8px 8px 16px #14161a, -8px -8px 16px #2c3036'
              : '4px 4px 8px #14161a, -4px -4px 8px #2c3036',
      }}
      onDragOver={(e) => e.preventDefault()}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeaveLocal}
      onDrop={handleDropLocal}
    >
      {/* ── Color bar / LED strip at top ── */}
      <div
        className="h-[2px] rounded-t-2xl transition-all duration-300"
        style={{
          background: channel.color,
          opacity: isMuted ? 0.15 : isActiveNode ? 0.8 : 0.4,
          boxShadow: isActiveNode ? `0 0 6px ${channel.color}60` : 'none',
        }}
      />

      {/* ── Compact header: S M · Name ── */}
      <div className="flex items-center gap-1 px-1.5 pt-1.5 pb-0.5">
        {/* Solo */}
        <button
          onClick={(e) => { e.stopPropagation(); onSolo(channelIdx, !e.ctrlKey && !e.shiftKey) }}
          className="cursor-pointer transition-all duration-100 active:scale-90"
          style={{
            width: 14, height: 14, borderRadius: 7,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '6px', fontWeight: 900, lineHeight: 1,
            color: isSoloed ? '#b8a47f' : '#5a616b',
            background: isSoloed ? '#2a2e34' : '#1c1e22',
            border: 'none',
            boxShadow: isSoloed
              ? 'inset 2px 2px 4px #14161a, inset -2px -2px 4px #2c3036'
              : '2px 2px 4px #14161a, -2px -2px 4px #2c3036',
          }}
          title="Solo (Ctrl+click for multi)"
        >S</button>

        {/* Mute */}
        <button
          onClick={(e) => { e.stopPropagation(); onMute(channelIdx) }}
          className="cursor-pointer transition-all duration-[180ms] active:scale-90"
          style={{
            width: 14, height: 14, borderRadius: 7,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '6px', fontWeight: 900, lineHeight: 1,
            color: isMuted ? '#b86f6f' : '#5a616b',
            background: isMuted ? '#2a2e34' : '#1c1e22',
            border: 'none',
            boxShadow: isMuted
              ? 'inset 2px 2px 4px #14161a, inset -2px -2px 4px #2c3036'
              : '2px 2px 4px #14161a, -2px -2px 4px #2c3036',
          }}
          title="Mute"
        >M</button>

        {/* Channel name — click to expand, double-click to rename */}
        {isRenaming ? (
          <input
            ref={renameInputRef}
            autoFocus
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value.replace(/[^\w]/g, '').toLowerCase().slice(0, 12))}
            onBlur={() => {
              if (renameValue.trim() && renameValue !== channel.name) {
                onRename(channelIdx, renameValue)
              }
              setIsRenaming(false)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.currentTarget.blur()
              } else if (e.key === 'Escape') {
                setRenameValue(channel.name)
                setIsRenaming(false)
              }
            }}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 min-w-0 text-[7px] font-extrabold uppercase tracking-[.1em] outline-none font-mono"
            style={{
              color: `${channel.color}cc`,
              background: 'rgba(255,255,255,0.06)',
              border: `1px solid ${channel.color}40`,
              borderRadius: 3,
              padding: '1px 4px',
              caretColor: channel.color,
              maxWidth: '80px',
            }}
            maxLength={12}
            spellCheck={false}
          />
        ) : (
          <button
            onClick={onToggle}
            onDoubleClick={(e) => {
              e.stopPropagation()
              setRenameValue(channel.name)
              setIsRenaming(true)
            }}
            className="flex-1 min-w-0 flex items-center gap-1 cursor-pointer hover:opacity-80 transition-opacity"
            title="Click to expand · Double-click to rename"
          >
            <span
              className="text-[7px] font-extrabold uppercase tracking-[.1em] truncate"
              style={{ color: `${channel.color}aa` }}
            >
              {channel.name}
            </span>
            {sidechainInfo.isSource && <span className="text-[5px]" style={{ color: '#7fa998', opacity: 0.6 }}>SC</span>}
            {sidechainInfo.isDucked && <span className="text-[5px]">🦆</span>}
          </button>
        )}

        {/* Expand chevron */}
        <button onClick={onToggle} className="cursor-pointer p-0.5 rounded hover:bg-white/5 transition-colors shrink-0">
          {isExpanded
            ? <ChevronDown size={8} />
            : <ChevronRight size={8} />
          }
        </button>
      </div>

      {/* ── Gain knob — centered ── */}
      <div className="flex justify-center py-0.5" onClick={(e) => e.stopPropagation()}>
        <StudioKnob
          label="GAIN"
          value={gainParam?.value ?? 0.8}
          min={0}
          max={2}
          step={0.01}
          size={30}
          color={channel.color}
          isComplex={gainParam?.isComplex}
          onChange={(v) => onParamChange(channelIdx, 'gain', v)}
        />
      </div>

      {/* ── Transpose: [-12] knob [+12] — only for instrument channels ── */}
      {(channel.sourceType === 'synth' || channel.sourceType === 'note') && (() => {
        const currentTranspose = getTranspose(channel.rawCode)
        return (
          <div className="flex items-center justify-center gap-0.5 py-0.5 px-1" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => onTranspose?.(channelIdx, currentTranspose - 12)}
              className="cursor-pointer transition-all duration-100 active:scale-90"
              style={{
                width: 16, height: 14, borderRadius: 5,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '5px', fontWeight: 900, lineHeight: 1,
                color: '#6f8fb3', background: '#1c1e22', border: 'none',
                boxShadow: '2px 2px 4px #14161a, -2px -2px 4px #2c3036',
              }}
              title="-1 octave"
            >−12</button>
            <StudioKnob
              label="TRANS"
              value={currentTranspose}
              min={-24}
              max={24}
              step={1}
              size={24}
              color="#6f8fb3"
              formatValue={(v) => (v > 0 ? `+${v}` : `${v}`)}
              onChange={(v) => onTranspose?.(channelIdx, v)}
            />
            <button
              onClick={() => onTranspose?.(channelIdx, currentTranspose + 12)}
              className="cursor-pointer transition-all duration-100 active:scale-90"
              style={{
                width: 16, height: 14, borderRadius: 5,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '5px', fontWeight: 900, lineHeight: 1,
                color: '#6f8fb3', background: '#1c1e22', border: 'none',
                boxShadow: '2px 2px 4px #14161a, -2px -2px 4px #2c3036',
              }}
              title="+1 octave"
            >+12</button>
          </div>
        )
      })()}

      {/* ── Mini LCD visualizer ── */}
      <ChannelLCD
        channel={channel}
        isPlaying={isPlaying}
        isMuted={isMuted}
      />

      {/* ── Active effect tags — removable pills ── */}
      {channel.effects.length > 0 && (
        <div className="flex flex-wrap gap-[2px] px-1.5 py-0.5" onClick={(e) => e.stopPropagation()}>
          {channel.effects
            .filter(fx => !['scope', 'pianoroll', 'orbit', 'gain'].includes(fx))
            .map(fx => {
              const isArp = fx === 'arp' || fx === 'arpeggiate'
              const tagColor = isArp ? '#b8a47f' : channel.color
              return (
                <span
                  key={fx}
                  className="inline-flex items-center gap-[2px] rounded-full transition-all duration-100 group/tag"
                  style={{
                    padding: '0px 4px 0px 5px',
                    fontSize: '5px',
                    fontWeight: 800,
                    letterSpacing: '.06em',
                    textTransform: 'uppercase',
                    color: tagColor,
                    background: `${tagColor}12`,
                    border: `1px solid ${tagColor}25`,
                  }}
                >
                  {fx}
                  {onRemoveEffect && (
                    <button
                      onClick={() => onRemoveEffect(channelIdx, fx)}
                      className="cursor-pointer opacity-0 group-hover/tag:opacity-100 transition-opacity duration-100 hover:text-red-400"
                      style={{
                        fontSize: '6px',
                        lineHeight: 1,
                        padding: '0 1px',
                        background: 'none',
                        border: 'none',
                        color: 'inherit',
                      }}
                      title={`Remove .${fx}()`}
                    >
                      ×
                    </button>
                  )}
                </span>
              )
            })}
        </div>
      )}

      {/* ── Effect knobs — tight grid ── */}
      {effectKnobs.length > 0 && (
        <div
          className="mx-1 mb-1 px-1 py-1 rounded-xl"
          style={{ background: '#1c1e22', boxShadow: 'inset 2px 2px 4px #14161a, inset -2px -2px 4px #2c3036' }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex flex-wrap gap-px justify-center">
            {effectKnobs.map((param) => {
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
                  size={24}
                  color={channel.color}
                  unit={def.unit}
                  isComplex={param.isComplex}
                  onChange={(v) => onParamChange(channelIdx, param.key, v)}
                  onRemove={onRemoveEffect ? () => onRemoveEffect(channelIdx, param.key) : undefined}
                />
              )
            })}
          </div>
        </div>
      )}

      {/* ── Action icons row ── */}
      <div className="flex items-center justify-center gap-1 px-1 pb-1.5">
        {/* Piano Roll — only for instrument channels (synth/note) */}
        {onOpenPianoRoll && (channel.sourceType === 'synth' || channel.sourceType === 'note') && (
          <button
            onClick={(e) => { e.stopPropagation(); onOpenPianoRoll() }}
            className="p-1 rounded-lg transition-colors cursor-pointer"
            style={{ color: '#6f8fb3', opacity: 0.4 }}
            title="Piano Roll"
          >
            <Piano size={9} />
          </button>
        )}
        {/* Drum Sequencer — only for sound/sample channels (sample/stack) */}
        {onOpenDrumSequencer && (channel.sourceType === 'sample' || channel.sourceType === 'stack') && (
          <button
            onClick={(e) => { e.stopPropagation(); onOpenDrumSequencer() }}
            className="p-1 rounded-lg transition-colors cursor-pointer"
            style={{ color: '#b8a47f', opacity: 0.4 }}
            title="Drum Sequencer"
          >
            <Grid3X3 size={9} />
          </button>
        )}
        {onDuplicate && (
          <button
            onClick={(e) => { e.stopPropagation(); onDuplicate(channelIdx) }}
            className="p-1 rounded-lg transition-colors cursor-pointer hover:opacity-80"
            style={{ color: '#7fa998', opacity: 0.4 }}
            title="Duplicate Channel"
          >
            <Copy size={9} />
          </button>
        )}
        {onDelete && (
          <button
            onClick={(e) => { e.stopPropagation(); if (confirm('Delete this channel?')) onDelete(channelIdx) }}
            className="p-1 rounded-lg transition-colors cursor-pointer hover:opacity-100"
            style={{ color: '#b86f6f', opacity: 0.3 }}
            title="Delete Channel"
          >
            <Trash2 size={9} />
          </button>
        )}
        {effectKnobs.length > 0 && (
          <span className="text-[5px] font-bold px-1 py-0.5 rounded" style={{ color: `${channel.color}50` }}>
            {effectKnobs.length}fx
          </span>
        )}
      </div>

      {/* ── Drop indicator ── */}
      {isDragOver && (
        <div className="px-1.5 py-1 text-[6px] text-center font-mono font-bold" style={{ color: '#7fa998' }}>
          ⬇ DROP FX
        </div>
      )}

      {/* ── Expanded detail panel (inline, spans card width) ── */}
      {isExpanded && (
        <div style={{ borderTop: `1px solid rgba(255,255,255,0.04)`, background: '#1c1e22' }} className="rounded-b-2xl">
          {/* Stack per-row controls */}
          {channel.sourceType === 'stack' && stackRows.length > 0 && (
            <div className="px-2 py-1.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[6px] font-black uppercase tracking-[.15em]" style={{ color: '#5a616b' }}>STACK SOUNDS</span>
                {onAddSound && (
                  <select
                    value=""
                    onChange={(e) => { if (e.target.value) onAddSound(channelIdx, e.target.value) }}
                    className="text-[6px] font-mono rounded px-1 py-0 outline-none cursor-pointer"
                    style={{ color: '#7fa998', background: '#1c1e22', border: '1px solid rgba(127,169,152,0.2)', borderRadius: '6px', maxWidth: '60px' }}
                    title="Add another sound to stack"
                  >
                    <option value="">+ ADD</option>
                    {SOUND_OPTIONS.filter(g => SOUND_GROUPS.has(g.group)).map(g => (
                      <optgroup key={g.group} label={g.group}>
                        {g.sounds.map(([val, label]) => (
                          <option key={val} value={val}>{label}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                )}
              </div>
              {stackRows.map((row, ri) => (
                <div key={ri} className="flex flex-col gap-0.5 py-0.5 mb-1" style={{ borderBottom: ri < stackRows.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none' }}>
                  <div className="flex items-center gap-1">
                    <select
                      value={row.instrument}
                      onChange={(e) => onStackRowSoundChange?.(channelIdx, ri, e.target.value)}
                      className="text-[7px] font-mono rounded px-1 py-0.5 outline-none cursor-pointer flex-1 min-w-0"
                      style={{ color: '#c8cdd2', background: '#23262b', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px' }}
                      title={`Sound for row ${ri + 1}`}
                    >
                      <option value={row.instrument}>{row.instrument}</option>
                      {SOUND_OPTIONS.filter(g => SOUND_GROUPS.has(g.group)).map(g => (
                        <optgroup key={g.group} label={g.group}>
                          {g.sounds.filter(([val]) => val !== row.instrument).map(([val, label]) => (
                            <option key={val} value={val}>{label}</option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                    {onPreview && (
                      <button
                        onClick={() => onPreview(`s("${row.instrument}")`)}
                        className="shrink-0 rounded-md p-0.5 transition-all cursor-pointer hover:opacity-100"
                        style={{ color: '#7fa998', opacity: 0.4, background: 'transparent' }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(127,169,152,0.12)'; e.currentTarget.style.opacity = '0.9' }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.opacity = '0.4' }}
                        title={`Preview ${row.instrument}`}
                      >
                        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
                      </button>
                    )}
                    <StudioKnob
                      label="G"
                      value={row.gain}
                      min={0}
                      max={1.5}
                      step={0.01}
                      size={20}
                      color={channel.color}
                      onChange={(v) => onStackRowGainChange?.(channelIdx, ri, v)}
                    />
                    {stackRows.length > 1 && onRemoveStackRow && (
                      <button
                        onClick={() => onRemoveStackRow(channelIdx, ri)}
                        className="cursor-pointer transition-all duration-100 hover:text-red-400 active:scale-90"
                        style={{ color: '#5a616b', fontSize: '8px', lineHeight: 1, padding: '2px', background: 'none', border: 'none' }}
                        title="Remove sound from stack"
                      >×</button>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <select
                      value={row.bank || ''}
                      onChange={(e) => onStackRowBankChange?.(channelIdx, ri, e.target.value)}
                      className="text-[6px] font-mono rounded px-1 py-0 outline-none cursor-pointer flex-1 min-w-0"
                      style={{ color: '#b8a47f', background: '#1e2025', border: '1px solid rgba(184,164,127,0.1)', borderRadius: '6px' }}
                      title={`Bank for ${row.instrument}`}
                    >
                      <option value="">{row.bank || 'No Bank'}</option>
                      {BANK_OPTIONS.filter(([val]) => val !== row.bank).map(([val, label]) => (
                        <option key={val} value={val}>{label}</option>
                      ))}
                    </select>
                    {onPreview && row.bank && (
                      <button
                        onClick={() => onPreview(`.bank("${row.bank}")`)}
                        className="shrink-0 rounded-md p-0.5 transition-all cursor-pointer hover:opacity-100"
                        style={{ color: '#b8a47f', opacity: 0.4, background: 'transparent' }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(184,164,127,0.12)'; e.currentTarget.style.opacity = '0.9' }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.opacity = '0.4' }}
                        title={`Preview ${row.bank}`}
                      >
                        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          {/* Sound / Bank selectors — hidden for stacks (managed per-row above) */}
          {channel.sourceType !== 'stack' && (channel.isSimpleSource || channel.bank || channel.sourceType === 'sample' || channel.sourceType === 'synth') && (
            <div className="flex flex-col gap-1 px-2 py-1.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
              <div className="flex items-center justify-between">
                <span className="text-[6px] font-black uppercase tracking-[.15em]" style={{ color: '#5a616b' }}>
                  {(channel.sourceType === 'synth' || channel.sourceType === 'note') ? 'INSTRUMENT' : 'SOUND'}
                </span>
                {/* + ADD only for sound/sample channels (creates a stack) */}
                {channel.sourceType === 'sample' && channel.isSimpleSource && onAddSound && (
                  <select
                    value=""
                    onChange={(e) => { if (e.target.value) onAddSound(channelIdx, e.target.value) }}
                    className="text-[6px] font-mono rounded px-1 py-0 outline-none cursor-pointer"
                    style={{ color: '#7fa998', background: '#1c1e22', border: '1px solid rgba(127,169,152,0.2)', borderRadius: '6px', maxWidth: '60px' }}
                    title="Add another sound (creates stack)"
                  >
                    <option value="">+ ADD</option>
                    {SOUND_OPTIONS.filter(g => SOUND_GROUPS.has(g.group)).map(g => (
                      <optgroup key={g.group} label={g.group}>
                        {g.sounds.map(([val, label]) => (
                          <option key={val} value={val}>{label}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                )}
              </div>
              {channel.isSimpleSource ? (
                <div className="flex items-center gap-1">
                  <select
                    value={channel.source}
                    onChange={(e) => onSoundChange(channelIdx, e.target.value)}
                    className="text-[7px] font-mono rounded px-1 py-0.5 outline-none cursor-pointer flex-1 min-w-0"
                    style={{ color: '#c8cdd2', background: '#23262b', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px' }}
                    title="Sound"
                  >
                    <option value={channel.source}>{channel.source}</option>
                    {SOUND_OPTIONS
                      .filter(g => (channel.sourceType === 'synth' || channel.sourceType === 'note')
                        ? INSTRUMENT_GROUPS.has(g.group)
                        : SOUND_GROUPS.has(g.group))
                      .map(g => (
                      <optgroup key={g.group} label={g.group}>
                        {g.sounds.filter(([val]) => val !== channel.source).map(([val, label]) => (
                          <option key={val} value={val}>{label}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  {onPreview && (
                    <button
                      onClick={() => onPreview(`s("${channel.source}")`)}
                      className="shrink-0 rounded-md p-0.5 transition-all cursor-pointer hover:opacity-100"
                      style={{ color: '#7fa998', opacity: 0.5, background: 'transparent' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(127,169,152,0.12)' }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                      title={`Preview ${channel.source}`}
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
                    </button>
                  )}
                </div>
              ) : (
                <span className="text-[6px] text-white/20 font-mono truncate">{channel.source}</span>
              )}
              {/* Bank selector — only for sound/sample channels (drum machines) */}
              {channel.sourceType !== 'synth' && channel.sourceType !== 'note' && (
                <div className="flex items-center gap-1">
                  <select
                    value={channel.bank || ''}
                    onChange={(e) => onBankChange(channelIdx, e.target.value)}
                    className="text-[7px] font-mono rounded px-1 py-0.5 outline-none cursor-pointer flex-1 min-w-0"
                    style={{ color: '#b8a47f', background: '#23262b', border: '1px solid rgba(184,164,127,0.12)', borderRadius: '8px' }}
                    title="Bank"
                  >
                    <option value="">{channel.bank || 'No Bank'}</option>
                    {BANK_OPTIONS.filter(([val]) => val !== channel.bank).map(([val, label]) => (
                      <option key={val} value={val}>{label}</option>
                    ))}
                  </select>
                  {onPreview && channel.bank && (
                    <button
                      onClick={() => onPreview(`.bank("${channel.bank}")`)}
                      className="shrink-0 rounded-md p-0.5 transition-all cursor-pointer hover:opacity-100"
                      style={{ color: '#b8a47f', opacity: 0.5, background: 'transparent' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(184,164,127,0.12)' }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                      title={`Preview ${channel.bank}`}
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* FX Group racks */}
          {fxGroups.map((group) => (
            <div key={group.label} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }} className="last:border-b-0">
              <div className="flex items-center gap-1 px-2 py-1">
                <span className="text-[7px]">{group.icon}</span>
                <span className="text-[6px] font-bold uppercase tracking-[.12em]" style={{ color: '#5a616b' }}>{group.label}</span>
                <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.03)' }} />
              </div>
              <div className="flex flex-wrap gap-0.5 px-1.5 pb-2 justify-center">
                {group.params.map((param) => {
                  const def = getParamDef(param.key)
                  if (!def) return null
                  return (
                    <StudioKnob key={param.key} label={def.label} value={param.value} min={def.min} max={def.max} step={def.step} size={26} color={channel.color} unit={def.unit} isComplex={param.isComplex} onChange={(v) => onParamChange(channelIdx, param.key, v)} onRemove={onRemoveEffect ? () => onRemoveEffect(channelIdx, param.key) : undefined} />
                  )
                })}
              </div>
            </div>
          ))}

          {/* ── ARP section ── */}
          {(() => {
            const arpInfo = getArpInfo(channel.rawCode)
            const isActive = arpInfo.mode !== 'off'
            return (
              <div style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                <div className="flex items-center gap-1 px-2 py-1">
                  <span className="text-[7px]">🎹</span>
                  <span className="text-[6px] font-bold uppercase tracking-[.12em]" style={{ color: isActive ? '#b8a47f' : '#5a616b' }}>ARP</span>
                  <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.03)' }} />
                  {isActive && <span className="text-[5px] font-bold" style={{ color: '#b8a47f' }}>{arpInfo.mode.toUpperCase()} ×{arpInfo.rate}</span>}
                </div>
                <div className="flex flex-wrap gap-0.5 px-1.5 pb-1 justify-center" onClick={(e) => e.stopPropagation()}>
                  {ARP_MODES.map(mode => (
                    <button
                      key={mode.id}
                      onClick={() => onArpChange?.(channelIdx, mode.id)}
                      className="cursor-pointer transition-all duration-100 active:scale-90"
                      style={{
                        width: 20, height: 16, borderRadius: 6,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '7px', fontWeight: 900, lineHeight: 1,
                        color: arpInfo.mode === mode.id ? '#b8a47f' : '#5a616b',
                        background: arpInfo.mode === mode.id ? '#2a2e34' : '#1c1e22',
                        border: 'none',
                        boxShadow: arpInfo.mode === mode.id
                          ? 'inset 2px 2px 4px #14161a, inset -2px -2px 4px #2c3036'
                          : '2px 2px 4px #14161a, -2px -2px 4px #2c3036',
                      }}
                      title={`Arp: ${mode.label}`}
                    >
                      {mode.icon}
                    </button>
                  ))}
                </div>
                {isActive && (
                  <div className="flex justify-center pb-2" onClick={(e) => e.stopPropagation()}>
                    <StudioKnob
                      label="RATE"
                      value={arpInfo.rate}
                      min={1}
                      max={8}
                      step={1}
                      size={26}
                      color="#b8a47f"
                      formatValue={(v) => `×${v}`}
                      onChange={(v) => onArpRateChange?.(channelIdx, v)}
                    />
                  </div>
                )}
              </div>
            )
          })()}

          {/* Sidechain source section */}
          {(sidechainInfo.isSource || sidechainInfo.isKickLike || sidechainInfo.hasDuckParams) && (
            <div style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
              <div className="flex items-center gap-1 px-2 py-1">
                <Link size={7} style={{ color: '#7fa998', opacity: 0.5 }} />
                <span className="text-[6px] font-bold uppercase tracking-[.12em]" style={{ color: '#7fa998', opacity: 0.5 }}>SIDECHAIN</span>
                <div className="flex-1 h-px" style={{ background: 'rgba(127,169,152,0.08)' }} />
              </div>
              {!sidechainInfo.isSource && !sidechainInfo.hasDuckParams && (
                <div className="px-2 pb-1.5">
                  <button
                    onClick={(e) => { e.stopPropagation(); onEnableSidechain() }}
                    className="w-full flex items-center justify-center gap-1 px-1.5 py-1 rounded-lg transition-all text-[6px] font-bold uppercase tracking-wider cursor-pointer"
                    style={{ background: '#23262b', color: '#7fa998', boxShadow: '2px 2px 4px #14161a, -2px -2px 4px #2c3036' }}
                  >
                    <Link size={6} /> Enable
                  </button>
                </div>
              )}
              {sidechainInfo.isSource && (
                <div className="px-2 pb-1.5 space-y-1">
                  {sidechainInfo.targetChannels.length > 0 ? (
                    <div className="space-y-0.5">
                      {sidechainInfo.targetChannels.map((t) => (
                        <div key={t.idx} className="flex items-center gap-1 px-1 py-0.5 rounded text-[6px] bg-white/[0.02] border border-white/[0.04]">
                          <span style={{ color: t.color }} className="font-bold uppercase truncate flex-1">{t.name}</span>
                          <button onClick={(e) => { e.stopPropagation(); onRemoveSidechainTarget(t.idx) }} className="text-white/15 hover:text-red-400/60 cursor-pointer"><X size={7} /></button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-[6px] text-white/15 italic px-1">No targets</div>
                  )}
                  {sidechainInfo.availableTargets.length > 0 && (
                    <select value="" onChange={(e) => { if (e.target.value) onAddSidechainTarget(parseInt(e.target.value)) }} onClick={(e) => e.stopPropagation()} className="w-full text-[6px] font-mono rounded-lg px-1 py-0.5 outline-none cursor-pointer" style={{ background: '#23262b', color: '#7fa998', border: '1px solid rgba(127,169,152,0.12)' }}>
                      <option value="">+ Target…</option>
                      {sidechainInfo.availableTargets.map((t) => <option key={t.idx} value={t.idx}>{t.name}</option>)}
                    </select>
                  )}
                  {channel.params.some(p => p.key === 'duckdepth' || p.key === 'duckattack') && (
                    <div className="flex flex-wrap gap-0.5 justify-center pt-0.5">
                      {channel.params.filter(p => p.key === 'duckdepth' || p.key === 'duckattack').map((param) => {
                        const def = getParamDef(param.key); if (!def) return null
                        return <StudioKnob key={param.key} label={def.label} value={param.value} min={def.min} max={def.max} step={def.step} size={26} color="#fb923c" unit={def.unit} isComplex={param.isComplex} onChange={(v) => onParamChange(channelIdx, param.key, v)} onRemove={onRemoveEffect ? () => onRemoveEffect(channelIdx, param.key) : undefined} />
                      })}
                    </div>
                  )}
                  <button onClick={(e) => { e.stopPropagation(); onDisableSidechain() }} className="w-full flex items-center justify-center gap-1 px-1 py-0.5 rounded-lg transition-all text-[6px] font-bold uppercase cursor-pointer" style={{ background: '#23262b', color: '#b86f6f', boxShadow: '2px 2px 4px #14161a, -2px -2px 4px #2c3036' }}>
                    <Unlink size={6} /> Remove
                  </button>
                </div>
              )}
              {!sidechainInfo.isSource && sidechainInfo.hasDuckParams && (
                <div className="px-2 pb-1.5">
                  <div className="flex flex-wrap gap-0.5 justify-center">
                    {channel.params.filter(p => p.key === 'duckdepth' || p.key === 'duckattack').map((param) => {
                      const def = getParamDef(param.key); if (!def) return null
                      return <StudioKnob key={param.key} label={def.label} value={param.value} min={def.min} max={def.max} step={def.step} size={26} color="#fb923c" unit={def.unit} isComplex={param.isComplex} onChange={(v) => onParamChange(channelIdx, param.key, v)} onRemove={onRemoveEffect ? () => onRemoveEffect(channelIdx, param.key) : undefined} />
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Ducked by indicator */}
          {sidechainInfo.isDucked && sidechainInfo.duckedBySource && (
            <div className="flex items-center gap-1 px-2 py-1" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
              <span className="text-[6px]">🦆</span>
              <span className="text-[6px] font-bold uppercase" style={{ color: sidechainInfo.duckedBySource.color }}>{sidechainInfo.duckedBySource.name}</span>
              <button onClick={(e) => { e.stopPropagation(); onDisconnectSidechain() }} className="ml-auto text-white/15 hover:text-red-400/60 cursor-pointer"><X size={7} /></button>
            </div>
          )}

          {/* Orbit */}
          {channel.params.find(p => p.key === 'orbit') && (
            <div className="flex items-center gap-1 px-2 py-1">
              <span className="text-[6px]">🔀</span>
              <span className="text-[6px] text-white/15 font-mono">ORB {channel.params.find(p => p.key === 'orbit')?.value}</span>
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
  onLiveCodeChange?: (code: string) => void  // updates text + re-evaluates immediately
  onMixerStateChange?: (state: { muted: Set<number>; soloed: Set<number> }) => void
  metronomeEnabled?: boolean
  onMetronomeToggle?: (enabled: boolean) => void
  onOpenPianoRoll?: (channelIdx: number) => void
  onOpenDrumSequencer?: (channelIdx: number) => void
  isPlaying?: boolean
  onPreview?: (soundCode: string) => void
}

export default function StudioMixerRack({ code, onCodeChange, onLiveCodeChange, onMixerStateChange, metronomeEnabled = false, onMetronomeToggle, onOpenPianoRoll, onOpenDrumSequencer, isPlaying: isPlayingProp = false, onPreview }: StudioMixerRackProps) {
  const channels = useMemo(() => parseStrudelCode(code), [code])
  const [expandedChannels, setExpandedChannels] = useState<Set<string>>(new Set())
  const [mutedChannels, setMutedChannels] = useState<Set<number>>(new Set())
  const [soloedChannels, setSoloedChannels] = useState<Set<number>>(new Set())
  const [dragOverChannel, setDragOverChannel] = useState<number | null>(null)
  const [showAddMenu, setShowAddMenu] = useState(false)
  const [fxDropdownOpen, setFxDropdownOpen] = useState(false)
  const fxDropdownRef = useRef<HTMLDivElement>(null)

  // Close FX dropdown on outside click
  useEffect(() => {
    if (!fxDropdownOpen) return
    const handler = (e: MouseEvent) => {
      if (fxDropdownRef.current && !fxDropdownRef.current.contains(e.target as Node)) {
        setFxDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [fxDropdownOpen])

  // ── Global project state (parsed from code) ──
  const currentBPM = useMemo(() => parseBPM(code), [code])
  const currentScale = useMemo(() => parseScale(code), [code])

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

  // Helper: use live code change (re-evaluates engine) when available, else fallback
  const liveUpdate = useCallback((newCode: string) => {
    (onLiveCodeChange ?? onCodeChange)(newCode)
  }, [onLiveCodeChange, onCodeChange])

  // ── Param change handler ──
  // Uses codeRef (not closure `code`) to always read latest code.
  // For 'gain', if the param doesn't exist in code, auto-inserts .gain(value).
  // Only inserts ONCE — if .gain( already exists in the channel, skip insert.
  // For other params, knob does nothing if param missing (use drag-and-drop).
  const handleParamChange = useCallback(
    (channelIdx: number, paramKey: string, value: number) => {
      const currentCode = codeRef.current
      const newCode = updateParamInCode(currentCode, channelIdx, paramKey, value)
      if (newCode !== currentCode) {
        liveUpdate(newCode)
      } else if (paramKey === 'gain') {
        // Only auto-insert .gain() if the channel doesn't already have one
        const channels = parseStrudelCode(currentCode)
        const ch = channels[channelIdx]
        if (ch && !ch.rawCode.includes('.gain(')) {
          const inserted = insertEffectInChannel(currentCode, channelIdx, `.gain(${value})`)
          if (inserted !== currentCode) {
            liveUpdate(inserted)
          }
        }
      }
    },
    [liveUpdate],
  )

  // ── Transpose handler ──
  const handleTranspose = useCallback(
    (channelIdx: number, semitones: number) => {
      // Clamp to ±24
      const clamped = Math.max(-24, Math.min(24, semitones))
      const currentCode = codeRef.current
      const newCode = setTranspose(currentCode, channelIdx, clamped)
      if (newCode !== currentCode) {
        liveUpdate(newCode)
      }
    },
    [liveUpdate],
  )

  // ── Arp rate change handler ──
  const handleArpRateChange = useCallback(
    (channelIdx: number, rate: number) => {
      const currentCode = codeRef.current
      const newCode = setArpRate(currentCode, channelIdx, rate)
      if (newCode !== currentCode) {
        liveUpdate(newCode)
      }
    },
    [liveUpdate],
  )

  // ── Arp mode change handler ──
  const handleArpChange = useCallback(
    (channelIdx: number, mode: string) => {
      const currentCode = codeRef.current
      const newCode = setArpMode(currentCode, channelIdx, mode)
      if (newCode !== currentCode) {
        liveUpdate(newCode)
      }
    },
    [liveUpdate],
  )

  // ── Remove effect handler ──
  const handleRemoveEffect = useCallback(
    (channelIdx: number, effectKey: string) => {
      const currentCode = codeRef.current
      const newCode = removeEffectFromChannel(currentCode, channelIdx, effectKey)
      if (newCode !== currentCode) {
        liveUpdate(newCode)
      }
    },
    [liveUpdate],
  )

  // ── Sound / Bank swap handlers ──
  const handleSoundChange = useCallback(
    (channelIdx: number, newSound: string) => {
      const currentCode = codeRef.current
      const newCode = swapSoundInChannel(currentCode, channelIdx, newSound)
      if (newCode !== currentCode) liveUpdate(newCode)
    },
    [liveUpdate],
  )

  const handleBankChange = useCallback(
    (channelIdx: number, newBank: string) => {
      if (!newBank) return // user picked "No Bank", ignore
      const currentCode = codeRef.current
      const newCode = swapBankInChannel(currentCode, channelIdx, newBank)
      if (newCode !== currentCode) liveUpdate(newCode)
    },
    [liveUpdate],
  )

  const handleAddSound = useCallback(
    (channelIdx: number, newSound: string) => {
      const currentCode = codeRef.current
      const newCode = addSoundToChannel(currentCode, channelIdx, newSound)
      if (newCode !== currentCode) onCodeChange(newCode)
    },
    [onCodeChange],
  )

  // ── Rename handler ──
  const handleRename = useCallback(
    (channelIdx: number, newName: string) => {
      const currentCode = codeRef.current
      const newCode = renameChannel(currentCode, channelIdx, newName)
      if (newCode !== currentCode) onCodeChange(newCode)
    },
    [onCodeChange],
  )

  // ── Duplicate handler ──
  const handleDuplicate = useCallback(
    (channelIdx: number) => {
      const currentCode = codeRef.current
      const newCode = duplicateChannel(currentCode, channelIdx)
      if (newCode !== currentCode) onCodeChange(newCode)
    },
    [onCodeChange],
  )

  // ── Delete handler ──
  const handleDelete = useCallback(
    (channelIdx: number) => {
      const currentCode = codeRef.current
      const newCode = removeChannel(currentCode, channelIdx)
      if (newCode !== currentCode) onCodeChange(newCode)
    },
    [onCodeChange],
  )

  // ── Stack row handlers (per-sub-sound in stack channels) ──
  const stackRowsMap = useMemo(() => {
    const map = new Map<number, StackRow[]>()
    channels.forEach((ch, idx) => {
      if (ch.sourceType === 'stack') {
        map.set(idx, parseStackRows(code, idx))
      }
    })
    return map
  }, [code, channels])

  const handleStackRowSoundChange = useCallback(
    (channelIdx: number, rowIdx: number, newSound: string) => {
      const currentCode = codeRef.current
      const newCode = swapSoundInStackRow(currentCode, channelIdx, rowIdx, newSound)
      if (newCode !== currentCode) liveUpdate(newCode)
    },
    [liveUpdate],
  )

  const handleStackRowGainChange = useCallback(
    (channelIdx: number, rowIdx: number, newGain: number) => {
      const currentCode = codeRef.current
      const newCode = setGainInStackRow(currentCode, channelIdx, rowIdx, newGain)
      if (newCode !== currentCode) liveUpdate(newCode)
    },
    [liveUpdate],
  )

  const handleStackRowBankChange = useCallback(
    (channelIdx: number, rowIdx: number, newBank: string) => {
      const currentCode = codeRef.current
      const newCode = setBankInStackRow(currentCode, channelIdx, rowIdx, newBank)
      if (newCode !== currentCode) liveUpdate(newCode)
    },
    [liveUpdate],
  )

  const handleRemoveStackRow = useCallback(
    (channelIdx: number, rowIdx: number) => {
      const currentCode = codeRef.current
      const newCode = removeSoundFromStack(currentCode, channelIdx, rowIdx)
      if (newCode !== currentCode) onCodeChange(newCode)
    },
    [onCodeChange],
  )

  // ── Add channel handler ──
  const handleAddChannel = useCallback(
    (sound: string, type: 'synth' | 'sample') => {
      const currentCode = codeRef.current
      const newCode = addChannel(currentCode, sound, type)
      if (newCode !== currentCode) onCodeChange(newCode)
      setShowAddMenu(false)
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
        // ── 1) FX drop ──
        const fxData = e.dataTransfer.getData('application/x-strudel-fx')
        if (fxData) {
          const effect = JSON.parse(fxData)

          // Enforce FX target restrictions
          const ch = channels[channelIdx]
          if (ch && effect.target && effect.target !== 'both') {
            const isInstrument = !ch.isKickLike && ch.sourceType !== 'stack' && ch.sourceType !== 'sample'
            if (effect.target === 'instrument' && !isInstrument) return
            if (effect.target === 'sound' && isInstrument) return
          }

          const currentCode = codeRef.current
          const newCode = insertEffectInChannel(currentCode, channelIdx, effect.code)
          if (newCode !== currentCode) liveUpdate(newCode)
          return
        }

        // ── 2) Sound/bank drop ──
        const soundData = e.dataTransfer.getData('application/x-strudel-sound')
        if (soundData) {
          const sound = JSON.parse(soundData)
          const currentCode = codeRef.current

          if (sound.type === 'bank') {
            // Swap the bank: .bank("RolandTR808") → .bank("newBank")
            const newCode = swapBankInChannel(currentCode, channelIdx, sound.name)
            if (newCode !== currentCode) liveUpdate(newCode)
          } else {
            // Swap the sound source: s("bd") → s("newSound") or .s("sawtooth") → .s("newSynth")
            const newCode = swapSoundInChannel(currentCode, channelIdx, sound.name)
            if (newCode !== currentCode) liveUpdate(newCode)
          }
          return
        }
      } catch {
        // Invalid drop data
      }
    },
    [liveUpdate, channels],
  )

  // ── Sidechain routing map ──
  const sidechainMap = useMemo(() => {
    // Build: sourceIdx → duckTargetOrbit, orbitToSourceIdx, targetIdx → sourceIdx
    const sourceToOrbit = new Map<number, number>()
    const orbitToSource = new Map<number, number>()

    channels.forEach((ch, idx) => {
      if (ch.duckTarget !== null) {
        sourceToOrbit.set(idx, ch.duckTarget)
        orbitToSource.set(ch.duckTarget, idx)
      }
    })

    // Find targets: channels whose orbit matches a source's duckTarget
    const targetToSource = new Map<number, number>()
    channels.forEach((ch, idx) => {
      const orbitParam = ch.params.find(p => p.key === 'orbit')
      if (orbitParam) {
        const orbit = Math.round(orbitParam.value)
        if (orbitToSource.has(orbit)) {
          targetToSource.set(idx, orbitToSource.get(orbit)!)
        }
      }
    })

    return { sourceToOrbit, orbitToSource, targetToSource }
  }, [channels])

  // Build sidechainInfo for each channel
  const getSidechainInfo = useCallback((idx: number) => {
    const ch = channels[idx]
    const isSource = sidechainMap.sourceToOrbit.has(idx)
    const duckTargetOrbit = sidechainMap.sourceToOrbit.get(idx) ?? null
    const isDucked = sidechainMap.targetToSource.has(idx)
    const sourceIdx = sidechainMap.targetToSource.get(idx)
    const hasDuckParams = ch.params.some(p => p.key === 'duckdepth' || p.key === 'duckattack')

    // Target channels: channels on the same orbit as this source's duck target
    const targetChannels: { idx: number; name: string; color: string; icon: string }[] = []
    if (isSource && duckTargetOrbit !== null) {
      channels.forEach((c, i) => {
        if (i === idx) return
        const orbitP = c.params.find(p => p.key === 'orbit')
        if (orbitP && Math.round(orbitP.value) === duckTargetOrbit) {
          targetChannels.push({ idx: i, name: c.name, color: c.color, icon: c.icon })
        }
      })
    }

    // Available targets: channels NOT already on the duck orbit (and not the source itself)
    const availableTargets: { idx: number; name: string }[] = []
    if (isSource && duckTargetOrbit !== null) {
      channels.forEach((c, i) => {
        if (i === idx) return
        const orbitP = c.params.find(p => p.key === 'orbit')
        const onDuckOrbit = orbitP && Math.round(orbitP.value) === duckTargetOrbit
        if (!onDuckOrbit) {
          availableTargets.push({ idx: i, name: c.name })
        }
      })
    }

    // Ducked-by info
    let duckedBySource: { name: string; color: string; orbit: number } | null = null
    if (isDucked && sourceIdx !== undefined) {
      const src = channels[sourceIdx]
      if (src) {
        const orbit = ch.params.find(p => p.key === 'orbit')
        duckedBySource = {
          name: src.name,
          color: src.color,
          orbit: orbit ? Math.round(orbit.value) : 0,
        }
      }
    }

    return {
      isSource,
      duckTargetOrbit,
      targetChannels,
      isDucked,
      duckedBySource,
      isKickLike: ch.isKickLike,
      availableTargets,
      hasDuckParams,
    }
  }, [channels, sidechainMap])

  // ── Sidechain handlers ──
  const handleEnableSidechain = useCallback(
    (sourceIdx: number) => {
      const currentCode = codeRef.current
      const chs = parseStrudelCode(currentCode)
      const orbit = findNextFreeOrbit(chs)
      const newCode = enableSidechain(currentCode, sourceIdx, orbit)
      if (newCode !== currentCode) liveUpdate(newCode)
    },
    [liveUpdate],
  )

  const handleDisableSidechain = useCallback(
    (sourceIdx: number) => {
      let currentCode = codeRef.current
      const chs = parseStrudelCode(currentCode)
      const ch = chs[sourceIdx]
      if (!ch || ch.duckTarget === null) return

      // Remove orbit from all target channels first
      const duckOrbit = ch.duckTarget
      // Process targets in reverse index order to keep indices stable
      const targetIndices: number[] = []
      chs.forEach((c, i) => {
        if (i === sourceIdx) return
        const orbitP = c.params.find(p => p.key === 'orbit')
        if (orbitP && Math.round(orbitP.value) === duckOrbit) {
          targetIndices.push(i)
        }
      })
      // Remove orbits from targets (reverse order for index safety)
      for (const ti of targetIndices.sort((a, b) => b - a)) {
        currentCode = removeEffectFromChannel(currentCode, ti, 'orbit')
      }

      // Now disable sidechain on the source
      currentCode = disableSidechain(currentCode, sourceIdx)
      liveUpdate(currentCode)
    },
    [liveUpdate],
  )

  const handleAddSidechainTarget = useCallback(
    (sourceIdx: number, targetIdx: number) => {
      const currentCode = codeRef.current
      const chs = parseStrudelCode(currentCode)
      const sourceCh = chs[sourceIdx]
      if (!sourceCh || sourceCh.duckTarget === null) return
      const newCode = setChannelOrbit(currentCode, targetIdx, sourceCh.duckTarget)
      if (newCode !== currentCode) liveUpdate(newCode)
    },
    [liveUpdate],
  )

  const handleRemoveSidechainTarget = useCallback(
    (sourceIdx: number, targetIdx: number) => {
      const currentCode = codeRef.current
      const newCode = removeEffectFromChannel(currentCode, targetIdx, 'orbit')
      if (newCode !== currentCode) liveUpdate(newCode)
    },
    [liveUpdate],
  )

  const handleDisconnectSidechain = useCallback(
    (targetIdx: number) => {
      const currentCode = codeRef.current
      const newCode = removeEffectFromChannel(currentCode, targetIdx, 'orbit')
      if (newCode !== currentCode) liveUpdate(newCode)
    },
    [liveUpdate],
  )

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* ── Header bar — hardware control strip ── */}
      <div
        className="shrink-0 flex items-center gap-2 px-3 py-1.5"
        style={{
          background: '#23262b',
          borderBottom: '1px solid rgba(255,255,255,0.04)',
          boxShadow: '0 2px 6px #14161a',
        }}
      >
        {/* Mixer label + channel count */}
        <div className="flex items-center gap-1.5">
          <Volume2 size={10} style={{ color: '#7fa998', opacity: 0.6 }} />
          <span className="text-[8px] font-black uppercase tracking-[.2em]" style={{ color: '#5a616b' }}>MXR</span>
          <span className="text-[8px] font-mono" style={{ color: '#5a616b' }}>{channels.length}ch</span>
        </div>

        {/* Divider */}
        <div className="w-px h-4" style={{ background: 'rgba(255,255,255,0.06)' }} />

        {/* BPM — compact inline */}
        <div className="flex items-center gap-1.5">
          <span className="text-[7px] font-black uppercase" style={{ color: '#7fa998' }}>BPM</span>
          <input
            type="range" min={40} max={220} step={1}
            value={currentBPM ?? 120}
            onChange={(e) => {
              const bpm = parseInt(e.target.value)
              const newCode = updateBPM(codeRef.current, bpm)
              if (newCode !== codeRef.current) (onLiveCodeChange ?? onCodeChange)(newCode)
            }}
            className="w-20 h-[2px] appearance-none cursor-pointer
              [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5
              [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#7fa998]
              [&::-webkit-slider-thumb]:border-none
              bg-white/[0.08]"
          />
          <span className="text-[10px] font-mono font-black w-6 tabular-nums" style={{ color: '#7fa998' }}>{currentBPM ?? '—'}</span>
        </div>

        {/* Divider */}
        <div className="w-px h-4" style={{ background: 'rgba(255,255,255,0.06)' }} />

        {/* Key / Scale — hardware readout */}
        <div className="flex items-center gap-1">
          <span className="text-[7px] font-black uppercase" style={{ color: '#b8a47f' }}>KEY</span>
          {currentScale ? (
            <>
              <select
                value={currentScale.root}
                onChange={(e) => {
                  const newCode = updateScale(codeRef.current, e.target.value, currentScale.scale)
                  if (newCode !== codeRef.current) (onLiveCodeChange ?? onCodeChange)(newCode)
                }}
                className="text-[8px] font-mono px-1 py-0 outline-none cursor-pointer w-8 bg-transparent"
                style={{ color: '#b8a47f', border: '1px solid rgba(184,164,127,0.2)', borderRadius: '6px' }}
              >
                {SCALE_ROOTS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              <select
                value={currentScale.scale}
                onChange={(e) => {
                  const newCode = updateScale(codeRef.current, currentScale.root, e.target.value)
                  if (newCode !== codeRef.current) (onLiveCodeChange ?? onCodeChange)(newCode)
                }}
                className="text-[8px] font-mono px-1 py-0 outline-none cursor-pointer max-w-[70px] bg-transparent"
                style={{ color: '#b8a47f', border: '1px solid rgba(184,164,127,0.2)', borderRadius: '6px' }}
              >
                <option value={currentScale.scale}>{currentScale.scale}</option>
                {STRUDEL_SCALES.map(g => (
                  <optgroup key={g.group} label={g.group}>
                    {g.scales.filter(([val]) => val !== currentScale.scale).map(([val, label]) => (
                      <option key={val} value={val}>{label}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </>
          ) : (
            <button
              onClick={() => {
                const newCode = insertScale(codeRef.current, 'C', 'minor')
                if (newCode !== codeRef.current) (onLiveCodeChange ?? onCodeChange)(newCode)
              }}
              className="text-[7px] font-bold cursor-pointer transition-all duration-[180ms] px-1.5 py-0.5 rounded-lg"
              style={{
                color: '#b8a47f',
                background: '#1c1e22',
                border: 'none',
                boxShadow: '2px 2px 4px #14161a, -2px -2px 4px #2c3036',
              }}
              title="Add scale to first channel (C minor default)"
            >
              + Scale
            </button>
          )}
        </div>

        {/* Divider */}
        <div className="w-px h-4" style={{ background: 'rgba(255,255,255,0.06)' }} />

        {/* Metro toggle — clay pill button */}
        <button
          onClick={() => onMetronomeToggle?.(!metronomeEnabled)}
          className="cursor-pointer transition-all duration-[180ms] active:scale-95"
          style={{
            display: 'flex', alignItems: 'center', gap: '3px',
            padding: '2px 8px',
            fontSize: '7px', fontWeight: 900, letterSpacing: '.1em', textTransform: 'uppercase' as const,
            borderRadius: '12px',
            color: metronomeEnabled ? '#7fa998' : '#5a616b',
            background: metronomeEnabled ? '#2a2e34' : '#1c1e22',
            border: 'none',
            boxShadow: metronomeEnabled
              ? 'inset 2px 2px 4px #14161a, inset -2px -2px 4px #2c3036'
              : '2px 2px 4px #14161a, -2px -2px 4px #2c3036',
          }}
        >
          <Clock size={8} />
          {metronomeEnabled ? '●' : '○'}
        </button>

        {/* Divider */}
        <div className="w-px h-4" style={{ background: 'rgba(255,255,255,0.06)' }} />

        {/* FX dropdown — clay pill button */}
        <div className="relative" ref={fxDropdownRef}>
          <button
            onClick={() => setFxDropdownOpen(p => !p)}
            className="cursor-pointer transition-all duration-[180ms] active:scale-95"
            style={{
              display: 'flex', alignItems: 'center', gap: '3px',
              padding: '2px 8px',
              fontSize: '7px', fontWeight: 900, letterSpacing: '.1em', textTransform: 'uppercase' as const,
              borderRadius: '12px',
              color: fxDropdownOpen ? '#7fa998' : '#5a616b',
              background: fxDropdownOpen ? '#2a2e34' : '#1c1e22',
              border: 'none',
              boxShadow: fxDropdownOpen
                ? 'inset 2px 2px 4px #14161a, inset -2px -2px 4px #2c3036'
                : '2px 2px 4px #14161a, -2px -2px 4px #2c3036',
            }}
          >
            <GripVertical size={8} />
            FX
          </button>

          {/* FX dropdown panel */}
          {fxDropdownOpen && (
            <div
              className="absolute top-full mt-1.5 left-0 z-50 p-2 min-w-[280px]"
              style={{
                background: '#23262b',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: '12px',
                boxShadow: '6px 6px 12px #14161a, -4px -4px 8px #2c3036',
              }}
            >
              <div className="flex items-center gap-1.5 mb-1.5 px-1">
                <span className="text-[7px] font-black uppercase tracking-[.2em]" style={{ color: '#5a616b' }}>EFFECTS</span>
                <span className="text-[5px] ml-auto font-mono" style={{ color: '#5a616b' }}>drag → channel</span>
              </div>
              {(['filter', 'space', 'drive', 'mod', 'env', 'sidechain', 'pattern'] as const).map(cat => {
                const fxInCat = DRAGGABLE_EFFECTS.filter(fx => fx.category === cat)
                if (fxInCat.length === 0) return null
                const catLabels: Record<string, string> = { filter: 'FILTER', space: 'SPACE', drive: 'DRIVE', mod: 'MOD', env: 'ENVELOPE', sidechain: 'SIDECHAIN', pattern: 'PATTERN' }
                return (
                  <div key={cat} className="mb-1.5">
                    <span className="text-[5px] font-black uppercase tracking-[.15em] px-1" style={{ color: '#5a616b' }}>{catLabels[cat]}</span>
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {fxInCat.map(fx => (
                        <EffectBadge key={fx.id} effect={fx} />
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Solo/Mute indicators */}
        {(soloedChannels.size > 0 || mutedChannels.size > 0) && (
          <div className="flex items-center gap-1.5">
            {soloedChannels.size > 0 && (
              <span className="text-[7px] font-black flex items-center gap-1 px-1.5 py-0.5 rounded-full" style={{ color: '#b8a47f', background: '#1c1e22', boxShadow: 'inset 1px 1px 3px #14161a, inset -1px -1px 3px #2c3036' }}>
                <Headphones size={7} /> {soloedChannels.size}S
              </span>
            )}
            {mutedChannels.size > 0 && (
              <span className="text-[7px] font-black flex items-center gap-1 px-1.5 py-0.5 rounded-full" style={{ color: '#b86f6f', background: '#1c1e22', boxShadow: 'inset 1px 1px 3px #14161a, inset -1px -1px 3px #2c3036' }}>
                <VolumeX size={7} /> {mutedChannels.size}M
              </span>
            )}
            <button
              onClick={() => { setMutedChannels(new Set()); setSoloedChannels(new Set()) }}
              className="text-[6px] cursor-pointer font-black uppercase transition-colors duration-[180ms]"
              style={{ color: '#5a616b' }}
            >CLR</button>
          </div>
        )}
      </div>

      {/* ── Channel Strips — glass card grid ── */}
      <div className="flex-1 overflow-y-auto px-3 py-3 relative">
        {channels.length === 0 ? (
          /* ── Empty state: prompt to add first channel ── */
          <div className="flex flex-col items-center justify-center h-full text-center gap-3">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-2"
              style={{ background: '#1c1e22', boxShadow: 'inset 3px 3px 6px #14161a, inset -3px -3px 6px #2c3036' }}>
              <Music size={24} style={{ color: '#5a616b' }} />
            </div>
            <span className="text-[10px] font-bold" style={{ color: '#5a616b' }}>
              No channels yet
            </span>
            <button
              onClick={() => setShowAddMenu(v => !v)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl cursor-pointer transition-all duration-[180ms] active:scale-95"
              style={{
                background: '#2a2e34',
                boxShadow: '4px 4px 8px #14161a, -4px -4px 8px #2c3036',
                color: '#7fa998',
                fontSize: '10px',
                fontWeight: 700,
                border: 'none',
              }}
            >
              <Plus size={12} /> Add Channel
            </button>
          </div>
        ) : (
          <>
            <div
              className="grid gap-2"
              style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))' }}
            >
              {channels.map((ch, idx) => (
                <ChannelStrip
                  key={ch.id}
                  channel={ch}
                  channelIdx={idx}
                  isExpanded={expandedChannels.has(ch.id)}
                  isMuted={mutedChannels.has(idx)}
                  isSoloed={soloedChannels.has(idx)}
                  isDragOver={dragOverChannel === idx}
                  isPlaying={isPlayingProp}
                  onToggle={() => toggleChannel(ch.id)}
                  onParamChange={handleParamChange}
                  onMute={handleMute}
                  onSolo={handleSolo}
                  onSoundChange={handleSoundChange}
                  onBankChange={handleBankChange}
                  onDragOver={() => handleDragOver(idx)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(idx, e)}
                  sidechainInfo={getSidechainInfo(idx)}
                  onEnableSidechain={() => handleEnableSidechain(idx)}
                  onDisableSidechain={() => handleDisableSidechain(idx)}
                  onAddSidechainTarget={(targetIdx) => handleAddSidechainTarget(idx, targetIdx)}
                  onRemoveSidechainTarget={(targetIdx) => handleRemoveSidechainTarget(idx, targetIdx)}
                  onDisconnectSidechain={() => handleDisconnectSidechain(idx)}
                  onOpenPianoRoll={onOpenPianoRoll ? () => onOpenPianoRoll(idx) : undefined}
                  onOpenDrumSequencer={onOpenDrumSequencer ? () => onOpenDrumSequencer(idx) : undefined}
                  onRename={handleRename}
                  onDuplicate={handleDuplicate}
                  onDelete={handleDelete}
                  stackRows={stackRowsMap.get(idx) || []}
                  onStackRowSoundChange={handleStackRowSoundChange}
                  onStackRowGainChange={handleStackRowGainChange}
                  onStackRowBankChange={handleStackRowBankChange}
                  onRemoveStackRow={handleRemoveStackRow}
                  onRemoveEffect={handleRemoveEffect}
                  onArpChange={handleArpChange}
                  onArpRateChange={handleArpRateChange}
                  onTranspose={handleTranspose}
                  onAddSound={handleAddSound}
                  onPreview={onPreview}
                />
              ))}

              {/* ── Add Channel tile (inline in grid) ── */}
              <button
                onClick={() => setShowAddMenu(v => !v)}
                className="flex flex-col items-center justify-center gap-1.5 rounded-2xl cursor-pointer transition-all duration-[180ms] active:scale-95"
                style={{
                  minHeight: '100px',
                  background: '#1c1e22',
                  boxShadow: showAddMenu
                    ? 'inset 3px 3px 6px #14161a, inset -3px -3px 6px #2c3036'
                    : '4px 4px 8px #14161a, -4px -4px 8px #2c3036',
                  border: '1px dashed rgba(127,169,152,0.2)',
                  color: '#5a616b',
                }}
              >
                <Plus size={16} style={{ color: '#7fa998', opacity: 0.6 }} />
                <span className="text-[8px] font-bold" style={{ color: '#5a616b' }}>Add Channel</span>
              </button>
            </div>
          </>
        )}

        {/* ── Add Channel Dropdown Menu (overlay) ── */}
        {showAddMenu && (
          <div
            className="absolute left-3 right-3 rounded-2xl overflow-hidden z-50"
            style={{
              top: channels.length === 0 ? '60%' : undefined,
              bottom: channels.length > 0 ? '8px' : undefined,
              background: '#23262b',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5), 4px 4px 8px #14161a, -4px -4px 8px #2c3036',
              border: '1px solid rgba(127,169,152,0.15)',
              maxHeight: '260px',
              overflowY: 'auto',
            }}
          >
            {/* Close bar */}
            <div className="flex items-center justify-between px-3 py-1.5 sticky top-0 z-10"
              style={{ background: '#23262b', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <span className="text-[8px] font-black uppercase tracking-[.15em]" style={{ color: '#7fa998' }}>
                Add Channel
              </span>
              <button onClick={() => setShowAddMenu(false)} className="cursor-pointer" style={{ color: '#5a616b', background: 'none', border: 'none' }}>
                <X size={12} />
              </button>
            </div>

            {ADD_CHANNEL_PRESETS.map(section => (
              <div key={section.section}>
                <div className="px-3 py-1" style={{ background: '#1c1e22' }}>
                  <span className="text-[7px] font-black uppercase tracking-[.1em]" style={{ color: '#5a616b' }}>
                    {section.section}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1 px-3 py-1.5">
                  {section.items.map(([sound, label]) => (
                    <button
                      key={sound}
                      onClick={() => handleAddChannel(sound, section.type)}
                      className="px-2 py-1 rounded-lg cursor-pointer transition-all duration-[120ms] active:scale-95 hover:opacity-100"
                      style={{
                        background: '#1c1e22',
                        boxShadow: '2px 2px 4px #14161a, -2px -2px 4px #2c3036',
                        color: section.type === 'synth' ? '#6f8fb3' : '#b8a47f',
                        fontSize: '8px',
                        fontWeight: 700,
                        border: 'none',
                        opacity: 0.8,
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Signal flow — hardware bottom strip */}
      {channels.length > 0 && (
        <div
          className="shrink-0 px-3 py-1"
          style={{ borderTop: '1px solid rgba(255,255,255,0.04)', background: '#1c1e22' }}
        >
          {/* Sidechain routing summary */}
          {sidechainMap.sourceToOrbit.size > 0 && (
            <div className="flex flex-wrap items-center justify-center gap-1.5 mb-1">
              {Array.from(sidechainMap.sourceToOrbit.entries()).map(([srcIdx, orbit]) => {
                const src = channels[srcIdx]
                if (!src) return null
                const targets = channels.filter((_c, i) => {
                  const op = _c.params.find(p => p.key === 'orbit')
                  return op && Math.round(op.value) === orbit && i !== srcIdx
                })
                return (
                  <span key={srcIdx} className="flex items-center gap-1 text-[7px] font-mono px-2 py-0.5 rounded-full" style={{ background: '#23262b', boxShadow: 'inset 1px 1px 3px #14161a, inset -1px -1px 3px #2c3036' }}>
                    <span style={{ color: src.color }} className="opacity-70">{src.name}</span>
                    <span style={{ color: '#7fa998', opacity: 0.5 }}>→</span>
                    {targets.length > 0 ? targets.map((t, ti) => (
                      <span key={t.id}>
                        {ti > 0 && <span style={{ color: '#5a616b' }}>,</span>}
                        <span style={{ color: t.color }} className="opacity-70">{t.name}</span>
                      </span>
                    )) : (
                      <span className="italic" style={{ color: '#5a616b' }}>none</span>
                    )}
                  </span>
                )
              })}
            </div>
          )}
          <div className="flex items-center justify-center gap-1.5">
            {channels.map((ch, i) => (
              <span key={ch.id} className="flex items-center gap-1.5">
                <span
                  className={`w-2 h-2 rounded-full transition-opacity duration-[180ms] ${
                    mutedChannels.has(i) || (soloedChannels.size > 0 && !soloedChannels.has(i))
                      ? 'opacity-10' : 'opacity-40'
                  }`}
                  style={{
                    backgroundColor: ch.color,
                  }}
                />
                {i < channels.length - 1 && (
                  <span className="text-[6px]" style={{ color: '#5a616b', opacity: 0.3 }}>·</span>
                )}
              </span>
            ))}
            <span className="text-[7px] ml-2 font-mono" style={{ color: '#5a616b' }}>→ OUT</span>
          </div>
        </div>
      )}
    </div>
  )
}
