export async function encodeMp3FromAudioBuffer(buffer: AudioBuffer, options?: { kbps?: number; onProgress?: (p: number) => void }) {
  const { kbps = 192, onProgress } = options || {}
  const lame = await import('lamejs')
  const numChannels = Math.min(2, buffer.numberOfChannels)
  const sampleRate = buffer.sampleRate
  const encoder = new lame.Mp3Encoder(numChannels, sampleRate, kbps)

  // Convert float32 to int16 per channel
  const left = buffer.getChannelData(0)
  const right = numChannels > 1 ? buffer.getChannelData(1) : left

  const blockSize = 1152 // frame size for MP3
  const len = buffer.length
  const chunks: Int8Array[] = []
  for (let i = 0; i < len; i += blockSize) {
    const leftChunk = floatTo16(left.subarray(i, i + blockSize))
    const rightChunk = floatTo16(right.subarray(i, i + blockSize))
    const mp3buf = encoder.encodeBuffer(leftChunk, rightChunk)
    if (mp3buf.length > 0) chunks.push(mp3buf)
    if (onProgress) onProgress(Math.min(1, (i + blockSize) / len))
  }
  const end = encoder.flush()
  if (end.length > 0) chunks.push(end)

  // Concatenate
  const totalLen = chunks.reduce((a, b) => a + b.length, 0)
  const out = new Uint8Array(totalLen)
  let offset = 0
  for (const c of chunks) { out.set(c, offset); offset += c.length }
  return new Blob([out], { type: 'audio/mpeg' })
}

function floatTo16(f32: Float32Array) {
  const out = new Int16Array(f32.length)
  for (let i = 0; i < f32.length; i++) {
    let s = Math.max(-1, Math.min(1, f32[i]))
    out[i] = s < 0 ? s * 0x8000 : s * 0x7FFF
  }
  return out
}
