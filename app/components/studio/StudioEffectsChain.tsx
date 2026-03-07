'use client'

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  STUDIO EFFECTS CHAIN â€” Visual FX Rack
//  Signal flow: Sound â†’ Filter â†’ Distortion â†’ Space â†’ Sidechain â†’ Output
//  Each effect is a "pedal" with knobs. Toggle on/off to insert code.
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

import { useState, useCallback, useMemo } from 'react'
import { Power, ChevronDown, ChevronRight, ArrowRight, Zap } from 'lucide-react'

// â”€â”€â”€ Effect Definitions â”€â”€â”€

export interface EffectParam {
  id: string
  label: string
  min: number
  max: number
  step: number
  default: number
  unit?: string
}

export interface EffectDef {
  id: string
  label: string
  icon: string
  color: string          // tailwind color class
  category: 'filter' | 'distortion' | 'space' | 'modulation' | 'sidechain' | 'pattern' | 'visual'
  description: string
  params: EffectParam[]
  /** Generate the Strudel code snippet for this effect */
  toCode: (params: Record<string, number>, enabled: boolean) => string
  /** What this looks like in the visual diagram */
  signalLabel: string
}

const EFFECTS: EffectDef[] = [
  // â”€â”€ FILTER â”€â”€
  {
    id: 'lpf',
    label: 'Low-Pass Filter',
    icon: 'ðŸ”½',
    color: 'cyan',
    category: 'filter',
    description: 'Cuts frequencies above the cutoff. Lower = darker. Classic subtractive synth sound.',
    signalLabel: 'LPF',
    params: [
      { id: 'cutoff', label: 'Cutoff', min: 20, max: 20000, step: 10, default: 800, unit: 'Hz' },
      { id: 'resonance', label: 'Resonance', min: 0, max: 20, step: 0.5, default: 0, unit: 'Q' },
      { id: 'envelope', label: 'Env Amount', min: 0, max: 8, step: 0.1, default: 0 },
    ],
    toCode: (p, on) => {
      if (!on) return ''
      let code = `.lpf(${Math.round(p.cutoff)})`
      if (p.resonance > 0) code += `.lpq(${p.resonance})`
      if (p.envelope > 0) code += `.lpenv(${p.envelope})`
      return code
    },
  },
  {
    id: 'hpf',
    label: 'High-Pass Filter',
    icon: 'ðŸ”¼',
    color: 'blue',
    category: 'filter',
    description: 'Cuts frequencies below the cutoff. Higher = thinner. Cleans up muddy lows.',
    signalLabel: 'HPF',
    params: [
      { id: 'cutoff', label: 'Cutoff', min: 20, max: 8000, step: 10, default: 400, unit: 'Hz' },
    ],
    toCode: (p, on) => on ? `.hpf(${Math.round(p.cutoff)})` : '',
  },
  {
    id: 'acidenv',
    label: 'Acid Envelope',
    icon: 'âš—ï¸',
    color: 'lime',
    category: 'filter',
    description: 'The TB-303 acid squelch. Sweeps the filter with each note. The higher the amount, the more squelchy.',
    signalLabel: 'ACID',
    params: [
      { id: 'amount', label: 'Amount', min: 0, max: 1, step: 0.01, default: 0.5 },
    ],
    toCode: (p, on) => on ? `.acidenv(${p.amount.toFixed(2)})` : '',
  },

  // â”€â”€ DISTORTION â”€â”€
  {
    id: 'shape',
    label: 'Waveshaper',
    icon: 'ðŸ“',
    color: 'orange',
    category: 'distortion',
    description: 'Soft clipping distortion. Adds warmth and harmonics. Goes from subtle saturation to full fuzz.',
    signalLabel: 'SHAPE',
    params: [
      { id: 'amount', label: 'Drive', min: 0, max: 1, step: 0.01, default: 0.3 },
    ],
    toCode: (p, on) => on ? `.shape(${p.amount.toFixed(2)})` : '',
  },
  {
    id: 'distort',
    label: 'Distortion',
    icon: 'ðŸ”¥',
    color: 'red',
    category: 'distortion',
    description: 'Hard distortion. Crunchy and aggressive. Great for bass and leads.',
    signalLabel: 'DIST',
    params: [
      { id: 'amount', label: 'Amount', min: 0, max: 5, step: 0.1, default: 0.5 },
    ],
    toCode: (p, on) => on ? `.distort(${p.amount.toFixed(1)})` : '',
  },
  {
    id: 'crush',
    label: 'Bit Crush',
    icon: 'ðŸ‘¾',
    color: 'pink',
    category: 'distortion',
    description: 'Reduces bit depth for lo-fi digital grit. Lower = more crunchy. 16 = normal. 4 = NES.',
    signalLabel: 'CRUSH',
    params: [
      { id: 'bits', label: 'Bits', min: 1, max: 16, step: 1, default: 8 },
    ],
    toCode: (p, on) => on ? `.crush(${p.bits})` : '',
  },

  // â”€â”€ SPACE â”€â”€
  {
    id: 'reverb',
    label: 'Reverb',
    icon: 'ðŸ›ï¸',
    color: 'purple',
    category: 'space',
    description: 'Simulates room reflections. Small values = tight room. Large = cathedral. Creates depth and width.',
    signalLabel: 'VERB',
    params: [
      { id: 'amount', label: 'Room', min: 0, max: 1, step: 0.01, default: 0.5 },
    ],
    toCode: (p, on) => on ? `.room(${p.amount.toFixed(2)})` : '',
  },
  {
    id: 'delay',
    label: 'Delay',
    icon: 'ðŸ“¡',
    color: 'indigo',
    category: 'space',
    description: 'Echo effect. Mix controls wet/dry. Feedback controls how many repeats. Creates rhythmic echoes.',
    signalLabel: 'DLY',
    params: [
      { id: 'mix', label: 'Mix', min: 0, max: 1, step: 0.01, default: 0.25 },
      { id: 'feedback', label: 'Feedback', min: 0, max: 0.95, step: 0.01, default: 0.5 },
      { id: 'time', label: 'Time', min: 0.01, max: 1, step: 0.01, default: 0.375 },
    ],
    toCode: (p, on) => {
      if (!on) return ''
      let code = `.delay(${p.mix.toFixed(2)})`
      if (p.feedback !== 0.5) code += `.delayfeedback(${p.feedback.toFixed(2)})`
      if (p.time !== 0.375) code += `.delaytime(${p.time.toFixed(3)})`
      return code
    },
  },
  {
    id: 'pan',
    label: 'Auto-Pan',
    icon: 'â†”ï¸',
    color: 'teal',
    category: 'space',
    description: 'Moves sound left-to-right automatically using a sine wave LFO. Creates movement and stereo width.',
    signalLabel: 'PAN',
    params: [
      { id: 'speed', label: 'Speed', min: 1, max: 32, step: 1, default: 8, unit: 'cyc' },
      { id: 'depth', label: 'Depth', min: 0, max: 0.5, step: 0.01, default: 0.3 },
    ],
    toCode: (p, on) => on
      ? `.pan(sine.range(${(0.5 - p.depth).toFixed(2)},${(0.5 + p.depth).toFixed(2)}).slow(${p.speed}))`
      : '',
  },

  // â”€â”€ MODULATION â”€â”€
  {
    id: 'vibrato',
    label: 'Vibrato',
    icon: 'ã€°ï¸',
    color: 'amber',
    category: 'modulation',
    description: 'Pitch wobble for expressiveness. Rate = speed, depth = how far the pitch bends.',
    signalLabel: 'VIB',
    params: [
      { id: 'rate', label: 'Rate', min: 1, max: 16, step: 0.5, default: 6, unit: 'Hz' },
      { id: 'depth', label: 'Depth', min: 0, max: 1, step: 0.01, default: 0.25 },
    ],
    toCode: (p, on) => on ? `.vib("${p.rate}:${p.depth}")` : '',
  },
  {
    id: 'detune',
    label: 'Detune',
    icon: 'ðŸŽ¸',
    color: 'yellow',
    category: 'modulation',
    description: 'Slightly pitch-shifts copies of the sound. Creates a thick, chorus-like detuned effect.',
    signalLabel: 'DET',
    params: [
      { id: 'amount', label: 'Amount', min: 0, max: 5, step: 0.1, default: 1 },
    ],
    toCode: (p, on) => on ? `.detune(${p.amount.toFixed(1)})` : '',
  },

  // â”€â”€ SIDECHAIN â”€â”€
  {
    id: 'duck',
    label: 'Sidechain Duck',
    icon: 'ðŸ¦†',
    color: 'emerald',
    category: 'sidechain',
    description: 'Ducks (reduces volume) this sound when the kick plays. Creates that pumping EDM effect. Orbit = which kick triggers it.',
    signalLabel: 'DUCK',
    params: [
      { id: 'orbit', label: 'Source Orbit', min: 0, max: 8, step: 1, default: 1 },
      { id: 'depth', label: 'Depth', min: 0, max: 1, step: 0.01, default: 0.8 },
      { id: 'attack', label: 'Attack', min: 0.01, max: 1, step: 0.01, default: 0.2 },
    ],
    toCode: (p, on) => {
      if (!on) return ''
      return `.duck("${p.orbit}").duckdepth(${p.depth.toFixed(2)}).duckattack(${p.attack.toFixed(2)})`
    },
  },

  // â”€â”€ PATTERN â”€â”€
  {
    id: 'juxrev',
    label: 'Jux Rev',
    icon: 'ðŸ”„',
    color: 'sky',
    category: 'pattern',
    description: 'Plays the pattern reversed in the opposite ear. Creates instant stereo interest.',
    signalLabel: 'JUX',
    params: [],
    toCode: (_p, on) => on ? '.jux(rev)' : '',
  },

  // â”€â”€ VISUAL â”€â”€
  {
    id: 'scope',
    label: 'Oscilloscope',
    icon: 'ðŸ“ˆ',
    color: 'cyan',
    category: 'visual',
    description: 'Shows the waveform of this sound in real-time. Great for seeing if your sound is too loud or clipping.',
    signalLabel: 'SCOPE',
    params: [],
    toCode: (_p, on) => on ? '.scope()' : '',
  },
  {
    id: 'pianoroll',
    label: 'Piano Roll',
    icon: 'ðŸŽ¹',
    color: 'violet',
    category: 'visual',
    description: 'Shows notes on a piano roll as they play. Perfect for melodic patterns to see pitch over time.',
    signalLabel: 'ROLL',
    params: [],
    toCode: (_p, on) => on ? '.pianoroll()' : '',
  },
]

