/**
 * Onset Detection & Auto-Align - Beat alignment using transient detection
 * Uses RMS energy analysis to detect first significant transient
 * Aligns clips to nearest beat/bar for tight rhythm section work
 */

export interface OnsetDetectionOptions {
  windowMs?: number;
  threshold?: number;
  minOnsetTime?: number;
}

export interface AlignmentResult {
  onsetTime: number;
  alignedStartTime: number;
  shiftAmount: number;
  confidence: number;
}

/**
 * Detect first onset (transient) in audio buffer using RMS energy
 * @param buffer - Float32Array of audio samples (interleaved if stereo)
 * @param sampleRate - Sample rate in Hz
 * @param channels - Number of channels (1 or 2)
 * @param options - Detection parameters
 * @returns Time in seconds of first detected onset
 */
export function detectFirstOnset(
  buffer: Float32Array,
  sampleRate: number,
  channels: number = 1,
  options: OnsetDetectionOptions = {}
): number {
  const windowMs = options.windowMs || 10; // 10ms window
  const threshold = options.threshold || 0.02; // 2% energy threshold
  const minOnsetTime = options.minOnsetTime || 0.05; // Ignore first 50ms (click protection)
  
  const windowSize = Math.floor(sampleRate * windowMs / 1000);
  const totalSamples = buffer.length / channels;
  const minOnsetSample = Math.floor(minOnsetTime * sampleRate);
  
  // Calculate RMS for each window
  for (let i = minOnsetSample; i < totalSamples - windowSize; i += windowSize) {
    let sumSquares = 0;
    let count = 0;
    
    // Compute RMS over window
    for (let j = 0; j < windowSize; j++) {
      for (let ch = 0; ch < channels; ch++) {
        const sampleIndex = channels === 1 ? (i + j) : ((i + j) * channels + ch);
        const sample = buffer[sampleIndex];
        sumSquares += sample * sample;
        count++;
      }
    }
    
    const rms = Math.sqrt(sumSquares / count);
    
    // Onset detected when RMS exceeds threshold
    if (rms > threshold) {
      return i / sampleRate;
    }
  }
  
  return 0; // No onset detected
}

/**
 * Auto-align clip to nearest beat using onset detection
 * @param buffer - Audio buffer to analyze
 * @param sampleRate - Sample rate
 * @param channels - Number of channels
 * @param currentStartTime - Current clip start time in project
 * @param bpm - Project BPM
 * @param options - Detection options
 * @returns Alignment result with new start time
 */
export function autoAlignClipToBeat(
  buffer: Float32Array,
  sampleRate: number,
  channels: number,
  currentStartTime: number,
  bpm: number,
  options: OnsetDetectionOptions = {}
): AlignmentResult {
  // Detect onset within the clip
  const onsetTime = detectFirstOnset(buffer, sampleRate, channels, options);
  
  // Calculate absolute onset time in project timeline
  const absoluteOnsetTime = currentStartTime + onsetTime;
  
  // Calculate beat duration
  const beatDuration = 60 / bpm;
  
  // Find nearest beat to the onset
  const nearestBeat = Math.round(absoluteOnsetTime / beatDuration) * beatDuration;
  
  // Calculate how much to shift the clip
  const shiftAmount = nearestBeat - absoluteOnsetTime;
  
  // New start time aligns onset to beat
  const alignedStartTime = currentStartTime + shiftAmount;
  
  // Calculate confidence (how close we already were)
  const confidence = 1 - Math.min(1, Math.abs(shiftAmount) / beatDuration);
  
  return {
    onsetTime,
    alignedStartTime: Math.max(0, alignedStartTime),
    shiftAmount,
    confidence
  };
}

/**
 * Auto-align clip to nearest bar (downbeat)
 * @param buffer - Audio buffer to analyze
 * @param sampleRate - Sample rate
 * @param channels - Number of channels
 * @param currentStartTime - Current clip start time
 * @param bpm - Project BPM
 * @param beatsPerBar - Time signature (default 4)
 * @param options - Detection options
 */
