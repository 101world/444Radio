'use client'

import { usePathname } from 'next/navigation'
import FloatingAudioPlayer from './FloatingAudioPlayer'

export default function ConditionalGlobalPlayer() {
  const pathname = usePathname()
  
  // Show player on all pages
  return <FloatingAudioPlayer />
}
