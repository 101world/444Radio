'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Youtube, Mail, Instagram, X, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import FloatingMenu from '../components/FloatingMenu'

export default function Pricing() {
  const router = useRouter()
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly')
  const [creditAmount, setCreditAmount] = useState(5) // Default $5
  
  // Calculate credits based on amount (1 credit = $0.026)
  const creditsFromDollars = Math.floor(creditAmount / 0.026)
  
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

  return (
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

        {/* Billing Toggle */}
        <div className="flex justify-center mb-16">
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
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-32">
          {/* Free Access Card */}
          <div className="group relative backdrop-blur-xl bg-black/60 border border-cyan-500/40 rounded-2xl p-8 hover:border-cyan-400/80 transition-all duration-500 hover:scale-[1.02] overflow-hidden">
            {/* Holographic overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-400/20 via-transparent to-purple-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"></div>
            <div className="absolute inset-0 bg-gradient-to-tl from-pink-500/10 via-transparent to-cyan-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
            
            <div className="relative">
              <div className="mb-8">
                <div className="inline-block px-3 py-1.5 bg-cyan-500/20 border border-cyan-400/50 rounded-full mb-4">
                  <span className="text-cyan-200 text-xs font-bold uppercase tracking-wider">FREE FOREVER</span>
                </div>
                <h2 className="text-2xl font-black text-white mb-2">Free Access</h2>
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

              <ul className="space-y-4 mb-10 min-h-[160px]">
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
          <div className="group relative backdrop-blur-xl bg-black/60 border border-cyan-500/40 rounded-2xl p-8 hover:border-cyan-400/80 transition-all duration-500 hover:scale-[1.02] overflow-hidden">
            {/* Holographic overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-400/20 via-transparent to-blue-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"></div>
            <div className="absolute inset-0 bg-gradient-to-tl from-blue-500/10 via-transparent to-cyan-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>

            <div className="relative">
              <div className="mb-8">
                <div className="inline-block px-3 py-1.5 bg-cyan-500/20 border border-cyan-400/50 rounded-full mb-4">
                  <span className="text-cyan-200 text-xs font-bold uppercase tracking-wider">CREATOR</span>
                </div>
                <h2 className="text-2xl font-black text-white mb-2">Creator</h2>
                <p className="text-cyan-400/50 text-xs">For music creators</p>
              </div>

              <div className="mb-8">
                <div className="flex items-baseline gap-1 mb-2">
                  <span className="text-5xl font-black bg-gradient-to-br from-white via-cyan-200 to-blue-200 bg-clip-text text-transparent">
                    ${billingCycle === 'monthly' ? '5' : '48'}
                  </span>
                  <span className="text-cyan-400/40 text-xs">
                    /{billingCycle === 'monthly' ? 'mo' : 'yr'}
                  </span>
                </div>
                {billingCycle === 'annual' && (
                  <div className="inline-block px-2 py-0.5 bg-cyan-500/15 border border-cyan-400/40 rounded-full">
                    <span className="text-cyan-300 text-[10px] font-bold">SAVE 20%</span>
                  </div>
                )}
              </div>

              <ul className="space-y-4 mb-10 min-h-[160px]">
                <li className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-gradient-to-br from-cyan-500/30 to-blue-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="w-3 h-3 text-cyan-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path>
                    </svg>
                  </div>
                  <span className="text-gray-300 text-xs leading-relaxed"><span className="font-bold text-white">200 credits</span> per month</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-gradient-to-br from-cyan-500/30 to-blue-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="w-3 h-3 text-cyan-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path>
                    </svg>
                  </div>
                  <span className="text-gray-300 text-xs leading-relaxed">~100 songs or 200 cover art</span>
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

              <button className="w-full py-4 px-4 bg-cyan-500/15 border border-cyan-500/40 text-cyan-300 rounded-xl font-bold hover:bg-cyan-500/25 hover:border-cyan-400/60 transition-all duration-300 group-hover:scale-105 text-sm">
                Get Started
              </button>
            </div>
          </div>

          {/* Pro Plan - Most Popular */}
          <div className="group relative backdrop-blur-xl bg-black/60 border border-cyan-400/60 rounded-2xl p-8 pt-12 hover:border-cyan-300/80 transition-all duration-500 hover:scale-[1.02] overflow-visible">
            {/* Most Popular Badge */}
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-6 py-2 bg-gradient-to-r from-cyan-600 to-cyan-400 rounded-full text-white text-xs font-bold shadow-2xl shadow-cyan-500/60 uppercase tracking-wider z-10">
              ⭐ MOST POPULAR
            </div>

            {/* Holographic overlay - stronger */}
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-400/30 via-purple-500/20 to-pink-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none rounded-2xl"></div>
            <div className="absolute inset-0 bg-gradient-to-tl from-pink-500/20 via-cyan-500/20 to-purple-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none rounded-2xl"></div>

            <div className="relative">
              <div className="mb-8">
                <div className="inline-block px-3 py-1.5 bg-gradient-to-r from-cyan-500/20 to-purple-500/20 border border-cyan-400/50 rounded-full mb-4">
                  <span className="text-cyan-200 text-xs font-bold uppercase tracking-wider">PRO</span>
                </div>
                <h2 className="text-2xl font-black text-white mb-2">Pro</h2>
                <p className="text-cyan-400/50 text-xs">For professionals</p>
              </div>

              <div className="mb-8">
                <div className="flex items-baseline gap-1 mb-2">
                  <span className="text-5xl font-black bg-gradient-to-br from-white via-cyan-200 to-purple-200 bg-clip-text text-transparent">
                    ${billingCycle === 'monthly' ? '15' : '144'}
                  </span>
                  <span className="text-cyan-400/40 text-xs">
                    /{billingCycle === 'monthly' ? 'mo' : 'yr'}
                  </span>
                </div>
                {billingCycle === 'annual' && (
                  <div className="inline-block px-2 py-0.5 bg-cyan-500/15 border border-cyan-400/40 rounded-full">
                    <span className="text-cyan-300 text-[10px] font-bold">SAVE 20%</span>
                  </div>
                )}
              </div>

              <ul className="space-y-4 mb-10 min-h-[160px]">
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

              <button className="w-full py-4 px-4 bg-gradient-to-r from-cyan-600 to-cyan-400 text-white rounded-xl font-bold hover:from-cyan-700 hover:to-cyan-500 transition-all duration-300 shadow-lg shadow-cyan-500/40 group-hover:scale-105 text-sm">
                Get Started
              </button>
            </div>
          </div>

          {/* Studio Plan */}
          <div className="group relative backdrop-blur-xl bg-black/60 border border-cyan-500/40 rounded-2xl p-8 hover:border-cyan-400/80 transition-all duration-500 hover:scale-[1.02] overflow-hidden">
            {/* Holographic overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-purple-400/20 via-transparent to-pink-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"></div>
            <div className="absolute inset-0 bg-gradient-to-tl from-cyan-500/10 via-transparent to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>

            <div className="relative">
              <div className="mb-8">
                <div className="inline-block px-3 py-1.5 bg-purple-500/20 border border-purple-400/50 rounded-full mb-4">
                  <span className="text-purple-200 text-xs font-bold uppercase tracking-wider">STUDIO</span>
                </div>
                <h2 className="text-2xl font-black text-white mb-2">Studio</h2>
                <p className="text-cyan-400/50 text-xs">Unlimited everything</p>
              </div>

              <div className="mb-8">
                <div className="flex items-baseline gap-1 mb-2">
                  <span className="text-5xl font-black bg-gradient-to-br from-white via-purple-200 to-pink-200 bg-clip-text text-transparent">
                    ${billingCycle === 'monthly' ? '35' : '336'}
                  </span>
                  <span className="text-cyan-400/40 text-xs">
                    /{billingCycle === 'monthly' ? 'mo' : 'yr'}
                  </span>
                </div>
                {billingCycle === 'annual' && (
                  <div className="inline-block px-2 py-0.5 bg-cyan-500/15 border border-cyan-400/40 rounded-full">
                    <span className="text-cyan-300 text-[10px] font-bold">SAVE 20%</span>
                  </div>
                )}
              </div>

              <ul className="space-y-4 mb-10 min-h-[160px]">
                <li className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-500/30 to-pink-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="w-3 h-3 text-purple-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path>
                    </svg>
                  </div>
                  <span className="text-gray-300 text-xs leading-relaxed"><span className="font-bold text-white">Unlimited</span> credits</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-500/30 to-pink-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="w-3 h-3 text-purple-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path>
                    </svg>
                  </div>
                  <span className="text-gray-300 text-xs leading-relaxed">Unlimited generations</span>
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

              <button className="w-full py-4 px-4 bg-cyan-500/15 border border-cyan-500/40 text-cyan-300 rounded-xl font-bold hover:bg-cyan-500/25 hover:border-cyan-400/60 transition-all duration-300 group-hover:scale-105 text-sm">
                Get Started
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
                  1 credit = $0.026 • never expires • use anytime
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
          <p className="text-cyan-400/40 text-[10px] mt-2">
            questions? hit us up → support@444radio.com • © 2025 444RADIO
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
              href="mailto:444radioog@gmail.com"
              className="text-cyan-400/50 hover:text-cyan-400 transition-colors duration-300 hover:scale-110"
              aria-label="Email us"
            >
              <Mail className="w-5 h-5" />
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
          </div>
        </div>
      </div>
    </main>
  )
}
