'use client'

import { useState, useEffect, useMemo, useCallback, lazy, Suspense } from 'react'
import { useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import {
  Play, Pause, Download, Search, TrendingUp, Clock, Music2,
  X, Sparkles, DollarSign, ChevronDown, Users, Zap, ArrowLeft,
  ShoppingCart, ArrowUpRight, ArrowDownLeft
} from 'lucide-react'
import { useAudioPlayer } from '../contexts/AudioPlayerContext'
import LikeButton from '../components/LikeButton'
import FloatingMenu from '../components/FloatingMenu'
import FloatingNavButton from '../components/FloatingNavButton'
import CreditIndicator from '../components/CreditIndicator'
import ArtistProfileModal from './components/ArtistProfileModal'
import DownloadModal from './components/DownloadModal'
import SuccessModal from './components/SuccessModal'
import ListTrackModal from './components/ListTrackModal'
import TrackCard from './components/TrackCard'

const HolographicBackgroundClient = lazy(() => import('../components/HolographicBackgroundClient'))

// Types
interface EarnTrack {
  id: string; title: string; audio_url: string; image_url: string; user_id: string
  username: string; avatar_url?: string; genre?: string; plays: number; likes: number
  downloads: number; created_at: string; listed_on_earn: boolean; earn_price: number
  artist_share: number; admin_share: number
}
interface ArtistInfo {
  user_id: string; username: string; avatar_url?: string; bio?: string
  trackCount: number; totalDownloads: number; totalPlays: number
}
interface Transaction {
  id: string; buyer_username?: string; seller_username?: string; buyer_id?: string
  seller_id?: string; track_title: string; track_id: string; credits_earned?: number
  credits_spent?: number; total_cost?: number; split_stems?: boolean; type?: string
  created_at: string
}
type FilterType = 'trending' | 'most_downloaded' | 'latest'
type PageView = 'marketplace' | 'wallet'

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  const dy = Math.floor(h / 24)
  if (dy < 30) return `${dy}d`
  return `${Math.floor(dy / 30)}mo`
}

