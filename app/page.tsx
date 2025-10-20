'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { SignedIn, SignedOut, UserButton, useUser } from '@clerk/nextjs'
import SimpleGenerationSelector from './components/SimpleGenerationSelector'
import MusicGenerationModal from './components/MusicGenerationModal'
import CoverArtGenerationModal from './components/CoverArtGenerationModal'
import CombineMediaModal from './components/CombineMediaModal'

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
    <div className="min-h-screen bg-black text-white overflow-hidden relative">
      {/* Animated Background - Subtle */}
      <div className="absolute inset-0 z-0 opacity-20">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(45,74,110,0.3),transparent_50%)] animate-pulse"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(90,143,199,0.2),transparent_40%)] animate-pulse" style={{ animationDelay: '1s' }}></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_80%,rgba(255,255,255,0.05),transparent_40%)] animate-pulse" style={{ animationDelay: '2s' }}></div>
      </div>

      {/* Navigation */}
      <nav className="relative z-50 flex justify-between items-center p-4 md:p-6 backdrop-blur-xl bg-white/5 border-b border-white/10">
        <Link href="/" className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-white/10 backdrop-blur-xl border border-white/20 rounded-xl flex items-center justify-center shadow-lg">
            <span className="font-bold text-lg">🎵</span>
          </div>
          <span className="text-2xl font-bold text-white">444RADIO</span>
        </Link>
        <div className="flex items-center gap-4">
          <SignedIn>
            <Link 
              href="/create" 
              className="px-6 py-2 bg-white text-black rounded-full font-bold hover:bg-gray-200 transition-all shadow-lg"
            >
              ✨ Create
            </Link>
            <Link href="/library" className="hidden md:block px-4 py-2 text-gray-300 hover:text-white font-medium transition-colors">Library</Link>
            <Link href="/explore" className="hidden md:block px-4 py-2 text-gray-300 hover:text-white font-medium transition-colors">Explore</Link>
            <Link href="/billboard" className="hidden md:block px-4 py-2 text-gray-300 hover:text-white font-medium transition-colors">Charts</Link>
            <Link href={`/profile/${user?.id}`} className="hidden md:block px-4 py-2 text-gray-300 hover:text-white font-medium transition-colors">Profile</Link>
            {/* Credits Display */}
            <div className="hidden md:flex items-center gap-2 px-4 py-2 backdrop-blur-lg bg-white/10 border border-white/20 rounded-full">
              <span className="text-2xl">⚡</span>
              <span className="text-white font-bold">{credits}</span>
              <span className="text-gray-400 text-xs">credits</span>
            </div>
            <UserButton afterSignOutUrl="/" />
          </SignedIn>
          <SignedOut>
            <Link href="/sign-in" className="px-6 py-2 text-gray-300 hover:text-white font-medium transition-colors">Sign In</Link>
            <Link href="/sign-up" className="px-6 py-2 bg-white text-black rounded-full font-bold hover:bg-gray-200 transition-all">Join Free</Link>
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
              <h1 className="text-6xl md:text-8xl font-black mb-6 text-white leading-tight">
                Everyone is an Artist
              </h1>
              <p className="text-xl md:text-2xl text-gray-400 mb-12 max-w-3xl mx-auto font-light">
                Generate music with AI. Create stunning visuals. Build your sound. <br/>
                <span className="text-white font-semibold">Instagram for AI Music</span>
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 mb-12">
              <Link href="/sign-up" className="px-10 py-4 bg-white text-black rounded-full font-bold text-lg hover:bg-gray-200 transition-all shadow-xl">
                🚀 Start Creating Free
              </Link>
              <Link href="/explore" className="px-10 py-4 backdrop-blur-lg bg-white/10 border-2 border-white/20 text-white rounded-full font-bold text-lg hover:bg-white/20 transition-all">
                🎧 Explore Music
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mt-16">
              <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6 hover:border-white/30 transition-all">
                <div className="text-4xl mb-3">🎵</div>
                <h3 className="text-xl font-bold text-white mb-2">AI Music Generation</h3>
                <p className="text-gray-400">Create unique tracks with MiniMax Music-1.5</p>
              </div>
              <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6 hover:border-[#2d4a6e]/50 transition-all">
                <div className="text-4xl mb-3">🎨</div>
                <h3 className="text-xl font-bold text-white mb-2">Cover Art & Video</h3>
                <p className="text-gray-400">Generate stunning visuals with Flux & Seedance</p>
              </div>
              <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6 hover:border-white/30 transition-all">
                <div className="text-4xl mb-3">🌍</div>
                <h3 className="text-xl font-bold text-white mb-2">Social Music Feed</h3>
                <p className="text-gray-400">Share, discover, and connect with artists</p>
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
                <h1 className="text-5xl md:text-7xl font-black mb-4 text-white">
                  Create with AI
                </h1>
                <p className="text-xl text-gray-400">
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
