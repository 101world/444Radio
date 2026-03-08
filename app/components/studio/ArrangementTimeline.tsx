'use client'

// ═══════════════════════════════════════════════════════════════
//  ARRANGEMENT TIMELINE — DAW-style section sequencer
//  Clean Ableton/Logic-inspired visuals. Solid clip blocks,
//  readable labels, bar ruler, drag-to-resize, pattern variants.
// ═══════════════════════════════════════════════════════════════

import { useState, useRef, useEffect, useCallback, memo, useMemo } from 'react'
import { Plus, Minus, X, ChevronUp, ChevronDown, Copy, Music, Activity } from 'lucide-react'
import type { ParsedChannel } from '@/lib/strudel-code-parser'

// ─── Types ───

export interface PatternVariant {
  id: string
  name: string
  pattern: string
  channelIdx: number
}

export interface ArrangementSection {
  id: string
  name: string
  bars: number
  activeChannels: Set<number>
  clipVariants: Map<number, string>
}

interface ArrangementTimelineProps {
  channels: ParsedChannel[]
  sections: ArrangementSection[]
  isOpen: boolean
  isPlaying: boolean
  currentBar?: number
  getCyclePosition?: () => number | null
  automationData?: Map<string, number>
  onToggle: () => void
  onSectionsChange: (sections: ArrangementSection[]) => void
  onDuplicateAutomation?: (fromSectionId: string, toSectionId: string) => void
  onSeek?: (barPosition: number) => void
  patternVariants?: PatternVariant[]
  onPatternVariantsChange?: (variants: PatternVariant[]) => void
  onCreateVariant?: (channelIdx: number, name: string) => void
}

// ─── Layout constants (DAW-scale) ───
const LABEL_W = 120
const SECTION_HEADER_H = 28
const ROW_H = 32
const BAR_RULER_H = 20
const PX_PER_BAR = 48
const MIN_HEIGHT = 80
const MAX_HEIGHT = 600
const DEFAULT_HEIGHT = 240
const MIN_SECTION_BARS = 1
const MAX_SECTION_BARS = 64

// Muted pastel section colors (Ableton-style markers)
const SECTION_COLORS = [
  '#5b9bd5', '#a480cf', '#e07c5a', '#5bb888', '#d96b7c',
  '#c9a832', '#6fa1e0', '#cc6b9a', '#4db8a4', '#8a7cc8',
]

const SECTION_NAMES = [
  'Intro', 'Verse', 'Build', 'Chorus', 'Bridge', 'Drop', 'Break', 'Outro',
]

let sectionIdCounter = 0
function nextSectionId() { return `sec-${++sectionIdCounter}` }

let variantIdCounter = 0
export function nextVariantId() { return `var-${++variantIdCounter}` }

// ─── Component ───
// ─── Catmull-Rom spline for smooth mini automation curves ───
function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number): number {
  return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t)
}

