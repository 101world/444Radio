'use client'

import { useRouter } from 'next/navigation'
import { Music } from 'lucide-react'
import FloatingMenu from './components/FloatingMenu'
import HolographicBackgroundClient from './components/HolographicBackgroundClient'

export default function HomePage() {
  const router = useRouter()

  // Seamlessly navigate to create page when user focuses on input
  const handleFocus = () => {
    router.push('/create')
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col relative">
      {/* Holographic 3D Background */}
      <HolographicBackgroundClient />
      
      {/* Main Content Wrapper with higher z-index */}
      <div className="relative z-10 flex-1 flex flex-col">
        {/* Floating Menu */}
        <FloatingMenu />

        {/* Landing View - Centered Prompt */}
        <div className="flex-1 flex flex-col items-center justify-center px-4">
          {/* Welcome Text */}
          <div className="text-center mb-12 animate-fade-in">
            <div className="flex items-center justify-center mb-6 gap-4">
              <img src="/radio-logo.svg" alt="444 Radio" className="w-20 h-20 md:w-24 md:h-24 text-cyan-500 drop-shadow-[0_0_20px_rgba(34,211,238,0.6)]" style={{ filter: 'drop-shadow(0 0 20px rgba(34, 211, 238, 0.6))' }} />
              <h1 className="text-6xl md:text-8xl font-black text-white leading-tight">
                444 Radio
              </h1>
            </div>
            <p className="text-xl text-gray-400 mb-12">
              A world where music feels infinite.
            </p>
          </div>

          {/* Single Prompt Input that redirects on focus/click */}
          <div className="w-full max-w-3xl mx-auto">
            <div className="group relative cursor-pointer" onClick={handleFocus}>
              <div className="absolute -inset-1 bg-gradient-to-r from-cyan-600 to-cyan-400 rounded-2xl blur-lg opacity-30 group-hover:opacity-50 transition duration-300"></div>
              <div className="relative flex gap-3 items-center bg-black/60 backdrop-blur-xl rounded-2xl px-5 py-4 border border-cyan-500/20 group-hover:border-cyan-500/40 transition-all duration-300">
                <Music size={20} className="text-cyan-400 flex-shrink-0 drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
                <div
                  style={{ fontFamily: "'Courier New', monospace" }}
                  className="flex-1 text-sm tracking-wide text-gray-400 group-hover:text-cyan-400 transition-all"
                >
                  {/* Describe the music you want to create... */}
                </div>
              </div>
            </div>

            {/* Quick Info */}
            <div className="flex items-center justify-center gap-4 mt-4 text-xs text-gray-500 font-mono tracking-wider">
              <span className="text-cyan-400 group-hover:text-cyan-300 transition-colors">Click to start creating ✨</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
