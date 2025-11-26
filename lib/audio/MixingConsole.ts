/**
 * Professional Mixing Console
 * Channel strips, sends/returns, busses, insert effects, and automation
 */

export interface ChannelStrip {
  id: string
  trackId: string
  name: string
  type: 'audio' | 'midi' | 'bus' | 'master'
  
  // Input Section
  inputGain: number // 0-2 (unity at 1)
  inputPhase: boolean // Phase invert
  
  // Dynamics Section
  gate: GateSettings
  compressor: CompressorSettings
  
  // EQ Section
  eq: EQBand[]
  
  // Insert Effects
  inserts: InsertSlot[]
  
  // Sends Section
  sends: SendSlot[]
  
  // Fader Section
  volume: number // 0-1
  pan: number // -1 to 1
  muted: boolean
  solo: boolean
  
  // Metering
  inputLevel: number
  outputLevel: number
  reductionLevel: number // For dynamics
  
  // Routing
  outputBus: string
}

export interface GateSettings {
  enabled: boolean
  threshold: number // dB
  ratio: number
  attack: number // ms
  release: number // ms
  range: number // dB
}

export interface CompressorSettings {
  enabled: boolean
  threshold: number // dB
  ratio: number
  attack: number // ms
  release: number // ms
  knee: number // dB
  makeupGain: number // dB
}

export interface EQBand {
  id: string
  enabled: boolean
  type: 'lowpass' | 'highpass' | 'lowshelf' | 'highshelf' | 'peaking' | 'notch'
  frequency: number // Hz
  gain: number // dB (for peaking/shelf types)
  q: number // Quality factor
}

export interface InsertSlot {
  id: string
  position: number // 0-7
  effectId?: string
  enabled: boolean
  preFader: boolean
}

export interface SendSlot {
  id: string
  destination: string // Bus ID
  amount: number // 0-1
  preFader: boolean
  muted: boolean
  panFollow: boolean
}

export interface Bus {
  id: string
  name: string
  type: 'aux' | 'group' | 'master'
  channelStrip: ChannelStrip
  inputTracks: string[] // Track IDs feeding into this bus
  color: string
}

export interface AutomationData {
  trackId: string
  parameter: string
  points: { time: number; value: number }[]
  mode: 'read' | 'write' | 'touch' | 'latch' | 'off'
}

export class MixingConsole {
  private channels: Map<string, ChannelStrip> = new Map()
  private busses: Map<string, Bus> = new Map()
  private automationData: Map<string, AutomationData[]> = new Map()
  private audioContext: AudioContext
  private masterChannel?: ChannelStrip
  private listeners: Map<string, Set<Function>> = new Map()
  
  // Audio Nodes per channel
  private channelNodes: Map<string, {
    inputGain: GainNode
    gate?: DynamicsCompressorNode
    compressor?: DynamicsCompressorNode
    eqNodes: BiquadFilterNode[]
    insertChain?: GainNode
    sendNodes: Map<string, GainNode>
    outputGain: GainNode
    pan: StereoPannerNode
    analyser: AnalyserNode
  }> = new Map()

  constructor(audioContext: AudioContext) {
    this.audioContext = audioContext
    this.initializeMasterChannel()
  }

  // Channel Strip Management
  createChannelStrip(trackId: string, name: string, type: ChannelStrip['type'] = 'audio'): ChannelStrip {
    const channel: ChannelStrip = {
      id: this.generateId(),
      trackId,
      name,
      type,
      inputGain: 1.0,
      inputPhase: false,
      gate: {
        enabled: false,
        threshold: -40,
        ratio: 4,
        attack: 1,
        release: 100,
        range: -80
      },
      compressor: {
        enabled: false,
        threshold: -20,
        ratio: 4,
        attack: 5,
        release: 100,
        knee: 3,
        makeupGain: 0
      },
      eq: this.createDefaultEQ(),
      inserts: Array.from({ length: 8 }, (_, i) => ({
        id: `insert_${i}`,
        position: i,
        enabled: false,
        preFader: i < 4
      })),
      sends: [],
      volume: 0.8,
      pan: 0,
      muted: false,
      solo: false,
      inputLevel: 0,
      outputLevel: 0,
      reductionLevel: 0,
      outputBus: 'master'
    }

    this.channels.set(channel.id, channel)
    this.createChannelNodes(channel)
    this.emit('channelCreated', channel)
    
    return channel
  }

  getChannelStrip(id: string): ChannelStrip | undefined {
    return this.channels.get(id)
  }

  getChannelStrips(): ChannelStrip[] {
    return Array.from(this.channels.values())
  }

  updateChannelStrip(id: string, updates: Partial<ChannelStrip>): void {
    const channel = this.channels.get(id)
    if (!channel) return

    Object.assign(channel, updates)
    this.updateChannelNodes(channel)
    this.emit('channelUpdated', channel)
  }

