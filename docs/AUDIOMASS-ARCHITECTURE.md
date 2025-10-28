# AudioMass Architecture - Deep Analysis

## Overview
AudioMass is a vanilla JavaScript audio editor built on **WaveSurfer.js** and **Web Audio API**. It's a single-track editor with sophisticated buffer manipulation and effects processing.

---

## Core Architecture

### 1. Main Components

```
PKAudioEditor (singleton)
  ├── PKEng (Engine) - WaveSurfer wrapper + audio processing
  ├── PKUI (UI) - Interface management, modals, toolbar
  ├── AudioUtils (Actions) - Buffer manipulation utilities
  └── FX System - Effects processors + UI
```

### 2. PKEng (Engine) - `vendor/444studio/src/engine.js` (2904 lines)

**Primary Responsibilities:**
- Wraps WaveSurfer.js for waveform rendering
- Manages audio buffer operations
- Handles file loading/saving
- Controls playback transport

**WaveSurfer Configuration:**
```javascript
WaveSurfer.create({
  container: '#waveform',
  splitChannels: true,        // Show L/R channels separately
  autoCenter: true,           // Auto-center on playback
  pixelRatio: 1,
  height: window.innerHeight - 168,
  hideScrollbar: true,
  progressColor: 'rgba(128,85,85,0.24)',
  plugins: [
    WaveSurfer.regions.create()  // For selection/editing
  ]
})
```

**Key Engine Functions:**
- `LoadArrayBuffer(e)` - Load audio with "Open or append" modal
- `LoadFile(e)` - File input handler with format validation
- `LoadDB()` - Restore from session/database
- `TrimTo(val, num)` - Precision trimming utility
- Backend `_add` flag: 0 = replace, 1 = append to existing

**File Loading Flow:**
```
User selects file
  ↓
LoadFile validates format
  ↓
Shows "Open or append" modal if audio already loaded
  ↓
LoadArrayBuffer processes file
  ↓
Decodes audio → AudioBuffer
  ↓
WaveSurfer renders waveform
```

---

### 3. PKUI (UI) - `vendor/444studio/src/ui.js` (3095 lines)

**Primary Responsibilities:**
- Toolbar and menu management
- Modal system (PKSimpleModal)
- Keyboard shortcuts (KeyHandler)
- Interaction state management
- Export/Download UI

**Key UI Components:**
```javascript
PKUI
  ├── InteractionHandler - Tracks active modals, prevents conflicts
  ├── KeyHandler - Keyboard shortcuts (Space=play, Delete=cut, etc.)
  ├── TopHeader - File menu with Export/Download
  ├── Toolbar - Main editing tools
  └── Modal system - Dialog boxes for operations
```

**Export Modal:**
- Format selection: MP3, WAV, FLAC
- Bitrate options for MP3 (128, 192, 256, 320 kbps)
- Stereo/Mono toggle
- Selection export support

**Event System:**
```javascript
app.fireEvent('EventName', data)  // Emit
app.listenFor('EventName', callback)  // Subscribe
```

---

### 4. AudioUtils (Actions) - `vendor/444studio/src/actions.js` (1788 lines)

**Buffer Manipulation Functions:**

| Function | Purpose | Implementation |
|----------|---------|----------------|
| `loadDecoded(buffer)` | Load processed buffer to WaveSurfer | Replaces backend buffer, updates UI |
| `OverwriteBuffer(withBuffer)` | Replace entire audio | Direct buffer replacement |
| `TrimBuffer(offset, duration, force)` | Cut audio segment | Creates new buffer without trimmed section |
| `CopyBufferSegment(offset, duration)` | Copy audio region | Returns new AudioBuffer with copied data |
| `InsertSegmentToBuffer(offset, buffer)` | Paste audio at position | Splices buffer into existing audio |
| `MakeSilenceBuffer(duration)` | Create silent buffer | Empty Float32Array filled with zeros |

