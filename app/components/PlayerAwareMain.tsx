'use client'

import { useAudioPlayer } from '@/app/contexts/AudioPlayerContext'
import { useEffect, useState } from 'react'

export default function PlayerAwareMain({ children }: { children: React.ReactNode }) {
  const { currentTrack } = useAudioPlayer()
  const [isMobile, setIsMobile] = useState(false)
  const [playerRightWidth, setPlayerRightWidth] = useState('0px')

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // Observe the CSS custom property set by FloatingAudioPlayer
  useEffect(() => {
    const observer = new MutationObserver(() => {
      const w = getComputedStyle(document.documentElement).getPropertyValue('--player-right-width').trim()
      setPlayerRightWidth(w || '0px')
    })
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['style'] })
    // Initial read
    const w = getComputedStyle(document.documentElement).getPropertyValue('--player-right-width').trim()
    setPlayerRightWidth(w || '0px')
    return () => observer.disconnect()
  }, [])

  const mobilePlayerActive = !!currentTrack && isMobile

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="focus:outline-none transition-[padding] duration-300"
      style={{
        paddingTop: mobilePlayerActive ? '72px' : '0px',
        paddingRight: !isMobile ? playerRightWidth : '0px',
      }}
    >
      {children}
    </main>
  )
}
