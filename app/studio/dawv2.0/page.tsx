'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
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
  const [showExportModal, setShowExportModal] = useState(false);
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);
  const [library, setLibrary] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [loopEnabled, setLoopEnabled] = useState(false);
  const [loopStart, setLoopStart] = useState(0);
  const [loopEnd, setLoopEnd] = useState(16);
  const [searchTerm, setSearchTerm] = useState('');
  const [metronomeEnabled, setMetronomeEnabled] = useState(false);
  const [markers, setMarkers] = useState<Array<{id: string, time: number, name: string, color: string}>>([]);
  const [selectedClips, setSelectedClips] = useState<Set<string>>(new Set());
  const [history, setHistory] = useState<Array<{action: string, timestamp: number}>>([]);
  const [generatingTrack, setGeneratingTrack] = useState(false);
  const [showAutomation, setShowAutomation] = useState<Set<string>>(new Set());
  const [automationMode, setAutomationMode] = useState<{[trackId: string]: 'volume' | 'pan'}>({});
  const [audioLevels, setAudioLevels] = useState<{[trackId: string]: number}>({});
  const [peakLevels, setPeakLevels] = useState<{[trackId: string]: number}>({});
  const [waveformZoom, setWaveformZoom] = useState(1);
  const [showMiniMap, setShowMiniMap] = useState(true);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [recordingTrackId, setRecordingTrackId] = useState<string | null>(null);
  const [metronomeFlash, setMetronomeFlash] = useState(false);
  const timelineRef = useRef<HTMLDivElement>(null);
  const canvasRefs = useRef<Map<string, HTMLCanvasElement>>(new Map());
  const timelineWidth = 201 * zoom; // Fixed width calculation for alignment

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
              
              // Update audio meters
              const newLevels: {[key: string]: number} = {};
              const newPeaks: {[key: string]: number} = {};
              dawInstance.getTracks().forEach(track => {
                // Simulate audio level (0-1) - in production, use AudioAnalyzer
                const randomLevel = Math.random() * 0.7;
                newLevels[track.id] = randomLevel;
                newPeaks[track.id] = Math.max(peakLevels[track.id] || 0, randomLevel);
              });
              setAudioLevels(newLevels);
              setPeakLevels(newPeaks);
              
              // Decay peak levels
              setTimeout(() => {
                setPeakLevels(prev => {
                  const decayed = {...prev};
                  Object.keys(decayed).forEach(key => {
                    decayed[key] = Math.max(0, decayed[key] - 0.01);
                  });
                  return decayed;
                });
              }, 1000);
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
  
  // Load library after DAW is initialized
  useEffect(() => {
    if (user && !loading) {
      loadLibrary();
    }
  }, [user, loading]);

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
      } else if (e.key === 'c' || e.key === 'C') {
        setMetronomeEnabled(!metronomeEnabled);
      } else if (e.key === 's' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleSave();
      } else if (e.key === 'z' && (e.metaKey || e.ctrlKey) && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      } else if (e.key === 'z' && (e.metaKey || e.ctrlKey) && e.shiftKey) {
        e.preventDefault();
        handleRedo();
      } else if (e.key === 'd' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleDuplicateClips();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedClips.size > 0) {
          e.preventDefault();
          handleDeleteClips();
        }
      } else if (e.key === 'h' || e.key === 'H') {
        setShowHistoryPanel(!showHistoryPanel);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isPlaying, showBrowser, showMixer, loopEnabled, metronomeEnabled, showHistoryPanel, selectedClips]);

  // Transport controls
  const handlePlay = useCallback(() => {
    if (!daw) return;
    try {
      daw.play();
      setIsPlaying(true);
      
      // Metronome beat flash effect
      if (metronomeEnabled) {
        const beatInterval = (60 / bpm) * 1000; // ms per beat
        const flashMetronome = setInterval(() => {
          setMetronomeFlash(true);
          setTimeout(() => setMetronomeFlash(false), 100);
        }, beatInterval);
        
        // Clear on pause/stop
        const checkPlaying = setInterval(() => {
          if (!daw.getTransportState().isPlaying) {
            clearInterval(flashMetronome);
            clearInterval(checkPlaying);
          }
        }, 100);
      }
    } catch (error) {
      console.error('Playback error:', error);
    }
  }, [daw, metronomeEnabled, bpm]);

  const handlePause = useCallback(() => {
    if (!daw) return;
    try {
      daw.pause();
      setIsPlaying(false);
      setMetronomeFlash(false);
    } catch (error) {
      console.error('Pause error:', error);
    }
  }, [daw]);

  const handleStop = useCallback(() => {
    if (!daw) return;
    try {
      daw.stop();
      setIsPlaying(false);
      setPlayhead(0);
      setMetronomeFlash(false);
    } catch (error) {
      console.error('Stop error:', error);
    }
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
      if (data && Array.isArray(data)) {
        setLibrary(data.filter((item: any) => item.type === 'audio'));
      }
    } catch (error) {
      console.error('Library load failed:', error);
    }
  }, [user]);
  
  // Import audio file
  const handleImport = useCallback(async () => {
    if (!importFile || !user) return;
    
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', importFile);
      formData.append('type', 'audio');
      formData.append('title', importFile.name.replace(/\.[^/.]+$/, ''));
      
      const response = await fetch('/api/profile/upload', {
        method: 'POST',
        body: formData
      });
      
      if (response.ok) {
        await loadLibrary(); // Refresh library
        setShowImportModal(false);
        setImportFile(null);
        addToHistory(`Imported ${importFile.name}`);
      } else {
        alert('Import failed');
      }
    } catch (error) {
      console.error('Import error:', error);
      alert('Import failed');
    } finally {
      setUploading(false);
    }
  }, [importFile, user, loadLibrary]);
  
  // Start recording
  const handleStartRecording = useCallback(async (trackId: string) => {
    if (!daw) return;
    try {
      setRecordingTrackId(trackId);
      addToHistory(`Started recording on ${daw.getTracks().find(t => t.id === trackId)?.name}`);
      // TODO: Integrate with RecordingManager from MultiTrackDAW
      // await daw.startRecording(trackId);
    } catch (error) {
      console.error('Recording error:', error);
    }
  }, [daw]);
  
  // Stop recording
  const handleStopRecording = useCallback(async () => {
    if (!daw || !recordingTrackId) return;
    try {
      // TODO: Integrate with RecordingManager
      // const recordedBuffer = await daw.stopRecording();
      // Upload to R2 and create clip
      setRecordingTrackId(null);
      addToHistory('Recording stopped');
    } catch (error) {
      console.error('Stop recording error:', error);
    }
  }, [daw, recordingTrackId]);

  // Add clip from library
  const handleAddClip = useCallback(async (audioUrl: string, trackId: string, startTime: number = 0) => {
    if (!daw) return;
    try {
      const response = await fetch(audioUrl);
      const arrayBuffer = await response.arrayBuffer();
      const audioContext = new AudioContext();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      // Create clip using DAW engine
      const clip: TrackClip = {
        id: `clip-${Date.now()}`,
        trackId: trackId,
        startTime: startTime,
        duration: audioBuffer.duration,
        offset: 0,
        gain: 1,
        fadeIn: { duration: 0, curve: 'linear' },
        fadeOut: { duration: 0, curve: 'linear' },
        buffer: audioBuffer,
        locked: false
      };
      
      daw.addClipToTrack(trackId, clip);
      setTracks(daw.getTracks());
      addToHistory(`Added clip to ${daw.getTracks().find(t => t.id === trackId)?.name}`);
    } catch (error) {
      console.error('Clip add failed:', error);
    }
  }, [daw]);

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
        addToHistory('Save Project');
      }
    } catch (error) {
      console.error('Save failed:', error);
    }
  }, [daw, user]);

  // Undo/Redo handlers
  const handleUndo = useCallback(() => {
    if (daw) {
      // In future: wire to daw.historyManager.undo()
      addToHistory('Undo');
    }
  }, [daw]);

  const handleRedo = useCallback(() => {
    if (daw) {
      // In future: wire to daw.historyManager.redo()
      addToHistory('Redo');
    }
  }, [daw]);

  // Clip manipulation handlers
  const handleDuplicateClips = useCallback(() => {
    if (selectedClips.size === 0) return;
    selectedClips.forEach(clipId => {
      // Find clip and duplicate it
      tracks.forEach(track => {
        const clip = track.clips.find(c => c.id === clipId);
        if (clip && daw) {
          // Create a deep copy of the clip
          const newClip = {
            ...clip,
            id: `clip-${Date.now()}-${Math.random()}`,
            startTime: clip.startTime + (clip.duration || 5)
          };
          track.clips.push(newClip);
        }
      });
    });
    setTracks([...tracks]);
    addToHistory(`Duplicate ${selectedClips.size} clip(s)`);
  }, [selectedClips, tracks, daw]);

  const handleDeleteClips = useCallback(() => {
    if (selectedClips.size === 0) return;
    selectedClips.forEach(clipId => {
      tracks.forEach(track => {
        const clipIndex = track.clips.findIndex(c => c.id === clipId);
        if (clipIndex !== -1) {
          track.clips.splice(clipIndex, 1);
        }
      });
    });
    setTracks([...tracks]);
    setSelectedClips(new Set());
    addToHistory(`Delete ${selectedClips.size} clip(s)`);
  }, [selectedClips, tracks]);

  // Add marker
  const handleAddMarker = useCallback(() => {
    const newMarker = {
      id: `marker-${Date.now()}`,
      time: playhead,
      name: `Marker ${markers.length + 1}`,
      color: '#06b6d4'
    };
    setMarkers([...markers, newMarker]);
    addToHistory('Add Marker');
  }, [playhead, markers]);

  // History management
  const addToHistory = useCallback((action: string) => {
    setHistory(prev => [...prev, { action, timestamp: Date.now() }].slice(-50));
  }, []);

  // AI Generate Track
  const handleGenerateTrack = useCallback(async (prompt: string, genre: string, bpm: number) => {
    if (!daw || !user) return;
    setGeneratingTrack(true);
    try {
      const response = await fetch('/api/generate/music', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, genre, bpm })
      });
      
      if (response.ok) {
        const data = await response.json();
        // Add generated track
        const newTrack = daw.createTrack(`AI: ${genre}`);
        if (data.audio_url && newTrack) {
          await handleAddClip(data.audio_url, newTrack.id);
        }
        setTracks([...daw.getTracks()]);
        addToHistory('Generate AI Track');
        setShowGenerateModal(false);
      }
    } catch (error) {
      console.error('Generation failed:', error);
    } finally {
      setGeneratingTrack(false);
    }
  }, [daw, user, handleAddClip]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-cyan-400 text-xl">Initializing DAW...</div>
      </div>
    );
  }


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
            <button
              onClick={() => setMetronomeEnabled(!metronomeEnabled)}
              className={`px-3 py-1.5 rounded flex items-center gap-1.5 transition-all ${
                metronomeEnabled 
                  ? (metronomeFlash ? 'bg-cyan-400 text-black scale-110' : 'bg-teal-500 text-black font-semibold')
                  : 'bg-slate-900 text-gray-400'
              }`}
              title="Metronome (C)"
            >
              <Volume2 size={13} className={metronomeFlash && metronomeEnabled ? 'animate-pulse' : ''} />
              {metronomeFlash && metronomeEnabled ? '●' : 'Click'}
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowImportModal(true)}
            className="px-3 py-1.5 rounded text-xs flex items-center gap-1.5 transition-colors bg-slate-900 text-gray-400 hover:bg-slate-800"
            title="Import Audio"
          >
            <FolderOpen size={14} />
            Import
          </button>
          <button
            onClick={() => setShowHistoryPanel(!showHistoryPanel)}
            className={`px-3 py-1.5 rounded text-xs flex items-center gap-1.5 transition-colors ${
              showHistoryPanel ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'bg-slate-900 text-gray-400'
            }`}
            title="History (H)"
          >
            ↺ History
          </button>
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
            onClick={() => setShowExportModal(true)}
            className="px-4 py-1.5 bg-purple-500 hover:bg-purple-600 text-white rounded text-xs font-semibold transition-colors"
            title="Export Audio"
          >
            ⬇ Export
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
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const newSet = new Set(showAutomation);
                      if (newSet.has(track.id)) {
                        newSet.delete(track.id);
                      } else {
                        newSet.add(track.id);
                        if (!automationMode[track.id]) {
                          setAutomationMode({...automationMode, [track.id]: 'volume'});
                        }
                      }
                      setShowAutomation(newSet);
                    }}
                    className={`px-2 py-1 text-xs rounded ${
                      showAutomation.has(track.id) ? 'bg-purple-500 text-white' : 'bg-slate-700 text-gray-400'
                    }`}
                    title="Toggle Automation"
                  >
                    A
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (recordingTrackId === track.id) {
                        handleStopRecording();
                      } else {
                        handleStartRecording(track.id);
                      }
                    }}
                    className={`px-2 py-1 text-xs rounded ${
                      recordingTrackId === track.id 
                        ? 'bg-red-500 text-white animate-pulse' 
                        : 'bg-slate-700 text-gray-400 hover:bg-red-500/30'
                    }`}
                    title="Record"
                  >
                    ●
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Timeline */}
          <div ref={timelineRef} className="flex-1 relative bg-slate-900">
            {/* Mini-Map Overview */}
            {showMiniMap && (
              <div className="h-8 bg-slate-950 border-b border-slate-800 relative overflow-hidden">
                <div className="h-full flex items-center px-2">
                  {/* Simplified track representation */}
                  <div className="flex-1 h-4 bg-slate-800 rounded-sm relative">
                    {tracks.map(track => (
                      <React.Fragment key={track.id}>
                        {track.clips.map(clip => (
                          <div 
                            key={clip.id}
                            className="absolute top-0 bottom-0 bg-cyan-500/40"
                            style={{
                              left: `${(clip.startTime / 200) * 100}%`,
                              width: `${((clip.duration || 0) / 200) * 100}%`
                            }}
                          />
                        ))}
                      </React.Fragment>
                    ))}
                    {/* Viewport indicator */}
                    <div 
                      className="absolute top-0 bottom-0 border-2 border-cyan-400 bg-cyan-400/10"
                      style={{
                        left: '0%',
                        width: '20%' // Represents current viewport
                      }}
                    />
                  </div>
                </div>
              </div>
            )}
            
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
                
                {/* Markers */}
                {markers.map(marker => (
                  <div
                    key={marker.id}
                    className="absolute top-0 bottom-0 w-0.5 z-20 cursor-pointer group"
                    style={{ left: `${marker.time * zoom}px`, backgroundColor: marker.color }}
                    title={marker.name}
                  >
                    <div className="absolute top-0 -mt-1 w-3 h-3 rounded-full border-2"
                      style={{ borderColor: marker.color, backgroundColor: marker.color, left: '-5px' }}
                    />
                    <div className="absolute top-4 left-1 text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 bg-black/80 px-2 py-1 rounded">
                      {marker.name}
                    </div>
                  </div>
                ))}
                
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
              <React.Fragment key={track.id}>
                <div
                  className={`h-32 border-b border-slate-800 relative ${
                    trackIndex % 2 === 0 ? 'bg-slate-900' : 'bg-slate-950'
                  }`}
                  style={{ width: `${timelineWidth}px` }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={async (e) => {
                    e.preventDefault();
                    const audioUrl = e.dataTransfer.getData('audioUrl');
                    if (audioUrl && timelineRef.current) {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const offsetX = e.clientX - rect.left;
                      const startTime = offsetX / zoom;
                      await handleAddClip(audioUrl, track.id, startTime);
                    }
                  }}
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
                      className={`absolute top-2 bottom-2 rounded overflow-hidden cursor-move transition-colors ${
                        selectedClips.has(clip.id) 
                          ? 'bg-cyan-500/40 border-2 border-cyan-400' 
                          : 'bg-cyan-500/20 border border-cyan-500/50 hover:bg-cyan-500/30'
                      }`}
                      style={{
                        left: `${clipLeft}px`,
                        width: `${clipWidth}px`
                      }}
                      onClick={(e) => {
                        if (e.shiftKey) {
                          // Multi-select
                          const newSelected = new Set(selectedClips);
                          if (newSelected.has(clip.id)) {
                            newSelected.delete(clip.id);
                          } else {
                            newSelected.add(clip.id);
                          }
                          setSelectedClips(newSelected);
                        } else {
                          // Single select
                          setSelectedClipId(clip.id);
                          setSelectedClips(new Set([clip.id]));
                          setShowClipEditor(true);
                        }
                      }}
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
              
              {/* Automation Lane */}
              {showAutomation.has(track.id) && (
                <div className="h-20 border-b border-slate-800 bg-slate-950/50 relative" style={{ width: `${timelineWidth}px` }}>
                  {/* Grid lines */}
                  {Array.from({ length: 201 }).map((_, i) => (
                    <div
                      key={i}
                      className="absolute top-0 bottom-0 border-l border-slate-800/30"
                      style={{ left: `${i * zoom}px` }}
                    />
                  ))}
                  
                  {/* Parameter selector and automation curve */}
                  <div className="absolute top-1 left-2 z-10">
                    <select
                      value={automationMode[track.id] || 'volume'}
                      onChange={(e) => setAutomationMode({...automationMode, [track.id]: e.target.value as 'volume' | 'pan'})}
                      className="text-xs bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white"
                    >
                      <option value="volume">Volume</option>
                      <option value="pan">Pan</option>
                    </select>
                  </div>
                  
                  {/* Automation line (horizontal at 50% for now) */}
                  <div 
                    className={`absolute left-0 right-0 h-0.5 ${
                      automationMode[track.id] === 'pan' ? 'bg-yellow-500' : 'bg-cyan-500'
                    }`}
                    style={{ top: '50%' }}
                  >
                    {/* Example automation points */}
                    <div className="absolute w-2 h-2 rounded-full bg-white -ml-1 -mt-1 cursor-pointer" style={{ left: '10%' }} />
                    <div className="absolute w-2 h-2 rounded-full bg-white -ml-1 -mt-1 cursor-pointer" style={{ left: '50%' }} />
                    <div className="absolute w-2 h-2 rounded-full bg-white -ml-1 -mt-1 cursor-pointer" style={{ left: '80%' }} />
                  </div>
                  
                  <div className="absolute bottom-1 left-2 text-[10px] text-gray-600">
                    {automationMode[track.id] === 'pan' ? 'L ← → R' : '0% ↑ 100%'}
                  </div>
                </div>
              )}
              </React.Fragment>
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
                    
                    {/* VU Meter */}
                    <div className="flex gap-2 mb-4">
                      <div className="flex-1 h-32 bg-slate-950 rounded relative border border-slate-700 overflow-hidden">
                        {/* Peak hold indicator */}
                        {peakLevels[track.id] > 0 && (
                          <div 
                            className="absolute left-0 right-0 h-0.5 bg-white transition-all duration-100"
                            style={{ bottom: `${(peakLevels[track.id] || 0) * 100}%` }}
                          />
                        )}
                        {/* Active level */}
                        <div 
                          className="absolute bottom-0 left-0 right-0 transition-all duration-75"
                          style={{ 
                            height: `${(audioLevels[track.id] || 0) * 100}%`,
                            background: (audioLevels[track.id] || 0) > 0.85 
                              ? 'linear-gradient(to top, #ef4444, #f97316)' 
                              : (audioLevels[track.id] || 0) > 0.65
                              ? 'linear-gradient(to top, #eab308, #f59e0b)'
                              : 'linear-gradient(to top, #22c55e, #10b981)'
                          }}
                        />
                        {/* Scale marks */}
                        <div className="absolute top-0 right-0 text-[8px] text-gray-600 pr-0.5">0</div>
                        <div className="absolute top-[35%] right-0 text-[8px] text-gray-600 pr-0.5">-12</div>
                        <div className="absolute bottom-0 right-0 text-[8px] text-gray-600 pr-0.5">-∞</div>
                      </div>
                      
                      {/* Vertical Fader */}
                      <div className="w-8 h-32 bg-slate-950 rounded-full relative border border-slate-700">
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

      {/* Clip Editor Panel */}
      {showClipEditor && selectedClipId && (
        <div className="h-56 border-t border-slate-800 bg-[#1a1a1a] flex flex-col">
          <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Scissors size={18} className="text-cyan-400" />
              <h3 className="text-base font-semibold text-white">Clip Editor</h3>
              <span className="text-xs text-gray-500">
                {tracks
                  .flatMap(t => t.clips)
                  .find(c => c.id === selectedClipId)?.id.slice(0, 8) || 'No clip'}
              </span>
              <div className="flex items-center gap-2 ml-4">
                <span className="text-xs text-gray-400">Waveform Zoom:</span>
                <button
                  onClick={() => setWaveformZoom(Math.max(0.5, waveformZoom - 0.25))}
                  className="w-6 h-6 bg-slate-800 hover:bg-slate-700 rounded flex items-center justify-center text-white"
                >
                  -
                </button>
                <span className="text-xs text-cyan-400 font-mono w-12 text-center">{(waveformZoom * 100).toFixed(0)}%</span>
                <button
                  onClick={() => setWaveformZoom(Math.min(4, waveformZoom + 0.25))}
                  className="w-6 h-6 bg-slate-800 hover:bg-slate-700 rounded flex items-center justify-center text-white"
                >
                  +
                </button>
              </div>
            </div>
            <button
              onClick={() => {
                setShowClipEditor(false);
                setSelectedClipId(null);
              }}
              className="text-gray-400 hover:text-white transition-colors"
            >
              ✕
            </button>
          </div>
          
          <div className="flex-1 p-6">
            <div className="grid grid-cols-3 gap-6 h-full">
              {/* Trim Controls */}
              <div className="bg-slate-900 rounded-lg p-4 border border-slate-800">
                <h4 className="text-sm font-semibold text-cyan-400 mb-3">Trim</h4>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Start Time</label>
                    <input
                      type="number"
                      step="0.1"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-white text-sm focus:border-cyan-500 focus:outline-none"
                      placeholder="0.0s"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">End Time</label>
                    <input
                      type="number"
                      step="0.1"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-white text-sm focus:border-cyan-500 focus:outline-none"
                      placeholder="Auto"
                    />
                  </div>
                </div>
              </div>

              {/* Fade Controls */}
              <div className="bg-slate-900 rounded-lg p-4 border border-slate-800">
                <h4 className="text-sm font-semibold text-cyan-400 mb-3">Fades</h4>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Fade In</label>
                    <input
                      type="range"
                      min="0"
                      max="5"
                      step="0.1"
                      defaultValue="0"
                      className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-cyan-400"
                    />
                    <div className="text-xs text-gray-500 text-center mt-1">0.0s</div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Fade Out</label>
                    <input
                      type="range"
                      min="0"
                      max="5"
                      step="0.1"
                      defaultValue="0"
                      className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-cyan-400"
                    />
                    <div className="text-xs text-gray-500 text-center mt-1">0.0s</div>
                  </div>
                </div>
              </div>

              {/* Gain & Pitch Controls */}
              <div className="bg-slate-900 rounded-lg p-4 border border-slate-800">
                <h4 className="text-sm font-semibold text-cyan-400 mb-3">Adjustments</h4>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Gain</label>
                    <input
                      type="range"
                      min="-20"
                      max="20"
                      step="1"
                      defaultValue="0"
                      className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-cyan-400"
                    />
                    <div className="text-xs text-gray-500 text-center mt-1">0 dB</div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Pitch</label>
                    <input
                      type="range"
                      min="-12"
                      max="12"
                      step="1"
                      defaultValue="0"
                      className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-cyan-400"
                    />
                    <div className="text-xs text-gray-500 text-center mt-1">0 st</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

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
                  <div className="flex justify-between">
                    <span className="text-gray-400">Metronome</span>
                    <kbd className="px-2 py-1 bg-slate-900 text-cyan-400 rounded font-mono">C</kbd>
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
                    <span className="text-gray-400">History Panel</span>
                    <kbd className="px-2 py-1 bg-slate-900 text-cyan-400 rounded font-mono">H</kbd>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-white mb-3 uppercase tracking-wider">Edit</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Undo</span>
                    <kbd className="px-2 py-1 bg-slate-900 text-cyan-400 rounded font-mono">Cmd+Z</kbd>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Redo</span>
                    <kbd className="px-2 py-1 bg-slate-900 text-cyan-400 rounded font-mono">Cmd+Shift+Z</kbd>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Duplicate Clip</span>
                    <kbd className="px-2 py-1 bg-slate-900 text-cyan-400 rounded font-mono">Cmd+D</kbd>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Delete Clip</span>
                    <kbd className="px-2 py-1 bg-slate-900 text-cyan-400 rounded font-mono">Del</kbd>
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
          <div className="bg-slate-950 border border-cyan-500/30 rounded-xl p-8 max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-2xl font-bold text-cyan-400">AI Music Generation</h2>
                <p className="text-sm text-gray-400 mt-1">Create professional tracks with AI</p>
              </div>
              <button
                onClick={() => setShowGenerateModal(false)}
                className="text-gray-400 hover:text-white text-2xl"
              >
                ✕
              </button>
            </div>
            
            <form className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">Track Prompt</label>
                <textarea
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-4 text-white focus:border-cyan-500 focus:outline-none resize-none"
                  rows={4}
                  placeholder="Describe your track in detail... (e.g., 'Lo-fi hip hop beat with vinyl crackle, warm rhodes piano, and mellow drums')"
                />
                <div className="flex justify-between items-center mt-2">
                  <span className="text-xs text-gray-500">Be specific for better results</span>
                  <span className="text-xs text-cyan-400">Powered by AI</span>
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2">Genre</label>
                  <select className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:border-cyan-500 focus:outline-none">
                    <option value="lofi">Lo-fi</option>
                    <option value="hiphop">Hip Hop</option>
                    <option value="electronic">Electronic</option>
                    <option value="jazz">Jazz</option>
                    <option value="rnb">R&B</option>
                    <option value="techno">Techno</option>
                    <option value="ambient">Ambient</option>
                    <option value="trap">Trap</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2">BPM</label>
                  <input
                    type="number"
                    defaultValue={120}
                    min={60}
                    max={200}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:border-cyan-500 focus:outline-none"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2">Duration</label>
                  <select className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:border-cyan-500 focus:outline-none">
                    <option value="30">30 seconds</option>
                    <option value="60">1 minute</option>
                    <option value="90">1.5 minutes</option>
                    <option value="120">2 minutes</option>
                  </select>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">Lyrics (Optional)</label>
                <textarea
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-4 text-white focus:border-cyan-500 focus:outline-none resize-none font-mono text-sm"
                  rows={5}
                  placeholder="Enter custom lyrics here...

Verse 1:
...

Chorus:
..."
                />
                <div className="text-xs text-gray-500 mt-2">Leave empty for instrumental track</div>
              </div>
              
              <div className="bg-slate-900 border border-slate-700 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-300">Advanced Options</h3>
                  <button type="button" className="text-xs text-cyan-400 hover:text-cyan-300">Toggle</button>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="instrumental" className="accent-cyan-500" />
                    <label htmlFor="instrumental" className="text-gray-400">Instrumental only</label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="loopable" className="accent-cyan-500" defaultChecked />
                    <label htmlFor="loopable" className="text-gray-400">Make loopable</label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="mastering" className="accent-cyan-500" defaultChecked />
                    <label htmlFor="mastering" className="text-gray-400">Auto-mastering</label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="stereo" className="accent-cyan-500" defaultChecked />
                    <label htmlFor="stereo" className="text-gray-400">Stereo output</label>
                  </div>
                </div>
              </div>
              
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    const promptInput = document.querySelector('textarea[placeholder*="Describe your track"]') as HTMLTextAreaElement;
                    const genreSelect = document.querySelector('select') as HTMLSelectElement;
                    const bpmInput = document.querySelector('input[type="number"]') as HTMLInputElement;
                    if (promptInput && genreSelect && bpmInput) {
                      handleGenerateTrack(promptInput.value, genreSelect.value, parseInt(bpmInput.value));
                    }
                  }}
                  disabled={generatingTrack}
                  className="flex-1 py-4 bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-600 hover:to-teal-600 text-black font-bold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-cyan-500/50"
                >
                  {generatingTrack ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="animate-spin">⚙</span>
                      Generating Track...
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      ✨ Generate Track
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setShowGenerateModal(false)}
                  className="px-6 py-4 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
              
              {generatingTrack && (
                <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse"></div>
                    <span className="text-cyan-400 font-semibold">AI Processing</span>
                  </div>
                  <div className="text-sm text-gray-400">
                    Creating your track... This may take 30-60 seconds
                  </div>
                  <div className="mt-3 bg-slate-900 rounded-full h-2 overflow-hidden">
                    <div className="bg-gradient-to-r from-cyan-500 to-teal-500 h-full animate-pulse" style={{width: '60%'}}></div>
                  </div>
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      {/* History Panel */}
      {showHistoryPanel && (
        <div className="fixed right-4 top-20 w-80 bg-slate-950 border border-cyan-500/30 rounded-xl p-4 shadow-2xl z-50 max-h-96 overflow-y-auto">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-cyan-400">History</h3>
            <button
              onClick={() => setShowHistoryPanel(false)}
              className="text-gray-400 hover:text-white"
            >
              ✕
            </button>
          </div>
          
          <div className="flex gap-2 mb-4">
            <button
              onClick={handleUndo}
              className="flex-1 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded text-sm transition-colors"
              title="Undo (Cmd+Z)"
            >
              ↶ Undo
            </button>
            <button
              onClick={handleRedo}
              className="flex-1 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded text-sm transition-colors"
              title="Redo (Cmd+Shift+Z)"
            >
              ↷ Redo
            </button>
          </div>
          
          <div className="space-y-2">
            {history.length === 0 ? (
              <div className="text-gray-500 text-sm text-center py-4">No actions yet</div>
            ) : (
              history.slice().reverse().map((item, index) => (
                <div key={index} className="bg-slate-900 p-3 rounded text-sm">
                  <div className="text-white font-medium">{item.action}</div>
                  <div className="text-gray-500 text-xs mt-1">
                    {new Date(item.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-slate-950 border border-purple-500/30 rounded-xl p-8 max-w-lg w-full">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-purple-400">Export Audio</h2>
              <button
                onClick={() => setShowExportModal(false)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Export Range</label>
                <select className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:border-purple-500 focus:outline-none">
                  <option>Full Project</option>
                  <option>Loop Region</option>
                  <option>Selected Clips</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm text-gray-400 mb-2">Format</label>
                <select className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:border-purple-500 focus:outline-none">
                  <option>WAV 24-bit</option>
                  <option>WAV 16-bit</option>
                  <option>MP3 320kbps</option>
                  <option>FLAC</option>
                </select>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Title</label>
                  <input
                    type="text"
                    placeholder="My Track"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:border-purple-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Artist</label>
                  <input
                    type="text"
                    placeholder="Artist Name"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:border-purple-500 focus:outline-none"
                  />
                </div>
              </div>
              
              <button
                type="button"
                className="w-full py-3 bg-purple-500 hover:bg-purple-600 text-white font-semibold rounded-lg transition-colors"
                onClick={() => {
                  alert('Export feature coming soon! Will bounce audio and trigger download.');
                  setShowExportModal(false);
                }}
              >
                Export & Download
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-slate-950 border border-cyan-500/30 rounded-xl p-8 max-w-lg w-full">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-cyan-400">Import Audio</h2>
              <button
                onClick={() => {
                  setShowImportModal(false);
                  setImportFile(null);
                }}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Select Audio File</label>
                <input
                  type="file"
                  accept="audio/*"
                  onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:border-cyan-500 focus:outline-none file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-cyan-500 file:text-black file:cursor-pointer hover:file:bg-cyan-600"
                />
                <div className="text-xs text-gray-500 mt-2">
                  Supported: MP3, WAV, OGG, M4A
                </div>
              </div>
              
              {importFile && (
                <div className="bg-slate-900 p-4 rounded-lg">
                  <div className="text-white font-medium">{importFile.name}</div>
                  <div className="text-gray-500 text-xs mt-1">
                    Size: {(importFile.size / 1024 / 1024).toFixed(2)} MB
                  </div>
                </div>
              )}
              
              <button
                type="button"
                onClick={handleImport}
                disabled={!importFile || uploading}
                className="w-full py-3 bg-cyan-500 hover:bg-cyan-600 text-black font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {uploading ? 'Uploading...' : 'Import to Library'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
