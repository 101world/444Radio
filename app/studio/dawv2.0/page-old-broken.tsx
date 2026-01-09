'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useUser } from '@clerk/nextjs';
import { MultiTrackDAW } from '@/lib/audio/MultiTrackDAW';
import type { Track, TrackClip } from '@/lib/audio/TrackManager';
import { Play, Pause, Square, Plus, Save, FolderOpen, Grid3x3, Repeat, Volume2, Sliders, Search, Music, SkipBack, SkipForward, Mic } from 'lucide-react';

export default function DAWPro() {
  const { user } = useUser();
  const [daw, setDaw] = useState<MultiTrackDAW | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playhead, setPlayhead] = useState(0);
  const [bpm, setBpm] = useState(120);
  const [zoom, setZoom] = useState(40); // pixels per second - Ableton default
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [showBrowser, setShowBrowser] = useState(true);
  const [showMixer, setShowMixer] = useState(false);
  const [library, setLibrary] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [loopEnabled, setLoopEnabled] = useState(false);
  const [loopStart, setLoopStart] = useState(0);
  const [loopEnd, setLoopEnd] = useState(32);
  const [searchTerm, setSearchTerm] = useState('');
  const [metronomeEnabled, setMetronomeEnabled] = useState(false);
  const [metronomeFlash, setMetronomeFlash] = useState(false);
  const [metronomeInterval, setMetronomeInterval] = useState<NodeJS.Timeout | null>(null);
  const [recordingTrackId, setRecordingTrackId] = useState<string | null>(null);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [generatingTrack, setGeneratingTrack] = useState(false);
  const [projectName, setProjectName] = useState('Untitled Project');
  const [saving, setSaving] = useState(false);
  
  const timelineRef = useRef<HTMLDivElement>(null);
  const canvasRefs = useRef<Map<string, HTMLCanvasElement>>(new Map());
  
  // Ableton-style constants
  const TRACK_HEIGHT = 100;
  const TRACK_HEADER_WIDTH = 200;
  const TIMELINE_HEIGHT = 40;
  const TRANSPORT_HEIGHT = 60;
  const GRID_SUBDIVISION = 4; // 16th notes
  const timelineWidth = 400 * zoom; // 400 seconds visible

  // Initialize DAW
  useEffect(() => {
    if (!user) return;

    const initDAW = async () => {
      try {
        const dawInstance = new MultiTrackDAW({ userId: user.id });
        
        // Add 8 default tracks (Ableton starts with more)
        for (let i = 0; i < 8; i++) {
          dawInstance.createTrack(`${i + 1} Audio`);
        }

        setDaw(dawInstance);
        setTracks(dawInstance.getTracks());
        setLoading(false);

        // Playhead animation
        const animate = () => {
          if (dawInstance) {
            const state = dawInstance.getTransportState();
            if (state.isPlaying) {
              let currentTime = state.currentTime;
              
              // Loop handling
              if (loopEnabled && currentTime >= loopEnd) {
                dawInstance.seekTo(loopStart);
                currentTime = loopStart;
              }
              
              setPlayhead(currentTime);
              setIsPlaying(true);
            } else {
              setIsPlaying(false);
            }
          }
          requestAnimationFrame(animate);
        };
        animate();
      } catch (error) {
        console.error('DAW init failed:', error);
        setLoading(false);
      }
    };

    initDAW();
  }, [user, loopEnabled, loopStart, loopEnd]);

  // Load library
  useEffect(() => {
    if (user && !loading) {
      loadLibrary();
    }
  }, [user, loading]);

  const loadLibrary = async () => {
    try {
      const response = await fetch('/api/media');
      if (response.ok) {
        const data = await response.json();
        setLibrary(data.filter((item: any) => item.type === 'audio'));
      }
    } catch (error) {
      console.error('Library load failed:', error);
    }
  };

  // Transport controls
  const handlePlay = useCallback(() => {
    if (!daw) return;
    try {
      daw.play();
      setIsPlaying(true);
      
      if (metronomeEnabled) {
        const interval = setInterval(() => {
          setMetronomeFlash(true);
          setTimeout(() => setMetronomeFlash(false), 50);
        }, (60 / bpm) * 1000);
        setMetronomeInterval(interval);
      }
    } catch (error) {
      console.error('Play error:', error);
    }
  }, [daw, metronomeEnabled, bpm]);

  const handlePause = useCallback(() => {
    if (!daw) return;
    daw.pause();
    setIsPlaying(false);
    if (metronomeInterval) {
      clearInterval(metronomeInterval);
      setMetronomeInterval(null);
    }
  }, [daw, metronomeInterval]);

  const handleStop = useCallback(() => {
    if (!daw) return;
    daw.stop();
    setPlayhead(0);
    setIsPlaying(false);
    if (metronomeInterval) {
      clearInterval(metronomeInterval);
      setMetronomeInterval(null);
    }
  }, [daw, metronomeInterval]);

  const handleAddClip = useCallback(async (audioUrl: string, trackId: string, startTime: number = 0) => {
    if (!daw) return;
    try {
      const proxyUrl = `/api/r2/audio-proxy?url=${encodeURIComponent(audioUrl)}`;
      const response = await fetch(proxyUrl);
      if (!response.ok) throw new Error('Fetch failed');
      
      const arrayBuffer = await response.arrayBuffer();
      const audioContext = new AudioContext();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      const clip: TrackClip = {
        id: `clip-${Date.now()}`,
        trackId,
        startTime: snapEnabled ? Math.round(startTime * GRID_SUBDIVISION) / GRID_SUBDIVISION : startTime,
        duration: audioBuffer.duration,
        offset: 0,
        gain: 1,
        fadeIn: { duration: 0.01, curve: 'exponential' },
        fadeOut: { duration: 0.01, curve: 'exponential' },
        buffer: audioBuffer,
        locked: false
      };
      
      daw.addClipToTrack(trackId, clip);
      setTracks(daw.getTracks());
    } catch (error) {
      console.error('Clip add failed:', error);
    }
  }, [daw, snapEnabled]);

  const handleSave = async () => {
    if (!daw || saving) return;
    setSaving(true);
    try {
      const projectData = {
        name: projectName,
        data: {
          tracks: daw.getTracks(),
          bpm,
          loopStart,
          loopEnd,
          loopEnabled
        }
      };
      
      const response = await fetch('/api/studio/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(projectData)
      });
      
      if (response.ok) {
        alert('Project saved!');
      } else {
        const error = await response.json();
        alert(`Save failed: ${error.error}`);
      }
    } catch (error) {
      console.error('Save error:', error);
      alert('Save failed');
    } finally {
      setSaving(false);
    }
  };

  const renderWaveform = (canvas: HTMLCanvasElement, buffer: AudioBuffer) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const data = buffer.getChannelData(0);
    const step = Math.ceil(data.length / width);
    const amp = height / 2;

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, width, height);
    
    ctx.strokeStyle = '#06b6d4';
    ctx.lineWidth = 1;
    ctx.beginPath();
    
    for (let i = 0; i < width; i++) {
      const min = Math.min(...Array.from({ length: step }, (_, j) => data[i * step + j] || 0));
      const max = Math.max(...Array.from({ length: step }, (_, j) => data[i * step + j] || 0));
      ctx.moveTo(i, (1 + min) * amp);
      ctx.lineTo(i, (1 + max) * amp);
    }
    
    ctx.stroke();
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      
      if (e.code === 'Space') {
        e.preventDefault();
        isPlaying ? handlePause() : handlePlay();
      } else if (e.key === 's' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleSave();
      }
    };
    
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isPlaying, handlePlay, handlePause, handleSave]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-cyan-400 text-xl">Initializing Studio...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col overflow-hidden">
      {/* Top Bar */}
      <div className="h-12 bg-[#111] border-b border-gray-800 flex items-center justify-between px-4">
        <div className="flex items-center gap-4">
          <div className="text-cyan-400 font-bold text-lg">444 Studio</div>
          <input
            type="text"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            className="bg-transparent border-none text-sm text-gray-400 focus:text-white outline-none"
          />
        </div>
        
        <div className="flex items-center gap-2">
          <div className="text-xs text-gray-500">BPM</div>
          <input
            type="number"
            value={bpm}
            onChange={(e) => setBpm(Number(e.target.value))}
            className="w-16 bg-[#1a1a1a] border border-gray-700 rounded px-2 py-1 text-sm text-center focus:border-cyan-500 focus:outline-none"
            min="60"
            max="200"
          />
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-1.5 bg-cyan-500 hover:bg-cyan-600 text-black rounded text-sm font-medium transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button
            onClick={() => setShowGenerateModal(true)}
            className="px-4 py-1.5 bg-purple-500 hover:bg-purple-600 text-white rounded text-sm font-medium transition-colors"
          >
            Generate AI
          </button>
        </div>
      </div>

      {/* Transport Bar */}
      <div className="h-16 bg-[#0d0d0d] border-b border-gray-800 flex items-center justify-between px-6">
        <div className="flex items-center gap-2">
          <button
            onClick={handleStop}
            className="w-8 h-8 flex items-center justify-center hover:bg-gray-800 rounded transition-colors"
            title="Stop"
          >
            <Square size={16} />
          </button>
          <button
            onClick={isPlaying ? handlePause : handlePlay}
            className={`w-10 h-10 flex items-center justify-center rounded transition-all ${
              isPlaying ? 'bg-cyan-500 text-black' : 'bg-gray-800 hover:bg-gray-700'
            }`}
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <Pause size={20} /> : <Play size={20} />}
          </button>
          <button
            onClick={() => setRecordingTrackId(selectedTrackId)}
            className={`w-8 h-8 flex items-center justify-center rounded transition-colors ${
              recordingTrackId ? 'bg-red-500 text-white' : 'hover:bg-gray-800'
            }`}
            title="Record"
          >
            <div className="w-4 h-4 rounded-full bg-current" />
          </button>
        </div>

        <div className="flex-1 flex items-center justify-center gap-4">
          <div className="text-2xl font-mono tabular-nums text-cyan-400">
            {Math.floor(playhead / 60)}:{String(Math.floor(playhead % 60)).padStart(2, '0')}.{String(Math.floor((playhead % 1) * 100)).padStart(2, '0')}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setLoopEnabled(!loopEnabled)}
            className={`px-3 py-1.5 rounded text-sm transition-colors ${
              loopEnabled ? 'bg-orange-500 text-white' : 'bg-gray-800 hover:bg-gray-700'
            }`}
          >
            <Repeat size={14} className="inline mr-1" />
            Loop
          </button>
          <button
            onClick={() => setMetronomeEnabled(!metronomeEnabled)}
            className={`px-3 py-1.5 rounded text-sm transition-all ${
              metronomeEnabled
                ? (metronomeFlash ? 'bg-cyan-400 text-black scale-110' : 'bg-cyan-500 text-black')
                : 'bg-gray-800 hover:bg-gray-700'
            }`}
          >
            {metronomeFlash ? '●' : 'Click'}
          </button>
          <button
            onClick={() => setSnapEnabled(!snapEnabled)}
            className={`px-3 py-1.5 rounded text-sm transition-colors ${
              snapEnabled ? 'bg-cyan-500 text-black' : 'bg-gray-800 hover:bg-gray-700'
            }`}
          >
            <Grid3x3 size={14} className="inline mr-1" />
            Snap
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Browser Panel */}
        {showBrowser && (
          <div className="w-64 bg-[#0d0d0d] border-r border-gray-800 flex flex-col">
            <div className="h-10 border-b border-gray-800 flex items-center px-4">
              <div className="text-sm font-medium text-gray-400">Browser</div>
            </div>
            <div className="p-3">
              <input
                type="text"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-[#1a1a1a] border border-gray-700 rounded px-3 py-1.5 text-sm focus:border-cyan-500 focus:outline-none"
              />
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {library.filter(item => item.title.toLowerCase().includes(searchTerm.toLowerCase())).map(item => (
                <div
                  key={item.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('audioUrl', item.audio_url);
                    e.dataTransfer.setData('title', item.title);
                  }}
                  className="p-2 mb-1 bg-[#1a1a1a] hover:bg-[#252525] rounded cursor-move transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Music size={12} className="text-cyan-400" />
                    <div className="text-xs text-white truncate">{item.title}</div>
                  </div>
                  {item.genre && <div className="text-[10px] text-gray-500 mt-0.5">{item.genre}</div>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Timeline Area */}
        <div className="flex-1 flex flex-col overflow-hidden bg-[#0a0a0a]">
          {/* Track Headers + Timeline */}
          <div className="flex-1 flex overflow-auto">
            {/* Track Headers */}
            <div className="flex-shrink-0 bg-[#111] border-r border-gray-800" style={{ width: `${TRACK_HEADER_WIDTH}px` }}>
              {tracks.map((track, idx) => (
                <div
                  key={track.id}
                  style={{ height: `${TRACK_HEIGHT}px` }}
                  className={`border-b border-gray-800 p-3 cursor-pointer transition-colors ${
                    selectedTrackId === track.id ? 'bg-[#1a1a1a]' : 'hover:bg-[#151515]'
                  }`}
                  onClick={() => setSelectedTrackId(track.id)}
                >
                  <div className="text-sm font-medium text-cyan-400 mb-2">{track.name}</div>
                  <div className="flex gap-1 mb-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        daw?.updateTrack(track.id, { muted: !track.muted });
                        setTracks(daw?.getTracks() || []);
                      }}
                      className={`px-2 py-0.5 text-xs rounded ${
                        track.muted ? 'bg-red-500 text-white' : 'bg-gray-800 text-gray-400'
                      }`}
                    >
                      M
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        daw?.updateTrack(track.id, { solo: !track.solo });
                        setTracks(daw?.getTracks() || []);
                      }}
                      className={`px-2 py-0.5 text-xs rounded ${
                        track.solo ? 'bg-yellow-500 text-black' : 'bg-gray-800 text-gray-400'
                      }`}
                    >
                      S
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setRecordingTrackId(recordingTrackId === track.id ? null : track.id);
                      }}
                      className={`px-2 py-0.5 text-xs rounded ${
                        recordingTrackId === track.id ? 'bg-red-500 text-white animate-pulse' : 'bg-gray-800 text-gray-400'
                      }`}
                    >
                      ●
                    </button>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={track.volume * 100}
                    onChange={(e) => {
                      e.stopPropagation();
                      daw?.updateTrack(track.id, { volume: Number(e.target.value) / 100 });
                      setTracks(daw?.getTracks() || []);
                    }}
                    className="w-full accent-cyan-500"
                  />
                </div>
              ))}
            </div>

            {/* Timeline */}
            <div className="flex-1 overflow-auto relative" ref={timelineRef}>
              {/* Time Ruler */}
              <div className="sticky top-0 z-10 bg-[#0d0d0d] border-b border-gray-800" style={{ height: `${TIMELINE_HEIGHT}px`, width: `${timelineWidth}px` }}>
                {Array.from({ length: 401 }).map((_, i) => (
                  <div
                    key={i}
                    className="absolute top-0 h-full border-l border-gray-700"
                    style={{ left: `${i * zoom}px` }}
                  >
                    <span className="text-[10px] text-gray-500 ml-1">{i}s</span>
                  </div>
                ))}
                
                {/* Loop Region */}
                {loopEnabled && (
                  <div
                    className="absolute top-0 bottom-0 bg-orange-500/10 border-l-2 border-r-2 border-orange-500"
                    style={{
                      left: `${loopStart * zoom}px`,
                      width: `${(loopEnd - loopStart) * zoom}px`
                    }}
                  />
                )}
              </div>

              {/* Tracks */}
              {tracks.map((track, idx) => (
                <div
                  key={track.id}
                  className="relative border-b border-gray-800"
                  style={{ height: `${TRACK_HEIGHT}px`, width: `${timelineWidth}px`, backgroundColor: idx % 2 === 0 ? '#0a0a0a' : '#0d0d0d' }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={async (e) => {
                    e.preventDefault();
                    const audioUrl = e.dataTransfer.getData('audioUrl');
                    if (audioUrl) {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const x = e.clientX - rect.left + (timelineRef.current?.scrollLeft || 0);
                      const startTime = x / zoom;
                      await handleAddClip(audioUrl, track.id, startTime);
                    }
                  }}
                >
                  {/* Grid */}
                  {Array.from({ length: 401 * GRID_SUBDIVISION }).map((_, i) => (
                    <div
                      key={i}
                      className="absolute top-0 bottom-0 border-l"
                      style={{
                        left: `${(i / GRID_SUBDIVISION) * zoom}px`,
                        borderColor: i % GRID_SUBDIVISION === 0 ? '#333' : '#222'
                      }}
                    />
                  ))}

                  {/* Clips */}
                  {track.clips.map((clip) => (
                    <div
                      key={clip.id}
                      className="absolute top-1 bottom-1 bg-cyan-500/20 border border-cyan-500/50 rounded overflow-hidden cursor-move hover:bg-cyan-500/30 transition-colors"
                      style={{
                        left: `${clip.startTime * zoom}px`,
                        width: `${clip.duration * zoom}px`
                      }}
                      onClick={() => setSelectedClipId(clip.id)}
                    >
                      <canvas
                        ref={(canvas) => {
                          if (canvas && clip.buffer) {
                            canvas.width = clip.duration * zoom;
                            canvas.height = TRACK_HEIGHT - 8;
                            renderWaveform(canvas, clip.buffer);
                          }
                        }}
                        className="w-full h-full"
                      />
                    </div>
                  ))}

                  {/* Loop Region Overlay */}
                  {loopEnabled && (
                    <div
                      className="absolute top-0 bottom-0 bg-orange-500/5 pointer-events-none"
                      style={{
                        left: `${loopStart * zoom}px`,
                        width: `${(loopEnd - loopStart) * zoom}px`
                      }}
                    />
                  )}
                </div>
              ))}

              {/* Playhead */}
              <div
                className="absolute top-0 w-0.5 bg-cyan-400 z-20 pointer-events-none"
                style={{
                  left: `${playhead * zoom}px`,
                  height: `${TIMELINE_HEIGHT + tracks.length * TRACK_HEIGHT}px`
                }}
              >
                <div className="absolute -top-2 -left-2 w-4 h-4 bg-cyan-400 rotate-45" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Generate Modal */}
      {showGenerateModal && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-[#111] border border-cyan-500/30 rounded-xl p-8 max-w-2xl w-full">
            <h2 className="text-2xl font-bold text-cyan-400 mb-6">AI Music Generation</h2>
            <textarea
              className="w-full bg-[#0a0a0a] border border-gray-700 rounded p-4 text-white resize-none mb-4"
              rows={4}
              placeholder="Describe your track..."
            />
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setGeneratingTrack(true);
                  setTimeout(() => {
                    setGeneratingTrack(false);
                    setShowGenerateModal(false);
                  }, 2000);
                }}
                disabled={generatingTrack}
                className="flex-1 py-3 bg-gradient-to-r from-cyan-500 to-purple-500 text-white font-bold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {generatingTrack ? 'Generating...' : 'Generate'}
              </button>
              <button
                onClick={() => setShowGenerateModal(false)}
                className="px-6 py-3 bg-gray-800 text-white rounded-lg hover:bg-gray-700"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
