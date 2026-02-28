// ═══════════════════════════════════════════════════════════════
//  STRUDEL CODE PARSER — Extracts channel strips from live code
//  Parses $name: blocks into structured channel data with
//  sound sources, effects, and parameter values.
// ═══════════════════════════════════════════════════════════════

export interface ParsedParam {
  key: string       // e.g. 'gain', 'lpf', 'room'
  value: number     // numeric value
  raw: string       // raw matched text
}

export interface ParsedChannel {
  id: string         // unique channel id
  name: string       // display name (from $name: or 'ch1', 'ch2'...)
  source: string     // sound source e.g. 'sawtooth', 'bd', 'hh'
  sourceType: 'synth' | 'sample' | 'note' | 'stack'
  icon: string       // emoji for source type
  color: string      // hex color for the channel
  params: ParsedParam[]
  effects: string[]  // list of effect names present
  rawCode: string    // original code block
  lineStart: number  // starting line number
}

// Color palette for channels (hardware rack aesthetic)
const CHANNEL_COLORS = [
  '#22d3ee', // cyan
  '#a78bfa', // violet
  '#f97316', // orange
  '#10b981', // emerald
  '#f43f5e', // rose
  '#eab308', // yellow
  '#3b82f6', // blue
  '#ec4899', // pink
  '#14b8a6', // teal
  '#8b5cf6', // purple
  '#ef4444', // red
  '#06b6d4', // sky
]

// Source icons
const SOURCE_ICONS: Record<string, string> = {
  sawtooth: '🔻',
  supersaw: '🔻',
  sine: '〰️',
  square: '⬛',
  triangle: '🔺',
  ravebass: '🎸',
  bd: '🥁',
  sd: '🥁',
  cp: '👏',
  hh: '🎩',
  rim: '🥁',
  sbd: '💥',
  tbd: '💥',
  gm_piano: '🎹',
  gm_epiano1: '🎹',
  gm_music_box: '🎵',
  gm_choir_aahs: '🎤',
  default: '🔊',
}

