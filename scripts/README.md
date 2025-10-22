# Seed Songs Generator

This directory contains scripts to populate your 444Radio platform with seed songs.

## Files

- **`seed-songs.json`** - Collection of 20 beautifully crafted songs with titles, genres, and lyrics
- **`generate-seed-songs.ts`** - TypeScript script to automatically generate these songs via your API
- **`seed-results.json`** - Generated after running the script (tracks success/failures)

## Song Collection

The seed data includes **20 songs** across 5 genres:

- 🎧 **Lo-fi** (4 songs): City Moons, Echo Park Dreams, Glass Radio, Cloud Balcony
- 🎤 **Hip-Hop** (4 songs): Paper Crown, Iron Petals, Northside Code, Steel Halo
- 🎷 **Jazz** (4 songs): Amber Wine, Soft Sapphire, Cobalt Sun, Golden Steam
- 🌊 **Chill** (4 songs): Moonline Drive, Seafoam Sky, Frozen Wave, Wanderlight
- 💖 **R&B** (4 songs): Velvet Night, Crimson Sway, Neon Verse, Honey Mirage

## Usage

### Method 1: Run the Generation Script

```bash
# Install tsx if you haven't already
npm install -g tsx

# Set your user ID (get this from Clerk dashboard or database)
export SEED_USER_ID="your-clerk-user-id"

# Run the script
npx tsx scripts/generate-seed-songs.ts
```

### Method 2: Manual Generation via UI

1. Go to your `/create` page
2. Copy the lyrics from `seed-songs.json`
3. Paste into the prompt field
4. Set the title and genre
5. Generate each song individually

### Method 3: Bulk Import API (Custom)

Create a custom API endpoint for bulk importing:

```typescript
// app/api/songs/bulk-import/route.ts
import { NextResponse } from 'next/server'
import songs from '@/scripts/seed-songs.json'

export async function POST(req: Request) {
  const { userId } = await req.json()
  
  // Generate all songs for the user
  const results = []
  for (const song of songs) {
    // Your generation logic here
    results.push(await generateSong(song, userId))
  }
  
  return NextResponse.json({ results })
}
```

## Environment Variables

Make sure these are set in your `.env.local`:

```bash
SEED_USER_ID=user_xxxxxxxxxxxxx  # Your Clerk user ID
NEXT_PUBLIC_SITE_URL=http://localhost:3000  # Or your production URL
```

## Notes

- The script includes a **2-second delay** between requests to avoid rate limiting
- All results are logged and saved to `seed-results.json`
- Failed generations are tracked separately
- Songs are generated with AI cover art automatically

## Customization

To add more songs, edit `seed-songs.json`:

```json
{
  "title": "Your Song Title",
  "genre": "lofi|hiphop|jazz|chill|rnb",
  "lyrics": "Your beautiful lyrics here..."
}
```

## Credits

These lyrics were crafted with poetic imagery and emotional depth to showcase the platform's music generation capabilities across diverse genres.
