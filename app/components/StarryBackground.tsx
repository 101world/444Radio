'use client'

import { useEffect, useRef } from 'react'

interface Star {
  x: number
  y: number
  size: number
  speed: number
  opacity: number
}

export default function StarryBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const starsRef = useRef<Star[]>([])
  const scrollOffsetRef = useRef(0)
  const animationFrameRef = useRef<number | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set canvas size
    const resizeCanvas = () => {
      canvas.width = window.innerWidth
      canvas.height = Math.max(window.innerHeight, document.documentElement.scrollHeight)
    }
    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)

    // Initialize stars
    const numStars = 150
    starsRef.current = Array.from({ length: numStars }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      size: Math.random() * 2 + 0.5,
      speed: Math.random() * 0.5 + 0.2,
      opacity: Math.random() * 0.5 + 0.3
    }))

    // Track scroll
    const handleScroll = () => {
      scrollOffsetRef.current = window.scrollY || document.documentElement.scrollTop
    }
    window.addEventListener('scroll', handleScroll, { passive: true })

    // Animation loop
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      starsRef.current.forEach((star) => {
        // Apply parallax effect based on scroll
        const parallaxY = star.y + (scrollOffsetRef.current * star.speed * 0.3)
        
        // Wrap stars vertically
        let renderY = parallaxY % canvas.height
        if (renderY < 0) renderY += canvas.height

        // Draw star
        ctx.beginPath()
        ctx.arc(star.x, renderY, star.size, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(34, 211, 238, ${star.opacity})` // Cyan color
        ctx.fill()

        // Add subtle glow
        const gradient = ctx.createRadialGradient(star.x, renderY, 0, star.x, renderY, star.size * 3)
        gradient.addColorStop(0, `rgba(34, 211, 238, ${star.opacity * 0.3})`)
        gradient.addColorStop(1, 'rgba(34, 211, 238, 0)')
        ctx.fillStyle = gradient
        ctx.beginPath()
        ctx.arc(star.x, renderY, star.size * 3, 0, Math.PI * 2)
        ctx.fill()

        // Twinkling effect
        star.opacity += (Math.random() - 0.5) * 0.02
        star.opacity = Math.max(0.1, Math.min(0.8, star.opacity))
      })

      animationFrameRef.current = requestAnimationFrame(animate)
    }

    animate()

    // Cleanup
    return () => {
      window.removeEventListener('resize', resizeCanvas)
      window.removeEventListener('scroll', handleScroll)
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
      style={{ opacity: 0.4 }}
    />
  )
}
