'use client'

// ═══════════════════════════════════════════════════════════════
//  TRACK VIEW v2 — Vertical stacked DAW-style track lanes
//
//  Features:
//    - Per-track multi-mode scope (waveform/bars/mirror) — click to cycle
//    - Selected track highlighting with bottom effects panel
//    - All FX knobs organized by groups, context-aware per channel type
//    - Inline knobs on expanded tracks
//    - Synced playhead + beat grid + peak meters
// ═══════════════════════════════════════════════════════════════

import { useRef, useEffect, useCallback, useState, useMemo, memo } from 'react'
import { ChevronDown, ChevronRight, Plus, Piano, Grid3X3 } from 'lucide-react'
import StudioKnob from './StudioKnob'
import HardwareKnob from './HardwareKnob'
import { getOrbitAnalyser } from '@/lib/studio-analysers'
import { PARAM_DEFS, type ParsedChannel, type ParamDef } from '@/lib/strudel-code-parser'

// ─── Scope types for per-track visualization ───
const TRACK_SCOPE_TYPES = [
  { id: 'waveform', label: 'WAVE' },
  { id: 'bars',     label: 'FREQ' },
  { id: 'mirror',   label: 'MIRROR' },
] as const
type TrackScopeType = typeof TRACK_SCOPE_TYPES[number]['id']

// ─── FX groups definition (same as StudioMixerRack) ───
const FX_GROUPS: { label: string; icon: string; keys: string[] }[] = [
  { label: 'FILTER', icon: '🔽', keys: ['lpf', 'lp', 'hpf', 'hp', 'lpq', 'hpq', 'lpenv', 'hpenv', 'bpenv', 'lpattack', 'lpa', 'lprelease', 'lpr', 'lps', 'lpd', 'bpf', 'bpq', 'ftype', 'vowel'] },
  { label: 'DRIVE',  icon: '🔥', keys: ['shape', 'distort', 'crush', 'coarse', 'compressor'] },
  { label: 'SPACE',  icon: '🌌', keys: ['room', 'roomsize', 'roomfade', 'roomlp', 'roomdim', 'delay', 'delayfeedback', 'delaytime', 'dry', 'echo'] },
  { label: 'MOD',    icon: '🎵', keys: ['detune', 'pan', 'velocity', 'postgain', 'vib', 'vibmod', 'phaser', 'phaserdepth', 'phasercenter', 'phasersweep', 'tremolosync', 'tremolodepth', 'tremoloskew', 'tremolophase', 'tremoloshape', 'fast', 'slow'] },
  { label: 'FM',     icon: '📻', keys: ['fm', 'fmh', 'fmattack', 'fmdecay', 'fmsustain'] },
  { label: 'PITCH',  icon: '📈', keys: ['penv', 'pattack', 'pdecay', 'prelease', 'pcurve', 'panchor'] },
  { label: 'ENV',    icon: '⏳', keys: ['attack', 'decay', 'sustain', 'rel', 'release', 'legato', 'clip'] },
  { label: 'CHAIN',  icon: '🦆', keys: ['duckdepth', 'duckattack'] },
  { label: 'SAMPLE', icon: '🎤', keys: ['loopAt', 'loop', 'begin', 'end', 'speed', 'chop', 'stretch', 'slice', 'splice', 'striate', 'loopBegin', 'loopEnd', 'cut', 'n', 'hurry', 'unit'] },
]

// Channel type → relevant FX group labels
const TYPE_RELEVANT_GROUPS: Record<string, Set<string>> = {
  synth:  new Set(['FILTER', 'DRIVE', 'SPACE', 'MOD', 'FM', 'PITCH', 'ENV']),
  note:   new Set(['FILTER', 'DRIVE', 'SPACE', 'MOD', 'FM', 'PITCH', 'ENV']),
  sample: new Set(['FILTER', 'DRIVE', 'SPACE', 'MOD', 'PITCH', 'ENV', 'SAMPLE', 'CHAIN']),
  stack:  new Set(['FILTER', 'DRIVE', 'SPACE', 'MOD', 'ENV', 'CHAIN']),
}

