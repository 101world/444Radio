'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { UserButton } from '@clerk/nextjs'

interface Song {
  id: string
  title: string
  user: {
    username: string
    id: string
  }
  coverUrl: string
  audioUrl: string
  likes: number
  plays: number
  genre: string
  createdAt: string
}

export default function ExplorePage() {
  const [songs, setSongs] = useState<Song[]>([])
  const [filter, setFilter] = useState('trending')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // TODO: Fetch songs from API
    setLoading(false)
  }, [filter])

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-slate-950 to-green-950 text-white">
      {/* Top Navigation */}
      <nav className="sticky top-0 z-50 flex justify-between items-center p-4 md:p-6 backdrop-blur-xl bg-black/40 border-b border-green-500/20">
        <Link href="/" className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-cyan-400 rounded-xl flex items-center justify-center shadow-lg shadow-green-500/50">
            <span className="text-black font-bold text-lg">♪</span>
          </div>
          <span className="text-2xl font-bold bg-gradient-to-r from-green-400 to-cyan-400 bg-clip-text text-transparent">
            444RADIO
          </span>
        </Link>

        <div className="flex items-center gap-6">
          <Link href="/" className="hidden md:block px-4 py-2 text-green-400 hover:text-green-300 font-medium transition-colors">
            Create
          </Link>
          <Link href="/explore" className="px-4 py-2 text-green-400 font-bold transition-colors">
            Explore
          </Link>
          <UserButton afterSignOutUrl="/" />
        </div>
      </nav>

      {/* Filters */}
      <div className="sticky top-20 z-40 backdrop-blur-xl bg-black/20 border-b border-green-500/10 px-4 md:px-8 py-4">
        <div className="flex gap-4 overflow-x-auto scrollbar-hide">
          {['Trending', 'New', 'Top', 'Pop', 'Hip-Hop', 'Electronic', 'Jazz'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f.toLowerCase())}
              className={`px-6 py-2 rounded-full font-semibold whitespace-nowrap transition-all ${
                filter === f.toLowerCase()
                  ? 'bg-gradient-to-r from-green-500 to-cyan-500 text-black'
                  : 'bg-green-500/10 border border-green-500/30 text-green-400 hover:bg-green-500/20'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Music Grid - Instagram Style - Bottom to Top */}
      <main className="px-4 md:px-8 py-8">
        <div className="max-w-7xl mx-auto">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(9)].map((_, i) => (
                <div key={i} className="aspect-square bg-green-500/10 rounded-2xl animate-pulse"></div>
              ))}
            </div>
          ) : songs.length === 0 ? (
            <div className="text-center py-20">
              <div className="text-6xl mb-4">🎵</div>
              <h2 className="text-2xl font-bold text-green-400 mb-2">No music yet</h2>
              <p className="text-green-100/60 mb-8">Be the first to create something amazing!</p>
              <Link href="/" className="inline-block px-8 py-3 bg-gradient-to-r from-green-500 to-cyan-500 text-black rounded-full font-bold hover:scale-105 transition-transform">
                Create Now
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6" style={{ display: 'flex', flexDirection: 'column-reverse', flexWrap: 'wrap' }}>
              {/* REVERSED - Shows newest at bottom, scrolling up shows older */}
              {[...songs].reverse().map((song) => (
                <Link key={song.id} href={`/song/${song.id}`} className="group">
                  <div className="relative aspect-square rounded-2xl overflow-hidden backdrop-blur-xl bg-black/40 border border-green-500/20 hover:border-green-500/40 transition-all">
                    {/* Cover Art */}
                    <div className="absolute inset-0 bg-gradient-to-br from-green-500/20 to-cyan-500/20"></div>
                    
                    {/* Overlay on Hover */}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <div className="text-center">
                        <div className="w-16 h-16 rounded-full bg-gradient-to-r from-green-500 to-cyan-500 flex items-center justify-center mx-auto mb-4">
                          <span className="text-2xl">▶</span>
                        </div>
                        <div className="text-green-100 font-bold">{song.title}</div>
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
                      <div className="flex items-center justify-between text-sm text-green-100">
                        <span className="font-semibold truncate">{song.user.username}</span>
                        <div className="flex gap-3">
                          <span>❤️ {song.likes}</span>
                          <span>▶️ {song.plays}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
