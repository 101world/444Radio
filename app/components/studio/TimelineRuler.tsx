/**
 * Timeline Ruler - Time markers with zoom controls
 * Logic Pro-style ruler with beat grid and zoom
 */

'use client';

import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { useRef, useCallback, useMemo, useEffect } from 'react';
import { useStudio } from '@/app/contexts/StudioContext';

export default function TimelineRuler({ bpm = 120, timeSig = '4/4', snapEnabled = true, scrollContainerRef }: { bpm?: number; timeSig?: '4/4' | '3/4' | '6/8'; snapEnabled?: boolean; scrollContainerRef?: React.RefObject<HTMLDivElement | null> }) {
  const { zoom, setZoom, currentTime, duration, setCurrentTime, isPlaying, setPlaying, leftGutterWidth, setLeftGutterWidth, setTrackHeight } = useStudio();
  const internalScrollRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = scrollContainerRef ?? internalScrollRef;
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

  const handleZoomFitWindow = () => {
    if (!scrollRef.current) return;
    const containerWidth = scrollRef.current.clientWidth - (leftGutterWidth || 0);
    if (containerWidth <= 0) return;
    const desiredZoom = containerWidth / (maxTime * 50);
    setZoom(Math.max(0.1, Math.min(desiredZoom, 10)));
  };

  const pxPerSecond = 50 * zoom;
  const LEFT_GUTTER = leftGutterWidth; // Keep in sync with Timeline left column width

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
    <div className="h-16 bg-gradient-to-b from-gray-950 to-black backdrop-blur-sm border-b border-teal-900/30 flex items-stretch shadow-md">
      {/* Zoom controls */}
      <div className="flex items-center gap-1 px-4 border-r border-teal-900/30 bg-black/40">
        <button
          onClick={handleZoomOut}
          className="p-1.5 rounded hover:bg-teal-700/20 text-teal-400 transition-colors"
          title="Zoom out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <span className="text-xs text-teal-300 min-w-[50px] text-center font-mono font-semibold">
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
          onClick={handleZoomFitWindow}
          className="px-3 py-1.5 rounded bg-teal-700/30 hover:bg-teal-700/50 text-teal-300 transition-colors ml-2 text-xs font-medium"
          title="Fit timeline to window"
        >
          Fit
        </button>
      </div>

      {/* Timeline ruler */}
      {/* Use the top-level timeline scroll container for a single unified scrollbar */}
      <div
        ref={scrollRef}
        className="flex-1 relative overflow-hidden select-none"
        onPointerDown={onPointerDown}
        title="Drag to scrub the playhead"
      >
        <div 
          className="absolute inset-0 flex items-end"
            style={{ 
            width: `${maxTime * pxPerSecond}px`, // 50px per second at 1x zoom
            paddingLeft: `${LEFT_GUTTER}px`
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
              left: `${currentTime * pxPerSecond}px`,
            }}
          >
            <div className="w-3 h-3 bg-teal-400 rounded-full -ml-1.5 -mt-1 shadow-lg shadow-teal-400/50" />
          </div>
        </div>
      </div>
    </div>
  );
}
