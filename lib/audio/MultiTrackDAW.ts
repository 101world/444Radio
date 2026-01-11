/**
 * Multi-Track DAW Integration
 * Connects all professional audio features into a unified system
 */

import { AudioEngine } from './AudioEngine'
import { TrackManager, Track } from './TrackManager'
import { TimelineManager } from './TimelineManager'
import { MixingConsole } from './MixingConsole'
import { MIDIManager } from './MIDIManager'
import { EffectsChain } from './EffectsSuite'
import { RecordingManager } from './RecordingManager'
import { ProjectManager } from './ProjectManager'
import { HistoryManager } from './HistoryManager'
import { AudioAnalyzer } from './AudioAnalyzer'
import { KeyboardShortcutManager } from './KeyboardShortcutManager'
import { SampleLibraryManager } from './SampleLibraryManager'
import { SelectionManager } from './SelectionManager'
import { PerformanceManager, getPerformanceManager } from './PerformanceManager'
import { AudioScheduler } from './scheduler'

export interface DAWConfig {
  sampleRate?: number
  bpm?: number
  timeSignature?: { numerator: number; denominator: number }
  userId?: string
}

export interface TransportState {
  isPlaying: boolean
  isRecording: boolean
  loopEnabled: boolean
  metronomeEnabled: boolean
  currentTime: number
  bpm: number
}

export class MultiTrackDAW {
  // Core systems
  private audioContext: AudioContext
  private audioEngine: AudioEngine
  private audioScheduler: AudioScheduler
  private trackManager: TrackManager
  private timelineManager: TimelineManager
  private mixingConsole: MixingConsole
  private midiManager: MIDIManager
  private effectsChain: EffectsChain
  private recordingManager: RecordingManager
  private projectManager: ProjectManager
  private historyManager: HistoryManager
  private audioAnalyzer: AudioAnalyzer
  private keyboardManager: KeyboardShortcutManager
  private sampleLibrary: SampleLibraryManager
  private selectionManager: SelectionManager
  private performanceManager: PerformanceManager

  // State
  private transportState: TransportState = {
    isPlaying: false,
    isRecording: false,
    loopEnabled: false,
    metronomeEnabled: false,
    currentTime: 0,
    bpm: 120
  }

  private playbackStartTime: number = 0
  private playbackOffset: number = 0
  private rafId?: number
  private activeSourceNodes?: Map<string, AudioBufferSourceNode>
  private listeners: Map<string, Set<Function>> = new Map()

  constructor(config: DAWConfig = {}) {
    // Initialize audio context - SINGLE shared context for all systems
    this.audioContext = new AudioContext({ 
      sampleRate: config.sampleRate || 48000,
      latencyHint: 'interactive'
    })

    // Initialize core systems - pass shared context to AudioEngine
    this.audioEngine = new AudioEngine({ 
      context: this.audioContext,
      enableWorklets: true 
    })
    this.audioScheduler = new AudioScheduler(this.audioContext, {
      lookaheadMs: 50,
      scheduleAheadMs: 100
    })
    this.trackManager = new TrackManager(this.audioContext)
    this.timelineManager = new TimelineManager(config.bpm || 120)
    this.mixingConsole = new MixingConsole(this.audioContext)
    this.midiManager = new MIDIManager(this.audioContext)
    this.effectsChain = new EffectsChain(this.audioContext)
    this.recordingManager = new RecordingManager(this.audioContext)
    // ProjectManager has no constructor, don't pass userId
    this.projectManager = new ProjectManager()
    this.historyManager = new HistoryManager()
    this.audioAnalyzer = new AudioAnalyzer(this.audioContext)
    this.keyboardManager = new KeyboardShortcutManager()
    this.sampleLibrary = new SampleLibraryManager(this.audioContext)
    this.selectionManager = new SelectionManager()
    this.performanceManager = getPerformanceManager('/audio-worklet-processor.js')

    // Set initial state
    this.transportState.bpm = config.bpm || 120
    if (config.timeSignature) {
      this.timelineManager.setTimeSignature(0, config.timeSignature.numerator, config.timeSignature.denominator)
    }

    // Setup integrations
    this.setupIntegrations()
  }

