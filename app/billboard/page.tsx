'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { UserButton, useUser } from '@clerk/nextjs'

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
    <div className="min-h-screen bg-gradient-to-br from-black via-slate-950 to-green-950 text-white">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 flex justify-between items-center p-4 md:p-6 backdrop-blur-xl bg-black/40 border-b border-green-500/20">
        <Link href="/" className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-cyan-400 rounded-xl flex items-center justify-center shadow-lg shadow-green-500/50">
            <span className="text-black font-bold text-lg">♪</span>
          </div>
          <span className="text-2xl font-bold bg-gradient-to-r from-green-400 to-cyan-400 bg-clip-text text-transparent">
            444RADIO
          </span>
        </Link>

        <div className="flex items-center gap-4">
          <Link href="/" className="hidden md:block px-4 py-2 text-green-400 hover:text-green-300 font-medium">
            Create
          </Link>
          <Link href="/explore" className="hidden md:block px-4 py-2 text-green-400 hover:text-green-300 font-medium">
            Explore
          </Link>
          <Link href="/billboard" className="px-4 py-2 text-green-400 font-bold">
            Charts
          </Link>
          {user && (
            <Link href={`/profile/${user.id}`} className="hidden md:block px-4 py-2 text-green-400 hover:text-green-300 font-medium">
              Profile
            </Link>
          )}
          <UserButton afterSignOutUrl="/" />
        </div>
      </nav>

      {/* Header */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-green-500/10 to-transparent"></div>
        <div className="relative max-w-7xl mx-auto px-4 md:px-8 py-12">
          <h1 className="text-5xl md:text-7xl font-black mb-4 bg-gradient-to-r from-green-400 to-cyan-400 bg-clip-text text-transparent">
            🏆 Billboard Charts
          </h1>
          <p className="text-xl text-green-100/70">Top AI-generated music trending now</p>
        </div>
      </div>

      {/* Filters */}
      <div className="sticky top-20 z-40 backdrop-blur-xl bg-black/30 border-b border-green-500/10 px-4 md:px-8 py-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row gap-4 justify-between">
          {/* Period Filter */}
          <div className="flex gap-2">
            {['Today', 'Week', 'Month', 'All-Time'].map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p.toLowerCase())}
                className={`px-6 py-2 rounded-full font-semibold transition-all ${
                  period === p.toLowerCase()
                    ? 'bg-gradient-to-r from-green-500 to-cyan-500 text-black'
                    : 'bg-green-500/10 border border-green-500/30 text-green-400 hover:bg-green-500/20'
                }`}
              >
                {p}
              </button>
            ))}
          </div>

          {/* Genre Filter */}
          <select
            value={genre}
            onChange={(e) => setGenre(e.target.value)}
            className="px-4 py-2 bg-black/60 border border-green-500/30 rounded-xl text-green-100 focus:border-green-400 focus:outline-none"
          >
            <option value="all">All Genres</option>
            <option value="pop">Pop</option>
            <option value="rock">Rock</option>
            <option value="hip-hop">Hip-Hop</option>
            <option value="electronic">Electronic</option>
            <option value="jazz">Jazz</option>
          </select>
        </div>
      </div>

      {/* Charts - Bottom to Top (reversed) */}
      <main className="max-w-7xl mx-auto px-4 md:px-8 py-8">
        {loading ? (
          <div className="space-y-4">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="h-24 bg-green-500/10 rounded-2xl animate-pulse"></div>
            ))}
          </div>
        ) : charts.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">📊</div>
            <h2 className="text-2xl font-bold text-green-400 mb-2">No charts yet</h2>
            <p className="text-green-100/60 mb-8">Be the first to create trending music!</p>
            <Link href="/" className="inline-block px-8 py-3 bg-gradient-to-r from-green-500 to-cyan-500 text-black rounded-full font-bold hover:scale-105 transition-transform">
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
                className="group flex items-center gap-4 p-4 backdrop-blur-xl bg-black/40 border border-green-500/20 rounded-2xl hover:border-green-500/40 hover:bg-black/60 transition-all"
              >
                {/* Rank */}
                <div className="flex flex-col items-center min-w-[60px]">
                  <div className={`text-3xl font-black ${
                    song.rank === 1 ? 'text-yellow-400' :
                    song.rank === 2 ? 'text-gray-300' :
                    song.rank === 3 ? 'text-orange-400' :
                    'text-green-400'
                  }`}>
                    #{song.rank}
                  </div>
                  {song.rankChange !== 0 && (
                    <div className={`text-xs font-bold ${song.rankChange > 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {song.rankChange > 0 ? '↑' : '↓'} {Math.abs(song.rankChange)}
                    </div>
                  )}
                </div>

                {/* Cover Art */}
                <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-green-500/20 to-cyan-500/20 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                  🎵
                </div>

                {/* Song Info */}
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-bold text-green-100 truncate group-hover:text-green-400 transition-colors">
                    {song.title}
                  </h3>
                  <p className="text-sm text-green-100/60 truncate">by {song.user.username}</p>
                </div>

                {/* Stats */}
                <div className="hidden md:flex items-center gap-6 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-green-400">▶️</span>
                    <span className="text-green-100">{song.plays.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-green-400">❤️</span>
                    <span className="text-green-100">{song.likes.toLocaleString()}</span>
                  </div>
                  <span className="px-3 py-1 bg-green-500/10 border border-green-500/30 rounded-full text-green-400 text-xs font-semibold">
                    {song.genre}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
