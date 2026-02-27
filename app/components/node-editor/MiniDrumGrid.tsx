'use client'

// ═══════════════════════════════════════════════════════════════
//  MINI DRUM GRID — compact step sequencer visualization
//
//  Shows a tiny FL Studio-style step grid on node cards.
//  Replaces the truncated text pattern display for drum/fx nodes.
//  Click to open the full DrumSequencer dock editor.
//
//  ┌────────────────────────────────────────────┐
//  │  BD  ● ○ ○ ○  ○ ○ ● ○  ○ ○ ○ ○  ● ○ ○ ○ │
//  │  CP  ○ ○ ○ ○  ● ○ ○ ○  ○ ○ ○ ○  ● ○ ○ ○ │
//  │  HH  ● ○ ● ○  ● ○ ● ○  ● ○ ● ○  ● ○ ● ○ │
//  └────────────────────────────────────────────┘
// ═══════════════════════════════════════════════════════════════

import { useMemo } from 'react'

// ── Sound colors (matches DrumSequencer.tsx) ──

const SOUND_COLORS: Record<string, string> = {
  bd: '#ef4444', kick: '#ef4444',
  sd: '#f59e0b', snare: '#f59e0b',
  cp: '#eab308', clap: '#eab308',
  hh: '#22d3ee', hihat: '#22d3ee',
  oh: '#3b82f6', openhat: '#3b82f6',
  ch: '#06b6d4',
  rim: '#a78bfa', rs: '#a78bfa',
  lt: '#fb923c', mt: '#f97316', ht: '#f59e0b',
  cy: '#818cf8', cr: '#818cf8', rd: '#818cf8',
  cb: '#f97316',
  sh: '#34d399', ma: '#34d399',
  cl: '#c084fc',
  perc: '#94a3b8', tb: '#fb923c', tom: '#fb923c',
}

function soundColor(sound: string): string {
  return SOUND_COLORS[sound.toLowerCase().replace(/[^a-z]/g, '')] || '#94a3b8'
}

// ── Mini-notation parser (subset from DrumSequencer.tsx) ──

interface DrumRow { sound: string; steps: boolean[] }

function splitByComma(pattern: string): string[] {
  const layers: string[] = []
  let depth = 0, cur = ''
  for (const ch of pattern) {
    if (ch === '[' || ch === '<' || ch === '{') depth++
    else if (ch === ']' || ch === '>' || ch === '}') depth--
    if (ch === ',' && depth === 0) { if (cur.trim()) layers.push(cur.trim()); cur = '' }
    else cur += ch
  }
  if (cur.trim()) layers.push(cur.trim())
  return layers
}

function splitTopLevel(token: string): string[] {
  const out: string[] = []
  let depth = 0, cur = ''
  for (const ch of token) {
    if (ch === '[' || ch === '<' || ch === '{') { depth++; cur += ch }
    else if (ch === ']' || ch === '>' || ch === '}') { depth--; cur += ch }
    else if (/\s/.test(ch) && depth === 0) { if (cur.trim()) out.push(cur.trim()); cur = '' }
    else cur += ch
  }
  if (cur.trim()) out.push(cur.trim())
  return out
}

function extractSoundName(layer: string): string {
  const stripped = layer.replace(/[\[\]<>{}]/g, ' ').replace(/\*\d+/g, '')
  const tokens = stripped.split(/\s+/).filter(Boolean)
  for (const t of tokens) { if (t !== '~') return t }
  return 'bd'
}

function expandToSteps(token: string, numSteps: number): boolean[] {
  token = token.trim()
  if (!token || token === '~') return new Array(numSteps).fill(false)
  const repeatMatch = token.match(/^(.+)\*(\d+)$/)
  if (repeatMatch) {
    const base = repeatMatch[1].trim(), n = parseInt(repeatMatch[2])
    if (!base.includes(' ') && !base.startsWith('[') && !base.startsWith('<')) {
      const result = new Array(numSteps).fill(false)
      for (let i = 0; i < n; i++) { const pos = Math.round(i * numSteps / n); if (pos < numSteps) result[pos] = true }
      return result
    }
    const result = new Array(numSteps).fill(false)
    const per = numSteps / n
    for (let i = 0; i < n; i++) {
      const s = Math.round(i * per), e = Math.round((i + 1) * per)
      const sub = expandToSteps(base, e - s)
      for (let j = 0; j < sub.length && (s + j) < numSteps; j++) result[s + j] = sub[j]
    }
    return result
  }
  if (token.startsWith('[') && token.endsWith(']')) return expandToSteps(token.slice(1, -1), numSteps)
  if (token.startsWith('<') && token.endsWith('>')) {
    const els = splitTopLevel(token.slice(1, -1))
    return els.length ? expandToSteps(els[0], numSteps) : new Array(numSteps).fill(false)
  }
  const elements = splitTopLevel(token)
  if (elements.length <= 1) {
    if (elements[0] === '~') return new Array(numSteps).fill(false)
    if (elements[0]?.includes('*')) return expandToSteps(elements[0], numSteps)
    const result = new Array(numSteps).fill(false)
    if (numSteps > 0) result[0] = true
    return result
  }
  const result = new Array(numSteps).fill(false)
  for (let i = 0; i < elements.length; i++) {
    const s = Math.round(i * numSteps / elements.length), e = Math.round((i + 1) * numSteps / elements.length)
    if (e - s > 0) {
      const sub = expandToSteps(elements[i], e - s)
      for (let j = 0; j < sub.length && (s + j) < numSteps; j++) result[s + j] = sub[j]
    }
  }
  return result
}

