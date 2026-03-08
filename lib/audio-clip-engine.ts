// ═══════════════════════════════════════════════════════════════
//  AUDIO CLIP ENGINE — Web Audio scheduled playback for
//  audio clips placed on the arrangement timeline.
//
//  Syncs with the Strudel scheduler so clips play at the exact
//  bar position they're placed on.  Supports recording from
//  microphone, uploading audio files, and cut/copy/paste.
//
//  Resolution: 1/64 bar (0.015625 bar increments).
// ═══════════════════════════════════════════════════════════════

// ─── Constants ───

/** Smallest grid snap unit in bars (1/64 bar) */
export const CLIP_GRID = 1 / 64

/** Snap a bar position to the nearest 1/64 grid */
export function snapToGrid(bar: number): number {
  return Math.round(bar / CLIP_GRID) * CLIP_GRID
}

// ─── Types ───

export interface AudioClip {
  id: string
  name: string
  /** AudioBuffer decoded from the source file/recording */
  buffer: AudioBuffer
  /** Blob URL for display / re-use (revoked on delete) */
  blobUrl: string
  /** Start position in absolute bars (can be fractional, 1/64 precision) */
  startBar: number
  /** Duration in bars (derived from buffer.duration and BPM unless trimmed) */
  durationBars: number
  /** Index of audio track lane (0-based) */
  trackIndex: number
  /** Playback gain 0..2 */
  gain: number
  /** Trim start in seconds (offset into the buffer) */
  trimStart: number
  /** Trim end in seconds (offset from buffer end to cut) */
  trimEnd: number
  /** Colour accent for the clip block */
  color: string
}

export interface AudioTrack {
  id: string
  name: string
  color: string
  /** Track-level gain */
  gain: number
  /** Track-level mute */
  muted: boolean
  /** Track-level solo */
  soloed: boolean
}

/** Clipboard for cut/copy/paste */
export interface ClipClipboard {
  clip: Omit<AudioClip, 'id'>
  mode: 'copy' | 'cut'
  /** Original clip id (for cut — so we can remove it) */
  originalId?: string
}

// ─── ID helpers ───

let _clipIdCounter = 0
export function nextClipId(): string { return `clip-${++_clipIdCounter}-${Date.now().toString(36)}` }

let _trackIdCounter = 0
export function nextTrackId(): string { return `atrk-${++_trackIdCounter}` }

// ─── Track colours ───

const TRACK_COLORS = [
  '#f97316', '#22d3ee', '#a78bfa', '#f43f5e', '#10b981',
  '#eab308', '#ec4899', '#3b82f6', '#14b8a6', '#ef4444',
]

export function trackColor(idx: number): string {
  return TRACK_COLORS[idx % TRACK_COLORS.length]
}

// ─── BPM / duration helpers ───

/** Convert seconds to bars at a given BPM (4/4 time) */
export function secondsToBars(seconds: number, bpm: number): number {
  const beatsPerSecond = bpm / 60
  const barsPerSecond = beatsPerSecond / 4  // 4 beats per bar in 4/4
  return seconds * barsPerSecond
}

/** Convert bars to seconds at a given BPM (4/4 time) */
export function barsToSeconds(bars: number, bpm: number): number {
  const beatsPerSecond = bpm / 60
  const barsPerSecond = beatsPerSecond / 4
  return bars / barsPerSecond
}

// ─── Default track factory ───

export function createDefaultTrack(idx: number): AudioTrack {
  return {
    id: nextTrackId(),
    name: `Audio ${idx + 1}`,
    color: trackColor(idx),
    gain: 1,
    muted: false,
    soloed: false,
  }
}

// ─── Clip creation from buffer ───

export function createClipFromBuffer(
  buffer: AudioBuffer,
  blobUrl: string,
  name: string,
  startBar: number,
  trackIndex: number,
  bpm: number,
  color?: string,
): AudioClip {
  return {
    id: nextClipId(),
    name,
    buffer,
    blobUrl,
    startBar: snapToGrid(startBar),
    durationBars: secondsToBars(buffer.duration, bpm),
    trackIndex,
    gain: 1,
    trimStart: 0,
    trimEnd: 0,
    color: color || trackColor(trackIndex),
  }
}

// ═══════════════════════════════════════════════════════════════
//  SCHEDULED PLAYBACK ENGINE
//  Schedules AudioBufferSourceNodes to play clips at the correct
//  time relative to the Strudel transport.
// ═══════════════════════════════════════════════════════════════

export class ClipPlaybackEngine {
  private ctx: AudioContext
  private masterGain: GainNode
  private activeSources: Map<string, AudioBufferSourceNode> = new Map()
  private trackGains: Map<string, GainNode> = new Map()
  private scheduledClips: Set<string> = new Set()
  private rafId: number | null = null
  private lastScheduledCycle = -1

