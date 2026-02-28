// ═══════════════════════════════════════════════════════════════
//  STRUDEL CODE PARSER v2 — Position-based, expression-aware
//  Handles: slider(), perlin.range(), sine.range(), saw.range(),
//  irand(), pattern strings, and plain numeric values.
//  Uses character positions for precise in-place replacement.
// ═══════════════════════════════════════════════════════════════

// ─── Types ───

export interface ParamDef {
  key: string
  label: string
  min: number
  max: number
  step: number
  unit?: string
}

export interface ParsedParam {
  key: string
  value: number        // representative numeric value for knob display
  raw: string          // raw argument text (e.g. "slider(.2, 0, .5)")
  argStart: number     // char position of arg start in FULL code
  argEnd: number       // char position of arg end in FULL code (exclusive)
  isComplex: boolean   // true if arg is expression, not simple number
}

export interface ParsedChannel {
  id: string
  name: string
  source: string
  sourceType: 'synth' | 'sample' | 'note' | 'stack'
  icon: string
  color: string
  params: ParsedParam[]
  effects: string[]
  rawCode: string
  lineStart: number
  lineEnd: number       // exclusive line end
  blockStart: number    // char offset of block start in full code
  blockEnd: number      // char offset of block end in full code
}

// ─── Constants ───

const CHANNEL_COLORS = [
  '#22d3ee', '#a78bfa', '#f97316', '#10b981', '#f43f5e', '#eab308',
  '#3b82f6', '#ec4899', '#14b8a6', '#8b5cf6', '#ef4444', '#06b6d4',
]

const SOURCE_ICONS: Record<string, string> = {
  sawtooth: '🔻', supersaw: '🔻', sine: '〰️', square: '⬛',
  triangle: '🔺', ravebass: '🎸', bd: '🥁', sd: '🥁',
  cp: '👏', hh: '🎩', rim: '🥁',
  gm_piano: '🎹', gm_epiano1: '🎹', gm_music_box: '🎵',
  gm_choir_aahs: '🎤', default: '🔊',
}

const SYNTH_NAMES = ['sawtooth', 'supersaw', 'sine', 'square', 'triangle', 'ravebass']

export const PARAM_DEFS: ParamDef[] = [
  // Gain / Level
  { key: 'gain',           label: 'Gain',     min: 0,    max: 2,     step: 0.01 },
  { key: 'velocity',       label: 'Vel',      min: 0,    max: 1,     step: 0.01 },
  // Filter
  { key: 'lpf',            label: 'LPF',      min: 20,   max: 20000, step: 10,   unit: 'Hz' },
  { key: 'hpf',            label: 'HPF',      min: 20,   max: 8000,  step: 10,   unit: 'Hz' },
  { key: 'lpq',            label: 'Q',        min: 0,    max: 20,    step: 0.5 },
  { key: 'lpenv',          label: 'FltEnv',   min: 0,    max: 8,     step: 0.1 },
  { key: 'lps',            label: 'FltSus',   min: 0,    max: 1,     step: 0.01 },
  { key: 'lpd',            label: 'FltDec',   min: 0,    max: 1,     step: 0.01 },
  // Drive
  { key: 'shape',          label: 'Shape',    min: 0,    max: 1,     step: 0.01 },
  { key: 'distort',        label: 'Dist',     min: 0,    max: 5,     step: 0.1 },
  { key: 'crush',          label: 'Crush',    min: 1,    max: 16,    step: 1 },
  // Space
  { key: 'room',           label: 'Reverb',   min: 0,    max: 1,     step: 0.01 },
  { key: 'delay',          label: 'Delay',    min: 0,    max: 1,     step: 0.01 },
  { key: 'delayfeedback',  label: 'DlyFB',    min: 0,    max: 0.95,  step: 0.01 },
  { key: 'delaytime',      label: 'DlyTime',  min: 0.01, max: 1,     step: 0.01 },
  // Modulation
  { key: 'speed',          label: 'Speed',    min: 0.1,  max: 4,     step: 0.1 },
  { key: 'pan',            label: 'Pan',      min: 0,    max: 1,     step: 0.01 },
  { key: 'detune',         label: 'Detune',   min: 0,    max: 4,     step: 0.1 },
  { key: 'orbit',          label: 'Orbit',    min: 0,    max: 11,    step: 1 },
  // Sidechain
  { key: 'duckdepth',      label: 'Duck',     min: 0,    max: 1,     step: 0.01 },
  { key: 'duckattack',     label: 'DkAtk',    min: 0.01, max: 1,     step: 0.01 },
  // Envelope
  { key: 'rel',            label: 'Release',  min: 0,    max: 10,    step: 0.1 },
]

