'use client'

import { useState, useEffect, useMemo, useCallback, lazy, Suspense } from 'react'
import { useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import {
  Download, Search, TrendingUp, Clock, Music2,
  X, Sparkles, ChevronDown, Users, Zap, ArrowLeft, Info, AudioLines, Play, Pause, Trash2, Loader2, User, DollarSign
} from 'lucide-react'
import { useAudioPlayer } from '../contexts/AudioPlayerContext'
import { useCredits } from '../contexts/CreditsContext'
import FloatingMenu from '../components/FloatingMenu'
import TrackInfoModal from '../components/TrackInfoModal'
import ArtistProfileModal from './components/ArtistProfileModal'
import DownloadModal from './components/DownloadModal'
import SuccessModal from './components/SuccessModal'
import ListTrackModal from './components/ListTrackModal'
import TrackCard from './components/TrackCard'

const HolographicBackgroundClient = lazy(() => import('../components/HolographicBackgroundClient'))

interface EarnTrack {
  id: string; title: string; audio_url: string; image_url: string; user_id: string
  username: string; avatar_url?: string; genre?: string; plays: number; likes: number
  downloads: number; created_at: string; listed_on_earn: boolean; earn_price: number
  artist_share: number; admin_share: number; mood?: string; bpm?: number; key_signature?: string
  vocals?: string; language?: string; tags?: string[]; description?: string; instruments?: string[]
  secondary_genre?: string; is_explicit?: boolean; duration_seconds?: number
}
interface ArtistInfo {
  user_id: string; username: string; avatar_url?: string; bio?: string
  trackCount: number; totalDownloads: number; totalPlays: number
}
type FilterType = 'trending' | 'most_downloaded' | 'latest' | 'bought'

export default function EarnPage() {
  const { user, isSignedIn } = useUser()
  const router = useRouter()
  const { currentTrack, isPlaying, togglePlayPause, setPlaylist } = useAudioPlayer()

  const [tracks, setTracks] = useState<EarnTrack[]>([])
  const [boughtTracks, setBoughtTracks] = useState<EarnTrack[]>([])
  const [loading, setLoading] = useState(true)
  const { totalCredits: credits, refreshCredits } = useCredits()
  const [filter, setFilter] = useState<FilterType>('trending')
  const [selectedGenre, setSelectedGenre] = useState('All')
  const [searchQuery, setSearchQuery] = useState('')
  const [genres, setGenres] = useState<string[]>(['All'])

  // Modals
  const [selectedArtist, setSelectedArtist] = useState<ArtistInfo | null>(null)
  const [downloadTrack, setDownloadTrack] = useState<EarnTrack | null>(null)
  const [successData, setSuccessData] = useState<{ track: EarnTrack; splitJobId?: string; stemStatus?: 'splitting' | 'done' | 'failed' | 'refunded' } | null>(null)
  const [showListModal, setShowListModal] = useState(false)
  const [infoTrack, setInfoTrack] = useState<EarnTrack | null>(null)

  // ── Voice IDs marketplace ──
  type MarketplaceTab = 'tracks' | 'voices'
  const [marketplaceTab, setMarketplaceTab] = useState<MarketplaceTab>('tracks')

  interface VoiceListing {
    id: string; voice_id: string; name: string; description: string; preview_url: string | null
    price_credits: number; total_uses: number; total_royalties_earned: number
    clerk_user_id: string; username: string; avatar_url: string | null; is_active: boolean; created_at: string
  }

  const [voiceListings, setVoiceListings] = useState<VoiceListing[]>([])
  const [loadingVoices, setLoadingVoices] = useState(false)
  const [voicePreviewId, setVoicePreviewId] = useState<string | null>(null)
  const [voicePreviewAudio, setVoicePreviewAudio] = useState<HTMLAudioElement | null>(null)

  const fetchVoiceListings = useCallback(async () => {
    setLoadingVoices(true)
    try {
      const res = await fetch('/api/earn/voices')
      const data = await res.json()
      if (data.success) setVoiceListings(data.voices || [])
    } catch { console.error('Failed to fetch voice listings') }
    finally { setLoadingVoices(false) }
  }, [])

  useEffect(() => {
    if (marketplaceTab === 'voices') fetchVoiceListings()
  }, [marketplaceTab, fetchVoiceListings])

  const handleVoicePreview = (url: string, id: string) => {
    if (voicePreviewId === id) {
      voicePreviewAudio?.pause()
      setVoicePreviewId(null)
    } else {
      voicePreviewAudio?.pause()
      const audio = new Audio(url)
      audio.onended = () => setVoicePreviewId(null)
      audio.play()
      setVoicePreviewAudio(audio)
      setVoicePreviewId(id)
    }
  }

  const handleUnlistVoice = async (listingId: string) => {
    if (!confirm('Remove this voice from the marketplace?')) return
    try {
      const res = await fetch('/api/earn/voices', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingId })
      })
      if (res.ok) setVoiceListings(prev => prev.filter(v => v.id !== listingId))
    } catch { console.error('Failed to unlist voice') }
  }

  const fetchTracks = useCallback(async () => {
    setLoading(true)
    try {
      if (filter === 'bought' && isSignedIn) {
        const res = await fetch('/api/library/bought')
        const data = await res.json()
        if (data.success && data.tracks) {
          setBoughtTracks(data.tracks)
        }
      } else {
        const params = new URLSearchParams({ filter, genre: selectedGenre === 'All' ? '' : selectedGenre, q: searchQuery })
        const res = await fetch(`/api/earn/tracks?${params}`)
        const data = await res.json()
        if (data.success) {
          setTracks(data.tracks || [])
          if (data.genres?.length) setGenres(['All', ...data.genres])
        }
      }
    } catch (err) { console.error('Failed to fetch earn tracks:', err) }
    finally { setLoading(false) }
  }, [filter, selectedGenre, searchQuery, isSignedIn])

  useEffect(() => { fetchTracks() }, [fetchTracks])

  const handlePlay = useCallback((track: EarnTrack) => {
    const toAudioTrack = (t: EarnTrack) => ({
      id: t.id, audioUrl: t.audio_url, title: t.title, artist: t.username, imageUrl: t.image_url, userId: t.user_id,
      genre: t.genre || undefined, mood: t.mood || undefined, tags: t.tags || undefined
    })
    if (currentTrack?.id === track.id) { togglePlayPause() } else {
      const playlist = tracks.map(toAudioTrack)
      const idx = tracks.findIndex(t => t.id === track.id)
      setPlaylist(playlist, Math.max(idx, 0))
    }
  }, [currentTrack, togglePlayPause, setPlaylist, tracks])

  const handlePurchase = async (trackId: string, splitStems: boolean) => {
    try {
      const res = await fetch('/api/earn/purchase', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ trackId, splitStems }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Purchase failed')
      setTracks(prev => prev.map(t => t.id === trackId ? { ...t, downloads: (t.downloads || 0) + 1 } : t))
      refreshCredits()
      if (data.audioUrl) {
        try {
          const dlRes = await fetch(data.audioUrl)
          const blob = await dlRes.blob()
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url; a.download = `${data.title || 'track'}.mp3`
          document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
        } catch (dlErr) { console.error('Auto-download failed:', dlErr) }
      }
      const track = tracks.find(t => t.id === trackId)
      if (track) {
        setDownloadTrack(null)
        setSuccessData({ track, splitJobId: data.splitJobId, stemStatus: splitStems ? 'splitting' : undefined })
      }

      // Actually trigger stem splitting if requested
      if (splitStems && data.splitJobId && data.audioUrl) {
        triggerStemSplit(data.audioUrl, data.splitJobId)
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Purchase failed'
      alert(message)
      refreshCredits()
    }
  }

  const triggerStemSplit = async (audioUrl: string, earnJobId: string) => {
    try {
      const res = await fetch('/api/audio/split-stems', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          audioUrl, 
          earnJobId,
          model: 'htdemucs_6s',  // 444 Heat model (Extended)
          stem: 'all',            // Extract all stems
          output_format: 'wav',   // High quality WAV output
        }),
      })

      if (!res.ok || !res.body) {
        setSuccessData(prev => prev ? { ...prev, stemStatus: 'failed' } : null)
        refreshCredits()
        return
      }

      // Read NDJSON stream
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.trim()) continue
          try {
            const msg = JSON.parse(line)
            if (msg.type === 'result') {
              if (msg.success) {
                setSuccessData(prev => prev ? { ...prev, stemStatus: 'done' } : null)
              } else {
                setSuccessData(prev => prev ? { ...prev, stemStatus: msg.refunded ? 'refunded' : 'failed' } : null)
              }
              refreshCredits()
            }
          } catch { /* skip malformed lines */ }
        }
      }
    } catch (error) {
      console.error('Stem split trigger failed:', error)
      setSuccessData(prev => prev ? { ...prev, stemStatus: 'failed' } : null)
      refreshCredits()
    }
  }

  const handleOpenArtist = useCallback(async (userId: string) => {
    try {
      const res = await fetch(`/api/earn/artist/${userId}`)
      const data = await res.json()
      if (data.success) setSelectedArtist(data.artist)
    } catch { console.error('Failed to load artist') }
  }, [])

  const handleTrackListed = () => { setShowListModal(false); fetchTracks(); refreshCredits() }

  const handleUnlist = async (trackId: string) => {
    if (!confirm('Remove this track from the marketplace? The listing fee is non-refundable.')) return
    try {
      const res = await fetch('/api/earn/unlist', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ trackId }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to unlist')
      setTracks(prev => prev.filter(t => t.id !== trackId))
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to unlist track'
      alert(message)
    }
  }

  const displayTracks = useMemo(() => {
    const sourceData = filter === 'bought' ? boughtTracks : tracks
    if (!searchQuery.trim()) return sourceData
    const q = searchQuery.toLowerCase()
    return sourceData.filter(t => t.title.toLowerCase().includes(q) || t.username?.toLowerCase().includes(q) || t.genre?.toLowerCase().includes(q))
  }, [tracks, boughtTracks, searchQuery, filter])

  const totalDownloads = useMemo(() => tracks.reduce((s, t) => s + (t.downloads || 0), 0), [tracks])
  const totalArtists = useMemo(() => new Set(tracks.map(t => t.user_id)).size, [tracks])

  return (
    <div className="min-h-screen text-white">
      {/* 3D Holographic Background */}
      <div className="fixed inset-0 -z-10">
        <Suspense fallback={<div className="w-full h-full bg-gradient-to-b from-gray-950 via-gray-900 to-black" />}>
          <HolographicBackgroundClient />
        </Suspense>
      </div>
      <div className="fixed inset-0 bg-black/15 backdrop-blur-[0.5px] -z-[5] pointer-events-none" />

      <FloatingMenu />

      <main className="relative z-10 md:pl-[72px] pb-32 pt-4">
        {/* Header row: back + title + List Track + credits */}
        <div className="px-4 md:px-8">
          <div className="flex items-center gap-3 mb-4">
            <button onClick={() => router.push('/create')} className="p-2 rounded-xl bg-white/[0.04] border border-white/[0.06] backdrop-blur-xl hover:bg-white/[0.08] transition">
              <ArrowLeft size={18} className="text-gray-400" />
            </button>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-400 bg-clip-text text-transparent">EARN</h1>
              <p className="text-[10px] text-gray-500">Community marketplace</p>
            </div>

            {/* List Track button — right next to heading */}
            {isSignedIn && (
              <button onClick={() => setShowListModal(true)}
                className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-emerald-600/80 to-cyan-600/80 border border-emerald-500/30 text-white text-xs font-semibold rounded-xl backdrop-blur-xl hover:from-emerald-500/80 hover:to-cyan-500/80 transition-all shadow-lg shadow-emerald-500/10">
                <Sparkles size={13} /> List Track
              </button>
            )}

            {/* Credits badge — far right */}
            <div className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.04] border border-emerald-500/20 rounded-xl backdrop-blur-xl">
              <Zap size={12} className="text-emerald-400" />
              <span className="text-xs font-semibold text-white">{credits}</span>
              <span className="text-[9px] text-gray-500">cr</span>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-2 md:gap-3 mb-4">
            <GlassCard icon={<Music2 size={14} className="text-cyan-400" />} value={tracks.length} label="tracks" />
            <GlassCard icon={<Download size={14} className="text-emerald-400" />} value={totalDownloads} label="downloads" />
            <GlassCard icon={<Users size={14} className="text-purple-400" />} value={totalArtists} label="artists" />
          </div>

          {/* ═══ MARKETPLACE TAB SWITCHER ═══ */}
          <div className="flex gap-1 bg-white/[0.03] border border-white/[0.06] p-1 rounded-xl backdrop-blur-xl mb-4">
            <button
              onClick={() => setMarketplaceTab('tracks')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                marketplaceTab === 'tracks'
                  ? 'bg-gradient-to-r from-emerald-600/30 to-cyan-600/30 text-cyan-300 border border-cyan-500/30'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              <Music2 size={13} /> Tracks
            </button>
            <button
              onClick={() => setMarketplaceTab('voices')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                marketplaceTab === 'voices'
                  ? 'bg-gradient-to-r from-purple-600/30 to-pink-600/30 text-purple-300 border border-purple-500/30'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              <AudioLines size={13} /> Voice IDs
            </button>
          </div>

          {/* ═══ TRACKS TAB ═══ */}
          {marketplaceTab === 'tracks' && (
            <>
          {/* Filter bar */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <div className="flex gap-1 bg-white/[0.03] border border-white/[0.06] p-1 rounded-xl backdrop-blur-xl">
              {([
                { key: 'trending' as FilterType, label: 'Trending', icon: TrendingUp },
                { key: 'most_downloaded' as FilterType, label: 'Top', icon: Download },
                { key: 'latest' as FilterType, label: 'New', icon: Clock },
                ...(isSignedIn ? [{ key: 'bought' as FilterType, label: 'Bought', icon: Download }] : []),
              ] as const).map(f => (
                <button key={f.key} onClick={() => setFilter(f.key)}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all ${filter === f.key ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'}`}>
                  <f.icon size={11} /> {f.label}
                </button>
              ))}
            </div>
            <div className="relative">
              <select value={selectedGenre} onChange={e => setSelectedGenre(e.target.value)}
                className="appearance-none bg-white/[0.04] border border-white/[0.06] text-gray-300 text-[11px] px-3 py-1.5 pr-7 rounded-xl backdrop-blur-xl focus:outline-none focus:border-cyan-500/30 cursor-pointer">
                {genres.map(g => <option key={g} value={g} className="bg-gray-900">{g}</option>)}
              </select>
              <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-600 pointer-events-none" />
            </div>
            <div className="relative flex-1 max-w-xs">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-600" />
              <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search..."
                className="w-full bg-white/[0.04] border border-white/[0.06] text-white text-[11px] pl-8 pr-8 py-1.5 rounded-xl backdrop-blur-xl placeholder-gray-600 focus:outline-none focus:border-cyan-500/30" />
              {searchQuery && <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-600 hover:text-white"><X size={10} /></button>}
            </div>
          </div>
            </>
          )}

          {/* ═══ VOICE IDs TAB ═══ */}
          {marketplaceTab === 'voices' && (
            <div className="mb-4">
              <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4 mb-4 backdrop-blur-xl">
                <div className="flex items-start gap-3">
                  <AudioLines size={18} className="text-purple-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-purple-300 text-sm font-medium">Voice ID Marketplace</p>
                    <p className="text-gray-400 text-xs mt-0.5">Use community-trained Voice IDs in your generations. Each generation earns the voice creator <strong className="text-purple-300">1 credit</strong> as royalty.</p>
                  </div>
                </div>
              </div>
              {isSignedIn && (
                <button
                  onClick={() => router.push('/voice-training')}
                  className="flex items-center gap-1.5 px-4 py-2 mb-4 bg-gradient-to-r from-purple-600/80 to-pink-600/80 border border-purple-500/30 text-white text-xs font-semibold rounded-xl backdrop-blur-xl hover:from-purple-500/80 hover:to-pink-500/80 transition-all shadow-lg shadow-purple-500/10"
                >
                  <Sparkles size={13} /> Train & List Your Voice
                </button>
              )}
            </div>
          )}
        </div>

        {/* ═══ TRACK GRID (tracks tab) ═══ */}
        {marketplaceTab === 'tracks' && (
        <div className="px-4 md:px-8">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 backdrop-blur-xl animate-pulse">
                  <div className="flex gap-3"><div className="w-20 h-20 rounded-xl bg-white/[0.06]" /><div className="flex-1 space-y-2"><div className="h-3 bg-white/[0.06] rounded w-3/4" /><div className="h-2.5 bg-white/[0.06] rounded w-1/2" /></div></div>
                </div>
              ))}
            </div>
          ) : displayTracks.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {displayTracks.map(track => (
                <TrackCard key={track.id} track={track}
                  isCurrentTrack={currentTrack?.id === track.id}
                  isPlaying={currentTrack?.id === track.id && isPlaying}
                  currentUserId={user?.id}
                  onPlay={() => handlePlay(track)}
                  onDownload={() => setDownloadTrack(track)}
                  onOpenArtist={() => handleOpenArtist(track.user_id)}
                  onUnlist={handleUnlist}
                  onInfo={() => setInfoTrack(track)} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 bg-white/[0.03] border border-white/[0.06] rounded-2xl flex items-center justify-center mb-4 backdrop-blur-xl">
                <Music2 size={28} className="text-gray-600" />
              </div>
              <h3 className="text-base font-semibold text-gray-300 mb-1">No tracks listed</h3>
              <p className="text-gray-600 text-xs max-w-sm mb-4">Be the first to list tracks and earn credits.</p>
              {isSignedIn && (
                <button onClick={() => setShowListModal(true)}
                  className="flex items-center gap-1.5 px-5 py-2 bg-gradient-to-r from-emerald-600/80 to-cyan-600/80 text-white text-xs font-semibold rounded-xl">
                  <Sparkles size={14} /> List Your First Track
                </button>
              )}
            </div>
          )}
        </div>
        )}

        {/* ═══ VOICE IDs GRID (voices tab) ═══ */}
        {marketplaceTab === 'voices' && (
        <div className="px-4 md:px-8">
          {loadingVoices ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 backdrop-blur-xl animate-pulse">
                  <div className="flex gap-3"><div className="w-12 h-12 rounded-xl bg-white/[0.06]" /><div className="flex-1 space-y-2"><div className="h-3 bg-white/[0.06] rounded w-3/4" /><div className="h-2.5 bg-white/[0.06] rounded w-1/2" /></div></div>
                </div>
              ))}
            </div>
          ) : voiceListings.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {voiceListings.map(voice => (
                <div key={voice.id} className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 backdrop-blur-xl hover:border-purple-500/30 transition-colors group">
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center flex-shrink-0">
                      {voice.avatar_url ? (
                        <img src={voice.avatar_url} alt={voice.username} className="w-full h-full object-cover rounded-xl" />
                      ) : (
                        <User size={20} className="text-purple-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-white text-sm font-semibold truncate">{voice.name}</h3>
                      <p className="text-gray-500 text-[11px]">by @{voice.username}</p>
                      {voice.description && <p className="text-gray-400 text-[10px] mt-1 line-clamp-2">{voice.description}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mt-3">
                    <span className="text-[10px] text-gray-500 flex items-center gap-1"><AudioLines size={10} className="text-purple-400" /> {voice.total_uses} uses</span>
                    <span className="text-[10px] text-gray-500 flex items-center gap-1"><DollarSign size={10} className="text-emerald-400" /> {voice.total_royalties_earned} earned</span>
                  </div>
                  <div className="flex items-center gap-2 mt-3">
                    {voice.preview_url && (
                      <button onClick={() => handleVoicePreview(voice.preview_url!, voice.id)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-purple-500/10 border border-purple-500/20 rounded-lg text-[11px] text-purple-300 hover:bg-purple-500/20 transition-colors">
                        {voicePreviewId === voice.id ? <Pause size={11} /> : <Play size={11} />} Preview
                      </button>
                    )}
                    <button onClick={() => { navigator.clipboard.writeText(voice.voice_id); alert('Voice ID copied! Use it in Create → 444 Radio → Voice Ref tab.') }}
                      className="flex items-center gap-1 px-3 py-1.5 bg-cyan-500/10 border border-cyan-500/20 rounded-lg text-[11px] text-cyan-300 hover:bg-cyan-500/20 transition-colors">
                      Use Voice
                    </button>
                    {user?.id === voice.clerk_user_id && (
                      <button onClick={() => handleUnlistVoice(voice.id)} className="ml-auto p-1.5 hover:bg-red-500/20 rounded-lg transition-colors" title="Unlist">
                        <Trash2 size={12} className="text-gray-500 hover:text-red-400" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 bg-white/[0.03] border border-white/[0.06] rounded-2xl flex items-center justify-center mb-4 backdrop-blur-xl">
                <AudioLines size={28} className="text-gray-600" />
              </div>
              <h3 className="text-base font-semibold text-gray-300 mb-1">No Voice IDs listed yet</h3>
              <p className="text-gray-600 text-xs max-w-sm mb-4">Train your voice and list it to earn credits every time someone uses it.</p>
              {isSignedIn && (
                <button onClick={() => router.push('/voice-training')}
                  className="flex items-center gap-1.5 px-5 py-2 bg-gradient-to-r from-purple-600/80 to-pink-600/80 text-white text-xs font-semibold rounded-xl">
                  <Sparkles size={14} /> Train Your Voice
                </button>
              )}
            </div>
          )}
        </div>
        )}
      </main>

      {/* Modals */}
      {selectedArtist && <ArtistProfileModal artist={selectedArtist} onClose={() => setSelectedArtist(null)} />}
      {downloadTrack && (
        <DownloadModal track={downloadTrack} userCredits={credits || 0}
          onClose={() => setDownloadTrack(null)} onConfirm={(splitStems: boolean) => handlePurchase(downloadTrack.id, splitStems)} />
      )}
      {successData && <SuccessModal track={successData.track} splitJobId={successData.splitJobId} stemStatus={successData.stemStatus} onClose={() => setSuccessData(null)} />}
      {showListModal && <ListTrackModal onClose={() => setShowListModal(false)} onListed={handleTrackListed} />}
      {infoTrack && (
        <TrackInfoModal
          track={{ ...infoTrack, imageUrl: infoTrack.image_url, audioUrl: infoTrack.audio_url, username: infoTrack.username }}
          onClose={() => setInfoTrack(null)}
          onPlay={() => { handlePlay(infoTrack); setInfoTrack(null) }}
        />
      )}
    </div>
  )
}

function GlassCard({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return (
    <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 py-2.5 backdrop-blur-xl">
      <div className="flex items-center gap-2">
        {icon}
        <div>
          <p className="text-sm font-bold text-white leading-none">{value}</p>
          <p className="text-[9px] text-gray-500 mt-0.5">{label}</p>
        </div>
      </div>
    </div>
  )
}
