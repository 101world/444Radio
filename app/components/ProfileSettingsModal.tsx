'use client'

import { useState } from 'react'
import { X, User, CreditCard, LogOut, Upload, Check } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@clerk/nextjs'

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
  const [activeTab, setActiveTab] = useState<'profile' | 'account' | 'subscription'>('profile')
  const [username, setUsername] = useState(currentUsername)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState(currentAvatar || '')
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

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

      if (res.ok) {
        setSaveSuccess(true)
        setTimeout(() => {
          setSaveSuccess(false)
          onUpdate?.()
          onClose()
        }, 1500)
      }
    } catch (error) {
      console.error('Failed to update profile:', error)
      alert('Failed to update profile')
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
      <div className="relative w-full max-w-2xl bg-gradient-to-br from-[#0f1419] to-[#1a1f2e] rounded-2xl border border-cyan-500/20 shadow-2xl shadow-cyan-500/10 max-h-[90vh] overflow-hidden flex flex-col">
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

        {/* Tabs */}
        <div className="flex gap-2 px-6 pt-4 border-b border-white/5">
          <button
            onClick={() => setActiveTab('profile')}
            className={`px-4 py-2 rounded-t-lg font-bold transition-all ${
              activeTab === 'profile'
                ? 'bg-cyan-500/20 text-cyan-400 border-b-2 border-cyan-400'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <User size={16} className="inline mr-2" />
            Profile
          </button>
          <button
            onClick={() => setActiveTab('account')}
            className={`px-4 py-2 rounded-t-lg font-bold transition-all ${
              activeTab === 'account'
                ? 'bg-cyan-500/20 text-cyan-400 border-b-2 border-cyan-400'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            Manage Account
          </button>
          <button
            onClick={() => setActiveTab('subscription')}
            className={`px-4 py-2 rounded-t-lg font-bold transition-all ${
              activeTab === 'subscription'
                ? 'bg-cyan-500/20 text-cyan-400 border-b-2 border-cyan-400'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <CreditCard size={16} className="inline mr-2" />
            Subscription
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === 'profile' && (
            <>
              {/* Profile Picture */}
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-3">Profile Picture</label>
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <div className="w-24 h-24 rounded-full overflow-hidden bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center">
                      {avatarPreview ? (
                        <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
                      ) : (
                        <User size={40} className="text-white" />
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
                    className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 rounded-lg font-bold cursor-pointer transition-all flex items-center gap-2"
                  >
                    <Upload size={16} />
                    Upload Photo
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
                <p className="text-xs text-gray-400 mt-2">This will be your display name across 444 RADIO</p>
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
            </>
          )}

          {activeTab === 'account' && (
            <div className="space-y-4">
              <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                <h3 className="font-bold text-white mb-2">Account Information</h3>
                <p className="text-sm text-gray-400">
                  Manage your account settings, privacy, and security options.
                </p>
              </div>
              
              <button className="w-full px-4 py-3 bg-white/5 hover:bg-white/10 rounded-xl text-left transition-all border border-white/10">
                <div className="font-semibold text-white">Email Preferences</div>
                <div className="text-sm text-gray-400">Configure notification settings</div>
              </button>

              <button className="w-full px-4 py-3 bg-white/5 hover:bg-white/10 rounded-xl text-left transition-all border border-white/10">
                <div className="font-semibold text-white">Privacy & Security</div>
                <div className="text-sm text-gray-400">Control who can see your content</div>
              </button>

              <button className="w-full px-4 py-3 bg-white/5 hover:bg-white/10 rounded-xl text-left transition-all border border-white/10">
                <div className="font-semibold text-white">Connected Accounts</div>
                <div className="text-sm text-gray-400">Link social media accounts</div>
              </button>
            </div>
          )}

          {activeTab === 'subscription' && (
            <div className="space-y-4">
              <div className="p-6 bg-gradient-to-br from-cyan-500/10 to-blue-500/10 rounded-xl border border-cyan-500/30">
                <h3 className="text-xl font-bold text-white mb-2">Free Plan</h3>
                <p className="text-gray-400 mb-4">You&apos;re currently on the free plan</p>
                <button className="px-6 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 rounded-lg font-bold transition-all">
                  Upgrade to Pro
                </button>
              </div>

              <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                <h4 className="font-bold text-white mb-2">Pro Features</h4>
                <ul className="space-y-2 text-sm text-gray-400">
                  <li>✨ Unlimited track generation</li>
                  <li>🎵 Priority processing</li>
                  <li>📊 Advanced analytics</li>
                  <li>🎨 Custom profile themes</li>
                  <li>💿 High-quality exports</li>
                </ul>
              </div>
            </div>
          )}
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
    </div>
  )
}
