# 🎯 444Radio - Complete Platform TODO

## 📋 Current Status (What's Done)

✅ **Authentication & Credits**
- Clerk authentication working
- User credits system (Supabase)
- Credit deduction on generation

✅ **AI Generation**
- Music generation (MiniMax Music-1.5) ✅
- Cover art generation (Flux Schnell) ✅
- R2 permanent storage ✅
- Organized file structure ✅

✅ **Basic Features**
- Combine media modal ✅
- Combined media player ✅
- Explore page (basic) ✅
- Database: `combined_media` table ✅

---

## 🎯 MACRO PLAN - User Journey

### The Vision:
1. **User creates** → Music + Cover Art/Video
2. **User sends to Label** → Their profile/label page
3. **Label showcases** → Song with media as combined piece
4. **Public discovers** → Explore page shows username + song title + media
5. **User manages** → Personal library of all creations

---

## 📊 DATABASE SCHEMA - New Tables Needed

### 1. **`music_library`** Table
Store all generated music files per user

```sql
CREATE TABLE music_library (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  clerk_user_id TEXT NOT NULL,
  
  -- Music details
  title TEXT,
  prompt TEXT NOT NULL,
  lyrics TEXT,
  audio_url TEXT NOT NULL, -- R2 permanent URL
  
  -- Metadata
  duration INTEGER, -- in seconds
  file_size BIGINT, -- in bytes
  audio_format TEXT DEFAULT 'mp3',
  bitrate INTEGER DEFAULT 256000,
  sample_rate INTEGER DEFAULT 44100,
  
  -- Generation params
  replicate_id TEXT,
  generation_params JSONB,
  
  -- Status
  status TEXT DEFAULT 'ready', -- ready, processing, failed
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Indexes
  CONSTRAINT fk_user FOREIGN KEY (clerk_user_id) REFERENCES users(clerk_user_id) ON DELETE CASCADE
);

CREATE INDEX idx_music_library_user ON music_library(clerk_user_id);
CREATE INDEX idx_music_library_created ON music_library(created_at DESC);
```

---

### 2. **`images_library`** Table
Store all generated images/cover art per user

```sql
CREATE TABLE images_library (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  clerk_user_id TEXT NOT NULL,
  
  -- Image details
  title TEXT,
  prompt TEXT NOT NULL,
  image_url TEXT NOT NULL, -- R2 permanent URL
  
  -- Metadata
  width INTEGER,
  height INTEGER,
  file_size BIGINT,
  image_format TEXT DEFAULT 'webp',
  aspect_ratio TEXT DEFAULT '1:1',
  
  -- Generation params
  replicate_id TEXT,
  generation_params JSONB,
  
  -- Status
  status TEXT DEFAULT 'ready',
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT fk_user FOREIGN KEY (clerk_user_id) REFERENCES users(clerk_user_id) ON DELETE CASCADE
);

CREATE INDEX idx_images_library_user ON images_library(clerk_user_id);
CREATE INDEX idx_images_library_created ON images_library(created_at DESC);
```

---

### 3. **`videos_library`** Table
Store all generated videos per user

```sql
CREATE TABLE videos_library (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  clerk_user_id TEXT NOT NULL,
  
  -- Video details
  title TEXT,
  prompt TEXT NOT NULL,
  video_url TEXT NOT NULL, -- R2 permanent URL
  thumbnail_url TEXT, -- R2 URL
  
  -- Metadata
  duration INTEGER,
  width INTEGER,
  height INTEGER,
  file_size BIGINT,
  video_format TEXT DEFAULT 'mp4',
  fps INTEGER DEFAULT 24,
  
  -- Generation params
  replicate_id TEXT,
  generation_params JSONB,
  
  -- Status
  status TEXT DEFAULT 'ready',
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT fk_user FOREIGN KEY (clerk_user_id) REFERENCES users(clerk_user_id) ON DELETE CASCADE
);

CREATE INDEX idx_videos_library_user ON videos_library(clerk_user_id);
CREATE INDEX idx_videos_library_created ON videos_library(created_at DESC);
```

---

