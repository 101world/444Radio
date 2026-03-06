'use client'

import React, { useState, useMemo, useCallback, useRef, useEffect, memo } from 'react'
import { GENRE_TEMPLATES, type GenreTemplate } from './StudioGenreSelector'

// ═══════════════════════════════════════════════════════════════
//  PRESET RACK — Futuristic hardware rack plugin for browsing
//  genre presets. Organised by sound category with visual info
//  display showing what each preset does.
//
//  Design: vertical rack-mount unit, futuristic dark metal with
//  holographic accents, LED matrix display, machined bevels.
// ═══════════════════════════════════════════════════════════════

// ── Preset categories for rack organisation ──
interface PresetCategory {
  id: string
  label: string
  icon: string
  color: string
  presetIds: string[]
  desc: string
}

const PRESET_CATEGORIES: PresetCategory[] = [
  {
    id: 'electronic',
    label: 'ELECTRONIC',
    icon: '⚡',
    color: '#22d3ee',
    desc: 'Synthesizer-driven electronic genres',
    presetIds: ['acid', 'trance', 'techno', 'darkhouse', 'minimal', 'melotechno', 'rave'],
  },
  {
    id: 'house',
    label: 'HOUSE & DANCE',
    icon: '🏠',
    color: '#a78bfa',
    desc: 'Four-on-the-floor dance music',
    presetIds: ['house', 'proghouse', 'disco', 'garage', 'edm'],
  },
  {
    id: 'hiphop',
    label: 'HIP-HOP & R&B',
    icon: '🎤',
    color: '#f97316',
    desc: 'Beat-driven urban sounds',
    presetIds: ['boombap', 'trap', 'phonk', 'rnb'],
  },
  {
    id: 'bass',
    label: 'BASS MUSIC',
    icon: '🔊',
    color: '#ef4444',
    desc: 'Heavy bass and breakbeat genres',
    presetIds: ['dnb', 'futurebass'],
  },
  {
    id: 'melodic',
    label: 'MELODIC & CHILL',
    icon: '🎹',
    color: '#7fa998',
    desc: 'Melodic, atmospheric, and relaxed styles',
    presetIds: ['ambient', 'lofi', 'synthwave', 'electropop'],
  },
  {
    id: 'world',
    label: 'WORLD & RHYTHM',
    icon: '🌍',
    color: '#fbbf24',
    desc: 'Global rhythms and cultural sounds',
    presetIds: ['afrobeat', 'reggaeton', 'dancehall', 'gospel'],
  },
  {
    id: 'special',
    label: 'CINEMATIC',
    icon: '🎬',
    color: '#ec4899',
    desc: 'Film score and orchestral textures',
    presetIds: ['cinematic', 'birdsofafeather', 'jazz', 'pop'],
  },
  {
    id: 'utility',
    label: 'UTILITY',
    icon: '📝',
    color: '#6b7280',
    desc: 'Blank canvas and starting points',
    presetIds: ['blank'],
  },
]

