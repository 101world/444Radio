'use client'

import { useEffect, useRef, useState, useCallback, useMemo, lazy, Suspense, forwardRef, useImperativeHandle } from 'react'
import ReactDOM from 'react-dom'
import { Volume2, VolumeX, GripHorizontal, Plus, Trash2, Copy, ChevronDown, Maximize2, Minimize2, ChevronLeft, ChevronRight, Piano, LayoutList, Columns, Upload } from 'lucide-react'
import { useKeyChords, buildDiatonicChords } from './node-editor/KeyChords'

const PianoRoll = lazy(() => import('./node-editor/PianoRoll'))
const DrumSequencer = lazy(() => import('./node-editor/DrumSequencer'))
const BottomTimeline = lazy(() => import('./node-editor/BottomTimeline'))
const SoundUploader = lazy(() => import('./node-editor/SoundUploader'))
const SoundSlicer = lazy(() => import('./node-editor/SoundSlicer'))
import MiniPianoRoll from './node-editor/MiniPianoRoll'
import MiniDrumGrid from './node-editor/MiniDrumGrid'

// ═══════════════════════════════════════════════════════════════
//  TYPES
// ═══════════════════════════════════════════════════════════════

interface PatternNode {
  id: string
  name: string
  code: string       // raw code block as it appears in the editor
  muted: boolean
  solo: boolean
  collapsed: boolean  // collapsed mode: waveform + name + chord + solo/mute only
  x: number
  y: number
  type: NodeType
  // Detected values (read from code, NEVER modify code for unchanged values)
  gain: number
  lpf: number
  hpf: number
  pan: number
  room: number
  roomsize: number
  delay: number
  delayfeedback: number
  delaytime: number
  crush: number
  coarse: number
  shape: number
  distort: number
  speed: number       // .slow() factor
  vowel: string
  velocity: number
  // ADSR
  attack: number
  decay: number
  sustain: number
  release: number
  // Modulation
  phaser: number
  phaserdepth: number
  vibmod: number
  // Filter resonance
  lpq: number
  hpq: number
  // FM
  fmi: number
  // Misc
  orbit: number
  scale: string
  pattern: string
  soundSource: string
  sound: string
}

type NodeType = 'drums' | 'bass' | 'melody' | 'chords' | 'fx' | 'vocal' | 'pad' | 'other'

// Connection type removed — nodes are independent $: blocks, wires were cosmetic

// Track which fields the user has ACTUALLY changed via knobs (not just detected)
interface NodeOverrides {
  [nodeId: string]: Partial<Record<string, number | string>>
}

// ═══════════════════════════════════════════════════════════════
//  HARDWARE PALETTE
// ═══════════════════════════════════════════════════════════════

const HW = {
  bg:           '#0a0a0c',
  surface:      '#131316',
  surfaceAlt:   '#18181b',
  raised:       '#222226',
  raisedLight:  '#2c2c31',
  knobBg:       '#1a1a1e',
  knobRing:     '#2e2e33',
  border:       'rgba(255,255,255,0.05)',
  borderLight:  'rgba(255,255,255,0.08)',
  text:         '#777',
  textDim:      '#444',
  textBright:   '#bbb',
}

const TYPE_COLORS: Record<NodeType, string> = {
  drums:  '#f59e0b',
  bass:   '#ef4444',
  melody: '#22d3ee',
  chords: '#a78bfa',
  fx:     '#34d399',
  vocal:  '#f472b6',
  pad:    '#818cf8',
  other:  '#94a3b8',
}

const TYPE_ICONS: Record<NodeType, string> = {
  drums: '⬤', bass: '◆', melody: '▲', chords: '■', fx: '✦', vocal: '●', pad: '◈', other: '◉',
}

// ═══════════════════════════════════════════════════════════════
//  SMART GUIDANCE — contextual hints per node type
// ═══════════════════════════════════════════════════════════════

const NODE_GUIDANCE: Record<NodeType, string> = {
  drums:  'Sound · s("bd sd hh") drum pattern · Add reverb, delay, filters · Try echo, euclid, chop for variation',
  bass:   'Instrument · note().s("synth") · Set key & scale · Chord patterns auto-match key · LPF for warmth',
  melody: 'Instrument · note().s("synth") · Set key & scale · Use chord/arp patterns · delay, reverb, jux',
  chords: 'Instrument · note("<chord>").s("synth") · Set key & scale · Chord progressions auto-match key',
  pad:    'Instrument · note().s("synth") · Long release · Chord/arp patterns · reverb, delay, phaser',
  vocal:  'Instrument · note().s("choir/voice") · Set key & scale · reverb, delay, vowel filter',
  fx:     'Sound · s("fx samples") · Layer effects freely · Try echo, jux, striate for texture',
  other:  'General purpose node · Add any effects from + FX below',
}

// ═══════════════════════════════════════════════════════════════
//  QUICK-ADD FX — audio effects that create knobs when added
// ═══════════════════════════════════════════════════════════════

const QUICK_ADD_FX: { id: string; label: string; method: string; defaultVal: number | string; desc: string; color: string }[] = [
  // ── Mix Essentials (always needed) ──
  { id: 'gain', label: 'GAIN', method: 'gain', defaultVal: 0.8, desc: 'Volume gain', color: '#34d399' },
  { id: 'pan', label: 'PAN', method: 'pan', defaultVal: 0.5, desc: 'Stereo pan', color: '#34d399' },
  // ── Space (reverb + delay) ──
  { id: 'room', label: 'VERB', method: 'room', defaultVal: 0.3, desc: 'Add reverb', color: '#22d3ee' },
  { id: 'size', label: 'SIZE', method: 'size', defaultVal: 0.5, desc: 'Reverb size (pairs with room)', color: '#22d3ee' },
  { id: 'delay', label: 'DLY', method: 'delay', defaultVal: 0.5, desc: 'Add delay', color: '#fb923c' },
  { id: 'delaytime', label: 'DLTM', method: 'delaytime', defaultVal: 0.25, desc: 'Delay time', color: '#fb923c' },
  { id: 'delayfeedback', label: 'DLFB', method: 'delayfeedback', defaultVal: 0.4, desc: 'Delay feedback amount', color: '#fb923c' },
  // ── Filters ──
  { id: 'lpf', label: 'LPF', method: 'lpf', defaultVal: 8000, desc: 'Low pass filter', color: '#60a5fa' },
  { id: 'hpf', label: 'HPF', method: 'hpf', defaultVal: 200, desc: 'High pass filter', color: '#60a5fa' },
  { id: 'djf', label: 'DJF', method: 'djf', defaultVal: 0.5, desc: 'DJ filter (0→LP, 0.5→off, 1→HP)', color: '#60a5fa' },
  { id: 'lpq', label: 'RES', method: 'lpq', defaultVal: 5, desc: 'Filter resonance', color: '#60a5fa' },
  // ── Distortion & Character ──
  { id: 'distort', label: 'DIST', method: 'distort', defaultVal: 1, desc: 'Distortion', color: '#ef4444' },
  { id: 'crush', label: 'CRSH', method: 'crush', defaultVal: 8, desc: 'Bitcrush', color: '#ef4444' },
  { id: 'shape', label: 'SHPE', method: 'shape', defaultVal: 0.5, desc: 'Waveshaper', color: '#ef4444' },
  { id: 'squiz', label: 'SQUZ', method: 'squiz', defaultVal: 2, desc: 'Squiz distortion', color: '#ef4444' },
  { id: 'waveloss', label: 'WLSS', method: 'waveloss', defaultVal: 40, desc: 'Random sample loss', color: '#ef4444' },
  // ── Modulation ──
  { id: 'phaser', label: 'PHSR', method: 'phaser', defaultVal: 4, desc: 'Phaser', color: '#a78bfa' },
  { id: 'leslie', label: 'LSLE', method: 'leslie', defaultVal: 1, desc: 'Leslie rotary speaker', color: '#a78bfa' },
  { id: 'vib', label: 'VIB', method: 'vib', defaultVal: 4, desc: 'Vibrato depth', color: '#a78bfa' },
  // ── FM Synthesis ──
  { id: 'fmi', label: 'FM', method: 'fmi', defaultVal: 2, desc: 'FM synthesis', color: '#818cf8' },
  { id: 'fmh', label: 'FMH', method: 'fmh', defaultVal: 1, desc: 'FM harmonicity ratio', color: '#818cf8' },
  { id: 'noise', label: 'NOIZ', method: 'noise', defaultVal: 0.5, desc: 'Noise mix', color: '#94a3b8' },
  // ── Envelope (ADSR) ──
  { id: 'attack', label: 'ATK', method: 'attack', defaultVal: 0.01, desc: 'Attack time', color: '#818cf8' },
  { id: 'decay', label: 'DCY', method: 'decay', defaultVal: 0.2, desc: 'Decay time', color: '#818cf8' },
  { id: 'sustain', label: 'SUS', method: 'sustain', defaultVal: 0.5, desc: 'Sustain level', color: '#818cf8' },
  { id: 'release', label: 'REL', method: 'release', defaultVal: 0.3, desc: 'Release time', color: '#818cf8' },
  // ── Playback / Sample ──
  { id: 'speed', label: 'SPD', method: 'speed', defaultVal: 1, desc: 'Playback speed / pitch', color: '#fb923c' },
  { id: 'n', label: 'N', method: 'n', defaultVal: 0, desc: 'Sample variation / note index', color: '#f59e0b' },
  { id: 'octave', label: 'OCT', method: 'octave', defaultVal: 4, desc: 'Octave shift', color: '#c084fc' },
  { id: 'coarse', label: 'COARSE', method: 'coarse', defaultVal: 8, desc: 'Coarse', color: '#f59e0b' },
  { id: 'velocity', label: 'VEL', method: 'velocity', defaultVal: 1, desc: 'Velocity', color: '#94a3b8' },
  // ── Tremolo (amplitude modulation) ──
  { id: 'tremolosync', label: 'TREM', method: 'tremolosync', defaultVal: 4, desc: 'Tremolo speed (cycles)', color: '#a78bfa' },
  { id: 'tremolodepth', label: 'TRMD', method: 'tremolodepth', defaultVal: 0.5, desc: 'Tremolo depth', color: '#a78bfa' },
  // ── Filter Envelope ──
  { id: 'lpenv', label: 'LPE', method: 'lpenv', defaultVal: 4, desc: 'LP filter envelope depth', color: '#60a5fa' },
  { id: 'lpattack', label: 'LPA', method: 'lpattack', defaultVal: 0.1, desc: 'LP envelope attack', color: '#60a5fa' },
  { id: 'lpdecay', label: 'LPD', method: 'lpdecay', defaultVal: 0.2, desc: 'LP envelope decay', color: '#60a5fa' },
  // ── Pitch Envelope ──
  { id: 'penv', label: 'PENV', method: 'penv', defaultVal: 12, desc: 'Pitch envelope (semitones)', color: '#c084fc' },
  // ── Post Processing ──
  { id: 'postgain', label: 'POST', method: 'postgain', defaultVal: 1, desc: 'Gain after all effects', color: '#34d399' },
  { id: 'orbit', label: 'ORBT', method: 'orbit', defaultVal: 1, desc: 'Effect bus (isolates delay/reverb)', color: '#94a3b8' },
]

// ═══════════════════════════════════════════════════════════════
//  PRESETS
// ═══════════════════════════════════════════════════════════════

const SOUND_PRESETS: Record<string, { label: string; value: string }[]> = {
  drums: [
    { label: 'TR-808', value: 'RolandTR808' },
    { label: 'TR-909', value: 'RolandTR909' },
    { label: 'CR-78', value: 'RolandCR78' },
    { label: 'CompuRhythm', value: 'RolandCompuRhythm8000' },
    { label: 'Linn Drum', value: 'AkaiLinn' },
    { label: 'Korg Minipops', value: 'KorgMinipops' },
    { label: 'Boss DR-55', value: 'BossDR55' },
    { label: 'Space Drum', value: 'ViscoSpaceDrum' },
    { label: 'Akai XR10', value: 'AkaiXR10' },
    { label: 'Rhythm Ace', value: 'RhythmAce' },
  ],
  bass: [
    { label: 'Sine Bass', value: 'sine' },
    { label: 'Saw Bass', value: 'sawtooth' },
    { label: 'Square Bass', value: 'square' },
    { label: 'Acoustic Bass', value: 'gm_acoustic_bass' },
    { label: 'E-Bass Finger', value: 'gm_electric_bass_finger' },
    { label: 'Slap Bass', value: 'gm_slap_bass_1' },
    { label: 'Synth Bass 1', value: 'gm_synth_bass_1' },
    { label: 'Synth Bass 2', value: 'gm_synth_bass_2' },
  ],
  melody: [
    { label: 'Piano', value: 'gm_piano' },
    { label: 'Bright Piano', value: 'gm_bright_piano' },
    { label: 'E-Piano', value: 'gm_epiano1' },
    { label: 'Music Box', value: 'gm_music_box' },
    { label: 'Vibraphone', value: 'gm_vibraphone' },
    { label: 'Marimba', value: 'gm_marimba' },
    { label: 'Flute', value: 'gm_flute' },
    { label: 'Clarinet', value: 'gm_clarinet' },
    { label: 'Violin', value: 'gm_violin' },
    { label: 'Trumpet', value: 'gm_trumpet' },
    { label: 'Sine', value: 'sine' },
    { label: 'Triangle', value: 'triangle' },
    { label: 'Sawtooth', value: 'sawtooth' },
    { label: 'Kalimba', value: 'gm_kalimba' },
    { label: 'Ocarina', value: 'gm_ocarina' },
    { label: 'Sitar', value: 'gm_sitar' },
    { label: 'Steel Drum', value: 'gm_steel_drum' },
  ],
  chords: [
    { label: 'Rhodes', value: 'gm_epiano1' },
    { label: 'E-Piano 2', value: 'gm_epiano2' },
    { label: 'Piano', value: 'gm_piano' },
    { label: 'Organ', value: 'gm_drawbar_organ' },
    { label: 'Church Organ', value: 'gm_church_organ' },
    { label: 'Strings', value: 'gm_string_ensemble_1' },
    { label: 'Nylon Guitar', value: 'gm_acoustic_guitar_nylon' },
    { label: 'Steel Guitar', value: 'gm_acoustic_guitar_steel' },
    { label: 'Jazz Guitar', value: 'gm_electric_guitar_jazz' },
    { label: 'Saw Synth', value: 'sawtooth' },
    { label: 'Harpsichord', value: 'gm_harpsichord' },
    { label: 'Accordion', value: 'gm_accordion' },
  ],
  pad: [
    { label: 'Saw Pad', value: 'sawtooth' },
    { label: 'Warm Pad', value: 'gm_warm_pad' },
    { label: 'Halo Pad', value: 'gm_halo_pad' },
    { label: 'Sweep Pad', value: 'gm_sweep_pad' },
    { label: 'Choir', value: 'gm_choir_aahs' },
    { label: 'Voices', value: 'gm_voice_oohs' },
    { label: 'Crystal', value: 'gm_crystal' },
    { label: 'Strings', value: 'gm_string_ensemble_2' },
  ],
  vocal: [
    { label: 'Choir Aahs', value: 'gm_choir_aahs' },
    { label: 'Voice Oohs', value: 'gm_voice_oohs' },
    { label: 'Synth Voice', value: 'gm_synth_voice' },
    { label: 'Synth Choir', value: 'gm_synth_choir' },
    { label: 'Whistle', value: 'gm_whistle' },
    { label: 'Flute', value: 'gm_flute' },
    { label: 'Oboe', value: 'gm_oboe' },
    { label: 'Sax Soprano', value: 'gm_soprano_sax' },
    { label: 'Sine (clean)', value: 'sine' },
    { label: 'Triangle (soft)', value: 'triangle' },
  ],
  fx: [
    { label: 'TR-808 (percussive)', value: 'RolandTR808' },
    { label: 'TR-909 (punchy)', value: 'RolandTR909' },
    { label: 'Sine Wash', value: 'sine' },
    { label: 'Noise / Texture', value: 'square' },
    { label: 'Metallic', value: 'triangle' },
    { label: 'Wind Chime', value: 'gm_tinkle_bell' },
    { label: 'Woodblock', value: 'gm_woodblock' },
    { label: 'Taiko Drum', value: 'gm_taiko_drum' },
  ],
  other: [
    { label: 'Sine', value: 'sine' },
    { label: 'Sawtooth', value: 'sawtooth' },
    { label: 'Square', value: 'square' },
    { label: 'Triangle', value: 'triangle' },
    { label: 'SuperSaw', value: 'supersaw' },
    { label: 'Piano', value: 'gm_piano' },
    { label: 'E-Piano', value: 'gm_epiano1' },
    { label: 'Strings', value: 'gm_string_ensemble_1' },
  ],
}

// Time signatures: label for display, beatsPerBar for setcps calculation
const TIME_SIGNATURES: { label: string; value: string; beatsPerBar: number }[] = [
  { label: '4/4', value: '4/4', beatsPerBar: 4 },
  { label: '3/4', value: '3/4', beatsPerBar: 3 },
  { label: '2/4', value: '2/4', beatsPerBar: 2 },
  { label: '6/8', value: '6/8', beatsPerBar: 6 },
  { label: '5/4', value: '5/4', beatsPerBar: 5 },
  { label: '7/8', value: '7/8', beatsPerBar: 7 },
  { label: '12/8', value: '12/8', beatsPerBar: 12 },
  { label: '9/8', value: '9/8', beatsPerBar: 9 },
]

// ═══════════════════════════════════════════════════════════════
//  COMPLETE SCALE PRESETS — every root × every mode/scale type
// ═══════════════════════════════════════════════════════════════
const SCALE_ROOTS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const
const SCALE_TYPES: { label: string; value: string; octave: number }[] = [
  { label: 'Major',           value: 'major',           octave: 4 },
  { label: 'Minor',           value: 'minor',           octave: 3 },
  { label: 'Harm Min',        value: 'harmonic minor',  octave: 3 },
  { label: 'Mel Min',         value: 'melodic minor',   octave: 3 },
  { label: 'Dorian',          value: 'dorian',          octave: 4 },
  { label: 'Phrygian',        value: 'phrygian',        octave: 4 },
  { label: 'Lydian',          value: 'lydian',          octave: 4 },
  { label: 'Mixolydian',      value: 'mixolydian',      octave: 4 },
  { label: 'Locrian',         value: 'locrian',         octave: 4 },
  { label: 'Maj Pent',        value: 'major pentatonic', octave: 4 },
  { label: 'Min Pent',        value: 'minor pentatonic', octave: 3 },
  { label: 'Blues',            value: 'blues',           octave: 4 },
  { label: 'Whole Tone',      value: 'whole tone',      octave: 4 },
  { label: 'Diminished',      value: 'diminished',      octave: 4 },
  { label: 'Chromatic',       value: 'chromatic',       octave: 4 },
]
const SCALE_PRESETS = SCALE_ROOTS.flatMap(root =>
  SCALE_TYPES.map(st => ({
    label: `${root} ${st.label}`,
    value: `${root}${st.octave}:${st.value}`,
  }))
)

const DRUM_PATTERNS = [
  { label: '4 Kicks', value: 'bd*4' },
  { label: '4 Kicks + Hats', value: 'bd*4, hh*8' },
  { label: 'Basic', value: 'bd [~ bd] ~ ~, ~ cp ~ ~, hh*8' },
  { label: 'Four-on-floor', value: 'bd*4, ~ cp ~ cp, hh*8' },
  { label: 'Boom Bap', value: 'bd ~ ~ bd ~ ~ bd ~, ~ ~ cp ~ ~ ~ ~ cp, hh*16' },
  { label: 'Trap', value: '[bd ~ ~ ~] ~ [~ bd] ~, ~ [~ cp] ~ ~, hh*16' },
  { label: 'Lofi Shuffle', value: '[bd ~ ~ ~] ~ [~ bd] ~, ~ [~ cp] ~ [~ ~ cp ~], [~ oh] [hh ~ ~ hh] [~ hh] [oh ~ hh ~]' },
  { label: 'Breakbeat', value: 'bd ~ ~ bd ~ ~ [bd bd] ~, ~ ~ cp ~ ~ cp ~ ~, hh hh [hh oh] hh' },
  { label: 'Minimal', value: 'bd ~ ~ ~, ~ ~ cp ~, ~ hh ~ hh' },
  { label: 'Jazz Brush', value: '[bd ~ bd ~] [~ bd ~ ~], ~ ~ [rim rim] ~, hh*4' },
  { label: 'Kick + Rim', value: 'bd ~ bd ~, ~ rim ~ rim' },
  { label: 'Half-time', value: 'bd ~ ~ ~, ~ ~ ~ cp, hh*4' },
]

const MELODY_PATTERNS = [
  // Scale-degree patterns (work with any .scale())
  { label: 'Ascending Scale', value: '0 1 2 3 4 5 6 7' },
  { label: 'Descending Scale', value: '7 6 5 4 3 2 1 0' },
  { label: 'Wave', value: '0 2 4 6 4 2 0 ~' },
  { label: 'Arp Up', value: '0 2 4 7 4 2' },
  { label: 'Arp Down', value: '7 4 2 0 2 4' },
  { label: 'Arp Up-Down', value: '0 2 4 7 9 7 4 2' },
  { label: 'Triad Arp', value: '<0 2 4> <2 4 6> <4 6 8> <6 8 10>' },
  { label: 'Sparse Arp', value: '~ 0 ~ ~ 4 ~ 2 ~' },
  { label: 'Chord Tones', value: '<0 2 4> <4 5 7> <7 9 11> <4 5 7>' },
  { label: 'Pentatonic Run', value: '0 2 4 7 9 12 9 7' },
  { label: 'Octave Jump', value: '0 ~ 7 ~ 0 7 ~ ~' },
  { label: 'Steps', value: '0 ~ 1 ~ 2 ~ 3 ~' },
  { label: 'Jazzy 7ths', value: '0 4 7 11 9 7 4 2' },
  { label: 'Broken Chord', value: '0 4 2 7 4 9 7 12' },
  { label: 'Rhythmic Arp', value: '[0 2] 4 [7 ~] 4 [2 0] ~ 4 ~' },
  { label: 'Legato Steps', value: '0 1 2 ~ 4 5 ~ 7' },
]

const CHORD_PROGRESSIONS = [
  { label: 'I - V - vi - IV', value: '<[c3,e3,g3] [g2,b2,d3] [a2,c3,e3] [f2,a2,c3]>' },
  { label: 'ii - V - I', value: '<[d3,f3,a3] [g2,b2,d3] [c3,e3,g3,b3]>' },
  { label: 'Jazz ii-V-I-vi', value: '<[d3,f3,a3,c4] [g2,b2,d3,f3] [c3,e3,g3,b3] [a2,c3,e3,g3]>' },
  { label: 'Lofi Cycle', value: '<[d3,f3,a3,c4] [g2,b2,d3,f3] [c3,e3,g3,b3] [a2,c3,e3,g3] [f3,a3,c4,e4] [e3,g3,b3,d4] [d3,f3,a3,c4] [e3,gs3,b3,d4]>' },
  { label: '12-Bar Blues', value: '<[c3,e3,g3] [c3,e3,g3] [c3,e3,g3] [c3,e3,g3] [f2,a2,c3] [f2,a2,c3] [c3,e3,g3] [c3,e3,g3] [g2,b2,d3] [f2,a2,c3] [c3,e3,g3] [g2,b2,d3]>' },
  { label: 'Dreamy', value: '<[c3,g3,e4] [a2,e3,c4] [f3,c4,a4] [g3,d4,b4]>' },
  { label: 'Minor Sad', value: '<[a2,c3,e3] [f2,a2,c3] [d3,f3,a3] [e2,g2,b2]>' },
  { label: 'Ambient Pads', value: '<[d3,a3,f4] [g3,d4,b4] [c3,g3,e4] [a2,e3,c4]>' },
]

const BASS_PATTERNS = [
  { label: 'Root Walk', value: '<[c2 ~ ~ c2] [~ g1 ~ ~] [a1 ~ ~ ~] [~ f1 ~ f1]>' },
  { label: 'Octave Bounce', value: '<c2 c3 c2 c3>' },
  { label: 'Funky', value: '<[c2 ~ c2 ~] [~ c2 ~ c3] [f1 ~ f2 ~] [g1 g2 ~ g1]>' },
  { label: 'Walking', value: '<[c2 d2 e2 f2] [g2 a2 b2 c3] [b2 a2 g2 f2] [e2 d2 c2 g1]>' },
  { label: 'Sub Bass', value: '<c1 ~ f1 ~ g1 ~ c1 ~>' },
  { label: 'Synth Bass', value: '<[c2 ~ ~ c2] [~ f1 ~ ~] [g1 ~ ~ ~] [~ e1 ~ e2]>' },
]

const VOWELS = [
  { label: 'None', value: '' },
  { label: 'a', value: 'a' },
  { label: 'e', value: 'e' },
  { label: 'i', value: 'i' },
  { label: 'o', value: 'o' },
  { label: 'u', value: 'u' },
]

const DISTORT_TYPES = [
  { label: 'None', value: '' },
  { label: 'Waveshape', value: 'shape' },
  { label: 'Fold', value: 'fold' },
  { label: 'S-Curve', value: 'scurve' },
  { label: 'Diode', value: 'diode' },
  { label: 'Chebyshev', value: 'chebyshev' },
  { label: 'Asymmetric', value: 'asym' },
  { label: 'Sine Fold', value: 'sinefold' },
]

// ═══════════════════════════════════════════════════════════════
//  RANDOM PATTERN GENERATORS — infinite variation
// ═══════════════════════════════════════════════════════════════

function randomPick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)] }

/** Detect if a drum pattern uses only a single sound category (e.g. just 'cp' or just 'hh') */
function detectSingleDrumSound(pattern: string): string | null {
  // Standard drum abbreviations in Strudel
  const drumSounds = ['bd', 'sd', 'cp', 'hh', 'oh', 'ch', 'lt', 'mt', 'ht', 'rim', 'cb', 'cy', 'rs', 'ma', 'cl', 'lo', 'tom']
  const found = new Set<string>()
  for (const snd of drumSounds) {
    // Match whole-word occurrences (not inside longer words)
    if (new RegExp(`\\b${snd}\\b`).test(pattern)) found.add(snd)
  }
  if (found.size === 1) return Array.from(found)[0]
  return null
}

/** Generate a rhythmic pattern for a single percussion sound */
function randomSingleSoundPattern(sound: string): string {
  const patterns = [
    `${sound} ~ ~ ~`,
    `${sound} ~ ${sound} ~`,
    `~ ${sound} ~ ~`,
    `~ ${sound} ~ ${sound}`,
    `${sound} ${sound} ~ ~`,
    `${sound} ~ [~ ${sound}] ~`,
    `[${sound} ~] ~ [~ ${sound}] ~`,
    `${sound} ~ [${sound} ${sound}] ~`,
    `[~ ${sound}] ${sound} ~ ${sound}`,
    `${sound}*4`,
    `${sound}*8`,
    `${sound} [${sound} ~] ${sound} ~`,
    `[${sound} ${sound} ~ ${sound}]*2`,
    `${sound} ~ ~ [${sound} ~]`,
    `[${sound} ~ ~ ${sound}] [~ ${sound} ~ ~]`,
    `~ [${sound} ${sound}] ~ ${sound}`,
  ]
  return randomPick(patterns)
}

function randomDrumPattern(): string {
  const kicks  = ['bd', 'bd*2', '[bd ~ bd ~]', '[bd ~ ~ bd]', 'bd ~ ~ ~', '[~ bd] ~ [~ bd] ~', 'bd ~ [bd bd] ~', '[bd bd ~ ~]']
  const snares = ['~ cp ~ ~', '~ cp ~ cp', '~ [~ cp] ~ ~', '~ ~ cp ~', '~ ~ [cp cp] ~', '~ [cp ~] ~ cp', '~ cp [~ cp] ~']
  const hats   = ['hh*4', 'hh*8', 'hh*16', '[hh ~ hh ~]*2', '[~ hh]*4', 'hh hh [hh oh] hh', '[hh hh ~ hh]*2', '[oh ~ hh hh]*2', 'hh*8']
  const percs  = ['', '', '', `, ${randomPick(['rim*8', '~ rim ~ rim', 'rim [rim ~] rim ~', '[~ rim]*4'])}`, `, ${randomPick(['[~ oh]*2', 'oh ~ ~ oh'])}` ]
  return `${randomPick(kicks)}, ${randomPick(snares)}, ${randomPick(hats)}${randomPick(percs)}`
}

function randomMelodyPattern(): string {
  const templates = [
    // Stepwise motion (scale degrees 0-7)
    () => { const len = 4 + Math.floor(Math.random() * 5); const notes: string[] = []; let cur = Math.floor(Math.random() * 4); for (let i = 0; i < len; i++) { if (Math.random() < 0.15) notes.push('~'); else { notes.push(String(cur)); cur += randomPick([-1, 1, 2, -2]); cur = Math.max(0, Math.min(7, cur)) } } return notes.join(' ') },
    // Arp patterns
    () => randomPick(['0 2 4 7 4 2', '7 4 2 0 2 4', '0 2 4 7 9 7 4 2', '0 4 7 12 7 4']),
    // Sparse melody
    () => { const len = 8; const notes: string[] = []; for (let i = 0; i < len; i++) notes.push(Math.random() < 0.35 ? '~' : String(Math.floor(Math.random() * 8))); return notes.join(' ') },
    // Triad sequence (chord tones)
    () => { const degs = [0, 2, 4]; const ct = 4 + Math.floor(Math.random() * 3); return Array.from({ length: ct }, () => `<${degs.map(d => d + Math.floor(Math.random() * 3) * 2).join(' ')}>`).join(' ') },
    // Rhythmic brackets
    () => { const n = () => String(Math.floor(Math.random() * 8)); return `[${n()} ${n()}] ${n()} [${n()} ~] ${n()} [${n()} ${n()}] ~ ${n()} ~` },
  ]
  return randomPick(templates)()
}

function randomChordProgression(): string {
  // Musically-correct progressions: always 4 or 8 bars (= 4 or 8 chords in <...>)
  const fourBarTriads = [
    // I-V-vi-IV (Pop)
    '<[c3,e3,g3] [g2,b2,d3] [a2,c3,e3] [f2,a2,c3]>',
    // I-vi-IV-V (50s Doo-wop)
    '<[c3,e3,g3] [a2,c3,e3] [f2,a2,c3] [g2,b2,d3]>',
    // I-IV-V-I (Rock)
    '<[c3,e3,g3] [f2,a2,c3] [g2,b2,d3] [c3,e3,g3]>',
    // vi-IV-I-V (Axis)
    '<[a2,c3,e3] [f2,a2,c3] [c3,e3,g3] [g2,b2,d3]>',
    // i-iv-v-i (Minor)
    '<[a2,c3,e3] [d3,f3,a3] [e3,g3,b3] [a2,c3,e3]>',
    // I-IV-vi-V
    '<[c3,e3,g3] [f2,a2,c3] [a2,c3,e3] [g2,b2,d3]>',
    // i-VI-III-VII (Sad)
    '<[a2,c3,e3] [f2,a2,c3] [c3,e3,g3] [g2,b2,d3]>',
    // IV-V-iii-vi (Royal)
    '<[f2,a2,c3] [g2,b2,d3] [e3,g3,b3] [a2,c3,e3]>',
  ]
  const fourBarSevenths = [
    // ii7-V7-Imaj7-Imaj7 (Jazz)
    '<[d3,f3,a3,c4] [g2,b2,d3,f3] [c3,e3,g3,b3] [c3,e3,g3,b3]>',
    // Imaj7-vi7-ii7-V7 (Smooth)
    '<[c3,e3,g3,b3] [a2,c3,e3,g3] [d3,f3,a3,c4] [g2,b2,d3,f3]>',
    // ii9-V7-Imaj7-vi7 (Neo-Soul)
    '<[d3,f3,a3,c4,e4] [g2,b2,d3,f3] [c3,e3,g3,b3] [a2,c3,e3,g3]>',
    // IVmaj7-iii7-vi7-ii7 (Lofi)
    '<[f2,a2,c3,e3] [e3,g3,b3,d4] [a2,c3,e3,g3] [d3,f3,a3,c4]>',
  ]
  const eightBar = [
    // I-V-vi-IV repeated with variation
    '<[c3,e3,g3] [g2,b2,d3] [a2,c3,e3] [f2,a2,c3] [c3,e3,g3] [f2,a2,c3] [a2,c3,e3] [g2,b2,d3]>',
    // 7th cycle
    '<[d3,f3,a3,c4] [g2,b2,d3,f3] [c3,e3,g3,b3] [a2,c3,e3,g3] [f2,a2,c3,e3] [e3,g3,b3,d4] [d3,f3,a3,c4] [g2,b2,d3,f3]>',
  ]
  const r = Math.random()
  if (r < 0.45) return randomPick(fourBarTriads)
  if (r < 0.8) return randomPick(fourBarSevenths)
  return randomPick(eightBar)
}

function randomBassPattern(): string {
  // Bass patterns that fit in 1 bar (4 beats). Clean rhythmic patterns.
  const patterns = [
    // Root on 1 and 3
    'c2 ~ c2 ~',
    'c2 ~ ~ c2',
    // Walking bass (4 beats)
    'c2 e2 g2 e2',
    'c2 d2 e2 g2',
    'a1 c2 e2 c2',
    // Syncopated
    'c2 ~ [~ c2] ~',
    '[c2 ~] e2 [~ g2] c2',
    '~ c2 ~ [c2 e2]',
    // Octave jumps
    'c2 c1 c2 c1',
    'c2 ~ c1 ~',
    // 808-style
    'c1 ~ ~ ~',
    'c1 ~ [~ c1] ~',
    '[c1 ~] ~ c1 [~ c1]',
    // Driving
    'c2 c2 c2 c2',
    'c2 [c2 c2] c2 ~',
  ]
  return randomPick(patterns)
}

function randomVocalPattern(): string {
  // Vocal/sample patterns: sparse rhythmic hits using the sample name itself
  const patterns = [
    '~ ~ ~ ~, ~ ~ ~ ~',
    '0 ~ ~ 0 ~ ~ 0 ~',
    '~ 0 ~ ~',
    '0 ~ 0 ~',
    '0 ~ [~ 0] ~',
    '[0 ~] ~ [~ 0] ~',
    '0 ~ ~ ~, ~ ~ 0 ~',
    '~ 0 ~ 0',
  ]
  return randomPick(patterns)
}

function randomPatternForType(type: NodeType, currentPattern?: string): string {
  // For drum/fx types, check if the current pattern uses a single sound category
  if ((type === 'drums' || type === 'fx') && currentPattern) {
    const singleSound = detectSingleDrumSound(currentPattern)
    if (singleSound) return randomSingleSoundPattern(singleSound)
  }
  switch (type) {
    case 'drums': return randomDrumPattern()
    case 'bass':  return randomBassPattern()
    case 'chords': return randomChordProgression()
    case 'vocal': return randomMelodyPattern()  // vocal is now melodic
    case 'fx':    return randomVocalPattern() // sparse for fx too
    default:      return randomMelodyPattern()
  }
}

/**
 * Calculate how many bars a pattern occupies.
 *
 * Strudel rules:
 * - `<a b c d>` means 4 cycles (entries). At setcps(bpm/60/4), 1 cycle = 1 bar.
 *   So count entries in `<...>` to get bars.
 * - Patterns WITHOUT `<...>` = 1 bar (repeats each cycle).
 * - `.slow(N)` multiplies the bar count by N.
 * - `.fast(N)` divides bars by N.
 *
 * Returns a human-readable label e.g. "4 bars", "8 bars".
 */
