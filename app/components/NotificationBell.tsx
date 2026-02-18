"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { useUser } from '@clerk/nextjs';
import { useAudioPlayer } from '@/app/contexts/AudioPlayerContext';
import Link from 'next/link';
import {
  Bell,
  Music,
  Image,
  Video,
  Sparkles,
  Scissors,
  Volume2,
  ShoppingCart,
  Tag,
  Send,
  Gift,
  RefreshCw,
  Zap,
  Filter,
  X,
  Wallet,
  Info,
} from 'lucide-react';

interface Transaction {
  id: string;
  type: string;
  amount: number;
  description: string | null;
  status: string;
  balance_after: number | null;
  created_at: string;
  metadata?: Record<string, any>;
}

const txTypeLabel = (type: string) => {
  const map: Record<string, string> = {
    generation_music: 'Music Generation',
    generation_effects: 'Sound Effects',
    generation_loops: 'Loop Generation',
    generation_image: 'Image Generation',
    generation_video_to_audio: 'Video-to-Audio',
    generation_cover_art: 'Cover Art',
    generation_stem_split: 'Stem Split',
    generation_audio_boost: 'Audio Boost',
    generation_autotune: 'Autotune',
    generation_video: '444 Visualizer',
    generation_extract: 'Audio Extract',
    earn_list: 'Earn Listing',
    earn_purchase: 'Earn Purchase',
    earn_sale: 'Earn Sale',
  };
  return map[type] || type;
};

import { usePathname, useRouter } from 'next/navigation'

function NotificationBell() {
  const { user, isLoaded } = useUser()
  const pathname = usePathname()
  const router = useRouter()

  if (!isLoaded || !user) return null

  const onClick = () => {
    router.push('/notifications')
  }

  // If we're on the create page, render a floating minimal bell next to the fixed CreditBadge
  if (pathname === '/create') {
    return (
      <button
        onClick={onClick}
        aria-label="Notifications"
        className="fixed top-4 right-16 z-50 p-2 text-gray-300 hover:text-white transition-colors"
        title="Notifications"
      >
        <Bell className="w-5 h-5" />
      </button>
    )
  }

  // Default header placement (no background)
  return (
    <button
      onClick={onClick}
      aria-label="Notifications"
      className="p-2 text-gray-300 hover:text-white transition-colors"
      title="Notifications"
    >
      <Bell className="w-5 h-5" />
    </button>
  )
}

export default NotificationBell;
