'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useUser } from '@clerk/nextjs';
import { MultiTrackDAW } from '@/lib/audio/MultiTrackDAW';
import type { Track, TrackClip } from '@/lib/audio/TrackManager';
import { Play, Pause, Square, Plus, Save, FolderOpen, Grid3x3, Repeat, Volume2, Sliders, ZoomIn, ZoomOut, Search, Music, SkipBack, SkipForward, HelpCircle, Scissors } from 'lucide-react';

export default function DAWv2() {
  const { user } = useUser();
  const [daw, setDaw] = useState<MultiTrackDAW | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playhead, setPlayhead] = useState(0);
  const [bpm, setBpm] = useState(120);
  const [zoom, setZoom] = useState(50); // pixels per second
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [showBrowser, setShowBrowser] = useState(true);
  const [showMixer, setShowMixer] = useState(false);
  const [showClipEditor, setShowClipEditor] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [library, setLibrary] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [loopEnabled, setLoopEnabled] = useState(false);
  const [loopStart, setLoopStart] = useState(0);
  const [loopEnd, setLoopEnd] = useState(16);
  const [searchTerm, setSearchTerm] = useState('');
  const timelineRef = useRef<HTMLDivElement>(null);
  const canvasRefs = useRef<Map<string, HTMLCanvasElement>>(new Map());

  // Initialize DAW
  useEffect(() => {
    if (!user) return;

    const initDAW = () => {
      try {
        const dawInstance = new MultiTrackDAW({ userId: user.id });
        
        // Add 4 default tracks
        for (let i = 0; i < 4; i++) {
          dawInstance.createTrack(`Track ${i + 1}`);
        }

        setDaw(dawInstance);
        setTracks(dawInstance.getTracks());
        setBpm(120);
        setLoading(false);

        // Update playhead every frame
        const updatePlayhead = () => {
          if (dawInstance) {
            const state = dawInstance.getTransportState();
            if (state.isPlaying) {
              setPlayhead(state.currentTime);
              setIsPlaying(true);
            }
          }
          requestAnimationFrame(updatePlayhead);
        };
        updatePlayhead();
      } catch (error) {
        console.error('DAW initialization failed:', error);
        setLoading(false);
      }
    };

    initDAW();
  }, [user]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === 'Space') {
        e.preventDefault();
        isPlaying ? handlePause() : handlePlay();
      } else if (e.key === '?') {
        setShowShortcuts(true);
      } else if (e.key === 'Escape') {
        setShowShortcuts(false);
      } else if (e.key === 'b' || e.key === 'B') {
        setShowBrowser(!showBrowser);
      } else if (e.key === 'm' || e.key === 'M') {
        setShowMixer(!showMixer);
      } else if (e.key === 'l' || e.key === 'L') {
        setLoopEnabled(!loopEnabled);
      } else if (e.key === 's' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isPlaying, showBrowser, showMixer, loopEnabled]);

  // Transport controls
  const handlePlay = useCallback(() => {
    if (!daw) return;
    daw.play();
    setIsPlaying(true);
  }, [daw]);

  const handlePause = useCallback(() => {
    if (!daw) return;
    daw.pause();
    setIsPlaying(false);
  }, [daw]);

  const handleStop = useCallback(() => {
    if (!daw) return;
    daw.stop();
    setIsPlaying(false);
    setPlayhead(0);
  }, [daw]);

  // Add track
  const handleAddTrack = useCallback(() => {
    if (!daw) return;
    const trackCount = tracks.length;
    daw.createTrack(`Track ${trackCount + 1}`);
    setTracks(daw.getTracks());
  }, [daw, tracks]);

  // Load library
  const loadLibrary = useCallback(async () => {
    if (!user) return;
    try {
      const response = await fetch('/api/media');
      const data = await response.json();
      setLibrary(data.filter((item: any) => item.type === 'audio'));
    } catch (error) {
      console.error('Library load failed:', error);
    }
  }, [user]);

  // Add clip from library
  const handleAddClip = useCallback(async (audioUrl: string, trackId: string) => {
    if (!daw) return;
    try {
      const response = await fetch(audioUrl);
      const arrayBuffer = await response.arrayBuffer();
      const audioContext = new AudioContext();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      daw.addClipToTrack(trackId, {
        startTime: playhead,
        buffer: audioBuffer,
        name: 'Audio Clip'
      });
      setTracks(daw.getTracks());
      setShowBrowser(false);
    } catch (error) {
      console.error('Clip add failed:', error);
    }
  }, [daw, playhead]);

  // Render waveform
  const renderWaveform = useCallback((canvas: HTMLCanvasElement, audioBuffer: AudioBuffer) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const data = audioBuffer.getChannelData(0);
    const step = Math.ceil(data.length / width);
    const amp = height / 2;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = '#06b6d4'; // Cyan waveform
    ctx.lineWidth = 1.5;
    ctx.beginPath();

    for (let i = 0; i < width; i++) {
      const min = Math.min(...data.slice(i * step, (i + 1) * step));
      const max = Math.max(...data.slice(i * step, (i + 1) * step));
      ctx.moveTo(i, (1 + min) * amp);
      ctx.lineTo(i, (1 + max) * amp);
    }

    ctx.stroke();
  }, []);

  // Save project
  const handleSave = useCallback(async () => {
    if (!daw || !user) return;
    try {
      const projectData = {
        tracks: daw.getTracks(),
        bpm: daw.getTransportState().bpm
      };
      const response = await fetch('/api/studio/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `Project ${new Date().toLocaleTimeString()}`,
          project_data: projectData,
          user_id: user.id
        })
      });
      if (response.ok) {
        alert('Project saved!');
      }
    } catch (error) {
      console.error('Save failed:', error);
    }
  }, [daw, user]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-cyan-400 text-xl">Initializing DAW...</div>
      </div>
    );
  }

  const timelineWidth = 200 * zoom;

  return (
    <div className="min-h-screen bg-black text-white flex flex-col overflow-hidden">
      {/* Header - Professional */}
      <div className="h-14 border-b border-slate-800 bg-[#1a1a1a] flex items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <h1 className="text-xl font-bold text-cyan-400 tracking-tight">444 Studio</h1>
          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 rounded">
              <span className="text-gray-400">BPM</span>
              <input 
                type="number" 
                value={bpm}
                onChange={(e) => setBpm(parseInt(e.target.value) || 120)}
                className="w-12 bg-transparent text-cyan-400 font-mono outline-none"
              />
            </div>
            <button
              onClick={() => setSnapEnabled(!snapEnabled)}
              className={`px-3 py-1.5 rounded flex items-center gap-1.5 transition-colors ${
                snapEnabled ? 'bg-cyan-500 text-black font-semibold' : 'bg-slate-900 text-gray-400'
              }`}
              title="Snap to Grid"
            >
              <Grid3x3 size={13} />
              Snap
            </button>
            <button
              onClick={() => setLoopEnabled(!loopEnabled)}
              className={`px-3 py-1.5 rounded flex items-center gap-1.5 transition-colors ${
                loopEnabled ? 'bg-yellow-500 text-black font-semibold' : 'bg-slate-900 text-gray-400'
              }`}
              title="Loop Region (L)"
            >
              <Repeat size={13} />
              Loop
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowBrowser(!showBrowser)}
            className={`px-3 py-1.5 rounded text-xs flex items-center gap-1.5 transition-colors ${
              showBrowser ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'bg-slate-900 text-gray-400'
            }`}
            title="Browser (B)"
          >
            <FolderOpen size={14} />
            Browser
          </button>
          <button
            onClick={() => setShowMixer(!showMixer)}
            className={`px-3 py-1.5 rounded text-xs flex items-center gap-1.5 transition-colors ${
              showMixer ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'bg-slate-900 text-gray-400'
            }`}
            title="Mixer (M)"
          >
            <Sliders size={14} />
            Mixer
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-1.5 bg-cyan-500 hover:bg-cyan-600 text-black rounded text-xs font-semibold flex items-center gap-1.5 transition-colors"
            title="Save Project (Cmd+S)"
          >
            <Save size={14} />
            Save
          </button>
          <button
            onClick={() => setShowGenerateModal(true)}
            className="px-4 py-1.5 bg-teal-500 hover:bg-teal-600 text-black rounded text-xs font-semibold transition-colors"
          >
            Generate AI
          </button>
          <button
            onClick={() => setShowShortcuts(true)}
            className="w-8 h-8 bg-slate-900 hover:bg-slate-800 rounded flex items-center justify-center transition-colors"
            title="Keyboard Shortcuts (?)"
          >
          </button>
        </div>
      </div>

      {/* Transport Controls - Professional */}
      <div className="h-16 border-b border-slate-800 bg-[#0f0f0f] flex items-center justify-center gap-3">
        <button
          onClick={() => {
            if (daw) {
              daw.seekTo(0);
              setPlayhead(0);
            }
          }}
          className="w-10 h-10 bg-slate-800 hover:bg-slate-700 rounded flex items-center justify-center transition-colors"
          title="Return to Zero"
        >
          <SkipBack size={16} />
        </button>
        <button
          onClick={handleStop}
          className="w-10 h-10 bg-slate-800 hover:bg-slate-700 rounded flex items-center justify-center transition-colors"
          title="Stop"
        >
          <Square size={16} fill="white" />
        </button>
        {!isPlaying ? (
          <button
            onClick={handlePlay}
            className="w-14 h-14 bg-gradient-to-br from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 rounded-full flex items-center justify-center transition-all shadow-lg shadow-cyan-500/30"
            title="Play (Space)"
          >
            <Play size={24} fill="black" className="ml-0.5" />
          </button>
        ) : (
          <button
            onClick={handlePause}
            className="w-14 h-14 bg-gradient-to-br from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 rounded-full flex items-center justify-center transition-all shadow-lg shadow-cyan-500/30"
            title="Pause (Space)"
          >
            <Pause size={24} fill="black" />
          </button>
        )}
        <button
          onClick={() => {
            if (daw) {
              daw.seekTo(loopEnd);
            }
          }}
          className="w-10 h-10 bg-slate-800 hover:bg-slate-700 rounded flex items-center justify-center transition-colors"
          title="Skip to Loop End"
        >
          <SkipForward size={16} />
        </button>
        <div className="text-cyan-400 font-mono text-lg min-w-[100px] text-center bg-slate-900 px-4 py-2 rounded ml-4">
          {Math.floor(playhead / 60)}:{(playhead % 60).toFixed(2).padStart(5, '0')}
        </div>
        <button
          onClick={handleAddTrack}
          className="px-4 py-2 bg-teal-500/20 hover:bg-teal-500/30 text-teal-400 border border-teal-500/30 rounded flex items-center gap-2 transition-colors"
          title="Add Track"
        >
          <Plus size={16} />
          Track
        </button>
        <div className="flex items-center gap-2 ml-4">
          <button
            onClick={() => setZoom(Math.max(10, zoom - 10))}
            className="w-8 h-8 bg-slate-800 hover:bg-slate-700 rounded flex items-center justify-center transition-colors"
            title="Zoom Out"
          >
            <ZoomOut size={14} />
          </button>
          <div className="text-xs text-gray-400 min-w-[60px] text-center font-mono">
            {zoom}px/s
          </div>
          <button
            onClick={() => setZoom(Math.min(200, zoom + 10))}
            className="w-8 h-8 bg-slate-800 hover:bg-slate-700 rounded flex items-center justify-center transition-colors"
            title="Zoom In"
          >
            <ZoomIn size={14} />
          </button>
        </div>
      </div>

      {/* Main Workspace */}
      <div className="flex flex-1 overflow-hidden">
        {/* Browser Panel */}
        {showBrowser && (
          <div className="w-64 border-r border-slate-800 bg-[#1a1a1a] flex flex-col">
            <div className="p-4 border-b border-slate-800">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                <input
                  type="text"
                  placeholder="Search library..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-cyan-500 focus:outline-none"
                />
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Your Library</h3>
              
              {library.length === 0 ? (
                <button
                  onClick={loadLibrary}
                  className="w-full py-2 px-4 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 rounded-lg text-sm transition-colors"
                >
                  Load Library
                </button>
              ) : (
                <div className="space-y-1">
                  {library
                    .filter(item => item.title.toLowerCase().includes(searchTerm.toLowerCase()))
                    .map((item) => (
                      <div
                        key={item.id}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData('audioUrl', item.audio_url);
                          e.dataTransfer.setData('title', item.title);
                        }}
                        className="p-3 bg-slate-900 hover:bg-slate-800 rounded-lg cursor-move transition-colors group"
                      >
                        <div className="flex items-center gap-2">
                          <Music size={14} className="text-cyan-400 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-white truncate">{item.title}</div>
                            {item.genre && (
                              <div className="text-xs text-gray-500">{item.genre}</div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Timeline & Tracks */}
        <div className="flex-1 overflow-auto">
          <div className="flex">
            {/* Track Headers */}
            <div className="w-48 flex-shrink-0 bg-slate-950 border-r border-slate-800">
            {tracks.map((track, index) => (
              <div
                key={track.id}
                className={`h-32 border-b border-slate-800 p-4 cursor-pointer transition-colors ${
                  selectedTrackId === track.id ? 'bg-slate-800' : 'hover:bg-slate-900'
                }`}
                onClick={() => setSelectedTrackId(track.id)}
              >
                <div className="text-sm font-semibold text-cyan-400 mb-2">{track.name}</div>
                <div className="flex items-center gap-2 mt-4">
                  <div className="text-xs text-gray-400">Vol:</div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={track.volume * 100}
                    onChange={(e) => {
                      if (daw) {
                        daw.updateTrack(track.id, { volume: parseFloat(e.target.value) / 100 });
                        setTracks(daw.getTracks());
                      }
                    }}
                    className="flex-1 accent-cyan-500"
                  />
                </div>
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (daw) {
                        daw.updateTrack(track.id, { muted: !track.muted });
                        setTracks(daw.getTracks());
                      }
                    }}
                    className={`px-2 py-1 text-xs rounded ${
                      track.muted ? 'bg-red-500 text-white' : 'bg-slate-700 text-gray-400'
                    }`}
                  >
                    M
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (daw) {
                        daw.updateTrack(track.id, { solo: !track.solo });
                        setTracks(daw.getTracks());
                      }
                    }}
                    className={`px-2 py-1 text-xs rounded ${
                      track.solo ? 'bg-yellow-500 text-black' : 'bg-slate-700 text-gray-400'
                    }`}
                  >
                    S
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Timeline */}
          <div ref={timelineRef} className="flex-1 relative bg-slate-900">
            {/* Time Ruler */}
            <div className="h-12 bg-slate-950 border-b border-slate-800 sticky top-0 z-10 overflow-hidden">
              <div style={{ width: `${timelineWidth}px` }} className="relative h-full">
                {/* Loop Region Highlight */}
                {loopEnabled && (
                  <div
                    className="absolute top-0 bottom-0 bg-yellow-500/10 border-l-2 border-r-2 border-yellow-500 pointer-events-none"
                    style={{
                      left: `${loopStart * zoom}px`,
                      width: `${(loopEnd - loopStart) * zoom}px`
                    }}
                  />
                )}
                
                {Array.from({ length: 201 }).map((_, i) => (
                  <div
                    key={i}
                    className="absolute top-0 h-full border-l border-slate-700"
                    style={{ left: `${i * zoom}px` }}
                  >
                    <span className="text-xs text-cyan-400 ml-1">{i}s</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Tracks */}
            {tracks.map((track, trackIndex) => (
              <div
                key={track.id}
                className={`h-32 border-b border-slate-800 relative ${
                  trackIndex % 2 === 0 ? 'bg-slate-900' : 'bg-slate-950'
                }`}
                style={{ width: `${timelineWidth}px` }}
              >
                {/* Loop Region Highlight */}
                {loopEnabled && (
                  <div
                    className="absolute top-0 bottom-0 bg-yellow-500/5 border-l border-r border-yellow-500/30 pointer-events-none z-5"
                    style={{
                      left: `${loopStart * zoom}px`,
                      width: `${(loopEnd - loopStart) * zoom}px`
                    }}
                  />
                )}
                
                {/* Grid lines */}
                {Array.from({ length: 201 }).map((_, i) => (
                  <div
                    key={i}
                    className="absolute top-0 bottom-0 border-l border-slate-800"
                    style={{ left: `${i * zoom}px` }}
                  />
                ))}

                {/* Clips */}
                {track.clips.map((clip) => {
                  const clipWidth = (clip.duration || 0) * zoom;
                  const clipLeft = clip.startTime * zoom;
                  
                  return (
                    <div
                      key={clip.id}
                      className="absolute top-2 bottom-2 bg-cyan-500/20 border border-cyan-500/50 rounded overflow-hidden cursor-move hover:bg-cyan-500/30 transition-colors"
                      style={{
                        left: `${clipLeft}px`,
                        width: `${clipWidth}px`
                      }}
                      onClick={() => setSelectedClipId(clip.id)}
                    >
                      <canvas
                        ref={(canvas) => {
                          if (canvas && clip.buffer) {
                            canvasRefs.current.set(clip.id, canvas);
                            canvas.width = clipWidth;
                            canvas.height = 110;
                            renderWaveform(canvas, clip.buffer);
                          }
                        }}
                        className="w-full h-full"
                      />
                    </div>
                  );
                })}
              </div>
            ))}

            {/* Playhead */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-cyan-400 pointer-events-none z-20"
              style={{ left: `${playhead * zoom}px` }}
            >
              <div className="w-0 h-0 border-l-8 border-r-8 border-t-8 border-l-transparent border-r-transparent border-t-cyan-400 -ml-2" />
            </div>
          </div>
        </div>
      </div>

        {/* Mixer Panel */}
        {showMixer && (
          <div className="w-80 border-l border-slate-800 bg-[#1a1a1a] flex flex-col overflow-y-auto">
            <div className="p-4 border-b border-slate-800 flex items-center gap-2">
              <Sliders size={18} className="text-cyan-400" />
              <h3 className="text-lg font-semibold text-white">Mixer</h3>
            </div>
            
            <div className="flex-1 p-4">
              <div className="grid grid-cols-2 gap-4">
                {tracks.map((track) => (
                  <div key={track.id} className="bg-slate-900 rounded-lg p-4 border border-slate-800">
                    <div className="text-sm font-semibold text-cyan-400 mb-4 truncate">{track.name}</div>
                    
                    {/* Vertical Fader */}
                    <div className="flex flex-col items-center mb-4">
                      <div className="h-32 w-8 bg-slate-950 rounded-full relative border border-slate-700">
                        <div
                          className="absolute bottom-0 w-full bg-gradient-to-t from-cyan-500 to-cyan-400 rounded-full transition-all"
                          style={{ height: `${track.volume * 100}%` }}
                        />
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={track.volume * 100}
                          onChange={(e) => {
                            if (daw) {
                              daw.updateTrack(track.id, { volume: parseFloat(e.target.value) / 100 });
                              setTracks([...daw.getTracks()]);
                            }
                          }}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-ns-resize"
                          style={{ writingMode: 'vertical-lr' } as React.CSSProperties}
                        />
                      </div>
                      <div className="text-xs text-gray-400 mt-2 font-mono">
                        {(track.volume * 100).toFixed(0)}%
                      </div>
                    </div>

                    {/* Pan Control */}
                    <div className="mb-3">
                      <div className="text-xs text-gray-400 mb-1">Pan</div>
                      <input
                        type="range"
                        min="-100"
                        max="100"
                        defaultValue="0"
                        className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-cyan-400"
                      />
                      <div className="text-xs text-center text-gray-500 mt-1">C</div>
                    </div>

                    {/* Mute/Solo */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          if (daw) {
                            daw.updateTrack(track.id, { muted: !track.muted });
                            setTracks([...daw.getTracks()]);
                          }
                        }}
                        className={`flex-1 py-1 text-xs rounded font-semibold transition-colors ${
                          track.muted ? 'bg-red-500 text-white' : 'bg-slate-700 text-gray-400'
                        }`}
                      >
                        M
                      </button>
                      <button
                        onClick={() => {
                          if (daw) {
                            daw.updateTrack(track.id, { solo: !track.solo });
                            setTracks([...daw.getTracks()]);
                          }
                        }}
                        className={`flex-1 py-1 text-xs rounded font-semibold transition-colors ${
                          track.solo ? 'bg-yellow-500 text-black' : 'bg-slate-700 text-gray-400'
                        }`}
                      >
                        S
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}

      {/* Keyboard Shortcuts Modal */}
      {showShortcuts && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-[#1a1a1a] border border-cyan-500/30 rounded-xl p-8 max-w-2xl w-full">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-cyan-400">Keyboard Shortcuts</h2>
              <button
                onClick={() => setShowShortcuts(false)}
                className="text-gray-400 hover:text-white text-2xl"
              >
                ✕
              </button>
            </div>
            
            <div className="grid grid-cols-2 gap-6 text-sm">
              <div>
                <h3 className="font-semibold text-white mb-3 uppercase tracking-wider">Transport</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Play / Pause</span>
                    <kbd className="px-2 py-1 bg-slate-900 text-cyan-400 rounded font-mono">Space</kbd>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Loop On/Off</span>
                    <kbd className="px-2 py-1 bg-slate-900 text-cyan-400 rounded font-mono">L</kbd>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-white mb-3 uppercase tracking-wider">View</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Toggle Browser</span>
                    <kbd className="px-2 py-1 bg-slate-900 text-cyan-400 rounded font-mono">B</kbd>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Toggle Mixer</span>
                    <kbd className="px-2 py-1 bg-slate-900 text-cyan-400 rounded font-mono">M</kbd>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Show Shortcuts</span>
                    <kbd className="px-2 py-1 bg-slate-900 text-cyan-400 rounded font-mono">?</kbd>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-white mb-3 uppercase tracking-wider">Project</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Save</span>
                    <kbd className="px-2 py-1 bg-slate-900 text-cyan-400 rounded font-mono">Cmd+S</kbd>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-white mb-3 uppercase tracking-wider">Tips</h3>
                <div className="space-y-2 text-gray-400 text-xs">
                  <div>• Drag audio from browser to tracks</div>
                  <div>• Use loop for section work</div>
                  <div>• Solo/Mute for better mixing</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Generate AI Modal */}
      {showGenerateModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-slate-950 border border-cyan-500/30 rounded-xl p-8 max-w-2xl w-full">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-cyan-400">Generate AI Track</h2>
              <button
                onClick={() => setShowGenerateModal(false)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            
            <form className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Prompt</label>
                <textarea
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:border-cyan-500 focus:outline-none"
                  rows={3}
                  placeholder="Describe your track..."
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Genre</label>
                  <select className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:border-cyan-500 focus:outline-none">
                    <option>Lo-fi</option>
                    <option>Hip Hop</option>
                    <option>Electronic</option>
                    <option>Jazz</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm text-gray-400 mb-2">BPM</label>
                  <input
                    type="number"
                    defaultValue={120}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:border-cyan-500 focus:outline-none"
                  />
                </div>
              </div>
              
              <button
                type="button"
                className="w-full py-3 bg-cyan-500 hover:bg-cyan-600 text-black font-semibold rounded-lg transition-colors"
              >
                Generate Track
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
