'use client'

// ═══════════════════════════════════════════════════════════════
//  ARRANGEMENT TIMELINE — Strudel-native section sequencer
//
//  Full DAW-style arrangement: per-section pattern variants,
//  drag-to-resize sections, clip-based channel assignment,
//  and Strudel-native arrange() code generation.
//
//  Each section can have a different pattern variant per channel.
//  Generates proper Strudel code:
//    let bass_v = note("c2 e2 g2 b2")
//    let bass_c = note("c2 c3 g2 g3")
//    $:arrange([4, stack(bass_v, drums)], [4, stack(bass_c, drums)])
// ═══════════════════════════════════════════════════════════════

import { useState, useRef, useEffect, useCallback, memo, useMemo } from 'react'
import { Plus, X, ChevronUp, ChevronDown, Layers, Copy, Music } from 'lucide-react'
import type { ParsedChannel } from '@/lib/strudel-code-parser'

// ─── Types ───

/** A pattern variant: a named version of a channel's pattern */
export interface PatternVariant {
  id: string
  name: string          // e.g. "verse", "chorus", "bridge"
  pattern: string       // the Strudel mini-notation pattern
  channelIdx: number    // which channel this belongs to
}

export interface ArrangementSection {
  id: string
  name: string
  bars: number
  activeChannels: Set<number>           // which channel indices are active
  /** Per-channel variant overrides: channelIdx → variantId. If not set, uses default pattern */
  clipVariants: Map<number, string>
}

interface ArrangementTimelineProps {
  channels: ParsedChannel[]
  sections: ArrangementSection[]
  isOpen: boolean
  isPlaying: boolean
  currentBar?: number
  onToggle: () => void
  onSectionsChange: (sections: ArrangementSection[]) => void
  /** Pattern variants: all available variants across channels */
  patternVariants?: PatternVariant[]
  onPatternVariantsChange?: (variants: PatternVariant[]) => void
  /** Create a new variant from the current channel pattern */
  onCreateVariant?: (channelIdx: number, name: string) => void
}

// ─── Constants ───
const LABEL_W = 100
const MIN_CELL_W = 28
const SECTION_HEADER_H = 32
const ROW_H = 26
const MIN_HEIGHT = 60
const MAX_HEIGHT = 500
const DEFAULT_HEIGHT = 200
const MIN_SECTION_BARS = 1
const MAX_SECTION_BARS = 64

const SECTION_COLORS = [
  '#22d3ee', '#a78bfa', '#f97316', '#10b981', '#f43f5e',
  '#eab308', '#3b82f6', '#ec4899', '#14b8a6', '#8b5cf6',
]

const SECTION_NAMES = [
  'Intro', 'Verse', 'Build', 'Chorus', 'Bridge', 'Drop', 'Break', 'Outro',
]

let sectionIdCounter = 0
function nextSectionId() {
  return `sec-${++sectionIdCounter}`
}

let variantIdCounter = 0
export function nextVariantId() {
  return `var-${++variantIdCounter}`
}

