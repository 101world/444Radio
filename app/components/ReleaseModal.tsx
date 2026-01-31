'use client'

import { useState } from 'react'
import { X, Send, Loader2, ImageIcon } from 'lucide-react'

interface LibraryImage {
  id: string
  title: string | null
  prompt: string
  image_url: string
  created_at: string
  file_size: number | null
}

interface ReleaseModalProps {
  isOpen: boolean
  onClose: () => void
  musicItem: {
    id: string
    title: string | null
    audio_url: string
    prompt: string
    lyrics: string | null
  }
  imageItems: LibraryImage[]
  onSuccess: () => void
}

export default function ReleaseModal({ isOpen, onClose, musicItem, imageItems, onSuccess }: ReleaseModalProps) {
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null)
  const [isReleasing, setIsReleasing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const selectedImage = imageItems.find(img => img.id === selectedImageId)

  const handleRelease = async () => {
    if (!selectedImage) {
      setError('Please select a cover image')
      return
    }

    console.log('🔍 [RELEASE DEBUG] musicItem:', musicItem)
    console.log('🔍 [RELEASE DEBUG] musicItem.title:', musicItem.title)

    setIsReleasing(true)
    setError(null)

    try {
      const titleToSend = musicItem.title || 'Untitled Track'
      console.log('🔍 [RELEASE DEBUG] Title being sent to API:', titleToSend)
      
      const response = await fetch('/api/media/combine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioUrl: musicItem.audio_url,
          imageUrl: selectedImage.image_url,
          title: titleToSend,
          audioPrompt: musicItem.prompt,
          imagePrompt: selectedImage.prompt,
          isPublic: true,
          metadata: {
            genre: 'unknown',
            mood: 'unknown',
            tags: [],
            description: musicItem.prompt,
            vocals: musicItem.lyrics ? 'with-lyrics' : 'instrumental',
            language: 'english'
          }
        })
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to release track')
      }

      onSuccess()
      onClose()
    } catch (err) {
      console.error('Release error:', err)
      setError(err instanceof Error ? err.message : 'Failed to release track')
    } finally {
      setIsReleasing(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-xl flex items-center justify-center z-[100] p-4">
      <div className="bg-black/60 backdrop-blur-3xl border border-cyan-500/30 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl shadow-cyan-500/20">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-cyan-500/20">
          <div>
            <h2 className="text-2xl font-bold text-white mb-1">Release Track</h2>
            <p className="text-cyan-400/60 text-sm">
              {musicItem.title || 'Untitled Track'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all border border-white/10"
          >
            <X size={20} className="text-white/60" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          <h3 className="text-lg font-semibold text-white mb-4">Select Cover Art</h3>

          {imageItems.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-purple-500/20 to-purple-400/10 border border-purple-500/30 flex items-center justify-center">
                <ImageIcon size={32} className="text-purple-400" />
              </div>
              <h3 className="text-xl font-bold text-white/80 mb-2">No cover art available</h3>
              <p className="text-purple-400/50 mb-6 text-sm">Generate some images first to use as cover art</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {imageItems.map((image) => (
                <button
                  key={image.id}
                  onClick={() => setSelectedImageId(image.id)}
                  className={`relative aspect-square rounded-xl overflow-hidden transition-all ${
                    selectedImageId === image.id
                      ? 'ring-4 ring-cyan-500 ring-offset-4 ring-offset-black scale-105'
                      : 'hover:scale-105 border border-white/10 hover:border-cyan-500/50'
                  }`}
                >
                  <img
                    src={image.image_url}
                    alt={image.title || 'Cover art'}
                    className="w-full h-full object-cover"
                  />
                  {selectedImageId === image.id && (
                    <div className="absolute inset-0 bg-cyan-500/20 flex items-center justify-center">
                      <div className="w-12 h-12 rounded-full bg-cyan-500 flex items-center justify-center">
                        <Send size={20} className="text-black" />
                      </div>
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {imageItems.length > 0 && (
          <div className="p-6 border-t border-cyan-500/20">
            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={onClose}
                disabled={isReleasing}
                className="flex-1 px-6 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl font-semibold transition-all disabled:opacity-50 border border-white/10"
              >
                Cancel
              </button>
              <button
                onClick={handleRelease}
                disabled={!selectedImageId || isReleasing}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-cyan-600 to-cyan-400 hover:from-cyan-700 hover:to-cyan-500 text-black rounded-xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2"
              >
                {isReleasing ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Releasing...
                  </>
                ) : (
                  <>
                    <Send size={18} />
                    Release Track
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
