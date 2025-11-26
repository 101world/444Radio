/**
 * Non-Destructive Editing Tools
 * Features: clip trimming, fade curves, time-stretch, pitch-shift, reverse
 */

export interface FadeConfig {
  type: 'linear' | 'exponential' | 'logarithmic' | 'scurve';
  duration: number; // in seconds
}

export interface ClipRegion {
  clipId: string;
  start: number; // Start time in clip
  end: number; // End time in clip
  fadeIn?: FadeConfig;
  fadeOut?: FadeConfig;
  gain: number; // 0-1
  reversed: boolean;
  pitchShift: number; // semitones
  timeStretch: number; // 0.5 = half speed, 2 = double speed
}

export class NonDestructiveEditor {
  private context: AudioContext;
  private regions: Map<string, ClipRegion> = new Map();

  constructor(context: AudioContext) {
    this.context = context;
  }

  /**
   * Create a clip region with default settings
   */
  createRegion(clipId: string, start: number, end: number): ClipRegion {
    const region: ClipRegion = {
      clipId,
      start,
      end,
      gain: 1,
      reversed: false,
      pitchShift: 0,
      timeStretch: 1
    };
    
    this.regions.set(clipId, region);
    return region;
  }

  /**
   * Apply fade in/out curves
   */
  applyFade(
    source: AudioBufferSourceNode,
    gainNode: GainNode,
    duration: number,
    fadeIn?: FadeConfig,
    fadeOut?: FadeConfig
  ): void {
    const now = this.context.currentTime;

    if (fadeIn) {
      this.applyFadeIn(gainNode, now, fadeIn);
    }

    if (fadeOut) {
      this.applyFadeOut(gainNode, now + duration - fadeOut.duration, fadeOut);
    }
  }

  private applyFadeIn(gainNode: GainNode, startTime: number, fade: FadeConfig): void {
    const { type, duration } = fade;
    
    gainNode.gain.setValueAtTime(0, startTime);

    switch (type) {
      case 'linear':
        gainNode.gain.linearRampToValueAtTime(1, startTime + duration);
        break;
      case 'exponential':
        gainNode.gain.exponentialRampToValueAtTime(1, startTime + duration);
        break;
      case 'logarithmic':
        // Inverse exponential
        gainNode.gain.setValueCurveAtTime(
          this.createLogCurve(duration, false),
          startTime,
          duration
        );
        break;
      case 'scurve':
        gainNode.gain.setValueCurveAtTime(
          this.createSCurve(duration),
          startTime,
          duration
        );
        break;
    }
  }

  private applyFadeOut(gainNode: GainNode, startTime: number, fade: FadeConfig): void {
    const { type, duration } = fade;
    
    gainNode.gain.setValueAtTime(1, startTime);

    switch (type) {
      case 'linear':
        gainNode.gain.linearRampToValueAtTime(0.001, startTime + duration);
        break;
      case 'exponential':
        gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
        break;
      case 'logarithmic':
        gainNode.gain.setValueCurveAtTime(
          this.createLogCurve(duration, true),
          startTime,
          duration
        );
        break;
      case 'scurve':
        const curve = this.createSCurve(duration);
        curve.reverse();
        gainNode.gain.setValueCurveAtTime(curve, startTime, duration);
        break;
    }
  }

  private createLogCurve(duration: number, invert: boolean): Float32Array {
    const samples = Math.ceil(duration * this.context.sampleRate);
    const curve = new Float32Array(samples);
    
    for (let i = 0; i < samples; i++) {
      const x = i / samples;
      curve[i] = invert ? 1 - Math.log(1 + x * 9) / Math.log(10) : Math.log(1 + x * 9) / Math.log(10);
    }
    
    return curve;
  }

  private createSCurve(duration: number): Float32Array {
    const samples = Math.ceil(duration * this.context.sampleRate);
    const curve = new Float32Array(samples);
    
    for (let i = 0; i < samples; i++) {
      const x = (i / samples - 0.5) * 6; // Scale to -3 to 3
      curve[i] = 1 / (1 + Math.exp(-x)); // Sigmoid function
    }
    
    return curve;
  }

