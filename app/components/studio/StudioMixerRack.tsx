'use client'

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  STUDIO MIXER RACK v2 â€” Right sidebar hardware rack mixer
//  Features:
//    - Auto-parses code into channel strips with knobs
//    - Solo (S) / Mute (M) per channel â€” affects evaluation only
//    - Drag & drop effects from palette onto channels
//    - Knobs use position-based code replacement (never fails)
//    - Visual indicators for complex/modulated params (~)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

import { useMemo, useCallback, useState, useEffect, useRef } from 'react'
import { ChevronDown, ChevronRight, Plus, Volume2, VolumeX, Headphones, GripVertical, Link, Unlink, X, Music, Clock, Piano, Grid3X3, Copy, Trash2, RotateCcw, Mic } from 'lucide-react'
import StudioKnob from './StudioKnob'
import ChannelLCD from './ChannelLCD'
import WaveformViewer from './WaveformViewer'
import {
  parseStrudelCode, updateParamInCode, insertEffectInChannel,
  swapSoundInChannel, swapBankInChannel, addSoundToChannel, renameChannel, duplicateChannel,
  addChannel, removeChannel, resetChannel,
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

// â”€â”€â”€ Sound / Bank pick-lists for dropdown â”€â”€â”€

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
  // â”€â”€ Roland â”€â”€
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
  // â”€â”€ Korg â”€â”€
  ['KorgDDM110', 'KorgDDM-110'],
  ['KorgKPR77', 'KPR-77'],
  ['KorgKR55', 'KR-55'],
  ['KorgKRZ', 'KR-Z'],
  ['KorgM1', 'Korg M1'],
  ['KorgMinipops', 'Minipops'],
  ['KorgPoly800', 'Poly-800'],
  ['KorgT3', 'Korg T3'],
  // â”€â”€ Linn & Akai â”€â”€
  ['AkaiLinn', 'Akai/Linn'],
  ['AkaiMPC60', 'MPC60'],
  ['AkaiXR10', 'XR-10'],
  ['Linn9000', 'Linn 9000'],
  ['LinnDrum', 'LinnDrum'],
  ['LinnLM1', 'LM-1'],
  ['LinnLM2', 'LM-2'],
  ['MPC1000', 'MPC1000'],
  // â”€â”€ Boss & Yamaha â”€â”€
  ['BossDR110', 'DR-110'],
  ['BossDR220', 'DR-220'],
  ['BossDR55', 'DR-55'],
  ['BossDR550', 'DR-550'],
  ['YamahaRM50', 'RM50'],
  ['YamahaRX21', 'RX21'],
  ['YamahaRX5', 'RX5'],
  ['YamahaRY30', 'RY30'],
  ['YamahaTG33', 'TG33'],
  // â”€â”€ Emu & Oberheim â”€â”€
  ['EmuDrumulator', 'Drumulator'],
  ['EmuModular', 'Emu Modular'],
  ['EmuSP12', 'SP-12'],
  ['OberheimDMX', 'DMX'],
  // â”€â”€ More Machines â”€â”€
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
  // â”€â”€ Wavetable â”€â”€
  ['wt_digital', 'WT Digital'],
  ['wt_digital_bad_day', 'WT Bad Day'],
  ['wt_digital_basique', 'WT Basique'],
  ['wt_digital_crickets', 'WT Crickets'],
  ['wt_digital_curses', 'WT Curses'],
  ['wt_digital_echoes', 'WT Echoes'],
  ['wt_vgame', 'WT Video Game'],
]


// --- Channel source icon lookup ---

const SOURCE_ICONS: Record<string, string> = {
  sawtooth: '\u25F8', supersaw: '\u25C8', sine: '\u223F', square: '\u25FB', triangle: '\u25B3', pulse: '\u25AE', sbd: '\u25C9',
  white: '\u2591', pink: '\u2592', brown: '\u2593',
  bd: '\u2B24', sd: '\u25CE', cp: '\u270B', hh: '\u2303', oh: '\u2304', rim: '\u25C7', tom: '\u25C6',
  ride: '\u25E0', crash: '\u2731', perc: '\u2666',
  gm_piano: '\uD83C\uDFB9', gm_epiano1: '\u239A', gm_epiano2: '\u239B', gm_music_box: '\u274A',
  gm_vibraphone: '\u27E1', gm_marimba: '\u229E', gm_celesta: '\u2727', gm_clavinet: '\u229F',
  gm_drawbar_organ: '\u22A0', gm_rock_organ: '\u2297', gm_church_organ: '\u271D',
  gm_acoustic_guitar_nylon: '\u2318', gm_acoustic_guitar_steel: '\u2388',
  gm_electric_guitar_jazz: '\u266A', gm_electric_guitar_clean: '\u266B',
  gm_acoustic_bass: '\u238D', gm_synth_bass_1: '\u2391', gm_synth_bass_2: '\u2392',
  gm_violin: '\uD83C\uDFBB', gm_viola: '\u2312', gm_cello: '\u2313', gm_contrabass: '\u2314',
  gm_string_ensemble_1: '\u224B', gm_orchestral_harp: '\u2307',
  gm_trumpet: '\uD83C\uDFBA', gm_trombone: '\u2320', gm_french_horn: '\u2321',
  gm_alto_sax: '\uD83C\uDFB7', gm_tenor_sax: '\u2296',
  gm_flute: '\u2298', gm_piccolo: '\u2299',
  gm_choir_aahs: '\uD83C\uDFA4', gm_voice_oohs: '\u25D4', gm_synth_choir: '\u25D5', mouth: '\uD83D\uDC44',
  gm_lead_1_square: '\u25A3', gm_lead_2_sawtooth: '\u25A4',
  gm_pad_new_age: '\u2601', gm_pad_warm: '\u2600', gm_pad_poly: '\u25C8', gm_pad_choir: '\u2641', gm_pad_sweep: '\u25CC',
  casio: '\u2328', jazz: '\u2669', metal: '\u26D3', space: '\uD83C\uDF0C',
  gm_fx_crystal: '\u2756', gm_fx_atmosphere: '\u263E', gm_fx_echoes: '\u25CE',
  gm_kalimba: '\u232D', gm_sitar: '\u232E', gm_koto: '\u232F',
}

