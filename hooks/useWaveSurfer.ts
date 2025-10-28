/**
 * useWaveSurfer - React hook for WaveSurfer.js integration
 * 
 * Provides a React-friendly wrapper around WaveSurfer.js for audio waveform rendering
 * and playback control. Handles lifecycle, events, and state management.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import WaveSurfer from 'wavesurfer.js';

/**
 * Convert AudioBuffer to WAV Blob for WaveSurfer loading
 */
function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const length = buffer.length * buffer.numberOfChannels * 2;
  const arrayBuffer = new ArrayBuffer(44 + length);
  const view = new DataView(arrayBuffer);

  // Write WAV header
  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF'); // ChunkID
  view.setUint32(4, 36 + length, true); // ChunkSize
  writeString(8, 'WAVE'); // Format
  writeString(12, 'fmt '); // Subchunk1ID
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true); // AudioFormat (1 for PCM)
  view.setUint16(22, buffer.numberOfChannels, true); // NumChannels
  view.setUint32(24, buffer.sampleRate, true); // SampleRate
  view.setUint32(28, buffer.sampleRate * buffer.numberOfChannels * 2, true); // ByteRate
  view.setUint16(32, buffer.numberOfChannels * 2, true); // BlockAlign
  view.setUint16(34, 16, true); // BitsPerSample
  writeString(36, 'data'); // Subchunk2ID
  view.setUint32(40, length, true); // Subchunk2Size

  // Write audio data
  const channels: Float32Array[] = [];
  for (let i = 0; i < buffer.numberOfChannels; i++) {
    channels.push(buffer.getChannelData(i));
  }

  let offset = 44;
  for (let i = 0; i < buffer.length; i++) {
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      const sample = Math.max(-1, Math.min(1, channels[channel][i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

export interface UseWaveSurferOptions {
  container: string | HTMLElement;
  height?: number;
  waveColor?: string;
  progressColor?: string;
  cursorColor?: string;
  splitChannels?: boolean;
  autoCenter?: boolean;
  normalize?: boolean;
  hideScrollbar?: boolean;
}

export interface UseWaveSurferReturn {
  wavesurfer: WaveSurfer | null;
  isReady: boolean;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  loadAudio: (url: string | AudioBuffer) => Promise<void>;
  loadBlob: (blob: Blob) => Promise<void>;
  play: () => void;
  pause: () => void;
  stop: () => void;
  seekTo: (time: number) => void;
  setVolume: (volume: number) => void;
  setPlaybackRate: (rate: number) => void;
  destroy: () => void;
  getBuffer: () => AudioBuffer | null;
}

export function useWaveSurfer(
  options: UseWaveSurferOptions
): UseWaveSurferReturn {
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Initialize WaveSurfer
  useEffect(() => {
    // Don't initialize if container doesn't exist yet
    if (typeof options.container === 'string') {
      const element = document.querySelector(options.container);
      if (!element) {
        console.warn(`Container ${options.container} not found. Skipping WaveSurfer init.`);
        return;
      }
    }

    try {
      const ws = WaveSurfer.create({
        container: options.container,
        height: options.height || 128,
        waveColor: options.waveColor || '#8b5cf6', // Purple
        progressColor: options.progressColor || '#ec4899', // Pink
        cursorColor: options.cursorColor || '#22d3ee', // Cyan
        cursorWidth: 2,
        barWidth: 2,
        barGap: 1,
        barRadius: 2,
        normalize: options.normalize ?? true,
        hideScrollbar: options.hideScrollbar ?? true,
        autoCenter: options.autoCenter ?? true,
        interact: true,
      });

      // Event listeners
      ws.on('ready', () => {
        setIsReady(true);
        setDuration(ws.getDuration());
        console.log('✅ WaveSurfer ready, duration:', ws.getDuration());
      });

      ws.on('play', () => {
        setIsPlaying(true);
      });

      ws.on('pause', () => {
        setIsPlaying(false);
      });

      ws.on('finish', () => {
        setIsPlaying(false);
      });

      ws.on('timeupdate', (time: number) => {
        setCurrentTime(time);
      });

      ws.on('error', (err: Error) => {
        console.error('❌ WaveSurfer error:', err.message);
      });

      wavesurferRef.current = ws;
      console.log('🎵 WaveSurfer instance created');

      return () => {
        if (wavesurferRef.current) {
          wavesurferRef.current.destroy();
          wavesurferRef.current = null;
          setIsReady(false);
          setIsPlaying(false);
          setCurrentTime(0);
          setDuration(0);
          console.log('🗑️ WaveSurfer instance destroyed');
        }
      };
    } catch (error) {
      console.error('❌ Failed to initialize WaveSurfer:', error);
    }
  }, []); // Only run once on mount

  // Load audio from URL or AudioBuffer
  const loadAudio = useCallback(async (source: string | AudioBuffer) => {
    if (!wavesurferRef.current) {
      console.error('❌ WaveSurfer not initialized');
      return;
    }

    try {
      setIsReady(false);
      
      if (typeof source === 'string') {
        await wavesurferRef.current.load(source);
      } else {
        // Load from AudioBuffer - WaveSurfer doesn't support direct AudioBuffer loading
        // Convert to WAV blob first
        const wavBlob = audioBufferToWavBlob(source);
        await wavesurferRef.current.loadBlob(wavBlob);
      }
      
      console.log('✅ Audio loaded');
    } catch (error) {
      console.error('❌ Failed to load audio:', error);
    }
  }, []);

  // Load audio from Blob
  const loadBlob = useCallback(async (blob: Blob) => {
    if (!wavesurferRef.current) {
      console.error('❌ WaveSurfer not initialized');
      return;
    }

    try {
      setIsReady(false);
      await wavesurferRef.current.loadBlob(blob);
      console.log('✅ Blob loaded');
    } catch (error) {
      console.error('❌ Failed to load blob:', error);
    }
  }, []);

  // Play audio
  const play = useCallback(() => {
    if (!wavesurferRef.current || !isReady) {
      console.warn('⚠️ Cannot play: WaveSurfer not ready');
      return;
    }
    wavesurferRef.current.play();
  }, [isReady]);

  // Pause audio
  const pause = useCallback(() => {
    if (!wavesurferRef.current) return;
    wavesurferRef.current.pause();
  }, []);

  // Stop audio (pause + seek to start)
  const stop = useCallback(() => {
    if (!wavesurferRef.current) return;
    wavesurferRef.current.stop();
    setIsPlaying(false);
    setCurrentTime(0);
  }, []);

  // Seek to time (in seconds)
  const seekTo = useCallback((time: number) => {
    if (!wavesurferRef.current || !isReady) return;
    const duration = wavesurferRef.current.getDuration();
    if (duration > 0) {
      // WaveSurfer seekTo expects 0-1 fraction
      wavesurferRef.current.seekTo(time / duration);
    }
  }, [isReady]);

  // Set volume (0-1)
  const setVolume = useCallback((volume: number) => {
    if (!wavesurferRef.current) return;
    wavesurferRef.current.setVolume(Math.max(0, Math.min(1, volume)));
  }, []);

  // Set playback rate (0.5-2.0 typical)
  const setPlaybackRate = useCallback((rate: number) => {
    if (!wavesurferRef.current) return;
    wavesurferRef.current.setPlaybackRate(rate);
  }, []);

  // Destroy instance
  const destroy = useCallback(() => {
    if (wavesurferRef.current) {
      wavesurferRef.current.destroy();
      wavesurferRef.current = null;
      setIsReady(false);
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
    }
  }, []);

  // Get underlying AudioBuffer
  const getBuffer = useCallback((): AudioBuffer | null => {
    if (!wavesurferRef.current) return null;
    // @ts-ignore - backend is internal API
    return wavesurferRef.current.backend?.buffer || null;
  }, []);

  return {
    wavesurfer: wavesurferRef.current,
    isReady,
    isPlaying,
    currentTime,
    duration,
    loadAudio,
    loadBlob,
    play,
    pause,
    stop,
    seekTo,
    setVolume,
    setPlaybackRate,
    destroy,
    getBuffer,
  };
}
