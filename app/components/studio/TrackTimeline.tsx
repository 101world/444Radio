'use client'

// ═══════════════════════════════════════════════════════════════
//  TRACK TIMELINE — Per-channel arrangement lane
//
//  Replaces the oscilloscope scope view when user selects
//  "LANE" scope type. Shows arrangement sections as colored
//  blocks, active/inactive channel state, automation curves
//  overlaid, and a playhead synced to arrangement position.
//
//  Looks like an Ableton/Logic arranger lane per track.
// ═══════════════════════════════════════════════════════════════

import { memo, useRef, useEffect, useCallback } from 'react'
import type { ArrangementSection } from './ArrangementTimeline'
import { getParamDef } from '@/lib/strudel-code-parser'

// ─── Props ───
interface TrackTimelineProps {
  channelIdx: number
  channelColor: string
  sections: ArrangementSection[]
  automationData?: Map<string, number>
  autoParam?: string
  isPlaying: boolean
  isMuted: boolean
  getCyclePosition?: () => number | null
  collapsed: boolean
}

// ─── Component ───
const TrackTimeline = memo(function TrackTimeline({
  channelIdx,
  channelColor,
  sections,
  automationData,
  autoParam = 'gain',
  isPlaying,
  isMuted,
  getCyclePosition,
  collapsed,
}: TrackTimelineProps) {
  const playheadRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number>(0)

  const totalBars = sections.reduce((sum, s) => sum + s.bars, 0)

  // ── Animate playhead based on arrangement position ──
  useEffect(() => {
    if (totalBars === 0) return

    const animate = () => {
      if (!isPlaying || !getCyclePosition || !playheadRef.current) {
        if (playheadRef.current) playheadRef.current.style.opacity = '0'
        rafRef.current = requestAnimationFrame(animate)
        return
      }
      const pos = getCyclePosition()
      if (pos === null) {
        playheadRef.current.style.opacity = '0'
        rafRef.current = requestAnimationFrame(animate)
        return
      }
      // Map cycle position to arrangement timeline
      // Each bar = 1 cycle, arrangement loops after totalBars
      const arrangementPos = ((pos % totalBars) + totalBars) % totalBars
      const frac = arrangementPos / totalBars
      playheadRef.current.style.left = `${frac * 100}%`
      playheadRef.current.style.opacity = '1'
      rafRef.current = requestAnimationFrame(animate)
    }
    rafRef.current = requestAnimationFrame(animate)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [isPlaying, getCyclePosition, totalBars])

  // ── Empty state ──
  if (totalBars === 0) {
    return (
      <div className="absolute inset-0 flex items-center justify-center" style={{ background: '#0a0b0d' }}>
        <span className="text-[8px] font-mono uppercase tracking-widest" style={{ color: '#3a3f4a' }}>
          no arrangement
        </span>
      </div>
    )
  }

  // ── Param range for automation overlay ──
  const pdef = getParamDef(autoParam)
  const pMin = pdef?.min ?? 0
  const pMax = pdef?.max ?? 1
  const normalize = (v: number) => Math.max(0, Math.min(1, (v - pMin) / ((pMax - pMin) || 1)))

  // ── Determine current section from automation data for default value ──
  const getAutoValue = (sectionId: string): number | undefined => {
    if (!automationData) return undefined
    const key = `${sectionId}:${channelIdx}:${autoParam}`
    return automationData.has(key) ? automationData.get(key)! : undefined
  }

  // Check if any section has automation for this param+channel
  const hasAnyAuto = automationData
    ? sections.some(s => automationData.has(`${s.id}:${channelIdx}:${autoParam}`))
    : false

  // ── Build section blocks ──
  let barAcc = 0
  const sectionBlocks = sections.map((section, i) => {
    const isActive = section.activeChannels.has(channelIdx)
    const xStartPct = (barAcc / totalBars) * 100
    const widthPct = (section.bars / totalBars) * 100
    const autoVal = getAutoValue(section.id)
    barAcc += section.bars

    return (
      <div
        key={section.id}
        className="absolute top-0 bottom-0 overflow-hidden"
        style={{
          left: `${xStartPct}%`,
          width: `${widthPct}%`,
          // Active sections get a colored background, inactive are dim
          background: isActive
            ? `linear-gradient(180deg, ${channelColor}14 0%, ${channelColor}08 100%)`
            : 'rgba(255,255,255,0.015)',
          borderRight: i < sections.length - 1
            ? `1px solid ${isActive ? `${channelColor}20` : 'rgba(255,255,255,0.06)'}`
            : undefined,
        }}
      >
        {/* Active fill pattern — subtle diagonal stripes */}
        {isActive && !collapsed && (
          <div className="absolute inset-0 pointer-events-none opacity-[0.03]" style={{
            backgroundImage: `repeating-linear-gradient(
              -45deg,
              ${channelColor},
              ${channelColor} 1px,
              transparent 1px,
              transparent 6px
            )`,
          }} />
        )}

        {/* Section name label */}
        {!collapsed && (
          <div
            className="absolute top-0.5 left-1 right-0.5 text-[7px] font-black uppercase tracking-wider truncate pointer-events-none select-none"
            style={{
              color: isActive ? channelColor : '#3a3f4a',
              opacity: isActive ? 0.65 : 0.3,
              lineHeight: '12px',
            }}
          >
            {section.name}
          </div>
        )}

        {/* Collapsed section name — centered */}
        {collapsed && (
          <div
            className="absolute inset-0 flex items-center justify-center text-[5px] font-bold uppercase tracking-wider truncate pointer-events-none select-none"
            style={{ color: isActive ? `${channelColor}80` : '#2a2f3a' }}
          >
            {section.name.slice(0, 3)}
          </div>
        )}

        {/* Active indicator — top accent bar */}
        {isActive && (
          <div className="absolute top-0 left-0 right-0" style={{
            height: collapsed ? 1 : 2,
            background: `linear-gradient(90deg, ${channelColor}80, ${channelColor}40)`,
            boxShadow: `0 0 4px ${channelColor}20`,
          }} />
        )}

        {/* Active indicator — bottom glow */}
        {isActive && !collapsed && (
          <div className="absolute bottom-0 left-0 right-0" style={{
            height: 1,
            background: `${channelColor}25`,
          }} />
        )}

        {/* Bar sub-grid (within each section) */}
        {!collapsed && section.bars > 1 && Array.from({ length: section.bars - 1 }, (_, b) => (
          <div
            key={b}
            className="absolute top-0 bottom-0 pointer-events-none"
            style={{
              left: `${((b + 1) / section.bars) * 100}%`,
              width: 1,
              background: isActive ? `${channelColor}08` : 'rgba(255,255,255,0.02)',
            }}
          />
        ))}

        {/* Inactive X pattern */}
        {!isActive && !collapsed && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-[10px] font-black" style={{ color: 'rgba(255,255,255,0.04)' }}>—</span>
          </div>
        )}
      </div>
    )
  })

  // ── Automation curve overlay (SVG step interpolation) ──
  const automationOverlay = hasAnyAuto ? (() => {
    // Build step path — horizontal line at each section's value
    let barAcc2 = 0
    const pathParts: string[] = []

    for (let i = 0; i < sections.length; i++) {
      const sec = sections[i]
      const key = `${sec.id}:${channelIdx}:${autoParam}`
      const hasAuto = automationData!.has(key)

      if (hasAuto) {
        const value = automationData!.get(key)!
        const y = (1 - normalize(value)) * 100
        const xStart = (barAcc2 / totalBars) * 100
        const xEnd = ((barAcc2 + sec.bars) / totalBars) * 100
        pathParts.push(`M${xStart},${y} L${xEnd},${y}`)
      }
      barAcc2 += sec.bars
    }

    if (pathParts.length === 0) return null

    // Also draw dots at stepped transitions
    barAcc2 = 0
    const dots: { x: number; y: number }[] = []
    for (let i = 0; i < sections.length; i++) {
      const sec = sections[i]
      const key = `${sec.id}:${channelIdx}:${autoParam}`
      if (automationData!.has(key)) {
        const value = automationData!.get(key)!
        const y = (1 - normalize(value)) * 100
        const xMid = ((barAcc2 + sec.bars / 2) / totalBars) * 100
        dots.push({ x: xMid, y })
      }
      barAcc2 += sec.bars
    }

    return (
      <svg
        className="absolute inset-0 pointer-events-none z-[3]"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{ overflow: 'visible' }}
      >
        {/* Step hold lines */}
        <path
          d={pathParts.join(' ')}
          fill="none"
          stroke={channelColor}
          strokeWidth={0.4}
          strokeOpacity={0.6}
        />
        {/* Breakpoint dots */}
        {dots.map((dot, i) => (
          <circle
            key={i}
            cx={dot.x}
            cy={dot.y}
            r={0.6}
            fill={channelColor}
            fillOpacity={0.8}
          />
        ))}
      </svg>
    )
  })() : null

  return (
    <div className="absolute inset-0" style={{ background: '#0a0b0d' }}>
      {/* Section blocks */}
      {sectionBlocks}

      {/* Automation overlay */}
      {automationOverlay}

      {/* Playhead */}
      <div
        ref={playheadRef}
        className="absolute top-0 bottom-0 z-[5] pointer-events-none"
        style={{
          width: 1.5,
          opacity: 0,
          background: `${channelColor}`,
          boxShadow: `0 0 6px ${channelColor}50, 0 0 2px ${channelColor}30`,
        }}
      >
        {/* Playhead head marker */}
        <div className="absolute -top-0 -translate-x-1/2 left-1/2" style={{
          width: 0, height: 0,
          borderLeft: '3px solid transparent',
          borderRight: '3px solid transparent',
          borderTop: `4px solid ${channelColor}`,
        }} />
      </div>

      {/* Muted overlay */}
      {isMuted && (
        <div className="absolute inset-0 z-[6] pointer-events-none"
          style={{ background: 'rgba(0,0,0,0.5)' }}
        />
      )}
    </div>
  )
})

export default TrackTimeline
