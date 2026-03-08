'use client'

// ═══════════════════════════════════════════════════════════════
//  FX LCD MONITOR — Hardware-style visual display panel
//
//  Renders a dark "LCD screen" that shows a real-time visual
//  representation of whichever FX knob the user is tweaking.
//  Each param category gets a unique visualization:
//    • Filter (LPF/HPF/BPF) → frequency response curve
//    • Drive/Distort/Crush   → waveshaper transfer curve
//    • Reverb/Room           → impulse response decay
//    • Delay                 → echo tap diagram
//    • Pan                   → stereo field indicator
//    • Gain/Volume           → level meter bars
//    • Envelope (ADSR)       → envelope shape
//    • FM                    → modulated waveform
//    • Phaser/Vibrato        → LFO waveform
//    • Tremolo               → amplitude modulation
//    • Speed/Begin/End       → waveform slice region
//    • Detune                → detuned unison wave
//
//  Shows param name, value readout, and animated visualization.
// ═══════════════════════════════════════════════════════════════

import { memo, useRef, useEffect, useCallback } from 'react'

// ─── Types ───
interface FxLcdMonitorProps {
  paramKey: string | null   // Currently tweaked param key (null = idle)
  paramLabel: string
  value: number
  min: number
  max: number
  color: string             // Channel accent color
  unit?: string
  width?: number
  height?: number
}

// ─── Parameter category mapping ───
type VisualType = 'filter' | 'drive' | 'reverb' | 'delay' | 'pan' | 'gain' | 'envelope' | 'fm' | 'lfo' | 'tremolo' | 'sample' | 'detune' | 'generic'

const PARAM_VISUAL_MAP: Record<string, VisualType> = {
  // Filter
  lpf: 'filter', lp: 'filter', hpf: 'filter', hp: 'filter', bpf: 'filter',
  lpq: 'filter', hpq: 'filter', bpq: 'filter',
  lpenv: 'filter', hpenv: 'filter', bpenv: 'filter',
  lpattack: 'filter', lprelease: 'filter', lps: 'filter', lpd: 'filter',
  ftype: 'filter', vowel: 'filter',
  // Drive
  shape: 'drive', distort: 'drive', crush: 'drive', coarse: 'drive', compressor: 'drive',
  // Reverb
  room: 'reverb', roomsize: 'reverb', roomfade: 'reverb', roomlp: 'reverb', roomdim: 'reverb',
  dry: 'reverb',
  // Delay
  delay: 'delay', delayfeedback: 'delay', delaytime: 'delay', echo: 'delay',
  // Pan
  pan: 'pan',
  // Gain / Level
  gain: 'gain', velocity: 'gain', postgain: 'gain',
  // Envelope
  attack: 'envelope', decay: 'envelope', sustain: 'envelope',
  rel: 'envelope', release: 'envelope', legato: 'envelope', clip: 'envelope',
  // FM
  fm: 'fm', fmh: 'fm', fmattack: 'fm', fmdecay: 'fm', fmsustain: 'fm',
  // LFO / Modulation
  vib: 'lfo', vibmod: 'lfo', phaser: 'lfo', phaserdepth: 'lfo',
  phasercenter: 'lfo', phasersweep: 'lfo',
  detune: 'detune',
  // Tremolo
  tremolosync: 'tremolo', tremolodepth: 'tremolo', tremoloskew: 'tremolo',
  tremolophase: 'tremolo', tremoloshape: 'tremolo',
  // Sample
  speed: 'sample', begin: 'sample', end: 'sample',
  loopAt: 'sample', chop: 'sample', slice: 'sample', stretch: 'sample',
  splice: 'sample', striate: 'sample',
  loopBegin: 'sample', loopEnd: 'sample',
  // Pitch
  penv: 'lfo', pattack: 'envelope', pdecay: 'envelope', prelease: 'envelope',
  pcurve: 'lfo', panchor: 'lfo',
  // Rate
  fast: 'generic', slow: 'generic',
  // Sidechain
  duckdepth: 'tremolo', duckattack: 'envelope',
  orbit: 'generic', n: 'generic', cut: 'generic', hurry: 'generic', unit: 'generic',
  loop: 'generic',
}

