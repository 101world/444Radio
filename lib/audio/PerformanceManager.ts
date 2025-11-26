/**
 * Performance Optimization System
 * Web Workers, virtual scrolling, lazy rendering, buffer pooling, RAF scheduling
 */

export interface PerformanceMetrics {
  fps: number
  frameTime: number // ms
  memoryUsage?: number // MB
  audioLatency: number // ms
  renderTime: number // ms
  workerTasksQueued: number
  bufferPoolSize: number
}

export interface VirtualScrollConfig {
  itemHeight: number
  visibleCount: number
  bufferSize: number // Extra items to render above/below viewport
  scrollTop: number
  totalItems: number
}

export interface LazyRenderConfig {
  enabled: boolean
  debounceMs: number
  renderDistance: number // Distance from viewport to start rendering (pixels)
}

// Web Worker Pool for audio processing
export class WorkerPool {
  private workers: Worker[] = []
  private availableWorkers: Worker[] = []
  private taskQueue: Array<{ task: any; resolve: Function; reject: Function }> = []
  private maxWorkers: number

  constructor(workerScript: string, maxWorkers: number = navigator.hardwareConcurrency || 4) {
    this.maxWorkers = maxWorkers
    
    for (let i = 0; i < maxWorkers; i++) {
      const worker = new Worker(workerScript)
      this.workers.push(worker)
      this.availableWorkers.push(worker)
    }
  }

  async execute<T = any>(task: any): Promise<T> {
    return new Promise((resolve, reject) => {
      const worker = this.availableWorkers.pop()
      
      if (worker) {
        this.executeTask(worker, task, resolve, reject)
      } else {
        // Queue task if no workers available
        this.taskQueue.push({ task, resolve, reject })
      }
    })
  }

  private executeTask(worker: Worker, task: any, resolve: Function, reject: Function): void {
    const timeout = setTimeout(() => {
      reject(new Error('Worker task timeout'))
      this.returnWorker(worker)
    }, 30000) // 30 second timeout

    worker.onmessage = (e) => {
      clearTimeout(timeout)
      resolve(e.data)
      this.returnWorker(worker)
    }

    worker.onerror = (e) => {
      clearTimeout(timeout)
      reject(e)
      this.returnWorker(worker)
    }

    worker.postMessage(task)
  }

  private returnWorker(worker: Worker): void {
    this.availableWorkers.push(worker)
    
    // Process queued task if any
    if (this.taskQueue.length > 0) {
      const { task, resolve, reject } = this.taskQueue.shift()!
      const nextWorker = this.availableWorkers.pop()!
      this.executeTask(nextWorker, task, resolve, reject)
    }
  }

  getQueuedTasksCount(): number {
    return this.taskQueue.length
  }

  terminate(): void {
    this.workers.forEach(w => w.terminate())
    this.workers = []
    this.availableWorkers = []
    this.taskQueue = []
  }
}

// Audio Buffer Pool for reusing buffers
export class BufferPool {
  private pools: Map<string, AudioBuffer[]> = new Map()
  private maxPoolSize: number = 20

  constructor(maxPoolSize: number = 20) {
    this.maxPoolSize = maxPoolSize
  }

  getKey(sampleRate: number, length: number, channels: number): string {
    return `${sampleRate}_${length}_${channels}`
  }

  acquire(audioContext: AudioContext, length: number, channels: number = 2): AudioBuffer {
    const key = this.getKey(audioContext.sampleRate, length, channels)
    const pool = this.pools.get(key)

    if (pool && pool.length > 0) {
      return pool.pop()!
    }

    // Create new buffer if pool is empty
    return audioContext.createBuffer(channels, length, audioContext.sampleRate)
  }

  release(buffer: AudioBuffer): void {
    const key = this.getKey(buffer.sampleRate, buffer.length, buffer.numberOfChannels)
    
    let pool = this.pools.get(key)
    if (!pool) {
      pool = []
      this.pools.set(key, pool)
    }

    if (pool.length < this.maxPoolSize) {
      // Clear buffer data
      for (let i = 0; i < buffer.numberOfChannels; i++) {
        const data = buffer.getChannelData(i)
        data.fill(0)
      }
      
      pool.push(buffer)
    }
  }

  clear(): void {
    this.pools.clear()
  }

  getTotalSize(): number {
    let total = 0
    this.pools.forEach(pool => total += pool.length)
    return total
  }
}

// RequestAnimationFrame Scheduler
export class RAFScheduler {
  private tasks: Map<string, () => void> = new Map()
  private running: boolean = false
  private rafId?: number
  private lastFrameTime: number = 0
  private fps: number = 60
  private frameCount: number = 0
  private fpsUpdateTime: number = 0

  constructor() {
    this.loop = this.loop.bind(this)
  }

  schedule(id: string, task: () => void): void {
    this.tasks.set(id, task)
    
    if (!this.running) {
      this.start()
    }
  }

  unschedule(id: string): void {
    this.tasks.delete(id)
    
    if (this.tasks.size === 0) {
      this.stop()
    }
  }

