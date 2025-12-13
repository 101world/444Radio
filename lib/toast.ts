/**
 * Toast Notification System
 * Task 24: Error Handling & User Feedback
 */
import { toast as sonnerToast } from 'sonner'

export const toast = {
  success: (message: string, description?: string) => {
    sonnerToast.success(message, {
      description,
      duration: 3000,
      style: {
        background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.1), rgba(16, 185, 129, 0.1))',
        border: '1px solid rgba(6, 182, 212, 0.3)',
        color: '#ffffff',
        backdropFilter: 'blur(12px)',
      },
    })
  },

  error: (message: string, description?: string) => {
    sonnerToast.error(message, {
      description,
      duration: 4000,
      style: {
        background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.1), rgba(220, 38, 38, 0.1))',
        border: '1px solid rgba(239, 68, 68, 0.3)',
        color: '#ffffff',
        backdropFilter: 'blur(12px)',
      },
    })
  },

  info: (message: string, description?: string) => {
    sonnerToast.info(message, {
      description,
      duration: 3000,
      style: {
        background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.1), rgba(147, 51, 234, 0.1))',
        border: '1px solid rgba(168, 85, 247, 0.3)',
        color: '#ffffff',
        backdropFilter: 'blur(12px)',
      },
    })
  },

  loading: (message: string) => {
    return sonnerToast.loading(message, {
      style: {
        background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02))',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        color: '#ffffff',
        backdropFilter: 'blur(12px)',
      },
    })
  },

  promise: <T,>(
    promise: Promise<T>,
    messages: {
      loading: string
      success: string
      error: string
    }
  ) => {
    return sonnerToast.promise(promise, {
      loading: messages.loading,
      success: messages.success,
      error: messages.error,
      style: {
        background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02))',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        color: '#ffffff',
        backdropFilter: 'blur(12px)',
      },
    })
  },
}
