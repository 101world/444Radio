/**
 * MIDI Management System
 * Piano roll, MIDI recording, editing, virtual instruments, and MIDI device I/O
 */

export interface MIDINote {
  id: string
  trackId: string
  pitch: number // 0-127 (MIDI note number)
  velocity: number // 0-127
  startTime: number // In seconds
  duration: number // In seconds
  selected: boolean
}

export interface MIDIControlChange {
  id: string
  trackId: string
  time: number
  controller: number // 0-127
  value: number // 0-127
}

export interface MIDIProgramChange {
  trackId: string
  time: number
  program: number // 0-127
}

export interface MIDITrack {
  id: string
  name: string
  channel: number // 0-15
  instrument: VirtualInstrument
  notes: MIDINote[]
  controlChanges: MIDIControlChange[]
  programChanges: MIDIProgramChange[]
  muted: boolean
  solo: boolean
  volume: number // 0-1
  pan: number // -1 to 1
}

export interface VirtualInstrument {
  id: string
  name: string
  type: 'synth' | 'sampler' | 'drum-machine'
  preset?: string
  oscillators?: OscillatorConfig[]
  envelope?: EnvelopeConfig
  filter?: FilterConfig
  samples?: Map<number, AudioBuffer> // MIDI note -> sample
}

export interface OscillatorConfig {
  type: OscillatorType
  detune: number
  volume: number
}

export interface EnvelopeConfig {
  attack: number // seconds
  decay: number // seconds
  sustain: number // 0-1
  release: number // seconds
}

export interface FilterConfig {
  type: BiquadFilterType
  frequency: number
  q: number
  envelope?: EnvelopeConfig
}

export interface PianoRollSettings {
  noteHeight: number // pixels per note
  pixelsPerBeat: number
  snapEnabled: boolean
  snapDivision: number // 1/4, 1/8, 1/16, etc.
  showVelocity: boolean
  showNoteNames: boolean
  lowNote: number // Lowest visible MIDI note
  highNote: number // Highest visible MIDI note
}

export class MIDIManager {
  private tracks: Map<string, MIDITrack> = new Map()
  private audioContext: AudioContext
  private midiAccess?: MIDIAccess
  private inputDevices: Map<string, MIDIInput> = new Map()
  private outputDevices: Map<string, MIDIOutput> = new Map()
  private isRecording: boolean = false
  private recordingTrackId?: string
  private recordingStartTime: number = 0
  private pianoRollSettings: PianoRollSettings = {
    noteHeight: 12,
    pixelsPerBeat: 100,
    snapEnabled: true,
    snapDivision: 16,
    showVelocity: true,
    showNoteNames: true,
    lowNote: 21, // A0
    highNote: 108 // C8
  }
  private listeners: Map<string, Set<Function>> = new Map()
  private activeNotes: Map<string, { oscillators: OscillatorNode[]; gainNode: GainNode }> = new Map()

  constructor(audioContext: AudioContext) {
    this.audioContext = audioContext
    this.initializeMIDI()
  }

  // MIDI Device Management
  private async initializeMIDI(): Promise<void> {
    try {
      this.midiAccess = await navigator.requestMIDIAccess()
      
      // Setup input devices
      this.midiAccess.inputs.forEach(input => {
        this.inputDevices.set(input.id, input)
        input.onmidimessage = (e) => this.handleMIDIMessage(e)
      })

      // Setup output devices
      this.midiAccess.outputs.forEach(output => {
        this.outputDevices.set(output.id, output)
      })

      this.emit('midiInitialized', {
        inputs: Array.from(this.inputDevices.keys()),
        outputs: Array.from(this.outputDevices.keys())
      })
    } catch (error) {
      console.error('MIDI initialization failed:', error)
      this.emit('midiError', error)
    }
  }

  getMIDIInputs(): { id: string; name: string }[] {
    return Array.from(this.inputDevices.values()).map(input => ({
      id: input.id || '',
      name: input.name || 'Unknown'
    }))
  }

  getMIDIOutputs(): { id: string; name: string }[] {
    return Array.from(this.outputDevices.values()).map(output => ({
      id: output.id || '',
      name: output.name || 'Unknown'
    }))
  }

  private handleMIDIMessage(event: MIDIMessageEvent): void {
    if (!event.data || event.data.length < 1) return
    
    const status = event.data[0]
    const data1 = event.data[1] || 0
    const data2 = event.data[2] || 0
    const command = status >> 4
    const channel = status & 0x0f

    switch (command) {
      case 0x9: // Note On
        if (data2 > 0) {
          this.handleNoteOn(channel, data1, data2, event.timeStamp)
        } else {
          this.handleNoteOff(channel, data1, event.timeStamp)
        }
        break

      case 0x8: // Note Off
        this.handleNoteOff(channel, data1, event.timeStamp)
        break

      case 0xB: // Control Change
        this.handleControlChange(channel, data1, data2, event.timeStamp)
        break

      case 0xC: // Program Change
        this.handleProgramChange(channel, data1, event.timeStamp)
        break
    }
  }