  deleteChannelStrip(id: string): void {
    const channel = this.channels.get(id)
    if (!channel) return

    this.disconnectChannelNodes(id)
    this.channels.delete(id)
    this.emit('channelDeleted', id)
  }

  // Input Section
  setInputGain(channelId: string, gain: number): void {
    const channel = this.channels.get(channelId)
    const nodes = this.channelNodes.get(channelId)
    if (!channel || !nodes) return

    channel.inputGain = Math.max(0, Math.min(2, gain))
    nodes.inputGain.gain.value = channel.inputGain
    this.emit('inputGainChanged', { channelId, gain: channel.inputGain })
  }

  togglePhase(channelId: string): void {
    const channel = this.channels.get(channelId)
    const nodes = this.channelNodes.get(channelId)
    if (!channel || !nodes) return

    channel.inputPhase = !channel.inputPhase
    nodes.inputGain.gain.value = channel.inputPhase ? -channel.inputGain : channel.inputGain
    this.emit('phaseToggled', { channelId, inverted: channel.inputPhase })
  }

  // Gate & Compression
  updateGate(channelId: string, settings: Partial<GateSettings>): void {
    const channel = this.channels.get(channelId)
    if (!channel) return

    Object.assign(channel.gate, settings)
    this.updateDynamicsProcessing(channelId)
    this.emit('gateUpdated', { channelId, gate: channel.gate })
  }

  updateCompressor(channelId: string, settings: Partial<CompressorSettings>): void {
    const channel = this.channels.get(channelId)
    if (!channel) return

    Object.assign(channel.compressor, settings)
    this.updateDynamicsProcessing(channelId)
    this.emit('compressorUpdated', { channelId, compressor: channel.compressor })
  }

  private updateDynamicsProcessing(channelId: string): void {
    const channel = this.channels.get(channelId)
    const nodes = this.channelNodes.get(channelId)
    if (!channel || !nodes) return

    // Update compressor node
    if (channel.compressor.enabled && nodes.compressor) {
      nodes.compressor.threshold.value = channel.compressor.threshold
      nodes.compressor.ratio.value = channel.compressor.ratio
      nodes.compressor.attack.value = channel.compressor.attack / 1000
      nodes.compressor.release.value = channel.compressor.release / 1000
      nodes.compressor.knee.value = channel.compressor.knee
    }
  }

  // EQ Section
  private createDefaultEQ(): EQBand[] {
    return [
      { id: 'eq1', enabled: true, type: 'highpass', frequency: 80, gain: 0, q: 0.707 },
      { id: 'eq2', enabled: false, type: 'lowshelf', frequency: 100, gain: 0, q: 0.707 },
      { id: 'eq3', enabled: false, type: 'peaking', frequency: 400, gain: 0, q: 1.0 },
      { id: 'eq4', enabled: false, type: 'peaking', frequency: 2500, gain: 0, q: 1.0 },
      { id: 'eq5', enabled: false, type: 'highshelf', frequency: 8000, gain: 0, q: 0.707 },
      { id: 'eq6', enabled: true, type: 'lowpass', frequency: 18000, gain: 0, q: 0.707 }
    ]
  }

  updateEQBand(channelId: string, bandId: string, settings: Partial<EQBand>): void {
    const channel = this.channels.get(channelId)
    if (!channel) return

    const band = channel.eq.find(b => b.id === bandId)
    if (!band) return

    Object.assign(band, settings)
    this.updateEQNodes(channelId)
    this.emit('eqBandUpdated', { channelId, bandId, band })
  }

  private updateEQNodes(channelId: string): void {
    const channel = this.channels.get(channelId)
    const nodes = this.channelNodes.get(channelId)
    if (!channel || !nodes) return

    channel.eq.forEach((band, index) => {
      const node = nodes.eqNodes[index]
      if (!node) return

      if (!band.enabled) {
        node.gain.value = 0
        return
      }

      node.type = band.type
      node.frequency.value = band.frequency
      node.Q.value = band.q
      
      if (band.type === 'peaking' || band.type === 'lowshelf' || band.type === 'highshelf') {
        node.gain.value = band.gain
      }
    })
  }

  // Insert Effects
  setInsertEffect(channelId: string, slotPosition: number, effectId: string): void {
    const channel = this.channels.get(channelId)
    if (!channel) return

    const insert = channel.inserts.find(i => i.position === slotPosition)
    if (!insert) return

    insert.effectId = effectId
    insert.enabled = true
    
    this.emit('insertEffectSet', { channelId, slotPosition, effectId })
  }