// Category groups for the signal flow visual
const CATEGORIES = [
  { id: 'filter', label: 'FILTER', color: 'cyan' },
  { id: 'distortion', label: 'DRIVE', color: 'orange' },
  { id: 'space', label: 'SPACE', color: 'purple' },
  { id: 'modulation', label: 'MOD', color: 'amber' },
  { id: 'sidechain', label: 'SIDECHAIN', color: 'emerald' },
  { id: 'pattern', label: 'PATTERN', color: 'sky' },
  { id: 'visual', label: 'VISUAL', color: 'violet' },
] as const

// â”€â”€â”€ Types â”€â”€â”€

interface EffectState {
  enabled: boolean
  params: Record<string, number>
}

interface StudioEffectsChainProps {
  /** Called whenever the FX chain changes. Returns the full code string to append to a pattern. */
  onChainChange: (fxCode: string) => void
  /** Inserts an FX snippet at cursor (single effect) */
  onInsertSnippet: (snippet: string) => void
}

// â”€â”€â”€ Clay palette accent mapping â”€â”€â”€
const CLAY_ACCENT: Record<string, string> = {
  cyan: '#00e5c7', blue: '#6f8fb3', lime: '#00e5c7', orange: '#06b6d4',
  red: '#b86f6f', pink: '#b86f6f', purple: '#6f8fb3', indigo: '#6f8fb3',
  teal: '#00e5c7', amber: '#06b6d4', yellow: '#06b6d4', emerald: '#00e5c7',
  sky: '#6f8fb3', violet: '#6f8fb3',
}

