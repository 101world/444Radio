/**
 * AudioExporter - Export mixed audio to WAV/MP3
 * Handles offline audio rendering and encoding
 */

export interface ExportOptions {
  format: 'wav' | 'mp3';
  sampleRate: 44100 | 48000 | 96000;
  bitDepth?: 16 | 24 | 32;
  quality?: 'low' | 'medium' | 'high' | 'extreme'; // For MP3
}

export class AudioExporter {
  /**
   * Export audio buffer to downloadable file
   */
  async exportAudio(
    audioBuffer: AudioBuffer,
    options: ExportOptions,
    filename: string
  ): Promise<{ success: boolean; blob?: Blob; error?: string }> {
    try {
      console.log('[AudioExporter] Starting export:', { filename, format: options.format });

      let blob: Blob;

      if (options.format === 'wav') {
        blob = this.encodeWAV(audioBuffer, options.bitDepth || 16);
      } else {
        // MP3 encoding would require lamejs or similar library
        // For now, fallback to WAV
        console.warn('[AudioExporter] MP3 encoding not yet implemented, using WAV');
        blob = this.encodeWAV(audioBuffer, 16);
      }

      console.log('[AudioExporter] Export complete:', blob.size, 'bytes');
      return { success: true, blob };
    } catch (error: any) {
      console.error('[AudioExporter] Export failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Encode AudioBuffer to WAV format
   */
  private encodeWAV(audioBuffer: AudioBuffer, bitDepth: 16 | 24 | 32): Blob {
    const numberOfChannels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const format = 1; // PCM
    const bitDepthBytes = bitDepth / 8;

    // Interleave channels
    const interleaved = this.interleaveChannels(audioBuffer);

    // Create WAV file buffer
    const buffer = new ArrayBuffer(44 + interleaved.length * bitDepthBytes);
    const view = new DataView(buffer);

    // Write WAV header
    this.writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + interleaved.length * bitDepthBytes, true);
    this.writeString(view, 8, 'WAVE');
    this.writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true); // fmt chunk size
    view.setUint16(20, format, true);
    view.setUint16(22, numberOfChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numberOfChannels * bitDepthBytes, true); // byte rate
    view.setUint16(32, numberOfChannels * bitDepthBytes, true); // block align
    view.setUint16(34, bitDepth, true);
    this.writeString(view, 36, 'data');
    view.setUint32(40, interleaved.length * bitDepthBytes, true);

    // Write audio data
    if (bitDepth === 16) {
      this.floatTo16BitPCM(view, 44, interleaved);
    } else if (bitDepth === 24) {
      this.floatTo24BitPCM(view, 44, interleaved);
    } else {
      this.floatTo32BitPCM(view, 44, interleaved);
    }

    return new Blob([buffer], { type: 'audio/wav' });
  }

  /**
   * Interleave multiple channels into single array
   */
  private interleaveChannels(audioBuffer: AudioBuffer): Float32Array {
    const numberOfChannels = audioBuffer.numberOfChannels;
    const length = audioBuffer.length * numberOfChannels;
    const result = new Float32Array(length);

    for (let channel = 0; channel < numberOfChannels; channel++) {
      const channelData = audioBuffer.getChannelData(channel);
      for (let i = 0; i < audioBuffer.length; i++) {
        result[i * numberOfChannels + channel] = channelData[i];
      }
    }

    return result;
  }

  /**
   * Convert float samples to 16-bit PCM
   */
  private floatTo16BitPCM(view: DataView, offset: number, input: Float32Array): void {
    for (let i = 0; i < input.length; i++, offset += 2) {
      const s = Math.max(-1, Math.min(1, input[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }
  }

  /**
   * Convert float samples to 24-bit PCM
   */
  private floatTo24BitPCM(view: DataView, offset: number, input: Float32Array): void {
    for (let i = 0; i < input.length; i++, offset += 3) {
      const s = Math.max(-1, Math.min(1, input[i]));
      const val = s < 0 ? s * 0x800000 : s * 0x7FFFFF;
      view.setUint8(offset, val & 0xff);
      view.setUint8(offset + 1, (val >> 8) & 0xff);
      view.setUint8(offset + 2, (val >> 16) & 0xff);
    }
  }

  /**
   * Convert float samples to 32-bit PCM
   */
  private floatTo32BitPCM(view: DataView, offset: number, input: Float32Array): void {
    for (let i = 0; i < input.length; i++, offset += 4) {
      view.setFloat32(offset, input[i], true);
    }
  }

  /**
   * Write string to DataView
   */
  private writeString(view: DataView, offset: number, string: string): void {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  /**
   * Trigger download of blob
   */
  downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  }
}
