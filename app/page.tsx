'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Settings, X } from 'lucide-react'
import FloatingMenu from './components/FloatingMenu'
import HolographicBackgroundClient from './components/HolographicBackgroundClient'

export default function HomePage() {
  const router = useRouter()
  const [prompt, setPrompt] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  
  // Optional parameters
  const [customLyrics, setCustomLyrics] = useState('')
  const [customTitle, setCustomTitle] = useState('')
  const [generateCoverArt, setGenerateCoverArt] = useState(true)
  const [genre, setGenre] = useState('')

  const handleCreate = () => {
    if (!prompt.trim()) return

    // Build parameters for create page
    const params = new URLSearchParams({
      prompt: prompt.trim(),
      ...(customLyrics && { lyrics: customLyrics }),
      ...(customTitle && { title: customTitle }),
      generateCoverArt: generateCoverArt.toString(),
      ...(genre && { genre: genre })
    })
    
    // Seamlessly redirect to create page
    router.push(/create?+params.toString())
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleCreate()
    }
  }

  return (
    <div className="relative min-h-screen bg-black text-white overflow-hidden">
      {/* 3D Holographic Background */}
      <div className="fixed inset-0 z-0">
        <HolographicBackgroundClient />
      </div>

      {/* Floating Menu */}
      <FloatingMenu />

      {/* Main Content */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4">
        {/* Logo/Title */}
        <div className="mb-auto pt-20">
          <h1 
            className="text-6xl md:text-8xl font-bold tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600"
            style={{ fontFamily: "'Courier New', monospace" }}
          >
            444RADIO
          </h1>
          <p className="text-center text-gray-400 text-sm mt-4 tracking-widest">
            AI MUSIC STUDIO
          </p>
        </div>

        {/* Bottom Prompt Section */}
        <div className="w-full max-w-3xl mb-20">
          {/* Main Prompt Input */}
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-cyan-600 via-blue-600 to-purple-600 rounded-2xl blur-lg opacity-30 group-hover:opacity-50 transition duration-300"></div>
            <div className="relative">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Describe the music you want to create..."
                className="w-full px-6 py-4 bg-black/80 backdrop-blur-xl border-2 border-cyan-500/30 rounded-2xl text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/60 transition-colors resize-none"
                style={{ fontFamily: "'Courier New', monospace" }}
                rows={3}
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 mt-4">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-3 bg-white/10 hover:bg-white/20 backdrop-blur-xl border border-white/20 rounded-xl transition-colors"
              title="Advanced Settings"
            >
              <Settings size={20} className="text-cyan-400" />
            </button>
            <button
              onClick={handleCreate}
              disabled={!prompt.trim()}
              className="flex-1 px-8 py-3 bg-gradient-to-r from-cyan-600 via-blue-600 to-purple-600 hover:from-cyan-500 hover:via-blue-500 hover:to-purple-500 rounded-xl font-bold tracking-wider transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-cyan-500/30"
              style={{ fontFamily: "'Courier New', monospace" }}
            >
              CREATE
            </button>
          </div>

          {/* Settings Panel */}
          {showSettings && (
            <div className="mt-4 p-6 bg-black/90 backdrop-blur-xl border border-cyan-500/30 rounded-2xl space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-cyan-400" style={{ fontFamily: "'Courier New', monospace" }}>
                  ADVANCED OPTIONS
                </h3>
                <button
                  onClick={() => setShowSettings(false)}
                  className="p-1 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <X size={20} className="text-gray-400" />
                </button>
              </div>

              {/* Title Input */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  Custom Title (optional)
                </label>
                <input
                  type="text"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  placeholder="Enter song title..."
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/50 transition-colors"
                  style={{ fontFamily: "'Courier New', monospace" }}
                />
              </div>

              {/* Genre Input */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  Genre
                </label>
                <input
                  type="text"
                  value={genre}
                  onChange={(e) => setGenre(e.target.value)}
                  placeholder="e.g. Hip-hop, Jazz, Rock..."
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/50 transition-colors"
                  style={{ fontFamily: "'Courier New', monospace" }}
                />
              </div>

              {/* Lyrics Input */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  Custom Lyrics (optional)
                </label>
                <textarea
                  value={customLyrics}
                  onChange={(e) => setCustomLyrics(e.target.value)}
                  placeholder="Enter your lyrics here..."
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/50 transition-colors resize-none"
                  style={{ fontFamily: "'Courier New', monospace" }}
                  rows={4}
                />
              </div>

              {/* Cover Art Toggle */}
              <div className="flex items-center justify-between">
                <label className="text-sm text-gray-400">
                  Generate Cover Art
                </label>
                <button
                  onClick={() => setGenerateCoverArt(!generateCoverArt)}
                  className={elative w-14 h-8 rounded-full transition-colors +(generateCoverArt ? 'bg-cyan-600' : 'bg-gray-600')}
                >
                  <div
                    className={bsolute top-1 w-6 h-6 bg-white rounded-full transition-transform +(generateCoverArt ? 'translate-x-7' : 'translate-x-1')}
                  />
                </button>
              </div>
            </div>
          )}

          {/* Quick Info */}
          <div className="flex items-center justify-center gap-4 mt-4 text-xs text-gray-600 font-mono">
            <span className="text-cyan-400">Music: 2 CR</span>
            <span className="text-gray-700"></span>
            <span className="text-purple-400">Cover Art: 1 CR</span>
          </div>
        </div>
      </div>
    </div>
  )
}