### 4. **`labels`** Table (Profile/Label Pages)
User's label/profile page configuration

```sql
CREATE TABLE labels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clerk_user_id TEXT UNIQUE NOT NULL,
  
  -- Label details
  label_name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL, -- URL-friendly: /label/my-label-name
  bio TEXT,
  avatar_url TEXT,
  banner_url TEXT,
  
  -- Contact & Social
  website TEXT,
  email TEXT,
  instagram TEXT,
  twitter TEXT,
  spotify TEXT,
  soundcloud TEXT,
  
  -- Settings
  is_public BOOLEAN DEFAULT true,
  allow_submissions BOOLEAN DEFAULT false, -- Can other users submit to this label?
  theme JSONB DEFAULT '{"color": "#8B5CF6"}',
  
  -- Stats
  total_releases INTEGER DEFAULT 0,
  total_plays INTEGER DEFAULT 0,
  follower_count INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT fk_user FOREIGN KEY (clerk_user_id) REFERENCES users(clerk_user_id) ON DELETE CASCADE
);

CREATE INDEX idx_labels_slug ON labels(slug);
CREATE INDEX idx_labels_public ON labels(is_public) WHERE is_public = true;
```

---

### 5. **`releases`** Table (Songs on Label)
Combined media releases (music + cover art/video) on a label

```sql
CREATE TABLE releases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Ownership
  label_id UUID NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
  creator_user_id TEXT NOT NULL, -- Who created it
  
  -- Release details
  title TEXT NOT NULL,
  artist_name TEXT NOT NULL,
  description TEXT,
  
  -- Media references
  music_id UUID REFERENCES music_library(id) ON DELETE SET NULL,
  cover_art_id UUID REFERENCES images_library(id) ON DELETE SET NULL,
  video_id UUID REFERENCES videos_library(id) ON DELETE SET NULL,
  
  -- Direct URLs (for backwards compatibility)
  audio_url TEXT NOT NULL, -- R2 URL
  image_url TEXT, -- R2 URL
  video_url TEXT, -- R2 URL
  
  -- Prompts (for display)
  music_prompt TEXT,
  image_prompt TEXT,
  video_prompt TEXT,
  
  -- Release metadata
  genre TEXT,
  tags TEXT[], -- Array of tags
  release_date TIMESTAMPTZ DEFAULT NOW(),
  
  -- Visibility & Status
  status TEXT DEFAULT 'published', -- draft, published, archived
  visibility TEXT DEFAULT 'public', -- public, unlisted, private
  is_featured BOOLEAN DEFAULT false,
  
  -- Stats
  play_count INTEGER DEFAULT 0,
  like_count INTEGER DEFAULT 0,
  share_count INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_releases_label ON releases(label_id);
CREATE INDEX idx_releases_creator ON releases(creator_user_id);
CREATE INDEX idx_releases_status ON releases(status, visibility);
CREATE INDEX idx_releases_featured ON releases(is_featured) WHERE is_featured = true;
CREATE INDEX idx_releases_created ON releases(created_at DESC);
```

---

### 6. **`user_profiles`** Table (Personal User Profiles)
Separate from labels - personal profile page

```sql
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clerk_user_id TEXT UNIQUE NOT NULL,
  
  -- Profile details
  display_name TEXT NOT NULL,
  username TEXT UNIQUE NOT NULL,
  bio TEXT,
  avatar_url TEXT,
  location TEXT,
  
  -- Social links
  website TEXT,
  instagram TEXT,
  twitter TEXT,
  spotify TEXT,
  
  -- Preferences
  show_library BOOLEAN DEFAULT true, -- Show personal library
  show_labels BOOLEAN DEFAULT true, -- Show owned labels
  
  -- Stats
  total_generations INTEGER DEFAULT 0,
  total_releases INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT fk_user FOREIGN KEY (clerk_user_id) REFERENCES users(clerk_user_id) ON DELETE CASCADE
);

CREATE INDEX idx_user_profiles_username ON user_profiles(username);
```

---

## 🏗️ DEVELOPMENT ROADMAP

---

