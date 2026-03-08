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
  /** Playback rate multiplier (1 = normal, >1 = faster). Set by Auto-Sync. */
  playbackRate: number
  /** Pitch shift in cents. Set by Auto-Pitch. */
  detuneCents: number
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
    playbackRate: 1,
    detuneCents: 0,
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
  private activeSources: Map<string, { source: AudioBufferSourceNode; clipGain: GainNode }> = new Map()
  private trackGains: Map<string, GainNode> = new Map()
  private scheduledClips: Set<string> = new Set()
  private rafId: number | null = null
  private lastPass = -1   // Track loop pass to detect wrapping

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
   * Detects transport loop and stops all playing clips when the
   * arrangement wraps around so vocals don't bleed into the next pass.
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
    const beatsPerSec = bpm / 60
    const barsPerSec = beatsPerSec / 4
    // Look-ahead window: 200ms
    const lookAheadBars = 0.2 * barsPerSec

    const currentPass = Math.floor(currentCycle / totalBars)
    const cycleWrapped = currentCycle % totalBars

    // ── LOOP WRAP DETECTION ──
    // When the transport loops back to the beginning, stop ALL
    // playing sources so long clips (vocals) don't keep going
    if (currentPass !== this.lastPass && this.lastPass >= 0) {
      this.stopAll()
    }
    this.lastPass = currentPass

    // Check which tracks are soloed
    const anyTrackSoloed = tracks.some(t => t.soloed)

    for (const clip of clips) {
      const track = tracks[clip.trackIndex]
      if (!track) continue
      if (track.muted) continue
      if (anyTrackSoloed && !track.soloed) continue

      // Effective clip end after trim
      const effectiveDurationBars = clip.durationBars - secondsToBars(clip.trimStart + clip.trimEnd, bpm)
      const clipStart = clip.startBar % totalBars
      const clipEnd = clipStart + effectiveDurationBars

      // Compare clip start against the current window
      let delta = clipStart - cycleWrapped
      // Handle wrapping around arrangement end
      if (delta < -totalBars / 2) delta += totalBars
      if (delta > totalBars / 2) delta -= totalBars

      // Only schedule clips in the near future (not already scheduled this pass)
      if (delta >= 0 && delta < lookAheadBars) {
        const scheduleKey = `${clip.id}@${currentPass}`
        if (this.scheduledClips.has(scheduleKey)) continue

        const startTimeSec = now + (delta / barsPerSec)

        // Limit play duration so clip stops at arrangement end
        const remainingBarsInArrangement = totalBars - clipStart
        const maxPlayBars = Math.min(effectiveDurationBars, remainingBarsInArrangement)

        this.playClip(clip, track, startTimeSec, scheduleKey, maxPlayBars, bpm)
      }
    }

    // Clean old schedule keys (keep only recent loop pass)
    for (const key of this.scheduledClips) {
      const pass = parseInt(key.split('@')[1])
      if (pass < currentPass - 1) this.scheduledClips.delete(key)
    }
  }

  private playClip(clip: AudioClip, track: AudioTrack, when: number, scheduleKey: string, maxPlayBars: number, bpm: number): void {
    const source = this.ctx.createBufferSource()
    source.buffer = clip.buffer

    // Apply playback rate (Auto-Sync) and pitch shift (Auto-Pitch)
    const rate = clip.playbackRate || 1
    source.playbackRate.value = rate
    if (clip.detuneCents && clip.detuneCents !== 0) {
      source.detune.value = clip.detuneCents
    }

    // Per-clip gain
    const clipGain = this.ctx.createGain()
    clipGain.gain.value = clip.gain

    // Connect through track gain
    const trackGain = this.getTrackGain(track.id, track.gain)
    source.connect(clipGain)
    clipGain.connect(trackGain)

    // Trim: offset into buffer, and limit duration
    // When playbackRate != 1, the buffer plays faster/slower but
    // source.start(when, offset, duration) offset/duration are in
    // buffer-time (before rate), so we divide arrangement-time by rate.
    const offset = clip.trimStart
    const maxDurationFromTrim = (clip.buffer.duration - clip.trimStart - clip.trimEnd)
    // Arrangement boundary in real seconds, converted to buffer-seconds
    const maxDurationFromArrangement = barsToSeconds(maxPlayBars, bpm) / rate
    const duration = Math.max(0.001, Math.min(maxDurationFromTrim, maxDurationFromArrangement))

    source.start(when, offset, duration)
    this.scheduledClips.add(scheduleKey)
    this.activeSources.set(scheduleKey, { source, clipGain })

    source.onended = () => {
      this.activeSources.delete(scheduleKey)
    }
  }

  /** Stop all currently playing clip sources */
  stopAll(): void {
    for (const [, { source }] of this.activeSources) {
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
    this.lastPass = -1
    const state = { clips, tracks, totalBars, bpm }
    const tick = () => {
      const pos = getCyclePosition()
      if (pos !== null && pos >= 0) {
        this.scheduleClips(pos, state.bpm, state.clips, state.tracks, state.totalBars)
      }
      this.rafId = requestAnimationFrame(tick)
    }
    this.rafId = requestAnimationFrame(tick)
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

// ═══════════════════════════════════════════════════════════════
//  BPM DETECTION — onset-based tempo estimation
//  Analyses energy peaks (onsets) in the audio and finds the
//  most common inter-onset interval to estimate BPM.
// ═══════════════════════════════════════════════════════════════

/**
 * Detect the approximate BPM of an AudioBuffer using onset
 * energy analysis.  Returns null if the signal is too short
 * or too quiet to get a reliable estimate.
 *
 * Scans the first 30 seconds (or full buffer) at ~43 Hz (1024-sample
 * hop at 44.1 kHz) for energy peaks, then builds an inter-onset
 * interval histogram to find the dominant tempo.
 */
export function detectBPM(buffer: AudioBuffer): number | null {
  const data = buffer.getChannelData(0)
  const sr = buffer.sampleRate
  const hop = 1024
  // Limit analysis to first 30s
  const maxSamples = Math.min(data.length, sr * 30)
  const numFrames = Math.floor(maxSamples / hop)
  if (numFrames < 10) return null

  // 1) Compute RMS energy per frame
  const energy = new Float32Array(numFrames)
  for (let f = 0; f < numFrames; f++) {
    let sum = 0
    const start = f * hop
    const end = Math.min(start + hop, data.length)
    for (let i = start; i < end; i++) {
      sum += data[i] * data[i]
    }
    energy[f] = Math.sqrt(sum / (end - start))
  }

  // 2) Find onsets (frames where energy rises significantly)
  const onsets: number[] = []
  // Use a running mean for adaptive threshold
  const windowSize = 8
  for (let f = windowSize; f < numFrames; f++) {
    let localMean = 0
    for (let w = f - windowSize; w < f; w++) localMean += energy[w]
    localMean /= windowSize
    // Onset if current energy is 1.5× the local mean and above a minimum
    if (energy[f] > localMean * 1.5 && energy[f] > 0.01) {
      onsets.push(f)
    }
  }

  if (onsets.length < 4) return null

  // 3) Build histogram of inter-onset intervals (in BPM)
  // Resolution: 1 BPM bins from 60-200 BPM
  const minBpm = 60
  const maxBpm = 200
  const bins = new Float32Array(maxBpm - minBpm + 1)
  const frameDuration = hop / sr // seconds per frame

  for (let i = 0; i < onsets.length - 1; i++) {
    const gap = (onsets[i + 1] - onsets[i]) * frameDuration // seconds between onsets
    if (gap <= 0) continue
    // gap is the time between beats; try beat, half-beat, double-beat
    for (const mult of [1, 2, 0.5]) {
      const bpm = 60 / (gap * mult)
      if (bpm >= minBpm && bpm <= maxBpm) {
        const bin = Math.round(bpm) - minBpm
        bins[bin] += 1
      }
    }
  }

  // 4) Smooth the histogram with a ±2 BPM window
  const smooth = new Float32Array(bins.length)
  for (let i = 0; i < bins.length; i++) {
    let sum = 0
    for (let j = Math.max(0, i - 2); j <= Math.min(bins.length - 1, i + 2); j++) {
      sum += bins[j]
    }
    smooth[i] = sum
  }

  // 5) Find the peak
  let bestBin = 0
  let bestVal = 0
  for (let i = 0; i < smooth.length; i++) {
    if (smooth[i] > bestVal) {
      bestVal = smooth[i]
      bestBin = i
    }
  }

  if (bestVal < 3) return null // Not enough evidence
  return bestBin + minBpm
}

// ═══════════════════════════════════════════════════════════════
//  AUTO-PROCESS — one-shot BPM detect + sync + pitch
//  Called automatically when a clip is uploaded/recorded.
//  Mutates the clip in-place and returns analysis results.
// ═══════════════════════════════════════════════════════════════

export interface AutoProcessResult {
  /** Detected BPM of the audio (null if undetectable) */
  detectedBpm: number | null
  /** Sync result (playbackRate + bar-snapped duration) */
  sync: SyncResult
  /** Pitch result (detune cents) */
  pitch: PitchResult
}

/**
 * Automatically analyse a clip and return the playbackRate and
 * detuneCents values that should be applied.  Does NOT mutate
 * the clip — caller should set the returned values.
 */
export function autoProcessClip(clip: AudioClip, projectBpm: number, projectKey: string): AutoProcessResult {
  const detectedBpm = detectBPM(clip.buffer)
  const sync = calcAutoSyncRate(clip, projectBpm)
  const pitch = calcAutoPitch(clip, projectKey)

  console.log(
    `[444 STUDIO] Auto-Process: "${clip.name}" ` +
    `| BPM: ${detectedBpm ?? '?'} → project ${projectBpm} ` +
    `| Sync: ${sync.durationBars} bars @ ${sync.rate.toFixed(3)}x ` +
    `| Pitch: ${pitch.detectedNote ?? '?'} → ${pitch.targetNote} (${pitch.detuneCents.toFixed(0)}¢)`
  )

  return { detectedBpm, sync, pitch }
}

// ═══════════════════════════════════════════════════════════════
//  AUTO-SYNC — adjust clip playbackRate so it fits an integer
//  number of bars at the project BPM.
//
//  Returns the playbackRate multiplier and the new durationBars.
//  The caller stores these and uses the rate when scheduling.
// ═══════════════════════════════════════════════════════════════

export interface SyncResult {
  /** playbackRate to apply (>1 = faster, <1 = slower) */
  rate: number
  /** New clip durationBars after sync */
  durationBars: number
  /** Nearest whole-bar count the clip was snapped to */
  targetBars: number
}

/**
 * Calculate the playbackRate needed to stretch/compress an audio
 * clip so that it lands on the nearest whole-bar boundary at the
 * project BPM.  Does not mutate the clip.
 */
export function calcAutoSyncRate(clip: AudioClip, bpm: number): SyncResult {
  const effectiveSec = clip.buffer.duration - clip.trimStart - clip.trimEnd
  const naturalBars = secondsToBars(effectiveSec, bpm)
  // Snap to nearest whole bar (min 1)
  const targetBars = Math.max(1, Math.round(naturalBars))
  const targetSec = barsToSeconds(targetBars, bpm)
  const rate = effectiveSec / targetSec   // speed up if clip is too long
  return { rate, durationBars: targetBars, targetBars }
}

// ═══════════════════════════════════════════════════════════════
//  AUTO-PITCH — estimate fundamental frequency of a clip and
//  return the detune (cents) needed to shift it to a target note.
//
//  Uses autocorrelation pitch detection on a short segment of
//  the audio (first 2 seconds, or the whole buffer if shorter).
// ═══════════════════════════════════════════════════════════════

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const

export interface PitchResult {
  /** Detected fundamental frequency (Hz), or null if unable to detect */
  detectedHz: number | null
  /** Nearest named note */
  detectedNote: string | null
  /** Detune in cents to shift from detected pitch to target root */
  detuneCents: number
  /** Target note the clip will be shifted to */
  targetNote: string
}

/**
 * Simple autocorrelation pitch detector.
 * Returns the estimated fundamental frequency (Hz) or null.
 */
function detectPitch(buffer: AudioBuffer, sampleRate: number): number | null {
  const data = buffer.getChannelData(0)
  // Analyse the first 2 seconds (or full buffer)
  const len = Math.min(data.length, sampleRate * 2)
  // Minimum/maximum expected frequencies (human vocal range 80-1000 Hz)
  const minPeriod = Math.floor(sampleRate / 1000)
  const maxPeriod = Math.floor(sampleRate / 80)
  if (len < maxPeriod * 2) return null

  let bestCorrelation = 0
  let bestPeriod = 0

  for (let period = minPeriod; period <= maxPeriod; period++) {
    let correlation = 0
    let energy1 = 0
    let energy2 = 0
    const n = Math.min(len - period, maxPeriod * 2)
    for (let i = 0; i < n; i++) {
      correlation += data[i] * data[i + period]
      energy1 += data[i] * data[i]
      energy2 += data[i + period] * data[i + period]
    }
    const norm = Math.sqrt(energy1 * energy2)
    if (norm > 0) correlation /= norm
    if (correlation > bestCorrelation) {
      bestCorrelation = correlation
      bestPeriod = period
    }
  }

  // Require decent correlation
  if (bestCorrelation < 0.5 || bestPeriod === 0) return null
  return sampleRate / bestPeriod
}

/**
 * Calculate the detune (in cents) required to shift a clip's
 * detected pitch to the nearest occurrence of `targetRoot` note.
 *
 * @param clip        The audio clip to analyse
 * @param targetRoot  Target root note name, e.g. "C", "F#", "Bb"
 */
export function calcAutoPitch(clip: AudioClip, targetRoot: string): PitchResult {
  const sr = clip.buffer.sampleRate
  const hz = detectPitch(clip.buffer, sr)

  // Normalise target to sharp notation
  const normTarget = targetRoot.replace('b', '')
    .replace('Db', 'C#').replace('Eb', 'D#').replace('Gb', 'F#')
    .replace('Ab', 'G#').replace('Bb', 'A#')
  const targetIdx = NOTE_NAMES.indexOf(normTarget as any)
  const targetNote = targetIdx >= 0 ? NOTE_NAMES[targetIdx] : 'C'
  const targetNoteIdx = targetIdx >= 0 ? targetIdx : 0

  if (hz === null) {
    return { detectedHz: null, detectedNote: null, detuneCents: 0, targetNote }
  }

  // MIDI note number (A4 = 69 = 440 Hz)
  const midiFloat = 69 + 12 * Math.log2(hz / 440)
  const midiNote = Math.round(midiFloat)
  const detectedPitchClass = ((midiNote % 12) + 12) % 12
  const detectedNote = NOTE_NAMES[detectedPitchClass]

  // Find the smallest interval (in semitones) to get to targetNoteIdx
  let semitoneDiff = targetNoteIdx - detectedPitchClass
  if (semitoneDiff > 6) semitoneDiff -= 12
  if (semitoneDiff < -6) semitoneDiff += 12

  // Also account for the fractional cents the detected pitch is off from its nearest note
  const centsOffFromNearest = (midiFloat - midiNote) * 100
  const detuneCents = semitoneDiff * 100 - centsOffFromNearest

  return { detectedHz: hz, detectedNote, detuneCents, targetNote }
}

// ═══════════════════════════════════════════════════════════════
//  AUDIO-TO-INSTRUMENT — extract from a clip the data needed
//  to register it as a Strudel sample and create a piano-roll
//  channel.  Returns the trimmed blob URL and metadata.
// ═══════════════════════════════════════════════════════════════

export interface InstrumentFromClipResult {
  /** Unique sound name for Strudel registration */
  soundName: string
  /** Blob URL that Strudel can fetch as a sample */
  sampleUrl: string
  /** Begin fraction (0..1 into buffer) — for .begin() */
  begin: number
  /** End fraction (0..1 into buffer) — for .end() */
  end: number
  /** Duration in bars of the trimmed region (for loopAt) */
  loopBars: number
}

let _instrCounter = 0

/**
 * Prepare metadata for registering a clip as a playable instrument.
 * Does not mutate the clip.
 */
export function prepareInstrumentFromClip(clip: AudioClip, bpm: number): InstrumentFromClipResult {
  const dur = clip.buffer.duration
  const begin = dur > 0 ? clip.trimStart / dur : 0
  const end = dur > 0 ? 1 - (clip.trimEnd / dur) : 1
  const effectiveSec = dur - clip.trimStart - clip.trimEnd
  const loopBars = secondsToBars(effectiveSec, bpm)
  const soundName = `clip${++_instrCounter}_${clip.name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 12)}`

  return {
    soundName,
    sampleUrl: clip.blobUrl,
    begin: Math.max(0, Math.min(1, begin)),
    end: Math.max(0, Math.min(1, end)),
    loopBars: Math.max(0.25, loopBars),
  }
}
