'use client'

import { useState, useEffect } from 'react'
import { useUser } from '@clerk/nextjs'
import { Heart } from 'lucide-react'

interface LikeButtonProps {
  releaseId: string
  initialLiked?: boolean
  initialLikesCount?: number
  size?: 'sm' | 'md' | 'lg'
  showCount?: boolean
  className?: string
}

export default function LikeButton({
  releaseId,
  initialLiked = false,
  initialLikesCount = 0,
  size = 'md',
  showCount = true,
  className = ''
}: LikeButtonProps) {
  const { user, isSignedIn } = useUser()
  const [liked, setLiked] = useState(initialLiked)
  const [likesCount, setLikesCount] = useState(initialLikesCount)
  const [isLoading, setIsLoading] = useState(false)

  // Fetch initial like status when component mounts
  useEffect(() => {
    if (isSignedIn && releaseId) {
      fetchLikeStatus()
    }
  }, [isSignedIn, releaseId])

  const fetchLikeStatus = async () => {
    try {
      const res = await fetch(`/api/media/like?releaseId=${releaseId}`)
      const data = await res.json()
      
      if (data.success) {
        setLiked(data.liked)
        setLikesCount(data.likesCount)
      }
    } catch (error) {
      console.error('Failed to fetch like status:', error)
    }
  }

  const handleLike = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (!isSignedIn) {
      alert('Please sign in to like tracks')
      return
    }

    if (isLoading) return

    // Optimistic update
    const previousLiked = liked
    const previousCount = likesCount
    setLiked(!liked)
    setLikesCount(liked ? likesCount - 1 : likesCount + 1)
    setIsLoading(true)

    try {
      const res = await fetch('/api/media/like', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ releaseId })
      })

      const data = await res.json()

      if (!data.success) {
        // Revert on failure
        setLiked(previousLiked)
        setLikesCount(previousCount)
        throw new Error(data.error || 'Failed to update like')
      }

      // Update with server response
      setLiked(data.liked)
      setLikesCount(data.likesCount)
    } catch (error) {
      console.error('Like error:', error)
      // Already reverted in optimistic update
    } finally {
      setIsLoading(false)
    }
  }

  const sizeClasses = {
    sm: 'p-1.5',
    md: 'p-2',
    lg: 'p-3'
  }

  const iconSizes = {
    sm: 14,
    md: 18,
    lg: 24
  }

  const textSizes = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base'
  }

  return (
    <button
      onClick={handleLike}
      disabled={isLoading}
      className={`group flex items-center gap-1.5 ${sizeClasses[size]} rounded-lg transition-all ${
        liked
          ? 'bg-red-500/20 border border-red-500/40 hover:bg-red-500/30'
          : 'bg-white/5 border border-white/10 hover:bg-white/10'
      } ${isLoading ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'} ${className}`}
      title={liked ? 'Unlike' : 'Like'}
    >
      <Heart
        size={iconSizes[size]}
        className={`transition-all ${
          liked
            ? 'fill-red-500 text-red-500'
            : 'text-gray-400 group-hover:text-red-400'
        } ${isLoading ? 'animate-pulse' : ''}`}
      />
      {showCount && (
        <span
          className={`font-semibold ${textSizes[size]} ${
            liked ? 'text-red-400' : 'text-gray-400 group-hover:text-gray-300'
          }`}
        >
          {likesCount}
        </span>
      )}
    </button>
  )
}
