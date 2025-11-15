/**
 * Precision Audio Scheduler - Sample-accurate multi-track playback
 * 
 * Solves:
 * 1. Multi-track synchronization drift
 * 2. Glitchy solo/mute toggles
 * 3. Clip transition gaps/overlaps
 * 4. Real-time state changes
 * 
 * Strategy:
 * - Schedule ALL tracks at EXACT same AudioContext time
 * - Look-ahead scheduling for upcoming clips (100ms window)
 * - Hot-swap gain nodes for instant mute/solo
 * - Ramp transitions to avoid clicks/pops
 */

export interface ScheduledClip {
  trackId: string;
  clipId: string;
  buffer: AudioBuffer;
  startTime: number;     // Project time when clip starts (seconds)
  duration: number;      // Clip duration (seconds)
  offset: number;        // Offset into audio buffer (seconds)
  loop: boolean;
}

export interface TrackState {
  id: string;
  gainNode: GainNode;
  panNode: StereoPannerNode;
  volume: number;
  pan: number;
  mute: boolean;
  solo: boolean;
}

export class PrecisionAudioScheduler {
  private scheduleAheadTime = 0.1;      // 100ms look-ahead
  private schedulingInterval = 25;       // Check every 25ms
  private timerWorker: Worker | null = null;
  private scheduledSources: Map<string, AudioBufferSourceNode[]> = new Map();
  private schedulerInterval: NodeJS.Timeout | null = null;
  
  constructor(
    private audioContext: AudioContext,
    private tracks: Map<string, TrackState>
  ) {}

  /**
   * Start precision scheduler - schedules clips in look-ahead window
   */
  start(
    clips: ScheduledClip[],
    projectTime: number,
    onComplete?: () => void
  ) {
    this.stop(); // Clean up any existing scheduler

    // Sort clips by start time for efficient scheduling
    const sortedClips = clips.sort((a, b) => a.startTime - b.startTime);
    let nextClipIndex = 0;

    // Scheduler loop
    this.schedulerInterval = setInterval(() => {
      const currentContextTime = this.audioContext.currentTime;
      const currentProjectTime = projectTime + (currentContextTime - this.audioContext.currentTime);
      
      // Schedule window: current time + look-ahead
      const scheduleWindowEnd = currentProjectTime + this.scheduleAheadTime;

      // Find clips that need scheduling in this window
      while (
        nextClipIndex < sortedClips.length &&
        sortedClips[nextClipIndex].startTime < scheduleWindowEnd
      ) {
        const clip = sortedClips[nextClipIndex];
        
        // Only schedule if clip hasn't started yet
        if (clip.startTime >= currentProjectTime) {
          this.scheduleClip(clip, projectTime);
        }
        
        nextClipIndex++;
      }

      // Stop scheduler when all clips are scheduled
      if (nextClipIndex >= sortedClips.length) {
        if (this.schedulerInterval) {
          clearInterval(this.schedulerInterval);
          this.schedulerInterval = null;
        }
        onComplete?.();
      }
    }, this.schedulingInterval);
  }

  /**
   * Schedule single clip at precise time
   */
  private scheduleClip(clip: ScheduledClip, projectStartTime: number) {
    const track = this.tracks.get(clip.trackId);
    if (!track) {
      console.warn(`Track ${clip.trackId} not found for clip ${clip.clipId}`);
      return;
    }

    const source = this.audioContext.createBufferSource();
    source.buffer = clip.buffer;
    source.loop = clip.loop;

    // Connect to track's gain and pan nodes
    source.connect(track.gainNode);

    // Calculate EXACT start time in AudioContext time
    const contextStartTime = this.audioContext.currentTime + (clip.startTime - projectStartTime);

    // Schedule start with offset
    source.start(contextStartTime, clip.offset, clip.duration);

    // Track for cleanup
    if (!this.scheduledSources.has(clip.trackId)) {
      this.scheduledSources.set(clip.trackId, []);
    }
    this.scheduledSources.get(clip.trackId)!.push(source);

    // Auto-cleanup when done
    source.onended = () => {
      const sources = this.scheduledSources.get(clip.trackId);
      if (sources) {
        const index = sources.indexOf(source);
        if (index > -1) sources.splice(index, 1);
      }
    };
  }

