'use client'

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  STUDIO DRUM SEQUENCER â€” Visual step sequencer for drum channels
//
//  Designed for the Studio workflow:
//  â€¢ Rows = drum instruments (BD, SD, HH, CP, etc.)
//  â€¢ 16 steps = 1 Strudel cycle (bar). Supports 1/2/4 bars.
//  â€¢ Single channels â†’ 1 row; stack() channels â†’ multi-row
//  â€¢ Click to toggle hits, velocity via brightness
//  â€¢ Pattern presets: "4-on-floor", "Breakbeat", "Boom Bap", etc.
//  â€¢ Only writes to code on user interaction (never on mount)
//  â€¢ Outputs clean mini-notation that maps 1:1 to Strudel timing
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

import { useState, useCallback, useMemo, useRef, useEffect } from 'react'

// â”€â”€â”€ Drum machine bank presets (most common first) â”€â”€â”€

const DRUM_BANK_OPTIONS: [string, string][] = [
  ['', 'â€” No Bank â€”'],
  ['RolandTR808', 'TR-808'],
  ['RolandTR909', 'TR-909'],
  ['RolandTR707', 'TR-707'],
  ['RolandTR606', 'TR-606'],
  ['RolandTR505', 'TR-505'],
  ['RolandTR626', 'TR-626'],
  ['RolandTR727', 'TR-727 Latin'],
  ['RolandCompurhythm78', 'CR-78'],
  ['LinnDrum', 'LinnDrum'],
  ['LinnLM1', 'LM-1'],
  ['AkaiLinn', 'Akai/Linn'],
  ['AkaiMPC60', 'MPC60'],
  ['MPC1000', 'MPC1000'],
  ['BossDR110', 'DR-110'],
  ['BossDR220', 'DR-220'],
  ['BossDR55', 'DR-55'],
  ['OberheimDMX', 'DMX'],
  ['EmuSP12', 'SP-12'],
  ['EmuDrumulator', 'Drumulator'],
  ['KorgDDM110', 'DDM-110'],
  ['KorgKPR77', 'KPR-77'],
  ['KorgMinipops', 'Minipops'],
  ['YamahaRX5', 'RX5'],
  ['YamahaRX21', 'RX21'],
  ['AlesisSR16', 'SR-16'],
  ['SimmonsSDS5', 'SDS-5'],
]

// â”€â”€â”€ Drum instrument definitions â”€â”€â”€

interface DrumInstrument {
  id: string         // Strudel sample name
  label: string      // Display label
  icon: string       // Emoji
  color: string      // Hex color for the row
  shortcut?: string  // Keyboard shortcut
}

const DRUM_KIT: DrumInstrument[] = [
  { id: 'bd',    label: 'KICK',    icon: 'ðŸ¥', color: '#ef4444', shortcut: 'K' },
  { id: 'sd',    label: 'SNARE',   icon: 'ðŸª˜', color: '#f59e0b', shortcut: 'S' },
  { id: 'cp',    label: 'CLAP',    icon: 'ðŸ‘', color: '#ec4899', shortcut: 'C' },
  { id: 'rim',   label: 'RIM',     icon: 'ðŸ””', color: '#a855f7', shortcut: 'R' },
  { id: 'hh',    label: 'HI-HAT',  icon: 'ðŸŽ©', color: '#22d3ee', shortcut: 'H' },
  { id: 'oh',    label: 'OPEN HH', icon: 'ðŸ’¿', color: '#06b6d4', shortcut: 'O' },
  { id: 'tom',   label: 'TOM',     icon: 'ðŸ¥', color: '#10b981', shortcut: 'T' },
  { id: 'ride',  label: 'RIDE',    icon: 'ðŸ””', color: '#6366f1', shortcut: 'I' },
  { id: 'crash', label: 'CRASH',   icon: 'ðŸ’¥', color: '#f43f5e' },
  { id: 'perc',  label: 'PERC',    icon: 'ðŸŽµ', color: '#84cc16' },
]

// â”€â”€â”€ Drum pattern presets â”€â”€â”€

interface DrumPreset {
  id: string
  name: string
  icon: string
  desc: string
  /** Map of drum ID â†’ 16-step pattern (1=hit, 0=rest). Multi-bar uses array of arrays. */
  pattern: Record<string, number[]>
}

const DRUM_PRESETS: DrumPreset[] = [
  {
    id: '4floor',
    name: 'Four on the Floor',
    icon: 'ðŸ ',
    desc: 'Classic house/techno kick',
    pattern: {
      bd: [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0],
      sd: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
      hh: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0],
    },
  },
  {
    id: 'boombap',
    name: 'Boom Bap',
    icon: 'ðŸŽ¤',
    desc: 'Classic hip-hop groove',
    pattern: {
      bd: [1,0,0,0, 0,0,1,0, 0,0,1,0, 0,0,0,0],
      sd: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,1],
      hh: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0],
    },
  },
  {
    id: 'breakbeat',
    name: 'Breakbeat',
    icon: 'ðŸ’¥',
    desc: 'Syncopated break pattern',
    pattern: {
      bd: [1,0,0,0, 0,0,1,0, 0,1,0,0, 0,0,0,0],
      sd: [0,0,0,0, 1,0,0,1, 0,0,0,0, 1,0,1,0],
      hh: [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1],
    },
  },
  {
    id: 'dnb',
    name: 'Drum & Bass',
    icon: 'âš¡',
    desc: 'Fast two-step pattern',
    pattern: {
      bd: [1,0,0,0, 0,0,1,0, 0,0,0,0, 1,0,0,0],
      sd: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,1],
      hh: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0],
    },
  },
  {
    id: 'halftime',
    name: 'Half-Time',
    icon: 'ðŸ¢',
    desc: 'Slow, heavy feel',
    pattern: {
      bd: [1,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
      sd: [0,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0],
      hh: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0],
    },
  },
  {
    id: 'reggaeton',
    name: 'Reggaeton',
    icon: 'ðŸŒ´',
    desc: 'Dembow riddim',
    pattern: {
      bd: [1,0,0,0, 0,0,0,1, 0,0,1,0, 0,0,0,0],
      sd: [0,0,0,1, 0,0,0,0, 0,0,0,1, 0,0,0,0],
      hh: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0],
      rim:[0,0,0,1, 0,0,0,0, 0,0,0,1, 0,0,0,0],
    },
  },
  {
    id: 'trap',
    name: 'Trap',
    icon: 'ðŸ”¥',
    desc: 'Rolling hi-hats trap',
    pattern: {
      bd: [1,0,0,0, 0,0,0,0, 1,0,1,0, 0,0,0,0],
      sd: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
      hh: [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1],
      oh: [0,0,0,0, 0,0,0,1, 0,0,0,0, 0,0,0,1],
    },
  },
  {
    id: 'empty',
    name: 'Clear All',
    icon: 'ðŸ—‘ï¸',
    desc: 'Empty grid',
    pattern: {},
  },
]

// â”€â”€â”€ Audio preview â”€â”€â”€

let previewCtx: AudioContext | null = null

