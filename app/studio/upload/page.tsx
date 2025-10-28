'use client'

import React, { useState } from 'react'
import { useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { Upload, Music, Image, Loader2, CheckCircle, AlertCircle } from 'lucide-react'

export default function StudioUploadPage() {
  const { user } = useUser()
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMessage(null)
    
    if (!audioFile) {
      setMessage({ type: 'error', text: 'Please select an exported audio file from 444Studio.' })
      return
    }
    if (!title || title.trim().length < 3) {
      setMessage({ type: 'error', text: 'Please provide a title (min 3 characters).' })
      return
    }
    
    try {
      setSubmitting(true)
      const form = new FormData()
      form.append('title', title.trim())
      form.append('type', imageFile ? 'music-image' : 'music')
      form.append('audio', audioFile)
      if (imageFile) form.append('image', imageFile)

      const res = await fetch('/api/profile/upload', {
        method: 'POST',
        body: form,
      })
      
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.error || `Upload failed with status ${res.status}`)
      }
      
      setMessage({ type: 'success', text: 'Uploaded to your library! Redirecting...' })
      setTimeout(() => router.push('/library'), 1500)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Upload failed'
      setMessage({ type: 'error', text: msg })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-900/30 via-pink-900/30 to-purple-900/30 backdrop-blur-md border-b border-white/10">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <button
            onClick={() => router.push('/studio/editor')}
            className="text-gray-400 hover:text-white transition-colors mb-4"
          >
            ← Back to Editor
          </button>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            Upload to Library
          </h1>
          <p className="text-gray-400 mt-2">
            Export your track from 444Studio, then upload it here to share with the community.
          </p>
        </div>
      </div>

      {/* Upload Form */}
      <div className="max-w-4xl mx-auto px-6 py-12">
        <form onSubmit={handleSubmit} className="glassmorphism rounded-2xl p-8 space-y-6">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-white mb-2">
              Track Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="My Awesome Track"
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-all"
              maxLength={100}
            />
            <p className="text-xs text-gray-500 mt-1">{title.length}/100 characters</p>
          </div>

          {/* Audio File */}
          <div>
            <label className="block text-sm font-medium text-white mb-2">
              Audio File (WAV, MP3, etc.)
            </label>
            <div className="relative">
              <input
                type="file"
                accept="audio/*"
                onChange={(e) => setAudioFile(e.target.files?.[0] || null)}
                className="hidden"
                id="audio-input"
              />
              <label
                htmlFor="audio-input"
                className="flex items-center justify-center gap-3 w-full px-6 py-4 bg-white/5 border-2 border-dashed border-white/20 rounded-xl hover:border-purple-500 hover:bg-white/10 transition-all cursor-pointer group"
              >
                <Music className="text-purple-400 group-hover:scale-110 transition-transform" size={24} />
                <span className="text-gray-300">
                  {audioFile ? audioFile.name : 'Click to select audio file'}
                </span>
              </label>
            </div>
          </div>

          {/* Cover Image (Optional) */}
          <div>
            <label className="block text-sm font-medium text-white mb-2">
              Cover Image <span className="text-gray-500">(optional)</span>
            </label>
            <div className="relative">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                className="hidden"
                id="image-input"
              />
              <label
                htmlFor="image-input"
                className="flex items-center justify-center gap-3 w-full px-6 py-4 bg-white/5 border-2 border-dashed border-white/20 rounded-xl hover:border-pink-500 hover:bg-white/10 transition-all cursor-pointer group"
              >
                <Image className="text-pink-400 group-hover:scale-110 transition-transform" size={24} />
                <span className="text-gray-300">
                  {imageFile ? imageFile.name : 'Click to select cover image'}
                </span>
              </label>
            </div>
          </div>

          {/* Message */}
          {message && (
            <div className={`flex items-center gap-3 p-4 rounded-xl ${
              message.type === 'success' 
                ? 'bg-green-500/10 border border-green-500/30' 
                : 'bg-red-500/10 border border-red-500/30'
            }`}>
              {message.type === 'success' ? (
                <CheckCircle className="text-green-400 flex-shrink-0" size={20} />
              ) : (
                <AlertCircle className="text-red-400 flex-shrink-0" size={20} />
              )}
              <span className={message.type === 'success' ? 'text-green-300' : 'text-red-300'}>
                {message.text}
              </span>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={submitting || !audioFile || !title.trim()}
            className="w-full px-6 py-4 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all duration-300 flex items-center justify-center gap-3"
          >
            {submitting ? (
              <>
                <Loader2 className="animate-spin" size={20} />
                Uploading...
              </>
            ) : (
              <>
                <Upload size={20} />
                Upload to Library
              </>
            )}
          </button>
        </form>

        {/* Help Text */}
        <div className="mt-8 p-6 glassmorphism rounded-xl">
          <h3 className="text-lg font-semibold text-white mb-3">📝 How to Export from 444Studio</h3>
          <ol className="space-y-2 text-gray-400 text-sm">
            <li>1. Click <strong className="text-purple-400">File → Export</strong> in 444Studio</li>
            <li>2. Choose your export format (WAV recommended for quality, MP3 for smaller size)</li>
            <li>3. Save the file to your computer</li>
            <li>4. Upload it here to add to your 444Radio library</li>
          </ol>
        </div>
      </div>
    </div>
  )
}
