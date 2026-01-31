/**
 * TimeEngine - Single Source of Truth for DAW Timing
 * 
 * This class manages all time-related calculations and conversions for the DAW.
 * It ensures that bars, beats, samples, seconds, and SMPTE are always in sync.
 * 
 * PHILOSOPHY:
 * - Musical time (bars/beats) is the primary unit of measurement
 * - All conversions flow through this engine
 * - BPM and time signature changes are tracked and respected
 * - Deterministic: same input always produces same output
 */

export interface TimeSignature {
  numerator: number
  denominator: number
  at: number // Time in seconds when this signature starts
}

export interface TempoChange {
  bpm: number
  at: number // Time in seconds when this tempo starts
}

export interface MusicalTime {
  bars: number
  beats: number
  subdivisions: number // 16th notes (0-3)
}

export interface TimePosition {
  seconds: number
  samples: number
  musical: MusicalTime
  smpte: string
}

export class TimeEngine {
  private sampleRate: number
  private tempoMap: TempoChange[] = []
  private timeSignatureMap: TimeSignature[] = []
  private baseBpm: number = 120
  private baseTimeSignature: TimeSignature = { numerator: 4, denominator: 4, at: 0 }

  constructor(sampleRate: number = 48000, initialBpm: number = 120) {
    this.sampleRate = sampleRate
    this.baseBpm = initialBpm
    this.tempoMap.push({ bpm: initialBpm, at: 0 })
    this.timeSignatureMap.push(this.baseTimeSignature)
  }

  // ==========================================
  // CORE CONVERSION METHODS
  // ==========================================

  /**
   * Convert seconds to musical time (bars, beats, subdivisions)
   */
  secondsToMusical(seconds: number): MusicalTime {
    // Find the active tempo at this time
    const tempo = this.getTempoAtTime(seconds)
    const timeSignature = this.getTimeSignatureAtTime(seconds)
    
    // Calculate total beats from start
    const secondsPerBeat = 60 / tempo.bpm
    const totalBeats = seconds / secondsPerBeat
    
    // Convert to bars and beats
    const beatsPerBar = timeSignature.numerator
    const bars = Math.floor(totalBeats / beatsPerBar)
    const beatsInCurrentBar = totalBeats % beatsPerBar
    const beats = Math.floor(beatsInCurrentBar)
    
    // Subdivisions (16th notes)
    const subdivisionsPerBeat = 4
    const subdivisions = Math.floor((beatsInCurrentBar - beats) * subdivisionsPerBeat)
    
    return {
      bars,
      beats,
      subdivisions: Math.max(0, Math.min(3, subdivisions))
    }
  }

  /**
   * Convert musical time to seconds
   */
  musicalToSeconds(musical: MusicalTime): number {
    const { bars, beats, subdivisions } = musical
    
    // Find tempo and time signature (for now, use base values)
    // TODO: Handle tempo/signature changes properly
    const tempo = this.baseBpm
    const timeSignature = this.baseTimeSignature
    
    // Calculate total beats
    const beatsPerBar = timeSignature.numerator
    const totalBeats = (bars * beatsPerBar) + beats + (subdivisions / 4)
    
    // Convert to seconds
    const secondsPerBeat = 60 / tempo
    return totalBeats * secondsPerBeat
  }

  /**
   * Convert seconds to samples
   */
  secondsToSamples(seconds: number): number {
    return Math.floor(seconds * this.sampleRate)
  }

  /**
   * Convert samples to seconds
   */
  samplesToSeconds(samples: number): number {
    return samples / this.sampleRate
  }

  /**
   * Get a complete time position for a given time in seconds
   */
  getTimePosition(seconds: number): TimePosition {
    return {
      seconds,
      samples: this.secondsToSamples(seconds),
      musical: this.secondsToMusical(seconds),
      smpte: this.secondsToSMPTE(seconds)
    }
  }

  // ==========================================
  // GRID AND SNAP OPERATIONS
  // ==========================================

  /**
   * Snap time to the nearest beat
   */
  snapToBeat(seconds: number): number {
    const musical = this.secondsToMusical(seconds)
    return this.musicalToSeconds({
      bars: musical.bars,
      beats: musical.beats,
      subdivisions: 0
    })
  }

  /**
   * Snap time to the nearest subdivision (16th note)
   */
  snapToSubdivision(seconds: number): number {
    const musical = this.secondsToMusical(seconds)
    return this.musicalToSeconds(musical)
  }

  /**
   * Snap time to the nearest bar
   */
  snapToBar(seconds: number): number {
    const musical = this.secondsToMusical(seconds)
    return this.musicalToSeconds({
      bars: musical.bars,
      beats: 0,
      subdivisions: 0
    })
  }

  /**
   * Generic snap function with configurable grid size
   */
  snapToGrid(seconds: number, gridSize: 'bar' | 'beat' | 'subdivision' | 'none'): number {
    switch (gridSize) {
      case 'bar':
        return this.snapToBar(seconds)
      case 'beat':
        return this.snapToBeat(seconds)
      case 'subdivision':
        return this.snapToSubdivision(seconds)
      case 'none':
      default:
        return seconds
    }
  }

  // ==========================================
  // TEMPO AND TIME SIGNATURE MANAGEMENT
  // ==========================================

