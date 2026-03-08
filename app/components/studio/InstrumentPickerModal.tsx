'use client'

// ═══════════════════════════════════════════════════════════════
//  INSTRUMENT PICKER MODAL — opens when the user right-clicks an
//  audio clip and chooses "Create Instrument".  Instead of auto-
//  creating a channel, this lets the user browse and choose the
//  sound they want on the piano roll.
//
//  Categories: Synths · Keys · Strings · Brass & Wind · Guitar
//  & Bass · Leads & Pads · Voice · Drums · Samples
//
//  Selecting a sound triggers the parent callback with:
//    - clipId:  the source audio clip
//    - soundId: the chosen sound (e.g. "gm_piano")
//    - type:    'synth' | 'sample' | 'vocal'
// ═══════════════════════════════════════════════════════════════

import { useState, useCallback, useMemo } from 'react'
import { Search, X, Volume2 } from 'lucide-react'

// ── Icon map (mirrors StudioBrowserPanel) ──

const ICONS: Record<string, string> = {
  sawtooth: '◸', supersaw: '◈', sine: '∿', square: '◻', triangle: '△',
  gm_piano: '🎹', gm_epiano1: '⎚', gm_epiano2: '⎛', gm_music_box: '❊',
  gm_vibraphone: '⟡', gm_marimba: '⊞', gm_clavinet: '⊟',
  gm_violin: '🎻', gm_viola: '⌒', gm_cello: '⌓', gm_contrabass: '⌔',
  gm_string_ensemble_1: '≋', gm_orchestral_harp: '⌇',
  gm_trumpet: '🎺', gm_trombone: '⌠', gm_french_horn: '⌡',
  gm_alto_sax: '🎷', gm_tenor_sax: '⊖', gm_flute: '⊘', gm_piccolo: '⊙',
  gm_acoustic_guitar_nylon: '⌘', gm_acoustic_guitar_steel: '⎈',
  gm_electric_guitar_jazz: '♪', gm_electric_guitar_clean: '♫',
  gm_acoustic_bass: '⎍', gm_synth_bass_1: '⎑', gm_synth_bass_2: '⎒',
  gm_lead_1_square: '▣', gm_lead_2_sawtooth: '▤',
  gm_pad_new_age: '☁', gm_pad_warm: '☀', gm_pad_poly: '◈',
  gm_pad_choir: '♁', gm_pad_sweep: '◌',
  gm_choir_aahs: '🎤', gm_voice_oohs: '◔', gm_synth_choir: '◕', mouth: '👄',
}

// ── Sound items ──

interface SoundItem {
  id: string
  label: string
  icon: string
  type: 'synth' | 'sample' | 'vocal'
}

interface SoundSection {
  label: string
  color: string
  items: SoundItem[]
}

