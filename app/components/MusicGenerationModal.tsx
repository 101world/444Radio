'use client'

import { useState, useEffect } from 'react'
import { X, Music, Loader2, Sparkles } from 'lucide-react'
import { getLanguageHook, getSamplePromptsForLanguage, getLyricsStructureForLanguage } from '@/lib/language-hooks'
import { useGenerationQueue } from '../contexts/GenerationQueueContext'
import { LYRICS_DATABASE } from '@/lib/lyrics-database'
import { validateGenerationPrompt } from '@/lib/validation'

interface MusicModalProps {
  isOpen: boolean
  onClose: () => void
  userCredits?: number
  onSuccess?: (url: string, prompt: string) => void
  onGenerationStart?: (prompt: string) => void
  initialPrompt?: string
}

export default function MusicGenerationModal({ isOpen, onClose, userCredits, onSuccess, onGenerationStart, initialPrompt = '' }: MusicModalProps) {
  const { addGeneration, updateGeneration } = useGenerationQueue()
  const [title, setTitle] = useState('')
  const [prompt, setPrompt] = useState(initialPrompt)
  const [lyrics, setLyrics] = useState('')
  const [language, setLanguage] = useState('English')
  const [bitrate, setBitrate] = useState(256000)
  const [sampleRate, setSampleRate] = useState(44100)
  const [audioFormat, setAudioFormat] = useState('mp3')
  
  // ACE-Step specific parameters (for non-English)
  const [audioLengthInSeconds, setAudioLengthInSeconds] = useState(45)
  const [numInferenceSteps, setNumInferenceSteps] = useState(50)
  const [guidanceScale, setGuidanceScale] = useState(7.0)
  const [denoisingStrength, setDenoisingStrength] = useState(0.8)
  
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedAudioUrl, setGeneratedAudioUrl] = useState<string | null>(null)
  
  const isEnglish = language.toLowerCase() === 'english' || language.toLowerCase() === 'en'
  const languageHook = getLanguageHook(language)

  // Update example lyrics when language changes
  useEffect(() => {
    if (!isEnglish && languageHook) {
      const structure = getLyricsStructureForLanguage(language)
      setLyrics(structure)
    }
  }, [language, isEnglish, languageHook])

  const handleGenerate = async () => {
    if (userCredits !== undefined && userCredits < 2) {
      alert('⚡ You need at least 2 credits to generate music!')
      return
    }

    if (!title.trim() || title.length < 3 || title.length > 100) {
      alert('Please enter a song title (3-100 characters)')
      return
    }

    // Use validation library for prompt
    const validation = validateGenerationPrompt(prompt)
    if (!validation.isValid) {
      const errorMessage = Object.values(validation.errors).join('. ')
      alert(`❌ ${errorMessage}`)
      return
    }

    // Lyrics are REQUIRED by Music API
    if (!lyrics.trim() || lyrics.length < 10 || lyrics.length > 3000) {
      alert('⚠️ Lyrics are required! Please enter 10-3000 characters with structure tags like [verse] [chorus]')
      return
    }

    setIsGenerating(true)
    setGeneratedAudioUrl(null)
    
    // Add to persistent generation queue
    const generationId = addGeneration({
      type: 'music',
      prompt: prompt,
      title: title
    })
    
    // Update status to generating
    updateGeneration(generationId, { status: 'generating', progress: 10 })
    
    // Call onGenerationStart to close modal and show chat immediately
    if (onGenerationStart) {
      onGenerationStart(prompt)
      onClose()
    }
    
    try {
      // Build request body based on language
      const requestBody: any = {
        title,
        prompt,
        lyrics,
        language,
        bitrate,
        sample_rate: sampleRate,
        audio_format: audioFormat
      }

      // Add ACE-Step specific parameters for non-English
      if (!isEnglish) {
        requestBody.audio_length_in_s = audioLengthInSeconds
        requestBody.num_inference_steps = numInferenceSteps
        requestBody.guidance_scale = guidanceScale
        requestBody.denoising_strength = denoisingStrength
      }

      // Generate music directly (no song record needed)
      const res = await fetch('/api/generate/music-only', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      })

      const data = await res.json()
      
      if (data.success) {
        setGeneratedAudioUrl(data.audioUrl)
        
        // Update generation queue with success
        updateGeneration(generationId, {
          status: 'completed',
          result: {
            audioUrl: data.audioUrl,
            title: title,
            lyrics: lyrics
          }
        })
        
        // Call onSuccess callback if provided
        if (onSuccess) {
          onSuccess(data.audioUrl, prompt)
        }
        
        alert(`🎵 Music generated! ${data.creditsRemaining} credits remaining`)
      } else {
        // Update generation queue with failure
        updateGeneration(generationId, {
          status: 'failed',
          error: data.error || 'Unknown error'
        })
        alert(`Error: ${data.error}`)
      }
    } catch (error) {
      console.error('Generation error:', error)
      // Update generation queue with failure
      updateGeneration(generationId, {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
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
                Song Title <span className="text-red-500">*</span>
                <span className="text-white/40 ml-2">(3-100 characters, required)</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value.slice(0, 100))}
                disabled={isGenerating}
                required
                placeholder="Enter your song title..."
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-white/30 focus:bg-white/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                maxLength={100}
              />
              <p className="text-xs text-red-400 font-medium">⚠️ Title is mandatory (3-100 characters)</p>
              <p className="text-xs text-gray-500">{title.length}/100 characters</p>
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

            {/* Language */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-white">
                Language {!isEnglish && <span className="text-purple-400">(ACE-Step Model)</span>}
              </label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                disabled={isGenerating}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-white/30"
              >
                <option value="English">English</option>
                <option value="chinese">中文 Chinese</option>
                <option value="japanese">日本語 Japanese</option>
                <option value="korean">한국어 Korean</option>
                <option value="spanish">Español Spanish</option>
                <option value="french">Français French</option>
                <option value="hindi">हिन्दी Hindi</option>
                <option value="german">Deutsch German</option>
                <option value="portuguese">Português Portuguese</option>
                <option value="arabic">العربية Arabic</option>
                <option value="italian">Italiano Italian</option>
              </select>
              
              {/* Language Helper */}
              {languageHook && (
                <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg">
                  <p className="text-xs text-purple-300 mb-2 font-semibold">💡 Popular Genres:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {languageHook.genres.map((genre, idx) => (
                      <span key={idx} className="px-2 py-1 bg-purple-500/20 text-purple-300 text-xs rounded">
                        {genre}
                      </span>
                    ))}
                  </div>
                  {languageHook.samplePrompts.length > 0 && (
                    <button
                      onClick={() => {
                        const randomPrompt = languageHook.samplePrompts[Math.floor(Math.random() * languageHook.samplePrompts.length)]
                        setPrompt(randomPrompt)
                      }}
                      className="mt-2 text-xs text-purple-400 hover:text-purple-300 underline"
                    >
                      Get random prompt idea
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Lyrics */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-white">
                  Lyrics <span className="text-red-500">*</span>
                  <span className="text-white/40 ml-2">(10-3000 characters, required)</span>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    // Get random song from lyrics database
                    const randomSong = LYRICS_DATABASE[Math.floor(Math.random() * LYRICS_DATABASE.length)]
                    setLyrics(randomSong.lyrics)
                  }}
                  className="text-xs px-3 py-1.5 bg-white/10 hover:bg-white/20 border border-white/10 rounded-lg text-white transition-colors"
                  disabled={isGenerating}
                >
                  Randomize Lyrics
                </button>
              </div>
              <textarea
                value={lyrics}
                onChange={(e) => setLyrics(e.target.value.slice(0, 3000))}
                disabled={isGenerating}
                required
                placeholder="[intro]&#10;Your intro...&#10;&#10;[verse]&#10;Verse 1 lyrics here...&#10;&#10;[chorus]&#10;Chorus lyrics here...&#10;&#10;[outro]&#10;Your outro..."
                rows={10}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-white/30 focus:bg-white/10 transition-all resize-none font-mono text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                maxLength={3000}
              />
              <p className="text-xs text-red-400 font-medium">⚠️ Lyrics are mandatory! Use tags: [intro] [verse] [chorus] [bridge] [outro]</p>
              <p className="text-xs text-gray-500">{lyrics.length}/3000 characters</p>
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
                {/* ACE-Step Parameters (only for non-English) */}
                {!isEnglish && (
                  <div className="space-y-4 pb-4 mb-4 border-b border-purple-500/20">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-purple-400 font-semibold text-sm">🎵 ACE-Step Multi-Language Model</span>
                    </div>

                    {/* Audio Length */}
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-2">
                        Audio Length: <span className="text-white">{audioLengthInSeconds}s</span>
                      </label>
                      <input
                        type="range"
                        min="15"
                        max="90"
                        step="5"
                        value={audioLengthInSeconds}
                        onChange={(e) => setAudioLengthInSeconds(parseInt(e.target.value))}
                        className="w-full accent-purple-500"
                        disabled={isGenerating}
                      />
                      <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>15s</span>
                        <span>90s</span>
                      </div>
                    </div>

                    {/* Inference Steps */}
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-2">
                        Inference Steps: <span className="text-white">{numInferenceSteps}</span>
                        <span className="text-gray-500 ml-2">(Higher = Better Quality, Slower)</span>
                      </label>
                      <input
                        type="range"
                        min="25"
                        max="100"
                        step="5"
                        value={numInferenceSteps}
                        onChange={(e) => setNumInferenceSteps(parseInt(e.target.value))}
                        className="w-full accent-purple-500"
                        disabled={isGenerating}
                      />
                      <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>25 (Fast)</span>
                        <span>100 (Best)</span>
                      </div>
                    </div>

                    {/* Guidance Scale */}
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-2">
                        Guidance Scale: <span className="text-white">{guidanceScale.toFixed(1)}</span>
                        <span className="text-gray-500 ml-2">(How closely to follow prompt)</span>
                      </label>
                      <input
                        type="range"
                        min="1"
                        max="15"
                        step="0.5"
                        value={guidanceScale}
                        onChange={(e) => setGuidanceScale(parseFloat(e.target.value))}
                        className="w-full accent-purple-500"
                        disabled={isGenerating}
                      />
                      <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>1 (Creative)</span>
                        <span>15 (Precise)</span>
                      </div>
                    </div>

                    {/* Denoising Strength */}
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-2">
                        Denoising Strength: <span className="text-white">{denoisingStrength.toFixed(2)}</span>
                        <span className="text-gray-500 ml-2">(Audio clarity)</span>
                      </label>
                      <input
                        type="range"
                        min="0.5"
                        max="1"
                        step="0.05"
                        value={denoisingStrength}
                        onChange={(e) => setDenoisingStrength(parseFloat(e.target.value))}
                        className="w-full accent-purple-500"
                        disabled={isGenerating}
                      />
                      <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>0.5 (Softer)</span>
                        <span>1.0 (Cleaner)</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Music Parameters (only for English) */}
                {isEnglish && (
                  <div className="pb-4 mb-4 border-b border-white/10">
                    <div className="flex items-center gap-2 mb-4">
                      <span className="text-pink-400 font-semibold text-sm">🎵 AI Music (English)</span>
                    </div>
                  </div>
                )}

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

