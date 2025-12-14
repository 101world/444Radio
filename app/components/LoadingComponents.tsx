'use client'

import { Loader2 } from 'lucide-react'

export function LoadingSpinner({ size = 'md', className = '' }: { size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12'
  }
  
  return (
    <Loader2 className={`animate-spin text-cyan-500 ${sizeClasses[size]} ${className}`} />
  )
}

export function LoadingPage() {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-center">
        <LoadingSpinner size="lg" />
        <p className="text-white/60 mt-4">Loading...</p>
      </div>
    </div>
  )
}

export function TrackCardSkeleton() {
  return (
    <div className="bg-white/5 rounded-xl overflow-hidden animate-pulse">
      <div className="aspect-square bg-white/10" />
      <div className="p-4 space-y-2">
        <div className="h-4 bg-white/10 rounded w-3/4" />
        <div className="h-3 bg-white/10 rounded w-1/2" />
      </div>
    </div>
  )
}

export function TrackListSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <TrackCardSkeleton key={i} />
      ))}
    </div>
  )
}

export function ProfileHeaderSkeleton() {
  return (
    <div className="animate-pulse">
      {/* Banner */}
      <div className="w-full h-48 md:h-64 bg-white/10" />
      
      {/* Profile Info */}
      <div className="px-8 py-6">
        <div className="flex gap-6 items-start">
          {/* Avatar */}
          <div className="w-24 h-24 md:w-32 md:h-32 rounded-full bg-white/10 -mt-12 md:-mt-16 border-4 border-black" />
          
          {/* Info */}
          <div className="flex-1 space-y-3">
            <div className="h-8 bg-white/10 rounded w-48" />
            <div className="h-4 bg-white/10 rounded w-32" />
            <div className="h-4 bg-white/10 rounded w-64" />
            
            {/* Stats */}
            <div className="flex gap-6 mt-4">
              <div className="space-y-1">
                <div className="h-6 bg-white/10 rounded w-12" />
                <div className="h-3 bg-white/10 rounded w-16" />
              </div>
              <div className="space-y-1">
                <div className="h-6 bg-white/10 rounded w-12" />
                <div className="h-3 bg-white/10 rounded w-20" />
              </div>
              <div className="space-y-1">
                <div className="h-6 bg-white/10 rounded w-12" />
                <div className="h-3 bg-white/10 rounded w-20" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function ExploreGridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 p-8">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="animate-pulse">
          <div className="aspect-square bg-white/10 rounded-xl mb-3" />
          <div className="space-y-2">
            <div className="h-4 bg-white/10 rounded w-full" />
            <div className="h-3 bg-white/10 rounded w-2/3" />
            <div className="flex gap-4 mt-2">
              <div className="h-3 bg-white/10 rounded w-16" />
              <div className="h-3 bg-white/10 rounded w-16" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export function ChatSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-4 p-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex gap-3 animate-pulse">
          <div className="w-8 h-8 rounded-full bg-white/10 flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3 bg-white/10 rounded w-24" />
            <div className="h-4 bg-white/10 rounded w-full" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function ButtonLoading({ children, isLoading, ...props }: any) {
  return (
    <button {...props} disabled={isLoading || props.disabled}>
      {isLoading ? (
        <span className="flex items-center gap-2 justify-center">
          <LoadingSpinner size="sm" />
          Loading...
        </span>
      ) : (
        children
      )}
    </button>
  )
}
