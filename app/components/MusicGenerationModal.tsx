'use client'

import { useState } from 'react'
import { X, Music, Loader2, Sparkles } from 'lucide-react'

interface MusicModalProps {
  isOpen: boolean
  onClose: () => void
  userCredits?: number
  onSuccess?: (url: string, prompt: string) => void
}

export default function MusicGenerationModal({ isOpen, onClose, userCredits, onSuccess }: MusicModalProps) {
  const [prompt, setPrompt] = useState('')
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

    if (!prompt.trim() || prompt.length < 10 || prompt.length > 300) {
      alert('Please enter a music description (10-300 characters)')
      return
    }

    // Lyrics are REQUIRED by MiniMax Music API
    if (!lyrics.trim() || lyrics.length < 10 || lyrics.length > 600) {
      alert('⚠️ Lyrics are required! Please enter 10-600 characters with structure tags like [verse] [chorus]')
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl bg-gradient-to-br from-slate-900 to-green-950/50 rounded-2xl border border-green-500/30 shadow-2xl shadow-green-500/20">
        
        {/* Close Button */}
        {!isGenerating && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-green-400 hover:text-green-300 transition-colors"
          >
            <X size={24} />
          </button>
        )}

        <div className="p-8">
          {/* Header */}
          <div className="flex items-center gap-4 mb-6">
            <div className="p-4 bg-green-500/20 rounded-full">
              <Music size={32} className="text-green-400" />
            </div>
            <div>
              <h2 className="text-3xl font-bold text-green-400">Generate Music</h2>
              <p className="text-green-400/60 text-sm">Powered by MiniMax Music-1.5</p>
            </div>
          </div>

          {/* Prompt Input */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-green-400 mb-2">
              Music Description <span className="text-green-400/60">(10-300 characters)</span>
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value.slice(0, 300))}
              placeholder="e.g., 'upbeat electronic dance track with energetic drums and synthesizers'"
              className="w-full h-24 px-4 py-3 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400 placeholder:text-green-400/40 focus:outline-none focus:border-green-500 resize-none"
              maxLength={300}
              disabled={isGenerating}
            />
            <div className="text-xs text-green-400/60 mt-1">
              {prompt.length}/300 characters
            </div>
          </div>

          {/* Lyrics Input (REQUIRED) */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-green-400">
                Lyrics <span className="text-red-400">* Required</span> <span className="text-green-400/60">(10-600 characters)</span>
              </label>
              <button
                type="button"
                onClick={() => setLyrics('[intro]\nSynthwave vibes in the night\n\n[verse]\nNeon lights guide my way\nThrough the city after dark\nElectronic dreams at play\n\n[chorus]\nFeel the rhythm, feel the beat\nDancing through the digital heat\nLost in sound, lost in time\nThis moment feels sublime\n\n[outro]\nFading into the night')}
                className="text-xs px-3 py-1 bg-green-500/20 border border-green-500/30 rounded-lg text-green-400 hover:bg-green-500/30 transition-colors"
              >
                📝 Use Example
              </button>
            </div>
            <textarea
              value={lyrics}
              onChange={(e) => setLyrics(e.target.value.slice(0, 600))}
              placeholder="[intro]&#10;Verse 1 lyrics here...&#10;&#10;[chorus]&#10;Chorus lyrics here...&#10;&#10;[outro]"
              className="w-full h-32 px-4 py-3 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400 placeholder:text-green-400/40 focus:outline-none focus:border-green-500 resize-none font-mono text-sm"
              maxLength={600}
              disabled={isGenerating}
            />
            <div className="text-xs text-green-400/60 mt-1">
              {lyrics.length}/600 characters • Supports: [intro] [verse] [chorus] [bridge] [outro]
            </div>
          </div>

          {/* Parameters */}
          <div className="mb-8 p-6 rounded-xl border border-green-500/20 bg-black/40">
            <h3 className="text-lg font-semibold text-green-400 mb-4 flex items-center gap-2">
              <Sparkles size={20} />
              Audio Parameters
            </h3>
            
            {/* Sample Rate */}
            <div className="mb-4">
              <label className="block text-sm text-green-400/80 mb-2">
                Sample Rate: <span className="font-bold text-green-400">{sampleRate} Hz</span>
              </label>
              <select
                value={sampleRate}
                onChange={(e) => setSampleRate(parseInt(e.target.value))}
                className="w-full px-4 py-2 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400 focus:outline-none focus:border-green-500"
                disabled={isGenerating}
              >
                <option value="16000">16000 Hz (Low)</option>
                <option value="24000">24000 Hz (Medium)</option>
                <option value="32000">32000 Hz (High)</option>
                <option value="44100">44100 Hz (CD Quality)</option>
              </select>
            </div>

            {/* Bitrate */}
            <div className="mb-4">
              <label className="block text-sm text-green-400/80 mb-2">
                Bitrate: <span className="font-bold text-green-400">{bitrate / 1000} kbps</span>
              </label>
              <select
                value={bitrate}
                onChange={(e) => setBitrate(parseInt(e.target.value))}
                className="w-full px-4 py-2 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400 focus:outline-none focus:border-green-500"
                disabled={isGenerating}
              >
                <option value="32000">32 kbps (Low)</option>
                <option value="64000">64 kbps (Medium)</option>
                <option value="128000">128 kbps (Good)</option>
                <option value="256000">256 kbps (High Quality)</option>
              </select>
            </div>

            {/* Audio Format */}
            <div className="mb-4">
              <label className="block text-sm text-green-400/80 mb-2">
                Audio Format: <span className="font-bold text-green-400 uppercase">{audioFormat}</span>
              </label>
              <select
                value={audioFormat}
                onChange={(e) => setAudioFormat(e.target.value)}
                className="w-full px-4 py-2 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400 focus:outline-none focus:border-green-500"
                disabled={isGenerating}
              >
                <option value="mp3">MP3 (Recommended)</option>
                <option value="wav">WAV (Uncompressed)</option>
                <option value="pcm">PCM (Raw)</option>
              </select>
            </div>

            {/* Info Box */}
            <div className="mt-4 p-4 bg-green-500/10 rounded-lg border border-green-500/20">
              <p className="text-sm text-green-400/80">
                <span className="font-semibold">💡 Tip:</span> Use higher sample rate and bitrate for better quality. MP3 is recommended for most use cases.
              </p>
            </div>
          </div>

          {/* Cost & Generate Button */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 px-4 py-2 bg-green-500/20 rounded-full border border-green-500/30">
              <span className="text-xl">⚡</span>
              <span className="text-green-400 font-bold">2 credits</span>
            </div>
            
            <button
              onClick={handleGenerate}
              disabled={isGenerating || (userCredits !== undefined && userCredits < 2) || !prompt.trim()}
              className="px-8 py-3 bg-gradient-to-r from-green-500 to-cyan-500 text-black rounded-xl font-bold hover:scale-105 transition-transform disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center gap-2"
            >
              {isGenerating ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Music size={20} />
                  Generate Music
                </>
              )}
            </button>
          </div>

          {/* Audio Preview */}
          {generatedAudioUrl && (
            <div className="mt-6 p-6 bg-gradient-to-br from-green-500/20 to-cyan-500/20 rounded-xl border border-green-500/30">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-green-400 font-semibold">✅ Music Generated!</p>
                <a
                  href={generatedAudioUrl}
                  download="444radio-music.mp3"
                  className="px-4 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-lg text-sm font-medium transition-colors"
                >
                  Download
                </a>
              </div>
              <audio
                controls
                src={generatedAudioUrl}
                className="w-full"
                style={{
                  filter: 'hue-rotate(90deg) saturate(1.5)',
                  background: 'rgba(16, 185, 129, 0.1)',
                  borderRadius: '0.5rem',
                  padding: '0.5rem'
                }}
              >
                Your browser does not support audio playback.
              </audio>
            </div>
          )}

          {/* Generation Info */}
          {isGenerating && (
            <div className="mt-6 p-4 bg-cyan-500/10 rounded-lg border border-cyan-500/30">
              <p className="text-sm text-cyan-400">
                ⏱️ Generating your music... This typically takes 30-60 seconds.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
