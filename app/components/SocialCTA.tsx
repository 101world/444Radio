'use client'

export default function SocialCTA() {
  return (
    <div className="w-full py-12 px-4">
      <div className="max-w-4xl mx-auto text-center">
        {/* CTA Text */}
        <p className="text-lg md:text-xl text-gray-300 mb-6 font-medium">
          Be part of the frequency. Subscribe, follow, and tune in.
        </p>

        {/* Social Buttons */}
        <div className="flex flex-wrap gap-4 justify-center items-center">
          {/* YouTube Button */}
          <a
            href="https://www.youtube.com/channel/UCDzvoYkrxyju6ovVYa1rCjg"
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-3 px-6 py-3 bg-red-600/20 hover:bg-red-600/30 backdrop-blur-xl border border-red-500/30 hover:border-red-500/50 rounded-full transition-all duration-300 shadow-lg hover:shadow-red-500/20 hover:scale-105"
          >
            <svg 
              className="w-5 h-5 text-red-500" 
              fill="currentColor" 
              viewBox="0 0 24 24"
            >
              <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
            </svg>
            <span className="font-semibold text-white">YouTube</span>
          </a>

          {/* Instagram Button */}
          <a
            href="https://www.instagram.com/444radioog?igsh=OWRrdXlmYnl5aGFu"
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-3 px-6 py-3 bg-gradient-to-br from-purple-600/20 via-pink-600/20 to-orange-500/20 hover:from-purple-600/30 hover:via-pink-600/30 hover:to-orange-500/30 backdrop-blur-xl border border-pink-500/30 hover:border-pink-500/50 rounded-full transition-all duration-300 shadow-lg hover:shadow-pink-500/20 hover:scale-105"
          >
            <svg 
              className="w-5 h-5 text-pink-500" 
              fill="currentColor" 
              viewBox="0 0 24 24"
            >
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
            </svg>
            <span className="font-semibold text-white">Instagram</span>
          </a>
        </div>
      </div>
    </div>
  )
}