  toggleInsert(channelId: string, slotPosition: number): void {
    const channel = this.channels.get(channelId)
    if (!channel) return

    const insert = channel.inserts.find(i => i.position === slotPosition)
    if (!insert) return

    insert.enabled = !insert.enabled
    this.emit('insertToggled', { channelId, slotPosition, enabled: insert.enabled })
  }

  // Send Management
  addSend(channelId: string, destinationBusId: string, amount: number = 0): void {
    const channel = this.channels.get(channelId)
    const nodes = this.channelNodes.get(channelId)
    if (!channel || !nodes) return

    const send: SendSlot = {
      id: this.generateId(),
      destination: destinationBusId,
      amount,
      preFader: false,
      muted: false,
      panFollow: false
    }

    channel.sends.push(send)
    
    // Create send node
    const sendGain = this.audioContext.createGain()
    sendGain.gain.value = amount
    nodes.sendNodes.set(send.id, sendGain)

    // Connect to bus
    const bus = this.busses.get(destinationBusId)
    if (bus) {
      const busNodes = this.channelNodes.get(bus.channelStrip.id)
      if (busNodes) {
        sendGain.connect(busNodes.inputGain)
      }
    }

    this.emit('sendAdded', { channelId, send })
  }

  updateSend(channelId: string, sendId: string, updates: Partial<SendSlot>): void {
    const channel = this.channels.get(channelId)
    const nodes = this.channelNodes.get(channelId)
    if (!channel || !nodes) return

    const send = channel.sends.find(s => s.id === sendId)
    if (!send) return

    Object.assign(send, updates)
    
    // Update send gain
    const sendNode = nodes.sendNodes.get(sendId)
    if (sendNode && updates.amount !== undefined) {
      sendNode.gain.value = send.muted ? 0 : send.amount
    }

    this.emit('sendUpdated', { channelId, send })
  }

  removeSend(channelId: string, sendId: string): void {
    const channel = this.channels.get(channelId)
    const nodes = this.channelNodes.get(channelId)
    if (!channel || !nodes) return

    channel.sends = channel.sends.filter(s => s.id !== sendId)
    
    // Disconnect and remove send node
    const sendNode = nodes.sendNodes.get(sendId)
    if (sendNode) {
      sendNode.disconnect()
      nodes.sendNodes.delete(sendId)
    }

    this.emit('sendRemoved', { channelId, sendId })
  }

  // Fader Section
  setVolume(channelId: string, volume: number): void {
    const channel = this.channels.get(channelId)
    const nodes = this.channelNodes.get(channelId)
    if (!channel || !nodes) return

    channel.volume = Math.max(0, Math.min(1, volume))
    nodes.outputGain.gain.value = channel.muted ? 0 : channel.volume
    this.emit('volumeChanged', { channelId, volume: channel.volume })
  }

  setPan(channelId: string, pan: number): void {
    const channel = this.channels.get(channelId)
    const nodes = this.channelNodes.get(channelId)
    if (!channel || !nodes) return

    channel.pan = Math.max(-1, Math.min(1, pan))
    nodes.pan.pan.value = channel.pan
    this.emit('panChanged', { channelId, pan: channel.pan })
  }

  toggleMute(channelId: string): void {
    const channel = this.channels.get(channelId)
    const nodes = this.channelNodes.get(channelId)
    if (!channel || !nodes) return

    channel.muted = !channel.muted
    nodes.outputGain.gain.value = channel.muted ? 0 : channel.volume
    this.emit('muteToggled', { channelId, muted: channel.muted })
  }

  toggleSolo(channelId: string): void {
    const channel = this.channels.get(channelId)
    if (!channel) return

    channel.solo = !channel.solo
    this.updateSoloState()
    this.emit('soloToggled', { channelId, solo: channel.solo })
  }

  private updateSoloState(): void {
    const soloedChannels = Array.from(this.channels.values()).filter(c => c.solo)
    const hasSolos = soloedChannels.length > 0

    this.channels.forEach((channel, id) => {
      const nodes = this.channelNodes.get(id)
      if (!nodes) return

      const shouldBeSilent = hasSolos && !channel.solo && !channel.muted
      nodes.outputGain.gain.value = shouldBeSilent ? 0 : (channel.muted ? 0 : channel.volume)
    })
  }

  // Bus Management
  createBus(name: string, type: Bus['type'] = 'aux'): Bus {
    const channelStrip = this.createChannelStrip('', name, 'bus')
    
    const bus: Bus = {
      id: this.generateId(),
      name,
      type,
      channelStrip,
      inputTracks: [],
      color: this.getRandomColor()
    }

    this.busses.set(bus.id, bus)
    this.emit('busCreated', bus)
    
    return bus
  }

  getBus(id: string): Bus | undefined {
    return this.busses.get(id)
  }

  getBusses(): Bus[] {
    return Array.from(this.busses.values())
  }

