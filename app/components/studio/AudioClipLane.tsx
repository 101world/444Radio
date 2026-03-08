'use client'

// ═══════════════════════════════════════════════════════════════
//  AUDIO CLIP LANE — renders audio clips on the arrangement
//  timeline as waveform blocks.  Supports:
//    • Drag-to-move (snaps to 1/64 bar grid)
//    • Drag right edge to trim
//    • Right-click context menu (cut/copy/paste/split/delete)
//    • Waveform mini-preview
//    • Gain display
// ═══════════════════════════════════════════════════════════════

import { useRef, useMemo, useCallback, useState, useEffect, memo } from 'react'
import {
  type AudioClip,
  type AudioTrack,
  type ClipClipboard,
  snapToGrid,
  getWaveformPeaks,
  duplicateClip,
  splitClip,
  nextClipId,
  barsToSeconds,
  secondsToBars,
} from '@/lib/audio-clip-engine'

// ─── Layout ───

const PX_PER_BAR = 48
const ROW_H = 48  // audio clip lanes are taller than pattern rows

// ─── Types ───

interface AudioClipLaneProps {
  track: AudioTrack
  trackIndex: number
  clips: AudioClip[]
  /** Total arrangement bars across all sections */
  totalBars: number
  /** Section boundaries for rendering grid lines */
  sectionBarStarts: number[]
  sectionBarLengths: number[]
  /** Project BPM */
  bpm: number
  /** Clipboard for paste */
  clipboard: ClipClipboard | null
  // ── Callbacks ──
  onClipsChange: (clips: AudioClip[]) => void
  onClipboardChange: (cb: ClipClipboard | null) => void
  onDeleteClip: (clipId: string) => void
  // ── New: auto-sync / auto-pitch / create-instrument ──
  onAutoSync?: (clipId: string) => void
  onAutoPitch?: (clipId: string) => void
  onCreateInstrument?: (clipId: string) => void
  /** Project root note / key (e.g. "C", "F#") for auto-pitch */
  projectKey?: string
}

// ─── Waveform cache (avoid recalculating every render) ───
const waveformCache = new WeakMap<AudioBuffer, Float32Array>()
function getCachedWaveform(buffer: AudioBuffer, numSamples: number): Float32Array {
  let cached = waveformCache.get(buffer)
  if (!cached || cached.length !== numSamples) {
    cached = getWaveformPeaks(buffer, numSamples)
    waveformCache.set(buffer, cached)
  }
  return cached
}

// ─── Mini waveform SVG ───
const MiniWaveform = memo(function MiniWaveform({
  buffer, width, height, color,
}: { buffer: AudioBuffer; width: number; height: number; color: string }) {
  const numSamples = Math.max(16, Math.min(512, Math.round(width)))
  const peaks = useMemo(() => getCachedWaveform(buffer, numSamples), [buffer, numSamples])

  const path = useMemo(() => {
    if (peaks.length === 0) return ''
    const mid = height / 2
    const parts: string[] = []
    for (let i = 0; i < peaks.length; i++) {
      const x = (i / peaks.length) * width
      const amp = peaks[i] * mid * 0.85
      parts.push(`M${x.toFixed(1)},${(mid - amp).toFixed(1)} L${x.toFixed(1)},${(mid + amp).toFixed(1)}`)
    }
    return parts.join(' ')
  }, [peaks, width, height])

  return (
    <svg width={width} height={height} className="absolute inset-0 pointer-events-none">
      <path d={path} stroke={color} strokeWidth={1} fill="none" opacity={0.6} />
    </svg>
  )
})

// ═══════════════════════════════════════════════════════════════
//  COMPONENT
// ═══════════════════════════════════════════════════════════════

