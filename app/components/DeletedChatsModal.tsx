'use client'

import { useState, useEffect } from 'react'
import { X, RotateCcw, Trash2, MessageSquare, Clock, History } from 'lucide-react'

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
  const [expandedChat, setExpandedChat] = useState<string | null>(null)

  // Reload archive list every time the modal opens
  useEffect(() => {
    if (!isOpen) { setExpandedChat(null); return }
    try {
      const stored = localStorage.getItem('444radio-chat-archives')
      if (stored) {
        const parsed = JSON.parse(stored) as ArchivedChat[]
        const chats = parsed.map(c => ({
          ...c,
          archivedAt: new Date(c.archivedAt),
          messages: c.messages.map(m => ({ ...m, timestamp: new Date(m.timestamp) }))
        }))
        chats.sort((a, b) => b.archivedAt.getTime() - a.archivedAt.getTime())
        setArchivedChats(chats)
      } else {
        setArchivedChats([])
      }
    } catch {
      setArchivedChats([])
    }
  }, [isOpen])

  const handleRestore = (chat: ArchivedChat) => {
    onRestore(chat)
    // Chat stays in archive — it's history, not a one-time restore
  }

  const handleDelete = (chatId: string) => {
    if (!confirm('Permanently delete this chat from history?')) return
    const updated = archivedChats.filter(c => c.id !== chatId)
    try {
      localStorage.setItem('444radio-chat-archives', JSON.stringify(updated))
    } catch { /* noop */ }
    setArchivedChats(updated)
    onDelete(chatId)
  }

  const handleClearAll = () => {
    if (!confirm('Clear entire chat history? This cannot be undone.')) return
    try { localStorage.removeItem('444radio-chat-archives') } catch { /* noop */ }
    setArchivedChats([])
  }

  // ---- helpers ----
  const formatDate = (date: Date) => {
    const now = new Date()
    const ms = now.getTime() - date.getTime()
    const mins = Math.floor(ms / 60000)
    const hrs = Math.floor(ms / 3600000)
    const days = Math.floor(ms / 86400000)
    if (mins < 1) return 'Just now'
    if (mins < 60) return `${mins}m ago`
    if (hrs < 24) return `${hrs}h ago`
    if (days < 7) return `${days}d ago`
    return date.toLocaleDateString('en-US', {
      month: 'short', day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    })
  }

  const getChatTitle = (chat: ArchivedChat): string => {
    const userMsg = chat.messages.find(m => m.type === 'user')
    if (userMsg) {
      const text = userMsg.content.replace(/\n/g, ' ').trim()
      return text.length > 55 ? text.substring(0, 55) + '\u2026' : text
    }
    const assistantMsg = chat.messages.find(m => m.type === 'assistant' && !m.content.startsWith('\u{1F44B}'))
    if (assistantMsg) return assistantMsg.content.substring(0, 55)
    return 'New chat'
  }

  const getGenerationCount = (chat: ArchivedChat): number =>
    chat.messages.filter(m => m.result || m.stems).length

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900 border-2 border-purple-500/30 rounded-3xl p-5 md:p-8 max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col shadow-2xl shadow-purple-500/20"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/20 rounded-xl">
              <History className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <h2 className="text-xl md:text-2xl font-bold text-white">Chat History</h2>
              <p className="text-xs md:text-sm text-gray-400">
                {archivedChats.length} previous {archivedChats.length === 1 ? 'session' : 'sessions'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {archivedChats.length > 0 && (
              <button
                onClick={handleClearAll}
                className="text-xs text-red-400/70 hover:text-red-400 transition-colors px-2 py-1"
              >
                Clear all
              </button>
            )}
            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>

        {/* Chat list */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
          {archivedChats.length === 0 ? (
            <div className="text-center py-16">
              <MessageSquare className="w-14 h-14 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400 text-lg">No chat history yet</p>
              <p className="text-gray-500 text-sm mt-2">
                When you clear a chat, it will be saved here
              </p>
            </div>
          ) : (
            archivedChats.map(chat => {
              const isExpanded = expandedChat === chat.id
              const genCount = getGenerationCount(chat)
              return (
                <div
                  key={chat.id}
                  className="bg-black/40 border border-purple-500/20 rounded-2xl hover:border-purple-500/40 transition-all"
                >
                  {/* Row header — clickable to expand */}
                  <button
                    className="w-full text-left p-4 flex items-center gap-3"
                    onClick={() => setExpandedChat(isExpanded ? null : chat.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium truncate">
                        {getChatTitle(chat)}
                      </p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {formatDate(chat.archivedAt)}
                        </span>
                        <span>{chat.messageCount} msgs</span>
                        {genCount > 0 && (
                          <span className="text-purple-400/70">
                            {genCount} {genCount === 1 ? 'generation' : 'generations'}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-1.5 flex-shrink-0" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => handleRestore(chat)}
                        className="p-2 bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 hover:border-green-400/50 rounded-xl transition-all"
                        title="Restore this chat"
                      >
                        <RotateCcw className="w-4 h-4 text-green-400" />
                      </button>
                      <button
                        onClick={() => handleDelete(chat.id)}
                        className="p-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 hover:border-red-400/40 rounded-xl transition-all"
                        title="Delete from history"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-red-400/70" />
                      </button>
                    </div>
                  </button>

                  {/* Expanded preview */}
                  {isExpanded && (
                    <div className="px-4 pb-4 border-t border-gray-700/40">
                      <div className="space-y-1.5 pt-3 text-xs max-h-48 overflow-y-auto">
                        {chat.messages
                          .filter(m => !(m.type === 'assistant' && m.content.startsWith('\u{1F44B}')))
                          .slice(0, 12)
                          .map((msg, idx) => (
                            <div key={idx} className="flex items-start gap-2">
                              <span className={`flex-shrink-0 ${
                                msg.type === 'user' ? 'text-blue-400' : 'text-purple-400'
                              }`}>
                                {msg.type === 'user' ? '\u{1F464}' : '\u{1F916}'}
                              </span>
                              <span className="text-gray-400 break-words">
                                {msg.content.length > 80
                                  ? msg.content.substring(0, 80) + '\u2026'
                                  : msg.content}
                              </span>
                            </div>
                          ))}
                        {chat.messages.length > 13 && (
                          <p className="text-gray-500 text-center pt-1">
                            +{chat.messages.length - 13} more messages
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>

        {/* Footer */}
        <div className="mt-4 pt-3 border-t border-gray-700/50">
          <p className="text-[10px] text-gray-600 text-center">
            Chat history is stored locally in your browser. Max 50 sessions kept.
          </p>
        </div>
      </div>

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(0,0,0,0.2); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(168,85,247,0.3); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(168,85,247,0.5); }
      `}</style>
    </div>
  )
}