export default function EarnPage() {
  const { user, isSignedIn } = useUser()
  const router = useRouter()
  const { currentTrack, isPlaying, togglePlayPause, setPlaylist } = useAudioPlayer()

  const [pageView, setPageView] = useState<PageView>('marketplace')
  const [tracks, setTracks] = useState<EarnTrack[]>([])
  const [loading, setLoading] = useState(true)
  const [credits, setCredits] = useState(0)
  const [subscriptionStatus, setSubscriptionStatus] = useState<string>('none')
  const isSubscribed = subscriptionStatus === 'active' || subscriptionStatus === 'trialing'
  const [filter, setFilter] = useState<FilterType>('trending')
  const [selectedGenre, setSelectedGenre] = useState('All')
  const [searchQuery, setSearchQuery] = useState('')
  const [genres, setGenres] = useState<string[]>(['All'])

  // Wallet
  const [sales, setSales] = useState<Transaction[]>([])
  const [purchases, setPurchases] = useState<Transaction[]>([])
  const [totalEarned, setTotalEarned] = useState(0)
  const [totalSpent, setTotalSpent] = useState(0)
  const [loadingWallet, setLoadingWallet] = useState(false)

  // Modals
  const [selectedArtist, setSelectedArtist] = useState<ArtistInfo | null>(null)
  const [downloadTrack, setDownloadTrack] = useState<EarnTrack | null>(null)
  const [successData, setSuccessData] = useState<{ track: EarnTrack; splitJobId?: string } | null>(null)
  const [showListModal, setShowListModal] = useState(false)

  const fetchTracks = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ filter, genre: selectedGenre === 'All' ? '' : selectedGenre, q: searchQuery })
      const res = await fetch(`/api/earn/tracks?${params}`)
      const data = await res.json()
      if (data.success) {
        setTracks(data.tracks || [])
        if (data.genres?.length) setGenres(['All', ...data.genres])
      }
    } catch (err) { console.error('Failed to fetch earn tracks:', err) }
    finally { setLoading(false) }
  }, [filter, selectedGenre, searchQuery])

  const fetchCredits = useCallback(async () => {
    try {
      const res = await fetch('/api/credits')
      const data = await res.json()
      setCredits(data.credits || 0)
      setSubscriptionStatus(data.subscription_status || 'none')
    } catch { setCredits(0) }
  }, [])

  const fetchTransactions = useCallback(async () => {
    setLoadingWallet(true)
    try {
      const res = await fetch('/api/earn/transactions')
      const data = await res.json()
      if (data.success) {
        setSales(data.sales || [])
        setPurchases(data.purchases || [])
        setTotalEarned(data.totalEarned || 0)
        setTotalSpent(data.totalSpent || 0)
      }
    } catch (err) { console.error('Failed to fetch transactions:', err) }
    finally { setLoadingWallet(false) }
  }, [])

  useEffect(() => { fetchTracks() }, [fetchTracks])
  useEffect(() => { if (isSignedIn) fetchCredits() }, [isSignedIn, fetchCredits])
  useEffect(() => { if (isSignedIn && pageView === 'wallet') fetchTransactions() }, [isSignedIn, pageView, fetchTransactions])

  const handlePlay = useCallback((track: EarnTrack) => {
    const toAudioTrack = (t: EarnTrack) => ({
      id: t.id, audioUrl: t.audio_url, title: t.title, artist: t.username, imageUrl: t.image_url, userId: t.user_id
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
      setCredits(prev => prev - (5 + (splitStems ? 5 : 0)))
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
      if (track) { setDownloadTrack(null); setSuccessData({ track, splitJobId: data.splitJobId }) }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Purchase failed'
      alert(message)
      fetchCredits()
    }
  }

  const handleOpenArtist = useCallback(async (userId: string) => {
    try {
      const res = await fetch(`/api/earn/artist/${userId}`)
      const data = await res.json()
      if (data.success) setSelectedArtist(data.artist)
    } catch { console.error('Failed to load artist') }
  }, [])

  const handleTrackListed = () => { setShowListModal(false); fetchTracks(); fetchCredits() }

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
    if (!searchQuery.trim()) return tracks
    const q = searchQuery.toLowerCase()
    return tracks.filter(t => t.title.toLowerCase().includes(q) || t.username?.toLowerCase().includes(q) || t.genre?.toLowerCase().includes(q))
  }, [tracks, searchQuery])

  const totalDownloads = useMemo(() => tracks.reduce((s, t) => s + (t.downloads || 0), 0), [tracks])
  const totalArtists = useMemo(() => new Set(tracks.map(t => t.user_id)).size, [tracks])

  return (
    <div className="min-h-screen bg-[#030305] text-white">
      {/* 3D Holographic Background */}
      <div className="fixed inset-0 -z-10">
        <Suspense fallback={<div className="w-full h-full bg-gradient-to-b from-gray-950 via-gray-900 to-black" />}>
          <HolographicBackgroundClient />
        </Suspense>
      </div>
      <div className="fixed inset-0 bg-black/40 backdrop-blur-[1px] -z-[5] pointer-events-none" />

      <div className="md:hidden"><CreditIndicator /></div>
      <FloatingMenu />

      <main className="relative z-10 md:pl-[72px] pb-32">
        {/* Header */}
        <div className="px-4 md:px-8 pt-6 pb-4">
          <div className="flex items-center gap-3 mb-4">
            <button onClick={() => router.push('/create')} className="p-2 rounded-xl bg-white/[0.04] border border-white/[0.06] backdrop-blur-xl hover:bg-white/[0.08] transition">
              <ArrowLeft size={18} className="text-gray-400" />
            </button>
            <div>
              <h1 className="text-xl md:text-2xl font-bold tracking-tight bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-400 bg-clip-text text-transparent">EARN</h1>
              <p className="text-[10px] text-gray-500">Community marketplace</p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.04] border border-emerald-500/20 rounded-xl backdrop-blur-xl">
                <Zap size={12} className="text-emerald-400" />
                <span className="text-xs font-semibold text-white">{credits}</span>
                <span className="text-[9px] text-gray-500">cr</span>
              </div>
              {isSignedIn && isSubscribed && (
                <button onClick={() => setShowListModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-emerald-600/80 to-cyan-600/80 border border-emerald-500/30 text-white text-xs font-semibold rounded-xl backdrop-blur-xl hover:from-emerald-500/80 hover:to-cyan-500/80 transition-all">
                  <Sparkles size={12} /> List Track
                </button>
              )}
              {isSignedIn && !isSubscribed && (
                <button onClick={() => router.push('/pricing')}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.04] border border-amber-500/20 text-amber-300 text-xs font-medium rounded-xl backdrop-blur-xl hover:bg-white/[0.08] transition">
                  <Sparkles size={12} /> Subscribe
                </button>
              )}
            </div>
          </div>

          {/* Marketplace / Wallet toggle */}
          <div className="flex items-center gap-1 bg-white/[0.03] border border-white/[0.06] rounded-xl p-1 backdrop-blur-xl w-fit mb-4">
            <button onClick={() => setPageView('marketplace')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-all ${pageView === 'marketplace' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'}`}>
              <ShoppingCart size={13} /> Marketplace
            </button>
            <button onClick={() => setPageView('wallet')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-all ${pageView === 'wallet' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'}`}>
              <DollarSign size={13} /> Wallet
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2 md:gap-3 mb-4">
            <GlassCard icon={<Music2 size={14} className="text-cyan-400" />} value={tracks.length} label="tracks" />
            <GlassCard icon={<Download size={14} className="text-emerald-400" />} value={totalDownloads} label="downloads" />
            <GlassCard icon={<Users size={14} className="text-purple-400" />} value={totalArtists} label="artists" />
          </div>
        </div>

        {/* ═══ MARKETPLACE ═══ */}
        {pageView === 'marketplace' && (
          <div className="px-4 md:px-8">
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <div className="flex gap-1 bg-white/[0.03] border border-white/[0.06] p-1 rounded-xl backdrop-blur-xl">
                {([
                  { key: 'trending' as FilterType, label: 'Trending', icon: TrendingUp },
                  { key: 'most_downloaded' as FilterType, label: 'Top', icon: Download },
                  { key: 'latest' as FilterType, label: 'New', icon: Clock },
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
                    onUnlist={handleUnlist} />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-16 h-16 bg-white/[0.03] border border-white/[0.06] rounded-2xl flex items-center justify-center mb-4 backdrop-blur-xl">
                  <Music2 size={28} className="text-gray-600" />
                </div>
                <h3 className="text-base font-semibold text-gray-300 mb-1">No tracks listed</h3>
                <p className="text-gray-600 text-xs max-w-sm mb-4">Be the first to list tracks and earn credits.</p>
                {isSignedIn && isSubscribed && (
                  <button onClick={() => setShowListModal(true)}
                    className="flex items-center gap-1.5 px-5 py-2 bg-gradient-to-r from-emerald-600/80 to-cyan-600/80 text-white text-xs font-semibold rounded-xl">
                    <Sparkles size={14} /> List Your First Track
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* ═══ WALLET ═══ */}
        {pageView === 'wallet' && (
          <div className="px-4 md:px-8">
            {!isSignedIn ? (
              <div className="text-center py-20">
                <DollarSign size={32} className="text-gray-700 mx-auto mb-3" />
                <h3 className="text-base font-semibold text-gray-300 mb-1">Sign in to view your wallet</h3>
                <p className="text-gray-600 text-xs">Track your sales and purchases</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3 mb-6">
                  <div className="bg-white/[0.03] border border-emerald-500/10 rounded-2xl p-4 backdrop-blur-xl">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-7 h-7 bg-emerald-500/10 rounded-lg flex items-center justify-center">
                        <ArrowDownLeft size={14} className="text-emerald-400" />
                      </div>
                      <span className="text-[10px] text-gray-500 uppercase tracking-wider">Earned</span>
                    </div>
                    <p className="text-2xl font-bold text-emerald-400">{totalEarned}</p>
                    <p className="text-[10px] text-gray-600 mt-0.5">{sales.length} sale{sales.length !== 1 ? 's' : ''}</p>
                  </div>
                  <div className="bg-white/[0.03] border border-cyan-500/10 rounded-2xl p-4 backdrop-blur-xl">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-7 h-7 bg-cyan-500/10 rounded-lg flex items-center justify-center">
                        <ArrowUpRight size={14} className="text-cyan-400" />
                      </div>
                      <span className="text-[10px] text-gray-500 uppercase tracking-wider">Spent</span>
                    </div>
                    <p className="text-2xl font-bold text-cyan-400">{totalSpent}</p>
                    <p className="text-[10px] text-gray-600 mt-0.5">{purchases.length} purchase{purchases.length !== 1 ? 's' : ''}</p>
                  </div>
                </div>

                {loadingWallet ? (
                  <div className="flex items-center justify-center py-16">
                    <div className="w-5 h-5 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" />
                  </div>
                ) : (
                  <div className="space-y-6">
                    {sales.length > 0 && (
                      <div>
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                          <ArrowDownLeft size={12} className="text-emerald-400" /> Your Sales
                        </h3>
                        <div className="space-y-1.5">
                          {sales.map(tx => (
                            <div key={tx.id} className="flex items-center gap-3 px-3 py-2.5 bg-white/[0.02] border border-white/[0.04] rounded-xl backdrop-blur-xl hover:bg-white/[0.04] transition">
                              <div className="w-8 h-8 bg-emerald-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
                                <ArrowDownLeft size={14} className="text-emerald-400" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-white truncate">{tx.track_title}</p>
                                <p className="text-[10px] text-gray-500">Bought by <span className="text-cyan-400">@{tx.buyer_username}</span> &middot; {timeAgo(tx.created_at)}</p>
                              </div>
                              <span className="text-xs font-semibold text-emerald-400 flex-shrink-0">+{tx.credits_earned} cr</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {purchases.length > 0 && (
                      <div>
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                          <ArrowUpRight size={12} className="text-cyan-400" /> Your Purchases
                        </h3>
                        <div className="space-y-1.5">
                          {purchases.map(tx => (
                            <div key={tx.id} className="flex items-center gap-3 px-3 py-2.5 bg-white/[0.02] border border-white/[0.04] rounded-xl backdrop-blur-xl hover:bg-white/[0.04] transition">
                              <div className="w-8 h-8 bg-cyan-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
                                <Download size={14} className="text-cyan-400" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-white truncate">{tx.track_title}</p>
                                <p className="text-[10px] text-gray-500">From <span className="text-emerald-400">@{tx.seller_username}</span> &middot; {timeAgo(tx.created_at)}
                                  {tx.type === 'listing' && <span className="ml-1 text-amber-400/60">(listing fee)</span>}
                                </p>
                              </div>
                              <span className="text-xs font-semibold text-red-400/70 flex-shrink-0">-{tx.credits_spent} cr</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {sales.length === 0 && purchases.length === 0 && (
                      <div className="text-center py-16">
                        <DollarSign size={24} className="text-gray-700 mx-auto mb-3" />
                        <h3 className="text-sm font-semibold text-gray-400 mb-1">No transactions yet</h3>
                        <p className="text-gray-600 text-[10px]">Buy or sell tracks to see your history here</p>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </main>

      <FloatingNavButton showPromptToggle={false} />

      {selectedArtist && <ArtistProfileModal artist={selectedArtist} onClose={() => setSelectedArtist(null)} />}
      {downloadTrack && (
        <DownloadModal track={downloadTrack} userCredits={credits} subscriptionStatus={subscriptionStatus}
          onClose={() => setDownloadTrack(null)} onConfirm={(splitStems: boolean) => handlePurchase(downloadTrack.id, splitStems)} />
      )}
      {successData && <SuccessModal track={successData.track} splitJobId={successData.splitJobId} onClose={() => setSuccessData(null)} />}
      {showListModal && <ListTrackModal onClose={() => setShowListModal(false)} onListed={handleTrackListed} />}
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
