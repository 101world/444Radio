'use client'

// ═══════════════════════════════════════════════════════════
//  STUDIO BROWSER PANEL — Left sidebar instrument/sample/bank browser
//  Tabbed: Instruments · Sounds · Banks
//  Each item has a unique icon, preview, and drag-to-add support
// ═══════════════════════════════════════════════════════════

import { useState, useCallback, useMemo } from 'react'
import { Search, Volume2 } from 'lucide-react'

// ── Icon map: unique SVG-style icons per sound/instrument ──

const ICONS: Record<string, string> = {
  // Synths
  sawtooth:  '◸', supersaw: '◈', sine: '∿', square: '◻', triangle: '△', pulse: '▮',
  sbd: '◉',
  // Noise
  white: '░', pink: '▒', brown: '▓', crackle: '⚡', noise: '▤', noise2: '▥',
  // Drums
  bd: '⬤', sd: '◎', cp: '✋', hh: '⌃', oh: '⌄', rim: '◇', tom: '◆',
  ride: '◠', crash: '✱', perc: '♦',
  // Keys
  gm_piano: '🎹', gm_epiano1: '⎚', gm_epiano2: '⎛', gm_music_box: '❊',
  gm_vibraphone: '⟡', gm_marimba: '⊞', gm_celesta: '✧', gm_clavinet: '⊟',
  // Organ
  gm_drawbar_organ: '⊠', gm_percussive_organ: '⊡', gm_rock_organ: '⊗',
  gm_church_organ: '✝', gm_accordion: '⊜', gm_harmonica: '≡',
  // Guitar & Bass
  gm_acoustic_guitar_nylon: '⌘', gm_acoustic_guitar_steel: '⎈',
  gm_electric_guitar_jazz: '♪', gm_electric_guitar_clean: '♫',
  gm_overdriven_guitar: '⚡', gm_distortion_guitar: '⌁',
  gm_acoustic_bass: '⎍', gm_electric_bass_finger: '⎎',
  gm_slap_bass_1: '⍟', gm_slap_bass_2: '⎏',
  gm_fretless_bass: '⎐', gm_synth_bass_1: '⎑', gm_synth_bass_2: '⎒',
  // Strings
  gm_violin: '🎻', gm_viola: '⌒', gm_cello: '⌓', gm_contrabass: '⌔',
  gm_string_ensemble_1: '≋', gm_string_ensemble_2: '≈',
  gm_synth_strings_1: '∭', gm_synth_strings_2: '∬',
  gm_orchestral_harp: '⌇', gm_pizzicato_strings: '∴',
  // Brass
  gm_trumpet: '🎺', gm_trombone: '⌠', gm_french_horn: '⌡',
  gm_brass_section: '⊕', gm_alto_sax: '🎷', gm_tenor_sax: '⊖',
  gm_soprano_sax: '⊗',
  // Flute
  gm_flute: '⊘', gm_piccolo: '⊙', gm_pan_flute: '⊚', gm_recorder: '⊛',
  // Voice
  gm_choir_aahs: '🎤', gm_voice_oohs: '◔', gm_synth_choir: '◕', gm_orchestra_hit: '💥',
  // Leads
  gm_lead_1_square: '▣', gm_lead_2_sawtooth: '▤',
  gm_lead_5_charang: '▥', gm_lead_7_fifths: '▦', gm_lead_8_bass_lead: '▧',
  // Pads
  gm_pad_new_age: '☁', gm_pad_warm: '☀', gm_pad_poly: '◈',
  gm_pad_choir: '♁', gm_pad_halo: '◉', gm_pad_sweep: '◌',
  // SFX
  gm_fx_crystal: '❖', gm_fx_atmosphere: '☾', gm_fx_echoes: '◎',
  gm_fx_sci_fi: '⌬', gm_kalimba: '⌭', gm_steel_drums: '⊛',
  gm_sitar: '⌮', gm_koto: '⌯',
  // Samples
  casio: '⌨', jazz: '♩', metal: '⛓', mouth: '👄', gabba: '⚡', space: '🌌',
}

