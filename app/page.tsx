'use client'

import { useRouter } from 'next/navigation'
import { Music } from 'lucide-react'
import FloatingMenu from './components/FloatingMenu'
import HolographicBackgroundClient from './components/HolographicBackgroundClient'
import { useState } from 'react'

export default function HomePage() {
  const router = useRouter()
  const [isTransitioning, setIsTransitioning] = useState(false)

  // 3D transition animation to create page
  const handleFocus = () => {
    setIsTransitioning(true)
    
    // Add 3D flip animation before navigation
    setTimeout(() => {
      router.push('/create')
    }, 600)
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col relative overflow-hidden">
      {/* Holographic 3D Background */}
      <HolographicBackgroundClient />
      
      {/* Main Content Wrapper with 3D transition */}
      <div 
        className={`relative z-10 flex-1 flex flex-col transition-all duration-700 ease-in-out ${
          isTransitioning 
            ? 'opacity-0 scale-95 rotate-y-90' 
            : 'opacity-100 scale-100'
        }`}
        style={{
          transform: isTransitioning ? 'perspective(1000px) rotateY(90deg) scale(0.9)' : 'perspective(1000px) rotateY(0deg) scale(1)',
          transformStyle: 'preserve-3d',
        }}
      >
        {/* Floating Menu */}
        <FloatingMenu />

        {/* Landing View - Centered & Mobile Optimized */}
        <div className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8 py-8">
          {/* Welcome Text - Aesthetically Aligned */}
          <div className="text-center mb-8 sm:mb-12 md:mb-16 animate-fade-in space-y-4 sm:space-y-6">
            {/* Logo & Title */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-5">
              <img 
                src="/radio-logo.svg" 
                alt="444 Radio" 
                className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 transition-transform hover:scale-110 duration-300" 
                style={{ filter: 'drop-shadow(0 0 20px rgba(34, 211, 238, 0.8)) drop-shadow(0 0 40px rgba(34, 211, 238, 0.4))' }} 
              />
              <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-black bg-gradient-to-r from-white via-cyan-100 to-cyan-300 bg-clip-text text-transparent leading-tight tracking-tight">
                444 Radio
              </h1>
            </div>
            
            {/* Tagline */}
            <p className="text-base sm:text-lg md:text-xl lg:text-2xl text-gray-300 font-light tracking-wide max-w-2xl mx-auto px-4">
              A world where music feels infinite.
            </p>
          </div>

          {/* Single Prompt Input - Mobile Optimized */}
          <div className="w-full max-w-xl lg:max-w-3xl mx-auto px-4">
            <div 
              className="group relative cursor-pointer transform transition-all duration-500 hover:scale-105 active:scale-95" 
              onClick={handleFocus}
            >
              {/* Glow Effect */}
              <div className="absolute -inset-1 bg-gradient-to-r from-cyan-600 via-cyan-500 to-cyan-400 rounded-2xl sm:rounded-3xl blur-xl opacity-40 group-hover:opacity-70 group-active:opacity-90 transition duration-500 animate-pulse"></div>
              
              {/* Input Container */}
              <div className="relative flex gap-3 sm:gap-4 items-center bg-black/45 backdrop-blur-2xl rounded-2xl sm:rounded-3xl px-4 sm:px-6 py-4 sm:py-5 border-2 border-cyan-500/30 group-hover:border-cyan-400/60 group-active:border-cyan-300/80 transition-all duration-300 shadow-2xl">
                <Music 
                  size={20} 
                  className="text-cyan-400 flex-shrink-0 drop-shadow-[0_0_12px_rgba(34,211,238,0.9)] group-hover:scale-110 transition-transform" 
                />
                <div className="flex-1 text-center sm:text-left">
                  <div className="text-sm sm:text-base lg:text-lg font-light text-gray-300 group-hover:text-cyan-300 transition-all tracking-wide">
                    Describe your sound...
                  </div>
                  <div className="text-xs text-cyan-400/60 mt-1 font-mono hidden sm:block">
                    Click to start creating
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Info - Mobile Optimized */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 mt-4 sm:mt-6 text-xs sm:text-sm">
              <span className="text-cyan-400/80 font-mono tracking-wider flex items-center gap-2">
                <span className="hidden sm:inline">✨</span>
                <span>Tap to unleash creativity</span>
                <span className="hidden sm:inline">✨</span>
              </span>
            </div>
          </div>

          {/* Feature Pills - Mobile Friendly */}
          <div className="mt-12 sm:mt-16 flex flex-wrap items-center justify-center gap-2 sm:gap-3 px-4 max-w-2xl">
            {['Instant Generation', 'High Quality', 'Unlimited Ideas'].map((feature, index) => (
              <div
                key={feature}
                className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs sm:text-sm font-mono backdrop-blur-sm hover:bg-cyan-500/20 hover:border-cyan-400/50 transition-all duration-300 cursor-default"
                style={{
                  animationDelay: `${index * 100}ms`,
                }}
              >
                {feature}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 3D Transition Overlay */}
      {isTransitioning && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center">
          <div className="text-cyan-400 text-2xl font-mono animate-pulse">
            Loading Studio...
          </div>
        </div>
      )}
    </div>
  )
}
