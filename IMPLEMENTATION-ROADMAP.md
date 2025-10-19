# 444RADIO - Complete Implementation Roadmap
## Modern AI Music Platform with Unified Generation Flow

---

## 🎯 **VISION**
A streamlined music creation platform where users:
1. Write a prompt → Generate music
2. Add cover art + video (optional enhancements)
3. Preview combined music + art in chat-style interface
4. Send to "label" (their profile) to showcase publicly
5. Appears on Explore page for discovery

---

## 📋 **PHASE 1: Fix Music Generation (Like Image)**
### Current State
- ✅ Image generation works (standalone, no song record)
- ❌ Music generation broken (requires song record first)

### Tasks
- [ ] **1.1** Create `/api/generate/music-only/route.ts`
  - Direct Replicate call to `meta/musicgen`
  - Input: prompt, duration (default 8s)
  - Output: audioUrl
  - Credits: -2 per generation
  - No song record (just preview)

- [ ] **1.2** Update MusicGenerationModal to use new endpoint
  - Remove two-step process
  - Direct API call like CoverArtGenerationModal
  - Preview audio player in modal
  - Download button

- [ ] **1.3** Test music generation flow
  - Verify Replicate API works
  - Test audio playback
  - Test credit deduction

---

## 📋 **PHASE 2: Unified Generation Modal (Core UX)**
### Goal: Single prompt box with 3 generation options

### Tasks
- [ ] **2.1** Create `UnifiedGenerationModal.tsx`
  ```
  ┌─────────────────────────────────────┐
  │  Generate AI Content                │
  ├─────────────────────────────────────┤
  │                                     │
  │  ┌─────────────────────────────┐   │
  │  │ Describe your music...      │   │
  │  │                             │   │
  │  │ Example: "lofi hip hop     │   │
  │  │ beats for studying"         │   │
  │  └─────────────────────────────┘   │
  │                                     │
  │  Generate:                          │
  │  ┌───┐ ┌───┐ ┌───┐                │
  │  │🎵 │ │🎨 │ │🎬 │                │
  │  └───┘ └───┘ └───┘                │
  │  Music Art  Video                  │
  │                                     │
  │  ┌─────────────────────────────┐   │
  │  │  [Generate Button]          │   │
  │  └─────────────────────────────┘   │
  └─────────────────────────────────────┘
  ```

- [ ] **2.2** Add modal trigger to homepage
  - Replace 3 separate cards with single prompt box
  - SVG icon to open modal (sparkles ✨ or wand 🪄)
  - Modern glassmorphism design

- [ ] **2.3** Modal state management
  - Track selected generation type (music/art/video)
  - Support multiple selections (music + art together)
  - Show progress for each type

---

## 📋 **PHASE 3: Chat-Style Preview System**
### Goal: Show generated content in conversational UI

### Tasks
- [ ] **3.1** Create `GenerationChatPreview.tsx` component
  ```
  ┌─────────────────────────────────────┐
  │  You:                               │
  │  "lofi hip hop beats for studying"  │
  │                                     │
  │  AI:                                │
  │  ┌─────────────────────────────┐   │
  │  │ 🎵 [Audio Player]           │   │
  │  │ ▶️  ━━━━━━━━━●───  00:08   │   │
  │  └─────────────────────────────┘   │
  │  ┌─────────────────────────────┐   │
  │  │ 🎨 [Cover Art Image]        │   │
  │  │ [Beautiful AI artwork]      │   │
  │  └─────────────────────────────┘   │
  │                                     │
  │  💾 Save to Profile  🔄 Regenerate │
  └─────────────────────────────────────┘
  ```

- [ ] **3.2** Integrate with generation modals
  - Show preview immediately after generation
  - Animate content appearance (slide up, fade in)
  - Modern chat bubbles (user on right, AI on left)

- [ ] **3.3** Action buttons
  - "Save to Profile" → Creates song record
  - "Regenerate" → Runs generation again
  - "Download" → Download all assets
  - "Share" → Copy link (future)

