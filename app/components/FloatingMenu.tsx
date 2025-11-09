'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useUser, UserButton } from '@clerk/nextjs'
import { Menu, X, Home, Zap, Library, Compass, BarChart3, User, LogIn, UserPlus, Unlock, CreditCard, Settings } from 'lucide-react'
import ProfileSettingsModal from './ProfileSettingsModal'

export default function FloatingMenu() {
  const { user } = useUser()
  const [isOpen, setIsOpen] = useState(false)
  const [credits, setCredits] = useState<number | null>(null)
  const [isLoadingCredits, setIsLoadingCredits] = useState(true)
  const [username, setUsername] = useState<string>('')
  const [isLoadingUsername, setIsLoadingUsername] = useState(true)
  const [showSettingsModal, setShowSettingsModal] = useState(false)

  // Fetch real credits from API
  useEffect(() => {
    if (user) {
      fetch('/api/credits')
        .then(res => res.json())
        .then(data => {
          setCredits(data.credits || 0)
          setIsLoadingCredits(false)
        })
        .catch(err => {
          console.error('Failed to fetch credits:', err)
          setCredits(0)
          setIsLoadingCredits(false)
        })
    }
  }, [user])

  // Fetch username from Supabase (source of truth)
  useEffect(() => {
    if (user) {
      fetch(`/api/media/profile/${user.id}`)
        .then(res => res.json())
        .then(data => {
          if (data.success && data.username) {
            setUsername(data.username)
          }
          setIsLoadingUsername(false)
        })
        .catch(err => {
          console.error('Failed to fetch username:', err)
          setIsLoadingUsername(false)
        })
    }
  }, [user])

  return (
    <>
      {/* Floating Hamburger Button - Desktop Only (hidden on mobile) */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="hidden md:block fixed top-6 right-6 z-[60] p-3 md:p-4 bg-white/10 backdrop-blur-2xl border border-white/20 rounded-full shadow-2xl hover:bg-white/20 transition-all active:scale-95"
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
                    <UserButton afterSignOutUrl="/" />
                    <div>
                      <p className="text-white font-semibold">{user.firstName || 'User'}</p>
                      <p className="text-gray-400 text-sm">@{isLoadingUsername ? '...' : (username || 'username')}</p>
                    </div>
                  </div>
                  
                  {/* Credits */}
                  <div className="flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-xl border border-white/20 rounded-full w-fit">
                    <Zap className="text-[#22D3EE]" size={18} />
                    <span className="text-white font-bold text-sm">
                      {isLoadingCredits ? '...' : `${credits} credits`}
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
                      href="/studio"
                      onClick={() => setIsOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-purple-600/20 to-pink-500/20 border border-purple-500/40 text-purple-300 hover:from-purple-600/30 hover:to-pink-500/30 rounded-xl transition-all shadow-lg shadow-purple-500/10"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
                      <span className="font-semibold">Studio</span>
                      <span className="ml-auto text-xs bg-purple-500/20 text-purple-200 px-2 py-1 rounded-full">Pro</span>
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
                    <button
                      onClick={() => {
                        if (!isLoadingUsername && username) {
                          setShowSettingsModal(true)
                          setIsOpen(false)
                        }
                      }}
                      disabled={isLoadingUsername}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-white hover:bg-white/10 rounded-xl transition-colors ${isLoadingUsername ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <Settings size={20} />
                      <span className="font-medium">Settings</span>
                    </button>
                    <Link
                      href={`/profile/${user.id}`}
                      onClick={() => setIsOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 text-white hover:bg-white/10 rounded-xl transition-colors"
                    >
                      <User size={20} />
                      <span className="font-medium">Profile</span>
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
          currentAvatar={user.imageUrl}
          onUpdate={() => {
            // Refresh username after update
            if (user) {
              fetch(`/api/media/profile/${user.id}`)
                .then(res => res.json())
                .then(data => {
                  if (data.success && data.username) {
                    setUsername(data.username)
                  }
                })
                .catch(err => console.error('Failed to refresh username:', err))
            }
          }}
        />
      )}
    </>
  )
}

