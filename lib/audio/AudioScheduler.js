// Audio Scheduler for sample-accurate multi-track playback
export default function createAudioScheduler() {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const bufferCache = new Map();
  let sources = [];
  let isPlaying = false;
  let playStartTime = 0;
  let playheadAtStart = 0;

  async function loadBuffer(url) {
    if (bufferCache.has(url)) return bufferCache.get(url);
    
    // Support Range requests for large files (>5MB)
    const headRes = await fetch(url, { method: 'HEAD' });
    const contentLength = parseInt(headRes.headers.get('Content-Length') || '0', 10);
    const supportsRanges = headRes.headers.get('Accept-Ranges') === 'bytes';
    
    let ab;
    if (supportsRanges && contentLength > 5 * 1024 * 1024) {
      // Fetch in chunks for large files
      console.log(`📦 Loading large audio file (${Math.round(contentLength / 1024 / 1024)}MB) with Range requests`);
      const chunks = [];
      const chunkSize = 1024 * 1024; // 1MB chunks
      
      for (let offset = 0; offset < contentLength; offset += chunkSize) {
        const end = Math.min(offset + chunkSize - 1, contentLength - 1);
        const res = await fetch(url, {
          headers: { 'Range': `bytes=${offset}-${end}` }
        });
        const chunk = await res.arrayBuffer();
        chunks.push(chunk);
      }
      
      // Combine chunks
      const totalLength = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
      ab = new ArrayBuffer(totalLength);
      const combined = new Uint8Array(ab);
      let position = 0;
      for (const chunk of chunks) {
        combined.set(new Uint8Array(chunk), position);
        position += chunk.byteLength;
      }
    } else {
      // Standard fetch for small files or non-Range servers
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch ' + url);
      ab = await res.arrayBuffer();
    }
    
    const decoded = await ctx.decodeAudioData(ab);
    bufferCache.set(url, decoded);
    
    // Prefetch adjacent normalized blocks (Phase C optimization)
    if (supportsRanges) {
      prefetchAdjacentBlocks(url, 0, contentLength);
    }
    
    return decoded;
  }
  
  // Prefetch adjacent 64KB blocks for snappier seeks
  function prefetchAdjacentBlocks(url, currentPosition, fileSize) {
    const BLOCK_SIZE = 64 * 1024;
    const blockIndex = Math.floor(currentPosition / BLOCK_SIZE);
    
    // Prefetch 2 blocks ahead
    for (let i = 1; i <= 2; i++) {
      const prefetchStart = (blockIndex + i) * BLOCK_SIZE;
      if (prefetchStart >= fileSize) break;
      
      const prefetchEnd = Math.min(prefetchStart + BLOCK_SIZE - 1, fileSize - 1);
      
      // Fire-and-forget prefetch
      fetch(url, {
        headers: { 'Range': `bytes=${prefetchStart}-${prefetchEnd}` }
      }).catch(() => {}); // Ignore errors
    }
  }

  function now() { return ctx.currentTime; }

  function getPlayhead() {
    if (!isPlaying) return playheadAtStart;
    return playheadAtStart + (now() - playStartTime);
  }

  async function scheduleClips(clips = []) {
    stopAllSources();
    const currentPlayhead = getPlayhead();
    sources = [];
    for (const clip of clips) {
      try {
        const buf = await loadBuffer(clip.url);
        const clipStart = clip.start || 0;
        const clipDuration = (clip.duration && clip.duration > 0) ? clip.duration : buf.duration;
        const clipEnd = clipStart + clipDuration;
        if (clipEnd <= currentPlayhead) continue;
        const startTimeOffset = Math.max(0, clipStart - currentPlayhead);
        const absStart = now() + Math.max(0, startTimeOffset);
        const src = ctx.createBufferSource();
        src.buffer = buf;
        const gain = ctx.createGain();
        src.connect(gain).connect(ctx.destination);
        let bufferOffset = 0;
        if (currentPlayhead > clipStart) bufferOffset = currentPlayhead - clipStart;
        if (bufferOffset >= buf.duration) continue;
        const playLength = Math.min(buf.duration - bufferOffset, clipDuration - (currentPlayhead - clipStart > 0 ? currentPlayhead - clipStart : 0));
        src.start(absStart, bufferOffset, playLength);
        sources.push({ src, gain, absStart, bufferOffset, playLength });
      } catch (err) {
        console.warn('Failed to schedule clip', clip, err);
      }
    }
  }

  function stopAllSources() {
    for (const s of sources) {
      try { s.src.stop(); } catch (e) {}
    }
    sources = [];
  }

  async function play(clips = []) {
    if (ctx.state === 'suspended') await ctx.resume();
    if (isPlaying) return;
    isPlaying = true;
    playStartTime = now();
    await scheduleClips(clips);
  }

  function pause() {
    if (!isPlaying) return;
    stopAllSources();
    playheadAtStart = getPlayhead();
    isPlaying = false;
  }

  function stop() {
    stopAllSources();
    isPlaying = false;
    playheadAtStart = 0;
  }

  function seek(seconds, clips = []) {
    playheadAtStart = Math.max(0, seconds);
    if (isPlaying) {
      playStartTime = now();
      scheduleClips(clips);
    }
  }

  function setPlayheadPositionManual(seconds) { playheadAtStart = Math.max(0, seconds); }
  function getAudioContext() { return ctx; }

  async function renderToWav(clips = []) {
    // Create offline context for rendering
    const sampleRate = 44100;
    const duration = Math.max(...clips.map(c => (c.start || 0) + (c.duration || 0)), 0) + 1; // Add 1 second padding
    const offlineCtx = new OfflineAudioContext(2, sampleRate * duration, sampleRate);

    // Load all buffers
    const bufferPromises = clips.map(async (clip) => {
      const buf = await loadBuffer(clip.url);
      return { clip, buffer: buf };
    });
    const loadedClips = await Promise.all(bufferPromises);

    // Schedule clips in offline context
    for (const { clip, buffer } of loadedClips) {
      const src = offlineCtx.createBufferSource();
      src.buffer = buffer;
      const gain = offlineCtx.createGain();
      src.connect(gain).connect(offlineCtx.destination);
      
      const clipStart = clip.start || 0;
      const clipDuration = clip.duration && clip.duration > 0 ? clip.duration : buffer.duration;
      
      src.start(clipStart, 0, clipDuration);
    }

    // Render
    const renderedBuffer = await offlineCtx.startRendering();
    
    // Convert to WAV
    const wavBlob = audioBufferToWav(renderedBuffer);
    return wavBlob;
  }

  // Helper function to convert AudioBuffer to WAV Blob
  function audioBufferToWav(buffer) {
    const length = buffer.length;
    const numberOfChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const bytesPerSample = 2;
    const blockAlign = numberOfChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = length * blockAlign;
    const bufferSize = 44 + dataSize;
    
    const arrayBuffer = new ArrayBuffer(bufferSize);
    const view = new DataView(arrayBuffer);
    
    // WAV header
    const writeString = (offset, string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };
    
    writeString(0, 'RIFF');
    view.setUint32(4, bufferSize - 8, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numberOfChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, dataSize, true);
    
    // Convert float samples to 16-bit PCM
    let offset = 44;
    for (let i = 0; i < length; i++) {
      for (let channel = 0; channel < numberOfChannels; channel++) {
        const sample = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[i]));
        view.setInt16(offset, sample * 0x7FFF, true);
        offset += 2;
      }
    }
    
    return new Blob([arrayBuffer], { type: 'audio/wav' });
  }

  return { loadBuffer, play, pause, stop, seek, getPlayhead, setPlayheadPositionManual, getAudioContext, isPlaying: () => isPlaying, renderToWav };
}