const SOUND_SECTIONS: SoundSection[] = [
  {
    label: 'Synths', color: '#00e5c7',
    items: [
      { id: 'sawtooth', label: 'Sawtooth', icon: '◸', type: 'synth' },
      { id: 'supersaw', label: 'Supersaw', icon: '◈', type: 'synth' },
      { id: 'sine', label: 'Sine', icon: '∿', type: 'synth' },
      { id: 'square', label: 'Square', icon: '◻', type: 'synth' },
      { id: 'triangle', label: 'Triangle', icon: '△', type: 'synth' },
    ],
  },
  {
    label: 'Keys', color: '#00e5c7',
    items: [
      { id: 'gm_piano', label: 'Piano', icon: '🎹', type: 'synth' },
      { id: 'gm_epiano1', label: 'Rhodes', icon: '⎚', type: 'synth' },
      { id: 'gm_epiano2', label: 'DX7', icon: '⎛', type: 'synth' },
      { id: 'gm_music_box', label: 'Music Box', icon: '❊', type: 'synth' },
      { id: 'gm_vibraphone', label: 'Vibes', icon: '⟡', type: 'synth' },
      { id: 'gm_marimba', label: 'Marimba', icon: '⊞', type: 'synth' },
      { id: 'gm_clavinet', label: 'Clavinet', icon: '⊟', type: 'synth' },
    ],
  },
  {
    label: 'Strings', color: '#a78bfa',
    items: [
      { id: 'gm_violin', label: 'Violin', icon: '🎻', type: 'synth' },
      { id: 'gm_viola', label: 'Viola', icon: '⌒', type: 'synth' },
      { id: 'gm_cello', label: 'Cello', icon: '⌓', type: 'synth' },
      { id: 'gm_contrabass', label: 'Bass', icon: '⌔', type: 'synth' },
      { id: 'gm_string_ensemble_1', label: 'Ensemble', icon: '≋', type: 'synth' },
      { id: 'gm_orchestral_harp', label: 'Harp', icon: '⌇', type: 'synth' },
    ],
  },
  {
    label: 'Brass & Wind', color: '#f59e0b',
    items: [
      { id: 'gm_trumpet', label: 'Trumpet', icon: '🎺', type: 'synth' },
      { id: 'gm_trombone', label: 'Trombone', icon: '⌠', type: 'synth' },
      { id: 'gm_french_horn', label: 'Horn', icon: '⌡', type: 'synth' },
      { id: 'gm_alto_sax', label: 'Alto Sax', icon: '🎷', type: 'synth' },
      { id: 'gm_tenor_sax', label: 'Tenor Sax', icon: '⊖', type: 'synth' },
      { id: 'gm_flute', label: 'Flute', icon: '⊘', type: 'synth' },
      { id: 'gm_piccolo', label: 'Piccolo', icon: '⊙', type: 'synth' },
    ],
  },
  {
    label: 'Guitar & Bass', color: '#ef4444',
    items: [
      { id: 'gm_acoustic_guitar_nylon', label: 'Nylon Gtr', icon: '⌘', type: 'synth' },
      { id: 'gm_acoustic_guitar_steel', label: 'Steel Gtr', icon: '⎈', type: 'synth' },
      { id: 'gm_electric_guitar_jazz', label: 'Jazz Gtr', icon: '♪', type: 'synth' },
      { id: 'gm_electric_guitar_clean', label: 'Clean Gtr', icon: '♫', type: 'synth' },
      { id: 'gm_acoustic_bass', label: 'Ac. Bass', icon: '⎍', type: 'synth' },
      { id: 'gm_synth_bass_1', label: 'Syn Bass 1', icon: '⎑', type: 'synth' },
      { id: 'gm_synth_bass_2', label: 'Syn Bass 2', icon: '⎒', type: 'synth' },
    ],
  },
  {
    label: 'Leads & Pads', color: '#ec4899',
    items: [
      { id: 'gm_lead_1_square', label: 'Lead Sq', icon: '▣', type: 'synth' },
      { id: 'gm_lead_2_sawtooth', label: 'Lead Saw', icon: '▤', type: 'synth' },
      { id: 'gm_pad_new_age', label: 'New Age', icon: '☁', type: 'synth' },
      { id: 'gm_pad_warm', label: 'Warm', icon: '☀', type: 'synth' },
      { id: 'gm_pad_poly', label: 'Poly', icon: '◈', type: 'synth' },
      { id: 'gm_pad_choir', label: 'Choir', icon: '♁', type: 'synth' },
      { id: 'gm_pad_sweep', label: 'Sweep', icon: '◌', type: 'synth' },
    ],
  },
  {
    label: 'Voice & Choir', color: '#14b8a6',
    items: [
      { id: 'gm_choir_aahs', label: 'Choir', icon: '🎤', type: 'vocal' },
      { id: 'gm_voice_oohs', label: 'Oohs', icon: '◔', type: 'vocal' },
      { id: 'gm_synth_choir', label: 'Syn Choir', icon: '◕', type: 'vocal' },
      { id: 'mouth', label: 'Mouth', icon: '👄', type: 'vocal' },
    ],
  },
]

// Special option: "Use My Recording" — use the clip's own audio as the instrument
const USE_CLIP_SOUND: SoundItem = {
  id: '__clip__',
  label: 'My Recording',
  icon: '🎙️',
  type: 'sample',
}

// ── Props ──

interface InstrumentPickerModalProps {
  isOpen: boolean
  clipName: string
  onClose: () => void
  /** Called when the user picks a sound.  soundId='__clip__' means use the clip's own audio */
  onSelect: (soundId: string) => void
  /** Optional preview callback — plays a brief snippet of the sound */
  onPreview?: (code: string) => void
}

