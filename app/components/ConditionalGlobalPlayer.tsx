'use client'

import { usePathname } from 'next/navigation'
import GlobalAudioPlayer from './GlobalAudioPlayer'

export default function ConditionalGlobalPlayer() {
  const pathname = usePathname()
  
  // Only show on explore and profile pages
  const showPlayer = pathname?.startsWith('/explore') || pathname?.startsWith('/profile') || pathname?.startsWith('/u/')
  
  if (!showPlayer) return null
  
  return <GlobalAudioPlayer />
}
