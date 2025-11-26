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
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch ' + url);
    const ab = await res.arrayBuffer();
    const decoded = await ctx.decodeAudioData(ab);
    bufferCache.set(url, decoded);
    return decoded;
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
  return { loadBuffer, play, pause, stop, seek, getPlayhead, setPlayheadPositionManual, getAudioContext, isPlaying: () => isPlaying };
}