  private setupIntegrations(): void {
    // Connect keyboard shortcuts to actions
    this.keyboardManager.on('play', () => this.togglePlayback())
    this.keyboardManager.on('stop', () => this.stop())
    this.keyboardManager.on('record', () => this.toggleRecording())
    this.keyboardManager.on('undo', () => this.historyManager.undo())
    this.keyboardManager.on('redo', () => this.historyManager.redo())
    this.keyboardManager.on('saveProject', () => this.saveProject())
    this.keyboardManager.on('newTrack', () => this.createTrack())
    this.keyboardManager.on('toggleLoop', () => this.toggleLoop())
    this.keyboardManager.on('zoomIn', () => this.timelineManager.zoomIn())
    this.keyboardManager.on('zoomOut', () => this.timelineManager.zoomOut())

    // Setup playback loop
    this.setupPlaybackLoop()
  }

  // Transport Controls
  play(): void {
    if (this.transportState.isPlaying) return

    this.audioContext.resume()
    this.transportState.isPlaying = true
    this.playbackStartTime = this.audioContext.currentTime
    this.playbackOffset = this.transportState.currentTime

    // Store active source nodes for cleanup
    if (!this.activeSourceNodes) {
      this.activeSourceNodes = new Map()
    }

    // Schedule all clips
    const tracks = this.trackManager.getTracks()
    tracks.forEach(track => {
      const routingNode = this.trackManager.getRoutingNode(track.id)
      if (!routingNode || track.muted || !track.clips.length) return

      track.clips.forEach(clip => {
        if (!clip.buffer) return // Skip clips without audio buffer

        // Calculate when this clip should start relative to current playhead
        const clipStartTime = clip.startTime - this.transportState.currentTime
        if (clipStartTime < -clip.duration) return // Clip is in the past

        // Create source node for this clip
        const source = this.audioContext.createBufferSource()
        source.buffer = clip.buffer

        // Apply clip gain
        const clipGain = this.audioContext.createGain()
        clipGain.gain.value = clip.gain

        // Connect: source → clipGain → track routing → master
        source.connect(clipGain)
        clipGain.connect(routingNode.gainNode)

        // Calculate start time in AudioContext time
        const startTime = this.audioContext.currentTime + Math.max(0, clipStartTime)
        const offset = Math.max(0, -clipStartTime) + clip.offset
        const duration = clip.duration - offset

        // Start playback
        source.start(startTime, offset, duration)

        // Store for cleanup
        const clipKey = `${track.id}:${clip.id}`
        if (this.activeSourceNodes) {
          this.activeSourceNodes.set(clipKey, source)

          // Auto-cleanup when done
          source.onended = () => {
            this.activeSourceNodes?.delete(clipKey)
          }
        }
      })
    })

    this.emit('play', { time: this.transportState.currentTime })
  }

  pause(): void {
    if (!this.transportState.isPlaying) return

    this.transportState.isPlaying = false
    this.transportState.currentTime = this.audioContext.currentTime - this.playbackStartTime + this.playbackOffset

    // Stop all active audio source nodes
    if (this.activeSourceNodes) {
      this.activeSourceNodes.forEach(source => {
        try {
          source.stop()
        } catch (e) {
          // Ignore if already stopped
        }
      })
      this.activeSourceNodes.clear()
    }

    this.emit('pause', { time: this.transportState.currentTime })
  }

  // Get current playback time (live during playback)
  getCurrentTime(): number {
    if (this.transportState.isPlaying) {
      return this.audioContext.currentTime - this.playbackStartTime + this.playbackOffset
    }
    return this.transportState.currentTime
  }

