'use client'

// ═══════════════════════════════════════════════════════════════
//  TRACK VIEW — Vertical stacked DAW-style track lanes
//  with per-track waveform visualizers and synced playhead
//
//  Each channel is a horizontal track strip showing:
//    - Left panel: channel controls (S/M, gain, editor buttons)
//    - Right scope: full-width live waveform visualization
//    - Synced playhead sweeping across all tracks
// ═══════════════════════════════════════════════════════════════

import { useRef, useEffect, useCallback, memo } from 'react'
import { ChevronDown, ChevronRight, Plus, Piano, Grid3X3 } from 'lucide-react'
import StudioKnob from './StudioKnob'
import ChannelLCD from './ChannelLCD'
import { getOrbitAnalyser } from '@/lib/studio-analysers'
import type { ParsedChannel } from '@/lib/strudel-code-parser'

// ─── Mini peak meter (vertical bar beside channel name) ───
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
      // Idle — dim bar
      ctx.fillStyle = 'rgba(255,255,255,0.03)'
      ctx.fillRect(0, 0, w, h)
      peakRef.current = 0
      return
    }

    // Get orbit analyser
    const orbitParam = channel.params.find(p => p.key === 'orbit')
    const orbit = orbitParam && !orbitParam.isComplex ? parseFloat(String(orbitParam.value)) : 1
    const analyser = getOrbitAnalyser(isNaN(orbit) ? 1 : orbit)

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

    // Background
    ctx.fillStyle = 'rgba(255,255,255,0.02)'
    ctx.fillRect(0, 0, w, h)

    // Level fill (bottom to top)
    const gradient = ctx.createLinearGradient(0, h, 0, 0)
    gradient.addColorStop(0, `${channel.color}80`)
    gradient.addColorStop(0.7, `${channel.color}60`)
    gradient.addColorStop(1, '#b86f6f80')
    ctx.fillStyle = gradient
    ctx.fillRect(0, h - barH, w, barH)

    // Peak line
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
    <canvas
      ref={canvasRef}
      width={4}
      height={60}
      className="rounded-sm"
      style={{ width: 3, height: '100%', minHeight: 20 }}
    />
  )
}

