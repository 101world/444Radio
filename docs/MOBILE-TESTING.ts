/**
 * Mobile Responsiveness Testing Checklist & Fixes
 * 
 * COMPLETED MOBILE OPTIMIZATIONS:
 * ✅ FloatingAudioPlayer - Full mobile layout with docked design
 * ✅ Profile page - Station chat with mobile-friendly input
 * ✅ Explore page - Grid layout responsive (see tailwind classes)
 * ✅ Navigation - FloatingMenu works on mobile
 * 
 * TESTED VIEWPORT SIZES:
 * - 320px (iPhone SE)
 * - 375px (iPhone X/11/12/13/14)
 * - 414px (iPhone Plus models)
 * - 390px (iPhone 12/13 Pro)
 * - 768px (iPad)
 * 
 * MOBILE BREAKPOINTS USED:
 * - sm: 640px
 * - md: 768px
 * - lg: 1024px
 * 
 * KEY MOBILE FEATURES:
 * 1. Touch-friendly buttons (min 44x44px)
 * 2. Responsive grids (grid-cols-2 md:grid-cols-3 lg:grid-cols-4)
 * 3. Mobile navigation (FloatingMenu with bottom nav)
 * 4. Docked audio player (top of screen on mobile)
 * 5. Collapsible UI elements
 * 6. Mobile-optimized modals (full-screen on small screens)
 * 
 * COMPONENTS WITH MOBILE OPTIMIZATION:
 * - FloatingAudioPlayer.tsx (lines 224-500): Mobile-specific layout
 * - FloatingMenu.tsx: Bottom navigation on mobile
 * - Profile page: Responsive tabs, chat input
 * - Explore page: Responsive grid layout
 * - DAW/Studio: Horizontal scroll on mobile
 * 
 * MOBILE TOUCH INTERACTIONS:
 * ✅ Swipe gestures (native browser behavior)
 * ✅ Tap targets (44px minimum)
 * ✅ No hover-dependent UI
 * ✅ Touch-friendly sliders
 * ✅ Pull-to-refresh disabled where needed
 * 
 * MOBILE PERFORMANCE:
 * ✅ Lazy loading (React.lazy for heavy components)
 * ✅ Image optimization (Next.js Image component)
 * ✅ Code splitting (route-based)
 * ✅ Skeleton loaders (prevent layout shift)
 * 
 * MOBILE-SPECIFIC FIXES IMPLEMENTED:
 * 1. Audio player docks at top on mobile (fixed position)
 * 2. Chat input has proper keyboard spacing
 * 3. Modals take full height on mobile
 * 4. Grid layouts adapt to screen size
 * 5. Font sizes scale appropriately
 * 6. Navigation is bottom-docked on mobile
 * 7. Touch-friendly controls (larger hit areas)
 * 
 * KNOWN MOBILE LIMITATIONS:
 * - DAW/Studio: Limited on small screens (best on tablet+)
 * - Video playback: iOS restrictions on autoplay
 * - File uploads: iOS Safari filename restrictions
 * 
 * TESTING COMMANDS:
 * - npm run dev
 * - Open DevTools (F12)
 * - Toggle device toolbar (Ctrl+Shift+M)
 * - Test on various device presets
 * 
 * PRODUCTION TESTING:
 * - Vercel preview deployments show on mobile
 * - Test on actual devices for best accuracy
 * - Use Chrome's Lighthouse for mobile score
 */

export const MOBILE_BREAKPOINTS = {
  xs: 320,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const

export const isMobileDevice = () => {
  if (typeof window === 'undefined') return false
  return window.innerWidth < MOBILE_BREAKPOINTS.md
}

export const isTabletDevice = () => {
  if (typeof window === 'undefined') return false
  return window.innerWidth >= MOBILE_BREAKPOINTS.md && window.innerWidth < MOBILE_BREAKPOINTS.lg
}

export const isDesktopDevice = () => {
  if (typeof window === 'undefined') return false
  return window.innerWidth >= MOBILE_BREAKPOINTS.lg
}

/**
 * Hook to detect device type with SSR safety
 */
export function useDeviceType() {
  if (typeof window === 'undefined') {
    return { isMobile: false, isTablet: false, isDesktop: true }
  }

  const [deviceType, setDeviceType] = React.useState({
    isMobile: isMobileDevice(),
    isTablet: isTabletDevice(),
    isDesktop: isDesktopDevice(),
  })

  React.useEffect(() => {
    const handleResize = () => {
      setDeviceType({
        isMobile: isMobileDevice(),
        isTablet: isTabletDevice(),
        isDesktop: isDesktopDevice(),
      })
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return deviceType
}

// React import for hook
import React from 'react'
