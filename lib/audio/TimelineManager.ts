/**
 * Advanced Timeline Management System
 * Handles grid snapping, markers, loop regions, time signatures, and timeline navigation
 */

export interface TimeSignature {
  time: number // In seconds
  numerator: number
  denominator: number
}

export interface Marker {
  id: string
  time: number
  name: string
  color: string
  type: 'marker' | 'region-start' | 'region-end'
}

export interface LoopRegion {
  id: string
  startTime: number
  endTime: number
  name: string
  color: string
  enabled: boolean
}

export interface TempoChange {
  time: number
  bpm: number
  curve: 'instant' | 'linear' | 'exponential'
}

export interface GridSettings {
  enabled: boolean
  division: 'bar' | 'beat' | 'subdivision' | 'custom'
  subdivisions: number // For beat subdivision (1/4, 1/8, 1/16, etc.)
  customInterval?: number // In seconds
}

export interface TimelineViewport {
  startTime: number
  endTime: number
  pixelsPerSecond: number
  scrollLeft: number
  scrollTop: number
}

export class TimelineManager {
  private bpm: number = 120
  private timeSignatures: TimeSignature[] = [{ time: 0, numerator: 4, denominator: 4 }]
  private tempoChanges: TempoChange[] = [{ time: 0, bpm: 120, curve: 'instant' }]
  private markers: Map<string, Marker> = new Map()
  private loopRegions: Map<string, LoopRegion> = new Map()
  private activeLoopRegion?: string
  private gridSettings: GridSettings = {
    enabled: true,
    division: 'beat',
    subdivisions: 4
  }
  private viewport: TimelineViewport = {
    startTime: 0,
    endTime: 60,
    pixelsPerSecond: 50,
    scrollLeft: 0,
    scrollTop: 0
  }
  private listeners: Map<string, Set<Function>> = new Map()

  constructor(bpm: number = 120) {
    this.bpm = bpm
  }

  // Time Signature Management
  setTimeSignature(time: number, numerator: number, denominator: number): void {
    // Remove existing time signature at this time
    this.timeSignatures = this.timeSignatures.filter(ts => ts.time !== time)
    
    // Add new time signature
    this.timeSignatures.push({ time, numerator, denominator })
    this.timeSignatures.sort((a, b) => a.time - b.time)
    
    this.emit('timeSignatureChanged', { time, numerator, denominator })
  }

  getTimeSignatureAt(time: number): TimeSignature {
    // Find the most recent time signature before or at this time
    for (let i = this.timeSignatures.length - 1; i >= 0; i--) {
      if (this.timeSignatures[i].time <= time) {
        return this.timeSignatures[i]
      }
    }
    return this.timeSignatures[0]
  }

  // Tempo Management
  setTempo(bpm: number): void {
    this.bpm = bpm
    this.tempoChanges[0].bpm = bpm
    this.emit('tempoChanged', bpm)
  }

  getTempo(): number {
    return this.bpm
  }

  addTempoChange(time: number, bpm: number, curve: 'instant' | 'linear' | 'exponential' = 'instant'): void {
    this.tempoChanges = this.tempoChanges.filter(tc => tc.time !== time)
    this.tempoChanges.push({ time, bpm, curve })
    this.tempoChanges.sort((a, b) => a.time - b.time)
    this.emit('tempoChangeAdded', { time, bpm, curve })
  }

  removeTempoChange(time: number): void {
    if (time === 0) return // Can't remove initial tempo
    this.tempoChanges = this.tempoChanges.filter(tc => tc.time !== time)
    this.emit('tempoChangeRemoved', time)
  }

  getTempoAt(time: number): number {
    for (let i = this.tempoChanges.length - 1; i >= 0; i--) {
      if (this.tempoChanges[i].time <= time) {
        return this.tempoChanges[i].bpm
      }
    }
    return this.bpm
  }

  // Marker Management
  addMarker(time: number, name: string, color: string = '#4ECDC4'): Marker {
    const marker: Marker = {
      id: this.generateId(),
      time,
      name,
      color,
      type: 'marker'
    }
    this.markers.set(marker.id, marker)
    this.emit('markerAdded', marker)
    return marker
  }

  getMarker(id: string): Marker | undefined {
    return this.markers.get(id)
  }

  getMarkers(): Marker[] {
    return Array.from(this.markers.values()).sort((a, b) => a.time - b.time)
  }

  updateMarker(id: string, updates: Partial<Marker>): void {
    const marker = this.markers.get(id)
    if (!marker) return

    Object.assign(marker, updates)
    this.emit('markerUpdated', marker)
  }

