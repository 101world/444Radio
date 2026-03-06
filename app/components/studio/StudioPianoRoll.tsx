'use client'

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  STUDIO PIANO ROLL â€” Strudel-native note editor
//
//  Designed for the Studio workflow:
//  â€¢ Scale-degree mode: outputs numbers for n().scale("root:mode")
//  â€¢ 16 steps = 1 Strudel cycle (bar). Supports 1/2/4 bars.
//  â€¢ Only writes to code on user interaction (never on mount)
//  â€¢ Click to place/remove notes, hear preview
//  â€¢ Auto-detects scale from code, highlights in-scale rows
//  â€¢ Outputs clean mini-notation that maps 1:1 to Strudel timing
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import type { ParsedChannel } from '@/lib/strudel-code-parser'
import { getParamDef, getArpInfo, getTranspose, ARP_MODES, DRAGGABLE_EFFECTS } from '@/lib/strudel-code-parser'
import StudioKnob from './StudioKnob'

// â”€â”€â”€ Music theory â”€â”€â”€

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

// Roman numeral labels for scale degrees
const ROMAN_NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII']

/** Identify a chord from a set of MIDI notes. Returns chord name or null. */
function identifyChord(midiNotes: number[]): string | null {
  if (midiNotes.length < 2) return null
  const sorted = [...midiNotes].sort((a, b) => a - b)
  const root = sorted[0]
  const rootName = NOTE_NAMES[root % 12]
  // Get intervals relative to root (mod 12, deduplicated)
  const intervals = [...new Set(sorted.map(m => ((m - root) % 12 + 12) % 12))].sort((a, b) => a - b)
  const key = intervals.join(',')

  const CHORD_NAMES: Record<string, string> = {
    '0,4,7': 'maj',      '0,3,7': 'min',      '0,3,6': 'dim',
    '0,4,8': 'aug',      '0,5,7': 'sus4',     '0,2,7': 'sus2',
    '0,4,7,11': 'maj7',  '0,3,7,10': 'min7',  '0,4,7,10': '7',
    '0,3,6,9': 'dim7',   '0,3,6,10': 'm7b5',  '0,4,8,11': 'maj7#5',
    '0,3,7,11': 'mMaj7', '0,4,7,10,14': '9',  '0,2,4,7': 'add2',
    '0,4,7,14': 'add9',  '0,3,7,14': 'madd9', '0,4,7,9': '6',
    '0,3,7,9': 'm6',     '0,5,7,10': '7sus4', '0,2,7,10': '7sus2',
    '0,7': '5',
  }

  const name = CHORD_NAMES[key]
  if (name) return `${rootName}${name}`

  // Try inversions: rotate intervals
  for (let inv = 1; inv < sorted.length; inv++) {
    const invRoot = sorted[inv]
    const invRootName = NOTE_NAMES[invRoot % 12]
    const invIntervals = [...new Set(sorted.map(m => ((m - invRoot) % 12 + 12) % 12))].sort((a, b) => a - b)
    const invKey = invIntervals.join(',')
    const invName = CHORD_NAMES[invKey]
    if (invName) return `${invRootName}${invName}/${rootName}`
  }
  return null
}

/** Get the diatonic chord quality at each scale degree (for chord palette) */
function getDiatonicChords(scale: string): { degree: number; roman: string; quality: string; notes: number[] }[] {
  const { root, octave, mode } = parseScaleStr(scale)
  const intervals = SCALE_INTERVALS[mode] || SCALE_INTERVALS.minor
  const chords: { degree: number; roman: string; quality: string; notes: number[] }[] = []

  for (let deg = 0; deg < intervals.length && deg < 7; deg++) {
    const rootMidi = degreeToMidi(deg, scale)
    const thirdMidi = degreeToMidi(deg + 2, scale)
    const fifthMidi = degreeToMidi(deg + 4, scale)

    // Determine quality from intervals
    const thirdInterval = ((thirdMidi - rootMidi) % 12 + 12) % 12
    const fifthInterval = ((fifthMidi - rootMidi) % 12 + 12) % 12

    let quality = ''
    let roman = ROMAN_NUMERALS[deg] || String(deg + 1)
    if (thirdInterval === 4 && fifthInterval === 7) { quality = ''; /* major */ }
    else if (thirdInterval === 3 && fifthInterval === 7) { quality = 'm'; roman = roman.toLowerCase() }
    else if (thirdInterval === 3 && fifthInterval === 6) { quality = 'dim'; roman = roman.toLowerCase() + '°' }
    else if (thirdInterval === 4 && fifthInterval === 8) { quality = 'aug'; roman = roman + '+' }
    else { quality = ''; }

    chords.push({ degree: deg, roman, quality, notes: [rootMidi, thirdMidi, fifthMidi] })
  }
  return chords
}

