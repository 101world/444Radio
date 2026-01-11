import Peer from 'simple-peer'

export interface WebRTCConfig {
  iceServers: RTCIceServer[]
}

// Default STUN/TURN servers (using Google's free STUN servers)
export const DEFAULT_WEBRTC_CONFIG: WebRTCConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' }
  ]
}

export interface StreamQuality {
  width: number
  height: number
  frameRate: number
  bitrate: number
  label: string
}

export const STREAM_QUALITIES: Record<string, StreamQuality> = {
  '480p': { width: 854, height: 480, frameRate: 24, bitrate: 1000, label: '480p (Low)' },
  '720p': { width: 1280, height: 720, frameRate: 30, bitrate: 2500, label: '720p (Medium)' },
  '1080p': { width: 1920, height: 1080, frameRate: 30, bitrate: 4000, label: '1080p (High)' }
}

export class WebRTCManager {
  private peer: Peer | null = null
  private config: WebRTCConfig

  constructor(config: WebRTCConfig = DEFAULT_WEBRTC_CONFIG) {
    this.config = config
  }

  createBroadcaster(stream: MediaStream): Peer {
    this.peer = new Peer({
      initiator: true,
      stream,
      config: this.config,
      trickle: false
    })

    return this.peer
  }

  createViewer(): Peer {
    this.peer = new Peer({
      initiator: false,
      config: this.config,
      trickle: false
    })

    return this.peer
  }

  destroy() {
    if (this.peer) {
      this.peer.destroy()
      this.peer = null
    }
  }

  getPeer(): Peer | null {
    return this.peer
  }
}

export async function getUserMedia(quality: StreamQuality): Promise<MediaStream> {
  // First, enumerate devices to debug
  try {
    const devices = await navigator.mediaDevices.enumerateDevices()
    const cameras = devices.filter(d => d.kind === 'videoinput')
    const mics = devices.filter(d => d.kind === 'audioinput')
    console.log('🔍 Available devices:', { 
      cameras: cameras.length, 
      microphones: mics.length,
      hasCamera: cameras.length > 0,
      hasMic: mics.length > 0
    })
  } catch (e) {
    console.warn('Could not enumerate devices:', e)
  }

  // Try with flexible constraints (browser will pick best available device)
  try {
    const constraints: MediaStreamConstraints = {
      video: {
        width: { ideal: quality.width },
        height: { ideal: quality.height },
        frameRate: { ideal: quality.frameRate }
      },
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    }
    console.log('🎥 Requesting media with quality:', quality.label)
    return await navigator.mediaDevices.getUserMedia(constraints)
  } catch (error) {
    console.warn('⚠️ Failed with ideal constraints, trying basic...', error)
    
    // Fallback 1: Try with just basic true (let browser choose defaults)
    try {
      console.log('🎥 Trying basic { video: true, audio: true }...')
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      })
      console.log('✅ Got media with basic constraints')
      return stream
    } catch (error2) {
      console.warn('⚠️ Video failed, trying audio only...', error2)
      
      // Fallback 2: Audio-only mode (for users without camera)
      try {
        console.log('🎤 Trying audio-only mode...')
        const stream = await navigator.mediaDevices.getUserMedia({
          video: false,
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        })
        console.log('✅ Got audio-only stream (no camera available)')
        return stream
      } catch (error3) {
        console.error('❌ All getUserMedia attempts failed:', error3)
        throw new Error('Could not access microphone. Please check permissions and ensure a microphone is connected.')
      }
    }
  }
}

export function calculateBandwidth(stream: MediaStream): number {
  const videoTrack = stream.getVideoTracks()[0]
  if (!videoTrack) return 0

  const settings = videoTrack.getSettings()
  const width = settings.width || 1280
  const height = settings.height || 720
  const frameRate = settings.frameRate || 30

  // Rough estimate: width * height * frameRate * 0.1 (bits per pixel)
  return Math.round((width * height * frameRate * 0.1) / 1000) // in Kbps
}

export function getConnectionQuality(ping: number): 'excellent' | 'good' | 'poor' | 'bad' {
  if (ping < 50) return 'excellent'
  if (ping < 100) return 'good'
  if (ping < 200) return 'poor'
  return 'bad'
}

export function formatBandwidth(kbps: number): string {
  if (kbps < 1000) return `${kbps.toFixed(0)} Kbps`
  return `${(kbps / 1000).toFixed(1)} Mbps`
}
