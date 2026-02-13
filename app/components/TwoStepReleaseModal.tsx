'use client'

import { useState, useEffect, useMemo } from 'react'
import { X, Music, Image as ImageIcon, Rocket, ChevronRight, ChevronLeft, Check, Plus, Trash2, Info, Shield, Tag, Mic2, Users, Lock, Eye, EyeOff, Zap } from 'lucide-react'
import { calculateMetadataStrength, type Atmosphere, type EraVibe, type TempoFeel, type LicenseType444 } from '@/lib/track-id-444'

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

interface Contributor {
  name: string
  role: string
}

interface TwoStepReleaseModalProps {
  isOpen: boolean
  onClose: () => void
  preselectedMusic?: string
  preselectedImage?: string
}

// ─── Options ───
const GENRE_OPTIONS = [
  'Pop', 'Hip-Hop', 'Electronic', 'Rock', 'R&B', 'Jazz', 'Classical', 'Country', 'Reggae',
  'Latin', 'K-Pop', 'Indie', 'Lo-Fi', 'Trap', 'House', 'Techno', 'Ambient', 'Drill',
  'Dubstep', 'Funk', 'Soul', 'Blues', 'Phonk', 'Synthwave', 'Afrobeats', 'Dancehall',
  'Metal', 'Punk', 'Folk', 'World', 'Gospel', 'Reggaeton', 'Drum & Bass', 'Other'
]

const MOOD_OPTIONS = [
  'Happy', 'Sad', 'Energetic', 'Chill', 'Romantic', 'Dark', 'Uplifting', 'Melancholic',
  'Aggressive', 'Peaceful', 'Mysterious', 'Nostalgic', 'Dreamy', 'Epic', 'Smooth',
  'Atmospheric', 'Groovy', 'Haunting', 'Playful', 'Triumphant', 'Anxious', 'Bittersweet'
]

const KEY_OPTIONS = [
  'C Major', 'C Minor', 'C# Major', 'C# Minor', 'D Major', 'D Minor',
  'D# Major', 'D# Minor', 'E Major', 'E Minor', 'F Major', 'F Minor',
  'F# Major', 'F# Minor', 'G Major', 'G Minor', 'G# Major', 'G# Minor',
  'A Major', 'A Minor', 'A# Major', 'A# Minor', 'B Major', 'B Minor'
]

const INSTRUMENT_OPTIONS = [
  'Piano', 'Guitar', 'Bass', 'Drums', 'Synthesizer', 'Violin', 'Viola', 'Cello',
  'Trumpet', 'Saxophone', 'Flute', 'Harp', 'Organ', 'Ukulele', 'Banjo',
  'Mandolin', 'Percussion', 'Tabla', 'Sitar', 'Harmonica', 'Accordion',
  '808', 'Sampler', 'Turntable', 'Vocal Chops'
]

const LANGUAGE_OPTIONS = [
  'Instrumental', 'English', 'Spanish', 'French', 'German', 'Japanese', 'Korean',
  'Chinese', 'Portuguese', 'Italian', 'Arabic', 'Hindi', 'Russian', 'Swedish',
  'Dutch', 'Turkish', 'Thai', 'Yoruba', 'Swahili', 'Other'
]

const CONTRIBUTOR_ROLES = [
  'Producer', 'Songwriter', 'Composer', 'Arranger', 'Vocalist', 'Featured Artist',
  'Mixing Engineer', 'Mastering Engineer', 'Sound Designer', 'Remixer',
  'Session Musician', 'Lyricist', 'Beat Maker', 'DJ'
]