// ── Data: Instruments (synths, keys, strings, etc.) ──

interface BrowserItem {
  id: string
  label: string
  icon: string
  type: 'synth' | 'sample' | 'vocal'
}

interface BrowserSection {
  label: string
  items: BrowserItem[]
}

const INSTRUMENT_SECTIONS: BrowserSection[] = [
  { label: 'Synths', items: [
    { id: 'sawtooth', label: 'Sawtooth', icon: ICONS.sawtooth || '◸', type: 'synth' },
    { id: 'supersaw', label: 'Supersaw', icon: ICONS.supersaw || '◈', type: 'synth' },
    { id: 'sine', label: 'Sine', icon: ICONS.sine || '∿', type: 'synth' },
    { id: 'square', label: 'Square', icon: ICONS.square || '◻', type: 'synth' },
    { id: 'triangle', label: 'Triangle', icon: ICONS.triangle || '△', type: 'synth' },
  ]},
  { label: 'Keys', items: [
    { id: 'gm_piano', label: 'Piano', icon: '🎹', type: 'synth' },
    { id: 'gm_epiano1', label: 'Rhodes', icon: '⎚', type: 'synth' },
    { id: 'gm_epiano2', label: 'DX7', icon: '⎛', type: 'synth' },
    { id: 'gm_music_box', label: 'Music Box', icon: '❊', type: 'synth' },
    { id: 'gm_vibraphone', label: 'Vibes', icon: '⟡', type: 'synth' },
    { id: 'gm_marimba', label: 'Marimba', icon: '⊞', type: 'synth' },
    { id: 'gm_clavinet', label: 'Clavinet', icon: '⊟', type: 'synth' },
  ]},
  { label: 'Strings', items: [
    { id: 'gm_violin', label: 'Violin', icon: '🎻', type: 'synth' },
    { id: 'gm_viola', label: 'Viola', icon: '⌒', type: 'synth' },
    { id: 'gm_cello', label: 'Cello', icon: '⌓', type: 'synth' },
    { id: 'gm_contrabass', label: 'Bass', icon: '⌔', type: 'synth' },
    { id: 'gm_string_ensemble_1', label: 'Ensemble', icon: '≋', type: 'synth' },
    { id: 'gm_orchestral_harp', label: 'Harp', icon: '⌇', type: 'synth' },
  ]},
  { label: 'Brass & Wind', items: [
    { id: 'gm_trumpet', label: 'Trumpet', icon: '🎺', type: 'synth' },
    { id: 'gm_trombone', label: 'Trombone', icon: '⌠', type: 'synth' },
    { id: 'gm_french_horn', label: 'Horn', icon: '⌡', type: 'synth' },
    { id: 'gm_alto_sax', label: 'Alto Sax', icon: '🎷', type: 'synth' },
    { id: 'gm_tenor_sax', label: 'Tenor Sax', icon: '⊖', type: 'synth' },
    { id: 'gm_flute', label: 'Flute', icon: '⊘', type: 'synth' },
    { id: 'gm_piccolo', label: 'Piccolo', icon: '⊙', type: 'synth' },
  ]},
  { label: 'Guitar & Bass', items: [
    { id: 'gm_acoustic_guitar_nylon', label: 'Nylon Gtr', icon: '⌘', type: 'synth' },
    { id: 'gm_acoustic_guitar_steel', label: 'Steel Gtr', icon: '⎈', type: 'synth' },
    { id: 'gm_electric_guitar_jazz', label: 'Jazz Gtr', icon: '♪', type: 'synth' },
    { id: 'gm_electric_guitar_clean', label: 'Clean Gtr', icon: '♫', type: 'synth' },
    { id: 'gm_acoustic_bass', label: 'Ac. Bass', icon: '⎍', type: 'synth' },
    { id: 'gm_synth_bass_1', label: 'Syn Bass 1', icon: '⎑', type: 'synth' },
    { id: 'gm_synth_bass_2', label: 'Syn Bass 2', icon: '⎒', type: 'synth' },
  ]},
  { label: 'Leads & Pads', items: [
    { id: 'gm_lead_1_square', label: 'Lead Sq', icon: '▣', type: 'synth' },
    { id: 'gm_lead_2_sawtooth', label: 'Lead Saw', icon: '▤', type: 'synth' },
    { id: 'gm_pad_new_age', label: 'New Age', icon: '☁', type: 'synth' },
    { id: 'gm_pad_warm', label: 'Warm', icon: '☀', type: 'synth' },
    { id: 'gm_pad_poly', label: 'Poly', icon: '◈', type: 'synth' },
    { id: 'gm_pad_choir', label: 'Choir', icon: '♁', type: 'synth' },
    { id: 'gm_pad_sweep', label: 'Sweep', icon: '◌', type: 'synth' },
  ]},
  { label: 'Voice & Choir', items: [
    { id: 'gm_choir_aahs', label: 'Choir', icon: '🎤', type: 'vocal' },
    { id: 'gm_voice_oohs', label: 'Oohs', icon: '◔', type: 'vocal' },
    { id: 'gm_synth_choir', label: 'Syn Choir', icon: '◕', type: 'vocal' },
    { id: 'mouth', label: 'Mouth', icon: '👄', type: 'vocal' },
  ]},
]

