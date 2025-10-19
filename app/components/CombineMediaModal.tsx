'use client'

import { useState, useEffect } from 'react'
import { X, Check, Music, Image as ImageIcon, Play, Download } from 'lucide-react'

interface LibraryMusic {
  id: string
  title: string | null
  prompt: string
  lyrics: string | null
  audio_url: string
  created_at: string
}

interface LibraryImage {
  id: string
  title: string | null
  prompt: string
  image_url: string
  created_at: string
}

interface CombineMediaModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function CombineMediaModal({ isOpen, onClose }: CombineMediaModalProps) {
  const [selectedMusic, setSelectedMusic] = useState<string | null>(null)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [isCombining, setIsCombining] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [musicItems, setMusicItems] = useState<LibraryMusic[]>([])
  const [imageItems, setImageItems] = useState<LibraryImage[]>([])
  const [combinedResult, setCombinedResult] = useState<{ 
    audioUrl: string, 
    imageUrl: string, 
    audioPrompt: string, 
    imagePrompt: string,
    combinedId?: string // ID from combined_media_library
  } | null>(null)
  const [savedMediaId, setSavedMediaId] = useState<string | null>(null)

  // Fetch library items when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchLibraryItems()
    }
  }, [isOpen])

  const fetchLibraryItems = async () => {
    setIsLoading(true)
    try {
      // Fetch music library
      const musicRes = await fetch('/api/library/music')
      const musicData = await musicRes.json()
      
      // Fetch images library
      const imagesRes = await fetch('/api/library/images')
      const imagesData = await imagesRes.json()

      console.log('Music data:', musicData)
      console.log('Images data:', imagesData)

      if (musicData.success && Array.isArray(musicData.music)) {
        setMusicItems(musicData.music)
      } else {
        console.error('Music data is not an array:', musicData)
        setMusicItems([])
      }
      
      if (imagesData.success && Array.isArray(imagesData.images)) {
        setImageItems(imagesData.images)
      } else {
        console.error('Images data is not an array:', imagesData)
        setImageItems([])
      }
    } catch (error) {
      console.error('Error fetching library:', error)
      setMusicItems([])
      setImageItems([])
    } finally {
      setIsLoading(false)
    }
  }

  const handleCombine = async () => {
    if (!selectedMusic || !selectedImage) {
      alert('Please select both a music track and an image')
      return
    }

    setIsCombining(true)
    
    // Get the selected items from library
    const music = musicItems.find(item => item.id === selectedMusic)
    const image = imageItems.find(item => item.id === selectedImage)

    if (music && image) {
      try {
        // Save to combined_media_library
        const res = await fetch('/api/library/combined', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            music_id: music.id,
            image_id: image.id,
            audio_url: music.audio_url,
            image_url: image.image_url,
            music_prompt: music.prompt,
            image_prompt: image.prompt,
            title: music.title || music.prompt.substring(0, 50)
          })
        })

        const data = await res.json()

        if (data.success) {
          setCombinedResult({
            audioUrl: music.audio_url,
            imageUrl: image.image_url,
            audioPrompt: music.prompt,
            imagePrompt: image.prompt,
            combinedId: data.combined.id // Store the library ID
          })
          setIsCombining(false)
          // Show success message
          alert('✅ Media combined and saved to your library!\n\nGo to Library > Combined tab to publish it.')
        } else {
          alert(`Error: ${data.error}`)
          setIsCombining(false)
        }
      } catch (error) {
        console.error('Combine error:', error)
        alert('Failed to combine media')
        setIsCombining(false)
      }
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
            <p className="text-purple-400/60">Select music + cover art from your library to create a release</p>
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-400 mb-4"></div>
              <p className="text-purple-400">Loading your library...</p>
            </div>
          )}

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
                          <p className="text-sm text-green-400 font-semibold truncate">{item.title || item.prompt}</p>
                          <p className="text-xs text-green-400/60 mt-1">
                            {new Date(item.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        {selectedMusic === item.id && (
                          <Check size={20} className="text-green-400 flex-shrink-0 ml-2" />
                        )}
                      </div>
                      <audio
                        src={item.audio_url}
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
                        src={item.image_url} 
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
