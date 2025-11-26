/**
 * Comping & Takes Management System
 * Multiple takes per track, smart comping, playlist editing
 */

export interface Take {
  id: string
  trackId: string
  name: string
  audioBuffer?: AudioBuffer
  url?: string
  startTime: number
  duration: number
  recordedAt: Date
  rating?: number // 1-5
  color?: string
  muted: boolean
  locked: boolean
  regions: CompRegion[]
}

export interface CompRegion {
  id: string
  takeId: string
  startTime: number // Relative to take
  endTime: number // Relative to take
  selected: boolean
  fadeIn: number // Duration in seconds
  fadeOut: number // Duration in seconds
  gain: number // 0-1
}

export interface CompTrack {
  id: string
  trackId: string
  name: string
  takes: Take[]
  activeTakeId?: string
  compRegions: CompRegion[] // Final composition
  playlistMode: boolean
}

export interface CompSession {
  id: string
  projectId: string
  compTracks: Map<string, CompTrack>
  selectedTakeId?: string
  selectedRegionIds: Set<string>
}

export class CompingManager {
  private session?: CompSession
  private audioContext: AudioContext
  private listeners: Map<string, Set<Function>> = new Map()

  constructor(audioContext: AudioContext) {
    this.audioContext = audioContext
  }

  // Session Management
  createSession(projectId: string): CompSession {
    this.session = {
      id: this.generateId(),
      projectId,
      compTracks: new Map(),
      selectedRegionIds: new Set()
    }

    this.emit('sessionCreated', this.session)
    return this.session
  }

  getSession(): CompSession | undefined {
    return this.session
  }

  // Comp Track Management
  createCompTrack(trackId: string, name: string): CompTrack {
    if (!this.session) throw new Error('No active session')

    const compTrack: CompTrack = {
      id: this.generateId(),
      trackId,
      name,
      takes: [],
      compRegions: [],
      playlistMode: false
    }

    this.session.compTracks.set(compTrack.id, compTrack)
    this.emit('compTrackCreated', compTrack)
    
    return compTrack
  }

  getCompTrack(compTrackId: string): CompTrack | undefined {
    return this.session?.compTracks.get(compTrackId)
  }

  getCompTracks(): CompTrack[] {
    if (!this.session) return []
    return Array.from(this.session.compTracks.values())
  }

  deleteCompTrack(compTrackId: string): void {
    if (!this.session) return

    this.session.compTracks.delete(compTrackId)
    this.emit('compTrackDeleted', compTrackId)
  }

  // Take Management
  async addTake(
    compTrackId: string,
    audioSource: AudioBuffer | string,
    options?: Partial<Take>
  ): Promise<Take> {
    const compTrack = this.getCompTrack(compTrackId)
    if (!compTrack) throw new Error('Comp track not found')

    let audioBuffer: AudioBuffer | undefined
    let url: string | undefined

    if (typeof audioSource === 'string') {
      url = audioSource
      // Load buffer from URL
      const response = await fetch(audioSource)
      const arrayBuffer = await response.arrayBuffer()
      audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer)
    } else {
      audioBuffer = audioSource
    }

    const take: Take = {
      id: this.generateId(),
      trackId: compTrack.trackId,
      name: options?.name || `Take ${compTrack.takes.length + 1}`,
      audioBuffer,
      url,
      startTime: options?.startTime ?? 0,
      duration: audioBuffer.duration,
      recordedAt: new Date(),
      rating: options?.rating,
      color: options?.color || this.getRandomColor(),
      muted: options?.muted ?? false,
      locked: options?.locked ?? false,
      regions: []
    }

    compTrack.takes.push(take)

    // Set as active if it's the first take
    if (compTrack.takes.length === 1) {
      compTrack.activeTakeId = take.id
    }