  stop(): void {
    this.pause()
    this.transportState.currentTime = 0
    this.playbackOffset = 0

    // Stop all MIDI notes
    this.midiManager.stopAllNotes()

    this.emit('stop')
  }

  togglePlayback(): void {
    if (this.transportState.isPlaying) {
      this.pause()
    } else {
      this.play()
    }
  }

  toggleRecording(): void {
    if (this.transportState.isRecording) {
      this.stopRecording()
    } else {
      this.startRecording()
    }
  }

  startRecording(): void {
    if (!this.transportState.isRecording) {
      this.transportState.isRecording = true
      
      // Find armed tracks
      const tracks = this.trackManager.getTracks()
      const armedTrack = tracks.find(t => t.armed)
      
      if (armedTrack) {
        this.recordingManager.startRecording(armedTrack.id)
      }

      this.emit('recordingStarted')
    }

    if (!this.transportState.isPlaying) {
      this.play()
    }
  }

  async stopRecording(): Promise<void> {
    if (this.transportState.isRecording) {
      this.transportState.isRecording = false
      
      try {
        const recording = await this.recordingManager.stopRecording()
        if (recording) {
          this.emit('recordingCompleted', recording)
        }
      } catch (error) {
        console.error('Recording error:', error)
      }
    }
  }

  toggleLoop(): void {
    this.transportState.loopEnabled = !this.transportState.loopEnabled
    this.emit('loopToggled', this.transportState.loopEnabled)
  }

  setBPM(bpm: number): void {
    this.transportState.bpm = bpm
    this.timelineManager.setTempo(bpm)
    this.emit('bpmChanged', bpm)
  }

  seekTo(time: number): void {
    const wasPlaying = this.transportState.isPlaying
    
    if (wasPlaying) {
      // Stop current playback
      this.pause()
    }
    
    // Update position
    this.transportState.currentTime = time
    this.playbackOffset = time
    this.emit('seeked', time)
    
    // Resume if was playing
    if (wasPlaying) {
      this.play()
    }
  }

  // Track Management
  createTrack(name?: string, type: 'audio' | 'midi' = 'audio'): Track {
    const track = this.trackManager.createTrack({
      name: name || `Track ${this.trackManager.getTracks().length + 1}`,
      type
    })

    // Create channel strip for mixing
    this.mixingConsole.createChannelStrip(track.id, track.name, type)

    this.historyManager.addAction({
      type: 'create-track',
      description: `Created track: ${name}`,
      data: { trackId: track.id, name, type },
      inverse: { action: 'delete-track', trackId: track.id }
    })

    this.emit('trackCreated', track)
    return track
  }

  deleteTrack(trackId: string): void {
    const track = this.trackManager.getTrack(trackId)
    if (!track) return

    this.trackManager.deleteTrack(trackId)
    this.mixingConsole.deleteChannelStrip(trackId)

    this.historyManager.addAction({
      type: 'delete-track',
      description: `Deleted track: ${track.name}`,
      data: { track },
      inverse: { action: 'create-track', name: track.name, type: track.type }
    })

    this.emit('trackDeleted', trackId)
  }

  getTracks(): Track[] {
    return this.trackManager.getTracks()
  }

  updateTrack(trackId: string, updates: Partial<Track>): void {
    this.trackManager.updateTrack(trackId, updates)
    this.emit('trackUpdated', { trackId, updates })
  }

  // Clip Management
  addClipToTrack(trackId: string, clipConfig: Partial<import('./TrackManager').TrackClip>): void {
    const clip = this.trackManager.addClip(trackId, clipConfig)
    
    this.historyManager.addAction({
      type: 'add-clip',
      description: `Added clip: ${clip.name}`,
      data: { trackId, clipId: clip.id },
      inverse: { action: 'remove-clip', trackId, clipId: clip.id }
    })

    this.emit('clipAdded', { trackId, clip })
  }

