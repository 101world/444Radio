'use client'

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { Volume2, VolumeX, GripHorizontal, Plus, Trash2, Copy, ChevronDown } from 'lucide-react'

// ═══════════════════════════════════════════════════════════════
//  TYPES
// ═══════════════════════════════════════════════════════════════

interface PatternNode {
  id: string
  name: string
  code: string
  muted: boolean
  solo: boolean
  x: number
  y: number
  sound: string
  type: NodeType
  gain: number
  hasNote: boolean
  hasFilter: boolean
  hasDelay: boolean
  hasReverb: boolean
  hasScope: boolean
  scale: string
  pattern: string
  soundSource: string
  filterFreq: number
  delayMix: number
  reverbMix: number
  speed: number
  outputConnected: boolean
}

type NodeType = 'drums' | 'bass' | 'melody' | 'chords' | 'fx' | 'vocal' | 'pad' | 'other'

interface Connection {
  fromId: string
  toId: string
}

// ═══════════════════════════════════════════════════════════════
//  HARDWARE PALETTE  —  modern audio equipment aesthetic
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
  shadow:       '0 6px 24px rgba(0,0,0,0.7)',
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
//  PRESETS  —  sounds, patterns, scales
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

// Always C / Am family first
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
  { label: 'I – V – vi – IV', value: '<[c3,e3,g3] [g2,b2,d3] [a2,c3,e3] [f2,a2,c3]>' },
  { label: 'ii – V – I', value: '<[d3,f3,a3] [g2,b2,d3] [c3,e3,g3,b3]>' },
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

// ═══════════════════════════════════════════════════════════════
//  SVG UTILITIES  —  for rotary knobs
// ═══════════════════════════════════════════════════════════════

/** 0° = 12-o'clock, positive = clockwise */
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
//  CODE UTILITIES  —  effect injection
// ═══════════════════════════════════════════════════════════════

/** Insert an effect chain segment before .scope/.fscope or at end of block */
function insertBeforeViz(code: string, effect: string): string {
  const vizRe = /\.(scope|fscope|pianoroll|pitchwheel|punchcard)\s*\(/
  const m = code.match(vizRe)
  if (m?.index !== undefined) {
    return code.slice(0, m.index) + '\n  ' + effect + code.slice(m.index)
  }
  const lines = code.split('\n')
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].trim()) { lines[i] += effect; break }
  }
  return lines.join('\n')
}

// ═══════════════════════════════════════════════════════════════
//  PARSERS
// ═══════════════════════════════════════════════════════════════