function playDrumPreview(instrument: string) {
  if (!previewCtx) previewCtx = new AudioContext()
  if (previewCtx.state === 'suspended') previewCtx.resume()

  // Simple noise-based drum preview
  const now = previewCtx.currentTime

  if (instrument === 'bd' || instrument === 'kick') {
    // Kick: sine sweep down
    const osc = previewCtx.createOscillator()
    const gain = previewCtx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(150, now)
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.1)
    gain.gain.setValueAtTime(0.3, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15)
    osc.connect(gain).connect(previewCtx.destination)
    osc.start()
    osc.stop(now + 0.2)
  } else if (instrument === 'sd' || instrument === 'snare') {
    // Snare: noise burst + tone
    const bufferSize = previewCtx.sampleRate * 0.08
    const buffer = previewCtx.createBuffer(1, bufferSize, previewCtx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize)
    const noise = previewCtx.createBufferSource()
    noise.buffer = buffer
    const gain = previewCtx.createGain()
    gain.gain.setValueAtTime(0.15, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1)
    noise.connect(gain).connect(previewCtx.destination)
    noise.start()
  } else if (instrument === 'hh' || instrument === 'oh' || instrument === 'ride' || instrument === 'crash') {
    // Hihat/cymbal: filtered noise
    const bufferSize = previewCtx.sampleRate * (instrument === 'oh' || instrument === 'crash' ? 0.15 : 0.04)
    const buffer = previewCtx.createBuffer(1, bufferSize, previewCtx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize)
    const noise = previewCtx.createBufferSource()
    noise.buffer = buffer
    const hpf = previewCtx.createBiquadFilter()
    hpf.type = 'highpass'
    hpf.frequency.value = instrument === 'ride' || instrument === 'crash' ? 3000 : 6000
    const gain = previewCtx.createGain()
    gain.gain.setValueAtTime(0.1, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08)
    noise.connect(hpf).connect(gain).connect(previewCtx.destination)
    noise.start()
  } else {
    // Generic click
    const osc = previewCtx.createOscillator()
    const gain = previewCtx.createGain()
    osc.type = 'triangle'
    osc.frequency.value = 800
    gain.gain.setValueAtTime(0.1, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05)
    osc.connect(gain).connect(previewCtx.destination)
    osc.start()
    osc.stop(now + 0.06)
  }
}

// â”€â”€â”€ Pattern parsing â”€â”€â”€

/** Parse a drum channel's s() pattern into step hits */
function parseDrumPattern(pattern: string, stepsPerBar: number = 16): { hits: Set<number>; bars: number } {
  const hits = new Set<number>()
  if (!pattern || !pattern.trim()) return { hits, bars: 1 }

  const trimmed = pattern.trim()

  // Handle pure repetitions: "bd!4" â†’ "bd bd bd bd", "hh*8" â†’ 8 evenly spaced
  // We normalize the mini-notation into stepsPerBar steps

  // First strip the instrument name to get the rhythm part
  // Patterns like "bd!4", "bd*4", "hh*8", "bd [~ bd] ~ bd", etc.

  // Check for multi-bar: "<...>"
  const isMultiBar = trimmed.startsWith('<') && trimmed.endsWith('>')
  if (isMultiBar) {
    const inner = trimmed.slice(1, -1).trim()
    const entries = splitTopLevel(inner)
    entries.forEach((entry, barIdx) => {
      const offset = barIdx * stepsPerBar
      const clean = entry.startsWith('[') && entry.endsWith(']')
        ? entry.slice(1, -1).trim() : entry
      parseRhythmToSteps(clean, stepsPerBar).forEach(s => hits.add(offset + s))
    })
    return { hits, bars: entries.length }
  }

  // Single bar
  parseRhythmToSteps(trimmed, stepsPerBar).forEach(s => hits.add(s))
  return { hits, bars: 1 }
}

/** Simplify alternating expressions <a!N b> â†’ first value.
 *  "bd*<4!7 [4 8]>" â†’ "bd*4", "[.3 .5]*<2 4>" â†’ "[.3 .5]*2" */
function simplifyAlternations(pat: string): string {
  return pat.replace(/<([^>]+)>/g, (_match, inner: string) => {
    // Split on top-level spaces, take first entry
    const entries: string[] = []
    let depth = 0, cur = ''
    for (const ch of inner) {
      if (ch === '[') { depth++; cur += ch }
      else if (ch === ']') { depth--; cur += ch }
      else if (ch === ' ' && depth === 0) { if (cur.trim()) entries.push(cur.trim()); cur = '' }
      else cur += ch
    }
    if (cur.trim()) entries.push(cur.trim())
    // Take first entry, strip !N suffix (e.g. "4!7" â†’ "4")
    const first = (entries[0] || '').replace(/!\d+$/, '')
    return first
  })
}

/** Parse a mini-notation rhythm string into step positions (0-15) */
function parseRhythmToSteps(pattern: string, totalSteps: number): number[] {
  // Pre-process: simplify alternating patterns <a b c> to first value
  // This handles e.g. "bd*<4!7 [4 8]>" â†’ "bd*4"
  const simplified = simplifyAlternations(pattern)
  const steps: number[] = []

  // Handle *N multiplier: "hh*8", "bd:2*4" means N evenly spaced hits
  // [\w:]+ allows instrument names with variant syntax like bd:2
  const mulMatch = simplified.match(/^[\w:]+\*(\d+)$/)
  if (mulMatch) {
    const count = parseInt(mulMatch[1])
    const spacing = totalSteps / count
    for (let i = 0; i < count; i++) {
      steps.push(Math.round(i * spacing))
    }
    return steps
  }

  // Handle !N repeat: "bd!4", "bd:2!4" means same sample repeated N times
  const repMatch = simplified.match(/^[\w:]+!(\d+)$/)
  if (repMatch) {
    const count = parseInt(repMatch[1])
    const spacing = totalSteps / count
    for (let i = 0; i < count; i++) {
      steps.push(Math.round(i * spacing))
    }
    return steps
  }

  // Handle [group]*N: "[~ hh]*4", "[~ [sd,rim]]*2" â€” bracket group with multiplier
  // Use depth-aware matching to support nested brackets
  const bracketMul = extractBracketMultiplier(simplified)
  if (bracketMul) {
    const { inner, multiplier } = bracketMul
    // Parse the inner content into sub-tokens (flat rhythm)
    const innerTokens = flattenBracketContent(inner)
    const stepsPerRepeat = totalSteps / multiplier
    const subStepSize = stepsPerRepeat / innerTokens.length
    for (let rep = 0; rep < multiplier; rep++) {
      const repOffset = rep * stepsPerRepeat
      innerTokens.forEach((tok, j) => {
        if (tok !== '~' && tok !== '-' && tok !== 'silence') {
          steps.push(Math.round(repOffset + j * subStepSize))
        }
      })
    }
    return steps.filter(s => s < totalSteps)
  }

  // Parse space-separated tokens: "bd [~ bd] ~ bd"
  const tokens = tokenize(simplified)
  const stepPer = totalSteps / tokens.length
  tokens.forEach((tok, i) => {
    if (tok === '~' || tok === '-' || tok === 'silence') return
    const step = Math.round(i * stepPer)
    // Check for bracket group with optional *N suffix
    const subMul = extractBracketMultiplier(tok)
    if (subMul) {
      const innerTokens = flattenBracketContent(subMul.inner)
      const mul = subMul.multiplier
      const subStepTotal = stepPer / mul
      const subStep = subStepTotal / innerTokens.length
      for (let m = 0; m < mul; m++) {
        innerTokens.forEach((sub, j) => {
          if (sub !== '~' && sub !== '-') {
            steps.push(Math.round(step + m * subStepTotal + j * subStep))
          }
        })
      }
    } else if (tok.startsWith('[') && tok.endsWith(']')) {
      // Simple bracket group without multiplier: [~ bd]
      const innerTokens = flattenBracketContent(tok.slice(1, -1).trim())
      const subStep = stepPer / innerTokens.length
      innerTokens.forEach((sub, j) => {
        if (sub !== '~' && sub !== '-') {
          steps.push(Math.round(step + j * subStep))
        }
      })
    } else {
      steps.push(step)
    }
  })

  return steps.filter(s => s < totalSteps)
}

/** Extract bracket group and its *N multiplier: "[~ hh]*4" â†’ { inner: "~ hh", multiplier: 4 }
 *  Supports nested brackets: "[~ [sd,rim]]*2" â†’ { inner: "~ [sd,rim]", multiplier: 2 } */
