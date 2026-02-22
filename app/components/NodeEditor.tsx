'use client'

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import ReactDOM from 'react-dom'
import { Volume2, VolumeX, GripHorizontal, Plus, Trash2, Copy, ChevronDown } from 'lucide-react'

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
  delay: number
  delayfeedback: number
  crush: number
  shape: number
  speed: number       // .slow() factor
  vowel: string
  velocity: number
  decay: number
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
      code: block.code, // ALWAYS raw code from editor
      muted: existing?.muted ?? isMuted,
      solo: existing?.solo ?? false,
      x: existing?.x ?? (idx % cols) * 340 + 40,
      y: existing?.y ?? Math.floor(idx / cols) * 360 + 40,
      type, sound,
      gain: detectNum(rawCode, 'gain', 0.5),
      lpf: detectNum(rawCode, 'lpf', 20000),
      hpf: detectNum(rawCode, 'hpf', 0),
      pan: detectNum(rawCode, 'pan', 0.5),
      room: detectNum(rawCode, 'room', 0),
      delay: detectNum(rawCode, 'delay', 0),
      delayfeedback: detectNum(rawCode, 'delayfeedback', 0),
      crush: detectNum(rawCode, 'crush', 0),
      shape: detectNum(rawCode, 'shape', 0),
      speed: detectNum(rawCode, 'slow', 1),
      vowel: detectVowel(rawCode),
      velocity: detectNum(rawCode, 'velocity', 1),
      decay: detectNum(rawCode, 'decay', 0),
      scale: detectedScale || (isMelodic ? 'C4:major' : ''),
      pattern: detectPattern(rawCode),
      soundSource: detectSoundSource(rawCode),
    })
  })
  return nodes
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
  const methodRe = new RegExp(`\\.${method}\\s*\\(\\s*(?:slider\\s*\\(\\s*)?[0-9.]+`)
  const fullRe = new RegExp(`\\.${method}\\s*\\(\\s*[0-9.]+\\s*\\)`)

  // If value at "zero" state and user is removing, strip the effect
  if (remove) {
    // Remove entire .method(value)
    const stripRe = new RegExp(`\\s*\\.${method}\\s*\\([^)]*\\)`)
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

  const clamp = (v: number) => Math.max(min, Math.min(max, Math.round(v / step) * step))

  const handleDown = (e: React.MouseEvent) => {
    if (isDynamic) return
    e.stopPropagation(); e.preventDefault()
    const startY = e.clientY, startVal = value, range = max - min
    const onMove = (ev: MouseEvent) => {
      const sens = ev.shiftKey ? 600 : 150
      onChange(clamp(startVal + ((startY - ev.clientY) / sens) * range))
    }
    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      onCommit()
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  const handleWheel = (e: React.WheelEvent) => {
    if (isDynamic) return
    e.stopPropagation()
    onChange(clamp(value + (-e.deltaY / 800) * (max - min)))
    onCommit()
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
      <svg width={size} height={size} className={isDynamic ? 'cursor-not-allowed opacity-50' : 'cursor-ns-resize'}
        onMouseDown={handleDown} onWheel={handleWheel} onDoubleClick={handleDblClick}>
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

  const panStart = useRef({ x: 0, y: 0, px: 0, py: 0 })
  const containerRef = useRef<HTMLDivElement>(null)
  const lastCodeRef = useRef(code)
  const commitTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isInternalChange = useRef(false)
  const prevNodeCount = useRef(0)

  // ── FULL SYNC from parent code ──
  // This is the ONLY place where we re-parse nodes from code.
  // It runs whenever the code prop changes AND it wasn't us who changed it.
  useEffect(() => {
    if (isInternalChange.current) {
      isInternalChange.current = false
      return
    }
    // External code change (user typed in editor, loaded example, etc.)
    lastCodeRef.current = code
    const newBpm = extractBpm(code)
    setBpm(newBpm)

    setNodes(prev => {
      const parsed = parseCodeToNodes(code, prev.length > 0 ? prev : undefined)
      // If node count changed significantly (new project loaded), reset connections
      if (Math.abs(parsed.length - prevNodeCount.current) > 2 || prevNodeCount.current === 0) {
        const conns: Connection[] = []
        for (let i = 1; i < parsed.length; i++) conns.push({ fromId: parsed[i - 1].id, toId: parsed[i].id })
        setConnections(conns)
      }
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
    const conns: Connection[] = []
    for (let i = 1; i < parsed.length; i++) conns.push({ fromId: parsed[i - 1].id, toId: parsed[i].id })
    setConnections(conns)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Send code change to parent ──
  const sendToParent = useCallback((newCode: string) => {
    lastCodeRef.current = newCode
    isInternalChange.current = true
    onCodeChange(newCode)
    if (commitTimer.current) clearTimeout(commitTimer.current)
    commitTimer.current = setTimeout(() => onUpdate(), 80)
  }, [onCodeChange, onUpdate])

  // ── Apply a targeted effect change to a single node's code block ──
  const applyNodeEffect = useCallback((nodeId: string, method: string, value: number | string, remove?: boolean) => {
    setNodes(prev => {
      const idx = prev.findIndex(n => n.id === nodeId)
      if (idx === -1) return prev
      const old = prev[idx]
      const newCode = applyEffect(old.code, method, value, remove)
      if (newCode === old.code) return prev // No actual change

      const updated = [...prev]
      updated[idx] = { ...old, code: newCode }

      // Re-detect the changed property from the updated code
      const rawCode = newCode.replace(/\/\/ \[muted\] /g, '')
      if (typeof value === 'number') {
        const key = method === 'slow' ? 'speed' : method as keyof PatternNode
        if (key in old) (updated[idx] as unknown as Record<string, unknown>)[key] = detectNum(rawCode, method, 0)
      } else {
        if (method === 'scale') updated[idx].scale = detectScale(rawCode)
        if (method === 'vowel') updated[idx].vowel = detectVowel(rawCode)
        if (method === 'bank' || method === 'soundDotS') updated[idx].soundSource = detectSoundSource(rawCode)
      }

      // Rebuild full code from all nodes
      const fullCode = rebuildFullCodeFromNodes(updated, bpm, lastCodeRef.current)
      sendToParent(fullCode)
      return updated
    })
  }, [bpm, sendToParent])

  /** Lightweight full code rebuild that stitches node code blocks together */
  const rebuildFullCodeFromNodes = useCallback((nodeList: PatternNode[], currentBpm: number, origCode: string): string => {
    const lines = origCode.split('\n')
    const preamble: string[] = []
    for (const line of lines) {
      const t = line.trim()
      if (t.startsWith('$:') || t.startsWith('// [muted] $:')) break
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
    setNodes(prev => {
      const updated = prev.map(n => {
        if (n.type === 'drums' || n.type === 'fx' || n.type === 'other') return n
        const newCode = applyEffect(n.code, 'scale', newScale)
        return { ...n, code: newCode, scale: newScale }
      })
      const fullCode = rebuildFullCodeFromNodes(updated, bpm, lastCodeRef.current)
      sendToParent(fullCode)
      return updated
    })
  }, [bpm, sendToParent, rebuildFullCodeFromNodes])

  // ── Mute / Solo ──
  const toggleMute = useCallback((id: string) => {
    setNodes(prev => {
      const updated = prev.map(n => n.id === id ? { ...n, muted: !n.muted } : n)
      const fullCode = rebuildFullCodeFromNodes(updated, bpm, lastCodeRef.current)
      sendToParent(fullCode)
      return updated
    })
  }, [bpm, sendToParent, rebuildFullCodeFromNodes])

  const toggleSolo = useCallback((id: string) => {
    setNodes(prev => {
      const wasSolo = prev.find(n => n.id === id)?.solo
      const updated = wasSolo
        ? prev.map(n => ({ ...n, solo: false, muted: false }))
        : prev.map(n => n.id === id ? { ...n, solo: true, muted: false } : { ...n, solo: false, muted: true })
      const fullCode = rebuildFullCodeFromNodes(updated, bpm, lastCodeRef.current)
      sendToParent(fullCode)
      return updated
    })
  }, [bpm, sendToParent, rebuildFullCodeFromNodes])

  // ── Delete / Duplicate ──
  const deleteNode = useCallback((id: string) => {
    setNodes(prev => {
      const updated = prev.filter(n => n.id !== id)
      setConnections(c => c.filter(conn => conn.fromId !== id && conn.toId !== id))
      const fullCode = rebuildFullCodeFromNodes(updated, bpm, lastCodeRef.current)
      sendToParent(fullCode)
      prevNodeCount.current = updated.length
      return updated
    })
  }, [bpm, sendToParent, rebuildFullCodeFromNodes])

  const duplicateNode = useCallback((id: string) => {
    setNodes(prev => {
      const src = prev.find(n => n.id === id)
      if (!src) return prev
      const dup: PatternNode = {
        ...src, id: `node_dup_${Date.now()}`,
        name: `${src.name} copy`, x: src.x + 40, y: src.y + 40,
        muted: false, solo: false,
      }
      const updated = [...prev, dup]
      const fullCode = rebuildFullCodeFromNodes(updated, bpm, lastCodeRef.current)
      sendToParent(fullCode)
      prevNodeCount.current = updated.length
      return updated
    })
  }, [bpm, sendToParent, rebuildFullCodeFromNodes])

  // ── Sound / Pattern / Scale change (per node) ──
  const changeSoundSource = useCallback((id: string, newSource: string) => {
    const node = nodes.find(n => n.id === id)
    if (!node) return
    if (node.type === 'drums') {
      applyNodeEffect(id, 'bank', newSource)
    } else {
      applyNodeEffect(id, 'soundDotS', newSource)
    }
  }, [nodes, applyNodeEffect])

  const changePattern = useCallback((id: string, newPattern: string) => {
    const node = nodes.find(n => n.id === id)
    if (!node) return
    if (node.type === 'drums') {
      applyNodeEffect(id, 'drumPattern', newPattern)
    } else {
      applyNodeEffect(id, 'notePattern', newPattern)
    }
  }, [nodes, applyNodeEffect])

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
    sendToParent(newCode)
    // The useEffect will pick up the new code and re-parse
    setShowAddMenu(false)
  }, [sendToParent])

  // ── Knob change handler (updates local state, commits on release) ──
  const updateKnob = useCallback((nodeId: string, method: string, value: number) => {
    // Instant local update for smooth knob dragging
    setNodes(prev => prev.map(n => {
      if (n.id !== nodeId) return n
      const key = method === 'slow' ? 'speed' : method
      return { ...n, [key]: value }
    }))
  }, [])

  const commitKnob = useCallback((nodeId: string, method: string, value: number) => {
    // Determine if we should remove the effect (at default/neutral value)
    const isDefault = (method === 'lpf' && value >= 20000) ||
                      (method === 'hpf' && value <= 0) ||
                      (method === 'room' && value <= 0) ||
                      (method === 'delay' && value <= 0) ||
                      (method === 'delayfeedback' && value <= 0) ||
                      (method === 'crush' && value <= 0) ||
                      (method === 'shape' && value <= 0) ||
                      (method === 'pan' && Math.abs(value - 0.5) < 0.01)
    applyNodeEffect(nodeId, method, value, isDefault)
  }, [applyNodeEffect])

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

  // ── Drag & drop sound bank onto nodes ──
  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy' }, [])
  const handleDrop = useCallback((e: React.DragEvent, nodeId: string) => {
    e.preventDefault()
    const data = e.dataTransfer.getData('text/plain')
    if (!data) return
    changeSoundSource(nodeId, data)
  }, [changeSoundSource])

  // ── Canvas interactions ──
  const handleMouseDown = useCallback((e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation()
    const rect = containerRef.current?.getBoundingClientRect(); if (!rect) return
    const node = nodes.find(n => n.id === nodeId); if (!node) return
    setDragging({ id: nodeId, ox: (e.clientX - rect.left) / zoom - pan.x - node.x, oy: (e.clientY - rect.top) / zoom - pan.y - node.y })
    setSelectedNode(nodeId)
  }, [nodes, zoom, pan])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (linking) {
      const rect = containerRef.current?.getBoundingClientRect()
      if (rect) setLinking(prev => prev ? { ...prev, mx: e.clientX - rect.left, my: e.clientY - rect.top } : null)
      return
    }
    if (dragging) {
      const rect = containerRef.current?.getBoundingClientRect(); if (!rect) return
      setNodes(prev => prev.map(n => n.id === dragging.id ? {
        ...n,
        x: Math.round(((e.clientX - rect.left) / zoom - pan.x - dragging.ox) / 20) * 20,
        y: Math.round(((e.clientY - rect.top) / zoom - pan.y - dragging.oy) / 20) * 20,
      } : n))
    } else if (isPanning) {
      setPan({
        x: panStart.current.px + (e.clientX - panStart.current.x) / zoom,
        y: panStart.current.py + (e.clientY - panStart.current.y) / zoom,
      })
    }
  }, [dragging, isPanning, zoom, pan, linking])

  const handleMouseUp = useCallback(() => {
    setDragging(null); setIsPanning(false); if (linking) setLinking(null)
  }, [linking])

  const handleBgMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.target === containerRef.current || (e.target as HTMLElement).classList.contains('node-grid-bg')) {
      setIsPanning(true)
      panStart.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y }
      setSelectedNode(null)
    }
  }, [pan])

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    setZoom(z => Math.max(0.25, Math.min(2, z + e.deltaY * -0.001)))
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
    <div className="flex flex-col h-full select-none" style={{ background: HW.bg, overflow: 'visible' }}>

      {/* ══════ TOP BAR ══════ */}
      <div className="flex items-center justify-between px-4 py-2 shrink-0"
        style={{ background: `linear-gradient(180deg, ${HW.surfaceAlt} 0%, ${HW.surface} 100%)`, borderBottom: `1px solid ${HW.border}` }}>
        {/* Left */}
        <div className="flex items-center gap-3">
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
          </div>
        </div>
      </div>

      {/* ══════ CANVAS ══════ */}
      <div ref={containerRef}
        className="flex-1 relative cursor-grab active:cursor-grabbing"
        style={{ overflow: 'hidden' }}
        onMouseDown={handleBgMouseDown} onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp} onWheel={handleWheel}>

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
            const y1 = (from.y + 320 + pan.y) * zoom
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
            const fy = linking.side === 'out' ? (from.y + 320 + pan.y) * zoom : (from.y + pan.y) * zoom
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
              width: `${NODE_W * zoom}px`,
              transformOrigin: 'top left',
              zIndex: isSel ? 20 : dragging?.id === node.id ? 30 : 10,
            }}>
              <div className="relative"
                onDragOver={handleDragOver}
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
                  fontSize: `${Math.max(9, 11 * zoom)}px`,
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

                  {/* SCOPE */}
                  <div className="px-3 pt-2" style={{ background: `${HW.bg}80` }}>
                    <MiniScope color={color} active={isActive} type={node.type} />
                  </div>

                  {/* KNOBS ROW 1: Volume, LPF, HPF, Pan */}
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
                      <RotaryKnob label="LPF" value={node.lpf} min={50} max={20000} step={50} defaultValue={20000} suffix="Hz"
                        onChange={v => updateKnob(node.id, 'lpf', v)} onCommit={() => commitKnob(node.id, 'lpf', node.lpf)} color={color}
                        disabled={hasDynamic(node.code, 'lpf')} />
                      <RotaryKnob label="HPF" value={node.hpf} min={0} max={8000} step={50} defaultValue={0} suffix="Hz"
                        onChange={v => updateKnob(node.id, 'hpf', v)} onCommit={() => commitKnob(node.id, 'hpf', node.hpf)} color={color}
                        disabled={hasDynamic(node.code, 'hpf')} />
                      <RotaryKnob label="PAN" value={node.pan} min={0} max={1} step={0.01} defaultValue={0.5}
                        onChange={v => updateKnob(node.id, 'pan', v)} onCommit={() => commitKnob(node.id, 'pan', node.pan)} color={color}
                        disabled={hasDynamic(node.code, 'pan')} />
                    </div>
                  </div>

                  {/* KNOBS ROW 2: Reverb, Delay, DlyFB, Speed/Crush */}
                  <div className="px-2 pb-2">
                    <div className="flex items-center gap-1 mb-1 px-1">
                      <div className="h-px flex-1" style={{ background: HW.border }} />
                      <span className="text-[7px] font-bold tracking-[0.2em] uppercase" style={{ color: HW.textDim }}>FX</span>
                      <div className="h-px flex-1" style={{ background: HW.border }} />
                    </div>
                    <div className="flex items-start justify-center gap-0.5 flex-wrap">
                      <RotaryKnob label="VERB" value={node.room} min={0} max={1} step={0.01} defaultValue={0}
                        onChange={v => updateKnob(node.id, 'room', v)} onCommit={() => commitKnob(node.id, 'room', node.room)} color={color}
                        disabled={hasDynamic(node.code, 'room')} />
                      <RotaryKnob label="DLY" value={node.delay} min={0} max={0.8} step={0.01} defaultValue={0}
                        onChange={v => updateKnob(node.id, 'delay', v)} onCommit={() => commitKnob(node.id, 'delay', node.delay)} color={color}
                        disabled={hasDynamic(node.code, 'delay')} />
                      <RotaryKnob label="FDBK" value={node.delayfeedback} min={0} max={0.95} step={0.01} defaultValue={0}
                        onChange={v => updateKnob(node.id, 'delayfeedback', v)} onCommit={() => commitKnob(node.id, 'delayfeedback', node.delayfeedback)} color={color}
                        disabled={hasDynamic(node.code, 'delayfeedback')} />
                      {node.type !== 'drums' ? (
                        <RotaryKnob label="SPD" value={node.speed} min={0.25} max={8} step={0.25} defaultValue={1} suffix="x"
                          onChange={v => updateKnob(node.id, 'slow', v)} onCommit={() => commitKnob(node.id, 'slow', node.speed)} color={color}
                          disabled={hasDynamic(node.code, 'slow')} />
                      ) : (
                        <RotaryKnob label="CRSH" value={node.crush} min={0} max={16} step={1} defaultValue={0}
                          onChange={v => updateKnob(node.id, 'crush', v)} onCommit={() => commitKnob(node.id, 'crush', node.crush)} color={color}
                          disabled={hasDynamic(node.code, 'crush')} />
                      )}
                    </div>
                  </div>

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
                      <HardwareSelect label="PAT" value={node.pattern} options={DRUM_PATTERNS}
                        onChange={v => changePattern(node.id, v)} color={color} />
                    ) : node.type === 'chords' ? (
                      <HardwareSelect label="CHD" value={node.pattern} options={CHORD_PROGRESSIONS}
                        onChange={v => changePattern(node.id, v)} color={color} />
                    ) : node.type === 'bass' ? (
                      <HardwareSelect label="PAT" value={node.pattern} options={BASS_PATTERNS}
                        onChange={v => changePattern(node.id, v)} color={color} />
                    ) : isMelodic ? (
                      <HardwareSelect label="PAT" value={node.pattern} options={MELODY_PATTERNS}
                        onChange={v => changePattern(node.id, v)} color={color} />
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

      {/* ══════ STATUS BAR ══════ */}
      <div className="flex items-center justify-between px-4 py-1 shrink-0"
        style={{ background: HW.surface, borderTop: `1px solid ${HW.border}` }}>
        <span className="text-[8px] tracking-wide" style={{ color: HW.textDim }}>
          drag knobs · shift for fine · dblclick to reset · drag ports to connect · drop sounds onto nodes
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