  private handleNoteOn(channel: number, pitch: number, velocity: number, timestamp: number): void {
    this.emit('noteOn', { channel, pitch, velocity, timestamp })

    if (this.isRecording && this.recordingTrackId) {
      const time = (timestamp - this.recordingStartTime) / 1000
      this.startRecordingNote(this.recordingTrackId, pitch, velocity, time)
    }

    // Play the note using virtual instrument
    const track = Array.from(this.tracks.values()).find(t => t.channel === channel)
    if (track) {
      this.playNote(track.id, pitch, velocity / 127)
    }
  }

  private handleNoteOff(channel: number, pitch: number, timestamp: number): void {
    this.emit('noteOff', { channel, pitch, timestamp })

    if (this.isRecording && this.recordingTrackId) {
      const time = (timestamp - this.recordingStartTime) / 1000
      this.endRecordingNote(this.recordingTrackId, pitch, time)
    }

    // Stop the note
    const track = Array.from(this.tracks.values()).find(t => t.channel === channel)
    if (track) {
      this.stopNote(track.id, pitch)
    }
  }

  private handleControlChange(channel: number, controller: number, value: number, timestamp: number): void {
    this.emit('controlChange', { channel, controller, value, timestamp })

    if (this.isRecording && this.recordingTrackId) {
      const time = (timestamp - this.recordingStartTime) / 1000
      const cc: MIDIControlChange = {
        id: this.generateId(),
        trackId: this.recordingTrackId,
        time,
        controller,
        value
      }
      
      const track = this.tracks.get(this.recordingTrackId)
      if (track) {
        track.controlChanges.push(cc)
      }
    }
  }

  private handleProgramChange(channel: number, program: number, timestamp: number): void {
    this.emit('programChange', { channel, program, timestamp })
  }

  // MIDI Track Management
  createMIDITrack(name: string, channel: number = 0): MIDITrack {
    const track: MIDITrack = {
      id: this.generateId(),
      name,
      channel,
      instrument: this.createDefaultInstrument(),
      notes: [],
      controlChanges: [],
      programChanges: [],
      muted: false,
      solo: false,
      volume: 0.8,
      pan: 0
    }

    this.tracks.set(track.id, track)
    this.emit('trackCreated', track)
    return track
  }

  getMIDITrack(id: string): MIDITrack | undefined {
    return this.tracks.get(id)
  }

  getMIDITracks(): MIDITrack[] {
    return Array.from(this.tracks.values())
  }

  updateMIDITrack(id: string, updates: Partial<MIDITrack>): void {
    const track = this.tracks.get(id)
    if (!track) return

    Object.assign(track, updates)
    this.emit('trackUpdated', track)
  }

  deleteMIDITrack(id: string): void {
    this.tracks.delete(id)
    this.emit('trackDeleted', id)
  }

  // MIDI Note Management
  addNote(trackId: string, pitch: number, velocity: number, startTime: number, duration: number): MIDINote {
    const track = this.tracks.get(trackId)
    if (!track) throw new Error('Track not found')

    const note: MIDINote = {
      id: this.generateId(),
      trackId,
      pitch,
      velocity,
      startTime,
      duration,
      selected: false
    }

    track.notes.push(note)
    track.notes.sort((a, b) => a.startTime - b.startTime)
    
    this.emit('noteAdded', note)
    return note
  }

  getNote(trackId: string, noteId: string): MIDINote | undefined {
    const track = this.tracks.get(trackId)
    return track?.notes.find(n => n.id === noteId)
  }

  getNotes(trackId: string, startTime?: number, endTime?: number): MIDINote[] {
    const track = this.tracks.get(trackId)
    if (!track) return []

    let notes = track.notes

    if (startTime !== undefined) {
      notes = notes.filter(n => n.startTime + n.duration >= startTime)
    }

    if (endTime !== undefined) {
      notes = notes.filter(n => n.startTime <= endTime)
    }

    return notes
  }

  updateNote(trackId: string, noteId: string, updates: Partial<MIDINote>): void {
    const track = this.tracks.get(trackId)
    if (!track) return

    const note = track.notes.find(n => n.id === noteId)
    if (!note) return

    Object.assign(note, updates)
    
    if (updates.startTime !== undefined) {
      track.notes.sort((a, b) => a.startTime - b.startTime)
    }

    this.emit('noteUpdated', note)
  }

  deleteNote(trackId: string, noteId: string): void {
    const track = this.tracks.get(trackId)
    if (!track) return

    track.notes = track.notes.filter(n => n.id !== noteId)
    this.emit('noteDeleted', { trackId, noteId })
  }