  /**
   * Reverse audio buffer
   */
  reverseBuffer(buffer: AudioBuffer): AudioBuffer {
    const reversed = this.context.createBuffer(
      buffer.numberOfChannels,
      buffer.length,
      buffer.sampleRate
    );

    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      const inputData = buffer.getChannelData(channel);
      const outputData = reversed.getChannelData(channel);
      
      for (let i = 0; i < buffer.length; i++) {
        outputData[i] = inputData[buffer.length - 1 - i];
      }
    }

    return reversed;
  }

  /**
   * Time-stretch without pitch change (simple implementation)
   * For production, use more advanced algorithms like WSOLA or phase vocoder
   */
  timeStretch(buffer: AudioBuffer, rate: number): AudioBuffer {
    const newLength = Math.floor(buffer.length / rate);
    const stretched = this.context.createBuffer(
      buffer.numberOfChannels,
      newLength,
      buffer.sampleRate
    );

    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      const inputData = buffer.getChannelData(channel);
      const outputData = stretched.getChannelData(channel);
      
      for (let i = 0; i < newLength; i++) {
        const sourceIndex = i * rate;
        const index1 = Math.floor(sourceIndex);
        const index2 = Math.min(index1 + 1, buffer.length - 1);
        const fraction = sourceIndex - index1;
        
        // Linear interpolation
        outputData[i] = inputData[index1] * (1 - fraction) + inputData[index2] * fraction;
      }
    }

    return stretched;
  }

  /**
   * Pitch shift (simple implementation using playback rate)
   * For better quality, use more advanced algorithms
   */
  createPitchShiftedSource(buffer: AudioBuffer, semitones: number): AudioBufferSourceNode {
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    
    // Convert semitones to playback rate
    // 12 semitones = 1 octave = 2x playback rate
    source.playbackRate.value = Math.pow(2, semitones / 12);
    
    return source;
  }

  /**
   * Trim clip (adjust start/end without modifying original)
   */
  trimClip(clipId: string, newStart: number, newEnd: number): void {
    const region = this.regions.get(clipId);
    if (region) {
      region.start = Math.max(0, newStart);
      region.end = Math.min(region.end, newEnd);
    }
  }

  /**
   * Apply gain envelope to clip
   */
  applyGainEnvelope(
    gainNode: GainNode,
    startTime: number,
    points: Array<{ time: number; value: number }>
  ): void {
    gainNode.gain.cancelScheduledValues(startTime);
    gainNode.gain.setValueAtTime(points[0]?.value || 1, startTime);

    for (let i = 1; i < points.length; i++) {
      const point = points[i];
      gainNode.gain.linearRampToValueAtTime(point.value, startTime + point.time);
    }
  }

  /**
   * Create crossfade between two clips
   */
  createCrossfade(
    clip1GainNode: GainNode,
    clip2GainNode: GainNode,
    startTime: number,
    duration: number,
    curve: 'linear' | 'equal-power' = 'equal-power'
  ): void {
    if (curve === 'linear') {
      // Clip 1 fades out
      clip1GainNode.gain.setValueAtTime(1, startTime);
      clip1GainNode.gain.linearRampToValueAtTime(0, startTime + duration);
      
      // Clip 2 fades in
      clip2GainNode.gain.setValueAtTime(0, startTime);
      clip2GainNode.gain.linearRampToValueAtTime(1, startTime + duration);
    } else {
      // Equal-power crossfade (constant power)
      const samples = Math.ceil(duration * this.context.sampleRate);
      const curve1 = new Float32Array(samples);
      const curve2 = new Float32Array(samples);
      
      for (let i = 0; i < samples; i++) {
        const x = i / samples;
        curve1[i] = Math.cos(x * Math.PI / 2); // Fade out
        curve2[i] = Math.sin(x * Math.PI / 2); // Fade in
      }
      
      clip1GainNode.gain.setValueCurveAtTime(curve1, startTime, duration);
      clip2GainNode.gain.setValueCurveAtTime(curve2, startTime, duration);
    }
  }

  /**
   * Get region settings
   */
  getRegion(clipId: string): ClipRegion | undefined {
    return this.regions.get(clipId);
  }

  /**
   * Update region settings
   */
  updateRegion(clipId: string, updates: Partial<ClipRegion>): void {
    const region = this.regions.get(clipId);
    if (region) {
      Object.assign(region, updates);
    }
  }

  /**
   * Remove region
   */
  removeRegion(clipId: string): void {
    this.regions.delete(clipId);
  }
}
