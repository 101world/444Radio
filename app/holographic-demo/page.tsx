'use client';

import HolographicBackgroundClient from '../components/HolographicBackgroundClient';
import FloatingMenu from '../components/FloatingMenu';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function HolographicDemo() {
  return (
    <div className="relative min-h-screen">
      {/* Holographic Background */}
      <HolographicBackgroundClient />

      {/* Navigation */}
      <FloatingMenu />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4">
        <Link 
          href="/"
          className="absolute top-8 left-8 flex items-center gap-2 text-white/60 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </Link>

        <div className="text-center space-y-6 max-w-4xl">
          <h1 className="text-6xl font-black text-white bg-clip-text bg-gradient-to-r from-cyan-400 to-cyan-300">
            Holographic Space
          </h1>
          
          <p className="text-xl text-white/80 leading-relaxed">
            Weightless holographic blobs and wireframe torus rings floating in deep space.
            <br />
            Slow parallax, volumetric god-rays, iridescent hues (teal–magenta).
            <br />
            Ultra-smooth seamless loop with dolly camera movement.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-all">
              <h3 className="text-lg font-bold text-cyan-400 mb-2">Real-time WebGL</h3>
              <p className="text-sm text-white/60">Rendered using Three.js for smooth 60fps performance</p>
            </div>
            
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-all">
              <h3 className="text-lg font-bold text-purple-400 mb-2">Seamless Loop</h3>
              <p className="text-sm text-white/60">Perfect 20-second loop with no visible seams</p>
            </div>
            
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-all">
              <h3 className="text-lg font-bold text-pink-400 mb-2">Responsive</h3>
              <p className="text-sm text-white/60">Adapts to any screen size automatically</p>
            </div>
          </div>

          <div className="mt-12 flex gap-4 justify-center">
            <Link
              href="/"
              className="px-8 py-3 bg-gradient-to-r from-cyan-500 to-cyan-400 text-white font-bold rounded-full hover:scale-105 transition-transform"
            >
              Use on Home Page
            </Link>
            
            <Link
              href="/radio"
              className="px-8 py-3 bg-white/10 backdrop-blur-sm border border-white/20 text-white font-bold rounded-full hover:bg-white/20 transition-all"
            >
              Back to Radio
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
