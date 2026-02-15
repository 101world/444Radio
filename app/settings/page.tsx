'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useUser } from '@clerk/nextjs'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, User, AlertCircle, CheckCircle, XCircle, Zap, Wallet, ChevronLeft, ChevronRight, Music, Image, Video, Repeat, Sparkles, ShoppingCart, Tag, Gift, RefreshCw, Filter, Scissors, Volume2, Send, Info, Plug, Copy, Trash2, Key, Download, X, Monitor, FolderOpen, DollarSign, AlertTriangle, ArrowRightLeft } from 'lucide-react'
import Link from 'next/link'
import Script from 'next/script'
import ProfileSettingsModal from '../components/ProfileSettingsModal'
import { useCredits } from '../contexts/CreditsContext'

export default function SettingsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-black flex items-center justify-center md:pl-20 md:pr-28">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-500"></div>
      </div>
    }>
      <SettingsPageInner />
    </Suspense>
  )
}

function SettingsPageInner() {
  const { user, isLoaded } = useUser()
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialTab = (['profile', 'credits', 'wallet', 'plugin'].includes(searchParams.get('tab') || '') ? searchParams.get('tab') : 'credits') as 'profile' | 'credits' | 'wallet' | 'plugin'
  const [activeTab, setActiveTab] = useState<'profile' | 'credits' | 'wallet' | 'plugin'>(initialTab)
  const { credits, walletBalance, isLoading: isLoadingCredits, refreshCredits } = useCredits()
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [customAvatarUrl, setCustomAvatarUrl] = useState<string | null>(null)
  const [isConverting, setIsConverting] = useState(false)
  const [convertMessage, setConvertMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Wallet state
  const [transactions, setTransactions] = useState<any[]>([])
  const [walletPage, setWalletPage] = useState(1)
  const [walletTotal, setWalletTotal] = useState(0)
  const [walletTotalPages, setWalletTotalPages] = useState(0)
  const [isLoadingWallet, setIsLoadingWallet] = useState(false)
  const [walletFilter, setWalletFilter] = useState('')
  const [walletCredits, setWalletCredits] = useState(0)
  const [expandedTx, setExpandedTx] = useState<string | null>(null)

  // Plugin token state
  const [pluginTokens, setPluginTokens] = useState<any[]>([])
  const [isLoadingTokens, setIsLoadingTokens] = useState(false)
  const [newToken, setNewToken] = useState<string | null>(null)
  const [tokenName, setTokenName] = useState('Ableton Plugin')
  const [isCreatingToken, setIsCreatingToken] = useState(false)
  const [copiedToken, setCopiedToken] = useState(false)
  const [pluginError, setPluginError] = useState('')
  const [showInstallGuide, setShowInstallGuide] = useState(false)
  const [hasPluginPurchase, setHasPluginPurchase] = useState(false)
  const [isCheckingPurchase, setIsCheckingPurchase] = useState(false)
  const [buyingPlugin, setBuyingPlugin] = useState(false)

  useEffect(() => {
    if (!isLoaded) return
    if (!user) {
      router.push('/sign-in')
    }
  }, [user, isLoaded, router])

  useEffect(() => {
    if (user) {
      fetch(`/api/media/profile/${user.id}`)
        .then(res => res.json())
        .then(data => {
          if (data.success && data.avatar_url) {
            setCustomAvatarUrl(data.avatar_url)
          }
        })
        .catch(() => {})
    }
  }, [user])

  const fetchWalletTransactions = useCallback(async (page = 1, filter = '') => {
    try {
      setIsLoadingWallet(true)
      const params = new URLSearchParams({ page: String(page), limit: '15' })
      if (filter) params.set('type', filter)
      const res = await fetch(`/api/wallet/transactions?${params}`)
      const data = await res.json()
      if (data.transactions) {
        setTransactions(data.transactions)
        setWalletPage(data.pagination.page)
        setWalletTotal(data.pagination.total)
        setWalletTotalPages(data.pagination.totalPages)
        setWalletCredits(data.credits ?? 0)
      }
    } catch (err) {
      console.error('Failed to fetch wallet:', err)
    } finally {
      setIsLoadingWallet(false)
    }
  }, [])

  useEffect(() => {
    if (activeTab === 'wallet' && user) {
      fetchWalletTransactions(walletPage, walletFilter)
    }
  }, [activeTab, user, walletPage, walletFilter, fetchWalletTransactions])

  const fetchPluginTokens = useCallback(async () => {
    try {
      setIsLoadingTokens(true)
      const res = await fetch('/api/plugin/token')
      const data = await res.json()
      if (data.tokens) setPluginTokens(data.tokens)
    } catch {
      console.error('Failed to fetch plugin tokens')
    } finally {
      setIsLoadingTokens(false)
    }
  }, [])

  const checkPluginPurchase = useCallback(async () => {
    try {
      setIsCheckingPurchase(true)
      const res = await fetch('/api/plugin/purchase/status')
      const data = await res.json()
      if (data.purchased) setHasPluginPurchase(true)
    } catch {
      // Ignore
    } finally {
      setIsCheckingPurchase(false)
    }
  }, [])

  useEffect(() => {
    if (activeTab === 'plugin' && user) {
      fetchPluginTokens()
      checkPluginPurchase()
    }
  }, [activeTab, user, fetchPluginTokens, checkPluginPurchase])

  const createPluginToken = async () => {
    try {
      setIsCreatingToken(true)
      setPluginError('')
      setNewToken(null)
      const res = await fetch('/api/plugin/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: tokenName || 'Ableton Plugin' }),
      })
      const data = await res.json()
      if (data.success) {
        setNewToken(data.token)
        fetchPluginTokens()
      } else {
        setPluginError(data.error || 'Failed to create token')
      }
    } catch {
      setPluginError('Network error')
    } finally {
      setIsCreatingToken(false)
    }
  }

  const revokePluginToken = async (tokenId: string) => {
    try {
      setPluginError('')
      const res = await fetch('/api/plugin/token', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokenId }),
      })
      const data = await res.json()
      if (data.success) {
        fetchPluginTokens()
      } else {
        setPluginError(data.error || 'Failed to revoke token')
      }
    } catch {
      setPluginError('Network error')
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedToken(true)
    setTimeout(() => setCopiedToken(false), 2000)
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
      generation_extract: 'Extract Audio',
      earn_list: 'Earn Listing',
      earn_purchase: 'Earn Purchase',
      earn_sale: 'Earn Sale',
      earn_admin: 'Platform Fee',
      release: 'Release',
      credit_award: 'Credit Award',
      credit_refund: 'Refund',
      other: 'Other',
    }
    return map[type] || type
  }

  const txTypeIcon = (type: string) => {
    if (type.startsWith('generation_music') || type === 'generation_loops') return <Music className="w-4 h-4" />
    if (type === 'generation_image' || type === 'generation_cover_art') return <Image className="w-4 h-4" />
    if (type === 'generation_video_to_audio') return <Video className="w-4 h-4" />
    if (type === 'generation_effects') return <Sparkles className="w-4 h-4" />
    if (type === 'generation_stem_split') return <Scissors className="w-4 h-4" />
    if (type === 'generation_audio_boost') return <Volume2 className="w-4 h-4" />
    if (type === 'generation_extract') return <Scissors className="w-4 h-4" />
    if (type === 'earn_purchase') return <ShoppingCart className="w-4 h-4" />
    if (type === 'earn_sale' || type === 'earn_list') return <Tag className="w-4 h-4" />
    if (type === 'release') return <Send className="w-4 h-4" />
    if (type === 'credit_award') return <Gift className="w-4 h-4" />
    if (type === 'credit_refund') return <RefreshCw className="w-4 h-4" />
    return <Zap className="w-4 h-4" />
  }

  const txFilterOptions = [
    { value: '', label: 'All' },
    { value: 'generation_music', label: 'Music' },
    { value: 'generation_effects', label: 'Effects' },
    { value: 'generation_loops', label: 'Loops' },
    { value: 'generation_image', label: 'Images' },
    { value: 'generation_cover_art', label: 'Cover Art' },
    { value: 'generation_video_to_audio', label: 'Video' },
    { value: 'generation_stem_split', label: 'Stems' },
    { value: 'generation_audio_boost', label: 'Audio Boost' },
    { value: 'generation_extract', label: 'Extract' },
    { value: 'earn_purchase', label: 'Purchases' },
    { value: 'earn_sale', label: 'Sales' },
    { value: 'earn_list', label: 'Listings' },
    { value: 'release', label: 'Releases' },
    { value: 'awards', label: 'Awards' },
    { value: 'credit_refund', label: 'Refunds' },
  ]

  if (!isLoaded || !user) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center md:pl-20 md:pr-28">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-500"></div>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-black text-white relative overflow-hidden md:pl-20 md:pr-28">
      <div className="absolute inset-0 bg-gradient-to-br from-cyan-950/20 via-black to-black pointer-events-none"></div>

      <div className="max-w-5xl mx-auto relative z-10 px-6 py-12">
        <Link
          href="/explore"
          className="group flex items-center gap-2 text-cyan-400/60 hover:text-cyan-400 transition-colors duration-300 mb-8"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm font-medium">Back to Explore</span>
        </Link>

        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-cyan-400 via-white to-cyan-300 bg-clip-text text-transparent">
            Settings
          </h1>
          <p className="text-cyan-400/60">Manage your account and credits</p>
        </div>

        <div className="flex gap-4 mb-8 border-b border-white/10 overflow-x-auto">
          <button
            onClick={() => setActiveTab('credits')}
            className={`pb-4 px-2 font-medium transition-colors relative whitespace-nowrap ${
              activeTab === 'credits' ? 'text-cyan-400' : 'text-gray-400 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5" />
              <span>Credits</span>
            </div>
            {activeTab === 'credits' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-400"></div>
            )}
          </button>
          <button
            onClick={() => setActiveTab('wallet')}
            className={`pb-4 px-2 font-medium transition-colors relative whitespace-nowrap ${
              activeTab === 'wallet' ? 'text-cyan-400' : 'text-gray-400 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2">
              <Wallet className="w-5 h-5" />
              <span>Wallet &amp; Billing</span>
            </div>
            {activeTab === 'wallet' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-400"></div>
            )}
          </button>
          <button
            onClick={() => setActiveTab('profile')}
            className={`pb-4 px-2 font-medium transition-colors relative whitespace-nowrap ${
              activeTab === 'profile' ? 'text-cyan-400' : 'text-gray-400 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2">
              <User className="w-5 h-5" />
              <span>Profile</span>
            </div>
            {activeTab === 'profile' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-400"></div>
            )}
          </button>
          <button
            onClick={() => setActiveTab('plugin')}
            className={`pb-4 px-2 font-medium transition-colors relative whitespace-nowrap ${
              activeTab === 'plugin' ? 'text-cyan-400' : 'text-gray-400 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2">
              <Plug className="w-5 h-5" />
              <span>Plugin</span>
            </div>
            {activeTab === 'plugin' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-400"></div>
            )}
          </button>
        </div>

        {/* Credits Tab */}
        {activeTab === 'credits' ? (
          <div className="space-y-6">
            {/* Wallet Balance Card */}
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8">
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 bg-opacity-20">
                    <DollarSign className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">Wallet &amp; Credits</h2>
                    <p className="text-sm text-gray-400">$1 access fee &middot; pay-per-use</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div className="flex items-start gap-3">
                  <DollarSign className="w-5 h-5 text-green-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-400">Wallet Balance</p>
                    <p className="text-3xl font-bold">
                      {isLoadingCredits ? (
                        <span className="text-gray-500">...</span>
                      ) : (
                        <span className="text-green-400">${(walletBalance ?? 0).toFixed(2)}</span>
                      )}
                    </p>
                    {(walletBalance ?? 0) < 1 && (
                      <p className="text-xs text-amber-400 mt-1 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> Min $1.00 required
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Zap className="w-5 h-5 text-cyan-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-400">Available Credits</p>
                    <p className="text-3xl font-bold">
                      {isLoadingCredits ? (
                        <span className="text-gray-500">...</span>
                      ) : (
                        <span className="text-cyan-400">{credits || 0}</span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Info className="w-5 h-5 text-cyan-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-400">Credit Rate</p>
                    <p className="text-sm text-gray-300">1 credit = $0.035</p>
                    <p className="text-xs text-gray-500 mt-1">Credits never expire</p>
                  </div>
                </div>
              </div>

              {/* Convert wallet to credits */}
              {(walletBalance ?? 0) > 1 && (
                <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ArrowRightLeft className="w-4 h-4 text-purple-400" />
                      <div>
                        <p className="text-sm font-medium">Convertible: ${((walletBalance ?? 0) - 1).toFixed(2)}</p>
                        <p className="text-xs text-gray-500">~{Math.floor(((walletBalance ?? 0) - 1) / 0.035)} credits ($1 stays as access fee)</p>
                      </div>
                    </div>
                    <button
                      onClick={async () => {
                        setIsConverting(true)
                        setConvertMessage(null)
                        try {
                          const res = await fetch('/api/wallet/convert', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({}),
                          })
                          const data = await res.json()
                          if (data.success) {
                            setConvertMessage({ type: 'success', text: `+${data.creditsAdded} credits added! Wallet: $${data.walletBalance.toFixed(2)}` })
                            refreshCredits()
                            window.dispatchEvent(new Event('credits:refresh'))
                          } else {
                            setConvertMessage({ type: 'error', text: data.error || 'Conversion failed' })
                          }
                        } catch {
                          setConvertMessage({ type: 'error', text: 'Network error' })
                        } finally {
                          setIsConverting(false)
                        }
                      }}
                      disabled={isConverting}
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                    >
                      {isConverting ? <RefreshCw className="w-3 h-3 animate-spin" /> : <ArrowRightLeft className="w-3 h-3" />}
                      Convert All
                    </button>
                  </div>
                  {convertMessage && (
                    <div className={`mt-3 text-xs flex items-center gap-1 ${convertMessage.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                      {convertMessage.type === 'success' ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                      {convertMessage.text}
                    </div>
                  )}
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-4">
                <Link
                  href="/pricing"
                  className="px-8 py-3 bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 rounded-lg font-semibold transition-all text-center text-black"
                >
                  + Add Money
                </Link>
                <button
                  onClick={() => setActiveTab('wallet')}
                  className="px-6 py-3 bg-white/10 hover:bg-white/15 border border-white/10 text-white rounded-lg font-medium transition-colors text-center"
                >
                  View Transaction History
                </button>
              </div>
            </div>

            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
              <h3 className="text-sm font-semibold text-gray-400 mb-4">Generation Costs</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { name: 'Song', cost: 2 },
                  { name: 'Cover Art', cost: 1 },
                  { name: 'Sound Effect', cost: 2 },
                  { name: 'Stem Split', cost: 5 },
                  { name: 'Loops', cost: 7 },
                  { name: 'Audio Boost', cost: 1 },
                  { name: 'Extract', cost: 1 },
                  { name: 'Video to Audio', cost: 2 },
                ].map((item) => (
                  <div key={item.name} className="flex items-center justify-between px-3 py-2 bg-white/5 rounded-lg">
                    <span className="text-xs text-gray-400">{item.name}</span>
                    <span className="text-xs font-bold text-cyan-400">{item.cost} cr</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

        ) : activeTab === 'wallet' ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-3">
                <Wallet className="w-6 h-6 text-cyan-400" />
                <div>
                  <h2 className="text-lg font-bold text-white">Wallet &amp; Transactions</h2>
                  <p className="text-xs text-gray-500">All transactions, generations, purchases, releases &amp; sales</p>
                </div>
              </div>
              <Link
                href="/pricing"
                className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-teal-500 text-black rounded-lg text-sm font-semibold hover:from-cyan-400 hover:to-teal-400 transition-all"
              >
                + Add Money
              </Link>
            </div>

            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-xl bg-gradient-to-br from-cyan-500 to-teal-500 bg-opacity-20">
                    <Wallet className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Credit Balance</p>
                    <p className="text-3xl font-bold">{isLoadingWallet ? '...' : walletCredits}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-400">Total Transactions</p>
                  <p className="text-lg font-semibold text-cyan-400">{walletTotal}</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
              <Filter className="w-4 h-4 text-gray-400 flex-shrink-0" />
              {txFilterOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => { setWalletFilter(opt.value); setWalletPage(1) }}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors flex-shrink-0 ${
                    walletFilter === opt.value
                      ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
                      : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden">
              {isLoadingWallet ? (
                <div className="p-12 flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cyan-500"></div>
                </div>
              ) : transactions.length === 0 ? (
                <div className="p-12 text-center">
                  <Wallet className="w-10 h-10 text-gray-500 mx-auto mb-3" />
                  <p className="text-gray-400">No transactions yet</p>
                  <p className="text-sm text-gray-500 mt-1">Generate some music to see your credit history here</p>
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {transactions.map((tx: any) => (
                    <div key={tx.id}>
                      <div className="flex items-center gap-3 px-5 py-4 hover:bg-white/[0.02] transition-colors">
                        <div className={`p-2 rounded-lg flex-shrink-0 ${
                          tx.type === 'release' ? 'bg-green-500/10 text-green-400' :
                          tx.amount > 0 ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                        }`}>
                          {txTypeIcon(tx.type)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{tx.description || txTypeLabel(tx.type)}</p>
                          {tx.type === 'earn_sale' && tx.metadata?.buyerUsername && (
                            <p className="text-xs text-cyan-400/80 truncate">Bought by @{tx.metadata.buyerUsername}</p>
                          )}
                          {tx.type === 'earn_purchase' && tx.metadata?.sellerUsername && (
                            <p className="text-xs text-purple-400/80 truncate">From @{tx.metadata.sellerUsername}</p>
                          )}
                          {tx.type === 'release' && tx.metadata?.trackId444 && (
                            <p className="text-xs text-cyan-400/80 truncate font-mono">ID: {tx.metadata.trackId444}</p>
                          )}
                          <p className="text-xs text-gray-500">
                            {txTypeLabel(tx.type)} &middot; {new Date(tx.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                        {tx.type === 'release' && tx.metadata && (
                          <button
                            onClick={() => setExpandedTx(expandedTx === tx.id ? null : tx.id)}
                            className={`p-2 rounded-lg flex-shrink-0 transition-colors ${
                              expandedTx === tx.id ? 'bg-cyan-500/20 text-cyan-400' : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                            }`}
                            title="View release metadata"
                          >
                            <Info className="w-4 h-4" />
                          </button>
                        )}
                        <div className="text-right flex-shrink-0">
                          <p className={`text-sm font-bold ${
                            tx.type === 'release' ? 'text-green-400' :
                            tx.amount > 0 ? 'text-green-400' : 'text-red-400'
                          }`}>
                            {tx.type === 'release' ? '✓' : (tx.amount > 0 ? '+' : '') + tx.amount}
                          </p>
                          {tx.balance_after !== null && tx.type !== 'release' && (
                            <p className="text-xs text-gray-500">Bal: {tx.balance_after}</p>
                          )}
                        </div>
                        <div className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${
                          tx.status === 'success' ? 'bg-green-500/10 text-green-400' :
                          tx.status === 'failed' ? 'bg-red-500/10 text-red-400' :
                          'bg-yellow-500/10 text-yellow-400'
                        }`}>
                          {tx.status}
                        </div>
                      </div>
                      {tx.type === 'release' && expandedTx === tx.id && tx.metadata && (
                        <div className="px-5 pb-4 -mt-1">
                          <div className="ml-10 p-3 bg-white/[0.03] border border-white/[0.06] rounded-xl space-y-1.5">
                            {tx.metadata.trackId444 && (
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-gray-500 w-20">Track ID</span>
                                <span className="text-xs text-cyan-400 font-mono">{tx.metadata.trackId444}</span>
                              </div>
                            )}
                            {tx.metadata.genre && (
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-gray-500 w-20">Genre</span>
                                <span className="text-xs text-gray-300">{tx.metadata.genre}</span>
                              </div>
                            )}
                            {tx.metadata.artist_name && (
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-gray-500 w-20">Artist</span>
                                <span className="text-xs text-gray-300">{tx.metadata.artist_name}</span>
                              </div>
                            )}
                            {tx.metadata.featured_artists?.length > 0 && (
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-gray-500 w-20">Featured</span>
                                <span className="text-xs text-purple-400">{tx.metadata.featured_artists.join(', ')}</span>
                              </div>
                            )}
                            {tx.metadata.contributors?.length > 0 && (
                              <div className="flex items-start gap-2">
                                <span className="text-[10px] text-gray-500 w-20 mt-0.5">Contributors</span>
                                <div className="space-y-0.5">
                                  {tx.metadata.contributors.map((c: any, idx: number) => (
                                    <span key={idx} className="text-xs text-gray-300 block">{c.name} <span className="text-gray-500">({c.role})</span></span>
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
              {walletTotalPages > 1 && (
                <div className="flex items-center justify-between px-5 py-3 border-t border-white/5">
                  <button
                    onClick={() => setWalletPage(p => Math.max(1, p - 1))}
                    disabled={walletPage <= 1}
                    className="flex items-center gap-1 text-sm text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" /> Prev
                  </button>
                  <span className="text-xs text-gray-500">Page {walletPage} of {walletTotalPages}</span>
                  <button
                    onClick={() => setWalletPage(p => Math.min(walletTotalPages, p + 1))}
                    disabled={walletPage >= walletTotalPages}
                    className="flex items-center gap-1 text-sm text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    Next <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>

        ) : activeTab === 'plugin' ? (
          <div className="space-y-6">
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 bg-opacity-20">
                  <Plug className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">444 Radio Plugin</h2>
                  <p className="text-sm text-gray-400">Generate music, effects, loops &amp; stems directly inside Ableton</p>
                </div>
              </div>

              <div className="bg-purple-500/5 border border-purple-500/20 rounded-xl p-4 mb-6">
                <p className="text-sm text-purple-300">
                  <strong>How it works:</strong> Generate a token below, paste it into the 444 Radio plugin inside Ableton, and start generating. All generations land in your library and Ableton timeline.
                </p>
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
                  <Key className="w-4 h-4" /> Generate Plugin Token
                </h3>
                <div className="flex gap-3">
                  <input
                    value={tokenName}
                    onChange={(e) => setTokenName(e.target.value)}
                    placeholder="Token name (e.g. Ableton Studio)"
                    maxLength={50}
                    className="flex-1 bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                  />
                  <button
                    onClick={createPluginToken}
                    disabled={isCreatingToken}
                    className="px-5 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                  >
                    {isCreatingToken ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Key className="w-4 h-4" />
                    )}
                    Generate
                  </button>
                </div>

                {pluginError && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 text-sm text-red-400 flex items-center gap-2">
                    <XCircle className="w-4 h-4 flex-shrink-0" /> {pluginError}
                  </div>
                )}

                {newToken && (
                  <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 space-y-3">
                    <div className="flex items-center gap-2 text-green-400">
                      <CheckCircle className="w-4 h-4" />
                      <span className="text-sm font-semibold">Token created! Copy it now — it won&apos;t be shown again.</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 bg-black/50 rounded-lg px-3 py-2 text-sm text-green-300 font-mono break-all select-all">
                        {newToken}
                      </code>
                      <button
                        onClick={() => copyToClipboard(newToken)}
                        className="px-3 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg text-sm flex items-center gap-1 transition-colors"
                      >
                        {copiedToken ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        {copiedToken ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                    <p className="text-xs text-gray-500">Paste this into your 444 Radio plugin settings in Ableton.</p>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <Key className="w-5 h-5 text-purple-400" /> Your Plugin Tokens
              </h3>
              {isLoadingTokens ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500"></div>
                </div>
              ) : pluginTokens.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Plug className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p>No tokens yet. Generate one above to get started.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pluginTokens.map((t) => (
                    <div key={t.id} className={`flex items-center justify-between p-4 rounded-xl border ${
                      t.is_active ? 'bg-white/5 border-white/10' : 'bg-white/2 border-white/5 opacity-50'
                    }`}>
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${t.is_active ? 'bg-green-500' : 'bg-red-500'}`} />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-white truncate">{t.name}</p>
                          <p className="text-xs text-gray-500">
                            Created {new Date(t.created_at).toLocaleDateString()}
                            {t.last_used_at && ` · Last used ${new Date(t.last_used_at).toLocaleDateString()}`}
                          </p>
                        </div>
                      </div>
                      {t.is_active && (
                        <button
                          onClick={() => revokePluginToken(t.id)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 rounded-lg text-xs font-medium transition-colors flex-shrink-0"
                        >
                          <Trash2 className="w-3 h-3" /> Revoke
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <p className="text-xs text-gray-600 mt-4">Maximum 5 active tokens. Credits required for each generation.</p>
            </div>

            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8">
              <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
                <Download className="w-5 h-5 text-cyan-400" /> Get the Plugin
              </h3>
              <p className="text-sm text-gray-400 mb-4">
                The 444 Radio VST3 plugin works inside Ableton Live, FL Studio, and any DAW that supports VST3 on Windows.
              </p>

              {hasPluginPurchase ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 px-3 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs text-emerald-300">Plugin purchased — unlimited access forever</span>
                  </div>
                  <a
                    href="/api/plugin/download-installer"
                    onClick={() => setTimeout(() => setShowInstallGuide(true), 500)}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-cyan-600 to-cyan-400 text-black rounded-xl font-bold text-sm hover:from-cyan-500 hover:to-cyan-300 transition-all shadow-lg shadow-cyan-500/20"
                  >
                    <Download className="w-4 h-4" />
                    Download Plugin v2
                  </a>
                  <p className="text-xs text-gray-500">Windows · Standalone + VST3 · 3.8 MB</p>
                  <button
                    onClick={() => setShowInstallGuide(true)}
                    className="text-xs text-cyan-400 hover:text-cyan-300 underline transition-colors"
                  >
                    View install instructions
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-gradient-to-br from-cyan-500/10 to-purple-500/10 border border-cyan-500/30 rounded-xl p-5">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="text-sm font-bold text-white">One-Time Purchase</p>
                        <p className="text-xs text-gray-400">Unlimited plugin access forever</p>
                      </div>
                      <span className="text-2xl font-black text-white">$4</span>
                    </div>
                    <button
                      onClick={async () => {
                        if (buyingPlugin) return
                        setBuyingPlugin(true)
                        try {
                          const orderRes = await fetch('/api/plugin/purchase/create-order', { method: 'POST' })
                          const orderData = await orderRes.json()
                          if (!orderRes.ok) throw new Error(orderData.error || 'Failed to create order')

                          const rzp = new (window as any).Razorpay({
                            key: orderData.razorpay_key_id,
                            amount: orderData.amount,
                            currency: orderData.currency,
                            name: '444 Radio',
                            description: 'VST3 Plugin — Unlimited Access',
                            order_id: orderData.order_id,
                            prefill: {
                              email: orderData.customer_email,
                              name: orderData.customer_name,
                            },
                            handler: async (response: any) => {
                              const verifyRes = await fetch('/api/plugin/purchase/verify', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  razorpay_order_id: response.razorpay_order_id,
                                  razorpay_payment_id: response.razorpay_payment_id,
                                  razorpay_signature: response.razorpay_signature,
                                }),
                              })
                              if (verifyRes.ok) {
                                setHasPluginPurchase(true)
                                setBuyingPlugin(false)
                              }
                            },
                            modal: { ondismiss: () => setBuyingPlugin(false) },
                            theme: { color: '#06b6d4' },
                          })
                          rzp.open()
                        } catch (err: any) {
                          setPluginError(err.message || 'Purchase failed')
                          setBuyingPlugin(false)
                        }
                      }}
                      disabled={buyingPlugin}
                      className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-cyan-600 to-cyan-400 text-black rounded-xl font-bold text-sm hover:from-cyan-500 hover:to-cyan-300 transition-all shadow-lg shadow-cyan-500/20 disabled:opacity-50"
                    >
                      {buyingPlugin ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                      {buyingPlugin ? 'Processing...' : 'Buy Plugin — $4'}
                    </button>
                  </div>
                </div>
              )}

              {pluginError && (
                <div className="mt-3 flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <AlertCircle className="w-4 h-4 text-red-400" />
                  <span className="text-xs text-red-300">{pluginError}</span>
                </div>
              )}
            </div>

            {showInstallGuide && (
              <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowInstallGuide(false)}>
                <div className="bg-gray-900 border border-white/10 rounded-2xl p-8 max-w-lg w-full max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold flex items-center gap-2">
                      <Monitor className="w-5 h-5 text-cyan-400" />
                      Install Guide
                    </h3>
                    <button onClick={() => setShowInstallGuide(false)} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                      <X size={18} className="text-gray-400" />
                    </button>
                  </div>
                  <div className="space-y-5">
                    <div className="flex gap-3">
                      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-xs font-bold text-cyan-400">1</div>
                      <div>
                        <p className="font-semibold text-white text-sm">Extract the ZIP</p>
                        <p className="text-xs text-gray-400 mt-1">Unzip <span className="text-cyan-400 font-mono">444Radio-Plugin-v2-Windows.zip</span></p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-xs font-bold text-cyan-400">2</div>
                      <div>
                        <p className="font-semibold text-white text-sm">Copy to VST3 Folder</p>
                        <div className="mt-2 flex items-center gap-2 px-3 py-2 bg-white/5 rounded-lg">
                          <FolderOpen className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
                          <code className="text-xs text-cyan-300 break-all">C:\Program Files\Common Files\VST3\</code>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-xs font-bold text-cyan-400">3</div>
                      <div>
                        <p className="font-semibold text-white text-sm">Rescan in Your DAW</p>
                        <p className="text-xs text-gray-400 mt-1"><strong className="text-white">Ableton:</strong> Preferences → Plug-ins → VST3 → Rescan</p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-xs font-bold text-cyan-400">4</div>
                      <div>
                        <p className="font-semibold text-white text-sm">Connect Your Token</p>
                        <p className="text-xs text-gray-400 mt-1">Paste your token → hit Connect.</p>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowInstallGuide(false)}
                    className="w-full mt-6 px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-medium text-gray-300 transition-colors"
                  >
                    Got it
                  </button>
                </div>
              </div>
            )}
          </div>

        ) : (
          <div className="space-y-6">
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8">
              <h2 className="text-xl font-bold mb-6">Profile Settings</h2>
              <div className="flex items-center gap-4 mb-6">
                <img
                  src={customAvatarUrl || user.imageUrl}
                  alt={user.firstName || 'User'}
                  className="w-16 h-16 rounded-full border-2 border-cyan-500/30"
                />
                <div>
                  <p className="font-semibold text-lg">{user.firstName} {user.lastName}</p>
                  <p className="text-sm text-gray-400">{user.primaryEmailAddress?.emailAddress}</p>
                </div>
              </div>
              <button
                onClick={() => setShowProfileModal(true)}
                className="px-6 py-3 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 rounded-lg font-medium transition-colors"
              >
                Edit Profile
              </button>
            </div>
          </div>
        )}
      </div>

      {user && showProfileModal && (
        <ProfileSettingsModal
          isOpen={showProfileModal}
          onClose={() => setShowProfileModal(false)}
          currentUsername={user.username || user.firstName || ''}
          currentAvatar={customAvatarUrl || user.imageUrl}
          onUpdate={() => { window.location.reload() }}
        />
      )}

      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
    </main>
  )
}
