'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { SignedIn, SignedOut, UserButton, useUser } from '@clerk/nextjs'
import { Canvas, useFrame } from '@react-three/fiber'
import { Sphere, MeshDistortMaterial } from '@react-three/drei'
import * as THREE from 'three'
import { Music, Image as ImageIcon, Video } from 'lucide-react'

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
  const [credits, setCredits] = useState(20)
  
  // Modal states
  const [showMusicModal, setShowMusicModal] = useState(false)
  const [showCoverArtModal, setShowCoverArtModal] = useState(false)
  const [showCoverVideoModal, setShowCoverVideoModal] = useState(false)

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

      {/* Navigation */}
      <nav className="relative z-50 flex justify-between items-center p-4 md:p-6 backdrop-blur-xl bg-black/20 border-b border-green-500/20">
        <Link href="/" className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-cyan-400 rounded-xl flex items-center justify-center shadow-lg shadow-green-500/50">
            <span className="text-black font-bold text-lg">🎵</span>
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
          {/* Landing Page */}
          <div className="min-h-[calc(100vh-80px)] flex flex-col items-center justify-center px-6 text-center">
            <div className="mb-8">
              <div className="inline-block px-4 py-2 backdrop-blur-lg bg-green-500/10 border border-green-500/30 rounded-full mb-6">
                <span className="text-green-400 font-semibold text-sm">✨ AI-POWERED MUSIC SOCIAL NETWORK</span>
              </div>
              <h1 className="text-6xl md:text-8xl font-black mb-6 bg-gradient-to-r from-green-400 via-cyan-400 to-green-300 bg-clip-text text-transparent leading-tight">
                Everyone is an Artist
              </h1>
              <p className="text-xl md:text-2xl text-green-100/80 mb-12 max-w-3xl mx-auto font-light">
                Generate music with AI. Create stunning visuals. Build your sound. <br/>
                <span className="text-green-400 font-semibold">Instagram for AI Music</span>
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 mb-12">
              <Link href="/sign-up" className="px-10 py-4 bg-gradient-to-r from-green-500 to-cyan-500 text-black rounded-full font-bold text-lg hover:scale-105 transition-transform shadow-xl shadow-green-500/50">
                🚀 Start Creating Free
              </Link>
              <Link href="/explore" className="px-10 py-4 backdrop-blur-lg bg-green-500/10 border-2 border-green-500/30 text-green-400 rounded-full font-bold text-lg hover:bg-green-500/20 transition-all">
                🎧 Explore Music
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mt-16">
              <div className="backdrop-blur-xl bg-black/40 border border-green-500/20 rounded-2xl p-6 hover:border-green-500/40 transition-all">
                <div className="text-4xl mb-3">🎵</div>
                <h3 className="text-xl font-bold text-green-400 mb-2">AI Music Generation</h3>
                <p className="text-green-100/60">Create unique tracks with MiniMax Music-1.5</p>
              </div>
              <div className="backdrop-blur-xl bg-black/40 border border-cyan-500/20 rounded-2xl p-6 hover:border-cyan-500/40 transition-all">
                <div className="text-4xl mb-3">🎨</div>
                <h3 className="text-xl font-bold text-cyan-400 mb-2">Cover Art & Video</h3>
                <p className="text-green-100/60">Generate stunning visuals with Flux & Seedance</p>
              </div>
              <div className="backdrop-blur-xl bg-black/40 border border-green-500/20 rounded-2xl p-6 hover:border-green-500/40 transition-all">
                <div className="text-4xl mb-3">🌍</div>
                <h3 className="text-xl font-bold text-green-400 mb-2">Social Music Feed</h3>
                <p className="text-green-100/60">Share, discover, and connect with artists</p>
              </div>
            </div>
          </div>
        </SignedOut>

        <SignedIn>
          {/* Creation Hub */}
          <div className="min-h-[calc(100vh-80px)] flex flex-col items-center justify-center px-6">
            <div className="max-w-6xl w-full">
              {/* Header */}
              <div className="text-center mb-12">
                <h1 className="text-5xl md:text-7xl font-black mb-4 bg-gradient-to-r from-green-400 to-cyan-400 bg-clip-text text-transparent">
                  What do you want to create?
                </h1>
                <p className="text-xl text-green-100/60">
                  Choose a creation type and customize your AI generation
                </p>
              </div>

              {/* 3 Generation Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                
                {/* MUSIC GENERATION CARD */}
                <button
                  onClick={() => setShowMusicModal(true)}
                  className="group relative backdrop-blur-xl bg-gradient-to-br from-green-500/10 to-green-600/5 border-2 border-green-500/30 rounded-3xl p-8 hover:border-green-500/60 hover:shadow-2xl hover:shadow-green-500/20 hover:scale-105 transition-all duration-300"
                >
                  <div className="flex flex-col items-center text-center">
                    <div className="mb-6 p-6 bg-green-500/20 rounded-full group-hover:bg-green-500/30 transition-colors">
                      <Music size={64} className="text-green-400" />
                    </div>
                    <h2 className="text-3xl font-bold text-green-400 mb-3">Music</h2>
                    <p className="text-green-100/70 mb-4">
                      Generate unique music tracks with AI
                    </p>
                    <div className="text-sm text-green-400/60">
                      MiniMax Music-1.5
                    </div>
                    <div className="mt-6 flex items-center gap-2 px-4 py-2 bg-green-500/20 rounded-full">
                      <span className="text-xl">⚡</span>
                      <span className="text-green-400 font-bold">1 credit</span>
                    </div>
                  </div>
                  <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-green-500/0 to-green-500/0 group-hover:from-green-500/5 group-hover:to-cyan-500/5 transition-all duration-300"></div>
                </button>

                {/* COVER ART GENERATION CARD */}
                <button
                  onClick={() => setShowCoverArtModal(true)}
                  className="group relative backdrop-blur-xl bg-gradient-to-br from-cyan-500/10 to-cyan-600/5 border-2 border-cyan-500/30 rounded-3xl p-8 hover:border-cyan-500/60 hover:shadow-2xl hover:shadow-cyan-500/20 hover:scale-105 transition-all duration-300"
                >
                  <div className="flex flex-col items-center text-center">
                    <div className="mb-6 p-6 bg-cyan-500/20 rounded-full group-hover:bg-cyan-500/30 transition-colors">
                      <ImageIcon size={64} className="text-cyan-400" />
                    </div>
                    <h2 className="text-3xl font-bold text-cyan-400 mb-3">Cover Art</h2>
                    <p className="text-green-100/70 mb-4">
                      Create stunning album cover artwork
                    </p>
                    <div className="text-sm text-cyan-400/60">
                      Flux Schnell
                    </div>
                    <div className="mt-6 flex items-center gap-2 px-4 py-2 bg-cyan-500/20 rounded-full">
                      <span className="text-xl">⚡</span>
                      <span className="text-cyan-400 font-bold">1 credit</span>
                    </div>
                  </div>
                  <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-cyan-500/0 to-cyan-500/0 group-hover:from-cyan-500/5 group-hover:to-green-500/5 transition-all duration-300"></div>
                </button>

                {/* COVER VIDEO GENERATION CARD */}
                <button
                  onClick={() => setShowCoverVideoModal(true)}
                  className="group relative backdrop-blur-xl bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-2 border-purple-500/30 rounded-3xl p-8 hover:border-purple-500/60 hover:shadow-2xl hover:shadow-purple-500/20 hover:scale-105 transition-all duration-300"
                >
                  <div className="flex flex-col items-center text-center">
                    <div className="mb-6 p-6 bg-purple-500/20 rounded-full group-hover:bg-purple-500/30 transition-colors">
                      <Video size={64} className="text-purple-400" />
                    </div>
                    <h2 className="text-3xl font-bold text-purple-400 mb-3">Cover Video</h2>
                    <p className="text-green-100/70 mb-4">
                      Generate animated music video visuals
                    </p>
                    <div className="text-sm text-purple-400/60">
                      Seedance-1-lite
                    </div>
                    <div className="mt-6 flex items-center gap-2 px-4 py-2 bg-purple-500/20 rounded-full">
                      <span className="text-xl">⚡</span>
                      <span className="text-purple-400 font-bold">1 credit</span>
                    </div>
                  </div>
                  <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-purple-500/0 to-purple-500/0 group-hover:from-purple-500/5 group-hover:to-cyan-500/5 transition-all duration-300"></div>
                </button>

              </div>

              {/* Info Text */}
              <div className="text-center mt-12">
                <p className="text-green-100/50 text-sm">
                  Each generation uses 1 credit • You have <span className="text-green-400 font-bold">{credits} credits</span> remaining
                </p>
              </div>
            </div>
          </div>
        </SignedIn>
      </main>

      {/* TODO: Add modals here */}
      {showMusicModal && <div>Music Modal Coming Soon</div>}
      {showCoverArtModal && <div>Cover Art Modal Coming Soon</div>}
      {showCoverVideoModal && <div>Cover Video Modal Coming Soon</div>}
    </div>
  )
}

