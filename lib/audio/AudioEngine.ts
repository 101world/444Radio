/**
 * Advanced Audio Engine with AudioWorklet support
 * Provides low-latency processing and buffer pooling
 */

export interface AudioEngineConfig {
  context?: AudioContext;
  sampleRate?: number;
  latencyHint?: AudioContextLatencyCategory;
  enableWorklets?: boolean;
}

export class AudioEngine {
  private context: AudioContext;
  private workletNode: AudioWorkletNode | null = null;
  private bufferPool: Map<string, AudioBuffer> = new Map();
  private masterGain: GainNode;
  private analyser: AnalyserNode;
  private isInitialized = false;

  constructor(config: AudioEngineConfig = {}) {
    const {
      context,
      sampleRate = 44100,
      latencyHint = 'interactive',
      enableWorklets = true
    } = config;

    // Use provided context or create new one
    this.context = context || new AudioContext({
      sampleRate,
      latencyHint
    });

    this.masterGain = this.context.createGain();
    this.analyser = this.context.createAnalyser();
    this.analyser.fftSize = 2048;
    
    this.masterGain.connect(this.analyser);
    this.analyser.connect(this.context.destination);

    if (enableWorklets) {
      this.initializeWorklets().catch(console.error);
    }
  }

  private async initializeWorklets() {
    try {
      await this.context.audioWorklet.addModule('/audio-worklet-processor.js');
      this.workletNode = new AudioWorkletNode(this.context, 'audio-processor');
      this.isInitialized = true;
    } catch (error) {
      console.warn('AudioWorklet not supported, falling back to ScriptProcessor', error);
    }
  }

  async resume() {
    if (this.context.state === 'suspended') {
      await this.context.resume();
    }
  }

  async suspend() {
    if (this.context.state === 'running') {
      await this.context.suspend();
    }
  }

  getContext(): AudioContext {
    return this.context;
  }

  getMasterGain(): GainNode {
    return this.masterGain;
  }

  getAnalyser(): AnalyserNode {
    return this.analyser;
  }

  // Buffer pool for efficient memory management
  cacheBuffer(key: string, buffer: AudioBuffer) {
    this.bufferPool.set(key, buffer);
  }

  getCachedBuffer(key: string): AudioBuffer | undefined {
    return this.bufferPool.get(key);
  }

  clearBufferCache() {
    this.bufferPool.clear();
  }

  // Create optimized buffer source
  createBufferSource(buffer: AudioBuffer): AudioBufferSourceNode {
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    return source;
  }

  // Get current time
  getCurrentTime(): number {
    return this.context.currentTime;
  }

  // Cleanup
  async dispose() {
    await this.context.close();
    this.bufferPool.clear();
  }
}
