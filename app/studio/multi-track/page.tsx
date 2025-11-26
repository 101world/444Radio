'use client';

import { useEffect, useRef, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { MultiTrackDAW } from '@/lib/audio/MultiTrackDAW';
import { ProfessionalWaveformRenderer } from '@/lib/audio/ProfessionalWaveformRenderer';
import { HistoryManager } from '@/lib/audio/HistoryManager';
import { RecordingManager } from '@/lib/audio/RecordingManager';
import { ProjectManager } from '@/lib/audio/ProjectManager';
import { AudioExporter } from '@/lib/audio/AudioExporter';
import type { Track } from '@/lib/audio/TrackManager';

// Helper function to render waveform on canvas
function renderWaveform(canvas: HTMLCanvasElement, audioBuffer: AudioBuffer, color: string) {
  const renderer = new ProfessionalWaveformRenderer(canvas, {
    width: canvas.width,
    height: canvas.height,
    backgroundColor: 'transparent',
    waveColor: color,
    progressColor: color + '80',
    showRMS: true,
    showPeaks: true
  });

  // Generate waveform data
  const samplesPerPixel = Math.ceil(audioBuffer.length / canvas.width);
  renderer.generateWaveformData(audioBuffer, samplesPerPixel);
  
  // Render the waveform
  renderer.render();
}

export default function MultiTrackStudioV4() {
  const { user } = useUser();
  const [daw, setDaw] = useState<MultiTrackDAW | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playhead, setPlayhead] = useState(0);
  const [bpm, setBpm] = useState(120);
  const [zoom, setZoom] = useState(50); // Pixels per second (default 50)
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [showMixer, setShowMixer] = useState(true);
  const [showEffects, setShowEffects] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [loopEnabled, setLoopEnabled] = useState(false);
  const [loopStart, setLoopStart] = useState(0);
  const [loopEnd, setLoopEnd] = useState(10);
  const [draggedClip, setDraggedClip] = useState<{clipId: string, trackId: string} | null>(null);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [selectedColorTrackId, setSelectedColorTrackId] = useState<string | null>(null);
  const [userProjects, setUserProjects] = useState<any[]>([]);
  const rafRef = useRef<number | undefined>(undefined);
  const timelineRef = useRef<HTMLDivElement>(null);
  const historyManagerRef = useRef<HistoryManager | null>(null);
  const recordingManagerRef = useRef<RecordingManager | null>(null);
  const projectManagerRef = useRef<ProjectManager | null>(null);
  const audioExporterRef = useRef<AudioExporter | null>(null);

  // Initialize DAW and Managers
  useEffect(() => {
    const dawInstance = new MultiTrackDAW({
      sampleRate: 48000,
      bpm: 120,
      userId: user?.id,
      timeSignature: { numerator: 4, denominator: 4 }
    });

    setDaw(dawInstance);
    setTracks(dawInstance.getTracks());

    // Initialize managers
    historyManagerRef.current = new HistoryManager();
    recordingManagerRef.current = new RecordingManager(dawInstance.getAudioContext());
    projectManagerRef.current = new ProjectManager();
    audioExporterRef.current = new AudioExporter();

    // Initialize recording manager
    recordingManagerRef.current.initialize().then(() => {
      console.log('[MultiTrack] Recording manager initialized');
    }).catch(err => {
      console.error('[MultiTrack] Recording init failed:', err);
    });

    // Listen for track changes
    dawInstance.on('trackCreated', (track: Track) => {
      setTracks(dawInstance.getTracks());
    });

    dawInstance.on('trackDeleted', () => {
      setTracks(dawInstance.getTracks());
    });

    return () => {
      dawInstance.dispose();
      recordingManagerRef.current?.dispose();
    };
  }, [user?.id]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      
      switch(e.key.toLowerCase()) {
        case ' ':
          e.preventDefault();
          togglePlay();
          break;
        case 's':
          if (e.metaKey || e.ctrlKey) {
            e.preventDefault();
            setShowSaveModal(true);
          } else {
            stop();
          }
          break;
        case 'delete':
        case 'backspace':
          if (selectedClipId && selectedTrackId) {
            handleDeleteClip();
          }
          break;
        case 'z':
          if (e.metaKey || e.ctrlKey) {
            e.preventDefault();
            handleUndo();
          }
          break;
        case 'e':
          if (e.metaKey || e.ctrlKey) {
            e.preventDefault();
            handleSplitClip();
          }
          break;
        case '?':
          e.preventDefault();
          setShowShortcuts(true);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedClipId, selectedTrackId, daw]);

  // Playhead animation
  useEffect(() => {
    if (!daw) return;

    const updatePlayhead = (time: number) => {
      setPlayhead(time);
    };

    const loop = () => {
      setPlayhead(daw.getPlayhead());
      setIsPlaying(daw.isPlaying());
      rafRef.current = requestAnimationFrame(loop);
    };

    // Listen to playhead updates from DAW
    daw.on('playheadUpdate', updatePlayhead);
    daw.on('play', () => setIsPlaying(true));
    daw.on('pause', () => setIsPlaying(false));
    daw.on('stop', () => {
      setIsPlaying(false);
      setPlayhead(0);
    });

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      daw.off('playheadUpdate', updatePlayhead);
    };
  }, [daw]);

  const togglePlay = () => {
    if (!daw) return;
    if (isPlaying) {
      daw.pause();
    } else {
      daw.play();
    }
  };

  const stop = () => {
    if (!daw) return;
    daw.stop();
  };

  const addTrack = () => {
    if (!daw) return;
    const track = daw.createTrack(`Track ${tracks.length + 1}`);
    setTracks(daw.getTracks());
    setSelectedTrackId(track.id);
  };

  const deleteTrack = (trackId: string) => {
    if (!daw) return;
    daw.deleteTrack(trackId);
    setTracks(daw.getTracks());
    if (selectedTrackId === trackId) {
      setSelectedTrackId(null);
    }
  };

  const updateBpm = (newBpm: number) => {
    if (!daw) return;
    daw.setBPM(newBpm);
    setBpm(newBpm);
  };

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || !daw) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const arrayBuffer = await file.arrayBuffer();
      
      try {
        const audioContext = daw.getAudioContext();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        const trackName = file.name.replace(/\.(mp3|wav|m4a|ogg)$/i, '');
        
        // Create track
        const track = daw.createTrack(trackName);
        
        // Add clip with audio buffer
        daw.addClipToTrack(track.id, {
          buffer: audioBuffer,
          name: trackName,
          startTime: 0,
          duration: audioBuffer.duration
        });
        
        console.log(`✅ Loaded ${trackName} - duration: ${audioBuffer.duration.toFixed(2)}s, ${track.clips?.length || 0} clip(s)`);
        
        setTracks(daw.getTracks());
        setSelectedTrackId(track.id);
      } catch (error) {
        console.error('Failed to decode audio file:', error);
        alert(`Failed to load ${file.name}. Make sure it's a valid audio file.`);
      }
    }
  };

  const updateTrackVolume = (trackId: string, volume: number) => {
    if (!daw) return;
    daw.setTrackVolume(trackId, volume / 100);
    setTracks(daw.getTracks());
  };

  const updateTrackPan = (trackId: string, pan: number) => {
    if (!daw) return;
    daw.setTrackPan(trackId, pan / 100);
    setTracks(daw.getTracks());
  };

  const toggleMute = (trackId: string) => {
    if (!daw) return;
    daw.toggleTrackMute(trackId);
    setTracks(daw.getTracks());
  };

  const toggleSolo = (trackId: string) => {
    if (!daw) return;
    daw.toggleTrackSolo(trackId);
    setTracks(daw.getTracks());
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleClipClick = (e: React.MouseEvent, clipId: string, trackId: string) => {
    e.stopPropagation();
    setSelectedClipId(clipId);
    setSelectedTrackId(trackId);
  };

  const handleRulerClick = (e: React.MouseEvent) => {
    if (!daw || !timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const timeInSeconds = clickX / zoom;
    
    // Update playhead position
    if (daw.isPlaying()) {
      daw.pause();
    }
    // Seek to clicked position (would need seek method in DAW)
    console.log(`Seek to: ${timeInSeconds.toFixed(2)}s`);
  };

  const handleZoomChange = (newZoom: number) => {
    setZoom(newZoom);
  };

  const handleDeleteClip = () => {
    if (!daw || !selectedClipId || !selectedTrackId) return;
    daw.removeClipFromTrack(selectedTrackId, selectedClipId);
    setSelectedClipId(null);
    setTracks(daw.getTracks());
  };

  const handleSplitClip = () => {
    if (!daw || !selectedClipId || !selectedTrackId) return;
    const track = tracks.find(t => t.id === selectedTrackId);
    const clip = track?.clips.find(c => c.id === selectedClipId);
    if (!clip || playhead < clip.startTime || playhead > clip.startTime + clip.duration) {
      alert('Playhead must be within the selected clip to split');
      return;
    }
    // Split logic would use NonDestructiveEditor
    console.log('Split clip at', playhead);
  };

  const handleUndo = () => {
    if (!historyManagerRef.current) return;
    const success = historyManagerRef.current.undo();
    if (success) {
      setTracks(daw?.getTracks() || []);
    }
  };

  const handleRedo = () => {
    if (!historyManagerRef.current) return;
    const success = historyManagerRef.current.redo();
    if (success) {
      setTracks(daw?.getTracks() || []);
    }
  };

  const toggleRecording = async () => {
    if (!recordingManagerRef.current || !daw) return;
    
    if (isRecording) {
      // Stop recording
        try {
          const blob = await recordingManagerRef.current.stopRecording();
          if (blob) {
            // Convert blob to AudioBuffer
            const arrayBuffer = await blob.arrayBuffer();
            const audioBuffer = await daw.getAudioContext().decodeAudioData(arrayBuffer);          // Create new track with recorded audio
          const track = daw.createTrack(`Recording ${new Date().toLocaleTimeString()}`);
          daw.addClipToTrack(track.id, {
            buffer: audioBuffer,
            name: `Recorded ${new Date().toLocaleTimeString()}`,
            startTime: 0,
            duration: audioBuffer.duration
          });
          setTracks(daw.getTracks());
          alert('Recording saved to new track!');
        }
      } catch (err) {
        console.error('Recording failed:', err);
        alert('Failed to process recording');
      }
      setIsRecording(false);
    } else {
      // Start recording
      try {
        await recordingManagerRef.current.startRecording();
        setIsRecording(true);
      } catch (err) {
        console.error('Recording start failed:', err);
        alert('Failed to start recording. Please check microphone permissions.');
      }
    }
  };

  const handleSaveProject = async (projectName: string) => {
    if (!projectManagerRef.current || !daw || !user?.id) return;
    
    try {
      const projectId = await projectManagerRef.current.saveProject({
        userId: user.id,
        name: projectName,
        bpm,
        timeSignature: { numerator: 4, denominator: 4 },
        tracks,
        markers: [],
        version: 1
      });
      
      alert(`Project "${projectName}" saved successfully!`);
      setShowSaveModal(false);
    } catch (error: any) {
      console.error('Save failed:', error);
      alert(`Failed to save project: ${error.message}`);
    }
  };

  const handleLoadProject = async (projectId: string) => {
    if (!projectManagerRef.current || !daw || !user?.id) return;
    
    try {
      const project = await projectManagerRef.current.loadProject(projectId);
      
      // Clear current DAW state
      daw.dispose();
      
      // Reinitialize with loaded project
      const newDaw = new MultiTrackDAW({
        sampleRate: 48000,
        bpm: project.bpm,
        userId: user.id,
        timeSignature: project.timeSignature
      });
      
      setDaw(newDaw);
      setBpm(project.bpm);
      setTracks(project.tracks);
      alert(`Project "${project.name}" loaded successfully!`);
      setShowLoadModal(false);
    } catch (error: any) {
      console.error('Load failed:', error);
      alert(`Failed to load project: ${error.message}`);
    }
  };

  const handleExport = async (format: 'wav' | 'mp3', quality: string) => {
    if (!audioExporterRef.current || !daw) return;
    
    try {
      // Render all tracks to single buffer (would need renderToBuffer method in DAW)
      // For now, just get the first track's first clip as demo
      const firstTrack = tracks[0];
      const firstClip = firstTrack?.clips[0];
      
      if (!firstClip?.buffer) {
        alert('No audio to export. Please add tracks first.');
        return;
      }
      
      // Parse quality to sample rate
      const sampleRate = quality === '96000' ? 96000 : quality === '48000' ? 48000 : 44100;
      const bitDepth = format === 'wav' && quality.includes('24') ? 24 : 16;
      
      const result = await audioExporterRef.current.exportAudio(
        firstClip.buffer,
        { format, sampleRate, bitDepth },
        `export-${Date.now()}.${format}`
      );
      
      if (result.success && result.blob) {
        audioExporterRef.current.downloadBlob(
          result.blob,
          `444Radio-Export-${Date.now()}.${format}`
        );
        alert('Export complete! Download started.');
      } else {
        alert(`Export failed: ${result.error}`);
      }
    } catch (error) {
      console.error('Export error:', error);
      alert('Export failed. See console for details.');
    } finally {
      setShowExportModal(false);
    }
  };

  const handleTrackColorChange = (trackId: string, color: string) => {
    if (!daw) return;
    const track = daw.getTracks().find(t => t.id === trackId);
    if (track) {
      track.color = color;
      setTracks(daw.getTracks());
      setShowColorPicker(false);
      setSelectedColorTrackId(null);
    }
  };

  const snapTime = (time: number) => {
    if (!snapToGrid) return time;
    const beatDuration = 60 / bpm;
    return Math.round(time / beatDuration) * beatDuration;
  };

  return (
    <div className="h-screen flex flex-col bg-[#0a0a0a] text-gray-200">
      {/* Top Toolbar */}
      <header className="h-14 bg-[#141414] border-b border-[#1f1f1f] flex items-center px-5 gap-5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-gradient-to-br from-cyan-500 to-cyan-700 flex items-center justify-center text-lg">
            🎵
          </div>
          <div>
            <div className="text-sm font-bold text-white">444 Radio Studio v4.0</div>
            <div className="text-xs text-gray-600">Professional DAW</div>
          </div>
        </div>

        <div className="w-px h-8 bg-[#2a2a2a] mx-2" />

        {/* Transport Controls */}
        <div className="flex gap-2 items-center">
          <button
            onClick={handleUndo}
            className="w-8 h-8 bg-[#1f1f1f] border border-[#2a2a2a] text-gray-500 rounded hover:bg-[#252525] transition-all"
            title="Undo (Cmd+Z)"
          >
            ↶
          </button>
          <button
            onClick={handleRedo}
            className="w-8 h-8 bg-[#1f1f1f] border border-[#2a2a2a] text-gray-500 rounded hover:bg-[#252525] transition-all"
            title="Redo (Cmd+Shift+Z)"
          >
            ↷
          </button>
          
          <div className="w-px h-8 bg-[#2a2a2a] mx-1" />
          
          <button
            onClick={stop}
            className="w-8 h-8 bg-[#1f1f1f] border border-[#2a2a2a] text-gray-500 rounded hover:bg-[#252525] transition-all"
            title="Stop (S)"
          >
            ⏹
          </button>
          
          <button
            onClick={togglePlay}
            className={`w-10 h-8 rounded font-bold transition-all ${
              isPlaying
                ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/30'
                : 'bg-[#1f1f1f] border border-[#2a2a2a] text-gray-500 hover:bg-[#252525]'
            }`}
            title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
          >
            {isPlaying ? '⏸' : '▶'}
          </button>
          
          <button
            onClick={toggleRecording}
            className={`w-8 h-8 rounded-full font-bold transition-all ${
              isRecording
                ? 'bg-red-500 text-white animate-pulse'
                : 'bg-[#1f1f1f] border border-[#2a2a2a] text-red-400 hover:bg-[#252525]'
            }`}
            title="Record (R)"
          >
            ●
          </button>
        </div>

        <div className="w-px h-8 bg-[#2a2a2a] mx-2" />

        {/* Playhead Display */}
        <div className="flex items-center gap-2">
          <div className="text-sm font-mono text-cyan-400">{formatTime(playhead)}</div>
          <div className="text-xs text-gray-600">|</div>
          <div className="text-xs text-gray-500">{bpm} BPM</div>
        </div>

        <div className="w-px h-8 bg-[#2a2a2a] mx-2" />

        {/* Zoom Control */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-gray-600">🔍</span>
          <input
            type="range"
            min="10"
            max="200"
            value={zoom}
            onChange={(e) => handleZoomChange(parseInt(e.target.value))}
            className="w-24 h-1"
            title="Timeline zoom (pixels per second)"
          />
          <span className="text-cyan-400 font-mono w-12">{zoom}px</span>
        </div>

        <div className="w-px h-8 bg-[#2a2a2a] mx-2" />

        {/* Loop & Snap Controls */}
        <div className="flex gap-2">
          <button
            onClick={() => setLoopEnabled(!loopEnabled)}
            className={`px-2 py-1 text-xs rounded transition-all ${
              loopEnabled ? 'bg-cyan-500 text-black' : 'bg-[#1f1f1f] text-gray-400 hover:bg-[#252525]'
            }`}
            title="Loop region"
          >
            🔁
          </button>
          <button
            onClick={() => setSnapToGrid(!snapToGrid)}
            className={`px-2 py-1 text-xs rounded transition-all ${
              snapToGrid ? 'bg-cyan-500 text-black' : 'bg-[#1f1f1f] text-gray-400 hover:bg-[#252525]'
            }`}
            title="Snap to grid"
          >
            🧲
          </button>
        </div>

        <div className="flex-1" />

        {/* Project Controls */}
        <div className="flex gap-2 mr-2">
          <button
            onClick={() => setShowSaveModal(true)}
            className="px-3 py-1.5 text-xs rounded bg-[#1f1f1f] text-gray-400 hover:bg-[#252525] transition-all"
            title="Save project (Cmd+S)"
          >
            💾 Save
          </button>
          <button
            onClick={() => setShowLoadModal(true)}
            className="px-3 py-1.5 text-xs rounded bg-[#1f1f1f] text-gray-400 hover:bg-[#252525] transition-all"
          >
            📂 Load
          </button>
          <button
            onClick={() => setShowExportModal(true)}
            className="px-3 py-1.5 text-xs rounded bg-cyan-500 text-black hover:bg-cyan-400 transition-all"
          >
            📤 Export
          </button>
        </div>

        {/* View Toggles */}
        <div className="flex gap-2">
          <button
            onClick={() => setShowMixer(!showMixer)}
            className={`px-3 py-1.5 text-xs rounded transition-all ${
              showMixer
                ? 'bg-cyan-500 text-black'
                : 'bg-[#1f1f1f] text-gray-400 hover:bg-[#252525]'
            }`}
          >
            🎛️ Mixer
          </button>
          <button
            onClick={() => setShowEffects(!showEffects)}
            className={`px-3 py-1.5 text-xs rounded transition-all ${
              showEffects
                ? 'bg-cyan-500 text-black'
                : 'bg-[#1f1f1f] text-gray-400 hover:bg-[#252525]'
            }`}
          >
            🎚️ Effects
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Track List */}
        <div className="w-64 bg-[#0f0f0f] border-r border-[#1f1f1f] flex flex-col">
          <div className="p-4 border-b border-[#1f1f1f] space-y-2">
            <button
              onClick={addTrack}
              className="w-full py-2 bg-cyan-500 text-black rounded font-semibold text-sm hover:bg-cyan-400 transition-colors"
            >
              ➕ Add Track
            </button>
            
            <input
              type="file"
              id="audio-upload"
              accept="audio/*"
              multiple
              className="hidden"
              onChange={(e) => handleFileUpload(e.target.files)}
            />
            <button
              onClick={() => document.getElementById('audio-upload')?.click()}
              className="w-full py-2 bg-[#1f1f1f] text-cyan-400 border border-cyan-500/30 rounded font-semibold text-sm hover:bg-cyan-500/10 transition-colors"
            >
              📁 Upload Audio
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {tracks.length === 0 ? (
              <div className="p-4 text-center text-gray-600 text-sm">
                No tracks yet<br />Click "Add Track" to start
              </div>
            ) : (
              tracks.map((track) => (
                <div
                  key={track.id}
                  className={`p-3 border-b border-[#1a1a1a] cursor-pointer transition-colors ${
                    selectedTrackId === track.id
                      ? 'bg-cyan-500/10 border-l-4 border-l-cyan-500'
                      : 'hover:bg-[#141414]'
                  }`}
                  onClick={() => setSelectedTrackId(track.id)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedColorTrackId(track.id);
                          setShowColorPicker(true);
                        }}
                        className="w-3 h-3 rounded-full border border-white/30 hover:ring-2 hover:ring-white/50"
                        style={{ backgroundColor: track.color }}
                        title="Change color"
                      />
                      <span className="text-sm font-medium text-white">
                        {track.name}
                      </span>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleMute(track.id);
                        }}
                        className={`px-1.5 py-0.5 text-[10px] rounded ${
                          track.muted
                            ? 'bg-red-500 text-white'
                            : 'bg-[#1f1f1f] text-gray-500 hover:bg-[#252525]'
                        }`}
                        title="Mute"
                      >
                        M
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSolo(track.id);
                        }}
                        className={`px-1.5 py-0.5 text-[10px] rounded ${
                          track.solo
                            ? 'bg-yellow-500 text-black'
                            : 'bg-[#1f1f1f] text-gray-500 hover:bg-[#252525]'
                        }`}
                        title="Solo"
                      >
                        S
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteTrack(track.id);
                        }}
                        className="text-red-400 hover:text-red-300 text-xs"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                    <span className="px-1.5 py-0.5 bg-[#1f1f1f] rounded">
                      {track.type.toUpperCase()}
                    </span>
                    <span>{track.clips.length} clips</span>
                  </div>

                  {/* Mini volume fader */}
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-600">Vol</span>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={track.volume * 100}
                      onChange={(e) => {
                        e.stopPropagation();
                        updateTrackVolume(track.id, parseInt(e.target.value));
                      }}
                      className="flex-1 h-1"
                      onClick={(e) => e.stopPropagation()}
                    />
                    <span className="text-[10px] text-gray-600 w-8">{Math.round(track.volume * 100)}%</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Timeline Area */}
        <div className="flex-1 flex flex-col bg-[#0a0a0a] overflow-auto" ref={timelineRef}>
          {/* Timeline Ruler */}
          <div 
            className="h-8 bg-[#0f0f0f] border-b border-[#1f1f1f] flex items-center px-2 text-xs text-gray-500 cursor-pointer hover:bg-[#141414]"
            onClick={handleRulerClick}
            title="Click to seek"
          >
            {Array.from({ length: Math.ceil(600 / zoom) + 1 }, (_, i) => i).map(sec => (
              <div key={sec} className="flex-shrink-0 border-l border-[#1f1f1f] pl-1" style={{ width: `${zoom}px` }}>
                {sec}s
              </div>
            ))}
          </div>

          {/* Track Lanes */}
          <div className="flex-1 relative">
            {/* Grid Lines (when snap enabled) */}
            {snapToGrid && (
              <div className="absolute inset-0 pointer-events-none">
                {Array.from({ length: Math.ceil(600 / zoom) * 4 }, (_, i) => {
                  const beatWidth = (60 / bpm) * zoom;
                  return (
                    <div
                      key={i}
                      className="absolute top-0 bottom-0 border-l border-cyan-500/10"
                      style={{ left: `${i * beatWidth}px` }}
                    />
                  );
                })}
              </div>
            )}
            
            {/* Loop Region Indicator */}
            {loopEnabled && (
              <div
                className="absolute top-0 bottom-0 bg-cyan-500/5 border-x-2 border-cyan-500/30 pointer-events-none"
                style={{
                  left: `${loopStart * zoom}px`,
                  width: `${(loopEnd - loopStart) * zoom}px`
                }}
              />
            )}
            
            {tracks.length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-600">
                <div className="text-center">
                  <div className="text-4xl mb-4">🎵</div>
                  <div className="text-lg mb-2">No tracks yet</div>
                  <div className="text-sm">Click "Upload Audio" to add your first track</div>
                </div>
              </div>
            ) : (
              tracks.map(track => (
                <div
                  key={track.id}
                  className="h-24 border-b border-[#1f1f1f] relative group hover:bg-[#0f0f0f]"
                  onClick={() => setSelectedTrackId(track.id)}
                >
                  {/* Track Lane Background */}
                  <div className="absolute inset-0 flex items-center px-2">
                    {track.clips.length === 0 ? (
                      <div className="text-xs text-gray-700">Empty track - add clips to see waveforms</div>
                    ) : (
                      track.clips.map(clip => (
                        <div
                          key={clip.id}
                          className={`absolute h-16 rounded-lg overflow-hidden cursor-pointer transition-all ${
                            selectedClipId === clip.id ? 'ring-2 ring-cyan-400 ring-offset-2 ring-offset-[#0a0a0a]' : ''
                          }`}
                          style={{
                            left: `${clip.startTime * zoom}px`, // Zoom-based positioning
                            width: `${clip.duration * zoom}px`,
                            backgroundColor: track.color + '20',
                            border: `2px solid ${selectedClipId === clip.id ? '#00bcd4' : track.color}`
                          }}
                          onClick={(e) => handleClipClick(e, clip.id, track.id)}
                          title="Click to select, drag to move (coming soon)"
                        >
                          {/* Clip Canvas for Waveform */}
                          <canvas
                            ref={(canvas) => {
                              if (canvas && clip.buffer) {
                                renderWaveform(canvas, clip.buffer, selectedClipId === clip.id ? '#00bcd4' : track.color);
                              }
                            }}
                            width={clip.duration * zoom}
                            height={64}
                            className="w-full h-full"
                          />
                          
                          {/* Fade In Handle */}
                          <div className="absolute left-0 top-0 bottom-0 w-2 bg-gradient-to-r from-black/50 to-transparent cursor-ew-resize hover:from-cyan-400/50"
                            title="Drag to adjust fade in"
                          />
                          
                          {/* Fade Out Handle */}
                          <div className="absolute right-0 top-0 bottom-0 w-2 bg-gradient-to-l from-black/50 to-transparent cursor-ew-resize hover:from-cyan-400/50"
                            title="Drag to adjust fade out"
                          />
                          
                          {/* Clip Name Overlay */}
                          <div className="absolute top-1 left-2 text-xs font-semibold text-white drop-shadow-lg">
                            {clip.name || track.name}
                          </div>
                          
                          {/* Clip Actions (show on selected) */}
                          {selectedClipId === clip.id && (
                            <div className="absolute top-1 right-2 flex gap-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSplitClip();
                                }}
                                className="px-1 py-0.5 text-[10px] bg-black/70 rounded hover:bg-cyan-500 transition-colors"
                                title="Split (Cmd+E)"
                              >
                                ✂️
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteClip();
                                }}
                                className="px-1 py-0.5 text-[10px] bg-black/70 rounded hover:bg-red-500 transition-colors"
                                title="Delete (Del)"
                              >
                                🗑️
                              </button>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>

                  {/* Playhead Indicator (moves during playback) */}
                  {isPlaying && (
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-cyan-400 shadow-lg shadow-cyan-400/50 pointer-events-none z-10"
                      style={{ left: `${playhead * zoom}px` }}
                    />
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Mixer Panel */}
        {showMixer && selectedTrackId && (() => {
          const selectedTrack = tracks.find(t => t.id === selectedTrackId);
          if (!selectedTrack) return null;

          return (
            <div className="w-80 bg-[#0f0f0f] border-l border-[#1f1f1f] p-4 overflow-y-auto">
              <div className="text-sm font-bold mb-4 text-white">🎛️ {selectedTrack.name}</div>
              
              <div className="space-y-4">
                {/* Volume Control */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-xs text-gray-500">Volume</label>
                    <span className="text-xs text-cyan-400">{Math.round(selectedTrack.volume * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={selectedTrack.volume * 100}
                    onChange={(e) => updateTrackVolume(selectedTrack.id, parseInt(e.target.value))}
                    className="w-full"
                  />
                </div>
                
                {/* Pan Control */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-xs text-gray-500">Pan</label>
                    <span className="text-xs text-cyan-400">
                      {selectedTrack.pan === 0 ? 'C' : selectedTrack.pan < 0 ? `L${Math.abs(Math.round(selectedTrack.pan * 100))}` : `R${Math.round(selectedTrack.pan * 100)}`}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="-100"
                    max="100"
                    value={selectedTrack.pan * 100}
                    onChange={(e) => updateTrackPan(selectedTrack.id, parseInt(e.target.value))}
                    className="w-full"
                  />
                </div>

                {/* Track Controls */}
                <div className="flex gap-2">
                  <button
                    onClick={() => toggleMute(selectedTrack.id)}
                    className={`flex-1 py-2 rounded text-xs font-semibold ${
                      selectedTrack.muted
                        ? 'bg-red-500 text-white'
                        : 'bg-[#1f1f1f] text-gray-400 hover:bg-[#252525]'
                    }`}
                  >
                    {selectedTrack.muted ? '🔇 Muted' : '🔊 Mute'}
                  </button>
                  <button
                    onClick={() => toggleSolo(selectedTrack.id)}
                    className={`flex-1 py-2 rounded text-xs font-semibold ${
                      selectedTrack.solo
                        ? 'bg-yellow-500 text-black'
                        : 'bg-[#1f1f1f] text-gray-400 hover:bg-[#252525]'
                    }`}
                  >
                    {selectedTrack.solo ? '⭐ Solo' : 'Solo'}
                  </button>
                </div>

                {/* Track Info */}
                <div className="pt-4 border-t border-[#1f1f1f]">
                  <div className="text-xs text-gray-600 space-y-1">
                    <div>Type: <span className="text-cyan-400">{selectedTrack.type}</span></div>
                    <div>Clips: <span className="text-cyan-400">{selectedTrack.clips.length}</span></div>
                    <div>Color: <span className="text-cyan-400">{selectedTrack.color}</span></div>
                    {selectedClipId && (() => {
                      const clip = selectedTrack.clips.find(c => c.id === selectedClipId);
                      return clip ? (
                        <>
                          <div className="pt-2 border-t border-[#1f1f1f] mt-2">
                            <div className="text-cyan-400 font-semibold mb-1">Selected Clip:</div>
                            <div>Name: <span className="text-cyan-400">{clip.name}</span></div>
                            <div>Start: <span className="text-cyan-400">{clip.startTime.toFixed(2)}s</span></div>
                            <div>Duration: <span className="text-cyan-400">{clip.duration.toFixed(2)}s</span></div>
                          </div>
                        </>
                      ) : null;
                    })()}
                  </div>
                </div>

                <div className="pt-4 border-t border-[#1f1f1f]">
                  <div className="text-xs font-bold text-white mb-2">Effects (Coming Soon)</div>
                  <div className="space-y-2 text-xs">
                    <button className="w-full p-2 bg-[#1f1f1f] rounded hover:bg-[#252525] text-left opacity-50 cursor-not-allowed">
                      🎚️ EQ
                    </button>
                    <button className="w-full p-2 bg-[#1f1f1f] rounded hover:bg-[#252525] text-left opacity-50 cursor-not-allowed">
                      🔊 Compressor
                    </button>
                    <button className="w-full p-2 bg-[#1f1f1f] rounded hover:bg-[#252525] text-left opacity-50 cursor-not-allowed">
                      🌊 Reverb
                    </button>
                    <button className="w-full p-2 bg-[#1f1f1f] rounded hover:bg-[#252525] text-left opacity-50 cursor-not-allowed">
                      ⏱️ Delay
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Bottom Status Bar */}
      <footer className="h-8 bg-[#0f0f0f] border-t border-[#1f1f1f] flex items-center px-4 text-xs text-gray-600">
        <div>CPU: 12%</div>
        <div className="mx-4">|</div>
        <div>Latency: 5ms</div>
        <div className="flex-1" />
        <button
          onClick={() => setShowShortcuts(true)}
          className="text-cyan-400 hover:text-cyan-300 transition-colors"
        >
          Press ? for shortcuts
        </button>
      </footer>

      {/* Keyboard Shortcuts Modal */}
      {showShortcuts && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50" onClick={() => setShowShortcuts(false)}>
          <div className="bg-[#0f0f0f] border border-[#1f1f1f] rounded-lg p-6 max-w-md" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-white mb-4">⌨️ Keyboard Shortcuts</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-400">Play/Pause</span><kbd className="px-2 py-1 bg-[#1f1f1f] rounded">Space</kbd></div>
              <div className="flex justify-between"><span className="text-gray-400">Stop</span><kbd className="px-2 py-1 bg-[#1f1f1f] rounded">S</kbd></div>
              <div className="flex justify-between"><span className="text-gray-400">Save</span><kbd className="px-2 py-1 bg-[#1f1f1f] rounded">Cmd+S</kbd></div>
              <div className="flex justify-between"><span className="text-gray-400">Undo</span><kbd className="px-2 py-1 bg-[#1f1f1f] rounded">Cmd+Z</kbd></div>
              <div className="flex justify-between"><span className="text-gray-400">Split Clip</span><kbd className="px-2 py-1 bg-[#1f1f1f] rounded">Cmd+E</kbd></div>
              <div className="flex justify-between"><span className="text-gray-400">Delete</span><kbd className="px-2 py-1 bg-[#1f1f1f] rounded">Del</kbd></div>
              <div className="flex justify-between"><span className="text-gray-400">Show Shortcuts</span><kbd className="px-2 py-1 bg-[#1f1f1f] rounded">?</kbd></div>
            </div>
            <button onClick={() => setShowShortcuts(false)} className="mt-4 w-full py-2 bg-cyan-500 text-black rounded hover:bg-cyan-400">Close</button>
          </div>
        </div>
      )}

      {/* Save Project Modal */}
      {showSaveModal && (() => {
        const [projectName, setProjectName] = useState('');
        return (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50" onClick={() => setShowSaveModal(false)}>
            <div className="bg-[#0f0f0f] border border-[#1f1f1f] rounded-lg p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
              <h2 className="text-lg font-bold text-white mb-4">💾 Save Project</h2>
              <input 
                type="text" 
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="Project name..." 
                className="w-full px-3 py-2 bg-[#1f1f1f] text-white rounded mb-4"
                autoFocus
              />
              <div className="flex gap-2">
                <button 
                  onClick={() => projectName.trim() && handleSaveProject(projectName.trim())} 
                  disabled={!projectName.trim()}
                  className="flex-1 py-2 bg-cyan-500 text-black rounded hover:bg-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Save
                </button>
                <button onClick={() => setShowSaveModal(false)} className="flex-1 py-2 bg-[#1f1f1f] text-gray-400 rounded hover:bg-[#252525]">Cancel</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Load Project Modal */}
      {showLoadModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50" onClick={() => setShowLoadModal(false)}>
          <div className="bg-[#0f0f0f] border border-[#1f1f1f] rounded-lg p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-white mb-4">📂 Load Project</h2>
            <div className="space-y-2 mb-4 max-h-64 overflow-y-auto">
              {userProjects.length === 0 ? (
                <div className="text-sm text-gray-500 text-center py-8">
                  No saved projects yet.<br/>
                  <span className="text-cyan-400">Save your first project to see it here!</span>
                </div>
              ) : (
                userProjects.map(project => (
                  <div 
                    key={project.id}
                    onClick={() => handleLoadProject(project.id)}
                    className="p-3 bg-[#1f1f1f] rounded hover:bg-[#252525] cursor-pointer"
                  >
                    <div className="font-semibold text-white">{project.name}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      {project.bpm} BPM • Last modified {new Date(project.updatedAt).toLocaleDateString()}
                    </div>
                  </div>
                ))
              )}
            </div>
            <button onClick={() => setShowLoadModal(false)} className="w-full py-2 bg-[#1f1f1f] text-gray-400 rounded hover:bg-[#252525]">Cancel</button>
          </div>
        </div>
      )}

      {/* Export Modal */}
      {showExportModal && (() => {
        const [exportFormat, setExportFormat] = useState<'wav' | 'mp3'>('wav');
        const [exportQuality, setExportQuality] = useState('44100');
        return (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50" onClick={() => setShowExportModal(false)}>
            <div className="bg-[#0f0f0f] border border-[#1f1f1f] rounded-lg p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
              <h2 className="text-lg font-bold text-white mb-4">📤 Export Project</h2>
              <div className="space-y-3 mb-4">
                <div>
                  <label className="text-sm text-gray-400">Format</label>
                  <select 
                    value={`${exportFormat}-${exportQuality}`}
                    onChange={(e) => {
                      const [fmt, quality] = e.target.value.split('-');
                      setExportFormat(fmt as 'wav' | 'mp3');
                      if (quality) setExportQuality(quality);
                    }}
                    className="w-full mt-1 px-3 py-2 bg-[#1f1f1f] text-white rounded"
                  >
                    <option value="wav-16">WAV (16-bit)</option>
                    <option value="wav-24">WAV (24-bit)</option>
                    <option value="mp3-320">MP3 (320kbps)</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm text-gray-400">Sample Rate</label>
                  <select 
                    value={exportQuality}
                    onChange={(e) => setExportQuality(e.target.value)}
                    className="w-full mt-1 px-3 py-2 bg-[#1f1f1f] text-white rounded"
                  >
                    <option value="44100">44.1 kHz</option>
                    <option value="48000">48 kHz</option>
                    <option value="96000">96 kHz</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => handleExport(exportFormat, exportQuality)} 
                  className="flex-1 py-2 bg-cyan-500 text-black rounded hover:bg-cyan-400"
                >
                  Export
                </button>
                <button onClick={() => setShowExportModal(false)} className="flex-1 py-2 bg-[#1f1f1f] text-gray-400 rounded hover:bg-[#252525]">Cancel</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Track Color Picker Modal */}
      {showColorPicker && selectedColorTrackId && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50" onClick={() => { setShowColorPicker(false); setSelectedColorTrackId(null); }}>
          <div className="bg-[#0f0f0f] border border-[#1f1f1f] rounded-lg p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-white mb-4">🎨 Track Color</h2>
            <div className="grid grid-cols-4 gap-2 mb-4">
              {['#00bcd4', '#ff5722', '#4caf50', '#ffc107', '#9c27b0', '#ff9800', '#e91e63', '#3f51b5'].map(color => (
                <button
                  key={color}
                  onClick={() => handleTrackColorChange(selectedColorTrackId, color)}
                  className="w-12 h-12 rounded hover:ring-2 ring-white transition-all"
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
            <button onClick={() => { setShowColorPicker(false); setSelectedColorTrackId(null); }} className="w-full py-2 bg-[#1f1f1f] text-gray-400 rounded hover:bg-[#252525]">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
