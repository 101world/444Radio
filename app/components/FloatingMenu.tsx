'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useUser, UserButton } from '@clerk/nextjs'
import { Menu, X, Home, Zap, Library, Compass, BarChart3, User, LogIn, UserPlus } from 'lucide-react'

export default function FloatingMenu() {
  const { user } = useUser()
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      {/* Floating Hamburger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed top-6 right-6 z-50 p-4 bg-white/10 backdrop-blur-2xl border border-white/20 rounded-full shadow-2xl hover:bg-white/20 transition-all"
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
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Menu Panel */}
          <div className="fixed top-0 right-0 h-full w-80 bg-black/90 backdrop-blur-2xl border-l border-white/10 z-40 shadow-2xl animate-slideIn">
            <div className="flex flex-col h-full p-8 pt-24">
              
              {/* User Section */}
              {user && (
                <div className="mb-8 pb-6 border-b border-white/10">
                  <div className="flex items-center gap-3 mb-4">
                    <UserButton afterSignOutUrl="/" />
                    <div>
                      <p className="text-white font-semibold">{user.firstName || 'User'}</p>
                      <p className="text-gray-400 text-sm">@{user.username || 'username'}</p>
                    </div>
                  </div>
                  
                  {/* Credits */}
                  <div className="flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-xl border border-white/20 rounded-full w-fit">
                    <Zap className="text-[#5a8fc7]" size={18} />
                    <span className="text-white font-bold text-sm">20 credits</span>
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
                      className="flex items-center gap-3 px-4 py-3 text-white hover:bg-white/10 rounded-xl transition-colors"
                    >
                      <Zap size={20} />
                      <span className="font-medium">Create</span>
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
                      href="/explore"
                      onClick={() => setIsOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 text-white hover:bg-white/10 rounded-xl transition-colors"
                    >
                      <Compass size={20} />
                      <span className="font-medium">Explore</span>
                    </Link>
                    <Link
                      href="/billboard"
                      onClick={() => setIsOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 text-white hover:bg-white/10 rounded-xl transition-colors"
                    >
                      <BarChart3 size={20} />
                      <span className="font-medium">Charts</span>
                    </Link>
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
                      href="/explore"
                      onClick={() => setIsOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 text-white hover:bg-white/10 rounded-xl transition-colors"
                    >
                      <Compass size={20} />
                      <span className="font-medium">Explore</span>
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
    </>
  )
}