**Channel Operations:**
```javascript
// AudioMass tracks active channels
wavesurfer.ActiveChannels = [1, 1]  // Both channels active
wavesurfer.SelectedChannelsLen = 2

// Buffer processing respects channel selection
for (var i = 0; i < buffer.numberOfChannels; ++i) {
  if (wavesurfer.ActiveChannels[i] === 0) continue;
  // Process active channels only
}
```

**Web Audio API Usage:**
```javascript
// Create buffer
const buffer = audioContext.createBuffer(
  channels,
  length,
  sampleRate
);

// Manipulate channel data
const channelData = buffer.getChannelData(channelIndex);
// channelData is Float32Array: [-1.0 to 1.0]

// Copy data
targetChannel.set(sourceChannel, offset);
```

---

## Effects System

### 1. Effects Architecture

**Effect Flow:**
```
User clicks effect button
  ↓
fireEvent('RequestFXUI_EffectName')
  ↓
UI-FX shows effect modal (parameters)
  ↓
User adjusts parameters + clicks Preview
  ↓
previewEffect() - Real-time preview using scriptNode
  ↓
User clicks Apply
  ↓
applyEffect() - Renders effect using OfflineAudioContext
  ↓
Processed buffer replaces original segment
```

### 2. Preview System (`actions.js` lines 300-700)

**Real-Time Preview:**
```javascript
previewEffect(_offset, _duration, _fx) {
  // 1. Copy buffer segment
  var fx_buffer = CopyBufferSegment(_offset, _duration);
  
  // 2. Create looping source
  var source = audio_ctx.createBufferSource();
  source.buffer = fx_buffer;
  source.loop = true;
  
  // 3. Create effect filter chain
  var filter = _fx.filter(audio_ctx, audio_destination, source, _duration);
  
  // 4. Monitor loudness with scriptNode
  script_node.onaudioprocess = (e) => {
    // Calculate loudness, update UI meters
    audio_destination.getByteFrequencyData(FreqArr);
    fireEvent('DidAudioProcess', loudness, FreqArr);
  };
  
  // 5. Start preview
  source.start();
  this.previewing = 2;
}
```

**Toggle Preview On/Off:**
```javascript
togglePreview() {
  if (this.previewing === 2) {
    // Preview ON → Turn OFF
    PreviewSource.disconnect();
    PreviewSource.connect(PreviewDestination);
    this.previewing = 1;
  } else {
    // Preview OFF → Turn ON
    PreviewSource.disconnect();
    PreviewSource.connect(PreviewFilter);
    PreviewFilter.connect(PreviewDestination);
    this.previewing = 2;
  }
}
```

**Stop Preview:**
```javascript
stopPreview(_fx) {
  _fx.destroy && _fx.destroy();  // Cleanup effect
  PreviewFilter.disconnect();
  PreviewSource.stop();
  PreviewSource.disconnect();
  this.previewing = 0;
}
```

### 3. Apply System (Offline Rendering)

**Permanent Effect Application:**
```javascript
applyEffect(_offset, _duration, _fx) {
  // 1. Copy segment
  var fx_buffer = CopyBufferSegment(_offset, _duration);
  
  // 2. Create OfflineAudioContext for non-real-time processing
  var audio_ctx = getOfflineAudioContext(
    wavesurfer.SelectedChannelsLen,
    orig_buffer.sampleRate,
    fx_buffer.length
  );
  
  // 3. Setup source + filter chain
  var source = audio_ctx.createBufferSource();
  source.buffer = fx_buffer;
  var filter = _fx.filter(audio_ctx, audio_ctx.destination, source, _duration);
  
  // 4. Start rendering
  source.start();
  audio_ctx.startRendering().then((rendered_buffer) => {
    // 5. Replace segment in original buffer
    for (var i = 0; i < orig_buffer.numberOfChannels; ++i) {
      if (wavesurfer.ActiveChannels[i] === 0) continue;
      
      uber_chan_data.set(fx_chan_data, new_offset);
    }
    
    // 6. Load processed buffer back to WaveSurfer
    loadDecoded(uber_buffer);
  });
}
```

