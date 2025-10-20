'use client';

import dynamic from 'next/dynamic';

// Dynamically import with no SSR to ensure Three.js only runs in browser
const HolographicBackground = dynamic(
  () => import('./HolographicBackgroundClient'),
  { 
    ssr: false,
    loading: () => (
      <div className="fixed inset-0 -z-10 bg-gradient-radial from-[#000511] to-black" />
    )
  }
);

export default HolographicBackground;