function extractBracketMultiplier(pattern: string): { inner: string; multiplier: number } | null {
  const trimmed = pattern.trim()
  if (!trimmed.startsWith('[')) return null
  // Find the matching closing bracket (depth-aware)
  let depth = 0
  let closeIdx = -1
  for (let i = 0; i < trimmed.length; i++) {
    if (trimmed[i] === '[') depth++
    else if (trimmed[i] === ']') { depth--; if (depth === 0) { closeIdx = i; break } }
  }
  if (closeIdx === -1) return null
  // After the bracket, expect *N
  const after = trimmed.slice(closeIdx + 1)
  const mulMatch = after.match(/^\*(\d+)$/)
  if (!mulMatch) return null
  return {
    inner: trimmed.slice(1, closeIdx).trim(),
    multiplier: parseInt(mulMatch[1]),
  }
}

/** Flatten bracket content into flat rhythm tokens.
 *  "~ hh" â†’ ["~", "hh"]
 *  "~ [sd,rim]" â†’ ["~", "sd"] (comma = alternatives, take first)
 *  Nested brackets are flattened to first instrument */
function flattenBracketContent(content: string): string[] {
  const tokens: string[] = []
  let depth = 0, current = ''
  for (const ch of content) {
    if (ch === '[' || ch === '<') { depth++; current += ch }
    else if (ch === ']' || ch === '>') { depth--; current += ch }
    else if (ch === ' ' && depth === 0) {
      if (current.trim()) tokens.push(current.trim())
      current = ''
    } else current += ch
  }
  if (current.trim()) tokens.push(current.trim())

  // Process each token: extract instrument or mark as rest
  return tokens.map(t => {
    if (t === '~' || t === '-' || t === 'silence') return '~'
    // If it's a bracket group like [sd,rim], extract first instrument
    if (t.startsWith('[')) {
      const inner = t.replace(/[\[\]<>]/g, '')
      const first = inner.split(/[,\s]+/)[0]
      return first || '~'
    }
    return t
  })
}

/** Tokenize mini-notation respecting brackets */
function tokenize(str: string): string[] {
  const tokens: string[] = []
  let depth = 0, current = ''
  for (const ch of str) {
    if (ch === '[') { depth++; current += ch }
    else if (ch === ']') { depth--; current += ch }
    else if (ch === ' ' && depth === 0) {
      if (current.trim()) tokens.push(current.trim())
      current = ''
    } else current += ch
  }
  if (current.trim()) tokens.push(current.trim())
  return tokens
}

/** Same as piano roll â€” split top-level entries in <...> */
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

/** Convert a Set<step> into Strudel mini-notation for a drum instrument */
function hitsToPattern(hits: Set<number>, bars: number, instrument: string, stepsPerBar: number = 16): string {
  const totalSteps = bars * stepsPerBar

  const barPatterns: string[] = []
  for (let bar = 0; bar < bars; bar++) {
    const tokens: string[] = []
    for (let s = 0; s < stepsPerBar; s++) {
      const step = bar * stepsPerBar + s
      tokens.push(hits.has(step) ? instrument : '~')
    }

    // Compress: detect simple repeats
    const compressed = compressPattern(tokens, instrument)
    barPatterns.push(compressed)
  }

  if (bars === 1) return barPatterns[0]
  return `<${barPatterns.map(b => `[${b}]`).join(' ')}>`
}

/** Try to compress "bd ~ ~ ~ bd ~ ~ ~ bd ~ ~ ~ bd ~ ~ ~" â†’ "bd*4" */
function compressPattern(tokens: string[], instrument: string): string {
  const len = tokens.length // 16

  // Check if all hits are evenly spaced
  const hitPositions = tokens.reduce<number[]>((arr, t, i) => {
    if (t !== '~') arr.push(i)
    return arr
  }, [])

  if (hitPositions.length === 0) return '~'

  // Check even spacing
  if (hitPositions.length >= 2) {
    const spacing = hitPositions[1] - hitPositions[0]
    const isEven = hitPositions.every((pos, i) => pos === hitPositions[0] + i * spacing)
    if (isEven && hitPositions[0] === 0 && hitPositions.length * spacing === len) {
      if (hitPositions.length === len) {
        // Every step: "bd*16"
        return `${instrument}*${len}`
      }
      return `${instrument}*${hitPositions.length}`
    }
  }

  // Check for !N pattern (all same, evenly spaced, including first)
  if (hitPositions.length >= 2 && hitPositions[0] === 0) {
    const spacing = len / hitPositions.length
    const isRepeat = hitPositions.every((pos, i) => pos === Math.round(i * spacing))
    if (isRepeat && Number.isInteger(spacing)) {
      return `${instrument}!${hitPositions.length}`
    }
  }

  // Fall back to full token list
  return tokens.join(' ')
}

// â”€â”€â”€ Parse stack channel into sub-patterns â”€â”€â”€

interface DrumRow {
  instrument: string       // Base instrument name for grid keys (e.g., "bd")
  fullInstrument: string   // Full instrument with variant for code gen (e.g., "bd:3")
  pattern: string          // Original mini-notation pattern
  bank?: string            // e.g. "RolandTR808"
  isGenerative: boolean    // Has perlin, irand, etc.
}

/** Extract the drum instrument name from a pattern string.
 *  e.g. "hh*8" â†’ "hh", "~ sd ~ sd" â†’ "sd", "bd!4" â†’ "bd", "[~ hh]*4" â†’ "hh" */
function extractInstrumentName(fullPattern: string): string {
  // Find the first alphabetic word that isn't a rest token
  const words = fullPattern.match(/\b([a-zA-Z_][a-zA-Z0-9_]*)\b/g)
  if (!words) return 'perc'
  for (const w of words) {
    if (w === 'silence') continue
    return w
  }
  return 'perc'
}

/** Extract the full instrument name with variant from a pattern string.
 *  e.g. "bd:3*4" â†’ "bd:3", "hh:2!8" â†’ "hh:2", "bd*4" â†’ "bd", "[~ sd:1]*4" â†’ "sd:1" */
function extractFullInstrumentName(fullPattern: string): string {
  // Match word optionally followed by :N variant
  const matches = fullPattern.match(/\b([a-zA-Z_][a-zA-Z0-9_]*(?::\d+)?)\b/g)
  if (!matches) return 'perc'
  for (const m of matches) {
    const base = m.replace(/:\d+$/, '')
    if (base === 'silence') continue
    return m
  }
  return 'perc'
}

