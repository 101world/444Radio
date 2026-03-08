'use client'

// ═══════════════════════════════════════════════════════════════
//  AUTOMATION LANE — Per-bar keyframe automation curves
//
//  Renders per-channel automation as smooth Catmull-Rom splines
//  with individual keyframes at any bar position. Includes a
//  live playhead, section labels, draggable breakpoints, ghost
//  preview dot, and a real-time value readout.
//
//  Key format: sectionId@barOffset:channelIdx:paramKey
//  (legacy sectionId:channelIdx:paramKey treated as bar 0)
// ═══════════════════════════════════════════════════════════════

import { memo, useCallback, useRef, useState, useEffect } from 'react'
import { Trash2 } from 'lucide-react'
import type { ArrangementSection } from './ArrangementTimeline'

// ─── Types ───
interface AutomationLaneProps {
  channelIdx: number
  channelColor: string
  paramKey: string
  paramLabel: string
  paramMin: number
  paramMax: number
  currentValue: number
  sections: ArrangementSection[]
  automationData: Map<string, number>
  isRecording: boolean
  isPlaying?: boolean
  getCyclePosition?: () => number | null
  height?: number
  onSetAutomation: (sectionId: string, channelIdx: number, paramKey: string, value: number, barOffset?: number) => void
  onClearParamAutomation: (channelIdx: number, paramKey: string) => void
  onDeleteKeyframe?: (sectionId: string, channelIdx: number, paramKey: string, barOffset?: number) => void
}

const PX_PER_BAR = 48

// ─── Catmull-Rom spline ───
function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t
  const t3 = t2 * t
  return 0.5 * (
    (2 * p1) +
    (-p0 + p2) * t +
    (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
    (-p0 + 3 * p1 - 3 * p2 + p3) * t3
  )
}

// ─── Parsed keyframe ───
interface Keyframe {
  sectionIdx: number
  barOffset: number
  absoluteBar: number
  value: number
  key: string
}

