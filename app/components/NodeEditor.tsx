'use client'

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import ReactDOM from 'react-dom'
import { Volume2, VolumeX, GripHorizontal, Plus, Trash2, Copy, ChevronDown, Maximize2, Minimize2, ChevronLeft, ChevronRight } from 'lucide-react'

// ═══════════════════════════════════════════════════════════════
//  TYPES
// ═══════════════════════════════════════════════════════════════

interface PatternNode {
  id: string
  name: string
  code: string       // raw code block as it appears in the editor
  muted: boolean
  solo: boolean
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

interface Connection { fromId: string; toId: string }

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
//  PRESETS
// ═══════════════════════════════════════════════════════════════

const SOUND_PRESETS: Record<string, { label: string; value: string }[]> = {
  drums: [
    { label: 'TR-808', value: 'RolandTR808' },
    { label: 'TR-909', value: 'RolandTR909' },
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
  ],
  fx: [
    { label: 'Hi-hat Shimmer', value: 'RolandTR808' },
    { label: 'Sine Wash', value: 'sine' },
  ],
  other: [
    { label: 'Sine', value: 'sine' },
    { label: 'Sawtooth', value: 'sawtooth' },
    { label: 'Square', value: 'square' },
    { label: 'Triangle', value: 'triangle' },
  ],
}

const SCALE_PRESETS = [
  { label: 'C Major', value: 'C4:major' },
  { label: 'A Minor', value: 'A3:minor' },
  { label: 'A Harmonic Min', value: 'A3:harmonic minor' },
  { label: 'C Maj Pentatonic', value: 'C4:major pentatonic' },
  { label: 'A Min Pentatonic', value: 'A3:minor pentatonic' },
  { label: 'C Blues', value: 'C4:blues' },
  { label: 'D Dorian', value: 'D4:dorian' },
  { label: 'E Phrygian', value: 'E4:phrygian' },
  { label: 'F Lydian', value: 'F4:lydian' },
  { label: 'G Mixolydian', value: 'G4:mixolydian' },
  { label: 'C Chromatic', value: 'C4:chromatic' },
  { label: 'D Minor', value: 'D4:minor' },
  { label: 'G Major', value: 'G4:major' },
  { label: 'F Major', value: 'F4:major' },
]

const DRUM_PATTERNS = [
  { label: 'Basic', value: 'bd [~ bd] ~ ~, ~ cp ~ ~, hh*8' },
  { label: 'Four-on-floor', value: 'bd*4, ~ cp ~ cp, hh*8' },
  { label: 'Boom Bap', value: 'bd ~ ~ bd ~ ~ bd ~, ~ ~ cp ~ ~ ~ ~ cp, hh*16' },
  { label: 'Trap', value: '[bd ~ ~ ~] ~ [~ bd] ~, ~ [~ cp] ~ ~, hh*16' },
  { label: 'Lofi Shuffle', value: '[bd ~ ~ ~] ~ [~ bd] ~, ~ [~ cp] ~ [~ ~ cp ~], [~ oh] [hh ~ ~ hh] [~ hh] [oh ~ hh ~]' },
  { label: 'Breakbeat', value: 'bd ~ ~ bd ~ ~ [bd bd] ~, ~ ~ cp ~ ~ cp ~ ~, hh hh [hh oh] hh' },
  { label: 'Minimal', value: 'bd ~ ~ ~, ~ ~ cp ~, ~ hh ~ hh' },
  { label: 'Jazz Brush', value: '[bd ~ bd ~] [~ bd ~ ~], ~ ~ [rim rim] ~, hh*4' },
]

const MELODY_PATTERNS = [
  { label: 'Ascending', value: '0 1 2 3 4 5 6 7' },
  { label: 'Descending', value: '7 6 5 4 3 2 1 0' },
  { label: 'Wave', value: '0 2 4 6 4 2 0 ~' },
  { label: 'Arpeggiate', value: '0 2 4 7 4 2' },
  { label: 'Sparse', value: '~ 0 ~ ~ 4 ~ 2 ~' },
  { label: 'Pentatonic Run', value: '0 2 4 7 9 12 9 7' },
  { label: 'Jazzy', value: '0 4 7 11 9 7 4 2' },
  { label: 'Steps', value: '0 ~ 1 ~ 2 ~ 3 ~' },
  { label: 'Octave Jump', value: '0 ~ 7 ~ 0 7 ~ ~' },
  { label: 'Chord Tones', value: '<0 2 4> <4 5 7> <7 9 11> <4 5 7>' },
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

function randomDrumPattern(): string {
  const kicks  = ['bd', 'bd*2', '[bd ~ bd ~]', '[bd ~ ~ bd]', 'bd ~ ~ ~', '[~ bd] ~ [~ bd] ~', 'bd ~ [bd bd] ~', '[bd bd ~ ~]']
  const snares = ['~ cp ~ ~', '~ cp ~ cp', '~ [~ cp] ~ ~', '~ ~ cp ~', '~ ~ [cp cp] ~', '~ [cp ~] ~ cp', '~ cp [~ cp] ~']
  const hats   = ['hh*4', 'hh*8', 'hh*16', '[hh ~ hh ~]*2', '[~ hh]*4', 'hh hh [hh oh] hh', '[hh hh ~ hh]*2', '[oh ~ hh hh]*2', 'hh*8']
  const percs  = ['', '', '', `, ${randomPick(['rim*8', '~ rim ~ rim', 'rim [rim ~] rim ~', '[~ rim]*4'])}`, `, ${randomPick(['[~ oh]*2', 'oh ~ ~ oh'])}` ]
  return `${randomPick(kicks)}, ${randomPick(snares)}, ${randomPick(hats)}${randomPick(percs)}`
}

function randomMelodyPattern(): string {
  const len = 4 + Math.floor(Math.random() * 5)
  const notes: string[] = []
  for (let i = 0; i < len; i++) {
    if (Math.random() < 0.2) notes.push('~')
    else if (Math.random() < 0.1) notes.push(`[${Math.floor(Math.random() * 8)} ${Math.floor(Math.random() * 8)}]`)
    else notes.push(String(Math.floor(Math.random() * 12)))
  }
  return notes.join(' ')
}

function randomChordProgression(): string {
  const triads = ['[c3,e3,g3]', '[d3,f3,a3]', '[e3,g3,b3]', '[f3,a3,c4]', '[g3,b3,d4]', '[a3,c4,e4]']
  const sevenths = ['[c3,e3,g3,b3]', '[d3,f3,a3,c4]', '[g2,b2,d3,f3]', '[a2,c3,e3,g3]', '[f2,a2,c3,e3]', '[e3,gs3,b3,d4]']
  const pool = Math.random() < 0.5 ? triads : sevenths
  const count = 3 + Math.floor(Math.random() * 3)
  return `<${Array.from({ length: count }, () => randomPick(pool)).join(' ')}>`
}

function randomBassPattern(): string {
  const roots = ['c2', 'c1', 'd2', 'e1', 'f1', 'f2', 'g1', 'g2', 'a1', 'b1', 'eb2', 'bb1']
  const len = 4 + Math.floor(Math.random() * 4)
  const parts: string[] = []
  for (let i = 0; i < len; i++) {
    if (Math.random() < 0.25) parts.push('~')
    else if (Math.random() < 0.15) parts.push(`[${randomPick(roots)} ~]`)
    else parts.push(randomPick(roots))
  }
  return `<${parts.join(' ')}>`
}

function randomPatternForType(type: NodeType): string {
  switch (type) {
    case 'drums': return randomDrumPattern()
    case 'bass':  return randomBassPattern()
    case 'chords': return randomChordProgression()
    default:      return randomMelodyPattern()
  }
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
  { id: 'echo3', label: 'ECHO', icon: '≡', category: 'pattern', code: '.echo(3, 1/8, 0.5)', detect: /\.echo\s*\(/, color: '#fb923c', desc: 'Stutter echo 3x' },
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
      { id: 'fx_reverb', label: 'Reverb', icon: '🏛️', desc: 'Room reverb .room(0.5)', color: '#22d3ee', dragType: 'effect', payload: '.room(0.5)', method: 'room' },
      { id: 'fx_delay', label: 'Delay', icon: '🔄', desc: 'Echo delay .delay(0.2)', color: '#22d3ee', dragType: 'effect', payload: '.delay(0.2).delayfeedback(0.4)', method: 'delay' },
      { id: 'fx_lpf', label: 'Low-Pass Filter', icon: '📉', desc: 'Cuts highs .lpf(1200)', color: '#60a5fa', dragType: 'effect', payload: '.lpf(1200)', method: 'lpf' },
      { id: 'fx_hpf', label: 'High-Pass Filter', icon: '📈', desc: 'Cuts lows .hpf(400)', color: '#60a5fa', dragType: 'effect', payload: '.hpf(400)', method: 'hpf' },
      { id: 'fx_bpf', label: 'Band-Pass Filter', icon: '🔊', desc: 'Narrow band .bpf(800)', color: '#60a5fa', dragType: 'effect', payload: '.bpf(800)', method: 'bpf' },
      { id: 'fx_vowel', label: 'Vowel Filter', icon: '🗣', desc: 'Vocal formant .vowel("a")', color: '#c084fc', dragType: 'effect', payload: '.vowel("a")', method: 'vowel' },
      { id: 'fx_crush', label: 'Bitcrush', icon: '💎', desc: 'Lo-fi .crush(8)', color: '#ef4444', dragType: 'effect', payload: '.crush(8)', method: 'crush' },
      { id: 'fx_shape', label: 'Waveshape', icon: '🔥', desc: 'Soft distortion .shape(0.4)', color: '#ef4444', dragType: 'effect', payload: '.shape(0.4)', method: 'shape' },
      { id: 'fx_distort', label: 'Distortion', icon: '⚡', desc: 'Hard distort .distort(2)', color: '#ef4444', dragType: 'effect', payload: '.distort(2)', method: 'distort' },
      { id: 'fx_coarse', label: 'Coarse', icon: '▦', desc: 'Downsample .coarse(8)', color: '#f59e0b', dragType: 'effect', payload: '.coarse(8)', method: 'coarse' },
      { id: 'fx_phaser', label: 'Phaser', icon: '🌀', desc: 'Phase sweep .phaser(4)', color: '#a78bfa', dragType: 'effect', payload: '.phaser(4)', method: 'phaser' },
      { id: 'fx_pan', label: 'Auto-Pan', icon: '↔️', desc: 'Stereo LFO .pan(sine.range(0,1).slow(4))', color: '#34d399', dragType: 'effect', payload: '.pan(sine.range(0,1).slow(4))', method: 'pan' },
      { id: 'fx_fm', label: 'FM Synthesis', icon: '📡', desc: 'Frequency mod .fmi(2)', color: '#818cf8', dragType: 'effect', payload: '.fmi(2)', method: 'fmi' },
      { id: 'fx_compress', label: 'Compressor', icon: '🔧', desc: 'Dynamic range .compressor(-20,10,4)', color: '#94a3b8', dragType: 'effect', payload: '.compressor(-20,10,4)' },
      { id: 'fx_gain', label: 'Gain', icon: '🔈', desc: 'Volume .gain(0.5)', color: '#34d399', dragType: 'effect', payload: '.gain(0.5)', method: 'gain' },
      { id: 'fx_sidechain', label: 'Sidechain', icon: '📊', desc: 'Pumping sidechain .csid("bd",0.3,0.2)', color: '#f59e0b', dragType: 'effect', payload: '.csid("bd",0.3,0.2)' },
    ]
  },
  {
    id: 'modifiers', label: 'Pattern FX', icon: '🎯', color: '#f472b6',
    items: [
      { id: 'mod_rev', label: 'Reverse', icon: '↩', desc: 'Reverse pattern', color: '#f472b6', dragType: 'effect', payload: '.rev()' },
      { id: 'mod_jux', label: 'Jux (Stereo)', icon: '◐', desc: 'Function on R channel', color: '#22d3ee', dragType: 'effect', payload: '.jux(rev)' },
      { id: 'mod_juxBy', label: 'Jux 50%', icon: '◑', desc: 'Subtle stereo split', color: '#22d3ee', dragType: 'effect', payload: '.juxBy(0.5, rev)' },
      { id: 'mod_echo', label: 'Echo Stutter', icon: '≡', desc: 'Pattern echo 3x', color: '#fb923c', dragType: 'effect', payload: '.echo(3, 1/8, 0.5)' },
      { id: 'mod_degrade', label: 'Degrade', icon: '░', desc: 'Drop 30% events', color: '#ef4444', dragType: 'effect', payload: '.degradeBy(0.3)' },
      { id: 'mod_chop', label: 'Chop', icon: '✂', desc: 'Granular slices', color: '#34d399', dragType: 'effect', payload: '.chop(8)' },
      { id: 'mod_striate', label: 'Striate', icon: '≋', desc: 'Interleaved granular', color: '#34d399', dragType: 'effect', payload: '.striate(4)' },
      { id: 'mod_iter', label: 'Iter (Rotate)', icon: '⟳', desc: 'Shift start each cycle', color: '#22d3ee', dragType: 'effect', payload: '.iter(4)' },
      { id: 'mod_ply', label: 'Ply (Repeat)', icon: '×2', desc: 'Double each event', color: '#f472b6', dragType: 'effect', payload: '.ply(2)' },
      { id: 'mod_chunk', label: 'Chunk', icon: '▧', desc: 'Rotating transform', color: '#facc15', dragType: 'effect', payload: '.chunk(4, fast(2))' },
      { id: 'mod_brak', label: 'Breakbeat', icon: '⚡', desc: 'Breakbeat transform', color: '#ef4444', dragType: 'effect', payload: '.brak()' },
      { id: 'mod_press', label: 'Press', icon: '→', desc: 'Push to 2nd half', color: '#fb923c', dragType: 'effect', payload: '.press()' },
      { id: 'mod_swing', label: 'Swing', icon: '♪', desc: 'Swing groove', color: '#fb923c', dragType: 'effect', payload: '.swing(0.2)' },
      { id: 'mod_hurry', label: 'Hurry', icon: '»', desc: 'Speed + pitch up', color: '#facc15', dragType: 'effect', payload: '.hurry(2)' },
      { id: 'mod_linger', label: 'Linger', icon: '∞', desc: 'Loop first quarter', color: '#c084fc', dragType: 'effect', payload: '.linger(0.25)' },
      { id: 'mod_fast', label: 'Fast 2x', icon: '⇡', desc: 'Double speed', color: '#facc15', dragType: 'effect', payload: '.fast(2)' },
      { id: 'mod_slow', label: 'Slow 2x', icon: '⇣', desc: 'Half speed', color: '#facc15', dragType: 'effect', payload: '.slow(2)' },
      { id: 'mod_every4', label: 'Every 4', icon: '⚡', desc: 'Every 4 cycles: fast(2)', color: '#facc15', dragType: 'effect', payload: '.every(4, fast(2))' },
      { id: 'mod_sometimes', label: 'Sometimes', icon: '?', desc: 'Random fast(2)', color: '#a78bfa', dragType: 'effect', payload: '.sometimes(fast(2))' },
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
      { id: 'ch_1564', label: 'I-V-vi-IV (Pop)', icon: '🎹', desc: 'The hit maker', color: '#c084fc', dragType: 'chord', payload: '<[c3,e3,g3] [g2,b2,d3] [a2,c3,e3] [f2,a2,c3]>' },
      { id: 'ch_251', label: 'ii-V-I (Jazz)', icon: '🎹', desc: 'Jazz standard', color: '#c084fc', dragType: 'chord', payload: '<[d3,f3,a3] [g2,b2,d3] [c3,e3,g3,b3]>' },
      { id: 'ch_lofi', label: 'Lofi Cycle', icon: '🎹', desc: '8-bar lo-fi', color: '#c084fc', dragType: 'chord', payload: '<[d3,f3,a3,c4] [g2,b2,d3,f3] [c3,e3,g3,b3] [a2,c3,e3,g3] [f3,a3,c4,e4] [e3,g3,b3,d4] [d3,f3,a3,c4] [e3,gs3,b3,d4]>' },
      { id: 'ch_12bar', label: '12-Bar Blues', icon: '🎹', desc: 'Classic blues', color: '#c084fc', dragType: 'chord', payload: '<[c3,e3,g3] [c3,e3,g3] [c3,e3,g3] [c3,e3,g3] [f2,a2,c3] [f2,a2,c3] [c3,e3,g3] [c3,e3,g3] [g2,b2,d3] [f2,a2,c3] [c3,e3,g3] [g2,b2,d3]>' },
      { id: 'ch_dreamy', label: 'Dreamy', icon: '🎹', desc: 'Ethereal pads', color: '#c084fc', dragType: 'chord', payload: '<[c3,g3,e4] [a2,e3,c4] [f3,c4,a4] [g3,d4,b4]>' },
      { id: 'ch_sad', label: 'Minor Sad', icon: '🎹', desc: 'Melancholic', color: '#c084fc', dragType: 'chord', payload: '<[a2,c3,e3] [f2,a2,c3] [d3,f3,a3] [e2,g2,b2]>' },
      { id: 'ch_ambient', label: 'Ambient Pads', icon: '🎹', desc: 'Floating', color: '#c084fc', dragType: 'chord', payload: '<[d3,a3,f4] [g3,d4,b4] [c3,g3,e4] [a2,e3,c4]>' },
      { id: 'ch_neo', label: 'Neo Soul', icon: '🎹', desc: 'Rich extensions', color: '#c084fc', dragType: 'chord', payload: '<[d3,f3,a3,c4,e4] [g2,b2,d3,f3,a3] [c3,e3,g3,b3,d4] [a2,c3,e3,g3,b3]>' },
    ]
  },
  {
    id: 'sounds', label: 'Instruments', icon: '🎸', color: '#fb923c',
    items: [
      { id: 'snd_piano', label: 'Piano', icon: '🎹', desc: 'GM Piano', color: '#fb923c', dragType: 'sound', payload: 'gm_piano' },
      { id: 'snd_epiano', label: 'E-Piano / Rhodes', icon: '🎹', desc: 'GM EPiano 1', color: '#fb923c', dragType: 'sound', payload: 'gm_epiano1' },
      { id: 'snd_organ', label: 'Organ', icon: '⛪', desc: 'Drawbar organ', color: '#fb923c', dragType: 'sound', payload: 'gm_drawbar_organ' },
      { id: 'snd_strings', label: 'Strings', icon: '🎻', desc: 'String ensemble', color: '#fb923c', dragType: 'sound', payload: 'gm_string_ensemble_1' },
      { id: 'snd_choir', label: 'Choir', icon: '🎤', desc: 'Choir Aahs', color: '#fb923c', dragType: 'sound', payload: 'gm_choir_aahs' },
      { id: 'snd_flute', label: 'Flute', icon: '🎶', desc: 'Concert flute', color: '#fb923c', dragType: 'sound', payload: 'gm_flute' },
      { id: 'snd_trumpet', label: 'Trumpet', icon: '🎺', desc: 'Bright trumpet', color: '#fb923c', dragType: 'sound', payload: 'gm_trumpet' },
      { id: 'snd_guitar', label: 'Guitar (Nylon)', icon: '🎸', desc: 'Acoustic nylon', color: '#fb923c', dragType: 'sound', payload: 'gm_acoustic_guitar_nylon' },
      { id: 'snd_bass_ac', label: 'Acoustic Bass', icon: '🎸', desc: 'Upright bass', color: '#fb923c', dragType: 'sound', payload: 'gm_acoustic_bass' },
      { id: 'snd_sine', label: 'Sine', icon: '∿', desc: 'Pure sine wave', color: '#fb923c', dragType: 'sound', payload: 'sine' },
      { id: 'snd_saw', label: 'Sawtooth', icon: '⟋', desc: 'Bright saw wave', color: '#fb923c', dragType: 'sound', payload: 'sawtooth' },
      { id: 'snd_square', label: 'Square', icon: '□', desc: 'Hollow square', color: '#fb923c', dragType: 'sound', payload: 'square' },
      { id: 'snd_tri', label: 'Triangle', icon: '△', desc: 'Soft triangle', color: '#fb923c', dragType: 'sound', payload: 'triangle' },
      { id: 'snd_music_box', label: 'Music Box', icon: '🎵', desc: 'Celeste/box', color: '#fb923c', dragType: 'sound', payload: 'gm_music_box' },
      { id: 'snd_vibes', label: 'Vibraphone', icon: '🎵', desc: 'Mellow vibes', color: '#fb923c', dragType: 'sound', payload: 'gm_vibraphone' },
      { id: 'snd_kalimba', label: 'Kalimba', icon: '🎵', desc: 'Thumb piano', color: '#fb923c', dragType: 'sound', payload: 'gm_kalimba' },
      { id: 'snd_sitar', label: 'Sitar', icon: '🪕', desc: 'Indian sitar', color: '#fb923c', dragType: 'sound', payload: 'gm_sitar' },
      { id: 'snd_steel_drum', label: 'Steel Drum', icon: '🥁', desc: 'Caribbean steel', color: '#fb923c', dragType: 'sound', payload: 'gm_steel_drum' },
    ]
  },
  {
    id: 'drums', label: 'Drum Machines', icon: '🥁', color: '#f59e0b',
    items: [
      { id: 'dm_808', label: 'TR-808', icon: '🥁', desc: 'Roland TR-808', color: '#f59e0b', dragType: 'sound', payload: 'RolandTR808' },
      { id: 'dm_909', label: 'TR-909', icon: '🥁', desc: 'Roland TR-909', color: '#f59e0b', dragType: 'sound', payload: 'RolandTR909' },
    ]
  },
  {
    id: 'patterns', label: 'Rhythm Patterns', icon: '🎶', color: '#f472b6',
    items: [
      { id: 'pat_basic', label: 'Basic 4/4', icon: '🥁', desc: 'Standard rock', color: '#f472b6', dragType: 'pattern', payload: 'bd [~ bd] ~ ~, ~ cp ~ ~, hh*8' },
      { id: 'pat_four', label: 'Four-on-floor', icon: '🥁', desc: 'Dance/house', color: '#f472b6', dragType: 'pattern', payload: 'bd*4, ~ cp ~ cp, hh*8' },
      { id: 'pat_trap', label: 'Trap', icon: '🥁', desc: 'Fast hats', color: '#f472b6', dragType: 'pattern', payload: '[bd ~ ~ ~] ~ [~ bd] ~, ~ [~ cp] ~ ~, hh*16' },
      { id: 'pat_lofi', label: 'Lofi Shuffle', icon: '🥁', desc: 'Chill groove', color: '#f472b6', dragType: 'pattern', payload: '[bd ~ ~ ~] ~ [~ bd] ~, ~ [~ cp] ~ [~ ~ cp ~], [~ oh] [hh ~ ~ hh] [~ hh] [oh ~ hh ~]' },
      { id: 'pat_break', label: 'Breakbeat', icon: '🥁', desc: 'Jungle style', color: '#f472b6', dragType: 'pattern', payload: 'bd ~ ~ bd ~ ~ [bd bd] ~, ~ ~ cp ~ ~ cp ~ ~, hh hh [hh oh] hh' },
      { id: 'pat_jazz', label: 'Jazz Brush', icon: '🥁', desc: 'Swing feel', color: '#f472b6', dragType: 'pattern', payload: '[bd ~ bd ~] [~ bd ~ ~], ~ ~ [rim rim] ~, hh*4' },
      { id: 'pat_mel_asc', label: 'Ascending', icon: '📈', desc: 'Scale run up', color: '#22d3ee', dragType: 'pattern', payload: '0 1 2 3 4 5 6 7' },
      { id: 'pat_mel_arp', label: 'Arpeggio', icon: '🎵', desc: 'Chord arpeggio', color: '#22d3ee', dragType: 'pattern', payload: '0 2 4 7 4 2' },
      { id: 'pat_mel_sparse', label: 'Sparse', icon: '·', desc: 'Minimal melody', color: '#22d3ee', dragType: 'pattern', payload: '~ 0 ~ ~ 4 ~ 2 ~' },
      { id: 'pat_mel_jazzy', label: 'Jazzy', icon: '🎷', desc: 'Jazz intervals', color: '#22d3ee', dragType: 'pattern', payload: '0 4 7 11 9 7 4 2' },
    ]
  },
]

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

function detectType(code: string): NodeType {
  const c = code.toLowerCase()
  if (/\bs\s*\(\s*["'].*?(bd|cp|sd|hh|oh|ch|rim|tom|clap|clave|ride|crash)/i.test(code)) return 'drums'
  if (/\.bank\s*\(/.test(code) && !/note\s*\(/.test(code)) return 'drums'
  if (/note\s*\(.*?[12]\b/.test(code) && /bass|sub|sine/i.test(code)) return 'bass'
  if (c.includes('bass') || c.includes('sub')) return 'bass'
  if (/note\s*\(.*?\[.*?,.*?\]/.test(code)) return 'chords'
  if (c.includes('chord') || c.includes('rhodes')) return 'chords'
  if (c.includes('pad') || c.includes('ambient') || c.includes('drone') || c.includes('haze')) return 'pad'
  if (c.includes('vocal') || c.includes('voice') || c.includes('choir') || c.includes('sing')) return 'vocal'
  if (/crackle|rumble|noise|texture/i.test(code)) return 'fx'
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
  // Match .method( followed by a number (may be preceded by slider(, etc.)
  const re = new RegExp(`\\.${method}\\s*\\(\\s*(?:slider\\s*\\(\\s*)?([0-9.]+)`)
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
  const sm = code.match(/\bs\s*\(\s*["']([^"']+)["']/)
  if (sm && /bd|sd|cp|hh|oh/i.test(sm[1])) return sm[1]
  const nm = code.match(/\b(?:note|n)\s*\(\s*["']([^"']+)["']/)
  return nm ? nm[1] : ''
}

function detectSoundSource(code: string): string {
  const a = code.match(/\)\.s\s*\(\s*["']([^"']+)["']/)
  if (a) return a[1]
  const b = code.match(/\.bank\s*\(\s*["']([^"']+)["']/)
  if (b) return b[1]
  const c2 = code.match(/\bs\s*\(\s*["'](sine|sawtooth|square|triangle|supersaw)["']/)
  if (c2) return c2[1]
  const d = code.match(/\.s\s*\(\s*["'](gm_[^"']+)["']/)
  return d ? d[1] : ''
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
    // For muted blocks, strip the prefix to detect properties
    const rawCode = isMuted ? block.code.replace(/\/\/ \[muted\] /g, '') : block.code
    const type = detectType(rawCode)
    const sound = detectSound(rawCode)
    const isMelodic = type !== 'drums' && type !== 'fx' && type !== 'other'
    const detectedScale = detectScale(rawCode)

    nodes.push({
      id: existing?.id ?? `node_${idx}`,
      name: block.name || sound || `Pattern ${idx + 1}`,
      // ALWAYS store clean code (no // [muted] prefix). The muted FLAG tracks mute state.
      // This prevents prefix accumulation bugs on rapid mute/unmute/re-parse cycles.
      code: isMuted ? block.code.replace(/\/\/ \[muted\] /g, '') : block.code,
      muted: existing?.muted ?? isMuted,
      solo: existing?.solo ?? false,
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
 */
function reparseNodeFromCode(node: PatternNode): PatternNode {
  const rawCode = node.code.replace(/\/\/ \[muted\] /g, '')
  return {
    ...node,
    type: detectType(rawCode),
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
      return code
    }
    if (method === 'soundDotS') {
      const re1 = /\)\.s\s*\(\s*["'][^"']*["']\s*\)/
      if (re1.test(code)) return code.replace(re1, `).s("${value}")`)
      const re2 = /\bs\s*\(\s*["'](sine|sawtooth|square|triangle|supersaw|gm_[^"']+)["']\s*\)/
      if (re2.test(code)) return code.replace(re2, `s("${value}")`)
      return code
    }
    if (method === 'drumPattern') {
      const re = /\bs\s*\(\s*["'][^"']*["']\s*\)/
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
        onMouseDown={handleDown} onDoubleClick={handleDblClick}>
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
    const close = (e: MouseEvent) => {
      if (menuRef.current?.contains(e.target as Node)) return
      if (btnRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
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

function MiniScope({ color, active, type }: { color: string; active: boolean; type: NodeType }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef(0)
  const phaseRef = useRef(Math.random() * Math.PI * 2)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const W = canvas.width, H = canvas.height
    const draw = () => {
      ctx.clearRect(0, 0, W, H)
      if (!active) {
        ctx.beginPath(); ctx.strokeStyle = `${color}10`; ctx.lineWidth = 1
        for (let x = 0; x < W; x++) {
          const y = H / 2 + Math.sin(x / W * Math.PI * 4 + phaseRef.current) * H * 0.1
          x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
        }
        ctx.stroke(); return
      }
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
      rafRef.current = requestAnimationFrame(draw)
    }
    rafRef.current = requestAnimationFrame(draw)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [color, active, type])

  return <canvas ref={canvasRef} width={260} height={24} className="w-full rounded" style={{ height: 24 }} />
}

// ═══════════════════════════════════════════════════════════════
//  PORT
// ═══════════════════════════════════════════════════════════════

function Port({ side, color, connected, onMouseDown, onMouseUp, nodeId }: {
  side: 'in' | 'out'; color: string; connected: boolean
  onMouseDown: (e: React.MouseEvent, nodeId: string, side: 'in' | 'out') => void
  onMouseUp: (e: React.MouseEvent, nodeId: string, side: 'in' | 'out') => void
  nodeId: string
}) {
  return (
    <div className={`absolute ${
      side === 'out' ? 'bottom-0 right-4 translate-y-1/2' : 'top-0 left-4 -translate-y-1/2'
    } z-30 cursor-crosshair group`}
      onMouseDown={e => { e.stopPropagation(); onMouseDown(e, nodeId, side) }}
      onMouseUp={e => { e.stopPropagation(); onMouseUp(e, nodeId, side) }}>
      <div className="w-4 h-4 rounded-full transition-all group-hover:scale-125" style={{
        border: `2px solid ${connected ? color : HW.knobRing}`,
        backgroundColor: connected ? `${color}40` : HW.knobBg,
        boxShadow: connected ? `0 0 10px ${color}30, inset 0 0 4px ${color}20` : 'none',
      }} />
      <span className="absolute text-[6px] font-bold uppercase tracking-wider whitespace-nowrap"
        style={{ color: HW.textDim, ...(side === 'in' ? { left: 22, top: 2 } : { right: 22, top: 2 }) }}>
        {side === 'in' ? 'IN' : 'OUT'}
      </span>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

interface NodeEditorProps {
  code: string
  isPlaying: boolean
  onCodeChange: (newCode: string) => void
  onUpdate: () => void
}

export default function NodeEditor({ code, isPlaying, onCodeChange, onUpdate }: NodeEditorProps) {
  const [nodes, setNodes] = useState<PatternNode[]>([])
  const [bpm, setBpm] = useState(0)
  const [connections, setConnections] = useState<Connection[]>([])
  const [dragging, setDragging] = useState<{ id: string; ox: number; oy: number } | null>(null)
  const [zoom, setZoom] = useState(0.85)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const [showAddMenu, setShowAddMenu] = useState(false)
  const [linking, setLinking] = useState<{ fromId: string; side: 'in' | 'out'; mx: number; my: number } | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [sidebarSearch, setSidebarSearch] = useState('')
  const [sidebarCategory, setSidebarCategory] = useState<string | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [dropTarget, setDropTarget] = useState<string | null>(null)

  const panStart = useRef({ x: 0, y: 0, px: 0, py: 0 })
  const containerRef = useRef<HTMLDivElement>(null)
  const lastCodeRef = useRef(code)
  const commitTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Track the last code string WE sent to parent via sendToParent.
  // When useEffect([code]) fires, if code === lastSentCodeRef.current, we know
  // this change originated from us and skip re-parsing. This is immune to React
  // batching (unlike a boolean flag or counter, which can get out of sync when
  // React coalesces multiple setState calls into one render).
  const lastSentCodeRef = useRef<string | null>(null)
  const prevNodeCount = useRef(0)

  // Stable refs for latest state — avoids stale closures in callbacks
  const nodesRef = useRef(nodes)
  nodesRef.current = nodes
  const panRef = useRef(pan)
  panRef.current = pan
  // Track latest knob draft values synchronously (bypasses React render cycle)
  // updateKnob writes here, commitKnob reads — guarantees fresh value on mouseup
  const knobDraftRef = useRef<Map<string, number>>(new Map())

  // ── FULL SYNC from parent code ──
  // This is the ONLY place where we re-parse nodes from code.
  // It runs whenever the code prop changes AND it wasn't us who changed it.
  useEffect(() => {
    // Skip re-parse if this code change originated from us (sendToParent)
    if (lastSentCodeRef.current !== null && code === lastSentCodeRef.current) {
      lastSentCodeRef.current = null
      return
    }
    lastSentCodeRef.current = null
    // External code change (user typed in editor, loaded example, etc.)
    lastCodeRef.current = code
    const newBpm = extractBpm(code)
    setBpm(newBpm)

    let newConnections: Connection[] | null = null
    setNodes(prev => {
      const parsed = parseCodeToNodes(code, prev.length > 0 ? prev : undefined)
      // If node count changed significantly (new project loaded), reset connections
      if (Math.abs(parsed.length - prevNodeCount.current) > 2 || prevNodeCount.current === 0) {
        const conns: Connection[] = []
        for (let i = 1; i < parsed.length; i++) conns.push({ fromId: parsed[i - 1].id, toId: parsed[i].id })
        newConnections = conns
      }
      prevNodeCount.current = parsed.length
      return parsed
    })
    if (newConnections !== null) setConnections(newConnections)
  }, [code])

  // ── Init on mount ──
  useEffect(() => {
    const parsed = parseCodeToNodes(code)
    setNodes(parsed)
    setBpm(extractBpm(code))
    prevNodeCount.current = parsed.length
    const conns: Connection[] = []
    for (let i = 1; i < parsed.length; i++) conns.push({ fromId: parsed[i - 1].id, toId: parsed[i].id })
    setConnections(conns)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Send code change to parent ──
  const sendToParent = useCallback((newCode: string) => {
    lastCodeRef.current = newCode
    lastSentCodeRef.current = newCode
    onCodeChange(newCode)
    if (commitTimer.current) clearTimeout(commitTimer.current)
    commitTimer.current = setTimeout(() => onUpdate(), 80)
  }, [onCodeChange, onUpdate])

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
    for (const node of nodeList) {
      const commentLine = node.name ? `// ── ${node.name} ──` : ''
      if (node.muted) {
        const mutedCode = node.code.split('\n')
          .map(l => l.trim().startsWith('// [muted]') ? l : `// [muted] ${l}`)
          .join('\n')
        parts.push(commentLine ? `${commentLine}\n${mutedCode}` : mutedCode)
      } else {
        const cleanCode = node.code.replace(/\/\/ \[muted\] /g, '')
        parts.push(commentLine ? `${commentLine}\n${cleanCode}` : cleanCode)
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

  // ── BPM Change ──
  const handleBpmChange = useCallback((v: number) => {
    const clamped = Math.max(30, Math.min(300, Math.round(v)))
    setBpm(clamped)
    // Replace setcps line in current code
    let newCode = lastCodeRef.current
    const existing = newCode.match(/setcps\s*\([^)]*\)[^\n]*/)
    if (existing) {
      newCode = newCode.replace(existing[0], `setcps(${clamped}/60/4) // ${clamped} bpm`)
    } else {
      // Insert after preamble comments
      const lines = newCode.split('\n')
      let insertIdx = 0
      for (let i = 0; i < lines.length; i++) {
        const t = lines[i].trim()
        if (t.startsWith('$:') || t.startsWith('// [muted]')) break
        if (t === '' || t.startsWith('//')) insertIdx = i + 1
        else { insertIdx = i; break }
      }
      lines.splice(insertIdx, 0, `setcps(${clamped}/60/4) // ${clamped} bpm`)
      newCode = lines.join('\n')
    }
    sendToParent(newCode)
  }, [sendToParent])

  // ── Global Scale Change ──
  const handleGlobalScaleChange = useCallback((newScale: string) => {
    let codeToSend: string | null = null
    setNodes(prev => {
      const updated = prev.map(n => {
        if (n.type === 'drums' || n.type === 'fx' || n.type === 'other') return n
        const newCode = applyEffect(n.code, 'scale', newScale)
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
    if (codeToSend !== null) sendToParent(codeToSend)
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
    if (codeToSend !== null) sendToParent(codeToSend)
  }, [bpm, sendToParent, rebuildFullCodeFromNodes])

  // ── Delete / Duplicate ──
  const deleteNode = useCallback((id: string) => {
    let codeToSend: string | null = null
    setNodes(prev => {
      const updated = prev.filter(n => n.id !== id)
      codeToSend = rebuildFullCodeFromNodes(updated, bpm, lastCodeRef.current)
      prevNodeCount.current = updated.length
      return updated
    })
    setConnections(c => c.filter(conn => conn.fromId !== id && conn.toId !== id))
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
        muted: false, solo: false,
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
      const method = node.type === 'drums' ? 'bank' : 'soundDotS'
      const newCode = applyEffect(node.code, method, newSource)
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
      const method = node.type === 'drums' ? 'drumPattern' : 'notePattern'
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

  // ── Quick Add ──
  const addNode = useCallback((template: string) => {
    const tc = TYPE_COLORS
    const templates: Record<string, string> = {
      drums: `$: s("bd [~ bd] ~ ~, ~ cp ~ ~, hh*8")\n  .bank("RolandTR808").gain(0.7)\n  .scope({color:"${tc.drums}",thickness:2,smear:.88})`,
      bass: `$: note("<c2 f2 g2 c2>")\n  .s("sawtooth").lpf(400).gain(0.35)\n  .scale("C4:major")\n  .scope({color:"${tc.bass}",thickness:2.5,smear:.96})`,
      melody: `$: n("0 2 4 7 4 2").scale("C4:major")\n  .s("gm_piano").gain(0.3)\n  .room(0.4).delay(0.15)\n  .scope({color:"${tc.melody}",thickness:1,smear:.91})`,
      chords: `$: note("<[c3,e3,g3] [a2,c3,e3] [f2,a2,c3] [g2,b2,d3]>")\n  .s("gm_epiano1").gain(0.25).scale("C4:major")\n  .lpf(1800).room(0.5)\n  .slow(2)\n  .scope({color:"${tc.chords}",thickness:1,smear:.93})`,
      pad: `$: note("<[c3,g3,e4] [a2,e3,c4]>")\n  .s("sawtooth").lpf(800).gain(0.08).scale("C4:major")\n  .room(0.9).delay(0.3).delayfeedback(0.5)\n  .slow(4)\n  .fscope()`,
      fx: `$: s("hh*16").gain(0.06)\n  .delay(0.25).delayfeedback(0.5)\n  .room(0.6).lpf(2000).speed(2.5)\n  .scope({color:"${tc.fx}",thickness:1,smear:.95})`,
    }
    const t = templates[template] || templates.drums
    const newCode = lastCodeRef.current.trimEnd() + '\n\n// ── New ' + template + ' ──\n' + t + '\n'
    // Force re-parse on this structural change by NOT setting isInternalChange
    lastCodeRef.current = newCode
    onCodeChange(newCode)
    if (commitTimer.current) clearTimeout(commitTimer.current)
    commitTimer.current = setTimeout(() => onUpdate(), 80)
    setShowAddMenu(false)
  }, [onCodeChange, onUpdate])

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

  // ── Connection port handlers ──
  const startLink = useCallback((e: React.MouseEvent, nodeId: string, side: 'in' | 'out') => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    setLinking({ fromId: nodeId, side, mx: e.clientX - rect.left, my: e.clientY - rect.top })
  }, [])

  const endLink = useCallback((_e: React.MouseEvent, nodeId: string, side: 'in' | 'out') => {
    if (!linking || linking.fromId === nodeId || side === linking.side) { setLinking(null); return }
    const fromId = linking.side === 'out' ? linking.fromId : nodeId
    const toId = linking.side === 'out' ? nodeId : linking.fromId
    setConnections(prev => [...prev.filter(c => c.toId !== toId), { fromId, toId }])
    setLinking(null)
  }, [linking])

  const removeConnection = useCallback((fromId: string, toId: string) => {
    setConnections(prev => prev.filter(c => !(c.fromId === fromId && c.toId === toId)))
  }, [])

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
        const item: SidebarItem = JSON.parse(json)
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
          changeSoundSource(nodeId, item.payload)
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
    if (data) changeSoundSource(nodeId, data)
  }, [changeSoundSource, changeScale, changePattern, bpm, sendToParent, rebuildFullCodeFromNodes])

  // ── Apply sidebar item to a node (shared by drag-drop AND click-to-apply) ──
  const applySidebarItemToNode = useCallback((nodeId: string, item: SidebarItem) => {
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
      changeSoundSource(nodeId, item.payload)
    } else if (item.dragType === 'scale') {
      changeScale(nodeId, item.payload)
    } else if (item.dragType === 'chord' || item.dragType === 'pattern') {
      changePattern(nodeId, item.payload)
    }
  }, [changeSoundSource, changeScale, changePattern, bpm, sendToParent, rebuildFullCodeFromNodes])

  // ── Randomize pattern for a node ──
  const randomizePattern = useCallback((nodeId: string) => {
    let codeToSend: string | null = null
    setNodes(prev => {
      const node = prev.find(n => n.id === nodeId)
      if (!node) return prev
      const newPattern = randomPatternForType(node.type)
      const method = node.type === 'drums' ? 'drumPattern' : 'notePattern'
      const newCode = applyEffect(node.code, method, newPattern)
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
    if (linking) {
      const rect = containerRef.current?.getBoundingClientRect()
      if (rect) setLinking(prev => prev ? { ...prev, mx: e.clientX - rect.left, my: e.clientY - rect.top } : null)
      return
    }
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
  }, [dragging, isPanning, zoom, linking])

  const handleMouseUp = useCallback(() => {
    setDragging(null); setIsPanning(false); if (linking) setLinking(null)
  }, [linking])

  const handleBgMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.target === containerRef.current || (e.target as HTMLElement).classList.contains('node-grid-bg')) {
      setIsPanning(true)
      const p = panRef.current
      panStart.current = { x: e.clientX, y: e.clientY, px: p.x, py: p.y }
      setSelectedNode(null)
    }
  }, [])

  // Register canvas wheel listener imperatively with { passive: false } to allow preventDefault
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      setZoom(z => Math.max(0.25, Math.min(2, z + e.deltaY * -0.001)))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  // ── Connected ids ──
  const connectedIds = useMemo(() => {
    const ids = new Set<string>()
    connections.forEach(c => { ids.add(c.fromId); ids.add(c.toId) })
    if (connections.length === 0) nodes.forEach(n => ids.add(n.id))
    return ids
  }, [connections, nodes])

  // ── Current global scale (detected from majority of nodes) ──
  const globalScale = useMemo(() => {
    const melodicNodes = nodes.filter(n => n.type !== 'drums' && n.type !== 'fx' && n.type !== 'other')
    if (melodicNodes.length === 0) return 'C4:major'
    const counts = new Map<string, number>()
    melodicNodes.forEach(n => { const s = n.scale || 'C4:major'; counts.set(s, (counts.get(s) || 0) + 1) })
    let best = 'C4:major', bestCount = 0
    counts.forEach((c, s) => { if (c > bestCount) { best = s; bestCount = c } })
    return best
  }, [nodes])

  const NODE_W = 300

  // ════════════════════════════════════════════════════════════
  //  RENDER
  // ════════════════════════════════════════════════════════════

  return (
    <div className={`flex flex-col h-full select-none ${isFullscreen ? 'fixed inset-0 z-50' : ''}`} style={{ background: HW.bg, overflow: 'visible' }}>

      {/* ══════ TOP BAR ══════ */}
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
          <div className="relative">
            <button onClick={() => setShowAddMenu(p => !p)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold tracking-wider transition-all cursor-pointer"
              style={{ background: 'rgba(34,211,238,0.08)', border: '1px solid rgba(34,211,238,0.15)', color: '#22d3ee' }}>
              <Plus size={11} /> ADD
            </button>
            {showAddMenu && (
              <div className="absolute right-0 top-full mt-1 z-50 min-w-[160px] rounded-lg shadow-2xl overflow-hidden"
                style={{ background: '#0e0e11', border: `1px solid ${HW.borderLight}` }}>
                {(['drums', 'bass', 'melody', 'chords', 'pad', 'fx'] as const).map(t => (
                  <button key={t} onClick={() => addNode(t)}
                    className="w-full flex items-center gap-2.5 px-4 py-2 text-[11px] transition-colors cursor-pointer"
                    style={{ color: TYPE_COLORS[t] }}
                    onMouseEnter={e => { (e.currentTarget).style.background = `${TYPE_COLORS[t]}10` }}
                    onMouseLeave={e => { (e.currentTarget).style.background = 'transparent' }}>
                    <span className="text-[10px]">{TYPE_ICONS[t]}</span>
                    <span className="capitalize font-medium">{t}</span>
                  </button>
                ))}
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

      {/* ══════ MAIN AREA: SIDEBAR + CANVAS ══════ */}
      <div className="flex-1 flex min-h-0">

      {/* ══════ SIDEBAR ══════ */}
      {sidebarOpen && (
        <div className="flex flex-col shrink-0 border-r overflow-hidden" style={{
          width: 220, background: HW.surface, borderColor: HW.border,
        }}>
          {/* Search */}
          <div className="px-2 py-2 shrink-0" style={{ borderBottom: `1px solid ${HW.border}` }}>
            <input
              type="text" value={sidebarSearch} onChange={e => setSidebarSearch(e.target.value)}
              placeholder="Search effects, sounds..."
              className="w-full px-2 py-1 rounded text-[10px] outline-none"
              style={{ background: HW.raised, border: `1px solid ${HW.border}`, color: HW.textBright }}
              onClick={e => e.stopPropagation()}
            />
          </div>
          {/* Categories */}
          <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: `${HW.raisedLight} transparent` }}>
            {SIDEBAR_CATEGORIES.map(cat => {
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
                          onClick={() => {
                            if (selectedNode) applySidebarItemToNode(selectedNode, item)
                          }}
                          className={`flex items-center gap-2 px-2 py-1 rounded text-[9px] transition-colors group ${
                            selectedNode ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing'
                          }`}
                          style={{ color: HW.text }}
                          onMouseEnter={e => { e.currentTarget.style.background = `${item.color}10`; e.currentTarget.style.color = item.color }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = HW.text }}
                          title={selectedNode ? `Click to apply to selected node: ${item.desc}` : `Drag onto a node: ${item.desc}`}
                        >
                          <span className="text-[10px] shrink-0 w-4 text-center">{item.icon}</span>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{item.label}</div>
                            <div className="text-[7px] truncate" style={{ color: HW.textDim }}>{item.desc}</div>
                          </div>
                          <span className="text-[7px] opacity-0 group-hover:opacity-60 shrink-0">
                            {selectedNode ? 'click✓' : 'drag→'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          {/* Sidebar footer hint */}
          <div className="px-3 py-1.5 shrink-0 text-[7px]" style={{ color: HW.textDim, borderTop: `1px solid ${HW.border}` }}>
            {selectedNode
              ? <span style={{ color: '#22d3ee' }}>● Node selected — click items to apply</span>
              : 'Drag items onto nodes · or select a node first'
            }
          </div>
        </div>
      )}

      {/* ══════ CANVAS ══════ */}
      <div ref={containerRef}
        className="flex-1 relative cursor-grab active:cursor-grabbing"
        style={{ overflow: 'hidden' }}
        onMouseDown={handleBgMouseDown} onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>

        {/* Dot grid */}
        <div className="node-grid-bg absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle, ${HW.surfaceAlt} 1px, transparent 1px)`,
          backgroundSize: `${20 * zoom}px ${20 * zoom}px`,
          backgroundPosition: `${pan.x * zoom}px ${pan.y * zoom}px`,
        }} />

        {/* SVG: connections */}
        <svg className="absolute inset-0 pointer-events-none" style={{ width: '100%', height: '100%' }}>
          {connections.map((conn, i) => {
            const from = nodes.find(n => n.id === conn.fromId)
            const to = nodes.find(n => n.id === conn.toId)
            if (!from || !to) return null
            const x1 = (from.x + NODE_W - 16 + pan.x) * zoom
            const fromH = from.type !== 'drums' && from.type !== 'fx' && from.type !== 'other' ? 780 : 520
            const y1 = (from.y + fromH + pan.y) * zoom
            const x2 = (to.x + 16 + pan.x) * zoom
            const y2 = (to.y + pan.y) * zoom
            const mid = (y1 + y2) / 2
            const col = TYPE_COLORS[from.type]
            return (
              <g key={i}>
                <path d={`M ${x1} ${y1} C ${x1} ${mid}, ${x2} ${mid}, ${x2} ${y2}`}
                  fill="none" stroke="black" strokeWidth={4} strokeOpacity={0.2} />
                <path d={`M ${x1} ${y1} C ${x1} ${mid}, ${x2} ${mid}, ${x2} ${y2}`}
                  fill="none" stroke={col} strokeWidth={2} strokeOpacity={0.4} />
                <path d={`M ${x1} ${y1} C ${x1} ${mid}, ${x2} ${mid}, ${x2} ${y2}`}
                  fill="none" stroke="transparent" strokeWidth={14}
                  className="cursor-pointer pointer-events-auto" onClick={() => removeConnection(conn.fromId, conn.toId)} />
                {isPlaying && !from.muted && !to.muted && (
                  <circle r={3 * zoom} fill={col} opacity={0.7}>
                    <animateMotion dur="1.5s" repeatCount="indefinite"
                      path={`M ${x1} ${y1} C ${x1} ${mid}, ${x2} ${mid}, ${x2} ${y2}`} />
                  </circle>
                )}
              </g>
            )
          })}
          {linking && (() => {
            const from = nodes.find(n => n.id === linking.fromId)
            if (!from) return null
            const fx = linking.side === 'out' ? (from.x + NODE_W - 16 + pan.x) * zoom : (from.x + 16 + pan.x) * zoom
            const fromH2 = from.type !== 'drums' && from.type !== 'fx' && from.type !== 'other' ? 780 : 520
            const fy = linking.side === 'out' ? (from.y + fromH2 + pan.y) * zoom : (from.y + pan.y) * zoom
            return <line x1={fx} y1={fy} x2={linking.mx} y2={linking.my}
              stroke="#22d3ee" strokeWidth={2} strokeDasharray="6 3" opacity={0.6} />
          })()}
        </svg>

        {/* ══════ NODES ══════ */}
        {nodes.map(node => {
          const color = TYPE_COLORS[node.type]
          const isSel = selectedNode === node.id
          const isLive = connectedIds.has(node.id)
          const isActive = isPlaying && !node.muted && isLive
          const presets = SOUND_PRESETS[node.type] || SOUND_PRESETS.other
          const isMelodic = node.type !== 'drums' && node.type !== 'fx' && node.type !== 'other'

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
                <Port side="in" color={color} connected={connections.some(c => c.toId === node.id)}
                  onMouseDown={startLink} onMouseUp={endLink} nodeId={node.id} />
                <Port side="out" color={color} connected={connections.some(c => c.fromId === node.id)}
                  onMouseDown={startLink} onMouseUp={endLink} nodeId={node.id} />

                {/* Node body — NO overflow:hidden so dropdowns can escape */}
                <div className={`rounded-xl transition-all duration-200 ${
                  node.muted ? 'opacity-20 grayscale' : !isLive ? 'opacity-35' : ''
                }`} style={{
                  background: `linear-gradient(180deg, ${HW.surfaceAlt} 0%, ${HW.surface} 100%)`,
                  border: `1px solid ${isSel ? `${color}50` : isActive ? `${color}25` : HW.border}`,
                  boxShadow: isSel ? `0 0 30px ${color}15, 0 8px 32px rgba(0,0,0,0.6), inset 0 1px 0 ${HW.borderLight}`
                    : `0 2px 12px rgba(0,0,0,0.4), inset 0 1px 0 ${HW.borderLight}`,
                }}>

                  {/* HEADER */}
                  <div className="flex items-center gap-2 px-3 py-2 cursor-grab active:cursor-grabbing rounded-t-xl"
                    onMouseDown={e => handleMouseDown(e, node.id)}
                    style={{ background: `linear-gradient(180deg, ${color}08 0%, transparent 100%)`, borderBottom: `1px solid ${HW.border}` }}>
                    <GripHorizontal size={10} style={{ color: HW.textDim }} className="shrink-0" />
                    <div className="w-5 h-5 rounded-md flex items-center justify-center text-[10px]"
                      style={{ background: `${color}15`, color, boxShadow: isActive ? `0 0 8px ${color}30` : 'none' }}>
                      {TYPE_ICONS[node.type]}
                    </div>
                    <span className="text-[11px] font-bold truncate flex-1 tracking-wide" style={{ color }}>{node.name || 'Untitled'}</span>
                    <button onClick={e => { e.stopPropagation(); toggleSolo(node.id) }}
                      className="w-5 h-5 flex items-center justify-center rounded text-[8px] font-black cursor-pointer"
                      style={{
                        background: node.solo ? 'rgba(245,158,11,0.2)' : HW.raised,
                        color: node.solo ? '#f59e0b' : HW.textDim,
                        border: `1px solid ${node.solo ? 'rgba(245,158,11,0.3)' : HW.border}`,
                      }}>S</button>
                    <button onClick={e => { e.stopPropagation(); toggleMute(node.id) }}
                      className="w-5 h-5 flex items-center justify-center rounded cursor-pointer"
                      style={{
                        background: node.muted ? 'rgba(239,68,68,0.15)' : HW.raised,
                        border: `1px solid ${node.muted ? 'rgba(239,68,68,0.25)' : HW.border}`,
                      }}>
                      {node.muted ? <VolumeX size={10} color="#ef4444" /> : <Volume2 size={10} style={{ color: `${color}80` }} />}
                    </button>
                  </div>

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
                    <MiniScope color={color} active={isActive} type={node.type} />
                  </div>

                  {/* ══════ CODE-DRIVEN KNOBS ══════
                       Only show knobs for effects that EXIST in this node's code.
                       VOL (gain) always shows. Everything else is conditional.
                       This makes the node a true visual representation of the code. */}

                  {/* ALWAYS: Volume */}
                  <div className="px-2 py-2">
                    <div className="flex items-center gap-1 mb-1 px-1">
                      <div className="h-px flex-1" style={{ background: HW.border }} />
                      <span className="text-[7px] font-bold tracking-[0.2em] uppercase" style={{ color: HW.textDim }}>MIX</span>
                      <div className="h-px flex-1" style={{ background: HW.border }} />
                    </div>
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
                    </div>
                  </div>

                  {/* FILTER — only if lpf/hpf/bpf in code */}
                  {(hasMethod(node.code, 'lpf') || hasMethod(node.code, 'hpf') || hasMethod(node.code, 'bpf')) && (
                    <div className="px-2 pb-2">
                      <div className="flex items-center gap-1 mb-1 px-1">
                        <div className="h-px flex-1" style={{ background: HW.border }} />
                        <span className="text-[7px] font-bold tracking-[0.2em] uppercase" style={{ color: HW.textDim }}>FILTER</span>
                        <div className="h-px flex-1" style={{ background: HW.border }} />
                      </div>
                      <div className="flex items-start justify-center gap-0.5 flex-wrap">
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
                      </div>
                    </div>
                  )}

                  {/* SPACE — only if room/delay in code */}
                  {(hasMethod(node.code, 'room') || hasMethod(node.code, 'delay')) && (
                    <div className="px-2 pb-2">
                      <div className="flex items-center gap-1 mb-1 px-1">
                        <div className="h-px flex-1" style={{ background: HW.border }} />
                        <span className="text-[7px] font-bold tracking-[0.2em] uppercase" style={{ color: HW.textDim }}>SPACE</span>
                        <div className="h-px flex-1" style={{ background: HW.border }} />
                      </div>
                      <div className="flex items-start justify-center gap-0.5 flex-wrap">
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
                      </div>
                    </div>
                  )}

                  {/* DRIVE — only if distort/crush/phaser/coarse/shape in code */}
                  {(hasMethod(node.code, 'distort') || hasMethod(node.code, 'crush') || hasMethod(node.code, 'phaser') || hasMethod(node.code, 'coarse') || hasMethod(node.code, 'shape')) && (
                    <div className="px-2 pb-2">
                      <div className="flex items-center gap-1 mb-1 px-1">
                        <div className="h-px flex-1" style={{ background: HW.border }} />
                        <span className="text-[7px] font-bold tracking-[0.2em] uppercase" style={{ color: HW.textDim }}>DRIVE</span>
                        <div className="h-px flex-1" style={{ background: HW.border }} />
                      </div>
                      <div className="flex items-start justify-center gap-0.5 flex-wrap">
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
                            disabled={hasDynamic(node.code, 'coarse')} size={36} />
                        )}
                      </div>
                    </div>
                  )}

                  {/* ADSR — only if any envelope param in code */}
                  {(hasMethod(node.code, 'attack') || hasMethod(node.code, 'decay') || hasMethod(node.code, 'sustain') || hasMethod(node.code, 'release')) && (
                    <div className="px-2 pb-2">
                      <div className="flex items-center gap-1 mb-1 px-1">
                        <div className="h-px flex-1" style={{ background: HW.border }} />
                        <span className="text-[7px] font-bold tracking-[0.2em] uppercase" style={{ color: HW.textDim }}>ADSR</span>
                        <div className="h-px flex-1" style={{ background: HW.border }} />
                      </div>
                      <div className="flex items-start justify-center gap-0.5 flex-wrap">
                        <RotaryKnob label="ATK" value={node.attack} min={0} max={2} step={0.01} defaultValue={0.001} suffix="s"
                          onChange={v => updateKnob(node.id, 'attack', v)} onCommit={() => commitKnob(node.id, 'attack', node.attack)} color={color}
                          disabled={hasDynamic(node.code, 'attack')} />
                        <RotaryKnob label="DEC" value={node.decay} min={0} max={2} step={0.01} defaultValue={0.1} suffix="s"
                          onChange={v => updateKnob(node.id, 'decay', v)} onCommit={() => commitKnob(node.id, 'decay', node.decay)} color={color}
                          disabled={hasDynamic(node.code, 'decay')} />
                        <RotaryKnob label="SUS" value={node.sustain} min={0} max={1} step={0.01} defaultValue={0.5}
                          onChange={v => updateKnob(node.id, 'sustain', v)} onCommit={() => commitKnob(node.id, 'sustain', node.sustain)} color={color}
                          disabled={hasDynamic(node.code, 'sustain')} />
                        <RotaryKnob label="REL" value={node.release} min={0} max={4} step={0.01} defaultValue={0.1} suffix="s"
                          onChange={v => updateKnob(node.id, 'release', v)} onCommit={() => commitKnob(node.id, 'release', node.release)} color={color}
                          disabled={hasDynamic(node.code, 'release')} />
                      </div>
                    </div>
                  )}

                  {/* FM — only if fmi in code */}
                  {hasMethod(node.code, 'fmi') && (
                    <div className="px-2 pb-2">
                      <div className="flex items-center gap-1 mb-1 px-1">
                        <div className="h-px flex-1" style={{ background: HW.border }} />
                        <span className="text-[7px] font-bold tracking-[0.2em] uppercase" style={{ color: HW.textDim }}>FM</span>
                        <div className="h-px flex-1" style={{ background: HW.border }} />
                      </div>
                      <div className="flex items-start justify-center gap-0.5 flex-wrap">
                        <RotaryKnob label="FM" value={node.fmi} min={0} max={8} step={0.1} defaultValue={0}
                          onChange={v => updateKnob(node.id, 'fmi', v)} onCommit={() => commitKnob(node.id, 'fmi', node.fmi)} color={color}
                          disabled={hasDynamic(node.code, 'fmi')} />
                      </div>
                    </div>
                  )}

                  {/* ══════ QUICK FX CHIPS ══════ */}
                  <div className="px-2 pb-2">
                    <div className="flex items-center gap-1 mb-1 px-1">
                      <div className="h-px flex-1" style={{ background: HW.border }} />
                      <span className="text-[7px] font-bold tracking-[0.2em] uppercase" style={{ color: HW.textDim }}>QUICK FX</span>
                      <div className="h-px flex-1" style={{ background: HW.border }} />
                    </div>
                    <div className="flex flex-wrap gap-[3px] px-0.5">
                      {QUICK_FX.map(fx => {
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
                            }}
                            onMouseEnter={e => { if (!isOn) (e.currentTarget).style.borderColor = `${fx.color}30` }}
                            onMouseLeave={e => { if (!isOn) (e.currentTarget).style.borderColor = HW.border }}
                          >
                            <span className="mr-0.5">{fx.icon}</span>{fx.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* ══════ LFO ASSIGN ══════ */}
                  <QuickLFOPanel nodeId={node.id} color={color} onAssign={injectLFO} />

                  {/* SELECTORS */}
                  <div className="px-3 pb-2 space-y-1" style={{ overflow: 'visible' }}>
                    <div className="flex items-center gap-1 mb-1">
                      <div className="h-px flex-1" style={{ background: HW.border }} />
                      <span className="text-[7px] font-bold tracking-[0.2em] uppercase" style={{ color: HW.textDim }}>SOURCE</span>
                      <div className="h-px flex-1" style={{ background: HW.border }} />
                    </div>
                    <HardwareSelect label="SND" value={node.soundSource} options={presets}
                      onChange={v => changeSoundSource(node.id, v)} color={color} />
                    {node.type === 'drums' ? (
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
                        <div className="flex-1"><HardwareSelect label="CHD" value={node.pattern} options={CHORD_PROGRESSIONS}
                          onChange={v => changePattern(node.id, v)} color={color} /></div>
                        <button onClick={e => { e.stopPropagation(); randomizePattern(node.id) }}
                          className="w-6 h-6 flex items-center justify-center rounded text-[11px] cursor-pointer shrink-0 transition-all hover:scale-110"
                          style={{ background: `${color}10`, border: `1px solid ${color}25`, color }}
                          title="Random chords">🎲</button>
                      </div>
                    ) : node.type === 'bass' ? (
                      <div className="flex items-center gap-1">
                        <div className="flex-1"><HardwareSelect label="PAT" value={node.pattern} options={BASS_PATTERNS}
                          onChange={v => changePattern(node.id, v)} color={color} /></div>
                        <button onClick={e => { e.stopPropagation(); randomizePattern(node.id) }}
                          className="w-6 h-6 flex items-center justify-center rounded text-[11px] cursor-pointer shrink-0 transition-all hover:scale-110"
                          style={{ background: `${color}10`, border: `1px solid ${color}25`, color }}
                          title="Random bassline">🎲</button>
                      </div>
                    ) : isMelodic ? (
                      <div className="flex items-center gap-1">
                        <div className="flex-1"><HardwareSelect label="PAT" value={node.pattern} options={MELODY_PATTERNS}
                          onChange={v => changePattern(node.id, v)} color={color} /></div>
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
                      {!isLive && (
                        <span className="text-[7px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider"
                          style={{ color: '#f59e0b', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.15)' }}>
                          disconnected
                        </span>
                      )}
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
      </div>

      {/* Close sidebar+canvas flex container */}
      </div>

      {/* ══════ STATUS BAR ══════ */}
      <div className="flex items-center justify-between px-4 py-1 shrink-0"
        style={{ background: HW.surface, borderTop: `1px solid ${HW.border}` }}>
        <span className="text-[8px] tracking-wide" style={{ color: HW.textDim }}>
          knobs show what&apos;s in code · drag effects to add · click sidebar with node selected · 🎲 randomize patterns
        </span>
        <div className="flex items-center gap-3 text-[8px] font-mono tabular-nums" style={{ color: HW.textDim }}>
          <span>{connections.length} links</span>
          <span>{nodes.filter(n => !n.muted).length}/{nodes.length} active</span>
          <span style={{ color: '#22d3ee80' }}>{bpm || 72} bpm</span>
          <span style={{ color: '#a78bfa80' }}>{SCALE_PRESETS.find(s => s.value === globalScale)?.label || globalScale}</span>
        </div>
      </div>
    </div>
  )
}
