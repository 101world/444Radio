'use client'

import { useState } from 'react'
import { X, Download, Maximize2, Minimize2 } from 'lucide-react'
import Image from 'next/image'

interface CoverArtModalProps {
  isOpen: boolean
  onClose: () => void
  imageUrl: string
  title?: string
  artist?: string
  onDownload?: () => void
}

export default function CoverArtModal({ 
  isOpen, 
  onClose, 
  imageUrl, 
  title, 
  artist,
  onDownload 
}: CoverArtModalProps) {
  const [isFullscreen, setIsFullscreen] = useState(false)

  if (!isOpen) return null

  const handleDownload = () => {
    if (onDownload) {
      onDownload()
    } else {
      // Default download logic
      const link = document.createElement('a')
      link.href = imageUrl
      link.download = `${title || 'cover-art'}.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
  }

  return (
    <div 
      className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fadeIn"
      onClick={onClose}
    >
      <div 
        className={`relative bg-gradient-to-br from-gray-900 to-black border border-white/10 rounded-2xl overflow-hidden shadow-2xl transition-all duration-300 ${
          isFullscreen ? 'w-full h-full max-w-none max-h-none' : 'max-w-4xl w-full max-h-[90vh]'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/80 to-transparent z-10 flex items-center justify-between">
          <div className="flex-1 min-w-0 mr-4">
            {title && (
              <h2 className="text-xl font-bold text-white truncate">{title}</h2>
            )}
            {artist && (
              <p className="text-sm text-gray-400 truncate">{artist}</p>
            )}
          </div>
          
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-2 hover:bg-white/10 rounded-full transition-colors"
              title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? (
                <Minimize2 className="text-white" size={20} />
              ) : (
                <Maximize2 className="text-white" size={20} />
              )}
            </button>
            
            <button
              onClick={handleDownload}
              className="p-2 hover:bg-white/10 rounded-full transition-colors"
              title="Download"
            >
              <Download className="text-white" size={20} />
            </button>
            
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-full transition-colors"
              title="Close"
            >
              <X className="text-white" size={24} />
            </button>
          </div>
        </div>

        {/* Image Container */}
        <div className={`relative ${isFullscreen ? 'w-full h-full' : 'aspect-square'} flex items-center justify-center bg-black`}>
          <Image
            src={imageUrl}
            alt={title || 'Cover Art'}
            fill
            className="object-contain"
            quality={100}
            priority
          />
        </div>

        {/* Footer Info (hidden in fullscreen) */}
        {!isFullscreen && (
          <div className="p-6 border-t border-white/10 bg-black/40 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Cover Art</p>
                <p className="text-xs text-gray-500 mt-1">
                  Click outside or press ESC to close
                </p>
              </div>
              <button
                onClick={handleDownload}
                className="px-6 py-3 bg-gradient-to-r from-cyan-600 to-cyan-400 hover:from-cyan-700 hover:to-cyan-500 rounded-xl transition-all text-white font-medium shadow-lg shadow-cyan-500/20 active:scale-95"
              >
                Download
              </button>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }
      `}</style>
    </div>
  )
}
