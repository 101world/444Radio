'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useUser } from '@clerk/nextjs'
import { useAudioPlayer } from '@/app/contexts/AudioPlayerContext'
import Link from 'next/link'
import {
  Bell,
  Music,
  Image,
  Video,
  Sparkles,
  Scissors,
  Volume2,
  ShoppingCart,
  Tag,
  Send,
  Gift,
  RefreshCw,
  Zap,
  Filter,
  X,
  Wallet,
  Info,
} from 'lucide-react'

interface Transaction {
  id: string
  type: string
  amount: number
  description: string | null
  status: string
  balance_after: number | null
  created_at: string
  metadata?: Record<string, any>
}

const txTypeLabel = (type: string) => {
  const map: Record<string, string> = {
    generation_music: 'Music Generation',
    generation_effects: 'Sound Effects',
    generation_loops: 'Loop Generation',
    generation_image: 'Image Generation',
    generation_video_to_audio: 'Video-to-Audio',
    generation_cover_art: 'Cover Art',
    generation_stem_split: 'Stem Split',
    generation_audio_boost: 'Audio Boost',
    generation_autotune: 'Autotune',
    generation_video: '444 Visualizer',
    generation_extract: 'Audio Extract',
    earn_list: 'Earn Listing',
    earn_purchase: 'Earn Purchase',
    earn_sale: 'Earn Sale',
    earn_admin: 'Platform Fee',
    release: 'Release',
    credit_award: 'Credit Award',
    credit_refund: 'Refund',
    subscription_bonus: 'Subscription Bonus',
    quest_reward: 'Quest Reward',
    quest_entry: 'Quest Pass',
    wallet_deposit: 'Wallet Deposit',
    wallet_conversion: 'Wallet Conversion',
    code_claim: 'Code Claim',
    other: 'Other',
  }
  return map[type] || type
}

const txTypeIcon = (type: string) => {
  if (type.startsWith('generation_music') || type === 'generation_loops') return <Music className="w-3.5 h-3.5" />
  if (type === 'generation_image' || type === 'generation_cover_art') return <Image className="w-3.5 h-3.5" />
  if (type === 'generation_video_to_audio') return <Video className="w-3.5 h-3.5" />
  if (type === 'generation_effects') return <Sparkles className="w-3.5 h-3.5" />
  if (type === 'generation_stem_split') return <Scissors className="w-3.5 h-3.5" />
  if (type === 'generation_audio_boost' || type === 'generation_autotune') return <Volume2 className="w-3.5 h-3.5" />
  if (type === 'generation_video') return <Video className="w-3.5 h-3.5" />
  if (type === 'generation_extract') return <Scissors className="w-3.5 h-3.5" />
  if (type === 'earn_purchase') return <ShoppingCart className="w-3.5 h-3.5" />
  if (type === 'earn_sale' || type === 'earn_list') return <Tag className="w-3.5 h-3.5" />
  if (type === 'release') return <Send className="w-3.5 h-3.5" />
  if (type === 'credit_award' || type === 'subscription_bonus' || type === 'quest_reward') return <Gift className="w-3.5 h-3.5" />
  if (type === 'quest_entry') return <Zap className="w-3.5 h-3.5" />
  if (type === 'credit_refund') return <RefreshCw className="w-3.5 h-3.5" />
  if (type === 'wallet_deposit' || type === 'wallet_conversion') return <Wallet className="w-3.5 h-3.5" />
  if (type === 'code_claim') return <Gift className="w-3.5 h-3.5" />
  return <Zap className="w-3.5 h-3.5" />
}

const quickFilters = [
  { value: '', label: 'All' },
  { value: 'generation_music', label: 'Music' },
  { value: 'earn_sale', label: 'Sales' },
  { value: 'earn_purchase', label: 'Purchases' },
  { value: 'release', label: 'Releases' },
  { value: 'awards', label: 'Awards' },
]