### 4. Available Effects (from `ui-fx.js` grep results)

**Discovered Effect Hooks:**
- `RequestFXUI_SELCUT` - Selection Cut
- `RequestFXUI_Gain` - Volume/Gain adjustment
- `RequestFXUI_Silence` - Insert silence
- `RequestFXUI_Normalize` - Audio normalization (likely)
- `RequestFXUI_Fade` - Fade in/out (likely)
- `RequestFXUI_Reverb` - Reverb effect (likely)
- `RequestFXUI_Delay` - Delay/Echo (likely)
- `RequestFXUI_Compress` - Compression (likely)
- `RequestFXUI_EQ` - Parametric EQ (definitely - has fx-pg-eq.js)

### 5. Parametric EQ - `fx-pg-eq.js` (3067 lines)

**EQ Architecture:**
```javascript
PK_FX_PGEQ {
  ranges: [],  // Array of EQ bands
  act: null,   // Currently active band
  
  Add(type, is_on, freq, gain, qval, coords_x, coords_y) {
    // Adds EQ band with:
    // - type: 'peaking', 'notch', 'lowshelf', 'highshelf', etc.
    // - freq: Center frequency (Hz)
    // - gain: Boost/cut in dB (-35 to +35)
    // - q: Q factor (bandwidth)
  }
  
  Remove(range) {
    // Removes EQ band
  }
  
  Render() {
    // Draws frequency response graph
  }
}
```

**EQ Band Object:**
```javascript
{
  id: 1,
  type: 'peaking',
  freq: 1000,      // Hz
  gain: 6,         // dB
  q: 5,            // Q factor
  _on: true,       // Enabled
  _coords: {x, y}, // UI position
  _arr: []         // Frequency response array
}
```

**EQ Implementation Uses:**
- BiquadFilterNode for each band
- Visual frequency response graph
- Real-time preview
- Drag-and-drop band adjustment

---

## Export System

### Download Flow (`actions.js` lines 900-1200)

```javascript
DownloadFile(with_name, format, kbps, selection, stereo, callback) {
  // 1. Get audio buffer
  var originalBuffer = wavesurfer.backend.buffer;
  
  // 2. Convert Float32Array to Int16Array
  var dataAsInt16ArrayLeft = new Int16Array(len);
  while(i < len) {
    dataAsInt16ArrayLeft[i] = convert(data_left[offset + i]);
    ++i;
  }
  
  // 3. Use Web Worker for encoding
  if (format === 'mp3') {
    worker = new Worker('lame.js');  // LAME MP3 encoder
  } else if (format === 'flac') {
    worker = new Worker('flac.js');
  } else {
    worker = new Worker('wav.js');
  }
  
  // 4. Send data to worker
  worker.postMessage({
    channels: channels,
    sampleRate: sample_rate,
    kbps: kbps,
    left: dataAsInt16ArrayLeft,
    right: dataAsInt16ArrayRight
  });
  
  // 5. Worker returns encoded file
  worker.onmessage = (ev) => {
    if (ev.data.percentage) {
      callback(ev.data.percentage);  // Progress
    } else {
      forceDownload(ev.data);  // Download blob
    }
  };
}
```

**Supported Formats:**
- **MP3**: LAME encoder via `lame.js` worker
- **WAV**: Uncompressed PCM via `wav.js` worker
- **FLAC**: Lossless compression via `flac.js` worker

**Export Options:**
- Full track or selection
- Stereo or mono
- MP3 bitrates: 128, 192, 256, 320 kbps
- Channel selection (L only, R only, or both)

---

## Modal System

### PKSimpleModal Pattern

