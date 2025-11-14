'use client'

import { useEffect, useState } from 'react'
import { useAudioPlayer } from '@/app/contexts/AudioPlayerContext'

export default function PlayerTestPage() {
  const { playTrack, currentTrack, isPlaying } = useAudioPlayer()
  const [testResults, setTestResults] = useState<string[]>([])

  const addLog = (msg: string) => {
    setTestResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${msg}`])
  }

  const testSimpleTrack = () => {
    addLog('Testing simple track (no imageUrl)...')
    playTrack({
      id: 'test-1',
      audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
      title: 'Test Song 1',
      artist: 'Test Artist'
    })
  }

  const testTrackWithImage = () => {
    addLog('Testing track with imageUrl...')
    playTrack({
      id: 'test-2',
      audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
      title: 'Test Song 2',
      artist: 'Test Artist',
      imageUrl: 'https://via.placeholder.com/300'
    })
  }

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <h1 className="text-3xl font-bold mb-6">Audio Player Test</h1>
      
      <div className="space-y-4 mb-8">
        <button
          onClick={testSimpleTrack}
          className="px-6 py-3 bg-cyan-600 rounded-lg hover:bg-cyan-700"
        >
          Test Simple Track (No Image)
        </button>
        
        <button
          onClick={testTrackWithImage}
          className="px-6 py-3 bg-purple-600 rounded-lg hover:bg-purple-700"
        >
          Test Track With Image
        </button>
      </div>

      <div className="bg-gray-900 p-4 rounded-lg mb-4">
        <h2 className="text-xl font-bold mb-2">Current State:</h2>
        <p>Playing: {isPlaying ? 'Yes' : 'No'}</p>
        <p>Track: {currentTrack?.title || 'None'}</p>
        <p>Audio URL: {currentTrack?.audioUrl || 'None'}</p>
        <p>Has Image: {currentTrack?.imageUrl ? 'Yes' : 'No'}</p>
      </div>

      <div className="bg-gray-900 p-4 rounded-lg">
        <h2 className="text-xl font-bold mb-2">Test Log:</h2>
        <div className="space-y-1 font-mono text-sm">
          {testResults.map((log, i) => (
            <div key={i}>{log}</div>
          ))}
        </div>
      </div>
    </div>
  )
}
