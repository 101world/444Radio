# AudioMass-Style Clips System

## 🎯 Overview
The multi-track studio now uses an **AudioMass-inspired clips system** where tracks are containers for multiple draggable audio clips, instead of single-file tracks.

---

## 🏗️ Architecture Changes

### Old Approach (Single-file tracks)
```typescript
Track {
  audioUrl: string;  // One file per track
  // WaveSurfer renders entire file
}
```

### New Approach (Clips-based)
```typescript
Track {
  clips: AudioClip[];  // Multiple clips per track
}

AudioClip {
  id: string;
  trackId: string;
  audioUrl: string;
  startTime: number;  // Position on timeline
  duration: number;
  offset: number;     // Trim start
  color: string;
}
```

---

## 📁 Modified Files

### 1. **hooks/useMultiTrack.ts**
**Changes:**
- ✅ Added `AudioClip` interface with `trackId` property
- ✅ Added `clips: AudioClip[]` array to `Track` interface
- ✅ Added `selectedClipId` state
- ✅ Added clip management functions:
  - `addEmptyTrack()` - Creates track with no clips
  - `addClipToTrack(trackId, audioUrl, name, startTime)` - Adds clip to existing track
  - `moveClip(clipId, newStartTime)` - Updates clip position
  - `removeClip(clipId)` - Removes clip from track
  - `setSelectedClip(id)` - Selects clip for editing

**Backward Compatibility:**
- `Track.audioUrl` still exists (set to `null` for empty tracks)
- `addTrack(name, audioUrl)` still works (creates track with one clip if audioUrl provided)

---

### 2. **app/components/studio/Timeline.tsx** (Complete Rebuild)
**Changes:**
- ✅ Removed single WaveSurfer per track
- ✅ Tracks now render `track.clips.map()` with `AudioClip` components
- ✅ Empty tracks show drop zone with "Drop audio files here" message
- ✅ Drag & drop onto specific tracks (calculates startTime from drop position)
- ✅ Track controls: volume, pan, mute, solo, delete
- ✅ Simplified context menu (no single-file operations on empty tracks)

**Track States:**
- **Empty Track**: Shows dashed border drop zone with music icon
- **Track with Clips**: Renders each clip as draggable region
- **Selected Track**: Purple ring border
- **Drag Over**: Cyan ring with background highlight

---

### 3. **app/studio/multi-track/page.tsx**
**Changes:**
- ✅ Auto-creates 3 empty tracks on mount (AudioMass style)
- ✅ Added "Add Track" button to header
- ✅ Removed empty state conditional (Timeline always renders)
- ✅ Fixed `useEffect` import

---

### 4. **app/components/studio/AudioClip.tsx** (Already Created)
**Features:**
- Draggable clip with mouse drag handling
- Resize handles on left/right edges (UI ready, handler pending)
- Visual: background grid, name, duration, waveform placeholder
- Delete button when selected
- Cyan ring when selected
- Position calculated from `startTime * zoom * 50px`

---

## 🎨 User Experience

### Creating Empty Tracks
1. Click "Add Track" button → creates empty track
2. Or auto-created 3 tracks on first load

### Adding Clips to Tracks
**Method 1: Drag & Drop**
1. Drag audio file from file system
2. Drop onto any track (empty or with existing clips)
3. Drop position determines `startTime` on timeline
4. File loads → clip appears at drop position

**Method 2: Import Button** (future)
1. Click "Import Audio Files"
2. Select multiple files
3. Each file added as clip to selected track (or new track)

### Moving Clips
1. Click clip to select (cyan ring)
2. Drag left/right to reposition on timeline
3. `onMove` updates `clip.startTime`

### Deleting Clips
1. Select clip (click)
2. Click delete button (trash icon in clip)
3. Or right-click → Delete Clip

---

## 🎵 Timeline Layout

```
┌─────────────────────────────────────────────────────────────┐
│  TimelineRuler (zoom controls, time markers, playhead)      │
├─────────────────────────────────────────────────────────────┤
│  Track 1: [Clip A] [Clip B]         [Clip C]                │
│  Track 2: [Drop audio files here - empty]                   │
│  Track 3:          [Clip D]                                  │
└─────────────────────────────────────────────────────────────┘
```

**Clip Positioning:**
- X position = `startTime * zoom * 50px`
- Width = `duration * zoom * 50px`
- Clips can overlap (last rendered on top)

---

## 🔧 Zoom System

**Zoom Levels:** 0.1x to 10x (controlled by TimelineRuler)

**Affects:**
- Clip widths (`duration * zoom * 50px`)
- Timeline ruler intervals (1s, 5s, 10s based on zoom)
- Drop position calculation (`dropX / (zoom * 50)`)

**Example:**
- Zoom 1x: 10-second clip = 500px wide
- Zoom 2x: 10-second clip = 1000px wide
- Zoom 0.5x: 10-second clip = 250px wide

