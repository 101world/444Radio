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

        {/* Landing View - Mobile First Design */}
        <div className="flex-1 flex flex-col items-center justify-between md:justify-center px-4 sm:px-6 lg:px-8 pt-16 pb-4 md:py-8">
          
          {/* Welcome Text - Top Section on Mobile, Centered on Desktop */}
          <div className="text-center animate-fade-in space-y-3 md:space-y-6 md:mb-16">
            {/* Logo & Title */}
            <div className="flex flex-col items-center justify-center gap-2 md:gap-5 md:flex-row">
              <img 
                src="/radio-logo.svg" 
                alt="444 Radio" 
                className="w-12 h-12 md:w-20 md:h-20 lg:w-24 lg:h-24 transition-transform hover:scale-110 duration-300" 
                style={{ filter: 'drop-shadow(0 0 20px rgba(34, 211, 238, 0.8)) drop-shadow(0 0 40px rgba(34, 211, 238, 0.4))' }} 
              />
              <h1 className="text-4xl md:text-6xl lg:text-8xl font-black bg-gradient-to-r from-white via-cyan-100 to-cyan-300 bg-clip-text text-transparent leading-tight tracking-tight">
                444 Radio
              </h1>
            </div>
            
            {/* Tagline */}
            <p className="text-sm md:text-xl lg:text-2xl text-gray-300 font-light tracking-wide max-w-2xl mx-auto px-4">
              A world where music feels infinite.
            </p>

            {/* Feature Pills - Desktop Only */}
            <div className="hidden md:flex flex-wrap items-center justify-center gap-2 lg:gap-3 px-4 max-w-2xl mx-auto mt-8">
              {['Instant Generation', 'High Quality', 'Unlimited Ideas'].map((feature, index) => (
                <div
                  key={feature}
                  className="px-3 lg:px-4 py-1.5 lg:py-2 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs lg:text-sm font-mono backdrop-blur-sm hover:bg-cyan-500/20 hover:border-cyan-400/50 transition-all duration-300 cursor-default"
                  style={{
                    animationDelay: `${index * 100}ms`,
                  }}
                >
                  {feature}
                </div>
              ))}
            </div>
          </div>

          {/* Prompt Input - Docked at Bottom on Mobile, Centered on Desktop */}
          <div className="w-full md:max-w-xl lg:max-w-3xl mx-auto">
            <div 
              className="group relative cursor-pointer transform transition-all duration-500 md:hover:scale-105 active:scale-95" 
              onClick={handleFocus}
            >
              {/* Glow Effect */}
              <div className="absolute -inset-1 bg-gradient-to-r from-cyan-600 via-cyan-500 to-cyan-400 rounded-3xl md:rounded-3xl blur-xl opacity-40 group-hover:opacity-70 group-active:opacity-90 transition duration-500 animate-pulse"></div>
              
              {/* Input Container - Sleek Gen Z Design */}
              <div className="relative flex gap-3 md:gap-4 items-center bg-black/20 backdrop-blur-3xl rounded-3xl px-5 md:px-6 py-4 md:py-5 border-2 border-cyan-500/30 group-hover:border-cyan-400/60 group-active:border-cyan-300/80 transition-all duration-300 shadow-2xl">
                <Music 
                  size={22} 
                  className="text-cyan-400 flex-shrink-0 drop-shadow-[0_0_12px_rgba(34,211,238,0.9)] group-hover:scale-110 transition-transform" 
                />
                <div className="flex-1 text-center md:text-left">
                  <div className="text-base md:text-lg font-light text-gray-200 group-hover:text-cyan-300 transition-all tracking-wide">
                    Describe your sound...
                  </div>
                  <div className="text-xs text-cyan-400/60 mt-0.5 font-mono hidden md:block">
                    Click to start creating
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Info - Mobile Optimized */}
            <div className="flex items-center justify-center gap-2 mt-3 md:mt-6 text-xs md:text-sm">
              <span className="text-cyan-400/60 font-mono tracking-wider flex items-center gap-2">
                <span>✨ Tap to create</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 3D Transition Overlay */}
      {isTransitioning && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center">
          <div className="text-cyan-400 text-xl md:text-2xl font-mono animate-pulse">
            Loading Studio...
          </div>
        </div>
      )}
    </div>
  )
}
