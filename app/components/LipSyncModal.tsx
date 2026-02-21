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
 * IMPORTANT: Replicate bills in FIXED intervals of 5s, 10s, or 15s
 * Even if you request 2s, you get charged for 5s minimum
 *
 * Replicate per-second cost by resolution (Wan 2.6 I2V only supports 720p and 1080p):
 *   Resolution │ Cost/second
 *   ───────────┼─────────────
 *     720p     │  $0.10/s
 *    1080p     │  $0.15/s
 *
 * Credits formula: (duration × cost_per_second × 1.5) ÷ 0.035
 *
 *   Resolution │  5s │ 10s │ 15s
 *   ───────────┼─────┼─────┼─────
 *     720p     │  22 │  43 │  65
 *    1080p     │  33 │  65 │  98
 */
const REPLICATE_COST_PER_SECOND: Record<string, number> = {
  '720p': 0.10,
  '1080p': 0.15,
}
const PROFIT_MARGIN = 1.5
const CREDIT_VALUE = 0.035

// Fixed duration options (Replicate billing tiers)
const DURATION_OPTIONS = [5, 10, 15] as const
type DurationOption = typeof DURATION_OPTIONS[number]

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
  const [resolution, setResolution] = useState<'720p' | '1080p'>('720p')
  const [duration, setDuration] = useState<DurationOption>(5)

  // Trimming state (for audio cutting only)
  const [audioDuration, setAudioDuration] = useState(0)
  const [audioStartTime, setAudioStartTime] = useState(0)
  const [audioEndTime, setAudioEndTime] = useState(5)

  // Generation state
  const [isGenerating, setIsGenerating] = useState(false)
  const [statusMsg, setStatusMsg] = useState('')

  const imageInputRef = useRef<HTMLInputElement>(null)
  const audioInputRef = useRef<HTMLInputElement>(null)
  const audioElementRef = useRef<HTMLAudioElement>(null)

  // Max duration is based on selected duration option
  const MAX_DURATION = duration

  // Computed trim duration
  const trimDuration = audioEndTime - audioStartTime

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
      const fileDuration = audio.duration
      setAudioDuration(fileDuration)
      setAudioStartTime(0)
      setAudioEndTime(Math.min(fileDuration, duration))
    })
  }

  // Update end time when duration option changes
  useEffect(() => {
    if (audioDuration > 0) {
      setAudioEndTime(Math.min(audioDuration, audioStartTime + duration))
    }
  }, [duration, audioDuration, audioStartTime])

  // Upload media files via API
  const uploadMediaFiles = async () => {
    if (!imageFile || !audioFile) {
      throw new Error('Both image and audio files are required')
    }

    console.log('📤 Starting upload process...')
    setStatusMsg('Uploading media files...')

    // Trim audio if needed
    let audioToUpload = audioFile
    const trimDuration = audioEndTime - audioStartTime

    if (audioStartTime > 0 || trimDuration < audioDuration) {
      console.log('✂️ Trimming audio from', audioStartTime, 'to', audioEndTime)
      setStatusMsg('Trimming audio...')
      try {
        const trimmedBlob = await trimAudio(audioFile, audioStartTime, audioEndTime)
        audioToUpload = new File([trimmedBlob], `trimmed-${audioFile.name}`, { type: audioFile.type })
        console.log('✅ Audio trimmed successfully, size:', trimmedBlob.size, 'bytes')
      } catch (trimError) {
        console.error('❌ Audio trim failed:', trimError)
        throw new Error('Failed to trim audio: ' + (trimError instanceof Error ? trimError.message : 'Unknown error'))
      }
    }

    // Upload via API
    console.log('📤 Uploading to /api/upload/lipsync...')
    const formData = new FormData()
    formData.append('image', imageFile)
    formData.append('audio', audioToUpload)

    const headers: Record<string, string> = {}
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`

    try {
      const response = await fetch('/api/upload/lipsync', {
        method: 'POST',
        headers,
        body: formData,
      })

      console.log('📥 Upload response status:', response.status)

      if (!response.ok) {
        const error = await response.json()
        console.error('❌ Upload failed:', error)
        throw new Error(error.error || 'Upload failed')
      }

      const data = await response.json()
      console.log('✅ Upload successful:', data)
      
      return {
        imageUrl: data.imageUrl,
        audioUrl: data.audioUrl,
      }
    } catch (fetchError) {
      console.error('❌ Upload request failed:', fetchError)
      throw fetchError
    }
  }

  // Generate lip-sync video
  const handleGenerate = async () => {
    console.log('🎬 Generate button clicked')
    
    if (!imageFile || !audioFile) {
      console.error('❌ Missing files:', { imageFile: !!imageFile, audioFile: !!audioFile })
      alert('Please upload both an image and audio file')
      return
    }

    const trimDuration = audioEndTime - audioStartTime
    console.log('⏱️ Trim duration:', trimDuration, 'seconds')
    
    if (trimDuration > duration) {
      alert(`Audio segment cannot exceed ${duration} seconds`)
      return
    }

    const creditCost = calcCredits(duration, resolution)
    console.log('💰 Credit cost:', creditCost, 'credits')
    
    if (userCredits !== undefined && userCredits < creditCost) {
      alert(`⚡ You need ${creditCost} credits for this generation (you have ${userCredits})`)
      return
    }

    console.log('✅ All checks passed, starting generation...')
    setIsGenerating(true)
    setStatusMsg('Preparing...')

    // Add to persistent generation queue
    const generationId = addGeneration({
      type: 'lipsync',
      prompt: `Lip-sync video (${duration}s ${resolution})`,
      title: `Lip-sync: ${imageFile.name}`,
    })
    console.log('📝 Generation ID:', generationId)
    updateGeneration(generationId, { status: 'generating', progress: 5 })

    // Notify parent to show progress bar in chat and close modal immediately
    if (onGenerationStart) {
      onGenerationStart(`Lip-sync video (${duration}s ${resolution})`, generationId)
    }
    
    // Close modal immediately so user can navigate
    onClose()

    try {
      // Upload files
      console.log('📤 Step 1: Uploading files...')
      updateGeneration(generationId, { progress: 20 })
      const { imageUrl, audioUrl } = await uploadMediaFiles()
      console.log('✅ Files uploaded:', { imageUrl, audioUrl })

      updateGeneration(generationId, { progress: 40, status: 'Generating lip-sync...' })
      setStatusMsg('Generating lip-sync video...')

      // Call generation API with NDJSON streaming
      console.log('🎬 Step 2: Calling generation API...')
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (authToken) headers['Authorization'] = `Bearer ${authToken}`

      const response = await fetch('/api/generate/lipsync', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          imageUrl,
          audioUrl,
          duration,  // Use the fixed duration option (5, 10, or 15)
          resolution,
        }),
      })

      console.log('📥 Generation API response status:', response.status)

      if (!response.ok) {
        const error = await response.json()
        console.error('❌ Generation API failed:', error)
        throw new Error(error.error || 'Generation failed')
      }

      console.log('✅ Generation started, processing stream...')

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
                console.log('📨 Stream data:', data)

                if (data.status) {
                  setStatusMsg(data.status)
                  updateGeneration(generationId, { status: data.status })
                }

                if (data.progress !== undefined) {
                  updateGeneration(generationId, { progress: 40 + (data.progress * 0.6) })
                }

                if (data.error) {
                  console.error('❌ Stream error:', data.error)
                  throw new Error(data.error)
                }

                // Check for completion - API sends status: 'complete', not success: true
                if ((data.status === 'complete' || data.success) && data.videoUrl) {
                  console.log('✨ Generation complete!', data)
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
                    console.log('📢 Calling onSuccess callback with:', {
                      videoUrl: data.videoUrl,
                      prompt: `Lip-sync video (${duration}s ${resolution})`,
                      mediaId: data.mediaId || null
                    })
                    onSuccess(data.videoUrl, `Lip-sync video (${duration}s ${resolution})`, data.mediaId || null)
                  } else {
                    console.warn('⚠️ onSuccess callback not provided!')
                  }

                  // Don't show alert - queue system will handle notification
                  console.log(`✅ Lip-sync video generated! Media ID: ${data.mediaId}`)
                  return
                }
              } catch (parseError) {
                console.error('⚠️ Parse error:', parseError, 'Line:', line)
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('💥 Generation error:', error)
      updateGeneration(generationId, {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      })
      // Don't show alert - error will be visible in queue
      console.error('Failed to generate lip-sync video:', error)
    } finally {
      console.log('🏁 Generation process completed')
      setIsGenerating(false)
      setStatusMsg('')
    }
  }

  // Calculate current credit cost (use fixed duration, not trim duration)
  const creditCost = calcCredits(duration, resolution)
  const canGenerate = imageFile && audioFile && !isGenerating

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

              {/* Photo Quality Tip */}
              {imageFile && (
                <div className="p-4 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/30 rounded-xl">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-cyan-500/20 rounded-lg shrink-0">
                      <Sparkles className="text-cyan-400" size={18} />
                    </div>
                    <div className="text-sm">
                      <div className="text-white font-semibold mb-1">💡 Best Results Tip</div>
                      <p className="text-gray-300 leading-relaxed">
                        Upload a <span className="text-cyan-400 font-semibold">clear, well-lit photo</span> showing the <span className="text-cyan-400 font-semibold">full face, facing forward</span>. Avoid blurry images, extreme angles, or obstructed faces for optimal lip-sync quality.
                      </p>
                    </div>
                  </div>
                </div>
              )}

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
              <div className="p-5 bg-gradient-to-br from-white/5 to-white/10 border border-white/10 rounded-xl space-y-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-white font-semibold">
                    <Scissors size={18} className="text-cyan-400" />
                    <span>Precise Audio Trimmer</span>
                  </div>
                  <div className="text-xs text-gray-400">Max: {MAX_DURATION}s output</div>
                </div>

                {/* Audio Player with Controls */}
                {audioPreview && (
                  <div className="relative">
                    <audio 
                      ref={audioElementRef} 
                      src={audioPreview} 
                      className="w-full"
                      controls
                      onLoadedMetadata={(e) => {
                        const audio = e.currentTarget
                        if (audio.duration) {
                          setAudioDuration(audio.duration)
                          setAudioEndTime(Math.min(audio.duration, MAX_DURATION))
                        }
                      }}
                    />
                  </div>
                )}

                {/* Visual Timeline with Selected Region */}
                <div className="relative">
                  <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
                    <span>0:00</span>
                    <span className="text-cyan-400 font-mono font-bold">
                      Selected: {trimDuration.toFixed(2)}s
                    </span>
                    <span>{audioDuration.toFixed(1)}s</span>
                  </div>
                  
                  {/* Timeline Track */}
                  <div className="relative h-12 bg-white/5 rounded-lg overflow-hidden border border-white/10">
                    {/* Full duration background */}
                    <div className="absolute inset-0 bg-gradient-to-r from-gray-700/50 to-gray-600/50"></div>
                    
                    {/* Selected region highlight */}
                    <div 
                      className="absolute top-0 bottom-0 bg-gradient-to-r from-cyan-500/40 to-purple-500/40 border-l-2 border-r-2 border-cyan-400"
                      style={{
                        left: `${(audioStartTime / audioDuration) * 100}%`,
                        width: `${((audioEndTime - audioStartTime) / audioDuration) * 100}%`
                      }}
                    >
                      <div className="absolute inset-0 flex items-center justify-center text-white text-xs font-bold">
                        {audioStartTime.toFixed(1)}s - {audioEndTime.toFixed(1)}s
                      </div>
                    </div>

                    {/* Start marker */}
                    <div 
                      className="absolute top-0 bottom-0 w-1 bg-cyan-400 shadow-lg shadow-cyan-400/50 cursor-ew-resize z-10"
                      style={{ left: `${(audioStartTime / audioDuration) * 100}%` }}
                    ></div>
                    
                    {/* End marker */}
                    <div 
                      className="absolute top-0 bottom-0 w-1 bg-purple-400 shadow-lg shadow-purple-400/50 cursor-ew-resize z-10"
                      style={{ left: `${(audioEndTime / audioDuration) * 100}%` }}
                    ></div>
                  </div>

                  {/* Time markers */}
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    {Array.from({ length: Math.min(11, Math.ceil(audioDuration) + 1) }, (_, i) => (
                      <span key={i} className="w-px">{i}s</span>
                    ))}
                  </div>
                </div>

                {/* Precise Numeric Inputs */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Start Time Input */}
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-white flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-cyan-400"></div>
                      Start Time
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={0}
                        max={Math.max(0, audioEndTime - 0.1)}
                        step={0.01}
                        value={audioStartTime.toFixed(2)}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0
                          setAudioStartTime(Math.max(0, Math.min(val, audioEndTime - 0.1)))
                        }}
                        disabled={isGenerating}
                        className="flex-1 px-4 py-2.5 bg-white/10 border border-white/20 rounded-lg text-white font-mono focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 outline-none transition-all"
                      />
                      <span className="text-gray-400 text-sm">sec</span>
                    </div>
                    {/* Quick buttons */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => setAudioStartTime(0)}
                        disabled={isGenerating}
                        className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs text-gray-300 transition-colors disabled:opacity-50"
                      >
                        Start
                      </button>
                      {audioElementRef.current && (
                        <button
                          onClick={() => {
                            if (audioElementRef.current) {
                              setAudioStartTime(audioElementRef.current.currentTime)
                            }
                          }}
                          disabled={isGenerating}
                          className="px-3 py-1.5 bg-cyan-500/20 hover:bg-cyan-500/30 rounded-lg text-xs text-cyan-300 transition-colors disabled:opacity-50"
                        >
                          Use Current
                        </button>
                      )}
                    </div>
                  </div>

                  {/* End Time Input */}
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-white flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-purple-400"></div>
                      End Time
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={audioStartTime + 0.1}
                        max={audioDuration}
                        step={0.01}
                        value={audioEndTime.toFixed(2)}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0
                          const maxEnd = Math.min(audioDuration, audioStartTime + MAX_DURATION)
                          setAudioEndTime(Math.max(audioStartTime + 0.1, Math.min(val, maxEnd)))
                        }}
                        disabled={isGenerating}
                        className="flex-1 px-4 py-2.5 bg-white/10 border border-white/20 rounded-lg text-white font-mono focus:border-purple-400 focus:ring-2 focus:ring-purple-400/20 outline-none transition-all"
                      />
                      <span className="text-gray-400 text-sm">sec</span>
                    </div>
                    {/* Quick buttons */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => setAudioEndTime(Math.min(audioDuration, audioStartTime + MAX_DURATION))}
                        disabled={isGenerating}
                        className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs text-gray-300 transition-colors disabled:opacity-50"
                      >
                        Max ({MAX_DURATION}s)
                      </button>
                      {audioElementRef.current && (
                        <button
                          onClick={() => {
                            if (audioElementRef.current) {
                              const current = audioElementRef.current.currentTime
                              const maxEnd = Math.min(audioDuration, audioStartTime + MAX_DURATION)
                              setAudioEndTime(Math.max(audioStartTime + 0.1, Math.min(current, maxEnd)))
                            }
                          }}
                          disabled={isGenerating}
                          className="px-3 py-1.5 bg-purple-500/20 hover:bg-purple-500/30 rounded-lg text-xs text-purple-300 transition-colors disabled:opacity-50"
                        >
                          Use Current
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Range Sliders for Fine Tuning */}
                <div className="space-y-3">
                  <div className="text-xs text-gray-400 font-semibold">FINE TUNE WITH SLIDERS</div>
                  
                  {/* Start Time Slider */}
                  <div>
                    <div className="flex items-center justify-between text-xs text-gray-400 mb-1.5">
                      <span>Start Position</span>
                      <span className="text-cyan-400 font-mono">{audioStartTime.toFixed(2)}s</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={Math.max(0, audioEndTime - 0.1)}
                      step={0.01}
                      value={audioStartTime}
                      onChange={(e) => setAudioStartTime(Number(e.target.value))}
                      disabled={isGenerating}
                      className="w-full h-3 bg-white/10 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-cyan-400 [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:shadow-cyan-400/50 [&::-webkit-slider-thumb]:cursor-ew-resize disabled:opacity-50"
                    />
                  </div>

                  {/* End Time Slider */}
                  <div>
                    <div className="flex items-center justify-between text-xs text-gray-400 mb-1.5">
                      <span>End Position</span>
                      <span className="text-purple-400 font-mono">{audioEndTime.toFixed(2)}s</span>
                    </div>
                    <input
                      type="range"
                      min={audioStartTime + 0.1}
                      max={Math.min(audioDuration, audioStartTime + MAX_DURATION)}
                      step={0.01}
                      value={audioEndTime}
                      onChange={(e) => setAudioEndTime(Number(e.target.value))}
                      disabled={isGenerating}
                      className="w-full h-3 bg-white/10 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-purple-400 [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:shadow-purple-400/50 [&::-webkit-slider-thumb]:cursor-ew-resize disabled:opacity-50"
                    />
                  </div>
                </div>

                {/* Duration Info Card */}
                <div className="flex items-center justify-between p-4 bg-gradient-to-r from-cyan-500/10 to-purple-500/10 border border-cyan-500/30 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Zap className="text-yellow-400" size={18} />
                    <span className="text-white font-semibold">Output Duration</span>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-white font-mono">{trimDuration.toFixed(2)}s</div>
                    {trimDuration > MAX_DURATION && (
                      <div className="text-xs text-red-400 font-semibold">Exceeds {MAX_DURATION}s limit!</div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Duration Selector (5s/10s/15s) */}
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-white flex items-center gap-2">
                <Zap size={16} className="text-yellow-400" />
                Output Duration
                <span className="text-xs text-gray-400 font-normal ml-auto">(Replicate billing tiers)</span>
              </label>
              <div className="grid grid-cols-3 gap-3">
                {DURATION_OPTIONS.map((dur) => {
                  const cost720 = calcCredits(dur, '720p')
                  const cost1080 = calcCredits(dur, '1080p')
                  
                  return (
                    <button
                      key={dur}
                      onClick={() => setDuration(dur)}
                      disabled={isGenerating}
                      className={`p-4 rounded-xl border-2 transition-all disabled:opacity-50 ${
                        duration === dur
                          ? 'bg-gradient-to-br from-yellow-500/20 to-orange-500/20 border-yellow-500 shadow-lg shadow-yellow-500/20'
                          : 'bg-white/5 border-white/10 hover:border-white/30'
                      }`}
                    >
                      <div className="text-center">
                        <div className={`text-2xl font-bold mb-1 ${duration === dur ? 'text-white' : 'text-gray-400'}`}>
                          {dur}s
                        </div>
                        <div className="text-xs space-y-0.5">
                          <div className={duration === dur ? 'text-gray-300' : 'text-gray-500'}>
                            720p: <span className="font-semibold">{cost720}</span>
                          </div>
                          <div className={duration === dur ? 'text-gray-300' : 'text-gray-500'}>
                            1080p: <span className="font-semibold">{cost1080}</span>
                          </div>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
              <div className="text-xs text-gray-400 text-center">
                ⚡ Your audio will be trimmed to match the selected duration
              </div>
            </div>

            {/* Resolution Selector */}
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-white flex items-center gap-2">
                <Video size={16} className="text-cyan-400" />
                Output Resolution
              </label>
              <div className="grid grid-cols-2 gap-3">
                {(['720p', '1080p'] as const).map((res) => (
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
