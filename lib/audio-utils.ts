/**
 * Audio Buffer Manipulation Utilities
 * Ported from AudioMass actions.js to TypeScript
 * 
 * These functions handle audio buffer operations using Web Audio API:
 * - Copy/trim/insert segments
 * - Create silence
 * - Convert float to int16 for export
 * - Manage AudioContext instances
 */

export interface AudioBufferSegment {
  buffer: AudioBuffer;
  offset: number;
  duration: number;
}

/**
 * Copy a segment of an AudioBuffer
 * @param buffer - Source AudioBuffer
 * @param offset - Start time in seconds
 * @param duration - Length in seconds
 * @returns New AudioBuffer with copied segment
 */
export function copyBufferSegment(
  buffer: AudioBuffer,
  offset: number,
  duration: number
): AudioBuffer {
  const sampleRate = buffer.sampleRate;
  const startSample = Math.floor(offset * sampleRate);
  const durationSamples = Math.floor(duration * sampleRate);
  const endSample = Math.min(startSample + durationSamples, buffer.length);
  const length = endSample - startSample;

  if (length <= 0) {
    throw new Error('Invalid segment: duration must be positive');
  }

  const audioContext = getAudioContext();
  const newBuffer = audioContext.createBuffer(
    buffer.numberOfChannels,
    length,
    sampleRate
  );

  for (let i = 0; i < buffer.numberOfChannels; i++) {
    const channelData = buffer.getChannelData(i);
    const newChannelData = newBuffer.getChannelData(i);
    
    // Copy the segment
    for (let j = 0; j < length; j++) {
      newChannelData[j] = channelData[startSample + j];
    }
  }

  return newBuffer;
}

/**
 * Trim buffer to remove a specific range
 * @param buffer - Source AudioBuffer
 * @param offset - Start time of section to remove (seconds)
 * @param duration - Length of section to remove (seconds)
 * @param activeChannels - Which channels to process (optional)
 * @returns New AudioBuffer with trimmed content
 */
export function trimBuffer(
  buffer: AudioBuffer,
  offset: number,
  duration: number,
  activeChannels?: boolean[]
): AudioBuffer {
  const sampleRate = buffer.sampleRate;
  const startSample = Math.floor(offset * sampleRate);
  const durationSamples = Math.floor(duration * sampleRate);
  const endSample = startSample + durationSamples;
  const newLength = buffer.length - durationSamples;

  if (newLength <= 0) {
    throw new Error('Trim would remove entire buffer');
  }

  const audioContext = getAudioContext();
  const newBuffer = audioContext.createBuffer(
    buffer.numberOfChannels,
    newLength,
    sampleRate
  );

  const channels = activeChannels || Array(buffer.numberOfChannels).fill(true);

  for (let i = 0; i < buffer.numberOfChannels; i++) {
    const channelData = buffer.getChannelData(i);
    const newChannelData = newBuffer.getChannelData(i);

    if (!channels[i]) {
      // Copy entire channel if not active
      newChannelData.set(channelData);
      continue;
    }

    // Copy before trim section
    for (let j = 0; j < startSample; j++) {
      newChannelData[j] = channelData[j];
    }

    // Copy after trim section
    for (let j = endSample; j < buffer.length; j++) {
      newChannelData[j - durationSamples] = channelData[j];
    }
  }

  return newBuffer;
}

/**
 * Insert audio segment at position
 * @param targetBuffer - Buffer to insert into
 * @param insertBuffer - Buffer to insert
 * @param offset - Position in seconds
 * @returns New AudioBuffer with inserted content
 */
export function insertSegmentToBuffer(
  targetBuffer: AudioBuffer,
  insertBuffer: AudioBuffer,
  offset: number
): AudioBuffer {
  const sampleRate = targetBuffer.sampleRate;
  const offsetSamples = Math.floor(offset * sampleRate);
  const newLength = targetBuffer.length + insertBuffer.length;

  const audioContext = getAudioContext();
  const newBuffer = audioContext.createBuffer(
    targetBuffer.numberOfChannels,
    newLength,
    sampleRate
  );

  for (let i = 0; i < targetBuffer.numberOfChannels; i++) {
    const targetData = targetBuffer.getChannelData(i);
    const insertData = insertBuffer.numberOfChannels > 1
      ? insertBuffer.getChannelData(i)
      : insertBuffer.getChannelData(0); // Mono insert to all channels
    const newData = newBuffer.getChannelData(i);

    // Before insertion point
    for (let j = 0; j < offsetSamples; j++) {
      newData[j] = targetData[j];
    }

    // Inserted segment
    for (let j = 0; j < insertBuffer.length; j++) {
      newData[offsetSamples + j] = insertData[j];
    }

    // After insertion point
    for (let j = offsetSamples; j < targetBuffer.length; j++) {
      newData[j + insertBuffer.length] = targetData[j];
    }
  }

  return newBuffer;
}

