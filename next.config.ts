import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Performance optimizations
  reactStrictMode: true,
  
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

};

export default nextConfig;
