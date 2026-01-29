'use client'

import { useState, useRef } from 'react'
import { X, Upload, Film, Music, Loader2, AlertCircle } from 'lucide-react'

interface MediaUploadModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: (result: any) => void
}

export default function MediaUploadModal({ isOpen, onClose, onSuccess }: MediaUploadModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [fileType, setFileType] = useState<'audio' | 'video' | null>(null)
  const [prompt, setPrompt] = useState('')
  const [useHQ, setUseHQ] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState('')
  const [error, setError] = useState('')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setError('')
    
    // Check file size (100MB max)
    const MAX_SIZE = 100 * 1024 * 1024 // 100MB in bytes
    if (file.size > MAX_SIZE) {
      setError('File size must be under 100MB')
      return
    }

    // Determine file type
    const isAudio = file.type.startsWith('audio/')
    const isVideo = file.type.startsWith('video/')
    
    if (!isAudio && !isVideo) {
      setError('Please select an audio or video file')
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
      
      if (isAudio && duration > 30.5) {
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
    if (fileType === 'video' && !prompt.trim()) {
      setError('Please describe the sound you want to generate')
      return
    }

    setIsUploading(true)
    setError('')

    try {
      let publicUrl: string

      // Try presigned URL first (faster, but requires CORS)
      // If that fails, fallback to server-side upload
      try {
        setUploadProgress('Preparing upload...')
        console.log('🔑 Step 1: Getting presigned URL...')
        
        const presignedResponse = await fetch('/api/upload/media', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileName: selectedFile.name,
            fileType: selectedFile.type,
            fileSize: selectedFile.size
          })
        })

        if (!presignedResponse.ok) {
          throw new Error('Presigned URL failed')
        }

        const { uploadUrl, publicUrl: previewUrl } = await presignedResponse.json()
        console.log('✅ Step 1 complete: Got presigned URL')

        // Step 2: Upload directly to R2 using presigned URL
        setUploadProgress('Uploading file to storage...')
        console.log('📤 Step 2: Uploading file to R2...')
        
        const uploadResponse = await fetch(uploadUrl, {
          method: 'PUT',
          body: selectedFile,
          headers: { 'Content-Type': selectedFile.type }
        })

        if (!uploadResponse.ok) {
          throw new Error('Direct R2 upload failed (CORS?)')
        }

        console.log('✅ Step 2 complete: File uploaded to', previewUrl)
        publicUrl = previewUrl

      } catch (corsError) {
        // Fallback: Server-side upload (no CORS needed)
        console.warn('⚠️ Presigned upload failed, trying server-side:', corsError)
        setUploadProgress('Uploading via server (backup method)...')
        
        const formData = new FormData()
        formData.append('file', selectedFile)

        const serverResponse = await fetch('/api/upload/media', {
          method: 'POST',
          body: formData
        })

        if (!serverResponse.ok) {
          const serverError = await serverResponse.json()
          throw new Error(serverError.error || 'Server upload failed')
        }

        const result = await serverResponse.json()
        publicUrl = result.url
        console.log('✅ Server-side upload complete:', publicUrl)
      }

      // Step 3: Generate audio/remix using the uploaded file URL
      setUploadProgress('Generating audio...')
      console.log('🎵 Step 3: Generating...')
      const generateEndpoint = fileType === 'video' 
        ? '/api/generate/video-to-audio'
        : '/api/generate/audio-to-audio'

      const generateResponse = await fetch(generateEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoUrl: publicUrl,
          audioUrl: publicUrl,
          prompt: prompt,
          quality: fileType === 'video' && useHQ ? 'hq' : 'standard'
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
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setIsUploading(false)
      setUploadProgress('')
    }
  }

  const handleClose = () => {
    setSelectedFile(null)
    setFileType(null)
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
      
      {/* Modal - Sleek */}
      <div className="relative w-full max-w-[480px] bg-gradient-to-b from-gray-900/90 to-black/90 border border-cyan-500/[0.08] rounded-xl shadow-2xl overflow-hidden backdrop-blur-2xl">
        
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.03]">
          <div className="flex items-center gap-1.5">
            <Upload size={12} className="text-cyan-400/80" />
            <h3 className="text-[13px] font-medium text-white/80">Upload Media</h3>
          </div>
          <button
            onClick={handleClose}
            className="p-0.5 rounded hover:bg-white/5 transition-colors"
          >
            <X size={13} className="text-gray-600" />
          </button>
        </div>

        {/* Content */}
        <div className="p-3 space-y-2.5">
          
          {/* Feature Cards - Show before file is selected */}
          {!selectedFile && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
              {/* Video to Audio Card */}
              <div className="p-4 bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/30 rounded-lg">
                <div className="flex items-start gap-3">
                  <Film size={24} className="text-cyan-400 flex-shrink-0 mt-1" />
                  <div>
                    <h4 className="text-sm font-bold text-white mb-1">Video to Audio</h4>
                    <p className="text-xs text-gray-400 leading-relaxed">
                      Upload a video (up to 5s) and generate synced sound effects. Perfect for car engines, nature sounds, action scenes.
                    </p>
                    <div className="mt-2 flex items-center gap-1 text-xs text-cyan-400">
                      <span className="font-semibold">2 credits</span>
                      <span className="text-gray-500">•</span>
                      <span className="font-semibold text-yellow-400">10 credits (HQ)</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Audio to Audio Card */}
              <div className="p-4 bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/30 rounded-lg">
                <div className="flex items-start gap-3">
                  <Music size={24} className="text-purple-400 flex-shrink-0 mt-1" />
                  <div>
                    <h4 className="text-sm font-bold text-white mb-1">Audio Remix</h4>
                    <p className="text-xs text-gray-400 leading-relaxed">
                      Upload audio (up to 30s) and create AI variations. Remix melodies, change genres, add instruments.
                    </p>
                    <div className="mt-2 flex items-center gap-1 text-xs text-purple-400">
                      <span className="font-semibold">2 credits</span>
                      <span className="text-gray-500">• Coming Soon</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* File Upload Area */}
          <div 
            className="border-2 border-dashed border-cyan-500/30 rounded-xl p-8 text-center cursor-pointer hover:border-cyan-400/50 hover:bg-cyan-500/5 transition-all"
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*,video/*"
              onChange={handleFileSelect}
              className="hidden"
            />
            
            {selectedFile ? (
              <div className="space-y-3">
                {fileType === 'video' ? (
                  <Film size={40} className="mx-auto text-cyan-400" />
                ) : (
                  <Music size={40} className="mx-auto text-purple-400" />
                )}
                <div>
                  <p className="text-white font-medium">{selectedFile.name}</p>
                  <p className="text-sm text-gray-400 mt-1">
                    {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                  </p>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedFile(null)
                      setFileType(null)
                      if (previewUrl) {
                        URL.revokeObjectURL(previewUrl)
                        setPreviewUrl(null)
                      }
                    }}
                    className="mt-2 text-sm text-red-400 hover:text-red-300"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <Upload size={40} className="mx-auto text-cyan-400" />
                <div>
                  <p className="text-white font-medium">Click to upload</p>
                  <p className="text-sm text-gray-400 mt-1">
                    Audio (max 30s) or Video (max 5s)
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Up to 100MB
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Preview */}
          {previewUrl && fileType === 'video' && (
            <div className="rounded-lg overflow-hidden">
              <video 
                src={previewUrl} 
                controls 
                className="w-full max-h-64 bg-black"
              />
            </div>
          )}

          {previewUrl && fileType === 'audio' && (
            <div className="p-4 bg-black/40 rounded-lg">
              <audio 
                src={previewUrl} 
                controls 
                className="w-full"
              />
            </div>
          )}

          {/* Feature Info */}
          {selectedFile && (
            <div className={`p-4 border rounded-lg ${
              fileType === 'video' 
                ? 'bg-cyan-500/10 border-cyan-500/30' 
                : 'bg-purple-500/10 border-purple-500/30'
            }`}>
              <div className="flex items-start gap-3">
                {fileType === 'video' ? (
                  <Film size={20} className="text-cyan-400 flex-shrink-0 mt-0.5" />
                ) : (
                  <Music size={20} className="text-purple-400 flex-shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  <p className={`text-sm font-semibold mb-1 ${
                    fileType === 'video' ? 'text-cyan-300' : 'text-purple-300'
                  }`}>
                    {fileType === 'video' ? '🎬 Video to Audio' : '🎵 Audio Remix'}
                  </p>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    {fileType === 'video' ? (
                      <>Generate synced sound effects and ambient audio for your video. Describe what sounds you want (e.g., "car engine roaring", "rain and thunder", "footsteps on gravel").</>
                    ) : (
                      <>Create AI variations of your audio. Describe the changes you want (e.g., "add drums", "make it jazzy", "speed up tempo", "change to orchestral").</>
                    )}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Prompt (required for video) */}
          {selectedFile && (
            <div className="space-y-1">
              <label className="text-[10px] font-medium text-gray-600">
                {fileType === 'video' ? 'Sound description *' : 'Variation (optional)'}
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={fileType === 'video' 
                  ? 'car engine, birds, thunder...'
                  : 'add drums, jazzy, faster...'
                }
                className="w-full px-2.5 py-1.5 bg-white/[0.02] border border-white/[0.04] rounded-lg text-white text-[13px] placeholder-gray-700 focus:outline-none focus:border-cyan-500/20 focus:bg-white/[0.03] transition-all resize-none"
                rows={1}
                required={fileType === 'video'}
              />
              
              {/* HQ Toggle (video only) */}
              {fileType === 'video' && (
                <label className="flex items-center gap-1.5 px-2 py-1 bg-yellow-500/[0.04] border border-yellow-500/10 rounded cursor-pointer hover:bg-yellow-500/[0.06] transition-colors">
                  <input
                    type="checkbox"
                    checked={useHQ}
                    onChange={(e) => setUseHQ(e.target.checked)}
                    className="w-3 h-3 rounded border-yellow-500/30 bg-white/5 text-yellow-500 focus:ring-0"
                  />
                  <div className="flex-1 flex items-center justify-between">
                    <span className="text-[10px] font-medium text-yellow-300">✨ HQ</span>
                    <span className="px-1 py-0.5 bg-yellow-500/20 text-yellow-300 text-[8px] font-bold rounded">+8</span>
                  </div>
                </label>
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
        <div className="px-3 py-2 border-t border-white/[0.03] flex items-center gap-2 bg-black/30">
          <div className="flex-1 flex items-center gap-1 text-[9px]">
            <span className={fileType === 'video' && useHQ ? 'text-yellow-400/60' : 'text-cyan-400/60'}>💰</span>
            <span className={fileType === 'video' && useHQ ? 'text-yellow-400/50' : 'text-cyan-400/50'}>
              {selectedFile && fileType === 'video' && useHQ ? '10' : '2'}
            </span>
            {selectedFile && (
              <>
                <span className="text-gray-800">•</span>
                <span className="text-gray-700">{fileType === 'video' ? '≤5s' : '≤30s'}</span>
              </>
            )}
          </div>
          <button
            onClick={handleUpload}
            disabled={!selectedFile || isUploading || (fileType === 'video' && !prompt.trim())}
            className="px-3 py-1 bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-600 hover:to-cyan-700 rounded transition-all flex items-center justify-center gap-1 text-[10px] font-medium text-white shadow-lg shadow-cyan-500/15 disabled:opacity-30 disabled:cursor-not-allowed min-w-[85px]"
          >
            {isUploading ? (
              <>
                <Loader2 size={11} className="animate-spin" />
                <span>Processing</span>
              </>
            ) : (
              <>
                <Upload size={11} />
                <span>Generate</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  )
}
