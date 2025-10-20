'use client';

import dynamic from 'next/dynamic';

console.log('🔷 HolographicBackground wrapper: Loading...');

// Dynamically import with no SSR to ensure Three.js only runs in browser
const HolographicBackgroundClient = dynamic(
  () => {
    console.log('🔷 Dynamic import: Starting to load HolographicBackgroundClient...');
    return import('./HolographicBackgroundClient').then(mod => {
      console.log('🔷 Dynamic import: HolographicBackgroundClient loaded successfully!');
      return mod;
    });
  },
  { 
    ssr: false,
    loading: () => {
      console.log('🔷 Loading component rendered');
      return (
        <div 
          className="fixed inset-0 -z-10 bg-black pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse at center, #000511 0%, #000000 100%)',
          }}
        />
      );
    }
  }
);

export default HolographicBackgroundClient;