## PHASE 1: Library System (Foundation)
**Goal:** Store all generated media in organized libraries

### 1.1 Database Migration
- [ ] Create `music_library` table
- [ ] Create `images_library` table  
- [ ] Create `videos_library` table
- [ ] Add RLS policies for each table
- [ ] Test insert/select queries

### 1.2 Update Generation Endpoints
**Music Generation** (`/api/generate/music-only`)
- [ ] After R2 upload, save to `music_library` table
- [ ] Store: title, prompt, lyrics, audio_url, file_size, duration
- [ ] Return library entry ID

**Image Generation** (`/api/generate/image-only`)
- [ ] After R2 upload, save to `images_library` table
- [ ] Store: title, prompt, image_url, file_size, dimensions
- [ ] Return library entry ID

**Video Generation** (When implemented)
- [ ] Create `/api/generate/video-only` endpoint
- [ ] Upload to R2 → `users/{userId}/videos/`
- [ ] Save to `videos_library` table

### 1.3 Library API Endpoints
- [ ] `GET /api/library/music` - List user's music
- [ ] `GET /api/library/images` - List user's images
- [ ] `GET /api/library/videos` - List user's videos
- [ ] `GET /api/library/all` - All media combined
- [ ] `DELETE /api/library/:type/:id` - Delete library item
- [ ] `PATCH /api/library/:type/:id` - Update title/metadata

### 1.4 Library UI Components
- [ ] `MusicLibraryGrid.tsx` - Display music files as cards
- [ ] `ImageLibraryGrid.tsx` - Display images as gallery
- [ ] `VideoLibraryGrid.tsx` - Display videos as grid
- [ ] `LibraryTabs.tsx` - Tab switcher (Music/Images/Videos/All)
- [ ] `LibraryItemCard.tsx` - Individual media card with actions

### 1.5 Library Page
- [ ] `/app/library/page.tsx` - Main library page
- [ ] Show tabs for Music/Images/Videos
- [ ] Grid view with filters (date, type, status)
- [ ] Search functionality
- [ ] Bulk actions (delete, download)

**Deliverable:** Users can see all their generated media in organized libraries

---

## PHASE 2: Labels System (Profile/Showcase)
**Goal:** Users create label pages to showcase releases

### 2.1 Database Migration
- [ ] Create `labels` table
- [ ] Create `user_profiles` table
- [ ] Add RLS policies
- [ ] Test label creation flow

### 2.2 Label Creation
**API Endpoints:**
- [ ] `POST /api/labels` - Create new label
- [ ] `GET /api/labels/:slug` - Get label by slug
- [ ] `PATCH /api/labels/:id` - Update label
- [ ] `DELETE /api/labels/:id` - Delete label
- [ ] `GET /api/labels/user/:userId` - Get user's labels

**UI Components:**
- [ ] `CreateLabelModal.tsx` - Form to create label
- [ ] `LabelSettingsForm.tsx` - Edit label details
- [ ] `LabelThemeEditor.tsx` - Customize colors/theme

### 2.3 Label Page
- [ ] `/app/label/[slug]/page.tsx` - Public label page
- [ ] Display label banner, avatar, bio
- [ ] List all releases on this label
- [ ] Social links, stats
- [ ] Follow button (future)

### 2.4 User Profile Page
- [ ] `/app/profile/me/page.tsx` - Own profile edit
- [ ] `/app/u/[username]/page.tsx` - Public profile view
- [ ] Show user's labels
- [ ] Show user's library (if public)
- [ ] Edit profile button (if own profile)

**Deliverable:** Users can create label pages with custom branding

---

## PHASE 3: Releases System (Combined Media Showcase)
**Goal:** Publish music + cover art/video as release on label

### 3.1 Database Migration
- [ ] Create `releases` table
- [ ] Add foreign keys to music/images/videos libraries
- [ ] Add RLS policies
- [ ] Add indexes for performance

### 3.2 Create Release Flow
**API Endpoints:**
- [ ] `POST /api/releases` - Create release
- [ ] `GET /api/releases/:id` - Get release details
- [ ] `PATCH /api/releases/:id` - Update release
- [ ] `DELETE /api/releases/:id` - Delete release
- [ ] `GET /api/releases/label/:labelId` - Get label's releases