    this.emit('takeAdded', { compTrackId, take })
    return take
  }

  getTake(compTrackId: string, takeId: string): Take | undefined {
    const compTrack = this.getCompTrack(compTrackId)
    return compTrack?.takes.find(t => t.id === takeId)
  }

  updateTake(compTrackId: string, takeId: string, updates: Partial<Take>): void {
    const take = this.getTake(compTrackId, takeId)
    if (!take) return

    Object.assign(take, updates)
    this.emit('takeUpdated', { compTrackId, take })
  }

  deleteTake(compTrackId: string, takeId: string): void {
    const compTrack = this.getCompTrack(compTrackId)
    if (!compTrack) return

    compTrack.takes = compTrack.takes.filter(t => t.id !== takeId)

    // Clear active take if it was deleted
    if (compTrack.activeTakeId === takeId) {
      compTrack.activeTakeId = compTrack.takes[0]?.id
    }

    this.emit('takeDeleted', { compTrackId, takeId })
  }

  setActiveTake(compTrackId: string, takeId: string): void {
    const compTrack = this.getCompTrack(compTrackId)
    if (!compTrack) return

    compTrack.activeTakeId = takeId
    this.emit('activeTakeChanged', { compTrackId, takeId })
  }

  rateTake(compTrackId: string, takeId: string, rating: number): void {
    const take = this.getTake(compTrackId, takeId)
    if (!take) return

    take.rating = Math.max(1, Math.min(5, rating))
    this.emit('takeRated', { compTrackId, takeId, rating: take.rating })
  }

  // Comp Region Management
  createCompRegion(
    compTrackId: string,
    takeId: string,
    startTime: number,
    endTime: number
  ): CompRegion {
    const take = this.getTake(compTrackId, takeId)
    if (!take) throw new Error('Take not found')

    const region: CompRegion = {
      id: this.generateId(),
      takeId,
      startTime: Math.max(0, startTime),
      endTime: Math.min(take.duration, endTime),
      selected: false,
      fadeIn: 0.01,
      fadeOut: 0.01,
      gain: 1.0
    }

    take.regions.push(region)
    this.emit('compRegionCreated', { compTrackId, region })
    
    return region
  }

  updateCompRegion(
    compTrackId: string,
    regionId: string,
    updates: Partial<CompRegion>
  ): void {
    const compTrack = this.getCompTrack(compTrackId)
    if (!compTrack) return

    for (const take of compTrack.takes) {
      const region = take.regions.find(r => r.id === regionId)
      if (region) {
        Object.assign(region, updates)
        this.emit('compRegionUpdated', { compTrackId, region })
        return
      }
    }
  }

  deleteCompRegion(compTrackId: string, regionId: string): void {
    const compTrack = this.getCompTrack(compTrackId)
    if (!compTrack) return

    for (const take of compTrack.takes) {
      const index = take.regions.findIndex(r => r.id === regionId)
      if (index !== -1) {
        take.regions.splice(index, 1)
        this.emit('compRegionDeleted', { compTrackId, regionId })
        return
      }
    }
  }

  // Comping Operations
  selectRegion(compTrackId: string, regionId: string, additive: boolean = false): void {
    if (!this.session) return

    if (!additive) {
      this.session.selectedRegionIds.clear()
    }

    this.session.selectedRegionIds.add(regionId)
    this.emit('regionSelected', { compTrackId, regionId })
  }

  deselectRegion(regionId: string): void {
    if (!this.session) return

    this.session.selectedRegionIds.delete(regionId)
    this.emit('regionDeselected', regionId)
  }

  clearSelection(): void {
    if (!this.session) return

    this.session.selectedRegionIds.clear()
    this.emit('selectionCleared', {})
  }

  splitRegion(compTrackId: string, regionId: string, splitTime: number): CompRegion[] {
    const compTrack = this.getCompTrack(compTrackId)
    if (!compTrack) return []

    for (const take of compTrack.takes) {
      const regionIndex = take.regions.findIndex(r => r.id === regionId)
      if (regionIndex !== -1) {
        const original = take.regions[regionIndex]

        if (splitTime <= original.startTime || splitTime >= original.endTime) {
          return [original]
        }

        // Create two new regions
        const region1: CompRegion = {
          ...original,
          id: this.generateId(),
          endTime: splitTime,
          fadeOut: 0.01
        }

        const region2: CompRegion = {
          ...original,
          id: this.generateId(),
          startTime: splitTime,
          fadeIn: 0.01
        }

        take.regions.splice(regionIndex, 1, region1, region2)
        this.emit('regionSplit', { compTrackId, original, region1, region2 })
        
        return [region1, region2]
      }
    }

    return []
  }

  mergeRegions(compTrackId: string, regionIds: string[]): CompRegion | undefined {
    if (regionIds.length < 2) return

    const compTrack = this.getCompTrack(compTrackId)
    if (!compTrack) return

    // Find all regions and their take
    const regions: { region: CompRegion; take: Take }[] = []
    
    for (const take of compTrack.takes) {
      for (const regionId of regionIds) {
        const region = take.regions.find(r => r.id === regionId)
        if (region) {
          regions.push({ region, take })
        }
      }
    }

    if (regions.length !== regionIds.length) return
    if (new Set(regions.map(r => r.take.id)).size > 1) return // Must be same take

    // Sort by start time
    regions.sort((a, b) => a.region.startTime - b.region.startTime)

    // Create merged region
    const take = regions[0].take
    const merged: CompRegion = {
      id: this.generateId(),
      takeId: take.id,
      startTime: regions[0].region.startTime,
      endTime: regions[regions.length - 1].region.endTime,
      selected: false,
      fadeIn: regions[0].region.fadeIn,
      fadeOut: regions[regions.length - 1].region.fadeOut,
      gain: Math.max(...regions.map(r => r.region.gain))
    }

    // Remove old regions
    take.regions = take.regions.filter(r => !regionIds.includes(r.id))
    take.regions.push(merged)

    this.emit('regionsMerged', { compTrackId, merged })
    return merged
  }

  // Smart Comping
  autoCompByRating(compTrackId: string, minRating: number = 3): CompRegion[] {
    const compTrack = this.getCompTrack(compTrackId)
    if (!compTrack) return []

    const highRatedTakes = compTrack.takes
      .filter(t => t.rating !== undefined && t.rating >= minRating)
      .sort((a, b) => (b.rating || 0) - (a.rating || 0))

    const regions: CompRegion[] = []

    // Create regions for entire takes
    highRatedTakes.forEach(take => {
      const region = this.createCompRegion(compTrackId, take.id, 0, take.duration)
      regions.push(region)
    })

    compTrack.compRegions = regions
    this.emit('autoCompCompleted', { compTrackId, regions })
    
    return regions
  }

  findBestTakeForRegion(compTrackId: string, startTime: number, endTime: number): Take | undefined {
    const compTrack = this.getCompTrack(compTrackId)
    if (!compTrack) return

    // Score takes based on rating and coverage
    const scores = compTrack.takes.map(take => {
      let score = 0

      // Rating score (0-5)
      if (take.rating) score += take.rating

      // Coverage score (how well it covers the time range)
      const coverage = Math.min(endTime, take.startTime + take.duration) - Math.max(startTime, take.startTime)
      if (coverage > 0) {
        score += (coverage / (endTime - startTime)) * 3
      }

      return { take, score }
    })

    scores.sort((a, b) => b.score - a.score)
    return scores[0]?.take
  }

  // Playlist Mode
  togglePlaylistMode(compTrackId: string): void {
    const compTrack = this.getCompTrack(compTrackId)
    if (!compTrack) return

    compTrack.playlistMode = !compTrack.playlistMode
    this.emit('playlistModeToggled', { compTrackId, enabled: compTrack.playlistMode })
  }

  cycleTakes(compTrackId: string, direction: 'next' | 'previous' = 'next'): void {
    const compTrack = this.getCompTrack(compTrackId)
    if (!compTrack || compTrack.takes.length === 0) return

    const currentIndex = compTrack.takes.findIndex(t => t.id === compTrack.activeTakeId)
    
    let nextIndex: number
    if (direction === 'next') {
      nextIndex = (currentIndex + 1) % compTrack.takes.length
    } else {
      nextIndex = (currentIndex - 1 + compTrack.takes.length) % compTrack.takes.length
    }

    this.setActiveTake(compTrackId, compTrack.takes[nextIndex].id)
  }

  // Export Final Comp
  async exportComp(compTrackId: string): Promise<AudioBuffer> {
    const compTrack = this.getCompTrack(compTrackId)
    if (!compTrack) throw new Error('Comp track not found')

    // Find the longest duration
    const maxDuration = Math.max(
      ...compTrack.takes.map(t => t.startTime + t.duration)
    )

    // Create output buffer
    const outputBuffer = this.audioContext.createBuffer(
      2,
      Math.ceil(maxDuration * this.audioContext.sampleRate),
      this.audioContext.sampleRate
    )

    // Render each comp region
    for (const region of compTrack.compRegions) {
      const take = compTrack.takes.find(t => t.id === region.takeId)
      if (!take || !take.audioBuffer) continue

      // Copy audio data with fades and gain
      this.renderRegionToBuffer(outputBuffer, take.audioBuffer, region)
    }

    return outputBuffer
  }

  private renderRegionToBuffer(
    output: AudioBuffer,
    source: AudioBuffer,
    region: CompRegion
  ): void {
    const sampleRate = this.audioContext.sampleRate
    const startSample = Math.floor(region.startTime * sampleRate)
    const endSample = Math.floor(region.endTime * sampleRate)
    const fadeInSamples = Math.floor(region.fadeIn * sampleRate)
    const fadeOutSamples = Math.floor(region.fadeOut * sampleRate)

    for (let channel = 0; channel < Math.min(output.numberOfChannels, source.numberOfChannels); channel++) {
      const outputData = output.getChannelData(channel)
      const sourceData = source.getChannelData(channel)

      for (let i = startSample; i < endSample && i < sourceData.length; i++) {
        let sample = sourceData[i] * region.gain

        // Apply fade in
        const relativePos = i - startSample
        if (relativePos < fadeInSamples) {
          sample *= relativePos / fadeInSamples
        }

        // Apply fade out
        const fromEnd = endSample - i
        if (fromEnd < fadeOutSamples) {
          sample *= fromEnd / fadeOutSamples
        }

        // Mix with existing audio (add)
        if (i < outputData.length) {
          outputData[i] += sample
        }
      }
    }
  }

  // Utility Methods
  private generateId(): string {
    return `comp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private getRandomColor(): string {
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7']
    return colors[Math.floor(Math.random() * colors.length)]
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
    this.session = undefined
    this.listeners.clear()
  }
}
