// ═══════════════════════════════════════════════════════════════
//  PITCH DETECTION — YIN algorithm for fundamental frequency
//
//  Uses the YIN autocorrelation method to detect the dominant
//  pitch (F0) from raw PCM audio data. Works entirely client-side
//  using Web Audio API AudioBuffer data.
//
//  References:
//  - "YIN, a fundamental frequency estimator for speech and music"
//    (Alain de Cheveigné & Hideki Kawahara, 2002)
// ═══════════════════════════════════════════════════════════════

/** Note names for pitch-to-note mapping */
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const

/** Pitch detection result */
export interface PitchResult {
  /** Detected frequency in Hz */
  frequency: number
  /** MIDI note number (69 = A4) */
  midiNote: number
  /** Note name (e.g. "A", "C#") */
  noteName: string
  /** Octave number */
  octave: number
  /** Cents deviation from nearest note (-50 to +50) */
  cents: number
  /** Confidence 0–1 (lower YIN threshold = higher confidence) */
  confidence: number
  /** Full note string e.g. "A4", "C#3" */
  noteString: string
}

/** Detection options */
export interface PitchDetectionOptions {
  /** YIN threshold (0.05–0.20, lower = stricter). Default: 0.15 */
  threshold?: number
  /** Minimum frequency to detect in Hz. Default: 50 (≈G1) */
  minFrequency?: number
  /** Maximum frequency to detect in Hz. Default: 2000 (≈B6) */
  maxFrequency?: number
  /** Sample region start (0–1 normalized). Default: 0 */
  regionStart?: number
  /** Sample region end (0–1 normalized). Default: 1 */
  regionEnd?: number
}

/**
 * YIN pitch detection on raw float32 audio samples.
 * Returns null if no confident pitch is found.
 */
function yinDetect(
  samples: Float32Array,
  sampleRate: number,
  threshold: number,
  minFreq: number,
  maxFreq: number
): { frequency: number; confidence: number } | null {
  // YIN step 1: Compute difference function
  const halfLen = Math.floor(samples.length / 2)
  const minPeriod = Math.max(2, Math.floor(sampleRate / maxFreq))
  const maxPeriod = Math.min(halfLen, Math.floor(sampleRate / minFreq))

  if (maxPeriod <= minPeriod || halfLen < minPeriod * 2) return null

  // Step 2: Difference function d(τ)
  const diff = new Float32Array(maxPeriod + 1)
  for (let tau = minPeriod; tau <= maxPeriod; tau++) {
    let sum = 0
    for (let i = 0; i < halfLen; i++) {
      const delta = samples[i] - samples[i + tau]
      sum += delta * delta
    }
    diff[tau] = sum
  }

  // Step 3: Cumulative mean normalized difference (CMND)
  const cmnd = new Float32Array(maxPeriod + 1)
  cmnd[0] = 1
  let runningSum = 0
  for (let tau = 1; tau <= maxPeriod; tau++) {
    runningSum += diff[tau]
    cmnd[tau] = runningSum > 0 ? (diff[tau] * tau) / runningSum : 1
  }

  // Step 4: Absolute threshold — find first tau where cmnd < threshold
  let bestTau = -1
  for (let tau = minPeriod; tau <= maxPeriod; tau++) {
    if (cmnd[tau] < threshold) {
      // Step 5: Parabolic interpolation for sub-sample accuracy
      // Find the local minimum in this dip
      while (tau + 1 <= maxPeriod && cmnd[tau + 1] < cmnd[tau]) {
        tau++
      }
      bestTau = tau
      break
    }
  }

  // If no dip below threshold, find global minimum as fallback
  if (bestTau < 0) {
    let minVal = Infinity
    for (let tau = minPeriod; tau <= maxPeriod; tau++) {
      if (cmnd[tau] < minVal) {
        minVal = cmnd[tau]
        bestTau = tau
      }
    }
    // Only use global minimum if it's reasonably low
    if (bestTau < 0 || cmnd[bestTau] > 0.5) return null
  }

  // Parabolic interpolation around bestTau for sub-sample precision
  let refinedTau = bestTau
  if (bestTau > 0 && bestTau < maxPeriod) {
    const alpha = cmnd[bestTau - 1]
    const beta = cmnd[bestTau]
    const gamma = cmnd[bestTau + 1]
    const denom = 2 * (alpha - 2 * beta + gamma)
    if (Math.abs(denom) > 1e-10) {
      refinedTau = bestTau + (alpha - gamma) / denom
    }
  }

  const frequency = sampleRate / refinedTau
  const confidence = 1 - cmnd[bestTau]

  return { frequency, confidence: Math.max(0, Math.min(1, confidence)) }
}

/**
 * Convert frequency to MIDI note number + cents offset
 */
function frequencyToNote(freq: number): { midiNote: number; noteName: string; octave: number; cents: number } {
  // MIDI note: 69 = A4 = 440Hz
  const midiExact = 69 + 12 * Math.log2(freq / 440)
  const midiNote = Math.round(midiExact)
  const cents = Math.round((midiExact - midiNote) * 100)
  const noteIdx = ((midiNote % 12) + 12) % 12
  const octave = Math.floor(midiNote / 12) - 1
  const noteName = NOTE_NAMES[noteIdx]

  return { midiNote, noteName, octave, cents }
}

/**
 * Detect the dominant pitch from an AudioBuffer.
 *
 * Analyzes multiple segments of the audio and returns the most
 * commonly detected pitch (mode) for robustness against transients.
 *
 * @param audioBuffer - Web Audio API AudioBuffer
 * @param options - Detection parameters
 * @returns PitchResult or null if no pitch detected
 */