export function autoAlignClipToBar(
  buffer: Float32Array,
  sampleRate: number,
  channels: number,
  currentStartTime: number,
  bpm: number,
  beatsPerBar: number = 4,
  options: OnsetDetectionOptions = {}
): AlignmentResult {
  const onsetTime = detectFirstOnset(buffer, sampleRate, channels, options);
  const absoluteOnsetTime = currentStartTime + onsetTime;
  
  // Calculate bar duration
  const beatDuration = 60 / bpm;
  const barDuration = beatDuration * beatsPerBar;
  
  // Find nearest bar (downbeat)
  const nearestBar = Math.round(absoluteOnsetTime / barDuration) * barDuration;
  
  const shiftAmount = nearestBar - absoluteOnsetTime;
  const alignedStartTime = currentStartTime + shiftAmount;
  const confidence = 1 - Math.min(1, Math.abs(shiftAmount) / barDuration);
  
  return {
    onsetTime,
    alignedStartTime: Math.max(0, alignedStartTime),
    shiftAmount,
    confidence
  };
}

/**
 * Detect multiple onsets in a buffer (for drum loop analysis)
 * @param buffer - Audio buffer
 * @param sampleRate - Sample rate
 * @param channels - Number of channels
 * @param options - Detection options
 * @returns Array of onset times in seconds
 */
export function detectAllOnsets(
  buffer: Float32Array,
  sampleRate: number,
  channels: number = 1,
  options: OnsetDetectionOptions = {}
): number[] {
  const windowMs = options.windowMs || 10;
  const threshold = options.threshold || 0.02;
  const minOnsetTime = options.minOnsetTime || 0.05;
  
  const windowSize = Math.floor(sampleRate * windowMs / 1000);
  const totalSamples = buffer.length / channels;
  const minOnsetSample = Math.floor(minOnsetTime * sampleRate);
  
  const onsets: number[] = [];
  let lastOnsetSample = 0;
  const minGapSamples = Math.floor(sampleRate * 0.05); // 50ms minimum gap between onsets
  
  for (let i = minOnsetSample; i < totalSamples - windowSize; i += windowSize) {
    let sumSquares = 0;
    let count = 0;
    
    for (let j = 0; j < windowSize; j++) {
      for (let ch = 0; ch < channels; ch++) {
        const sampleIndex = channels === 1 ? (i + j) : ((i + j) * channels + ch);
        const sample = buffer[sampleIndex];
        sumSquares += sample * sample;
        count++;
      }
    }
    
    const rms = Math.sqrt(sumSquares / count);
    
    // Onset detected with minimum gap enforcement
    if (rms > threshold && (i - lastOnsetSample) > minGapSamples) {
      onsets.push(i / sampleRate);
      lastOnsetSample = i;
    }
  }
  
  return onsets;
}

/**
 * Calculate optimal threshold for onset detection
 * Analyzes buffer and suggests threshold based on dynamic range
 */
export function calculateOptimalThreshold(
  buffer: Float32Array,
  channels: number = 1
): number {
  let max = 0;
  let sumSquares = 0;
  const totalSamples = buffer.length / channels;
  
  for (let i = 0; i < totalSamples; i++) {
    for (let ch = 0; ch < channels; ch++) {
      const sampleIndex = channels === 1 ? i : (i * channels + ch);
      const sample = Math.abs(buffer[sampleIndex]);
      max = Math.max(max, sample);
      sumSquares += sample * sample;
    }
  }
  
  const rms = Math.sqrt(sumSquares / (totalSamples * channels));
  
  // Threshold is 20% of the difference between RMS and peak
  return rms + (max - rms) * 0.2;
}

/**
 * Analyze clip rhythm and suggest BPM
 * Uses onset intervals to detect tempo
 */
export function analyzeTempo(
  buffer: Float32Array,
  sampleRate: number,
  channels: number = 1,
  options: OnsetDetectionOptions = {}
): { bpm: number; confidence: number } | null {
  const onsets = detectAllOnsets(buffer, sampleRate, channels, options);
  
  if (onsets.length < 4) {
    return null; // Need at least 4 onsets for tempo detection
  }
  
  // Calculate intervals between onsets
  const intervals: number[] = [];
  for (let i = 1; i < onsets.length; i++) {
    intervals.push(onsets[i] - onsets[i - 1]);
  }
  
  // Find median interval (more robust than mean)
  intervals.sort((a, b) => a - b);
  const medianInterval = intervals[Math.floor(intervals.length / 2)];
  
  // Convert to BPM
  const bpm = Math.round(60 / medianInterval);
  
  // Calculate confidence based on interval consistency
  const deviations = intervals.map(i => Math.abs(i - medianInterval));
  const avgDeviation = deviations.reduce((a, b) => a + b, 0) / deviations.length;
  const confidence = Math.max(0, 1 - (avgDeviation / medianInterval));
  
  return { bpm, confidence };
}
