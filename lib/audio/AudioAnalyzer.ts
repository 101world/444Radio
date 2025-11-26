/**
 * Audio Analysis Tools
 * Features: spectrum analyzer, phase correlation, LUFS metering, silence detection
 */

export interface AnalysisResult {
  peak: number;
  rms: number;
  lufs: number;
  dynamicRange: number;
  hasClipping: boolean;
  silentRegions: Array<{ start: number; end: number }>;
}

export class AudioAnalyzer {
  private context: AudioContext;
  private analyser: AnalyserNode;
  private scriptProcessor: ScriptProcessorNode | null = null;

  constructor(context: AudioContext, fftSize: number = 2048) {
    this.context = context;
    this.analyser = context.createAnalyser();
    this.analyser.fftSize = fftSize;
    this.analyser.smoothingTimeConstant = 0.8;
  }

  /**
   * Get spectrum data for visualization
   */
  getSpectrumData(): { frequencies: Float32Array; magnitudes: Float32Array } {
    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Float32Array(bufferLength);
    this.analyser.getFloatFrequencyData(dataArray);

    // Convert bin indices to frequencies
    const frequencies = new Float32Array(bufferLength);
    const nyquist = this.context.sampleRate / 2;
    
    for (let i = 0; i < bufferLength; i++) {
      frequencies[i] = (i / bufferLength) * nyquist;
    }

    return { frequencies, magnitudes: dataArray };
  }

  /**
   * Get logarithmic spectrum (better for visualization)
   */
  getLogSpectrum(numBands: number = 64): Float32Array {
    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Float32Array(bufferLength);
    this.analyser.getFloatFrequencyData(dataArray);

    const logSpectrum = new Float32Array(numBands);
    const nyquist = this.context.sampleRate / 2;
    
    for (let i = 0; i < numBands; i++) {
      // Logarithmic frequency spacing
      const minFreq = 20;
      const maxFreq = nyquist;
      const logMin = Math.log10(minFreq);
      const logMax = Math.log10(maxFreq);
      const logFreq = logMin + (i / numBands) * (logMax - logMin);
      const freq = Math.pow(10, logFreq);
      
      // Find corresponding bin
      const binIndex = Math.floor((freq / nyquist) * bufferLength);
      logSpectrum[i] = dataArray[Math.min(binIndex, bufferLength - 1)];
    }

    return logSpectrum;
  }

  /**
   * Analyze audio buffer for complete statistics
   */
  analyzeBuffer(buffer: AudioBuffer, silenceThreshold: number = -60): AnalysisResult {
    const channelData = buffer.getChannelData(0);
    const sampleRate = buffer.sampleRate;
    
    let peak = 0;
    let sumSquares = 0;
    let hasClipping = false;
    const silentRegions: Array<{ start: number; end: number }> = [];
    
    // Detect silent regions
    let silenceStart: number | null = null;
    const silenceThresholdLinear = this.dbToLinear(silenceThreshold);

    for (let i = 0; i < channelData.length; i++) {
      const sample = Math.abs(channelData[i]);
      
      // Peak detection
      peak = Math.max(peak, sample);
      
      // Clipping detection (very close to 1.0)
      if (sample > 0.99) {
        hasClipping = true;
      }
      
      // RMS calculation
      sumSquares += sample * sample;
      
      // Silence detection
      if (sample < silenceThresholdLinear) {
        if (silenceStart === null) {
          silenceStart = i / sampleRate;
        }
      } else {
        if (silenceStart !== null) {
          silentRegions.push({
            start: silenceStart,
            end: i / sampleRate
          });
          silenceStart = null;
        }
      }
    }

    // Close last silent region if needed
    if (silenceStart !== null) {
      silentRegions.push({
        start: silenceStart,
        end: buffer.duration
      });
    }

    const rms = Math.sqrt(sumSquares / channelData.length);
    const peakDb = this.linearToDb(peak);
    const rmsDb = this.linearToDb(rms);
    
    // Approximate LUFS (simplified - real LUFS requires K-weighting)
    const lufs = rmsDb - 23; // Rough approximation
    
    // Dynamic range (crest factor in dB)
    const dynamicRange = peakDb - rmsDb;

    return {
      peak: peakDb,
      rms: rmsDb,
      lufs,
      dynamicRange,
      hasClipping,
      silentRegions
    };
  }

