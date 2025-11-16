/**
 * TimelineZoomControls - Zoom in/out controls for timeline
 */

'use client'

import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react'

interface TimelineZoomControlsProps {
  zoom: number
  onZoomChange: (zoom: number) => void
  onFitToView?: () => void
}

export default function TimelineZoomControls({ zoom, onZoomChange, onFitToView }: TimelineZoomControlsProps) {
  const handleZoomIn = () => {
    onZoomChange(Math.min(10, zoom * 1.2))
  }

  const handleZoomOut = () => {
    onZoomChange(Math.max(0.1, zoom / 1.2))
  }

  const zoomPercentage = Math.round(zoom * 100)

  return (
    <div className="flex items-center gap-2 bg-gray-900/80 backdrop-blur-sm border border-teal-500/30 rounded-lg px-3 py-2">
      <button
        onClick={handleZoomOut}
        className="p-1.5 hover:bg-teal-500/20 rounded transition-colors"
        title="Zoom Out"
        disabled={zoom <= 0.1}
      >
        <ZoomOut className="w-4 h-4 text-teal-400" />
      </button>
      
      <div className="text-xs font-mono text-teal-400 min-w-[3rem] text-center">
        {zoomPercentage}%
      </div>
      
      <button
        onClick={handleZoomIn}
        className="p-1.5 hover:bg-teal-500/20 rounded transition-colors"
        title="Zoom In"
        disabled={zoom >= 10}
      >
        <ZoomIn className="w-4 h-4 text-teal-400" />
      </button>
      
      {onFitToView && (
        <div className="w-px h-5 bg-teal-500/30 mx-1" />
      )}
      
      {onFitToView && (
        <button
          onClick={onFitToView}
          className="p-1.5 hover:bg-teal-500/20 rounded transition-colors"
          title="Fit to View"
        >
          <Maximize2 className="w-4 h-4 text-teal-400" />
        </button>
      )}
    </div>
  )
}
