import Link from 'next/link'

export default function StudioComingSoon() {
  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-8">
      <div className="max-w-2xl text-center space-y-6">
        <h1 className="text-4xl md:text-6xl font-black">444Studio — Coming Soon</h1>
        <p className="text-gray-400">We're polishing the studio experience. Features like multi-track editing and DAW integration are coming soon.</p>
        <div className="flex items-center justify-center gap-3">
          <Link href="/create" className="px-6 py-3 bg-cyan-500 rounded-lg font-bold text-black">Create Music</Link>
          <Link href="/explore" className="px-6 py-3 bg-white/5 rounded-lg font-bold">Explore Music</Link>
        </div>
      </div>
    </div>
  )
}