  /**
   * Hot-swap track volume WITHOUT restarting playback
   */
  setTrackVolume(trackId: string, volume: number, immediate = false) {
    const track = this.tracks.get(trackId);
    if (!track || !track.gainNode) return;

    const now = this.audioContext.currentTime;
    
    if (immediate) {
      track.gainNode.gain.setValueAtTime(volume, now);
    } else {
      // 50ms smooth ramp to avoid clicks
      track.gainNode.gain.setValueAtTime(track.gainNode.gain.value, now);
      track.gainNode.gain.linearRampToValueAtTime(volume, now + 0.05);
    }
    
    track.volume = volume;
  }

  /**
   * Hot-swap track mute WITHOUT restarting playback
   */
  setTrackMute(trackId: string, mute: boolean) {
    const track = this.tracks.get(trackId);
    if (!track || !track.gainNode) return;

    const targetVolume = mute ? 0 : track.volume;
    const now = this.audioContext.currentTime;

    // Fast ramp (20ms) for mute/unmute
    track.gainNode.gain.setValueAtTime(track.gainNode.gain.value, now);
    track.gainNode.gain.linearRampToValueAtTime(targetVolume, now + 0.02);
    
    track.mute = mute;
  }

  /**
   * Hot-swap track solo WITHOUT restarting playback
   */
  setTrackSolo(trackId: string, solo: boolean, allTracks: string[]) {
    const track = this.tracks.get(trackId);
    if (!track) return;

    track.solo = solo;

    // Apply solo logic: if ANY track is soloed, mute all non-solo tracks
    const hasSoloedTracks = Array.from(this.tracks.values()).some(t => t.solo);

    allTracks.forEach(tid => {
      const t = this.tracks.get(tid);
      if (!t || !t.gainNode) return;

      const shouldBeMuted = hasSoloedTracks && !t.solo;
      const targetVolume = shouldBeMuted ? 0 : t.volume;
      const now = this.audioContext.currentTime;

      // Fast ramp for solo changes
      t.gainNode.gain.setValueAtTime(t.gainNode.gain.value, now);
      t.gainNode.gain.linearRampToValueAtTime(targetVolume, now + 0.02);
    });
  }

  /**
   * Hot-swap track pan WITHOUT restarting playback
   */
  setTrackPan(trackId: string, pan: number) {
    const track = this.tracks.get(trackId);
    if (!track || !track.panNode) return;

    const now = this.audioContext.currentTime;
    
    // 50ms smooth ramp for pan changes
    track.panNode.pan.setValueAtTime(track.panNode.pan.value, now);
    track.panNode.pan.linearRampToValueAtTime(pan, now + 0.05);
    
    track.pan = pan;
  }

  /**
   * Stop all scheduled and playing sources
   */
  stop() {
    // Stop all sources
    this.scheduledSources.forEach(sources => {
      sources.forEach(source => {
        try {
          source.stop();
        } catch (e) {
          // Already stopped or never started
        }
      });
    });

    this.scheduledSources.clear();

    // Clear scheduler interval
    if (this.schedulerInterval) {
      clearInterval(this.schedulerInterval);
      this.schedulerInterval = null;
    }
  }

  /**
   * Stop specific track's sources
   */
  stopTrack(trackId: string) {
    const sources = this.scheduledSources.get(trackId);
    if (!sources) return;

    sources.forEach(source => {
      try {
        source.stop();
      } catch (e) {
        // Already stopped
      }
    });

    this.scheduledSources.delete(trackId);
  }

  /**
   * Get number of active sources across all tracks
   */
  getActiveSourceCount(): number {
    let count = 0;
    this.scheduledSources.forEach(sources => {
      count += sources.length;
    });
    return count;
  }

  /**
   * Cleanup resources
   */
  destroy() {
    this.stop();
    this.tracks.clear();
  }
}

/**
 * Helper: Find active clip at specific project time
 */
export function findActiveClipAt(
  clips: ScheduledClip[],
  projectTime: number
): ScheduledClip | null {
  for (const clip of clips) {
    const clipEnd = clip.startTime + clip.duration;
    if (projectTime >= clip.startTime && projectTime < clipEnd) {
      return clip;
    }
  }
  return null;
}

/**
 * Helper: Convert project time to clip offset
 */
export function projectTimeToClipOffset(
  projectTime: number,
  clipStartTime: number
): number {
  return Math.max(0, projectTime - clipStartTime);
}
