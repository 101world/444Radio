'use client'

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  STUDIO MIXER RACK v2 — Right sidebar hardware rack mixer
//  Features:
//    - Auto-parses code into channel strips with knobs
//    - Solo (S) / Mute (M) per channel — affects evaluation only
//    - Drag & drop effects from palette onto channels
//    - Knobs use position-based code replacement (never fails)
//    - Visual indicators for complex/modulated params (~)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

import { useMemo, useCallback, useState, useEffect, useRef } from 'react'
import { ChevronDown, ChevronRight, Plus, Volume2, VolumeX, Headphones, GripVertical, Link, Unlink, X, Music, Clock, Piano, Grid3X3, Copy, Trash2, RotateCcw, Mic, ZoomIn, ZoomOut, Maximize2, MoreVertical, BookOpen, Sparkles, Search, Rows3, ChevronUp } from 'lucide-react'
import StudioKnob from './StudioKnob'
import ChannelLCD from './ChannelLCD'
import WaveformViewer from './WaveformViewer'
import EffectsDocModal from './EffectsDocModal'
import TrackView from './TrackView'
import { detectPitch, semitonesBetweenRoots, semitonesToSpeed } from '@/lib/pitch-detection'
import { FX_PRESETS, FX_PRESET_CATEGORIES, type FxPresetCategory } from '@/lib/fx-presets'
import {
  parseStrudelCode, updateParamInCode, insertEffectInChannel,
  swapSoundInChannel, swapBankInChannel, addSoundToChannel, renameChannel, duplicateChannel,
  addChannel, removeChannel, resetChannel, reorderChannels,
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


// ─── Quick-add presets for Add Channel menu ───

const ADD_CHANNEL_PRESETS: { section: string; type: 'synth' | 'sample' | 'vocal'; items: [string, string][] }[] = [
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
  { section: '🎤 Vocals & Voice', type: 'vocal', items: [
    ['gm_choir_aahs', 'Choir Aahs'], ['gm_voice_oohs', 'Voice Oohs'],
    ['gm_synth_choir', 'Synth Choir'], ['gm_pad_choir', 'Choir Pad'],
    ['mouth', 'Mouth'],
  ]},
  { section: '🎵 Samples', type: 'sample', items: [
    ['casio', 'Casio'], ['jazz', 'Jazz Kit'], ['gabba', 'Gabba'],
    ['metal', 'Metal'], ['space', 'Space'],
  ]},
]

// ─── Effect category grouping for nested rack display ───

const FX_GROUPS: { label: string; icon: string; keys: string[] }[] = [
  { label: 'FILTER', icon: '🔽', keys: ['lpf', 'lp', 'hpf', 'hp', 'lpq', 'hpq', 'lpenv', 'hpenv', 'bpenv', 'lps', 'lpd', 'lpattack', 'lprelease', 'bpf', 'bpq', 'ftype', 'vowel'] },
  { label: 'DRIVE',  icon: '🔥', keys: ['shape', 'distort', 'crush', 'coarse', 'compressor'] },
  { label: 'SPACE',  icon: '🌌', keys: ['room', 'roomsize', 'roomfade', 'roomlp', 'roomdim', 'iresponse', 'delay', 'delayfeedback', 'delaytime', 'dry', 'orbit', 'echo'] },
  { label: 'MOD',    icon: '🎵', keys: ['detune', 'speed', 'pan', 'velocity', 'postgain', 'vib', 'vibmod', 'phaser', 'phaserdepth', 'phasercenter', 'phasersweep', 'tremolosync', 'tremolodepth', 'tremoloskew', 'tremolophase', 'tremoloshape', 'fast', 'slow'] },
  { label: 'FM',     icon: '📻', keys: ['fm', 'fmh', 'fmattack', 'fmdecay', 'fmsustain'] },
  { label: 'PITCH',  icon: '📈', keys: ['penv', 'pattack', 'pdecay', 'prelease', 'pcurve', 'panchor'] },
  { label: 'ENV',    icon: '⏳', keys: ['attack', 'decay', 'sustain', 'rel', 'release', 'legato', 'clip'] },
  { label: 'CHAIN',  icon: '🦆', keys: ['duckdepth', 'duckattack'] },
  { label: 'SAMPLE', icon: '🎤', keys: ['loopAt', 'loop', 'begin', 'end', 'chop', 'stretch', 'slice', 'splice', 'striate', 'fit', 'scrub', 'loopBegin', 'loopEnd', 'cut', 'n', 'hurry', 'unit'] },
]

// ─── Channel-type → relevant FX groups & effect keys ───
// Groups listed here are "native" to the type and shown in expanded view.
// Effects outside these groups still appear if user manually added them.

const TYPE_RELEVANT_FX_GROUPS: Record<string, Set<string>> = {
  synth:  new Set(['FILTER', 'DRIVE', 'SPACE', 'MOD', 'FM', 'PITCH', 'ENV']),
  note:   new Set(['FILTER', 'DRIVE', 'SPACE', 'MOD', 'FM', 'PITCH', 'ENV']),
  sample: new Set(['FILTER', 'DRIVE', 'SPACE', 'MOD', 'PITCH', 'ENV', 'SAMPLE', 'CHAIN']),
  stack:  new Set(['FILTER', 'DRIVE', 'SPACE', 'MOD', 'CHAIN']),
}

// Effect keys that only make sense for specific channel types
const INSTRUMENT_ONLY_KEYS = new Set(['detune'])      // Synth/note only
const SAMPLE_ONLY_KEYS = new Set(['speed', 'loopAt', 'loop', 'begin', 'end', 'chop', 'stretch', 'slice', 'splice', 'striate', 'fit', 'scrub', 'loopBegin', 'loopEnd', 'cut', 'n', 'hurry', 'unit'])  // Sample only

// ─── Draggable Effect Badge ───

function EffectBadge({ effect }: { effect: typeof DRAGGABLE_EFFECTS[number] }) {
  const targetIcon = effect.target === 'instrument' ? '🎹' : effect.target === 'sound' ? '🥁' : ''
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('application/x-strudel-fx', JSON.stringify(effect))
        e.dataTransfer.effectAllowed = 'copyMove'
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

// ─── Single Channel Strip ───


// ─── Mini Pattern Preview — shows pattern dots in channel node ───

function MiniPatternPreview({ channel, onClick, color }: {
  channel: { rawCode: string; sourceType: string; effects: string[] }
  onClick?: () => void
  color: string
}) {
  // Parse pattern from rawCode
  const patternData = useMemo(() => {
    const raw = channel.rawCode

    // Determine what kind of pattern this channel has
    const isVocal = channel.sourceType === 'sample' && channel.effects.includes('loopAt')
    const isDrum = channel.sourceType === 'sample' || channel.sourceType === 'stack'
    const isMelodic = channel.sourceType === 'synth' || channel.sourceType === 'note'

    // For drum/sample channels, parse s("...") pattern
    if (isDrum && !isMelodic) {
      const sMatch = raw.match(/\.?s\s*\(\s*"([^"]*)"/)
      if (sMatch) {
        const pattern = sMatch[1]
        // Tokenize: split by spaces, handle brackets, count steps
        const tokens = pattern.replace(/[\[\]<>]/g, ' ').split(/\s+/).filter(Boolean)
        const steps = Math.max(tokens.length, 1)
        const totalSlots = Math.min(Math.max(steps, 8), 32)
        // Build hit map: each token is a hit unless it's "~"
        const hits: boolean[] = []
        for (let i = 0; i < totalSlots; i++) {
          if (i < tokens.length) {
            hits.push(tokens[i] !== '~' && tokens[i] !== '-')
          } else {
            hits.push(false)
          }
        }
        return { type: 'drum' as const, hits, totalSlots, isVocal }
      }
    }

    // For melodic channels, parse n("...") or note("...") pattern
    const nMatch = raw.match(/\bn\s*\(\s*"([^"]*)"/) || raw.match(/\bnote\s*\(\s*"([^"]*)"/)
    if (nMatch) {
      const pattern = nMatch[1]
      const tokens = pattern.replace(/[\[\]<>]/g, ' ').split(/\s+/).filter(Boolean)
      const totalSlots = Math.min(Math.max(tokens.length, 8), 32)
      // Parse note values (scale degrees or note names)
      const notes: { step: number; value: number; isRest: boolean }[] = []
      for (let i = 0; i < totalSlots; i++) {
        if (i < tokens.length) {
          const token = tokens[i]
          if (token === '~' || token === '-') {
            notes.push({ step: i, value: 0, isRest: true })
          } else {
            // Try parse as number (scale degree)
            const num = parseFloat(token.replace(/[^0-9.-]/g, ''))
            notes.push({ step: i, value: isNaN(num) ? 4 : num, isRest: false })
          }
        } else {
          notes.push({ step: i, value: 0, isRest: true })
        }
      }
      return { type: 'melodic' as const, notes, totalSlots, isVocal: false }
    }

    // For vocal/loop channels with no note pattern
    if (isVocal) {
      return { type: 'vocal' as const, hits: [true], totalSlots: 1, isVocal: true }
    }

    return null
  }, [channel.rawCode, channel.sourceType, channel.effects])

  if (!patternData) return null

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    onClick?.()
  }, [onClick])

  // Drum pattern: row of dots
  if (patternData.type === 'drum') {
    return (
      <div
        onClick={handleClick}
        className="mx-1.5 my-0.5 px-1 py-[3px] rounded-lg cursor-pointer transition-all hover:opacity-80 active:scale-[0.98]"
        style={{
          background: '#0a0b0d',
          boxShadow: 'inset 1px 1px 3px #050607, inset -1px -1px 3px #16181d',
        }}
        title={patternData.isVocal ? 'Open vocal editor' : 'Open drum sequencer'}
      >
        <div className="flex gap-px justify-center">
          {patternData.hits.slice(0, 16).map((hit, i) => (
            <div key={i} className="rounded-sm" style={{
              width: 3, height: 6,
              background: hit ? `${color}90` : 'rgba(255,255,255,0.04)',
            }} />
          ))}
        </div>
      </div>
    )
  }

  // Melodic pattern: mini piano roll dots at different heights
  if (patternData.type === 'melodic') {
    const activeNotes = patternData.notes.filter(n => !n.isRest)
    const minVal = activeNotes.length > 0 ? Math.min(...activeNotes.map(n => n.value)) : 0
    const maxVal = activeNotes.length > 0 ? Math.max(...activeNotes.map(n => n.value)) : 7
    const range = Math.max(maxVal - minVal, 1)

    return (
      <div
        onClick={handleClick}
        className="mx-1.5 my-0.5 px-1 py-[3px] rounded-lg cursor-pointer transition-all hover:opacity-80 active:scale-[0.98]"
        style={{
          background: '#0a0b0d',
          boxShadow: 'inset 1px 1px 3px #050607, inset -1px -1px 3px #16181d',
        }}
        title="Open piano roll"
      >
        <div className="flex gap-px justify-center items-end" style={{ height: 14 }}>
          {patternData.notes.slice(0, 16).map((note, i) => {
            if (note.isRest) {
              return <div key={i} style={{ width: 3, height: 2, background: 'rgba(255,255,255,0.03)' }} className="rounded-sm self-end" />
            }
            const normalizedHeight = ((note.value - minVal) / range) * 10 + 3
            return (
              <div key={i} className="rounded-sm self-end" style={{
                width: 3,
                height: Math.max(3, normalizedHeight),
                background: `${color}80`,
              }} />
            )
          })}
        </div>
      </div>
    )
  }

  // Vocal: waveform-like icon
  if (patternData.type === 'vocal') {
    return (
      <div
        onClick={handleClick}
        className="mx-1.5 my-0.5 px-1 py-[3px] rounded-lg cursor-pointer transition-all hover:opacity-80 active:scale-[0.98]"
        style={{
          background: '#0a0b0d',
          boxShadow: 'inset 1px 1px 3px #050607, inset -1px -1px 3px #16181d',
        }}
        title="Open vocal editor"
      >
        <div className="flex gap-px justify-center items-center" style={{ height: 10 }}>
          {[3,5,8,11,9,12,10,8,11,7,5,9,6,4,7,3].map((h, i) => (
            <div key={i} className="rounded-sm" style={{
              width: 2, height: h,
              background: `${color}${i % 2 === 0 ? '60' : '40'}`,
            }} />
          ))}
        </div>
      </div>
    )
  }

  return null
}

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
  onOpenPadSampler,
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
  onAutoPitchMatch,
  scaleRoot,
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
  onOpenPadSampler?: () => void
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
  onAutoPitchMatch?: (channelIdx: number) => void
  scaleRoot?: string | null
  stackRows: StackRow[]
}) {
  const gainParam = channel.params.find(p => p.key === 'gain')
  const [isRenaming, setIsRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState(channel.name)
  const renameInputRef = useRef<HTMLInputElement>(null)
  const [showMoreMenu, setShowMoreMenu] = useState(false)
  const moreMenuRef = useRef<HTMLDivElement>(null)

  // Derived: is this channel melodic (synth/note) vs sample-based?
  const isMelodic = channel.sourceType === 'synth' || channel.sourceType === 'note'
  const isSample = channel.sourceType === 'sample' || channel.sourceType === 'stack'

  // All effect params — filtered by channel type relevance
  // Hides instrument-only knobs on sample channels and vice versa
  const effectKnobs = useMemo(() => {
    const skipKeys = new Set(['gain', 'orbit', 'duck'])
    // Speed is handled by the dedicated PITCH knob for sample channels
    if (channel.sourceType === 'sample') skipKeys.add('speed')
    // Filter out type-incompatible effects from compact knob view
    if (isMelodic) {
      SAMPLE_ONLY_KEYS.forEach(k => skipKeys.add(k))
    }
    if (isSample) {
      INSTRUMENT_ONLY_KEYS.forEach(k => skipKeys.add(k))
    }
    return channel.params.filter(p => !skipKeys.has(p.key))
  }, [channel, isMelodic, isSample])

  // Group effects by category — type-aware filtering
  // Shows: (1) relevant groups that have active params, (2) irrelevant groups only if they have active params (manually added)
  const fxGroups = useMemo(() => {
    const relevantGroups = TYPE_RELEVANT_FX_GROUPS[channel.sourceType] || TYPE_RELEVANT_FX_GROUPS.sample
    return FX_GROUPS.map(group => ({
      ...group,
      params: channel.params.filter(p => group.keys.includes(p.key)),
      active: group.keys.some(k => channel.effects.includes(k)),
      isRelevant: relevantGroups.has(group.label),
    })).filter(g => {
      // Always show groups with active params (user added them manually)
      if (g.active || g.params.length > 0) return true
      // Don't show empty irrelevant groups
      return false
    })
  }, [channel])

  // Close "more" menu on outside click
  useEffect(() => {
    if (!showMoreMenu) return
    const handler = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) setShowMoreMenu(false)
    }
    document.addEventListener('pointerdown', handler)
    return () => document.removeEventListener('pointerdown', handler)
  }, [showMoreMenu])

  // Determine the primary editor for this channel type
  const primaryEditor = useMemo(() => {
    const isVocal = channel.sourceType === 'sample' && channel.effects.includes('loopAt')
    const isMelodic = channel.sourceType === 'synth' || channel.sourceType === 'note'
    const isDrum = (channel.sourceType === 'sample' && !channel.effects.includes('loopAt')) || channel.sourceType === 'stack'

    if (isVocal) return 'sampler' as const    // Vocal samples with loopAt → Pad Sampler only
    if (isMelodic) return 'piano' as const    // Synths/notes → Piano Roll for melody
    if (isDrum) return 'drum' as const        // Drum samples → Drum Sequencer for step patterns
    return 'piano' as const                   // Fallback
  }, [channel.sourceType, channel.effects])

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
      {/* ── Color bar / LED strip at top ── */}
      <div
        className="h-[2px] rounded-t-2xl transition-all duration-300"
        style={{
          background: channel.color,
          opacity: isMuted ? 0.15 : isActiveNode ? 0.8 : 0.4,
          boxShadow: isActiveNode ? `0 0 6px ${channel.color}60` : 'none',
        }}
      />
      {/* Flex row: collapsed controls | expanded panel */}
      <div className={`flex ${isExpanded ? 'flex-row' : 'flex-col'}`}>
        <div className={isExpanded ? 'w-[120px] shrink-0' : 'w-full'}>
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
              className="text-[11px] leading-none shrink-0"
              style={{ color: channel.color, filter: 'drop-shadow(0 0 3px currentColor)', opacity: 0.9 }}
              title={channel.source}
            >
              {getSourceIcon(channel.source, channel.sourceType)}
            </span>
            <span
              className="text-[7px] font-extrabold uppercase tracking-[.1em] truncate font-mono"
              style={{ color: `${channel.color}aa` }}
            >
              {channel.name}
            </span>
            {channel.sourceType === 'sample' && channel.effects.includes('loopAt') && <span className="text-[6px]" title="Vocal/Sample channel">🎤</span>}
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

      {/* ── Pitch (semitones via .speed()) — only for sample channels ── */}
      {channel.sourceType === 'sample' && (() => {
        const speedParam = channel.params.find(p => p.key === 'speed')
        const currentSpeed = speedParam ? speedParam.value : 1
        const currentSemitones = Math.round(12 * Math.log2(currentSpeed))
        return (
          <div className="flex items-center justify-center gap-0.5 py-0.5 px-1" onClick={(e) => e.stopPropagation()}>
            <StudioKnob
              label="PITCH"
              value={currentSemitones}
              min={-24}
              max={24}
              step={1}
              size={24}
              color="#c4a87a"
              formatValue={(v) => (v > 0 ? `+${v}` : `${v}`)}
              onChange={(v) => {
                const newSpeed = Math.pow(2, v / 12)
                onParamChange(channelIdx, 'speed', parseFloat(newSpeed.toFixed(4)))
              }}
            />
            {/* Auto-match to project scale */}
            {scaleRoot && onAutoPitchMatch && (
              <button
                onClick={() => onAutoPitchMatch(channelIdx)}
                className="cursor-pointer transition-all duration-100 active:scale-90 group/pitch"
                style={{
                  width: 18, height: 18, borderRadius: 6,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '7px', lineHeight: 1,
                  color: '#c4a87a', background: '#0a0b0d', border: 'none',
                  boxShadow: '2px 2px 4px #050607, -2px -2px 4px #1a1d22',
                }}
                title={`Auto-match pitch to project scale (${scaleRoot})`}
              >
                <span className="group-hover/pitch:scale-125 transition-transform">🎯</span>
              </button>
            )}
          </div>
        )
      })()}

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
                color: '#6f8fb3', background: '#0a0b0d', border: 'none',
                boxShadow: '2px 2px 4px #050607, -2px -2px 4px #1a1d22',
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
                color: '#6f8fb3', background: '#0a0b0d', border: 'none',
                boxShadow: '2px 2px 4px #050607, -2px -2px 4px #1a1d22',
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
        onDoubleClick={channel.sourceType === 'sample' && channel.effects.includes('loopAt') ? onOpenWaveform : undefined}
      />

      {/* ── Mini pattern preview (clickable → opens editor) ── */}
      <MiniPatternPreview
        channel={channel}
        color={channel.color}
        onClick={() => {
          const isVocal = channel.sourceType === 'sample' && channel.effects.includes('loopAt')
          const isMelodic = channel.sourceType === 'synth' || channel.sourceType === 'note'
          if (isVocal && onOpenPadSampler) {
            onOpenPadSampler()
          } else if (isMelodic && onOpenPianoRoll) {
            onOpenPianoRoll()
          } else if (onOpenDrumSequencer) {
            onOpenDrumSequencer()
          }
        }}
      />

      {/* ── Active effect tags — removable pills, organized by type relevance ── */}
      {channel.effects.length > 0 && (
        <div className="flex flex-wrap gap-[2px] px-1.5 py-0.5" onClick={(e) => e.stopPropagation()}>
          {channel.effects
            .filter(fx => !['scope', 'pianoroll', 'orbit', 'gain'].includes(fx))
            .map(fx => {
              const isArp = fx === 'arp' || fx === 'arpeggiate'
              // Check type relevance: instrument-only effects on sample channels (or vice versa) get dimmed
              const isOffType = (isMelodic && SAMPLE_ONLY_KEYS.has(fx)) || (isSample && INSTRUMENT_ONLY_KEYS.has(fx))
              const tagColor = isArp ? '#b8a47f' : isOffType ? '#6b5a5a' : channel.color
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

      {/* ── Streamlined Action Row ──
       * Architecture: [Primary Editor + label] [Secondary editors] [⋮ overflow menu]
       *
       * Primary editor per sourceType:
       *   synth/note           → Piano Roll "Notes"  (melodic editing)
       *   sample + loopAt      → Pad Sampler         (chop & sequence — EXCLUSIVE, no piano/drum)
       *   sample (no loopAt)   → Drum Seq   "Steps"  (step-based pattern for percussion)
       *   stack                → Drum Seq   "Steps"  (multi-layer step pattern)
       *
       * Vocal (sample+loopAt) channels: ONLY pad sampler shown.
       * Instrument (pitched sample): ONLY piano roll shown.
       * No drum sequencer for uploaded samples.
       *
       * ⋮ Overflow menu: Copy, Reset, Delete (universal management — rarely used, decluttered)
       */}
      <div className="flex items-center justify-between px-1.5 pb-1.5">
        {/* Left: Editor buttons */}
        <div className="flex items-center gap-1">
          {/* ── Pad Sampler — primary for vocal/loopAt channels (EXCLUSIVE) ── */}
          {primaryEditor === 'sampler' && onOpenPadSampler && (
            <button
              onClick={(e) => { e.stopPropagation(); onOpenPadSampler() }}
              className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md transition-all cursor-pointer hover:opacity-100 active:scale-95"
              style={{
                color: '#22d3ee',
                opacity: 0.8,
                background: 'rgba(34,211,238,0.08)',
                border: '1px solid rgba(34,211,238,0.12)',
              }}
              title="Pad Sampler — chop & sequence vocal"
            >
              <span className="text-[10px] leading-none">🎹</span>
              <span className="text-[6px] font-bold leading-none">SAMPLER</span>
            </button>
          )}
          {/* ── Piano Roll — primary for melodic/pitched channels ── */}
          {primaryEditor === 'piano' && onOpenPianoRoll && (channel.sourceType === 'synth' || channel.sourceType === 'note' || channel.sourceType === 'sample') && (
            <button
              onClick={(e) => { e.stopPropagation(); onOpenPianoRoll() }}
              className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md transition-all cursor-pointer hover:opacity-100 active:scale-95"
              style={{
                color: '#6f8fb3',
                opacity: 0.8,
                background: 'rgba(111,143,179,0.08)',
                border: '1px solid rgba(111,143,179,0.12)',
              }}
              title={channel.sourceType === 'sample'
                  ? 'Piano Roll — pitched sample editing'
                  : 'Piano Roll — edit notes & melody'}
            >
              <Piano size={11} />
              <span className="text-[6px] font-bold leading-none">NOTES</span>
            </button>
          )}
          {/* ── Drum Sequencer — primary for percussion/stack channels ── */}
          {primaryEditor === 'drum' && onOpenDrumSequencer && (channel.sourceType === 'sample' || channel.sourceType === 'stack') && (
            <button
              onClick={(e) => { e.stopPropagation(); onOpenDrumSequencer() }}
              className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md transition-all cursor-pointer hover:opacity-100 active:scale-95"
              style={{
                color: '#b8a47f',
                opacity: 0.8,
                background: 'rgba(184,164,127,0.08)',
                border: '1px solid rgba(184,164,127,0.12)',
              }}
              title="Drum Sequencer — step-based pattern"
            >
              <Grid3X3 size={11} />
              <span className="text-[6px] font-bold leading-none">STEPS</span>
            </button>
          )}

          {/* ── Secondary Editor Icons (small, no label) ── */}
          {/* Piano as secondary — only for drum seq channels (sample without loopAt) */}
          {primaryEditor === 'drum' && onOpenPianoRoll && channel.sourceType === 'sample' && (
            <button
              onClick={(e) => { e.stopPropagation(); onOpenPianoRoll() }}
              className="p-0.5 rounded transition-all cursor-pointer hover:opacity-100 hover:scale-110"
              style={{ color: '#6f8fb3', opacity: 0.45 }}
              title="Piano Roll"
            >
              <Piano size={9} />
            </button>
          )}
          {/* Drum Seq as secondary — only for melodic synth/note channels (not sample) */}
          {primaryEditor === 'piano' && onOpenDrumSequencer && (channel.sourceType === 'synth' || channel.sourceType === 'note' || channel.sourceType === 'stack') && (
            <button
              onClick={(e) => { e.stopPropagation(); onOpenDrumSequencer() }}
              className="p-0.5 rounded transition-all cursor-pointer hover:opacity-100 hover:scale-110"
              style={{ color: '#b8a47f', opacity: 0.45 }}
              title="Drum Sequencer"
            >
              <Grid3X3 size={9} />
            </button>
          )}
          {/* No secondary editors for sampler channels — pad sampler is exclusive */}
        </div>

        {/* Right: FX count + ⋮ overflow menu */}
        <div className="flex items-center gap-0.5">
          {effectKnobs.length > 0 && (
            <span className="text-[5px] font-bold font-mono px-1 py-0.5 rounded" style={{ color: `${channel.color}50` }}>
              {effectKnobs.length}fx
            </span>
          )}
          {/* ⋮ More menu — Copy, Reset, Delete */}
          <div ref={moreMenuRef} className="relative">
            <button
              onClick={(e) => { e.stopPropagation(); setShowMoreMenu(v => !v) }}
              className="p-0.5 rounded transition-all cursor-pointer hover:opacity-80"
              style={{ color: '#5a616b', opacity: 0.5 }}
              title="More actions"
            >
              <MoreVertical size={10} />
            </button>
            {showMoreMenu && (
              <div
                className="absolute bottom-full right-0 mb-1 rounded-lg overflow-hidden z-50"
                style={{
                  background: '#16181d',
                  border: '1px solid rgba(255,255,255,0.08)',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
                  minWidth: '90px',
                }}
              >
                {onDuplicate && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowMoreMenu(false); onDuplicate(channelIdx) }}
                    className="flex items-center gap-1.5 w-full px-2.5 py-1.5 text-left transition-colors cursor-pointer hover:bg-white/5"
                    style={{ color: '#7fa998', fontSize: '8px', fontWeight: 700 }}
                  >
                    <Copy size={9} /> Duplicate
                  </button>
                )}
                {onReset && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowMoreMenu(false); if (confirm('Reset channel? This removes all effects and patterns.')) onReset(channelIdx) }}
                    className="flex items-center gap-1.5 w-full px-2.5 py-1.5 text-left transition-colors cursor-pointer hover:bg-white/5"
                    style={{ color: '#b8a47f', fontSize: '8px', fontWeight: 700 }}
                  >
                    <RotateCcw size={9} /> Reset
                  </button>
                )}
                {onDelete && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowMoreMenu(false); if (confirm('Delete this channel?')) onDelete(channelIdx) }}
                    className="flex items-center gap-1.5 w-full px-2.5 py-1.5 text-left transition-colors cursor-pointer hover:bg-white/5"
                    style={{ color: '#b86f6f', fontSize: '8px', fontWeight: 700 }}
                  >
                    <Trash2 size={9} /> Delete
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Drop indicator ── */}
      {isDragOver && (
        <div className="px-1.5 py-1 text-[6px] text-center font-mono font-bold" style={{ color: '#7fa998' }}>
          ⬇ DROP FX
        </div>
      )}

      {/* ── Expanded detail panel (inline, spans card width) ── */}
        </div>
      {isExpanded && (
        <div style={{ borderLeft: '1px solid rgba(255,255,255,0.06)', background: '#0a0b0d' }} className="flex-1 rounded-r-2xl overflow-y-auto min-w-0">
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
              {/* Bank selector — only for sound/sample channels (drum machines) */}
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

          {/* FX Group racks — organized by channel type relevance */}
          {fxGroups.map((group) => (
            <div key={group.label} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }} className="last:border-b-0">
              <div className="flex items-center gap-1 px-2 py-1">
                <span className="text-[7px]">{group.icon}</span>
                <span className="text-[6px] font-bold uppercase tracking-[.12em]" style={{ color: group.isRelevant ? '#5a616b' : '#3a3f46' }}>{group.label}</span>
                {!group.isRelevant && <span className="text-[5px] opacity-30" title="Not standard for this channel type">⚠</span>}
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

          {/* ── ARP section — melodic channels only (synth/note) ── */}
          {isMelodic && (() => {
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
    </div>
  )
}

// ─── Mixer Rack (right sidebar) ───

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
  onOpenPadSampler?: (channelIdx: number) => void
  onAddVocalChannel?: (name: string, loopAt: number, sampleBpm?: number) => void
  userSamples?: UserSample[]
  isPlaying?: boolean
  onPreview?: (soundCode: string) => void
  /** Returns current Strudel cycle position (fractional) for playhead sync */
  getCyclePosition?: () => number | null
  /** Project BPM for playhead speed calculation */
  projectBpm?: number
}

export default function StudioMixerRack({ code, onCodeChange, onLiveCodeChange, onMixerStateChange, metronomeEnabled = false, onMetronomeToggle, onOpenPianoRoll, onOpenDrumSequencer, onOpenPadSampler, onAddVocalChannel, userSamples = [], isPlaying: isPlayingProp = false, onPreview, getCyclePosition, projectBpm = 120 }: StudioMixerRackProps) {
  const channels = useMemo(() => parseStrudelCode(code), [code])
  const [expandedChannels, setExpandedChannels] = useState<Set<string>>(new Set())
  const [mutedChannels, setMutedChannels] = useState<Set<number>>(new Set())
  const [soloedChannels, setSoloedChannels] = useState<Set<number>>(new Set())
  const [dragOverChannel, setDragOverChannel] = useState<number | null>(null)
  const [showAddMenu, setShowAddMenu] = useState(false)
  const [fxDropdownOpen, setFxDropdownOpen] = useState(false)
  const [fxPanelMode, setFxPanelMode] = useState<'effects' | 'presets'>('effects')
  const [presetCategory, setPresetCategory] = useState<FxPresetCategory>('synth')
  const [presetSearch, setPresetSearch] = useState('')
  const [showDocsModal, setShowDocsModal] = useState(false)
  const [waveformModalOpen, setWaveformModalOpen] = useState(false)
  const [selectedWaveformUrl, setSelectedWaveformUrl] = useState<string>('')
  const [selectedWaveformChannel, setSelectedWaveformChannel] = useState<number>(-1)
  const [reorderDragIdx, setReorderDragIdx] = useState<number | null>(null)
  const [reorderOverIdx, setReorderOverIdx] = useState<number | null>(null)
  const [selectedChannels, setSelectedChannels] = useState<Set<number>>(new Set())
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; channelIdx: number } | null>(null)
  // Channel groups: each group has a name, color accent, and set of channel indices
  const [channelGroups, setChannelGroups] = useState<{ id: string; name: string; color: string; channels: Set<number> }[]>([])
  const [viewMode, setViewMode] = useState<'grid' | 'tracks'>('tracks')
  const [trackCollapsed, setTrackCollapsed] = useState<Set<number>>(new Set())
  const groupCounter = useRef(0)
  const fxDropdownRef = useRef<HTMLDivElement>(null)
  const addMenuRef = useRef<HTMLDivElement>(null)

  // ── Grid zoom & pan state ──
  const [gridZoom, setGridZoom] = useState(1.45)
  const [gridPan, setGridPan] = useState({ x: 0, y: 0 })
  const isPanningRef = useRef(false)
  const panStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 })
  const gridContainerRef = useRef<HTMLDivElement>(null)

  const ZOOM_MIN = 0.4
  const ZOOM_MAX = 2.5
  const ZOOM_STEP = 0.15

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

  // Close Add Channel dropdown on outside click
  useEffect(() => {
    if (!showAddMenu) return
    const handler = (e: MouseEvent) => {
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) {
        setShowAddMenu(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showAddMenu])

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
      } else {
        // Auto-insert any effect if not present in the channel
        const channels = parseStrudelCode(currentCode)
        const ch = channels[channelIdx]
        if (ch && !ch.rawCode.includes(`.${paramKey}(`)) {
          const inserted = insertEffectInChannel(currentCode, channelIdx, `.${paramKey}(${value})`)
          if (inserted !== currentCode) {
            liveUpdate(inserted)
          }
        }
      }
    },
    [liveUpdate],
  )

  // ── Effect insert handler (for TrackView effects panel) ──
  const handleEffectInsert = useCallback(
    (channelIdx: number, effectCode: string) => {
      const currentCode = codeRef.current
      const inserted = insertEffectInChannel(currentCode, channelIdx, effectCode)
      if (inserted !== currentCode) {
        liveUpdate(inserted)
      }
    },
    [liveUpdate],
  )

  // ── Transpose handler ──
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

  // ── Auto-pitch-match handler ──
  // Fetches sample audio, detects pitch via YIN, then shifts .speed() to match project scale root
  const handleAutoPitchMatch = useCallback(
    async (channelIdx: number) => {
      const currentCode = codeRef.current
      const channels = parseStrudelCode(currentCode)
      const ch = channels[channelIdx]
      if (!ch || ch.sourceType !== 'sample') return

      const scale = parseScale(currentCode)
      if (!scale?.root) return

      // Find sample URL from userSamples
      const sample = userSamples.find(s => s.name === ch.source)
      if (!sample?.url) return

      try {
        // Fetch and decode audio
        const response = await fetch(sample.url)
        const arrayBuffer = await response.arrayBuffer()
        const audioCtx = new AudioContext()
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer)

        // Detect pitch
        const pitchResult = detectPitch(audioBuffer)
        audioCtx.close()

        if (!pitchResult || pitchResult.confidence < 0.3) {
          console.warn('[AutoPitch] Could not detect pitch (low confidence)')
          return
        }

        const sampleRoot = pitchResult.noteName
        const targetRoot = scale.root

        // Calculate semitones and speed
        const semitones = semitonesBetweenRoots(sampleRoot, targetRoot)
        if (semitones === 0) return // Already matched

        // Factor in any existing speed value
        const speedParam = ch.params.find(p => p.key === 'speed')
        const existingSpeed = speedParam ? speedParam.value : 1
        const pitchSpeed = semitonesToSpeed(semitones)
        const finalSpeed = parseFloat((existingSpeed * pitchSpeed).toFixed(4))

        // Write .speed() to code
        if (speedParam) {
          const newCode2 = updateParamInCode(currentCode, channelIdx, 'speed', finalSpeed)
          if (newCode2 !== currentCode) liveUpdate(newCode2)
        } else {
          const inserted = insertEffectInChannel(currentCode, channelIdx, `.speed(${finalSpeed})`)
          if (inserted !== currentCode) liveUpdate(inserted)
        }

        console.log(`[AutoPitch] ${sampleRoot} → ${targetRoot} (${semitones > 0 ? '+' : ''}${semitones}st) speed=${finalSpeed}`)
      } catch (err) {
        console.error('[AutoPitch] Failed:', err)
      }
    },
    [userSamples, liveUpdate],
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

  // ── Reset handler ──
  const handleReset = useCallback(
    (channelIdx: number) => {
      const currentCode = codeRef.current
      const newCode = resetChannel(currentCode, channelIdx)
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
    (sound: string, type: 'synth' | 'sample' | 'vocal' | 'drumpad', vocalLoopAt?: number) => {
      const currentCode = codeRef.current
      const projectBpm = parseBPM(currentCode) ?? 120
      const newCode = addChannel(currentCode, sound, type, vocalLoopAt, undefined, projectBpm)
      if (newCode !== currentCode) onCodeChange(newCode)
      setShowAddMenu(false)
    },
    [onCodeChange],
  )

  // ── Channel reorder (drag-to-move) handlers ──
  const handleReorderDragStart = useCallback((idx: number) => {
    setReorderDragIdx(idx)
  }, [])

  const handleReorderDragOver = useCallback((idx: number, e: React.DragEvent) => {
    e.preventDefault()
    // Only set 'move' dropEffect for channel reorder drags.
    // FX badge drags set effectAllowed='copyMove' — setting dropEffect='move'
    // unconditionally would conflict and the browser blocks the drop event.
    if (e.dataTransfer.types.includes('application/x-channel-reorder')) {
      e.dataTransfer.dropEffect = 'move'
    }
    setReorderOverIdx(idx)
  }, [])

  const handleReorderDrop = useCallback((targetIdx: number, e: React.DragEvent) => {
    e.preventDefault()
    if (reorderDragIdx !== null && reorderDragIdx !== targetIdx) {
      const currentCode = codeRef.current
      const newCode = reorderChannels(currentCode, reorderDragIdx, targetIdx)
      if (newCode !== currentCode) onCodeChange(newCode)
    }
    setReorderDragIdx(null)
    setReorderOverIdx(null)
  }, [reorderDragIdx, onCodeChange])

  const handleReorderDragEnd = useCallback(() => {
    setReorderDragIdx(null)
    setReorderOverIdx(null)
  }, [])

  // ── Grid zoom & pan handlers ──
  const handleGridWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault()
      e.stopPropagation()
      setGridZoom(prev => {
        const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP
        return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, prev + delta))
      })
    }
  }, [])

  const handleGridPointerDown = useCallback((e: React.PointerEvent) => {
    // Middle mouse button (button=1) or Alt+left click for panning
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      e.preventDefault()
      isPanningRef.current = true
      panStartRef.current = { x: e.clientX, y: e.clientY, panX: gridPan.x, panY: gridPan.y }
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    }
  }, [gridPan])

  const handleGridPointerMove = useCallback((e: React.PointerEvent) => {
    if (!isPanningRef.current) return
    const dx = e.clientX - panStartRef.current.x
    const dy = e.clientY - panStartRef.current.y
    setGridPan({
      x: panStartRef.current.panX + dx,
      y: panStartRef.current.panY + dy,
    })
  }, [])

  const handleGridPointerUp = useCallback((e: React.PointerEvent) => {
    if (isPanningRef.current) {
      isPanningRef.current = false
      ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
    }
  }, [])

  const handleZoomIn = useCallback(() => {
    setGridZoom(prev => Math.min(ZOOM_MAX, prev + ZOOM_STEP))
  }, [])

  const handleZoomOut = useCallback(() => {
    setGridZoom(prev => Math.max(ZOOM_MIN, prev - ZOOM_STEP))
  }, [])

  const handleZoomReset = useCallback(() => {
    setGridZoom(1.45)
    setGridPan({ x: 0, y: 0 })
  }, [])

  // ── Multi-select & context menu handlers ──
  const handleChannelSelect = useCallback((idx: number, e: React.MouseEvent) => {
    if (e.ctrlKey || e.metaKey) {
      // Ctrl/Cmd+click: toggle individual channel in selection
      setSelectedChannels(prev => {
        const next = new Set(prev)
        if (next.has(idx)) next.delete(idx)
        else next.add(idx)
        return next
      })
    } else if (e.shiftKey && selectedChannels.size > 0) {
      // Shift+click: range select from existing selection to clicked
      const existingIdxs = Array.from(selectedChannels)
      const minSel = Math.min(...existingIdxs)
      const lo = Math.min(minSel, idx)
      const hi = Math.max(Math.max(...existingIdxs), idx)
      const next = new Set<number>()
      for (let i = lo; i <= hi; i++) next.add(i)
      setSelectedChannels(next)
    } else {
      // Plain click: select only this channel (deselect others)
      setSelectedChannels(prev => {
        // If already the sole selection, deselect (toggle off)
        if (prev.size === 1 && prev.has(idx)) return new Set()
        return new Set([idx])
      })
    }
  }, [selectedChannels])

  const handleContextMenu = useCallback((idx: number, e: React.MouseEvent) => {
    e.preventDefault()
    // If the right-clicked channel isn't selected, select only it
    if (!selectedChannels.has(idx)) {
      setSelectedChannels(new Set([idx]))
    }
    setContextMenu({ x: e.clientX, y: e.clientY, channelIdx: idx })
  }, [selectedChannels])

  // Close context menu on outside click
  useEffect(() => {
    if (!contextMenu) return
    const handler = () => setContextMenu(null)
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [contextMenu])

  // ── Drag & drop handlers ──
  const handleDragOver = useCallback((idx: number) => {
    setDragOverChannel(idx)
  }, [])

  const handleDragLeave = useCallback(() => {
    setDragOverChannel(null)
  }, [])

  // ── Apply FX preset (multiple effects) ──
  const applyPreset = useCallback((channelIdx: number, effects: string[]) => {
    const currentCode = codeRef.current
    let newCode = currentCode

    // Apply each effect in sequence
    for (const effect of effects) {
      newCode = insertEffectInChannel(newCode, channelIdx, effect)
    }

    if (newCode !== currentCode) {
      liveUpdate(newCode)
    }
  }, [liveUpdate])

  const handleDrop = useCallback(
    (channelIdx: number, e: React.DragEvent) => {
      e.preventDefault()
      setDragOverChannel(null)

      try {
        // ── 1) FX Preset drop (multi-effect chain) ──
        const presetData = e.dataTransfer.getData('application/x-strudel-preset')
        if (presetData) {
          const preset = JSON.parse(presetData)
          if (preset.effects && Array.isArray(preset.effects)) {
            applyPreset(channelIdx, preset.effects)
          }
          return
        }

        // ── 2) Single FX drop ──
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

        // ── 3) Sound/bank drop ──
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
    [liveUpdate, channels, applyPreset],
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
              className="absolute top-full mt-1.5 left-0 z-50 p-2 min-w-[320px]"
              style={{
                background: '#111318',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: '12px',
                boxShadow: '6px 6px 12px #050607, -4px -4px 8px #1a1d22',
                maxHeight: '420px',
                overflowY: 'auto',
              }}
            >
              {/* Tab row: FX | PRESETS | 📖 */}
              <div className="flex items-center gap-1 mb-1.5 px-1">
                {(['effects', 'presets'] as const).map(mode => (
                  <button
                    key={mode}
                    onClick={() => setFxPanelMode(mode)}
                    className="cursor-pointer transition-all duration-[120ms]"
                    style={{
                      padding: '2px 8px',
                      fontSize: '7px', fontWeight: 900, letterSpacing: '.12em', textTransform: 'uppercase',
                      borderRadius: '8px',
                      color: fxPanelMode === mode ? '#7fa998' : '#5a616b',
                      background: fxPanelMode === mode ? '#0a0b0d' : 'transparent',
                      border: 'none',
                      boxShadow: fxPanelMode === mode ? 'inset 1px 1px 3px #050607, inset -1px -1px 3px #1a1d22' : 'none',
                    }}
                  >
                    {mode === 'effects' ? '⚡ FX' : '✨ PRESETS'}
                  </button>
                ))}
                <button
                  onClick={() => { setShowDocsModal(true); setFxDropdownOpen(false) }}
                  className="cursor-pointer ml-auto transition-all duration-[120ms] hover:opacity-80"
                  style={{
                    padding: '2px 6px',
                    fontSize: '7px', fontWeight: 900,
                    borderRadius: '8px',
                    color: '#5a616b',
                    background: 'transparent',
                    border: 'none',
                  }}
                  title="Effects documentation"
                >
                  <BookOpen size={10} />
                </button>
              </div>

              {/* ── FX Mode: individual draggable effects ── */}
              {fxPanelMode === 'effects' && (
                <>
                  <div className="flex items-center gap-1.5 mb-1.5 px-1">
                    <span className="text-[7px] font-black uppercase tracking-[.2em]" style={{ color: '#5a616b' }}>EFFECTS</span>
                    <span className="text-[5px] ml-auto font-mono" style={{ color: '#5a616b' }}>drag → channel</span>
                  </div>
                  {(['filter', 'space', 'drive', 'mod', 'fm', 'pitch', 'env', 'sidechain', 'dynamics', 'pattern', 'sample'] as const).map(cat => {
                    const fxInCat = DRAGGABLE_EFFECTS.filter(fx => fx.category === cat)
                    if (fxInCat.length === 0) return null
                    const catLabels: Record<string, string> = { filter: 'FILTER', space: 'SPACE', drive: 'DRIVE', mod: 'MOD', fm: 'FM SYNTH', pitch: 'PITCH ENV', env: 'ENVELOPE', sidechain: 'SIDECHAIN', dynamics: 'DYNAMICS', pattern: 'PATTERN', sample: 'SAMPLE' }
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
                </>
              )}

              {/* ── PRESETS Mode: preset browser ── */}
              {fxPanelMode === 'presets' && (
                <>
                  {/* Search */}
                  <div className="relative mb-1.5 px-0.5">
                    <Search size={9} className="absolute left-2 top-1/2 -translate-y-1/2" style={{ color: '#5a616b' }} />
                    <input
                      type="text"
                      placeholder="Search presets…"
                      value={presetSearch}
                      onChange={e => setPresetSearch(e.target.value)}
                      className="w-full pl-6 pr-2 py-1 text-[8px] font-mono rounded-lg outline-none"
                      style={{
                        background: '#0a0b0d',
                        color: '#9aa7b3',
                        border: '1px solid rgba(255,255,255,0.04)',
                        boxShadow: 'inset 1px 1px 3px #050607, inset -1px -1px 3px #1a1d22',
                      }}
                    />
                  </div>

                  {/* Category pills */}
                  <div className="flex flex-wrap gap-1 mb-1.5 px-0.5">
                    {FX_PRESET_CATEGORIES.map(cat => (
                      <button
                        key={cat.key}
                        onClick={() => { setPresetCategory(cat.key); setPresetSearch('') }}
                        className="cursor-pointer transition-all duration-[120ms] active:scale-95"
                        style={{
                          padding: '1px 6px',
                          fontSize: '6px', fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase',
                          borderRadius: '8px',
                          color: presetCategory === cat.key ? cat.color : '#5a616b',
                          background: presetCategory === cat.key ? '#0a0b0d' : 'transparent',
                          border: 'none',
                          boxShadow: presetCategory === cat.key ? 'inset 1px 1px 3px #050607, inset -1px -1px 3px #1a1d22' : 'none',
                        }}
                      >
                        <span className="mr-0.5">{cat.icon}</span> {cat.label}
                      </button>
                    ))}
                  </div>

                  {/* Preset list */}
                  <div className="space-y-1 px-0.5 max-h-[260px] overflow-y-auto">
                    {(() => {
                      const q = presetSearch.toLowerCase().trim()
                      const filtered = FX_PRESETS.filter(p =>
                        p.category === presetCategory &&
                        (!q || p.name.toLowerCase().includes(q) || p.tags.some(t => t.includes(q)) || p.desc.toLowerCase().includes(q))
                      )
                      if (filtered.length === 0) {
                        return <span className="text-[7px] italic px-1" style={{ color: '#5a616b' }}>No presets found</span>
                      }
                      return filtered.map(preset => (
                        <div
                          key={preset.id}
                          draggable
                          onDragStart={(e) => {
                            // Pack as multi-FX — the drop handler treats it like a preset
                            e.dataTransfer.setData('application/x-strudel-preset', JSON.stringify(preset))
                            // Also set as regular FX so existing drop handler gets the first effect
                            e.dataTransfer.setData('application/x-strudel-fx', JSON.stringify({
                              ...preset,
                              code: preset.effects[0],
                              id: preset.id,
                              label: preset.name,
                              icon: FX_PRESET_CATEGORIES.find(c => c.key === preset.category)?.icon || '✨',
                            }))
                            e.dataTransfer.effectAllowed = 'copyMove'
                          }}
                          className="flex flex-col gap-0.5 px-2 py-1.5 rounded-lg cursor-grab active:cursor-grabbing
                            transition-all duration-[120ms] hover:brightness-125 group"
                          style={{
                            background: '#16181d',
                            border: '1px solid rgba(255,255,255,0.04)',
                            borderRadius: '10px',
                            boxShadow: '2px 2px 5px #050607, -2px -2px 5px #1a1d22',
                          }}
                        >
                          <div className="flex items-center gap-1.5">
                            <span className="text-[9px]">{FX_PRESET_CATEGORIES.find(c => c.key === preset.category)?.icon || '✨'}</span>
                            <span className="text-[8px] font-bold uppercase tracking-wide" style={{ color: FX_PRESET_CATEGORIES.find(c => c.key === preset.category)?.color || '#9aa7b3' }}>
                              {preset.name}
                            </span>
                            <span className="text-[6px] ml-auto font-mono opacity-0 group-hover:opacity-60 transition-opacity" style={{ color: '#5a616b' }}>
                              {preset.effects.length} fx · drag → ch
                            </span>
                          </div>
                          <span className="text-[6px] leading-tight" style={{ color: '#5a616b' }}>
                            {preset.desc}
                          </span>
                          <div className="flex flex-wrap gap-0.5 mt-0.5">
                            {preset.effects.slice(0, 5).map((fx, i) => (
                              <span key={i} className="text-[5px] font-mono px-1 py-0.5 rounded" style={{ background: '#0a0b0d', color: '#7fa998' }}>
                                {fx}
                              </span>
                            ))}
                            {preset.effects.length > 5 && (
                              <span className="text-[5px] font-mono px-1 py-0.5" style={{ color: '#5a616b' }}>
                                +{preset.effects.length - 5} more
                              </span>
                            )}
                          </div>
                        </div>
                      ))
                    })()}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="w-px h-4" style={{ background: 'rgba(255,255,255,0.06)' }} />

        {/* Divider */}
        <div className="w-px h-4" style={{ background: 'rgba(255,255,255,0.06)' }} />

        {/* Add Channel dropdown — clay pill button (like FX) */}
        <div className="relative" ref={addMenuRef}>
          <button
            onClick={() => setShowAddMenu(p => !p)}
            className="cursor-pointer transition-all duration-[180ms] active:scale-95"
            style={{
              display: 'flex', alignItems: 'center', gap: '3px',
              padding: '2px 8px',
              fontSize: '7px', fontWeight: 900, letterSpacing: '.1em', textTransform: 'uppercase' as const,
              borderRadius: '12px',
              color: showAddMenu ? '#7fa998' : '#5a616b',
              background: showAddMenu ? '#16181d' : '#0a0b0d',
              border: 'none',
              boxShadow: showAddMenu
                ? 'inset 2px 2px 4px #050607, inset -2px -2px 4px #1a1d22'
                : '2px 2px 4px #050607, -2px -2px 4px #1a1d22',
            }}
          >
            <Plus size={8} />
            ADD
          </button>

          {/* Add Channel dropdown panel */}
          {showAddMenu && (
            <div
              className="absolute top-full mt-1.5 right-0 z-50 p-0 min-w-[320px] overflow-hidden"
              style={{
                background: '#111318',
                border: '1px solid rgba(127,169,152,0.12)',
                borderRadius: '14px',
                boxShadow: '0 12px 40px rgba(0,0,0,0.6), 6px 6px 12px #050607, -4px -4px 8px #1a1d22',
                maxHeight: '360px',
                overflowY: 'auto',
              }}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-3 py-2 sticky top-0 z-10"
                style={{ background: '#111318', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#7fa998' }} />
                  <span className="text-[8px] font-black uppercase tracking-[.15em]" style={{ color: '#7fa998' }}>
                    Add Channel
                  </span>
                </div>
                <button onClick={() => setShowAddMenu(false)} className="cursor-pointer hover:opacity-80 transition-opacity" style={{ color: '#5a616b', background: 'none', border: 'none' }}>
                  <X size={11} />
                </button>
              </div>

              {ADD_CHANNEL_PRESETS.map(section => {
                const sectionColors: Record<string, string> = {
                  synth: '#6f8fb3',
                  sample: '#b8a47f',
                  vocal: '#c77dba',
                }
                return (
                  <div key={section.section}>
                    <div className="px-3 py-1" style={{ background: 'rgba(10,11,13,0.6)' }}>
                      <span className="text-[7px] font-black uppercase tracking-[.1em]" style={{ color: '#5a616b' }}>
                        {section.section}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 px-3 py-2">
                      {section.items.map(([sound, label]) => (
                        <button
                          key={sound}
                          onClick={() => handleAddChannel(sound, section.type)}
                          className="px-2.5 py-1 rounded-lg cursor-pointer transition-all duration-[120ms] active:scale-95 hover:brightness-125"
                          style={{
                            background: '#0a0b0d',
                            boxShadow: '2px 2px 4px #050607, -2px -2px 4px #1a1d22',
                            color: sectionColors[section.type] || '#b8a47f',
                            fontSize: '8px',
                            fontWeight: 700,
                            border: 'none',
                          }}
                        >
                          <span className="mr-1 opacity-60">{getSourceIcon(sound, section.type === 'synth' ? 'synth' : 'sample')}</span>
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}

              {/* Upload hint */}
            </div>
          )}
        </div>

        {/* View mode toggle */}
        <div className="flex items-center gap-0.5 ml-1">
          <button
            onClick={() => setViewMode('grid')}
            className="p-1 rounded transition-all cursor-pointer"
            style={{
              color: viewMode === 'grid' ? '#7fa998' : '#5a616b',
              background: viewMode === 'grid' ? 'rgba(127,169,152,0.1)' : 'transparent',
              border: 'none',
            }}
            title="Grid view"
          >
            <Grid3X3 size={11} />
          </button>
          <button
            onClick={() => setViewMode('tracks')}
            className="p-1 rounded transition-all cursor-pointer"
            style={{
              color: viewMode === 'tracks' ? '#7fa998' : '#5a616b',
              background: viewMode === 'tracks' ? 'rgba(127,169,152,0.1)' : 'transparent',
              border: 'none',
            }}
            title="Track view"
          >
            <Rows3 size={11} />
          </button>
        </div>

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

      {/* ── Channel Strips — glass card grid ── */}
      <div
        ref={gridContainerRef}
        className="flex-1 overflow-auto px-3 py-3 relative"
        onWheel={handleGridWheel}
        onPointerDown={handleGridPointerDown}
        onPointerMove={handleGridPointerMove}
        onPointerUp={handleGridPointerUp}
        style={{ cursor: isPanningRef.current ? 'grabbing' : undefined }}
      >
        {channels.length === 0 ? (
          /* ── Empty state: prompt to add first channel ── */
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
            {/* ═══ TRACK VIEW — horizontal DAW-style lanes with synced playhead ═══ */}
            {viewMode === 'tracks' && (
              <TrackView
                channels={channels}
                isPlaying={isPlayingProp}
                mutedChannels={mutedChannels}
                soloedChannels={soloedChannels}
                trackCollapsed={trackCollapsed}
                dragOverChannel={dragOverChannel}
                getCyclePosition={getCyclePosition}
                projectBpm={projectBpm}
                onToggleCollapse={(idx: number) => setTrackCollapsed(prev => {
                  const next = new Set(prev)
                  next.has(idx) ? next.delete(idx) : next.add(idx)
                  return next
                })}
                onSolo={(idx: number) => handleSolo(idx, true)}
                onMute={handleMute}
                onToggleChannel={toggleChannel}
                onParamChange={handleParamChange}
                onEffectInsert={handleEffectInsert}
                onRemoveEffect={handleRemoveEffect}
                onOpenPianoRoll={onOpenPianoRoll}
                onOpenDrumSequencer={onOpenDrumSequencer}
                onOpenPadSampler={onOpenPadSampler}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onShowAddMenu={() => setShowAddMenu(v => !v)}
                getSourceIcon={getSourceIcon}
              />
            )}

            {/* ═══ GRID VIEW — card-based grid layout ═══ */}
            {viewMode === 'grid' && (
            <div
              className="grid gap-2"
              style={{
                gridTemplateColumns: `repeat(auto-fill, minmax(${Math.round(100 * gridZoom)}px, 1fr))`,
                transform: `translate(${gridPan.x}px, ${gridPan.y}px)`,
                transformOrigin: '0 0',
              }}
            >
              {channels.map((ch, idx) => {
                const channelGroup = channelGroups.find(g => g.channels.has(idx))
                return (
                <div
                  key={ch.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('application/x-channel-reorder', String(idx))
                    e.dataTransfer.effectAllowed = 'move'
                    handleReorderDragStart(idx)
                  }}
                  onDragOver={(e) => handleReorderDragOver(idx, e)}
                  onDragEnd={handleReorderDragEnd}
                  onDrop={(e) => {
                    // Only handle reorder drops (not FX drops)
                    const reorderData = e.dataTransfer.getData('application/x-channel-reorder')
                    if (reorderData) {
                      handleReorderDrop(idx, e)
                      return
                    }
                  }}
                  onClick={(e) => handleChannelSelect(idx, e)}
                  onContextMenu={(e) => handleContextMenu(idx, e)}
                  className="relative"
                  style={{
                    opacity: reorderDragIdx === idx ? 0.4 : 1,
                    transition: 'opacity 150ms, transform 150ms',
                    transform: reorderOverIdx === idx && reorderDragIdx !== idx ? 'scale(1.02)' : undefined,
                    gridColumn: expandedChannels.has(ch.id) ? 'span 2' : undefined,
                  }}
                >
                  {/* Group indicator badge */}
                  {channelGroup && (
                    <div className="absolute -top-1 -right-1 z-20 flex items-center gap-0.5 px-1 py-0.5 rounded-full"
                      style={{
                        background: '#111318',
                        border: `1px solid ${channelGroup.color}40`,
                        boxShadow: `0 0 4px ${channelGroup.color}20`,
                      }}
                    >
                      <div className="w-1.5 h-1.5 rounded-full" style={{ background: channelGroup.color }} />
                      <span className="text-[6px] font-black" style={{ color: channelGroup.color }}>{channelGroup.name}</span>
                    </div>
                  )}
                  {/* Group border */}
                  {channelGroup && (
                    <div className="absolute inset-0 rounded-2xl pointer-events-none z-[5]"
                      style={{ border: `1px solid ${channelGroup.color}25` }} />
                  )}
                  {/* Selection ring */}
                  {selectedChannels.has(idx) && (
                    <div className="absolute inset-0 rounded-2xl pointer-events-none z-10"
                      style={{ border: '2px solid rgba(127,169,152,0.5)', boxShadow: '0 0 8px rgba(127,169,152,0.2)' }} />
                  )}
                  {/* Reorder drop indicator */}
                  {reorderOverIdx === idx && reorderDragIdx !== null && reorderDragIdx !== idx && (
                    <div className="absolute -left-1 top-0 bottom-0 w-0.5 rounded-full z-10"
                      style={{ background: '#7fa998', boxShadow: '0 0 6px #7fa998' }} />
                  )}
                  <ChannelStrip
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
                    onOpenPadSampler={onOpenPadSampler ? () => onOpenPadSampler(idx) : undefined}
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
                    onAutoPitchMatch={handleAutoPitchMatch}
                    scaleRoot={currentScale?.root ?? null}
                  />
                </div>
                )
              })}

              {/* ── Add Channel tile (inline in grid) ── */}
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
            )}

            {/* ── Context Menu (right-click) ── */}
            {contextMenu && (
              <div
                className="fixed z-[100] py-1 rounded-lg overflow-hidden"
                style={{
                  left: contextMenu.x,
                  top: contextMenu.y,
                  background: '#16181d',
                  border: '1px solid rgba(255,255,255,0.08)',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.6), 4px 4px 8px #050607',
                  minWidth: '140px',
                }}
              >
                {selectedChannels.size >= 2 && (
                  <button
                    className="w-full text-left px-3 py-1.5 text-[9px] font-bold cursor-pointer hover:bg-white/[0.06] transition-colors flex items-center gap-2"
                    style={{ color: '#7fa998', border: 'none', background: 'none' }}
                    onClick={() => {
                      // Group selected channels — shared orbit + visual group
                      const sorted = Array.from(selectedChannels).sort((a, b) => a - b)
                      let c = codeRef.current
                      const parsedChs = parseStrudelCode(c)
                      const targetOrbit = findNextFreeOrbit(parsedChs)
                      for (const chIdx of sorted) {
                        c = setChannelOrbit(c, chIdx, targetOrbit)
                      }
                      onCodeChange(c)

                      // Create visual group
                      groupCounter.current++
                      const GROUP_COLORS = ['#7fa998', '#6f8fb3', '#c77dba', '#b8a47f', '#22d3ee', '#e879a8']
                      const gColor = GROUP_COLORS[(groupCounter.current - 1) % GROUP_COLORS.length]
                      setChannelGroups(prev => [
                        ...prev,
                        {
                          id: `grp-${groupCounter.current}`,
                          name: `Group ${groupCounter.current}`,
                          color: gColor,
                          channels: new Set(sorted),
                        }
                      ])
                      setSelectedChannels(new Set())
                      setContextMenu(null)
                    }}
                  >
                    <span>⬡</span> Group Channels ({selectedChannels.size})
                  </button>
                )}
                {/* Ungroup option — if right-clicked channel is in a group */}
                {channelGroups.some(g => g.channels.has(contextMenu.channelIdx)) && (
                  <button
                    className="w-full text-left px-3 py-1.5 text-[9px] font-bold cursor-pointer hover:bg-white/[0.06] transition-colors flex items-center gap-2"
                    style={{ color: '#b8a47f', border: 'none', background: 'none' }}
                    onClick={() => {
                      // Ungroup: remove channel(s) from their group
                      const idxsToRemove = selectedChannels.size >= 2 ? selectedChannels : new Set([contextMenu.channelIdx])
                      setChannelGroups(prev => prev
                        .map(g => ({
                          ...g,
                          channels: new Set(Array.from(g.channels).filter(i => !idxsToRemove.has(i)))
                        }))
                        .filter(g => g.channels.size >= 2) // dissolve groups with < 2 members
                      )
                      // Also remove shared orbit
                      let c = codeRef.current
                      for (const chIdx of idxsToRemove) {
                        c = removeEffectFromChannel(c, chIdx, 'orbit')
                      }
                      onCodeChange(c)
                      setSelectedChannels(new Set())
                      setContextMenu(null)
                    }}
                  >
                    <span>⊘</span> Ungroup
                  </button>
                )}
                <button
                  className="w-full text-left px-3 py-1.5 text-[9px] font-bold cursor-pointer hover:bg-white/[0.06] transition-colors flex items-center gap-2"
                  style={{ color: '#6f8fb3', border: 'none', background: 'none' }}
                  onClick={() => {
                    handleDuplicate(contextMenu.channelIdx)
                    setContextMenu(null)
                  }}
                >
                  <Copy size={10} /> Duplicate
                </button>
                <button
                  className="w-full text-left px-3 py-1.5 text-[9px] font-bold cursor-pointer hover:bg-white/[0.06] transition-colors flex items-center gap-2"
                  style={{ color: '#b8a47f', border: 'none', background: 'none' }}
                  onClick={() => {
                    handleReset(contextMenu.channelIdx)
                    setContextMenu(null)
                  }}
                >
                  <RotateCcw size={10} /> Reset
                </button>
                <div className="mx-2 my-0.5" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }} />
                <button
                  className="w-full text-left px-3 py-1.5 text-[9px] font-bold cursor-pointer hover:bg-white/[0.06] transition-colors flex items-center gap-2"
                  style={{ color: '#b86f6f', border: 'none', background: 'none' }}
                  onClick={() => {
                    // Delete all selected, or just the right-clicked one
                    const toDelete = selectedChannels.size >= 2 ? Array.from(selectedChannels).sort((a, b) => b - a) : [contextMenu.channelIdx]
                    let c = codeRef.current
                    for (const delIdx of toDelete) {
                      c = removeChannel(c, delIdx)
                    }
                    onCodeChange(c)
                    setSelectedChannels(new Set())
                    setContextMenu(null)
                  }}
                >
                  <Trash2 size={10} /> Delete {selectedChannels.size >= 2 ? `(${selectedChannels.size})` : ''}
                </button>
              </div>
            )}
          </>
        )}

        {/* ── Grid Zoom Controls (bottom-right) — only in grid view ── */}
        {channels.length > 0 && viewMode === 'grid' && (
          <div className="absolute bottom-2 right-4 z-30 flex items-center gap-1 px-1.5 py-1 rounded-xl"
            style={{
              background: '#0a0b0d',
              boxShadow: '3px 3px 6px #050607, -3px -3px 6px #1a1d22',
              border: '1px solid rgba(255,255,255,0.05)',
            }}
          >
            <button onClick={handleZoomOut} className="p-1 cursor-pointer transition-colors hover:text-white/60"
              style={{ color: '#5a616b', background: 'none', border: 'none' }} title="Zoom out (Ctrl+scroll)">
              <ZoomOut size={11} />
            </button>
            <span className="text-[7px] font-mono font-bold px-1" style={{ color: '#7fa998', minWidth: 28, textAlign: 'center' }}>
              {Math.round(gridZoom * 100)}%
            </span>
            <button onClick={handleZoomIn} className="p-1 cursor-pointer transition-colors hover:text-white/60"
              style={{ color: '#5a616b', background: 'none', border: 'none' }} title="Zoom in (Ctrl+scroll)">
              <ZoomIn size={11} />
            </button>
            <div className="w-px h-3 bg-white/[0.08]" />
            <button onClick={handleZoomReset} className="p-1 cursor-pointer transition-colors hover:text-white/60"
              style={{ color: '#5a616b', background: 'none', border: 'none' }} title="Reset zoom & pan">
              <Maximize2 size={10} />
            </button>
          </div>
        )}
      </div>

      {/* Group summary strip */}
      {channelGroups.length > 0 && (
        <div
          className="shrink-0 px-3 py-1.5 flex flex-wrap items-center gap-2"
          style={{ borderTop: '1px solid rgba(255,255,255,0.04)', background: '#0d0e11' }}
        >
          <span className="text-[6px] font-black uppercase tracking-[.15em]" style={{ color: '#5a616b' }}>GROUPS</span>
          {channelGroups.map(group => (
            <div key={group.id} className="flex items-center gap-1.5 px-2 py-0.5 rounded-full"
              style={{
                background: '#111318',
                border: `1px solid ${group.color}30`,
                boxShadow: 'inset 1px 1px 3px #050607, inset -1px -1px 3px #1a1d22',
              }}
            >
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: group.color }} />
              <span className="text-[7px] font-bold" style={{ color: group.color }}>{group.name}</span>
              <span className="text-[6px] font-mono" style={{ color: '#5a616b' }}>
                {Array.from(group.channels).map(i => channels[i]?.name || `ch${i}`).join(', ')}
              </span>
              <button
                onClick={() => {
                  // Dissolve this group
                  let c = codeRef.current
                  for (const chIdx of group.channels) {
                    c = removeEffectFromChannel(c, chIdx, 'orbit')
                  }
                  onCodeChange(c)
                  setChannelGroups(prev => prev.filter(g => g.id !== group.id))
                }}
                className="cursor-pointer hover:opacity-80 transition-opacity"
                style={{ color: '#5a616b', background: 'none', border: 'none' }}
                title="Dissolve group"
              >
                <X size={8} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Signal flow — hardware bottom strip */}
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
        scaleRoot={currentScale?.root ?? null}
        onApply={({ begin: b, end: e, speed: spd }) => {
          if (selectedWaveformChannel < 0) return
          let c = codeRef.current
          const idx = selectedWaveformChannel

          // Format speed to 4 decimal places max
          const spdStr = Math.round(spd * 10000) / 10000

          // ── begin ──
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

          // ── end (re-parse after begin change) ──
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

          // ── speed (re-parse after trim changes) ──
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
