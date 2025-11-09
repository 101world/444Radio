'use client'

import { useEffect, useState } from 'react'
import { X, CheckCircle, AlertCircle, Info, Loader2 } from 'lucide-react'

export interface Toast {
  id: string
  type: 'success' | 'error' | 'info' | 'loading'
  message: string
  duration?: number
}

interface ToastNotificationProps {
  toasts: Toast[]
  onRemove: (id: string) => void
}

export default function ToastNotification({ toasts, onRemove }: ToastNotificationProps) {
  return (
    <div className="fixed top-4 right-4 z-[9999] space-y-2 max-w-sm">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>
  )
}

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
  const [isExiting, setIsExiting] = useState(false)

  useEffect(() => {
    if (toast.duration && toast.duration > 0) {
      const timer = setTimeout(() => {
        setIsExiting(true)
        setTimeout(() => onRemove(toast.id), 300)
      }, toast.duration)
      return () => clearTimeout(timer)
    }
  }, [toast.id, toast.duration, onRemove])

  const icons = {
    success: <CheckCircle className="w-5 h-5 text-green-400" />,
    error: <AlertCircle className="w-5 h-5 text-red-400" />,
    info: <Info className="w-5 h-5 text-cyan-400" />,
    loading: <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />
  }

  const colors = {
    success: 'border-green-500/30 bg-green-500/10',
    error: 'border-red-500/30 bg-red-500/10',
    info: 'border-cyan-500/30 bg-cyan-500/10',
    loading: 'border-cyan-500/30 bg-cyan-500/10'
  }

  return (
    <div
      className={`
        flex items-center gap-3 p-4 rounded-lg border backdrop-blur-xl
        ${colors[toast.type]}
        ${isExiting ? 'animate-slide-out-right' : 'animate-slide-in-right'}
        shadow-lg
      `}
    >
      {icons[toast.type]}
      <p className="text-sm text-white flex-1">{toast.message}</p>
      {toast.type !== 'loading' && (
        <button
          onClick={() => {
            setIsExiting(true)
            setTimeout(() => onRemove(toast.id), 300)
          }}
          className="text-white/60 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}
