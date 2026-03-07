'use client'

// ═══════════════════════════════════════════════════════════════
//  STUDIO EFFECTS PANEL — Extracted 444 FX hardware rack
//
//  Originally bottom panel in TrackView, now a standalone component
//  for use as a right sidebar in StudioMixerRack.
// ═══════════════════════════════════════════════════════════════

import { useRef, useEffect, useCallback, useState, useMemo } from 'react'
import HardwareKnob from './HardwareKnob'
import { PARAM_DEFS, type ParsedChannel, type ParamDef } from '@/lib/strudel-code-parser'

// ─── FX groups definition ───
export const FX_GROUPS: { label: string; icon: string; keys: string[] }[] = [
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
export const TYPE_RELEVANT_GROUPS: Record<string, Set<string>> = {
  synth:  new Set(['FILTER', 'DRIVE', 'SPACE', 'MOD', 'FM', 'PITCH', 'ENV']),
  note:   new Set(['FILTER', 'DRIVE', 'SPACE', 'MOD', 'FM', 'PITCH', 'ENV']),
  sample: new Set(['FILTER', 'DRIVE', 'SPACE', 'MOD', 'PITCH', 'ENV', 'SAMPLE', 'CHAIN']),
  stack:  new Set(['FILTER', 'DRIVE', 'SPACE', 'MOD', 'ENV', 'CHAIN']),
}

// ─── FX Descriptions — what each effect does to the sound ───
export const FX_DESCRIPTIONS: Record<string, string> = {
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

// ─── Screw decoration ───
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
      <div className="absolute inset-0 flex items-center justify-center">
        <div style={{ width: 5, height: 0.8, background: 'rgba(0,0,0,0.5)', borderRadius: 1, position: 'absolute' }} />
        <div style={{ width: 0.8, height: 5, background: 'rgba(0,0,0,0.5)', borderRadius: 1, position: 'absolute' }} />
      </div>
    </div>
  )
}

// ─── Group label badge ───
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

// ─── Layout mode ───
export type EffectsPanelLayout = 'bottom' | 'sidebar'

// ─── Main Effects Panel ───
export default function StudioEffectsPanel({
  channel, channelIdx,
  onParamChange, onEffectInsert, onRemoveEffect,
  layout = 'sidebar',
  onClose,
}: {
  channel: ParsedChannel
  channelIdx: number
  onParamChange: (channelIdx: number, key: string, value: number) => void
  onEffectInsert: (channelIdx: number, effectCode: string) => void
  onRemoveEffect: (channelIdx: number, effectKey: string) => void
  layout?: EffectsPanelLayout
  onClose?: () => void
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

  // Resize handle (only for bottom layout)
  const handleResizeDown = useCallback((e: React.PointerEvent) => {
    if (layout !== 'bottom') return
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
  }, [panelHeight, layout])

  // Channel type label
  const typeLabel = channel.sourceType === 'synth' ? 'SYNTHESIZER' :
    channel.sourceType === 'note' ? 'INSTRUMENT' :
    channel.sourceType === 'stack' ? 'DRUM MACHINE' :
    channel.sourceType === 'sample' ? (channel.effects.includes('loopAt') ? 'VOCAL' : 'SAMPLER') : 'CHANNEL'

  const isSidebar = layout === 'sidebar'

  // ── Sidebar layout ──
  if (isSidebar) {
    return (
      <div
        className="h-full flex flex-col overflow-hidden"
        style={{
          width: 280,
          background: `linear-gradient(180deg, #1c1e24 0%, #151720 50%, #131518 100%)`,
          borderLeft: '2px solid #2a2d35',
          boxShadow: 'inset 2px 0 4px rgba(0,0,0,0.4)',
        }}
      >
        {/* ── Header ── */}
        <div
          className="flex items-center gap-2 px-3 pt-3 pb-2 shrink-0"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
        >
          {/* LED power indicator */}
          <div
            className="rounded-full shrink-0"
            style={{
              width: 6, height: 6,
              background: `radial-gradient(circle, ${channel.color} 30%, ${channel.color}60 70%, transparent 100%)`,
              boxShadow: `0 0 6px ${channel.color}60, 0 0 2px ${channel.color}`,
            }}
          />
          <div className="flex flex-col min-w-0">
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

          {/* Channel name badge */}
          <div
            className="px-2 py-0.5 rounded shrink-0 ml-auto"
            style={{
              background: 'linear-gradient(180deg, #0d0e12 0%, #111318 100%)',
              border: '1px solid rgba(255,255,255,0.04)',
              boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.5)',
            }}
          >
            <span className="text-[8px] font-extrabold uppercase tracking-[.1em] font-mono" style={{ color: channel.color }}>
              {channel.name}
            </span>
          </div>

          {/* Close button */}
          {onClose && (
            <button
              onClick={onClose}
              className="ml-1 p-1 rounded hover:bg-white/5 transition-colors cursor-pointer"
              style={{ color: '#5a616b' }}
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M2 2l6 6M8 2l-6 6" />
              </svg>
            </button>
          )}
        </div>

        {/* ── Group selector (vertical for sidebar) ── */}
        <div className="flex flex-wrap gap-1 px-3 py-2 shrink-0"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
        >
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

        {/* ── Knobs area ── */}
        {currentGroup && (
          <div className="flex-1 overflow-y-auto px-3 pt-3 pb-4">
            {/* Group section header */}
            <div className="flex items-center gap-2 mb-3">
              <div
                className="px-2 py-0.5 rounded-sm"
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

            {/* Knobs grid — wrapping for sidebar width */}
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
                    size={44}
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

        {/* ── Bottom branding ── */}
        <div
          className="shrink-0 flex items-center justify-between px-3 py-1"
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
      </div>
    )
  }

  // ── Bottom layout (original) ──
  return (
    <div
      className="shrink-0 relative overflow-hidden"
      style={{
        height: panelHeight,
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

      {/* ── Bottom strip ── */}
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

      {/* ── Texture overlay ── */}
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
