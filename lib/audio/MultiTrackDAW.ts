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
  private listeners: Map<string, Set<Function>> = new Map()

  constructor(config: DAWConfig = {}) {
    // Initialize audio context
    this.audioContext = new AudioContext({ sampleRate: config.sampleRate || 48000 })

    // Initialize core systems
    // AudioEngine creates its own context, don't pass ours
    this.audioEngine = new AudioEngine({ sampleRate: config.sampleRate || 48000 })
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

    // Start all tracks
    const tracks = this.trackManager.getTracks()
    tracks.forEach(track => {
      const routingNode = this.trackManager.getRoutingNode(track.id)
      if (routingNode && !track.muted) {
        // Trigger clip playback (simplified - actual implementation would schedule clips)
        track.clips.forEach(clip => {
          const relativeTime = clip.startTime - this.transportState.currentTime
          if (relativeTime >= 0) {
            // Schedule clip playback
          }
        })
      }
    })

    this.emit('play', { time: this.transportState.currentTime })
  }

  pause(): void {
    if (!this.transportState.isPlaying) return

    this.transportState.isPlaying = false
    this.transportState.currentTime = this.audioContext.currentTime - this.playbackStartTime + this.playbackOffset

    this.emit('pause', { time: this.transportState.currentTime })
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
    this.transportState.currentTime = time
    this.playbackOffset = time
    this.emit('seeked', time)
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

  toggleTrackMute(trackId: string): void {
    this.trackManager.toggleMute(trackId)
    this.mixingConsole.toggleMute(trackId)
  }

  toggleTrackSolo(trackId: string): void {
    this.trackManager.toggleSolo(trackId)
    this.mixingConsole.toggleSolo(trackId)
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
