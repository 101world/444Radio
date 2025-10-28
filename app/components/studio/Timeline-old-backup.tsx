/**
 * Timeline - Multi-track waveform display with context menu
 * Renders all tracks with WaveSurfer instances, controls, effects, and drag & drop
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import { useStudio } from '@/app/contexts/StudioContext';
import { useWaveSurfer } from '@/hooks/useWaveSurfer';
import { Volume2, VolumeX, Headphones, Trash2, Upload } from 'lucide-react';
import { ContextMenu, getTrackContextMenuItems } from './ContextMenu';
import { AudioEffects } from '@/lib/audio-effects';

interface TrackRowProps {
  trackId: string;
}

function TrackRow({ trackId }: TrackRowProps) {
  const {
    tracks,
    setTrackVolume,
    setTrackPan,
    toggleMute,
    toggleSolo,
    removeTrack,
    isPlaying,
    currentTime,
    addTrack,
    zoom,
    selectedTrackId,
    setSelectedTrack,
  } = useStudio();

  const track = tracks.find((t) => t.id === trackId);
  const containerRef = useRef<HTMLDivElement>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Initialize WaveSurfer for this track
  const wavesurfer = useWaveSurfer({
    container: `#waveform-${trackId}`,
    height: 80,
    waveColor: track?.color || '#8b5cf6',
    progressColor: track?.color ? `${track.color}88` : '#8b5cf688',
    cursorColor: '#22d3ee',
  });

  // Load audio when track is ready
  useEffect(() => {
    if (track?.audioUrl && wavesurfer.wavesurfer) {
      wavesurfer.loadAudio(track.audioUrl);
    }
  }, [track?.audioUrl, wavesurfer.wavesurfer]);

  // Update zoom when it changes (only if audio is loaded)
  useEffect(() => {
    if (wavesurfer.wavesurfer && wavesurfer.isReady) {
      wavesurfer.wavesurfer.zoom(50 * zoom);
    }
  }, [zoom, wavesurfer.wavesurfer, wavesurfer.isReady]);

  // Sync playback
  useEffect(() => {
    if (wavesurfer.wavesurfer && wavesurfer.isReady) {
      if (isPlaying && !wavesurfer.isPlaying) {
        wavesurfer.seekTo(currentTime);
        wavesurfer.play();
      } else if (!isPlaying && wavesurfer.isPlaying) {
        wavesurfer.pause();
      }
    }
  }, [isPlaying, wavesurfer.isReady]);

  // Apply effect to track
  const applyEffect = async (
    effectFn: (buffer: AudioBuffer, ...args: any[]) => Promise<AudioBuffer>,
    ...args: any[]
  ) => {
    if (!track?.audioUrl || !wavesurfer.wavesurfer) return;

    setIsProcessing(true);
    try {
      // Fetch audio
      const response = await fetch(track.audioUrl);
      const arrayBuffer = await response.arrayBuffer();
      const audioContext = new AudioContext();
      const originalBuffer = await audioContext.decodeAudioData(arrayBuffer);

      // Apply effect
      const processedBuffer = await effectFn(originalBuffer, ...args);

      // Convert back to blob URL
      const wavBlob = await audioBufferToWavBlob(processedBuffer);
      const newUrl = URL.createObjectURL(wavBlob);

      // Update track
      addTrack(`${track.name} (Processed)`, newUrl);
      console.log(`✅ Applied effect to ${track.name}`);
    } catch (error) {
      console.error('Effect processing error:', error);
      alert('Failed to apply effect. Check console for details.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Helper: AudioBuffer to WAV Blob
  const audioBufferToWavBlob = async (buffer: AudioBuffer): Promise<Blob> => {
    const numberOfChannels = buffer.numberOfChannels;
    const length = buffer.length * numberOfChannels * 2;
    const wavBuffer = new ArrayBuffer(44 + length);
    const view = new DataView(wavBuffer);

    // Write WAV header
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + length, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numberOfChannels, true);
    view.setUint32(24, buffer.sampleRate, true);
    view.setUint32(28, buffer.sampleRate * numberOfChannels * 2, true);
    view.setUint16(32, numberOfChannels * 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, length, true);

    // Write PCM samples
    const offset = 44;
    let index = offset;
    for (let i = 0; i < buffer.length; i++) {
      for (let channel = 0; channel < numberOfChannels; channel++) {
        const sample = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[i]));
        view.setInt16(index, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
        index += 2;
      }
    }

    return new Blob([wavBuffer], { type: 'audio/wav' });
  };

  // Context menu handlers
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const contextMenuItems = getTrackContextMenuItems({
    onDelete: () => removeTrack(trackId),
    onDuplicate: () => {
      if (track?.audioUrl) {
        addTrack(`${track.name} Copy`, track.audioUrl);
      }
    },
    onReverse: () => applyEffect(AudioEffects.reverse),
    onNormalize: () => applyEffect(AudioEffects.normalize),
    onFadeIn: () => applyEffect(AudioEffects.fadeIn, 2.0),
    onFadeOut: () => applyEffect(AudioEffects.fadeOut, 2.0),
    onGain: () => {
      const gain = prompt('Enter gain amount (0.1 to 5.0):', '1.5');
      if (gain) applyEffect(AudioEffects.gain, parseFloat(gain));
    },
    onDelay: () => {
      applyEffect(AudioEffects.delay, 0.5, 0.3, 0.5);
    },
    onReverb: () => {
      applyEffect(AudioEffects.reverb, 2.0, 2.0, 0.5);
    },
    onCompressor: () => {
      applyEffect(AudioEffects.compressor, -24, 30, 12, 0.003, 0.25);
    },
    onDistortion: () => {
      applyEffect(AudioEffects.distortion, 50);
    },
    onBitcrusher: () => {
      applyEffect(AudioEffects.bitcrusher, 4);
    },
    onTelephonizer: () => {
      applyEffect(AudioEffects.telephonizer);
    },
    onLowPass: () => {
      const freq = prompt('Enter cutoff frequency (20-20000 Hz):', '1000');
      if (freq) applyEffect(AudioEffects.lowPass, parseInt(freq), 1);
    },
    onHighPass: () => {
      const freq = prompt('Enter cutoff frequency (20-20000 Hz):', '1000');
      if (freq) applyEffect(AudioEffects.highPass, parseInt(freq), 1);
    },
    onSpeedChange: () => {
      const rate = prompt('Enter speed rate (0.5 = half speed, 2.0 = double):', '1.5');
      if (rate) applyEffect(AudioEffects.speedChange, parseFloat(rate));
    },
    onVocalRemover: () => {
      applyEffect(AudioEffects.vocalRemover);
    },
    onStereoWiden: () => {
      applyEffect(AudioEffects.stereoWiden, 0.5);
    },
  });

  if (!track) return null;

  const isSelected = selectedTrackId === trackId;

  return (
    <div 
      className={`bg-gray-900/50 backdrop-blur-sm rounded-lg border p-3 mb-2 relative cursor-pointer transition-all ${
        isSelected 
          ? 'border-purple-500 ring-2 ring-purple-500/50' 
          : 'border-purple-500/20 hover:border-purple-500/40'
      }`}
      onContextMenu={handleContextMenu}
      onClick={() => setSelectedTrack(trackId)}
    >
      {/* Processing overlay */}
      {isProcessing && (
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-10 rounded-lg">
          <div className="text-center">
            <div className="animate-spin w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full mx-auto mb-2"></div>
            <p className="text-white text-sm">Processing effect...</p>
          </div>
        </div>
      )}

      {/* Context menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenuItems}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* Track header */}
      <div className="flex items-center gap-3 mb-2">
        <div
          className="w-3 h-3 rounded-full"
          style={{ backgroundColor: track.color }}
        />
        <span className="text-white font-medium text-sm flex-1">{track.name}</span>

        {/* Controls */}
        <div className="flex items-center gap-2">
          {/* Volume */}
          <div className="flex items-center gap-1">
            {track.mute ? (
              <VolumeX className="w-4 h-4 text-gray-400" />
            ) : (
              <Volume2 className="w-4 h-4 text-purple-400" />
            )}
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={track.volume}
              onChange={(e) => setTrackVolume(trackId, parseFloat(e.target.value))}
              className="w-16 h-1 accent-purple-500"
              title="Volume"
            />
            <span className="text-xs text-gray-400 w-8">
              {Math.round(track.volume * 100)}
            </span>
          </div>

          {/* Pan */}
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-500">L</span>
            <input
              type="range"
              min="-1"
              max="1"
              step="0.01"
              value={track.pan}
              onChange={(e) => setTrackPan(trackId, parseFloat(e.target.value))}
              className="w-12 h-1 accent-cyan-500"
              title="Pan"
            />
            <span className="text-xs text-gray-500">R</span>
          </div>

          {/* Mute */}
          <button
            onClick={() => toggleMute(trackId)}
            className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
              track.mute
                ? 'bg-red-500/20 text-red-400 border border-red-500/50'
                : 'bg-gray-800 text-gray-400 border border-gray-700 hover:bg-gray-700'
            }`}
            title="Mute"
          >
            M
          </button>

          {/* Solo */}
          <button
            onClick={() => toggleSolo(trackId)}
            className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
              track.solo
                ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/50'
                : 'bg-gray-800 text-gray-400 border border-gray-700 hover:bg-gray-700'
            }`}
            title="Solo"
          >
            S
          </button>

          {/* Delete */}
          <button
            onClick={() => removeTrack(trackId)}
            className="p-1 rounded hover:bg-red-500/20 text-red-400 transition-colors"
            title="Delete track"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Waveform */}
      <div
        id={`waveform-${trackId}`}
        ref={containerRef}
        className="w-full rounded overflow-hidden bg-black/30"
      />
    </div>
  );
}

