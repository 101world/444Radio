'use client'

import { useEffect, useRef } from 'react'

interface FloatingText {
  text: string
  x: number
  y: number
  vx: number
  vy: number
  rotation: number
  rotationSpeed: number
  scale: number
}

export default function FloatingGenres() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const textsRef = useRef<FloatingText[]>([])
  const mouseRef = useRef({ x: 0, y: 0 })
  const animationRef = useRef<number | undefined>(undefined)

  const genres = [
    '444 Radio', 'Hip Hop', 'Rock', 'Jazz', 'Pop', 'EDM', 'Classical',
    'Reggae', 'Blues', 'Country', 'Metal', 'Funk', 'Soul', 'R&B',
    'Techno', 'House', 'Trap', 'Lo-Fi', 'Ambient', 'Indie', 'Punk',
    '444 Radio', 'Disco', 'Grunge', 'K-Pop', 'Latin', 'Gospel'
  ]

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d', { alpha: true })
    if (!ctx) return

    // Set canvas size
    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    // Initialize floating texts
    const initTexts = () => {
      textsRef.current = genres.map((text) => ({
        text,
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 1.2, // Increased velocity for more movement
        vy: (Math.random() - 0.5) * 1.2,
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 1.5, // Faster rotation
        scale: 0.6 + Math.random() * 0.8 // Random size variation
      }))
    }
    initTexts()

    // Mouse move handler
    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY }
    }
    window.addEventListener('mousemove', handleMouseMove)

    // Touch move handler for mobile
    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        mouseRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
      }
    }
    window.addEventListener('touchmove', handleTouchMove, { passive: true })

    // Animation loop
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      textsRef.current.forEach((item) => {
        // Mouse interaction - repel text from cursor with stronger force
        const dx = item.x - mouseRef.current.x
        const dy = item.y - mouseRef.current.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        const minDist = 200 // Larger interaction radius

        if (dist < minDist) {
          const force = (minDist - dist) / minDist
          item.vx += (dx / dist) * force * 0.8 // Much stronger repulsion
          item.vy += (dy / dist) * force * 0.8
        }

        // Update position
        item.x += item.vx
        item.y += item.vy
        item.rotation += item.rotationSpeed

        // Boundary bounce with less damping for more energy
        if (item.x < 0 || item.x > canvas.width) {
          item.vx *= -0.9
          item.x = Math.max(0, Math.min(canvas.width, item.x))
        }
        if (item.y < 0 || item.y > canvas.height) {
          item.vy *= -0.9
          item.y = Math.max(0, Math.min(canvas.height, item.y))
        }

        // Apply less friction to maintain energy
        item.vx *= 0.995
        item.vy *= 0.995

        // Draw text
        ctx.save()
        ctx.translate(item.x, item.y)
        ctx.rotate((item.rotation * Math.PI) / 180)

        // Font - Impact/Anton style bold
        const fontSize = 28 * item.scale
        ctx.font = `900 ${fontSize}px Impact, "Arial Black", sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'

        // Cyan glow effect
        ctx.shadowColor = 'rgba(34, 211, 238, 0.8)'
        ctx.shadowBlur = 20
        
        // Gradient fill - cyan to white
        const gradient = ctx.createLinearGradient(-50, -50, 50, 50)
        if (item.text === '444 Radio') {
          gradient.addColorStop(0, 'rgba(34, 211, 238, 0.9)') // Brighter cyan for 444 Radio
          gradient.addColorStop(1, 'rgba(255, 255, 255, 0.9)')
        } else {
          gradient.addColorStop(0, 'rgba(34, 211, 238, 0.4)')
          gradient.addColorStop(1, 'rgba(255, 255, 255, 0.4)')
        }
        ctx.fillStyle = gradient

        // Draw text with slight stroke
        ctx.strokeStyle = 'rgba(34, 211, 238, 0.3)'
        ctx.lineWidth = 1
        ctx.strokeText(item.text, 0, 0)
        ctx.fillText(item.text, 0, 0)

        ctx.restore()
      })

      animationRef.current = requestAnimationFrame(animate)
    }

    animate()

    // Cleanup
    return () => {
      window.removeEventListener('resize', resize)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('touchmove', handleTouchMove)
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 1 }}
    />
  )
}