  /**
   * Real-time peak meter
   */
  getPeakLevel(): number {
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteTimeDomainData(dataArray);
    
    let peak = 0;
    for (let i = 0; i < dataArray.length; i++) {
      const normalized = Math.abs((dataArray[i] - 128) / 128);
      peak = Math.max(peak, normalized);
    }
    
    return this.linearToDb(peak);
  }

  /**
   * Real-time RMS meter
   */
  getRMSLevel(): number {
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteTimeDomainData(dataArray);
    
    let sumSquares = 0;
    for (let i = 0; i < dataArray.length; i++) {
      const normalized = (dataArray[i] - 128) / 128;
      sumSquares += normalized * normalized;
    }
    
    const rms = Math.sqrt(sumSquares / dataArray.length);
    return this.linearToDb(rms);
  }

  /**
   * Phase correlation meter (-1 to +1)
   * -1 = completely out of phase, 0 = no correlation, +1 = perfectly in phase
   */
  getPhaseCorrelation(buffer: AudioBuffer): number {
    if (buffer.numberOfChannels < 2) return 1; // Mono = perfect correlation

    const left = buffer.getChannelData(0);
    const right = buffer.getChannelData(1);
    const length = Math.min(left.length, right.length);

    let sumLR = 0;
    let sumLL = 0;
    let sumRR = 0;

    for (let i = 0; i < length; i++) {
      sumLR += left[i] * right[i];
      sumLL += left[i] * left[i];
      sumRR += right[i] * right[i];
    }

    const denominator = Math.sqrt(sumLL * sumRR);
    return denominator === 0 ? 0 : sumLR / denominator;
  }

  /**
   * Detect beats/transients in audio
   */
  detectBeats(buffer: AudioBuffer, sensitivity: number = 1.5): number[] {
    const channelData = buffer.getChannelData(0);
    const sampleRate = buffer.sampleRate;
    const windowSize = Math.floor(sampleRate * 0.05); // 50ms window
    const hopSize = Math.floor(windowSize / 4);
    
    const energies: number[] = [];
    const beatTimes: number[] = [];

    // Calculate energy for each window
    for (let i = 0; i < channelData.length - windowSize; i += hopSize) {
      let energy = 0;
      for (let j = 0; j < windowSize; j++) {
        const sample = channelData[i + j];
        energy += sample * sample;
      }
      energies.push(energy / windowSize);
    }

    // Find peaks in energy
    const avgEnergy = energies.reduce((a, b) => a + b, 0) / energies.length;
    const threshold = avgEnergy * sensitivity;

    for (let i = 1; i < energies.length - 1; i++) {
      if (energies[i] > threshold && 
          energies[i] > energies[i - 1] && 
          energies[i] > energies[i + 1]) {
        const timeInSeconds = (i * hopSize) / sampleRate;
        beatTimes.push(timeInSeconds);
      }
    }

    return beatTimes;
  }

  /**
   * Trim silence from start and end
   */
  trimSilence(buffer: AudioBuffer, threshold: number = -60): { start: number; end: number } {
    const channelData = buffer.getChannelData(0);
    const thresholdLinear = this.dbToLinear(threshold);
    const sampleRate = buffer.sampleRate;

    let start = 0;
    let end = buffer.length - 1;

    // Find start
    for (let i = 0; i < channelData.length; i++) {
      if (Math.abs(channelData[i]) > thresholdLinear) {
        start = i;
        break;
      }
    }

    // Find end
    for (let i = channelData.length - 1; i >= 0; i--) {
      if (Math.abs(channelData[i]) > thresholdLinear) {
        end = i;
        break;
      }
    }

    return {
      start: start / sampleRate,
      end: end / sampleRate
    };
  }

  /**
   * Get analyser node for connection
   */
  getAnalyserNode(): AnalyserNode {
    return this.analyser;
  }

  // Utility functions
  private linearToDb(linear: number): number {
    return 20 * Math.log10(Math.max(linear, 0.00001));
  }

  private dbToLinear(db: number): number {
    return Math.pow(10, db / 20);
  }
}
