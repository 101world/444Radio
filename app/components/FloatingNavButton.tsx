'use client'

import { useState } from 'react'
import Link from 'next/link'
import { User, Compass, PlusCircle, Library, Menu, X, MessageSquare, Unlock, Settings } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import ProfileSettingsModal from './ProfileSettingsModal'

interface FloatingNavButtonProps {
  onTogglePrompt?: () => void
  showPromptToggle?: boolean
  hideOnDesktop?: boolean // Hide desktop version (for profile pages)
}

export default function FloatingNavButton({ onTogglePrompt, showPromptToggle = false, hideOnDesktop = false }: FloatingNavButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const pathname = usePathname()
  const { user } = useUser()

  const navItems = [
    { href: user ? `/profile/${user.id}` : '/profile', icon: User, label: 'Profile' },
    { href: '/explore', icon: Compass, label: 'Explore' },
    { href: '/create', icon: PlusCircle, label: 'Create' },
    { href: '/library', icon: Library, label: 'Library' },
    { href: '/decrypt', icon: Unlock, label: 'Decrypt', highlight: true },
  ]

  return (
    <>
      {/* Mobile Version - Bottom Right at 66.67% */}
      <div className="fixed right-4 z-50 md:hidden" style={{ top: '66.67%' }}>
        {/* Navigation Items - Appear when open */}
        {isOpen && (
          <div className="absolute bottom-16 right-0 flex flex-col gap-3 mb-2">
          {/* Prompt Box Toggle Button - First in list */}
          {showPromptToggle && onTogglePrompt && (
            <button
              onClick={() => {
                onTogglePrompt()
                setIsOpen(false)
              }}
              className="group relative flex items-center gap-3 transition-all duration-300 animate-slide-in"
            >
              {/* Label */}
              <div className="absolute right-16 bg-black/90 backdrop-blur-xl border border-cyan-500/30 rounded-xl px-4 py-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap">
                <span className="text-sm font-medium text-cyan-300">Prompt Box</span>
              </div>
              
              {/* Icon Button */}
              <div className="w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 shadow-lg bg-black/80 backdrop-blur-xl border-2 border-cyan-500/30 hover:border-cyan-400 hover:scale-105">
                <MessageSquare 
                  size={20} 
                  className="text-cyan-400"
                  strokeWidth={2.5}
                />
              </div>
            </button>
          )}

          {navItems.map((item, index) => {
            const Icon = item.icon
            const isActive = pathname === item.href || 
                           (item.href !== '/' && pathname.startsWith(item.href))
            const isDecrypt = item.label === 'Decrypt'
            
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsOpen(false)}
                className={`group relative flex items-center gap-3 transition-all duration-300 animate-slide-in`}
                style={{ animationDelay: `${(showPromptToggle ? index + 1 : index) * 50}ms` }}
              >
                {/* Label */}
                <div className={`absolute right-16 bg-black/90 backdrop-blur-xl border rounded-xl px-4 py-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap ${
                  isDecrypt ? 'border-cyan-400' : 'border-cyan-500/30'
                }`}>
                  <span className={`text-sm font-medium ${isDecrypt ? 'text-cyan-300' : 'text-cyan-300'}`}>{item.label}</span>
                </div>
                
                {/* Icon Button */}
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 shadow-lg ${
                    isActive
                      ? 'bg-gradient-to-r from-cyan-600 to-cyan-400 shadow-cyan-500/50 scale-110'
                      : isDecrypt
                      ? 'bg-gradient-to-r from-cyan-500/20 to-cyan-600/20 backdrop-blur-xl border-2 border-cyan-400/50 hover:border-cyan-300 hover:scale-105 animate-pulse'
                      : 'bg-black/80 backdrop-blur-xl border-2 border-cyan-500/30 hover:border-cyan-400 hover:scale-105'
                  }`}
                >
                  <Icon 
                    size={20} 
                    className={isActive ? 'text-black' : 'text-cyan-400'}
                    strokeWidth={2.5}
                  />
                </div>
              </Link>
            )
          })}

          {/* Settings Button - Last Item */}
          <button
            onClick={() => {
              setShowSettingsModal(true)
              setIsOpen(false)
            }}
            className="group relative flex items-center gap-3 transition-all duration-300 animate-slide-in"
            style={{ animationDelay: `${(showPromptToggle ? navItems.length + 1 : navItems.length) * 50}ms` }}
          >
            {/* Label */}
            <div className="absolute right-16 bg-black/90 backdrop-blur-xl border border-cyan-500/30 rounded-xl px-4 py-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap">
              <span className="text-sm font-medium text-cyan-300">Settings</span>
            </div>
            
            {/* Icon Button */}
            <div className="w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 shadow-lg bg-black/80 backdrop-blur-xl border-2 border-cyan-500/30 hover:border-cyan-400 hover:scale-105">
              <Settings 
                size={20} 
                className="text-cyan-400"
                strokeWidth={2.5}
              />
            </div>
          </button>
        </div>
      )}

      {/* Main Toggle Button - Mobile */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 shadow-2xl active:scale-90 md:hidden ${
          isOpen
            ? 'bg-gradient-to-r from-cyan-600 to-cyan-400 shadow-cyan-500/60 rotate-90'
            : 'bg-black/90 backdrop-blur-xl border-2 border-cyan-500/40 shadow-cyan-500/30 hover:border-cyan-400 hover:shadow-cyan-500/50 hover:scale-110'
        }`}
      >
        {isOpen ? (
          <X size={24} className="text-black" strokeWidth={2.5} />
        ) : (
          <Menu size={24} className="text-cyan-400" strokeWidth={2.5} />
        )}
      </button>

      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm -z-10"
          onClick={() => setIsOpen(false)}
        />
      )}
      </div>

      {/* Desktop Version - Top Right (hidden on profile pages) */}
      {!hideOnDesktop && (
        <div className="fixed top-4 right-4 z-50 hidden md:block">
          {/* Navigation Items - Appear when open */}
          {isOpen && (
            <div className="absolute top-16 right-0 flex flex-col gap-3 mt-2">
          {/* Prompt Box Toggle Button - First in list */}
          {showPromptToggle && onTogglePrompt && (
            <button
              onClick={() => {
                onTogglePrompt()
                setIsOpen(false)
              }}
              className="group relative flex items-center gap-3 transition-all duration-300 animate-slide-in"
            >
              {/* Label */}
              <div className="absolute right-16 bg-black/90 backdrop-blur-xl border border-cyan-500/30 rounded-xl px-4 py-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap">
                <span className="text-sm font-medium text-cyan-300">Prompt Box</span>
              </div>
              
              {/* Icon Button */}
              <div className="w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 shadow-lg bg-black/80 backdrop-blur-xl border-2 border-cyan-500/30 hover:border-cyan-400 hover:scale-105">
                <MessageSquare 
                  size={20} 
                  className="text-cyan-400"
                  strokeWidth={2.5}
                />
              </div>
            </button>
          )}

          {navItems.map((item, index) => {
            const Icon = item.icon
            const isActive = pathname === item.href || 
                           (item.href !== '/' && pathname.startsWith(item.href))
            const isDecrypt = item.label === 'Decrypt'
            
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsOpen(false)}
                className={`group relative flex items-center gap-3 transition-all duration-300 animate-slide-in`}
                style={{ animationDelay: `${(showPromptToggle ? index + 1 : index) * 50}ms` }}
              >
                {/* Label */}
                <div className={`absolute right-16 bg-black/90 backdrop-blur-xl border rounded-xl px-4 py-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap ${
                  isDecrypt ? 'border-cyan-400' : 'border-cyan-500/30'
                }`}>
                  <span className={`text-sm font-medium ${isDecrypt ? 'text-cyan-300' : 'text-cyan-300'}`}>{item.label}</span>
                </div>
                
                {/* Icon Button */}
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 shadow-lg ${
                    isActive
                      ? 'bg-gradient-to-r from-cyan-600 to-cyan-400 shadow-cyan-500/50 scale-110'
                      : isDecrypt
                      ? 'bg-gradient-to-r from-cyan-500/20 to-cyan-600/20 backdrop-blur-xl border-2 border-cyan-400/50 hover:border-cyan-300 hover:scale-105 animate-pulse'
                      : 'bg-black/80 backdrop-blur-xl border-2 border-cyan-500/30 hover:border-cyan-400 hover:scale-105'
                  }`}
                >
                  <Icon 
                    size={20} 
                    className={isActive ? 'text-black' : 'text-cyan-400'}
                    strokeWidth={2.5}
                  />
                </div>
              </Link>
            )
          })}

          {/* Settings Button - Last Item */}
          <button
            onClick={() => {
              setShowSettingsModal(true)
              setIsOpen(false)
            }}
            className="group relative flex items-center gap-3 transition-all duration-300 animate-slide-in"
            style={{ animationDelay: `${(showPromptToggle ? navItems.length + 1 : navItems.length) * 50}ms` }}
          >
            {/* Label */}
            <div className="absolute right-16 bg-black/90 backdrop-blur-xl border border-cyan-500/30 rounded-xl px-4 py-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap">
              <span className="text-sm font-medium text-cyan-300">Settings</span>
            </div>
            
            {/* Icon Button */}
            <div className="w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 shadow-lg bg-black/80 backdrop-blur-xl border-2 border-cyan-500/30 hover:border-cyan-400 hover:scale-105">
              <Settings 
                size={20} 
                className="text-cyan-400"
                strokeWidth={2.5}
              />
            </div>
          </button>
        </div>
      )}

      {/* Main Toggle Button - Desktop */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 shadow-2xl active:scale-90 hidden md:flex ${
          isOpen
            ? 'bg-black/90 backdrop-blur-xl border-2 border-cyan-500/40 rotate-90'
            : 'bg-black/90 backdrop-blur-xl border-2 border-cyan-500/40 shadow-cyan-500/30 hover:border-cyan-400 hover:shadow-cyan-500/50 hover:scale-110'
        }`}
      >
        {isOpen ? (
          <X size={24} className="text-cyan-400" strokeWidth={2.5} />
        ) : (
          <Menu size={24} className="text-cyan-400" strokeWidth={2.5} />
        )}
      </button>

      {/* Backdrop - Desktop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm -z-10"
          onClick={() => setIsOpen(false)}
        />
      )}
        </div>
      )}

      {/* Settings Modal */}
      {showSettingsModal && user && (
        <ProfileSettingsModal
          isOpen={showSettingsModal}
          onClose={() => setShowSettingsModal(false)}
          currentUsername={user.username || user.firstName || 'User'}
          currentAvatar={user.imageUrl || ''}
          onUpdate={() => {
            // Force page refresh to update displayed data
            window.location.reload()
          }}
        />
      )}
    </>
  )
}
