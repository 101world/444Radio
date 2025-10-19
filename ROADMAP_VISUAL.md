# 🎯 444Radio Platform Roadmap - Visual Overview

## 📊 Current State vs Vision

### ❌ Current (Temporary)
```
User generates music/image
    ↓
Temporary Replicate URLs
    ↓
Combine Media Modal
    ↓
Saved to combined_media table
    ↓
Shows in Explore (basic)
    ↓
URLs expire in 24-48 hours ❌
No library, no labels, no proper showcase
```

### ✅ Vision (Complete Platform)
```
User generates music/image
    ↓
R2 permanent storage ✅
    ↓
Saved to libraries (music_library, images_library) 📚
    ↓
User creates Label (label page)
    ↓
User creates Release (music + cover art + metadata)
    ↓
Published to Label page 🎵
    ↓
Shows in Explore with username + title
    ↓
Public discovers & plays
    ↓
Stats tracked (plays, likes, shares)
```

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    USER INTERFACE                            │
├─────────────────────────────────────────────────────────────┤
│  Dashboard  │  Library  │  Labels  │  Releases  │  Explore  │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                     API LAYER                                │
├─────────────────────────────────────────────────────────────┤
│  Generate  │  Library  │  Labels  │  Releases  │  Discovery │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                   STORAGE LAYER                              │
├─────────────────────────────────────────────────────────────┤
│  Cloudflare R2              │         Supabase              │
│  - Music files              │  - music_library              │
│  - Image files              │  - images_library             │
│  - Video files              │  - videos_library             │
│  - Organized by user        │  - labels                     │
│                             │  - releases                   │
│                             │  - user_profiles              │
└─────────────────────────────────────────────────────────────┘
```

---

## 📚 Database Schema Relationships

```
┌─────────────┐
│   users     │
│ (existing)  │
└──────┬──────┘
       │
       ├──────────────────┬──────────────────┬──────────────────┐
       │                  │                  │                  │
       ↓                  ↓                  ↓                  ↓
┌──────────────┐   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│music_library │   │images_library│   │videos_library│   │   labels     │
│              │   │              │   │              │   │              │
│ - title      │   │ - title      │   │ - title      │   │ - name       │
│ - audio_url  │   │ - image_url  │   │ - video_url  │   │ - slug       │
│ - prompt     │   │ - prompt     │   │ - prompt     │   │ - bio        │
│ - lyrics     │   │ - params     │   │ - params     │   │ - theme      │
└──────┬───────┘   └──────┬───────┘   └──────┬───────┘   └──────┬───────┘
       │                  │                  │                  │
       └──────────────────┴──────────────────┴──────────────────┘
                                    │
                                    ↓
                            ┌───────────────┐
                            │   releases    │
                            │               │
                            │ - title       │
                            │ - artist      │
                            │ - music_id    │ → music_library
                            │ - cover_id    │ → images_library
                            │ - video_id    │ → videos_library
                            │ - label_id    │ → labels
                            │ - status      │
                            │ - visibility  │
                            └───────────────┘
                                    │
                                    ↓
                            Shows in Explore
```

---

## 🎯 User Journey Flow

### 1️⃣ Generation Phase
```
┌──────────────┐
│   User       │
│  Dashboard   │
└──────┬───────┘
       │
       ├─── Click "Generate Music"
       │         ↓
       │    ┌─────────────────┐
       │    │ Music Generator │
       │    │ - Prompt        │
       │    │ - Lyrics        │
       │    └────────┬────────┘
       │             ↓
       │    ┌─────────────────┐
       │    │  MiniMax API    │
       │    │  (Replicate)    │
       │    └────────┬────────┘
       │             ↓
       │    ┌─────────────────┐
       │    │ Upload to R2    │
       │    │ users/.../music │
       │    └────────┬────────┘
       │             ↓
       │    ┌─────────────────┐
       │    │ Save to         │
       │    │ music_library   │
       │    └────────┬────────┘
       │             ↓
       │    ✅ Permanent URL returned
       │
       └─── Click "Generate Cover Art"
                ↓
           ┌─────────────────┐
           │ Image Generator │
           │ - Prompt        │
           │ - Style params  │
           └────────┬────────┘
                    ↓
           ┌─────────────────┐
           │   Flux API      │
           │  (Replicate)    │
           └────────┬────────┘
                    ↓
           ┌─────────────────┐
           │ Upload to R2    │
           │ users/.../images│
           └────────┬────────┘
                    ↓
           ┌─────────────────┐
           │ Save to         │
           │ images_library  │
           └────────┬────────┘
                    ↓
           ✅ Permanent URL returned
