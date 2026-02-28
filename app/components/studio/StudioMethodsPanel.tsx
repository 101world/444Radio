'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, Copy, Check } from 'lucide-react'

// ─── Method Reference: quick-insert snippets ───
export const METHOD_CATEGORIES: {
  label: string
  icon: string
  methods: { code: string; desc: string }[]
}[] = [
  {
    label: 'Sound Sources',
    icon: '🎹',
    methods: [
      { code: '.s("sawtooth")', desc: 'Sawtooth synth' },
      { code: '.s("supersaw")', desc: 'Supersaw (detuned)' },
      { code: '.s("sine")', desc: 'Sine wave' },
      { code: '.s("square")', desc: 'Square wave' },
      { code: '.s("triangle")', desc: 'Triangle wave' },
      { code: '.s("gm_piano")', desc: 'GM Piano' },
      { code: '.s("gm_epiano1")', desc: 'Electric Piano' },
      { code: '.s("gm_choir_aahs")', desc: 'Choir Aahs' },
      { code: '.s("ravebass")', desc: 'Rave bass' },
      { code: '.bank("RolandTR909")', desc: 'TR-909 drums' },
      { code: '.bank("RolandTR808")', desc: 'TR-808 drums' },
    ],
  },
  {
    label: 'Filters & Envelope',
    icon: '🎛️',
    methods: [
      { code: '.lpf(800)', desc: 'Low-pass filter' },
      { code: '.hpf(400)', desc: 'High-pass filter' },
      { code: '.lpq(8)', desc: 'Filter resonance' },
      { code: '.lpenv(4)', desc: 'Filter envelope amount' },
      { code: '.acidenv(slider(.5, 0, 1))', desc: 'Acid envelope with slider' },
      { code: '.ftype("24db")', desc: '24dB steep filter' },
      { code: '.shape(.3)', desc: 'Waveshaping distortion' },
      { code: '.distort(.5)', desc: 'Distortion' },
      { code: '.crush(8)', desc: 'Bit crush' },
    ],
  },
  {
    label: 'Space & Time',
    icon: '🌌',
    methods: [
      { code: '.room(.5)', desc: 'Reverb amount' },
      { code: '.delay(.25)', desc: 'Delay mix' },
      { code: '.delayfeedback(.5)', desc: 'Delay feedback' },
      { code: '.delaytime(.375)', desc: 'Delay time' },
      { code: '.pan(sine.range(.2,.8).slow(8))', desc: 'Auto-panning' },
      { code: '.phaser(4)', desc: 'Phaser' },
      { code: '.orbit(2)', desc: 'Separate FX bus' },
    ],
  },
  {
    label: 'Pitch & Scale',
    icon: '🎵',
    methods: [
      { code: '.scale("c:minor")', desc: 'Scale quantize' },
      { code: '.trans(-12)', desc: 'Transpose semitones' },
      { code: '.detune(1)', desc: 'Detune (fat sound)' },
      { code: '.voicing()', desc: 'Auto voice-lead chords' },
      { code: '.chord("Em")', desc: 'Chord shape' },
      { code: '.add(note(12))', desc: 'Add octave' },
      { code: '.off(1/8, x => x.add(note(7)))', desc: 'Delayed 5th harmony' },
    ],
  },
  {
    label: 'Modulation & LFO',
    icon: '〰️',
    methods: [
      { code: 'perlin.range(300,800).slow(4)', desc: 'Perlin noise LFO' },
      { code: 'sine.range(0,1).slow(8)', desc: 'Sine LFO' },
      { code: 'saw.slow(4).range(200,2000)', desc: 'Saw LFO' },
      { code: 'slider(.5, 0, 1)', desc: 'Live slider control' },
      { code: '.vib("8:.25")', desc: 'Vibrato' },
    ],
  },
  {
    label: 'Sidechain & Duck',
    icon: '🦆',
    methods: [
      { code: '.duck("1")', desc: 'Sidechain to orbit 1' },
      { code: '.duckdepth(.8)', desc: 'Sidechain depth' },
      { code: '.duckattack(.2)', desc: 'Sidechain attack' },
    ],
  },
  {
    label: 'Pattern Tricks',
    icon: '🧩',
    methods: [
      { code: '.jux(rev)', desc: 'Reverse in other ear' },
      { code: '.rarely(add(note(12)))', desc: 'Occasionally add octave' },
      { code: '.chunk(4, add(note(12)))', desc: 'Transpose 1/4 of pattern' },
      { code: '.off(1/4, add(note(12)))', desc: 'Delayed octave echo' },
      { code: '.struct("<x(3,8) x*2>*2")', desc: 'Euclidean rhythm' },
      { code: 'irand(10).sub(7).seg(16)', desc: 'Random 16-step note seq' },
      { code: '.fast(2)', desc: 'Double speed' },
      { code: '.slow(2)', desc: 'Half speed' },
      { code: '.mul(gain(1.5))', desc: 'Multiply gain' },
    ],
  },
  {
    label: 'Visuals',
    icon: '📊',
    methods: [
      { code: '._scope()', desc: 'Oscilloscope' },
      { code: '._pianoroll()', desc: 'Piano roll' },
      { code: '.punchcard()', desc: 'Punchcard grid' },
      { code: '.fscope()', desc: 'Frequency scope' },
      { code: '.pitchwheel()', desc: 'Pitch wheel' },
    ],
  },
]

