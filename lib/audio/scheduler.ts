/**
 * Audio Scheduler - Sample-accurate playback scheduling
 * Uses AudioContext lookahead scheduling for precise timing
 * Handles clip scheduling, stopping, and sync with minimal jitter
 */

export class AudioScheduler {
  constructor(audioContext, options = {}) {
    this.audioContext = audioContext;
    this.lookaheadMs = options.lookaheadMs || 100; // How often to check schedule (ms)
    this.scheduleAheadMs = options.scheduleAheadMs || 200; // How far ahead to schedule (ms)
    
    this.queue = []; // Items waiting to be scheduled
    this.scheduledSources = new Map(); // Active AudioBufferSourceNodes
    this.timer = null;
    this.isRunning = false;
  }

  /**
   * Add clip to scheduling queue
   * @param {Object} item - Schedule item
   * @param {AudioBuffer} item.buffer - Audio buffer to play
   * @param {number} item.startTime - When to start (in AudioContext time)
   * @param {number} item.offset - Offset into buffer (seconds)
   * @param {number} item.duration - Duration to play (seconds)
   * @param {AudioNode} item.destination - Where to connect (default: destination)
   * @param {string} item.id - Unique identifier for tracking
   * @param {Function} item.onEnded - Callback when playback ends
   */
  addToQueue(item) {
    if (!item.buffer || !item.startTime) {
      console.error('Invalid schedule item:', item);
      return;
    }
    
    this.queue.push(item);
    this.queue.sort((a, b) => a.startTime - b.startTime); // Keep sorted by time
  }

  /**
   * Start the scheduler
   */
  start() {
    if (this.isRunning) {
      console.warn('Scheduler already running');
      return;
    }
    
    this.isRunning = true;
    this._tick();
    console.log('🎵 Audio scheduler started');
  }

  /**
   * Stop the scheduler and clear queue
   */
  stop() {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    
    // Stop all active sources
    this.scheduledSources.forEach((source, id) => {
      try {
        source.stop();
        source.disconnect();
      } catch (e) {
        // May already be stopped
      }
    });
    
    this.scheduledSources.clear();
    this.queue = [];
    
    console.log('⏸️ Audio scheduler stopped');
  }

  /**
   * Stop a specific scheduled source by ID
   */
  stopSource(id) {
    const source = this.scheduledSources.get(id);
    if (source) {
      try {
        source.stop();
        source.disconnect();
      } catch (e) {
        // Already stopped
      }
      this.scheduledSources.delete(id);
    }
  }

  /**
   * Clear all pending items from queue
   */
  clearQueue() {
    this.queue = [];
  }

  /**
   * Internal tick function - schedules items in lookahead window
   * @private
   */
  _tick() {
    if (!this.isRunning) return;

    const now = this.audioContext.currentTime;
    const scheduleWindowEnd = now + (this.scheduleAheadMs / 1000);

    // Schedule all items that fall within the lookahead window
    while (this.queue.length > 0 && this.queue[0].startTime <= scheduleWindowEnd) {
      const item = this.queue.shift();
      this._scheduleItem(item);
    }

    // Schedule next tick
    this.timer = setTimeout(() => this._tick(), this.lookaheadMs);
  }

  /**
   * Schedule a single item for playback
   * @private
   */
  _scheduleItem(item) {
    try {
      const source = this.audioContext.createBufferSource();
      source.buffer = item.buffer;
      
      // Connect to destination (or custom node)
      const destination = item.destination || this.audioContext.destination;
      source.connect(destination);
      
      // Calculate playback parameters
      const when = item.startTime;
      const offset = item.offset || 0;
      const duration = item.duration || (item.buffer.duration - offset);
      
      // Start playback
      source.start(when, offset, duration);
      
      // Track active source
      if (item.id) {
        this.scheduledSources.set(item.id, source);
        
        // Clean up when ended
        source.onended = () => {
          this.scheduledSources.delete(item.id);
          if (item.onEnded) {
            item.onEnded();
          }
        };
      }
      
      console.log(`📍 Scheduled clip at ${when.toFixed(3)}s (offset: ${offset.toFixed(3)}s, duration: ${duration.toFixed(3)}s)`);
    } catch (error) {
      console.error('Failed to schedule item:', error, item);
    }
  }

  /**
   * Get current playback time
   */
  getCurrentTime() {
    return this.audioContext.currentTime;
  }

  /**
   * Get queue size
   */
  getQueueSize() {
    return this.queue.length;
  }

  /**
   * Get active source count
   */
  getActiveSourceCount() {
    return this.scheduledSources.size;
  }
}

/**
 * Helper: Convert project time to AudioContext time
 */
export function projectTimeToAudioTime(projectTime, playbackStartTime, audioContextStartTime) {
  return audioContextStartTime + (projectTime - playbackStartTime);
}

/**
 * Helper: Convert AudioContext time to project time
 */
export function audioTimeToProjectTime(audioTime, playbackStartTime, audioContextStartTime) {
  return playbackStartTime + (audioTime - audioContextStartTime);
}
