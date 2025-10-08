import { SignedIn, SignedOut, SignInButton, UserButton } from '@clerk/nextjs'
import Link from 'next/link'

export default function Header() {
  return (
    <header className="flex justify-between items-center p-4 bg-gray-800 border-b border-gray-700">
      <h1 className="text-2xl font-bold text-teal-400">444RADIO</h1>
      <nav className="hidden md:flex space-x-6">
        <Link href="/" className="text-white hover:text-teal-400 transition">Home</Link>
        <Link href="/music" className="text-white hover:text-teal-400 transition">Music</Link>
        <Link href="/visuals" className="text-white hover:text-teal-400 transition">Visuals</Link>
        <Link href="/community" className="text-white hover:text-teal-400 transition">Community</Link>
        <Link href="/pricing" className="text-white hover:text-teal-400 transition">Pricing</Link>
      </nav>
      <div>
        <SignedOut>
          <SignInButton />
        </SignedOut>
        <SignedIn>
          <UserButton />
        </SignedIn>
      </div>
    </header>
  )
}