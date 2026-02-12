'use client'

import dynamic from 'next/dynamic'
import { Loader2 } from 'lucide-react'

const DAWClient = dynamic(() => import('./daw-client'), {
  ssr: false,
  loading: () => (
    <div className="h-screen bg-[#0a0a0a] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-6 h-6 text-emerald-400/50 animate-spin" />
        <span className="text-[11px] text-white/30">Loading Studio...</span>
      </div>
    </div>
  ),
})

export default function StudioDAWPage() {
  return <DAWClient />
}
