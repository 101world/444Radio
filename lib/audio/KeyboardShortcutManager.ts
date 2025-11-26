/**
 * Advanced Keyboard Shortcuts & Command Palette System
 * Customizable shortcuts, command palette, context-aware actions
 */

export interface KeyBinding {
  id: string
  key: string // e.g., "Ctrl+S", "Cmd+Shift+P"
  command: string
  context?: string // When this binding is active
  description: string
  category: string
}

export interface Command {
  id: string
  name: string
  description: string
  category: string
  handler: (args?: any) => void | Promise<void>
  enabledWhen?: () => boolean
  icon?: string
}

export interface CommandPaletteItem {
  command: Command
  recentlyUsed: boolean
  matchScore: number
}

export class KeyboardShortcutManager {
  private keyBindings: Map<string, KeyBinding> = new Map()
  private commands: Map<string, Command> = new Map()
  private contexts: Set<string> = new Set()
  private commandHistory: string[] = []
  private maxHistorySize: number = 50
  private listeners: Map<string, Set<Function>> = new Map()

  constructor() {
    this.registerDefaultCommands()
    this.registerDefaultKeybindings()
    this.setupKeyboardListeners()
  }

  // Command Management
  registerCommand(command: Command): void {
    this.commands.set(command.id, command)
    this.emit('commandRegistered', command)
  }

  unregisterCommand(commandId: string): void {
    this.commands.delete(commandId)
    this.emit('commandUnregistered', commandId)
  }

  getCommand(commandId: string): Command | undefined {
    return this.commands.get(commandId)
  }

  getCommands(category?: string): Command[] {
    const commands = Array.from(this.commands.values())
    if (category) {
      return commands.filter(c => c.category === category)
    }
    return commands
  }

  async executeCommand(commandId: string, args?: any): Promise<void> {
    const command = this.commands.get(commandId)
    if (!command) {
      console.warn(`Command not found: ${commandId}`)
      return
    }

    if (command.enabledWhen && !command.enabledWhen()) {
      console.warn(`Command disabled: ${commandId}`)
      return
    }

    this.addToHistory(commandId)
    await command.handler(args)
    this.emit('commandExecuted', { commandId, args })
  }

  // Keybinding Management
  registerKeybinding(binding: KeyBinding): void {
    const key = this.normalizeKey(binding.key)
    this.keyBindings.set(`${key}_${binding.context || 'global'}`, binding)
    this.emit('keybindingRegistered', binding)
  }

  unregisterKeybinding(key: string, context?: string): void {
    const normalizedKey = this.normalizeKey(key)
    this.keyBindings.delete(`${normalizedKey}_${context || 'global'}`)
    this.emit('keybindingUnregistered', { key, context })
  }

  getKeybinding(commandId: string, context?: string): KeyBinding | undefined {
    for (const binding of this.keyBindings.values()) {
      if (binding.command === commandId && (!context || binding.context === context)) {
        return binding
      }
    }
    return undefined
  }

  getKeybindings(): KeyBinding[] {
    return Array.from(this.keyBindings.values())
  }

  // Context Management
  setContext(context: string, active: boolean): void {
    if (active) {
      this.contexts.add(context)
    } else {
      this.contexts.delete(context)
    }
    this.emit('contextChanged', { context, active })
  }

  hasContext(context: string): boolean {
    return this.contexts.has(context)
  }

  // Command Palette
  searchCommands(query: string): CommandPaletteItem[] {
    const lowerQuery = query.toLowerCase()
    const results: CommandPaletteItem[] = []

    this.commands.forEach(command => {
      const nameMatch = command.name.toLowerCase().includes(lowerQuery)
      const descMatch = command.description.toLowerCase().includes(lowerQuery)
      const categoryMatch = command.category.toLowerCase().includes(lowerQuery)

      if (nameMatch || descMatch || categoryMatch) {
        const matchScore = this.calculateMatchScore(command, lowerQuery)
        const recentlyUsed = this.commandHistory.slice(-10).includes(command.id)

        results.push({
          command,
          recentlyUsed,
          matchScore: recentlyUsed ? matchScore + 10 : matchScore
        })
      }
    })

    return results.sort((a, b) => b.matchScore - a.matchScore)
  }