// ── Detailed preset descriptions ──
const PRESET_INFO: Record<string, { instruments: string[]; mood: string; techniques: string[] }> = {
  acid: { instruments: ['303 Bass', 'Kick', 'Hi-Hats', 'Pad'], mood: 'Aggressive, hypnotic', techniques: ['Acid resonance sweeps', 'Sidechain ducking', 'Filter envelope modulation'] },
  trance: { instruments: ['Supersaw Lead', 'Sub Bass', 'Kick', 'Clap', 'Hi-Hats'], mood: 'Euphoric, uplifting', techniques: ['Trans() pitch shifting', 'Filter sweeps', 'Layered supersaws'] },
  house: { instruments: ['TR-909 Drums', 'Bass Synth', 'E-Piano Chords'], mood: 'Warm, groovy', techniques: ['Four-on-the-floor', 'Sidechain compression', 'Chord stabs'] },
  boombap: { instruments: ['TR-808 Kit', 'Sub Bass', 'E-Piano Keys'], mood: 'Classic, head-nodding', techniques: ['Swing timing', 'Vinyl warmth', 'Sample chops'] },
  ambient: { instruments: ['Pad Synth', 'Music Box', 'Sub Rumble', 'Hi-Hats'], mood: 'Ethereal, drifting', techniques: ['Perlin modulation', 'Long reverb tails', 'Slow LFOs'] },
  dnb: { instruments: ['TR-909 Drums', 'Reese Bass', 'Piano'], mood: 'Energetic, liquid', techniques: ['Fast breakbeats', 'Bass growl filtering', 'Syncopated rhythms'] },
  techno: { instruments: ['Kick', 'Percussion', 'Hi-Hats', 'Analog Bass', 'Pad'], mood: 'Dark, industrial', techniques: ['Generative patterns', 'Perlin modulated params', 'Sidechain pumping'] },
  lofi: { instruments: ['TR-808 Kit', 'Rhodes Keys', 'Vinyl Noise', 'Sub Bass'], mood: 'Cozy, nostalgic', techniques: ['Tape saturation', 'Detuned chords', 'Rain/vinyl textures'] },
  rave: { instruments: ['Stab Synth', 'Breakbeat Drums', 'Amen Break', 'Sub Bass'], mood: 'Raw, energetic', techniques: ['Break chops', 'Stab riffs', 'Classic rave sounds'] },
  birdsofafeather: { instruments: ['Pad Layers', 'Melodic Synth', 'Strings', 'Percussion'], mood: 'Dreamlike, cinematic', techniques: ['Layered pads', 'Melodic counterpoint', 'Atmospheric FX'] },
  gospel: { instruments: ['Organ', 'Choir Pad', 'Piano', 'Hand Claps', 'Bass', 'Tambourine'], mood: 'Soulful, uplifting', techniques: ['Gospel chord progressions', 'Call & response', 'Hammond organ'] },
  synthwave: { instruments: ['Detuned Lead', 'Arpeggiated Synth', 'TR-808 Drums', 'Retro Pad', 'E-Piano'], mood: 'Retro-futuristic, neon', techniques: ['80s synth sounds', 'Arpeggiated patterns', 'Chorus/detuning'] },
  trap: { instruments: ['TR-808 Kit', 'Lead Synth', 'Rolling Hi-Hats', 'Sub 808', 'Snare'], mood: 'Hard-hitting, aggressive', techniques: ['808 slides', 'Hi-hat rolls', 'Heavy sidechain'] },
  jazz: { instruments: ['Electric Piano', 'Upright Bass', 'Brush Kit', 'Vibraphone'], mood: 'Smooth, sophisticated', techniques: ['Extended chords', 'Walking bass', 'Swing feel'] },
  reggaeton: { instruments: ['Dembow Drums', 'Synth Lead', 'Sub Bass', 'Percussion', 'Vocal Chops'], mood: 'Bouncy, tropical', techniques: ['Dembow rhythm', 'Reggaeton pulse', 'Latin percussion'] },
  edm: { instruments: ['Lead Synth', 'Pluck Arps', 'Festival Kick', 'White Noise', 'Supersaw Build'], mood: 'Explosive, festival', techniques: ['Build-ups', 'Extreme sidechain', 'Big room drops'] },
  afrobeat: { instruments: ['Talking Drum', 'Konga', 'Afro Synth', 'Guitar Riff', 'Shaker', 'Bass', 'Keys', 'Lead'], mood: 'Groovy, vibrant', techniques: ['African polyrhythms', '3-2 clave', 'Call & response melodies'] },
  cinematic: { instruments: ['Drone Pad', 'Brass Stabs', 'Timpani', 'String Ensemble', 'Harp', 'Choir'], mood: 'Epic, dramatic', techniques: ['Orchestral layering', 'Tension builds', 'Slow evolutions'] },
  phonk: { instruments: ['Memphis Kit', 'Distorted 808', 'Cowbell', 'Dark Pad', 'Chopped Vocal'], mood: 'Dark, aggressive', techniques: ['Memphis style', 'Heavy distortion', 'Cowbell patterns'] },
  rnb: { instruments: ['Neo-Soul Keys', 'Warm Pad', 'Snappy Drums', 'Sub Bass', 'Vocal Lead'], mood: 'Smooth, sensual', techniques: ['9th/11th chords', 'Warm filters', 'Groove swing'] },
  pop: { instruments: ['Piano', 'Clean Drums', 'Synth Pad', 'Pluck Bass', 'Vocal Sample'], mood: 'Bright, catchy', techniques: ['Pop structure', 'Clean mixing', 'Hook-focused'] },
  darkhouse: { instruments: ['Deep Kick', 'Dark Bass', 'Eerie Pad', 'Metallic Perc', 'Noise Sweeps'], mood: 'Menacing, underground', techniques: ['Dark atmospheres', 'Industrial textures', 'Low-end focus'] },
  garage: { instruments: ['2-Step Kit', 'Warped Bass', 'Vocal Chop', 'Shuffle Hats', 'Organ Stab'], mood: 'Swinging, skippy', techniques: ['2-step shuffle', 'Bass wobbles', 'Chopped vocals'] },
  disco: { instruments: ['Funky Bass', 'Disco Strings', 'Clav', 'Four-on-the-floor', 'Shaker', 'Brass'], mood: 'Funky, danceable', techniques: ['Disco strings', 'Funky basslines', 'Off-beat hi-hats'] },
  proghouse: { instruments: ['Progressive Lead', 'Deep Bass', 'Delayed Pluck', 'Atmospheric Pad', 'Driving Kick'], mood: 'Hypnotic, evolving', techniques: ['Progressive builds', 'Long breakdowns', 'Filtered sweeps'] },
  minimal: { instruments: ['Click Kick', 'Micro Perc', 'Sub Sine', 'Glitch Texture', 'Ping Delay'], mood: 'Sparse, hypnotic', techniques: ['Micro-editing', 'Subtle variations', 'Minimal textures'] },
  electropop: { instruments: ['Bright Synth', 'Pop Drums', 'Bass Synth', 'Arp', 'Pad'], mood: 'Fun, sparkling', techniques: ['Pop-synth fusion', 'Bright timbres', 'Catchy melodies'] },
  futurebass: { instruments: ['Wobbly Chord', 'Supersaws', 'Heavy 808', 'Arp Synth', 'Vocal Chop'], mood: 'Emotional, heavy', techniques: ['Sidechain chords', 'LFO wobbles', 'Future sound design'] },
  dancehall: { instruments: ['Riddim Drums', 'Dancehall Bass', 'Stab Synth', 'Percussion', 'Horn'], mood: 'Energetic, tropical', techniques: ['Dancehall riddim', 'Caribbean rhythm', 'Horn stabs'] },
  melotechno: { instruments: ['Melodic Lead', 'Driving Kick', 'Atmospheric Strings', 'Rolling Hats', 'Sub Bass', 'Break Layers'], mood: 'Emotional, driving', techniques: ['Melodic techno arps', 'Long filter sweeps', 'Atmospheric breaks'] },
  blank: { instruments: ['Kick'], mood: 'Neutral', techniques: ['Start from scratch'] },
}