```

### 2️⃣ Library Phase
```
User goes to /library
       ↓
┌──────────────────────────────┐
│   Library Page               │
│                              │
│  ┌─────┬──────┬───────┐     │
│  │Music│Images│Videos │     │
│  └─────┴──────┴───────┘     │
│                              │
│  ┌────────────────────────┐ │
│  │ [Cover]  Track Title  │ │
│  │ Play | Download       │ │
│  └────────────────────────┘ │
│                              │
│  ┌────────────────────────┐ │
│  │ [Cover]  Track Title  │ │
│  │ Play | Download       │ │
│  └────────────────────────┘ │
└──────────────────────────────┘
```

### 3️⃣ Label Creation Phase
```
User clicks "Create Label"
       ↓
┌──────────────────────────────┐
│  Create Label Modal          │
│                              │
│  Label Name: [________]      │
│  Slug: [________]            │
│  Bio: [________]             │
│  Avatar: [Upload]            │
│  Banner: [Upload]            │
│                              │
│  [ Create Label ]            │
└──────────────────────────────┘
       ↓
Label saved to database
       ↓
Label page created: /label/{slug}
```

### 4️⃣ Release Creation Phase
```
User selects music + cover art from library
       ↓
┌──────────────────────────────┐
│  Create Release              │
│                              │
│  Music: [Selected Track]     │
│  Cover Art: [Selected Image] │
│                              │
│  Title: [________]           │
│  Artist: [________]          │
│  Label: [Dropdown]           │
│  Genre: [________]           │
│  Description: [________]     │
│                              │
│  [ Publish Release ]         │
└──────────────────────────────┘
       ↓
Release saved to database
       ↓
Shows on label page & explore page
```

### 5️⃣ Discovery Phase
```
Public visits /explore
       ↓
┌──────────────────────────────────────┐
│  Explore Releases                    │
│                                      │
│  ┌──────────┐  ┌──────────┐        │
│  │ [Cover]  │  │ [Cover]  │        │
│  │ Title    │  │ Title    │        │
│  │ @artist  │  │ @artist  │        │
│  │ ▶ Play   │  │ ▶ Play   │        │
│  └──────────┘  └──────────┘        │
│                                      │
│  ┌──────────┐  ┌──────────┐        │
│  │ [Cover]  │  │ [Cover]  │        │
│  │ Title    │  │ Title    │        │
│  │ @artist  │  │ @artist  │        │
│  │ ▶ Play   │  │ ▶ Play   │        │
│  └──────────┘  └──────────┘        │
└──────────────────────────────────────┘
       ↓
Click on release
       ↓
┌──────────────────────────────────────┐
│  Release Detail Page                 │
│                                      │
│  ┌────────────────────────┐         │
│  │                        │         │
│  │    [Cover Art Full]    │         │
│  │                        │         │
│  └────────────────────────┘         │
│                                      │
│  🎵 Track Title                     │
│  👤 by Artist Name                  │
│  🏷️ on Label Name                   │
│                                      │
│  [▶ Play] [❤️ Like] [🔗 Share]      │
│                                      │
│  📝 Description                     │
│  🎨 Prompts Used                    │
│  📊 Stats: 123 plays, 45 likes      │
└──────────────────────────────────────┘
```

---

## 🎨 UI Components Hierarchy

```
App Layout
├── Navigation
│   ├── Home
│   ├── Library ← NEW
│   ├── Labels ← NEW
│   ├── Explore (updated)
│   └── Profile
│
├── Dashboard (NEW)
│   ├── Stats Cards
│   ├── Quick Actions
│   └── Recent Activity
│
├── Library Page (NEW)
│   ├── Tabs (Music/Images/Videos)
│   ├── Search & Filters
│   └── Media Grid
│       ├── MusicLibraryCard
│       ├── ImageLibraryCard
│       └── VideoLibraryCard
│
├── Label Page (NEW)
│   ├── Label Header (banner, avatar, bio)
│   ├── Releases Grid
│   │   └── ReleaseCard
│   └── Label Stats
│
├── Release Page (NEW)
│   ├── Release Player
│   ├── Release Info
│   ├── Artist/Label Links
│   └── Related Releases
│
└── Explore Page (UPDATED)
    ├── Featured Section
    ├── Filters (genre, date, trending)
    └── Releases Grid
        └── ReleaseCard
