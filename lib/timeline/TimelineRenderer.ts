/**
 * TimelineRenderer — Imperative DOM controller for the DAW timeline.
 *
 * Rules:
 *  - React must NOT be used for high-frequency updates (dragging, playhead, animation).
 *  - Do NOT call setState inside mousemove, requestAnimationFrame, or audio callbacks.
 *  - Use imperative DOM updates (style.transform, style.left) for real-time visuals.
 *  - Commit changes to React state ONLY on mouseup / drag end.
 *  - Web Audio clock is the single source of truth for time.
 *  - Favor GPU transforms (translateX) over layout-triggering properties where practical.
 */

export interface TimelineRendererConfig {
  /** The scrollable timeline container element */
  timelineEl: HTMLDivElement
  /** Getter for current zoom (pixels per second) */
  getZoom: () => number
  /** Getter for snap function: time → snapped time */
  getSnap: (time: number) => number
  /** Getter for current DAW instance */
  getDaw: () => any | null
  /** Callback to commit playhead to React (only on mouseup / stop) */
  onCommitPlayhead: (time: number) => void
  /** Callback to commit loop bounds to React (only on mouseup) */
  onCommitLoopBounds: (start: number, end: number) => void
  /** Max timeline duration in seconds */
  maxSeconds: number
  /** Track header width in pixels */
  headerWidth: number
  /** Timeline header height in pixels */
  timelineHeight: number
  /** Track height in pixels */
  trackHeight: number
}

/**
 * Manages all real-time DOM updates for the DAW timeline:
 * - Playhead position (via rAF during playback)
 * - Time display text
 * - Level meters
 * - Loop handle dragging
 * - Playhead / timeline scrubbing
 */
export class TimelineRenderer {
  private config: TimelineRendererConfig
  private rafId: number | null = null
  private disposed = false

  // DOM element refs — set via bind() after React mount
  private playheadLineEl: HTMLDivElement | null = null
  private timeDisplayEl: HTMLElement | null = null
  private secondsDisplayEl: HTMLElement | null = null
  private levelMeterEls: Map<string, HTMLDivElement> = new Map()
  private loopStartEl: HTMLDivElement | null = null
  private loopEndEl: HTMLDivElement | null = null
  private loopRegionEl: HTMLDivElement | null = null

  // Internal state (not React)
  private _playhead = 0
  private _isPlaying = false
  private _loopEnabled = false
  private _loopStart = 0
  private _loopEnd = 32

  // Level metering
  private levelIntervalId: NodeJS.Timeout | null = null

  constructor(config: TimelineRendererConfig) {
    this.config = config
  }

  // ─── DOM Binding ───────────────────────────────────────────────────

  /**
   * Bind DOM elements after React first render.
   * Call this once from a useEffect.
   */
  bindPlayhead(lineEl: HTMLDivElement) {
    this.playheadLineEl = lineEl
  }

  bindTimeDisplay(barsEl: HTMLElement, secsEl: HTMLElement) {
    this.timeDisplayEl = barsEl
    this.secondsDisplayEl = secsEl
  }

  bindLevelMeter(trackId: string, el: HTMLDivElement) {
    this.levelMeterEls.set(trackId, el)
  }

  unbindLevelMeter(trackId: string) {
    this.levelMeterEls.delete(trackId)
  }

  bindLoopHandles(startEl: HTMLDivElement, endEl: HTMLDivElement, regionEl: HTMLDivElement) {
    this.loopStartEl = startEl
    this.loopEndEl = endEl
    this.loopRegionEl = regionEl
  }

  // ─── Playhead ──────────────────────────────────────────────────────

  /** Get the current playhead position (imperative, not React state) */
  get playhead(): number {
    return this._playhead
  }

  /** Set playhead visually without React. Used during scrub / drag. */
  setPlayheadVisual(time: number) {
    this._playhead = time
    this.updatePlayheadDOM()
  }

  /** Start the playback animation loop */
  startPlayback() {
    this._isPlaying = true
    this.animationLoop()
  }

  /** Stop the playback animation loop and commit final position to React */
  stopPlayback() {
    this._isPlaying = false
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
    this.config.onCommitPlayhead(this._playhead)
  }

  private animationLoop = () => {
    if (this.disposed || !this._isPlaying) return
    const daw = this.config.getDaw()
    if (!daw) return

    const currentTime = daw.getCurrentTime()

    // Handle looping
    if (this._loopEnabled && currentTime >= this._loopEnd) {
      daw.seekTo(this._loopStart)
    } else {
      this._playhead = currentTime
      this.updatePlayheadDOM()
    }

    this.rafId = requestAnimationFrame(this.animationLoop)
  }

