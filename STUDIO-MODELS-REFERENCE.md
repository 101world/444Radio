# Multi-Track Studio - Model Integration Reference

## 🎵 Available AI Models

### 1. Music Generation (2 credits)
- **Model**: `minimax/music-1.5`
- **URL**: https://replicate.com/minimax/music-1.5
- **Use Case**: Full song generation with vocals/lyrics
- **Button**: 🎵 Music (2 credits)
- **Input**: Text prompt (e.g., "lofi beats with piano")
- **Output**: Single MP3 track
- **Auto-creates**: 1 track named "🎵 Music (timestamp)"

### 2. Instrumental Generation (16 credits)
- **Model**: `stability-ai/stable-audio-2.5`
- **URL**: https://replicate.com/stability-ai/stable-audio-2.5
- **Use Case**: High-quality instrumental music without vocals
- **Button**: 🎹 Instrumental (16 credits)
- **Input**: Descriptive prompt (e.g., "upbeat electronic synth melody")
- **Output**: Single MP3 track
- **Auto-creates**: 1 track named "🎹 Instrumental (timestamp)"

### 3. Effects Chain (0.1 credits)
- **Model**: `smaerdlatigid/stable-audio`
- **URL**: https://replicate.com/smaerdlatigid/stable-audio
- **Use Case**: Apply audio effects (reverb, echo, etc.)
- **Button**: 🎚️ Effects Chain (0.1 credits)
- **Input**: Audio URL + effects description
- **Output**: Processed MP3
- **Auto-creates**: 1 track named "🎚️ Effects (timestamp)"

### 4. Auto-tune (1 credit)
- **Model**: `nateraw/autotune`
- **URL**: https://replicate.com/nateraw/autotune
- **Use Case**: Pitch correction for vocals
- **Button**: 🎤 Auto-tune (1 credit)
- **Input**: Audio URL + scale (major/minor/chromatic/closest)
- **Output**: Auto-tuned MP3
- **Auto-creates**: 1 track named "🎤 Auto-tuned (timestamp)"

### 5. Stem Splitter (20 credits)
- **Model**: `cjwbw/demucs`
- **URL**: https://replicate.com/cjwbw/demucs
- **Use Case**: Split song into separate instrument/vocal tracks
- **Button**: 🎛️ Stem Splitter (20 credits)
- **Input**: Audio URL
- **Output**: Multiple MP3s (vocals, drums, bass, other)
- **Auto-creates**: 4 tracks:
  - 🎤 Vocals
  - 🥁 Drums
  - 🎸 Bass
  - 🎹 Other

## 📊 Credit Costs Summary

| Feature | Credits | Cost/Use | Best For |
|---------|---------|----------|----------|
| Music | 2 | $0.02 | Quick song generation |
| Instrumental | 16 | $0.16 | High-quality background music |
| Effects | 0.1 | $0.001 | Cheap audio processing |
| Auto-tune | 1 | $0.01 | Vocal correction |
| Stem Split | 20 | $0.20 | Remixing/editing existing songs |

*Assuming 1 credit = $0.01 USD*

## 🎮 User Workflow

### Simple Music Generation:
1. Click "🎵 Music (2 credits)"
2. Enter: "lofi hip hop beats to study to"
3. Wait ~30-60 seconds
4. Track auto-appears at playhead position
5. Press Space to play

### Stem Splitting Workflow:
1. Upload or generate a full song
2. Copy the audio URL from R2
3. Click "🎛️ Stem Splitter (20 credits)"
4. Paste URL
5. Wait ~2-3 minutes
6. 4 separate stem tracks appear automatically:
   - 🎤 Vocals (isolated vocals)
   - 🥁 Drums (drum kit)
   - 🎸 Bass (bass line)
   - 🎹 Other (melody/harmony)
7. Play individual stems or mute/solo tracks

### Effects Processing:
1. Generate or add audio
2. Click "🎚️ Effects Chain (0.1 credits)"
3. Paste audio URL
4. Describe effects: "add reverb and echo"
5. Processed track appears automatically

## 🔧 Technical Implementation

