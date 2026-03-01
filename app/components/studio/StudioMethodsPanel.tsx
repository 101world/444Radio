'use client'

import { useState, useCallback } from 'react'
import { ChevronDown, ChevronRight, Copy, Check, Search } from 'lucide-react'

// ─── Sound/instrument/sample data for quick swap ───

export const SOUND_BANKS: {
  label: string
  icon: string
  items: { code: string; desc: string }[]
}[] = [
  {
    label: 'Synth Waveforms',
    icon: '🔻',
    items: [
      { code: 's("sawtooth")', desc: 'Classic saw — leads, bass, pads' },
      { code: 's("supersaw")', desc: 'Detuned saw — trance, rave' },
      { code: 's("sine")', desc: 'Pure sine — sub bass, bells' },
      { code: 's("square")', desc: 'Square — chiptune, leads' },
      { code: 's("triangle")', desc: 'Triangle — soft leads, bass' },
    ],
  },
  {
    label: 'Drum Machines',
    icon: '🥁',
    items: [
      { code: '.bank("RolandTR808")', desc: 'TR-808 — hip-hop, trap' },
      { code: '.bank("RolandTR909")', desc: 'TR-909 — house, techno' },
      { code: '.bank("RolandCR78")', desc: 'CR-78 — vintage analog' },
      { code: '.bank("AkaiLinn")', desc: 'LinnDrum — 80s classic' },
      { code: '.bank("RhythmAce")', desc: 'Rhythm Ace — retro' },
      { code: '.bank("ViscoSpaceDrum")', desc: 'Space Drum — sci-fi perc' },
    ],
  },
  {
    label: 'Drum Sounds',
    icon: '💥',
    items: [
      { code: 's("bd")', desc: 'Kick drum' },
      { code: 's("sd")', desc: 'Snare drum' },
      { code: 's("cp")', desc: 'Clap' },
      { code: 's("hh")', desc: 'Hi-hat' },
      { code: 's("oh")', desc: 'Open hi-hat' },
      { code: 's("rim")', desc: 'Rim shot' },
      { code: 's("tom")', desc: 'Tom' },
      { code: 's("ride")', desc: 'Ride cymbal' },
      { code: 's("crash")', desc: 'Crash cymbal' },
      { code: 's("perc")', desc: 'Percussion' },
      { code: 's("tabla")', desc: 'Tabla' },
      { code: 's("conga")', desc: 'Conga' },
    ],
  },
  {
    label: 'GM Piano & Keys',
    icon: '🎹',
    items: [
      { code: 's("gm_piano")', desc: 'Acoustic Grand Piano' },
      { code: 's("gm_bright_acoustic")', desc: 'Bright Acoustic Piano' },
      { code: 's("gm_epiano1")', desc: 'Electric Piano 1 (Rhodes)' },
      { code: 's("gm_epiano2")', desc: 'Electric Piano 2 (DX7)' },
      { code: 's("gm_honkytonk")', desc: 'Honky-Tonk Piano' },
      { code: 's("gm_harpsichord")', desc: 'Harpsichord' },
      { code: 's("gm_clavinet")', desc: 'Clavinet' },
      { code: 's("gm_celesta")', desc: 'Celesta' },
      { code: 's("gm_music_box")', desc: 'Music Box' },
      { code: 's("gm_glockenspiel")', desc: 'Glockenspiel' },
      { code: 's("gm_vibraphone")', desc: 'Vibraphone' },
      { code: 's("gm_marimba")', desc: 'Marimba' },
      { code: 's("gm_xylophone")', desc: 'Xylophone' },
    ],
  },
  {
    label: 'GM Organ & Accordion',
    icon: '⛪',
    items: [
      { code: 's("gm_organ1")', desc: 'Drawbar Organ' },
      { code: 's("gm_organ2")', desc: 'Percussive Organ' },
      { code: 's("gm_organ3")', desc: 'Rock Organ' },
      { code: 's("gm_church_organ")', desc: 'Church Organ' },
      { code: 's("gm_reed_organ")', desc: 'Reed Organ' },
      { code: 's("gm_accordion")', desc: 'Accordion' },
      { code: 's("gm_harmonica")', desc: 'Harmonica' },
    ],
  },
  {
    label: 'GM Guitar & Bass',
    icon: '🎸',
    items: [
      { code: 's("gm_acoustic_guitar_nylon")', desc: 'Nylon Guitar' },
      { code: 's("gm_acoustic_guitar_steel")', desc: 'Steel Guitar' },
      { code: 's("gm_electric_guitar_jazz")', desc: 'Jazz Guitar' },
      { code: 's("gm_electric_guitar_clean")', desc: 'Clean Electric' },
      { code: 's("gm_electric_guitar_muted")', desc: 'Muted Guitar' },
      { code: 's("gm_overdriven_guitar")', desc: 'Overdriven Guitar' },
      { code: 's("gm_distortion_guitar")', desc: 'Distortion Guitar' },
      { code: 's("gm_acoustic_bass")', desc: 'Acoustic Bass' },
      { code: 's("gm_electric_bass_finger")', desc: 'Finger Bass' },
      { code: 's("gm_electric_bass_pick")', desc: 'Pick Bass' },
      { code: 's("gm_slap_bass1")', desc: 'Slap Bass 1' },
      { code: 's("gm_synth_bass1")', desc: 'Synth Bass 1' },
      { code: 's("gm_synth_bass2")', desc: 'Synth Bass 2' },
    ],
  },
  {
    label: 'GM Strings & Orch',
    icon: '🎻',
    items: [
      { code: 's("gm_violin")', desc: 'Violin' },
      { code: 's("gm_viola")', desc: 'Viola' },
      { code: 's("gm_cello")', desc: 'Cello' },
      { code: 's("gm_contrabass")', desc: 'Contrabass' },
      { code: 's("gm_tremolo_strings")', desc: 'Tremolo Strings' },
      { code: 's("gm_pizzicato_strings")', desc: 'Pizzicato Strings' },
      { code: 's("gm_orchestral_harp")', desc: 'Orchestral Harp' },
      { code: 's("gm_string_ensemble1")', desc: 'String Ensemble 1' },
      { code: 's("gm_string_ensemble2")', desc: 'String Ensemble 2' },
      { code: 's("gm_synth_strings1")', desc: 'Synth Strings 1' },
      { code: 's("gm_timpani")', desc: 'Timpani' },
    ],
  },
  {
    label: 'GM Choir & Voice',
    icon: '🎤',
    items: [
      { code: 's("gm_choir_aahs")', desc: 'Choir Aahs' },
      { code: 's("gm_voice_oohs")', desc: 'Voice Oohs' },
      { code: 's("gm_synth_voice")', desc: 'Synth Voice' },
    ],
  },
  {
    label: 'GM Brass & Reed',
    icon: '🎺',
    items: [
      { code: 's("gm_trumpet")', desc: 'Trumpet' },
      { code: 's("gm_trombone")', desc: 'Trombone' },
      { code: 's("gm_tuba")', desc: 'Tuba' },
      { code: 's("gm_french_horn")', desc: 'French Horn' },
      { code: 's("gm_brass_section")', desc: 'Brass Section' },
      { code: 's("gm_synth_brass1")', desc: 'Synth Brass 1' },
      { code: 's("gm_soprano_sax")', desc: 'Soprano Sax' },
      { code: 's("gm_alto_sax")', desc: 'Alto Sax' },
      { code: 's("gm_tenor_sax")', desc: 'Tenor Sax' },
      { code: 's("gm_baritone_sax")', desc: 'Baritone Sax' },
      { code: 's("gm_oboe")', desc: 'Oboe' },
      { code: 's("gm_english_horn")', desc: 'English Horn' },
      { code: 's("gm_bassoon")', desc: 'Bassoon' },
      { code: 's("gm_clarinet")', desc: 'Clarinet' },
    ],
  },
  {
    label: 'GM Flute & Pipe',
    icon: '🪈',
    items: [
      { code: 's("gm_piccolo")', desc: 'Piccolo' },
      { code: 's("gm_flute")', desc: 'Flute' },
      { code: 's("gm_recorder")', desc: 'Recorder' },
      { code: 's("gm_pan_flute")', desc: 'Pan Flute' },
      { code: 's("gm_blown_bottle")', desc: 'Blown Bottle' },
      { code: 's("gm_shakuhachi")', desc: 'Shakuhachi' },
      { code: 's("gm_whistle")', desc: 'Whistle' },
      { code: 's("gm_ocarina")', desc: 'Ocarina' },
    ],
  },
  {
    label: 'GM Synth Leads',
    icon: '⚡',
    items: [
      { code: 's("gm_lead1_square")', desc: 'Lead 1 — Square' },
      { code: 's("gm_lead2_sawtooth")', desc: 'Lead 2 — Sawtooth' },
      { code: 's("gm_lead3_calliope")', desc: 'Lead 3 — Calliope' },
      { code: 's("gm_lead4_chiff")', desc: 'Lead 4 — Chiff' },
      { code: 's("gm_lead5_charang")', desc: 'Lead 5 — Charang' },
      { code: 's("gm_lead6_voice")', desc: 'Lead 6 — Voice' },
      { code: 's("gm_lead7_fifths")', desc: 'Lead 7 — Fifths' },
      { code: 's("gm_lead8_bass_lead")', desc: 'Lead 8 — Bass+Lead' },
    ],
  },
  {
    label: 'GM Synth Pads',
    icon: '🌊',
    items: [
      { code: 's("gm_pad1_new_age")', desc: 'Pad 1 — New Age' },
      { code: 's("gm_pad2_warm")', desc: 'Pad 2 — Warm' },
      { code: 's("gm_pad3_polysynth")', desc: 'Pad 3 — Polysynth' },
      { code: 's("gm_pad4_choir")', desc: 'Pad 4 — Choir' },
      { code: 's("gm_pad5_bowed")', desc: 'Pad 5 — Bowed' },
      { code: 's("gm_pad6_metallic")', desc: 'Pad 6 — Metallic' },
      { code: 's("gm_pad7_halo")', desc: 'Pad 7 — Halo' },
      { code: 's("gm_pad8_sweep")', desc: 'Pad 8 — Sweep' },
    ],
  },
  {
    label: 'GM SFX & Ethnic',
    icon: '✨',
    items: [
      { code: 's("gm_fx1_rain")', desc: 'FX — Rain' },
      { code: 's("gm_fx2_soundtrack")', desc: 'FX — Soundtrack' },
      { code: 's("gm_fx3_crystal")', desc: 'FX — Crystal' },
      { code: 's("gm_fx4_atmosphere")', desc: 'FX — Atmosphere' },
      { code: 's("gm_fx5_brightness")', desc: 'FX — Brightness' },
      { code: 's("gm_fx6_goblins")', desc: 'FX — Goblins' },
      { code: 's("gm_fx7_echoes")', desc: 'FX — Echoes' },
      { code: 's("gm_fx8_scifi")', desc: 'FX — Sci-Fi' },
      { code: 's("gm_sitar")', desc: 'Sitar' },
      { code: 's("gm_banjo")', desc: 'Banjo' },
      { code: 's("gm_shamisen")', desc: 'Shamisen' },
      { code: 's("gm_koto")', desc: 'Koto' },
      { code: 's("gm_kalimba")', desc: 'Kalimba' },
      { code: 's("gm_steel_drums")', desc: 'Steel Drums' },
      { code: 's("gm_woodblock")', desc: 'Woodblock' },
      { code: 's("gm_taiko_drum")', desc: 'Taiko Drum' },
    ],
  },
  {
    label: 'Samples & Noise',
    icon: '📦',
    items: [
      { code: 's("casio")', desc: 'Casio — lo-fi keys' },
      { code: 's("jazz")', desc: 'Jazz kit' },
      { code: 's("metal")', desc: 'Metal hits' },
      { code: 's("mouth")', desc: 'Mouth sounds' },
      { code: 's("gabba")', desc: 'Gabba kick' },
      { code: 's("industrial")', desc: 'Industrial hits' },
      { code: 's("space")', desc: 'Space sounds' },
      { code: 's("birds")', desc: 'Bird sounds' },
      { code: 's("wind")', desc: 'Wind ambience' },
      { code: 's("noise")', desc: 'White noise' },
    ],
  },
]