// ── Visual waveform bar display for preset info ──
function PresetWaveDisplay({ preset, color, isActive }: { preset: GenreTemplate; color: string; isActive: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const W = canvas.width
    const H = canvas.height

    ctx.clearRect(0, 0, W, H)

    // Generate pseudo-waveform from preset BPM and code length
    const seed = preset.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
    const barCount = 48
    const barW = W / barCount

    for (let i = 0; i < barCount; i++) {
      // Deterministic "random" based on preset id
      const hash = Math.sin(seed * 9301 + i * 49297) * 0.5 + 0.5
      const val = isActive ? hash * 0.7 + 0.15 : hash * 0.3 + 0.05
      const barH = val * H * 0.8

      const alpha = isActive ? 0.4 + val * 0.6 : 0.15 + val * 0.2
      ctx.fillStyle = isActive
        ? `${color}${Math.round(alpha * 255).toString(16).padStart(2, '0')}`
        : `rgba(255,255,255,${alpha * 0.3})`

      // Mirror bars (top + bottom)
      const halfH = barH / 2
      ctx.fillRect(i * barW + 0.5, H / 2 - halfH, barW - 1, halfH)
      ctx.fillRect(i * barW + 0.5, H / 2, barW - 1, halfH * 0.6)
    }

    // Center line
    ctx.strokeStyle = isActive ? `${color}30` : 'rgba(255,255,255,0.04)'
    ctx.lineWidth = 0.5
    ctx.beginPath()
    ctx.moveTo(0, H / 2)
    ctx.lineTo(W, H / 2)
    ctx.stroke()
  }, [preset, color, isActive])

  return <canvas ref={canvasRef} width={240} height={48} className="w-full" style={{ height: 48 }} />
}