// ─── FX Descriptions — what each effect does to the sound ───
const FX_DESCRIPTIONS: Record<string, string> = {
  // FILTER
  lpf: 'Low-pass filter cutoff. Removes high frequencies above this point — makes sound darker and muffled.',
  lp: 'Low-pass filter cutoff (alias). Same as lpf — cuts highs, keeps lows warm.',
  hpf: 'High-pass filter cutoff. Removes low frequencies below this point — thins out the sound.',
  hp: 'High-pass filter cutoff (alias). Same as hpf — removes bass rumble.',
  lpq: 'Low-pass resonance (Q). Boosts frequencies near the cutoff — adds a sharp "peak" or whistle.',
  hpq: 'High-pass resonance (Q). Boosts frequencies near the HP cutoff — adds nasal overtones.',
  lpenv: 'LP envelope depth. How much the filter opens on each note attack — adds pluck/sweep.',
  hpenv: 'HP envelope depth. How much the high-pass sweeps on attack — adds breath/texture.',
  bpenv: 'Band-pass envelope depth. Vowel-like sweep on each note trigger.',
  lpattack: 'LP filter attack time. How fast the filter opens — slow = gradual sweep, fast = snappy.',
  lpa: 'LP filter attack (alias). Same as lpattack — controls filter sweep speed.',
  lprelease: 'LP filter release. How long the filter takes to close after the note — long = smooth tail.',
  lpr: 'LP filter release (alias). Controls how the filter decays.',
  lps: 'LP filter sustain. Filter level held during the note — lower = more plucky.',
  lpd: 'LP filter decay. Time from attack peak to sustain level.',
  bpf: 'Band-pass filter center frequency. Keeps only frequencies around this point — telephone/radio effect.',
  bpq: 'Band-pass Q/width. How narrow the pass band is — higher = more focused/nasal.',
  ftype: 'Filter type selector. Changes between different filter curve shapes.',
  vowel: 'Vowel filter. Shapes sound like a human vowel (a, e, i, o, u) — voice-like resonances.',
  // DRIVE
  shape: 'Waveshaper distortion amount. Adds harmonic overtones — subtle warmth to gnarly crunch.',
  distort: 'Hard distortion/clipping. Aggressive saturation — makes everything louder and grittier.',
  crush: 'Bit crusher. Reduces bit depth — adds lo-fi digital grit and aliasing artifacts.',
  coarse: 'Sample rate reduction. Lowers resolution — creates retro/chiptune digital sounds.',
  compressor: 'Dynamic compressor ratio. Evens out volume differences — glues and fattens the sound.',
  // SPACE
  room: 'Reverb room amount. How much reverb is mixed in — adds space and depth.',
  roomsize: 'Reverb room size. Small = tight box, large = cathedral — controls tail length.',
  roomfade: 'Reverb fade time. How quickly the reverb tail decays.',
  roomlp: 'Reverb low-pass. Darkens the reverb tail — removes harsh reflections.',
  roomdim: 'Reverb damping. High frequencies decay faster — simulates soft room surfaces.',
  delay: 'Delay wet amount. Echo effect — adds rhythmic repeats of the sound.',
  delayfeedback: 'Delay feedback. How many echoes repeat — higher = longer, spiraling echoes.',
  delaytime: 'Delay time. Gap between echoes — syncs to rhythm for groovy repeats.',
  dry: 'Dry signal level. Amount of unprocessed sound — lower = more wet/effected.',
  echo: 'Echo effect amount. Combined delay with feedback — instant dub/space.',
  // MOD
  detune: 'Oscillator detune. Slightly shifts pitch — adds thickness and chorus-like width.',
  pan: 'Stereo panning. Moves sound left (-1) or right (+1) in the stereo field.',
  velocity: 'Note velocity/dynamics. Controls how hard notes are played — affects volume and tone.',
  postgain: 'Post-processing gain. Volume boost/cut after all effects — final level control.',
  vib: 'Vibrato depth. Pitch wobble amount — adds expression and liveliness.',
  vibmod: 'Vibrato rate. How fast the pitch wobbles — slow = expressive, fast = tremolo.',
  phaser: 'Phaser speed. Sweeping frequency notches — creates jet/swooshing sounds.',
  phaserdepth: 'Phaser depth. How deep the sweep goes — more = stronger swoosh.',
  phasercenter: 'Phaser center frequency. Where the phasing effect is focused.',
  phasersweep: 'Phaser sweep range. How wide the phaser sweeps across frequencies.',
  tremolosync: 'Tremolo sync. Locks tremolo speed to the beat — rhythmic volume pulsing.',
  tremolodepth: 'Tremolo depth. How much the volume wobbles — subtle shimmer to choppy gating.',
  tremoloskew: 'Tremolo waveform skew. Shapes the tremolo curve — affects the feel of the pulse.',
  tremolophase: 'Tremolo stereo phase. Left/right offset — creates moving stereo tremolo.',
  tremoloshape: 'Tremolo wave shape. Square = choppy gate, sine = smooth — changes character.',
  fast: 'Leslie speaker fast speed. Rotary effect spin rate for fast mode.',
  slow: 'Leslie speaker slow speed. Rotary effect spin rate for slow mode.',
  // FM
  fm: 'FM synthesis depth. Frequency modulation — adds metallic/bell-like harmonics.',
  fmh: 'FM harmonicity ratio. The modulator frequency multiplier — changes the timbre drastically.',
  fmattack: 'FM envelope attack. How fast FM kicks in on each note.',
  fmdecay: 'FM envelope decay. How quickly the FM effect fades after attack.',
  fmsustain: 'FM envelope sustain. FM level held during the note.',
  // PITCH
  penv: 'Pitch envelope depth. How much pitch bends on attack — zap/laser effects.',
  pattack: 'Pitch envelope attack. Speed of the initial pitch bend.',
  pdecay: 'Pitch envelope decay. How fast pitch returns to normal after bend.',
  prelease: 'Pitch envelope release. Pitch behavior after note release.',
  pcurve: 'Pitch envelope curve shape. Linear vs exponential pitch bending.',
  panchor: 'Pitch anchor point. Reference frequency for the pitch envelope.',
  // ENV
  attack: 'Amplitude attack. How fast the sound fades in — 0 = instant, high = slow swell.',
  decay: 'Amplitude decay. Time from peak to sustain level — short = percussive.',
  sustain: 'Amplitude sustain level. Volume held while note is on — 0 = pluck, 1 = organ.',
  rel: 'Amplitude release. How long the sound fades after note off — long = ambient tail.',
  release: 'Amplitude release (alias). Same as rel — controls the fade-out time.',
  legato: 'Legato mode. Overlapping notes glide instead of re-triggering — smooth lead lines.',
  clip: 'Hard clip level. Cuts the waveform at this amplitude — adds edge and presence.',
  // CHAIN
  duckdepth: 'Sidechain duck depth. How much the volume ducks when triggered — pumping/breathing effect.',
  duckattack: 'Sidechain duck attack. How fast the ducking kicks in — snappy vs smooth pump.',
  // SAMPLE
  loopAt: 'Loop point. Where the sample loops — creates sustained textures from one-shots.',
  loop: 'Loop on/off. Whether the sample repeats — essential for pads and sustained sounds.',
  begin: 'Sample start point. Where playback begins (0-1) — skip the attack, find sweet spots.',
  end: 'Sample end point. Where playback stops (0-1) — trim tails, create micro-loops.',
  speed: 'Playback speed/pitch. 1 = normal, 2 = octave up, 0.5 = octave down, -1 = reverse.',
  chop: 'Chop into N slices. Cuts sample into equal pieces — instant breakbeat/glitch.',
  stretch: 'Time-stretch mode. Changes speed without pitch — fit any sample to tempo.',
  slice: 'Slice selector. Picks which slice to play from a chopped sample.',
  splice: 'Splice mode. Like chop but with crossfades between slices — smoother cuts.',
  striate: 'Striate granular. Splits into granular slices with overlap — textural effects.',
  loopBegin: 'Loop region start. Where the loop portion begins within the sample.',
  loopEnd: 'Loop region end. Where the loop portion ends within the sample.',
  cut: 'Cut group. Samples in the same group cut each other off — like hi-hat open/close.',
  n: 'Sample index. Selects which sample from a folder/bank — browse through variations.',
  hurry: 'Hurry playback. Combined speed + gain boost — plays sample faster and louder.',
  unit: 'Speed unit mode. How speed value is interpreted — cycles, seconds, or ratio.',
}

// ─── Helper: get orbit from channel ───
function getChannelOrbit(channel: ParsedChannel): number {
  const p = channel.params.find(p => p.key === 'orbit')
  if (p && !p.isComplex) {
    const n = parseFloat(String(p.value))
    if (!isNaN(n)) return n
  }
  return 1
}

