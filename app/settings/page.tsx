'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useUser } from '@clerk/nextjs'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, CreditCard, User, AlertCircle, CheckCircle, XCircle, Crown, Calendar, Clock, Zap, Wallet, ChevronLeft, ChevronRight, Music, Image, Video, Repeat, Sparkles, ShoppingCart, Tag, Gift, RefreshCw, Filter, Scissors, Volume2, Send, Info, Plug, Copy, Trash2, Eye, EyeOff, Key } from 'lucide-react'
import Link from 'next/link'
import ProfileSettingsModal from '../components/ProfileSettingsModal'
import { useCredits } from '../contexts/CreditsContext'

type SubscriptionStatus = {
  hasSubscription: boolean
  status: string
  plan: string
  planId: string | null
  subscriptionId: string | null
  startDate: number | null
  endDate: number | null
  currentPeriodEnd: number | null
  nextBillingDate: number | null
  cancelAtPeriodEnd: boolean
  razorpayStatus: string | null
}

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
  const initialTab = (['profile', 'subscription', 'wallet', 'plugin'].includes(searchParams.get('tab') || '') ? searchParams.get('tab') : 'subscription') as 'profile' | 'subscription' | 'wallet' | 'plugin'
  const [activeTab, setActiveTab] = useState<'profile' | 'subscription' | 'wallet' | 'plugin'>(initialTab)
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null)
  const [isLoadingSubscription, setIsLoadingSubscription] = useState(true)
  const { credits, isLoading: isLoadingCredits, refreshCredits } = useCredits()
  const [isCanceling, setIsCanceling] = useState(false)
  const [isReactivating, setIsReactivating] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [cancelMessage, setCancelMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [customAvatarUrl, setCustomAvatarUrl] = useState<string | null>(null)

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

  useEffect(() => {
    if (!isLoaded) return
    if (!user) {
      router.push('/sign-in')
    }
  }, [user, isLoaded, router])

  // Fetch custom avatar from Supabase (R2 URL stored in avatar_url column)
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

  useEffect(() => {
    if (user) {
      fetchSubscriptionStatus()
    }
  }, [user])

  const fetchSubscriptionStatus = async () => {
    try {
      setIsLoadingSubscription(true)
      const response = await fetch('/api/subscriptions/status')
      const data = await response.json()
      
      if (data.success) {
        setSubscription(data)
      }
    } catch (error) {
      console.error('Failed to fetch subscription:', error)
    } finally {
      setIsLoadingSubscription(false)
    }
  }

  const handleCancelSubscription = async () => {
    if (!subscription?.subscriptionId) return

    try {
      setIsCanceling(true)
      setCancelMessage(null)

      const response = await fetch('/api/subscriptions/cancel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          cancelAtCycleEnd: true // Safe: keeps access until period end
        })
      })

      const data = await response.json()

      if (data.success) {
        setCancelMessage({
          type: 'success',
          text: data.message || 'Subscription cancelled successfully'
        })
        setShowCancelConfirm(false)
        setTimeout(() => {
          fetchSubscriptionStatus()
          refreshCredits()
        }, 1000)
      } else {
        setCancelMessage({
          type: 'error',
          text: data.error || 'Failed to cancel subscription'
        })
      }
    } catch (error: any) {
      setCancelMessage({
        type: 'error',
        text: error.message || 'Network error occurred'
      })
    } finally {
      setIsCanceling(false)
    }
  }

  const handleReactivateSubscription = async () => {
    if (!subscription?.subscriptionId) return

    try {
      setIsReactivating(true)
      setCancelMessage(null)

      const response = await fetch('/api/subscriptions/reactivate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      const data = await response.json()

      if (data.success) {
        setCancelMessage({
          type: 'success',
          text: data.message || 'Subscription reactivated successfully'
        })
        setTimeout(() => {
          fetchSubscriptionStatus()
          refreshCredits()
        }, 1000)
      } else {
        setCancelMessage({
          type: 'error',
          text: data.error || data.message || 'Failed to reactivate subscription'
        })
      }
    } catch (error: any) {
      setCancelMessage({
        type: 'error',
        text: error.message || 'Network error occurred'
      })
    } finally {
      setIsReactivating(false)
    }
  }

  const formatDate = (timestamp: number | null) => {
    if (!timestamp) return 'N/A'
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const getPlanColor = (plan: string) => {
    const planLower = plan.toLowerCase()
    if (planLower.includes('studio')) return 'from-purple-500 to-pink-500'
    if (planLower.includes('pro')) return 'from-blue-500 to-cyan-500'
    return 'from-cyan-500 to-teal-500'
  }

  const getPlanCredits = (plan: string) => {
    const planLower = plan.toLowerCase()
    if (planLower.includes('studio')) return '1500'
    if (planLower.includes('pro')) return '600'
    return '100'
  }

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

  // Plugin token functions
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

  useEffect(() => {
    if (activeTab === 'plugin' && user) fetchPluginTokens()
  }, [activeTab, user, fetchPluginTokens])

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
      subscription_bonus: 'Subscription Bonus',
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
    if (type === 'credit_award' || type === 'subscription_bonus') return <Gift className="w-4 h-4" />
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
    { value: 'credit_award', label: 'Awards' },
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
          <p className="text-cyan-400/60">Manage your account and subscription</p>
        </div>

        <div className="flex gap-4 mb-8 border-b border-white/10">
          <button
            onClick={() => setActiveTab('subscription')}
            className={`pb-4 px-2 font-medium transition-colors relative ${
              activeTab === 'subscription' ? 'text-cyan-400' : 'text-gray-400 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              <span>Subscription</span>
            </div>
            {activeTab === 'subscription' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-400"></div>
            )}
          </button>
          <button
            onClick={() => setActiveTab('wallet')}
            className={`pb-4 px-2 font-medium transition-colors relative ${
              activeTab === 'wallet' ? 'text-cyan-400' : 'text-gray-400 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2">
              <Wallet className="w-5 h-5" />
              <span>Wallet & Billing</span>
            </div>
            {activeTab === 'wallet' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-400"></div>
            )}
          </button>
          <button
            onClick={() => setActiveTab('profile')}
            className={`pb-4 px-2 font-medium transition-colors relative ${
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
            className={`pb-4 px-2 font-medium transition-colors relative ${
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

        {activeTab === 'subscription' ? (
          <div className="space-y-6">
            {cancelMessage && (
              <div className={`p-4 rounded-lg border flex items-start gap-3 ${
                cancelMessage.type === 'success'
                  ? 'bg-green-500/10 border-green-500/30 text-green-400'
                  : 'bg-red-500/10 border-red-500/30 text-red-400'
              }`}>
                {cancelMessage.type === 'success' ? (
                  <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                )}
                <p className="text-sm">{cancelMessage.text}</p>
              </div>
            )}

            {isLoadingSubscription ? (
              <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cyan-500"></div>
              </div>
            ) : subscription?.hasSubscription ? (
              <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8">
                <div className="flex items-start justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className={`p-3 rounded-xl bg-gradient-to-br ${getPlanColor(subscription.plan)} bg-opacity-20`}>
                      <Crown className="w-6 h-6" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold">{subscription.plan} Plan</h2>
                      <p className="text-sm text-gray-400 capitalize">Status: {subscription.status}</p>
                    </div>
                  </div>
                  <div className={`px-4 py-2 rounded-full text-sm font-medium ${
                    subscription.status === 'active'
                      ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                      : 'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                  }`}>
                    {subscription.cancelAtPeriodEnd ? 'Ending Soon' : 'Active'}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                  <div className="flex items-start gap-3">
                    <Zap className="w-5 h-5 text-cyan-400 mt-0.5" />
                    <div>
                      <p className="text-sm text-gray-400">Credits in Wallet</p>
                      <p className="text-lg font-semibold">
                        {isLoadingCredits ? (
                          <span className="text-gray-500">Loading...</span>
                        ) : (
                          `${credits || 0} credits`
                        )}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        +{getPlanCredits(subscription.plan)} credits/month
                      </p>
                    </div>
                  </div>
                  
                  {subscription.nextBillingDate && !subscription.cancelAtPeriodEnd && (
                    <div className="flex items-start gap-3">
                      <Calendar className="w-5 h-5 text-cyan-400 mt-0.5" />
                      <div>
                        <p className="text-sm text-gray-400">Next Billing Date</p>
                        <p className="text-lg font-semibold">{formatDate(subscription.nextBillingDate)}</p>
                      </div>
                    </div>
                  )}
                  
                  {subscription.currentPeriodEnd && (
                    <div className="flex items-start gap-3">
                      <Clock className="w-5 h-5 text-cyan-400 mt-0.5" />
                      <div>
                        <p className="text-sm text-gray-400">
                          {subscription.cancelAtPeriodEnd ? 'Access Until' : 'Current Period Ends'}
                        </p>
                        <p className="text-lg font-semibold">{formatDate(subscription.currentPeriodEnd)}</p>
                      </div>
                    </div>
                  )}

                  {subscription.startDate && (
                    <div className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-cyan-400 mt-0.5" />
                      <div>
                        <p className="text-sm text-gray-400">Member Since</p>
                        <p className="text-lg font-semibold">{formatDate(subscription.startDate)}</p>
                      </div>
                    </div>
                  )}
                </div>

                {subscription.cancelAtPeriodEnd && (
                  <div className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm text-yellow-400 font-medium">Subscription Ending</p>
                      <p className="text-sm text-gray-400 mt-1">
                        Your subscription will end on {formatDate(subscription.currentPeriodEnd)}. You'll keep ALL your accumulated credits forever and can use them anytime. You just won't receive new monthly credits after this date.
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-4">
                  {subscription.cancelAtPeriodEnd ? (
                    <button
                      onClick={handleReactivateSubscription}
                      disabled={isReactivating}
                      className="px-6 py-3 bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 text-green-400 rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {isReactivating ? (
                        <>
                          <div className="w-4 h-4 border-2 border-green-400/30 border-t-green-400 rounded-full animate-spin" />
                          <span>Reactivating...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-5 h-5" />
                          <span>Reactivate Subscription</span>
                        </>
                      )}
                    </button>
                  ) : (
                    subscription.status === 'active' && (
                      <button
                        onClick={() => setShowCancelConfirm(true)}
                        className="px-6 py-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 rounded-lg font-medium transition-colors"
                      >
                        Cancel Subscription
                      </button>
                    )
                  )}
                  <Link
                    href="/pricing"
                    className="px-6 py-3 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 rounded-lg font-medium transition-colors text-center"
                  >
                    {subscription.cancelAtPeriodEnd ? 'View Plans' : 'Change Plan'}
                  </Link>
                </div>
              </div>
            ) : (
              <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 text-center">
                <div className="inline-flex p-4 rounded-full bg-cyan-500/10 mb-4">
                  <CreditCard className="w-8 h-8 text-cyan-400" />
                </div>
                <h2 className="text-2xl font-bold mb-2">No Active Subscription</h2>
                <p className="text-gray-400 mb-6">
                  Subscribe to get monthly credits and unlock unlimited AI music generation
                </p>
                <Link
                  href="/pricing"
                  className="inline-block px-8 py-3 bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 rounded-lg font-semibold transition-all"
                >
                  View Plans
                </Link>
              </div>
            )}
          </div>
        ) : activeTab === 'wallet' ? (
          <div className="space-y-6">
            {/* Wallet Header */}
            <div className="flex items-center gap-3 px-1">
              <Wallet className="w-6 h-6 text-cyan-400" />
              <div>
                <h2 className="text-lg font-bold text-white">Wallet &amp; Transactions</h2>
                <p className="text-xs text-gray-500">All transactions, generations, purchases, releases &amp; sales</p>
              </div>
            </div>

            {/* Credit Balance Card */}
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

            {/* Filters */}
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

            {/* Transaction List */}
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
                        {/* Icon */}
                        <div className={`p-2 rounded-lg flex-shrink-0 ${
                          tx.type === 'release' ? 'bg-green-500/10 text-green-400' :
                          tx.amount > 0 ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                        }`}>
                          {txTypeIcon(tx.type)}
                        </div>

                        {/* Info */}
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

                        {/* Info button for releases */}
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

                        {/* Amount */}
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

                        {/* Status badge */}
                        <div className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${
                          tx.status === 'success' ? 'bg-green-500/10 text-green-400' :
                          tx.status === 'failed' ? 'bg-red-500/10 text-red-400' :
                          'bg-yellow-500/10 text-yellow-400'
                        }`}>
                          {tx.status}
                        </div>
                      </div>

                      {/* Expanded release metadata */}
                      {tx.type === 'release' && expandedTx === tx.id && tx.metadata && (
                        <div className="px-5 pb-4 -mt-1">
                          <div className="ml-10 p-3 bg-white/[0.03] border border-white/[0.06] rounded-xl space-y-1.5">
                            {tx.metadata.trackId444 && (
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-gray-500 w-20">Track ID</span>
                                <span className="text-xs text-cyan-400 font-mono">{tx.metadata.trackId444}</span>
                              </div>
                            )}
                            {tx.metadata.trackId && (
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-gray-500 w-20">DB ID</span>
                                <span className="text-[10px] text-gray-400 font-mono truncate">{tx.metadata.trackId}</span>
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

              {/* Pagination */}
              {walletTotalPages > 1 && (
                <div className="flex items-center justify-between px-5 py-3 border-t border-white/5">
                  <button
                    onClick={() => setWalletPage(p => Math.max(1, p - 1))}
                    disabled={walletPage <= 1}
                    className="flex items-center gap-1 text-sm text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" /> Prev
                  </button>
                  <span className="text-xs text-gray-500">
                    Page {walletPage} of {walletTotalPages}
                  </span>
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
            {/* Plugin Header */}
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 bg-opacity-20">
                  <Plug className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">444 Radio Plugin</h2>
                  <p className="text-sm text-gray-400">Generate music, effects, loops & stems directly inside Ableton</p>
                </div>
              </div>

              <div className="bg-purple-500/5 border border-purple-500/20 rounded-xl p-4 mb-6">
                <p className="text-sm text-purple-300">
                  <strong>How it works:</strong> Generate a token below, paste it into the 444 Radio plugin inside Ableton, and start generating. All generations land in your library and Ableton timeline.
                </p>
              </div>

              {/* Create new token */}
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

                {/* Newly created token (shown ONCE) */}
                {newToken && (
                  <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 space-y-3">
                    <div className="flex items-center gap-2 text-green-400">
                      <CheckCircle className="w-4 h-4" />
                      <span className="text-sm font-semibold">Token created! Copy it now — it won't be shown again.</span>
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

            {/* Existing tokens */}
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
                      t.is_active
                        ? 'bg-white/5 border-white/10'
                        : 'bg-white/2 border-white/5 opacity-50'
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

              <p className="text-xs text-gray-600 mt-4">Maximum 5 active tokens. Each token has a 100 requests/day rate limit.</p>
            </div>

            {/* Plugin download / info */}
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8">
              <h3 className="text-lg font-bold mb-3">Get the Plugin</h3>
              <p className="text-sm text-gray-400 mb-4">
                The 444 Radio VST3 plugin works inside Ableton Live (Mac & Windows). One-time purchase, lifetime access — you only pay for generation credits.
              </p>
              <div className="flex items-center gap-4">
                <div className="bg-gradient-to-br from-purple-600 to-pink-600 text-white px-6 py-3 rounded-xl font-bold text-lg">
                  $25 <span className="text-sm font-normal opacity-80">one-time</span>
                </div>
                <span className="text-xs text-gray-500">Coming soon — plugin download will appear here</span>
              </div>
            </div>
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

      {showCancelConfirm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-white/10 rounded-2xl p-8 max-w-md w-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 rounded-full bg-red-500/10">
                <AlertCircle className="w-6 h-6  text-red-400" />
              </div>
              <h3 className="text-xl font-bold">Cancel Subscription?</h3>
            </div>
            <p className="text-gray-400 mb-6">
              Your subscription will remain active until {formatDate(subscription?.currentPeriodEnd || null)}. 
              <strong className="text-white">You'll keep all your accumulated credits forever</strong> and can use them anytime. You just won't receive new monthly credits after this date. No refunds for remaining time.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowCancelConfirm(false)}
                disabled={isCanceling}
                className="flex-1 px-6 py-3 bg-white/10 hover:bg-white/20 rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                Keep Subscription
              </button>
              <button
                onClick={handleCancelSubscription}
                disabled={isCanceling}
                className="flex-1 px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isCanceling ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Canceling...</span>
                  </>
                ) : (
                  'Yes, Cancel'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {user && showProfileModal && (
        <ProfileSettingsModal
          isOpen={showProfileModal}
          onClose={() => setShowProfileModal(false)}
          currentUsername={user.username || user.firstName || ''}
          currentAvatar={customAvatarUrl || user.imageUrl}
          onUpdate={() => {
            // Force refresh Clerk user data + credits
            window.location.reload()
          }}
        />
      )}
    </main>
  )
}
