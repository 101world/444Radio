# Precision Audio Scheduler - Integration Guide

## 🎯 Mission: Professional DAW-Quality Playback

The `PrecisionAudioScheduler` replaces the existing RAF-based playback system with sample-accurate scheduling to compete with Ableton, Logic Pro, and Suno.

## 📦 What's Been Built

### ✅ Core Components
1. **PrecisionAudioScheduler** (`lib/audio-scheduler.ts`)
   - Look-ahead scheduling (100ms window)
   - Sample-accurate clip triggering
   - Hot-swap state management
   - Smooth transitions (no clicks/pops)

2. **TimelineScrollIndicator** (`app/components/studio/TimelineScrollIndicator.tsx`)
   - Glassmorphism overlay
   - Auto-hide after 1.5s
   - Integrated into Timeline

3. **Studio Features** (Already Committed)
   - Demucs stem splitter with MP3/WAV selection
   - Editable track names
   - Download all clips button
   - Custom scrollbar styles

## 🔧 Integration Steps

### Step 1: Update useMultiTrack Hook

**File**: `hooks/useMultiTrack.ts`

Replace the existing playback system with the scheduler:

```typescript
import { PrecisionAudioScheduler, ScheduledClip, TrackState } from '@/lib/audio-scheduler';

// Add to MultiTrackState interface
interface MultiTrackState {
  // ... existing fields
  scheduler: PrecisionAudioScheduler | null;
}

// Initialize in state
const [state, setState] = useState<MultiTrackState>({
  // ... existing fields
  scheduler: null,
});

// Create scheduler when AudioContext is ready
useEffect(() => {
  if (!audioContext.current) return;
  
  const trackStates = new Map<string, TrackState>();
  
  // Build track state map from existing tracks
  tracks.forEach(track => {
    if (track.gainNode && track.panNode) {
      trackStates.set(track.id, {
        id: track.id,
        gainNode: track.gainNode,
        panNode: track.panNode,
        volume: track.volume,
        pan: track.pan,
        mute: track.mute,
        solo: track.solo,
      });
    }
  });
  
  const scheduler = new PrecisionAudioScheduler(
    audioContext.current,
    trackStates
  );
  
  setState(prev => ({ ...prev, scheduler }));
  
  return () => {
    scheduler.destroy();
  };
}, [tracks.length]); // Recreate when tracks change
```

### Step 2: Replace setPlaying with Scheduler

**Old Code** (lines 787-847):
```typescript
const setPlaying = useCallback(async (playing: boolean) => {
  // ... stops sources, starts tracks with Promise.all
}, [tracks, currentTime, /* ... */]);
```

**New Code**:
```typescript
const setPlaying = useCallback(async (playing: boolean) => {
  if (!audioContext.current) return;
  if (!state.scheduler) {
    console.error('Scheduler not initialized');
    return;
  }
  
  if (playing) {
    // Resume AudioContext if suspended
    if (audioContext.current.state === 'suspended') {
      await audioContext.current.resume();
    }
    
    // Build ScheduledClip array from all tracks
    const scheduledClips: ScheduledClip[] = [];
    
    for (const track of tracks) {
      for (const clip of track.clips) {
        // Load buffer if not cached
        let buffer = bufferCache.get(clip.audioUrl);
        if (!buffer) {
          try {
            const response = await fetch(clip.audioUrl);
            const arrayBuffer = await response.arrayBuffer();
            buffer = await audioContext.current.decodeAudioData(arrayBuffer);
            bufferCache.set(clip.audioUrl, buffer);
          } catch (error) {
            console.error(`Failed to load ${clip.audioUrl}:`, error);
            continue;
          }
        }
        
        scheduledClips.push({
          trackId: track.id,
          clipId: clip.id,
          buffer,
          startTime: clip.startTime,
          duration: clip.duration,
          offset: 0,
          loop: clip.loop || false,
        });
      }
    }
    
    // Start precision scheduler
    state.scheduler.start(
      scheduledClips,
      currentTime,
      () => {
        console.log('All clips scheduled');
      }
    );
    
    // Start RAF ticker for UI updates
    startTicker();
    
  } else {
    // Stop scheduler
    state.scheduler.stop();
    stopTicker();
  }
  
  setIsPlaying(playing);
}, [tracks, currentTime, state.scheduler]);
```

### Step 3: Update Mute/Solo/Volume Functions