// ─────────────────────────────────────────────────────────────
//  TrackScope — per-track multi-mode audio visualizer
//  Click to cycle through: waveform → bars → mirror
// ─────────────────────────────────────────────────────────────
function TrackScope({
  channel, isPlaying, isMuted, scopeType, collapsed,
}: {
  channel: ParsedChannel
  isPlaying: boolean
  isMuted: boolean
  scopeType: TrackScopeType
  collapsed: boolean
  isSelected: boolean
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)
  const peakRef = useRef(0)
  const scopeTypeRef = useRef(scopeType)
  useEffect(() => { scopeTypeRef.current = scopeType }, [scopeType])

  const orbit = getChannelOrbit(channel)
  const color = channel.color

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const w = canvas.width
    const h = canvas.height
    const type = scopeTypeRef.current

    // Clear with subtle trail
    ctx.fillStyle = 'rgba(10, 11, 13, 0.35)'
    ctx.fillRect(0, 0, w, h)

    if (!isPlaying || isMuted) {
      peakRef.current = 0
      // Idle center line
      ctx.strokeStyle = `${color}15`
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(0, h / 2)
      ctx.lineTo(w, h / 2)
      ctx.stroke()
      rafRef.current = requestAnimationFrame(draw)
      return
    }

    const analyser = getOrbitAnalyser(orbit)
    if (!analyser) {
      // No analyser — dim dots
      ctx.fillStyle = `${color}20`
      for (let i = 0; i < 12; i++) {
        ctx.fillRect((i / 12) * w + w / 24 - 1, h / 2 - 1, 2, 2)
      }
      rafRef.current = requestAnimationFrame(draw)
      return
    }

    const bufLen = analyser.frequencyBinCount
    const timeData = new Uint8Array(bufLen)
    const freqData = new Uint8Array(bufLen)
    analyser.getByteTimeDomainData(timeData)
    analyser.getByteFrequencyData(freqData)

    // Compute peak
    let maxAmp = 0
    for (let i = 0; i < timeData.length; i++) {
      const abs = Math.abs(timeData[i] - 128)
      if (abs > maxAmp) maxAmp = abs
    }
    peakRef.current = Math.max(maxAmp, peakRef.current * 0.9)

    const intensity = Math.min(1, peakRef.current / 80)

    switch (type) {
      case 'waveform':
        drawWaveform(ctx, timeData, w, h, color, intensity)
        break
      case 'bars':
        drawBars(ctx, freqData, w, h, color, intensity)
        break
      case 'mirror':
        drawMirror(ctx, timeData, w, h, color, intensity)
        break
    }

    rafRef.current = requestAnimationFrame(draw)
  }, [isPlaying, isMuted, orbit, color])

  useEffect(() => {
    rafRef.current = requestAnimationFrame(draw)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [draw])

  const canvasH = collapsed ? 28 : 72

  return (
    <canvas
      ref={canvasRef}
      width={1200}
      height={canvasH}
      className="w-full h-full"
      style={{ display: 'block' }}
    />
  )
}

// ─── Drawing functions ───

function drawWaveform(
  ctx: CanvasRenderingContext2D, data: Uint8Array,
  w: number, h: number, color: string, intensity: number,
) {
  const cy = h / 2

  // Glow layer
  ctx.strokeStyle = `${color}50`
  ctx.lineWidth = 2.5 + intensity * 2
  ctx.beginPath()
  for (let x = 0; x < w; x++) {
    const idx = Math.floor((x / w) * data.length)
    const v = (data[idx] - 128) / 128
    const y = cy + v * cy * 0.85
    if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
  }
  ctx.stroke()

  // Sharp line
  ctx.strokeStyle = color
  ctx.lineWidth = 1.5
  ctx.beginPath()
  for (let x = 0; x < w; x++) {
    const idx = Math.floor((x / w) * data.length)
    const v = (data[idx] - 128) / 128
    const y = cy + v * cy * 0.85
    if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
  }
  ctx.stroke()

  // Fill under curve
  ctx.lineTo(w, cy)
  ctx.lineTo(0, cy)
  ctx.closePath()
  ctx.fillStyle = `${color}08`
  ctx.fill()
}

function drawBars(
  ctx: CanvasRenderingContext2D, data: Uint8Array,
  w: number, h: number, color: string, _intensity: number,
) {
  const barCount = 64
  const barW = w / barCount - 1
  const gap = 1

  for (let i = 0; i < barCount; i++) {
    const dataIdx = Math.floor((i / barCount) * data.length * 0.6)
    const val = data[dataIdx] / 255
    const barH = val * h * 0.92
    const x = i * (barW + gap)
    const y = h - barH

    // Color varies by frequency
    const alpha = 0.25 + val * 0.65
    ctx.fillStyle = `${color}${Math.round(alpha * 255).toString(16).padStart(2, '0')}`
    ctx.fillRect(x, y, barW, barH)

    // Top cap
    if (barH > 2) {
      ctx.fillStyle = color
      ctx.fillRect(x, y, barW, 1.5)
    }
  }
}

function drawMirror(
  ctx: CanvasRenderingContext2D, data: Uint8Array,
  w: number, h: number, color: string, _intensity: number,
) {
  const cy = h / 2

  // Top half
  ctx.strokeStyle = `${color}60`
  ctx.lineWidth = 1.5
  ctx.beginPath()
  for (let x = 0; x < w; x++) {
    const idx = Math.floor((x / w) * data.length)
    const v = Math.abs(data[idx] - 128) / 128
    const y = cy - v * cy * 0.85
    if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
  }
  ctx.stroke()

  // Fill top
  ctx.lineTo(w, cy)
  ctx.lineTo(0, cy)
  ctx.closePath()
  ctx.fillStyle = `${color}10`
  ctx.fill()

  // Bottom half (mirror)
  ctx.strokeStyle = `${color}40`
  ctx.lineWidth = 1
  ctx.beginPath()
  for (let x = 0; x < w; x++) {
    const idx = Math.floor((x / w) * data.length)
    const v = Math.abs(data[idx] - 128) / 128
    const y = cy + v * cy * 0.85
    if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
  }
  ctx.stroke()

  // Fill bottom
  ctx.lineTo(w, cy)
  ctx.lineTo(0, cy)
  ctx.closePath()
  ctx.fillStyle = `${color}08`
  ctx.fill()

  // Center line
  ctx.strokeStyle = `${color}25`
  ctx.lineWidth = 0.5
  ctx.beginPath()
  ctx.moveTo(0, cy)
  ctx.lineTo(w, cy)
  ctx.stroke()
}