export function detectPitch(
  audioBuffer: AudioBuffer,
  options: PitchDetectionOptions = {}
): PitchResult | null {
  const {
    threshold = 0.15,
    minFrequency = 50,
    maxFrequency = 2000,
    regionStart = 0,
    regionEnd = 1,
  } = options

  const sampleRate = audioBuffer.sampleRate
  const channelData = audioBuffer.getChannelData(0) // mono channel

  // Determine analysis region
  const totalSamples = channelData.length
  const startSample = Math.floor(regionStart * totalSamples)
  const endSample = Math.floor(regionEnd * totalSamples)
  const regionLength = endSample - startSample

  if (regionLength < 2048) return null // too short for pitch detection

  // Analyze multiple overlapping windows for robustness
  const windowSize = Math.min(8192, regionLength) // ~186ms at 44.1kHz
  const hopSize = Math.floor(windowSize / 2)
  const detections: { midiNote: number; frequency: number; confidence: number }[] = []

  for (let pos = startSample; pos + windowSize <= endSample; pos += hopSize) {
    const window = channelData.slice(pos, pos + windowSize)

    // Skip silent regions (RMS < threshold)
    let rms = 0
    for (let i = 0; i < window.length; i++) rms += window[i] * window[i]
    rms = Math.sqrt(rms / window.length)
    if (rms < 0.01) continue

    const result = yinDetect(window, sampleRate, threshold, minFrequency, maxFrequency)
    if (result && result.confidence > 0.4) {
      const note = frequencyToNote(result.frequency)
      detections.push({
        midiNote: note.midiNote,
        frequency: result.frequency,
        confidence: result.confidence,
      })
    }
  }

  if (detections.length === 0) return null

  // Find the most common MIDI note (mode) — robust against outliers
  const noteVotes = new Map<number, { count: number; totalFreq: number; totalConf: number }>()
  for (const d of detections) {
    const existing = noteVotes.get(d.midiNote) || { count: 0, totalFreq: 0, totalConf: 0 }
    existing.count++
    existing.totalFreq += d.frequency
    existing.totalConf += d.confidence
    noteVotes.set(d.midiNote, existing)
  }

  // Pick note with most votes
  let bestNote = -1
  let bestCount = 0
  for (const [note, info] of noteVotes) {
    if (info.count > bestCount) {
      bestCount = info.count
      bestNote = note
    }
  }

  if (bestNote < 0) return null

  const winner = noteVotes.get(bestNote)!
  const avgFreq = winner.totalFreq / winner.count
  const avgConf = winner.totalConf / winner.count
  const noteInfo = frequencyToNote(avgFreq)

  return {
    frequency: Math.round(avgFreq * 10) / 10,
    midiNote: noteInfo.midiNote,
    noteName: noteInfo.noteName,
    octave: noteInfo.octave,
    cents: noteInfo.cents,
    confidence: Math.round(avgConf * 100) / 100,
    noteString: `${noteInfo.noteName}${noteInfo.octave}`,
  }
}

/**
 * Detect the musical key (root note class) of a sample.
 * Returns just the note name without octave — useful for scale matching.
 *
 * Analyzes the full sample and returns the most prominent pitch class.
 */
export function detectKey(
  audioBuffer: AudioBuffer,
  options: PitchDetectionOptions = {}
): { root: string; confidence: number } | null {
  const result = detectPitch(audioBuffer, options)
  if (!result) return null
  return { root: result.noteName, confidence: result.confidence }
}

/**
 * Calculate semitones needed to shift from one root note to another.
 * Returns the shortest path (-6 to +6 semitones).
 *
 * @param fromRoot - Source note name (e.g. "E")
 * @param toRoot   - Target note name (e.g. "C")
 * @returns Semitone offset (negative = down, positive = up)
 */
export function semitonesBetweenRoots(fromRoot: string, toRoot: string): number {
  const fromIdx = NOTE_NAMES.indexOf(fromRoot as typeof NOTE_NAMES[number])
  const toIdx = NOTE_NAMES.indexOf(toRoot as typeof NOTE_NAMES[number])

  // Handle flats → sharps mapping
  const FLAT_MAP: Record<string, string> = { 'Db': 'C#', 'Eb': 'D#', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#' }
  const fromNorm = FLAT_MAP[fromRoot] || fromRoot
  const toNorm = FLAT_MAP[toRoot] || toRoot

  const fi = NOTE_NAMES.indexOf(fromNorm as typeof NOTE_NAMES[number])
  const ti = NOTE_NAMES.indexOf(toNorm as typeof NOTE_NAMES[number])

  if (fi < 0 || ti < 0) return 0

  let diff = ti - fi
  // Shortest path: wrap to -6..+6
  if (diff > 6) diff -= 12
  if (diff < -6) diff += 12
  return diff
}

/**
 * Convert semitone offset to Strudel .speed() value.
 * speed = 2^(semitones/12)
 */
export function semitonesToSpeed(semitones: number): number {
  return Math.pow(2, semitones / 12)
}

/**
 * Get the speed multiplier needed to pitch-shift a sample from
 * its detected root to a target root note.
 */
export function getPitchShiftSpeed(fromRoot: string, toRoot: string): number {
  const st = semitonesBetweenRoots(fromRoot, toRoot)
  return semitonesToSpeed(st)
}
