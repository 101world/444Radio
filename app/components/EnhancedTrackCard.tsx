/**
 * Enhanced Track Card Component
 * Tasks 7, 17: Staggered animations + Lazy loading
 */
'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { useInView } from 'react-intersection-observer'
import { Play, Heart, Share2, MoreVertical } from 'lucide-react'
import { cardStyles } from '@/lib/design-system'

interface TrackCardProps {
  track: {
    id: string
    title: string
    imageUrl?: string
    plays: number
    likes?: number
    artist?: string
  }
  index: number
  onPlay: (track: any) => void
  onLike?: (trackId: string) => void
  onShare?: (trackId: string) => void
}

export default function EnhancedTrackCard({ 
  track, 
  index, 
  onPlay, 
  onLike, 
  onShare 
}: TrackCardProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [imageLoaded, setImageLoaded] = useState(false)
  
  // Lazy loading with intersection observer
  const { ref, inView } = useInView({
    triggerOnce: true,
    threshold: 0.1,
    rootMargin: '50px',
  })

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
      transition={{ 
        duration: 0.4, 
        delay: index * 0.05, // Staggered animation
        ease: [0.25, 0.46, 0.45, 0.94] 
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cardStyles.track}
    >
      {/* Album Art */}
      <div className="relative aspect-square overflow-hidden">
        {inView && (
          <>
            {!imageLoaded && (
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-purple-500/10 animate-pulse" />
            )}
            {track.imageUrl && /\.(mp4|webm|mov)($|\?)/.test(track.imageUrl) ? (
              <video
                src={track.imageUrl}
                className={`w-full h-full object-cover transition-all duration-500 ${
                  isHovered ? 'scale-110' : 'scale-100'
                }`}
                muted
                loop
                playsInline
                autoPlay
                onLoadedData={() => setImageLoaded(true)}
              />
            ) : (
              <img
                src={track.imageUrl || '/placeholder-track.png'}
                alt={track.title}
                loading="lazy"
                onLoad={() => setImageLoaded(true)}
                className={`w-full h-full object-cover transition-all duration-500 ${
                  isHovered ? 'scale-110' : 'scale-100'
                } ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
              />
            )}
          </>
        )}
        
        {/* Hover Overlay */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: isHovered ? 1 : 0 }}
          transition={{ duration: 0.2 }}
          className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent flex items-center justify-center"
        >
          <motion.button
            onClick={() => onPlay(track)}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            className="w-16 h-16 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-full flex items-center justify-center shadow-2xl shadow-cyan-500/50 hover:shadow-cyan-500/70 transition-all"
          >
            <Play className="w-7 h-7 text-white fill-white ml-1" />
          </motion.button>
        </motion.div>

        {/* Top Right Actions */}
        <div className="absolute top-2 right-2 flex gap-1">
          {onLike && (
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={(e) => {
                e.stopPropagation()
                onLike(track.id)
              }}
              className="w-8 h-8 bg-black/60 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-red-500/80 transition-colors group"
            >
              <Heart className="w-4 h-4 text-white group-hover:fill-white transition-all" />
            </motion.button>
          )}
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            className="w-8 h-8 bg-black/60 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white/20 transition-colors"
          >
            <MoreVertical className="w-4 h-4 text-white" />
          </motion.button>
        </div>
      </div>

      {/* Track Info */}
      <div className="p-4">
        <h3 className="text-white font-bold text-sm mb-1 truncate">
          {track.title}
        </h3>
        {track.artist && (
          <p className="text-gray-400 text-xs mb-3 truncate">{track.artist}</p>
        )}
        
        <div className="flex items-center justify-between text-xs text-gray-400">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <Play className="w-3 h-3" />
              {track.plays.toLocaleString()}
            </span>
            {track.likes !== undefined && (
              <span className="flex items-center gap-1">
                <Heart className="w-3 h-3" />
                {track.likes}
              </span>
            )}
          </div>
          
          {onShare && (
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={(e) => {
                e.stopPropagation()
                onShare(track.id)
              }}
              className="text-cyan-400 hover:text-cyan-300 transition-colors"
            >
              <Share2 className="w-3 h-3" />
            </motion.button>
          )}
        </div>
      </div>
    </motion.div>
  )
}