export default function Timeline() {
  const { tracks, addTrack, zoom } = useStudio();
  const [isDragOver, setIsDragOver] = useState(false);

  // Handle file drag & drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    
    for (const file of files) {
      if (file.type.startsWith('audio/')) {
        const audioUrl = URL.createObjectURL(file);
        const trackName = file.name.replace(/\.[^/.]+$/, '');
        addTrack(trackName, audioUrl);
        console.log(`✅ Dropped track: ${trackName}`);
      } else {
        console.warn(`⚠️ Skipped non-audio file: ${file.name}`);
      }
    }
  };

  return (
    <div 
      className={`flex-1 overflow-auto bg-black/20 backdrop-blur-xl p-4 relative ${
        isDragOver ? 'ring-4 ring-purple-500/50' : ''
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {isDragOver && (
        <div className="absolute inset-0 bg-purple-500/20 backdrop-blur-sm flex items-center justify-center z-50 pointer-events-none">
          <div className="text-center">
            <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center animate-pulse">
              <Upload className="w-12 h-12 text-white" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">Drop audio files here</h3>
            <p className="text-gray-300">Add them as new tracks to your project</p>
          </div>
        </div>
      )}

      {tracks.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full text-center">
          <div className="text-gray-400 mb-4">
            <Volume2 className="w-16 h-16 mx-auto mb-3 opacity-50" />
            <h3 className="text-xl font-semibold mb-2">No tracks yet</h3>
            <p className="text-sm">Drag & drop audio files, generate with AI, or upload from library</p>
          </div>
        </div>
      ) : (
        <div 
          className="space-y-2"
          style={{
            minWidth: `${300 * zoom}px`, // Zoom affects width
          }}
        >
          {tracks.map((track) => (
            <TrackRow key={track.id} trackId={track.id} />
          ))}
        </div>
      )}
    </div>
  );
}
