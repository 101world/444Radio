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
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={handleClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-lg bg-gradient-to-br from-gray-900 via-black to-gray-900 border-2 border-cyan-500/30 rounded-2xl shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Upload size={20} className="text-cyan-400" />
            Upload Media
          </h3>
          <button
            onClick={handleClose}
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
          >
            <X size={18} className="text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          
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

          {/* Prompt Input (required for video) */}
          {selectedFile && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">
                {fileType === 'video' ? 'Describe the sound *' : 'Describe variation (optional)'}
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={fileType === 'video' 
                  ? 'e.g., car engine roaring, birds chirping, thunder storm...'
                  : 'e.g., add drums, make it jazzy, speed it up...'
                }
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 transition-all resize-none"
                rows={3}
                required={fileType === 'video'}
              />
              
              {/* HQ Quality Toggle (only for video) */}
              {fileType === 'video' && (
                <div className="mt-3 p-3 bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/30 rounded-lg">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={useHQ}
                      onChange={(e) => setUseHQ(e.target.checked)}
                      className="mt-0.5 w-4 h-4 rounded border-yellow-500/50 bg-white/5 text-yellow-500 focus:ring-yellow-500/50 focus:ring-offset-0"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-yellow-300">✨ Enable HQ Quality</span>
                        <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-300 text-xs font-bold rounded">+8 credits</span>
                      </div>
                      <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                        Premium model with higher fidelity audio, better sync accuracy, and professional-grade sound design. Uses HunyuanVideo-Foley.
                      </p>
                    </div>
                  </label>
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

          {/* Credit Cost */}
          {selectedFile && (
            <div className={`p-3 rounded-lg ${
              fileType === 'video' && useHQ
                ? 'bg-yellow-500/10 border border-yellow-500/30'
                : 'bg-purple-500/10 border border-purple-500/30'
            }`}>
              <p className={`text-sm text-center ${
                fileType === 'video' && useHQ ? 'text-yellow-300' : 'text-purple-300'
              }`}>
                💰 <span className="font-bold">
                  {fileType === 'video' && useHQ ? '10 credits (HQ)' : '2 credits'}
                </span>
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/10 flex gap-3">
          <button
            onClick={handleClose}
            disabled={isUploading}
            className="flex-1 px-4 py-2.5 bg-white/5 hover:bg-white/10 rounded-lg transition-all text-sm font-semibold text-white disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleUpload}
            disabled={!selectedFile || isUploading || (fileType === 'video' && !prompt.trim())}
            className="flex-1 px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-600 hover:to-cyan-700 rounded-lg transition-all flex items-center justify-center gap-2 text-sm font-semibold text-white shadow-lg shadow-cyan-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isUploading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Upload size={16} />
                Generate
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  )
}
