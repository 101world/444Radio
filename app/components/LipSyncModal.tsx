'use client'

import { useState, useRef, useEffect } from 'react'
import { X, Upload, Mic, Scissors, Loader2, Image as ImageIcon, Music2, Sparkles, Zap, Video } from 'lucide-react'
import { trimAudio } from '@/lib/media-trimmer'
import { useGenerationQueue } from '../contexts/GenerationQueueContext'

interface LipSyncModalProps {
  isOpen: boolean
  onClose: () => void
  userCredits?: number
  onSuccess?: (videoUrl: string, prompt: string, mediaId: string | null) => void
  onGenerationStart?: (prompt: string, generationId: string) => void
  authToken?: string
}

/**
 * Credit cost for Wan 2.6 I2V Lip-Sync Generation
 * 1 credit = $0.035 | 50% profit margin (charge = cost × 1.5)
 *
 * Replicate per-second cost by resolution:
 *   Resolution │ Cost/second
 *   ───────────┼─────────────
 *     480p     │  $0.07/s
 *     720p     │  $0.10/s
 *    1080p     │  $0.15/s
 *
 * Credits formula: (duration × cost_per_second × 1.5) ÷ 0.035
 *
 *   Resolution │  3s │  5s │  7s │ 10s
 *   ───────────┼─────┼─────┼─────┼─────
 *     480p     │  10 │  16 │  22 │  31
 *     720p     │  13 │  22 │  31 │  43
 *    1080p     │  20 │  33 │  46 │  65
 */
const REPLICATE_COST_PER_SECOND: Record<string, number> = {
  '480p': 0.07,
  '720p': 0.10,
  '1080p': 0.15,
}
const PROFIT_MARGIN = 1.5
const CREDIT_VALUE = 0.035

function calcCredits(duration: number, resolution: string): number {
  const costPerSec = REPLICATE_COST_PER_SECOND[resolution] || REPLICATE_COST_PER_SECOND['720p']
  const chargePerSec = costPerSec * PROFIT_MARGIN
  return Math.ceil((duration * chargePerSec) / CREDIT_VALUE)
}

