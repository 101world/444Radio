'use client'

import { useState } from 'react'
import { SignedIn, SignedOut } from '@clerk/nextjs'

const genres = ['Pop', 'Rock', 'Hip-Hop', 'Electronic', 'Jazz', 'Classical', 'Country', 'Reggae']

export default function Home() {
  const [title, setTitle] = useState('')
  const [prompt, setPrompt] = useState('')
  const [lyrics, setLyrics] = useState('')
  const [bpm, setBpm] = useState('')
  const [genre, setGenre] = useState('')
  const [instrumental, setInstrumental] = useState(false)
  const [coverPrompt, setCoverPrompt] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, prompt, lyrics, bpm, genre, instrumental, coverPrompt }),
      })
      const data = await res.json()
      if (data.success) {
        alert('Music generated!')
        // Redirect to profile or refresh
      } else {
        alert('Error: ' + data.error)
      }
    } catch (error) {
      alert('Error generating music')
    }
    setLoading(false)
  }

  return (
    <main className="min-h-screen bg-gray-900 text-white p-8 relative overflow-hidden">
      {/* 3D Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-20 left-10 w-32 h-32 bg-teal-500/20 rounded-full blur-xl animate-pulse" style={{ transform: 'translateZ(50px) rotateX(45deg)' }}></div>
        <div className="absolute top-40 right-20 w-24 h-24 bg-pink-500/20 rounded-lg blur-lg animate-bounce" style={{ transform: 'translateZ(30px) rotateY(30deg)', animationDelay: '1s' }}></div>
        <div className="absolute bottom-32 left-1/4 w-40 h-40 bg-purple-500/20 rounded-full blur-2xl animate-pulse" style={{ transform: 'translateZ(70px) rotateX(-20deg)', animationDelay: '2s' }}></div>
        <div className="absolute top-1/3 right-1/3 w-16 h-16 bg-teal-400/30 rounded-lg blur-md animate-spin" style={{ transform: 'translateZ(40px)', animationDuration: '10s' }}></div>
      </div>

      <div className="max-w-4xl mx-auto relative z-10" style={{ perspective: '1000px' }}>
        <h1 className="text-6xl font-bold text-center mb-8 text-transparent bg-clip-text bg-gradient-to-r from-teal-400 via-pink-400 to-purple-400 animate-pulse" style={{ transform: 'translateZ(20px)' }}>
          Generate Your Music
        </h1>
        <SignedOut>
          <div className="backdrop-blur-md bg-white/10 border border-white/20 rounded-2xl p-8 shadow-2xl" style={{ transform: 'translateZ(10px) rotateX(5deg)' }}>
            <p className="text-center text-xl">Please sign in to generate music.</p>
          </div>
        </SignedOut>
        <SignedIn>
          <form onSubmit={handleSubmit} className="space-y-6 backdrop-blur-md bg-white/10 border border-white/20 rounded-2xl p-8 shadow-2xl" style={{ transform: 'translateZ(15px) rotateX(-2deg)' }}>
            <div>
              <label className="block text-sm font-medium mb-2">Song Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full p-3 bg-gray-700 rounded border border-gray-600 focus:border-teal-400 focus:outline-none"
                placeholder="Enter song title..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Prompt</label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="w-full p-3 bg-gray-700 rounded border border-gray-600 focus:border-teal-400 focus:outline-none"
                placeholder="Describe your music..."
                rows={3}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Lyrics (optional)</label>
              <textarea
                value={lyrics}
                onChange={(e) => setLyrics(e.target.value)}
                className="w-full p-3 bg-gray-700 rounded border border-gray-600 focus:border-teal-400 focus:outline-none"
                placeholder="Enter lyrics..."
                rows={4}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">BPM</label>
                <input
                  type="number"
                  value={bpm}
                  onChange={(e) => setBpm(e.target.value)}
                  className="w-full p-3 bg-gray-700 rounded border border-gray-600 focus:border-teal-400 focus:outline-none"
                  placeholder="120"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Genre</label>
                <div className="flex flex-wrap gap-2">
                  {genres.map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setGenre(g)}
                      className={`px-3 py-1 rounded ${genre === g ? 'bg-teal-500 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={instrumental}
                  onChange={(e) => setInstrumental(e.target.checked)}
                  className="mr-2"
                />
                Instrumental (no vocals)
              </label>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Cover Art Prompt</label>
              <input
                type="text"
                value={coverPrompt}
                onChange={(e) => setCoverPrompt(e.target.value)}
                className="w-full p-3 bg-gray-700 rounded border border-gray-600 focus:border-teal-400 focus:outline-none"
                placeholder="Describe the cover art..."
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-teal-500 text-white py-3 rounded hover:bg-teal-600 transition disabled:opacity-50"
            >
              {loading ? 'Generating...' : 'Generate Music'}
            </button>
          </form>
        </SignedIn>
      </div>
    </main>
  )
}
