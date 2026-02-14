// Plugin layout is intentionally empty — the root layout handles
// rendering a bare shell (no Clerk/AudioPlayer) for /plugin routes.
// This file exists so Next.js registers /plugin as a valid route segment.
export default function PluginLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
