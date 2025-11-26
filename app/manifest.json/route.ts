import { NextResponse } from 'next/server'

export async function GET() {
  const manifest = {
    name: "444 Radio Studio",
    short_name: "444Radio",
    description: "AI-powered music creation and social platform",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#000000",
    theme_color: "#06b6d4",
    orientation: "any",
    categories: ["music", "entertainment", "social"],
    icons: [
      {
        src: "/studio/icon.png",
        sizes: "144x144",
        type: "image/png"
      }
    ]
  }

  return NextResponse.json(manifest, {
    headers: {
      'Content-Type': 'application/manifest+json',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
