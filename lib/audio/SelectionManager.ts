/**
 * Advanced Selection & Editing Tools
 * Multi-select, lasso selection, ripple editing, group editing, smart snapping
 */

export interface SelectionRegion {
  startTime: number
  endTime: number
  trackIds: string[]
}

export interface Selectable {
  id: string
  type: 'clip' | 'note' | 'marker' | 'automation-point'
  trackId: string
  startTime: number
  endTime?: number
  selected: boolean
  locked: boolean
}

export interface ClipSelection extends Selectable {
  type: 'clip'
  clipId: string
}

export interface NoteSelection extends Selectable {
  type: 'note'
  noteId: string
  pitch: number
}

export interface RippleEditMode {
  enabled: boolean
  affectLockedTracks: boolean
  affectMarkers: boolean
}

export interface SmartSnapSettings {
  enabled: boolean
  snapToGrid: boolean
  snapToClips: boolean
  snapToMarkers: boolean
  snapDistance: number // pixels
}

export class SelectionManager {
  private selected: Map<string, Selectable> = new Map()
  private clipboard: Selectable[] = []
  private selectionHistory: Selectable[][] = []
  private rippleMode: RippleEditMode = {
    enabled: false,
    affectLockedTracks: false,
    affectMarkers: true
  }
  private snapSettings: SmartSnapSettings = {
    enabled: true,
    snapToGrid: true,
    snapToClips: true,
    snapToMarkers: true,
    snapDistance: 10
  }
  private listeners: Map<string, Set<Function>> = new Map()
  private lassoActive: boolean = false
  private lassoStart?: { x: number; y: number }
  private lassoEnd?: { x: number; y: number }

  constructor() {
    this.setupKeyboardShortcuts()
  }

  // Selection Management
  select(item: Selectable, additive: boolean = false): void {
    if (!additive) {
      this.clearSelection()
    }

    item.selected = true
    this.selected.set(item.id, item)
    this.emit('selectionChanged', this.getSelection())
  }

  deselect(itemId: string): void {
    const item = this.selected.get(itemId)
    if (item) {
      item.selected = false
      this.selected.delete(itemId)
      this.emit('selectionChanged', this.getSelection())
    }
  }

  toggleSelection(item: Selectable): void {
    if (this.selected.has(item.id)) {
      this.deselect(item.id)
    } else {
      this.select(item, true)
    }
  }

  selectAll(items: Selectable[]): void {
    this.clearSelection()
    items.forEach(item => {
      if (!item.locked) {
        item.selected = true
        this.selected.set(item.id, item)
      }
    })
    this.emit('selectionChanged', this.getSelection())
  }

  selectRange(startTime: number, endTime: number, trackIds?: string[]): void {
    // This would be implemented with actual track/clip data
    // For now, emit event for consumer to handle
    this.emit('rangeSelectionRequested', { startTime, endTime, trackIds })
  }

  clearSelection(): void {
    this.selected.forEach(item => item.selected = false)
    this.selected.clear()
    this.emit('selectionChanged', [])
  }

  getSelection(): Selectable[] {
    return Array.from(this.selected.values())
  }

  isSelected(itemId: string): boolean {
    return this.selected.has(itemId)
  }

  hasSelection(): boolean {
    return this.selected.size > 0
  }

  getSelectionCount(): number {
    return this.selected.size
  }

  // Multi-Track Selection
  selectInTracks(trackIds: string[], items: Selectable[]): void {
    this.clearSelection()
    const trackIdSet = new Set(trackIds)
    
    items.forEach(item => {
      if (trackIdSet.has(item.trackId) && !item.locked) {
        item.selected = true
        this.selected.set(item.id, item)
      }
    })
    
    this.emit('selectionChanged', this.getSelection())
  }

  selectByType(type: Selectable['type'], items: Selectable[]): void {
    this.clearSelection()
    
    items.forEach(item => {
      if (item.type === type && !item.locked) {
        item.selected = true
        this.selected.set(item.id, item)
      }
    })
    
    this.emit('selectionChanged', this.getSelection())
  }

  // Lasso Selection
  startLasso(x: number, y: number): void {
    this.lassoActive = true
    this.lassoStart = { x, y }
    this.lassoEnd = { x, y }
    this.emit('lassoStarted', this.lassoStart)
  }

  updateLasso(x: number, y: number): void {
    if (!this.lassoActive || !this.lassoStart) return
    
    this.lassoEnd = { x, y }
    this.emit('lassoUpdated', { start: this.lassoStart, end: this.lassoEnd })
  }

