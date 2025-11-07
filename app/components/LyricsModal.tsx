'use client'

import { useState, useEffect } from 'react'
import { X, Music, Loader2 } from 'lucide-react'

interface LyricsModalProps {
  isOpen: boolean
  onClose: () => void
  mediaId: string
  title?: string
}

export default function LyricsModal({ isOpen, onClose, mediaId, title }: LyricsModalProps) {
  const [lyrics, setLyrics] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen && mediaId) {
      fetchLyrics()
    }
  }, [isOpen, mediaId])

  const fetchLyrics = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const res = await fetch(`/api/media/${mediaId}/lyrics`)
      const data = await res.json()
      
      if (data.success && data.lyrics) {
        setLyrics(data.lyrics)
      } else {
        setError('No lyrics available for this track')
      }
    } catch (err) {
      console.error('Failed to fetch lyrics:', err)
      setError('Failed to load lyrics')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div 
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div 
        className="bg-gradient-to-br from-gray-900 to-black border border-white/10 rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <Music className="text-cyan-400" size={24} />
            <div>
              <h2 className="text-xl font-bold text-white">Lyrics</h2>
              {title && <p className="text-sm text-gray-400">{title}</p>}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-full transition-colors"
          >
            <X className="text-gray-400" size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(80vh-100px)]">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="animate-spin text-cyan-400" size={32} />
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-red-400 mb-4">{error}</p>
              <button
                onClick={fetchLyrics}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors text-white"
              >
                Try Again
              </button>
            </div>
          ) : lyrics ? (
            <pre className="text-white whitespace-pre-wrap font-mono text-sm leading-relaxed bg-white/5 p-6 rounded-xl border border-white/10">
              {lyrics}
            </pre>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-400">No lyrics available</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-white/10 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-3 bg-white/10 hover:bg-white/20 rounded-xl transition-colors text-white font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
