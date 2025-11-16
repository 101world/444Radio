/**
 * renderWaveform.js
 * Render only the visible window of audio waveform onto a canvas.
 * Usage: call initWaveform(canvas, {onRequestChunk, devicePixelRatio})
 */

export interface WaveformChunkRequest {
  startSample: number;
  endSample: number;
  pixelWidth: number;
}

export interface WaveformDrawParams {
  startSample: number;
  endSample: number;
  sampleToPxRatio: number;
}

export interface WaveformInstance {
  resize: () => void;
  drawVisible: (params: WaveformDrawParams) => Promise<void>;
}

export function initWaveform(
  canvas: HTMLCanvasElement,
  {
    onRequestChunk,
    devicePixelRatio = window.devicePixelRatio || 1
  }: {
    onRequestChunk: (request: WaveformChunkRequest) => Promise<Float32Array>;
    devicePixelRatio?: number;
  }
): WaveformInstance {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to get canvas 2d context');

  let containerWidth = canvas.clientWidth;
  let containerHeight = canvas.clientHeight;
  let dpr = Math.min(devicePixelRatio, 2); // Cap at 2x for performance

  function resize() {
    containerWidth = canvas.clientWidth;
    containerHeight = canvas.clientHeight;
    canvas.style.width = containerWidth + 'px';
    canvas.style.height = containerHeight + 'px';
    canvas.width = Math.max(1, Math.floor(containerWidth * dpr));
    canvas.height = Math.max(1, Math.floor(containerHeight * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawEmpty();
  }

  function drawEmpty() {
    ctx.clearRect(0, 0, canvas.width, dpr ? canvas.height / dpr : canvas.height);
    ctx.fillStyle = '#081016';
    ctx.fillRect(0, 0, containerWidth, containerHeight);
  }

  // Draw a chunk of peaks onto the canvas
  function drawChunk(chunkPeaks: Float32Array, offsetPx: number, color = '#2BD4F6') {
    const w = chunkPeaks.length;
    const h = containerHeight;
    ctx.save();
    ctx.translate(offsetPx, 0);
    ctx.fillStyle = color;

    for (let x = 0; x < w; x++) {
      const p = Math.max(-1, Math.min(1, chunkPeaks[x]));
      const half = h / 2;
      const lineH = Math.max(1, Math.abs(p) * half);
      ctx.fillRect(x, half - lineH, 1, lineH * 2);
    }

    ctx.restore();
  }

  // Main draw call: request visible range in samples from provider
  async function drawVisible({ startSample, endSample, sampleToPxRatio }: WaveformDrawParams) {
    const pixelWidth = Math.ceil((endSample - startSample) / sampleToPxRatio);
    if (pixelWidth <= 0) {
      drawEmpty();
      return;
    }

    drawEmpty();

    try {
      const chunkPeaks = await onRequestChunk({ startSample, endSample, pixelWidth });
      drawChunk(chunkPeaks, 0);
    } catch (error) {
      console.error('Failed to draw waveform:', error);
      drawEmpty();
    }
  }

  // Initialize
  resize();

  return { resize, drawVisible };
}