**UI Components:**
- [ ] `CreateReleaseModal.tsx` - Select music + cover/video
- [ ] `ReleaseForm.tsx` - Add title, artist, description
- [ ] `MediaSelector.tsx` - Pick from library (music, image, video)
- [ ] `ReleasePreview.tsx` - Preview before publishing

### 3.3 Release Card Component
- [ ] `ReleaseCard.tsx` - Display release with:
  - [ ] Cover art/video thumbnail
  - [ ] Title + Artist name
  - [ ] Play button (audio)
  - [ ] View on label link
  - [ ] Share button
  - [ ] Like button

### 3.4 Update Combine Media Modal
**Current:** `CombineMediaModal.tsx` saves to `combined_media`
**New:** After combining, option to:
- [ ] Save to combined_media (temporary/preview)
- [ ] OR Create Release (permanent on label)
- [ ] Select which label to publish to
- [ ] Add release metadata (title, artist, genre)

### 3.5 Release Management Page
- [ ] `/app/releases/page.tsx` - Manage all releases
- [ ] List user's releases across all labels
- [ ] Edit, delete, feature releases
- [ ] Analytics (plays, likes, shares)

**Deliverable:** Users can publish combined media as releases on labels

---

## PHASE 4: Explore/Discovery System
**Goal:** Public can discover releases by username + song title

### 4.1 Update Explore Page
**Current:** `/app/explore/page.tsx` shows `combined_media`
**New:** Show `releases` instead

- [ ] Update to fetch from `releases` table
- [ ] Display: username, song title, cover art
- [ ] Click to view full release page
- [ ] Filter by genre, tags, featured
- [ ] Sort by: newest, popular, trending

### 4.2 Release Detail Page
- [ ] `/app/release/[id]/page.tsx` - Single release view
- [ ] Full player with cover art/video
- [ ] Artist/label info
- [ ] Prompts used (music + image)
- [ ] Share buttons
- [ ] Related releases

### 4.3 Discovery Features
- [ ] Search by username, song title, genre
- [ ] Filter by label
- [ ] Featured releases section
- [ ] Trending algorithm (plays in last 7 days)
- [ ] Infinite scroll/pagination

### 4.4 Stats Tracking
**API Endpoints:**
- [ ] `POST /api/releases/:id/play` - Increment play count
- [ ] `POST /api/releases/:id/like` - Like release
- [ ] `POST /api/releases/:id/share` - Track shares

**Deliverable:** Public explore page showcasing all releases with discovery features

---

## PHASE 5: UI/UX Refinements
**Goal:** Polish the user experience

### 5.1 Navigation Updates
- [ ] Add "Library" to main nav
- [ ] Add "My Labels" to main nav
- [ ] Add "My Releases" dropdown
- [ ] User menu: Profile, Labels, Library, Settings

### 5.2 Dashboard Page
- [ ] `/app/dashboard/page.tsx` - User home page
- [ ] Quick stats: credits, generations, releases
- [ ] Recent activity
- [ ] Quick actions: Generate, Create Release, Edit Label

### 5.3 Generation Flow Improvements
**Current:** 3 separate buttons (Music, Cover Art, Combine)
**Improved:**
- [ ] After generating music → "Add Cover Art?" button
- [ ] After both → "Create Release?" button
- [ ] Streamlined flow: Generate → Combine → Publish

### 5.4 Mobile Responsive
- [ ] Test all pages on mobile
- [ ] Fix library grid on small screens
- [ ] Optimize player controls for mobile
- [ ] Touch gestures for swipe navigation

### 5.5 Loading States
- [ ] Skeleton loaders for library grids
- [ ] Progress bars for generation
- [ ] Loading spinners for R2 uploads
- [ ] Optimistic UI updates

**Deliverable:** Smooth, intuitive user experience across all devices

---

## PHASE 6: Advanced Features (Future)
**Goal:** Additional features for growth

