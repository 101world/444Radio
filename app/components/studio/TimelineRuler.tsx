/**
 * Timeline Ruler - Time markers with zoom controls
 * Logic Pro-style ruler with beat grid and zoom
 */

'use client';

import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { useStudio } from '@/app/contexts/StudioContext';

export default function TimelineRuler() {
  const { zoom, setZoom, currentTime, duration } = useStudio();

  const handleZoomIn = () => {
    setZoom(Math.min(zoom * 1.5, 10));
  };

  const handleZoomOut = () => {
    setZoom(Math.max(zoom / 1.5, 0.1));
  };

  const handleZoomFit = () => {
    setZoom(1);
  };

  // Generate time markers
  const markers = [];
  const markerInterval = zoom > 2 ? 1 : zoom > 0.5 ? 5 : 10; // seconds
  const maxTime = duration || 300; // Default 5 minutes

  for (let i = 0; i <= maxTime; i += markerInterval) {
    markers.push(i);
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="h-12 bg-gray-900/80 backdrop-blur-sm border-b border-purple-500/30 flex items-stretch">
      {/* Zoom controls */}
      <div className="flex items-center gap-1 px-3 border-r border-purple-500/30">
        <button
          onClick={handleZoomOut}
          className="p-1.5 rounded hover:bg-purple-500/20 text-purple-400 transition-colors"
          title="Zoom out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <span className="text-xs text-gray-400 min-w-[40px] text-center">
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={handleZoomIn}
          className="p-1.5 rounded hover:bg-purple-500/20 text-purple-400 transition-colors"
          title="Zoom in"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={handleZoomFit}
          className="p-1.5 rounded hover:bg-purple-500/20 text-purple-400 transition-colors ml-1"
          title="Fit to window"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>

      {/* Timeline ruler */}
      <div className="flex-1 relative overflow-x-auto">
        <div 
          className="absolute inset-0 flex items-end"
          style={{ 
            width: `${maxTime * zoom * 50}px`, // 50px per second at 1x zoom
          }}
        >
          {markers.map((time) => (
            <div
              key={time}
              className="absolute bottom-0 flex flex-col items-center"
              style={{ 
                left: `${time * zoom * 50}px`,
              }}
            >
              {/* Major tick */}
              <div className="w-px h-4 bg-purple-400/50" />
              {/* Time label */}
              <span className="text-[10px] text-gray-400 mt-0.5 select-none">
                {formatTime(time)}
              </span>
            </div>
          ))}

          {/* Playhead */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-cyan-400 pointer-events-none z-10"
            style={{ 
              left: `${currentTime * zoom * 50}px`,
            }}
          >
            <div className="w-3 h-3 bg-cyan-400 rounded-full -ml-1.5 -mt-1" />
          </div>

          {/* Beat grid (every second) */}
          {Array.from({ length: Math.ceil(maxTime) }).map((_, i) => (
            <div
              key={`grid-${i}`}
              className="absolute top-0 bottom-0 w-px bg-gray-700/30"
              style={{ 
                left: `${i * zoom * 50}px`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
