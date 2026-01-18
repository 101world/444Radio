'use client'

import { SignIn, useAuth } from '@clerk/nextjs'
import { useEffect, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { Radio, Sparkles } from 'lucide-react'

function SignInContent() {
  const { isLoaded } = useAuth()
  
  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400"></div>
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
        <p className="text-gray-400 text-sm">Welcome back</p>
      </div>

      <SignIn 
        appearance={{
          elements: {
            formButtonPrimary: 'bg-gradient-to-r from-cyan-400 via-cyan-500 to-teal-400 text-black font-bold hover:shadow-cyan-500/50 md:hover:scale-105 transition-all duration-200',
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
        routing="path"
        path="/sign-in"
        signUpUrl="/sign-up"
        afterSignInUrl="/"
        redirectUrl="/"
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

export default function SignInPage() {
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
          <SignInContent />
        </Suspense>
      </div>
    </div>
  )
}
