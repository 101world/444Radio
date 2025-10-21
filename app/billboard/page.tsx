'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { UserButton, useUser } from '@clerk/nextjs'
import FloatingMenu from '../components/FloatingMenu'
import { formatUsername } from '../../lib/username'

interface ChartSong {
  id: string
  title: string
  user: {
    username: string
    id: string
  }
  coverUrl: string
  plays: number
  likes: number
  genre: string
  rank: number
  rankChange: number // Positive = moving up, negative = moving down
}

export default function BillboardPage() {
  const { user } = useUser()
  const [period, setPeriod] = useState('week') // week, month, all-time
  const [genre, setGenre] = useState('all')
  const [charts, setCharts] = useState<ChartSong[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // TODO: Fetch charts from API
    setLoading(false)
  }, [period, genre])

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Floating Menu */}
      <FloatingMenu />

      {/* Header */}
      <div className="relative overflow-hidden pt-24">
        <div className="absolute inset-0 bg-gradient-to-b from-[#4f46e5]/10 to-transparent"></div>
        <div className="relative max-w-7xl mx-auto px-4 md:px-8 py-12">
          <h1 className="text-5xl md:text-7xl font-black mb-4 text-white">
            🏆 Billboard Charts
          </h1>
          <p className="text-xl text-gray-400">Top AI-generated music trending now</p>
        </div>
      </div>

      {/* Genre Filter - Top Right */}
      <div className="max-w-7xl mx-auto px-4 md:px-8 mb-6 flex justify-end">
        <select
          value={genre}
          onChange={(e) => setGenre(e.target.value)}
          className="px-4 py-2 bg-[#0f1419]/80 backdrop-blur-xl border border-[#6366f1]/20 rounded-xl text-white focus:border-[#818cf8] focus:outline-none"
        >
          <option value="all">All Genres</option>
          <option value="pop">Pop</option>
          <option value="rock">Rock</option>
          <option value="hip-hop">Hip-Hop</option>
          <option value="electronic">Electronic</option>
          <option value="jazz">Jazz</option>
        </select>
      </div>

      {/* Charts - Bottom to Top (reversed) */}
      <main className="max-w-7xl mx-auto px-4 md:px-8 py-8">
        {loading ? (
          <div className="space-y-4">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="h-24 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl animate-pulse"></div>
            ))}
          </div>
        ) : charts.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">📊</div>
            <h2 className="text-2xl font-bold text-white mb-2">No charts yet</h2>
            <p className="text-gray-400 mb-8">Be the first to create trending music!</p>
            <Link href="/" className="inline-block px-8 py-3 bg-white text-black rounded-full font-bold hover:bg-gray-200 transition-all">
              Create Now
            </Link>
          </div>
        ) : (
          <div className="space-y-3 flex flex-col-reverse">
            {/* REVERSED ORDER - Bottom to Top */}
            {charts.map((song) => (
              <Link
                key={song.id}
                href={`/song/${song.id}`}
                className="group flex items-center gap-4 p-4 backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl hover:border-[#4f46e5]/50 hover:bg-white/10 transition-all"
              >
                {/* Rank */}
                <div className="flex flex-col items-center min-w-[60px]">
                  <div className={`text-3xl font-black ${
                    song.rank === 1 ? 'text-yellow-400' :
                    song.rank === 2 ? 'text-gray-300' :
                    song.rank === 3 ? 'text-orange-400' :
                    'text-[#818cf8]'
                  }`}>
                    #{song.rank}
                  </div>
                  {song.rankChange !== 0 && (
                    <div className={`text-xs font-bold ${song.rankChange > 0 ? 'text-[#818cf8]' : 'text-red-400'}`}>
                      {song.rankChange > 0 ? '↑' : '↓'} {Math.abs(song.rankChange)}
                    </div>
                  )}
                </div>

                {/* Cover Art */}
                <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-[#4f46e5]/20 to-[#818cf8]/20 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                  🎵
                </div>

                {/* Song Info */}
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-bold text-white truncate group-hover:text-[#818cf8] transition-colors">
                    {song.title}
                  </h3>
                  <p className="text-sm text-gray-400 truncate">by @{formatUsername(song.user.username)}</p>
                </div>

                {/* Stats */}
                <div className="hidden md:flex items-center gap-6 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-[#818cf8]">▶️</span>
                    <span className="text-white">{song.plays.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[#818cf8]">❤️</span>
                    <span className="text-white">{song.likes.toLocaleString()}</span>
                  </div>
                  <span className="px-3 py-1 bg-white/10 backdrop-blur-xl border border-white/10 rounded-full text-gray-300 text-xs font-semibold">
                    {song.genre}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>

      {/* Bottom Navigation - Period Filter */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
        <div className="flex items-center gap-2 px-4 py-3 bg-[#0f1419]/95 backdrop-blur-xl border border-[#6366f1]/20 rounded-full shadow-2xl">
          {['Today', 'Week', 'Month', 'All-Time'].map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p.toLowerCase().replace('-', ''))}
              className={`px-6 py-2 rounded-full font-semibold transition-all ${
                period === p.toLowerCase().replace('-', '')
                  ? 'bg-gradient-to-r from-[#6366f1] to-[#818cf8] text-white shadow-lg shadow-[#6366f1]/50'
                  : 'text-gray-400 hover:text-white hover:bg-white/10'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