// ─── Component ───

interface StudioMethodsPanelProps {
  onInsert: (snippet: string) => void
}

export default function StudioMethodsPanel({ onInsert }: StudioMethodsPanelProps) {
  const [showMethods, setShowMethods] = useState(true)
  const [expandedCat, setExpandedCat] = useState<string | null>(null)
  const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null)

  const copySnippet = (snippet: string) => {
    navigator.clipboard.writeText(snippet)
    setCopiedSnippet(snippet)
    setTimeout(() => setCopiedSnippet(null), 1500)
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="flex items-center justify-between px-3 py-2">
        <div className="text-[8px] font-bold uppercase tracking-[.2em] text-white/20">METHODS</div>
        <button
          onClick={() => setShowMethods(!showMethods)}
          className="text-white/20 hover:text-white/40 cursor-pointer"
        >
          {showMethods ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
        </button>
      </div>
      {showMethods && (
        <div className="px-1 pb-3 space-y-0.5">
          {METHOD_CATEGORIES.map((cat) => (
            <div key={cat.label}>
              <button
                onClick={() => setExpandedCat(expandedCat === cat.label ? null : cat.label)}
                className="w-full flex items-center gap-1.5 px-2 py-1 text-[9px] font-bold text-white/30 hover:text-white/50 transition-colors cursor-pointer"
              >
                <span>{cat.icon}</span>
                <span className="flex-1 text-left uppercase tracking-wider">{cat.label}</span>
                {expandedCat === cat.label ? <ChevronDown size={8} /> : <ChevronRight size={8} />}
              </button>
              {expandedCat === cat.label && (
                <div className="ml-2 space-y-0.5 mb-1">
                  {cat.methods.map((m) => (
                    <div
                      key={m.code}
                      className="flex items-center gap-1 px-2 py-0.5 rounded hover:bg-white/[0.03] group cursor-pointer"
                      onClick={() => onInsert(m.code)}
                      title={`Click to insert: ${m.code}`}
                    >
                      <code className="text-[9px] font-mono text-cyan-400/60 group-hover:text-cyan-400 flex-1 truncate">
                        {m.code}
                      </code>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          copySnippet(m.code)
                        }}
                        className="opacity-0 group-hover:opacity-100 text-white/20 hover:text-cyan-400 transition-all cursor-pointer"
                        title="Copy"
                      >
                        {copiedSnippet === m.code ? (
                          <Check size={9} className="text-emerald-400" />
                        ) : (
                          <Copy size={9} />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
