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
  
  // Metadata fields
  const [metadata, setMetadata] = useState({
    genre: '',
    mood: '',
    bpm: '',
    key: '',
    copyrightOwner: '',
    license: 'exclusive', // exclusive, non-exclusive, creative-commons
    price: '',
    tags: ''
  })

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

      console.log('Music data:', JSON.stringify(musicData, null, 2))
      console.log('Images data:', JSON.stringify(imagesData, null, 2))

      if (musicData.success && Array.isArray(musicData.music)) {
        console.log('✅ Music array length:', musicData.music.length)
        console.log('First music item:', musicData.music[0])
        setMusicItems(musicData.music)
      } else {
        console.error('❌ Music data is not an array:', musicData)
        setMusicItems([])
      }
      
      if (imagesData.success && Array.isArray(imagesData.images)) {
        console.log('✅ Images array length:', imagesData.images.length)
        console.log('First image item:', imagesData.images[0])
        setImageItems(imagesData.images)
      } else {
        console.error('❌ Images data is not an array:', imagesData)
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
    console.log('Selected music ID:', selectedMusic)
    console.log('Selected image ID:', selectedImage)
    console.log('Music items:', musicItems)
    console.log('Image items:', imageItems)
    
    const music = musicItems.find(item => item.id === selectedMusic)
    const image = imageItems.find(item => item.id === selectedImage)

    console.log('Found music:', music)
    console.log('Found image:', image)

    if (!music) {
      alert('❌ Selected music not found in library. Please try again.')
      setIsCombining(false)
      return
    }

    if (!image) {
      alert('❌ Selected image not found in library. Please try again.')
      setIsCombining(false)
      return
    }

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
      console.log('API Response:', JSON.stringify(data, null, 2))

      if (data.success) {
        const combinedId = data.combined?.id || null
        console.log('Combined ID:', combinedId)
        
        setCombinedResult({
          audioUrl: music.audio_url,
          imageUrl: image.image_url,
          audioPrompt: music.prompt,
          imagePrompt: image.prompt,
          combinedId: combinedId // Store the library ID (may be null)
        })
        setIsCombining(false)
        // Show success message
        alert('✅ Media combined and saved to your library!\n\nGo to Library > Combined tab to publish it.')
      } else {
        alert(`Error: ${data.error || 'Unknown error'}`)
        setIsCombining(false)
      }
    } catch (error) {
      console.error('Combine error:', error)
      alert('Failed to combine media')
      setIsCombining(false)
    }
  }

  const handleSaveToProfile = async () => {
    if (!combinedResult) {
      alert('⚠️ No combined media found. Please combine music and image first.')
      return
    }

    // Validate required metadata
    if (!metadata.genre || !metadata.mood || !metadata.copyrightOwner) {
      alert('⚠️ Please fill in required fields: Genre, Mood, and Copyright Owner')
      return
    }

    // Check if we have a combinedId from the library
    if (!combinedResult.combinedId) {
      console.error('❌ combinedResult:', combinedResult)
      alert('⚠️ No combined media ID found. Please try combining again.')
      return
    }

    setIsSaving(true)
    try {
      console.log('🚀 PUBLISHING TO EXPLORE/PROFILE')
      console.log('Combined ID:', combinedResult.combinedId)
      console.log('Combined ID type:', typeof combinedResult.combinedId)
      console.log('Metadata:', metadata)
      console.log('Endpoint: PATCH /api/library/combined')
      console.log('Timestamp:', new Date().toISOString())
      
      const requestBody = {
        combinedId: combinedResult.combinedId,
        is_published: true,
        title: `${combinedResult.audioPrompt.substring(0, 50)}`,
        // Metadata for filtering and monetization
        genre: metadata.genre,
        mood: metadata.mood,
        bpm: metadata.bpm ? parseInt(metadata.bpm) : null,
        key: metadata.key,
        copyright_owner: metadata.copyrightOwner,
        license_type: metadata.license,
        price: metadata.price ? parseFloat(metadata.price) : null,
        tags: metadata.tags.split(',').map(t => t.trim()).filter(Boolean)
      }
      
      console.log('📦 Request Body:', JSON.stringify(requestBody, null, 2))
      
      // Update the existing combined_media_library record to publish it
      const res = await fetch('/api/library/combined', {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        },
        body: JSON.stringify(requestBody)
      })

      console.log('📡 Response status:', res.status)
      console.log('📡 Response headers:', Object.fromEntries(res.headers.entries()))
      
      const data = await res.json()
      console.log('📡 Response data:', JSON.stringify(data, null, 2))

      if (data.success) {
        setSavedMediaId(data.combined.id)
        alert('✅ Published to Explore and your Profile!\n\n🎵 Your track is now live with copyright protection.\n📍 Metadata saved for filtering and monetization.')
      } else {
        console.error('❌ Publish failed:', data)
        alert(`Error: ${data.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('❌ Publish error:', error)
      alert('Failed to publish. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/95 backdrop-blur-2xl">
      <div className="relative w-full max-w-5xl max-h-[90vh] overflow-y-auto bg-gradient-to-br from-black via-cyan-950/20 to-black rounded-3xl border border-cyan-500/30 shadow-2xl shadow-cyan-500/20 backdrop-blur-2xl">
        
        {/* Close Button */}
        {!isCombining && (
          <button
            onClick={onClose}
            className="absolute top-6 right-6 p-2 text-cyan-400 hover:text-cyan-300 transition-colors z-10"
          >
            <X size={24} />
          </button>
        )}

        <div className="p-8">
          {/* Header */}
          <div className="mb-8">
            <h2 className="text-4xl font-bold bg-gradient-to-r from-cyan-400 via-cyan-300 to-white bg-clip-text text-transparent mb-2">
              Combine Media
            </h2>
            <p className="text-cyan-400/60">Select music + cover art from your library to create a release</p>
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400 mb-4"></div>
              <p className="text-cyan-400">Loading your library...</p>
            </div>
          )}

          {/* Combined Preview */}
          {combinedResult && (
            <div className="mb-8 p-6 bg-gradient-to-br from-cyan-500/10 via-cyan-400/10 to-cyan-300/10 rounded-2xl border border-cyan-500/40 backdrop-blur-xl shadow-lg shadow-cyan-500/10">
              <h3 className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-cyan-300 bg-clip-text text-transparent mb-4">
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
                  
                  {/* Metadata Form - Only show if not saved */}
                  {!savedMediaId && (
                    <div className="mb-4 p-4 bg-cyan-950/20 rounded-xl border border-cyan-500/20">
                      <h4 className="text-sm font-bold text-cyan-400 mb-3">📋 Track Metadata (Required for Publishing)</h4>
                      
                      <div className="grid grid-cols-2 gap-3">
                        {/* Genre */}
                        <div>
                          <label className="text-xs text-gray-400 mb-1 block">Genre *</label>
                          <select
                            value={metadata.genre}
                            onChange={(e) => setMetadata({...metadata, genre: e.target.value})}
                            className="w-full px-3 py-2 bg-black border border-cyan-500/20 rounded-lg text-white text-sm focus:border-cyan-500 focus:outline-none"
                          >
                            <option value="">Select genre</option>
                            <option value="pop">Pop</option>
                            <option value="hip-hop">Hip-Hop</option>
                            <option value="electronic">Electronic</option>
                            <option value="rock">Rock</option>
                            <option value="jazz">Jazz</option>
                            <option value="classical">Classical</option>
                            <option value="r&b">R&B</option>
                            <option value="country">Country</option>
                            <option value="indie">Indie</option>
                            <option value="metal">Metal</option>
                          </select>
                        </div>

                        {/* Mood */}
                        <div>
                          <label className="text-xs text-gray-400 mb-1 block">Mood *</label>
                          <select
                            value={metadata.mood}
                            onChange={(e) => setMetadata({...metadata, mood: e.target.value})}
                            className="w-full px-3 py-2 bg-black border border-cyan-500/20 rounded-lg text-white text-sm focus:border-cyan-500 focus:outline-none"
                          >
                            <option value="">Select mood</option>
                            <option value="energetic">Energetic</option>
                            <option value="chill">Chill</option>
                            <option value="dark">Dark</option>
                            <option value="happy">Happy</option>
                            <option value="sad">Sad</option>
                            <option value="aggressive">Aggressive</option>
                            <option value="romantic">Romantic</option>
                            <option value="dreamy">Dreamy</option>
                          </select>
                        </div>

                        {/* BPM */}
                        <div>
                          <label className="text-xs text-gray-400 mb-1 block">BPM</label>
                          <input
                            type="number"
                            value={metadata.bpm}
                            onChange={(e) => setMetadata({...metadata, bpm: e.target.value})}
                            placeholder="120"
                            className="w-full px-3 py-2 bg-black border border-cyan-500/20 rounded-lg text-white text-sm focus:border-cyan-500 focus:outline-none"
                          />
                        </div>

                        {/* Key */}
                        <div>
                          <label className="text-xs text-gray-400 mb-1 block">Key</label>
                          <input
                            type="text"
                            value={metadata.key}
                            onChange={(e) => setMetadata({...metadata, key: e.target.value})}
                            placeholder="C Major"
                            className="w-full px-3 py-2 bg-black border border-cyan-500/20 rounded-lg text-white text-sm focus:border-cyan-500 focus:outline-none"
                          />
                        </div>

                        {/* Copyright Owner */}
                        <div className="col-span-2">
                          <label className="text-xs text-gray-400 mb-1 block">Copyright Owner * (Your Name/Artist Name)</label>
                          <input
                            type="text"
                            value={metadata.copyrightOwner}
                            onChange={(e) => setMetadata({...metadata, copyrightOwner: e.target.value})}
                            placeholder="Your Artist Name"
                            className="w-full px-3 py-2 bg-black border border-cyan-500/20 rounded-lg text-white text-sm focus:border-cyan-500 focus:outline-none"
                          />
                        </div>

                        {/* License Type */}
                        <div>
                          <label className="text-xs text-gray-400 mb-1 block">License Type</label>
                          <select
                            value={metadata.license}
                            onChange={(e) => setMetadata({...metadata, license: e.target.value})}
                            className="w-full px-3 py-2 bg-black border border-cyan-500/20 rounded-lg text-white text-sm focus:border-cyan-500 focus:outline-none"
                          >
                            <option value="exclusive">Exclusive Rights (Full ownership)</option>
                            <option value="non-exclusive">Non-Exclusive (Can be shared)</option>
                            <option value="creative-commons">Creative Commons</option>
                          </select>
                        </div>

                        {/* Price */}
                        <div>
                          <label className="text-xs text-gray-400 mb-1 block">Price (USD) - Optional</label>
                          <input
                            type="number"
                            step="0.01"
                            value={metadata.price}
                            onChange={(e) => setMetadata({...metadata, price: e.target.value})}
                            placeholder="0.00"
                            className="w-full px-3 py-2 bg-black border border-cyan-500/20 rounded-lg text-white text-sm focus:border-cyan-500 focus:outline-none"
                          />
                        </div>

                        {/* Tags */}
                        <div className="col-span-2">
                          <label className="text-xs text-gray-400 mb-1 block">Tags (comma separated)</label>
                          <input
                            type="text"
                            value={metadata.tags}
                            onChange={(e) => setMetadata({...metadata, tags: e.target.value})}
                            placeholder="ambient, chill, study, beats"
                            className="w-full px-3 py-2 bg-black border border-cyan-500/20 rounded-lg text-white text-sm focus:border-cyan-500 focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div className="flex gap-3">
                    {!savedMediaId ? (
                      <button 
                        onClick={handleSaveToProfile}
                        disabled={isSaving}
                        className="px-6 py-3 bg-gradient-to-r from-[#6366f1] to-[#818cf8] text-white rounded-xl font-semibold hover:scale-105 transition-transform disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 shadow-lg shadow-[#6366f1]/30"
                      >
                        {isSaving ? '� Releasing...' : '� Release'}
                      </button>
                    ) : (
                      <button 
                        onClick={onClose}
                        className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-cyan-400 text-white rounded-xl font-semibold hover:scale-105 transition-transform shadow-lg shadow-cyan-500/30"
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
                      className="px-6 py-3 bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 rounded-xl font-semibold hover:bg-cyan-500/20 transition-colors backdrop-blur-xl"
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
                      className="px-6 py-3 bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 rounded-xl font-semibold hover:bg-cyan-500/20 transition-colors backdrop-blur-xl"
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
            <div className="text-sm text-cyan-400/60">
              {!selectedMusic && !selectedImage && 'Select both music and image to combine'}
              {selectedMusic && !selectedImage && 'Now select an image'}
              {!selectedMusic && selectedImage && 'Now select a music track'}
              {selectedMusic && selectedImage && 'Ready to combine! '}
            </div>
            
            <button
              onClick={handleCombine}
              disabled={!selectedMusic || !selectedImage || isCombining}
              className="px-8 py-4 bg-gradient-to-r from-cyan-500 to-cyan-600 text-white rounded-2xl font-bold hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center gap-3"
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

