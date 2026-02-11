'use client'

import { useEffect, useRef } from 'react'

export default function MatrixConsole() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resize = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio
      canvas.height = canvas.offsetHeight * window.devicePixelRatio
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio)
    }
    resize()
    window.addEventListener('resize', resize)

    const W = () => canvas.offsetWidth
    const H = () => canvas.offsetHeight

    // Matrix rain columns
    const fontSize = 12
    let columns = Math.floor(W() / fontSize)
    let drops: number[] = new Array(columns).fill(0).map(() => Math.random() * -100)

    // GPU log lines
    const gpuLogs = [
      'GPU:0 CUDA cores: 10752 active',
      'VRAM: 47.2GB / 48GB allocated',
      'Batch inference: 128 samples/s',
      'Tensor RT: optimized fp16 mode',
      'Denoising step 42/50 σ=0.031',
      'Waveform synthesis: 44.1kHz/24bit',
      'FFT transform: 2048 bins ready',
      'Neural codec: 48kbps encoding',
      'Attention heads: 32 active',
      'Model: ace-step-v2 loaded',
      'Spectrogram: mel-128 computed',
      'Latent space: dim=1024 mapped',
      'Audio buffer: 4096 frames',
      'Sample rate: 48000Hz active',
      'Vocoder pass: HiFi-GAN v2',
      'Pitch tracking: CREPE active',
      'BPM detection: tempo locked',
      'Stem isolation: 4-channel',
      'Reverb tail: 2.4s computed',
      'Mastering chain: 5 stages',
      'GPU temp: 68°C | Fan: 72%',
      'Memory bandwidth: 1.6TB/s',
      'Inference latency: 23ms',
      'Pipeline: diffusion active',
      'Loss: 0.00234 | Step: 8042',
    ]
    let logLines: { text: string; y: number; opacity: number; speed: number }[] = []
    let lastLogTime = 0

    // Waveform data
    let wavePhase = 0
    const waveAmplitudes: number[] = new Array(64).fill(0)

    const chars = '01アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン♪♫♬∿≈'

    let animFrame: number

    const draw = () => {
      const w = W()
      const h = H()

      // Semi-transparent black overlay for trail effect
      ctx.fillStyle = 'rgba(0, 0, 0, 0.08)'
      ctx.fillRect(0, 0, w, h)

      // Matrix rain
      ctx.font = `${fontSize}px monospace`
      columns = Math.floor(w / fontSize)

      // Ensure drops array matches columns
      while (drops.length < columns) drops.push(Math.random() * -100)

      for (let i = 0; i < columns; i++) {
        const char = chars[Math.floor(Math.random() * chars.length)]
        const x = i * fontSize
        const y = drops[i] * fontSize

        // Cyan/green gradient effect
        const brightness = Math.random()
        if (brightness > 0.95) {
          ctx.fillStyle = '#22d3ee' // Bright cyan
        } else if (brightness > 0.8) {
          ctx.fillStyle = 'rgba(34, 211, 238, 0.8)'
        } else {
          ctx.fillStyle = `rgba(34, 211, 238, ${0.1 + Math.random() * 0.3})`
        }

        ctx.fillText(char, x, y)

        if (y > h && Math.random() > 0.975) {
          drops[i] = 0
        }
        drops[i] += 0.5 + Math.random() * 0.5
      }

      // GPU log entries
      const now = Date.now()
      if (now - lastLogTime > 800 + Math.random() * 1200) {
        const text = gpuLogs[Math.floor(Math.random() * gpuLogs.length)]
        logLines.push({
          text: `[${new Date().toLocaleTimeString()}] ${text}`,
          y: h - 20,
          opacity: 1,
          speed: 0.3 + Math.random() * 0.2
        })
        lastLogTime = now
      }

      // Draw log lines scrolling up
      ctx.font = '11px monospace'
      logLines = logLines.filter(line => {
        line.y -= line.speed
        line.opacity -= 0.002
        if (line.opacity <= 0 || line.y < 0) return false

        ctx.fillStyle = `rgba(34, 211, 238, ${line.opacity * 0.7})`
        ctx.fillText(line.text, 10, line.y)
        return true
      })

      // Waveform at bottom
      const waveH = 40
      const waveY = h - waveH - 5
      wavePhase += 0.08

      // Update waveform amplitudes
      for (let i = 0; i < waveAmplitudes.length; i++) {
        const target = Math.sin(wavePhase + i * 0.3) * 0.5 +
          Math.sin(wavePhase * 1.7 + i * 0.5) * 0.3 +
          Math.random() * 0.2
        waveAmplitudes[i] += (target - waveAmplitudes[i]) * 0.1
      }

      // Draw waveform bars
      const barWidth = w / waveAmplitudes.length
      for (let i = 0; i < waveAmplitudes.length; i++) {
        const amp = Math.abs(waveAmplitudes[i])
        const barH = amp * waveH
        const x = i * barWidth

        const gradient = ctx.createLinearGradient(x, waveY + waveH / 2 - barH / 2, x, waveY + waveH / 2 + barH / 2)
        gradient.addColorStop(0, 'rgba(34, 211, 238, 0.1)')
        gradient.addColorStop(0.5, `rgba(34, 211, 238, ${0.4 + amp * 0.6})`)
        gradient.addColorStop(1, 'rgba(34, 211, 238, 0.1)')

        ctx.fillStyle = gradient
        ctx.fillRect(x + 1, waveY + waveH / 2 - barH / 2, barWidth - 2, barH)
      }

      // Waveform label
      ctx.fillStyle = 'rgba(34, 211, 238, 0.4)'
      ctx.font = '9px monospace'
      ctx.fillText('WAVEFORM OUTPUT', 10, waveY - 3)

      animFrame = requestAnimationFrame(draw)
    }

    draw()

    return () => {
      cancelAnimationFrame(animFrame)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <div className="relative w-full h-full bg-black rounded-xl overflow-hidden border border-cyan-500/20">
      {/* Scanline overlay */}
      <div className="absolute inset-0 pointer-events-none z-10" style={{
        background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.1) 2px, rgba(0,0,0,0.1) 4px)',
      }} />
      
      {/* Corner decorations */}
      <div className="absolute top-2 left-3 z-10 flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
        <span className="text-[10px] text-cyan-500/60 font-mono">444RADIO GPU CONSOLE</span>
      </div>
      
      <canvas
        ref={canvasRef}
        className="w-full h-full"
      />
    </div>
  )
}
