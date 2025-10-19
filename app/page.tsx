'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import { SignedIn, SignedOut } from '@clerk/nextjs'
import { Canvas, useFrame } from '@react-three/fiber'
import { Sphere, MeshDistortMaterial, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'

const genres = ['Pop', 'Rock', 'Hip-Hop', 'Electronic', 'Jazz', 'Classical', 'Country', 'Reggae', 'Ambient', 'Lo-Fi', 'Trap', 'R&B']

// 3D Animated Sphere Component - Matrix Theme
function AnimatedSphere() {
  const meshRef = useRef<THREE.Mesh>(null)

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.x = Math.sin(state.clock.elapsedTime) * 0.3
      meshRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.2
      meshRef.current.position.y = Math.sin(state.clock.elapsedTime) * 0.1
    }
  })

  return (
    <Sphere ref={meshRef} args={[1, 64, 64]}>
      <MeshDistortMaterial
        color="#00ff9d"
        attach="material"
        distort={0.5}
        speed={2.5}
        roughness={0.1}
        metalness={0.9}
      />
    </Sphere>
  )
}

// Floating Particles Component - Matrix Theme
function FloatingParticles() {
  const particlesRef = useRef<THREE.Points>(null)

  useFrame((state) => {
    if (particlesRef.current) {
      particlesRef.current.rotation.y = state.clock.elapsedTime * 0.05
    }
  })

  const particleCount = 150
  const positions = new Float32Array(particleCount * 3)

  for (let i = 0; i < particleCount; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 25
    positions[i * 3 + 1] = (Math.random() - 0.5) * 25
    positions[i * 3 + 2] = (Math.random() - 0.5) * 25
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))

  return (
    <points ref={particlesRef} geometry={geometry}>
      <pointsMaterial size={0.03} color="#00ff9d" transparent opacity={0.7} />
    </points>
  )
}

