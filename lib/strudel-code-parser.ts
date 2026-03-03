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
  bank?: string         // drum bank name if .bank("X") is present
  isSimpleSource: boolean // true if s() has a single word (swappable)
  duckTarget: number | null  // orbit number this channel's .duck() targets
  isKickLike: boolean        // true if source is drum/percussion (bd, sd, cp, hh, etc.)
  blockType: 'dollar' | 'let' // whether this is a $name: block or let varName = block
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
  // Filter shorthands (aliases — Strudel accepts .lp() / .hp() as shorthand)
  { key: 'lp',             label: 'LPF',      min: 20,   max: 20000, step: 10,   unit: 'Hz' },
  { key: 'hp',             label: 'HPF',      min: 20,   max: 8000,  step: 10,   unit: 'Hz' },
  // Envelope
  { key: 'attack',         label: 'Attack',   min: 0,    max: 2,     step: 0.01 },
  { key: 'decay',          label: 'Decay',    min: 0,    max: 5,     step: 0.01 },
  { key: 'rel',            label: 'Release',  min: 0,    max: 10,    step: 0.1 },
  { key: 'release',        label: 'Release',  min: 0,    max: 10,    step: 0.1 },
  { key: 'legato',         label: 'Legato',   min: 0,    max: 4,     step: 0.1 },
  { key: 'clip',           label: 'Clip',     min: 0,    max: 4,     step: 0.1 },
  // Output
  { key: 'postgain',       label: 'PostG',    min: 0,    max: 4,     step: 0.1 },
  // Vocal / Sample
  { key: 'loopAt',         label: 'LoopAt',   min: 1,    max: 64,    step: 1 },
  { key: 'begin',          label: 'Begin',    min: 0,    max: 1,     step: 0.01 },
  { key: 'end',            label: 'End',      min: 0,    max: 1,     step: 0.01 },
  { key: 'speed',          label: 'Speed',    min: 0.25, max: 4,     step: 0.01 },
  { key: 'chop',           label: 'Chop',     min: 1,    max: 64,    step: 1 },
  { key: 'stretch',        label: 'Stretch',  min: 0.25, max: 4,     step: 0.05 },
]

// Effect names for detecting which effects are present
const EFFECT_NAMES = [
  'lpf', 'lp', 'hpf', 'hp', 'lpq', 'lpenv', 'lps', 'lpd', 'shape', 'distort', 'crush',
  'room', 'delay', 'delayfeedback', 'delaytime', 'pan', 'duck', 'duckdepth',
  'duckattack', 'jux', 'juxBy', 'off', 'orbit', 'detune', 'vib', 'phaser', 'speed',
  'velocity', 'rel', 'release', 'gain', 'attack', 'decay', 'legato', 'clip',
  'postgain', 'compressor', 'arp', 'arpeggiate', 'superimpose', 'echo', 'fast',
  'loopAt', 'begin', 'end', 'chop', 'stretch',
]

