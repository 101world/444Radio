'use client'

import { useState } from 'react'
import { useUser } from '@clerk/nextjs'
import { Zap, CheckCircle, Sparkles } from 'lucide-react'

export default function SubscribePage() {
  const { user } = useUser()
  const [loading, setLoading] = useState(false)

  const handleSubscribe = () => {
    setLoading(true)
    // Redirect to Razorpay payment link
    window.location.href = 'https://rzp.io/rzp/KchQndS'
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-black text-white">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-5xl font-black mb-4 bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent">
              Become a Creator
            </h1>
            <p className="text-xl text-gray-400">
              Unlock unlimited AI music generation with our Creator subscription
            </p>
          </div>

          {/* Pricing Card */}
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500 via-purple-500 to-cyan-500 rounded-3xl blur-xl opacity-75 group-hover:opacity-100 transition duration-300" />
            
            <div className="relative bg-black/80 backdrop-blur-2xl border-2 border-cyan-500/50 rounded-3xl p-8 md:p-12">
              {/* Badge */}
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                <div className="bg-gradient-to-r from-cyan-500 to-purple-500 px-6 py-2 rounded-full flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  <span className="font-bold text-sm">MOST POPULAR</span>
                </div>
              </div>

              <div className="text-center mt-4">
                <h2 className="text-3xl font-bold mb-2">Creator Plan</h2>
                <div className="flex items-baseline justify-center gap-2 mb-6">
                  <span className="text-5xl font-black bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent">
                    ₹499
                  </span>
                  <span className="text-gray-400">/month</span>
                </div>
              </div>

              {/* Features */}
              <div className="space-y-4 mb-8">
                <Feature text="100 credits per month" />
                <Feature text="Generate unlimited AI music tracks" />
                <Feature text="High-quality audio exports" />
                <Feature text="Priority processing" />
                <Feature text="Access to all genres and styles" />
                <Feature text="Commercial license included" />
                <Feature text="Early access to new features" />
                <Feature text="Premium support" />
              </div>

              {/* CTA Button */}
              <button
                onClick={handleSubscribe}
                disabled={loading || !user}
                className="w-full bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-400 hover:to-purple-400 text-white font-bold py-4 px-8 rounded-xl transition-all duration-200 transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-cyan-500/50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>Processing...</>
                ) : (
                  <>
                    <Zap className="w-5 h-5" />
                    Subscribe Now
                  </>
                )}
              </button>

              {!user && (
                <p className="text-center text-sm text-gray-400 mt-4">
                  Please sign in to subscribe
                </p>
              )}

              <p className="text-center text-xs text-gray-500 mt-6">
                Secure payment powered by Razorpay. Cancel anytime.
              </p>
            </div>
          </div>

          {/* FAQ */}
          <div className="mt-16 text-center">
            <h3 className="text-2xl font-bold mb-6">Frequently Asked Questions</h3>
            <div className="space-y-4 text-left max-w-2xl mx-auto">
              <FAQ
                question="How do credits work?"
                answer="Each AI music generation costs credits. With 100 credits per month, you can create dozens of unique tracks."
              />
              <FAQ
                question="Can I cancel anytime?"
                answer="Yes! You can cancel your subscription at any time. You'll keep your credits until the end of your billing period."
              />
              <FAQ
                question="Do credits expire?"
                answer="No! All credits accumulate and stay in your account forever, even after cancelling. Use them whenever you want."
              />
              <FAQ
                question="What happens to unused credits?"
                answer="They stay in your account! Credits accumulate month-to-month. If you cancel, you keep all accumulated credits forever."
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Feature({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-3">
      <CheckCircle className="w-5 h-5 text-cyan-400 flex-shrink-0" />
      <span className="text-gray-300">{text}</span>
    </div>
  )
}

function FAQ({ question, answer }: { question: string; answer: string }) {
  return (
    <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-6">
      <h4 className="font-bold text-lg mb-2 text-cyan-400">{question}</h4>
      <p className="text-gray-400">{answer}</p>
    </div>
  )
}