  private calculateMatchScore(command: Command, query: string): number {
    let score = 0

    const nameLower = command.name.toLowerCase()
    const descLower = command.description.toLowerCase()

    // Exact match
    if (nameLower === query) score += 100
    if (nameLower.startsWith(query)) score += 50
    if (nameLower.includes(query)) score += 25

    if (descLower.includes(query)) score += 10

    // Word boundary matches
    const words = query.split(' ')
    words.forEach(word => {
      if (nameLower.includes(word)) score += 5
    })

    return score
  }

  private addToHistory(commandId: string): void {
    this.commandHistory.push(commandId)
    if (this.commandHistory.length > this.maxHistorySize) {
      this.commandHistory.shift()
    }
  }

  getRecentCommands(limit: number = 10): Command[] {
    const recent = this.commandHistory.slice(-limit).reverse()
    const uniqueIds = Array.from(new Set(recent))
    return uniqueIds.map(id => this.commands.get(id)).filter(Boolean) as Command[]
  }

  // Keyboard Event Handling
  private setupKeyboardListeners(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', (e) => this.handleKeyDown(e))
    }
  }

  private handleKeyDown(event: KeyboardEvent): void {
    const key = this.getKeyFromEvent(event)
    const normalizedKey = this.normalizeKey(key)

    // Try context-specific binding first
    for (const context of this.contexts) {
      const binding = this.keyBindings.get(`${normalizedKey}_${context}`)
      if (binding) {
        event.preventDefault()
        this.executeCommand(binding.command)
        return
      }
    }

    // Try global binding
    const globalBinding = this.keyBindings.get(`${normalizedKey}_global`)
    if (globalBinding) {
      event.preventDefault()
      this.executeCommand(globalBinding.command)
    }
  }

  private getKeyFromEvent(event: KeyboardEvent): string {
    const parts: string[] = []

    if (event.ctrlKey || event.metaKey) parts.push('Ctrl')
    if (event.shiftKey) parts.push('Shift')
    if (event.altKey) parts.push('Alt')

    const key = event.key.toUpperCase()
    if (key.length === 1 || ['ENTER', 'SPACE', 'DELETE', 'BACKSPACE', 'TAB', 'ESCAPE'].includes(key)) {
      parts.push(key)
    }

    return parts.join('+')
  }

  private normalizeKey(key: string): string {
    return key
      .replace(/Command/gi, 'Ctrl')
      .replace(/Cmd/gi, 'Ctrl')
      .split('+')
      .map(k => k.trim())
      .sort((a, b) => {
        const order = ['Ctrl', 'Alt', 'Shift']
        const aIndex = order.indexOf(a)
        const bIndex = order.indexOf(b)
        if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex
        if (aIndex !== -1) return -1
        if (bIndex !== -1) return 1
        return 0
      })
      .join('+')
  }

  // Default Commands & Keybindings
  private registerDefaultCommands(): void {
    // File commands
    this.registerCommand({
      id: 'file.new',
      name: 'New Project',
      description: 'Create a new project',
      category: 'File',
      handler: () => this.emit('newProject'),
      icon: '📄'
    })

    this.registerCommand({
      id: 'file.open',
      name: 'Open Project',
      description: 'Open an existing project',
      category: 'File',
      handler: () => this.emit('openProject'),
      icon: '📁'
    })

    this.registerCommand({
      id: 'file.save',
      name: 'Save Project',
      description: 'Save the current project',
      category: 'File',
      handler: () => this.emit('saveProject'),
      icon: '💾'
    })

    this.registerCommand({
      id: 'file.saveAs',
      name: 'Save Project As',
      description: 'Save project with a new name',
      category: 'File',
      handler: () => this.emit('saveProjectAs'),
      icon: '💾'
    })

    this.registerCommand({
      id: 'file.export',
      name: 'Export Audio',
      description: 'Export project as audio file',
      category: 'File',
      handler: () => this.emit('exportAudio'),
      icon: '📤'
    })

    // Edit commands
    this.registerCommand({
      id: 'edit.undo',
      name: 'Undo',
      description: 'Undo last action',
      category: 'Edit',
      handler: () => this.emit('undo'),
      icon: '↶'
    })

    this.registerCommand({
      id: 'edit.redo',
      name: 'Redo',
      description: 'Redo last undone action',
      category: 'Edit',
      handler: () => this.emit('redo'),
      icon: '↷'
    })

    this.registerCommand({
      id: 'edit.cut',
      name: 'Cut',
      description: 'Cut selected items',
      category: 'Edit',
      handler: () => this.emit('cut'),
      icon: '✂️'
    })

    this.registerCommand({
      id: 'edit.copy',
      name: 'Copy',
      description: 'Copy selected items',
      category: 'Edit',
      handler: () => this.emit('copy'),
      icon: '📋'
    })

    this.registerCommand({
      id: 'edit.paste',
      name: 'Paste',
      description: 'Paste items from clipboard',
      category: 'Edit',
      handler: () => this.emit('paste'),
      icon: '📋'
    })

    this.registerCommand({
      id: 'edit.delete',
      name: 'Delete',
      description: 'Delete selected items',
      category: 'Edit',
      handler: () => this.emit('delete'),
      icon: '🗑️'
    })

    this.registerCommand({
      id: 'edit.selectAll',
      name: 'Select All',
      description: 'Select all items in current view',
      category: 'Edit',
      handler: () => this.emit('selectAll'),
      icon: '☑️'
    })

    this.registerCommand({
      id: 'edit.duplicate',
      name: 'Duplicate',
      description: 'Duplicate selected items',
      category: 'Edit',
      handler: () => this.emit('duplicate'),
      icon: '📑'
    })

    // Transport commands
    this.registerCommand({
      id: 'transport.play',
      name: 'Play',
      description: 'Start playback',
      category: 'Transport',
      handler: () => this.emit('play'),
      icon: '▶️'
    })

    this.registerCommand({
      id: 'transport.pause',
      name: 'Pause',
      description: 'Pause playback',
      category: 'Transport',
      handler: () => this.emit('pause'),
      icon: '⏸️'
    })

    this.registerCommand({
      id: 'transport.stop',
      name: 'Stop',
      description: 'Stop playback',
      category: 'Transport',
      handler: () => this.emit('stop'),
      icon: '⏹️'
    })

    this.registerCommand({
      id: 'transport.record',
      name: 'Record',
      description: 'Start/stop recording',
      category: 'Transport',
      handler: () => this.emit('record'),
      icon: '⏺️'
    })

    this.registerCommand({
      id: 'transport.loop',
      name: 'Toggle Loop',
      description: 'Enable/disable loop playback',
      category: 'Transport',
      handler: () => this.emit('toggleLoop'),
      icon: '🔁'
    })

    this.registerCommand({
      id: 'transport.goToStart',
      name: 'Go to Start',
      description: 'Jump to project start',
      category: 'Transport',
      handler: () => this.emit('goToStart'),
      icon: '⏮️'
    })

    this.registerCommand({
      id: 'transport.goToEnd',
      name: 'Go to End',
      description: 'Jump to project end',
      category: 'Transport',
      handler: () => this.emit('goToEnd'),
      icon: '⏭️'
    })

    // Track commands
    this.registerCommand({
      id: 'track.new',
      name: 'New Track',
      description: 'Create a new track',
      category: 'Track',
      handler: () => this.emit('newTrack'),
      icon: '➕'
    })

    this.registerCommand({
      id: 'track.delete',
      name: 'Delete Track',
      description: 'Delete selected track',
      category: 'Track',
      handler: () => this.emit('deleteTrack'),
      icon: '🗑️'
    })

    this.registerCommand({
      id: 'track.duplicate',
      name: 'Duplicate Track',
      description: 'Duplicate selected track',
      category: 'Track',
      handler: () => this.emit('duplicateTrack'),
      icon: '📑'
    })

    this.registerCommand({
      id: 'track.mute',
      name: 'Toggle Mute',
      description: 'Mute/unmute selected track',
      category: 'Track',
      handler: () => this.emit('toggleMute'),
      icon: '🔇'
    })

    this.registerCommand({
      id: 'track.solo',
      name: 'Toggle Solo',
      description: 'Solo/unsolo selected track',
      category: 'Track',
      handler: () => this.emit('toggleSolo'),
      icon: '🎧'
    })

    this.registerCommand({
      id: 'track.arm',
      name: 'Toggle Arm',
      description: 'Arm/disarm selected track for recording',
      category: 'Track',
      handler: () => this.emit('toggleArm'),
      icon: '⏺️'
    })

    // View commands
    this.registerCommand({
      id: 'view.zoomIn',
      name: 'Zoom In',
      description: 'Zoom in on timeline',
      category: 'View',
      handler: () => this.emit('zoomIn'),
      icon: '🔍+'
    })

    this.registerCommand({
      id: 'view.zoomOut',
      name: 'Zoom Out',
      description: 'Zoom out on timeline',
      category: 'View',
      handler: () => this.emit('zoomOut'),
      icon: '🔍-'
    })

    this.registerCommand({
      id: 'view.zoomToFit',
      name: 'Zoom to Fit',
      description: 'Fit entire project in view',
      category: 'View',
      handler: () => this.emit('zoomToFit'),
      icon: '🔍'
    })

    this.registerCommand({
      id: 'view.toggleGrid',
      name: 'Toggle Grid',
      description: 'Show/hide grid snapping',
      category: 'View',
      handler: () => this.emit('toggleGrid'),
      icon: '⊞'
    })

    this.registerCommand({
      id: 'view.toggleMixer',
      name: 'Toggle Mixer',
      description: 'Show/hide mixer panel',
      category: 'View',
      handler: () => this.emit('toggleMixer'),
      icon: '🎚️'
    })

    // Command palette
    this.registerCommand({
      id: 'palette.show',
      name: 'Show Command Palette',
      description: 'Open the command palette',
      category: 'General',
      handler: () => this.emit('showCommandPalette'),
      icon: '⌘'
    })
  }

  private registerDefaultKeybindings(): void {
    // File
    this.registerKeybinding({ id: 'kb1', key: 'Ctrl+N', command: 'file.new', description: 'New Project', category: 'File' })
    this.registerKeybinding({ id: 'kb2', key: 'Ctrl+O', command: 'file.open', description: 'Open Project', category: 'File' })
    this.registerKeybinding({ id: 'kb3', key: 'Ctrl+S', command: 'file.save', description: 'Save Project', category: 'File' })
    this.registerKeybinding({ id: 'kb4', key: 'Ctrl+Shift+S', command: 'file.saveAs', description: 'Save As', category: 'File' })
    this.registerKeybinding({ id: 'kb5', key: 'Ctrl+E', command: 'file.export', description: 'Export', category: 'File' })

    // Edit
    this.registerKeybinding({ id: 'kb6', key: 'Ctrl+Z', command: 'edit.undo', description: 'Undo', category: 'Edit' })
    this.registerKeybinding({ id: 'kb7', key: 'Ctrl+Y', command: 'edit.redo', description: 'Redo', category: 'Edit' })
    this.registerKeybinding({ id: 'kb8', key: 'Ctrl+Shift+Z', command: 'edit.redo', description: 'Redo (Alt)', category: 'Edit' })
    this.registerKeybinding({ id: 'kb9', key: 'Ctrl+X', command: 'edit.cut', description: 'Cut', category: 'Edit' })
    this.registerKeybinding({ id: 'kb10', key: 'Ctrl+C', command: 'edit.copy', description: 'Copy', category: 'Edit' })
    this.registerKeybinding({ id: 'kb11', key: 'Ctrl+V', command: 'edit.paste', description: 'Paste', category: 'Edit' })
    this.registerKeybinding({ id: 'kb12', key: 'DELETE', command: 'edit.delete', description: 'Delete', category: 'Edit' })
    this.registerKeybinding({ id: 'kb13', key: 'Ctrl+A', command: 'edit.selectAll', description: 'Select All', category: 'Edit' })
    this.registerKeybinding({ id: 'kb14', key: 'Ctrl+D', command: 'edit.duplicate', description: 'Duplicate', category: 'Edit' })

    // Transport
    this.registerKeybinding({ id: 'kb15', key: 'SPACE', command: 'transport.play', description: 'Play/Pause', category: 'Transport' })
    this.registerKeybinding({ id: 'kb16', key: 'Ctrl+SPACE', command: 'transport.stop', description: 'Stop', category: 'Transport' })
    this.registerKeybinding({ id: 'kb17', key: 'Ctrl+R', command: 'transport.record', description: 'Record', category: 'Transport' })
    this.registerKeybinding({ id: 'kb18', key: 'Ctrl+L', command: 'transport.loop', description: 'Loop', category: 'Transport' })
    this.registerKeybinding({ id: 'kb19', key: 'Ctrl+ENTER', command: 'transport.goToStart', description: 'To Start', category: 'Transport' })
    this.registerKeybinding({ id: 'kb20', key: 'Ctrl+Shift+ENTER', command: 'transport.goToEnd', description: 'To End', category: 'Transport' })

    // Track
    this.registerKeybinding({ id: 'kb21', key: 'Ctrl+T', command: 'track.new', description: 'New Track', category: 'Track' })
    this.registerKeybinding({ id: 'kb22', key: 'M', command: 'track.mute', description: 'Mute', category: 'Track', context: 'track' })
    this.registerKeybinding({ id: 'kb23', key: 'S', command: 'track.solo', description: 'Solo', category: 'Track', context: 'track' })
    this.registerKeybinding({ id: 'kb24', key: 'R', command: 'track.arm', description: 'Arm', category: 'Track', context: 'track' })

    // View
    this.registerKeybinding({ id: 'kb25', key: 'Ctrl+=', command: 'view.zoomIn', description: 'Zoom In', category: 'View' })
    this.registerKeybinding({ id: 'kb26', key: 'Ctrl+-', command: 'view.zoomOut', description: 'Zoom Out', category: 'View' })
    this.registerKeybinding({ id: 'kb27', key: 'Ctrl+0', command: 'view.zoomToFit', description: 'Zoom to Fit', category: 'View' })
    this.registerKeybinding({ id: 'kb28', key: 'G', command: 'view.toggleGrid', description: 'Toggle Grid', category: 'View' })
    this.registerKeybinding({ id: 'kb29', key: 'Ctrl+M', command: 'view.toggleMixer', description: 'Toggle Mixer', category: 'View' })

    // Command Palette
    this.registerKeybinding({ id: 'kb30', key: 'Ctrl+Shift+P', command: 'palette.show', description: 'Command Palette', category: 'General' })
    this.registerKeybinding({ id: 'kb31', key: 'Ctrl+K', command: 'palette.show', description: 'Command Palette (Alt)', category: 'General' })
  }

  // Export/Import Settings
  exportKeybindings(): any {
    return {
      keybindings: Array.from(this.keyBindings.values())
    }
  }

  importKeybindings(data: any): void {
    if (data.keybindings) {
      this.keyBindings.clear()
      data.keybindings.forEach((binding: KeyBinding) => {
        this.registerKeybinding(binding)
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

  private emit(event: string, data?: any): void {
    this.listeners.get(event)?.forEach(callback => callback(data))
  }

  // Cleanup
  dispose(): void {
    this.commands.clear()
    this.keyBindings.clear()
    this.contexts.clear()
    this.listeners.clear()
  }
}
