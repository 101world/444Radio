'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useUser, UserButton } from '@clerk/nextjs'
import { usePathname } from 'next/navigation'
import { Home, Zap, Library, Compass, User, Unlock, CreditCard, Settings, LogIn, UserPlus, LayoutGrid, DollarSign, Swords } from 'lucide-react'
import { useCredits } from '@/app/contexts/CreditsContext'

interface MenuItem {
  icon: any
  label: string
  href: string
  highlight?: boolean | 'purple' | 'cyan' | 'white'
  badge?: string
  external?: boolean
  divider?: boolean
}

export default function DockedSidebar() {
  const { user } = useUser()
  const pathname = usePathname()
  const [isExpanded, setIsExpanded] = useState(false)
  const [collapseTimeout, setCollapseTimeout] = useState<NodeJS.Timeout | null>(null)
  const { credits } = useCredits()
  const [username, setUsername] = useState<string>('')
  const [avatarUrl, setAvatarUrl] = useState<string>('')

  // Fetch user profile
  useEffect(() => {
    if (user) {
      fetch(`/api/media/profile/${user.id}`)
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            if (data.username) setUsername(data.username)
            if (data.avatar_url) setAvatarUrl(data.avatar_url)
          }
        })
        .catch(() => {})
    }
  }, [user])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (collapseTimeout) {
        clearTimeout(collapseTimeout)
      }
    }
  }, [collapseTimeout])

  // Handle mouse enter - cancel any pending collapse
  const handleMouseEnter = () => {
    if (collapseTimeout) {
      clearTimeout(collapseTimeout)
      setCollapseTimeout(null)
    }
    setIsExpanded(true)
  }

  // Handle mouse leave - delay collapse to allow interaction with dropdowns
  const handleMouseLeave = () => {
    const timeout = setTimeout(() => {
      setIsExpanded(false)
    }, 800) // Increased delay to 800ms for comfortable dropdown interaction
    setCollapseTimeout(timeout)
  }

  // Hide on /plugin — plugin uses its own token-based auth, not Clerk
  if (pathname === '/plugin' || pathname?.startsWith('/plugin')) return null

  // Hide on home page and pricing pages
  const hiddenPages = ['/', '/pricing']
  if (hiddenPages.includes(pathname)) {
    return null
  }

  const menuItems: MenuItem[] = user ? [
    { icon: Home, label: 'Home', href: '/', highlight: false },
    { icon: Zap, label: 'Create', href: '/create', highlight: true, badge: 'Suggested' },
    { icon: Compass, label: 'Explore', href: '/explore', highlight: false },
    { icon: Library, label: 'Library', href: '/library', highlight: false },
    { icon: Unlock, label: 'Decrypt', href: '/decrypt', highlight: 'cyan' },
    { icon: CreditCard, label: 'Pricing', href: '/pricing', highlight: false },
    { icon: DollarSign, label: 'Earn', href: '/earn', highlight: 'purple', badge: 'New' },
    { icon: Swords, label: 'Quests', href: '/quests', highlight: 'cyan', badge: '🎮' },
    { icon: Settings, label: 'Settings', href: '/settings', highlight: false },
    { icon: User, label: 'My Profile', href: `/profile/${user.id}`, highlight: 'cyan', badge: '🎤' },
  ] : [
    { icon: Home, label: 'Home', href: '/', highlight: false },
    { icon: Zap, label: 'Create', href: '/create', highlight: true, badge: 'Suggested' },
    { icon: Compass, label: 'Explore', href: '/explore', highlight: false },
    { icon: Library, label: 'Library', href: '/library', highlight: false },
    { icon: Unlock, label: 'Decrypt', href: '/decrypt', highlight: 'cyan' },
    { icon: CreditCard, label: 'Pricing', href: '/pricing', highlight: false },
    { icon: DollarSign, label: 'Earn', href: '/earn', highlight: 'purple', badge: 'New' },
    { icon: Swords, label: 'Quests', href: '/quests', highlight: 'cyan', badge: '🎮' },
    { icon: User, label: 'Profile', href: '/profile', highlight: false },
    { icon: LogIn, label: 'Sign In', href: '/sign-in', highlight: false, divider: true },
    { icon: UserPlus, label: 'Join Free', href: '/sign-up', highlight: 'white' },
  ]

  const isActive = (href: string) => pathname === href

  return (
    <aside 
      className={`hidden md:flex fixed left-0 top-0 h-screen bg-black/95 backdrop-blur-2xl border-r border-white/10 transition-all duration-300 ease-in-out z-50 flex-col ${
        isExpanded ? 'w-64' : 'w-20'
      }`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Logo / Brand */}
      <div className="flex items-center justify-center h-20 border-b border-white/10">
        <Link href="/" className="flex items-center gap-3">
          <div className={`w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-lg flex items-center justify-center font-bold text-white text-xl transition-all ${
            isExpanded ? 'scale-100' : 'scale-90'
          }`}>
            4
          </div>
          {isExpanded && (
            <span className="text-white font-bold text-xl whitespace-nowrap">444Radio</span>
          )}
        </Link>
      </div>

      {/* User Section */}
      {user && (
        <div className={`px-4 py-6 border-b border-white/10 ${isExpanded ? '' : 'flex justify-center'}`}>
          <div className="flex flex-col items-center gap-3">
            {/* Avatar */}
            <div className="relative">
              <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-cyan-500 to-blue-500 border-2 border-white/20">
                {avatarUrl ? (
                  <img src={avatarUrl} alt={username || 'User'} className="w-full h-full object-cover" />
                ) : user.imageUrl ? (
                  <img src={user.imageUrl} alt={user.firstName || 'User'} className="w-full h-full object-cover" />
                ) : (
                  <User size={24} className="text-white w-full h-full p-2" />
                )}
              </div>
              {isExpanded && (
                <div className="absolute -bottom-1 -right-1">
                  <UserButton afterSignOutUrl="/" />
                </div>
              )}
            </div>
            
            {/* User Info - only show when expanded */}
            {isExpanded && (
              <>
                <div className="text-center w-full">
                  <p className="text-white font-semibold text-sm truncate">{user.firstName || 'User'}</p>
                  <p className="text-gray-400 text-xs truncate">@{username || 'username'}</p>
                </div>
                
                {/* Credits — tap to open wallet */}
                <Link
                  href="/settings?tab=wallet"
                  className="flex items-center gap-2 px-3 py-1.5 bg-white/10 hover:bg-white/15 backdrop-blur-xl border border-white/20 rounded-full transition-colors"
                >
                  <Zap className="text-[#22D3EE]" size={14} />
                  <span className="text-white font-bold text-xs">
                    {credits !== null ? `${credits} credits` : '...'}
                  </span>
                </Link>
              </>
            )}
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 py-6 overflow-y-auto">
        <ul className="space-y-1 px-3">
          {menuItems.map((item, index) => {
            const Icon = item.icon
            const active = isActive(item.href)
            
            // Highlight styles
            let linkClasses = 'flex items-center gap-3 px-3 py-3 rounded-xl transition-all group relative'
            
            if (active) {
              linkClasses += ' bg-white/20 text-white'
            } else if (item.highlight === true) {
              linkClasses += ' bg-gradient-to-r from-cyan-600/20 to-cyan-400/20 border border-cyan-500/40 text-cyan-400 hover:from-cyan-600/30 hover:to-cyan-400/30'
            } else if (item.highlight === 'purple') {
              linkClasses += ' bg-gradient-to-r from-purple-600/20 to-pink-500/20 border border-purple-500/40 text-purple-300 hover:from-purple-600/30 hover:to-pink-500/30'
            } else if (item.highlight === 'cyan') {
              linkClasses += ' text-cyan-400 hover:bg-cyan-500/10 border border-cyan-500/30'
            } else if (item.highlight === 'white') {
              linkClasses += ' bg-white text-black hover:bg-gray-200 font-semibold'
            } else {
              linkClasses += ' text-white hover:bg-white/10'
            }

            const LinkComponent = item.external ? 'a' : Link
            const linkProps = item.external 
              ? { href: item.href, target: '_blank', rel: 'noopener noreferrer' }
              : { href: item.href }

            return (
              <li key={item.href + index} className={item.divider ? 'mt-8' : ''}>
                <LinkComponent {...linkProps} className={linkClasses}>
                  {/* Icon */}
                  <div className={`flex-shrink-0 ${isExpanded ? '' : 'mx-auto'}`}>
                    <Icon size={20} />
                  </div>
                  
                  {/* Label - only show when expanded */}
                  {isExpanded && (
                    <>
                      <span className="font-medium whitespace-nowrap">{item.label}</span>
                      {item.badge && (
                        <span className={`ml-auto text-xs px-2 py-0.5 rounded-full ${
                          item.highlight === true ? 'bg-cyan-500/20 text-cyan-300' :
                          item.highlight === 'purple' ? 'bg-purple-500/20 text-purple-200' :
                          'bg-white/20 text-white'
                        }`}>
                          {item.badge}
                        </span>
                      )}
                    </>
                  )}

                  {/* Tooltip for collapsed state */}
                  {!isExpanded && (
                    <div className="absolute left-full ml-2 px-2 py-1 bg-black/90 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap transition-opacity z-50">
                      {item.label}
                    </div>
                  )}
                </LinkComponent>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Features Button - Only on /create page */}
      {pathname === '/create' && (
        <div className="px-3 py-4 border-t border-white/10">
          <button
            onClick={() => {
              window.dispatchEvent(new CustomEvent('toggle-features-sidebar'))
            }}
            className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all group relative bg-gradient-to-r from-cyan-600/20 to-purple-500/20 border border-cyan-500/40 text-cyan-400 hover:from-cyan-600/30 hover:to-purple-500/30 hover:border-cyan-400/50`}
          >
            <div className={`flex-shrink-0 ${isExpanded ? '' : 'mx-auto'}`}>
              <LayoutGrid size={20} />
            </div>
            {isExpanded && (
              <span className="font-medium whitespace-nowrap">Features</span>
            )}
            {!isExpanded && (
              <div className="absolute left-full ml-2 px-2 py-1 bg-black/90 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap transition-opacity z-50">
                Features
              </div>
            )}
          </button>
        </div>
      )}
    </aside>
  )
}
