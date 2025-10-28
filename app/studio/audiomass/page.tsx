'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function AudioMassStudioPage() {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMessage(null)
    if (!audioFile) {
      setMessage('Please select an exported audio file from AudioMass.')
      return
    }
    if (!title || title.trim().length < 3) {
      setMessage('Please provide a title (min 3 characters).')
      return
    }
    try {
      setSubmitting(true)
  const form = new FormData()
  form.append('title', title.trim())
  form.append('type', imageFile ? 'music-image' : 'music')
  // API expects 'audio' for audio content; use that key consistently
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
      setMessage('Uploaded to your library! Redirecting to Library…')
      setTimeout(() => router.push('/library'), 800)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Upload failed'
      setMessage(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 p-4 md:p-8 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Studio — AudioMass</h1>
        <p className="text-gray-400 mt-2">
          This page embeds AudioMass for quick, permissive audio editing. Export your track, then upload it to your 444Radio library below.
        </p>
      </div>

      <div className="rounded-lg overflow-hidden border border-gray-800 bg-black">
        {/* AudioMass official site offers a self-contained editor; if you host your own build, replace src with your URL. */}
        <iframe
          title="AudioMass Editor"
          src="https://audiomass.co/"
          className="w-full h-[70vh]"
          sandbox="allow-scripts allow-same-origin allow-downloads"
        />
      </div>

      <form onSubmit={handleSubmit} className="bg-gray-900 border border-gray-800 rounded-lg p-4 md:p-6 flex flex-col gap-4">
        <h2 className="text-xl font-semibold">Upload exported track to Library</h2>
        <label className="flex flex-col gap-2">
          <span className="text-sm text-gray-300">Title</span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="My AudioMass Export"
            className="bg-black border border-gray-800 rounded px-3 py-2 outline-none focus:ring-2 focus:ring-blue-600"
          />
        </label>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="flex flex-col gap-2">
            <span className="text-sm text-gray-300">Audio file (WAV/MP3)</span>
            <input
              type="file"
              accept="audio/*"
              onChange={(e) => setAudioFile(e.target.files?.[0] || null)}
              className="file:mr-4 file:rounded file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:text-white file:cursor-pointer text-gray-300"
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-sm text-gray-300">Cover image (optional)</span>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setImageFile(e.target.files?.[0] || null)}
              className="file:mr-4 file:rounded file:border-0 file:bg-gray-700 file:px-4 file:py-2 file:text-white file:cursor-pointer text-gray-300"
            />
          </label>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded px-4 py-2 font-medium"
          >
            {submitting ? 'Uploading…' : 'Upload to Library'}
          </button>
          {message && <span className="text-sm text-gray-300">{message}</span>}
        </div>
      </form>
    </div>
  )
}
