'use client'

import { useRef, useState, useMemo, useCallback, useEffect } from 'react'

// ═══════════════════════════════════════════════════════════════
//  BOTTOM TIMELINE — Ableton-style arrangement dock
//
//  Docks at the bottom of the node editor. Each node gets a
//  horizontal track with per-bar visualization. Bars are clickable
//  for per-bar mute. Resizable from the top edge.
// ═══════════════════════════════════════════════════════════════

const TYPE_COLORS: Record<string, string> = {
  drums:  '#f59e0b',
  bass:   '#ef4444',
  melody: '#22d3ee',
  chords: '#a78bfa',
  fx:     '#34d399',
  vocal:  '#f472b6',
  pad:    '#818cf8',
  other:  '#94a3b8',
}

const TYPE_ICONS: Record<string, string> = {
  drums: '⬤', bass: '◆', melody: '▲', chords: '■',
  fx: '✦', vocal: '●', pad: '◈', other: '◉',
}

const ADD_MENU_ITEMS = [
  { key: 'drums',  label: 'Drums',  icon: '⬤' },
  { key: 'bass',   label: 'Bass',   icon: '◆' },
  { key: 'melody', label: 'Melody', icon: '▲' },
  { key: 'chords', label: 'Chords', icon: '■' },
  { key: 'pad',    label: 'Pad',    icon: '◈' },
  { key: 'vocal',  label: 'Vocal',  icon: '●' },
  { key: 'fx',     label: 'FX',     icon: '✦' },
]

interface TimelineNode {
  id: string
  name: string
  type: string
  muted: boolean
  solo: boolean
  pattern: string
  speed: number
}

interface BottomTimelineProps {
  isOpen: boolean
  onToggle: () => void
  nodes: TimelineNode[]
  bpm: number
  isPlaying: boolean
  currentCycle: number
  onNodeSelect: (nodeId: string) => void
  selectedNodeId: string | null
  onDeleteNode?: (nodeId: string) => void
  onToggleMute?: (nodeId: string) => void
  onToggleSolo?: (nodeId: string) => void
  onAddNode?: (template: string) => void
  onOpenEditor?: (nodeId: string, type: string) => void
}

const LABEL_W = 140
const BARS_VISIBLE = 8
const MIN_HEIGHT = 80
const MAX_HEIGHT = 420
const DEFAULT_HEIGHT = 200
const TRACK_H = 34