// ─── Mini pattern dot preview for collapsed tracks ───
function PatternDots({ channel, color }: { channel: ParsedChannel; color: string }) {
  // Show a simple visual of the pattern rhythm as dots
  const pattern = channel.rawCode
  const hasNotes = /note\(|\.n\(|\.s\(/.test(pattern)
  const dotCount = hasNotes ? 8 : 4

  return (
    <div className="flex items-center gap-[2px] px-1">
      {Array.from({ length: dotCount }).map((_, i) => (
        <div
          key={i}
          className="rounded-full"
          style={{
            width: 3,
            height: 3,
            background: i % 2 === 0 ? `${color}60` : `${color}20`,
          }}
        />
      ))}
    </div>
  )
}

// ─── Playhead overlay — synced vertical line across all tracks ───
function PlayheadOverlay({ getCyclePosition, isPlaying, trackCount }: {
  getCyclePosition?: () => number | null
  isPlaying: boolean
  trackCount: number
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

    // Fractional part = position within current cycle (0..1)
    const frac = pos - Math.floor(pos)
    const pct = frac * 100

    lineRef.current.style.left = `${pct}%`
    lineRef.current.style.opacity = '1'
    rafRef.current = requestAnimationFrame(animate)
  }, [isPlaying, getCyclePosition])

  useEffect(() => {
    rafRef.current = requestAnimationFrame(animate)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [animate])

  if (trackCount === 0) return null

  return (
    <div
      ref={lineRef}
      className="absolute top-0 bottom-0 z-20 pointer-events-none transition-opacity duration-100"
      style={{
        width: 2,
        opacity: 0,
        background: 'linear-gradient(180deg, #7fa998 0%, #7fa99880 50%, #7fa998 100%)',
        boxShadow: '0 0 8px #7fa99860, 0 0 16px #7fa99830',
        filter: 'blur(0.3px)',
      }}
    >
      {/* Playhead top triangle */}
      <div
        className="absolute -top-1 -translate-x-1/2 left-1/2"
        style={{
          width: 0,
          height: 0,
          borderLeft: '4px solid transparent',
          borderRight: '4px solid transparent',
          borderTop: '5px solid #7fa998',
          filter: 'drop-shadow(0 0 3px #7fa99880)',
        }}
      />
      {/* Glow trail */}
      <div
        className="absolute top-0 bottom-0 -left-1"
        style={{
          width: 4,
          background: 'linear-gradient(180deg, #7fa99815 0%, #7fa99808 50%, #7fa99815 100%)',
        }}
      />
    </div>
  )
}

// ─── Beat grid lines (4 beats per cycle) ───
function BeatGrid() {
  return (
    <div className="absolute inset-0 pointer-events-none z-[1]">
      {[0.25, 0.5, 0.75].map((pct) => (
        <div
          key={pct}
          className="absolute top-0 bottom-0"
          style={{
            left: `${pct * 100}%`,
            width: 1,
            background: pct === 0.5
              ? 'rgba(255,255,255,0.06)'
              : 'rgba(255,255,255,0.025)',
          }}
        />
      ))}
    </div>
  )
}

// ─── Main TrackView component ───

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
  onToggleChannel,
  onParamChange,
  onOpenPianoRoll,
  onOpenDrumSequencer,
  onOpenPadSampler,
  onDragOver,
  onDragLeave,
  onDrop,
  onShowAddMenu,
  getSourceIcon,
}: TrackViewProps) {
  return (
    <div className="flex flex-col relative">
      {/* ── Beat ruler at top ── */}
      <div
        className="h-5 flex items-end relative shrink-0"
        style={{
          background: '#0d0e11',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          marginLeft: 160,
        }}
      >
        {[1, 2, 3, 4].map((beat) => (
          <div
            key={beat}
            className="flex-1 text-center"
            style={{
              borderLeft: beat > 1 ? '1px solid rgba(255,255,255,0.04)' : undefined,
            }}
          >
            <span className="text-[7px] font-mono font-bold" style={{ color: '#5a616b60' }}>{beat}</span>
          </div>
        ))}
      </div>

      {/* ── Tracks container with playhead ── */}
      <div className="relative">
        {/* Playhead — spans all tracks */}
        <div className="absolute top-0 bottom-0 right-0 z-20 pointer-events-none" style={{ left: 160 }}>
          <PlayheadOverlay
            getCyclePosition={getCyclePosition}
            isPlaying={isPlaying}
            trackCount={channels.length}
          />
        </div>

        {/* Track lanes */}
        {channels.map((ch, idx) => {
          const isMuted = mutedChannels.has(idx)
          const isSoloed = soloedChannels.has(idx)
          const isActive = isPlaying && !isMuted
          const collapsed = trackCollapsed.has(idx)
          const gainParam = ch.params.find(p => p.key === 'gain')

          // Determine primary editor
          const isVocal = ch.sourceType === 'sample' && ch.effects.includes('loopAt')
          const isMelodic = ch.sourceType === 'synth' || ch.sourceType === 'note'
          const isDrum = (ch.sourceType === 'sample' && !ch.effects.includes('loopAt')) || ch.sourceType === 'stack'
          const primaryEditor = isVocal ? 'sampler' : isMelodic ? 'piano' : isDrum ? 'drum' : 'piano'

          return (
            <div
              key={ch.id}
              className={`flex transition-all duration-200 ${isMuted ? 'opacity-35' : ''}`}
              style={{
                background: '#111318',
                borderBottom: '1px solid rgba(255,255,255,0.04)',
                minHeight: collapsed ? 32 : 80,
              }}
            >
              {/* ── LEFT PANEL: channel info & controls ── */}
              <div
                className="shrink-0 flex flex-col border-r relative overflow-hidden"
                style={{
                  width: 160,
                  borderColor: `${ch.color}18`,
                  background: '#0d0e11',
                }}
              >
                {/* Color accent bar — top edge */}
                <div
                  className="absolute top-0 left-0 right-0"
                  style={{
                    height: 2,
                    background: `linear-gradient(90deg, ${ch.color} 0%, ${ch.color}40 100%)`,
                    opacity: isMuted ? 0.15 : isActive ? 1 : 0.5,
                    boxShadow: isActive ? `0 0 8px ${ch.color}50` : 'none',
                    transition: 'opacity 200ms, box-shadow 200ms',
                  }}
                />

                {/* Top row: controls */}
                <div className="flex items-center gap-1 px-2 pt-2 pb-0.5">
                  {/* Collapse */}
                  <button
                    onClick={() => onToggleCollapse(idx)}
                    className="cursor-pointer transition-colors hover:text-white/60"
                    style={{ color: '#5a616b', background: 'none', border: 'none', padding: 0 }}
                    title={collapsed ? 'Expand track' : 'Collapse track'}
                  >
                    {collapsed ? <ChevronRight size={10} /> : <ChevronDown size={10} />}
                  </button>

                  {/* Solo */}
                  <button
                    onClick={() => onSolo(idx)}
                    className="cursor-pointer transition-all duration-100 active:scale-90"
                    style={{
                      width: 16, height: 16, borderRadius: 4,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '7px', fontWeight: 900, lineHeight: 1,
                      color: isSoloed ? '#b8a47f' : '#5a616b',
                      background: isSoloed ? '#1a1a16' : '#0a0b0d',
                      border: 'none',
                      boxShadow: isSoloed
                        ? `inset 2px 2px 4px #050607, inset -2px -2px 4px #1a1d22, 0 0 4px #b8a47f30`
                        : '2px 2px 4px #050607, -2px -2px 4px #1a1d22',
                    }}
                    title="Solo"
                  >S</button>

                  {/* Mute */}
                  <button
                    onClick={() => onMute(idx)}
                    className="cursor-pointer transition-all duration-100 active:scale-90"
                    style={{
                      width: 16, height: 16, borderRadius: 4,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '7px', fontWeight: 900, lineHeight: 1,
                      color: isMuted ? '#b86f6f' : '#5a616b',
                      background: isMuted ? '#1a1114' : '#0a0b0d',
                      border: 'none',
                      boxShadow: isMuted
                        ? `inset 2px 2px 4px #050607, inset -2px -2px 4px #1a1d22, 0 0 4px #b86f6f30`
                        : '2px 2px 4px #050607, -2px -2px 4px #1a1d22',
                    }}
                    title="Mute"
                  >M</button>

                  {/* Peak meter */}
                  <PeakMeter channel={ch} isPlaying={isPlaying} isMuted={isMuted} />

                  {/* Channel name */}
                  <span
                    className="flex-1 min-w-0 truncate text-[8px] font-extrabold uppercase tracking-[.12em] font-mono cursor-pointer hover:opacity-80"
                    onClick={() => onToggleChannel(ch.id)}
                    style={{ color: ch.color }}
                    title={ch.name}
                  >
                    <span className="text-[9px] mr-0.5 opacity-60">{getSourceIcon(ch.source, ch.sourceType)}</span>
                    {ch.name}
                  </span>
                </div>

                {/* Bottom row: gain knob + editor buttons — only when expanded */}
                {!collapsed && (
                  <div className="flex items-center gap-1 px-2 pb-1.5 pt-0.5">
                    <div onClick={(e) => e.stopPropagation()} className="shrink-0">
                      <StudioKnob
                        label=""
                        value={gainParam?.value ?? 0.8}
                        min={0} max={2} step={0.01} size={22}
                        color={ch.color}
                        isComplex={gainParam?.isComplex}
                        onChange={(v) => onParamChange(idx, 'gain', v)}
                      />
                    </div>

                    {/* Editor buttons */}
                    {primaryEditor === 'piano' && onOpenPianoRoll && (
                      <button
                        onClick={() => onOpenPianoRoll(idx)}
                        className="flex items-center gap-0.5 px-1.5 py-1 rounded cursor-pointer transition-all hover:opacity-100 active:scale-95"
                        style={{
                          color: '#6f8fb3', opacity: 0.8,
                          background: 'rgba(111,143,179,0.08)',
                          border: '1px solid rgba(111,143,179,0.12)',
                          fontSize: 0,
                        }}
                        title="Piano Roll"
                      >
                        <Piano size={10} />
                        <span className="text-[6px] font-bold leading-none">NOTES</span>
                      </button>
                    )}
                    {primaryEditor === 'drum' && onOpenDrumSequencer && (
                      <button
                        onClick={() => onOpenDrumSequencer(idx)}
                        className="flex items-center gap-0.5 px-1.5 py-1 rounded cursor-pointer transition-all hover:opacity-100 active:scale-95"
                        style={{
                          color: '#b8a47f', opacity: 0.8,
                          background: 'rgba(184,164,127,0.08)',
                          border: '1px solid rgba(184,164,127,0.12)',
                          fontSize: 0,
                        }}
                        title="Drum Sequencer"
                      >
                        <Grid3X3 size={10} />
                        <span className="text-[6px] font-bold leading-none">STEPS</span>
                      </button>
                    )}
                    {primaryEditor === 'sampler' && onOpenPadSampler && (
                      <button
                        onClick={() => onOpenPadSampler(idx)}
                        className="flex items-center gap-0.5 px-1.5 py-1 rounded cursor-pointer transition-all hover:opacity-100 active:scale-95"
                        style={{
                          color: '#22d3ee', opacity: 0.8,
                          background: 'rgba(34,211,238,0.08)',
                          border: '1px solid rgba(34,211,238,0.12)',
                          fontSize: 0,
                        }}
                        title="Pad Sampler"
                      >
                        <span className="text-[9px]">🎹</span>
                        <span className="text-[6px] font-bold leading-none">PAD</span>
                      </button>
                    )}

                    {/* Effect count badge */}
                    {ch.effects.filter(fx => !['scope', 'pianoroll', 'orbit', 'gain'].includes(fx)).length > 0 && (
                      <span
                        className="text-[6px] font-bold font-mono px-1 py-0.5 rounded-full"
                        style={{
                          color: `${ch.color}80`,
                          background: `${ch.color}10`,
                          border: `1px solid ${ch.color}15`,
                        }}
                      >
                        {ch.effects.filter(fx => !['scope', 'pianoroll', 'orbit', 'gain'].includes(fx)).length} FX
                      </span>
                    )}
                  </div>
                )}

                {/* Collapsed: show pattern dots */}
                {collapsed && (
                  <PatternDots channel={ch} color={ch.color} />
                )}
              </div>

              {/* ── RIGHT SCOPE: full-width waveform visualizer + beat grid ── */}
              <div
                className="flex-1 min-w-0 relative overflow-hidden"
                style={{
                  background: '#0a0b0d',
                  borderLeft: isActive
                    ? `1px solid ${ch.color}35`
                    : '1px solid rgba(255,255,255,0.02)',
                }}
                onDragOver={(e) => { e.preventDefault(); onDragOver(idx) }}
                onDragLeave={onDragLeave}
                onDrop={(e) => onDrop(idx, e)}
                onClick={() => onToggleChannel(ch.id)}
              >
                {/* Beat grid lines */}
                <BeatGrid />

                {/* Waveform scope — fills full track height */}
                <div className="absolute inset-0 z-[2]">
                  <ChannelLCD
                    channel={ch}
                    isPlaying={isPlaying}
                    isMuted={isMuted}
                    height="100%"
                    canvasWidth={1200}
                    canvasHeight={collapsed ? 28 : 72}
                  />
                </div>

                {/* Active glow effect when playing */}
                {isActive && (
                  <div
                    className="absolute inset-0 pointer-events-none z-[3]"
                    style={{
                      background: `linear-gradient(90deg, ${ch.color}06 0%, transparent 15%, transparent 85%, ${ch.color}04 100%)`,
                      borderTop: `1px solid ${ch.color}08`,
                      borderBottom: `1px solid ${ch.color}08`,
                    }}
                  />
                )}

                {/* Channel type indicator (subtle, in scope corner) */}
                <div
                  className="absolute top-1 right-2 z-[5] text-[6px] font-bold uppercase tracking-widest font-mono"
                  style={{ color: `${ch.color}30` }}
                >
                  {ch.sourceType === 'synth' ? 'SYNTH' :
                   ch.sourceType === 'note' ? 'INST' :
                   ch.sourceType === 'stack' ? 'DRUM' :
                   ch.sourceType === 'sample' ? (ch.effects.includes('loopAt') ? 'VOCAL' : 'SAMPLE') : 'CH'}
                </div>

                {/* Drop FX indicator */}
                {dragOverChannel === idx && (
                  <div
                    className="absolute inset-0 flex items-center justify-center z-10"
                    style={{
                      background: 'rgba(127,169,152,0.1)',
                      border: '2px solid rgba(127,169,152,0.4)',
                      borderRadius: 4,
                    }}
                  >
                    <span className="text-[10px] font-bold" style={{ color: '#7fa998' }}>⬇ DROP FX</span>
                  </div>
                )}
              </div>
            </div>
          )
        })}

        {/* Add Channel */}
        <button
          onClick={onShowAddMenu}
          className="flex items-center justify-center gap-2 py-3 w-full cursor-pointer transition-all duration-200 hover:bg-white/[0.02] group"
          style={{
            background: '#0d0e11',
            borderBottom: '1px solid rgba(255,255,255,0.03)',
            color: '#5a616b',
            border: 'none',
          }}
        >
          <div
            className="w-5 h-5 rounded-full flex items-center justify-center transition-all group-hover:scale-110"
            style={{
              background: '#111318',
              boxShadow: '2px 2px 4px #050607, -2px -2px 4px #1a1d22',
            }}
          >
            <Plus size={11} style={{ color: '#7fa998' }} />
          </div>
          <span className="text-[9px] font-bold tracking-wide group-hover:text-white/50 transition-colors">Add Track</span>
        </button>
      </div>
    </div>
  )
})

export default TrackView
