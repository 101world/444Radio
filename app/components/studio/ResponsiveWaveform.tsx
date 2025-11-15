"use client";

import React, { useRef, useEffect, useState } from 'react';
import { useStudio } from '@/app/contexts/StudioContext';

export default function ResponsiveWaveform({ audioUrl, className = '' }: { audioUrl: string; className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { getPeaksForUrl } = useStudio();
  const [dimensions, setDimensions] = useState({ width: 300, height: 48 });

  useEffect(() => {
    if (!containerRef.current) return;

    const resize = () => {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      setDimensions({
        width: Math.floor(rect.width),
        height: Math.floor(rect.height || 48)
      });
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(containerRef.current);

    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    let mounted = true;
    async function draw() {
      try {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const dpr = Math.min(window.devicePixelRatio || 1, 2); // Cap DPR for performance
        const w = Math.min(dimensions.width, 4096); // Max 4096px to prevent blow-up
        const h = dimensions.height;
        
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, w, h);

        // Fetch peaks for visible width only
        const peaksArr = await getPeaksForUrl(audioUrl, w);
        if (!mounted || !peaksArr) return;
        const peaks: number[] = Array.from(peaksArr);

        // Draw background
        ctx.fillStyle = 'rgba(0,0,0,0.06)';
        ctx.fillRect(0, 0, w, h);

        // Draw waveform
        const mid = h / 2;
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        for (let i = 0; i < w; i++) {
          const p = peaks[i] || 0;
          const y = Math.max(1, p * (h / 2));
          ctx.fillRect(i, mid - y, 1, y * 2);
        }

        // Center line
        ctx.fillStyle = 'rgba(255,255,255,0.02)';
        ctx.fillRect(0, mid - 0.5, w, 1);

      } catch (e) {
        console.error('Failed to draw waveform', e);
      }
    }

    draw();

    return () => { mounted = false; };
  }, [audioUrl, dimensions, getPeaksForUrl]);

  return (
    <div ref={containerRef} className={`w-full h-full ${className}`}>
      <canvas ref={canvasRef} className="w-full h-full rounded" />
    </div>
  );
}
