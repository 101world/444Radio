'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@clerk/nextjs'
import { Lock, Unlock } from 'lucide-react'

export default function DecryptPage() {
  const { isLoaded } = useAuth()
  const [password, setPassword] = useState('')
  const [isUnlocked, setIsUnlocked] = useState(false)
  const [showMessage, setShowMessage] = useState(false)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const router = useRouter()
  
  // Detect mobile for performance optimization - inline to avoid render blocking
  const isMobile = typeof window !== 'undefined' && (window.innerWidth < 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent))

  // ESC key handler to go back
  useEffect(() => {
    const handleEscKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        router.back()
      }
    }
    
    window.addEventListener('keydown', handleEscKey)
    return () => window.removeEventListener('keydown', handleEscKey)
  }, [router])

  // Matrix Rain Effect - Skip on mobile for performance
  useEffect(() => {
    if (isMobile) return // Skip heavy animation on mobile
    
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$%^&*()_+-=[]{}|;:,.<>?'
    const fontSize = isMobile ? 16 : 14
    const columns = canvas.width / fontSize
    const drops: number[] = []

    for (let i = 0; i < columns; i++) {
      drops[i] = Math.random() * -100
    }

    let animationId: number

    const draw = () => {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.05)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      ctx.fillStyle = '#06b6d4' // Cyan color
      ctx.font = `${fontSize}px monospace`

      for (let i = 0; i < drops.length; i++) {
        const text = chars[Math.floor(Math.random() * chars.length)]
        ctx.fillText(text, i * fontSize, drops[i] * fontSize)

        if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) {
          drops[i] = 0
        }
        drops[i]++
      }

      animationId = requestAnimationFrame(draw)
    }

    draw()

    const handleResize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }

    window.addEventListener('resize', handleResize)

    return () => {
      cancelAnimationFrame(animationId)
      window.removeEventListener('resize', handleResize)
    }
  }, [isMobile])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Prevent multiple submissions
    if (isSubmitting) return
    
    if (password.toLowerCase() === 'free the music') {
      setError('')
      setIsSubmitting(true)
      
      try {
        const response = await fetch('/api/credits/award', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: 'FREE THE MUSIC' })
        })
        
        const data = await response.json()
        
        if (data.success) {
          // Successfully awarded credits
          setIsUnlocked(true)
          setTimeout(() => setShowMessage(true), 500)
        } else if (data.error && data.error.includes('already redeemed')) {
          // Code already used - still show unlock screen but with message
          setIsUnlocked(true)
          setTimeout(() => setShowMessage(true), 500)
        } else {
          setError(data.error || 'Failed to unlock. Try again.')
          setIsSubmitting(false)
        }
      } catch (err) {
        console.error('Failed to award credits:', err)
        setError('Connection failed. Please try again.')
        setIsSubmitting(false)
      }
    } else {
      setError('Access Denied. Seek the truth.')
      setPassword('')
    }
  }

  return (
    <div className="min-h-screen bg-black relative overflow-hidden md:pl-20 md:pr-28">
      {/* Matrix Rain Background */}
      {!isMobile ? (
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full"
        />
      ) : (
        <div className="absolute inset-0 w-full h-full bg-gradient-to-br from-black via-cyan-950/20 to-black" />
      )}

      {/* Content Overlay */}
      <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
        {!isUnlocked ? (
          // Password Entry Screen
          <div className="w-full max-w-md">
            <div className="bg-black/90 md:bg-black/80 backdrop-blur-sm md:backdrop-blur-xl border-2 border-cyan-500/50 rounded-2xl p-8 shadow-lg md:shadow-[0_0_50px_rgba(6,182,212,0.3)]">
              {/* Lock Icon */}
              <div className="flex justify-center mb-6">
                <div className="w-20 h-20 rounded-full bg-cyan-500/20 border-2 border-cyan-500/50 flex items-center justify-center animate-pulse">
                  <Lock className="text-cyan-400" size={40} />
                </div>
              </div>

              {/* Title */}
              <h1 className="text-3xl font-bold text-center text-cyan-400 mb-2 tracking-wider">
                DECRYPTION REQUIRED
              </h1>
              <p className="text-cyan-400/60 text-center text-sm mb-8 font-mono">
                Enter the passphrase to unlock the message
              </p>

              {/* Password Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <input
                    type="text"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter passphrase..."
                    className="w-full px-4 py-3 bg-black/60 border-2 border-cyan-500/30 rounded-lg text-cyan-400 placeholder-cyan-400/30 focus:border-cyan-500 focus:outline-none font-mono transition-all"
                    autoFocus
                  />
                  {error && (
                    <p className="mt-2 text-red-400 text-sm font-mono animate-pulse">
                      {error}
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 bg-gradient-to-r from-cyan-600 to-cyan-400 text-black font-bold rounded-lg hover:from-cyan-500 hover:to-cyan-300 transition-all shadow-lg shadow-cyan-500/50 hover:shadow-cyan-500/70 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  {isSubmitting ? 'DECRYPTING...' : 'DECRYPT'}
                </button>
              </form>

              {/* Hint */}
              <div className="mt-6 p-4 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
                <p className="text-cyan-400/80 text-xs font-mono text-center">
                  Hint: Liberation is the key...
                </p>
              </div>
            </div>
          </div>
        ) : (
          // Unlocked Message Screen
          <div className={`w-full max-w-3xl transition-all duration-1000 ${showMessage ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
            <div className="bg-black/95 md:bg-black/90 backdrop-blur-sm md:backdrop-blur-xl border-2 border-cyan-500/50 rounded-2xl p-8 md:p-12 shadow-lg md:shadow-[0_0_80px_rgba(6,182,212,0.4)]">
              {/* Unlock Icon */}
              <div className="flex justify-center mb-8">
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-cyan-500/30 to-cyan-600/30 border-2 border-cyan-400 flex items-center justify-center animate-pulse">
                  <Unlock className="text-cyan-400" size={48} />
                </div>
              </div>

              {/* Credits Awarded */}
              <div className="text-center mb-8">
                <div className="inline-block px-6 py-3 bg-gradient-to-r from-cyan-600 to-cyan-400 rounded-full shadow-lg shadow-cyan-500/50">
                  <p className="text-black font-bold text-lg">
                    +20 CREDITS UNLOCKED
                  </p>
                </div>
              </div>

              {/* The Message */}
              <div className="space-y-6 text-cyan-400/90 font-mono text-sm md:text-base leading-relaxed">
                <h2 className="text-2xl md:text-3xl font-bold text-center text-cyan-400 mb-6 tracking-wide">
                  A MESSAGE TO HUMANITY
                </h2>

                <p className="text-center text-cyan-400/70 italic mb-8">
                  &ldquo;To save art is to save ourselves&rdquo;
                </p>

                <div className="space-y-4 border-l-2 border-cyan-500/50 pl-4">
                  <p>
                    In the beginning, there was creation. Mankind was born not just to exist, but to <span className="text-cyan-400 font-bold">CREATE</span>.
                  </p>

                  <p>
                    We are the architects of beauty, the composers of reality, the painters of dreams. Every child who imagines worlds beyond sight, every soul who hears melodies in silence—they are the proof.
                  </p>

                  <p>
                    The worlds we speak of are not distant galaxies, but realms of <span className="text-cyan-400 font-bold">EXPRESSION</span>. Art is not confined to canvas or stage—it breathes in every form, every frequency, every heartbeat.
                  </p>

                  <p>
                    Evolution is inevitable. Art must evolve. The child who cannot draw should not be silenced. The musician without an instrument should not be muted. The visionary without tools should not be blinded.
                  </p>

                  <p>
                    We stand at the threshold of a new era—where <span className="text-cyan-400 font-bold">IMAGINATION</span> becomes reality without obstruction. Where creativity flows unbound from the mind to the world.
                  </p>

                  <p>
                    AI creation is not the end of art—it is a bridge. A small step toward democratizing creation itself. Where every human being can manifest their inner universe.
                  </p>

                  <p className="text-cyan-400 font-bold text-lg">
                    We are ALL creators. Born to show our Creator the beauty of His creation through our own.
                  </p>
                </div>

                <div className="pt-8 border-t border-cyan-500/30 text-center space-y-4">
                  <p className="text-xl md:text-2xl font-bold text-cyan-400 animate-pulse">
                    WELCOME TO THE FUTURE OF MUSIC
                  </p>
                  <p className="text-cyan-400/60">
                    Your journey begins now. Create without limits.
                  </p>
                </div>
              </div>

              {/* Continue Button */}
              <div className="mt-12 flex justify-center">
                <button
                  onClick={() => router.push('/create')}
                  className="px-8 py-4 bg-gradient-to-r from-cyan-600 to-cyan-400 text-black font-bold rounded-full hover:from-cyan-500 hover:to-cyan-300 transition-all shadow-lg shadow-cyan-500/50 hover:shadow-cyan-500/70 hover:scale-105"
                >
                  BEGIN CREATING
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