// Parameters we can extract and control with knobs
const PARAM_PATTERNS: { key: string; pattern: RegExp; label: string; min: number; max: number; step: number; unit?: string }[] = [
  { key: 'gain', pattern: /\.gain\(\s*([\d.]+)/,      label: 'Gain',   min: 0, max: 2, step: 0.01 },
  { key: 'lpf',  pattern: /\.lpf\(\s*([\d.]+)/,       label: 'LPF',    min: 20, max: 20000, step: 10, unit: 'Hz' },
  { key: 'hpf',  pattern: /\.hpf\(\s*([\d.]+)/,       label: 'HPF',    min: 20, max: 8000, step: 10, unit: 'Hz' },
  { key: 'lpq',  pattern: /\.lpq\(\s*([\d.]+)/,       label: 'Q',      min: 0, max: 20, step: 0.5 },
  { key: 'lpenv',pattern: /\.lpenv\(\s*([\d.]+)/,      label: 'FltEnv', min: 0, max: 8, step: 0.1 },
  { key: 'room', pattern: /\.room\(\s*([\d.]+)/,       label: 'Reverb', min: 0, max: 1, step: 0.01 },
  { key: 'delay',pattern: /\.delay\(\s*([\d.]+)/,      label: 'Delay',  min: 0, max: 1, step: 0.01 },
  { key: 'delayfeedback', pattern: /\.delayfeedback\(\s*([\d.]+)/, label: 'DlyFB', min: 0, max: 0.95, step: 0.01 },
  { key: 'shape',pattern: /\.shape\(\s*([\d.]+)/,      label: 'Shape',  min: 0, max: 1, step: 0.01 },
  { key: 'distort', pattern: /\.distort\(\s*([\d.]+)/, label: 'Dist',   min: 0, max: 5, step: 0.1 },
  { key: 'crush',pattern: /\.crush\(\s*([\d.]+)/,      label: 'Crush',  min: 1, max: 16, step: 1 },
  { key: 'speed',pattern: /\.speed\(\s*([\d.]+)/,      label: 'Speed',  min: 0.1, max: 4, step: 0.1 },
  { key: 'pan',  pattern: /\.pan\(\s*([\d.]+)/,        label: 'Pan',    min: 0, max: 1, step: 0.01 },
  { key: 'orbit',pattern: /\.orbit\(\s*([\d.]+)/,      label: 'Orbit',  min: 0, max: 11, step: 1 },
  { key: 'detune', pattern: /\.detune\(\s*([\d.]+)/,   label: 'Detune', min: 0, max: 4, step: 0.1 },
  { key: 'duckdepth', pattern: /\.duckdepth\(\s*([\d.]+)/, label: 'Duck', min: 0, max: 1, step: 0.01 },
  { key: 'duckattack', pattern: /\.duckattack\(\s*([\d.]+)/, label: 'DkAtk', min: 0.01, max: 1, step: 0.01 },
  { key: 'rel',  pattern: /\.rel\(\s*([\d.]+)/,        label: 'Release', min: 0, max: 10, step: 0.1 },
]

// Effect names for nested display
const EFFECT_NAMES = [
  'lpf', 'hpf', 'lpq', 'lpenv', 'acidenv', 'shape', 'distort', 'crush',
  'room', 'delay', 'delayfeedback', 'pan', 'duck', 'duckdepth', 'duckattack',
  'jux', 'off', 'orbit', 'detune', 'vib', 'phaser',
]

/**
 * Parse Strudel code into structured channel data.
 * Finds all $name: and $: blocks, extracts parameters.
 */
export function parseStrudelCode(code: string): ParsedChannel[] {
  const channels: ParsedChannel[] = []
  const lines = code.split('\n')

  // Find all $name: or $: block start positions
  const blockStarts: { name: string; lineIdx: number; charIdx: number }[] = []
  let charPos = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    // Match $name: or $: at start of line (may have leading whitespace)
    const match = line.match(/^\s*\$(\w*):\s*/)
    if (match) {
      const name = match[1] || ''
      blockStarts.push({ name, lineIdx: i, charIdx: charPos })
    }
    charPos += line.length + 1 // +1 for newline
  }

  // Extract code blocks between consecutive $: starts
  for (let b = 0; b < blockStarts.length; b++) {
    const start = blockStarts[b]
    const endLine = b < blockStarts.length - 1 ? blockStarts[b + 1].lineIdx : lines.length
    const blockLines = lines.slice(start.lineIdx, endLine)
    const rawCode = blockLines.join('\n').trim()

    // Determine source
    let source = ''
    let sourceType: ParsedChannel['sourceType'] = 'sample'

    // Check for stack()
    if (/stack\s*\(/.test(rawCode)) {
      source = 'stack'
      sourceType = 'stack'
    }
    // Check for s("...")
    const sMatch = rawCode.match(/\.?s\(\s*"([^"]+)"/)
    if (sMatch && !source) {
      source = sMatch[1].replace(/[*!<>\[\]]+.*/, '').trim()
      // Determine if synth or sample
      if (['sawtooth', 'supersaw', 'sine', 'square', 'triangle', 'ravebass'].includes(source)) {
        sourceType = 'synth'
      }
    }
    // Check for note("...")
    const noteMatch = rawCode.match(/note\(\s*"([^"]+)"/)
    if (noteMatch && !source) {
      source = 'note'
      sourceType = 'note'
    }
    // Check for n(...)
    const nMatch = rawCode.match(/\bn\(\s*/)
    if (nMatch && !source) {
      source = 'sequence'
      sourceType = 'note'
    }

    if (!source) source = 'unknown'

    // Extract parameters
    const params: ParsedParam[] = []
    for (const pp of PARAM_PATTERNS) {
      const m = rawCode.match(pp.pattern)
      if (m) {
        params.push({
          key: pp.key,
          value: parseFloat(m[1]),
          raw: m[0],
        })
      }
    }

    // Find which effects are present
    const effects: string[] = []
    for (const fx of EFFECT_NAMES) {
      const fxRegex = new RegExp(`\\.${fx}\\(`)
      if (fxRegex.test(rawCode)) effects.push(fx)
    }

    // Check for scope, pianoroll (with or without underscore prefix)
    if (/\.(?:_)?scope\(\)/.test(rawCode)) effects.push('scope')
    if (/\.(?:_)?pianoroll\(\)/.test(rawCode)) effects.push('pianoroll')

    // Build channel name
    const displayName = start.name || `ch${b + 1}`

    // Source icon
    const baseSource = source.replace(/[:!*\d]/g, '').toLowerCase()
    const icon = SOURCE_ICONS[baseSource] || SOURCE_ICONS.default

    channels.push({
      id: `ch-${b}`,
      name: displayName,
      source,
      sourceType,
      icon,
      color: CHANNEL_COLORS[b % CHANNEL_COLORS.length],
      params,
      effects,
      rawCode,
      lineStart: start.lineIdx,
    })
  }

  return channels
}

/**
 * Update a parameter value in code by finding and replacing.
 * Returns the modified code string.
 */
export function updateParamInCode(
  code: string,
  channelIdx: number,
  paramKey: string,
  newValue: number,
): string {
  const channels = parseStrudelCode(code)
  const channel = channels[channelIdx]
  if (!channel) return code

  const param = channel.params.find(p => p.key === paramKey)
  if (!param) return code

  // Find the parameter definition in the param patterns
  const pp = PARAM_PATTERNS.find(p => p.key === paramKey)
  if (!pp) return code

  // Format the new value
  const formatted = pp.step >= 1
    ? Math.round(newValue).toString()
    : newValue.toFixed(pp.step >= 0.1 ? 1 : 2)

  // Replace in the raw code block
  const oldBlockCode = channel.rawCode
  const newBlockCode = oldBlockCode.replace(pp.pattern, (match) => {
    // Replace just the number in the match
    return match.replace(/[\d.]+/, formatted)
  })

  if (oldBlockCode === newBlockCode) return code

  return code.replace(oldBlockCode, newBlockCode)
}

/** Get parameter definition by key */
export function getParamDef(key: string) {
  return PARAM_PATTERNS.find(p => p.key === key)
}

export { PARAM_PATTERNS }
