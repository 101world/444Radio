/**
 * Advanced Track Management System
 * Handles solo/mute, routing, grouping, color coding, and track organization
 */

export interface Track {
  id: string
  name: string
  type: 'audio' | 'midi' | 'bus' | 'master'
  color: string
  icon: string
  volume: number // 0-1
  pan: number // -1 to 1
  muted: boolean
  solo: boolean
  armed: boolean // For recording
  inputSource?: string
  outputDestination: string
  sends: TrackSend[]
  clips: TrackClip[]
  automation: AutomationLane[]
  groupId?: string
  order: number
  collapsed: boolean
  height: number // pixels
  metadata: Record<string, any>
}

export interface TrackSend {
  id: string
  destination: string // Track ID or bus name
  amount: number // 0-1
  preFader: boolean
  muted: boolean
}

export interface TrackClip {
  id: string
  trackId: string
  startTime: number
  duration: number
  offset: number // Trim start
  gain: number
  fadeIn: FadeConfig
  fadeOut: FadeConfig
  buffer?: AudioBuffer
  color?: string
  name?: string
  locked: boolean
}

export interface FadeConfig {
  duration: number // seconds
  curve: 'linear' | 'exponential' | 'logarithmic' | 'scurve'
}

export interface AutomationLane {
  id: string
  parameter: string // 'volume', 'pan', 'effectParam', etc.
  points: AutomationPoint[]
  visible: boolean
}

export interface AutomationPoint {
  time: number
  value: number
  curve: 'linear' | 'bezier' | 'step'
}

export interface TrackGroup {
  id: string
  name: string
  color: string
  trackIds: string[]
  collapsed: boolean
  muted: boolean
  solo: boolean
}

export interface RoutingNode {
  id: string
  type: 'track' | 'bus' | 'send' | 'master'
  gainNode: GainNode
  panNode?: StereoPannerNode
  analyserNode?: AnalyserNode
  connections: string[] // IDs of connected nodes
}

export class TrackManager {
  private tracks: Map<string, Track> = new Map()
  private groups: Map<string, TrackGroup> = new Map()
  private routingGraph: Map<string, RoutingNode> = new Map()
  private audioContext: AudioContext
  private masterOutput: GainNode
  private soloedTracks: Set<string> = new Set()
  private listeners: Map<string, Set<Function>> = new Map()

  constructor(audioContext: AudioContext) {
    this.audioContext = audioContext
    this.masterOutput = audioContext.createGain()
    this.masterOutput.connect(audioContext.destination)
  }

  // Track CRUD Operations
  createTrack(config: Partial<Track> = {}): Track {
    const track: Track = {
      id: config.id || this.generateId(),
      name: config.name || `Track ${this.tracks.size + 1}`,
      type: config.type || 'audio',
      color: config.color || this.getRandomColor(),
      icon: config.icon || this.getDefaultIcon(config.type || 'audio'),
      volume: config.volume ?? 0.8,
      pan: config.pan ?? 0,
      muted: config.muted ?? false,
      solo: config.solo ?? false,
      armed: config.armed ?? false,
      outputDestination: config.outputDestination || 'master',
      sends: config.sends || [],
      clips: config.clips || [],
      automation: config.automation || [],
      groupId: config.groupId,
      order: config.order ?? this.tracks.size,
      collapsed: config.collapsed ?? false,
      height: config.height ?? 120,
      metadata: config.metadata || {}
    }

    this.tracks.set(track.id, track)
    this.createRoutingNode(track)
    this.emit('trackCreated', track)
    return track
  }

  getTrack(id: string): Track | undefined {
    return this.tracks.get(id)
  }

  getTracks(): Track[] {
    return Array.from(this.tracks.values()).sort((a, b) => a.order - b.order)
  }

  updateTrack(id: string, updates: Partial<Track>): void {
    const track = this.tracks.get(id)
    if (!track) return

    Object.assign(track, updates)
    this.updateRouting(track)
    this.emit('trackUpdated', track)
  }

  deleteTrack(id: string): void {
    const track = this.tracks.get(id)
    if (!track) return

    // Remove from group
    if (track.groupId) {
      this.removeTrackFromGroup(id, track.groupId)
    }

    // Cleanup routing
    this.removeRoutingNode(id)

    this.tracks.delete(id)
    this.soloedTracks.delete(id)
    this.emit('trackDeleted', id)
  }

  reorderTracks(trackIds: string[]): void {
    trackIds.forEach((id, index) => {
      const track = this.tracks.get(id)
      if (track) track.order = index
    })
    this.emit('tracksReordered', trackIds)
  }