const SOUND_SECTIONS: BrowserSection[] = [
  { label: 'Drums', items: [
    { id: 'bd', label: 'Kick', icon: '⬤', type: 'sample' },
    { id: 'sd', label: 'Snare', icon: '◎', type: 'sample' },
    { id: 'cp', label: 'Clap', icon: '✋', type: 'sample' },
    { id: 'hh', label: 'Hi-hat', icon: '⌃', type: 'sample' },
    { id: 'oh', label: 'Open HH', icon: '⌄', type: 'sample' },
    { id: 'rim', label: 'Rim', icon: '◇', type: 'sample' },
    { id: 'tom', label: 'Tom', icon: '◆', type: 'sample' },
    { id: 'ride', label: 'Ride', icon: '◠', type: 'sample' },
    { id: 'crash', label: 'Crash', icon: '✱', type: 'sample' },
    { id: 'perc', label: 'Perc', icon: '♦', type: 'sample' },
  ]},
  { label: 'Samples', items: [
    { id: 'casio', label: 'Casio', icon: '⌨', type: 'sample' },
    { id: 'jazz', label: 'Jazz Kit', icon: '♩', type: 'sample' },
    { id: 'metal', label: 'Metal', icon: '⛓', type: 'sample' },
    { id: 'gabba', label: 'Gabba', icon: '⚡', type: 'sample' },
    { id: 'space', label: 'Space', icon: '🌌', type: 'sample' },
  ]},
  { label: 'SFX & World', items: [
    { id: 'gm_fx_crystal', label: 'Crystal', icon: '❖', type: 'sample' },
    { id: 'gm_fx_atmosphere', label: 'Atmos', icon: '☾', type: 'sample' },
    { id: 'gm_fx_echoes', label: 'Echoes', icon: '◎', type: 'sample' },
    { id: 'gm_kalimba', label: 'Kalimba', icon: '⌭', type: 'synth' },
    { id: 'gm_sitar', label: 'Sitar', icon: '⌮', type: 'synth' },
    { id: 'gm_koto', label: 'Koto', icon: '⌯', type: 'synth' },
    { id: 'gm_steel_drums', label: 'Steel Dr', icon: '⊛', type: 'synth' },
  ]},
]

interface BankItem {
  id: string
  label: string
  icon: string
}

interface BankSection {
  label: string
  items: BankItem[]
}