---

## 🎛️ Track Controls (per track)

Located in track header:

1. **Color Indicator** - Track color (also applied to clips)
2. **Track Name** - Click to select track
3. **Volume Slider** - 0-100% (horizontal slider)
4. **Mute Button** - Red when active
5. **Solo Button** - Yellow when active (mutes all other tracks)
6. **Delete Button** - Removes track and all clips

---

## 🎯 Context Menu (Right-click)

**Empty Tracks:**
- Delete Track

**Tracks with Clips:**
- Delete Track
- Duplicate Track (TODO)
- Volume submenu (Normalize, Gain, Fade In, Fade Out)
- Effects submenu (Delay, Reverb, Compressor, Distortion, etc.)
- Filters submenu (Low Pass, High Pass)
- Advanced submenu (Speed Change, Vocal Remover, Stereo Widen)

**Clips:** (TODO - separate clip context menu)
- Cut, Copy, Paste
- Split at playhead
- Normalize, Gain, Fade
- Delete Clip

---

## 🚧 Pending Implementation

### High Priority
1. **Clip Waveform Rendering**
   - Currently shows placeholder grid
   - Options:
     - One WaveSurfer per clip (memory intensive)
     - WaveSurfer Regions plugin (better)
     - Canvas-based waveform drawing (best performance)

2. **Clip Trimming/Resizing**
   - Resize handles present in UI
   - Need to wire up `onResize` handler
   - Update `clip.duration` and `clip.offset`

3. **Clip Drag Between Tracks**
   - Detect vertical drag to different track
   - Move clip to new track's clips array
   - Visual feedback: highlight target track

4. **Synchronized Playback**
   - Play all clips across all tracks
   - Respect `startTime` positions
   - Master transport controls all clips

### Medium Priority
5. **Effects Chain Management**
   - Add/remove effects per track or clip
   - Display in TrackInspector
   - Reorder effects (drag to reorder)

6. **Effect Parameter Modals**
   - Replace `prompt()` dialogs
   - GainModal, DelayModal, ReverbModal, etc.
   - Use GlassModal component

7. **Clip Context Menu**
   - Separate from track context menu
   - Clip-specific operations (split, copy, normalize, etc.)

### Low Priority
8. **AI Generation Integration**
   - Wire up "AI Generate" button
   - Add generated audio as clip to selected track

9. **Library Drag & Drop**
   - Drag from library sidebar onto tracks

10. **Export System**
    - Mix all clips using audio-utils
    - Encode to MP3 with lame.js

---

## 📊 State Management Flow

```
User Action → StudioContext → useMultiTrack Hook → State Update → Timeline Re-render

Examples:
1. Drop file → handleDrop → addClipToTrack → tracks updated → clip appears
2. Drag clip → handleMouseMove → moveClip → clip.startTime updated → position changes
3. Delete clip → onDelete → removeClip → tracks updated → clip removed
```

---

## 🧪 Testing Checklist

### Basic Functionality
- [ ] Create empty track (click "Add Track")
- [ ] Drag audio file onto empty track
- [ ] Verify clip appears at drop position
- [ ] Drag clip left/right (verify position updates)
- [ ] Delete clip (click delete button)
- [ ] Delete track (click track delete button)

### Multiple Clips
- [ ] Add 2+ clips to same track
- [ ] Verify clips don't interfere with each other
- [ ] Drag clips past each other (overlap)
- [ ] Delete one clip (verify others unaffected)

### Multiple Tracks
- [ ] Create 3+ tracks
- [ ] Add clips to each track
- [ ] Verify each track independent
- [ ] Delete middle track (verify others unaffected)

### Zoom
- [ ] Zoom in (clips get wider)
- [ ] Zoom out (clips get narrower)
- [ ] Verify drop position respects zoom level

### Track Controls
- [ ] Adjust volume (verify slider works)
- [ ] Mute track (red icon)
- [ ] Solo track (yellow icon, others muted)
- [ ] Pan control (left/right)

---

## 🎓 Usage Examples

### Example 1: Building a Beat
```typescript
// 1. Create 4 empty tracks
addEmptyTrack(); // Drums
addEmptyTrack(); // Bass
addEmptyTrack(); // Melody
addEmptyTrack(); // Vocals

// 2. Drag files onto tracks
// User drags "kick.wav" → Track 1 at 0s
// User drags "bass.wav" → Track 2 at 0s
// User drags "synth.wav" → Track 3 at 4s
// User drags "vocal.wav" → Track 4 at 8s

// 3. Arrange clips
// Drag kick clip to repeat at 0s, 2s, 4s, 6s
// Drag bass clip to start at 2s

// 4. Adjust levels
setTrackVolume(drumTrack, 0.9);
setTrackVolume(bassTrack, 0.7);
toggleMute(vocalTrack); // Preview without vocals
```

