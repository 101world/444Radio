'use client'

import { useState } from 'react'
import { X, Upload, SlidersHorizontal } from 'lucide-react'

interface ReleasePatternModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  initialCode?: string
}

export default function ReleasePatternModal({ isOpen, onClose, onSuccess, initialCode }: ReleasePatternModalProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [code, setCode] = useState('')
  const [genre, setGenre] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [hasPreFilled, setHasPreFilled] = useState(false)

  // Pre-fill code from editor when modal opens
  if (isOpen && initialCode && !hasPreFilled) {
    setCode(initialCode)
    setHasPreFilled(true)
    // Try to extract title from first comment line
    const firstComment = initialCode.split('\n')[0]?.match(/\/\/\s*(.+)/)?.[1]?.trim()
    if (firstComment && !title) setTitle(firstComment)
  }
  if (!isOpen && hasPreFilled) setHasPreFilled(false)

  if (!isOpen) return null

  const handleSubmit = async () => {
    if (!title.trim()) return setError('Give your pattern a name')
    if (!code.trim()) return setError('Paste your pattern code')
    if (title.length > 100) return setError('Title must be 100 chars or less')
    if (code.length > 5000) return setError('Code must be 5000 chars or less')

    setIsSubmitting(true)
    setError('')

    try {
      const res = await fetch('/api/patterns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          code: code.trim(),
          genre: genre.trim() || null,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to release pattern')
        return
      }

      // Reset form
      setTitle('')
      setDescription('')
      setCode('')
      setGenre('')
      onSuccess()
      onClose()
    } catch {
      setError('Something went wrong. Try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-gray-950 border border-white/10 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
          <div className="flex items-center gap-2">
            <SlidersHorizontal size={18} className="text-cyan-400" />
            <h2 className="text-base font-bold text-white">Release Pattern</h2>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors p-1">
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <div className="px-5 py-4 space-y-4">
          <p className="text-gray-500 text-xs">
            Share your input pattern so others can copy and paste it into their own terminal.
          </p>

          {/* Title */}
          <div>
            <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1.5 block">Pattern Name</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Lo-fi Chill Beats"
              maxLength={100}
              className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/50 transition-colors"
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1.5 block">Description <span className="text-gray-600">(optional)</span></label>
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="What does this pattern create?"
              className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/50 transition-colors"
            />
          </div>

          {/* Genre tag */}
          <div>
            <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1.5 block">Genre Tag <span className="text-gray-600">(optional)</span></label>
            <input
              type="text"
              value={genre}
              onChange={e => setGenre(e.target.value)}
              placeholder="e.g. lofi, hiphop, techno"
              className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/50 transition-colors"
            />
          </div>

          {/* Code / Pattern text */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">Pattern Code</label>
              <span className={`text-[10px] font-mono ${code.length > 4500 ? 'text-red-400' : 'text-gray-600'}`}>{code.length}/5000</span>
            </div>
            <textarea
              value={code}
              onChange={e => setCode(e.target.value)}
              placeholder="Paste your full input pattern here...&#10;&#10;Example:&#10;Genre: Lo-fi&#10;BPM: 85&#10;Mood: Chill, Dreamy&#10;Prompt: A warm lo-fi beat with vinyl crackle..."
              maxLength={5000}
              rows={8}
              className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/50 transition-colors font-mono resize-none"
            />
          </div>

          {/* Error */}
          {error && (
            <p className="text-red-400 text-xs">{error}</p>
          )}

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !title.trim() || !code.trim()}
            className="w-full flex items-center justify-center gap-2 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/30 text-cyan-400 font-semibold text-sm py-2.5 rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Upload size={14} />
            {isSubmitting ? 'Releasing...' : 'Release Pattern'}
          </button>
        </div>
      </div>
    </div>
  )
}
