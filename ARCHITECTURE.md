# 444RADIO - AI Music Social Network

## 🎵 Vision: Instagram for AI Music

**"Everyone's an Artist"** - A social media platform where users generate AI-powered music with cover art and share it like Instagram posts.

---

## ✨ What We Built

### 1. **Homepage - Smart Prompt Interface**
- **Centered prompt box** in the middle of the page when you first visit
- **Automatically docks to bottom** when you start typing
- Clean, minimal design focused on music creation
- Advanced options collapse/expand for genre, BPM, cover art, instrumental toggle
- 3D animated background with Matrix-themed glass morphism

### 2. **Explore Page** (`/explore`)
- Instagram-style grid layout for all music
- Filter by: Trending, New, Top, Genre
- Each song card shows:
  - Cover art (AI-generated)
  - Artist username
  - Likes ❤️ and Plays ▶️ count
  - Play button overlay on hover
- Click any card to view full song page

### 3. **Profile Page** (`/profile/[userId]`)
- User's personal music showcase
- Profile header with:
  - Avatar
  - Username
  - Total tracks, likes, and plays
  - Edit profile button (for own profile)
- Grid of user's generated music
- Each track card interactive with hover effects

### 4. **Authentication** (Clerk + Supabase)
- Sign up / Sign in pages with Matrix styling
- Webhook sync from Clerk → Supabase database
- Protected routes (only signed-in users can create)
- User profile management

### 5. **Database Architecture** (Supabase PostgreSQL)
```sql
Tables:
- users (synced from Clerk)
- songs (title, prompt, cover_url, audio_url, likes, plays, genre, bpm)
- likes (user_id, song_id)
- comments (user_id, song_id, content)
- playlists (user_id, name, description)
- playlist_songs (playlist_id, song_id, position)
```

### 6. **AI Generation Stack**
- **Replicate API** for music generation
- **Image generation** for cover art (to be integrated)
- **Video generation** for cover videos (planned)
- All generated content saved to Supabase

---

## 🎨 Design System

### Color Palette (Matrix Deep Technology)
- Primary Green: `#00ff9d`
- Cyan Accent: `#00ffff`
- Dark Base: Black → Slate-950 → Green-950 gradient
- Glass morphism with `backdrop-blur-xl`
- Glowing borders and shadows

### UI Components
- Glass morphism cards
- Smooth transitions and animations
- Rounded corners (`rounded-2xl`, `rounded-full`)
- Gradient backgrounds
- 3D animated spheres and particles

---

## 📁 File Structure

```
app/
├── page.tsx              # Homepage with centered prompt
├── explore/
│   └── page.tsx          # Social feed (all music)
├── profile/[userId]/
│   └── page.tsx          # User profile page
├── sign-in/              # Clerk authentication
├── sign-up/              # Clerk registration
├── api/
│   ├── generate/         # AI music generation endpoint
│   └── webhook/          # Clerk → Supabase sync
└── (other pages)         # Community, Pricing, etc.
```

---

## 🚀 Current Features

✅ Centered prompt that docks to bottom when typing  
✅ Clean, minimal UI (no excessive text)  
✅ Explore page with Instagram-style grid  
✅ User profile pages  
✅ Authentication with Clerk  
✅ Database with Supabase + RLS policies  
✅ Webhook for user synchronization  
✅ 3D background animations  
✅ Matrix-themed glass morphism design  
✅ Responsive mobile/desktop layouts  

---

## 🔨 To Be Built (Next Steps)

### Phase 1: Complete Core Features
1. **API Integration**
   - Connect Replicate music generation models
   - Implement cover art generation (DALL-E or Stable Diffusion)
   - Add video generation for cover videos
   - Save generated content to Supabase Storage

2. **Music Player**
   - Create audio player component
   - Add play/pause/seek controls
   - Show now playing bar at bottom
   - Queue management

3. **Song Detail Page** (`/song/[id]`)
   - Full-screen player
   - Cover art display
   - Like/unlike button
   - Comment section
   - Share options
   - Download button

### Phase 2: Social Features
1. **Interactions**
   - Like songs (save to Supabase likes table)
   - Comment on songs
   - Share to social media
   - Follow/unfollow users

