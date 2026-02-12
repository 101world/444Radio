'use client'

// Professional mobile navigation — slide-up panel with labeled icons
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { User, Compass, PlusCircle, Library, Menu, X, MessageSquare, Unlock, Settings, CreditCard, Home, Zap, DollarSign, LayoutGrid } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import ProfileSettingsModal from './ProfileSettingsModal'

interface FloatingNavButtonProps {
  onTogglePrompt?: () => void
  showPromptToggle?: boolean
  hideOnDesktop?: boolean
}

export default function FloatingNavButton({ onTogglePrompt, showPromptToggle = false, hideOnDesktop = false }: FloatingNavButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [username, setUsername] = useState<string>('')
  const [avatarUrl, setAvatarUrl] = useState<string>('')
  const [credits, setCredits] = useState<number | null>(null)
  const pathname = usePathname()
  const { user } = useUser()

  // If this is the global (no-props) instance, hide on /create where the page renders its own
  const isGlobalInstance = !showPromptToggle && !onTogglePrompt
  const shouldHide = isGlobalInstance && pathname === '/create'

  useEffect(() => {
    if (user) {
      fetchUserProfile()
      fetch('/api/credits')
        .then(res => res.json())
        .then(data => setCredits(data.credits || 0))
        .catch(() => setCredits(0))
    }
  }, [user])

  const fetchUserProfile = async () => {
    if (!user) return
    try {
      const res = await fetch(`/api/media/profile/${user.id}`)
      const data = await res.json()
      if (data.success) {
        if (data.username) setUsername(data.username)
        if (data.avatar_url) setAvatarUrl(data.avatar_url)
      }
    } catch (err) {
      console.error('Failed to fetch user profile:', err)
    }
  }

  const navItems = [
    { href: '/', icon: Home, label: 'Home' },
    { href: '/create', icon: Zap, label: 'Create', highlight: 'cyan' as const, badge: 'AI' },
    { href: '/explore', icon: Compass, label: 'Explore' },
    { href: '/library', icon: Library, label: 'Library' },
    {
      href: '/studio',
      icon: ({ size, className }: { size: number; className?: string }) => (
        <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
        </svg>
      ),
      label: 'Studio',
      highlight: 'purple' as const,
      badge: 'Pro'
    },
    { href: '/earn', icon: DollarSign, label: 'Earn', highlight: 'green' as const, badge: 'New' },
    { href: '/decrypt', icon: Unlock, label: 'Decrypt', highlight: 'cyan-outline' as const },
    { href: '/pricing', icon: CreditCard, label: 'Pricing' },
    { href: user?.id ? `/profile/${user.id}` : '/profile', icon: User, label: 'My Profile', highlight: 'cyan' as const, badge: '🎤' },
  ]

  if (shouldHide) return null

  return (
    <>
      {/* Mobile Navigation */}
      {!hideOnDesktop && (
        <div className="fixed z-50 md:hidden" style={{ bottom: '1.5rem', right: '1.5rem' }}>

          {/* Slide-up Panel */}
          {isOpen && (
            <>
              {/* Backdrop */}
              <div
                className="fixed inset-0 bg-black/60 backdrop-blur-sm -z-10"
                onClick={() => setIsOpen(false)}
              />

              {/* Panel */}
              <div className="fixed bottom-24 right-4 left-4 bg-black/95 backdrop-blur-2xl border border-cyan-500/20 rounded-2xl shadow-2xl shadow-cyan-500/10 overflow-hidden max-h-[75vh] overflow-y-auto"
                style={{ animation: 'slideUp 0.2s ease-out' }}>
                
                {/* User Header */}
                {user && (
                  <div className="flex items-center gap-3 px-5 pt-5 pb-3 border-b border-white/10">
                    <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-cyan-500 to-blue-500 border-2 border-cyan-500/30 flex-shrink-0">
                      {avatarUrl ? (
                        <img src={avatarUrl} alt={username || 'User'} className="w-full h-full object-cover" />
                      ) : user.imageUrl ? (
                        <img src={user.imageUrl} alt={user.firstName || 'User'} className="w-full h-full object-cover" />
                      ) : (
                        <User size={20} className="text-white w-full h-full p-2" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-semibold text-sm truncate">{user.firstName || 'User'}</p>
                      <p className="text-gray-400 text-xs truncate">@{username || 'username'}</p>
                    </div>
                    {credits !== null && (
                      <a
                        href="/settings?tab=wallet"
                        onClick={(e) => { e.stopPropagation() }}
                        className="flex items-center gap-1.5 px-3 py-1 bg-cyan-500/10 border border-cyan-500/30 hover:bg-cyan-500/20 rounded-full flex-shrink-0 transition-colors"
                      >
                        <Zap className="text-cyan-400" size={12} />
                        <span className="text-cyan-300 font-bold text-xs">{credits}</span>
                      </a>
                    )}
                  </div>
                )}

                {/* Prompt Box Toggle (on create page) */}
                {showPromptToggle && onTogglePrompt && (
                  <div className="px-3 pt-3">
                    <button
                      onClick={() => { onTogglePrompt(); setIsOpen(false) }}
                      className="w-full flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-cyan-500/15 to-blue-500/15 border border-cyan-500/30 rounded-xl text-cyan-400 active:scale-[0.98] transition-all"
                    >
                      <MessageSquare size={18} />
                      <span className="font-medium text-sm">Toggle Prompt Box</span>
                    </button>
                  </div>
                )}

                {/* Features Button (on create page only) */}
                {pathname === '/create' && (
                  <div className="px-3 pt-2">
                    <button
                      onClick={() => {
                        window.dispatchEvent(new CustomEvent('toggle-features-sidebar'))
                        setIsOpen(false)
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-purple-500/15 to-cyan-500/15 border border-purple-500/30 rounded-xl text-purple-300 active:scale-[0.98] transition-all"
                    >
                      <LayoutGrid size={18} />
                      <span className="font-medium text-sm">Features</span>
                      <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-200">Tools</span>
                    </button>
                  </div>
                )}

                {/* Navigation List */}
                <nav className="p-3 space-y-1">
                  {navItems.map((item) => {
                    const Icon = item.icon
                    const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
                    const highlight = (item as any).highlight
                    const badge = (item as any).badge

                    let itemClass = 'flex items-center gap-3 px-4 py-3 rounded-xl transition-all active:scale-[0.98] '
                    if (isActive) {
                      itemClass += 'bg-white/15 text-white'
                    } else if (highlight === 'cyan') {
                      itemClass += 'bg-gradient-to-r from-cyan-600/15 to-cyan-400/15 border border-cyan-500/30 text-cyan-400'
                    } else if (highlight === 'purple') {
                      itemClass += 'bg-gradient-to-r from-purple-600/15 to-pink-500/15 border border-purple-500/30 text-purple-300'
                    } else if (highlight === 'green') {
                      itemClass += 'bg-gradient-to-r from-emerald-600/15 to-cyan-500/15 border border-emerald-500/30 text-emerald-300'
                    } else if (highlight === 'cyan-outline') {
                      itemClass += 'text-cyan-400 border border-cyan-500/25'
                    } else {
                      itemClass += 'text-gray-300 active:bg-white/10'
                    }

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setIsOpen(false)}
                        className={itemClass}
                      >
                        <Icon size={18} className={isActive ? 'text-white' : undefined} />
                        <span className="font-medium text-sm">{item.label}</span>
                        {badge && (
                          <span className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            highlight === 'cyan' ? 'bg-cyan-500/20 text-cyan-300' :
                            highlight === 'purple' ? 'bg-purple-500/20 text-purple-200' :
                            highlight === 'green' ? 'bg-emerald-500/20 text-emerald-300' :
                            'bg-white/15 text-white'
                          }`}>
                            {badge}
                          </span>
                        )}
                        {isActive && !badge && (
                          <div className="ml-auto w-1.5 h-1.5 rounded-full bg-cyan-400" />
                        )}
                      </Link>
                    )
                  })}

                  {/* Settings */}
                  <button
                    onClick={() => { setShowSettingsModal(true); setIsOpen(false) }}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-300 active:bg-white/10 transition-all active:scale-[0.98]"
                  >
                    <Settings size={18} />
                    <span className="font-medium text-sm">Settings</span>
                  </button>
                </nav>

                {/* Footer */}
                <div className="px-5 py-3 border-t border-white/10">
                  <p className="text-gray-600 text-[10px] text-center">&copy; 2025 444RADIO</p>
                </div>
              </div>
            </>
          )}

          {/* Floating Trigger Button — single cyan hamburger */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-200 shadow-2xl active:scale-90 ${
              isOpen
                ? 'bg-white/10 backdrop-blur-xl border-2 border-white/20'
                : 'bg-black/90 backdrop-blur-xl border-2 border-cyan-500/40 shadow-cyan-500/30'
            }`}
          >
            {isOpen ? (
              <X size={22} className="text-white" />
            ) : (
              <Menu size={22} className="text-cyan-400" strokeWidth={2.5} />
            )}
          </button>
        </div>
      )}

      {/* Slide-up keyframes */}
      <style jsx>{`
        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>

      {/* Settings Modal */}
      {showSettingsModal && user && (
        <ProfileSettingsModal
          isOpen={showSettingsModal}
          onClose={() => setShowSettingsModal(false)}
          currentUsername={username || user.firstName || 'User'}
          currentAvatar={avatarUrl || user.imageUrl || ''}
          onUpdate={() => fetchUserProfile()}
        />
      )}
    </>
  )
}
