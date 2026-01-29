'use client'

import { Sparkles, Zap, Music, Globe, Gift } from 'lucide-react'

/**
 * SEO-Optimized Hero Section for 444Radio
 * Targets: "AI music generator India", "Suno alternative", "generate music with AI"
 */
export default function SEOHeroSection() {
  return (
    <section className="relative mb-8 px-4 py-8 bg-gradient-to-b from-cyan-600/10 to-transparent rounded-xl border border-cyan-500/20">
      {/* SEO-Rich Heading Structure */}
      <div className="max-w-4xl mx-auto text-center space-y-4">
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent">
          India's First AI Music Generator
        </h1>
        
        <h2 className="text-xl md:text-2xl text-gray-300 font-medium">
          Create AI-Generated Music in Seconds | Better Alternative to Suno
        </h2>
        
        <p className="text-gray-400 text-lg max-w-3xl mx-auto leading-relaxed">
          Generate songs, beats, and music from simple text prompts using advanced artificial intelligence. 
          Free 20 credits with code: <strong className="text-cyan-400">FREE THE MUSIC</strong>
        </p>

        {/* Key Features Grid - SEO Keywords */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-6">
          <FeatureCard 
            icon={<Sparkles className="w-5 h-5" />}
            title="AI Music Generation"
            description="Text to music in seconds"
          />
          <FeatureCard 
            icon={<Zap className="w-5 h-5" />}
            title="Free Credits"
            description="Code: FREE THE MUSIC"
          />
          <FeatureCard 
            icon={<Music className="w-5 h-5" />}
            title="Multiple Genres"
            description="Lofi, Hip Hop, Jazz & more"
          />
          <FeatureCard 
            icon={<Globe className="w-5 h-5" />}
            title="Made in India"
            description="India's #1 AI Music App"
          />
        </div>

        {/* Trust Signals */}
        <div className="pt-4 flex flex-wrap justify-center gap-4 text-sm text-gray-500">
          <span>🎵 10,000+ Songs Generated</span>
          <span>🇮🇳 Made in India</span>
          <span>✨ Free Credits Available</span>
          <span>🚀 No Credit Card Required</span>
        </div>
      </div>

      {/* Hidden SEO Content - Helps with long-tail keywords */}
      <div className="sr-only">
        <h3>How to Generate Music with AI on 444Radio</h3>
        <p>
          444Radio is the best AI music generator in India. Create professional-quality AI-generated songs 
          using text prompts. Unlike Suno, we offer free credits for Indian users. Generate music with AI 
          technology, create beats, compose songs, and share with the community. Perfect for content creators, 
          musicians, and anyone who wants to make music with artificial intelligence. Get started with code 
          FREE THE MUSIC for 20 free credits.
        </p>
        <ul>
          <li>AI music generator for India</li>
          <li>Generate songs from text prompts</li>
          <li>Free AI music creation</li>
          <li>Best alternative to Suno AI</li>
          <li>Text to music converter online</li>
          <li>AI beat maker and song creator</li>
          <li>Royalty-free AI generated music</li>
          <li>Online AI music studio with DAW</li>
        </ul>
      </div>
    </section>
  )
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <div className="flex flex-col items-center text-center p-3 bg-gray-800/50 rounded-lg border border-gray-700/50 hover:border-cyan-500/50 transition-colors">
      <div className="text-cyan-400 mb-2">{icon}</div>
      <h3 className="text-sm font-semibold text-white mb-1">{title}</h3>
      <p className="text-xs text-gray-400">{description}</p>
    </div>
  )
}