  constructor(ctx: AudioContext) {
    this.ctx = ctx
    this.masterGain = ctx.createGain()
    this.masterGain.connect(ctx.destination)
  }

  /** Get or create a gain node for a track */
  private getTrackGain(trackId: string, gain: number): GainNode {
    let node = this.trackGains.get(trackId)
    if (!node) {
      node = this.ctx.createGain()
      node.connect(this.masterGain)
      this.trackGains.set(trackId, node)
    }
    node.gain.value = gain
    return node
  }

  /**
   * Schedule all clips that should start within the upcoming window.
   * Called repeatedly from a rAF loop while playing.
   *
   * @param currentCycle  Current Strudel cycle position (fractional bars)
   * @param bpm           Project BPM
   * @param clips         All audio clips
   * @param tracks        All audio tracks
   * @param totalBars     Total arrangement bars (for looping)
   */
  scheduleClips(
    currentCycle: number,
    bpm: number,
    clips: AudioClip[],
    tracks: AudioTrack[],
    totalBars: number,
  ): void {
    if (totalBars <= 0) return
    const now = this.ctx.currentTime
    // Look-ahead window: 200ms
    const lookAheadSec = 0.2
    const beatsPerSec = bpm / 60
    const barsPerSec = beatsPerSec / 4
    const lookAheadBars = lookAheadSec * barsPerSec

    const cycleWrapped = currentCycle % totalBars

    // Check which tracks are soloed
    const anyTrackSoloed = tracks.some(t => t.soloed)

    for (const clip of clips) {
      const track = tracks[clip.trackIndex]
      if (!track) continue
      if (track.muted) continue
      if (anyTrackSoloed && !track.soloed) continue

      // Compare clip start against the current window
      const clipStart = clip.startBar % totalBars
      let delta = clipStart - cycleWrapped
      // Handle wrapping around arrangement end
      if (delta < -totalBars / 2) delta += totalBars
      if (delta > totalBars / 2) delta -= totalBars

      // Only schedule clips in the near future (not already scheduled this pass)
      if (delta >= 0 && delta < lookAheadBars) {
        const scheduleKey = `${clip.id}@${Math.floor(currentCycle / totalBars)}`
        if (this.scheduledClips.has(scheduleKey)) continue

        const startTimeSec = now + (delta / barsPerSec)
        this.playClip(clip, track, startTimeSec, scheduleKey)
      }
    }

    // Clean old schedule keys (keep only recent loop pass)
    const currentPass = Math.floor(currentCycle / totalBars)
    for (const key of this.scheduledClips) {
      const pass = parseInt(key.split('@')[1])
      if (pass < currentPass - 1) this.scheduledClips.delete(key)
    }
  }

  private playClip(clip: AudioClip, track: AudioTrack, when: number, scheduleKey: string): void {
    const source = this.ctx.createBufferSource()
    source.buffer = clip.buffer

    // Per-clip gain
    const clipGain = this.ctx.createGain()
    clipGain.gain.value = clip.gain

    // Connect through track gain
    const trackGain = this.getTrackGain(track.id, track.gain)
    source.connect(clipGain)
    clipGain.connect(trackGain)

    // Trim: offset into buffer, and limit duration
    const offset = clip.trimStart
    const maxDuration = clip.buffer.duration - clip.trimStart - clip.trimEnd
    const duration = Math.max(0.001, maxDuration)

    source.start(when, offset, duration)
    this.scheduledClips.add(scheduleKey)
    this.activeSources.set(scheduleKey, source)

    source.onended = () => {
      this.activeSources.delete(scheduleKey)
    }
  }

  /** Stop all currently playing clip sources */
  stopAll(): void {
    for (const [key, source] of this.activeSources) {
      try { source.stop() } catch { /* already stopped */ }
    }
    this.activeSources.clear()
    this.scheduledClips.clear()
  }

  /** Start the scheduling loop */
  startLoop(
    getCyclePosition: () => number | null,
    bpm: number,
    clips: AudioClip[],
    tracks: AudioTrack[],
    totalBars: number,
  ): void {
    this.stopLoop()
    // Store refs for the rAF callback to access mutable data
    const state = { clips, tracks, totalBars, bpm }
    const tick = () => {
      const pos = getCyclePosition()
      if (pos !== null && pos >= 0) {
        this.scheduleClips(pos, state.bpm, state.clips, state.tracks, state.totalBars)
      }
      this.rafId = requestAnimationFrame(tick)
    }
    this.rafId = requestAnimationFrame(tick)
    // Expose state object so caller can update clips/tracks/bpm without restarting
    ;(this as any)._loopState = state
  }

