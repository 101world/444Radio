/**
 * Animated Background Component
 * Task 22: Subtle animated gradient mesh background
 */
'use client'

import { useEffect, useRef } from 'react'

export default function AnimatedBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animationFrameId: number
    let time = 0

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }

    resize()
    window.addEventListener('resize', resize)

    const draw = () => {
      time += 0.001

      // Clear canvas
      ctx.fillStyle = 'rgba(0, 0, 0, 0.05)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // Create animated gradient blobs
      const gradients = [
        {
          x: canvas.width * (0.5 + Math.sin(time * 0.5) * 0.3),
          y: canvas.height * (0.5 + Math.cos(time * 0.3) * 0.2),
          radius: Math.min(canvas.width, canvas.height) * 0.3,
          color1: 'rgba(6, 182, 212, 0.03)', // cyan
          color2: 'rgba(6, 182, 212, 0)',
        },
        {
          x: canvas.width * (0.3 + Math.cos(time * 0.4) * 0.2),
          y: canvas.height * (0.7 + Math.sin(time * 0.6) * 0.15),
          radius: Math.min(canvas.width, canvas.height) * 0.25,
          color1: 'rgba(168, 85, 247, 0.025)', // purple
          color2: 'rgba(168, 85, 247, 0)',
        },
        {
          x: canvas.width * (0.7 + Math.sin(time * 0.35) * 0.25),
          y: canvas.height * (0.3 + Math.cos(time * 0.45) * 0.2),
          radius: Math.min(canvas.width, canvas.height) * 0.28,
          color1: 'rgba(236, 72, 153, 0.02)', // pink
          color2: 'rgba(236, 72, 153, 0)',
        },
      ]

      gradients.forEach(({ x, y, radius, color1, color2 }) => {
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius)
        gradient.addColorStop(0, color1)
        gradient.addColorStop(1, color2)
        ctx.fillStyle = gradient
        ctx.fillRect(0, 0, canvas.width, canvas.height)
      })

      animationFrameId = requestAnimationFrame(draw)
    }

    draw()

    return () => {
      window.removeEventListener('resize', resize)
      cancelAnimationFrame(animationFrameId)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full pointer-events-none z-0"
      style={{ mixBlendMode: 'screen' }}
    />
  )
}
