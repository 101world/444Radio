'use client'

// ═══════════════════════════════════════════════════════════════
//  AUTOMATION LANE — Arrangement-aware smooth automation curves
//
//  Renders per-channel automation as smooth Catmull-Rom splines
//  mapped to arrangement sections. Includes a live playhead that
//  tracks the arrangement position, section labels, draggable
//  breakpoints, and a real-time value readout.
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
  onSetAutomation: (sectionId: string, channelIdx: number, paramKey: string, value: number) => void
  onClearParamAutomation: (channelIdx: number, paramKey: string) => void
  onDeleteKeyframe?: (sectionId: string, channelIdx: number, paramKey: string) => void
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

  const [hoveredSection, setHoveredSection] = useState<number | null>(null)
  const [dragging, setDragging] = useState<{ sectionIdx: number } | null>(null)
  const [lastClickedSection, setLastClickedSection] = useState<number | null>(null)

  const totalBars = sections.reduce((sum, s) => sum + s.bars, 0)
  const totalWidth = totalBars * PX_PER_BAR
  if (totalBars === 0) return null

  // Section layout
  const sectionStartPx: number[] = []
  const sectionWidthsPx: number[] = []
  let pxAcc = 0
  for (const sec of sections) {
    sectionStartPx.push(pxAcc)
    const w = sec.bars * PX_PER_BAR
    sectionWidthsPx.push(w)
    pxAcc += w
  }

  const normalize = (v: number) => Math.max(0, Math.min(1, (v - paramMin) / (paramMax - paramMin || 1)))
  const denormalize = (n: number) => paramMin + n * (paramMax - paramMin)

  const getAutoValue = (sectionId: string): number => {
    const key = `${sectionId}:${channelIdx}:${paramKey}`
    return automationData.has(key) ? automationData.get(key)! : currentValue
  }

  const hasAnyAutomation = sections.some(s => automationData.has(`${s.id}:${channelIdx}:${paramKey}`))
  const normValues = sections.map(s => normalize(getAutoValue(s.id)))

  // ─── Interpolated value at fractional bar position ───
  const getInterpValue = useCallback((barPos: number): number => {
    const sec = sectionsRef.current
    const ad = autoDataRef.current
    const tb = sec.reduce((sum, s) => sum + s.bars, 0)
    if (tb === 0 || sec.length === 0) return currentValue

    const nv = sec.map(s => {
      const key = `${s.id}:${channelIdx}:${paramKey}`
      const val = ad.has(key) ? ad.get(key)! : currentValue
      return Math.max(0, Math.min(1, (val - paramMin) / (paramMax - paramMin || 1)))
    })

    let bAcc = 0, secIdx = 0
    for (let i = 0; i < sec.length; i++) {
      if (barPos < bAcc + sec[i].bars) { secIdx = i; break }
      bAcc += sec[i].bars
      if (i === sec.length - 1) secIdx = i
    }
    const localT = Math.max(0, Math.min(1, (barPos - bAcc) / (sec[secIdx].bars || 1)))

    const p0 = nv[Math.max(secIdx - 1, 0)]
    const p1 = nv[secIdx]
    const p2 = nv[Math.min(secIdx + 1, nv.length - 1)]
    const p3 = nv[Math.min(secIdx + 2, nv.length - 1)]

    const interpNorm = catmullRom(p0, p1, p2, p3, localT)
    return paramMin + Math.max(0, Math.min(1, interpNorm)) * (paramMax - paramMin)
  }, [channelIdx, paramKey, paramMin, paramMax, currentValue])

  // ─── Build smooth SVG path ───
  const buildCurvePath = (): string => {
    if (sections.length === 0) return ''
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

  // ─── Mouse tracking for ghost preview dot ───
  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (dragging || !svgRef.current) return
    const rect = svgRef.current.getBoundingClientRect()
    const xPx = e.clientX - rect.left
    const yPx = e.clientY - rect.top
    const yRatio = yPx / rect.height
    const val = denormalize(1 - Math.max(0, Math.min(1, yRatio)))

    // Find which section we're over
    let barAcc = 0
    let secIdx = -1
    for (let i = 0; i < sections.length; i++) {
      const secEndPx = (barAcc + sections[i].bars) * PX_PER_BAR
      if (xPx < secEndPx) { secIdx = i; break }
      barAcc += sections[i].bars
    }

    if (ghostDotRef.current) {
      ghostDotRef.current.setAttribute('cx', String(xPx))
      ghostDotRef.current.setAttribute('cy', String(Math.max(2, Math.min(height - 2, yPx))))
      ghostDotRef.current.style.opacity = secIdx >= 0 ? '0.5' : '0'
    }
    if (ghostLineRef.current) {
      ghostLineRef.current.setAttribute('x1', String(xPx))
      ghostLineRef.current.setAttribute('x2', String(xPx))
      ghostLineRef.current.style.opacity = secIdx >= 0 ? '0.15' : '0'
    }
    if (ghostTextRef.current) {
      ghostTextRef.current.setAttribute('x', String(Math.min(xPx + 8, totalWidth - 40)))
      ghostTextRef.current.setAttribute('y', String(Math.max(12, yPx - 6)))
      ghostTextRef.current.textContent = val.toFixed(2)
      ghostTextRef.current.style.opacity = secIdx >= 0 ? '0.5' : '0'
    }
  }, [sections, height, totalWidth, dragging, paramMin, paramMax])

  const handleMouseLeave = useCallback(() => {
    if (ghostDotRef.current) ghostDotRef.current.style.opacity = '0'
    if (ghostLineRef.current) ghostLineRef.current.style.opacity = '0'
    if (ghostTextRef.current) ghostTextRef.current.style.opacity = '0'
  }, [])

  // ─── Click to add/update keyframe ───
  const handleClick = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current || dragging) return
    const rect = svgRef.current.getBoundingClientRect()
    const xPx = e.clientX - rect.left
    const yRatio = (e.clientY - rect.top) / rect.height
    const value = denormalize(1 - Math.max(0, Math.min(1, yRatio)))

    let barAcc = 0
    for (let i = 0; i < sections.length; i++) {
      const secEndPx = (barAcc + sections[i].bars) * PX_PER_BAR
      if (xPx < secEndPx) {
        onSetAutomation(sections[i].id, channelIdx, paramKey, Math.round(value * 1000) / 1000)
        setLastClickedSection(i)
        // Clear the pulse after animation completes
        setTimeout(() => setLastClickedSection(null), 600)
        break
      }
      barAcc += sections[i].bars
    }
  }, [sections, channelIdx, paramKey, paramMin, paramMax, onSetAutomation, dragging])

  // ─── Right-click to delete keyframe ───
  const handleContextMenu = useCallback((e: React.MouseEvent, sectionIdx: number) => {
    e.preventDefault()
    e.stopPropagation()
    const sec = sections[sectionIdx]
    if (!sec) return
    const key = `${sec.id}:${channelIdx}:${paramKey}`
    if (automationData.has(key)) {
      if (onDeleteKeyframe) {
        onDeleteKeyframe(sec.id, channelIdx, paramKey)
      } else {
        // Fallback: set to current value effectively removing the override
        onSetAutomation(sec.id, channelIdx, paramKey, currentValue)
      }
    }
  }, [sections, channelIdx, paramKey, automationData, onDeleteKeyframe, onSetAutomation, currentValue])

  // ─── Drag breakpoint (X + Y) ───
  const handleMouseDown = useCallback((e: React.MouseEvent, sectionIdx: number) => {
    e.stopPropagation()
    e.preventDefault()
    setDragging({ sectionIdx })
    const startSectionIdx = sectionIdx

    const onMove = (ev: MouseEvent) => {
      if (!svgRef.current) return
      const rect = svgRef.current.getBoundingClientRect()
      const xPx = ev.clientX - rect.left
      const yRatio = (ev.clientY - rect.top) / rect.height
      const value = denormalize(1 - Math.max(0, Math.min(1, yRatio)))

      // Find which section the cursor is now over (for X-axis movement)
      let barAcc = 0
      let targetSecIdx = startSectionIdx
      for (let i = 0; i < sections.length; i++) {
        const secEndPx = (barAcc + sections[i].bars) * PX_PER_BAR
        if (xPx < secEndPx) { targetSecIdx = i; break }
        barAcc += sections[i].bars
      }

      // If moved to a different section, delete from old and set on new
      if (targetSecIdx !== startSectionIdx) {
        const oldKey = `${sections[startSectionIdx].id}:${channelIdx}:${paramKey}`
        if (automationData.has(oldKey) && onDeleteKeyframe) {
          onDeleteKeyframe(sections[startSectionIdx].id, channelIdx, paramKey)
        }
      }

      onSetAutomation(sections[targetSecIdx].id, channelIdx, paramKey, Math.round(value * 1000) / 1000)
      setDragging({ sectionIdx: targetSecIdx })
    }
    const onUp = () => {
      setDragging(null)
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [sections, channelIdx, paramKey, paramMin, paramMax, onSetAutomation, automationData, onDeleteKeyframe])

  const sectionCenterX = sections.map((_, i) => sectionStartPx[i] + sectionWidthsPx[i] / 2)

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
              Click to draw keyframes · or press REC + Play + tweak knob
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

          {/* Baseline */}
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

          {/* ─── Breakpoint dots (enhanced: larger, draggable X+Y, right-click delete) ─── */}
          {sections.map((sec, i) => {
            const key = `${sec.id}:${channelIdx}:${paramKey}`
            const hasAuto = automationData.has(key)
            const val = getAutoValue(sec.id)
            const cx = sectionCenterX[i]
            const cy = (1 - normValues[i]) * height
            const isHovered = hoveredSection === i
            const isDragging = dragging?.sectionIdx === i
            const justClicked = lastClickedSection === i

            return (
              <g key={sec.id}>
                {/* Vertical stem line */}
                {(hasAuto || isHovered) && (
                  <line x1={cx} y1={cy} x2={cx} y2={height}
                    stroke={channelColor} strokeWidth={1} opacity={0.12}
                    strokeDasharray="2 2" />
                )}
                {/* Outer ring (visible on hover/drag) */}
                {hasAuto && (
                  <circle cx={cx} cy={cy}
                    r={isDragging ? 14 : isHovered ? 11 : 8}
                    fill="none" stroke={channelColor}
                    strokeWidth={isDragging ? 2 : 1}
                    opacity={isDragging ? 0.5 : isHovered ? 0.3 : 0.08}
                    style={{ transition: 'r 0.15s, opacity 0.15s' }}
                  />
                )}
                {/* Pulse ring on click */}
                {justClicked && hasAuto && (
                  <circle cx={cx} cy={cy} r={6}
                    fill="none" stroke={channelColor}
                    strokeWidth={2} opacity={0}
                  >
                    <animate attributeName="r" from="6" to="20" dur="0.5s" fill="freeze" />
                    <animate attributeName="opacity" from="0.7" to="0" dur="0.5s" fill="freeze" />
                  </circle>
                )}
                {/* Main keyframe dot */}
                <circle
                  cx={cx} cy={cy}
                  r={hasAuto ? (isDragging ? 7 : isHovered ? 6 : 5) : 3.5}
                  fill={hasAuto ? channelColor : `${channelColor}30`}
                  stroke={hasAuto ? '#fff' : `${channelColor}50`}
                  strokeWidth={hasAuto ? (isDragging ? 2.5 : 1.5) : 1}
                  opacity={hasAuto ? 1 : 0.4}
                  className="cursor-grab active:cursor-grabbing"
                  style={{ transition: isDragging ? 'none' : 'r 0.12s, stroke-width 0.12s', filter: isDragging ? `drop-shadow(0 0 6px ${channelColor})` : 'none' }}
                  onMouseDown={(e) => handleMouseDown(e as unknown as React.MouseEvent, i)}
                  onContextMenu={(e) => handleContextMenu(e as unknown as React.MouseEvent, i)}
                  onMouseEnter={() => setHoveredSection(i)}
                  onMouseLeave={() => setHoveredSection(null)}
                />
                {/* Value label on hover/drag */}
                {(isHovered || isDragging) && (
                  <>
                    <rect
                      x={cx - 22} y={Math.max(1, cy - 23)}
                      width={44} height={14}
                      rx={3} fill="#111317" stroke={channelColor}
                      strokeWidth={0.5} opacity={0.9}
                    />
                    <text x={cx} y={Math.max(11, cy - 12)}
                      textAnchor="middle" fill="white" fontSize={9}
                      fontWeight="bold" fontFamily="monospace"
                    >{val.toFixed(2)}</text>
                  </>
                )}
                {/* "Click to add" hint for empty (no keyframe) sections */}
                {!hasAuto && isHovered && (
                  <text x={cx} y={Math.max(10, cy - 10)}
                    textAnchor="middle" fill={channelColor} fontSize={7}
                    fontFamily="monospace" opacity={0.5}
                  >click to add</text>
                )}
              </g>
            )
          })}

          {/* ─── Ghost preview dot (follows mouse) ─── */}
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