function parsePattern(pattern: string, numSteps = 16): DrumRow[] {
  if (!pattern?.trim()) return []
  return splitByComma(pattern).map(layer => ({
    sound: extractSoundName(layer),
    steps: expandToSteps(layer, numSteps),
  }))
}

// ═══════════════════════════════════════════════════════════════
//  COMPONENT
// ═══════════════════════════════════════════════════════════════

interface MiniDrumGridProps {
  pattern: string
  color: string
  onClick?: () => void
  height?: number
}

export default function MiniDrumGrid({ pattern, color, onClick, height = 32 }: MiniDrumGridProps) {
  const rows = useMemo(() => parsePattern(pattern, 16), [pattern])

  if (rows.length === 0) {
    return (
      <div
        onClick={onClick}
        className="flex items-center justify-center rounded cursor-pointer transition-all hover:brightness-125"
        style={{ height, background: `${color}06`, border: `1px solid ${color}12` }}
      >
        <span className="text-[7px] italic" style={{ color: `${color}30` }}>empty — click to edit</span>
      </div>
    )
  }

  const rowH = Math.max(4, Math.min(10, Math.floor((height - 2) / rows.length)))
  const actualH = Math.max(height, rows.length * rowH + 2)

  return (
    <div
      onClick={onClick}
      className="relative rounded cursor-pointer transition-all hover:brightness-125 overflow-hidden group"
      style={{
        height: actualH,
        background: '#0a0a0c',
        border: `1px solid ${color}15`,
      }}
    >
      {/* Beat grid lines */}
      {[4, 8, 12].map(step => (
        <div key={step} className="absolute top-0 bottom-0" style={{
          left: `${(step / 16) * 100}%`,
          width: 1,
          background: step === 8 ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)',
        }} />
      ))}

      {/* Drum rows */}
      <div className="absolute inset-0 flex flex-col justify-center" style={{ padding: '1px 0' }}>
        {rows.map((row, ri) => {
          const sColor = soundColor(row.sound)
          return (
            <div key={`${row.sound}-${ri}`} className="flex items-center" style={{ height: rowH }}>
              {/* Sound label */}
              <div className="shrink-0 flex items-center justify-end pr-0.5" style={{ width: '15%', minWidth: 20 }}>
                <span className="text-[5px] font-bold uppercase tracking-tight truncate" style={{ color: `${sColor}90` }}>
                  {row.sound}
                </span>
              </div>
              {/* Step dots */}
              <div className="flex-1 flex items-center" style={{ gap: 0 }}>
                {row.steps.map((on, si) => {
                  const dotSize = Math.max(2, rowH - 2)
                  return (
                    <div key={si} className="flex items-center justify-center" style={{
                      width: `${100 / 16}%`,
                      height: rowH,
                    }}>
                      {on ? (
                        <div className="rounded-[1px]" style={{
                          width: dotSize,
                          height: dotSize,
                          background: sColor,
                          boxShadow: `0 0 3px ${sColor}50`,
                        }} />
                      ) : (
                        <div className="rounded-[1px]" style={{
                          width: Math.max(1, dotSize - 2),
                          height: Math.max(1, dotSize - 2),
                          background: 'rgba(255,255,255,0.04)',
                        }} />
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Hover overlay */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
        style={{ background: `${color}08` }}>
        <span className="text-[7px] font-bold tracking-wider" style={{ color: `${color}90`, textShadow: '0 0 4px rgba(0,0,0,0.8)' }}>
          🥁 EDIT
        </span>
      </div>
    </div>
  )
}
