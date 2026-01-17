'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Youtube, Mail, Instagram, X, ArrowLeft, Shield } from 'lucide-react'
import Link from 'next/link'
import FloatingMenu from '../components/FloatingMenu'
import Script from 'next/script'

// Discord SVG icon component
const DiscordIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z"/>
  </svg>
)

// Declare Razorpay interface for TypeScript
declare global {
  interface Window {
    Razorpay: any
  }
}

export default function Pricing() {
  const router = useRouter()
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly')
  const [currency, setCurrency] = useState<'INR' | 'USD'>('INR') // Currency selection
  const [creditAmount, setCreditAmount] = useState(5) // Default $5
  const [showPolicyModal, setShowPolicyModal] = useState(false)
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null) // 'creator', 'pro', 'studio'
  const [userSubscription, setUserSubscription] = useState<{
    status: string
    plan: string
  } | null>(null)
  
  // Pricing by currency
  const prices = {
    creator: {
      monthly: { INR: 450, USD: 5 },
      annual: { INR: 4420, USD: 50 }
    },
    pro: {
      monthly: { INR: 1355, USD: 16 },
      annual: { INR: 13090, USD: 155 }
    },
    studio: {
      monthly: { INR: 3160, USD: 37 },
      annual: { INR: 30330, USD: 359 }
    }
  }
  
  // Rates
  const buyRate = 0.04 // $0.04 per credit (on-demand)
  const subscriptionRate = 0.03 // $0.03 per credit (subscription)
  // Calculate credits based on amount (buy credits on demand)
  const creditsFromDollars = Math.floor(creditAmount / buyRate)
  
  // Fetch user subscription status
  useEffect(() => {
    fetch('/api/credits')
      .then(res => res.json())
      .then(data => {
        if (data.subscription_status === 'active') {
          setUserSubscription({
            status: data.subscription_status,
            plan: data.subscription_plan || 'creator'
          })
        }
      })
      .catch(err => console.error('Failed to fetch subscription:', err))
  }, [])
  
  // ESC key handler to go back to explore
  useEffect(() => {
    const handleEscKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        router.push('/explore')
      }
    }
    
    window.addEventListener('keydown', handleEscKey)
    return () => window.removeEventListener('keydown', handleEscKey)
  }, [router])

  // Handle plan subscription - CONDITIONAL: INR uses Payment Links, USD uses Razorpay Checkout
  const handleSubscribe = async (plan: string) => {
    try {
      setLoadingPlan(plan)
      console.log(`Creating ${plan} subscription with currency: ${currency}`)
      
      // INR: Use existing Payment Link flow (untouched)
      if (currency === 'INR') {
        const response = await fetch('/api/subscriptions/create', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache'
          },
          body: JSON.stringify({
            plan,
            billing: billingCycle,
            currency
          })
        })
        
        console.log('Payment Link response status:', response.status)
        const data = await response.json()
        console.log('Payment Link data:', data)
        
        if (data.success && data.short_url) {
          window.location.href = data.short_url
        } else {
          setLoadingPlan(null)
          const errorMsg = `Error: ${data.error}\nStatus: ${data.status || 'unknown'}\nDetails: ${data.details || 'none'}`
          console.error('Payment Link failed:', errorMsg)
          alert(errorMsg)
        }
        return
      }
      
      // USD: Use NEW Razorpay Checkout with PayPal support
      if (currency === 'USD') {
        const response = await fetch('/api/subscriptions/checkout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache'
          },
          body: JSON.stringify({
            plan,
            billing: billingCycle
          })
        })
        
        console.log('Checkout response status:', response.status)
        const data = await response.json()
        console.log('Checkout data:', data)
        
        if (!data.success || !data.orderId) {
          setLoadingPlan(null)
          alert(`Failed to create checkout: ${data.error || 'Unknown error'}`)
          return
        }
        
        // Initialize Razorpay Checkout
        if (!window.Razorpay) {
          setLoadingPlan(null)
          alert('Razorpay SDK not loaded. Please refresh and try again.')
          return
        }
        
        const options = {
          key: data.keyId,
          amount: data.amount,
          currency: 'USD',
          name: '444Radio',
          description: `${plan.charAt(0).toUpperCase() + plan.slice(1)} Plan - ${billingCycle}`,
          order_id: data.orderId,
          handler: async function (response: any) {
            // Payment successful - verify and credit user
            console.log('Payment successful:', response)
            
            try {
              const verifyResponse = await fetch('/api/subscriptions/verify', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature
                })
              })
              
              const verifyData = await verifyResponse.json()
              
              if (verifyData.success) {
                alert(`Payment successful! ${verifyData.creditsAdded} credits added.`)
                window.location.href = '/create' // Redirect to creation page
              } else {
                alert(`Payment verification failed: ${verifyData.error}`)
              }
            } catch (err: any) {
              console.error('Verification error:', err)
              alert('Payment received but verification failed. Contact support.')
            }
          },
          prefill: {
            name: '',
            email: '',
            contact: ''
          },
          config: {
            display: {
              blocks: {
                banks: {
                  name: 'Pay via Cards & More',
                  instruments: [
                    { method: 'card' },
                    { method: 'wallet', wallets: ['paypal'] }
                  ]
                }
              },
              sequence: ['block.banks'],
              preferences: {
                show_default_blocks: true
              }
            }
          },
          theme: {
            color: '#06b6d4' // Cyan color matching site theme
          },
          modal: {
            ondismiss: function() {
              setLoadingPlan(null)
              console.log('Checkout dismissed by user')
            }
          }
        }
        
        const razorpay = new window.Razorpay(options)
        razorpay.open()
        
        // Don't reset loading state - modal handles it via ondismiss
        return
      }
      
    } catch (error: any) {
      setLoadingPlan(null)
      console.error('Subscription error:', error)
      alert('Network error: ' + error.message)
    }
  }

  return (
    <>
      {/* Load Razorpay Checkout SDK only when needed */}
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        strategy="lazyOnload"
      />
      
      <main className="min-h-screen bg-black text-white relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-cyan-950/20 via-black to-black pointer-events-none"></div>

      {/* Floating Menu */}
      <FloatingMenu />

      <div className="max-w-7xl mx-auto relative z-10 px-6 py-12">
        {/* Escape/Back Button */}
        <div className="flex justify-start mb-12">
          <Link
            href="/explore"
            className="group flex items-center gap-2 text-cyan-400/60 hover:text-cyan-400 transition-colors duration-300"
          >
            <X className="w-6 h-6 hidden md:block" />
            <ArrowLeft className="w-6 h-6 md:hidden" />
            <span className="text-sm font-medium">Back to Explore</span>
          </Link>
        </div>

        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-cyan-400 via-white to-cyan-300 bg-clip-text text-transparent leading-tight tracking-tight">
            Pricing
          </h1>
          <p className="text-cyan-400/60 text-base md:text-lg max-w-2xl mx-auto">
            Choose your plan • Flexible billing • Cancel anytime
          </p>
        </div>

        {/* Billing and Currency Toggles */}
        <div className="flex flex-col md:flex-row justify-center items-center gap-6 mb-16">
          {/* Billing Cycle Toggle */}
          <div className="inline-flex items-center gap-4 bg-black/50 backdrop-blur-xl border border-cyan-500/30 rounded-full p-2 shadow-xl shadow-cyan-500/10">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`px-8 py-4 rounded-full font-bold transition-all duration-300 ${
                billingCycle === 'monthly'
                  ? 'bg-gradient-to-r from-cyan-600 to-cyan-400 text-white shadow-lg shadow-cyan-500/40 scale-105'
                  : 'text-cyan-400/60 hover:text-cyan-400'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle('annual')}
              className={`px-8 py-4 rounded-full font-bold transition-all duration-300 relative ${
                billingCycle === 'annual'
                  ? 'bg-gradient-to-r from-cyan-600 to-cyan-400 text-white shadow-lg shadow-cyan-500/40 scale-105'
                  : 'text-cyan-400/60 hover:text-cyan-400'
              }`}
            >
              Annual
              {billingCycle !== 'annual' && (
                <span className="absolute -top-2 -right-2 px-2 py-0.5 bg-cyan-500 text-white text-xs rounded-full">
                  -20%
                </span>
              )}
            </button>
          </div>

          {/* Currency Toggle */}
          <div className="inline-flex items-center gap-4 bg-black/50 backdrop-blur-xl border border-cyan-500/30 rounded-full p-2 shadow-xl shadow-cyan-500/10">
            <button
              onClick={() => setCurrency('INR')}
              className={`px-6 py-4 rounded-full font-bold transition-all duration-300 ${
                currency === 'INR'
                  ? 'bg-gradient-to-r from-purple-600 to-purple-400 text-white shadow-lg shadow-purple-500/40 scale-105'
                  : 'text-purple-400/60 hover:text-purple-400'
              }`}
            >
              🇮🇳 INR (₹)
            </button>
            <button
              onClick={() => setCurrency('USD')}
              className={`px-6 py-4 rounded-full font-bold transition-all duration-300 relative ${
                currency === 'USD'
                  ? 'bg-gradient-to-r from-purple-600 to-purple-400 text-white shadow-lg shadow-purple-500/40 scale-105'
                  : 'text-purple-400/60 hover:text-purple-400'
              }`}
            >
              🌍 USD ($)
              <span className="absolute -top-2 -right-2 px-2 py-0.5 bg-green-500 text-white text-[10px] rounded-full font-bold">
                PayPal
              </span>
            </button>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-32">
          {/* Free Access Card */}
          <div className="group relative backdrop-blur-xl bg-black/60 border border-cyan-500/40 rounded-2xl p-8 pt-12 hover:border-cyan-400/80 transition-all duration-500 hover:scale-[1.02] overflow-hidden flex flex-col">
            {/* Holographic overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-400/20 via-transparent to-purple-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"></div>
            <div className="absolute inset-0 bg-gradient-to-tl from-pink-500/10 via-transparent to-cyan-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
            
            <div className="relative flex flex-col flex-grow">
              <div className="mb-8">
                <div className="inline-block px-3 py-1.5 bg-cyan-500/20 border border-cyan-400/50 rounded-full mb-4">
                  <span className="text-cyan-200 text-xs font-bold uppercase tracking-wider">FREE FOREVER</span>
                </div>
                <p className="text-cyan-400/50 text-xs">Decrypt to unlock</p>
              </div>

              <div className="mb-8">
                <div className="flex items-baseline gap-1 mb-2">
                  <span className="text-5xl font-black bg-gradient-to-br from-white via-cyan-200 to-purple-200 bg-clip-text text-transparent">
                    $0
                  </span>
                </div>
                <p className="text-cyan-400/40 text-xs">One-time unlock</p>
              </div>

              <ul className="space-y-4 mb-10 flex-grow">
                <li className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-gradient-to-br from-cyan-500/30 to-purple-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="w-3 h-3 text-cyan-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path>
                    </svg>
                  </div>
                  <span className="text-gray-300 text-xs leading-relaxed"><span className="font-bold text-white">20 credits</span> included</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-gradient-to-br from-cyan-500/30 to-purple-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="w-3 h-3 text-cyan-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path>
                    </svg>
                  </div>
                  <span className="text-gray-300 text-xs leading-relaxed">~10 songs or 20 cover art</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-gradient-to-br from-cyan-500/30 to-purple-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="w-3 h-3 text-cyan-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path>
                    </svg>
                  </div>
                  <span className="text-gray-300 text-xs leading-relaxed">Solve puzzle to access</span>
                </li>
              </ul>

              <Link href="/decrypt">
                <button className="w-full py-4 px-4 bg-gradient-to-r from-cyan-600 to-cyan-400 text-white rounded-xl font-bold hover:from-cyan-700 hover:to-cyan-500 transition-all duration-300 shadow-lg shadow-cyan-500/40 group-hover:scale-105 text-sm">
                  Decrypt Now
                </button>
              </Link>
            </div>
          </div>

          {/* Creator Plan */}
          <div className="group relative backdrop-blur-xl bg-black/60 border border-cyan-500/40 rounded-2xl p-8 pt-12 hover:border-cyan-400/80 transition-all duration-500 hover:scale-[1.02] overflow-hidden flex flex-col">
            {/* Holographic overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-400/20 via-transparent to-blue-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"></div>
            <div className="absolute inset-0 bg-gradient-to-tl from-blue-500/10 via-transparent to-cyan-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>

            <div className="relative flex flex-col flex-grow">
              <div className="mb-8">
                <div className="inline-block px-3 py-1.5 bg-cyan-500/20 border border-cyan-400/50 rounded-full mb-4">
                  <span className="text-cyan-200 text-xs font-bold uppercase tracking-wider">CREATOR</span>
                </div>
                <p className="text-cyan-400/50 text-xs">For music creators</p>
              </div>

              <div className="mb-8">
                <div className="flex items-baseline gap-1 mb-2">
                  <span className="text-5xl font-black bg-gradient-to-br from-white via-cyan-200 to-blue-200 bg-clip-text text-transparent">
                    {currency === 'INR' ? '₹' : '$'}{prices.creator[billingCycle][currency].toLocaleString()}
                  </span>
                  <span className="text-cyan-400/40 text-xs">
                    /{billingCycle === 'monthly' ? 'mo' : 'yr'}
                  </span>
                </div>
                {billingCycle === 'annual' && (
                  <div className="inline-block px-2 py-0.5 bg-cyan-500/15 border border-cyan-400/40 rounded-full">
                    <span className="text-cyan-300 text-[10px] font-bold">SAVE 18%</span>
                  </div>
                )}
              </div>

              <ul className="space-y-4 mb-10 flex-grow">
                <li className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-gradient-to-br from-cyan-500/30 to-blue-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="w-3 h-3 text-cyan-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path>
                    </svg>
                  </div>
                  <span className="text-gray-300 text-xs leading-relaxed"><span className="font-bold text-white">100 credits</span> per month</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-gradient-to-br from-cyan-500/30 to-blue-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="w-3 h-3 text-cyan-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path>
                    </svg>
                  </div>
                  <span className="text-gray-300 text-xs leading-relaxed">~50 songs or 100 cover art</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-gradient-to-br from-cyan-500/30 to-blue-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="w-3 h-3 text-cyan-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path>
                    </svg>
                  </div>
                  <span className="text-gray-300 text-xs leading-relaxed">Commercial license</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-gradient-to-br from-cyan-500/30 to-blue-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="w-3 h-3 text-cyan-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path>
                    </svg>
                  </div>
                  <span className="text-gray-300 text-xs leading-relaxed">Priority support</span>
                </li>
              </ul>

              <button
                onClick={() => handleSubscribe('creator')}
                disabled={loadingPlan === 'creator' || (userSubscription?.plan === 'creator' && userSubscription?.status === 'active')}
                className={`w-full py-4 px-4 rounded-xl font-bold transition-all duration-300 shadow-lg text-sm flex items-center justify-center gap-2 ${
                  userSubscription?.plan === 'creator' && userSubscription?.status === 'active'
                    ? 'bg-green-600/30 text-green-300 border-2 border-green-400/50 cursor-not-allowed'
                    : 'bg-gradient-to-r from-cyan-600 to-cyan-400 text-white shadow-cyan-500/40 group-hover:scale-105 hover:from-cyan-700 hover:to-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed'
                }`}
              >
                {userSubscription?.plan === 'creator' && userSubscription?.status === 'active' ? (
                  '✓ Current Plan'
                ) : loadingPlan === 'creator' ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>{currency === 'USD' ? 'Opening checkout...' : 'Creating payment link...'}</span>
                  </>
                ) : (
                  'Get Started'
                )}
              </button>
            </div>
          </div>

          {/* Pro Plan - Most Popular */}
          <div className="group relative backdrop-blur-xl bg-black/60 border border-cyan-400/60 rounded-2xl p-8 pt-12 hover:border-cyan-300/80 transition-all duration-500 hover:scale-[1.02] overflow-visible flex flex-col">
            {/* Most Popular Badge */}
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-6 py-2 bg-gradient-to-r from-cyan-600 to-cyan-400 rounded-full text-white text-xs font-bold shadow-2xl shadow-cyan-500/60 uppercase tracking-wider z-10">
              ⭐ MOST POPULAR
            </div>

            {/* Holographic overlay - stronger */}
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-400/30 via-purple-500/20 to-pink-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none rounded-2xl"></div>
            <div className="absolute inset-0 bg-gradient-to-tl from-pink-500/20 via-cyan-500/20 to-purple-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none rounded-2xl"></div>

            <div className="relative flex flex-col flex-grow">
              <div className="mb-8">
                <div className="flex items-center gap-2 mb-4">
                  <div className="inline-block px-3 py-1.5 bg-gradient-to-r from-cyan-500/20 to-purple-500/20 border border-cyan-400/50 rounded-full">
                    <span className="text-cyan-200 text-xs font-bold uppercase tracking-wider">PRO</span>
                  </div>
                  {userSubscription?.status === 'active' && userSubscription?.plan === 'pro' && (
                    <div className="inline-block px-3 py-1.5 bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-400/50 rounded-full">
                      <span className="text-green-300 text-xs font-bold uppercase tracking-wider">✓ CURRENT PLAN</span>
                    </div>
                  )}
                </div>
                <p className="text-cyan-400/50 text-xs">For professionals</p>
              </div>

              <div className="mb-8">
                <div className="flex items-baseline gap-1 mb-2">
                  <span className="text-5xl font-black bg-gradient-to-br from-white via-cyan-200 to-purple-200 bg-clip-text text-transparent">
                    {currency === 'INR' ? '₹' : '$'}{prices.pro[billingCycle][currency].toLocaleString()}
                  </span>
                  <span className="text-cyan-400/40 text-xs">
                    /{billingCycle === 'monthly' ? 'mo' : 'yr'}
                  </span>
                </div>
                {billingCycle === 'annual' && (
                  <div className="inline-block px-2 py-0.5 bg-cyan-500/15 border border-cyan-400/40 rounded-full">
                    <span className="text-cyan-300 text-[10px] font-bold">SAVE 19%</span>
                  </div>
                )}
              </div>

              <ul className="space-y-4 mb-10 flex-grow">
                <li className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-gradient-to-br from-cyan-500/40 to-purple-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="w-3 h-3 text-cyan-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path>
                    </svg>
                  </div>
                  <span className="text-gray-300 text-xs leading-relaxed"><span className="font-bold text-white">600 credits</span> per month</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-gradient-to-br from-cyan-500/40 to-purple-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="w-3 h-3 text-cyan-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path>
                    </svg>
                  </div>
                  <span className="text-gray-300 text-xs leading-relaxed">~300 songs or 600 cover art</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-gradient-to-br from-cyan-500/40 to-purple-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="w-3 h-3 text-cyan-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path>
                    </svg>
                  </div>
                  <span className="text-gray-300 text-xs leading-relaxed">Commercial license</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-gradient-to-br from-cyan-500/40 to-purple-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="w-3 h-3 text-cyan-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path>
                    </svg>
                  </div>
                  <span className="text-gray-300 text-xs leading-relaxed">Premium support</span>
                </li>
              </ul>

              <button
                onClick={() => handleSubscribe('pro')}
                disabled={loadingPlan === 'pro' || (userSubscription?.plan === 'pro' && userSubscription?.status === 'active')}
                className={`w-full py-4 px-4 rounded-xl font-bold transition-all duration-300 shadow-lg text-sm flex items-center justify-center gap-2 ${
                  userSubscription?.plan === 'pro' && userSubscription?.status === 'active'
                    ? 'bg-green-600/30 text-green-300 border-2 border-green-400/50 cursor-not-allowed'
                    : 'bg-gradient-to-r from-cyan-600 to-cyan-400 text-white shadow-cyan-500/40 group-hover:scale-105 hover:from-cyan-700 hover:to-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed'
                }`}
              >
                {userSubscription?.plan === 'pro' && userSubscription?.status === 'active' ? (
                  '✓ Current Plan'
                ) : loadingPlan === 'pro' ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>{currency === 'USD' ? 'Opening checkout...' : 'Creating payment link...'}</span>
                  </>
                ) : (
                  'Get Started'
                )}
              </button>
            </div>
          </div>

          {/* Studio Plan */}
          <div className="group relative backdrop-blur-xl bg-black/60 border border-cyan-500/40 rounded-2xl p-8 pt-12 hover:border-cyan-400/80 transition-all duration-500 hover:scale-[1.02] overflow-hidden flex flex-col">
            {/* Holographic overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-purple-400/20 via-transparent to-pink-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"></div>
            <div className="absolute inset-0 bg-gradient-to-tl from-cyan-500/10 via-transparent to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>

            <div className="relative flex flex-col flex-grow">
              <div className="mb-8">
                <div className="flex items-center gap-2 mb-4">
                  <div className="inline-block px-3 py-1.5 bg-purple-500/20 border border-purple-400/50 rounded-full">
                    <span className="text-purple-200 text-xs font-bold uppercase tracking-wider">STUDIO</span>
                  </div>
                  {userSubscription?.status === 'active' && userSubscription?.plan === 'studio' && (
                    <div className="inline-block px-3 py-1.5 bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-400/50 rounded-full">
                      <span className="text-green-300 text-xs font-bold uppercase tracking-wider">✓ CURRENT PLAN</span>
                    </div>
                  )}
                </div>
                <p className="text-cyan-400/50 text-xs">Unlimited everything</p>
              </div>

              <div className="mb-8">
                <div className="flex items-baseline gap-1 mb-2">
                  <span className="text-5xl font-black bg-gradient-to-br from-white via-purple-200 to-pink-200 bg-clip-text text-transparent">
                    {currency === 'INR' ? '₹' : '$'}{prices.studio[billingCycle][currency].toLocaleString()}
                  </span>
                  <span className="text-cyan-400/40 text-xs">
                    /{billingCycle === 'monthly' ? 'mo' : 'yr'}
                  </span>
                </div>
                {billingCycle === 'annual' && (
                  <div className="inline-block px-2 py-0.5 bg-cyan-500/15 border border-cyan-400/40 rounded-full">
                    <span className="text-cyan-300 text-[10px] font-bold">SAVE 4%</span>
                  </div>
                )}
              </div>

              <ul className="space-y-4 mb-10 flex-grow">
                <li className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-500/30 to-pink-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="w-3 h-3 text-purple-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path>
                    </svg>
                  </div>
                  <span className="text-gray-300 text-xs leading-relaxed"><span className="font-bold text-white">1,500 credits</span> per month</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-500/30 to-pink-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="w-3 h-3 text-purple-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path>
                    </svg>
                  </div>
                  <span className="text-gray-300 text-xs leading-relaxed">~750 songs or 1,500 cover art</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-500/30 to-pink-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="w-3 h-3 text-purple-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path>
                    </svg>
                  </div>
                  <span className="text-gray-300 text-xs leading-relaxed">Enterprise license</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-500/30 to-pink-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="w-3 h-3 text-purple-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path>
                    </svg>
                  </div>
                  <span className="text-gray-300 text-xs leading-relaxed">Dedicated support</span>
                </li>
              </ul>

              <button
                onClick={() => handleSubscribe('studio')}
                disabled={loadingPlan === 'studio' || (userSubscription?.plan === 'studio' && userSubscription?.status === 'active')}
                className={`w-full py-4 px-4 rounded-xl font-bold transition-all duration-300 shadow-lg text-sm flex items-center justify-center gap-2 ${
                  userSubscription?.plan === 'studio' && userSubscription?.status === 'active'
                    ? 'bg-green-600/30 text-green-300 border-2 border-green-400/50 cursor-not-allowed'
                    : 'bg-gradient-to-r from-cyan-600 to-cyan-400 text-white shadow-cyan-500/40 group-hover:scale-105 hover:from-cyan-700 hover:to-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed'
                }`}
              >
                {userSubscription?.plan === 'studio' && userSubscription?.status === 'active' ? (
                  '✓ Current Plan'
                ) : loadingPlan === 'studio' ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>{currency === 'USD' ? 'Opening checkout...' : 'Creating payment link...'}</span>
                  </>
                ) : (
                  'Get Started'
                )}
              </button>
                ) : loadingPlan === 'studio' ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Creating payment link...</span>
                  </>
                ) : (
                  'Get Started'
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Buy Credits Section */}
        <div className="mb-24">
          <div className="bg-black/60 border border-cyan-500/40 rounded-2xl p-8 shadow-xl shadow-cyan-500/20">
            <div className="text-center mb-8">
              <h2 className="text-3xl md:text-4xl font-black text-white mb-2">Buy Credits</h2>
              <p className="text-cyan-400/60 text-sm">No subscription needed • Pay as you go</p>
            </div>

            <div className="max-w-3xl mx-auto">
              {/* Amount Display */}
              <div className="text-center mb-8">
                <div className="inline-block bg-black/80 backdrop-blur-xl border border-cyan-500/50 rounded-2xl p-8 mb-6 shadow-lg shadow-cyan-500/30">
                  <div className="flex items-baseline justify-center gap-2 mb-2">
                    <span className="text-6xl font-black bg-gradient-to-br from-white via-cyan-200 to-purple-200 bg-clip-text text-transparent">
                      ${creditAmount}
                    </span>
                  </div>
                  <div className="text-cyan-400/50 text-xs mb-4">purchase amount</div>
                  <div className="border-t border-cyan-500/30 pt-4 mt-4">
                    <div className="text-4xl font-black text-cyan-400 mb-2">
                      {creditsFromDollars.toLocaleString()} credits
                    </div>
                    <div className="text-cyan-400/50 text-xs">
                      ≈ {Math.floor(creditsFromDollars / 2)} songs or {creditsFromDollars} covers
                    </div>
                  </div>
                </div>
              </div>

              {/* Slider */}
              <div className="mb-8">
                <input
                  type="range"
                  min="0"
                  max="50"
                  step="5"
                  value={creditAmount}
                  onChange={(e) => setCreditAmount(Number(e.target.value))}
                  className="w-full h-3 bg-cyan-950/30 rounded-lg appearance-none cursor-pointer 
                    [&::-webkit-slider-thumb]:appearance-none 
                    [&::-webkit-slider-thumb]:w-7
                    [&::-webkit-slider-thumb]:h-7
                    [&::-webkit-slider-thumb]:rounded-full 
                    [&::-webkit-slider-thumb]:bg-gradient-to-r 
                    [&::-webkit-slider-thumb]:from-cyan-500 
                    [&::-webkit-slider-thumb]:to-cyan-400
                    [&::-webkit-slider-thumb]:cursor-pointer
                    [&::-webkit-slider-thumb]:shadow-xl
                    [&::-webkit-slider-thumb]:shadow-cyan-500/60
                    [&::-webkit-slider-thumb]:hover:scale-110
                    [&::-webkit-slider-thumb]:transition-transform
                    [&::-webkit-slider-thumb]:border-2
                    [&::-webkit-slider-thumb]:border-white/20
                    [&::-moz-range-thumb]:w-7
                    [&::-moz-range-thumb]:h-7
                    [&::-moz-range-thumb]:rounded-full 
                    [&::-moz-range-thumb]:bg-gradient-to-r 
                    [&::-moz-range-thumb]:from-cyan-500 
                    [&::-moz-range-thumb]:to-cyan-400
                    [&::-moz-range-thumb]:border-0
                    [&::-moz-range-thumb]:cursor-pointer
                    [&::-moz-range-thumb]:shadow-xl
                    [&::-moz-range-thumb]:shadow-cyan-500/60"
                  style={{
                    background: `linear-gradient(to right, rgb(34 211 238 / 0.5) 0%, rgb(34 211 238 / 0.5) ${(creditAmount / 50) * 100}%, rgb(8 51 68 / 0.3) ${(creditAmount / 50) * 100}%, rgb(8 51 68 / 0.3) 100%)`
                  }}
                />
                
                {/* Slider Labels */}
                <div className="flex justify-between mt-3 px-1">
                  {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50].map((value) => (
                    <button
                      key={value}
                      onClick={() => setCreditAmount(value)}
                      className={`text-[10px] transition-all duration-300 ${
                        creditAmount === value 
                          ? 'text-cyan-400 font-bold scale-110' 
                          : 'text-cyan-400/30 hover:text-cyan-400/60'
                      }`}
                    >
                      ${value}
                    </button>
                  ))}
                </div>
              </div>

              {/* Purchase Button */}
              <div className="text-center">
                <button 
                  disabled={creditAmount === 0}
                  className={`px-10 py-4 rounded-xl font-bold text-sm transition-all duration-300 ${
                    creditAmount === 0
                      ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                      : 'bg-gradient-to-r from-cyan-600 to-cyan-400 text-white hover:from-cyan-700 hover:to-cyan-500 shadow-lg shadow-cyan-500/40 hover:scale-105'
                  }`}
                >
                  {creditAmount === 0 ? 'select amount' : `cop ${creditsFromDollars.toLocaleString()} credits for $${creditAmount}`}
                </button>
                <p className="text-cyan-400/40 text-xs mt-4">
                  1 credit = $0.04
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Call to Action */}
        <div className="text-center bg-black/60 border border-cyan-500/40 rounded-2xl p-12 mb-16 shadow-lg shadow-cyan-500/20">
          <h2 className="text-3xl md:text-4xl font-black text-white mb-3">Ready to make fire music?</h2>
          <p className="text-cyan-400/60 text-sm mb-8 max-w-2xl mx-auto">
            Join thousands creating with AI • Risk-free fr fr
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/create">
              <button className="px-8 py-3 bg-gradient-to-r from-cyan-600 to-cyan-400 text-white rounded-xl font-bold text-sm hover:from-cyan-700 hover:to-cyan-500 transition-all duration-300 shadow-lg shadow-cyan-500/40 hover:scale-105">
                Let's Go
              </button>
            </Link>
            <Link href="/decrypt">
              <button className="px-8 py-3 bg-white/5 border border-white/20 text-white rounded-xl font-bold text-sm hover:bg-white/10 transition-all duration-300">
                Try Free
              </button>
            </Link>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-16 text-center">
          <p className="text-cyan-400/60 text-xs mb-3">
            high-quality AI music • flex billing • cancel anytime
          </p>
          <p className="text-cyan-400/60 text-xs mb-2">
            <strong>credits:</strong> 1 song = 2 credits • 1 cover = 1 credit
          </p>

          {/* Privacy Policy Button */}
          <button
            onClick={() => setShowPolicyModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 mt-4 mb-2 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 rounded-full text-cyan-400 text-xs transition-all duration-300 hover:scale-105"
          >
            <Shield className="w-4 h-4" />
            Privacy & Policies
          </button>

          <p className="text-cyan-400/40 text-[10px] mt-2">
            questions? hit us up → 444radioog@gmail.com • © 2025 444RADIO
          </p>

          {/* Social Media Links */}
          <div className="mt-6 flex justify-center gap-6">
            <a
              href="https://youtube.com/@444radioog?si=k0Def96c20mleUbS"
              target="_blank"
              rel="noopener noreferrer"
              className="text-cyan-400/50 hover:text-cyan-400 transition-colors duration-300 hover:scale-110"
              aria-label="Follow us on YouTube"
            >
              <Youtube className="w-5 h-5" />
            </a>
            <a
              href="https://www.instagram.com/444radioog"
              target="_blank"
              rel="noopener noreferrer"
              className="text-cyan-400/50 hover:text-cyan-400 transition-colors duration-300 hover:scale-110"
              aria-label="Follow us on Instagram"
            >
              <Instagram className="w-5 h-5" />
            </a>
            <a
              href="https://discord.gg/6EknNvSJJ"
              target="_blank"
              rel="noopener noreferrer"
              className="text-cyan-400/50 hover:text-cyan-400 transition-colors duration-300 hover:scale-110"
              aria-label="Join our Discord"
            >
              <DiscordIcon className="w-5 h-5" />
            </a>
            <a
              href="mailto:444radioog@gmail.com"
              className="text-cyan-400/50 hover:text-cyan-400 transition-colors duration-300 hover:scale-110"
              aria-label="Email us"
            >
              <Mail className="w-5 h-5" />
            </a>
          </div>
        </div>
      </div>

      {/* Privacy Policy Modal */}
      {showPolicyModal && (
        <div 
          className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setShowPolicyModal(false)}
        >
          <div 
            className="bg-gradient-to-br from-gray-900 to-black border border-cyan-500/30 rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto shadow-2xl shadow-cyan-500/20"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-gradient-to-br from-gray-900 to-black border-b border-cyan-500/30 p-6 flex items-center justify-between z-10">
              <div className="flex items-center gap-3">
                <Shield className="w-6 h-6 text-cyan-400" />
                <h2 className="text-2xl font-bold text-white">Privacy & Policies</h2>
              </div>
              <button
                onClick={() => setShowPolicyModal(false)}
                className="text-cyan-400/60 hover:text-cyan-400 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Terms and Conditions */}
              <div className="bg-black/40 border border-cyan-500/20 rounded-xl p-5 hover:border-cyan-500/40 transition-all duration-300">
                <h3 className="text-lg font-semibold text-cyan-400 mb-2 flex items-center gap-2">
                  📜 Terms and Conditions
                </h3>
                <p className="text-cyan-400/60 text-sm mb-3">Created by Razorpay</p>
                <a
                  href="https://merchant.razorpay.com/policy/Rr3bqOPXbMyRLk/terms"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-cyan-400 hover:text-cyan-300 text-sm font-medium transition-colors"
                >
                  View Terms →
                </a>
              </div>

              {/* Privacy Policy */}
              <div className="bg-black/40 border border-cyan-500/20 rounded-xl p-5 hover:border-cyan-500/40 transition-all duration-300">
                <h3 className="text-lg font-semibold text-cyan-400 mb-2 flex items-center gap-2">
                  🔒 Privacy Policy
                </h3>
                <p className="text-cyan-400/60 text-sm mb-3">Created by Razorpay</p>
                <a
                  href="https://merchant.razorpay.com/policy/Rr3bqOPXbMyRLk/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-cyan-400 hover:text-cyan-300 text-sm font-medium transition-colors"
                >
                  View Privacy Policy →
                </a>
              </div>

              {/* Cancellations and Refunds */}
              <div className="bg-black/40 border border-cyan-500/20 rounded-xl p-5 hover:border-cyan-500/40 transition-all duration-300">
                <h3 className="text-lg font-semibold text-cyan-400 mb-2 flex items-center gap-2">
                  💳 Cancellations and Refunds
                </h3>
                <p className="text-cyan-400/60 text-sm mb-3">Created by Razorpay</p>
                <a
                  href="https://merchant.razorpay.com/policy/Rr3bqOPXbMyRLk/refund"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-cyan-400 hover:text-cyan-300 text-sm font-medium transition-colors"
                >
                  View Refund Policy →
                </a>
              </div>

              {/* Shipping Policy */}
              <div className="bg-black/40 border border-cyan-500/20 rounded-xl p-5 hover:border-cyan-500/40 transition-all duration-300">
                <h3 className="text-lg font-semibold text-cyan-400 mb-2 flex items-center gap-2">
                  📦 Shipping Policy
                </h3>
                <p className="text-cyan-400/60 text-sm mb-3">Created by Razorpay</p>
                <a
                  href="https://merchant.razorpay.com/policy/Rr3bqOPXbMyRLk/shipping"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-cyan-400 hover:text-cyan-300 text-sm font-medium transition-colors"
                >
                  View Shipping Policy →
                </a>
              </div>

              {/* Contact Us */}
              <div className="bg-black/40 border border-cyan-500/20 rounded-xl p-5 hover:border-cyan-500/40 transition-all duration-300">
                <h3 className="text-lg font-semibold text-cyan-400 mb-2 flex items-center gap-2">
                  📧 Contact Us
                </h3>
                <p className="text-cyan-400/60 text-sm mb-3">Created by Razorpay</p>
                <a
                  href="https://merchant.razorpay.com/policy/Rr3bqOPXbMyRLk/contact_us"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-cyan-400 hover:text-cyan-300 text-sm font-medium transition-colors"
                >
                  Contact Us →
                </a>
              </div>

              {/* Close Button */}
              <button
                onClick={() => setShowPolicyModal(false)}
                className="w-full py-3 bg-gradient-to-r from-cyan-600 to-cyan-400 text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-cyan-500/40 transition-all duration-300 hover:scale-105"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