  endLasso(items: Selectable[], itemBounds: Map<string, { x: number; y: number; width: number; height: number }>): void {
    if (!this.lassoActive || !this.lassoStart || !this.lassoEnd) return

    const minX = Math.min(this.lassoStart.x, this.lassoEnd.x)
    const maxX = Math.max(this.lassoStart.x, this.lassoEnd.x)
    const minY = Math.min(this.lassoStart.y, this.lassoEnd.y)
    const maxY = Math.max(this.lassoStart.y, this.lassoEnd.y)

    items.forEach(item => {
      const bounds = itemBounds.get(item.id)
      if (!bounds || item.locked) return

      const itemCenterX = bounds.x + bounds.width / 2
      const itemCenterY = bounds.y + bounds.height / 2

      if (itemCenterX >= minX && itemCenterX <= maxX &&
          itemCenterY >= minY && itemCenterY <= maxY) {
        item.selected = true
        this.selected.set(item.id, item)
      }
    })

    this.lassoActive = false
    this.lassoStart = undefined
    this.lassoEnd = undefined
    
    this.emit('lassoEnded')
    this.emit('selectionChanged', this.getSelection())
  }

  // Clipboard Operations
  copy(): void {
    this.clipboard = Array.from(this.selected.values()).map(item => ({ ...item }))
    this.emit('copied', this.clipboard.length)
  }

  cut(): void {
    this.copy()
    this.emit('cutRequested', this.getSelection())
  }

  paste(offsetTime: number = 0): void {
    if (this.clipboard.length === 0) return

    const pastedItems = this.clipboard.map(item => ({
      ...item,
      id: this.generateId(),
      startTime: item.startTime + offsetTime,
      endTime: item.endTime ? item.endTime + offsetTime : undefined,
      selected: true
    }))

    this.clearSelection()
    pastedItems.forEach(item => this.selected.set(item.id, item))
    
    this.emit('pasteRequested', pastedItems)
    this.emit('selectionChanged', this.getSelection())
  }

  duplicate(): void {
    if (this.selected.size === 0) return

    const duplicated = Array.from(this.selected.values()).map(item => {
      const duration = item.endTime ? item.endTime - item.startTime : 1
      return {
        ...item,
        id: this.generateId(),
        startTime: item.startTime + duration,
        endTime: item.endTime ? item.endTime + duration : undefined,
        selected: true
      }
    })

    this.clearSelection()
    duplicated.forEach(item => this.selected.set(item.id, item))
    
    this.emit('duplicateRequested', duplicated)
    this.emit('selectionChanged', this.getSelection())
  }

  delete(): void {
    if (this.selected.size === 0) return

    const toDelete = this.getSelection()
    this.emit('deleteRequested', toDelete)
    this.clearSelection()
  }

  // Ripple Editing
  setRippleMode(enabled: boolean): void {
    this.rippleMode.enabled = enabled
    this.emit('rippleModeChanged', this.rippleMode)
  }

  getRippleMode(): RippleEditMode {
    return { ...this.rippleMode }
  }

  moveWithRipple(delta: number, affectedItems: Selectable[]): void {
    if (!this.rippleMode.enabled) return

    const selectedItems = this.getSelection()
    const minTime = Math.min(...selectedItems.map(item => item.startTime))

    // Move items after the selection
    affectedItems.forEach(item => {
      if (item.locked && !this.rippleMode.affectLockedTracks) return
      if (item.startTime >= minTime && !this.isSelected(item.id)) {
        item.startTime += delta
        if (item.endTime) item.endTime += delta
      }
    })

    this.emit('rippleEditApplied', { delta, affectedCount: affectedItems.length })
  }

  // Smart Snapping
  setSnapSettings(settings: Partial<SmartSnapSettings>): void {
    Object.assign(this.snapSettings, settings)
    this.emit('snapSettingsChanged', this.snapSettings)
  }

  getSnapSettings(): SmartSnapSettings {
    return { ...this.snapSettings }
  }

  snapTime(
    time: number,
    gridInterval: number,
    nearbyClips?: Selectable[],
    markers?: { time: number }[]
  ): number {
    if (!this.snapSettings.enabled) return time

    const candidates: number[] = []

    // Grid snapping
    if (this.snapSettings.snapToGrid) {
      const snappedToGrid = Math.round(time / gridInterval) * gridInterval
      candidates.push(snappedToGrid)
    }

    // Clip snapping
    if (this.snapSettings.snapToClips && nearbyClips) {
      nearbyClips.forEach(clip => {
        if (!this.isSelected(clip.id)) {
          candidates.push(clip.startTime)
          if (clip.endTime) candidates.push(clip.endTime)
        }
      })
    }

    // Marker snapping
    if (this.snapSettings.snapToMarkers && markers) {
      markers.forEach(marker => candidates.push(marker.time))
    }

    // Find closest snap point within snap distance
    let bestSnap = time
    let minDistance = Infinity

    candidates.forEach(candidate => {
      const distance = Math.abs(candidate - time)
      if (distance < minDistance && distance <= this.snapSettings.snapDistance / 50) { // Convert pixels to time
        minDistance = distance
        bestSnap = candidate
      }
    })

    return bestSnap
  }

