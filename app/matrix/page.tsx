'use client'

import { useState, useEffect, useRef } from 'react'
import { useUser } from '@clerk/nextjs'
import { Terminal, Lock, Unlock, Zap } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function MatrixPage() {
  const { user } = useUser()
  const router = useRouter()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<string[]>([
    '> INITIALIZING SECURE SYSTEM...',
    '> CONNECTING TO 444RADIO MAINFRAME...',
    '> AWAITING AUTHENTICATION CODE...',
  ])
  const [isDecoding, setIsDecoding] = useState(false)
  const [isUnlocked, setIsUnlocked] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)

  // Matrix Rain Effect
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    const katakana = 'アァカサタナハマヤャラワガザダバパイィキシチニヒミリヰギジヂビピウゥクスツヌフムユュルグズブヅプエェケセテネヘメレヱゲゼデベペオォコソトノホモヨョロヲゴゾドボポヴッン0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    const latin = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    const nums = '0123456789'
    const alphabet = katakana + latin + nums

    const fontSize = 16
    const columns = canvas.width / fontSize

    const rainDrops: number[] = []
    for (let x = 0; x < columns; x++) {
      rainDrops[x] = 1
    }

    const draw = () => {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.05)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      ctx.fillStyle = '#0F0'
      ctx.font = fontSize + 'px monospace'

      for (let i = 0; i < rainDrops.length; i++) {
        const text = alphabet.charAt(Math.floor(Math.random() * alphabet.length))
        ctx.fillText(text, i * fontSize, rainDrops[i] * fontSize)

        if (rainDrops[i] * fontSize > canvas.height && Math.random() > 0.975) {
          rainDrops[i] = 0
        }
        rainDrops[i]++
      }
    }

    const interval = setInterval(draw, 30)

    const handleResize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }

    window.addEventListener('resize', handleResize)

    return () => {
      clearInterval(interval)
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  const addMessage = (msg: string) => {
    setMessages(prev => [...prev, msg])
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isDecoding || !user) return

    const code = input.trim()
    addMessage(`> PROCESSING CODE: ${code}`)
    setInput('')
    setIsDecoding(true)

    // Simulate decoding
    setTimeout(() => {
      addMessage('> SCANNING DATABASE...')
    }, 500)

    setTimeout(() => {
      addMessage('> VERIFYING ENCRYPTION...')
    }, 1000)

    setTimeout(async () => {
      if (code.toLowerCase() === 'porsche') {
        addMessage('> ✓ CODE VERIFIED')
        addMessage('> GRANTING ACCESS...')
        
        setTimeout(async () => {
          addMessage('> CREDITING ACCOUNT...')
          
          // Award credits via API
          try {
            const res = await fetch('/api/credits/award', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ code: 'PORSCHE' })
            })

            const data = await res.json()

            if (data.success) {
              addMessage(`> ✓ +100 CREDITS ADDED`)
              addMessage(`> NEW BALANCE: ${data.credits} CREDITS`)
              addMessage('> ACCESS GRANTED')
              setIsUnlocked(true)
              setShowSuccess(true)
              
              // Redirect after 3 seconds
              setTimeout(() => {
                router.push('/create')
              }, 3000)
            } else {
              addMessage(`> ✗ ERROR: ${data.error || 'ALREADY REDEEMED'}`)
              setIsDecoding(false)
            }
          } catch (error) {
            addMessage('> ✗ SYSTEM ERROR')
            setIsDecoding(false)
          }
        }, 1500)
      } else {
        addMessage('> ✗ INVALID CODE')
        addMessage('> ACCESS DENIED')
        setIsDecoding(false)
      }
    }, 1500)
  }

  return (
    <div className="relative min-h-screen bg-black text-green-500 overflow-hidden">
      {/* Matrix Rain Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 z-0"
      />

      {/* Terminal Interface */}
      <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-2xl">
          {/* Terminal Window */}
          <div className="bg-black/80 backdrop-blur-sm border-2 border-green-500 rounded-lg shadow-2xl shadow-green-500/50 overflow-hidden">
            {/* Terminal Header */}
            <div className="bg-green-500/10 border-b-2 border-green-500 px-4 py-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Terminal size={20} />
                <span className="font-mono text-sm">444RADIO_SECURE_TERMINAL</span>
              </div>
              <div className="flex items-center gap-2">
                {isUnlocked ? (
                  <Unlock size={20} className="text-green-400 animate-pulse" />
                ) : (
                  <Lock size={20} className="text-red-500" />
                )}
              </div>
            </div>

            {/* Terminal Body */}
            <div className="p-6 font-mono text-sm">
              {/* Message Log */}
              <div className="space-y-2 mb-6 max-h-96 overflow-y-auto scrollbar-thin scrollbar-thumb-green-500 scrollbar-track-black">
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`${
                      msg.includes('✓') 
                        ? 'text-green-400' 
                        : msg.includes('✗') 
                        ? 'text-red-500' 
                        : 'text-green-500'
                    } animate-fadeIn`}
                    style={{ animationDelay: `${i * 0.1}s` }}
                  >
                    {msg}
                  </div>
                ))}
                {isDecoding && (
                  <div className="flex items-center gap-2">
                    <span className="animate-pulse">▓</span>
                    <span className="animate-pulse" style={{ animationDelay: '0.2s' }}>▓</span>
                    <span className="animate-pulse" style={{ animationDelay: '0.4s' }}>▓</span>
                  </div>
                )}
              </div>

              {/* Success Message */}
              {showSuccess && (
                <div className="mb-6 p-4 bg-green-500/20 border border-green-500 rounded text-center animate-pulse">
                  <Zap className="inline-block mb-2" size={32} />
                  <div className="text-xl font-bold text-green-400">ACCESS GRANTED</div>
                  <div className="text-xs mt-2">Redirecting to creation studio...</div>
                </div>
              )}

              {/* Input Form */}
              {!isUnlocked && (
                <form onSubmit={handleSubmit} className="flex items-center gap-2">
                  <span className="text-green-400">&gt;</span>
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    disabled={isDecoding || !user}
                    placeholder={user ? "ENTER_AUTHENTICATION_CODE" : "PLEASE_SIGN_IN"}
                    className="flex-1 bg-transparent border-none outline-none text-green-500 placeholder-green-700 font-mono uppercase"
                    autoFocus
                  />
                  <span className="animate-pulse">▓</span>
                </form>
              )}

              {/* Hint */}
              {!user && (
                <div className="mt-6 text-center text-xs text-green-700">
                  AUTHENTICATION REQUIRED - PLEASE SIGN IN
                </div>
              )}

              {user && !isUnlocked && (
                <div className="mt-6 text-center text-xs text-green-700">
                  <div className="mb-2">HINT: WHAT&apos;S THE FASTEST CAR BRAND? 🏎️</div>
                  <div className="opacity-50 text-[10px]">
                    {/* Sometimes the answer is in plain sight */}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Credits Display */}
          {user && (
            <div className="mt-4 text-center font-mono text-xs text-green-600">
              <span className="opacity-60">SYSTEM_ID:</span> {user.id.substring(0, 12)}...
            </div>
          )}
        </div>
      </div>

      {/* Glitch Effect */}
      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateX(-10px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out forwards;
        }
        .scrollbar-thin::-webkit-scrollbar {
          width: 6px;
        }
        .scrollbar-thumb-green-500::-webkit-scrollbar-thumb {
          background-color: #22c55e;
        }
        .scrollbar-track-black::-webkit-scrollbar-track {
          background-color: #000;
        }
      `}</style>
    </div>
  )
}