export default function TwoStepReleaseModal({
  isOpen,
  onClose,
  preselectedMusic,
  preselectedImage
}: TwoStepReleaseModalProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [selectedMusic, setSelectedMusic] = useState<string | null>(preselectedMusic || null)
  const [selectedImage, setSelectedImage] = useState<string | null>(preselectedImage || null)
  const [isLoading, setIsLoading] = useState(true)
  const [musicItems, setMusicItems] = useState<LibraryMusic[]>([])
  const [imageItems, setImageItems] = useState<LibraryImage[]>([])
  const [isPublishing, setIsPublishing] = useState(false)

  // ─── Step 2: Essential Metadata ───
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [tags, setTags] = useState('')
  const [isPublic, setIsPublic] = useState(true)
  const [genre, setGenre] = useState('')
  const [secondaryGenre, setSecondaryGenre] = useState('')
  const [mood, setMood] = useState('')
  const [bpm, setBpm] = useState('')
  const [vocals, setVocals] = useState('none')
  const [language, setLanguage] = useState('Instrumental')
  const [keySignature, setKeySignature] = useState('')
  const [isExplicit, setIsExplicit] = useState(false)
  const [lyrics, setLyrics] = useState('')

  // ─── Step 3: Distribution & Credits ───
  const [artistName, setArtistName] = useState('')
  const [featuredArtists, setFeaturedArtists] = useState('')
  const [releaseType, setReleaseType] = useState('single')
  const [instruments, setInstruments] = useState<string[]>([])
  const [keywords, setKeywords] = useState('')
  const [versionTag, setVersionTag] = useState('')
  const [isCover, setIsCover] = useState(false)
  // Rights
  const [copyrightHolder, setCopyrightHolder] = useState('')
  const [copyrightYear, setCopyrightYear] = useState(new Date().getFullYear().toString())
  const [recordLabel, setRecordLabel] = useState('')
  const [publisher, setPublisher] = useState('')
  const [proAffiliation, setProAffiliation] = useState('')
  // Identifiers
  const [isrc, setIsrc] = useState('')
  const [upc, setUpc] = useState('')
  // Contributors
  const [contributors, setContributors] = useState<Contributor[]>([])
  // Release scheduling
  const [releaseDate, setReleaseDate] = useState('')

  // ─── 444 Sonic DNA ───
  const [energyLevel, setEnergyLevel] = useState<number | null>(null)
  const [danceability, setDanceability] = useState<number | null>(null)
  const [tempoFeel, setTempoFeel] = useState<TempoFeel | ''>('')
  const [atmosphere, setAtmosphere] = useState<Atmosphere | ''>('')
  const [eraVibe, setEraVibe] = useState<EraVibe | ''>('')
  // ─── 444 Ownership ───
  const [licenseType444, setLicenseType444] = useState<LicenseType444>('fully_ownable')
  const [remixAllowed, setRemixAllowed] = useState(false)
  const [derivativeAllowed, setDerivativeAllowed] = useState(false)
  const [promptVisibility, setPromptVisibility] = useState<'public' | 'private'>('private')

  // ─── Real-time Release Strength ───
  const metadataStrength = useMemo(() => {
    const musicItem = musicItems.find(m => m.id === selectedMusic)
    return calculateMetadataStrength({
      title: title || undefined,
      description: description || undefined,
      genre: genre || undefined,
      mood: mood || undefined,
      tags: tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : undefined,
      bpm: bpm ? parseInt(bpm) : undefined,
      keySignature: keySignature || undefined,
      imageUrl: selectedImage ? 'has-image' : undefined,
      instruments: instruments.length > 0 ? instruments : undefined,
      keywords: keywords ? keywords.split(',').map(k => k.trim()).filter(Boolean) : undefined,
      lyrics: lyrics || musicItem?.lyrics || undefined,
      energyLevel: energyLevel ?? undefined,
      danceability: danceability ?? undefined,
      tempoFeel: (tempoFeel as TempoFeel) || undefined,
      atmosphere: (atmosphere as Atmosphere) || undefined,
      eraVibe: (eraVibe as EraVibe) || undefined,
      licenseType444,
      creationType: 'ai_generated',
      generationPrompt: musicItem?.prompt || undefined,
    })
  }, [title, description, genre, mood, tags, bpm, keySignature, selectedImage, instruments, keywords, lyrics, energyLevel, danceability, tempoFeel, atmosphere, eraVibe, licenseType444, musicItems, selectedMusic])

  const strengthColor = metadataStrength >= 80 ? { text: 'text-emerald-400', bg: 'bg-emerald-500', badge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' }
    : metadataStrength >= 60 ? { text: 'text-blue-400', bg: 'bg-blue-500', badge: 'bg-blue-500/15 text-blue-400 border-blue-500/30' }
    : metadataStrength >= 40 ? { text: 'text-yellow-400', bg: 'bg-yellow-500', badge: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30' }
    : { text: 'text-red-400', bg: 'bg-red-500', badge: 'bg-red-500/15 text-red-400 border-red-500/30' }
  const strengthLabel = metadataStrength >= 80 ? 'Excellent' : metadataStrength >= 60 ? 'Good' : metadataStrength >= 40 ? 'Fair' : 'Needs Work'

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

  const handleNextToStep2 = () => {
    if (!selectedMusic || !selectedImage) {
      alert('Please select both music and cover art to continue')
      return
    }
    const music = musicItems.find(m => m.id === selectedMusic)
    if (music && !title) {
      setTitle(music.title || music.prompt.substring(0, 50))
    }
    if (music?.lyrics && !lyrics) {
      setLyrics(music.lyrics)
    }
    setStep(2)
  }

  const handleNextToStep3 = () => {
    if (!title.trim()) { alert('Please enter a title'); return }
    if (!genre) { alert('Please select a genre'); return }
    if (!mood) { alert('Please select a mood'); return }
    setStep(3)
  }

  const addContributor = () => {
    setContributors([...contributors, { name: '', role: 'Producer' }])
  }

  const removeContributor = (index: number) => {
    setContributors(contributors.filter((_, i) => i !== index))
  }

  const updateContributor = (index: number, field: 'name' | 'role', value: string) => {
    const updated = [...contributors]
    updated[index] = { ...updated[index], [field]: value }
    setContributors(updated)
  }

  const toggleInstrument = (instrument: string) => {
    setInstruments(prev =>
      prev.includes(instrument)
        ? prev.filter(i => i !== instrument)
        : [...prev, instrument]
    )
  }

  const handlePublish = async () => {
    if (!title.trim()) { alert('Please enter a title'); return }
    if (!genre) { alert('Please select a genre'); return }
    if (!mood) { alert('Please select a mood'); return }

    setIsPublishing(true)
    try {
      const music = musicItems.find(m => m.id === selectedMusic)
      const image = imageItems.find(i => i.id === selectedImage)
      if (!music || !image) throw new Error('Selected media not found')

      const metadata: Record<string, unknown> = {
        description: description.trim() || null,
        tags: tags.split(',').map(t => t.trim()).filter(Boolean),
        genre,
        secondary_genre: secondaryGenre || null,
        mood,
        bpm: bpm ? parseInt(bpm) : null,
        vocals,
        language,
        key_signature: keySignature || null,
        is_explicit: isExplicit,
        is_cover: isCover,
        lyrics: lyrics.trim() || null,
        artist_name: artistName.trim() || null,
        featured_artists: featuredArtists.split(',').map(a => a.trim()).filter(Boolean),
        release_type: releaseType,
        instruments: instruments.length > 0 ? instruments : null,
        keywords: keywords.split(',').map(k => k.trim()).filter(Boolean),
        version_tag: versionTag.trim() || null,
        copyright_holder: copyrightHolder.trim() || null,
        copyright_year: copyrightYear ? parseInt(copyrightYear) : null,
        record_label: recordLabel.trim() || null,
        publisher: publisher.trim() || null,
        pro_affiliation: proAffiliation.trim() || null,
        isrc: isrc.trim() || null,
        upc: upc.trim() || null,
        contributors: contributors.filter(c => c.name.trim()),
        release_date: releaseDate || null,
        // 444 Ownership Protocol
        energy_level: energyLevel,
        danceability: danceability,
        tempo_feel: tempoFeel || null,
        atmosphere: atmosphere || null,
        era_vibe: eraVibe || null,
        license_type_444: licenseType444,
        remix_allowed: remixAllowed,
        derivative_allowed: derivativeAllowed,
        prompt_visibility: promptVisibility,
        creation_type: 'ai_generated',
        metadata_strength: metadataStrength,
      }

      const combineRes = await fetch('/api/media/combine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioUrl: music.audio_url,
          imageUrl: image.image_url,
          title: title.trim(),
          audioPrompt: music.prompt,
          imagePrompt: image.prompt,
          isPublic,
          metadata
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

  if (!isOpen) return null

  const selectedMusicItem = musicItems.find(m => m.id === selectedMusic)
  const selectedImageItem = imageItems.find(i => i.id === selectedImage)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fadeIn">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-4xl max-h-[92vh] bg-black/95 backdrop-blur-2xl border border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center">
              <Rocket size={18} className="text-cyan-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Release Your Track</h2>
              <p className="text-xs text-gray-500">
                {step === 1 ? 'Step 1 — Select Media' : step === 2 ? 'Step 2 — Track Details' : 'Step 3 — Distribution Info'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
            <X size={18} className="text-gray-400" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="px-6 py-2.5 border-b border-white/[0.06]">
          <div className="flex items-center gap-1.5">
            <div className={`flex-1 h-1 rounded-full transition-all duration-300 ${step >= 1 ? 'bg-cyan-500' : 'bg-white/10'}`} />
            <div className={`flex-1 h-1 rounded-full transition-all duration-300 ${step >= 2 ? 'bg-cyan-500' : 'bg-white/10'}`} />
            <div className={`flex-1 h-1 rounded-full transition-all duration-300 ${step >= 3 ? 'bg-cyan-500' : 'bg-white/10'}`} />
          </div>
          <div className="flex justify-between mt-1.5 text-[10px] text-gray-600">
            <span className={step >= 1 ? 'text-cyan-400' : ''}>Media</span>
            <span className={step >= 2 ? 'text-cyan-400' : ''}>Details</span>
            <span className={step >= 3 ? 'text-cyan-400' : ''}>Distribution</span>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">

          {/* ═══ STEP 1: SELECT MEDIA ═══ */}
          {step === 1 && (
            <div className="p-6 space-y-6">
              {(selectedMusic || selectedImage) && (
                <div className="flex gap-3 p-3 bg-cyan-500/5 border border-cyan-500/20 rounded-xl">
                  {selectedMusicItem && (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-black/40 rounded-lg">
                      <Music size={14} className="text-cyan-400" />
                      <span className="text-sm text-white">{selectedMusicItem.title || 'Music'}</span>
                      <Check size={14} className="text-green-400" />
                    </div>
                  )}
                  {selectedImageItem && (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-black/40 rounded-lg">
                      <ImageIcon size={14} className="text-cyan-400" />
                      <span className="text-sm text-white">{selectedImageItem.title || 'Cover'}</span>
                      <Check size={14} className="text-green-400" />
                    </div>
                  )}
                </div>
              )}

              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Select Music Track</h3>
                <div className="grid grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
                  {isLoading ? (
                    <p className="col-span-2 text-gray-600 text-sm text-center py-8">Loading...</p>
                  ) : musicItems.length === 0 ? (
                    <p className="col-span-2 text-gray-600 text-sm text-center py-8">No music tracks yet</p>
                  ) : (
                    musicItems.map(music => (
                      <button
                        key={music.id}
                        onClick={() => setSelectedMusic(music.id)}
                        className={`p-3 rounded-xl transition-all text-left ${
                          selectedMusic === music.id
                            ? 'bg-cyan-500/15 border-2 border-cyan-500/50'
                            : 'bg-white/[0.03] border-2 border-white/[0.06] hover:border-cyan-500/30'
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <Music size={14} className="text-cyan-400 mt-0.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white truncate">{music.title || 'Untitled'}</p>
                            <p className="text-xs text-gray-500 truncate mt-0.5">{music.prompt.substring(0, 40)}...</p>
                          </div>
                          {selectedMusic === music.id && <Check size={14} className="text-cyan-400 flex-shrink-0" />}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Select Cover Art</h3>
                <div className="grid grid-cols-3 gap-2 max-h-56 overflow-y-auto pr-1">
                  {isLoading ? (
                    <p className="col-span-3 text-gray-600 text-sm text-center py-8">Loading...</p>
                  ) : imageItems.length === 0 ? (
                    <p className="col-span-3 text-gray-600 text-sm text-center py-8">No cover art yet</p>
                  ) : (
                    imageItems.map(image => (
                      <button
                        key={image.id}
                        onClick={() => setSelectedImage(image.id)}
                        className={`aspect-square rounded-xl overflow-hidden transition-all ${
                          selectedImage === image.id ? 'ring-3 ring-cyan-500' : 'ring-1 ring-white/10 hover:ring-cyan-500/40'
                        }`}
                      >
                        <div className="relative w-full h-full">
                          <img src={image.image_url} alt={image.title || 'Cover art'} className="w-full h-full object-cover" />
                          {selectedImage === image.id && (
                            <div className="absolute inset-0 bg-cyan-500/20 flex items-center justify-center">
                              <Check size={28} className="text-white" />
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

          {/* ═══ STEP 2: ESSENTIAL METADATA ═══ */}
          {step === 2 && (
            <div className="p-6 space-y-4">
              {/* Preview */}
              <div className="flex gap-4 p-3 bg-white/[0.03] border border-white/[0.06] rounded-xl">
                {selectedImageItem && (
                  <img src={selectedImageItem.image_url} alt="Cover" className="w-20 h-20 rounded-lg object-cover" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <Music size={14} className="text-cyan-400" />
                    <span className="text-sm font-medium text-white truncate">{selectedMusicItem?.title || 'Untitled'}</span>
                  </div>
                  {selectedMusicItem && (
                    <audio controls className="w-full h-8 [&::-webkit-media-controls-panel]:bg-white/5">
                      <source src={selectedMusicItem.audio_url} type="audio/mpeg" />
                    </audio>
                  )}
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">
                  Title <span className="text-red-400">*</span>
                </label>
                <input
                  type="text" value={title} onChange={e => setTitle(e.target.value)}
                  placeholder="Enter track title..."
                  className="w-full px-3.5 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white text-sm placeholder-gray-600 focus:outline-none focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20 transition-all"
                />
              </div>

              {/* Genre + Mood (required) */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">
                    Genre <span className="text-red-400">*</span>
                  </label>
                  <select value={genre} onChange={e => setGenre(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white text-sm focus:outline-none focus:border-cyan-500/40 transition-all">
                    <option value="" className="bg-black">Select genre...</option>
                    {GENRE_OPTIONS.map(g => <option key={g} value={g} className="bg-black">{g}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">
                    Mood <span className="text-red-400">*</span>
                  </label>
                  <select value={mood} onChange={e => setMood(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white text-sm focus:outline-none focus:border-cyan-500/40 transition-all">
                    <option value="" className="bg-black">Select mood...</option>
                    {MOOD_OPTIONS.map(m => <option key={m} value={m} className="bg-black">{m}</option>)}
                  </select>
                </div>
              </div>

              {/* Secondary genre + Key */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Secondary Genre</label>
                  <select value={secondaryGenre} onChange={e => setSecondaryGenre(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white text-sm focus:outline-none focus:border-cyan-500/40 transition-all">
                    <option value="" className="bg-black">None</option>
                    {GENRE_OPTIONS.map(g => <option key={g} value={g} className="bg-black">{g}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Key Signature</label>
                  <select value={keySignature} onChange={e => setKeySignature(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white text-sm focus:outline-none focus:border-cyan-500/40 transition-all">
                    <option value="" className="bg-black">Unknown</option>
                    {KEY_OPTIONS.map(k => <option key={k} value={k} className="bg-black">{k}</option>)}
                  </select>
                </div>
              </div>

              {/* BPM + Vocals + Language */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">BPM</label>
                  <input type="number" value={bpm} onChange={e => setBpm(e.target.value)}
                    placeholder="120" min="40" max="300"
                    className="w-full px-3.5 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white text-sm placeholder-gray-600 focus:outline-none focus:border-cyan-500/40 transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Vocals</label>
                  <select value={vocals} onChange={e => setVocals(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white text-sm focus:outline-none focus:border-cyan-500/40 transition-all">
                    <option value="none" className="bg-black">Instrumental</option>
                    <option value="male" className="bg-black">Male Vocals</option>
                    <option value="female" className="bg-black">Female Vocals</option>
                    <option value="both" className="bg-black">Mixed Vocals</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Language</label>
                  <select value={language} onChange={e => setLanguage(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white text-sm focus:outline-none focus:border-cyan-500/40 transition-all">
                    {LANGUAGE_OPTIONS.map(l => <option key={l} value={l} className="bg-black">{l}</option>)}
                  </select>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Description</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)}
                  placeholder="Tell listeners about your track..."
                  rows={2}
                  className="w-full px-3.5 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white text-sm placeholder-gray-600 focus:outline-none focus:border-cyan-500/40 transition-all resize-none" />
              </div>

              {/* Tags */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Tags</label>
                <input type="text" value={tags} onChange={e => setTags(e.target.value)}
                  placeholder="summer, vibes, 2025 (comma separated)"
                  className="w-full px-3.5 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white text-sm placeholder-gray-600 focus:outline-none focus:border-cyan-500/40 transition-all" />
              </div>

              {/* Lyrics (collapsible) */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Lyrics</label>
                <textarea value={lyrics} onChange={e => setLyrics(e.target.value)}
                  placeholder="Paste or type your lyrics here..."
                  rows={3}
                  className="w-full px-3.5 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white text-sm placeholder-gray-600 focus:outline-none focus:border-cyan-500/40 transition-all resize-none font-mono" />
              </div>

              {/* Toggles row */}
              <div className="flex items-center gap-4">
                <ToggleSwitch label="Public" value={isPublic} onChange={setIsPublic} description="Show on explore feed" />
                <ToggleSwitch label="Explicit" value={isExplicit} onChange={setIsExplicit} description="Contains mature content" />
              </div>
            </div>
          )}

          {/* ═══ STEP 3: DISTRIBUTION & CREDITS ═══ */}
          {step === 3 && (
            <div className="p-6 space-y-5">
              {/* Release Strength Meter */}
              <div className="p-4 bg-gradient-to-r from-gray-900/80 to-gray-900/40 border border-white/[0.08] rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Zap size={14} className={strengthColor.text} />
                    <span className="text-sm font-medium text-gray-300">Release Strength</span>
                    <span className={`text-lg font-bold font-mono ${strengthColor.text}`}>{metadataStrength}%</span>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border ${strengthColor.badge}`}>
                    {strengthLabel}
                  </span>
                </div>
                <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ease-out ${strengthColor.bg}`}
                    style={{ width: `${Math.max(metadataStrength, 3)}%` }}
                  />
                </div>
                <p className="text-[10px] text-gray-600 mt-1.5">Fill in more fields to improve discoverability and earn a higher release score</p>
              </div>

              <div className="flex items-center gap-2 p-3 bg-blue-500/5 border border-blue-500/15 rounded-xl">
                <Info size={14} className="text-blue-400 flex-shrink-0" />
                <p className="text-xs text-blue-300/80">
                  Distribution metadata is optional but recommended for professional releases and music distributors (DistroKid, TuneCore, etc.)
                </p>
              </div>

              {/* Artist Info Section */}
              <SectionHeader icon={Mic2} label="Artist Info" color="cyan" />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Artist Name</label>
                  <input type="text" value={artistName} onChange={e => setArtistName(e.target.value)}
                    placeholder="Your artist name"
                    className="w-full px-3.5 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white text-sm placeholder-gray-600 focus:outline-none focus:border-cyan-500/40 transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Featured Artists</label>
                  <input type="text" value={featuredArtists} onChange={e => setFeaturedArtists(e.target.value)}
                    placeholder="Comma separated"
                    className="w-full px-3.5 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white text-sm placeholder-gray-600 focus:outline-none focus:border-cyan-500/40 transition-all" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Release Type</label>
                  <select value={releaseType} onChange={e => setReleaseType(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white text-sm focus:outline-none focus:border-cyan-500/40 transition-all">
                    <option value="single" className="bg-black">Single</option>
                    <option value="ep" className="bg-black">EP</option>
                    <option value="album" className="bg-black">Album</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Version Tag</label>
                  <input type="text" value={versionTag} onChange={e => setVersionTag(e.target.value)}
                    placeholder="e.g. Remix, Deluxe"
                    className="w-full px-3.5 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white text-sm placeholder-gray-600 focus:outline-none focus:border-cyan-500/40 transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Release Date</label>
                  <input type="date" value={releaseDate} onChange={e => setReleaseDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white text-sm focus:outline-none focus:border-cyan-500/40 transition-all" />
                </div>
              </div>

              <ToggleSwitch label="Cover Song" value={isCover} onChange={setIsCover} description="This is a cover of another song" />

              {/* Instruments */}
              <SectionHeader icon={Music} label="Instruments" color="purple" />
              <div className="flex flex-wrap gap-1.5">
                {INSTRUMENT_OPTIONS.map(inst => (
                  <button
                    key={inst}
                    onClick={() => toggleInstrument(inst)}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all border ${
                      instruments.includes(inst)
                        ? 'bg-purple-500/15 text-purple-300 border-purple-500/30'
                        : 'bg-white/[0.03] text-gray-500 border-white/[0.06] hover:border-white/10'
                    }`}
                  >
                    {inst}
                  </button>
                ))}
              </div>

              {/* Keywords */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Keywords (for search)</label>
                <input type="text" value={keywords} onChange={e => setKeywords(e.target.value)}
                  placeholder="study, workout, driving, rain (comma separated)"
                  className="w-full px-3.5 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white text-sm placeholder-gray-600 focus:outline-none focus:border-cyan-500/40 transition-all" />
              </div>

              {/* ─── 444 SONIC DNA ─── */}
              <SectionHeader icon={Zap} label="Sonic DNA" color="purple" />
              <div className="p-3 bg-purple-500/5 border border-purple-500/15 rounded-xl">
                <p className="text-[10px] text-purple-300/70">
                  Sonic DNA defines your track&apos;s unique character — it powers search, recommendations, and your Release Strength score.
                </p>
              </div>

              {/* Energy & Danceability sliders */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-medium text-gray-400">Energy Level</label>
                    <span className="text-xs font-mono text-purple-400">{energyLevel != null ? energyLevel : '—'}</span>
                  </div>
                  <input
                    type="range" min="0" max="100" step="1"
                    value={energyLevel ?? 50}
                    onChange={e => setEnergyLevel(parseInt(e.target.value))}
                    className="w-full h-1.5 bg-gray-800 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-purple-500 [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:shadow-purple-500/30"
                  />
                  <div className="flex justify-between text-[10px] text-gray-600 mt-1">
                    <span>Calm</span><span>Intense</span>
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-medium text-gray-400">Danceability</label>
                    <span className="text-xs font-mono text-purple-400">{danceability != null ? danceability : '—'}</span>
                  </div>
                  <input
                    type="range" min="0" max="100" step="1"
                    value={danceability ?? 50}
                    onChange={e => setDanceability(parseInt(e.target.value))}
                    className="w-full h-1.5 bg-gray-800 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-purple-500 [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:shadow-purple-500/30"
                  />
                  <div className="flex justify-between text-[10px] text-gray-600 mt-1">
                    <span>Still</span><span>Groovy</span>
                  </div>
                </div>
              </div>

              {/* Atmosphere grid */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-2">Atmosphere</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {([
                    { value: 'dark', emoji: '🌑', label: 'Dark' },
                    { value: 'dreamy', emoji: '💭', label: 'Dreamy' },
                    { value: 'uplifting', emoji: '☀️', label: 'Uplifting' },
                    { value: 'aggressive', emoji: '🔥', label: 'Aggressive' },
                    { value: 'calm', emoji: '🌊', label: 'Calm' },
                    { value: 'melancholic', emoji: '🌧️', label: 'Melancholic' },
                    { value: 'euphoric', emoji: '✨', label: 'Euphoric' },
                    { value: 'mysterious', emoji: '🌀', label: 'Mysterious' },
                  ] as const).map(a => (
                    <button
                      key={a.value}
                      type="button"
                      onClick={() => setAtmosphere(atmosphere === a.value ? '' : a.value as Atmosphere)}
                      className={`flex flex-col items-center gap-0.5 py-2 rounded-lg border transition-all text-center ${
                        atmosphere === a.value
                          ? 'bg-purple-500/15 border-purple-500/40 text-white'
                          : 'bg-white/[0.02] border-white/[0.06] text-gray-500 hover:border-purple-500/20'
                      }`}
                    >
                      <span className="text-base">{a.emoji}</span>
                      <span className="text-[10px] font-medium">{a.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Era Vibe + Tempo Feel */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-2">Era Vibe</label>
                  <div className="flex flex-wrap gap-1.5">
                    {(['70s', '80s', '90s', '2000s', '2010s', 'futuristic', 'retro', 'timeless'] as const).map(era => (
                      <button
                        key={era}
                        type="button"
                        onClick={() => setEraVibe(eraVibe === era ? '' : era)}
                        className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all ${
                          eraVibe === era
                            ? 'bg-purple-500/15 text-purple-300 border-purple-500/30'
                            : 'bg-white/[0.03] text-gray-500 border-white/[0.06] hover:border-purple-500/20'
                        }`}
                      >
                        {era === 'futuristic' ? '🚀 Future' : era === 'retro' ? '📼 Retro' : era === 'timeless' ? '♾️ Timeless' : era}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-2">Tempo Feel</label>
                  <div className="flex gap-2">
                    {([
                      { value: 'slow' as const, label: '🐌 Slow', desc: '<90 BPM' },
                      { value: 'mid' as const, label: '🚶 Mid', desc: '90-130' },
                      { value: 'fast' as const, label: '⚡ Fast', desc: '130+' },
                    ]).map(tf => (
                      <button
                        key={tf.value}
                        type="button"
                        onClick={() => setTempoFeel(tempoFeel === tf.value ? '' : tf.value)}
                        className={`flex-1 py-2 rounded-lg border text-center transition-all ${
                          tempoFeel === tf.value
                            ? 'bg-purple-500/15 border-purple-500/40 text-white'
                            : 'bg-white/[0.02] border-white/[0.06] text-gray-500 hover:border-purple-500/20'
                        }`}
                      >
                        <p className="text-xs font-medium">{tf.label}</p>
                        <p className="text-[10px] text-gray-600">{tf.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* ─── 444 OWNERSHIP ─── */}
              <SectionHeader icon={Lock} label="444 Ownership" color="cyan" />

              {/* License Type */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-2">License Type</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {([
                    { value: 'fully_ownable', label: 'Fully Ownable', desc: 'Full rights transfer' },
                    { value: 'non_exclusive', label: 'Non-Exclusive', desc: 'Multiple licenses' },
                    { value: 'remix_allowed', label: 'Remix OK', desc: 'Remixes permitted' },
                    { value: 'download_only', label: 'Download Only', desc: 'No redistribute' },
                    { value: 'streaming_only', label: 'Stream Only', desc: 'No downloads' },
                    { value: 'no_derivatives', label: 'No Derivatives', desc: 'No remixes' },
                  ] as const).map(lt => (
                    <button
                      key={lt.value}
                      type="button"
                      onClick={() => setLicenseType444(lt.value as LicenseType444)}
                      className={`p-2 rounded-lg border text-left transition-all ${
                        licenseType444 === lt.value
                          ? 'bg-cyan-500/15 border-cyan-500/40'
                          : 'bg-white/[0.02] border-white/[0.06] hover:border-cyan-500/20'
                      }`}
                    >
                      <p className={`text-[11px] font-medium ${licenseType444 === lt.value ? 'text-cyan-300' : 'text-gray-400'}`}>{lt.label}</p>
                      <p className="text-[9px] text-gray-600 mt-0.5">{lt.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Permission toggles + Prompt visibility */}
              <div className="grid grid-cols-3 gap-2">
                <div className={`flex items-center justify-between p-3 rounded-xl border transition-all ${remixAllowed ? 'bg-cyan-500/10 border-cyan-500/30' : 'bg-white/[0.03] border-white/[0.06]'}`}>
                  <div>
                    <p className="text-xs font-medium text-white">Remix</p>
                    <p className="text-[9px] text-gray-500">Allow remixes</p>
                  </div>
                  <button onClick={() => setRemixAllowed(!remixAllowed)}
                    className={`relative w-9 h-5 rounded-full transition-colors ${remixAllowed ? 'bg-cyan-500' : 'bg-white/15'}`}>
                    <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform shadow-sm ${remixAllowed ? 'translate-x-4' : 'translate-x-0'}`} />
                  </button>
                </div>
                <div className={`flex items-center justify-between p-3 rounded-xl border transition-all ${derivativeAllowed ? 'bg-cyan-500/10 border-cyan-500/30' : 'bg-white/[0.03] border-white/[0.06]'}`}>
                  <div>
                    <p className="text-xs font-medium text-white">Derivative</p>
                    <p className="text-[9px] text-gray-500">Allow derivatives</p>
                  </div>
                  <button onClick={() => setDerivativeAllowed(!derivativeAllowed)}
                    className={`relative w-9 h-5 rounded-full transition-colors ${derivativeAllowed ? 'bg-cyan-500' : 'bg-white/15'}`}>
                    <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform shadow-sm ${derivativeAllowed ? 'translate-x-4' : 'translate-x-0'}`} />
                  </button>
                </div>
                <div className={`flex items-center justify-between p-3 rounded-xl border transition-all ${promptVisibility === 'public' ? 'bg-cyan-500/10 border-cyan-500/30' : 'bg-white/[0.03] border-white/[0.06]'}`}>
                  <div>
                    <p className="text-xs font-medium text-white">Prompt</p>
                    <p className="text-[9px] text-gray-500">{promptVisibility === 'public' ? 'Visible' : 'Hidden'}</p>
                  </div>
                  <button onClick={() => setPromptVisibility(promptVisibility === 'public' ? 'private' : 'public')}
                    className={`relative w-9 h-5 rounded-full transition-colors ${promptVisibility === 'public' ? 'bg-cyan-500' : 'bg-white/15'}`}>
                    <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform shadow-sm ${promptVisibility === 'public' ? 'translate-x-4' : 'translate-x-0'}`} />
                  </button>
                </div>
              </div>

              {/* Contributors */}
              <SectionHeader icon={Users} label="Credits & Contributors" color="green" />
              {contributors.map((c, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input type="text" value={c.name} onChange={e => updateContributor(i, 'name', e.target.value)}
                    placeholder="Name"
                    className="flex-1 px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-white text-sm placeholder-gray-600 focus:outline-none focus:border-cyan-500/40 transition-all" />
                  <select value={c.role} onChange={e => updateContributor(i, 'role', e.target.value)}
                    className="w-40 px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500/40 transition-all">
                    {CONTRIBUTOR_ROLES.map(r => <option key={r} value={r} className="bg-black">{r}</option>)}
                  </select>
                  <button onClick={() => removeContributor(i)} className="p-2 hover:bg-red-500/10 rounded-lg transition-colors">
                    <Trash2 size={14} className="text-red-400" />
                  </button>
                </div>
              ))}
              <button onClick={addContributor}
                className="flex items-center gap-1.5 px-3 py-2 bg-white/[0.03] border border-dashed border-white/10 rounded-lg text-xs text-gray-400 hover:text-white hover:border-white/20 transition-colors">
                <Plus size={14} /> Add Contributor
              </button>

              {/* Rights & Legal */}
              <SectionHeader icon={Shield} label="Rights & Legal" color="amber" />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Copyright Holder</label>
                  <input type="text" value={copyrightHolder} onChange={e => setCopyrightHolder(e.target.value)}
                    placeholder="Your name or label"
                    className="w-full px-3.5 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white text-sm placeholder-gray-600 focus:outline-none focus:border-cyan-500/40 transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Copyright Year</label>
                  <input type="number" value={copyrightYear} onChange={e => setCopyrightYear(e.target.value)}
                    min="1950" max="2030"
                    className="w-full px-3.5 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white text-sm focus:outline-none focus:border-cyan-500/40 transition-all" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Record Label</label>
                  <input type="text" value={recordLabel} onChange={e => setRecordLabel(e.target.value)}
                    placeholder="Self-released"
                    className="w-full px-3.5 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white text-sm placeholder-gray-600 focus:outline-none focus:border-cyan-500/40 transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Publisher</label>
                  <input type="text" value={publisher} onChange={e => setPublisher(e.target.value)}
                    placeholder="Publishing company"
                    className="w-full px-3.5 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white text-sm placeholder-gray-600 focus:outline-none focus:border-cyan-500/40 transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">PRO</label>
                  <select value={proAffiliation} onChange={e => setProAffiliation(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white text-sm focus:outline-none focus:border-cyan-500/40 transition-all">
                    <option value="" className="bg-black">None</option>
                    <option value="ASCAP" className="bg-black">ASCAP</option>
                    <option value="BMI" className="bg-black">BMI</option>
                    <option value="SESAC" className="bg-black">SESAC</option>
                    <option value="PRS" className="bg-black">PRS</option>
                    <option value="SOCAN" className="bg-black">SOCAN</option>
                    <option value="GEMA" className="bg-black">GEMA</option>
                    <option value="SACEM" className="bg-black">SACEM</option>
                    <option value="JASRAC" className="bg-black">JASRAC</option>
                    <option value="KOMCA" className="bg-black">KOMCA</option>
                    <option value="Other" className="bg-black">Other</option>
                  </select>
                </div>
              </div>

              {/* 444 Track ID */}
              <SectionHeader icon={Tag} label="444 Track ID" color="blue" />
              <div className="p-3 bg-gradient-to-r from-cyan-500/5 to-purple-500/5 border border-cyan-500/20 rounded-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">Track ID</p>
                    <p className="text-sm font-mono text-cyan-400 mt-0.5">444-{new Date().getFullYear()}-XXXX-XXXXXX</p>
                  </div>
                  <div className="px-2.5 py-1 bg-cyan-500/10 rounded-lg">
                    <p className="text-[10px] text-cyan-400 font-medium">Auto-generated on publish</p>
                  </div>
                </div>
              </div>

              {/* Legacy Identifiers */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">
                    ISRC <span className="text-gray-600 font-normal">(legacy, optional)</span>
                  </label>
                  <input type="text" value={isrc} onChange={e => setIsrc(e.target.value)}
                    placeholder="e.g. USXXXX2500001"
                    className="w-full px-3.5 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white text-sm placeholder-gray-600 focus:outline-none focus:border-cyan-500/40 transition-all font-mono" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">
                    UPC <span className="text-gray-600 font-normal">(legacy, optional)</span>
                  </label>
                  <input type="text" value={upc} onChange={e => setUpc(e.target.value)}
                    placeholder="e.g. 012345678901"
                    className="w-full px-3.5 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white text-sm placeholder-gray-600 focus:outline-none focus:border-cyan-500/40 transition-all font-mono" />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/[0.06] flex items-center justify-between">
          {step === 1 ? (
            <>
              <button onClick={onClose} className="px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 transition-colors text-white text-sm font-medium">
                Cancel
              </button>
              <button
                onClick={handleNextToStep2}
                disabled={!selectedMusic || !selectedImage}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all text-white text-sm font-semibold flex items-center gap-2 shadow-lg shadow-cyan-500/20"
              >
                Next: Details <ChevronRight size={16} />
              </button>
            </>
          ) : step === 2 ? (
            <>
              <button onClick={() => setStep(1)} className="px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 transition-colors text-white text-sm font-medium flex items-center gap-1">
                <ChevronLeft size={16} /> Back
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePublish}
                  disabled={isPublishing || !title.trim() || !genre || !mood}
                  className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 disabled:opacity-40 transition-all text-white text-sm font-medium"
                >
                  Publish Now
                </button>
                <button
                  onClick={handleNextToStep3}
                  disabled={!title.trim() || !genre || !mood}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all text-white text-sm font-semibold flex items-center gap-2 shadow-lg shadow-cyan-500/20"
                >
                  Add Distribution Info <ChevronRight size={16} />
                </button>
              </div>
            </>
          ) : (
            <>
              <button onClick={() => setStep(2)} className="px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 transition-colors text-white text-sm font-medium flex items-center gap-1">
                <ChevronLeft size={16} /> Back
              </button>
              <button
                onClick={handlePublish}
                disabled={isPublishing || !title.trim() || !genre || !mood}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all text-white text-sm font-semibold flex items-center gap-2 shadow-lg shadow-cyan-500/20"
              >
                {isPublishing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Publishing...
                  </>
                ) : (
                  <>
                    <Rocket size={16} /> Publish Release
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

// ─── Helper Components ───

function SectionHeader({ icon: Icon, label, color }: { icon: React.ComponentType<{ size?: number; className?: string }>; label: string; color: string }) {
  const colorMap: Record<string, string> = {
    cyan: 'from-cyan-500/20 to-blue-500/20 text-cyan-400',
    purple: 'from-purple-500/20 to-pink-500/20 text-purple-400',
    green: 'from-green-500/20 to-emerald-500/20 text-green-400',
    amber: 'from-amber-500/20 to-orange-500/20 text-amber-400',
    blue: 'from-blue-500/20 to-indigo-500/20 text-blue-400',
  }
  const c = colorMap[color] || colorMap.cyan
  return (
    <div className="flex items-center gap-2 pt-2">
      <div className={`w-6 h-6 rounded-lg bg-gradient-to-br ${c.split(' ').slice(0, 2).join(' ')} flex items-center justify-center`}>
        <Icon size={12} className={c.split(' ').pop()} />
      </div>
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{label}</h3>
    </div>
  )
}

function ToggleSwitch({ label, value, onChange, description }: { label: string; value: boolean; onChange: (v: boolean) => void; description?: string }) {
  return (
    <div className="flex items-center justify-between p-3 bg-white/[0.03] border border-white/[0.06] rounded-xl flex-1">
      <div>
        <p className="text-sm font-medium text-white">{label}</p>
        {description && <p className="text-[10px] text-gray-500 mt-0.5">{description}</p>}
      </div>
      <button
        onClick={() => onChange(!value)}
        className={`relative w-11 h-6 rounded-full transition-colors ${value ? 'bg-cyan-500' : 'bg-white/15'}`}
      >
        <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform shadow-sm ${value ? 'translate-x-5' : 'translate-x-0'}`} />
      </button>
    </div>
  )
}