export default function Home() {
  const [title, setTitle] = useState('')
  const [prompt, setPrompt] = useState('')
  const [lyrics, setLyrics] = useState('')
  const [bpm, setBpm] = useState('')
  const [selectedGenre, setSelectedGenre] = useState('')
  const [instrumental, setInstrumental] = useState(false)
  const [coverPrompt, setCoverPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, prompt, lyrics, bpm, genre: selectedGenre, instrumental, coverPrompt }),
      })
      const data = await res.json()
      if (data.success) {
        alert('Music generated!')
      } else {
        alert('Error: ' + data.error)
      }
    } catch {
      alert('Error generating music')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-slate-950 to-green-950 text-white overflow-hidden relative">
      {/* Matrix Digital Rain Background Effect */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,255,157,0.03)_0%,transparent_65%)] z-0"></div>
      
      {/* 3D Background */}
      <div className="absolute inset-0 z-0 opacity-60">
        <Canvas camera={{ position: [0, 0, 5], fov: 75 }}>
          <ambientLight intensity={0.3} />
          <pointLight position={[10, 10, 10]} color="#00ff9d" intensity={0.8} />
          <pointLight position={[-10, -10, -10]} color="#00ffff" intensity={0.5} />
          <AnimatedSphere />
          <FloatingParticles />
          <OrbitControls enableZoom={false} enablePan={false} autoRotate autoRotateSpeed={0.3} />
        </Canvas>
      </div>
      
      {/* Grid Overlay */}
      <div className="absolute inset-0 z-0 opacity-10" style={{
        backgroundImage: 'linear-gradient(rgba(0,255,157,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,157,0.3) 1px, transparent 1px)',
        backgroundSize: '50px 50px'
      }}></div>

      {/* Top Navigation - Glass Morphism */}
      <nav className="relative z-50 flex justify-between items-center p-6 backdrop-blur-xl bg-gradient-to-r from-black/40 via-slate-900/30 to-black/40 border-b border-green-500/20 shadow-lg shadow-green-500/5">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-green-400 via-cyan-400 to-green-600 rounded-xl flex items-center justify-center shadow-lg shadow-green-500/50 animate-pulse">
            <span className="text-black font-bold text-lg">♪</span>
          </div>
          <span className="text-2xl font-bold bg-gradient-to-r from-green-400 via-cyan-400 to-green-300 bg-clip-text text-transparent drop-shadow-[0_0_15px_rgba(0,255,157,0.5)]">
            444RADIO
          </span>
          <span className="text-xs px-2 py-1 bg-green-500/20 border border-green-500/40 rounded-full text-green-400 font-semibold">AI</span>
        </div>

        {/* Hamburger Menu - Glass Morphism */}
        <button
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className="p-3 rounded-xl backdrop-blur-lg bg-green-500/10 border border-green-500/30 hover:bg-green-500/20 hover:border-green-400/50 transition-all duration-300 shadow-lg shadow-green-500/20 hover:shadow-green-400/30"
        >
          <div className="w-6 h-6 flex flex-col justify-center items-center space-y-1.5">
            <span className={`w-5 h-0.5 bg-gradient-to-r from-green-400 to-cyan-400 transition-all duration-300 ${isMenuOpen ? 'rotate-45 translate-y-2' : ''}`}></span>
            <span className={`w-5 h-0.5 bg-gradient-to-r from-green-400 to-cyan-400 transition-all duration-300 ${isMenuOpen ? 'opacity-0' : ''}`}></span>
            <span className={`w-5 h-0.5 bg-gradient-to-r from-green-400 to-cyan-400 transition-all duration-300 ${isMenuOpen ? '-rotate-45 -translate-y-2' : ''}`}></span>
          </div>
        </button>

        {/* Mobile Menu Overlay - Glass Morphism */}
        {isMenuOpen && (
          <div className="absolute top-full right-0 mt-3 w-56 backdrop-blur-2xl bg-gradient-to-br from-black/90 via-slate-900/80 to-green-950/90 border border-green-500/30 rounded-2xl shadow-2xl shadow-green-500/20 overflow-hidden">
            <div className="p-5 space-y-1">
              <Link href="/" className="block py-3 px-4 rounded-xl hover:bg-green-500/20 transition-all duration-300 font-medium text-green-100 hover:text-green-400 hover:pl-6 border border-transparent hover:border-green-500/30">Home</Link>
              <Link href="/music" className="block py-3 px-4 rounded-xl hover:bg-green-500/20 transition-all duration-300 font-medium text-green-100 hover:text-green-400 hover:pl-6 border border-transparent hover:border-green-500/30">Music</Link>
              <Link href="/visuals" className="block py-3 px-4 rounded-xl hover:bg-green-500/20 transition-all duration-300 font-medium text-green-100 hover:text-green-400 hover:pl-6 border border-transparent hover:border-green-500/30">Visuals</Link>
              <Link href="/community" className="block py-3 px-4 rounded-xl hover:bg-green-500/20 transition-all duration-300 font-medium text-green-100 hover:text-green-400 hover:pl-6 border border-transparent hover:border-green-500/30">Community</Link>
              <Link href="/pricing" className="block py-3 px-4 rounded-xl hover:bg-green-500/20 transition-all duration-300 font-medium text-green-100 hover:text-green-400 hover:pl-6 border border-transparent hover:border-green-500/30">Pricing</Link>
            </div>
          </div>
        )}
      </nav>

      {/* Main Content */}
      <main className="relative z-10 flex flex-col justify-end min-h-[calc(100vh-100px)] p-6 md:p-10">
        <div className="max-w-4xl mx-auto w-full">
          {/* Hero Section */}
          <div className="text-center mb-10 space-y-4">
            <div className="inline-block px-4 py-2 mb-4 backdrop-blur-lg bg-green-500/10 border border-green-500/30 rounded-full">
              <span className="text-green-400 font-semibold text-sm tracking-wider">⚡ POWERED BY AI</span>
            </div>
            <h1 className="text-6xl md:text-8xl font-black mb-6 bg-gradient-to-r from-green-400 via-cyan-400 to-green-300 bg-clip-text text-transparent drop-shadow-[0_0_30px_rgba(0,255,157,0.3)] leading-tight">
              Generate Music
            </h1>
            <p className="text-xl md:text-2xl text-green-100/80 mb-8 max-w-2xl mx-auto font-light">
              Create <span className="text-green-400 font-semibold">unique AI-powered</span> music with advanced neural synthesis
            </p>
            <div className="flex items-center justify-center gap-3 text-sm text-green-400/60">
              <span className="flex items-center gap-1"><span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span> Real-time Generation</span>
              <span>•</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse"></span> HD Quality</span>
              <span>•</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span> Custom Lyrics</span>
            </div>
          </div>

          <SignedOut>
            <div className="backdrop-blur-2xl bg-gradient-to-br from-black/60 via-slate-900/50 to-green-950/60 border-2 border-green-500/30 rounded-3xl p-12 shadow-2xl shadow-green-500/20 text-center relative overflow-hidden">
              {/* Glow Effect */}
              <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 via-transparent to-cyan-500/10 blur-xl"></div>
              
              <div className="relative z-10">
                <h2 className="text-4xl font-bold mb-4 bg-gradient-to-r from-green-400 to-cyan-400 bg-clip-text text-transparent">Join the AI Revolution</h2>
                <p className="text-green-100/70 mb-8 text-lg">Sign in to start creating <span className="text-green-400 font-semibold">epic music</span> with neural synthesis</p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Link href="/sign-up" className="bg-gradient-to-r from-green-500 via-cyan-500 to-green-400 text-black px-10 py-4 rounded-full font-bold text-lg hover:scale-105 hover:shadow-2xl hover:shadow-green-500/50 transition-all duration-300 shadow-lg shadow-green-500/30 text-center">
                    🚀 Get Started Free
                  </Link>
                  <Link href="/sign-in" className="backdrop-blur-lg bg-green-500/10 border-2 border-green-500/30 text-green-400 px-10 py-4 rounded-full font-bold text-lg hover:scale-105 hover:bg-green-500/20 hover:border-green-400/50 transition-all duration-300 shadow-lg shadow-green-500/20 text-center">
                    🎵 Sign In
                  </Link>
                </div>
              </div>
            </div>
          </SignedOut>

          <SignedIn>
            {/* Music Generation Form - Glass Morphism */}
            <form onSubmit={handleSubmit} className="space-y-6 backdrop-blur-2xl bg-gradient-to-br from-black/70 via-slate-900/60 to-green-950/70 border-2 border-green-500/30 rounded-3xl p-10 shadow-2xl shadow-green-500/20 relative overflow-hidden">
              {/* Animated Border Glow */}
              <div className="absolute inset-0 bg-gradient-to-r from-green-500/5 via-cyan-500/5 to-green-500/5 animate-pulse"></div>
              
              <div className="relative z-10 space-y-6">
                {/* Song Title */}
                <div className="group">
                  <label className="block text-sm font-semibold mb-3 text-green-400 tracking-wide flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></span>
                    Song Title
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full p-5 bg-black/60 border-2 border-green-500/30 rounded-2xl focus:border-green-400 focus:outline-none focus:ring-2 focus:ring-green-400/20 transition-all duration-300 placeholder-green-500/40 text-green-100 font-medium backdrop-blur-sm hover:border-green-500/50 shadow-lg shadow-green-500/10"
                    placeholder="Enter your epic track title..."
                  />
                </div>

                {/* Prompt */}
                <div className="group">
                  <label className="block text-sm font-semibold mb-3 text-green-400 tracking-wide flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse"></span>
                    AI Prompt
                  </label>
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    className="w-full p-5 bg-black/60 border-2 border-cyan-500/30 rounded-2xl focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/20 transition-all duration-300 placeholder-cyan-500/40 text-green-100 font-medium resize-none backdrop-blur-sm hover:border-cyan-500/50 shadow-lg shadow-cyan-500/10"
                    placeholder="Describe your musical vision... (e.g., upbeat electronic with heavy bass)"
                    rows={3}
                  />
                </div>

                {/* Lyrics */}
                <div className="group">
                  <label className="block text-sm font-semibold mb-3 text-green-400 tracking-wide flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></span>
                    Lyrics <span className="text-xs text-green-500/60 font-normal">(Optional)</span>
                  </label>
                  <textarea
                    value={lyrics}
                    onChange={(e) => setLyrics(e.target.value)}
                    className="w-full p-5 bg-black/60 border-2 border-green-500/30 rounded-2xl focus:border-green-400 focus:outline-none focus:ring-2 focus:ring-green-400/20 transition-all duration-300 placeholder-green-500/40 text-green-100 font-medium resize-none backdrop-blur-sm hover:border-green-500/50 shadow-lg shadow-green-500/10"
                    placeholder="Add your custom lyrics for vocal generation..."
                    rows={4}
                  />
                </div>

                {/* BPM and Genre Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="group">
                    <label className="block text-sm font-semibold mb-3 text-green-400 tracking-wide flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse"></span>
                      BPM
                    </label>
                    <input
                      type="number"
                      value={bpm}
                      onChange={(e) => setBpm(e.target.value)}
                      className="w-full p-5 bg-black/60 border-2 border-cyan-500/30 rounded-2xl focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/20 transition-all duration-300 placeholder-cyan-500/40 text-green-100 font-medium backdrop-blur-sm hover:border-cyan-500/50 shadow-lg shadow-cyan-500/10"
                      placeholder="120"
                    />
                  </div>

                  <div className="group">
                    <label className="block text-sm font-semibold mb-3 text-green-400 tracking-wide flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></span>
                      Genre
                    </label>
                    <div className="grid grid-cols-2 gap-2 max-h-[200px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-green-500/50 scrollbar-track-black/20">
                      {genres.map((g) => (
                        <button
                          key={g}
                          type="button"
                          onClick={() => setSelectedGenre(g)}
                          className={`p-3 rounded-xl border-2 transition-all duration-300 text-sm font-semibold backdrop-blur-sm shadow-lg ${
                            selectedGenre === g
                              ? 'bg-gradient-to-r from-green-500 to-cyan-500 border-green-400 text-black shadow-green-500/50'
                              : 'bg-black/40 border-green-500/30 text-green-100 hover:border-green-400 hover:bg-green-500/20 hover:shadow-green-500/30'
                          }`}
                        >
                          {g}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Instrumental Toggle */}
                <div className="flex items-center justify-center space-x-6 p-6 bg-black/40 rounded-2xl border-2 border-green-500/20 backdrop-blur-sm shadow-lg shadow-green-500/10">
                  <span className="text-sm font-semibold text-green-400">🎸 Instrumental</span>
                  <button
                    type="button"
                    onClick={() => setInstrumental(!instrumental)}
                    className={`relative w-16 h-8 rounded-full transition-all duration-300 shadow-lg ${
                      instrumental ? 'bg-gradient-to-r from-green-500 to-cyan-500 shadow-green-500/50' : 'bg-gray-700/50 shadow-gray-700/30'
                    }`}
                  >
                    <div className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-all duration-300 shadow-lg ${
                      instrumental ? 'translate-x-8' : 'translate-x-0'
                    }`}></div>
                  </button>
                  <span className="text-sm font-semibold text-cyan-400">🎤 Vocal</span>
                </div>

                {/* Cover Art Prompt */}
                <div className="group">
                  <label className="block text-sm font-semibold mb-3 text-green-400 tracking-wide flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse"></span>
                    Cover Art Prompt
                  </label>
                  <input
                    type="text"
                    value={coverPrompt}
                    onChange={(e) => setCoverPrompt(e.target.value)}
                    className="w-full p-5 bg-black/60 border-2 border-cyan-500/30 rounded-2xl focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/20 transition-all duration-300 placeholder-cyan-500/40 text-green-100 font-medium backdrop-blur-sm hover:border-cyan-500/50 shadow-lg shadow-cyan-500/10"
                    placeholder="Describe your epic album cover art..."
                  />
                </div>

                {/* Generate Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-green-500 via-cyan-500 to-green-400 text-black py-6 rounded-2xl font-bold text-xl hover:scale-[1.02] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-2xl shadow-green-500/50 hover:shadow-green-400/60 border-2 border-green-400/50 relative overflow-hidden group"
                >
                  {/* Button Glow Effect */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000"></div>
                  
                  <span className="relative z-10">
                    {loading ? (
                      <div className="flex items-center justify-center space-x-3">
                        <div className="w-6 h-6 border-3 border-black border-t-transparent rounded-full animate-spin"></div>
                        <span className="font-bold">⚡ Generating Your Track...</span>
                      </div>
                    ) : (
                      <span className="flex items-center justify-center gap-2">
                        🎵 Generate Music
                        <span className="text-sm opacity-75">→</span>
                      </span>
                    )}
                  </span>
                </button>
              </div>
            </form>
          </SignedIn>
        </div>
      </main>
    </div>
  )
}