const BANK_SECTIONS: BankSection[] = [
  { label: 'Roland', items: [
    { id: 'RolandTR808', label: 'TR-808', icon: '⑧' },
    { id: 'RolandTR909', label: 'TR-909', icon: '⑨' },
    { id: 'RolandTR707', label: 'TR-707', icon: '⑦' },
    { id: 'RolandTR606', label: 'TR-606', icon: '⑥' },
    { id: 'RolandTR505', label: 'TR-505', icon: '⑤' },
    { id: 'RolandTR727', label: 'TR-727', icon: '⑦' },
    { id: 'RolandCompurhythm78', label: 'CR-78', icon: '⓪' },
    { id: 'RolandR8', label: 'R-8', icon: '⑧' },
  ]},
  { label: 'Korg', items: [
    { id: 'KorgM1', label: 'M1', icon: '①' },
    { id: 'KorgMinipops', label: 'Minipops', icon: '②' },
    { id: 'KorgPoly800', label: 'Poly-800', icon: '③' },
    { id: 'KorgKPR77', label: 'KPR-77', icon: '④' },
  ]},
  { label: 'Linn & Akai', items: [
    { id: 'LinnDrum', label: 'LinnDrum', icon: 'Ⓛ' },
    { id: 'LinnLM1', label: 'LM-1', icon: '①' },
    { id: 'AkaiMPC60', label: 'MPC60', icon: 'Ⓜ' },
    { id: 'MPC1000', label: 'MPC1000', icon: 'Ⓜ' },
  ]},
  { label: 'Boss & Yamaha', items: [
    { id: 'BossDR110', label: 'DR-110', icon: 'Ⓑ' },
    { id: 'BossDR55', label: 'DR-55', icon: 'Ⓑ' },
    { id: 'YamahaRX5', label: 'RX5', icon: 'Ⓨ' },
    { id: 'YamahaRY30', label: 'RY30', icon: 'Ⓨ' },
  ]},
  { label: 'Emu & Oberheim', items: [
    { id: 'EmuDrumulator', label: 'Drumulator', icon: 'Ⓔ' },
    { id: 'EmuSP12', label: 'SP-12', icon: 'Ⓔ' },
    { id: 'OberheimDMX', label: 'DMX', icon: 'Ⓞ' },
  ]},
  { label: 'More Machines', items: [
    { id: 'AlesisHR16', label: 'HR-16', icon: 'Ⓐ' },
    { id: 'SimmonsSDS5', label: 'SDS-5', icon: 'Ⓢ' },
    { id: 'SequentialCircuitsDrumtracks', label: 'Drumtraks', icon: 'Ⓢ' },
    { id: 'CasioRZ1', label: 'RZ-1', icon: 'Ⓒ' },
    { id: 'MoogConcertMateMG1', label: 'Moog MG1', icon: 'Ⓜ' },
  ]},
  { label: 'Wavetable', items: [
    { id: 'wt_digital', label: 'WT Digital', icon: '∿' },
    { id: 'wt_digital_echoes', label: 'WT Echoes', icon: '◎' },
    { id: 'wt_vgame', label: 'WT VGame', icon: '⊞' },
  ]},
]

// ── Tab types ──

type Tab = 'instruments' | 'sounds' | 'banks'

// ── Props ──

interface StudioBrowserPanelProps {
  onAddChannel: (soundId: string, type: 'synth' | 'sample' | 'vocal' | 'instrument' | 'drumpad', loopAt?: number) => void
  onPreview?: (code: string) => void
  projectBpm?: number
}

