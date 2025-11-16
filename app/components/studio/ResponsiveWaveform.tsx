"use client";

import React from 'react';

export default function ResponsiveWaveform({ audioUrl, className = '' }: { audioUrl: string; className?: string }) {
  // Waveform rendering disabled for performance
  // Return simple gradient rectangle instead
  return (
    <div 
      className={`w-full h-full rounded bg-gradient-to-r from-cyan-900/20 to-cyan-800/30 ${className}`}
    />
  );
}
