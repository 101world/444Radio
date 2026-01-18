'use client'

import { SignUp } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { useEffect, useState, Suspense } from 'react'
import { Music2, Sparkles, Radio } from 'lucide-react'

function SignUpContent() {
  const [ageVerified, setAgeVerified] = useState(false)
  const [agreeToTerms, setAgreeToTerms] = useState(false)
  const [error, setError] = useState('')

  const handleContinue = () => {
    if (!ageVerified) {
      setError('You must be 18 or older to use 444Radio')
      return
    }
    if (!agreeToTerms) {
      setError('Please agree to the Terms of Service and Privacy Policy')
      return
    }
    setError('')
    // Proceed to Clerk sign-up (component will render below)
  }

  if (!ageVerified || !agreeToTerms) {
    return (
      <div className="w-full max-w-md mx-auto">
        {/* Logo/Header */}
        <div className="text-center mb-8 animate-fade-in">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="relative">
              <Radio className="w-12 h-12 text-cyan-400 animate-pulse" />
              <Sparkles className="w-5 h-5 text-cyan-300 absolute -top-1 -right-1 animate-spin-slow" />
            </div>
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-cyan-400 via-cyan-300 to-teal-400 bg-clip-text text-transparent mb-2">
            444Radio
          </h1>
          <p className="text-gray-400 text-sm">AI-Powered Music Social Network</p>
        </div>

        {/* Age Verification Card */}
        <div className="bg-gradient-to-br from-slate-900/90 via-slate-900/50 to-slate-900/90 backdrop-blur-xl border border-cyan-500/30 rounded-2xl shadow-2xl shadow-cyan-500/10 p-8">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-white mb-2">Welcome to 444Radio</h2>
            <p className="text-gray-400 text-sm">Before we begin, please confirm the following</p>
          </div>

          {/* Age Verification Checkbox */}
          <div className="space-y-4 mb-6">
            <label className="flex items-start gap-3 p-4 rounded-xl bg-slate-950/60 border border-slate-700/50 hover:border-cyan-500/40 transition-all cursor-pointer group">
              <input
                type="checkbox"
                id="age-verification"
                name="age-verification"
                checked={ageVerified}
                onChange={(e) => {
                  setAgeVerified(e.target.checked)
                  if (error && e.target.checked && agreeToTerms) setError('')
                }}
                className="mt-1 w-5 h-5 rounded border-slate-600 text-cyan-400 focus:ring-2 focus:ring-cyan-400/50 focus:ring-offset-0 bg-slate-950 cursor-pointer"
              />
              <div className="flex-1">
                <span className="text-white font-medium group-hover:text-cyan-300 transition-colors">
                  I am 18 years or older
                </span>
                <p className="text-gray-500 text-xs mt-1">
                  444Radio is only available for users 18+
                </p>
              </div>
            </label>

            {/* Terms & Privacy Checkbox */}
            <label className="flex items-start gap-3 p-4 rounded-xl bg-slate-950/60 border border-slate-700/50 hover:border-cyan-500/40 transition-all cursor-pointer group">
              <input
                type="checkbox"
                id="terms-agreement"
                name="terms-agreement"
                checked={agreeToTerms}
                onChange={(e) => {
                  setAgreeToTerms(e.target.checked)
                  if (error && ageVerified && e.target.checked) setError('')
                }}
                className="mt-1 w-5 h-5 rounded border-slate-600 text-cyan-400 focus:ring-2 focus:ring-cyan-400/50 focus:ring-offset-0 bg-slate-950 cursor-pointer"
              />
              <div className="flex-1">
                <span className="text-white font-medium group-hover:text-cyan-300 transition-colors">
                  I agree to the Terms of Service
                </span>
                <p className="text-gray-500 text-xs mt-1">
                  By signing up, you agree to our{' '}
                  <a href="/terms" className="text-cyan-400 hover:text-cyan-300 underline">
                    Terms of Service
                  </a>{' '}
                  and{' '}
                  <a href="/privacy" className="text-cyan-400 hover:text-cyan-300 underline">
                    Privacy Policy
                  </a>
                </p>
              </div>
            </label>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm animate-shake">
              {error}
            </div>
          )}

          {/* Continue Button */}
          <button
            onClick={handleContinue}
            disabled={!ageVerified || !agreeToTerms}
            className={`w-full py-4 rounded-xl font-bold text-lg transition-all duration-300 ${
              ageVerified && agreeToTerms
                ? 'bg-gradient-to-r from-cyan-400 via-cyan-500 to-teal-400 text-black hover:shadow-xl hover:shadow-cyan-500/50 hover:scale-105 active:scale-95'
                : 'bg-slate-800 text-gray-500 cursor-not-allowed'
            }`}
          >
            {ageVerified && agreeToTerms ? 'Continue to Sign Up' : 'Please confirm both items'}
          </button>

          {/* Already have account */}
          <div className="text-center mt-6">
            <p className="text-gray-400 text-sm">
              Already have an account?{' '}
              <a href="/sign-in" className="text-cyan-400 hover:text-cyan-300 font-medium transition-colors">
                Sign in
              </a>
            </p>
          </div>
        </div>

        {/* Features Preview */}
        <div className="mt-8 grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
              <Music2 className="w-6 h-6 text-cyan-400" />
            </div>
            <p className="text-gray-400 text-xs">AI Music</p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-cyan-400" />
            </div>
            <p className="text-gray-400 text-xs">AI Art</p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
              <Radio className="w-6 h-6 text-cyan-400" />
            </div>
            <p className="text-gray-400 text-xs">Live Stations</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full">
      {/* 444Radio Header - replaces Clerk branding */}
      <div className="text-center mb-6 animate-fade-in">
        <div className="flex items-center justify-center gap-3 mb-3">
          <div className="relative">
            <Radio className="w-10 h-10 text-cyan-400 animate-pulse" />
            <Sparkles className="w-4 h-4 text-cyan-300 absolute -top-1 -right-1 animate-spin-slow" />
          </div>
        </div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 via-cyan-300 to-teal-400 bg-clip-text text-transparent mb-1">
          444Radio
        </h1>
        <p className="text-gray-400 text-sm">Create your account</p>
      </div>

      <SignUp 
        forceRedirectUrl="/"
        signInUrl="/sign-in"
        appearance={{
          elements: {
            formButtonPrimary: 'bg-gradient-to-r from-cyan-400 via-cyan-500 to-teal-400 text-black font-bold hover:shadow-cyan-500/50 hover:scale-105 transition-all duration-200',
            card: 'bg-gradient-to-br from-slate-900/90 via-slate-900/50 to-slate-900/90 backdrop-blur-xl border border-cyan-500/30 shadow-2xl shadow-cyan-500/10',
            // Hide Clerk header (we have our own above)
            headerTitle: 'hidden',
            headerSubtitle: 'hidden',
            header: 'hidden',
            logoBox: 'hidden',
            logoImage: 'hidden',
            // Social buttons
            socialButtonsBlockButton: 'border-cyan-500/20 bg-slate-950/60 text-gray-200 hover:bg-cyan-500/10 hover:border-cyan-400/40 transition-all',
            socialButtonsBlockButtonText: 'text-gray-200 font-medium',
            socialButtonsIconButton: 'border-cyan-500/20 bg-slate-950/60 hover:bg-cyan-500/10',
            // Form fields
            formFieldInput: 'bg-slate-950/80 border-slate-700 text-gray-100 placeholder:text-gray-500 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/30 transition-all',
            formFieldLabel: 'text-gray-400 text-sm font-medium',
            formFieldInputShowPasswordButton: 'text-gray-400 hover:text-cyan-400',
            formFieldAction: 'text-cyan-400 hover:text-cyan-300',
            // Links and text
            footerActionLink: 'text-cyan-400 hover:text-cyan-300 transition-colors font-medium',
            footerActionText: 'text-gray-400',
            identityPreviewText: 'text-gray-300',
            identityPreviewEditButton: 'text-cyan-400 hover:text-cyan-300',
            // Dividers
            dividerLine: 'bg-slate-700',
            dividerText: 'text-gray-500',
            // Footer (hide Clerk branding)
            footer: 'hidden',
            footerPages: 'hidden',
            footerPagesLink: 'hidden',
            // Layout
            rootBox: 'w-full',
            cardBox: 'w-full shadow-none',
            main: 'gap-4',
          },
          layout: {
            socialButtonsPlacement: 'bottom',
            socialButtonsVariant: 'blockButton',
            showOptionalFields: false,
            termsPageUrl: '/terms',
            privacyPageUrl: '/privacy',
          }
        }}
      />

      {/* 444Radio Footer */}
      <div className="mt-6 text-center">
        <p className="text-gray-500 text-xs">
          © 2026 444Radio. All rights reserved.
        </p>
      </div>
    </div>
  )
}

export default function SignUpPage() {
  const router = useRouter()

  // ESC key to go back
  useEffect(() => {
    const handleEscKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        router.back()
      }
    }
    window.addEventListener('keydown', handleEscKey)
    return () => window.removeEventListener('keydown', handleEscKey)
  }, [router])

  return (
    <div suppressHydrationWarning className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6 relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-teal-500/5 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>

      <div className="w-full max-w-md relative z-10">
        <Suspense fallback={
          <div className="flex flex-col items-center justify-center p-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400 mb-4"></div>
            <p className="text-gray-400 text-sm">Loading...</p>
          </div>
        }>
          <SignUpContent />
        </Suspense>
      </div>
    </div>
  )
}
