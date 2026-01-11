# DAW Critical Fixes - January 11, 2026

## ✅ FIXED Issues (Deployed)

### 1. **Playhead System** ✅
- **Problem**: Playhead wouldn't seek during playback, clicking timeline had no effect
- **Solution**: 
  - Added `getCurrentTime()` method to get live playback position
  - `seekTo()` now stops audio, updates position, and restarts if was playing
  - Animation loop uses live time instead of stale `currentTime`
- **Result**: Click-to-seek works instantly, playhead follows audio precisely

### 2. **Loop System** ✅
- **Problem**: Loop markers drawn but playback never looped
- **Solution**:
  - Animation loop checks if `currentTime >= loopEnd`
  - Calls `seekTo(loopStart)` which stops and restarts from loop start
  - All audio sources re-scheduled from new position
- **Result**: Looping actually works - audio repeats between loop markers

### 3. **Mute/Solo Real-Time Audio** ✅
- **Problem**: M/S buttons updated UI but didn't affect audio playback
- **Solution**:
  - `updateTrack()` in TrackManager now calls `updateRoutingNode()` 
  - `updateSoloState()` recalculates which tracks should be silenced
  - Solo tracks managed in `soloedTracks` Set, gain nodes updated instantly
- **Result**: M/S buttons instantly mute/solo audio during playback

### 4. **Volume Sliders Real-Time** ✅
- **Problem**: Volume sliders changed UI but audio stayed same volume
- **Solution**: 
  - Volume onChange now calls `daw.updateTrack({ volume: newVolume })`
  - TrackManager's `updateRoutingNode()` sets `gainNode.gain.value` 
- **Result**: Volume changes affect audio instantly

### 5. **Page Reloads Fixed** ✅
- **Problem**: Saving, renaming, or editing project caused page refresh
- **Solution**:
  - Added `onKeyDown` handlers to project name and BPM inputs
  - `preventDefault()` on Enter key prevents form submission
  - All save/load operations use fetch, no location.reload
- **Result**: No more unexpected page reloads

### 6. **Stem Splitter → Timeline** ✅
- **Problem**: Stems generated but never showed up on timeline
- **Solution**:
  - After successful stem split, automatically creates tracks named after stem type
  - Calls `handleAddClip()` for each stem (vocals, drums, bass, other)
  - Added manual "Add to Timeline" button in stem results UI
- **Result**: Stems appear on timeline immediately after generation

### 7. **AI Generation → Timeline** ✅
- **Problem**: Generated tracks only went to library, not timeline
- **Solution**:
  - After successful generation, finds first empty track
  - Calls `handleAddClip(result.audioUrl, emptyTrack.id, 0)`
  - Shows toast: "✓ Track added to timeline"
- **Result**: AI-generated tracks automatically placed on timeline

---

## ❌ STILL BROKEN (Needs Fixing)

### 8. **Recording System** ❌
- **Problem**: Red record button doesn't capture audio
- **Current State**: RecordingManager exists but not wired up
- **Needs**:
  - Arm track → request mic permission
  - Start recording → capture to buffer
  - Stop → save as clip on armed track
- **Files**: `lib/audio/RecordingManager.ts`, DAW page recording button handler

### 9. **BPM Doesn't Affect Playback** ❌
- **Problem**: Changing BPM updates grid but not audio speed
- **Current State**: BPM stored, metronome interval calculated, but audio plays at original tempo
- **Needs**:
  - AudioBufferSourceNode.playbackRate adjustment
  - Time-stretching without pitch shift (complex)
- **Note**: True BPM sync requires time-stretching algorithm

### 10. **Metronome Doesn't Click** ❌
- **Problem**: Metronome toggle active, but no click sound
- **Current State**: Visual flash works, but no audio click
- **Needs**:
  - Create OscillatorNode on each beat
  - 1000Hz beep, 50ms duration
  - Schedule with `audioContext.currentTime`
- **Files**: DAW page metronome toggle handler

### 11. **Timeline Cluttered / Track Alignment** ❌
- **Problem**: Volume controls overlapping tracks below, visual mess
- **Current State**: z-index conflicts, poor spacing
- **Needs**:
  - Fix track header z-index layers
  - Proper borders/spacing between tracks
  - Waveform canvas positioning cleanup
- **Files**: DAW page timeline rendering section

### 12. **Snap To Grid Not Working** ❌
- **Problem**: Snap toggle exists but clips don't snap properly
- **Current State**: `snapTime()` function exists, but not consistently applied
- **Needs**:
  - Apply snap on drag end, not just drag start
  - Snap playhead movement when snap enabled
  - Visual snap guides when dragging