```

---

## 📱 Page Routes Structure

```
/ (home)
├── /dashboard               ← NEW: User dashboard
├── /generate               ← Existing: Generation flow
│
├── /library                ← NEW: User's media library
│   ├── ?tab=music
│   ├── ?tab=images
│   └── ?tab=videos
│
├── /labels                 ← NEW: User's labels
│   └── /new                ← Create new label
│
├── /label/[slug]           ← NEW: Public label page
│   └── /edit               ← Edit label (owner only)
│
├── /releases               ← NEW: Manage releases
│   └── /new                ← Create release
│
├── /release/[id]           ← NEW: Release detail page
│
├── /explore                ← UPDATED: Shows releases
│   ├── ?genre=electronic
│   ├── ?featured=true
│   └── ?search=query
│
├── /profile/me             ← UPDATED: Own profile edit
└── /u/[username]           ← UPDATED: Public profile
    ├── Shows labels
    └── Shows library (if public)
```

---

## 🔄 Data Flow Example

### Complete Flow: Generate → Library → Label → Release → Explore

```
1. GENERATE MUSIC
   User: Enter prompt "upbeat electronic dance"
   System: Call MiniMax API → Download file → Upload to R2
   Result: audio_url = "https://pub-xxx.r2.dev/users/abc/music/track.mp3"
   Database: INSERT INTO music_library (user_id, audio_url, prompt, ...)
   Response: { id: "music-123", audio_url: "...", status: "ready" }

2. GENERATE COVER ART
   User: Enter prompt "neon synthwave cityscape"
   System: Call Flux API → Download image → Upload to R2
   Result: image_url = "https://pub-xxx.r2.dev/users/abc/images/cover.webp"
   Database: INSERT INTO images_library (user_id, image_url, prompt, ...)
   Response: { id: "image-456", image_url: "...", status: "ready" }

3. VIEW LIBRARY
   User: Navigate to /library
   System: SELECT * FROM music_library WHERE user_id = 'abc'
   System: SELECT * FROM images_library WHERE user_id = 'abc'
   Display: Grid of all generated media

4. CREATE LABEL
   User: Click "Create Label"
   User: Enter name "Neon Beats Records", slug "neon-beats"
   Database: INSERT INTO labels (user_id, name, slug, ...)
   Result: Label page live at /label/neon-beats

5. CREATE RELEASE
   User: Select music "music-123" + image "image-456"
   User: Enter title "Electric Nights", artist "DJ Pulse"
   User: Select label "Neon Beats Records"
   Database: INSERT INTO releases (
     label_id, music_id, cover_id, title, artist, ...
   )
   Result: Release published at /release/xyz

6. DISCOVER IN EXPLORE
   Public: Visit /explore
   System: SELECT releases WITH labels, music, images
   Display: Grid showing:
     - Cover art (from images_library)
     - Title "Electric Nights"
     - Artist "@dj-pulse"
     - Play button (audio from music_library)

7. PLAY & TRACK STATS
   Public: Click play button
   System: UPDATE releases SET play_count = play_count + 1
   System: Stream audio from R2
   Display: Full player with cover art + controls
```

---

## 🎯 Success Milestones

### ✅ Milestone 1: Foundation (DONE)
- R2 storage integrated
- Music generation working
- Image generation working
- Files stored permanently

### 🎯 Milestone 2: Libraries (Week 1)
- All generated media saved to libraries
- Library page showing all user content
- Search & filter functionality
- Delete & manage items

### 🎯 Milestone 3: Labels (Week 2)
- Users can create label pages
- Label customization (theme, branding)
- Label management dashboard
- Public label pages live

### 🎯 Milestone 4: Releases (Week 3)
- Combine media as releases
- Publish to labels
- Release management
- Release detail pages

### 🎯 Milestone 5: Discovery (Week 4)
- Updated explore page
- Search by username/title
- Filter by genre/tags
- Trending algorithm
- Stats tracking

### 🎯 Milestone 6: Polish (Week 5)
- Mobile responsive
- Loading states
- Error handling
- Performance optimization
- User testing

---

## 🚀 NEXT ACTION

**Start with PHASE 1: Library System**

I can begin by:
1. Creating database migrations for libraries
2. Updating generation endpoints to save to libraries
3. Building library API endpoints
4. Creating library UI components

**Ready to start?** Say "let's go" and I'll create the first migration! 🎉