### 6.1 Social Features
- [ ] Follow labels
- [ ] Follow users
- [ ] Like releases
- [ ] Comment on releases
- [ ] Share to social media

### 6.2 Collaboration
- [ ] Submit release to another label
- [ ] Label accepts/rejects submissions
- [ ] Collaborative releases (multiple artists)

### 6.3 Analytics Dashboard
- [ ] Label analytics: total plays, top releases
- [ ] User analytics: engagement, growth
- [ ] Export reports

### 6.4 Monetization
- [ ] Premium labels (custom domains)
- [ ] Featured releases (paid promotion)
- [ ] Download tracking
- [ ] Tip jar for artists

### 6.5 Video Generation
- [ ] Integrate video AI model (Kling, Runway, Luma)
- [ ] Upload to R2
- [ ] Add to releases
- [ ] Video player component

---

## 📋 IMMEDIATE NEXT STEPS (Priority Order)

### Week 1: Library System
1. ✅ Create database migrations (music, images, videos libraries)
2. ✅ Update generation endpoints to save to libraries
3. ✅ Create library API endpoints
4. ✅ Build library UI components
5. ✅ Create `/library` page

### Week 2: Labels System
1. ✅ Create labels table migration
2. ✅ Build label creation flow
3. ✅ Create label page template
4. ✅ Add label management UI

### Week 3: Releases System
1. ✅ Create releases table migration
2. ✅ Build create release flow
3. ✅ Update combine media to create releases
4. ✅ Build release card component

### Week 4: Explore & Discovery
1. ✅ Update explore page to show releases
2. ✅ Add search/filter functionality
3. ✅ Create release detail page
4. ✅ Test full user journey

---

## 🎯 SUCCESS METRICS

**User Journey Completion:**
1. ✅ User generates music → Saved to library
2. ✅ User generates cover art → Saved to library
3. ✅ User creates label → Label page live
4. ✅ User creates release → Music + art combined
5. ✅ Release published to label → Shows on label page
6. ✅ Release appears in explore → Public can discover
7. ✅ Public plays release → Stats tracked

**Database Structure:**
- ✅ All media in organized libraries (music, images, videos)
- ✅ Labels for showcasing releases
- ✅ Releases linking media together
- ✅ Clean user journey from generation → publication

**UI/UX:**
- ✅ Intuitive generation flow
- ✅ Easy release creation
- ✅ Beautiful label pages
- ✅ Engaging explore page
- ✅ Mobile responsive

---

## 📁 FILE STRUCTURE (Planned)

```
app/
├── library/
│   └── page.tsx                    # User's media library
├── label/
│   ├── [slug]/
│   │   └── page.tsx               # Public label page
│   └── new/
│       └── page.tsx               # Create label
├── releases/
│   ├── page.tsx                   # Manage releases
│   └── [id]/
│       └── page.tsx               # Release detail
├── dashboard/
│   └── page.tsx                   # User dashboard
└── api/
    ├── library/
    │   ├── music/route.ts
    │   ├── images/route.ts
    │   └── videos/route.ts
    ├── labels/
    │   ├── route.ts               # Create/list labels
    │   └── [id]/route.ts          # Update/delete label
    └── releases/
        ├── route.ts               # Create release
        └── [id]/route.ts          # Get/update release

components/
├── library/
│   ├── MusicLibraryGrid.tsx
│   ├── ImageLibraryGrid.tsx
│   ├── VideoLibraryGrid.tsx
│   └── LibraryItemCard.tsx
├── labels/
│   ├── CreateLabelModal.tsx
│   ├── LabelCard.tsx
│   └── LabelSettingsForm.tsx
└── releases/
    ├── CreateReleaseModal.tsx
    ├── ReleaseCard.tsx
    └── ReleasePlayer.tsx
```

---

## 🚀 LET'S START!

**Ready to begin?** I recommend starting with **PHASE 1: Library System** as it's the foundation for everything else.

Would you like me to:
1. Create the database migrations for libraries?
2. Update the generation endpoints to save to libraries?
3. Build the library UI components?

Let me know which phase to start with! 🎉
