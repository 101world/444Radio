'use client'

import dynamic from 'next/dynamic'

// Dynamic import to avoid SSR issues with Web Audio APIs
// Must match /input/page.tsx pattern — browser-only AudioContext etc.
const StudioEditor = dynamic(() => import('@/app/components/StudioEditor'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-screen bg-[#0a0a0e] text-cyan-400 font-mono">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
        <span className="text-sm">Loading 444 STUDIO...</span>
      </div>
    </div>
  ),
})

export default function StudioPage() {
  return (
    <div className="h-screen w-screen overflow-hidden bg-[#0a0a0e]">
      <StudioEditor />
    </div>
  )
}
