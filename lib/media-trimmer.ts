/**
 * Client-side media trimming utilities for video and audio files.
 * Works entirely in the browser using Web APIs.
 */

/**
 * Trim a video file to a specific time range using canvas and MediaRecorder.
 * @param file - Original video file
 * @param startTime - Start time in seconds
 * @param endTime - End time in seconds
 * @returns Trimmed video blob
 */
export async function trimVideo(
  file: File,
  startTime: number,
  endTime: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.src = URL.createObjectURL(file)

    video.onloadedmetadata = () => {
      try {
        const duration = Math.min(endTime - startTime, 10)
        
        // Create canvas for video frames
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        if (!ctx) throw new Error('Failed to get canvas context')

        canvas.width = video.videoWidth
        canvas.height = video.videoHeight

        // Set up MediaRecorder to capture canvas stream
        const stream = canvas.captureStream(30) // 30 fps
        
        // Add audio track if present
        if ('captureStream' in video) {
          const videoStream = (video as any).captureStream()
          const audioTracks = videoStream.getAudioTracks()
          if (audioTracks.length > 0) {
            stream.addTrack(audioTracks[0])
          }
        }

        const chunks: Blob[] = []
        const mediaRecorder = new MediaRecorder(stream, {
          mimeType: 'video/webm;codecs=vp9',
        })

        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            chunks.push(e.data)
          }
        }

        mediaRecorder.onstop = () => {
          const blob = new Blob(chunks, { type: 'video/webm' })
          URL.revokeObjectURL(video.src)
          resolve(blob)
        }

        // Start recording from the specified start time
        video.currentTime = startTime
        video.onseeked = () => {
          mediaRecorder.start()
          video.play()

          // Draw video frames to canvas
          const drawFrame = () => {
            if (video.currentTime >= endTime || video.currentTime >= startTime + duration) {
              mediaRecorder.stop()
              video.pause()
              return
            }
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
            requestAnimationFrame(drawFrame)
          }
          drawFrame()
        }
      } catch (error) {
        URL.revokeObjectURL(video.src)
        reject(error)
      }
    }

    video.onerror = () => {
      URL.revokeObjectURL(video.src)
      reject(new Error('Failed to load video'))
    }
  })
}

/**
 * Trim an audio file to a specific time range using Web Audio API.
 * @param file - Original audio file
 * @param startTime - Start time in seconds
 * @param endTime - End time in seconds
 * @returns Trimmed audio blob
 */
export async function trimAudio(
  file: File,
  startTime: number,
  endTime: number
): Promise<Blob> {
  const audioContext = new AudioContext()
  
  try {
    // Read file as array buffer
    const arrayBuffer = await file.arrayBuffer()
    
    // Decode audio data
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
    
    // Calculate sample range
    const sampleRate = audioBuffer.sampleRate
    const startSample = Math.floor(startTime * sampleRate)
    const endSample = Math.min(
      Math.floor(endTime * sampleRate),
      audioBuffer.length
    )
    const duration = endSample - startSample
    
    // Create new buffer with trimmed audio
    const trimmedBuffer = audioContext.createBuffer(
      audioBuffer.numberOfChannels,
      duration,
      sampleRate
    )
    
    // Copy audio data for each channel
    for (let i = 0; i < audioBuffer.numberOfChannels; i++) {
      const channelData = audioBuffer.getChannelData(i)
      const trimmedData = trimmedBuffer.getChannelData(i)
      for (let j = 0; j < duration; j++) {
        trimmedData[j] = channelData[startSample + j]
      }
    }
    
    // Convert buffer to WAV blob
    const wavBlob = audioBufferToWav(trimmedBuffer)
    await audioContext.close()
    
    return wavBlob
  } catch (error) {
    await audioContext.close()
    throw error
  }
}

/**
 * Convert AudioBuffer to WAV blob.
 * @param buffer - Audio buffer
 * @returns WAV blob
 */
function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numberOfChannels = buffer.numberOfChannels
  const sampleRate = buffer.sampleRate
  const format = 1 // PCM
  const bitDepth = 16
  
  const bytesPerSample = bitDepth / 8
  const blockAlign = numberOfChannels * bytesPerSample
  
  const data = new Float32Array(buffer.length * numberOfChannels)
  for (let i = 0; i < buffer.numberOfChannels; i++) {
    const channelData = buffer.getChannelData(i)
    for (let j = 0; j < buffer.length; j++) {
      data[j * numberOfChannels + i] = channelData[j]
    }
  }
  
  const dataLength = data.length * bytesPerSample
  const bufferLength = 44 + dataLength
  const arrayBuffer = new ArrayBuffer(bufferLength)
  const view = new DataView(arrayBuffer)
  
  // Write WAV header
  let offset = 0
  
  // "RIFF" chunk descriptor
  writeString(view, offset, 'RIFF'); offset += 4
  view.setUint32(offset, 36 + dataLength, true); offset += 4
  writeString(view, offset, 'WAVE'); offset += 4
  
  // "fmt " sub-chunk
  writeString(view, offset, 'fmt '); offset += 4
  view.setUint32(offset, 16, true); offset += 4 // Sub-chunk size
  view.setUint16(offset, format, true); offset += 2 // Audio format
  view.setUint16(offset, numberOfChannels, true); offset += 2
  view.setUint32(offset, sampleRate, true); offset += 4
  view.setUint32(offset, sampleRate * blockAlign, true); offset += 4 // Byte rate
  view.setUint16(offset, blockAlign, true); offset += 2
  view.setUint16(offset, bitDepth, true); offset += 2
  
  // "data" sub-chunk
  writeString(view, offset, 'data'); offset += 4
  view.setUint32(offset, dataLength, true); offset += 4
  
  // Write audio data
  const volume = 0.8
  for (let i = 0; i < data.length; i++) {
    const sample = Math.max(-1, Math.min(1, data[i]))
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true)
    offset += 2
  }
  
  return new Blob([arrayBuffer], { type: 'audio/wav' })
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i))
  }
}

/**
 * Simplified version: Just return the original file if trimming fails.
 * This is a fallback for browser compatibility issues.
 */
export async function trimMediaWithFallback(
  file: File,
  startTime: number,
  endTime: number,
  type: 'video' | 'audio'
): Promise<File> {
  try {
    // If no trimming needed (using full duration), return original
    if (startTime === 0 && endTime >= 10) {
      return file
    }
    
    const blob = type === 'video' 
      ? await trimVideo(file, startTime, endTime)
      : await trimAudio(file, startTime, endTime)
    
    // Convert blob to file
    const extension = type === 'video' ? 'webm' : 'wav'
    return new File([blob], `trimmed-${Date.now()}.${extension}`, {
      type: blob.type,
    })
  } catch (error) {
    console.warn('Media trimming failed, using original file:', error)
    return file
  }
}
