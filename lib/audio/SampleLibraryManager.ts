/**
 * Sample Library Management System
 * Drag-drop samples, preview, tagging, search, favorites, and collections
 */

export interface Sample {
  id: string
  name: string
  filename: string
  url: string
  duration: number
  sampleRate: number
  channels: number
  bitDepth: number
  size: number // bytes
  buffer?: AudioBuffer
  
  // Metadata
  tags: string[]
  category: string
  bpm?: number
  key?: string // Musical key
  genre?: string
  description?: string
  
  // Organization
  collectionId?: string
  favorite: boolean
  dateAdded: Date
  timesUsed: number
  
  // Audio Analysis
  waveformData?: Float32Array
  peakLevel?: number
  rmsLevel?: number
  lufs?: number
  
  // User-defined
  color?: string
  rating?: number // 1-5
}

export interface SampleCollection {
  id: string
  name: string
  description?: string
  sampleIds: string[]
  color: string
  dateCreated: Date
}

export interface SampleSearchFilter {
  query?: string
  category?: string
  tags?: string[]
  minDuration?: number
  maxDuration?: number
  bpmRange?: { min: number; max: number }
  key?: string
  favoriteOnly?: boolean
  collectionId?: string
  sortBy?: 'name' | 'dateAdded' | 'timesUsed' | 'duration' | 'rating'
  sortOrder?: 'asc' | 'desc'
}

export class SampleLibraryManager {
  private samples: Map<string, Sample> = new Map()
  private collections: Map<string, SampleCollection> = new Map()
  private audioContext: AudioContext
  private previewSource?: AudioBufferSourceNode
  private previewGain?: GainNode
  private draggedSample?: Sample
  private listeners: Map<string, Set<Function>> = new Map()

  constructor(audioContext: AudioContext) {
    this.audioContext = audioContext
    this.setupDragAndDrop()
  }

  // Sample Management
  async addSample(file: File, metadata?: Partial<Sample>): Promise<Sample> {
    const arrayBuffer = await file.arrayBuffer()
    const buffer = await this.audioContext.decodeAudioData(arrayBuffer)

    const sample: Sample = {
      id: this.generateId(),
      name: metadata?.name || file.name.replace(/\.[^/.]+$/, ''),
      filename: file.name,
      url: URL.createObjectURL(file),
      duration: buffer.duration,
      sampleRate: buffer.sampleRate,
      channels: buffer.numberOfChannels,
      bitDepth: 16, // Assumption
      size: file.size,
      buffer,
      tags: metadata?.tags || [],
      category: metadata?.category || 'Uncategorized',
      bpm: metadata?.bpm,
      key: metadata?.key,
      genre: metadata?.genre,
      description: metadata?.description,
      collectionId: metadata?.collectionId,
      favorite: metadata?.favorite || false,
      dateAdded: new Date(),
      timesUsed: 0,
      color: metadata?.color,
      rating: metadata?.rating
    }

    // Generate waveform data
    sample.waveformData = this.generateWaveformData(buffer)
    
    // Calculate audio metrics
    const { peak, rms } = this.calculateAudioMetrics(buffer)
    sample.peakLevel = peak
    sample.rmsLevel = rms

    this.samples.set(sample.id, sample)
    this.emit('sampleAdded', sample)
    
    return sample
  }

  async addSampleFromUrl(url: string, metadata?: Partial<Sample>): Promise<Sample> {
    const response = await fetch(url)
    const arrayBuffer = await response.arrayBuffer()
    const buffer = await this.audioContext.decodeAudioData(arrayBuffer)

    const filename = url.split('/').pop() || 'sample.wav'

    const sample: Sample = {
      id: this.generateId(),
      name: metadata?.name || filename.replace(/\.[^/.]+$/, ''),
      filename,
      url,
      duration: buffer.duration,
      sampleRate: buffer.sampleRate,
      channels: buffer.numberOfChannels,
      bitDepth: 16,
      size: arrayBuffer.byteLength,
      buffer,
      tags: metadata?.tags || [],
      category: metadata?.category || 'Uncategorized',
      bpm: metadata?.bpm,
      key: metadata?.key,
      genre: metadata?.genre,
      description: metadata?.description,
      collectionId: metadata?.collectionId,
      favorite: metadata?.favorite || false,
      dateAdded: new Date(),
      timesUsed: 0,
      color: metadata?.color,
      rating: metadata?.rating
    }

    sample.waveformData = this.generateWaveformData(buffer)
    const { peak, rms } = this.calculateAudioMetrics(buffer)
    sample.peakLevel = peak
    sample.rmsLevel = rms

    this.samples.set(sample.id, sample)
    this.emit('sampleAdded', sample)
    
    return sample
  }