// Effect names for detecting which effects are present
const EFFECT_NAMES = [
  'lpf', 'hpf', 'lpq', 'lpenv', 'lps', 'lpd', 'shape', 'distort', 'crush',
  'room', 'delay', 'delayfeedback', 'delaytime', 'pan', 'duck', 'duckdepth',
  'duckattack', 'jux', 'off', 'orbit', 'detune', 'vib', 'phaser', 'speed',
  'velocity', 'rel', 'gain',
]

/** Draggable effects palette entries */
export const DRAGGABLE_EFFECTS = [
  { id: 'lpf',           label: 'LPF',     code: '.lpf(800)',           icon: '🔽', category: 'filter' },
  { id: 'hpf',           label: 'HPF',     code: '.hpf(400)',           icon: '🔼', category: 'filter' },
  { id: 'room',          label: 'Reverb',  code: '.room(.5)',           icon: '🏛️', category: 'space' },
  { id: 'delay',         label: 'Delay',   code: '.delay(.25)',         icon: '📡', category: 'space' },
  { id: 'delayfeedback', label: 'DlyFB',   code: '.delayfeedback(.4)',  icon: '🔁', category: 'space' },
  { id: 'shape',         label: 'Shape',   code: '.shape(.3)',          icon: '📐', category: 'drive' },
  { id: 'distort',       label: 'Distort', code: '.distort(.5)',        icon: '🔥', category: 'drive' },
  { id: 'crush',         label: 'Crush',   code: '.crush(8)',           icon: '👾', category: 'drive' },
  { id: 'pan',           label: 'Pan',     code: '.pan(.5)',            icon: '↔️', category: 'mod' },
  { id: 'detune',        label: 'Detune',  code: '.detune(1)',          icon: '🎸', category: 'mod' },
  { id: 'speed',         label: 'Speed',   code: '.speed(1)',           icon: '⏩', category: 'mod' },
  { id: 'rel',           label: 'Release', code: '.rel(.5)',            icon: '⏬', category: 'env' },
]

// ─── Private Helpers ───

/** Find the matching closing paren for '(' at openIdx. Returns -1 if unmatched. */
function findClosingParen(code: string, openIdx: number): number {
  let depth = 1
  let i = openIdx + 1
  while (i < code.length && depth > 0) {
    const ch = code[i]
    if (ch === '(') {
      depth++
    } else if (ch === ')') {
      depth--
      if (depth === 0) return i
    } else if (ch === '"' || ch === "'" || ch === '`') {
      const quote = ch
      i++
      while (i < code.length && code[i] !== quote) {
        if (code[i] === '\\') i++ // skip escaped chars
        i++
      }
    }
    i++
  }
  return -1
}

/** Check if a character position is inside a // line comment */
function isInComment(code: string, pos: number): boolean {
  let lineStart = pos
  while (lineStart > 0 && code[lineStart - 1] !== '\n') lineStart--
  const linePrefix = code.substring(lineStart, pos)
  return /^\s*\/\//.test(linePrefix)
}

