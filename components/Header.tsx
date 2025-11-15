'use client'

import { SignedIn, SignedOut, SignInButton, UserButton } from '@clerk/nextjs'
import Link from 'next/link'
import { Menu, X } from 'lucide-react'
import { useState } from 'react'

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <header className="flex justify-between items-center p-4 bg-gray-800 border-b border-gray-700 relative z-50">
      <h1 className="text-2xl font-bold text-teal-400">444RADIO</h1>
      
      {/* Desktop Navigation */}
      <nav className="hidden md:flex space-x-6">
        <Link href="/" className="text-white hover:text-teal-400 transition">Home</Link>
        <Link href="/music" className="text-white hover:text-teal-400 transition">Music</Link>
        <Link href="/visuals" className="text-white hover:text-teal-400 transition">Visuals</Link>
        <Link href="/community" className="text-white hover:text-teal-400 transition">Community</Link>
        <Link href="/pricing" className="text-white hover:text-teal-400 transition">Pricing</Link>
      </nav>

      {/* Mobile Menu Button & User */}
      <div className="flex items-center gap-3">
        <SignedOut>
          <SignInButton />
        </SignedOut>
        <SignedIn>
          <UserButton 
            appearance={{
              elements: {
                avatarBox: 'w-9 h-9', // Larger avatar on mobile
              }
            }}
          />
        </SignedIn>
        <button 
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden text-white p-2"
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Navigation Dropdown */}
      {mobileMenuOpen && (
        <nav className="absolute top-full left-0 right-0 bg-gray-800 border-b border-gray-700 md:hidden shadow-lg">
          <div className="flex flex-col p-4 space-y-3">
            <Link 
              href="/" 
              className="text-white hover:text-teal-400 transition py-2 px-3 rounded hover:bg-gray-700"
              onClick={() => setMobileMenuOpen(false)}
            >
              Home
            </Link>
            <Link 
              href="/music" 
              className="text-white hover:text-teal-400 transition py-2 px-3 rounded hover:bg-gray-700"
              onClick={() => setMobileMenuOpen(false)}
            >
              Music
            </Link>
            <Link 
              href="/visuals" 
              className="text-white hover:text-teal-400 transition py-2 px-3 rounded hover:bg-gray-700"
              onClick={() => setMobileMenuOpen(false)}
            >
              Visuals
            </Link>
            <Link 
              href="/community" 
              className="text-white hover:text-teal-400 transition py-2 px-3 rounded hover:bg-gray-700"
              onClick={() => setMobileMenuOpen(false)}
            >
              Community
            </Link>
            <Link 
              href="/pricing" 
              className="text-white hover:text-teal-400 transition py-2 px-3 rounded hover:bg-gray-700"
              onClick={() => setMobileMenuOpen(false)}
            >
              Pricing
            </Link>
            <SignedIn>
              <Link 
                href="/library" 
                className="text-white hover:text-teal-400 transition py-2 px-3 rounded hover:bg-gray-700"
                onClick={() => setMobileMenuOpen(false)}
              >
                My Library
              </Link>
            </SignedIn>
          </div>
        </nav>
      )}
    </header>
  )
}