  removeClipFromTrack(trackId: string, clipId: string): void {
    this.trackManager.removeClip(trackId, clipId)
    
    this.historyManager.addAction({
      type: 'remove-clip',
      description: `Removed clip`,
      data: { trackId, clipId },
      inverse: { action: 'add-clip', trackId, clipId }
    })

    this.emit('clipRemoved', { trackId, clipId })
  }

  updateClip(trackId: string, clipId: string, updates: Partial<import('./TrackManager').TrackClip>): void {
    this.trackManager.updateClip(trackId, clipId, updates)
    this.emit('clipUpdated', { trackId, clipId, updates })
  }

  // Getters for Transport State
  getPlayhead(): number {
    return this.transportState.currentTime
  }

  isPlaying(): boolean {
    return this.transportState.isPlaying
  }

  isRecording(): boolean {
    return this.transportState.isRecording
  }

  getBPM(): number {
    return this.transportState.bpm
  }

  isLooping(): boolean {
    return this.transportState.loopEnabled
  }

  isMetronomeEnabled(): boolean {
    return this.transportState.metronomeEnabled
  }

  // Project Management
  async saveProject(name?: string, userId?: string): Promise<void> {
    const projectData = {
      userId: userId || 'default-user',
      name: name || 'Untitled Project',
      bpm: this.transportState.bpm,
      timeSignature: { numerator: 4, denominator: 4 },
      tracks: this.trackManager.getTracks(),
      markers: this.timelineManager.export().markers || [],
      version: 1
    }

    const projectId = await this.projectManager.saveProject(projectData)

    this.emit('projectSaved', { name, projectId })
  }

  async loadProject(projectId: string): Promise<void> {
    const project = await this.projectManager.loadProject(projectId)
    if (!project) return

    // Clear current state
    this.trackManager.getTracks().forEach(t => this.trackManager.deleteTrack(t.id))

    // Load project data
    if (project.tracks) {
      project.tracks.forEach((trackData: any) => {
        this.trackManager.createTrack(trackData)
      })
    }

    if (project.bpm) {
      this.transportState.bpm = project.bpm
    }

    this.emit('projectLoaded', project)
  }

  // Timeline & Markers
  addMarker(time: number, name: string): void {
    const marker = this.timelineManager.addMarker(time, name)
    this.emit('markerAdded', marker)
  }

  createLoopRegion(startTime: number, endTime: number): void {
    const region = this.timelineManager.createLoopRegion(startTime, endTime)
    this.timelineManager.setActiveLoopRegion(region.id)
    this.emit('loopRegionCreated', region)
  }

  // Effects & Mixing
  addEffectToTrack(trackId: string, effectType: string): void {
    // Effects are managed through the EffectsChain
    // Connect effect to track's routing
    this.emit('effectAdded', { trackId, effectType })
  }

  setTrackVolume(trackId: string, volume: number): void {
    this.trackManager.setVolume(trackId, volume)
    this.mixingConsole.setVolume(trackId, volume)
  }

  setTrackPan(trackId: string, pan: number): void {
    this.trackManager.setPan(trackId, pan)
    this.mixingConsole.setPan(trackId, pan)
  }

  // Effect controls
  setTrackEQ(trackId: string, band: 'low' | 'mid' | 'high', value: number): void {
    const strip = this.mixingConsole.getChannelStrip(trackId)
    if (!strip) return

    // Map UI values (0-1) to frequency/gain values
    let frequency: number
    let gain: number
    
    switch (band) {
      case 'low':
        frequency = 100 + (value * 400) // 100Hz to 500Hz
        gain = (value - 0.5) * 24 // -12dB to +12dB
        break
      case 'mid':
        frequency = 500 + (value * 3500) // 500Hz to 4kHz
        gain = (value - 0.5) * 24
        break
      case 'high':
        frequency = 4000 + (value * 12000) // 4kHz to 16kHz
        gain = (value - 0.5) * 24
        break
    }

    // Update the EQ band in the mixing console
    const bandIndex = band === 'low' ? 0 : band === 'mid' ? 1 : 2
    if (strip.eq[bandIndex]) {
      this.mixingConsole.updateEQBand(trackId, strip.eq[bandIndex].id, { frequency, gain })
    }
    
    this.emit('trackEffectUpdated', { trackId, effect: 'eq', band, value })
  }

