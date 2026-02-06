'use client'

import { useState, useEffect } from 'react'
import { useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { ArrowLeft, CreditCard, User, AlertCircle, CheckCircle, XCircle, Crown, Calendar, Clock, Zap } from 'lucide-react'
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
  const { user, isLoaded } = useUser()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'profile' | 'subscription'>('subscription')
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null)
  const [isLoadingSubscription, setIsLoadingSubscription] = useState(true)
  const [isCanceling, setIsCanceling] = useState(false)
  const [isReactivating, setIsReactivating] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [cancelMessage, setCancelMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [showProfileModal, setShowProfileModal] = useState(false)

  useEffect(() => {
    if (!isLoaded) return
    if (!user) {
      router.push('/sign-in')
    }
  }, [user, isLoaded, router])

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
    if (planLower.includes('studio')) return '400'
    if (planLower.includes('pro')) return '200'
    return '100'
  }

  if (!isLoaded || !user) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-500"></div>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-black text-white relative overflow-hidden">
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
                      <p className="text-sm text-gray-400">Monthly Credits</p>
                      <p className="text-lg font-semibold">{getPlanCredits(subscription.plan)} credits</p>
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