/** Extract a representative numeric value from an expression string */
function extractValue(argStr: string): number | null {
  const trimmed = argStr.trim()
  if (!trimmed) return null

  // Simple number: 0.8, .5, 300
  if (/^-?[\d.]+$/.test(trimmed)) return parseFloat(trimmed)

  // slider(default, min, max)
  const sliderMatch = trimmed.match(/^slider\(\s*(-?[\d.]+)/)
  if (sliderMatch) return parseFloat(sliderMatch[1])

  // signal.range(a, b) — sine, perlin, saw, cosine, tri, rand
  const rangeMatch = trimmed.match(/\.range\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)/)
  if (rangeMatch) return (parseFloat(rangeMatch[1]) + parseFloat(rangeMatch[2])) / 2

  // irand(n) — random int 0..n-1
  const irandMatch = trimmed.match(/^irand\(\s*(\d+)/)
  if (irandMatch) return parseInt(irandMatch[1]) / 2

  // Pattern string "[.2 .35]*4" — not a single knob value
  if (trimmed.startsWith('"') || trimmed.startsWith("'")) return null

  // Fallback: first number in the expression
  const firstNum = trimmed.match(/(-?[\d.]+)/)
  if (firstNum) return parseFloat(firstNum[1])

  return null
}

/** Format a numeric value for code output based on step size */
export function formatParamValue(value: number, step: number): string {
  if (step >= 1) return Math.round(value).toString()
  if (step >= 0.1) return value.toFixed(1)
  return value.toFixed(2)
}

// ═══════════════════════════════════════════════════════════════
//  parseStrudelCode — Find all $name: blocks, extract params
//  using position-aware bracket matching
// ═══════════════════════════════════════════════════════════════

export function parseStrudelCode(code: string): ParsedChannel[] {
  const channels: ParsedChannel[] = []
  const lines = code.split('\n')

  // Step 1: Find all block starts ($name: or $:)
  const blockStarts: { name: string; lineIdx: number; charIdx: number }[] = []
  let charPos = 0
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^\s*\$(\w*):\s*/)
    if (match) {
      blockStarts.push({ name: match[1] || '', lineIdx: i, charIdx: charPos })
    }
    charPos += lines[i].length + 1 // +1 for newline
  }

  // Step 2: Extract each block
  for (let b = 0; b < blockStarts.length; b++) {
    const start = blockStarts[b]
    const endLineIdx = b < blockStarts.length - 1 ? blockStarts[b + 1].lineIdx : lines.length
    const blockLines = lines.slice(start.lineIdx, endLineIdx)
    const rawCode = blockLines.join('\n')
    const blockCharStart = start.charIdx
    const blockCharEnd = blockCharStart + rawCode.length

    // Determine sound source
    let source = ''
    let sourceType: ParsedChannel['sourceType'] = 'sample'

    if (/stack\s*\(/.test(rawCode)) {
      source = 'stack'
      sourceType = 'stack'
    }
    if (!source) {
      const sMatch = rawCode.match(/\.?s\(\s*"([^"]+)"/)
      if (sMatch) {
        source = sMatch[1].replace(/[*!<>\[\]:]+.*/, '').trim()
        if (SYNTH_NAMES.includes(source)) sourceType = 'synth'
      }
    }
    if (!source) {
      if (/note\(\s*"/.test(rawCode)) { source = 'note'; sourceType = 'note' }
    }
    if (!source) {
      if (/\bn\s*\(/.test(rawCode)) { source = 'sequence'; sourceType = 'note' }
    }
    if (!source) source = 'unknown'

    // Step 3: Extract parameters using position-aware matching
    const params: ParsedParam[] = []
    for (const paramDef of PARAM_DEFS) {
      // Build regex to find .paramKey( — must match exact method name followed by (
      const methodRegex = new RegExp(`\\.${paramDef.key}\\(`, 'g')
      let match: RegExpExecArray | null
      while ((match = methodRegex.exec(rawCode)) !== null) {
        // Skip matches inside comments
        if (isInComment(rawCode, match.index)) continue

        // Find the opening paren position (last char of match)
        const openParenInBlock = match.index + match[0].length - 1
        const closeParenInBlock = findClosingParen(rawCode, openParenInBlock)
        if (closeParenInBlock === -1) continue

        const argStr = rawCode.substring(openParenInBlock + 1, closeParenInBlock)
        const repValue = extractValue(argStr)
        if (repValue === null) continue // Can't extract a display value

        const isSimple = /^\s*-?[\d.]+\s*$/.test(argStr)
        params.push({
          key: paramDef.key,
          value: repValue,
          raw: argStr,
          argStart: blockCharStart + openParenInBlock + 1,
          argEnd: blockCharStart + closeParenInBlock,
          isComplex: !isSimple,
        })
        break // Only match first occurrence per param key
      }
    }

    // Step 4: Find which effects are present
    const effects: string[] = []
    for (const fx of EFFECT_NAMES) {
      const fxRegex = new RegExp(`\\.${fx}\\(`)
      if (fxRegex.test(rawCode)) effects.push(fx)
    }
    if (/\.(?:_)?scope\(\)/.test(rawCode)) effects.push('scope')
    if (/\.(?:_)?pianoroll\(\)/.test(rawCode)) effects.push('pianoroll')

    // Build channel
    const displayName = start.name || `ch${b + 1}`
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
      lineEnd: endLineIdx,
      blockStart: blockCharStart,
      blockEnd: blockCharEnd,
    })
  }

  return channels
}

// ═══════════════════════════════════════════════════════════════
//  updateParamInCode — Replace a param value using char positions
//  Handles complex expressions (slider, perlin, sine) by
//  replacing the ENTIRE argument with the new simple value.
// ═══════════════════════════════════════════════════════════════

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

  const paramDef = PARAM_DEFS.find(p => p.key === paramKey)
  if (!paramDef) return code

  const formatted = formatParamValue(newValue, paramDef.step)

  // Replace the argument at exact character positions
  return code.substring(0, param.argStart) + formatted + code.substring(param.argEnd)
}

