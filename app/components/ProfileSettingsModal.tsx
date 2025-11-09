'use client'

import { useState, useEffect } from 'react'
import { X, User, LogOut, Upload, Check } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@clerk/nextjs'
import Toast from './Toast'

interface ProfileSettingsModalProps {
  isOpen: boolean
  onClose: () => void
  currentUsername: string
  currentAvatar?: string
  onUpdate?: () => void
}

export default function ProfileSettingsModal({ isOpen, onClose, currentUsername, currentAvatar, onUpdate }: ProfileSettingsModalProps) {
  const router = useRouter()
  const { signOut } = useAuth()
  const [username, setUsername] = useState(currentUsername)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState(currentAvatar || '')
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)

  // Update local state when props change
  useEffect(() => {
    setUsername(currentUsername)
    setAvatarPreview(currentAvatar || '')
  }, [currentUsername, currentAvatar])

  if (!isOpen) return null

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setAvatarFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSaveProfile = async () => {
    setSaving(true)
    setSaveSuccess(false)
    setToast(null)
    
    try {
      const formData = new FormData()
      formData.append('username', username)
      if (avatarFile) {
        formData.append('avatar', avatarFile)
      }

      const res = await fetch('/api/profile/update', {
        method: 'POST',
        body: formData
      })

      const data = await res.json()

      if (res.ok && data.success) {
        // Show success state
        setSaveSuccess(true)
        
        // Update local state with new values from server
        setUsername(data.username)
        if (data.avatar) {
          setAvatarPreview(data.avatar)
        }
        
        // Show success toast
        setToast({
          message: 'Profile updated successfully!',
          type: 'success'
        })
        
        // Call onUpdate callback if provided (refreshes parent component)
        onUpdate?.()
        
        // Use Next.js router.refresh() to update server components
        router.refresh()
        
        // Close modal after showing success message
        setTimeout(() => {
          setSaveSuccess(false)
          onClose()
        }, 1500)
      } else {
        // Show error toast
        const errorMsg = data.error || 'Failed to update profile'
        console.error('Profile update failed:', errorMsg)
        setToast({
          message: errorMsg,
          type: 'error'
        })
      }
    } catch (error) {
      console.error('Failed to update profile:', error)
      setToast({
        message: 'Network error. Please check your connection and try again.',
        type: 'error'
      })
    } finally {
      setSaving(false)
    }
  }

  const handleLogout = async () => {
    await signOut()
    router.push('/')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-lg bg-gradient-to-br from-[#0f1419] to-[#1a1f2e] rounded-2xl border border-cyan-500/20 shadow-2xl shadow-cyan-500/10 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-cyan-500/20">
          <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400">
            Settings
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-all"
          >
            <X size={24} className="text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Profile Picture */}
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-3">Profile Picture</label>
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="w-20 h-20 rounded-full overflow-hidden bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center">
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <User size={32} className="text-white" />
                  )}
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  className="hidden"
                  id="avatar-upload"
                />
              </div>
              <label
                htmlFor="avatar-upload"
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 rounded-lg font-semibold cursor-pointer transition-all flex items-center gap-2 text-sm"
              >
                <Upload size={16} />
                Upload
              </label>
            </div>
          </div>

          {/* Username */}
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username"
              className="w-full px-4 py-3 bg-[#0f1419] border border-cyan-500/20 rounded-xl text-white placeholder-gray-500 focus:border-cyan-400 focus:outline-none"
            />
          </div>

          {/* Save Button */}
          <button
            onClick={handleSaveProfile}
            disabled={saving || saveSuccess}
            className={`w-full py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${
              saveSuccess
                ? 'bg-green-600 text-white'
                : 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white'
            }`}
          >
            {saving ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Saving...
              </>
            ) : saveSuccess ? (
              <>
                <Check size={20} />
                Saved!
              </>
            ) : (
              'Save Changes'
            )}
          </button>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-white/5 bg-[#0a0e14]">
          <button
            onClick={handleLogout}
            className="w-full px-4 py-3 bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 rounded-xl text-red-400 font-bold transition-all flex items-center justify-center gap-2"
          >
            <LogOut size={20} />
            Sign Out
          </button>
        </div>
      </div>

      {/* Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  )
}
