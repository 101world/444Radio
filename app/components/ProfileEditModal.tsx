'use client'

import { useState } from 'react'
import { X, User, Upload, Check } from 'lucide-react'
import { useUser } from '@clerk/nextjs'

interface ProfileEditModalProps {
  isOpen: boolean
  onClose: () => void
  currentUsername: string
  currentAvatar?: string
  onSave: (username: string, avatar?: string) => Promise<void>
}

export default function ProfileEditModal({
  isOpen,
  onClose,
  currentUsername,
  currentAvatar,
  onSave
}: ProfileEditModalProps) {
  const { user } = useUser()
  const [username, setUsername] = useState(currentUsername)
  const [avatar, setAvatar] = useState(currentAvatar || '')
  const [isUploading, setIsUploading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  if (!isOpen) return null

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file')
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be less than 5MB')
      return
    }

    setIsUploading(true)
    setError('')

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('userId', user?.id || '')

      const response = await fetch('/api/upload/avatar', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) throw new Error('Upload failed')

      const data = await response.json()
      setAvatar(data.url)
    } catch (err) {
      setError('Failed to upload image')
    } finally {
      setIsUploading(false)
    }
  }

  const handleSave = async () => {
    if (!username.trim()) {
      setError('Username cannot be empty')
      return
    }

    // Validate username format
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      setError('Username must be 3-20 characters (letters, numbers, underscore only)')
      return
    }

    setIsSaving(true)
    setError('')

    try {
      await onSave(username, avatar)
      setSuccess(true)
      setTimeout(() => {
        setSuccess(false)
        onClose()
      }, 1500)
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update profile'
      setError(errorMessage)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-md bg-gradient-to-b from-gray-900 to-black border border-cyan-500/30 rounded-2xl shadow-2xl shadow-cyan-500/20">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-lg transition-all"
        >
          <X size={20} className="text-gray-400 hover:text-white" />
        </button>

        {/* Header */}
        <div className="p-6 border-b border-white/10">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <User className="text-cyan-400" size={24} />
            Edit Profile
          </h2>
          <p className="text-sm text-gray-400 mt-1">Update your profile information</p>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Avatar Section */}
          <div className="flex flex-col items-center gap-4">
            <div className="relative group">
              <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-cyan-500/30 bg-gray-800">
                {avatar ? (
                  <img
                    src={avatar}
                    alt="Profile"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-cyan-600 to-cyan-400">
                    <User size={40} className="text-white" />
                  </div>
                )}
              </div>
              <label
                htmlFor="avatar-upload"
                className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer rounded-full"
              >
                {isUploading ? (
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                ) : (
                  <Upload size={24} className="text-white" />
                )}
              </label>
              <input
                id="avatar-upload"
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                className="hidden"
                disabled={isUploading}
              />
            </div>
            <p className="text-xs text-gray-400 text-center">
              Click to upload new profile picture<br />
              (Max 5MB, JPG/PNG)
            </p>
          </div>

          {/* Username Section */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Username
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">@</span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                className="w-full bg-white/5 border border-white/10 rounded-lg pl-8 pr-4 py-3 text-white focus:outline-none focus:border-cyan-500/50 transition-colors"
                placeholder="username"
                maxLength={20}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              3-20 characters, letters, numbers, underscore only
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg flex items-center gap-2">
              <Check size={16} className="text-green-400" />
              <p className="text-sm text-green-400">Profile updated successfully!</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-white/10 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg font-medium text-white transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || isUploading}
            className="flex-1 px-4 py-3 bg-gradient-to-r from-cyan-600 to-cyan-400 hover:from-cyan-500 hover:to-cyan-300 disabled:from-gray-600 disabled:to-gray-400 disabled:cursor-not-allowed rounded-lg font-bold text-white transition-all shadow-lg shadow-cyan-500/30"
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