  deleteMarker(id: string): void {
    const marker = this.markers.get(id)
    if (!marker) return

    this.markers.delete(id)
    this.emit('markerDeleted', id)
  }

  getClosestMarker(time: number, maxDistance: number = Infinity): Marker | undefined {
    let closest: Marker | undefined
    let minDistance = maxDistance

    this.markers.forEach(marker => {
      const distance = Math.abs(marker.time - time)
      if (distance < minDistance) {
        minDistance = distance
        closest = marker
      }
    })

    return closest
  }

  // Loop Region Management
  createLoopRegion(startTime: number, endTime: number, name: string = 'Loop Region'): LoopRegion {
    const region: LoopRegion = {
      id: this.generateId(),
      startTime: Math.min(startTime, endTime),
      endTime: Math.max(startTime, endTime),
      name,
      color: '#45B7D1',
      enabled: false
    }
    this.loopRegions.set(region.id, region)
    this.emit('loopRegionCreated', region)
    return region
  }

  getLoopRegion(id: string): LoopRegion | undefined {
    return this.loopRegions.get(id)
  }

  getLoopRegions(): LoopRegion[] {
    return Array.from(this.loopRegions.values())
  }

  updateLoopRegion(id: string, updates: Partial<LoopRegion>): void {
    const region = this.loopRegions.get(id)
    if (!region) return

    Object.assign(region, updates)
    this.emit('loopRegionUpdated', region)
  }

  deleteLoopRegion(id: string): void {
    const region = this.loopRegions.get(id)
    if (!region) return

    if (this.activeLoopRegion === id) {
      this.activeLoopRegion = undefined
    }

    this.loopRegions.delete(id)
    this.emit('loopRegionDeleted', id)
  }

  setActiveLoopRegion(id: string | undefined): void {
    this.activeLoopRegion = id
    this.emit('activeLoopRegionChanged', id)
  }

  getActiveLoopRegion(): LoopRegion | undefined {
    return this.activeLoopRegion ? this.loopRegions.get(this.activeLoopRegion) : undefined
  }

  // Grid Snapping
  setGridSettings(settings: Partial<GridSettings>): void {
    Object.assign(this.gridSettings, settings)
    this.emit('gridSettingsChanged', this.gridSettings)
  }

  getGridSettings(): GridSettings {
    return { ...this.gridSettings }
  }

  snapToGrid(time: number): number {
    if (!this.gridSettings.enabled) return time

    const interval = this.getGridInterval(time)
    return Math.round(time / interval) * interval
  }

  getGridInterval(time: number = 0): number {
    if (this.gridSettings.division === 'custom' && this.gridSettings.customInterval) {
      return this.gridSettings.customInterval
    }

    const timeSignature = this.getTimeSignatureAt(time)
    const bpm = this.getTempoAt(time)
    const beatDuration = 60 / bpm

    switch (this.gridSettings.division) {
      case 'bar':
        return beatDuration * timeSignature.numerator

      case 'beat':
        return beatDuration

      case 'subdivision':
        return beatDuration / this.gridSettings.subdivisions

      default:
        return beatDuration
    }
  }

  // Time Conversions
  secondsToBeats(seconds: number): number {
    let beats = 0
    let currentTime = 0

    for (let i = 0; i < this.tempoChanges.length; i++) {
      const change = this.tempoChanges[i]
      const nextChange = this.tempoChanges[i + 1]
      const endTime = nextChange ? nextChange.time : seconds

      if (seconds <= change.time) break

      const duration = Math.min(endTime, seconds) - Math.max(currentTime, change.time)
      beats += (duration * change.bpm) / 60

      currentTime = endTime
      if (currentTime >= seconds) break
    }

    return beats
  }

  beatsToSeconds(beats: number): number {
    let seconds = 0
    let currentBeats = 0

    for (let i = 0; i < this.tempoChanges.length; i++) {
      const change = this.tempoChanges[i]
      const nextChange = this.tempoChanges[i + 1]

      const beatsAtThisTempo = beats - currentBeats
      const timeAtThisTempo = (beatsAtThisTempo * 60) / change.bpm

      if (!nextChange || seconds + timeAtThisTempo <= nextChange.time) {
        return change.time + timeAtThisTempo
      }

      const beatsToNextChange = ((nextChange.time - change.time) * change.bpm) / 60
      currentBeats += beatsToNextChange
      seconds = nextChange.time
    }

    return seconds
  }