**Mute Toggle**:
```typescript
const toggleMute = useCallback((trackId: string) => {
  const track = tracks.find(t => t.id === trackId);
  if (!track) return;
  
  const newMuteState = !track.mute;
  
  // Hot-swap via scheduler (no playback restart)
  if (state.scheduler) {
    state.scheduler.setTrackMute(trackId, newMuteState);
  }
  
  // Update React state
  setTracks(prev => prev.map(t =>
    t.id === trackId ? { ...t, mute: newMuteState } : t
  ));
}, [tracks, state.scheduler]);
```

**Solo Toggle**:
```typescript
const toggleSolo = useCallback((trackId: string) => {
  const track = tracks.find(t => t.id === trackId);
  if (!track) return;
  
  const newSoloState = !track.solo;
  
  // Hot-swap via scheduler
  if (state.scheduler) {
    state.scheduler.setTrackSolo(
      trackId,
      newSoloState,
      tracks.map(t => t.id)
    );
  }
  
  // Update React state
  setTracks(prev => prev.map(t =>
    t.id === trackId ? { ...t, solo: newSoloState } : t
  ));
}, [tracks, state.scheduler]);
```

**Volume Change**:
```typescript
const setTrackVolume = useCallback((trackId: string, volume: number) => {
  // Hot-swap via scheduler (smooth ramp)
  if (state.scheduler) {
    state.scheduler.setTrackVolume(trackId, volume, false);
  }
  
  // Update React state
  setTracks(prev => prev.map(t =>
    t.id === trackId ? { ...t, volume } : t
  ));
}, [state.scheduler]);
```

**Pan Change**:
```typescript
const setTrackPan = useCallback((trackId: string, pan: number) => {
  // Hot-swap via scheduler (smooth ramp)
  if (state.scheduler) {
    state.scheduler.setTrackPan(trackId, pan);
  }
  
  // Update React state
  setTracks(prev => prev.map(t =>
    t.id === trackId ? { ...t, pan } : t
  ));
}, [state.scheduler]);
```

### Step 4: Handle Track Addition/Removal

**Add Track**:
```typescript
const addTrack = useCallback(() => {
  if (!audioContext.current) return;
  
  const gainNode = audioContext.current.createGain();
  const panNode = audioContext.current.createStereoPanner();
  
  gainNode.connect(panNode);
  panNode.connect(audioContext.current.destination);
  
  const newTrack: Track = {
    id: `track-${Date.now()}`,
    name: `Track ${tracks.length + 1}`,
    clips: [],
    volume: 0.8,
    pan: 0,
    mute: false,
    solo: false,
    gainNode,
    panNode,
  };
  
  // Add to scheduler if it exists
  if (state.scheduler) {
    state.scheduler.tracks.set(newTrack.id, {
      id: newTrack.id,
      gainNode,
      panNode,
      volume: 0.8,
      pan: 0,
      mute: false,
      solo: false,
    });
  }
  
  setTracks(prev => [...prev, newTrack]);
}, [tracks, state.scheduler]);
```

**Remove Track**:
```typescript
const removeTrack = useCallback((trackId: string) => {
  // Stop track sources first
  if (state.scheduler) {
    state.scheduler.stopTrack(trackId);
  }
  
  // Remove from tracks
  setTracks(prev => prev.filter(t => t.id !== trackId));
}, [state.scheduler]);
```

## 🎨 UI Integration - Timeline Click to Seek

Add click-to-seek on the timeline ruler:

**File**: `app/components/studio/TimelineRuler.tsx`

```typescript
const handleTimelineClick = (e: React.MouseEvent) => {
  const rect = e.currentTarget.getBoundingClientRect();
  const clickX = e.clientX - rect.left;
  const newTime = clickX / pixelsPerSecond;
  
  // Update current time via studio context
  setCurrentTime(Math.max(0, Math.min(newTime, TIMELINE_DURATION)));
  
  // If playing, scheduler will pick up new position automatically
};

return (
  <div 
    className="timeline-ruler cursor-pointer"
    onClick={handleTimelineClick}
  >
    {/* ... ruler markings */}
  </div>
);
```

## 🚀 Performance Optimizations

### Buffer Preloading
```typescript
// Preload all buffers on project load
const preloadBuffers = async (tracks: Track[]) => {
  if (!audioContext.current) return;
  
  const urls = new Set<string>();
  tracks.forEach(track => {
    track.clips.forEach(clip => urls.add(clip.audioUrl));
  });
  
  await Promise.all(
    Array.from(urls).map(async url => {
      if (bufferCache.has(url)) return;
      
      try {
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        const buffer = await audioContext.current!.decodeAudioData(arrayBuffer);
        bufferCache.set(url, buffer);
      } catch (error) {
        console.error(`Failed to preload ${url}:`, error);
      }
    })
  );
};
```

