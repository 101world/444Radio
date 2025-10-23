'use client'

import { SignUp } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { useEffect, Suspense } from 'react'

function SignUpContent() {
  return (
    <SignUp 
      forceRedirectUrl="/"
      signInUrl="/sign-in"
      appearance={{
        elements: {
          formButtonPrimary: 'bg-gradient-to-r from-green-500 via-cyan-500 to-green-400 text-black hover:shadow-green-500/50 hover:scale-105 transition-all',
          card: 'bg-transparent shadow-none',
          headerTitle: 'text-green-400 font-bold',
          headerSubtitle: 'text-green-100/70',
          socialButtonsBlockButton: 'border-green-500/30 bg-black/40 text-green-100 hover:bg-green-500/20 hover:border-green-400',
          formFieldInput: 'bg-black/60 border-green-500/30 text-green-100 focus:border-green-400',
          footerActionLink: 'text-green-400 hover:text-green-300',
          rootBox: 'w-full',
          cardBox: 'w-full shadow-none',
        },
        layout: {
          socialButtonsPlacement: 'bottom',
          socialButtonsVariant: 'blockButton',
        }
      }}
    />
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
    <div suppressHydrationWarning className="min-h-screen flex items-center justify-center bg-gradient-to-br from-black via-slate-950 to-green-950 p-6">
      <div className="backdrop-blur-xl bg-gradient-to-br from-black/70 via-slate-900/60 to-green-950/70 border-2 border-green-500/30 rounded-3xl p-8 shadow-2xl shadow-green-500/20">
        <Suspense fallback={
          <div className="flex items-center justify-center p-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-400"></div>
          </div>
        }>
          <SignUpContent />
        </Suspense>
      </div>
    </div>
  )
}
