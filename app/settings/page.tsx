'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useUser } from '@clerk/nextjs'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, CreditCard, User, AlertCircle, CheckCircle, XCircle, Crown, Calendar, Clock, Zap, Wallet, ChevronLeft, ChevronRight, Music, Image, Video, Repeat, Sparkles, ShoppingCart, Tag, Gift, RefreshCw, Filter } from 'lucide-react'
import Link from 'next/link'
import ProfileSettingsModal from '../components/ProfileSettingsModal'

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
  const initialTab = (['profile', 'subscription', 'wallet'].includes(searchParams.get('tab') || '') ? searchParams.get('tab') : 'subscription') as 'profile' | 'subscription' | 'wallet'
  const [activeTab, setActiveTab] = useState<'profile' | 'subscription' | 'wallet'>(initialTab)
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null)
  const [isLoadingSubscription, setIsLoadingSubscription] = useState(true)
  const [credits, setCredits] = useState<number | null>(null)
  const [isLoadingCredits, setIsLoadingCredits] = useState(true)
  const [isCanceling, setIsCanceling] = useState(false)
  const [isReactivating, setIsReactivating] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [cancelMessage, setCancelMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [showProfileModal, setShowProfileModal] = useState(false)

  // Wallet state
  const [transactions, setTransactions] = useState<any[]>([])
  const [walletPage, setWalletPage] = useState(1)
  const [walletTotal, setWalletTotal] = useState(0)
  const [walletTotalPages, setWalletTotalPages] = useState(0)
  const [isLoadingWallet, setIsLoadingWallet] = useState(false)
  const [walletFilter, setWalletFilter] = useState('')
  const [walletCredits, setWalletCredits] = useState(0)

  useEffect(() => {
    if (!isLoaded) return
    if (!user) {
      router.push('/sign-in')
    }
  }, [user, isLoaded, router])

  useEffect(() => {
    if (user) {
      fetchSubscriptionStatus()
      fetchCredits()
    }
  }, [user])

  const fetchCredits = async () => {
    try {
      setIsLoadingCredits(true)
      const response = await fetch('/api/credits')
      const data = await response.json()
      
      if (data.credits !== undefined) {
        setCredits(data.credits)
      }
    } catch (error) {
      console.error('Failed to fetch credits:', error)
    } finally {
      setIsLoadingCredits(false)
    }
  }

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
          fetchCredits()
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
          fetchCredits()
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

  const txTypeLabel = (type: string) => {
    const map: Record<string, string> = {
      generation_music: 'Music Generation',
      generation_effects: 'Sound Effects',
      generation_loops: 'Loop Generation',
      generation_image: 'Image Generation',
      generation_video_to_audio: 'Video-to-Audio',
      generation_cover_art: 'Cover Art',
      generation_stem_split: 'Stem Split',
      earn_list: 'Earn Listing',
      earn_purchase: 'Earn Purchase',
      earn_sale: 'Earn Sale',
      earn_admin: 'Platform Fee',
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
    if (type === 'earn_purchase') return <ShoppingCart className="w-4 h-4" />
    if (type === 'earn_sale' || type === 'earn_list') return <Tag className="w-4 h-4" />
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
    { value: 'generation_video_to_audio', label: 'Video' },
    { value: 'earn_purchase', label: 'Purchases' },
    { value: 'earn_sale', label: 'Sales' },
    { value: 'earn_list', label: 'Listings' },
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
                    <div key={tx.id} className="flex items-center gap-3 px-5 py-4 hover:bg-white/[0.02] transition-colors">
                      {/* Icon */}
                      <div className={`p-2 rounded-lg flex-shrink-0 ${
                        tx.amount > 0 ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                      }`}>
                        {txTypeIcon(tx.type)}
                      </div>

                      {/* Info */}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{tx.description || txTypeLabel(tx.type)}</p>
                        <p className="text-xs text-gray-500">
                          {txTypeLabel(tx.type)} &middot; {new Date(tx.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>

                      {/* Amount */}
                      <div className="text-right flex-shrink-0">
                        <p className={`text-sm font-bold ${
                          tx.amount > 0 ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {tx.amount > 0 ? '+' : ''}{tx.amount}
                        </p>
                        {tx.balance_after !== null && (
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
        ) : (
          <div className="space-y-6">
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8">
              <h2 className="text-xl font-bold mb-6">Profile Settings</h2>
              <div className="flex items-center gap-4 mb-6">
                <img
                  src={user.imageUrl}
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
          currentUsername=""
          currentAvatar={user.imageUrl}
          onUpdate={() => {}}
        />
      )}
    </main>
  )
}
