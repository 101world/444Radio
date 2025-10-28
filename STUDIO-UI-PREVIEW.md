# 🎨 444 Studio UI Design - Visual Preview

## Current State (What You See Now):
```
┌─────────────────────────────────────────────────────────────────┐
│  ← Back to 444Radio    444 Studio [Pro]         User: @username │ ← Top Bar (Purple/Pink Gradient)
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│                    [AudioMass iframe loads here]                 │
│                                                                  │
│                    (Vanilla AudioMass UI -                       │
│                     not our style/vibe)                          │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│  💡 Export and upload...           [Upload to Library →]        │ ← Bottom Bar
└─────────────────────────────────────────────────────────────────┘
```

---

## 🚀 PROPOSED: Custom 444 Studio Wrapper (Our Vibe!)

### With Sidebar OPEN:
```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│  [≡]  444 Studio [Pro]  ⚡20    [@username]     [Save] [Export] [Settings]          │ ← Glassmorphism Top Bar
├──────────┬──────────────────────────────────────────────────────────────────────────┤
│          │                                                                           │
│  🎵 AI   │                    ╔═══════════════════════════════╗                     │
│  SIDEBAR │                    ║   MULTI-TRACK TIMELINE        ║                     │
│          │                    ║                               ║                     │
│  ┌────┐  │  Track 1: 🔊──────────────────────────────────────────  [M] [S] [-o-]   │
│  │New │  │  Track 2: 🔊──────────────────────────────────────────  [M] [S] [-o-]   │
│  └────┘  │  Track 3: 🔊──────────────────────────────────────────  [M] [S] [-o-]   │
│          │                    ║                               ║                     │
│  Prompt  │                    ╚═══════════════════════════════╝                     │
│  ┌────┐  │                                                                           │
│  │____│  │  ┌─────────────────────────────────────────────────────────────────┐    │
│  │____│  │  │ [Gain] [Fade] [Normalize] [EQ] [Reverb] [Delay] [Compress]     │    │
│  │____│  │  └─────────────────────────────────────────────────────────────────┘    │
│  └────┘  │                                                                           │
│          │  ┌───────────────────────────────────────────────────────────────────┐  │
│  [Generate] │ │ LIBRARY: Drag & drop audio to timeline ▼                         │  │
│          │  │  [Audio 1.mp3] [Audio 2.mp3] [Generated Track.mp3] ...           │  │
│  Language│  └───────────────────────────────────────────────────────────────────┘  │
│  [English▼] │                                                                        │
│          │                                                                           │
│  ACE-Step│                                                                           │
│  Params  │                                                                           │
│  (hidden)│                                                                           │
│          │                                                                           │
├──────────┴───────────────────────────────────────────────────────────────────────────┤
│  [◄◄] [▶] [■]  ●00:00 / 03:45   ─────────o────────  🔊 Master [-60───o─────0]      │ ← Bottom Dock
└──────────────────────────────────────────────────────────────────────────────────────┘
   Transport       Timeline Position  Playhead Scrubber    Master Volume
```

