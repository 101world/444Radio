'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

interface Song {
  id: string
  title: string
  prompt: string
  genre: string
  audio_url: string
  cover_url: string
  created_at: string
}

export default function Music() {
  const [songs, setSongs] = useState<Song[]>([])

  useEffect(() => {
    const fetchSongs = async () => {
      const { data, error } = await supabase
        .from('songs')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) console.error(error)
      else setSongs(data || [])
    }
    fetchSongs()
  }, [])

  return (
    <main className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold text-center mb-8 text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-cyan-300">Explore Music</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {songs.map((song) => (
            <div key={song.id} className="backdrop-blur-md bg-white/10 border border-white/20 rounded-2xl p-4 shadow-2xl hover:scale-105 transition-transform">
              <img src={song.cover_url} alt="Cover" className="w-full h-48 object-cover rounded-xl mb-4" />
              <h3 className="text-lg font-semibold mb-2">{song.title}</h3>
              <p className="text-gray-400 mb-2">{song.prompt}</p>
              <p className="text-gray-400 mb-2">{song.genre}</p>
              <audio controls className="w-full">
                <source src={song.audio_url} type="audio/mpeg" />
              </audio>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}