function extractBpm(code: string): number {
  const m = code.match(/setcps\s*\(\s*([0-9.]+)\s*\/\s*60\s*\/\s*4\s*\)/)
  if (m) return parseFloat(m[1])
  const m2 = code.match(/setcps\s*\(\s*([0-9.]+)\s*\)/)
  if (m2) return Math.round(parseFloat(m2[1]) * 60 * 4)
  return 72
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
  if (/note\s*\(/.test(code)) return 'melody'
  return 'other'
}

function detectSound(code: string): string {
  const m = code.match(/\.?s(?:ound)?\s*\(\s*["']([^"']+)["']/)
  if (m) return m[1].split(/[\s*[\]]/)[0]
  const bm = code.match(/\.bank\s*\(\s*["']([^"']+)["']/)
  return bm ? bm[1] : ''
}

function detectGain(code: string): number {
  const m = code.match(/\.gain\s*\(\s*(?:slider\s*\(\s*)?([0-9.]+)/)
  return m ? parseFloat(m[1]) : 0.5
}

function detectScale(code: string): string {
  const m = code.match(/\.scale\s*\(\s*["']([^"']+)["']/)
  return m ? m[1] : ''
}

function detectFilter(code: string): number {
  const m = code.match(/\.lpf\s*\(\s*([0-9]+)/)
  return m ? parseInt(m[1]) : 20000
}

function detectDelay(code: string): number {
  const m = code.match(/\.delay\s*\(\s*(?:slider\s*\(\s*)?([0-9.]+)/)
  return m ? parseFloat(m[1]) : 0
}

function detectReverb(code: string): number {
  const m = code.match(/\.room\s*\(\s*(?:slider\s*\(\s*)?([0-9.]+)/)
  return m ? parseFloat(m[1]) : 0
}

function detectSpeed(code: string): number {
  const m = code.match(/\.slow\s*\(\s*([0-9.]+)/)
  return m ? parseFloat(m[1]) : 1
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

// ═══════════════════════════════════════════════════════════════
//  CODE ↔ NODE CONVERSION
// ═══════════════════════════════════════════════════════════════

function parseCodeToNodes(code: string, existingNodes?: PatternNode[]): PatternNode[] {
  const existingMap = new Map<string, PatternNode>()
  if (existingNodes) existingNodes.forEach(n => existingMap.set(n.code.trim(), n))

  const nodes: PatternNode[] = []
  const lines = code.split('\n')
  const blocks: { name: string; code: string; startLine: number }[] = []
  let currentBlock: string[] = []
  let currentName = ''
  let blockStartLine = 0

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim()
    if (trimmed.startsWith('$:')) {
      if (currentBlock.length > 0) blocks.push({ name: currentName, code: currentBlock.join('\n'), startLine: blockStartLine })
      const prev = i > 0 ? lines[i - 1].trim() : ''
      currentName = prev.startsWith('//') ? prev.replace(/^\/\/\s*/, '').replace(/[─—-]+/g, '').trim() : ''
      currentBlock = [lines[i]]
      blockStartLine = i
    } else if (currentBlock.length > 0) {
      if (trimmed.startsWith('//') && i + 1 < lines.length && lines[i + 1].trim().startsWith('$:')) {
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
    const existing = existingMap.get(block.code.trim())
    const type = detectType(block.code)
    const sound = detectSound(block.code)
    const detectedScale = detectScale(block.code)
    const isMelodic = type !== 'drums' && type !== 'fx' && type !== 'other'

    nodes.push({
      id: `node_${idx}_${block.startLine}`,
      name: block.name || sound || `Pattern ${idx + 1}`,
      code: block.code,
      muted: existing?.muted ?? false,
      solo: existing?.solo ?? false,
      x: existing?.x ?? (idx % cols) * 340 + 40,
      y: existing?.y ?? Math.floor(idx / cols) * 360 + 40,
      sound, type,
      gain: detectGain(block.code),
      hasNote: /\bnote\s*\(/.test(block.code),
      hasFilter: /\.(lpf|hpf|bpf)\s*\(/.test(block.code),
      hasDelay: /\.delay\s*\(/.test(block.code),
      hasReverb: /\.(room|reverb)\s*\(/.test(block.code),
      hasScope: /\.(scope|fscope|pianoroll|pitchwheel|punchcard)\s*\(/.test(block.code),
      // Default C Major for melodic nodes that have no explicit scale
      scale: detectedScale || (isMelodic ? 'C4:major' : ''),
      pattern: detectPattern(block.code),
      soundSource: detectSoundSource(block.code),
      filterFreq: detectFilter(block.code),
      delayMix: detectDelay(block.code),
      reverbMix: detectReverb(block.code),
      speed: detectSpeed(block.code),
      outputConnected: true,
    })
  })
  return nodes
}

function nodesToCode(nodes: PatternNode[], bpm: number, originalCode: string): string {
  const lines = originalCode.split('\n')
  const preamble: string[] = []
  for (const line of lines) {
    const t = line.trim()
    if (t.startsWith('$:') || (t && !t.startsWith('//') && !t.startsWith('setcps') && !t.startsWith('setbpm') && t !== '')) break
    if (!t.startsWith('setcps') && !t.startsWith('setbpm')) preamble.push(line)
  }

  const parts = [preamble.join('\n').trimEnd(), `setcps(${bpm}/60/4) // ${bpm} bpm`, '']

  for (const node of nodes) {
    const commentLine = node.name ? `// ── ${node.name} ──` : ''

    if (node.muted) {
      const mutedCode = node.code.split('\n').map(l => `// [muted] ${l}`).join('\n')
      parts.push(commentLine ? `${commentLine}\n${mutedCode}` : mutedCode)
    } else {
      let c = node.code

      // ── GAIN: replace existing or inject ──
      const gm = c.match(/(\.gain\s*\(\s*(?:slider\s*\(\s*)?)([0-9.]+)/)
      if (gm) c = c.replace(gm[0], gm[1] + node.gain.toFixed(3))
      else c = insertBeforeViz(c, `.gain(${node.gain.toFixed(3)})`)

      // ── SOUND SOURCE: replace existing ──
      if (node.soundSource) {
        if (node.type === 'drums') {
          const bk = c.match(/\.bank\s*\(\s*["'][^"']+["']\s*\)/)
          if (bk) c = c.replace(bk[0], `.bank("${node.soundSource}")`)
        } else {
          const ss = c.match(/\)\.s\s*\(\s*["'][^"']+["']\s*\)/)
          if (ss) c = c.replace(ss[0], `).s("${node.soundSource}")`)
          else {
            const ss2 = c.match(/\bs\s*\(\s*["'](sine|sawtooth|square|triangle|supersaw|gm_[^"']+)["']\s*\)/)
            if (ss2) c = c.replace(ss2[0], `s("${node.soundSource}")`)
          }
        }
      }

      // ── FILTER: replace or inject ──
      if (node.filterFreq < 20000) {
        const fm = c.match(/\.lpf\s*\(\s*(?:sine\.range\([^)]+\)[^)]*|[0-9]+)\s*\)/)
        if (fm) c = c.replace(fm[0], `.lpf(${node.filterFreq})`)
        else c = insertBeforeViz(c, `.lpf(${node.filterFreq})`)
      } else {
        // Remove lpf if set back to max
        const fm = c.match(/\s*\.lpf\s*\(\s*20000\s*\)/)
        if (fm) c = c.replace(fm[0], '')
      }

      // ── DELAY: replace or inject ──
      if (node.delayMix > 0) {
        const dm = c.match(/\.delay\s*\(\s*(?:slider\s*\(\s*)?([0-9.]+)/)
        if (dm) c = c.replace(dm[0], `.delay(${node.delayMix.toFixed(2)}`)
        else c = insertBeforeViz(c, `.delay(${node.delayMix.toFixed(2)})`)
      } else {
        const dm = c.match(/\s*\.delay\s*\(\s*0\.00\s*\)/)
        if (dm) c = c.replace(dm[0], '')
      }

      // ── REVERB: replace or inject ──
      if (node.reverbMix > 0) {
        const rm = c.match(/\.room\s*\(\s*(?:slider\s*\(\s*)?([0-9.]+)/)
        if (rm) c = c.replace(rm[0], `.room(${node.reverbMix.toFixed(2)}`)
        else c = insertBeforeViz(c, `.room(${node.reverbMix.toFixed(2)})`)
      } else {
        const rm = c.match(/\s*\.room\s*\(\s*0\.00\s*\)/)
        if (rm) c = c.replace(rm[0], '')
      }

      // ── SPEED: replace existing ──
      const sm = c.match(/\.slow\s*\(\s*([0-9.]+)\s*\)/)
      if (sm && node.speed !== parseFloat(sm[1])) c = c.replace(sm[0], `.slow(${node.speed})`)

      // ── SCALE: replace or inject (C Major default for melodic) ──
      const isMelodic = node.type !== 'drums' && node.type !== 'fx' && node.type !== 'other'
      if (node.scale && isMelodic) {
        const sc = c.match(/\.scale\s*\(\s*["'][^"']+["']\s*\)/)
        if (sc) c = c.replace(sc[0], `.scale("${node.scale}")`)
        else if (node.hasNote) c = c.replace(/(note|n)\s*\(\s*["'][^"']+["']\s*\)/, `$&.scale("${node.scale}")`)
      }

      parts.push(commentLine ? `${commentLine}\n${c}` : c)
    }
    parts.push('')
  }
  return parts.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n'
}

// ═══════════════════════════════════════════════════════════════
//  ROTARY KNOB  —  hardware-style SVG knob with drag + scroll
// ═══════════════════════════════════════════════════════════════

function RotaryKnob({ value, min, max, step, onChange, onCommit, color, label, suffix, size = 40, defaultValue }: {
  value: number; min: number; max: number; step: number
  onChange: (v: number) => void; onCommit: () => void
  color: string; label: string; suffix?: string; size?: number; defaultValue?: number
}) {
  const r = size / 2 - 5
  const cx = size / 2
  const cy = size / 2
  const norm = Math.max(0, Math.min(1, (value - min) / (max - min)))
  const angle = -135 + norm * 270
  const ptr = polarToCart(cx, cy, r * 0.55, angle)

  const clamp = (v: number) => {
    const rounded = Math.round(v / step) * step
    return Math.max(min, Math.min(max, rounded))
  }

  const handleDown = (e: React.MouseEvent) => {
    e.stopPropagation(); e.preventDefault()
    const startY = e.clientY
    const startVal = value
    const range = max - min
    const onMove = (ev: MouseEvent) => {
      const sens = ev.shiftKey ? 600 : 150
      const delta = (startY - ev.clientY) / sens
      onChange(clamp(startVal + delta * range))
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
    e.stopPropagation()
    const delta = -e.deltaY / 800 * (max - min)
    onChange(clamp(value + delta))
    onCommit()
  }

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (defaultValue !== undefined) { onChange(defaultValue); onCommit() }
  }

  const fmtVal = value >= 10000 ? `${(value / 1000).toFixed(0)}k`
    : value >= 1000 ? `${(value / 1000).toFixed(1)}k`
    : step >= 1 ? Math.round(value).toString()
    : value.toFixed(step >= 0.1 ? 1 : 2)

  return (
    <div className="flex flex-col items-center gap-0" style={{ width: size + 8 }}>
      <span className="text-[7px] font-bold uppercase tracking-[0.12em] mb-0.5" style={{ color: HW.textDim }}>{label}</span>
      <svg width={size} height={size} className="cursor-ns-resize"
        onMouseDown={handleDown} onWheel={handleWheel} onDoubleClick={handleDoubleClick}>
        {/* Outer ring */}
        <circle cx={cx} cy={cy} r={r + 2} fill="none" stroke={HW.knobRing} strokeWidth={1} opacity={0.4} />
        {/* Knob face */}
        <circle cx={cx} cy={cy} r={r} fill={HW.knobBg} stroke={HW.knobRing} strokeWidth={1.5} />
        {/* Track arc (full range, dim) */}
        <path d={arcPath(cx, cy, r - 1, -135, 135)} fill="none" stroke={HW.knobRing} strokeWidth={2.5} strokeLinecap="round" opacity={0.5} />
        {/* Value arc (colored) */}
        {norm > 0.005 && (
          <path d={arcPath(cx, cy, r - 1, -135, angle)} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" opacity={0.85} />
        )}
        {/* Glow under value arc */}
        {norm > 0.005 && (
          <path d={arcPath(cx, cy, r - 1, -135, angle)} fill="none" stroke={color} strokeWidth={4} strokeLinecap="round" opacity={0.15} />
        )}
        {/* Center dot */}
        <circle cx={cx} cy={cy} r={2} fill={HW.raisedLight} />
        {/* Pointer line */}
        <line x1={cx} y1={cy} x2={ptr.x} y2={ptr.y} stroke="#ddd" strokeWidth={1.5} strokeLinecap="round" />
      </svg>
      <span className="text-[8px] font-mono tabular-nums mt-0.5" style={{ color: `${color}bb` }}>
        {fmtVal}{suffix || ''}
      </span>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
//  HARDWARE SELECT  —  modern dropdown for sound / pattern / key
// ═══════════════════════════════════════════════════════════════

function HardwareSelect({ label, value, options, onChange, color }: {
  label: string
  value: string
  options: { label: string; value: string }[]
  onChange: (v: string) => void
  color: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const current = options.find(o => o.value === value)

  return (
    <div ref={ref} className="relative">
      <button
        onClick={e => { e.stopPropagation(); setOpen(p => !p) }}
        className="flex items-center w-full rounded transition-all cursor-pointer group"
        style={{
          background: HW.surfaceAlt,
          border: `1px solid ${open ? `${color}30` : HW.border}`,
          padding: '4px 8px',
        }}
      >
        <span className="text-[7px] font-bold uppercase tracking-[0.1em] shrink-0 w-7" style={{ color: HW.textDim }}>{label}</span>
        <span className="flex-1 text-left text-[10px] font-medium truncate" style={{ color: `${color}cc` }}>
          {current?.label || value || '—'}
        </span>
        <ChevronDown size={10} className="shrink-0 transition-transform" style={{
          color: HW.textDim,
          transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
        }} />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-[100] w-full min-w-[200px] max-h-[220px] overflow-y-auto rounded-lg shadow-2xl"
          style={{
            background: '#0e0e11',
            border: `1px solid ${color}20`,
            scrollbarWidth: 'thin',
            scrollbarColor: `${color}30 transparent`,
          }}>
          {options.map(opt => (
            <button key={opt.value}
              onClick={e => { e.stopPropagation(); onChange(opt.value); setOpen(false) }}
              className="w-full text-left px-3 py-[6px] text-[10px] transition-colors cursor-pointer flex items-center gap-2"
              style={{
                color: opt.value === value ? color : HW.text,
                background: opt.value === value ? `${color}12` : 'transparent',
              }}
              onMouseEnter={e => { (e.target as HTMLElement).style.background = `${color}0a` }}
              onMouseLeave={e => { (e.target as HTMLElement).style.background = opt.value === value ? `${color}12` : 'transparent' }}
            >
              {opt.value === value && <span style={{ color }} className="text-[8px]">●</span>}
              <span>{opt.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
//  MINI SCOPE  —  waveform canvas per node
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
        ctx.beginPath()
        ctx.strokeStyle = `${color}10`
        ctx.lineWidth = 1
        for (let x = 0; x < W; x++) {
          const y = H / 2 + Math.sin(x / W * Math.PI * 4 + phaseRef.current) * H * 0.1
          x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
        }
        ctx.stroke()
        return
      }
      phaseRef.current += 0.05
      ctx.beginPath()
      ctx.strokeStyle = `${color}60`
      ctx.lineWidth = 1.5
      ctx.shadowColor = color
      ctx.shadowBlur = 8
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
      ctx.stroke()
      ctx.shadowBlur = 0
      rafRef.current = requestAnimationFrame(draw)
    }
    rafRef.current = requestAnimationFrame(draw)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [color, active, type])

  return <canvas ref={canvasRef} width={260} height={24} className="w-full rounded" style={{ height: 24 }} />
}

// ═══════════════════════════════════════════════════════════════
//  PORT  —  connection port (in/out)
// ═══════════════════════════════════════════════════════════════

function Port({ side, color, connected, onMouseDown, onMouseUp, nodeId }: {
  side: 'in' | 'out'; color: string; connected: boolean
  onMouseDown: (e: React.MouseEvent, nodeId: string, side: 'in' | 'out') => void
  onMouseUp: (e: React.MouseEvent, nodeId: string, side: 'in' | 'out') => void
  nodeId: string
}) {
  return (
    <div
      className={`absolute ${
        side === 'out' ? 'bottom-0 right-4 translate-y-1/2' : 'top-0 left-4 -translate-y-1/2'
      } z-30 cursor-crosshair group`}
      onMouseDown={e => { e.stopPropagation(); onMouseDown(e, nodeId, side) }}
      onMouseUp={e => { e.stopPropagation(); onMouseUp(e, nodeId, side) }}
    >
      <div className="relative">
        {/* Outer glow ring */}
        <div className="w-4 h-4 rounded-full transition-all group-hover:scale-125"
          style={{
            border: `2px solid ${connected ? color : HW.knobRing}`,
            backgroundColor: connected ? `${color}40` : HW.knobBg,
            boxShadow: connected ? `0 0 10px ${color}30, inset 0 0 4px ${color}20` : 'none',
          }} />
        {/* Label */}
        <span className="absolute text-[6px] font-bold uppercase tracking-wider whitespace-nowrap"
          style={{
            color: HW.textDim,
            ...(side === 'in' ? { left: 22, top: 2 } : { right: 22, top: 2 }),
          }}>
          {side === 'in' ? 'IN' : 'OUT'}
        </span>
      </div>
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
  const [bpm, setBpm] = useState(() => extractBpm(code))
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

  // ── Sync from parent code ──
  useEffect(() => {
    if (code !== lastCodeRef.current) {
      lastCodeRef.current = code
      setNodes(prev => parseCodeToNodes(code, prev))
      setBpm(extractBpm(code))
    }
  }, [code])

  // ── Init ──
  useEffect(() => {
    const parsed = parseCodeToNodes(code)
    setNodes(parsed)
    const conns: Connection[] = []
    for (let i = 1; i < parsed.length; i++) conns.push({ fromId: parsed[i - 1].id, toId: parsed[i].id })
    setConnections(conns)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Commit to parent editor ──
  const commitCode = useCallback((updatedNodes?: PatternNode[], newBpm?: number) => {
    const n = updatedNodes || nodes
    const b = newBpm ?? bpm
    const newCode = nodesToCode(n, b, code)
    lastCodeRef.current = newCode
    onCodeChange(newCode)
    if (commitTimer.current) clearTimeout(commitTimer.current)
    commitTimer.current = setTimeout(() => onUpdate(), 80)
  }, [nodes, bpm, code, onCodeChange, onUpdate])

  // ── BPM ──
  const handleBpmChange = useCallback((v: number) => {
    setBpm(v)
    commitCode(undefined, v)
  }, [commitCode])

  // ── Mute / Solo ──
  const toggleMute = useCallback((id: string) => {
    setNodes(prev => {
      const updated = prev.map(n => n.id === id ? { ...n, muted: !n.muted } : n)
      commitCode(updated)
      return updated
    })
  }, [commitCode])

  const toggleSolo = useCallback((id: string) => {
    setNodes(prev => {
      const wasSolo = prev.find(n => n.id === id)?.solo
      const updated = wasSolo
        ? prev.map(n => ({ ...n, solo: false, muted: false }))
        : prev.map(n => n.id === id ? { ...n, solo: true, muted: false } : { ...n, solo: false, muted: true })
      commitCode(updated)
      return updated
    })
  }, [commitCode])

  // ── Generic prop update ──
  const updateProp = useCallback(<K extends keyof PatternNode>(id: string, key: K, value: PatternNode[K], commit = false) => {
    setNodes(prev => {
      const updated = prev.map(n => n.id === id ? { ...n, [key]: value } : n)
      if (commit) commitCode(updated)
      return updated
    })
  }, [commitCode])

  // ── Delete / Duplicate ──
  const deleteNode = useCallback((id: string) => {
    setNodes(prev => {
      const updated = prev.filter(n => n.id !== id)
      setConnections(c => c.filter(conn => conn.fromId !== id && conn.toId !== id))
      commitCode(updated)
      return updated
    })
  }, [commitCode])

  const duplicateNode = useCallback((id: string) => {
    setNodes(prev => {
      const src = prev.find(n => n.id === id)
      if (!src) return prev
      const dup: PatternNode = { ...src, id: `node_dup_${Date.now()}`, name: `${src.name} copy`, x: src.x + 40, y: src.y + 40, muted: false, solo: false }
      const updated = [...prev, dup]
      commitCode(updated)
      return updated
    })
  }, [commitCode])

  // ── Sound/Pattern/Scale change ──
  const changeSoundSource = useCallback((id: string, newSource: string) => {
    setNodes(prev => {
      const updated = prev.map(n => {
        if (n.id !== id) return n
        let c = n.code
        if (n.type === 'drums') {
          const bk = c.match(/\.bank\s*\(\s*["'][^"']+["']\s*\)/)
          if (bk) c = c.replace(bk[0], `.bank("${newSource}")`)
        } else {
          const ss = c.match(/\)\.s\s*\(\s*["'][^"']+["']\s*\)/)
          if (ss) c = c.replace(ss[0], `).s("${newSource}")`)
          else {
            const ss2 = c.match(/\bs\s*\(\s*["'](sine|sawtooth|square|triangle|supersaw|gm_[^"']+)["']\s*\)/)
            if (ss2) c = c.replace(ss2[0], `s("${newSource}")`)
          }
        }
        return { ...n, code: c, soundSource: newSource }
      })
      commitCode(updated)
      return updated
    })
  }, [commitCode])

  const changePattern = useCallback((id: string, newPattern: string) => {
    setNodes(prev => {
      const updated = prev.map(n => {
        if (n.id !== id) return n
        let c = n.code
        if (n.type === 'drums') {
          const m = c.match(/\bs\s*\(\s*["'][^"']+["']\s*\)/)
          if (m) c = c.replace(m[0], `s("${newPattern}")`)
        } else {
          const m = c.match(/\b(note|n)\s*\(\s*["'][^"']+["']\s*\)/)
          if (m) c = c.replace(m[0], `${m[1]}("${newPattern}")`)
        }
        return { ...n, code: c, pattern: newPattern }
      })
      commitCode(updated)
      return updated
    })
  }, [commitCode])

  const changeScale = useCallback((id: string, newScale: string) => {
    setNodes(prev => {
      const updated = prev.map(n => {
        if (n.id !== id) return n
        let c = n.code
        const sc = c.match(/\.scale\s*\(\s*["'][^"']+["']\s*\)/)
        if (sc) c = c.replace(sc[0], `.scale("${newScale}")`)
        else if (n.hasNote) c = c.replace(/(note|n)\s*\(\s*["'][^"']+["']\s*\)/, `$&.scale("${newScale}")`)
        return { ...n, code: c, scale: newScale }
      })
      commitCode(updated)
      return updated
    })
  }, [commitCode])

  // ── Quick Add ──
  const addNode = useCallback((template: string) => {
    const templates: Record<string, string> = {
      drums: `$: s("bd [~ bd] ~ ~, ~ cp ~ ~, hh*8")\n  .bank("RolandTR808").gain(0.7)\n  .scope({color:"${TYPE_COLORS.drums}",thickness:2,smear:.88})`,
      bass: `$: note("<c2 f2 g2 c2>")\n  .s("sawtooth").lpf(400).gain(0.35)\n  .scale("C4:major")\n  .scope({color:"${TYPE_COLORS.bass}",thickness:2.5,smear:.96})`,
      melody: `$: n("0 2 4 7 4 2").scale("C4:major")\n  .s("gm_piano").gain(0.3)\n  .room(0.4).delay(0.15)\n  .scope({color:"${TYPE_COLORS.melody}",thickness:1,smear:.91})`,
      chords: `$: note("<[c3,e3,g3] [a2,c3,e3] [f2,a2,c3] [g2,b2,d3]>")\n  .s("gm_epiano1").gain(0.25)\n  .lpf(1800).room(0.5).scale("C4:major")\n  .slow(2)\n  .scope({color:"${TYPE_COLORS.chords}",thickness:1,smear:.93})`,
      pad: `$: note("<[c3,g3,e4] [a2,e3,c4]>")\n  .s("sawtooth").lpf(800).gain(0.08)\n  .room(0.9).delay(0.3).delayfeedback(0.5).scale("C4:major")\n  .slow(4)\n  .fscope()`,
      fx: `$: s("hh*16").gain(0.06)\n  .delay(0.25).delayfeedback(0.5)\n  .room(0.6).lpf(2000).speed(2.5)\n  .scope({color:"${TYPE_COLORS.fx}",thickness:1,smear:.95})`,
    }
    const t = templates[template] || templates.drums
    const newCode = code.trim() + '\n\n// ── new ' + template + ' ──\n' + t
    lastCodeRef.current = newCode
    onCodeChange(newCode)
    setNodes(parseCodeToNodes(newCode))
    setTimeout(onUpdate, 100)
    setShowAddMenu(false)
  }, [code, onCodeChange, onUpdate])

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

  // ── Drag / Pan / Zoom ──
  const handleMouseDown = useCallback((e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation()
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    const node = nodes.find(n => n.id === nodeId)
    if (!node) return
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
      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) return
      const nx = Math.round(((e.clientX - rect.left) / zoom - pan.x - dragging.ox) / 20) * 20
      const ny = Math.round(((e.clientY - rect.top) / zoom - pan.y - dragging.oy) / 20) * 20
      setNodes(prev => prev.map(n => n.id === dragging.id ? { ...n, x: nx, y: ny } : n))
    } else if (isPanning) {
      setPan({
        x: panStart.current.px + (e.clientX - panStart.current.x) / zoom,
        y: panStart.current.py + (e.clientY - panStart.current.y) / zoom,
      })
    }
  }, [dragging, isPanning, zoom, pan, linking])

  const handleMouseUp = useCallback(() => {
    setDragging(null); setIsPanning(false)
    if (linking) setLinking(null)
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

  // ── Connected node set ──
  const connectedIds = useMemo(() => {
    const ids = new Set<string>()
    connections.forEach(c => { ids.add(c.fromId); ids.add(c.toId) })
    if (connections.length === 0) nodes.forEach(n => ids.add(n.id))
    return ids
  }, [connections, nodes])

  const NODE_W = 300

  // ════════════════════════════════════════════════════════════
  //  RENDER
  // ════════════════════════════════════════════════════════════

  return (
    <div className="flex flex-col h-full select-none overflow-hidden" style={{ background: HW.bg }}>

      {/* ══════ TOP BAR  ——  brushed-metal hardware strip ══════ */}
      <div className="flex items-center justify-between px-4 py-2 shrink-0"
        style={{
          background: `linear-gradient(180deg, ${HW.surfaceAlt} 0%, ${HW.surface} 100%)`,
          borderBottom: `1px solid ${HW.border}`,
        }}>
        {/* Left: Label + node count */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: isPlaying ? '#22d3ee' : HW.textDim, boxShadow: isPlaying ? '0 0 8px #22d3ee50' : 'none' }} />
            <span className="text-[10px] font-bold tracking-[0.2em] uppercase" style={{ color: HW.textBright }}>NODE RACK</span>
          </div>
          <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ color: HW.textDim, background: HW.raised }}>{nodes.length} CH</span>
        </div>

        {/* Center: BPM Master Knob */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-4 py-1 rounded-lg" style={{ background: HW.surface, border: `1px solid ${HW.border}` }}>
            <span className="text-[8px] font-bold tracking-[0.15em] uppercase" style={{ color: HW.textDim }}>TEMPO</span>
            <RotaryKnob
              value={bpm} min={30} max={200} step={1}
              onChange={handleBpmChange} onCommit={() => {}}
              color="#22d3ee" label="" size={48} defaultValue={72}
            />
            <div className="flex flex-col items-center">
              <span className="text-[18px] font-bold tabular-nums font-mono" style={{ color: '#22d3ee', textShadow: '0 0 12px #22d3ee30' }}>
                {bpm}
              </span>
              <span className="text-[7px] font-bold tracking-[0.2em] uppercase" style={{ color: HW.textDim }}>BPM</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <button onClick={() => handleBpmChange(Math.min(300, bpm + 1))}
                className="px-1.5 py-0 text-[10px] rounded transition-colors cursor-pointer"
                style={{ color: HW.text, background: HW.raised, border: `1px solid ${HW.border}` }}>▲</button>
              <button onClick={() => handleBpmChange(Math.max(30, bpm - 1))}
                className="px-1.5 py-0 text-[10px] rounded transition-colors cursor-pointer"
                style={{ color: HW.text, background: HW.raised, border: `1px solid ${HW.border}` }}>▼</button>
            </div>
          </div>

          {/* Master scale indicator */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
            style={{ background: HW.surface, border: `1px solid ${HW.border}` }}>
            <span className="text-[7px] font-bold tracking-[0.12em] uppercase" style={{ color: HW.textDim }}>KEY</span>
            <span className="text-[11px] font-bold" style={{ color: '#a78bfa' }}>C Major</span>
            <span className="text-[8px]" style={{ color: HW.textDim }}>/</span>
            <span className="text-[11px] font-bold" style={{ color: '#f472b6' }}>A Minor</span>
          </div>
        </div>

        {/* Right: Add + Zoom */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <button onClick={() => setShowAddMenu(p => !p)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold tracking-wider transition-all cursor-pointer"
              style={{
                background: 'rgba(34,211,238,0.08)',
                border: '1px solid rgba(34,211,238,0.15)',
                color: '#22d3ee',
              }}>
              <Plus size={11} /> ADD
            </button>
            {showAddMenu && (
              <div className="absolute right-0 top-full mt-1 z-50 min-w-[160px] rounded-lg shadow-2xl overflow-hidden"
                style={{ background: '#0e0e11', border: `1px solid ${HW.borderLight}` }}>
                {(['drums', 'bass', 'melody', 'chords', 'pad', 'fx'] as const).map(t => (
                  <button key={t} onClick={() => addNode(t)}
                    className="w-full flex items-center gap-2.5 px-4 py-2 text-[11px] transition-colors cursor-pointer"
                    style={{ color: TYPE_COLORS[t] }}
                    onMouseEnter={e => { (e.target as HTMLElement).style.background = `${TYPE_COLORS[t]}10` }}
                    onMouseLeave={e => { (e.target as HTMLElement).style.background = 'transparent' }}
                  >
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
              className="w-6 h-6 flex items-center justify-center text-[11px] rounded cursor-pointer transition-colors"
              style={{ color: HW.text, background: HW.raised, border: `1px solid ${HW.border}` }}>−</button>
            <span className="text-[8px] w-8 text-center font-mono tabular-nums" style={{ color: HW.textDim }}>{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom(z => Math.min(2, z + 0.15))}
              className="w-6 h-6 flex items-center justify-center text-[11px] rounded cursor-pointer transition-colors"
              style={{ color: HW.text, background: HW.raised, border: `1px solid ${HW.border}` }}>+</button>
            <button onClick={() => { setZoom(0.85); setPan({ x: 0, y: 0 }) }}
              className="px-2 h-6 flex items-center justify-center text-[8px] font-bold tracking-wider uppercase rounded cursor-pointer transition-colors"
              style={{ color: HW.textDim, background: HW.raised, border: `1px solid ${HW.border}` }}>FIT</button>
          </div>
        </div>
      </div>

      {/* ══════ CANVAS ══════ */}
      <div ref={containerRef}
        className="flex-1 relative overflow-hidden cursor-grab active:cursor-grabbing"
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
            const y1 = (from.y + 300 + pan.y) * zoom
            const x2 = (to.x + 16 + pan.x) * zoom
            const y2 = (to.y + pan.y) * zoom
            const mid = (y1 + y2) / 2
            const col = TYPE_COLORS[from.type]
            return (
              <g key={i}>
                {/* Shadow cable */}
                <path d={`M ${x1} ${y1} C ${x1} ${mid}, ${x2} ${mid}, ${x2} ${y2}`}
                  fill="none" stroke="black" strokeWidth={4} strokeOpacity={0.2} />
                {/* Main cable */}
                <path d={`M ${x1} ${y1} C ${x1} ${mid}, ${x2} ${mid}, ${x2} ${y2}`}
                  fill="none" stroke={col} strokeWidth={2} strokeOpacity={0.4} />
                {/* Click target */}
                <path d={`M ${x1} ${y1} C ${x1} ${mid}, ${x2} ${mid}, ${x2} ${y2}`}
                  fill="none" stroke="transparent" strokeWidth={14}
                  className="cursor-pointer pointer-events-auto"
                  onClick={() => removeConnection(conn.fromId, conn.toId)} />
                {/* Animated dot */}
                {isPlaying && !from.muted && !to.muted && (
                  <circle r={3 * zoom} fill={col} opacity={0.7}>
                    <animateMotion dur="1.5s" repeatCount="indefinite"
                      path={`M ${x1} ${y1} C ${x1} ${mid}, ${x2} ${mid}, ${x2} ${y2}`} />
                  </circle>
                )}
              </g>
            )
          })}
          {/* Active linking preview */}
          {linking && (() => {
            const from = nodes.find(n => n.id === linking.fromId)
            if (!from) return null
            const fx = linking.side === 'out' ? (from.x + NODE_W - 16 + pan.x) * zoom : (from.x + 16 + pan.x) * zoom
            const fy = linking.side === 'out' ? (from.y + 300 + pan.y) * zoom : (from.y + pan.y) * zoom
            return <line x1={fx} y1={fy} x2={linking.mx} y2={linking.my}
              stroke="#22d3ee" strokeWidth={2} strokeDasharray="6 3" opacity={0.6} />
          })()}
        </svg>

        {/* ══════ PATTERN NODES ══════ */}
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
              <div className="relative">
                {/* Ports */}
                <Port side="in" color={color} connected={connections.some(c => c.toId === node.id)}
                  onMouseDown={startLink} onMouseUp={endLink} nodeId={node.id} />
                <Port side="out" color={color} connected={connections.some(c => c.fromId === node.id)}
                  onMouseDown={startLink} onMouseUp={endLink} nodeId={node.id} />

                {/* Node body */}
                <div className={`rounded-xl overflow-hidden transition-all duration-200 ${
                  node.muted ? 'opacity-20 grayscale' : !isLive ? 'opacity-35' : ''
                }`} style={{
                  background: `linear-gradient(180deg, ${HW.surfaceAlt} 0%, ${HW.surface} 100%)`,
                  border: `1px solid ${isSel ? `${color}50` : isActive ? `${color}25` : HW.border}`,
                  boxShadow: isSel
                    ? `0 0 30px ${color}15, 0 8px 32px rgba(0,0,0,0.6), inset 0 1px 0 ${HW.borderLight}`
                    : `0 2px 12px rgba(0,0,0,0.4), inset 0 1px 0 ${HW.borderLight}`,
                  fontSize: `${Math.max(9, 11 * zoom)}px`,
                }}>

                  {/* ─── HEADER ─── */}
                  <div className="flex items-center gap-2 px-3 py-2 cursor-grab active:cursor-grabbing"
                    onMouseDown={e => handleMouseDown(e, node.id)}
                    style={{
                      background: `linear-gradient(180deg, ${color}08 0%, transparent 100%)`,
                      borderBottom: `1px solid ${HW.border}`,
                    }}>
                    <GripHorizontal size={10} style={{ color: HW.textDim }} className="shrink-0" />
                    {/* Type icon with LED */}
                    <div className="w-5 h-5 rounded-md flex items-center justify-center text-[10px]"
                      style={{ background: `${color}15`, color, boxShadow: isActive ? `0 0 8px ${color}30` : 'none' }}>
                      {TYPE_ICONS[node.type]}
                    </div>
                    <span className="text-[11px] font-bold truncate flex-1 tracking-wide" style={{ color }}>{node.name || 'Untitled'}</span>
                    {/* Solo */}
                    <button onClick={e => { e.stopPropagation(); toggleSolo(node.id) }}
                      className="w-5 h-5 flex items-center justify-center rounded text-[8px] font-black tracking-wider transition-all cursor-pointer"
                      style={{
                        background: node.solo ? 'rgba(245,158,11,0.2)' : HW.raised,
                        color: node.solo ? '#f59e0b' : HW.textDim,
                        border: `1px solid ${node.solo ? 'rgba(245,158,11,0.3)' : HW.border}`,
                        boxShadow: node.solo ? '0 0 6px rgba(245,158,11,0.2)' : 'none',
                      }}>S</button>
                    {/* Mute */}
                    <button onClick={e => { e.stopPropagation(); toggleMute(node.id) }}
                      className="w-5 h-5 flex items-center justify-center rounded transition-all cursor-pointer"
                      style={{
                        background: node.muted ? 'rgba(239,68,68,0.15)' : HW.raised,
                        border: `1px solid ${node.muted ? 'rgba(239,68,68,0.25)' : HW.border}`,
                      }}>
                      {node.muted
                        ? <VolumeX size={10} color="#ef4444" />
                        : <Volume2 size={10} style={{ color: `${color}80` }} />}
                    </button>
                  </div>

                  {/* ─── SCOPE ─── */}
                  <div className="px-3 pt-2" style={{ background: `${HW.bg}80` }}>
                    <MiniScope color={color} active={isActive} type={node.type} />
                  </div>

                  {/* ─── KNOBS ─── */}
                  <div className="px-2 py-2">
                    {/* Label strip */}
                    <div className="flex items-center gap-1 mb-1 px-1">
                      <div className="h-px flex-1" style={{ background: HW.border }} />
                      <span className="text-[7px] font-bold tracking-[0.2em] uppercase" style={{ color: HW.textDim }}>PARAMETERS</span>
                      <div className="h-px flex-1" style={{ background: HW.border }} />
                    </div>
                    <div className="flex items-start justify-center gap-1 flex-wrap">
                      <RotaryKnob label="VOL" value={node.gain} min={0} max={1} step={0.01} defaultValue={0.5}
                        onChange={v => updateProp(node.id, 'gain', v)} onCommit={() => commitCode()} color={color} />
                      <RotaryKnob label="LPF" value={node.filterFreq} min={50} max={20000} step={50} defaultValue={20000}
                        onChange={v => updateProp(node.id, 'filterFreq', v)} onCommit={() => commitCode()} color={color} suffix="Hz" />
                      <RotaryKnob label="REV" value={node.reverbMix} min={0} max={1} step={0.01} defaultValue={0}
                        onChange={v => updateProp(node.id, 'reverbMix', v)} onCommit={() => commitCode()} color={color} />
                      <RotaryKnob label="DLY" value={node.delayMix} min={0} max={0.8} step={0.01} defaultValue={0}
                        onChange={v => updateProp(node.id, 'delayMix', v)} onCommit={() => commitCode()} color={color} />
                      {node.type !== 'drums' && (
                        <RotaryKnob label="SPD" value={node.speed} min={0.25} max={8} step={0.25} defaultValue={1}
                          onChange={v => updateProp(node.id, 'speed', v)} onCommit={() => commitCode()} color={color} suffix="x" />
                      )}
                    </div>
                  </div>

                  {/* ─── SELECTORS ─── */}
                  <div className="px-3 pb-2 space-y-1">
                    {/* Divider */}
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
                    ) : (
                      <HardwareSelect label="PAT" value={node.pattern} options={MELODY_PATTERNS}
                        onChange={v => changePattern(node.id, v)} color={color} />
                    )}
                    {isMelodic && (
                      <HardwareSelect label="KEY" value={node.scale || 'C4:major'} options={SCALE_PRESETS}
                        onChange={v => changeScale(node.id, v)} color={color} />
                    )}
                  </div>

                  {/* ─── FOOTER ─── */}
                  <div className="flex items-center justify-between px-3 py-1.5"
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
                        className="w-5 h-5 flex items-center justify-center rounded transition-all cursor-pointer"
                        style={{ color: HW.textDim, background: HW.raised, border: `1px solid ${HW.border}` }}>
                        <Copy size={9} />
                      </button>
                      <button onClick={e => { e.stopPropagation(); deleteNode(node.id) }}
                        className="w-5 h-5 flex items-center justify-center rounded transition-all cursor-pointer"
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
              <p className="text-[10px] mt-1" style={{ color: HW.textDim }}>
                Click <span style={{ color: '#22d3ee' }}>+ ADD</span> to create a node
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ══════ STATUS BAR ══════ */}
      <div className="flex items-center justify-between px-4 py-1 shrink-0"
        style={{
          background: HW.surface,
          borderTop: `1px solid ${HW.border}`,
        }}>
        <span className="text-[8px] tracking-wide" style={{ color: HW.textDim }}>
          drag to move · drag ports to connect · click cable to remove · scroll to zoom · shift+drag knob for fine control
        </span>
        <div className="flex items-center gap-3 text-[8px] font-mono tabular-nums" style={{ color: HW.textDim }}>
          <span>{connections.length} links</span>
          <span>{nodes.filter(n => !n.muted).length}/{nodes.length} active</span>
          <span style={{ color: '#22d3ee80' }}>{bpm} bpm</span>
          <span style={{ color: '#a78bfa80' }}>C Maj / A min</span>
        </div>
      </div>
    </div>
  )
}
