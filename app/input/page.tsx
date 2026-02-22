'use client'

import dynamic from 'next/dynamic'

// Dynamic import to avoid SSR issues with Web Audio APIs
const InputEditor = dynamic(() => import('@/app/components/InputEditor'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-screen bg-[#111] text-green-400 font-mono">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-green-500/30 border-t-green-500 rounded-full animate-spin" />
        <span className="text-sm">Loading 444 INPUT...</span>
      </div>
    </div>
  ),
})

export default function InputPage() {
  return (
    <div className="h-screen w-screen overflow-hidden bg-[#111]">
      <InputEditor />
    </div>
  )
}