export default function LipSyncModal({
  isOpen,
  onClose,
  userCredits,
  onSuccess,
  onGenerationStart,
  authToken,
}: LipSyncModalProps) {
  const { addGeneration, updateGeneration } = useGenerationQueue()

  // Form state
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [audioPreview, setAudioPreview] = useState<string | null>(null)
  const [resolution, setResolution] = useState<'480p' | '720p' | '1080p'>('720p')

  // Trimming state
  const [audioDuration, setAudioDuration] = useState(0)
  const [audioStartTime, setAudioStartTime] = useState(0)
  const [audioEndTime, setAudioEndTime] = useState(10)

  // Generation state
  const [isGenerating, setIsGenerating] = useState(false)
  const [statusMsg, setStatusMsg] = useState('')

  const imageInputRef = useRef<HTMLInputElement>(null)
  const audioInputRef = useRef<HTMLInputElement>(null)
  const audioElementRef = useRef<HTMLAudioElement>(null)

  // Max duration is 10 seconds
  const MAX_DURATION = 10

  // Handle image upload
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      alert('Please select a valid image file')
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      alert('Image must be under 10 MB')
      return
    }

    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  // Handle audio upload
  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('audio/')) {
      alert('Please select a valid audio file')
      return
    }

    if (file.size > 50 * 1024 * 1024) {
      alert('Audio must be under 50 MB')
      return
    }

    setAudioFile(file)
    const url = URL.createObjectURL(file)
    setAudioPreview(url)

    // Get audio duration
    const audio = new Audio(url)
    audio.addEventListener('loadedmetadata', () => {
      const duration = audio.duration
      setAudioDuration(duration)
      setAudioStartTime(0)
      setAudioEndTime(Math.min(duration, MAX_DURATION))
    })
  }

  // Upload media files via API
  const uploadMediaFiles = async () => {
    if (!imageFile || !audioFile) {
      throw new Error('Both image and audio files are required')
    }

    setStatusMsg('Uploading media files...')

    // Trim audio if needed
    let audioToUpload = audioFile
    const trimDuration = audioEndTime - audioStartTime

    if (audioStartTime > 0 || trimDuration < audioDuration) {
      setStatusMsg('Trimming audio...')
      const trimmedBlob = await trimAudio(audioFile, audioStartTime, audioEndTime)
      audioToUpload = new File([trimmedBlob], `trimmed-${audioFile.name}`, { type: audioFile.type })
    }

    // Upload via API
    const formData = new FormData()
    formData.append('image', imageFile)
    formData.append('audio', audioToUpload)

    const headers: Record<string, string> = {}
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`

    const response = await fetch('/api/upload/lipsync', {
      method: 'POST',
      headers,
      body: formData,
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Upload failed')
    }

    const data = await response.json()
    return {
      imageUrl: data.imageUrl,
      audioUrl: data.audioUrl,
    }
  }

  // Generate lip-sync video
  const handleGenerate = async () => {
    if (!imageFile || !audioFile) {
      alert('Please upload both an image and audio file')
      return
    }

    const trimDuration = audioEndTime - audioStartTime
    if (trimDuration > MAX_DURATION) {
      alert(`Audio duration cannot exceed ${MAX_DURATION} seconds`)
      return
    }

    const creditCost = calcCredits(trimDuration, resolution)
    if (userCredits !== undefined && userCredits < creditCost) {
      alert(`⚡ You need ${creditCost} credits for this generation (you have ${userCredits})`)
      return
    }

    setIsGenerating(true)
    setStatusMsg('Preparing...')

    // Add to persistent generation queue
    const generationId = addGeneration({
      type: 'lipsync',
      prompt: 'Lip-sync video generation',
      title: `Lip-sync: ${imageFile.name}`,
    })
    updateGeneration(generationId, { status: 'generating', progress: 5 })

    // Notify parent to show progress bar in chat
    if (onGenerationStart) {
      onGenerationStart('Lip-sync video generation', generationId)
      onClose()
    }

    try {
      // Upload files
      updateGeneration(generationId, { progress: 20 })
      const { imageUrl, audioUrl } = await uploadMediaFiles()

      updateGeneration(generationId, { progress: 40, status: 'Generating lip-sync...' })
      setStatusMsg('Generating lip-sync video...')

      // Call generation API with NDJSON streaming
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (authToken) headers['Authorization'] = `Bearer ${authToken}`

      const response = await fetch('/api/generate/lipsync', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          imageUrl,
          audioUrl,
          resolution,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Generation failed')
      }

      // Process NDJSON stream
      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (reader) {
        let buffer = ''
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (line.trim()) {
              try {
                const data = JSON.parse(line)

                if (data.status) {
                  setStatusMsg(data.status)
                  updateGeneration(generationId, { status: data.status })
                }

                if (data.progress !== undefined) {
                  updateGeneration(generationId, { progress: 40 + (data.progress * 0.6) })
                }

                if (data.error) {
                  throw new Error(data.error)
                }

                if (data.success && data.videoUrl) {
                  setStatusMsg('Complete!')
                  updateGeneration(generationId, {
                    status: 'completed',
                    progress: 100,
                    result: {
                      videoUrl: data.videoUrl,
                      mediaId: data.mediaId,
                    },
                  })

                  if (onSuccess) {
                    onSuccess(data.videoUrl, 'Lip-sync video', data.mediaId || null)
                  }

                  alert(`✨ Lip-sync video generated! ${data.creditsRemaining} credits remaining`)
                  return
                }
              } catch (parseError) {
                console.error('Parse error:', parseError)
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Generation error:', error)
      updateGeneration(generationId, {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      })
      alert(error instanceof Error ? error.message : 'Failed to generate lip-sync video')
    } finally {
      setIsGenerating(false)
      setStatusMsg('')
    }
  }

  // Calculate current credit cost
  const trimDuration = audioEndTime - audioStartTime
  const creditCost = calcCredits(trimDuration, resolution)
  const canGenerate = imageFile && audioFile && trimDuration <= MAX_DURATION && !isGenerating

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fadeIn">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={!isGenerating ? onClose : undefined}
      />

      {/* Modal - Glassmorphism */}
      <div className="relative w-full max-w-4xl max-h-[90vh] overflow-hidden">
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl shadow-purple-500/20">
          
          {/* Header */}
          <div className="relative flex items-center justify-between p-6 border-b border-white/10 bg-gradient-to-r from-purple-500/10 via-pink-500/10 to-purple-500/10">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl shadow-lg shadow-purple-500/50">
                <Mic className="text-white" size={24} />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                  Lip-Sync Generator
                  <Sparkles className="text-purple-400" size={20} />
                </h2>
                <p className="text-sm text-gray-400">Make any photo sing with AI magic</p>
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
          <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-200px)]">
            
            {/* Upload Section */}
            <div className="grid md:grid-cols-2 gap-6">
              
              {/* Image Upload */}
              <div className="space-y-3">
                <label className="block text-sm font-semibold text-white flex items-center gap-2">
                  <ImageIcon size={16} className="text-purple-400" />
                  Upload Photo
                </label>
                
                <button
                  onClick={() => imageInputRef.current?.click()}
                  disabled={isGenerating}
                  className="w-full h-48 border-2 border-dashed border-white/20 rounded-xl hover:border-purple-500/50 hover:bg-white/5 transition-all flex flex-col items-center justify-center gap-3 group disabled:opacity-50"
                >
                  {imagePreview ? (
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="w-full h-full object-cover rounded-xl"
                    />
                  ) : (
                    <>
                      <div className="p-3 bg-white/10 rounded-xl group-hover:bg-purple-500/20 transition-colors">
                        <Upload className="text-gray-400 group-hover:text-purple-400" size={32} />
                      </div>
                      <div className="text-center">
                        <p className="text-white font-medium">Click to upload</p>
                        <p className="text-xs text-gray-400">PNG, JPG up to 10MB</p>
                      </div>
                    </>
                  )}
                </button>
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </div>

              {/* Audio Upload */}
              <div className="space-y-3">
                <label className="block text-sm font-semibold text-white flex items-center gap-2">
                  <Music2 size={16} className="text-pink-400" />
                  Upload Audio
                </label>
                
                <button
                  onClick={() => audioInputRef.current?.click()}
                  disabled={isGenerating}
                  className="w-full h-48 border-2 border-dashed border-white/20 rounded-xl hover:border-pink-500/50 hover:bg-white/5 transition-all flex flex-col items-center justify-center gap-3 group disabled:opacity-50"
                >
                  {audioFile ? (
                    <div className="flex flex-col items-center gap-3 p-4">
                      <div className="p-3 bg-pink-500/20 rounded-xl">
                        <Music2 className="text-pink-400" size={32} />
                      </div>
                      <div className="text-center">
                        <p className="text-white font-medium truncate max-w-xs">{audioFile.name}</p>
                        <p className="text-xs text-gray-400">{audioDuration.toFixed(1)}s</p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="p-3 bg-white/10 rounded-xl group-hover:bg-pink-500/20 transition-colors">
                        <Upload className="text-gray-400 group-hover:text-pink-400" size={32} />
                      </div>
                      <div className="text-center">
                        <p className="text-white font-medium">Click to upload</p>
                        <p className="text-xs text-gray-400">MP3, WAV up to 50MB</p>
                      </div>
                    </>
                  )}
                </button>
                <input
                  ref={audioInputRef}
                  type="file"
                  accept="audio/*"
                  onChange={handleAudioUpload}
                  className="hidden"
                />
              </div>
            </div>

            {/* Audio Trimming */}
            {audioFile && audioDuration > 0 && (
              <div className="p-5 bg-white/5 border border-white/10 rounded-xl space-y-4">
                <div className="flex items-center gap-2 text-white font-semibold">
                  <Scissors size={18} className="text-cyan-400" />
                  <span>Trim Audio (Max {MAX_DURATION}s)</span>
                </div>

                {/* Audio Player */}
                {audioPreview && (
                  <audio ref={audioElementRef} src={audioPreview} className="w-full" controls />
                )}

                {/* Start Time */}
                <div>
                  <label className="block text-sm text-gray-400 mb-2">
                    Start Time: <span className="text-white font-mono">{audioStartTime.toFixed(1)}s</span>
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={Math.max(0, audioEndTime - 0.1)}
                    step={0.1}
                    value={audioStartTime}
                    onChange={(e) => setAudioStartTime(Number(e.target.value))}
                    className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                    disabled={isGenerating}
                  />
                </div>

                {/* End Time */}
                <div>
                  <label className="block text-sm text-gray-400 mb-2">
                    End Time: <span className="text-white font-mono">{audioEndTime.toFixed(1)}s</span>
                  </label>
                  <input
                    type="range"
                    min={Math.min(audioStartTime + 0.1, audioDuration)}
                    max={Math.min(audioDuration, audioStartTime + MAX_DURATION)}
                    step={0.1}
                    value={audioEndTime}
                    onChange={(e) => setAudioEndTime(Number(e.target.value))}
                    className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                    disabled={isGenerating}
                  />
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Duration:</span>
                  <span className="text-white font-mono font-bold">{trimDuration.toFixed(1)}s</span>
                </div>
              </div>
            )}

            {/* Resolution Selector */}
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-white flex items-center gap-2">
                <Video size={16} className="text-cyan-400" />
                Output Resolution
              </label>
              <div className="grid grid-cols-3 gap-3">
                {(['480p', '720p', '1080p'] as const).map((res) => (
                  <button
                    key={res}
                    onClick={() => setResolution(res)}
                    disabled={isGenerating}
                    className={`p-4 rounded-xl border-2 transition-all font-semibold ${
                      resolution === res
                        ? 'bg-gradient-to-br from-purple-500/20 to-pink-500/20 border-purple-500 text-white shadow-lg shadow-purple-500/20'
                        : 'bg-white/5 border-white/10 text-gray-400 hover:border-white/30 hover:text-white'
                    }`}
                  >
                    {res}
                  </button>
                ))}
              </div>
            </div>

            {/* Cost Display */}
            <div className="p-5 bg-gradient-to-r from-purple-500/10 via-pink-500/10 to-purple-500/10 border border-purple-500/30 rounded-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="text-yellow-400" size={20} />
                  <span className="text-white font-semibold">Credit Cost</span>
                </div>
                <span className="text-2xl font-bold text-white">{creditCost}</span>
              </div>
              {userCredits !== undefined && (
                <div className="mt-2 text-sm text-gray-400">
                  Your balance: <span className="text-white font-semibold">{userCredits} credits</span>
                </div>
              )}
            </div>

            {/* Status Message */}
            {statusMsg && (
              <div className="p-4 bg-cyan-500/10 border border-cyan-500/30 rounded-xl text-cyan-400 text-center font-medium flex items-center justify-center gap-2">
                <Loader2 className="animate-spin" size={18} />
                {statusMsg}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-white/10 bg-white/5">
            <button
              onClick={handleGenerate}
              disabled={!canGenerate}
              className="w-full py-4 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 disabled:from-gray-600 disabled:to-gray-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-purple-500/30 disabled:shadow-none flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="animate-spin" size={20} />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles size={20} />
                  Generate Lip-Sync Video
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
