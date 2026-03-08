'use client'

// ═══════════════════════════════════════════════════════════════
//  AUTOMATION LANE — Per-channel automation curve display
//
//  Shows breakpoints for a single param across arrangement
//  sections. Click to add/edit points, drag to adjust values.
//  Re-recording a section replaces its automation.
// ═══════════════════════════════════════════════════════════════

import { memo, useCallback, useRef, useState, useEffect } from 'react'
import { Trash2, Circle } from 'lucide-react'
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
  automationData: Map<string, number>  // key: sectionId:channelIdx:paramKey
  isRecording: boolean
  height?: number
  onSetAutomation: (sectionId: string, channelIdx: number, paramKey: string, value: number) => void
  onClearParamAutomation: (channelIdx: number, paramKey: string) => void
}

const AutomationLane = memo(function AutomationLane({
  channelIdx,
  channelColor,
  paramKey,
  paramLabel,
  paramMin,
  paramMax,
  currentValue,
  sections,
  automationData,
  isRecording,
  height = 48,
  onSetAutomation,
  onClearParamAutomation,
}: AutomationLaneProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [hoveredSection, setHoveredSection] = useState<number | null>(null)
  const [dragging, setDragging] = useState<{ sectionIdx: number } | null>(null)

  // Get total bars
  const totalBars = sections.reduce((sum, s) => sum + s.bars, 0)
  if (totalBars === 0) return null

  // Get automation value for a section (or fall back to current param value)
  const getAutoValue = (sectionId: string): number => {
    const key = `${sectionId}:${channelIdx}:${paramKey}`
    return automationData.has(key) ? automationData.get(key)! : currentValue
  }

  // Normalize value to 0-1 range
  const normalize = (v: number) => Math.max(0, Math.min(1, (v - paramMin) / (paramMax - paramMin || 1)))
  const denormalize = (n: number) => paramMin + n * (paramMax - paramMin)

  // Check if any section has automation for this param
  const hasAnyAutomation = sections.some(s => automationData.has(`${s.id}:${channelIdx}:${paramKey}`))

  // Build points for the automation line
  const points: { x: number; y: number; sectionIdx: number; value: number; hasAuto: boolean }[] = []
  let barAcc = 0
  for (let i = 0; i < sections.length; i++) {
    const sec = sections[i]
    const key = `${sec.id}:${channelIdx}:${paramKey}`
    const hasAuto = automationData.has(key)
    const value = hasAuto ? automationData.get(key)! : currentValue
    const midBar = barAcc + sec.bars / 2
    points.push({
      x: midBar / totalBars,
      y: 1 - normalize(value),
      sectionIdx: i,
      value,
      hasAuto,
    })
    barAcc += sec.bars
  }

  // Handle click on SVG to set automation at a section
  const handleClick = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return
    const rect = svgRef.current.getBoundingClientRect()
    const xRatio = (e.clientX - rect.left) / rect.width
    const yRatio = (e.clientY - rect.top) / rect.height
    const normalizedValue = 1 - yRatio
    const value = denormalize(Math.max(0, Math.min(1, normalizedValue)))

    // Find which section was clicked
    let barAcc = 0
    for (let i = 0; i < sections.length; i++) {
      const sec = sections[i]
      const secStart = barAcc / totalBars
      const secEnd = (barAcc + sec.bars) / totalBars
      if (xRatio >= secStart && xRatio < secEnd) {
        onSetAutomation(sec.id, channelIdx, paramKey, Math.round(value * 1000) / 1000)
        break
      }
      barAcc += sec.bars
    }
  }, [sections, totalBars, channelIdx, paramKey, paramMin, paramMax, onSetAutomation])

  // Handle drag for smooth value editing
  const handleMouseDown = useCallback((e: React.MouseEvent, sectionIdx: number) => {
    e.stopPropagation()
    e.preventDefault()
    setDragging({ sectionIdx })

    const onMove = (ev: MouseEvent) => {
      if (!svgRef.current) return
      const rect = svgRef.current.getBoundingClientRect()
      const yRatio = (ev.clientY - rect.top) / rect.height
      const normalizedValue = 1 - Math.max(0, Math.min(1, yRatio))
      const value = denormalize(normalizedValue)
      onSetAutomation(sections[sectionIdx].id, channelIdx, paramKey, Math.round(value * 1000) / 1000)
    }
    const onUp = () => {
      setDragging(null)
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [sections, channelIdx, paramKey, paramMin, paramMax, onSetAutomation])

  // Section divider positions
  const dividers: number[] = []
  barAcc = 0
  for (let i = 0; i < sections.length - 1; i++) {
    barAcc += sections[i].bars
    dividers.push(barAcc / totalBars)
  }

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

      {/* SVG automation curve */}
      <div className="flex-1 relative">
        {/* Guidance overlay when no automation exists */}
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
          className="w-full h-full cursor-crosshair"
          style={{
            background: isRecording ? '#0c0708' : '#08090c',
            borderBottom: '1px solid rgba(255,255,255,0.04)',
            transition: 'background 0.3s',
          }}
          viewBox={`0 0 1000 ${height}`}
          preserveAspectRatio="none"
          onClick={handleClick}
        >
        {/* Section dividers */}
        {dividers.map((x, i) => (
          <line key={i} x1={x * 1000} y1={0} x2={x * 1000} y2={height}
            stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
        ))}

        {/* Baseline (current value without automation) */}
        <line
          x1={0} y1={(1 - normalize(currentValue)) * height}
          x2={1000} y2={(1 - normalize(currentValue)) * height}
          stroke={`${channelColor}15`} strokeWidth={1} strokeDasharray="4 4"
        />

        {/* Automation curve (step interpolation — holds value until next breakpoint) */}
        {points.length > 0 && (() => {
          // Step path: horizontal line at each section's value, then step up/down at boundary
          let barAcc = 0
          const pathParts: string[] = []
          for (let i = 0; i < sections.length; i++) {
            const sec = sections[i]
            const xStart = (barAcc / totalBars) * 1000
            const xEnd = ((barAcc + sec.bars) / totalBars) * 1000
            const yVal = (1 - normalize(getAutoValue(sec.id))) * height
            if (i === 0) {
              pathParts.push(`M ${xStart} ${yVal}`)
            } else {
              pathParts.push(`L ${xStart} ${yVal}`)
            }
            pathParts.push(`L ${xEnd} ${yVal}`)
            barAcc += sec.bars
          }
          const d = pathParts.join(' ')
          return (
            <>
              {/* Fill under curve */}
              <path d={d + ` L 1000 ${height} L 0 ${height} Z`}
                fill={`${channelColor}08`} />
              {/* Line */}
              <path d={d}
                fill="none" stroke={channelColor} strokeWidth={1.5}
                opacity={hasAnyAutomation ? 0.7 : 0.2} />
            </>
          )
        })()}

        {/* Breakpoint dots */}
        {points.map((pt, i) => (
          <circle
            key={i}
            cx={pt.x * 1000}
            cy={pt.y * height}
            r={pt.hasAuto ? 5 : 3}
            fill={pt.hasAuto ? channelColor : `${channelColor}30`}
            stroke={pt.hasAuto ? '#fff' : 'transparent'}
            strokeWidth={pt.hasAuto ? 1 : 0}
            opacity={pt.hasAuto ? 0.9 : 0.3}
            className="cursor-ns-resize"
            onMouseDown={(e) => handleMouseDown(e as unknown as React.MouseEvent, i)}
            onMouseEnter={() => setHoveredSection(i)}
            onMouseLeave={() => setHoveredSection(null)}
          />
        ))}

        {/* Hovered value label */}
        {hoveredSection !== null && points[hoveredSection] && (
          <text
            x={points[hoveredSection].x * 1000}
            y={Math.max(10, points[hoveredSection].y * height - 6)}
            textAnchor="middle"
            fill="white"
            fontSize={9}
            fontWeight="bold"
            fontFamily="monospace"
          >
            {points[hoveredSection].value.toFixed(2)}
          </text>
        )}

        {/* Recording indicator */}
        {isRecording && (
          <circle cx={990} cy={8} r={4} fill="#ef4444" opacity={0.8}>
            <animate attributeName="opacity" values="0.4;1;0.4" dur="1s" repeatCount="indefinite" />
          </circle>
        )}
      </svg>
      </div>
    </div>
  )
})

export default AutomationLane