export default function BottomTimeline({
  isOpen, onToggle, nodes, bpm, isPlaying, currentCycle,
  onNodeSelect, selectedNodeId,
  onDeleteNode, onToggleMute, onToggleSolo,
  onAddNode, onOpenEditor,
}: BottomTimelineProps) {

  const [height, setHeight] = useState(DEFAULT_HEIGHT)
  const [showAddMenu, setShowAddMenu] = useState(false)
  const [mutedBars, setMutedBars] = useState<Map<string, Set<number>>>(new Map())
  const dragRef = useRef<{ startY: number; startH: number } | null>(null)
  const addMenuRef = useRef<HTMLDivElement>(null)

  // ── Close add menu on outside click ──
  useEffect(() => {
    if (!showAddMenu) return
    const handler = (e: MouseEvent) => {
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) {
        setShowAddMenu(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showAddMenu])

  // ── Resize from top edge ──
  const onResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragRef.current = { startY: e.clientY, startH: height }
    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return
      const delta = dragRef.current.startY - ev.clientY
      setHeight(Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, dragRef.current.startH + delta)))
    }
    const onUp = () => {
      dragRef.current = null
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [height])

  // ── Toggle bar mute ──
  const toggleBarMute = useCallback((nodeId: string, barIndex: number) => {
    setMutedBars(prev => {
      const next = new Map(prev)
      const set = new Set(next.get(nodeId) || [])
      if (set.has(barIndex)) {
        set.delete(barIndex)
      } else {
        set.add(barIndex)
      }
      if (set.size === 0) {
        next.delete(nodeId)
      } else {
        next.set(nodeId, set)
      }
      return next
    })
  }, [])

  // ── Playhead position (fractional) ──
  const playheadFrac = useMemo(() => {
    if (!isPlaying) return -1
    return currentCycle % BARS_VISIBLE
  }, [currentCycle, isPlaying])

  const currentBarIndex = useMemo(() => {
    if (!isPlaying) return -1
    return Math.floor(currentCycle % BARS_VISIBLE)
  }, [currentCycle, isPlaying])

  // ── Collapsed state: thin bar ──
  if (!isOpen) {
    return (
      <div className="shrink-0">
        <button onClick={onToggle}
          className="w-full flex items-center justify-center gap-2 py-1 cursor-pointer transition-colors"
          style={{
            background: '#0c0c0f',
            borderTop: '1px solid rgba(255,255,255,0.04)',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = '#131316' }}
          onMouseLeave={e => { e.currentTarget.style.background = '#0c0c0f' }}>
          <span className="text-[7px] font-bold tracking-[0.2em] uppercase" style={{ color: '#22d3ee60' }}>
            ▲ TIMELINE
          </span>
          <span className="text-[7px]" style={{ color: '#333' }}>
            {nodes.length} tracks
          </span>
        </button>
      </div>
    )
  }

  return (
    <div className="shrink-0 flex flex-col" style={{ height, background: '#08080a' }}>

      {/* ═══ RESIZE HANDLE ═══ */}
      <div
        className="w-full flex items-center justify-center cursor-ns-resize group shrink-0"
        style={{ height: 5, background: '#0e0e11', borderTop: '1px solid rgba(255,255,255,0.06)' }}
        onMouseDown={onResizeStart}>
        <div className="w-12 h-[2px] rounded-full transition-colors"
          style={{ background: 'rgba(255,255,255,0.08)' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(34,211,238,0.3)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)' }}
        />
      </div>

      {/* ═══ HEADER ═══ */}
      <div className="flex items-center justify-between px-3 py-1.5 shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: '#0e0e11' }}>
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-bold tracking-[0.15em] uppercase" style={{ color: '#22d3ee' }}>
            TIMELINE
          </span>
          <span className="text-[8px] px-1.5 py-0.5 rounded" style={{ color: '#555', background: '#1a1a1e' }}>
            {nodes.length} tracks
          </span>
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full" style={{
              background: isPlaying ? '#22d3ee' : '#333',
              boxShadow: isPlaying ? '0 0 6px #22d3ee50' : 'none',
            }} />
            <span className="text-[8px] font-mono" style={{ color: isPlaying ? '#22d3ee' : '#555' }}>
              {bpm} bpm
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Add node button */}
          {onAddNode && (
            <div className="relative" ref={addMenuRef}>
              <button onClick={() => setShowAddMenu(p => !p)}
                className="flex items-center gap-1 px-2 py-1 rounded text-[8px] font-bold tracking-wider cursor-pointer transition-colors"
                style={{
                  background: showAddMenu ? 'rgba(34,211,238,0.12)' : 'rgba(34,211,238,0.06)',
                  border: '1px solid rgba(34,211,238,0.15)',
                  color: '#22d3ee',
                }}>
                + ADD
              </button>
              {showAddMenu && (
                <div className="absolute bottom-full right-0 mb-1 min-w-[140px] rounded-lg shadow-2xl overflow-hidden z-50"
                  style={{ background: '#131316', border: '1px solid rgba(255,255,255,0.08)' }}>
                  {ADD_MENU_ITEMS.map(item => {
                    const c = TYPE_COLORS[item.key] || '#94a3b8'
                    return (
                      <button key={item.key}
                        onClick={() => { onAddNode(item.key); setShowAddMenu(false) }}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-[9px] cursor-pointer transition-colors"
                        style={{ color: '#999' }}
                        onMouseEnter={e => { e.currentTarget.style.background = `${c}10`; e.currentTarget.style.color = c }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#999' }}>
                        <span style={{ color: c, fontSize: 8 }}>{item.icon}</span>
                        {item.label}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}
          {/* Minimize */}
          <button onClick={onToggle}
            className="w-5 h-5 flex items-center justify-center rounded cursor-pointer text-[10px]"
            style={{ color: '#555', background: '#1a1a1e', border: '1px solid rgba(255,255,255,0.05)' }}>
            ▼
          </button>
        </div>
      </div>

      {/* ═══ BAR RULER + TRACK ROWS ═══ */}
      <div className="flex-1 flex flex-col min-h-0">

        {/* Bar number ruler */}
        <div className="flex shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
          {/* Spacer for track labels */}
          <div className="shrink-0 flex items-center px-2" style={{
            width: LABEL_W,
            borderRight: '1px solid rgba(255,255,255,0.04)',
            height: 18,
          }}>
            <span className="text-[6px] font-bold uppercase tracking-wider" style={{ color: '#333' }}>TRACK</span>
          </div>
          {/* Bar numbers */}
          <div className="flex-1 flex">
            {Array.from({ length: BARS_VISIBLE }, (_, i) => {
              const isCurrentBar = currentBarIndex === i
              return (
                <div key={i} className="flex-1 flex items-center justify-center text-[7px] font-mono"
                  style={{
                    height: 18,
                    color: isCurrentBar ? '#22d3ee' : '#333',
                    borderRight: i < BARS_VISIBLE - 1 ? '1px solid rgba(255,255,255,0.03)' : undefined,
                    background: isCurrentBar ? 'rgba(34,211,238,0.06)' : i % 2 === 0 ? 'rgba(255,255,255,0.008)' : 'transparent',
                    fontWeight: isCurrentBar ? 700 : 400,
                  }}>
                  {i + 1}
                </div>
              )
            })}
          </div>
        </div>

        {/* Track rows (scrollable) */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden relative"
          style={{ scrollbarWidth: 'thin', scrollbarColor: '#22d3ee30 transparent' }}>
          {nodes.map(node => {
            const color = TYPE_COLORS[node.type] || '#94a3b8'
            const icon = TYPE_ICONS[node.type] || '◉'
            const isSelected = selectedNodeId === node.id
            const nodeMutedBars = mutedBars.get(node.id) || new Set<number>()
            const patternSubs = parsePatternSubdivisions(node.pattern, node.speed)

            return (
              <div key={node.id} className="flex"
                style={{
                  height: TRACK_H,
                  borderBottom: '1px solid rgba(255,255,255,0.02)',
                  opacity: node.muted ? 0.3 : 1,
                }}>

                {/* ── Track label ── */}
                <div
                  className="shrink-0 flex items-center gap-1 px-2 cursor-pointer transition-colors overflow-hidden"
                  style={{
                    width: LABEL_W,
                    borderRight: isSelected ? `2px solid ${color}` : '1px solid rgba(255,255,255,0.04)',
                    background: isSelected ? `${color}06` : 'transparent',
                  }}
                  onClick={() => onNodeSelect(node.id)}
                  onDoubleClick={() => onOpenEditor?.(node.id, node.type)}>

                  <span className="text-[8px] shrink-0" style={{ color }}>{icon}</span>
                  <span className="text-[8px] font-medium truncate flex-1"
                    style={{ color: isSelected ? color : '#777' }}>
                    {node.name || 'Untitled'}
                  </span>

                  {/* M / S / X controls */}
                  <div className="flex items-center gap-px shrink-0">
                    {onToggleMute && (
                      <button
                        className="w-4 h-4 flex items-center justify-center rounded text-[6px] font-black cursor-pointer"
                        style={{
                          background: node.muted ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.04)',
                          color: node.muted ? '#ef4444' : '#444',
                        }}
                        onClick={e => { e.stopPropagation(); onToggleMute(node.id) }}
                        title={node.muted ? 'Unmute' : 'Mute'}>
                        M
                      </button>
                    )}
                    {onToggleSolo && (
                      <button
                        className="w-4 h-4 flex items-center justify-center rounded text-[6px] font-black cursor-pointer"
                        style={{
                          background: node.solo ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.04)',
                          color: node.solo ? '#f59e0b' : '#444',
                        }}
                        onClick={e => { e.stopPropagation(); onToggleSolo(node.id) }}
                        title={node.solo ? 'Unsolo' : 'Solo'}>
                        S
                      </button>
                    )}
                    {onDeleteNode && (
                      <button
                        className="w-4 h-4 flex items-center justify-center rounded text-[6px] cursor-pointer"
                        style={{ background: 'rgba(255,255,255,0.04)', color: '#444' }}
                        onClick={e => { e.stopPropagation(); onDeleteNode(node.id) }}
                        title="Remove track">
                        ✕
                      </button>
                    )}
                  </div>
                </div>

                {/* ── Bar cells ── */}
                <div className="flex-1 flex relative">
                  {Array.from({ length: BARS_VISIBLE }, (_, barIdx) => {
                    const isBarMuted = nodeMutedBars.has(barIdx)
                    const isCurrentBar = currentBarIndex === barIdx
                    const subs = patternSubs

                    return (
                      <div key={barIdx}
                        className="flex-1 relative cursor-pointer group"
                        style={{
                          borderRight: barIdx < BARS_VISIBLE - 1 ? '1px solid rgba(255,255,255,0.03)' : undefined,
                          background: isBarMuted
                            ? 'rgba(239,68,68,0.04)'
                            : isCurrentBar
                              ? 'rgba(34,211,238,0.04)'
                              : barIdx % 2 === 0
                                ? 'rgba(255,255,255,0.008)'
                                : 'transparent',
                        }}
                        onClick={(e) => { e.stopPropagation(); toggleBarMute(node.id, barIdx) }}
                        title={isBarMuted ? 'Click to unmute bar' : 'Click to mute bar'}>

                        {/* Pattern block inside bar */}
                        {!isBarMuted && (
                          <div className="absolute rounded-sm"
                            style={{
                              left: 2,
                              right: 2,
                              top: 4,
                              bottom: 4,
                              background: node.muted ? '#222' : `${color}25`,
                              border: `1px solid ${node.muted ? '#333' : `${color}35`}`,
                              boxShadow: isPlaying && isCurrentBar && !node.muted ? `0 0 6px ${color}15` : 'none',
                            }}>
                            {/* Subdivision dots */}
                            <div className="absolute inset-0 flex items-center px-0.5 overflow-hidden">
                              {subs.map((active, j) => (
                                <div key={j} className="h-[3px] rounded-full mx-px"
                                  style={{
                                    width: `${100 / Math.max(subs.length, 1)}%`,
                                    background: active ? `${color}80` : 'transparent',
                                  }} />
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Muted bar indicator */}
                        {isBarMuted && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-[7px] font-bold" style={{ color: '#ef444460' }}>✕</span>
                          </div>
                        )}

                        {/* Hover hint */}
                        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                          style={{ background: isBarMuted ? 'rgba(34,211,238,0.06)' : 'rgba(239,68,68,0.06)' }}>
                          <span className="text-[5px] font-bold uppercase"
                            style={{ color: isBarMuted ? '#22d3ee80' : '#ef444480' }}>
                            {isBarMuted ? 'unmute' : 'mute'}
                          </span>
                        </div>
                      </div>
                    )
                  })}

                  {/* Playhead line */}
                  {isPlaying && playheadFrac >= 0 && (
                    <div className="absolute top-0 bottom-0 w-px z-10 pointer-events-none"
                      style={{
                        left: `${(playheadFrac / BARS_VISIBLE) * 100}%`,
                        background: '#22d3ee',
                        boxShadow: '0 0 4px #22d3ee50',
                      }} />
                  )}
                </div>
              </div>
            )
          })}

          {/* Empty state */}
          {nodes.length === 0 && (
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <span className="text-lg opacity-10">🎵</span>
                <p className="text-[9px] mt-1" style={{ color: '#333' }}>
                  No tracks — click <span style={{ color: '#22d3ee' }}>+ ADD</span> to create one
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ═══ FOOTER ═══ */}
      <div className="flex items-center justify-between px-3 py-1 shrink-0"
        style={{ borderTop: '1px solid rgba(255,255,255,0.04)', background: '#0e0e11' }}>
        <span className="text-[7px]" style={{ color: '#333' }}>
          click bar to mute · double-click track to open editor · drag top edge to resize
        </span>
        <span className="text-[7px] font-mono" style={{ color: '#22d3ee40' }}>
          {BARS_VISIBLE} bars
        </span>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
//  PATTERN PARSER — extracts subdivision info for visualization
// ═══════════════════════════════════════════════════════════════

function parsePatternSubdivisions(pattern: string, _speed: number): boolean[] {
  if (!pattern) {
    return [true, true, true, true]
  }

  const clean = pattern.replace(/^<\s*/, '').replace(/\s*>$/, '').trim()
  const parts = splitTopLevel(clean)

  if (parts.length === 0) return [true]

  // Each top-level token becomes a subdivision
  const subs: boolean[] = []
  for (let i = 0; i < Math.min(parts.length, 16); i++) {
    subs.push(parts[i] !== '~')
  }
  return subs
}

function splitTopLevel(str: string): string[] {
  const parts: string[] = []
  let depth = 0
  let current = ''

  for (const ch of str) {
    if (ch === '[' || ch === '<' || ch === '(') depth++
    if (ch === ']' || ch === '>' || ch === ')') depth--
    if ((ch === ' ' || ch === ',') && depth === 0) {
      if (current.trim()) parts.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }
  if (current.trim()) parts.push(current.trim())
  return parts
}
