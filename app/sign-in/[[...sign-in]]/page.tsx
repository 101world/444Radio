'use client'

import { SignIn, useAuth } from '@clerk/nextjs'
import { useEffect, Suspense } from 'react'
import { useRouter } from 'next/navigation'

function SignInContent() {
  const { isLoaded } = useAuth()
  
  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-400"></div>
      </div>
    )
  }
  
  return (
    <SignIn 
      appearance={{
        elements: {
          formButtonPrimary: 'bg-gradient-to-r from-cyan-400 via-cyan-500 to-teal-400 text-black font-bold hover:shadow-cyan-500/50 md:hover:scale-105 transition-all duration-200',
          card: 'bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 border border-cyan-500/30 shadow-xl shadow-cyan-500/10',
          headerTitle: 'text-cyan-400 font-bold text-xl md:text-2xl',
          headerSubtitle: 'text-gray-400 text-sm',
          socialButtonsBlockButton: 'border-cyan-500/20 bg-slate-900/60 text-gray-200 hover:bg-cyan-500/10 hover:border-cyan-400/40 transition-all',
          socialButtonsBlockButtonText: 'text-gray-200 font-medium',
          formFieldInput: 'bg-slate-950/80 border-slate-700 text-gray-100 placeholder:text-gray-500 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/30 transition-all',
          formFieldLabel: 'text-gray-400 text-sm font-medium',
          footerActionLink: 'text-cyan-400 hover:text-cyan-300 transition-colors font-medium',
          footerActionText: 'text-gray-400',
          identityPreviewText: 'text-gray-300',
          formFieldInputShowPasswordButton: 'text-gray-400 hover:text-cyan-400',
          formFieldAction: 'text-cyan-400 hover:text-cyan-300',
          dividerLine: 'bg-slate-700',
          dividerText: 'text-gray-500',
          footer: 'bg-slate-100 border-t border-slate-200',
          footerPagesLink: 'text-gray-600 hover:text-gray-800',
        }
      }}
      routing="path"
      path="/sign-in"
      signUpUrl="/sign-up"
      afterSignInUrl="/"
      redirectUrl="/"
    />
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
    <div suppressHydrationWarning className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6">
      <div className="w-full max-w-md">
        <Suspense fallback={
          <div className="flex items-center justify-center p-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400"></div>
          </div>
        }>
          <SignInContent />
        </Suspense>
      </div>
    </div>
  )
}
