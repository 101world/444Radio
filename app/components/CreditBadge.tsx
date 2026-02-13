'use client'

import { useUser } from '@clerk/nextjs'
import { usePathname, useRouter } from 'next/navigation'
import { Zap } from 'lucide-react'
import { useCredits } from '@/app/contexts/CreditsContext'

/**
 * Persistent floating credit badge visible on every page.
 * Tapping it navigates to Settings → Wallet & Billing.
 *
 * Uses shared CreditsContext — NO independent fetch.
 */
export default function CreditBadge() {
  const { user, isLoaded } = useUser()
  const pathname = usePathname()
  const router = useRouter()
  const { credits } = useCredits()

  // Public paths where badge should not appear
  const hiddenPaths = ['/', '/sign-in', '/sign-up']
  const shouldHide = !isLoaded || !user || hiddenPaths.includes(pathname)

  if (shouldHide || credits === null) return null

  return (
    <button
      onClick={() => router.push('/settings?tab=wallet')}
      aria-label={`${credits} credits — view wallet`}
      className="fixed top-4 right-4 z-50 flex items-center gap-1.5 px-3 py-1.5 bg-black/70 backdrop-blur-xl border border-cyan-500/30 rounded-full shadow-lg shadow-cyan-500/10 hover:border-cyan-400/60 hover:bg-black/90 transition-all group cursor-pointer"
    >
      <Zap className="w-3.5 h-3.5 text-cyan-400 group-hover:text-cyan-300 transition-colors" />
      <span className="text-cyan-300 font-bold text-xs tabular-nums group-hover:text-cyan-200 transition-colors">
        {credits}
      </span>
    </button>
  )
}
