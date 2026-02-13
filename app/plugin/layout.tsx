import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '444 Radio — Ableton Plugin',
  description: 'AI music generation inside Ableton Live',
}

export default function PluginLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Minimal layout — no ClerkProvider, no AudioPlayer, no navbar.
  // This page is loaded inside a JUCE WebView in Ableton.
  // Auth is handled via plugin tokens, not Clerk sessions.
  return (
    <div className="min-h-screen bg-black">
      {children}
    </div>
  )
}