### Example 2: Podcast Editing
```typescript
// 1. Create 3 tracks
addEmptyTrack(); // Host
addEmptyTrack(); // Guest
addEmptyTrack(); // Intro/Outro Music

// 2. Add clips
addClipToTrack(hostTrack, 'host-take1.wav', 'Host', 0);
addClipToTrack(hostTrack, 'host-take2.wav', 'Host', 60);
addClipToTrack(guestTrack, 'guest-response.wav', 'Guest', 30);
addClipToTrack(musicTrack, 'intro.wav', 'Intro', 0);

// 3. Trim and arrange
moveClip(guestClipId, 25); // Move earlier
// Resize clips to remove silence
```

---

## 🔮 Future Enhancements

1. **Multi-track Selection**
   - Shift+click to select multiple clips
   - Move/delete multiple clips at once

2. **Clip Splitting**
   - Split clip at playhead position
   - Creates two clips with adjusted offsets

3. **Clip Duplication**
   - Cmd/Ctrl+D to duplicate selected clip
   - Paste at playhead position

4. **Snap to Grid**
   - Snap clips to beat grid (1s, 0.5s, 0.25s)
   - Toggle in TimelineRuler

5. **Clip Colors**
   - Override track color per clip
   - Color coding for clip types (vocal, drums, etc.)

6. **Waveform Editing**
   - Click waveform to place playhead
   - Double-click to open in detailed editor

7. **Automation**
   - Volume/pan automation per clip
   - Draw automation curves

8. **Markers**
   - Add timeline markers (intro, verse, chorus, etc.)
   - Jump to markers with shortcuts

---

## 📝 Developer Notes

### Key Design Decisions

1. **Why clips array instead of single audioUrl?**
   - More flexible (multiple audio sources per track)
   - Better for real-world workflows (podcasts, music production)
   - Matches AudioMass/Audacity/Reaper architecture

2. **Why trackId in AudioClip?**
   - Enables moving clips between tracks
   - Easier to find clip's parent track
   - Prevents orphaned clips

3. **Why keep Track.audioUrl?**
   - Backward compatibility with existing code
   - Simple migration path (old code still works)
   - Will be deprecated in future

4. **Why Object URLs instead of server storage?**
   - Faster (no upload/download delay)
   - Works offline
   - User controls data (privacy)
   - Will add R2 upload option for persistence

### Performance Considerations

- **WaveSurfer instances:** Each clip needs rendering (memory cost)
  - Solution: Use canvas rendering or Regions plugin
  - Lazy-load: Only render visible clips

- **Drag performance:** Real-time position updates
  - Solution: Use requestAnimationFrame for smooth dragging
  - Debounce state updates

- **Audio playback:** Synchronizing multiple clips
  - Solution: Use Web Audio API SourceNodes with scheduled starts
  - Pre-buffer all clips before playback

---

## 🐛 Known Issues

1. **Clip waveforms don't render** (placeholder grid only)
   - Fix: Implement WaveSurfer per clip or canvas rendering

2. **Resize handles don't work** (UI only)
   - Fix: Wire up onResize handler to update clip.duration/offset

3. **No synchronized playback** (clips play individually)
   - Fix: Implement scheduled playback with Web Audio API

4. **Drop position calculation off when zoomed**
   - Fix: Verify zoom factor applied correctly to dropX calculation

5. **Context menu shows all effects on empty tracks**
   - Fix: Simplified menu for empty tracks (done), but needs clip-specific menu

---

## 📚 Related Documentation

- **Audio Effects:** `lib/audio-effects.ts` - All 18 AudioMass effects
- **Context Menu:** `app/components/studio/ContextMenu.tsx` - Right-click menus
- **Audio Clip Component:** `app/components/studio/AudioClip.tsx` - Clip UI
- **Timeline Ruler:** `app/components/studio/TimelineRuler.tsx` - Zoom and time markers
- **Track Inspector:** `app/components/studio/TrackInspector.tsx` - Right sidebar

---

## ✅ Summary

The multi-track studio now supports:
- ✅ Empty tracks (AudioMass style)
- ✅ Drag & drop audio files onto tracks
- ✅ Multiple clips per track
- ✅ Clip positioning (startTime)
- ✅ Clip selection and deletion
- ✅ Track controls (volume, pan, mute, solo)
- ✅ Zoom system (affects clip widths)
- ✅ Auto-create 3 empty tracks on load

**Next Steps:**
1. Implement clip waveform rendering
2. Wire up clip resize handles
3. Enable clip drag between tracks
4. Implement synchronized playback
5. Add effect parameter modals

**Try it now:**
```bash
npm run dev
# Navigate to /studio/multi-track
# Drag audio files onto empty tracks!
```