// ── Machined screw detail ──
function RackScrew({ x, y }: { x: string; y: string }) {
  return (
    <div
      className="absolute"
      style={{
        left: x, top: y, width: 8, height: 8,
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #2a2d35 0%, #1a1c22 50%, #22252d 100%)',
        boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.5), 0 0.5px 0 rgba(255,255,255,0.05)',
      }}
    >
      {/* Hex socket */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div style={{ width: 3, height: 3, borderRadius: '50%', background: '#0a0b0d', boxShadow: 'inset 0 0.5px 1px rgba(255,255,255,0.05)' }} />
      </div>
    </div>
  )
}

interface PresetRackProps {
  activeGenre: string
  onSelect: (id: string) => void
}

export default memo(function PresetRack({ activeGenre, onSelect }: PresetRackProps) {
  const [activeCategory, setActiveCategory] = useState<string>('electronic')
  const [hoveredPreset, setHoveredPreset] = useState<string | null>(null)

  // Get presets for current category
  const currentCategory = useMemo(
    () => PRESET_CATEGORIES.find(c => c.id === activeCategory) || PRESET_CATEGORIES[0],
    [activeCategory]
  )

  const categoryPresets = useMemo(
    () => currentCategory.presetIds
      .map(id => GENRE_TEMPLATES.find(t => t.id === id))
      .filter(Boolean) as GenreTemplate[],
    [currentCategory]
  )

  // Info display — show hovered or active preset
  const displayPreset = useMemo(() => {
    const id = hoveredPreset || activeGenre
    return GENRE_TEMPLATES.find(t => t.id === id) || null
  }, [hoveredPreset, activeGenre])

  const displayInfo = displayPreset ? PRESET_INFO[displayPreset.id] : null

  const handleSelect = useCallback((id: string) => {
    onSelect(id)
  }, [onSelect])

  return (
    <div className="flex h-full w-full overflow-hidden relative" style={{ background: '#0c0d10' }}>
      {/* ── Rack screws ── */}
      <RackScrew x="4px" y="4px" />
      <RackScrew x="calc(100% - 12px)" y="4px" />
      <RackScrew x="4px" y="calc(100% - 12px)" />
      <RackScrew x="calc(100% - 12px)" y="calc(100% - 12px)" />

      {/* ══ LEFT: Category selector strip (vertical) ══ */}
      <div
        className="shrink-0 flex flex-col py-3 px-1 overflow-y-auto"
        style={{
          width: 52,
          background: 'linear-gradient(180deg, #111318 0%, #0e1014 50%, #111318 100%)',
          borderRight: '1px solid rgba(255,255,255,0.04)',
          boxShadow: 'inset -1px 0 3px rgba(0,0,0,0.3)',
        }}
      >
        {PRESET_CATEGORIES.map(cat => {
          const isActive = cat.id === activeCategory
          const hasSelected = cat.presetIds.includes(activeGenre)
          return (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className="flex flex-col items-center gap-0.5 py-2 px-1 rounded-md cursor-pointer transition-all duration-150 relative"
              style={{
                background: isActive
                  ? `linear-gradient(180deg, ${cat.color}12 0%, ${cat.color}06 100%)`
                  : 'transparent',
                border: isActive ? `1px solid ${cat.color}25` : '1px solid transparent',
                boxShadow: isActive
                  ? `inset 0 1px 0 rgba(255,255,255,0.04), 0 0 8px ${cat.color}10`
                  : 'none',
              }}
              title={cat.label}
            >
              <span className="text-sm">{cat.icon}</span>
              <span className="text-[5px] font-black tracking-[.1em] uppercase text-center leading-tight"
                style={{ color: isActive ? cat.color : '#4a4e56' }}>
                {cat.label.split(' ')[0]}
              </span>
              {/* Active preset indicator dot */}
              {hasSelected && (
                <div className="absolute top-1 right-1 w-1 h-1 rounded-full"
                  style={{ background: cat.color, boxShadow: `0 0 3px ${cat.color}80` }} />
              )}
            </button>
          )
        })}
      </div>

      {/* ══ CENTER: Preset list (vertical scrollable) ══ */}
      <div
        className="flex-1 flex flex-col overflow-hidden"
        style={{ minWidth: 0 }}
      >
        {/* Category header — machined strip */}
        <div
          className="shrink-0 flex items-center gap-2 px-3 py-1.5"
          style={{
            background: 'linear-gradient(180deg, #16181e 0%, #111318 100%)',
            borderBottom: `1px solid ${currentCategory.color}15`,
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)',
          }}
        >
          <span className="text-sm">{currentCategory.icon}</span>
          <span className="text-[8px] font-black tracking-[.15em] uppercase" style={{ color: currentCategory.color }}>
            {currentCategory.label}
          </span>
          <div className="flex-1 h-px" style={{ background: `linear-gradient(90deg, ${currentCategory.color}15 0%, transparent 100%)` }} />
          <span className="text-[7px] font-bold" style={{ color: '#3a3d44' }}>
            {categoryPresets.length} PRESETS
          </span>
        </div>

        {/* Preset list */}
        <div className="flex-1 overflow-y-auto py-1 px-1.5" style={{ scrollbarWidth: 'thin', scrollbarColor: '#2a2d35 transparent' }}>
          {categoryPresets.map(preset => {
            const isActive = preset.id === activeGenre
            const isHovered = preset.id === hoveredPreset
            const info = PRESET_INFO[preset.id]

            return (
              <button
                key={preset.id}
                onClick={() => handleSelect(preset.id)}
                onMouseEnter={() => setHoveredPreset(preset.id)}
                onMouseLeave={() => setHoveredPreset(null)}
                className="w-full text-left mb-0.5 rounded-md cursor-pointer transition-all duration-150 group relative overflow-hidden"
                style={{
                  background: isActive
                    ? `linear-gradient(135deg, ${currentCategory.color}12 0%, ${currentCategory.color}06 100%)`
                    : isHovered
                      ? 'rgba(255,255,255,0.02)'
                      : 'transparent',
                  border: isActive
                    ? `1px solid ${currentCategory.color}30`
                    : '1px solid transparent',
                  padding: '6px 8px',
                }}
              >
                {/* Preset row */}
                <div className="flex items-center gap-2">
                  {/* LED indicator */}
                  <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{
                    background: isActive ? currentCategory.color : '#2a2d35',
                    boxShadow: isActive ? `0 0 6px ${currentCategory.color}60` : 'none',
                  }} />

                  {/* Icon + name */}
                  <span className="text-xs">{preset.icon}</span>
                  <div className="flex-1 min-w-0">
                    <span className="text-[8px] font-black tracking-[.1em] uppercase block truncate"
                      style={{ color: isActive ? currentCategory.color : isHovered ? '#c0c4cc' : '#6b7280' }}>
                      {preset.label}
                    </span>
                    <span className="text-[6px] font-semibold block truncate"
                      style={{ color: '#4a4e56' }}>
                      {preset.desc}
                    </span>
                  </div>

                  {/* BPM badge */}
                  <div className="shrink-0 px-1.5 py-0.5 rounded"
                    style={{
                      background: isActive ? `${currentCategory.color}10` : 'rgba(255,255,255,0.02)',
                      border: `1px solid ${isActive ? currentCategory.color + '20' : 'rgba(255,255,255,0.04)'}`,
                    }}>
                    <span className="text-[7px] font-black font-mono"
                      style={{ color: isActive ? currentCategory.color : '#4a4e56' }}>
                      {preset.bpm}
                    </span>
                  </div>
                </div>

                {/* Mini waveform bar under active/hovered preset */}
                {(isActive || isHovered) && info && (
                  <div className="mt-1 flex items-center gap-1 overflow-hidden">
                    {info.instruments.slice(0, 5).map((inst, i) => (
                      <span key={i} className="text-[5px] font-bold px-1 py-0.5 rounded shrink-0"
                        style={{
                          background: isActive ? `${currentCategory.color}10` : 'rgba(255,255,255,0.02)',
                          color: isActive ? `${currentCategory.color}90` : '#5a616b',
                          border: `0.5px solid ${isActive ? currentCategory.color + '15' : 'rgba(255,255,255,0.04)'}`,
                        }}>
                        {inst}
                      </span>
                    ))}
                  </div>
                )}

                {/* Active glow edge */}
                {isActive && (
                  <div className="absolute left-0 top-0 bottom-0 w-0.5"
                    style={{ background: currentCategory.color, boxShadow: `0 0 6px ${currentCategory.color}40` }} />
                )}
              </button>
            )
          })}
        </div>

        {/* ── INFO DISPLAY — Shows details for selected/hovered preset ── */}
        {displayPreset && displayInfo && (
          <div
            className="shrink-0 relative overflow-hidden"
            style={{
              background: 'linear-gradient(180deg, #111318 0%, #0c0d10 100%)',
              borderTop: '1px solid rgba(255,255,255,0.04)',
              boxShadow: 'inset 0 1px 4px rgba(0,0,0,0.3)',
            }}
          >
            {/* Waveform display */}
            <PresetWaveDisplay
              preset={displayPreset}
              color={currentCategory.color}
              isActive={displayPreset.id === activeGenre}
            />

            {/* Info overlay */}
            <div className="absolute inset-0 flex flex-col justify-end px-3 pb-1.5 pointer-events-none">
              {/* Preset name */}
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[9px] font-black tracking-[.12em] uppercase"
                  style={{ color: currentCategory.color, textShadow: `0 0 8px ${currentCategory.color}30` }}>
                  {displayPreset.icon} {displayPreset.label}
                </span>
                <span className="text-[7px] font-mono font-bold" style={{ color: '#4a4e56' }}>
                  {displayPreset.bpm} BPM
                </span>
              </div>

              {/* Mood */}
              <span className="text-[6px] font-semibold" style={{ color: '#6b7280' }}>
                {displayInfo.mood}
              </span>

              {/* Techniques */}
              <div className="flex flex-wrap gap-0.5 mt-0.5">
                {displayInfo.techniques.map((t, i) => (
                  <span key={i} className="text-[5px] font-bold px-1 py-0.5 rounded"
                    style={{
                      background: `${currentCategory.color}08`,
                      color: `${currentCategory.color}70`,
                      border: `0.5px solid ${currentCategory.color}12`,
                    }}>
                    {t}
                  </span>
                ))}
              </div>
            </div>

            {/* Scan line effect */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.03) 2px, rgba(0,0,0,0.03) 4px)',
              }}
            />
          </div>
        )}
      </div>

      {/* ── Brushed metal texture overlay ── */}
      <div
        className="absolute inset-0 pointer-events-none z-10"
        style={{
          background: 'repeating-linear-gradient(90deg, transparent, transparent 1px, rgba(255,255,255,0.003) 1px, rgba(255,255,255,0.003) 2px)',
          mixBlendMode: 'overlay',
        }}
      />
    </div>
  )
})