### With Sidebar CLOSED:
```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│  [≡]  444 Studio [Pro]  ⚡20    [@username]     [Save] [Export] [Settings]          │
├─────┬───────────────────────────────────────────────────────────────────────────────┤
│     │                                                                                │
│ [>] │                    ╔═══════════════════════════════╗                          │
│     │                    ║   MULTI-TRACK TIMELINE        ║                          │
│ AI  │                    ║   (More horizontal space!)    ║                          │
│     │  Track 1: 🔊────────────────────────────────────────────────  [M] [S] [-o-]   │
│     │  Track 2: 🔊────────────────────────────────────────────────  [M] [S] [-o-]   │
│     │  Track 3: 🔊────────────────────────────────────────────────  [M] [S] [-o-]   │
│     │                    ║                               ║                          │
│     │                    ╚═══════════════════════════════╝                          │
│     │                                                                                │
│     │  ┌──────────────────────────────────────────────────────────────────────┐    │
│     │  │ [Gain] [Fade] [Normalize] [EQ] [Reverb] [Delay] [Compress]          │    │
│     │  └──────────────────────────────────────────────────────────────────────┘    │
│     │                                                                                │
│     │  ┌────────────────────────────────────────────────────────────────────────┐  │
│     │  │ LIBRARY: Drag & drop audio to timeline ▼                               │  │
│     │  │  [Audio 1.mp3] [Audio 2.mp3] [Generated Track.mp3] [More tracks...]   │  │
│     │  └────────────────────────────────────────────────────────────────────────┘  │
│     │                                                                                │
├─────┴────────────────────────────────────────────────────────────────────────────────┤
│  [◄◄] [▶] [■]  ●00:00 / 03:45   ──────────────o─────────────  🔊 Master [-60─o─0]  │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🎨 Design Elements (444Radio Vibe)

### Color Palette:
```
Background:     Black (#000000) with subtle grain texture
Glass Effects:  backdrop-blur-xl with rgba(255,255,255,0.05)
Primary:        Cyan/Teal (#22D3EE) - our signature color
Secondary:      Purple to Pink gradient (#A855F7 → #EC4899)
Accents:        Bright cyan (#06B6D4) for active elements
Text:           White (#FFFFFF) with varying opacity
```

### Typography:
```
Headings:       font-bold, gradient text (purple → pink)
Body:           font-medium, white/gray
Monospace:      font-mono for time/BPM displays
Labels:         text-xs uppercase tracking-wide
```

### Glassmorphism Style:
```css
.glassmorphism {
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(34, 211, 238, 0.2);
  box-shadow: 0 8px 32px 0 rgba(34, 211, 238, 0.15);
}
```

---

## 🎵 Component Breakdown

### 1. **Top Bar** (Fixed Position)
```
┌─────────────────────────────────────────────────────────────────┐
│ [≡] 444 Studio [Pro]  ⚡20  [@user]  [Save] [Export] [Settings] │
└─────────────────────────────────────────────────────────────────┘
```
- **Menu Toggle** (≡): Opens/closes AI sidebar
- **Credits Display** (⚡20): Real-time credit count
- **User Badge**: @username with avatar
- **Actions**: Save, Export (to R2), Settings (gear icon)
- **Style**: Purple/pink gradient with glassmorphism

### 2. **AI Sidebar** (Collapsible, Left Side)
```
┌──────────┐
│  🎵 AI   │
│  SIDEBAR │
│          │
│  [New]   │  ← New generation button
│          │
│  Prompt  │
│  ┌────┐  │  ← Text input for prompt
│  │____│  │
│  │____│  │
│  └────┘  │
│          │
│  Language│
│  [EN ▼]  │  ← Language selector
│          │
│  [Generate]  ← Generate button
│          │
│  ACE-Step│  ← Params appear for non-English
│  ┌─────┐ │
│  │ 45s │ │  Audio Length slider
│  │ 50  │ │  Inference Steps
│  │ 7.0 │ │  Guidance Scale
│  │ 0.8 │ │  Denoising Strength
│  └─────┘ │
│          │
│  Queue   │  ← Generation queue
│  ┌─────┐ │
│  │⏳Gen1│ │  Queued/Generating items
│  │✅Gen2│ │
│  └─────┘ │
└──────────┘
```
- Width: **280px** when open, **60px** when closed (icon only)
- **Glassmorphism** background
- **Cyan accents** for active states
- **Drag results** to timeline

### 3. **Multi-Track Timeline** (Center, Main Canvas)
```
Track 1: 🔊──────[Waveform]──────────────  [M] [S] [-o-]
Track 2: 🔊──────[Waveform]──────────────  [M] [S] [-o-]
Track 3: 🔊──────[Waveform]──────────────  [M] [S] [-o-]
         ↑        ↑                          ↑   ↑   ↑
       Icon   WaveSurfer.js               Mute Solo Vol
```
- **Each track**: Separate WaveSurfer instance
- **Waveform colors**: Match track color (cyan, purple, orange, green, pink, yellow)
- **Controls per track**:
  - [M] Mute toggle
  - [S] Solo toggle
  - [-o-] Volume/pan slider
- **Drag & drop**: From library or AI generations
- **Timeline markers**: BPM grid, time markers
- **Playhead**: Cyan vertical line synced across all tracks

### 4. **Effects Bar** (Below Timeline)
```
┌─────────────────────────────────────────────────────────────────┐
│ [Gain] [Fade] [Normalize] [EQ] [Reverb] [Delay] [Compress]     │
└─────────────────────────────────────────────────────────────────┘
```
- **Glassmorphism buttons**
- Opens effect modal when clicked
- **All AudioMass effects** available:
  - Gain control
  - Fade in/out
  - Normalize
  - Parametric EQ (with frequency graph)
  - Reverb
  - Delay
  - Compression
  - Distortion
  - Noise reduction

### 5. **Library Panel** (Below Effects, Collapsible)
```
┌───────────────────────────────────────────────────────────────┐
│ LIBRARY: Drag & drop audio to timeline ▼                      │
│  [🎵 Audio 1.mp3]  [🎵 Audio 2.mp3]  [🎵 Generated.mp3] ...  │
└───────────────────────────────────────────────────────────────┘
```
- **Loads from Supabase** `combined_media` where type = 'audio'
- **Drag & drop** to any track
- **Hover**: Shows audio duration and waveform preview
- **Collapsible**: Arrow icon to hide/show

### 6. **Bottom Dock** (Fixed Position, Transport Controls)
```
┌─────────────────────────────────────────────────────────────────┐
│ [◄◄] [▶] [■]  ●00:00/03:45  ───────o────────  🔊 Master [-o-]  │
└─────────────────────────────────────────────────────────────────┘
```
- **Transport**:
  - [◄◄] Rewind to start
  - [▶/II] Play/Pause toggle
  - [■] Stop
  - [●] Record (future feature)
- **Timeline Scrubber**: Draggable playhead
- **Master Volume**: Global volume control with VU meter
- **BPM Display**: Shows current BPM and time signature
- **Style**: Glassmorphism with purple/pink accents

---

## 🎯 Key Features of Custom Wrapper

### ✅ What You Get:
1. **Our Vibe**: Cyan/purple/pink colors, glassmorphism, 444Radio branding
2. **Multi-Track**: Unlike AudioMass (single-track), we support multiple audio files playing together
3. **AI Integration**: Sidebar generates music directly into timeline
4. **Library Integration**: Drag & drop from Supabase library
5. **Effects**: All AudioMass effects via our glassmorphism modals
6. **ACE-Step Support**: Language-specific parameters in sidebar
7. **Project Persistence**: Save/load projects from Supabase
8. **Collapsible Sidebar**: More space for timeline when needed
9. **Bottom Dock**: Professional transport controls

### 🎨 Visual Hierarchy:
```
Priority 1: Multi-track timeline (main focus)
Priority 2: AI sidebar (collapsible, easy access)
Priority 3: Effects bar (below timeline)
Priority 4: Library (collapsible, below effects)
Priority 5: Transport controls (always visible, bottom)
```

---

## 📐 Responsive Behavior

### Desktop (>1280px):
- Sidebar: 280px width
- Timeline: Remaining width
- All panels visible

### Tablet (768px - 1280px):
- Sidebar: Collapsed by default (60px)
- Timeline: Full width when sidebar closed
- Library: Collapsible

### Mobile (<768px):
- Sidebar: Overlay modal (full screen when open)
- Timeline: Vertical scroll
- Bottom dock: Simplified controls
- Touch-friendly hit areas (48px minimum)

---

## 🚀 Next Steps to Build This

1. **MultiTrackEngine.tsx** - Core engine wrapper
2. **StudioSidebar.tsx** - AI generation sidebar with ACE-Step
3. **TimelineCanvas.tsx** - Multi-track WaveSurfer wrapper
4. **EffectsBar.tsx** - Effect buttons that open glassmorphism modals
5. **LibraryPanel.tsx** - Drag & drop from Supabase
6. **TransportDock.tsx** - Bottom transport controls
7. **Replace /studio/daw/page.tsx** - Use new components

This will make 444 Studio OURS with our signature vibe! 🎨✨
