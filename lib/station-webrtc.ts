import Peer from 'simple-peer'
import Pusher from 'pusher-js'

interface SignalData {
  signal: any
  from: string
  to?: string
}

export class StationWebRTC {
  private pusher: Pusher | null = null
  private channel: any = null
  private peer: Peer | null = null
  private localStream: MediaStream | null = null
  private stationId: string
  private userId: string
  private isHost: boolean

  constructor(stationId: string, userId: string, isHost: boolean = false) {
    this.stationId = stationId
    this.userId = userId
    this.isHost = isHost
  }

  async init() {
    // Initialize Pusher
    this.pusher = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER || 'ap2',
      authEndpoint: '/api/pusher/auth',
      userAuthentication: {
        endpoint: '/api/pusher/auth',
        transport: 'ajax'
      }
    })

    // Subscribe to station channel
    this.channel = this.pusher.subscribe(`presence-station-${this.stationId}`)

    this.channel.bind('pusher:subscription_succeeded', () => {
      console.log('✅ Connected to station:', this.stationId, 'as', this.isHost ? 'HOST' : 'VIEWER')
    })

    this.channel.bind('pusher:member_added', (member: any) => {
      console.log('👋 New viewer:', member.id)
    })

    this.channel.bind('pusher:member_removed', (member: any) => {
      console.log('👋 Viewer left:', member.id)
    })
  }

  async startBroadcast(stream: MediaStream, onViewerJoin?: (viewerId: string) => void) {
    this.localStream = stream
    
    // Listen for viewer signal requests
    this.channel.bind('viewer-signal', (data: SignalData) => {
      if (data.to !== this.userId) return
      
      console.log('📡 Viewer requesting connection:', data.from)
      
      // Create peer for this viewer
      const peer = new Peer({
        initiator: false,
        trickle: false,
        stream: this.localStream!
      })

      peer.on('signal', async (signal) => {
        // Send signal back to viewer via server API (Pusher client events not enabled)
        try {
          await fetch('/api/station/signal', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              stationId: this.stationId,
              signal,
              from: this.userId,
              to: data.from,
              type: 'host'
            })
          })
        } catch (err) {
          console.error('Failed to send host signal:', err)
        }
      })

      peer.on('connect', () => {
        console.log('✅ Connected to viewer:', data.from)
        onViewerJoin?.(data.from)
      })

      peer.on('error', (err) => {
        console.error('❌ Peer error:', err)
      })

      // Process viewer's signal
      peer.signal(data.signal)
    })
  }

  async joinStream(onStream?: (stream: MediaStream) => void) {
    // Get host user ID from channel members
    const members = this.channel.members
    console.log('🔍 Looking for host. Channel members:', Object.keys(members.members))
    
    // Find any member that's not us (host joins first)
    const allMemberIds = Object.keys(members.members).filter((id: string) => id !== this.userId)
    
    if (allMemberIds.length === 0) {
      throw new Error('Host not found. Station may have ended.')
    }

    const hostId = allMemberIds[0]
    console.log('🎯 Connecting to host:', hostId)

    // Create peer as viewer
    this.peer = new Peer({
      initiator: true,
      trickle: false
    })

    this.peer.on('signal', async (signal) => {
      // Send signal to host via server API (Pusher client events not enabled)
      try {
        await fetch('/api/station/signal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            stationId: this.stationId,
            signal,
            from: this.userId,
            to: hostId,
            type: 'viewer'
          })
        })
      } catch (err) {
        console.error('Failed to send viewer signal:', err)
      }
    })

    this.peer.on('stream', (stream) => {
      console.log('✅ Received stream from host')
      onStream?.(stream)
    })

    this.peer.on('connect', () => {
      console.log('✅ Connected to host')
    })

    this.peer.on('error', (err) => {
      console.error('❌ Peer connection error:', err)
    })

    // Listen for host's signal response
    this.channel.bind('host-signal', (data: SignalData) => {
      if (data.to !== this.userId) return
      
      console.log('📡 Received signal from host')
      this.peer?.signal(data.signal)
    })
  }

  async sendMessage(message: string, username: string) {
    try {
      await fetch('/api/station/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stationId: this.stationId,
          message,
          username,
          userId: this.userId,
          timestamp: new Date().toISOString()
        })
      })
    } catch (err) {
      console.error('Failed to send message:', err)
    }
  }

  onMessage(callback: (data: any) => void) {
    this.channel.bind('chat-message', callback)
  }

  async sendReaction(emoji: string) {
    try {
      await fetch('/api/station/reaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stationId: this.stationId,
          emoji,
          userId: this.userId,
          timestamp: new Date().toISOString()
        })
      })
    } catch (err) {
      console.error('Failed to send reaction:', err)
    }
  }

  onReaction(callback: (data: any) => void) {
    this.channel.bind('reaction', callback)
  }

  getViewerCount() {
    return this.channel?.members?.count || 0
  }

  disconnect() {
    if (this.peer) {
      this.peer.destroy()
      this.peer = null
    }

    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop())
      this.localStream = null
    }

    if (this.channel) {
      this.pusher?.unsubscribe(`presence-station-${this.stationId}`)
      this.channel = null
    }

    if (this.pusher) {
      this.pusher.disconnect()
      this.pusher = null
    }
  }
}
