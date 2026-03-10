'use client'

import { useState, useRef } from 'react'
import { X, Sparkles, Copy, Check, Loader2, Wand2, RotateCcw, ArrowRight, Zap } from 'lucide-react'

interface StyleDNAModalProps {
  isOpen: boolean
  onClose: () => void
  /** Optionally pre-fill from the genre/style field on the create page */
  initialContent?: string
  /** Called when user clicks "Use This" — passes enhanced text back to parent */
  onApply?: (enhancedStyle: string) => void
}

const EXAMPLE_PROMPTS = [
  'chill lofi beats for studying',
  'dark trap with heavy 808s',
  'synthwave retro neon vibes',
  'acoustic folk with fingerpicking guitar',
  'cinematic orchestral epic trailer',
  'afrobeat dance groove with horns',
  'dreamy shoegaze reverb wall',
  'jazzy neo-soul with rhodes keys',
]

export default function StyleDNAModal({
  isOpen,
  onClose,
  initialContent = '',
  onApply,
}: StyleDNAModalProps) {
  const [content, setContent] = useState(initialContent)
  const [result, setResult] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [history, setHistory] = useState<{ input: string; output: string }[]>([])
  const inputRef = useRef<HTMLTextAreaElement>(null)

  if (!isOpen) return null

  const handleEnhance = async () => {
    if (!content.trim() || content.trim().length < 2) {
      setError('Enter at least 2 characters')
      return
    }
    setError('')
    setIsLoading(true)
    setResult('')

    try {
      const res = await fetch('/api/generate/style-enhance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: content.trim() }),
      })
      const data = await res.json()

      if (!res.ok || !data.success) {
        setError(data.error || 'Enhancement failed — try again')
        return
      }

      setResult(data.result)
      setHistory(prev => [{ input: content.trim(), output: data.result }, ...prev].slice(0, 10))
    } catch {
      setError('Network error — please try again')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCopy = () => {
    if (!result) return
    navigator.clipboard.writeText(result)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleApply = () => {
    if (!result || !onApply) return
    onApply(result)
    onClose()
  }

  const handleReRun = () => {
    if (!content.trim()) return
    handleEnhance()
  }

  const handleExampleClick = (example: string) => {
    setContent(example)
    setResult('')
    setError('')
    inputRef.current?.focus()
  }

  const handleResultAsInput = () => {
    if (!result) return
    setContent(result)
    setResult('')
    setError('')
    inputRef.current?.focus()
  }

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-b from-[#0a0f14] via-[#080d12] to-black border border-cyan-500/15 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl shadow-cyan-500/10">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/30">
              <Wand2 size={18} className="text-white" />
            </div>
            <div>
              <h2 className="text-white font-bold text-lg">Style DNA</h2>
              <p className="text-white/40 text-xs">AI-powered style enhancer • Free</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors p-1">
            <X size={20} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* How it works */}
          <div className="bg-cyan-500/8 border border-cyan-500/15 rounded-xl p-3">
            <p className="text-cyan-100/70 text-xs leading-relaxed">
              <Sparkles size={12} className="inline mr-1 text-cyan-400" />
              Describe your style in a few words — the AI expands it into detailed, optimised genre/style tags 
              that produce better music generations. Completely <strong className="text-cyan-300">free</strong> — no credits needed.
            </p>
          </div>

          {/* Input */}
          <div>
            <label className="block text-xs font-medium text-white/50 uppercase tracking-wider mb-2">
              Your Style Description
            </label>
            <textarea
              ref={inputRef}
              value={content}
              onChange={(e) => { setContent(e.target.value); setError('') }}
              placeholder="e.g. chill lofi beats for studying late at night..."
              rows={3}
              maxLength={1000}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-white/20 resize-none focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 transition-all"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleEnhance()
                }
              }}
            />
            <div className="flex items-center justify-between mt-1.5">
              <span className={`text-xs ${content.length > 900 ? 'text-red-400' : 'text-white/30'}`}>
                {content.length}/1000
              </span>
              {error && <span className="text-xs text-red-400">{error}</span>}
            </div>
          </div>

          {/* Example Chips */}
          {!result && (
            <div>
              <p className="text-xs text-white/30 mb-2">Try an example:</p>
              <div className="flex flex-wrap gap-1.5">
                {EXAMPLE_PROMPTS.map((ex) => (
                  <button
                    key={ex}
                    onClick={() => handleExampleClick(ex)}
                    className="text-xs px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-white/50 hover:text-white hover:border-cyan-400/40 hover:bg-cyan-500/10 transition-all"
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Enhance Button */}
          <button
            onClick={handleEnhance}
            disabled={isLoading || content.trim().length < 2}
            className="w-full py-3 rounded-xl font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/30"
          >
            {isLoading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Enhancing...
              </>
            ) : (
              <>
                <Wand2 size={16} />
                Enhance Style
                <span className="text-xs text-cyan-200/60 ml-1">Free</span>
              </>
            )}
          </button>

          {/* Result */}
          {result && (
            <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <label className="block text-xs font-medium text-white/50 uppercase tracking-wider">
                Enhanced Style Tags
              </label>
              <div className="bg-cyan-500/8 border border-cyan-500/15 rounded-xl p-4">
                <p className="text-white text-sm leading-relaxed whitespace-pre-wrap">{result}</p>
              </div>

              {/* Action buttons */}
              <div className="grid grid-cols-2 gap-2">
                {onApply && (
                  <button
                    onClick={handleApply}
                    className="py-2.5 rounded-xl text-sm font-medium bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white flex items-center justify-center gap-2 transition-all shadow-lg shadow-cyan-500/20"
                  >
                    <Zap size={14} />
                    Use This
                  </button>
                )}
                <button
                  onClick={handleCopy}
                  className="py-2.5 rounded-xl text-sm font-medium bg-white/5 border border-white/10 hover:bg-white/10 text-white/70 hover:text-white flex items-center justify-center gap-2 transition-all"
                >
                  {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleReRun}
                  disabled={isLoading}
                  className="flex-1 py-2 rounded-lg text-xs font-medium bg-white/5 border border-white/10 hover:bg-white/10 text-white/50 hover:text-white flex items-center justify-center gap-1.5 transition-all"
                >
                  <RotateCcw size={12} />
                  Re-enhance
                </button>
                <button
                  onClick={handleResultAsInput}
                  className="flex-1 py-2 rounded-lg text-xs font-medium bg-white/5 border border-white/10 hover:bg-white/10 text-white/50 hover:text-white flex items-center justify-center gap-1.5 transition-all"
                >
                  <ArrowRight size={12} />
                  Refine further
                </button>
              </div>
            </div>
          )}

          {/* History */}
          {history.length > 0 && !result && (
            <div>
              <p className="text-xs text-white/30 mb-2">Recent enhancements:</p>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {history.map((h, i) => (
                  <button
                    key={i}
                    onClick={() => { setContent(h.input); setResult(h.output) }}
                    className="w-full text-left p-2.5 rounded-lg bg-white/5 border border-white/10 hover:border-cyan-400/30 hover:bg-cyan-500/5 transition-all"
                  >
                    <p className="text-xs text-white/40 truncate">{h.input}</p>
                    <p className="text-xs text-cyan-300/70 truncate mt-0.5">{h.output}</p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
