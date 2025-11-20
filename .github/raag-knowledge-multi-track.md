# 444 RADIO STUDIO - MULTI-TRACK DAW KNOWLEDGE BASE

## System Overview

**Official Name**: 444 Radio Studio (NOT "444 DAW")  
**Location**: `/studio/multi-track`  
**Version**: 3.0.0 - Ultimate Edition  
**Technology**: Next.js 15 App Router, React 19, TypeScript, Web Audio API  
**File**: `app/studio/multi-track/page.tsx` (1,511 lines)

This is the **flagship professional DAW** of the 444Radio platform, combining Logic Pro's workflow, Ableton Live's creativity, FL Studio's beat-making power, and AI generation capabilities unique to 444Radio.

---

## Architecture & Data Flow

### Component Structure
```
DAWPage (Provider Wrapper)
└─ StudioProvider
   └─ DAWUltimate (Main Component)
      ├─ Header (Logo, Controls, Credits)
      ├─ Toolbar (View Modes, Tools)
      ├─ Left Sidebar (Library/Browser)
      ├─ Main Timeline Area
      │  ├─ TimelineRuler (Time markers)
      │  ├─ Track List (left gutter with controls)
      │  └─ Timeline (clips container with pl-4 padding)
      ├─ Right Sidebar (Inspector)
      ├─ TransportBar (Playback controls)
      └─ Modals (Beat/Song/Stem/Export/Release/Shortcuts)
```

### State Management (28 State Variables)

**Project State**:
- `projectName` - Current project title (default: "Untitled Project")
- `bpm` - Beats per minute (default: 120)
- `timeSig` - Time signature: '4/4' | '3/4' | '6/8'
- `snapEnabled` - Grid snapping (default: true)
- `playheadLocked` - Auto-scroll playhead (default: true)
- `seekToEarliestOnPlay` - Jump to first clip on play (default: true)

**UI State**:
- `activeTool` - Current tool: 'select' | 'cut' | 'zoom' | 'pan'
- `showLibrary` - Library sidebar visibility (default: true)
- `showInspector` - Inspector sidebar visibility (default: true)
- `showBrowser` - Browser sidebar visibility (default: true)
- `libraryTab` - Active library tab: 'music' | 'effects'
- `viewMode` - View mode: 'arrange' | 'mix' | 'edit'

**Modal State**:
- `showBeatModal` - Beat generation modal
- `showSongModal` - Song generation modal
- `showStemModal` - Stem split modal
- `showExportModal` - Export dialog
- `showReleaseModal` - Release to platform dialog
- `showShortcuts` - Keyboard shortcuts help
- `showProjectMenu` - Project save/load menu

**Generation State**:
- `generationQueue` - Array of `QueueItem[]` (AI generation tasks)
- `stemSplitClip` - Current clip being split: `{ id, url, name } | null`
- `isSplittingStem` - Stem operation in progress

**Library State**:
- `isLoadingLibrary` - Library fetch status
- `libraryTracks` - User's music library items
- `libraryEffects` - User's audio effects library

**Other State**:
- `credits` - User's available credits (fetched from API)
- `isDragOver` - Drag & drop overlay state
- `notification` - Toast notification: `{ message, type } | null`
- `rememberPreset` - 1080p layout preset preference
- `savedProjects` - Project history (max 10, stored in localStorage)

### Context Dependencies (useStudio Hook)

From `StudioContext` via `useMultiTrack`:
- `tracks` - Array of track objects
- `addTrack(name, audioUrl?, color?, duration?, blob?)` - Returns `trackId`
- `addEmptyTrack()` - Creates blank track
- `removeTrack(trackId)` - Deletes track
- `addClipToTrack(trackId, url, name, startTime?, duration?, blob?)` - Adds audio clip
- `togglePlayback()` - Play/pause transport
- `isPlaying` - Playback state
- `setPlaying(boolean)` - Manual playback control
- `toggleMute(trackId)` - Mute/unmute track
- `toggleSolo(trackId)` - Solo/unsolo track
- `selectedTrackId` - Currently selected track
- `undo()` - Undo last action
- `redo()` - Redo undone action
- `canUndo` - Undo availability
- `canRedo` - Redo availability
- `setZoom(level)` - Timeline zoom level
- `setLeftGutterWidth(px)` - Track list width
- `setTrackHeight(px)` - Track row height
- `trackHeight` - Current track height
- `leftGutterWidth` - Current gutter width

