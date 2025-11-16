"use client";

import React, { useRef, useEffect, memo } from 'react';
import { useStudio } from '@/app/contexts/StudioContext';

function ClipWaveform({ audioUrl, width = 300, height = 48 }: { audioUrl: string; width?: number; height?: number }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { getPeaksForUrl } = useStudio();

  useEffect(() => {
    let mounted = true;
    async function draw() {
      try {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const dpr = Math.min(window.devicePixelRatio || 1, 2); // Cap at 2x for performance
        // Constrain canvas to reasonable size to avoid layout blow-up
        const w = Math.min(Math.max(1, Math.floor(width)), 4096);
        const h = Math.max(1, Math.floor(height));
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, w, h);

        // Use the cached peaks if available. We'll ask the engine for peaks sized to canvas width
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

        // Draw overlay center line
        ctx.fillStyle = 'rgba(255,255,255,0.02)';
        ctx.fillRect(0, mid - 0.5, w, 1);

      } catch (e) {
        console.error('Failed to draw waveform', e);
      }
    }

    draw();

    return () => { mounted = false; };
  }, [audioUrl, width, height, getPeaksForUrl]);

  return (
    <canvas ref={canvasRef} className="w-full h-full rounded" />
  );
}

// Memoize waveform to prevent re-renders during playback
export default memo(ClipWaveform, (prevProps, nextProps) => {
  return (
    prevProps.audioUrl === nextProps.audioUrl &&
    prevProps.width === nextProps.width &&
    prevProps.height === nextProps.height
  );
});