export default function InstrumentPickerModal({
  isOpen,
  clipName,
  onClose,
  onSelect,
  onPreview,
}: InstrumentPickerModalProps) {
  const [search, setSearch] = useState('')
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  const filteredSections = useMemo(() => {
    if (!search) return SOUND_SECTIONS
    const q = search.toLowerCase()
    return SOUND_SECTIONS.map(s => ({
      ...s,
      items: s.items.filter(i => i.label.toLowerCase().includes(q) || i.id.toLowerCase().includes(q)),
    })).filter(s => s.items.length > 0)
  }, [search])

  const handleSelect = useCallback((item: SoundItem) => {
    onSelect(item.id)
    onClose()
  }, [onSelect, onClose])

  const handlePreview = useCallback((item: SoundItem) => {
    if (!onPreview) return
    if (item.type === 'synth') {
      onPreview(`note("c3 e3 g3 c4").s("${item.id}")`)
    } else {
      onPreview(`s("${item.id}")`)
    }
  }, [onPreview])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="relative flex flex-col rounded-xl overflow-hidden shadow-2xl"
        style={{
          width: 480,
          maxHeight: '80vh',
          background: '#111318',
          border: '1px solid #2a2d38',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 py-3 shrink-0" style={{ borderBottom: '1px solid #1e2028' }}>
          <div>
            <h2 className="text-sm font-bold text-white/90">Choose Instrument Sound</h2>
            <p className="text-[10px] text-white/40 mt-0.5">
              Select a sound for <span className="text-emerald-400 font-semibold">{clipName}</span> on the piano roll
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-white/[0.06] transition-colors cursor-pointer"
          >
            <X size={16} className="text-white/40" />
          </button>
        </div>

        {/* ── Search ── */}
        <div className="px-4 py-2 shrink-0">
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
            style={{ background: '#0a0b0d', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            <Search size={12} className="text-white/30" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search instruments..."
              className="flex-1 bg-transparent text-xs text-white/80 outline-none placeholder:text-white/20"
              autoFocus
              spellCheck={false}
            />
          </div>
        </div>

        {/* ── Use My Recording (clip's own audio) ── */}
        <div className="px-4 pt-1 pb-2 shrink-0">
          <button
            onClick={() => handleSelect(USE_CLIP_SOUND)}
            onMouseEnter={() => setHoveredId('__clip__')}
            onMouseLeave={() => setHoveredId(null)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all cursor-pointer"
            style={{
              background: hoveredId === '__clip__' ? 'rgba(16,185,129,0.12)' : 'rgba(16,185,129,0.06)',
              border: '1px solid rgba(16,185,129,0.2)',
            }}
          >
            <span className="text-xl leading-none">🎙️</span>
            <div className="flex flex-col items-start">
              <span className="text-xs font-bold text-emerald-400">Use My Recording</span>
              <span className="text-[9px] text-white/40">Use the clip&apos;s own audio as the piano roll instrument</span>
            </div>
            <span className="ml-auto text-[9px] text-emerald-400/60 font-mono">RECOMMENDED</span>
          </button>
        </div>

        <div className="px-4 pb-1 shrink-0">
          <div className="text-[8px] font-black uppercase tracking-[.2em] text-white/20">or choose a built-in sound</div>
        </div>

        {/* ── Sound grid ── */}
        <div className="flex-1 overflow-y-auto px-4 pb-4" style={{ scrollbarWidth: 'thin', scrollbarColor: '#1a1d22 transparent' }}>
          {filteredSections.map(section => (
            <div key={section.label} className="mb-3">
              <div className="flex items-center gap-1.5 mb-1.5">
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: section.color }} />
                <span className="text-[9px] font-black uppercase tracking-[.12em]" style={{ color: section.color }}>
                  {section.label}
                </span>
                <span className="text-[8px] text-white/20 ml-1">{section.items.length}</span>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {section.items.map(item => (
                  <button
                    key={item.id}
                    onClick={() => handleSelect(item)}
                    onMouseEnter={() => setHoveredId(item.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    className="relative flex flex-col items-center gap-1 py-2.5 px-1 rounded-lg transition-all duration-150 hover:scale-[1.04] active:scale-95 group cursor-pointer"
                    style={{
                      background: hoveredId === item.id ? '#1a1c24' : '#0c0d10',
                      border: `1px solid ${hoveredId === item.id ? section.color + '40' : 'rgba(255,255,255,0.03)'}`,
                      boxShadow: hoveredId === item.id ? `0 0 12px ${section.color}15` : '2px 2px 4px #050607, -1px -1px 3px #1a1d22',
                    }}
                    title={`Select ${item.label}`}
                  >
                    <span className="text-lg leading-none opacity-60 group-hover:opacity-100 transition-opacity">
                      {item.icon}
                    </span>
                    <span className="text-[8px] font-bold text-white/50 group-hover:text-white/80 truncate w-full text-center transition-colors">
                      {item.label}
                    </span>
                    {/* Preview button */}
                    {onPreview && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handlePreview(item) }}
                        className="absolute top-1 right-1 opacity-0 group-hover:opacity-60 hover:!opacity-100 p-0.5 rounded transition-opacity cursor-pointer"
                        style={{ background: `${section.color}20` }}
                        title="Preview sound"
                      >
                        <Volume2 size={8} style={{ color: section.color }} />
                      </button>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}
          {filteredSections.length === 0 && (
            <div className="flex items-center justify-center py-8 text-[11px] text-white/20">
              No sounds match &quot;{search}&quot;
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