### Track Data Structure
```typescript
interface Track {
  id: string;
  name: string;
  color: string; // Hex color
  volume: number; // 0.0-1.0
  pan: number; // -1.0 to 1.0
  mute: boolean;
  solo: boolean;
  clips: Clip[];
}

interface Clip {
  id: string;
  name: string;
  url: string; // Audio file URL
  startTime: number; // Position in timeline (seconds)
  duration: number; // Length (seconds)
  offset: number; // Trim start (seconds)
  volume: number; // Clip volume (0.0-1.0)
}
```

### Queue Item Structure
```typescript
interface QueueItem {
  id: string; // e.g., 'beat_1732130400000'
  type: 'beat' | 'song' | 'stems';
  prompt: string; // User input or description
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: string; // Human-readable status (e.g., 'Queued - Using Stable Audio 2.5')
  timestamp: number; // Date.now()
  result?: { audioUrl: string; imageUrl?: string; lyrics?: string }; // On success
  error?: string; // On failure
  trackId?: string; // Associated track ID
}
```

---

## Critical Fixes Applied

### 1. **File Upload Bug (MOST CRITICAL)**
**Problem**: Passing track IDs as track names caused invalid URLs like `track_1732130400000_0` instead of proper audio URLs.

**Solution** (Lines 535-541):
```typescript
// BEFORE (BROKEN):
const newTrackId = `track_${Date.now()}_${i}`;
addTrack(file.name.replace(/\.[^/.]+$/, ''), newTrackId); // Wrong!

// AFTER (CORRECT):
const trackName = file.name.replace(/\.[^/.]+$/, '');
const newTrackId = addTrack(trackName, clip.url, undefined, clip.duration);
```
**Why This Works**: `addTrack()` returns a generated track ID when called correctly. The second parameter should be `audioUrl`, not a custom ID.

### 2. **Timeline Overlap Fix**
**Problem**: Track list was covering timeline clips area.

**Solution** (Line 1234-1237):
```tsx
<Timeline
  snapEnabled={snapEnabled}
  bpm={bpm}
  activeTool={activeTool}
  playheadLocked={playheadLocked}
  onSplitStems={handleSplitStems}
  clipsContainerRef={clipsScrollRef}
  className="pl-4" // Added left padding to prevent overlap
/>
```

### 3. **Enhanced Generation Queue**
**Problem**: Generic queue messages didn't indicate which AI model was being used.

**Solution** (Lines 610, 681):
```typescript
// Beat generation:
progress: 'Queued - Using Stable Audio 2.5'

// Song generation:
progress: 'Queued - Using MiniMax Music 1.5'
```

### 4. **Missing Dependencies**
**Problem**: Timeline component needed refs and callbacks that weren't passed.

**Solution**:
- Added `clipsScrollRef` (Line 175): `const clipsScrollRef = useRef<HTMLDivElement | null>(null);`
- Added `handleSplitStems` callback (Line 741): Opens stem split modal with clip data

### 5. **Branding Update**
**Problem**: UI still showed "444 DAW" instead of official "444 Radio Studio" branding.

**Solution**:
- Line 2: Updated header comment
- Line 884: Updated logo text in header

---

## Core Features

### 🎵 Production Capabilities

1. **Multi-Track Timeline**:
   - Unlimited tracks (add via `+` key or button)
   - Waveform visualization
   - Real-time audio playback with Web Audio API
   - Drag & drop from desktop or library
   - Snap-to-grid with configurable BPM
   - Per-track volume, pan, mute, solo
   - Color-coded tracks

2. **Timeline Controls**:
   - Zoom: `Ctrl + Mouse Wheel` or zoom slider
   - Snap toggle: Grid snapping on/off
   - Playhead lock: Auto-scroll during playback
   - Time signature: 4/4, 3/4, 6/8
   - BPM: 60-200 range

3. **Track Management**:
   - Add empty track: `+` key or "Add Track" button
   - Remove track: Select + `Delete` key
   - Duplicate: Select + `D` key
   - Mute: Select + `M` or `T` key
   - Solo: Select + `S` key

### 🤖 AI Generation

