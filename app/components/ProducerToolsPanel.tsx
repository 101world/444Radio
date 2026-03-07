'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  StickyNote, Music, Timer, Hash, Palette, ChevronDown, ChevronRight,
  Save, Trash2, Plus, Play, Pause, Square, RotateCcw, Volume2
} from 'lucide-react'

// ─── Types ──────────────────────────────────────────────────────
interface Note {
  id: string
  title: string
  content: string
  updatedAt: number
}

// ─── Musical constants ──────────────────────────────────────────
const ALL_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

const SCALE_FORMULAS: Record<string, number[]> = {
  'Major': [0, 2, 4, 5, 7, 9, 11],
  'Natural Minor': [0, 2, 3, 5, 7, 8, 10],
  'Harmonic Minor': [0, 2, 3, 5, 7, 8, 11],
  'Melodic Minor': [0, 2, 3, 5, 7, 9, 11],
  'Dorian': [0, 2, 3, 5, 7, 9, 10],
  'Mixolydian': [0, 2, 4, 5, 7, 9, 10],
  'Pentatonic Major': [0, 2, 4, 7, 9],
  'Pentatonic Minor': [0, 3, 5, 7, 10],
  'Blues': [0, 3, 5, 6, 7, 10],
}

const CHORD_PROGRESSIONS: Record<string, { name: string; numerals: string; description: string }[]> = {
  'Pop': [
    { name: 'Classic Pop', numerals: 'I – V – vi – IV', description: 'The most common pop progression ever' },
    { name: 'Emotional Pop', numerals: 'vi – IV – I – V', description: 'Sad/emotional feel used in countless hits' },
    { name: 'Anthem', numerals: 'I – IV – V – IV', description: 'Powerful, driving feel' },
  ],
  'Lo-Fi / Chill': [
    { name: 'Jazzy Lo-Fi', numerals: 'ii7 – V7 – Imaj7 – vi7', description: 'Warm jazzy feel with 7th chords' },
    { name: 'Dreamy', numerals: 'Imaj7 – iii7 – vi7 – IV', description: 'Floating, dreamy atmosphere' },
    { name: 'Night Drive', numerals: 'Imaj9 – IVmaj7 – vi9 – V7', description: 'Extended chords for ambient mood' },
  ],
  'Hip-Hop': [
    { name: 'Trap', numerals: 'i – VI – III – VII', description: 'Dark minor key trap feel' },
    { name: 'Boom Bap', numerals: 'i – iv – V – i', description: 'Classic hip-hop progression' },
    { name: 'Drill', numerals: 'i – v – VI – iv', description: 'Aggressive minor feel' },
  ],
  'R&B': [
    { name: 'Neo Soul', numerals: 'Imaj7 – IV7 – iii7 – vi7', description: 'Smooth, sophisticated soul' },
    { name: 'Slow Jam', numerals: 'I – vi – IV – V', description: 'Classic R&B ballad' },
    { name: 'Modern R&B', numerals: 'vi – V – IV – I', description: 'Contemporary smooth R&B' },
  ],
  'Jazz': [
    { name: 'ii-V-I', numerals: 'ii7 – V7 – Imaj7', description: 'The quintessential jazz progression' },
    { name: 'Autumn Leaves', numerals: 'ii7 – V7 – Imaj7 – IVmaj7 – viiø7 – III7 – vi', description: 'Classic jazz standard changes' },
    { name: 'Rhythm Changes', numerals: 'I – vi – ii – V', description: 'Based on "I Got Rhythm"' },
  ],
  'EDM / Electronic': [
    { name: 'Festival', numerals: 'i – VI – III – VII', description: 'Big room / festival anthem' },
    { name: 'Progressive', numerals: 'i – VII – VI – VII', description: 'Building, progressive feel' },
    { name: 'Deep House', numerals: 'i – iv – VI – V', description: 'Groovy deep house vibe' },
  ],
}

