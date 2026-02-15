import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Performance optimizations
  reactStrictMode: true,
  
  // Transpile packages that need ESM resolution for Turbopack
  transpilePackages: ['@waveform-playlist/browser', '@waveform-playlist/core', '@waveform-playlist/playout', '@waveform-playlist/webaudio-peaks', '@waveform-playlist/ui-components', '@waveform-playlist/loaders'],
  
  // Compiler optimizations
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'],
    } : false,
  },
  
  // Experimental optimizations
  experimental: {
    optimizePackageImports: ['lucide-react', '@clerk/nextjs'],
  },

  typescript: {
    // Ignore TypeScript errors during build (optional, be careful with this)
    ignoreBuildErrors: false,
  },
images: {
  // Disable Next.js server-side image optimization (saves CPU/cost on Vercel)
  unoptimized: true,
},

  // Rewrite /favicon.ico to /icon.svg (browsers request .ico by default)
  async rewrites() {
    return [
      { source: '/favicon.ico', destination: '/icon.svg' },
    ]
  },

};

export default nextConfig;
