/**
 * Export & Mixdown System - Render projects to downloadable audio files
 * Uses mixWorker for offline rendering and converts to WAV format
 * Supports full project export and partial region rendering
 */

/**
 * Convert Float32Array stereo buffer to WAV file
 * @param audioBuffer - Interleaved stereo Float32Array
 * @param sampleRate - Sample rate in Hz
 * @returns WAV file as Blob
 */
export function float32ToWav(audioBuffer: Float32Array, sampleRate: number): Blob {
  const numChannels = 2; // Stereo
  const numSamples = audioBuffer.length / numChannels;
  const bytesPerSample = 2; // 16-bit PCM
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = numSamples * blockAlign;
  const headerSize = 44;
  
  // Create buffer for WAV file
  const buffer = new ArrayBuffer(headerSize + dataSize);
  const view = new DataView(buffer);
  
  // Write WAV header
  let offset = 0;
  
  // "RIFF" chunk descriptor
  writeString(view, offset, 'RIFF'); offset += 4;
  view.setUint32(offset, 36 + dataSize, true); offset += 4; // File size - 8
  writeString(view, offset, 'WAVE'); offset += 4;
  
  // "fmt " sub-chunk
  writeString(view, offset, 'fmt '); offset += 4;
  view.setUint32(offset, 16, true); offset += 4; // Subchunk1Size (16 for PCM)
  view.setUint16(offset, 1, true); offset += 2; // AudioFormat (1 = PCM)
  view.setUint16(offset, numChannels, true); offset += 2; // NumChannels
  view.setUint32(offset, sampleRate, true); offset += 4; // SampleRate
  view.setUint32(offset, byteRate, true); offset += 4; // ByteRate
  view.setUint16(offset, blockAlign, true); offset += 2; // BlockAlign
  view.setUint16(offset, bytesPerSample * 8, true); offset += 2; // BitsPerSample
  
  // "data" sub-chunk
  writeString(view, offset, 'data'); offset += 4;
  view.setUint32(offset, dataSize, true); offset += 4;
  
  // Write audio data (convert float32 to int16)
  for (let i = 0; i < audioBuffer.length; i++) {
    const sample = Math.max(-1, Math.min(1, audioBuffer[i])); // Clamp
    const int16 = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
    view.setInt16(offset, int16, true);
    offset += 2;
  }
  
  return new Blob([buffer], { type: 'audio/wav' });
}

/**
 * Helper: Write ASCII string to DataView
 */
function writeString(view: DataView, offset: number, string: string): void {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

/**
 * Export project to WAV file using mixWorker
 * @param tracks - Array of track data with clips
 * @param sampleRate - Project sample rate
 * @param startTime - Start time in seconds (optional)
 * @param endTime - End time in seconds (optional)
 * @returns Promise resolving to WAV Blob
 */
export async function exportProjectToWav(
  tracks: any[],
  sampleRate: number = 48000,
  startTime?: number,
  endTime?: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    // Create worker
    const worker = new Worker(new URL('../audio/mixWorker.js', import.meta.url));
    
    let tracksLoaded = 0;
    const totalTracks = tracks.length;
    
    worker.onmessage = (e) => {
      const { type, payload } = e.data;
      
      if (type === 'inited') {
        console.log('🎚️ Mix worker initialized');
        
        // Load all clips into worker
        tracks.forEach((track, trackIndex) => {
          // Update track settings
          worker.postMessage({
            type: 'updateTrack',
            payload: {
              trackIndex,
              updates: {
                gain: track.volume || 1,
                pan: track.pan || 0,
                muted: track.mute || false,
                solo: track.solo || false
              }
            }
          });
          
          // Load clips
          track.clips?.forEach((clip: any) => {
            if (clip.buffer && clip.buffer instanceof Float32Array) {
              const startSample = Math.floor((clip.startTime || 0) * sampleRate);
              
              worker.postMessage({
                type: 'loadClip',
                payload: {
                  trackIndex,
                  clipId: clip.id,
                  buffer: clip.buffer,
                  channels: clip.channels || 1,
                  startSample
                }
              }, [clip.buffer.buffer]); // Transfer buffer
            }
          });
        });
        
        // Request render after all tracks loaded
        setTimeout(() => {
          const startSample = startTime ? Math.floor(startTime * sampleRate) : undefined;
          const endSample = endTime ? Math.floor(endTime * sampleRate) : undefined;
          
          console.log('🎬 Starting render...');
          worker.postMessage({
            type: 'renderMix',
            payload: { startSample, endSample }
          });
        }, 100);
      }
      
      if (type === 'clipLoaded') {
        tracksLoaded++;
        console.log(`📦 Clip loaded (${tracksLoaded} total)`);
      }
      
      if (type === 'renderDone') {
        console.log('✅ Render complete');
        
        // Convert to Float32Array
        const mixedBuffer = new Float32Array(payload.buffer);
        
        // Convert to WAV
        const wavBlob = float32ToWav(mixedBuffer, payload.sampleRate);
        
        worker.terminate();
        resolve(wavBlob);
      }
    };
    
    worker.onerror = (error) => {
      console.error('❌ Mix worker error:', error);
      worker.terminate();
      reject(error);
    };
    
    // Initialize worker
    worker.postMessage({
      type: 'init',
      payload: {
        sampleRate,
        tracks: new Array(totalTracks).fill(null).map(() => ({
          clips: [],
          gain: 1,
          pan: 0,
          muted: false,
          solo: false
        }))
      }
    });
  });
}

/**
 * Download blob as file
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Export project and trigger download
 */
export async function exportAndDownload(
  tracks: any[],
  projectName: string = 'mix',
  sampleRate: number = 48000,
  startTime?: number,
  endTime?: number
): Promise<void> {
  try {
    console.log('🎵 Exporting project:', projectName);
    
    const wavBlob = await exportProjectToWav(tracks, sampleRate, startTime, endTime);
    
    const filename = `${projectName}-${Date.now()}.wav`;
    downloadBlob(wavBlob, filename);
    
    console.log('✅ Export complete:', filename);
  } catch (error) {
    console.error('❌ Export failed:', error);
    throw error;
  }
}

/**
 * Calculate export duration
 */
export function calculateExportDuration(tracks: any[]): number {
  let maxDuration = 0;
  
  tracks.forEach(track => {
    track.clips?.forEach((clip: any) => {
      const clipEnd = (clip.startTime || 0) + (clip.duration || 0);
      maxDuration = Math.max(maxDuration, clipEnd);
    });
  });
  
  return maxDuration;
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

/**
 * Estimate export file size
 */
export function estimateExportSize(
  durationSeconds: number,
  sampleRate: number = 48000,
  channels: number = 2,
  bitsPerSample: number = 16
): number {
  const bytesPerSample = bitsPerSample / 8;
  const dataSize = durationSeconds * sampleRate * channels * bytesPerSample;
  const headerSize = 44; // WAV header
  return dataSize + headerSize;
}
