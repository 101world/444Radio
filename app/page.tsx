'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { SignedIn, SignedOut, UserButton, useUser } from '@clerk/nextjs'
import { Canvas, useFrame } from '@react-three/fiber'
import { Sphere, MeshDistortMaterial } from '@react-three/drei'
import * as THREE from 'three'

const genres = ['Pop', 'Rock', 'Hip-Hop', 'Electronic', 'Jazz', 'Classical', 'Country', 'Reggae', 'Ambient', 'Lo-Fi', 'Trap', 'R&B']

function AnimatedSphere() {
  const meshRef = useRef<THREE.Mesh>(null)
  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.x = Math.sin(state.clock.elapsedTime) * 0.3
      meshRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.2
    }
  })
  return (
    <Sphere ref={meshRef} args={[1, 64, 64]}>
      <MeshDistortMaterial color="#00ff9d" distort={0.5} speed={2.5} roughness={0.1} metalness={0.9} />
    </Sphere>
  )
}

function FloatingParticles() {
  const particlesRef = useRef<THREE.Points>(null)
  useFrame((state) => {
    if (particlesRef.current) particlesRef.current.rotation.y = state.clock.elapsedTime * 0.05
  })
  const particleCount = 100
  const positions = new Float32Array(particleCount * 3)
  for (let i = 0; i < particleCount; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 10
    positions[i * 3 + 1] = (Math.random() - 0.5) * 10
    positions[i * 3 + 2] = (Math.random() - 0.5) * 10
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  return (
    <points ref={particlesRef} geometry={geometry}>
      <pointsMaterial size={0.03} color="#00ffff" transparent opacity={0.6} />
    </points>
  )
}

export default function HomePage() {
  const { user } = useUser()
  const [prompt, setPrompt] = useState('')
  const [isDocked, setIsDocked] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [loading, setLoading] = useState(false)
  const [selectedGenre, setSelectedGenre] = useState('')
  const [bpm, setBpm] = useState('')
  const [instrumental, setInstrumental] = useState(false)
  const [coverPrompt, setCoverPrompt] = useState('')
  const [credits, setCredits] = useState(20)

  useEffect(() => {
    if (prompt.length > 0 && !isDocked) setIsDocked(true)
  }, [prompt, isDocked])

  // Fetch user credits
  useEffect(() => {
    if (user) {
      fetch('/api/credits')
        .then(res => res.json())
        .then(data => {
          if (data.credits !== undefined) setCredits(data.credits)
        })
        .catch(console.error)
    }
  }, [user])

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (credits < 1) {
      alert('⚡ You need at least 1 credit to generate music!')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, genre: selectedGenre, bpm, instrumental, coverPrompt, userId: user?.id }),
      })
      const data = await res.json()
      
      if (data.success) {
        setCredits(credits - 1) // Update credits locally
        alert('🎵 Music generated! Check your profile.')
        setPrompt('')
        setIsDocked(false)
      } else if (data.error === 'Insufficient credits') {
        alert('⚡ Not enough credits! You need at least 1 credit.')
      } else {
        alert('❌ Error: ' + (data.message || data.error))
      }
    } catch (error) {
      console.error(error)
      alert('❌ Failed to generate music. Please try again.')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-slate-950 to-green-950 text-white overflow-hidden relative">
      <div className="absolute inset-0 z-0 opacity-40">
        <Canvas camera={{ position: [0, 0, 5], fov: 75 }}>
          <ambientLight intensity={0.3} />
          <pointLight position={[10, 10, 10]} color="#00ff9d" intensity={0.8} />
          <AnimatedSphere />
          <FloatingParticles />
        </Canvas>
      </div>

      <nav className="relative z-50 flex justify-between items-center p-4 md:p-6 backdrop-blur-xl bg-black/20 border-b border-green-500/20">
        <Link href="/" className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-cyan-400 rounded-xl flex items-center justify-center shadow-lg shadow-green-500/50">
            <span className="text-black font-bold text-lg"></span>
          </div>
          <span className="text-2xl font-bold bg-gradient-to-r from-green-400 to-cyan-400 bg-clip-text text-transparent">444RADIO</span>
        </Link>
        <div className="flex items-center gap-4">
          <SignedIn>
            <Link href="/explore" className="hidden md:block px-4 py-2 text-green-400 hover:text-green-300 font-medium">Explore</Link>
            <Link href="/billboard" className="hidden md:block px-4 py-2 text-green-400 hover:text-green-300 font-medium">Charts</Link>
            <Link href={`/profile/${user?.id}`} className="hidden md:block px-4 py-2 text-green-400 hover:text-green-300 font-medium">Profile</Link>
            {/* Credits Display */}
            <div className="hidden md:flex items-center gap-2 px-4 py-2 backdrop-blur-lg bg-green-500/10 border border-green-500/30 rounded-full">
              <span className="text-2xl">⚡</span>
              <span className="text-green-400 font-bold">{credits}</span>
              <span className="text-green-400/60 text-xs">credits</span>
            </div>
            <UserButton afterSignOutUrl="/" />
          </SignedIn>
          <SignedOut>
            <Link href="/sign-in" className="px-6 py-2 text-green-400 hover:text-green-300 font-medium">Sign In</Link>
            <Link href="/sign-up" className="px-6 py-2 bg-gradient-to-r from-green-500 to-cyan-500 text-black rounded-full font-bold hover:scale-105 transition-transform">Join Free</Link>
          </SignedOut>
        </div>
      </nav>

      <main className="relative z-10">
        <SignedOut>
          <div className="min-h-[calc(100vh-80px)] flex flex-col items-center justify-center px-6 text-center">
            <div className="mb-8">
              <div className="inline-block px-4 py-2 backdrop-blur-lg bg-green-500/10 border border-green-500/30 rounded-full mb-6">
                <span className="text-green-400 font-semibold text-sm"> AI-POWERED MUSIC SOCIAL NETWORK</span>
              </div>
              <h1 className="text-6xl md:text-8xl font-black mb-6 bg-gradient-to-r from-green-400 via-cyan-400 to-green-300 bg-clip-text text-transparent leading-tight">
                Everyone is an Artist
              </h1>
              <p className="text-xl md:text-2xl text-green-100/80 mb-12 max-w-3xl mx-auto font-light">
                Generate music with AI. Share cover art. Build your sound. <br/>
                <span className="text-green-400 font-semibold">Instagram for AI Music</span>
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 mb-12">
              <Link href="/sign-up" className="px-10 py-4 bg-gradient-to-r from-green-500 to-cyan-500 text-black rounded-full font-bold text-lg hover:scale-105 transition-transform shadow-xl shadow-green-500/50">
                 Start Creating Free
              </Link>
              <Link href="/explore" className="px-10 py-4 backdrop-blur-lg bg-green-500/10 border-2 border-green-500/30 text-green-400 rounded-full font-bold text-lg hover:bg-green-500/20 transition-all">
                 Explore Music
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mt-16">
              <div className="backdrop-blur-xl bg-black/40 border border-green-500/20 rounded-2xl p-6 hover:border-green-500/40 transition-all">
                <div className="text-4xl mb-3"></div>
                <h3 className="text-xl font-bold text-green-400 mb-2">AI Music Generation</h3>
                <p className="text-green-100/60">Create unique tracks with Replicate AI models</p>
              </div>
              <div className="backdrop-blur-xl bg-black/40 border border-cyan-500/20 rounded-2xl p-6 hover:border-cyan-500/40 transition-all">
                <div className="text-4xl mb-3"></div>
                <h3 className="text-xl font-bold text-cyan-400 mb-2">Cover Art & Video</h3>
                <p className="text-green-100/60">Generate stunning visuals for your music</p>
              </div>
              <div className="backdrop-blur-xl bg-black/40 border border-green-500/20 rounded-2xl p-6 hover:border-green-500/40 transition-all">
                <div className="text-4xl mb-3"></div>
                <h3 className="text-xl font-bold text-green-400 mb-2">Social Music Feed</h3>
                <p className="text-green-100/60">Share, discover, and connect with artists</p>
              </div>
            </div>
          </div>
        </SignedOut>

        <SignedIn>
          <div className={`transition-all duration-500 ease-out ${isDocked ? 'fixed bottom-0 left-0 right-0 p-4 pb-6' : 'min-h-[calc(100vh-80px)] flex items-center justify-center px-6'}`}>
            <form onSubmit={handleGenerate} className={`w-full transition-all duration-500 ${isDocked ? 'max-w-4xl mx-auto' : 'max-w-2xl'}`}>
              <div className={`backdrop-blur-2xl bg-gradient-to-br from-black/80 via-slate-900/70 to-green-950/80 border-2 border-green-500/30 rounded-3xl shadow-2xl shadow-green-500/20 ${isDocked ? 'p-4' : 'p-8'}`}>
                {!isDocked && (
                  <div className="text-center mb-8">
                    <h1 className="text-4xl md:text-6xl font-black mb-4 bg-gradient-to-r from-green-400 to-cyan-400 bg-clip-text text-transparent">
                      What do you want to create?
                    </h1>
                    <p className="text-green-100/60 text-lg">Describe your music and we will generate it with AI</p>
                  </div>
                )}
                <div className="relative">
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Describe your music... (e.g., upbeat electronic dance track with heavy bass)"
                    className={`w-full bg-black/60 border-2 border-green-500/30 rounded-2xl focus:border-green-400 focus:outline-none focus:ring-2 focus:ring-green-400/20 transition-all placeholder-green-500/40 text-green-100 font-medium resize-none ${isDocked ? 'p-4 text-base' : 'p-6 text-lg'}`}
                    rows={isDocked ? 2 : 4}
                  />
                  <div className="flex items-center justify-between mt-4">
                    <button type="button" onClick={() => setShowAdvanced(!showAdvanced)} className="text-sm text-green-400 hover:text-green-300 font-medium flex items-center gap-2">
                      <span> Advanced</span>
                      <span className={`transition-transform ${showAdvanced ? 'rotate-180' : ''}`}></span>
                    </button>
                    <button 
                      type="submit" 
                      disabled={loading || !prompt.trim() || credits < 1} 
                      className="px-8 py-3 bg-gradient-to-r from-green-500 to-cyan-500 text-black rounded-full font-bold hover:scale-105 transition-transform disabled:opacity-50 shadow-lg shadow-green-500/50"
                      title={credits < 1 ? 'Not enough credits' : 'Generate music (costs 1 credit)'}
                    >
                      {loading ? '⚡ Generating...' : credits < 1 ? '❌ No Credits' : '🎵 Generate (1 ⚡)'}
                    </button>
                  </div>
                </div>
                {showAdvanced && (
                  <div className="mt-6 pt-6 border-t border-green-500/20 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-green-400 mb-2">Genre</label>
                      <select value={selectedGenre} onChange={(e) => setSelectedGenre(e.target.value)} className="w-full p-3 bg-black/60 border border-green-500/30 rounded-xl text-green-100 focus:border-green-400 focus:outline-none">
                        <option value="">Auto-detect</option>
                        {genres.map(g => <option key={g} value={g}>{g}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-green-400 mb-2">BPM</label>
                      <input type="number" value={bpm} onChange={(e) => setBpm(e.target.value)} placeholder="120" className="w-full p-3 bg-black/60 border border-green-500/30 rounded-xl text-green-100 focus:border-green-400 focus:outline-none" />
                    </div>
                    <div>
                      <label className="block text-sm text-green-400 mb-2">Cover Art Prompt</label>
                      <input type="text" value={coverPrompt} onChange={(e) => setCoverPrompt(e.target.value)} placeholder="Describe your album cover..." className="w-full p-3 bg-black/60 border border-green-500/30 rounded-xl text-green-100 focus:border-green-400 focus:outline-none" />
                    </div>
                    <div className="flex items-center gap-4">
                      <label className="text-sm text-green-400">Instrumental</label>
                      <button type="button" onClick={() => setInstrumental(!instrumental)} className={`relative w-14 h-7 rounded-full transition-all ${instrumental ? 'bg-gradient-to-r from-green-500 to-cyan-500' : 'bg-gray-700/50'}`}>
                        <div className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full transition-transform ${instrumental ? 'translate-x-7' : ''}`}></div>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </form>
          </div>
        </SignedIn>
      </main>
    </div>
  )
}
