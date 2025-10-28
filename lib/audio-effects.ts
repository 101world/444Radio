/**
 * Complete Audio Effects Library
 * Ported from AudioMass filters.js - ALL EFFECTS
 * 
 * Includes: Gain, Normalize, Fade In/Out, Reverse, Speed/Pitch,
 * Delay, Reverb, Compressor, Distortion, Bitcrusher, Telephonizer,
 * EQ (Low/High Pass), Vocal Remover, and more
 */

import { getAudioContext, getOfflineAudioContext } from './audio-utils';

// Helper to create offline context
function getOfflineContext(
  numberOfChannels: number,
  length: number,
  sampleRate: number
): OfflineAudioContext {
  return getOfflineAudioContext(numberOfChannels, length, sampleRate);
}

export interface EffectOptions {
  [key: string]: number | boolean | string;
}

export interface Effect {
  name: string;
  apply: (buffer: AudioBuffer, options: EffectOptions) => Promise<AudioBuffer>;
  preview?: (buffer: AudioBuffer, options: EffectOptions) => AudioNode;
}

/**
 * GAIN - Adjust volume (amplification/attenuation)
 */
export async function applyGain(
  buffer: AudioBuffer,
  gain: number = 1.0
): Promise<AudioBuffer> {
  const offlineCtx = getOfflineContext(
    buffer.numberOfChannels,
    buffer.length,
    buffer.sampleRate
  );

  const source = offlineCtx.createBufferSource();
  const gainNode = offlineCtx.createGain();
  
  source.buffer = buffer;
  gainNode.gain.value = gain;
  
  source.connect(gainNode);
  gainNode.connect(offlineCtx.destination);
  
  source.start(0);
  return await offlineCtx.startRendering();
}

/**
 * NORMALIZE - Auto-level audio to maximum without clipping
 */
export async function applyNormalize(buffer: AudioBuffer): Promise<AudioBuffer> {
  let maxAmplitude = 0;
  
  // Find max amplitude across all channels
  for (let i = 0; i < buffer.numberOfChannels; i++) {
    const channelData = buffer.getChannelData(i);
    for (let j = 0; j < channelData.length; j++) {
      maxAmplitude = Math.max(maxAmplitude, Math.abs(channelData[j]));
    }
  }
  
  if (maxAmplitude === 0) return buffer;
  
  const gain = 0.95 / maxAmplitude; // 0.95 to prevent clipping
  return await applyGain(buffer, gain);
}

/**
 * FADE IN - Gradual volume increase from silence
 */
export async function applyFadeIn(
  buffer: AudioBuffer,
  duration: number = 1.0
): Promise<AudioBuffer> {
  const offlineCtx = getOfflineContext(
    buffer.numberOfChannels,
    buffer.length,
    buffer.sampleRate
  );

  const source = offlineCtx.createBufferSource();
  const gainNode = offlineCtx.createGain();
  
  source.buffer = buffer;
  gainNode.gain.setValueAtTime(0, 0);
  gainNode.gain.linearRampToValueAtTime(1, duration);
  
  source.connect(gainNode);
  gainNode.connect(offlineCtx.destination);
  
  source.start(0);
  return await offlineCtx.startRendering();
}

/**
 * FADE OUT - Gradual volume decrease to silence
 */
export async function applyFadeOut(
  buffer: AudioBuffer,
  duration: number = 1.0
): Promise<AudioBuffer> {
  const offlineCtx = getOfflineContext(
    buffer.numberOfChannels,
    buffer.length,
    buffer.sampleRate
  );

  const source = offlineCtx.createBufferSource();
  const gainNode = offlineCtx.createGain();
  const fadeStartTime = buffer.duration - duration;
  
  source.buffer = buffer;
  gainNode.gain.setValueAtTime(1, 0);
  gainNode.gain.setValueAtTime(1, fadeStartTime);
  gainNode.gain.linearRampToValueAtTime(0, buffer.duration);
  
  source.connect(gainNode);
  gainNode.connect(offlineCtx.destination);
  
  source.start(0);
  return await offlineCtx.startRendering();
}

/**
 * REVERSE - Play audio backwards
 */
