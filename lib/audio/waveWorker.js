/**
 * Waveform Worker - Peak computation for visualization
 * Computes downsampled peak data for efficient waveform rendering
 * Handles large audio buffers without blocking UI
 */

self.onmessage = (e) => {
  const { type, payload } = e.data;

  if (type === 'computePeaks') {
    const { buffer, channels, sampleRate, samplesPerPixel, windowStart, windowEnd } = payload;
    
    // Validate inputs
    if (!buffer || buffer.length === 0) {
      self.postMessage({ 
        type: 'peaksComputed', 
        payload: { peaks: new Float32Array(0), error: 'Empty buffer' }
      });
      return;
    }

    const numChannels = channels || 1;
    const totalSamples = buffer.length / numChannels;
    
    // Calculate window bounds (in samples)
    const startSample = windowStart ? Math.floor(windowStart * sampleRate) : 0;
    const endSample = windowEnd ? Math.floor(windowEnd * sampleRate) : totalSamples;
    const windowSamples = endSample - startSample;
    
    if (windowSamples <= 0) {
      self.postMessage({ 
        type: 'peaksComputed', 
        payload: { peaks: new Float32Array(0) }
      });
      return;
    }

    // Calculate number of pixels needed
    const samplesPerPx = samplesPerPixel || Math.max(1, Math.floor(windowSamples / 1000));
    const numPixels = Math.ceil(windowSamples / samplesPerPx);
    
    // Allocate peak arrays (min, max for each channel)
    const peaks = new Float32Array(numPixels * 2 * numChannels);
    
    // Compute peaks for each pixel
    for (let px = 0; px < numPixels; px++) {
      const sampleStart = startSample + (px * samplesPerPx);
      const sampleEnd = Math.min(endSample, sampleStart + samplesPerPx);
      
      for (let ch = 0; ch < numChannels; ch++) {
        let min = 1;
        let max = -1;
        
        // Find min/max in this pixel's sample range
        for (let i = sampleStart; i < sampleEnd; i++) {
          const sampleIndex = numChannels === 1 ? i : (i * numChannels + ch);
          const sample = buffer[sampleIndex];
          
          if (sample < min) min = sample;
          if (sample > max) max = sample;
        }
        
        // Store min/max for this channel and pixel
        const peakIndex = (px * numChannels + ch) * 2;
        peaks[peakIndex] = min;
        peaks[peakIndex + 1] = max;
      }
    }

    // Send back (transfer buffer for efficiency)
    self.postMessage({ 
      type: 'peaksComputed', 
      payload: { 
        peaks: peaks.buffer,
        numPixels,
        numChannels,
        samplesPerPixel: samplesPerPx
      }
    }, [peaks.buffer]);
  }

  if (type === 'computeRMS') {
    // Compute RMS energy envelope for onset detection
    const { buffer, channels, sampleRate, windowMs } = payload;
    
    const numChannels = channels || 1;
    const totalSamples = buffer.length / numChannels;
    const windowSize = Math.floor(sampleRate * (windowMs || 10) / 1000);
    const numWindows = Math.floor(totalSamples / windowSize);
    
    const rmsData = new Float32Array(numWindows);
    
    for (let w = 0; w < numWindows; w++) {
      const start = w * windowSize;
      const end = Math.min(totalSamples, start + windowSize);
      let sumSquares = 0;
      let count = 0;
      
      for (let i = start; i < end; i++) {
        for (let ch = 0; ch < numChannels; ch++) {
          const sampleIndex = numChannels === 1 ? i : (i * numChannels + ch);
          const sample = buffer[sampleIndex];
          sumSquares += sample * sample;
          count++;
        }
      }
      
      rmsData[w] = Math.sqrt(sumSquares / Math.max(1, count));
    }
    
    self.postMessage({ 
      type: 'rmsComputed', 
      payload: { 
        rms: rmsData.buffer,
        windowSize,
        numWindows
      }
    }, [rmsData.buffer]);
  }
};
