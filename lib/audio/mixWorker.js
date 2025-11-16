/**
 * Mix Worker - Offline audio mixing and rendering
 * Handles heavy PCM mixing operations without blocking main thread
 * Supports multi-track mixing with gain, pan, mute, and solo
 */

let project = {
  sampleRate: 48000,
  tracks: [], // { clips: [{startSample, length, buffer(Float32Array), channels}], gain, pan, muted, solo }
};

self.onmessage = async (e) => {
  const { type, payload } = e.data;

  if (type === 'init') {
    project.sampleRate = payload.sampleRate || 48000;
    project.tracks = payload.tracks || [];
    self.postMessage({ type: 'inited' });
    return;
  }

  if (type === 'loadClip') {
    // payload: { trackIndex, clipId, buffer, channels, startSample }
    const { trackIndex, clipId, buffer, channels, startSample } = payload;
    
    // Ensure track exists
    if (!project.tracks[trackIndex]) {
      project.tracks[trackIndex] = { 
        clips: [], 
        gain: 1, 
        pan: 0, 
        muted: false, 
        solo: false 
      };
    }
    
    // Add clip to track
    project.tracks[trackIndex].clips.push({ 
      id: clipId, 
      buffer, 
      channels: channels || 1,
      startSample: startSample || 0
    });
    
    self.postMessage({ 
      type: 'clipLoaded', 
      payload: { trackIndex, clipId }
    });
    return;
  }

  if (type === 'updateTrack') {
    // payload: { trackIndex, updates: { gain?, pan?, muted?, solo? } }
    const { trackIndex, updates } = payload;
    if (project.tracks[trackIndex]) {
      Object.assign(project.tracks[trackIndex], updates);
    }
    self.postMessage({ type: 'trackUpdated', payload: { trackIndex } });
    return;
  }

  if (type === 'renderMix') {
    // payload: { startSample?, endSample? }
    const { startSample = 0, endSample } = payload;
    
    // Compute total length needed
    let lastSample = 0;
    project.tracks.forEach(track => {
      if (!track) return;
      track.clips.forEach(clip => {
        const clipLength = clip.buffer.length / (clip.channels || 1);
        const clipEnd = (clip.startSample || 0) + clipLength;
        lastSample = Math.max(lastSample, clipEnd);
      });
    });
    
    const renderEnd = endSample || lastSample;
    const mixLength = renderEnd - startSample;
    
    if (mixLength <= 0) {
      self.postMessage({ 
        type: 'renderDone', 
        payload: { 
          buffer: new Float32Array(0).buffer, 
          sampleRate: project.sampleRate 
        } 
      }, []);
      return;
    }

    // Allocate stereo output buffers
    const outL = new Float32Array(mixLength);
    const outR = new Float32Array(mixLength);

    // Check if any tracks are soloed
    const hasSolo = project.tracks.some(t => t && t.solo);

    // Mix each track
    for (let trackIndex = 0; trackIndex < project.tracks.length; trackIndex++) {
      const track = project.tracks[trackIndex];
      if (!track) continue;
      
      // Skip muted tracks
      if (track.muted) continue;
      
      // Skip non-solo tracks if any solo exists
      if (hasSolo && !track.solo) continue;

      const trackGain = track.gain !== undefined ? track.gain : 1;
      const trackPan = track.pan !== undefined ? track.pan : 0; // -1 (left) to 1 (right)

      // Mix each clip in the track
      for (const clip of (track.clips || [])) {
        const buffer = clip.buffer; // Float32Array (interleaved if stereo)
        const channels = clip.channels || 1;
        const clipStart = clip.startSample || 0;
        const clipLength = buffer.length / channels;

        // Calculate write region
        const writeStart = Math.max(0, clipStart - startSample);
        const readOffset = Math.max(0, startSample - clipStart);
        const writeLength = Math.min(clipLength - readOffset, mixLength - writeStart);
        
        if (writeLength <= 0) continue;

        if (channels === 1) {
          // Mono clip - apply pan
          const leftGain = trackGain * (1 - Math.max(0, trackPan));
          const rightGain = trackGain * (1 + Math.min(0, trackPan));
          
          for (let i = 0; i < writeLength; i++) {
            const sample = buffer[readOffset + i];
            outL[writeStart + i] += sample * leftGain;
            outR[writeStart + i] += sample * rightGain;
          }
        } else {
          // Stereo clip
          for (let i = 0; i < writeLength; i++) {
            const sampleL = buffer[(readOffset + i) * 2];
            const sampleR = buffer[(readOffset + i) * 2 + 1];
            outL[writeStart + i] += sampleL * trackGain;
            outR[writeStart + i] += sampleR * trackGain;
          }
        }
      }
    }

    // Normalization / soft limiting
    let maxPeak = 1e-9;
    for (let i = 0; i < outL.length; i++) {
      maxPeak = Math.max(maxPeak, Math.abs(outL[i]), Math.abs(outR[i]));
    }
    
    if (maxPeak > 1.0) {
      const normFactor = 1.0 / maxPeak;
      for (let i = 0; i < outL.length; i++) {
        outL[i] *= normFactor;
        outR[i] *= normFactor;
      }
    }

    // Interleave stereo output
    const interleaved = new Float32Array(mixLength * 2);
    for (let i = 0; i < mixLength; i++) {
      interleaved[i * 2] = outL[i];
      interleaved[i * 2 + 1] = outR[i];
    }

    // Transfer buffer back to main thread
    self.postMessage({ 
      type: 'renderDone', 
      payload: { 
        buffer: interleaved.buffer, 
        sampleRate: project.sampleRate,
        length: mixLength
      }
    }, [interleaved.buffer]);
    return;
  }

  if (type === 'clear') {
    project.tracks = [];
    self.postMessage({ type: 'cleared' });
    return;
  }
};
