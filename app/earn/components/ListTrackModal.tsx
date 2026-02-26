'use client'

import { useState, useEffect, useRef } from 'react'
import { X, Music2, Sparkles, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useUser } from '@clerk/nextjs'

interface ListTrackModalProps {
  onClose: () => void
  onListed: () => void
}

interface UserTrack {
  id: string
  title: string
  audio_url: string
  image_url: string
  video_url?: string
  genre?: string
  plays: number
}

export default function ListTrackModal({ onClose, onListed }: ListTrackModalProps) {
  const { user } = useUser()
  const modalRef = useRef<HTMLDivElement>(null)
  const [userTracks, setUserTracks] = useState<UserTrack[]>([])
  const [selectedTrack, setSelectedTrack] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    modalRef.current?.focus()
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  // Fetch user's tracks that aren't already listed
  useEffect(() => {
    async function fetchUserTracks() {
      if (!user?.id) return
      setLoading(true)
      try {
        const { data, error } = await supabase
          .from('combined_media')
          .select('id, title, audio_url, image_url, video_url, genre, plays')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })

        if (!error && data) {
          setUserTracks(data)
        }
      } catch (err) {
        console.error('Failed to fetch user tracks:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchUserTracks()
  }, [user?.id])

  const handleList = async () => {
    if (!selectedTrack || submitting) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/earn/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackId: selectedTrack })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to list track')
      onListed()
    } catch (err: any) {
      alert(err.message || 'Failed to list track')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div
        ref={modalRef}
        tabIndex={-1}
        className="relative w-full max-w-lg bg-gray-950 border border-white/10 rounded-2xl overflow-hidden shadow-2xl max-h-[80vh] flex flex-col"
        role="dialog"
        aria-label="List a track on Earn"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-cyan-500 rounded-xl flex items-center justify-center">
              <Sparkles size={20} className="text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">List a Track</h3>
              <p className="text-xs text-gray-400">Earn 1 credit every time someone downloads</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition">
            <X size={18} />
          </button>
        </div>

        {/* Track list */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={24} className="text-cyan-400 animate-spin" />
            </div>
          ) : userTracks.length === 0 ? (
            <div className="text-center py-12">
              <Music2 size={32} className="mx-auto text-gray-600 mb-3" />
              <p className="text-gray-400">No tracks found. Create some music first!</p>
              <a href="/create" className="inline-block mt-3 text-sm text-cyan-400 hover:text-cyan-300 font-medium">
                Go to Create →
              </a>
            </div>
          ) : (
            <div className="space-y-2">
              {userTracks.map(track => (
                <button
                  key={track.id}
                  onClick={() => setSelectedTrack(track.id === selectedTrack ? null : track.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border transition text-left ${
                    selectedTrack === track.id
                      ? 'bg-emerald-500/10 border-emerald-500/40'
                      : 'bg-white/5 border-white/10 hover:bg-white/[0.08]'
                  }`}
                >
                  <div className="w-12 h-12 rounded-lg overflow-hidden bg-white/10 flex-shrink-0">
                    {track.image_url ? (
                      <img src={track.image_url} alt={track.title} className="w-full h-full object-cover" />
                    ) : track.video_url ? (
                      <video src={track.video_url} className="w-full h-full object-cover" muted playsInline preload="metadata" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Music2 size={16} className="text-gray-500" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{track.title}</p>
                    <p className="text-xs text-gray-500">{track.genre || 'No genre'} • {track.plays || 0} plays</p>
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    selectedTrack === track.id
                      ? 'border-emerald-500 bg-emerald-500'
                      : 'border-gray-600'
                  }`}>
                    {selectedTrack === track.id && (
                      <div className="w-2 h-2 rounded-full bg-white" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 pt-4 border-t border-white/10">
          <div className="text-xs text-gray-500 mb-3">
            <strong className="text-yellow-400">Listing fee: 2 credits</strong> (one-time, paid to 444 Radio)<br/>
            Users can download for <strong className="text-white">5 credits</strong> → 1 credit goes to you, 4 to 444 Radio
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-white/10 border border-white/10 text-gray-300 font-medium rounded-xl hover:bg-white/20 transition"
            >
              Cancel
            </button>
            <button
              onClick={handleList}
              disabled={!selectedTrack || submitting}
              className={`flex-1 px-4 py-3 font-semibold rounded-xl transition flex items-center justify-center gap-2 ${
                selectedTrack && !submitting
                  ? 'bg-gradient-to-r from-emerald-600 to-cyan-600 text-white shadow-lg shadow-emerald-500/20'
                  : 'bg-gray-800 text-gray-500 cursor-not-allowed'
              }`}
            >
              {submitting ? (
                <><Loader2 size={16} className="animate-spin" /> Listing...</>
              ) : (
                <><Sparkles size={16} /> List Track</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
