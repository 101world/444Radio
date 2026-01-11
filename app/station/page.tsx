'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useUser } from '@clerk/nextjs'
import { useRouter, useSearchParams } from 'next/navigation'
import { 
  Radio, Video, Users, MessageCircle, Mic, MicOff, 
  VideoIcon, VideoOff, Settings, Share2,
  Send, Circle, Eye, Music, Play, Pause, 
  PhoneOff, Maximize2, Clock, Wifi, WifiOff, Download, Camera
} from 'lucide-react'
import Image from 'next/image'
import { useAudioPlayer } from '@/app/contexts/AudioPlayerContext'
import { getUserMedia, STREAM_QUALITIES, formatBandwidth } from '@/lib/webrtc'
import { StationWebRTC } from '@/lib/station-webrtc'

function StationContent() {
  const { user } = useUser()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { currentTrack, isPlaying, togglePlayPause } = useAudioPlayer()
  
  const djUsername = searchParams.get('dj')
  const isHost = !djUsername || djUsername === user?.username
  const stationId = djUsername || user?.username || 'default'
  
  const [isLive, setIsLive] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [viewerCount, setViewerCount] = useState(0)
  const [chatMessages, setChatMessages] = useState<any[]>([])
  const [chatInput, setChatInput] = useState('')
  const [isMicOn, setIsMicOn] = useState(true)
  const [isVideoOn, setIsVideoOn] = useState(true)
  const [streamQuality, setStreamQuality] = useState<'480p' | '720p' | '1080p'>('720p')
  const [streamTitle, setStreamTitle] = useState('')
  const [hostUsername, setHostUsername] = useState(djUsername || user?.username || 'DJ')
  const [showSettings, setShowSettings] = useState(false)
  const [bandwidth, setBandwidth] = useState(0)
  const [viewers, setViewers] = useState<any[]>([])
  const [reactions, setReactions] = useState<any[]>([])
  const [isRecording, setIsRecording] = useState(false)
  const [streamDuration, setStreamDuration] = useState(0)
  const [peakViewers, setPeakViewers] = useState(0)
  const [totalMessages, setTotalMessages] = useState(0)
  const [totalReactions, setTotalReactions] = useState(0)
  const [connectionQuality, setConnectionQuality] = useState<'excellent' | 'good' | 'poor' | 'bad'>('excellent')
  const [showAnalytics, setShowAnalytics] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [showDeviceCheck, setShowDeviceCheck] = useState(false)
  const [deviceCheckResult, setDeviceCheckResult] = useState<{ cameras: any[], microphones: any[], error?: string } | null>(null)
  const [notifications, setNotifications] = useState<any[]>([])
  
  const videoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)
  const streamContainerRef = useRef<HTMLDivElement>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamStartTimeRef = useRef<number | null>(null)
  const webrtcRef = useRef<StationWebRTC | null>(null)

  // Auto-scroll chat to bottom when new messages arrive
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  // Check if station is live on mount
  useEffect(() => {
    if (!isHost && djUsername) {
      checkIfLive()
    }
  }, [djUsername, isHost])

  const checkIfLive = async () => {
    try {
      const response = await fetch(`/api/station?username=${djUsername}`)
      const data = await response.json()
      if (data.isLive) {
        setIsLive(true)
        setHostUsername(djUsername!)
        setStreamTitle(data.title || `${djUsername}'s Station`)
      }
    } catch (error) {
      console.error('Failed to check live status:', error)
    }
  }

  // Join stream as viewer
  useEffect(() => {
    if (!isHost && isLive && !isStreaming && user) {
      joinStream()
    }
  }, [isHost, isLive, isStreaming, user])

  const joinStream = async () => {
    if (!user || isStreaming) return
    
    setIsConnecting(true)
    addNotification(`Connecting to ${hostUsername}'s station...`, 'join')
    
    try {
      // Initialize WebRTC
      webrtcRef.current = new StationWebRTC(stationId, user.id, false)
      await webrtcRef.current.init()
      
      // Join the stream
      await webrtcRef.current.joinStream((stream) => {
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = stream
          setIsStreaming(true)
          setIsConnecting(false)
          addNotification(`Connected to ${hostUsername}'s station!`, 'join')
        }
      })
      
      // Setup message listener
      webrtcRef.current.onMessage((data) => {
        setChatMessages(prev => [...prev, {
          id: Date.now().toString(),
          username: data.username,
          message: data.message,
          avatar: '/default-avatar.png',
          timestamp: new Date(data.timestamp)
        }])
        setTotalMessages(prev => prev + 1)
      })
      
      // Setup reaction listener
      webrtcRef.current.onReaction((data) => {
        addReaction(data.emoji)
      })
      
    } catch (error) {
      console.error('Failed to join stream:', error)
      setIsConnecting(false)
      alert('Failed to connect to stream. The host may have ended the broadcast.')
    }
  }

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  useEffect(() => {
    if (isStreaming && streamStartTimeRef.current) {
      const interval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - streamStartTimeRef.current!) / 1000)
        setStreamDuration(elapsed)
      }, 1000)
      return () => clearInterval(interval)
    }
  }, [isStreaming])

  useEffect(() => {
    if (viewerCount > peakViewers) {
      setPeakViewers(viewerCount)
    }
  }, [viewerCount, peakViewers])

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (!isHost || !isStreaming) return
      if (e.key === 'm' || e.key === 'M') toggleMic()
      if (e.key === 'v' || e.key === 'V') toggleVideo()
      if (e.key === 'r' || e.key === 'R') toggleRecording()
      if (e.key === 'e' || e.key === 'E') endStream()
    }
    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [isHost, isStreaming])

  const addNotification = (message: string, type: 'join' | 'leave' | 'reaction') => {
    const id = Date.now().toString()
    setNotifications(prev => [...prev, { id, message, type }])
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id))
    }, 3000)
  }

  const addReaction = (emoji: string) => {
    const id = Date.now().toString()
    const reaction = {
      id,
      emoji,
      x: Math.random() * 80 + 10,
      timestamp: Date.now()
    }
    setReactions(prev => [...prev, reaction])
    setTotalReactions(prev => prev + 1)
    setTimeout(() => {
      setReactions(prev => prev.filter(r => r.id !== id))
    }, 3000)
  }

  const formatDuration = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    if (hrs > 0) return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const startStream = async () => {
    if (!user) return
    
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
      
      // Initialize WebRTC for broadcasting
      webrtcRef.current = new StationWebRTC(stationId, user.id, true)
      await webrtcRef.current.init()
      
      // Start broadcasting
      await webrtcRef.current.startBroadcast(stream, (viewerId) => {
        console.log('New viewer connected:', viewerId)
        setViewerCount(prev => prev + 1)
      })
      
      // Setup message listener
      webrtcRef.current.onMessage((data) => {
        setChatMessages(prev => [...prev, {
          id: Date.now().toString(),
          username: data.username,
          message: data.message,
          avatar: '/default-avatar.png',
          timestamp: new Date(data.timestamp)
        }])
        setTotalMessages(prev => prev + 1)
      })
      
      // Setup reaction listener
      webrtcRef.current.onReaction((data) => {
        addReaction(data.emoji)
      })
      
      // Update server
      const response = await fetch('/api/station', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isLive: true,
          username: user.username || 'DJ',
          title: streamTitle || `${user.username}'s Station`
        })
      })
      
      const data = await response.json()
      if (data.success) {
        setIsLive(true)
        setIsStreaming(true)
        setShowSettings(false)
        streamStartTimeRef.current = Date.now()
        addNotification('Stream started!', 'join')
        setHostUsername(user.username || 'DJ')
      }
    } catch (error: any) {
      console.error('Failed to start stream:', error)
      
      const errorMessage = error.message || 'Unknown error'
      
      // Try audio-only mode if camera fails
      if (errorMessage.includes('not found') || error.name === 'NotFoundError') {
        const tryAudioOnly = confirm('❌ Camera not found.\n\n✅ Want to go live with AUDIO ONLY?\n\nYou can still broadcast music and chat with viewers!')
        
        if (tryAudioOnly) {
          try {
            const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
            localStreamRef.current = audioStream
            
            // Initialize WebRTC for audio-only broadcasting
            webrtcRef.current = new StationWebRTC(stationId, user.id, true)
            await webrtcRef.current.init()
            await webrtcRef.current.startBroadcast(audioStream, (viewerId) => {
              setViewerCount(prev => prev + 1)
            })
            
            webrtcRef.current.onMessage((data) => {
              setChatMessages(prev => [...prev, {
                id: Date.now().toString(),
                username: data.username,
                message: data.message,
                avatar: '/default-avatar.png',
                timestamp: new Date(data.timestamp)
              }])
              setTotalMessages(prev => prev + 1)
            })
            
            webrtcRef.current.onReaction((data) => {
              addReaction(data.emoji)
            })
            
            const response = await fetch('/api/station', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                isLive: true,
                username: user.username || 'DJ',
                title: streamTitle || `${user.username}'s Station (Audio Only)`
              })
            })
            
            const data = await response.json()
            if (data.success) {
              setIsLive(true)
              setIsStreaming(true)
              setIsVideoOn(false)
              streamStartTimeRef.current = Date.now()
              addNotification('🎙️ Audio-only stream started!', 'join')
              setHostUsername(user.username || 'DJ')
            }
            return
          } catch (audioError) {
            alert('❌ Audio-only mode failed. Please check microphone permissions.')
          }
        }
        return
      }
      
      if (errorMessage.includes('Permission denied') || error.name === 'NotAllowedError') {
        alert('❌ Camera/Microphone permission denied.\n\n1. Click the camera icon in your browser address bar\n2. Allow camera and microphone access\n3. Try again')
      } else if (error.name === 'NotReadableError') {
        alert('❌ Camera/microphone already in use.\n\nPlease close other apps (Zoom, Teams, etc.) and try again.')
      } else {
        alert(`❌ Failed to start stream.\n\nError: ${errorMessage}\n\nPlease check your device permissions and try again.`)
      }
    }
  }

  const toggleRecording = () => {
    if (!localStreamRef.current) return
    
    if (isRecording) {
      mediaRecorderRef.current?.stop()
      setIsRecording(false)
      addNotification('Recording stopped', 'reaction')
    } else {
      try {
        const mediaRecorder = new MediaRecorder(localStreamRef.current, {
          mimeType: 'video/webm;codecs=vp9'
        })
        const chunks: Blob[] = []
        
        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunks.push(e.data)
        }
        
        mediaRecorder.onstop = () => {
          const blob = new Blob(chunks, { type: 'video/webm' })
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = `stream-${Date.now()}.webm`
          a.click()
        }
        
        mediaRecorder.start()
        mediaRecorderRef.current = mediaRecorder
        setIsRecording(true)
        addNotification('Recording started', 'reaction')
      } catch (error) {
        console.error('Recording failed:', error)
        alert('Recording not supported in this browser')
      }
    }
  }

  const endStream = async () => {
    try {
      if (isRecording) {
        mediaRecorderRef.current?.stop()
        setIsRecording(false)
      }
      
      // Disconnect WebRTC
      webrtcRef.current?.disconnect()
      webrtcRef.current = null
      
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop())
        localStreamRef.current = null
      }
      
      if (videoRef.current) {
        videoRef.current.srcObject = null
      }
      
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = null
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
        streamStartTimeRef.current = null
        setStreamDuration(0)
        addNotification('Stream ended', 'leave')
        
        // If viewer, redirect back
        if (!isHost) {
          router.push('/explore')
        }
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
    if (!chatInput.trim() || !user || !webrtcRef.current) return
    
    const username = user.username || 'Anonymous'
    const message = chatInput
    
    // Send via WebRTC
    webrtcRef.current.sendMessage(message, username)
    
    // Add to local state
    setChatMessages(prev => [...prev, {
      id: Date.now().toString(),
      user_id: user.id,
      username,
      avatar: user.imageUrl || '/default-avatar.png',
      message,
      timestamp: new Date()
    }])
    setTotalMessages(prev => prev + 1)
    setChatInput('')
  }
  
  const sendReaction = (emoji: string) => {
    if (!webrtcRef.current) return
    webrtcRef.current.sendReaction(emoji)
    addReaction(emoji)
  }

  const reactionEmojis = ['❤️', '🔥', '👏', '🎵', '🎉', '💯']

  const testDevices = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      const cameras = devices.filter(d => d.kind === 'videoinput')
      const microphones = devices.filter(d => d.kind === 'audioinput')
      
      setDeviceCheckResult({ cameras, microphones })
      setShowDeviceCheck(true)
    } catch (error: any) {
      setDeviceCheckResult({ 
        cameras: [], 
        microphones: [], 
        error: error.message || 'Failed to check devices' 
      })
      setShowDeviceCheck(true)
    }
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
                {streamTitle || `${hostUsername}'s Station`}
              </h1>
              <p className="text-sm text-gray-400">
                {isLive ? (
                  <span className="flex items-center gap-2">
                    <Circle size={8} className="fill-red-500 text-red-500 animate-pulse" />
                    LIVE • {viewerCount} listeners
                  </span>
                ) : isConnecting ? (
                  <span className="flex items-center gap-2">
                    <Wifi size={12} className="animate-pulse" />
                    Connecting...
                  </span>
                ) : (
                  'Offline'
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={testDevices}
              className="px-4 py-2 bg-white/10 border border-white/20 rounded-lg hover:bg-white/20 transition-all flex items-center gap-2"
              title="Check Camera & Microphone"
            >
              <Camera size={16} />
              Test Devices
            </button>
            <button
              onClick={() => setShowShortcuts(true)}
              className="w-10 h-10 bg-white/10 border border-white/20 rounded-lg hover:bg-white/20 transition-all flex items-center justify-center"
              title="Keyboard Shortcuts"
            >
              ?
            </button>
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
            {isHost && isLive && (
              <div className="hidden md:flex items-center gap-2 text-xs text-gray-400">
                <span className="px-2 py-1 bg-white/5 rounded">M</span> Mic
                <span className="px-2 py-1 bg-white/5 rounded">V</span> Video
                <span className="px-2 py-1 bg-white/5 rounded">R</span> Record
                <span className="px-2 py-1 bg-white/5 rounded">E</span> End
              </div>
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
                  {/* Host sees their own video or audio-only UI */}
                  {isHost && (
                    isVideoOn ? (
                      <video
                        ref={videoRef}
                        autoPlay
                        muted
                        playsInline
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-gray-900 to-black">
                        <div className="w-32 h-32 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 flex items-center justify-center mb-6 animate-pulse shadow-2xl shadow-cyan-500/50">
                          <Mic size={64} className="text-black" />
                        </div>
                        <h3 className="text-3xl font-bold mb-2 bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">🎙️ Audio Only</h3>
                        <p className="text-gray-400 text-lg">Camera is off</p>
                        <p className="text-sm text-gray-500 mt-4">Your audio is broadcasting to {viewerCount} listener{viewerCount !== 1 ? 's' : ''}</p>
                      </div>
                    )
                  )}
                  
                  {/* Viewers see remote video */}
                  {!isHost && (
                    <video
                      ref={remoteVideoRef}
                      autoPlay
                      playsInline
                      className="w-full h-full object-cover"
                    />
                  )}
                  
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

                  <div className="absolute inset-0 pointer-events-none">
                    {reactions.map((reaction) => (
                      <div
                        key={reaction.id}
                        className="absolute bottom-0 animate-float-up text-4xl pointer-events-none"
                        style={{
                          left: `${reaction.x}%`,
                          animation: 'float-up 3s ease-out forwards'
                        }}
                      >
                        {reaction.emoji}
                      </div>
                    ))}
                  </div>

                  <div className="absolute top-4 right-4 space-y-2">
                    {notifications.map((notif) => (
                      <div
                        key={notif.id}
                        className={`px-3 py-2 rounded-lg backdrop-blur-sm text-sm animate-slide-in ${
                          notif.type === 'join' ? 'bg-green-500/80' :
                          notif.type === 'leave' ? 'bg-red-500/80' :
                          'bg-cyan-500/80'
                        }`}
                      >
                        {notif.message}
                      </div>
                    ))}
                  </div>

                  {isHost && (
                    <>
                      <div className="absolute top-20 right-4 flex flex-col gap-2">
                        <button
                          onClick={() => setShowAnalytics(!showAnalytics)}
                          className="w-10 h-10 rounded-full bg-black/60 backdrop-blur flex items-center justify-center hover:bg-black/80 transition-all"
                          title="Analytics"
                        >
                          📊
                        </button>
                        <button
                          onClick={toggleRecording}
                          className={`w-10 h-10 rounded-full backdrop-blur flex items-center justify-center transition-all ${
                            isRecording ? 'bg-red-500 animate-pulse' : 'bg-black/60 hover:bg-black/80'
                          }`}
                          title={isRecording ? 'Stop Recording (R)' : 'Start Recording (R)'}
                        >
                          <Circle size={isRecording ? 16 : 20} className={isRecording ? 'fill-current' : ''} />
                        </button>
                      </div>
                      
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-6">
                        <div className="flex items-center justify-center gap-4">
                          <button
                            onClick={toggleMic}
                            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                              isMicOn ? 'bg-white/20 hover:bg-white/30' : 'bg-red-500 hover:bg-red-600'
                            }`}
                            title={isMicOn ? 'Mute (M)' : 'Unmute (M)'}
                          >
                            {isMicOn ? <Mic size={20} /> : <MicOff size={20} />}
                          </button>
                          
                          <button
                            onClick={toggleVideo}
                            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                              isVideoOn ? 'bg-white/20 hover:bg-white/30' : 'bg-red-500 hover:bg-red-600'
                            }`}
                            title={isVideoOn ? 'Hide Camera (V)' : 'Show Camera (V)'}
                          >
                            {isVideoOn ? <VideoIcon size={20} /> : <VideoOff size={20} />}
                          </button>

                          <button
                            onClick={endStream}
                            className="w-14 h-14 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-all shadow-lg"
                            title="End Stream (E)"
                          >
                            <PhoneOff size={24} />
                          </button>
                        </div>
                        
                        <div className="flex items-center justify-center gap-4 mt-4 text-xs text-gray-400">
                          <span>⏱️ {formatDuration(streamDuration)}</span>
                          <span>•</span>
                          <span>{formatBandwidth(bandwidth)}</span>
                          <span>•</span>
                          <span>{STREAM_QUALITIES[streamQuality].label}</span>
                          <span>•</span>
                          <span className={`${
                            connectionQuality === 'excellent' ? 'text-green-400' :
                            connectionQuality === 'good' ? 'text-yellow-400' :
                            connectionQuality === 'poor' ? 'text-orange-400' :
                            'text-red-400'
                          }`}>
                            {connectionQuality}
                          </span>
                        </div>
                      </div>
                    </>
                  )}
                  
                  {!isHost && isStreaming && (
                    <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2 px-4">
                      {reactionEmojis.map((emoji) => (
                        <button
                          key={emoji}
                          onClick={() => sendReaction(emoji)}
                          className="w-12 h-12 rounded-full bg-black/60 backdrop-blur hover:bg-black/80 hover:scale-110 transition-all text-2xl flex items-center justify-center"
                        >
                          {emoji}
                        </button>
                      ))}
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

          <div className="space-y-4">
            <div className="bg-gradient-to-br from-gray-900 to-black border border-white/10 rounded-2xl p-4">
              <h3 className="font-bold flex items-center gap-2 mb-3">
                <Users size={20} className="text-cyan-400" />
                Viewers ({viewerCount})
              </h3>
              <div className="flex flex-wrap gap-2">
                {viewers.length === 0 ? (
                  <p className="text-sm text-gray-500">No viewers yet</p>
                ) : (
                  viewers.map((viewer) => (
                    <div key={viewer.id} className="flex items-center gap-2 bg-white/5 px-3 py-1 rounded-full text-sm">
                      <Image
                        src={viewer.avatar}
                        alt={viewer.username}
                        width={24}
                        height={24}
                        className="rounded-full"
                      />
                      <span>{viewer.username}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="bg-gradient-to-br from-gray-900/50 to-black/50 border border-cyan-500/20 rounded-2xl h-[calc(100vh-450px)] flex flex-col backdrop-blur-xl shadow-2xl shadow-cyan-500/10">
              <div className="p-4 border-b border-cyan-500/20 bg-gradient-to-r from-cyan-500/10 to-blue-500/10">
                <h3 className="font-bold flex items-center gap-2">
                  <MessageCircle size={20} className="text-cyan-400" />
                  Live Chat <span className="text-cyan-400">({totalMessages})</span>
                </h3>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3 scroll-smooth">
                {chatMessages.length === 0 ? (
                  <div className="text-center text-gray-500 py-12">
                    <MessageCircle size={48} className="mx-auto mb-4 opacity-50" />
                    <p className="text-sm">Be the first to chat!</p>
                  </div>
                ) : (
                  chatMessages.map((msg) => (
                    <div key={msg.id} className="flex gap-3 animate-fade-in-up bg-white/5 hover:bg-white/10 p-3 rounded-xl transition-all duration-300">
                      <Image
                        src={msg.avatar}
                        alt={msg.username}
                        width={32}
                        height={32}
                        className="rounded-full flex-shrink-0 ring-2 ring-cyan-500/30"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-bold text-sm bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">{msg.username}</span>
                          <span className="text-xs text-gray-500">
                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-sm text-gray-200 break-words">{msg.message}</p>
                      </div>
                    </div>
                  ))
                )}
                <div ref={chatEndRef} />
              </div>

              <div className="p-4 border-t border-cyan-500/20 bg-gradient-to-r from-cyan-500/5 to-blue-500/5">
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                    placeholder="Say something..."
                    className="flex-1 px-4 py-3 bg-white/10 border border-cyan-500/30 rounded-xl focus:outline-none focus:border-cyan-500 focus:bg-white/15 text-sm placeholder-gray-500 transition-all"
                    maxLength={200}
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!chatInput.trim()}
                    className="w-12 h-12 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-lg shadow-cyan-500/30 disabled:shadow-none"
                  >
                    <Send size={18} className="text-black" />
                  </button>
                </div>
                <p className="text-xs text-gray-500 flex items-center justify-between px-1">
                  <span>{chatInput.length}/200 characters</span>
                  <span className="text-cyan-400">Press Enter to send</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showAnalytics && isHost && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowAnalytics(false)}>
          <div className="bg-gradient-to-br from-gray-900 to-black border border-cyan-500/30 rounded-2xl p-8 max-w-4xl w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-cyan-400 flex items-center gap-2">
                📊 Stream Analytics
              </h3>
              <button
                onClick={() => setShowAnalytics(false)}
                className="text-gray-400 hover:text-white transition-colors text-2xl"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-gradient-to-br from-cyan-900/20 to-black border border-cyan-500/20 rounded-xl p-4">
                <p className="text-xs text-gray-400 mb-1">Current Viewers</p>
                <p className="text-3xl font-bold text-cyan-400">{viewerCount}</p>
              </div>
              <div className="bg-gradient-to-br from-blue-900/20 to-black border border-blue-500/20 rounded-xl p-4">
                <p className="text-xs text-gray-400 mb-1">Peak Viewers</p>
                <p className="text-3xl font-bold text-blue-400">{peakViewers}</p>
              </div>
              <div className="bg-gradient-to-br from-purple-900/20 to-black border border-purple-500/20 rounded-xl p-4">
                <p className="text-xs text-gray-400 mb-1">Messages</p>
                <p className="text-3xl font-bold text-purple-400">{totalMessages}</p>
              </div>
              <div className="bg-gradient-to-br from-pink-900/20 to-black border border-pink-500/20 rounded-xl p-4">
                <p className="text-xs text-gray-400 mb-1">Reactions</p>
                <p className="text-3xl font-bold text-pink-400">{totalReactions}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white/5 rounded-xl p-4">
                <p className="text-sm text-gray-400 mb-2">Stream Duration</p>
                <p className="text-xl font-bold text-white">{formatDuration(streamDuration)}</p>
              </div>
              <div className="bg-white/5 rounded-xl p-4">
                <p className="text-sm text-gray-400 mb-2">Connection Quality</p>
                <p className={`text-xl font-bold ${
                  connectionQuality === 'excellent' ? 'text-green-400' :
                  connectionQuality === 'good' ? 'text-yellow-400' :
                  connectionQuality === 'poor' ? 'text-orange-400' :
                  'text-red-400'
                }`}>
                  {connectionQuality.toUpperCase()}
                </p>
              </div>
              <div className="bg-white/5 rounded-xl p-4">
                <p className="text-sm text-gray-400 mb-2">Stream Quality</p>
                <p className="text-xl font-bold text-white">{STREAM_QUALITIES[streamQuality].label}</p>
              </div>
            </div>

            <div className="mt-6 text-center">
              <p className="text-sm text-gray-500">
                Recording: {isRecording ? 
                  <span className="text-red-400 font-bold">● ACTIVE</span> : 
                  <span className="text-gray-400">Inactive</span>
                }
              </p>
            </div>
          </div>
        </div>
      )}

      {showShortcuts && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowShortcuts(false)}>
          <div className="bg-gradient-to-br from-gray-900 to-black border border-cyan-500/30 rounded-2xl p-8 max-w-lg w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-cyan-400 flex items-center gap-2">
                ⌨️ Keyboard Shortcuts
              </h3>
              <button
                onClick={() => setShowShortcuts(false)}
                className="text-gray-400 hover:text-white transition-colors text-2xl"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-gray-400 text-sm mb-4">Use these shortcuts while hosting a live stream:</p>
              
              <div className="grid gap-2">
                <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                  <span className="text-gray-300">Toggle Microphone</span>
                  <kbd className="px-3 py-1 bg-cyan-500/20 border border-cyan-500/30 rounded text-cyan-400 font-mono text-sm">M</kbd>
                </div>
                
                <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                  <span className="text-gray-300">Toggle Camera</span>
                  <kbd className="px-3 py-1 bg-cyan-500/20 border border-cyan-500/30 rounded text-cyan-400 font-mono text-sm">V</kbd>
                </div>
                
                <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                  <span className="text-gray-300">Toggle Recording</span>
                  <kbd className="px-3 py-1 bg-cyan-500/20 border border-cyan-500/30 rounded text-cyan-400 font-mono text-sm">R</kbd>
                </div>
                
                <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                  <span className="text-gray-300">End Stream</span>
                  <kbd className="px-3 py-1 bg-red-500/20 border border-red-500/30 rounded text-red-400 font-mono text-sm">E</kbd>
                </div>
              </div>

              <div className="mt-6 p-4 bg-cyan-500/10 border border-cyan-500/20 rounded-lg">
                <p className="text-xs text-cyan-400">💡 Tip: These shortcuts only work when you're the host and streaming is active.</p>
              </div>
            </div>

            <button
              onClick={() => setShowShortcuts(false)}
              className="w-full mt-6 px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-black rounded-lg hover:from-cyan-400 hover:to-blue-400 transition-all font-bold"
            >
              Got it!
            </button>
          </div>
        </div>
      )}

      {showShortcuts && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowShortcuts(false)}>
          <div className="bg-gradient-to-br from-gray-900 to-black border border-cyan-500/30 rounded-2xl p-8 max-w-lg w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-cyan-400 flex items-center gap-2">
                ⌨️ Keyboard Shortcuts
              </h3>
              <button
                onClick={() => setShowShortcuts(false)}
                className="text-gray-400 hover:text-white transition-colors text-2xl"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-gray-400 text-sm mb-4">Use these shortcuts while hosting a live stream:</p>
              
              <div className="grid gap-2">
                <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                  <span className="text-gray-300">Toggle Microphone</span>
                  <kbd className="px-3 py-1 bg-cyan-500/20 border border-cyan-500/30 rounded text-cyan-400 font-mono text-sm">M</kbd>
                </div>
                
                <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                  <span className="text-gray-300">Toggle Camera</span>
                  <kbd className="px-3 py-1 bg-cyan-500/20 border border-cyan-500/30 rounded text-cyan-400 font-mono text-sm">V</kbd>
                </div>
                
                <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                  <span className="text-gray-300">Toggle Recording</span>
                  <kbd className="px-3 py-1 bg-cyan-500/20 border border-cyan-500/30 rounded text-cyan-400 font-mono text-sm">R</kbd>
                </div>
                
                <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                  <span className="text-gray-300">End Stream</span>
                  <kbd className="px-3 py-1 bg-red-500/20 border border-red-500/30 rounded text-red-400 font-mono text-sm">E</kbd>
                </div>
              </div>

              <div className="mt-6 p-4 bg-cyan-500/10 border border-cyan-500/20 rounded-lg">
                <p className="text-xs text-cyan-400">💡 Tip: These shortcuts only work when you're the host and streaming is active.</p>
              </div>
            </div>

            <button
              onClick={() => setShowShortcuts(false)}
              className="w-full mt-6 px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-black rounded-lg hover:from-cyan-400 hover:to-blue-400 transition-all font-bold"
            >
              Got it!
            </button>
          </div>
        </div>
      )}

      {/* Device Check Modal */}
      {showDeviceCheck && deviceCheckResult && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowDeviceCheck(false)}>
          <div className="bg-gradient-to-br from-gray-900 to-black border border-cyan-500/30 rounded-2xl p-8 max-w-2xl w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-cyan-400">📹 Device Check Results</h3>
              <button
                onClick={() => setShowDeviceCheck(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>

            {deviceCheckResult.error ? (
              <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                <p className="text-red-400">❌ {deviceCheckResult.error}</p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                  <h4 className="text-sm font-bold mb-3 text-gray-300 flex items-center gap-2">
                    <Camera size={16} className="text-cyan-400" />
                    Cameras Detected: {deviceCheckResult.cameras.length}
                  </h4>
                  {deviceCheckResult.cameras.length === 0 ? (
                    <p className="text-sm text-red-400">❌ No cameras found. Please connect a USB webcam or use a device with built-in camera.</p>
                  ) : (
                    <ul className="space-y-2">
                      {deviceCheckResult.cameras.map((cam, idx) => (
                        <li key={idx} className="text-sm text-green-400">✅ {cam.label || `Camera ${idx + 1}`}</li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                  <h4 className="text-sm font-bold mb-3 text-gray-300 flex items-center gap-2">
                    <Mic size={16} className="text-cyan-400" />
                    Microphones Detected: {deviceCheckResult.microphones.length}
                  </h4>
                  {deviceCheckResult.microphones.length === 0 ? (
                    <p className="text-sm text-red-400">❌ No microphones found. Please connect a USB microphone or headset.</p>
                  ) : (
                    <ul className="space-y-2">
                      {deviceCheckResult.microphones.map((mic, idx) => (
                        <li key={idx} className="text-sm text-green-400">✅ {mic.label || `Microphone ${idx + 1}`}</li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="p-4 bg-cyan-500/10 border border-cyan-500/20 rounded-lg">
                  <p className="text-xs text-cyan-400">
                    💡 <strong>Tip:</strong> If devices show as "Camera 1" or "Microphone 1" without names, you need to grant browser permissions first. Click "Go Live" and allow access when prompted.
                  </p>
                </div>

                {deviceCheckResult.cameras.length === 0 && deviceCheckResult.microphones.length === 0 && (
                  <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                    <p className="text-sm text-yellow-400 mb-3">⚠️ <strong>Cannot stream without devices!</strong></p>
                    <p className="text-xs text-gray-400">To stream on 444Radio, you need:</p>
                    <ul className="text-xs text-gray-400 mt-2 space-y-1 ml-4">
                      <li>• USB webcam OR built-in laptop camera</li>
                      <li>• USB microphone OR headset with mic</li>
                      <li>• OR phone with camera/mic (use mobile browser)</li>
                    </ul>
                  </div>
                )}
              </div>
            )}

            <button
              onClick={() => setShowDeviceCheck(false)}
              className="w-full mt-6 px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-black rounded-lg hover:from-cyan-400 hover:to-blue-400 transition-all font-bold"
            >
              Close
            </button>
          </div>
        </div>
      )}

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

            <div className="mt-6 p-4 bg-white/5 rounded-lg border border-white/10">
              <h4 className="text-sm font-bold mb-2 text-gray-300">⚙️ Troubleshooting</h4>
              <button
                onClick={async () => {
                  try {
                    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
                    const videoTracks = stream.getVideoTracks()
                    const audioTracks = stream.getAudioTracks()
                    
                    alert(`✅ Permissions OK!\n\n📹 Video: ${videoTracks.length > 0 ? videoTracks[0].label : 'None'}\n🎤 Audio: ${audioTracks.length > 0 ? audioTracks[0].label : 'None'}`)
                    
                    stream.getTracks().forEach(track => track.stop())
                  } catch (error: any) {
                    alert(`❌ Permission test failed!\n\n${error.message}\n\nPlease check:\n1. Browser permissions\n2. Camera/mic are connected\n3. No other app is using them`)
                  }
                }}
                className="w-full px-4 py-2 bg-white/10 text-sm rounded-lg hover:bg-white/20 transition-all"
              >
                🔍 Test Camera & Microphone
              </button>
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
      
      <style jsx>{`
        @keyframes float-up {
          0% {
            opacity: 1;
            transform: translateY(0);
          }
          100% {
            opacity: 0;
            transform: translateY(-200px);
          }
        }
        
        @keyframes slide-in {
          0% {
            opacity: 0;
            transform: translateX(20px);
          }
          100% {
            opacity: 1;
            transform: translateX(0);
          }
        }
        
        .animate-float-up {
          animation: float-up 3s ease-out forwards;
        }
        
        .animate-slide-in {
          animation: slide-in 0.3s ease-out;
        }
      `}</style>
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