**Basic Usage:**
```javascript
new PKSimpleModal({
  title: 'Modal Title',
  content: 'Modal body content or HTML',
  buttons: [
    {
      text: 'OK',
      type: 'normal',
      callback: function() {
        // OK button action
        return true;  // Close modal
      }
    },
    {
      text: 'Cancel',
      type: 'cancel',
      callback: function() {
        return true;  // Close modal
      }
    }
  ]
});
```

**Modal Types in AudioMass:**
- File operations (Open/Append)
- Export options
- Effect parameters
- Confirmation dialogs
- Error messages

---

## Key Insights for Multi-Track Implementation

### 1. Single-Track Limitation

**Current Architecture:**
- One WaveSurfer instance
- One AudioBuffer
- Effects applied to entire buffer or selection

**Multi-Track Approach:**
```javascript
// Create multiple WaveSurfer instances
tracks = [
  { 
    id: 1, 
    wavesurfer: WaveSurfer.create({...}),
    buffer: AudioBuffer,
    volume: 1.0,
    pan: 0,
    mute: false,
    solo: false,
    effects: []
  },
  { id: 2, ... },
  { id: 3, ... }
]

// Synchronized playback
tracks.forEach(track => {
  track.wavesurfer.play(startTime);
});

// Master mixer
const masterContext = new AudioContext();
tracks.forEach(track => {
  const gainNode = masterContext.createGain();
  gainNode.gain.value = track.volume;
  
  track.wavesurfer.backend.source.connect(gainNode);
  gainNode.connect(masterContext.destination);
});
```

### 2. Buffer Manipulation Reusability

**These functions can be reused as-is:**
- `CopyBufferSegment` - Copy audio
- `TrimBuffer` - Cut segments
- `InsertSegmentToBuffer` - Paste audio
- `MakeSilenceBuffer` - Create silence

**Pattern for React:**
```typescript
// lib/audio-utils.ts
export function copyBufferSegment(
  buffer: AudioBuffer,
  offset: number,
  duration: number
): AudioBuffer {
  const sampleRate = buffer.sampleRate;
  const startSample = (offset * sampleRate) >> 0;
  const endSample = ((offset + duration) * sampleRate) >> 0;
  const length = endSample - startSample;
  
  const newBuffer = new AudioContext().createBuffer(
    buffer.numberOfChannels,
    length,
    sampleRate
  );
  
  for (let i = 0; i < buffer.numberOfChannels; i++) {
    const channelData = buffer.getChannelData(i);
    const newChannelData = newBuffer.getChannelData(i);
    newChannelData.set(channelData.slice(startSample, endSample));
  }
  
  return newBuffer;
}
```

### 3. Effects System Translation

**Vanilla JS Effect Pattern:**
```javascript
const effect = {
  filter: (audioCtx, destination, source, duration) => {
    const gainNode = audioCtx.createGain();
    gainNode.gain.value = 0.5;
    source.connect(gainNode);
    gainNode.connect(destination);
    return gainNode;  // Return for cleanup
  },
  preview: (enabled, source) => {
    // Toggle preview on/off
  },
  destroy: () => {
    // Cleanup
  }
};
```

**React Hook Pattern:**
```typescript
// hooks/useAudioEffect.ts
export function useGainEffect(gain: number) {
  const apply = useCallback((
    audioCtx: AudioContext,
    destination: AudioNode,
    source: AudioNode
  ) => {
    const gainNode = audioCtx.createGain();
    gainNode.gain.value = gain;
    source.connect(gainNode);
    gainNode.connect(destination);
    return gainNode;
  }, [gain]);
  
  return { apply };
}
```

### 4. Modal System Transformation

**AudioMass Modal (Vanilla):**
```javascript
new PKSimpleModal({ title, content, buttons })
```

**React Glassmorphism Modal:**
```tsx
<GlassModal
  isOpen={isOpen}
  onClose={onClose}
  title={title}
  maxWidth="2xl"
>
  {content}
  <div className="flex gap-4 mt-6">
    <button onClick={onOK}>OK</button>
    <button onClick={onClose}>Cancel</button>
  </div>
</GlassModal>
```

