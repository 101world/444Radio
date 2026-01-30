'use client'

import { useState, useEffect } from 'react'
import { X, Music, Image as ImageIcon, Rocket, ChevronRight, Check } from 'lucide-react'

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

interface TwoStepReleaseModalProps {
  isOpen: boolean
  onClose: () => void
  preselectedMusic?: string
  preselectedImage?: string
}

export default function TwoStepReleaseModal({ 
  isOpen, 
  onClose,
  preselectedMusic,
  preselectedImage 
}: TwoStepReleaseModalProps) {
  const [step, setStep] = useState<1 | 2>(1)
  const [selectedMusic, setSelectedMusic] = useState<string | null>(preselectedMusic || null)
  const [selectedImage, setSelectedImage] = useState<string | null>(preselectedImage || null)
  const [isLoading, setIsLoading] = useState(true)
  const [musicItems, setMusicItems] = useState<LibraryMusic[]>([])
  const [imageItems, setImageItems] = useState<LibraryImage[]>([])
  const [isPublishing, setIsPublishing] = useState(false)

  // Step 2: Metadata
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [tags, setTags] = useState('')
  const [isPublic, setIsPublic] = useState(true)
  
  // Mandatory metadata fields
  const [genre, setGenre] = useState('')
  const [mood, setMood] = useState('')
  const [bpm, setBpm] = useState('')
  const [vocals, setVocals] = useState('none')
  const [language, setLanguage] = useState('instrumental')

  // Fetch library items when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchLibraryItems()
      setStep(1)
      setSelectedMusic(preselectedMusic || null)
      setSelectedImage(preselectedImage || null)
    }
  }, [isOpen, preselectedMusic, preselectedImage])

  const fetchLibraryItems = async () => {
    setIsLoading(true)
    try {
      const [musicRes, imagesRes] = await Promise.all([
        fetch('/api/library/music'),
        fetch('/api/library/images')
      ])
      
      const musicData = await musicRes.json()
      const imagesData = await imagesRes.json()

      if (musicData.success && Array.isArray(musicData.music)) {
        setMusicItems(musicData.music)
      }
      
      if (imagesData.success && Array.isArray(imagesData.images)) {
        setImageItems(imagesData.images)
      }
    } catch (error) {
      console.error('Error fetching library:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleNextStep = () => {
    if (!selectedMusic || !selectedImage) {
      alert('Please select both music and cover art to continue')
      return
    }

    // Auto-fill title from music if available
    const music = musicItems.find(m => m.id === selectedMusic)
    console.log('🔍 [RELEASE DEBUG] Music item found:', music)
    console.log('🔍 [RELEASE DEBUG] music.title:', music?.title)
    if (music && !title) {
      const autoFilledTitle = music.title || music.prompt.substring(0, 50)
      console.log('🔍 [RELEASE DEBUG] Auto-filling title with:', autoFilledTitle)
      setTitle(autoFilledTitle)
    }

    setStep(2)
  }

  const handlePublish = async () => {
    // Validate mandatory fields
    if (!title.trim()) {
      alert('Please enter a title for your release')
      return
    }
    if (!genre) {
      alert('Please select a genre')
      return
    }
    if (!mood) {
      alert('Please select a mood')
      return
    }

    setIsPublishing(true)
    try {
      const music = musicItems.find(m => m.id === selectedMusic)
      const image = imageItems.find(i => i.id === selectedImage)

      if (!music || !image) {
        throw new Error('Selected media not found')
      }

      // Combine media with full metadata
      const combineRes = await fetch('/api/media/combine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioUrl: music.audio_url,
          imageUrl: image.image_url,
          title: title.trim(),
          audioPrompt: music.prompt,
          imagePrompt: image.prompt,
          isPublic: isPublic,
          metadata: {
            description: description.trim(),
            tags: tags.split(',').map(t => t.trim()).filter(Boolean),
            genre: genre,
            mood: mood,
            bpm: bpm ? parseInt(bpm) : null,
            vocals: vocals,
            language: language
          }
        })
      })

      const combineData = await combineRes.json()
      if (!combineData.success) {
        throw new Error(combineData.error || 'Failed to combine media')
      }

      alert('🚀 Release published successfully!')
      onClose()
    } catch (error) {
      console.error('Error publishing:', error)
      alert(error instanceof Error ? error.message : 'Failed to publish release')
    } finally {
      setIsPublishing(false)
    }
  }

  const handleBack = () => {
    setStep(1)
  }

  if (!isOpen) return null

  const selectedMusicItem = musicItems.find(m => m.id === selectedMusic)
  const selectedImageItem = imageItems.find(i => i.id === selectedImage)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fadeIn">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-black/90 backdrop-blur-2xl border border-cyan-500/30 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <Rocket size={24} className="text-cyan-400" />
            <div>
              <h2 className="text-xl font-bold text-white">Release Your Track</h2>
              <p className="text-xs text-gray-400">
                {step === 1 ? 'Step 1: Select Media' : 'Step 2: Add Details'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
          >
            <X size={20} className="text-gray-400" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="px-6 py-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className={`flex-1 h-1 rounded-full transition-all ${step >= 1 ? 'bg-cyan-500' : 'bg-white/10'}`} />
            <div className={`flex-1 h-1 rounded-full transition-all ${step >= 2 ? 'bg-cyan-500' : 'bg-white/10'}`} />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          
          {/* STEP 1: Select Media */}
          {step === 1 && (
            <div className="p-6 space-y-6">
              
              {/* Selection Summary */}
              {(selectedMusic || selectedImage) && (
                <div className="flex gap-4 p-4 bg-cyan-500/10 border border-cyan-500/30 rounded-xl">
                  {selectedMusicItem && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-black/40 rounded-lg">
                      <Music size={16} className="text-cyan-400" />
                      <span className="text-sm text-white">{selectedMusicItem.title || 'Music'}</span>
                      <Check size={16} className="text-green-400" />
                    </div>
                  )}
                  {selectedImageItem && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-black/40 rounded-lg">
                      <ImageIcon size={16} className="text-cyan-400" />
                      <span className="text-sm text-white">{selectedImageItem.title || 'Cover'}</span>
                      <Check size={16} className="text-green-400" />
                    </div>
                  )}
                </div>
              )}

              {/* Music Selection */}
              <div>
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
                  Select Music Track
                </h3>
                <div className="grid grid-cols-2 gap-3 max-h-64 overflow-y-auto">
                  {isLoading ? (
                    <p className="col-span-2 text-gray-500 text-sm text-center py-8">Loading...</p>
                  ) : musicItems.length === 0 ? (
                    <p className="col-span-2 text-gray-500 text-sm text-center py-8">No music tracks yet</p>
                  ) : (
                    musicItems.map((music) => (
                      <button
                        key={music.id}
                        onClick={() => setSelectedMusic(music.id)}
                        className={`p-3 rounded-xl transition-all text-left ${
                          selectedMusic === music.id
                            ? 'bg-cyan-500/20 border-2 border-cyan-500'
                            : 'bg-white/5 border-2 border-white/10 hover:border-cyan-500/50'
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <Music size={16} className="text-cyan-400 mt-1 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white truncate">
                              {music.title || 'Untitled'}
                            </p>
                            <p className="text-xs text-gray-400 truncate mt-1">
                              {music.prompt.substring(0, 40)}...
                            </p>
                          </div>
                          {selectedMusic === music.id && (
                            <Check size={16} className="text-cyan-400 flex-shrink-0" />
                          )}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* Image Selection */}
              <div>
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
                  Select Cover Art
                </h3>
                <div className="grid grid-cols-3 gap-3 max-h-64 overflow-y-auto">
                  {isLoading ? (
                    <p className="col-span-3 text-gray-500 text-sm text-center py-8">Loading...</p>
                  ) : imageItems.length === 0 ? (
                    <p className="col-span-3 text-gray-500 text-sm text-center py-8">No cover art yet</p>
                  ) : (
                    imageItems.map((image) => (
                      <button
                        key={image.id}
                        onClick={() => setSelectedImage(image.id)}
                        className={`aspect-square rounded-xl overflow-hidden transition-all ${
                          selectedImage === image.id
                            ? 'ring-4 ring-cyan-500'
                            : 'ring-2 ring-white/10 hover:ring-cyan-500/50'
                        }`}
                      >
                        <div className="relative w-full h-full">
                          <img
                            src={image.image_url}
                            alt={image.title || 'Cover art'}
                            className="w-full h-full object-cover"
                          />
                          {selectedImage === image.id && (
                            <div className="absolute inset-0 bg-cyan-500/20 flex items-center justify-center">
                              <Check size={32} className="text-white" />
                            </div>
                          )}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>

            </div>
          )}

          {/* STEP 2: Metadata */}
          {step === 2 && (
            <div className="p-6 space-y-5">
              
              {/* Preview */}
              <div className="flex gap-4 p-4 bg-white/5 rounded-xl">
                {selectedImageItem && (
                  <img
                    src={selectedImageItem.image_url}
                    alt="Cover"
                    className="w-24 h-24 rounded-lg object-cover"
                  />
                )}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Music size={16} className="text-cyan-400" />
                    <span className="text-sm font-medium text-white">
                      {selectedMusicItem?.title || 'Untitled'}
                    </span>
                  </div>
                  {selectedMusicItem && (
                    <audio controls className="w-full h-8">
                      <source src={selectedMusicItem.audio_url} type="audio/mpeg" />
                    </audio>
                  )}
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block text-sm font-semibold text-gray-400 uppercase tracking-wide mb-2">
                  Title *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter track title..."
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 transition-all"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-semibold text-gray-400 uppercase tracking-wide mb-2">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Tell people about your track..."
                  rows={3}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 transition-all resize-none"
                />
              </div>

              {/* Genre (Mandatory) */}
              <div>
                <label className="block text-sm font-semibold text-gray-400 uppercase tracking-wide mb-2">
                  Genre * <span className="text-red-400">(Required)</span>
                </label>
                <select
                  value={genre}
                  onChange={(e) => setGenre(e.target.value)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-cyan-500/50 transition-all"
                >
                  <option value="" className="bg-black">Select genre...</option>
                  <option value="Pop" className="bg-black">Pop</option>
                  <option value="Hip-Hop" className="bg-black">Hip-Hop</option>
                  <option value="Electronic" className="bg-black">Electronic</option>
                  <option value="Rock" className="bg-black">Rock</option>
                  <option value="R&B" className="bg-black">R&B</option>
                  <option value="Jazz" className="bg-black">Jazz</option>
                  <option value="Classical" className="bg-black">Classical</option>
                  <option value="Country" className="bg-black">Country</option>
                  <option value="Reggae" className="bg-black">Reggae</option>
                  <option value="Latin" className="bg-black">Latin</option>
                  <option value="K-Pop" className="bg-black">K-Pop</option>
                  <option value="Indie" className="bg-black">Indie</option>
                  <option value="Lo-Fi" className="bg-black">Lo-Fi</option>
                  <option value="Trap" className="bg-black">Trap</option>
                  <option value="House" className="bg-black">House</option>
                  <option value="Techno" className="bg-black">Techno</option>
                  <option value="Ambient" className="bg-black">Ambient</option>
                  <option value="Other" className="bg-black">Other</option>
                </select>
              </div>

              {/* Mood (Mandatory) */}
              <div>
                <label className="block text-sm font-semibold text-gray-400 uppercase tracking-wide mb-2">
                  Mood * <span className="text-red-400">(Required)</span>
                </label>
                <select
                  value={mood}
                  onChange={(e) => setMood(e.target.value)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-cyan-500/50 transition-all"
                >
                  <option value="" className="bg-black">Select mood...</option>
                  <option value="Happy" className="bg-black">Happy</option>
                  <option value="Sad" className="bg-black">Sad</option>
                  <option value="Energetic" className="bg-black">Energetic</option>
                  <option value="Chill" className="bg-black">Chill</option>
                  <option value="Romantic" className="bg-black">Romantic</option>
                  <option value="Dark" className="bg-black">Dark</option>
                  <option value="Uplifting" className="bg-black">Uplifting</option>
                  <option value="Melancholic" className="bg-black">Melancholic</option>
                  <option value="Aggressive" className="bg-black">Aggressive</option>
                  <option value="Peaceful" className="bg-black">Peaceful</option>
                  <option value="Mysterious" className="bg-black">Mysterious</option>
                  <option value="Nostalgic" className="bg-black">Nostalgic</option>
                </select>
              </div>

              {/* Two-column grid for smaller fields */}
              <div className="grid grid-cols-2 gap-4">
                {/* BPM */}
                <div>
                  <label className="block text-sm font-semibold text-gray-400 uppercase tracking-wide mb-2">
                    BPM (Optional)
                  </label>
                  <input
                    type="number"
                    value={bpm}
                    onChange={(e) => setBpm(e.target.value)}
                    placeholder="120"
                    min="40"
                    max="200"
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 transition-all"
                  />
                </div>

                {/* Vocals */}
                <div>
                  <label className="block text-sm font-semibold text-gray-400 uppercase tracking-wide mb-2">
                    Vocals
                  </label>
                  <select
                    value={vocals}
                    onChange={(e) => setVocals(e.target.value)}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-cyan-500/50 transition-all"
                  >
                    <option value="none" className="bg-black">Instrumental</option>
                    <option value="male" className="bg-black">Male Vocals</option>
                    <option value="female" className="bg-black">Female Vocals</option>
                    <option value="both" className="bg-black">Mixed Vocals</option>
                  </select>
                </div>
              </div>

              {/* Language */}
              <div>
                <label className="block text-sm font-semibold text-gray-400 uppercase tracking-wide mb-2">
                  Language
                </label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-cyan-500/50 transition-all"
                >
                  <option value="instrumental" className="bg-black">Instrumental</option>
                  <option value="English" className="bg-black">English</option>
                  <option value="Spanish" className="bg-black">Spanish</option>
                  <option value="French" className="bg-black">French</option>
                  <option value="German" className="bg-black">German</option>
                  <option value="Japanese" className="bg-black">Japanese</option>
                  <option value="Korean" className="bg-black">Korean</option>
                  <option value="Chinese" className="bg-black">Chinese</option>
                  <option value="Portuguese" className="bg-black">Portuguese</option>
                  <option value="Other" className="bg-black">Other</option>
                </select>
              </div>

              {/* Tags */}
              <div>
                <label className="block text-sm font-semibold text-gray-400 uppercase tracking-wide mb-2">
                  Tags
                </label>
                <input
                  type="text"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="summer, vibes, 2024 (comma separated)"
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 transition-all"
                />
                <p className="text-xs text-gray-500 mt-1">Separate tags with commas</p>
              </div>

              {/* Visibility */}
              <div className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-xl">
                <div>
                  <p className="text-sm font-medium text-white">Make Public</p>
                  <p className="text-xs text-gray-400 mt-0.5">Show this track on the explore feed</p>
                </div>
                <button
                  onClick={() => setIsPublic(!isPublic)}
                  className={`relative w-14 h-7 rounded-full transition-colors ${
                    isPublic ? 'bg-cyan-500' : 'bg-white/20'
                  }`}
                >
                  <div className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full transition-transform ${
                    isPublic ? 'translate-x-7' : 'translate-x-0'
                  }`} />
                </button>
              </div>

            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-white/10 flex items-center justify-between">
          {step === 1 ? (
            <>
              <button
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 transition-colors text-white font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleNextStep}
                disabled={!selectedMusic || !selectedImage}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-white font-semibold flex items-center gap-2 shadow-lg shadow-cyan-500/30"
              >
                Next Step
                <ChevronRight size={18} />
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleBack}
                className="px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 transition-colors text-white font-medium"
              >
                Back
              </button>
              <button
                onClick={handlePublish}
                disabled={isPublishing || !title.trim()}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-white font-semibold flex items-center gap-2 shadow-lg shadow-cyan-500/30"
              >
                {isPublishing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Publishing...
                  </>
                ) : (
                  <>
                    <Rocket size={18} />
                    Publish Release
                  </>
                )}
              </button>
            </>
          )}
        </div>

      </div>
    </div>
  )
}