/**
 * Create silent AudioBuffer
 * @param duration - Length in seconds
 * @param sampleRate - Sample rate (default 44100)
 * @param channels - Number of channels (default 2)
 * @returns Silent AudioBuffer
 */
export function makeSilenceBuffer(
  duration: number,
  sampleRate = 44100,
  channels = 2
): AudioBuffer {
  const length = Math.floor(duration * sampleRate);
  const audioContext = getAudioContext();
  return audioContext.createBuffer(channels, length, sampleRate);
}

/**
 * Overwrite entire buffer with new buffer
 * @param targetBuffer - Buffer to overwrite (unused, kept for API compatibility)
 * @param newBuffer - New buffer content
 * @returns The new buffer
 */
export function overwriteBuffer(
  targetBuffer: AudioBuffer,
  newBuffer: AudioBuffer
): AudioBuffer {
  return newBuffer;
}

/**
 * Convert Float32Array audio data to Int16Array for export
 * Web Audio API uses float32 (-1.0 to 1.0)
 * Export formats (MP3/WAV) use int16 (-32768 to 32767)
 * 
 * @param float32Array - Audio data in float format (-1.0 to 1.0)
 * @returns Audio data in int16 format (-32768 to 32767)
 */
export function float32ToInt16(float32Array: Float32Array): Int16Array {
  const int16Array = new Int16Array(float32Array.length);

  for (let i = 0; i < float32Array.length; i++) {
    const value = float32Array[i];
    // Scale: negative values * 32768, positive * 32767
    const scaled = value < 0 ? value * 32768 : value * 32767;
    // Clamp to int16 range
    int16Array[i] = Math.max(-32768, Math.min(32767, Math.round(scaled)));
  }

  return int16Array;
}

/**
 * Get shared AudioContext instance
 * Reuses single context to avoid browser limits (typically 6 contexts max)
 */
let sharedAudioContext: AudioContext | null = null;

export function getAudioContext(): AudioContext {
  if (!sharedAudioContext) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) {
      // In test environments (Vitest/Jest), Web Audio API isn't available in JSDOM.
      // Provide a lightweight mock to allow components/hooks that call getAudioContext
      // to initialize without throwing during unit tests. The mock implements
      // the minimal methods used in our code (createBuffer, createGain, createStereoPanner, destination).
      if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'test') {
        const makeMockBuffer = (channels: number, length: number, sampleRate: number) => {
          const buffer: any = {
            numberOfChannels: channels,
            length,
            sampleRate,
            getChannelData: (i: number) => new Float32Array(length),
          };
          return buffer as unknown as AudioBuffer;
        };
        const mockCtx: any = {
          createBuffer: (channels: number, length: number, sampleRate: number) => makeMockBuffer(channels, length, sampleRate),
          createGain: () => ({ gain: { value: 1 }, connect: () => {}, disconnect: () => {} }),
          createStereoPanner: () => ({ pan: { value: 0 }, connect: () => {}, disconnect: () => {} }),
          destination: {},
          createBufferSource: () => ({ start: () => {}, stop: () => {}, connect: () => {}, disconnect: () => {} }),
          resume: async () => {},
        };
        sharedAudioContext = mockCtx as AudioContext;
        return sharedAudioContext;
      }
      throw new Error('Web Audio API not supported in this browser');
    }
    sharedAudioContext = new AudioContextClass();
  }
  return sharedAudioContext;
}

/**
 * Create OfflineAudioContext for non-realtime processing
 * Used for applying effects without real-time playback
 * 
 * @param channels - Number of channels
 * @param sampleRate - Sample rate (e.g., 44100)
 * @param duration - Duration in samples
 */
export function getOfflineAudioContext(
  channels: number,
  sampleRate: number,
  duration: number
): OfflineAudioContext {
  const OfflineAudioContextClass = window.OfflineAudioContext || (window as any).webkitOfflineAudioContext;
  if (!OfflineAudioContextClass) {
    throw new Error('OfflineAudioContext not supported in this browser');
  }
  return new OfflineAudioContextClass(channels, duration, sampleRate);
}

/**
 * Load audio from URL to AudioBuffer
 * @param url - URL to audio file
 * @returns AudioBuffer
 */
export async function loadAudioFromUrl(url: string): Promise<AudioBuffer> {
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  const audioContext = getAudioContext();
  return await audioContext.decodeAudioData(arrayBuffer);
}

/**
 * Load audio from File to AudioBuffer
 * @param file - File object
 * @returns AudioBuffer
 */
export async function loadAudioFromFile(file: File): Promise<AudioBuffer> {
  const arrayBuffer = await file.arrayBuffer();
  const audioContext = getAudioContext();
  return await audioContext.decodeAudioData(arrayBuffer);
}