const FREQUENCY_RANGES = [
  { range: '20–60 Hz', name: 'Sub Bass', color: 'from-purple-500/20 to-purple-500/5', instruments: 'Sub bass, kick drum body' },
  { range: '60–200 Hz', name: 'Bass', color: 'from-blue-500/20 to-blue-500/5', instruments: 'Bass guitar, 808, kick attack' },
  { range: '200–500 Hz', name: 'Low Mids', color: 'from-cyan-500/20 to-cyan-500/5', instruments: 'Guitar body, vocals warmth, snare body' },
  { range: '500–2k Hz', name: 'Mids', color: 'from-green-500/20 to-green-500/5', instruments: 'Vocals presence, guitar, keys' },
  { range: '2k–5k Hz', name: 'Upper Mids', color: 'from-yellow-500/20 to-yellow-500/5', instruments: 'Vocal clarity, guitar bite, snare crack' },
  { range: '5k–10k Hz', name: 'Presence', color: 'from-orange-500/20 to-orange-500/5', instruments: 'Hi-hats, cymbal definition, sibilance' },
  { range: '10k–20k Hz', name: 'Air / Brilliance', color: 'from-red-500/20 to-red-500/5', instruments: 'Shimmer, air, cymbal sparkle' },
]

const SONG_STRUCTURES = [
  { name: 'Standard Pop', structure: 'Intro → Verse → Chorus → Verse → Chorus → Bridge → Chorus → Outro' },
  { name: 'Verse-Chorus', structure: 'Intro → Verse → Chorus → Verse → Chorus → Chorus → Outro' },
  { name: 'Hip-Hop', structure: 'Intro → Verse → Hook → Verse → Hook → Verse → Hook → Outro' },
  { name: 'EDM Drop', structure: 'Intro → Build → Drop → Break → Build → Drop → Outro' },
  { name: 'Lo-Fi Loop', structure: 'Intro → A Section (loop) → B Section → A Section → Breakdown → A Section → Outro' },
  { name: 'AABA (Jazz)', structure: 'A → A → B (Bridge) → A' },
]