  deleteBus(id: string): void {
    const bus = this.busses.get(id)
    if (!bus) return

    // Remove all sends to this bus
    this.channels.forEach((channel, channelId) => {
      channel.sends = channel.sends.filter(s => s.destination !== id)
    })

    this.deleteChannelStrip(bus.channelStrip.id)
    this.busses.delete(id)
    this.emit('busDeleted', id)
  }

  // Automation
  recordAutomation(trackId: string, parameter: string, value: number, time: number): void {
    const key = `${trackId}_${parameter}`
    let automation = this.automationData.get(key)

    if (!automation) {
      automation = [{
        trackId,
        parameter,
        points: [],
        mode: 'write'
      }]
      this.automationData.set(key, automation)
    }

    automation[0].points.push({ time, value })
    automation[0].points.sort((a, b) => a.time - b.time)
    
    this.emit('automationRecorded', { trackId, parameter, time, value })
  }

  getAutomation(trackId: string, parameter: string): AutomationData | undefined {
    const key = `${trackId}_${parameter}`
    return this.automationData.get(key)?.[0]
  }

  clearAutomation(trackId: string, parameter: string): void {
    const key = `${trackId}_${parameter}`
    this.automationData.delete(key)
    this.emit('automationCleared', { trackId, parameter })
  }

  // Audio Node Management
  private initializeMasterChannel(): void {
    this.masterChannel = this.createChannelStrip('master', 'Master', 'master')
  }

  private createChannelNodes(channel: ChannelStrip): void {
    const inputGain = this.audioContext.createGain()
    const outputGain = this.audioContext.createGain()
    const pan = this.audioContext.createStereoPanner()
    const analyser = this.audioContext.createAnalyser()
    
    inputGain.gain.value = channel.inputGain
    outputGain.gain.value = channel.volume
    pan.pan.value = channel.pan

    // Create EQ nodes
    const eqNodes = channel.eq.map(() => this.audioContext.createBiquadFilter())

    // Create compressor if needed
    const compressor = channel.compressor.enabled ? this.audioContext.createDynamicsCompressor() : undefined

    // Chain: input -> [compressor] -> eq chain -> output -> pan -> analyser
    let currentNode: AudioNode = inputGain

    if (compressor) {
      currentNode.connect(compressor)
      currentNode = compressor
    }

    eqNodes.forEach(eq => {
      currentNode.connect(eq)
      currentNode = eq
    })

    currentNode.connect(outputGain)
    outputGain.connect(pan)
    pan.connect(analyser)
    analyser.connect(this.audioContext.destination)

    this.channelNodes.set(channel.id, {
      inputGain,
      compressor,
      eqNodes,
      sendNodes: new Map(),
      outputGain,
      pan,
      analyser
    })

    this.updateEQNodes(channel.id)
  }

  private updateChannelNodes(channel: ChannelStrip): void {
    // Update existing nodes with new values
    this.setInputGain(channel.id, channel.inputGain)
    this.setVolume(channel.id, channel.volume)
    this.setPan(channel.id, channel.pan)
    this.updateEQNodes(channel.id)
    this.updateDynamicsProcessing(channel.id)
  }

  private disconnectChannelNodes(channelId: string): void {
    const nodes = this.channelNodes.get(channelId)
    if (!nodes) return

    nodes.inputGain.disconnect()
    nodes.compressor?.disconnect()
    nodes.eqNodes.forEach(eq => eq.disconnect())
    nodes.sendNodes.forEach(send => send.disconnect())
    nodes.outputGain.disconnect()
    nodes.pan.disconnect()
    nodes.analyser.disconnect()

    this.channelNodes.delete(channelId)
  }

  // Metering
  getMeterLevels(channelId: string): { input: number; output: number; reduction: number } {
    const channel = this.channels.get(channelId)
    const nodes = this.channelNodes.get(channelId)
    if (!channel || !nodes) return { input: 0, output: 0, reduction: 0 }

    const dataArray = new Float32Array(nodes.analyser.fftSize)
    nodes.analyser.getFloatTimeDomainData(dataArray)

    let sum = 0
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i] * dataArray[i]
    }
    const rms = Math.sqrt(sum / dataArray.length)
    
    channel.outputLevel = rms
    
    if (nodes.compressor) {
      channel.reductionLevel = nodes.compressor.reduction
    }

    return {
      input: channel.inputLevel,
      output: channel.outputLevel,
      reduction: channel.reductionLevel
    }
  }

  // Utility Methods
  private generateId(): string {
    return `mix_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
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
    this.channelNodes.forEach((_, id) => this.disconnectChannelNodes(id))
    this.channels.clear()
    this.busses.clear()
    this.automationData.clear()
    this.listeners.clear()
  }
}
