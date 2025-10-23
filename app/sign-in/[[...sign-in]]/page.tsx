'use client'

import { SignIn } from '@clerk/nextjs'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

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
    <div suppressHydrationWarning className="min-h-screen flex items-center justify-center bg-gradient-to-br from-black via-slate-950 to-green-950 p-6">
      <div className="backdrop-blur-xl md:backdrop-blur-2xl bg-gradient-to-br from-black/80 md:from-black/70 via-slate-900/70 md:via-slate-900/60 to-green-950/80 md:to-green-950/70 border-2 border-green-500/30 rounded-3xl p-6 md:p-8 shadow-xl md:shadow-2xl shadow-green-500/20">
        <SignIn 
          appearance={{
            elements: {
              formButtonPrimary: 'bg-gradient-to-r from-green-500 via-cyan-500 to-green-400 text-black font-bold hover:shadow-green-500/50 md:hover:scale-105 transition-all duration-200',
              card: 'bg-transparent shadow-none',
              headerTitle: 'text-green-400 font-bold text-xl md:text-2xl',
              headerSubtitle: 'text-green-100/70 text-sm',
              socialButtonsBlockButton: 'border-green-500/30 bg-black/40 text-green-100 hover:bg-green-500/20 hover:border-green-400 transition-all',
              formFieldInput: 'bg-black/60 border-green-500/30 text-green-100 focus:border-green-400 focus:ring-1 focus:ring-green-400/50 transition-all',
              footerActionLink: 'text-green-400 hover:text-green-300 transition-colors',
              identityPreviewText: 'text-green-100',
              formFieldLabel: 'text-green-100/80',
            }
          }}
          routing="path"
          path="/sign-in"
          signUpUrl="/sign-up"
          afterSignInUrl="/"
          redirectUrl="/"
        />
      </div>
    </div>
  )
}