  // Solo/Mute Management
  toggleMute(trackId: string): void {
    const track = this.tracks.get(trackId)
    if (!track) return

    track.muted = !track.muted
    this.updateRoutingNode(trackId, { muted: track.muted })
    this.emit('muteChanged', { trackId, muted: track.muted })
  }

  toggleSolo(trackId: string): void {
    const track = this.tracks.get(trackId)
    if (!track) return

    track.solo = !track.solo
    
    if (track.solo) {
      this.soloedTracks.add(trackId)
    } else {
      this.soloedTracks.delete(trackId)
    }

    this.updateSoloState()
    this.emit('soloChanged', { trackId, solo: track.solo })
  }

  private updateSoloState(): void {
    const hasSolos = this.soloedTracks.size > 0

    this.tracks.forEach((track, id) => {
      const node = this.routingGraph.get(id)
      if (!node) return

      const shouldBeSilent = hasSolos && !this.soloedTracks.has(id) && !track.muted
      node.gainNode.gain.value = shouldBeSilent ? 0 : track.muted ? 0 : track.volume
    })
  }

  // Volume and Pan
  setVolume(trackId: string, volume: number): void {
    const track = this.tracks.get(trackId)
    if (!track) return

    track.volume = Math.max(0, Math.min(1, volume))
    this.updateRoutingNode(trackId, { volume: track.volume })
    this.emit('volumeChanged', { trackId, volume: track.volume })
  }

  setPan(trackId: string, pan: number): void {
    const track = this.tracks.get(trackId)
    if (!track) return

    track.pan = Math.max(-1, Math.min(1, pan))
    this.updateRoutingNode(trackId, { pan: track.pan })
    this.emit('panChanged', { trackId, pan: track.pan })
  }

  // Group Management
  createGroup(name: string, trackIds: string[] = []): TrackGroup {
    const group: TrackGroup = {
      id: this.generateId(),
      name,
      color: this.getRandomColor(),
      trackIds,
      collapsed: false,
      muted: false,
      solo: false
    }

    this.groups.set(group.id, group)
    
    // Update tracks to reference this group
    trackIds.forEach(id => {
      const track = this.tracks.get(id)
      if (track) track.groupId = group.id
    })

    this.emit('groupCreated', group)
    return group
  }

  addTrackToGroup(trackId: string, groupId: string): void {
    const track = this.tracks.get(trackId)
    const group = this.groups.get(groupId)
    if (!track || !group) return

    track.groupId = groupId
    if (!group.trackIds.includes(trackId)) {
      group.trackIds.push(trackId)
    }

    this.emit('trackAddedToGroup', { trackId, groupId })
  }

  removeTrackFromGroup(trackId: string, groupId: string): void {
    const track = this.tracks.get(trackId)
    const group = this.groups.get(groupId)
    if (!track || !group) return

    track.groupId = undefined
    group.trackIds = group.trackIds.filter(id => id !== trackId)

    this.emit('trackRemovedFromGroup', { trackId, groupId })
  }

  toggleGroupMute(groupId: string): void {
    const group = this.groups.get(groupId)
    if (!group) return

    group.muted = !group.muted
    group.trackIds.forEach(id => {
      const track = this.tracks.get(id)
      if (track) {
        track.muted = group.muted
        this.updateRoutingNode(id, { muted: track.muted })
      }
    })

    this.emit('groupMuteChanged', { groupId, muted: group.muted })
  }

  toggleGroupSolo(groupId: string): void {
    const group = this.groups.get(groupId)
    if (!group) return

    group.solo = !group.solo
    group.trackIds.forEach(id => {
      const track = this.tracks.get(id)
      if (track) {
        track.solo = group.solo
        if (group.solo) {
          this.soloedTracks.add(id)
        } else {
          this.soloedTracks.delete(id)
        }
      }
    })

    this.updateSoloState()
    this.emit('groupSoloChanged', { groupId, solo: group.solo })
  }

  // Send Management
  addSend(trackId: string, destination: string, amount: number = 0.5): void {
    const track = this.tracks.get(trackId)
    if (!track) return

    const send: TrackSend = {
      id: this.generateId(),
      destination,
      amount,
      preFader: false,
      muted: false
    }

    track.sends.push(send)
    this.createSendRouting(trackId, send)
    this.emit('sendAdded', { trackId, send })
  }

  removeSend(trackId: string, sendId: string): void {
    const track = this.tracks.get(trackId)
    if (!track) return

    track.sends = track.sends.filter(s => s.id !== sendId)
    this.removeSendRouting(trackId, sendId)
    this.emit('sendRemoved', { trackId, sendId })
  }

