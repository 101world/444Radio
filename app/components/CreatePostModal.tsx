'use client'

import { useState, useRef } from 'react'
import { X, Image as ImageIcon, Video, Wand2, Music, Upload, Loader } from 'lucide-react'
import { useUser } from '@clerk/nextjs'

interface CreatePostModalProps {
  isOpen: boolean
  onClose: () => void
  userSongs: Array<{ id: string; title: string; image_url: string; audio_url: string }>
  onPostCreated: () => void
}

export default function CreatePostModal({ isOpen, onClose, userSongs, onPostCreated }: CreatePostModalProps) {
  const { user } = useUser()
  const [content, setContent] = useState('')
  const [mediaType, setMediaType] = useState<'photo' | 'video' | 'ai-art' | null>(null)
  const [mediaFile, setMediaFile] = useState<File | null>(null)
  const [mediaPreview, setMediaPreview] = useState<string | null>(null)
  const [attachedSong, setAttachedSong] = useState<string | null>(null)
  const [showSongPicker, setShowSongPicker] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  if (!isOpen) return null

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setMediaFile(file)
    const preview = URL.createObjectURL(file)
    setMediaPreview(preview)
    
    if (file.type.startsWith('video/')) {
      setMediaType('video')
    } else if (file.type.startsWith('image/')) {
      setMediaType('photo')
    }
  }

  const handlePost = async () => {
    if (!user || (!content && !mediaFile)) return

    setIsUploading(true)
    try {
      let mediaUrl = null
      let thumbnailUrl = null

      // Upload media if exists
      if (mediaFile) {
        const formData = new FormData()
        formData.append('file', mediaFile)
        formData.append('userId', user.id)

        const uploadRes = await fetch('/api/storage/upload', {
          method: 'POST',
          body: formData
        })

        if (uploadRes.ok) {
          const { url } = await uploadRes.json()
          mediaUrl = url
          if (mediaType === 'photo' || mediaType === 'ai-art') {
            thumbnailUrl = url
          }
        }
      }

      // Create post
      const response = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          content,
          mediaType,
          mediaUrl,
          thumbnailUrl,
          attachedSongId: attachedSong
        })
      })

      if (response.ok) {
        onPostCreated()
        handleClose()
      }
    } catch (error) {
      console.error('Error creating post:', error)
      alert('Failed to create post')
    } finally {
      setIsUploading(false)
    }
  }

  const handleClose = () => {
    setContent('')
    setMediaType(null)
    setMediaFile(null)
    setMediaPreview(null)
    setAttachedSong(null)
    setShowSongPicker(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-gradient-to-br from-gray-900 via-black to-gray-900 rounded-2xl border border-cyan-500/30 shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-black/50 backdrop-blur-xl border-b border-cyan-500/20 p-4 flex items-center justify-between z-10">
          <h2 className="text-xl font-black text-white">Create Post</h2>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-white/10 rounded-full transition-all"
          >
            <X size={20} className="text-white" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Text Area */}
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="What's on your mind?"
            className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white placeholder-gray-500 focus:border-cyan-400/50 focus:outline-none resize-none"
            rows={4}
          />

          {/* Media Preview */}
          {mediaPreview && (
            <div className="relative rounded-xl overflow-hidden border border-white/10">
              {mediaType === 'video' ? (
                <video
                  src={mediaPreview}
                  controls
                  className="w-full max-h-96 object-contain bg-black"
                />
              ) : (
                <img
                  src={mediaPreview}
                  alt="Preview"
                  className="w-full max-h-96 object-contain bg-black"
                />
              )}
              <button
                onClick={() => {
                  setMediaFile(null)
                  setMediaPreview(null)
                  setMediaType(null)
                }}
                className="absolute top-2 right-2 p-2 bg-black/70 rounded-full hover:bg-black/90 transition-all"
              >
                <X size={16} className="text-white" />
              </button>
            </div>
          )}

          {/* Attached Song */}
          {attachedSong && (
            <div className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-center gap-3">
              <img
                src={userSongs.find(s => s.id === attachedSong)?.image_url || '/radio-logo.svg'}
                alt="Song"
                className="w-12 h-12 rounded-lg object-cover"
              />
              <div className="flex-1">
                <p className="text-white font-semibold text-sm">
                  {userSongs.find(s => s.id === attachedSong)?.title}
                </p>
                <p className="text-gray-400 text-xs">Attached song</p>
              </div>
              <button
                onClick={() => setAttachedSong(null)}
                className="p-2 hover:bg-white/10 rounded-full transition-all"
              >
                <X size={16} className="text-white" />
              </button>
            </div>
          )}

          {/* Song Picker */}
          {showSongPicker && (
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 max-h-64 overflow-y-auto">
              <h3 className="text-white font-bold mb-3">Choose a song</h3>
              <div className="space-y-2">
                {userSongs.map((song) => (
                  <button
                    key={song.id}
                    onClick={() => {
                      setAttachedSong(song.id)
                      setShowSongPicker(false)
                    }}
                    className="w-full flex items-center gap-3 p-2 hover:bg-white/10 rounded-lg transition-all"
                  >
                    <img
                      src={song.image_url}
                      alt={song.title}
                      className="w-10 h-10 rounded object-cover"
                    />
                    <span className="text-white text-sm font-medium">{song.title}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Media Type Buttons */}
          <div className="flex flex-wrap gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              onChange={handleFileSelect}
              className="hidden"
            />
            
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-all"
            >
              <ImageIcon size={18} className="text-cyan-400" />
              <span className="text-white text-sm font-medium">Photo</span>
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-all"
            >
              <Video size={18} className="text-purple-400" />
              <span className="text-white text-sm font-medium">Video</span>
            </button>

            {userSongs.length > 0 && (
              <button
                onClick={() => setShowSongPicker(!showSongPicker)}
                className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-all"
              >
                <Music size={18} className="text-green-400" />
                <span className="text-white text-sm font-medium">Attach Song</span>
              </button>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-black/50 backdrop-blur-xl border-t border-cyan-500/20 p-4 flex justify-end gap-3">
          <button
            onClick={handleClose}
            className="px-6 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-white font-medium transition-all"
            disabled={isUploading}
          >
            Cancel
          </button>
          <button
            onClick={handlePost}
            disabled={isUploading || (!content && !mediaFile)}
            className="px-6 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white font-bold transition-all flex items-center gap-2"
          >
            {isUploading ? (
              <>
                <Loader size={16} className="animate-spin" />
                <span>Posting...</span>
              </>
            ) : (
              <>
                <Upload size={16} />
                <span>Post</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
