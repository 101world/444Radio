/**
 * 444 Radio Design System
 * Unified theme tokens, colors, shadows, and component styles
 * Task 11: Global Design System Consistency
 */

export const theme = {
  colors: {
    // Primary Brand Colors
    cyan: {
      50: '#ecfeff',
      100: '#cffafe',
      200: '#a5f3fc',
      300: '#67e8f9',
      400: '#22d3ee',
      500: '#06b6d4', // Primary
      600: '#0891b2',
      700: '#0e7490',
      800: '#155e75',
      900: '#164e63',
    },
    purple: {
      50: '#faf5ff',
      100: '#f3e8ff',
      200: '#e9d5ff',
      300: '#d8b4fe',
      400: '#c084fc',
      500: '#a855f7', // Secondary
      600: '#9333ea',
      700: '#7e22ce',
      800: '#6b21a8',
      900: '#581c87',
    },
    pink: {
      500: '#ec4899',
      600: '#db2777',
    },
    red: {
      500: '#ef4444',
      600: '#dc2626',
    },
    // Neutrals
    gray: {
      50: '#f9fafb',
      100: '#f3f4f6',
      200: '#e5e7eb',
      300: '#d1d5db',
      400: '#9ca3af',
      500: '#6b7280',
      600: '#4b5563',
      700: '#374151',
      800: '#1f2937',
      900: '#111827',
    },
  },

  gradients: {
    primary: 'from-cyan-500 to-blue-600',
    secondary: 'from-purple-500 to-pink-600',
    accent: 'from-cyan-500 via-purple-500 to-pink-500',
    glass: 'from-white/5 via-white/[0.02] to-transparent',
    dark: 'from-[#0a0a0a] via-[#050505] to-[#000000]',
    glow: 'from-cyan-500/20 via-purple-500/20 to-pink-500/20',
  },

  shadows: {
    sm: 'shadow-sm',
    md: 'shadow-md',
    lg: 'shadow-lg',
    xl: 'shadow-xl',
    '2xl': 'shadow-2xl',
    glow: {
      cyan: 'shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50',
      purple: 'shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50',
      pink: 'shadow-lg shadow-pink-500/30 hover:shadow-pink-500/50',
      red: 'shadow-lg shadow-red-500/30 hover:shadow-red-500/50',
    },
  },

  borders: {
    subtle: 'border border-white/10',
    normal: 'border-2 border-white/20',
    strong: 'border-2 border-cyan-500/50',
    glow: 'border-2 border-cyan-500/30 hover:border-cyan-400',
  },

  backgrounds: {
    glass: 'bg-gradient-to-br from-white/5 via-white/[0.02] to-transparent backdrop-blur-2xl',
    glassStrong: 'bg-gradient-to-br from-white/10 via-white/5 to-transparent backdrop-blur-3xl',
    dark: 'bg-[#0f0f0f]',
    darker: 'bg-[#0a0a0a]',
    darkest: 'bg-black',
  },

  animations: {
    fadeIn: 'animate-in fade-in duration-300',
    slideIn: 'animate-in slide-in-from-bottom-4 duration-300',
    scaleIn: 'animate-in zoom-in-95 duration-200',
    pulse: 'animate-pulse',
    spin: 'animate-spin',
  },

  spacing: {
    section: 'py-12 md:py-20',
    container: 'max-w-7xl mx-auto px-4 md:px-6',
    gap: {
      xs: 'gap-2',
      sm: 'gap-4',
      md: 'gap-6',
      lg: 'gap-8',
      xl: 'gap-12',
    },
  },
}

export const buttonStyles = {
  primary:
    'px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50 hover:scale-105 active:scale-95',
  secondary:
    'px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-400 hover:to-pink-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 hover:scale-105 active:scale-95',
  ghost:
    'px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-cyan-500/50 text-white font-medium rounded-xl transition-all',
  danger:
    'px-6 py-3 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-400 hover:to-red-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-red-500/30 hover:shadow-red-500/50',
  icon: 'p-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-cyan-500/50 rounded-xl transition-all',
}

export const cardStyles = {
  glass:
    'bg-gradient-to-br from-white/5 via-white/[0.02] to-transparent backdrop-blur-2xl border border-white/10 rounded-3xl shadow-2xl',
  glassHover:
    'bg-gradient-to-br from-white/5 via-white/[0.02] to-transparent backdrop-blur-2xl border border-white/10 hover:border-cyan-500/30 rounded-3xl shadow-2xl transition-all hover:scale-[1.02]',
  track:
    'bg-black/40 hover:bg-black/60 border border-cyan-500/20 hover:border-cyan-400/60 rounded-2xl overflow-hidden transition-all hover:scale-105 shadow-lg',
}

export const modalStyles = {
  overlay:
    'fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200',
  content:
    'bg-gradient-to-br from-gray-900 to-black border-2 border-cyan-500/30 rounded-3xl p-8 max-w-2xl w-full shadow-2xl shadow-cyan-500/20 animate-in zoom-in-95 duration-300',
  header: 'flex items-center justify-between mb-6',
  title: 'text-3xl font-black text-white bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent',
  body: 'space-y-4',
  footer: 'flex items-center justify-end gap-4 mt-8',
}

export const inputStyles = {
  text: 'w-full bg-white/5 border-2 border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-cyan-500/50 focus:bg-white/10 transition-all placeholder:text-gray-500',
  textarea:
    'w-full bg-white/5 border-2 border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-cyan-500/50 focus:bg-white/10 transition-all placeholder:text-gray-500 resize-none',
  select:
    'w-full bg-white/5 border-2 border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-cyan-500/50 focus:bg-white/10 transition-all',
}

export const loadingStyles = {
  spinner: 'w-12 h-12 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin',
  dots: 'flex gap-2',
  skeleton: 'animate-pulse bg-gradient-to-r from-white/5 to-white/10 rounded-lg',
}

export const tooltipStyles = {
  base: 'absolute z-50 px-3 py-2 text-xs font-medium text-white bg-gray-900 border border-cyan-500/30 rounded-lg shadow-lg shadow-cyan-500/20 whitespace-nowrap pointer-events-none',
  arrow: 'absolute w-2 h-2 bg-gray-900 border-l border-t border-cyan-500/30 transform rotate-45',
}
