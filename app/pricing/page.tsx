'use client'

import { useState, useEffect } from 'react'
import { useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { useCredits } from '../contexts/CreditsContext'
import Link from 'next/link'
import Script from 'next/script'
import {
  ArrowLeft,
  Zap,
  Wallet,
  Sparkles,
  Shield,
  Info,
  CheckCircle,
  Music,
  Image as ImageIcon,
  Video,
  Scissors,
  Volume2,
  Repeat,
  Wand2,
  X,
  DollarSign,
  AlertTriangle,
} from 'lucide-react'

// ── Constants ──
const GST_RATE = 0.18
const INR_RATE = 91
const CREDIT_RATE = 0.035 // $0.035 per credit

// ── Dollar deposit packs ──
const WALLET_PACKS = [
  { amount: 2,   label: 'Lite',     popular: false },
  { amount: 5,   label: 'Starter',  popular: false },
  { amount: 10,  label: 'Creator',  popular: true },
  { amount: 25,  label: 'Pro',      popular: false },
  { amount: 50,  label: 'Studio',   popular: false },
]

// ── Generation costs ──
const GENERATION_COSTS = [
  { name: 'Song',          credits: 2,  icon: Music },
  { name: 'Cover Art',     credits: 1,  icon: ImageIcon },
  { name: 'Sound Effect',  credits: 2,  icon: Sparkles },
  { name: 'Stem Split',    credits: 5,  icon: Scissors },
  { name: 'Loops',         credits: 7,  icon: Repeat },
  { name: 'Audio Boost',   credits: 1,  icon: Volume2 },
  { name: 'Extract Audio', credits: 1,  icon: Wand2 },
  { name: 'Video→Audio',   credits: 2,  icon: Video },
]

function calcCharge(amountUsd: number, currency: 'INR' | 'USD') {
  const gst = amountUsd * GST_RATE
  const total = amountUsd + gst
  if (currency === 'INR') {
    return { base: amountUsd * INR_RATE, gst: gst * INR_RATE, total: total * INR_RATE, symbol: '₹' }
  }
  return { base: amountUsd, gst, total, symbol: '$' }
}

export default function PricingPage() {
  const { user, isLoaded } = useUser()
  const router = useRouter()
  const { credits: currentCredits, walletBalance, refreshCredits } = useCredits()

  const [currency, setCurrency] = useState<'INR' | 'USD'>('INR')
  const [customAmount, setCustomAmount] = useState(10)
  const [isPurchasing, setIsPurchasing] = useState(false)
  const [purchaseMessage, setPurchaseMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [showCostModal, setShowCostModal] = useState(false)

  useEffect(() => {
    if (isLoaded && !user) router.push('/sign-in')
  }, [isLoaded, user, router])

  // ── Deposit handler ──
  const handleDeposit = async (amountUsd: number) => {
    if (isPurchasing) return
    setIsPurchasing(true)
    setPurchaseMessage(null)

    try {
      // 1. Create Razorpay order for wallet deposit
      const orderRes = await fetch('/api/credits/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount_usd: amountUsd, currency }),
      })
      const orderData = await orderRes.json()

      if (!orderRes.ok || !orderData.success) {
        throw new Error(orderData.error || 'Failed to create order')
      }

      // 2. Open Razorpay Checkout
      const rzp = new (window as any).Razorpay({
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        name: '444 Radio',
        description: `Add $${amountUsd} to Wallet`,
        order_id: orderData.orderId,
        prefill: {
          email: orderData.customerEmail,
          name: orderData.customerName,
        },
        handler: async (response: any) => {
          // 3. Verify + deposit + auto-convert
          try {
            const verifyRes = await fetch('/api/credits/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }),
            })
            const verifyData = await verifyRes.json()

            if (verifyData.success) {
              const msg = verifyData.creditsAdded > 0
                ? `+$${amountUsd} deposited → ${verifyData.creditsAdded} credits added! Wallet: $${verifyData.walletBalance.toFixed(2)}`
                : `+$${amountUsd} deposited to wallet. Balance: $${verifyData.walletBalance.toFixed(2)}`
              setPurchaseMessage({ type: 'success', text: msg })
              refreshCredits()
              window.dispatchEvent(new Event('credits:refresh'))
            } else {
              throw new Error(verifyData.error || 'Verification failed')
            }
          } catch {
            setPurchaseMessage({
              type: 'error',
              text: 'Payment received but verification pending. Funds will appear within a minute.',
            })
          }
          setIsPurchasing(false)
        },
        modal: {
          ondismiss: () => setIsPurchasing(false),
        },
        theme: { color: '#06b6d4' },
      })
      rzp.open()
    } catch (err: any) {
      setPurchaseMessage({ type: 'error', text: err.message || 'Deposit failed' })
      setIsPurchasing(false)
    }
  }

  if (!isLoaded || !user) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center md:pl-20 md:pr-28">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-500" />
      </div>
    )
  }

  const hasAccess = (walletBalance ?? 0) >= 1

  return (
    <main className="min-h-screen bg-black text-white relative overflow-hidden md:pl-20 md:pr-28">
      <div className="absolute inset-0 bg-gradient-to-br from-cyan-950/20 via-black to-black pointer-events-none" />

      <div className="max-w-5xl mx-auto relative z-10 px-6 py-12">
        {/* Back nav */}
        <Link
          href="/explore"
          className="group flex items-center gap-2 text-cyan-400/60 hover:text-cyan-400 transition-colors duration-300 mb-8"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm font-medium">Back to Explore</span>
        </Link>

        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-4xl md:text-5xl font-bold mb-3 bg-gradient-to-r from-cyan-400 via-white to-cyan-300 bg-clip-text text-transparent">
            Add Money
          </h1>
          <p className="text-gray-400 max-w-xl mx-auto">
            Deposit dollars to your wallet. $1 stays as your access fee — the rest auto-converts to credits at 1 credit = ${CREDIT_RATE}. No subscriptions.
          </p>

          {/* Current balance strip */}
          <div className="flex items-center justify-center gap-4 mt-5 flex-wrap">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-full">
              <DollarSign className="w-4 h-4 text-green-400" />
              <span className="text-sm text-gray-300">Wallet:</span>
              <span className="text-sm font-bold text-green-400">
                ${(walletBalance ?? 0).toFixed(2)}
              </span>
            </div>
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-full">
              <Zap className="w-4 h-4 text-cyan-400" />
              <span className="text-sm text-gray-300">Credits:</span>
              <span className="text-sm font-bold text-cyan-400">{currentCredits ?? 0}</span>
            </div>
            {!hasAccess && (
              <div className="inline-flex items-center gap-2 px-3 py-2 bg-amber-500/10 border border-amber-500/30 rounded-full">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <span className="text-xs text-amber-300">Add at least $1 to start generating</span>
              </div>
            )}
          </div>
        </div>

        {/* Currency toggle */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex bg-white/5 border border-white/10 rounded-full p-1">
            <button
              onClick={() => setCurrency('INR')}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
                currency === 'INR' ? 'bg-cyan-500 text-black' : 'text-gray-400 hover:text-white'
              }`}
            >
              ₹ INR
            </button>
            <button
              onClick={() => setCurrency('USD')}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
                currency === 'USD' ? 'bg-cyan-500 text-black' : 'text-gray-400 hover:text-white'
              }`}
            >
              $ USD
            </button>
          </div>
        </div>

        {/* Success / Error banner */}
        {purchaseMessage && (
          <div className={`mb-8 p-4 rounded-xl border flex items-start gap-3 ${
            purchaseMessage.type === 'success'
              ? 'bg-green-500/10 border-green-500/30 text-green-400'
              : 'bg-red-500/10 border-red-500/30 text-red-400'
          }`}>
            {purchaseMessage.type === 'success' ? (
              <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            ) : (
              <Info className="w-5 h-5 flex-shrink-0 mt-0.5" />
            )}
            <p className="text-sm">{purchaseMessage.text}</p>
            <button onClick={() => setPurchaseMessage(null)} className="ml-auto">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ── Dollar Deposit Packs ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
          {WALLET_PACKS.map((pack) => {
            const charge = calcCharge(pack.amount, currency)
            const maxCredits = Math.floor(pack.amount / CREDIT_RATE)
            return (
              <div
                key={pack.amount}
                className={`relative bg-white/5 backdrop-blur-xl border rounded-2xl p-6 transition-all hover:border-cyan-500/40 hover:bg-white/[0.07] ${
                  pack.popular ? 'border-cyan-500/40 ring-1 ring-cyan-500/20' : 'border-white/10'
                }`}
              >
                {pack.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-cyan-500 text-black text-xs font-bold rounded-full">
                    Most Popular
                  </div>
                )}
                <div className="mb-4">
                  <p className="text-sm text-gray-400 font-medium">{pack.label}</p>
                  <p className="text-3xl font-bold mt-1">
                    <span className="text-green-400">${pack.amount}</span>
                    <span className="text-sm text-gray-500 ml-1">deposit</span>
                  </p>
                </div>
                <div className="mb-5 space-y-1">
                  <p className="text-sm text-cyan-400 font-semibold">
                    Up to {maxCredits.toLocaleString()} credits
                  </p>
                  <p className="text-2xl font-bold">
                    {charge.symbol}{charge.total.toFixed(2)}
                  </p>
                  <p className="text-xs text-gray-500">
                    {charge.symbol}{charge.base.toFixed(2)} + {charge.symbol}{charge.gst.toFixed(2)} GST
                  </p>
                </div>
                <button
                  onClick={() => handleDeposit(pack.amount)}
                  disabled={isPurchasing}
                  className={`w-full py-3 rounded-xl font-semibold text-sm transition-all disabled:opacity-50 ${
                    pack.popular
                      ? 'bg-gradient-to-r from-cyan-500 to-teal-500 text-black hover:from-cyan-400 hover:to-teal-400'
                      : 'bg-white/10 hover:bg-white/15 text-white border border-white/10'
                  }`}
                >
                  {isPurchasing ? 'Processing...' : 'Add to Wallet'}
                </button>
              </div>
            )
          })}

          {/* Custom amount card */}
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 sm:col-span-2 lg:col-span-3">
            <div className="flex flex-col md:flex-row md:items-center gap-6">
              <div className="flex-1">
                <p className="text-sm text-gray-400 font-medium mb-1">Custom Amount</p>
                <p className="text-lg font-bold text-white mb-3">
                  Deposit ${customAmount} — up to {Math.floor(customAmount / CREDIT_RATE).toLocaleString()} credits
                </p>
                <input
                  type="range"
                  min={1}
                  max={100}
                  step={1}
                  value={customAmount}
                  onChange={(e) => setCustomAmount(Number(e.target.value))}
                  className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer accent-cyan-500"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>$1</span>
                  <span>$25</span>
                  <span>$50</span>
                  <span>$100</span>
                </div>
              </div>
              <div className="text-center md:text-right md:min-w-[200px]">
                {(() => {
                  const charge = calcCharge(customAmount, currency)
                  return (
                    <>
                      <p className="text-3xl font-bold">{charge.symbol}{charge.total.toFixed(2)}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {charge.symbol}{charge.base.toFixed(2)} + {charge.symbol}{charge.gst.toFixed(2)} GST
                      </p>
                      <button
                        onClick={() => handleDeposit(customAmount)}
                        disabled={isPurchasing}
                        className="mt-3 px-8 py-3 bg-gradient-to-r from-cyan-500 to-teal-500 text-black rounded-xl font-semibold text-sm hover:from-cyan-400 hover:to-teal-400 transition-all disabled:opacity-50"
                      >
                        {isPurchasing ? 'Processing...' : `Add $${customAmount} to Wallet`}
                      </button>
                    </>
                  )
                })()}
              </div>
            </div>
          </div>
        </div>

        {/* ── How it works ── */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-10">
          <h3 className="text-sm font-semibold text-gray-300 mb-4">How it works</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-500/20 border border-green-500/40 flex items-center justify-center text-xs font-bold text-green-400">1</div>
              <div>
                <p className="text-sm font-medium text-white">Add money</p>
                <p className="text-xs text-gray-500">Deposit via Razorpay. 18% GST charged on top.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-xs font-bold text-cyan-400">2</div>
              <div>
                <p className="text-sm font-medium text-white">$1 access stays</p>
                <p className="text-xs text-gray-500">$1 minimum wallet balance is required for app access.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-xs font-bold text-purple-400">3</div>
              <div>
                <p className="text-sm font-medium text-white">Auto-convert</p>
                <p className="text-xs text-gray-500">Remaining balance auto-converts to credits at $0.035/credit.</p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Generation Costs ── */}
        <div className="mb-10">
          <button
            onClick={() => setShowCostModal(true)}
            className="flex items-center gap-2 mx-auto text-sm text-cyan-400/70 hover:text-cyan-400 transition-colors"
          >
            <Info className="w-4 h-4" />
            What does each generation cost?
          </button>
        </div>

        {/* ── Trust ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
          <div className="bg-white/5 border border-white/10 rounded-xl p-5 text-center">
            <DollarSign className="w-6 h-6 text-green-400 mx-auto mb-2" />
            <p className="text-sm font-semibold">$1 Access App</p>
            <p className="text-xs text-gray-500 mt-1">Keep $1 in your wallet to use all features. Pay per usage.</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-5 text-center">
            <Shield className="w-6 h-6 text-cyan-400 mx-auto mb-2" />
            <p className="text-sm font-semibold">Secure Payments</p>
            <p className="text-xs text-gray-500 mt-1">Powered by Razorpay. Cards, UPI, wallets accepted.</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-5 text-center">
            <Sparkles className="w-6 h-6 text-cyan-400 mx-auto mb-2" />
            <p className="text-sm font-semibold">Instant Credits</p>
            <p className="text-xs text-gray-500 mt-1">Deposits auto-convert to credits immediately.</p>
          </div>
        </div>

        {/* Policies */}
        <div className="text-center text-xs text-gray-600 space-y-1">
          <p>All prices include 18% GST. INR prices calculated at approx. ₹{INR_RATE}/USD.</p>
          <p>Credits are non-refundable and non-transferable. They never expire.</p>
          <p>
            <Link href="/terms" className="text-cyan-400/50 hover:text-cyan-400 underline">Terms</Link>
            {' · '}
            <Link href="/privacy" className="text-cyan-400/50 hover:text-cyan-400 underline">Privacy</Link>
            {' · '}
            <Link href="/refunds" className="text-cyan-400/50 hover:text-cyan-400 underline">Refund Policy</Link>
          </p>
        </div>
      </div>

      {/* ── Generation Cost Modal ── */}
      {showCostModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowCostModal(false)}>
          <div className="bg-gray-900 border border-white/10 rounded-2xl p-8 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold">Generation Costs</h3>
              <button onClick={() => setShowCostModal(false)} className="p-2 hover:bg-white/10 rounded-lg">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="space-y-3">
              {GENERATION_COSTS.map((item) => (
                <div key={item.name} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white/5 rounded-lg">
                      <item.icon className="w-4 h-4 text-cyan-400" />
                    </div>
                    <span className="text-sm">{item.name}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold text-cyan-400">{item.credits} cr</span>
                    <span className="text-xs text-gray-500 ml-1">(${(item.credits * CREDIT_RATE).toFixed(3)})</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 p-3 bg-cyan-500/10 border border-cyan-500/20 rounded-xl">
              <p className="text-xs text-cyan-300">
                <strong>Example:</strong> $10 deposit = ~285 credits = ~142 songs or ~285 cover art images.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Razorpay SDK */}
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
    </main>
  )
}