  private updatePlayheadDOM() {
    const zoom = this.config.getZoom()
    const leftPx = this._playhead * zoom

    // Move the playhead line
    if (this.playheadLineEl) {
      this.playheadLineEl.style.left = `${leftPx}px`
    }

    // Update bars:beats display
    if (this.timeDisplayEl) {
      this.timeDisplayEl.textContent = this.formatBarsBeats(this._playhead)
    }

    // Update seconds display
    if (this.secondsDisplayEl) {
      const mins = Math.floor(this._playhead / 60)
      const secs = Math.floor(this._playhead % 60)
      const cs = Math.floor((this._playhead % 1) * 100)
      this.secondsDisplayEl.textContent = `${mins}:${String(secs).padStart(2, '0')}.${String(cs).padStart(2, '0')}`
    }
  }

  private formatBarsBeats(time: number): string {
    const daw = this.config.getDaw()
    const bpm = daw?.getBPM?.() || 120
    const beatsPerBar = 4
    const beatDuration = 60 / bpm
    const totalBeats = time / beatDuration
    const bar = Math.floor(totalBeats / beatsPerBar) + 1
    const beat = Math.floor(totalBeats % beatsPerBar) + 1
    const tick = Math.floor(((totalBeats % 1) * 960) % 960)
    return `${bar}.${beat}.${String(tick).padStart(3, '0')}`
  }

  // ─── Level Meters (imperative DOM) ─────────────────────────────────

  startLevelMetering() {
    this.stopLevelMetering()
    this.levelIntervalId = setInterval(() => {
      const daw = this.config.getDaw()
      if (!daw) return
      const trackManager = daw.getTrackManager()
      if (!trackManager) return
      const tracks = trackManager.getTracks()

      for (const track of tracks) {
        const el = this.levelMeterEls.get(track.id)
        if (!el) continue
        const node = trackManager.getRoutingNode(track.id)
        if (!node?.analyserNode) {
          el.style.width = '0%'
          continue
        }
        const dataArray = new Uint8Array(node.analyserNode.frequencyBinCount)
        node.analyserNode.getByteTimeDomainData(dataArray)
        let sum = 0
        for (let i = 0; i < dataArray.length; i++) {
          const n = (dataArray[i] - 128) / 128
          sum += n * n
        }
        const rms = Math.sqrt(sum / dataArray.length)
        const pct = Math.min(100, rms * 200)
        el.style.width = `${pct}%`
      }
    }, 1000 / 30) // 30fps is enough for level meters
  }

  stopLevelMetering() {
    if (this.levelIntervalId !== null) {
      clearInterval(this.levelIntervalId)
      this.levelIntervalId = null
    }
    // Reset all meters
    this.levelMeterEls.forEach(el => { el.style.width = '0%' })
  }

  // ─── Loop Region ───────────────────────────────────────────────────

  setLoopState(enabled: boolean, start: number, end: number) {
    this._loopEnabled = enabled
    this._loopStart = start
    this._loopEnd = end
    this.updateLoopDOM()
  }

  /** Visual-only update during loop-handle drag (no React) */
  setLoopBoundsVisual(start: number, end: number) {
    this._loopStart = start
    this._loopEnd = end
    this.updateLoopDOM()
  }

  /** Commit loop bounds to React (call on mouseup) */
  commitLoopBounds() {
    this.config.onCommitLoopBounds(this._loopStart, this._loopEnd)
  }

  private updateLoopDOM() {
    const zoom = this.config.getZoom()
    if (this.loopStartEl) {
      this.loopStartEl.style.left = `${this._loopStart * zoom}px`
    }
    if (this.loopEndEl) {
      this.loopEndEl.style.left = `${this._loopEnd * zoom}px`
    }
    if (this.loopRegionEl) {
      this.loopRegionEl.style.left = `${this._loopStart * zoom}px`
      this.loopRegionEl.style.width = `${(this._loopEnd - this._loopStart) * zoom}px`
    }
  }

  // ─── Scrub / Playhead Drag ─────────────────────────────────────────