### Waveform Caching
```typescript
// Cache rendered waveforms at multiple zoom levels
const waveformCache = new Map<string, Map<number, ImageData>>();

const getCachedWaveform = (audioUrl: string, zoom: number): ImageData | null => {
  const zoomLevels = waveformCache.get(audioUrl);
  if (!zoomLevels) return null;
  
  // Find closest zoom level
  const zoomKeys = Array.from(zoomLevels.keys()).sort((a, b) => a - b);
  const closestZoom = zoomKeys.reduce((prev, curr) =>
    Math.abs(curr - zoom) < Math.abs(prev - zoom) ? curr : prev
  );
  
  return zoomLevels.get(closestZoom) || null;
};
```

## 🐛 Testing Checklist

### Critical Tests
- [ ] **Multi-track sync**: 10 tracks playing simultaneously, no drift
- [ ] **Solo/mute toggles**: No clicks, immediate response during playback
- [ ] **Volume/pan changes**: Smooth transitions, no artifacts
- [ ] **Clip transitions**: Seamless handoff between clips
- [ ] **Add/remove tracks**: No playback interruption
- [ ] **Timeline seek**: Accurate positioning, all tracks sync
- [ ] **Zoom changes**: Smooth scrolling, no re-renders
- [ ] **Long sessions**: 50+ clips, no memory leaks
- [ ] **Stem integration**: Split works, new tracks added correctly

### Performance Benchmarks
- **Latency**: <10ms click-to-sound
- **CPU**: <30% with 20 tracks
- **Memory**: <500MB for typical session
- **Frame rate**: 60fps at all zoom levels
- **Buffer load**: <2s for 10 clips

## 📊 Comparison with Competitors

| Feature | 444Radio (New) | Ableton Live | Logic Pro | Suno |
|---------|----------------|--------------|-----------|------|
| Multi-track sync | ✅ Sample-accurate | ✅ | ✅ | ❌ |
| Look-ahead scheduling | ✅ 100ms | ✅ | ✅ | N/A |
| Hot-swap controls | ✅ | ✅ | ✅ | N/A |
| AI stem separation | ✅ Demucs v4 | 💰 Paid | 💰 Paid | ✅ |
| Free tier | ✅ 20 credits | ❌ | ❌ | ✅ Limited |
| Web-based | ✅ | ❌ | ❌ | ✅ |
| Real-time collab | 🚧 Planned | 💰 Paid | 💰 Paid | ✅ |

## 🎯 Next Steps

### Immediate (This Session)
1. ✅ Create PrecisionAudioScheduler class
2. ✅ Integrate TimelineScrollIndicator
3. ✅ Document integration steps
4. ⏳ Update useMultiTrack hook (requires code changes)
5. ⏳ Test multi-track synchronization

### Short-term (Next Session)
1. Implement buffer preloading
2. Add waveform caching
3. Click-to-seek on timeline
4. Keyboard shortcuts (spacebar, arrow keys)
5. Visual feedback for loading states

### Medium-term
1. Automation lanes (volume/pan recording)
2. Time-stretch without pitch change
3. MIDI support with virtual instruments
4. Real-time collaboration
5. Cloud project storage

## 💡 Developer Notes

### Why Look-ahead Scheduling?
- **Problem**: RAF updates at ~16ms (60fps), audio needs sample-accurate timing
- **Solution**: Schedule clips in 100ms look-ahead window using AudioContext time
- **Benefit**: Perfect sync even if RAF skips frames during heavy UI operations

### Why Hot-swap State Changes?
- **Problem**: Stopping/restarting sources causes audible gaps and loss of sync
- **Solution**: Apply gain/pan changes to existing nodes using ramp functions
- **Benefit**: Instant response, no playback interruption, pro DAW feel

### Why Smooth Ramps?
- **Problem**: Instant value changes create clicks/pops (discontinuities in waveform)
- **Solution**: 20-50ms linear ramps for smooth transitions
- **Benefit**: Clean, professional sound quality

---

**Status**: Scheduler created, scroll indicator integrated, ready for useMultiTrack integration.

**Priority**: Update useMultiTrack hook to use PrecisionAudioScheduler for production-quality playback.