export async function applyReverse(buffer: AudioBuffer): Promise<AudioBuffer> {
  const audioContext = getAudioContext();
  const reversedBuffer = audioContext.createBuffer(
    buffer.numberOfChannels,
    buffer.length,
    buffer.sampleRate
  );

  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const inputData = buffer.getChannelData(channel);
    const outputData = reversedBuffer.getChannelData(channel);
    
    for (let i = 0; i < buffer.length; i++) {
      outputData[i] = inputData[buffer.length - 1 - i];
    }
  }

  return reversedBuffer;
}

/**
 * DELAY - Echo effect with feedback
 */
export async function applyDelay(
  buffer: AudioBuffer,
  delayTime: number = 0.5,
  feedback: number = 0.3,
  mix: number = 0.5
): Promise<AudioBuffer> {
  const offlineCtx = getOfflineContext(
    buffer.numberOfChannels,
    buffer.length + Math.ceil(delayTime * buffer.sampleRate * 3), // Extra time for decay
    buffer.sampleRate
  );

  const source = offlineCtx.createBufferSource();
  const delay = offlineCtx.createDelay(5.0);
  const feedbackNode = offlineCtx.createGain();
  const wetGain = offlineCtx.createGain();
  const dryGain = offlineCtx.createGain();
  
  source.buffer = buffer;
  delay.delayTime.value = delayTime;
  feedbackNode.gain.value = feedback;
  wetGain.gain.value = mix;
  dryGain.gain.value = 1 - mix;
  
  // Dry signal
  source.connect(dryGain);
  dryGain.connect(offlineCtx.destination);
  
  // Wet signal with feedback
  source.connect(delay);
  delay.connect(wetGain);
  delay.connect(feedbackNode);
  feedbackNode.connect(delay);
  wetGain.connect(offlineCtx.destination);
  
  source.start(0);
  return await offlineCtx.startRendering();
}

/**
 * REVERB - Room ambience simulation
 */
export async function applyReverb(
  buffer: AudioBuffer,
  seconds: number = 2.0,
  decay: number = 2.0,
  mix: number = 0.5
): Promise<AudioBuffer> {
  const offlineCtx = getOfflineContext(
    buffer.numberOfChannels,
    buffer.length + Math.ceil(seconds * buffer.sampleRate),
    buffer.sampleRate
  );

  // Create impulse response for convolution reverb
  const impulseLength = seconds * buffer.sampleRate;
  const impulse = offlineCtx.createBuffer(
    2,
    impulseLength,
    buffer.sampleRate
  );

  for (let channel = 0; channel < 2; channel++) {
    const impulseData = impulse.getChannelData(channel);
    for (let i = 0; i < impulseLength; i++) {
      const n = impulseLength - i;
      impulseData[i] = (Math.random() * 2 - 1) * Math.pow(n / impulseLength, decay);
    }
  }

  const source = offlineCtx.createBufferSource();
  const convolver = offlineCtx.createConvolver();
  const wetGain = offlineCtx.createGain();
  const dryGain = offlineCtx.createGain();
  
  source.buffer = buffer;
  convolver.buffer = impulse;
  wetGain.gain.value = mix;
  dryGain.gain.value = 1 - mix;
  
  // Dry signal
  source.connect(dryGain);
  dryGain.connect(offlineCtx.destination);
  
  // Wet signal
  source.connect(convolver);
  convolver.connect(wetGain);
  wetGain.connect(offlineCtx.destination);
  
  source.start(0);
  return await offlineCtx.startRendering();
}

/**
 * LOW PASS FILTER - Remove high frequencies
 */
export async function applyLowPass(
  buffer: AudioBuffer,
  frequency: number = 1000,
  resonance: number = 1
): Promise<AudioBuffer> {
  const offlineCtx = getOfflineContext(
    buffer.numberOfChannels,
    buffer.length,
    buffer.sampleRate
  );

  const source = offlineCtx.createBufferSource();
  const filter = offlineCtx.createBiquadFilter();
  
  source.buffer = buffer;
  filter.type = 'lowpass';
  filter.frequency.value = frequency;
  filter.Q.value = resonance;
  
  source.connect(filter);
  filter.connect(offlineCtx.destination);
  
  source.start(0);
  return await offlineCtx.startRendering();
}

/**
 * HIGH PASS FILTER - Remove low frequencies
 */