  private start(): void {
    if (this.running) return
    
    this.running = true
    this.lastFrameTime = performance.now()
    this.fpsUpdateTime = this.lastFrameTime
    this.rafId = requestAnimationFrame(this.loop)
  }

  private stop(): void {
    if (!this.running) return
    
    this.running = false
    if (this.rafId !== undefined) {
      cancelAnimationFrame(this.rafId)
      this.rafId = undefined
    }
  }

  private loop(timestamp: number): void {
    if (!this.running) return

    // Calculate FPS
    this.frameCount++
    if (timestamp - this.fpsUpdateTime >= 1000) {
      this.fps = this.frameCount
      this.frameCount = 0
      this.fpsUpdateTime = timestamp
    }

    // Execute all scheduled tasks
    this.tasks.forEach(task => {
      try {
        task()
      } catch (error) {
        console.error('RAF task error:', error)
      }
    })

    this.lastFrameTime = timestamp
    this.rafId = requestAnimationFrame(this.loop)
  }

  getFPS(): number {
    return this.fps
  }

  getFrameTime(): number {
    return performance.now() - this.lastFrameTime
  }

  dispose(): void {
    this.stop()
    this.tasks.clear()
  }
}

// Virtual Scrolling Manager
export class VirtualScrollManager<T> {
  private config: VirtualScrollConfig
  private items: T[] = []
  private visibleItems: T[] = []
  private visibleRange: { start: number; end: number } = { start: 0, end: 0 }

  constructor(config: VirtualScrollConfig) {
    this.config = config
  }

  setItems(items: T[]): void {
    this.items = items
    this.config.totalItems = items.length
    this.updateVisibleItems()
  }

  setScrollTop(scrollTop: number): void {
    this.config.scrollTop = scrollTop
    this.updateVisibleItems()
  }

  private updateVisibleItems(): void {
    const startIndex = Math.max(
      0,
      Math.floor(this.config.scrollTop / this.config.itemHeight) - this.config.bufferSize
    )
    
    const endIndex = Math.min(
      this.items.length,
      startIndex + this.config.visibleCount + this.config.bufferSize * 2
    )

    this.visibleRange = { start: startIndex, end: endIndex }
    this.visibleItems = this.items.slice(startIndex, endIndex)
  }

  getVisibleItems(): T[] {
    return this.visibleItems
  }

  getVisibleRange(): { start: number; end: number } {
    return this.visibleRange
  }

  getTotalHeight(): number {
    return this.config.totalItems * this.config.itemHeight
  }

  getOffsetTop(): number {
    return this.visibleRange.start * this.config.itemHeight
  }

  updateConfig(updates: Partial<VirtualScrollConfig>): void {
    Object.assign(this.config, updates)
    this.updateVisibleItems()
  }
}

// Lazy Rendering Manager
export class LazyRenderManager {
  private config: LazyRenderConfig = {
    enabled: true,
    debounceMs: 100,
    renderDistance: 500
  }
  private renderQueue: Map<string, () => void> = new Map()
  private debounceTimer?: number
  private observer?: IntersectionObserver

  constructor(config?: Partial<LazyRenderConfig>) {
    if (config) {
      Object.assign(this.config, config)
    }
    
    this.setupIntersectionObserver()
  }

  private setupIntersectionObserver(): void {
    if (typeof IntersectionObserver === 'undefined') return

    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          const id = (entry.target as HTMLElement).dataset.lazyId
          if (!id) return

          if (entry.isIntersecting) {
            this.scheduleRender(id)
          }
        })
      },
      {
        rootMargin: `${this.config.renderDistance}px`
      }
    )
  }

  observe(element: HTMLElement, id: string, renderFn: () => void): void {
    if (!this.config.enabled || !this.observer) {
      renderFn()
      return
    }

    element.dataset.lazyId = id
    this.renderQueue.set(id, renderFn)
    this.observer.observe(element)
  }

  unobserve(element: HTMLElement, id: string): void {
    if (this.observer) {
      this.observer.unobserve(element)
    }
    this.renderQueue.delete(id)
  }

  private scheduleRender(id: string): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
    }

    this.debounceTimer = window.setTimeout(() => {
      const renderFn = this.renderQueue.get(id)
      if (renderFn) {
        renderFn()
        this.renderQueue.delete(id)
      }
    }, this.config.debounceMs)
  }

  forceRenderAll(): void {
    this.renderQueue.forEach(renderFn => renderFn())
    this.renderQueue.clear()
  }

  dispose(): void {
    if (this.observer) {
      this.observer.disconnect()
    }
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
    }
    this.renderQueue.clear()
  }
}

// Main Performance Manager
export class PerformanceManager {
  private workerPool?: WorkerPool
  private bufferPool: BufferPool
  private rafScheduler: RAFScheduler
  private virtualScrollManagers: Map<string, VirtualScrollManager<any>> = new Map()
  private lazyRenderManager: LazyRenderManager
  private metrics: PerformanceMetrics = {
    fps: 60,
    frameTime: 0,
    audioLatency: 0,
    renderTime: 0,
    workerTasksQueued: 0,
    bufferPoolSize: 0
  }
  private metricsInterval?: number