/** Draggable effects palette entries */
export const DRAGGABLE_EFFECTS = [
  // ── Filter ──
  { id: 'lpf',           label: 'LPF',     code: '.lpf(800)',           icon: '🔽', category: 'filter',  target: 'both' as const },
  { id: 'hpf',           label: 'HPF',     code: '.hpf(400)',           icon: '🔼', category: 'filter',  target: 'both' as const },
  { id: 'lpenv',         label: 'LPEnv',   code: '.lpenv(4)',           icon: '📈', category: 'filter',  target: 'both' as const },
  { id: 'lpq',           label: 'Reso',    code: '.lpq(3)',             icon: '〰️', category: 'filter',  target: 'both' as const },
  { id: 'lps',           label: 'FltSus',  code: '.lps(.2)',            icon: '📉', category: 'filter',  target: 'both' as const },
  { id: 'lpd',           label: 'FltDec',  code: '.lpd(.12)',           icon: '📊', category: 'filter',  target: 'both' as const },
  // ── Space ──
  { id: 'room',          label: 'Reverb',  code: '.room(.5)',           icon: '🏛️', category: 'space',   target: 'both' as const },
  { id: 'delay',         label: 'Delay',   code: '.delay(.25)',         icon: '📡', category: 'space',   target: 'both' as const },
  { id: 'delayfeedback', label: 'DlyFB',   code: '.delayfeedback(.4)',  icon: '🔁', category: 'space',   target: 'both' as const },
  // ── Drive ──
  { id: 'shape',         label: 'Shape',   code: '.shape(.3)',          icon: '📐', category: 'drive',   target: 'instrument' as const },
  { id: 'distort',       label: 'Distort', code: '.distort(.5)',        icon: '🔥', category: 'drive',   target: 'instrument' as const },
  { id: 'crush',         label: 'Crush',   code: '.crush(8)',           icon: '👾', category: 'drive',   target: 'both' as const },
  // ── Mod ──
  { id: 'pan',           label: 'Pan',     code: '.pan(.5)',            icon: '↔️', category: 'mod',     target: 'both' as const },
  { id: 'detune',        label: 'Detune',  code: '.detune(1)',          icon: '🎸', category: 'mod',     target: 'instrument' as const },
  { id: 'speed',         label: 'Speed',   code: '.speed(1)',           icon: '⏩', category: 'mod',     target: 'sound' as const },
  { id: 'velocity',      label: 'Vel',     code: '.velocity(.8)',       icon: '💨', category: 'mod',     target: 'both' as const },
  { id: 'postgain',      label: 'PostG',   code: '.postgain(1.5)',      icon: '📈', category: 'mod',     target: 'both' as const },
  // ── Envelope ──
  { id: 'attack',        label: 'Attack',  code: '.attack(.1)',         icon: '⏫', category: 'env',     target: 'instrument' as const },
  { id: 'decay',         label: 'Decay',   code: '.decay(.3)',          icon: '⏳', category: 'env',     target: 'both' as const },
  { id: 'rel',           label: 'Release', code: '.rel(.5)',            icon: '⏬', category: 'env',     target: 'instrument' as const },
  { id: 'legato',        label: 'Legato',  code: '.legato(1)',          icon: '🎵', category: 'env',     target: 'both' as const },
  { id: 'clip',          label: 'Clip',    code: '.clip(1)',            icon: '✂️', category: 'env',     target: 'both' as const },
  // ── Sidechain ──
  { id: 'duck',          label: 'Duck',    code: '.duck(1)',            icon: '🦆', category: 'sidechain', target: 'both' as const },
  { id: 'duckdepth',     label: 'DkDpth',  code: '.duckdepth(.8)',      icon: '⬇️', category: 'sidechain', target: 'both' as const },
  { id: 'duckattack',    label: 'DkAtk',   code: '.duckattack(.2)',     icon: '⬆️', category: 'sidechain', target: 'both' as const },
  // ── Arpeggiator (modes are now in ARP_MODES, rate via .fast() knob) ──
  // ── Pattern ──
  { id: 'jux',           label: 'Jux',     code: '.jux(rev)',                     icon: '◐', category: 'pattern', target: 'both' as const },
  { id: 'off',           label: 'Off +5',  code: '.off(1/8, x => x.add(7))',      icon: '⟩', category: 'pattern', target: 'instrument' as const },
  { id: 'superimpose',   label: 'Super',   code: '.superimpose(x => x.add(12).slow(2))', icon: '⊕', category: 'pattern', target: 'instrument' as const },
  { id: 'echo',          label: 'Echo',    code: '.echo(3, 1/8, 0.5)',            icon: '≡', category: 'pattern', target: 'both' as const },
  // ── Sample / Vocal ──
  { id: 'loopAt',         label: 'LoopAt',  code: '.loopAt(8)',            icon: '🔄', category: 'sample',  target: 'sound' as const },
  { id: 'begin',          label: 'Begin',   code: '.begin(0)',             icon: '⏮️', category: 'sample',  target: 'sound' as const },
  { id: 'end',            label: 'End',     code: '.end(1)',               icon: '⏭️', category: 'sample',  target: 'sound' as const },
  { id: 'chop',           label: 'Chop',    code: '.chop(8)',              icon: '🔪', category: 'sample',  target: 'sound' as const },
  { id: 'stretch',        label: 'Stretch', code: '.stretch(1)',           icon: '🧲', category: 'sample',  target: 'sound' as const },
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

  // Pattern string "[.2 .35]*4" — extract first number as representative value
  if (trimmed.startsWith('"') || trimmed.startsWith("'")) {
    const inner = trimmed.slice(1, -1).replace(/[^0-9.\-\s]/g, ' ')
    const patNum = inner.match(/(-?\.?\d[\d.]*)/)
    if (patNum) return parseFloat(patNum[1])
    return null
  }

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
//  parseStrudelCode — Find all $name: and let varName = blocks,
//  extract params using position-aware bracket matching
// ═══════════════════════════════════════════════════════════════

export function parseStrudelCode(code: string): ParsedChannel[] {
  const channels: ParsedChannel[] = []
  const lines = code.split('\n')

  // Step 1: Find all block starts ($name: or $: or let varName =)
  const blockStarts: { name: string; lineIdx: number; charIdx: number; blockType: 'dollar' | 'let' }[] = []
  let charPos = 0
  for (let i = 0; i < lines.length; i++) {
    // Match $name: or $: blocks
    const dollarMatch = lines[i].match(/^\s*\$(\w*):\s*/)
    if (dollarMatch) {
      blockStarts.push({ name: dollarMatch[1] || '', lineIdx: i, charIdx: charPos, blockType: 'dollar' })
    } else {
      // Match let varName = ... blocks (but NOT let varName = silence, which is our mute placeholder)
      const letMatch = lines[i].match(/^\s*let\s+(\w+)\s*=\s*/)
      if (letMatch) {
        // Skip if the rest of the line is just 'silence' (muted channel placeholder)
        const rest = lines[i].slice(letMatch[0].length).trim()
        if (rest !== 'silence') {
          blockStarts.push({ name: letMatch[1], lineIdx: i, charIdx: charPos, blockType: 'let' })
        }
      }
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
        const sContent = sMatch[1].trim()
        // Try simple extraction first: strip modifiers like *4, !4, :2, and mini-notation
        const simpleName = sContent.replace(/[*!<>\[\]:]+.*/, '').trim()
        if (simpleName && /^[a-zA-Z_]\w*$/.test(simpleName)) {
          source = simpleName
        } else {
          // Complex pattern like "[~ hh]*4" or "bd [~ bd]" — extract first alpha word
          const wordMatch = sContent.match(/\b([a-zA-Z_][a-zA-Z0-9_]*)\b/g)
          if (wordMatch) {
            // Take the first instrument word that isn't a rest token
            for (const w of wordMatch) {
              if (w !== 'silence') { source = w; break }
            }
          }
        }
        if (source && SYNTH_NAMES.includes(source)) sourceType = 'synth'
      }
    }
    // If channel uses note() or n(), it's a melodic channel — override to 'note'
    // even if .s() was detected first with a GM instrument name (e.g. gm_epiano1)
    if (/note\(\s*["'`]/.test(rawCode) || /\bn\s*\(/.test(rawCode)) {
      if (sourceType === 'sample') sourceType = 'note'
      if (!source || source === 'unknown') {
        source = /note\(\s*["'`]/.test(rawCode) ? 'note' : 'sequence'
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

    // Step 5: Parse .duck() to extract sidechain target orbit
    let duckTarget: number | null = null
    const duckCallRegex = /\.duck\(/g
    let dMatch: RegExpExecArray | null
    while ((dMatch = duckCallRegex.exec(rawCode)) !== null) {
      if (isInComment(rawCode, dMatch.index)) continue
      const dkOpen = dMatch.index + dMatch[0].length - 1
      const dkClose = findClosingParen(rawCode, dkOpen)
      if (dkClose === -1) continue
      const dkArg = rawCode.substring(dkOpen + 1, dkClose).trim()
      if (/^\d+$/.test(dkArg)) {
        duckTarget = parseInt(dkArg)
      } else {
        const strNum = dkArg.match(/["'](\d+)/)
        if (strNum) duckTarget = parseInt(strNum[1])
      }
      break
    }

    // Detect drum/percussion source (eligible for sidechain)
    const DRUM_PATTERN = /^(bd|kick|bassdrum|sd|snare|cp|clap|hh|oh|rim|tom|ride|crash|perc|cymbal)$/i
    const channelNameClean = (start.name || '').replace(/[^a-zA-Z]/g, '').toLowerCase()
    const isKickLike = DRUM_PATTERN.test(source.replace(/[^a-zA-Z]/g, ''))
      || DRUM_PATTERN.test(channelNameClean)
      || (sourceType === 'stack' && /s\(\s*"[^"]*(?:bd|kick|sd|snare|cp|clap|hh|oh|rim)/.test(rawCode))
      || (sourceType === 'sample' && /s\(\s*"[^"]*(?:bd|kick|sd|snare|cp|clap|hh|oh|rim|tom|ride|crash|perc|cymbal)/.test(rawCode))

    // Extract bank
    let bank: string | undefined
    const bankMatch = rawCode.match(/\.bank\(\s*"([^"]*)"/) 
    if (bankMatch) bank = bankMatch[1]

    // Check if source is simple (single word or word:variant, swappable via dropdown)
    let isSimpleSource = false
    const sFullMatch = rawCode.match(/\.?s\(\s*"([^"]*)"/) 
    if (sFullMatch) {
      // Accept single words (bd, hh), variant syntax (bd:2), and mini-notation modifiers (bd!4, hh*8, bd:2!4)
      isSimpleSource = /^[a-zA-Z_][a-zA-Z0-9_]*(:\d+)?([!*]\d+)?$/.test(sFullMatch[1].trim())
    }

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
      bank,
      isSimpleSource,
      duckTarget,
      isKickLike,
      blockType: start.blockType,
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
      // Replace block with silence — use correct syntax for block type
      if (ch.blockType === 'let') {
        outputLines.push(`let ${ch.name} = silence`)
      } else {
        const prefix = ch.name ? `$${ch.name}` : '$'
        outputLines.push(`${prefix}: silence`)
      }
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

// ═══════════════════════════════════════════════════════════════
//  swapSoundInChannel — Replace s("old") with s("new")
//  Works for simple sources (single word / word:variant) and
//  also for complex patterns (replaces entire s() content).
// ═══════════════════════════════════════════════════════════════

export function swapSoundInChannel(
  code: string,
  channelIdx: number,
  newSound: string,
): string {
  const channels = parseStrudelCode(code)
  const ch = channels[channelIdx]
  if (!ch) return code

  const sMatch = ch.rawCode.match(/\.?s\(\s*"([^"]*)"/) 
  if (!sMatch || sMatch.index === undefined) return code

  const content = sMatch[1] // e.g. "bd!4" or "hh*8" or "bd:2"
  // Extract just the base instrument name (before any :N !N *N modifiers)
  const baseMatch = content.match(/^([a-zA-Z_][a-zA-Z0-9_]*)/)
  if (!baseMatch) return code

  const baseName = baseMatch[1]
  const modifiers = content.slice(baseName.length) // e.g. "!4", ":2!4", "*8"

  // Replace the content inside s("...") with new sound + preserved modifiers
  const quotePos = sMatch[0].indexOf('"')
  const nameStartInRaw = sMatch.index + quotePos + 1
  const nameEndInRaw = nameStartInRaw + sMatch[1].length

  const nameStart = ch.blockStart + nameStartInRaw
  const nameEnd = ch.blockStart + nameEndInRaw

  return code.substring(0, nameStart) + newSound + modifiers + code.substring(nameEnd)
}

// ═══════════════════════════════════════════════════════════════
//  swapBankInChannel — Replace .bank("old") with .bank("new")
//  If no bank exists, appends .bank("new") after s("...")
// ═══════════════════════════════════════════════════════════════

export function swapBankInChannel(
  code: string,
  channelIdx: number,
  newBank: string,
): string {
  const channels = parseStrudelCode(code)
  const ch = channels[channelIdx]
  if (!ch) return code

  const bankMatch = ch.rawCode.match(/\.bank\(\s*"([^"]*)"/) 
  if (bankMatch && bankMatch.index !== undefined) {
    // Replace existing bank name
    const quotePos = bankMatch[0].indexOf('"')
    const nameStartInRaw = bankMatch.index + quotePos + 1
    const nameEndInRaw = nameStartInRaw + bankMatch[1].length

    const nameStart = ch.blockStart + nameStartInRaw
    const nameEnd = ch.blockStart + nameEndInRaw

    return code.substring(0, nameStart) + newBank + code.substring(nameEnd)
  } else {
    // No existing bank — insert .bank("X") after s("...")
    const sMatch = ch.rawCode.match(/\.?s\(\s*"[^"]*"\s*\)/)
    if (sMatch && sMatch.index !== undefined) {
      const insertPos = ch.blockStart + sMatch.index + sMatch[0].length
      return code.substring(0, insertPos) + `.bank("${newBank}")` + code.substring(insertPos)
    }
    return code
  }
}

// ═══════════════════════════════════════════════════════════════
//  addSoundToChannel — Convert a simple s() channel into a stack
//  e.g. s("bd!4").gain(.8) → stack(s("bd!4"), s("hh*8")).gain(.8)
//  If already a stack, appends a new s() entry inside the stack()
// ═══════════════════════════════════════════════════════════════

export function addSoundToChannel(
  code: string,
  channelIdx: number,
  newSound: string,
): string {
  const channels = parseStrudelCode(code)
  const ch = channels[channelIdx]
  if (!ch) return code

  if (ch.sourceType === 'stack') {
    // Already a stack — find closing paren of stack(...) and insert before it
    const stackOpenMatch = ch.rawCode.match(/stack\s*\(/)
    if (!stackOpenMatch || stackOpenMatch.index === undefined) return code

    const openIdx = stackOpenMatch.index + stackOpenMatch[0].length - 1
    const closeIdx = findClosingParen(ch.rawCode, openIdx)
    if (closeIdx === -1) return code

    // Insert new sound before the closing paren
    const insertPos = ch.blockStart + closeIdx
    const newEntry = `,\n  s("${newSound}")`
    return code.substring(0, insertPos) + newEntry + code.substring(insertPos)
  }

  // Simple source — wrap s("...") call (including .bank() if any) in stack()
  // Find the s("...") call, optionally followed by .bank("...")
  const sCallRegex = /\.?s\(\s*"[^"]*"\s*\)(?:\s*\.bank\(\s*"[^"]*"\s*\))?/
  const sCallMatch = ch.rawCode.match(sCallRegex)
  if (!sCallMatch || sCallMatch.index === undefined) return code

  const sCallStart = ch.blockStart + sCallMatch.index
  const sCallEnd = sCallStart + sCallMatch[0].length
  const existingCall = sCallMatch[0].startsWith('.') ? sCallMatch[0].slice(1) : sCallMatch[0]

  const replacement = `stack(\n  ${existingCall},\n  s("${newSound}")\n)`
  // If the original had a leading dot (from chaining), add it back
  const prefix = sCallMatch[0].startsWith('.') ? '.' : ''

  return code.substring(0, sCallStart) + prefix + replacement + code.substring(sCallEnd)
}

// ═══════════════════════════════════════════════════════════════
//  Sidechain / Duck routing utilities
// ═══════════════════════════════════════════════════════════════

/** Remove a specific effect call (e.g., .duck(2)) from a channel's code */
export function removeEffectFromChannel(
  code: string,
  channelIdx: number,
  effectKey: string,
): string {
  const channels = parseStrudelCode(code)
  const ch = channels[channelIdx]
  if (!ch) return code

  const lines = code.split('\n')
  const effectRegex = new RegExp(`\\.${effectKey}\\(`)
  const result: string[] = []

  for (let i = 0; i < lines.length; i++) {
    if (i >= ch.lineStart && i < ch.lineEnd) {
      const line = lines[i]
      if (line.trimStart().startsWith('//')) { result.push(line); continue }
      const matchInLine = line.match(effectRegex)
      if (matchInLine && matchInLine.index !== undefined) {
        const openP = matchInLine.index + matchInLine[0].length - 1
        const closeP = findClosingParen(line, openP)
        if (closeP !== -1) {
          const before = line.substring(0, matchInLine.index)
          const after = line.substring(closeP + 1)
          const remaining = (before + after).trim()
          if (remaining) {
            const indent = line.match(/^(\s*)/)?.[1] || ''
            result.push(indent + remaining)
          }
          continue
        }
      }
    }
    result.push(lines[i])
  }

  return result.join('\n')
}

/** Find the next unused orbit number across all channels */
export function findNextFreeOrbit(channels: ParsedChannel[]): number {
  const used = new Set<number>([0])
  for (const ch of channels) {
    if (ch.duckTarget !== null) used.add(ch.duckTarget)
    const orbitP = ch.params.find(p => p.key === 'orbit')
    if (orbitP) used.add(Math.round(orbitP.value))
  }
  for (let i = 1; i <= 11; i++) {
    if (!used.has(i)) return i
  }
  return 1
}

/** Set or update .orbit(N) on a channel */
export function setChannelOrbit(
  code: string,
  channelIdx: number,
  orbit: number,
): string {
  const channels = parseStrudelCode(code)
  const ch = channels[channelIdx]
  if (!ch) return code

  const orbitParam = ch.params.find(p => p.key === 'orbit')
  if (orbitParam) {
    return updateParamInCode(code, channelIdx, 'orbit', orbit)
  }
  return insertEffectInChannel(code, channelIdx, `.orbit(${orbit})`)
}

/** Enable sidechain on a source channel: adds .duck(N), .duckdepth(.5), .duckattack(.1) */
export function enableSidechain(
  code: string,
  sourceIdx: number,
  targetOrbit: number,
): string {
  let result = insertEffectInChannel(code, sourceIdx, `.duck(${targetOrbit})`)
  let chs = parseStrudelCode(result)
  if (chs[sourceIdx] && !chs[sourceIdx].params.find(p => p.key === 'duckdepth')) {
    result = insertEffectInChannel(result, sourceIdx, `.duckdepth(.5)`)
  }
  chs = parseStrudelCode(result)
  if (chs[sourceIdx] && !chs[sourceIdx].params.find(p => p.key === 'duckattack')) {
    result = insertEffectInChannel(result, sourceIdx, `.duckattack(.1)`)
  }
  return result
}

/** Disable sidechain on a source: removes .duck, .duckdepth, .duckattack */
export function disableSidechain(code: string, sourceIdx: number): string {
  let result = removeEffectFromChannel(code, sourceIdx, 'duckattack')
  result = removeEffectFromChannel(result, sourceIdx, 'duckdepth')
  result = removeEffectFromChannel(result, sourceIdx, 'duck')
  return result
}

// ═══════════════════════════════════════════════════════════════
//  Channel Renaming — update $name: prefix in code
// ═══════════════════════════════════════════════════════════════

/** Rename a channel by updating its $oldName: prefix to $newName: in the code.
 *  Sanitizes the new name to contain only word chars. */
export function renameChannel(code: string, channelIdx: number, newName: string): string {
  // Sanitize: only word characters (a-z, 0-9, _), lowercase, max 12 chars
  const sanitized = newName.replace(/[^\w]/g, '').toLowerCase().slice(0, 12)
  if (!sanitized) return code // Don't allow empty names

  const channels = parseStrudelCode(code)
  if (channelIdx < 0 || channelIdx >= channels.length) return code

  const ch = channels[channelIdx]
  const lines = code.split('\n')
  const line = lines[ch.lineStart]
  if (!line) return code

  if (ch.blockType === 'let') {
    // Match the let varName = pattern at the start of the line
    const m = line.match(/^(\s*)let\s+(\w+)\s*=\s*/)
    if (!m) return code
    const indent = m[1]
    const oldPrefix = m[0]
    const newPrefix = `${indent}let ${sanitized} = `
    lines[ch.lineStart] = line.replace(oldPrefix, newPrefix)
  } else {
    // Match the $name: pattern at the start of the line
    const m = line.match(/^(\s*)\$(\w*):\s*/)
    if (!m) return code
    const indent = m[1]
    const oldPrefix = m[0]
    const newPrefix = `${indent}$${sanitized}: `
    lines[ch.lineStart] = line.replace(oldPrefix, newPrefix)
  }
  return lines.join('\n')
}

// ═══════════════════════════════════════════════════════════════
//  Global Project Utilities — Tempo, Scale, Metronome
// ═══════════════════════════════════════════════════════════════

/** Parse BPM from setCps(BPM/60/4) — returns BPM or null */
export function parseBPM(code: string): number | null {
  // Match: setCps(140/60/4) or setcps( 92 / 60 / 4 ) — case-insensitive
  const m = code.match(/set[Cc]ps\(\s*(\d+(?:\.\d+)?)\s*\/\s*60\s*\/\s*4\s*\)/)
  if (m) return parseFloat(m[1])
  // Match: setCps(0.583) etc — direct CPS value
  const m2 = code.match(/set[Cc]ps\(\s*(\d+(?:\.\d+)?)\s*\)/)
  if (m2) {
    const cps = parseFloat(m2[1])
    if (cps < 10) return Math.round(cps * 60 * 4) // Convert CPS to BPM
    return cps // Already BPM (unlikely but handle)
  }
  return null
}

/** Update BPM in setCps(...) call — replaces the numeric arg */
export function updateBPM(code: string, newBPM: number): string {
  // Replace setCps(OLD/60/4) with setCps(NEW/60/4) — case-insensitive match
  const m = code.match(/set[Cc]ps\(\s*(\d+(?:\.\d+)?)\s*\/\s*60\s*\/\s*4\s*\)/)
  if (m && m.index !== undefined) {
    const before = code.substring(0, m.index)
    const after = code.substring(m.index + m[0].length)
    return before + `setCps(${newBPM}/60/4)` + after
  }
  // Replace setCps(CPS) with setCps(NEW/60/4) for direct CPS values
  const m2 = code.match(/set[Cc]ps\(\s*\d+(?:\.\d+)?\s*\)/)
  if (m2 && m2.index !== undefined) {
    const before = code.substring(0, m2.index)
    const after = code.substring(m2.index + m2[0].length)
    return before + `setCps(${newBPM}/60/4)` + after
  }
  // No setCps found — prepend one
  return `setCps(${newBPM}/60/4)\n\n` + code
}

// ─── Scale intervals & note remapping ───

const CHROMATIC_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const STRUDEL_NOTE_MAP_PARSER: Record<string, number> = {
  'c': 0, 'cs': 1, 'db': 1, 'd': 2, 'ds': 3, 'eb': 3,
  'e': 4, 'fb': 4, 'f': 5, 'es': 5, 'fs': 6, 'gb': 6,
  'g': 7, 'gs': 8, 'ab': 8, 'a': 9, 'as': 10, 'bb': 10,
  'b': 11, 'cb': 11, 'bs': 0,
}
const STRUDEL_NOTE_NAMES_PARSER = ['c', 'cs', 'd', 'ds', 'e', 'f', 'fs', 'g', 'gs', 'a', 'as', 'b']

export const SCALE_INTERVALS: Record<string, number[]> = {
  major:              [0, 2, 4, 5, 7, 9, 11],
  minor:              [0, 2, 3, 5, 7, 8, 10],
  dorian:             [0, 2, 3, 5, 7, 9, 10],
  phrygian:           [0, 1, 3, 5, 7, 8, 10],
  lydian:             [0, 2, 4, 6, 7, 9, 11],
  mixolydian:         [0, 2, 4, 5, 7, 9, 10],
  locrian:            [0, 1, 3, 5, 6, 8, 10],
  'minor pentatonic': [0, 3, 5, 7, 10],
  'pentatonic':       [0, 2, 4, 7, 9],
  blues:              [0, 3, 5, 6, 7, 10],
  'harmonic minor':   [0, 2, 3, 5, 7, 8, 11],
  'melodic minor':    [0, 2, 3, 5, 7, 9, 11],
  'harmonic major':   [0, 2, 4, 5, 7, 8, 11],
  'whole tone':       [0, 2, 4, 6, 8, 10],
  diminished:         [0, 2, 3, 5, 6, 8, 9, 11],
  chromatic:          [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  'phrygian dominant':[0, 1, 4, 5, 7, 8, 10],
  'double harmonic major': [0, 1, 4, 5, 7, 8, 11],
  'hungarian minor':  [0, 2, 3, 6, 7, 8, 11],
  japanese:           [0, 1, 5, 7, 8],
  bebop:              [0, 2, 4, 5, 7, 9, 10, 11],
}

/** Parse a Strudel note name like "d3", "fs4", "eb2" → MIDI number */
function strudelNoteToMidiParser(name: string): number | null {
  const m = name.trim().toLowerCase().match(/^([a-g])([#sb]?)(\d+)$/)
  if (!m) return null
  let accidental = m[2]
  if (accidental === '#') accidental = 's'
  const key = m[1] + (accidental === 's' || accidental === 'b' ? accidental : '')
  const semitone = STRUDEL_NOTE_MAP_PARSER[key]
  if (semitone === undefined) return null
  return (parseInt(m[3]) + 1) * 12 + semitone
}

/** Convert MIDI number → Strudel note name (e.g. 60 → "c4") */
function midiToStrudelNoteParser(midi: number): string {
  const name = STRUDEL_NOTE_NAMES_PARSER[midi % 12]
  const oct = Math.floor(midi / 12) - 1
  return `${name}${oct}`
}

/** Build the set of all MIDI notes in a scale across full range */
function buildScaleMidiSet(root: string, mode: string): Set<number> {
  const intervals = SCALE_INTERVALS[mode] || SCALE_INTERVALS.minor
  const rootIdx = CHROMATIC_NAMES.indexOf(root.charAt(0).toUpperCase() + root.slice(1))
  const adjustedRoot = rootIdx >= 0 ? rootIdx : 0
  const set = new Set<number>()
  for (let oct = 0; oct <= 9; oct++) {
    for (const iv of intervals) {
      const midi = (oct + 1) * 12 + adjustedRoot + iv
      if (midi >= 0 && midi <= 127) set.add(midi)
    }
  }
  return set
}

/** Snap a MIDI note to the closest note in the given scale */
function snapMidiToScale(midi: number, scaleSet: Set<number>): number {
  if (scaleSet.has(midi)) return midi
  // Search outward from midi ±1, ±2, ... until we find one in the scale
  for (let d = 1; d <= 12; d++) {
    if (scaleSet.has(midi + d)) return midi + d
    if (scaleSet.has(midi - d)) return midi - d
  }
  return midi // fallback
}

/**
 * Remap all note() patterns in code to fit a new scale.
 * Finds every note name (like c3, fs4, eb2) inside note("...") calls
 * and snaps each to the closest note in the target scale.
 * Preserves rests (~), octaves, and pattern structure.
 */
export function remapNoteNamesToScale(code: string, newRoot: string, newScale: string): string {
  const scaleSet = buildScaleMidiSet(newRoot, newScale)

  // Match note("...") patterns — including multi-line and brackets
  return code.replace(/\bnote\(\s*"([^"]+)"\s*\)/g, (fullMatch, inner: string) => {
    // Remap each note name token inside the pattern string
    const remapped = inner.replace(/\b([a-g])([sb#]?)(\d+)\b/gi, (_m, letter: string, acc: string, octStr: string) => {
      const original = `${letter}${acc}${octStr}`
      const midi = strudelNoteToMidiParser(original)
      if (midi === null) return original // not a valid note, leave it
      const snapped = snapMidiToScale(midi, scaleSet)
      return midiToStrudelNoteParser(snapped)
    })
    return `note("${remapped}")`
  })
}

/** All Strudel scales */
export const STRUDEL_SCALES: { group: string; scales: [string, string][] }[] = [
  { group: 'Major/Minor', scales: [
    ['major', 'Major (Ionian)'], ['minor', 'Minor (Aeolian)'],
    ['dorian', 'Dorian'], ['phrygian', 'Phrygian'],
    ['lydian', 'Lydian'], ['mixolydian', 'Mixolydian'],
    ['locrian', 'Locrian'],
  ]},
  { group: 'Pentatonic', scales: [
    ['pentatonic', 'Pentatonic Major'], ['minor pentatonic', 'Pentatonic Minor'],
    ['blues', 'Blues'],
  ]},
  { group: 'Harmonic/Melodic', scales: [
    ['harmonic minor', 'Harmonic Minor'], ['melodic minor', 'Melodic Minor'],
    ['harmonic major', 'Harmonic Major'],
  ]},
  { group: 'Exotic', scales: [
    ['whole tone', 'Whole Tone'], ['diminished', 'Diminished'],
    ['chromatic', 'Chromatic'], ['phrygian dominant', 'Phrygian Dominant'],
    ['double harmonic major', 'Double Harmonic'], ['hungarian minor', 'Hungarian Minor'],
    ['japanese', 'Japanese'], ['bebop', 'Bebop'],
  ]},
]

/** Root notes for scale selector */
export const SCALE_ROOTS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B',
  'Db', 'Eb', 'Gb', 'Ab', 'Bb'] as const

/** Parse the first .scale("ROOT:SCALE") in the code */
export function parseScale(code: string): { root: string; scale: string; full: string } | null {
  const m = code.match(/\.scale\(\s*"([^"]+)"\s*\)/)
  if (!m) return null
  const full = m[1]
  const parts = full.split(':')
  if (parts.length >= 2) {
    // Root may include octave number: "C4:minor" → root=C, scale=minor
    const rootRaw = parts[0].replace(/\d+$/, '')
    return { root: rootRaw || 'C', scale: parts.slice(1).join(':'), full }
  }
  return { root: 'C', scale: full, full }
}

/** Update all .scale("...") calls in code to new root:scale AND remap note() names */
export function updateScale(code: string, newRoot: string, newScale: string): string {
  // 1. Replace all .scale("anything") preserving octave numbers where present
  let result = code.replace(/\.scale\(\s*"([^"]+)"\s*\)/g, (_match, oldFull: string) => {
    const parts = oldFull.split(':')
    if (parts.length >= 2) {
      // Preserve octave: "C4:minor" → "D4:dorian"
      const octaveMatch = parts[0].match(/(\d+)$/)
      const octave = octaveMatch ? octaveMatch[1] : ''
      return `.scale("${newRoot}${octave}:${newScale}")`
    }
    return `.scale("${newRoot}:${newScale}")`
  })
  // 2. Remap all note() patterns to fit the new scale
  result = remapNoteNamesToScale(result, newRoot, newScale)
  return result
}

/** Insert .scale("root:scale") on the first note/synth channel that uses n()/note() */
export function insertScale(code: string, root: string, scale: string): string {
  // Find first channel that has n( or note( — those benefit most from .scale()
  const notePatterns = [/\.n\(/, /\.note\(/]
  for (const pat of notePatterns) {
    const match = pat.exec(code)
    if (match) {
      // Find the end of the line containing this pattern
      const lineEnd = code.indexOf('\n', match.index)
      if (lineEnd === -1) return code + `.scale("${root}:${scale}")`
      return code.slice(0, lineEnd) + `.scale("${root}:${scale}")` + code.slice(lineEnd)
    }
  }
  // Fallback: add to the first channel line ($name:)
  const channelMatch = /(\$\w*:\s*[^\n]+)/.exec(code)
  if (channelMatch) {
    const insertAt = channelMatch.index + channelMatch[0].length
    return code.slice(0, insertAt) + `.scale("${root}:${scale}")` + code.slice(insertAt)
  }
  return code
}

/** Generate a metronome channel code string for a given BPM */
export function generateMetronomeCode(bpm: number): string {
  // Simple click on each beat — high-pitched sound, low volume
  // Uses a rimshot or woodblock-like sound that's audible but not intrusive
  return `\n$_metro: s("rim*4").gain(.15).speed(3).hpf(4000).lpf(8000).orbit(11)\n`
}

// ─── Channel Pattern extraction / replacement ───

/**
 * Extract the mini-notation pattern string from a channel.
 * Looks for n("..."), note("..."), or the pattern inside s("...").
 * Returns null if the pattern uses generative expressions (irand, perlin, etc.)
 * or if no recognizable pattern is found.
 */
export function parseChannelPattern(channel: ParsedChannel): {
  pattern: string
  type: 'n' | 'note' | 's'
  isGenerative: boolean
} | null {
  const raw = channel.rawCode

  // Try n("...") first
  const nMatch = raw.match(/\bn\s*\(/)
  if (nMatch) {
    const openIdx = raw.indexOf('(', nMatch.index!)
    const closeIdx = findClosingParen(raw, openIdx)
    if (closeIdx === -1) return null
    const argStr = raw.substring(openIdx + 1, closeIdx).trim()
    // Check if it's a quoted string pattern
    const quoted = argStr.match(/^"([^"]*)"$/)
    if (quoted) {
      return { pattern: quoted[1], type: 'n', isGenerative: false }
    }
    // It's a generative expression (irand, perlin, etc.)
    return { pattern: argStr, type: 'n', isGenerative: true }
  }

  // Try note("...")
  const noteMatch = raw.match(/\bnote\s*\(/)
  if (noteMatch) {
    const openIdx = raw.indexOf('(', noteMatch.index!)
    const closeIdx = findClosingParen(raw, openIdx)
    if (closeIdx === -1) return null
    const argStr = raw.substring(openIdx + 1, closeIdx).trim()
    const quoted = argStr.match(/^"([^"]*)"$/)
    if (quoted) {
      return { pattern: quoted[1], type: 'note', isGenerative: false }
    }
    return { pattern: argStr, type: 'note', isGenerative: true }
  }

  // For sample channels, the pattern is in s("...")
  const sMatch = raw.match(/\.?s\s*\(/)
  if (sMatch) {
    const openIdx = raw.indexOf('(', sMatch.index!)
    const closeIdx = findClosingParen(raw, openIdx)
    if (closeIdx === -1) return null
    const argStr = raw.substring(openIdx + 1, closeIdx).trim()
    const quoted = argStr.match(/^"([^"]*)"$/)
    if (quoted) {
      return { pattern: quoted[1], type: 's', isGenerative: false }
    }
  }

  return null
}

/**
 * Replace the pattern inside a channel's n() or note() call.
 * If the channel uses generative expressions (irand, perlin, etc.),
 * replaces the entire expression with the new static pattern.
 * If the channel doesn't have n() or note(), inserts a note() call.
 */
export function replaceChannelPattern(
  code: string,
  channelIdx: number,
  newPattern: string,
  patternType: 'n' | 'note' = 'n'
): string {
  const channels = parseStrudelCode(code)
  const ch = channels[channelIdx]
  if (!ch) return code

  const raw = ch.rawCode
  const methodRegex = patternType === 'note'
    ? /\bnote\s*\(/
    : /\bn\s*\(/

  const match = raw.match(methodRegex)
  if (!match) {
    // Channel doesn't have n() or note() — try the other type as fallback
    const fallbackRegex = patternType === 'note'
      ? /\bn\s*\(/
      : /\bnote\s*\(/
    const fallbackMatch = raw.match(fallbackRegex)
    if (fallbackMatch) {
      // Found the other pattern method — use it instead
      const openIdx = raw.indexOf('(', fallbackMatch.index!)
      const closeIdx = findClosingParen(raw, openIdx)
      if (closeIdx === -1) return code
      const newRaw = raw.substring(0, openIdx + 1) + `"${newPattern}"` + raw.substring(closeIdx)
      return code.substring(0, ch.blockStart) + newRaw + code.substring(ch.blockEnd)
    }

    // Neither n() nor note() found — insert note() after any .s() call or at chain start
    const sCall = raw.match(/\.s\(\s*"[^"]*"\s*\)/)
    let insertPos: number
    if (sCall) {
      insertPos = sCall.index! + sCall[0].length
    } else {
      // Insert after "$name:" declaration
      const declMatch = raw.match(/^\s*\$\w*:\s*/)
      insertPos = declMatch ? declMatch[0].length : 0
    }
    const method = patternType === 'note' ? 'note' : 'n'
    const newRaw = raw.substring(0, insertPos) + `.${method}("${newPattern}")` + raw.substring(insertPos)
    return code.substring(0, ch.blockStart) + newRaw + code.substring(ch.blockEnd)
  }

  const openIdx = raw.indexOf('(', match.index!)
  const closeIdx = findClosingParen(raw, openIdx)
  if (closeIdx === -1) return code

  // Build new raw code: replace the contents of n(...) or note(...)
  const newRaw = raw.substring(0, openIdx + 1) + `"${newPattern}"` + raw.substring(closeIdx)

  // Replace in the full code
  return code.substring(0, ch.blockStart) + newRaw + code.substring(ch.blockEnd)
}

/** Replace an entire channel block with new raw code */
export function replaceChannelBlock(
  code: string,
  channelIdx: number,
  newRawCode: string,
): string {
  const channels = parseStrudelCode(code)
  const ch = channels[channelIdx]
  if (!ch) return code
  return code.substring(0, ch.blockStart) + newRawCode + code.substring(ch.blockEnd)
}

// ═══════════════════════════════════════════════════════════════
//  Reset Channel — strip effects & patterns, keep name + source
// ═══════════════════════════════════════════════════════════════

/** Reset a channel to a bare skeleton: keeps $name, source instrument,
 *  orbit, scope, and scale. Removes all effects, patterns, and params. */
export function resetChannel(code: string, channelIdx: number): string {
  const channels = parseStrudelCode(code)
  if (channelIdx < 0 || channelIdx >= channels.length) return code

  const ch = channels[channelIdx]
  const raw = ch.rawCode

  // Extract orbit number (keep it)
  const orbitMatch = raw.match(/\.orbit\(\s*(\d+)\s*\)/)
  const orbit = orbitMatch ? orbitMatch[1] : '0'

  // Extract scale if present (keep it)
  const scaleMatch = raw.match(/\.scale\(\s*"([^"]*)"\s*\)/)
  const scaleStr = scaleMatch ? scaleMatch[1] : null

  // Detect source instrument from .s("...")
  const sMatch = raw.match(/\.?s\(\s*"([^"]*)"\s*\)/)
  const instrument = sMatch ? sMatch[1] : null

  // Detect if it was a note/melodic channel
  const isNoteChannel = ch.sourceType === 'synth' || ch.sourceType === 'note'

  // Build clean skeleton
  let skeleton: string
  if (isNoteChannel && instrument) {
    skeleton = `$${ch.name}: note("~")\n  .s("${instrument}")\n  .gain(0.5)\n  .orbit(${orbit})._scope()`
  } else if (isNoteChannel) {
    skeleton = `$${ch.name}: note("~")\n  .gain(0.5)\n  .orbit(${orbit})._scope()`
  } else if (ch.sourceType === 'stack') {
    // Reset stack to a simple sample channel
    skeleton = `$${ch.name}: s("~")\n  .gain(0.8)\n  .orbit(${orbit})._scope()`
  } else {
    const src = instrument || 'bd'
    skeleton = `$${ch.name}: s("${src}")\n  .gain(0.8)\n  .orbit(${orbit})._scope()`
  }

  // Re-attach scale if it existed
  if (scaleStr) {
    skeleton += `\n  .scale("${scaleStr}")`
  }

  return replaceChannelBlock(code, channelIdx, skeleton)
}

// ═══════════════════════════════════════════════════════════════
//  Channel Duplication — clone a channel block with a new name
// ═══════════════════════════════════════════════════════════════

/** Duplicate a channel by copying its code block and inserting it
 *  right after the original with a unique name suffix. */
export function duplicateChannel(code: string, channelIdx: number): string {
  const channels = parseStrudelCode(code)
  if (channelIdx < 0 || channelIdx >= channels.length) return code

  const ch = channels[channelIdx]
  const existingNames = new Set(channels.map(c => c.name))

  // Generate a unique name: append 2, 3, 4... until unused
  let suffix = 2
  let newName = ch.name + suffix
  while (existingNames.has(newName)) {
    suffix++
    newName = ch.name + suffix
  }

  // Get the raw block and convert to a $name: block so the duplicate plays
  // independently. `let` variables are only references — they need to be wired
  // into arrange() to play. Converting to $name: makes the clone self-contained.
  let duplicatedBlock = ch.rawCode
  if (ch.blockType === 'let') {
    // Strip `let varName =\n` (which may span the first line with content on the next)
    const letMatch = duplicatedBlock.match(/^(\s*)let\s+\w+\s*=\s*\n?/)
    if (letMatch) {
      duplicatedBlock = duplicatedBlock.slice(letMatch[0].length)
      // Remove leading whitespace on the first remaining line so it sits flush
      duplicatedBlock = duplicatedBlock.replace(/^\s+/, '')
    }
    duplicatedBlock = `$${newName}: ${duplicatedBlock}`
  } else {
    const nameMatch = duplicatedBlock.match(/^(\s*)\$(\w+):\s*/)
    if (nameMatch) {
      duplicatedBlock = duplicatedBlock.replace(
        nameMatch[0],
        `${nameMatch[1]}$${newName}: `
      )
    }
  }

  // Insert after the original channel block with a blank line separator
  const before = code.substring(0, ch.blockEnd)
  const after = code.substring(ch.blockEnd)
  return before + '\n\n' + duplicatedBlock + after
}

// ═══════════════════════════════════════════════════════════════
//  Add Channel — append a new $name: block to the code
// ═══════════════════════════════════════════════════════════════

/** Add a new channel to the code with a given sound/synth source.
 *  Generates a unique name and appends at the end of all channels.
 *  type='vocal' generates a vocal/sample channel with loopAt for tempo-synced playback.
 *  sampleBpm/projectBpm: when both known, calculates pitch shift and adds .speed() compensation. */
export function addChannel(
  code: string,
  soundName: string,
  type: 'synth' | 'sample' | 'vocal' = 'sample',
  vocalLoopAt?: number,
  sampleBpm?: number,
  projectBpm?: number,
): string {
  const channels = parseStrudelCode(code)
  const existingNames = new Set(channels.map(c => c.name))

  // Generate a unique channel name based on the sound
  const baseName = soundName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase().slice(0, 8) || 'ch'
  let name = baseName
  let suffix = 2
  while (existingNames.has(name)) {
    name = baseName + suffix
    suffix++
  }

  // Find next free orbit
  const nextOrbit = findNextFreeOrbit(channels)

  // Build the code block with starter effects
  let block: string
  if (type === 'synth') {
    block = `$${name}: note("c3 e3 g3 c4")\n  .s("${soundName}")\n  .gain(0.5)\n  .lpf(4000).lpq(2)\n  .room(0.3).delay(0.15).delaytime(0.125).delayfeedback(0.3)\n  .shape(0)`
  } else if (type === 'vocal') {
    // Vocal/long sample channel — tempo-synced via loopAt
    const loopCycles = vocalLoopAt ?? 8
    // Calculate pitch shift from BPM mismatch
    let pitchInfo = ''
    let speedCompensation = ''
    if (sampleBpm && projectBpm && sampleBpm !== projectBpm) {
      const shift = 12 * Math.log2(projectBpm / sampleBpm)
      pitchInfo = ` // sample: ${sampleBpm}bpm → ${shift > 0 ? '+' : ''}${shift.toFixed(1)}st`
      // Add .speed() to compensate pitch (counter the loopAt speed change)
      // compensationSpeed = sampleBpm / projectBpm cancels the pitch shift from tempo change
      const comp = sampleBpm / projectBpm
      speedCompensation = `\n  .speed(${comp.toFixed(4)})${pitchInfo}`
    }
    block = `$${name}: s("${soundName}")\n  .loopAt(${loopCycles})${speedCompensation}\n  .gain(0.7)\n  .orbit(${nextOrbit})\n  .room(0.15).delay(0.1).delaytime(0.125).delayfeedback(0.2)`
  } else {
    block = `$${name}: s("${soundName}")\n  .gain(0.8)\n  .lpf(6000).lpq(1)\n  .room(0.2).delay(0.1).delaytime(0.125).delayfeedback(0.2)\n  .shape(0)`
  }

  // Append after the last channel or at the end
  const trimmed = code.trimEnd()
  return trimmed + '\n\n' + block
}

// ═══════════════════════════════════════════════════════════════
//  Remove Channel — delete a $name: block from the code
// ═══════════════════════════════════════════════════════════════

/** Remove a channel block by index. Falls back to returning code unchanged. */
export function removeChannel(code: string, channelIdx: number): string {
  const channels = parseStrudelCode(code)
  if (channelIdx < 0 || channelIdx >= channels.length) return code

  const ch = channels[channelIdx]
  // Remove from blockStart to blockEnd (the full $name: ... block)
  const before = code.slice(0, ch.blockStart)
  const after = code.slice(ch.blockEnd)

  // Clean up extra blank lines left behind
  let result = before.replace(/\n{2,}$/, '\n') + after.replace(/^\n{2,}/, '\n')
  // If result is empty or just whitespace, return empty
  if (result.trim() === '') result = ''
  return result
}

// ═══════════════════════════════════════════════════════════════
//  Stack Row Utilities — per-sub-pattern parsing & manipulation
// ═══════════════════════════════════════════════════════════════

export interface StackRow {
  instrument: string    // e.g. "bd", "hh", "sd"
  pattern: string       // full s() content, e.g. "bd bd ~ bd"
  bank?: string         // e.g. "RolandTR808"
  gain: number          // per-row gain (1.0 if not set)
  hasOwnGain: boolean   // true if this row has its own .gain()
  /** char offset of this row's raw text within the full code string */
  rowStart: number
  rowEnd: number
  rawRow: string        // raw text of this sub-pattern
}

/** Split a string by top-level commas (respecting parens, brackets, and quotes).
 *  IMPORTANT: `start` aligns with the trimmed `text`, not the raw segment,
 *  so that regex match offsets on `text` can be directly added to `start`. */
function splitByTopLevelComma(str: string): { text: string; start: number; end: number }[] {
  const parts: { text: string; start: number; end: number }[] = []
  let depth = 0, segStart = 0
  for (let i = 0; i < str.length; i++) {
    const ch = str[i]
    if (ch === '(' || ch === '[' || ch === '<') depth++
    else if (ch === ')' || ch === ']' || ch === '>') depth--
    else if (ch === '"' || ch === "'") {
      const q = ch; i++
      while (i < str.length && str[i] !== q) { if (str[i] === '\\') i++; i++ }
    }
    else if (ch === ',' && depth === 0) {
      const rawSeg = str.substring(segStart, i)
      const t = rawSeg.trim()
      if (t) {
        // Align start with first non-whitespace char so regex offsets on `text` are correct
        const leading = rawSeg.length - rawSeg.trimStart().length
        parts.push({ text: t, start: segStart + leading, end: i })
      }
      segStart = i + 1
    }
  }
  const rawLast = str.substring(segStart)
  const last = rawLast.trim()
  if (last) {
    const leading = rawLast.length - rawLast.trimStart().length
    parts.push({ text: last, start: segStart + leading, end: str.length })
  }
  return parts
}

/** Parse the sub-patterns (rows) inside a stack() channel.
 *  Returns empty array if the channel is not a stack. */
export function parseStackRows(code: string, channelIdx: number): StackRow[] {
  const channels = parseStrudelCode(code)
  const ch = channels[channelIdx]
  if (!ch || ch.sourceType !== 'stack') return []

  const raw = ch.rawCode
  const stackMatch = raw.match(/stack\s*\(/)
  if (!stackMatch || stackMatch.index === undefined) return []

  const openIdx = raw.indexOf('(', stackMatch.index)
  const closeIdx = findClosingParen(raw, openIdx)
  if (closeIdx === -1) return []

  const stackBody = raw.substring(openIdx + 1, closeIdx)
  const bodyOffset = ch.blockStart + openIdx + 1

  const parts = splitByTopLevelComma(stackBody)
  const rows: StackRow[] = []

  for (const part of parts) {
    const sMatch = part.text.match(/s\(\s*"([^"]+)"/)
    if (!sMatch) continue

    const fullPattern = sMatch[1]
    // Extract instrument name (first word that's not 'silence' or '~')
    const words = fullPattern.match(/\b([a-zA-Z_][a-zA-Z0-9_]*)\b/g)
    let instrument = 'perc'
    if (words) {
      for (const w of words) {
        if (w !== 'silence') { instrument = w; break }
      }
    }

    const bankMatch = part.text.match(/\.bank\(\s*"([^"]*)"/)
    const gainMatch = part.text.match(/\.gain\(\s*([^)]+)\)/)
    let gain = 1.0
    let hasOwnGain = false
    if (gainMatch) {
      const v = extractValue(gainMatch[1])
      if (v !== null) { gain = v; hasOwnGain = true }
    }

    rows.push({
      instrument,
      pattern: fullPattern,
      bank: bankMatch?.[1],
      gain,
      hasOwnGain,
      rowStart: bodyOffset + part.start,
      rowEnd: bodyOffset + part.end,
      rawRow: part.text,
    })
  }

  return rows
}

/** Swap the sound instrument in a specific row of a stack channel.
 *  Replaces just the instrument name inside s("...") for that row. */
export function swapSoundInStackRow(
  code: string,
  channelIdx: number,
  rowIdx: number,
  newSound: string,
): string {
  const rows = parseStackRows(code, channelIdx)
  if (rowIdx < 0 || rowIdx >= rows.length) return code
  const row = rows[rowIdx]

  // Find s("...") in this row's raw text and replace instrument references
  const sMatch = row.rawRow.match(/s\(\s*"([^"]+)"/)
  if (!sMatch || sMatch.index === undefined) return code

  const oldPattern = sMatch[1]
  const oldInstrument = row.instrument

  // Replace all occurrences of the old instrument name with new one in the pattern
  const newPattern = oldPattern.replace(
    new RegExp(`\\b${oldInstrument}\\b`, 'g'),
    newSound
  )

  const quoteStart = sMatch.index + sMatch[0].indexOf('"') + 1
  const absoluteStart = row.rowStart + quoteStart
  const absoluteEnd = absoluteStart + oldPattern.length

  return code.substring(0, absoluteStart) + newPattern + code.substring(absoluteEnd)
}

/** Set or update the .gain() value on a specific row within a stack channel.
 *  If the row doesn't have .gain(), appends it after the s("...") or .bank("..."). */
export function setGainInStackRow(
  code: string,
  channelIdx: number,
  rowIdx: number,
  newGain: number,
): string {
  const rows = parseStackRows(code, channelIdx)
  if (rowIdx < 0 || rowIdx >= rows.length) return code
  const row = rows[rowIdx]

  const gainStr = newGain === 1 ? '1' : newGain.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')

  if (row.hasOwnGain) {
    // Replace existing .gain(...) value
    const gainMatch = row.rawRow.match(/\.gain\(\s*([^)]+)\)/)
    if (!gainMatch || gainMatch.index === undefined) return code

    const argStart = gainMatch.index + gainMatch[0].indexOf('(') + 1
    const argEnd = argStart + gainMatch[1].length
    const absStart = row.rowStart + argStart
    const absEnd = row.rowStart + argEnd

    return code.substring(0, absStart) + gainStr + code.substring(absEnd)
  } else {
    // Append .gain(X) after s("...") or .bank("...")
    const bankMatch = row.rawRow.match(/\.bank\(\s*"[^"]*"\s*\)/)
    const sMatch = row.rawRow.match(/s\(\s*"[^"]*"\s*\)/)
    let insertAfter: number

    if (bankMatch && bankMatch.index !== undefined) {
      insertAfter = row.rowStart + bankMatch.index + bankMatch[0].length
    } else if (sMatch && sMatch.index !== undefined) {
      insertAfter = row.rowStart + sMatch.index + sMatch[0].length
    } else {
      return code
    }

    return code.substring(0, insertAfter) + `.gain(${gainStr})` + code.substring(insertAfter)
  }
}

/** Set or update the .bank() on a specific row within a stack channel.
 *  If bank is empty string, removes existing .bank() from the row.
 *  If the row doesn't have .bank(), inserts it after s("..."). */
export function setBankInStackRow(
  code: string,
  channelIdx: number,
  rowIdx: number,
  newBank: string,
): string {
  const rows = parseStackRows(code, channelIdx)
  if (rowIdx < 0 || rowIdx >= rows.length) return code
  const row = rows[rowIdx]

  const bankMatch = row.rawRow.match(/\.bank\(\s*"([^"]*)"\s*\)/)

  if (bankMatch && bankMatch.index !== undefined) {
    if (!newBank) {
      // Remove existing .bank() entirely
      const absStart = row.rowStart + bankMatch.index
      const absEnd = absStart + bankMatch[0].length
      return code.substring(0, absStart) + code.substring(absEnd)
    }
    // Replace existing bank name
    const quoteStart = bankMatch.index + bankMatch[0].indexOf('"') + 1
    const absStart = row.rowStart + quoteStart
    const absEnd = absStart + bankMatch[1].length
    return code.substring(0, absStart) + newBank + code.substring(absEnd)
  }

  if (!newBank) return code // nothing to remove

  // No existing bank — insert .bank("X") after s("...")
  const sMatch = row.rawRow.match(/s\(\s*"[^"]*"\s*\)/)
  if (!sMatch || sMatch.index === undefined) return code

  const insertPos = row.rowStart + sMatch.index + sMatch[0].length
  return code.substring(0, insertPos) + `.bank("${newBank}")` + code.substring(insertPos)
}

/** Remove a sound row from a stack channel.
 *  If only 2 rows remain, un-wraps the stack back to a simple s() channel. */
export function removeSoundFromStack(
  code: string,
  channelIdx: number,
  rowIdx: number,
): string {
  const channels = parseStrudelCode(code)
  const ch = channels[channelIdx]
  if (!ch || ch.sourceType !== 'stack') return code

  const rows = parseStackRows(code, channelIdx)
  if (rowIdx < 0 || rowIdx >= rows.length) return code
  if (rows.length <= 1) return code // don't remove the last sound

  if (rows.length === 2) {
    // Un-wrap: stack(s("bd"), s("hh")).gain(.8) → s("bd").gain(.8)
    // Keep the row that's NOT being removed
    const keepIdx = rowIdx === 0 ? 1 : 0
    const keepRow = rows[keepIdx]

    const raw = ch.rawCode
    const stackMatch = raw.match(/stack\s*\(/)
    if (!stackMatch || stackMatch.index === undefined) return code

    const openIdx = raw.indexOf('(', stackMatch.index)
    const closeIdx = findClosingParen(raw, openIdx)
    if (closeIdx === -1) return code

    // The stack call including closing paren: stack(...)
    const stackCallStart = ch.blockStart + stackMatch.index
    const stackCallEnd = ch.blockStart + closeIdx + 1

    // What comes after the stack() call (e.g. .gain(.8).shape(.2))
    const afterStack = code.substring(stackCallEnd)

    return code.substring(0, stackCallStart) + keepRow.rawRow.trim() + afterStack
  }

  // More than 2 rows: remove the specified row and its comma
  // Find the comma that belongs to this row (before or after)
  const raw = ch.rawCode
  const stackMatch = raw.match(/stack\s*\(/)
  if (!stackMatch || stackMatch.index === undefined) return code

  const openIdx = raw.indexOf('(', stackMatch.index)
  const bodyOffset = ch.blockStart + openIdx + 1
  const closeIdx = findClosingParen(raw, openIdx)
  if (closeIdx === -1) return code

  const stackBody = raw.substring(openIdx + 1, closeIdx)
  const parts = splitByTopLevelComma(stackBody)

  if (rowIdx >= parts.length) return code

  // Rebuild stack body without the removed row
  const newParts = parts.filter((_, i) => i !== rowIdx)
  const newBody = newParts.map(p => p.text).join(',\n  ')
  const bodyStart = bodyOffset
  const bodyEnd = ch.blockStart + closeIdx

  return code.substring(0, bodyStart) + '\n  ' + newBody + '\n' + code.substring(bodyEnd)
}

// Backward compat aliases
// ═══════════════════════════════════════════════════════════════
//  Arpeggiator — mode detection & switching
// ═══════════════════════════════════════════════════════════════

export const ARP_MODES = [
  { id: 'off',     label: 'OFF',  icon: '⊘',  code: '' },
  { id: 'up',      label: 'UP',   icon: '↑',  code: '.arp("0 1 2 3")' },
  { id: 'down',    label: 'DN',   icon: '↓',  code: '.arp("3 2 1 0")' },
  { id: 'updown',  label: 'U/D',  icon: '↕',  code: '.arp("0 1 2 3 2 1")' },
  { id: 'skip',    label: 'SKP',  icon: '⤨',  code: '.arp("0 2 1 3")' },
  { id: 'spread',  label: 'SPR',  icon: '◇',  code: '.arp("0 3 1 2")' },
  { id: 'random',  label: 'RND',  icon: '🎲', code: '.arp(rand.range(0,3).segment(8))' },
] as const

/** Build the .arp(...) code string for a mode + rate */
function buildArpCode(mode: string, rate: number): string {
  if (mode === 'off') return ''
  const modeEntry = ARP_MODES.find(m => m.id === mode)
  if (!modeEntry) return ''

  if (mode === 'random') {
    // For random, rate controls segment count: faster = more segments per cycle
    return `.arp(rand.range(0,3).segment(${rate > 1 ? rate * 4 : 8}))`
  }

  // Extract base pattern string from mode definition
  const baseMatch = modeEntry.code.match(/\.arp\("([^"]+)"\)/)
  if (!baseMatch) return ''
  const basePattern = baseMatch[1]

  if (rate > 1) {
    return `.arp("[${basePattern}]*${rate}")`
  }
  return `.arp("${basePattern}")`
}

/** Detect arp mode AND rate from a channel's raw code */
export function getArpInfo(rawCode: string): { mode: string; rate: number } {
  const arpIdx = rawCode.search(/\.arp(eggiate)?\(/)
  if (arpIdx === -1) return { mode: 'off', rate: 1 }

  const fromArp = rawCode.substring(arpIdx)
  const openP = fromArp.indexOf('(')
  if (openP === -1) return { mode: 'off', rate: 1 }
  const absOpen = arpIdx + openP
  const absClose = findClosingParen(rawCode, absOpen)
  if (absClose === -1) return { mode: 'off', rate: 1 }

  const arg = rawCode.substring(absOpen + 1, absClose).trim()

  // Random mode — detect rate from segment count
  if (/rand/.test(arg)) {
    const segMatch = arg.match(/segment\((\d+)\)/)
    const seg = segMatch ? parseInt(segMatch[1]) : 8
    return { mode: 'random', rate: seg > 8 ? seg / 4 : 1 }
  }

  // Check for "[pattern]*N" rate encoding
  let rate = 1
  let cleaned = arg
  const rateMatch = arg.match(/^"\[([^\]]+)\]\s*\*\s*(\d+)"$/)
  if (rateMatch) {
    cleaned = rateMatch[1].trim()
    rate = parseInt(rateMatch[2])
  } else {
    // Plain "pattern" — strip quotes
    cleaned = arg.replace(/^"|"$/g, '').trim()
  }

  // Detect mode from base pattern
  if (/^0\s+1\s+2\s+3$/.test(cleaned)) return { mode: 'up', rate }
  if (/^3\s+2\s+1\s+0$/.test(cleaned)) return { mode: 'down', rate }
  if (/^0\s+1\s+2\s+3\s+2\s+1$/.test(cleaned)) return { mode: 'updown', rate }
  if (/^0\s+2\s+1\s+3$/.test(cleaned)) return { mode: 'skip', rate }
  if (/^0\s+3\s+1\s+2$/.test(cleaned)) return { mode: 'spread', rate }

  return { mode: 'up', rate } // Unknown defaults to up
}

/** Set (or remove) the arp mode on a channel. Preserves current rate. */
export function setArpMode(
  code: string,
  channelIdx: number,
  mode: string,
): string {
  const channels = parseStrudelCode(code)
  const ch = channels[channelIdx]
  if (!ch) return code

  // Preserve current rate when switching modes
  const { rate } = getArpInfo(ch.rawCode)

  // Remove existing arp and arpeggiate calls
  let updated = removeEffectFromChannel(code, channelIdx, 'arp')
  updated = removeEffectFromChannel(updated, channelIdx, 'arpeggiate')

  if (mode === 'off') return updated

  const arpCode = buildArpCode(mode, rate)
  if (!arpCode) return updated
  return insertEffectInChannel(updated, channelIdx, arpCode)
}

/** Set the arp rate (pattern multiplier) on a channel. Preserves current mode. */
export function setArpRate(
  code: string,
  channelIdx: number,
  rate: number,
): string {
  const channels = parseStrudelCode(code)
  const ch = channels[channelIdx]
  if (!ch) return code

  const { mode } = getArpInfo(ch.rawCode)
  if (mode === 'off') return code

  // Remove existing arp
  let updated = removeEffectFromChannel(code, channelIdx, 'arp')
  updated = removeEffectFromChannel(updated, channelIdx, 'arpeggiate')

  const arpCode = buildArpCode(mode, rate)
  if (!arpCode) return updated
  return insertEffectInChannel(updated, channelIdx, arpCode)
}

// ═══════════════════════════════════════════════════════════════
//  Transpose — detect and set .add(N) for semitone transposition
//  Only operates on simple numeric .add(N) calls.
//  Leaves complex .add("12,24") or .add(x => ...) untouched.
// ═══════════════════════════════════════════════════════════════

/** Get the simple numeric transpose (.trans(N) or legacy .add(N)) from a channel's raw code. Returns 0 if none. */
export function getTranspose(rawCode: string): number {
  // Prefer .trans(N) — chromatic semitone transposition (used by templates, methods panel, node editor)
  const transRegex = /\.trans\(/g
  let match: RegExpExecArray | null
  while ((match = transRegex.exec(rawCode)) !== null) {
    if (isInComment(rawCode, match.index)) continue
    const openP = match.index + match[0].length - 1
    const closeP = findClosingParen(rawCode, openP)
    if (closeP === -1) continue
    const arg = rawCode.substring(openP + 1, closeP).trim()
    if (/^-?\d+$/.test(arg)) {
      return parseInt(arg)
    }
  }
  // Fallback: legacy .add(N) with simple integer arg
  const addRegex = /\.add\(/g
  while ((match = addRegex.exec(rawCode)) !== null) {
    if (isInComment(rawCode, match.index)) continue
    const openP = match.index + match[0].length - 1
    const closeP = findClosingParen(rawCode, openP)
    if (closeP === -1) continue
    const arg = rawCode.substring(openP + 1, closeP).trim()
    if (/^-?\d+$/.test(arg)) {
      return parseInt(arg)
    }
  }
  return 0
}

/** Set the transpose on a channel using .trans(N) for chromatic semitone transposition.
 *  Updates existing .trans(N) or legacy .add(N), or inserts a new .trans(N).
 *  Cleans up blank lines when removing. */
export function setTranspose(
  code: string,
  channelIdx: number,
  semitones: number,
): string {
  const channels = parseStrudelCode(code)
  const ch = channels[channelIdx]
  if (!ch) return code

  // Helper: remove a .method(N) call and clean up the resulting blank line
  const removeCall = (callStart: number, callEnd: number): string => {
    let result = code.substring(0, callStart) + code.substring(callEnd)
    // Clean up blank lines left behind: find the line that contained the call
    const lines = result.split('\n')
    const cleaned: string[] = []
    // Find which line the removal was on by character position
    let pos = 0
    for (let i = 0; i < lines.length; i++) {
      const lineEnd = pos + lines[i].length
      // If this line is within the channel block and is now blank, skip it
      if (pos >= ch.blockStart && lineEnd <= ch.blockEnd && lines[i].trim() === '') {
        // Only skip if this is an interior blank line (not a boundary)
        if (i > ch.lineStart && i < ch.lineEnd - 1) {
          pos = lineEnd + 1
          continue
        }
      }
      cleaned.push(lines[i])
      pos = lineEnd + 1
    }
    return cleaned.join('\n')
  }

  // 1. Look for existing .trans(N) — preferred method
  const transRegex = /\.trans\(/g
  let match: RegExpExecArray | null
  while ((match = transRegex.exec(ch.rawCode)) !== null) {
    if (isInComment(ch.rawCode, match.index)) continue
    const openP = match.index + match[0].length - 1
    const closeP = findClosingParen(ch.rawCode, openP)
    if (closeP === -1) continue
    const arg = ch.rawCode.substring(openP + 1, closeP).trim()
    if (/^-?\d+$/.test(arg)) {
      const absArgStart = ch.blockStart + openP + 1
      const absArgEnd = ch.blockStart + closeP
      if (semitones === 0) {
        return removeCall(ch.blockStart + match.index, ch.blockStart + closeP + 1)
      }
      return code.substring(0, absArgStart) + semitones.toString() + code.substring(absArgEnd)
    }
  }

  // 2. Look for legacy .add(N) — upgrade to .trans(N)
  const addRegex = /\.add\(/g
  while ((match = addRegex.exec(ch.rawCode)) !== null) {
    if (isInComment(ch.rawCode, match.index)) continue
    const openP = match.index + match[0].length - 1
    const closeP = findClosingParen(ch.rawCode, openP)
    if (closeP === -1) continue
    const arg = ch.rawCode.substring(openP + 1, closeP).trim()
    if (/^-?\d+$/.test(arg)) {
      if (semitones === 0) {
        return removeCall(ch.blockStart + match.index, ch.blockStart + closeP + 1)
      }
      // Upgrade .add(N) → .trans(N)
      const absCallStart = ch.blockStart + match.index
      const absCallEnd = ch.blockStart + closeP + 1
      return code.substring(0, absCallStart) + `.trans(${semitones})` + code.substring(absCallEnd)
    }
  }

  // 3. No existing transpose — insert .trans(N) if non-zero
  if (semitones === 0) return code
  return insertEffectInChannel(code, channelIdx, `.trans(${semitones})`)
}

export { PARAM_DEFS as PARAM_PATTERNS }