function getSourceIcon(source: string, sourceType: string): string {
  if (SOURCE_ICONS[source]) return SOURCE_ICONS[source]
  if (sourceType === 'synth' || sourceType === 'note') return '\u25C8'
  if (sourceType === 'sample') return '\u25C6'
  if (sourceType === 'stack') return '\u25A6'
  return '\u266A'
}


// â”€â”€â”€ Quick-add presets for Add Channel menu â”€â”€â”€

const ADD_CHANNEL_PRESETS: { section: string; type: 'synth' | 'sample' | 'vocal'; items: [string, string][] }[] = [
  { section: 'ðŸŽ¹ Instruments', type: 'synth', items: [
    ['sawtooth', 'Sawtooth'], ['supersaw', 'Supersaw'], ['sine', 'Sine'],
    ['square', 'Square'], ['triangle', 'Triangle'],
    ['gm_piano', 'Piano'], ['gm_epiano1', 'E.Piano'],
    ['gm_violin', 'Violin'], ['gm_trumpet', 'Trumpet'],
    ['gm_flute', 'Flute'], ['gm_alto_sax', 'Alto Sax'],
    ['gm_acoustic_bass', 'Ac. Bass'], ['gm_synth_bass_1', 'Synth Bass'],
  ]},
  { section: 'ðŸ¥ Drums', type: 'sample', items: [
    ['bd', 'Kick'], ['sd', 'Snare'], ['cp', 'Clap'], ['hh', 'Hi-hat'],
    ['oh', 'Open HH'], ['rim', 'Rim'], ['tom', 'Tom'], ['ride', 'Ride'],
    ['crash', 'Crash'], ['perc', 'Perc'],
  ]},
  { section: 'ðŸŽ¤ Vocals & Voice', type: 'vocal', items: [
    ['gm_choir_aahs', 'Choir Aahs'], ['gm_voice_oohs', 'Voice Oohs'],
    ['gm_synth_choir', 'Synth Choir'], ['gm_pad_choir', 'Choir Pad'],
    ['mouth', 'Mouth'],
  ]},
  { section: 'ðŸŽµ Samples', type: 'sample', items: [
    ['casio', 'Casio'], ['jazz', 'Jazz Kit'], ['gabba', 'Gabba'],
    ['metal', 'Metal'], ['space', 'Space'],
  ]},
]

// â”€â”€â”€ Effect category grouping for nested rack display â”€â”€â”€

const FX_GROUPS: { label: string; icon: string; keys: string[] }[] = [
  { label: 'FILTER', icon: 'ðŸ”½', keys: ['lpf', 'lp', 'hpf', 'hp', 'lpq', 'lpenv', 'lps', 'lpd'] },
  { label: 'DRIVE',  icon: 'ðŸ”¥', keys: ['shape', 'distort', 'crush'] },
  { label: 'SPACE',  icon: 'ðŸŒŒ', keys: ['room', 'delay', 'delayfeedback', 'delaytime', 'orbit'] },
  { label: 'MOD',    icon: 'ðŸŽµ', keys: ['detune', 'speed', 'pan', 'velocity', 'postgain'] },
  { label: 'ENV',    icon: 'â³', keys: ['attack', 'decay', 'rel', 'release', 'legato', 'clip'] },
  { label: 'SAMPLE', icon: 'ðŸŽ¤', keys: ['loopAt', 'begin', 'end', 'chop', 'stretch'] },
]

// â”€â”€â”€ Draggable Effect Badge â”€â”€â”€

function EffectBadge({ effect }: { effect: typeof DRAGGABLE_EFFECTS[number] }) {
  const targetIcon = effect.target === 'instrument' ? 'ðŸŽ¹' : effect.target === 'sound' ? 'ðŸ¥' : ''
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
        background: '#16181d',
        border: '1px solid rgba(255,255,255,0.04)',
        borderRadius: '12px',
        boxShadow: '3px 3px 6px #050607, -3px -3px 6px #1a1d22',
      }}
      title={`Drag onto a channel to add ${effect.label}${effect.target !== 'both' ? ` (${effect.target} only)` : ''}`}
    >
      <span className="text-[9px]">{effect.icon}</span>
      <span className="font-bold uppercase tracking-wide" style={{ color: '#9aa7b3' }}>{effect.label}</span>
      {targetIcon && <span className="text-[7px] opacity-40">{targetIcon}</span>}
    </div>
  )
}

