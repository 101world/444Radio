export interface MixdownClip {
  id: string
  trackId: string
  audioUrl: string
  name: string
  startTime: number
  duration: number
  offset: number
  color: string
}

export interface MixdownTrack {
  id: string
  name: string
  color: string
  volume: number // 0..1
  pan: number // -1..1
  mute: boolean
  solo: boolean
  clips: MixdownClip[]
}

export interface MixdownSession {
  tracks: MixdownTrack[]
}

export interface MixdownOptions {
  sampleRate: number
  normalize: boolean
}

async function decodeAudio(url: string): Promise<AudioBuffer> {
  const res = await fetch(url)
  const arr = await res.arrayBuffer()
  const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
  try {
    const buf = await ctx.decodeAudioData(arr)
    return buf
  } finally {
    try { await ctx.close() } catch {}
  }
}

export async function renderMixdown(session: MixdownSession, opts: MixdownOptions): Promise<AudioBuffer> {
  const { sampleRate } = opts
  // Determine total duration
  let total = 0
  for (const t of session.tracks) {
    for (const c of t.clips) {
      total = Math.max(total, c.startTime + c.duration)
    }
  }
  const length = Math.max(1, Math.ceil(total * sampleRate))
  const offline = new OfflineAudioContext(2, length, sampleRate)

  // Prepare track nodes and schedule clips
  for (const t of session.tracks) {
    const gain = offline.createGain()
    gain.gain.value = t.mute ? 0 : t.volume
    const panner = offline.createStereoPanner()
    panner.pan.value = Math.max(-1, Math.min(1, t.pan || 0))
    gain.connect(panner)
    panner.connect(offline.destination)

    for (const c of t.clips) {
      try {
        const buffer = await decodeAudio(c.audioUrl)
        const src = offline.createBufferSource()
        src.buffer = buffer
        const start = Math.max(0, c.startTime)
        const srcOffset = Math.max(0, c.offset)
        const maxDur = Math.max(0, buffer.duration - srcOffset)
        const dur = Math.min(c.duration, maxDur)
        src.connect(gain)
        if (dur > 0) {
          src.start(start, srcOffset, dur)
        }
      } catch (e) {
        // Skip clip on decode error
        console.warn('Mixdown: failed to decode', c.audioUrl, e)
      }
    }
  }

  const rendered = await offline.startRendering()
  return rendered
}

export function audioBufferToWav(buffer: AudioBuffer, normalize = true): Blob {
  const numOfChan = buffer.numberOfChannels
  const sampleRate = buffer.sampleRate
  const len = buffer.length
  // Merge channels
  const channels: Float32Array[] = []
  for (let i = 0; i < numOfChan; i++) {
    channels.push(buffer.getChannelData(i))
  }
  // Find peak for normalization
  let peak = 0
  if (normalize) {
    for (let i = 0; i < len; i++) {
      for (let ch = 0; ch < numOfChan; ch++) {
        const v = Math.abs(channels[ch][i])
        if (v > peak) peak = v
      }
    }
    if (peak < 1e-5) peak = 1 // silence
  } else {
    peak = 1
  }

  // Interleave to 16-bit PCM
  const bytesPerSample = 2
  const blockAlign = numOfChan * bytesPerSample
  const dataSize = len * blockAlign
  const bufferLen = 44 + dataSize
  const ab = new ArrayBuffer(bufferLen)
  const view = new DataView(ab)

  // RIFF header
  writeString(view, 0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeString(view, 8, 'WAVE')
  writeString(view, 12, 'fmt ')
  view.setUint32(16, 16, true) // PCM chunk size
  view.setUint16(20, 1, true) // PCM format
  view.setUint16(22, numOfChan, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * blockAlign, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, 16, true) // bits per sample
  writeString(view, 36, 'data')
  view.setUint32(40, dataSize, true)

  // Write samples
  let offset = 44
  for (let i = 0; i < len; i++) {
    for (let ch = 0; ch < numOfChan; ch++) {
      const sample = channels[ch][i] / peak
      const s = Math.max(-1, Math.min(1, sample))
      const int16 = s < 0 ? s * 0x8000 : s * 0x7FFF
      view.setInt16(offset, int16, true)
      offset += 2
    }
  }

  return new Blob([ab], { type: 'audio/wav' })
}

function writeString(view: DataView, offset: number, s: string) {
  for (let i = 0; i < s.length; i++) {
    view.setUint8(offset + i, s.charCodeAt(i))
  }
}