  getSample(id: string): Sample | undefined {
    return this.samples.get(id)
  }

  getSamples(): Sample[] {
    return Array.from(this.samples.values())
  }

  updateSample(id: string, updates: Partial<Sample>): void {
    const sample = this.samples.get(id)
    if (!sample) return

    Object.assign(sample, updates)
    this.emit('sampleUpdated', sample)
  }

  deleteSample(id: string): void {
    const sample = this.samples.get(id)
    if (!sample) return

    // Revoke object URL
    if (sample.url.startsWith('blob:')) {
      URL.revokeObjectURL(sample.url)
    }

    // Remove from collections
    this.collections.forEach(collection => {
      collection.sampleIds = collection.sampleIds.filter(sid => sid !== id)
    })

    this.samples.delete(id)
    this.emit('sampleDeleted', id)
  }

  // Search & Filter
  searchSamples(filter: SampleSearchFilter = {}): Sample[] {
    let results = Array.from(this.samples.values())

    // Text search
    if (filter.query) {
      const query = filter.query.toLowerCase()
      results = results.filter(s =>
        s.name.toLowerCase().includes(query) ||
        s.tags.some(t => t.toLowerCase().includes(query)) ||
        s.description?.toLowerCase().includes(query)
      )
    }

    // Category filter
    if (filter.category) {
      results = results.filter(s => s.category === filter.category)
    }

    // Tags filter
    if (filter.tags && filter.tags.length > 0) {
      results = results.filter(s =>
        filter.tags!.some(tag => s.tags.includes(tag))
      )
    }

    // Duration filter
    if (filter.minDuration !== undefined) {
      results = results.filter(s => s.duration >= filter.minDuration!)
    }
    if (filter.maxDuration !== undefined) {
      results = results.filter(s => s.duration <= filter.maxDuration!)
    }

    // BPM filter
    if (filter.bpmRange) {
      results = results.filter(s =>
        s.bpm !== undefined &&
        s.bpm >= filter.bpmRange!.min &&
        s.bpm <= filter.bpmRange!.max
      )
    }

    // Key filter
    if (filter.key) {
      results = results.filter(s => s.key === filter.key)
    }

    // Favorite filter
    if (filter.favoriteOnly) {
      results = results.filter(s => s.favorite)
    }

    // Collection filter
    if (filter.collectionId) {
      results = results.filter(s => s.collectionId === filter.collectionId)
    }

    // Sorting
    if (filter.sortBy) {
      results.sort((a, b) => {
        let aVal: any, bVal: any

        switch (filter.sortBy) {
          case 'name':
            aVal = a.name.toLowerCase()
            bVal = b.name.toLowerCase()
            break
          case 'dateAdded':
            aVal = a.dateAdded.getTime()
            bVal = b.dateAdded.getTime()
            break
          case 'timesUsed':
            aVal = a.timesUsed
            bVal = b.timesUsed
            break
          case 'duration':
            aVal = a.duration
            bVal = b.duration
            break
          case 'rating':
            aVal = a.rating || 0
            bVal = b.rating || 0
            break
          default:
            return 0
        }

        if (filter.sortOrder === 'desc') {
          return bVal > aVal ? 1 : -1
        }
        return aVal > bVal ? 1 : -1
      })
    }

    return results
  }

  getAllTags(): string[] {
    const tags = new Set<string>()
    this.samples.forEach(s => s.tags.forEach(t => tags.add(t)))
    return Array.from(tags).sort()
  }

  getAllCategories(): string[] {
    const categories = new Set<string>()
    this.samples.forEach(s => categories.add(s.category))
    return Array.from(categories).sort()
  }

