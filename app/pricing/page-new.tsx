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
          <h1 className="text-6xl md:text-7xl font-black mb-6 bg-gradient-to-r from-cyan-400 via-cyan-300 to-white bg-clip-text text-transparent leading-tight">
            Simple Pricing
          </h1>
          <p className="text-cyan-400/70 text-xl md:text-2xl max-w-3xl mx-auto leading-relaxed">
            Choose the perfect plan for your music creation needs. Flexible billing options.
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
          <div className="group relative backdrop-blur-xl bg-gradient-to-br from-cyan-950/20 to-black/90 border-2 border-cyan-500/30 rounded-3xl p-8 hover:border-cyan-400/60 transition-all duration-500 hover:scale-[1.02] hover:shadow-2xl hover:shadow-cyan-500/30">
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-transparent rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

            <div className="relative">
              <div className="mb-8">
                <div className="inline-block px-4 py-1.5 bg-cyan-500/20 border border-cyan-400/30 rounded-full mb-4">
                  <span className="text-cyan-300 text-xs font-bold uppercase tracking-wider">Free Forever</span>
                </div>
                <h2 className="text-3xl font-black text-white mb-2">Free Access</h2>
                <p className="text-cyan-400/60 text-sm">Decrypt to unlock</p>
              </div>

              <div className="mb-10">
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-6xl font-black bg-gradient-to-br from-white to-cyan-200 bg-clip-text text-transparent">
                    $0
                  </span>
                </div>
                <p className="text-cyan-400/50 text-sm">One-time unlock</p>
              </div>

              <ul className="space-y-4 mb-10 min-h-[160px]">
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-cyan-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path>
                    </svg>
                  </div>
                  <span className="text-gray-300 text-sm"><span className="font-bold text-white">20 credits</span> one-time</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-cyan-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path>
                    </svg>
                  </div>
                  <span className="text-gray-300 text-sm">~10 songs or 20 covers</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-cyan-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path>
                    </svg>
                  </div>
                  <span className="text-gray-300 text-sm">Solve code puzzle</span>
                </li>
              </ul>

              <Link href="/decrypt">
                <button className="w-full py-4 px-6 bg-gradient-to-r from-cyan-600 to-cyan-400 text-white rounded-xl font-bold hover:from-cyan-700 hover:to-cyan-500 transition-all duration-300 shadow-lg shadow-cyan-500/40 group-hover:scale-105 text-sm">
                  Decrypt Now
                </button>
              </Link>
            </div>
          </div>

          {/* Creator Plan */}
          <div className="group relative backdrop-blur-xl bg-gradient-to-br from-cyan-950/20 to-black/90 border-2 border-cyan-500/30 rounded-3xl p-8 hover:border-cyan-400/60 transition-all duration-500 hover:scale-[1.02] hover:shadow-2xl hover:shadow-cyan-500/30">
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-transparent rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

            <div className="relative">
              <div className="mb-8">
                <h2 className="text-3xl font-black text-white mb-2">Creator</h2>
                <p className="text-cyan-400/60 text-sm">For music creators</p>
              </div>

              <div className="mb-10">
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-6xl font-black bg-gradient-to-br from-white to-cyan-200 bg-clip-text text-transparent">
                    ${billingCycle === 'monthly' ? '5' : '48'}
                  </span>
                  <span className="text-cyan-400/50 text-sm">
                    /{billingCycle === 'monthly' ? 'mo' : 'yr'}
                  </span>
                </div>
                {billingCycle === 'annual' && (
                  <div className="inline-block px-3 py-1 bg-cyan-500/20 border border-cyan-400/30 rounded-full">
                    <span className="text-cyan-300 text-xs font-bold">Save 20%</span>
                  </div>
                )}
              </div>

              <ul className="space-y-4 mb-10 min-h-[160px]">
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-cyan-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path>
                    </svg>
                  </div>
                  <span className="text-gray-300 text-sm"><span className="font-bold text-white">200 credits</span> per month</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-cyan-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path>
                    </svg>
                  </div>
                  <span className="text-gray-300 text-sm">~100 songs or 200 covers</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-cyan-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path>
                    </svg>
                  </div>
                  <span className="text-gray-300 text-sm">Commercial license</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-cyan-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path>
                    </svg>
                  </div>
                  <span className="text-gray-300 text-sm">Priority support</span>
                </li>
              </ul>

              <button className="w-full py-4 px-6 bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 rounded-xl font-bold hover:bg-cyan-500/30 hover:border-cyan-400/60 transition-all duration-300 group-hover:scale-105 text-sm">
                Get Started
              </button>
            </div>
          </div>

          {/* Pro Plan - Most Popular */}
          <div className="group relative backdrop-blur-xl bg-gradient-to-br from-cyan-600/30 to-black/90 border-2 border-cyan-400/60 rounded-3xl p-8 hover:border-cyan-300 transition-all duration-500 hover:scale-[1.02] hover:shadow-2xl hover:shadow-cyan-400/40 lg:-mt-4">
            {/* Most Popular Badge */}
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-6 py-2 bg-gradient-to-r from-cyan-600 to-cyan-400 rounded-full text-white text-xs font-bold shadow-lg shadow-cyan-500/50 uppercase tracking-wider">
              ✨ Most Popular
            </div>

            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-transparent rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

            <div className="relative">
              <div className="mb-8">
                <h2 className="text-3xl font-black text-white mb-2">Pro</h2>
                <p className="text-cyan-400/60 text-sm">For professionals</p>
              </div>

              <div className="mb-10">
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-6xl font-black bg-gradient-to-br from-white to-cyan-200 bg-clip-text text-transparent">
                    ${billingCycle === 'monthly' ? '15' : '144'}
                  </span>
                  <span className="text-cyan-400/50 text-sm">
                    /{billingCycle === 'monthly' ? 'mo' : 'yr'}
                  </span>
                </div>
                {billingCycle === 'annual' && (
                  <div className="inline-block px-3 py-1 bg-cyan-500/20 border border-cyan-400/30 rounded-full">
                    <span className="text-cyan-300 text-xs font-bold">Save 20%</span>
                  </div>
                )}
              </div>

              <ul className="space-y-4 mb-10 min-h-[160px]">
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-cyan-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="w-4 h-4 text-cyan-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path>
                    </svg>
                  </div>
                  <span className="text-gray-300 text-sm"><span className="font-bold text-white">600 credits</span> per month</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-cyan-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="w-4 h-4 text-cyan-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path>
                    </svg>
                  </div>
                  <span className="text-gray-300 text-sm">~300 songs or 600 covers</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-cyan-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="w-4 h-4 text-cyan-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path>
                    </svg>
                  </div>
                  <span className="text-gray-300 text-sm">Commercial license</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-cyan-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="w-4 h-4 text-cyan-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path>
                    </svg>
                  </div>
                  <span className="text-gray-300 text-sm">Premium support</span>
                </li>
              </ul>

              <button className="w-full py-4 px-6 bg-gradient-to-r from-cyan-600 to-cyan-400 text-white rounded-xl font-bold hover:from-cyan-700 hover:to-cyan-500 transition-all duration-300 shadow-lg shadow-cyan-500/40 group-hover:scale-105 text-sm">
                Get Started
              </button>
            </div>
          </div>

          {/* Studio Plan */}
          <div className="group relative backdrop-blur-xl bg-gradient-to-br from-cyan-950/20 to-black/90 border-2 border-cyan-500/30 rounded-3xl p-8 hover:border-cyan-400/60 transition-all duration-500 hover:scale-[1.02] hover:shadow-2xl hover:shadow-cyan-500/30">
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-transparent rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

            <div className="relative">
              <div className="mb-8">
                <h2 className="text-3xl font-black text-white mb-2">Studio</h2>
                <p className="text-cyan-400/60 text-sm">For production studios</p>
              </div>

              <div className="mb-10">
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-6xl font-black bg-gradient-to-br from-white to-cyan-200 bg-clip-text text-transparent">
                    ${billingCycle === 'monthly' ? '35' : '336'}
                  </span>
                  <span className="text-cyan-400/50 text-sm">
                    /{billingCycle === 'monthly' ? 'mo' : 'yr'}
                  </span>
                </div>
                {billingCycle === 'annual' && (
                  <div className="inline-block px-3 py-1 bg-cyan-500/20 border border-cyan-400/30 rounded-full">
                    <span className="text-cyan-300 text-xs font-bold">Save 20%</span>
                  </div>
                )}
              </div>

              <ul className="space-y-4 mb-10 min-h-[160px]">
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-cyan-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path>
                    </svg>
                  </div>
                  <span className="text-gray-300 text-sm"><span className="font-bold text-white">Unlimited</span> credits</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-cyan-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path>
                    </svg>
                  </div>
                  <span className="text-gray-300 text-sm">Unlimited generations</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-cyan-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path>
                    </svg>
                  </div>
                  <span className="text-gray-300 text-sm">Enterprise license</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-cyan-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path>
                    </svg>
                  </div>
                  <span className="text-gray-300 text-sm">Dedicated support</span>
                </li>
              </ul>

              <button className="w-full py-4 px-6 bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 rounded-xl font-bold hover:bg-cyan-500/30 hover:border-cyan-400/60 transition-all duration-300 group-hover:scale-105 text-sm">
                Get Started
              </button>
            </div>
          </div>
        </div>

        {/* Buy Credits Section */}
        <div className="mb-32">
          <div className="bg-gradient-to-br from-cyan-950/30 to-black/90 border-2 border-cyan-500/30 rounded-3xl p-12 shadow-2xl shadow-cyan-500/20">
            <div className="text-center mb-12">
              <h2 className="text-4xl md:text-5xl font-black text-white mb-4">Buy Credits</h2>
              <p className="text-cyan-400/70 text-lg">Purchase credits on-demand without a subscription</p>
            </div>

            <div className="max-w-4xl mx-auto">
              {/* Amount Display */}
              <div className="text-center mb-12">
                <div className="inline-block bg-black/60 backdrop-blur-xl border border-cyan-500/40 rounded-3xl p-10 mb-8 shadow-xl shadow-cyan-500/20">
                  <div className="flex items-baseline justify-center gap-3 mb-3">
                    <span className="text-7xl font-black bg-gradient-to-br from-white to-cyan-200 bg-clip-text text-transparent">
                      ${creditAmount}
                    </span>
                  </div>
                  <div className="text-cyan-400/60 text-sm mb-6">Purchase Amount</div>
                  <div className="border-t border-cyan-500/30 pt-6 mt-6">
                    <div className="text-5xl font-black text-cyan-400 mb-3">
                      {creditsFromDollars.toLocaleString()} credits
                    </div>
                    <div className="text-cyan-400/60 text-base">
                      ≈ {Math.floor(creditsFromDollars / 2)} songs or {creditsFromDollars} cover arts
                    </div>
                  </div>
                </div>
              </div>

              {/* Slider */}
              <div className="mb-12">
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
                <div className="flex justify-between mt-4 px-1">
                  {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50].map((value) => (
                    <button
                      key={value}
                      onClick={() => setCreditAmount(value)}
                      className={`text-xs transition-all duration-300 ${
                        creditAmount === value 
                          ? 'text-cyan-400 font-bold scale-110' 
                          : 'text-cyan-400/40 hover:text-cyan-400/70'
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
                  className={`px-12 py-5 rounded-xl font-bold text-base transition-all duration-300 ${
                    creditAmount === 0
                      ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                      : 'bg-gradient-to-r from-cyan-600 to-cyan-400 text-white hover:from-cyan-700 hover:to-cyan-500 shadow-xl shadow-cyan-500/40 hover:scale-105'
                  }`}
                >
                  {creditAmount === 0 ? 'Select Amount' : `Purchase ${creditsFromDollars.toLocaleString()} Credits for $${creditAmount}`}
                </button>
                <p className="text-cyan-400/50 text-sm mt-5">
                  1 credit = $0.026 • Credits never expire • Use anytime
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Call to Action */}
        <div className="text-center bg-gradient-to-r from-cyan-950/30 to-black/90 border-2 border-cyan-500/30 rounded-3xl p-16 mb-20 shadow-2xl shadow-cyan-500/20">
          <h2 className="text-4xl md:text-5xl font-black text-white mb-5">Ready to Create Amazing Music?</h2>
          <p className="text-cyan-400/70 text-xl mb-10 max-w-3xl mx-auto leading-relaxed">
            Join thousands of creators who trust 444RADIO for their music generation needs.
            Start creating today with our risk-free guarantee.
          </p>
          <div className="flex flex-col sm:flex-row gap-5 justify-center">
            <button className="px-10 py-5 bg-gradient-to-r from-cyan-600 to-cyan-400 text-white rounded-xl font-bold text-base hover:from-cyan-700 hover:to-cyan-500 transition-all duration-300 shadow-xl shadow-cyan-500/40 hover:scale-105">
              Get Started Now
            </button>
            <button className="px-10 py-5 bg-white/10 border-2 border-white/20 text-white rounded-xl font-bold text-base hover:bg-white/20 transition-all duration-300">
              Try Free Demo
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-20 text-center">
          <p className="text-cyan-400/70 text-base mb-4">
            All plans include high-quality music generation • Flexible billing • Cancel anytime
          </p>
          <p className="text-cyan-400/70 text-base mb-3">
            <strong>Credits system:</strong> 1 song = 2 credits • 1 cover art = 1 credit
          </p>
          <p className="text-cyan-400/50 text-sm mt-3">
            Questions? Contact us at support@444radio.com • © 2025 444RADIO
          </p>

          {/* Social Media Links */}
          <div className="mt-10 flex justify-center gap-8">
            <a
              href="https://youtube.com/@444radioog?si=k0Def96c20mleUbS"
              target="_blank"
              rel="noopener noreferrer"
              className="text-cyan-400/60 hover:text-cyan-400 transition-colors duration-300 hover:scale-110"
              aria-label="Follow us on YouTube"
            >
              <Youtube className="w-7 h-7" />
            </a>
            <a
              href="mailto:444radioog@gmail.com"
              className="text-cyan-400/60 hover:text-cyan-400 transition-colors duration-300 hover:scale-110"
              aria-label="Email us"
            >
              <Mail className="w-7 h-7" />
            </a>
            <a
              href="https://www.instagram.com/444radioog"
              target="_blank"
              rel="noopener noreferrer"
              className="text-cyan-400/60 hover:text-cyan-400 transition-colors duration-300 hover:scale-110"
              aria-label="Follow us on Instagram"
            >
              <Instagram className="w-7 h-7" />
            </a>
          </div>
        </div>
      </div>
    </main>
  )
}
