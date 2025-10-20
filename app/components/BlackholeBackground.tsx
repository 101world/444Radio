'use client'

import { useEffect, useRef } from 'react'

export default function BlackholeBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set canvas size
    const resizeCanvas = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)

    // Particle system
    interface Particle {
      x: number
      y: number
      vx: number
      vy: number
      size: number
      opacity: number
      hue: number
    }

    const particles: Particle[] = []
    const centerX = canvas.width / 2
    const centerY = canvas.height / 2
    const particleCount = 300

    // Create particles
    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * Math.PI * 2
      const distance = Math.random() * Math.min(canvas.width, canvas.height) * 0.6
      particles.push({
        x: centerX + Math.cos(angle) * distance,
        y: centerY + Math.sin(angle) * distance,
        vx: Math.random() * 0.5 - 0.25,
        vy: Math.random() * 0.5 - 0.25,
        size: Math.random() * 3 + 1,
        opacity: Math.random() * 0.8 + 0.2,
        hue: Math.random() * 60 + 220 // Blue/purple range
      })
    }

    let animationId: number

    const animate = () => {
      // Create trail effect
      ctx.fillStyle = 'rgba(0, 0, 0, 0.05)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // Draw blackhole center glow
      const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, 200)
      gradient.addColorStop(0, 'rgba(79, 70, 229, 0.3)')
      gradient.addColorStop(0.5, 'rgba(99, 102, 241, 0.1)')
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)')
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // Update and draw particles
      particles.forEach((particle) => {
        // Calculate gravitational pull towards center
        const dx = centerX - particle.x
        const dy = centerY - particle.y
        const distance = Math.sqrt(dx * dx + dy * dy)
        const force = Math.min(100 / (distance + 100), 2)

        // Apply gravity
        particle.vx += (dx / distance) * force * 0.1
        particle.vy += (dy / distance) * force * 0.1

        // Add some turbulence
        particle.vx += (Math.random() - 0.5) * 0.2
        particle.vy += (Math.random() - 0.5) * 0.2

        // Limit velocity
        const speed = Math.sqrt(particle.vx * particle.vx + particle.vy * particle.vy)
        if (speed > 3) {
          particle.vx = (particle.vx / speed) * 3
          particle.vy = (particle.vy / speed) * 3
        }

        // Update position
        particle.x += particle.vx
        particle.y += particle.vy

        // Reset if too close to center (sucked in)
        if (distance < 50) {
          const angle = Math.random() * Math.PI * 2
          const newDistance = Math.random() * Math.min(canvas.width, canvas.height) * 0.6
          particle.x = centerX + Math.cos(angle) * newDistance
          particle.y = centerY + Math.sin(angle) * newDistance
          particle.vx = Math.random() * 0.5 - 0.25
          particle.vy = Math.random() * 0.5 - 0.25
        }

        // Reset if out of bounds
        if (particle.x < 0 || particle.x > canvas.width || particle.y < 0 || particle.y > canvas.height) {
          const angle = Math.random() * Math.PI * 2
          const newDistance = Math.random() * Math.min(canvas.width, canvas.height) * 0.6
          particle.x = centerX + Math.cos(angle) * newDistance
          particle.y = centerY + Math.sin(angle) * newDistance
        }

        // Draw particle with glow
        const particleGradient = ctx.createRadialGradient(
          particle.x, particle.y, 0,
          particle.x, particle.y, particle.size * 3
        )
        particleGradient.addColorStop(0, `hsla(${particle.hue}, 80%, 70%, ${particle.opacity})`)
        particleGradient.addColorStop(0.5, `hsla(${particle.hue}, 80%, 50%, ${particle.opacity * 0.5})`)
        particleGradient.addColorStop(1, `hsla(${particle.hue}, 80%, 30%, 0)`)

        ctx.fillStyle = particleGradient
        ctx.beginPath()
        ctx.arc(particle.x, particle.y, particle.size * 3, 0, Math.PI * 2)
        ctx.fill()

        // Draw core pixel
        ctx.fillStyle = `hsla(${particle.hue}, 100%, 90%, ${particle.opacity})`
        ctx.fillRect(
          particle.x - particle.size / 2,
          particle.y - particle.size / 2,
          particle.size,
          particle.size
        )
      })

      animationId = requestAnimationFrame(animate)
    }

    animate()

    return () => {
      cancelAnimationFrame(animationId)
      window.removeEventListener('resize', resizeCanvas)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 -z-10"
      style={{ background: '#000000' }}
    />
  )
}
