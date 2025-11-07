'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import { Radio, Users, Send, ArrowLeft, Circle } from 'lucide-react'
import Image from 'next/image'
import { useAudioPlayer } from '@/app/contexts/AudioPlayerContext'

interface Station {
  id: string
  title: string
  description: string
  coverUrl: string | null
  genre: string
  isLive: boolean
  listenerCount: number
  owner: {
    userId: string
    username: string
    profileImage: string | null
  }
}

interface ChatMessage {
  id: string
  userId: string
  username: string
  message: string
  timestamp: string
}

export default function StationPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useUser()
  const stationId = params.id as string

  const [station, setStation] = useState<Station | null>(null)
  const [loading, setLoading] = useState(true)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [listeners, setListeners] = useState<number>(0)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchStation()
    // In production, connect to WebSocket here for real-time chat
    // const socket = io()
    // socket.emit('join-station', stationId)
    // socket.on('chat-message', handleNewMessage)
    // socket.on('listener-count', setListeners)
  }, [stationId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const fetchStation = async () => {
    try {
      const response = await fetch(`/api/station?id=${stationId}`)
      const data = await response.json()
      
      if (data.success) {
        setStation(data.station)
        setListeners(data.station.listenerCount)
      }
    } catch (error) {
      console.error('Failed to fetch station:', error)
    } finally {
      setLoading(false)
    }
  }

  const sendMessage = async () => {
    if (!newMessage.trim() || !user) return

    const message: ChatMessage = {
      id: Date.now().toString(),
      userId: user.id,
      username: user.username || user.firstName || 'Anonymous',
      message: newMessage.trim(),
      timestamp: new Date().toISOString()
    }

    // In production, send via WebSocket
    // socket.emit('send-message', { stationId, message })
    
    setMessages(prev => [...prev, message])
    setNewMessage('')

    // Also send to API for persistence
    try {
      await fetch('/api/station/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stationId,
          message: newMessage.trim()
        })
      })
    } catch (error) {
      console.error('Failed to send message:', error)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-cyan-400 flex items-center gap-2">
          <Radio className="animate-pulse" size={24} />
          <span>Loading station...</span>
        </div>
      </div>
    )
  }

  if (!station) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <Radio className="mx-auto text-gray-600 mb-4" size={64} />
          <h3 className="text-xl text-gray-400 mb-2">Station not found</h3>
          <button
            onClick={() => router.push('/stations')}
            className="mt-4 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 rounded-lg"
          >
            Back to Stations
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-black/95 backdrop-blur-lg border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => router.push('/stations')}
              className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft size={20} />
              Back
            </button>
            
            <div className="flex items-center gap-4">
              {station.isLive && (
                <div className="flex items-center gap-2 px-3 py-1 bg-red-500 rounded-full text-sm font-bold">
                  <Circle className="w-2 h-2 animate-pulse" fill="white" />
                  LIVE
                </div>
              )}
              <div className="flex items-center gap-2 text-gray-400">
                <Users size={18} />
                <span className="text-sm">{listeners} listening</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Station Info & Player */}
          <div className="lg:col-span-2 space-y-6">
            {/* Cover & Info */}
            <div className="bg-gradient-to-br from-gray-900 to-black border border-white/10 rounded-xl p-6">
              <div className="flex gap-6">
                <div className="relative w-48 h-48 flex-shrink-0 rounded-xl overflow-hidden bg-gradient-to-br from-cyan-900/20 to-purple-900/20">
                  {station.coverUrl ? (
                    <Image
                      src={station.coverUrl}
                      alt={station.title}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Radio className="text-cyan-400/30" size={64} />
                    </div>
                  )}
                </div>

                <div className="flex-1">
                  <h1 className="text-3xl font-bold mb-2">{station.title}</h1>
                  {station.description && (
                    <p className="text-gray-400 mb-4">{station.description}</p>
                  )}
                  
                  <div className="flex items-center gap-3 mb-4">
                    {station.owner.profileImage ? (
                      <Image
                        src={station.owner.profileImage}
                        alt={station.owner.username}
                        width={32}
                        height={32}
                        className="rounded-full"
                      />
                    ) : (
                      <div className="w-8 h-8 bg-gray-700 rounded-full" />
                    )}
                    <div>
                      <p className="text-sm text-gray-500">Hosted by</p>
                      <p className="font-medium">{station.owner.username}</p>
                    </div>
                  </div>

                  <div className="inline-block px-3 py-1 bg-cyan-500/10 border border-cyan-500/30 rounded-lg text-cyan-400 text-sm">
                    {station.genre}
                  </div>
                </div>
              </div>
            </div>

            {/* Player Status */}
            <div className="bg-gradient-to-br from-gray-900 to-black border border-white/10 rounded-xl p-6">
              {station.isLive ? (
                <div className="text-center">
                  <div className="w-24 h-24 mx-auto mb-4 bg-gradient-to-br from-red-500 to-red-600 rounded-full flex items-center justify-center">
                    <Radio className="text-white" size={40} />
                  </div>
                  <h3 className="text-xl font-bold mb-2">Broadcasting Live</h3>
                  <p className="text-gray-400 mb-4">You're connected to the live stream</p>
                  {/* In production, add HLS player here */}
                  <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-red-500 to-red-600 animate-pulse w-full" />
                  </div>
                </div>
              ) : (
                <div className="text-center text-gray-500">
                  <Radio className="mx-auto mb-3" size={48} />
                  <p>Station is offline</p>
                  <p className="text-sm mt-1">Check back later when they go live</p>
                </div>
              )}
            </div>
          </div>

          {/* Chat */}
          <div className="lg:col-span-1">
            <div className="bg-gradient-to-br from-gray-900 to-black border border-white/10 rounded-xl overflow-hidden flex flex-col h-[600px]">
              {/* Chat Header */}
              <div className="px-4 py-3 border-b border-white/10">
                <h3 className="font-bold flex items-center gap-2">
                  <Users size={18} className="text-cyan-400" />
                  Live Chat
                </h3>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.length === 0 ? (
                  <div className="text-center text-gray-500 py-8">
                    <p>No messages yet</p>
                    <p className="text-sm mt-1">Be the first to say hi! 👋</p>
                  </div>
                ) : (
                  messages.map(msg => (
                    <div key={msg.id} className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm text-cyan-400">
                          {msg.username}
                        </span>
                        <span className="text-xs text-gray-600">
                          {new Date(msg.timestamp).toLocaleTimeString([], { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </span>
                      </div>
                      <p className="text-sm text-gray-300">{msg.message}</p>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input */}
              {user ? (
                <div className="p-4 border-t border-white/10">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                      placeholder="Type a message..."
                      className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50"
                    />
                    <button
                      onClick={sendMessage}
                      disabled={!newMessage.trim()}
                      className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
                    >
                      <Send size={18} />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-4 border-t border-white/10 text-center text-sm text-gray-500">
                  Sign in to chat
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