export async function applyHighPass(
  buffer: AudioBuffer,
  frequency: number = 1000,
  resonance: number = 1
): Promise<AudioBuffer> {
  const offlineCtx = getOfflineContext(
    buffer.numberOfChannels,
    buffer.length,
    buffer.sampleRate
  );

  const source = offlineCtx.createBufferSource();
  const filter = offlineCtx.createBiquadFilter();
  
  source.buffer = buffer;
  filter.type = 'highpass';
  filter.frequency.value = frequency;
  filter.Q.value = resonance;
  
  source.connect(filter);
  filter.connect(offlineCtx.destination);
  
  source.start(0);
  return await offlineCtx.startRendering();
}

/**
 * COMPRESSOR - Dynamic range compression
 */
export async function applyCompressor(
  buffer: AudioBuffer,
  threshold: number = -24,
  knee: number = 30,
  ratio: number = 12,
  attack: number = 0.003,
  release: number = 0.25
): Promise<AudioBuffer> {
  const offlineCtx = getOfflineContext(
    buffer.numberOfChannels,
    buffer.length,
    buffer.sampleRate
  );

  const source = offlineCtx.createBufferSource();
  const compressor = offlineCtx.createDynamicsCompressor();
  
  source.buffer = buffer;
  compressor.threshold.value = threshold;
  compressor.knee.value = knee;
  compressor.ratio.value = ratio;
  compressor.attack.value = attack;
  compressor.release.value = release;
  
  source.connect(compressor);
  compressor.connect(offlineCtx.destination);
  
  source.start(0);
  return await offlineCtx.startRendering();
}

/**
 * DISTORTION - Waveshaping overdrive
 */
export async function applyDistortion(
  buffer: AudioBuffer,
  amount: number = 50
): Promise<AudioBuffer> {
  const offlineCtx = getOfflineContext(
    buffer.numberOfChannels,
    buffer.length,
    buffer.sampleRate
  );

  // Create distortion curve
  const samples = 44100;
  const curve = new Float32Array(samples);
  const deg = Math.PI / 180;
  
  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / samples - 1;
    curve[i] = ((3 + amount) * x * 20 * deg) / (Math.PI + amount * Math.abs(x));
  }

  const source = offlineCtx.createBufferSource();
  const waveshaper = offlineCtx.createWaveShaper();
  
  source.buffer = buffer;
  waveshaper.curve = curve;
  waveshaper.oversample = '4x';
  
  source.connect(waveshaper);
  waveshaper.connect(offlineCtx.destination);
  
  source.start(0);
  return await offlineCtx.startRendering();
}

/**
 * BITCRUSHER - Lo-fi bit reduction
 */
export async function applyBitcrusher(
  buffer: AudioBuffer,
  bits: number = 4
): Promise<AudioBuffer> {
  const audioContext = getAudioContext();
  const crushedBuffer = audioContext.createBuffer(
    buffer.numberOfChannels,
    buffer.length,
    buffer.sampleRate
  );

  const step = Math.pow(0.5, bits);

  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const inputData = buffer.getChannelData(channel);
    const outputData = crushedBuffer.getChannelData(channel);
    
    for (let i = 0; i < buffer.length; i++) {
      outputData[i] = step * Math.floor(inputData[i] / step + 0.5);
    }
  }

  return crushedBuffer;
}

/**
 * TELEPHONIZER - Simulate telephone audio quality
 */
export async function applyTelephonizer(buffer: AudioBuffer): Promise<AudioBuffer> {
  // Bandpass filter (300Hz - 3400Hz) + distortion
  const offlineCtx = getOfflineContext(
    buffer.numberOfChannels,
    buffer.length,
    buffer.sampleRate
  );

  const source = offlineCtx.createBufferSource();
  const highPass = offlineCtx.createBiquadFilter();
  const lowPass = offlineCtx.createBiquadFilter();
  const distortion = offlineCtx.createWaveShaper();
  
  // Telephone frequency range
  highPass.type = 'highpass';
  highPass.frequency.value = 300;
  lowPass.type = 'lowpass';
  lowPass.frequency.value = 3400;
  
  // Slight distortion curve
  const curve = new Float32Array(4096);
  for (let i = 0; i < 4096; i++) {
    const x = (i * 2) / 4096 - 1;
    curve[i] = Math.tanh(x * 2);
  }
  distortion.curve = curve;
  
  source.buffer = buffer;
  source.connect(highPass);
  highPass.connect(lowPass);
  lowPass.connect(distortion);
  distortion.connect(offlineCtx.destination);
  
  source.start(0);
  return await offlineCtx.startRendering();
}

/**
 * SPEED CHANGE - Change playback speed (affects pitch)
 */
