'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { SignedIn, SignedOut, UserButton, useUser } from '@clerk/nextjs'
import { Canvas, useFrame } from '@react-three/fiber'
import { Sphere, MeshDistortMaterial } from '@react-three/drei'
import * as THREE from 'three'
import SimpleGenerationSelector from './components/SimpleGenerationSelector'
import MusicGenerationModal from './components/MusicGenerationModal'
import CoverArtGenerationModal from './components/CoverArtGenerationModal'
import CombineMediaModal from './components/CombineMediaModal'
// import FloatingMediaPreview from './components/FloatingMediaPreview' // Disabled due to WebGL issues

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
  const [showCombineModal, setShowCombineModal] = useState(false)

  // Track if user has generated items (to show combine button)
  const [hasGeneratedItems, setHasGeneratedItems] = useState(false)

  // Handle music generation success
  const handleMusicGenerated = (url: string, prompt: string) => {
    setHasGeneratedItems(true)
    // Show success message
    console.log('Music generated:', url)
  }

  // Handle image generation success
  const handleImageGenerated = (url: string, prompt: string) => {
    setHasGeneratedItems(true)
    // Show success message
    console.log('Image generated:', url)
  }

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
                <h1 className="text-5xl md:text-7xl font-black mb-4 bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400 bg-clip-text text-transparent">
                  Create with AI
                </h1>
                <p className="text-xl text-purple-100/60">
                  Choose what you want to generate, then combine them into unified media
                </p>
              </div>

              {/* Simple Generation Selector */}
              <SimpleGenerationSelector
                onSelectMusic={() => setShowMusicModal(true)}
                onSelectCoverArt={() => setShowCoverArtModal(true)}
                onSelectVideo={() => alert('🎬 Video generation coming soon!')}
              />

              {/* Combine Button (shows when items are generated) */}
              <div className="mt-8 text-center">
                <button
                  onClick={() => setShowCombineModal(true)}
                  className="px-8 py-4 bg-gradient-to-r from-green-500 to-cyan-500 text-black rounded-2xl font-bold text-lg hover:scale-105 transition-transform shadow-xl shadow-green-500/50"
                >
                  🎭 Combine Media (Create Release)
                </button>
                <p className="text-sm text-purple-400/60 mt-2">
                  Select music + cover art from your library to create a release
                </p>
              </div>

              {/* Info Cards */}
              <div className="grid grid-cols-3 gap-4 mt-12">
                <div className="text-center p-4 backdrop-blur-xl bg-purple-500/5 border border-purple-500/20 rounded-2xl">
                  <div className="text-3xl mb-2">🎵</div>
                  <div className="text-sm text-purple-400/80 font-semibold">2 Credits</div>
                  <div className="text-xs text-purple-400/60">per music</div>
                </div>
                <div className="text-center p-4 backdrop-blur-xl bg-cyan-500/5 border border-cyan-500/20 rounded-2xl">
                  <div className="text-3xl mb-2">🎨</div>
                  <div className="text-sm text-cyan-400/80 font-semibold">1 Credit</div>
                  <div className="text-xs text-cyan-400/60">per image</div>
                </div>
                <div className="text-center p-4 backdrop-blur-xl bg-green-500/5 border border-green-500/20 rounded-2xl">
                  <div className="text-3xl mb-2">⚡</div>
                  <div className="text-sm text-green-400/80 font-semibold">{credits} Credits</div>
                  <div className="text-xs text-green-400/60">remaining</div>
                </div>
              </div>
            </div>
          </div>
        </SignedIn>
      </main>

      {/* Modals */}
      <MusicGenerationModal
        isOpen={showMusicModal}
        onClose={() => setShowMusicModal(false)}
        onSuccess={handleMusicGenerated}
      />

      <CoverArtGenerationModal
        isOpen={showCoverArtModal}
        onClose={() => setShowCoverArtModal(false)}
        onSuccess={handleImageGenerated}
      />

      <CombineMediaModal
        isOpen={showCombineModal}
        onClose={() => setShowCombineModal(false)}
      />

      {/* 3D Floating Media Preview - Disabled for now to prevent WebGL issues */}
      {/* TODO: Re-enable after optimizing WebGL context management */}
      {/* {generatedMedia.length > 0 && (
        <div className="fixed inset-0 z-40 pointer-events-none">
          <FloatingMediaPreview
            mediaItems={generatedMedia}
            onMediaClick={(item) => {
              window.open(item.url, '_blank')
            }}
          />
        </div>
      )} */}
    </div>
  )
}
