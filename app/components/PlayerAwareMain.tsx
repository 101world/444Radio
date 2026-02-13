'use client'

import { useAudioPlayer } from '@/app/contexts/AudioPlayerContext'
import { useEffect, useState } from 'react'

export default function PlayerAwareMain({ children }: { children: React.ReactNode }) {
  const { currentTrack } = useAudioPlayer()
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const playerActive = !!currentTrack && isMobile

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="focus:outline-none transition-[padding] duration-200"
      style={{ paddingTop: playerActive ? '72px' : '0px' }}
    >
      {children}
    </main>
  )
}
