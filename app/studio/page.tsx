'use client'

import dynamic from 'next/dynamic'

// Dynamic import to avoid SSR issues with Web Audio APIs
// Must match /input/page.tsx pattern — browser-only AudioContext etc.
const StudioEditor = dynamic(() => import('@/app/components/StudioEditor'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-screen font-mono" style={{ background: '#1c1e22', color: '#7fa998' }}>
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 rounded-full border-2 animate-spin" style={{ borderColor: '#2a2e34', borderTopColor: '#7fa998' }} />
        <span className="text-sm font-bold tracking-[.2em]" style={{ color: '#c8cdd2', opacity: 0.7 }}>444 STUDIO</span>
      </div>
    </div>
  ),
})

export default function StudioPage() {
  return (
    <div className="h-screen w-screen overflow-hidden" style={{ background: '#1c1e22' }}>
      <StudioEditor />
    </div>
  )
}
