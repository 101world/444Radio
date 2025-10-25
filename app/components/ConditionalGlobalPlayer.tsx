'use client'

import { usePathname } from 'next/navigation'
import FloatingAudioPlayer from './FloatingAudioPlayer'

export default function ConditionalGlobalPlayer() {
  const pathname = usePathname()
  
  // Don't show player on home page (show everywhere else)
  const isHomePage = pathname === '/'
  
  if (isHomePage) return null
  
  return <FloatingAudioPlayer />
}
