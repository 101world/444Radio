'use client'

import { useState, useEffect } from 'react'
import { X, MapPin, Calendar, Users, CreditCard } from 'lucide-react'
import { useUser } from '@clerk/nextjs'
import { useCredits } from '@/app/contexts/CreditsContext'

interface PrivateList {
  id: string
  artist_id: string
  title: string
  description: string
  location: string
  event_date: string
  price_credits: number
  max_capacity: number
  cover_image_url?: string
  video_url?: string
  hype_text?: string
  requirements?: string
  member_count: number
  is_member: boolean
}

interface PrivateListModalProps {
  isOpen: boolean
  onClose: () => void
  artistId: string
  isOwnProfile: boolean
}

export default function PrivateListModal({ isOpen, onClose, artistId, isOwnProfile }: PrivateListModalProps) {
  const { user } = useUser()
  const [lists, setLists] = useState<PrivateList[]>([])
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const { totalCredits: userCredits, refreshCredits } = useCredits()
  const [selectedList, setSelectedList] = useState<PrivateList | null>(null)

  // Create list form state
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [location, setLocation] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [priceCredits, setPriceCredits] = useState(0)
  const [maxCapacity, setMaxCapacity] = useState(100)
  const [coverImage, setCoverImage] = useState<File | null>(null)
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [hypeText, setHypeText] = useState('')
  const [requirements, setRequirements] = useState('')
  const [coverImagePreview, setCoverImagePreview] = useState('')
  const [videoPreview, setVideoPreview] = useState('')

  useEffect(() => {
    if (isOpen) {
      fetchLists()
    }
  }, [isOpen, artistId])

  const fetchLists = async () => {
    try {
      const response = await fetch(`/api/private-lists?artistId=${artistId}`)
      if (response.ok) {
        const data = await response.json()
        setLists(data.lists || [])
      }
    } catch (error) {
      console.error('Error fetching private lists:', error)
    }
  }

  const createList = async () => {
    if (!title || !location) {
      alert('Please fill in title and location')
      return
    }

    setLoading(true)
    try {
      const formData = new FormData()
      formData.append('title', title)
      formData.append('description', description)
      formData.append('location', location)
      formData.append('event_date', eventDate || '')
      formData.append('price_credits', priceCredits.toString())
      formData.append('max_capacity', maxCapacity.toString())
      formData.append('hype_text', hypeText)
      formData.append('requirements', requirements)
      
      if (coverImage) {
        formData.append('cover_image', coverImage)
      }
      if (videoFile) {
        formData.append('video', videoFile)
      }

      const response = await fetch('/api/private-lists', {
        method: 'POST',
        body: formData
      })

      if (response.ok) {
        setTitle('')
        setDescription('')
        setLocation('')
        setEventDate('')
        setPriceCredits(0)
        setMaxCapacity(100)
        setCoverImage(null)
        setVideoFile(null)
        setHypeText('')
        setRequirements('')
        setCoverImagePreview('')
        setVideoPreview('')
        setCreating(false)
        fetchLists()
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to create list')
      }
    } catch (error) {
      console.error('Error creating list:', error)
      alert('Failed to create list')
    } finally {
      setLoading(false)
    }
  }

  const joinList = async (listId: string, priceCredits: number) => {
    if (priceCredits > (userCredits || 0)) {
      alert(`Not enough credits! You need ${priceCredits} credits but only have ${userCredits || 0}`)
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/private-lists/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listId })
      })

      if (response.ok) {
        fetchLists()
        refreshCredits()
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to join list')
      }
    } catch (error) {
      console.error('Error joining list:', error)
      alert('Failed to join list')
    } finally {
      setLoading(false)
    }
  }

  const leaveList = async (listId: string) => {
    setLoading(true)
    try {
      const response = await fetch('/api/private-lists/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listId })
      })

      if (response.ok) {
        fetchLists()
        refreshCredits()
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to leave list')
      }
    } catch (error) {
      console.error('Error leaving list:', error)
      alert('Failed to leave list')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  // Event Details Modal (when clicking on a list)
  if (selectedList) {
    return (
      <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-gradient-to-br from-purple-900/60 via-indigo-900/60 to-purple-900/60 backdrop-blur-xl border border-purple-500/40 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl">
          
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-purple-500/30">
            <h2 className="text-3xl font-black text-purple-300">{selectedList.title}</h2>
            <button
              onClick={() => setSelectedList(null)}
              className="p-2 hover:bg-purple-500/20 rounded-lg transition-colors"
            >
              <X size={24} className="text-purple-300" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
            
            {/* Cover Image */}
            {selectedList.cover_image_url && (
              <div className="mb-6 rounded-xl overflow-hidden">
                <img 
                  src={selectedList.cover_image_url} 
                  alt={selectedList.title}
                  className="w-full h-64 object-cover"
                />
              </div>
            )}

            {/* Video */}
            {selectedList.video_url && (
              <div className="mb-6 rounded-xl overflow-hidden">
                <video 
                  src={selectedList.video_url} 
                  controls
                  className="w-full max-h-96 object-contain bg-black"
                />
              </div>
            )}

            {/* Hype Text */}
            {selectedList.hype_text && (
              <div className="mb-6 bg-black/40 border border-purple-500/30 rounded-xl p-4">
                <h3 className="text-lg font-black text-purple-300 mb-2">🔥 THE HYPE</h3>
                <p className="text-purple-200 whitespace-pre-wrap">{selectedList.hype_text}</p>
              </div>
            )}

            {/* Description */}
            {selectedList.description && (
              <div className="mb-6">
                <h3 className="text-lg font-black text-purple-300 mb-2">About</h3>
                <p className="text-purple-200">{selectedList.description}</p>
              </div>
            )}

            {/* Requirements */}
            {selectedList.requirements && (
              <div className="mb-6 bg-purple-900/30 border border-purple-500/30 rounded-xl p-4">
                <h3 className="text-lg font-black text-purple-300 mb-2">Requirements</h3>
                <p className="text-purple-200 whitespace-pre-wrap">{selectedList.requirements}</p>
              </div>
            )}

            {/* Event Details Grid */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-black/40 border border-purple-500/30 rounded-xl p-4">
                <div className="flex items-center gap-2 text-purple-400 mb-1">
                  <MapPin size={16} />
                  <span className="text-xs font-semibold">Location</span>
                </div>
                <p className="text-white font-bold">{selectedList.location}</p>
              </div>

              {selectedList.event_date && (
                <div className="bg-black/40 border border-purple-500/30 rounded-xl p-4">
                  <div className="flex items-center gap-2 text-purple-400 mb-1">
                    <Calendar size={16} />
                    <span className="text-xs font-semibold">Date & Time</span>
                  </div>
                  <p className="text-white font-bold text-sm">
                    {new Date(selectedList.event_date).toLocaleString()}
                  </p>
                </div>
              )}

              <div className="bg-black/40 border border-purple-500/30 rounded-xl p-4">
                <div className="flex items-center gap-2 text-purple-400 mb-1">
                  <Users size={16} />
                  <span className="text-xs font-semibold">Capacity</span>
                </div>
                <p className="text-white font-bold">
                  {selectedList.member_count} / {selectedList.max_capacity}
                </p>
              </div>

              <div className="bg-black/40 border border-purple-500/30 rounded-xl p-4">
                <div className="flex items-center gap-2 text-purple-400 mb-1">
                  <CreditCard size={16} />
                  <span className="text-xs font-semibold">Entry Price</span>
                </div>
                <p className="text-white font-bold">{selectedList.price_credits} Credits</p>
              </div>
            </div>

            {/* Action Button */}
            {!isOwnProfile && (
              <div>
                {selectedList.is_member ? (
                  <button
                    onClick={() => {
                      leaveList(selectedList.id)
                      setSelectedList(null)
                    }}
                    disabled={loading}
                    className="w-full py-4 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white font-black text-lg rounded-xl transition-colors"
                  >
                    Leave List (Refund {selectedList.price_credits} Credits)
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      joinList(selectedList.id, selectedList.price_credits)
                      setSelectedList(null)
                    }}
                    disabled={loading || selectedList.member_count >= selectedList.max_capacity}
                    className="w-full py-4 bg-gradient-to-r from-purple-600 to-purple-800 hover:from-purple-700 hover:to-purple-900 disabled:bg-gray-600 text-white font-black text-lg rounded-xl transition-colors shadow-lg"
                  >
                    {selectedList.member_count >= selectedList.max_capacity
                      ? '❌ SOLD OUT'
                      : `🎉 JOIN PRVTLST (${selectedList.price_credits} Credits)`}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Main List View
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gradient-to-br from-purple-900/40 via-indigo-900/40 to-purple-900/40 backdrop-blur-xl border border-purple-500/30 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-2xl">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-purple-500/30">
          <div>
            <h2 className="text-2xl font-black text-purple-300">PRVTLST</h2>
            {!isOwnProfile && (
              <p className="text-sm text-purple-400 mt-1">Your Credits: {userCredits}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-purple-500/20 rounded-lg transition-colors"
          >
            <X size={24} className="text-purple-300" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-100px)]">
          
          {/* Create New List (Artist Only) */}
          {isOwnProfile && (
            <div className="mb-6">
              {!creating ? (
                <button
                  onClick={() => setCreating(true)}
                  className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl transition-colors"
                >
                  + Create New Private List
                </button>
              ) : (
                <div className="bg-black/40 p-4 rounded-xl space-y-3">
                  <input
                    type="text"
                    placeholder="Event Title *"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-4 py-2 bg-purple-900/30 border border-purple-500/30 rounded-lg text-white placeholder-purple-400"
                  />
                  <textarea
                    placeholder="Description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    className="w-full px-4 py-2 bg-purple-900/30 border border-purple-500/30 rounded-lg text-white placeholder-purple-400"
                  />
                  <textarea
                    placeholder="🔥 Hype Text - Get people EXCITED!"
                    value={hypeText}
                    onChange={(e) => setHypeText(e.target.value)}
                    rows={3}
                    className="w-full px-4 py-2 bg-purple-900/30 border border-purple-500/30 rounded-lg text-white placeholder-purple-400"
                  />
                  <textarea
                    placeholder="Requirements (dress code, age, etc.)"
                    value={requirements}
                    onChange={(e) => setRequirements(e.target.value)}
                    rows={2}
                    className="w-full px-4 py-2 bg-purple-900/30 border border-purple-500/30 rounded-lg text-white placeholder-purple-400"
                  />
                  <input
                    type="text"
                    placeholder="Location *"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full px-4 py-2 bg-purple-900/30 border border-purple-500/30 rounded-lg text-white placeholder-purple-400"
                  />
                  <input
                    type="datetime-local"
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    className="w-full px-4 py-2 bg-purple-900/30 border border-purple-500/30 rounded-lg text-white"
                  />
                  
                  {/* Cover Image Upload */}
                  <div>
                    <label className="block text-sm text-purple-400 mb-2">Event Cover Image</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) {
                          setCoverImage(file)
                          setCoverImagePreview(URL.createObjectURL(file))
                        }
                      }}
                      className="w-full px-4 py-2 bg-purple-900/30 border border-purple-500/30 rounded-lg text-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-purple-600 file:text-white hover:file:bg-purple-700"
                    />
                    {coverImagePreview && (
                      <img src={coverImagePreview} alt="Preview" className="mt-2 w-full h-32 object-cover rounded-lg" />
                    )}
                  </div>

                  {/* Video Upload */}
                  <div>
                    <label className="block text-sm text-purple-400 mb-2">Hype Video</label>
                    <input
                      type="file"
                      accept="video/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) {
                          setVideoFile(file)
                          setVideoPreview(URL.createObjectURL(file))
                        }
                      }}
                      className="w-full px-4 py-2 bg-purple-900/30 border border-purple-500/30 rounded-lg text-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-purple-600 file:text-white hover:file:bg-purple-700"
                    />
                    {videoPreview && (
                      <video src={videoPreview} controls className="mt-2 w-full h-32 object-cover rounded-lg" />
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="number"
                      placeholder="Price (Credits)"
                      value={priceCredits}
                      onChange={(e) => setPriceCredits(parseInt(e.target.value) || 0)}
                      min="0"
                      className="w-full px-4 py-2 bg-purple-900/30 border border-purple-500/30 rounded-lg text-white"
                    />
                    <input
                      type="number"
                      placeholder="Max Capacity"
                      value={maxCapacity}
                      onChange={(e) => setMaxCapacity(parseInt(e.target.value) || 100)}
                      min="1"
                      className="w-full px-4 py-2 bg-purple-900/30 border border-purple-500/30 rounded-lg text-white"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={createList}
                      disabled={loading}
                      className="flex-1 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white font-bold rounded-lg transition-colors"
                    >
                      {loading ? 'Creating...' : 'Create Party'}
                    </button>
                    <button
                      onClick={() => setCreating(false)}
                      className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white font-bold rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Lists */}
          <div className="space-y-4">
            {lists.length === 0 ? (
              <div className="text-center py-12 text-purple-400">
                <Users size={48} className="mx-auto mb-4 opacity-50" />
                <p className="text-lg font-semibold">No private lists yet</p>
                {isOwnProfile && <p className="text-sm mt-2">Create your first event!</p>}
              </div>
            ) : (
              lists.map((list) => (
                <div
                  key={list.id}
                  onClick={() => setSelectedList(list)}
                  className="bg-black/40 border border-purple-500/30 rounded-xl overflow-hidden hover:border-purple-500/50 transition-all cursor-pointer hover:scale-[1.02]"
                >
                  {/* Cover Image */}
                  {list.cover_image_url && (
                    <div className="w-full h-48 overflow-hidden">
                      <img 
                        src={list.cover_image_url} 
                        alt={list.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  
                  <div className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="text-lg font-black text-purple-300">{list.title}</h3>
                        {list.hype_text && (
                          <p className="text-sm text-purple-400 mt-1 line-clamp-2">
                            🔥 {list.hype_text}
                          </p>
                        )}
                      </div>
                      {list.is_member && (
                        <span className="px-3 py-1 bg-green-600/30 text-green-400 text-xs font-bold rounded-full ml-2">
                          JOINED
                        </span>
                      )}
                    </div>

                    <div className="space-y-2 text-sm text-purple-400">
                      <div className="flex items-center gap-2">
                        <MapPin size={16} />
                        <span>{list.location}</span>
                      </div>
                      {list.event_date && (
                        <div className="flex items-center gap-2">
                          <Calendar size={16} />
                          <span>{new Date(list.event_date).toLocaleString()}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <Users size={16} />
                          <span>{list.member_count} / {list.max_capacity}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CreditCard size={16} />
                          <span className="font-bold text-purple-300">{list.price_credits} Credits</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 text-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedList(list)
                        }}
                        className="w-full py-2 bg-purple-600/30 hover:bg-purple-600/50 text-purple-300 font-bold rounded-lg transition-colors border border-purple-500/30"
                      >
                        View Details →
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