const AudioClipLane = memo(function AudioClipLane({
  track, trackIndex, clips, totalBars, sectionBarStarts, sectionBarLengths,
  bpm, clipboard, onClipsChange, onClipboardChange, onDeleteClip,
  onAutoSync, onAutoPitch, onCreateInstrument, projectKey,
}: AudioClipLaneProps) {

  const laneRef = useRef<HTMLDivElement>(null)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; clipId: string | null; barPos: number } | null>(null)
  const [dragState, setDragState] = useState<{
    clipId: string
    mode: 'move' | 'trim-right' | 'trim-left'
    startX: number
    origStartBar: number
    origDurationBars: number
    origTrimStart: number
    origTrimEnd: number
  } | null>(null)

  // Filter clips for this track
  const trackClips = useMemo(() => clips.filter(c => c.trackIndex === trackIndex), [clips, trackIndex])

  const totalWidth = totalBars * PX_PER_BAR

  // ── Bar position from mouse X ──
  const barFromX = useCallback((clientX: number): number => {
    if (!laneRef.current) return 0
    const rect = laneRef.current.getBoundingClientRect()
    const x = clientX - rect.left + (laneRef.current.scrollLeft || 0)
    return Math.max(0, x / PX_PER_BAR)
  }, [])

  // ── Drag: move or trim ──
  const handleMouseDown = useCallback((e: React.MouseEvent, clipId: string, mode: 'move' | 'trim-right' | 'trim-left') => {
    e.preventDefault()
    e.stopPropagation()
    const clip = clips.find(c => c.id === clipId)
    if (!clip) return
    setDragState({
      clipId,
      mode,
      startX: e.clientX,
      origStartBar: clip.startBar,
      origDurationBars: clip.durationBars,
      origTrimStart: clip.trimStart,
      origTrimEnd: clip.trimEnd,
    })
  }, [clips])

  useEffect(() => {
    if (!dragState) return
    const onMove = (e: MouseEvent) => {
      const deltaX = e.clientX - dragState.startX
      const deltaBars = deltaX / PX_PER_BAR

      const clip = clips.find(c => c.id === dragState.clipId)
      if (!clip) return

      let updated: AudioClip
      if (dragState.mode === 'move') {
        // Move snaps to 1/64 grid (fine positioning)
        const newStart = snapToGrid(Math.max(0, dragState.origStartBar + deltaBars))
        updated = { ...clip, startBar: newStart }
      } else if (dragState.mode === 'trim-right') {
        // ── WHOLE-BAR STRETCH ──
        // Snap to nearest whole bar so clip always stays in tempo.
        // Recalculate playbackRate so the audio fits exactly in those bars.
        const rawDur = dragState.origDurationBars + deltaBars
        const wholeBars = Math.max(1, Math.round(rawDur))
        // Effective audio duration in seconds (original audio region)
        const effectiveSec = clip.buffer.duration - clip.trimStart - clip.trimEnd
        // playbackRate = how much to speed/slow to fit in wholeBars
        const targetSec = barsToSeconds(wholeBars, bpm)
        const rate = targetSec > 0 ? effectiveSec / targetSec : 1
        updated = { ...clip, durationBars: wholeBars, playbackRate: rate }
      } else {
        // ── TRIM-LEFT: whole-bar snap ──
        // Snap delta to whole bars; adjust start position + trimStart + duration
        const rawDelta = Math.round(deltaBars) // whole bar steps
        // Clamp: can't trim beyond buffer start or shrink to 0
        const maxTrimBars = dragState.origDurationBars - 1
        const minTrimBars = -secondsToBars(dragState.origTrimStart, bpm)
        const clampedDelta = Math.max(Math.ceil(minTrimBars), Math.min(rawDelta, maxTrimBars))
        const newTrimStart = dragState.origTrimStart + barsToSeconds(clampedDelta, bpm)
        const newDur = dragState.origDurationBars - clampedDelta
        // Recalculate playbackRate for the new region
        const effectiveSec = clip.buffer.duration - Math.max(0, newTrimStart) - clip.trimEnd
        const targetSec = barsToSeconds(Math.max(1, newDur), bpm)
        const rate = targetSec > 0 ? effectiveSec / targetSec : 1
        updated = {
          ...clip,
          startBar: snapToGrid(dragState.origStartBar + clampedDelta),
          durationBars: Math.max(1, newDur),
          trimStart: Math.max(0, newTrimStart),
          playbackRate: rate,
        }
      }

      onClipsChange(clips.map(c => c.id === clip.id ? updated : c))
    }
    const onUp = () => setDragState(null)
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    return () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp) }
  }, [dragState, clips, bpm, onClipsChange])

  // ── Context menu ──
  const handleContextMenu = useCallback((e: React.MouseEvent, clipId: string | null) => {
    e.preventDefault()
    e.stopPropagation()
    const barPos = barFromX(e.clientX)
    setContextMenu({ x: e.clientX, y: e.clientY, clipId, barPos })
  }, [barFromX])

  // Close context menu on outside click
  useEffect(() => {
    if (!contextMenu) return
    const handler = () => setContextMenu(null)
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [contextMenu])

  // ── Context menu actions ──
  const handleCopy = useCallback(() => {
    if (!contextMenu?.clipId) return
    const clip = clips.find(c => c.id === contextMenu.clipId)
    if (!clip) return
    const { id, ...rest } = clip
    onClipboardChange({ clip: rest, mode: 'copy' })
    setContextMenu(null)
  }, [contextMenu, clips, onClipboardChange])

  const handleCut = useCallback(() => {
    if (!contextMenu?.clipId) return
    const clip = clips.find(c => c.id === contextMenu.clipId)
    if (!clip) return
    const { id, ...rest } = clip
    onClipboardChange({ clip: rest, mode: 'cut', originalId: id })
    onDeleteClip(id)
    setContextMenu(null)
  }, [contextMenu, clips, onClipboardChange, onDeleteClip])

  const handlePaste = useCallback(() => {
    if (!clipboard) return
    const barPos = contextMenu?.barPos ?? 0
    const newClip: AudioClip = {
      ...clipboard.clip,
      id: nextClipId(),
      startBar: snapToGrid(barPos),
      trackIndex,
    }
    onClipsChange([...clips, newClip])
    setContextMenu(null)
  }, [clipboard, contextMenu, clips, trackIndex, onClipsChange])

  const handleDuplicate = useCallback(() => {
    if (!contextMenu?.clipId) return
    const clip = clips.find(c => c.id === contextMenu.clipId)
    if (!clip) return
    const dup = duplicateClip(clip)
    onClipsChange([...clips, dup])
    setContextMenu(null)
  }, [contextMenu, clips, onClipsChange])

  const handleSplit = useCallback(() => {
    if (!contextMenu?.clipId) return
    const clip = clips.find(c => c.id === contextMenu.clipId)
    if (!clip) return
    const result = splitClip(clip, snapToGrid(contextMenu.barPos), bpm)
    if (!result) { setContextMenu(null); return }
    const [left, right] = result
    onClipsChange(clips.map(c => c.id === clip.id ? left : c).concat(right))
    setContextMenu(null)
  }, [contextMenu, clips, bpm, onClipsChange])

  const handleDelete = useCallback(() => {
    if (!contextMenu?.clipId) return
    onDeleteClip(contextMenu.clipId)
    setContextMenu(null)
  }, [contextMenu, onDeleteClip])

  // ── Auto-Sync: snap clip duration to nearest whole bars via playback rate ──
  const handleAutoSync = useCallback(() => {
    if (!contextMenu?.clipId) return
    // Delegate entirely to the parent handler which updates state + applies rate
    onAutoSync?.(contextMenu.clipId)
    setContextMenu(null)
  }, [contextMenu, onAutoSync])

  // ── Auto-Pitch: detect and display pitch correction info ──
  const handleAutoPitch = useCallback(() => {
    if (!contextMenu?.clipId) return
    onAutoPitch?.(contextMenu.clipId)
    setContextMenu(null)
  }, [contextMenu, onAutoPitch])

  // ── Create Instrument: turn clip into a Strudel sampler channel ──
  const handleCreateInstrument = useCallback(() => {
    if (!contextMenu?.clipId) return
    onCreateInstrument?.(contextMenu.clipId)
    setContextMenu(null)
  }, [contextMenu, onCreateInstrument])

  // ── Double-click lane to paste or place clip ──
  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    if (!clipboard) return
    const barPos = barFromX(e.clientX)
    const newClip: AudioClip = {
      ...clipboard.clip,
      id: nextClipId(),
      startBar: snapToGrid(barPos),
      trackIndex,
    }
    onClipsChange([...clips, newClip])
  }, [clipboard, barFromX, clips, trackIndex, onClipsChange])

  return (
    <div
      ref={laneRef}
      className="relative shrink-0"
      style={{ height: ROW_H, width: totalWidth, borderBottom: '1px solid #1a1c22' }}
      onContextMenu={(e) => handleContextMenu(e, null)}
      onDoubleClick={handleDoubleClick}
    >
      {/* ── Section border lines ── */}
      {sectionBarStarts.map((startBar, sIdx) => (
        <div
          key={sIdx}
          className="absolute top-0 bottom-0 pointer-events-none"
          style={{ left: startBar * PX_PER_BAR + sectionBarLengths[sIdx] * PX_PER_BAR, width: 1, background: '#1e2028' }}
        />
      ))}

      {/* ── Beat grid lines ── */}
      {Array.from({ length: totalBars }).map((_, b) => (
        <div
          key={b}
          className="absolute top-0 bottom-0 pointer-events-none"
          style={{ left: b * PX_PER_BAR, width: 1, background: b % 4 === 0 ? '#1e2028' : '#15161c' }}
        />
      ))}

      {/* ── Clip blocks ── */}
      {trackClips.map((clip) => {
        const x = clip.startBar * PX_PER_BAR
        const w = Math.max(4, clip.durationBars * PX_PER_BAR)
        const isDragging = dragState?.clipId === clip.id

        return (
          <div
            key={clip.id}
            className="absolute top-[2px] bottom-[2px] rounded-[4px] overflow-hidden group"
            style={{
              left: x,
              width: w,
              background: `${clip.color}30`,
              borderLeft: `3px solid ${clip.color}`,
              boxShadow: isDragging ? `0 0 8px ${clip.color}60` : 'none',
              cursor: dragState ? (dragState.mode === 'move' ? 'grabbing' : 'col-resize') : 'grab',
              zIndex: isDragging ? 20 : 1,
              transition: isDragging ? 'none' : 'box-shadow 0.15s',
            }}
            onMouseDown={(e) => { if (e.button === 0) handleMouseDown(e, clip.id, 'move') }}
            onContextMenu={(e) => handleContextMenu(e, clip.id)}
          >
            {/* Waveform */}
            <MiniWaveform
              buffer={clip.buffer}
              width={Math.max(16, w - 3)}
              height={ROW_H - 4}
              color={clip.color}
            />

            {/* Clip name + indicators */}
            <div className="absolute top-[2px] left-[6px] right-[6px] flex items-center gap-1 pointer-events-none z-[2]">
              <span className="text-[8px] font-semibold truncate" style={{ color: `${clip.color}ee` }}>
                {clip.name}
              </span>
              {clip.gain !== 1 && (
                <span className="text-[7px] font-mono" style={{ color: `${clip.color}88` }}>
                  {clip.gain.toFixed(1)}
                </span>
              )}
              {clip.playbackRate !== 1 && (
                <span className="text-[7px] font-mono" style={{ color: '#a78bfa' }} title={`Synced: ${clip.playbackRate.toFixed(2)}x`}>
                  ⏱{clip.playbackRate.toFixed(2)}x
                </span>
              )}
              {clip.detuneCents !== 0 && (
                <span className="text-[7px] font-mono" style={{ color: '#22d3ee' }} title={`Pitch: ${clip.detuneCents > 0 ? '+' : ''}${clip.detuneCents.toFixed(0)}¢`}>
                  ♪{clip.detuneCents > 0 ? '+' : ''}{clip.detuneCents.toFixed(0)}¢
                </span>
              )}
            </div>

            {/* Detection info badges (bottom row) */}
            <div className="absolute bottom-[2px] left-[6px] right-[6px] flex items-center gap-1.5 pointer-events-none z-[2]">
              {/* Detected BPM */}
              {clip.detectedBpm != null && (
                <span
                  className="text-[7px] font-mono px-[3px] py-[0.5px] rounded-sm"
                  style={{
                    color: clip.synced ? '#a78bfa' : '#888',
                    background: clip.synced ? '#a78bfa18' : '#ffffff08',
                  }}
                  title={clip.synced ? `BPM synced: ${clip.detectedBpm} → project tempo` : `Detected BPM: ${clip.detectedBpm}`}
                >
                  {clip.detectedBpm}bpm{clip.synced ? ' ✓' : ''}
                </span>
              )}
              {/* Detected note / pitch */}
              {clip.detectedNote && (
                <span
                  className="text-[7px] font-mono px-[3px] py-[0.5px] rounded-sm"
                  style={{
                    color: clip.pitched ? '#22d3ee' : '#888',
                    background: clip.pitched ? '#22d3ee18' : '#ffffff08',
                  }}
                  title={clip.pitched ? `Pitch shifted to key: ${clip.detectedNote} → ${clip.detuneCents > 0 ? '+' : ''}${clip.detuneCents.toFixed(0)}¢` : `Detected note: ${clip.detectedNote}`}
                >
                  {clip.detectedNote}{clip.pitched ? ' ✓' : ''}
                </span>
              )}
              {/* No detection possible */}
              {!clip.detectedBpm && !clip.detectedNote && (
                <span className="text-[7px] font-mono" style={{ color: '#555' }}>
                  no detection
                </span>
              )}
            </div>

            {/* Trim handles */}
            <div
              className="absolute top-0 bottom-0 left-0 w-[5px] cursor-col-resize opacity-0 group-hover:opacity-100 hover:!bg-white/20 transition-all z-10"
              onMouseDown={(e) => { e.stopPropagation(); handleMouseDown(e, clip.id, 'trim-left') }}
            />
            <div
              className="absolute top-0 bottom-0 right-0 w-[5px] cursor-col-resize opacity-0 group-hover:opacity-100 hover:!bg-white/20 transition-all z-10"
              onMouseDown={(e) => { e.stopPropagation(); handleMouseDown(e, clip.id, 'trim-right') }}
            />
          </div>
        )
      })}

      {/* ── Context menu ── */}
      {contextMenu && (
        <div
          className="fixed z-[100] min-w-[150px] rounded-md shadow-2xl overflow-hidden"
          style={{
            left: contextMenu.x,
            top: contextMenu.y,
            background: '#1a1c24',
            border: '1px solid #2a2d38',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.clipId && (
            <>
              <button className="w-full px-3 py-2 text-left text-[11px] hover:bg-white/[0.06] transition-colors" style={{ color: '#ccc', background: 'none', border: 'none', cursor: 'pointer' }} onClick={handleCopy}>
                Copy <span className="float-right text-[9px] text-white/30">Ctrl+C</span>
              </button>
              <button className="w-full px-3 py-2 text-left text-[11px] hover:bg-white/[0.06] transition-colors" style={{ color: '#ccc', background: 'none', border: 'none', cursor: 'pointer' }} onClick={handleCut}>
                Cut <span className="float-right text-[9px] text-white/30">Ctrl+X</span>
              </button>
              <button className="w-full px-3 py-2 text-left text-[11px] hover:bg-white/[0.06] transition-colors" style={{ color: '#ccc', background: 'none', border: 'none', cursor: 'pointer' }} onClick={handleDuplicate}>
                Duplicate <span className="float-right text-[9px] text-white/30">Ctrl+D</span>
              </button>
              <button className="w-full px-3 py-2 text-left text-[11px] hover:bg-white/[0.06] transition-colors" style={{ color: '#ccc', background: 'none', border: 'none', cursor: 'pointer' }} onClick={handleSplit}>
                Split at cursor <span className="float-right text-[9px] text-white/30">S</span>
              </button>
              <div style={{ borderTop: '1px solid #262830' }} />
              {/* ── Audio Processing ── */}
              <button className="w-full px-3 py-2 text-left text-[11px] hover:bg-white/[0.06] transition-colors" style={{ color: '#a78bfa', background: 'none', border: 'none', cursor: 'pointer' }} onClick={handleAutoSync}>
                Auto-Sync to BPM <span className="float-right text-[9px] text-white/30">⏱</span>
              </button>
              <button className="w-full px-3 py-2 text-left text-[11px] hover:bg-white/[0.06] transition-colors" style={{ color: '#22d3ee', background: 'none', border: 'none', cursor: 'pointer' }} onClick={handleAutoPitch}>
                Auto-Pitch to Key{projectKey ? ` (${projectKey})` : ''} <span className="float-right text-[9px] text-white/30">♪</span>
              </button>
              <button className="w-full px-3 py-2 text-left text-[11px] hover:bg-white/[0.06] transition-colors" style={{ color: '#10b981', background: 'none', border: 'none', cursor: 'pointer' }} onClick={handleCreateInstrument}>
                Create Instrument <span className="float-right text-[9px] text-white/30">🎹</span>
              </button>
              <div style={{ borderTop: '1px solid #262830' }} />
              <button className="w-full px-3 py-2 text-left text-[11px] hover:bg-red-500/10 transition-colors" style={{ color: '#f87171', background: 'none', border: 'none', cursor: 'pointer' }} onClick={handleDelete}>
                Delete <span className="float-right text-[9px] text-white/30">Del</span>
              </button>
            </>
          )}
          {!contextMenu.clipId && clipboard && (
            <button className="w-full px-3 py-2 text-left text-[11px] hover:bg-white/[0.06] transition-colors" style={{ color: '#ccc', background: 'none', border: 'none', cursor: 'pointer' }} onClick={handlePaste}>
              Paste at bar {Math.floor(contextMenu.barPos) + 1}
            </button>
          )}
          {!contextMenu.clipId && !clipboard && (
            <div className="px-3 py-2 text-[10px]" style={{ color: '#555' }}>
              Right-click a clip for options
            </div>
          )}
        </div>
      )}
    </div>
  )
})

export default AudioClipLane
export { ROW_H as AUDIO_CLIP_ROW_H }
