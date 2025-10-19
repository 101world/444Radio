'use client'

import { Music, Image as ImageIcon, Video } from 'lucide-react'

interface SimpleSelectorProps {
  onSelectMusic: () => void
  onSelectCoverArt: () => void
  onSelectVideo: () => void
}

export default function SimpleGenerationSelector({ onSelectMusic, onSelectCoverArt, onSelectVideo }: SimpleSelectorProps) {
  return (
    <div className="backdrop-blur-2xl bg-gradient-to-br from-purple-900/40 via-black/40 to-pink-900/40 border-2 border-purple-500/30 rounded-3xl p-8 shadow-2xl shadow-purple-500/10">
      <div className="text-center mb-6">
        <h2 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent mb-2">
          What do you want to create?
        </h2>
        <p className="text-purple-400/60">Choose a generation type to get started</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* Music Button */}
        <button
          onClick={onSelectMusic}
          className="group relative p-6 bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-2 border-green-500/30 rounded-2xl hover:border-green-500/60 hover:scale-105 transition-all duration-300"
        >
          <div className="flex flex-col items-center gap-3">
            <div className="p-4 bg-green-500/20 rounded-full group-hover:bg-green-500/30 transition-colors">
              <Music size={32} className="text-green-400" />
            </div>
            <h3 className="text-xl font-bold text-green-400">Music</h3>
            <p className="text-xs text-green-400/60">AI-generated tracks</p>
            <div className="flex items-center gap-1 text-xs">
              <span className="text-yellow-400">⚡</span>
              <span className="text-green-400">2 credits</span>
            </div>
          </div>
        </button>

        {/* Cover Art Button */}
        <button
          onClick={onSelectCoverArt}
          className="group relative p-6 bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border-2 border-cyan-500/30 rounded-2xl hover:border-cyan-500/60 hover:scale-105 transition-all duration-300"
        >
          <div className="flex flex-col items-center gap-3">
            <div className="p-4 bg-cyan-500/20 rounded-full group-hover:bg-cyan-500/30 transition-colors">
              <ImageIcon size={32} className="text-cyan-400" />
            </div>
            <h3 className="text-xl font-bold text-cyan-400">Cover Art</h3>
            <p className="text-xs text-cyan-400/60">Album artwork</p>
            <div className="flex items-center gap-1 text-xs">
              <span className="text-yellow-400">⚡</span>
              <span className="text-cyan-400">1 credit</span>
            </div>
          </div>
        </button>

        {/* Video Button */}
        <button
          onClick={onSelectVideo}
          className="group relative p-6 bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-2 border-purple-500/30 rounded-2xl hover:border-purple-500/60 hover:scale-105 transition-all duration-300"
        >
          <div className="flex flex-col items-center gap-3">
            <div className="p-4 bg-purple-500/20 rounded-full">
              <Video size={32} className="text-purple-400" />
            </div>
            <h3 className="text-xl font-bold text-purple-400">Video</h3>
            <p className="text-xs text-purple-400/60">Coming Soon</p>
            <div className="flex items-center gap-1 text-xs">
              <span className="text-yellow-400">⚡</span>
              <span className="text-purple-400">3 credits</span>
            </div>
          </div>
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-2xl">
            <span className="text-sm text-white font-semibold">Coming Soon</span>
          </div>
        </button>
      </div>
    </div>
  )
}
