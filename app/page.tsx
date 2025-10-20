'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Send } from 'lucide-react'
import FloatingMenu from './components/FloatingMenu'
import HolographicBackgroundClient from './components/HolographicBackgroundClient'

export default function HomePage() {
  const router = useRouter()
  const [prompt, setPrompt] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (prompt.trim()) {
      router.push(`/create?prompt=${encodeURIComponent(prompt)}`)
    }
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col relative">
      <HolographicBackgroundClient />
      <FloatingMenu />
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-2xl relative z-10">
          <h1 className="text-6xl md:text-8xl font-black text-center mb-12 text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 animate-pulse">
            444RADIO
          </h1>
          <form onSubmit={handleSubmit} className="relative">
            <div className="relative group">
              <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Generate..."
                className="w-full px-8 py-6 bg-white/5 backdrop-blur-xl border-2 border-white/10 rounded-3xl text-white placeholder-white/40 text-lg focus:outline-none focus:border-cyan-500/50 transition-all duration-300 group-hover:border-cyan-500/30 pr-16"
                autoFocus
              />
              <button
                type="submit"
                disabled={!prompt.trim()}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-3 bg-gradient-to-r from-cyan-600 to-blue-600 rounded-2xl hover:from-cyan-500 hover:to-blue-500 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-300 hover:scale-105 disabled:hover:scale-100"
              >
                <Send size={24} className="text-white" />
              </button>
            </div>
          </form>
          <p className="text-center mt-6 text-white/30 text-sm">
            Type anything to start creating music, images, or videos
          </p>
        </div>
      </div>
    </div>
  )
}