  /**
   * Create a timeline scrub handler for mousedown on the ruler.
   * Returns the onMouseDown handler to attach to the ruler element.
   */
  createRulerScrubHandler(
    handlePause: () => void,
    handlePlay: () => Promise<void>,
    isPlayingGetter: () => boolean
  ) {
    return (e: React.MouseEvent) => {
      e.preventDefault()
      const wasPlaying = isPlayingGetter()
      if (wasPlaying) handlePause()

      const timeline = this.config.timelineEl
      const headerW = this.config.headerWidth
      const zoom = this.config.getZoom()

      const scrub = (clientX: number) => {
        const rect = timeline.getBoundingClientRect()
        const x = clientX - rect.left + timeline.scrollLeft - headerW
        const time = Math.max(0, Math.min(this.config.maxSeconds, x / zoom))
        this.setPlayheadVisual(time)
      }

      scrub(e.clientX)

      const handleMove = (moveE: MouseEvent) => scrub(moveE.clientX)
      const handleUp = (upE: MouseEvent) => {
        scrub(upE.clientX)
        const daw = this.config.getDaw()
        if (daw) {
          daw.seekTo(this._playhead).then(() => {
            this.config.onCommitPlayhead(this._playhead)
            if (wasPlaying) handlePlay()
          })
        }
        window.removeEventListener('mousemove', handleMove)
        window.removeEventListener('mouseup', handleUp)
      }
      window.addEventListener('mousemove', handleMove)
      window.addEventListener('mouseup', handleUp)
    }
  }

  /**
   * Create a playhead-line drag handler.
   * Returns the onMouseDown handler to attach to the playhead line element.
   */
  createPlayheadDragHandler(
    handlePause: () => void,
    handlePlay: () => Promise<void>,
    isPlayingGetter: () => boolean
  ) {
    return (e: React.MouseEvent) => {
      e.stopPropagation()
      const startX = e.clientX
      const startPlayhead = this._playhead
      const zoom = this.config.getZoom()
      const wasPlaying = isPlayingGetter()
      if (wasPlaying) handlePause()

      const handleMove = (moveE: MouseEvent) => {
        const delta = (moveE.clientX - startX) / zoom
        const newTime = Math.max(0, Math.min(this.config.maxSeconds, startPlayhead + delta))
        this.setPlayheadVisual(newTime)
      }

      const handleUp = (upE: MouseEvent) => {
        const delta = (upE.clientX - startX) / zoom
        const finalTime = Math.max(0, Math.min(this.config.maxSeconds, startPlayhead + delta))
        const daw = this.config.getDaw()
        if (daw) {
          daw.seekTo(finalTime).then(() => {
            this.config.onCommitPlayhead(finalTime)
            if (wasPlaying) handlePlay()
          })
        }
        window.removeEventListener('mousemove', handleMove)
        window.removeEventListener('mouseup', handleUp)
      }
      window.addEventListener('mousemove', handleMove)
      window.addEventListener('mouseup', handleUp)
    }
  }

  /**
   * Create a loop-handle drag handler.
   * Returns an onMouseDown handler for the loop start/end handles.
   */
  createLoopHandleDragHandler(handle: 'start' | 'end') {
    return (e: React.MouseEvent) => {
      e.stopPropagation()
      e.preventDefault()
      const timeline = this.config.timelineEl
      const headerW = this.config.headerWidth

      const handleMove = (moveE: MouseEvent) => {
        const rect = timeline.getBoundingClientRect()
        const x = moveE.clientX - rect.left + timeline.scrollLeft - headerW
        const zoom = this.config.getZoom()
        const time = Math.max(0, this.config.getSnap(x / zoom))
        if (handle === 'start') {
          this.setLoopBoundsVisual(Math.min(time, this._loopEnd - 0.25), this._loopEnd)
        } else {
          this.setLoopBoundsVisual(this._loopStart, Math.max(time, this._loopStart + 0.25))
        }
      }

      const handleUp = () => {
        this.commitLoopBounds()
        window.removeEventListener('mousemove', handleMove)
        window.removeEventListener('mouseup', handleUp)
      }

      window.addEventListener('mousemove', handleMove)
      window.addEventListener('mouseup', handleUp)
    }
  }

  // ─── Lifecycle ─────────────────────────────────────────────────────

  dispose() {
    this.disposed = true
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
    this.stopLevelMetering()
    this.playheadLineEl = null
    this.timeDisplayEl = null
    this.secondsDisplayEl = null
    this.levelMeterEls.clear()
    this.loopStartEl = null
    this.loopEndEl = null
    this.loopRegionEl = null
  }
}
