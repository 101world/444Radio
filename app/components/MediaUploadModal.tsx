'use client'

import { useState, useRef } from 'react'
import { X, Upload, Film, Music, Loader2, AlertCircle, Scissors, Volume2, Zap } from 'lucide-react'

interface MediaUploadModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: (result: any) => void
  onStart?: (type: 'stem-split' | 'video-to-audio' | 'audio-boost') => void
  onError?: (error: string) => void
}

export default function MediaUploadModal({ isOpen, onClose, onSuccess, onStart, onError }: MediaUploadModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [fileType, setFileType] = useState<'audio' | 'video' | null>(null)
  const [uploadMode, setUploadMode] = useState<'video-to-audio' | 'audio-remix' | 'stem-split' | 'audio-boost' | null>(null)
  const [prompt, setPrompt] = useState('')
  const [useHQ, setUseHQ] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState('')
  const [error, setError] = useState('')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const audioFileInputRef = useRef<HTMLInputElement>(null)
  const boostFileInputRef = useRef<HTMLInputElement>(null)

  // Audio Boost parameters
  const [bassBoost, setBassBoost] = useState(0)
  const [trebleBoost, setTrebleBoost] = useState(0)
  const [volumeBoost, setVolumeBoost] = useState(2)
  const [boostNormalize, setBoostNormalize] = useState(true)
  const [boostNoiseReduction, setBoostNoiseReduction] = useState(false)
  const [boostFormat, setBoostFormat] = useState('mp3')
  const [boostBitrate, setBoostBitrate] = useState('192k')

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, mode: 'video-to-audio' | 'stem-split' | 'audio-boost') => {
    const file = e.target.files?.[0]
    if (!file) return

    setError('')
    setUploadMode(mode)
    
    // Check file size (100MB max)
    const MAX_SIZE = 100 * 1024 * 1024 // 100MB in bytes
    if (file.size > MAX_SIZE) {
      setError('File size must be under 100MB')
      return
    }

    // Determine file type
    const isAudio = file.type.startsWith('audio/')
    const isVideo = file.type.startsWith('video/')
    
    // Validate file type based on mode
    if (mode === 'video-to-audio' && !isVideo) {
      setError('Please select a video file')
      return
    }
    
    if (mode === 'stem-split' && !isAudio) {
      setError('Please select an audio file')
      return
    }

    if (mode === 'audio-boost' && !isAudio) {
      setError('Please select an audio file')
      return
    }

    // Set file immediately for better UX
    setSelectedFile(file)
    setFileType(isVideo ? 'video' : 'audio')
    const objectUrl = URL.createObjectURL(file)
    setPreviewUrl(objectUrl)

    // Validate duration asynchronously (warning only, server will enforce)
    const media = document.createElement(isVideo ? 'video' : 'audio') as HTMLVideoElement | HTMLAudioElement
    
    media.onloadedmetadata = () => {
      const duration = media.duration
      
      if (isVideo && duration > 5.5) {
        setError(`⚠️ Video is ${duration.toFixed(1)}s. Recommended max is 5s. May be truncated.`)
      }
      
      if (isAudio && mode === 'video-to-audio' && duration > 30.5) {
        setError(`⚠️ Audio is ${duration.toFixed(1)}s. Recommended max is 30s. May be truncated.`)
      }
    }
    
    media.onerror = () => {
      console.warn('Could not load media metadata, but file is selected')
    }
    
    media.src = objectUrl
  }

  const handleUpload = async () => {
    if (!selectedFile || !fileType) return

    // For video-to-audio, prompt is required
    if (uploadMode === 'video-to-audio' && !prompt.trim()) {
      setError('Please describe the sound you want to generate')
      return
    }

    setIsUploading(true)
    setError('')

    try {
      let publicUrl: string

      // Use presigned URL for all uploads (avoids Vercel 4.5MB body limit / 413 errors)
      setUploadProgress('Preparing upload...')
      console.log('📤 Requesting presigned URL for:', selectedFile.name, `(${(selectedFile.size / (1024 * 1024)).toFixed(2)} MB)`)

      const presignResponse = await fetch('/api/upload/media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: selectedFile.name,
          fileType: selectedFile.type,
          fileSize: selectedFile.size,
        })
      })

      if (!presignResponse.ok) {
        const presignError = await presignResponse.json()
        throw new Error(presignError.error || 'Failed to prepare upload')
      }

      const { uploadUrl, publicUrl: signedPublicUrl } = await presignResponse.json()

      // Upload file directly to R2 via presigned URL (bypasses Vercel body limit)
      setUploadProgress('Uploading file to storage...')
      console.log('📤 Uploading directly to R2 via presigned URL...')

      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': selectedFile.type },
        body: selectedFile,
      })

      if (!uploadResponse.ok) {
        console.error('❌ R2 direct upload failed:', uploadResponse.status, uploadResponse.statusText)
        throw new Error(`Upload failed (${uploadResponse.status}). Please try again or use a smaller file.`)
      } else {
        publicUrl = signedPublicUrl
        console.log('✅ Direct R2 upload complete:', publicUrl)
      }

      // For stem splitting or audio boost, verify URL is accessible before proceeding
      if (uploadMode === 'stem-split' || uploadMode === 'audio-boost') {
        setUploadProgress('Verifying file accessibility...')
        
        // Wait for R2 to propagate (increased from 2s to 5s)
        await new Promise(resolve => setTimeout(resolve, 5000))
        
        // Verify the URL is accessible
        let retries = 0
        const maxRetries = 3
        let isAccessible = false
        
        while (retries < maxRetries && !isAccessible) {
          try {
            console.log(`🔍 Checking URL accessibility (attempt ${retries + 1}/${maxRetries}):`, publicUrl)
            const headResponse = await fetch(publicUrl, { method: 'HEAD' })
            if (headResponse.ok) {
              isAccessible = true
              console.log('✅ URL is accessible, content-type:', headResponse.headers.get('content-type'))
            } else {
              console.warn(`⚠️ URL not yet accessible (${headResponse.status}), waiting...`)
              await new Promise(resolve => setTimeout(resolve, 2000))
              retries++
            }
          } catch (error) {
            console.warn(`⚠️ URL check failed (attempt ${retries + 1}), waiting...`, error)
            await new Promise(resolve => setTimeout(resolve, 2000))
            retries++
          }
        }
        
        if (!isAccessible) {
          throw new Error('Uploaded file is not yet accessible. Please try again in a moment.')
        }
      }

      // For stem splitting, directly call the split-stems API
      if (uploadMode === 'stem-split') {
        // Notify parent that stem splitting is starting
        onStart?.('stem-split')
        
        setUploadProgress('Splitting stems... This may take 1-2 minutes.')
        console.log('🎵 Splitting stems from:', publicUrl)

        const splitResponse = await fetch('/api/audio/split-stems', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            audioUrl: publicUrl,
            format: 'mp3' // Default to MP3 for faster processing
          })
        })

        // Parse NDJSON stream (server sends heartbeats + result)
        const reader = splitResponse.body?.getReader()
        if (!reader) throw new Error('No response stream from stem splitter')

        const decoder = new TextDecoder()
        let streamBuffer = ''
        let splitResult: any = null

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          streamBuffer += decoder.decode(value, { stream: true })
          const lines = streamBuffer.split('\n')
          streamBuffer = lines.pop() || ''
          for (const line of lines) {
            if (!line.trim()) continue
            try {
              const parsed = JSON.parse(line)
              if (parsed.type === 'progress') {
                setUploadProgress(`Splitting stems... ${parsed.status} (${parsed.elapsed || 0}s)`)
              } else if (parsed.type === 'result') {
                splitResult = parsed
              }
            } catch { /* skip unparseable lines */ }
          }
        }
        // Process remaining buffer
        if (streamBuffer.trim()) {
          for (const line of streamBuffer.split('\n')) {
            if (!line.trim()) continue
            try {
              const parsed = JSON.parse(line)
              if (parsed.type === 'result') splitResult = parsed
            } catch { /* skip */ }
          }
        }
        reader.releaseLock()

        if (!splitResult || !splitResult.success) {
          const errMsg = splitResult?.error || 'Stem splitting failed'
          console.error('❌ Stem splitting error:', errMsg)
          throw new Error(errMsg)
        }

        console.log('✅ Stems split successfully:', splitResult)
        onSuccess?.(splitResult)
        handleClose()
        return
      }

      // For audio boost, call the audio-boost API
      if (uploadMode === 'audio-boost') {
        onStart?.('audio-boost')

        setUploadProgress('Boosting audio... This may take a few seconds.')
        console.log('🔊 Boosting audio from:', publicUrl)

        const boostResponse = await fetch('/api/generate/audio-boost', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            audioUrl: publicUrl,
            trackTitle: selectedFile?.name?.replace(/\.[^/.]+$/, '') || 'Uploaded Audio',
            bass_boost: bassBoost,
            treble_boost: trebleBoost,
            volume_boost: volumeBoost,
            normalize: boostNormalize,
            noise_reduction: boostNoiseReduction,
            output_format: boostFormat,
            bitrate: boostBitrate,
          })
        })

        const boostResult = await boostResponse.json()

        if (!boostResponse.ok || boostResult.error) {
          throw new Error(boostResult.error || 'Audio boost failed')
        }

        console.log('✅ Audio boosted successfully:', boostResult)
        onSuccess?.({ ...boostResult, type: 'audio-boost' })
        handleClose()
        return
      }

      // Step 3: Generate audio/remix using the uploaded file URL (for video-to-audio only)
      setUploadProgress('Generating audio...')
      console.log('🎵 Step 3: Generating...')
      const generateEndpoint = uploadMode === 'video-to-audio' 
        ? '/api/generate/video-to-audio'
        : '/api/generate/audio-to-audio'

      const generateResponse = await fetch(generateEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoUrl: publicUrl,
          audioUrl: publicUrl,
          prompt: prompt,
          quality: uploadMode === 'video-to-audio' && useHQ ? 'hq' : 'standard'
        })
      })

      const result = await generateResponse.json()

      if (!generateResponse.ok || result.error) {
        throw new Error(result.error || 'Generation failed')
      }

      console.log('✅ Step 3 complete:', result)
      onSuccess?.(result)
      handleClose()
    } catch (err) {
      console.error('Upload error:', err)
      const errorMessage = err instanceof Error ? err.message : 'Upload failed'
      setError(errorMessage)
      // Notify parent of error for chat display
      onError?.(errorMessage)
    } finally {
      setIsUploading(false)
      setUploadProgress('')
    }
  }

  const handleClose = () => {
    setSelectedFile(null)
    setFileType(null)
    setUploadMode(null)
    setPrompt('')
    setUseHQ(false)
    setError('')
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
      setPreviewUrl(null)
    }
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fadeIn">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/95 backdrop-blur-xl"
        onClick={handleClose}
      />
      
      {/* Modal - Clean & Simple */}
      <div className="relative w-full max-w-lg bg-gradient-to-b from-gray-900/95 to-black/95 border border-cyan-500/20 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-2xl">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-cyan-500/10 rounded-lg">
              <Upload size={20} className="text-cyan-400" />
            </div>
            <h3 className="text-lg font-semibold text-white">Upload Media</h3>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-lg hover:bg-white/5 transition-colors"
          >
            <X size={20} className="text-gray-400 hover:text-white transition-colors" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          
          {/* Feature Selection - Show if no file selected */}
          {!selectedFile && (
            <div className="space-y-3">
              <p className="text-sm text-gray-400 text-center mb-4">Choose a feature to get started</p>
              
              {/* Video to Audio Button */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full p-4 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border-2 border-cyan-500/30 hover:border-cyan-400/50 rounded-xl transition-all group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-cyan-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Film size={24} className="text-cyan-400" />
                  </div>
                  <div className="flex-1 text-left">
                    <h3 className="text-base font-semibold text-white mb-1">Video to Audio</h3>
                    <p className="text-xs text-gray-400">Upload video (max 5s) and generate synced sound effects</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-cyan-400">2 credits</p>
                    <p className="text-xs text-yellow-400">10 HQ</p>
                  </div>
                </div>
              </button>

              {/* Audio Remix Button - Disabled */}
              <button
                disabled
                className="w-full p-4 bg-gradient-to-r from-purple-500/5 to-pink-500/5 border-2 border-purple-500/20 rounded-xl opacity-50 cursor-not-allowed"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-purple-500/10 flex items-center justify-center">
                    <Music size={24} className="text-purple-400" />
                  </div>
                  <div className="flex-1 text-left">
                    <h3 className="text-base font-semibold text-white mb-1">Audio Remix</h3>
                    <p className="text-xs text-gray-400">Create AI variations and remixes</p>
                  </div>
                  <div className="px-3 py-1 bg-purple-500/20 rounded-lg">
                    <p className="text-xs font-semibold text-purple-300">Coming Soon</p>
                  </div>
                </div>
              </button>

              {/* Split Audio Stems Button - NEW */}
              <button
                onClick={() => audioFileInputRef.current?.click()}
                className="w-full p-4 bg-gradient-to-r from-teal-500/10 to-cyan-500/10 border-2 border-teal-500/30 hover:border-teal-400/50 rounded-xl transition-all group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-teal-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Scissors size={24} className="text-teal-400" />
                  </div>
                  <div className="flex-1 text-left">
                    <h3 className="text-base font-semibold text-white mb-1">Split Audio Stems</h3>
                    <p className="text-xs text-gray-400">Upload audio and separate vocals, drums, bass & other</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-teal-400">5 credits</p>
                  </div>
                </div>
              </button>

              {/* Audio Boost Button */}
              <button
                onClick={() => boostFileInputRef.current?.click()}
                className="w-full p-4 bg-gradient-to-r from-orange-500/10 to-red-500/10 border-2 border-orange-500/30 hover:border-orange-400/50 rounded-xl transition-all group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-orange-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Volume2 size={24} className="text-orange-400" />
                  </div>
                  <div className="flex-1 text-left">
                    <h3 className="text-base font-semibold text-white mb-1">Audio Boost</h3>
                    <p className="text-xs text-gray-400">Mix & master your track — bass, treble, volume & more</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-orange-400">1 credit</p>
                  </div>
                </div>
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                onChange={(e) => handleFileSelect(e, 'video-to-audio')}
                className="hidden"
              />
              <input
                ref={audioFileInputRef}
                type="file"
                accept="audio/*"
                onChange={(e) => handleFileSelect(e, 'stem-split')}
                className="hidden"
              />
              <input
                ref={boostFileInputRef}
                type="file"
                accept="audio/*"
                onChange={(e) => handleFileSelect(e, 'audio-boost')}
                className="hidden"
              />
            </div>
          )}

          {/* After File Selected */}
          {selectedFile && (
            <div className="space-y-4">
              
              {/* Compact File Info */}
              <div className="flex items-center gap-3 p-3 bg-white/5 rounded-lg border border-white/10">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  uploadMode === 'stem-split' ? 'bg-teal-500/20' : uploadMode === 'audio-boost' ? 'bg-orange-500/20' : 'bg-cyan-500/20'
                }`}>
                  {uploadMode === 'stem-split' ? (
                    <Scissors size={20} className="text-teal-400" />
                  ) : uploadMode === 'audio-boost' ? (
                    <Volume2 size={20} className="text-orange-400" />
                  ) : (
                    <Film size={20} className="text-cyan-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{selectedFile.name}</p>
                  <p className="text-xs text-gray-400">{(selectedFile.size / (1024 * 1024)).toFixed(2)} MB</p>
                </div>
                <button
                  onClick={() => {
                    setSelectedFile(null)
                    setFileType(null)
                    setUploadMode(null)
                    setPrompt('')
                    setUseHQ(false)
                    if (previewUrl) {
                      URL.revokeObjectURL(previewUrl)
                      setPreviewUrl(null)
                    }
                  }}
                  className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-medium rounded transition-colors flex-shrink-0"
                >
                  Remove
                </button>
              </div>

              {/* Compact Video Preview */}
              {previewUrl && fileType === 'video' && (
                <div className="rounded-lg overflow-hidden bg-black border border-white/10">
                  <video 
                    src={previewUrl} 
                    controls 
                    className="w-full h-40 object-contain"
                  />
                </div>
              )}

              {/* Compact Audio Preview for Stem Split */}
              {previewUrl && fileType === 'audio' && uploadMode === 'stem-split' && (
                <div className="rounded-lg overflow-hidden bg-teal-500/10 border border-teal-500/20 p-4">
                  <audio 
                    src={previewUrl} 
                    controls 
                    className="w-full"
                  />
                  <p className="text-xs text-gray-400 mt-2">Preview your audio before splitting stems</p>
                </div>
              )}

              {/* Audio Preview for Boost */}
              {previewUrl && fileType === 'audio' && uploadMode === 'audio-boost' && (
                <div className="rounded-lg overflow-hidden bg-orange-500/10 border border-orange-500/20 p-4">
                  <audio 
                    src={previewUrl} 
                    controls 
                    className="w-full"
                  />
                  <p className="text-xs text-gray-400 mt-2">Preview your audio before boosting</p>
                </div>
              )}

              {/* Prompt - Only for video-to-audio */}
              {uploadMode === 'video-to-audio' && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
                    <span>Describe the sounds you want</span>
                    <span className="text-red-400 text-xs">*</span>
                  </label>
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="e.g., car engine roaring, water splashing, birds chirping..."
                    className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-transparent transition-all resize-none"
                    rows={2}
                    required
                  />
                </div>
              )}
              
              {/* HQ Toggle - Only for video-to-audio */}
              {uploadMode === 'video-to-audio' && (
                <label className="flex items-center gap-3 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg cursor-pointer hover:bg-yellow-500/15 transition-colors">
                  <input
                    type="checkbox"
                    checked={useHQ}
                    onChange={(e) => setUseHQ(e.target.checked)}
                    className="w-4 h-4 rounded border-yellow-500/30 bg-white/5 text-yellow-500 focus:ring-2 focus:ring-yellow-500/50"
                  />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-yellow-300">✨ High Quality</span>
                      <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-300 text-xs font-bold rounded">+8 credits</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">Better audio, longer processing</p>
                  </div>
                </label>
              )}

              {/* Stem Split Info - Only for stem-split mode */}
              {uploadMode === 'stem-split' && (
                <div className="bg-teal-500/10 border border-teal-500/20 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <Scissors className="w-5 h-5 text-teal-400 shrink-0 mt-0.5" />
                    <div className="text-sm space-y-1">
                      <p className="text-white font-semibold">What you'll get:</p>
                      <ul className="text-gray-300 space-y-1 text-xs">
                        <li>• Vocals track (isolated vocals)</li>
                        <li>• Drums track (percussion)</li>
                        <li>• Bass track (bass instruments)</li>
                        <li>• Other track (remaining instruments)</li>
                      </ul>
                      <p className="text-teal-400 font-semibold mt-2">Cost: 5 credits</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Audio Boost Parameters - Only for audio-boost mode */}
              {uploadMode === 'audio-boost' && (
                <div className="space-y-3">
                  {/* Quick Presets */}
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => { setBassBoost(5); setTrebleBoost(5); setVolumeBoost(6); setBoostNormalize(true); setBoostNoiseReduction(true); setBoostBitrate('320k') }}
                      className="px-3 py-2 bg-gradient-to-r from-orange-500/10 to-red-500/10 border border-orange-500/30 hover:border-orange-400/50 rounded-lg text-xs font-semibold text-orange-300 transition-all"
                    >
                      🔥 444 Mix
                    </button>
                    <button
                      onClick={() => { setBassBoost(0); setTrebleBoost(0); setVolumeBoost(2); setBoostNormalize(true); setBoostNoiseReduction(false); setBoostBitrate('192k') }}
                      className="px-3 py-2 bg-white/5 border border-white/10 hover:border-white/30 rounded-lg text-xs font-semibold text-gray-300 transition-all"
                    >
                      🎧 Clean
                    </button>
                    <button
                      onClick={() => { setBassBoost(10); setTrebleBoost(3); setVolumeBoost(8); setBoostNormalize(false); setBoostNoiseReduction(true); setBoostBitrate('320k') }}
                      className="px-3 py-2 bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/30 hover:border-purple-400/50 rounded-lg text-xs font-semibold text-purple-300 transition-all"
                    >
                      💎 Heavy
                    </button>
                  </div>

                  {/* Bass */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-medium text-gray-400">Bass</label>
                      <span className="text-xs font-bold text-orange-400">{bassBoost > 0 ? '+' : ''}{bassBoost} dB</span>
                    </div>
                    <input type="range" min={-20} max={20} step={0.5} value={bassBoost} onChange={(e) => setBassBoost(Number(e.target.value))} className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-orange-500" />
                  </div>

                  {/* Treble */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-medium text-gray-400">Treble</label>
                      <span className="text-xs font-bold text-cyan-400">{trebleBoost > 0 ? '+' : ''}{trebleBoost} dB</span>
                    </div>
                    <input type="range" min={-20} max={20} step={0.5} value={trebleBoost} onChange={(e) => setTrebleBoost(Number(e.target.value))} className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-cyan-500" />
                  </div>

                  {/* Volume */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-medium text-gray-400">Volume</label>
                      <span className="text-xs font-bold text-yellow-400">{volumeBoost}x</span>
                    </div>
                    <input type="range" min={0} max={10} step={0.5} value={volumeBoost} onChange={(e) => setVolumeBoost(Number(e.target.value))} className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-yellow-500" />
                  </div>

                  {/* Toggles + Format */}
                  <div className="grid grid-cols-2 gap-2">
                    <label className="flex items-center gap-2 p-2 bg-white/5 border border-white/10 rounded-lg cursor-pointer">
                      <input type="checkbox" checked={boostNormalize} onChange={(e) => setBoostNormalize(e.target.checked)} className="w-3.5 h-3.5 rounded border-white/20 bg-white/5 text-orange-500" />
                      <span className="text-xs text-gray-300">Normalize</span>
                    </label>
                    <label className="flex items-center gap-2 p-2 bg-white/5 border border-white/10 rounded-lg cursor-pointer">
                      <input type="checkbox" checked={boostNoiseReduction} onChange={(e) => setBoostNoiseReduction(e.target.checked)} className="w-3.5 h-3.5 rounded border-white/20 bg-white/5 text-orange-500" />
                      <span className="text-xs text-gray-300">Denoise</span>
                    </label>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <select value={boostFormat} onChange={(e) => setBoostFormat(e.target.value)} className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:ring-1 focus:ring-orange-500/50 appearance-none cursor-pointer">
                      <option value="mp3" className="bg-gray-900">MP3</option>
                      <option value="wav" className="bg-gray-900">WAV</option>
                      <option value="aac" className="bg-gray-900">AAC</option>
                      <option value="ogg" className="bg-gray-900">OGG</option>
                    </select>
                    <select value={boostBitrate} onChange={(e) => setBoostBitrate(e.target.value)} className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:ring-1 focus:ring-orange-500/50 appearance-none cursor-pointer">
                      <option value="128k" className="bg-gray-900">128k</option>
                      <option value="192k" className="bg-gray-900">192k</option>
                      <option value="256k" className="bg-gray-900">256k</option>
                      <option value="320k" className="bg-gray-900">320k</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-2">
              <AlertCircle size={18} className="text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}

          {/* Upload Progress */}
          {isUploading && uploadProgress && (
            <div className="p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-lg flex items-center gap-2">
              <Loader2 size={18} className="text-cyan-400 animate-spin flex-shrink-0" />
              <p className="text-sm text-cyan-300">{uploadProgress}</p>
            </div>
          )}


        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-white/10 flex items-center gap-3 bg-black/40">
          <div className="flex-1 flex items-center gap-2 text-sm">
            <span className={uploadMode === 'stem-split' ? 'text-teal-400' : uploadMode === 'audio-boost' ? 'text-orange-400' : useHQ ? 'text-yellow-400' : 'text-cyan-400'}>💰</span>
            <span className={`font-semibold ${
              uploadMode === 'stem-split' ? 'text-teal-400' :
              uploadMode === 'audio-boost' ? 'text-orange-400' :
              useHQ ? 'text-yellow-400' : 'text-cyan-400'
            }`}>
              {uploadMode === 'stem-split' ? '5 credits' :
               uploadMode === 'audio-boost' ? '1 credit' :
               selectedFile && useHQ ? '10 credits' : '2 credits'}
            </span>
            {selectedFile && uploadMode === 'video-to-audio' && (
              <>
                <span className="text-gray-600">•</span>
                <span className="text-gray-400 text-xs">Max 5s</span>
              </>
            )}
          </div>
          <button
            onClick={handleUpload}
            disabled={!selectedFile || isUploading || (uploadMode === 'video-to-audio' && !prompt.trim())}
            className={`px-5 py-2 rounded-lg transition-all flex items-center justify-center gap-2 text-sm font-semibold text-white shadow-lg disabled:opacity-40 disabled:cursor-not-allowed min-w-[120px] ${
              uploadMode === 'stem-split'
                ? 'bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700 shadow-teal-500/30'
                : uploadMode === 'audio-boost'
                ? 'bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 shadow-orange-500/30'
                : 'bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-600 hover:to-cyan-700 shadow-cyan-500/30'
            }`}
          >
            {isUploading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Processing...</span>
              </>
            ) : uploadMode === 'stem-split' ? (
              <>
                <Scissors size={16} />
                <span>Split Stems</span>
              </>
            ) : uploadMode === 'audio-boost' ? (
              <>
                <Volume2 size={16} />
                <span>Boost Audio</span>
              </>
            ) : (
              <>
                <Upload size={16} />
                <span>Generate</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  )
}