const SCALE_INTERVALS: Record<string, number[]> = {
  major:            [0, 2, 4, 5, 7, 9, 11],
  minor:            [0, 2, 3, 5, 7, 8, 10],
  'harmonic minor': [0, 2, 3, 5, 7, 8, 11],
  dorian:           [0, 2, 3, 5, 7, 9, 10],
  phrygian:         [0, 1, 3, 5, 7, 8, 10],
  lydian:           [0, 2, 4, 6, 7, 9, 11],
  mixolydian:       [0, 2, 4, 5, 7, 9, 10],
  'minor pentatonic': [0, 3, 5, 7, 10],
  'major pentatonic': [0, 2, 4, 7, 9],
  blues:            [0, 3, 5, 6, 7, 10],
  chromatic:        [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
}

function parseScaleStr(s: string): { root: string; octave: number; mode: string } {
  const m = s.match(/^([A-Ga-g]#?)(\d+):(.+)$/)
  if (!m) return { root: 'C', octave: 4, mode: 'minor' }
  return { root: m[1].toUpperCase(), octave: parseInt(m[2]), mode: m[3] }
}

/** Build the set of MIDI notes that belong to the scale */
function getScaleMidiSet(scale: string, lo: number, hi: number): Set<number> {
  const { root, mode } = parseScaleStr(scale)
  const intervals = SCALE_INTERVALS[mode] || SCALE_INTERVALS.minor
  const rootIdx = NOTE_NAMES.indexOf(root)
  if (rootIdx < 0) return new Set()
  const set = new Set<number>()
  for (let oct = Math.floor(lo / 12) - 1; oct <= Math.ceil(hi / 12) + 1; oct++) {
    for (const iv of intervals) {
      const midi = (oct + 1) * 12 + rootIdx + iv
      if (midi >= lo && midi <= hi) set.add(midi)
    }
  }
  return set
}

/** Convert scale degree â†’ MIDI (matches Strudel n().scale() behaviour) */
function degreeToMidi(deg: number, scale: string): number {
  const { root, octave, mode } = parseScaleStr(scale)
  const intervals = SCALE_INTERVALS[mode] || SCALE_INTERVALS.minor
  const rootIdx = NOTE_NAMES.indexOf(root)
  const baseMidi = (octave + 1) * 12 + rootIdx
  const len = intervals.length
  const octShift = deg >= 0
    ? Math.floor(deg / len)
    : Math.ceil(deg / len) - (deg % len === 0 ? 0 : 1)
  const inScale = ((deg % len) + len) % len
  return baseMidi + octShift * 12 + (intervals[inScale] ?? 0)
}

/** Convert MIDI â†’ closest scale degree */
function midiToDegree(midi: number, scale: string): number | null {
  const { root, octave, mode } = parseScaleStr(scale)
  const intervals = SCALE_INTERVALS[mode] || SCALE_INTERVALS.minor
  const rootIdx = NOTE_NAMES.indexOf(root)
  const baseMidi = (octave + 1) * 12 + rootIdx
  const offset = midi - baseMidi
  const octShift = Math.floor(offset / 12)
  const semitone = ((offset % 12) + 12) % 12
  const degIdx = intervals.indexOf(semitone)
  if (degIdx === -1) return null
  return octShift * intervals.length + degIdx
}

function midiNoteName(midi: number): string {
  return NOTE_NAMES[midi % 12] + (Math.floor(midi / 12) - 1)
}

function isBlackKey(midi: number): boolean {
  return [1, 3, 6, 8, 10].includes(midi % 12)
}

// â”€â”€â”€ Note name conversions (for note() mode) â”€â”€â”€

const STRUDEL_NOTE_MAP: Record<string, number> = {
  'c': 0, 'cs': 1, 'db': 1, 'd': 2, 'ds': 3, 'eb': 3,
  'e': 4, 'fb': 4, 'f': 5, 'es': 5, 'fs': 6, 'gb': 6,
  'g': 7, 'gs': 8, 'ab': 8, 'a': 9, 'as': 10, 'bb': 10,
  'b': 11, 'cb': 11, 'bs': 0,
}

const STRUDEL_NOTE_NAMES_OUT = ['c', 'cs', 'd', 'ds', 'e', 'f', 'fs', 'g', 'gs', 'a', 'as', 'b']

/** Parse Strudel note name (e.g. "d3", "fs4", "eb2") â†’ MIDI number */
function strudelNoteToMidi(name: string): number | null {
  const m = name.trim().toLowerCase().match(/^([a-g])([#sb]?)(\d+)$/)
  if (!m) return null
  let accidental = m[2]
  if (accidental === '#') accidental = 's'
  const key = m[1] + (accidental === 's' || accidental === 'b' ? accidental : '')
  const semitone = STRUDEL_NOTE_MAP[key]
  if (semitone === undefined) return null
  return (parseInt(m[3]) + 1) * 12 + semitone
}

/** MIDI number â†’ Strudel lowercase note name (e.g. 50 â†’ "d3") */
function midiToStrudelNote(midi: number): string {
  return STRUDEL_NOTE_NAMES_OUT[midi % 12] + (Math.floor(midi / 12) - 1)
}

// â”€â”€â”€ Piano Roll Presets â€” mathematically generated patterns â”€â”€â”€

type PresetCategory = 'chords' | 'melodies' | 'arpeggios' | 'bass' | 'rhythmic'

interface PresetDef {
  name: string
  category: PresetCategory
  /** Scale degrees for each step. null = rest. Arrays = chord (multiple degrees at same step).
   *  Each entry: { deg, len } where len is note length in steps */
  generate: (stepsPerBar: number) => { step: number; deg: number; len: number }[]
}

/** Create a multi-bar variant by repeating/shifting a base pattern */
function shiftPattern(base: { step: number; deg: number; len: number }[], shiftDeg: number, barOffset: number, stepsPerBar: number) {
  return base.map(n => ({ step: n.step + barOffset * stepsPerBar, deg: n.deg + shiftDeg, len: n.len }))
}

const PIANO_PRESETS: PresetDef[] = [
  // â”€â”€ CHORDS â”€â”€
  {
    name: 'Iâ€“Vâ€“viâ€“IV',
    category: 'chords',
    generate: (spb) => {
      const q = spb / 4 // quarter note in steps
      return [
        // I chord (0, 2, 4)
        { step: 0, deg: 0, len: q }, { step: 0, deg: 2, len: q }, { step: 0, deg: 4, len: q },
        // V chord (4, 6, 8)
        { step: q, deg: 4, len: q }, { step: q, deg: 6, len: q }, { step: q, deg: 8, len: q },
        // vi chord (5, 7, 9)
        { step: q * 2, deg: 5, len: q }, { step: q * 2, deg: 7, len: q }, { step: q * 2, deg: 9, len: q },
        // IV chord (3, 5, 7)
        { step: q * 3, deg: 3, len: q }, { step: q * 3, deg: 5, len: q }, { step: q * 3, deg: 7, len: q },
      ]
    },
  },
  {
    name: 'iâ€“ivâ€“vâ€“i',
    category: 'chords',
    generate: (spb) => {
      const q = spb / 4
      return [
        { step: 0, deg: 0, len: q }, { step: 0, deg: 2, len: q }, { step: 0, deg: 4, len: q },
        { step: q, deg: 3, len: q }, { step: q, deg: 5, len: q }, { step: q, deg: 7, len: q },
        { step: q * 2, deg: 4, len: q }, { step: q * 2, deg: 6, len: q }, { step: q * 2, deg: 8, len: q },
        { step: q * 3, deg: 0, len: q }, { step: q * 3, deg: 2, len: q }, { step: q * 3, deg: 4, len: q },
      ]
    },
  },
  {
    name: 'Iâ€“viâ€“IVâ€“V',
    category: 'chords',
    generate: (spb) => {
      const q = spb / 4
      return [
        { step: 0, deg: 0, len: q }, { step: 0, deg: 2, len: q }, { step: 0, deg: 4, len: q },
        { step: q, deg: 5, len: q }, { step: q, deg: 7, len: q }, { step: q, deg: 9, len: q },
        { step: q * 2, deg: 3, len: q }, { step: q * 2, deg: 5, len: q }, { step: q * 2, deg: 7, len: q },
        { step: q * 3, deg: 4, len: q }, { step: q * 3, deg: 6, len: q }, { step: q * 3, deg: 8, len: q },
      ]
    },
  },
  {
    name: 'Sustained Pads',
    category: 'chords',
    generate: (spb) => {
      // Long held triad across full bar
      return [
        { step: 0, deg: 0, len: spb }, { step: 0, deg: 2, len: spb }, { step: 0, deg: 4, len: spb },
      ]
    },
  },
  {
    name: '7th Chords',
    category: 'chords',
    generate: (spb) => {
      const q = spb / 4
      return [
        // Imaj7
        { step: 0, deg: 0, len: q }, { step: 0, deg: 2, len: q }, { step: 0, deg: 4, len: q }, { step: 0, deg: 6, len: q },
        // IVmaj7
        { step: q, deg: 3, len: q }, { step: q, deg: 5, len: q }, { step: q, deg: 7, len: q }, { step: q, deg: 9, len: q },
        // viim7
        { step: q * 2, deg: 6, len: q }, { step: q * 2, deg: 8, len: q }, { step: q * 2, deg: 10, len: q }, { step: q * 2, deg: 12, len: q },
        // V7
        { step: q * 3, deg: 4, len: q }, { step: q * 3, deg: 6, len: q }, { step: q * 3, deg: 8, len: q }, { step: q * 3, deg: 10, len: q },
      ]
    },
  },

  // â”€â”€ MELODIES â”€â”€
  {
    name: 'Rising Scale',
    category: 'melodies',
    generate: (spb) => {
      const n = Math.min(spb, 8) // up to 8 notes
      const len = Math.max(1, Math.floor(spb / n))
      return Array.from({ length: n }, (_, i) => ({ step: i * len, deg: i, len }))
    },
  },
  {
    name: 'Falling Scale',
    category: 'melodies',
    generate: (spb) => {
      const n = Math.min(spb, 8)
      const len = Math.max(1, Math.floor(spb / n))
      return Array.from({ length: n }, (_, i) => ({ step: i * len, deg: 7 - i, len }))
    },
  },
  {
    name: 'Zigzag',
    category: 'melodies',
    generate: (spb) => {
      const degs = [0, 4, 2, 6, 1, 5, 3, 7]
      const n = Math.min(spb, 8)
      const len = Math.max(1, Math.floor(spb / n))
      return degs.slice(0, n).map((d, i) => ({ step: i * len, deg: d, len }))
    },
  },
  {
    name: 'Pentatonic Riff',
    category: 'melodies',
    generate: (spb) => {
      // Pentatonic: degrees 0,1,2,3,4 in a catchy pattern
      const pattern = [0, 2, 4, 2, 3, 1, 0, 4]
      const n = Math.min(pattern.length, spb)
      const len = Math.max(1, Math.floor(spb / n))
      return pattern.slice(0, n).map((d, i) => ({ step: i * len, deg: d, len }))
    },
  },
  {
    name: 'Call & Response',
    category: 'melodies',
    generate: (spb) => {
      const h = spb / 2
      const q = spb / 4
      const e = spb / 8
      return [
        // Call: quick ascending phrase in first half
        { step: 0, deg: 0, len: e }, { step: e, deg: 2, len: e },
        { step: e * 2, deg: 4, len: e }, { step: e * 3, deg: 5, len: e },
        // Response: sustained descent in second half
        { step: Math.round(h), deg: 7, len: q }, { step: Math.round(h + q), deg: 4, len: q },
      ]
    },
  },
  {
    name: 'Syncopated',
    category: 'melodies',
    generate: (spb) => {
      const e = spb / 8
      // Off-beat hits with varied lengths
      return [
        { step: Math.round(e), deg: 0, len: Math.round(e * 1.5) },
        { step: Math.round(e * 3), deg: 3, len: Math.round(e) },
        { step: Math.round(e * 4.5), deg: 2, len: Math.round(e * 1.5) },
        { step: Math.round(e * 6.5), deg: 5, len: Math.round(e * 1.5) },
      ]
    },
  },

  // â”€â”€ ARPEGGIOS â”€â”€
  {
    name: 'Arp Up',
    category: 'arpeggios',
    generate: (spb) => {
      const degs = [0, 2, 4, 7, 0 + 7, 4, 2, 0]
      const n = Math.min(degs.length, spb)
      const len = Math.max(1, Math.floor(spb / n))
      return degs.slice(0, n).map((d, i) => ({ step: i * len, deg: d, len }))
    },
  },
  {
    name: 'Arp Down',
    category: 'arpeggios',
    generate: (spb) => {
      const degs = [7, 4, 2, 0, -1, 2, 4, 7]
      const n = Math.min(degs.length, spb)
      const len = Math.max(1, Math.floor(spb / n))
      return degs.slice(0, n).map((d, i) => ({ step: i * len, deg: d, len }))
    },
  },
  {
    name: 'Arp Bounce',
    category: 'arpeggios',
    generate: (spb) => {
      const degs = [0, 4, 2, 6, 4, 2, 0, 4]
      const n = Math.min(degs.length, spb)
      const len = Math.max(1, Math.floor(spb / n))
      return degs.slice(0, n).map((d, i) => ({ step: i * len, deg: d, len }))
    },
  },
  {
    name: '16th Arp',
    category: 'arpeggios',
    generate: (spb) => {
      // Fast sixteenth-note arpeggio
      const degs = [0, 2, 4, 7, 9, 7, 4, 2, 0, 2, 4, 7, 9, 11, 9, 7]
      return degs.slice(0, spb).map((d, i) => ({ step: i, deg: d, len: 1 }))
    },
  },

  // â”€â”€ BASS â”€â”€
  {
    name: 'Root Octave',
    category: 'bass',
    generate: (spb) => {
      const q = spb / 4
      return [
        { step: 0, deg: 0 - 7, len: q },
        { step: q, deg: 0, len: q },
        { step: q * 2, deg: 0 - 7, len: q },
        { step: q * 3, deg: 0, len: q },
      ]
    },
  },
  {
    name: 'Walking Bass',
    category: 'bass',
    generate: (spb) => {
      const q = spb / 4
      return [
        { step: 0, deg: 0 - 7, len: q },
        { step: q, deg: 2 - 7, len: q },
        { step: q * 2, deg: 4 - 7, len: q },
        { step: q * 3, deg: 3 - 7, len: q },
      ]
    },
  },
  {
    name: 'Sub Pulse',
    category: 'bass',
    generate: (spb) => {
      // Deep sub bass: root held for half bar, then fifth
      const h = spb / 2
      return [
        { step: 0, deg: -7, len: h },
        { step: h, deg: -3, len: h },
      ]
    },
  },
  {
    name: 'Synth Bass',
    category: 'bass',
    generate: (spb) => {
      const e = spb / 8
      return [
        { step: 0, deg: -7, len: Math.round(e * 1.5) },
        { step: Math.round(e * 2), deg: -7, len: Math.round(e) },
        { step: Math.round(e * 3), deg: -5, len: Math.round(e * 1.5) },
        { step: Math.round(e * 5), deg: -4, len: Math.round(e) },
        { step: Math.round(e * 6), deg: -7, len: Math.round(e * 2) },
      ]
    },
  },

  // â”€â”€ RHYTHMIC â”€â”€
  {
    name: 'Stab',
    category: 'rhythmic',
    generate: (spb) => {
      const e = spb / 8
      // Rhythmic stabs on off-beats
      return [
        { step: 0, deg: 0, len: 1 }, { step: 0, deg: 2, len: 1 }, { step: 0, deg: 4, len: 1 },
        { step: Math.round(e * 3), deg: 0, len: 1 }, { step: Math.round(e * 3), deg: 2, len: 1 }, { step: Math.round(e * 3), deg: 4, len: 1 },
        { step: Math.round(e * 6), deg: 0, len: 1 }, { step: Math.round(e * 6), deg: 2, len: 1 }, { step: Math.round(e * 6), deg: 4, len: 1 },
      ]
    },
  },
  {
    name: 'Trance Gate',
    category: 'rhythmic',
    generate: (spb) => {
      // Every other step: on/off gate pattern
      const notes: { step: number; deg: number; len: number }[] = []
      for (let i = 0; i < spb; i += 2) {
        notes.push({ step: i, deg: 0, len: 1 })
        notes.push({ step: i, deg: 4, len: 1 })
      }
      return notes
    },
  },
  {
    name: 'Offbeat Chords',
    category: 'rhythmic',
    generate: (spb) => {
      const e = spb / 8
      // Reggae/dub offbeat stab pattern
      return [
        { step: Math.round(e), deg: 0, len: 1 }, { step: Math.round(e), deg: 2, len: 1 }, { step: Math.round(e), deg: 4, len: 1 },
        { step: Math.round(e * 3), deg: 0, len: 1 }, { step: Math.round(e * 3), deg: 2, len: 1 }, { step: Math.round(e * 3), deg: 4, len: 1 },
        { step: Math.round(e * 5), deg: 0, len: 1 }, { step: Math.round(e * 5), deg: 2, len: 1 }, { step: Math.round(e * 5), deg: 4, len: 1 },
        { step: Math.round(e * 7), deg: 0, len: 1 }, { step: Math.round(e * 7), deg: 2, len: 1 }, { step: Math.round(e * 7), deg: 4, len: 1 },
      ]
    },
  },
]

const PRESET_CATEGORIES: { key: PresetCategory; label: string; icon: string }[] = [
  { key: 'chords', label: 'Chords', icon: 'ðŸŽ¹' },
  { key: 'melodies', label: 'Melodies', icon: 'ðŸŽµ' },
  { key: 'arpeggios', label: 'Arpeggios', icon: 'ðŸ”„' },
  { key: 'bass', label: 'Bass', icon: 'ðŸŽ¸' },
  { key: 'rhythmic', label: 'Rhythmic', icon: 'âš¡' },
]

/** Apply a preset to the piano roll, converting scale degrees â†’ MIDI values */
function applyPreset(
  preset: PresetDef,
  scale: string,
  bars: number,
  stepsPerBar: number,
): Map<string, NoteData> {
  const baseNotes = preset.generate(stepsPerBar)
  const noteMap = new Map<string, NoteData>()
  const totalSteps = bars * stepsPerBar

  for (let bar = 0; bar < bars; bar++) {
    const offset = bar * stepsPerBar
    for (const n of baseNotes) {
      const step = n.step + offset
      if (step >= totalSteps) continue
      const midi = degreeToMidi(n.deg, scale)
      const clampedLen = Math.min(n.len, totalSteps - step)
      if (clampedLen > 0) {
        noteMap.set(`${midi}:${step}`, { length: clampedLen })
      }
    }
  }
  return noteMap
}

// â”€â”€â”€ Audio preview â”€â”€â”€

let previewCtx: AudioContext | null = null

function playPreview(midi: number, source: string) {
  if (!previewCtx) previewCtx = new AudioContext()
  if (previewCtx.state === 'suspended') previewCtx.resume()
  const osc = previewCtx.createOscillator()
  const gain = previewCtx.createGain()
  // Map Strudel source names to oscillator types
  const type: OscillatorType =
    source === 'sawtooth' || source === 'supersaw' ? 'sawtooth'
    : source === 'square' ? 'square'
    : source === 'sine' ? 'sine'
    : source === 'triangle' ? 'triangle'
    : source.startsWith('gm_') ? 'triangle' // GM instruments â†’ softer triangle
    : 'triangle'
  osc.type = type
  osc.frequency.value = 440 * Math.pow(2, (midi - 69) / 12)
  const now = previewCtx.currentTime
  gain.gain.setValueAtTime(0, now)
  gain.gain.linearRampToValueAtTime(0.12, now + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25)
  osc.connect(gain).connect(previewCtx.destination)
  osc.start()
  osc.stop(now + 0.3)
}

// â”€â”€â”€ Pattern parsing â”€â”€â”€

/** Parse a single token into notes on the grid (handles chords, rests, sub-groups, numbers/names) */
function parseToken(tok: string, step: number, scale: string, notes: Map<string, NoteData>, mode: 'degree' | 'note' = 'degree', defaultLength: number = 1) {
  // Rest: ~, ~~, -, etc.
  if (/^[~\-]+$/.test(tok)) return

  // Strip @length sustain â€” if no @ present, use the calculated span (defaultLength)
  const parseSustain = (s: string): { clean: string; length: number } => {
    const m = s.match(/^(.+?)@(\d+)$/)
    if (m) return { clean: m[1], length: parseInt(m[2]) }
    return { clean: s, length: defaultLength }
  }

  // Sub-group: [~ c2] or [a3 ~ b3 ~] â€” brackets with spaces, NOT commas (those are chords)
  // Recursively subdivide this token's span among sub-tokens
  if (tok.startsWith('[') && tok.endsWith(']') && !tok.includes(',')) {
    const inner = tok.slice(1, -1).trim()
    const subTokens = tokenizePattern(inner)
    if (subTokens.length > 0) {
      const subWeights = subTokens.map(tokenWeight)
      const subTotal = subWeights.reduce((a, b) => a + b, 0)
      let subCum = 0
      subTokens.forEach((subTok, si) => {
        const subStep = subTotal > 0
          ? step + Math.round(subCum * defaultLength / subTotal)
          : step + si
        const subSpan = subTotal > 0
          ? Math.max(1, Math.round(subWeights[si] * defaultLength / subTotal))
          : 1
        parseToken(subTok, subStep, scale, notes, mode, subSpan)
        subCum += subWeights[si]
      })
    }
    return
  }

  // Chord: [d3,f3,a3,c4] or [2,5] or [1,3,5] or [0,2,4]@4
  // Handles bracket-level @N weight: [a,b,c]@N
  if (tok.startsWith('[') && tok.includes(',')) {
    let chordInner: string
    let chordLength = defaultLength
    // Check for bracket-level weight: [a,b,c]@N
    const bracketWeightMatch = tok.match(/^\[(.+)\]@(\d+)$/)
    if (bracketWeightMatch) {
      chordInner = bracketWeightMatch[1]
      chordLength = parseInt(bracketWeightMatch[2])
    } else {
      chordInner = tok.replace(/^\[|\]$/g, '')
    }
    for (const part of chordInner.split(',')) {
      const partTrimmed = part.trim()
      // Check if element has its own @N (per-element overrides bracket-level)
      const atMatch = partTrimmed.match(/^(.+?)@(\d+)$/)
      const clean = atMatch ? atMatch[1] : partTrimmed
      const noteLen = atMatch ? parseInt(atMatch[2]) : chordLength
      if (mode === 'note') {
        const midi = strudelNoteToMidi(clean)
        if (midi !== null) notes.set(`${midi}:${step}`, { length: noteLen })
      } else {
        const num = parseInt(clean, 10)
        if (!isNaN(num)) {
          const midi = degreeToMidi(num, scale)
          notes.set(`${midi}:${step}`, { length: noteLen })
        }
      }
    }
    return
  }

  const { clean: cleanTok, length } = parseSustain(tok)

  if (mode === 'note') {
    // Note name: d3, fs4, eb2, etc.
    const midi = strudelNoteToMidi(cleanTok)
    if (midi !== null) notes.set(`${midi}:${step}`, { length })
  } else {
    // Single scale degree
    const num = parseInt(cleanTok, 10)
    if (!isNaN(num)) {
      const midi = degreeToMidi(num, scale)
      notes.set(`${midi}:${step}`, { length })
    }
  }
}

/** Tokenize a pattern string respecting brackets (so [2,5] stays as one token) */
function tokenizePattern(str: string): string[] {
  const tokens: string[] = []
  let depth = 0, current = ''
  for (const ch of str) {
    if (ch === '[' || ch === '<') { depth++; current += ch }
    else if (ch === ']' || ch === '>') { depth--; current += ch }
    else if (ch === ' ' && depth === 0) {
      if (current.trim()) tokens.push(current.trim())
      current = ''
    } else current += ch
  }
  if (current.trim()) tokens.push(current.trim())
  return tokens
}

/** Strip trailing Strudel speed modifiers like *2, /4, *1.5 from a PATTERN string.
 *  Only matches at the very end after the pattern content: `<...>*2` or `pattern/4`.
 *  Must NOT match numbers that are part of notes like `c3` or `5`. */
function stripSpeedMod(p: string): { clean: string; speedMod: string } {
  // Match >*2, >/4, >*1.5 at end of angle-bracket patterns
  const m = p.match(/^(<[\s\S]*>)([*/]\d+(?:\.\d+)?)$/)
  if (m) return { clean: m[1], speedMod: m[2] }
  // Match standalone multipliers/divisions but ONLY when preceded by whitespace or
  // a closing bracket — prevents matching the `*2` in note names like `bd*2`
  // inside a pattern (those are sub-divisions, not global speed mods).
  // Global speed mods don't appear inside quoted pattern strings in our architecture;
  // they're method calls (.fast()/.slow()) on the channel code, handled by slowFactor.
  return { clean: p, speedMod: '' }
}

/** Get the @-weight of a token ("c3@4" â†’ 4, "~" â†’ 1) */
function tokenWeight(tok: string): number {
  const m = tok.trim().match(/@(\d+)(?:\])?$/)
  return m ? parseInt(m[1]) : 1
}

/** Map tokens to step positions using cumulative weight (respects @N sustain) */
function mapTokensToSteps(
  tokens: string[],
  barOffset: number,
  scale: string,
  notes: Map<string, NoteData>,
  mode: 'degree' | 'note',
  stepsPerBar: number = 16,
) {
  const weights = tokens.map(tokenWeight)
  const totalWeight = weights.reduce((a, b) => a + b, 0)
  let cumWeight = 0
  tokens.forEach((tok, i) => {
    const step = totalWeight > 0
      ? barOffset + Math.round(cumWeight * stepsPerBar / totalWeight)
      : barOffset + i
    // Calculate how many grid steps this token actually spans
    const span = totalWeight > 0
      ? Math.max(1, Math.round(weights[i] * stepsPerBar / totalWeight))
      : 1
    parseToken(tok, step, scale, notes, mode, span)
    cumWeight += weights[i]
  })
}

/** Parse a Strudel mini-notation pattern into grid positions */
function parsePattern(
  pattern: string,
  scale: string,
  mode: 'degree' | 'note' = 'degree',
  stepsPerBar: number = 16,
): { notes: Map<string, NoteData>; bars: number; speedMod: string } {
  const notes = new Map<string, NoteData>()
  if (!pattern || !pattern.trim()) return { notes, bars: 1, speedMod: '' }

  const { clean: stripped, speedMod } = stripSpeedMod(pattern.trim())
  const trimmed = stripped.trim()
  const isMultiBar = trimmed.startsWith('<') && trimmed.endsWith('>')

  if (isMultiBar) {
    // <[bar1] [bar2] ...> or <entry1 entry2 ...>
    const inner = trimmed.slice(1, -1).trim()
    const entries = splitTopLevel(inner)
    entries.forEach((entry, barIdx) => {
      const barOffset = barIdx * stepsPerBar
      // Unwrap structural grouping brackets [0 ~ ~ ~] â†’ inner,
      // but keep chord brackets [d3,f3,a3,c4] intact (they contain commas, not spaces)
      const isChord = entry.startsWith('[') && entry.endsWith(']') && entry.includes(',')
      const isGrouping = entry.startsWith('[') && entry.endsWith(']') && !isChord
      const clean = isGrouping ? entry.slice(1, -1).trim() : entry
      const tokens = tokenizePattern(clean)
      mapTokensToSteps(tokens, barOffset, scale, notes, mode, stepsPerBar)
    })
    return { notes, bars: entries.length, speedMod }
  }

  // Single bar: "0 ~ [2,5] ~ 3 ~ ~ ~" or "d3 ~ f3 ~ g3 ~ ~ ~"
  const tokens = tokenizePattern(trimmed)
  mapTokensToSteps(tokens, 0, scale, notes, mode, stepsPerBar)
  return { notes, bars: 1, speedMod }
}

/** Split top-level entries respecting brackets */
function splitTopLevel(str: string): string[] {
  const entries: string[] = []
  let depth = 0, current = ''
  for (const ch of str) {
    if (ch === '[') { depth++; current += ch }
    else if (ch === ']') { depth--; current += ch }
    else if (ch === ' ' && depth === 0) { if (current.trim()) entries.push(current.trim()); current = '' }
    else current += ch
  }
  if (current.trim()) entries.push(current.trim())
  return entries
}

// â”€â”€â”€ Generate pattern from grid â”€â”€â”€

/**
 * Compute which steps are "safe" to skip (pure held continuations with
 * NO note starts on ANY MIDI row) and compute effective @-lengths that
 * are truncated when another note starts within the span.
 */
function buildHeldInfo(
  noteMap: Map<string, NoteData>,
  totalSteps: number,
): {
  /** Steps that are ONLY held continuations (no new note starts) â€” safe to skip */
  safeHeldSteps: Set<number>
  /** For a note starting at `step`, return the max @-length we can emit */
  effectiveLength: (startStep: number, fullLength: number) => number
} {
  // Collect all steps where at least one note STARTS
  const noteStartSteps = new Set<number>()
  noteMap.forEach((_data, key) => {
    const step = parseInt(key.split(':')[1])
    if (step < totalSteps) noteStartSteps.add(step)
  })

  // Effective length: truncate at first conflict (note start on any row).
  // Defined BEFORE safeHeldSteps so we can use it to compute correct skip ranges.
  function effectiveLength(startStep: number, fullLength: number): number {
    for (let i = 1; i < fullLength; i++) {
      const s = startStep + i
      if (s >= totalSteps || noteStartSteps.has(s)) return i
    }
    return fullLength
  }

  // Build safe held steps using the EFFECTIVE length (not the raw UI length).
  // Previously this used data.length which could extend past a truncation point,
  // causing steps to be skipped that shouldn't be — producing the wrong total
  // weight and breaking Strudel timing.
  const safeHeldSteps = new Set<number>()
  noteMap.forEach((data, key) => {
    const startStep = parseInt(key.split(':')[1])
    const effLen = effectiveLength(startStep, data.length)
    for (let s = startStep + 1; s < startStep + effLen && s < totalSteps; s++) {
      if (!noteStartSteps.has(s)) {
        safeHeldSteps.add(s)
      }
    }
  })

  return { safeHeldSteps, effectiveLength }
}

function gridToPattern(
  noteMap: Map<string, NoteData>,
  bars: number,
  scale: string,
  mode: 'degree' | 'note' = 'degree',
  stepsPerBar: number = 16,
): string {
  const totalSteps = bars * stepsPerBar
  const { safeHeldSteps, effectiveLength } = buildHeldInfo(noteMap, totalSteps)

  if (mode === 'note') {
    // â”€â”€ Note-name mode: output MIDI as Strudel note names â”€â”€
    const stepMap = new Map<number, { midi: number; length: number }[]>()
    noteMap.forEach((data, key) => {
      const [midiStr, stepStr] = key.split(':')
      const midi = parseInt(midiStr)
      const step = parseInt(stepStr)
      if (step < totalSteps) {
        const arr = stepMap.get(step) || []
        arr.push({ midi, length: data.length })
        stepMap.set(step, arr)
      }
    })

    const barPatterns: string[] = []
    for (let bar = 0; bar < bars; bar++) {
      const tokens: string[] = []
      for (let s = 0; s < stepsPerBar; s++) {
        const step = bar * stepsPerBar + s
        // Only skip steps that are pure held continuations (no note starts)
        if (safeHeldSteps.has(step)) continue

        const notes = stepMap.get(step)
        if (!notes || notes.length === 0) {
          tokens.push('~')
        } else if (notes.length === 1) {
          const n = notes[0]
          const eff = effectiveLength(step, n.length)
          const name = midiToStrudelNote(n.midi)
          tokens.push(eff > 1 ? `${name}@${eff}` : name)
        } else {
          // Chords: @N must go on the bracket [a,b,c]@N — NOT on individual
          // elements. Strudel ignores @ inside comma-chords (simultaneous
          // notes), so [a@4,b@4] has weight 1 instead of 4, breaking timing.
          const sorted = notes.sort((a, b) => a.midi - b.midi)
          const chord = sorted.map(n => midiToStrudelNote(n.midi)).join(',')
          const chordEff = Math.max(...sorted.map(n => effectiveLength(step, n.length)))
          tokens.push(chordEff > 1 ? `[${chord}]@${chordEff}` : `[${chord}]`)
        }
      }
      barPatterns.push(tokens.join(' '))
    }
    if (bars === 1) return barPatterns[0]
    return `<${barPatterns.map(b => `[${b}]`).join(' ')}>`
  }

  // â”€â”€ Degree mode: output scale degree numbers â”€â”€
  const stepMap = new Map<number, { deg: number; length: number }[]>()
  noteMap.forEach((data, key) => {
    const [midiStr, stepStr] = key.split(':')
    const midi = parseInt(midiStr)
    const step = parseInt(stepStr)
    const deg = midiToDegree(midi, scale)
    if (deg !== null && step < totalSteps) {
      const arr = stepMap.get(step) || []
      arr.push({ deg, length: data.length })
      stepMap.set(step, arr)
    }
  })

  const barPatterns: string[] = []
  for (let bar = 0; bar < bars; bar++) {
    const tokens: string[] = []
    for (let s = 0; s < stepsPerBar; s++) {
      const step = bar * stepsPerBar + s
      // Only skip steps that are pure held continuations (no note starts)
      if (safeHeldSteps.has(step)) continue

      const degs = stepMap.get(step)
      if (!degs || degs.length === 0) {
        tokens.push('~')
      } else if (degs.length === 1) {
        const d = degs[0]
        const eff = effectiveLength(step, d.length)
        tokens.push(eff > 1 ? `${d.deg}@${eff}` : String(d.deg))
      } else {
        // Chords: @N must go on the bracket [a,b,c]@N — NOT on individual
        // elements. Strudel ignores @ inside comma-chords (simultaneous
        // notes), so [0@4,2@4] has weight 1 instead of 4, breaking timing.
        const sorted = degs.sort((a, b) => a.deg - b.deg)
        const chord = sorted.map(d => String(d.deg)).join(',')
        const chordEff = Math.max(...sorted.map(d => effectiveLength(step, d.length)))
        tokens.push(chordEff > 1 ? `[${chord}]@${chordEff}` : `[${chord}]`)
      }
    }
    barPatterns.push(tokens.join(' '))
  }

  if (bars === 1) return barPatterns[0]
  return `<${barPatterns.map(b => `[${b}]`).join(' ')}>`
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  COMPONENT
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

interface StudioPianoRollProps {
  /** The channel's current pattern (mini-notation string) */
  currentPattern: string
  /** Scale string like "C4:minor" */
  scale: string
  /** Channel color for theming */
  color: string
  /** Channel name */
  channelName: string
  /** Sound source for preview */
  soundSource: string
  /** Whether the channel's pattern is generative (irand, perlin, etc.) */
  isGenerative: boolean
  /** Pattern type: 'n' = scale degrees, 'note' = absolute note names, 's' = sample */
  patternType?: 'n' | 'note' | 's'
  /** Full channel data for effects panel */
  channelData?: ParsedChannel
  /** Channel index in parsed code */
  channelIdx?: number
  /** Called when user edits notes â€” receives new mini-notation */
  onPatternChange: (pattern: string) => void
  /** Called when an effect param is changed from the effects panel */
  onEffectChange?: (paramKey: string, value: number) => void
  /** Called to add an effect to the channel */
  onEffectAdd?: (effectCode: string) => void
  /** Called to remove an effect from the channel */
  onEffectRemove?: (effectKey: string) => void
  /** Called when arp mode changes */
  onArpChange?: (mode: string) => void
  /** Called when arp rate changes */
  onArpRateChange?: (rate: number) => void
  /** Called when transpose changes */
  onTransposeChange?: (semitones: number) => void
  /** Preview a note via superdough (real instrument sound) */
  onNotePreview?: (midi: number) => void
  /** Close the piano roll */
  onClose: () => void
  /** Whether the transport is currently playing */
  isPlaying?: boolean
  /** Project BPM for playhead timing */
  projectBpm?: number
  /** Optional callback that returns the current fractional cycle position from the Strudel scheduler */
  getCyclePosition?: () => number | null
  /** User-uploaded samples list for resolving sample names to URLs */
  userSamples?: { id: string | number; name: string; url: string; duration_ms?: number | null; original_bpm?: number | null }[]
}

const CELL_W_BASE = 28
const CELL_H_BASE = 16
const PIANO_W = 44
const BAR_OPTIONS = [1, 2, 4, 8, 16, 32] as const
const GRID_OPTIONS = [16, 32] as const
const RESIZE_HANDLE_W = 6

/** Note data: a note starts at step with a given length (in steps) */
interface NoteData { length: number }

export default function StudioPianoRoll({
  currentPattern,
  scale,
  color,
  channelName,
  soundSource,
  isGenerative,
  patternType = 'n',
  channelData,
  channelIdx,
  onPatternChange,
  onEffectChange,
  onEffectAdd,
  onEffectRemove,
  onArpChange,
  onArpRateChange,
  onTransposeChange,
  onNotePreview,
  onClose,
  isPlaying: transportPlaying = false,
  projectBpm = 120,
  getCyclePosition,
  userSamples = [],
}: StudioPianoRollProps) {
  const isNoteMode = patternType === 'note'
  const parseMode = isNoteMode ? 'note' as const : 'degree' as const
  const [bars, setBars] = useState(1)
  // Map of "midi:step" â†’ NoteData (length in steps)
  const [noteMap, setNoteMap] = useState<Map<string, NoteData>>(new Map())
  const [hasUserEdited, setHasUserEdited] = useState(false)
  const speedModRef = useRef('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(1)
  const [stepsPerBar, setStepsPerBar] = useState<16 | 32>(16)
  const hasInitScrolled = useRef(false)
  const cellW = Math.round(CELL_W_BASE * zoom)
  const cellH = Math.round(CELL_H_BASE * zoom)
  const isDrawing = useRef(false)
  const drawMode = useRef<'add' | 'remove'>('add')
  const lastCell = useRef<string | null>(null)
  const isResizing = useRef(false)
  const resizeKey = useRef<string | null>(null)
  const noteMapRef = useRef(noteMap)
  noteMapRef.current = noteMap

  // â”€â”€ Selection state (multi-select, copy/paste, duplicate) â”€â”€
  const [selectedNotes, setSelectedNotes] = useState<Set<string>>(new Set())
  const clipboardRef = useRef<{ midi: number; step: number; length: number }[]>([])
  // Box selection (Shift+drag)
  const [boxSelect, setBoxSelect] = useState<{ startX: number; startY: number; curX: number; curY: number } | null>(null)
  const isBoxSelecting = useRef(false)
  const boxStartCell = useRef<{ midi: number; step: number } | null>(null)

  // Tool state (V = pointer, C = split/scissors)
  const [activeTool, setActiveTool] = useState<'pointer' | 'split'>('pointer')

  // Input mode: 'open' = single notes, 'chord' = auto-place triads (root+3rd+5th from scale)
  const [inputMode, setInputMode] = useState<'open' | 'chord'>('open')

  // Strict scale: when true, only in-scale notes can be placed; when false, all 12 semitones are available
  const [strictScale, setStrictScale] = useState(true)

  // Note drag-move state
  const isDraggingNotes = useRef(false)
  const dragStartCell = useRef<{ midi: number; step: number } | null>(null)
  const dragOriginalNotes = useRef<Map<string, { midi: number; step: number; length: number }>>(new Map())
  const isAltDuplicating = useRef(false) // Alt+drag = duplicate notes
  const dragConstraint = useRef<'none' | 'h' | 'v'>('none') // Shift = axis-lock
  const dragBaseNoteMap = useRef<Map<string, NoteData>>(new Map()) // Snapshot of noteMap at drag start

  // Double-click tracking for delete
  const lastClickTime = useRef(0)
  const lastClickKey = useRef<string | null>(null)

  // Piano roll height (resizable from top)
  const [pianoRollHeight, setPianoRollHeight] = useState(340)
  const isResizingHeight = useRef(false)

  // Effects panel state
  const [showEffectsPanel, setShowEffectsPanel] = useState(true)

  // ── Sample Waveform / Trim state ──
  const [showWaveform, setShowWaveform] = useState(false)
  const [sampleBegin, setSampleBegin] = useState(0)
  const [sampleEnd, setSampleEnd] = useState(1)
  const [isFullSample, setIsFullSample] = useState(false)
  const waveformCanvasRef = useRef<HTMLCanvasElement>(null)
  const loadedSampleUrlRef = useRef<string | null>(null)
  const waveformDataRef = useRef<{ min: number; max: number }[]>([])
  const sampleAudioCtxRef = useRef<AudioContext | null>(null)
  const sampleBufferRef = useRef<AudioBuffer | null>(null)
  const [sampleDuration, setSampleDuration] = useState(0)
  const [waveformLoading, setWaveformLoading] = useState(false)
  const [waveformDragging, setWaveformDragging] = useState<'begin' | 'end' | null>(null)
  const waveformPreviewSrc = useRef<AudioBufferSourceNode | null>(null)
  const [isWaveformPreviewing, setIsWaveformPreviewing] = useState(false)

  // ── Slow/Fast factor — how many cycles this channel's pattern spans ──
  // .slow(2) means the pattern takes 2 cycles; .fast(2) means it takes 0.5 cycles
  const slowFactor = useMemo(() => {
    if (!channelData?.rawCode) return 1
    const slowMatch = channelData.rawCode.match(/\.slow\(\s*([\d.]+)\s*\)/)
    const fastMatch = channelData.rawCode.match(/\.fast\(\s*([\d.]+)\s*\)/)
    let factor = 1
    if (slowMatch) factor *= parseFloat(slowMatch[1]) || 1
    if (fastMatch) factor /= parseFloat(fastMatch[1]) || 1
    return factor
  }, [channelData?.rawCode])

  // ── Transport Playhead (marquee) ──
  const [playheadStep, setPlayheadStep] = useState(-1)
  const playheadRAF = useRef<number | null>(null)
  const playheadStartTime = useRef(0)

  useEffect(() => {
    if (!transportPlaying) {
      setPlayheadStep(-1)
      if (playheadRAF.current) { cancelAnimationFrame(playheadRAF.current); playheadRAF.current = null }
      return
    }
    // Start playhead animation
    playheadStartTime.current = performance.now()
    const animate = () => {
      // Try to get cycle position from Strudel scheduler
      let cyclePos: number | null = null
      if (getCyclePosition) {
        try { cyclePos = getCyclePosition() } catch { /* ignore */ }
      }

      if (cyclePos !== null && cyclePos >= 0) {
        // Strudel cycle position: fractional cycle count (e.g. 2.75 = beat 4 of bar 3)
        // In Strudel, 1 cycle = 1 bar. With .slow(N), the pattern spans N real cycles.
        // A 4-bar pattern with .slow(1) means each bar = 1 cycle, total = 4 cycles.
        // A 1-bar pattern with .slow(1) means 1 cycle, it just loops faster.
        // Total pattern span in real Strudel cycles = bars × slowFactor
        const totalCycleSpan = bars * slowFactor
        const totalGridSteps = bars * stepsPerBar
        // Map the global cycle position into this channel's pattern span
        // Use modulo to wrap correctly regardless of how many global cycles have passed
        const posInPattern = ((cyclePos % totalCycleSpan) + totalCycleSpan) % totalCycleSpan
        const fractionalStep = (posInPattern / totalCycleSpan) * totalGridSteps
        // Sub-step precision: don't round, use fractional for smooth movement
        setPlayheadStep(prev => Math.abs(prev - fractionalStep) > 0.15 ? fractionalStep : prev)
      } else {
        // Fallback: compute from BPM + elapsed time
        // With .slow(N), each bar takes N × (4 beats) to play
        // 1 bar = 4 beats at BPM. With slowFactor, each bar takes slowFactor × (4 × 60000/BPM) ms
        const barDurationMs = (4 * 60000 * slowFactor) / projectBpm
        const elapsed = performance.now() - playheadStartTime.current
        const totalGridSteps = bars * stepsPerBar
        const totalPatternMs = bars * barDurationMs
        // Wrap elapsed time into the pattern's total duration
        const posInPattern = ((elapsed % totalPatternMs) + totalPatternMs) % totalPatternMs
        const fractionalStep = (posInPattern / totalPatternMs) * totalGridSteps
        setPlayheadStep(prev => Math.abs(prev - fractionalStep) > 0.15 ? fractionalStep : prev)
      }
      playheadRAF.current = requestAnimationFrame(animate)
    }
    playheadRAF.current = requestAnimationFrame(animate)
    return () => {
      if (playheadRAF.current) { cancelAnimationFrame(playheadRAF.current); playheadRAF.current = null }
    }
  }, [transportPlaying, projectBpm, bars, stepsPerBar, getCyclePosition, slowFactor])

  // Cleanup playhead on unmount
  useEffect(() => {
    return () => {
      if (playheadRAF.current) cancelAnimationFrame(playheadRAF.current)
    }
  }, [])

  // ── Preset menu state ──
  const [showPresetMenu, setShowPresetMenu] = useState(false)
  const [presetCategory, setPresetCategory] = useState<PresetCategory>('chords')
  const presetMenuRef = useRef<HTMLDivElement>(null)

  // Close preset menu on outside click
  useEffect(() => {
    if (!showPresetMenu) return
    const handler = (e: MouseEvent) => {
      if (presetMenuRef.current && !presetMenuRef.current.contains(e.target as Node)) {
        setShowPresetMenu(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showPresetMenu])

  // â”€â”€ Derived: Arp/Transpose info from channel data â”€â”€
  const arpInfo = useMemo(() => {
    if (!channelData) return { mode: 'off', rate: 1 }
    return getArpInfo(channelData.rawCode)
  }, [channelData])

  // ── Sample URL extraction from channel rawCode ──
  const sampleUrl = useMemo(() => {
    if (!channelData?.rawCode) return null
    // 1. Direct URL in s("https://...")
    const urlMatch = channelData.rawCode.match(/\.?s\(\s*"(https?:\/\/[^"]+)"/)
    if (urlMatch) return urlMatch[1]
    // 2. Sample name in s("name") — resolve via userSamples
    const nameMatch = channelData.rawCode.match(/\.?s\(\s*"([^"]+)"/)
    if (nameMatch && userSamples.length > 0) {
      const name = nameMatch[1]
      const found = userSamples.find(s => s.name === name)
      if (found?.url) return found.url
    }
    return null
  }, [channelData?.rawCode, userSamples])

  const isSampleChannel = channelData?.sourceType === 'sample' && !!sampleUrl

  // ── Detect sliced channel (pad sampler owns trim) ──
  const sliceMeta = useMemo(() => {
    if (!channelData?.rawCode) return null
    const trimComment = channelData.rawCode.match(/\/\/\s*trim:([\d.]+):([\d.]+):(\d+)/)
    const hasSlice = /\.slice\(\s*\d+/.test(channelData.rawCode) || /\.splice\(\s*\d+/.test(channelData.rawCode)
    if (!hasSlice) return null
    return {
      isSliced: true,
      trimBegin: trimComment ? parseFloat(trimComment[1]) : 0,
      trimEnd: trimComment ? parseFloat(trimComment[2]) : 1,
      chopCount: trimComment ? parseInt(trimComment[3]) : 16,
    }
  }, [channelData?.rawCode])

  const isSlicedChannel = !!sliceMeta

  // ── Initialize begin/end from channel params OR //trim comment ──
  const sampleBeginFromCode = useMemo(() => {
    // Sliced channels: read from //trim comment (pad sampler ate the .begin()/.end())
    if (sliceMeta) return sliceMeta.trimBegin
    return channelData?.params.find(p => p.key === 'begin')?.value ?? 0
  }, [channelData, sliceMeta])
  const sampleEndFromCode = useMemo(() => {
    if (sliceMeta) return sliceMeta.trimEnd
    return channelData?.params.find(p => p.key === 'end')?.value ?? 1
  }, [channelData, sliceMeta])

  // Sync from code params when they change externally
  const lastSyncedBegin = useRef<number | null>(null)
  const lastSyncedEnd = useRef<number | null>(null)
  useEffect(() => {
    if (lastSyncedBegin.current !== sampleBeginFromCode || lastSyncedEnd.current !== sampleEndFromCode) {
      setSampleBegin(sampleBeginFromCode)
      setSampleEnd(sampleEndFromCode)
      lastSyncedBegin.current = sampleBeginFromCode
      lastSyncedEnd.current = sampleEndFromCode
      setIsFullSample(sampleBeginFromCode <= 0.005 && sampleEndFromCode >= 0.995)
    }
  }, [sampleBeginFromCode, sampleEndFromCode])

  // Auto-show waveform for sample channels
  useEffect(() => {
    if (isSampleChannel) setShowWaveform(true)
  }, [isSampleChannel])



  // ── Load waveform audio data ──
  useEffect(() => {
    if (!sampleUrl || !showWaveform) return
    // Re-fetch if URL changed (sample swap) — clear stale cache
    if (loadedSampleUrlRef.current && loadedSampleUrlRef.current !== sampleUrl) {
      sampleBufferRef.current = null
      waveformDataRef.current = []
      setSampleDuration(0)
    }
    if (sampleBufferRef.current && sampleDuration > 0) return

    loadedSampleUrlRef.current = sampleUrl
    setWaveformLoading(true)
    let cancelled = false
    const load = async () => {
      try {
        const resp = await fetch(sampleUrl)
        const buf = await resp.arrayBuffer()
        if (cancelled) return
        if (!sampleAudioCtxRef.current) sampleAudioCtxRef.current = new AudioContext()
        const ab = await sampleAudioCtxRef.current.decodeAudioData(buf)
        if (cancelled) return
        sampleBufferRef.current = ab
        setSampleDuration(ab.duration)

        // Compute waveform peaks
        const chData = ab.getChannelData(0)
        const peakCount = 800
        const block = Math.floor(chData.length / peakCount)
        const wave: { min: number; max: number }[] = []
        for (let i = 0; i < peakCount; i++) {
          const startIdx = i * block
          let mn = 1, mx = -1
          for (let j = 0; j < block; j++) {
            const v = chData[startIdx + j]
            if (v < mn) mn = v
            if (v > mx) mx = v
          }
          wave.push({ min: mn, max: mx })
        }
        waveformDataRef.current = wave

        // NOTE: No auto-trim on load — let the user explicitly trim.
        // Previously auto-trimmed to ~1s which silently modified channel code.
      } catch {
        // Failed to load sample audio
      } finally {
        if (!cancelled) setWaveformLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sampleUrl, showWaveform])

  // ── Draw waveform on canvas ──
  const drawSampleWaveform = useCallback(() => {
    const canvas = waveformCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const w = canvas.width, h = canvas.height, hh = h / 2
    const wave = waveformDataRef.current
    if (!wave.length) return

    ctx.clearRect(0, 0, w, h)
    ctx.fillStyle = '#0a0b0d'
    ctx.fillRect(0, 0, w, h)

    // Dimmed regions outside trim
    const bx = sampleBegin * w, exVal = sampleEnd * w
    ctx.fillStyle = 'rgba(0,0,0,0.6)'
    ctx.fillRect(0, 0, bx, h)
    ctx.fillRect(exVal, 0, w - exVal, h)

    // Center line
    ctx.strokeStyle = 'rgba(255,255,255,0.04)'
    ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(0, hh); ctx.lineTo(w, hh); ctx.stroke()

    // Waveform bars
    for (let i = 0; i < wave.length; i++) {
      const x = (i / wave.length) * w
      const inTrim = x >= bx && x <= exVal
      ctx.strokeStyle = inTrim ? color : `${color}25`
      ctx.lineWidth = inTrim ? 1.5 : 0.6
      ctx.beginPath()
      ctx.moveTo(x, hh + wave[i].min * hh)
      ctx.lineTo(x, hh + wave[i].max * hh)
      ctx.stroke()
    }

    // ── Chop markers for sliced channels ──
    if (sliceMeta && sliceMeta.chopCount > 1) {
      const chopN = sliceMeta.chopCount
      const trimRange = exVal - bx
      ctx.strokeStyle = 'rgba(34,211,238,0.25)' // cyan chop lines
      ctx.lineWidth = 0.5
      for (let c = 1; c < chopN; c++) {
        const cx = bx + (c / chopN) * trimRange
        ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, h); ctx.stroke()
      }
      // Chop count label
      ctx.font = '7px monospace'
      ctx.fillStyle = 'rgba(34,211,238,0.5)'
      ctx.textAlign = 'center'
      ctx.fillText(`${chopN} chops`, (bx + exVal) / 2, 10)
    }

    // Begin handle (green) — dimmed if sliced (locked)
    const handleAlpha = sliceMeta ? '60' : ''
    ctx.fillStyle = `#10b981${handleAlpha}`
    ctx.fillRect(bx - 1, 0, 2, h)
    ctx.beginPath(); ctx.moveTo(bx, 0); ctx.lineTo(bx + 7, 0); ctx.lineTo(bx, 9); ctx.closePath(); ctx.fill()
    // End handle (red) — dimmed if sliced (locked)
    ctx.fillStyle = `#f43f5e${handleAlpha}`
    ctx.fillRect(exVal - 1, 0, 2, h)
    ctx.beginPath(); ctx.moveTo(exVal, 0); ctx.lineTo(exVal - 7, 0); ctx.lineTo(exVal, 9); ctx.closePath(); ctx.fill()

    // Lock icon on handles when sliced
    if (sliceMeta) {
      ctx.font = '7px sans-serif'
      ctx.fillStyle = 'rgba(255,255,255,0.3)'
      ctx.textAlign = 'left'
      ctx.fillText('🔒', bx + 3, 20)
      ctx.textAlign = 'right'
      ctx.fillText('🔒', exVal - 3, 20)
    }

    // Time labels
    ctx.font = '9px monospace'
    ctx.fillStyle = '#10b981'
    ctx.textAlign = 'left'
    ctx.fillText(`${(sampleBegin * sampleDuration).toFixed(1)}s`, bx + 3, h - 3)
    ctx.fillStyle = '#f43f5e'
    ctx.textAlign = 'right'
    ctx.fillText(`${(sampleEnd * sampleDuration).toFixed(1)}s`, exVal - 3, h - 3)

    // Region duration label
    const regionDur = (sampleEnd - sampleBegin) * sampleDuration
    ctx.fillStyle = 'rgba(255,255,255,0.25)'
    ctx.textAlign = 'center'
    ctx.font = '8px monospace'
    ctx.fillText(`${regionDur.toFixed(2)}s`, (bx + exVal) / 2, h - 3)
  }, [sampleBegin, sampleEnd, color, sampleDuration, sliceMeta])

  // Redraw waveform when trim values change
  useEffect(() => { drawSampleWaveform() }, [drawSampleWaveform])
  useEffect(() => {
    if (!waveformLoading && waveformDataRef.current.length > 0) {
      requestAnimationFrame(drawSampleWaveform)
    }
  }, [waveformLoading, drawSampleWaveform])

  // ── Waveform drag handlers ──
  const getWaveformX = useCallback((e: MouseEvent | React.MouseEvent) => {
    const canvas = waveformCanvasRef.current
    if (!canvas) return 0
    const rect = canvas.getBoundingClientRect()
    return Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
  }, [])

  const handleWaveformMouseDown = useCallback((e: React.MouseEvent) => {
    // Sliced channels: trim is locked — Pad Sampler owns the chop boundaries
    if (isSlicedChannel) return
    const x = getWaveformX(e)
    const bDist = Math.abs(x - sampleBegin)
    const eDist = Math.abs(x - sampleEnd)
    if (bDist < 0.025 || (bDist < eDist && bDist < 0.05)) {
      setWaveformDragging('begin')
    } else if (eDist < 0.025 || eDist < 0.05) {
      setWaveformDragging('end')
    }
  }, [sampleBegin, sampleEnd, getWaveformX, isSlicedChannel])

  useEffect(() => {
    if (!waveformDragging) return
    const onMove = (e: MouseEvent) => {
      const x = getWaveformX(e)
      if (waveformDragging === 'begin') setSampleBegin(Math.max(0, Math.min(x, sampleEnd - 0.01)))
      else setSampleEnd(Math.min(1, Math.max(x, sampleBegin + 0.01)))
    }
    const onUp = () => setWaveformDragging(null)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [waveformDragging, sampleBegin, sampleEnd, getWaveformX])

  // ── Apply trim to channel code when drag ends ──
  // Sliced channels: skip — Pad Sampler owns trim via // trim: comment + scaled slice indices
  useEffect(() => {
    if (waveformDragging !== null) return
    if (isSlicedChannel) return // Pad Sampler controls trim for sliced channels
    if (!channelData || channelIdx === undefined) return
    if (Math.abs(sampleBegin - sampleBeginFromCode) < 0.005 && Math.abs(sampleEnd - sampleEndFromCode) < 0.005) return

    const hasBegin = channelData.effects.includes('begin')
    if (sampleBegin > 0.005) {
      if (hasBegin) onEffectChange?.('begin', Math.round(sampleBegin * 100) / 100)
      else onEffectAdd?.(`.begin(${sampleBegin.toFixed(2)})`)
    } else if (hasBegin) {
      onEffectRemove?.('begin')
    }

    const hasEnd = channelData.effects.includes('end')
    if (sampleEnd < 0.995) {
      if (hasEnd) onEffectChange?.('end', Math.round(sampleEnd * 100) / 100)
      else onEffectAdd?.(`.end(${sampleEnd.toFixed(2)})`)
    } else if (hasEnd) {
      onEffectRemove?.('end')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waveformDragging])

  // ── Toggle full sample / shot mode ──
  const toggleFullSample = useCallback(() => {
    if (isFullSample) {
      const shotEnd = sampleDuration > 1.5 ? Math.min(1, 1.0 / sampleDuration) : 1
      setSampleBegin(0)
      setSampleEnd(shotEnd)
      setIsFullSample(false)
      if (channelData && channelIdx !== undefined) {
        if (channelData.effects.includes('begin')) onEffectRemove?.('begin')
        if (shotEnd < 0.995) {
          if (channelData.effects.includes('end')) onEffectChange?.('end', Math.round(shotEnd * 100) / 100)
          else onEffectAdd?.(`.end(${shotEnd.toFixed(2)})`)
        }
      }
    } else {
      setSampleBegin(0)
      setSampleEnd(1)
      setIsFullSample(true)
      if (channelData && channelIdx !== undefined) {
        if (channelData.effects.includes('begin')) onEffectRemove?.('begin')
        if (channelData.effects.includes('end')) onEffectRemove?.('end')
      }
    }
  }, [isFullSample, sampleDuration, channelData, channelIdx, onEffectChange, onEffectAdd, onEffectRemove])

  // ── Preview trimmed region ──
  const toggleWaveformPreview = useCallback(() => {
    if (isWaveformPreviewing && waveformPreviewSrc.current) {
      waveformPreviewSrc.current.stop()
      waveformPreviewSrc.current = null
      setIsWaveformPreviewing(false)
      return
    }
    if (!sampleBufferRef.current || !sampleAudioCtxRef.current) return
    const actx = sampleAudioCtxRef.current
    if (actx.state === 'suspended') actx.resume()
    const src = actx.createBufferSource()
    src.buffer = sampleBufferRef.current
    src.connect(actx.destination)
    const startSec = sampleBegin * sampleBufferRef.current.duration
    const durSec = (sampleEnd - sampleBegin) * sampleBufferRef.current.duration
    src.start(0, startSec, durSec)
    src.onended = () => { setIsWaveformPreviewing(false); waveformPreviewSrc.current = null }
    waveformPreviewSrc.current = src
    setIsWaveformPreviewing(true)
  }, [sampleBegin, sampleEnd, isWaveformPreviewing])

  // Cleanup preview on unmount
  useEffect(() => {
    return () => { if (waveformPreviewSrc.current) { try { waveformPreviewSrc.current.stop() } catch { /* noop */ } } }
  }, [])


  // Chord detection: identify chord from selected notes
  const detectedChord = useMemo(() => {
    if (selectedNotes.size < 2) return null
    const midiNotes: number[] = []
    selectedNotes.forEach(key => {
      midiNotes.push(parseInt(key.split(':')[0]))
    })
    return identifyChord(midiNotes)
  }, [selectedNotes])

  // Diatonic chord palette for current scale
  const diatonicChords = useMemo(() => getDiatonicChords(scale), [scale])

  // Chord palette state
  const [showChordPalette, setShowChordPalette] = useState(false)
  const chordPaletteRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!showChordPalette) return
    const handler = (e: MouseEvent) => {
      if (chordPaletteRef.current && !chordPaletteRef.current.contains(e.target as Node)) {
        setShowChordPalette(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showChordPalette])

  const transposeValue = useMemo(() => {
    if (!channelData) return 0
    return getTranspose(channelData.rawCode)
  }, [channelData])

  // (channelSpeed removed — playhead uses slowFactor from regex match on rawCode)

  // Effect params (everything except gain, orbit, duck)
  const effectParams = useMemo(() => {
    if (!channelData) return []
    const skipKeys = new Set(['gain', 'orbit', 'duck'])
    return channelData.params.filter(p => !skipKeys.has(p.key))
  }, [channelData])

  // FX category groups
  const FX_GROUPS = useMemo(() => [
    { label: 'FILTER', icon: '🔽', keys: ['lpf', 'lp', 'hpf', 'hp', 'lpq', 'hpq', 'lpenv', 'hpenv', 'bpenv', 'lps', 'lpd', 'lpattack', 'lprelease', 'bpf', 'bpq', 'ftype', 'vowel'] },
    { label: 'DRIVE',  icon: '🔥', keys: ['shape', 'distort', 'crush', 'coarse'] },
    { label: 'SPACE',  icon: '🌌', keys: ['room', 'roomsize', 'roomfade', 'roomlp', 'roomdim', 'dry', 'delay', 'delayfeedback', 'delaytime'] },
    { label: 'MOD',    icon: '🎵', keys: ['detune', 'speed', 'pan', 'velocity', 'postgain', 'vib', 'vibmod', 'phaser', 'phaserdepth', 'tremolosync', 'tremolodepth', 'tremoloskew', 'tremolophase', 'tremoloshape'] },
    { label: 'FM',     icon: '📻', keys: ['fm', 'fmh', 'fmattack', 'fmdecay', 'fmsustain'] },
    { label: 'PITCH',  icon: '📈', keys: ['penv', 'pattack', 'pdecay', 'prelease', 'pcurve', 'panchor'] },
    { label: 'ENV',    icon: '⏳', keys: ['attack', 'decay', 'sustain', 'rel', 'release', 'legato', 'clip'] },
  ], [])

  const activeFxGroups = useMemo(() => {
    if (!channelData) return []
    return FX_GROUPS.map(group => ({
      ...group,
      params: channelData.params.filter(p => group.keys.includes(p.key)),
    })).filter(g => g.params.length > 0)
  }, [channelData, FX_GROUPS])

  /** Helper: create a simple Set<string> of all occupied cells for quick "is covered" checks */
  const coveredCells = useMemo(() => {
    const set = new Set<string>()
    noteMap.forEach((data, key) => {
      const [midiStr, stepStr] = key.split(':')
      const midi = parseInt(midiStr)
      const startStep = parseInt(stepStr)
      for (let s = startStep; s < startStep + data.length; s++) {
        set.add(`${midi}:${s}`)
      }
    })
    return set
  }, [noteMap])

  // â”€â”€ Octave range â”€â”€
  const { rows } = useMemo(() => {
    let lo: number, hi: number
    if (isNoteMode) {
      // Note mode: wide chromatic range C1â€“C6; expand if notes go lower/higher
      lo = 24; hi = 84
      const { notes: existing } = parsePattern(currentPattern, scale, 'note')
      existing.forEach((_data, key) => {
        const midi = parseInt(key.split(':')[0])
        lo = Math.min(lo, Math.max(midi - 5, 21))
        hi = Math.max(hi, Math.min(midi + 5, 108))
      })
    } else {
      lo = degreeToMidi(-7, scale)
      hi = degreeToMidi(14, scale)
    }
    const rows: number[] = []
    for (let m = hi; m >= lo; m--) rows.push(m)
    return { rows }
  }, [scale, isNoteMode, currentPattern])

  const scaleMidiSet = useMemo(
    () => getScaleMidiSet(scale, rows[rows.length - 1], rows[0]),
    [scale, rows],
  )

  // â”€â”€ Parse initial pattern (only on mount / pattern prop change) â”€â”€
  // Track whether user is actively drawing to avoid re-parse during live edits
  const hasUserEditedRef = useRef(false)
  hasUserEditedRef.current = hasUserEdited
  const lastEmittedPattern = useRef('')

  useEffect(() => {
    // If user is actively editing, skip re-parse â€” the user's noteMap is the source of truth.
    // Only re-parse if the incoming pattern differs from what we last emitted (external change).
    if (hasUserEditedRef.current && currentPattern === lastEmittedPattern.current) return

    console.log('[PianoRoll] parsing:', { currentPattern, parseMode, patternType, isGenerative, isNoteMode })
    const { notes: parsed, bars: parsedBars, speedMod } = parsePattern(currentPattern, scale, parseMode, stepsPerBar)
    speedModRef.current = speedMod
    console.log('[PianoRoll] result:', { notesCount: parsed.size, bars: parsedBars, speedMod })
    setNoteMap(parsed)
    setBars(Math.max(1, parsedBars))
    setHasUserEdited(false)

    // Auto-scroll to center on notes (only on first open)
    if (!hasInitScrolled.current) {
      hasInitScrolled.current = true
      requestAnimationFrame(() => {
        if (!scrollRef.current) return
        if (parsed.size > 0) {
          const midis = [...parsed.keys()].map(k => parseInt(k.split(':')[0]))
          const avg = midis.reduce((a, b) => a + b, 0) / midis.length
          const idx = rows.findIndex(m => m <= avg)
          scrollRef.current.scrollTop = Math.max(0, (idx >= 0 ? idx : rows.length / 2) * cellH - scrollRef.current.clientHeight / 2)
        } else {
          scrollRef.current.scrollTop = (rows.length / 2) * cellH - scrollRef.current.clientHeight / 2
        }
      })
    }
  }, [currentPattern, scale]) // eslint-disable-line react-hooks/exhaustive-deps

  // â”€â”€ Emit pattern when user edits (debounced) â”€â”€
  // Track whether any note has length > 1 → needs legato for proper sustained playback
  const hasStretchedNotes = useMemo(() => {
    for (const [, data] of noteMap) {
      if (data.length > 1) return true
    }
    return false
  }, [noteMap])

  const emitTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!hasUserEdited) return
    if (emitTimer.current) clearTimeout(emitTimer.current)
    emitTimer.current = setTimeout(() => {
      // Pass noteMap directly to gridToPattern so it can encode note lengths with @
      const pat = gridToPattern(noteMapRef.current, bars, scale, parseMode, stepsPerBar)
      // Don't re-attach speedMod — the grid IS the timing authority.
      // Appending raw *2 or /4 would apply to the last token, not the whole
      // pattern, breaking Strudel timing. Users who need speed modifiers
      // should edit the code directly.
      lastEmittedPattern.current = pat
      onPatternChange(pat)

      // Auto-legato: when notes have @N > 1, Strudel needs .legato(1) for the
      // note to actually sustain for its visual length (like a professional DAW).
      // Without legato, notes trigger once and decay regardless of @-duration.
      if (hasStretchedNotes && channelData && !channelData.effects.includes('legato')) {
        onEffectAdd?.('.legato(1)')
      }
    }, 80)
    return () => { if (emitTimer.current) clearTimeout(emitTimer.current) }
  }, [noteMap, hasUserEdited, bars, scale, onPatternChange, stepsPerBar, hasStretchedNotes, channelData, onEffectAdd])

  // â”€â”€ Toggle note â”€â”€
  const toggleNote = useCallback((midi: number, step: number, forceMode?: 'add' | 'remove') => {
    // Block out-of-scale notes only when strict scale is enabled
    if (strictScale && !scaleMidiSet.has(midi)) return

    const key = `${midi}:${step}`
    setNoteMap(prev => {
      const next = new Map(prev)
      const mode = forceMode || (prev.has(key) ? 'remove' : 'add')
      if (mode === 'remove') {
        if (inputMode === 'chord') {
          // In chord mode, remove the full triad at this step
          const deg = midiToDegree(midi, scale)
          if (deg !== null) {
            const third = degreeToMidi(deg + 2, scale)
            const fifth = degreeToMidi(deg + 4, scale)
            // Remove root, 3rd, 5th at this step
            for (const m of [midi, third, fifth]) {
              prev.forEach((data, k) => {
                const [mStr, sStr] = k.split(':')
                if (parseInt(mStr) === m) {
                  const s = parseInt(sStr)
                  if (step >= s && step < s + data.length) {
                    next.delete(k)
                  }
                }
              })
            }
          } else {
            next.delete(key)
          }
        } else {
          // Open mode: remove only the clicked note
          let found = false
          prev.forEach((data, k) => {
            const [mStr, sStr] = k.split(':')
            if (parseInt(mStr) === midi) {
              const s = parseInt(sStr)
              if (step >= s && step < s + data.length) {
                next.delete(k)
                found = true
              }
            }
          })
          if (!found) next.delete(key)
        }
      } else {
        if (inputMode === 'chord') {
          // Chord mode: place a strict diatonic triad (root + 3rd + 5th)
          // Only notes that exist in the scale are placed — strict scale rules
          const deg = midiToDegree(midi, scale)
          if (deg !== null) {
            const third = degreeToMidi(deg + 2, scale)
            const fifth = degreeToMidi(deg + 4, scale)
            next.set(`${midi}:${step}`, { length: 1 })
            if (scaleMidiSet.has(third)) next.set(`${third}:${step}`, { length: 1 })
            if (scaleMidiSet.has(fifth)) next.set(`${fifth}:${step}`, { length: 1 })
          } else {
            // Clicked note isn't a scale degree — place single note only
            next.set(key, { length: 1 })
          }
        } else {
          // Open mode: single note
          next.set(key, { length: 1 })
        }
        if (onNotePreview) {
          onNotePreview(midi)
        } else {
          playPreview(midi, soundSource)
        }
      }
      return next
    })
    setHasUserEdited(true)
  }, [soundSource, scaleMidiSet, isNoteMode, onNotePreview, inputMode, scale, strictScale])

  // â”€â”€ Resize note (drag right edge) â”€â”€
  const handleResizeStart = useCallback((key: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    isResizing.current = true
    resizeKey.current = key
    const startX = e.clientX
    const startLen = noteMapRef.current.get(key)?.length || 1
    const cw = cellW
    const noteStartStep = parseInt(key.split(':')[1])
    const totalSteps = bars * stepsPerBar
    const maxLen = totalSteps - noteStartStep  // Allow stretching across bar boundaries

    const onMove = (ev: MouseEvent) => {
      if (!isResizing.current || resizeKey.current !== key) return
      const delta = Math.round((ev.clientX - startX) / cw)
      const newLen = Math.max(1, Math.min(startLen + delta, maxLen))
      setNoteMap(prev => {
        const next = new Map(prev)
        const data = next.get(key)
        if (data) next.set(key, { ...data, length: newLen })
        return next
      })
    }
    const onUp = () => {
      isResizing.current = false
      resizeKey.current = null
      setHasUserEdited(true)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [cellW, bars, stepsPerBar])

  // â”€â”€ Mouse handlers for click+drag painting â”€â”€
  const handleCellDown = useCallback((midi: number, step: number, e: React.MouseEvent) => {
    if (isResizing.current) return
    if (e.shiftKey) return // Let grid-level box selection handle shift+drag
    e.preventDefault()

    // Ctrl+click on grid: stamp a triad chord (root + 3rd + 5th) at this position
    if (e.ctrlKey && (scaleMidiSet.has(midi) || !strictScale)) {
      const deg = midiToDegree(midi, scale)
      if (deg !== null) {
        const third = degreeToMidi(deg + 2, scale)
        const fifth = degreeToMidi(deg + 4, scale)
        const chordLen = Math.max(1, Math.floor(stepsPerBar / 4))
        setNoteMap(prev => {
          const next = new Map(prev)
          next.set(`${midi}:${step}`, { length: chordLen })
          if (!strictScale || scaleMidiSet.has(third)) next.set(`${third}:${step}`, { length: chordLen })
          if (!strictScale || scaleMidiSet.has(fifth)) next.set(`${fifth}:${step}`, { length: chordLen })
          return next
        })
        setHasUserEdited(true)
        if (onNotePreview) { onNotePreview(midi) } else { playPreview(midi, soundSource) }
        return
      }
    }

    // Clear note selection when clicking on empty grid
    if (selectedNotes.size > 0) {
      setSelectedNotes(new Set())
    }

    const key = `${midi}:${step}`
    isDrawing.current = true
    // Check if this cell is covered by any note
    let isCovered = false
    noteMap.forEach((data, k) => {
      const [mStr, sStr] = k.split(':')
      if (parseInt(mStr) === midi) {
        const s = parseInt(sStr)
        if (step >= s && step < s + data.length) isCovered = true
      }
    })
    drawMode.current = isCovered ? 'remove' : 'add'
    lastCell.current = key
    toggleNote(midi, step, drawMode.current)
  }, [noteMap, toggleNote, selectedNotes, scaleMidiSet, scale, stepsPerBar, soundSource, onNotePreview])

  const handleCellEnter = useCallback((midi: number, step: number) => {
    if (!isDrawing.current || isBoxSelecting.current) return
    const key = `${midi}:${step}`
    if (key === lastCell.current) return
    lastCell.current = key
    toggleNote(midi, step, drawMode.current)
  }, [toggleNote])

  useEffect(() => {
    const up = () => {
      isDrawing.current = false
      lastCell.current = null
      // End note drag
      if (isDraggingNotes.current) {
        isDraggingNotes.current = false
        isAltDuplicating.current = false
        dragConstraint.current = 'none'
        dragStartCell.current = null
        dragOriginalNotes.current = new Map()
        dragBaseNoteMap.current = new Map()
        setHasUserEdited(true)
      }
      // End box selection â€” compute selected notes
      if (isBoxSelecting.current && boxStartCell.current) {
        isBoxSelecting.current = false
      }
    }
    window.addEventListener('mouseup', up)
    return () => window.removeEventListener('mouseup', up)
  }, [])

  // —— Global mousemove for note drag-move ——
  // Uses absolute delta from drag start (never mutates original positions).
  // dragBaseNoteMap = snapshot of noteMap at drag start:
  //   Normal drag: base = noteMap minus dragged notes
  //   Alt+drag:    base = noteMap (originals stay, copies are added)
  // On each move: newNoteMap = Map(base) + notes at (orig + totalDelta)
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isDraggingNotes.current || !dragStartCell.current || !scrollRef.current) return
      const rect = scrollRef.current.getBoundingClientRect()
      const x = e.clientX - rect.left + scrollRef.current.scrollLeft - PIANO_W
      const y = e.clientY - rect.top + scrollRef.current.scrollTop - 16 // ruler height
      const currentStep = Math.max(0, Math.floor(x / cellW))
      const currentRowIdx = Math.max(0, Math.floor(y / cellH))
      const currentMidi = rows[Math.min(currentRowIdx, rows.length - 1)] ?? rows[0]

      let deltaStep = currentStep - dragStartCell.current.step
      let deltaMidi = currentMidi - dragStartCell.current.midi

      // Shift key: constrain to one axis (auto-detect on first significant movement)
      if (e.shiftKey) {
        if (dragConstraint.current === 'none' && (deltaStep !== 0 || deltaMidi !== 0)) {
          dragConstraint.current = Math.abs(deltaStep) >= Math.abs(deltaMidi) ? 'h' : 'v'
        }
        if (dragConstraint.current === 'h') deltaMidi = 0
        else if (dragConstraint.current === 'v') deltaStep = 0
      } else {
        dragConstraint.current = 'none'
      }

      const totalStepsMax = bars * stepsPerBar

      // Reconstruct noteMap from base snapshot + moved/copied notes at new positions
      const next = new Map(dragBaseNoteMap.current)
      const newSel = new Set<string>()

      dragOriginalNotes.current.forEach((n) => {
        const newMidi = n.midi + deltaMidi
        const newStep = Math.max(0, n.step + deltaStep)
        if (newStep < totalStepsMax) {
          // Snap to nearest in-scale note if target is out of scale (only in strict mode)
          let targetMidi = newMidi
          if (strictScale && !scaleMidiSet.has(targetMidi)) {
            for (let d = 1; d <= 2; d++) {
              if (scaleMidiSet.has(targetMidi + d)) { targetMidi = targetMidi + d; break }
              if (scaleMidiSet.has(targetMidi - d)) { targetMidi = targetMidi - d; break }
            }
          }
          if (!strictScale || scaleMidiSet.has(targetMidi)) {
            const newKey = `${targetMidi}:${newStep}`
            next.set(newKey, { length: n.length })
            newSel.add(newKey)
          }
        }
      })

      setSelectedNotes(newSel)
      setNoteMap(next)
    }
    window.addEventListener('mousemove', onMove)
    return () => window.removeEventListener('mousemove', onMove)
  }, [cellW, cellH, rows, scaleMidiSet, bars, stepsPerBar])

  // â”€â”€ Box selection handlers â”€â”€
  const handleGridMouseDown = useCallback((e: React.MouseEvent) => {
    if (!e.shiftKey) return
    e.preventDefault()
    const rect = scrollRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = e.clientX - rect.left + (scrollRef.current?.scrollLeft || 0)
    const y = e.clientY - rect.top + (scrollRef.current?.scrollTop || 0)
    isBoxSelecting.current = true
    setBoxSelect({ startX: x, startY: y, curX: x, curY: y })
  }, [])

  const handleGridMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isBoxSelecting.current || !scrollRef.current) return
    const rect = scrollRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left + scrollRef.current.scrollLeft
    const y = e.clientY - rect.top + scrollRef.current.scrollTop
    setBoxSelect(prev => prev ? { ...prev, curX: x, curY: y } : null)

    // Compute selected notes within box
    const left = Math.min(x, boxSelect?.startX ?? x) - PIANO_W
    const right = Math.max(x, boxSelect?.startX ?? x) - PIANO_W
    const top = Math.min(y, boxSelect?.startY ?? y) - 16 // ruler height
    const bottom = Math.max(y, boxSelect?.startY ?? y) - 16

    const stepL = Math.floor(left / cellW)
    const stepR = Math.ceil(right / cellW)
    const rowT = Math.floor(top / cellH)
    const rowB = Math.ceil(bottom / cellH)

    const newSel = new Set<string>()
    noteMapRef.current.forEach((data, key) => {
      const [midiStr, stepStr] = key.split(':')
      const midi = parseInt(midiStr)
      const step = parseInt(stepStr)
      const rowIdx = rows.indexOf(midi)
      if (rowIdx >= rowT && rowIdx <= rowB && step >= stepL && step < stepR) {
        newSel.add(key)
      }
    })
    setSelectedNotes(newSel)
  }, [rows, boxSelect, cellW, cellH])

  const handleGridMouseUp = useCallback(() => {
    if (isBoxSelecting.current) {
      isBoxSelecting.current = false
      setBoxSelect(null)
    }
  }, [])

  // â”€â”€ Keyboard: Escape, Ctrl+C/V/D/A, Delete â”€â”€
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Tool shortcuts: C = split/scissors, V = pointer
      if (e.key === 'c' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        setActiveTool('split')
        return
      }
      if (e.key === 'v' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        setActiveTool('pointer')
        return
      }

      if (e.key === 'Escape') {
        if (selectedNotes.size > 0) {
          setSelectedNotes(new Set())
        } else {
          onClose()
        }
        return
      }

      // Select all: Ctrl+A
      if (e.key === 'a' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        setSelectedNotes(new Set(noteMapRef.current.keys()))
        return
      }

      // Copy: Ctrl+C
      if (e.key === 'c' && (e.ctrlKey || e.metaKey) && selectedNotes.size > 0) {
        e.preventDefault()
        const notes: { midi: number; step: number; length: number }[] = []
        selectedNotes.forEach(key => {
          const [midiStr, stepStr] = key.split(':')
          const data = noteMapRef.current.get(key)
          if (data) notes.push({ midi: parseInt(midiStr), step: parseInt(stepStr), length: data.length })
        })
        clipboardRef.current = notes
        return
      }

      // Paste: Ctrl+V
      if (e.key === 'v' && (e.ctrlKey || e.metaKey) && clipboardRef.current.length > 0) {
        e.preventDefault()
        const clip = clipboardRef.current
        const minStep = Math.min(...clip.map(n => n.step))
        // Paste starting 1 step to the right of the highest selected step, or at the original position if nothing selected
        let pasteOffset = 0
        if (selectedNotes.size > 0) {
          const maxSelStep = Math.max(...[...selectedNotes].map(k => {
            const s = parseInt(k.split(':')[1])
            const data = noteMapRef.current.get(k)
            return s + (data?.length || 1)
          }))
          pasteOffset = maxSelStep - minStep
        }
        setNoteMap(prev => {
          const next = new Map(prev)
          const newSel = new Set<string>()
          clip.forEach(n => {
            const newStep = n.step + pasteOffset
            if (newStep < bars * stepsPerBar) {
              const key = `${n.midi}:${newStep}`
              next.set(key, { length: Math.min(n.length, bars * stepsPerBar - newStep) })
              newSel.add(key)
            }
          })
          setSelectedNotes(newSel)
          return next
        })
        setHasUserEdited(true)
        return
      }

      // Duplicate: Ctrl+D
      if (e.key === 'd' && (e.ctrlKey || e.metaKey) && selectedNotes.size > 0) {
        e.preventDefault()
        const notes: { midi: number; step: number; length: number }[] = []
        let maxEnd = 0
        let minStep = Infinity
        selectedNotes.forEach(key => {
          const [midiStr, stepStr] = key.split(':')
          const data = noteMapRef.current.get(key)
          if (data) {
            const step = parseInt(stepStr)
            notes.push({ midi: parseInt(midiStr), step, length: data.length })
            maxEnd = Math.max(maxEnd, step + data.length)
            minStep = Math.min(minStep, step)
          }
        })
        // Duplicate to the right: shift by the span of the selection
        const span = maxEnd - minStep
        setNoteMap(prev => {
          const next = new Map(prev)
          const newSel = new Set<string>()
          notes.forEach(n => {
            const newStep = n.step + span
            if (newStep < bars * stepsPerBar) {
              const key = `${n.midi}:${newStep}`
              next.set(key, { length: Math.min(n.length, bars * stepsPerBar - newStep) })
              newSel.add(key)
            }
          })
          setSelectedNotes(newSel)
          return next
        })
        setHasUserEdited(true)
        return
      }

      // Delete selected: Delete or Backspace
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedNotes.size > 0) {
        e.preventDefault()
        setNoteMap(prev => {
          const next = new Map(prev)
          selectedNotes.forEach(key => next.delete(key))
          return next
        })
        setSelectedNotes(new Set())
        setHasUserEdited(true)
        return
      }

      // Arrow keys: nudge selected notes (Shift = bigger jumps)
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && selectedNotes.size > 0) {
        e.preventDefault()
        const bigJump = e.shiftKey
        let dStep = 0, dMidi = 0
        if (e.key === 'ArrowLeft')  dStep = bigJump ? -stepsPerBar : -1
        if (e.key === 'ArrowRight') dStep = bigJump ? stepsPerBar : 1
        if (e.key === 'ArrowUp')    dMidi = bigJump ? 12 : 1  // semitone or octave
        if (e.key === 'ArrowDown')  dMidi = bigJump ? -12 : -1

        setNoteMap(prev => {
          const next = new Map(prev)
          const newSel = new Set<string>()
          const totalMax = bars * stepsPerBar

          // Collect notes to move
          const toMove: { key: string; midi: number; step: number; length: number }[] = []
          selectedNotes.forEach(k => {
            const d = prev.get(k)
            if (d) {
              const [m, s] = k.split(':')
              toMove.push({ key: k, midi: parseInt(m), step: parseInt(s), length: d.length })
            }
          })

          // Remove old positions
          toMove.forEach(n => next.delete(n.key))

          // Add at new positions, snapping to scale (only in strict mode)
          toMove.forEach(n => {
            let newMidi = n.midi + dMidi
            const newStep = Math.max(0, Math.min(n.step + dStep, totalMax - 1))

            // For up/down: walk to nearest in-scale note (only when strict scale is on)
            if (strictScale && dMidi !== 0 && !scaleMidiSet.has(newMidi)) {
              const dir = dMidi > 0 ? 1 : -1
              for (let walk = 1; walk <= 12; walk++) {
                if (scaleMidiSet.has(newMidi + dir * walk)) { newMidi = newMidi + dir * walk; break }
              }
            }

            if ((!strictScale || scaleMidiSet.has(newMidi)) && newStep < totalMax) {
              const newKey = `${newMidi}:${newStep}`
              next.set(newKey, { length: n.length })
              newSel.add(newKey)
            }
          })

          setSelectedNotes(newSel)
          return next
        })
        setHasUserEdited(true)
        return
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose, selectedNotes, bars, stepsPerBar, scaleMidiSet])

  // â”€â”€ Clear all â”€â”€
  const clearAll = useCallback(() => {
    setNoteMap(new Map())
    setSelectedNotes(new Set())
    setHasUserEdited(true)
  }, [])

  const totalSteps = bars * stepsPerBar
  const gridW = totalSteps * cellW

  return (
    <div
      className="absolute bottom-0 left-0 right-0 z-[100] flex flex-col select-none"
      style={{
        height: pianoRollHeight,
        background: '#111318',
        borderTop: '1px solid rgba(255,255,255,0.04)',
        boxShadow: '0 -8px 16px #050607',
      }}
      onClick={e => e.stopPropagation()}
    >
            {/* ══ TOP RESIZE HANDLE ══ */}
      <div
        className="shrink-0 cursor-ns-resize flex items-center justify-center group"
        style={{
          height: 6,
          background: '#16181d',
          borderBottom: '1px solid rgba(255,255,255,0.04)',
        }}
        onMouseDown={(e) => {
          e.preventDefault()
          isResizingHeight.current = true
          const startY = e.clientY
          const startH = pianoRollHeight
          const onMove = (ev: MouseEvent) => {
            if (!isResizingHeight.current) return
            const delta = startY - ev.clientY
            setPianoRollHeight(Math.max(200, Math.min(startH + delta, window.innerHeight - 100)))
          }
          const onUp = () => {
            isResizingHeight.current = false
            window.removeEventListener('mousemove', onMove)
            window.removeEventListener('mouseup', onUp)
          }
          window.addEventListener('mousemove', onMove)
          window.addEventListener('mouseup', onUp)
        }}
      >
        <div className="w-8 h-0.5 rounded-full bg-white/10 group-hover:bg-white/30 transition-colors" />
      </div>

{/* â•â•â• TOOLBAR â•â•â• */}
      <div className="flex items-center justify-between px-3 py-1.5 shrink-0"
        style={{ background: '#16181d', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        <div className="flex items-center gap-2">
          {/* Channel name + source */}
          <span className="text-[9px] font-black uppercase tracking-wider" style={{ color }}>
            {"\u{1F3B9}"} {channelName}
          </span>
          {channelData && (
            <span className="text-[6px] font-mono px-1 py-0.5 rounded" style={{ color: '#5a616b', background: '#0a0b0d' }}>
              {channelData.source}
            </span>
          )}
          {isNoteMode ? (
            <span className="text-[7px] font-bold font-mono px-1 py-0.5" style={{ color: '#b8a47f', background: '#0a0b0d', borderRadius: '8px', boxShadow: 'inset 1px 1px 3px #050607, inset -1px -1px 3px #1a1d22' }}>
              NOTE â™¯â™­
            </span>
          ) : (
            <>
              <span className="text-[7px] font-mono" style={{ color: '#5a616b' }}>ðŸŽµ {scale.replace(/\d+:/, ':')}</span>
              <span className="text-[7px] font-mono" style={{ color: '#5a616b' }}>({scaleMidiSet.size} notes)</span>
            </>
          )}

          <div className="w-px h-3.5 bg-white/[0.08]" />

          {/* Arp indicator */}
          {arpInfo.mode !== 'off' && (
            <>
              <span className="text-[7px] font-bold px-1.5 py-0.5 rounded-lg flex items-center gap-1"
                style={{ color: '#b8a47f', background: '#0a0b0d', boxShadow: 'inset 1px 1px 3px #050607, inset -1px -1px 3px #1a1d22' }}>
                ðŸŽ¹ ARP {arpInfo.mode.toUpperCase()} Ã—{arpInfo.rate}
              </span>
              <div className="w-px h-3.5 bg-white/[0.08]" />
            </>
          )}

          {/* Transpose indicator */}
          {transposeValue !== 0 && (
            <>
              <span className="text-[7px] font-bold px-1.5 py-0.5 rounded-lg"
                style={{ color: '#6f8fb3', background: '#0a0b0d', boxShadow: 'inset 1px 1px 3px #050607, inset -1px -1px 3px #1a1d22' }}>
                â¬† TRANS {transposeValue > 0 ? `+${transposeValue}` : transposeValue}
              </span>
              <div className="w-px h-3.5 bg-white/[0.08]" />
            </>
          )}

          {/* Slow/Fast indicator — tempo stretch active */}
          {slowFactor !== 1 && (
            <>
              <span className="text-[7px] font-bold px-1.5 py-0.5 rounded-lg"
                style={{ color: '#e879f9', background: '#0a0b0d', boxShadow: 'inset 1px 1px 3px #050607, inset -1px -1px 3px #1a1d22' }}>
                {slowFactor > 1 ? `\u{1F422} SLOW \u00D7${slowFactor}` : `\u26A1 FAST \u00D7${+(1/slowFactor).toFixed(1)}`}
              </span>
              <div className="w-px h-3.5 bg-white/[0.08]" />
            </>
          )}

          {/* Active effects count */}
          {effectParams.length > 0 && (
            <>
              <span className="text-[7px] font-bold px-1.5 py-0.5 rounded-lg"
                style={{ color: `${color}90`, background: '#0a0b0d', boxShadow: 'inset 1px 1px 3px #050607, inset -1px -1px 3px #1a1d22' }}>
                {effectParams.length} FX
              </span>
              <div className="w-px h-3.5 bg-white/[0.08]" />
            </>
          )}

          {/* Bars selector */}
          <>
          <span className="text-[7px] uppercase tracking-wider font-bold" style={{ color: '#5a616b' }}>Bars</span>
          {BAR_OPTIONS.map(b => (
            <button
              key={b}
              onClick={() => { setBars(b); setHasUserEdited(true) }}
              className="px-1.5 py-0.5 text-[8px] font-bold cursor-pointer transition-all"
              style={{
                background: bars === b ? '#16181d' : '#0a0b0d',
                color: bars === b ? color : '#5a616b',
                border: 'none',
                borderRadius: '8px',
                boxShadow: bars === b
                  ? 'inset 2px 2px 4px #050607, inset -2px -2px 4px #1a1d22'
                  : '2px 2px 4px #050607, -2px -2px 4px #1a1d22',
              }}
            >
              {b}
            </button>
          ))}

          <div className="w-px h-3.5 bg-white/[0.08]" />

          {/* Grid resolution */}
          <span className="text-[7px] uppercase tracking-wider font-bold" style={{ color: '#5a616b' }}>Grid</span>
          {GRID_OPTIONS.map(g => (
            <button
              key={g}
              onClick={() => {
                if (g === stepsPerBar) return
                const ratio = g / stepsPerBar
                setStepsPerBar(g)
                setNoteMap(prev => {
                  const next = new Map<string, NoteData>()
                  prev.forEach((data, key) => {
                    const [midiStr, stepStr] = key.split(':')
                    const newStep = Math.round(parseInt(stepStr) * ratio)
                    const newLen = Math.max(1, Math.round(data.length * ratio))
                    next.set(`${midiStr}:${newStep}`, { length: newLen })
                  })
                  return next
                })
                setHasUserEdited(true)
              }}
              className="px-1.5 py-0.5 text-[8px] font-bold cursor-pointer transition-all"
              style={{
                background: stepsPerBar === g ? '#16181d' : '#0a0b0d',
                color: stepsPerBar === g ? color : '#5a616b',
                border: 'none',
                borderRadius: '8px',
                boxShadow: stepsPerBar === g
                  ? 'inset 2px 2px 4px #050607, inset -2px -2px 4px #1a1d22'
                  : '2px 2px 4px #050607, -2px -2px 4px #1a1d22',
              }}
            >
              1/{g}
            </button>
          ))}

          <div className="w-px h-3.5 bg-white/[0.08]" />

          {/* Zoom controls */}
          <span className="text-[7px] uppercase tracking-wider font-bold" style={{ color: '#5a616b' }}>Zoom</span>
          <button
            onClick={() => setZoom(z => Math.max(0.4, +(z - 0.2).toFixed(1)))}
            className="px-1 py-0.5 text-[9px] font-bold cursor-pointer transition-all"
            style={{ background: '#0a0b0d', color: '#e8ecf0', border: 'none', borderRadius: '8px', boxShadow: '2px 2px 4px #050607, -2px -2px 4px #1a1d22', lineHeight: 1 }}
          >âˆ’</button>
          <span className="text-[7px] font-mono font-bold" style={{ color: '#e8ecf0' }}>{Math.round(zoom * 100)}%</span>
          <button
            onClick={() => setZoom(z => Math.min(3, +(z + 0.2).toFixed(1)))}
            className="px-1 py-0.5 text-[9px] font-bold cursor-pointer transition-all"
            style={{ background: '#0a0b0d', color: '#e8ecf0', border: 'none', borderRadius: '8px', boxShadow: '2px 2px 4px #050607, -2px -2px 4px #1a1d22', lineHeight: 1 }}
          >+</button>

          <div className="w-px h-3.5 bg-white/[0.08]" />

          {/* Transport position indicator */}
          {transportPlaying && playheadStep >= 0 && (
            <span className="text-[7px] font-mono px-1.5 py-0.5 rounded flex items-center gap-1"
              style={{ background: `${color}15`, color, border: `1px solid ${color}25` }}>
              <span style={{ display: 'inline-block', width: 5, height: 5, borderRadius: '50%', background: color, animation: 'pulse 1s ease-in-out infinite' }} />
              Bar {Math.floor(playheadStep / stepsPerBar) + 1} · Beat {Math.floor((playheadStep % stepsPerBar) / (stepsPerBar / 4)) + 1}
            </span>
          )}

          <div className="w-px h-3.5 bg-white/[0.08]" />

          {/* Input mode toggle: Open / Chord */}
          <div className="flex items-center gap-0 rounded-lg" style={{ background: '#0a0b0d', boxShadow: '2px 2px 4px #050607, -2px -2px 4px #1a1d22' }}>
            <button
              onClick={() => setInputMode('open')}
              className="px-2 py-0.5 text-[7px] font-bold cursor-pointer transition-all rounded-l-lg"
              style={{
                background: inputMode === 'open' ? '#16181d' : 'transparent',
                color: inputMode === 'open' ? '#e8ecf0' : '#5a616b',
                border: 'none',
                boxShadow: inputMode === 'open' ? 'inset 2px 2px 4px #050607, inset -2px -2px 4px #1a1d22' : 'none',
              }}
              title="Open mode: place single notes"
            >
              ♪ Open
            </button>
            <button
              onClick={() => setInputMode('chord')}
              className="px-2 py-0.5 text-[7px] font-bold cursor-pointer transition-all rounded-r-lg"
              style={{
                background: inputMode === 'chord' ? '#16181d' : 'transparent',
                color: inputMode === 'chord' ? '#b8a47f' : '#5a616b',
                border: 'none',
                boxShadow: inputMode === 'chord' ? 'inset 2px 2px 4px #050607, inset -2px -2px 4px #1a1d22' : 'none',
              }}
              title="Chord mode: click places a diatonic triad (root + 3rd + 5th from the scale)"
            >
              🎹 Chord
            </button>
          </div>

          {/* Strict Scale toggle */}
          <button
            onClick={() => setStrictScale(s => !s)}
            className="px-2 py-0.5 text-[7px] font-bold cursor-pointer transition-all rounded-lg flex items-center gap-1"
            style={{
              background: strictScale ? '#16181d' : '#0a0b0d',
              color: strictScale ? '#7fa998' : '#5a616b',
              border: 'none',
              borderRadius: '8px',
              boxShadow: strictScale
                ? 'inset 2px 2px 4px #050607, inset -2px -2px 4px #1a1d22'
                : '2px 2px 4px #050607, -2px -2px 4px #1a1d22',
            }}
            title={strictScale
              ? 'Strict Scale ON — only scale notes can be placed. Click to allow chromatic notes.'
              : 'Strict Scale OFF — all 12 semitones available. Click to lock to scale.'}
          >
            {strictScale ? '🔒 Scale' : '🔓 Free'}
          </button>

          <div className="w-px h-3.5 bg-white/[0.08]" />

          {/* Preset dropdown */}
          <div className="relative" ref={presetMenuRef}>
            <button
              onClick={() => setShowPresetMenu(v => !v)}
              className="px-2 py-0.5 text-[7px] font-bold cursor-pointer transition-all uppercase tracking-wider flex items-center gap-1"
              style={{
                background: showPresetMenu ? '#16181d' : '#0a0b0d',
                color: showPresetMenu ? color : '#5a616b',
                border: 'none',
                borderRadius: '8px',
                boxShadow: showPresetMenu
                  ? 'inset 2px 2px 4px #050607, inset -2px -2px 4px #1a1d22'
                  : '2px 2px 4px #050607, -2px -2px 4px #1a1d22',
              }}
            >
              âœ¦ Presets
            </button>

            {showPresetMenu && (
              <div
                className="absolute bottom-full left-0 mb-1 rounded-xl overflow-hidden z-[200]"
                style={{
                  background: '#0a0b0d',
                  border: '1px solid rgba(255,255,255,0.06)',
                  boxShadow: '0 -8px 24px rgba(0,0,0,0.5)',
                  minWidth: '220px',
                }}
              >
                {/* Category tabs */}
                <div className="flex gap-0.5 px-1.5 pt-1.5 pb-1 overflow-x-auto" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  {PRESET_CATEGORIES.map(cat => (
                    <button
                      key={cat.key}
                      onClick={() => setPresetCategory(cat.key)}
                      className="px-1.5 py-0.5 text-[6px] font-bold cursor-pointer transition-all whitespace-nowrap rounded-md"
                      style={{
                        background: presetCategory === cat.key ? '#16181d' : 'transparent',
                        color: presetCategory === cat.key ? color : '#5a616b',
                        border: 'none',
                        boxShadow: presetCategory === cat.key ? 'inset 1px 1px 3px #050607, inset -1px -1px 3px #1a1d22' : 'none',
                      }}
                    >
                      {cat.icon} {cat.label}
                    </button>
                  ))}
                </div>

                {/* Preset list */}
                <div className="px-1.5 py-1 flex flex-col gap-0.5 max-h-[200px] overflow-y-auto">
                  {PIANO_PRESETS.filter(p => p.category === presetCategory).map(preset => (
                    <button
                      key={preset.name}
                      onClick={() => {
                        const newNoteMap = applyPreset(preset, scale, bars, stepsPerBar)
                        setNoteMap(newNoteMap)
                        setSelectedNotes(new Set())
                        setHasUserEdited(true)
                        setShowPresetMenu(false)
                      }}
                      className="px-2 py-1 text-[8px] font-bold cursor-pointer transition-all text-left rounded-lg hover:brightness-125"
                      style={{
                        background: '#111318',
                        color: '#e8ecf0',
                        border: 'none',
                        borderRadius: '8px',
                        boxShadow: '2px 2px 4px #050607, -2px -2px 4px #1a1d22',
                      }}
                    >
                      {preset.name}
                    </button>
                  ))}
                </div>

                {/* Info */}
                <div className="px-2 py-1" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                  <span className="text-[6px] font-mono" style={{ color: '#5a616b' }}>
                    Presets adapt to your scale Â· Replaces current notes
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Chord Palette dropdown */}
          <div className="relative" ref={chordPaletteRef}>
            <button
              onClick={() => setShowChordPalette(v => !v)}
              className="px-2 py-0.5 text-[7px] font-bold cursor-pointer transition-all uppercase tracking-wider flex items-center gap-1"
              style={{
                background: showChordPalette ? '#16181d' : '#0a0b0d',
                color: showChordPalette ? '#b8a47f' : '#5a616b',
                border: 'none',
                borderRadius: '8px',
                boxShadow: showChordPalette
                  ? 'inset 2px 2px 4px #050607, inset -2px -2px 4px #1a1d22'
                  : '2px 2px 4px #050607, -2px -2px 4px #1a1d22',
              }}
              title="Insert diatonic chords from the current scale"
            >
              Chords
            </button>

            {showChordPalette && (
              <div
                className="absolute bottom-full left-0 mb-1 rounded-xl overflow-hidden z-[200]"
                style={{
                  background: '#0a0b0d',
                  border: '1px solid rgba(255,255,255,0.06)',
                  boxShadow: '0 -8px 24px rgba(0,0,0,0.5)',
                  minWidth: '200px',
                }}
              >
                <div className="px-2 py-1.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <span className="text-[7px] font-bold uppercase tracking-wider" style={{ color: '#b8a47f' }}>
                    Diatonic Chords in {scale.replace(/\d+:/, ':')}
                  </span>
                  <div className="text-[6px] font-mono mt-0.5" style={{ color: '#5a616b' }}>
                    Click to insert at next empty beat · Ctrl+click grid to stamp
                  </div>
                </div>
                <div className="px-1.5 py-1 flex flex-wrap gap-1">
                  {diatonicChords.map((chord) => (
                    <button
                      key={chord.degree}
                      onClick={() => {
                        // Find the next empty beat position (quarter note grid)
                        const beatLen = Math.max(1, Math.floor(stepsPerBar / 4))
                        const totalS = bars * stepsPerBar
                        let insertStep = 0
                        // Find first empty beat
                        for (let s = 0; s < totalS; s += beatLen) {
                          let occupied = false
                          noteMapRef.current.forEach((_d, k) => {
                            const kStep = parseInt(k.split(':')[1])
                            if (kStep >= s && kStep < s + beatLen) occupied = true
                          })
                          if (!occupied) { insertStep = s; break }
                        }
                        setNoteMap(prev => {
                          const next = new Map(prev)
                          chord.notes.forEach(midi => {
                            if (scaleMidiSet.has(midi)) {
                              next.set(`${midi}:${insertStep}`, { length: beatLen })
                            }
                          })
                          return next
                        })
                        setHasUserEdited(true)
                        if (onNotePreview && chord.notes.length > 0) onNotePreview(chord.notes[0])
                      }}
                      className="px-2 py-1.5 text-center cursor-pointer transition-all rounded-lg hover:brightness-125"
                      style={{
                        background: '#111318',
                        color: '#e8ecf0',
                        border: 'none',
                        borderRadius: '8px',
                        boxShadow: '2px 2px 4px #050607, -2px -2px 4px #1a1d22',
                        minWidth: '36px',
                      }}
                    >
                      <div className="text-[9px] font-bold" style={{ color: '#b8a47f' }}>{chord.roman}</div>
                      <div className="text-[6px] font-mono mt-0.5" style={{ color: '#5a616b' }}>
                        {NOTE_NAMES[chord.notes[0] % 12]}{chord.quality}
                      </div>
                    </button>
                  ))}
                </div>
                <div className="px-2 py-1" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                  <span className="text-[6px] font-mono" style={{ color: '#5a616b' }}>
                    Tip: Ctrl+click any grid cell to stamp a triad
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Detected chord name */}
          {detectedChord && (
            <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-lg" style={{
              color: '#b8a47f',
              background: '#0a0b0d',
              boxShadow: 'inset 1px 1px 3px #050607, inset -1px -1px 3px #1a1d22',
            }}>
              {detectedChord}
            </span>
          )}

          {isGenerative && !hasUserEdited && (
            <>
              <div className="w-px h-3.5 bg-white/[0.08]" />
              <span className="text-[7px] font-mono font-bold" style={{ color: '#b8a47f' }}>
                âš¡ generative â€” click grid to compose
              </span>
            </>
          )}
          </>
        </div>

        <div className="flex items-center gap-1.5">
          {hasUserEdited && (
            <span className="text-[7px] font-black px-1.5 py-0.5 rounded-lg"
              style={{ color: '#7fa998', background: '#0a0b0d', boxShadow: 'inset 1px 1px 3px #050607, inset -1px -1px 3px #1a1d22' }}>
              â— LIVE
            </span>
          )}
          <span className="text-[7px] font-mono font-bold" style={{ color: '#5a616b' }}>
            {noteMap.size} note{noteMap.size !== 1 ? 's' : ''}
          </span>
          {selectedNotes.size > 0 && (
            <>
              <span className="text-[7px] font-mono font-bold px-1.5 py-0.5 rounded-lg" style={{ color, background: '#0a0b0d', boxShadow: 'inset 1px 1px 3px #050607, inset -1px -1px 3px #1a1d22' }}>
                {selectedNotes.size} sel
              </span>
              <button onClick={() => {
                const notes: { midi: number; step: number; length: number }[] = []
                selectedNotes.forEach(key => { const [m, s] = key.split(':'); const d = noteMap.get(key); if (d) notes.push({ midi: parseInt(m), step: parseInt(s), length: d.length }) })
                clipboardRef.current = notes
              }}
                className="px-1.5 py-0.5 text-[7px] cursor-pointer transition-all duration-[180ms] font-bold rounded-lg"
                style={{ background: '#0a0b0d', color: '#6f8fb3', boxShadow: '2px 2px 4px #050607, -2px -2px 4px #1a1d22' }}
                title="Copy (Ctrl+C)">Copy</button>
              <button onClick={() => {
                const notes: { midi: number; step: number; length: number }[] = []; let maxEnd = 0; let minStep = Infinity
                selectedNotes.forEach(key => { const [m, s] = key.split(':'); const d = noteMap.get(key); if (d) { const st = parseInt(s); notes.push({ midi: parseInt(m), step: st, length: d.length }); maxEnd = Math.max(maxEnd, st + d.length); minStep = Math.min(minStep, st) } })
                const span = maxEnd - minStep
                setNoteMap(prev => { const next = new Map(prev); const newSel = new Set<string>(); notes.forEach(n => { const ns = n.step + span; if (ns < totalSteps) { const k = `${n.midi}:${ns}`; next.set(k, { length: Math.min(n.length, totalSteps - ns) }); newSel.add(k) } }); setSelectedNotes(newSel); return next })
                setHasUserEdited(true)
              }}
                className="px-1.5 py-0.5 text-[7px] cursor-pointer transition-all duration-[180ms] font-bold rounded-lg"
                style={{ background: '#0a0b0d', color: '#b8a47f', boxShadow: '2px 2px 4px #050607, -2px -2px 4px #1a1d22' }}
                title="Duplicate (Ctrl+D)">Dup</button>
              <button onClick={() => {
                setNoteMap(prev => { const next = new Map(prev); selectedNotes.forEach(key => next.delete(key)); return next })
                setSelectedNotes(new Set())
                setHasUserEdited(true)
              }}
                className="px-1.5 py-0.5 text-[7px] cursor-pointer transition-all duration-[180ms] font-bold rounded-lg"
                style={{ background: '#0a0b0d', color: '#b86f6f', boxShadow: '2px 2px 4px #050607, -2px -2px 4px #1a1d22' }}
                title="Delete (Del)">Del</button>
            </>
          )}
          {clipboardRef.current.length > 0 && (
            <button onClick={() => {
              const clip = clipboardRef.current; const minStep = Math.min(...clip.map(n => n.step))
              let pasteOffset = 0
              if (selectedNotes.size > 0) { const maxSelStep = Math.max(...[...selectedNotes].map(k => { const s = parseInt(k.split(':')[1]); const d = noteMap.get(k); return s + (d?.length || 1) })); pasteOffset = maxSelStep - minStep }
              setNoteMap(prev => { const next = new Map(prev); const newSel = new Set<string>(); clip.forEach(n => { const ns = n.step + pasteOffset; if (ns < totalSteps) { const k = `${n.midi}:${ns}`; next.set(k, { length: Math.min(n.length, totalSteps - ns) }); newSel.add(k) } }); setSelectedNotes(newSel); return next })
              setHasUserEdited(true)
            }}
              className="px-1.5 py-0.5 text-[7px] cursor-pointer transition-all duration-[180ms] font-bold rounded-lg"
              style={{ background: '#0a0b0d', color: '#7fa998', boxShadow: '2px 2px 4px #050607, -2px -2px 4px #1a1d22' }}
              title="Paste (Ctrl+V)">Paste</button>
          )}
          <button onClick={clearAll}
            className="px-1.5 py-0.5 text-[7px] cursor-pointer transition-all duration-[180ms] font-bold rounded-lg"
            style={{ background: '#0a0b0d', color: '#5a616b', boxShadow: '2px 2px 4px #050607, -2px -2px 4px #1a1d22' }}>
            Clear
          </button>
          {channelData && (
            <button onClick={() => setShowEffectsPanel(p => !p)}
              className="px-1.5 py-0.5 text-[7px] cursor-pointer transition-all duration-[180ms] font-bold rounded-lg"
              style={{
                background: showEffectsPanel ? '#16181d' : '#0a0b0d',
                color: showEffectsPanel ? color : '#5a616b',
                boxShadow: showEffectsPanel
                  ? 'inset 2px 2px 4px #050607, inset -2px -2px 4px #1a1d22'
                  : '2px 2px 4px #050607, -2px -2px 4px #1a1d22',
              }}
              title="Toggle Effects Panel">
              âœ¦ FX
            </button>
          )}

          {isSampleChannel && (
            <button onClick={() => setShowWaveform(p => !p)}
              className="px-1.5 py-0.5 text-[7px] cursor-pointer transition-all duration-[180ms] font-bold rounded-lg"
              style={{
                background: showWaveform ? '#16181d' : '#0a0b0d',
                color: showWaveform ? '#10b981' : '#5a616b',
                boxShadow: showWaveform
                  ? 'inset 2px 2px 4px #050607, inset -2px -2px 4px #1a1d22'
                  : '2px 2px 4px #050607, -2px -2px 4px #1a1d22',
              }}
              title="Toggle Waveform / Sample Trim">
              WAVE
            </button>
          )}
          <button onClick={onClose}
            className="px-1.5 py-0.5 text-[7px] cursor-pointer transition-all duration-[180ms] font-bold rounded-lg"
            style={{ background: '#0a0b0d', color: '#5a616b', boxShadow: '2px 2px 4px #050607, -2px -2px 4px #1a1d22' }}
            title="Esc">
            âœ•
          </button>
        </div>
      </div>


      {/* ══ WAVEFORM / SAMPLE TRIM STRIP ══ */}
      {showWaveform && isSampleChannel && (
        <div
          className="shrink-0 select-none"
          style={{
            background: '#0c0e12',
            borderBottom: '1px solid rgba(255,255,255,0.04)',
          }}
        >
          {/* Waveform toolbar */}
          <div className="flex items-center justify-between px-3 py-1"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
            <div className="flex items-center gap-2">
              <span className="text-[7px] font-black uppercase tracking-wider" style={{ color: isSlicedChannel ? '#22d3ee' : '#10b981' }}>
                {isSlicedChannel ? '🎹 PAD SAMPLER TRIM' : 'SAMPLE TRIM'}
              </span>
              {isSlicedChannel && (
                <span className="text-[5px] font-mono px-1 py-0.5 rounded" style={{ background: '#22d3ee15', color: '#22d3ee80' }}>
                  LOCKED — adjust in Pad Sampler
                </span>
              )}
              {sampleDuration > 0 && (
                <span className="text-[6px] font-mono" style={{ color: '#5a616b' }}>
                  {sampleDuration.toFixed(1)}s total
                </span>
              )}
              <div className="w-px h-3 bg-white/[0.06]" />
              {/* Shot / Full toggle — hidden on sliced channels (pad sampler controls this) */}
              {!isSlicedChannel && (
                <button
                  onClick={toggleFullSample}
                  className="px-2 py-0.5 text-[7px] font-bold cursor-pointer transition-all rounded-md"
                  style={{
                    background: isFullSample ? '#10b98120' : '#f59e0b20',
                    color: isFullSample ? '#10b981' : '#f59e0b',
                    border: `1px solid ${isFullSample ? '#10b98130' : '#f59e0b30'}`,
                  }}
                >
                  {isFullSample ? 'FULL SAMPLE' : 'SOUND SHOT'}
                </button>
              )}
              {!isFullSample && sampleDuration > 0 && (
                <span className="text-[6px] font-mono" style={{ color: '#f59e0b' }}>
                  {((sampleEnd - sampleBegin) * sampleDuration).toFixed(2)}s region
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              {/* Begin/End readouts */}
              <span className="text-[7px] font-mono font-bold px-1 py-0.5 rounded"
                style={{ background: '#111318', color: '#10b981' }}>
                B:{sampleBegin.toFixed(2)}
              </span>
              <span className="text-[7px] font-mono font-bold px-1 py-0.5 rounded"
                style={{ background: '#111318', color: '#f43f5e' }}>
                E:{sampleEnd.toFixed(2)}
              </span>
              <div className="w-px h-3 bg-white/[0.06]" />
              {/* Preview button */}
              <button
                onClick={toggleWaveformPreview}
                className="px-2 py-0.5 text-[7px] font-bold cursor-pointer transition-all rounded-md"
                style={{
                  background: isWaveformPreviewing ? `${color}20` : '#0a0b0d',
                  color: isWaveformPreviewing ? color : 'rgba(255,255,255,0.4)',
                  border: `1px solid ${isWaveformPreviewing ? `${color}40` : 'rgba(255,255,255,0.06)'}`,
                  boxShadow: '2px 2px 4px #050607, -2px -2px 4px #1a1d22',
                }}
              >
                {isWaveformPreviewing ? 'STOP' : 'PREVIEW'}
              </button>
              {/* Reset — disabled on sliced channels */}
              {!isSlicedChannel && (
                <button
                  onClick={() => {
                    setSampleBegin(0)
                    setSampleEnd(1)
                    setIsFullSample(true)
                    if (channelData) {
                      if (channelData.effects.includes('begin')) onEffectRemove?.('begin')
                      if (channelData.effects.includes('end')) onEffectRemove?.('end')
                    }
                  }}
                  className="px-1.5 py-0.5 text-[7px] font-bold cursor-pointer transition-all rounded-md"
                  style={{
                    background: '#0a0b0d', color: '#5a616b',
                    boxShadow: '2px 2px 4px #050607, -2px -2px 4px #1a1d22',
                  }}
                >
                  RESET
                </button>
              )}
            </div>
          </div>
          {/* Waveform canvas */}
          <div className="px-3 py-1.5">
            {waveformLoading ? (
              <div className="flex items-center justify-center" style={{ height: 56, color: 'rgba(255,255,255,0.2)' }}>
                <span className="text-[8px] animate-pulse">Loading waveform...</span>
              </div>
            ) : (
              <canvas
                ref={waveformCanvasRef}
                width={800}
                height={56}
                className="w-full rounded-md"
                style={{
                  height: 56,
                  cursor: isSlicedChannel ? 'not-allowed' : waveformDragging ? 'ew-resize' : 'default',
                }}
                onMouseDown={handleWaveformMouseDown}
              />
            )}
          </div>
        </div>
      )}

      {/* â•â•â• MAIN CONTENT: Effects Panel + Grid â•â•â• */}
      <div className="flex-1 flex overflow-hidden">

        {/* â”€â”€ EFFECTS SIDE PANEL â”€â”€ */}
        {showEffectsPanel && channelData && (
          <div
            className="shrink-0 overflow-y-auto"
            style={{
              width: 180,
              background: '#0a0b0d',
              borderRight: '1px solid rgba(255,255,255,0.04)',
              scrollbarWidth: 'thin',
              scrollbarColor: `${color}25 transparent`,
            }}
          >
            {/* â”€â”€ Node header â”€â”€ */}
            <div className="px-2 py-1.5 sticky top-0 z-10" style={{ background: '#0a0b0d', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
                <span className="text-[8px] font-black uppercase tracking-wider" style={{ color: `${color}cc` }}>{channelName}</span>
          {/* Active tool indicator */}
          <div className="w-px h-3.5 bg-white/[0.08]" />
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => setActiveTool('pointer')}
              className="px-1.5 py-0.5 text-[7px] font-bold cursor-pointer transition-all rounded-md"
              style={{
                background: activeTool === 'pointer' ? '#16181d' : 'transparent',
                color: activeTool === 'pointer' ? color : '#5a616b',
                border: 'none',
                boxShadow: activeTool === 'pointer' ? 'inset 2px 2px 4px #050607, inset -2px -2px 4px #1a1d22' : 'none',
              }}
              title="Pointer tool (V)"
            >
              V
            </button>
            <button
              onClick={() => setActiveTool('split')}
              className="px-1.5 py-0.5 text-[7px] font-bold cursor-pointer transition-all rounded-md"
              style={{
                background: activeTool === 'split' ? '#16181d' : 'transparent',
                color: activeTool === 'split' ? '#e8a040' : '#5a616b',
                border: 'none',
                boxShadow: activeTool === 'split' ? 'inset 2px 2px 4px #050607, inset -2px -2px 4px #1a1d22' : 'none',
              }}
              title="Split/scissors tool (C)"
            >
              C
            </button>
          </div>
              </div>
              <div className="text-[6px] font-mono mt-0.5" style={{ color: '#5a616b' }}>
                {channelData.source} Â· {channelData.sourceType}
              </div>
            </div>

            {/* â”€â”€ Gain â”€â”€ */}
            {(() => {
              const gainParam = channelData.params.find(p => p.key === 'gain')
              if (!gainParam) return null
              return (
                <div className="flex justify-center py-1.5 px-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                  <StudioKnob
                    label="GAIN"
                    value={gainParam.value}
                    min={0}
                    max={2}
                    step={0.01}
                    size={28}
                    color={color}
                    isComplex={gainParam.isComplex}
                    onChange={(v) => onEffectChange?.('gain', v)}
                  />
                </div>
              )
            })()}

            {/* â”€â”€ Transpose â”€â”€ */}
            <div className="px-2 py-1.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
              <div className="flex items-center gap-1 mb-1">
                <span className="text-[6px] font-bold uppercase tracking-wider" style={{ color: '#6f8fb3' }}>â¬† Transpose</span>
                <span className="text-[7px] font-mono font-bold ml-auto" style={{ color: transposeValue !== 0 ? '#6f8fb3' : '#5a616b' }}>
                  {transposeValue > 0 ? `+${transposeValue}` : transposeValue}
                </span>
              </div>
              <div className="flex items-center justify-center gap-1">
                <button
                  onClick={() => onTransposeChange?.(transposeValue - 1)}
                  className="cursor-pointer transition-all duration-100 active:scale-90"
                  style={{
                    width: 18, height: 16, borderRadius: 5,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '7px', fontWeight: 900, color: '#6f8fb3',
                    background: '#111318', border: 'none',
                    boxShadow: '2px 2px 4px #050607, -2px -2px 4px #1a1d22',
                  }}
                >âˆ’</button>
                <StudioKnob
                  label=""
                  value={transposeValue}
                  min={-24}
                  max={24}
                  step={1}
                  size={24}
                  color="#6f8fb3"
                  formatValue={(v) => (v > 0 ? `+${v}` : `${v}`)}
                  onChange={(v) => onTransposeChange?.(v)}
                />
                <button
                  onClick={() => onTransposeChange?.(transposeValue + 1)}
                  className="cursor-pointer transition-all duration-100 active:scale-90"
                  style={{
                    width: 18, height: 16, borderRadius: 5,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '7px', fontWeight: 900, color: '#6f8fb3',
                    background: '#111318', border: 'none',
                    boxShadow: '2px 2px 4px #050607, -2px -2px 4px #1a1d22',
                  }}
                >+</button>
              </div>
            </div>

            {/* â”€â”€ ARP â”€â”€ */}
            <div className="px-2 py-1.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
              <div className="flex items-center gap-1 mb-1">
                <span className="text-[6px] font-bold uppercase tracking-wider" style={{ color: arpInfo.mode !== 'off' ? '#b8a47f' : '#5a616b' }}>ðŸŽ¹ Arp</span>
                {arpInfo.mode !== 'off' && (
                  <span className="text-[5px] font-bold ml-auto" style={{ color: '#b8a47f' }}>{arpInfo.mode.toUpperCase()} Ã—{arpInfo.rate}</span>
                )}
              </div>
              <div className="flex flex-wrap gap-0.5 justify-center">
                {(typeof ARP_MODES !== 'undefined' ? ARP_MODES : [
                  { id: 'off', label: 'Off', icon: 'â—‹' },
                  { id: 'up', label: 'Up', icon: 'â†‘' },
                  { id: 'down', label: 'Down', icon: 'â†“' },
                  { id: 'updown', label: 'Up/Down', icon: 'â†•' },
                  { id: 'random', label: 'Random', icon: '?' },
                ]).map((mode: { id: string; label: string; icon: string }) => (
                  <button
                    key={mode.id}
                    onClick={() => onArpChange?.(mode.id)}
                    className="cursor-pointer transition-all duration-100 active:scale-90"
                    style={{
                      width: 22, height: 16, borderRadius: 6,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '8px', fontWeight: 900,
                      color: arpInfo.mode === mode.id ? '#b8a47f' : '#5a616b',
                      background: arpInfo.mode === mode.id ? '#16181d' : '#111318',
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
              {arpInfo.mode !== 'off' && (
                <div className="flex justify-center mt-1">
                  <StudioKnob
                    label="RATE"
                    value={arpInfo.rate}
                    min={1}
                    max={8}
                    step={1}
                    size={24}
                    color="#b8a47f"
                    formatValue={(v) => `Ã—${v}`}
                    onChange={(v) => onArpRateChange?.(v)}
                  />
                </div>
              )}
            </div>

            {/* â”€â”€ Effect groups â”€â”€ */}
            {activeFxGroups.map((group) => (
              <div key={group.label} className="px-2 py-1.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                <div className="flex items-center gap-1 mb-1">
                  <span className="text-[7px]">{group.icon}</span>
                  <span className="text-[6px] font-bold uppercase tracking-wider" style={{ color: '#5a616b' }}>{group.label}</span>
                </div>
                <div className="flex flex-wrap gap-0.5 justify-center">
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
                        size={24}
                        color={color}
                        unit={def.unit}
                        isComplex={param.isComplex}
                        onChange={(v) => onEffectChange?.(param.key, v)}
                        onRemove={onEffectRemove ? () => onEffectRemove(param.key) : undefined}
                      />
                    )
                  })}
                </div>
              </div>
            ))}

            {/* â”€â”€ Quick-add effects â”€â”€ */}
            {onEffectAdd && (
              <div className="px-2 py-1.5">
                <div className="flex items-center gap-1 mb-1">
                  <span className="text-[6px] font-bold uppercase tracking-wider" style={{ color: '#5a616b' }}>+ ADD FX</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {[
                    { label: 'LPF', code: '.lpf(2000)' },
                    { label: 'HPF', code: '.hpf(200)' },
                    { label: 'Reverb', code: '.room(0.5)' },
                    { label: 'Delay', code: '.delay(0.25)' },
                    { label: 'Dist', code: '.distort(0.3)' },
                    { label: 'Shape', code: '.shape(0.3)' },
                    { label: 'Crush', code: '.crush(8)' },
                    { label: 'Detune', code: '.detune(0.1)' },
                  ].filter(fx => !channelData.effects.includes(fx.label.toLowerCase().replace(/[^a-z]/g, ''))).map(fx => (
                    <button
                      key={fx.label}
                      onClick={() => onEffectAdd(fx.code)}
                      className="px-1.5 py-0.5 text-[6px] font-bold cursor-pointer transition-all duration-100 active:scale-95 rounded-lg"
                      style={{
                        background: '#111318',
                        color: '#7fa998',
                        boxShadow: '2px 2px 4px #050607, -2px -2px 4px #1a1d22',
                        border: 'none',
                      }}
                    >
                      + {fx.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

            {/* â•â•â• GRID â•â•â• */}
      <div ref={scrollRef} className="flex-1 overflow-auto relative"
        style={{ scrollbarWidth: 'thin', scrollbarColor: `${color}25 transparent` }}
        onMouseDown={handleGridMouseDown}
        onMouseMove={handleGridMouseMove}
        onMouseUp={handleGridMouseUp}
        onWheel={(e) => {
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault()
            setZoom(z => Math.max(0.4, Math.min(3, +(z + (e.deltaY > 0 ? -0.1 : 0.1)).toFixed(2))))
          }
        }}
      >

        {/* Box selection rectangle */}
        {boxSelect && (
          <div className="absolute z-40 pointer-events-none" style={{
            left: Math.min(boxSelect.startX, boxSelect.curX),
            top: Math.min(boxSelect.startY, boxSelect.curY),
            width: Math.abs(boxSelect.curX - boxSelect.startX),
            height: Math.abs(boxSelect.curY - boxSelect.startY),
            border: `1px solid ${color}80`,
            background: `${color}15`,
            borderRadius: 2,
          }} />
        )}

        {/* Generative pattern overlay */}
        {isGenerative && !hasUserEdited && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center pointer-events-none"
            style={{ background: 'rgba(28,30,34,0.85)' }}>
            <div className="text-sm font-bold mb-1" style={{ color: '#b8a47f' }}>âš¡ Generative Pattern</div>
            <div className="text-xs text-center max-w-[280px]" style={{ color: '#5a616b' }}>
              This channel uses a random/algorithmic pattern (<span className="font-mono" style={{ color: '#b8a47f', opacity: 0.7 }}>irand, perlin</span> etc.)
            </div>
            <div className="text-[10px] mt-2" style={{ color: '#5a616b' }}>Click any cell to start composing a static pattern</div>
          </div>
        )}

        {/* Transport playhead (marquee) — shows current playback position */}
        {transportPlaying && playheadStep >= 0 && (
          <div
            className="absolute z-40 pointer-events-none"
            style={{
              left: PIANO_W + playheadStep * cellW,
              top: 0,
              width: 2,
              height: rows.length * cellH,
              background: color,
              opacity: 0.9,
              boxShadow: `0 0 8px ${color}80, 0 0 2px ${color}`,
            }}
          >
            {/* Playhead triangle marker at top */}
            <div style={{
              position: 'absolute',
              top: 0,
              left: -4,
              width: 0,
              height: 0,
              borderLeft: '5px solid transparent',
              borderRight: '5px solid transparent',
              borderTop: `6px solid ${color}`,
            }} />
          </div>
        )}

        <div style={{ width: PIANO_W + gridW, position: 'relative' }}>

          {/* â”€â”€ Beat ruler (sticky top) â”€â”€ */}
          <div className="flex sticky top-0 z-20" style={{ height: 16, background: '#16181d' }}>
            <div className="sticky left-0 z-30 shrink-0"
              style={{ width: PIANO_W, height: 16, background: '#16181d', borderBottom: '1px solid rgba(255,255,255,0.04)', borderRight: '1px solid rgba(255,255,255,0.04)' }} />
            <div className="flex">
              {Array.from({ length: totalSteps }, (_, i) => {
                const beatInterval = stepsPerBar / 4
                const isBar = i % stepsPerBar === 0
                const isBeat = i % beatInterval === 0
                const barNum = Math.floor(i / stepsPerBar) + 1
                return (
                  <div key={i} className="shrink-0 flex items-end justify-start"
                    style={{
                      width: cellW, height: 16,
                      borderLeft: isBar ? '1px solid rgba(255,255,255,0.12)' : isBeat ? '1px solid rgba(255,255,255,0.06)' : 'none',
                      borderBottom: '1px solid rgba(255,255,255,0.06)',
                    }}>
                    {isBar && (
                      <span className="text-[7px] font-bold pl-1" style={{ color: `${color}60` }}>
                        {barNum}
                      </span>
                    )}
                    {isBeat && !isBar && (
                      <span className="text-[6px] pl-0.5" style={{ color: '#5a616b' }}>
                        {(i % stepsPerBar) / beatInterval + 1}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* â”€â”€ Piano keys + Grid rows â”€â”€ */}
          {rows.map(midi => {
            const name = midiNoteName(midi)
            const black = isBlackKey(midi)
            const inScale = scaleMidiSet.has(midi)
            const isRoot = midi % 12 === NOTE_NAMES.indexOf(parseScaleStr(scale).root)
            const canClick = inScale || !strictScale

            // Collect note-bar starts for this MIDI row
            const rowNotes: { step: number; length: number; key: string }[] = []
            noteMap.forEach((data, key) => {
              const [mStr, sStr] = key.split(':')
              if (parseInt(mStr) === midi) {
                rowNotes.push({ step: parseInt(sStr), length: data.length, key })
              }
            })

            // Collect transpose ghost notes â€” notes written at (midi - transposeValue) that sound here
            const ghostNotes: { step: number; length: number }[] = []
            if (transposeValue !== 0) {
              const sourceMidi = midi - transposeValue
              noteMap.forEach((data, key) => {
                const [mStr, sStr] = key.split(':')
                if (parseInt(mStr) === sourceMidi) {
                  ghostNotes.push({ step: parseInt(sStr), length: data.length })
                }
              })
            }

            return (
              <div key={midi} className="flex relative" style={{ height: cellH }}>
                {/* Piano key label (sticky left) */}
                <div
                  className="sticky left-0 z-10 shrink-0 flex items-center justify-end pr-1.5"
                  style={{
                    width: PIANO_W, height: cellH,
                      background: black ? '#0a0b0d' : '#111318',
                      borderBottom: '1px solid rgba(255,255,255,0.03)',
                      borderRight: '1px solid rgba(255,255,255,0.04)',
                  }}
                >
                  <span className="text-[7px] font-mono" style={{
                    color: isRoot ? `${color}` : inScale ? '#e8ecf0' : '#5a616b',
                    fontWeight: isRoot ? 700 : inScale ? 500 : 300,
                    opacity: isRoot ? 1 : inScale ? 0.5 : 0.25,
                  }}>
                    {isRoot ? `â— ${name}` : name}
                  </span>
                </div>

                {/* Grid cells (empty background) */}
                {Array.from({ length: totalSteps }, (_, step) => {
                  const beatInterval = stepsPerBar / 4
                  const isBarLine = step % stepsPerBar === 0
                  const isBeatLine = step % beatInterval === 0
                  const isCovered = coveredCells.has(`${midi}:${step}`)

                  return (
                    <div
                      key={step}
                      className={`shrink-0 ${canClick ? 'cursor-crosshair' : 'cursor-not-allowed'}`}
                      style={{
                        width: cellW, height: cellH,
                        background: !inScale
                            ? 'rgba(0,0,0,0.25)'
                            : isRoot
                              ? `${color}08`
                              : (black ? 'rgba(255,255,255,0.015)' : 'rgba(255,255,255,0.025)'),
                        borderBottom: '1px solid rgba(255,255,255,0.03)',
                        borderLeft: isBarLine
                          ? '1px solid rgba(255,255,255,0.12)'
                          : isBeatLine
                            ? '1px solid rgba(255,255,255,0.06)'
                            : '1px solid rgba(255,255,255,0.02)',
                        opacity: canClick ? 1 : 0.35,
                      }}
                      onMouseDown={canClick ? (e) => handleCellDown(midi, step, e) : undefined}
                      onMouseEnter={canClick ? () => handleCellEnter(midi, step) : undefined}
                    />
                  )
                })}

                {/* Note bars (rendered on top of grid cells) */}
                {rowNotes.map(({ step, length, key }) => {
                  const isSelected = selectedNotes.has(key)
                  return (
                  <div
                    key={key}
                    className="absolute z-[5] group cursor-pointer"
                    style={{
                      left: PIANO_W + step * cellW + 1,
                      top: 1,
                      width: length * cellW - 2,
                      height: cellH - 2,
                      background: isSelected ? `${color}` : `${color}cc`,
                      borderRadius: 3,
                      boxShadow: isSelected
                        ? `0 0 0 1.5px #fff, inset 0 1px 0 ${color}60`
                        : `inset 0 1px 0 ${color}30`,
                      pointerEvents: 'auto',
                    }}
                    onMouseDown={(e) => {
                      if (isResizing.current) return
                      e.preventDefault()
                      e.stopPropagation()

                      // Split tool: click a note to split it at the mouse position
                      if (activeTool === 'split') {
                        const noteData = noteMap.get(key)
                        if (noteData && noteData.length > 1) {
                          const noteStep = parseInt(key.split(':')[1])
                          // Calculate the actual grid step from mouse X position
                          const noteDiv = e.currentTarget as HTMLElement
                          const noteRect = noteDiv.getBoundingClientRect()
                          const relX = e.clientX - noteRect.left
                          const clickGridStep = noteStep + Math.max(1, Math.round(relX / cellW))
                          const splitAt = clickGridStep - noteStep
                          if (splitAt > 0 && splitAt < noteData.length) {
                            setNoteMap(prev => {
                              const next = new Map(prev)
                              next.set(key, { length: splitAt })
                              next.set(`${midi}:${clickGridStep}`, { length: noteData.length - splitAt })
                              return next
                            })
                            setHasUserEdited(true)
                          }
                        }
                        return
                      }

                      // Double-click: delete note
                      const now = Date.now()
                      if (lastClickKey.current === key && now - lastClickTime.current < 350) {
                        lastClickKey.current = null
                        lastClickTime.current = 0
                        toggleNote(midi, step, 'remove')
                        setSelectedNotes(prev => { const n = new Set(prev); n.delete(key); return n })
                        return
                      }
                      lastClickKey.current = key
                      lastClickTime.current = now

                      // Alt+click: duplicate note(s) and start drag
                      // Originals stay in place; copies follow the mouse
                      if (e.altKey) {
                        const notesToDup = isSelected && selectedNotes.size > 0
                          ? [...selectedNotes]
                          : [key]
                        const dupNotes: { key: string; midi: number; step: number; length: number }[] = []
                        notesToDup.forEach(k => {
                          const d = noteMapRef.current.get(k)
                          if (d) {
                            const [m, s] = k.split(':')
                            dupNotes.push({ key: k, midi: parseInt(m), step: parseInt(s), length: d.length })
                          }
                        })
                        // Set up drag: base = FULL noteMap (originals stay), copies will be added at delta
                        isDraggingNotes.current = true
                        isAltDuplicating.current = true
                        dragConstraint.current = 'none'
                        dragStartCell.current = { midi, step }
                        dragBaseNoteMap.current = new Map(noteMapRef.current) // originals stay
                        const origMap = new Map<string, { midi: number; step: number; length: number }>()
                        dupNotes.forEach(n => origMap.set(n.key, { midi: n.midi, step: n.step, length: n.length }))
                        dragOriginalNotes.current = origMap
                        // Select the notes being duplicated
                        setSelectedNotes(new Set(notesToDup))
                        return
                      }

                      // Ctrl/Cmd click: toggle selection
                      if (e.ctrlKey || e.metaKey) {
                        setSelectedNotes(prev => {
                          const next = new Set(prev)
                          if (next.has(key)) next.delete(key)
                          else next.add(key)
                          return next
                        })
                        return
                      }

                      // Shift+click: add to selection
                      if (e.shiftKey) {
                        setSelectedNotes(prev => {
                          const next = new Set(prev)
                          next.add(key)
                          return next
                        })
                        return
                      }

                      // Single click: select note and prepare for drag-move
                      if (!isSelected) {
                        setSelectedNotes(new Set([key]))
                      }
                      isDraggingNotes.current = true
                      isAltDuplicating.current = false
                      dragConstraint.current = 'none'
                      dragStartCell.current = { midi, step }
                      // Store original positions of all selected/clicked notes
                      const toTrack = isSelected ? [...selectedNotes] : [key]
                      const origMap = new Map<string, { midi: number; step: number; length: number }>()
                      toTrack.forEach(k => {
                        const d = noteMapRef.current.get(k)
                        if (d) {
                          const [m, s] = k.split(':')
                          origMap.set(k, { midi: parseInt(m), step: parseInt(s), length: d.length })
                        }
                      })
                      dragOriginalNotes.current = origMap
                      // Base = noteMap MINUS the notes being dragged (they'll be re-added at new positions)
                      const base = new Map(noteMapRef.current)
                      toTrack.forEach(k => base.delete(k))
                      dragBaseNoteMap.current = base
                    }}
                    onMouseEnter={() => {
                      if (!isDrawing.current || drawMode.current !== 'remove') return
                      const cellKey = `${midi}:${step}`
                      if (cellKey === lastCell.current) return
                      lastCell.current = cellKey
                      toggleNote(midi, step, 'remove')
                    }}
                  >
                    {/* Arp stripe overlay */}
                    {arpInfo && arpInfo.mode !== 'off' && (
                      <div
                        className="absolute inset-0 pointer-events-none overflow-hidden rounded-[3px]"
                        style={{
                          background: `repeating-linear-gradient(
                            ${arpInfo.mode === 'up' ? '45deg' : arpInfo.mode === 'down' ? '-45deg' : '90deg'},
                            transparent, transparent 2px,
                            ${color}20 2px, ${color}20 4px
                          )`,
                          opacity: 0.7,
                        }}
                      />
                    )}
                    {/* Resize handle on right edge */}
                    <div
                      className="absolute right-0 top-0 bottom-0 cursor-ew-resize opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{
                        width: RESIZE_HANDLE_W,
                        background: `linear-gradient(90deg, transparent, ${color})`,
                        borderRadius: '0 3px 3px 0',
                      }}
                      onMouseDown={(e) => handleResizeStart(key, e)}
                    />
                  </div>
                  )
                })}

                {/* Transpose ghost notes â€” show where transposed notes will sound */}
                {ghostNotes.map(({ step, length }, gi) => (
                  <div
                    key={`ghost-${gi}`}
                    className="absolute z-[4] pointer-events-none"
                    style={{
                      left: PIANO_W + step * cellW + 1,
                      top: 1,
                      width: length * cellW - 2,
                      height: cellH - 2,
                      border: `1px dashed ${color}60`,
                      borderRadius: 3,
                      background: `${color}08`,
                    }}
                  />
                ))}
              </div>
            )
          })}
        </div>
      </div>

      </div>{/* â•â•â• END MAIN CONTENT â•â•â• */}
    </div>
  )
}