  // Collection Management
  createCollection(name: string, description?: string): SampleCollection {
    const collection: SampleCollection = {
      id: this.generateId(),
      name,
      description,
      sampleIds: [],
      color: this.getRandomColor(),
      dateCreated: new Date()
    }

    this.collections.set(collection.id, collection)
    this.emit('collectionCreated', collection)
    return collection
  }

  getCollection(id: string): SampleCollection | undefined {
    return this.collections.get(id)
  }

  getCollections(): SampleCollection[] {
    return Array.from(this.collections.values())
  }

  updateCollection(id: string, updates: Partial<SampleCollection>): void {
    const collection = this.collections.get(id)
    if (!collection) return

    Object.assign(collection, updates)
    this.emit('collectionUpdated', collection)
  }

  deleteCollection(id: string): void {
    this.collections.delete(id)
    this.emit('collectionDeleted', id)
  }

  addSampleToCollection(sampleId: string, collectionId: string): void {
    const sample = this.samples.get(sampleId)
    const collection = this.collections.get(collectionId)
    if (!sample || !collection) return

    if (!collection.sampleIds.includes(sampleId)) {
      collection.sampleIds.push(sampleId)
      sample.collectionId = collectionId
      this.emit('sampleAddedToCollection', { sampleId, collectionId })
    }
  }

  removeSampleFromCollection(sampleId: string, collectionId: string): void {
    const sample = this.samples.get(sampleId)
    const collection = this.collections.get(collectionId)
    if (!sample || !collection) return

    collection.sampleIds = collection.sampleIds.filter(id => id !== sampleId)
    if (sample.collectionId === collectionId) {
      sample.collectionId = undefined
    }
    this.emit('sampleRemovedFromCollection', { sampleId, collectionId })
  }

  // Preview Playback
  async previewSample(sampleId: string, volume: number = 0.7): Promise<void> {
    this.stopPreview()

    const sample = this.samples.get(sampleId)
    if (!sample || !sample.buffer) return

    this.previewSource = this.audioContext.createBufferSource()
    this.previewGain = this.audioContext.createGain()

    this.previewSource.buffer = sample.buffer
    this.previewGain.gain.value = volume

    this.previewSource.connect(this.previewGain)
    this.previewGain.connect(this.audioContext.destination)

    this.previewSource.start()
    this.previewSource.onended = () => {
      this.stopPreview()
      this.emit('previewEnded', sampleId)
    }

    this.emit('previewStarted', sampleId)
  }

  stopPreview(): void {
    if (this.previewSource) {
      try {
        this.previewSource.stop()
      } catch (e) {
        // Already stopped
      }
      this.previewSource.disconnect()
      this.previewSource = undefined
    }

    if (this.previewGain) {
      this.previewGain.disconnect()
      this.previewGain = undefined
    }
  }

  // Favorites
  toggleFavorite(sampleId: string): void {
    const sample = this.samples.get(sampleId)
    if (!sample) return

    sample.favorite = !sample.favorite
    this.emit('favoriteToggled', { sampleId, favorite: sample.favorite })
  }

  // Rating
  setRating(sampleId: string, rating: number): void {
    const sample = this.samples.get(sampleId)
    if (!sample) return

    sample.rating = Math.max(0, Math.min(5, rating))
    this.emit('ratingChanged', { sampleId, rating: sample.rating })
  }

  // Usage Tracking
  incrementUsage(sampleId: string): void {
    const sample = this.samples.get(sampleId)
    if (!sample) return

    sample.timesUsed++
    this.emit('usageIncremented', { sampleId, timesUsed: sample.timesUsed })
  }

  // Drag & Drop
  private setupDragAndDrop(): void {
    if (typeof window === 'undefined') return

    window.addEventListener('dragover', (e) => e.preventDefault())
    window.addEventListener('drop', async (e) => {
      e.preventDefault()
      const files = Array.from(e.dataTransfer?.files || [])
      
      for (const file of files) {
        if (file.type.startsWith('audio/')) {
          try {
            await this.addSample(file)
          } catch (error) {
            console.error('Failed to add sample:', error)
          }
        }
      }
    })
  }