2. **Feed Improvements**
   - Real-time updates
   - Infinite scroll
   - Filter by followed artists
   - Search functionality

3. **Playlists**
   - Create/edit/delete playlists
   - Add songs to playlists
   - Public/private playlist toggle
   - Share playlists

### Phase 3: Discovery & Engagement
1. **Trending Algorithm**
   - Calculate trending scores
   - Featured artists section
   - Genre-based recommendations

2. **User Profiles Enhancement**
   - Bio and profile picture upload
   - Social links
   - Follower/following counts
   - Activity feed

3. **Notifications**
   - New followers
   - Likes on your music
   - Comments
   - Featured in trending

### Phase 4: Monetization (Razorpay)
1. **Premium Features**
   - Unlimited generations (free users: 10/month)
   - HD audio quality
   - Commercial licensing
   - Priority generation queue
   - Custom models

2. **Marketplace**
   - Sell music licenses
   - Commission-based transactions
   - Payout system

---

## 🔧 Technical Stack

| Component | Technology |
|-----------|-----------|
| Framework | Next.js 15 (App Router, Turbopack) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| 3D Graphics | Three.js, React Three Fiber |
| Authentication | Clerk |
| Database | Supabase (PostgreSQL) |
| File Storage | Supabase Storage (planned) |
| AI Music | Replicate API |
| AI Images | Replicate / OpenAI DALL-E |
| Payments | Razorpay (planned) |
| Deployment | Vercel |
| Domain | 444radio.co.in |

---

## 🌐 Live URLs

- **Production**: https://444radio.co.in
- **Vercel Dashboard**: https://vercel.com/101world/444Radio
- **GitHub Repo**: https://github.com/101world/444Radio
- **Clerk Dashboard**: https://dashboard.clerk.com
- **Supabase Dashboard**: https://supabase.com/dashboard/project/yirjulakkgignzbrqnth

---

## 📝 Environment Variables (All Set in Vercel)

```bash
# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
CLERK_WEBHOOK_SECRET=(configured)

# Supabase Database
NEXT_PUBLIC_SUPABASE_URL=https://yirjulakkgignzbrqnth.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...

# AI Generation
REPLICATE_API_TOKEN=r8_...

# Redirect URLs
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/
```

---

## 🎯 User Flow

1. **Visitor** lands on homepage → sees "Everyone's an Artist" hero
2. **Sign Up** → creates account with Clerk
3. **Redirected to homepage** → sees centered prompt: "What do you want to create?"
4. **Types music description** → prompt smoothly docks to bottom
5. **Advanced options** → can add genre, BPM, cover art prompt
6. **Clicks Generate** → AI creates music + cover art
7. **Music saved** → appears on user's profile
8. **Explore page** → music visible to all users (Instagram-style grid)
9. **Social interactions** → users can like, comment, share
10. **Profile page** → showcase all your generated music

---

## 💡 Key Differentiators

1. **Prompt Docking UX** - Centered prompt that moves to bottom when typing (unique interaction)
2. **Visual-First** - Instagram-like grid, not just a list
3. **Social Network** - Not just a tool, it's a community
4. **Cover Art Integration** - Every song has AI-generated visuals
5. **Zero Music Skills Required** - Anyone can be an artist
6. **Matrix Aesthetic** - Distinctive green/cyan tech theme

---

## 🚀 Deployment Status

✅ **Code Pushed** to GitHub  
✅ **Vercel Auto-Deployed** (building now)  
✅ **Environment Variables** configured  
✅ **Clerk Webhook** set up  
✅ **Supabase Database** tables created  
✅ **Domain** connected (444radio.co.in)  

**Next**: Wait for Vercel deployment to complete (~2-3 minutes)

---

## 📚 Documentation Files

- `PRODUCTION-SETUP.md` - Complete production deployment guide
- `SETUP-GUIDE.md` - Development setup instructions
- `QUICK-START.md` - 3-minute production checklist
- `supabase-schema.sql` - Database schema (already applied)

---

**Built with ❤️ by the 444RADIO team**  
*Transforming everyone into music artists with AI*