  setTrackCompression(trackId: string, value: number): void {
    const strip = this.mixingConsole.getChannelStrip(trackId)
    if (!strip) return

    // Map UI value (0-1) to compression parameters
    const threshold = -40 + (value * 40) // -40dB to 0dB
    const ratio = 1 + (value * 19) // 1:1 to 20:1
    
    this.mixingConsole.updateCompressor(trackId, {
      enabled: value > 0.01,
      threshold,
      ratio,
      attack: 10, // Fixed 10ms attack
      release: 100, // Fixed 100ms release
      knee: 3,
      makeupGain: value * 6 // Auto makeup gain
    })
    
    this.emit('trackEffectUpdated', { trackId, effect: 'compression', value })
  }

  setTrackReverb(trackId: string, value: number): void {
    // Reverb is typically implemented as a send effect
    // For now, we'll add it to the first available send slot
    const strip = this.mixingConsole.getChannelStrip(trackId)
    if (!strip || !strip.sends[0]) return

    this.mixingConsole.updateSend(trackId, strip.sends[0].id, { amount: value })
    
    this.emit('trackEffectUpdated', { trackId, effect: 'reverb', value })
  }

  toggleTrackMute(trackId: string): void {
    this.trackManager.toggleMute(trackId)
    this.mixingConsole.toggleMute(trackId)
  }

  toggleTrackSolo(trackId: string): void {
    this.trackManager.toggleSolo(trackId)
    this.mixingConsole.toggleSolo(trackId)
  }

  // Clip manipulation
  splitClip(trackId: string, clipId: string, splitTime: number): void {
    const track = this.trackManager.getTrack(trackId)
    if (!track) return

    const clipIndex = track.clips.findIndex(c => c.id === clipId)
    if (clipIndex === -1) return

    const clip = track.clips[clipIndex]
    
    // Create two new clips from the split
    const leftClip = {
      ...clip,
      id: `${clip.id}-left`,
      duration: splitTime - clip.startTime,
      name: `${clip.name || 'Clip'} (L)`
    }

    const rightClip = {
      ...clip,
      id: `${clip.id}-right`,
      startTime: splitTime,
      duration: clip.duration - (splitTime - clip.startTime),
      offset: clip.offset + (splitTime - clip.startTime),
      name: `${clip.name || 'Clip'} (R)`
    }

    // Replace original clip with two new clips
    track.clips.splice(clipIndex, 1, leftClip, rightClip)
    
    this.emit('clipSplit', { trackId, originalClipId: clipId, leftClip, rightClip })
  }

  trimClip(trackId: string, clipId: string, newStartTime: number, newDuration: number): void {
    const track = this.trackManager.getTrack(trackId)
    if (!track) return

    const clip = track.clips.find(c => c.id === clipId)
    if (!clip) return

    // Calculate new offset based on trim
    const trimAmount = newStartTime - clip.startTime
    clip.offset += trimAmount
    clip.startTime = newStartTime
    clip.duration = newDuration

    this.emit('clipTrimmed', { trackId, clipId, startTime: newStartTime, duration: newDuration })
  }

  applyClipFade(trackId: string, clipId: string, fadeIn: number, fadeOut: number): void {
    const track = this.trackManager.getTrack(trackId)
    if (!track) return

    const clip = track.clips.find(c => c.id === clipId)
    if (!clip) return

    clip.fadeIn = { duration: fadeIn, curve: 'linear' }
    clip.fadeOut = { duration: fadeOut, curve: 'linear' }

    this.emit('clipFadeApplied', { trackId, clipId, fadeIn, fadeOut })
  }

