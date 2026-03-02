'use client'

import { useCallback, useRef, useState } from 'react'

// ═══════════════════════════════════════════════════════════════
//  STUDIO KNOB — SVG rotary control (hardware LED-dot style)
//  Inspired by dark hardware volume knobs with LED ring indicators.
//  Drag up/down to change value. Double-click to reset.
// ═══════════════════════════════════════════════════════════════

interface StudioKnobProps {
  label: string
  value: number
  min: number
  max: number
  step?: number
  size?: number         // px diameter (default 36)
  color?: string        // hex or tailwind-ready color
  unit?: string
  onChange: (value: number) => void
  onRemove?: () => void // Double-click removes the effect from code
  formatValue?: (v: number) => string
  isComplex?: boolean   // Show modulation indicator (~ symbol)
}

export default function StudioKnob({
  label,
  value,
  min,
  max,
  step = 0.01,
  size = 36,
  color = '#22d3ee',
  unit = '',
  onChange,
  onRemove,
  formatValue,
  isComplex = false,
}: StudioKnobProps) {
  const dragRef = useRef<{ startY: number; startVal: number } | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  // Map value to angle: 225° (min) to -45° (max) = 270° sweep
  const range = max - min
  const normalized = range > 0 ? (value - min) / range : 0
  const startAngle = 225  // bottom-left
  const endAngle = -45    // bottom-right (going clockwise)
  const angle = startAngle - normalized * (startAngle - endAngle)

  const r = size / 2
  const arcR = r - 4
  const cx = r
  const cy = r

  // Arc path for the value indicator
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const arcPath = (fromDeg: number, toDeg: number) => {
    const from = toRad(fromDeg)
    const to = toRad(toDeg)
    const x1 = cx + arcR * Math.cos(from)
    const y1 = cy - arcR * Math.sin(from)
    const x2 = cx + arcR * Math.cos(to)
    const y2 = cy - arcR * Math.sin(to)
    const sweep = fromDeg - toDeg > 180 ? 1 : 0
    return `M ${x1} ${y1} A ${arcR} ${arcR} 0 ${sweep} 1 ${x2} ${y2}`
  }

  // Pointer on the knob
  const pointerLen = arcR - 3
  const pRad = toRad(angle)
  const px = cx + pointerLen * Math.cos(pRad)
  const py = cy - pointerLen * Math.sin(pRad)

  const clampStep = useCallback(
    (v: number) => {
      const clamped = Math.min(max, Math.max(min, v))
      if (step >= 1) return Math.round(clamped / step) * step
      const decimals = step.toString().split('.')[1]?.length || 2
      return parseFloat((Math.round(clamped / step) * step).toFixed(decimals))
    },
    [min, max, step],
  )

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault()
      e.stopPropagation()
      dragRef.current = { startY: e.clientY, startVal: value }
      setIsDragging(true)
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    },
    [value],
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragRef.current) return
      const dy = dragRef.current.startY - e.clientY
      const sensitivity = e.shiftKey ? 0.1 : 0.5 // shift for fine control
      const delta = (dy * sensitivity * range) / 150
      onChange(clampStep(dragRef.current.startVal + delta))
    },
    [range, onChange, clampStep],
  )

  const handlePointerUp = useCallback(() => {
    dragRef.current = null
    setIsDragging(false)
  }, [])

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.stopPropagation()
      const delta = e.deltaY > 0 ? -step : step
      onChange(clampStep(value + delta * (e.shiftKey ? 1 : 10)))
    },
    [value, step, onChange, clampStep],
  )

  const handleDoubleClick = useCallback(() => {
    if (onRemove) {
      // Remove this effect from the channel code
      onRemove()
    } else {
      // Reset to midpoint on double-click
      onChange(clampStep((min + max) / 2))
    }
  }, [min, max, onChange, onRemove, clampStep])

  const displayVal = formatValue
    ? formatValue(value)
    : value >= 1000
      ? `${(value / 1000).toFixed(1)}k`
      : value >= 100
        ? Math.round(value).toString()
        : value.toFixed(step >= 1 ? 0 : step >= 0.1 ? 1 : 2)

  // LED dot indicators — 21 dots around the 270° arc
  const NUM_DOTS = 21
  const dotR = r - 1.5  // radius for dot ring (outer edge)
  const knobBodyR = r - 6 // radius of the dark knob body

  return (
    <div
      className="flex flex-col items-center gap-0.5 select-none"
      style={{ width: size + 4 }}
    >
      {/* Label */}
      <span className="text-[6px] font-bold uppercase tracking-[.12em] truncate w-full text-center leading-none" style={{ color: '#5a616b' }}>
        {label}{isComplex && <span style={{ color: '#b8a47f', opacity: 0.5 }} className="ml-0.5" title="Modulated">~</span>}
      </span>

      {/* SVG Knob */}
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className={`cursor-ns-resize ${isDragging ? 'scale-110' : 'hover:scale-105'} transition-transform duration-[180ms] ease-in-out`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onWheel={handleWheel}
        onDoubleClick={handleDoubleClick}
      >
        {/* Background track arc — muted */}
        <path
          d={arcPath(startAngle, endAngle)}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={1.5}
          strokeLinecap="round"
        />

        {/* Value arc — muted accent */}
        {normalized > 0.01 && (
          <path
            d={arcPath(startAngle, angle)}
            fill="none"
            stroke={color}
            strokeWidth={1.5}
            strokeLinecap="round"
            opacity={isDragging ? 0.7 : 0.4}
          />
        )}

        {/* Knob body — inset shadow circle */}
        <circle
          cx={cx} cy={cy}
          r={knobBodyR}
          fill="#23262b"
          stroke="rgba(255,255,255,0.04)"
          strokeWidth={0.5}
        />
        {/* Inner shadow simulation */}
        <circle
          cx={cx} cy={cy}
          r={knobBodyR - 0.5}
          fill="none"
          stroke="#1c1e22"
          strokeWidth={1}
          opacity={0.5}
        />

        {/* Pointer line — soft indicator */}
        <line
          x1={cx + (knobBodyR * 0.25) * Math.cos(pRad)}
          y1={cy - (knobBodyR * 0.25) * Math.sin(pRad)}
          x2={cx + (knobBodyR - 1.5) * Math.cos(pRad)}
          y2={cy - (knobBodyR - 1.5) * Math.sin(pRad)}
          stroke={color}
          strokeWidth={1.5}
          strokeLinecap="round"
          opacity={isDragging ? 0.9 : 0.6}
        />
      </svg>

      {/* Value display */}
      <span
        className="text-[7px] font-mono leading-none transition-colors duration-[180ms] tabular-nums"
        style={{ color: isDragging ? color : '#5a616b' }}
      >
        {displayVal}{unit && <span className="text-[5px] opacity-40 ml-0.5">{unit}</span>}
      </span>
    </div>
  )
}