// â”€â”€â”€ Single Channel Strip â”€â”€â”€

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
  onOpenWaveform,
  onRename,
  onDuplicate,
  onDelete,
  onReset,
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
  onOpenWaveform?: () => void
  onRename: (channelIdx: number, newName: string) => void
  onDuplicate?: (channelIdx: number) => void
  onDelete?: (channelIdx: number) => void
  onReset?: (channelIdx: number) => void
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
        background: '#111318',
        border: isDragOver
          ? '1px solid rgba(127,169,152,0.25)'
          : isActiveNode
            ? `1px solid ${channel.color}40`
            : '1px solid rgba(255,255,255,0.04)',
        boxShadow: isDragOver
          ? '6px 6px 12px #050607, -6px -6px 12px #1a1d22, inset 0 0 0 1px rgba(127,169,152,0.1)'
          : isActiveNode
            ? `4px 4px 8px #050607, -4px -4px 8px #1a1d22, 0 0 12px ${channel.color}20, 0 0 4px ${channel.color}15`
            : isExpanded
              ? '8px 8px 16px #050607, -8px -8px 16px #1a1d22'
              : '4px 4px 8px #050607, -4px -4px 8px #1a1d22',
      }}
      onDragOver={(e) => e.preventDefault()}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeaveLocal}
      onDrop={handleDropLocal}
    >
      {/* â”€â”€ Color bar / LED strip at top â”€â”€ */}
      <div
        className="h-[2px] rounded-t-2xl transition-all duration-300"
        style={{
          background: channel.color,
          opacity: isMuted ? 0.15 : isActiveNode ? 0.8 : 0.4,
          boxShadow: isActiveNode ? `0 0 6px ${channel.color}60` : 'none',
        }}
      />

      {/* â”€â”€ Compact header: S M Â· Name â”€â”€ */}
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
            background: isSoloed ? '#16181d' : '#0a0b0d',
            border: 'none',
            boxShadow: isSoloed
              ? 'inset 2px 2px 4px #050607, inset -2px -2px 4px #1a1d22'
              : '2px 2px 4px #050607, -2px -2px 4px #1a1d22',
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
            background: isMuted ? '#16181d' : '#0a0b0d',
            border: 'none',
            boxShadow: isMuted
              ? 'inset 2px 2px 4px #050607, inset -2px -2px 4px #1a1d22'
              : '2px 2px 4px #050607, -2px -2px 4px #1a1d22',
          }}
          title="Mute"
        >M</button>

        {/* Channel name â€” click to expand, double-click to rename */}
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
            title="Click to expand Â· Double-click to rename"
          >
            <span
              className="text-[11px] leading-none shrink-0"
              style={{ color: channel.color, filter: 'drop-shadow(0 0 3px currentColor)', opacity: 0.9 }}
              title={channel.source}
            >
              {getSourceIcon(channel.source, channel.sourceType)}
            </span>
            <span
              className="text-[7px] font-extrabold uppercase tracking-[.1em] truncate"
              style={{ color: `${channel.color}aa` }}
            >
              {channel.name}
            </span>
            {channel.sourceType === 'sample' && channel.effects.includes('loopAt') && <span className="text-[6px]" title="Vocal/Sample channel">ðŸŽ¤</span>}
            {sidechainInfo.isSource && <span className="text-[5px]" style={{ color: '#7fa998', opacity: 0.6 }}>SC</span>}
            {sidechainInfo.isDucked && <span className="text-[5px]">ðŸ¦†</span>}
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

      {/* â”€â”€ Gain knob â€” centered â”€â”€ */}
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

      {/* â”€â”€ Transpose: [-12] knob [+12] â€” only for instrument channels â”€â”€ */}
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
                color: '#6f8fb3', background: '#0a0b0d', border: 'none',
                boxShadow: '2px 2px 4px #050607, -2px -2px 4px #1a1d22',
              }}
              title="-1 octave"
            >âˆ’12</button>
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
                color: '#6f8fb3', background: '#0a0b0d', border: 'none',
                boxShadow: '2px 2px 4px #050607, -2px -2px 4px #1a1d22',
              }}
              title="+1 octave"
            >+12</button>
          </div>
        )
      })()}

      {/* â”€â”€ Mini LCD visualizer â”€â”€ */}
      <ChannelLCD
        channel={channel}
        isPlaying={isPlaying}
        isMuted={isMuted}
        onDoubleClick={channel.sourceType === 'sample' && channel.effects.includes('loopAt') ? onOpenWaveform : undefined}
      />

      {/* â”€â”€ Active effect tags â€” removable pills â”€â”€ */}
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
                      Ã—
                    </button>
                  )}
                </span>
              )
            })}
        </div>
      )}

      {/* â”€â”€ Effect knobs â€” tight grid â”€â”€ */}
      {effectKnobs.length > 0 && (
        <div
          className="mx-1 mb-1 px-1 py-1 rounded-xl"
          style={{ background: '#0a0b0d', boxShadow: 'inset 2px 2px 4px #050607, inset -2px -2px 4px #1a1d22' }}
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

      {/* â”€â”€ Action icons row â”€â”€ */}
      <div className="flex items-center justify-center gap-1 px-1 pb-1.5">
        {/* Piano Roll â€” for instrument channels AND sample channels (pitched sample playback) */}
        {onOpenPianoRoll && (channel.sourceType === 'synth' || channel.sourceType === 'note' || channel.sourceType === 'sample') && (
          <button
            onClick={(e) => { e.stopPropagation(); onOpenPianoRoll() }}
            className="p-1 rounded-lg transition-colors cursor-pointer"
            style={{ color: '#6f8fb3', opacity: 0.4 }}
            title="Piano Roll"
          >
            <Piano size={9} />
          </button>
        )}
        {/* Drum Sequencer â€” only for sound/sample channels (sample/stack) */}
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
        {onReset && (
          <button
            onClick={(e) => { e.stopPropagation(); if (confirm('Reset channel? This removes all effects and patterns.')) onReset(channelIdx) }}
            className="p-1 rounded-lg transition-colors cursor-pointer hover:opacity-80"
            style={{ color: '#b8a47f', opacity: 0.4 }}
            title="Reset Channel"
          >
            <RotateCcw size={9} />
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

      {/* â”€â”€ Drop indicator â”€â”€ */}
      {isDragOver && (
        <div className="px-1.5 py-1 text-[6px] text-center font-mono font-bold" style={{ color: '#7fa998' }}>
          â¬‡ DROP FX
        </div>
      )}

      {/* â”€â”€ Expanded detail panel (inline, spans card width) â”€â”€ */}
      {isExpanded && (
        <div style={{ borderTop: `1px solid rgba(255,255,255,0.04)`, background: '#0a0b0d' }} className="rounded-b-2xl">
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
                    style={{ color: '#7fa998', background: '#0a0b0d', border: '1px solid rgba(127,169,152,0.2)', borderRadius: '6px', maxWidth: '60px' }}
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
                      style={{ color: '#e8ecf0', background: '#111318', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px' }}
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
                      >Ã—</button>
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
          {/* Sound / Bank selectors â€” hidden for stacks (managed per-row above) */}
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
                    style={{ color: '#7fa998', background: '#0a0b0d', border: '1px solid rgba(127,169,152,0.2)', borderRadius: '6px', maxWidth: '60px' }}
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
                    style={{ color: '#e8ecf0', background: '#111318', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px' }}
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
              {/* Bank selector â€” only for sound/sample channels (drum machines) */}
              {channel.sourceType !== 'synth' && channel.sourceType !== 'note' && (
                <div className="flex items-center gap-1">
                  <select
                    value={channel.bank || ''}
                    onChange={(e) => onBankChange(channelIdx, e.target.value)}
                    className="text-[7px] font-mono rounded px-1 py-0.5 outline-none cursor-pointer flex-1 min-w-0"
                    style={{ color: '#b8a47f', background: '#111318', border: '1px solid rgba(184,164,127,0.12)', borderRadius: '8px' }}
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

          {/* â”€â”€ ARP section â”€â”€ */}
          {(() => {
            const arpInfo = getArpInfo(channel.rawCode)
            const isActive = arpInfo.mode !== 'off'
            return (
              <div style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                <div className="flex items-center gap-1 px-2 py-1">
                  <span className="text-[7px]">ðŸŽ¹</span>
                  <span className="text-[6px] font-bold uppercase tracking-[.12em]" style={{ color: isActive ? '#b8a47f' : '#5a616b' }}>ARP</span>
                  <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.03)' }} />
                  {isActive && <span className="text-[5px] font-bold" style={{ color: '#b8a47f' }}>{arpInfo.mode.toUpperCase()} Ã—{arpInfo.rate}</span>}
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
                        background: arpInfo.mode === mode.id ? '#16181d' : '#0a0b0d',
                        border: 'none',
                        boxShadow: arpInfo.mode === mode.id
                          ? 'inset 2px 2px 4px #050607, inset -2px -2px 4px #1a1d22'
                          : '2px 2px 4px #050607, -2px -2px 4px #1a1d22',
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
                      formatValue={(v) => `Ã—${v}`}
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
                    style={{ background: '#111318', color: '#7fa998', boxShadow: '2px 2px 4px #050607, -2px -2px 4px #1a1d22' }}
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
                    <select value="" onChange={(e) => { if (e.target.value) onAddSidechainTarget(parseInt(e.target.value)) }} onClick={(e) => e.stopPropagation()} className="w-full text-[6px] font-mono rounded-lg px-1 py-0.5 outline-none cursor-pointer" style={{ background: '#111318', color: '#7fa998', border: '1px solid rgba(127,169,152,0.12)' }}>
                      <option value="">+ Targetâ€¦</option>
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
                  <button onClick={(e) => { e.stopPropagation(); onDisableSidechain() }} className="w-full flex items-center justify-center gap-1 px-1 py-0.5 rounded-lg transition-all text-[6px] font-bold uppercase cursor-pointer" style={{ background: '#111318', color: '#b86f6f', boxShadow: '2px 2px 4px #050607, -2px -2px 4px #1a1d22' }}>
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
              <span className="text-[6px]">ðŸ¦†</span>
              <span className="text-[6px] font-bold uppercase" style={{ color: sidechainInfo.duckedBySource.color }}>{sidechainInfo.duckedBySource.name}</span>
              <button onClick={(e) => { e.stopPropagation(); onDisconnectSidechain() }} className="ml-auto text-white/15 hover:text-red-400/60 cursor-pointer"><X size={7} /></button>
            </div>
          )}

          {/* Orbit */}
          {channel.params.find(p => p.key === 'orbit') && (
            <div className="flex items-center gap-1 px-2 py-1">
              <span className="text-[6px]">ðŸ”€</span>
              <span className="text-[6px] text-white/15 font-mono">ORB {channel.params.find(p => p.key === 'orbit')?.value}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// â”€â”€â”€ Mixer Rack (right sidebar) â”€â”€â”€

interface UserSample {
  id: string
  name: string
  url: string
  duration_ms?: number | null
  original_bpm?: number | null
}

interface StudioMixerRackProps {
  code: string
  onCodeChange: (code: string) => void
  onLiveCodeChange?: (code: string) => void  // updates text + re-evaluates immediately
  onMixerStateChange?: (state: { muted: Set<number>; soloed: Set<number> }) => void
  metronomeEnabled?: boolean
  onMetronomeToggle?: (enabled: boolean) => void
  onOpenPianoRoll?: (channelIdx: number) => void
  onOpenDrumSequencer?: (channelIdx: number) => void
  onOpenSampleUploader?: () => void
  onAddVocalChannel?: (name: string, loopAt: number, sampleBpm?: number) => void
  userSamples?: UserSample[]
  isPlaying?: boolean
  onPreview?: (soundCode: string) => void
}

export default function StudioMixerRack({ code, onCodeChange, onLiveCodeChange, onMixerStateChange, metronomeEnabled = false, onMetronomeToggle, onOpenPianoRoll, onOpenDrumSequencer, onOpenSampleUploader, onAddVocalChannel, userSamples = [], isPlaying: isPlayingProp = false, onPreview }: StudioMixerRackProps) {
  const channels = useMemo(() => parseStrudelCode(code), [code])
  const [expandedChannels, setExpandedChannels] = useState<Set<string>>(new Set())
  const [mutedChannels, setMutedChannels] = useState<Set<number>>(new Set())
  const [soloedChannels, setSoloedChannels] = useState<Set<number>>(new Set())
  const [dragOverChannel, setDragOverChannel] = useState<number | null>(null)
  const [showAddMenu, setShowAddMenu] = useState(false)
  const [fxDropdownOpen, setFxDropdownOpen] = useState(false)
  const [waveformModalOpen, setWaveformModalOpen] = useState(false)
  const [selectedWaveformUrl, setSelectedWaveformUrl] = useState<string>('')
  const [selectedWaveformChannel, setSelectedWaveformChannel] = useState<number>(-1)
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

  // â”€â”€ Global project state (parsed from code) â”€â”€
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

  // â”€â”€ Solo handler â”€â”€
  // Click = exclusive solo (only this channel).
  // Ctrl/Shift+click = additive (toggle this channel in solo set).
  const handleSolo = useCallback((idx: number, exclusive: boolean) => {
    setSoloedChannels(prev => {
      if (exclusive) {
        // If already the only solo â†’ clear all solos
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

  // â”€â”€ Mute handler â”€â”€
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

  // â”€â”€ Param change handler â”€â”€
  // Uses codeRef (not closure `code`) to always read latest code.
  // For 'gain', if the param doesn't exist in code, auto-inserts .gain(value).
  // Only inserts ONCE â€” if .gain( already exists in the channel, skip insert.
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

  // â”€â”€ Transpose handler â”€â”€
  const handleTranspose = useCallback(
    (channelIdx: number, semitones: number) => {
      // Clamp to Â±24
      const clamped = Math.max(-24, Math.min(24, semitones))
      const currentCode = codeRef.current
      const newCode = setTranspose(currentCode, channelIdx, clamped)
      if (newCode !== currentCode) {
        liveUpdate(newCode)
      }
    },
    [liveUpdate],
  )

  // â”€â”€ Arp rate change handler â”€â”€
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

  // â”€â”€ Arp mode change handler â”€â”€
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

  // â”€â”€ Remove effect handler â”€â”€
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

  // â”€â”€ Sound / Bank swap handlers â”€â”€
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

  // â”€â”€ Rename handler â”€â”€
  const handleRename = useCallback(
    (channelIdx: number, newName: string) => {
      const currentCode = codeRef.current
      const newCode = renameChannel(currentCode, channelIdx, newName)
      if (newCode !== currentCode) onCodeChange(newCode)
    },
    [onCodeChange],
  )

  // â”€â”€ Duplicate handler â”€â”€
  const handleDuplicate = useCallback(
    (channelIdx: number) => {
      const currentCode = codeRef.current
      const newCode = duplicateChannel(currentCode, channelIdx)
      if (newCode !== currentCode) onCodeChange(newCode)
    },
    [onCodeChange],
  )

  // â”€â”€ Delete handler â”€â”€
  const handleDelete = useCallback(
    (channelIdx: number) => {
      const currentCode = codeRef.current
      const newCode = removeChannel(currentCode, channelIdx)
      if (newCode !== currentCode) onCodeChange(newCode)
    },
    [onCodeChange],
  )

  // â”€â”€ Reset handler â”€â”€
  const handleReset = useCallback(
    (channelIdx: number) => {
      const currentCode = codeRef.current
      const newCode = resetChannel(currentCode, channelIdx)
      if (newCode !== currentCode) onCodeChange(newCode)
    },
    [onCodeChange],
  )

  // â”€â”€ Stack row handlers (per-sub-sound in stack channels) â”€â”€
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

  // â”€â”€ Add channel handler â”€â”€
  const handleAddChannel = useCallback(
    (sound: string, type: 'synth' | 'sample' | 'vocal', vocalLoopAt?: number) => {
      const currentCode = codeRef.current
      const newCode = addChannel(currentCode, sound, type, vocalLoopAt)
      if (newCode !== currentCode) onCodeChange(newCode)
      setShowAddMenu(false)
    },
    [onCodeChange],
  )

  // â”€â”€ Drag & drop handlers â”€â”€
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
        // â”€â”€ 1) FX drop â”€â”€
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

        // â”€â”€ 2) Sound/bank drop â”€â”€
        const soundData = e.dataTransfer.getData('application/x-strudel-sound')
        if (soundData) {
          const sound = JSON.parse(soundData)
          const currentCode = codeRef.current

          if (sound.type === 'bank') {
            // Swap the bank: .bank("RolandTR808") â†’ .bank("newBank")
            const newCode = swapBankInChannel(currentCode, channelIdx, sound.name)
            if (newCode !== currentCode) liveUpdate(newCode)
          } else {
            // Swap the sound source: s("bd") â†’ s("newSound") or .s("sawtooth") â†’ .s("newSynth")
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

  // â”€â”€ Sidechain routing map â”€â”€
  const sidechainMap = useMemo(() => {
    // Build: sourceIdx â†’ duckTargetOrbit, orbitToSourceIdx, targetIdx â†’ sourceIdx
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

  // â”€â”€ Sidechain handlers â”€â”€
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
      {/* â”€â”€ Header bar â€” hardware control strip â”€â”€ */}
      <div
        className="shrink-0 flex items-center gap-2 px-3 py-1.5"
        style={{
          background: '#111318',
          borderBottom: '1px solid rgba(255,255,255,0.04)',
          boxShadow: '0 2px 6px #050607',
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

        {/* BPM â€” compact inline */}
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
          <span className="text-[10px] font-mono font-black w-6 tabular-nums" style={{ color: '#7fa998' }}>{currentBPM ?? 'â€”'}</span>
        </div>

        {/* Divider */}
        <div className="w-px h-4" style={{ background: 'rgba(255,255,255,0.06)' }} />

        {/* Key / Scale â€” hardware readout */}
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
                background: '#0a0b0d',
                border: 'none',
                boxShadow: '2px 2px 4px #050607, -2px -2px 4px #1a1d22',
              }}
              title="Add scale to first channel (C minor default)"
            >
              + Scale
            </button>
          )}
        </div>

        {/* Divider */}
        <div className="w-px h-4" style={{ background: 'rgba(255,255,255,0.06)' }} />

        {/* Metro toggle â€” clay pill button */}
        <button
          onClick={() => onMetronomeToggle?.(!metronomeEnabled)}
          className="cursor-pointer transition-all duration-[180ms] active:scale-95"
          style={{
            display: 'flex', alignItems: 'center', gap: '3px',
            padding: '2px 8px',
            fontSize: '7px', fontWeight: 900, letterSpacing: '.1em', textTransform: 'uppercase' as const,
            borderRadius: '12px',
            color: metronomeEnabled ? '#7fa998' : '#5a616b',
            background: metronomeEnabled ? '#16181d' : '#0a0b0d',
            border: 'none',
            boxShadow: metronomeEnabled
              ? 'inset 2px 2px 4px #050607, inset -2px -2px 4px #1a1d22'
              : '2px 2px 4px #050607, -2px -2px 4px #1a1d22',
          }}
        >
          <Clock size={8} />
          {metronomeEnabled ? 'â—' : 'â—‹'}
        </button>

        {/* Divider */}
        <div className="w-px h-4" style={{ background: 'rgba(255,255,255,0.06)' }} />

        {/* FX dropdown â€” clay pill button */}
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
              background: fxDropdownOpen ? '#16181d' : '#0a0b0d',
              border: 'none',
              boxShadow: fxDropdownOpen
                ? 'inset 2px 2px 4px #050607, inset -2px -2px 4px #1a1d22'
                : '2px 2px 4px #050607, -2px -2px 4px #1a1d22',
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
                background: '#111318',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: '12px',
                boxShadow: '6px 6px 12px #050607, -4px -4px 8px #1a1d22',
              }}
            >
              <div className="flex items-center gap-1.5 mb-1.5 px-1">
                <span className="text-[7px] font-black uppercase tracking-[.2em]" style={{ color: '#5a616b' }}>EFFECTS</span>
                <span className="text-[5px] ml-auto font-mono" style={{ color: '#5a616b' }}>drag â†’ channel</span>
              </div>
              {(['filter', 'space', 'drive', 'mod', 'env', 'sidechain', 'pattern', 'sample'] as const).map(cat => {
                const fxInCat = DRAGGABLE_EFFECTS.filter(fx => fx.category === cat)
                if (fxInCat.length === 0) return null
                const catLabels: Record<string, string> = { filter: 'FILTER', space: 'SPACE', drive: 'DRIVE', mod: 'MOD', env: 'ENVELOPE', sidechain: 'SIDECHAIN', pattern: 'PATTERN', sample: 'SAMPLE' }
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

        {/* Divider */}
        <div className="w-px h-4" style={{ background: 'rgba(255,255,255,0.06)' }} />

        {/* Samples / Vocals button */}
        {onOpenSampleUploader && (
          <button
            onClick={onOpenSampleUploader}
            className="cursor-pointer transition-all duration-[180ms] active:scale-95"
            style={{
              display: 'flex', alignItems: 'center', gap: '3px',
              padding: '2px 8px',
              fontSize: '7px', fontWeight: 900, letterSpacing: '.1em', textTransform: 'uppercase' as const,
              borderRadius: '12px',
              color: '#5a616b',
              background: '#0a0b0d',
              border: 'none',
              boxShadow: '2px 2px 4px #050607, -2px -2px 4px #1a1d22',
            }}
            title="Upload samples / vocals"
          >
            <Mic size={8} />
            SAMPLES
          </button>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Solo/Mute indicators */}
        {(soloedChannels.size > 0 || mutedChannels.size > 0) && (
          <div className="flex items-center gap-1.5">
            {soloedChannels.size > 0 && (
              <span className="text-[7px] font-black flex items-center gap-1 px-1.5 py-0.5 rounded-full" style={{ color: '#b8a47f', background: '#0a0b0d', boxShadow: 'inset 1px 1px 3px #050607, inset -1px -1px 3px #1a1d22' }}>
                <Headphones size={7} /> {soloedChannels.size}S
              </span>
            )}
            {mutedChannels.size > 0 && (
              <span className="text-[7px] font-black flex items-center gap-1 px-1.5 py-0.5 rounded-full" style={{ color: '#b86f6f', background: '#0a0b0d', boxShadow: 'inset 1px 1px 3px #050607, inset -1px -1px 3px #1a1d22' }}>
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

      {/* â”€â”€ Channel Strips â€” glass card grid â”€â”€ */}
      <div className="flex-1 overflow-y-auto px-3 py-3 relative">
        {channels.length === 0 ? (
          /* â”€â”€ Empty state: prompt to add first channel â”€â”€ */
          <div className="flex flex-col items-center justify-center h-full text-center gap-3">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-2"
              style={{ background: '#0a0b0d', boxShadow: 'inset 3px 3px 6px #050607, inset -3px -3px 6px #1a1d22' }}>
              <Music size={24} style={{ color: '#5a616b' }} />
            </div>
            <span className="text-[10px] font-bold" style={{ color: '#5a616b' }}>
              No channels yet
            </span>
            <button
              onClick={() => setShowAddMenu(v => !v)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl cursor-pointer transition-all duration-[180ms] active:scale-95"
              style={{
                background: '#16181d',
                boxShadow: '4px 4px 8px #050607, -4px -4px 8px #1a1d22',
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
                  onOpenWaveform={() => { const sample = userSamples.find(s => s.name === ch.source); if (sample) { setSelectedWaveformUrl(sample.url); setSelectedWaveformChannel(idx); setWaveformModalOpen(true); } }}
                  onRename={handleRename}
                  onDuplicate={handleDuplicate}
                  onDelete={handleDelete}
                  onReset={handleReset}
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

              {/* â”€â”€ Add Channel tile (inline in grid) â”€â”€ */}
              <button
                onClick={() => setShowAddMenu(v => !v)}
                className="flex flex-col items-center justify-center gap-1.5 rounded-2xl cursor-pointer transition-all duration-[180ms] active:scale-95"
                style={{
                  minHeight: '100px',
                  background: '#0a0b0d',
                  boxShadow: showAddMenu
                    ? 'inset 3px 3px 6px #050607, inset -3px -3px 6px #1a1d22'
                    : '4px 4px 8px #050607, -4px -4px 8px #1a1d22',
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

        {/* â”€â”€ Add Channel Dropdown Menu (overlay) â”€â”€ */}
        {showAddMenu && (
          <div
            className="absolute left-3 right-3 rounded-2xl overflow-hidden z-50"
            style={{
              top: channels.length === 0 ? '60%' : undefined,
              bottom: channels.length > 0 ? '8px' : undefined,
              background: '#111318',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5), 4px 4px 8px #050607, -4px -4px 8px #1a1d22',
              border: '1px solid rgba(127,169,152,0.15)',
              maxHeight: '260px',
              overflowY: 'auto',
            }}
          >
            {/* Close bar */}
            <div className="flex items-center justify-between px-3 py-1.5 sticky top-0 z-10"
              style={{ background: '#111318', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <span className="text-[8px] font-black uppercase tracking-[.15em]" style={{ color: '#7fa998' }}>
                Add Channel
              </span>
              <button onClick={() => setShowAddMenu(false)} className="cursor-pointer" style={{ color: '#5a616b', background: 'none', border: 'none' }}>
                <X size={12} />
              </button>
            </div>

            {ADD_CHANNEL_PRESETS.map(section => (
              <div key={section.section}>
                <div className="px-3 py-1" style={{ background: '#0a0b0d' }}>
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
                        background: '#0a0b0d',
                        boxShadow: '2px 2px 4px #050607, -2px -2px 4px #1a1d22',
                        color: section.type === 'synth' ? '#6f8fb3' : section.type === 'vocal' ? '#c77dba' : '#b8a47f',
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

            {/* â”€â”€ User Uploaded Samples â”€â”€ */}
            {userSamples.length > 0 && (
              <div>
                <div className="px-3 py-1" style={{ background: '#0a0b0d' }}>
                  <span className="text-[7px] font-black uppercase tracking-[.1em]" style={{ color: '#5a616b' }}>
                    ðŸŽ¤ Your Uploaded Samples
                  </span>
                </div>
                <div className="flex flex-wrap gap-1 px-3 py-1.5">
                  {userSamples.map((s) => {
                    const dur = s.duration_ms ? s.duration_ms / 1000 : null
                    const calcBpm = s.original_bpm || (parseBPM(code) ?? 120)
                    const loopAt = dur ? Math.max(1, Math.round(dur * calcBpm / 240)) : 8
                    return (
                      <button
                        key={s.id}
                        onClick={() => {
                          if (onAddVocalChannel) {
                            onAddVocalChannel(s.name, loopAt, s.original_bpm || undefined)
                            setShowAddMenu(false)
                          } else {
                            handleAddChannel(s.name, 'vocal', loopAt)
                          }
                        }}
                        className="px-2 py-1 rounded-lg cursor-pointer transition-all duration-[120ms] active:scale-95 hover:opacity-100 group/samp"
                        style={{
                          background: '#0a0b0d',
                          boxShadow: '2px 2px 4px #050607, -2px -2px 4px #1a1d22',
                          color: '#22d3ee',
                          fontSize: '8px',
                          fontWeight: 700,
                          border: '1px solid rgba(34,211,238,0.1)',
                          opacity: 0.85,
                        }}
                        title={`Add s("${s.name}").loopAt(${loopAt}) channel${dur ? ` Â· ${Math.floor(dur / 60)}:${String(Math.floor(dur % 60)).padStart(2, '0')}` : ''}`}
                      >
                        {s.name}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Upload hint */}
            <div className="flex items-center justify-center px-3 py-2" style={{ borderTop: '1px solid rgba(255,255,255,0.03)' }}>
              <button
                onClick={() => { setShowAddMenu(false); onOpenSampleUploader?.() }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg cursor-pointer transition-all hover:scale-105"
                style={{
                  background: 'rgba(34,211,238,0.06)',
                  border: '1px solid rgba(34,211,238,0.12)',
                  color: '#22d3ee',
                  fontSize: '8px',
                  fontWeight: 700,
                }}
              >
                <Mic size={10} />
                Upload your own vocal / sample
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Signal flow â€” hardware bottom strip */}
      {channels.length > 0 && (
        <div
          className="shrink-0 px-3 py-1"
          style={{ borderTop: '1px solid rgba(255,255,255,0.04)', background: '#0a0b0d' }}
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
                  <span key={srcIdx} className="flex items-center gap-1 text-[7px] font-mono px-2 py-0.5 rounded-full" style={{ background: '#111318', boxShadow: 'inset 1px 1px 3px #050607, inset -1px -1px 3px #1a1d22' }}>
                    <span style={{ color: src.color }} className="opacity-70">{src.name}</span>
                    <span style={{ color: '#7fa998', opacity: 0.5 }}>â†’</span>
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
                  <span className="text-[6px]" style={{ color: '#5a616b', opacity: 0.3 }}>Â·</span>
                )}
              </span>
            ))}
            <span className="text-[7px] ml-2 font-mono" style={{ color: '#5a616b' }}>â†’ OUT</span>
          </div>
        </div>
      )}
      <WaveformViewer
        url={selectedWaveformUrl}
        isOpen={waveformModalOpen}
        onClose={() => setWaveformModalOpen(false)}
        beginValue={selectedWaveformChannel >= 0 ? (channels[selectedWaveformChannel]?.params.find(p => p.key === 'begin')?.value ?? 0) : 0}
        endValue={selectedWaveformChannel >= 0 ? (channels[selectedWaveformChannel]?.params.find(p => p.key === 'end')?.value ?? 1) : 1}
        speedValue={selectedWaveformChannel >= 0 ? (channels[selectedWaveformChannel]?.params.find(p => p.key === 'speed')?.value ?? 1) : 1}
        sampleBpm={selectedWaveformChannel >= 0 ? (userSamples.find(s => s.name === channels[selectedWaveformChannel]?.source)?.original_bpm ?? undefined) : undefined}
        projectBpm={currentBPM ?? 120}
        color={selectedWaveformChannel >= 0 ? channels[selectedWaveformChannel]?.color : undefined}
        sampleName={selectedWaveformChannel >= 0 ? channels[selectedWaveformChannel]?.source : undefined}
        onApply={({ begin: b, end: e, speed: spd }) => {
          if (selectedWaveformChannel < 0) return
          let c = codeRef.current
          const idx = selectedWaveformChannel

          // Format speed to 4 decimal places max
          const spdStr = Math.round(spd * 10000) / 10000

          // â”€â”€ begin â”€â”€
          const ch1 = parseStrudelCode(c)[idx]
          if (!ch1) return
          if (ch1.effects.includes('begin')) {
            if (Math.abs(b) < 0.005) {
              c = removeEffectFromChannel(c, idx, 'begin')  // 0 = default, remove
            } else {
              c = updateParamInCode(c, idx, 'begin', b)
            }
          } else if (b > 0.005) {
            c = insertEffectInChannel(c, idx, `.begin(${b.toFixed(2)})`)
          }

          // â”€â”€ end (re-parse after begin change) â”€â”€
          const ch2 = parseStrudelCode(c)[idx]
          if (ch2 && ch2.effects.includes('end')) {
            if (Math.abs(e - 1) < 0.005) {
              c = removeEffectFromChannel(c, idx, 'end')  // 1 = default, remove
            } else {
              c = updateParamInCode(c, idx, 'end', e)
            }
          } else if (e < 0.995) {
            c = insertEffectInChannel(c, idx, `.end(${e.toFixed(2)})`)
          }

          // â”€â”€ speed (re-parse after trim changes) â”€â”€
          const ch3 = parseStrudelCode(c)[idx]
          if (ch3 && ch3.effects.includes('speed')) {
            if (Math.abs(spdStr - 1) < 0.001) {
              c = removeEffectFromChannel(c, idx, 'speed')  // 1.0 = default, remove
            } else {
              c = updateParamInCode(c, idx, 'speed', spdStr)
            }
          } else if (Math.abs(spdStr - 1) >= 0.001) {
            c = insertEffectInChannel(c, idx, `.speed(${spdStr})`)
          }

          if (onLiveCodeChange) onLiveCodeChange(c)
          else onCodeChange(c)
        }}
      />
    </div>
  )
}