  deleteClip(trackId: string, clipId: string): void {
    const track = this.trackManager.getTrack(trackId)
    if (!track) return

    const clipIndex = track.clips.findIndex(c => c.id === clipId)
    if (clipIndex !== -1) {
      track.clips.splice(clipIndex, 1)
      this.emit('clipDeleted', { trackId, clipId })
    }
  }

  // Automation
  addAutomationPoint(trackId: string, laneId: string, time: number, value: number): void {
    const track = this.trackManager.getTrack(trackId)
    if (!track) return

    let lane = track.automation.find(l => l.id === laneId)
    
    // Create lane if it doesn't exist
    if (!lane) {
      lane = {
        id: laneId,
        parameter: laneId.split('-').pop() || 'volume',
        points: [],
        visible: true
      }
      track.automation.push(lane)
    }

    // Add point in chronological order
    const point = { time, value, curve: 'linear' as const }
    const insertIndex = lane.points.findIndex(p => p.time > time)
    
    if (insertIndex === -1) {
      lane.points.push(point)
    } else {
      lane.points.splice(insertIndex, 0, point)
    }

    this.emit('automationPointAdded', { trackId, laneId, time, value })
  }

  moveAutomationPoint(trackId: string, laneId: string, pointIndex: number, time: number, value: number): void {
    const track = this.trackManager.getTrack(trackId)
    if (!track) return

    const lane = track.automation.find(l => l.id === laneId)
    if (!lane || !lane.points[pointIndex]) return

    // Update point
    lane.points[pointIndex].time = time
    lane.points[pointIndex].value = value

    // Re-sort points by time
    lane.points.sort((a, b) => a.time - b.time)

    this.emit('automationPointMoved', { trackId, laneId, pointIndex, time, value })
  }

  deleteAutomationPoint(trackId: string, laneId: string, pointIndex: number): void {
    const track = this.trackManager.getTrack(trackId)
    if (!track) return

    const lane = track.automation.find(l => l.id === laneId)
    if (!lane || !lane.points[pointIndex]) return

    lane.points.splice(pointIndex, 1)

    this.emit('automationPointDeleted', { trackId, laneId, pointIndex })
  }

  getAutomationLane(trackId: string, laneId: string) {
    const track = this.trackManager.getTrack(trackId)
    return track?.automation.find(l => l.id === laneId)
  }

  // Project Management
  serializeProject(projectName: string): any {
    const tracks = this.trackManager.getTracks()
    
    return {
      name: projectName,
      version: '1.0',
      bpm: this.transportState.bpm,
      sampleRate: this.audioContext.sampleRate,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      tracks: tracks.map(track => ({
        id: track.id,
        name: track.name,
        type: track.type,
        color: track.color,
        volume: track.volume,
        pan: track.pan,
        muted: track.muted,
        solo: track.solo,
        clips: track.clips.map(clip => ({
          id: clip.id,
          name: clip.name,
          startTime: clip.startTime,
          duration: clip.duration,
          offset: clip.offset,
          fadeIn: clip.fadeIn,
          fadeOut: clip.fadeOut,
          gain: clip.gain,
          // Note: audio buffer not serialized, needs to be reloaded
          bufferUrl: (clip as any).bufferUrl // Store URL if available
        })),
        automation: track.automation.map(lane => ({
          id: lane.id,
          parameter: lane.parameter,
          visible: lane.visible,
          points: lane.points
        }))
      }))
    }
  }