// ── Hex to RGB ──
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '')
  const r = parseInt(h.substring(0, 2), 16) || 0
  const g = parseInt(h.substring(2, 4), 16) || 0
  const b = parseInt(h.substring(4, 6), 16) || 0
  return { r, g, b }
}

// ═══ DRAWING FUNCTIONS ═══

function drawFilter(ctx: CanvasRenderingContext2D, w: number, h: number, norm: number, key: string, color: string) {
  const { r, g, b } = hexToRgb(color)
  const pad = 8
  const plotW = w - pad * 2
  const plotH = h - pad * 2

  // Draw frequency grid lines
  ctx.strokeStyle = `rgba(${r},${g},${b},0.06)`
  ctx.lineWidth = 0.5
  for (let i = 1; i < 5; i++) {
    const x = pad + (plotW * i) / 5
    ctx.beginPath(); ctx.moveTo(x, pad); ctx.lineTo(x, h - pad); ctx.stroke()
  }
  for (let i = 1; i < 4; i++) {
    const y = pad + (plotH * i) / 4
    ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(w - pad, y); ctx.stroke()
  }

  // Draw filter response curve
  ctx.beginPath()
  ctx.strokeStyle = color
  ctx.lineWidth = 2
  ctx.shadowColor = color
  ctx.shadowBlur = 6

  const isHP = key === 'hpf' || key === 'hp' || key === 'hpq' || key === 'hpenv'
  const isBP = key === 'bpf' || key === 'bpq' || key === 'bpenv'
  const isQ = key === 'lpq' || key === 'hpq' || key === 'bpq'

  for (let x = 0; x <= plotW; x++) {
    const xNorm = x / plotW  // 0..1 across frequency spectrum
    let amplitude: number

    if (isBP) {
      // Band-pass: bell curve centered on norm
      const center = norm
      const bw = 0.15
      const dist = (xNorm - center) / bw
      amplitude = Math.exp(-dist * dist * 0.5)
    } else if (isHP) {
      // High-pass: sigmoid rising at cutoff
      const cutoff = norm
      const steepness = isQ ? 8 + norm * 20 : 6
      amplitude = 1 / (1 + Math.exp(-steepness * (xNorm - cutoff)))
    } else {
      // Low-pass: sigmoid falling at cutoff
      const cutoff = norm
      const steepness = isQ ? 8 + norm * 20 : 6
      amplitude = 1 / (1 + Math.exp(steepness * (xNorm - cutoff)))
    }

    // Add resonance peak near cutoff for Q params
    if (isQ) {
      const cutoff = norm
      const resonance = norm * 0.6
      const dist = Math.abs(xNorm - cutoff)
      if (dist < 0.1) {
        amplitude += resonance * Math.exp(-dist * dist * 200)
      }
    }

    const px = pad + x
    const py = pad + plotH * (1 - Math.min(1.2, amplitude))

    if (x === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.stroke()
  ctx.shadowBlur = 0

  // Fill under curve
  ctx.lineTo(pad + plotW, h - pad)
  ctx.lineTo(pad, h - pad)
  ctx.closePath()
  ctx.fillStyle = `rgba(${r},${g},${b},0.08)`
  ctx.fill()
}

function drawDrive(ctx: CanvasRenderingContext2D, w: number, h: number, norm: number, color: string) {
  const { r, g, b } = hexToRgb(color)
  const pad = 8
  const plotW = w - pad * 2
  const plotH = h - pad * 2
  const midY = pad + plotH / 2

  // Diagonal reference line
  ctx.strokeStyle = `rgba(${r},${g},${b},0.1)`
  ctx.lineWidth = 0.5
  ctx.setLineDash([2, 2])
  ctx.beginPath(); ctx.moveTo(pad, h - pad); ctx.lineTo(w - pad, pad); ctx.stroke()
  ctx.setLineDash([])

  // Transfer curve (waveshaper)
  const drive = 0.2 + norm * 10  // Drive amount
  ctx.beginPath()
  ctx.strokeStyle = color
  ctx.lineWidth = 2
  ctx.shadowColor = color
  ctx.shadowBlur = 6

  for (let x = 0; x <= plotW; x++) {
    const inputNorm = (x / plotW) * 2 - 1  // -1 to 1
    // Soft-clip / tanh waveshaping
    let output = Math.tanh(inputNorm * drive) / Math.tanh(drive || 0.01)
    output = Math.max(-1, Math.min(1, output))
    const py = midY - (output * plotH) / 2
    const px = pad + x
    if (x === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.stroke()
  ctx.shadowBlur = 0
}

function drawReverb(ctx: CanvasRenderingContext2D, w: number, h: number, norm: number, color: string) {
  const { r, g, b } = hexToRgb(color)
  const pad = 8
  const plotW = w - pad * 2
  const plotH = h - pad * 2

  // Impulse response decay
  const decayRate = 1 + (1 - norm) * 8  // Faster decay at low values
  ctx.beginPath()
  ctx.strokeStyle = color
  ctx.lineWidth = 1.5
  ctx.shadowColor = color
  ctx.shadowBlur = 4

  // Draw noisy impulse response
  for (let x = 0; x <= plotW; x++) {
    const t = x / plotW
    const envelope = Math.exp(-t * decayRate)
    // Pseudo-random noise based on position (deterministic)
    const noise = Math.sin(x * 47.3) * Math.cos(x * 23.7) * Math.sin(x * 11.1)
    const amplitude = envelope * noise
    const py = pad + plotH / 2 - amplitude * plotH * 0.4
    const px = pad + x
    if (x === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.stroke()
  ctx.shadowBlur = 0

  // Decay envelope overlay
  ctx.strokeStyle = `rgba(${r},${g},${b},0.3)`
  ctx.lineWidth = 1
  ctx.setLineDash([3, 3])
  ctx.beginPath()
  for (let x = 0; x <= plotW; x++) {
    const t = x / plotW
    const env = Math.exp(-t * decayRate)
    const px = pad + x
    const py = pad + plotH / 2 - env * plotH * 0.4
    if (x === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.stroke()
  ctx.setLineDash([])
}

function drawDelay(ctx: CanvasRenderingContext2D, w: number, h: number, norm: number, key: string, color: string) {
  const { r, g, b } = hexToRgb(color)
  const pad = 12
  const plotW = w - pad * 2
  const plotH = h - pad * 2

  // Echo taps visualization
  const numTaps = key === 'echo' ? Math.max(1, Math.round(norm * 8)) : 5
  const feedback = key === 'delayfeedback' ? norm : 0.6
  const delayTime = key === 'delaytime' ? norm : 0.3

  for (let i = 0; i < numTaps; i++) {
    const amplitude = Math.pow(feedback, i)
    if (amplitude < 0.05) break
    const x = pad + (plotW * (i + 1) * delayTime) / (numTaps * delayTime + 0.5)
    const barH = amplitude * plotH * 0.8
    const barW = Math.max(3, plotW / (numTaps * 2))

    // Bar
    ctx.fillStyle = `rgba(${r},${g},${b},${0.3 + amplitude * 0.5})`
    ctx.fillRect(x - barW / 2, pad + plotH - barH, barW, barH)

    // Glow cap
    ctx.fillStyle = `rgba(${r},${g},${b},${amplitude * 0.8})`
    ctx.fillRect(x - barW / 2, pad + plotH - barH, barW, 2)
  }

  // Original signal bar
  ctx.fillStyle = color
  ctx.fillRect(pad, pad, 3, plotH * 0.8)
  ctx.shadowBlur = 0
}

function drawPan(ctx: CanvasRenderingContext2D, w: number, h: number, norm: number, color: string) {
  const { r, g, b } = hexToRgb(color)
  const pad = 8
  const midX = w / 2
  const midY = h / 2

  // Stereo field arc
  const arcR = Math.min(w, h) / 2 - 12
  ctx.strokeStyle = `rgba(${r},${g},${b},0.1)`
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.arc(midX, h - 4, arcR, Math.PI, 0)
  ctx.stroke()

  // Pan position (0 = left, 0.5 = center, 1 = right)
  const panAngle = Math.PI * (1 - norm)  // PI=left, 0=right
  const dotX = midX + arcR * Math.cos(panAngle)
  const dotY = (h - 4) - arcR * Math.sin(panAngle)

  // Pan indicator line
  ctx.beginPath()
  ctx.strokeStyle = color
  ctx.lineWidth = 2
  ctx.shadowColor = color
  ctx.shadowBlur = 8
  ctx.moveTo(midX, h - 4)
  ctx.lineTo(dotX, dotY)
  ctx.stroke()

  // Pan dot
  ctx.beginPath()
  ctx.fillStyle = color
  ctx.arc(dotX, dotY, 4, 0, Math.PI * 2)
  ctx.fill()
  ctx.shadowBlur = 0

  // L / R labels
  ctx.fillStyle = `rgba(${r},${g},${b},0.3)`
  ctx.font = 'bold 8px monospace'
  ctx.textAlign = 'center'
  ctx.fillText('L', pad + 6, h - 6)
  ctx.fillText('R', w - pad - 6, h - 6)

  // Center tick
  ctx.strokeStyle = `rgba(${r},${g},${b},0.15)`
  ctx.lineWidth = 0.5
  ctx.setLineDash([2, 2])
  ctx.beginPath(); ctx.moveTo(midX, h - 4); ctx.lineTo(midX, h - 4 - arcR); ctx.stroke()
  ctx.setLineDash([])
}

function drawGain(ctx: CanvasRenderingContext2D, w: number, h: number, norm: number, color: string) {
  const { r, g, b } = hexToRgb(color)
  const pad = 10
  const plotH = h - pad * 2
  const barW = 12
  const midX = w / 2

  // Background meter track
  ctx.fillStyle = `rgba(${r},${g},${b},0.04)`
  ctx.fillRect(midX - barW / 2, pad, barW, plotH)

  // Level segments
  const numSegs = 16
  const segH = (plotH - numSegs) / numSegs
  for (let i = 0; i < numSegs; i++) {
    const segNorm = (numSegs - i) / numSegs
    const active = segNorm <= norm
    const y = pad + i * (segH + 1)

    if (active) {
      // Color gradient: green → yellow → red
      const intensity = segNorm
      let segColor: string
      if (intensity > 0.85) segColor = '#ef4444'
      else if (intensity > 0.7) segColor = '#f59e0b'
      else segColor = color

      ctx.fillStyle = segColor
      ctx.shadowColor = segColor
      ctx.shadowBlur = 3
    } else {
      ctx.fillStyle = `rgba(${r},${g},${b},0.06)`
      ctx.shadowBlur = 0
    }

    ctx.fillRect(midX - barW / 2, y, barW, segH)
  }
  ctx.shadowBlur = 0

  // Side dB marks
  ctx.fillStyle = `rgba(${r},${g},${b},0.15)`
  ctx.font = '6px monospace'
  ctx.textAlign = 'right'
  ctx.fillText('0', midX - barW / 2 - 3, pad + 7)
  ctx.fillText('-∞', midX - barW / 2 - 3, h - pad)
}

function drawEnvelope(ctx: CanvasRenderingContext2D, w: number, h: number, norm: number, key: string, color: string) {
  const { r, g, b } = hexToRgb(color)
  const pad = 8
  const plotW = w - pad * 2
  const plotH = h - pad * 2

  // Default ADSR values (tweaked param gets norm)
  let a = key === 'attack' ? norm : 0.15
  let d = (key === 'decay' || key === 'pdecay' || key === 'fmdecay') ? norm : 0.25
  let s = (key === 'sustain' || key === 'fmsustain') ? norm : 0.6
  let rel = (key === 'rel' || key === 'release' || key === 'prelease') ? norm : 0.3
  const leg = key === 'legato' ? norm : 0

  // Map to time fractions
  const totalTime = a + d + 0.3 + rel  // attack + decay + sustain hold + release
  const ax = pad + (a / totalTime) * plotW
  const dx = ax + (d / totalTime) * plotW
  const sx = dx + (0.3 / totalTime) * plotW
  const rx = sx + (rel / totalTime) * plotW

  const top = pad
  const bot = pad + plotH
  const susY = top + plotH * (1 - s)

  // Envelope shape
  ctx.beginPath()
  ctx.strokeStyle = color
  ctx.lineWidth = 2
  ctx.shadowColor = color
  ctx.shadowBlur = 6

  ctx.moveTo(pad, bot)             // Start at 0
  ctx.lineTo(ax, top)              // Attack to peak
  ctx.lineTo(dx, susY)             // Decay to sustain
  ctx.lineTo(sx, susY)             // Sustain hold
  ctx.lineTo(rx, bot)              // Release to 0
  ctx.stroke()
  ctx.shadowBlur = 0

  // Fill under curve
  ctx.lineTo(pad, bot)
  ctx.closePath()
  ctx.fillStyle = `rgba(${r},${g},${b},0.06)`
  ctx.fill()

  // Phase labels
  ctx.fillStyle = `rgba(${r},${g},${b},0.2)`
  ctx.font = '6px monospace'
  ctx.textAlign = 'center'
  ctx.fillText('A', (pad + ax) / 2, bot + 8)
  ctx.fillText('D', (ax + dx) / 2, bot + 8)
  ctx.fillText('S', (dx + sx) / 2, bot + 8)
  ctx.fillText('R', (sx + rx) / 2, bot + 8)

  // Highlight active phase
  let highlightX = pad
  let highlightW = plotW
  if (key === 'attack' || key === 'fmattack' || key === 'pattack' || key === 'duckattack') { highlightX = pad; highlightW = ax - pad }
  else if (key === 'decay' || key === 'pdecay' || key === 'fmdecay' || key === 'lpd') { highlightX = ax; highlightW = dx - ax }
  else if (key === 'sustain' || key === 'fmsustain' || key === 'lps') { highlightX = dx; highlightW = sx - dx }
  else if (key === 'rel' || key === 'release' || key === 'prelease' || key === 'lprelease') { highlightX = sx; highlightW = rx - sx }

  ctx.fillStyle = `rgba(${r},${g},${b},0.05)`
  ctx.fillRect(highlightX, pad - 2, highlightW, plotH + 4)
}

function drawFM(ctx: CanvasRenderingContext2D, w: number, h: number, norm: number, key: string, color: string) {
  const { r, g, b } = hexToRgb(color)
  const pad = 8
  const plotW = w - pad * 2
  const plotH = h - pad * 2
  const midY = pad + plotH / 2

  const fmDepth = key === 'fm' ? norm * 8 : 4
  const fmHarm = key === 'fmh' ? 0.5 + norm * 6 : 2

  ctx.beginPath()
  ctx.strokeStyle = color
  ctx.lineWidth = 1.5
  ctx.shadowColor = color
  ctx.shadowBlur = 4

  for (let x = 0; x <= plotW; x++) {
    const t = (x / plotW) * Math.PI * 4
    const modulator = Math.sin(t * fmHarm)
    const carrier = Math.sin(t + fmDepth * modulator)
    const py = midY - carrier * plotH * 0.35
    const px = pad + x
    if (x === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.stroke()
  ctx.shadowBlur = 0
}

function drawLFO(ctx: CanvasRenderingContext2D, w: number, h: number, norm: number, key: string, color: string) {
  const { r, g, b } = hexToRgb(color)
  const pad = 8
  const plotW = w - pad * 2
  const plotH = h - pad * 2
  const midY = pad + plotH / 2

  const rate = key === 'vib' || key === 'phaser' ? 1 + norm * 6 : 3
  const depth = key === 'vibmod' || key === 'phaserdepth' ? norm : 0.7

  ctx.beginPath()
  ctx.strokeStyle = color
  ctx.lineWidth = 1.5
  ctx.shadowColor = color
  ctx.shadowBlur = 4

  for (let x = 0; x <= plotW; x++) {
    const t = (x / plotW) * Math.PI * 2 * rate
    const y = Math.sin(t) * depth
    const py = midY - y * plotH * 0.35
    const px = pad + x
    if (x === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.stroke()
  ctx.shadowBlur = 0

  // Center line
  ctx.strokeStyle = `rgba(${r},${g},${b},0.08)`
  ctx.lineWidth = 0.5
  ctx.setLineDash([2, 2])
  ctx.beginPath(); ctx.moveTo(pad, midY); ctx.lineTo(w - pad, midY); ctx.stroke()
  ctx.setLineDash([])
}

function drawTremolo(ctx: CanvasRenderingContext2D, w: number, h: number, norm: number, key: string, color: string) {
  const { r, g, b } = hexToRgb(color)
  const pad = 8
  const plotW = w - pad * 2
  const plotH = h - pad * 2
  const midY = pad + plotH / 2

  const depth = key === 'tremolodepth' || key === 'duckdepth' ? norm : 0.7
  const rate = key === 'tremolosync' ? 1 + norm * 8 : 4
  const skew = key === 'tremoloskew' ? norm : 0.5

  // Draw carrier wave (thin)
  ctx.strokeStyle = `rgba(${r},${g},${b},0.12)`
  ctx.lineWidth = 0.5
  ctx.beginPath()
  for (let x = 0; x <= plotW; x++) {
    const t = (x / plotW) * Math.PI * 8
    const py = midY - Math.sin(t) * plotH * 0.3
    const px = pad + x
    if (x === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.stroke()

  // Draw amplitude-modulated carrier
  ctx.beginPath()
  ctx.strokeStyle = color
  ctx.lineWidth = 1.5
  ctx.shadowColor = color
  ctx.shadowBlur = 4

  for (let x = 0; x <= plotW; x++) {
    const t = (x / plotW) * Math.PI * 8
    const lfoT = (x / plotW) * Math.PI * 2 * rate
    // Skewed LFO
    const rawLfo = Math.sin(lfoT)
    const lfo = rawLfo >= 0 ? Math.pow(rawLfo, 1 / (skew + 0.1)) : -Math.pow(-rawLfo, 1 / (skew + 0.1))
    const envelope = 1 - depth * (0.5 + 0.5 * lfo)
    const py = midY - Math.sin(t) * plotH * 0.3 * envelope
    const px = pad + x
    if (x === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.stroke()
  ctx.shadowBlur = 0
}

function drawSample(ctx: CanvasRenderingContext2D, w: number, h: number, norm: number, key: string, color: string) {
  const { r, g, b } = hexToRgb(color)
  const pad = 8
  const plotW = w - pad * 2
  const plotH = h - pad * 2
  const midY = pad + plotH / 2

  // Fake waveform
  ctx.strokeStyle = `rgba(${r},${g},${b},0.15)`
  ctx.lineWidth = 1
  ctx.beginPath()
  for (let x = 0; x <= plotW; x++) {
    const t = x / plotW
    // Deterministic pseudo-random waveform
    const env = Math.sin(t * Math.PI) * 0.8 + 0.2
    const wave = (Math.sin(t * 73) * 0.5 + Math.sin(t * 127) * 0.3 + Math.sin(t * 211) * 0.2) * env
    const py = midY - wave * plotH * 0.35
    const px = pad + x
    if (x === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.stroke()

  // Highlight region based on param
  let regionStart = 0, regionEnd = 1
  if (key === 'begin' || key === 'loopBegin') { regionStart = 0; regionEnd = norm }
  else if (key === 'end' || key === 'loopEnd') { regionStart = norm; regionEnd = 1 }
  else if (key === 'speed') { regionEnd = Math.min(1, 1 / Math.max(0.1, norm * 2)) }
  else if (key === 'chop' || key === 'slice' || key === 'splice' || key === 'striate') {
    const numSlices = Math.max(2, Math.round(norm * 16))
    // Draw slice lines
    ctx.strokeStyle = `rgba(${r},${g},${b},0.2)`
    ctx.lineWidth = 0.5
    for (let i = 1; i < numSlices; i++) {
      const sx = pad + (plotW * i) / numSlices
      ctx.beginPath(); ctx.moveTo(sx, pad); ctx.lineTo(sx, h - pad); ctx.stroke()
    }
    return
  }

  // Active region highlight
  const rx = pad + regionStart * plotW
  const rw = (regionEnd - regionStart) * plotW
  ctx.fillStyle = `rgba(${r},${g},${b},0.06)`
  ctx.fillRect(rx, pad, rw, plotH)

  // Re-draw waveform in color in active region
  ctx.save()
  ctx.beginPath()
  ctx.rect(rx, 0, rw, h)
  ctx.clip()
  ctx.strokeStyle = color
  ctx.lineWidth = 1.5
  ctx.shadowColor = color
  ctx.shadowBlur = 4
  ctx.beginPath()
  for (let x = 0; x <= plotW; x++) {
    const t = x / plotW
    const env = Math.sin(t * Math.PI) * 0.8 + 0.2
    const wave = (Math.sin(t * 73) * 0.5 + Math.sin(t * 127) * 0.3 + Math.sin(t * 211) * 0.2) * env
    const py = midY - wave * plotH * 0.35
    const px = pad + x
    if (x === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.stroke()
  ctx.shadowBlur = 0
  ctx.restore()
}

function drawDetune(ctx: CanvasRenderingContext2D, w: number, h: number, norm: number, color: string) {
  const { r, g, b } = hexToRgb(color)
  const pad = 8
  const plotW = w - pad * 2
  const plotH = h - pad * 2
  const midY = pad + plotH / 2

  const detuneAmt = norm * 0.3
  const voices = [0, -detuneAmt, detuneAmt]

  voices.forEach((offset, vi) => {
    ctx.beginPath()
    ctx.strokeStyle = vi === 0 ? color : `rgba(${r},${g},${b},0.35)`
    ctx.lineWidth = vi === 0 ? 1.5 : 1
    if (vi === 0) { ctx.shadowColor = color; ctx.shadowBlur = 4 }
    else ctx.shadowBlur = 0

    for (let x = 0; x <= plotW; x++) {
      const t = (x / plotW) * Math.PI * 6
      const py = midY - Math.sin(t * (1 + offset)) * plotH * 0.3
      const px = pad + x
      if (x === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.stroke()
  })
  ctx.shadowBlur = 0
}

function drawGeneric(ctx: CanvasRenderingContext2D, w: number, h: number, norm: number, color: string) {
  const { r, g, b } = hexToRgb(color)
  const midX = w / 2
  const midY = h / 2
  const maxR = Math.min(w, h) / 2 - 12

  // Circular gauge
  const startA = Math.PI * 0.75  // bottom-left
  const endA = Math.PI * 0.25    // bottom-right (going CW so we subtract)
  const sweepRange = Math.PI * 1.5  // 270° sweep

  // Background arc
  ctx.strokeStyle = `rgba(${r},${g},${b},0.08)`
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.arc(midX, midY, maxR, startA, startA + sweepRange)
  ctx.stroke()

  // Value arc
  ctx.strokeStyle = color
  ctx.lineWidth = 3
  ctx.shadowColor = color
  ctx.shadowBlur = 6
  ctx.beginPath()
  ctx.arc(midX, midY, maxR, startA, startA + sweepRange * norm)
  ctx.stroke()
  ctx.shadowBlur = 0

  // Center dot
  ctx.beginPath()
  ctx.fillStyle = color
  ctx.arc(midX, midY, 3, 0, Math.PI * 2)
  ctx.fill()
}

// ═══ MAIN COMPONENT ═══

const FxLcdMonitor = memo(function FxLcdMonitor({
  paramKey,
  paramLabel,
  value,
  min,
  max,
  color,
  unit = '',
  width = 200,
  height = 80,
}: FxLcdMonitorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)

  const norm = max > min ? Math.max(0, Math.min(1, (value - min) / (max - min))) : 0
  const visualType: VisualType = paramKey ? (PARAM_VISUAL_MAP[paramKey] || 'generic') : 'generic'

  const displayVal = value >= 1000
    ? `${(value / 1000).toFixed(1)}k`
    : value >= 100
      ? Math.round(value).toString()
      : value.toFixed(value === Math.round(value) ? 0 : 2)

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const dpr = window.devicePixelRatio || 1
    const cw = width
    const ch = height

    canvas.width = cw * dpr
    canvas.height = ch * dpr
    canvas.style.width = `${cw}px`
    canvas.style.height = `${ch}px`

    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.scale(dpr, dpr)

    // Clear
    ctx.clearRect(0, 0, cw, ch)

    if (!paramKey) {
      // Idle state — show scan lines
      const { r, g, b } = hexToRgb(color)
      ctx.fillStyle = `rgba(${r},${g},${b},0.03)`
      for (let y = 0; y < ch; y += 3) {
        ctx.fillRect(0, y, cw, 1)
      }
      ctx.fillStyle = `rgba(${r},${g},${b},0.08)`
      ctx.font = 'bold 9px "Courier New", monospace'
      ctx.textAlign = 'center'
      ctx.fillText('444 FX MONITOR', cw / 2, ch / 2 + 3)
      return
    }

    // Draw visualization based on type
    switch (visualType) {
      case 'filter': drawFilter(ctx, cw, ch, norm, paramKey, color); break
      case 'drive': drawDrive(ctx, cw, ch, norm, color); break
      case 'reverb': drawReverb(ctx, cw, ch, norm, color); break
      case 'delay': drawDelay(ctx, cw, ch, norm, paramKey, color); break
      case 'pan': drawPan(ctx, cw, ch, norm, color); break
      case 'gain': drawGain(ctx, cw, ch, norm, color); break
      case 'envelope': drawEnvelope(ctx, cw, ch, norm, paramKey, color); break
      case 'fm': drawFM(ctx, cw, ch, norm, paramKey, color); break
      case 'lfo': drawLFO(ctx, cw, ch, norm, paramKey, color); break
      case 'tremolo': drawTremolo(ctx, cw, ch, norm, paramKey, color); break
      case 'sample': drawSample(ctx, cw, ch, norm, paramKey, color); break
      case 'detune': drawDetune(ctx, cw, ch, norm, color); break
      case 'generic': drawGeneric(ctx, cw, ch, norm, color); break
    }
  }, [paramKey, value, norm, visualType, color, width, height])

  useEffect(() => {
    draw()
  }, [draw])

  return (
    <div
      className="relative overflow-hidden rounded-md"
      style={{
        width,
        height: height + 24,  // extra for header
        background: 'linear-gradient(180deg, #040608 0%, #060a0c 50%, #040608 100%)',
        border: '1px solid #0f1a1a',
        boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.8), 0 1px 0 rgba(255,255,255,0.02)',
      }}
    >
      {/* LCD header strip */}
      <div className="flex items-center justify-between px-2 py-0.5" style={{ borderBottom: '1px solid #0a1414' }}>
        <div className="flex items-center gap-1.5">
          {/* Status LED */}
          <div style={{
            width: 4, height: 4, borderRadius: '50%',
            background: paramKey ? color : '#1a2a2a',
            boxShadow: paramKey ? `0 0 6px ${color}80, 0 0 2px ${color}` : 'none',
            transition: 'all 0.2s',
          }} />
          <span className="text-[7px] font-black uppercase tracking-[.2em]"
            style={{ color: paramKey ? color : '#1a3030', fontFamily: '"Courier New", monospace', transition: 'color 0.2s' }}>
            {paramKey ? `.${paramKey}()` : 'MONITOR'}
          </span>
        </div>
        {paramKey && (
          <span className="text-[9px] font-bold font-mono tabular-nums"
            style={{ color, textShadow: `0 0 8px ${color}60` }}>
            {displayVal}{unit && <span className="text-[6px] opacity-50 ml-0.5">{unit}</span>}
          </span>
        )}
      </div>

      {/* Canvas display */}
      <canvas
        ref={canvasRef}
        style={{ display: 'block' }}
      />

      {/* CRT scan line overlay */}
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 1px, rgba(0,0,0,0.15) 1px, rgba(0,0,0,0.15) 2px)',
        mixBlendMode: 'multiply',
      }} />

      {/* Corner glow */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: `radial-gradient(ellipse at 30% 20%, ${color}04 0%, transparent 60%)`,
      }} />
    </div>
  )
})

export default FxLcdMonitor