### API Request Format:
```typescript
// Music Generation
POST /api/studio/generate
{
  type: 'create-song',
  params: { prompt: 'lofi beats' }
}

// Instrumental
POST /api/studio/generate
{
  type: 'create-beat',
  params: { prompt: 'upbeat synth melody' }
}

// Effects
POST /api/studio/generate
{
  type: 'effects',
  params: { 
    audioUrl: 'https://...',
    effects: 'add reverb'
  }
}

// Auto-tune
POST /api/studio/generate
{
  type: 'auto-tune',
  params: { 
    audioUrl: 'https://...',
    scale: 'closest'
  }
}

// Stem Split
POST /api/studio/generate
{
  type: 'stem-split',
  params: { audioUrl: 'https://...' }
}
```

### Webhook Response Handling:
- **Single Output**: Creates 1 track
- **Multiple Outputs** (stem split): Creates N tracks (one per stem)
- **Timing**: Staggered by 100ms to prevent race conditions
- **Naming**: Automatic with emoji icons for visual clarity

### Credit System:
- Credits checked **before** generation starts
- Deducted immediately on job creation
- **Refunded** if Replicate prediction fails
- No credit deduction if insufficient balance (402 error)

## 🎨 UI Design

### Button Colors:
- 🎵 **Music**: Blue (#4a90e2) - Primary generation
- 🎹 **Instrumental**: Purple (#8e44ad) - Premium feature
- 🎚️ **Effects**: Green (#27ae60) - Processing/utility
- 🎤 **Auto-tune**: Red (#e74c3c) - Vocal processing
- 🎛️ **Stem Split**: Orange (#f39c12) - Advanced/expensive

### Generation Status:
- Orange background: "⏳ Generating X job(s)..."
- Shows count of active jobs
- Auto-hides when complete

### Track Naming:
- **Format**: `[Emoji] [Type] (HH:MM:SS)`
- **Examples**:
  - "🎵 Music (14:23:45)"
  - "🥁 Drums"
  - "🎚️ Effects (14:24:12)"

## 🚀 Performance

### Generation Times (Approximate):
- Music: 30-60 seconds
- Instrumental: 60-120 seconds
- Effects: 10-30 seconds
- Auto-tune: 20-40 seconds
- Stem Split: 120-180 seconds

### Bandwidth:
- Average file size: 3-8 MB per track
- Stem split: 12-32 MB (4 tracks × 3-8 MB)
- Waveform rendering: ~200 KB decoded data

## 🐛 Error Handling

### Common Issues:
1. **Insufficient Credits**: Shows alert, no charge
2. **CORS Error**: Audio URL not publicly accessible
3. **Invalid URL**: Replicate can't fetch audio
4. **Timeout**: Prediction takes > 5 minutes (rare)

### Error Messages:
- 402: "Insufficient credits" (with required/available)
- 400: "Invalid generation type"
- 404: "User not found"
- 500: "Generation failed" + details

## 📈 Usage Recommendations

### Cost-Effective Workflow:
1. Generate music with **Music (2 credits)** first
2. If quality insufficient, try **Instrumental (16 credits)**
3. Use **Effects (0.1 credits)** to enhance existing audio
4. Save **Stem Split (20 credits)** for final production

### Advanced Workflow:
1. Generate full song with **Music**
2. **Stem Split** to isolate vocals/instruments
3. **Auto-tune** the vocal stem
4. Apply **Effects** to drum stem
5. Re-combine in multi-track timeline
6. Export final mix

## 🎯 Future Enhancements

### Planned Features:
- **Pitch Shift**: Transpose audio up/down
- **Time Stretch**: Change tempo without pitch
- **Noise Reduction**: Clean up recordings
- **Mastering**: Final polish for distribution
- **Vocal Isolation**: Extract vocals only (cheaper than full stem split)

### UI Improvements:
- Credit balance display in header
- Progress bars for each generation
- Preview button before full generation
- Undo/redo for destructive edits

---

**Live URL**: https://www.444radio.co.in/studio/multi-track
**Last Updated**: November 26, 2025
**Status**: ✅ All 5 models integrated and deployed
