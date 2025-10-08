# 444RADIO.CO.IN

AI-powered music generation platform built with Next.js, Clerk, Supabase, and Replicate.

## Features

- User authentication with Clerk
- AI music generation using Replicate
- User profiles with generated music
- Community billboard showcasing shared songs
- Explore page for all uploaded music
- Pricing page
- Visuals gallery for cinematic loops
- Dark theme with neon accents

## Tech Stack

- **Frontend:** Next.js 15, React, TypeScript, Tailwind CSS
- **Authentication:** Clerk
- **Database:** Supabase
- **AI Generation:** Replicate
- **Deployment:** Vercel

## Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up environment variables in `.env.local`:
   ```
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
   CLERK_SECRET_KEY=your_clerk_secret_key
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   REPLICATE_API_TOKEN=your_replicate_token
   ```
4. Set up Supabase database with a `songs` table:
   ```sql
   CREATE TABLE songs (
     id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
     user_id TEXT NOT NULL,
     title TEXT,
     prompt TEXT,
     lyrics TEXT,
     bpm INTEGER,
     genre TEXT,
     instrumental BOOLEAN,
     audio_url TEXT,
     cover_url TEXT,
     created_at TIMESTAMP DEFAULT NOW()
   );
   ```
5. Run the development server:
   ```bash
   npm run dev
   ```

## Pages

- **Home (/):** Music generation form
- **Music (/music):** Explore all songs
- **Visuals (/visuals):** Gallery of cinematic loops
- **Community (/community):** Billboard and fan engagement
- **Pricing (/pricing):** Subscription plans

## Deployment

Deploy to Vercel by connecting your GitHub repository. Ensure all environment variables are set in Vercel.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT
