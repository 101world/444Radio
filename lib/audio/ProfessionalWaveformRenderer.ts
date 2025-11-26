/**
 * Professional Waveform Renderer with Level-of-Detail (LOD)
 * Features: Peak/RMS display, frequency visualization, zoom levels
 */

export interface WaveformConfig {
  width: number;
  height: number;
  backgroundColor?: string;
  waveColor?: string;
  progressColor?: string;
  showRMS?: boolean;
  showPeaks?: boolean;
}

export class ProfessionalWaveformRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private config: Required<WaveformConfig>;
  private peakData: Float32Array | null = null;
  private rmsData: Float32Array | null = null;

  constructor(canvas: HTMLCanvasElement, config: WaveformConfig) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.config = {
      backgroundColor: '#0a0a0a',
      waveColor: '#00bcd4',
      progressColor: '#00bcd4aa',
      showRMS: true,
      showPeaks: true,
      ...config
    };
  }

  /**
   * Generate LOD waveform data with configurable resolution
   */
  generateWaveformData(audioBuffer: AudioBuffer, samplesPerPixel: number = 512) {
    const channelData = audioBuffer.getChannelData(0);
    const numPixels = Math.ceil(channelData.length / samplesPerPixel);
    
    this.peakData = new Float32Array(numPixels);
    this.rmsData = new Float32Array(numPixels);

    for (let i = 0; i < numPixels; i++) {
      const start = i * samplesPerPixel;
      const end = Math.min(start + samplesPerPixel, channelData.length);
      
      let peak = 0;
      let sumSquares = 0;
      let count = 0;

      for (let j = start; j < end; j++) {
        const sample = Math.abs(channelData[j]);
        peak = Math.max(peak, sample);
        sumSquares += sample * sample;
        count++;
      }

      this.peakData[i] = peak;
      this.rmsData[i] = Math.sqrt(sumSquares / count);
    }
  }

  /**
   * Render waveform with current viewport
   */
  render(startX: number = 0, endX?: number, progress?: number) {
    if (!this.peakData) return;

    const { width, height, backgroundColor, waveColor, progressColor } = this.config;
    const actualEndX = endX || width;

    // Clear canvas
    this.ctx.fillStyle = backgroundColor;
    this.ctx.fillRect(0, 0, width, height);

    const centerY = height / 2;
    const scale = height / 2;

    // Draw RMS (filled area)
    if (this.config.showRMS && this.rmsData) {
      this.ctx.fillStyle = waveColor + '33'; // 20% opacity
      this.ctx.beginPath();
      this.ctx.moveTo(startX, centerY);

      for (let x = startX; x < actualEndX; x++) {
        const dataIndex = Math.floor((x / width) * this.rmsData.length);
        const rms = this.rmsData[dataIndex] || 0;
        this.ctx.lineTo(x, centerY - rms * scale);
      }

      for (let x = actualEndX - 1; x >= startX; x--) {
        const dataIndex = Math.floor((x / width) * this.rmsData.length);
        const rms = this.rmsData[dataIndex] || 0;
        this.ctx.lineTo(x, centerY + rms * scale);
      }

      this.ctx.closePath();
      this.ctx.fill();
    }

    // Draw peaks (waveform line)
    if (this.config.showPeaks) {
      this.ctx.strokeStyle = waveColor;
      this.ctx.lineWidth = 1;
      this.ctx.beginPath();

      for (let x = startX; x < actualEndX; x++) {
        const dataIndex = Math.floor((x / width) * this.peakData.length);
        const peak = this.peakData[dataIndex] || 0;
        
        if (x === startX) {
          this.ctx.moveTo(x, centerY - peak * scale);
        } else {
          this.ctx.lineTo(x, centerY - peak * scale);
        }
      }

      for (let x = actualEndX - 1; x >= startX; x--) {
        const dataIndex = Math.floor((x / width) * this.peakData.length);
        const peak = this.peakData[dataIndex] || 0;
        this.ctx.lineTo(x, centerY + peak * scale);
      }

      this.ctx.closePath();
      this.ctx.stroke();
    }

    // Draw progress overlay
    if (progress !== undefined && progress > 0) {
      const progressWidth = width * progress;
      this.ctx.fillStyle = progressColor;
      this.ctx.fillRect(0, 0, progressWidth, height);
    }
  }

  /**
   * Render minimap overview (smaller resolution)
   */
  renderMinimap(audioBuffer: AudioBuffer, minimapCanvas: HTMLCanvasElement) {
    const ctx = minimapCanvas.getContext('2d')!;
    const width = minimapCanvas.width;
    const height = minimapCanvas.height;
    
    const channelData = audioBuffer.getChannelData(0);
    const samplesPerPixel = Math.ceil(channelData.length / width);
    
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, width, height);
    
    ctx.strokeStyle = '#00bcd4';
    ctx.lineWidth = 1;
    ctx.beginPath();
    
    const centerY = height / 2;
    const scale = height / 2;
    
    for (let x = 0; x < width; x++) {
      const start = x * samplesPerPixel;
      const end = Math.min(start + samplesPerPixel, channelData.length);
      
      let peak = 0;
      for (let i = start; i < end; i++) {
        peak = Math.max(peak, Math.abs(channelData[i]));
      }
      
      ctx.moveTo(x, centerY - peak * scale);
      ctx.lineTo(x, centerY + peak * scale);
    }
    
    ctx.stroke();
  }

  /**
   * Get waveform statistics
   */
  getStatistics(): { peak: number; rms: number; crestFactor: number } {
    if (!this.peakData || !this.rmsData) {
      return { peak: 0, rms: 0, crestFactor: 0 };
    }

    const peak = Math.max(...Array.from(this.peakData));
    const avgRms = Array.from(this.rmsData).reduce((a, b) => a + b, 0) / this.rmsData.length;
    const crestFactor = peak / avgRms;

    return { peak, rms: avgRms, crestFactor };
  }

  /**
   * Frequency-colored waveform (experimental)
   */
  renderFrequencyColored(audioBuffer: AudioBuffer, fftSize: number = 2048) {
    // TODO: Implement FFT-based frequency visualization
    // This would require analyzing frequency content and coloring waveform accordingly
  }
}
