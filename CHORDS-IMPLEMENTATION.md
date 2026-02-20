# Chords Integration - Complete Implementation

**Date:** February 20, 2026  
**Feature:** Chord progression & rhythm control for AI music generation  
**Model:** [sakemin/musicongen](https://replicate.com/sakemin/musicongen)

## 🎯 What Was Implemented

### 1. **API Endpoint** (`/api/generate/musicongen`)
- Full Replicate integration for MusiConGen model
- Credit system integration (4 credits flat rate)
- Automatic refund on failure
- Saves chord progression and time signature to database
- Uploads generated audio to Cloudflare R2
- Tracks generation in `credit_transactions` with type `generation_chords`

**Location:** `app/api/generate/musicongen/route.ts`

### 2. **UI Component** (Chords Modal)
- Clean, user-friendly modal interface
- **10 curated presets** for instant testing:
  1. **Blues Shuffle** - A:min7 D:min7 E:7 @ 78 BPM
  2. **Jazz Ballad** - C:maj7 A:min7 D:min7 G:7 @ 72 BPM
  3. **Pop Anthem** - C G A:min F @ 128 BPM
  4. **Lo-fi Chill** - D:maj7 B:min7 E:min7 A:7 @ 85 BPM
  5. **Funky Groove** - E:min7 A:7 D:maj7 B:7 @ 116 BPM
  6. **Dark Techno** - A:min (repeated) @ 130 BPM
  7. **Acoustic Folk** - G D E:min C @ 92 BPM
  8. **Latin Salsa** - C:7 F:7 G:7 @ 180 BPM
  9. **Ambient Dream** - A:maj7 F#:min7 D:maj7 E:maj7 @ 60 BPM
  10. **Indie Rock** - A E F#:min D @ 140 BPM

- Advanced settings panel with all API parameters
- Real-time prompt validation (10-300 characters)
- Credit cost display (4 credits flat rate)
- Integration with generation queue system
- Chord format help text and validation

**Location:** `app/components/MusiConGenModal.tsx`

### 3. **Database Schema**
Added two new columns to `combined_media`:
- `chord_progression` (TEXT) - Stores chord sequences like "C G A:min F"
- `time_signature` (TEXT) - Stores time signature like "4/4", "3/4", etc.
- Indexes for performance (chord search, BPM filtering)

Added new transaction type to `credit_transactions`:
- `generation_chords` - For tracking Chords generations

**Location:** `db/migrations/129_add_musicongen_support.sql`

### 4. **Type Definitions**
Updated `CreditTransactionType` to include `'generation_chords'`

**Location:** `lib/credit-transactions.ts`

### 5. **UI Integration**
- Added Chords button to create page (purple Music2 icon)
- Appears in advanced buttons section alongside Loopers/Effects
- Full chat integration with generation queue
- Success/failure handling with user feedback

**Location:** `app/create/page.tsx`

---

## 🎹 API Parameters (All Supported)

Based on the Replicate schema, **all parameters are implemented**:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `prompt` | string | *required* | Music description |
| `text_chords` | string | `"C G A:min F"` | Chord progression (space-separated) |
| `bpm` | number | `120` | Beats per minute (40-200) |
| `time_sig` | string | `"4/4"` | Time signature (4/4, 3/4, 6/8, 5/4, 7/8) |
| `duration` | integer | `15` | Audio length in seconds (1-30) |
| `top_k` | integer | `250` | Sampling: k most likely tokens |
| `top_p` | number | `0` | Sampling: cumulative probability (0=use top_k) |
| `temperature` | number | `1` | Diversity control (0.1-2) |
| `classifier_free_guidance` | integer | `3` | Prompt adherence (1-10) |
| `seed` | integer | *optional* | Reproducibility (omit or -1 for random) |
| `output_format` | enum | `"wav"` | Output format: `wav` or `mp3` |

---

## 🎸 Chord Notation Guide

### Basic Chords
- `C` = C major
- `A:min` = A minor
- `D:maj` = D major (explicit)

### Advanced Chords (All Supported)
```
maj, min, dim, aug
min6, maj6
min7, maj7, 7
dim7, hdim7
minmaj7
sus2, sus4
```

### Examples
```
C G A:min F                          # Pop progression
A:min7 D:min7 E:7 A:min7            # Jazz blues
C:maj7 A:min7 D:min7 G:7            # Jazz standard
E:min7 A:7 D:maj7 B:7               # Funk/soul
```

### Multi-Chord Bars
Use commas to put multiple chords in one bar:
```
C,C:7 G, E:min A:min                # 2 chords in bar 1, 1 in bar 2, etc.
```

---

## 💰 Credit Pricing

**4 credits** for all durations (1-30 seconds)

*Fixed pricing for consistent cost per generation regardless of duration*

---

## 📝 Testing the Feature

### Local Testing (Without DB)
1. Start dev server: `npm run dev`
2. Navigate to `/create`
3. Click the purple **Music2** icon in the advanced buttons toolbar
4. Try a preset or enter custom chords
5. Check browser console for generation logs

### Full Testing (With DB)
1. Set environment variables:
   ```env
   REPLICATE_API_KEY_LATEST2=your_key
   NEXT_PUBLIC_SUPABASE_URL=your_url
   SUPABASE_SERVICE_ROLE_KEY=your_key
   R2_* variables for storage
   ```

2. Run migration:
   ```bash
   export PG_CONNECTION_STRING="postgresql://user:pass@host:5432/db"
   npm run migrate
   ```

3. Test generation:
   - Open `/create` page
   - Click Chords button (purple Music2 icon)
   - Try "Blues Shuffle" preset
   - Verify:
     - Credits deducted
     - Audio uploaded to R2
     - Saved to `combined_media` with chord_progression
     - Shows up in Library
     - Transaction logged with `generation_chords` type

---

## 🚀 Deployment Checklist

- [x] API endpoint created (`/api/generate/musicongen/route.ts`)
- [x] UI modal created (`MusiConGenModal.tsx`)
- [x] 10 presets implemented
- [x] Database migration created (`129_add_musicongen_support.sql`)
- [x] Type definitions updated (`CreditTransactionType`)
- [x] UI integration in create page
- [x] All API parameters supported
- [x] Credit system integrated (4 credits flat rate)
- [x] Quest progress tracking (via `generate_songs`)
- [x] Generation queue integration
- [x] TypeScript compilation passing
- [x] No ESLint errors
- [x] Features sidebar integration
- [x] Plugin API support

### Environment Variables Required
```env
REPLICATE_API_KEY_LATEST2=r8_...
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
R2_ENDPOINT=https://xxx.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
NEXT_PUBLIC_R2_AUDIO_URL=https://audio.444radio.co.in
```

### Deployment Steps
1. **Commit all changes:**
   ```bash
   git add .
   git commit -m "Add Chords: chord progression & rhythm control"
   git push
   ```

2. **Verify environment variables** in Vercel dashboard

3. **Migration will auto-run** on deployment (if `PG_CONNECTION_STRING` set)

4. **Test in production:**
   - Navigate to `/create`
   - Enable advanced buttons (toggle icon)
   - Click purple Music2 icon
   - Try "Pop Anthem" preset
   - Verify generation completes and appears in Library

---

## 🎯 Key Features

✅ **Chord Control** - Users can specify exact chord progressions  
✅ **Rhythm Control** - BPM and time signature customization  
✅ **10 Genre Presets** - One-click testing across music styles  
✅ **Advanced Parameters** - Temperature, top_k, CFG, seed control  
✅ **Credit Integration** - 4 credits flat rate for all durations  
✅ **Database Tracking** - Chords saved for future search/filtering  
✅ **Generation Queue** - Non-blocking UI with progress tracking  
✅ **Auto-Refund** - Credits refunded on generation failure  
✅ **Quest Progress** - Counts toward "generate_songs" quests  

---

## 📊 Database Schema Changes

```sql
-- New columns in combined_media
ALTER TABLE combined_media 
  ADD COLUMN chord_progression TEXT,
  ADD COLUMN time_signature TEXT DEFAULT '4/4';

-- New transaction type
ALTER TYPE credit_transaction_type ADD VALUE 'generation_chords';
```

---

## 🔍 Files Changed

### Created
1. `app/api/generate/musicongen/route.ts` (289 lines)
2. `app/components/MusiConGenModal.tsx` (526 lines)
3. `db/migrations/129_add_musicongen_support.sql` (92 lines)

### Modified
1. `app/create/page.tsx` - Added Chords modal integration
2. `lib/credit-transactions.ts` - Added `generation_chords` type
3. `app/components/FeaturesSidebar.tsx` - Added Chords feature entry
4. `app/api/plugin/generate/route.ts` - Added plugin support for Chords
3. `db/migrations/128_generation_streaks.sql` - Unchanged (user's active file)

---

## 🎵 Example Generation Flow

1. **User clicks MusiConGen button** → Modal opens
2. **User selects "Jazz Ballad" preset** → Form populated with chords
3. **User clicks "Generate" (5 credits)** → Modal closes, chat shows "Generating..."
4. **API deducts 5 credits** → Calls Replicate MusiConGen model
5. **Model generates audio** (~15-20 seconds)
6. **API downloads & uploads to R2** → Returns public URL
7. **Saves to combined_media** with `chord_progression: "C:maj7 A:min7 D:min7 G:7"`
8. **Updates generation queue** → Chat shows success with audio player
9. **User can play in chat** or find in Library

---

## 🐛 Troubleshooting

### "Insufficient credits"
- Check user has ≥5 credits
- Verify `/api/credits` endpoint working

### "Generation failed"
- Check `REPLICATE_API_KEY_LATEST2` is set
- Verify model version hash: `a05ec8bdf5cc902cd849077d985029ce9b05e3dfb98a2d74accc9c94fdf15747`
- Check Replicate API status

### "Failed to upload to R2"
- Verify all R2 environment variables
- Check bucket `audio-files` exists and is accessible

### "Not saved to library"
- Check Supabase credentials
- Verify `combined_media` table has `chord_progression` column (run migration)

### Modal doesn't appear
- Check browser console for React errors
- Verify `showAdvancedButtons` is enabled in UI
- Try refreshing page

---

## 🎉 Success Metrics

After deployment, monitor:
- [ ] MusiConGen generations in `credit_transactions` (type filter)
- [ ] Audio files in R2 bucket with `musicongen-*.wav` pattern
- [ ] `combined_media` records with `genre='musicongen'` and populated `chord_progression`
- [ ] User feedback on chord control feature
- [ ] Credit consumption vs. generation success rate

---

## 📚 Related Documentation

- Replicate Model: https://replicate.com/sakemin/musicongen
- Loopers Implementation: `app/api/generate/loopers/route.ts`
- Effects Implementation: `app/api/generate/effects/route.ts`
- Credit System: `BULLETPROOF_CREDIT_TRACKING.md`
- Generation Queue: `docs/GENERATION-QUEUE-SYSTEM.md`

---

## 🎼 Next Steps (Future Enhancements)

1. **Chord Library** - Build searchable chord progression database
2. **Chord Visualization** - Show chord diagrams in UI
3. **Music Theory Auto-Suggest** - Recommend progressions based on genre
4. **Chord Detection** - Analyze existing tracks and extract chords
5. **Advanced Rhythm** - Support polyrhythms, odd time signatures
6. **Longer Durations** - Extend beyond 30s with stitching
7. **Stem Export** - Generate separate chord/melody/bass stems
8. **MIDI Export** - Convert chord progression to MIDI files

---

**Implementation Complete! 🎹✨**

Ready to commit and deploy:
```bash
git add .
git commit -m "feat: Add MusiConGen API with chord progression control + 10 genre presets"
git push
```
