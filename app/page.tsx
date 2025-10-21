'use client'

import { useRouter } from 'next/navigation'
import { Music } from 'lucide-react'
import FloatingMenu from './components/FloatingMenu'
import HolographicBackgroundClient from './components/HolographicBackgroundClient'
import FloatingGenres from './components/FloatingGenres'
import { useState } from 'react'

export default function HomePage() {
  const router = useRouter()
  const [isTransitioning, setIsTransitioning] = useState(false)

  // 3D transition animation to create page - simplified for mobile
  const handleFocus = () => {
    setIsTransitioning(true)
    
    // Faster transition for mobile
    setTimeout(() => {
      router.push('/create')
    }, 400)
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col relative overflow-hidden">
      {/* Holographic 3D Background */}
      <HolographicBackgroundClient />
      
      {/* Floating Genre Texts */}
      <FloatingGenres />
      
      {/* Main Content Wrapper - Simplified transition for mobile */}
      <div 
        className={`relative z-10 flex-1 flex flex-col transition-opacity duration-500 ${
          isTransitioning 
            ? 'opacity-0' 
            : 'opacity-100'
        }`}
      >
        {/* Floating Menu */}
        <FloatingMenu />

        {/* Landing View - Mobile First Design - Optimized for 5.8" screens */}
        <div className="flex-1 flex flex-col items-center md:justify-center px-4 sm:px-6 lg:px-8 pt-16 md:py-8">
          
          {/* Welcome Text - Top Section on Mobile, Centered on Desktop */}
          <div className="text-center space-y-2 md:space-y-6 md:mb-16 will-change-auto flex-shrink-0">
            {/* Logo & Title */}
            <div className="flex flex-col items-center justify-center gap-2 md:gap-5 md:flex-row">
              <img 
                src="/radio-logo.svg" 
                alt="444 Radio" 
                className="w-12 h-12 md:w-20 md:h-20 lg:w-24 lg:h-24 md:transition-transform md:hover:scale-110 md:duration-300" 
                style={{ filter: 'drop-shadow(0 0 20px rgba(34, 211, 238, 0.8))' }} 
              />
              <h1 className="text-3xl md:text-6xl lg:text-8xl font-black bg-gradient-to-r from-white via-cyan-100 to-cyan-300 bg-clip-text text-transparent leading-tight tracking-tight">
                444 Radio
              </h1>
            </div>
            
            {/* Tagline */}
            <p className="text-xs md:text-xl lg:text-2xl text-gray-300 font-light tracking-wide max-w-2xl mx-auto px-4">
              A world where music feels infinite.
            </p>

            {/* Feature Pills - Desktop Only */}
            <div className="hidden md:flex flex-wrap items-center justify-center gap-2 lg:gap-3 px-4 max-w-2xl mx-auto mt-8">
              {['Instant Generation', 'High Quality', 'Unlimited Ideas'].map((feature) => (
                <div
                  key={feature}
                  className="px-3 lg:px-4 py-1.5 lg:py-2 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs lg:text-sm font-mono backdrop-blur-sm hover:bg-cyan-500/20 hover:border-cyan-400/50 transition-all duration-300 cursor-default"
                >
                  {feature}
                </div>
              ))}
            </div>
          </div>

          {/* Spacer for mobile to push content up */}
          <div className="flex-1 md:hidden"></div>
        </div>

        {/* Prompt Input - Fixed to bottom on mobile, centered in layout on desktop */}
        <div className="fixed bottom-0 left-0 right-0 md:relative md:bottom-auto px-4 sm:px-6 lg:px-8 pb-safe md:pb-0 z-20">
          <div className="w-full md:max-w-xl lg:max-w-3xl mx-auto">
            <div 
              className="group relative cursor-pointer active:scale-95 md:hover:scale-105 transition-transform duration-200" 
              onClick={handleFocus}
            >
              {/* Glow Effect */}
              <div className="absolute -inset-1 bg-gradient-to-r from-cyan-600 via-cyan-500 to-cyan-400 rounded-3xl blur-lg md:blur-xl opacity-30 md:opacity-40 group-hover:opacity-70 group-active:opacity-60 transition-opacity duration-300"></div>
              
              {/* Input Container - Optimized for 5.8" screens */}
              <div className="relative flex gap-2.5 md:gap-4 items-center bg-black/40 md:bg-black/20 backdrop-blur-xl md:backdrop-blur-3xl rounded-3xl px-4 md:px-6 py-3.5 md:py-5 border-2 border-cyan-500/30 group-active:border-cyan-400/60 md:group-hover:border-cyan-400/60 transition-colors duration-200 shadow-2xl">
                <Music 
                  size={20} 
                  className="text-cyan-400 flex-shrink-0 drop-shadow-[0_0_12px_rgba(34,211,238,0.9)] md:w-[22px] md:h-[22px]" 
                />
                <div className="flex-1 text-center md:text-left">
                  <div className="text-sm md:text-lg font-light text-gray-200 tracking-wide">
                    Describe your sound...
                  </div>
                  <div className="text-xs text-cyan-400/60 mt-0.5 font-mono hidden md:block">
                    Click to start creating
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Info */}
            <div className="flex items-center justify-center gap-2 mt-2 md:mt-6 text-xs md:text-sm mb-2">
              <span className="text-cyan-400/60 font-mono tracking-wider">
                ✨ Tap to create
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Transition Overlay - Simplified */}
      {isTransitioning && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center">
          <div className="text-cyan-400 text-lg md:text-2xl font-mono">
            Loading...
          </div>
        </div>
      )}
    </div>
  )
}
