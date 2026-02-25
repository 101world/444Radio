'use client'

import { useRef, useMemo } from 'react'

// ═══════════════════════════════════════════════════════════════
//  TIMELINE SIDEBAR — visual representation of all nodes on time
//
//  Each node gets a horizontal track showing when it plays.
//  The sidebar is fully collapsible.
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
  drums: '⬤', bass: '◆', melody: '▲', chords: '■', fx: '✦', vocal: '●', pad: '◈', other: '◉',
}

interface TimelineNode {
  id: string
  name: string
  type: string
  muted: boolean
  solo: boolean
  pattern: string
  speed: number   // .slow() factor
}

interface TimelineSidebarProps {
  isOpen: boolean
  onToggle: () => void
  nodes: TimelineNode[]
  bpm: number
  isPlaying: boolean
  currentCycle: number   // current playback cycle position (0-based)
  onNodeSelect: (nodeId: string) => void
  selectedNodeId: string | null
  onDeleteNode?: (nodeId: string) => void
  onToggleMute?: (nodeId: string) => void
  onToggleSolo?: (nodeId: string) => void
}

const TRACK_H = 36
const CYCLES_VISIBLE = 8  // how many cycles to show in the timeline
const CELL_W = 60

export default function TimelineSidebar({
  isOpen, onToggle, nodes, bpm, isPlaying, currentCycle, onNodeSelect, selectedNodeId,
  onDeleteNode, onToggleMute, onToggleSolo,
}: TimelineSidebarProps) {

  const scrollRef = useRef<HTMLDivElement>(null)

  // Calculate the playhead position (smooth fractional)
  const playheadX = useMemo(() => {
    if (!isPlaying) return 0
    return (currentCycle % CYCLES_VISIBLE) * CELL_W
  }, [currentCycle, isPlaying])

  const totalW = CYCLES_VISIBLE * CELL_W

  if (!isOpen) {
    return (
      <button onClick={onToggle}
        className="fixed right-0 top-1/2 -translate-y-1/2 z-40 flex items-center gap-1 px-1.5 py-6 rounded-l-lg cursor-pointer"
        style={{
          background: '#131316', border: '1px solid rgba(255,255,255,0.05)',
          borderRight: 'none', writingMode: 'vertical-rl',
        }}>
        <span className="text-[8px] font-bold tracking-[0.2em] uppercase"
          style={{ color: '#22d3ee' }}>TIMELINE</span>
      </button>
    )
  }

  return (
    <div className="fixed right-0 top-0 bottom-0 z-40 flex flex-col"
      style={{
        width: 320,
        background: '#0a0a0c',
        borderLeft: '1px solid rgba(255,255,255,0.06)',
        boxShadow: '-4px 0 20px rgba(0,0,0,0.5)',
      }}>

      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: '#131316' }}>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold tracking-[0.15em] uppercase" style={{ color: '#22d3ee' }}>
            TIMELINE
          </span>
          <span className="text-[8px] px-1.5 py-0.5 rounded" style={{ color: '#555', background: '#1a1a1e' }}>
            {nodes.length} tracks
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full" style={{
              background: isPlaying ? '#22d3ee' : '#333',
              boxShadow: isPlaying ? '0 0 6px #22d3ee50' : 'none',
            }} />
            <span className="text-[8px] font-mono" style={{ color: isPlaying ? '#22d3ee' : '#555' }}>
              {bpm} bpm
            </span>
          </div>
          <button onClick={onToggle}
            className="w-5 h-5 flex items-center justify-center rounded cursor-pointer text-[10px]"
            style={{ color: '#555', background: '#1a1a1e', border: '1px solid rgba(255,255,255,0.05)' }}>
            ✕
          </button>
        </div>
      </div>

      {/* Cycle header */}
      <div className="flex shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        {/* Track label column */}
        <div className="shrink-0" style={{ width: 100, borderRight: '1px solid rgba(255,255,255,0.04)' }}>
          <div className="h-5 flex items-center px-2">
            <span className="text-[6px] font-bold uppercase tracking-wider" style={{ color: '#333' }}>TRACK</span>
          </div>
        </div>
        {/* Cycle numbers */}
        <div className="flex-1 overflow-hidden">
          <div className="flex relative" style={{ width: totalW }}>
            {Array.from({ length: CYCLES_VISIBLE }, (_, i) => {
              const isCurrentBar = isPlaying && Math.floor(currentCycle % CYCLES_VISIBLE) === i
              return (
                <div key={i} className="flex items-center justify-center text-[7px] font-mono"
                  style={{
                    width: CELL_W, height: 20,
                    color: isCurrentBar ? '#22d3ee' : '#333',
                    borderRight: '1px solid rgba(255,255,255,0.03)',
                    background: isCurrentBar ? 'rgba(34,211,238,0.08)' : i % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent',
                    fontWeight: isCurrentBar ? 700 : 400,
                  }}>
                  {i + 1}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Track rows */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden"
        style={{ scrollbarWidth: 'thin', scrollbarColor: '#22d3ee30 transparent' }}>
        {nodes.map(node => {
          const color = TYPE_COLORS[node.type] || '#94a3b8'
          const icon = TYPE_ICONS[node.type] || '◉'
          const isSelected = selectedNodeId === node.id
          const patternBlocks = generatePatternBlocks(node.pattern, node.speed)

          return (
            <div key={node.id} className="flex cursor-pointer transition-colors"
              style={{
                height: TRACK_H,
                background: isSelected ? `${color}08` : 'transparent',
                borderBottom: '1px solid rgba(255,255,255,0.02)',
                opacity: node.muted ? 0.25 : 1,
              }}
              onClick={() => onNodeSelect(node.id)}>

              {/* Track label */}
              <div className="shrink-0 flex items-center gap-1 px-1.5 overflow-hidden"
                style={{
                  width: 100,
                  borderRight: isSelected ? `2px solid ${color}` : '1px solid rgba(255,255,255,0.04)',
                }}>
                <span className="text-[8px] shrink-0" style={{ color }}>{icon}</span>
                <span className="text-[8px] font-medium truncate flex-1" style={{ color: isSelected ? color : '#777' }}>
                  {node.name || 'Untitled'}
                </span>
                <div className="flex items-center gap-px shrink-0">
                  {onToggleMute && (
                    <button
                      className="w-3.5 h-3.5 flex items-center justify-center rounded text-[6px] font-black cursor-pointer"
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
                      className="w-3.5 h-3.5 flex items-center justify-center rounded text-[6px] font-black cursor-pointer"
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
                      className="w-3.5 h-3.5 flex items-center justify-center rounded text-[6px] cursor-pointer"
                      style={{ background: 'rgba(255,255,255,0.04)', color: '#444' }}
                      onClick={e => { e.stopPropagation(); onDeleteNode(node.id) }}
                      title="Remove track">
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* Pattern visualization */}
              <div className="flex-1 overflow-hidden relative">
                <div className="relative h-full" style={{ width: totalW }}>
                  {/* Pattern blocks */}
                  {patternBlocks.map((block, i) => (
                    <div key={i} className="absolute rounded-sm"
                      style={{
                        left: block.start * CELL_W,
                        width: Math.max(block.duration * CELL_W - 2, 4),
                        top: 4,
                        height: TRACK_H - 8,
                        background: node.muted ? '#333' : `${color}40`,
                        border: `1px solid ${node.muted ? '#444' : `${color}60`}`,
                        boxShadow: isPlaying && !node.muted ? `0 0 4px ${color}20` : 'none',
                      }}>
                      {/* Inner pattern detail */}
                      {block.hasNotes && (
                        <div className="absolute inset-0 flex items-center px-1 overflow-hidden">
                          {block.subdivisions.map((sub, j) => (
                            <div key={j} className="h-2 rounded-sm mx-px"
                              style={{
                                width: `${100 / Math.max(block.subdivisions.length, 1)}%`,
                                background: sub ? `${color}90` : 'transparent',
                              }} />
                          ))}
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Playhead + current bar highlight */}
                  {isPlaying && (
                    <>
                      {/* Current bar highlight */}
                      <div className="absolute top-0 bottom-0 pointer-events-none"
                        style={{
                          left: Math.floor(currentCycle % CYCLES_VISIBLE) * CELL_W,
                          width: CELL_W,
                          background: 'rgba(34,211,238,0.04)',
                        }} />
                      {/* Playhead line */}
                      <div className="absolute top-0 bottom-0 w-px z-10"
                        style={{
                          left: playheadX,
                          background: '#22d3ee',
                          boxShadow: '0 0 4px #22d3ee50',
                        }} />
                    </>
                  )}

                  {/* Grid lines */}
                  {Array.from({ length: CYCLES_VISIBLE }, (_, i) => (
                    <div key={i} className="absolute top-0 bottom-0 w-px"
                      style={{
                        left: i * CELL_W,
                        background: i % 4 === 0 ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.02)',
                      }} />
                  ))}
                </div>
              </div>
            </div>
          )
        })}

        {/* Empty state */}
        {nodes.length === 0 && (
          <div className="flex items-center justify-center py-12">
            <span className="text-[10px]" style={{ color: '#333' }}>No tracks</span>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-3 py-1.5 shrink-0"
        style={{ borderTop: '1px solid rgba(255,255,255,0.04)', background: '#131316' }}>
        <span className="text-[7px]" style={{ color: '#333' }}>
          Click a track to select node · Muted tracks dimmed
        </span>
        <span className="text-[7px] font-mono" style={{ color: '#22d3ee60' }}>
          {CYCLES_VISIBLE} cycles
        </span>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
//  PATTERN BLOCK GENERATOR
//
//  Converts Strudel patterns into visual blocks for timeline view.
//  Each block represents a rhythmic event or group.
// ═══════════════════════════════════════════════════════════════

interface PatternBlock {
  start: number         // cycle position (0-based)
  duration: number      // in cycles
  hasNotes: boolean
  subdivisions: boolean[] // inner rhythmic detail
}

function generatePatternBlocks(pattern: string, speed: number): PatternBlock[] {
  if (!pattern) {
    // Default: fill all cycles with a single block
    return Array.from({ length: CYCLES_VISIBLE }, (_, i) => ({
      start: i,
      duration: 1,
      hasNotes: true,
      subdivisions: [true, true, true, true],
    }))
  }

  const blocks: PatternBlock[] = []

  // Parse simple pattern structure
  const clean = pattern.replace(/^<\s*/, '').replace(/\s*>$/, '').trim()
  const parts = splitTopLevel(clean)

  if (parts.length === 0) return blocks

  // Each part represents a subdivision of one cycle
  const cyclesPerRepeat = speed || 1
  const partsPerCycle = parts.length

  for (let cycle = 0; cycle < CYCLES_VISIBLE; cycle++) {
    const subdivisions: boolean[] = []
    for (let p = 0; p < Math.min(partsPerCycle, 16); p++) {
      const part = parts[p % parts.length]
      subdivisions.push(part !== '~')
    }

    const hasAnyNotes = subdivisions.some(s => s)
    blocks.push({
      start: cycle,
      duration: 1,
      hasNotes: hasAnyNotes,
      subdivisions,
    })
  }

  return blocks
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