---

## 📋 **PHASE 4: Database Schema (Foundation)**
### Goal: Proper tables for complete workflow

### Current Schema Issues
- ✅ `users` table exists (username, credits)
- ✅ `songs` table exists (all columns added via migration)
- ❌ Missing relationships and metadata

### Tasks
- [ ] **4.1** Create `CREATE-COMPLETE-SCHEMA.sql`
  ```sql
  -- Keep existing users and songs tables
  -- Add new metadata columns:
  
  ALTER TABLE songs ADD COLUMN IF NOT EXISTS 
    generation_type TEXT; -- 'music', 'cover_art', 'video', 'full'
  
  ALTER TABLE songs ADD COLUMN IF NOT EXISTS 
    generation_params JSONB; -- Store all Flux/MusicGen params
  
  ALTER TABLE songs ADD COLUMN IF NOT EXISTS 
    parent_song_id TEXT; -- Link cover art to original music
  
  ALTER TABLE songs ADD COLUMN IF NOT EXISTS 
    video_url TEXT; -- For video generations
  
  -- Add engagement columns
  ALTER TABLE songs ADD COLUMN IF NOT EXISTS 
    comments_count INTEGER DEFAULT 0;
  
  ALTER TABLE songs ADD COLUMN IF NOT EXISTS 
    shares_count INTEGER DEFAULT 0;
  
  -- Add visibility
  ALTER TABLE songs ADD COLUMN IF NOT EXISTS 
    featured BOOLEAN DEFAULT false;
  
  ALTER TABLE songs ADD COLUMN IF NOT EXISTS 
    explore_eligible BOOLEAN DEFAULT true;
  ```

- [ ] **4.2** Create indexes for performance
  ```sql
  -- For Explore page (trending content)
  CREATE INDEX idx_songs_explore 
    ON songs(is_public, created_at DESC) 
    WHERE is_public = true AND explore_eligible = true;
  
  -- For user profiles (their label)
  CREATE INDEX idx_songs_user_profile 
    ON songs(username, is_public, created_at DESC);
  
  -- For featured content
  CREATE INDEX idx_songs_featured 
    ON songs(featured, created_at DESC) 
    WHERE featured = true;
  ```

- [ ] **4.3** Migration script
  - Run in Supabase SQL Editor
  - Verify with SELECT queries
  - Test with sample data

---

## 📋 **PHASE 5: "Save to Profile" Feature**
### Goal: Convert preview to permanent song record

### Tasks
- [ ] **5.1** Create `/api/songs/create/route.ts`
  - Input: prompt, audioUrl, coverUrl, videoUrl (optional)
  - Creates song record in database
  - Sets is_public = false by default
  - Returns songId

- [ ] **5.2** Update GenerationChatPreview
  - "Save to Profile" button calls API
  - Show success message
  - Navigate to user's profile `/u/[username]`

- [ ] **5.3** Profile privacy controls
  - Toggle: "Show on Profile" (is_public)
  - Toggle: "Show on Explore" (explore_eligible)
  - Inline editing in profile view

---

## 📋 **PHASE 6: Enhanced Profile Page ("Label")**
### Goal: Beautiful showcase of user's music

### Tasks
- [ ] **6.1** Redesign `/app/u/[username]/page.tsx`
  ```
  ┌─────────────────────────────────────┐
  │  @username                          │
  │  🎵 12 Tracks  👥 150 Followers     │
  │  ⚡ 47 Credits                      │
  ├─────────────────────────────────────┤
  │  Latest Releases                    │
  │  ┌───┐ ┌───┐ ┌───┐ ┌───┐          │
  │  │🎨 │ │🎨 │ │🎨 │ │🎨 │          │
  │  │▶️ │ │▶️ │ │▶️ │ │▶️ │          │
  │  └───┘ └───┘ └───┘ └───┘          │
  │  Track 1  Track 2  Track 3  ...    │
  │                                     │
  │  [Grid continues...]                │
  └─────────────────────────────────────┘
  ```

