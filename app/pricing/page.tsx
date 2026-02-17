'use client'

import { useState, useEffect, useCallback } from 'react'
import { useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { useCredits } from '../contexts/CreditsContext'
import Link from 'next/link'
import Script from 'next/script'
import {
  ArrowLeft,
  Zap,
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
  Clock,
  ChevronDown,
  ChevronUp,
  ArrowUpRight,
  ArrowDownRight,
  Lock,
} from 'lucide-react'

// ── Transaction type labels ──
const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  generation_music: { label: 'Song', color: 'text-pink-400' },
  generation_effects: { label: 'SFX', color: 'text-orange-400' },
  generation_loops: { label: 'Loops', color: 'text-purple-400' },
  generation_image: { label: 'Image', color: 'text-blue-400' },
  generation_video_to_audio: { label: 'Video→Audio', color: 'text-yellow-400' },
  generation_cover_art: { label: 'Cover Art', color: 'text-emerald-400' },
  generation_stem_split: { label: 'Stem Split', color: 'text-red-400' },
  generation_audio_boost: { label: 'Boost', color: 'text-amber-400' },
  generation_extract: { label: 'Extract', color: 'text-teal-400' },
  earn_list: { label: 'Listed', color: 'text-cyan-400' },
  earn_purchase: { label: 'Purchased', color: 'text-red-400' },
  earn_sale: { label: 'Sale', color: 'text-green-400' },
  earn_admin: { label: 'Reward', color: 'text-green-400' },
  credit_award: { label: 'Awarded', color: 'text-green-400' },
  credit_refund: { label: 'Refund', color: 'text-amber-400' },
  wallet_deposit: { label: 'Deposit', color: 'text-green-400' },
  wallet_conversion: { label: 'Converted', color: 'text-cyan-400' },
  subscription_bonus: { label: 'Sub Bonus', color: 'text-emerald-400' },
  plugin_purchase: { label: 'Plugin', color: 'text-purple-400' },
  code_claim: { label: 'Code', color: 'text-green-400' },
  release: { label: 'Release', color: 'text-cyan-400' },
  other: { label: 'Other', color: 'text-gray-400' },
}

interface Transaction {
  id: string
  type: string
  status: string
  amount: number
  balance_after: number | null
  description: string
  created_at: string
}

// ── Constants ──
const GST_RATE = 0.18
const INR_RATE = 91
const CREDIT_RATE = 0.035 // $0.035 per credit
const PAYPAL_FEE_RATE = 0.044 // 4.4% PayPal fee for receiving international payments in India

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
  { name: 'Stem Split',    credits: '0-5', icon: Scissors },
  { name: 'Loops',         credits: 7,  icon: Repeat },
  { name: 'Audio Boost',   credits: 1,  icon: Volume2 },
  { name: 'Extract Audio', credits: 1,  icon: Wand2 },
  { name: 'Video\u2192Audio',   credits: 4,  icon: Video },
]

function calcCharge(amountUsd: number, currency: 'INR' | 'USD') {
  const baseInr = amountUsd * INR_RATE
  // International (PayPal): base → +4.4% fee → subtotal → +18% GST → total
  const paypalFee = baseInr * PAYPAL_FEE_RATE
  const subtotalIntl = baseInr + paypalFee
  const gstIntl = subtotalIntl * GST_RATE
  const totalIntl = subtotalIntl + gstIntl
  // India domestic: base → +18% GST → total (no PayPal fee)
  const gstIndia = baseInr * GST_RATE
  const totalIndia = baseInr + gstIndia
  const symbol = currency === 'INR' ? '₹' : '$'
  return {
    baseInr, paypalFee, subtotalIntl, gstIntl, totalIntl, gstIndia, totalIndia, symbol,
    // backward-compat (defaults to India domestic path)
    base: currency === 'INR' ? baseInr : amountUsd,
    gst: currency === 'INR' ? gstIndia : amountUsd * GST_RATE,
    total: currency === 'INR' ? totalIndia : amountUsd * (1 + GST_RATE),
  }
}