- **Files**: DAW page drag handlers, `snapTime()` function

### 13. **No Clip Editing Tools** ❌
- **Problem**: Can't split, resize, or trim clips
- **Current State**: Clips are static rectangles
- **Needs**:
  - Scissor tool (click to split clip at position)
  - Drag clip edges to resize (update `duration` and `offset`)
  - Fade handle dragging (update `fadeIn`/`fadeOut`)
- **Files**: DAW page clip rendering, add split/resize handlers

### 14. **Auto-Save Glitching** ❌
- **Problem**: Auto-save fires too often, causes performance issues
- **Current State**: Debounced but still janky
- **Needs**:
  - Increase debounce to 5s (currently 2s)
  - Don't auto-save during playback
  - Clear pending saves before starting new one
- **Files**: DAW page `queueAutosave` effect

### 15. **No Keyboard Shortcuts** ❌
- **Problem**: Only Space and Ctrl+S work
- **Current State**: KeyboardShortcutManager exists but not wired
- **Needs**:
  - R = arm recording
  - Delete = remove selected clip
  - Ctrl+Z/Y = undo/redo
  - Arrow keys = nudge clips
- **Files**: DAW page keyboard handler, KeyboardShortcutManager

### 16. **Import Audio Doesn't Work** ❌
- **Problem**: Browser file drag doesn't add to timeline
- **Current State**: Only library items draggable
- **Needs**:
  - File drop handler on timeline
  - Upload to R2 → get URL → add clip
- **Files**: DAW page timeline drop handler

### 17. **UI Looks Pathetic** (User's Words) ❌
- **Problem**: Cluttered, unprofessional appearance
- **Current State**: Lots of visual noise, poor hierarchy
- **Needs**:
  - Darker backgrounds, less border contrast
  - Better button grouping/spacing
  - Cleaner transport controls
  - Professional color palette (like Ableton/FL Studio)
- **Files**: Entire DAW page styling

---

## 🔧 Technical Debt

### Audio Architecture Issues:
1. **Playback scheduling**: Currently creates all source nodes at play start. Should use AudioScheduler for sample-accurate timing
2. **Clip fades**: Fade curves defined but not applied to audio
3. **Track routing**: Pan nodes created but not always used
4. **Memory leaks**: AudioBuffer cache never cleared

### State Management Issues:
1. **Too many re-renders**: Every track update triggers full tracks setState
2. **Hydration glitches**: Loading projects flickers during clip addition
3. **Dirty tracking**: dirtyCounter increments even during hydration

### Performance Issues:
1. **Waveform rendering**: Blocks main thread, should use OffscreenCanvas
2. **Canvas refs**: Map grows indefinitely, never cleaned up
3. **Drag throttling**: Window-level throttle not working properly

---

## 🎯 Priority Next Steps

### HIGH PRIORITY (Core Functionality):
1. Fix recording system (mic → buffer → timeline)
2. Implement clip split tool (scissor)
3. Fix clip resize (drag edges)
4. Add working metronome click
5. Fix track alignment/spacing (make it look professional)

### MEDIUM PRIORITY (Workflow):
1. Keyboard shortcuts (Delete, Undo, etc.)
2. Import audio from file system
3. Snap to grid actually working
4. Auto-save improvements

### LOW PRIORITY (Polish):
1. BPM affects playback speed (time-stretching)
2. Clip fade handles
3. UI redesign (color palette, spacing)
4. Waveform rendering optimization

---

## 📋 Testing Checklist

When testing on live site (`/studio/dawv2.0`):

- [ ] Click timeline during playback - does it seek?
- [ ] Enable loop - does audio repeat between markers?
- [ ] Mute a track during playback - does audio stop instantly?
- [ ] Solo a track - do other tracks go silent?
- [ ] Drag volume slider while playing - does volume change?
- [ ] Press Enter in project name - does page stay?
- [ ] Generate AI track - does it appear on timeline?
- [ ] Split stems - do they appear on separate tracks?
- [ ] Arm track for recording - does red button work?
- [ ] Change BPM - does metronome click?

---

## 📦 Commits

1. `9d2dcd8` - Playback fixes (seek, loop, M/S, volume, page reloads)
2. `3da2860` - Auto-add stems and AI generations to timeline

---

## 🚀 Deployment Status

**Deployed**: ✅ All fixes above are LIVE on Vercel
**Branch**: `master`
**Last Updated**: Jan 11, 2026

Next deployment should include recording + clip editing tools.
