'use client'

import { useCallback, useRef, useState } from 'react'

// ═══════════════════════════════════════════════════════════════
//  HARDWARE KNOB — Photorealistic 3D rotary knob
//  Inspired by guitar amp / rack FX hardware aesthetics
//
//  Features:
//    - 3D radial gradient body with specular highlight
//    - Metallic ring / beveled edge
//    - Orange indicator line (like Beaotic/hardware pedals)
//    - Tick marks around the sweep
//    - Drag up/down to change value, shift for fine control
//    - Scroll wheel support
// ═══════════════════════════════════════════════════════════════

interface HardwareKnobProps {
  label: string
  value: number
  min: number
  max: number
  step?: number
  size?: number         // px diameter (default 52)
  color?: string        // accent color for indicator
  unit?: string
  onChange: (value: number) => void
  onRemove?: () => void
  formatValue?: (v: number) => string
  isComplex?: boolean
  active?: boolean      // whether this effect is on the channel
  description?: string  // what this effect does (shown on hover)
  paramKey?: string     // the strudel param key (e.g. 'lpf')
  onTweakStart?: (paramKey: string) => void   // called when user starts dragging
  onTweakEnd?: () => void                     // called when user stops dragging
}

export default function HardwareKnob({
  label,
  value,
  min,
  max,
  step = 0.01,
  size = 52,
  color = '#06b6d4',
  unit = '',
  onChange,
  onRemove,
  formatValue,
  isComplex = false,
  active = true,
  description,
  paramKey,
  onTweakStart,
  onTweakEnd,
}: HardwareKnobProps) {
  const dragRef = useRef<{ startY: number; startVal: number } | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const [showTooltip, setShowTooltip] = useState(false)
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const range = max - min
  const normalized = range > 0 ? (value - min) / range : 0
  const startAngle = 225
  const endAngle = -45
  const angle = startAngle - normalized * (startAngle - endAngle)

  const r = size / 2
  const cx = r
  const cy = r
  const toRad = (deg: number) => (deg * Math.PI) / 180

  // Knob body dimensions
  const outerR = r - 2        // outer metallic ring
  const bodyR = r - 5         // dark knob body
  const indicatorLen = bodyR - 3
  const indicatorStart = bodyR * 0.3

  // Indicator position
  const iRad = toRad(angle)
  const ix1 = cx + indicatorStart * Math.cos(iRad)
  const iy1 = cy - indicatorStart * Math.sin(iRad)
  const ix2 = cx + indicatorLen * Math.cos(iRad)
  const iy2 = cy - indicatorLen * Math.sin(iRad)

  // Tick marks
  const NUM_TICKS = 11
  const tickR1 = outerR + 1
  const tickR2 = outerR + 3

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
      if (paramKey && onTweakStart) onTweakStart(paramKey)
    },
    [value, paramKey, onTweakStart],
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragRef.current) return
      const dy = dragRef.current.startY - e.clientY
      const sensitivity = e.shiftKey ? 0.1 : 0.5
      const delta = (dy * sensitivity * range) / 150
      onChange(clampStep(dragRef.current.startVal + delta))
    },
    [range, onChange, clampStep],
  )

  const handlePointerUp = useCallback(() => {
    dragRef.current = null
    setIsDragging(false)
    if (onTweakEnd) onTweakEnd()
  }, [onTweakEnd])

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
      onRemove()
    } else {
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

  // Specular highlight position (top-left, simulating overhead light)
  const specX = cx - bodyR * 0.25
  const specY = cy - bodyR * 0.3

  return (
    <div
      className="flex flex-col items-center select-none relative"
      style={{
        width: size + 16,
        opacity: active ? 1 : 0.35,
        transition: 'opacity 0.2s',
      }}
      onMouseEnter={() => {
        setIsHovered(true)
        if (description) {
          hoverTimer.current = setTimeout(() => setShowTooltip(true), 500)
        }
      }}
      onMouseLeave={() => {
        setIsHovered(false)
        setShowTooltip(false)
        if (hoverTimer.current) clearTimeout(hoverTimer.current)
      }}
    >
      {/* ── Metallic Tooltip ── */}
      {showTooltip && description && (
        <div
          className="absolute z-50 pointer-events-none"
          style={{
            bottom: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            marginBottom: 6,
            minWidth: 160,
            maxWidth: 220,
          }}
        >
          <div
            className="rounded-md overflow-hidden"
            style={{
              background: 'linear-gradient(180deg, #2a2d35 0%, #1c1e24 100%)',
              border: '1px solid rgba(255,255,255,0.08)',
              boxShadow: '0 4px 16px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.06)',
            }}
          >
            {/* Header strip */}
            <div className="px-2.5 py-1.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: 'rgba(0,0,0,0.15)' }}>
              <div className="flex items-center gap-1.5">
                <div className="w-1 h-1 rounded-full" style={{ background: color, boxShadow: `0 0 4px ${color}80` }} />
                <span className="text-[9px] font-black uppercase tracking-[.15em]" style={{ color: color }}>
                  {paramKey ? `.${paramKey}()` : label}
                </span>
              </div>
            </div>
            {/* Description */}
            <div className="px-2.5 py-2">
              <p className="text-[8px] leading-relaxed" style={{ color: '#9ca3af' }}>
                {description}
              </p>
              {active && onRemove && (
                <p className="text-[7px] mt-1.5 font-bold uppercase tracking-wider" style={{ color: '#b86f6f80' }}>
                  Double-click to remove
                </p>
              )}
              {!active && (
                <p className="text-[7px] mt-1.5 font-bold uppercase tracking-wider" style={{ color: `${color}60` }}>
                  Drag to add effect
                </p>
              )}
            </div>
          </div>
          {/* Arrow */}
          <div
            className="absolute left-1/2 -translate-x-1/2"
            style={{
              top: '100%',
              width: 0, height: 0,
              borderLeft: '5px solid transparent',
              borderRight: '5px solid transparent',
              borderTop: '5px solid #1c1e24',
            }}
          />
        </div>
      )}
      {/* Label */}
      <span
        className="text-[8px] font-bold uppercase tracking-[.18em] truncate w-full text-center leading-none mb-1"
        style={{ color: active ? '#c8cdd4' : '#5a616b', fontFamily: 'system-ui, sans-serif' }}
      >
        {label}
        {isComplex && <span style={{ color: '#06b6d4', opacity: 0.6 }} className="ml-0.5" title="Modulated">~</span>}
      </span>

      {/* SVG Knob */}
      <svg
        width={size + 8}
        height={size + 8}
        viewBox={`-4 -4 ${size + 8} ${size + 8}`}
        className={`cursor-ns-resize transition-transform duration-150 ${
          isDragging ? 'scale-110' : isHovered ? 'scale-105' : ''
        }`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onWheel={handleWheel}
        onDoubleClick={handleDoubleClick}
        style={{ filter: isDragging ? `drop-shadow(0 0 8px ${color}40)` : undefined }}
      >
        <defs>
          {/* Knob body gradient — dark with 3D depth */}
          <radialGradient id={`knobBody-${label}`} cx="0.4" cy="0.35" r="0.65">
            <stop offset="0%" stopColor="#3a3d44" />
            <stop offset="40%" stopColor="#2a2d32" />
            <stop offset="75%" stopColor="#1e2024" />
            <stop offset="100%" stopColor="#151719" />
          </radialGradient>

          {/* Metallic ring gradient */}
          <linearGradient id={`knobRing-${label}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4a4e56" />
            <stop offset="30%" stopColor="#3a3d44" />
            <stop offset="70%" stopColor="#2a2d32" />
            <stop offset="100%" stopColor="#3a3d44" />
          </linearGradient>

          {/* Specular highlight */}
          <radialGradient id={`knobSpec-${label}`} cx="0.38" cy="0.3" r="0.35">
            <stop offset="0%" stopColor="rgba(255,255,255,0.12)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </radialGradient>

          {/* Shadow filter */}
          <filter id={`knobShadow-${label}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#000" floodOpacity="0.5" />
          </filter>
        </defs>

        {/* Tick marks around the sweep */}
        {Array.from({ length: NUM_TICKS }).map((_, i) => {
          const tickAngle = startAngle - (i / (NUM_TICKS - 1)) * (startAngle - endAngle)
          const tRad = toRad(tickAngle)
          const isActive = i / (NUM_TICKS - 1) <= normalized
          return (
            <line
              key={i}
              x1={cx + tickR1 * Math.cos(tRad)}
              y1={cy - tickR1 * Math.sin(tRad)}
              x2={cx + tickR2 * Math.cos(tRad)}
              y2={cy - tickR2 * Math.sin(tRad)}
              stroke={isActive ? `${color}90` : 'rgba(255,255,255,0.12)'}
              strokeWidth={i % 5 === 0 ? 1.5 : 0.8}
              strokeLinecap="round"
            />
          )
        })}

        {/* Outer metallic ring / bezel */}
        <circle
          cx={cx} cy={cy} r={outerR}
          fill={`url(#knobRing-${label})`}
          stroke="rgba(0,0,0,0.4)"
          strokeWidth={0.5}
          filter={`url(#knobShadow-${label})`}
        />

        {/* Knurled edge texture — radial lines */}
        {Array.from({ length: 36 }).map((_, i) => {
          const a = toRad(i * 10)
          const r1 = outerR - 0.5
          const r2 = outerR - 2
          return (
            <line
              key={`k${i}`}
              x1={cx + r1 * Math.cos(a)}
              y1={cy - r1 * Math.sin(a)}
              x2={cx + r2 * Math.cos(a)}
              y2={cy - r2 * Math.sin(a)}
              stroke="rgba(0,0,0,0.25)"
              strokeWidth={0.4}
            />
          )
        })}

        {/* Knob body — 3D gradient */}
        <circle
          cx={cx} cy={cy} r={bodyR}
          fill={`url(#knobBody-${label})`}
          stroke="rgba(0,0,0,0.3)"
          strokeWidth={0.5}
        />

        {/* Inner bevel (subtle ring) */}
        <circle
          cx={cx} cy={cy} r={bodyR - 1}
          fill="none"
          stroke="rgba(255,255,255,0.04)"
          strokeWidth={0.5}
        />

        {/* Specular highlight reflection */}
        <circle
          cx={specX} cy={specY} r={bodyR * 0.4}
          fill={`url(#knobSpec-${label})`}
        />

        {/* Center dimple */}
        <circle
          cx={cx} cy={cy} r={bodyR * 0.12}
          fill="#0d0e10"
          stroke="rgba(255,255,255,0.03)"
          strokeWidth={0.3}
        />

        {/* Indicator line — thick, colored (like orange dot on hardware) */}
        <line
          x1={ix1} y1={iy1}
          x2={ix2} y2={iy2}
          stroke={color}
          strokeWidth={2.5}
          strokeLinecap="round"
          opacity={isDragging ? 1 : 0.85}
          style={{
            filter: isDragging ? `drop-shadow(0 0 3px ${color})` : undefined,
          }}
        />

        {/* Indicator dot at tip */}
        <circle
          cx={ix2} cy={iy2} r={1.5}
          fill={color}
          opacity={isDragging ? 1 : 0.9}
        />
      </svg>

      {/* Value display */}
      <span
        className="text-[9px] font-mono font-bold leading-none tabular-nums mt-0.5"
        style={{
          color: isDragging ? color : active ? '#9ca3af' : '#5a616b',
          transition: 'color 0.15s',
          textShadow: isDragging ? `0 0 6px ${color}60` : undefined,
        }}
      >
        {displayVal}
        {unit && <span className="text-[6px] opacity-50 ml-0.5">{unit}</span>}
      </span>
    </div>
  )
}
