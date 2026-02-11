'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import { Search, Play, Pause, Send, X, Edit2, Music, Image as ImageIcon, ArrowLeft, Check, Filter, Grid3x3, List } from 'lucide-react'
import { useAudioPlayer } from '@/app/contexts/AudioPlayerContext'
import Toast from '@/app/components/Toast'

interface CombinedMedia {
  id: string
  title: string | null
  audio_url: string
  image_url: string | null
  lyrics: string | null
  music_prompt: string | null
  image_prompt: string | null
  is_published: boolean
  created_at: string
}

export default function ReleasePage() {
  const router = useRouter()
  const { user } = useUser()
  const { playTrack, currentTrack, isPlaying, togglePlayPause } = useAudioPlayer()

  // State
  const [items, setItems] = useState<CombinedMedia[]>([])
  const [filteredItems, setFilteredItems] = useState<CombinedMedia[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterPublished, setFilterPublished] = useState<'all' | 'published' | 'unpublished'>('unpublished')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  
  // Selection & Preview
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  const [previewItem, setPreviewItem] = useState<CombinedMedia | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [isPublishing, setIsPublishing] = useState(false)
  
  // Toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)

  // Fetch library
  useEffect(() => {
    fetchLibrary()
  }, [])

  const fetchLibrary = async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/library/combined')
      const data = await res.json()
      
      if (data.success && Array.isArray(data.combined)) {
        setItems(data.combined)
      }
    } catch (error) {
      console.error('Failed to fetch library:', error)
      setToast({ message: 'Failed to load library', type: 'error' })
    } finally {
      setIsLoading(false)
    }
  }

  // Filter & Search
  useEffect(() => {
    let filtered = items

    // Filter by publish status
    if (filterPublished === 'published') {
      filtered = filtered.filter(item => item.is_published)
    } else if (filterPublished === 'unpublished') {
      filtered = filtered.filter(item => !item.is_published)
    }

    // Search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(item => 
        item.title?.toLowerCase().includes(query) ||
        item.music_prompt?.toLowerCase().includes(query) ||
        item.image_prompt?.toLowerCase().includes(query)
      )
    }

    setFilteredItems(filtered)
  }, [items, searchQuery, filterPublished])

  // Toggle selection
  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedItems)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedItems(newSelected)
  }

  // Select all
  const selectAll = () => {
    setSelectedItems(new Set(filteredItems.map(item => item.id)))
  }

  // Clear selection
  const clearSelection = () => {
    setSelectedItems(new Set())
  }

  // Preview track
  const handlePreview = (item: CombinedMedia) => {
    setPreviewItem(item)
    setEditingTitle(item.title || '')
    
    // Play in global player
    playTrack({
      id: item.id,
      title: item.title || 'Untitled',
      artist: user?.username || user?.firstName || 'You',
      imageUrl: item.image_url || '/default-cover.jpg',
      audioUrl: item.audio_url
    })
  }

  // Update title
  const handleUpdateTitle = async () => {
    if (!previewItem || !editingTitle.trim()) return

    try {
      const res = await fetch(`/api/library/combined`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: previewItem.id,
          title: editingTitle.trim()
        })
      })

      const data = await res.json()
      
      if (res.ok && data.success) {
        // Update local state
        setItems(prev => prev.map(item => 
          item.id === previewItem.id ? { ...item, title: editingTitle.trim() } : item
        ))
        setPreviewItem(prev => prev ? { ...prev, title: editingTitle.trim() } : null)
        setToast({ message: 'Title updated!', type: 'success' })
      } else {
        setToast({ message: data.error || 'Failed to update title', type: 'error' })
      }
    } catch (error) {
      console.error('Update title error:', error)
      setToast({ message: 'Failed to update title', type: 'error' })
    }
  }

  // Publish single item
  const handlePublish = async (id: string) => {
    setIsPublishing(true)
    try {
      const res = await fetch(`/api/library/combined`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, is_published: true })
      })

      const data = await res.json()
      
      if (res.ok && data.success) {
        // Update local state
        setItems(prev => prev.map(item => 
          item.id === id ? { ...item, is_published: true } : item
        ))
        if (previewItem?.id === id) {
          setPreviewItem(prev => prev ? { ...prev, is_published: true } : null)
        }
        setToast({ message: '🎉 Published to Explore!', type: 'success' })
      } else {
        setToast({ message: data.error || 'Failed to publish', type: 'error' })
      }
    } catch (error) {
      console.error('Publish error:', error)
      setToast({ message: 'Failed to publish', type: 'error' })
    } finally {
      setIsPublishing(false)
    }
  }

  // Batch publish
  const handleBatchPublish = async () => {
    if (selectedItems.size === 0) return

    setIsPublishing(true)
    const ids = Array.from(selectedItems)
    let successCount = 0

    try {
      for (const id of ids) {
        const res = await fetch(`/api/library/combined`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, is_published: true })
        })

        if (res.ok) {
          successCount++
          // Update local state
          setItems(prev => prev.map(item => 
            item.id === id ? { ...item, is_published: true } : item
          ))
        }
      }

      setToast({ 
        message: `🎉 Published ${successCount}/${ids.length} tracks!`, 
        type: successCount === ids.length ? 'success' : 'info' 
      })
      clearSelection()
    } catch (error) {
      console.error('Batch publish error:', error)
      setToast({ message: 'Some tracks failed to publish', type: 'error' })
    } finally {
      setIsPublishing(false)
    }
  }

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-cyan-950/20 via-black to-black pointer-events-none" />

      {/* Back Button */}
      <button
        onClick={() => router.push('/library')}
        className="fixed top-4 left-4 z-50 px-4 py-2 rounded-full bg-black/60 backdrop-blur-md border border-cyan-500/30 flex items-center gap-2 text-cyan-400 hover:bg-black/80 hover:border-cyan-400 transition-all shadow-lg text-sm font-medium"
      >
        <ArrowLeft size={16} />
        <span>Back to Library</span>
      </button>

      <div className="relative z-10 max-w-[1800px] mx-auto px-4 pt-20 pb-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400 mb-2">
            Release Manager
          </h1>
          <p className="text-cyan-400/60 text-sm">Preview, edit, and publish your tracks to Explore</p>
        </div>

        {/* Layout: Left panel (list) + Right panel (preview) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* LEFT: Track List */}
          <div className="lg:col-span-2 space-y-4">
            {/* Filters & Search */}
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-4 space-y-4">
              {/* Search */}
              <div className="relative">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-cyan-400/60" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by title or prompt..."
                  className="w-full pl-10 pr-4 py-2.5 bg-black/40 border border-white/10 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-cyan-500/50"
                />
              </div>

              {/* Filter & View Controls */}
              <div className="flex items-center justify-between gap-4">
                {/* Filter Buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={() => setFilterPublished('unpublished')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      filterPublished === 'unpublished'
                        ? 'bg-cyan-500/20 border border-cyan-500 text-cyan-400'
                        : 'bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10'
                    }`}
                  >
                    Unreleased
                  </button>
                  <button
                    onClick={() => setFilterPublished('published')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      filterPublished === 'published'
                        ? 'bg-cyan-500/20 border border-cyan-500 text-cyan-400'
                        : 'bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10'
                    }`}
                  >
                    Published
                  </button>
                  <button
                    onClick={() => setFilterPublished('all')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      filterPublished === 'all'
                        ? 'bg-cyan-500/20 border border-cyan-500 text-cyan-400'
                        : 'bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10'
                    }`}
                  >
                    All
                  </button>
                </div>

                {/* View Mode Toggle */}
                <div className="flex gap-1 bg-black/40 rounded-lg p-1">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-1.5 rounded transition-all ${
                      viewMode === 'grid' ? 'bg-cyan-500/20 text-cyan-400' : 'text-gray-400 hover:text-cyan-400'
                    }`}
                  >
                    <Grid3x3 size={16} />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-1.5 rounded transition-all ${
                      viewMode === 'list' ? 'bg-cyan-500/20 text-cyan-400' : 'text-gray-400 hover:text-cyan-400'
                    }`}
                  >
                    <List size={16} />
                  </button>
                </div>
              </div>

              {/* Selection Controls */}
              {selectedItems.size > 0 && (
                <div className="flex items-center justify-between gap-4 p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
                  <span className="text-sm text-cyan-400 font-medium">
                    {selectedItems.size} selected
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={handleBatchPublish}
                      disabled={isPublishing}
                      className="px-4 py-1.5 bg-gradient-to-r from-cyan-600 to-cyan-400 text-white text-xs font-bold rounded-lg hover:from-cyan-700 hover:to-cyan-500 transition-all disabled:opacity-50"
                    >
                      {isPublishing ? 'Publishing...' : `Publish ${selectedItems.size}`}
                    </button>
                    <button
                      onClick={clearSelection}
                      className="px-3 py-1.5 bg-white/5 border border-white/10 text-gray-400 text-xs font-medium rounded-lg hover:bg-white/10 transition-all"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Track List */}
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-20">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-cyan-500/20 border-t-cyan-400 mb-3"></div>
                <p className="text-cyan-400/60 text-sm">Loading tracks...</p>
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="text-center py-20">
                <Music size={48} className="mx-auto mb-4 text-cyan-400/40" />
                <h3 className="text-xl font-bold text-white/60 mb-2">No tracks found</h3>
                <p className="text-cyan-400/50 text-sm mb-6">
                  {filterPublished === 'unpublished' ? 'All your tracks are published!' : 'Try adjusting your filters'}
                </p>
                <button
                  onClick={() => router.push('/library')}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-cyan-600 to-cyan-400 text-white rounded-xl font-bold hover:from-cyan-700 hover:to-cyan-500 transition-all"
                >
                  Go to Library
                </button>
              </div>
            ) : (
              <div className={viewMode === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 gap-4' : 'space-y-3'}>
                {filteredItems.map(item => (
                  <div
                    key={item.id}
                    className={`relative bg-white/5 backdrop-blur-xl border rounded-xl overflow-hidden transition-all hover:bg-white/10 ${
                      selectedItems.has(item.id) ? 'border-cyan-500 ring-2 ring-cyan-500/50' : 'border-white/10'
                    } ${previewItem?.id === item.id ? 'ring-2 ring-cyan-400' : ''}`}
                  >
                    {/* Selection Checkbox */}
                    <button
                      onClick={() => toggleSelection(item.id)}
                      className="absolute top-3 left-3 z-10 w-6 h-6 rounded-md border-2 border-white/30 bg-black/60 backdrop-blur-sm flex items-center justify-center transition-all hover:border-cyan-400"
                    >
                      {selectedItems.has(item.id) && (
                        <Check size={14} className="text-cyan-400" />
                      )}
                    </button>

                    {/* Published Badge */}
                    {item.is_published && (
                      <div className="absolute top-3 right-3 z-10 px-2 py-1 bg-green-500/20 border border-green-500/50 rounded-full text-[10px] font-bold text-green-400">
                        Published
                      </div>
                    )}

                    <div className={viewMode === 'grid' ? 'p-4' : 'flex gap-4 p-3'}>
                      {/* Cover Art */}
                      <div className={`relative ${viewMode === 'grid' ? 'aspect-square mb-3' : 'w-20 h-20 flex-shrink-0'} rounded-lg overflow-hidden bg-gradient-to-br from-cyan-500/20 to-purple-500/20`}>
                        {item.image_url ? (
                          <Image src={item.image_url} alt={item.title || 'Cover'} width={300} height={300} className="w-full h-full object-cover" loading="lazy" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <ImageIcon size={24} className="text-cyan-400/40" />
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-white truncate mb-1">
                          {item.title || 'Untitled Track'}
                        </h3>
                        <p className="text-xs text-cyan-400/60 truncate mb-2">
                          {new Date(item.created_at).toLocaleDateString()}
                        </p>

                        {/* Actions */}
                        <div className="flex gap-2">
                          <button
                            onClick={() => handlePreview(item)}
                            className="flex-1 px-3 py-2 bg-cyan-500/20 border border-cyan-500/50 text-cyan-400 text-xs font-medium rounded-lg hover:bg-cyan-500/30 transition-all flex items-center justify-center gap-2"
                          >
                            {currentTrack?.id === item.id && isPlaying ? (
                              <>
                                <Pause size={14} />
                                Preview
                              </>
                            ) : (
                              <>
                                <Play size={14} />
                                Preview
                              </>
                            )}
                          </button>
                          {!item.is_published && (
                            <button
                              onClick={() => handlePublish(item.id)}
                              disabled={isPublishing}
                              className="px-3 py-2 bg-gradient-to-r from-cyan-600 to-cyan-400 text-white text-xs font-bold rounded-lg hover:from-cyan-700 hover:to-cyan-500 transition-all disabled:opacity-50 flex items-center gap-1"
                            >
                              <Send size={14} />
                              Publish
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Batch Actions Footer */}
            {filteredItems.length > 0 && selectedItems.size === 0 && (
              <div className="text-center py-4">
                <button
                  onClick={selectAll}
                  className="text-sm text-cyan-400/60 hover:text-cyan-400 transition-all"
                >
                  Select all ({filteredItems.length} tracks)
                </button>
              </div>
            )}
          </div>

          {/* RIGHT: Preview Panel */}
          <div className="lg:col-span-1">
            <div className="sticky top-20">
              {previewItem ? (
                <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 space-y-6">
                  {/* Close Button */}
                  <button
                    onClick={() => setPreviewItem(null)}
                    className="absolute top-4 right-4 text-gray-400 hover:text-white transition-all"
                  >
                    <X size={20} />
                  </button>

                  {/* Cover Art */}
                  <div className="aspect-square rounded-xl overflow-hidden bg-gradient-to-br from-cyan-500/20 to-purple-500/20">
                    {previewItem.image_url ? (
                      <Image src={previewItem.image_url} alt={previewItem.title || 'Cover'} width={500} height={500} className="w-full h-full object-cover" priority />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon size={64} className="text-cyan-400/40" />
                      </div>
                    )}
                  </div>

                  {/* Title Editor */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-cyan-400 uppercase tracking-wide flex items-center gap-2">
                      <Edit2 size={12} />
                      Track Title
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={editingTitle}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        placeholder="Enter title..."
                        className="flex-1 px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-cyan-500/50"
                      />
                      <button
                        onClick={handleUpdateTitle}
                        disabled={editingTitle.trim() === previewItem.title}
                        className="px-4 py-2 bg-cyan-500/20 border border-cyan-500/50 text-cyan-400 text-sm font-medium rounded-lg hover:bg-cyan-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Save
                      </button>
                    </div>
                  </div>

                  {/* Metadata */}
                  <div className="space-y-3 text-sm">
                    <div>
                      <span className="text-cyan-400/60">Created:</span>
                      <span className="ml-2 text-white">{new Date(previewItem.created_at).toLocaleDateString()}</span>
                    </div>
                    {previewItem.music_prompt && (
                      <div>
                        <span className="text-cyan-400/60">Music Prompt:</span>
                        <p className="mt-1 text-white/80 text-xs">{previewItem.music_prompt}</p>
                      </div>
                    )}
                    {previewItem.image_prompt && (
                      <div>
                        <span className="text-cyan-400/60">Cover Prompt:</span>
                        <p className="mt-1 text-white/80 text-xs">{previewItem.image_prompt}</p>
                      </div>
                    )}
                  </div>

                  {/* Playback Control */}
                  <button
                    onClick={() => {
                      if (currentTrack?.id === previewItem.id) {
                        togglePlayPause()
                      } else {
                        handlePreview(previewItem)
                      }
                    }}
                    className="w-full py-3 bg-cyan-500/20 border border-cyan-500/50 text-cyan-400 font-bold rounded-xl hover:bg-cyan-500/30 transition-all flex items-center justify-center gap-2"
                  >
                    {currentTrack?.id === previewItem.id && isPlaying ? (
                      <>
                        <Pause size={20} />
                        Pause Preview
                      </>
                    ) : (
                      <>
                        <Play size={20} />
                        Play Preview
                      </>
                    )}
                  </button>

                  {/* Publish Button */}
                  {!previewItem.is_published ? (
                    <button
                      onClick={() => handlePublish(previewItem.id)}
                      disabled={isPublishing}
                      className="w-full py-3 bg-gradient-to-r from-cyan-600 to-cyan-400 text-white font-bold rounded-xl hover:from-cyan-700 hover:to-cyan-500 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20"
                    >
                      <Send size={20} />
                      {isPublishing ? 'Publishing...' : 'Publish to Explore'}
                    </button>
                  ) : (
                    <div className="text-center py-3 bg-green-500/10 border border-green-500/30 rounded-xl">
                      <span className="text-green-400 font-bold text-sm">✓ Published to Explore</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-12 text-center">
                  <Music size={48} className="mx-auto mb-4 text-cyan-400/40" />
                  <h3 className="font-bold text-white/60 mb-2">No Track Selected</h3>
                  <p className="text-cyan-400/50 text-sm">
                    Click preview on any track to see details and publish
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Toast Notifications */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  )
}
