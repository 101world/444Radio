"use client";

import React, { memo } from 'react';

function ClipWaveform({ audioUrl, width = 300, height = 48 }: { audioUrl: string; width?: number; height?: number }) {
  // Waveform rendering disabled for performance
  // Return simple colored rectangle instead
  return (
    <div 
      className="w-full h-full rounded bg-gradient-to-r from-cyan-900/20 to-cyan-800/30" 
      style={{ width: `${width}px`, height: `${height}px` }}
    />
  );
}

// Memoize to prevent re-renders during playback
export default memo(ClipWaveform, (prevProps, nextProps) => {
  return (
    prevProps.audioUrl === nextProps.audioUrl &&
    prevProps.width === nextProps.width &&
    prevProps.height === nextProps.height
  );
});