// ─── Mini peak meter ───
function PeakMeter({ channel, isPlaying, isMuted }: { channel: ParsedChannel; isPlaying: boolean; isMuted: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)
  const peakRef = useRef(0)

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const w = canvas.width
    const h = canvas.height
    ctx.clearRect(0, 0, w, h)

    if (!isPlaying || isMuted) {
      ctx.fillStyle = 'rgba(255,255,255,0.03)'
      ctx.fillRect(0, 0, w, h)
      peakRef.current = 0
      rafRef.current = requestAnimationFrame(draw)
      return
    }

    const orbit = getChannelOrbit(channel)
    const analyser = getOrbitAnalyser(orbit)
    if (analyser) {
      const data = new Uint8Array(analyser.frequencyBinCount)
      analyser.getByteTimeDomainData(data)
      let maxAmp = 0
      for (let i = 0; i < data.length; i++) {
        const abs = Math.abs(data[i] - 128)
        if (abs > maxAmp) maxAmp = abs
      }
      peakRef.current = Math.max(maxAmp, peakRef.current * 0.88)
    }

    const level = Math.min(peakRef.current / 100, 1)
    const barH = level * h
    ctx.fillStyle = 'rgba(255,255,255,0.02)'
    ctx.fillRect(0, 0, w, h)
    const gradient = ctx.createLinearGradient(0, h, 0, 0)
    gradient.addColorStop(0, `${channel.color}80`)
    gradient.addColorStop(0.7, `${channel.color}60`)
    gradient.addColorStop(1, '#b86f6f80')
    ctx.fillStyle = gradient
    ctx.fillRect(0, h - barH, w, barH)
    if (level > 0.05) {
      ctx.fillStyle = channel.color
      ctx.fillRect(0, h - barH, w, 1)
    }
    rafRef.current = requestAnimationFrame(draw)
  }, [isPlaying, isMuted, channel])

  useEffect(() => {
    rafRef.current = requestAnimationFrame(draw)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [draw])

  return (
    <canvas ref={canvasRef} width={4} height={60} className="rounded-sm"
      style={{ width: 3, height: '100%', minHeight: 20 }} />
  )
}