  updateSend(trackId: string, sendId: string, updates: Partial<TrackSend>): void {
    const track = this.tracks.get(trackId)
    if (!track) return

    const send = track.sends.find(s => s.id === sendId)
    if (!send) return

    Object.assign(send, updates)
    this.updateSendRouting(trackId, send)
    this.emit('sendUpdated', { trackId, send })
  }

  // Routing Graph Management
  private createRoutingNode(track: Track): void {
    const gainNode = this.audioContext.createGain()
    const panNode = this.audioContext.createStereoPanner()
    const analyserNode = this.audioContext.createAnalyser()

    gainNode.gain.value = track.volume
    panNode.pan.value = track.pan

    gainNode.connect(panNode)
    panNode.connect(analyserNode)
    analyserNode.connect(this.masterOutput)

    this.routingGraph.set(track.id, {
      id: track.id,
      type: track.type === 'master' ? 'master' : 'track',
      gainNode,
      panNode,
      analyserNode,
      connections: [track.outputDestination]
    })
  }

  private updateRoutingNode(trackId: string, updates: { volume?: number, pan?: number, muted?: boolean }): void {
    const node = this.routingGraph.get(trackId)
    if (!node) return

    if (updates.volume !== undefined) {
      node.gainNode.gain.value = updates.muted ? 0 : updates.volume
    }
    if (updates.pan !== undefined && node.panNode) {
      node.panNode.pan.value = updates.pan
    }
    if (updates.muted !== undefined) {
      const track = this.tracks.get(trackId)
      if (track) {
        node.gainNode.gain.value = updates.muted ? 0 : track.volume
      }
    }
  }

  private removeRoutingNode(trackId: string): void {
    const node = this.routingGraph.get(trackId)
    if (!node) return

    node.gainNode.disconnect()
    node.panNode?.disconnect()
    node.analyserNode?.disconnect()
    this.routingGraph.delete(trackId)
  }

  private updateRouting(track: Track): void {
    // Reconnect output destination if changed
    const node = this.routingGraph.get(track.id)
    if (!node) return

    // Disconnect and reconnect to new destination
    const destination = this.routingGraph.get(track.outputDestination)?.gainNode || this.masterOutput
    node.analyserNode?.disconnect()
    node.analyserNode?.connect(destination)
  }

  private createSendRouting(trackId: string, send: TrackSend): void {
    const sourceNode = this.routingGraph.get(trackId)
    const destNode = this.routingGraph.get(send.destination)
    if (!sourceNode || !destNode) return

    const sendGain = this.audioContext.createGain()
    sendGain.gain.value = send.amount

    // Connect from pre or post fader
    const source = send.preFader ? sourceNode.panNode || sourceNode.gainNode : sourceNode.analyserNode
    source?.connect(sendGain)
    sendGain.connect(destNode.gainNode)
  }

  private removeSendRouting(trackId: string, sendId: string): void {
    // Cleanup send connections (simplified)
    // In production, track send nodes separately
  }

  private updateSendRouting(trackId: string, send: TrackSend): void {
    // Update send gain and routing
    // In production, store send nodes in routing graph
  }

  // Utility Methods
  private generateId(): string {
    return `track_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private getRandomColor(): string {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
      '#DFE6E9', '#A29BFE', '#FD79A8', '#FDCB6E', '#6C5CE7'
    ]
    return colors[Math.floor(Math.random() * colors.length)]
  }

  private getDefaultIcon(type: string): string {
    const icons: Record<string, string> = {
      audio: '🎵',
      midi: '🎹',
      bus: '🔀',
      master: '🎚️'
    }
    return icons[type] || '🎵'
  }

  // Event System
  on(event: string, callback: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(callback)
  }

  off(event: string, callback: Function): void {
    this.listeners.get(event)?.delete(callback)
  }

  private emit(event: string, data: any): void {
    this.listeners.get(event)?.forEach(callback => callback(data))
  }

  // Getters for routing
  getRoutingNode(trackId: string): RoutingNode | undefined {
    return this.routingGraph.get(trackId)
  }

  getMasterOutput(): GainNode {
    return this.masterOutput
  }

  // Cleanup
  dispose(): void {
    this.routingGraph.forEach(node => {
      node.gainNode.disconnect()
      node.panNode?.disconnect()
      node.analyserNode?.disconnect()
    })
    this.routingGraph.clear()
    this.tracks.clear()
    this.groups.clear()
    this.listeners.clear()
  }
}