  async deserializeProject(projectData: any): Promise<void> {
    // Clear existing tracks
    const existingTracks = this.trackManager.getTracks()
    existingTracks.forEach(track => {
      this.trackManager.deleteTrack(track.id)
    })

    // Restore BPM
    this.setBPM(projectData.bpm || 120)

    // Restore tracks
    for (const trackData of projectData.tracks) {
      const track = this.trackManager.createTrack({
        id: trackData.id,
        name: trackData.name,
        type: trackData.type,
        color: trackData.color
      })

      // Restore track settings
      this.setTrackVolume(trackData.id, trackData.volume)
      this.setTrackPan(trackData.id, trackData.pan)
      if (trackData.muted) this.toggleTrackMute(trackData.id)
      if (trackData.solo) this.toggleTrackSolo(trackData.id)

      // Restore clips (without audio buffers - need to be reloaded separately)
      track.clips = trackData.clips.map((clipData: any) => ({
        ...clipData,
        trackId: track.id,
        locked: false
      }))

      // Restore automation
      track.automation = trackData.automation.map((laneData: any) => ({
        ...laneData
      }))

      // Create channel strip
      this.mixingConsole.createChannelStrip(track.id, track.name, track.type)
    }

    this.emit('projectLoaded', projectData)
  }

  // MIDI
  createMIDITrack(name: string): void {
    const track = this.midiManager.createMIDITrack(name)
    this.emit('midiTrackCreated', track)
  }

  // Sample Library
  async addSampleFromFile(file: File): Promise<void> {
    const sample = await this.sampleLibrary.addSample(file)
    this.emit('sampleAdded', sample)
  }

  previewSample(sampleId: string): void {
    this.sampleLibrary.previewSample(sampleId)
  }

  // Analysis
  analyzeTrack(trackId: string): void {
    const track = this.trackManager.getTrack(trackId)
    if (!track) return

    // Analyze all clips in track
    track.clips.forEach(clip => {
      if (clip.buffer) {
        const analysis = this.audioAnalyzer.analyzeBuffer(clip.buffer)
        this.emit('trackAnalyzed', { trackId, clipId: clip.id, analysis })
      }
    })
  }

  // Performance
  getPerformanceMetrics() {
    return this.performanceManager.getMetrics()
  }

  // Playback Loop
  private setupPlaybackLoop(): void {
    const loop = () => {
      if (this.transportState.isPlaying) {
        const elapsed = this.audioContext.currentTime - this.playbackStartTime
        this.transportState.currentTime = this.playbackOffset + elapsed

        // Check loop region
        if (this.transportState.loopEnabled) {
          const loopRegion = this.timelineManager.getActiveLoopRegion()
          if (loopRegion && this.transportState.currentTime >= loopRegion.endTime) {
            this.seekTo(loopRegion.startTime)
          }
        }

        this.emit('playheadUpdate', this.transportState.currentTime)
      }

      this.rafId = requestAnimationFrame(loop)
    }

    this.rafId = requestAnimationFrame(loop)
  }

  // Getters
  getAudioContext(): AudioContext {
    return this.audioContext
  }

  getTransportState(): TransportState {
    return { ...this.transportState }
  }

  getTrackManager(): TrackManager {
    return this.trackManager
  }

  getTimelineManager(): TimelineManager {
    return this.timelineManager
  }

  getMixingConsole(): MixingConsole {
    return this.mixingConsole
  }

  getMIDIManager(): MIDIManager {
    return this.midiManager
  }

  getHistoryManager(): HistoryManager {
    return this.historyManager
  }

  getSampleLibrary(): SampleLibraryManager {
    return this.sampleLibrary
  }

  getSelectionManager(): SelectionManager {
    return this.selectionManager
  }

  getKeyboardManager(): KeyboardShortcutManager {
    return this.keyboardManager
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

  private emit(event: string, data?: any): void {
    this.listeners.get(event)?.forEach(callback => callback(data))
  }

  // Cleanup
  dispose(): void {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId)
    }

    this.stop()
    this.audioEngine.dispose()
    this.trackManager.dispose()
    this.timelineManager.dispose()
    this.mixingConsole.dispose()
    this.midiManager.dispose()
    // EffectsChain has no dispose method
    this.recordingManager.dispose()
    // HistoryManager has no dispose method
    // AudioAnalyzer has no dispose method
    this.keyboardManager.dispose()
    this.sampleLibrary.dispose()
    this.selectionManager.dispose()
    this.performanceManager.dispose()
    this.listeners.clear()

    this.audioContext.close()
  }
}