  deleteNotes(trackId: string, noteIds: string[]): void {
    const track = this.tracks.get(trackId)
    if (!track) return

    const idsSet = new Set(noteIds)
    track.notes = track.notes.filter(n => !idsSet.has(n.id))
    this.emit('notesDeleted', { trackId, noteIds })
  }

  // MIDI Recording
  startRecording(trackId: string): void {
    this.isRecording = true
    this.recordingTrackId = trackId
    this.recordingStartTime = performance.now()
    this.emit('recordingStarted', trackId)
  }

  stopRecording(): void {
    this.isRecording = false
    this.recordingTrackId = undefined
    this.emit('recordingStopped', {})
  }

  private startRecordingNote(trackId: string, pitch: number, velocity: number, time: number): void {
    // Note will be completed when note off is received
    const note: MIDINote = {
      id: this.generateId(),
      trackId,
      pitch,
      velocity,
      startTime: time,
      duration: 0, // Will be set on note off
      selected: false
    }

    const track = this.tracks.get(trackId)
    if (track) {
      track.notes.push(note)
    }
  }

  private endRecordingNote(trackId: string, pitch: number, time: number): void {
    const track = this.tracks.get(trackId)
    if (!track) return

    // Find the most recent note with this pitch and zero duration
    for (let i = track.notes.length - 1; i >= 0; i--) {
      const note = track.notes[i]
      if (note.pitch === pitch && note.duration === 0) {
        note.duration = time - note.startTime
        this.emit('noteRecorded', note)
        break
      }
    }
  }

  // Piano Roll Settings
  setPianoRollSettings(settings: Partial<PianoRollSettings>): void {
    Object.assign(this.pianoRollSettings, settings)
    this.emit('pianoRollSettingsChanged', this.pianoRollSettings)
  }

  getPianoRollSettings(): PianoRollSettings {
    return { ...this.pianoRollSettings }
  }

  snapTime(time: number, bpm: number): number {
    if (!this.pianoRollSettings.snapEnabled) return time

    const beatDuration = 60 / bpm
    const snapInterval = beatDuration / this.pianoRollSettings.snapDivision
    return Math.round(time / snapInterval) * snapInterval
  }

  // Virtual Instrument Management
  private createDefaultInstrument(): VirtualInstrument {
    return {
      id: 'default-synth',
      name: 'Default Synth',
      type: 'synth',
      oscillators: [
        { type: 'sine', detune: 0, volume: 0.8 }
      ],
      envelope: {
        attack: 0.01,
        decay: 0.1,
        sustain: 0.5,
        release: 0.3
      },
      filter: {
        type: 'lowpass',
        frequency: 2000,
        q: 1,
        envelope: {
          attack: 0.1,
          decay: 0.2,
          sustain: 0.3,
          release: 0.5
        }
      }
    }
  }

  setInstrument(trackId: string, instrument: VirtualInstrument): void {
    const track = this.tracks.get(trackId)
    if (!track) return

    track.instrument = instrument
    this.emit('instrumentChanged', { trackId, instrument })
  }

  // Note Playback
  playNote(trackId: string, pitch: number, velocity: number = 1.0, duration?: number): void {
    const track = this.tracks.get(trackId)
    if (!track || track.muted) return

    const instrument = track.instrument
    const frequency = this.midiNoteToFrequency(pitch)

    if (instrument.type === 'synth') {
      this.playSynthNote(trackId, frequency, velocity, duration, instrument)
    } else if (instrument.type === 'sampler') {
      this.playSamplerNote(trackId, pitch, velocity, duration, instrument)
    }
  }

  private playSynthNote(
    trackId: string,
    frequency: number,
    velocity: number,
    duration: number | undefined,
    instrument: VirtualInstrument
  ): void {
    const now = this.audioContext.currentTime
    const envelope = instrument.envelope!

    // Create oscillators
    const oscillators: OscillatorNode[] = []
    const gainNode = this.audioContext.createGain()
    
    instrument.oscillators?.forEach(oscConfig => {
      const osc = this.audioContext.createOscillator()
      const oscGain = this.audioContext.createGain()
      
      osc.type = oscConfig.type
      osc.frequency.value = frequency
      osc.detune.value = oscConfig.detune
      oscGain.gain.value = oscConfig.volume
      
      osc.connect(oscGain)
      oscGain.connect(gainNode)
      oscillators.push(osc)
    })

    // Apply filter if present
    let output: AudioNode = gainNode
    if (instrument.filter) {
      const filter = this.audioContext.createBiquadFilter()
      filter.type = instrument.filter.type
      filter.frequency.value = instrument.filter.frequency
      filter.Q.value = instrument.filter.q
      
      gainNode.connect(filter)
      output = filter
    }

    // Connect to destination
    const track = this.tracks.get(trackId)
    const masterGain = this.audioContext.createGain()
    masterGain.gain.value = velocity * (track?.volume || 1)
    
    output.connect(masterGain)
    masterGain.connect(this.audioContext.destination)

    // ADSR Envelope
    gainNode.gain.setValueAtTime(0, now)
    gainNode.gain.linearRampToValueAtTime(velocity, now + envelope.attack)
    gainNode.gain.linearRampToValueAtTime(velocity * envelope.sustain, now + envelope.attack + envelope.decay)

    if (duration) {
      gainNode.gain.setValueAtTime(velocity * envelope.sustain, now + duration)
      gainNode.gain.linearRampToValueAtTime(0, now + duration + envelope.release)
    }

    // Start oscillators
    oscillators.forEach(osc => osc.start(now))

    if (duration) {
      oscillators.forEach(osc => osc.stop(now + duration + envelope.release))
    }

    // Store active note
    const noteKey = `${trackId}_${frequency}`
    this.activeNotes.set(noteKey, { oscillators, gainNode })

    // Cleanup
    if (duration) {
      setTimeout(() => {
        this.activeNotes.delete(noteKey)
      }, (duration + envelope.release) * 1000)
    }
  }

