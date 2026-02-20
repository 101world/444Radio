'use client'

import { useState, useRef, useEffect } from 'react'
import { X, Upload, Scissors, Image as ImageIcon, Music, Loader2, Zap } from 'lucide-react'
import { uploadToR2 } from '@/lib/r2-upload'
import { trimMediaWithFallback } from '@/lib/media-trimmer'

interface LipSyncModalProps {
  isOpen: boolean
  onClose: () => void
  userCredits: number
  onSuccess?: (videoUrl: string) => void
}

interface TrimRange {
  start: number
  end: number
}

export default function LipSyncModal({ isOpen, onClose, userCredits, onSuccess }: LipSyncModalProps) {
  // Upload states
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)

  // Trim states
  const [audioTrimRange, setAudioTrimRange] = useState<TrimRange>({ start: 0, end: 10 })
  const [audioDuration, setAudioDuration] = useState<number>(0)
  const [audioCurrentTime, setAudioCurrentTime] = useState<number>(0)

  // Generation states
  const [resolution, setResolution] = useState<'480p' | '720p' | '1080p'>('720p')
  const [multiShots, setMultiShots] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [generationProgress, setGenerationProgress] = useState<string>('')

  // Refs for media elements
  const audioRef = useRef<HTMLAudioElement>(null)

  // Calculate duration (max 10s)
  const effectiveDuration = Math.min(audioTrimRange.end - audioTrimRange.start, 10)

  // Calculate credit cost based on resolution
  // 720p = $0.10/s × 1.5 markup / $0.035 per credit = 4.29 → 5 credits/s
  // 1080p = $0.15/s × 1.5 markup / $0.035 per credit = 6.43 → 7 credits/s
  const creditCosts: Record<string, number[]> = {
    '480p': [6, 9, 12, 15, 18, 21, 24, 27, 30],  // 2-10s: 3 credits/s
    '720p': [10, 15, 20, 25, 30, 35, 40, 45, 50],  // 5 credits/s
    '1080p': [14, 21, 28, 35, 42, 49, 56, 63, 70],  // 7 credits/s
  }
  const creditCost = creditCosts[resolution][Math.max(0, Math.ceil(effectiveDuration) - 2)] || 50

  // Handle image upload
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && file.type.startsWith('image/')) {
      setImageFile(file)
      const url = URL.createObjectURL(file)
      setImageUrl(url)
    }
  }

  // Handle audio upload
  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && file.type.startsWith('audio/')) {
      setAudioFile(file)
      const url = URL.createObjectURL(file)
      setAudioUrl(url)
    }
  }

  // Load audio metadata
  useEffect(() => {
    if (audioRef.current && audioUrl) {
      const audio = audioRef.current
      audio.addEventListener('loadedmetadata', () => {
        const duration = Math.min(audio.duration, 10)
        setAudioDuration(duration)
        setAudioTrimRange({ start: 0, end: duration })
      })
      audio.addEventListener('timeupdate', () => {
        setAudioCurrentTime(audio.currentTime)
      })
    }
  }, [audioUrl])

  // Trim audio to range
  const setAudioStartTime = (time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time
    }
  }

  // Upload media to R2 and get public URLs
  const uploadMediaFiles = async (): Promise<{ imageUrl: string; audioUrl: string } | null> => {
    if (!imageFile || !audioFile) return null

    setIsUploading(true)
    try {
      // Trim audio to selected range
      setGenerationProgress('Trimming audio...')
      const trimmedAudio = await trimMediaWithFallback(
        audioFile,
        audioTrimRange.start,
        audioTrimRange.end,
        'audio'
      )

      // Upload image
      setGenerationProgress('Uploading image...')
      const imageBuffer = Buffer.from(await imageFile.arrayBuffer())
      const imageExt = imageFile.name.split('.').pop() || 'jpg'
      const imageKey = `lipsync/image-${Date.now()}.${imageExt}`
      const imageUpload = await uploadToR2(imageBuffer, 'images', imageKey, imageFile.type || 'image/jpeg')
      if (!imageUpload.success || !imageUpload.url) {
        throw new Error('Failed to upload image')
      }

      // Upload audio
      setGenerationProgress('Uploading audio...')
      const audioBuffer = Buffer.from(await trimmedAudio.arrayBuffer())
      const audioKey = `lipsync/audio-${Date.now()}.${trimmedAudio.name.endsWith('.wav') ? 'wav' : 'mp3'}`
      const audioUpload = await uploadToR2(audioBuffer, 'audio-files', audioKey, trimmedAudio.type || 'audio/mpeg')
      if (!audioUpload.success || !audioUpload.url) {
        throw new Error('Failed to upload audio')
      }

      return {
        imageUrl: imageUpload.url,
        audioUrl: audioUpload.url,
      }
    } catch (error) {
      console.error('Upload error:', error)
      alert('Failed to upload files. Please try again.')
      return null
    } finally {
      setIsUploading(false)
    }
  }

  // Generate lip-sync video
  const handleGenerate = async () => {
    if (!imageFile || !audioFile) {
      alert('Please upload both image and audio files')
      return
    }

    if (userCredits < creditCost) {
      alert(`⚡ You need ${creditCost} credits for this generation. You have ${userCredits} credits.`)
      return
    }

    setIsGenerating(true)
    setGenerationProgress('Uploading files...')

    try {
      // Upload files to R2
      const uploadedUrls = await uploadMediaFiles()
      if (!uploadedUrls) {
        throw new Error('Failed to upload media files')
      }

      setGenerationProgress('Starting lip-sync generation...')

      // Call generation API with streaming
      const response = await fetch('/api/generate/lipsync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl: uploadedUrls.imageUrl,
          audioUrl: uploadedUrls.audioUrl,
          duration: Math.ceil(effectiveDuration),
          resolution,
          multiShots,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Generation failed')
      }

      // Read NDJSON stream
      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      if (!reader) throw new Error('No response stream')

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
              
              if (data.status === 'processing') {
                setGenerationProgress(data.message || 'Generating...')
              } else if (data.status === 'uploading') {
                setGenerationProgress('Saving to storage...')
              } else if (data.status === 'complete') {
                setGenerationProgress('Complete!')
                alert('🎤 Lip-sync video generated successfully!')
                if (onSuccess && data.videoUrl) {
                  onSuccess(data.videoUrl)
                }
                onClose()
              } else if (data.status === 'error') {
                throw new Error(data.message || 'Generation failed')
              }
            } catch (parseError) {
              console.error('Parse error:', parseError)
            }
          }
        }
      }

    } catch (error) {
      console.error('Generation error:', error)
      alert(`Generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsGenerating(false)
      setGenerationProgress('')
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-5xl bg-gradient-to-br from-slate-900 via-purple-950/50 to-slate-900 rounded-2xl border border-purple-500/30 shadow-2xl shadow-purple-500/20 my-8">
        
        {!isGenerating && !isUploading && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-purple-400 hover:text-purple-300 transition-colors z-10"
          >
            <X size={24} />
          </button>
        )}

        <div className="p-8 max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center gap-4 mb-6">
            <div className="p-4 bg-purple-500/20 rounded-full">
              <ImageIcon size={32} className="text-purple-400" />
            </div>
            <div>
              <h2 className="text-3xl font-bold text-purple-400">Lip-Sync Generator</h2>
              <p className="text-purple-400/60 text-sm">Upload image + audio • Powered by Wan 2.6 I2V • Max 10 seconds</p>
            </div>
          </div>

          {/* Credit Cost Display */}
          <div className="mb-6 p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap size={20} className="text-yellow-400" />
                <span className="text-purple-400 font-semibold">
                  Cost: {creditCost} credits ({effectiveDuration.toFixed(1)}s • {resolution})
                </span>
              </div>
              <div className="text-purple-400/60 text-sm">
                Available: {userCredits} credits
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Image Upload */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-3">
                <ImageIcon size={20} className="text-purple-400" />
                <h3 className="text-lg font-semibold text-purple-400">Image Upload</h3>
              </div>

              {!imageUrl ? (
                <label className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-purple-500/30 rounded-lg cursor-pointer hover:border-purple-500/50 transition-colors bg-purple-500/5">
                  <Upload size={48} className="text-purple-400/50 mb-2" />
                  <span className="text-purple-400 text-sm">Click to upload image/photo</span>
                  <span className="text-purple-400/40 text-xs mt-1">JPG, PNG, WebP</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                    disabled={isGenerating || isUploading}
                  />
                </label>
              ) : (
                <div className="space-y-3">
                  <div className="w-full h-64 rounded-lg bg-black overflow-hidden flex items-center justify-center">
                    <img
                      src={imageUrl}
                      alt="Uploaded"
                      className="max-w-full max-h-full object-contain"
                    />
                  </div>

                  <button
                    onClick={() => {
                      setImageFile(null)
                      setImageUrl(null)
                      if (imageUrl) URL.revokeObjectURL(imageUrl)
                    }}
                    className="w-full px-4 py-2 text-sm text-purple-400 border border-purple-500/30 rounded-lg hover:bg-purple-500/10 transition-colors"
                    disabled={isGenerating || isUploading}
                  >
                    Change Image
                  </button>
                </div>
              )}
            </div>

            {/* Audio Upload & Trim */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-3">
                <Music size={20} className="text-purple-400" />
                <h3 className="text-lg font-semibold text-purple-400">Audio Upload</h3>
              </div>

              {!audioUrl ? (
                <label className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-purple-500/30 rounded-lg cursor-pointer hover:border-purple-500/50 transition-colors bg-purple-500/5">
                  <Upload size={48} className="text-purple-400/50 mb-2" />
                  <span className="text-purple-400 text-sm">Click to upload audio</span>
                  <span className="text-purple-400/40 text-xs mt-1">MP3, WAV, OGG (max 10s)</span>
                  <input
                    type="file"
                    accept="audio/*"
                    onChange={handleAudioUpload}
                    className="hidden"
                    disabled={isGenerating || isUploading}
                  />
                </label>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-center h-32 bg-purple-500/10 border border-purple-500/20 rounded-lg">
                    <audio
                      ref={audioRef}
                      src={audioUrl}
                      controls
                      className="w-full px-4"
                    />
                  </div>
                  
                  {/* Audio Trim Controls */}
                  <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-lg space-y-3">
                    <div className="flex items-center gap-2">
                      <Scissors size={16} className="text-purple-400" />
                      <span className="text-sm font-medium text-purple-400">Trim Audio</span>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <label className="text-xs text-purple-400/70 w-12">Start:</label>
                        <input
                          type="range"
                          min="0"
                          max={audioDuration}
                          step="0.1"
                          value={audioTrimRange.start}
                          onChange={(e) => {
                            const start = parseFloat(e.target.value)
                            setAudioTrimRange({ ...audioTrimRange, start })
                            setAudioStartTime(start)
                          }}
                          className="flex-1"
                          disabled={isGenerating || isUploading}
                        />
                        <span className="text-xs text-purple-400 w-12">{audioTrimRange.start.toFixed(1)}s</span>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <label className="text-xs text-purple-400/70 w-12">End:</label>
                        <input
                          type="range"
                          min={audioTrimRange.start}
                          max={Math.min(audioDuration, audioTrimRange.start + 10)}
                          step="0.1"
                          value={audioTrimRange.end}
                          onChange={(e) => setAudioTrimRange({ ...audioTrimRange, end: parseFloat(e.target.value) })}
                          className="flex-1"
                          disabled={isGenerating || isUploading}
                        />
                        <span className="text-xs text-purple-400 w-12">{audioTrimRange.end.toFixed(1)}s</span>
                      </div>
                    </div>
                    
                    <div className="text-xs text-purple-400/60 text-center">
                      Duration: {(audioTrimRange.end - audioTrimRange.start).toFixed(1)}s
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setAudioFile(null)
                      setAudioUrl(null)
                      if (audioUrl) URL.revokeObjectURL(audioUrl)
                    }}
                    className="w-full px-4 py-2 text-sm text-purple-400 border border-purple-500/30 rounded-lg hover:bg-purple-500/10 transition-colors"
                    disabled={isGenerating || isUploading}
                  >
                    Change Audio
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Generation Options */}
          {imageUrl && audioUrl && (
            <div className="mb-6 p-6 rounded-xl border border-purple-500/20 bg-black/40 space-y-6">
              <h3 className="text-lg font-semibold text-purple-400">Generation Options</h3>
              
              {/* Resolution */}
              <div>
                <label className="block text-sm text-purple-400/80 mb-3">Resolution</label>
                <div className="grid grid-cols-3 gap-3">
                  {(['480p', '720p', '1080p'] as const).map((res) => (
                    <button
                      key={res}
                      onClick={() => setResolution(res)}
                      disabled={isGenerating || isUploading}
                      className={`p-3 rounded-lg border-2 transition-all ${
                        resolution === res
                          ? 'border-purple-500 bg-purple-500/20'
                          : 'border-purple-500/30 bg-purple-500/5 hover:border-purple-500/50'
                      } disabled:opacity-50`}
                    >
                      <div className="text-base font-bold text-purple-400">{res}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Advanced Options */}
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="multiShots"
                  checked={multiShots}
                  onChange={(e) => setMultiShots(e.target.checked)}
                  disabled={isGenerating || isUploading}
                  className="w-4 h-4 rounded border-purple-500/30 bg-purple-500/10 text-purple-500 focus:ring-2 focus:ring-purple-500"
                />
                <label htmlFor="multiShots" className="text-sm text-purple-400">
                  Enable multi-shot generation (experimental)
                </label>
              </div>
            </div>
          )}

          {/* Generate Button */}
          <button
            onClick={handleGenerate}
            disabled={!imageUrl || !audioUrl || isGenerating || isUploading || userCredits < creditCost}
            className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isUploading ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                Uploading files...
              </>
            ) : isGenerating ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                {generationProgress || 'Generating...'}
              </>
            ) : (
              <>
                <Zap size={20} />
                Generate Lip-Sync Video ({creditCost} credits)
              </>
            )}
          </button>

          {/* Info */}
          <div className="mt-4 text-xs text-purple-400/50 text-center">
            The AI will sync the uploaded image to lip-sync with the audio. Generation takes 40-60 seconds.
          </div>
        </div>
      </div>
    </div>
  )
}
