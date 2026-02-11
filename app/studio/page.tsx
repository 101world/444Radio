import Link from 'next/link'

export default function StudioComingSoon() {
  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-8 md:pl-28">
      <div className="max-w-2xl text-center space-y-6">
        <h1 className="text-4xl md:text-6xl font-black">444Radio Studio — Coming Soon</h1>
        <p className="text-gray-400">We're building the most advanced browser-based DAW with AI-powered music creation. Multi-track editing, real-time collaboration, and professional tools are on the way.</p>
        <div className="flex items-center justify-center gap-3">
          <Link href="/create" className="px-6 py-3 bg-cyan-500 rounded-lg font-bold text-black hover:bg-cyan-400 transition-colors">Create Music</Link>
          <Link href="/explore" className="px-6 py-3 bg-white/5 rounded-lg font-bold hover:bg-white/10 transition-colors">Explore Music</Link>
        </div>
      </div>
    </div>
  )
}
