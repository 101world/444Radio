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
  // Try with ideal constraints first
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
    return await navigator.mediaDevices.getUserMedia(constraints)
  } catch (error) {
    console.warn('Failed with ideal constraints, trying with basic video...', error)
    
    // Fallback 1: Try with just basic video
    try {
      return await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      })
    } catch (error2) {
      console.warn('Failed with basic video, trying audio only...', error2)
      
      // Fallback 2: Try audio only
      try {
        return await navigator.mediaDevices.getUserMedia({
          video: false,
          audio: true
        })
      } catch (error3) {
        console.error('All getUserMedia attempts failed:', error3)
        throw new Error('Could not access camera or microphone. Please check your device permissions and ensure a camera/microphone is connected.')
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
