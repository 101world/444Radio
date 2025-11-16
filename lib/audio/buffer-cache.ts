/**
 * Buffer Cache - LRU cache for decoded audio buffers
 * Prevents memory bloat while keeping frequently used buffers in memory
 * Integrates with IndexedDB for persistent storage
 */

export interface CacheEntry<T> {
  value: T;
  size: number;
  lastAccessed: number;
}

export class LRUCache<T> {
  private cache: Map<string, CacheEntry<T>>;
  private maxSize: number;
  private currentSize: number;
  
  constructor(maxSizeMB: number = 100) {
    this.cache = new Map();
    this.maxSize = maxSizeMB * 1024 * 1024; // Convert to bytes
    this.currentSize = 0;
  }
  
  /**
   * Get item from cache
   */
  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    // Update last accessed time
    entry.lastAccessed = Date.now();
    return entry.value;
  }
  
  /**
   * Add item to cache
   */
  set(key: string, value: T, size: number): void {
    // Remove existing entry if present
    if (this.cache.has(key)) {
      const existing = this.cache.get(key)!;
      this.currentSize -= existing.size;
      this.cache.delete(key);
    }
    
    // Evict old entries if needed
    while (this.currentSize + size > this.maxSize && this.cache.size > 0) {
      this.evictLRU();
    }
    
    // Add new entry
    this.cache.set(key, {
      value,
      size,
      lastAccessed: Date.now()
    });
    this.currentSize += size;
    
    console.log(`📦 Cache: ${key} (${this.formatSize(size)}) - Total: ${this.formatSize(this.currentSize)}/${this.formatSize(this.maxSize)}`);
  }
  
  /**
   * Check if key exists in cache
   */
  has(key: string): boolean {
    return this.cache.has(key);
  }
  
  /**
   * Remove item from cache
   */
  delete(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    this.currentSize -= entry.size;
    return this.cache.delete(key);
  }
  
  /**
   * Clear entire cache
   */
  clear(): void {
    this.cache.clear();
    this.currentSize = 0;
  }
  
  /**
   * Evict least recently used item
   */
  private evictLRU(): void {
    let lruKey: string | null = null;
    let lruTime = Infinity;
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < lruTime) {
        lruTime = entry.lastAccessed;
        lruKey = key;
      }
    }
    
    if (lruKey) {
      console.log(`🗑️ Evicting LRU: ${lruKey}`);
      this.delete(lruKey);
    }
  }
  
  /**
   * Get cache statistics
   */
  getStats(): { size: number; maxSize: number; itemCount: number; utilization: number } {
    return {
      size: this.currentSize,
      maxSize: this.maxSize,
      itemCount: this.cache.size,
      utilization: this.currentSize / this.maxSize
    };
  }
  
  /**
   * Format size for display
   */
  private formatSize(bytes: number): string {
    if (bytes < 1024) return bytes + 'B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'KB';
    return (bytes / (1024 * 1024)).toFixed(1) + 'MB';
  }
}

/**
 * IndexedDB wrapper for persistent audio buffer storage
 */
export class AudioBufferDB {
  private dbName: string;
  private version: number;
  private db: IDBDatabase | null;
  
  constructor(dbName: string = 'AudioBufferCache', version: number = 1) {
    this.dbName = dbName;
    this.version = version;
    this.db = null;
  }
  