1. **Beat Generation** (Keyboard: `B`):
   - Model: **Stable Audio 2.5**
   - Cost: ~$0.20 per generation
   - Inputs: Prompt, genre, BPM, duration
   - Output: ~30s instrumental beat
   - Auto-adds to new track
   - Saves to library

2. **Song Generation** (Keyboard: `A`):
   - Model: **MiniMax Music 1.5**
   - Cost: ~$0.03 per generation
   - Inputs: Prompt, genre, lyrics (optional)
   - Output: Full song with vocals/lyrics
   - Generates cover art (optional)
   - Auto-adds to new track
   - Saves to library with metadata

3. **Stem Splitting**:
   - Model: **nateraw/autotune** (Replicate)
   - Cost: ~$0.00020 per generation
   - Inputs: Audio clip, format (MP3/WAV)
   - Output: 4 stems (vocals, drums, bass, other)
   - Creates 4 new tracks
   - Takes ~30-60 seconds

**Generation Queue System**:
- Displays in bottom-right corner
- Shows model name in queue status
- Progress states: Queued → Processing → Complete/Failed
- Auto-removes completed items after 5 seconds

### 💾 Project Management

1. **Save/Load**:
   - Save: `Ctrl+S` or "Save" button
   - Format: JSON in localStorage (`daw_project_[timestamp]`)
   - Stores: Tracks, clips, BPM, time signature, volumes, pans
   - Project index: Max 10 recent projects
   - Auto-save: Every 30 seconds (to `studio_autosave`)

2. **Export** (Keyboard: `E`):
   - Formats: WAV (uncompressed), MP3 (compressed)
   - Options: Include metadata, normalize audio
   - Downloads to user's device
   - Preserves full mix (volume/pan/effects)

3. **Release to Platform**:
   - Publishes to 444Radio Explore page
   - Requires: Title, cover art (optional), visibility setting
   - Creates entry in `combined_media` table
   - Saves to user's library

### ⌨️ Keyboard Shortcuts (Comprehensive)

**Playback**:
- `Space` - Play/Pause
- `Ctrl+U` - Import audio files

**Tools** (No Ctrl/Meta):
- `V` - Select/Cursor tool
- `C` - Cut/Split tool
- `Z` - Zoom tool
- `H` - Hand/Pan tool

**Track Management**:
- `+` or `=` - Add new track
- `Delete` or `Backspace` - Remove selected track
- `D` - Duplicate selected track
- `T` or `M` - Mute selected track
- `S` - Solo selected track

**Generation**:
- `A` - Open song generation modal
- `B` - Open beat generation modal

**UI Toggles**:
- `L` - Toggle library sidebar
- `F7` - Toggle keyboard shortcuts help

**Project**:
- `Ctrl+S` - Save project
- `E` - Open export modal
- `Ctrl+Z` - Undo
- `Ctrl+Y` or `Ctrl+Shift+Z` - Redo

**Placeholder** (Not Implemented):
- `R` - Speed control (planned feature)

---

## API Integrations

### AI Generation Endpoints

1. **Beat Generation**: `/api/studio/generate-beat`
   ```typescript
   POST /api/studio/generate-beat
   Body: {
     prompt: string;
     genre?: string;
     bpm?: number;
     duration?: number;
   }
   Returns: {
     audioUrl: string;
     duration: number;
   }
   ```

2. **Song Generation**: `/api/studio/generate-song`
   ```typescript
   POST /api/studio/generate-song
   Body: {
     prompt: string;
     genre?: string;
     lyrics?: string;
     generateCover?: boolean;
   }
   Returns: {
     audioUrl: string;
     imageUrl?: string;
     title: string;
     lyrics?: string;
     duration: number;
   }
   ```

3. **Stem Splitting**: `/api/studio/split-stems`
   ```typescript
   POST /api/studio/split-stems
   Body: {
     audioUrl: string;
     format: 'mp3' | 'wav';
   }
   Returns: {
     vocals: string;
     drums: string;
     bass: string;
     other: string;
   }
   ```

### Credits Management

- **Get Credits**: `GET /api/credits`
  - Returns: `{ credits: number, totalGenerated: number }`
- **Event Listener**: `window.addEventListener('credits:updated', (e) => { ... })`
  - Updates UI when credits change

### Library Integration

