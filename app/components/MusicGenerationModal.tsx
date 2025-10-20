'use client'

import { useState } from 'react'
import { X, Music, Loader2, Sparkles } from 'lucide-react'

interface MusicModalProps {
  isOpen: boolean
  onClose: () => void
  userCredits?: number
  onSuccess?: (url: string, prompt: string) => void
  initialPrompt?: string
}

export default function MusicGenerationModal({ isOpen, onClose, userCredits, onSuccess, initialPrompt = '' }: MusicModalProps) {
  const [title, setTitle] = useState('')
  const [prompt, setPrompt] = useState(initialPrompt)
  const [lyrics, setLyrics] = useState('')
  const [bitrate, setBitrate] = useState(256000)
  const [sampleRate, setSampleRate] = useState(44100)
  const [audioFormat, setAudioFormat] = useState('mp3')
  const [isGenerating, setIsGenerating] = useState(false)
  
  const [generatedAudioUrl, setGeneratedAudioUrl] = useState<string | null>(null)

  const handleGenerate = async () => {
    if (userCredits !== undefined && userCredits < 2) {
      alert('⚡ You need at least 2 credits to generate music!')
      return
    }

    if (!title.trim() || title.length < 3 || title.length > 100) {
      alert('Please enter a song title (3-100 characters)')
      return
    }

    if (!prompt.trim() || prompt.length < 10 || prompt.length > 500) {
      alert('Please enter a music description (10-500 characters)')
      return
    }

    // Lyrics are REQUIRED by MiniMax Music API
    if (!lyrics.trim() || lyrics.length < 10 || lyrics.length > 3000) {
      alert('⚠️ Lyrics are required! Please enter 10-3000 characters with structure tags like [verse] [chorus]')
      return
    }

    setIsGenerating(true)
    setGeneratedAudioUrl(null)
    
    try {
      // Generate music directly (no song record needed)
      const res = await fetch('/api/generate/music-only', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          prompt,
          lyrics, // Required
          bitrate,
          sample_rate: sampleRate,
          audio_format: audioFormat
        })
      })

      const data = await res.json()
      
      if (data.success) {
        setGeneratedAudioUrl(data.audioUrl)
        
        // Call onSuccess callback if provided
        if (onSuccess) {
          onSuccess(data.audioUrl, prompt)
        }
        
        alert(`🎵 Music generated! ${data.creditsRemaining} credits remaining`)
      } else {
        alert(`Error: ${data.error}`)
      }
    } catch (error) {
      console.error('Generation error:', error)
      alert('Failed to generate music. Please try again.')
    } finally {
      setIsGenerating(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fadeIn">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={!isGenerating ? onClose : undefined}
      />

      {/* Modal - Glassmorphism */}
      <div className="relative w-full max-w-3xl max-h-[90vh] overflow-hidden">
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl shadow-black/50">
          
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-white/10 rounded-xl">
                <Music className="text-white" size={24} />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">Generate Music</h2>
                <p className="text-sm text-gray-400">Fill in the details to create your track</p>
              </div>
            </div>
            {!isGenerating && (
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white"
              >
                <X size={24} />
              </button>
            )}
          </div>

          {/* Form Content */}
          <div className="p-6 space-y-5 overflow-y-auto max-h-[calc(90vh-200px)]">
            
            {/* Song Title */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-white">
                Song Title
                <span className="text-white/40 ml-2">(3-100 characters)</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value.slice(0, 100))}
                disabled={isGenerating}
                placeholder="Enter your song title..."
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-white/30 focus:bg-white/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                maxLength={100}
              />
              <p className="text-xs text-gray-500">{title.length}/100</p>
            </div>

            {/* Music Style/Prompt */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-white">
                Music Style & Description
                <span className="text-white/40 ml-2">(10-500 characters)</span>
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value.slice(0, 500))}
                disabled={isGenerating}
                placeholder="e.g., 'upbeat electronic dance music with heavy bass, energetic drums, and synthesizer melodies'"
                rows={3}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-white/30 focus:bg-white/10 transition-all resize-none disabled:opacity-50 disabled:cursor-not-allowed"
                maxLength={500}
              />
              <p className="text-xs text-gray-500">{prompt.length}/500</p>
            </div>

            {/* Lyrics */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-white">
                  Lyrics
                  <span className="text-white/40 ml-2">(10-3000 characters)</span>
                </label>
                <button
                  type="button"
                  onClick={() => setLyrics('[intro]\nSynthwave vibes in the night\n\n[verse]\nNeon lights guide my way\nThrough the city after dark\nElectronic dreams at play\n\n[chorus]\nFeel the rhythm, feel the beat\nDancing through the digital heat\nLost in sound, lost in time\nThis moment feels sublime\n\n[outro]\nFading into the night')}
                  className="text-xs px-3 py-1.5 bg-white/10 hover:bg-white/20 border border-white/10 rounded-lg text-white transition-colors"
                  disabled={isGenerating}
                >
                  Use Example
                </button>
              </div>
              <textarea
                value={lyrics}
                onChange={(e) => setLyrics(e.target.value.slice(0, 3000))}
                disabled={isGenerating}
                placeholder="[intro]&#10;Your intro...&#10;&#10;[verse]&#10;Verse 1 lyrics here...&#10;&#10;[chorus]&#10;Chorus lyrics here...&#10;&#10;[outro]&#10;Your outro..."
                rows={10}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-white/30 focus:bg-white/10 transition-all resize-none font-mono text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                maxLength={3000}
              />
              <p className="text-xs text-gray-500">{lyrics.length}/3000 • Use tags: [intro] [verse] [chorus] [bridge] [outro]</p>
            </div>

            {/* Advanced Parameters (Collapsible) */}
            <details className="group">
              <summary className="cursor-pointer list-none">
                <div className="flex items-center justify-between p-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-colors">
                  <div className="flex items-center gap-2">
                    <Sparkles className="text-gray-400" size={18} />
                    <span className="text-sm font-medium text-white">Advanced Parameters</span>
                  </div>
                  <span className="text-gray-400 group-open:rotate-180 transition-transform">▼</span>
                </div>
              </summary>
              
              <div className="mt-4 p-4 bg-white/5 border border-white/10 rounded-xl space-y-4">
                {/* Sample Rate */}
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-2">
                    Sample Rate: <span className="text-white">{sampleRate} Hz</span>
                  </label>
                  <select
                    value={sampleRate}
                    onChange={(e) => setSampleRate(parseInt(e.target.value))}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-white/30"
                    disabled={isGenerating}
                  >
                    <option value="16000">16000 Hz (Low)</option>
                    <option value="24000">24000 Hz (Medium)</option>
                    <option value="32000">32000 Hz (High)</option>
                    <option value="44100">44100 Hz (CD Quality)</option>
                  </select>
                </div>

                {/* Bitrate */}
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-2">
                    Bitrate: <span className="text-white">{bitrate / 1000} kbps</span>
                  </label>
                  <select
                    value={bitrate}
                    onChange={(e) => setBitrate(parseInt(e.target.value))}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-white/30"
                    disabled={isGenerating}
                  >
                    <option value="32000">32 kbps (Low)</option>
                    <option value="64000">64 kbps (Medium)</option>
                    <option value="128000">128 kbps (Good)</option>
                    <option value="256000">256 kbps (High Quality)</option>
                  </select>
                </div>

                {/* Audio Format */}
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-2">
                    Format: <span className="text-white uppercase">{audioFormat}</span>
                  </label>
                  <select
                    value={audioFormat}
                    onChange={(e) => setAudioFormat(e.target.value)}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-white/30"
                    disabled={isGenerating}
                  >
                    <option value="mp3">MP3 (Recommended)</option>
                    <option value="wav">WAV (Uncompressed)</option>
                    <option value="pcm">PCM (Raw)</option>
                  </select>
                </div>
              </div>
            </details>

            {/* Info Box */}
            <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
              <div className="flex items-start gap-3">
                <Sparkles className="text-gray-400 flex-shrink-0 mt-0.5" size={16} />
                <div className="text-xs text-gray-400 space-y-1">
                  <p><span className="text-white font-semibold">Tip:</span> Be specific with style, genre, and mood.</p>
                  <p>Structure lyrics with [intro], [verse], [chorus], [bridge], [outro] for best results.</p>
                </div>
              </div>
            </div>

            {/* Audio Preview */}
            {generatedAudioUrl && (
              <div className="p-4 bg-white/10 border border-white/20 rounded-xl">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm text-white font-semibold">✅ Music Generated!</p>
                  <a
                    href={generatedAudioUrl}
                    download={`${title || '444radio-music'}.mp3`}
                    className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    Download
                  </a>
                </div>
                <audio
                  controls
                  src={generatedAudioUrl}
                  className="w-full rounded-lg"
                >
                  Your browser does not support audio playback.
                </audio>
              </div>
            )}

            {/* Generation Status */}
            {isGenerating && (
              <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
                <p className="text-sm text-gray-400">
                  ⏱️ Generating your music... This typically takes 30-60 seconds.
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-6 border-t border-white/10 bg-white/5">
            <div className="flex items-center gap-2 px-4 py-2 bg-white/10 rounded-full border border-white/10">
              <span className="text-lg">⚡</span>
              <span className="text-white font-bold text-sm">2 credits</span>
            </div>
            
            <button
              onClick={handleGenerate}
              disabled={isGenerating || (userCredits !== undefined && userCredits < 2) || !title.trim() || !prompt.trim() || !lyrics.trim()}
              className="px-6 py-3 bg-white text-black rounded-xl font-semibold hover:bg-gray-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white flex items-center gap-2"
            >
              {isGenerating ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Music size={20} />
                  Generate Track
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }
      `}</style>
    </div>
  )
}

