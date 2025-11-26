/**
 * Built-in Effects Suite using Web Audio API
 * Includes: EQ, Compressor, Reverb, Delay, Distortion, Chorus
 */

export interface EffectNode {
  input: AudioNode;
  output: AudioNode;
  bypass: boolean;
  type: string;
}

/**
 * Parametric EQ (8-band)
 */
export class ParametricEQ implements EffectNode {
  input: GainNode;
  output: GainNode;
  bypass = false;
  type = 'eq';
  
  private filters: BiquadFilterNode[] = [];
  private frequencies = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];

  constructor(private context: AudioContext) {
    this.input = context.createGain();
    this.output = context.createGain();

    // Create 10-band EQ
    this.frequencies.forEach((freq, i) => {
      const filter = context.createBiquadFilter();
      filter.type = i === 0 ? 'lowshelf' : i === this.frequencies.length - 1 ? 'highshelf' : 'peaking';
      filter.frequency.value = freq;
      filter.Q.value = 1;
      filter.gain.value = 0;
      
      if (i === 0) {
        this.input.connect(filter);
      } else {
        this.filters[i - 1].connect(filter);
      }
      
      this.filters.push(filter);
    });

    this.filters[this.filters.length - 1].connect(this.output);
  }

  setBand(index: number, gain: number) {
    if (this.filters[index]) {
      this.filters[index].gain.value = gain;
    }
  }

  getBand(index: number): number {
    return this.filters[index]?.gain.value || 0;
  }

  reset() {
    this.filters.forEach(filter => filter.gain.value = 0);
  }
}

/**
 * Compressor/Limiter
 */
export class Compressor implements EffectNode {
  input: GainNode;
  output: GainNode;
  bypass = false;
  type = 'compressor';
  
  private compressor: DynamicsCompressorNode;

  constructor(private context: AudioContext) {
    this.input = context.createGain();
    this.output = context.createGain();
    this.compressor = context.createDynamicsCompressor();

    // Default compressor settings
    this.compressor.threshold.value = -24;
    this.compressor.knee.value = 30;
    this.compressor.ratio.value = 12;
    this.compressor.attack.value = 0.003;
    this.compressor.release.value = 0.25;

    this.input.connect(this.compressor);
    this.compressor.connect(this.output);
  }

  setThreshold(value: number) {
    this.compressor.threshold.value = value;
  }

  setRatio(value: number) {
    this.compressor.ratio.value = value;
  }

  setAttack(value: number) {
    this.compressor.attack.value = value;
  }

  setRelease(value: number) {
    this.compressor.release.value = value;
  }

  getReduction(): number {
    return this.compressor.reduction;
  }
}

/**
 * Delay (with feedback and tempo sync)
 */
export class Delay implements EffectNode {
  input: GainNode;
  output: GainNode;
  bypass = false;
  type = 'delay';
  
  private delay: DelayNode;
  private feedback: GainNode;
  private wet: GainNode;
  private dry: GainNode;

  constructor(private context: AudioContext) {
    this.input = context.createGain();
    this.output = context.createGain();
    this.delay = context.createDelay(5);
    this.feedback = context.createGain();
    this.wet = context.createGain();
    this.dry = context.createGain();

    // Setup routing
    this.input.connect(this.dry);
    this.dry.connect(this.output);

    this.input.connect(this.delay);
    this.delay.connect(this.feedback);
    this.feedback.connect(this.delay);
    this.delay.connect(this.wet);
    this.wet.connect(this.output);

    // Default settings
    this.delay.delayTime.value = 0.5;
    this.feedback.gain.value = 0.3;
    this.wet.gain.value = 0.3;
    this.dry.gain.value = 0.7;
  }

  setDelayTime(seconds: number) {
    this.delay.delayTime.value = Math.max(0, Math.min(5, seconds));
  }

  setFeedback(amount: number) {
    this.feedback.gain.value = Math.max(0, Math.min(0.95, amount));
  }

  setWetDry(wet: number) {
    this.wet.gain.value = wet;
    this.dry.gain.value = 1 - wet;
  }

  syncToTempo(bpm: number, division: number = 4) {
    const beatDuration = 60 / bpm;
    const delayTime = beatDuration / division;
    this.setDelayTime(delayTime);
  }
}

/**
 * Reverb (convolution-based)
 */
export class Reverb implements EffectNode {
  input: GainNode;
  output: GainNode;
  bypass = false;
  type = 'reverb';
  
  private convolver: ConvolverNode;
  private wet: GainNode;
  private dry: GainNode;

  constructor(private context: AudioContext) {
    this.input = context.createGain();
    this.output = context.createGain();
    this.convolver = context.createConvolver();
    this.wet = context.createGain();
    this.dry = context.createGain();

    // Setup routing
    this.input.connect(this.dry);
    this.dry.connect(this.output);

    this.input.connect(this.convolver);
    this.convolver.connect(this.wet);
    this.wet.connect(this.output);

    // Default settings
    this.wet.gain.value = 0.3;
    this.dry.gain.value = 0.7;

    // Generate algorithmic reverb impulse
    this.generateAlgorithmicReverb(2, 0.5);
  }

