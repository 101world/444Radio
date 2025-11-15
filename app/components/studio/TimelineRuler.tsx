/**
 * Timeline Ruler - Time markers with zoom controls
 * Logic Pro-style ruler with beat grid and zoom
 */

'use client';

import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { useRef, useCallback, useMemo, useEffect } from 'react';
import { useStudio } from '@/app/contexts/StudioContext';

export default function TimelineRuler({ bpm = 120, timeSig = '4/4', snapEnabled = true }: { bpm?: number; timeSig?: '4/4' | '3/4' | '6/8'; snapEnabled?: boolean; }) {
  const { zoom, setZoom, currentTime, duration, setCurrentTime, isPlaying, setPlaying } = useStudio();
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragStateRef = useRef<{ dragging: boolean; wasPlaying: boolean } | null>(null);

  const handleZoomIn = () => {
    setZoom(Math.min(zoom * 1.5, 10));
  };

  const handleZoomOut = () => {
    setZoom(Math.max(zoom / 1.5, 0.1));
  };

  const handleZoomFit = () => {
    setZoom(1);
  };

  const pxPerSecond = 50 * zoom;
  // left column width controlled by CSS variable --studio-left-column-width

  const beatsPerBar = useMemo(() => {
    const n = parseInt(String(timeSig).split('/')[0] || '4', 10);
    return Number.isFinite(n) && n > 0 ? n : 4;
  }, [timeSig]);

  const safeBpm = Math.max(1, bpm || 120);
  const beatDuration = 60 / safeBpm; // seconds per beat
  const barDuration = beatsPerBar * beatDuration; // seconds per bar

  const getTimeFromEvent = useCallback((e: PointerEvent | React.PointerEvent) => {
    const scroller = scrollRef.current;
    if (!scroller) return 0;
    const rect = scroller.getBoundingClientRect();
    const clientX = 'clientX' in e ? e.clientX : 0;
    const x = clientX - rect.left + scroller.scrollLeft;
    const t = Math.max(0, x / pxPerSecond);
    return t;
  }, [pxPerSecond]);

  const updateFromEvent = useCallback((e: PointerEvent | React.PointerEvent) => {
    const t = getTimeFromEvent(e);
    setCurrentTime(t);
  }, [getTimeFromEvent, setCurrentTime]);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    // Only handle primary button
    if (e.button !== 0) return;
    const wasPlaying = isPlaying;
    if (wasPlaying) setPlaying(false);
    dragStateRef.current = { dragging: true, wasPlaying };
    // Focus and capture pointer to continue receiving events
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    updateFromEvent(e);

    const handleMove = (ev: PointerEvent) => {
      if (!dragStateRef.current?.dragging) return;
      updateFromEvent(ev);
    };

    const handleUp = (ev: PointerEvent) => {
      if (!dragStateRef.current) return;
      dragStateRef.current.dragging = false;
      // Release capture if possible
      try { (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId); } catch {}
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      // Resume playback if it was playing before
      if (dragStateRef.current.wasPlaying) setPlaying(true);
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
  }, [isPlaying, setPlaying, updateFromEvent]);

  // Sync scroll with Timeline component
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { left?: number } | undefined;
      if (!scrollRef.current || !detail || typeof detail.left !== 'number') return;
      if (Math.abs(scrollRef.current.scrollLeft - detail.left) > 1) {
        scrollRef.current.scrollLeft = detail.left;
      }
    };
    window.addEventListener('studio:timeline-scroll', handler as EventListener);
    return () => window.removeEventListener('studio:timeline-scroll', handler as EventListener);
  }, []);

  // Generate time markers and musical grid
  const maxTime = duration || 300; // Default 5 minutes
  const markerInterval = zoom > 2 ? 1 : zoom > 0.5 ? 5 : 10; // seconds for time labels
  const markers: number[] = [];
  for (let i = 0; i <= maxTime; i += markerInterval) markers.push(i);

  const barPositions: number[] = [];
  for (let t = 0; t <= maxTime + 1e-6; t += barDuration) barPositions.push(Number(t.toFixed(6)));

  const beatPositions: Array<{ time: number; isDownbeat: boolean }> = [];
  for (let barIdx = 0; barIdx < barPositions.length; barIdx++) {
    const barStart = barPositions[barIdx];
    for (let b = 0; b < beatsPerBar; b++) {
      const t = barStart + b * beatDuration;
      if (t > maxTime) break;
      beatPositions.push({ time: Number(t.toFixed(6)), isDownbeat: b === 0 });
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="h-16 bg-black backdrop-blur-sm border-b border-teal-900/50 flex items-stretch">
      {/* Zoom controls */}
      <div className="flex items-center gap-1 px-3 border-r border-teal-900/50">
        <button
          onClick={handleZoomOut}
          className="p-1.5 rounded hover:bg-teal-700/20 text-teal-400 transition-colors"
          title="Zoom out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <span className="text-xs text-gray-400 min-w-[40px] text-center font-mono">
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={handleZoomIn}
          className="p-1.5 rounded hover:bg-teal-700/20 text-teal-400 transition-colors"
          title="Zoom in"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={handleZoomFit}
          className="p-1.5 rounded hover:bg-teal-700/20 text-teal-400 transition-colors ml-1"
          title="Fit to window"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>

      {/* Timeline ruler */}
      <div
        ref={scrollRef}
        className="flex-1 relative overflow-x-auto select-none"
        onScroll={(e) => {
          const left = (e.currentTarget as HTMLDivElement).scrollLeft;
          try {
            window.dispatchEvent(new CustomEvent('studio:timeline-scroll', { detail: { left } } as any));
          } catch {}
        }}
        onPointerDown={onPointerDown}
        title="Drag to scrub the playhead"
      >
        <div 
          className="absolute inset-0 flex items-end"
          style={{ 
            width: `${maxTime * pxPerSecond}px`, // 50px per second at 1x zoom
            paddingLeft: `var(--studio-left-column-width)`
          }}
        >
          {/* Musical grid: bars and beats */}
          {beatPositions.map(({ time, isDownbeat }, idx) => (
            <div
              key={`beat-${idx}`}
              className={`absolute top-0 bottom-0 ${isDownbeat ? (snapEnabled ? 'bg-cyan-700/50' : 'bg-cyan-800/30') : (snapEnabled ? 'bg-teal-800/40' : 'bg-teal-900/25')}`}
              style={{ left: `${time * pxPerSecond}px`, width: '1px' }}
            />
          ))}

          {/* Bar labels (every bar) */}
          {barPositions.map((time, i) => (
            <div
              key={`barlabel-${i}`}
              className="absolute"
              style={{ left: `${time * pxPerSecond}px`, bottom: '18px' }}
            >
              <span className="text-[10px] text-cyan-400 font-mono select-none">{i + 1}</span>
            </div>
          ))}

          {markers.map((time) => (
            <div
              key={time}
              className="absolute bottom-0 flex flex-col items-center"
              style={{ 
                left: `${time * pxPerSecond}px`,
              }}
            >
              {/* Major tick */}
              <div className="w-px h-4 bg-teal-400/50" />
              {/* Time label */}
              <span className="text-[10px] text-teal-500 mt-0.5 select-none font-mono">
                {formatTime(time)}
              </span>
            </div>
          ))}

          {/* Playhead */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-teal-400 pointer-events-none z-10 shadow-lg shadow-teal-400/50"
            style={{ 
              left: `calc(var(--studio-left-column-width) + ${currentTime * pxPerSecond}px)`,
            }}
            data-testid="ruler-playhead"
          >
            <div className="w-3 h-3 bg-teal-400 rounded-full -ml-1.5 -mt-1 shadow-lg shadow-teal-400/50" />
          </div>
        </div>
      </div>
    </div>
  );
}