export default function StudioBrowserPanel({
  onAddChannel,
  onPreview,
  projectBpm = 120,
}: StudioBrowserPanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>('instruments')
  const [search, setSearch] = useState('')
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set())

  const toggleSection = useCallback((label: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev)
      if (next.has(label)) next.delete(label)
      else next.add(label)
      return next
    })
  }, [])

  // Filter items based on search
  const filterItems = useCallback(<T extends { label: string }>(items: T[]): T[] => {
    if (!search) return items
    const q = search.toLowerCase()
    return items.filter(item => item.label.toLowerCase().includes(q))
  }, [search])

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'instruments', label: 'INST', icon: '🎹' },
    { id: 'sounds', label: 'SNDS', icon: '🥁' },
    { id: 'banks', label: 'BANKS', icon: '📦' },
  ]

  return (
    <div className="flex flex-col h-full">
      {/* ── Tab bar ── */}
      <div className="flex shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); setSearch('') }}
            className="flex-1 flex items-center justify-center gap-1 py-2 text-[7px] font-black uppercase tracking-[.15em] cursor-pointer transition-all duration-150"
            style={{
              color: activeTab === tab.id ? '#e8ecf0' : '#5a616b',
              background: activeTab === tab.id ? '#16181d' : 'transparent',
              borderBottom: activeTab === tab.id ? '2px solid #7fa998' : '2px solid transparent',
            }}
          >
            <span className="text-[10px]">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Search ── */}
      <div className="px-2 py-1.5 shrink-0">
        <div
          className="flex items-center gap-1.5 px-2 py-1 rounded-lg"
          style={{
            background: '#0a0b0d',
            border: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <Search size={10} style={{ color: '#5a616b' }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search..."
            className="flex-1 bg-transparent text-[9px] text-white/80 outline-none placeholder:text-white/20"
            spellCheck={false}
          />
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto px-1" style={{ scrollbarWidth: 'thin', scrollbarColor: '#1a1d22 transparent' }}>

        {/* Instruments tab */}
        {activeTab === 'instruments' && (
          <div className="pb-2">
            {INSTRUMENT_SECTIONS.map(section => {
              const items = filterItems(section.items)
              if (items.length === 0) return null
              const isOpen = expandedSections.has(section.label) || search.length > 0
              return (
                <div key={section.label}>
                  <button
                    onClick={() => toggleSection(section.label)}
                    className="w-full flex items-center gap-1.5 px-2 py-1.5 text-[7px] font-black uppercase tracking-[.12em] cursor-pointer hover:bg-white/[0.02] transition-colors"
                    style={{ color: '#5a616b' }}
                  >
                    <span className="text-[5px]" style={{ color: '#7fa998' }}>{isOpen ? '▼' : '▶'}</span>
                    {section.label}
                    <span className="ml-auto text-[6px] opacity-40">{items.length}</span>
                  </button>
                  {isOpen && (
                    <div className="grid grid-cols-3 gap-1 px-1 pb-1.5">
                      {items.map(item => (
                        <button
                          key={item.id}
                          onClick={() => onAddChannel(item.id, item.type)}
                          className="flex flex-col items-center gap-0.5 py-2 px-1 rounded-lg cursor-pointer transition-all duration-150 hover:scale-[1.04] active:scale-95 group"
                          style={{
                            background: '#0a0b0d',
                            border: '1px solid rgba(255,255,255,0.03)',
                            boxShadow: '2px 2px 4px #050607, -1px -1px 3px #1a1d22',
                          }}
                          title={`Add ${item.label} channel`}
                        >
                          <span className="text-[16px] leading-none opacity-60 group-hover:opacity-100 transition-opacity">{item.icon}</span>
                          <span className="text-[6px] font-bold text-white/40 group-hover:text-white/70 truncate w-full text-center transition-colors">{item.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Sounds tab */}
        {activeTab === 'sounds' && (
          <div className="pb-2">
            {SOUND_SECTIONS.map(section => {
              const items = filterItems(section.items)
              if (items.length === 0) return null
              const isOpen = expandedSections.has(section.label) || search.length > 0
              return (
                <div key={section.label}>
                  <button
                    onClick={() => toggleSection(section.label)}
                    className="w-full flex items-center gap-1.5 px-2 py-1.5 text-[7px] font-black uppercase tracking-[.12em] cursor-pointer hover:bg-white/[0.02] transition-colors"
                    style={{ color: '#5a616b' }}
                  >
                    <span className="text-[5px]" style={{ color: '#b8a47f' }}>{isOpen ? '▼' : '▶'}</span>
                    {section.label}
                    <span className="ml-auto text-[6px] opacity-40">{items.length}</span>
                  </button>
                  {isOpen && (
                    <div className="grid grid-cols-3 gap-1 px-1 pb-1.5">
                      {items.map(item => (
                        <button
                          key={item.id}
                          onClick={() => onAddChannel(item.id, item.type)}
                          onContextMenu={(e) => { e.preventDefault(); onPreview?.(`s("${item.id}")`) }}
                          className="flex flex-col items-center gap-0.5 py-2 px-1 rounded-lg cursor-pointer transition-all duration-150 hover:scale-[1.04] active:scale-95 group relative"
                          style={{
                            background: '#0a0b0d',
                            border: '1px solid rgba(255,255,255,0.03)',
                            boxShadow: '2px 2px 4px #050607, -1px -1px 3px #1a1d22',
                          }}
                          title={`Add ${item.label} · Right-click to preview`}
                        >
                          <span className="text-[16px] leading-none opacity-60 group-hover:opacity-100 transition-opacity">{item.icon}</span>
                          <span className="text-[6px] font-bold text-white/40 group-hover:text-white/70 truncate w-full text-center transition-colors">{item.label}</span>
                          {/* Preview icon on hover */}
                          {onPreview && (
                            <button
                              onClick={(e) => { e.stopPropagation(); onPreview(`s("${item.id}")`) }}
                              className="absolute top-0.5 right-0.5 opacity-0 group-hover:opacity-60 hover:!opacity-100 p-0.5 rounded transition-opacity cursor-pointer"
                              style={{ background: 'rgba(127,169,152,0.15)' }}
                              title="Preview sound"
                            >
                              <Volume2 size={7} style={{ color: '#7fa998' }} />
                            </button>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Banks tab */}
        {activeTab === 'banks' && (
          <div className="pb-2">
            <div className="px-2 py-1 mb-1">
              <span className="text-[6px] text-white/25">Select a drum bank to apply to a channel</span>
            </div>
            {BANK_SECTIONS.map(section => {
              const items = filterItems(section.items)
              if (items.length === 0) return null
              const isOpen = expandedSections.has(section.label) || search.length > 0
              return (
                <div key={section.label}>
                  <button
                    onClick={() => toggleSection(section.label)}
                    className="w-full flex items-center gap-1.5 px-2 py-1.5 text-[7px] font-black uppercase tracking-[.12em] cursor-pointer hover:bg-white/[0.02] transition-colors"
                    style={{ color: '#5a616b' }}
                  >
                    <span className="text-[5px]" style={{ color: '#6f8fb3' }}>{isOpen ? '▼' : '▶'}</span>
                    {section.label}
                    <span className="ml-auto text-[6px] opacity-40">{items.length}</span>
                  </button>
                  {isOpen && (
                    <div className="grid grid-cols-2 gap-1 px-1 pb-1.5">
                      {items.map(item => (
                        <button
                          key={item.id}
                          onClick={() => onAddChannel('bd', 'sample')}
                          onContextMenu={(e) => { e.preventDefault(); onPreview?.(`s("bd").bank("${item.id}")`) }}
                          className="flex items-center gap-1.5 py-1.5 px-2 rounded-lg cursor-pointer transition-all duration-150 hover:scale-[1.02] active:scale-95 group"
                          style={{
                            background: '#0a0b0d',
                            border: '1px solid rgba(255,255,255,0.03)',
                            boxShadow: '2px 2px 4px #050607, -1px -1px 3px #1a1d22',
                          }}
                          title={`Add kit with ${item.label} bank · Right-click to preview`}
                        >
                          <span className="text-[12px] leading-none opacity-50 group-hover:opacity-90 transition-opacity">{item.icon}</span>
                          <span className="text-[7px] font-bold text-white/40 group-hover:text-white/70 truncate transition-colors">{item.label}</span>
                          {onPreview && (
                            <button
                              onClick={(e) => { e.stopPropagation(); onPreview(`s("bd").bank("${item.id}")`) }}
                              className="ml-auto opacity-0 group-hover:opacity-60 hover:!opacity-100 p-0.5 rounded transition-opacity cursor-pointer shrink-0"
                              style={{ background: 'rgba(111,143,179,0.15)' }}
                              title="Preview bank kick"
                            >
                              <Volume2 size={7} style={{ color: '#6f8fb3' }} />
                            </button>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