// ═══════════════════════════════════════════════════════════════
//  PRODUCER TOOLS PANEL
// ═══════════════════════════════════════════════════════════════
export default function ProducerToolsPanel({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<string>('notes')

  // ── Notes state ──
  const [notes, setNotes] = useState<Note[]>([])
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null)

  // ── BPM Tapper ──
  const [taps, setTaps] = useState<number[]>([])
  const [bpm, setBpm] = useState<number | null>(null)
  const [tapCount, setTapCount] = useState(0)

  // ── Key/Scale ──
  const [selectedRoot, setSelectedRoot] = useState('C')
  const [selectedScale, setSelectedScale] = useState('Major')

  // ── Chords ──
  const [selectedGenre, setSelectedGenre] = useState('Pop')

  // ── Timer ──
  const [timerRunning, setTimerRunning] = useState(false)
  const [timerSeconds, setTimerSeconds] = useState(0)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  // ── Load notes from localStorage ──
  useEffect(() => {
    try {
      const saved = localStorage.getItem('444_producer_notes')
      if (saved) setNotes(JSON.parse(saved))
    } catch {}
  }, [])

  // ── Save notes ──
  useEffect(() => {
    if (notes.length > 0) {
      localStorage.setItem('444_producer_notes', JSON.stringify(notes))
    }
  }, [notes])

  // ── Timer ──
  useEffect(() => {
    if (timerRunning) {
      timerRef.current = setInterval(() => setTimerSeconds(s => s + 1), 1000)
    } else if (timerRef.current) {
      clearInterval(timerRef.current)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [timerRunning])

  const formatTime = (s: number) => {
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    const sec = s % 60
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
  }

  // ── BPM logic ──
  const handleTap = useCallback(() => {
    const now = Date.now()
    setTaps(prev => {
      const newTaps = [...prev, now].slice(-8)
      if (newTaps.length >= 2) {
        const intervals = []
        for (let i = 1; i < newTaps.length; i++) {
          intervals.push(newTaps[i] - newTaps[i - 1])
        }
        const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length
        setBpm(Math.round(60000 / avgInterval))
      }
      setTapCount(c => c + 1)
      return newTaps
    })
  }, [])

  const resetBpm = () => {
    setTaps([])
    setBpm(null)
    setTapCount(0)
  }

  // ── Notes helpers ──
  const createNote = () => {
    const note: Note = { id: Date.now().toString(), title: 'Untitled', content: '', updatedAt: Date.now() }
    setNotes(n => [note, ...n])
    setActiveNoteId(note.id)
  }

  const updateNote = (id: string, field: 'title' | 'content', value: string) => {
    setNotes(n => n.map(note => note.id === id ? { ...note, [field]: value, updatedAt: Date.now() } : note))
  }

  const deleteNote = (id: string) => {
    setNotes(n => n.filter(note => note.id !== id))
    if (activeNoteId === id) setActiveNoteId(null)
  }

  // ── Scale notes helper ──
  const getScaleNotes = (root: string, scale: string) => {
    const rootIndex = ALL_NOTES.indexOf(root)
    const formula = SCALE_FORMULAS[scale] || SCALE_FORMULAS['Major']
    return formula.map(interval => ALL_NOTES[(rootIndex + interval) % 12])
  }

  if (!isOpen) return null

  const activeNote = notes.find(n => n.id === activeNoteId)

  const tabs = [
    { key: 'notes', icon: StickyNote, label: 'Notes' },
    { key: 'bpm', icon: Music, label: 'BPM' },
    { key: 'keys', icon: Hash, label: 'Keys' },
    { key: 'chords', icon: Music, label: 'Chords' },
    { key: 'freq', icon: Volume2, label: 'EQ Ref' },
    { key: 'timer', icon: Timer, label: 'Timer' },
    { key: 'structure', icon: Palette, label: 'Structure' },
  ]

  return (
    <div className="fixed inset-0 z-[55] bg-black/90 backdrop-blur-xl flex items-center justify-center p-4">
      <div className="w-full max-w-3xl max-h-[90vh] bg-gradient-to-b from-gray-950 via-black to-gray-950 rounded-2xl border border-cyan-500/20 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-cyan-500/10 bg-black/80">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-500 to-cyan-600 flex items-center justify-center shadow-lg">
              <Music size={14} className="text-white" />
            </div>
            <h2 className="text-sm font-bold text-white">Producer Tools</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-red-500/10 text-white/30 hover:text-red-400 transition-colors">
            <span className="text-sm">✕</span>
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex gap-0.5 px-3 py-2 border-b border-white/5 overflow-x-auto scrollbar-hide">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-bold whitespace-nowrap transition-all ${
                activeTab === tab.key
                  ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                  : 'text-white/35 hover:text-white/60 hover:bg-white/5'
              }`}
            >
              <tab.icon size={11} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* ═══ NOTES ═══ */}
          {activeTab === 'notes' && (
            <div className="flex gap-3 h-full min-h-[300px]">
              {/* Note list */}
              <div className="w-40 flex-shrink-0 flex flex-col gap-2">
                <button onClick={createNote} className="w-full flex items-center justify-center gap-1 px-3 py-2 bg-cyan-500/10 border border-cyan-500/20 rounded-lg text-xs text-cyan-300 hover:bg-cyan-500/20 transition-all">
                  <Plus size={12} /> New Note
                </button>
                <div className="flex-1 overflow-y-auto space-y-1">
                  {notes.map(note => (
                    <div
                      key={note.id}
                      onClick={() => setActiveNoteId(note.id)}
                      className={`group flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs cursor-pointer transition-all ${
                        activeNoteId === note.id ? 'bg-white/10 text-white' : 'text-white/40 hover:bg-white/5 hover:text-white/70'
                      }`}
                    >
                      <StickyNote size={10} />
                      <span className="flex-1 truncate">{note.title || 'Untitled'}</span>
                      <button
                        onClick={e => { e.stopPropagation(); deleteNote(note.id) }}
                        className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-red-400"
                      >
                        <Trash2 size={9} />
                      </button>
                    </div>
                  ))}
                  {notes.length === 0 && (
                    <p className="text-[10px] text-white/15 text-center mt-4">No notes yet</p>
                  )}
                </div>
              </div>

              {/* Note editor */}
              <div className="flex-1 flex flex-col gap-2">
                {activeNote ? (
                  <>
                    <input
                      value={activeNote.title}
                      onChange={e => updateNote(activeNote.id, 'title', e.target.value)}
                      className="w-full bg-transparent border-b border-white/10 px-1 py-1 text-sm font-bold text-white focus:outline-none focus:border-cyan-500/30"
                      placeholder="Note title..."
                    />
                    <textarea
                      value={activeNote.content}
                      onChange={e => updateNote(activeNote.id, 'content', e.target.value)}
                      className="flex-1 w-full bg-white/[0.02] border border-white/5 rounded-lg p-3 text-xs text-white/80 placeholder-white/20 focus:outline-none focus:border-cyan-500/20 resize-none font-mono leading-relaxed min-h-[200px]"
                      placeholder="Write your ideas, lyrics, notes..."
                    />
                    <p className="text-[9px] text-white/15">Auto-saved locally • {new Date(activeNote.updatedAt).toLocaleTimeString()}</p>
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-white/15 text-xs">
                    Select or create a note
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ═══ BPM TAPPER ═══ */}
          {activeTab === 'bpm' && (
            <div className="flex flex-col items-center gap-6 py-8">
              <div className="text-center">
                <div className="text-5xl font-black text-white tabular-nums" style={{ textShadow: '0 0 30px rgba(6,182,212,0.3)' }}>
                  {bpm ?? '---'}
                </div>
                <p className="text-xs text-white/30 mt-1">BPM</p>
              </div>

              <button
                onClick={handleTap}
                className="w-32 h-32 rounded-full bg-gradient-to-br from-cyan-500/20 to-purple-500/20 border-2 border-cyan-500/30 flex items-center justify-center hover:from-cyan-500/30 hover:to-purple-500/30 active:scale-95 transition-all shadow-lg shadow-cyan-500/10"
              >
                <span className="text-lg font-bold text-white">TAP</span>
              </button>

              <div className="flex items-center gap-3">
                <span className="text-[10px] text-white/20">{tapCount} taps</span>
                <button onClick={resetBpm} className="flex items-center gap-1 px-3 py-1 bg-white/5 rounded-lg text-[10px] text-white/40 hover:bg-white/10 transition-all">
                  <RotateCcw size={10} /> Reset
                </button>
              </div>

              <p className="text-[10px] text-white/15 max-w-xs text-center leading-relaxed">
                Tap the button in rhythm with the music to detect BPM. At least 2 taps needed. More taps = more accuracy.
              </p>
            </div>
          )}

          {/* ═══ KEY & SCALE ═══ */}
          {activeTab === 'keys' && (
            <div className="space-y-4">
              <div className="flex gap-3">
                {/* Root selector */}
                <div>
                  <label className="text-[10px] text-white/30 uppercase tracking-wider font-bold block mb-1">Root</label>
                  <div className="flex flex-wrap gap-1">
                    {ALL_NOTES.map(note => (
                      <button
                        key={note}
                        onClick={() => setSelectedRoot(note)}
                        className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${
                          selectedRoot === note ? 'bg-cyan-500/20 border border-cyan-500/40 text-cyan-300' : 'bg-white/[0.03] border border-white/10 text-white/50 hover:text-white/80'
                        }`}
                      >
                        {note}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Scale selector */}
                <div className="flex-1">
                  <label className="text-[10px] text-white/30 uppercase tracking-wider font-bold block mb-1">Scale</label>
                  <div className="flex flex-wrap gap-1">
                    {Object.keys(SCALE_FORMULAS).map(scale => (
                      <button
                        key={scale}
                        onClick={() => setSelectedScale(scale)}
                        className={`px-2 py-1 rounded-lg text-[10px] font-medium transition-all ${
                          selectedScale === scale ? 'bg-purple-500/20 border border-purple-500/40 text-purple-300' : 'bg-white/[0.03] border border-white/10 text-white/40 hover:text-white/70'
                        }`}
                      >
                        {scale}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Scale notes display */}
              <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
                <h4 className="text-xs font-bold text-white/60 mb-3">{selectedRoot} {selectedScale}</h4>
                <div className="flex gap-2">
                  {getScaleNotes(selectedRoot, selectedScale).map((note, i) => (
                    <div key={i} className="flex flex-col items-center gap-1">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-b from-cyan-500/15 to-transparent border border-cyan-500/20 flex items-center justify-center text-sm font-bold text-cyan-300">
                        {note}
                      </div>
                      <span className="text-[9px] text-white/20">{i + 1}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Piano visualization */}
              <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
                <h4 className="text-[10px] font-bold text-white/30 mb-2 uppercase tracking-wider">Piano View</h4>
                <div className="flex gap-0.5 relative h-16">
                  {ALL_NOTES.map((note, i) => {
                    const isInScale = getScaleNotes(selectedRoot, selectedScale).includes(note)
                    const isSharp = note.includes('#')
                    return (
                      <div
                        key={note}
                        className={`flex-1 rounded-b-md flex items-end justify-center pb-1 transition-all ${
                          isSharp
                            ? `${isInScale ? 'bg-cyan-700' : 'bg-gray-800'} border border-gray-700 z-10 h-10`
                            : `${isInScale ? 'bg-cyan-400/80' : 'bg-white/80'} border border-gray-300 h-16`
                        }`}
                      >
                        <span className={`text-[7px] font-bold ${isSharp ? (isInScale ? 'text-white' : 'text-gray-500') : (isInScale ? 'text-white' : 'text-gray-500')}`}>
                          {note}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ═══ CHORD PROGRESSIONS ═══ */}
          {activeTab === 'chords' && (
            <div className="space-y-4">
              {/* Genre tabs */}
              <div className="flex flex-wrap gap-1">
                {Object.keys(CHORD_PROGRESSIONS).map(genre => (
                  <button
                    key={genre}
                    onClick={() => setSelectedGenre(genre)}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                      selectedGenre === genre ? 'bg-purple-500/20 border border-purple-500/30 text-purple-300' : 'bg-white/[0.03] border border-white/10 text-white/35 hover:text-white/60'
                    }`}
                  >
                    {genre}
                  </button>
                ))}
              </div>

              {/* Progressions */}
              <div className="space-y-2">
                {CHORD_PROGRESSIONS[selectedGenre]?.map((prog, i) => (
                  <div key={i} className="bg-white/[0.02] border border-white/5 rounded-xl p-4 hover:border-purple-500/20 transition-all">
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="text-xs font-bold text-white/80">{prog.name}</h4>
                    </div>
                    <div className="text-lg font-bold text-purple-300 mb-1 tracking-wide font-mono">{prog.numerals}</div>
                    <p className="text-[10px] text-white/30">{prog.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ═══ FREQUENCY REFERENCE ═══ */}
          {activeTab === 'freq' && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-white/50 mb-3">EQ Frequency Reference</h3>
              {FREQUENCY_RANGES.map((range, i) => (
                <div key={i} className={`bg-gradient-to-r ${range.color} border border-white/5 rounded-xl p-3`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-white/80">{range.name}</span>
                    <span className="text-[10px] text-white/30 font-mono">{range.range}</span>
                  </div>
                  <p className="text-[10px] text-white/40">{range.instruments}</p>
                </div>
              ))}
            </div>
          )}

          {/* ═══ SESSION TIMER ═══ */}
          {activeTab === 'timer' && (
            <div className="flex flex-col items-center gap-6 py-8">
              <div className="text-center">
                <div className="text-5xl font-black text-white font-mono tabular-nums" style={{ textShadow: '0 0 30px rgba(6,182,212,0.2)' }}>
                  {formatTime(timerSeconds)}
                </div>
                <p className="text-xs text-white/30 mt-2">Session Timer</p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setTimerRunning(!timerRunning)}
                  className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
                    timerRunning ? 'bg-red-500/20 border-2 border-red-500/40 text-red-400 hover:bg-red-500/30' : 'bg-cyan-500/20 border-2 border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/30'
                  }`}
                >
                  {timerRunning ? <Pause size={20} /> : <Play size={20} />}
                </button>
                <button
                  onClick={() => { setTimerRunning(false); setTimerSeconds(0) }}
                  className="w-14 h-14 rounded-full bg-white/5 border-2 border-white/10 flex items-center justify-center text-white/30 hover:bg-white/10 hover:text-white/60 transition-all"
                >
                  <RotateCcw size={16} />
                </button>
              </div>

              <p className="text-[10px] text-white/15 max-w-xs text-center leading-relaxed">
                Track your production session length. Timer persists while you switch tools.
              </p>
            </div>
          )}

          {/* ═══ SONG STRUCTURE ═══ */}
          {activeTab === 'structure' && (
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-white/50 mb-3">Song Structure Templates</h3>
              {SONG_STRUCTURES.map((struct, i) => (
                <div key={i} className="bg-white/[0.02] border border-white/5 rounded-xl p-4 hover:border-cyan-500/15 transition-all">
                  <h4 className="text-xs font-bold text-white/80 mb-2">{struct.name}</h4>
                  <div className="flex flex-wrap gap-1">
                    {struct.structure.split(' → ').map((section, j) => (
                      <div key={j} className="flex items-center gap-1">
                        <span className="px-2 py-1 bg-cyan-500/10 border border-cyan-500/20 rounded text-[10px] text-cyan-300 font-mono font-bold">
                          {section}
                        </span>
                        {j < struct.structure.split(' → ').length - 1 && (
                          <ChevronRight size={10} className="text-white/15" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
