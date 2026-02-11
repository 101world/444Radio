'use client'

import { useState, useRef, Suspense, lazy } from 'react'
import { X, Upload, Film, Music, Loader2, AlertCircle, Scissors } from 'lucide-react'

const StemSplitModal = lazy(() => import('@/app/components/studio/StemSplitModal'))

interface MediaUploadModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: (result: any) => void
}

export default function MediaUploadModal({ isOpen, onClose, onSuccess }: MediaUploadModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [fileType, setFileType] = useState<'audio' | 'video' | null>(null)
  const [uploadMode, setUploadMode] = useState<'video-to-audio' | 'audio-remix' | 'stem-split' | null>(null)
  const [prompt, setPrompt] = useState('')
  const [useHQ, setUseHQ] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState('')
  const [error, setError] = useState('')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [showStemModal, setShowStemModal] = useState(false)
  const [uploadedAudioUrl, setUploadedAudioUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const audioFileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, mode: 'video-to-audio' | 'stem-split') => {
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

      // For stem splitting, store the URL and show format modal
      if (uploadMode === 'stem-split') {
        setUploadedAudioUrl(publicUrl)
        setShowStemModal(true)
        setIsUploading(false)
        setUploadProgress('')
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
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setIsUploading(false)
      setUploadProgress('')
    }
  }

  const handleStemSplit = async (format: 'mp3' | 'wav') => {
    if (!uploadedAudioUrl) return

    setShowStemModal(false)
    setIsUploading(true)
    setUploadProgress('Splitting stems... This may take 1-2 minutes.')

    try {
      const response = await fetch('/api/audio/split-stems', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audioUrl: uploadedAudioUrl, format })
      })

      const result = await response.json()

      if (!response.ok || result.error) {
        throw new Error(result.error || 'Stem splitting failed')
      }

      console.log('✅ Stem splitting complete:', result)
      onSuccess?.(result)
      handleClose()
    } catch (err) {
      console.error('Stem splitting error:', err)
      setError(err instanceof Error ? err.message : 'Stem splitting failed')
      setShowStemModal(true) // Re-show modal on error
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
    setShowStemModal(false)
    setUploadedAudioUrl(null)
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
            </div>
          )}

          {/* After File Selected */}
          {selectedFile && (
            <div className="space-y-4">
              
              {/* Compact File Info */}
              <div className="flex items-center gap-3 p-3 bg-white/5 rounded-lg border border-white/10">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  uploadMode === 'stem-split' ? 'bg-teal-500/20' : 'bg-cyan-500/20'
                }`}>
                  {uploadMode === 'stem-split' ? (
                    <Scissors size={20} className="text-teal-400" />
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
            <span className={uploadMode === 'stem-split' ? 'text-teal-400' : useHQ ? 'text-yellow-400' : 'text-cyan-400'}>💰</span>
            <span className={`font-semibold ${
              uploadMode === 'stem-split' ? 'text-teal-400' :
              useHQ ? 'text-yellow-400' : 'text-cyan-400'
            }`}>
              {uploadMode === 'stem-split' ? '5 credits' :
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
                <span>Next</span>
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

      {/* Stem Split Format Selection Modal */}
      {showStemModal && uploadedAudioUrl && (
        <Suspense fallback={null}>
          <StemSplitModal
            isOpen={showStemModal}
            onClose={() => {
              setShowStemModal(false)
              setUploadedAudioUrl(null)
            }}
            onSplit={handleStemSplit}
            clipName={selectedFile?.name || 'Uploaded Audio'}
            isProcessing={isUploading}
          />
        </Suspense>
      )}
    </div>
  )
}
