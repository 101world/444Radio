'use client'

import { useState, useEffect, useRef } from 'react'
import { useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { 
  Radio, Video, Users, MessageCircle, Mic, MicOff, 
  VideoIcon, VideoOff, Settings, Share2, Heart, 
  Send, Circle, Eye, Music, Play, Pause, Volume2,
  VolumeX, Maximize2, PhoneOff, Monitor, Camera
} from 'lucide-react'
import Image from 'next/image'
import { useAudioPlayer } from '@/app/contexts/AudioPlayerContext'

interface ChatMessage {
  id: string
  user_id: string
  username: string
  avatar: string
  message: string
  timestamp: Date
}

interface Station {
  id: string
  user_id: string
  is_live: boolean
  title: string
  description: string
  genre: string
  listener_count: number
  started_at: string
}

export default function StationPage() {
  const { user } = useUser()
  const router = useRouter()
  const { currentTrack, isPlaying, togglePlayPause } = useAudioPlayer()
  
  // Stream State
  const [isLive, setIsLive] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [viewerCount, setViewerCount] = useState(0)
  const [stationInfo, setStationInfo] = useState<Station | null>(null)
  
  // Chat State
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [isChatVisible, setIsChatVisible] = useState(true)
  
  // Media Controls
  const [isMicOn, setIsMicOn] = useState(true)
  const [isVideoOn, setIsVideoOn] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [volume, setVolume] = useState(100)
  const [isMuted, setIsMuted] = useState(false)
  
  // Stream Settings
  const [streamTitle, setStreamTitle] = useState('')
  const [streamDescription, setStreamDescription] = useState('')
  const [streamGenre, setStreamGenre] = useState('Electronic')
  const [showSettings, setShowSettings] = useState(false)
  
  // Refs
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamContainerRef = useRef<HTMLDivElement>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  // Load station data
  useEffect(() => {
    if (user?.id) {
      fetchStationData()
    }
  }, [user])

  // Poll for viewer count
  useEffect(() => {
    if (!isLive) return
    
    const interval = setInterval(async () => {
      try {
        const response = await fetch('/api/station/listeners')
        const data = await response.json()
        setViewerCount(data.count || 0)
      } catch (error) {
        console.error('Failed to fetch listener count:', error)
      }
    }, 5000)
    
    return () => clearInterval(interval)
  }, [isLive])

  const fetchStationData = async () => {
    try {
      const response = await fetch(`/api/station?userId=${user?.id}`)
      const data = await response.json()
      if (data.station) {
        setStationInfo(data.station)
        setIsLive(data.station.is_live)
        setViewerCount(data.station.listener_count || 0)
        setStreamTitle(data.station.title || '')
        setStreamDescription(data.station.description || '')
        setStreamGenre(data.station.genre || 'Electronic')
      }
    } catch (error) {
      console.error('Failed to fetch station data:', error)
    }
  }

  const startStream = async () => {
    try {
      // Get user media
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      })
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
      
      // Start streaming via API
      const response = await fetch('/api/station', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isLive: true,
          username: user?.username || 'DJ',
          title: streamTitle || `${user?.username}'s Station`,
          description: streamDescription || 'Live music session',
          genre: streamGenre
        })
      })
      
      const data = await response.json()
      if (data.success) {
        setIsLive(true)
        setIsStreaming(true)
        setShowSettings(false)
      }
    } catch (error) {
      console.error('Failed to start stream:', error)
      alert('Failed to access camera/microphone. Please check permissions.')
    }
  }

  const endStream = async () => {
    try {
      // Stop media tracks
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream
        stream.getTracks().forEach(track => track.stop())
        videoRef.current.srcObject = null
      }
      
      // End stream via API
      const response = await fetch('/api/station', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isLive: false,
          username: user?.username || 'DJ'
        })
      })
      
      const data = await response.json()
      if (data.success) {
        setIsLive(false)
        setIsStreaming(false)
      }
    } catch (error) {
      console.error('Failed to end stream:', error)
      alert('Failed to end stream')
    }
  }

  const toggleMic = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream
      const audioTrack = stream.getAudioTracks()[0]
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled
        setIsMicOn(audioTrack.enabled)
      }
    }
  }

  const toggleVideo = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream
      const videoTrack = stream.getVideoTracks()[0]
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled
        setIsVideoOn(videoTrack.enabled)
      }
    }
  }

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      streamContainerRef.current?.requestFullscreen()
      setIsFullscreen(true)
    } else {
      document.exitFullscreen()
      setIsFullscreen(false)
    }
  }

  const sendMessage = async () => {
    if (!chatInput.trim() || !user) return
    
    try {
      const response = await fetch('/api/station/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stationUserId: user.id,
          message: chatInput,
          username: user.username || 'Anonymous',
          avatar: user.imageUrl || '/default-avatar.png'
        })
      })
      
      if (response.ok) {
        setChatInput('')
      }
    } catch (error) {
      console.error('Failed to send message:', error)
    }
  }

  const shareStation = () => {
    const url = `${window.location.origin}/station?dj=${user?.username}`
    navigator.clipboard.writeText(url)
    alert('Station link copied to clipboard!')
  }

  return (
    <div className="min-h-screen bg-black text-white pt-20 pb-24">
      {/* Header */}
      <div className="px-6 py-4 border-b border-white/10 backdrop-blur-xl bg-black/50 sticky top-16 z-40">
        <div className="flex items-center justify-between max-w-screen-2xl mx-auto">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 flex items-center justify-center">
              <Radio size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-bold">
                {streamTitle || '444 Radio Station'}
              </h1>
              <p className="text-sm text-gray-400">
                {isLive ? (
                  <span className="flex items-center gap-2">
                    <Circle size={8} className="fill-red-500 text-red-500 animate-pulse" />
                    LIVE • {viewerCount} listeners
                  </span>
                ) : (
                  'Offline'
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={shareStation}
              className="px-4 py-2 bg-white/10 border border-white/20 rounded-lg hover:bg-white/20 transition-all flex items-center gap-2"
            >
              <Share2 size={16} />
              Share
            </button>
            {!isLive && (
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="px-4 py-2 bg-cyan-500 text-black rounded-lg hover:bg-cyan-400 transition-all flex items-center gap-2 font-bold"
              >
                <Settings size={16} />
                Setup Stream
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-screen-2xl mx-auto px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Stream Area (3/4 width on desktop) */}
          <div className="lg:col-span-3 space-y-6">
            {/* Video Container */}
            <div 
              ref={streamContainerRef}
              className="relative bg-gradient-to-br from-gray-900 to-black rounded-2xl overflow-hidden aspect-video border border-white/10 shadow-2xl"
            >
              {isStreaming ? (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    muted
                    playsInline
                    className="w-full h-full object-cover"
                  />
                  
                  {/* Stream Overlay */}
                  <div className="absolute top-4 left-4 flex items-center gap-3">
                    <div className="px-3 py-1 bg-red-500 rounded-full text-xs font-bold flex items-center gap-2 shadow-lg">
                      <Circle size={8} className="fill-current animate-pulse" />
                      LIVE
                    </div>
                    <div className="px-3 py-1 bg-black/60 backdrop-blur rounded-full text-xs flex items-center gap-2">
                      <Eye size={12} />
                      {viewerCount}
                    </div>
                  </div>

                  {/* Stream Controls */}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-6">
                    <div className="flex items-center justify-center gap-4">
                      <button
                        onClick={toggleMic}
                        className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                          isMicOn ? 'bg-white/20 hover:bg-white/30' : 'bg-red-500 hover:bg-red-600'
                        }`}
                      >
                        {isMicOn ? <Mic size={20} /> : <MicOff size={20} />}
                      </button>
                      
                      <button
                        onClick={toggleVideo}
                        className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                          isVideoOn ? 'bg-white/20 hover:bg-white/30' : 'bg-red-500 hover:bg-red-600'
                        }`}
                      >
                        {isVideoOn ? <VideoIcon size={20} /> : <VideoOff size={20} />}
                      </button>

                      <button
                        onClick={endStream}
                        className="w-14 h-14 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-all shadow-lg"
                      >
                        <PhoneOff size={24} />
                      </button>

                      <button
                        onClick={toggleFullscreen}
                        className="w-12 h-12 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-all"
                      >
                        <Maximize2 size={20} />
                      </button>

                      <button
                        onClick={() => setIsChatVisible(!isChatVisible)}
                        className="w-12 h-12 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-all lg:hidden"
                      >
                        <MessageCircle size={20} />
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-8">
                  <div className="w-24 h-24 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 flex items-center justify-center mb-6 animate-pulse">
                    <Radio size={48} />
                  </div>
                  <h2 className="text-3xl font-bold mb-2">
                    {isLive ? 'Station is Live!' : 'Start Your Station'}
                  </h2>
                  <p className="text-gray-400 text-center mb-8 max-w-md">
                    {isLive
                      ? 'Your station is broadcasting to the world'
                      : 'Go live and share your music with the 444 community'}
                  </p>
                  
                  {!isLive && (
                    <button
                      onClick={startStream}
                      className="px-8 py-4 bg-gradient-to-r from-cyan-500 to-blue-500 text-black rounded-xl font-bold text-lg hover:from-cyan-400 hover:to-blue-400 transition-all shadow-2xl shadow-cyan-500/50 flex items-center gap-3"
                    >
                      <Video size={24} />
                      Go Live
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Now Playing */}
            {currentTrack && (
              <div className="bg-gradient-to-br from-cyan-900/20 to-black border border-cyan-500/20 rounded-2xl p-6">
                <div className="flex items-center gap-4">
                  <div className="relative w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden">
                    <Image
                      src={currentTrack.image_url}
                      alt={currentTrack.title}
                      fill
                      className="object-cover"
                    />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-cyan-400 mb-1">NOW PLAYING</p>
                    <h3 className="text-lg font-bold">{currentTrack.title}</h3>
                    <p className="text-sm text-gray-400">{currentTrack.genre}</p>
                  </div>
                  <button
                    onClick={togglePlayPause}
                    className="w-12 h-12 rounded-full bg-cyan-500 flex items-center justify-center hover:bg-cyan-400 transition-all"
                  >
                    {isPlaying ? <Pause size={20} className="text-black" /> : <Play size={20} className="text-black ml-0.5" />}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Chat Sidebar (1/4 width on desktop) */}
          <div className={`lg:block ${isChatVisible ? 'block' : 'hidden'}`}>
            <div className="bg-gradient-to-br from-gray-900 to-black border border-white/10 rounded-2xl h-[calc(100vh-300px)] flex flex-col">
              {/* Chat Header */}
              <div className="p-4 border-b border-white/10">
                <h3 className="font-bold flex items-center gap-2">
                  <MessageCircle size={20} className="text-cyan-400" />
                  Live Chat
                </h3>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {chatMessages.length === 0 ? (
                  <div className="text-center text-gray-500 py-12">
                    <MessageCircle size={48} className="mx-auto mb-4 opacity-50" />
                    <p>No messages yet</p>
                    <p className="text-sm">Be the first to say something!</p>
                  </div>
                ) : (
                  chatMessages.map((msg) => (
                    <div key={msg.id} className="flex gap-3">
                      <Image
                        src={msg.avatar}
                        alt={msg.username}
                        width={32}
                        height={32}
                        className="rounded-full flex-shrink-0"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-bold text-sm">{msg.username}</span>
                          <span className="text-xs text-gray-500">
                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-sm text-gray-300">{msg.message}</p>
                      </div>
                    </div>
                  ))
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Chat Input */}
              <div className="p-4 border-t border-white/10">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                    placeholder="Say something..."
                    className="flex-1 px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-cyan-500 text-sm"
                  />
                  <button
                    onClick={sendMessage}
                    className="w-10 h-10 rounded-lg bg-cyan-500 hover:bg-cyan-400 flex items-center justify-center transition-all"
                  >
                    <Send size={16} className="text-black" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stream Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-gray-900 to-black border border-cyan-500/30 rounded-2xl p-8 max-w-2xl w-full shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-cyan-400">Stream Setup</h3>
              <button
                onClick={() => setShowSettings(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Stream Title</label>
                <input
                  type="text"
                  value={streamTitle}
                  onChange={(e) => setStreamTitle(e.target.value)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-cyan-500 text-white"
                  placeholder="Give your stream a catchy title..."
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Description</label>
                <textarea
                  value={streamDescription}
                  onChange={(e) => setStreamDescription(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-cyan-500 text-white resize-none"
                  placeholder="What's your stream about?"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Genre</label>
                <select
                  value={streamGenre}
                  onChange={(e) => setStreamGenre(e.target.value)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-cyan-500 text-white"
                >
                  <option value="Electronic">Electronic</option>
                  <option value="Hip-Hop">Hip-Hop</option>
                  <option value="Rock">Rock</option>
                  <option value="Pop">Pop</option>
                  <option value="Jazz">Jazz</option>
                  <option value="Classical">Classical</option>
                  <option value="Ambient">Ambient</option>
                  <option value="Lo-Fi">Lo-Fi</option>
                  <option value="House">House</option>
                  <option value="Techno">Techno</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowSettings(false)}
                className="flex-1 px-6 py-3 bg-white/5 border border-white/10 text-gray-300 rounded-lg hover:bg-white/10 transition-all font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={startStream}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-black rounded-lg hover:from-cyan-400 hover:to-blue-400 transition-all font-bold shadow-lg"
              >
                Start Streaming
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