// ═══════════════════════════════════════════════════════════════
//  insertEffectInChannel — Append effect code to a channel block
//  Inserts before .scope()/.pianoroll() if present, or at end
// ═══════════════════════════════════════════════════════════════

export function insertEffectInChannel(
  code: string,
  channelIdx: number,
  effectCode: string,
): string {
  const channels = parseStrudelCode(code)
  const ch = channels[channelIdx]
  if (!ch) return code

  const lines = code.split('\n')

  // Find the last non-empty line of the block
  let lastContentLine = ch.lineEnd - 1
  while (lastContentLine > ch.lineStart && lines[lastContentLine].trim() === '') {
    lastContentLine--
  }

  // Detect indentation: use 2 spaces as the chain indent,
  // or match the indentation of the last content line
  const existingIndent = lines[lastContentLine].match(/^(\s*)/)?.[1] || ''
  const chainIndent = existingIndent || '  '

  // Check if the last content line ends with .scope() or .pianoroll()
  // (strip trailing whitespace for the check)
  const trimmedLast = lines[lastContentLine].trimEnd()
  const endsWithVisual = /\.(?:scope|pianoroll)\(\)$/.test(trimmedLast)

  if (endsWithVisual) {
    // Insert a new line BEFORE the visual line
    lines.splice(lastContentLine, 0, `${chainIndent}${effectCode}`)
  } else {
    // Insert after the last content line
    lines.splice(lastContentLine + 1, 0, `${chainIndent}${effectCode}`)
  }

  return lines.join('\n')
}

// ═══════════════════════════════════════════════════════════════
//  applyMixerOverrides — Mute/solo channels for evaluation
//  Replaces silenced blocks with $name: silence
//  This modifies the CODE passed to engine.evaluate(), NOT the
//  code in the editor — the editor always shows clean code.
// ═══════════════════════════════════════════════════════════════

export function applyMixerOverrides(
  code: string,
  muted: Set<number>,
  soloed: Set<number>,
): string {
  if (muted.size === 0 && soloed.size === 0) return code

  const channels = parseStrudelCode(code)
  if (channels.length === 0) return code

  const lines = code.split('\n')

  // Determine which channels should be silent
  const silentSet = new Set<number>()
  for (let i = 0; i < channels.length; i++) {
    if (muted.has(i)) silentSet.add(i)
    if (soloed.size > 0 && !soloed.has(i)) silentSet.add(i)
  }
  if (silentSet.size === 0) return code

  // Build output — replace silent blocks with $name: silence
  const outputLines: string[] = []
  let lineIdx = 0

  for (let i = 0; i < channels.length; i++) {
    const ch = channels[i]

    // Add lines before this block (comments, setCps, blank lines)
    while (lineIdx < ch.lineStart) {
      outputLines.push(lines[lineIdx])
      lineIdx++
    }

    if (silentSet.has(i)) {
      // Replace block with silence
      const prefix = ch.name ? `$${ch.name}` : '$'
      outputLines.push(`${prefix}: silence`)
      lineIdx = ch.lineEnd
    } else {
      // Keep original block
      while (lineIdx < ch.lineEnd) {
        outputLines.push(lines[lineIdx])
        lineIdx++
      }
    }
  }

  // Add any trailing lines
  while (lineIdx < lines.length) {
    outputLines.push(lines[lineIdx])
    lineIdx++
  }

  return outputLines.join('\n')
}

// ═══════════════════════════════════════════════════════════════
//  Utilities
// ═══════════════════════════════════════════════════════════════

/** Get a param definition by key */
export function getParamDef(key: string): ParamDef | undefined {
  return PARAM_DEFS.find(p => p.key === key)
}

// Backward compat aliases
export { PARAM_DEFS as PARAM_PATTERNS }
