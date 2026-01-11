'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useUser } from '@clerk/nextjs'
import { useRouter, useSearchParams } from 'next/navigation'
import { 
  Radio, Video, Users, MessageCircle, Mic, MicOff, 
  VideoIcon, VideoOff, Settings, Share2,
  Send, Circle, Eye, Music, Play, Pause, 
  PhoneOff, Maximize2, Clock, Wifi, WifiOff, Download
} from 'lucide-react'
import Image from 'next/image'
import { useAudioPlayer } from '@/app/contexts/AudioPlayerContext'
import { getUserMedia, STREAM_QUALITIES, formatBandwidth } from '@/lib/webrtc'

function StationContent() {
  const { user } = useUser()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { currentTrack, isPlaying, togglePlayPause } = useAudioPlayer()
  
  const djUsername = searchParams.get('dj')
  const isHost = !djUsername || djUsername === user?.username
  
  const [isLive, setIsLive] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [viewerCount, setViewerCount] = useState(0)
  const [chatMessages, setChatMessages] = useState<any[]>([])
  const [chatInput, setChatInput] = useState('')
  const [isMicOn, setIsMicOn] = useState(true)
  const [isVideoOn, setIsVideoOn] = useState(true)
  const [streamQuality, setStreamQuality] = useState<'480p' | '720p' | '1080p'>('720p')
  const [streamTitle, setStreamTitle] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [bandwidth, setBandwidth] = useState(0)
  
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamContainerRef = useRef<HTMLDivElement>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const localStreamRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  const startStream = async () => {
    try {
      const quality = STREAM_QUALITIES[streamQuality]
      const stream = await getUserMedia(quality)
      
      localStreamRef.current = stream
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
      
      const videoTrack = stream.getVideoTracks()[0]
      if (videoTrack) {
        const settings = videoTrack.getSettings()
        const estimatedBandwidth = Math.round(
          ((settings.width || 1280) * (settings.height || 720) * (settings.frameRate || 30) * 0.1) / 1000
        )
        setBandwidth(estimatedBandwidth)
      }
      
      const response = await fetch('/api/station', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isLive: true,
          username: user?.username || 'DJ',
          title: streamTitle || `${user?.username}'s Station`
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
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop())
        localStreamRef.current = null
      }
      
      if (videoRef.current) {
        videoRef.current.srcObject = null
      }
      
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
    }
  }

  const toggleMic = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0]
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled
        setIsMicOn(audioTrack.enabled)
      }
    }
  }

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0]
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled
        setIsVideoOn(videoTrack.enabled)
      }
    }
  }

  const sendMessage = async () => {
    if (!chatInput.trim() || !user) return
    
    const message = {
      id: Date.now().toString(),
      user_id: user.id,
      username: user.username || 'Anonymous',
      avatar: user.imageUrl || '/default-avatar.png',
      message: chatInput,
      timestamp: new Date()
    }
    
    setChatMessages(prev => [...prev, message])
    setChatInput('')
  }

  return (
    <div className="min-h-screen bg-black text-white pt-20 pb-24">
      <div className="px-6 py-4 border-b border-white/10 backdrop-blur-xl bg-black/50 sticky top-16 z-40">
        <div className="flex items-center justify-between max-w-screen-2xl mx-auto">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 flex items-center justify-center animate-pulse">
              <Radio size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-bold">
                {streamTitle || (isHost ? '444 Radio Station' : `${djUsername}'s Station`)}
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
              onClick={() => {
                const url = `${window.location.origin}/station?dj=${user?.username}`
                navigator.clipboard.writeText(url)
                alert('Station link copied!')
              }}
              className="px-4 py-2 bg-white/10 border border-white/20 rounded-lg hover:bg-white/20 transition-all flex items-center gap-2"
            >
              <Share2 size={16} />
              Share
            </button>
            {isHost && !isLive && (
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
          <div className="lg:col-span-3 space-y-6">
            <div 
              ref={streamContainerRef}
              className="relative bg-gradient-to-br from-gray-900 to-black rounded-2xl overflow-hidden aspect-video border border-white/10 shadow-2xl"
            >
              {isStreaming ? (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    muted={isHost}
                    playsInline
                    className="w-full h-full object-cover"
                  />
                  
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

                  {isHost && (
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
                      </div>
                      
                      <div className="flex items-center justify-center gap-4 mt-4 text-xs text-gray-400">
                        <span>{formatBandwidth(bandwidth)}</span>
                        <span>•</span>
                        <span>{STREAM_QUALITIES[streamQuality].label}</span>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-8">
                  <div className="w-24 h-24 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 flex items-center justify-center mb-6 animate-pulse">
                    <Radio size={48} />
                  </div>
                  <h2 className="text-3xl font-bold mb-2">
                    {isHost ? 'Start Your Station' : 'Station Offline'}
                  </h2>
                  <p className="text-gray-400 text-center mb-8 max-w-md">
                    {isHost
                      ? 'Go live and share your music with the 444 community'
                      : `${djUsername} is not streaming right now`}
                  </p>
                  
                  {isHost && (
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

            {currentTrack && (
              <div className="bg-gradient-to-br from-cyan-900/20 to-black border border-cyan-500/20 rounded-2xl p-6">
                <div className="flex items-center gap-4">
                  <div className="relative w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden">
                    <Image
                      src={currentTrack.imageUrl || '/default-artwork.jpg'}
                      alt={currentTrack.title}
                      fill
                      className="object-cover"
                    />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-cyan-400 mb-1 flex items-center gap-2">
                      <Music size={12} />
                      NOW PLAYING FROM 444
                    </p>
                    <h3 className="text-lg font-bold">{currentTrack.title}</h3>
                    <p className="text-sm text-gray-400">{currentTrack.artist || 'Unknown Artist'}</p>
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

          <div>
            <div className="bg-gradient-to-br from-gray-900 to-black border border-white/10 rounded-2xl h-[calc(100vh-300px)] flex flex-col">
              <div className="p-4 border-b border-white/10">
                <h3 className="font-bold flex items-center gap-2">
                  <MessageCircle size={20} className="text-cyan-400" />
                  Live Chat
                </h3>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {chatMessages.length === 0 ? (
                  <div className="text-center text-gray-500 py-12">
                    <MessageCircle size={48} className="mx-auto mb-4 opacity-50" />
                    <p>No messages yet</p>
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
                    disabled={!chatInput.trim()}
                    className="w-10 h-10 rounded-lg bg-cyan-500 hover:bg-cyan-400 flex items-center justify-center transition-all disabled:opacity-50"
                  >
                    <Send size={16} className="text-black" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

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
                <label className="block text-sm text-gray-400 mb-2">Stream Quality</label>
                <select
                  value={streamQuality}
                  onChange={(e) => setStreamQuality(e.target.value as any)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-cyan-500 text-white"
                >
                  <option value="480p">480p - Low (1 Mbps)</option>
                  <option value="720p">720p - Medium (2.5 Mbps)</option>
                  <option value="1080p">1080p - High (4 Mbps)</option>
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

export default function StationPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black flex items-center justify-center text-white">Loading station...</div>}>
      <StationContent />
    </Suspense>
  )
}