  private playSamplerNote(
    trackId: string,
    pitch: number,
    velocity: number,
    duration: number | undefined,
    instrument: VirtualInstrument
  ): void {
    const buffer = instrument.samples?.get(pitch)
    if (!buffer) return

    const source = this.audioContext.createBufferSource()
    const gainNode = this.audioContext.createGain()
    
    source.buffer = buffer
    gainNode.gain.value = velocity

    const track = this.tracks.get(trackId)
    gainNode.gain.value *= track?.volume || 1

    source.connect(gainNode)
    gainNode.connect(this.audioContext.destination)

    source.start()
    if (duration) {
      source.stop(this.audioContext.currentTime + duration)
    }
  }

  stopNote(trackId: string, pitch: number): void {
    const frequency = this.midiNoteToFrequency(pitch)
    const noteKey = `${trackId}_${frequency}`
    const activeNote = this.activeNotes.get(noteKey)

    if (!activeNote) return

    const now = this.audioContext.currentTime
    const track = this.tracks.get(trackId)
    const envelope = track?.instrument.envelope

    if (envelope) {
      activeNote.gainNode.gain.cancelScheduledValues(now)
      activeNote.gainNode.gain.setValueAtTime(activeNote.gainNode.gain.value, now)
      activeNote.gainNode.gain.linearRampToValueAtTime(0, now + envelope.release)
      
      activeNote.oscillators.forEach(osc => {
        osc.stop(now + envelope.release)
      })

      setTimeout(() => {
        this.activeNotes.delete(noteKey)
      }, envelope.release * 1000)
    } else {
      activeNote.oscillators.forEach(osc => osc.stop())
      this.activeNotes.delete(noteKey)
    }
  }

  stopAllNotes(trackId?: string): void {
    this.activeNotes.forEach((note, key) => {
      if (!trackId || key.startsWith(trackId)) {
        note.oscillators.forEach(osc => {
          try {
            osc.stop()
          } catch (e) {
            // Ignore if already stopped
          }
        })
      }
    })

    if (trackId) {
      Array.from(this.activeNotes.keys())
        .filter(key => key.startsWith(trackId))
        .forEach(key => this.activeNotes.delete(key))
    } else {
      this.activeNotes.clear()
    }
  }

  // MIDI Utilities
  midiNoteToFrequency(midiNote: number): number {
    return 440 * Math.pow(2, (midiNote - 69) / 12)
  }

  frequencyToMIDINote(frequency: number): number {
    return Math.round(69 + 12 * Math.log2(frequency / 440))
  }

  midiNoteToName(midiNote: number): string {
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
    const octave = Math.floor(midiNote / 12) - 1
    const noteName = noteNames[midiNote % 12]
    return `${noteName}${octave}`
  }

  // Quantization
  quantizeNotes(trackId: string, gridDivision: number, strength: number = 1.0, bpm: number = 120): void {
    const track = this.tracks.get(trackId)
    if (!track) return

    const beatDuration = 60 / bpm
    const quantizeInterval = beatDuration / gridDivision

    track.notes.forEach(note => {
      const quantizedStart = Math.round(note.startTime / quantizeInterval) * quantizeInterval
      note.startTime = note.startTime + (quantizedStart - note.startTime) * strength
    })

    track.notes.sort((a, b) => a.startTime - b.startTime)
    this.emit('notesQuantized', trackId)
  }

  // Utility Methods
  private generateId(): string {
    return `midi_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
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

  // Cleanup
  dispose(): void {
    this.stopAllNotes()
    this.tracks.clear()
    this.inputDevices.clear()
    this.outputDevices.clear()
    this.listeners.clear()
  }
}