/**
 * Normalize audio buffer to peak at specific level
 * @param buffer - Source AudioBuffer
 * @param targetLevel - Target peak level (0.0 to 1.0, default 1.0)
 * @returns New normalized AudioBuffer
 */
export function normalizeBuffer(
  buffer: AudioBuffer,
  targetLevel = 1.0
): AudioBuffer {
  const audioContext = getAudioContext();
  const newBuffer = audioContext.createBuffer(
    buffer.numberOfChannels,
    buffer.length,
    buffer.sampleRate
  );

  // Find peak across all channels
  let peak = 0;
  for (let i = 0; i < buffer.numberOfChannels; i++) {
    const channelData = buffer.getChannelData(i);
    for (let j = 0; j < channelData.length; j++) {
      const abs = Math.abs(channelData[j]);
      if (abs > peak) peak = abs;
    }
  }

  // Calculate gain
  const gain = peak > 0 ? targetLevel / peak : 1.0;

  // Apply gain to all channels
  for (let i = 0; i < buffer.numberOfChannels; i++) {
    const channelData = buffer.getChannelData(i);
    const newChannelData = newBuffer.getChannelData(i);
    for (let j = 0; j < channelData.length; j++) {
      newChannelData[j] = channelData[j] * gain;
    }
  }

  return newBuffer;
}

/**
 * Apply fade in to buffer
 * @param buffer - Source AudioBuffer
 * @param duration - Fade duration in seconds
 * @returns New AudioBuffer with fade in
 */
export function fadeIn(buffer: AudioBuffer, duration: number): AudioBuffer {
  const audioContext = getAudioContext();
  const newBuffer = audioContext.createBuffer(
    buffer.numberOfChannels,
    buffer.length,
    buffer.sampleRate
  );

  const fadeSamples = Math.floor(duration * buffer.sampleRate);

  for (let i = 0; i < buffer.numberOfChannels; i++) {
    const channelData = buffer.getChannelData(i);
    const newChannelData = newBuffer.getChannelData(i);

    for (let j = 0; j < buffer.length; j++) {
      if (j < fadeSamples) {
        // Linear fade in
        const gain = j / fadeSamples;
        newChannelData[j] = channelData[j] * gain;
      } else {
        newChannelData[j] = channelData[j];
      }
    }
  }

  return newBuffer;
}

/**
 * Apply fade out to buffer
 * @param buffer - Source AudioBuffer
 * @param duration - Fade duration in seconds
 * @returns New AudioBuffer with fade out
 */
export function fadeOut(buffer: AudioBuffer, duration: number): AudioBuffer {
  const audioContext = getAudioContext();
  const newBuffer = audioContext.createBuffer(
    buffer.numberOfChannels,
    buffer.length,
    buffer.sampleRate
  );

  const fadeSamples = Math.floor(duration * buffer.sampleRate);
  const fadeStart = buffer.length - fadeSamples;

  for (let i = 0; i < buffer.numberOfChannels; i++) {
    const channelData = buffer.getChannelData(i);
    const newChannelData = newBuffer.getChannelData(i);

    for (let j = 0; j < buffer.length; j++) {
      if (j >= fadeStart) {
        // Linear fade out
        const gain = (buffer.length - j) / fadeSamples;
        newChannelData[j] = channelData[j] * gain;
      } else {
        newChannelData[j] = channelData[j];
      }
    }
  }

  return newBuffer;
}

/**
 * Mix multiple buffers into one
 * All buffers must have same sample rate
 * Output length is the longest input buffer
 * 
 * @param buffers - Array of AudioBuffers to mix
 * @param gains - Optional gain per buffer (default 1.0 for all)
 * @returns Mixed AudioBuffer
 */
export function mixBuffers(
  buffers: AudioBuffer[],
  gains?: number[]
): AudioBuffer {
  if (buffers.length === 0) {
    throw new Error('No buffers to mix');
  }

  const sampleRate = buffers[0].sampleRate;
  const maxChannels = Math.max(...buffers.map(b => b.numberOfChannels));
  const maxLength = Math.max(...buffers.map(b => b.length));

  const audioContext = getAudioContext();
  const mixedBuffer = audioContext.createBuffer(maxChannels, maxLength, sampleRate);

  const bufferGains = gains || buffers.map(() => 1.0);

  for (let ch = 0; ch < maxChannels; ch++) {
    const mixedData = mixedBuffer.getChannelData(ch);

    for (let i = 0; i < buffers.length; i++) {
      const buffer = buffers[i];
      const gain = bufferGains[i];

      // Use channel 0 if buffer has fewer channels
      const channelIndex = ch < buffer.numberOfChannels ? ch : 0;
      const channelData = buffer.getChannelData(channelIndex);

      for (let j = 0; j < channelData.length; j++) {
        mixedData[j] += channelData[j] * gain;
      }
    }
  }

  return mixedBuffer;
}