---

## Implementation Roadmap for 444Radio Multi-Track Studio

### Phase 1: Core Multi-Track Engine

**Files to Create:**
- `lib/audio-utils.ts` - Port buffer manipulation functions
- `lib/audio-effects.ts` - Port effects functions
- `hooks/useWaveSurfer.ts` - WaveSurfer React hook
- `hooks/useMultiTrack.ts` - Multi-track state management
- `contexts/StudioContext.tsx` - Global studio state

**Key Functions:**
```typescript
// Multi-track engine
interface Track {
  id: string;
  name: string;
  wavesurferInstance: WaveSurfer;
  buffer: AudioBuffer | null;
  volume: number;
  pan: number;
  mute: boolean;
  solo: boolean;
  effects: Effect[];
  color: string;
}

const useMultiTrack = () => {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  
  const addTrack = (audioFile: File) => { /* ... */ };
  const removeTrack = (id: string) => { /* ... */ };
  const playAll = () => { /* Sync all tracks */ };
  const stopAll = () => { /* Stop all tracks */ };
  
  return { tracks, addTrack, removeTrack, playAll, stopAll };
};
```

### Phase 2: Glassmorphism UI Components

**Already Created:**
- ✅ `app/components/studio/GlassModal.tsx`
- ✅ `app/components/studio/EffectModal.tsx`

**Need to Create:**
- `app/components/studio/Timeline.tsx` - Multi-track waveform display
- `app/components/studio/TrackControls.tsx` - Volume/pan/mute/solo per track
- `app/components/studio/TransportBar.tsx` - Play/pause/stop/record
- `app/components/studio/EffectsRack.tsx` - Effect buttons + modals
- `app/components/studio/AISidebar.tsx` - Collapsible generation panel
- `app/components/studio/LibraryPanel.tsx` - Drag-and-drop from Supabase

### Phase 3: Effect Implementations

**Priority Effects (from AudioMass):**
1. **Gain** - Volume adjustment
2. **Normalize** - Auto-level audio
3. **Fade In/Out** - Smooth transitions
4. **Parametric EQ** - Frequency shaping
5. **Reverb** - Space/ambience
6. **Delay** - Echo effects
7. **Compression** - Dynamic range control

**Implementation Pattern:**
```typescript
// app/components/studio/effects/GainModal.tsx
export default function GainModal({ 
  isOpen, 
  onClose, 
  onApply 
}: EffectModalProps) {
  const [gain, setGain] = useState(1.0);
  
  const handlePreview = useCallback(() => {
    // Use AudioMass preview pattern
  }, [gain]);
  
  const handleApply = useCallback(() => {
    onApply({ type: 'gain', value: gain });
    onClose();
  }, [gain, onApply, onClose]);
  
  return (
    <GlassModal isOpen={isOpen} onClose={onClose} title="Gain">
      <EffectModal
        parameters={[{
          type: 'slider',
          label: 'Gain',
          value: gain,
          onChange: setGain,
          min: 0,
          max: 2,
          step: 0.01
        }]}
        onPreview={handlePreview}
        onApply={handleApply}
      />
    </GlassModal>
  );
}
```

### Phase 4: Integration Points

**AI Generation → Studio:**
```typescript
// Generate music → Add as new track
const handleGenerate = async (params: GenerationParams) => {
  const audioUrl = await generateMusic(params);
  const audioFile = await fetch(audioUrl).then(r => r.blob());
  multiTrack.addTrack(new File([audioFile], 'Generated.mp3'));
};
```

**Library → Studio:**
```typescript
// Drag from library → Drop on timeline
const handleDrop = (audioUrl: string, trackId: string, position: number) => {
  multiTrack.insertAudioAtPosition(trackId, audioUrl, position);
};
```

**Studio → Export:**
```typescript
// Mix all tracks → Export
const handleExport = async (format: 'mp3' | 'wav' | 'flac') => {
  const masterBuffer = await multiTrack.mixToMaster();
  const blob = await encodeAudio(masterBuffer, format);
  downloadFile(blob, `mix.${format}`);
};
```

