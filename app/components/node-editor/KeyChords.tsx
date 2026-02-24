'use client'

import { useMemo } from 'react'

// ═══════════════════════════════════════════════════════════════
//  KEY-AWARE CHORD GENERATION
//
//  Chord progressions are derived from the selected key/scale.
//  Each chord uses only notes from the scale (diatonic chords).
// ═══════════════════════════════════════════════════════════════

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

const SCALE_INTERVALS: Record<string, number[]> = {
  'major':            [0, 2, 4, 5, 7, 9, 11],
  'minor':            [0, 2, 3, 5, 7, 8, 10],
  'harmonic minor':   [0, 2, 3, 5, 7, 8, 11],
  'major pentatonic': [0, 2, 4, 7, 9],
  'minor pentatonic': [0, 3, 5, 7, 10],
  'blues':            [0, 3, 5, 6, 7, 10],
  'dorian':           [0, 2, 3, 5, 7, 9, 10],
  'phrygian':         [0, 1, 3, 5, 7, 8, 10],
  'lydian':           [0, 2, 4, 6, 7, 9, 11],
  'mixolydian':       [0, 2, 4, 5, 7, 9, 10],
  'chromatic':        [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  'whole tone':       [0, 2, 4, 6, 8, 10],
  'diminished':       [0, 2, 3, 5, 6, 8, 9, 11],
}

// Roman numeral chord labels for major and minor keys
const MAJOR_NUMERALS = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°']
const MINOR_NUMERALS = ['i', 'ii°', 'III', 'iv', 'v', 'VI', 'VII']

interface ChordInfo {
  label: string
  notes: string     // Strudel format: [c3,e3,g3]
  numeral: string
  quality: 'major' | 'minor' | 'diminished' | 'augmented'
}

function parseScale(scaleStr: string): { root: string; octave: number; mode: string } {
  const m = scaleStr.match(/^([A-G]#?)(\d+):(.+)$/)
  if (!m) return { root: 'C', octave: 4, mode: 'major' }
  return { root: m[1], octave: parseInt(m[2]), mode: m[3] }
}

function midiToStrudelName(midi: number): string {
  const name = NOTE_NAMES[midi % 12].toLowerCase().replace('#', 's')
  const oct = Math.floor(midi / 12) - 1
  return `${name}${oct}`
}

/**
 * Build diatonic triads for a given key.
 * Returns 7 chords (one for each scale degree) with Strudel note names.
 */
export function buildDiatonicChords(scaleStr: string, baseOctave: number = 3): ChordInfo[] {
  const { root, mode } = parseScale(scaleStr)
  const intervals = SCALE_INTERVALS[mode]
  if (!intervals || intervals.length < 7) {
    // For pentatonic/blues, use closest diatonic equivalent
    const fallbackMode = mode.includes('minor') || mode.includes('blues') ? 'minor' : 'major'
    return buildDiatonicChords(`${root}${baseOctave}:${fallbackMode}`, baseOctave)
  }

  const rootIdx = NOTE_NAMES.indexOf(root)
  if (rootIdx < 0) return []

  const isMinor = ['minor', 'harmonic minor', 'dorian', 'phrygian'].includes(mode)
  const numerals = isMinor ? MINOR_NUMERALS : MAJOR_NUMERALS

  const chords: ChordInfo[] = []

  for (let degree = 0; degree < 7; degree++) {
    // Build triad: root, 3rd, 5th (skip one scale degree each time)
    const noteIndices = [degree, (degree + 2) % 7, (degree + 4) % 7]
    const midiNotes: number[] = []

    for (const ni of noteIndices) {
      let midi = (baseOctave + 1) * 12 + rootIdx + intervals[ni]
      // If note wraps past the scale
      if (ni < degree) midi += 12
      midiNotes.push(midi)
    }

    // Detect chord quality
    const interval1 = (midiNotes[1] - midiNotes[0] + 12) % 12
    const interval2 = (midiNotes[2] - midiNotes[1] + 12) % 12
    let quality: ChordInfo['quality'] = 'major'
    if (interval1 === 3 && interval2 === 4) quality = 'minor'
    else if (interval1 === 3 && interval2 === 3) quality = 'diminished'
    else if (interval1 === 4 && interval2 === 4) quality = 'augmented'

    const noteName = NOTE_NAMES[(rootIdx + intervals[degree]) % 12]
    const qualStr = quality === 'major' ? '' : quality === 'minor' ? 'm' : quality === 'diminished' ? 'dim' : 'aug'

    chords.push({
      label: `${noteName}${qualStr}`,
      notes: `[${midiNotes.map(m => midiToStrudelName(m)).join(',')}]`,
      numeral: numerals[degree] || `${degree + 1}`,
      quality,
    })
  }

  return chords
}

/**
 * Build 7th chords (4 notes) for richer harmony.
 */
export function buildDiatonicSevenths(scaleStr: string, baseOctave: number = 3): ChordInfo[] {
  const { root, mode } = parseScale(scaleStr)
  const intervals = SCALE_INTERVALS[mode]
  if (!intervals || intervals.length < 7) {
    const fallbackMode = mode.includes('minor') || mode.includes('blues') ? 'minor' : 'major'
    return buildDiatonicSevenths(`${root}${baseOctave}:${fallbackMode}`, baseOctave)
  }

  const rootIdx = NOTE_NAMES.indexOf(root)
  if (rootIdx < 0) return []

  const chords: ChordInfo[] = []

  for (let degree = 0; degree < 7; degree++) {
    const noteIndices = [degree, (degree + 2) % 7, (degree + 4) % 7, (degree + 6) % 7]
    const midiNotes: number[] = []

    for (const ni of noteIndices) {
      let midi = (baseOctave + 1) * 12 + rootIdx + intervals[ni]
      if (ni < degree) midi += 12
      midiNotes.push(midi)
    }

    const noteName = NOTE_NAMES[(rootIdx + intervals[degree]) % 12]

    chords.push({
      label: `${noteName}7`,
      notes: `[${midiNotes.map(m => midiToStrudelName(m)).join(',')}]`,
      numeral: `${degree + 1}`,
      quality: 'major', // simplified
    })
  }

  return chords
}

/**
 * Generate common chord progressions in a given key.
 * All progressions are based on scale degrees → correct for any key.
 */
export interface KeyProgression {
  label: string
  value: string    // Strudel pattern: <[c3,e3,g3] [g2,b2,d3] ...>
  chordLabels: string
}

export function generateKeyProgressions(scaleStr: string, baseOctave: number = 3): KeyProgression[] {
  const triads = buildDiatonicChords(scaleStr, baseOctave)
  const sevenths = buildDiatonicSevenths(scaleStr, baseOctave)
  if (triads.length < 7) return []

  // Common progressions as [degree indices (0-based)]
  const progressions: { name: string; degrees: number[]; use7ths?: boolean }[] = [
    { name: 'I – V – vi – IV (Pop)', degrees: [0, 4, 5, 3] },
    { name: 'I – IV – V – I (Classical)', degrees: [0, 3, 4, 0] },
    { name: 'ii – V – I (Jazz)', degrees: [1, 4, 0], use7ths: true },
    { name: 'I – vi – IV – V (50s)', degrees: [0, 5, 3, 4] },
    { name: 'vi – IV – I – V (Sad Pop)', degrees: [5, 3, 0, 4] },
    { name: 'I – iii – vi – IV', degrees: [0, 2, 5, 3] },
    { name: 'I – V – vi – iii – IV (Canon)', degrees: [0, 4, 5, 2, 3] },
    { name: 'ii – V – I – vi (Jazz Cycle)', degrees: [1, 4, 0, 5], use7ths: true },
    { name: 'I – IV – vi – V', degrees: [0, 3, 5, 4] },
    { name: 'i – VI – III – VII (Minor Pop)', degrees: [0, 5, 2, 6] },
    { name: 'i – iv – v – i (Minor)', degrees: [0, 3, 4, 0] },
    { name: 'IV – V – iii – vi (Royal Road)', degrees: [3, 4, 2, 5] },
  ]

  return progressions.map(prog => {
    const chordSet = prog.use7ths ? sevenths : triads
    const chordNotes = prog.degrees.map(d => chordSet[d]?.notes || '~')
    const chordLabels = prog.degrees.map(d => chordSet[d]?.label || '?').join(' – ')
    const value = `<${chordNotes.join(' ')}>`

    return {
      label: prog.name,
      value,
      chordLabels,
    }
  })
}

/**
 * Hook for key-aware chord progressions.
 * Returns progressions that update when the scale changes.
 */
export function useKeyChords(scale: string) {
  const progressions = useMemo(() => generateKeyProgressions(scale), [scale])
  const triads = useMemo(() => buildDiatonicChords(scale), [scale])
  const sevenths = useMemo(() => buildDiatonicSevenths(scale), [scale])

  return { progressions, triads, sevenths }
}