  private generateAlgorithmicReverb(duration: number, decay: number) {
    const sampleRate = this.context.sampleRate;
    const length = sampleRate * duration;
    const impulse = this.context.createBuffer(2, length, sampleRate);

    for (let channel = 0; channel < 2; channel++) {
      const channelData = impulse.getChannelData(channel);
      for (let i = 0; i < length; i++) {
        channelData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
      }
    }

    this.convolver.buffer = impulse;
  }

  setWetDry(wet: number) {
    this.wet.gain.value = wet;
    this.dry.gain.value = 1 - wet;
  }

  async loadImpulseResponse(url: string) {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await this.context.decodeAudioData(arrayBuffer);
    this.convolver.buffer = audioBuffer;
  }
}

/**
 * Distortion/Saturation
 */
export class Distortion implements EffectNode {
  input: GainNode;
  output: GainNode;
  bypass = false;
  type = 'distortion';
  
  private waveshaper: WaveShaperNode;
  private preGain: GainNode;
  private postGain: GainNode;

  constructor(private context: AudioContext) {
    this.input = context.createGain();
    this.output = context.createGain();
    this.waveshaper = context.createWaveShaper();
    this.preGain = context.createGain();
    this.postGain = context.createGain();

    this.input.connect(this.preGain);
    this.preGain.connect(this.waveshaper);
    this.waveshaper.connect(this.postGain);
    this.postGain.connect(this.output);

    this.setDrive(5);
  }

  setDrive(amount: number) {
    const samples = 44100;
    const curve = new Float32Array(samples);
    const deg = Math.PI / 180;
    
    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1;
      curve[i] = ((3 + amount) * x * 20 * deg) / (Math.PI + amount * Math.abs(x));
    }
    
    this.waveshaper.curve = curve;
    this.waveshaper.oversample = '4x';
  }

  setMix(amount: number) {
    this.postGain.gain.value = amount;
  }
}

/**
 * Chorus
 */
export class Chorus implements EffectNode {
  input: GainNode;
  output: GainNode;
  bypass = false;
  type = 'chorus';
  
  private delay: DelayNode;
  private lfo: OscillatorNode;
  private depth: GainNode;
  private wet: GainNode;
  private dry: GainNode;

  constructor(private context: AudioContext) {
    this.input = context.createGain();
    this.output = context.createGain();
    this.delay = context.createDelay();
    this.lfo = context.createOscillator();
    this.depth = context.createGain();
    this.wet = context.createGain();
    this.dry = context.createGain();

    // Setup routing
    this.input.connect(this.dry);
    this.dry.connect(this.output);

    this.lfo.connect(this.depth);
    this.depth.connect(this.delay.delayTime);
    this.input.connect(this.delay);
    this.delay.connect(this.wet);
    this.wet.connect(this.output);

    // Default settings
    this.delay.delayTime.value = 0.02;
    this.lfo.frequency.value = 0.5;
    this.depth.gain.value = 0.002;
    this.wet.gain.value = 0.5;
    this.dry.gain.value = 0.5;
    
    this.lfo.start();
  }

  setRate(hz: number) {
    this.lfo.frequency.value = hz;
  }

  setDepth(amount: number) {
    this.depth.gain.value = amount * 0.005;
  }

  setWetDry(wet: number) {
    this.wet.gain.value = wet;
    this.dry.gain.value = 1 - wet;
  }
}

/**
 * Effects Chain Manager
 */
export class EffectsChain {
  private effects: EffectNode[] = [];
  private input: GainNode;
  private output: GainNode;

  constructor(private context: AudioContext) {
    this.input = context.createGain();
    this.output = context.createGain();
    this.reconnect();
  }

  addEffect(effect: EffectNode) {
    this.effects.push(effect);
    this.reconnect();
  }

  removeEffect(index: number) {
    this.effects.splice(index, 1);
    this.reconnect();
  }

  private reconnect() {
    // Disconnect all
    this.input.disconnect();
    this.effects.forEach(e => {
      e.input.disconnect();
      e.output.disconnect();
    });

    // Reconnect in chain
    if (this.effects.length === 0) {
      this.input.connect(this.output);
    } else {
      this.input.connect(this.effects[0].input);
      
      for (let i = 0; i < this.effects.length - 1; i++) {
        this.effects[i].output.connect(this.effects[i + 1].input);
      }
      
      this.effects[this.effects.length - 1].output.connect(this.output);
    }
  }

  getInput(): AudioNode {
    return this.input;
  }

  getOutput(): AudioNode {
    return this.output;
  }

  getEffects(): EffectNode[] {
    return this.effects;
  }
}
