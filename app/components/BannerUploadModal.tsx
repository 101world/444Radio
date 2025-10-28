'use client'

import { useState } from 'react'
import { X, Image as ImageIcon, Video, Upload, Sparkles } from 'lucide-react'

interface BannerUploadModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: (url: string, type: 'image' | 'video') => void
}

export default function BannerUploadModal({ isOpen, onClose, onSuccess }: BannerUploadModalProps) {
  const [tab, setTab] = useState<'image' | 'video'>('image')
  const [file, setFile] = useState<File | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const submitUpload = async () => {
    if (!file) return
    setIsSubmitting(true)
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('kind', tab)
      const res = await fetch('/api/profile/banner', {
        method: 'POST',
        body: form
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error || 'Upload failed')
      if (onSuccess) onSuccess(data.banner_url, data.banner_type)
      onClose()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setIsSubmitting(false)
    }
  }

  const useLatestCover = async () => {
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/profile/banner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ useLatestCover: true })
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error || 'No cover found')
      if (onSuccess) onSuccess(data.banner_url, data.banner_type)
      onClose()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to set banner')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80" onClick={() => !isSubmitting && onClose()} />
      <div className="relative w-full max-w-lg bg-black/90 border border-cyan-500/30 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <Upload className="text-cyan-400" size={20} />
            <h3 className="text-white font-bold">Update Profile Banner</h3>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10">
            <X size={18} className="text-gray-400" />
          </button>
        </div>

        <div className="px-5 pt-4">
          <div className="flex gap-2 mb-4">
            <button onClick={() => setTab('image')} className={`px-3 py-2 rounded-lg border ${tab==='image'?'border-cyan-500 text-cyan-400':'border-white/10 text-gray-400'}`}>
              <div className="flex items-center gap-2"><ImageIcon size={16} /> Image</div>
            </button>
            <button onClick={() => setTab('video')} className={`px-3 py-2 rounded-lg border ${tab==='video'?'border-cyan-500 text-cyan-400':'border-white/10 text-gray-400'}`}>
              <div className="flex items-center gap-2"><Video size={16} /> Video</div>
            </button>
            <div className="flex-1" />
            <button onClick={useLatestCover} disabled={isSubmitting} className="px-3 py-2 rounded-lg border border-white/10 text-gray-300 hover:bg-white/5 flex items-center gap-2">
              <Sparkles size={16} className="text-cyan-400" /> Use latest cover
            </button>
          </div>
        </div>

        <div className="px-5 pb-5">
          <div className="p-4 rounded-xl border border-white/10 bg-white/5">
            <input
              type="file"
              accept={tab==='image' ? 'image/*' : 'video/*'}
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="block w-full text-sm text-gray-300 file:mr-4 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-cyan-500/20 file:text-cyan-300 hover:file:bg-cyan-500/30"
            />
            <p className="text-xs text-gray-500 mt-2">{tab==='image' ? 'Recommended 1600x400+' : 'Short MP4/WebM recommended'}</p>
          </div>
        </div>

        <div className="px-5 py-4 border-t border-white/10 flex justify-end gap-2 bg-white/5">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-gray-300 hover:bg-white/10">Cancel</button>
          <button onClick={submitUpload} disabled={!file || isSubmitting} className="px-4 py-2 rounded-lg bg-cyan-500 text-black font-semibold disabled:opacity-50">{isSubmitting?'Uploading...':'Save Banner'}</button>
        </div>
      </div>
    </div>
  )
}
