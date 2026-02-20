'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useUser, UserButton } from '@clerk/nextjs'
import { Menu, X, Home, Zap, Library, Compass, BarChart3, User, LogIn, UserPlus, Unlock, CreditCard, Settings, DollarSign } from 'lucide-react'
import ProfileSettingsModal from './ProfileSettingsModal'
import { useCredits } from '@/app/contexts/CreditsContext'

export default function FloatingMenu() {
  const { user } = useUser()
  const [isOpen, setIsOpen] = useState(false)
  const { totalCredits, isLoading: isLoadingCredits } = useCredits()
  const [username, setUsername] = useState<string>('')
  const [avatarUrl, setAvatarUrl] = useState<string>('')
  const [isLoadingUsername, setIsLoadingUsername] = useState(true)
  const [showSettingsModal, setShowSettingsModal] = useState(false)

  // Fetch username from Supabase (source of truth)
  useEffect(() => {
    if (user) {
      fetchUserProfile()
    }
  }, [user])
  
  const fetchUserProfile = () => {
    if (!user) return
    
    fetch(`/api/media/profile/${user.id}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          if (data.username) {
            setUsername(data.username)
          }
          if (data.avatar_url) {
            setAvatarUrl(data.avatar_url)
          }
        }
        setIsLoadingUsername(false)
      })
      .catch(err => {
        console.error('Failed to fetch username:', err)
        setIsLoadingUsername(false)
      })
  }

  return (
    <>
      {/* FloatingMenu is replaced by FloatingNavButton on mobile — hide trigger completely */}
      {/* The slide-out panel is kept for any desktop edge cases but trigger is hidden */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="hidden"
        aria-label="Menu"
      >
        {isOpen ? (
          <X className="text-white" size={24} />
        ) : (
          <Menu className="text-white" size={24} />
        )}
      </button>

      {/* Menu Overlay */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[55]"
            onClick={() => setIsOpen(false)}
          />

          {/* Menu Panel - Responsive Width */}
          <div className="fixed top-0 right-0 h-full w-full sm:w-96 md:w-80 bg-black/95 md:bg-black/90 backdrop-blur-2xl border-l border-white/10 z-[55] shadow-2xl animate-slideIn overflow-y-auto">
            <div className="flex flex-col h-full p-6 sm:p-8 pt-20 sm:pt-24">
              
              {/* User Section */}
              {user && (
                <div className="mb-8 pb-6 border-b border-white/10">
                  <div className="flex items-center gap-3 mb-4">
                    {/* Custom Avatar Display */}
                    <div className="relative">
                      <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-cyan-500 to-blue-500 border-2 border-white/20">
                        {avatarUrl ? (
                          <img 
                            src={avatarUrl} 
                            alt={username || 'User'} 
                            className="w-full h-full object-cover"
                          />
                        ) : user.imageUrl ? (
                          <img 
                            src={user.imageUrl} 
                            alt={user.firstName || 'User'} 
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <User size={24} className="text-white w-full h-full p-2" />
                        )}
                      </div>
                      {/* Clerk UserButton (hidden, just for account management menu) */}
                      <div className="absolute -bottom-1 -right-1">
                        <UserButton afterSignOutUrl="/" />
                      </div>
                    </div>
                    <div>
                      <p className="text-white font-semibold">{user.firstName || 'User'}</p>
                      <p className="text-gray-400 text-sm">@{isLoadingUsername ? '...' : (username || 'username')}</p>
                    </div>
                  </div>
                  
                  {/* Credits */}
                  <div className="flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-xl border border-white/20 rounded-full w-fit">
                    <Zap className="text-[#22D3EE]" size={18} />
                    <span className="text-white font-bold text-sm">
                      {isLoadingCredits ? '...' : `${totalCredits} credits`}
                    </span>
                  </div>
                </div>
              )}

              {/* Navigation Links */}
              <nav className="flex-1 space-y-2">
                {user ? (
                  <>
                    <Link
                      href="/"
                      onClick={() => setIsOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 text-white hover:bg-white/10 rounded-xl transition-colors"
                    >
                      <Home size={20} />
                      <span className="font-medium">Home</span>
                    </Link>
                    <Link
                      href="/create"
                      onClick={() => setIsOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-cyan-600/20 to-cyan-400/20 border border-cyan-500/40 text-cyan-400 hover:from-cyan-600/30 hover:to-cyan-400/30 rounded-xl transition-all shadow-lg shadow-cyan-500/10"
                    >
                      <Zap size={20} />
                      <span className="font-semibold">Create</span>
                      <span className="ml-auto text-xs bg-cyan-500/20 text-cyan-300 px-2 py-1 rounded-full">Suggested</span>
                    </Link>
                    <Link
                      href="/explore"
                      onClick={() => setIsOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 text-white hover:bg-white/10 rounded-xl transition-colors"
                    >
                      <Compass size={20} />
                      <span className="font-medium">Explore</span>
                    </Link>
                    <Link
                      href="/library"
                      onClick={() => setIsOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 text-white hover:bg-white/10 rounded-xl transition-colors"
                    >
                      <Library size={20} />
                      <span className="font-medium">Library</span>
                    </Link>
                    <Link
                      href="/decrypt"
                      onClick={() => setIsOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 text-cyan-400 hover:bg-cyan-500/10 rounded-xl transition-colors border border-cyan-500/30"
                    >
                      <Unlock size={20} />
                      <span className="font-medium">Decrypt</span>
                    </Link>
                    <Link
                      href="/pricing"
                      onClick={() => setIsOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 text-white hover:bg-white/10 rounded-xl transition-colors"
                    >
                      <CreditCard size={20} />
                      <span className="font-medium">Pricing</span>
                    </Link>
                    <Link
                      href="/earn"
                      onClick={() => setIsOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-emerald-600/20 to-cyan-500/20 border border-emerald-500/40 text-emerald-300 hover:from-emerald-600/30 hover:to-cyan-500/30 rounded-xl transition-all"
                    >
                      <DollarSign size={20} />
                      <span className="font-semibold">Earn</span>
                      <span className="ml-auto text-xs bg-emerald-500/20 text-emerald-300 px-2 py-1 rounded-full">New</span>
                    </Link>
                    <Link
                      href="/settings"
                      onClick={() => setIsOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 text-white hover:bg-white/10 rounded-xl transition-colors"
                    >
                      <Settings size={20} />
                      <span className="font-medium">Settings</span>
                    </Link>
                    <Link
                      href={`/profile/${user.id}`}
                      onClick={() => setIsOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-cyan-600/20 to-blue-500/20 border border-cyan-500/30 text-cyan-400 hover:from-cyan-600/30 hover:to-blue-500/30 rounded-xl transition-all"
                    >
                      <div className="w-6 h-6 rounded-full overflow-hidden bg-gradient-to-br from-cyan-500 to-blue-500 flex-shrink-0">
                        {avatarUrl ? (
                          <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
                        ) : (
                          <User size={14} className="text-white w-full h-full p-1" />
                        )}
                      </div>
                      <span className="font-semibold">My Profile</span>
                      <span className="ml-auto text-xs">🎤</span>
                    </Link>
                  </>
                ) : (
                  <>
                    <Link
                      href="/"
                      onClick={() => setIsOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 text-white hover:bg-white/10 rounded-xl transition-colors"
                    >
                      <Home size={20} />
                      <span className="font-medium">Home</span>
                    </Link>
                    <Link
                      href="/create"
                      onClick={() => setIsOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-cyan-600/20 to-cyan-400/20 border border-cyan-500/40 text-cyan-400 hover:from-cyan-600/30 hover:to-cyan-400/30 rounded-xl transition-all shadow-lg shadow-cyan-500/10"
                    >
                      <Zap size={20} />
                      <span className="font-semibold">Create</span>
                      <span className="ml-auto text-xs bg-cyan-500/20 text-cyan-300 px-2 py-1 rounded-full">Suggested</span>
                    </Link>
                    <Link
                      href="/explore"
                      onClick={() => setIsOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 text-white hover:bg-white/10 rounded-xl transition-colors"
                    >
                      <Compass size={20} />
                      <span className="font-medium">Explore</span>
                    </Link>
                    <Link
                      href="/library"
                      onClick={() => setIsOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 text-white hover:bg-white/10 rounded-xl transition-colors"
                    >
                      <Library size={20} />
                      <span className="font-medium">Library</span>
                    </Link>
                    <Link
                      href="/decrypt"
                      onClick={() => setIsOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 text-cyan-400 hover:bg-cyan-500/10 rounded-xl transition-colors border border-cyan-500/30"
                    >
                      <Unlock size={20} />
                      <span className="font-medium">Decrypt</span>
                    </Link>
                    <a
                      href="https://www.thesocialtwin.com/billboard"
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => setIsOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 text-white hover:bg-white/10 rounded-xl transition-colors"
                    >
                      <BarChart3 size={20} />
                      <span className="font-medium">Charts</span>
                    </a>
                    <Link
                      href="/pricing"
                      onClick={() => setIsOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 text-white hover:bg-white/10 rounded-xl transition-colors"
                    >
                      <CreditCard size={20} />
                      <span className="font-medium">Pricing</span>
                    </Link>
                    <Link
                      href="/earn"
                      onClick={() => setIsOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-emerald-600/20 to-cyan-500/20 border border-emerald-500/40 text-emerald-300 hover:from-emerald-600/30 hover:to-cyan-500/30 rounded-xl transition-all"
                    >
                      <DollarSign size={20} />
                      <span className="font-semibold">Earn</span>
                      <span className="ml-auto text-xs bg-emerald-500/20 text-emerald-300 px-2 py-1 rounded-full">New</span>
                    </Link>
                    <Link
                      href="/profile"
                      onClick={() => setIsOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 text-white hover:bg-white/10 rounded-xl transition-colors"
                    >
                      <User size={20} />
                      <span className="font-medium">Profile</span>
                    </Link>
                    <Link
                      href="/sign-in"
                      onClick={() => setIsOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 text-white hover:bg-white/10 rounded-xl transition-colors mt-8"
                    >
                      <LogIn size={20} />
                      <span className="font-medium">Sign In</span>
                    </Link>
                    <Link
                      href="/sign-up"
                      onClick={() => setIsOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 bg-white text-black hover:bg-gray-200 rounded-xl transition-colors font-semibold"
                    >
                      <UserPlus size={20} />
                      <span>Join Free</span>
                    </Link>
                  </>
                )}
              </nav>

              {/* Footer */}
              <div className="pt-6 border-t border-white/10">
                <p className="text-gray-500 text-xs text-center">© 2025 444RADIO</p>
              </div>
            </div>
          </div>
        </>
      )}

      <style jsx>{`
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        .animate-slideIn {
          animation: slideIn 0.3s ease-out;
        }
      `}</style>

      {/* Profile Settings Modal */}
      {user && (
        <ProfileSettingsModal
          isOpen={showSettingsModal}
          onClose={() => setShowSettingsModal(false)}
          currentUsername={username || 'Loading...'}
          currentAvatar={avatarUrl || user.imageUrl}
          onUpdate={() => {
            // Refresh user profile data (username + avatar) after update
            fetchUserProfile()
          }}
        />
      )}
    </>
  )
}

