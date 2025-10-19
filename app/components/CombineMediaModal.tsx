'use client'

import { useState } from 'react'
import { X, Check, Music, Image as ImageIcon, Play, Download } from 'lucide-react'

interface GeneratedItem {
  id: string
  type: 'music' | 'image'
  url: string
  prompt: string
  createdAt: Date
}

interface CombineMediaModalProps {
  isOpen: boolean
  onClose: () => void
  generatedItems: GeneratedItem[]
}

export default function CombineMediaModal({ isOpen, onClose, generatedItems }: CombineMediaModalProps) {
  const [selectedMusic, setSelectedMusic] = useState<string | null>(null)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [isCombining, setIsCombining] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [combinedResult, setCombinedResult] = useState<{ 
    audioUrl: string, 
    imageUrl: string, 
    audioPrompt: string, 
    imagePrompt: string 
  } | null>(null)
  const [savedMediaId, setSavedMediaId] = useState<string | null>(null)

  const musicItems = generatedItems.filter(item => item.type === 'music')
  const imageItems = generatedItems.filter(item => item.type === 'image')

  const handleCombine = () => {
    if (!selectedMusic || !selectedImage) {
      alert('Please select both a music track and an image')
      return
    }

    setIsCombining(true)
    
    // Get the selected items
    const music = generatedItems.find(item => item.id === selectedMusic)
    const image = generatedItems.find(item => item.id === selectedImage)

    if (music && image) {
      setTimeout(() => {
        setCombinedResult({
          audioUrl: music.url,
          imageUrl: image.url,
          audioPrompt: music.prompt,
          imagePrompt: image.prompt
        })
        setIsCombining(false)
      }, 500)
    }
  }

  const handleSaveToProfile = async () => {
    if (!combinedResult) return

    setIsSaving(true)
    try {
      const res = await fetch('/api/media/combine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioUrl: combinedResult.audioUrl,
          imageUrl: combinedResult.imageUrl,
          audioPrompt: combinedResult.audioPrompt,
          imagePrompt: combinedResult.imagePrompt,
          title: `${combinedResult.audioPrompt.substring(0, 50)}...`,
          isPublic: true
        })
      })

      const data = await res.json()

      if (data.success) {
        setSavedMediaId(data.combinedMedia.id)
        alert('✅ Saved to your profile! It will appear in the Explore page.')
      } else {
        alert(`Error: ${data.error}`)
      }
    } catch (error) {
      console.error('Save error:', error)
      alert('Failed to save. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
      <div className="relative w-full max-w-5xl max-h-[90vh] overflow-y-auto bg-gradient-to-br from-slate-900 via-slate-900 to-purple-950/30 rounded-3xl border border-purple-500/20 shadow-2xl shadow-purple-500/10">
        
        {/* Close Button */}
        {!isCombining && (
          <button
            onClick={onClose}
            className="absolute top-6 right-6 p-2 text-purple-400 hover:text-purple-300 transition-colors z-10"
          >
            <X size={24} />
          </button>
        )}

        <div className="p-8">
          {/* Header */}
          <div className="mb-8">
            <h2 className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent mb-2">
              Combine Media
            </h2>
            <p className="text-purple-400/60">Select 1 music track + 1 cover image to create unified media</p>
          </div>

          {/* Combined Preview */}
          {combinedResult && (
            <div className="mb-8 p-6 bg-gradient-to-br from-green-500/20 to-cyan-500/20 rounded-2xl border border-green-500/30">
              <h3 className="text-xl font-bold text-green-400 mb-4">
                {savedMediaId ? '🎉 Saved to Profile!' : '✅ Combined Media Ready!'}
              </h3>
              <div className="flex items-center gap-6">
                <img 
                  src={combinedResult.imageUrl} 
                  alt="Cover" 
                  className="w-48 h-48 rounded-xl object-cover"
                />
                <div className="flex-1">
                  <audio
                    controls
                    src={combinedResult.audioUrl}
                    className="w-full mb-4"
                    style={{
                      filter: 'hue-rotate(90deg) saturate(1.5)',
                      background: 'rgba(16, 185, 129, 0.1)',
                      borderRadius: '0.75rem',
                      padding: '0.5rem'
                    }}
                  />
                  <div className="flex gap-3">
                    {!savedMediaId ? (
                      <button 
                        onClick={handleSaveToProfile}
                        disabled={isSaving}
                        className="px-6 py-3 bg-gradient-to-r from-green-500 to-cyan-500 text-white rounded-xl font-semibold hover:scale-105 transition-transform disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                      >
                        {isSaving ? '💾 Saving...' : '💾 Save to Profile'}
                      </button>
                    ) : (
                      <button 
                        onClick={onClose}
                        className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-semibold hover:scale-105 transition-transform"
                      >
                        ✨ View in Profile
                      </button>
                    )}
                    <button 
                      onClick={() => {
                        const a = document.createElement('a')
                        a.href = combinedResult.audioUrl
                        a.download = 'music.mp3'
                        a.click()
                      }}
                      className="px-6 py-3 bg-purple-500/20 border border-purple-500/30 text-purple-400 rounded-xl font-semibold hover:bg-purple-500/30 transition-colors"
                    >
                      <Download size={20} className="inline mr-2" />
                      Download Audio
                    </button>
                    <button 
                      onClick={() => {
                        const a = document.createElement('a')
                        a.href = combinedResult.imageUrl
                        a.download = 'cover.webp'
                        a.click()
                      }}
                      className="px-6 py-3 bg-purple-500/20 border border-purple-500/30 text-purple-400 rounded-xl font-semibold hover:bg-purple-500/30 transition-colors"
                    >
                      <Download size={20} className="inline mr-2" />
                      Download Image
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Selection Grid */}
          <div className="grid grid-cols-2 gap-6">
            
            {/* Music Selection */}
            <div>
              <h3 className="text-lg font-semibold text-green-400 mb-4 flex items-center gap-2">
                <Music size={20} />
                Select Music Track ({musicItems.length})
              </h3>
              
              {musicItems.length === 0 ? (
                <div className="p-8 border-2 border-dashed border-green-500/30 rounded-2xl text-center">
                  <Music size={48} className="text-green-400/40 mx-auto mb-3" />
                  <p className="text-green-400/60">No music tracks yet</p>
                  <p className="text-sm text-green-400/40 mt-2">Generate music first</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {musicItems.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setSelectedMusic(item.id)}
                      className={`
                        w-full p-4 rounded-xl border-2 transition-all text-left
                        ${selectedMusic === item.id
                          ? 'border-green-500 bg-green-500/20 scale-105'
                          : 'border-green-500/30 bg-black/40 hover:border-green-500/50'
                        }
                      `}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="text-sm text-green-400 font-semibold truncate">{item.prompt}</p>
                          <p className="text-xs text-green-400/60 mt-1">
                            {item.createdAt.toLocaleTimeString()}
                          </p>
                        </div>
                        {selectedMusic === item.id && (
                          <Check size={20} className="text-green-400 flex-shrink-0 ml-2" />
                        )}
                      </div>
                      <audio
                        src={item.url}
                        controls
                        className="w-full mt-2"
                        style={{ height: '32px' }}
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Image Selection */}
            <div>
              <h3 className="text-lg font-semibold text-cyan-400 mb-4 flex items-center gap-2">
                <ImageIcon size={20} />
                Select Cover Image ({imageItems.length})
              </h3>
              
              {imageItems.length === 0 ? (
                <div className="p-8 border-2 border-dashed border-cyan-500/30 rounded-2xl text-center">
                  <ImageIcon size={48} className="text-cyan-400/40 mx-auto mb-3" />
                  <p className="text-cyan-400/60">No images yet</p>
                  <p className="text-sm text-cyan-400/40 mt-2">Generate cover art first</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {imageItems.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setSelectedImage(item.id)}
                      className={`
                        relative rounded-xl border-2 transition-all overflow-hidden group
                        ${selectedImage === item.id
                          ? 'border-cyan-500 scale-105 ring-2 ring-cyan-500/50'
                          : 'border-cyan-500/30 hover:border-cyan-500/50'
                        }
                      `}
                    >
                      <img 
                        src={item.url} 
                        alt="Cover" 
                        className="w-full aspect-square object-cover"
                      />
                      {selectedImage === item.id && (
                        <div className="absolute inset-0 bg-cyan-500/20 flex items-center justify-center">
                          <div className="w-12 h-12 bg-cyan-500 rounded-full flex items-center justify-center">
                            <Check size={24} className="text-white" />
                          </div>
                        </div>
                      )}
                      <div className="absolute bottom-0 left-0 right-0 bg-black/80 p-2">
                        <p className="text-xs text-cyan-400 truncate">{item.prompt}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

          </div>

          {/* Combine Button */}
          <div className="mt-8 flex items-center justify-between">
            <div className="text-sm text-purple-400/60">
              {!selectedMusic && !selectedImage && 'Select both music and image to combine'}
              {selectedMusic && !selectedImage && 'Now select an image'}
              {!selectedMusic && selectedImage && 'Now select a music track'}
              {selectedMusic && selectedImage && 'Ready to combine! '}
            </div>
            
            <button
              onClick={handleCombine}
              disabled={!selectedMusic || !selectedImage || isCombining}
              className="px-8 py-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-2xl font-bold hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center gap-3"
            >
              {isCombining ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                  Combining...
                </>
              ) : (
                <>
                  <Play size={20} />
                  Combine Media
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export { type GeneratedItem }