- [ ] **6.2** Track card component
  - Cover art as background
  - Play button overlay
  - Hover: Show title, plays, likes
  - Click: Open detailed view

- [ ] **6.3** Detailed track view modal
  - Full cover art
  - Audio player with waveform
  - Lyrics (if available)
  - Stats: plays, likes, created date
  - Actions: Like, Share, Download

---

## 📋 **PHASE 7: Explore Page (Discovery)**
### Goal: Public feed of best content

### Tasks
- [ ] **7.1** Update `/app/explore/page.tsx`
  - Fetch public songs (is_public = true)
  - Sort by: Trending, New, Popular
  - Infinite scroll or pagination

- [ ] **7.2** Trending algorithm
  ```sql
  -- Simple trending score:
  -- (likes * 2 + plays + comments * 3) / age_in_days
  
  SELECT *, 
    ((likes * 2) + plays + (comments_count * 3)) / 
    EXTRACT(EPOCH FROM (NOW() - created_at)) / 86400 as trending_score
  FROM songs
  WHERE is_public = true 
    AND explore_eligible = true
  ORDER BY trending_score DESC
  LIMIT 50
  ```

- [ ] **7.3** Explore filters
  - Genre tags
  - Timeframe (Today, This Week, All Time)
  - Type (Music Only, With Art, With Video)

---

## 📋 **PHASE 8: UI/UX Polish (Modernism + Minimalism)**
### Design Principles
- **Colors**: Dark mode, neon accents (cyan, purple, green)
- **Typography**: Clean sans-serif, generous spacing
- **Animations**: Smooth 60fps, subtle micro-interactions
- **Layout**: Card-based, glassmorphism, gradient borders

### Tasks
- [ ] **8.1** Design system consistency
  - Unified button styles
  - Consistent spacing (8px grid)
  - Shared color palette
  - Reusable components

- [ ] **8.2** Loading states
  - Skeleton screens (not spinners)
  - Progress indicators for generation
  - Smooth transitions

- [ ] **8.3** Empty states
  - Beautiful illustrations
  - Clear CTAs ("Generate your first track")
  - Helpful tooltips

- [ ] **8.4** Responsive design
  - Mobile-first approach
  - Touch-friendly buttons (min 44px)
  - Swipe gestures for modals

---

## 🚀 **IMPLEMENTATION ORDER**

### Week 1: Foundation
1. ✅ Fix image generation (DONE)
2. Fix music generation (Phase 1)
3. Database schema updates (Phase 4)

### Week 2: Core UX
4. Unified generation modal (Phase 2)
5. Chat-style preview (Phase 3)
6. Save to profile (Phase 5)

### Week 3: Discovery
7. Enhanced profile page (Phase 6)
8. Explore page redesign (Phase 7)

### Week 4: Polish
9. UI/UX improvements (Phase 8)
10. Testing and bug fixes
11. Performance optimization

---

## 📊 **SUCCESS METRICS**
- ⚡ Generation success rate: >95%
- 🎨 User saves content: >60% of generations
- 👥 Profile visits: >100/day
- 🔥 Explore engagement: >5 min session time
- 💾 Database performance: <100ms queries

---

## 🛠️ **TECH STACK SUMMARY**
- **Frontend**: Next.js 15, React 19, Tailwind CSS
- **Backend**: Next.js API Routes, Clerk Auth
- **Database**: Supabase (PostgreSQL)
- **AI**: Replicate (Flux Schnell, MusicGen, etc.)
- **Deployment**: Vercel
- **Analytics**: (Future: Vercel Analytics)

---

## 💡 **NEXT IMMEDIATE STEPS**
1. Create `/api/generate/music-only/route.ts` (copy image-only structure)
2. Update database with new columns
3. Build UnifiedGenerationModal.tsx
4. Test full flow: Prompt → Generate → Preview → Save → Profile

---

**Let's start with Phase 1: Fix Music Generation** 🎵
Should I create the music-only endpoint now?