  // Group Operations
  nudgeSelection(delta: number): void {
    if (this.selected.size === 0) return

    const items = this.getSelection()
    items.forEach(item => {
      item.startTime += delta
      if (item.endTime) item.endTime += delta
    })

    this.emit('nudgeApplied', { delta, count: items.length })
    this.emit('selectionChanged', items)
  }

  scaleSelection(factor: number, pivotTime: number): void {
    if (this.selected.size === 0) return

    const items = this.getSelection()
    items.forEach(item => {
      const relativeStart = item.startTime - pivotTime
      item.startTime = pivotTime + relativeStart * factor
      
      if (item.endTime) {
        const relativeEnd = item.endTime - pivotTime
        item.endTime = pivotTime + relativeEnd * factor
      }
    })

    this.emit('scaleApplied', { factor, pivot: pivotTime, count: items.length })
    this.emit('selectionChanged', items)
  }

  quantizeSelection(gridInterval: number, strength: number = 1.0): void {
    if (this.selected.size === 0) return

    const items = this.getSelection()
    items.forEach(item => {
      const quantized = Math.round(item.startTime / gridInterval) * gridInterval
      item.startTime = item.startTime + (quantized - item.startTime) * strength
    })

    this.emit('quantizeApplied', { gridInterval, strength, count: items.length })
    this.emit('selectionChanged', items)
  }

  alignSelection(mode: 'start' | 'end' | 'center', targetTime?: number): void {
    if (this.selected.size === 0) return

    const items = this.getSelection()
    
    if (targetTime === undefined) {
      // Align to the first selected item
      const first = items[0]
      targetTime = mode === 'end' && first.endTime 
        ? first.endTime 
        : mode === 'center' && first.endTime
        ? (first.startTime + first.endTime) / 2
        : first.startTime
    }

    items.forEach(item => {
      const duration = item.endTime ? item.endTime - item.startTime : 0

      switch (mode) {
        case 'start':
          item.startTime = targetTime!
          if (item.endTime) item.endTime = targetTime! + duration
          break
        case 'end':
          if (item.endTime) {
            item.endTime = targetTime!
            item.startTime = targetTime! - duration
          }
          break
        case 'center':
          const center = targetTime!
          item.startTime = center - duration / 2
          if (item.endTime) item.endTime = center + duration / 2
          break
      }
    })

    this.emit('alignApplied', { mode, targetTime, count: items.length })
    this.emit('selectionChanged', items)
  }

  // Selection History
  saveSelectionState(): void {
    this.selectionHistory.push(this.getSelection().map(item => ({ ...item })))
    if (this.selectionHistory.length > 50) {
      this.selectionHistory.shift()
    }
  }

  restorePreviousSelection(): void {
    const previous = this.selectionHistory.pop()
    if (!previous) return

    this.clearSelection()
    previous.forEach(item => this.selected.set(item.id, item))
    this.emit('selectionChanged', this.getSelection())
  }

  // Box Selection (rectangular region)
  selectBox(
    minTime: number,
    maxTime: number,
    minTrack: number,
    maxTrack: number,
    items: Selectable[],
    trackIndices: Map<string, number>
  ): void {
    this.clearSelection()

    items.forEach(item => {
      if (item.locked) return

      const trackIndex = trackIndices.get(item.trackId)
      if (trackIndex === undefined) return

      const itemOverlaps = 
        item.startTime < maxTime &&
        (item.endTime === undefined || item.endTime > minTime) &&
        trackIndex >= minTrack &&
        trackIndex <= maxTrack

      if (itemOverlaps) {
        item.selected = true
        this.selected.set(item.id, item)
      }
    })

    this.emit('selectionChanged', this.getSelection())
  }

  // Utility Methods
  private generateId(): string {
    return `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private setupKeyboardShortcuts(): void {
    if (typeof window === 'undefined') return

    window.addEventListener('keydown', (e) => {
      // Delete
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (this.hasSelection()) {
          e.preventDefault()
          this.delete()
        }
      }

      // Copy
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        if (this.hasSelection()) {
          e.preventDefault()
          this.copy()
        }
      }

      // Cut
      if ((e.ctrlKey || e.metaKey) && e.key === 'x') {
        if (this.hasSelection()) {
          e.preventDefault()
          this.cut()
        }
      }

      // Paste
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        e.preventDefault()
        this.paste()
      }

      // Duplicate
      if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        if (this.hasSelection()) {
          e.preventDefault()
          this.duplicate()
        }
      }

      // Nudge
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        if (this.hasSelection()) {
          const delta = (e.key === 'ArrowRight' ? 1 : -1) * (e.shiftKey ? 0.1 : 0.01)
          this.nudgeSelection(delta)
        }
      }
    })
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
    this.clearSelection()
    this.clipboard = []
    this.selectionHistory = []
    this.listeners.clear()
  }
}