  startDrag(sampleId: string): void {
    const sample = this.samples.get(sampleId)
    if (sample) {
      this.draggedSample = sample
      this.emit('dragStarted', sample)
    }
  }

  endDrag(): void {
    if (this.draggedSample) {
      this.emit('dragEnded', this.draggedSample)
      this.draggedSample = undefined
    }
  }

  getDraggedSample(): Sample | undefined {
    return this.draggedSample
  }

  // Audio Analysis
  private generateWaveformData(buffer: AudioBuffer, samples: number = 1000): Float32Array {
    const channelData = buffer.getChannelData(0)
    const blockSize = Math.floor(channelData.length / samples)
    const waveform = new Float32Array(samples)

    for (let i = 0; i < samples; i++) {
      let sum = 0
      for (let j = 0; j < blockSize; j++) {
        const index = i * blockSize + j
        if (index < channelData.length) {
          sum += Math.abs(channelData[index])
        }
      }
      waveform[i] = sum / blockSize
    }

    return waveform
  }

  private calculateAudioMetrics(buffer: AudioBuffer): { peak: number; rms: number } {
    let peak = 0
    let sumSquares = 0
    let totalSamples = 0

    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      const data = buffer.getChannelData(channel)
      
      for (let i = 0; i < data.length; i++) {
        const sample = Math.abs(data[i])
        if (sample > peak) peak = sample
        sumSquares += data[i] * data[i]
        totalSamples++
      }
    }

    const rms = Math.sqrt(sumSquares / totalSamples)
    
    return { peak, rms }
  }

  // Bulk Operations
  async bulkAddSamples(files: File[]): Promise<Sample[]> {
    const samples: Sample[] = []
    
    for (const file of files) {
      try {
        const sample = await this.addSample(file)
        samples.push(sample)
      } catch (error) {
        console.error(`Failed to add ${file.name}:`, error)
      }
    }

    return samples
  }

  bulkDelete(sampleIds: string[]): void {
    sampleIds.forEach(id => this.deleteSample(id))
  }

  bulkAddToCollection(sampleIds: string[], collectionId: string): void {
    sampleIds.forEach(id => this.addSampleToCollection(id, collectionId))
  }

  bulkUpdateTags(sampleIds: string[], tags: string[], mode: 'add' | 'remove' | 'replace'): void {
    sampleIds.forEach(id => {
      const sample = this.samples.get(id)
      if (!sample) return

      switch (mode) {
        case 'add':
          sample.tags = Array.from(new Set([...sample.tags, ...tags]))
          break
        case 'remove':
          sample.tags = sample.tags.filter(t => !tags.includes(t))
          break
        case 'replace':
          sample.tags = [...tags]
          break
      }

      this.emit('sampleUpdated', sample)
    })
  }

  // Utility Methods
  private generateId(): string {
    return `sample_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private getRandomColor(): string {
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7']
    return colors[Math.floor(Math.random() * colors.length)]
  }

  // Export/Import
  exportLibrary(): any {
    return {
      samples: Array.from(this.samples.values()).map(s => ({
        ...s,
        buffer: undefined, // Don't serialize audio buffers
        url: s.url.startsWith('blob:') ? '' : s.url // Don't export blob URLs
      })),
      collections: Array.from(this.collections.values())
    }
  }

  async importLibrary(data: any): Promise<void> {
    if (data.samples) {
      for (const sampleData of data.samples) {
        if (sampleData.url && !sampleData.url.startsWith('blob:')) {
          try {
            await this.addSampleFromUrl(sampleData.url, sampleData)
          } catch (error) {
            console.error('Failed to import sample:', error)
          }
        }
      }
    }

    if (data.collections) {
      data.collections.forEach((c: SampleCollection) => {
        this.collections.set(c.id, c)
      })
    }
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
    this.stopPreview()
    
    this.samples.forEach(sample => {
      if (sample.url.startsWith('blob:')) {
        URL.revokeObjectURL(sample.url)
      }
    })

    this.samples.clear()
    this.collections.clear()
    this.listeners.clear()
  }
}