  constructor(workerScript?: string) {
    if (workerScript) {
      this.workerPool = new WorkerPool(workerScript)
    }
    
    this.bufferPool = new BufferPool()
    this.rafScheduler = new RAFScheduler()
    this.lazyRenderManager = new LazyRenderManager()
    
    this.startMetricsCollection()
  }

  // Worker Pool Access
  async executeInWorker<T = any>(task: any): Promise<T> {
    if (!this.workerPool) {
      throw new Error('Worker pool not initialized')
    }
    return this.workerPool.execute<T>(task)
  }

  // Buffer Pool Access
  acquireBuffer(audioContext: AudioContext, length: number, channels: number = 2): AudioBuffer {
    return this.bufferPool.acquire(audioContext, length, channels)
  }

  releaseBuffer(buffer: AudioBuffer): void {
    this.bufferPool.release(buffer)
  }

  // RAF Scheduling
  scheduleRAF(id: string, task: () => void): void {
    this.rafScheduler.schedule(id, task)
  }

  unscheduleRAF(id: string): void {
    this.rafScheduler.unschedule(id)
  }

  // Virtual Scrolling
  createVirtualScroll<T>(id: string, config: VirtualScrollConfig): VirtualScrollManager<T> {
    const manager = new VirtualScrollManager<T>(config)
    this.virtualScrollManagers.set(id, manager)
    return manager
  }

  getVirtualScroll<T>(id: string): VirtualScrollManager<T> | undefined {
    return this.virtualScrollManagers.get(id)
  }

  // Lazy Rendering
  observeLazy(element: HTMLElement, id: string, renderFn: () => void): void {
    this.lazyRenderManager.observe(element, id, renderFn)
  }

  unobserveLazy(element: HTMLElement, id: string): void {
    this.lazyRenderManager.unobserve(element, id)
  }

  // Performance Metrics
  private startMetricsCollection(): void {
    this.metricsInterval = window.setInterval(() => {
      this.metrics.fps = this.rafScheduler.getFPS()
      this.metrics.frameTime = this.rafScheduler.getFrameTime()
      this.metrics.workerTasksQueued = this.workerPool?.getQueuedTasksCount() || 0
      this.metrics.bufferPoolSize = this.bufferPool.getTotalSize()

      // Memory usage (if available)
      if ((performance as any).memory) {
        this.metrics.memoryUsage = (performance as any).memory.usedJSHeapSize / 1024 / 1024
      }
    }, 1000)
  }

  getMetrics(): PerformanceMetrics {
    return { ...this.metrics }
  }

  // Memory Management
  clearBufferPool(): void {
    this.bufferPool.clear()
  }

  // Optimization Hints
  static shouldUseVirtualScroll(itemCount: number, itemHeight: number, viewportHeight: number): boolean {
    const totalHeight = itemCount * itemHeight
    return totalHeight > viewportHeight * 3 // Use virtual scroll if content is 3x viewport
  }

  static shouldUseLazyRender(complexity: 'low' | 'medium' | 'high'): boolean {
    const complexityScores = { low: 1, medium: 2, high: 3 }
    return complexityScores[complexity] >= 2
  }

  static getOptimalWorkerCount(): number {
    return Math.max(2, Math.min(8, navigator.hardwareConcurrency || 4))
  }

  // Batch Operations
  async batchProcess<T, R>(
    items: T[],
    processor: (item: T) => R | Promise<R>,
    batchSize: number = 10
  ): Promise<R[]> {
    const results: R[] = []
    
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize)
      const batchResults = await Promise.all(batch.map(item => processor(item)))
      results.push(...batchResults)
      
      // Yield to main thread
      await new Promise(resolve => setTimeout(resolve, 0))
    }
    
    return results
  }

  // Throttling & Debouncing
  throttle<T extends (...args: any[]) => any>(fn: T, delay: number): T {
    let lastCall = 0
    
    return ((...args: any[]) => {
      const now = Date.now()
      if (now - lastCall >= delay) {
        lastCall = now
        return fn(...args)
      }
    }) as T
  }

  debounce<T extends (...args: any[]) => any>(fn: T, delay: number): T {
    let timeoutId: number | undefined
    
    return ((...args: any[]) => {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
      
      timeoutId = window.setTimeout(() => {
        fn(...args)
      }, delay)
    }) as T
  }

  // Cleanup
  dispose(): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval)
    }
    
    this.workerPool?.terminate()
    this.bufferPool.clear()
    this.rafScheduler.dispose()
    this.lazyRenderManager.dispose()
    this.virtualScrollManagers.clear()
  }
}

// Singleton instance
let performanceManagerInstance: PerformanceManager | undefined

export function getPerformanceManager(workerScript?: string): PerformanceManager {
  if (!performanceManagerInstance) {
    performanceManagerInstance = new PerformanceManager(workerScript)
  }
  return performanceManagerInstance
}