/** Extract individual drum lines from a stack channel or single channel */
function parseChannelDrumRows(rawCode: string): DrumRow[] {
  const rows: DrumRow[] = []

  // Check if it's a stack
  const isStack = /stack\s*\(/.test(rawCode)

  if (isStack) {
    // Find the stack(...) contents and split by comma-delimited s() calls
    const stackMatch = rawCode.match(/stack\s*\(/)
    if (!stackMatch) return rows
    const openIdx = rawCode.indexOf('(', stackMatch.index!)
    const closeIdx = findStackClosingParen(rawCode, openIdx)
    if (closeIdx === -1) return rows

    const stackBody = rawCode.substring(openIdx + 1, closeIdx)
    // Split by top-level commas (respecting parentheses)
    const parts = splitByTopLevelComma(stackBody)

    for (const part of parts) {
      const sMatch = part.match(/s\(\s*"([^"]+)"/)
      if (sMatch) {
        const fullPattern = sMatch[1]
        const instrument = extractInstrumentName(fullPattern)
        const fullInstrument = extractFullInstrumentName(fullPattern)
        const bankMatch = part.match(/\.bank\(\s*"([^"]*)"/)
        const isGen = /perlin|irand|rand|sine|saw/.test(part.replace(/\.bank\([^)]*\)/g, ''))
        rows.push({
          instrument,
          fullInstrument,
          pattern: fullPattern,
          bank: bankMatch?.[1],
          isGenerative: isGen,
        })
      }
    }
  } else {
    // Single s() channel
    const sMatch = rawCode.match(/s\(\s*"([^"]+)"/)
    if (sMatch) {
      const fullPattern = sMatch[1]
      const instrument = extractInstrumentName(fullPattern)
      const fullInstrument = extractFullInstrumentName(fullPattern)
      const bankMatch = rawCode.match(/\.bank\(\s*"([^"]*)"/)
      const isGen = /perlin|irand|rand|sine|saw/.test(rawCode.replace(/\.bank\([^)]*\)/g, '').replace(/s\("[^"]*"\)/g, ''))
      rows.push({
        instrument,
        fullInstrument,
        pattern: fullPattern,
        bank: bankMatch?.[1],
        isGenerative: isGen,
      })
    }
  }

  return rows
}

function findStackClosingParen(str: string, openIdx: number): number {
  let depth = 1
  for (let i = openIdx + 1; i < str.length; i++) {
    if (str[i] === '(') depth++
    else if (str[i] === ')') { depth--; if (depth === 0) return i }
  }
  return -1
}

function splitByTopLevelComma(str: string): string[] {
  const parts: string[] = []
  let depth = 0, current = ''
  for (const ch of str) {
    if (ch === '(' || ch === '[' || ch === '<') { depth++; current += ch }
    else if (ch === ')' || ch === ']' || ch === '>') { depth--; current += ch }
    else if (ch === ',' && depth === 0) {
      if (current.trim()) parts.push(current.trim())
      current = ''
    } else current += ch
  }
  if (current.trim()) parts.push(current.trim())
  return parts
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  COMPONENT
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

interface StudioDrumSequencerProps {
  /** Raw code of the channel block */
  channelRawCode: string
  /** Channel color for theming */
  color: string
  /** Channel name */
  channelName: string
  /** Bank name if any (e.g. "RolandTR909") */
  bank?: string
  /** Called when user edits â€” receives new code block (modified rawCode) */
  onPatternChange: (newRawCode: string) => void
  /** Close the sequencer */
  onClose: () => void
  /** Preview a drum sound via superdough (real sample playback) */
  onPreviewDrum?: (instrument: string, bank?: string) => void
  /** Whether transport is currently playing */
  isPlaying?: boolean
  /** Project BPM for fallback playhead timing */
  projectBpm?: number
  /** Get current cycle position from Strudel scheduler */
  getCyclePosition?: () => number | null
  /** Whether we're currently recording drum input */
  isRecording?: boolean
  /** Called when a pad is hit during recording — captures sound + timing */
  onRecordHit?: (sound: string, bank?: string) => void
}

const CELL_W_BASE = 32
const CELL_H_BASE = 32
const LABEL_W = 140
const BAR_OPTIONS = [1, 2, 4, 8, 16, 32] as const
const GRID_OPTIONS = [16, 32] as const

export default function StudioDrumSequencer({
  channelRawCode,
  color,
  channelName,
  bank,
  onPatternChange,
  onClose,
  onPreviewDrum,
  isPlaying: transportPlaying = false,
  projectBpm = 120,
  getCyclePosition,
  isRecording = false,
  onRecordHit,
}: StudioDrumSequencerProps) {
  const [bars, setBars] = useState(1)
  // Grid state: Map<instrumentId, Set<step>>
  const [grid, setGrid] = useState<Map<string, Set<number>>>(new Map())
  const [activeRows, setActiveRows] = useState<string[]>([])
  const [hasUserEdited, setHasUserEdited] = useState(false)
  const [showPresets, setShowPresets] = useState(false)
  const [rowGains, setRowGains] = useState<Map<string, number>>(new Map())
  const [rowBanks, setRowBanks] = useState<Map<string, string>>(new Map()) // per-row bank override
  const [soundPickerRow, setSoundPickerRow] = useState<string | null>(null) // which row has picker open
  const [padFlash, setPadFlash] = useState<string | null>(null) // pad animation
  const scrollRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(1)
  const [stepsPerBar, setStepsPerBar] = useState<16 | 32>(16)
  const cellW = Math.round(CELL_W_BASE * zoom)
  const cellH = Math.round(CELL_H_BASE * zoom)
  const isDrawing = useRef(false)
  const drawMode = useRef<'add' | 'remove'>('add')
  const lastCell = useRef<string | null>(null)
  const gridRef = useRef(grid)
  gridRef.current = grid
  const activeRowsRef = useRef(activeRows)
  activeRowsRef.current = activeRows
  const isStackRef = useRef(false)
  const drumRowsRef = useRef<DrumRow[]>([])
  const rowGainsRef = useRef<Map<string, number>>(new Map())
  rowGainsRef.current = rowGains
  const rowBanksRef = useRef<Map<string, string>>(new Map())
  rowBanksRef.current = rowBanks
  const fullInstrumentMapRef = useRef<Map<string, string>>(new Map())

  // -- Slow/Fast factor: how many cycles this channel pattern spans --
  const slowFactor = useMemo(() => {
    const slowMatch = channelRawCode.match(/\.slow\(\s*([\d.]+)\s*\)/)
    const fastMatch = channelRawCode.match(/\.fast\(\s*([\d.]+)\s*\)/)
    let factor = 1
    if (slowMatch) factor *= parseFloat(slowMatch[1]) || 1
    if (fastMatch) factor /= parseFloat(fastMatch[1]) || 1
    return factor
  }, [channelRawCode])

  // -- Transport Playhead --
  const [playheadStep, setPlayheadStep] = useState(-1)
  const playheadRAF = useRef<number | null>(null)
  const playheadStartTime = useRef(0)

  useEffect(() => {
    if (!transportPlaying) {
      setPlayheadStep(-1)
      if (playheadRAF.current) { cancelAnimationFrame(playheadRAF.current); playheadRAF.current = null }
      return
    }
    playheadStartTime.current = performance.now()
    const animate = () => {
      let cyclePos: number | null = null
      if (getCyclePosition) {
        try { cyclePos = getCyclePosition() } catch { /* ignore */ }
      }
      const totalCycleSpan = bars * slowFactor
      const totalGridSteps = bars * stepsPerBar
      if (cyclePos !== null && cyclePos >= 0) {
        const posInPattern = ((cyclePos % totalCycleSpan) + totalCycleSpan) % totalCycleSpan
        const fractionalStep = (posInPattern / totalCycleSpan) * totalGridSteps
        setPlayheadStep(prev => Math.abs(prev - fractionalStep) > 0.15 ? fractionalStep : prev)
      } else {
        const barDurationMs = (4 * 60000 * slowFactor) / projectBpm
        const elapsed = performance.now() - playheadStartTime.current
        const totalPatternMs = bars * barDurationMs
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
  // â”€â”€ Parse channel on mount / prop change â”€â”€
  useEffect(() => {
    const drumRows = parseChannelDrumRows(channelRawCode)
    drumRowsRef.current = drumRows
    isStackRef.current = /stack\s*\(/.test(channelRawCode)

    const newGrid = new Map<string, Set<number>>()
    const rowIds: string[] = []

    for (const row of drumRows) {
      const { hits, bars: parsedBars } = parseDrumPattern(row.pattern, stepsPerBar)
      newGrid.set(row.instrument, hits)
      rowIds.push(row.instrument)
      if (parsedBars > 1) setBars(parsedBars)
    }

    // Build fullInstrument map (preserves sample variants like "bd:3")
    const newFullMap = new Map<string, string>()
    for (const row of drumRows) {
      newFullMap.set(row.instrument, row.fullInstrument)
    }
    fullInstrumentMapRef.current = newFullMap

    // Preserve existing empty rows that the user added (prevents rows from disappearing
    // when the round-trip re-parse filters out rows with no hits from the code)
    const currentActive = activeRowsRef.current
    for (const existingRow of currentActive) {
      if (!rowIds.includes(existingRow)) {
        rowIds.push(existingRow)
        if (!newGrid.has(existingRow)) newGrid.set(existingRow, new Set())
      }
    }

    // If only one instrument and no pre-existing rows to preserve, show complementary drums
    if (rowIds.length === 1 && currentActive.length === 0) {
      const existing = rowIds[0]
      const defaults = ['bd', 'sd', 'hh', 'cp']
      for (const d of defaults) {
        if (!rowIds.includes(d) && d !== existing) {
          rowIds.push(d)
          newGrid.set(d, new Set())
        }
      }
    }

    // Initialize per-row banks from parsed drum rows
    const newBanks = new Map<string, string>()
    for (const row of drumRows) {
      if (row.bank) newBanks.set(row.instrument, row.bank)
    }
    // If no per-row banks but channel has a bank prop, apply it to all rows
    if (newBanks.size === 0 && bank) {
      for (const id of rowIds) newBanks.set(id, bank)
    }
    setRowBanks(newBanks)

    setGrid(newGrid)
    setActiveRows(rowIds)
    setHasUserEdited(false)
  }, [channelRawCode, stepsPerBar, bank])

  // â”€â”€ Emit pattern change (debounced) â”€â”€
  const emitTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!hasUserEdited) return
    if (emitTimer.current) clearTimeout(emitTimer.current)
    emitTimer.current = setTimeout(() => {
      const newCode = buildCodeFromGrid(
        gridRef.current,
        activeRowsRef.current,
        bars,
        channelRawCode,
        drumRowsRef.current,
        isStackRef.current,
        stepsPerBar,
        rowGainsRef.current,
        rowBanksRef.current,
        fullInstrumentMapRef.current,
      )
      onPatternChange(newCode)
    }, 150)
    return () => { if (emitTimer.current) clearTimeout(emitTimer.current) }
  }, [grid, rowGains, rowBanks, hasUserEdited, bars, channelRawCode, onPatternChange, stepsPerBar])

  // â”€â”€ Preview a drum sound (real sample or fallback) â”€â”€
  const previewDrum = useCallback((instrumentId: string) => {
    const rowBank = rowBanks.get(instrumentId)
    // Use full instrument name for accurate preview (e.g., "bd:3" instead of "bd")
    const fullId = fullInstrumentMapRef.current.get(instrumentId) || instrumentId
    if (onPreviewDrum) {
      onPreviewDrum(fullId, rowBank || bank)
    } else {
      playDrumPreview(fullId)
    }
    // If recording, emit the hit for capture
    if (isRecording && onRecordHit) {
      onRecordHit(fullId, rowBank || bank)
    }
    // Flash the pad
    setPadFlash(instrumentId)
    setTimeout(() => setPadFlash(null), 150)
  }, [onPreviewDrum, rowBanks, bank, isRecording, onRecordHit])

  // â”€â”€ Toggle hit â”€â”€
  const toggleHit = useCallback((instrument: string, step: number, forceMode?: 'add' | 'remove') => {
    setSoundPickerRow(null) // close any open picker
    setGrid(prev => {
      const next = new Map(prev)
      const hits = new Set(prev.get(instrument) || new Set<number>())
      const mode = forceMode || (hits.has(step) ? 'remove' : 'add')
      if (mode === 'remove') {
        hits.delete(step)
      } else {
        hits.add(step)
        previewDrum(instrument)
      }
      next.set(instrument, hits)
      return next
    })
    setHasUserEdited(true)
  }, [previewDrum])

  // â”€â”€ Mouse handlers â”€â”€
  const handleCellDown = useCallback((instrument: string, step: number, e: React.MouseEvent) => {
    e.preventDefault()
    const key = `${instrument}:${step}`
    isDrawing.current = true
    const hits = grid.get(instrument) || new Set<number>()
    drawMode.current = hits.has(step) ? 'remove' : 'add'
    lastCell.current = key
    toggleHit(instrument, step, drawMode.current)
  }, [grid, toggleHit])

  const handleCellEnter = useCallback((instrument: string, step: number) => {
    if (!isDrawing.current) return
    const key = `${instrument}:${step}`
    if (key === lastCell.current) return
    lastCell.current = key
    toggleHit(instrument, step, drawMode.current)
  }, [toggleHit])

  useEffect(() => {
    const up = () => { isDrawing.current = false; lastCell.current = null }
    window.addEventListener('mouseup', up)
    return () => window.removeEventListener('mouseup', up)
  }, [])

  // â”€â”€ Keyboard â”€â”€
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  // â”€â”€ Add row â”€â”€
  const addRow = useCallback((instrumentId: string) => {
    if (activeRows.includes(instrumentId)) return
    setActiveRows(prev => [...prev, instrumentId])
    setGrid(prev => {
      const next = new Map(prev)
      if (!next.has(instrumentId)) next.set(instrumentId, new Set())
      return next
    })
  }, [activeRows])

  // â”€â”€ Remove row â”€â”€
  const removeRow = useCallback((instrumentId: string) => {
    setActiveRows(prev => prev.filter(r => r !== instrumentId))
    setGrid(prev => {
      const next = new Map(prev)
      next.delete(instrumentId)
      return next
    })
    setHasUserEdited(true)
  }, [])

  // â”€â”€ Clear all â”€â”€
  const clearAll = useCallback(() => {
    setGrid(prev => {
      const next = new Map<string, Set<number>>()
      prev.forEach((_, key) => next.set(key, new Set()))
      return next
    })
    setHasUserEdited(true)
  }, [])

  // Randomize: generate random hits for active rows
  const randomize = useCallback(() => {
    const densities: Record<string, number> = {
      bd: 0.25, sd: 0.18, cp: 0.12, rim: 0.10,
      hh: 0.40, oh: 0.08, tom: 0.10, ride: 0.15,
      crash: 0.05, perc: 0.12,
    }
    const newGrid = new Map<string, Set<number>>()
    const total = bars * stepsPerBar
    for (const row of activeRows) {
      const density = densities[row] ?? 0.15
      const hits = new Set<number>()
      for (let s = 0; s < total; s++) {
        if (Math.random() < density) hits.add(s)
      }
      newGrid.set(row, hits)
      // Preview first hit instrument
      if (hits.size > 0) previewDrum(row)
    }
    setGrid(newGrid)
    setHasUserEdited(true)
  }, [activeRows, bars, stepsPerBar, previewDrum])

  // â”€â”€ Load preset â”€â”€
  const loadPreset = useCallback((preset: DrumPreset) => {
    const newGrid = new Map<string, Set<number>>()
    const newRows = new Set(activeRows)

    // Load preset patterns
    for (const [instrument, steps] of Object.entries(preset.pattern)) {
      const hits = new Set<number>()
      steps.forEach((v, i) => { if (v) hits.add(i) })
      newGrid.set(instrument, hits)
      newRows.add(instrument)
    }

    // Keep existing rows but clear them if not in preset
    for (const row of activeRows) {
      if (!newGrid.has(row)) newGrid.set(row, new Set())
    }

    setGrid(newGrid)
    setActiveRows([...newRows])
    setBars(1)
    setHasUserEdited(true)
    setShowPresets(false)
  }, [activeRows])

  // â”€â”€ Per-row gain â”€â”€
  // Initialize row gains from parsed drum rows
  useEffect(() => {
    const gains = new Map<string, number>()
    for (const row of drumRowsRef.current) {
      const gainMatch = channelRawCode.match(new RegExp(`s\\("${row.pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"\\)[^,]*?\\.gain\\(([\\d.]+)\\)`))
      gains.set(row.instrument, gainMatch ? parseFloat(gainMatch[1]) : 0.8)
    }
    setRowGains(gains)
  }, [channelRawCode])

  const setRowGain = useCallback((instrumentId: string, gain: number) => {
    setRowGains(prev => {
      const next = new Map(prev)
      next.set(instrumentId, Math.round(gain * 100) / 100)
      return next
    })
    setHasUserEdited(true)
  }, [])

  // â”€â”€ Per-row bank change â”€â”€
  const setRowBank = useCallback((instrumentId: string, newBank: string) => {
    setRowBanks(prev => {
      const next = new Map(prev)
      if (newBank) next.set(instrumentId, newBank)
      else next.delete(instrumentId)
      return next
    })
    setHasUserEdited(true)
    setSoundPickerRow(null)
    // Preview the new sound immediately
    if (onPreviewDrum) onPreviewDrum(instrumentId, newBank || undefined)
  }, [onPreviewDrum])

  // â”€â”€ Change instrument for a row â”€â”€
  const changeRowInstrument = useCallback((oldId: string, newId: string) => {
    if (oldId === newId) return
    setActiveRows(prev => prev.map(r => r === oldId ? newId : r))
    setGrid(prev => {
      const next = new Map<string, Set<number>>()
      prev.forEach((hits, key) => next.set(key === oldId ? newId : key, hits))
      return next
    })
    setRowGains(prev => {
      const next = new Map(prev)
      const gain = prev.get(oldId)
      if (gain != null) { next.delete(oldId); next.set(newId, gain) }
      return next
    })
    setRowBanks(prev => {
      const next = new Map(prev)
      const bnk = prev.get(oldId)
      if (bnk) { next.delete(oldId); next.set(newId, bnk) }
      return next
    })
    // Update fullInstrument map â€” new instrument has no variant by default
    const fMap = fullInstrumentMapRef.current
    fMap.delete(oldId)
    fMap.set(newId, newId)
    setHasUserEdited(true)
    setSoundPickerRow(null)
  }, [])

  // â”€â”€ Instruments not yet in grid (for "add row" menu) â”€â”€
  const availableInstruments = useMemo(
    () => DRUM_KIT.filter(d => !activeRows.includes(d.id)),
    [activeRows],
  )

  // â”€â”€ Drum info lookup â”€â”€
  const getDrum = useCallback((id: string): DrumInstrument => {
    return DRUM_KIT.find(d => d.id === id) || {
      id, label: id.toUpperCase(), icon: 'ðŸ”Š', color: '#888',
    }
  }, [])

  const totalSteps = bars * stepsPerBar
  const totalHits = useMemo(() => {
    let count = 0
    grid.forEach(hits => count += hits.size)
    return count
  }, [grid])

  return (
    <div
      className="absolute bottom-0 left-0 right-0 z-[100] flex flex-col select-none"
      style={{
        height: Math.min(activeRows.length * cellH + 100, 420),
        background: '#111318',
        borderTop: '1px solid rgba(255,255,255,0.04)',
        boxShadow: '0 -8px 16px #050607',
      }}
      onClick={e => e.stopPropagation()}
    >
      {/* â•â•â• TOOLBAR â•â•â• */}
      <div className="flex items-center justify-between px-3 py-1.5 shrink-0"
        style={{ background: '#16181d', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color }}>
            ðŸ¥ {channelName}
          </span>
          {isRecording && (
            <span className="text-[7px] font-black uppercase tracking-wider flex items-center gap-1" style={{ color: '#ff4444', animation: 'pulse 1.5s ease-in-out infinite' }}>
              ● REC
            </span>
          )}
          {bank && (
            <span className="text-[7px] font-mono" style={{ color: '#b8a47f', opacity: 0.5 }}>{bank}</span>
          )}

          <div className="w-px h-3.5 bg-white/[0.08]" />

          {/* Bars */}
          <span className="text-[7px] uppercase tracking-wider" style={{ color: '#5a616b' }}>Bars</span>
          {BAR_OPTIONS.map(b => (
            <button
              key={b}
              onClick={() => { setBars(b); setHasUserEdited(true) }}
              className="px-1.5 py-0.5 rounded text-[8px] font-bold cursor-pointer transition-all"
              style={{
                background: bars === b ? '#16181d' : 'transparent',
                color: bars === b ? color : '#5a616b',
                border: 'none',
                borderRadius: '8px',
                boxShadow: bars === b
                  ? 'inset 2px 2px 4px #050607, inset -2px -2px 4px #1a1d22'
                  : 'none',
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
                setGrid(prev => {
                  const next = new Map<string, Set<number>>()
                  prev.forEach((hits, instrumentId) => {
                    const newHits = new Set<number>()
                    hits.forEach(step => newHits.add(Math.round(step * ratio)))
                    next.set(instrumentId, newHits)
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

          {/* Presets button */}
          <div className="relative">
            <button
              onClick={() => setShowPresets(p => !p)}
              className="px-2 py-0.5 rounded-xl text-[7px] font-bold uppercase tracking-wider cursor-pointer transition-all duration-[180ms]"
              style={{ background: '#16181d', color: '#6f8fb3', boxShadow: '2px 2px 4px #050607, -2px -2px 4px #1a1d22' }}
            >
              âœ¨ Presets
            </button>

            {/* Preset dropdown */}
            {showPresets && (
              <div className="absolute top-full left-0 mt-1 w-52 rounded-2xl z-50 overflow-hidden"
                style={{ background: '#16181d', border: '1px solid rgba(255,255,255,0.04)', boxShadow: '8px 8px 16px #050607, -8px -8px 16px #1a1d22' }}>
                <div className="text-[7px] font-bold uppercase tracking-wider px-2 py-1.5" style={{ color: '#5a616b', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  DRUM PATTERNS
                </div>
                {DRUM_PRESETS.map(p => (
                  <button
                    key={p.id}
                    onClick={() => loadPreset(p)}
                    className="flex items-center gap-2 w-full px-2 py-1.5 text-left cursor-pointer
                      transition-colors duration-[180ms] last:border-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}
                  >
                    <span className="text-xs">{p.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[8px] font-bold" style={{ color: '#e8ecf0' }}>{p.name}</div>
                      <div className="text-[7px]" style={{ color: '#5a616b' }}>{p.desc}</div>
                    </div>
                    {/* Mini preview */}
                    <div className="flex gap-px shrink-0">
                      {Array.from({ length: 16 }, (_, i) => {
                        const hasHit = Object.values(p.pattern).some(arr => arr[i])
                        return (
                          <div key={i} className="rounded-sm" style={{
                            width: 3, height: 8,
                            background: hasHit ? `${color}80` : 'rgba(255,255,255,0.04)',
                          }} />
                        )
                      })}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

          {/* Dice/Random button */}
          <button
            onClick={randomize}
            className="px-2 py-0.5 rounded-xl text-[7px] font-bold uppercase tracking-wider cursor-pointer transition-all duration-[180ms]"
            style={{ background: '#16181d', color: '#b8a47f', boxShadow: '2px 2px 4px #050607, -2px -2px 4px #1a1d22' }}
            title="Generate random pattern"
          >
            🎲 Dice
          </button>

        {/* Right side */}
        <div className="flex items-center gap-1.5">
          {hasUserEdited && (
            <span className="text-[7px] font-bold px-1.5 py-0.5 rounded-lg"
              style={{ color: '#7fa998', background: '#0a0b0d', boxShadow: 'inset 1px 1px 3px #050607, inset -1px -1px 3px #1a1d22' }}>
              â— LIVE
            </span>
          )}
          <span className="text-[7px] font-mono" style={{ color: '#5a616b' }}>
            {totalHits} hit{totalHits !== 1 ? 's' : ''}
          </span>
          <button onClick={clearAll}
            className="px-1.5 py-0.5 rounded-lg text-[7px] cursor-pointer
              transition-all duration-[180ms]"
            style={{ background: '#0a0b0d', color: '#5a616b', boxShadow: '2px 2px 4px #050607, -2px -2px 4px #1a1d22' }}>
            Clear
          </button>
          <button onClick={onClose}
            className="px-1.5 py-0.5 rounded-lg text-[7px] cursor-pointer
              transition-all duration-[180ms]"
            style={{ background: '#0a0b0d', color: '#5a616b', boxShadow: '2px 2px 4px #050607, -2px -2px 4px #1a1d22' }}
            title="Esc">
            âœ•
          </button>
        </div>
      </div>

      {/* â•â•â• GRID â•â•â• */}
      <div ref={scrollRef} className="flex-1 overflow-auto"
        style={{ scrollbarWidth: 'thin', scrollbarColor: `${color}25 transparent` }}
        onWheel={(e) => {
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault()
            setZoom(z => Math.max(0.4, Math.min(3, +(z + (e.deltaY > 0 ? -0.1 : 0.1)).toFixed(2))))
          }
        }}
      >
        <div style={{ width: LABEL_W + totalSteps * cellW, position: 'relative' }}>

          {/* Beat ruler (sticky top) */}
          <div className="flex sticky top-0 z-20" style={{ height: 18, background: '#16181d' }}>
            <div className="sticky left-0 z-30 shrink-0"
              style={{
                width: LABEL_W, height: 18, background: '#16181d',
                borderBottom: '1px solid rgba(255,255,255,0.04)',
                borderRight: '1px solid rgba(255,255,255,0.04)',
              }} />
            <div className="flex">
              {Array.from({ length: totalSteps }, (_, i) => {
                const beatInterval = stepsPerBar / 4
                const isBar = i % stepsPerBar === 0
                const isBeat = i % beatInterval === 0
                const barNum = Math.floor(i / stepsPerBar) + 1
                return (
                  <div key={i} className="shrink-0 flex items-end justify-start"
                    style={{
                      width: cellW, height: 18,
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

          {/* Drum rows */}
          {activeRows.map(instrumentId => {
            const drum = getDrum(instrumentId)
            const hits = grid.get(instrumentId) || new Set<number>()
            const rowBank = rowBanks.get(instrumentId)
            const bankLabel = rowBank
              ? (DRUM_BANK_OPTIONS.find(([k]) => k === rowBank)?.[1] || rowBank)
              : null

            return (
              <div key={instrumentId} className="flex" style={{ height: cellH }}>
                {/* Row label (sticky left) â€” Drum Pad + Sound + Bank */}
                <div
                  className="sticky left-0 z-10 shrink-0 flex items-center gap-1 px-1"
                  style={{
                    width: LABEL_W, height: cellH,
                    background: '#0a0b0d',
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                    borderRight: '1px solid rgba(255,255,255,0.06)',
                  }}
                >
                  {/* â”€â”€ DRUM PAD â€” click to audition â”€â”€ */}
                  <button
                    onClick={() => previewDrum(instrumentId)}
                    className="shrink-0 flex items-center justify-center cursor-pointer transition-all duration-75 active:scale-90"
                    style={{
                      width: 22, height: 22, borderRadius: 6,
                      background: padFlash === instrumentId
                        ? `linear-gradient(135deg, ${drum.color}, ${drum.color}cc)`
                        : '#16181d',
                      border: `1px solid ${drum.color}40`,
                      boxShadow: padFlash === instrumentId
                        ? `0 0 10px ${drum.color}60, inset 0 1px 0 rgba(255,255,255,0.2)`
                        : '2px 2px 4px #050607, -2px -2px 4px #1a1d22',
                      color: padFlash === instrumentId ? '#fff' : drum.color,
                    }}
                    title={`Play ${drum.label}${rowBank ? ` (${bankLabel})` : ''}`}
                  >
                    <span className="text-[9px] leading-none">{drum.icon}</span>
                  </button>

                  {/* â”€â”€ Sound name + bank (click to open picker) â”€â”€ */}
                  <button
                    onClick={() => setSoundPickerRow(soundPickerRow === instrumentId ? null : instrumentId)}
                    className="flex-1 min-w-0 flex flex-col items-start cursor-pointer group"
                    style={{ background: 'none', border: 'none', padding: 0 }}
                    title="Change sound / bank"
                  >
                    <span className="text-[7px] font-bold uppercase tracking-wider truncate w-full text-left group-hover:brightness-125 transition-all"
                      style={{ color: drum.color }}>
                      {drum.label}
                    </span>
                    <span className="text-[6px] font-mono truncate w-full text-left"
                      style={{ color: '#5a616b', marginTop: -1 }}>
                      {bankLabel || 'default'}
                    </span>
                  </button>

                  {/* â”€â”€ VOL knob (tiny) â”€â”€ */}
                  <input
                    type="range"
                    min={0}
                    max={1.5}
                    step={0.05}
                    value={rowGains.get(instrumentId) ?? 0.8}
                    onChange={(e) => setRowGain(instrumentId, parseFloat(e.target.value))}
                    className="h-[3px] appearance-none rounded-full cursor-pointer shrink-0"
                    style={{
                      width: 24,
                      background: `linear-gradient(to right, ${drum.color}80, ${drum.color}20)`,
                      accentColor: drum.color,
                    }}
                    title={`Vol: ${((rowGains.get(instrumentId) ?? 0.8) * 100).toFixed(0)}%`}
                  />

                  {/* â”€â”€ Remove row â”€â”€ */}
                  <button
                    onClick={() => removeRow(instrumentId)}
                    className="text-[7px] cursor-pointer transition-opacity opacity-20 hover:opacity-80 shrink-0"
                    style={{ color: '#b86f6f', background: 'none', border: 'none', lineHeight: 1 }}
                    title="Remove row"
                  >
                    Ã—
                  </button>

                  {/* â”€â”€ Sound/Bank Picker Popover â”€â”€ */}
                  {soundPickerRow === instrumentId && (
                    <div
                      className="absolute left-1 z-50 w-56 rounded-xl overflow-hidden"
                      style={{
                        top: cellH + 2,
                        background: '#16181d',
                        border: '1px solid rgba(255,255,255,0.06)',
                        boxShadow: '8px 8px 20px #0e1013, -4px -4px 12px #1a1d22',
                        maxHeight: 280,
                      }}
                      onClick={e => e.stopPropagation()}
                    >
                      {/* Sound type selector */}
                      <div className="px-2 py-1.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <div className="text-[7px] font-bold uppercase tracking-wider mb-1" style={{ color: '#5a616b' }}>
                          SOUND
                        </div>
                        <div className="flex flex-wrap gap-0.5">
                          {DRUM_KIT.map(d => (
                            <button
                              key={d.id}
                              onClick={() => changeRowInstrument(instrumentId, d.id)}
                              className="px-1.5 py-0.5 rounded-lg text-[7px] font-bold cursor-pointer transition-all"
                              style={{
                                background: d.id === instrumentId ? '#0a0b0d' : 'transparent',
                                color: d.id === instrumentId ? d.color : '#5a616b',
                                border: 'none',
                                boxShadow: d.id === instrumentId
                                  ? `inset 2px 2px 4px #050607, inset -2px -2px 4px #1a1d22`
                                  : 'none',
                              }}
                            >
                              {d.icon} {d.id.toUpperCase()}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Bank selector */}
                      <div className="px-2 py-1.5 overflow-y-auto" style={{ maxHeight: 180, scrollbarWidth: 'thin', scrollbarColor: '#5a616b33 transparent' }}>
                        <div className="text-[7px] font-bold uppercase tracking-wider mb-1" style={{ color: '#5a616b' }}>
                          DRUM MACHINE
                        </div>
                        <div className="flex flex-col gap-px">
                          {DRUM_BANK_OPTIONS.map(([bankId, bankName]) => (
                            <button
                              key={bankId || '__none__'}
                              onClick={() => setRowBank(instrumentId, bankId)}
                              className="flex items-center gap-1.5 w-full px-1.5 py-1 text-left cursor-pointer rounded-lg transition-all"
                              style={{
                                background: (rowBank || '') === bankId ? '#0a0b0d' : 'transparent',
                                color: (rowBank || '') === bankId ? drum.color : '#8a919b',
                                border: 'none',
                                boxShadow: (rowBank || '') === bankId
                                  ? `inset 2px 2px 4px #050607, inset -2px -2px 4px #1a1d22`
                                  : 'none',
                              }}
                            >
                              <span className="text-[8px] font-bold">{bankName}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Close */}
                      <button
                        onClick={() => setSoundPickerRow(null)}
                        className="w-full px-2 py-1 text-[7px] font-bold uppercase tracking-wider cursor-pointer"
                        style={{ color: '#5a616b', background: '#111318', border: 'none', borderTop: '1px solid rgba(255,255,255,0.04)' }}
                      >
                        CLOSE
                      </button>
                    </div>
                  )}
                </div>

                {/* Step cells */}
                {Array.from({ length: totalSteps }, (_, step) => {
                  const hasHit = hits.has(step)
                  const beatInterval = stepsPerBar / 4
                  const isBar = step % stepsPerBar === 0
                  const isBeat = step % beatInterval === 0

                  return (
                    <div
                      key={step}
                      className="shrink-0 cursor-crosshair relative"
                      style={{
                        width: cellW, height: cellH,
                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                        borderLeft: isBar
                          ? '1px solid rgba(255,255,255,0.15)'
                          : isBeat
                            ? '1px solid rgba(255,255,255,0.06)'
                            : '1px solid rgba(255,255,255,0.02)',
                        background: isBeat && !hasHit
                          ? 'rgba(255,255,255,0.02)'
                          : 'transparent',
                      }}
                      onMouseDown={(e) => handleCellDown(instrumentId, step, e)}
                      onMouseEnter={() => handleCellEnter(instrumentId, step)}
                    >
                      {/* Pad element */}
                      <div
                        className="absolute transition-all duration-75"
                        style={{
                          inset: hasHit ? 2 : 3,
                          borderRadius: hasHit ? 4 : 3,
                          background: hasHit
                            ? `linear-gradient(135deg, ${drum.color}, ${drum.color}bb)`
                            : 'rgba(255,255,255,0.03)',
                          boxShadow: hasHit
                            ? `0 0 8px ${drum.color}50, inset 0 1px 0 rgba(255,255,255,0.25), inset 0 -1px 0 rgba(0,0,0,0.3)`
                            : 'inset 1px 1px 2px #050607, inset -1px -1px 2px #1a1d22',
                          border: hasHit
                            ? `1px solid ${drum.color}40`
                            : '1px solid rgba(255,255,255,0.02)',
                        }}
                      />
                    </div>
                  )
                })}
              </div>
            )
          })}

          {/* Transport playhead line */}
          {transportPlaying && playheadStep >= 0 && (
            <div
              className="absolute pointer-events-none"
              style={{
                left: LABEL_W + playheadStep * cellW,
                top: 18,
                bottom: 0,
                width: 2,
                background: color,
                opacity: 0.85,
                boxShadow: `0 0 8px ${color}80, 0 0 2px ${color}`,
                zIndex: 30,
              }}
            >
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

          {/* Add row button */}
          {availableInstruments.length > 0 && (
            <div className="flex items-center gap-1 px-2 py-1" style={{ marginLeft: LABEL_W }}>
              <span className="text-[7px]" style={{ color: '#5a616b' }}>+ Add:</span>
              {availableInstruments.slice(0, 6).map(d => (
                <button
                  key={d.id}
                  onClick={() => { addRow(d.id); setHasUserEdited(true) }}
                  className="px-1.5 py-0.5 rounded-lg text-[7px] cursor-pointer transition-all duration-[180ms]"
                  style={{ background: '#0a0b0d', border: 'none', color: `${d.color}70`, boxShadow: '2px 2px 4px #050607, -2px -2px 4px #1a1d22' }}
                  title={`Add ${d.label} row`}
                >
                  {d.icon} {d.id.toUpperCase()}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  BUILD CODE FROM GRID â€” reconstruct the channel's Strudel code
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

function buildCodeFromGrid(
  grid: Map<string, Set<number>>,
  activeRows: string[],
  bars: number,
  originalRawCode: string,
  originalDrumRows: DrumRow[],
  isStack: boolean,
  stepsPerBar: number = 16,
  rowGains?: Map<string, number>,
  rowBanks?: Map<string, string>,
  fullInstrumentMap?: Map<string, string>,
): string {
  // Filter out empty rows
  const rowsWithHits = activeRows.filter(id => {
    const hits = grid.get(id)
    return hits && hits.size > 0
  })

  if (rowsWithHits.length === 0) return originalRawCode

  // Extract the effects chain from the original code (everything after the main s()/stack())
  const effectsChain = extractEffectsChain(originalRawCode, isStack)

  // Resolve bank for a given instrument: rowBanks override > original row bank > channel-level bank
  const bankFromOriginal = originalRawCode.match(/\.bank\(\s*"([^"]*)"/)
  const channelBankStr = bankFromOriginal ? bankFromOriginal[1] : ''

  const getBankStr = (instrument: string): string => {
    // Per-row bank override (from UI picker)
    const uiBank = rowBanks?.get(instrument)
    if (uiBank) return `.bank("${uiBank}")`
    // Original per-row bank (from parsed code)
    const origRow = originalDrumRows.find(r => r.instrument === instrument)
    if (origRow?.bank) return `.bank("${origRow.bank}")`
    // Channel-level bank
    if (channelBankStr) return `.bank("${channelBankStr}")`
    return ''
  }

  if (rowsWithHits.length === 1 && !isStack) {
    // Single instrument â†’ simple s("pattern") format
    const instrument = rowsWithHits[0]
    const hits = grid.get(instrument)!
    // Use full instrument name with variant (e.g., "bd:3") for accurate code gen
    const codeInstrument = fullInstrumentMap?.get(instrument) || instrument
    const pattern = hitsToPattern(hits, bars, codeInstrument, stepsPerBar)

    const prefixMatch = originalRawCode.match(/^\s*(\$\w*:)\s*/)
    const prefix = prefixMatch ? prefixMatch[1] : '$:'
    return `${prefix} s("${pattern}")${getBankStr(instrument)}${effectsChain}`
  }

  // Multiple instruments â†’ stack() format
  const stackLines: string[] = []
  for (const instrument of rowsWithHits) {
    const hits = grid.get(instrument)!
    // Use full instrument name with variant (e.g., "bd:3") for accurate code gen
    const codeInstrument = fullInstrumentMap?.get(instrument) || instrument
    const pattern = hitsToPattern(hits, bars, codeInstrument, stepsPerBar)

    const rowGain = rowGains?.get(instrument)
    const gainStr = rowGain != null && Math.abs(rowGain - 0.8) > 0.01 ? `.gain(${rowGain})` : ''
    stackLines.push(`  s("${pattern}")${getBankStr(instrument)}${gainStr}`)
  }

  const prefixMatch = originalRawCode.match(/^\s*(\$\w*:)\s*/)
  const prefix = prefixMatch ? prefixMatch[1] : '$:'
  return `${prefix} stack(\n${stackLines.join(',\n')}\n)${effectsChain}`
}

/** Extract the effects chain after s()/stack() â€” e.g. ".duck(2).scope()" */
function extractEffectsChain(rawCode: string, isStack: boolean): string {
  if (isStack) {
    // Find closing paren of stack() then get everything after
    const stackMatch = rawCode.match(/stack\s*\(/)
    if (!stackMatch) return ''
    const openIdx = rawCode.indexOf('(', stackMatch.index!)
    const closeIdx = findStackClosingParen(rawCode, openIdx)
    if (closeIdx === -1) return ''
    const after = rawCode.substring(closeIdx + 1).trim()
    // Filter out .bank() since we handle it per-row
    return after ? after.replace(/\.bank\(\s*"[^"]*"\s*\)/g, '') : ''
  }

  // Single channel: find closing paren of s() then get everything after
  const sMatch = rawCode.match(/s\(\s*"/)
  if (!sMatch) return ''
  // Find the closing quote and paren
  const quoteStart = rawCode.indexOf('"', sMatch.index! + 2)
  const quoteEnd = rawCode.indexOf('"', quoteStart + 1)
  if (quoteEnd === -1) return ''

  // After the closing paren of s("...")
  const closeParen = rawCode.indexOf(')', quoteEnd)
  if (closeParen === -1) return ''

  const after = rawCode.substring(closeParen + 1).trim()
  // Keep effects but filter out .bank() since we re-add it
  return after ? '\n  ' + after.replace(/\.bank\(\s*"[^"]*"\s*\)/g, '') : ''
}
