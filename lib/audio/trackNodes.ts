/**
 * Track Audio Nodes - WebAudio node factory for per-track FX
 * Creates and manages audio processing chains for each track
 * Supports: Gain, Pan, EQ (High/Low pass), Reverb Send
 */

export interface TrackNodesConfig {
  gain?: number;
  pan?: number;
  lowCutFreq?: number;
  highCutFreq?: number;
  reverbSend?: number;
}

export interface TrackNodes {
  input: GainNode;
  gainNode: GainNode;
  panNode: StereoPannerNode | null;
  lowCut: BiquadFilterNode;
  highCut: BiquadFilterNode;
  reverbSend: GainNode;
  output: GainNode;
  
  // Utility methods
  connect(destination: AudioNode): void;
  disconnect(): void;
  setGain(value: number): void;
  setPan(value: number): void;
  setLowCut(freq: number): void;
  setHighCut(freq: number): void;
  setReverbSend(value: number): void;
}

/**
 * Create a complete audio processing chain for a track
 * Chain: Input → LowCut → HighCut → Gain → Pan → Output
 * Also creates reverb send bus for parallel processing
 */
export function createTrackNodes(
  audioContext: AudioContext, 
  config: TrackNodesConfig = {}
): TrackNodes {
  // Input node (connection point for sources)
  const input = audioContext.createGain();
  input.gain.value = 1.0;
  
  // Low-cut filter (highpass) - removes rumble
  const lowCut = audioContext.createBiquadFilter();
  lowCut.type = 'highpass';
  lowCut.frequency.value = config.lowCutFreq || 20; // Hz
  lowCut.Q.value = 0.7;
  
  // High-cut filter (lowpass) - removes harsh highs
  const highCut = audioContext.createBiquadFilter();
  highCut.type = 'lowpass';
  highCut.frequency.value = config.highCutFreq || 20000; // Hz
  highCut.Q.value = 0.7;
  
  // Gain control
  const gainNode = audioContext.createGain();
  gainNode.gain.value = config.gain !== undefined ? config.gain : 1.0;
  
  // Pan control (stereo panner if available)
  let panNode: StereoPannerNode | null = null;
  if ('createStereoPanner' in audioContext) {
    panNode = audioContext.createStereoPanner();
    panNode.pan.value = config.pan !== undefined ? config.pan : 0;
  }
  
  // Reverb send (parallel bus)
  const reverbSend = audioContext.createGain();
  reverbSend.gain.value = config.reverbSend || 0.0; // Default dry
  
  // Output node (connection point to master or next stage)
  const output = audioContext.createGain();
  output.gain.value = 1.0;
  
  // Build signal chain: Input → LowCut → HighCut → Gain → Pan → Output
  input.connect(lowCut);
  lowCut.connect(highCut);
  highCut.connect(gainNode);
  
  if (panNode) {
    gainNode.connect(panNode);
    panNode.connect(output);
  } else {
    gainNode.connect(output);
  }
  
  // Reverb send taps from gain node (pre-pan)
  gainNode.connect(reverbSend);
  
  // Create utility methods
  const nodes: TrackNodes = {
    input,
    gainNode,
    panNode,
    lowCut,
    highCut,
    reverbSend,
    output,
    
    connect(destination: AudioNode) {
      output.connect(destination);
    },
    
    disconnect() {
      try {
        output.disconnect();
        reverbSend.disconnect();
      } catch (e) {
        // Already disconnected
      }
    },
    
    setGain(value: number) {
      gainNode.gain.setValueAtTime(value, audioContext.currentTime);
    },
    
    setPan(value: number) {
      if (panNode) {
        panNode.pan.setValueAtTime(value, audioContext.currentTime);
      }
    },
    
    setLowCut(freq: number) {
      lowCut.frequency.setValueAtTime(freq, audioContext.currentTime);
    },
    
    setHighCut(freq: number) {
      highCut.frequency.setValueAtTime(freq, audioContext.currentTime);
    },
    
    setReverbSend(value: number) {
      reverbSend.gain.setValueAtTime(value, audioContext.currentTime);
    }
  };
  
  return nodes;
}

/**
 * Create global reverb bus with convolver
 * Requires loading an impulse response file
 */
export async function createReverbBus(
  audioContext: AudioContext,
  impulseResponseUrl?: string
): Promise<{ convolver: ConvolverNode; wet: GainNode; dry: GainNode }> {
  const convolver = audioContext.createConvolver();
  const wet = audioContext.createGain();
  const dry = audioContext.createGain();
  
  wet.gain.value = 0.3; // Wet signal level
  dry.gain.value = 0.7; // Dry signal level
  
  // Load impulse response if provided
  if (impulseResponseUrl) {
    try {
      const response = await fetch(impulseResponseUrl);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      convolver.buffer = audioBuffer;
      console.log('✅ Reverb impulse response loaded');
    } catch (error) {
      console.error('Failed to load impulse response:', error);
      // Create simple synthetic impulse as fallback
      const length = audioContext.sampleRate * 2; // 2 second decay
      const impulse = audioContext.createBuffer(2, length, audioContext.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const data = impulse.getChannelData(ch);
        for (let i = 0; i < length; i++) {
          data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (audioContext.sampleRate * 0.5));
        }
      }
      convolver.buffer = impulse;
      console.log('⚠️ Using synthetic impulse response');
    }
  }
  
  // Connect convolver
  convolver.connect(wet);
  
  return { convolver, wet, dry };
}

/**
 * Create master bus with optional limiter
 */
export function createMasterBus(
  audioContext: AudioContext,
  options: { limitThreshold?: number; limitKnee?: number } = {}
): { input: GainNode; limiter: DynamicsCompressorNode; output: GainNode } {
  const input = audioContext.createGain();
  input.gain.value = 1.0;
  
  // Soft limiter to prevent clipping
  const limiter = audioContext.createDynamicsCompressor();
  limiter.threshold.value = options.limitThreshold || -3; // dB
  limiter.knee.value = options.limitKnee || 12; // dB
  limiter.ratio.value = 20; // Heavy compression
  limiter.attack.value = 0.003; // 3ms
  limiter.release.value = 0.25; // 250ms
  
  const output = audioContext.createGain();
  output.gain.value = 1.0;
  
  // Chain: Input → Limiter → Output
  input.connect(limiter);
  limiter.connect(output);
  
  return { input, limiter, output };
}

/**
 * Decode audio file to PCM buffer (main thread)
 * Returns Float32Array with interleaved channels
 */
export async function decodeAudioFile(
  arrayBuffer: ArrayBuffer,
  audioContext?: AudioContext
): Promise<{ buffer: Float32Array; channels: number; sampleRate: number }> {
  const ctx = audioContext || new AudioContext();
  const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
  
  const channels = audioBuffer.numberOfChannels;
  const length = audioBuffer.length;
  const sampleRate = audioBuffer.sampleRate;
  
  // Interleave channels into Float32Array
  const interleaved = new Float32Array(length * channels);
  
  for (let i = 0; i < length; i++) {
    for (let ch = 0; ch < channels; ch++) {
      interleaved[i * channels + ch] = audioBuffer.getChannelData(ch)[i];
    }
  }
  
  // Close context if we created it
  if (!audioContext) {
    await ctx.close();
  }
  
  return { buffer: interleaved, channels, sampleRate };
}