// ─── Component ───
const ArrangementTimeline = memo(function ArrangementTimeline({
  channels,
  sections,
  isOpen,
  isPlaying,
  currentBar,
  onToggle,
  onSectionsChange,
  patternVariants = [],
  onPatternVariantsChange,
  onCreateVariant,
}: ArrangementTimelineProps) {
  const [height, setHeight] = useState(DEFAULT_HEIGHT)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const renameRef = useRef<HTMLInputElement>(null)
  const dragRef = useRef<{ startY: number; startH: number } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Drag-to-resize section state
  const resizeDragRef = useRef<{
    sectionIdx: number
    startX: number
    startBars: number
    pixelsPerBar: number
  } | null>(null)

  // Variant picker state
  const [variantPicker, setVariantPicker] = useState<{ sectionId: string; channelIdx: number } | null>(null)

  // Focus rename input
  useEffect(() => {
    if (renamingId && renameRef.current) renameRef.current.focus()
  }, [renamingId])

  // Close variant picker on click outside
  useEffect(() => {
    if (!variantPicker) return
    const handler = () => setVariantPicker(null)
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [variantPicker])

  // ── Resize from top edge (panel height) ──
  const onResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
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

  // ── Section CRUD ──
  const addSection = useCallback(() => {
    const idx = sections.length
    const name = SECTION_NAMES[idx % SECTION_NAMES.length]
    const activeChannels = new Set(channels.map((_, i) => i))
    onSectionsChange([...sections, {
      id: nextSectionId(),
      name,
      bars: 4,
      activeChannels,
      clipVariants: new Map(),
    }])
  }, [sections, channels, onSectionsChange])

  const duplicateSection = useCallback((id: string) => {
    const src = sections.find(s => s.id === id)
    if (!src) return
    const idx = sections.indexOf(src)
    const copy: ArrangementSection = {
      id: nextSectionId(),
      name: `${src.name} (copy)`,
      bars: src.bars,
      activeChannels: new Set(src.activeChannels),
      clipVariants: new Map(src.clipVariants),
    }
    const next = [...sections]
    next.splice(idx + 1, 0, copy)
    onSectionsChange(next)
  }, [sections, onSectionsChange])

  const removeSection = useCallback((id: string) => {
    onSectionsChange(sections.filter(s => s.id !== id))
  }, [sections, onSectionsChange])

  const updateSection = useCallback((id: string, patch: Partial<ArrangementSection>) => {
    onSectionsChange(sections.map(s => s.id === id ? { ...s, ...patch } : s))
  }, [sections, onSectionsChange])

  const toggleCell = useCallback((sectionId: string, channelIdx: number) => {
    onSectionsChange(sections.map(s => {
      if (s.id !== sectionId) return s
      const next = new Set(s.activeChannels)
      if (next.has(channelIdx)) next.delete(channelIdx)
      else next.add(channelIdx)
      return { ...s, activeChannels: next }
    }))
  }, [sections, onSectionsChange])

  /** Set a variant for a specific channel in a specific section */
  const setClipVariant = useCallback((sectionId: string, channelIdx: number, variantId: string | null) => {
    onSectionsChange(sections.map(s => {
      if (s.id !== sectionId) return s
      const clips = new Map(s.clipVariants)
      if (variantId === null) clips.delete(channelIdx)
      else clips.set(channelIdx, variantId)
      return { ...s, clipVariants: clips }
    }))
    setVariantPicker(null)
  }, [sections, onSectionsChange])

  const commitRename = useCallback(() => {
    if (renamingId && renameValue.trim()) {
      updateSection(renamingId, { name: renameValue.trim() })
    }
    setRenamingId(null)
  }, [renamingId, renameValue, updateSection])

  // ── Drag-to-resize section bars ──
  const onSectionResizeStart = useCallback((e: React.MouseEvent, sectionIdx: number) => {
    e.preventDefault()
    e.stopPropagation()

    const gridEl = containerRef.current
    if (!gridEl) return

    const section = sections[sectionIdx]
    const sectionEls = gridEl.querySelectorAll('[data-section-col]')
    const el = sectionEls[sectionIdx] as HTMLElement | undefined
    const pixelsPerBar = el ? el.offsetWidth / section.bars : 40

    resizeDragRef.current = {
      sectionIdx,
      startX: e.clientX,
      startBars: section.bars,
      pixelsPerBar,
    }

    const onMove = (ev: MouseEvent) => {
      if (!resizeDragRef.current) return
      const dx = ev.clientX - resizeDragRef.current.startX
      const barDelta = Math.round(dx / resizeDragRef.current.pixelsPerBar)
      const newBars = Math.max(MIN_SECTION_BARS, Math.min(MAX_SECTION_BARS,
        resizeDragRef.current.startBars + barDelta))

      const updated = [...sections]
      updated[resizeDragRef.current.sectionIdx] = {
        ...updated[resizeDragRef.current.sectionIdx],
        bars: newBars,
      }
      onSectionsChange(updated)
    }

    const onUp = () => {
      resizeDragRef.current = null
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [sections, onSectionsChange])

  // ── Compute total bars for playback cursor ──
  const totalBars = sections.reduce((sum, s) => sum + s.bars, 0)

  // ── Find which section the cursor is in ──
  let cursorSectionIdx = -1
  let cursorBarInSection = 0
  if (currentBar !== undefined && currentBar >= 0) {
    let barAcc = 0
    for (let i = 0; i < sections.length; i++) {
      if (currentBar < barAcc + sections[i].bars) {
        cursorSectionIdx = i
        cursorBarInSection = currentBar - barAcc
        break
      }
      barAcc += sections[i].bars
    }
  }

  // ── Group variants by channel ──
  const variantsByChannel = useMemo(() => {
    const map = new Map<number, PatternVariant[]>()
    for (const v of patternVariants) {
      const list = map.get(v.channelIdx) || []
      list.push(v)
      map.set(v.channelIdx, list)
    }
    return map
  }, [patternVariants])

  if (!isOpen) {
    return (
      <button
        onClick={onToggle}
        className="flex items-center gap-2 w-full py-2 cursor-pointer transition-all hover:bg-cyan-500/10 group"
        style={{ background: 'linear-gradient(to right, #0d0e14, #0f1018)', borderTop: '1px solid rgba(0,229,199,0.15)' }}
      >
        <ChevronUp size={11} className="text-cyan-400/40 ml-3 group-hover:text-cyan-400/80 transition-colors" />
        <Layers size={11} className="text-cyan-400/70" />
        <span className="text-[9px] font-bold text-white/40 uppercase tracking-widest group-hover:text-white/70 transition-colors">
          Arrangement
        </span>
        {sections.length > 0 && (
          <span className="text-[8px] font-mono text-cyan-400/50 bg-cyan-400/[0.06] px-1.5 py-0.5 rounded">
            {sections.length} sections · {totalBars} bars
          </span>
        )}
      </button>
    )
  }

  return (
    <div className="flex flex-col" style={{ height, borderTop: '1px solid rgba(0,229,199,0.12)' }}>
      {/* ── Resize handle (panel height) ── */}
      <div
        className="h-1.5 cursor-ns-resize flex items-center justify-center hover:bg-cyan-500/10 transition-colors"
        style={{ background: '#0b0c10' }}
        onMouseDown={onResizeStart}
      >
        <div className="w-8 h-0.5 rounded-full bg-white/10" />
      </div>

      {/* ── Header ── */}
      <div className="flex items-center gap-2 px-3 py-1 shrink-0" style={{ background: '#0c0d12', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        <button onClick={onToggle} className="text-white/20 hover:text-white/40 transition-colors" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
          <ChevronDown size={10} />
        </button>
        <Layers size={10} className="text-cyan-400/70" />
        <span className="text-[9px] font-bold text-white/50 uppercase tracking-wider">Arrangement</span>
        <span className="text-[8px] text-white/20 font-mono">{totalBars} bars</span>
        <div className="flex-1" />
        <button
          onClick={addSection}
          className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[8px] font-bold transition-all hover:bg-cyan-500/15 cursor-pointer"
          style={{ color: '#00e5c7', background: 'rgba(0,229,199,0.06)', border: '1px solid rgba(0,229,199,0.15)' }}
        >
          <Plus size={8} /> Section
        </button>
      </div>

      {/* ── Grid ── */}
      <div ref={containerRef} className="flex-1 overflow-auto" style={{ background: '#0a0b0f' }}>
        {sections.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2">
            <Layers size={20} className="text-white/10" />
            <p className="text-[9px] text-white/20 font-medium">No arrangement sections yet</p>
            <button
              onClick={addSection}
              className="flex items-center gap-1 px-3 py-1 rounded-lg text-[9px] font-bold transition-all hover:bg-cyan-500/15 cursor-pointer"
              style={{ color: '#00e5c7', background: 'rgba(0,229,199,0.08)', border: '1px solid rgba(0,229,199,0.2)' }}
            >
              <Plus size={9} /> Add First Section
            </button>
          </div>
        ) : (
          <div className="flex h-full">
            {/* ── Channel labels (left column) ── */}
            <div className="shrink-0 flex flex-col" style={{ width: LABEL_W }}>
              {/* Corner cell */}
              <div className="shrink-0" style={{ height: SECTION_HEADER_H, background: '#0c0d12', borderBottom: '1px solid rgba(255,255,255,0.04)', borderRight: '1px solid rgba(255,255,255,0.04)' }} />
              {channels.map((ch, idx) => (
                <div
                  key={ch.id}
                  className="flex items-center gap-1.5 px-2 shrink-0 overflow-hidden"
                  style={{
                    height: ROW_H,
                    borderBottom: '1px solid rgba(255,255,255,0.02)',
                    borderRight: '1px solid rgba(255,255,255,0.04)',
                    background: '#0c0d12',
                  }}
                >
                  <span className="text-[8px]">{ch.icon}</span>
                  <span className="text-[7px] font-bold truncate" style={{ color: `${ch.color}90` }}>
                    {ch.name}
                  </span>
                  {/* Variant count badge */}
                  {(variantsByChannel.get(idx)?.length ?? 0) > 0 && (
                    <span className="ml-auto text-[6px] font-mono px-1 rounded"
                      style={{ color: `${ch.color}70`, background: `${ch.color}10` }}>
                      {variantsByChannel.get(idx)!.length}
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* ── Section columns ── */}
            <div className="flex-1 overflow-x-auto flex">
              {sections.map((section, sIdx) => {
                const sectionColor = SECTION_COLORS[sIdx % SECTION_COLORS.length]
                const isCursorHere = cursorSectionIdx === sIdx
                const barWidth = Math.max(MIN_CELL_W, Math.round(80 / Math.max(1, section.bars)))
                const sectionWidth = Math.max(section.bars * barWidth, 50)

                return (
                  <div key={section.id} data-section-col className="shrink-0 flex flex-col relative" style={{ width: sectionWidth }}>
                    {/* Section header */}
                    <div
                      className="shrink-0 flex items-center gap-1 px-1.5 relative group"
                      style={{
                        height: SECTION_HEADER_H,
                        background: isCursorHere
                          ? `linear-gradient(180deg, ${sectionColor}18 0%, ${sectionColor}08 100%)`
                          : `linear-gradient(180deg, ${sectionColor}0a 0%, transparent 100%)`,
                        borderBottom: `1px solid ${sectionColor}20`,
                        borderRight: '1px solid rgba(255,255,255,0.04)',
                      }}
                    >
                      {/* Section name (click to rename) */}
                      {renamingId === section.id ? (
                        <input
                          ref={renameRef}
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onBlur={commitRename}
                          onKeyDown={(e) => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setRenamingId(null) }}
                          className="text-[7px] font-bold bg-black/50 text-white/90 w-full px-1 py-0.5 rounded outline-none border border-cyan-500/30"
                          style={{ maxWidth: 60 }}
                        />
                      ) : (
                        <button
                          className="text-[7px] font-bold truncate cursor-pointer hover:underline transition-colors"
                          style={{ color: sectionColor, background: 'none', border: 'none', padding: 0 }}
                          onClick={() => { setRenamingId(section.id); setRenameValue(section.name) }}
                          title="Click to rename"
                        >
                          {section.name}
                        </button>
                      )}

                      {/* Bar count display */}
                      <span className="text-[7px] font-mono font-bold ml-1" style={{ color: `${sectionColor}70` }}>
                        {section.bars}b
                      </span>

                      {/* Action buttons */}
                      <div className="flex items-center gap-0.5 ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
                        {/* Duplicate */}
                        <button
                          className="w-3.5 h-3.5 rounded flex items-center justify-center cursor-pointer hover:bg-white/10 transition-colors"
                          style={{ color: '#fff6', background: 'none', border: 'none' }}
                          onClick={() => duplicateSection(section.id)}
                          title="Duplicate section"
                        >
                          <Copy size={7} />
                        </button>

                        {/* Delete */}
                        <button
                          className="w-3.5 h-3.5 rounded flex items-center justify-center cursor-pointer hover:bg-red-500/20"
                          style={{ color: '#b86f6f', background: 'none', border: 'none' }}
                          onClick={() => removeSection(section.id)}
                          title="Remove section"
                        >
                          <X size={7} />
                        </button>
                      </div>

                      {/* Playback cursor indicator */}
                      {isCursorHere && isPlaying && (
                        <div className="absolute bottom-0 left-0 h-0.5 transition-all duration-100"
                          style={{
                            width: `${((cursorBarInSection + 1) / section.bars) * 100}%`,
                            background: `linear-gradient(90deg, ${sectionColor}80, ${sectionColor})`,
                            boxShadow: `0 0 6px ${sectionColor}60`,
                          }}
                        />
                      )}
                    </div>

                    {/* Channel cells / clips */}
                    {channels.map((ch, chIdx) => {
                      const isActive = section.activeChannels.has(chIdx)
                      const clipVariantId = section.clipVariants.get(chIdx)
                      const clipVariant = clipVariantId ? patternVariants.find(v => v.id === clipVariantId) : null
                      const channelVariants = variantsByChannel.get(chIdx) || []
                      const isPickerOpen = variantPicker?.sectionId === section.id && variantPicker?.channelIdx === chIdx

                      return (
                        <div key={`${section.id}-${chIdx}`} className="relative">
                          <button
                            className="shrink-0 w-full cursor-pointer transition-all duration-100 hover:brightness-125 group/cell relative"
                            style={{
                              height: ROW_H,
                              background: isActive
                                ? clipVariant
                                  ? `linear-gradient(90deg, ${ch.color}28 0%, ${ch.color}18 50%, ${ch.color}28 100%)`
                                  : `linear-gradient(90deg, ${ch.color}20 0%, ${ch.color}12 50%, ${ch.color}20 100%)`
                                : 'transparent',
                              borderBottom: '1px solid rgba(255,255,255,0.02)',
                              borderRight: '1px solid rgba(255,255,255,0.04)',
                              border: 'none',
                              borderBlockEnd: '1px solid rgba(255,255,255,0.02)',
                              borderInlineEnd: '1px solid rgba(255,255,255,0.04)',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 2,
                              padding: '0 4px',
                            }}
                            onClick={() => toggleCell(section.id, chIdx)}
                            onContextMenu={(e) => {
                              e.preventDefault()
                              if (isActive && (channelVariants.length > 0 || onCreateVariant)) {
                                setVariantPicker(isPickerOpen ? null : { sectionId: section.id, channelIdx: chIdx })
                              }
                            }}
                          >
                            {/* Active block visual with variant info */}
                            {isActive && (
                              <>
                                <div className="absolute inset-y-0.5 inset-x-1 rounded-sm"
                                  style={{
                                    background: clipVariant
                                      ? `linear-gradient(90deg, ${ch.color}40 0%, ${ch.color}28 100%)`
                                      : `linear-gradient(90deg, ${ch.color}35 0%, ${ch.color}25 100%)`,
                                    boxShadow: `inset 0 0 4px ${ch.color}15`,
                                    border: `1px solid ${ch.color}${clipVariant ? '35' : '20'}`,
                                  }}
                                />
                                {/* Variant name label */}
                                {clipVariant && (
                                  <span className="relative z-[1] text-[6px] font-bold uppercase truncate pointer-events-none"
                                    style={{ color: `${ch.color}cc` }}>
                                    {clipVariant.name}
                                  </span>
                                )}
                                {/* Clip icon when variant is assigned */}
                                {clipVariant && (
                                  <Music size={7} className="relative z-[1] shrink-0 pointer-events-none"
                                    style={{ color: `${ch.color}80` }} />
                                )}
                              </>
                            )}

                            {/* Hover indicator when inactive */}
                            {!isActive && (
                              <div className="absolute inset-y-1 inset-x-1.5 rounded-sm opacity-0 group-hover/cell:opacity-100 transition-opacity"
                                style={{ background: `${ch.color}08`, border: `1px dashed ${ch.color}15` }}
                              />
                            )}
                          </button>

                          {/* ── Variant picker dropdown ── */}
                          {isPickerOpen && (
                            <div
                              className="absolute left-0 top-full z-50 min-w-[120px] max-w-[200px] rounded-md shadow-xl overflow-hidden"
                              style={{ background: '#14161c', border: '1px solid rgba(255,255,255,0.1)' }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              {/* Default (no variant) */}
                              <button
                                className="w-full px-2 py-1.5 text-left text-[7px] font-bold cursor-pointer hover:bg-white/5 transition-colors"
                                style={{
                                  color: !clipVariant ? ch.color : '#8a8f9a',
                                  background: !clipVariant ? `${ch.color}10` : 'transparent',
                                  border: 'none',
                                }}
                                onClick={(e) => { e.stopPropagation(); setClipVariant(section.id, chIdx, null) }}
                              >
                                ● Default pattern
                              </button>
                              {channelVariants.map(v => (
                                <button
                                  key={v.id}
                                  className="w-full px-2 py-1.5 text-left text-[7px] font-bold cursor-pointer hover:bg-white/5 transition-colors"
                                  style={{
                                    color: clipVariantId === v.id ? ch.color : '#8a8f9a',
                                    background: clipVariantId === v.id ? `${ch.color}10` : 'transparent',
                                    border: 'none',
                                  }}
                                  onClick={(e) => { e.stopPropagation(); setClipVariant(section.id, chIdx, v.id) }}
                                >
                                  ♬ {v.name}
                                </button>
                              ))}
                              {/* Create new variant option */}
                              {onCreateVariant && (
                                <button
                                  className="w-full px-2 py-1.5 text-left text-[7px] font-bold cursor-pointer hover:bg-cyan-500/10 transition-colors flex items-center gap-1"
                                  style={{ color: '#00e5c7', background: 'none', border: 'none', borderTop: '1px solid rgba(255,255,255,0.06)' }}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    const variantName = section.name.toLowerCase().replace(/\s+/g, '_')
                                    onCreateVariant(chIdx, variantName)
                                    setVariantPicker(null)
                                  }}
                                >
                                  <Plus size={7} /> Save as "{section.name.toLowerCase()}" variant
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}

                    {/* ── Drag handle for section resize (right edge) ── */}
                    <div
                      className="absolute top-0 bottom-0 right-0 w-2 cursor-col-resize z-10 hover:bg-white/10 transition-colors group/resize"
                      onMouseDown={(e) => onSectionResizeStart(e, sIdx)}
                      title="Drag to resize"
                    >
                      <div className="absolute top-1/2 right-0.5 -translate-y-1/2 w-0.5 h-4 rounded-full bg-white/10 group-hover/resize:bg-white/30 transition-colors" />
                    </div>
                  </div>
                )
              })}

              {/* ── Add section column ── */}
              <div className="shrink-0 flex flex-col items-center justify-start pt-1" style={{ width: 32 }}>
                <button
                  onClick={addSection}
                  className="w-5 h-5 rounded flex items-center justify-center cursor-pointer hover:bg-cyan-500/15 transition-colors"
                  style={{ color: '#00e5c740', background: 'rgba(0,229,199,0.04)', border: '1px solid rgba(0,229,199,0.1)' }}
                  title="Add section"
                >
                  <Plus size={9} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
})

export default ArrangementTimeline