export async function applySpeedChange(
  buffer: AudioBuffer,
  rate: number = 1.0
): Promise<AudioBuffer> {
  const newLength = Math.floor(buffer.length / rate);
  const audioContext = getAudioContext();
  const newBuffer = audioContext.createBuffer(
    buffer.numberOfChannels,
    newLength,
    buffer.sampleRate
  );

  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const inputData = buffer.getChannelData(channel);
    const outputData = newBuffer.getChannelData(channel);
    
    for (let i = 0; i < newLength; i++) {
      const position = i * rate;
      const index = Math.floor(position);
      const fraction = position - index;
      
      if (index + 1 < buffer.length) {
        // Linear interpolation
        outputData[i] = inputData[index] * (1 - fraction) + inputData[index + 1] * fraction;
      } else {
        outputData[i] = inputData[index];
      }
    }
  }

  return newBuffer;
}

/**
 * VOCAL REMOVER - Remove center-panned vocals (karaoke effect)
 */
export async function applyVocalRemover(buffer: AudioBuffer): Promise<AudioBuffer> {
  if (buffer.numberOfChannels < 2) {
    throw new Error('Vocal remover requires stereo audio');
  }

  const audioContext = getAudioContext();
  const newBuffer = audioContext.createBuffer(
    buffer.numberOfChannels,
    buffer.length,
    buffer.sampleRate
  );

  const leftData = buffer.getChannelData(0);
  const rightData = buffer.getChannelData(1);
  const newLeftData = newBuffer.getChannelData(0);
  const newRightData = newBuffer.getChannelData(1);

  for (let i = 0; i < buffer.length; i++) {
    // Subtract common (center) signal
    const diff = leftData[i] - rightData[i];
    newLeftData[i] = diff;
    newRightData[i] = diff;
  }

  return newBuffer;
}

/**
 * STEREO WIDEN - Enhance stereo width
 */
export async function applyStereoWiden(
  buffer: AudioBuffer,
  amount: number = 0.5
): Promise<AudioBuffer> {
  if (buffer.numberOfChannels < 2) {
    return buffer; // Can't widen mono
  }

  const audioContext = getAudioContext();
  const newBuffer = audioContext.createBuffer(
    buffer.numberOfChannels,
    buffer.length,
    buffer.sampleRate
  );

  const leftData = buffer.getChannelData(0);
  const rightData = buffer.getChannelData(1);
  const newLeftData = newBuffer.getChannelData(0);
  const newRightData = newBuffer.getChannelData(1);

  for (let i = 0; i < buffer.length; i++) {
    const mid = (leftData[i] + rightData[i]) * 0.5;
    const side = (leftData[i] - rightData[i]) * 0.5;
    
    newLeftData[i] = mid + side * (1 + amount);
    newRightData[i] = mid - side * (1 + amount);
  }

  return newBuffer;
}

/**
 * SILENCE - Insert or replace with silence
 */
export async function applySilence(
  buffer: AudioBuffer,
  offset: number = 0,
  duration: number = 1.0
): Promise<AudioBuffer> {
  const audioContext = getAudioContext();
  const newBuffer = audioContext.createBuffer(
    buffer.numberOfChannels,
    buffer.length,
    buffer.sampleRate
  );

  const startSample = Math.floor(offset * buffer.sampleRate);
  const endSample = Math.min(
    startSample + Math.floor(duration * buffer.sampleRate),
    buffer.length
  );

  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const inputData = buffer.getChannelData(channel);
    const outputData = newBuffer.getChannelData(channel);
    
    for (let i = 0; i < buffer.length; i++) {
      if (i >= startSample && i < endSample) {
        outputData[i] = 0;
      } else {
        outputData[i] = inputData[i];
      }
    }
  }

  return newBuffer;
}

/**
 * Export all effects as an object for easy access
 */
export const AudioEffects = {
  gain: applyGain,
  normalize: applyNormalize,
  fadeIn: applyFadeIn,
  fadeOut: applyFadeOut,
  reverse: applyReverse,
  delay: applyDelay,
  reverb: applyReverb,
  lowPass: applyLowPass,
  highPass: applyHighPass,
  compressor: applyCompressor,
  distortion: applyDistortion,
  bitcrusher: applyBitcrusher,
  telephonizer: applyTelephonizer,
  speedChange: applySpeedChange,
  vocalRemover: applyVocalRemover,
  stereoWiden: applyStereoWiden,
  silence: applySilence,
};
