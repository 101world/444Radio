/**
 * Simple Waveform Visualization for Audio Clips
 * Renders audio waveforms on canvas using Web Audio API
 */

export interface WaveformOptions {
  width: number
  height: number
  waveColor: string
  backgroundColor: string
  samples?: number // Number of samples to visualize (default: 1000)
}

/**
 * Render waveform from audio buffer to canvas
 * Uses AnalyserNode or pre-computed buffer data
 */
export async function renderWaveform(
  audioUrl: string,
  canvas: HTMLCanvasElement,
  options: Partial<WaveformOptions> = {}
): Promise<void> {
  const {
    width = canvas.width || 800,
    height = canvas.height || 60,
    waveColor = '#4a90e2',
    backgroundColor = 'transparent',
    samples = 1000
  } = options

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Cannot get canvas context')
  }

  // Set canvas size
  canvas.width = width
  canvas.height = height

  // Clear canvas
  ctx.fillStyle = backgroundColor
  ctx.fillRect(0, 0, width, height)

  try {
    // Fetch and decode audio
    const response = await fetch(audioUrl)
    if (!response.ok) {
      throw new Error(`Failed to fetch audio: ${response.status}`)
    }

    const arrayBuffer = await response.arrayBuffer()
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)

    // Get audio data (use first channel)
    const channelData = audioBuffer.getChannelData(0)
    const step = Math.ceil(channelData.length / samples)
    const amplitude = height / 2
    
    // Downsample audio data
    const waveformData: number[] = []
    for (let i = 0; i < samples; i++) {
      const start = i * step
      const end = Math.min(start + step, channelData.length)
      
      // Get RMS (root mean square) for this segment
      let sum = 0
      for (let j = start; j < end; j++) {
        sum += channelData[j] * channelData[j]
      }
      const rms = Math.sqrt(sum / (end - start))
      waveformData.push(rms)
    }

    // Normalize waveform data
    const max = Math.max(...waveformData)
    const normalized = waveformData.map(v => v / max)

    // Draw waveform
    ctx.fillStyle = waveColor
    const barWidth = width / samples
    
    for (let i = 0; i < normalized.length; i++) {
      const x = i * barWidth
      const barHeight = normalized[i] * amplitude
      const y = amplitude - barHeight / 2
      
      ctx.fillRect(x, y, barWidth - 1, barHeight)
    }

    // Clean up
    audioContext.close()

  } catch (error) {
    console.error('Waveform rendering error:', error)
    
    // Draw error state
    ctx.fillStyle = '#666'
    ctx.fillRect(0, height / 2 - 1, width, 2)
    ctx.fillStyle = '#999'
    ctx.font = '12px monospace'
    ctx.fillText('Waveform unavailable', 10, height / 2 - 10)
  }
}

/**
 * Create a cached waveform renderer
 * Stores rendered waveforms in a Map to avoid re-rendering
 */
export class WaveformCache {
  private cache = new Map<string, ImageBitmap>()

  async getWaveform(
    audioUrl: string,
    width: number,
    height: number,
    options: Partial<WaveformOptions> = {}
  ): Promise<ImageBitmap | null> {
    const cacheKey = `${audioUrl}-${width}x${height}`
    
    // Check cache first
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!
    }

    try {
      // Create offscreen canvas
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height

      // Render waveform
      await renderWaveform(audioUrl, canvas, { ...options, width, height })

      // Create bitmap for fast drawing
      const bitmap = await createImageBitmap(canvas)
      this.cache.set(cacheKey, bitmap)
      
      return bitmap
    } catch (error) {
      console.error('Failed to cache waveform:', error)
      return null
    }
  }

  clear() {
    this.cache.clear()
  }

  remove(audioUrl: string) {
    const keysToDelete: string[] = []
    for (const key of this.cache.keys()) {
      if (key.startsWith(audioUrl)) {
        keysToDelete.push(key)
      }
    }
    keysToDelete.forEach(key => this.cache.delete(key))
  }
}

// Export singleton instance
export const waveformCache = new WaveformCache()
