'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useUser } from '@clerk/nextjs';
import { MultiTrackDAW } from '@/lib/audio/MultiTrackDAW';
import type { Track, TrackClip } from '@/lib/audio/TrackManager';
import { Play, Pause, Square, Plus, Upload, Save, FolderOpen, Download, Settings } from 'lucide-react';

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
  const [showLibrary, setShowLibrary] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [library, setLibrary] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
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
      setShowLibrary(false);
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

  const timelineWidth = 200 * zoom; // 200 seconds * zoom

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* Header */}
      <div className="h-16 border-b border-slate-800 bg-slate-950 flex items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-cyan-400">444 DAW v2.0</h1>
          <div className="text-sm text-gray-400">BPM: {bpm}</div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-black rounded-lg flex items-center gap-2 transition-colors"
          >
            <Save size={16} />
            Save
          </button>
          <button
            onClick={() => setShowLibrary(true)}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg flex items-center gap-2 transition-colors"
          >
            <FolderOpen size={16} />
            Library
          </button>
          <button
            onClick={() => setShowGenerateModal(true)}
            className="px-4 py-2 bg-teal-500 hover:bg-teal-600 text-black rounded-lg transition-colors"
          >
            Generate AI
          </button>
        </div>
      </div>

      {/* Transport Controls */}
      <div className="h-20 border-b border-slate-800 bg-slate-950 flex items-center justify-center gap-4">
        <button
          onClick={handleStop}
          className="w-12 h-12 bg-slate-800 hover:bg-slate-700 rounded-lg flex items-center justify-center transition-colors"
        >
          <Square size={20} fill="white" />
        </button>
        {!isPlaying ? (
          <button
            onClick={handlePlay}
            className="w-16 h-16 bg-cyan-500 hover:bg-cyan-600 rounded-lg flex items-center justify-center transition-colors"
          >
            <Play size={28} fill="black" />
          </button>
        ) : (
          <button
            onClick={handlePause}
            className="w-16 h-16 bg-cyan-500 hover:bg-cyan-600 rounded-lg flex items-center justify-center transition-colors"
          >
            <Pause size={28} fill="black" />
          </button>
        )}
        <div className="text-cyan-400 font-mono text-lg min-w-[100px] text-center">
          {playhead.toFixed(2)}s
        </div>
        <button
          onClick={handleAddTrack}
          className="px-4 py-2 bg-teal-500 hover:bg-teal-600 text-black rounded-lg flex items-center gap-2 transition-colors"
        >
          <Plus size={16} />
          Add Track
        </button>
      </div>

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

      {/* Library Modal */}
      {showLibrary && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-slate-950 border border-cyan-500/30 rounded-xl p-8 max-w-4xl w-full max-h-[80vh] overflow-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-cyan-400">Your Library</h2>
              <button
                onClick={() => setShowLibrary(false)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            
            {library.length === 0 && (
              <div className="text-center py-8">
                <button
                  onClick={loadLibrary}
                  className="px-6 py-3 bg-cyan-500 hover:bg-cyan-600 text-black rounded-lg transition-colors"
                >
                  Load Library
                </button>
              </div>
            )}

            <div className="grid grid-cols-3 gap-4">
              {library.map((item) => (
                <div
                  key={item.id}
                  className="bg-slate-900 border border-slate-800 rounded-lg p-4 hover:border-cyan-500/50 transition-colors cursor-pointer"
                  onClick={() => selectedTrackId && handleAddClip(item.audio_url, selectedTrackId)}
                >
                  <div className="text-sm font-semibold text-white mb-2">{item.title}</div>
                  <div className="text-xs text-gray-400">Click to add to selected track</div>
                </div>
              ))}
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