  /**
   * Initialize database
   */
  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        console.log('✅ IndexedDB initialized');
        resolve();
      };
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Create object store for audio buffers
        if (!db.objectStoreNames.contains('buffers')) {
          const store = db.createObjectStore('buffers', { keyPath: 'url' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  }
  
  /**
   * Store audio buffer
   */
  async store(url: string, buffer: Float32Array, channels: number, sampleRate: number): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['buffers'], 'readwrite');
      const store = transaction.objectStore('buffers');
      
      const data = {
        url,
        buffer: Array.from(buffer), // Convert to regular array for storage
        channels,
        sampleRate,
        timestamp: Date.now()
      };
      
      const request = store.put(data);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
  
  /**
   * Retrieve audio buffer
   */
  async retrieve(url: string): Promise<{ buffer: Float32Array; channels: number; sampleRate: number } | null> {
    if (!this.db) throw new Error('Database not initialized');
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['buffers'], 'readonly');
      const store = transaction.objectStore('buffers');
      const request = store.get(url);
      
      request.onsuccess = () => {
        const result = request.result;
        if (!result) {
          resolve(null);
          return;
        }
        
        resolve({
          buffer: new Float32Array(result.buffer),
          channels: result.channels,
          sampleRate: result.sampleRate
        });
      };
      
      request.onerror = () => reject(request.error);
    });
  }
  
  /**
   * Delete buffer from storage
   */
  async delete(url: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['buffers'], 'readwrite');
      const store = transaction.objectStore('buffers');
      const request = store.delete(url);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
  
  /**
   * Clear all stored buffers
   */
  async clear(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['buffers'], 'readwrite');
      const store = transaction.objectStore('buffers');
      const request = store.clear();
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
  
  /**
   * Get all stored URLs
   */
  async getAllKeys(): Promise<string[]> {
    if (!this.db) throw new Error('Database not initialized');
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['buffers'], 'readonly');
      const store = transaction.objectStore('buffers');
      const request = store.getAllKeys();
      
      request.onsuccess = () => resolve(request.result as string[]);
      request.onerror = () => reject(request.error);
    });
  }
}

/**
 * Combined buffer manager with LRU cache + IndexedDB persistence
 */
export class BufferManager {
  private memoryCache: LRUCache<Float32Array>;
  private diskCache: AudioBufferDB;
  private initialized: boolean;
  
  constructor(maxMemoryMB: number = 100) {
    this.memoryCache = new LRUCache(maxMemoryMB);
    this.diskCache = new AudioBufferDB();
    this.initialized = false;
  }
  
  /**
   * Initialize the buffer manager
   */
  async init(): Promise<void> {
    if (this.initialized) return;
    await this.diskCache.init();
    this.initialized = true;
  }
  
  /**
   * Get buffer (checks memory, then disk)
   */
  async get(url: string): Promise<{ buffer: Float32Array; channels: number; sampleRate: number } | null> {
    // Check memory cache first
    const cached = this.memoryCache.get(url);
    if (cached) {
      console.log(`✅ Buffer from memory: ${url}`);
      return { buffer: cached, channels: 2, sampleRate: 48000 }; // TODO: store metadata
    }
    
    // Check disk cache
    const fromDisk = await this.diskCache.retrieve(url);
    if (fromDisk) {
      console.log(`💾 Buffer from disk: ${url}`);
      // Promote to memory cache
      this.memoryCache.set(url, fromDisk.buffer, fromDisk.buffer.byteLength);
      return fromDisk;
    }
    
    return null;
  }
  
  /**
   * Store buffer (memory + disk)
   */
  async set(url: string, buffer: Float32Array, channels: number, sampleRate: number): Promise<void> {
    // Store in memory
    this.memoryCache.set(url, buffer, buffer.byteLength);
    
    // Store in disk (async, don't wait)
    this.diskCache.store(url, buffer, channels, sampleRate).catch(err => {
      console.error('Failed to store buffer in IndexedDB:', err);
    });
  }
  
  /**
   * Remove buffer from all caches
   */
  async delete(url: string): Promise<void> {
    this.memoryCache.delete(url);
    await this.diskCache.delete(url);
  }
  
  /**
   * Clear all caches
   */
  async clear(): Promise<void> {
    this.memoryCache.clear();
    await this.diskCache.clear();
  }
  
  /**
   * Get cache statistics
   */
  getStats() {
    return this.memoryCache.getStats();
  }
}

// Singleton instance
let bufferManagerInstance: BufferManager | null = null;

/**
 * Get global buffer manager instance
 */
export function getBufferManager(): BufferManager {
  if (!bufferManagerInstance) {
    bufferManagerInstance = new BufferManager(100); // 100MB default
  }
  return bufferManagerInstance;
}
