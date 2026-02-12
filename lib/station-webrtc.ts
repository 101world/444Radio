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
  private presenceCallback: ((members: any[]) => void) | null = null

  constructor(stationId: string, userId: string, isHost: boolean = false) {
    this.stationId = stationId
    this.userId = userId
    this.isHost = isHost
  }

  async init() {
    // Validate Pusher config before attempting connection
    if (!process.env.NEXT_PUBLIC_PUSHER_KEY) {
      throw new Error('Live streaming is not configured. Missing NEXT_PUBLIC_PUSHER_KEY.')
    }

    // Initialize Pusher with reconnection handling
    this.pusher = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER || 'ap2',
      authEndpoint: '/api/pusher/auth',
      userAuthentication: {
        endpoint: '/api/pusher/auth',
        transport: 'ajax'
      }
    })

    // Handle connection state changes to avoid "WebSocket is already in CLOSING or CLOSED state"
    this.pusher.connection.bind('error', (err: any) => {
      console.error('❌ Pusher connection error:', err)
    })
    this.pusher.connection.bind('disconnected', () => {
      console.warn('⚠️ Pusher disconnected — will auto-reconnect')
    })
    this.pusher.connection.bind('unavailable', () => {
      console.warn('⚠️ Pusher connection unavailable')
    })

    // Subscribe to station channel
    this.channel = this.pusher.subscribe(`presence-station-${this.stationId}`)

    this.channel.bind('pusher:subscription_succeeded', () => {
      console.log('✅ Connected to station:', this.stationId, 'as', this.isHost ? 'HOST' : 'VIEWER')
      // Send initial presence
      if (this.presenceCallback && this.channel.members) {
        const members = Object.values(this.channel.members.members)
        this.presenceCallback(members)
      }
    })

    this.channel.bind('pusher:member_added', (member: any) => {
      console.log('👋 New viewer:', member.id)
      if (this.presenceCallback && this.channel.members) {
        const members = Object.values(this.channel.members.members)
        this.presenceCallback(members)
      }
    })

    this.channel.bind('pusher:member_removed', (member: any) => {
      console.log('👋 Viewer left:', member.id)
      if (this.presenceCallback && this.channel.members) {
        const members = Object.values(this.channel.members.members)
        this.presenceCallback(members)
      }
    })
  }

  onPresence(callback: (members: any[]) => void) {
    this.presenceCallback = callback
    // Send current members if already connected
    if (this.channel && this.channel.members) {
      const members = Object.values(this.channel.members.members)
      callback(members)
    }
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
        // Check Pusher connection state before signaling
        if (this.pusher?.connection?.state !== 'connected') {
          console.warn('⚠️ Pusher not connected, waiting before sending signal...')
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
        try {
          const res = await fetch('/api/station/signal', {
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
          if (!res.ok) {
            const errData = await res.json().catch(() => ({}))
            console.error('❌ Signal API error:', res.status, errData)
          }
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
    // Wait for subscription to complete
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Channel subscription timeout')), 10000)
      
      if (this.channel.subscribed) {
        clearTimeout(timeout)
        resolve()
      } else {
        this.channel.bind('pusher:subscription_succeeded', () => {
          clearTimeout(timeout)
          resolve()
        })
      }
    })
    
    // Get host user ID from channel members
    const members = this.channel.members
    console.log('🔍 Looking for host. Channel members:', members ? Object.keys(members.members) : 'No members object')
    
    // Find any member that's not us (host joins first)
    const allMemberIds = members ? Object.keys(members.members).filter((id: string) => id !== this.userId) : []
    
    console.log(`📊 Found ${allMemberIds.length} potential hosts (excluding self)`)
    
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
      // Check Pusher connection state before signaling
      if (this.pusher?.connection?.state !== 'connected') {
        console.warn('⚠️ Pusher not connected, waiting before sending signal...')
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
      try {
        const res = await fetch('/api/station/signal', {
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
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}))
          console.error('❌ Signal API error:', res.status, errData)
          if (errData.code === 'PUSHER_NOT_CONFIGURED') {
            throw new Error('Live streaming is not available — Pusher is not configured on the server.')
          }
        }
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

  async sendMessage(message: string, username: string, avatar?: string) {
    try {
      await fetch('/api/station/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stationId: this.stationId,
          message,
          username,
          avatar,
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

  onKicked(callback: (data: any) => void) {
    this.channel.bind('user-kicked', callback)
  }

  async kickUser(kickUserId: string) {
    try {
      await fetch('/api/station/kick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stationId: this.stationId,
          kickUserId
        })
      })
    } catch (err) {
      console.error('Failed to kick user:', err)
    }
  }

  getViewerCount() {
    return this.channel?.members?.count || 0
  }

  getViewers() {
    if (!this.channel?.members) return []
    const members = this.channel.members.members
    return Object.keys(members)
      .filter(id => id !== this.userId)
      .map(id => ({ userId: id, ...members[id] }))
  }

  disconnect() {
    try {
      if (this.peer) {
        this.peer.destroy()
        this.peer = null
      }
    } catch (e) {
      console.warn('Peer cleanup error:', e)
    }

    try {
      if (this.localStream) {
        this.localStream.getTracks().forEach(track => track.stop())
        this.localStream = null
      }
    } catch (e) {
      console.warn('Stream cleanup error:', e)
    }

    try {
      if (this.channel) {
        this.channel.unbind_all()
        this.pusher?.unsubscribe(`presence-station-${this.stationId}`)
        this.channel = null
      }
    } catch (e) {
      console.warn('Channel cleanup error:', e)
    }

    try {
      if (this.pusher) {
        // Only disconnect if not already closing/closed — prevents
        // "WebSocket is already in CLOSING or CLOSED state" error
        if (this.pusher.connection?.state === 'connected' || this.pusher.connection?.state === 'connecting') {
          this.pusher.disconnect()
        }
        this.pusher = null
      }
    } catch (e) {
      console.warn('Pusher cleanup error:', e)
    }
  }
}