  /**
   * Set BPM at a specific time
   */
  setTempo(bpm: number, atSeconds: number = 0): void {
    // Remove any existing tempo change at this exact time
    this.tempoMap = this.tempoMap.filter(t => Math.abs(t.at - atSeconds) > 0.001)
    
    // Add new tempo change
    this.tempoMap.push({ bpm, at: atSeconds })
    
    // Sort by time
    this.tempoMap.sort((a, b) => a.at - b.at)
    
    // Update base BPM if setting at time 0
    if (atSeconds === 0) {
      this.baseBpm = bpm
    }
  }

  /**
   * Set time signature at a specific time
   */
  setTimeSignature(numerator: number, denominator: number, atSeconds: number = 0): void {
    // Remove any existing signature change at this exact time
    this.timeSignatureMap = this.timeSignatureMap.filter(
      ts => Math.abs(ts.at - atSeconds) > 0.001
    )
    
    // Add new signature change
    this.timeSignatureMap.push({ numerator, denominator, at: atSeconds })
    
    // Sort by time
    this.timeSignatureMap.sort((a, b) => a.at - b.at)
    
    // Update base signature if setting at time 0
    if (atSeconds === 0) {
      this.baseTimeSignature = { numerator, denominator, at: 0 }
    }
  }

  /**
   * Get the active tempo at a specific time
   */
  getTempoAtTime(seconds: number): TempoChange {
    // Find the last tempo change before or at this time
    for (let i = this.tempoMap.length - 1; i >= 0; i--) {
      if (this.tempoMap[i].at <= seconds) {
        return this.tempoMap[i]
      }
    }
    return { bpm: this.baseBpm, at: 0 }
  }

  /**
   * Get the active time signature at a specific time
   */
  getTimeSignatureAtTime(seconds: number): TimeSignature {
    // Find the last signature change before or at this time
    for (let i = this.timeSignatureMap.length - 1; i >= 0; i--) {
      if (this.timeSignatureMap[i].at <= seconds) {
        return this.timeSignatureMap[i]
      }
    }
    return this.baseTimeSignature
  }

  /**
   * Get current BPM (at time 0 or latest change)
   */
  getCurrentBpm(): number {
    return this.baseBpm
  }

  /**
   * Get current time signature
   */
  getCurrentTimeSignature(): TimeSignature {
    return this.baseTimeSignature
  }

  // ==========================================
  // UTILITY METHODS
  // ==========================================

  /**
   * Format seconds as bars:beats.subdivisions
   */
  formatMusical(seconds: number): string {
    const musical = this.secondsToMusical(seconds)
    return `${musical.bars + 1}:${musical.beats + 1}.${musical.subdivisions + 1}`
  }

  /**
   * Format seconds as SMPTE timecode (HH:MM:SS:FF)
   */
  secondsToSMPTE(seconds: number, fps: number = 30): string {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)
    const frames = Math.floor((seconds % 1) * fps)
    
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}:${String(frames).padStart(2, '0')}`
  }

  /**
   * Calculate beat duration in seconds at a given time
   */
  getBeatDurationAt(seconds: number): number {
    const tempo = this.getTempoAtTime(seconds)
    return 60 / tempo.bpm
  }

  /**
   * Calculate bar duration in seconds at a given time
   */
  getBarDurationAt(seconds: number): number {
    const tempo = this.getTempoAtTime(seconds)
    const timeSignature = this.getTimeSignatureAtTime(seconds)
    const beatDuration = 60 / tempo.bpm
    return beatDuration * timeSignature.numerator
  }

  /**
   * Get subdivision duration (16th note) in seconds
   */
  getSubdivisionDurationAt(seconds: number): number {
    return this.getBeatDurationAt(seconds) / 4
  }

  /**
   * Check if two times are on the same beat
   */
  isOnSameBeat(time1: number, time2: number): boolean {
    const musical1 = this.secondsToMusical(time1)
    const musical2 = this.secondsToMusical(time2)
    return musical1.bars === musical2.bars && musical1.beats === musical2.beats
  }

  /**
   * Get the start time of the bar containing the given time
   */
  getBarStartTime(seconds: number): number {
    const musical = this.secondsToMusical(seconds)
    return this.musicalToSeconds({
      bars: musical.bars,
      beats: 0,
      subdivisions: 0
    })
  }

  /**
   * Get the start time of the beat containing the given time
   */
  getBeatStartTime(seconds: number): number {
    const musical = this.secondsToMusical(seconds)
    return this.musicalToSeconds({
      bars: musical.bars,
      beats: musical.beats,
      subdivisions: 0
    })
  }

  /**
   * Calculate quantize value for recording/MIDI input
   * Returns the nearest snap point based on quantize setting
   */
  quantize(seconds: number, quantizeValue: '1/4' | '1/8' | '1/16' | 'off'): number {
    if (quantizeValue === 'off') return seconds

    const musical = this.secondsToMusical(seconds)
    
    switch (quantizeValue) {
      case '1/4': // Quarter note (beat)
        return this.musicalToSeconds({
          bars: musical.bars,
          beats: musical.beats,
          subdivisions: 0
        })
      case '1/8': // Eighth note (half beat)
        return this.musicalToSeconds({
          bars: musical.bars,
          beats: musical.beats,
          subdivisions: musical.subdivisions >= 2 ? 2 : 0
        })
      case '1/16': // Sixteenth note
      default:
        return this.musicalToSeconds(musical)
    }
  }

  /**
   * Dispose and cleanup
   */
  dispose(): void {
    this.tempoMap = []
    this.timeSignatureMap = []
  }
}
