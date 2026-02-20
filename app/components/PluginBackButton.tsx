'use client'

import { useSearchParams } from 'next/navigation'
import { Home } from 'lucide-react'

/**
 * Floating "Back to Plugin" button that appears on ANY page when
 * the user is browsing inside the JUCE WebView (host=juce in URL).
 * This lets them navigate back to the plugin chat from Radio, Library, etc.
 */
export default function PluginBackButton() {
  const searchParams = useSearchParams()
  const host = searchParams.get('host')

  // Only show when inside plugin WebView
  if (host !== 'juce') return null

  const token = typeof window !== 'undefined' ? localStorage.getItem('444radio_plugin_token') : null
  const pluginUrl = '/plugin?host=juce' + (token ? '&token=' + encodeURIComponent(token) : '')

  return (
    <a
      href={pluginUrl}
      className="fixed bottom-6 right-6 z-[999] flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-cyan-600 to-cyan-400 text-black font-bold rounded-full shadow-2xl shadow-cyan-500/50 hover:scale-105 transition-all animate-pulse hover:animate-none"
      style={{ animation: 'pluginBtnPulse 2s ease-in-out infinite' }}
    >
      <Home size={18} />
      <span className="text-sm">Back to Plugin</span>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes pluginBtnPulse {
          0%, 100% { box-shadow: 0 0 20px rgba(6, 182, 212, 0.4); }
          50% { box-shadow: 0 0 30px rgba(6, 182, 212, 0.7); }
        }
      `}} />
    </a>
  )
}