  secondsToBars(seconds: number): { bars: number; beats: number; subdivisions: number } {
    let bars = 0
    let beats = 0
    let currentTime = 0

    for (let i = 0; i < this.timeSignatures.length; i++) {
      const ts = this.timeSignatures[i]
      const nextTs = this.timeSignatures[i + 1]
      const endTime = nextTs ? nextTs.time : seconds

      if (seconds <= ts.time) break

      const duration = Math.min(endTime, seconds) - Math.max(currentTime, ts.time)
      const bpm = this.getTempoAt(currentTime)
      const beatDuration = 60 / bpm
      const barDuration = beatDuration * ts.numerator

      const totalBeats = duration / beatDuration
      bars += Math.floor(totalBeats / ts.numerator)
      beats += totalBeats % ts.numerator

      currentTime = endTime
      if (currentTime >= seconds) break
    }

    const timeSignature = this.getTimeSignatureAt(seconds)
    const subdivisions = (beats % 1) * this.gridSettings.subdivisions

    return {
      bars: Math.floor(bars),
      beats: Math.floor(beats),
      subdivisions: Math.floor(subdivisions)
    }
  }

  formatTime(seconds: number, format: 'seconds' | 'bars' | 'samples' = 'bars', sampleRate: number = 48000): string {
    switch (format) {
      case 'seconds': {
        const mins = Math.floor(seconds / 60)
        const secs = Math.floor(seconds % 60)
        const ms = Math.floor((seconds % 1) * 100)
        return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`
      }

      case 'bars': {
        const { bars, beats, subdivisions } = this.secondsToBars(seconds)
        return `${bars + 1}.${beats + 1}.${subdivisions + 1}`
      }

      case 'samples': {
        return Math.floor(seconds * sampleRate).toString()
      }
    }
  }

  // Viewport Management
  setViewport(viewport: Partial<TimelineViewport>): void {
    Object.assign(this.viewport, viewport)
    this.emit('viewportChanged', this.viewport)
  }

  getViewport(): TimelineViewport {
    return { ...this.viewport }
  }

  zoomIn(factor: number = 1.5, centerTime?: number): void {
    const center = centerTime ?? (this.viewport.startTime + this.viewport.endTime) / 2
    const newPixelsPerSecond = this.viewport.pixelsPerSecond * factor

    this.viewport.pixelsPerSecond = Math.min(newPixelsPerSecond, 1000) // Max zoom

    // Adjust viewport to keep center time in the same position
    const duration = this.viewport.endTime - this.viewport.startTime
    const newDuration = duration / factor
    this.viewport.startTime = center - newDuration / 2
    this.viewport.endTime = center + newDuration / 2

    this.emit('viewportChanged', this.viewport)
  }

  zoomOut(factor: number = 1.5): void {
    this.zoomIn(1 / factor)
  }

  zoomToFit(startTime: number, endTime: number, viewportWidth: number): void {
    this.viewport.startTime = startTime
    this.viewport.endTime = endTime
    this.viewport.pixelsPerSecond = viewportWidth / (endTime - startTime)
    this.emit('viewportChanged', this.viewport)
  }

  scrollTo(time: number): void {
    const duration = this.viewport.endTime - this.viewport.startTime
    this.viewport.startTime = time - duration / 2
    this.viewport.endTime = time + duration / 2
    this.emit('viewportChanged', this.viewport)
  }

  // Utility Methods
  private generateId(): string {
    return `timeline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
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

  // Export/Import
  export(): any {
    return {
      bpm: this.bpm,
      timeSignatures: this.timeSignatures,
      tempoChanges: this.tempoChanges,
      markers: Array.from(this.markers.values()),
      loopRegions: Array.from(this.loopRegions.values()),
      activeLoopRegion: this.activeLoopRegion,
      gridSettings: this.gridSettings
    }
  }

  import(data: any): void {
    this.bpm = data.bpm || 120
    this.timeSignatures = data.timeSignatures || [{ time: 0, numerator: 4, denominator: 4 }]
    this.tempoChanges = data.tempoChanges || [{ time: 0, bpm: this.bpm, curve: 'instant' }]
    
    this.markers.clear()
    if (data.markers) {
      data.markers.forEach((m: Marker) => this.markers.set(m.id, m))
    }

    this.loopRegions.clear()
    if (data.loopRegions) {
      data.loopRegions.forEach((r: LoopRegion) => this.loopRegions.set(r.id, r))
    }

    this.activeLoopRegion = data.activeLoopRegion
    this.gridSettings = data.gridSettings || this.gridSettings

    this.emit('imported', data)
  }

  // Cleanup
  dispose(): void {
    this.markers.clear()
    this.loopRegions.clear()
    this.listeners.clear()
  }
}
