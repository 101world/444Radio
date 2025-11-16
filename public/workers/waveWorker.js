/**
 * waveWorker.js
 * Worker receives PCM Float32Array blocks and produces downsampled peaks for ranges.
 */

let audioBuffer = null; // Float32Array mono interleaved

self.onmessage = (e) => {
  const { type, payload } = e.data;

  if (type === 'loadSamples') {
    // payload: Float32Array
    audioBuffer = payload;
    self.postMessage({ type: 'loaded', length: audioBuffer.length });
  } else if (type === 'getPeaks') {
    // payload: { startSample, endSample, pixelWidth }
    if (!audioBuffer) {
      self.postMessage({ type: 'peaks', payload: { peaks: null } });
      return;
    }

    const { startSample, endSample, pixelWidth } = payload;
    const chunkLen = Math.max(1, Math.floor((endSample - startSample) / pixelWidth));
    const peaks = new Float32Array(pixelWidth);
    let outIdx = 0;

    for (let s = startSample; s < endSample && outIdx < pixelWidth; s += chunkLen) {
      let max = 0;
      const end = Math.min(endSample, s + chunkLen);
      for (let i = s; i < end; i++) {
        const v = audioBuffer[i];
        if (Math.abs(v) > max) max = Math.abs(v);
      }
      peaks[outIdx++] = max;
    }

    // Send peaks back as transferable buffer
    self.postMessage(
      { type: 'peaks', payload: { peaks: peaks.buffer } },
      [peaks.buffer]
    );
  }
};