function getAccent(colorName: string): string {
  return CLAY_ACCENT[colorName] || '#00e5c7'
}

// â”€â”€â”€ Component â”€â”€â”€

export default function StudioEffectsChain({ onChainChange, onInsertSnippet }: StudioEffectsChainProps) {
  const [isOpen, setIsOpen] = useState(true)
  const [expandedEffect, setExpandedEffect] = useState<string | null>(null)
  const [effects, setEffects] = useState<Record<string, EffectState>>(() => {
    const init: Record<string, EffectState> = {}
    for (const fx of EFFECTS) {
      const params: Record<string, number> = {}
      for (const p of fx.params) params[p.id] = p.default
      init[fx.id] = { enabled: false, params }
    }
    return init
  })

  // Build the full FX code string from enabled effects
  const buildFxCode = useCallback(
    (states: Record<string, EffectState>) => {
      let code = ''
      for (const fx of EFFECTS) {
        const st = states[fx.id]
        if (st?.enabled) {
          code += '\n  ' + fx.toCode(st.params, true)
        }
      }
      return code
    },
    [],
  )

  // Toggle effect on/off
  const toggleEffect = useCallback(
    (fxId: string) => {
      setEffects((prev) => {
        const next = { ...prev, [fxId]: { ...prev[fxId], enabled: !prev[fxId].enabled } }
        onChainChange(buildFxCode(next))
        return next
      })
    },
    [onChainChange, buildFxCode],
  )

  // Change a param value
  const changeParam = useCallback(
    (fxId: string, paramId: string, value: number) => {
      setEffects((prev) => {
        const next = {
          ...prev,
          [fxId]: {
            ...prev[fxId],
            params: { ...prev[fxId].params, [paramId]: value },
          },
        }
        onChainChange(buildFxCode(next))
        return next
      })
    },
    [onChainChange, buildFxCode],
  )

  // Get the generated code for one effect (for insert button)
  const getEffectCode = useCallback(
    (fxId: string) => {
      const fx = EFFECTS.find((f) => f.id === fxId)
      if (!fx) return ''
      return fx.toCode(effects[fxId].params, true)
    },
    [effects],
  )

  // Count enabled effects
  const enabledCount = useMemo(
    () => Object.values(effects).filter((e) => e.enabled).length,
    [effects],
  )

  // Active effects in signal order
  const activeEffects = useMemo(
    () => EFFECTS.filter((fx) => effects[fx.id]?.enabled),
    [effects],
  )

  return (
    <div style={{ borderTop: '1px solid #16181d' }}>
      {/* Header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2 transition-colors duration-[180ms] ease-in-out cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <Zap size={11} style={{ color: '#06b6d4', opacity: 0.6 }} />
          <span className="text-[9px] font-bold uppercase tracking-[.15em]" style={{ color: '#5a616b' }}>
            FX CHAIN
          </span>
          {enabledCount > 0 && (
            <span
              className="text-[8px] font-mono px-1.5 py-0.5 rounded-full"
              style={{ color: '#00e5c7', backgroundColor: '#111318', border: '1px solid #16181d',
                boxShadow: 'inset 1px 1px 3px #050607, inset -1px -1px 3px #1a1d22' }}
            >
              {enabledCount} active
            </span>
          )}
        </div>
        {isOpen ? <ChevronDown size={10} style={{ color: '#5a616b' }} /> : <ChevronRight size={10} style={{ color: '#5a616b' }} />}
      </button>

      {isOpen && (
        <div className="px-2 pb-3">
          {/* â”€â”€ Signal Flow Diagram â”€â”€ */}
          <div
            className="flex items-center gap-1 px-2 py-2 mb-2 overflow-x-auto"
            style={{ backgroundColor: '#0a0b0d', borderRadius: 10, border: '1px solid #16181d',
              boxShadow: 'inset 2px 2px 5px #050607, inset -2px -2px 5px #1a1d22' }}
          >
            {/* Input */}
            <div
              className="shrink-0 text-[7px] font-bold uppercase tracking-wider px-1.5 py-1"
              style={{ color: '#5a616b', backgroundColor: '#111318', borderRadius: 6, border: '1px solid #16181d' }}
            >
              IN
            </div>

            {activeEffects.length > 0 ? (
              activeEffects.map((fx) => (
                <div key={fx.id} className="flex items-center gap-1 shrink-0">
                  <ArrowRight size={8} style={{ color: '#5a616b', opacity: 0.4 }} />
                  <div
                    className="text-[7px] font-bold uppercase tracking-wider px-1.5 py-1"
                    style={{ color: getAccent(fx.color), backgroundColor: '#111318', borderRadius: 6, border: '1px solid #16181d' }}
                  >
                    {fx.signalLabel}
                  </div>
                </div>
              ))
            ) : (
              <div className="flex items-center gap-1">
                <ArrowRight size={8} style={{ color: '#5a616b', opacity: 0.3 }} />
                <span className="text-[7px] italic" style={{ color: '#5a616b', opacity: 0.4 }}>no effects</span>
              </div>
            )}

            <ArrowRight size={8} className="shrink-0" style={{ color: '#5a616b', opacity: 0.4 }} />
            <div
              className="shrink-0 text-[7px] font-bold uppercase tracking-wider px-1.5 py-1"
              style={{ color: '#00e5c7', opacity: 0.6, backgroundColor: '#111318', borderRadius: 6, border: '1px solid #16181d' }}
            >
              OUT
            </div>
          </div>

          {/* â”€â”€ Effect Pedals by Category â”€â”€ */}
          {CATEGORIES.map((cat) => {
            const catEffects = EFFECTS.filter((fx) => fx.category === cat.id)
            if (catEffects.length === 0) return null

            return (
              <div key={cat.id} className="mb-2">
                <div
                  className="text-[7px] font-bold uppercase tracking-[.2em] px-1 mb-1"
                  style={{ color: getAccent(cat.color), opacity: 0.4 }}
                >
                  {cat.label}
                </div>
                <div className="space-y-1">
                  {catEffects.map((fx) => {
                    const st = effects[fx.id]
                    const ac = getAccent(fx.color)
                    const isExpanded = expandedEffect === fx.id

                    return (
                      <div
                        key={fx.id}
                        className="transition-all duration-[180ms] ease-in-out"
                        style={{
                          borderRadius: 10,
                          border: '1px solid #16181d',
                          backgroundColor: st.enabled ? '#16181d' : '#111318',
                          boxShadow: st.enabled
                            ? '3px 3px 6px #050607, -3px -3px 6px #1a1d22'
                            : 'inset 2px 2px 4px #050607, inset -2px -2px 4px #1a1d22',
                          opacity: st.enabled ? 1 : 0.6,
                        }}
                      >
                        {/* Pedal header */}
                        <div className="flex items-center gap-2 px-2 py-1.5">
                          {/* Power toggle */}
                          <button
                            onClick={() => toggleEffect(fx.id)}
                            className="w-5 h-5 flex items-center justify-center transition-all duration-[180ms] ease-in-out cursor-pointer"
                            style={{
                              borderRadius: 6,
                              backgroundColor: '#111318',
                              color: st.enabled ? ac : '#5a616b',
                              border: '1px solid #16181d',
                              boxShadow: st.enabled
                                ? 'inset 1px 1px 3px #050607, inset -1px -1px 3px #1a1d22'
                                : '1px 1px 3px #050607, -1px -1px 3px #1a1d22',
                            }}
                            title={st.enabled ? 'Disable' : 'Enable'}
                          >
                            <Power size={9} />
                          </button>

                          {/* Label + icon */}
                          <button
                            onClick={() => setExpandedEffect(isExpanded ? null : fx.id)}
                            className="flex-1 flex items-center gap-1.5 text-left cursor-pointer"
                          >
                            <span className="text-[10px]">{fx.icon}</span>
                            <span
                              className="text-[9px] font-bold tracking-wide"
                              style={{ color: st.enabled ? ac : '#5a616b' }}
                            >
                              {fx.label}
                            </span>
                          </button>

                          {/* Insert button */}
                          <button
                            onClick={() => onInsertSnippet(getEffectCode(fx.id))}
                            className="text-[7px] font-bold px-1.5 py-0.5 transition-all duration-[180ms] ease-in-out cursor-pointer"
                            style={{ color: ac, opacity: 0.4, borderRadius: 6, border: '1px solid #16181d', backgroundColor: '#111318' }}
                            title="Insert this effect's code at cursor"
                          >
                            + INSERT
                          </button>

                          {/* Expand arrow */}
                          {fx.params.length > 0 && (
                            <button
                              onClick={() => setExpandedEffect(isExpanded ? null : fx.id)}
                              style={{ color: '#5a616b' }}
                              className="cursor-pointer"
                            >
                              {isExpanded ? <ChevronDown size={9} /> : <ChevronRight size={9} />}
                            </button>
                          )}
                        </div>

                        {/* Expanded: description + knobs */}
                        {isExpanded && (
                          <div className="px-2 pb-2 space-y-2">
                            <p className="text-[8px] leading-relaxed px-1" style={{ color: '#5a616b' }}>
                              {fx.description}
                            </p>

                            {fx.params.length > 0 && (
                              <div className="space-y-1.5">
                                {fx.params.map((param) => (
                                  <div key={param.id} className="flex items-center gap-2 px-1">
                                    <span className="text-[8px] font-mono w-16 truncate" style={{ color: '#5a616b' }}>
                                      {param.label}
                                    </span>
                                    <input
                                      type="range"
                                      min={param.min}
                                      max={param.max}
                                      step={param.step}
                                      value={st.params[param.id] ?? param.default}
                                      onChange={(e) => changeParam(fx.id, param.id, parseFloat(e.target.value))}
                                      className="flex-1 h-1 cursor-pointer"
                                      style={{ accentColor: st.enabled ? '#00e5c7' : '#5a616b' }}
                                    />
                                    <span
                                      className="text-[8px] font-mono w-12 text-right"
                                      style={{ color: st.enabled ? ac : '#5a616b', opacity: st.enabled ? 0.6 : 0.4 }}
                                    >
                                      {(st.params[param.id] ?? param.default).toFixed(
                                        param.step < 1 ? (param.step < 0.1 ? 2 : 1) : 0,
                                      )}
                                      {param.unit ? ` ${param.unit}` : ''}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}

                            <div className="px-1">
                              <code className="text-[8px] font-mono block" style={{ color: ac, opacity: 0.4 }}>
                                {fx.toCode(st.params, true)}
                              </code>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}

          {/* â”€â”€ Full Chain Code Preview â”€â”€ */}
          {enabledCount > 0 && (
            <div className="mt-3 px-1">
              <div className="text-[7px] font-bold uppercase tracking-[.2em] mb-1" style={{ color: '#5a616b' }}>
                GENERATED FX CODE
              </div>
              <div
                className="p-2"
                style={{ backgroundColor: '#0a0b0d', borderRadius: 10, border: '1px solid #16181d',
                  boxShadow: 'inset 2px 2px 5px #050607, inset -2px -2px 5px #1a1d22' }}
              >
                <code className="text-[9px] font-mono whitespace-pre-wrap block" style={{ color: '#00e5c7', opacity: 0.5 }}>
                  {activeEffects.map((fx) => fx.toCode(effects[fx.id].params, true)).join('\n')}
                </code>
              </div>
              <button
                onClick={() => {
                  const code = activeEffects.map((fx) => '\n  ' + fx.toCode(effects[fx.id].params, true)).join('')
                  onInsertSnippet(code)
                }}
                className="mt-1.5 w-full text-[8px] font-bold py-1.5 transition-all duration-[180ms] ease-in-out cursor-pointer"
                style={{ color: '#00e5c7', backgroundColor: '#111318', borderRadius: 10, border: '1px solid #16181d',
                  boxShadow: '2px 2px 5px #050607, -2px -2px 5px #1a1d22' }}
              >
                INSERT FULL CHAIN AT CURSOR
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
