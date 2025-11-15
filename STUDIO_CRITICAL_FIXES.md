# Studio Critical Fixes - Multi-Track Playback & UX

## 🚀 Completed Enhancements

### 1. ✅ Stem Splitter with Demucs
- **Model**: Updated to `cjwbw/demucs` (Facebook's state-of-the-art v4)
- **Version**: `07afda7a710da69773c01f50d61e0f7f0c75e4c2f0c7b5fce4ae29e31c59b88c`
- **Format Selection**: Modal with MP3/WAV choice before splitting
- **Output Quality**: Users can choose between compressed MP3 or lossless WAV
- **Credits**: 15 credits per operation
- **UI**: `StemSplitModal` component with elegant format selection
- **Stems Generated**: Vocals, Drums, Bass, Other (4 tracks)

### 2. ✅ Editable Track Names
- **Inline Editing**: Click Edit2 icon to rename tracks
- **UX**: Auto-select text, Enter to save, Escape to cancel
- **Visibility**: Edit icon appears on hover (group-hover)
- **Validation**: 30 character limit, trims whitespace
- **Function**: `renameTrack(id, name)` added to useMultiTrack

### 3. ✅ Download All Tracks
- **Button**: Download icon in track header controls
- **Functionality**: Downloads all clips from a track sequentially
- **Naming**: `{TrackName}_{ClipName}.mp3` format
- **UX**: 500ms delay between downloads to prevent browser blocking
- **Visual**: Teal gradient hover with shadow effect

### 4. ✅ Custom Scrollbar System
- **Native Hidden**: Native scrollbars completely hidden with `timeline-scrollbar-hidden` class
- **Glassmorphism**: Semi-transparent overlay with backdrop blur
- **Auto-hide**: Appears on scroll, fades after 1.5s
- **Design**: Black/60 background, teal gradient indicator
- **Position**: Fixed bottom-center, 40% viewport width
- **Component**: `TimelineScrollIndicator.tsx` with smooth transitions

## 🔧 Identified Issues Requiring Fix

### Critical: Multi-Track Playback Synchronization

**Current Problems:**
1. **Timing Drift**: Tracks don't stay perfectly synced during playback
2. **Solo/Mute Glitches**: State changes during playback cause audio artifacts
3. **Clip Transitions**: Gaps or overlaps when moving between clips
4. **Real-time Updates**: Volume/pan changes not immediately reflected

**Root Cause:**
- Web Audio API scheduling is done per-track instead of globally
- `startTrackAtTime` schedules each track independently
- `requestAnimationFrame` ticker updates every frame (not sample-accurate)
- No look-ahead scheduling for upcoming clips

**Required Solution:**
```typescript
// Precision playback scheduler (needed)
class AudioScheduler {
  private scheduleAheadTime = 0.1; // 100ms look-ahead
  private schedulingInterval = 25;  // Check every 25ms
  
  scheduleAllTracks(tracks, startTime) {
    const ctx = audioContext;
    const now = ctx.currentTime;
    
    // Find ALL clips that should play in look-ahead window
    const upcomingClips = this.findUpcomingClips(
      tracks, 
      startTime, 
      startTime + this.scheduleAheadTime
    );
    
    // Schedule ALL clips at EXACT same AudioContext time
    upcomingClips.forEach(({ track, clip, offset }) => {
      const source = ctx.createBufferSource();
      source.buffer = bufferCache.get(clip.audioUrl);
      source.connect(track.gainNode);
      
      // CRITICAL: Use SAME context time for all sources
      const whenToStart = now + (clip.startTime - startTime);
      source.start(whenToStart, offset);
      
      // Store for later stop/cleanup
      this.scheduledSources.push(source);
    });
  }
}
```

### Critical: Real-Time State Management

**Current Problems:**
1. Solo/mute toggles cause full playback restart
2. Volume/pan changes have latency
3. Adding/removing tracks disrupts playback

**Required Solution:**
- **Hot-swapping**: Apply gain changes without stopping sources
- **Ramp Values**: Use `setValueAtTime` + `linearRampToValueAtTime` for smooth transitions
- **Track Addition**: New tracks join playback seamlessly without restart

```typescript
// Example: Hot volume change
setTrackVolume(trackId, newVolume) {
  const track = tracks.find(t => t.id === trackId);
  const ctx = audioContext.current;
  
  if (track.gainNode && ctx) {
    // Smooth 50ms ramp to avoid clicks
    track.gainNode.gain.setValueAtTime(
      track.gainNode.gain.value, 
      ctx.currentTime
    );
    track.gainNode.gain.linearRampToValueAtTime(
      track.mute ? 0 : newVolume,
      ctx.currentTime + 0.05
    );
  }
  
  // Update state WITHOUT restarting playback
  setTracks(prev => prev.map(t => 
    t.id === trackId ? { ...t, volume: newVolume } : t
  ));
}
```

## 📊 Performance Optimizations Needed

### 1. Waveform Rendering
- **Current**: Re-renders on every zoom change
- **Fix**: Cache rendered waveforms at multiple zoom levels
- **Storage**: IndexedDB for persistent cache across sessions

### 2. Clip Movement
- **Current**: Updates entire tracks array on drag
- **Fix**: Use refs for position, batch updates with debounce

### 3. Timeline Scrolling
- **Current**: Triggers React re-renders
- **Fix**: Pure CSS transforms, RAF for smooth 60fps

## 🎯 Competitive Analysis

### Ableton Live
- **Sample-accurate** scheduling (we need this)
- **Look-ahead** buffer for smooth playback
- **Hot-swappable** effects and plugins
- **Time-stretch** without pitch change

### Logic Pro
- **Flex Time** for tempo adjustment
- **Smart Tempo** auto-detection
- **Track Stacks** for grouping
- **Freeze tracks** to save CPU

### Suno
- **AI-powered** generation (we have this)
- **Stem separation** (we now have Demucs)
- **Real-time** collaboration
- **Cloud rendering**

## 🚀 Implementation Priority

### Phase 1: Playback Engine (CRITICAL)
1. Implement precision audio scheduler
2. Sample-accurate clip triggering
3. Look-ahead buffering system
4. Hot-swap state management

### Phase 2: Performance (HIGH)
1. Waveform caching system
2. Virtual scrolling for large projects
3. Web Worker for heavy computations
4. OffscreenCanvas for waveforms

### Phase 3: UX Polish (MEDIUM)
1. Keyboard shortcuts for all actions
2. Undo/redo for all operations
3. Auto-save to localStorage
4. Project templates

## 📝 Technical Specifications

### Audio Format Support
- **Input**: MP3, WAV, OGG, FLAC, M4A
- **Output**: MP3 (compressed), WAV (lossless)
- **Sample Rate**: 44.1kHz, 48kHz auto-detection
- **Bit Depth**: 16-bit (MP3), 24-bit (WAV stems)

### Stem Separation
- **Model**: Demucs v4 (cjwbw/demucs)
- **Stems**: 4-track (vocals, drums, bass, other)
- **Quality**: Professional-grade separation
- **Processing**: ~30-60s for 3-minute song
- **Cost**: 15 credits per operation

### Performance Targets
- **Latency**: <10ms click-to-sound
- **Tracks**: Support 50+ simultaneous tracks
- **Clips**: Handle 500+ clips without lag
- **Zoom**: Smooth 60fps at all zoom levels
- **Memory**: <500MB for typical session

## 🔍 Known Limitations (To Address)

1. **No Time-Stretching**: Clips play at original tempo only
2. **No Offline Bounce**: Export is direct file download, not mix-down
3. **No Automation**: Volume/pan changes not recordable
4. **No MIDI**: Audio-only, no virtual instruments
5. **No VST Support**: Built-in effects only

## 💡 Quick Wins (Low-Hanging Fruit)

1. **Spacebar to Play/Pause**: Already partially implemented, ensure global
2. **Click Timeline to Seek**: Add onClick handler to timeline ruler
3. **Double-Click Clip to Solo**: Quick workflow enhancement
4. **Shift+Drag for Copy**: Duplicate clips easily
5. **Delete Key on Selection**: Remove selected clip/track

## 🎨 UI/UX Improvements Applied

- ✅ Glassmorphism scrollbar with auto-hide
- ✅ Editable track names with inline UI
- ✅ Download button per track
- ✅ Stem split modal with format selection
- ✅ Modern gradient buttons throughout
- ✅ Smooth transitions and hover states
- ✅ Professional color scheme (teal/cyan)

## 🚀 Next Steps

1. **Immediate**: Fix multi-track sync with precision scheduler
2. **Short-term**: Implement hot-swap state management
3. **Medium-term**: Add waveform caching and performance optimizations
4. **Long-term**: Automation lanes, MIDI support, VST hosting

---

**Status**: Stem splitter, editable tracks, and downloads complete. Playback engine requires precision scheduler implementation for production-quality sync.