- **Load Music**: `GET /api/library/music?userId=${userId}`
- **Load Effects**: `GET /api/library/effects?userId=${userId}`
- **Save to Library**: Automatically saved after successful generation via respective endpoints

---

## File Structure & Dependencies

### Main File
- `app/studio/multi-track/page.tsx` (1,511 lines)

### Layout File
- `app/studio/multi-track/layout.tsx` - Metadata: `title: '444 Radio Studio'`

### Component Dependencies
```typescript
// Contexts
import { StudioProvider, useStudio } from '@/app/contexts/StudioContext';

// Studio Components
import Timeline from '@/app/components/studio/Timeline';
import TransportBar from '@/app/components/studio/TransportBar';
import TimelineRuler from '@/app/components/studio/TimelineRuler';
import TrackInspector from '@/app/components/studio/TrackInspector';
import Toolbar from '@/app/components/studio/Toolbar';
import GenerationQueue from '@/app/components/studio/GenerationQueue';

// Modal Components
import BeatGenerationModal from '@/app/components/modals/BeatGenerationModal';
import SongGenerationModal from '@/app/components/modals/SongGenerationModal';
import StemSplitModal from '@/app/components/modals/StemSplitModal';
import ExportModal from '@/app/components/modals/ExportModal';
import ReleaseModal from '@/app/components/modals/ReleaseModal';

// Lucide Icons
import {
  Play, Pause, Square, Radio, Sparkles, Upload,
  Library, Save, Download, Plus, Undo2, Redo2,
  Settings, User, Trash2, FileMusic, Waveform,
  Music, Mic, Grid3x3, Eye, EyeOff, Keyboard
} from 'lucide-react';

// Clerk Auth
import { useUser } from '@clerk/nextjs';
```

---

## Styling & Layout

### Color Scheme
- Primary: Cyan/Teal gradient (`from-cyan-400 to-blue-500`)
- Background: Black with gray gradient (`from-black via-gray-900 to-black`)
- Accents: Teal borders (`border-teal-900/50`), cyan highlights
- Track colors: Randomly assigned from palette

### Responsive Breakpoints
- Desktop: 1920x1080 optimized
- Tablet: Not primary target (warning shown)
- Mobile: Not supported (requires desktop)

### Layout Preset (1080p)
When `rememberPreset` enabled:
- Left gutter: 240px
- Track height: 80px
- Zoom: 120

---

## Common Issues & Solutions

### Issue 1: Invalid Track URLs After Upload
**Symptom**: 404 errors when playing uploaded files, URLs like `track_1732130400000_0`  
**Cause**: Passing track ID as track name in `addTrack()`  
**Fix**: Use correct signature: `addTrack(name, audioUrl, color?, duration?, blob?)`

### Issue 2: Timeline Clips Hidden by Track List
**Symptom**: Can't see clips in timeline area  
**Cause**: Missing left padding on Timeline component  
**Fix**: Add `className="pl-4"` to `<Timeline>` (Line 1237)

### Issue 3: Play/Pause Not Working
**Symptom**: Transport controls don't respond  
**Root Cause**: Usually related to invalid audio URLs (see Issue 1)  
**Fix**: Ensure all clips have valid `url` properties pointing to audio files

### Issue 4: Generation Queue Not Showing Model
**Symptom**: Generic "Queued" message, unclear which AI is being used  
**Fix**: Enhanced progress messages with model names (Lines 610, 681)

### Issue 5: Old Page Showing After Refresh
**Symptom**: Ctrl+Shift+R shows new page, normal refresh shows old page  
**Cause**: Uncommitted changes or Next.js cache  
**Fix**: 
1. Clear `.next` directory: `Remove-Item -Path ".next" -Recurse -Force`
2. Rebuild: `npm run build`
3. Commit changes: `git add -A && git commit -m "Update"`
4. Deploy: `git push origin master`

### Issue 6: Keyboard Shortcuts Not Working
**Symptom**: Keys don't trigger expected actions  
**Cause**: Input focus on text fields  
**Fix**: Shortcuts automatically disabled when typing in inputs (check `onKey` handler, Line 250)

---

## Performance Considerations

### Optimization Strategies
1. **Lazy Loading**: Heavy modals loaded on-demand
2. **Web Audio API**: Efficient native audio processing
3. **Buffer Caching**: Audio buffers cached per track
4. **Virtual Scrolling**: Timeline clips use CSS transforms for smooth scrolling
5. **Debounced Saves**: Auto-save throttled to 30-second intervals