const ArrangementTimeline = memo(function ArrangementTimeline({
  channels, sections, isOpen, isPlaying, currentBar, getCyclePosition,
  automationData, onDuplicateAutomation, onSeek,
  onToggle, onSectionsChange,
  patternVariants = [], onPatternVariantsChange, onCreateVariant,
}: ArrangementTimelineProps) {
  const [height, setHeight] = useState(DEFAULT_HEIGHT)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const renameRef = useRef<HTMLInputElement>(null)
  const dragRef = useRef<{ startY: number; startH: number } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const resizeDragRef = useRef<{ sectionIdx: number; startX: number; startBars: number } | null>(null)
  const [variantPicker, setVariantPicker] = useState<{ sectionId: string; channelIdx: number } | null>(null)
  const playheadRef = useRef<HTMLDivElement>(null)
  const animRafRef = useRef<number>(0)
  const sectionsRef = useRef(sections)
  sectionsRef.current = sections
  const getCyclePositionRef = useRef(getCyclePosition)
  getCyclePositionRef.current = getCyclePosition
  const [trackedBar, setTrackedBar] = useState<number>(-1)
  // Track seek position for showing playhead when stopped
  const seekBarRef = useRef<number | null>(null)

  // Helper: compute pixel offset from a bar position accounting for 1px section borders
  const barToPixelOffset = useCallback((barPos: number, sec: ArrangementSection[]): number => {
    let pxOffset = barPos * PX_PER_BAR
    let barAcc = 0
    for (let i = 0; i < sec.length; i++) {
      if (barPos >= barAcc + sec[i].bars) {
        barAcc += sec[i].bars
        pxOffset += 1 // 1px border-right per section
      } else break
    }
    return pxOffset
  }, [])

  // ── Smooth playhead animation via requestAnimationFrame ──
  // Uses getCyclePositionRef (not closure) to avoid effect churn from inline fn prop
  useEffect(() => {
    if (!isPlaying) {
      // When stopped, show playhead at seek position if one was set
      if (playheadRef.current && seekBarRef.current !== null) {
        const sec = sectionsRef.current
        const tb = sec.reduce((sum, s) => sum + s.bars, 0)
        if (tb > 0) {
          const barPos = seekBarRef.current % tb
          playheadRef.current.style.left = `${barToPixelOffset(barPos, sec)}px`
          playheadRef.current.style.opacity = '0.6'
        }
      } else if (playheadRef.current) {
        playheadRef.current.style.opacity = '0'
      }
      setTrackedBar(-1)
      return
    }
    // Clear seek marker once playing starts
    seekBarRef.current = null
    let lastStateUpdate = 0
    const tick = () => {
      const sec = sectionsRef.current
      const getPos = getCyclePositionRef.current
      if (!sec.length || !playheadRef.current || !getPos) {
        if (playheadRef.current) playheadRef.current.style.opacity = '0'
        animRafRef.current = requestAnimationFrame(tick)
        return
      }
      const pos = getPos()
      if (pos === null) {
        playheadRef.current.style.opacity = '0'
        animRafRef.current = requestAnimationFrame(tick)
        return
      }
      const tb = sec.reduce((sum, s) => sum + s.bars, 0)
      if (tb <= 0) { animRafRef.current = requestAnimationFrame(tick); return }
      const barPos = pos % tb
      playheadRef.current.style.left = `${barToPixelOffset(barPos, sec)}px`
      playheadRef.current.style.opacity = '1'
      // Throttled state update for section highlight (~5 fps)
      const now = performance.now()
      if (now - lastStateUpdate > 200) {
        lastStateUpdate = now
        setTrackedBar(Math.floor(barPos))
      }
      animRafRef.current = requestAnimationFrame(tick)
    }
    animRafRef.current = requestAnimationFrame(tick)
    return () => { if (animRafRef.current) cancelAnimationFrame(animRafRef.current) }
  }, [isPlaying, barToPixelOffset])

  useEffect(() => { if (renamingId && renameRef.current) renameRef.current.focus() }, [renamingId])
  useEffect(() => {
    if (!variantPicker) return
    const handler = () => setVariantPicker(null)
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [variantPicker])

  // ── Panel height resize ──
  const onResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    dragRef.current = { startY: e.clientY, startH: height }
    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return
      setHeight(Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, dragRef.current.startH + (dragRef.current.startY - ev.clientY))))
    }
    const onUp = () => { dragRef.current = null; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp) }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [height])

  // ── Section operations ──
  const addSection = useCallback(() => {
    const name = SECTION_NAMES[sections.length % SECTION_NAMES.length]
    onSectionsChange([...sections, { id: nextSectionId(), name, bars: 4, activeChannels: new Set(channels.map((_, i) => i)), clipVariants: new Map() }])
  }, [sections, channels, onSectionsChange])

  const duplicateSection = useCallback((id: string) => {
    const src = sections.find(s => s.id === id)
    if (!src) return
    const idx = sections.indexOf(src)
    const newId = nextSectionId()
    const copy: ArrangementSection = { id: newId, name: `${src.name}`, bars: src.bars, activeChannels: new Set(src.activeChannels), clipVariants: new Map(src.clipVariants) }
    const next = [...sections]; next.splice(idx + 1, 0, copy); onSectionsChange(next)
    // Copy automation from source section to new section
    onDuplicateAutomation?.(id, newId)
  }, [sections, onSectionsChange, onDuplicateAutomation])

  const removeSection = useCallback((id: string) => { onSectionsChange(sections.filter(s => s.id !== id)) }, [sections, onSectionsChange])

  const updateSection = useCallback((id: string, patch: Partial<ArrangementSection>) => {
    onSectionsChange(sections.map(s => s.id === id ? { ...s, ...patch } : s))
  }, [sections, onSectionsChange])

  const toggleCell = useCallback((sectionId: string, channelIdx: number) => {
    onSectionsChange(sections.map(s => {
      if (s.id !== sectionId) return s
      const next = new Set(s.activeChannels)
      next.has(channelIdx) ? next.delete(channelIdx) : next.add(channelIdx)
      return { ...s, activeChannels: next }
    }))
  }, [sections, onSectionsChange])

  const setClipVariant = useCallback((sectionId: string, channelIdx: number, variantId: string | null) => {
    onSectionsChange(sections.map(s => {
      if (s.id !== sectionId) return s
      const clips = new Map(s.clipVariants)
      variantId === null ? clips.delete(channelIdx) : clips.set(channelIdx, variantId)
      return { ...s, clipVariants: clips }
    }))
    setVariantPicker(null)
  }, [sections, onSectionsChange])

  const commitRename = useCallback(() => {
    if (renamingId && renameValue.trim()) updateSection(renamingId, { name: renameValue.trim() })
    setRenamingId(null)
  }, [renamingId, renameValue, updateSection])

  // ── Section resize (drag right edge) ──
  const onSectionResizeStart = useCallback((e: React.MouseEvent, sectionIdx: number) => {
    e.preventDefault(); e.stopPropagation()
    resizeDragRef.current = { sectionIdx, startX: e.clientX, startBars: sections[sectionIdx].bars }
    const onMove = (ev: MouseEvent) => {
      if (!resizeDragRef.current) return
      const barDelta = Math.round((ev.clientX - resizeDragRef.current.startX) / PX_PER_BAR)
      const newBars = Math.max(MIN_SECTION_BARS, Math.min(MAX_SECTION_BARS, resizeDragRef.current.startBars + barDelta))
      const updated = [...sections]; updated[resizeDragRef.current.sectionIdx] = { ...updated[resizeDragRef.current.sectionIdx], bars: newBars }; onSectionsChange(updated)
    }
    const onUp = () => { resizeDragRef.current = null; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp) }
    document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp)
  }, [sections, onSectionsChange])

  // ── Scrub / seek on bar ruler ──
  const onSeekRef = useRef(onSeek)
  onSeekRef.current = onSeek
  const isScrubbing = useRef(false)

  const barPosFromRulerX = useCallback((clientX: number, rulerEl: HTMLElement) => {
    const rect = rulerEl.getBoundingClientRect()
    const x = Math.max(0, clientX - rect.left)
    // Walk through sections to find bar position accounting for 1px borders
    const sec = sectionsRef.current
    let pxAcc = 0
    let barAcc = 0
    for (let i = 0; i < sec.length; i++) {
      const sectionPx = sec[i].bars * PX_PER_BAR + 1 // +1 for border
      if (x < pxAcc + sectionPx) {
        const localPx = x - pxAcc
        const localBar = localPx / PX_PER_BAR
        return Math.max(0, barAcc + localBar)
      }
      pxAcc += sectionPx
      barAcc += sec[i].bars
    }
    return barAcc // at the end
  }, [])

  const handleRulerMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    const rulerEl = e.currentTarget
    const barPos = barPosFromRulerX(e.clientX, rulerEl)
    onSeekRef.current?.(barPos)
    // Immediately position playhead for visual feedback
    seekBarRef.current = barPos
    if (playheadRef.current) {
      const sec = sectionsRef.current
      const tb = sec.reduce((sum, s) => sum + s.bars, 0)
      if (tb > 0) {
        playheadRef.current.style.left = `${barToPixelOffset(barPos % tb, sec)}px`
        playheadRef.current.style.opacity = '1'
      }
    }
    isScrubbing.current = true

    const onMove = (ev: MouseEvent) => {
      if (!isScrubbing.current) return
      const bp = barPosFromRulerX(ev.clientX, rulerEl)
      onSeekRef.current?.(bp)
      // Live scrub: position playhead immediately
      seekBarRef.current = bp
      if (playheadRef.current) {
        const sec = sectionsRef.current
        const tb = sec.reduce((sum, s) => sum + s.bars, 0)
        if (tb > 0) {
          playheadRef.current.style.left = `${barToPixelOffset(bp % tb, sec)}px`
          playheadRef.current.style.opacity = '1'
        }
      }
    }
    const onUp = () => {
      isScrubbing.current = false
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [barPosFromRulerX, barToPixelOffset])

  const totalBars = sections.reduce((sum, s) => sum + s.bars, 0)

  // Playback cursor position (use getCyclePosition-derived trackedBar, fallback to prop)
  let cursorSectionIdx = -1, cursorBarInSection = 0
  const effectiveBar = trackedBar >= 0 ? trackedBar : (currentBar ?? -1)
  if (effectiveBar >= 0) {
    let acc = 0
    for (let i = 0; i < sections.length; i++) {
      if (effectiveBar < acc + sections[i].bars) { cursorSectionIdx = i; cursorBarInSection = effectiveBar - acc; break }
      acc += sections[i].bars
    }
  }

  const variantsByChannel = useMemo(() => {
    const map = new Map<number, PatternVariant[]>()
    for (const v of patternVariants) { const list = map.get(v.channelIdx) || []; list.push(v); map.set(v.channelIdx, list) }
    return map
  }, [patternVariants])

  // ── Precompute which section+channel cells have automation ──
  // Key: "sectionId:channelIdx" → Set of param keys with automation
  const automationCells = useMemo(() => {
    const cells = new Map<string, Set<string>>()
    if (!automationData || automationData.size === 0) return cells
    for (const key of automationData.keys()) {
      // key format: sectionId:channelIdx:paramKey
      const first = key.indexOf(':')
      const second = key.indexOf(':', first + 1)
      if (first === -1 || second === -1) continue
      const secId = key.substring(0, first)
      const chIdx = key.substring(first + 1, second)
      const paramKey = key.substring(second + 1)
      const cellKey = `${secId}:${chIdx}`
      if (!cells.has(cellKey)) cells.set(cellKey, new Set())
      cells.get(cellKey)!.add(paramKey)
    }
    return cells
  }, [automationData])

  // ═══════════════════ COLLAPSED STATE ═══════════════════
  if (!isOpen) {
    return (
      <button
        onClick={onToggle}
        className="flex items-center gap-2.5 w-full py-1.5 px-3 cursor-pointer transition-colors hover:bg-white/[0.03] group"
        style={{ background: '#111217', borderTop: '1px solid #1e2028' }}
      >
        <ChevronUp size={12} className="text-white/25 group-hover:text-white/50 transition-colors" />
        <span className="text-[11px] font-semibold text-white/35 uppercase tracking-wider group-hover:text-white/60 transition-colors">
          Arrangement
        </span>
        {sections.length > 0 && (
          <span className="text-[10px] font-mono text-white/25 ml-1">
            {sections.length} sections &middot; {totalBars} bars
          </span>
        )}
      </button>
    )
  }

  // ═══════════════════ OPEN STATE ═══════════════════
  // Compute section pixel widths
  const sectionWidths = sections.map(s => s.bars * PX_PER_BAR)

  return (
    <div className="flex flex-col select-none" style={{ height, borderTop: '1px solid #1e2028' }}>

      {/* ── Resize grip ── */}
      <div className="h-[5px] cursor-ns-resize flex items-center justify-center hover:bg-white/[0.04] transition-colors" style={{ background: '#0e0f14' }} onMouseDown={onResizeStart}>
        <div className="w-10 h-[2px] rounded-full bg-white/[0.06]" />
      </div>

      {/* ── Toolbar ── */}
      <div className="flex items-center gap-2 px-3 py-1 shrink-0" style={{ background: '#111217', borderBottom: '1px solid #1a1c22' }}>
        <button onClick={onToggle} className="text-white/25 hover:text-white/50 transition-colors" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          <ChevronDown size={12} />
        </button>
        <span className="text-[11px] font-semibold text-white/50 uppercase tracking-wider">Arrangement</span>
        <span className="text-[10px] text-white/20 font-mono">{totalBars} bars</span>
        <div className="flex-1" />
        <button
          onClick={addSection}
          className="flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-semibold cursor-pointer transition-colors hover:bg-white/[0.06]"
          style={{ color: '#aab4c2', background: '#1a1c24', border: '1px solid #262830' }}
        >
          <Plus size={10} /> Add Section
        </button>
      </div>

      {/* ── Main grid area ── */}
      <div ref={containerRef} className="flex-1 overflow-auto" style={{ background: '#0c0d11' }}>
        {sections.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <p className="text-[11px] text-white/20">No sections yet</p>
            <button
              onClick={addSection}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded text-[11px] font-semibold cursor-pointer transition-colors hover:bg-white/[0.06]"
              style={{ color: '#aab4c2', background: '#1a1c24', border: '1px solid #262830' }}
            >
              <Plus size={11} /> Add Section
            </button>
          </div>
        ) : (
          <div className="flex h-full">

            {/* ── Track labels (left sidebar) ── */}
            <div className="shrink-0 flex flex-col" style={{ width: LABEL_W, background: '#111217' }}>
              {/* Bar ruler corner */}
              <div className="shrink-0" style={{ height: BAR_RULER_H, borderBottom: '1px solid #1a1c22', borderRight: '1px solid #1a1c22' }} />
              {/* Section header corner */}
              <div className="shrink-0" style={{ height: SECTION_HEADER_H, borderBottom: '1px solid #1e2028', borderRight: '1px solid #1a1c22' }} />
              {/* Channel names */}
              {channels.map((ch, idx) => (
                <div key={ch.id} className="flex items-center gap-2 px-3 shrink-0" style={{ height: ROW_H, borderBottom: '1px solid #151720', borderRight: '1px solid #1a1c22' }}>
                  <div className="w-2 h-2 rounded-sm shrink-0" style={{ background: ch.color }} />
                  <span className="text-[10px] font-medium truncate" style={{ color: '#b0b8c8' }}>{ch.name}</span>
                  {(variantsByChannel.get(idx)?.length ?? 0) > 0 && (
                    <span className="ml-auto text-[8px] font-mono px-1 rounded" style={{ color: '#6b7280', background: '#1a1c24' }}>
                      {variantsByChannel.get(idx)!.length}v
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* ── Timeline columns ── */}
            <div className="flex-1 overflow-x-auto">
              <div className="flex" style={{ minWidth: 'fit-content' }}>

                {/* Sections + bar ruler + clips */}
                <div className="flex flex-col relative">

                  {/* ─── Bar ruler (top row) — click/drag to scrub ─── */}
                  <div
                    className="flex shrink-0 select-none"
                    style={{ height: BAR_RULER_H, background: '#0e0f14', borderBottom: '1px solid #1a1c22', cursor: onSeek ? 'pointer' : 'default' }}
                    onMouseDown={onSeek ? handleRulerMouseDown : undefined}
                    title={onSeek ? 'Click or drag to scrub playback position' : undefined}
                  >
                    {sections.map((section, sIdx) => {
                      const w = sectionWidths[sIdx]
                      let barOffset = 0
                      for (let i = 0; i < sIdx; i++) barOffset += sections[i].bars
                      return (
                        <div key={section.id} className="shrink-0 flex items-end relative" style={{ width: w, borderRight: '1px solid #1e2028' }}>
                          {Array.from({ length: section.bars }).map((_, b) => (
                            <div key={b} className="flex items-end justify-start px-[2px] pb-[2px]" style={{ width: PX_PER_BAR, borderRight: b < section.bars - 1 ? '1px solid #15161c' : 'none' }}>
                              <span className="text-[8px] font-mono" style={{ color: '#3a3f4d' }}>{barOffset + b + 1}</span>
                            </div>
                          ))}
                        </div>
                      )
                    })}
                  </div>

                  {/* ─── Section headers ─── */}
                  <div className="flex shrink-0" style={{ height: SECTION_HEADER_H, borderBottom: '1px solid #1e2028' }}>
                    {sections.map((section, sIdx) => {
                      const sectionColor = SECTION_COLORS[sIdx % SECTION_COLORS.length]
                      const w = sectionWidths[sIdx]
                      const isCursorHere = cursorSectionIdx === sIdx

                      return (
                        <div key={section.id} className="shrink-0 flex items-center gap-1.5 px-2 relative group" style={{ width: w, background: isCursorHere ? `${sectionColor}14` : '#111217', borderRight: '1px solid #1e2028', borderLeft: `3px solid ${sectionColor}` }}>
                          {/* Section name */}
                          {renamingId === section.id ? (
                            <input ref={renameRef} value={renameValue}
                              onChange={(e) => setRenameValue(e.target.value)}
                              onBlur={commitRename}
                              onKeyDown={(e) => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setRenamingId(null) }}
                              className="text-[10px] font-semibold bg-black/40 text-white/90 px-1.5 py-0.5 rounded outline-none"
                              style={{ maxWidth: 80, border: `1px solid ${sectionColor}50` }}
                            />
                          ) : (
                            <button className="text-[10px] font-semibold truncate cursor-pointer transition-colors"
                              style={{ color: sectionColor, background: 'none', border: 'none', padding: 0 }}
                              onClick={() => { setRenamingId(section.id); setRenameValue(section.name) }}
                              title="Click to rename"
                            >{section.name}</button>
                          )}
                          <div className="flex items-center gap-0">
                    <button
                      className="w-4 h-4 flex items-center justify-center rounded cursor-pointer opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-all hover:bg-white/[0.06]"
                      style={{ color: '#6b7280', background: 'none', border: 'none' }}
                      onClick={(e) => { e.stopPropagation(); updateSection(section.id, { bars: Math.max(MIN_SECTION_BARS, section.bars - 1) }) }}
                      title="Decrease bars"
                    ><Minus size={8} /></button>
                    <span className="text-[9px] font-mono px-0.5 select-none" style={{ color: '#4a5060' }}>{section.bars} bars</span>
                    <button
                      className="w-4 h-4 flex items-center justify-center rounded cursor-pointer opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-all hover:bg-white/[0.06]"
                      style={{ color: '#6b7280', background: 'none', border: 'none' }}
                      onClick={(e) => { e.stopPropagation(); updateSection(section.id, { bars: Math.min(MAX_SECTION_BARS, section.bars + 1) }) }}
                      title="Increase bars"
                    ><Plus size={8} /></button>
                  </div>

                          {/* Hover actions */}
                          <div className="flex items-center gap-0.5 ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
                            <button className="p-1 rounded cursor-pointer hover:bg-white/[0.06] transition-colors" style={{ color: '#6b7280', background: 'none', border: 'none' }} onClick={() => duplicateSection(section.id)} title="Duplicate"><Copy size={10} /></button>
                            <button className="p-1 rounded cursor-pointer hover:bg-red-500/10 transition-colors" style={{ color: '#6b4444', background: 'none', border: 'none' }} onClick={() => removeSection(section.id)} title="Delete"><X size={10} /></button>
                          </div>

                          {/* Playhead progress */}
                          {isCursorHere && isPlaying && (
                            <div className="absolute bottom-0 left-0 h-[2px]" style={{ width: `${((cursorBarInSection + 1) / section.bars) * 100}%`, background: sectionColor, opacity: 0.7 }} />
                          )}
                        </div>
                      )
                    })}
                    {/* + button after last section header */}
                    <div className="shrink-0 flex items-center justify-center" style={{ width: 40 }}>
                      <button onClick={addSection} className="w-6 h-6 rounded flex items-center justify-center cursor-pointer hover:bg-white/[0.06] transition-colors" style={{ color: '#4a5060', background: 'none', border: '1px solid #1e2028' }} title="Add section"><Plus size={12} /></button>
                    </div>
                  </div>

                  {/* ─── Clip grid (per-channel rows × section columns) ─── */}
                  {channels.map((ch, chIdx) => (
                    <div key={ch.id} className="flex shrink-0" style={{ height: ROW_H, borderBottom: '1px solid #151720' }}>
                      {sections.map((section, sIdx) => {
                        const sectionColor = SECTION_COLORS[sIdx % SECTION_COLORS.length]
                        const w = sectionWidths[sIdx]
                        const isActive = section.activeChannels.has(chIdx)
                        const clipVariantId = section.clipVariants.get(chIdx)
                        const clipVariant = clipVariantId ? patternVariants.find(v => v.id === clipVariantId) : null
                        const channelVariants = variantsByChannel.get(chIdx) || []
                        const isPickerOpen = variantPicker?.sectionId === section.id && variantPicker?.channelIdx === chIdx
                        const cellAutoParams = automationCells.get(`${section.id}:${chIdx}`)
                        const hasAutomation = cellAutoParams && cellAutoParams.size > 0

                        return (
                          <div key={section.id} className="shrink-0 relative" style={{ width: w, borderRight: '1px solid #1a1c22' }}>
                            {/* Click target */}
                            <button
                              className="w-full h-full cursor-pointer transition-colors relative"
                              style={{ background: 'transparent', border: 'none', padding: 0 }}
                              onClick={() => toggleCell(section.id, chIdx)}
                              onContextMenu={(e) => {
                                e.preventDefault()
                                if (isActive && (channelVariants.length > 0 || onCreateVariant))
                                  setVariantPicker(isPickerOpen ? null : { sectionId: section.id, channelIdx: chIdx })
                              }}
                            >
                              {/* ── Active clip block ── */}
                              {isActive && (
                                <div className="absolute inset-x-[3px] inset-y-[3px] rounded-[3px] flex items-center gap-1.5 px-2 overflow-hidden"
                                  style={{
                                    background: clipVariant ? `${ch.color}38` : `${ch.color}28`,
                                    borderLeft: `3px solid ${ch.color}`,
                                    boxShadow: `inset 0 1px 0 ${ch.color}15`,
                                  }}
                                >
                                  {/* Mini automation curve overlay */}
                                  {hasAutomation && automationData && (() => {
                                    // Build smooth Catmull-Rom mini-curves for automated params
                                    const paramList = Array.from(cellAutoParams!)
                                    const allSecIds = sections.map(s => s.id)
                                    const clipW = w - 6 // inset-x 3px each side
                                    const clipH = ROW_H - 6

                                    // For each param, build a smooth curve across sections and extract this section's segment
                                    const curvePaths = paramList.slice(0, 3).map((pk, pIdx) => {
                                      // Gather values for this param across all sections
                                      const sectionValues: { secId: string; val: number }[] = []
                                      let min = Infinity, max = -Infinity
                                      for (const sid of allSecIds) {
                                        const k = `${sid}:${chIdx}:${pk}`
                                        if (automationData.has(k)) {
                                          const v = automationData.get(k)!
                                          sectionValues.push({ secId: sid, val: v })
                                          if (v < min) min = v
                                          if (v > max) max = v
                                        }
                                      }
                                      if (sectionValues.length < 1) return null
                                      if (min === max) { min -= 0.1; max += 0.1 }

                                      // Find this section's index in the value array
                                      const thisSectionValIdx = sectionValues.findIndex(sv => sv.secId === section.id)
                                      if (thisSectionValIdx === -1) return null

                                      // Build normalized value array and compute smooth curve for this clip
                                      const normValues = sectionValues.map(sv => (sv.val - min) / (max - min))
                                      const steps = Math.max(8, Math.round(clipW / 3))
                                      const points: string[] = []

                                      // Catmull-Rom through the section values; sample the segment for this section
                                      const n = normValues.length
                                      for (let step = 0; step <= steps; step++) {
                                        // t goes from 0 to 1 within this section's segment
                                        const t = step / steps
                                        // Map to global position
                                        const globalT = thisSectionValIdx + t
                                        const segIdx = Math.min(Math.floor(globalT), n - 1)
                                        const localT = globalT - segIdx
                                        const p0 = normValues[Math.max(0, segIdx - 1)]
                                        const p1 = normValues[segIdx]
                                        const p2 = normValues[Math.min(n - 1, segIdx + 1)]
                                        const p3 = normValues[Math.min(n - 1, segIdx + 2)]
                                        const val = catmullRom(p0, p1, p2, p3, localT)
                                        const x = (step / steps) * clipW
                                        const y = clipH * (1 - Math.max(0, Math.min(1, val)))
                                        points.push(`${x.toFixed(1)},${y.toFixed(1)}`)
                                      }

                                      const opacity = 0.6 - pIdx * 0.15
                                      const pathD = `M${points.join(' L')}`
                                      // Fill area under curve
                                      const fillD = `${pathD} L${clipW},${clipH} L0,${clipH} Z`
                                      return { pathD, fillD, opacity }
                                    }).filter(Boolean) as { pathD: string; fillD: string; opacity: number }[]

                                    if (curvePaths.length === 0) return null

                                    return (
                                      <svg className="absolute inset-0 pointer-events-none" width={clipW} height={clipH}
                                        style={{ left: 3, top: 3, opacity: 0.7 }}
                                        viewBox={`0 0 ${clipW} ${clipH}`} preserveAspectRatio="none"
                                      >
                                        {curvePaths.map((c, ci) => (
                                          <g key={ci}>
                                            <path d={c.fillD} fill="#00e5c7" opacity={c.opacity * 0.25} />
                                            <path d={c.pathD} fill="none" stroke="#00e5c7" strokeWidth={1.2} opacity={c.opacity} />
                                          </g>
                                        ))}
                                      </svg>
                                    )
                                  })()}
                                  {/* Clip label */}
                                  <span className="text-[9px] font-medium truncate pointer-events-none relative z-[1]" style={{ color: `${ch.color}dd` }}>
                                    {clipVariant ? clipVariant.name : ch.name}
                                  </span>
                                  {clipVariant && <Music size={8} className="shrink-0 pointer-events-none relative z-[1]" style={{ color: `${ch.color}88` }} />}
                                  {/* Automation badge */}
                                  {hasAutomation && (
                                    <div className="ml-auto flex items-center gap-[2px] shrink-0 pointer-events-none relative z-[1]"
                                      title={`Automation: ${Array.from(cellAutoParams!).join(', ')}`}>
                                      <Activity size={8} style={{ color: '#00e5c7', opacity: 0.8 }} />
                                      <span className="text-[7px] font-mono" style={{ color: '#00e5c7aa' }}>
                                        {cellAutoParams!.size}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Hover hint for empty cells */}
                              {!isActive && (
                                <div className="absolute inset-x-[3px] inset-y-[3px] rounded-[3px] opacity-0 hover:opacity-100 transition-opacity"
                                  style={{ background: '#ffffff05', border: '1px dashed #ffffff10' }}
                                />
                              )}

                              {/* Beat grid lines */}
                              {isActive && Array.from({ length: section.bars - 1 }).map((_, b) => (
                                <div key={b} className="absolute top-[3px] bottom-[3px] pointer-events-none" style={{ left: (b + 1) * PX_PER_BAR, width: 1, background: `${ch.color}10` }} />
                              ))}
                            </button>

                            {/* ── Variant picker popup ── */}
                            {isPickerOpen && (
                              <div className="absolute left-1 top-full z-50 min-w-[140px] max-w-[220px] rounded-md shadow-2xl overflow-hidden"
                                style={{ background: '#1a1c24', border: '1px solid #2a2d38' }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button className="w-full px-3 py-2 text-left text-[10px] font-medium cursor-pointer hover:bg-white/[0.04] transition-colors"
                                  style={{ color: !clipVariant ? '#e0e4ec' : '#6b7280', background: !clipVariant ? '#ffffff08' : 'transparent', border: 'none' }}
                                  onClick={(e) => { e.stopPropagation(); setClipVariant(section.id, chIdx, null) }}
                                >Default</button>
                                {channelVariants.map(v => (
                                  <button key={v.id} className="w-full px-3 py-2 text-left text-[10px] font-medium cursor-pointer hover:bg-white/[0.04] transition-colors"
                                    style={{ color: clipVariantId === v.id ? '#e0e4ec' : '#6b7280', background: clipVariantId === v.id ? '#ffffff08' : 'transparent', border: 'none' }}
                                    onClick={(e) => { e.stopPropagation(); setClipVariant(section.id, chIdx, v.id) }}
                                  >{v.name}</button>
                                ))}
                                {onCreateVariant && (
                                  <button className="w-full px-3 py-2 text-left text-[10px] font-medium cursor-pointer hover:bg-white/[0.04] transition-colors flex items-center gap-1.5"
                                    style={{ color: '#7a8a9e', background: 'none', border: 'none', borderTop: '1px solid #262830' }}
                                    onClick={(e) => { e.stopPropagation(); onCreateVariant(chIdx, section.name.toLowerCase().replace(/\s+/g, '_')); setVariantPicker(null) }}
                                  ><Plus size={10} /> Save as variant</button>
                                )}
                              </div>
                            )}

                            {/* Section resize handle (right edge) */}
                            {sIdx === sections.indexOf(section) && (
                              <div className="absolute top-0 bottom-0 right-0 w-[6px] cursor-col-resize z-10 hover:bg-white/[0.08] transition-colors"
                                onMouseDown={(e) => onSectionResizeStart(e, sIdx)} title="Drag to resize"
                              />
                            )}
                          </div>
                        )
                      })}
                    </div>
                  ))}

                  {/* ── Smooth playhead line ── */}
                  {/* ── Smooth playhead line ── */}
                  <div
                    ref={playheadRef}
                    className="absolute top-0 bottom-0 pointer-events-none"
                    style={{
                      width: 2,
                      opacity: 0,
                      zIndex: 50,
                      background: '#00e5c7',
                      boxShadow: '0 0 10px rgba(0,229,199,0.5), 0 0 4px rgba(0,229,199,0.8)',
                      transition: 'opacity 0.15s',
                    }}
                  >
                    {/* Playhead head marker */}
                    <div style={{
                      position: 'absolute', top: -1, left: -5,
                      width: 0, height: 0,
                      borderLeft: '6px solid transparent',
                      borderRight: '6px solid transparent',
                      borderTop: '7px solid #00e5c7',
                      filter: 'drop-shadow(0 0 3px rgba(0,229,199,0.6))',
                    }} />
                  </div>

                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
})

export default ArrangementTimeline
