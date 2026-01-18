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
  const [isUploading, setIsUploading] = useState(false)
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

    // Validate duration (will be checked more thoroughly on server)
    const media = document.createElement(isVideo ? 'video' : 'audio') as HTMLVideoElement | HTMLAudioElement
    const objectUrl = URL.createObjectURL(file)
    
    media.onloadedmetadata = () => {
      const duration = media.duration
      
      if (isVideo && duration > 5) {
        setError('Video must be 5 seconds or less')
        URL.revokeObjectURL(objectUrl)
        return
      }
      
      if (isAudio && duration > 30) {
        setError('Audio must be 30 seconds or less')
        URL.revokeObjectURL(objectUrl)
        return
      }
      
      // File is valid
      setSelectedFile(file)
      setFileType(isVideo ? 'video' : 'audio')
      setPreviewUrl(objectUrl)
    }
    
    media.onerror = () => {
      setError('Failed to load media file')
      URL.revokeObjectURL(objectUrl)
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
      const formData = new FormData()
      formData.append('file', selectedFile)
      formData.append('prompt', prompt)
      formData.append('type', fileType)

      const endpoint = fileType === 'video' 
        ? '/api/generate/video-to-audio'
        : '/api/generate/audio-to-audio'

      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData
      })

      const result = await response.json()

      if (!response.ok || result.error) {
        throw new Error(result.error || 'Generation failed')
      }

      onSuccess?.(result)
      handleClose()
    } catch (err) {
      console.error('Upload error:', err)
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setIsUploading(false)
    }
  }

  const handleClose = () => {
    setSelectedFile(null)
    setFileType(null)
    setPrompt('')
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
            <div className="p-4 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
              <p className="text-sm text-cyan-300">
                {fileType === 'video' ? (
                  <>
                    <strong>Video to Audio:</strong> Generate sync sound effects for your video
                  </>
                ) : (
                  <>
                    <strong>Audio Remix:</strong> Create variations of your audio
                  </>
                )}
              </p>
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
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-2">
              <AlertCircle size={18} className="text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}

          {/* Credit Cost */}
          {selectedFile && (
            <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg">
              <p className="text-sm text-purple-300 text-center">
                💰 <span className="font-bold">2 credits</span>
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