---

## Technical Specifications

### Performance Considerations

**AudioMass Approach:**
- Single WaveSurfer instance: Efficient for single-track
- OfflineAudioContext for effects: Non-blocking processing
- Web Workers for encoding: Prevents UI freeze

**Multi-Track Challenges:**
- Multiple WaveSurfer instances: Higher memory usage
- Synchronized playback: Requires precise timing
- Real-time mixing: CPU intensive

**Optimization Strategies:**
- Lazy-load tracks: Only render visible waveforms
- Virtual scrolling: Don't render all tracks at once
- Audio buffer pooling: Reuse buffers when possible
- Effect caching: Store processed segments
- Web Workers: Offload heavy processing

### Browser Compatibility

**Web Audio API Support:**
- Chrome/Edge: Full support
- Firefox: Full support
- Safari: Full support (requires webkit prefix for older versions)

**WaveSurfer.js Requirements:**
- Modern browsers with Canvas support
- Web Audio API
- ES6+ features

### Memory Management

**Buffer Size Limits:**
- Browser limit: ~1-2GB per AudioBuffer
- Recommended: Keep individual tracks under 100MB
- Strategy: Stream large files instead of loading entirely

**Cleanup Pattern:**
```typescript
useEffect(() => {
  const wavesurfer = WaveSurfer.create({...});
  
  return () => {
    wavesurfer.destroy();  // Clean up
    // Disconnect audio nodes
    // Release buffers
  };
}, []);
```

---

## Summary: AudioMass → 444Radio Studio

### What AudioMass Does Well

✅ **Solid Foundation:**
- Robust buffer manipulation (trim, copy, paste)
- Comprehensive effects system
- Real-time preview with toggle
- Offline rendering for quality
- Export to multiple formats
- Clean event system

✅ **Proven Patterns:**
- WaveSurfer.js integration
- Web Audio API usage
- Modal-based UI
- Keyboard shortcuts

### What We Need to Add

❌ **Multi-Track Capability:**
- Multiple WaveSurfer instances
- Synchronized playback
- Master mixer
- Per-track effects chains

❌ **Modern UI:**
- React components
- Glassmorphism design
- Responsive layout
- Touch-friendly controls

❌ **444Radio Features:**
- AI generation sidebar
- Library integration
- Project persistence
- Social features (share mixes)

### Migration Strategy

1. **Extract Core Logic** - Port buffer/effects functions to TypeScript
2. **Wrap WaveSurfer** - Create React hooks for WaveSurfer instances
3. **Build Multi-Track** - Layer multiple instances with sync
4. **Glassmorphism UI** - Replace vanilla UI with styled components
5. **Integrate Platform** - Connect AI sidebar, library, auth
6. **Test & Optimize** - Performance tuning, browser testing

---

## Next Steps

**Immediate Actions:**
1. Create `lib/audio-utils.ts` with ported buffer functions
2. Create `hooks/useWaveSurfer.ts` for React integration
3. Build `MultiTrackEngine` component with 2-3 test tracks
4. Implement basic playback sync
5. Add one effect (Gain) to validate pattern

**Then:**
6. Build Timeline UI with glassmorphism
7. Add TrackControls (volume, pan, mute, solo)
8. Port remaining effects (EQ, Reverb, Delay, etc.)
9. Build AISidebar with generation flow
10. Integrate LibraryPanel with drag-and-drop

**Finally:**
11. Export system (mix to master → encode → download)
12. Project save/load (store multi-track session)
13. Performance optimization
14. User testing + refinement

---

**Total Lines Analyzed:** 7,787 lines across:
- engine.js (2904)
- ui.js (3095)
- actions.js (1788)
- fx-pg-eq.js (3067 - partial)

**Confidence Level:** HIGH - Core architecture fully understood, effects system mapped, multi-track path clear.
