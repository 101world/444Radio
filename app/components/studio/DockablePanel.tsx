'use client'

import React, { useState, useRef, useCallback, useEffect, memo } from 'react'

// ═══════════════════════════════════════════════════════════════
//  DOCKABLE PANEL — draggable, undockable 4:3 hardware rack unit
//  Wraps any "plugin" component. When docked, it sits in the
//  layout flow. When undocked, it floats freely and can be
//  dragged around the viewport.
// ═══════════════════════════════════════════════════════════════

interface DockablePanelProps {
  /** Unique panel id */
  id: string
  /** Plugin title shown in the title bar */
  title: string
  /** Brand / subtitle */
  brand?: string
  /** Accent color for the title bar */
  accentColor?: string
  /** Whether the panel is currently visible */
  isOpen: boolean
  /** Close handler */
  onClose: () => void
  /** Default width when undocked */
  defaultWidth?: number
  /** Children = the plugin content */
  children: React.ReactNode
}

export default memo(function DockablePanel({
  id,
  title,
  brand = '444RADIO',
  accentColor = '#7fa998',
  isOpen,
  onClose,
  defaultWidth = 480,
  children,
}: DockablePanelProps) {
  const [isDocked, setIsDocked] = useState(true)
  const [position, setPosition] = useState({ x: 80, y: 80 })
  const [size, setSize] = useState({ w: defaultWidth, h: Math.round(defaultWidth * 3 / 4) })
  const dragRef = useRef<{ startX: number; startY: number; startPosX: number; startPosY: number } | null>(null)
  const resizeRef = useRef<{ startX: number; startY: number; startW: number; startH: number } | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  // Drag handling (undocked mode)
  const handleDragStart = useCallback((e: React.PointerEvent) => {
    if (isDocked) return
    e.preventDefault()
    dragRef.current = { startX: e.clientX, startY: e.clientY, startPosX: position.x, startPosY: position.y }
    const onMove = (ev: PointerEvent) => {
      if (!dragRef.current) return
      const dx = ev.clientX - dragRef.current.startX
      const dy = ev.clientY - dragRef.current.startY
      setPosition({ x: dragRef.current.startPosX + dx, y: dragRef.current.startPosY + dy })
    }
    const onUp = () => {
      dragRef.current = null
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }, [isDocked, position])

  // Resize handling (undocked mode)
  const handleResizeStart = useCallback((e: React.PointerEvent) => {
    if (isDocked) return
    e.preventDefault()
    e.stopPropagation()
    resizeRef.current = { startX: e.clientX, startY: e.clientY, startW: size.w, startH: size.h }
    const onMove = (ev: PointerEvent) => {
      if (!resizeRef.current) return
      const dx = ev.clientX - resizeRef.current.startX
      const dy = ev.clientY - resizeRef.current.startY
      const newW = Math.max(320, resizeRef.current.startW + dx)
      const newH = Math.max(240, resizeRef.current.startH + dy)
      setSize({ w: newW, h: newH })
    }
    const onUp = () => {
      resizeRef.current = null
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }, [isDocked, size])

  // Center panel when first undocking
  useEffect(() => {
    if (!isDocked && panelRef.current) {
      const vw = window.innerWidth
      const vh = window.innerHeight
      setPosition({
        x: Math.max(20, (vw - size.w) / 2),
        y: Math.max(20, (vh - size.h) / 2),
      })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDocked])

  if (!isOpen) return null

  // ── UNDOCKED (floating) ──
  if (!isDocked) {
    return (
      <div
        ref={panelRef}
        className="fixed z-[200] flex flex-col"
        style={{
          left: position.x,
          top: position.y,
          width: size.w,
          height: size.h,
          // Heavy 3D metallic chassis
          background: `
            linear-gradient(170deg,
              #1a1c22 0%,
              #141620 15%,
              #111318 50%,
              #0e1014 85%,
              #1a1c22 100%
            )`,
          borderRadius: 8,
          border: '1px solid rgba(255,255,255,0.06)',
          boxShadow: `
            0 20px 60px rgba(0,0,0,0.8),
            0 8px 24px rgba(0,0,0,0.6),
            inset 0 1px 0 rgba(255,255,255,0.04),
            inset 0 -1px 0 rgba(0,0,0,0.3)
          `,
        }}
      >
        {/* Title bar — brushed aluminium */}
        <div
          className="flex items-center justify-between px-3 py-1.5 cursor-grab active:cursor-grabbing select-none shrink-0"
          onPointerDown={handleDragStart}
          style={{
            background: 'linear-gradient(180deg, #22252d 0%, #1a1d24 100%)',
            borderBottom: '1px solid rgba(255,255,255,0.04)',
            borderRadius: '8px 8px 0 0',
          }}
        >
          <div className="flex items-center gap-2">
            {/* LED */}
            <div className="w-2 h-2 rounded-full" style={{
              background: accentColor,
              boxShadow: `0 0 6px ${accentColor}60, inset 0 -1px 1px rgba(0,0,0,0.3)`,
            }} />
            <span className="text-[9px] font-black tracking-[.15em] uppercase" style={{ color: accentColor }}>
              {title}
            </span>
            <span className="text-[7px] font-bold tracking-[.2em] uppercase" style={{ color: '#3a3d44' }}>
              {brand}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {/* Dock button */}
            <button
              onClick={() => setIsDocked(true)}
              className="w-5 h-5 flex items-center justify-center rounded cursor-pointer transition-colors"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
              title="Dock panel"
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <rect x="1" y="1" width="8" height="8" rx="1" stroke={accentColor} strokeWidth="1" opacity="0.6" />
                <rect x="1" y="6" width="8" height="3" rx="0.5" fill={accentColor} opacity="0.4" />
              </svg>
            </button>
            {/* Close */}
            <button
              onClick={onClose}
              className="w-5 h-5 flex items-center justify-center rounded cursor-pointer transition-colors"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
              title="Close"
            >
              <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                <path d="M1 1L7 7M7 1L1 7" stroke="#ff4444" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden relative" style={{ borderRadius: '0 0 6px 6px' }}>
          {children}
        </div>

        {/* Resize handle (bottom-right corner) */}
        <div
          className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize z-10"
          onPointerDown={handleResizeStart}
          style={{ opacity: 0.3 }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" style={{ position: 'absolute', bottom: 2, right: 2 }}>
            <path d="M10 2L2 10M10 6L6 10M10 10L10 10" stroke={accentColor} strokeWidth="1" strokeLinecap="round" opacity="0.5" />
          </svg>
        </div>
      </div>
    )
  }

  // ── DOCKED (inline flow) ──
  return (
    <div
      ref={panelRef}
      data-panel-id={id}
      className="relative flex flex-col shrink-0"
      style={{
        height: 280,
        background: `
          linear-gradient(180deg,
            #1a1c22 0%,
            #141620 15%,
            #111318 50%,
            #0e1014 85%,
            #1a1c22 100%
          )`,
        borderTop: `2px solid #2a2d35`,
        boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.4), inset 0 -1px 0 rgba(255,255,255,0.03)',
      }}
    >
      {/* Title bar */}
      <div
        className="flex items-center justify-between px-3 py-1 shrink-0 select-none"
        style={{
          background: 'linear-gradient(180deg, #22252d 0%, #1a1d24 100%)',
          borderBottom: '1px solid rgba(255,255,255,0.04)',
        }}
      >
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full" style={{
            background: accentColor,
            boxShadow: `0 0 4px ${accentColor}50`,
          }} />
          <span className="text-[8px] font-black tracking-[.15em] uppercase" style={{ color: accentColor }}>
            {title}
          </span>
          <span className="text-[6px] font-bold tracking-[.2em] uppercase" style={{ color: '#3a3d44' }}>
            {brand}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {/* Undock button */}
          <button
            onClick={() => setIsDocked(false)}
            className="w-4 h-4 flex items-center justify-center rounded cursor-pointer"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}
            title="Undock (float)"
          >
            <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
              <rect x="0.5" y="0.5" width="7" height="7" rx="1" stroke={accentColor} strokeWidth="0.8" opacity="0.5" />
              <path d="M2 3L4 1L6 3" stroke={accentColor} strokeWidth="0.8" strokeLinecap="round" opacity="0.5" />
            </svg>
          </button>
          {/* Close */}
          <button
            onClick={onClose}
            className="w-4 h-4 flex items-center justify-center rounded cursor-pointer"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}
            title="Close"
          >
            <svg width="6" height="6" viewBox="0 0 6 6" fill="none">
              <path d="M0.5 0.5L5.5 5.5M5.5 0.5L0.5 5.5" stroke="#ff4444" strokeWidth="1" strokeLinecap="round" opacity="0.5" />
            </svg>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden relative">
        {children}
      </div>
    </div>
  )
})