const AutomationLane = memo(function AutomationLane({
  channelIdx, channelColor, paramKey, paramLabel,
  paramMin, paramMax, currentValue,
  sections, automationData, isRecording,
  isPlaying = false, getCyclePosition,
  height = 64,
  onSetAutomation, onClearParamAutomation, onDeleteKeyframe,
}: AutomationLaneProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const playheadRef = useRef<SVGLineElement>(null)
  const valueDotRef = useRef<SVGCircleElement>(null)
  const valueTextRef = useRef<SVGTextElement>(null)
  const ghostDotRef = useRef<SVGCircleElement>(null)
  const ghostLineRef = useRef<SVGLineElement>(null)
  const ghostTextRef = useRef<SVGTextElement>(null)
  const rafRef = useRef<number>(0)
  const getCyclePosRef = useRef(getCyclePosition)
  getCyclePosRef.current = getCyclePosition
  const sectionsRef = useRef(sections)
  sectionsRef.current = sections
  const autoDataRef = useRef(automationData)
  autoDataRef.current = automationData

  const [hoveredKf, setHoveredKf] = useState<number | null>(null)
  const [dragging, setDragging] = useState<{ kfIndex: number } | null>(null)
  const [lastClickedBar, setLastClickedBar] = useState<number | null>(null)

  const totalBars = sections.reduce((sum, s) => sum + s.bars, 0)
  const totalWidth = totalBars * PX_PER_BAR
  if (totalBars === 0) return null

  // Section layout
  const sectionStartPx: number[] = []
  const sectionStartBar: number[] = []
  const sectionWidthsPx: number[] = []
  let pxAcc = 0
  let barAcc = 0
  for (const sec of sections) {
    sectionStartPx.push(pxAcc)
    sectionStartBar.push(barAcc)
    const w = sec.bars * PX_PER_BAR
    sectionWidthsPx.push(w)
    pxAcc += w
    barAcc += sec.bars
  }

  const normalize = (v: number) => Math.max(0, Math.min(1, (v - paramMin) / (paramMax - paramMin || 1)))
  const denormalize = (n: number) => paramMin + n * (paramMax - paramMin)

  // ─── Parse keyframes from automation data ───
  const keyframes: Keyframe[] = []
  for (let si = 0; si < sections.length; si++) {
    const sec = sections[si]
    // Check for per-bar keyframes: sectionId@barOffset:channelIdx:paramKey
    for (let b = 0; b < sec.bars; b++) {
      const key = `${sec.id}@${b}:${channelIdx}:${paramKey}`
      if (automationData.has(key)) {
        keyframes.push({
          sectionIdx: si,
          barOffset: b,
          absoluteBar: sectionStartBar[si] + b,
          value: automationData.get(key)!,
          key,
        })
      }
    }
    // Also check legacy key (no @) — treat as bar 0
    const legacyKey = `${sec.id}:${channelIdx}:${paramKey}`
    if (automationData.has(legacyKey)) {
      const hasBar0 = keyframes.some(kf => kf.sectionIdx === si && kf.barOffset === 0)
      if (!hasBar0) {
        keyframes.push({
          sectionIdx: si,
          barOffset: 0,
          absoluteBar: sectionStartBar[si],
          value: automationData.get(legacyKey)!,
          key: legacyKey,
        })
      }
    }
  }
  keyframes.sort((a, b) => a.absoluteBar - b.absoluteBar)
  const hasAnyAutomation = keyframes.length > 0

  // ─── Interpolated value at fractional bar position ───
  const getInterpValue = useCallback((barPos: number): number => {
    const sec = sectionsRef.current
    const ad = autoDataRef.current
    if (sec.length === 0) return currentValue

    // Rebuild keyframes from refs (for rAF loop)
    const secStartBar: number[] = []
    let ba = 0
    for (const s of sec) { secStartBar.push(ba); ba += s.bars }

    const kfs: { absoluteBar: number; value: number }[] = []
    for (let si = 0; si < sec.length; si++) {
      const s = sec[si]
      for (let b = 0; b < s.bars; b++) {
        const key = `${s.id}@${b}:${channelIdx}:${paramKey}`
        if (ad.has(key)) {
          kfs.push({ absoluteBar: secStartBar[si] + b, value: ad.get(key)! })
        }
      }
      // Legacy key
      const legKey = `${s.id}:${channelIdx}:${paramKey}`
      if (ad.has(legKey) && !kfs.some(k => k.absoluteBar === secStartBar[si])) {
        kfs.push({ absoluteBar: secStartBar[si], value: ad.get(legKey)! })
      }
    }
    kfs.sort((a, b) => a.absoluteBar - b.absoluteBar)

    if (kfs.length === 0) return currentValue
    if (kfs.length === 1) return kfs[0].value

    // Find surrounding keyframes for Catmull-Rom
    let rightIdx = kfs.findIndex(kf => kf.absoluteBar >= barPos)
    if (rightIdx === -1) return kfs[kfs.length - 1].value
    if (rightIdx === 0) return kfs[0].value

    const left = kfs[rightIdx - 1]
    const right = kfs[rightIdx]
    const p0 = rightIdx > 1 ? kfs[rightIdx - 2].value : left.value
    const p3 = rightIdx < kfs.length - 1 ? kfs[rightIdx + 1].value : right.value
    const t = (barPos - left.absoluteBar) / Math.max(0.001, right.absoluteBar - left.absoluteBar)
    const interp = catmullRom(p0, left.value, right.value, p3, t)
    return Math.max(paramMin, Math.min(paramMax, interp))
  }, [channelIdx, paramKey, paramMin, paramMax, currentValue])

  // ─── Build smooth SVG path ───
  const buildCurvePath = (): string => {
    if (keyframes.length === 0) return ''
    const steps = Math.max(Math.round(totalWidth / 2), 60)
    const pts: string[] = []
    for (let i = 0; i <= steps; i++) {
      const barPos = (i / steps) * totalBars
      const val = getInterpValue(barPos)
      const x = (i / steps) * totalWidth
      const y = (1 - normalize(val)) * height
      pts.push(i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`)
    }
    return pts.join(' ')
  }

  const curvePath = buildCurvePath()
  const fillPath = curvePath ? curvePath + ` L ${totalWidth} ${height} L 0 ${height} Z` : ''

  // ─── Playhead rAF loop ───
  useEffect(() => {
    if (!isPlaying) {
      if (playheadRef.current) playheadRef.current.style.opacity = '0'
      if (valueDotRef.current) valueDotRef.current.style.opacity = '0'
      if (valueTextRef.current) valueTextRef.current.style.opacity = '0'
      return
    }
    const tick = () => {
      const getPos = getCyclePosRef.current
      const sec = sectionsRef.current
      if (!getPos || !sec.length) {
        rafRef.current = requestAnimationFrame(tick)
        return
      }
      const pos = getPos()
      if (pos === null) {
        if (playheadRef.current) playheadRef.current.style.opacity = '0'
        if (valueDotRef.current) valueDotRef.current.style.opacity = '0'
        if (valueTextRef.current) valueTextRef.current.style.opacity = '0'
        rafRef.current = requestAnimationFrame(tick)
        return
      }
      const tb = sec.reduce((sum, s) => sum + s.bars, 0)
      if (tb <= 0) { rafRef.current = requestAnimationFrame(tick); return }
      const barPos = pos % tb
      const x = barPos * PX_PER_BAR
      const w = tb * PX_PER_BAR

      if (playheadRef.current) {
        playheadRef.current.setAttribute('x1', String(x))
        playheadRef.current.setAttribute('x2', String(x))
        playheadRef.current.style.opacity = '1'
      }

      const interpVal = getInterpValue(barPos)
      const normY = (1 - normalize(interpVal)) * height

      if (valueDotRef.current) {
        valueDotRef.current.setAttribute('cx', String(x))
        valueDotRef.current.setAttribute('cy', String(normY))
        valueDotRef.current.style.opacity = '1'
      }
      if (valueTextRef.current) {
        valueTextRef.current.setAttribute('x', String(Math.min(x + 8, w - 35)))
        valueTextRef.current.setAttribute('y', String(Math.max(12, normY - 5)))
        valueTextRef.current.textContent = interpVal.toFixed(2)
        valueTextRef.current.style.opacity = '1'
      }

      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [isPlaying, height, getInterpValue])

  // ─── X position helpers ───
  const barFromPx = useCallback((xPx: number): { barIdx: number; sectionIdx: number; barOffset: number } => {
    const barIdx = Math.max(0, Math.min(totalBars - 1, Math.floor(xPx / PX_PER_BAR)))
    let ba = 0
    for (let i = 0; i < sections.length; i++) {
      if (barIdx < ba + sections[i].bars) {
        return { barIdx, sectionIdx: i, barOffset: barIdx - ba }
      }
      ba += sections[i].bars
    }
    const lastSec = sections.length - 1
    return { barIdx, sectionIdx: lastSec, barOffset: Math.min(barIdx - sectionStartBar[lastSec], sections[lastSec].bars - 1) }
  }, [sections, totalBars, sectionStartBar])

  const barCenterPx = (absoluteBar: number) => absoluteBar * PX_PER_BAR + PX_PER_BAR / 2

  // ─── Mouse tracking for ghost preview dot ───
  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (dragging || !svgRef.current) return
    const rect = svgRef.current.getBoundingClientRect()
    const xPx = e.clientX - rect.left
    const yPx = e.clientY - rect.top
    const yRatio = yPx / rect.height
    const val = denormalize(1 - Math.max(0, Math.min(1, yRatio)))

    // Snap ghost to bar center
    const barIdx = Math.max(0, Math.min(totalBars - 1, Math.floor(xPx / PX_PER_BAR)))
    const snapX = barIdx * PX_PER_BAR + PX_PER_BAR / 2

    if (ghostDotRef.current) {
      ghostDotRef.current.setAttribute('cx', String(snapX))
      ghostDotRef.current.setAttribute('cy', String(Math.max(2, Math.min(height - 2, yPx))))
      ghostDotRef.current.style.opacity = '0.4'
    }
    if (ghostLineRef.current) {
      ghostLineRef.current.setAttribute('x1', String(snapX))
      ghostLineRef.current.setAttribute('x2', String(snapX))
      ghostLineRef.current.style.opacity = '0.12'
    }
    if (ghostTextRef.current) {
      ghostTextRef.current.setAttribute('x', String(Math.min(snapX + 8, totalWidth - 55)))
      ghostTextRef.current.setAttribute('y', String(Math.max(12, yPx - 6)))
      ghostTextRef.current.textContent = `${val.toFixed(2)} [bar ${barIdx + 1}]`
      ghostTextRef.current.style.opacity = '0.4'
    }
  }, [height, totalWidth, dragging, totalBars])

  const handleMouseLeave = useCallback(() => {
    if (ghostDotRef.current) ghostDotRef.current.style.opacity = '0'
    if (ghostLineRef.current) ghostLineRef.current.style.opacity = '0'
    if (ghostTextRef.current) ghostTextRef.current.style.opacity = '0'
  }, [])

  // ─── Click to add/update keyframe at bar position ───
  const handleClick = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current || dragging) return
    const rect = svgRef.current.getBoundingClientRect()
    const xPx = e.clientX - rect.left
    const yRatio = (e.clientY - rect.top) / rect.height
    const value = denormalize(1 - Math.max(0, Math.min(1, yRatio)))

    const { barIdx, sectionIdx, barOffset } = barFromPx(xPx)
    onSetAutomation(sections[sectionIdx].id, channelIdx, paramKey, Math.round(value * 1000) / 1000, barOffset)
    setLastClickedBar(barIdx)
    setTimeout(() => setLastClickedBar(null), 600)
  }, [sections, channelIdx, paramKey, onSetAutomation, dragging, barFromPx])

  // ─── Right-click to delete nearest keyframe ───
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!svgRef.current || !onDeleteKeyframe) return
    const rect = svgRef.current.getBoundingClientRect()
    const xPx = e.clientX - rect.left
    const clickBar = xPx / PX_PER_BAR

    // Find nearest keyframe within 1.5 bars
    let nearestKf: Keyframe | null = null
    let nearestDist = Infinity
    for (const kf of keyframes) {
      const dist = Math.abs(kf.absoluteBar + 0.5 - clickBar)
      if (dist < nearestDist && dist < 1.5) {
        nearestDist = dist
        nearestKf = kf
      }
    }

    if (nearestKf) {
      onDeleteKeyframe(sections[nearestKf.sectionIdx].id, channelIdx, paramKey, nearestKf.barOffset)
    }
  }, [sections, channelIdx, paramKey, keyframes, onDeleteKeyframe])

  // ─── Drag breakpoint (Y-axis value change, fixed bar position) ───
  const handleDotMouseDown = useCallback((e: React.MouseEvent, kfIndex: number) => {
    e.stopPropagation()
    e.preventDefault()
    setDragging({ kfIndex })
    const kf = keyframes[kfIndex]

    const onMove = (ev: MouseEvent) => {
      if (!svgRef.current) return
      const rect = svgRef.current.getBoundingClientRect()
      const yRatio = (ev.clientY - rect.top) / rect.height
      const value = denormalize(1 - Math.max(0, Math.min(1, yRatio)))
      onSetAutomation(sections[kf.sectionIdx].id, channelIdx, paramKey, Math.round(value * 1000) / 1000, kf.barOffset)
    }
    const onUp = () => {
      setDragging(null)
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [sections, channelIdx, paramKey, keyframes, onSetAutomation])

  return (
    <div className="flex items-stretch relative" style={{ height }}>
      {/* Param label */}
      <div
        className="shrink-0 flex items-center justify-between gap-1 px-2 text-[7px] font-bold uppercase tracking-wider"
        style={{
          width: 60,
          color: channelColor,
          opacity: hasAnyAutomation ? 0.9 : 0.4,
          background: '#0a0b0d',
          borderRight: '1px solid rgba(255,255,255,0.04)',
          borderBottom: '1px solid rgba(255,255,255,0.04)',
        }}
      >
        <span className="truncate">{paramLabel}</span>
        {hasAnyAutomation && (
          <button
            onClick={(e) => { e.stopPropagation(); onClearParamAutomation(channelIdx, paramKey) }}
            className="opacity-30 hover:opacity-80 transition-opacity cursor-pointer"
            style={{ background: 'none', border: 'none', color: '#b86f6f', padding: 0 }}
            title={`Clear ${paramLabel} automation`}
          >
            <Trash2 size={7} />
          </button>
        )}
      </div>

      {/* SVG automation */}
      <div className="flex-1 relative overflow-x-auto">
        {/* Guidance overlays */}
        {!hasAnyAutomation && !isRecording && (
          <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none"
            style={{ background: 'rgba(8,9,12,0.5)' }}>
            <span className="text-[8px] font-medium px-2 py-0.5 rounded pointer-events-auto"
              style={{ color: '#5a616b', background: '#0e1014', border: '1px solid #1a1c22' }}>
              Click on any bar to add keyframes · right-click to delete
            </span>
          </div>
        )}
        {isRecording && !hasAnyAutomation && (
          <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none"
            style={{ background: 'rgba(239,68,68,0.03)' }}>
            <span className="text-[8px] font-medium px-2 py-0.5 rounded"
              style={{ color: '#ef4444', background: '#1a0808', border: '1px solid #3a1515' }}>
              ● REC armed — Play and tweak the {paramLabel} knob
            </span>
          </div>
        )}

        <svg
          ref={svgRef}
          className="cursor-crosshair"
          width={totalWidth}
          height={height}
          style={{
            background: isRecording ? '#0c0708' : '#08090c',
            borderBottom: '1px solid rgba(255,255,255,0.04)',
            transition: 'background 0.3s',
            minWidth: totalWidth,
          }}
          viewBox={`0 0 ${totalWidth} ${height}`}
          onClick={handleClick}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onContextMenu={handleContextMenu}
        >
          {/* Section dividers + labels + bar grid */}
          {sections.map((sec, i) => {
            const xStart = sectionStartPx[i]
            const w = sectionWidthsPx[i]
            return (
              <g key={sec.id}>
                {i % 2 === 1 && (
                  <rect x={xStart} y={0} width={w} height={height}
                    fill="rgba(255,255,255,0.012)" />
                )}
                {i > 0 && (
                  <line x1={xStart} y1={0} x2={xStart} y2={height}
                    stroke="rgba(255,255,255,0.08)" strokeWidth={1} />
                )}
                <text x={xStart + 4} y={9}
                  fill="rgba(255,255,255,0.12)" fontSize={7}
                  fontFamily="monospace" fontWeight="600"
                >{sec.name}</text>
                {Array.from({ length: sec.bars - 1 }).map((_, b) => (
                  <line key={b}
                    x1={xStart + (b + 1) * PX_PER_BAR} y1={0}
                    x2={xStart + (b + 1) * PX_PER_BAR} y2={height}
                    stroke="rgba(255,255,255,0.025)" strokeWidth={1}
                  />
                ))}
              </g>
            )
          })}

          {/* Horizontal 25/50/75 grid */}
          {[0.25, 0.5, 0.75].map(frac => (
            <line key={frac}
              x1={0} y1={frac * height} x2={totalWidth} y2={frac * height}
              stroke="rgba(255,255,255,0.03)" strokeWidth={1}
            />
          ))}

          {/* Baseline (current static value) */}
          <line
            x1={0} y1={(1 - normalize(currentValue)) * height}
            x2={totalWidth} y2={(1 - normalize(currentValue)) * height}
            stroke={`${channelColor}12`} strokeWidth={1} strokeDasharray="4 4"
          />

          {/* ─── Smooth curve ─── */}
          {curvePath && (
            <>
              <defs>
                <linearGradient id={`autoGrad-${channelIdx}-${paramKey}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={channelColor} stopOpacity={0.15} />
                  <stop offset="100%" stopColor={channelColor} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <path d={fillPath} fill={`url(#autoGrad-${channelIdx}-${paramKey})`} />
              <path d={curvePath}
                fill="none" stroke={channelColor} strokeWidth={2}
                opacity={hasAnyAutomation ? 0.8 : 0.2}
                strokeLinejoin="round" strokeLinecap="round"
              />
              {hasAnyAutomation && (
                <path d={curvePath}
                  fill="none" stroke={channelColor} strokeWidth={5}
                  opacity={0.12} strokeLinejoin="round" strokeLinecap="round"
                />
              )}
            </>
          )}

          {/* ─── Per-bar keyframe dots ─── */}
          {keyframes.map((kf, ki) => {
            const cx = barCenterPx(kf.absoluteBar)
            const cy = (1 - normalize(kf.value)) * height
            const isHovered = hoveredKf === ki
            const isDragging = dragging?.kfIndex === ki
            const justClicked = lastClickedBar === kf.absoluteBar

            return (
              <g key={kf.key}>
                {/* Vertical stem line */}
                <line x1={cx} y1={cy} x2={cx} y2={height}
                  stroke={channelColor} strokeWidth={1}
                  opacity={isHovered || isDragging ? 0.2 : 0.08}
                  strokeDasharray="2 2" />
                {/* Outer ring */}
                <circle cx={cx} cy={cy}
                  r={isDragging ? 12 : isHovered ? 10 : 7}
                  fill="none" stroke={channelColor}
                  strokeWidth={isDragging ? 2 : 1}
                  opacity={isDragging ? 0.5 : isHovered ? 0.3 : 0.06}
                  style={{ transition: 'r 0.15s, opacity 0.15s' }}
                />
                {/* Pulse on click */}
                {justClicked && (
                  <circle cx={cx} cy={cy} r={5}
                    fill="none" stroke={channelColor}
                    strokeWidth={2} opacity={0}
                  >
                    <animate attributeName="r" from="5" to="18" dur="0.5s" fill="freeze" />
                    <animate attributeName="opacity" from="0.7" to="0" dur="0.5s" fill="freeze" />
                  </circle>
                )}
                {/* Main keyframe dot */}
                <circle
                  cx={cx} cy={cy}
                  r={isDragging ? 6 : isHovered ? 5.5 : 4.5}
                  fill={channelColor}
                  stroke="#fff"
                  strokeWidth={isDragging ? 2.5 : 1.5}
                  className="cursor-grab active:cursor-grabbing"
                  style={{ transition: isDragging ? 'none' : 'r 0.12s', filter: isDragging ? `drop-shadow(0 0 6px ${channelColor})` : 'none' }}
                  onMouseDown={(e) => handleDotMouseDown(e as unknown as React.MouseEvent, ki)}
                  onMouseEnter={() => setHoveredKf(ki)}
                  onMouseLeave={() => setHoveredKf(null)}
                />
                {/* Value + bar label on hover/drag */}
                {(isHovered || isDragging) && (
                  <>
                    <rect
                      x={cx - 28} y={Math.max(1, cy - 23)}
                      width={56} height={14}
                      rx={3} fill="#111317" stroke={channelColor}
                      strokeWidth={0.5} opacity={0.9}
                    />
                    <text x={cx} y={Math.max(11, cy - 12)}
                      textAnchor="middle" fill="white" fontSize={8}
                      fontWeight="bold" fontFamily="monospace"
                    >{kf.value.toFixed(2)} bar {kf.absoluteBar + 1}</text>
                  </>
                )}
              </g>
            )
          })}

          {/* ─── Ghost preview dot (follows mouse, snaps to bars) ─── */}
          <line ref={ghostLineRef}
            x1={0} y1={0} x2={0} y2={height}
            stroke={channelColor} strokeWidth={1} opacity={0}
            strokeDasharray="3 3" pointerEvents="none"
          />
          <circle ref={ghostDotRef}
            cx={0} cy={0} r={4}
            fill={channelColor} stroke="#fff" strokeWidth={1} opacity={0}
            pointerEvents="none"
            style={{ filter: `drop-shadow(0 0 3px ${channelColor})` }}
          />
          <text ref={ghostTextRef}
            x={0} y={0}
            fill={channelColor} fontSize={8} fontWeight="600" fontFamily="monospace" opacity={0}
            pointerEvents="none"
          />

          {/* ─── Live playhead ─── */}
          <line ref={playheadRef}
            x1={0} y1={0} x2={0} y2={height}
            stroke="#00e5c7" strokeWidth={1.5} opacity={0}
          />
          <circle ref={valueDotRef}
            cx={0} cy={0} r={4}
            fill="#00e5c7" stroke="#fff" strokeWidth={1.5} opacity={0}
          />
          <text ref={valueTextRef}
            x={0} y={0}
            fill="#00e5c7" fontSize={9} fontWeight="bold" fontFamily="monospace" opacity={0}
          />

          {/* Recording indicator */}
          {isRecording && (
            <circle cx={totalWidth - 10} cy={10} r={4} fill="#ef4444" opacity={0.8}>
              <animate attributeName="opacity" values="0.4;1;0.4" dur="1s" repeatCount="indefinite" />
            </circle>
          )}
        </svg>
      </div>
    </div>
  )
})

export default AutomationLane
