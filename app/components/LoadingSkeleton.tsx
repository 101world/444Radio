export function TrackCardSkeleton() {
  return (
    <div className="bg-white/5 backdrop-blur-md rounded-2xl p-4 border border-white/10 animate-pulse">
      <div className="flex gap-4">
        {/* Cover art skeleton */}
        <div className="w-16 h-16 bg-white/10 rounded-lg flex-shrink-0" />
        
        {/* Content skeleton */}
        <div className="flex-1 min-w-0 space-y-2">
          <div className="h-5 bg-white/10 rounded w-3/4" />
          <div className="h-4 bg-white/10 rounded w-1/2" />
        </div>
        
        {/* Play button skeleton */}
        <div className="w-10 h-10 bg-white/10 rounded-full flex-shrink-0" />
      </div>
    </div>
  )
}

export function GridCardSkeleton() {
  return (
    <div className="bg-white/5 backdrop-blur-md rounded-2xl overflow-hidden border border-white/10 animate-pulse">
      {/* Image skeleton */}
      <div className="w-full aspect-square bg-white/10" />
      
      {/* Content skeleton */}
      <div className="p-4 space-y-2">
        <div className="h-5 bg-white/10 rounded w-3/4" />
        <div className="h-4 bg-white/10 rounded w-1/2" />
      </div>
    </div>
  )
}

export function LibraryTabSkeleton() {
  return (
    <div className="space-y-4">
      {[...Array(6)].map((_, i) => (
        <TrackCardSkeleton key={i} />
      ))}
    </div>
  )
}

export function ExploreGridSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {[...Array(8)].map((_, i) => (
        <GridCardSkeleton key={i} />
      ))}
    </div>
  )
}

export function ProfileHeaderSkeleton() {
  return (
    <div className="animate-pulse">
      {/* Banner skeleton */}
      <div className="w-full h-48 md:h-64 bg-white/10" />
      
      {/* Profile info skeleton */}
      <div className="max-w-6xl mx-auto px-4 -mt-16 relative z-10">
        <div className="flex items-end gap-4">
          {/* Avatar skeleton */}
          <div className="w-24 h-24 md:w-32 md:h-32 bg-white/10 rounded-full border-4 border-black" />
          
          {/* Info skeleton */}
          <div className="flex-1 pb-2 space-y-2">
            <div className="h-8 bg-white/10 rounded w-48" />
            <div className="h-5 bg-white/10 rounded w-32" />
          </div>
        </div>
      </div>
    </div>
  )
}