function getPatternBarCount(pattern: string, code: string): number {
  let bars = 1
  const trimmed = pattern.trim()
  if (trimmed.startsWith('<') && trimmed.endsWith('>')) {
    // Count entries inside <...> (space-separated, respecting brackets)
    const inner = trimmed.slice(1, -1).trim()
    let depth = 0, count = 0, inEntry = false
    for (const ch of inner) {
      if (ch === '[') { depth++; inEntry = true }
      else if (ch === ']') { depth-- }
      else if (ch === ' ' && depth === 0) { if (inEntry) count++; inEntry = false }
      else { inEntry = true }
    }
    if (inEntry) count++
    bars = Math.max(1, count)
  } else {
    // Drum or inline patterns: count commas at depth 0 to detect layers, but it's 1 bar
    bars = 1
  }
  // Check for .slow(N) which multiplies cycle length
  const slowM = code.match(/\.slow\s*\(\s*([0-9.]+)\s*\)/)
  if (slowM) bars = Math.round(bars * parseFloat(slowM[1]))
  // Check for .fast(N) which halves cycle length
  const fastM = code.match(/\.fast\s*\(\s*["']?([0-9.]+)/)
  if (fastM) bars = Math.max(1, Math.round(bars / parseFloat(fastM[1])))
  return bars
}

// ═══════════════════════════════════════════════════════════════
//  EFFECT BADGE DETECTION — visual tags on nodes
// ═══════════════════════════════════════════════════════════════

const EFFECT_BADGES: { detect: RegExp; label: string; color: string }[] = [
  { detect: /\.room\s*\(/, label: 'VERB', color: '#22d3ee' },
  { detect: /\.delay\s*\(/, label: 'DLY', color: '#fb923c' },
  { detect: /\.lpf\s*\(/, label: 'LPF', color: '#60a5fa' },
  { detect: /\.hpf\s*\(/, label: 'HPF', color: '#60a5fa' },
  { detect: /\.crush\s*\(/, label: 'CRSH', color: '#ef4444' },
  { detect: /\.shape\s*\(/, label: 'SHPE', color: '#ef4444' },
  { detect: /\.distort\s*\(/, label: 'DIST', color: '#ef4444' },
  { detect: /\.phaser\s*\(/, label: 'PHSR', color: '#a78bfa' },
  { detect: /\.vowel\s*\(/, label: 'VWL', color: '#c084fc' },
  { detect: /\.fmi\s*\(/, label: 'FM', color: '#818cf8' },
  { detect: /\.coarse\s*\(/, label: 'CORS', color: '#f59e0b' },
  { detect: /\.compressor\s*\(/, label: 'COMP', color: '#94a3b8' },
  { detect: /\.rev\s*\(/, label: 'REV', color: '#f472b6' },
  { detect: /\.jux(By)?\s*\(/, label: 'JUX', color: '#22d3ee' },
  { detect: /\.echo\s*\(/, label: 'ECHO', color: '#fb923c' },
  { detect: /\.degrade/, label: 'DGRDE', color: '#ef4444' },
  { detect: /\.euclid\s*\(/, label: 'EUCLID', color: '#34d399' },
  { detect: /\.chop\s*\(/, label: 'CHOP', color: '#34d399' },
  { detect: /\.striate\s*\(/, label: 'STRT', color: '#34d399' },
  { detect: /\.swing\s*\(/, label: 'SWNG', color: '#fb923c' },
  { detect: /\.brak\s*\(/, label: 'BRAK', color: '#ef4444' },
  { detect: /\.iter\s*\(/, label: 'ITER', color: '#22d3ee' },
  { detect: /\.ply\s*\(/, label: 'PLY', color: '#f472b6' },
  { detect: /\.sometimes\s*\(/, label: 'RNG', color: '#a78bfa' },
  { detect: /\.often\s*\(/, label: 'OFTN', color: '#a78bfa' },
  { detect: /\.pan\s*\(.*(?:sine|cosine|saw|tri|perlin)/, label: 'APAN', color: '#34d399' },
  { detect: /\.csid\s*\(/, label: 'SIDE', color: '#f59e0b' },
  { detect: /\.bpf\s*\(/, label: 'BPF', color: '#60a5fa' },
  { detect: /\.arp(eggiate)?\s*\(/, label: 'ARP', color: '#22d3ee' },
  { detect: /\.off\s*\(/, label: 'OFF', color: '#c084fc' },
  { detect: /\.superimpose\s*\(/, label: 'SUPR', color: '#c084fc' },
  { detect: /\.struct\s*\(/, label: 'STRC', color: '#34d399' },
  { detect: /\.mask\s*\(/, label: 'MASK', color: '#34d399' },
  { detect: /\.squiz\s*\(/, label: 'SQUZ', color: '#ef4444' },
  { detect: /\.leslie\s*\(/, label: 'LSLE', color: '#a78bfa' },
  { detect: /\.waveloss\s*\(/, label: 'WLSS', color: '#ef4444' },
  { detect: /\.djf\s*\(/, label: 'DJF', color: '#60a5fa' },
  { detect: /\.noise\s*\(/, label: 'NOIZ', color: '#94a3b8' },
  { detect: /\.vib\s*\(/, label: 'VIB', color: '#a78bfa' },
  { detect: /\.loopAt\s*\(/, label: 'LOOP', color: '#fb923c' },
  { detect: /\.segment\s*\(/, label: 'SEG', color: '#22d3ee' },
  { detect: /\.density\s*\(/, label: 'DENS', color: '#22d3ee' },
  { detect: /\.rotate\s*\(/, label: 'ROT', color: '#f472b6' },
  { detect: /\.size\s*\(/, label: 'SIZE', color: '#22d3ee' },
  { detect: /\.n\s*\(/, label: 'N', color: '#f59e0b' },
  { detect: /\.octave\s*\(/, label: 'OCT', color: '#c084fc' },
  { detect: /\.when\s*\(/, label: 'WHEN', color: '#a78bfa' },
  { detect: /\.add\s*\(/, label: 'ADD', color: '#c084fc' },
]

function detectActiveEffects(code: string): { label: string; color: string }[] {
  const raw = code.replace(/\/\/ \[muted\] /g, '')
  return EFFECT_BADGES.filter(b => b.detect.test(raw)).map(b => ({ label: b.label, color: b.color }))
}

// ═══════════════════════════════════════════════════════════════
//  QUICK FX — one-click pattern modifiers injected into code
// ═══════════════════════════════════════════════════════════════

interface QuickFX {
  id: string
  label: string
  icon: string
  category: 'pattern' | 'time' | 'stereo' | 'glitch' | 'groove' | 'lfo'
  code: string           // Strudel code to inject
  detect: RegExp         // regex to detect if already present
  color: string
  desc: string
}

const QUICK_FX: QuickFX[] = [
  // Pattern transforms
  { id: 'rev', label: 'REV', icon: '↩', category: 'pattern', code: '.rev()', detect: /\.rev\s*\(/, color: '#f472b6', desc: 'Reverse pattern each cycle' },
  { id: 'palindrome', label: 'PALIN', icon: '↔', category: 'pattern', code: '.every(2, rev)', detect: /\.every\s*\(\s*2\s*,\s*rev/, color: '#c084fc', desc: 'Forward then backward' },
  { id: 'jux', label: 'JUX', icon: '◐', category: 'stereo', code: '.jux(rev)', detect: /\.jux\s*\(/, color: '#22d3ee', desc: 'Apply function to right channel' },
  { id: 'juxBy', label: 'JUX.5', icon: '◑', category: 'stereo', code: '.juxBy(0.5, rev)', detect: /\.juxBy\s*\(/, color: '#22d3ee', desc: 'Subtle stereo split' },
  { id: 'echo3', label: 'ECHO', icon: '≡', category: 'pattern', code: '.echo(3, 1/8, 0.5)', detect: /\.echo\s*\(\s*3/, color: '#fb923c', desc: 'Stutter echo 3x' },
  { id: 'echo6', label: 'ECHO6', icon: '≡≡', category: 'pattern', code: '.echo(6, 1/16, 0.4)', detect: /\.echo\s*\(\s*6/, color: '#fb923c', desc: 'Rapid 6x stutter' },
  { id: 'degrade', label: 'DGRDE', icon: '░', category: 'glitch', code: '.degradeBy(0.3)', detect: /\.degrade/, color: '#ef4444', desc: 'Randomly drop 30% events' },
  { id: 'every4fast', label: 'E4⇡', icon: '⚡', category: 'time', code: '.every(4, fast(2))', detect: /\.every\s*\(\s*4\s*,\s*fast/, color: '#facc15', desc: 'Double speed every 4 cycles' },
  { id: 'every3add', label: 'E3+12', icon: '⇞', category: 'time', code: '.every(3, x => x.add(12))', detect: /\.every\s*\(\s*3.*add\s*\(\s*12/, color: '#facc15', desc: 'Octave up every 3 cycles' },
  { id: 'sometimes', label: 'SMTMS', icon: '?', category: 'glitch', code: '.sometimes(fast(2))', detect: /\.sometimes\s*\(/, color: '#a78bfa', desc: 'Randomly double speed' },
  { id: 'often', label: 'OFTEN', icon: '‼', category: 'glitch', code: '.often(x => x.add(7))', detect: /\.often\s*\(/, color: '#a78bfa', desc: '75% chance add a 5th' },
  { id: 'rarely', label: 'RARE', icon: '…', category: 'glitch', code: '.rarely(x => x.crush(4))', detect: /\.rarely\s*\(/, color: '#a78bfa', desc: '25% chance bitcrush' },
  { id: 'chop8', label: 'CHOP', icon: '✂', category: 'glitch', code: '.chop(8)', detect: /\.chop\s*\(/, color: '#34d399', desc: 'Granular: 8 slices' },
  { id: 'striate', label: 'STRT', icon: '≋', category: 'glitch', code: '.striate(4)', detect: /\.striate\s*\(/, color: '#34d399', desc: 'Granular interleave' },
  { id: 'iter4', label: 'ITER', icon: '⟳', category: 'pattern', code: '.iter(4)', detect: /\.iter\s*\(/, color: '#22d3ee', desc: 'Shift start each cycle' },
  { id: 'ply', label: 'PLY', icon: '×2', category: 'pattern', code: '.ply(2)', detect: /\.ply\s*\(/, color: '#f472b6', desc: 'Repeat each event 2x' },
  { id: 'chunk', label: 'CHNK', icon: '▧', category: 'pattern', code: '.chunk(4, fast(2))', detect: /\.chunk\s*\(/, color: '#facc15', desc: 'Transform rotating quarter' },
  { id: 'brak', label: 'BRAK', icon: '⚡', category: 'groove', code: '.brak()', detect: /\.brak\s*\(/, color: '#ef4444', desc: 'Breakbeat transform' },
  { id: 'press', label: 'PRSS', icon: '→', category: 'groove', code: '.press()', detect: /\.press\s*\(/, color: '#fb923c', desc: 'Push events to 2nd half' },
  { id: 'swing', label: 'SWNG', icon: '♪', category: 'groove', code: '.swing(0.2)', detect: /\.swing\s*\(/, color: '#fb923c', desc: 'Add swing feel' },
  { id: 'linger', label: 'LNGR', icon: '∞', category: 'time', code: '.linger(0.25)', detect: /\.linger\s*\(/, color: '#c084fc', desc: 'Loop first quarter' },
  { id: 'hurry', label: 'HRRY', icon: '»', category: 'time', code: '.hurry(2)', detect: /\.hurry\s*\(/, color: '#facc15', desc: 'Speed up + pitch up' },
  // Euclid
  { id: 'euclid35', label: 'E(3,5)', icon: '◇', category: 'groove', code: '.euclid(3,5)', detect: /\.euclid\s*\(\s*3\s*,\s*5/, color: '#34d399', desc: 'Euclidean 3/5 rhythm' },
  { id: 'euclid58', label: 'E(5,8)', icon: '◆', category: 'groove', code: '.euclid(5,8)', detect: /\.euclid\s*\(\s*5\s*,\s*8/, color: '#34d399', desc: 'Euclidean 5/8 rhythm' },
  { id: 'euclid38', label: 'E(3,8)', icon: '◈', category: 'groove', code: '.euclid(3,8)', detect: /\.euclid\s*\(\s*3\s*,\s*8/, color: '#34d399', desc: 'Euclidean 3/8 rhythm' },
  // Sidechain
  { id: 'sidechain', label: 'SIDE', icon: '📊', category: 'groove', code: '.csid("bd",0.3,0.2)', detect: /\.csid\s*\(/, color: '#f59e0b', desc: 'Pumping sidechain compression' },
  // Arpeggio & layering
  { id: 'arp', label: 'ARP', icon: '🎵', category: 'pattern', code: '.arp("0 1 2 3")', detect: /\.arp(eggiate)?\s*\(/, color: '#22d3ee', desc: 'Arpeggiate chord notes upward' },
  { id: 'off', label: 'OFF', icon: '⟩', category: 'pattern', code: '.off(1/8, x => x.add(7))', detect: /\.off\s*\(/, color: '#c084fc', desc: 'Offset copy +5th' },
  { id: 'superimpose', label: 'SUPER', icon: '⊕', category: 'pattern', code: '.superimpose(x => x.add(12).slow(2))', detect: /\.superimpose\s*\(/, color: '#c084fc', desc: 'Layer with octave transform' },
  { id: 'struct', label: 'STRUCT', icon: '▣', category: 'groove', code: '.struct("t(3,8)")', detect: /\.struct\s*\(/, color: '#34d399', desc: 'Boolean rhythm structure' },
  { id: 'mask', label: 'MASK', icon: '◧', category: 'groove', code: '.mask("t f t f t f t f")', detect: /\.mask\s*\(/, color: '#34d399', desc: 'Mask events on/off' },
  { id: 'early', label: 'ERLY', icon: '←', category: 'time', code: '.early(1/8)', detect: /\.early\s*\(/, color: '#facc15', desc: 'Shift earlier in time' },
  { id: 'late', label: 'LATE', icon: '→', category: 'time', code: '.late(1/8)', detect: /\.late\s*\(/, color: '#facc15', desc: 'Shift later in time' },
  { id: 'segment', label: 'SEG', icon: '⊞', category: 'pattern', code: '.segment(8)', detect: /\.segment\s*\(/, color: '#22d3ee', desc: 'Segment into N events' },
  { id: 'loopAt', label: 'LOOP', icon: '⟳', category: 'time', code: '.loopAt(2)', detect: /\.loopAt\s*\(/, color: '#fb923c', desc: 'Loop sample at N bars' },
  { id: 'almostNever', label: 'ANVR', icon: '·', category: 'glitch', code: '.almostNever(x => x.crush(4))', detect: /\.almostNever\s*\(/, color: '#a78bfa', desc: '10% chance transform' },
  { id: 'almostAlways', label: 'AALW', icon: '●', category: 'glitch', code: '.almostAlways(x => x.add(12))', detect: /\.almostAlways\s*\(/, color: '#a78bfa', desc: '90% chance transform' },
  // Density & rotation
  { id: 'density', label: 'DENS', icon: '▓', category: 'pattern', code: '.density(4)', detect: /\.density\s*\(/, color: '#22d3ee', desc: 'Increase rhythmic density' },
  { id: 'rotate', label: 'ROT', icon: '↻', category: 'pattern', code: '.rotate(1)', detect: /\.rotate\s*\(/, color: '#f472b6', desc: 'Rotate pattern steps' },
  { id: 'add7', label: 'ADD+7', icon: '⇧', category: 'pattern', code: '.add(7)', detect: /\)\s*\.add\s*\(\s*7\s*\)/, color: '#c084fc', desc: 'Transpose up a 5th' },
  { id: 'add12', label: 'ADD+12', icon: '⇑', category: 'pattern', code: '.add(12)', detect: /\)\s*\.add\s*\(\s*12\s*\)/, color: '#c084fc', desc: 'Transpose up an octave' },
  { id: 'when50', label: 'WHEN', icon: '⚖', category: 'glitch', code: '.when(x => x > 0.5, rev)', detect: /\.when\s*\(/, color: '#a78bfa', desc: 'Conditional transform' },
  // Sound sculpting
  { id: 'crush8', label: 'CRSH8', icon: '▤', category: 'glitch', code: '.crush(8)', detect: /\.crush\s*\(\s*8/, color: '#ef4444', desc: 'Bitcrush to 8-bit' },
  { id: 'crush4', label: 'CRSH4', icon: '▥', category: 'glitch', code: '.crush(4)', detect: /\.crush\s*\(\s*4/, color: '#ef4444', desc: 'Bitcrush to 4-bit (heavy)' },
  { id: 'coarse16', label: 'CORS', icon: '░', category: 'glitch', code: '.coarse(16)', detect: /\.coarse\s*\(/, color: '#ef4444', desc: 'Sample rate reduction' },
  { id: 'fast2', label: 'FAST2', icon: '⏩', category: 'time', code: '.fast(2)', detect: /\)\.fast\s*\(\s*2\s*\)/, color: '#facc15', desc: 'Double speed' },
  { id: 'slow2', label: 'SLOW2', icon: '⏪', category: 'time', code: '.slow(2)', detect: /\)\.slow\s*\(\s*2\s*\)/, color: '#facc15', desc: 'Half speed' },
  { id: 'slow4', label: 'SLOW4', icon: '🐢', category: 'time', code: '.slow(4)', detect: /\)\.slow\s*\(\s*4\s*\)/, color: '#facc15', desc: 'Quarter speed (ambient)' },
  { id: 'vowelA', label: 'VWL-A', icon: '🗣', category: 'pattern', code: '.vowel("a")', detect: /\.vowel\s*\(\s*["']a["']/, color: '#c084fc', desc: 'Vowel filter: open A' },
  { id: 'vowelE', label: 'VWL-E', icon: '🗣', category: 'pattern', code: '.vowel("e")', detect: /\.vowel\s*\(\s*["']e["']/, color: '#c084fc', desc: 'Vowel filter: bright E' },
  { id: 'vowelO', label: 'VWL-O', icon: '🗣', category: 'pattern', code: '.vowel("o")', detect: /\.vowel\s*\(\s*["']o["']/, color: '#c084fc', desc: 'Vowel filter: dark O' },
  // Euclid additional
  { id: 'euclid716', label: 'E(7,16)', icon: '◇', category: 'groove', code: '.euclid(7,16)', detect: /\.euclid\s*\(\s*7\s*,\s*16/, color: '#34d399', desc: 'Euclidean 7/16 (complex groove)' },
  { id: 'euclid916', label: 'E(9,16)', icon: '◆', category: 'groove', code: '.euclid(9,16)', detect: /\.euclid\s*\(\s*9\s*,\s*16/, color: '#34d399', desc: 'Euclidean 9/16 (dense)' },
]

// LFO presets — inject as replacement for a knob's static value
const LFO_PRESETS = [
  { label: 'Sine Slow', value: 'sine.range({min},{max}).slow(4)', icon: '∿' },
  { label: 'Sine Fast', value: 'sine.range({min},{max}).slow(1)', icon: '∿⚡' },
  { label: 'Cosine', value: 'cosine.range({min},{max}).slow(4)', icon: '∾' },
  { label: 'Saw Up', value: 'saw.range({min},{max}).slow(4)', icon: '⟋' },
  { label: 'Saw Down', value: 'isaw.range({min},{max}).slow(4)', icon: '⟍' },
  { label: 'Triangle', value: 'tri.range({min},{max}).slow(4)', icon: '△' },
  { label: 'Square', value: 'square.range({min},{max}).slow(2)', icon: '□' },
  { label: 'Perlin', value: 'perlin.range({min},{max}).slow(4)', icon: '≈' },
  { label: 'Random', value: 'rand.range({min},{max}).segment(8)', icon: '⁂' },
]

// ═══════════════════════════════════════════════════════════════
//  SIDEBAR LIBRARY — draggable items organized by category
// ═══════════════════════════════════════════════════════════════

interface SidebarItem {
  id: string
  label: string
  icon: string
  desc: string
  color: string
  dragType: 'effect' | 'pattern' | 'sound' | 'scale' | 'chord' | 'lfo'
  /** The code/value to inject */
  payload: string
  /** Which method to target (for effects that modify a param) */
  method?: string
}

const SIDEBAR_CATEGORIES: { id: string; label: string; icon: string; color: string; items: SidebarItem[] }[] = [
  {
    id: 'effects', label: 'Audio FX', icon: '⚡', color: '#22d3ee',
    items: [
      // Essentials
      { id: 'fx_gain', label: 'Gain', icon: '🔈', desc: 'Volume .gain(0.5)', color: '#34d399', dragType: 'effect', payload: '.gain(0.5)', method: 'gain' },
      { id: 'fx_pan', label: 'Auto-Pan', icon: '↔️', desc: 'Stereo LFO .pan(sine.range(0,1).slow(4))', color: '#34d399', dragType: 'effect', payload: '.pan(sine.range(0,1).slow(4))', method: 'pan' },
      // Space
      { id: 'fx_reverb', label: 'Reverb', icon: '🏛️', desc: 'Room reverb .room(0.5)', color: '#22d3ee', dragType: 'effect', payload: '.room(0.5)', method: 'room' },
      { id: 'fx_delay', label: 'Delay', icon: '🔄', desc: 'Echo delay .delay(0.2)', color: '#22d3ee', dragType: 'effect', payload: '.delay(0.2).delayfeedback(0.4)', method: 'delay' },
      // Filters
      { id: 'fx_lpf', label: 'Low-Pass Filter', icon: '📉', desc: 'Cuts highs .lpf(1200)', color: '#60a5fa', dragType: 'effect', payload: '.lpf(1200)', method: 'lpf' },
      { id: 'fx_hpf', label: 'High-Pass Filter', icon: '📈', desc: 'Cuts lows .hpf(400)', color: '#60a5fa', dragType: 'effect', payload: '.hpf(400)', method: 'hpf' },
      { id: 'fx_bpf', label: 'Band-Pass Filter', icon: '🔊', desc: 'Narrow band .bpf(800)', color: '#60a5fa', dragType: 'effect', payload: '.bpf(800)', method: 'bpf' },
      { id: 'fx_vowel', label: 'Vowel Filter', icon: '🗣', desc: 'Vocal formant .vowel("a")', color: '#c084fc', dragType: 'effect', payload: '.vowel("a")', method: 'vowel' },
      // Distortion
      { id: 'fx_distort', label: 'Distortion', icon: '⚡', desc: 'Hard distort .distort(2)', color: '#ef4444', dragType: 'effect', payload: '.distort(2)', method: 'distort' },
      { id: 'fx_crush', label: 'Bitcrush', icon: '💎', desc: 'Lo-fi .crush(8)', color: '#ef4444', dragType: 'effect', payload: '.crush(8)', method: 'crush' },
      { id: 'fx_shape', label: 'Waveshape', icon: '🔥', desc: 'Soft distortion .shape(0.4)', color: '#ef4444', dragType: 'effect', payload: '.shape(0.4)', method: 'shape' },
      { id: 'fx_coarse', label: 'Coarse', icon: '▦', desc: 'Downsample .coarse(8)', color: '#f59e0b', dragType: 'effect', payload: '.coarse(8)', method: 'coarse' },
      // Modulation
      { id: 'fx_phaser', label: 'Phaser', icon: '🌀', desc: 'Phase sweep .phaser(4)', color: '#a78bfa', dragType: 'effect', payload: '.phaser(4)', method: 'phaser' },
      { id: 'fx_fm', label: 'FM Synthesis', icon: '📡', desc: 'Frequency mod .fmi(2)', color: '#818cf8', dragType: 'effect', payload: '.fmi(2)', method: 'fmi' },
      // Dynamics
      { id: 'fx_compress', label: 'Compressor', icon: '🔧', desc: 'Dynamic range .compressor(-20,10,4)', color: '#94a3b8', dragType: 'effect', payload: '.compressor(-20,10,4)' },
      { id: 'fx_sidechain', label: 'Sidechain', icon: '📊', desc: 'Pumping sidechain .csid("bd",0.3,0.2)', color: '#f59e0b', dragType: 'effect', payload: '.csid("bd",0.3,0.2)' },
    ]
  },
  {
    id: 'modifiers', label: 'Pattern FX', icon: '🎯', color: '#f472b6',
    items: [
      // Speed & Time
      { id: 'mod_fast', label: 'Fast 2x', icon: '⇡', desc: 'Double speed', color: '#facc15', dragType: 'effect', payload: '.fast(2)' },
      { id: 'mod_slow', label: 'Slow 2x', icon: '⇣', desc: 'Half speed', color: '#facc15', dragType: 'effect', payload: '.slow(2)' },
      { id: 'mod_hurry', label: 'Hurry', icon: '»', desc: 'Speed + pitch up', color: '#facc15', dragType: 'effect', payload: '.hurry(2)' },
      { id: 'mod_early', label: 'Early', icon: '←', desc: 'Shift earlier', color: '#facc15', dragType: 'effect', payload: '.early(1/8)' },
      { id: 'mod_late', label: 'Late', icon: '→', desc: 'Shift later', color: '#facc15', dragType: 'effect', payload: '.late(1/8)' },
      // Groove
      { id: 'mod_swing', label: 'Swing', icon: '♪', desc: 'Swing groove', color: '#fb923c', dragType: 'effect', payload: '.swing(0.2)' },
      { id: 'mod_press', label: 'Press', icon: '→', desc: 'Push to 2nd half', color: '#fb923c', dragType: 'effect', payload: '.press()' },
      { id: 'mod_brak', label: 'Breakbeat', icon: '⚡', desc: 'Breakbeat transform', color: '#ef4444', dragType: 'effect', payload: '.brak()' },
      { id: 'mod_density', label: 'Density', icon: '▓', desc: 'Rhythmic density', color: '#22d3ee', dragType: 'effect', payload: '.density(4)' },
      { id: 'mod_struct', label: 'Struct', icon: '▣', desc: 'Boolean rhythm', color: '#34d399', dragType: 'effect', payload: '.struct("t(3,8)")' },
      { id: 'mod_mask', label: 'Mask', icon: '◧', desc: 'Mask events', color: '#34d399', dragType: 'effect', payload: '.mask("t f t f t f t f")' },
      // Transform
      { id: 'mod_rev', label: 'Reverse', icon: '↩', desc: 'Reverse pattern', color: '#f472b6', dragType: 'effect', payload: '.rev()' },
      { id: 'mod_iter', label: 'Iter (Rotate)', icon: '⟳', desc: 'Shift start each cycle', color: '#22d3ee', dragType: 'effect', payload: '.iter(4)' },
      { id: 'mod_rotate', label: 'Rotate', icon: '↻', desc: 'Rotate steps', color: '#f472b6', dragType: 'effect', payload: '.rotate(1)' },
      { id: 'mod_ply', label: 'Ply (Repeat)', icon: '×2', desc: 'Double each event', color: '#f472b6', dragType: 'effect', payload: '.ply(2)' },
      { id: 'mod_chunk', label: 'Chunk', icon: '▧', desc: 'Rotating transform', color: '#facc15', dragType: 'effect', payload: '.chunk(4, fast(2))' },
      { id: 'mod_linger', label: 'Linger', icon: '∞', desc: 'Loop first quarter', color: '#c084fc', dragType: 'effect', payload: '.linger(0.25)' },
      { id: 'mod_segment', label: 'Segment', icon: '⊞', desc: 'Split into N events', color: '#22d3ee', dragType: 'effect', payload: '.segment(8)' },
      { id: 'mod_loopAt', label: 'Loop At', icon: '⟳', desc: 'Loop at N bars', color: '#fb923c', dragType: 'effect', payload: '.loopAt(2)' },
    ]
  },
  {
    id: 'layering', label: 'Arpeggiator & Layers', icon: '🎵', color: '#c084fc',
    items: [
      // ── Tempo-synced Arpeggiator ──
      // In Strudel: 1 cycle = 1 bar. A 4-note arp pattern at .fast(1) = quarter notes (1/4).
      // .fast(2) = eighth notes (1/8), .fast(3) = eighth triplets (1/8T),
      // .fast(4) = sixteenth notes (1/16), .fast(6) = sixteenth triplets (1/16T), .fast(8) = thirty-second notes (1/32).
      // Direction: up "0 1 2 3", down "3 2 1 0", updown "0 1 2 3 2 1", random = rand.range(0,3).segment(N)

      // ── Up direction at all divisions ──
      { id: 'arp_up_4', label: 'Arp Up 1/4', icon: '↑', desc: 'Up quarter notes — 1 note per beat', color: '#22d3ee', dragType: 'effect', payload: '.arp("0 1 2 3")' },
      { id: 'arp_up_8', label: 'Arp Up 1/8', icon: '↑', desc: 'Up eighth notes — 2 notes per beat', color: '#22d3ee', dragType: 'effect', payload: '.arp("0 1 2 3").fast(2)' },
      { id: 'arp_up_8t', label: 'Arp Up 1/8T', icon: '↑', desc: 'Up eighth triplets — 3 notes per beat', color: '#22d3ee', dragType: 'effect', payload: '.arp("0 1 2 3").fast(3)' },
      { id: 'arp_up_16', label: 'Arp Up 1/16', icon: '↑', desc: 'Up sixteenth notes — 4 notes per beat', color: '#22d3ee', dragType: 'effect', payload: '.arp("0 1 2 3").fast(4)' },
      { id: 'arp_up_16t', label: 'Arp Up 1/16T', icon: '↑', desc: 'Up sixteenth triplets — 6 notes per beat', color: '#22d3ee', dragType: 'effect', payload: '.arp("0 1 2 3").fast(6)' },
      { id: 'arp_up_32', label: 'Arp Up 1/32', icon: '↑', desc: 'Up thirty-second notes — 8 per beat', color: '#22d3ee', dragType: 'effect', payload: '.arp("0 1 2 3").fast(8)' },

      // ── Down direction at all divisions ──
      { id: 'arp_dn_4', label: 'Arp Down 1/4', icon: '↓', desc: 'Down quarter notes', color: '#60a5fa', dragType: 'effect', payload: '.arp("3 2 1 0")' },
      { id: 'arp_dn_8', label: 'Arp Down 1/8', icon: '↓', desc: 'Down eighth notes', color: '#60a5fa', dragType: 'effect', payload: '.arp("3 2 1 0").fast(2)' },
      { id: 'arp_dn_16', label: 'Arp Down 1/16', icon: '↓', desc: 'Down sixteenth notes', color: '#60a5fa', dragType: 'effect', payload: '.arp("3 2 1 0").fast(4)' },
      { id: 'arp_dn_16t', label: 'Arp Down 1/16T', icon: '↓', desc: 'Down sixteenth triplets', color: '#60a5fa', dragType: 'effect', payload: '.arp("3 2 1 0").fast(6)' },

      // ── Up-Down (bounce) at key divisions ──
      { id: 'arp_ud_4', label: 'Arp UpDn 1/4', icon: '↕', desc: 'Up-down quarter notes', color: '#a78bfa', dragType: 'effect', payload: '.arp("0 1 2 3 2 1")' },
      { id: 'arp_ud_8', label: 'Arp UpDn 1/8', icon: '↕', desc: 'Up-down eighth notes', color: '#a78bfa', dragType: 'effect', payload: '.arp("0 1 2 3 2 1").fast(2)' },
      { id: 'arp_ud_16', label: 'Arp UpDn 1/16', icon: '↕', desc: 'Up-down sixteenth notes', color: '#a78bfa', dragType: 'effect', payload: '.arp("0 1 2 3 2 1").fast(4)' },

      // ── Random arp at key divisions ──
      { id: 'arp_rnd_8', label: 'Arp Rand 1/8', icon: '🎲', desc: 'Random eighth notes', color: '#f472b6', dragType: 'effect', payload: '.arp(rand.range(0,3).segment(8))' },
      { id: 'arp_rnd_16', label: 'Arp Rand 1/16', icon: '🎲', desc: 'Random sixteenth notes', color: '#f472b6', dragType: 'effect', payload: '.arp(rand.range(0,3).segment(16))' },
      { id: 'arp_rnd_16t', label: 'Arp Rand 1/16T', icon: '🎲', desc: 'Random sixteenth triplets', color: '#f472b6', dragType: 'effect', payload: '.arp(rand.range(0,3).segment(24))' },
      { id: 'mod_off', label: 'Off (Canon)', icon: '⟩', desc: 'Offset copy +5th', color: '#c084fc', dragType: 'effect', payload: '.off(1/8, x => x.add(7))' },
      { id: 'mod_super', label: 'Superimpose', icon: '⊕', desc: 'Layer + octave transform', color: '#c084fc', dragType: 'effect', payload: '.superimpose(x => x.add(12).slow(2))' },
      { id: 'mod_jux', label: 'Jux (Stereo)', icon: '◐', desc: 'Function on R channel', color: '#22d3ee', dragType: 'effect', payload: '.jux(rev)' },
      { id: 'mod_juxBy', label: 'Jux 50%', icon: '◑', desc: 'Subtle stereo split', color: '#22d3ee', dragType: 'effect', payload: '.juxBy(0.5, rev)' },
      { id: 'mod_add7', label: 'Add +7 (5th)', icon: '⇧', desc: 'Transpose up a 5th', color: '#c084fc', dragType: 'effect', payload: '.add(7)' },
      { id: 'mod_add12', label: 'Add +12 (Oct)', icon: '⇑', desc: 'Transpose up octave', color: '#c084fc', dragType: 'effect', payload: '.add(12)' },
      { id: 'mod_echo', label: 'Echo Stutter', icon: '≡', desc: 'Pattern echo 3x', color: '#fb923c', dragType: 'effect', payload: '.echo(3, 1/8, 0.5)' },
    ]
  },
  {
    id: 'random', label: 'Random & Glitch', icon: '🎲', color: '#a78bfa',
    items: [
      { id: 'mod_degrade', label: 'Degrade', icon: '░', desc: 'Drop 30% events', color: '#ef4444', dragType: 'effect', payload: '.degradeBy(0.3)' },
      { id: 'mod_sometimes', label: 'Sometimes', icon: '?', desc: 'Random fast(2)', color: '#a78bfa', dragType: 'effect', payload: '.sometimes(fast(2))' },
      { id: 'mod_every4', label: 'Every 4', icon: '⚡', desc: 'Every 4 cycles: fast(2)', color: '#facc15', dragType: 'effect', payload: '.every(4, fast(2))' },
      { id: 'mod_when', label: 'When (Cond)', icon: '⚖', desc: 'Conditional transform', color: '#a78bfa', dragType: 'effect', payload: '.when(x => x > 0.5, rev)' },
      { id: 'mod_chop', label: 'Chop', icon: '✂', desc: 'Granular slices', color: '#34d399', dragType: 'effect', payload: '.chop(8)' },
      { id: 'mod_striate', label: 'Striate', icon: '≋', desc: 'Interleaved granular', color: '#34d399', dragType: 'effect', payload: '.striate(4)' },
    ]
  },
  {
    id: 'synth', label: 'Synth & Sample', icon: '🎛️', color: '#818cf8',
    items: [
      // Filters (most used)
      { id: 'syn_djf', label: 'DJ Filter', icon: '🎚️', desc: 'One-knob filter .djf(0.5)', color: '#60a5fa', dragType: 'effect', payload: '.djf(0.5)', method: 'djf' },
      { id: 'syn_lpq', label: 'Resonance', icon: '◎', desc: 'Filter resonance .lpq(5)', color: '#60a5fa', dragType: 'effect', payload: '.lpq(5)', method: 'lpq' },
      // FM Synthesis
      { id: 'syn_fmi', label: 'FM Index', icon: '📡', desc: 'FM modulation .fmi(2)', color: '#818cf8', dragType: 'effect', payload: '.fmi(2)', method: 'fmi' },
      { id: 'syn_fmh', label: 'FM Harmonicity', icon: '📡', desc: 'FM ratio .fmh(2)', color: '#818cf8', dragType: 'effect', payload: '.fmh(2)', method: 'fmh' },
      // Modulation
      { id: 'syn_noise', label: 'Noise', icon: '📻', desc: 'Noise mix .noise(0.5)', color: '#94a3b8', dragType: 'effect', payload: '.noise(0.5)', method: 'noise' },
      { id: 'syn_vib', label: 'Vibrato', icon: '∿', desc: 'Vibrato depth .vib(4)', color: '#a78bfa', dragType: 'effect', payload: '.vib(4)', method: 'vib' },
      { id: 'syn_vibmod', label: 'Vib Rate', icon: '∿', desc: 'Vibrato rate .vibmod(0.5)', color: '#a78bfa', dragType: 'effect', payload: '.vibmod(0.5)', method: 'vibmod' },
      // Distortion / Character
      { id: 'syn_squiz', label: 'Squiz', icon: '🔧', desc: 'Pitch squiz .squiz(2)', color: '#ef4444', dragType: 'effect', payload: '.squiz(2)', method: 'squiz' },
      { id: 'syn_leslie', label: 'Leslie', icon: '🌀', desc: 'Rotary speaker .leslie(1)', color: '#a78bfa', dragType: 'effect', payload: '.leslie(1)', method: 'leslie' },
      { id: 'syn_waveloss', label: 'Wave Loss', icon: '⚡', desc: 'Random sample drop .waveloss(40)', color: '#ef4444', dragType: 'effect', payload: '.waveloss(40)', method: 'waveloss' },
    ]
  },
  {
    id: 'sample_ctrl', label: 'Sample Control', icon: '⏩', color: '#f59e0b',
    items: [
      { id: 'syn_speed', label: 'Speed', icon: '⏩', desc: 'Playback speed .speed(1.5)', color: '#fb923c', dragType: 'effect', payload: '.speed(1.5)', method: 'speed' },
      { id: 'syn_begin', label: 'Begin', icon: '▶️', desc: 'Sample start .begin(0.25)', color: '#f59e0b', dragType: 'effect', payload: '.begin(0.25)', method: 'begin' },
      { id: 'syn_end', label: 'End', icon: '⏹️', desc: 'Sample end .end(0.75)', color: '#f59e0b', dragType: 'effect', payload: '.end(0.75)', method: 'end' },
      { id: 'syn_n', label: 'N (Variation)', icon: '#️⃣', desc: 'Sample/note index .n(2)', color: '#f59e0b', dragType: 'effect', payload: '.n(2)', method: 'n' },
      { id: 'syn_octave', label: 'Octave', icon: '🎼', desc: 'Octave shift .octave(4)', color: '#c084fc', dragType: 'effect', payload: '.octave(4)', method: 'octave' },
      { id: 'syn_cut', label: 'Cut Group', icon: '✂️', desc: 'Monophonic cut .cut(1)', color: '#94a3b8', dragType: 'effect', payload: '.cut(1)' },
      { id: 'syn_legato', label: 'Legato', icon: '🎶', desc: 'Note overlap .legato(0.8)', color: '#818cf8', dragType: 'effect', payload: '.legato(0.8)' },
      { id: 'syn_orbit', label: 'Orbit', icon: '🔄', desc: 'Effect bus .orbit(1)', color: '#94a3b8', dragType: 'effect', payload: '.orbit(1)' },
      // Envelope params
      { id: 'syn_decay', label: 'Decay', icon: '📐', desc: 'Decay time .decay(0.2)', color: '#818cf8', dragType: 'effect', payload: '.decay(0.2)', method: 'decay' },
      { id: 'syn_sustain', label: 'Sustain', icon: '📐', desc: 'Sustain level .sustain(0.5)', color: '#818cf8', dragType: 'effect', payload: '.sustain(0.5)', method: 'sustain' },
      // Send effects
      { id: 'syn_size', label: 'Reverb Size', icon: '🏛️', desc: 'Reverb size .size(0.5)', color: '#22d3ee', dragType: 'effect', payload: '.size(0.5)', method: 'size' },
      { id: 'syn_delayfb', label: 'Delay Feedback', icon: '🔄', desc: 'Feedback amt .delayfeedback(0.4)', color: '#fb923c', dragType: 'effect', payload: '.delayfeedback(0.4)', method: 'delayfeedback' },
      { id: 'syn_delaytime', label: 'Delay Time', icon: '⏱️', desc: 'Delay time .delaytime(0.25)', color: '#fb923c', dragType: 'effect', payload: '.delaytime(0.25)', method: 'delaytime' },
      // Orbit / bus routing
      { id: 'syn_orbit', label: 'Orbit', icon: '🔄', desc: 'Effect bus .orbit(2)', color: '#94a3b8', dragType: 'effect', payload: '.orbit(2)', method: 'orbit' },
      { id: 'syn_postgain', label: 'Postgain', icon: '📢', desc: 'Post-FX gain .postgain(1.5)', color: '#34d399', dragType: 'effect', payload: '.postgain(1.5)', method: 'postgain' },
    ]
  },
  {
    id: 'tremolo', label: 'Tremolo & Envelopes', icon: '∿', color: '#a78bfa',
    items: [
      // Tremolo (amplitude modulation)
      { id: 'trem_sync', label: 'Tremolo', icon: '∿', desc: 'Amplitude mod .tremolosync(4)', color: '#a78bfa', dragType: 'effect', payload: '.tremolosync(4)', method: 'tremolosync' },
      { id: 'trem_depth', label: 'Trem Depth', icon: '∿', desc: 'Mod depth .tremolodepth(0.5)', color: '#a78bfa', dragType: 'effect', payload: '.tremolodepth(0.5)', method: 'tremolodepth' },
      // Filter envelope (lpf modulation)
      { id: 'fenv_lpenv', label: 'LP Env Depth', icon: '📐', desc: 'Filter envelope .lpenv(4)', color: '#60a5fa', dragType: 'effect', payload: '.lpenv(4)', method: 'lpenv' },
      { id: 'fenv_lpa', label: 'LP Env Attack', icon: '📐', desc: 'Filter env attack .lpattack(0.1)', color: '#60a5fa', dragType: 'effect', payload: '.lpattack(0.1)', method: 'lpattack' },
      { id: 'fenv_lpd', label: 'LP Env Decay', icon: '📐', desc: 'Filter env decay .lpdecay(0.2)', color: '#60a5fa', dragType: 'effect', payload: '.lpdecay(0.2)', method: 'lpdecay' },
      { id: 'fenv_lps', label: 'LP Env Sustain', icon: '📐', desc: 'Filter env sustain .lpsustain(0.5)', color: '#60a5fa', dragType: 'effect', payload: '.lpsustain(0.5)', method: 'lpsustain' },
      { id: 'fenv_lpr', label: 'LP Env Release', icon: '📐', desc: 'Filter env release .lprelease(0.5)', color: '#60a5fa', dragType: 'effect', payload: '.lprelease(0.5)', method: 'lprelease' },
      // Pitch envelope
      { id: 'penv_depth', label: 'Pitch Env', icon: '🎵', desc: 'Pitch envelope .penv(12)', color: '#c084fc', dragType: 'effect', payload: '.penv(12)', method: 'penv' },
      { id: 'penv_att', label: 'Pitch Att', icon: '🎵', desc: 'Pitch env attack .pattack(0.01)', color: '#c084fc', dragType: 'effect', payload: '.pattack(0.01)', method: 'pattack' },
      { id: 'penv_dec', label: 'Pitch Dec', icon: '🎵', desc: 'Pitch env decay .pdecay(0.1)', color: '#c084fc', dragType: 'effect', payload: '.pdecay(0.1)', method: 'pdecay' },
    ]
  },
  {
    id: 'euclidean', label: 'Euclidean', icon: '◇', color: '#34d399',
    items: [
      { id: 'euc_35', label: 'E(3,5)', icon: '◇', desc: 'Afro-Cuban 3/5', color: '#34d399', dragType: 'effect', payload: '.euclid(3,5)' },
      { id: 'euc_38', label: 'E(3,8)', icon: '◇', desc: 'Sparse 3/8', color: '#34d399', dragType: 'effect', payload: '.euclid(3,8)' },
      { id: 'euc_58', label: 'E(5,8)', icon: '◆', desc: 'Tresillo 5/8', color: '#34d399', dragType: 'effect', payload: '.euclid(5,8)' },
      { id: 'euc_78', label: 'E(7,8)', icon: '◆', desc: 'Dense 7/8', color: '#34d399', dragType: 'effect', payload: '.euclid(7,8)' },
      { id: 'euc_716', label: 'E(7,16)', icon: '◈', desc: 'West African 7/16', color: '#34d399', dragType: 'effect', payload: '.euclid(7,16)' },
      { id: 'euc_516', label: 'E(5,16)', icon: '◈', desc: 'Bossa nova 5/16', color: '#34d399', dragType: 'effect', payload: '.euclid(5,16)' },
      { id: 'euc_912', label: 'E(9,16)', icon: '●', desc: 'Aksak 9/16', color: '#34d399', dragType: 'effect', payload: '.euclid(9,16)' },
    ]
  },
  {
    id: 'envelope', label: 'Envelopes', icon: '📐', color: '#818cf8',
    items: [
      { id: 'env_pluck', label: 'Pluck', icon: '🎸', desc: 'Fast attack, no sustain', color: '#818cf8', dragType: 'effect', payload: '.attack(0.001).decay(0.2).sustain(0).release(0.1)' },
      { id: 'env_pad', label: 'Pad', icon: '☁️', desc: 'Slow attack, long release', color: '#818cf8', dragType: 'effect', payload: '.attack(0.5).decay(0.3).sustain(0.7).release(2)' },
      { id: 'env_stab', label: 'Stab', icon: '🗡️', desc: 'Punch, short', color: '#818cf8', dragType: 'effect', payload: '.attack(0.001).decay(0.1).sustain(0).release(0.05)' },
      { id: 'env_swell', label: 'Swell', icon: '🌊', desc: 'Slow in, slow out', color: '#818cf8', dragType: 'effect', payload: '.attack(1).decay(0.5).sustain(0.5).release(1.5)' },
      { id: 'env_perc', label: 'Percussive', icon: '🥁', desc: 'Sharp hit, fast decay', color: '#818cf8', dragType: 'effect', payload: '.attack(0).decay(0.15).sustain(0).release(0.08)' },
    ]
  },
  {
    id: 'lfo', label: 'LFO / Modulation', icon: '∿', color: '#a78bfa',
    items: [
      { id: 'lfo_lpf_sine', label: 'Filter Wobble', icon: '∿', desc: 'LPF sine sweep', color: '#a78bfa', dragType: 'lfo', payload: '.lpf(sine.range(200,4000).slow(4))', method: 'lpf' },
      { id: 'lfo_pan_sine', label: 'Auto-Pan', icon: '↔', desc: 'Stereo sweep', color: '#a78bfa', dragType: 'lfo', payload: '.pan(sine.range(0,1).slow(4))', method: 'pan' },
      { id: 'lfo_gain_tri', label: 'Tremolo', icon: '△', desc: 'Volume flutter', color: '#a78bfa', dragType: 'lfo', payload: '.gain(tri.range(0.2,0.8).slow(2))', method: 'gain' },
      { id: 'lfo_hpf_saw', label: 'Riser', icon: '⟋', desc: 'HPF rising saw', color: '#a78bfa', dragType: 'lfo', payload: '.hpf(saw.range(50,3000).slow(8))', method: 'hpf' },
      { id: 'lfo_room_perlin', label: 'Space Drift', icon: '≈', desc: 'Organic reverb', color: '#a78bfa', dragType: 'lfo', payload: '.room(perlin.range(0.1,0.8).slow(8))', method: 'room' },
      { id: 'lfo_speed_cos', label: 'Speed Wobble', icon: '∾', desc: 'Pitch warble', color: '#a78bfa', dragType: 'lfo', payload: '.speed(cosine.range(0.8,1.2).slow(4))', method: 'speed' },
      { id: 'lfo_crush_rand', label: 'Glitch Crush', icon: '⁂', desc: 'Random bitcrush', color: '#a78bfa', dragType: 'lfo', payload: '.crush(rand.range(4,16).segment(4))', method: 'crush' },
      { id: 'lfo_phaser_sine', label: 'Phase Sweep', icon: '🌀', desc: 'Slow phaser', color: '#a78bfa', dragType: 'lfo', payload: '.phaser(sine.range(0,12).slow(6))', method: 'phaser' },
    ]
  },
  {
    id: 'scales', label: 'Scales', icon: '🎼', color: '#f59e0b',
    items: [
      { id: 'sc_cmaj', label: 'C Major', icon: '🎵', desc: 'Ionian', color: '#f59e0b', dragType: 'scale', payload: 'C4:major' },
      { id: 'sc_amin', label: 'A Minor', icon: '🎵', desc: 'Natural minor', color: '#f59e0b', dragType: 'scale', payload: 'A3:minor' },
      { id: 'sc_aharm', label: 'A Harmonic Min', icon: '🎵', desc: 'Harmonic minor', color: '#f59e0b', dragType: 'scale', payload: 'A3:harmonic minor' },
      { id: 'sc_cmajp', label: 'C Maj Pentatonic', icon: '🎵', desc: '5-note major', color: '#f59e0b', dragType: 'scale', payload: 'C4:major pentatonic' },
      { id: 'sc_aminp', label: 'A Min Pentatonic', icon: '🎵', desc: '5-note minor', color: '#f59e0b', dragType: 'scale', payload: 'A3:minor pentatonic' },
      { id: 'sc_cblues', label: 'C Blues', icon: '🎵', desc: 'Blues scale', color: '#f59e0b', dragType: 'scale', payload: 'C4:blues' },
      { id: 'sc_ddor', label: 'D Dorian', icon: '🎵', desc: 'Jazz/funk mode', color: '#f59e0b', dragType: 'scale', payload: 'D4:dorian' },
      { id: 'sc_ephry', label: 'E Phrygian', icon: '🎵', desc: 'Spanish/flamenco', color: '#f59e0b', dragType: 'scale', payload: 'E4:phrygian' },
      { id: 'sc_flyd', label: 'F Lydian', icon: '🎵', desc: 'Dreamy mode', color: '#f59e0b', dragType: 'scale', payload: 'F4:lydian' },
      { id: 'sc_gmixo', label: 'G Mixolydian', icon: '🎵', desc: 'Dominant 7th feel', color: '#f59e0b', dragType: 'scale', payload: 'G4:mixolydian' },
      { id: 'sc_chrom', label: 'Chromatic', icon: '🎵', desc: 'All 12 notes', color: '#f59e0b', dragType: 'scale', payload: 'C4:chromatic' },
      { id: 'sc_wholetone', label: 'Whole Tone', icon: '🎵', desc: 'Dreamy/surreal', color: '#f59e0b', dragType: 'scale', payload: 'C4:whole tone' },
      { id: 'sc_dim', label: 'Diminished', icon: '🎵', desc: 'Spooky/tense', color: '#f59e0b', dragType: 'scale', payload: 'C4:diminished' },
    ]
  },
  {
    id: 'chords', label: 'Chord Progressions', icon: '🎹', color: '#c084fc',
    items: [
      // ── 4-bar progressions (4 chords = 1 chord per bar) ──
      { id: 'ch_1564', label: 'I-V-vi-IV (Pop)', icon: '🎹', desc: '4 bars · The hit maker', color: '#c084fc', dragType: 'chord', payload: '<[c3,e3,g3] [g2,b2,d3] [a2,c3,e3] [f2,a2,c3]>' },
      { id: 'ch_1645', label: 'I-vi-IV-V (50s)', icon: '🎹', desc: '4 bars · Doo-wop classic', color: '#c084fc', dragType: 'chord', payload: '<[c3,e3,g3] [a2,c3,e3] [f2,a2,c3] [g2,b2,d3]>' },
      { id: 'ch_1451', label: 'I-IV-V-I (Rock)', icon: '🎹', desc: '4 bars · Rock/country staple', color: '#c084fc', dragType: 'chord', payload: '<[c3,e3,g3] [f2,a2,c3] [g2,b2,d3] [c3,e3,g3]>' },
      { id: 'ch_sad', label: 'i-VI-III-VII (Sad)', icon: '🎹', desc: '4 bars · Emotional minor', color: '#c084fc', dragType: 'chord', payload: '<[a2,c3,e3] [f2,a2,c3] [c3,e3,g3] [g2,b2,d3]>' },
      { id: 'ch_minor_14', label: 'i-iv-v-i (Dark)', icon: '🎹', desc: '4 bars · Pure minor', color: '#c084fc', dragType: 'chord', payload: '<[a2,c3,e3] [d3,f3,a3] [e3,g3,b3] [a2,c3,e3]>' },
      { id: 'ch_dreamy', label: 'Dreamy (Open)', icon: '🎹', desc: '4 bars · Ethereal open voicing', color: '#c084fc', dragType: 'chord', payload: '<[c3,g3,e4] [a2,e3,c4] [f3,c4,a4] [g3,d4,b4]>' },
      { id: 'ch_251', label: 'ii-V-I-I (Jazz)', icon: '🎹', desc: '4 bars · Jazz resolution', color: '#c084fc', dragType: 'chord', payload: '<[d3,f3,a3,c4] [g2,b2,d3,f3] [c3,e3,g3,b3] [c3,e3,g3,b3]>' },
      { id: 'ch_neo', label: 'Neo Soul (9ths)', icon: '🎹', desc: '4 bars · Rich extended harmony', color: '#c084fc', dragType: 'chord', payload: '<[d3,f3,a3,c4,e4] [g2,b2,d3,f3,a3] [c3,e3,g3,b3,d4] [a2,c3,e3,g3,b3]>' },
      { id: 'ch_ambient', label: 'Ambient Float', icon: '🎹', desc: '4 bars · Spacious pads', color: '#c084fc', dragType: 'chord', payload: '<[d3,a3,f4] [g3,d4,b4] [c3,g3,e4] [a2,e3,c4]>' },
      // ── 8-bar progressions (8 chords = 1 chord per bar) ──
      { id: 'ch_8bar_pop', label: '8-Bar Pop Verse', icon: '🎹', desc: '8 bars · I-V-vi-IV x2 varied', color: '#c084fc', dragType: 'chord', payload: '<[c3,e3,g3] [g2,b2,d3] [a2,c3,e3] [f2,a2,c3] [c3,e3,g3] [f2,a2,c3] [a2,c3,e3] [g2,b2,d3]>' },
      { id: 'ch_lofi', label: '8-Bar Lofi', icon: '🎹', desc: '8 bars · Warm 7th chill cycle', color: '#c084fc', dragType: 'chord', payload: '<[d3,f3,a3,c4] [g2,b2,d3,f3] [c3,e3,g3,b3] [a2,c3,e3,g3] [f3,a3,c4,e4] [e3,g3,b3,d4] [d3,f3,a3,c4] [g2,b2,d3,f3]>' },
      { id: 'ch_12bar', label: '12-Bar Blues', icon: '🎹', desc: '12 bars · I-I-I-I IV-IV-I-I V-IV-I-V', color: '#c084fc', dragType: 'chord', payload: '<[c3,e3,g3] [c3,e3,g3] [c3,e3,g3] [c3,e3,g3] [f2,a2,c3] [f2,a2,c3] [c3,e3,g3] [c3,e3,g3] [g2,b2,d3] [f2,a2,c3] [c3,e3,g3] [g2,b2,d3]>' },
      { id: 'ch_rnb8', label: '8-Bar R&B', icon: '🎹', desc: '8 bars · Smooth groove', color: '#c084fc', dragType: 'chord', payload: '<[c3,e3,g3,b3] [a2,c3,e3,g3] [f2,a2,c3,e3] [g2,b2,d3,f3] [c3,e3,g3,b3] [d3,f3,a3,c4] [e3,g3,b3,d4] [g2,b2,d3,f3]>' },
    ]
  },
  {
    id: 'sounds', label: 'Instruments', icon: '🎸', color: '#fb923c',
    items: [
      // ── Pianos & Keys ──
      { id: 'snd_piano', label: 'Piano', icon: '🎹', desc: 'Acoustic Grand Piano', color: '#fb923c', dragType: 'sound', payload: 'gm_piano' },
      { id: 'snd_bright_piano', label: 'Bright Piano', icon: '🎹', desc: 'Bright Acoustic Piano', color: '#fb923c', dragType: 'sound', payload: 'gm_bright_acoustic_piano' },
      { id: 'snd_epiano', label: 'E-Piano / Rhodes', icon: '🎹', desc: 'Electric Piano 1', color: '#fb923c', dragType: 'sound', payload: 'gm_epiano1' },
      { id: 'snd_epiano2', label: 'E-Piano 2', icon: '🎹', desc: 'Electric Piano 2 / FM', color: '#fb923c', dragType: 'sound', payload: 'gm_epiano2' },
      { id: 'snd_honkytonk', label: 'Honky-Tonk', icon: '🎹', desc: 'Honky-tonk Piano', color: '#fb923c', dragType: 'sound', payload: 'gm_honkytonk_piano' },
      { id: 'snd_harpsichord', label: 'Harpsichord', icon: '🎹', desc: 'Baroque keyboard', color: '#fb923c', dragType: 'sound', payload: 'gm_harpsichord' },
      { id: 'snd_clavinet', label: 'Clavinet', icon: '🎹', desc: 'Funky clavinet', color: '#fb923c', dragType: 'sound', payload: 'gm_clavinet' },
      { id: 'snd_celesta', label: 'Celesta', icon: '✨', desc: 'Sparkling celesta', color: '#fb923c', dragType: 'sound', payload: 'gm_celesta' },
      { id: 'snd_music_box', label: 'Music Box', icon: '🎵', desc: 'Celeste/music box', color: '#fb923c', dragType: 'sound', payload: 'gm_music_box' },
      // ── Organs ──
      { id: 'snd_organ', label: 'Drawbar Organ', icon: '⛪', desc: 'Hammond-style organ', color: '#fb923c', dragType: 'sound', payload: 'gm_drawbar_organ' },
      { id: 'snd_perc_organ', label: 'Perc Organ', icon: '⛪', desc: 'Percussive organ', color: '#fb923c', dragType: 'sound', payload: 'gm_percussive_organ' },
      { id: 'snd_rock_organ', label: 'Rock Organ', icon: '⛪', desc: 'Distorted organ', color: '#fb923c', dragType: 'sound', payload: 'gm_rock_organ' },
      { id: 'snd_church_organ', label: 'Church Organ', icon: '⛪', desc: 'Pipe organ', color: '#fb923c', dragType: 'sound', payload: 'gm_church_organ' },
      { id: 'snd_accordion', label: 'Accordion', icon: '🪗', desc: 'French accordion', color: '#fb923c', dragType: 'sound', payload: 'gm_accordion' },
      { id: 'snd_harmonica', label: 'Harmonica', icon: '🎵', desc: 'Blues harmonica', color: '#fb923c', dragType: 'sound', payload: 'gm_harmonica' },
      // ── Guitars ──
      { id: 'snd_guitar', label: 'Nylon Guitar', icon: '🎸', desc: 'Acoustic nylon', color: '#fb923c', dragType: 'sound', payload: 'gm_acoustic_guitar_nylon' },
      { id: 'snd_steel_guitar', label: 'Steel Guitar', icon: '🎸', desc: 'Acoustic steel', color: '#fb923c', dragType: 'sound', payload: 'gm_acoustic_guitar_steel' },
      { id: 'snd_jazz_guitar', label: 'Jazz Guitar', icon: '🎸', desc: 'Clean jazz guitar', color: '#fb923c', dragType: 'sound', payload: 'gm_electric_guitar_jazz' },
      { id: 'snd_clean_guitar', label: 'Clean Guitar', icon: '🎸', desc: 'Electric clean', color: '#fb923c', dragType: 'sound', payload: 'gm_electric_guitar_clean' },
      { id: 'snd_muted_guitar', label: 'Muted Guitar', icon: '🎸', desc: 'Palm muted', color: '#fb923c', dragType: 'sound', payload: 'gm_electric_guitar_muted' },
      { id: 'snd_overdrive', label: 'Overdrive Guitar', icon: '🎸', desc: 'Overdriven', color: '#fb923c', dragType: 'sound', payload: 'gm_overdriven_guitar' },
      { id: 'snd_dist_guitar', label: 'Distortion Guitar', icon: '🎸', desc: 'Heavy dist', color: '#fb923c', dragType: 'sound', payload: 'gm_distortion_guitar' },
      // ── Bass ──
      { id: 'snd_bass_ac', label: 'Acoustic Bass', icon: '🎸', desc: 'Upright bass', color: '#fb923c', dragType: 'sound', payload: 'gm_acoustic_bass' },
      { id: 'snd_finger_bass', label: 'Finger Bass', icon: '🎸', desc: 'Electric finger bass', color: '#fb923c', dragType: 'sound', payload: 'gm_electric_bass_finger' },
      { id: 'snd_pick_bass', label: 'Pick Bass', icon: '🎸', desc: 'Electric pick bass', color: '#fb923c', dragType: 'sound', payload: 'gm_electric_bass_pick' },
      { id: 'snd_fretless_bass', label: 'Fretless Bass', icon: '🎸', desc: 'Smooth fretless', color: '#fb923c', dragType: 'sound', payload: 'gm_fretless_bass' },
      { id: 'snd_slap_bass1', label: 'Slap Bass', icon: '🎸', desc: 'Funky slap', color: '#fb923c', dragType: 'sound', payload: 'gm_slap_bass_1' },
      { id: 'snd_synth_bass1', label: 'Synth Bass 1', icon: '🎸', desc: 'Analog synth bass', color: '#fb923c', dragType: 'sound', payload: 'gm_synth_bass_1' },
      { id: 'snd_synth_bass2', label: 'Synth Bass 2', icon: '🎸', desc: 'Digital synth bass', color: '#fb923c', dragType: 'sound', payload: 'gm_synth_bass_2' },
      // ── Strings & Orchestra ──
      { id: 'snd_violin', label: 'Violin', icon: '🎻', desc: 'Solo violin', color: '#fb923c', dragType: 'sound', payload: 'gm_violin' },
      { id: 'snd_viola', label: 'Viola', icon: '🎻', desc: 'Solo viola', color: '#fb923c', dragType: 'sound', payload: 'gm_viola' },
      { id: 'snd_cello', label: 'Cello', icon: '🎻', desc: 'Solo cello', color: '#fb923c', dragType: 'sound', payload: 'gm_cello' },
      { id: 'snd_contrabass', label: 'Contrabass', icon: '🎻', desc: 'Double bass', color: '#fb923c', dragType: 'sound', payload: 'gm_contrabass' },
      { id: 'snd_strings', label: 'String Ensemble', icon: '🎻', desc: 'Lush strings', color: '#fb923c', dragType: 'sound', payload: 'gm_string_ensemble_1' },
      { id: 'snd_strings2', label: 'Slow Strings', icon: '🎻', desc: 'Slow attack strings', color: '#fb923c', dragType: 'sound', payload: 'gm_string_ensemble_2' },
      { id: 'snd_synth_strings', label: 'Synth Strings', icon: '🎻', desc: 'Analog string pad', color: '#fb923c', dragType: 'sound', payload: 'gm_synth_strings_1' },
      { id: 'snd_pizzicato', label: 'Pizzicato', icon: '🎻', desc: 'Plucked strings', color: '#fb923c', dragType: 'sound', payload: 'gm_pizzicato_strings' },
      { id: 'snd_harp', label: 'Harp', icon: '🎵', desc: 'Orchestral harp', color: '#fb923c', dragType: 'sound', payload: 'gm_orchestral_harp' },
      { id: 'snd_timpani', label: 'Timpani', icon: '🥁', desc: 'Orchestral timpani', color: '#fb923c', dragType: 'sound', payload: 'gm_timpani' },
      // ── Choir & Voices ──
      { id: 'snd_choir', label: 'Choir Aahs', icon: '🎤', desc: 'Choir Aahs', color: '#fb923c', dragType: 'sound', payload: 'gm_choir_aahs' },
      { id: 'snd_voice_oohs', label: 'Voice Oohs', icon: '🎤', desc: 'Voice Oohs', color: '#fb923c', dragType: 'sound', payload: 'gm_voice_oohs' },
      { id: 'snd_synth_voice', label: 'Synth Voice', icon: '🎤', desc: 'Synth choir', color: '#fb923c', dragType: 'sound', payload: 'gm_synth_choir' },
      // ── Brass ──
      { id: 'snd_trumpet', label: 'Trumpet', icon: '🎺', desc: 'Bright trumpet', color: '#fb923c', dragType: 'sound', payload: 'gm_trumpet' },
      { id: 'snd_trombone', label: 'Trombone', icon: '🎺', desc: 'Jazz trombone', color: '#fb923c', dragType: 'sound', payload: 'gm_trombone' },
      { id: 'snd_tuba', label: 'Tuba', icon: '🎺', desc: 'Deep tuba', color: '#fb923c', dragType: 'sound', payload: 'gm_tuba' },
      { id: 'snd_muted_trumpet', label: 'Muted Trumpet', icon: '🎺', desc: 'Harmon mute', color: '#fb923c', dragType: 'sound', payload: 'gm_muted_trumpet' },
      { id: 'snd_french_horn', label: 'French Horn', icon: '🎺', desc: 'Warm horn', color: '#fb923c', dragType: 'sound', payload: 'gm_french_horn' },
      { id: 'snd_brass', label: 'Brass Section', icon: '🎺', desc: 'Brass ensemble', color: '#fb923c', dragType: 'sound', payload: 'gm_brass_section' },
      { id: 'snd_synth_brass', label: 'Synth Brass', icon: '🎺', desc: 'Analog brass', color: '#fb923c', dragType: 'sound', payload: 'gm_synth_brass_1' },
      // ── Woodwinds & Reeds ──
      { id: 'snd_soprano_sax', label: 'Soprano Sax', icon: '🎷', desc: 'Soprano saxophone', color: '#fb923c', dragType: 'sound', payload: 'gm_soprano_sax' },
      { id: 'snd_alto_sax', label: 'Alto Sax', icon: '🎷', desc: 'Alto saxophone', color: '#fb923c', dragType: 'sound', payload: 'gm_alto_sax' },
      { id: 'snd_tenor_sax', label: 'Tenor Sax', icon: '🎷', desc: 'Tenor saxophone', color: '#fb923c', dragType: 'sound', payload: 'gm_tenor_sax' },
      { id: 'snd_bari_sax', label: 'Bari Sax', icon: '🎷', desc: 'Baritone saxophone', color: '#fb923c', dragType: 'sound', payload: 'gm_baritone_sax' },
      { id: 'snd_oboe', label: 'Oboe', icon: '🎶', desc: 'Classical oboe', color: '#fb923c', dragType: 'sound', payload: 'gm_oboe' },
      { id: 'snd_english_horn', label: 'English Horn', icon: '🎶', desc: 'Cor anglais', color: '#fb923c', dragType: 'sound', payload: 'gm_english_horn' },
      { id: 'snd_bassoon', label: 'Bassoon', icon: '🎶', desc: 'Double reed bass', color: '#fb923c', dragType: 'sound', payload: 'gm_bassoon' },
      { id: 'snd_clarinet', label: 'Clarinet', icon: '🎶', desc: 'Bb clarinet', color: '#fb923c', dragType: 'sound', payload: 'gm_clarinet' },
      { id: 'snd_flute', label: 'Flute', icon: '🎶', desc: 'Concert flute', color: '#fb923c', dragType: 'sound', payload: 'gm_flute' },
      { id: 'snd_piccolo', label: 'Piccolo', icon: '🎶', desc: 'High piccolo', color: '#fb923c', dragType: 'sound', payload: 'gm_piccolo' },
      { id: 'snd_recorder', label: 'Recorder', icon: '🎶', desc: 'Alto recorder', color: '#fb923c', dragType: 'sound', payload: 'gm_recorder' },
      { id: 'snd_pan_flute', label: 'Pan Flute', icon: '🎶', desc: 'Airy pan flute', color: '#fb923c', dragType: 'sound', payload: 'gm_pan_flute' },
      { id: 'snd_shakuhachi', label: 'Shakuhachi', icon: '🎶', desc: 'Japanese bamboo', color: '#fb923c', dragType: 'sound', payload: 'gm_shakuhachi' },
      { id: 'snd_whistle', label: 'Whistle', icon: '🎶', desc: 'Clean whistle', color: '#fb923c', dragType: 'sound', payload: 'gm_whistle' },
      { id: 'snd_ocarina', label: 'Ocarina', icon: '🎶', desc: 'Ceramic ocarina', color: '#fb923c', dragType: 'sound', payload: 'gm_ocarina' },
      // ── Synth Leads ──
      { id: 'snd_square_lead', label: 'Square Lead', icon: '🎹', desc: 'GM Square Lead', color: '#fb923c', dragType: 'sound', payload: 'gm_lead_1_square' },
      { id: 'snd_saw_lead', label: 'Saw Lead', icon: '🎹', desc: 'GM Saw Lead', color: '#fb923c', dragType: 'sound', payload: 'gm_lead_2_sawtooth' },
      { id: 'snd_calliope_lead', label: 'Calliope', icon: '🎹', desc: 'Steam organ lead', color: '#fb923c', dragType: 'sound', payload: 'gm_lead_3_calliope' },
      { id: 'snd_chiff_lead', label: 'Chiff Lead', icon: '🎹', desc: 'Breathy lead', color: '#fb923c', dragType: 'sound', payload: 'gm_lead_4_chiff' },
      { id: 'snd_charang_lead', label: 'Charang', icon: '🎹', desc: 'Distorted lead', color: '#fb923c', dragType: 'sound', payload: 'gm_lead_5_charang' },
      // ── Synth Pads ──
      { id: 'snd_new_age_pad', label: 'New Age Pad', icon: '🌌', desc: 'Warm new age', color: '#fb923c', dragType: 'sound', payload: 'gm_pad_1_new_age' },
      { id: 'snd_warm_pad', label: 'Warm Pad', icon: '🌌', desc: 'Analog warmth', color: '#fb923c', dragType: 'sound', payload: 'gm_pad_2_warm' },
      { id: 'snd_polysynth_pad', label: 'Polysynth', icon: '🌌', desc: 'Rich poly pad', color: '#fb923c', dragType: 'sound', payload: 'gm_pad_3_polysynth' },
      { id: 'snd_choir_pad', label: 'Choir Pad', icon: '🌌', desc: 'Synth choir pad', color: '#fb923c', dragType: 'sound', payload: 'gm_pad_4_choir' },
      { id: 'snd_bowed_pad', label: 'Bowed Pad', icon: '🌌', desc: 'Glass bowed', color: '#fb923c', dragType: 'sound', payload: 'gm_pad_5_bowed' },
      { id: 'snd_metallic_pad', label: 'Metallic Pad', icon: '🌌', desc: 'Metallic texture', color: '#fb923c', dragType: 'sound', payload: 'gm_pad_6_metallic' },
      { id: 'snd_halo_pad', label: 'Halo Pad', icon: '🌌', desc: 'Ethereal halo', color: '#fb923c', dragType: 'sound', payload: 'gm_pad_7_halo' },
      { id: 'snd_sweep_pad', label: 'Sweep Pad', icon: '🌌', desc: 'Filter sweep pad', color: '#fb923c', dragType: 'sound', payload: 'gm_pad_8_sweep' },
      // ── Ethnic & World ──
      { id: 'snd_sitar', label: 'Sitar', icon: '🪕', desc: 'Indian sitar', color: '#fb923c', dragType: 'sound', payload: 'gm_sitar' },
      { id: 'snd_banjo', label: 'Banjo', icon: '🪕', desc: 'Bluegrass banjo', color: '#fb923c', dragType: 'sound', payload: 'gm_banjo' },
      { id: 'snd_shamisen', label: 'Shamisen', icon: '🪕', desc: 'Japanese shamisen', color: '#fb923c', dragType: 'sound', payload: 'gm_shamisen' },
      { id: 'snd_koto', label: 'Koto', icon: '🪕', desc: 'Japanese koto', color: '#fb923c', dragType: 'sound', payload: 'gm_koto' },
      { id: 'snd_kalimba', label: 'Kalimba', icon: '🎵', desc: 'African thumb piano', color: '#fb923c', dragType: 'sound', payload: 'gm_kalimba' },
      { id: 'snd_bagpipe', label: 'Bagpipe', icon: '🎵', desc: 'Scottish bagpipe', color: '#fb923c', dragType: 'sound', payload: 'gm_bagpipe' },
      { id: 'snd_fiddle', label: 'Fiddle', icon: '🎻', desc: 'Country fiddle', color: '#fb923c', dragType: 'sound', payload: 'gm_fiddle' },
      { id: 'snd_steel_drum', label: 'Steel Drum', icon: '🥁', desc: 'Caribbean steel', color: '#fb923c', dragType: 'sound', payload: 'gm_steel_drum' },
      // ── Mallet & Percussion ──
      { id: 'snd_glocken', label: 'Glockenspiel', icon: '🔔', desc: 'Bright bells', color: '#fb923c', dragType: 'sound', payload: 'gm_glockenspiel' },
      { id: 'snd_vibes', label: 'Vibraphone', icon: '🎵', desc: 'Mellow vibraphone', color: '#fb923c', dragType: 'sound', payload: 'gm_vibraphone' },
      { id: 'snd_marimba', label: 'Marimba', icon: '🎵', desc: 'Wooden marimba', color: '#fb923c', dragType: 'sound', payload: 'gm_marimba' },
      { id: 'snd_xylophone', label: 'Xylophone', icon: '🎵', desc: 'Bright xylophone', color: '#fb923c', dragType: 'sound', payload: 'gm_xylophone' },
      { id: 'snd_tubular_bells', label: 'Tubular Bells', icon: '🔔', desc: 'Church bells', color: '#fb923c', dragType: 'sound', payload: 'gm_tubular_bells' },
      // ── Synth FX ──
      { id: 'snd_fx_rain', label: 'Rain FX', icon: '🌧️', desc: 'Synth rain', color: '#fb923c', dragType: 'sound', payload: 'gm_fx_1_rain' },
      { id: 'snd_fx_soundtrack', label: 'Soundtrack FX', icon: '🎬', desc: 'Cinematic pad', color: '#fb923c', dragType: 'sound', payload: 'gm_fx_2_soundtrack' },
      { id: 'snd_fx_crystal', label: 'Crystal FX', icon: '💎', desc: 'Sparkly texture', color: '#fb923c', dragType: 'sound', payload: 'gm_fx_3_crystal' },
      { id: 'snd_fx_atmosphere', label: 'Atmosphere FX', icon: '🌌', desc: 'Ambient texture', color: '#fb923c', dragType: 'sound', payload: 'gm_fx_4_atmosphere' },
      { id: 'snd_fx_brightness', label: 'Brightness FX', icon: '✨', desc: 'Bright shimmer', color: '#fb923c', dragType: 'sound', payload: 'gm_fx_5_brightness' },
      // ── Basic Waveforms ──
      { id: 'snd_sine', label: 'Sine', icon: '∿', desc: 'Pure sine wave', color: '#fb923c', dragType: 'sound', payload: 'sine' },
      { id: 'snd_saw', label: 'Sawtooth', icon: '⟋', desc: 'Bright saw wave', color: '#fb923c', dragType: 'sound', payload: 'sawtooth' },
      { id: 'snd_square', label: 'Square', icon: '□', desc: 'Hollow square wave', color: '#fb923c', dragType: 'sound', payload: 'square' },
      { id: 'snd_tri', label: 'Triangle', icon: '△', desc: 'Soft triangle wave', color: '#fb923c', dragType: 'sound', payload: 'triangle' },
    ]
  },
  {
    id: 'drums', label: 'Drum Machines', icon: '🥁', color: '#f59e0b',
    items: [
      { id: 'dm_808', label: 'TR-808', icon: '🥁', desc: 'Roland TR-808', color: '#f59e0b', dragType: 'sound', payload: 'RolandTR808' },
      { id: 'dm_909', label: 'TR-909', icon: '🥁', desc: 'Roland TR-909', color: '#f59e0b', dragType: 'sound', payload: 'RolandTR909' },
      { id: 'dm_cr78', label: 'CR-78', icon: '🥁', desc: 'Roland CR-78', color: '#f59e0b', dragType: 'sound', payload: 'RolandCR78' },
      { id: 'dm_compurhy', label: 'CompuRhythm', icon: '🥁', desc: 'Roland CR-8000', color: '#f59e0b', dragType: 'sound', payload: 'RolandCompuRhythm8000' },
      { id: 'dm_linn', label: 'Linn Drum', icon: '🥁', desc: 'Akai LinnDrum', color: '#f59e0b', dragType: 'sound', payload: 'AkaiLinn' },
      { id: 'dm_minipops', label: 'Korg Minipops', icon: '🥁', desc: 'Korg Minipops', color: '#f59e0b', dragType: 'sound', payload: 'KorgMinipops' },
      { id: 'dm_dr55', label: 'Boss DR-55', icon: '🥁', desc: 'Boss DR-55', color: '#f59e0b', dragType: 'sound', payload: 'BossDR55' },
      { id: 'dm_spacedrum', label: 'Space Drum', icon: '🥁', desc: 'Visco Space Drum', color: '#f59e0b', dragType: 'sound', payload: 'ViscoSpaceDrum' },
      { id: 'dm_xr10', label: 'Akai XR10', icon: '🥁', desc: 'Akai XR10', color: '#f59e0b', dragType: 'sound', payload: 'AkaiXR10' },
      { id: 'dm_rhythmace', label: 'Rhythm Ace', icon: '🥁', desc: 'Ace Tone Rhythm Ace', color: '#f59e0b', dragType: 'sound', payload: 'RhythmAce' },
    ]
  },
  {
    id: 'drum_patterns', label: 'Drum Patterns', icon: '🥁', color: '#f59e0b',
    items: [
      { id: 'pat_kicks', label: '4 Kicks', icon: '🥁', desc: 'Simple kick pattern', color: '#f59e0b', dragType: 'pattern', payload: 'bd*4' },
      { id: 'pat_basic', label: 'Basic 4/4', icon: '🥁', desc: 'Standard rock', color: '#f59e0b', dragType: 'pattern', payload: 'bd [~ bd] ~ ~, ~ cp ~ ~, hh*8' },
      { id: 'pat_four', label: 'Four-on-floor', icon: '🥁', desc: 'Dance/house', color: '#f59e0b', dragType: 'pattern', payload: 'bd*4, ~ cp ~ cp, hh*8' },
      { id: 'pat_trap', label: 'Trap', icon: '🥁', desc: 'Fast hats', color: '#f59e0b', dragType: 'pattern', payload: '[bd ~ ~ ~] ~ [~ bd] ~, ~ [~ cp] ~ ~, hh*16' },
      { id: 'pat_lofi', label: 'Lofi Shuffle', icon: '🥁', desc: 'Chill groove', color: '#f59e0b', dragType: 'pattern', payload: '[bd ~ ~ ~] ~ [~ bd] ~, ~ [~ cp] ~ [~ ~ cp ~], [~ oh] [hh ~ ~ hh] [~ hh] [oh ~ hh ~]' },
      { id: 'pat_break', label: 'Breakbeat', icon: '🥁', desc: 'Jungle style', color: '#f59e0b', dragType: 'pattern', payload: 'bd ~ ~ bd ~ ~ [bd bd] ~, ~ ~ cp ~ ~ cp ~ ~, hh hh [hh oh] hh' },
      { id: 'pat_jazz', label: 'Jazz Brush', icon: '🥁', desc: 'Swing feel', color: '#f59e0b', dragType: 'pattern', payload: '[bd ~ bd ~] [~ bd ~ ~], ~ ~ [rim rim] ~, hh*4' },
      { id: 'pat_minimal', label: 'Minimal', icon: '🥁', desc: 'Stripped back', color: '#f59e0b', dragType: 'pattern', payload: 'bd ~ ~ ~, ~ ~ cp ~, ~ hh ~ hh' },
      { id: 'pat_halftime', label: 'Half-time', icon: '🥁', desc: 'Slow heavy', color: '#f59e0b', dragType: 'pattern', payload: 'bd ~ ~ ~, ~ ~ ~ cp, hh*4' },
    ]
  },
  {
    id: 'melody_patterns', label: 'Melody Patterns', icon: '🎵', color: '#22d3ee',
    items: [
      { id: 'pat_mel_asc', label: 'Ascending', icon: '📈', desc: 'Scale run up (needs .scale())', color: '#22d3ee', dragType: 'pattern', payload: '0 1 2 3 4 5 6 7' },
      { id: 'pat_mel_desc', label: 'Descending', icon: '📉', desc: 'Scale run down', color: '#22d3ee', dragType: 'pattern', payload: '7 6 5 4 3 2 1 0' },
      { id: 'pat_mel_arp', label: 'Arpeggio Up', icon: '🎵', desc: 'Chord arpeggio', color: '#22d3ee', dragType: 'pattern', payload: '0 2 4 7 4 2' },
      { id: 'pat_mel_arpdown', label: 'Arp Down', icon: '🎵', desc: 'Descending arp', color: '#22d3ee', dragType: 'pattern', payload: '7 4 2 0 2 4' },
      { id: 'pat_mel_wave', label: 'Wave', icon: '〰️', desc: 'Up and down', color: '#22d3ee', dragType: 'pattern', payload: '0 2 4 6 4 2 0 ~' },
      { id: 'pat_mel_sparse', label: 'Sparse', icon: '·', desc: 'Minimal melody', color: '#22d3ee', dragType: 'pattern', payload: '~ 0 ~ ~ 4 ~ 2 ~' },
      { id: 'pat_mel_jazzy', label: 'Jazzy 7ths', icon: '🎷', desc: 'Jazz intervals', color: '#22d3ee', dragType: 'pattern', payload: '0 4 7 11 9 7 4 2' },
      { id: 'pat_mel_penta', label: 'Pentatonic', icon: '🎵', desc: 'Pentatonic run', color: '#22d3ee', dragType: 'pattern', payload: '0 2 4 7 9 12 9 7' },
      { id: 'pat_mel_steps', label: 'Steps', icon: '🪜', desc: 'Gentle steps', color: '#22d3ee', dragType: 'pattern', payload: '0 ~ 1 ~ 2 ~ 3 ~' },
    ]
  },
]

// Split sidebar into Sounds panel (left) vs FX panel (right)
const FX_CATEGORY_IDS = new Set([
  'effects', 'modifiers', 'layering', 'random', 'synth', 'sample_ctrl',
  'tremolo', 'euclidean', 'envelope', 'lfo',
])
const SIDEBAR_SOUNDS = SIDEBAR_CATEGORIES.filter(c => !FX_CATEGORY_IDS.has(c.id))
const SIDEBAR_FX = SIDEBAR_CATEGORIES.filter(c => FX_CATEGORY_IDS.has(c.id))

// Map each node type to the sidebar categories relevant to it
const NODE_TYPE_SIDEBAR_MAP: Record<NodeType, Set<string>> = {
  drums:  new Set(['drums', 'drum_patterns']),
  bass:   new Set(['sounds', 'melody_patterns', 'scales']),
  melody: new Set(['sounds', 'melody_patterns', 'scales']),
  chords: new Set(['sounds', 'chords', 'scales']),
  pad:    new Set(['sounds', 'melody_patterns', 'scales']),
  vocal:  new Set(['sounds', 'melody_patterns', 'scales']),
  fx:     new Set(['drums', 'drum_patterns']),
  other:  new Set(['sounds', 'drums', 'drum_patterns', 'melody_patterns', 'chords', 'scales']),
}

// ═══════════════════════════════════════════════════════════════
//  SVG MATH
// ═══════════════════════════════════════════════════════════════

function polarToCart(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
  if (Math.abs(endDeg - startDeg) < 0.5) return ''
  const s = polarToCart(cx, cy, r, startDeg)
  const e = polarToCart(cx, cy, r, endDeg)
  const large = endDeg - startDeg > 180 ? 1 : 0
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`
}

// ═══════════════════════════════════════════════════════════════
//  PARSERS  —  read values FROM code (non-destructive)
// ═══════════════════════════════════════════════════════════════

function extractBpm(code: string): number {
  const m = code.match(/setcps\s*\(\s*([0-9.]+)\s*\/\s*60\s*\/\s*4\s*\)/)
  if (m) return Math.round(parseFloat(m[1]))
  const m2 = code.match(/setcps\s*\(\s*([0-9.]+)\s*\)/)
  if (m2) return Math.round(parseFloat(m2[1]) * 60 * 4)
  return 0 // 0 = no bpm found, don't inject
}

// Sounds that are sample-based (use s() patterns, not note() patterns)
// Vocal is melodic — uses note() with .s() so it can use scales, chords, and MIDI
const SAMPLE_BASED_TYPES = new Set<NodeType>(['drums', 'fx', 'other'])

/** Check if a node type operates on samples (rhythmic patterns) rather than pitched notes */
function isSampleBased(type: NodeType): boolean {
  return SAMPLE_BASED_TYPES.has(type)
}

function detectType(code: string): NodeType {
  const c = code.toLowerCase()
  // ── Vocal detection FIRST (before drums) to avoid false positives ──
  // Vocal keywords like "choir" contain "ch" and "oohs" contains "oh"
  // which would wrongly match drum sound abbreviations.
  // Vocal is melodic — uses note().s("instrument") with scales.
  if (c.includes('vocal') || c.includes('voice') || c.includes('choir') || c.includes('sing') || c.includes('oohs') || c.includes('aahs')) return 'vocal'
  // Drum detection: all standard Strudel drum abbreviations + drum banks
  // Word boundaries (\b) prevent false positives like "choir" matching "ch"
  // Standard: bd sd rim cp hh oh cr rd ht mt lt sh cb tb perc misc fx
  if (/\bs\s*\(\s*["'].*?\b(bd|cp|sd|hh|oh|rim|cr|rd|ht|mt|lt|sh|cb|tb|perc)\b/i.test(code)) return 'drums'
  if (/\.bank\s*\(/.test(code) && !/note\s*\(/.test(code)) return 'drums'
  // Drum machine banks
  if (/RolandTR|cr78|KorgMinipops|AkaiLinn|RolandCompuRhythm|BossDR|ViscoSpace|AkaiXR|RhythmAce/i.test(code)) return 'drums'
  // Bass detection: low octave notes with bass sounds
  if (/note\s*\(.*?[12]\b/.test(code) && /bass|sub|sine/i.test(code)) return 'bass'
  if (c.includes('bass') || c.includes('sub')) return 'bass'
  // Chord detection: stacked notes [c3,e3,g3]
  if (/note\s*\(.*?\[.*?,.*?\]/.test(code)) return 'chords'
  if (c.includes('chord') || c.includes('rhodes')) return 'chords'
  // Pad detection
  if (c.includes('pad') || c.includes('ambient') || c.includes('drone') || c.includes('haze')) return 'pad'
  // FX detection
  if (/crackle|rumble|noise|texture/i.test(code)) return 'fx'
  // If it uses s() with a custom sound name but NO note(), it's a sample (drums-like)
  if (/\bs\s*\(\s*["']/.test(code) && !/note\s*\(/.test(code) && !/\bn\s*\(/.test(code)) return 'drums'
  // Melodic detection: note patterns
  if (/note\s*\(.*?[45]\b/.test(code)) return 'melody'
  if (/note\s*\(/.test(code) || /\bn\s*\(/.test(code)) return 'melody'
  return 'other'
}

function detectSound(code: string): string {
  const m = code.match(/\.?s(?:ound)?\s*\(\s*["']([^"']+)["']/)
  if (m) return m[1].split(/[\s*[\]]/)[0]
  const bm = code.match(/\.bank\s*\(\s*["']([^"']+)["']/)
  return bm ? bm[1] : ''
}

// Numeric parameter detector — matches both static values AND dynamic expressions
function detectNum(code: string, method: string, fallback: number): number {
  // Match .method( followed by a number (may be preceded by slider(, etc.), supports negative numbers
  const re = new RegExp(`\\.${method}\\s*\\(\\s*(?:slider\\s*\\(\\s*)?(-?[0-9.]+)`)
  const m = code.match(re)
  return m ? parseFloat(m[1]) : fallback
}

// Check if code has a dynamic (non-static) expression for a method
function hasDynamic(code: string, method: string): boolean {
  const re = new RegExp(`\\.${method}\\s*\\(\\s*(?:sine|cosine|perlin|saw|square|tri|rand|irand)`)
  return re.test(code)
}

// Check if a method chain call exists in the code AT ALL (static or dynamic)
function hasMethod(code: string, method: string): boolean {
  const re = new RegExp(`\\.${method}\\s*\\(`)
  return re.test(code.replace(/\/\/ \[muted\] /g, ''))
}

function detectScale(code: string): string {
  const m = code.match(/\.scale\s*\(\s*["']([^"']+)["']/)
  return m ? m[1] : ''
}

function detectPattern(code: string): string {
  // Use negative lookbehind (?<!\.) so we only match standalone s(...) patterns, NOT .s("sound") sources
  const sm = code.match(/(?<!\.)\bs\s*\(\s*["']([^"']+)["']/)
  // Accept any s() pattern containing standard drum abbreviations OR multi-token patterns (spaces, commas, ~)
  if (sm && (/bd|sd|cp|hh|oh|rim|cy|cr|rd|cb|cl|sh|ma|lt|mt|ht|perc|tb/i.test(sm[1]) || /[\s,~]/.test(sm[1]))) return sm[1]
  const nm = code.match(/\b(?:note|n)\s*\(\s*["']([^"']+)["']/)
  return nm ? nm[1] : ''
}

function detectSoundSource(code: string): string {
  // For drum-patterned nodes, the bank IS the sound source (not the first drum abbreviation)
  // Check .bank() first — if present, that's the sound identity
  const b = code.match(/\.bank\s*\(\s*["']([^"']+)["']/)
  if (b) return b[1]
  // Match .s("instrument") in method chain — single-token instrument names
  // (no spaces/brackets/commas/* — distinguishes from drum patterns in s("bd sd hh"))
  const a = code.match(/\.s\s*\(\s*["']([^"'\s,\[\]{}*]+)["']/)
  if (a) return a[1]
  // Match standalone s("sample_name") — single-token names (custom samples, waveforms)
  // Must NOT contain spaces/brackets (which indicate drum patterns like "bd sd hh")
  const c2 = code.match(/(?<!\.)\bs\s*\(\s*["']([^"'\s,\[\]{}*]+)["']/)
  if (c2) return c2[1]
  return ''
}

function detectVowel(code: string): string {
  const m = code.match(/\.vowel\s*\(\s*["']([aeiou])["']/)
  return m ? m[1] : ''
}

// ═══════════════════════════════════════════════════════════════
//  CODE ↔ NODE CONVERSION
//
//  FUNDAMENTAL PRINCIPLE: The code is the source of truth.
//  Nodes are a VIEW of the code. We never rewrite the full code.
//  We only do targeted regex replacements for the exact field the
//  user changed, preserving LFOs, slider(), comments, formatting.
// ═══════════════════════════════════════════════════════════════

function parseCodeToNodes(code: string, existingNodes?: PatternNode[]): PatternNode[] {
  // Build map of existing nodes by block index for position preservation
  const existingByIdx = new Map<number, PatternNode>()
  if (existingNodes) existingNodes.forEach((n, i) => existingByIdx.set(i, n))

  const nodes: PatternNode[] = []
  const lines = code.split('\n')
  const blocks: { name: string; code: string; startLine: number }[] = []
  let currentBlock: string[] = []
  let currentName = ''
  let blockStartLine = 0

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim()
    // Detect muted blocks
    const isMutedStart = trimmed.startsWith('// [muted] $:')

    if (trimmed.startsWith('$:') || isMutedStart) {
      if (currentBlock.length > 0) blocks.push({ name: currentName, code: currentBlock.join('\n'), startLine: blockStartLine })
      const prev = i > 0 ? lines[i - 1].trim() : ''
      currentName = prev.startsWith('//') && !prev.startsWith('// [muted]') ? prev.replace(/^\/\/\s*/, '').replace(/[─—-]+/g, '').trim() : ''
      currentBlock = [lines[i]]
      blockStartLine = i
    } else if (currentBlock.length > 0) {
      if (trimmed.startsWith('//') && i + 1 < lines.length && (lines[i + 1].trim().startsWith('$:') || lines[i + 1].trim().startsWith('// [muted] $:'))) {
        blocks.push({ name: currentName, code: currentBlock.join('\n'), startLine: blockStartLine })
        currentBlock = []; currentName = ''
      } else if (trimmed === '') {
        let next = i + 1
        while (next < lines.length && lines[next].trim() === '') next++
        if (next >= lines.length || lines[next].trim().startsWith('//') || lines[next].trim().startsWith('$:')) {
          blocks.push({ name: currentName, code: currentBlock.join('\n'), startLine: blockStartLine })
          currentBlock = []; currentName = ''
        } else currentBlock.push(lines[i])
      } else currentBlock.push(lines[i])
    }
  }
  if (currentBlock.length > 0) blocks.push({ name: currentName, code: currentBlock.join('\n'), startLine: blockStartLine })

  const cols = 3
  blocks.forEach((block, idx) => {
    const existing = existingByIdx.get(idx)
    const isMuted = block.code.trim().startsWith('// [muted]')
    // Strip injected .analyze("nde_N") tags — these are added by rebuildFullCodeFromNodes for per-node EQ
    const stripAnalyze = (c: string) => c.replace(/\.analyze\s*\(\s*["']nde_\d+["']\s*\)/g, '')
    // For muted blocks, strip the prefix to detect properties
    const rawCode = stripAnalyze(isMuted ? block.code.replace(/\/\/ \[muted\] /g, '') : block.code)
    const type = detectType(rawCode)
    const sound = detectSound(rawCode)
    const isMelodic = !isSampleBased(type)
    const detectedScale = detectScale(rawCode)

    nodes.push({
      id: existing?.id ?? `node_${idx}`,
      name: block.name || sound || `Pattern ${idx + 1}`,
      // ALWAYS store clean code (no // [muted] prefix, no .analyze tags). The muted FLAG tracks mute state.
      // This prevents prefix accumulation bugs on rapid mute/unmute/re-parse cycles.
      code: stripAnalyze(isMuted ? block.code.replace(/\/\/ \[muted\] /g, '') : block.code),
      muted: existing?.muted ?? isMuted,
      solo: existing?.solo ?? false,
      collapsed: existing?.collapsed ?? false,
      x: existing?.x ?? (idx % cols) * 340 + 40,
      y: existing?.y ?? Math.floor(idx / cols) * 860 + 40,
      type, sound,
      gain: detectNum(rawCode, 'gain', 0.5),
      lpf: detectNum(rawCode, 'lpf', 20000),
      hpf: detectNum(rawCode, 'hpf', 0),
      pan: detectNum(rawCode, 'pan', 0.5),
      room: detectNum(rawCode, 'room', 0),
      roomsize: detectNum(rawCode, 'roomsize', 0.5),
      delay: detectNum(rawCode, 'delay', 0),
      delayfeedback: detectNum(rawCode, 'delayfeedback', 0),
      delaytime: detectNum(rawCode, 'delaytime', 0.25),
      crush: detectNum(rawCode, 'crush', 0),
      coarse: detectNum(rawCode, 'coarse', 0),
      shape: detectNum(rawCode, 'shape', 0),
      distort: detectNum(rawCode, 'distort', 0),
      speed: detectNum(rawCode, 'slow', 1),
      vowel: detectVowel(rawCode),
      velocity: detectNum(rawCode, 'velocity', 1),
      attack: detectNum(rawCode, 'attack', 0.001),
      decay: detectNum(rawCode, 'decay', 0.1),
      sustain: detectNum(rawCode, 'sustain', 0.5),
      release: detectNum(rawCode, 'release', 0.1),
      phaser: detectNum(rawCode, 'phaser', 0),
      phaserdepth: detectNum(rawCode, 'phaserdepth', 0.5),
      vibmod: detectNum(rawCode, 'vibmod', 0),
      lpq: detectNum(rawCode, 'lpq', 1),
      hpq: detectNum(rawCode, 'hpq', 1),
      fmi: detectNum(rawCode, 'fmi', 0),
      orbit: detectNum(rawCode, 'orbit', 0),
      scale: detectedScale || (isMelodic ? 'C4:major' : ''),
      pattern: detectPattern(rawCode),
      soundSource: detectSoundSource(rawCode),
    })
  })
  return nodes
}

/**
 * Re-parse ALL properties from node code after an injection.
 * This ensures knobs immediately reflect the actual values in the code
 * (e.g. after dragging `.distort(2)` onto a node, the DIST knob shows 2 not 0).
 *
 * IMPORTANT: We preserve node.type to prevent the dropdown from flipping
 * between instruments and samples on every sound/pattern change.
 * Type is only set during initial parse (parseCodeToNodes) or explicit user action.
 */
function reparseNodeFromCode(node: PatternNode): PatternNode {
  const rawCode = node.code.replace(/\/\/ \[muted\] /g, '')
  return {
    ...node,
    // Preserve node.type — don't re-detect. Type changes destabilize the
    // sound preset dropdown (instruments ↔ samples) on every edit.
    sound: detectSound(rawCode),
    gain: detectNum(rawCode, 'gain', 0.5),
    lpf: detectNum(rawCode, 'lpf', 20000),
    hpf: detectNum(rawCode, 'hpf', 0),
    pan: detectNum(rawCode, 'pan', 0.5),
    room: detectNum(rawCode, 'room', 0),
    roomsize: detectNum(rawCode, 'roomsize', 0.5),
    delay: detectNum(rawCode, 'delay', 0),
    delayfeedback: detectNum(rawCode, 'delayfeedback', 0),
    delaytime: detectNum(rawCode, 'delaytime', 0.25),
    crush: detectNum(rawCode, 'crush', 0),
    coarse: detectNum(rawCode, 'coarse', 0),
    shape: detectNum(rawCode, 'shape', 0),
    distort: detectNum(rawCode, 'distort', 0),
    speed: detectNum(rawCode, 'slow', 1),
    vowel: detectVowel(rawCode),
    velocity: detectNum(rawCode, 'velocity', 1),
    attack: detectNum(rawCode, 'attack', 0.001),
    decay: detectNum(rawCode, 'decay', 0.1),
    sustain: detectNum(rawCode, 'sustain', 0.5),
    release: detectNum(rawCode, 'release', 0.1),
    phaser: detectNum(rawCode, 'phaser', 0),
    phaserdepth: detectNum(rawCode, 'phaserdepth', 0.5),
    vibmod: detectNum(rawCode, 'vibmod', 0),
    lpq: detectNum(rawCode, 'lpq', 1),
    hpq: detectNum(rawCode, 'hpq', 1),
    fmi: detectNum(rawCode, 'fmi', 0),
    orbit: detectNum(rawCode, 'orbit', 0),
    scale: detectScale(rawCode) || node.scale,
    pattern: detectPattern(rawCode) || node.pattern,
    soundSource: detectSoundSource(rawCode) || node.soundSource,
  }
}

/**
 * Apply a single targeted change to a code block.
 * Returns the modified code. Preserves everything else.
 */
function applyEffect(code: string, method: string, value: number | string, remove?: boolean): string {
  if (typeof value === 'string') {
    // String effects like .scale(), .vowel(), .bank(), .s()
    if (method === 'scale') {
      const re = /\.scale\s*\(\s*["'][^"']*["']\s*\)/
      if (re.test(code)) return code.replace(re, `.scale("${value}")`)
      // Inject after note() if present
      const noteRe = /((?:note|n)\s*\(\s*["'][^"']*["']\s*\))/
      if (noteRe.test(code)) return code.replace(noteRe, `$1.scale("${value}")`)
      return code
    }
    if (method === 'vowel') {
      const re = /\.vowel\s*\(\s*["'][^"']*["']\s*\)/
      if (!value || value === '') {
        return code.replace(re, '') // Remove vowel
      }
      if (re.test(code)) return code.replace(re, `.vowel("${value}")`)
      return injectBefore(code, `.vowel("${value}")`)
    }
    if (method === 'bank') {
      const re = /\.bank\s*\(\s*["'][^"']*["']\s*\)/
      if (re.test(code)) return code.replace(re, `.bank("${value}")`)
      // No .bank() found — inject .bank() after standalone s("...") for sample-based nodes
      const sRe = /((?<!\.)\bs\s*\(\s*["'][^"']*["']\s*\))/
      if (sRe.test(code)) return code.replace(sRe, `$1.bank("${value}")`)
      return code
    }
    if (method === 'soundDotS') {
      // Match .s("instrument") in a method chain — instrument names are single tokens
      // (no spaces, brackets, commas, or *) distinguishing from drum patterns in s("bd sd hh")
      const re1 = /\.s\s*\(\s*["']([^"'\s,\[\]{}*]+)["']\s*\)/
      if (re1.test(code)) return code.replace(re1, `.s("${value}")`)
      // Fallback: standalone s("instrument") at start of expression — not preceded by dot
      const re2 = /(?<!\.)\bs\s*\(\s*["'](sine|sawtooth|square|triangle|supersaw|gm_[^"']+)["']\s*\)/
      if (re2.test(code)) return code.replace(re2, `s("${value}")`)
      // Fallback: inject .s() after note()/n() if no .s() exists yet
      const noteInject = /((?:note|n)\s*\(\s*["'][^"']*["']\s*\))/
      if (noteInject.test(code)) return code.replace(noteInject, `$1\n  .s("${value}")`)
      return code
    }
    if (method === 'drumPattern') {
      // Negative lookbehind: only match standalone s(...) NOT .s("sound_source")
      const re = /(?<!\.)\bs\s*\(\s*["'][^"']*["']\s*\)/
      if (re.test(code)) return code.replace(re, `s("${value}")`)
      return code
    }
    if (method === 'notePattern') {
      const re = /\b(note|n)\s*\(\s*["'][^"']*["']\s*\)/
      if (re.test(code)) return code.replace(re, `$1("${value}")`)
      return code
    }
    return code
  }

  // Numeric effects
  const numStr = Number.isInteger(value) ? value.toString() : (value as number).toFixed(method === 'gain' || method === 'pan' ? 3 : 2)

  // Handle slider(value, min, max) wrapper — preserve slider() and update only the current value
  const sliderRe = new RegExp(`\\.${method}\\s*\\(\\s*slider\\s*\\(\\s*[0-9.]+\\s*,\\s*([0-9.]+)\\s*,\\s*([0-9.]+)\\s*\\)\\s*\\)`)
  const sliderMatch = code.match(sliderRe)
  if (sliderMatch && !hasDynamic(code, method)) {
    // Preserve slider() wrapper, update only the live value
    return code.replace(sliderRe, `.${method}(slider(${numStr}, ${sliderMatch[1]}, ${sliderMatch[2]}))`)
  }

  const methodRe = new RegExp(`\\.${method}\\s*\\(\\s*[0-9.]+`)
  const fullRe = new RegExp(`\\.${method}\\s*\\(\\s*[0-9.]+\\s*\\)`)

  // If value at "zero" state and user is removing, strip the effect
  if (remove) {
    // Don't remove if this method has a dynamic LFO expression
    if (hasDynamic(code, method)) return code
    // Remove entire .method(value) — handle slider() wrapper and simple value
    const stripSliderRe = new RegExp(`\\s*\\.${method}\\s*\\(\\s*slider\\s*\\([^)]*\\)\\s*\\)`)
    if (stripSliderRe.test(code)) return code.replace(stripSliderRe, '')
    // Only strip simple static values, not complex expressions
    const stripRe = new RegExp(`\\s*\\.${method}\\s*\\(\\s*[0-9.]+\\s*\\)`)
    return code.replace(stripRe, '')
  }

  // If code already has a STATIC value for this method, replace it
  if (methodRe.test(code) && !hasDynamic(code, method)) {
    return code.replace(methodRe, `.${method}(${numStr}`)
  }

  // If code has a dynamic expression, DON'T touch it (preserve LFO etc.)
  if (hasDynamic(code, method)) return code

  // Inject new effect
  return injectBefore(code, `.${method}(${numStr})`)
}

/** Insert an effect chain segment before .scope/.fscope or at end */
function injectBefore(code: string, effect: string): string {
  const vizRe = /\.(scope|fscope|pianoroll|pitchwheel|punchcard)\s*\(/
  const m = code.match(vizRe)
  if (m?.index !== undefined) {
    return code.slice(0, m.index) + effect + code.slice(m.index)
  }
  // Add before last line that has content
  const lines = code.split('\n')
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].trim()) { lines[i] += effect; break }
  }
  return lines.join('\n')
}

/**
 * Rebuild full code from nodes + bpm + original preamble.
 * Only called for structural changes (mute/unmute/add/delete/reorder/bpm).
 */
function rebuildFullCode(nodes: PatternNode[], bpm: number, originalCode: string): string {
  const lines = originalCode.split('\n')
  const preamble: string[] = []
  let foundBlock = false
  for (const line of lines) {
    const t = line.trim()
    if (t.startsWith('$:') || t.startsWith('// [muted] $:')) { foundBlock = true; break }
    if (!t.startsWith('setcps') && !t.startsWith('setbpm')) preamble.push(line)
    else if (!foundBlock) continue // skip old setcps
  }

  const parts: string[] = []
  const preambleStr = preamble.join('\n').trimEnd()
  if (preambleStr) parts.push(preambleStr)
  if (bpm > 0) parts.push(`setcps(${bpm}/60/4) // ${bpm} bpm`)
  parts.push('')

  for (const node of nodes) {
    const commentLine = node.name ? `// ── ${node.name} ──` : ''
    if (node.muted) {
      const mutedCode = node.code.split('\n')
        .map(l => l.trim().startsWith('// [muted]') ? l : `// [muted] ${l}`)
        .join('\n')
      parts.push(commentLine ? `${commentLine}\n${mutedCode}` : mutedCode)
    } else {
      // Unmute if previously muted
      const cleanCode = node.code.replace(/\/\/ \[muted\] /g, '')
      parts.push(commentLine ? `${commentLine}\n${cleanCode}` : cleanCode)
    }
    parts.push('')
  }
  return parts.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n'
}

// ═══════════════════════════════════════════════════════════════
//  ROTARY KNOB
// ═══════════════════════════════════════════════════════════════

function RotaryKnob({ value, min, max, step, onChange, onCommit, color, label, suffix, size = 40, defaultValue, disabled }: {
  value: number; min: number; max: number; step: number
  onChange: (v: number) => void; onCommit: () => void
  color: string; label: string; suffix?: string; size?: number; defaultValue?: number; disabled?: boolean
}) {
  const r = size / 2 - 5
  const cx = size / 2, cy = size / 2
  const norm = Math.max(0, Math.min(1, (value - min) / (max - min)))
  const angle = -135 + norm * 270
  const ptr = polarToCart(cx, cy, r * 0.55, angle)
  const isDynamic = disabled
  const knobRef = useRef<SVGSVGElement>(null)
  const wheelCommitTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Local mutable value — tracks the REAL latest value between renders.
  // This fixes wheel accumulation: React may not re-render between rapid wheel events,
  // so stateRef.current.value (set from props) would be stale. localValueRef is always fresh.
  const localValueRef = useRef(value)
  localValueRef.current = value // sync with props on each render

  const clamp = (v: number) => Math.max(min, Math.min(max, Math.round(v / step) * step))

  // Stable ref for latest props — avoids stale closures in imperative listeners
  const stateRef = useRef({ value, min, max, step, isDynamic, onChange, onCommit })
  stateRef.current = { value, min, max, step, isDynamic, onChange, onCommit }

  // Register wheel listener imperatively with { passive: false } to allow preventDefault
  // Wheel commit is DEBOUNCED — we only commit once scrolling stops (150ms).
  useEffect(() => {
    const el = knobRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      const s = stateRef.current
      if (s.isDynamic) return
      e.preventDefault()
      e.stopPropagation()
      const clampV = (v: number) => Math.max(s.min, Math.min(s.max, Math.round(v / s.step) * s.step))
      // Use localValueRef (not s.value) so rapid wheel ticks accumulate correctly
      const next = clampV(localValueRef.current + (-e.deltaY / 800) * (s.max - s.min))
      localValueRef.current = next // update local tracking immediately
      s.onChange(next)
      // Debounce commit: only fire after user stops scrolling
      if (wheelCommitTimer.current) clearTimeout(wheelCommitTimer.current)
      wheelCommitTimer.current = setTimeout(() => stateRef.current.onCommit(), 150)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      el.removeEventListener('wheel', onWheel)
      if (wheelCommitTimer.current) clearTimeout(wheelCommitTimer.current)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleDown = (e: React.MouseEvent) => {
    if (isDynamic) return
    e.stopPropagation(); e.preventDefault()
    const startY = e.clientY, startVal = value, range = max - min
    const onMove = (ev: MouseEvent) => {
      const sens = ev.shiftKey ? 600 : 150
      const next = clamp(startVal + ((startY - ev.clientY) / sens) * range)
      localValueRef.current = next // keep local tracking in sync during drag
      stateRef.current.onChange(next)
    }
    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      stateRef.current.onCommit()
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  // Touch support for knobs on iPad
  const handleTouchDown = (e: React.TouchEvent) => {
    if (isDynamic) return
    e.stopPropagation(); e.preventDefault()
    const touch = e.touches[0]
    const startY = touch.clientY, startVal = value, range = max - min
    const onTouchMove = (ev: TouchEvent) => {
      ev.preventDefault()
      const t = ev.touches[0]
      const sens = 150
      const next = clamp(startVal + ((startY - t.clientY) / sens) * range)
      localValueRef.current = next
      stateRef.current.onChange(next)
    }
    const onTouchEnd = () => {
      document.removeEventListener('touchmove', onTouchMove)
      document.removeEventListener('touchend', onTouchEnd)
      document.removeEventListener('touchcancel', onTouchEnd)
      stateRef.current.onCommit()
    }
    document.addEventListener('touchmove', onTouchMove, { passive: false })
    document.addEventListener('touchend', onTouchEnd)
    document.addEventListener('touchcancel', onTouchEnd)
  }

  const handleDblClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!isDynamic && defaultValue !== undefined) { onChange(defaultValue); onCommit() }
  }

  const fmtVal = isDynamic ? '~LFO' : value >= 10000 ? `${(value / 1000).toFixed(0)}k`
    : value >= 1000 ? `${(value / 1000).toFixed(1)}k`
    : step >= 1 ? Math.round(value).toString()
    : value.toFixed(step >= 0.1 ? 1 : 2)

  return (
    <div className="flex flex-col items-center gap-0" style={{ width: size + 8 }}>
      <span className="text-[7px] font-bold uppercase tracking-[0.1em] mb-0.5" style={{ color: HW.textDim }}>{label}</span>
      <svg ref={knobRef} width={size} height={size} className={isDynamic ? 'cursor-not-allowed opacity-50' : 'cursor-ns-resize'}
        style={{ touchAction: 'none' }}
        onMouseDown={handleDown} onTouchStart={handleTouchDown} onDoubleClick={handleDblClick}>
        <circle cx={cx} cy={cy} r={r + 2} fill="none" stroke={HW.knobRing} strokeWidth={1} opacity={0.4} />
        <circle cx={cx} cy={cy} r={r} fill={HW.knobBg} stroke={HW.knobRing} strokeWidth={1.5} />
        <path d={arcPath(cx, cy, r - 1, -135, 135)} fill="none" stroke={HW.knobRing} strokeWidth={2.5} strokeLinecap="round" opacity={0.5} />
        {norm > 0.005 && (
          <>
            <path d={arcPath(cx, cy, r - 1, -135, angle)} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" opacity={0.85} />
            <path d={arcPath(cx, cy, r - 1, -135, angle)} fill="none" stroke={color} strokeWidth={4} strokeLinecap="round" opacity={0.15} />
          </>
        )}
        <circle cx={cx} cy={cy} r={2} fill={HW.raisedLight} />
        <line x1={cx} y1={cy} x2={ptr.x} y2={ptr.y} stroke="#ddd" strokeWidth={1.5} strokeLinecap="round" />
      </svg>
      <span className="text-[8px] font-mono tabular-nums mt-0.5" style={{ color: isDynamic ? '#f59e0b88' : `${color}bb` }}>
        {fmtVal}{suffix || ''}
      </span>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
//  QUICK LFO PANEL — Assign continuous signals to any parameter
// ═══════════════════════════════════════════════════════════════
const LFO_TARGETS = [
  { param: 'lpf', label: 'LPF', min: 200, max: 4000 },
  { param: 'hpf', label: 'HPF', min: 50, max: 2000 },
  { param: 'gain', label: 'VOL', min: 0.3, max: 1 },
  { param: 'pan', label: 'PAN', min: 0, max: 1 },
  { param: 'room', label: 'VERB', min: 0, max: 0.8 },
  { param: 'phaser', label: 'PHSR', min: 0, max: 12 },
  { param: 'shape', label: 'SHPE', min: 0, max: 0.7 },
  { param: 'speed', label: 'SPD', min: 0.5, max: 2 },
  { param: 'crush', label: 'CRSH', min: 4, max: 16 },
]

function QuickLFOPanel({ nodeId, color, onAssign }: {
  nodeId: string; color: string
  onAssign: (nodeId: string, method: string, lfoTemplate: string, min: number, max: number) => void
}) {
  const [open, setOpen] = useState(false)
  const [selTarget, setSelTarget] = useState<typeof LFO_TARGETS[0] | null>(null)

  if (!open) {
    return (
      <div className="px-2 pb-2">
        <button onClick={e => { e.stopPropagation(); setOpen(true) }}
          className="w-full py-1.5 rounded text-[8px] font-bold tracking-[0.15em] uppercase cursor-pointer transition-all"
          style={{
            background: `linear-gradient(135deg, ${color}08, ${color}12)`,
            border: `1px dashed ${color}30`, color: `${color}99`,
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = `${color}60`; e.currentTarget.style.color = color }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = `${color}30`; e.currentTarget.style.color = `${color}99` }}
        >
          ~ LFO Modulate ~
        </button>
      </div>
    )
  }

  return (
    <div className="px-2 pb-2">
      <div className="rounded p-2" style={{ background: HW.raised, border: `1px solid ${color}30` }}>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[8px] font-bold tracking-[0.2em] uppercase" style={{ color }}>LFO ASSIGN</span>
          <button onClick={e => { e.stopPropagation(); setOpen(false); setSelTarget(null) }}
            className="text-[10px] cursor-pointer px-1" style={{ color: HW.textDim }}>✕</button>
        </div>
        {!selTarget ? (
          <>
            <span className="text-[7px] mb-1 block" style={{ color: HW.textDim }}>Pick a parameter:</span>
            <div className="flex flex-wrap gap-[3px]">
              {LFO_TARGETS.map(t => (
                <button key={t.param}
                  onClick={e => { e.stopPropagation(); setSelTarget(t) }}
                  className="px-1.5 py-[2px] rounded text-[7px] font-bold uppercase cursor-pointer"
                  style={{ background: HW.raisedLight, color: HW.text, border: `1px solid ${HW.border}` }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = color; e.currentTarget.style.color = color }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = HW.border; e.currentTarget.style.color = HW.text }}
                >{t.label}</button>
              ))}
            </div>
          </>
        ) : (
          <>
            <span className="text-[7px] mb-1 block" style={{ color: HW.textDim }}>
              Modulate <b style={{ color }}>{selTarget.label}</b> with:
            </span>
            <div className="flex flex-wrap gap-[3px]">
              {LFO_PRESETS.map(lfo => (
                <button key={lfo.label}
                  onClick={e => {
                    e.stopPropagation()
                    onAssign(nodeId, selTarget.param, lfo.value, selTarget.min, selTarget.max)
                    setSelTarget(null); setOpen(false)
                  }}
                  className="px-1.5 py-[2px] rounded text-[7px] font-bold cursor-pointer transition-colors"
                  style={{ background: `${color}15`, color: `${color}cc`, border: `1px solid ${color}25` }}
                  onMouseEnter={e => { e.currentTarget.style.background = `${color}25`; e.currentTarget.style.color = color }}
                  onMouseLeave={e => { e.currentTarget.style.background = `${color}15`; e.currentTarget.style.color = `${color}cc` }}
                ><span className="mr-0.5">{lfo.icon}</span>{lfo.label}</button>
              ))}
            </div>
            <button onClick={e => { e.stopPropagation(); setSelTarget(null) }}
              className="text-[7px] mt-1 cursor-pointer underline" style={{ color: HW.textDim }}>← back</button>
          </>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
//  PORTAL DROPDOWN — renders into document.body so never clipped
// ═══════════════════════════════════════════════════════════════

function HardwareSelect({ label, value, options, onChange, color }: {
  label: string; value: string; options: { label: string; value: string }[]
  onChange: (v: string) => void; color: string
}) {
  const [open, setOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 })

  useEffect(() => {
    if (!open) return
    const close = (e: Event) => {
      const target = (e instanceof TouchEvent ? e.touches[0]?.target ?? e.target : e.target) as Node
      if (menuRef.current?.contains(target)) return
      if (btnRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('touchstart', close, { passive: true })
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('touchstart', close)
    }
  }, [open])

  const handleOpen = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 2, left: r.left, width: Math.max(r.width, 200) })
    }
    setOpen(p => !p)
  }

  const current = options.find(o => o.value === value)

  const menu = open ? ReactDOM.createPortal(
    <div ref={menuRef}
      className="fixed max-h-[260px] overflow-y-auto rounded-lg shadow-2xl"
      style={{
        top: pos.top, left: pos.left, width: pos.width, zIndex: 99999,
        background: '#0e0e11', border: `1px solid ${color}20`,
        scrollbarWidth: 'thin', scrollbarColor: `${color}30 transparent`,
      }}>
      {options.map(opt => (
        <button key={opt.value}
          onClick={e => { e.stopPropagation(); onChange(opt.value); setOpen(false) }}
          onTouchEnd={e => { e.stopPropagation(); e.preventDefault(); onChange(opt.value); setOpen(false) }}
          className="w-full text-left px-3 py-[6px] text-[10px] transition-colors cursor-pointer flex items-center gap-2"
          style={{
            color: opt.value === value ? color : HW.text,
            background: opt.value === value ? `${color}12` : 'transparent',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = `${color}0a` }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = opt.value === value ? `${color}12` : 'transparent' }}
        >
          {opt.value === value && <span style={{ color }} className="text-[8px]">●</span>}
          <span>{opt.label}</span>
        </button>
      ))}
    </div>,
    document.body
  ) : null

  return (
    <div className="relative">
      <button ref={btnRef} onClick={handleOpen}
        className="flex items-center w-full rounded transition-all cursor-pointer"
        style={{ background: HW.surfaceAlt, border: `1px solid ${open ? `${color}30` : HW.border}`, padding: '4px 8px' }}>
        <span className="text-[7px] font-bold uppercase tracking-[0.1em] shrink-0 w-7" style={{ color: HW.textDim }}>{label}</span>
        <span className="flex-1 text-left text-[10px] font-medium truncate" style={{ color: `${color}cc` }}>
          {current?.label || value || '—'}
        </span>
        <ChevronDown size={10} style={{ color: HW.textDim, transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }} />
      </button>
      {menu}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
//  MINI SCOPE
// ═══════════════════════════════════════════════════════════════

/**
 * Equalizer visualizer — real-time frequency bar display.
 * Uses Web Audio AnalyserNode when available, falls back to animated waveform.
 * Click to cycle: equalizer → waveform → type animation.
 */
function MiniScope({ color, active, type, analyserNode, hpf, lpf }: { color: string; active: boolean; type: NodeType; analyserNode?: AnalyserNode | null; hpf?: number; lpf?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef(0)
  const phaseRef = useRef(Math.random() * Math.PI * 2)
  // 0 = frequency bars (EQ), 1 = waveform, 2 = type-specific (fallback)
  const [displayMode, setDisplayMode] = useState(0)
  const bufRef = useRef<Uint8Array<ArrayBuffer> | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const W = canvas.width, H = canvas.height

    // Allocate typed arrays once
    if (analyserNode && !bufRef.current) {
      bufRef.current = new Uint8Array(analyserNode.fftSize || 256) as Uint8Array<ArrayBuffer>
    }

    const draw = () => {
      ctx.clearRect(0, 0, W, H)

      // ── Inactive: dim flat line ──
      if (!active) {
        ctx.beginPath(); ctx.strokeStyle = `${color}15`; ctx.lineWidth = 1
        ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2)
        ctx.stroke()
        return
      }

      // ── Real analyser data available ──
      if (analyserNode && bufRef.current && displayMode < 2) {
        if (displayMode === 0) {
          // FREQUENCY BARS / EQUALIZER MODE (default)
          const freqBuf = bufRef.current
          analyserNode.getByteFrequencyData(freqBuf)
          const barCount = Math.min(32, freqBuf.length)
          const barW = W / barCount

          for (let i = 0; i < barCount; i++) {
            const val = freqBuf[i] / 255
            const barH = val * H * 0.9
            const alpha = 0.3 + val * 0.6
            ctx.fillStyle = `${color}${Math.round(alpha * 255).toString(16).padStart(2, '0')}`
            ctx.fillRect(i * barW + 1, H - barH, barW - 2, barH)
          }

          // ── Filter overlay: HPF/LPF curves on frequency bars ──
          if ((hpf && hpf > 20) || (lpf && lpf < 19000)) {
            const maxFreq = 20000
            ctx.save()
            // HPF: blocks low frequencies (left side slope rising)
            if (hpf && hpf > 20) {
              const hpfX = Math.min(W, (Math.log(hpf / 20) / Math.log(maxFreq / 20)) * W)
              const grad = ctx.createLinearGradient(0, 0, hpfX, 0)
              grad.addColorStop(0, `${color}30`)
              grad.addColorStop(1, `${color}00`)
              ctx.fillStyle = grad
              ctx.fillRect(0, 0, hpfX, H)
              // Cutoff line
              ctx.strokeStyle = `${color}60`
              ctx.lineWidth = 1.5
              ctx.setLineDash([2, 2])
              ctx.beginPath(); ctx.moveTo(hpfX, 0); ctx.lineTo(hpfX, H); ctx.stroke()
              ctx.setLineDash([])
            }
            // LPF: blocks high frequencies (right side slope falling)
            if (lpf && lpf < 19000) {
              const lpfX = Math.max(0, (Math.log(lpf / 20) / Math.log(maxFreq / 20)) * W)
              const grad = ctx.createLinearGradient(lpfX, 0, W, 0)
              grad.addColorStop(0, `${color}00`)
              grad.addColorStop(1, `${color}30`)
              ctx.fillStyle = grad
              ctx.fillRect(lpfX, 0, W - lpfX, H)
              // Cutoff line
              ctx.strokeStyle = `${color}60`
              ctx.lineWidth = 1.5
              ctx.setLineDash([2, 2])
              ctx.beginPath(); ctx.moveTo(lpfX, 0); ctx.lineTo(lpfX, H); ctx.stroke()
              ctx.setLineDash([])
            }
            ctx.restore()
          }
        } else {
          // WAVEFORM MODE — time-domain data
          analyserNode.getByteTimeDomainData(bufRef.current)
          const buf = bufRef.current
          const sliceW = W / buf.length

          // Glow
          ctx.shadowColor = color; ctx.shadowBlur = 6
          ctx.beginPath(); ctx.strokeStyle = `${color}90`; ctx.lineWidth = 1.5
          for (let i = 0; i < buf.length; i++) {
            const v = buf[i] / 128.0
            const y = (v * H) / 2
            i === 0 ? ctx.moveTo(0, y) : ctx.lineTo(i * sliceW, y)
          }
          ctx.stroke(); ctx.shadowBlur = 0

          // Fill under the waveform
          ctx.lineTo(W, H / 2); ctx.lineTo(0, H / 2); ctx.closePath()
          ctx.fillStyle = `${color}08`; ctx.fill()
        }
      } else {
        // ── Fallback: type-specific animated waveform ──
        phaseRef.current += 0.05
        ctx.beginPath(); ctx.strokeStyle = `${color}60`; ctx.lineWidth = 1.5
        ctx.shadowColor = color; ctx.shadowBlur = 8
        for (let x = 0; x < W; x++) {
          const t = x / W
          let y = H / 2
          switch (type) {
            case 'drums': y = H / 2 + (Math.random() - 0.5) * H * 0.5 * Math.pow(Math.sin(t * Math.PI * 8 + phaseRef.current), 8); break
            case 'bass': y = H / 2 + Math.sin(t * Math.PI * 2 + phaseRef.current * 0.5) * H * 0.35; break
            case 'melody': y = H / 2 + Math.sin(t * Math.PI * 6 + phaseRef.current) * H * 0.25; break
            case 'chords': y = H / 2 + (Math.sin(t * Math.PI * 3 + phaseRef.current) + Math.sin(t * Math.PI * 5 + phaseRef.current * 1.3) * 0.5) * H * 0.18; break
            case 'pad': y = H / 2 + Math.sin(t * Math.PI * 1.5 + phaseRef.current * 0.3) * H * 0.3; break
            case 'vocal': y = H / 2 + Math.sin(t * Math.PI * 5 + phaseRef.current) * H * 0.22 * (0.5 + 0.5 * Math.sin(t * Math.PI * 2 + phaseRef.current * 0.5)); break
            case 'fx': y = H / 2 + (Math.random() - 0.5) * H * 0.25 + Math.sin(t * Math.PI * 10 + phaseRef.current * 2) * H * 0.1; break
            default: y = H / 2 + Math.sin(t * Math.PI * 4 + phaseRef.current) * H * 0.2
          }
          x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
        }
        ctx.stroke(); ctx.shadowBlur = 0
      }

      rafRef.current = requestAnimationFrame(draw)
    }
    rafRef.current = requestAnimationFrame(draw)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [color, active, type, analyserNode, displayMode, hpf, lpf])

  return (
    <canvas
      ref={canvasRef}
      width={260}
      height={24}
      className="w-full rounded cursor-pointer"
      style={{ height: 24 }}
      onClick={(e) => { e.stopPropagation(); setDisplayMode(m => (m + 1) % 3) }}
      title="Click to cycle: equalizer → waveform → animated"
    />
  )
}

// ═══════════════════════════════════════════════════════════════
//  MASTER VISUALIZER — pinned on the grid, shows master output
// ═══════════════════════════════════════════════════════════════

const MASTER_VIZ_PRESETS = [
  { id: 'eq_bars', label: 'EQ Bars' },
  { id: 'waveform', label: 'Waveform' },
  { id: 'mirror_bars', label: 'Mirror Bars' },
  { id: 'spectrum_line', label: 'Spectrum Line' },
  { id: 'circle_eq', label: 'Circle EQ' },
] as const

function MasterVisualizer({ analyserNode, isPlaying }: { analyserNode?: AnalyserNode | null; isPlaying: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef(0)
  const [preset, setPreset] = useState(0)
  const bufRef = useRef<Uint8Array<ArrayBuffer> | null>(null)
  const timeBufRef = useRef<Uint8Array<ArrayBuffer> | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const W = canvas.width, H = canvas.height

    if (analyserNode) {
      if (!bufRef.current) bufRef.current = new Uint8Array(analyserNode.frequencyBinCount) as Uint8Array<ArrayBuffer>
      if (!timeBufRef.current) timeBufRef.current = new Uint8Array(analyserNode.fftSize) as Uint8Array<ArrayBuffer>
    }

    const accentColor = '#22d3ee'

    const draw = () => {
      ctx.clearRect(0, 0, W, H)

      if (!isPlaying || !analyserNode || !bufRef.current || !timeBufRef.current) {
        // Idle state
        ctx.fillStyle = '#ffffff06'
        ctx.fillRect(0, 0, W, H)
        ctx.fillStyle = '#ffffff15'
        ctx.font = '10px monospace'
        ctx.textAlign = 'center'
        ctx.fillText('MASTER', W / 2, H / 2 + 4)
        rafRef.current = requestAnimationFrame(draw)
        return
      }

      analyserNode.getByteFrequencyData(bufRef.current)
      analyserNode.getByteTimeDomainData(timeBufRef.current)
      const freq = bufRef.current
      const time = timeBufRef.current

      const presetId = MASTER_VIZ_PRESETS[preset].id

      if (presetId === 'eq_bars') {
        const barCount = Math.min(48, freq.length)
        const barW = W / barCount
        for (let i = 0; i < barCount; i++) {
          const val = freq[i] / 255
          const barH = val * H * 0.85
          const hue = 180 + (i / barCount) * 40
          const alpha = 0.3 + val * 0.7
          ctx.fillStyle = `hsla(${hue}, 80%, 60%, ${alpha})`
          ctx.fillRect(i * barW + 1, H - barH, barW - 2, barH)
        }
      } else if (presetId === 'waveform') {
        const sliceW = W / time.length
        ctx.shadowColor = accentColor; ctx.shadowBlur = 8
        ctx.beginPath(); ctx.strokeStyle = `${accentColor}90`; ctx.lineWidth = 2
        for (let i = 0; i < time.length; i++) {
          const v = time[i] / 128.0
          const y = (v * H) / 2
          i === 0 ? ctx.moveTo(0, y) : ctx.lineTo(i * sliceW, y)
        }
        ctx.stroke(); ctx.shadowBlur = 0
        ctx.lineTo(W, H / 2); ctx.lineTo(0, H / 2); ctx.closePath()
        ctx.fillStyle = `${accentColor}06`; ctx.fill()
      } else if (presetId === 'mirror_bars') {
        const barCount = Math.min(48, freq.length)
        const barW = W / barCount
        for (let i = 0; i < barCount; i++) {
          const val = freq[i] / 255
          const barH = val * H * 0.42
          const hue = 180 + (i / barCount) * 50
          const alpha = 0.3 + val * 0.6
          ctx.fillStyle = `hsla(${hue}, 75%, 60%, ${alpha})`
          ctx.fillRect(i * barW + 1, H / 2 - barH, barW - 2, barH)
          ctx.fillStyle = `hsla(${hue}, 75%, 60%, ${alpha * 0.5})`
          ctx.fillRect(i * barW + 1, H / 2, barW - 2, barH)
        }
      } else if (presetId === 'spectrum_line') {
        const barCount = Math.min(64, freq.length)
        const stepW = W / barCount
        ctx.shadowColor = accentColor; ctx.shadowBlur = 6
        ctx.beginPath(); ctx.strokeStyle = accentColor; ctx.lineWidth = 1.5
        for (let i = 0; i < barCount; i++) {
          const y = H - (freq[i] / 255) * H * 0.85
          i === 0 ? ctx.moveTo(0, y) : ctx.lineTo(i * stepW, y)
        }
        ctx.stroke(); ctx.shadowBlur = 0
        ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath()
        ctx.fillStyle = `${accentColor}08`; ctx.fill()
      } else if (presetId === 'circle_eq') {
        const cx = W / 2, cy = H / 2, baseR = Math.min(W, H) * 0.25
        const barCount = 32
        for (let i = 0; i < barCount; i++) {
          const angle = (i / barCount) * Math.PI * 2 - Math.PI / 2
          const val = freq[Math.floor(i * freq.length / barCount)] / 255
          const len = val * baseR * 1.2
          const x1 = cx + Math.cos(angle) * baseR
          const y1 = cy + Math.sin(angle) * baseR
          const x2 = cx + Math.cos(angle) * (baseR + len)
          const y2 = cy + Math.sin(angle) * (baseR + len)
          const hue = 180 + (i / barCount) * 60
          ctx.beginPath(); ctx.strokeStyle = `hsla(${hue}, 80%, 60%, ${0.4 + val * 0.6})`
          ctx.lineWidth = 2; ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke()
        }
        ctx.beginPath(); ctx.arc(cx, cy, baseR, 0, Math.PI * 2)
        ctx.strokeStyle = `${accentColor}30`; ctx.lineWidth = 1; ctx.stroke()
      }

      rafRef.current = requestAnimationFrame(draw)
    }
    rafRef.current = requestAnimationFrame(draw)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [analyserNode, isPlaying, preset])

  return (
    <div className="rounded-xl overflow-hidden" style={{
      background: '#0a0a0c',
      border: '1px solid rgba(34,211,238,0.12)',
      boxShadow: '0 4px 24px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.03)',
      width: 240,
    }}>
      {/* Header */}
      <div className="flex items-center justify-between px-2.5 py-1.5"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(34,211,238,0.03)' }}>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full" style={{
            background: isPlaying ? '#22d3ee' : '#333',
            boxShadow: isPlaying ? '0 0 6px #22d3ee50' : 'none',
          }} />
          <span className="text-[8px] font-bold tracking-[0.15em] uppercase" style={{ color: '#22d3ee' }}>MASTER</span>
        </div>
        <div className="flex items-center gap-1">
          <button className="px-1.5 py-0.5 rounded text-[7px] font-bold cursor-pointer"
            style={{ background: 'rgba(34,211,238,0.06)', color: '#22d3ee80', border: '1px solid rgba(34,211,238,0.1)' }}
            onClick={() => setPreset(p => (p + 1) % MASTER_VIZ_PRESETS.length)}>
            {MASTER_VIZ_PRESETS[preset].label}
          </button>
        </div>
      </div>
      {/* Canvas */}
      <canvas ref={canvasRef} width={240} height={80}
        className="w-full cursor-pointer" style={{ height: 80 }}
        onClick={() => setPreset(p => (p + 1) % MASTER_VIZ_PRESETS.length)}
      />
    </div>
  )
}

// Port component removed — nodes are independent $: blocks, not connected

// ═══════════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

interface NodeEditorProps {
  code: string
  isPlaying: boolean
  onCodeChange: (newCode: string) => void
  onUpdate: () => void
  onRegisterSound?: (name: string, urls: string[]) => Promise<void>
  analyserNode?: AnalyserNode | null
  /** Retrieve a per-node AnalyserNode by ID (from superdough's analysers map) */
  getAnalyserById?: (id: string, fftSize?: number, smoothing?: number) => AnalyserNode | null
  /** When true, NDE renders without its own header — controls are in the parent */
  headerless?: boolean
  /** Get current cycle position from Strudel scheduler — used to sync playhead, timeline, piano roll */
  getCyclePosition?: () => number
}

/** Imperative handle exposed to parent for headerless control */
export interface NodeEditorHandle {
  addNode: (type: string) => void
  toggleAllCollapsed: () => void
  allCollapsed: boolean
  bpm: number
  timeSig: string
  globalScale: string
  nodeCount: number
  activeCount: number
  zoom: number
  setZoom: (z: number | ((z: number) => number)) => void
  resetView: () => void
  toggleFullscreen: () => void
  isFullscreen: boolean
  openSoundUploader: () => void
  toggleTimeline: () => void
  toggleSidebar: () => void
  sidebarOpen: boolean
  handleBpmChange: (v: number) => void
  handleTimeSigChange: (v: string) => void
  handleGlobalScaleChange: (v: string) => void
  selectedNode: string | null
}

const NodeEditor = forwardRef<NodeEditorHandle, NodeEditorProps>(function NodeEditor({ code, isPlaying, onCodeChange, onUpdate, onRegisterSound, analyserNode, getAnalyserById, headerless, getCyclePosition }, ref) {
  const [nodes, setNodes] = useState<PatternNode[]>([])
  const [bpm, setBpm] = useState(0)
  const [timeSig, setTimeSig] = useState('4/4')
  const [dragging, setDragging] = useState<{ id: string; ox: number; oy: number } | null>(null)
  const [zoom, setZoom] = useState(0.85)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const [showAddMenu, setShowAddMenu] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [sidebarSearch, setSidebarSearch] = useState('')
  const [sidebarCategory, setSidebarCategory] = useState<string | null>(null)
  const [sidebarHint, setSidebarHint] = useState('')
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [dropTarget, setDropTarget] = useState<string | null>(null)
  const [allCollapsed, setAllCollapsed] = useState(false)
  const [timelineOpen, setTimelineOpen] = useState(true)

  const [pianoRollOpen, setPianoRollOpen] = useState<{ nodeId: string } | null>(null)
  const [drumSequencerOpen, setDrumSequencerOpen] = useState<{ nodeId: string } | null>(null)
  const [soundUploaderOpen, setSoundUploaderOpen] = useState(false)
  const [soundSlicerOpen, setSoundSlicerOpen] = useState<{ nodeId: string } | null>(null)
  const [currentCycle, setCurrentCycle] = useState(0)
  const [userSamples, setUserSamples] = useState<{ name: string; url: string }[]>([])
  const [sampleChoiceModal, setSampleChoiceModal] = useState<{ sampleName: string; sampleUrl: string } | null>(null)
  const [fxDropdownNodeId, setFxDropdownNodeId] = useState<string | null>(null)
  const [fxSearchQuery, setFxSearchQuery] = useState('')
  const [codeGenerating, setCodeGenerating] = useState(false)

  const panStart = useRef({ x: 0, y: 0, px: 0, py: 0 })
  const containerRef = useRef<HTMLDivElement>(null)
  const lastCodeRef = useRef(code)
  const commitTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const immediateTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // ── Touch state refs (mutable to avoid stale closures in imperative listeners) ──
  const touchDragRef = useRef<{ id: string; ox: number; oy: number } | null>(null)
  const touchPanRef = useRef<{ active: boolean; startX: number; startY: number; px: number; py: number }>({ active: false, startX: 0, startY: 0, px: 0, py: 0 })
  const pinchRef = useRef<{ active: boolean; startDist: number; startZoom: number }>({ active: false, startDist: 0, startZoom: 0.85 })
  const zoomRef = useRef(zoom)
  zoomRef.current = zoom
  // Boolean flag: true when the most recent code change came from sendToParent (internal).
  // Uses boolean instead of counter to avoid permanent leak when React batches multiple
  // sendToParent calls into a single render (counter increments N but only decrements once).
  const isInternalChange = useRef(false)
  const lastSentCodeRef = useRef<string | null>(null)
  const prevNodeCount = useRef(0)
  const codeGenTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Keep latest onUpdate in a ref — avoids stale closures in debounced timers.
  const onUpdateRef = useRef(onUpdate)
  useEffect(() => { onUpdateRef.current = onUpdate }, [onUpdate])

  // Stable refs for latest state — avoids stale closures in callbacks
  const nodesRef = useRef(nodes)
  nodesRef.current = nodes
  const panRef = useRef(pan)
  panRef.current = pan
  // Track latest knob draft values synchronously (bypasses React render cycle)
  // updateKnob writes here, commitKnob reads — guarantees fresh value on mouseup
  const knobDraftRef = useRef<Map<string, number>>(new Map())

  // ── Expose imperative handle to parent (for headerless mode) ──
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useImperativeHandle(ref, () => ({
    addNode,
    toggleAllCollapsed,
    allCollapsed,
    bpm,
    timeSig,
    globalScale,
    nodeCount: nodes.length,
    activeCount: nodes.filter(n => !n.muted).length,
    zoom,
    setZoom,
    resetView: () => { setZoom(0.85); setPan({ x: 0, y: 0 }) },
    toggleFullscreen: () => setIsFullscreen(p => !p),
    isFullscreen,
    openSoundUploader: () => setSoundUploaderOpen(true),
    toggleTimeline: () => setTimelineOpen(p => !p),
    toggleSidebar: () => setSidebarOpen(p => !p),
    sidebarOpen,
    handleBpmChange,
    handleTimeSigChange,
    handleGlobalScaleChange,
    selectedNode,
  }))

  // ── Fetch user's uploaded samples on mount ──
  const fetchUserSamples = useCallback(async () => {
    try {
      const res = await fetch('/api/nde/samples')
      const data = await res.json()
      if (data.samples) {
        setUserSamples(data.samples.map((s: { name: string; url: string }) => ({ name: s.name, url: s.url })))
      }
    } catch { /* silent */ }
  }, [])

  useEffect(() => { fetchUserSamples() }, [fetchUserSamples])

  // ── FULL SYNC from parent code ──
  // This is the ONLY place where we re-parse nodes from code.
  // It runs whenever the code prop changes AND it wasn't us who changed it.
  useEffect(() => {
    // Skip re-parse if this code change originated from us (sendToParent).
    // Boolean flag catches batched changes; string check catches React 19 batching edge cases.
    const isInternal = isInternalChange.current || (lastSentCodeRef.current !== null && code === lastSentCodeRef.current)
    if (isInternal) {
      isInternalChange.current = false
      lastSentCodeRef.current = null
      return
    }
    isInternalChange.current = false
    lastSentCodeRef.current = null
    // External code change (user typed in editor, loaded example, etc.)
    lastCodeRef.current = code
    const newBpm = extractBpm(code)
    setBpm(newBpm)
    // Flash "generating" indicator on glass panel
    if (codeGenTimerRef.current) clearTimeout(codeGenTimerRef.current)
    setCodeGenerating(true)
    codeGenTimerRef.current = setTimeout(() => setCodeGenerating(false), 1200)

    setNodes(prev => {
      const parsed = parseCodeToNodes(code, prev.length > 0 ? prev : undefined)
      prevNodeCount.current = parsed.length
      return parsed
    })
  }, [code])

  // ── Init on mount ──
  useEffect(() => {
    const parsed = parseCodeToNodes(code)
    setNodes(parsed)
    setBpm(extractBpm(code))
    prevNodeCount.current = parsed.length
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Send code change to parent ──
  // The code text is pushed to the parent immediately (so Undo history stays current),
  // but the expensive Strudel evaluate() is debounced to prevent thrashing.
  //
  // Two separate timers prevent solo/mute from being blocked by PianoRoll auto-apply:
  //  - immediateTimer (16ms): for solo/mute — fires almost instantly, can't be cancelled
  //    by normal edits. Only cancelled/reset by other immediate sends.
  //  - commitTimer (200ms): for knob drags, PianoRoll, etc. — debounced.
  //    Cleared when an immediate send fires (to avoid redundant re-evaluate).
  const sendToParent = useCallback((newCode: string, immediate?: boolean) => {
    lastCodeRef.current = newCode
    isInternalChange.current = true
    lastSentCodeRef.current = newCode
    onCodeChange(newCode)
    if (immediate) {
      // Solo/mute: clear pending normal timer (immediate supersedes)
      if (commitTimer.current) { clearTimeout(commitTimer.current); commitTimer.current = null }
      // Use dedicated immediate timer so normal sends can't cancel it
      if (immediateTimer.current) clearTimeout(immediateTimer.current)
      immediateTimer.current = setTimeout(() => {
        immediateTimer.current = null
        onUpdateRef.current()
      }, 16)
    } else {
      // Normal edit: debounced. Don't touch the immediate timer.
      if (commitTimer.current) clearTimeout(commitTimer.current)
      commitTimer.current = setTimeout(() => {
        commitTimer.current = null
        onUpdateRef.current()
      }, 200)
    }
  }, [onCodeChange])

  /** Lightweight full code rebuild that stitches node code blocks together */
  const rebuildFullCodeFromNodes = useCallback((nodeList: PatternNode[], currentBpm: number, origCode: string): string => {
    const lines = origCode.split('\n')
    const preamble: string[] = []
    const nodeCommentRe = /^\/\/\s*[─—]+\s*.+\s*[─—]+\s*$/
    for (const line of lines) {
      const t = line.trim()
      if (t.startsWith('$:') || t.startsWith('// [muted] $:')) break
      // Skip node name comments (they'll be re-generated from node.name)
      if (nodeCommentRe.test(t)) continue
      if (!t.startsWith('setcps') && !t.startsWith('setbpm')) preamble.push(line)
    }
    const parts: string[] = []
    const pre = preamble.join('\n').trimEnd()
    if (pre) parts.push(pre)
    if (currentBpm > 0) parts.push(`setcps(${currentBpm}/60/4) // ${currentBpm} bpm`)
    parts.push('')
    for (let ni = 0; ni < nodeList.length; ni++) {
      const node = nodeList[ni]
      const commentLine = node.name ? `// ── ${node.name} ──` : ''
      // Inject .analyze("nde_N") for per-node EQ visualization (stripped on re-parse)
      const analyzeTag = `.analyze("nde_${ni}")`
      if (node.muted) {
        const mutedCode = node.code.split('\n')
          .map(l => l.trim().startsWith('// [muted]') ? l : `// [muted] ${l}`)
          .join('\n')
        parts.push(commentLine ? `${commentLine}\n${mutedCode}` : mutedCode)
      } else {
        const cleanCode = node.code.replace(/\/\/ \[muted\] /g, '')
        // Auto-assign orbit per node to isolate delay/reverb/phaser (Strudel global effects)
        // Only inject if node doesn't already specify .orbit()
        const orbitTag = /\.orbit\s*\(/.test(cleanCode) ? '' : `.orbit(${ni + 1})`
        const codeWithOrbit = orbitTag ? injectBefore(cleanCode, orbitTag) : cleanCode
        const codeWithAnalyze = injectBefore(codeWithOrbit, analyzeTag)
        parts.push(commentLine ? `${commentLine}\n${codeWithAnalyze}` : codeWithAnalyze)
      }
      parts.push('')
    }
    return parts.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n'
  }, [])

  // ── Apply a targeted effect change to a single node's code block ──
  const applyNodeEffect = useCallback((nodeId: string, method: string, value: number | string, remove?: boolean) => {
    let codeToSend: string | null = null
    setNodes(prev => {
      const idx = prev.findIndex(n => n.id === nodeId)
      if (idx === -1) return prev
      const old = prev[idx]
      const newCode = applyEffect(old.code, method, value, remove)
      if (newCode === old.code) return prev // No actual change

      const updated = [...prev]
      // Full re-parse so ALL properties stay in sync with the code
      updated[idx] = reparseNodeFromCode({ ...old, code: newCode })

      // Capture code to send — side effect happens OUTSIDE updater
      codeToSend = rebuildFullCodeFromNodes(updated, bpm, lastCodeRef.current)
      return updated
    })
    if (codeToSend !== null) sendToParent(codeToSend)
  }, [bpm, sendToParent, rebuildFullCodeFromNodes])

  // ── BPM Change (respects time signature) ──
  const handleBpmChange = useCallback((v: number) => {
    const clamped = Math.max(30, Math.min(300, Math.round(v)))
    setBpm(clamped)
    const sig = TIME_SIGNATURES.find(t => t.value === timeSig) || TIME_SIGNATURES[0]
    const beatsPerBar = sig.beatsPerBar
    // Replace ALL setcps lines in current code (prevents duplicate accumulation)
    const lines = lastCodeRef.current.split('\n')
    let replaced = false
    const cleaned: string[] = []
    const cpsLine = beatsPerBar === 4
      ? `setcps(${clamped}/60/4) // ${clamped} bpm`
      : `setcps(${clamped}/60/${beatsPerBar}) // ${clamped} bpm (${timeSig})`
    for (const line of lines) {
      if (/^\s*setcps\s*\(/.test(line) || /^\s*setbpm\s*\(/.test(line)) {
        if (!replaced) {
          cleaned.push(cpsLine)
          replaced = true
        }
        // skip duplicate setcps lines
      } else {
        cleaned.push(line)
      }
    }
    if (!replaced) {
      // No setcps found — insert before first $: block
      let insertIdx = 0
      for (let i = 0; i < cleaned.length; i++) {
        const t = cleaned[i].trim()
        if (t.startsWith('$:') || t.startsWith('// [muted]')) break
        if (t === '' || t.startsWith('//')) insertIdx = i + 1
        else { insertIdx = i; break }
      }
      cleaned.splice(insertIdx, 0, cpsLine)
    }
    sendToParent(cleaned.join('\n'))
  }, [sendToParent, timeSig])

  // ── Time Signature Change ──
  const handleTimeSigChange = useCallback((newSig: string) => {
    setTimeSig(newSig)
    // Re-apply BPM with the new time signature
    const sig = TIME_SIGNATURES.find(t => t.value === newSig) || TIME_SIGNATURES[0]
    const beatsPerBar = sig.beatsPerBar
    const currentBpm = bpm || 72
    const lines = lastCodeRef.current.split('\n')
    let replaced = false
    const cleaned: string[] = []
    const cpsLine = beatsPerBar === 4
      ? `setcps(${currentBpm}/60/4) // ${currentBpm} bpm`
      : `setcps(${currentBpm}/60/${beatsPerBar}) // ${currentBpm} bpm (${newSig})`
    for (const line of lines) {
      if (/^\s*setcps\s*\(/.test(line) || /^\s*setbpm\s*\(/.test(line)) {
        if (!replaced) { cleaned.push(cpsLine); replaced = true }
      } else { cleaned.push(line) }
    }
    if (!replaced) {
      let insertIdx = 0
      for (let i = 0; i < cleaned.length; i++) {
        const t = cleaned[i].trim()
        if (t.startsWith('$:') || t.startsWith('// [muted]')) break
        if (t === '' || t.startsWith('//')) insertIdx = i + 1
        else { insertIdx = i; break }
      }
      cleaned.splice(insertIdx, 0, cpsLine)
    }
    sendToParent(cleaned.join('\n'))
  }, [sendToParent, bpm])

  // ── Global Scale Change ──
  const handleGlobalScaleChange = useCallback((newScale: string) => {
    // Parse new scale: "D#4:diminished" → root="D#", octave=4, type="diminished"
    const newMatch = newScale.match(/^([A-Ga-g]#?)(-?\d+):(.+)$/)
    if (!newMatch) return
    const [, newRoot, , newType] = newMatch

    let codeToSend: string | null = null
    setNodes(prev => {
      const updated = prev.map(n => {
        if (isSampleBased(n.type)) return n
        // Preserve each node's octave offset — bass stays low, melody stays high
        const currentMatch = n.code.match(/\.scale\s*\(\s*["']([A-Ga-g]#?)(-?\d+):([^"']+)["']\s*\)/)
        const nodeOctave = currentMatch ? currentMatch[2] : '4'
        const nodeNewScale = `${newRoot}${nodeOctave}:${newType}`
        const newCode = applyEffect(n.code, 'scale', nodeNewScale)
        return reparseNodeFromCode({ ...n, code: newCode })
      })
      codeToSend = rebuildFullCodeFromNodes(updated, bpm, lastCodeRef.current)
      return updated
    })
    if (codeToSend !== null) sendToParent(codeToSend)
  }, [bpm, sendToParent, rebuildFullCodeFromNodes])

  // ── Mute / Solo ──
  // CRITICAL: When toggling mute/solo, we must also update node.code to match.
  // node.code must ALWAYS be the "clean" version (no // [muted] prefix).
  // rebuildFullCodeFromNodes wraps/unwraps based on the muted flag.
  const toggleMute = useCallback((id: string) => {
    let codeToSend: string | null = null
    setNodes(prev => {
      const updated = prev.map(n => {
        if (n.id !== id) return n
        // Always normalize code to clean (prefix-free) when toggling
        const cleanCode = n.code.replace(/\/\/ \[muted\] /g, '')
        return { ...n, muted: !n.muted, code: cleanCode }
      })
      codeToSend = rebuildFullCodeFromNodes(updated, bpm, lastCodeRef.current)
      return updated
    })
    // immediate=true → mute takes effect instantly
    if (codeToSend !== null) sendToParent(codeToSend, true)
  }, [bpm, sendToParent, rebuildFullCodeFromNodes])

  const toggleSolo = useCallback((id: string) => {
    let codeToSend: string | null = null
    setNodes(prev => {
      const wasSolo = prev.find(n => n.id === id)?.solo
      const updated = wasSolo
        // Un-solo: unmute all, normalize all code to clean
        ? prev.map(n => ({ ...n, solo: false, muted: false, code: n.code.replace(/\/\/ \[muted\] /g, '') }))
        // Solo: mute all except target, normalize all code to clean
        : prev.map(n => ({
            ...n,
            solo: n.id === id,
            muted: n.id !== id,
            code: n.code.replace(/\/\/ \[muted\] /g, ''),
          }))
      codeToSend = rebuildFullCodeFromNodes(updated, bpm, lastCodeRef.current)
      return updated
    })
    // immediate=true → bypass 500ms debounce so solo takes effect instantly
    if (codeToSend !== null) sendToParent(codeToSend, true)
  }, [bpm, sendToParent, rebuildFullCodeFromNodes])

  /** Additive solo — right-click toggles solo on a node without affecting others.
   *  Multiple nodes can be soloed simultaneously. Muting applies only to non-soloed nodes. */
  const toggleAdditiveSolo = useCallback((id: string) => {
    let codeToSend: string | null = null
    setNodes(prev => {
      const target = prev.find(n => n.id === id)
      if (!target) return prev
      const willSolo = !target.solo
      const updated = prev.map(n => {
        const newSolo = n.id === id ? willSolo : n.solo
        return {
          ...n,
          solo: newSolo,
          code: n.code.replace(/\/\/ \[muted\] /g, ''),
        }
      })
      // If ANY node is soloed, mute all non-soloed nodes
      const anySoloed = updated.some(n => n.solo)
      const final = updated.map(n => ({ ...n, muted: anySoloed ? !n.solo : false }))
      codeToSend = rebuildFullCodeFromNodes(final, bpm, lastCodeRef.current)
      return final
    })
    // immediate=true → bypass 500ms debounce so solo takes effect instantly
    if (codeToSend !== null) sendToParent(codeToSend, true)
  }, [bpm, sendToParent, rebuildFullCodeFromNodes])

  // ── Collapse / Expand single node ──
  const toggleCollapsed = useCallback((id: string) => {
    setNodes(prev => prev.map(n => n.id === id ? { ...n, collapsed: !n.collapsed } : n))
  }, [])

  // ── Collapse / Expand all nodes ──
  const toggleAllCollapsed = useCallback(() => {
    setAllCollapsed(prev => {
      const newVal = !prev
      setNodes(ns => ns.map(n => ({ ...n, collapsed: newVal })))
      return newVal
    })
  }, [])

  // ── Cycle tracker — synced to Strudel scheduler when available ──
  useEffect(() => {
    if (!isPlaying) { setCurrentCycle(0); return }
    let raf: number
    if (getCyclePosition) {
      // Synced mode: read directly from Strudel scheduler.now()
      const tick = () => {
        setCurrentCycle(getCyclePosition())
        raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)
    } else {
      // Fallback: independent clock (same BPM, may drift)
      const cps = bpm > 0 ? bpm / 60 / 4 : 72 / 60 / 4
      const msPerCycle = 1000 / cps
      const startTime = performance.now()
      const tick = () => {
        const elapsed = performance.now() - startTime
        setCurrentCycle(elapsed / msPerCycle)
        raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)
    }
    return () => cancelAnimationFrame(raf)
  }, [isPlaying, bpm, getCyclePosition])

  // ── Delete / Duplicate ──
  const deleteNode = useCallback((id: string) => {
    let codeToSend: string | null = null
    setNodes(prev => {
      const updated = prev.filter(n => n.id !== id)
      codeToSend = rebuildFullCodeFromNodes(updated, bpm, lastCodeRef.current)
      prevNodeCount.current = updated.length
      return updated
    })
    if (codeToSend !== null) sendToParent(codeToSend)
  }, [bpm, sendToParent, rebuildFullCodeFromNodes])

  const duplicateNode = useCallback((id: string) => {
    let codeToSend: string | null = null
    setNodes(prev => {
      const src = prev.find(n => n.id === id)
      if (!src) return prev
      const dup: PatternNode = {
        ...src, id: `node_dup_${Date.now()}`,
        name: `${src.name} copy`, x: src.x + 40, y: src.y + 40,
        muted: false, solo: false, collapsed: false,
      }
      const updated = [...prev, dup]
      codeToSend = rebuildFullCodeFromNodes(updated, bpm, lastCodeRef.current)
      prevNodeCount.current = updated.length
      return updated
    })
    if (codeToSend !== null) sendToParent(codeToSend)
  }, [bpm, sendToParent, rebuildFullCodeFromNodes])

  // ── Sound / Pattern / Scale change (per node) ──
  // Use setNodes to read current state instead of stale `nodes` closure
  const changeSoundSource = useCallback((id: string, newSource: string) => {
    let codeToSend: string | null = null
    setNodes(prev => {
      const node = prev.find(n => n.id === id)
      if (!node) return prev
      let newCode: string
      const isUserSample = userSamples.some(s => s.name === newSource)

      if (isSampleBased(node.type)) {
        if (isUserSample) {
          // Custom sample on drum/fx node:
          // Replace drum abbreviation tokens in pattern with sample name, strip .bank()
          const patternRe = /(?<!\.)\bs\s*\(\s*["']([^"']+)["']\s*\)/
          const pm = node.code.match(patternRe)
          if (pm) {
            const oldPattern = pm[1]
            const drumTokenRe = /\b(bd|sd|cp|hh|oh|rim|cy|cr|rd|cb|cl|sh|ma|lt|mt|ht|perc|tb)\b/gi
            // If pattern has drum abbreviations, replace them with sample name
            const newPattern = drumTokenRe.test(oldPattern)
              ? oldPattern.replace(drumTokenRe, newSource)
              : newSource
            newCode = node.code.replace(pm[0], `s("${newPattern}")`)
          } else {
            newCode = applyEffect(node.code, 'drumPattern', newSource)
          }
          // Strip .bank() — custom samples don't use banks
          newCode = newCode.replace(/\s*\.bank\s*\(\s*["'][^"']*["']\s*\)/, '')
        } else {
          // Drum bank: change .bank() value — preserve the drum pattern in s()
          const bankRe = /\.bank\s*\(\s*["'][^"']*["']\s*\)/
          if (bankRe.test(node.code)) {
            newCode = node.code.replace(bankRe, `.bank("${newSource}")`)
          } else {
            // No .bank() yet — inject after s("...")
            const sRe = /((?<!\.)\bs\s*\(\s*["'][^"']*["']\s*\))/
            newCode = sRe.test(node.code)
              ? node.code.replace(sRe, `$1.bank("${newSource}")`)
              : node.code
          }
        }
      } else {
        newCode = applyEffect(node.code, 'soundDotS', newSource)
      }

      if (newCode === node.code) return prev
      const updated = prev.map(n => n.id === id ? reparseNodeFromCode({ ...n, code: newCode }) : n)
      codeToSend = rebuildFullCodeFromNodes(updated, bpm, lastCodeRef.current)
      return updated
    })
    if (codeToSend !== null) sendToParent(codeToSend)
  }, [bpm, sendToParent, rebuildFullCodeFromNodes, userSamples])

  // Change .bank("...") on a node — for drum machine drops
  const changeSoundBank = useCallback((id: string, bankName: string) => {
    let codeToSend: string | null = null
    setNodes(prev => {
      const node = prev.find(n => n.id === id)
      if (!node) return prev
      let newCode = applyEffect(node.code, 'bank', bankName)
      // If no .bank() exists yet, inject one after s("...")
      if (newCode === node.code) {
        const sRe = /((?<!\.)\bs\s*\(\s*["'][^"']*["']\s*\))/
        if (sRe.test(node.code)) {
          newCode = node.code.replace(sRe, `$1.bank("${bankName}")`)
        }
      }
      if (newCode === node.code) return prev
      const updated = prev.map(n => n.id === id ? reparseNodeFromCode({ ...n, code: newCode }) : n)
      codeToSend = rebuildFullCodeFromNodes(updated, bpm, lastCodeRef.current)
      return updated
    })
    if (codeToSend !== null) sendToParent(codeToSend)
  }, [bpm, sendToParent, rebuildFullCodeFromNodes])

  // Change .s("instrument") on a node — for synth/instrument drops
  const changeSoundInstrument = useCallback((id: string, instrument: string) => {
    let codeToSend: string | null = null
    setNodes(prev => {
      const node = prev.find(n => n.id === id)
      if (!node) return prev
      const newCode = applyEffect(node.code, 'soundDotS', instrument)
      if (newCode === node.code) return prev
      const updated = prev.map(n => n.id === id ? reparseNodeFromCode({ ...n, code: newCode }) : n)
      codeToSend = rebuildFullCodeFromNodes(updated, bpm, lastCodeRef.current)
      return updated
    })
    if (codeToSend !== null) sendToParent(codeToSend)
  }, [bpm, sendToParent, rebuildFullCodeFromNodes])

  const changePattern = useCallback((id: string, newPattern: string) => {
    let codeToSend: string | null = null
    setNodes(prev => {
      const node = prev.find(n => n.id === id)
      if (!node) return prev
      const method = isSampleBased(node.type) ? 'drumPattern' : 'notePattern'
      const newCode = applyEffect(node.code, method, newPattern)
      if (newCode === node.code) return prev
      const updated = prev.map(n => n.id === id ? reparseNodeFromCode({ ...n, code: newCode }) : n)
      codeToSend = rebuildFullCodeFromNodes(updated, bpm, lastCodeRef.current)
      return updated
    })
    if (codeToSend !== null) sendToParent(codeToSend)
  }, [bpm, sendToParent, rebuildFullCodeFromNodes])

  const changeScale = useCallback((id: string, newScale: string) => {
    applyNodeEffect(id, 'scale', newScale)
  }, [applyNodeEffect])

  // ── Piano Roll pattern change ──
  const handlePianoRollPatternChange = useCallback((nodeId: string, newPattern: string) => {
    let codeToSend: string | null = null
    setNodes(prev => {
      const node = prev.find(n => n.id === nodeId)
      if (!node) return prev
      const method = 'notePattern'
      const newCode = applyEffect(node.code, method, newPattern)
      if (newCode === node.code) return prev
      const updated = prev.map(n => n.id === nodeId ? reparseNodeFromCode({ ...n, code: newCode }) : n)
      codeToSend = rebuildFullCodeFromNodes(updated, bpm, lastCodeRef.current)
      return updated
    })
    if (codeToSend !== null) sendToParent(codeToSend)
  }, [bpm, sendToParent, rebuildFullCodeFromNodes])

  // ── Drum Sequencer pattern change → update s("...") and .slow() for multi-bar ──
  const handleDrumPatternChange = useCallback((nodeId: string, newPattern: string, bars: number) => {
    let codeToSend: string | null = null
    setNodes(prev => {
      const node = prev.find(n => n.id === nodeId)
      if (!node) return prev
      let newCode = applyEffect(node.code, 'drumPattern', newPattern)
      // Manage .slow() for multi-bar patterns
      if (bars > 1) {
        // Inject or update .slow(N)
        if (/\.slow\s*\(/.test(newCode)) {
          newCode = newCode.replace(/\.slow\s*\([^)]*\)/, `.slow(${bars})`)
        } else {
          // Inject .slow() after s("...") line
          newCode = newCode.replace(/((?<!\.))\bs\s*\(\s*["'][^"']*["']\s*\)/, `$&\n  .slow(${bars})`)
        }
      } else {
        // 1 bar → remove any .slow() (1 bar is the default cycle length)
        newCode = newCode.replace(/\s*\.slow\s*\([^)]*\)/, '')
      }
      if (newCode === node.code) return prev
      const updated = prev.map(n => n.id === nodeId ? reparseNodeFromCode({ ...n, code: newCode }) : n)
      codeToSend = rebuildFullCodeFromNodes(updated, bpm, lastCodeRef.current)
      return updated
    })
    if (codeToSend !== null) sendToParent(codeToSend)
  }, [bpm, sendToParent, rebuildFullCodeFromNodes])

  // ── Sound Slicer region change → inject/update .begin()/.end() on node code ──
  const handleSlicerRegionChange = useCallback((nodeId: string, beginVal: number, endVal: number) => {
    let codeToSend: string | null = null
    setNodes(prev => {
      const node = prev.find(n => n.id === nodeId)
      if (!node) return prev
      let newCode = node.code
      // Update or inject .begin()
      if (/\.begin\s*\(/.test(newCode)) {
        newCode = newCode.replace(/\.begin\s*\([^)]*\)/, `.begin(${beginVal.toFixed(3)})`)
      } else {
        newCode = newCode.replace(/(\n|$)/, `.begin(${beginVal.toFixed(3)})$1`)
      }
      // Update or inject .end()
      if (/\.end\s*\(/.test(newCode)) {
        newCode = newCode.replace(/\.end\s*\([^)]*\)/, `.end(${endVal.toFixed(3)})`)
      } else {
        newCode = newCode.replace(/\.begin\([^)]*\)/, `$&.end(${endVal.toFixed(3)})`)
      }
      if (newCode === node.code) return prev
      const updated = prev.map(n => n.id === nodeId ? reparseNodeFromCode({ ...n, code: newCode }) : n)
      codeToSend = rebuildFullCodeFromNodes(updated, bpm, lastCodeRef.current)
      return updated
    })
    if (codeToSend !== null) sendToParent(codeToSend)
  }, [bpm, sendToParent, rebuildFullCodeFromNodes])

  // ── Add a sample-based node (Instrument = MIDI sliced, Sound = pitched) ──
  const addSampleNode = useCallback((sampleName: string, mode: 'instrument' | 'sound') => {
    const tc = TYPE_COLORS
    let t: string
    if (mode === 'instrument') {
      // Instrument: sliced across MIDI notes so user can play it in the Piano Roll
      t = `$: n("0 1 2 3 4 5 6 7").s("${sampleName}")
  .gain(0.5).cut(1)
  .scope({color:"${tc.vocal}",thickness:1.5,smear:.92})`
    } else {
      // Sound: pitched according to scale, like a vocal/pad layer
      t = `$: n("<0 2 4 7>").scale("C4:major").s("${sampleName}")
  .gain(0.4)
  .room(0.4).lpf(4000)
  .slow(2)
  .scope({color:"${tc.vocal}",thickness:1,smear:.93})`
    }
    const label = mode === 'instrument' ? 'sample instrument' : 'sample sound'
    const newCode = lastCodeRef.current.trimEnd() + `\n\n// ── ${sampleName} (${label}) ──\n` + t + '\n'
    const parsed = parseCodeToNodes(newCode)
    setNodes(parsed)
    prevNodeCount.current = parsed.length
    sendToParent(newCode)
    setSampleChoiceModal(null)
  }, [sendToParent])

  // ── Quick Add ──
  const addNode = useCallback((template: string) => {
    const tc = TYPE_COLORS
    const templates: Record<string, string> = {
      drums: `$: s("bd [~ bd] ~ ~, ~ cp ~ ~, hh*8")\n  .bank("RolandTR808").gain(0.7)\n  .scope({color:"${tc.drums}",thickness:2,smear:.88})`,
      bass: `$: n("<0 3 4 0>").scale("C2:major")\n  .s("sawtooth").lpf(400).gain(0.35)\n  .scope({color:"${tc.bass}",thickness:2.5,smear:.96})`,
      melody: `$: n("0 2 4 7 4 2").scale("C4:major")\n  .s("gm_piano").gain(0.3)\n  .room(0.4).delay(0.15)\n  .scope({color:"${tc.melody}",thickness:1,smear:.91})`,
      chords: `$: n("<[0,2,4] [-2,0,2] [-4,-2,0] [-3,-1,1]>").scale("C4:major")\n  .s("gm_epiano1").gain(0.25)\n  .lpf(1800).room(0.5)\n  .slow(2)\n  .scope({color:"${tc.chords}",thickness:1,smear:.93})`,
      pad: `$: n("<[0,4,9] [-2,2,7]>").scale("C3:major")\n  .s("sawtooth").lpf(800).gain(0.08)\n  .room(0.9).delay(0.3).delayfeedback(0.5)\n  .slow(4)\n  .fscope()`,
      vocal: `$: n("<0 2 4 7>").scale("C4:major")\n  .s("gm_choir_aahs").gain(0.3)\n  .room(0.5).lpf(3000)\n  .slow(2)\n  .scope({color:"${tc.vocal}",thickness:1,smear:.93})`,
      fx: `$: s("hh*16").gain(0.06)\n  .delay(0.25).delayfeedback(0.5)\n  .room(0.6).lpf(2000).speed(2.5)\n  .scope({color:"${tc.fx}",thickness:1,smear:.95})`,
    }
    const t = templates[template] || templates.drums
    const newCode = lastCodeRef.current.trimEnd() + '\n\n// ── New ' + template + ' ──\n' + t + '\n'
    // Parse and add new node locally, then send rebuilt code to parent via sendToParent
    // This prevents the dual-guard from re-parsing and resetting positions
    const parsed = parseCodeToNodes(newCode)
    setNodes(parsed)
    prevNodeCount.current = parsed.length
    sendToParent(newCode)
    setShowAddMenu(false)
    // Phase 3: Auto-open the visual editor for the new node
    const newNode = parsed[parsed.length - 1]
    if (newNode) {
      const sampleBased = new Set(['drums', 'fx', 'other'])
      if (sampleBased.has(newNode.type)) {
        setDrumSequencerOpen({ nodeId: newNode.id })
        setPianoRollOpen(null)
      } else {
        setPianoRollOpen({ nodeId: newNode.id })
        setDrumSequencerOpen(null)
      }
    }
  }, [sendToParent])

  // ── Knob change handler (updates local state, commits on release) ──
  const updateKnob = useCallback((nodeId: string, method: string, value: number) => {
    // Write to draft ref SYNCHRONOUSLY so commitKnob always reads the latest value,
    // even if React hasn't re-rendered yet after setNodes.
    knobDraftRef.current.set(`${nodeId}:${method}`, value)
    // Instant local update for smooth knob dragging — UI only, no code change
    setNodes(prev => prev.map(n => {
      if (n.id !== nodeId) return n
      const key = method === 'slow' ? 'speed' : method
      return { ...n, [key]: value }
    }))
  }, [])

  const commitKnob = useCallback((nodeId: string, method: string, _staleValue: number) => {
    // Read from knobDraftRef which is written synchronously by updateKnob.
    // This is immune to React's batched rendering — always has the latest value.
    const draftKey = `${nodeId}:${method}`
    const v = knobDraftRef.current.get(draftKey) ?? _staleValue
    knobDraftRef.current.delete(draftKey)

    // Determine if we should remove the effect (at default/neutral value)
    const isDefault = (method === 'lpf' && v >= 20000) ||
                      (method === 'hpf' && v <= 0) ||
                      (method === 'room' && v <= 0) ||
                      (method === 'roomsize' && Math.abs(v - 0.5) < 0.01) ||
                      (method === 'delay' && v <= 0) ||
                      (method === 'delayfeedback' && v <= 0) ||
                      (method === 'crush' && v <= 0) ||
                      (method === 'coarse' && v <= 0) ||
                      (method === 'shape' && v <= 0) ||
                      (method === 'distort' && v <= 0) ||
                      (method === 'pan' && Math.abs(v - 0.5) < 0.01) ||
                      (method === 'attack' && v <= 0.001) ||
                      (method === 'sustain' && Math.abs(v - 0.5) < 0.01) ||
                      (method === 'release' && Math.abs(v - 0.1) < 0.01) ||
                      (method === 'phaser' && v <= 0) ||
                      (method === 'phaserdepth' && Math.abs(v - 0.5) < 0.01) ||
                      (method === 'vibmod' && v <= 0) ||
                      (method === 'lpq' && Math.abs(v - 1) < 0.1) ||
                      (method === 'hpq' && Math.abs(v - 1) < 0.1) ||
                      (method === 'fmi' && v <= 0) ||
                      (method === 'velocity' && Math.abs(v - 1) < 0.01) ||
                      (method === 'orbit' && v <= 0)

    applyNodeEffect(nodeId, method, v, isDefault)
  }, [applyNodeEffect])

  // ── Quick FX toggle (inject/remove pattern modifier) ──
  const toggleQuickFX = useCallback((nodeId: string, fx: QuickFX) => {
    let codeToSend: string | null = null
    setNodes(prev => {
      const idx = prev.findIndex(n => n.id === nodeId)
      if (idx === -1) return prev
      const node = prev[idx]
      const rawCode = node.code.replace(/\/\/ \[muted\] /g, '')
      const isActive = fx.detect.test(rawCode)

      let newCode: string
      if (isActive) {
        // Remove the effect — always work on clean code (rawCode)
        newCode = rawCode
        const matchResult = rawCode.match(fx.detect)
        if (matchResult && matchResult.index !== undefined) {
          const mIdx = matchResult.index
          // Walk backward to find the starting dot
          let start = mIdx
          while (start > 0 && (rawCode[start - 1] === '.' || rawCode[start - 1] === ' ' || rawCode[start - 1] === '\n')) start--
          if (rawCode[start] === '.') { /* keep start */ } else start = mIdx
          // Walk forward from match to find balanced parens
          let depth = 0; let end = start; let inMatch = false
          for (let i = start; i < rawCode.length; i++) {
            if (rawCode[i] === '(') { depth++; inMatch = true }
            if (rawCode[i] === ')') { depth-- }
            if (inMatch && depth === 0) { end = i + 1; break }
          }
          const toRemove = rawCode.substring(start, end)
          newCode = rawCode.replace(toRemove, '')
        }
      } else {
        // Add the effect — always work on clean code (rawCode)
        newCode = injectBefore(rawCode, fx.code)
      }

      if (newCode === node.code) return prev
      const updated = [...prev]
      updated[idx] = reparseNodeFromCode({ ...node, code: newCode })
      codeToSend = rebuildFullCodeFromNodes(updated, bpm, lastCodeRef.current)
      return updated
    })
    if (codeToSend !== null) sendToParent(codeToSend)
  }, [bpm, sendToParent, rebuildFullCodeFromNodes])

  // ── LFO inject for a knob parameter ──
  const injectLFO = useCallback((nodeId: string, method: string, lfoTemplate: string, min: number, max: number) => {
    let codeToSend: string | null = null
    setNodes(prev => {
      const idx = prev.findIndex(n => n.id === nodeId)
      if (idx === -1) return prev
      const node = prev[idx]
      const rawCode = node.code.replace(/\/\/ \[muted\] /g, '')

      // Build the LFO expression
      const lfoExpr = lfoTemplate
        .replace('{min}', min.toString())
        .replace('{max}', max.toString())

      // Replace existing static value or inject
      const staticRe = new RegExp(`\\.${method}\\s*\\(\\s*[0-9.]+\\s*\\)`)
      const dynamicRe = new RegExp(`\\.${method}\\s*\\([^)]*\\)`)
      let newCode: string

      if (staticRe.test(rawCode)) {
        newCode = rawCode.replace(staticRe, `.${method}(${lfoExpr})`)
      } else if (dynamicRe.test(rawCode)) {
        newCode = rawCode.replace(dynamicRe, `.${method}(${lfoExpr})`)
      } else {
        newCode = injectBefore(rawCode, `.${method}(${lfoExpr})`)
      }

      if (newCode === rawCode) return prev
      const updated = [...prev]
      // Always store clean code; rebuildFullCodeFromNodes handles muted wrapping
      updated[idx] = reparseNodeFromCode({ ...node, code: newCode })
      codeToSend = rebuildFullCodeFromNodes(updated, bpm, lastCodeRef.current)
      return updated
    })
    if (codeToSend !== null) sendToParent(codeToSend)
  }, [bpm, sendToParent, rebuildFullCodeFromNodes])



  // ── Drag & drop from sidebar onto nodes ──
  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy' }, [])

  const handleNodeDragEnter = useCallback((e: React.DragEvent, nodeId: string) => {
    e.preventDefault(); e.stopPropagation()
    setDropTarget(nodeId)
  }, [])

  const handleNodeDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation()
    setDropTarget(null)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent, nodeId: string) => {
    e.preventDefault(); e.stopPropagation()
    setDropTarget(null)

    // Try JSON sidebar item first
    const json = e.dataTransfer.getData('application/x-sidebar-item')
    if (json) {
      try {
        const item = JSON.parse(json) as SidebarItem & { soundCategory?: string }
        if (item.dragType === 'effect' || item.dragType === 'lfo') {
          // Inject the payload code into this node AND re-parse properties so knobs activate
          let codeToSend: string | null = null
          setNodes(prev => {
            const idx = prev.findIndex(n => n.id === nodeId)
            if (idx === -1) return prev
            const node = prev[idx]
            const rawCode = node.code.replace(/\/\/ \[muted\] /g, '')
            const newCode = injectBefore(rawCode, item.payload)
            if (newCode === rawCode) return prev
            const updated = [...prev]
            // Always store clean code; rebuildFullCodeFromNodes handles muted wrapping
            updated[idx] = reparseNodeFromCode({ ...node, code: newCode })
            codeToSend = rebuildFullCodeFromNodes(updated, bpm, lastCodeRef.current)
            return updated
          })
          if (codeToSend !== null) sendToParent(codeToSend)
        } else if (item.dragType === 'sound') {
          // Route by soundCategory: drum-machines → bank, synths → .s(), samples → s() pattern
          if (item.soundCategory === 'drum-machine') {
            changeSoundBank(nodeId, item.payload)
          } else if (item.soundCategory === 'synth') {
            changeSoundInstrument(nodeId, item.payload)
          } else {
            changeSoundSource(nodeId, item.payload)
          }
        } else if (item.dragType === 'scale') {
          changeScale(nodeId, item.payload)
        } else if (item.dragType === 'chord' || item.dragType === 'pattern') {
          changePattern(nodeId, item.payload)
        }
      } catch {}
      return
    }

    // Fallback: plain text (old sound bank drop)
    const data = e.dataTransfer.getData('text/plain')
    if (data) {
      // Extract clean sound name from s("...") expression if present
      const sMatch = data.match(/^s\(["']([^"']+)["']\)$/)
      changeSoundSource(nodeId, sMatch ? sMatch[1] : data)
    }
  }, [changeSoundSource, changeSoundBank, changeSoundInstrument, changeScale, changePattern, bpm, sendToParent, rebuildFullCodeFromNodes])

  // ── Canvas-level drop: audio file → upload → ask instrument/sound ──
  const handleCanvasDrop = useCallback(async (e: React.DragEvent) => {
    // Only handle file drops; let sidebar item drops bubble to node handlers
    const files = e.dataTransfer.files
    if (!files || files.length === 0) return
    const file = files[0]
    if (!file.type.startsWith('audio/')) return
    e.preventDefault(); e.stopPropagation()

    if (file.size > 4 * 1024 * 1024) {
      setSidebarHint('⚠ File must be under 4MB')
      setTimeout(() => setSidebarHint(''), 3000)
      return
    }

    // Auto-generate name from filename
    const baseName = file.name.replace(/\.[^.]+$/, '')
      .toLowerCase().replace(/[^a-z0-9_-]/g, '_').replace(/_+/g, '_').slice(0, 32)

    setSidebarHint(`⏳ Uploading "${baseName}"…`)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('name', baseName)
      const res = await fetch('/api/nde/samples', { method: 'POST', body: formData })
      const data = await res.json()

      if (!res.ok) {
        setSidebarHint(`⚠ ${data.error || 'Upload failed'}`)
        setTimeout(() => setSidebarHint(''), 3000)
        return
      }

      // Register in Strudel
      if (onRegisterSound) await onRegisterSound(baseName, [data.sample.url])
      // Refresh sidebar sample list
      await fetchUserSamples()
      setSidebarHint('')
      // Show instrument/sound choice
      setSampleChoiceModal({ sampleName: baseName, sampleUrl: data.sample.url })
    } catch {
      setSidebarHint('⚠ Upload failed — check connection')
      setTimeout(() => setSidebarHint(''), 3000)
    }
  }, [onRegisterSound, fetchUserSamples])

  // ── Apply sidebar item to a node (shared by drag-drop AND click-to-apply) ──
  const applySidebarItemToNode = useCallback((nodeId: string, item: SidebarItem & { soundCategory?: string }) => {
    if (item.dragType === 'effect' || item.dragType === 'lfo') {
      // Inject effect code AND re-parse all properties so knobs activate immediately
      let codeToSend: string | null = null
      setNodes(prev => {
        const idx = prev.findIndex(n => n.id === nodeId)
        if (idx === -1) return prev
        const node = prev[idx]
        const rawCode = node.code.replace(/\/\/ \[muted\] /g, '')
        const newCode = injectBefore(rawCode, item.payload)
        if (newCode === rawCode) return prev
        const updated = [...prev]
        // Always store clean code; rebuildFullCodeFromNodes handles muted wrapping
        updated[idx] = reparseNodeFromCode({ ...node, code: newCode })
        codeToSend = rebuildFullCodeFromNodes(updated, bpm, lastCodeRef.current)
        return updated
      })
      if (codeToSend !== null) sendToParent(codeToSend)
    } else if (item.dragType === 'sound') {
      // Route by soundCategory: drum-machines → bank, synths → .s(), samples → s() pattern
      if (item.soundCategory === 'drum-machine') {
        changeSoundBank(nodeId, item.payload)
      } else if (item.soundCategory === 'synth') {
        changeSoundInstrument(nodeId, item.payload)
      } else {
        changeSoundSource(nodeId, item.payload)
      }
    } else if (item.dragType === 'scale') {
      changeScale(nodeId, item.payload)
    } else if (item.dragType === 'chord' || item.dragType === 'pattern') {
      changePattern(nodeId, item.payload)
    }
  }, [changeSoundSource, changeSoundBank, changeSoundInstrument, changeScale, changePattern, bpm, sendToParent, rebuildFullCodeFromNodes])

  // ── Randomize pattern for a node ──
  const randomizePattern = useCallback((nodeId: string) => {
    let codeToSend: string | null = null
    setNodes(prev => {
      const node = prev.find(n => n.id === nodeId)
      if (!node) return prev
      const newPattern = randomPatternForType(node.type, node.pattern)
      const method = isSampleBased(node.type) ? 'drumPattern' : 'notePattern'
      const newCode = applyEffect(node.code, method, newPattern)
      if (newCode === node.code) return prev
      const updated = prev.map(n => n.id === nodeId ? reparseNodeFromCode({ ...n, code: newCode }) : n)
      codeToSend = rebuildFullCodeFromNodes(updated, bpm, lastCodeRef.current)
      return updated
    })
    if (codeToSend !== null) sendToParent(codeToSend)
  }, [bpm, sendToParent, rebuildFullCodeFromNodes])

  // ── Transpose pattern for a node (shift note numbers up/down) ──
  const transposePattern = useCallback((nodeId: string, direction: 1 | -1) => {
    let codeToSend: string | null = null
    setNodes(prev => {
      const node = prev.find(n => n.id === nodeId)
      if (!node || !node.pattern) return prev
      const pat = node.pattern
      // For note-number patterns (e.g. "0 2 4 7"), shift by 1
      // For named-note patterns (e.g. "<c4 e4 g4>"), shift by semitone
      let newPat: string
      if (/\b[a-g][sb]?\d\b/i.test(pat)) {
        // Named notes: shift octave or semitone
        const noteNames = ['c', 'cs', 'db', 'd', 'ds', 'eb', 'e', 'f', 'fs', 'gb', 'g', 'gs', 'ab', 'a', 'as', 'bb', 'b']
        newPat = pat.replace(/\b([a-g])([sb]?)(\d)\b/gi, (_match, n: string, acc: string, oct: string) => {
          const baseName = (n.toLowerCase() + acc.toLowerCase()).replace('s', 's').replace('b', 'b')
          let idx = noteNames.indexOf(baseName)
          if (idx === -1) {
            // Try simple sharp/flat mapping
            const sharpMap: Record<string, string> = { cs: 'cs', db: 'cs', ds: 'ds', eb: 'ds', fs: 'fs', gb: 'fs', gs: 'gs', ab: 'gs', as: 'as', bb: 'as' }
            idx = noteNames.indexOf(sharpMap[baseName] || baseName)
          }
          if (idx === -1) return _match
          let newIdx = idx + direction
          let newOct = parseInt(oct)
          if (newIdx >= 17) { newIdx -= 12; newOct++ }
          if (newIdx < 0) { newIdx += 12; newOct-- }
          // Map back to simple note name
          const simple = ['c', 'cs', 'db', 'd', 'ds', 'eb', 'e', 'f', 'fs', 'gb', 'g', 'gs', 'ab', 'a', 'as', 'bb', 'b']
          return (simple[newIdx] || n + acc) + newOct
        })
      } else {
        // Numeric pattern: shift all numbers
        newPat = pat.replace(/\b(\d+)\b/g, (_m, num: string) => {
          const v = parseInt(num) + direction
          return Math.max(0, v).toString()
        })
      }
      if (newPat === pat) return prev
      const method = isSampleBased(node.type) ? 'drumPattern' : 'notePattern'
      const newCode = applyEffect(node.code, method, newPat)
      if (newCode === node.code) return prev
      const updated = prev.map(n => n.id === nodeId ? reparseNodeFromCode({ ...n, code: newCode }) : n)
      codeToSend = rebuildFullCodeFromNodes(updated, bpm, lastCodeRef.current)
      return updated
    })
    if (codeToSend !== null) sendToParent(codeToSend)
  }, [bpm, sendToParent, rebuildFullCodeFromNodes])

  // ── Canvas interactions ──
  const handleMouseDown = useCallback((e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation()
    const rect = containerRef.current?.getBoundingClientRect(); if (!rect) return
    // Read from nodesRef to avoid recreating this callback on every node change
    const node = nodesRef.current.find(n => n.id === nodeId); if (!node) return
    const p = panRef.current
    setDragging({ id: nodeId, ox: (e.clientX - rect.left) / zoom - p.x - node.x, oy: (e.clientY - rect.top) / zoom - p.y - node.y })
    setSelectedNode(nodeId)
  }, [zoom])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (dragging) {
      const rect = containerRef.current?.getBoundingClientRect(); if (!rect) return
      const p = panRef.current
      setNodes(prev => prev.map(n => n.id === dragging.id ? {
        ...n,
        x: Math.round(((e.clientX - rect.left) / zoom - p.x - dragging.ox) / 20) * 20,
        y: Math.round(((e.clientY - rect.top) / zoom - p.y - dragging.oy) / 20) * 20,
      } : n))
    } else if (isPanning) {
      setPan({
        x: panStart.current.px + (e.clientX - panStart.current.x) / zoom,
        y: panStart.current.py + (e.clientY - panStart.current.y) / zoom,
      })
    }
  }, [dragging, isPanning, zoom])

  const handleMouseUp = useCallback(() => {
    setDragging(null); setIsPanning(false)
  }, [])

  const handleBgMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.target === containerRef.current || (e.target as HTMLElement).classList.contains('node-grid-bg')) {
      setIsPanning(true)
      const p = panRef.current
      panStart.current = { x: e.clientX, y: e.clientY, px: p.x, py: p.y }
      setSelectedNode(null)
    }
  }, [])

  // ── Touch handlers for node drag ──
  const handleNodeTouchStart = useCallback((e: React.TouchEvent, nodeId: string) => {
    if (e.touches.length !== 1) return
    e.stopPropagation()
    const touch = e.touches[0]
    const rect = containerRef.current?.getBoundingClientRect(); if (!rect) return
    const node = nodesRef.current.find(n => n.id === nodeId); if (!node) return
    const p = panRef.current
    const ox = (touch.clientX - rect.left) / zoomRef.current - p.x - node.x
    const oy = (touch.clientY - rect.top) / zoomRef.current - p.y - node.y
    touchDragRef.current = { id: nodeId, ox, oy }
    setDragging({ id: nodeId, ox, oy })
    setSelectedNode(nodeId)
  }, [])

  // ── Touch handler for canvas background pan ──
  const handleBgTouchStart = useCallback((e: React.TouchEvent) => {
    const target = e.target as HTMLElement
    const isBg = target === containerRef.current || target.classList.contains('node-grid-bg')
    if (!isBg) return
    if (e.touches.length === 2) {
      // Pinch to zoom
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      pinchRef.current = { active: true, startDist: Math.hypot(dx, dy), startZoom: zoomRef.current }
      touchPanRef.current.active = false
      return
    }
    if (e.touches.length !== 1) return
    const touch = e.touches[0]
    const p = panRef.current
    touchPanRef.current = { active: true, startX: touch.clientX, startY: touch.clientY, px: p.x, py: p.y }
    setIsPanning(true)
    setSelectedNode(null)
  }, [])

  // Register canvas wheel + touch listeners imperatively with { passive: false } to allow preventDefault
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      setZoom(z => Math.max(0.25, Math.min(2, z + e.deltaY * -0.001)))
    }
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault() // prevent iOS scroll/bounce/zoom
      if (e.touches.length === 2 && pinchRef.current.active) {
        // Pinch-to-zoom
        const dx = e.touches[0].clientX - e.touches[1].clientX
        const dy = e.touches[0].clientY - e.touches[1].clientY
        const dist = Math.hypot(dx, dy)
        const scale = dist / pinchRef.current.startDist
        setZoom(Math.max(0.25, Math.min(2, pinchRef.current.startZoom * scale)))
        return
      }
      if (e.touches.length !== 1) return
      const touch = e.touches[0]
      const rect = el.getBoundingClientRect()
      const drag = touchDragRef.current
      if (drag) {
        const p = panRef.current
        const z = zoomRef.current
        setNodes(prev => prev.map(n => n.id === drag.id ? {
          ...n,
          x: Math.round(((touch.clientX - rect.left) / z - p.x - drag.ox) / 20) * 20,
          y: Math.round(((touch.clientY - rect.top) / z - p.y - drag.oy) / 20) * 20,
        } : n))
      } else if (touchPanRef.current.active) {
        const tp = touchPanRef.current
        const z = zoomRef.current
        setPan({
          x: tp.px + (touch.clientX - tp.startX) / z,
          y: tp.py + (touch.clientY - tp.startY) / z,
        })
      }
    }
    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length === 0) {
        touchDragRef.current = null
        touchPanRef.current.active = false
        pinchRef.current.active = false
        setDragging(null)
        setIsPanning(false)
      } else if (e.touches.length === 1 && pinchRef.current.active) {
        // Went from 2 fingers to 1 — transition to pan
        pinchRef.current.active = false
        const touch = e.touches[0]
        const p = panRef.current
        touchPanRef.current = { active: true, startX: touch.clientX, startY: touch.clientY, px: p.x, py: p.y }
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd, { passive: false })
    el.addEventListener('touchcancel', onTouchEnd, { passive: false })
    return () => {
      el.removeEventListener('wheel', onWheel)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
      el.removeEventListener('touchcancel', onTouchEnd)
    }
  }, [])



  // ── Current global scale (detected from majority of nodes) ──
  const globalScale = useMemo(() => {
    const melodicNodes = nodes.filter(n => !isSampleBased(n.type))
    if (melodicNodes.length === 0) return 'C4:major'
    const counts = new Map<string, number>()
    melodicNodes.forEach(n => { const s = n.scale || 'C4:major'; counts.set(s, (counts.get(s) || 0) + 1) })
    let best = 'C4:major', bestCount = 0
    counts.forEach((c, s) => { if (c > bestCount) { best = s; bestCount = c } })
    return best
  }, [nodes])

  // Key-aware chord progressions based on global scale
  const { progressions: keyProgressions } = useKeyChords(globalScale)
  const keyChordOptions = useMemo(() =>
    keyProgressions.map(p => ({ label: `${p.label} (${p.chordLabels})`, value: p.value })),
    [keyProgressions]
  )
  // Merge key-aware bass patterns from the current key
  const keyBassOptions = useMemo(() => {
    const triads = buildDiatonicChords(globalScale, 2)
    if (triads.length < 7) return BASS_PATTERNS
    const rootNote = triads[0]?.notes?.match(/\w+\d/)?.[0] || 'c2'
    const fifthNote = triads[4]?.notes?.match(/\w+\d/)?.[0] || 'g1'
    const fourthNote = triads[3]?.notes?.match(/\w+\d/)?.[0] || 'f1'
    return [
      ...BASS_PATTERNS,
      { label: `Root (${rootNote})`, value: `<${rootNote} ~ ${rootNote} ~>` },
      { label: `Root-Fifth`, value: `<${rootNote} ${fifthNote} ${rootNote} ${fifthNote}>` },
      { label: `Root-Fourth-Fifth`, value: `<${rootNote} ${fourthNote} ${fifthNote} ${rootNote}>` },
    ]
  }, [globalScale])

  // Key-aware melody patterns: mix scale-degree patterns with key-specific note patterns
  const keyMelodyOptions = useMemo(() => {
    const triads = buildDiatonicChords(globalScale, 4)
    if (triads.length < 7) return MELODY_PATTERNS
    // Extract individual notes from triads for key-specific patterns
    const noteNames = triads.map(t => t.notes?.match(/\w+\d/)?.[0]).filter(Boolean) as string[]
    if (noteNames.length < 7) return MELODY_PATTERNS
    const keyLabel = globalScale.replace(/\d:/, ' ').replace('minor', 'min').replace('major', 'maj')
    return [
      ...MELODY_PATTERNS,
      { label: `${keyLabel} 1-3-5`, value: `${noteNames[0]} ${noteNames[2]} ${noteNames[4]} ~` },
      { label: `${keyLabel} Scale Up`, value: noteNames.slice(0, 7).join(' ') },
      { label: `${keyLabel} Triad Arp`, value: `<${noteNames[0]} ${noteNames[2]} ${noteNames[4]}> <${noteNames[1]} ${noteNames[3]} ${noteNames[5]}> <${noteNames[2]} ${noteNames[4]} ${noteNames[6]}> <${noteNames[0]} ${noteNames[2]} ${noteNames[4]}>` },
      { label: `${keyLabel} Waltz`, value: `${noteNames[0]} ${noteNames[2]} ${noteNames[4]} ${noteNames[2]} ${noteNames[4]} ${noteNames[2]}` },
    ]
  }, [globalScale])

  const NODE_W = 300

  // ════════════════════════════════════════════════════════════
  //  RENDER
  // ════════════════════════════════════════════════════════════

  return (
    <div className={`flex flex-col h-full select-none ${isFullscreen ? (headerless ? 'fixed left-0 right-0 bottom-0 z-50' : 'fixed inset-0 z-50') : ''}`} style={{ background: HW.bg, overflow: 'visible', ...(isFullscreen && headerless ? { top: 36 } : {}) }}>

      {/* ══════ TOP BAR (hidden in headerless mode) ══════ */}
      {!headerless && (
      <div className="flex items-center justify-between px-4 py-2 shrink-0"
        style={{ background: `linear-gradient(180deg, ${HW.surfaceAlt} 0%, ${HW.surface} 100%)`, borderBottom: `1px solid ${HW.border}` }}>
        {/* Left */}
        <div className="flex items-center gap-3">
          <button onClick={() => setSidebarOpen(p => !p)}
            className="w-6 h-6 flex items-center justify-center rounded cursor-pointer"
            style={{ color: sidebarOpen ? '#22d3ee' : HW.textDim, background: sidebarOpen ? 'rgba(34,211,238,0.08)' : HW.raised, border: `1px solid ${sidebarOpen ? 'rgba(34,211,238,0.15)' : HW.border}` }}
            title="Toggle library sidebar">
            {sidebarOpen ? <ChevronLeft size={11} /> : <ChevronRight size={11} />}
          </button>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: isPlaying ? '#22d3ee' : HW.textDim, boxShadow: isPlaying ? '0 0 8px #22d3ee50' : 'none' }} />
            <span className="text-[10px] font-bold tracking-[0.2em] uppercase" style={{ color: HW.textBright }}>NODE RACK</span>
          </div>
          <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ color: HW.textDim, background: HW.raised }}>{nodes.length} CH</span>
          {/* Loop length indicator — max bars across all active nodes */}
          {(() => {
            const maxBars = nodes.filter(n => !n.muted && n.pattern).reduce((max, n) => Math.max(max, getPatternBarCount(n.pattern, n.code)), 1)
            return (
              <span className="text-[9px] px-1.5 py-0.5 rounded font-bold tabular-nums" style={{
                color: maxBars <= 1 ? HW.textDim : '#a78bfa',
                background: maxBars <= 1 ? HW.raised : 'rgba(167,139,250,0.08)',
                border: maxBars > 1 ? '1px solid rgba(167,139,250,0.15)' : `1px solid ${HW.border}`,
              }}>⟳ {maxBars} bar{maxBars !== 1 ? 's' : ''}</span>
            )
          })()}
        </div>

        {/* Center: BPM + Scale */}
        <div className="flex items-center gap-3">
          {/* BPM */}
          <div className="flex items-center gap-2 px-4 py-1 rounded-lg" style={{ background: HW.surface, border: `1px solid ${HW.border}` }}>
            <span className="text-[8px] font-bold tracking-[0.15em] uppercase" style={{ color: HW.textDim }}>TEMPO</span>
            <RotaryKnob value={bpm || 72} min={30} max={200} step={1} onChange={handleBpmChange} onCommit={() => {}}
              color="#22d3ee" label="" size={44} defaultValue={72} />
            <div className="flex flex-col items-center">
              <span className="text-[16px] font-bold tabular-nums font-mono" style={{ color: '#22d3ee', textShadow: '0 0 12px #22d3ee30' }}>
                {bpm || 72}
              </span>
              <span className="text-[7px] font-bold tracking-[0.2em] uppercase" style={{ color: HW.textDim }}>BPM</span>
            </div>
          </div>

          {/* Global Scale */}
          <div className="flex items-center gap-2 px-3 py-1 rounded-lg" style={{ background: HW.surface, border: `1px solid ${HW.border}` }}>
            <span className="text-[7px] font-bold tracking-[0.12em] uppercase" style={{ color: HW.textDim }}>KEY</span>
            <HardwareSelect label="" value={globalScale} options={SCALE_PRESETS}
              onChange={handleGlobalScaleChange} color="#a78bfa" />
          </div>
        </div>

        {/* Right */}
        <div className="flex items-center gap-2">
          {/* Collapse/Expand All toggle */}
          <button onClick={toggleAllCollapsed}
            className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-[9px] font-bold tracking-wider transition-all cursor-pointer"
            style={{
              background: allCollapsed ? 'rgba(167,139,250,0.08)' : HW.raised,
              border: `1px solid ${allCollapsed ? 'rgba(167,139,250,0.2)' : HW.border}`,
              color: allCollapsed ? '#a78bfa' : HW.textDim,
            }}
            title={allCollapsed ? 'Expand all nodes' : 'Collapse all nodes'}>
            {allCollapsed ? <Columns size={10} /> : <LayoutList size={10} />}
            <span>{allCollapsed ? 'EXPAND' : 'COLLAPSE'}</span>
          </button>
          {/* Custom Sounds */}
          <button onClick={() => setSoundUploaderOpen(true)}
            className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-[9px] font-bold tracking-wider transition-all cursor-pointer"
            style={{
              background: HW.raised,
              border: `1px solid ${HW.border}`,
              color: HW.textDim,
            }}
            title="Upload custom samples">
            <Upload size={10} /> SAMPLES
          </button>

          {/* Timeline toggle */}
          <button onClick={() => setTimelineOpen(p => !p)}
            className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-[9px] font-bold tracking-wider transition-all cursor-pointer"
            style={{
              background: timelineOpen ? 'rgba(34,211,238,0.08)' : HW.raised,
              border: `1px solid ${timelineOpen ? 'rgba(34,211,238,0.2)' : HW.border}`,
              color: timelineOpen ? '#22d3ee' : HW.textDim,
            }}
            title="Toggle bottom timeline">
            ▤ TIMELINE
          </button>
          <div className="relative">
            <button onClick={() => setShowAddMenu(p => !p)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold tracking-wider transition-all cursor-pointer"
              style={{ background: 'rgba(34,211,238,0.08)', border: '1px solid rgba(34,211,238,0.15)', color: '#22d3ee' }}>
              <Plus size={11} /> ADD
            </button>
            {showAddMenu && (
              <div className="absolute right-0 top-full mt-1 z-50 min-w-[220px] rounded-xl shadow-2xl overflow-hidden"
                style={{ background: '#0e0e11', border: `1px solid ${HW.borderLight}` }}>
                {/* Section: Sound Sources */}
                <div className="px-3 pt-2 pb-1">
                  <span className="text-[7px] font-bold tracking-[0.2em] uppercase" style={{ color: HW.textDim }}>SOUND SOURCES</span>
                </div>
                {([
                  { type: 'drums' as const, desc: '808 kit — kick, snare, hats' },
                  { type: 'bass' as const, desc: 'Sub bass with lowpass filter' },
                  { type: 'melody' as const, desc: 'Piano melody with reverb' },
                  { type: 'chords' as const, desc: 'Chord progression — epiano' },
                  { type: 'pad' as const, desc: 'Slow evolving atmosphere' },
                  { type: 'vocal' as const, desc: 'Choir / vocal texture' },
                ]).map(({ type: t, desc }) => (
                  <button key={t} onClick={() => addNode(t)}
                    className="w-full flex items-center gap-2.5 px-3 py-1.5 text-[11px] transition-colors cursor-pointer"
                    style={{ color: TYPE_COLORS[t] }}
                    onMouseEnter={e => { (e.currentTarget).style.background = `${TYPE_COLORS[t]}10` }}
                    onMouseLeave={e => { (e.currentTarget).style.background = 'transparent' }}>
                    <span className="text-[12px] w-5 text-center">{TYPE_ICONS[t]}</span>
                    <div className="flex-1 text-left">
                      <span className="capitalize font-medium">{t}</span>
                      <span className="text-[8px] ml-1.5 opacity-50">{desc}</span>
                    </div>
                  </button>
                ))}
                {/* Section: Utility */}
                <div className="px-3 pt-2 pb-1" style={{ borderTop: `1px solid ${HW.border}` }}>
                  <span className="text-[7px] font-bold tracking-[0.2em] uppercase" style={{ color: HW.textDim }}>UTILITY</span>
                </div>
                <button onClick={() => addNode('fx')}
                  className="w-full flex items-center gap-2.5 px-3 py-1.5 text-[11px] transition-colors cursor-pointer"
                  style={{ color: TYPE_COLORS.fx }}
                  onMouseEnter={e => { (e.currentTarget).style.background = `${TYPE_COLORS.fx}10` }}
                  onMouseLeave={e => { (e.currentTarget).style.background = 'transparent' }}>
                  <span className="text-[12px] w-5 text-center">{TYPE_ICONS.fx}</span>
                  <div className="flex-1 text-left">
                    <span className="capitalize font-medium">FX / Texture</span>
                    <span className="text-[8px] ml-1.5 opacity-50">Delay, reverb, glitch layer</span>
                  </div>
                </button>
                {/* Section: My Samples */}
                {userSamples.length > 0 && (
                  <>
                    <div className="px-3 pt-2 pb-1" style={{ borderTop: `1px solid ${HW.border}` }}>
                      <span className="text-[7px] font-bold tracking-[0.2em] uppercase" style={{ color: HW.textDim }}>MY SAMPLES</span>
                    </div>
                    {userSamples.slice(0, 5).map(s => (
                      <button key={s.name} onClick={() => { setShowAddMenu(false); setSampleChoiceModal({ sampleName: s.name, sampleUrl: s.url }) }}
                        className="w-full flex items-center gap-2.5 px-3 py-1.5 text-[11px] transition-colors cursor-pointer"
                        style={{ color: '#22d3ee' }}
                        onMouseEnter={e => { (e.currentTarget).style.background = 'rgba(34,211,238,0.1)' }}
                        onMouseLeave={e => { (e.currentTarget).style.background = 'transparent' }}>
                        <span className="text-[12px] w-5 text-center">🔊</span>
                        <div className="flex-1 text-left">
                          <span className="font-mono font-medium">{s.name}</span>
                          <span className="text-[8px] ml-1.5 opacity-50">Add as new node</span>
                        </div>
                      </button>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
          <div style={{ width: 1, height: 16, background: HW.border }} />
          <div className="flex items-center gap-1">
            <button onClick={() => setZoom(z => Math.max(0.25, z - 0.15))}
              className="w-6 h-6 flex items-center justify-center text-[11px] rounded cursor-pointer"
              style={{ color: HW.text, background: HW.raised, border: `1px solid ${HW.border}` }}>−</button>
            <span className="text-[8px] w-8 text-center font-mono tabular-nums" style={{ color: HW.textDim }}>{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom(z => Math.min(2, z + 0.15))}
              className="w-6 h-6 flex items-center justify-center text-[11px] rounded cursor-pointer"
              style={{ color: HW.text, background: HW.raised, border: `1px solid ${HW.border}` }}>+</button>
            <button onClick={() => { setZoom(0.85); setPan({ x: 0, y: 0 }) }}
              className="px-2 h-6 flex items-center justify-center text-[8px] font-bold tracking-wider uppercase rounded cursor-pointer"
              style={{ color: HW.textDim, background: HW.raised, border: `1px solid ${HW.border}` }}>FIT</button>
            <button onClick={() => setIsFullscreen(p => !p)}
              className="w-6 h-6 flex items-center justify-center rounded cursor-pointer"
              style={{ color: isFullscreen ? '#22d3ee' : HW.textDim, background: isFullscreen ? 'rgba(34,211,238,0.08)' : HW.raised, border: `1px solid ${isFullscreen ? 'rgba(34,211,238,0.15)' : HW.border}` }}
              title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen node grid'}>
              {isFullscreen ? <Minimize2 size={10} /> : <Maximize2 size={10} />}
            </button>
          </div>
        </div>
      </div>
      )}

      {/* ══════ MAIN AREA: SIDEBAR + CANVAS ══════ */}
      <div className="flex-1 flex min-h-0">

      {/* ══════ SIDEBAR (Sounds & Patterns) ══════ */}
      {sidebarOpen && (() => {
        const selNodeObj = selectedNode ? nodes.find(n => n.id === selectedNode) : null
        const relevantIds = selNodeObj ? NODE_TYPE_SIDEBAR_MAP[selNodeObj.type] || NODE_TYPE_SIDEBAR_MAP.other : null
        const relevantCategories = relevantIds ? SIDEBAR_SOUNDS.filter(c => relevantIds.has(c.id)) : []
        return (
        <div className="flex flex-col shrink-0 border-r overflow-hidden" style={{
          width: 220, background: HW.surface, borderColor: HW.border,
        }}>
          {/* Header */}
          <div className="px-3 py-1.5 shrink-0 flex items-center gap-1.5" style={{ borderBottom: `1px solid ${HW.border}` }}>
            <span className="text-[10px]">{selNodeObj ? TYPE_ICONS[selNodeObj.type] || '🎸' : '🎸'}</span>
            <span className="text-[9px] font-bold tracking-[0.15em] uppercase" style={{ color: selNodeObj ? (TYPE_COLORS[selNodeObj.type] || HW.textBright) : HW.textBright }}>
              {selNodeObj ? `${selNodeObj.name || selNodeObj.type.toUpperCase()} SOUNDS` : 'SOUNDS'}
            </span>
          </div>

          {!selNodeObj ? (
            /* No node selected — show prompt */
            <div className="flex-1 flex flex-col items-center justify-center gap-3 px-4 text-center">
              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'rgba(34,211,238,0.08)', border: '1px solid rgba(34,211,238,0.15)' }}>
                <span className="text-lg">👆</span>
              </div>
              <div>
                <div className="text-[10px] font-bold" style={{ color: HW.textBright }}>Select a node</div>
                <div className="text-[8px] mt-1" style={{ color: HW.textDim }}>Click any node on the canvas to see sounds, patterns & presets relevant to that instrument type</div>
              </div>
            </div>
          ) : (
            /* Node selected — show filtered categories */
            <>
          {/* Search */}
          <div className="px-2 py-2 shrink-0" style={{ borderBottom: `1px solid ${HW.border}` }}>
            <input
              type="text" value={sidebarSearch} onChange={e => setSidebarSearch(e.target.value)}
              placeholder={`Search ${selNodeObj.type} sounds...`}
              className="w-full px-2 py-1 rounded text-[10px] outline-none"
              style={{ background: HW.raised, border: `1px solid ${HW.border}`, color: HW.textBright }}
              onClick={e => e.stopPropagation()}
            />
          </div>
          {/* Categories */}
          <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: `${HW.raisedLight} transparent` }}>
            {/* ── MY SAMPLES (user uploads) ── */}
            {userSamples.length > 0 && (() => {
              const q = sidebarSearch.toLowerCase()
              const filteredSamples = q
                ? userSamples.filter(s => s.name.includes(q))
                : userSamples
              if (q && filteredSamples.length === 0) return null
              const isOpen = sidebarCategory === '_my_samples' || !!q
              return (
                <div>
                  <button
                    onClick={() => setSidebarCategory(p => p === '_my_samples' ? null : '_my_samples')}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-[10px] font-bold tracking-wider uppercase cursor-pointer transition-colors"
                    style={{ color: isOpen ? '#22d3ee' : HW.textDim, background: isOpen ? 'rgba(34,211,238,0.08)' : 'transparent' }}
                    onMouseEnter={e => { if (!isOpen) e.currentTarget.style.background = 'rgba(34,211,238,0.05)' }}
                    onMouseLeave={e => { if (!isOpen) e.currentTarget.style.background = 'transparent' }}
                  >
                    <span className="text-[11px]">🎤</span>
                    <span className="flex-1 text-left">MY SAMPLES</span>
                    <span className="text-[8px]" style={{ color: HW.textDim }}>{userSamples.length}</span>
                    <ChevronDown size={10} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} style={{ color: HW.textDim }} />
                  </button>
                  {isOpen && (
                    <div className="px-1.5 pb-1">
                      {filteredSamples.map(s => (
                        <div key={s.name}
                          draggable
                          onDragStart={e => {
                            e.dataTransfer.setData('application/x-sidebar-item', JSON.stringify({
                              id: `sample_${s.name}`, label: s.name, desc: `Custom sample: ${s.name}`,
                              icon: '🔊', color: '#22d3ee', dragType: 'sound', payload: s.name,
                            }))
                            e.dataTransfer.effectAllowed = 'copy'
                          }}
                          onClick={() => {
                            if (selectedNode) {
                              // Apply sample directly to selected node's sound source
                              changeSoundSource(selectedNode, s.name)
                            } else {
                              setSidebarHint('⚠ Select a node first — click any node on canvas')
                              setTimeout(() => setSidebarHint(''), 2500)
                            }
                          }}
                          className="flex items-center gap-2 px-2 py-1 rounded text-[9px] transition-colors group cursor-pointer"
                          style={{ color: HW.text }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(34,211,238,0.1)'; e.currentTarget.style.color = '#22d3ee' }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = HW.text }}
                          title={`Click to use s("${s.name}") on selected node`}
                        >
                          <span className="text-[10px] shrink-0 w-4 text-center">🔊</span>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium font-mono truncate">{s.name}</div>
                            <div className="text-[7px] truncate" style={{ color: HW.textDim }}>s(&quot;{s.name}&quot;)</div>
                          </div>
                          <span className="text-[7px] opacity-0 group-hover:opacity-60 shrink-0">click✓</span>
                        </div>
                      ))}
                      {/* + Add as new node */}
                      {filteredSamples.map(s => (
                        <button key={`add_${s.name}`}
                          onClick={() => setSampleChoiceModal({ sampleName: s.name, sampleUrl: s.url })}
                          className="w-full flex items-center gap-2 px-2 py-1 mt-0.5 rounded text-[8px] transition-colors cursor-pointer"
                          style={{ color: HW.textDim }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(34,211,238,0.08)'; e.currentTarget.style.color = '#22d3ee' }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = HW.textDim }}
                        >
                          <Plus size={9} /> Add &quot;{s.name}&quot; as new node
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )
            })()}
            {relevantCategories.map(cat => {
              const q = sidebarSearch.toLowerCase()
              const filteredItems = q
                ? cat.items.filter(item => item.label.toLowerCase().includes(q) || item.desc.toLowerCase().includes(q))
                : cat.items
              if (q && filteredItems.length === 0) return null
              const isOpen = sidebarCategory === cat.id || !!q
              return (
                <div key={cat.id}>
                  <button
                    onClick={() => setSidebarCategory(p => p === cat.id ? null : cat.id)}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-[10px] font-bold tracking-wider uppercase cursor-pointer transition-colors"
                    style={{ color: isOpen ? cat.color : HW.textDim, background: isOpen ? `${cat.color}08` : 'transparent' }}
                    onMouseEnter={e => { if (!isOpen) e.currentTarget.style.background = `${cat.color}05` }}
                    onMouseLeave={e => { if (!isOpen) e.currentTarget.style.background = 'transparent' }}
                  >
                    <span className="text-[11px]">{cat.icon}</span>
                    <span className="flex-1 text-left">{cat.label}</span>
                    <span className="text-[8px]" style={{ color: HW.textDim }}>{cat.items.length}</span>
                    <ChevronDown size={10} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} style={{ color: HW.textDim }} />
                  </button>
                  {isOpen && (
                    <div className="px-1.5 pb-1">
                      {filteredItems.map(item => (
                        <div key={item.id}
                          draggable
                          onDragStart={e => {
                            e.dataTransfer.setData('application/x-sidebar-item', JSON.stringify(item))
                            e.dataTransfer.effectAllowed = 'copy'
                          }}
                          onClick={() => applySidebarItemToNode(selectedNode!, item)}
                          className="flex items-center gap-2 px-2 py-1 rounded text-[9px] transition-colors group cursor-pointer"
                          style={{ color: HW.text }}
                          onMouseEnter={e => { e.currentTarget.style.background = `${item.color}10`; e.currentTarget.style.color = item.color }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = HW.text }}
                          title={`Click to apply: ${item.desc}`}
                        >
                          <span className="text-[10px] shrink-0 w-4 text-center">{item.icon}</span>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{item.label}</div>
                            <div className="text-[7px] truncate" style={{ color: HW.textDim }}>{item.desc}</div>
                          </div>
                          <span className="text-[7px] opacity-0 group-hover:opacity-60 shrink-0">click✓</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
            </>
          )}
          {/* Sidebar footer hint */}
          <div className="px-3 py-1.5 shrink-0 text-[7px]" style={{ color: HW.textDim, borderTop: `1px solid ${HW.border}` }}>
            {sidebarHint
              ? <span style={{ color: '#f59e0b' }} className="animate-pulse">{sidebarHint}</span>
              : selNodeObj
                ? <span style={{ color: TYPE_COLORS[selNodeObj.type] || '#22d3ee' }}>● {selNodeObj.type.toUpperCase()} — click items to apply</span>
                : 'Select a node to see its sounds & patterns'
            }
          </div>
        </div>
        )
      })()}

      {/* ══════ CANVAS ══════ */}
      <div ref={containerRef}
        className="flex-1 relative cursor-grab active:cursor-grabbing"
        style={{ overflow: 'hidden', touchAction: 'none' }}
        onMouseDown={handleBgMouseDown} onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}
        onTouchStart={handleBgTouchStart}
        onDragOver={e => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy' } }}
        onDrop={handleCanvasDrop}>

        {/* Dot grid */}
        <div className="node-grid-bg absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle, ${HW.surfaceAlt} 1px, transparent 1px)`,
          backgroundSize: `${20 * zoom}px ${20 * zoom}px`,
          backgroundPosition: `${pan.x * zoom}px ${pan.y * zoom}px`,
        }} />



        {/* ══════ MASTER VISUALIZER (pinned bottom-left of canvas) ══════ */}
        <div className="absolute z-[5] pointer-events-auto" style={{ bottom: 12, left: 12 }}>
          <MasterVisualizer analyserNode={analyserNode} isPlaying={isPlaying} />
        </div>

        {/* ══════ GLASS CODE PANEL (fullscreen only) ══════ */}
        {isFullscreen && headerless && (
          <div
            className="absolute z-[15] pointer-events-auto group cursor-pointer"
            style={{ bottom: 16, right: 16, width: 280, maxHeight: 120 }}
            onClick={() => setIsFullscreen(false)}
            title="Click to expand code editor (split view)"
          >
            <div className="relative rounded-xl overflow-hidden border border-white/[0.08] shadow-2xl"
              style={{ backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', background: 'rgba(10,10,12,0.55)' }}>
              {/* Glass header */}
              <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/[0.06]">
                <div className="flex items-center gap-2">
                  <div className={`w-1.5 h-1.5 rounded-full ${codeGenerating ? 'bg-amber-400 animate-pulse' : 'bg-cyan-400/60 animate-pulse'}`} />
                  <span className={`text-[9px] font-bold tracking-[0.15em] uppercase ${codeGenerating ? 'text-amber-400/80' : 'text-cyan-400/60'}`}>
                    {codeGenerating ? 'generating your code…' : 'CODE'}
                  </span>
                </div>
                <span className="text-[8px] text-white/20 group-hover:text-cyan-400/50 transition-colors">click to expand ↗</span>
              </div>
              {/* Code preview (blurred) */}
              <div className="px-3 py-2 max-h-[72px] overflow-hidden relative">
                <pre className="text-[8px] leading-[1.4] font-mono text-white/25 group-hover:text-white/35 transition-colors whitespace-pre-wrap break-all">
                  {code.slice(0, 400)}{code.length > 400 ? '…' : ''}
                </pre>
                <div className="absolute inset-x-0 bottom-0 h-6" style={{ background: 'linear-gradient(transparent, rgba(10,10,12,0.8))' }} />
              </div>
            </div>
          </div>
        )}

        {/* ══════ NODES ══════ */}
        {nodes.map((node, nodeIndex) => {
          const color = TYPE_COLORS[node.type]
          const isSel = selectedNode === node.id
          const isActive = isPlaying && !node.muted
          const basePresets = SOUND_PRESETS[node.type] || SOUND_PRESETS.other
          // Append user samples to SND dropdown for sample-based nodes
          const presets = isSampleBased(node.type) && userSamples.length > 0
            ? [...basePresets, ...userSamples.map(s => ({ label: `🔊 ${s.name}`, value: s.name }))]
            : basePresets
          const isMelodic = !isSampleBased(node.type)

          return (
            <div key={node.id} className="absolute select-none" style={{
              left: `${(node.x + pan.x) * zoom}px`,
              top: `${(node.y + pan.y) * zoom}px`,
              width: NODE_W,
              transform: `scale(${zoom})`,
              transformOrigin: 'top left',
              zIndex: isSel ? 20 : dragging?.id === node.id ? 30 : 10,
            }}>
              <div className={`relative ${dropTarget === node.id ? 'ring-2 ring-cyan-400/50 ring-offset-2 ring-offset-transparent rounded-xl' : ''}`}
                onDragOver={handleDragOver}
                onDragEnter={e => handleNodeDragEnter(e, node.id)}
                onDragLeave={handleNodeDragLeave}
                onDrop={e => handleDrop(e, node.id)}>
                {/* Node body — NO overflow:hidden so dropdowns can escape */}
                <div className={`rounded-xl transition-all duration-200 ${
                  node.muted ? 'opacity-20 grayscale' : ''
                }`} style={{
                  background: `linear-gradient(180deg, ${HW.surfaceAlt} 0%, ${HW.surface} 100%)`,
                  border: `1px solid ${isSel ? `${color}50` : isActive ? `${color}25` : HW.border}`,
                  boxShadow: isSel ? `0 0 30px ${color}15, 0 8px 32px rgba(0,0,0,0.6), inset 0 1px 0 ${HW.borderLight}`
                    : `0 2px 12px rgba(0,0,0,0.4), inset 0 1px 0 ${HW.borderLight}`,
                }}>

                  {/* ── HEADER ── */}
                  {/* Color accent bar (Logic Pro style track color strip) */}
                  <div className="rounded-t-xl" style={{ height: 3, background: `linear-gradient(90deg, ${color}, ${color}40)` }} />

                  {/* Row 1: Identity — draggable */}
                  <div className="flex items-center gap-2 px-3 py-1.5 cursor-grab active:cursor-grabbing"
                    onMouseDown={e => handleMouseDown(e, node.id)}
                    onTouchStart={e => handleNodeTouchStart(e, node.id)}
                    onContextMenu={e => { e.preventDefault(); e.stopPropagation(); toggleAdditiveSolo(node.id) }}
                    style={{ touchAction: 'none' }}>
                    <div className="w-5 h-5 rounded flex items-center justify-center text-[10px] shrink-0"
                      style={{ background: `${color}18`, color, boxShadow: isActive ? `0 0 8px ${color}30` : 'none' }}>
                      {TYPE_ICONS[node.type]}
                    </div>
                    <span className="text-[11px] font-bold truncate flex-1 tracking-wide" style={{ color }}>{node.name || 'Untitled'}</span>
                    <span className="text-[7px] font-bold tracking-[0.12em] uppercase shrink-0 px-1.5 py-0.5 rounded"
                      style={{ color: `${color}60`, background: `${color}08` }}>
                      {node.type}
                    </span>
                  </div>

                  {/* Row 2: Control strip — tools | transport | collapse */}
                  <div className="flex items-center gap-[3px] px-2 py-[3px]" style={{ background: `${HW.bg}50`, borderBottom: `1px solid ${HW.border}` }}>
                    {/* ── Editor tools ── */}
                    {isMelodic ? (
                      <button
                        onMouseDown={e => e.stopPropagation()}
                        onClick={e => { e.stopPropagation(); setPianoRollOpen({ nodeId: node.id }); setDrumSequencerOpen(null) }}
                        className="h-5 px-1.5 flex items-center gap-1 rounded text-[7px] font-bold cursor-pointer transition-all"
                        style={{
                          background: pianoRollOpen?.nodeId === node.id ? 'rgba(167,139,250,0.15)' : 'transparent',
                          color: pianoRollOpen?.nodeId === node.id ? '#a78bfa' : `${color}50`,
                          border: `1px solid ${pianoRollOpen?.nodeId === node.id ? 'rgba(167,139,250,0.3)' : HW.border}`,
                        }}
                        title="Open Piano Roll">
                        🎹 <span className="tracking-wider">KEYS</span>
                      </button>
                    ) : (
                      <button
                        onMouseDown={e => e.stopPropagation()}
                        onClick={e => { e.stopPropagation(); setDrumSequencerOpen({ nodeId: node.id }); setPianoRollOpen(null) }}
                        className="h-5 px-1.5 flex items-center gap-1 rounded text-[7px] font-bold cursor-pointer transition-all"
                        style={{
                          background: drumSequencerOpen?.nodeId === node.id ? 'rgba(245,158,11,0.15)' : 'transparent',
                          color: drumSequencerOpen?.nodeId === node.id ? '#f59e0b' : `${color}50`,
                          border: `1px solid ${drumSequencerOpen?.nodeId === node.id ? 'rgba(245,158,11,0.3)' : HW.border}`,
                        }}
                        title="Open Drum Sequencer">
                        🥁 <span className="tracking-wider">SEQ</span>
                      </button>
                    )}
                    {node.soundSource && (
                      <button
                        onMouseDown={e => e.stopPropagation()}
                        onClick={e => { e.stopPropagation(); setSoundSlicerOpen({ nodeId: node.id }) }}
                        className="h-5 px-1.5 flex items-center gap-1 rounded text-[7px] font-bold cursor-pointer transition-all"
                        style={{
                          background: soundSlicerOpen?.nodeId === node.id ? 'rgba(34,211,238,0.15)' : 'transparent',
                          color: soundSlicerOpen?.nodeId === node.id ? '#22d3ee' : `${color}50`,
                          border: `1px solid ${soundSlicerOpen?.nodeId === node.id ? 'rgba(34,211,238,0.3)' : HW.border}`,
                        }}
                        title="Sound Slicer">
                        ✂ <span className="tracking-wider">SLICE</span>
                      </button>
                    )}
                    {/* ── Spacer ── */}
                    <div className="flex-1" />
                    {/* ── Transport: Solo + Mute ── */}
                    <button
                      onMouseDown={e => e.stopPropagation()}
                      onClick={e => { e.stopPropagation(); toggleSolo(node.id) }}
                      className="w-5 h-5 flex items-center justify-center rounded text-[8px] font-black cursor-pointer transition-all"
                      style={{
                        background: node.solo ? 'rgba(245,158,11,0.2)' : 'transparent',
                        color: node.solo ? '#f59e0b' : HW.textDim,
                        border: `1px solid ${node.solo ? 'rgba(245,158,11,0.3)' : HW.border}`,
                      }}
                      title="Solo">S</button>
                    <button
                      onMouseDown={e => e.stopPropagation()}
                      onClick={e => { e.stopPropagation(); toggleMute(node.id) }}
                      className="w-5 h-5 flex items-center justify-center rounded cursor-pointer transition-all"
                      style={{
                        background: node.muted ? 'rgba(239,68,68,0.15)' : 'transparent',
                        border: `1px solid ${node.muted ? 'rgba(239,68,68,0.25)' : HW.border}`,
                      }}
                      title={node.muted ? 'Unmute' : 'Mute'}>
                      {node.muted ? <VolumeX size={9} color="#ef4444" /> : <Volume2 size={9} style={{ color: `${color}60` }} />}
                    </button>
                    {/* ── Divider ── */}
                    <div className="w-px h-3.5" style={{ background: HW.border }} />
                    {/* ── Collapse ── */}
                    <button
                      onMouseDown={e => e.stopPropagation()}
                      onClick={e => { e.stopPropagation(); toggleCollapsed(node.id) }}
                      className="w-5 h-5 flex items-center justify-center rounded text-[8px] cursor-pointer transition-all"
                      style={{ color: HW.textDim }}
                      title={node.collapsed ? 'Expand' : 'Collapse'}>
                      {node.collapsed ? '▼' : '▲'}
                    </button>
                  </div>

                  {/* ═══════ COLLAPSED VIEW ═══════ */}
                  {node.collapsed ? (
                    <>
                      {/* Equalizer */}
                      <div className="px-3 pt-1.5 pb-1" style={{ background: `${HW.bg}80` }}>
                        <MiniScope color={color} active={isActive} type={node.type}
                          analyserNode={getAnalyserById?.(`nde_${nodeIndex}`, 256, 0.8) ?? analyserNode}
                          hpf={hasMethod(node.code, 'hpf') ? node.hpf : undefined}
                          lpf={hasMethod(node.code, 'lpf') ? node.lpf : undefined} />
                      </div>
                      {/* Pattern visualization — mini piano roll or drum grid */}
                      <div className="px-2 py-1" style={{ borderTop: `1px solid ${HW.border}` }}
                        onMouseDown={e => e.stopPropagation()}>
                        {isSampleBased(node.type) ? (
                          <MiniDrumGrid
                            pattern={node.pattern || ''}
                            color={color}
                            height={Math.max(28, Math.min(48, (node.pattern?.split(',').length || 1) * 12))}
                            onClick={() => { setDrumSequencerOpen({ nodeId: node.id }); setPianoRollOpen(null) }}
                          />
                        ) : (
                          <MiniPianoRoll
                            pattern={node.pattern || ''}
                            scale={node.scale || globalScale}
                            color={color}
                            height={32}
                            onClick={() => { setPianoRollOpen({ nodeId: node.id }); setDrumSequencerOpen(null) }}
                          />
                        )}
                      </div>
                      {/* Filter knobs: HPF / LPF + VOL */}
                      <div className="flex items-start justify-center gap-1 px-2 py-1" style={{ borderTop: `1px solid ${HW.border}` }}>
                        <RotaryKnob label="VOL" value={node.gain} min={0} max={1} step={0.01} defaultValue={0.5} size={34}
                          onChange={v => updateKnob(node.id, 'gain', v)} onCommit={() => commitKnob(node.id, 'gain', node.gain)} color={color}
                          disabled={hasDynamic(node.code, 'gain')} />
                        <RotaryKnob label="HPF" value={hasMethod(node.code, 'hpf') ? node.hpf : 0} min={0} max={8000} step={50} defaultValue={0} size={34}
                          onChange={v => updateKnob(node.id, 'hpf', v)} onCommit={() => commitKnob(node.id, 'hpf', node.hpf)} color={color}
                          disabled={hasDynamic(node.code, 'hpf')} />
                        <RotaryKnob label="LPF" value={hasMethod(node.code, 'lpf') ? node.lpf : 20000} min={50} max={20000} step={50} defaultValue={20000} size={34}
                          onChange={v => updateKnob(node.id, 'lpf', v)} onCommit={() => commitKnob(node.id, 'lpf', node.lpf)} color={color}
                          disabled={hasDynamic(node.code, 'lpf')} />
                      </div>
                      {/* Compact footer */}
                      <div className="flex items-center justify-between px-3 py-1 rounded-b-xl"
                        style={{ borderTop: `1px solid ${HW.border}`, background: `${HW.bg}40` }}>
                        <div className="flex items-center gap-1">
                          {isActive && <div className="w-1.5 h-1.5 rounded-full" style={{ background: color, boxShadow: `0 0 6px ${color}50` }} />}
                          <span className="text-[7px]" style={{ color: `${color}60` }}>{node.sound || node.soundSource}</span>
                        </div>
                        <div className="flex items-center gap-0.5">
                          <button onClick={e => { e.stopPropagation(); duplicateNode(node.id) }}
                            className="w-4 h-4 flex items-center justify-center rounded cursor-pointer"
                            style={{ color: HW.textDim, background: HW.raised, border: `1px solid ${HW.border}` }}>
                            <Copy size={7} />
                          </button>
                          <button onClick={e => { e.stopPropagation(); deleteNode(node.id) }}
                            className="w-4 h-4 flex items-center justify-center rounded cursor-pointer"
                            style={{ color: '#ef444480', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.1)' }}>
                            <Trash2 size={7} />
                          </button>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                  {/* ═══════ EXPANDED VIEW (original) ═══════ */}

                  {/* EFFECT BADGES — visual tags showing active effects */}
                  {(() => {
                    const badges = detectActiveEffects(node.code)
                    return badges.length > 0 ? (
                      <div className="flex flex-wrap gap-[2px] px-2 py-1" style={{ borderBottom: `1px solid ${HW.border}`, background: `${HW.bg}60` }}>
                        {badges.map(b => (
                          <span key={b.label} className="px-1 py-[1px] rounded text-[6px] font-black tracking-wider uppercase"
                            style={{ background: `${b.color}12`, color: b.color, border: `1px solid ${b.color}25` }}>
                            {b.label}
                          </span>
                        ))}
                      </div>
                    ) : null
                  })()}

                  {/* SCOPE */}
                  <div className="px-3 pt-2" style={{ background: `${HW.bg}80` }}>
                    <MiniScope color={color} active={isActive} type={node.type}
                      analyserNode={getAnalyserById?.(`nde_${nodeIndex}`, 256, 0.8) ?? analyserNode}
                      hpf={hasMethod(node.code, 'hpf') ? node.hpf : undefined}
                      lpf={hasMethod(node.code, 'lpf') ? node.lpf : undefined} />
                  </div>

                  {/* ══════ SMART GUIDANCE ══════ */}
                  <div className="px-3 py-1.5" style={{ borderBottom: `1px solid ${HW.border}`, background: `${color}04` }}>
                    <div className="flex items-start gap-1.5">
                      <span className="text-[8px] shrink-0 mt-[1px]">💡</span>
                      <span className="text-[7px] leading-relaxed" style={{ color: `${color}70` }}>
                        {NODE_GUIDANCE[node.type]}
                      </span>
                    </div>
                  </div>

                  {/* ══════ ALL KNOBS — one row, code-driven ══════ */}
                  <div className="px-2 py-2">
                    <div className="flex items-start justify-center gap-0.5 flex-wrap">
                      <RotaryKnob label="VOL" value={node.gain} min={0} max={1} step={0.01} defaultValue={0.5}
                        onChange={v => updateKnob(node.id, 'gain', v)} onCommit={() => commitKnob(node.id, 'gain', node.gain)} color={color}
                        disabled={hasDynamic(node.code, 'gain')} />
                      {hasMethod(node.code, 'pan') && (
                        <RotaryKnob label="PAN" value={node.pan} min={0} max={1} step={0.01} defaultValue={0.5}
                          onChange={v => updateKnob(node.id, 'pan', v)} onCommit={() => commitKnob(node.id, 'pan', node.pan)} color={color}
                          disabled={hasDynamic(node.code, 'pan')} />
                      )}
                      {hasMethod(node.code, 'velocity') && (
                        <RotaryKnob label="VEL" value={node.velocity} min={0} max={1} step={0.01} defaultValue={1}
                          onChange={v => updateKnob(node.id, 'velocity', v)} onCommit={() => commitKnob(node.id, 'velocity', node.velocity)} color={color}
                          disabled={hasDynamic(node.code, 'velocity')} />
                      )}
                      {hasMethod(node.code, 'slow') && (
                        <RotaryKnob label="SPD" value={node.speed} min={0.25} max={8} step={0.25} defaultValue={1} suffix="x"
                          onChange={v => updateKnob(node.id, 'slow', v)} onCommit={() => commitKnob(node.id, 'slow', node.speed)} color={color}
                          disabled={hasDynamic(node.code, 'slow')} />
                      )}
                      {hasMethod(node.code, 'lpf') && (
                        <RotaryKnob label="LPF" value={node.lpf} min={50} max={20000} step={50} defaultValue={20000} suffix="Hz"
                          onChange={v => updateKnob(node.id, 'lpf', v)} onCommit={() => commitKnob(node.id, 'lpf', node.lpf)} color={color}
                          disabled={hasDynamic(node.code, 'lpf')} />
                      )}
                      {hasMethod(node.code, 'hpf') && (
                        <RotaryKnob label="HPF" value={node.hpf} min={0} max={8000} step={50} defaultValue={0} suffix="Hz"
                          onChange={v => updateKnob(node.id, 'hpf', v)} onCommit={() => commitKnob(node.id, 'hpf', node.hpf)} color={color}
                          disabled={hasDynamic(node.code, 'hpf')} />
                      )}
                      {hasMethod(node.code, 'lpq') && (
                        <RotaryKnob label="LPQ" value={node.lpq} min={0} max={50} step={0.5} defaultValue={1}
                          onChange={v => updateKnob(node.id, 'lpq', v)} onCommit={() => commitKnob(node.id, 'lpq', node.lpq)} color={color}
                          disabled={hasDynamic(node.code, 'lpq')} />
                      )}
                      {hasMethod(node.code, 'hpq') && (
                        <RotaryKnob label="HPQ" value={node.hpq} min={0} max={50} step={0.5} defaultValue={1}
                          onChange={v => updateKnob(node.id, 'hpq', v)} onCommit={() => commitKnob(node.id, 'hpq', node.hpq)} color={color}
                          disabled={hasDynamic(node.code, 'hpq')} />
                      )}
                      {hasMethod(node.code, 'room') && (
                        <RotaryKnob label="VERB" value={node.room} min={0} max={1} step={0.01} defaultValue={0}
                          onChange={v => updateKnob(node.id, 'room', v)} onCommit={() => commitKnob(node.id, 'room', node.room)} color={color}
                          disabled={hasDynamic(node.code, 'room')} />
                      )}
                      {hasMethod(node.code, 'delay') && (
                        <RotaryKnob label="DLY" value={node.delay} min={0} max={0.8} step={0.01} defaultValue={0}
                          onChange={v => updateKnob(node.id, 'delay', v)} onCommit={() => commitKnob(node.id, 'delay', node.delay)} color={color}
                          disabled={hasDynamic(node.code, 'delay')} />
                      )}
                      {hasMethod(node.code, 'delayfeedback') && (
                        <RotaryKnob label="FDBK" value={node.delayfeedback} min={0} max={0.95} step={0.01} defaultValue={0}
                          onChange={v => updateKnob(node.id, 'delayfeedback', v)} onCommit={() => commitKnob(node.id, 'delayfeedback', node.delayfeedback)} color={color}
                          disabled={hasDynamic(node.code, 'delayfeedback')} />
                      )}
                      {hasMethod(node.code, 'distort') && (
                        <RotaryKnob label="DIST" value={node.distort} min={0} max={4} step={0.05} defaultValue={0}
                          onChange={v => updateKnob(node.id, 'distort', v)} onCommit={() => commitKnob(node.id, 'distort', node.distort)} color={color}
                          disabled={hasDynamic(node.code, 'distort')} />
                      )}
                      {hasMethod(node.code, 'shape') && (
                        <RotaryKnob label="SHPE" value={node.shape} min={0} max={1} step={0.01} defaultValue={0}
                          onChange={v => updateKnob(node.id, 'shape', v)} onCommit={() => commitKnob(node.id, 'shape', node.shape)} color={color}
                          disabled={hasDynamic(node.code, 'shape')} />
                      )}
                      {hasMethod(node.code, 'crush') && (
                        <RotaryKnob label="CRSH" value={node.crush} min={0} max={16} step={1} defaultValue={0}
                          onChange={v => updateKnob(node.id, 'crush', v)} onCommit={() => commitKnob(node.id, 'crush', node.crush)} color={color}
                          disabled={hasDynamic(node.code, 'crush')} />
                      )}
                      {hasMethod(node.code, 'phaser') && (
                        <RotaryKnob label="PHSR" value={node.phaser} min={0} max={20} step={0.5} defaultValue={0} suffix="Hz"
                          onChange={v => updateKnob(node.id, 'phaser', v)} onCommit={() => commitKnob(node.id, 'phaser', node.phaser)} color={color}
                          disabled={hasDynamic(node.code, 'phaser')} />
                      )}
                      {hasMethod(node.code, 'coarse') && (
                        <RotaryKnob label="COARSE" value={node.coarse} min={0} max={32} step={1} defaultValue={0}
                          onChange={v => updateKnob(node.id, 'coarse', v)} onCommit={() => commitKnob(node.id, 'coarse', node.coarse)} color={color}
                          disabled={hasDynamic(node.code, 'coarse')} />
                      )}
                      {hasMethod(node.code, 'attack') && (
                        <RotaryKnob label="ATK" value={node.attack} min={0} max={2} step={0.01} defaultValue={0.001} suffix="s"
                          onChange={v => updateKnob(node.id, 'attack', v)} onCommit={() => commitKnob(node.id, 'attack', node.attack)} color={color}
                          disabled={hasDynamic(node.code, 'attack')} />
                      )}
                      {hasMethod(node.code, 'decay') && (
                        <RotaryKnob label="DEC" value={node.decay} min={0} max={2} step={0.01} defaultValue={0.1} suffix="s"
                          onChange={v => updateKnob(node.id, 'decay', v)} onCommit={() => commitKnob(node.id, 'decay', node.decay)} color={color}
                          disabled={hasDynamic(node.code, 'decay')} />
                      )}
                      {hasMethod(node.code, 'sustain') && (
                        <RotaryKnob label="SUS" value={node.sustain} min={0} max={1} step={0.01} defaultValue={0.5}
                          onChange={v => updateKnob(node.id, 'sustain', v)} onCommit={() => commitKnob(node.id, 'sustain', node.sustain)} color={color}
                          disabled={hasDynamic(node.code, 'sustain')} />
                      )}
                      {hasMethod(node.code, 'release') && (
                        <RotaryKnob label="REL" value={node.release} min={0} max={4} step={0.01} defaultValue={0.1} suffix="s"
                          onChange={v => updateKnob(node.id, 'release', v)} onCommit={() => commitKnob(node.id, 'release', node.release)} color={color}
                          disabled={hasDynamic(node.code, 'release')} />
                      )}
                      {hasMethod(node.code, 'fmi') && (
                        <RotaryKnob label="FM" value={node.fmi} min={0} max={8} step={0.1} defaultValue={0}
                          onChange={v => updateKnob(node.id, 'fmi', v)} onCommit={() => commitKnob(node.id, 'fmi', node.fmi)} color={color}
                          disabled={hasDynamic(node.code, 'fmi')} />
                      )}
                    </div>
                  </div>

                  {/* ══════ + FX — Quick-add & Searchable ══════ */}
                  <div className="px-2 pb-2">
                    <div className="flex items-center gap-1 mb-1 px-1">
                      <div className="h-px flex-1" style={{ background: HW.border }} />
                      <span className="text-[7px] font-bold tracking-[0.2em] uppercase" style={{ color: HW.textDim }}>+ FX</span>
                      <div className="h-px flex-1" style={{ background: HW.border }} />
                    </div>
                    {/* Quick-add: common audio effects not yet in code */}
                    <div className="flex flex-wrap gap-[3px] mb-1.5">
                      {QUICK_ADD_FX.filter(fx => !hasMethod(node.code, fx.method)).slice(0, 12).map(fx => (
                        <button key={fx.id}
                          onClick={e => { e.stopPropagation(); applyNodeEffect(node.id, fx.method, fx.defaultVal) }}
                          title={fx.desc}
                          className="px-1.5 py-[2px] rounded text-[7px] font-bold tracking-wider uppercase transition-all cursor-pointer whitespace-nowrap"
                          style={{ background: `${fx.color}08`, color: `${fx.color}90`, border: `1px solid ${fx.color}20` }}>
                          + {fx.label}
                        </button>
                      ))}
                    </div>
                    {/* Toggle search dropdown */}
                    <button
                      onClick={e => { e.stopPropagation(); setFxDropdownNodeId(prev => prev === node.id ? null : node.id); setFxSearchQuery('') }}
                      className="w-full px-2 py-1 rounded text-[7px] font-bold tracking-wider uppercase transition-all cursor-pointer mb-1"
                      style={{
                        background: fxDropdownNodeId === node.id ? `${color}15` : HW.raised,
                        color: fxDropdownNodeId === node.id ? color : HW.textDim,
                        border: `1px solid ${fxDropdownNodeId === node.id ? `${color}30` : HW.border}`,
                      }}>
                      {fxDropdownNodeId === node.id ? '▲ CLOSE FX' : '▼ MORE FX & PATTERNS'}
                    </button>
                    {/* Searchable dropdown */}
                    {fxDropdownNodeId === node.id && (
                      <div className="mt-1 rounded overflow-hidden" style={{ background: HW.surface, border: `1px solid ${HW.borderLight}` }}>
                        <input
                          type="text" value={fxSearchQuery} placeholder="Search effects..."
                          onChange={e => setFxSearchQuery(e.target.value)}
                          onClick={e => e.stopPropagation()}
                          className="w-full px-2 py-1 text-[8px] outline-none"
                          style={{ background: HW.raised, color: HW.textBright, border: 'none', borderBottom: `1px solid ${HW.border}` }}
                          autoFocus
                        />
                        <div className="max-h-[180px] overflow-y-auto p-1">
                          {(['pattern', 'groove', 'time', 'stereo', 'glitch', 'lfo'] as const).map(cat => {
                            const fxInCat = QUICK_FX.filter(fx => fx.category === cat && (fxSearchQuery === '' || fx.label.toLowerCase().includes(fxSearchQuery.toLowerCase()) || fx.desc.toLowerCase().includes(fxSearchQuery.toLowerCase())))
                            if (fxInCat.length === 0) return null
                            return (
                              <div key={cat} className="mb-1">
                                <div className="text-[6px] font-bold uppercase tracking-wider px-1 py-0.5" style={{ color: HW.textDim }}>{cat}</div>
                                <div className="flex flex-wrap gap-[3px]">
                                  {fxInCat.map(fx => {
                                    const rawCode = node.code.replace(/\/\/ \[muted\] /g, '')
                                    const isOn = fx.detect.test(rawCode)
                                    return (
                                      <button key={fx.id}
                                        onClick={e => { e.stopPropagation(); toggleQuickFX(node.id, fx) }}
                                        title={fx.desc}
                                        className="px-1.5 py-[2px] rounded text-[7px] font-bold tracking-wider uppercase transition-all cursor-pointer whitespace-nowrap"
                                        style={{
                                          background: isOn ? `${fx.color}20` : HW.raised,
                                          color: isOn ? fx.color : HW.textDim,
                                          border: `1px solid ${isOn ? `${fx.color}40` : HW.border}`,
                                          boxShadow: isOn ? `0 0 6px ${fx.color}15` : 'none',
                                        }}>
                                        <span className="mr-0.5">{fx.icon}</span>{fx.label}{isOn ? ' ✕' : ''}
                                      </button>
                                    )
                                  })}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                    {/* Active pattern FX chips — quick removal */}
                    {(() => {
                      const rawCode = node.code.replace(/\/\/ \[muted\] /g, '')
                      const activeFX = QUICK_FX.filter(fx => fx.detect.test(rawCode))
                      return activeFX.length > 0 ? (
                        <div className="flex flex-wrap gap-[3px] mt-1.5">
                          {activeFX.map(fx => (
                            <button key={fx.id}
                              onClick={e => { e.stopPropagation(); toggleQuickFX(node.id, fx) }}
                              title={`Remove ${fx.desc}`}
                              className="px-1.5 py-[2px] rounded text-[7px] font-bold tracking-wider uppercase transition-all cursor-pointer whitespace-nowrap group"
                              style={{ background: `${fx.color}20`, color: fx.color, border: `1px solid ${fx.color}40`, boxShadow: `0 0 6px ${fx.color}15` }}>
                              <span className="mr-0.5">{fx.icon}</span>{fx.label} <span className="opacity-50 group-hover:opacity-100">✕</span>
                            </button>
                          ))}
                        </div>
                      ) : null
                    })()}
                  </div>

                  {/* ══════ LFO ASSIGN ══════ */}
                  <QuickLFOPanel nodeId={node.id} color={color} onAssign={injectLFO} />

                  {/* SELECTORS */}
                  <div className="px-3 pb-2 space-y-1" style={{ overflow: 'visible' }}>
                    <div className="flex items-center gap-1 mb-1">
                      <div className="h-px flex-1" style={{ background: HW.border }} />
                      <span className="text-[7px] font-bold tracking-[0.2em] uppercase" style={{ color: HW.textDim }}>{isSampleBased(node.type) ? 'SOUND' : 'INSTRUMENT'}</span>
                      <div className="h-px flex-1" style={{ background: HW.border }} />
                    </div>
                    <HardwareSelect label={isSampleBased(node.type) ? 'SND' : 'INST'} value={node.soundSource} options={presets}
                      onChange={v => changeSoundSource(node.id, v)} color={color} />
                    {/* Mini visualization (click to open full editor) */}
                    <div onMouseDown={e => e.stopPropagation()}>
                      {isSampleBased(node.type) ? (
                        <MiniDrumGrid
                          pattern={node.pattern || ''}
                          color={color}
                          height={Math.max(32, Math.min(52, (node.pattern?.split(',').length || 1) * 14))}
                          onClick={() => { setDrumSequencerOpen({ nodeId: node.id }); setPianoRollOpen(null) }}
                        />
                      ) : (
                        <MiniPianoRoll
                          pattern={node.pattern || ''}
                          scale={node.scale || globalScale}
                          color={color}
                          height={36}
                          onClick={() => { setPianoRollOpen({ nodeId: node.id }); setDrumSequencerOpen(null) }}
                        />
                      )}
                    </div>
                    {/* Preset dropdown + transpose/randomize controls */}
                    {node.type === 'drums' || node.type === 'fx' ? (
                      <div className="flex items-center gap-1">
                        <div className="flex-1"><HardwareSelect label="PAT" value={node.pattern} options={DRUM_PATTERNS}
                          onChange={v => changePattern(node.id, v)} color={color} /></div>
                        <button onClick={e => { e.stopPropagation(); randomizePattern(node.id) }}
                          className="w-6 h-6 flex items-center justify-center rounded text-[11px] cursor-pointer shrink-0 transition-all hover:scale-110"
                          style={{ background: `${color}10`, border: `1px solid ${color}25`, color }}
                          title="Random pattern">🎲</button>
                      </div>
                    ) : node.type === 'chords' ? (
                      <div className="flex items-center gap-1">
                        <div className="flex-1"><HardwareSelect label="CHD" value={node.pattern} options={keyChordOptions}
                          onChange={v => changePattern(node.id, v)} color={color} /></div>
                        <button onClick={e => { e.stopPropagation(); transposePattern(node.id, -1) }}
                          className="w-5 h-6 flex items-center justify-center rounded text-[9px] cursor-pointer shrink-0 transition-all hover:scale-110"
                          style={{ background: `${color}10`, border: `1px solid ${color}25`, color }}
                          title="Transpose down">▼</button>
                        <button onClick={e => { e.stopPropagation(); transposePattern(node.id, 1) }}
                          className="w-5 h-6 flex items-center justify-center rounded text-[9px] cursor-pointer shrink-0 transition-all hover:scale-110"
                          style={{ background: `${color}10`, border: `1px solid ${color}25`, color }}
                          title="Transpose up">▲</button>
                        <button onClick={e => { e.stopPropagation(); randomizePattern(node.id) }}
                          className="w-6 h-6 flex items-center justify-center rounded text-[11px] cursor-pointer shrink-0 transition-all hover:scale-110"
                          style={{ background: `${color}10`, border: `1px solid ${color}25`, color }}
                          title="Random chords">🎲</button>
                      </div>
                    ) : node.type === 'bass' ? (
                      <div className="flex items-center gap-1">
                        <div className="flex-1"><HardwareSelect label="PAT" value={node.pattern} options={keyBassOptions}
                          onChange={v => changePattern(node.id, v)} color={color} /></div>
                        <button onClick={e => { e.stopPropagation(); transposePattern(node.id, -1) }}
                          className="w-5 h-6 flex items-center justify-center rounded text-[9px] cursor-pointer shrink-0 transition-all hover:scale-110"
                          style={{ background: `${color}10`, border: `1px solid ${color}25`, color }}
                          title="Transpose down">▼</button>
                        <button onClick={e => { e.stopPropagation(); transposePattern(node.id, 1) }}
                          className="w-5 h-6 flex items-center justify-center rounded text-[9px] cursor-pointer shrink-0 transition-all hover:scale-110"
                          style={{ background: `${color}10`, border: `1px solid ${color}25`, color }}
                          title="Transpose up">▲</button>
                        <button onClick={e => { e.stopPropagation(); randomizePattern(node.id) }}
                          className="w-6 h-6 flex items-center justify-center rounded text-[11px] cursor-pointer shrink-0 transition-all hover:scale-110"
                          style={{ background: `${color}10`, border: `1px solid ${color}25`, color }}
                          title="Random bassline">🎲</button>
                      </div>
                    ) : isMelodic ? (
                      <div className="flex items-center gap-1">
                        <div className="flex-1"><HardwareSelect label="PAT" value={node.pattern} options={keyMelodyOptions}
                          onChange={v => changePattern(node.id, v)} color={color} /></div>
                        <button onClick={e => { e.stopPropagation(); transposePattern(node.id, -1) }}
                          className="w-5 h-6 flex items-center justify-center rounded text-[9px] cursor-pointer shrink-0 transition-all hover:scale-110"
                          style={{ background: `${color}10`, border: `1px solid ${color}25`, color }}
                          title="Transpose down">▼</button>
                        <button onClick={e => { e.stopPropagation(); transposePattern(node.id, 1) }}
                          className="w-5 h-6 flex items-center justify-center rounded text-[9px] cursor-pointer shrink-0 transition-all hover:scale-110"
                          style={{ background: `${color}10`, border: `1px solid ${color}25`, color }}
                          title="Transpose up">▲</button>
                        <button onClick={e => { e.stopPropagation(); randomizePattern(node.id) }}
                          className="w-6 h-6 flex items-center justify-center rounded text-[11px] cursor-pointer shrink-0 transition-all hover:scale-110"
                          style={{ background: `${color}10`, border: `1px solid ${color}25`, color }}
                          title="Random melody">🎲</button>
                      </div>
                    ) : null}
                    {isMelodic && (
                      <HardwareSelect label="KEY" value={node.scale || 'C4:major'} options={SCALE_PRESETS}
                        onChange={v => changeScale(node.id, v)} color={color} />
                    )}
                    {isMelodic && (
                      <HardwareSelect label="VWL" value={node.vowel} options={VOWELS}
                        onChange={v => applyNodeEffect(node.id, 'vowel', v)} color={color} />
                    )}
                  </div>

                  {/* FOOTER */}
                  <div className="flex items-center justify-between px-3 py-1.5 rounded-b-xl"
                    style={{ borderTop: `1px solid ${HW.border}`, background: `${HW.bg}40` }}>
                    <div className="flex items-center gap-1">
                      {isActive && (
                        <div className="flex items-center gap-1">
                          <div className="w-1.5 h-1.5 rounded-full" style={{ background: color, boxShadow: `0 0 6px ${color}50` }} />
                          <span className="text-[7px] uppercase tracking-wider" style={{ color: `${color}80` }}>live</span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-0.5">
                      <button onClick={e => { e.stopPropagation(); duplicateNode(node.id) }}
                        className="w-5 h-5 flex items-center justify-center rounded cursor-pointer"
                        style={{ color: HW.textDim, background: HW.raised, border: `1px solid ${HW.border}` }}>
                        <Copy size={9} />
                      </button>
                      <button onClick={e => { e.stopPropagation(); deleteNode(node.id) }}
                        className="w-5 h-5 flex items-center justify-center rounded cursor-pointer"
                        style={{ color: '#ef444480', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.1)' }}>
                        <Trash2 size={9} />
                      </button>
                    </div>
                  </div>
                    </>
                  )}
                  {/* END collapsed/expanded ternary */}
                </div>
              </div>
            </div>
          )
        })}

        {/* Empty state */}
        {nodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="text-5xl mb-4 opacity-10">🎛️</div>
              <p className="text-[12px] font-medium" style={{ color: HW.textDim }}>No channels</p>
              <p className="text-[10px] mt-1" style={{ color: HW.textDim }}>Click <span style={{ color: '#22d3ee' }}>+ ADD</span> to create a node</p>
            </div>
          </div>
        )}

        {/* ══════ PIANO ROLL DOCK (inside canvas for absolute positioning) ══════ */}
        {pianoRollOpen && (() => {
          const targetNode = nodes.find(n => n.id === pianoRollOpen.nodeId)
          if (!targetNode) return null
          const prNodeType = (['melody', 'chords', 'bass', 'pad', 'vocal'].includes(targetNode.type)
            ? targetNode.type : 'other') as 'melody' | 'chords' | 'bass' | 'pad' | 'vocal' | 'other'
          const prColor = TYPE_COLORS[targetNode.type] || '#94a3b8'
          const prBars = getPatternBarCount(targetNode.pattern, targetNode.code)
          return (
            <Suspense fallback={<div className="absolute bottom-0 left-0 right-0 h-[320px] bg-black/90 flex items-center justify-center text-white/40 z-[100]">Loading Piano Roll…</div>}>
              <PianoRoll
                isOpen={true}
                onClose={() => setPianoRollOpen(null)}
                scale={targetNode.scale || globalScale}
                currentPattern={targetNode.pattern}
                nodeType={prNodeType}
                nodeColor={prColor}
                patternBars={prBars}
                soundSource={targetNode.soundSource || targetNode.sound || ''}
                onPatternChange={(newPattern) => handlePianoRollPatternChange(targetNode.id, newPattern)}
                isPlaying={isPlaying}
                bpm={bpm}
                getCyclePosition={getCyclePosition}
              />
            </Suspense>
          )
        })()}

        {/* ══════ DRUM SEQUENCER DOCK (sample-based nodes) ══════ */}
        {drumSequencerOpen && (() => {
          const dsNode = nodes.find(n => n.id === drumSequencerOpen.nodeId)
          if (!dsNode) return null
          const dsColor = TYPE_COLORS[dsNode.type] || '#f59e0b'
          const bankMatch = dsNode.code.match(/\.bank\s*\(\s*["']([^"']+)["']/)
          return (
            <Suspense fallback={<div className="absolute bottom-0 left-0 right-0 h-[300px] bg-black/90 flex items-center justify-center text-white/40 z-[100]">Loading Drum Sequencer…</div>}>
              <DrumSequencer
                isOpen={true}
                onClose={() => setDrumSequencerOpen(null)}
                currentPattern={dsNode.pattern}
                nodeColor={dsColor}
                onPatternChange={(newPattern, bars) => handleDrumPatternChange(dsNode.id, newPattern, bars)}
                isPlaying={isPlaying}
                bpm={bpm}
                getCyclePosition={getCyclePosition}
                bankName={bankMatch ? bankMatch[1] : undefined}
                patternBars={getPatternBarCount(dsNode.pattern, dsNode.code)}
              />
            </Suspense>
          )
        })()}
      </div>



      {/* ══════ SAMPLE MODE CHOICE MODAL ══════ */}
      {sampleChoiceModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center" onClick={() => setSampleChoiceModal(null)}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div className="relative w-full max-w-sm rounded-xl overflow-hidden"
            style={{ background: HW.surface, border: `1px solid ${HW.border}` }}
            onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 text-center" style={{ borderBottom: `1px solid ${HW.border}`, background: HW.surfaceAlt }}>
              <p className="text-sm font-semibold" style={{ color: HW.textBright }}>
                How do you want to use <span className="font-mono" style={{ color: '#22d3ee' }}>&quot;{sampleChoiceModal.sampleName}&quot;</span>?
              </p>
            </div>
            <div className="p-4 space-y-3">
              <button
                onClick={() => addSampleNode(sampleChoiceModal.sampleName, 'instrument')}
                className="w-full flex items-center gap-3 p-3 rounded-lg text-left transition-all cursor-pointer group"
                style={{ background: HW.bg, border: `1px solid ${HW.border}` }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#a78bfa40'; e.currentTarget.style.background = '#a78bfa08' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = HW.border; e.currentTarget.style.background = HW.bg }}
              >
                <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xl shrink-0"
                  style={{ background: '#a78bfa15', border: '1px solid #a78bfa20' }}>🎹</div>
                <div>
                  <div className="text-xs font-bold" style={{ color: '#a78bfa' }}>Instrument (MIDI)</div>
                  <div className="text-[10px] mt-0.5" style={{ color: HW.textDim }}>
                    Slice across MIDI notes — play it chromatically via Piano Roll
                  </div>
                </div>
              </button>
              <button
                onClick={() => addSampleNode(sampleChoiceModal.sampleName, 'sound')}
                className="w-full flex items-center gap-3 p-3 rounded-lg text-left transition-all cursor-pointer group"
                style={{ background: HW.bg, border: `1px solid ${HW.border}` }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#22d3ee40'; e.currentTarget.style.background = '#22d3ee08' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = HW.border; e.currentTarget.style.background = HW.bg }}
              >
                <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xl shrink-0"
                  style={{ background: '#22d3ee15', border: '1px solid #22d3ee20' }}>🎵</div>
                <div>
                  <div className="text-xs font-bold" style={{ color: '#22d3ee' }}>Sound (Pitched)</div>
                  <div className="text-[10px] mt-0.5" style={{ color: HW.textDim }}>
                    Play pitched notes using the current scale — like a vocal or pad layer
                  </div>
                </div>
              </button>
            </div>
            <div className="px-5 py-2 text-center" style={{ borderTop: `1px solid ${HW.border}` }}>
              <button onClick={() => setSampleChoiceModal(null)}
                className="text-[10px] cursor-pointer" style={{ color: HW.textDim }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Close sidebar+canvas flex container */}
      </div>

      {/* ══════ BOTTOM TIMELINE ══════ */}
      <Suspense fallback={null}>
        <BottomTimeline
          isOpen={timelineOpen}
          onToggle={() => setTimelineOpen(p => !p)}
          nodes={nodes.map(n => ({
            id: n.id,
            name: n.name,
            type: n.type,
            muted: n.muted,
            solo: n.solo,
            pattern: n.pattern,
            speed: n.speed ?? 1,
          }))}
          bpm={bpm || 72}
          isPlaying={isPlaying}
          currentCycle={currentCycle}
          onNodeSelect={(nodeId) => setSelectedNode(nodeId)}
          selectedNodeId={selectedNode}
          onDeleteNode={deleteNode}
          onToggleMute={toggleMute}
          onToggleSolo={toggleSolo}
          onAddNode={addNode}
          onOpenEditor={(nodeId, type) => {
            const sampleBased = new Set(['drums', 'fx', 'other'])
            if (sampleBased.has(type)) {
              setDrumSequencerOpen({ nodeId })
              setPianoRollOpen(null)
            } else {
              setPianoRollOpen({ nodeId })
              setDrumSequencerOpen(null)
            }
          }}
        />
      </Suspense>

      {/* ══════ STATUS BAR (hidden in headerless mode) ══════ */}
      {!headerless && (
      <div className="flex items-center justify-between px-4 py-1 shrink-0"
        style={{ background: HW.surface, borderTop: `1px solid ${HW.border}` }}>
        <span className="text-[8px] tracking-wide" style={{ color: HW.textDim }}>
          knobs show what&apos;s in code · drag effects to add · click sidebar with node selected · 🎲 randomize patterns
        </span>
        <div className="flex items-center gap-3 text-[8px] font-mono tabular-nums" style={{ color: HW.textDim }}>
          <span>{nodes.filter(n => !n.muted).length}/{nodes.length} active</span>
          <span style={{ color: '#22d3ee80' }}>{bpm || 72} bpm</span>
          <span style={{ color: '#a78bfa80' }}>{SCALE_PRESETS.find(s => s.value === globalScale)?.label || globalScale}</span>
        </div>
      </div>
      )}

      {/* ══════ SOUND UPLOADER MODAL ══════ */}
      {soundUploaderOpen && onRegisterSound && (
        <Suspense fallback={null}>
          <SoundUploader
            isOpen={soundUploaderOpen}
            onClose={() => { setSoundUploaderOpen(false); fetchUserSamples() }}
            onRegisterSound={onRegisterSound}
          />
        </Suspense>
      )}

      {/* ══════ SOUND SLICER MODAL ══════ */}
      {soundSlicerOpen && (() => {
        const slicerNode = nodes.find(n => n.id === soundSlicerOpen.nodeId)
        if (!slicerNode) return null
        const slicerColor = TYPE_COLORS[slicerNode.type] || '#94a3b8'
        // Extract current .begin() / .end() from code
        const beginMatch = slicerNode.code.match(/\.begin\s*\(\s*([\d.]+)\s*\)/)
        const endMatch = slicerNode.code.match(/\.end\s*\(\s*([\d.]+)\s*\)/)
        const curBegin = beginMatch ? parseFloat(beginMatch[1]) : 0
        const curEnd = endMatch ? parseFloat(endMatch[1]) : 1
        return (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm"
            onClick={e => { if (e.target === e.currentTarget) setSoundSlicerOpen(null) }}>
            <div className="w-full max-w-2xl mx-4 rounded-xl overflow-hidden shadow-2xl border border-white/10" style={{ background: '#0a0a0c' }}>
              <Suspense fallback={<div className="h-[200px] bg-black/90 flex items-center justify-center text-white/40 text-xs">Loading Slicer…</div>}>
                <SoundSlicer
                  soundName={slicerNode.soundSource || slicerNode.sound || 'unknown'}
                  nodeColor={slicerColor}
                  begin={curBegin}
                  end={curEnd}
                  onRegionChange={(b, e) => handleSlicerRegionChange(slicerNode.id, b, e)}
                  onClose={() => setSoundSlicerOpen(null)}
                />
              </Suspense>
            </div>
          </div>
        )
      })()}
    </div>
  )
})

export default NodeEditor
