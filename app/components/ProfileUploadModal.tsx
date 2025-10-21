'use client'

import { useState } from 'react'
import { X, Upload, Music, Image as ImageIcon, Video } from 'lucide-react'

interface ProfileUploadModalProps {
  isOpen: boolean
  onClose: () => void
  onUploadComplete: () => void
}

export default function ProfileUploadModal({ isOpen, onClose, onUploadComplete }: ProfileUploadModalProps) {
  const [uploadType, setUploadType] = useState<'music-image' | 'image' | 'video'>('music-image')
  const [uploading, setUploading] = useState(false)
  const [title, setTitle] = useState('')
  
  // Music + Image fields
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  
  // Video field
  const [videoFile, setVideoFile] = useState<File | null>(null)
  
  // Standalone image field
  const [standaloneImageFile, setStandaloneImageFile] = useState<File | null>(null)

  if (!isOpen) return null

  const handleSubmit = async () => {
    if (!title) {
      alert('⚠️ Please enter a title')
      return
    }

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('title', title)
      formData.append('type', uploadType)

      if (uploadType === 'music-image') {
        if (!audioFile || !imageFile) {
          alert('⚠️ Please select both audio and image files')
          return
        }
        formData.append('audio', audioFile)
        formData.append('image', imageFile)
        
        // Use profile upload endpoint for music-image combo
        const res = await fetch('/api/profile/upload', {
          method: 'POST',
          body: formData,
        })

        const data = await res.json()
        if (data.success) {
          alert('✅ Upload successful!')
          onUploadComplete()
          resetForm()
          onClose()
        } else {
          alert(`❌ Upload failed: ${data.error}`)
        }
        return
      } else if (uploadType === 'image') {
        if (!standaloneImageFile) {
          alert('⚠️ Please select an image file')
          return
        }
        formData.append('file', standaloneImageFile)
      } else if (uploadType === 'video') {
        if (!videoFile) {
          alert('⚠️ Please select a video file')
          return
        }
        formData.append('file', videoFile)
      }

      // Use uploads endpoint for standalone images and videos
      const res = await fetch('/api/uploads', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()
      if (data.success) {
        alert('✅ Upload successful!')
        onUploadComplete()
        resetForm()
        onClose()
      } else {
        alert(`❌ Upload failed: ${data.error}`)
      }
    } catch (error) {
      console.error('Upload error:', error)
      alert('❌ Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const resetForm = () => {
    setTitle('')
    setAudioFile(null)
    setImageFile(null)
    setVideoFile(null)
    setStandaloneImageFile(null)
    setUploadType('music-image')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl bg-[#0f1419] border border-[#6366f1]/20 rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-[#0f1419] border-b border-[#6366f1]/20 p-6 flex items-center justify-between z-10">
          <h2 className="text-2xl font-black text-white">Upload Content</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-full transition-colors"
          >
            <X size={24} className="text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Upload Type Selection */}
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-3">
              Content Type
            </label>
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => setUploadType('music-image')}
                className={`p-4 rounded-xl border-2 transition-all ${
                  uploadType === 'music-image'
                    ? 'bg-gradient-to-r from-[#6366f1]/20 to-[#818cf8]/20 border-[#818cf8]'
                    : 'bg-white/5 border-white/10 hover:border-[#818cf8]/50'
                }`}
              >
                <Music className="mx-auto mb-2" size={24} />
                <div className="text-sm font-semibold">Music + Image</div>
              </button>

              <button
                onClick={() => setUploadType('image')}
                className={`p-4 rounded-xl border-2 transition-all ${
                  uploadType === 'image'
                    ? 'bg-gradient-to-r from-[#6366f1]/20 to-[#818cf8]/20 border-[#818cf8]'
                    : 'bg-white/5 border-white/10 hover:border-[#818cf8]/50'
                }`}
              >
                <ImageIcon className="mx-auto mb-2" size={24} />
                <div className="text-sm font-semibold">Image</div>
              </button>

              <button
                onClick={() => setUploadType('video')}
                className={`p-4 rounded-xl border-2 transition-all ${
                  uploadType === 'video'
                    ? 'bg-gradient-to-r from-[#6366f1]/20 to-[#818cf8]/20 border-[#818cf8]'
                    : 'bg-white/5 border-white/10 hover:border-[#818cf8]/50'
                }`}
              >
                <Video className="mx-auto mb-2" size={24} />
                <div className="text-sm font-semibold">Video</div>
              </button>
            </div>
          </div>

          {/* Title Input */}
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">
              Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter title..."
              className="w-full px-4 py-3 bg-[#0f1419] border border-[#6366f1]/20 rounded-xl text-white placeholder-gray-500 focus:border-[#818cf8] focus:outline-none"
            />
          </div>

          {/* File Uploads based on type */}
          {uploadType === 'music-image' && (
            <>
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">
                  Audio File *
                </label>
                <input
                  type="file"
                  accept="audio/*"
                  onChange={(e) => setAudioFile(e.target.files?.[0] || null)}
                  className="w-full px-4 py-3 bg-[#0f1419] border border-[#6366f1]/20 rounded-xl text-white file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-[#6366f1] file:text-white hover:file:bg-[#818cf8] cursor-pointer"
                />
                {audioFile && (
                  <p className="mt-2 text-sm text-[#818cf8]">Selected: {audioFile.name}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">
                  Cover Image *
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                  className="w-full px-4 py-3 bg-[#0f1419] border border-[#6366f1]/20 rounded-xl text-white file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-[#6366f1] file:text-white hover:file:bg-[#818cf8] cursor-pointer"
                />
                {imageFile && (
                  <p className="mt-2 text-sm text-[#818cf8]">Selected: {imageFile.name}</p>
                )}
              </div>
            </>
          )}

          {uploadType === 'image' && (
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">
                Image File *
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setStandaloneImageFile(e.target.files?.[0] || null)}
                className="w-full px-4 py-3 bg-[#0f1419] border border-[#6366f1]/20 rounded-xl text-white file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-[#6366f1] file:text-white hover:file:bg-[#818cf8] cursor-pointer"
              />
              {standaloneImageFile && (
                <p className="mt-2 text-sm text-[#818cf8]">Selected: {standaloneImageFile.name}</p>
              )}
            </div>
          )}

          {uploadType === 'video' && (
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">
                Video File *
              </label>
              <input
                type="file"
                accept="video/*"
                onChange={(e) => setVideoFile(e.target.files?.[0] || null)}
                className="w-full px-4 py-3 bg-[#0f1419] border border-[#6366f1]/20 rounded-xl text-white file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-[#6366f1] file:text-white hover:file:bg-[#818cf8] cursor-pointer"
              />
              {videoFile && (
                <p className="mt-2 text-sm text-[#818cf8]">Selected: {videoFile.name}</p>
              )}
            </div>
          )}

          {/* Upload Button */}
          <button
            onClick={handleSubmit}
            disabled={uploading}
            className="w-full px-6 py-4 bg-gradient-to-r from-[#6366f1] to-[#818cf8] text-white rounded-xl font-bold hover:scale-105 transition-transform disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 shadow-lg shadow-[#6366f1]/30"
          >
            {uploading ? (
              <>
                <Upload className="inline mr-2 animate-bounce" size={20} />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="inline mr-2" size={20} />
                Upload to Profile
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