  /** Update the mutable scheduling state without restarting the loop */
  updateLoopState(clips: AudioClip[], tracks: AudioTrack[], totalBars: number, bpm: number): void {
    const state = (this as any)._loopState
    if (state) {
      state.clips = clips
      state.tracks = tracks
      state.totalBars = totalBars
      state.bpm = bpm
    }
  }

  /** Stop the scheduling loop and all sources */
  stopLoop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
    this.stopAll()
  }

  /** Clean up */
  destroy(): void {
    this.stopLoop()
    this.trackGains.forEach(g => g.disconnect())
    this.trackGains.clear()
    this.masterGain.disconnect()
  }
}

// ═══════════════════════════════════════════════════════════════
//  RECORDING HELPER
//  Uses MediaRecorder API to capture mic input, returns
//  an AudioBuffer ready to be placed as a clip.
// ═══════════════════════════════════════════════════════════════

export interface RecordingResult {
  buffer: AudioBuffer
  blobUrl: string
  blob: Blob
}

export async function startRecording(ctx: AudioContext): Promise<{
  stop: () => Promise<RecordingResult>
  cancel: () => void
  stream: MediaStream
}> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  const recorder = new MediaRecorder(stream, {
    mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/webm',
  })
  const chunks: Blob[] = []
  recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data) }
  recorder.start(100) // 100ms timeslice for progressive data

  return {
    stream,
    stop: () => new Promise<RecordingResult>((resolve, reject) => {
      recorder.onstop = async () => {
        // Stop all mic tracks
        stream.getTracks().forEach(t => t.stop())
        const blob = new Blob(chunks, { type: recorder.mimeType })
        try {
          const arrayBuf = await blob.arrayBuffer()
          const buffer = await ctx.decodeAudioData(arrayBuf)
          const blobUrl = URL.createObjectURL(blob)
          resolve({ buffer, blobUrl, blob })
        } catch (err) {
          reject(err)
        }
      }
      recorder.stop()
    }),
    cancel: () => {
      try { recorder.stop() } catch { /* ignore */ }
      stream.getTracks().forEach(t => t.stop())
    },
  }
}

// ═══════════════════════════════════════════════════════════════
//  FILE UPLOAD HELPER
//  Decodes an uploaded audio file into an AudioBuffer.
// ═══════════════════════════════════════════════════════════════

export async function decodeAudioFile(
  file: File,
  ctx: AudioContext,
): Promise<{ buffer: AudioBuffer; blobUrl: string }> {
  const arrayBuf = await file.arrayBuffer()
  const buffer = await ctx.decodeAudioData(arrayBuf)
  const blobUrl = URL.createObjectURL(file)
  return { buffer, blobUrl }
}

// ═══════════════════════════════════════════════════════════════
//  WAVEFORM DATA
//  Generate downsampled peaks from an AudioBuffer for drawing
//  mini waveforms on clips.
// ═══════════════════════════════════════════════════════════════

export function getWaveformPeaks(buffer: AudioBuffer, numSamples: number): Float32Array {
  const chan = buffer.getChannelData(0)
  const peaks = new Float32Array(numSamples)
  const blockSize = Math.floor(chan.length / numSamples) || 1
  for (let i = 0; i < numSamples; i++) {
    let max = 0
    const start = i * blockSize
    const end = Math.min(start + blockSize, chan.length)
    for (let j = start; j < end; j++) {
      const abs = Math.abs(chan[j])
      if (abs > max) max = abs
    }
    peaks[i] = max
  }
  return peaks
}

// ═══════════════════════════════════════════════════════════════
//  CLIP OPERATIONS (cut / copy / paste / duplicate / split)
// ═══════════════════════════════════════════════════════════════

/** Duplicate a clip at a new position */
export function duplicateClip(clip: AudioClip, newStartBar?: number): AudioClip {
  return {
    ...clip,
    id: nextClipId(),
    startBar: snapToGrid(newStartBar ?? clip.startBar + clip.durationBars),
  }
}

/** Split a clip at a bar position (returns [left, right] or null if position is outside) */
export function splitClip(clip: AudioClip, atBar: number, bpm: number): [AudioClip, AudioClip] | null {
  const relBar = atBar - clip.startBar
  if (relBar <= 0 || relBar >= clip.durationBars) return null

  const splitSec = barsToSeconds(relBar, bpm)

  const left: AudioClip = {
    ...clip,
    id: nextClipId(),
    durationBars: relBar,
    trimEnd: clip.buffer.duration - (clip.trimStart + splitSec),
  }

  const right: AudioClip = {
    ...clip,
    id: nextClipId(),
    startBar: snapToGrid(atBar),
    durationBars: clip.durationBars - relBar,
    trimStart: clip.trimStart + splitSec,
  }

  return [left, right]
}