// ─── Playhead overlay ───
function PlayheadOverlay({ getCyclePosition, isPlaying, trackCount }: {
  getCyclePosition?: () => number | null; isPlaying: boolean; trackCount: number
}) {
  const lineRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number>(0)

  const animate = useCallback(() => {
    if (!isPlaying || !getCyclePosition || !lineRef.current) {
      if (lineRef.current) lineRef.current.style.opacity = '0'
      rafRef.current = requestAnimationFrame(animate)
      return
    }
    const pos = getCyclePosition()
    if (pos === null) {
      lineRef.current.style.opacity = '0'
      rafRef.current = requestAnimationFrame(animate)
      return
    }
    const frac = pos - Math.floor(pos)
    lineRef.current.style.left = `${frac * 100}%`
    lineRef.current.style.opacity = '1'
    rafRef.current = requestAnimationFrame(animate)
  }, [isPlaying, getCyclePosition])

  useEffect(() => {
    rafRef.current = requestAnimationFrame(animate)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [animate])

  if (trackCount === 0) return null

  return (
    <div ref={lineRef}
      className="absolute top-0 bottom-0 z-20 pointer-events-none"
      style={{
        width: 2, opacity: 0,
        background: 'linear-gradient(180deg, #7fa998 0%, #7fa99880 50%, #7fa998 100%)',
        boxShadow: '0 0 8px #7fa99860, 0 0 16px #7fa99830',
      }}
    >
      <div className="absolute -top-1 -translate-x-1/2 left-1/2"
        style={{ width: 0, height: 0, borderLeft: '4px solid transparent', borderRight: '4px solid transparent', borderTop: '5px solid #7fa998' }} />
    </div>
  )
}

// ─── Beat grid ───
function BeatGrid() {
  return (
    <div className="absolute inset-0 pointer-events-none z-[1]">
      {[0.25, 0.5, 0.75].map((pct) => (
        <div key={pct} className="absolute top-0 bottom-0"
          style={{ left: `${pct * 100}%`, width: 1,
            background: pct === 0.5 ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.025)' }} />
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  Effects Panel — Hardware rack unit style FX plugin
//  Realistic metallic textures, beveled panels, screws, big knobs
// ─────────────────────────────────────────────────────────────

// Screw component for realistic hardware look
function Screw({ x, y }: { x: string; y: string }) {
  return (
    <div
      className="absolute"
      style={{
        left: x, top: y, width: 8, height: 8,
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #4a4e56 0%, #2a2d32 50%, #3a3d44 100%)',
        boxShadow: 'inset 1px 1px 2px rgba(255,255,255,0.1), inset -1px -1px 2px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.5)',
      }}
    >
      {/* Phillips head cross */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div style={{ width: 5, height: 0.8, background: 'rgba(0,0,0,0.5)', borderRadius: 1, position: 'absolute' }} />
        <div style={{ width: 0.8, height: 5, background: 'rgba(0,0,0,0.5)', borderRadius: 1, position: 'absolute' }} />
      </div>
    </div>
  )
}

// Group label badge
function GroupBadge({ label, icon, isActive, hasActiveKnobs, color, onClick }: {
  label: string; icon: string; isActive: boolean; hasActiveKnobs: boolean; color: string; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded transition-all duration-150 cursor-pointer border"
      style={{
        background: isActive
          ? 'linear-gradient(180deg, #2a2d35 0%, #1e2028 100%)'
          : 'linear-gradient(180deg, #1a1c22 0%, #14161a 100%)',
        border: isActive
          ? `1px solid ${color}50`
          : '1px solid rgba(255,255,255,0.06)',
        boxShadow: isActive
          ? `inset 0 1px 0 rgba(255,255,255,0.06), 0 0 8px ${color}15`
          : 'inset 0 1px 0 rgba(255,255,255,0.03), 0 1px 3px rgba(0,0,0,0.3)',
        color: isActive ? color : '#6b7280',
        fontSize: '8px',
        fontWeight: 800,
        letterSpacing: '0.12em',
      }}
    >
      <span className="text-[10px]">{icon}</span>
      <span>{label}</span>
      {hasActiveKnobs && (
        <div
          className="w-1.5 h-1.5 rounded-full"
          style={{
            background: color,
            boxShadow: `0 0 4px ${color}80`,
          }}
        />
      )}
    </button>
  )
}

function EffectsPanel({
  channel, channelIdx,
  onParamChange, onEffectInsert, onRemoveEffect,
}: {
  channel: ParsedChannel
  channelIdx: number
  isPlaying: boolean
  onParamChange: (channelIdx: number, key: string, value: number) => void
  onEffectInsert: (channelIdx: number, effectCode: string) => void
  onRemoveEffect: (channelIdx: number, effectKey: string) => void
}) {
  const [activeGroup, setActiveGroup] = useState<string | null>(null)
  const [panelHeight, setPanelHeight] = useState(220)
  const resizeRef = useRef<{ startY: number; startH: number } | null>(null)

  // Get relevant groups for this channel type
  const relevantGroupNames = TYPE_RELEVANT_GROUPS[channel.sourceType] || TYPE_RELEVANT_GROUPS.sample

  // Build groups with param data
  const groups = useMemo(() => {
    return FX_GROUPS
      .filter(g => relevantGroupNames.has(g.label))
      .map(group => {
        const knobs = group.keys
          .map(key => {
            const paramDef = PARAM_DEFS.find((p: ParamDef) => p.key === key)
            if (!paramDef) return null
            const existingParam = channel.params.find(p => p.key === key)
            return { paramDef, existingParam, key }
          })
          .filter(Boolean) as { paramDef: ParamDef; existingParam: ParsedChannel['params'][number] | undefined; key: string }[]
        return { ...group, knobs, hasActive: knobs.some(k => k.existingParam) }
      })
  }, [channel, relevantGroupNames])

  // Default to first group with active params, or first relevant group
  useEffect(() => {
    if (activeGroup === null || !groups.find(g => g.label === activeGroup)) {
      const firstActive = groups.find(g => g.hasActive)
      setActiveGroup(firstActive?.label || groups[0]?.label || null)
    }
  }, [groups, activeGroup])

  const currentGroup = groups.find(g => g.label === activeGroup)

  // Resize handle
  const handleResizeDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    resizeRef.current = { startY: e.clientY, startH: panelHeight }
    const onMove = (ev: PointerEvent) => {
      if (!resizeRef.current) return
      const dy = resizeRef.current.startY - ev.clientY
      setPanelHeight(Math.max(160, Math.min(450, resizeRef.current.startH + dy)))
    }
    const onUp = () => {
      resizeRef.current = null
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }, [panelHeight])

  // Channel type label
  const typeLabel = channel.sourceType === 'synth' ? 'SYNTHESIZER' :
    channel.sourceType === 'note' ? 'INSTRUMENT' :
    channel.sourceType === 'stack' ? 'DRUM MACHINE' :
    channel.sourceType === 'sample' ? (channel.effects.includes('loopAt') ? 'VOCAL' : 'SAMPLER') : 'CHANNEL'

  return (
    <div
      className="shrink-0 relative overflow-hidden"
      style={{
        height: panelHeight,
        // Faceplate: brushed dark metal look
        background: `
          linear-gradient(180deg,
            #1c1e24 0%,
            #181a1f 3%,
            #151720 50%,
            #131518 97%,
            #1a1c22 100%
          )`,
        borderTop: '2px solid #2a2d35',
        boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.4), inset 0 -1px 0 rgba(255,255,255,0.03)',
      }}
    >
      {/* ── Resize handle bar ── */}
      <div
        className="absolute top-0 left-0 right-0 h-2 cursor-ns-resize z-30 flex items-center justify-center"
        onPointerDown={handleResizeDown}
        style={{ background: 'linear-gradient(180deg, #2a2d35 0%, transparent 100%)' }}
      >
        <div style={{ width: 32, height: 2, borderRadius: 1, background: 'rgba(255,255,255,0.08)' }} />
      </div>

      {/* ── Corner screws ── */}
      <Screw x="6px" y="6px" />
      <Screw x="calc(100% - 14px)" y="6px" />
      <Screw x="6px" y="calc(100% - 14px)" />
      <Screw x="calc(100% - 14px)" y="calc(100% - 14px)" />

      {/* ── Header strip ── */}
      <div
        className="flex items-center gap-3 px-8 pt-3 pb-1.5"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
      >
        {/* Brand plate */}
        <div className="flex items-center gap-2 shrink-0">
          {/* LED power indicator */}
          <div
            className="rounded-full"
            style={{
              width: 6, height: 6,
              background: `radial-gradient(circle, ${channel.color} 30%, ${channel.color}60 70%, transparent 100%)`,
              boxShadow: `0 0 6px ${channel.color}60, 0 0 2px ${channel.color}`,
            }}
          />
          <div className="flex flex-col">
            <span
              className="text-[10px] font-black tracking-[.25em] uppercase leading-none"
              style={{
                color: channel.color,
                textShadow: `0 0 8px ${channel.color}30`,
                fontFamily: 'system-ui, sans-serif',
              }}
            >
              444 FX
            </span>
            <span className="text-[6px] font-bold tracking-[.2em] uppercase leading-none mt-0.5"
              style={{ color: '#5a616b' }}>
              {typeLabel}
            </span>
          </div>
        </div>

        {/* Embossed channel name */}
        <div
          className="px-3 py-1 rounded"
          style={{
            background: 'linear-gradient(180deg, #0d0e12 0%, #111318 100%)',
            border: '1px solid rgba(255,255,255,0.04)',
            boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.5), 0 1px 0 rgba(255,255,255,0.02)',
          }}
        >
          <span className="text-[9px] font-extrabold uppercase tracking-[.15em] font-mono" style={{ color: channel.color }}>
            {channel.name}
          </span>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Group selector tabs */}
        <div className="flex items-center gap-1 overflow-x-auto">
          {groups.map(g => (
            <GroupBadge
              key={g.label}
              label={g.label}
              icon={g.icon}
              isActive={activeGroup === g.label}
              hasActiveKnobs={g.hasActive}
              color={channel.color}
              onClick={() => setActiveGroup(g.label)}
            />
          ))}
        </div>
      </div>

      {/* ── Knobs faceplate area ── */}
      {currentGroup && (
        <div className="flex-1 overflow-y-auto px-6 pt-3 pb-4"
          style={{ height: panelHeight - 56 }}
        >
          {/* Group section header with recessed strip */}
          <div className="flex items-center gap-3 mb-3">
            <div
              className="px-3 py-1 rounded-sm"
              style={{
                background: 'linear-gradient(180deg, #0c0d10 0%, #111318 100%)',
                border: '1px solid rgba(255,255,255,0.03)',
                boxShadow: 'inset 0 1px 4px rgba(0,0,0,0.6)',
              }}
            >
              <span className="text-[8px] font-black tracking-[.2em] uppercase"
                style={{ color: `${channel.color}90` }}>
                {currentGroup.icon} {currentGroup.label}
              </span>
            </div>
            <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, rgba(255,255,255,0.06) 0%, transparent 100%)' }} />
            <span className="text-[7px] font-bold" style={{ color: '#3a3d44' }}>
              {currentGroup.knobs.filter(k => k.existingParam).length}/{currentGroup.knobs.length}
            </span>
          </div>

          {/* Knobs grid — big hardware knobs */}
          <div className="flex flex-wrap gap-x-2 gap-y-3 justify-start">
            {currentGroup.knobs.map(({ paramDef, existingParam, key }) => {
              const hasValue = !!existingParam
              const knobValue = existingParam ? existingParam.value : paramDef.min
              const isComplex = existingParam?.isComplex

              return (
                <HardwareKnob
                  key={key}
                  label={paramDef.label}
                  value={knobValue}
                  min={paramDef.min}
                  max={paramDef.max}
                  step={paramDef.step}
                  size={48}
                  color={hasValue ? channel.color : '#4a4e56'}
                  unit={paramDef.unit}
                  isComplex={isComplex}
                  active={hasValue}
                  paramKey={key}
                  description={FX_DESCRIPTIONS[key]}
                  onRemove={hasValue ? () => onRemoveEffect(channelIdx, key) : undefined}
                  onChange={(v: number) => {
                    if (hasValue) {
                      onParamChange(channelIdx, key, v)
                    } else {
                      onEffectInsert(channelIdx, `.${key}(${v})`)
                    }
                  }}
                />
              )
            })}
          </div>
        </div>
      )}

      {/* ── Bottom strip — embossed branding ── */}
      <div
        className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-8 py-1"
        style={{
          background: 'linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.2) 100%)',
          borderTop: '1px solid rgba(255,255,255,0.02)',
        }}
      >
        <span className="text-[6px] font-bold tracking-[.3em] uppercase" style={{ color: '#2a2d32' }}>
          444RADIO EFFECTS RACK
        </span>
        <span className="text-[6px] font-bold tracking-[.2em]" style={{ color: '#2a2d32' }}>
          v1.0
        </span>
      </div>

      {/* ── Subtle texture overlay for brushed metal feel ── */}
      <div
        className="absolute inset-0 pointer-events-none z-10"
        style={{
          backgroundImage: `repeating-linear-gradient(
            0deg,
            transparent,
            transparent 1px,
            rgba(255,255,255,0.003) 1px,
            rgba(255,255,255,0.003) 2px
          )`,
          mixBlendMode: 'overlay',
        }}
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  Inline knobs row — shown on expanded tracks for active effects
// ─────────────────────────────────────────────────────────────
function InlineKnobs({ channel, channelIdx, onParamChange }: {
  channel: ParsedChannel; channelIdx: number
  onParamChange: (channelIdx: number, key: string, value: number) => void
}) {
  // Show active params (excluding gain/orbit)
  const knobs = useMemo(() => {
    return channel.params.filter(p => !['gain', 'orbit'].includes(p.key))
  }, [channel.params])

  if (knobs.length === 0) return null

  return (
    <div className="flex items-center gap-0.5 overflow-x-auto py-0.5 px-1" onClick={(e) => e.stopPropagation()}>
      {knobs.slice(0, 8).map(p => {
        const paramDef = PARAM_DEFS.find((d: ParamDef) => d.key === p.key)
        if (!paramDef) return null
        return (
          <StudioKnob
            key={p.key}
            label={paramDef.label}
            value={p.value}
            min={paramDef.min}
            max={paramDef.max}
            step={paramDef.step}
            size={18}
            color={channel.color}
            isComplex={p.isComplex}
            onChange={(v: number) => onParamChange(channelIdx, p.key, v)}
          />
        )
      })}
      {knobs.length > 8 && (
        <span className="text-[5px] font-bold shrink-0 px-0.5" style={{ color: `${channel.color}50` }}>
          +{knobs.length - 8}
        </span>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  Main TrackView component
// ─────────────────────────────────────────────────────────────

interface TrackViewProps {
  channels: ParsedChannel[]
  isPlaying: boolean
  mutedChannels: Set<number>
  soloedChannels: Set<number>
  trackCollapsed: Set<number>
  dragOverChannel: number | null
  getCyclePosition?: () => number | null
  projectBpm: number
  onToggleCollapse: (idx: number) => void
  onSolo: (idx: number) => void
  onMute: (idx: number) => void
  onToggleChannel: (id: string) => void
  onParamChange: (channelIdx: number, key: string, value: number) => void
  onEffectInsert: (channelIdx: number, effectCode: string) => void
  onRemoveEffect: (channelIdx: number, effectKey: string) => void
  onOpenPianoRoll?: (idx: number) => void
  onOpenDrumSequencer?: (idx: number) => void
  onOpenPadSampler?: (idx: number) => void
  onDragOver: (idx: number) => void
  onDragLeave: () => void
  onDrop: (idx: number, e: React.DragEvent) => void
  onShowAddMenu: () => void
  getSourceIcon: (source: string, sourceType: string) => string
}

const TrackView = memo(function TrackView({
  channels,
  isPlaying,
  mutedChannels,
  soloedChannels,
  trackCollapsed,
  dragOverChannel,
  getCyclePosition,
  onToggleCollapse,
  onSolo,
  onMute,
  onParamChange,
  onEffectInsert,
  onRemoveEffect,
  onOpenPianoRoll,
  onOpenDrumSequencer,
  onOpenPadSampler,
  onDragOver,
  onDragLeave,
  onDrop,
  onShowAddMenu,
  getSourceIcon,
}: TrackViewProps) {
  // Selected track: always one is selected (default 0)
  const [selectedTrack, setSelectedTrack] = useState(0)
  // Per-track scope type
  const [trackScopes, setTrackScopes] = useState<Record<number, TrackScopeType>>({})

  // Ensure selected track is valid
  useEffect(() => {
    if (channels.length > 0 && selectedTrack >= channels.length) {
      setSelectedTrack(0)
    }
  }, [channels.length, selectedTrack])

  const cycleScopeType = useCallback((idx: number) => {
    setTrackScopes(prev => {
      const current = prev[idx] || 'waveform'
      const currentIdx = TRACK_SCOPE_TYPES.findIndex(s => s.id === current)
      const nextIdx = (currentIdx + 1) % TRACK_SCOPE_TYPES.length
      return { ...prev, [idx]: TRACK_SCOPE_TYPES[nextIdx].id }
    })
  }, [])

  const selectedChannel = channels[selectedTrack]

  return (
    <div className="flex flex-col h-full">
      {/* ── Tracks area (scrollable) ── */}
      <div className="flex-1 flex flex-col overflow-auto relative">
        {/* Beat ruler */}
        <div className="h-5 flex items-end relative shrink-0 sticky top-0 z-30"
          style={{ background: '#0d0e11', borderBottom: '1px solid rgba(255,255,255,0.05)', marginLeft: 160 }}>
          {[1, 2, 3, 4].map((beat) => (
            <div key={beat} className="flex-1 text-center"
              style={{ borderLeft: beat > 1 ? '1px solid rgba(255,255,255,0.04)' : undefined }}>
              <span className="text-[7px] font-mono font-bold" style={{ color: '#5a616b60' }}>{beat}</span>
            </div>
          ))}
        </div>

        {/* Tracks container */}
        <div className="relative">
          {/* Playhead */}
          <div className="absolute top-0 bottom-0 right-0 z-20 pointer-events-none" style={{ left: 160 }}>
            <PlayheadOverlay getCyclePosition={getCyclePosition} isPlaying={isPlaying} trackCount={channels.length} />
          </div>

          {/* Track lanes */}
          {channels.map((ch, idx) => {
            const isMuted = mutedChannels.has(idx)
            const isSoloed = soloedChannels.has(idx)
            const isActive = isPlaying && !isMuted
            const collapsed = trackCollapsed.has(idx)
            const isSelected = selectedTrack === idx
            const gainParam = ch.params.find(p => p.key === 'gain')
            const scopeType = trackScopes[idx] || 'waveform'

            // Editor type
            const isVocal = ch.sourceType === 'sample' && ch.effects.includes('loopAt')
            const isMelodic = ch.sourceType === 'synth' || ch.sourceType === 'note'
            const isDrum = (ch.sourceType === 'sample' && !ch.effects.includes('loopAt')) || ch.sourceType === 'stack'
            const primaryEditor = isVocal ? 'sampler' : isMelodic ? 'piano' : isDrum ? 'drum' : 'piano'

            return (
              <div
                key={ch.id}
                className={`flex transition-all duration-200 ${isMuted ? 'opacity-35' : ''}`}
                style={{
                  background: isSelected ? '#131620' : '#111318',
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                  minHeight: collapsed ? 32 : 80,
                  borderLeft: isSelected ? `2px solid ${ch.color}60` : '2px solid transparent',
                }}
              >
                {/* ── LEFT PANEL ── */}
                <div
                  className="shrink-0 flex flex-col border-r relative overflow-hidden cursor-pointer"
                  style={{ width: 158, borderColor: `${ch.color}18`, background: isSelected ? '#0e1016' : '#0d0e11' }}
                  onClick={() => setSelectedTrack(idx)}
                >
                  {/* Color accent */}
                  <div className="absolute top-0 left-0 right-0"
                    style={{
                      height: 2,
                      background: `linear-gradient(90deg, ${ch.color} 0%, ${ch.color}40 100%)`,
                      opacity: isMuted ? 0.15 : isActive ? 1 : 0.5,
                      boxShadow: isActive ? `0 0 8px ${ch.color}50` : 'none',
                    }} />

                  {/* Controls row */}
                  <div className="flex items-center gap-1 px-2 pt-2 pb-0.5">
                    <button onClick={(e) => { e.stopPropagation(); onToggleCollapse(idx) }}
                      className="cursor-pointer" style={{ color: '#5a616b', background: 'none', border: 'none', padding: 0 }}>
                      {collapsed ? <ChevronRight size={10} /> : <ChevronDown size={10} />}
                    </button>

                    <button onClick={(e) => { e.stopPropagation(); onSolo(idx) }}
                      className="cursor-pointer transition-all duration-100 active:scale-90"
                      style={{
                        width: 16, height: 16, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '7px', fontWeight: 900, lineHeight: 1,
                        color: isSoloed ? '#b8a47f' : '#5a616b', background: isSoloed ? '#1a1a16' : '#0a0b0d', border: 'none',
                        boxShadow: isSoloed ? `inset 2px 2px 4px #050607, inset -2px -2px 4px #1a1d22, 0 0 4px #b8a47f30` : '2px 2px 4px #050607, -2px -2px 4px #1a1d22',
                      }}>S</button>

                    <button onClick={(e) => { e.stopPropagation(); onMute(idx) }}
                      className="cursor-pointer transition-all duration-100 active:scale-90"
                      style={{
                        width: 16, height: 16, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '7px', fontWeight: 900, lineHeight: 1,
                        color: isMuted ? '#b86f6f' : '#5a616b', background: isMuted ? '#1a1114' : '#0a0b0d', border: 'none',
                        boxShadow: isMuted ? `inset 2px 2px 4px #050607, inset -2px -2px 4px #1a1d22, 0 0 4px #b86f6f30` : '2px 2px 4px #050607, -2px -2px 4px #1a1d22',
                      }}>M</button>

                    <PeakMeter channel={ch} isPlaying={isPlaying} isMuted={isMuted} />

                    <span className="flex-1 min-w-0 truncate text-[8px] font-extrabold uppercase tracking-[.12em] font-mono"
                      style={{ color: ch.color }} title={ch.name}>
                      <span className="text-[9px] mr-0.5 opacity-60">{getSourceIcon(ch.source, ch.sourceType)}</span>
                      {ch.name}
                    </span>
                  </div>

                  {/* Expanded: gain knob + editor + inline knobs */}
                  {!collapsed && (
                    <div className="flex flex-col gap-0.5 px-2 pb-1">
                      <div className="flex items-center gap-1">
                        <div onClick={(e) => e.stopPropagation()} className="shrink-0">
                          <StudioKnob label="" value={gainParam?.value ?? 0.8} min={0} max={2} step={0.01} size={22}
                            color={ch.color} isComplex={gainParam?.isComplex} onChange={(v: number) => onParamChange(idx, 'gain', v)} />
                        </div>
                        {primaryEditor === 'piano' && onOpenPianoRoll && (
                          <button onClick={(e) => { e.stopPropagation(); onOpenPianoRoll(idx) }}
                            className="flex items-center gap-0.5 px-1.5 py-1 rounded cursor-pointer transition-all hover:opacity-100 active:scale-95"
                            style={{ color: '#6f8fb3', opacity: 0.8, background: 'rgba(111,143,179,0.08)', border: '1px solid rgba(111,143,179,0.12)', fontSize: 0 }}>
                            <Piano size={10} /><span className="text-[6px] font-bold leading-none">NOTES</span>
                          </button>
                        )}
                        {primaryEditor === 'drum' && onOpenDrumSequencer && (
                          <button onClick={(e) => { e.stopPropagation(); onOpenDrumSequencer(idx) }}
                            className="flex items-center gap-0.5 px-1.5 py-1 rounded cursor-pointer transition-all hover:opacity-100 active:scale-95"
                            style={{ color: '#b8a47f', opacity: 0.8, background: 'rgba(184,164,127,0.08)', border: '1px solid rgba(184,164,127,0.12)', fontSize: 0 }}>
                            <Grid3X3 size={10} /><span className="text-[6px] font-bold leading-none">STEPS</span>
                          </button>
                        )}
                        {primaryEditor === 'sampler' && onOpenPadSampler && (
                          <button onClick={(e) => { e.stopPropagation(); onOpenPadSampler(idx) }}
                            className="flex items-center gap-0.5 px-1.5 py-1 rounded cursor-pointer transition-all hover:opacity-100 active:scale-95"
                            style={{ color: '#22d3ee', opacity: 0.8, background: 'rgba(34,211,238,0.08)', border: '1px solid rgba(34,211,238,0.12)', fontSize: 0 }}>
                            <span className="text-[9px]">🎹</span><span className="text-[6px] font-bold leading-none">PAD</span>
                          </button>
                        )}
                      </div>
                      {/* Inline effect knobs */}
                      <InlineKnobs channel={ch} channelIdx={idx} onParamChange={onParamChange} />
                    </div>
                  )}
                </div>

                {/* ── RIGHT SCOPE ── */}
                <div
                  className="flex-1 min-w-0 relative overflow-hidden cursor-pointer"
                  style={{
                    background: '#0a0b0d',
                    borderLeft: isActive ? `1px solid ${ch.color}35` : '1px solid rgba(255,255,255,0.02)',
                  }}
                  onClick={() => cycleScopeType(idx)}
                  onDragOver={(e) => { e.preventDefault(); onDragOver(idx) }}
                  onDragLeave={onDragLeave}
                  onDrop={(e) => onDrop(idx, e)}
                  title="Click to change visualizer"
                >
                  <BeatGrid />

                  {/* Scope */}
                  <div className="absolute inset-0 z-[2]">
                    <TrackScope
                      channel={ch} isPlaying={isPlaying} isMuted={isMuted}
                      scopeType={scopeType} collapsed={collapsed} isSelected={isSelected}
                    />
                  </div>

                  {/* Active glow */}
                  {isActive && (
                    <div className="absolute inset-0 pointer-events-none z-[3]"
                      style={{
                        background: `linear-gradient(90deg, ${ch.color}06 0%, transparent 15%, transparent 85%, ${ch.color}04 100%)`,
                        borderTop: `1px solid ${ch.color}08`, borderBottom: `1px solid ${ch.color}08`,
                      }} />
                  )}

                  {/* Scope type label */}
                  <div className="absolute top-1 right-2 z-[5]">
                    <span className="text-[6px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full opacity-30 hover:opacity-80 transition-opacity"
                      style={{ color: `${ch.color}`, background: 'rgba(10,11,13,0.8)', border: `1px solid ${ch.color}20` }}>
                      {TRACK_SCOPE_TYPES.find(s => s.id === scopeType)?.label || 'WAVE'}
                    </span>
                  </div>

                  {/* Channel type badge */}
                  <div className="absolute bottom-1 right-2 z-[5] text-[5px] font-bold uppercase tracking-widest font-mono"
                    style={{ color: `${ch.color}25` }}>
                    {ch.sourceType === 'synth' ? 'SYNTH' :
                     ch.sourceType === 'note' ? 'INST' :
                     ch.sourceType === 'stack' ? 'DRUM' :
                     ch.sourceType === 'sample' ? (ch.effects.includes('loopAt') ? 'VOCAL' : 'SAMPLE') : 'CH'}
                  </div>

                  {/* Selected indicator */}
                  {isSelected && (
                    <div className="absolute top-0 bottom-0 left-0 w-0.5 z-[6]"
                      style={{ background: ch.color, boxShadow: `0 0 6px ${ch.color}40` }} />
                  )}

                  {/* Drop FX indicator */}
                  {dragOverChannel === idx && (
                    <div className="absolute inset-0 flex items-center justify-center z-10"
                      style={{ background: 'rgba(127,169,152,0.1)', border: '2px solid rgba(127,169,152,0.4)', borderRadius: 4 }}>
                      <span className="text-[10px] font-bold" style={{ color: '#7fa998' }}>⬇ DROP FX</span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}

          {/* Add Track button */}
          <button onClick={onShowAddMenu}
            className="flex items-center justify-center gap-2 py-3 w-full cursor-pointer transition-all duration-200 hover:bg-white/[0.02] group"
            style={{ background: '#0d0e11', color: '#5a616b', border: 'none' }}>
            <div className="w-5 h-5 rounded-full flex items-center justify-center transition-all group-hover:scale-110"
              style={{ background: '#111318', boxShadow: '2px 2px 4px #050607, -2px -2px 4px #1a1d22' }}>
              <Plus size={11} style={{ color: '#7fa998' }} />
            </div>
            <span className="text-[9px] font-bold tracking-wide group-hover:text-white/50 transition-colors">Add Track</span>
          </button>
        </div>
      </div>

      {/* ── Effects Panel (always visible for selected track) ── */}
      {selectedChannel && (
        <EffectsPanel
          channel={selectedChannel}
          channelIdx={selectedTrack}
          isPlaying={isPlaying}
          onParamChange={onParamChange}
          onEffectInsert={onEffectInsert}
          onRemoveEffect={onRemoveEffect}
        />
      )}
    </div>
  )
})

export default TrackView