// ─── Method Reference: code snippets (original) ───

export const METHOD_CATEGORIES: {
  label: string
  icon: string
  methods: { code: string; desc: string }[]
}[] = [
  {
    label: 'Filters & Envelope',
    icon: '🎛️',
    methods: [
      { code: '.lpf(800)', desc: 'Low-pass filter' },
      { code: '.hpf(400)', desc: 'High-pass filter' },
      { code: '.lpq(8)', desc: 'Filter resonance' },
      { code: '.lpenv(4)', desc: 'Filter envelope amount' },
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
    ],
  },
  {
    label: 'Visuals',
    icon: '📊',
    methods: [
      { code: '.scope()', desc: 'Oscilloscope' },
      { code: '.pianoroll()', desc: 'Piano roll' },
      { code: '.punchcard()', desc: 'Punchcard grid' },
    ],
  },
]

// ─── Component ───

interface StudioMethodsPanelProps {
  onInsert: (snippet: string) => void
}

export default function StudioMethodsPanel({ onInsert }: StudioMethodsPanelProps) {
  const [activeTab, setActiveTab] = useState<'sounds' | 'methods'>('sounds')
  const [expandedCat, setExpandedCat] = useState<string | null>(null)
  const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const copySnippet = useCallback((snippet: string) => {
    navigator.clipboard.writeText(snippet)
    setCopiedSnippet(snippet)
    setTimeout(() => setCopiedSnippet(null), 1500)
  }, [])

  const currentData = activeTab === 'sounds' ? SOUND_BANKS : METHOD_CATEGORIES
  const dataKey = activeTab === 'sounds' ? 'items' : 'methods'

  // Filter by search
  const filtered = search.trim()
    ? currentData.map(cat => {
        const items = (cat as any)[dataKey === 'items' ? 'items' : 'methods'] as { code: string; desc: string }[]
        const matching = items.filter(
          m => m.code.toLowerCase().includes(search.toLowerCase()) ||
               m.desc.toLowerCase().includes(search.toLowerCase())
        )
        return matching.length > 0 ? { ...cat, [dataKey === 'items' ? 'items' : 'methods']: matching } : null
      }).filter(Boolean) as typeof currentData
    : currentData

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Tab switcher */}
      <div className="flex items-center gap-0 px-2 pt-2 pb-1">
        <button
          onClick={() => { setActiveTab('sounds'); setExpandedCat(null); setSearch('') }}
          className={`flex-1 text-[8px] font-bold uppercase tracking-[.15em] py-1.5 rounded-l border transition-all cursor-pointer ${
            activeTab === 'sounds'
              ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/25'
              : 'bg-white/[0.02] text-white/20 border-white/[0.06] hover:text-white/40'
          }`}
        >
          🎹 SOUNDS
        </button>
        <button
          onClick={() => { setActiveTab('methods'); setExpandedCat(null); setSearch('') }}
          className={`flex-1 text-[8px] font-bold uppercase tracking-[.15em] py-1.5 rounded-r border-t border-b border-r transition-all cursor-pointer ${
            activeTab === 'methods'
              ? 'bg-orange-500/10 text-orange-400 border-orange-500/25'
              : 'bg-white/[0.02] text-white/20 border-white/[0.06] hover:text-white/40'
          }`}
        >
          🔧 METHODS
        </button>
      </div>

      {/* Search */}
      <div className="px-2 py-1">
        <div className="relative">
          <Search size={10} className="absolute left-2 top-1/2 -translate-y-1/2 text-white/15" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={activeTab === 'sounds' ? 'Search instruments...' : 'Search methods...'}
            className="w-full bg-white/[0.03] border border-white/[0.06] rounded text-[9px] text-white/60 placeholder:text-white/15 pl-6 pr-2 py-1 outline-none focus:border-white/[0.12] font-mono"
          />
        </div>
      </div>

      {/* Categories list */}
      <div className="px-1 pb-3 space-y-0.5">
        {filtered.length === 0 && (
          <div className="text-center py-4 text-[9px] text-white/15">No results for &quot;{search}&quot;</div>
        )}
        {filtered.map((cat) => {
          const items: { code: string; desc: string }[] = (cat as any).items || (cat as any).methods
          return (
            <div key={cat.label}>
              <button
                onClick={() => setExpandedCat(expandedCat === cat.label ? null : cat.label)}
                className="w-full flex items-center gap-1.5 px-2 py-1 text-[9px] font-bold text-white/30 hover:text-white/50 transition-colors cursor-pointer"
              >
                <span>{cat.icon}</span>
                <span className="flex-1 text-left uppercase tracking-wider">{cat.label}</span>
                <span className="text-[7px] text-white/10 font-mono">{items.length}</span>
                {expandedCat === cat.label ? <ChevronDown size={8} /> : <ChevronRight size={8} />}
              </button>
              {expandedCat === cat.label && (
                <div className="ml-2 space-y-0.5 mb-1">
                  {items.map((m) => (
                    <div
                      key={m.code}
                      className="flex items-center gap-1 px-2 py-0.5 rounded hover:bg-white/[0.03] group cursor-pointer"
                      onClick={() => onInsert(m.code)}
                      title={`Click to insert: ${m.code}\n${m.desc}`}
                    >
                      <div className="flex-1 min-w-0">
                        <code className="text-[9px] font-mono text-cyan-400/60 group-hover:text-cyan-400 truncate block">
                          {m.code}
                        </code>
                        <span className="text-[7px] text-white/15 truncate block">
                          {m.desc}
                        </span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          copySnippet(m.code)
                        }}
                        className="opacity-0 group-hover:opacity-100 text-white/20 hover:text-cyan-400 transition-all cursor-pointer shrink-0"
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
          )
        })}
      </div>
    </div>
  )
}
