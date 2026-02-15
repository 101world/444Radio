import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Performance optimizations
  reactStrictMode: true,
  
  // Transpile packages that need ESM resolution for Turbopack
  transpilePackages: ['tone', '@waveform-playlist/browser', '@waveform-playlist/core', '@waveform-playlist/playout', '@waveform-playlist/webaudio-peaks', '@waveform-playlist/ui-components', '@waveform-playlist/loaders'],
  
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

  // Turbopack config — force Tone.js ESM resolution (browser field points to CJS)
  turbopack: {
    resolveAlias: {
      'tone': 'tone/build/esm/index.js',
    },
  },
  
  typescript: {
    // Ignore TypeScript errors during build (optional, be careful with this)
    ignoreBuildErrors: false,
  },
images: {
  // Stop Next.js from doing server-side image transforms (Vercel image optimizer)
  // This prevents per-request transform CPU usage & overages.
  unoptimized: true,

  // existing options kept for compatibility
  remotePatterns: [
    {
      protocol: 'https',
      hostname: '**',
    },
  ],
  dangerouslyAllowSVG: true,
  contentDispositionType: 'attachment',
  formats: ['image/avif', 'image/webp'],
  minimumCacheTTL: 60,
},

  // Rewrite /favicon.ico to /icon.svg (browsers request .ico by default)
  async rewrites() {
    return [
      { source: '/favicon.ico', destination: '/icon.svg' },
    ]
  },

};

export default nextConfig;
