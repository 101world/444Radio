'use client'

import { useState, useCallback } from 'react'
import {
  X, ChevronDown, ChevronUp, Plus, Trash2, Music, Tag, Shield, Users,
  Globe, FileText, Info, Disc
} from 'lucide-react'
import {
  ReleaseFormData, Contributor,
  GENRE_OPTIONS, MOOD_OPTIONS, KEY_OPTIONS, INSTRUMENT_OPTIONS,
  CONTRIBUTOR_ROLES, PRO_OPTIONS, LANGUAGE_OPTIONS
} from '@/types/media'

interface TrackMetadataFormProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: ReleaseFormData) => void
  initialData?: Partial<ReleaseFormData>
  mode?: 'create' | 'edit'
  isSubmitting?: boolean
}

export default function TrackMetadataForm({
  isOpen, onClose, onSubmit, initialData, mode = 'create', isSubmitting = false
}: TrackMetadataFormProps) {
  const [activeSection, setActiveSection] = useState<string>('basic')
  const [formData, setFormData] = useState<ReleaseFormData>({
    title: initialData?.title || '',
    artist_name: initialData?.artist_name || '',
    featured_artists: initialData?.featured_artists || [],
    release_type: initialData?.release_type || 'single',
    genre: initialData?.genre || '',
    secondary_genre: initialData?.secondary_genre || '',
    mood: initialData?.mood || '',
    mood_tags: initialData?.mood_tags || [],
    bpm: initialData?.bpm || null,
    key_signature: initialData?.key_signature || '',
    vocals: initialData?.vocals || 'instrumental',
    language: initialData?.language || 'Instrumental',
    is_explicit: initialData?.is_explicit || false,
    is_cover: initialData?.is_cover || false,
    description: initialData?.description || '',
    tags: initialData?.tags || [],
    keywords: initialData?.keywords || [],
    instruments: initialData?.instruments || [],
    version_tag: initialData?.version_tag || '',
    lyrics: initialData?.lyrics || '',
    songwriters: initialData?.songwriters || [],
    contributors: initialData?.contributors || [],
    publisher: initialData?.publisher || '',
    copyright_holder: initialData?.copyright_holder || '',
    copyright_year: initialData?.copyright_year || new Date().getFullYear(),
    record_label: initialData?.record_label || '',
    catalogue_number: initialData?.catalogue_number || '',
    pro_affiliation: initialData?.pro_affiliation || '',
    isrc: initialData?.isrc || '',
    upc: initialData?.upc || '',
    territories: initialData?.territories || ['worldwide'],
    release_date: initialData?.release_date || '',
  })

  // Tag input helpers
  const [tagInput, setTagInput] = useState('')
  const [keywordInput, setKeywordInput] = useState('')
  const [featuredArtistInput, setFeaturedArtistInput] = useState('')

  const updateField = useCallback(<K extends keyof ReleaseFormData>(field: K, value: ReleaseFormData[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }, [])

  const addToArray = useCallback((field: 'tags' | 'keywords' | 'featured_artists' | 'mood_tags' | 'instruments', value: string) => {
    if (!value.trim()) return
    setFormData(prev => ({
      ...prev,
      [field]: [...(prev[field] || []), value.trim()]
    }))
  }, [])

  const removeFromArray = useCallback((field: 'tags' | 'keywords' | 'featured_artists' | 'mood_tags' | 'instruments', index: number) => {
    setFormData(prev => ({
      ...prev,
      [field]: (prev[field] || []).filter((_, i) => i !== index)
    }))
  }, [])

  const addContributor = useCallback((type: 'songwriters' | 'contributors') => {
    setFormData(prev => ({
      ...prev,
      [type]: [...prev[type], { name: '', role: type === 'songwriters' ? 'songwriter' : 'producer' }]
    }))
  }, [])

  const updateContributor = useCallback((type: 'songwriters' | 'contributors', index: number, field: keyof Contributor, value: string) => {
    setFormData(prev => ({
      ...prev,
      [type]: prev[type].map((c, i) => i === index ? { ...c, [field]: value } : c)
    }))
  }, [])

  const removeContributor = useCallback((type: 'songwriters' | 'contributors', index: number) => {
    setFormData(prev => ({
      ...prev,
      [type]: prev[type].filter((_, i) => i !== index)
    }))
  }, [])

  const handleSubmit = () => {
    if (!formData.title.trim()) return
    onSubmit(formData)
  }

  if (!isOpen) return null

  const sections = [
    { id: 'basic', label: 'Basic Info', icon: Music, required: true },
    { id: 'genre', label: 'Genre & Mood', icon: Tag, required: true },
    { id: 'credits', label: 'Credits & Contributors', icon: Users, required: false },
    { id: 'rights', label: 'Rights & Legal', icon: Shield, required: false },
    { id: 'distribution', label: 'Distribution', icon: Globe, required: false },
    { id: 'lyrics', label: 'Lyrics & Description', icon: FileText, required: false },
    { id: 'identifiers', label: 'Identifiers (ISRC/UPC)', icon: Disc, required: false },
  ]

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-xl flex items-center justify-center z-[60] p-4">
      <div className="bg-gray-950 border border-white/10 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-gradient-to-r from-cyan-950/30 to-purple-950/30">
          <div>
            <h2 className="text-xl font-bold text-white">
              {mode === 'create' ? 'Release Metadata' : 'Edit Track Metadata'}
            </h2>
            <p className="text-sm text-gray-400 mt-0.5">Distribution-ready metadata for your release</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
            <X size={20} className="text-gray-400" />
          </button>
        </div>

        {/* Section Tabs */}
        <div className="flex gap-1 px-4 py-3 border-b border-white/10 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {sections.map(s => (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                activeSection === s.id
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <s.icon size={14} />
              {s.label}
              {s.required && <span className="text-red-400">*</span>}
            </button>
          ))}
        </div>

        {/* Form Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">

          {/* === BASIC INFO === */}
          {activeSection === 'basic' && (
            <div className="space-y-4">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Track Title <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={e => updateField('title', e.target.value)}
                  placeholder='e.g. "Midnight Vibes (feat. ABC)" or "(Remix)"'
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:border-cyan-500/50 focus:outline-none transition-colors"
                />
                <p className="text-xs text-gray-500 mt-1">Include feat., (Remix), (Radio Edit) etc. in the title</p>
              </div>

              {/* Artist Name */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Primary Artist Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={formData.artist_name}
                  onChange={e => updateField('artist_name', e.target.value)}
                  placeholder="Exact name for store artist pages"
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:border-cyan-500/50 focus:outline-none transition-colors"
                />
              </div>

              {/* Featured Artists */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Featured Artists</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={featuredArtistInput}
                    onChange={e => setFeaturedArtistInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        addToArray('featured_artists', featuredArtistInput)
                        setFeaturedArtistInput('')
                      }
                    }}
                    placeholder="Add featured artist..."
                    className="flex-1 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:border-cyan-500/50 focus:outline-none text-sm"
                  />
                  <button
                    onClick={() => { addToArray('featured_artists', featuredArtistInput); setFeaturedArtistInput('') }}
                    className="px-3 py-2 bg-cyan-500/20 border border-cyan-500/30 rounded-lg text-cyan-400 hover:bg-cyan-500/30 transition-colors"
                  >
                    <Plus size={16} />
                  </button>
                </div>
                {formData.featured_artists.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {formData.featured_artists.map((a, i) => (
                      <span key={i} className="flex items-center gap-1 px-2 py-1 bg-cyan-500/10 border border-cyan-500/20 rounded-full text-xs text-cyan-300">
                        {a}
                        <button onClick={() => removeFromArray('featured_artists', i)}><X size={12} /></button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Release Type + Version Tag */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Release Type</label>
                  <select
                    value={formData.release_type}
                    onChange={e => updateField('release_type', e.target.value as 'single' | 'ep' | 'album')}
                    className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:border-cyan-500/50 focus:outline-none"
                  >
                    <option value="single">Single</option>
                    <option value="ep">EP</option>
                    <option value="album">Album</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Version Tag</label>
                  <select
                    value={formData.version_tag}
                    onChange={e => updateField('version_tag', e.target.value)}
                    className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:border-cyan-500/50 focus:outline-none"
                  >
                    <option value="">Original</option>
                    <option value="Remix">Remix</option>
                    <option value="Radio Edit">Radio Edit</option>
                    <option value="Acoustic">Acoustic</option>
                    <option value="Live">Live</option>
                    <option value="Instrumental">Instrumental</option>
                    <option value="Extended Mix">Extended Mix</option>
                    <option value="Deluxe">Deluxe</option>
                  </select>
                </div>
              </div>

              {/* Release Date */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Release Date</label>
                <input
                  type="date"
                  value={formData.release_date}
                  onChange={e => updateField('release_date', e.target.value)}
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:border-cyan-500/50 focus:outline-none"
                />
                <p className="text-xs text-gray-500 mt-1">Leave empty for immediate release (ASAP)</p>
              </div>

              {/* Explicit + Cover flags */}
              <div className="flex gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_explicit}
                    onChange={e => updateField('is_explicit', e.target.checked)}
                    className="w-4 h-4 rounded border-white/20 bg-white/5 text-cyan-500 focus:ring-cyan-500"
                  />
                  <span className="text-sm text-gray-300">Explicit Content 🔞</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_cover}
                    onChange={e => updateField('is_cover', e.target.checked)}
                    className="w-4 h-4 rounded border-white/20 bg-white/5 text-cyan-500 focus:ring-cyan-500"
                  />
                  <span className="text-sm text-gray-300">This is a Cover</span>
                </label>
              </div>
            </div>
          )}

          {/* === GENRE & MOOD === */}
          {activeSection === 'genre' && (
            <div className="space-y-4">
              {/* Primary Genre */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Primary Genre <span className="text-red-400">*</span>
                </label>
                <select
                  value={formData.genre}
                  onChange={e => updateField('genre', e.target.value)}
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:border-cyan-500/50 focus:outline-none"
                >
                  <option value="">Select genre...</option>
                  {GENRE_OPTIONS.map(g => (
                    <option key={g} value={g}>{g.charAt(0).toUpperCase() + g.slice(1)}</option>
                  ))}
                </select>
              </div>

              {/* Secondary Genre */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Secondary Genre</label>
                <select
                  value={formData.secondary_genre}
                  onChange={e => updateField('secondary_genre', e.target.value)}
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:border-cyan-500/50 focus:outline-none"
                >
                  <option value="">None</option>
                  {GENRE_OPTIONS.map(g => (
                    <option key={g} value={g}>{g.charAt(0).toUpperCase() + g.slice(1)}</option>
                  ))}
                </select>
              </div>

              {/* Mood */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Primary Mood</label>
                <select
                  value={formData.mood}
                  onChange={e => updateField('mood', e.target.value)}
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:border-cyan-500/50 focus:outline-none"
                >
                  <option value="">Select mood...</option>
                  {MOOD_OPTIONS.map(m => (
                    <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>
                  ))}
                </select>
              </div>

              {/* Mood Tags (multi-select chips) */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Mood Tags</label>
                <div className="flex flex-wrap gap-2">
                  {MOOD_OPTIONS.map(m => {
                    const isSelected = formData.mood_tags.includes(m)
                    return (
                      <button
                        key={m}
                        onClick={() => {
                          if (isSelected) {
                            removeFromArray('mood_tags', formData.mood_tags.indexOf(m))
                          } else {
                            addToArray('mood_tags', m)
                          }
                        }}
                        className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                          isSelected
                            ? 'bg-cyan-500/30 border border-cyan-400/50 text-cyan-300'
                            : 'bg-white/5 border border-white/10 text-gray-400 hover:border-white/20'
                        }`}
                      >
                        {m}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* BPM + Key + Vocals */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">BPM</label>
                  <input
                    type="number"
                    value={formData.bpm || ''}
                    onChange={e => updateField('bpm', e.target.value ? parseInt(e.target.value) : null)}
                    placeholder="120"
                    min={20} max={300}
                    className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:border-cyan-500/50 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Key</label>
                  <select
                    value={formData.key_signature}
                    onChange={e => updateField('key_signature', e.target.value)}
                    className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:border-cyan-500/50 focus:outline-none"
                  >
                    <option value="">Unknown</option>
                    {KEY_OPTIONS.map(k => (
                      <option key={k} value={k}>{k}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Vocals</label>
                  <select
                    value={formData.vocals}
                    onChange={e => updateField('vocals', e.target.value)}
                    className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:border-cyan-500/50 focus:outline-none"
                  >
                    <option value="instrumental">Instrumental</option>
                    <option value="with-lyrics">With Lyrics</option>
                    <option value="none">None / SFX</option>
                  </select>
                </div>
              </div>

              {/* Language */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Language</label>
                <select
                  value={formData.language}
                  onChange={e => updateField('language', e.target.value)}
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:border-cyan-500/50 focus:outline-none"
                >
                  {LANGUAGE_OPTIONS.map(l => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
              </div>

              {/* Instruments */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Instruments</label>
                <div className="flex flex-wrap gap-2">
                  {INSTRUMENT_OPTIONS.map(inst => {
                    const isSelected = formData.instruments.includes(inst)
                    return (
                      <button
                        key={inst}
                        onClick={() => {
                          if (isSelected) {
                            removeFromArray('instruments', formData.instruments.indexOf(inst))
                          } else {
                            addToArray('instruments', inst)
                          }
                        }}
                        className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                          isSelected
                            ? 'bg-purple-500/30 border border-purple-400/50 text-purple-300'
                            : 'bg-white/5 border border-white/10 text-gray-400 hover:border-white/20'
                        }`}
                      >
                        {inst}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Tags */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Tags / Keywords</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={e => setTagInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        addToArray('tags', tagInput)
                        setTagInput('')
                      }
                    }}
                    placeholder="Add a tag and press Enter..."
                    className="flex-1 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:border-cyan-500/50 focus:outline-none text-sm"
                  />
                  <button onClick={() => { addToArray('tags', tagInput); setTagInput('') }} className="px-3 py-2 bg-cyan-500/20 border border-cyan-500/30 rounded-lg text-cyan-400 hover:bg-cyan-500/30 transition-colors">
                    <Plus size={16} />
                  </button>
                </div>
                {formData.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {formData.tags.map((t, i) => (
                      <span key={i} className="flex items-center gap-1 px-2 py-1 bg-white/5 border border-white/10 rounded-full text-xs text-gray-300">
                        #{t}
                        <button onClick={() => removeFromArray('tags', i)}><X size={12} /></button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* === CREDITS & CONTRIBUTORS === */}
          {activeSection === 'credits' && (
            <div className="space-y-5">
              {/* Songwriters */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-300">Songwriters / Composers</label>
                  <button onClick={() => addContributor('songwriters')} className="flex items-center gap-1 px-2 py-1 bg-cyan-500/20 rounded-lg text-cyan-400 text-xs hover:bg-cyan-500/30 transition-colors">
                    <Plus size={12} /> Add
                  </button>
                </div>
                {formData.songwriters.length === 0 && (
                  <p className="text-xs text-gray-500 italic">No songwriters added yet</p>
                )}
                {formData.songwriters.map((sw, i) => (
                  <div key={i} className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={sw.name}
                      onChange={e => updateContributor('songwriters', i, 'name', e.target.value)}
                      placeholder="Full name"
                      className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-gray-500 focus:border-cyan-500/50 focus:outline-none"
                    />
                    <select
                      value={sw.role}
                      onChange={e => updateContributor('songwriters', i, 'role', e.target.value)}
                      className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:border-cyan-500/50 focus:outline-none"
                    >
                      <option value="songwriter">Songwriter</option>
                      <option value="composer">Composer</option>
                      <option value="lyricist">Lyricist</option>
                      <option value="arranger">Arranger</option>
                    </select>
                    <button onClick={() => removeContributor('songwriters', i)} className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>

              {/* Contributors */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-300">Other Contributors</label>
                  <button onClick={() => addContributor('contributors')} className="flex items-center gap-1 px-2 py-1 bg-purple-500/20 rounded-lg text-purple-400 text-xs hover:bg-purple-500/30 transition-colors">
                    <Plus size={12} /> Add
                  </button>
                </div>
                {formData.contributors.length === 0 && (
                  <p className="text-xs text-gray-500 italic">No contributors added yet</p>
                )}
                {formData.contributors.map((c, i) => (
                  <div key={i} className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={c.name}
                      onChange={e => updateContributor('contributors', i, 'name', e.target.value)}
                      placeholder="Full name"
                      className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-gray-500 focus:border-cyan-500/50 focus:outline-none"
                    />
                    <select
                      value={c.role}
                      onChange={e => updateContributor('contributors', i, 'role', e.target.value)}
                      className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:border-cyan-500/50 focus:outline-none"
                    >
                      {CONTRIBUTOR_ROLES.map(r => (
                        <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                      ))}
                    </select>
                    <button onClick={() => removeContributor('contributors', i)} className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>

              {/* Publisher */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Publisher</label>
                <input
                  type="text"
                  value={formData.publisher}
                  onChange={e => updateField('publisher', e.target.value)}
                  placeholder="Publishing company name"
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:border-cyan-500/50 focus:outline-none"
                />
              </div>

              {/* PRO Affiliation */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">PRO Affiliation</label>
                <select
                  value={formData.pro_affiliation}
                  onChange={e => updateField('pro_affiliation', e.target.value)}
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:border-cyan-500/50 focus:outline-none"
                >
                  <option value="">Select PRO...</option>
                  {PRO_OPTIONS.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">Performance Rights Organization (BMI, ASCAP, PRS, etc.)</p>
              </div>
            </div>
          )}

          {/* === RIGHTS & LEGAL === */}
          {activeSection === 'rights' && (
            <div className="space-y-4">
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                <div className="flex items-start gap-2">
                  <Info size={16} className="text-amber-400 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-amber-300">
                    These fields help protect your rights and ensure proper attribution across distribution platforms.
                  </p>
                </div>
              </div>

              {/* Copyright Holder */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Copyright Holder</label>
                <input
                  type="text"
                  value={formData.copyright_holder}
                  onChange={e => updateField('copyright_holder', e.target.value)}
                  placeholder="Person or company who owns the master"
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:border-cyan-500/50 focus:outline-none"
                />
              </div>

              {/* Copyright Year */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Copyright Year</label>
                <input
                  type="number"
                  value={formData.copyright_year || ''}
                  onChange={e => updateField('copyright_year', e.target.value ? parseInt(e.target.value) : null)}
                  placeholder={new Date().getFullYear().toString()}
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:border-cyan-500/50 focus:outline-none"
                />
              </div>

              {/* Record Label */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Record Label</label>
                <input
                  type="text"
                  value={formData.record_label}
                  onChange={e => updateField('record_label', e.target.value)}
                  placeholder="Label name (or leave blank if self-released)"
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:border-cyan-500/50 focus:outline-none"
                />
              </div>

              {/* Catalogue Number */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Catalogue Number</label>
                <input
                  type="text"
                  value={formData.catalogue_number}
                  onChange={e => updateField('catalogue_number', e.target.value)}
                  placeholder="e.g. 444R-001"
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:border-cyan-500/50 focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* === DISTRIBUTION === */}
          {activeSection === 'distribution' && (
            <div className="space-y-4">
              {/* Territories */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Distribution Territories</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="territories"
                      checked={formData.territories.includes('worldwide')}
                      onChange={() => updateField('territories', ['worldwide'])}
                      className="text-cyan-500"
                    />
                    <span className="text-sm text-gray-300">Worldwide</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="territories"
                      checked={!formData.territories.includes('worldwide')}
                      onChange={() => updateField('territories', [])}
                      className="text-cyan-500"
                    />
                    <span className="text-sm text-gray-300">Selected countries</span>
                  </label>
                </div>
              </div>

              <div className="p-3 bg-cyan-500/10 border border-cyan-500/20 rounded-lg">
                <p className="text-xs text-cyan-300">
                  Distribution is currently managed through 444Radio&apos;s platform. External distribution (Spotify, Apple Music, etc.) coming soon.
                </p>
              </div>
            </div>
          )}

          {/* === LYRICS & DESCRIPTION === */}
          {activeSection === 'lyrics' && (
            <div className="space-y-4">
              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={e => updateField('description', e.target.value)}
                  placeholder="Tell listeners about this track..."
                  rows={3}
                  maxLength={500}
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:border-cyan-500/50 focus:outline-none resize-none"
                />
                <p className="text-xs text-gray-500 mt-1">{formData.description.length}/500</p>
              </div>

              {/* Lyrics */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Lyrics</label>
                <textarea
                  value={formData.lyrics}
                  onChange={e => updateField('lyrics', e.target.value)}
                  placeholder="Paste or type your lyrics here..."
                  rows={10}
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:border-cyan-500/50 focus:outline-none resize-none font-mono text-sm"
                />
              </div>
            </div>
          )}

          {/* === IDENTIFIERS (ISRC/UPC) === */}
          {activeSection === 'identifiers' && (
            <div className="space-y-4">
              <div className="p-3 bg-cyan-500/10 border border-cyan-500/20 rounded-lg">
                <div className="flex items-start gap-2">
                  <Info size={16} className="text-cyan-400 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-cyan-300">
                    ISRCs and UPCs are unique codes that identify your music internationally. If you don&apos;t have them, 444Radio can auto-generate them for distribution.
                  </p>
                </div>
              </div>

              {/* ISRC */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">ISRC (Track Code)</label>
                <input
                  type="text"
                  value={formData.isrc}
                  onChange={e => updateField('isrc', e.target.value.toUpperCase())}
                  placeholder="e.g. USRC12345678 (auto-generated if empty)"
                  maxLength={12}
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:border-cyan-500/50 focus:outline-none font-mono"
                />
                <p className="text-xs text-gray-500 mt-1">International Standard Recording Code — unique per track</p>
              </div>

              {/* UPC */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">UPC / Barcode (Release Code)</label>
                <input
                  type="text"
                  value={formData.upc}
                  onChange={e => updateField('upc', e.target.value)}
                  placeholder="e.g. 123456789012 (auto-generated if empty)"
                  maxLength={13}
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:border-cyan-500/50 focus:outline-none font-mono"
                />
                <p className="text-xs text-gray-500 mt-1">Universal Product Code — used for releases (albums/EPs)</p>
              </div>

              {/* ISWC */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">ISWC (Publishing Code)</label>
                <input
                  type="text"
                  value={(formData as any).iswc || ''}
                  onChange={e => setFormData(prev => ({ ...prev, iswc: e.target.value }))}
                  placeholder="e.g. T-123.456.789-0 (optional)"
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:border-cyan-500/50 focus:outline-none font-mono"
                />
                <p className="text-xs text-gray-500 mt-1">International Standard Musical Work Code — for publishing metadata</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/10 bg-black/40 flex items-center justify-between">
          <div className="text-xs text-gray-500">
            {formData.title ? `"${formData.title}"` : 'Untitled'} 
            {formData.genre ? ` · ${formData.genre}` : ''}
            {formData.bpm ? ` · ${formData.bpm} BPM` : ''}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors text-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!formData.title.trim() || isSubmitting}
              className="px-6 py-2 bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-all shadow-lg shadow-cyan-500/30 disabled:shadow-none text-sm"
            >
              {isSubmitting ? 'Saving...' : mode === 'create' ? 'Release to Explore' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