function timeAgo(dateStr: string) {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const seconds = Math.floor((now - then) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function NotificationBell() {
  const { user } = useUser()
  const { currentTrack } = useAudioPlayer()
  const [isOpen, setIsOpen] = useState(false)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [filter, setFilter] = useState('')
  const [expandedTx, setExpandedTx] = useState<string | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const bellRef = useRef<HTMLButtonElement>(null)

  const playerActive = !!currentTrack

  const fetchTransactions = useCallback(async (typeFilter = '') => {
    if (!user) return
    setIsLoading(true)
    try {
      const params = new URLSearchParams({ page: '1', limit: '20' })
      if (typeFilter) params.set('type', typeFilter)
      const res = await fetch(`/api/wallet/transactions?${params}`)
      const data = await res.json()
      if (data.transactions) {
        setTransactions(data.transactions)
        setTotal(data.pagination?.total ?? 0)
      }
    } catch (err) {
      console.error('Failed to fetch notifications:', err)
    } finally {
      setIsLoading(false)
    }
  }, [user])

  // Fetch on open
  useEffect(() => {
    if (isOpen && user) {
      fetchTransactions(filter)
    }
  }, [isOpen, user, filter, fetchTransactions])

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        bellRef.current &&
        !bellRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false)
        setExpandedTx(null)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // Close on Escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false)
        setExpandedTx(null)
      }
    }
    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      return () => document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen])

  if (!user) return null

  return (
    <div className="relative">
      {/* Bell Button */}
      <button
        ref={bellRef}
        onClick={() => setIsOpen(!isOpen)}
        className={`relative flex items-center justify-center rounded-full backdrop-blur-2xl border transition-all duration-300 ${
          playerActive ? 'w-9 h-9' : 'w-11 h-11'
        } ${
          isOpen
            ? 'bg-cyan-500/20 border-cyan-500/50 shadow-cyan-500/30 shadow-lg'
            : 'bg-black/60 border-white/10 hover:bg-black/70 hover:border-cyan-500/30'
        }`}
        title="Notifications"
      >
        <Bell className={`text-gray-300 ${isOpen ? 'text-cyan-400' : 'hover:text-white'} transition-colors`} size={playerActive ? 15 : 18} />
        {total > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 bg-cyan-500 rounded-full flex items-center justify-center">
            <span className="text-[9px] font-bold text-black leading-none">{total > 99 ? '99+' : total}</span>
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute top-full right-0 mt-2 w-[340px] sm:w-[380px] max-h-[70vh] bg-gray-950/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl shadow-black/60 overflow-hidden z-[100] flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 pt-4 pb-2">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-cyan-400" />
              <span className="text-sm font-bold text-white">Activity</span>
              <span className="text-[10px] text-gray-500 bg-white/5 px-2 py-0.5 rounded-full">{total}</span>
            </div>
            <button
              onClick={() => { setIsOpen(false); setExpandedTx(null) }}
              className="p-1 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Quick Filters */}
          <div className="flex items-center gap-1.5 px-4 pb-2 overflow-x-auto no-scrollbar">
            {quickFilters.map((f) => (
              <button
                key={f.value}
                onClick={() => { setFilter(f.value); setExpandedTx(null) }}
                className={`px-2.5 py-1 rounded-full text-[10px] font-medium whitespace-nowrap transition-colors flex-shrink-0 ${
                  filter === f.value
                    ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
                    : 'bg-white/5 text-gray-500 border border-white/5 hover:bg-white/10 hover:text-gray-300'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Divider */}
          <div className="h-px bg-white/5" />

          {/* Transaction List */}
          <div className="flex-1 overflow-y-auto overscroll-contain">
            {isLoading ? (
              <div className="p-8 flex items-center justify-center">
                <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-cyan-500" />
              </div>
            ) : transactions.length === 0 ? (
              <div className="p-8 text-center">
                <Wallet className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                <p className="text-xs text-gray-500">No activity yet</p>
              </div>
            ) : (
              <div className="divide-y divide-white/[0.03]">
                {transactions.map((tx) => (
                  <div key={tx.id}>
                    <div className="flex items-center gap-2.5 px-4 py-3 hover:bg-white/[0.02] transition-colors">
                      {/* Icon */}
                      <div className={`p-1.5 rounded-lg flex-shrink-0 ${
                        tx.type === 'release' ? 'bg-green-500/10 text-green-400' :
                        tx.amount > 0 ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                      }`}>
                        {txTypeIcon(tx.type)}
                      </div>

                      {/* Description */}
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-white/90 truncate">{tx.description || txTypeLabel(tx.type)}</p>
                        {tx.type === 'earn_sale' && tx.metadata?.buyerUsername && (
                          <p className="text-[10px] text-cyan-400/80 truncate">by @{tx.metadata.buyerUsername}</p>
                        )}
                        {tx.type === 'earn_purchase' && tx.metadata?.sellerUsername && (
                          <p className="text-[10px] text-purple-400/80 truncate">from @{tx.metadata.sellerUsername}</p>
                        )}
                        {tx.type === 'release' && tx.metadata?.trackId444 && (
                          <p className="text-[10px] text-cyan-400/80 truncate font-mono">{tx.metadata.trackId444}</p>
                        )}
                        <p className="text-[10px] text-gray-600">{timeAgo(tx.created_at)}</p>
                      </div>

                      {/* Release info button */}
                      {tx.type === 'release' && tx.metadata && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setExpandedTx(expandedTx === tx.id ? null : tx.id) }}
                          className={`p-1 rounded-md flex-shrink-0 transition-colors ${
                            expandedTx === tx.id ? 'bg-cyan-500/20 text-cyan-400' : 'bg-white/5 text-gray-500 hover:bg-white/10 hover:text-white'
                          }`}
                        >
                          <Info className="w-3 h-3" />
                        </button>
                      )}

                      {/* Amount */}
                      <div className="flex-shrink-0">
                        <span className={`text-xs font-bold ${
                          tx.type === 'release' ? 'text-green-400' :
                          tx.amount > 0 ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {tx.type === 'release' ? '✓' : (tx.amount > 0 ? '+' : '') + tx.amount}
                        </span>
                      </div>
                    </div>

                    {/* Expanded release metadata */}
                    {tx.type === 'release' && expandedTx === tx.id && tx.metadata && (
                      <div className="px-4 pb-3 -mt-1">
                        <div className="ml-8 p-2.5 bg-white/[0.03] border border-white/[0.05] rounded-xl space-y-1">
                          {tx.metadata.trackId444 && (
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] text-gray-500 w-16">Track ID</span>
                              <span className="text-[10px] text-cyan-400 font-mono">{tx.metadata.trackId444}</span>
                            </div>
                          )}
                          {tx.metadata.genre && (
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] text-gray-500 w-16">Genre</span>
                              <span className="text-[10px] text-gray-300">{tx.metadata.genre}</span>
                            </div>
                          )}
                          {tx.metadata.artist_name && (
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] text-gray-500 w-16">Artist</span>
                              <span className="text-[10px] text-gray-300">{tx.metadata.artist_name}</span>
                            </div>
                          )}
                          {tx.metadata.featured_artists?.length > 0 && (
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] text-gray-500 w-16">Featured</span>
                              <span className="text-[10px] text-purple-400">{tx.metadata.featured_artists.join(', ')}</span>
                            </div>
                          )}
                          {tx.metadata.contributors?.length > 0 && (
                            <div className="flex items-start gap-2">
                              <span className="text-[9px] text-gray-500 w-16 mt-0.5">Credits</span>
                              <div className="space-y-0.5">
                                {tx.metadata.contributors.map((c: any, i: number) => (
                                  <span key={i} className="text-[10px] text-gray-400 block">{c.name} ({c.role})</span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="h-px bg-white/5" />
          <div className="p-3 text-center">
            <Link
              href="/settings?tab=wallet"
              onClick={() => setIsOpen(false)}
              className="text-[11px] text-cyan-400 hover:text-cyan-300 font-medium transition-colors"
            >
              View All Activity →
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