export default function PricingPage() {
  const { user, isLoaded } = useUser()
  const router = useRouter()
  const { credits: currentCredits, walletBalance, refreshCredits } = useCredits()

  const [currency, setCurrency] = useState<'INR' | 'USD' | 'CREDITS'>('INR')
  const [customAmount, setCustomAmount] = useState(10)
  const [isPurchasing, setIsPurchasing] = useState(false)
  const [isConverting, setIsConverting] = useState(false)
  const [showConvertModal, setShowConvertModal] = useState(false)
  const [convertAmount, setConvertAmount] = useState('')
  const [purchaseMessage, setPurchaseMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [showCostModal, setShowCostModal] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [showFirstTimeModal, setShowFirstTimeModal] = useState(false)
  const [pendingDepositAmount, setPendingDepositAmount] = useState<number | null>(null)

  // $1 is locked as access fee. Calculate how much of a new deposit is convertible.
  const hasAccessFee = (walletBalance ?? 0) >= 1
  const calcRealCredits = (depositUsd: number) => {
    if (hasAccessFee) {
      // Already have $1 locked — full deposit converts
      return Math.floor(depositUsd / CREDIT_RATE)
    }
    // First-time: $1 goes to access fee from this deposit
    const lockNeeded = Math.max(0, 1 - (walletBalance ?? 0))
    const convertible = Math.max(0, depositUsd - lockNeeded)
    return Math.floor(convertible / CREDIT_RATE)
  }
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [txnTotal, setTxnTotal] = useState(0)
  const [txnLoading, setTxnLoading] = useState(false)
  const [txnOffset, setTxnOffset] = useState(0)
  const TXN_LIMIT = 20

  const fetchTransactions = useCallback(async (offset = 0) => {
    setTxnLoading(true)
    try {
      const res = await fetch(`/api/credits/history?limit=${TXN_LIMIT}&offset=${offset}`)
      const data = await res.json()
      if (res.ok) {
        setTransactions(offset === 0 ? data.transactions : [...transactions, ...data.transactions])
        setTxnTotal(data.total)
        setTxnOffset(offset)
      }
    } catch { /* ignore */ }
    setTxnLoading(false)
  }, [transactions])

  useEffect(() => {
    if (isLoaded && !user) router.push('/sign-in')
  }, [isLoaded, user, router])

  useEffect(() => {
    if (showHistory && transactions.length === 0) fetchTransactions(0)
  }, [showHistory])

  // ── Convert wallet to credits handler ──
  const LOCKED_WALLET = 1.00  // $1 permanently locked
  const handleConvertSubmit = async () => {
    if (isConverting || isPurchasing) return
    
    const convertible = Math.max(0, (walletBalance ?? 0) - LOCKED_WALLET)
    if (convertible <= 0) {
      setPurchaseMessage({ type: 'error', text: '$1.00 is locked as an access fee. Add more funds to convert.' })
      return
    }

    // Convert input amount to USD (if INR, divide by INR_RATE)
    let amountUsd: number | null = null
    if (convertAmount) {
      const inputAmount = parseFloat(convertAmount)
      if (isNaN(inputAmount) || inputAmount <= 0) {
        setPurchaseMessage({ type: 'error', text: 'Please enter a valid amount' })
        return
      }
      amountUsd = currency === 'INR' ? inputAmount / INR_RATE : inputAmount
      
      if (amountUsd > convertible) {
        const maxDisplay = currency === 'INR' 
          ? `₹${(convertible * INR_RATE).toFixed(2)}`
          : `$${convertible.toFixed(2)}`
        setPurchaseMessage({ type: 'error', text: `Max convertible: ${maxDisplay}. $1 is locked.` })
        return
      }
    }

    setIsConverting(true)
    setPurchaseMessage(null)

    try {
      const res = await fetch('/api/credits/convert', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount_usd: amountUsd })
      })
      const data = await res.json()

      if (res.ok && data.success) {
        const convertedUsd = data.amountConverted
        const displayAmount = currency === 'INR' 
          ? `₹${(convertedUsd * INR_RATE).toFixed(2)}`
          : `$${convertedUsd.toFixed(2)}`
        setPurchaseMessage({
          type: 'success',
          text: `✅ Converted ${displayAmount} → +${data.creditsAdded} credits! You now have ${data.newCredits} total credits.`
        })
        refreshCredits()
        window.dispatchEvent(new Event('credits:refresh'))
        setShowConvertModal(false)
        setConvertAmount('')
      } else {
        throw new Error(data.error || 'Conversion failed')
      }
    } catch (err: any) {
      setPurchaseMessage({
        type: 'error',
        text: err.message || 'Failed to convert wallet balance to credits'
      })
    } finally {
      setIsConverting(false)
    }
  }

  // ── Deposit handler ──
  const handleDeposit = async (amountUsd: number) => {
    if (isPurchasing) return

    // Always show the warm welcome/confirmation modal before checkout
    if (!showFirstTimeModal) {
      setPendingDepositAmount(amountUsd)
      setShowFirstTimeModal(true)
      return
    }

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
          // 3. Verify + deposit to wallet (user converts to credits manually)
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
              setPurchaseMessage({ type: 'success', text: `✅ +$${amountUsd} deposited to wallet! Balance: $${verifyData.walletBalance.toFixed(2)}. Convert to credits when ready.` })
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
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white" />
      </div>
    )
  }

  const hasAccess = (walletBalance ?? 0) >= 1

  return (
    <main className="min-h-screen bg-black text-white relative overflow-hidden md:pl-20 md:pr-28">
      <div className="absolute inset-0 bg-gradient-to-br from-gray-950/30 via-black to-black pointer-events-none" />

      <div className="max-w-5xl mx-auto relative z-10 px-6 py-12">
        {/* Back nav */}
        <Link
          href="/explore"
          className="group flex items-center gap-2 text-gray-500 hover:text-gray-300 transition-colors duration-300 mb-8"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm font-medium">Back to Explore</span>
        </Link>

        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-4xl md:text-5xl font-bold mb-3 bg-gradient-to-r from-white via-gray-300 to-white bg-clip-text text-transparent">
            Add Money
          </h1>
          <p className="text-gray-400 max-w-xl mx-auto">
            Deposit money → convert to credits. 1 credit = ${CREDIT_RATE}. $1 stays locked as access fee.
          </p>

          {/* Info banner: $1 wallet requirement */}
          <div className="mt-5 bg-white/5 border border-white/20 rounded-xl p-4 max-w-2xl mx-auto">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-white flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-white">$1 Locked as Access Fee</p>
                <p className="text-xs text-gray-400 mt-1">
                  Your first $1 is permanently locked in your wallet. Only the balance above $1 can be converted to credits.
                </p>
              </div>
            </div>
          </div>

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
              <Zap className="w-4 h-4 text-white" />
              <span className="text-sm text-gray-300">Credits:</span>
              <span className="text-sm font-bold text-white">{currentCredits ?? 0}</span>
            </div>
            {/* Convert wallet to credits button (only if wallet > $1 locked minimum) */}
            {(walletBalance ?? 0) > 1 && (
              <button
                onClick={() => setShowConvertModal(true)}
                disabled={isPurchasing}
                className="inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-gray-200 text-black rounded-full font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ArrowDownRight className="w-4 h-4" />
                Convert to Credits
              </button>
            )}
            {(walletBalance ?? 0) > 0 && (walletBalance ?? 0) <= 1 && (
              <div className="inline-flex items-center gap-2 px-3 py-2 bg-white/5 border border-white/10 rounded-full">
                <Lock className="w-3.5 h-3.5 text-gray-500" />
                <span className="text-xs text-gray-500">$1 locked as access fee</span>
              </div>
            )}
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
                currency === 'INR' ? 'bg-white text-black' : 'text-gray-400 hover:text-white'
              }`}
            >
              ₹ INR
            </button>
            <button
              onClick={() => setCurrency('USD')}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
                currency === 'USD' ? 'bg-white text-black' : 'text-gray-400 hover:text-white'
              }`}
            >
              $ USD
            </button>
            <button
              onClick={() => setCurrency('CREDITS')}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
                currency === 'CREDITS' ? 'bg-white text-black' : 'text-gray-400 hover:text-white'
              }`}
            >
              ⚡ Credits
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
            const charge = calcCharge(pack.amount, currency === 'CREDITS' ? 'USD' : currency)
            const realCredits = calcRealCredits(pack.amount)
            const maxCredits = Math.floor(pack.amount / CREDIT_RATE)
            const isReduced = realCredits < maxCredits
            return (
              <div
                key={pack.amount}
                className={`relative bg-black/60 backdrop-blur-xl border rounded-2xl p-6 transition-all hover:border-white/30 hover:bg-black/80 ${
                  pack.popular ? 'border-white/30 ring-1 ring-white/20' : 'border-white/10'
                }`}
              >
                {pack.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-white text-black text-xs font-bold rounded-full">
                    Most Popular
                  </div>
                )}
                <div className="mb-3">
                  <p className="text-sm text-gray-400 font-medium">{pack.label}</p>
                  <p className="text-3xl font-bold mt-1">
                    <span className="text-green-400">${pack.amount}</span>
                    <span className="text-sm text-gray-500 ml-1">deposit</span>
                  </p>
                  <p className="text-sm text-gray-300 font-semibold mt-1">
                    {realCredits.toLocaleString()} credits
                  </p>
                  {isReduced && (
                    <p className="text-[10px] text-amber-400 flex items-center gap-1 mt-1">
                      <Lock className="w-3 h-3" />
                      $1 locked as access fee · {maxCredits} after
                    </p>
                  )}
                </div>

                {/* INR Cost Breakdown */}
                <div className="mb-4 p-3 bg-white/[0.03] border border-white/[0.06] rounded-xl space-y-1.5 text-xs">
                  <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider mb-2">₹ Cost Breakdown</p>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Base rate</span>
                    <span className="text-gray-300">${pack.amount} × ₹{INR_RATE} = ₹{charge.baseInr.toFixed(0)}</span>
                  </div>
                  <div className="flex justify-between text-amber-400/80">
                    <span>PayPal fee (4.4%)</span>
                    <span>+₹{charge.paypalFee.toFixed(2)}</span>
                  </div>
                  <div className="border-t border-white/5 pt-1.5 flex justify-between">
                    <span className="text-gray-400">Subtotal</span>
                    <span className="text-gray-300">₹{charge.subtotalIntl.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">GST (18%)</span>
                    <span className="text-gray-300">+₹{charge.gstIntl.toFixed(2)}</span>
                  </div>
                  <div className="border-t border-white/10 pt-1.5 flex justify-between font-semibold">
                    <span className="text-white">Total (Intl)</span>
                    <span className="text-white">₹{charge.totalIntl.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-green-400/90 font-semibold pt-1">
                    <span>🇮🇳 India only</span>
                    <span>₹{charge.totalIndia.toFixed(2)}</span>
                  </div>
                  <p className="text-[10px] text-gray-600 pt-1">India: no PayPal fee, just 18% GST</p>
                </div>

                <button
                  onClick={() => handleDeposit(pack.amount)}
                  disabled={isPurchasing}
                  className={`w-full py-3 rounded-xl font-semibold text-sm transition-all disabled:opacity-50 ${
                    pack.popular
                      ? 'bg-white text-black hover:bg-gray-200'
                      : 'bg-white/10 hover:bg-white/15 text-white border border-white/10'
                  }`}
                >
                  {isPurchasing ? 'Processing...' : 'Add to Wallet'}
                </button>
              </div>
            )
          })}

          {/* Custom amount card */}
          <div className="bg-black/60 backdrop-blur-xl border border-white/20 rounded-2xl p-6 sm:col-span-2 lg:col-span-3">
            <div className="flex flex-col gap-6">
              <div>
                <p className="text-sm text-white font-semibold mb-3">Custom Amount</p>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <label className="text-xs text-gray-400 mb-1.5 block">Amount (USD)</label>
                    <input
                      type="number"
                      min="0.07"
                      max="500"
                      step="0.01"
                      value={customAmount}
                      onChange={(e) => {
                        const val = Number(e.target.value)
                        if (val >= 0.07 && val <= 500) setCustomAmount(val)
                      }}
                      className="w-full px-4 py-3 bg-black/50 border border-white/20 rounded-xl text-white font-semibold text-lg focus:outline-none focus:border-white/40 transition-colors"
                      placeholder="Enter amount"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-gray-400 mb-1.5 block">You&apos;ll Get</label>
                    <div className="px-4 py-3 bg-white/5 border border-white/20 rounded-xl">
                      <p className="text-2xl font-bold text-white">
                        {calcRealCredits(customAmount).toLocaleString()} credits
                      </p>
                      {calcRealCredits(customAmount) < Math.floor(customAmount / CREDIT_RATE) && (
                        <p className="text-[10px] text-amber-400 mt-1 flex items-center gap-1">
                          <Lock className="w-3 h-3" /> $1 locked · {Math.floor(customAmount / CREDIT_RATE)} after
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* INR Cost Breakdown for custom amount */}
              {(() => {
                const charge = calcCharge(customAmount, currency === 'CREDITS' ? 'USD' : currency)
                return (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-3 bg-white/[0.03] border border-white/[0.06] rounded-xl space-y-1.5 text-xs">
                      <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider mb-2">₹ Cost Breakdown</p>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Base rate</span>
                        <span className="text-gray-300">${customAmount} × ₹{INR_RATE} = ₹{charge.baseInr.toFixed(0)}</span>
                      </div>
                      <div className="flex justify-between text-amber-400/80">
                        <span>PayPal fee (4.4%)</span>
                        <span>+₹{charge.paypalFee.toFixed(2)}</span>
                      </div>
                      <div className="border-t border-white/5 pt-1.5 flex justify-between">
                        <span className="text-gray-400">Subtotal</span>
                        <span className="text-gray-300">₹{charge.subtotalIntl.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">GST (18%)</span>
                        <span className="text-gray-300">+₹{charge.gstIntl.toFixed(2)}</span>
                      </div>
                      <div className="border-t border-white/10 pt-1.5 flex justify-between font-semibold">
                        <span className="text-white">Total (Intl)</span>
                        <span className="text-white">₹{charge.totalIntl.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-green-400/90 font-semibold pt-1">
                        <span>🇮🇳 India only</span>
                        <span>₹{charge.totalIndia.toFixed(2)}</span>
                      </div>
                      <p className="text-[10px] text-gray-600 pt-1">India: no PayPal fee, just 18% GST</p>
                    </div>
                    <div className="flex flex-col justify-between">
                      <div>
                        <p className="text-sm text-gray-400">Credits worth ${customAmount} USD</p>
                        <p className="text-3xl font-bold text-white mt-1">{calcRealCredits(customAmount).toLocaleString()} credits</p>
                      </div>
                      <button
                        onClick={() => handleDeposit(customAmount)}
                        disabled={isPurchasing || customAmount < 0.07}
                        className="px-8 py-4 bg-white text-black rounded-xl font-bold text-base hover:bg-gray-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed w-full mt-4"
                      >
                        {isPurchasing ? 'Processing...' : `Buy ${calcRealCredits(customAmount)} Credits`}
                      </button>
                    </div>
                  </div>
                )
              })()}
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
                <p className="text-sm font-medium text-white">Deposit money</p>
                <p className="text-xs text-gray-500">Choose amount in USD. GST included in final price.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-white/20 border border-white/40 flex items-center justify-center text-xs font-bold text-white">2</div>
              <div>
                <p className="text-sm font-medium text-white">Get credits</p>
                <p className="text-xs text-gray-500">Convert balance above $1 to credits at $0.035/credit.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-xs font-bold text-purple-400">3</div>
              <div>
                <p className="text-sm font-medium text-white">Generate content</p>
                <p className="text-xs text-gray-500">$1 stays locked as your access fee. Use credits to generate.</p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Generation Costs ── */}
        <div className="mb-6">
          <button
            onClick={() => setShowCostModal(true)}
            className="flex items-center gap-2 mx-auto text-sm text-gray-400 hover:text-gray-300 transition-colors"
          >
            <Info className="w-4 h-4" />
            What does each generation cost?
          </button>
        </div>

        {/* ── Transaction History ── */}
        <div className="bg-white/5 border border-white/10 rounded-2xl mb-10 overflow-hidden">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="w-full flex items-center justify-between p-5 hover:bg-white/[0.03] transition-colors"
          >
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-gray-400" />
              <span className="text-sm font-semibold text-white">Transaction History</span>
              {txnTotal > 0 && (
                <span className="text-xs text-gray-500 bg-white/5 px-2 py-0.5 rounded-full">{txnTotal}</span>
              )}
            </div>
            {showHistory ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </button>

          {showHistory && (
            <div className="border-t border-white/5">
              {txnLoading && transactions.length === 0 ? (
                <div className="flex items-center justify-center py-10">
                  <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-white" />
                </div>
              ) : transactions.length === 0 ? (
                <p className="text-center text-gray-500 text-sm py-10">No transactions yet</p>
              ) : (
                <>
                  <div className="divide-y divide-white/5">
                    {transactions.map((txn) => {
                      const info = TYPE_LABELS[txn.type] || TYPE_LABELS.other
                      const isPositive = txn.amount > 0
                      const isRefund = txn.type === 'credit_refund'
                      const isFailed = txn.status === 'failed'
                      const dateStr = new Date(txn.created_at).toLocaleString('en-IN', {
                        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true,
                      })
                      return (
                        <div key={txn.id} className={`flex items-center gap-4 px-5 py-3 ${isFailed ? 'opacity-50' : ''}`}>
                          <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${isPositive ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                            {isPositive ? (
                              <ArrowDownRight className="w-4 h-4 text-green-400" />
                            ) : (
                              <ArrowUpRight className="w-4 h-4 text-red-400" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={`text-xs font-medium ${info.color}`}>{info.label}</span>
                              {isFailed && <span className="text-[10px] text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded">Failed</span>}
                              {isRefund && <span className="text-[10px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">Adjustment</span>}
                            </div>
                            <p className="text-xs text-gray-500 truncate mt-0.5">{txn.description || info.label}</p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className={`text-sm font-semibold tabular-nums ${
                              isFailed ? 'text-gray-500' : isPositive ? 'text-green-400' : 'text-red-400'
                            }`}>
                              {isPositive ? '+' : ''}{txn.amount} cr
                            </p>
                            <p className="text-[10px] text-gray-600">{dateStr}</p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  {transactions.length < txnTotal && (
                    <div className="p-4 text-center border-t border-white/5">
                      <button
                        onClick={() => fetchTransactions(txnOffset + TXN_LIMIT)}
                        disabled={txnLoading}
                        className="text-xs text-gray-400 hover:text-gray-300 transition-colors disabled:opacity-50"
                      >
                        {txnLoading ? 'Loading...' : `Load more (${transactions.length} of ${txnTotal})`}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* ── Trust ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
          <div className="bg-white/5 border border-white/10 rounded-xl p-5 text-center">
            <DollarSign className="w-6 h-6 text-green-400 mx-auto mb-2" />
            <p className="text-sm font-semibold">$1 Access Fee</p>
            <p className="text-xs text-gray-500 mt-1">$1 locked permanently as access fee. Cannot be converted or withdrawn.</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-5 text-center">
            <Shield className="w-6 h-6 text-white mx-auto mb-2" />
            <p className="text-sm font-semibold">Secure Payments</p>
            <p className="text-xs text-gray-500 mt-1">Powered by Razorpay. Cards, UPI, wallets accepted.</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-5 text-center">
            <Sparkles className="w-6 h-6 text-white mx-auto mb-2" />
            <p className="text-sm font-semibold">Instant Credits</p>
            <p className="text-xs text-gray-500 mt-1">Convert wallet balance above $1 to credits for generation.</p>
          </div>
        </div>

        {/* Policies */}
        <div className="text-center text-xs text-gray-600 space-y-1">
          <p>All prices include 18% GST. INR prices calculated at approx. ₹{INR_RATE}/USD.</p>
          <p>Credits are non-refundable and non-transferable. They never expire.</p>
          <p>
            <Link href="/terms" className="text-gray-400/50 hover:text-gray-300 underline">Terms</Link>
            {' · '}
            <Link href="/privacy" className="text-gray-400/50 hover:text-gray-300 underline">Privacy</Link>
            {' · '}
            <Link href="/refunds" className="text-gray-400/50 hover:text-gray-300 underline">Refund Policy</Link>
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
                      <item.icon className="w-4 h-4 text-gray-300" />
                    </div>
                    <span className="text-sm">{item.name}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold text-white">{item.credits} cr</span>
                    {typeof item.credits === 'number' && (
                      <span className="text-xs text-gray-500 ml-1">(${(item.credits * CREDIT_RATE).toFixed(3)})</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 p-3 bg-white/5 border border-white/20 rounded-xl">
              <p className="text-xs text-gray-300">
                <strong>Example:</strong> $10 deposit = ~285 credits = ~142 songs or ~285 cover art images.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Convert Wallet Modal ── */}
      {showConvertModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowConvertModal(false)}>
          <div className="bg-gray-900 border border-white/10 rounded-2xl p-8 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold">Convert Wallet to Credits</h3>
              <button onClick={() => setShowConvertModal(false)} className="p-2 hover:bg-white/10 rounded-lg">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {/* Info banner */}
            {(() => {
              const convertible = Math.max(0, (walletBalance ?? 0) - 1)
              const convertibleDisplay = currency === 'INR'
                ? `₹${(convertible * INR_RATE).toFixed(2)}`
                : `$${convertible.toFixed(2)}`
              const maxCredits = Math.floor(convertible / CREDIT_RATE)
              return (
                <>
                  <div className="mb-4 p-4 bg-white/5 border border-white/20 rounded-xl">
                    <p className="text-xs text-gray-300 leading-relaxed">
                      <strong>Current Wallet:</strong> {currency === 'INR' 
                        ? `₹${((walletBalance ?? 0) * INR_RATE).toFixed(2)}`
                        : `$${(walletBalance ?? 0).toFixed(2)}`}
                      <br />
                      <strong>Convertible:</strong> {convertibleDisplay} ({maxCredits} credits)
                      <br />
                      <strong>Rate:</strong> {currency === 'INR'
                        ? `₹${(CREDIT_RATE * INR_RATE).toFixed(2)}`
                        : `$${CREDIT_RATE.toFixed(3)}`} per credit
                    </p>
                  </div>
                  <div className="mb-6 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center gap-2">
                    <Lock className="w-4 h-4 text-amber-400 flex-shrink-0" />
                    <p className="text-xs text-amber-300">
                      $1.00 is permanently locked in your wallet as an access fee and cannot be converted.
                    </p>
                  </div>
                </>
              )
            })()}

            {/* Amount input */}
            {(() => {
              const convertible = Math.max(0, (walletBalance ?? 0) - 1)
              return (
                <div className="mb-6">
                  <label className="block text-sm font-semibold mb-3">
                    Amount to Convert {currency === 'INR' ? '(₹)' : '($)'}
                  </label>
                  <input
                    type="number"
                    value={convertAmount}
                    onChange={(e) => setConvertAmount(e.target.value)}
                    placeholder={currency === 'INR' 
                      ? `Max: ₹${(convertible * INR_RATE).toFixed(2)}`
                      : `Max: $${convertible.toFixed(2)}`}
                    min="0.01"
                    max={currency === 'INR' ? (convertible * INR_RATE) : convertible}
                    step={currency === 'INR' ? '1' : '0.01'}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-gray-500 focus:border-white/40 focus:ring-2 focus:ring-white/20 outline-none transition-all"
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    Leave empty to convert all available balance (above $1)
                  </p>
                </div>
              )
            })()}

            {/* Conversion preview */}
            {convertAmount && parseFloat(convertAmount) > 0 && (
              <div className="mb-6 p-4 bg-white/5 border border-white/10 rounded-xl">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">You'll receive:</span>
                  <span className="font-bold text-cyan-400">
                    {currency === 'INR'
                      ? Math.floor(parseFloat(convertAmount) / INR_RATE / CREDIT_RATE)
                      : Math.floor(parseFloat(convertAmount) / CREDIT_RATE)} credits
                  </span>
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowConvertModal(false)
                  setConvertAmount('')
                }}
                disabled={isConverting}
                className="flex-1 px-6 py-3 bg-white/5 border border-white/10 hover:bg-white/10 rounded-xl font-semibold transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConvertSubmit}
                disabled={isConverting || isPurchasing}
                className="flex-1 px-6 py-3 bg-white hover:bg-gray-200 text-black rounded-xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isConverting ? 'Converting...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Pre-Purchase Confirmation Modal ── */}
      {showFirstTimeModal && pendingDepositAmount !== null && (() => {
        const isFirstTime = (walletBalance ?? 0) < 1
        const convertibleAfterDeposit = isFirstTime ? Math.max(0, pendingDepositAmount - 1) : pendingDepositAmount
        const creditsAfterDeposit = Math.floor(convertibleAfterDeposit / CREDIT_RATE)
        return (
          <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-50 p-4" onClick={() => { setShowFirstTimeModal(false); setPendingDepositAmount(null) }}>
            <div className="bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 border border-cyan-500/40 rounded-2xl max-w-md w-full shadow-2xl shadow-cyan-500/10 overflow-hidden" onClick={e => e.stopPropagation()}>
              {/* Header */}
              <div className="bg-gradient-to-r from-cyan-500/10 to-teal-500/10 border-b border-cyan-500/20 p-6 text-center">
                <div className="text-4xl mb-3">💜</div>
                <h3 className="text-xl font-bold text-white">Thank You for Supporting 444</h3>
              </div>

              {/* Body */}
              <div className="p-6 space-y-4">
                {/* Warm brand message */}
                <div className="bg-cyan-500/10 border border-cyan-500/25 rounded-xl p-4">
                  <p className="text-sm text-gray-300 leading-relaxed">
                    We love you and we want you with us forever. A dollar won&apos;t hurt your soul — it only helps us build something meaningful together.
                  </p>
                  <p className="text-sm text-cyan-400 font-semibold mt-2">
                    Lock in and tune in. 444 is your new and OG producer. 🎶
                  </p>
                </div>

                {/* First-time $1 access fee notice */}
                {isFirstTime && (
                  <div className="bg-amber-500/10 border border-amber-500/25 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <DollarSign className="w-4 h-4 text-amber-400" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-amber-300">$1 One-Time Access Fee</p>
                        <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                          From your first deposit, <span className="text-white font-semibold">$1 will be locked permanently</span> as a one-time platform access fee. This never happens again on future deposits.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Breakdown */}
                <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-2">
                  <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Your deposit breakdown</p>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">Deposit amount</span>
                    <span className="text-white font-semibold">${pendingDepositAmount.toFixed(2)}</span>
                  </div>
                  {isFirstTime && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-amber-400">Access fee (one-time)</span>
                      <span className="text-amber-400 font-semibold">−$1.00</span>
                    </div>
                  )}
                  <div className="border-t border-white/10 pt-2 flex items-center justify-between text-sm">
                    <span className="text-gray-300">Convertible to credits</span>
                    <span className="text-cyan-400 font-bold">${convertibleAfterDeposit.toFixed(2)} → {creditsAfterDeposit} credits</span>
                  </div>
                </div>

                {/* Reassurance */}
                <div className="flex items-start gap-2 text-xs text-gray-500">
                  <Shield className="w-4 h-4 flex-shrink-0 text-cyan-400/50 mt-0.5" />
                  <span>{isFirstTime ? 'After this one-time fee, all future deposits convert fully to credits. No hidden charges.' : 'Instant deposit to your wallet. Convert to credits whenever you\u2019re ready.'}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 p-6 pt-0">
                <button
                  onClick={() => { setShowFirstTimeModal(false); setPendingDepositAmount(null) }}
                  className="flex-1 px-5 py-3 bg-white/5 border border-white/10 hover:bg-white/10 rounded-xl font-semibold text-sm transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setShowFirstTimeModal(false)
                    const amount = pendingDepositAmount
                    setPendingDepositAmount(null)
                    if (amount) handleDeposit(amount)
                  }}
                  className="flex-1 px-5 py-3 bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-black rounded-xl font-bold text-sm transition-all"
                >
                  Proceed to Checkout
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Razorpay SDK */}
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
    </main>
  )
}
