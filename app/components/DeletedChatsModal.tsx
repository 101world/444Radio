'use client'

import { useState } from 'react'
import { X, RotateCcw, Trash2, MessageSquare, Clock } from 'lucide-react'

interface Message {
  id: string
  type: 'user' | 'assistant' | 'generation'
  content: string
  timestamp: Date
  [key: string]: any
}

interface ArchivedChat {
  id: string
  messages: Message[]
  archivedAt: Date
  messageCount: number
}

interface DeletedChatsModalProps {
  isOpen: boolean
  onClose: () => void
  onRestore: (chat: ArchivedChat) => void
  onDelete: (chatId: string) => void
}

export default function DeletedChatsModal({ 
  isOpen, 
  onClose, 
  onRestore, 
  onDelete 
}: DeletedChatsModalProps) {
  const [archivedChats, setArchivedChats] = useState<ArchivedChat[]>([])
  const [loading, setLoading] = useState(false)

  // Load archived chats from localStorage when modal opens
  useState(() => {
    if (isOpen) {
      loadArchivedChats()
    }
  })

  const loadArchivedChats = () => {
    try {
      setLoading(true)
      const stored = localStorage.getItem('444radio-chat-archives')
      if (stored) {
        const parsed = JSON.parse(stored) as ArchivedChat[]
        // Convert timestamp strings back to Date objects
        const chatsWithDates = parsed.map(chat => ({
          ...chat,
          archivedAt: new Date(chat.archivedAt),
          messages: chat.messages.map(msg => ({
            ...msg,
            timestamp: new Date(msg.timestamp)
          }))
        }))
        // Sort by most recent first
        chatsWithDates.sort((a, b) => b.archivedAt.getTime() - a.archivedAt.getTime())
        setArchivedChats(chatsWithDates)
      } else {
        setArchivedChats([])
      }
    } catch (error) {
      console.error('Failed to load archived chats:', error)
      setArchivedChats([])
    } finally {
      setLoading(false)
    }
  }

  const handleRestore = (chat: ArchivedChat) => {
    if (confirm('Restore this chat? Your current chat will be saved to archive.')) {
      onRestore(chat)
      // Remove restored chat from archives
      const updatedArchives = archivedChats.filter(c => c.id !== chat.id)
      try {
        localStorage.setItem('444radio-chat-archives', JSON.stringify(updatedArchives))
        setArchivedChats(updatedArchives)
      } catch (error) {
        console.error('Failed to update archives:', error)
      }
    }
  }

  const handleDelete = (chatId: string) => {
    if (confirm('Permanently delete this archived chat? This cannot be undone.')) {
      onDelete(chatId)
      const updatedArchives = archivedChats.filter(c => c.id !== chatId)
      try {
        localStorage.setItem('444radio-chat-archives', JSON.stringify(updatedArchives))
        setArchivedChats(updatedArchives)
      } catch (error) {
        console.error('Failed to update archives:', error)
      }
    }
  }

  const formatDate = (date: Date) => {
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    })
  }

  const getPreviewText = (chat: ArchivedChat): string => {
    // Find first user message for preview
    const userMessage = chat.messages.find(m => m.type === 'user')
    if (userMessage) {
      return userMessage.content.length > 60 
        ? userMessage.content.substring(0, 60) + '...'
        : userMessage.content
    }
    return 'Empty chat'
  }

  if (!isOpen) return null

  // Reload chats when modal opens
  if (isOpen && archivedChats.length === 0 && !loading) {
    loadArchivedChats()
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900 border-2 border-purple-500/30 rounded-3xl p-6 md:p-8 max-w-3xl w-full max-h-[80vh] overflow-hidden flex flex-col shadow-2xl shadow-purple-500/20">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/20 rounded-xl">
              <MessageSquare className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Deleted Chats</h2>
              <p className="text-sm text-gray-400">Restore your previous conversations</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-xl transition-colors"
          >
            <X className="w-6 h-6 text-gray-400" />
          </button>
        </div>

        {/* Chat List */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
              <p className="text-gray-400">Loading archived chats...</p>
            </div>
          ) : archivedChats.length === 0 ? (
            <div className="text-center py-12">
              <MessageSquare className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400 text-lg">No deleted chats found</p>
              <p className="text-gray-500 text-sm mt-2">
                Cleared chats will appear here
              </p>
            </div>
          ) : (
            archivedChats.map((chat) => (
              <div
                key={chat.id}
                className="bg-black/40 border border-purple-500/20 rounded-2xl p-4 hover:border-purple-500/40 transition-all group"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="w-4 h-4 text-gray-500 flex-shrink-0" />
                      <span className="text-sm text-gray-400">
                        {formatDate(chat.archivedAt)}
                      </span>
                      <span className="text-xs text-gray-500 ml-auto">
                        {chat.messageCount} {chat.messageCount === 1 ? 'message' : 'messages'}
                      </span>
                    </div>
                    <p className="text-white text-sm truncate">
                      {getPreviewText(chat)}
                    </p>
                  </div>
                  
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleRestore(chat)}
                      className="p-2 bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 hover:border-green-400/50 rounded-xl transition-all"
                      title="Restore chat"
                    >
                      <RotateCcw className="w-4 h-4 text-green-400" />
                    </button>
                    <button
                      onClick={() => handleDelete(chat.id)}
                      className="p-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 hover:border-red-400/50 rounded-xl transition-all"
                      title="Delete permanently"
                    >
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </button>
                  </div>
                </div>

                {/* Message preview */}
                <div className="mt-3 pt-3 border-t border-gray-700/50">
                  <div className="space-y-1 text-xs">
                    {chat.messages.slice(0, 3).map((msg, idx) => (
                      <div key={idx} className="flex items-start gap-2">
                        <span className={`flex-shrink-0 ${
                          msg.type === 'user' ? 'text-blue-400' : 'text-purple-400'
                        }`}>
                          {msg.type === 'user' ? '👤' : '🤖'}
                        </span>
                        <span className="text-gray-400 truncate">
                          {msg.content.length > 50 
                            ? msg.content.substring(0, 50) + '...' 
                            : msg.content}
                        </span>
                      </div>
                    ))}
                    {chat.messages.length > 3 && (
                      <p className="text-gray-500 text-center">
                        +{chat.messages.length - 3} more messages
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-gray-700/50">
          <p className="text-xs text-gray-500 text-center">
            💡 Tip: Chats are stored locally in your browser. Clear browser data will remove archives.
          </p>
        </div>
      </div>

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.2);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(168, 85, 247, 0.3);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(168, 85, 247, 0.5);
        }
      `}</style>
    </div>
  )
}