### Memory Management
- Clip URLs use object URLs (`URL.createObjectURL()`) for local files
- Revoke URLs when clips removed: `URL.revokeObjectURL(clip.url)`
- localStorage size limit: ~5MB for projects (JSON serialization)

---

## Testing & Validation

### Manual Testing Checklist
- [ ] File upload creates valid tracks with playable audio
- [ ] Play/pause controls transport correctly
- [ ] Beat generation adds track with ~30s audio
- [ ] Song generation adds track with full song + metadata
- [ ] Stem splitting creates 4 separate tracks
- [ ] Save/load preserves project state
- [ ] Export downloads correct audio format
- [ ] Keyboard shortcuts work when not typing
- [ ] Timeline zoom/pan functions properly
- [ ] Mute/solo affect audio output
- [ ] Undo/redo restore previous states
- [ ] Generation queue shows correct model names
- [ ] Credits deduct after generation
- [ ] Library loads user's saved content

### Known Limitations
- No real-time collaboration (single-user)
- No VST plugin support (browser-based)
- No MIDI input/output
- No automation lanes (volume/pan envelopes planned)
- No video sync (audio-only for now)
- No mobile support (desktop required)

---

## Deployment Notes

### Build Process
1. Clear cache: `Remove-Item -Path ".next" -Recurse -Force`
2. Build: `npm run build` (uses Turbopack)
3. Verify: Check for TypeScript errors (build will fail if any)
4. Commit: `git add -A && git commit -m "Message"`
5. Deploy: `git push origin master` (triggers Vercel)

### Environment Variables (Required)
See main Copilot instructions for full list. Key ones for multi-track:
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` - Auth
- `CLERK_SECRET_KEY` - Auth server-side
- `REPLICATE_API_TOKEN` - AI generation
- `NEXT_PUBLIC_SUPABASE_URL` - Database
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Database client
- `R2_*` - Cloudflare R2 storage credentials

### Vercel Configuration
- Framework: Next.js 15
- Build command: `npm run build`
- Output directory: `.next`
- Install command: `npm install`
- Node version: 18.x or higher
- Environment: Add all env vars in dashboard

---

## Future Enhancements (Roadmap)

### Planned Features
- [ ] Automation lanes (volume/pan envelopes)
- [ ] Audio effects (reverb, delay, EQ, compressor)
- [ ] MIDI piano roll editor
- [ ] Real-time collaboration (multi-user)
- [ ] Video track support
- [ ] VST plugin bridge (WASM-based)
- [ ] Cloud sync (cross-device projects)
- [ ] Mixer view with channel strips
- [ ] Sample library browser
- [ ] Looping/markers
- [ ] Time stretching/pitch shifting
- [ ] Waveform editing (trim, fade, normalize)

### AI Improvements
- [ ] More AI models (voice cloning, mastering, mixing)
- [ ] Prompt suggestions/templates
- [ ] Genre-specific parameter presets
- [ ] AI-assisted mixing/mastering
- [ ] Lyric generation improvements

---

## Contact & Support

**Project**: 444Radio  
**Repository**: github.com/101world/444Radio  
**Deployment**: Vercel (https://444radio.co.in)  
**Studio URL**: https://444radio.co.in/studio/multi-track  

**For Issues**:
1. Check this knowledge base first
2. Review error logs (browser console + Vercel dashboard)
3. Verify environment variables
4. Test in incognito/private window (rule out cache)
5. Check git diff for uncommitted changes

---

## Version History

### v3.0.0 - Ultimate Edition (Current)
- Complete redesign with modern UI
- Enhanced keyboard shortcuts (20+ shortcuts)
- AI generation queue with model indicators
- File upload bug fix (critical)
- Timeline overlap fix
- Branding update to "444 Radio Studio"
- Project save/load system
- Export/release functionality
- Stem splitting integration
- Library browser with drag-and-drop

### v2.x (Legacy)
- Basic multi-track editor
- Limited AI integration
- Simple timeline

### v1.x (Deprecated)
- Proof of concept
- Single track only

---

**Last Updated**: November 20, 2025  
**Maintainer**: GitHub Copilot (Claude Sonnet 4.5)  
**Status**: Production-Ready ✅
