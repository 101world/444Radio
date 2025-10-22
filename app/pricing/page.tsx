'use client'

import { useState } from 'react'
import { Youtube, Mail, Instagram, X, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function Pricing() {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly')

  return (
    <main className="min-h-screen bg-black text-white relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-cyan-950/20 via-black to-black pointer-events-none"></div>

      <div className="max-w-6xl mx-auto relative z-10 px-4 py-8">
        {/* Escape/Back Button */}
        <div className="flex justify-start mb-8">
          <Link
            href="/explore"
            className="group flex items-center gap-2 text-cyan-400/60 hover:text-cyan-400 transition-colors duration-300"
          >
            {/* Desktop: Escape button */}
            <X className="w-6 h-6 hidden md:block" />
            {/* Mobile: Arrow left */}
            <ArrowLeft className="w-6 h-6 md:hidden" />
            <span className="text-sm font-medium">Back to Explore</span>
          </Link>
        </div>

        <div className="text-center mb-8">
          <h1 className="text-5xl md:text-6xl font-black mb-4 bg-gradient-to-r from-cyan-400 via-cyan-300 to-white bg-clip-text text-transparent">
            Simple Pricing
          </h1>
          <p className="text-cyan-400/60 text-lg max-w-2xl mx-auto">
            Choose the perfect plan for your music creation needs. Flexible billing options.
          </p>
        </div>

        {/* Billing Toggle */}
        <div className="flex justify-center mb-12">
          <div className="inline-flex items-center gap-4 bg-black/50 backdrop-blur-xl border border-cyan-500/20 rounded-full p-2">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`px-6 py-3 rounded-full font-bold transition-all duration-300 ${
                billingCycle === 'monthly'
                  ? 'bg-gradient-to-r from-cyan-600 to-cyan-400 text-white shadow-lg shadow-cyan-500/30'
                  : 'text-cyan-400/60 hover:text-cyan-400'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle('annual')}
              className={`px-6 py-3 rounded-full font-bold transition-all duration-300 relative ${
                billingCycle === 'annual'
                  ? 'bg-gradient-to-r from-cyan-600 to-cyan-400 text-white shadow-lg shadow-cyan-500/30'
                  : 'text-cyan-400/60 hover:text-cyan-400'
              }`}
            >
              Annual
              <span className="absolute -top-2 -right-2 px-2 py-0.5 bg-gradient-to-r from-green-600 to-green-400 text-white text-xs rounded-full">
                Save 20%
              </span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-20">
          {/* Starter Plan */}
          <div className="group relative backdrop-blur-xl bg-gradient-to-br from-cyan-950/30 to-black border border-cyan-500/20 rounded-3xl p-8 hover:border-cyan-400/60 transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-cyan-500/20">
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-transparent rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity"></div>

            <div className="relative">
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-white mb-2">Starter</h2>
                <p className="text-cyan-400/60 text-sm">Perfect for trying out</p>
              </div>

              <div className="mb-8">
                <div className="flex items-baseline gap-2">
                  <span className="text-5xl font-black text-white">
                    ${billingCycle === 'monthly' ? '9' : '86'}
                  </span>
                  <span className="text-cyan-400/60 text-lg">
                    /{billingCycle === 'monthly' ? 'month' : 'year'}
                  </span>
                </div>
                {billingCycle === 'annual' && (
                  <p className="text-green-400/80 text-sm mt-2">
                    Save $22/year compared to monthly
                  </p>
                )}
              </div>

              <ul className="space-y-4 mb-8">
                <li className="flex items-start gap-3">
                  <svg className="w-6 h-6 text-cyan-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                  <span className="text-gray-300"><span className="font-bold text-white">20 songs</span> per month</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-6 h-6 text-cyan-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                  <span className="text-gray-300">High quality audio (320kbps)</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-6 h-6 text-cyan-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                  <span className="text-gray-300">AI-generated cover art</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-6 h-6 text-cyan-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                  <span className="text-gray-300">Download & own forever</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-6 h-6 text-cyan-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                  <span className="text-gray-300">Basic support</span>
                </li>
              </ul>

              <button className="w-full py-4 px-6 bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 rounded-xl font-bold hover:bg-cyan-500/30 hover:border-cyan-400/60 transition-all duration-300 group-hover:scale-105">
                Get Started
              </button>
            </div>
          </div>

          {/* Popular Plan */}
          <div className="group relative backdrop-blur-xl bg-gradient-to-br from-cyan-600/20 to-black border-2 border-cyan-400 rounded-3xl p-8 hover:border-cyan-300 transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-cyan-400/30 md:-mt-4">
            {/* Popular Badge */}
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-6 py-2 bg-gradient-to-r from-cyan-600 to-cyan-400 rounded-full text-white text-sm font-bold shadow-lg shadow-cyan-500/50">
              ✨ Most Popular
            </div>

            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-transparent rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity"></div>

            <div className="relative">
              <div className="mb-6 mt-4">
                <h2 className="text-2xl font-bold text-white mb-2">Creator</h2>
                <p className="text-cyan-300/80 text-sm">Best value for creators</p>
              </div>

              <div className="mb-8">
                <div className="flex items-baseline gap-2">
                  <span className="text-5xl font-black text-white">
                    ${billingCycle === 'monthly' ? '19' : '182'}
                  </span>
                  <span className="text-cyan-300/80 text-lg">
                    /{billingCycle === 'monthly' ? 'month' : 'year'}
                  </span>
                </div>
                {billingCycle === 'annual' && (
                  <p className="text-green-400/80 text-sm mt-2">
                    Save $46/year compared to monthly
                  </p>
                )}
              </div>

              <ul className="space-y-4 mb-8">
                <li className="flex items-start gap-3">
                  <svg className="w-6 h-6 text-cyan-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                  <span className="text-gray-200"><span className="font-bold text-white">100 songs</span> per month</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-6 h-6 text-cyan-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                  <span className="text-gray-200">Premium quality audio (320kbps)</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-6 h-6 text-cyan-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                  <span className="text-gray-200">AI-generated cover art</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-6 h-6 text-cyan-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                  <span className="text-gray-200">Priority email support</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-6 h-6 text-cyan-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                  <span className="text-gray-200">Download & own forever</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-6 h-6 text-cyan-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                  <span className="text-gray-200">Commercial use allowed</span>
                </li>
              </ul>

              <button className="w-full py-4 px-6 bg-gradient-to-r from-cyan-600 to-cyan-400 text-white rounded-xl font-bold hover:from-cyan-700 hover:to-cyan-500 transition-all duration-300 shadow-lg shadow-cyan-500/30 group-hover:scale-105">
                Get Started
              </button>
            </div>
          </div>

          {/* Unlimited Plan */}
          <div className="group relative backdrop-blur-xl bg-gradient-to-br from-cyan-950/30 to-black border border-cyan-500/20 rounded-3xl p-8 hover:border-cyan-400/60 transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-cyan-500/20">
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-transparent rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity"></div>

            <div className="relative">
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-white mb-2">Pro</h2>
                <p className="text-cyan-400/60 text-sm">For serious creators</p>
              </div>

              <div className="mb-8">
                <div className="flex items-baseline gap-2">
                  <span className="text-5xl font-black text-white">
                    ${billingCycle === 'monthly' ? '49' : '470'}
                  </span>
                  <span className="text-cyan-400/60 text-lg">
                    /{billingCycle === 'monthly' ? 'month' : 'year'}
                  </span>
                </div>
                {billingCycle === 'annual' && (
                  <p className="text-green-400/80 text-sm mt-2">
                    Save $118/year compared to monthly
                  </p>
                )}
              </div>

              <ul className="space-y-4 mb-8">
                <li className="flex items-start gap-3">
                  <svg className="w-6 h-6 text-cyan-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                  <span className="text-gray-300"><span className="font-bold text-white">Unlimited songs</span> per month</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-6 h-6 text-cyan-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                  <span className="text-gray-300">Premium quality audio (320kbps)</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-6 h-6 text-cyan-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                  <span className="text-gray-300">Unlimited AI cover art</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-6 h-6 text-cyan-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                  <span className="text-gray-300">Priority support 24/7</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-6 h-6 text-cyan-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                  <span className="text-gray-300">Commercial license included</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-6 h-6 text-cyan-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                  <span className="text-gray-300">Early access to new features</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-6 h-6 text-cyan-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                  <span className="text-gray-300">API access for developers</span>
                </li>
              </ul>

              <button className="w-full py-4 px-6 bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 rounded-xl font-bold hover:bg-cyan-500/30 hover:border-cyan-400/60 transition-all duration-300 group-hover:scale-105">
                Get Started
              </button>
            </div>
          </div>
        </div>

        {/* Feature Comparison Table */}
        <div className="mb-20">
          <h2 className="text-3xl font-bold text-center mb-12 text-white">Compare Plans</h2>
          <div className="overflow-x-auto">
            <table className="w-full bg-black/50 backdrop-blur-xl border border-cyan-500/20 rounded-2xl">
              <thead>
                <tr className="border-b border-cyan-500/20">
                  <th className="text-left p-6 text-white font-bold">Features</th>
                  <th className="text-center p-6 text-cyan-400 font-bold">Starter</th>
                  <th className="text-center p-6 text-cyan-400 font-bold">Creator</th>
                  <th className="text-center p-6 text-cyan-400 font-bold">Pro</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-cyan-500/10">
                  <td className="p-6 text-gray-300 font-medium">Song Generations</td>
                  <td className="text-center p-6 text-white">20/month</td>
                  <td className="text-center p-6 text-white">100/month</td>
                  <td className="text-center p-6 text-white">Unlimited</td>
                </tr>
                <tr className="border-b border-cyan-500/10">
                  <td className="p-6 text-gray-300 font-medium">Audio Quality</td>
                  <td className="text-center p-6 text-white">320kbps</td>
                  <td className="text-center p-6 text-white">320kbps</td>
                  <td className="text-center p-6 text-white">320kbps</td>
                </tr>
                <tr className="border-b border-cyan-500/10">
                  <td className="p-6 text-gray-300 font-medium">Cover Art Generation</td>
                  <td className="text-center p-6 text-white">✓</td>
                  <td className="text-center p-6 text-white">✓</td>
                  <td className="text-center p-6 text-white">Unlimited</td>
                </tr>
                <tr className="border-b border-cyan-500/10">
                  <td className="p-6 text-gray-300 font-medium">Commercial Use</td>
                  <td className="text-center p-6 text-white">✗</td>
                  <td className="text-center p-6 text-white">✓</td>
                  <td className="text-center p-6 text-white">✓</td>
                </tr>
                <tr className="border-b border-cyan-500/10">
                  <td className="p-6 text-gray-300 font-medium">Priority Support</td>
                  <td className="text-center p-6 text-white">Basic</td>
                  <td className="text-center p-6 text-white">Email</td>
                  <td className="text-center p-6 text-white">24/7</td>
                </tr>
                <tr className="border-b border-cyan-500/10">
                  <td className="p-6 text-gray-300 font-medium">API Access</td>
                  <td className="text-center p-6 text-white">✗</td>
                  <td className="text-center p-6 text-white">✗</td>
                  <td className="text-center p-6 text-white">✓</td>
                </tr>
                <tr>
                  <td className="p-6 text-gray-300 font-medium">Early Access</td>
                  <td className="text-center p-6 text-white">✗</td>
                  <td className="text-center p-6 text-white">✗</td>
                  <td className="text-center p-6 text-white">✓</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="mb-20">
          <h2 className="text-3xl font-bold text-center mb-12 text-white">Frequently Asked Questions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div className="bg-black/50 backdrop-blur-xl border border-cyan-500/20 rounded-2xl p-6">
                <h3 className="text-lg font-bold text-white mb-3">How does billing work?</h3>
                <p className="text-gray-300 text-sm">Choose between monthly or annual billing. Annual plans save you 20% compared to monthly. You can cancel anytime, and your subscription will remain active until the end of your billing period.</p>
              </div>
              <div className="bg-black/50 backdrop-blur-xl border border-cyan-500/20 rounded-2xl p-6">
                <h3 className="text-lg font-bold text-white mb-3">Can I use the music commercially?</h3>
                <p className="text-gray-300 text-sm">Creator and Pro plans include commercial licenses. Starter plan is for personal use only. All generated music is owned by you and you retain full rights.</p>
              </div>
              <div className="bg-black/50 backdrop-blur-xl border border-cyan-500/20 rounded-2xl p-6">
                <h3 className="text-lg font-bold text-white mb-3">What audio quality do you provide?</h3>
                <p className="text-gray-300 text-sm">All plans include high-quality 320kbps MP3 files. Our AI generates professional-grade music suitable for streaming, videos, and more.</p>
              </div>
            </div>
            <div className="space-y-6">
              <div className="bg-black/50 backdrop-blur-xl border border-cyan-500/20 rounded-2xl p-6">
                <h3 className="text-lg font-bold text-white mb-3">Do you offer refunds?</h3>
                <p className="text-gray-300 text-sm">We offer a 7-day money-back guarantee on all plans. If you&apos;re not satisfied with your subscription, contact our support team for a full refund within the first week.</p>
              </div>
              <div className="bg-black/50 backdrop-blur-xl border border-cyan-500/20 rounded-2xl p-6">
                <h3 className="text-lg font-bold text-white mb-3">Can I upgrade or downgrade my plan?</h3>
                <p className="text-gray-300 text-sm">Yes! You can upgrade or downgrade at any time. Changes take effect immediately, and we&apos;ll prorate the difference for your current billing cycle.</p>
              </div>
              <div className="bg-black/50 backdrop-blur-xl border border-cyan-500/20 rounded-2xl p-6">
                <h3 className="text-lg font-bold text-white mb-3">How long do downloads take?</h3>
                <p className="text-gray-300 text-sm">Song generation typically takes 30-60 seconds. Cover art generation takes 10-20 seconds. You&apos;ll receive download links immediately after generation.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Call to Action */}
        <div className="text-center bg-gradient-to-r from-cyan-950/30 to-black border border-cyan-500/20 rounded-3xl p-12">
          <h2 className="text-3xl font-bold text-white mb-4">Ready to Create Amazing Music?</h2>
          <p className="text-cyan-400/60 text-lg mb-8 max-w-2xl mx-auto">
            Join thousands of creators who trust 444RADIO for their music generation needs.
            Start creating today with our risk-free guarantee.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button className="px-8 py-4 bg-gradient-to-r from-cyan-600 to-cyan-400 text-white rounded-xl font-bold hover:from-cyan-700 hover:to-cyan-500 transition-all duration-300 shadow-lg shadow-cyan-500/30">
              Get Started Now
            </button>
            <button className="px-8 py-4 bg-white/10 border border-white/20 text-white rounded-xl font-bold hover:bg-white/20 transition-all duration-300">
              Try Free Demo
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-20 text-center">
          <p className="text-cyan-400/60 text-sm">
            All plans include high-quality music generation • Flexible billing • Cancel anytime
          </p>
          <p className="text-cyan-400/40 text-xs mt-2">
            Questions? Contact us at support@444radio.com • © 2025 444RADIO
          </p>

          {/* Social Media Links */}
          <div className="mt-8 flex justify-center gap-6">
            <a
              href="https://youtube.com/@444radioog?si=k0Def96c20mleUbS"
              target="_blank"
              rel="noopener noreferrer"
              className="text-cyan-400/60 hover:text-cyan-400 transition-colors duration-300"
              aria-label="Follow us on YouTube"
            >
              <Youtube className="w-6 h-6" />
            </a>
            <a
              href="mailto:444radioog@gmail.com"
              className="text-cyan-400/60 hover:text-cyan-400 transition-colors duration-300"
              aria-label="Email us"
            >
              <Mail className="w-6 h-6" />
            </a>
            <a
              href="https://www.instagram.com/444radioog"
              target="_blank"
              rel="noopener noreferrer"
              className="text-cyan-400/60 hover:text-cyan-400 transition-colors duration-300"
              aria-label="Follow us on Instagram"
            >
              <Instagram className="w-6 h-6" />
            </a>
          </div>
        </div>
      </div>
    </main>
  )
}

