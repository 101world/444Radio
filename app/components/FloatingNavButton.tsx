'use client'

import { useState } from 'react'
import Link from 'next/link'
import { User, Compass, PlusCircle, Library, Menu, X } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { useUser } from '@clerk/nextjs'

export default function FloatingNavButton() {
  const [isOpen, setIsOpen] = useState(false)
  const pathname = usePathname()
  const { user } = useUser()

  const navItems = [
    { href: user ? `/profile/${user.id}` : '/profile', icon: User, label: 'Profile' },
    { href: '/explore', icon: Compass, label: 'Explore' },
    { href: '/create', icon: PlusCircle, label: 'Create' },
    { href: '/library', icon: Library, label: 'Library' },
  ]

  return (
    <div className="md:hidden fixed right-4 z-50" style={{ top: '66.67%' }}>
      {/* Navigation Items - Appear when open */}
      {isOpen && (
        <div className="absolute bottom-16 right-0 flex flex-col gap-3 mb-2">
          {navItems.map((item, index) => {
            const Icon = item.icon
            const isActive = pathname === item.href || 
                           (item.href !== '/' && pathname.startsWith(item.href))
            
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsOpen(false)}
                className={`group relative flex items-center gap-3 transition-all duration-300 animate-slide-in`}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                {/* Label */}
                <div className="absolute right-16 bg-black/90 backdrop-blur-xl border border-cyan-500/30 rounded-xl px-4 py-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap">
                  <span className="text-sm font-medium text-cyan-300">{item.label}</span>
                </div>
                
                {/* Icon Button */}
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 shadow-lg ${
                    isActive
                      ? 'bg-gradient-to-r from-cyan-600 to-cyan-400 shadow-cyan-500/50 scale-110'
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
        </div>
      )}

      {/* Main Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 shadow-2xl active:scale-90 ${
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
  )
}
