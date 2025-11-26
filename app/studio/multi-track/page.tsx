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

// Loading Spinner Component
function LoadingSpinner({ message }: { message: string }) {
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
      <div className="bg-[#0f0f0f]/95 border border-cyan-500/30 rounded-xl p-8 shadow-2xl shadow-cyan-500/20">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin" />
          <div className="text-white font-semibold">{message}</div>
          <div className="text-xs text-gray-400">Please wait...</div>
        </div>
      </div>
    </div>
  );
}

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
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [loopEnabled, setLoopEnabled] = useState(false);
  const [loopStart, setLoopStart] = useState(0);
  const [loopEnd, setLoopEnd] = useState(10);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [selectedColorTrackId, setSelectedColorTrackId] = useState<string | null>(null);
  const [userProjects, setUserProjects] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false);
  const [draggedClip, setDraggedClip] = useState<{trackId: string, clipId: string, startX: number, initialStartTime: number} | null>(null);
  const [clipboardClip, setClipboardClip] = useState<{trackId: string, clip: any} | null>(null);
  const [projectName, setProjectName] = useState('');
  const [exportFormat, setExportFormat] = useState<'wav' | 'mp3'>('wav');
  const [exportQuality, setExportQuality] = useState('44100');
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
        case 'c':
          if ((e.metaKey || e.ctrlKey) && selectedClipId && selectedTrackId) {
            e.preventDefault();
            const track = tracks.find(t => t.id === selectedTrackId);
            const clip = track?.clips.find(c => c.id === selectedClipId);
            if (clip) {
              setClipboardClip({ trackId: selectedTrackId, clip: { ...clip } });
            }
          }
          break;
        case 'x':
          if ((e.metaKey || e.ctrlKey) && selectedClipId && selectedTrackId) {
            e.preventDefault();
            const track = tracks.find(t => t.id === selectedTrackId);
            const clip = track?.clips.find(c => c.id === selectedClipId);
            if (clip) {
              setClipboardClip({ trackId: selectedTrackId, clip: { ...clip } });
              handleDeleteClip();
            }
          }
          break;
        case 'v':
          if ((e.metaKey || e.ctrlKey) && clipboardClip && selectedTrackId && daw) {
            e.preventDefault();
            const newClip = { ...clipboardClip.clip, id: `clip-${Date.now()}`, startTime: playhead };
            daw.addClipToTrack(selectedTrackId, newClip);
            setTracks(daw.getTracks());
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedClipId, selectedTrackId, daw, tracks, clipboardClip, playhead, isPlaying]);

  // Playhead animation
  useEffect(() => {
    if (!daw) return;

    const updatePlayhead = (time: number) => {
      setPlayhead(time);
    };

    const loop = () => {
      const currentPlayhead = daw.getPlayhead();
      setPlayhead(currentPlayhead);
      setIsPlaying(daw.isPlaying());
      
      // Check loop boundaries
      if (loopEnabled && daw.isPlaying() && currentPlayhead >= loopEnd) {
        daw.seekTo(loopStart);
        setPlayhead(loopStart);
      }
      
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
  }, [daw, loopEnabled, loopStart, loopEnd]);

  const togglePlay = () => {
    if (!daw) return;
    if (isPlaying) {
      daw.pause();
      setIsPlaying(false);
    } else {
      daw.play();
      setIsPlaying(true);
    }
  };

  const stop = () => {
    if (!daw) return;
    daw.stop();
    setIsPlaying(false);
    setPlayhead(0);
  };

  const handlePlayheadMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDraggingPlayhead(true);
  };

  const handleTimelineMouseMove = (e: React.MouseEvent) => {
    // Handle playhead dragging
    if (isDraggingPlayhead && daw) {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const x = e.clientX - rect.left;
      const timeInSeconds = Math.max(0, x / zoom);
      daw.seekTo(timeInSeconds);
      setPlayhead(timeInSeconds);
    }
    
    // Handle clip dragging
    if (draggedClip && daw) {
      const deltaX = e.clientX - draggedClip.startX;
      const deltaTime = deltaX / zoom;
      const newStartTime = Math.max(0, snapTime(draggedClip.initialStartTime + deltaTime));
      
      // Update clip position in DAW
      const track = tracks.find(t => t.id === draggedClip.trackId);
      const clip = track?.clips.find(c => c.id === draggedClip.clipId);
      if (clip) {
        clip.startTime = newStartTime;
        setTracks([...daw.getTracks()]);
      }
    }
  };

  const handleTimelineMouseUp = () => {
    setIsDraggingPlayhead(false);
    setDraggedClip(null);
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
    if (!daw || newBpm < 40 || newBpm > 240) return;
    daw.setBPM(newBpm);
    setBpm(newBpm);
    // Force track refresh to update grid spacing
    setTracks([...daw.getTracks()]);
  };

  const handleRulerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!daw) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const timeInSeconds = snapTime(clickX / zoom);
    daw.seekTo(timeInSeconds);
    setPlayhead(timeInSeconds);
  };

  const handleClipMouseDown = (e: React.MouseEvent, trackId: string, clipId: string, clipStartTime: number) => {
    e.stopPropagation();
    setDraggedClip({ trackId, clipId, startX: e.clientX, initialStartTime: clipStartTime });
    setSelectedTrackId(trackId);
    setSelectedClipId(clipId);
  };

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || !daw) return;

    setIsLoading(true);
    setLoadingMessage(`Uploading ${files.length} file${files.length > 1 ? 's' : ''}...`);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setLoadingMessage(`Processing ${i + 1}/${files.length}: ${file.name}`);
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
    
    setIsLoading(false);
    setLoadingMessage('');
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
    
    setIsLoading(true);
    setLoadingMessage('Saving project...');
    
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
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  };

  const handleLoadProject = async (projectId: string) => {
    if (!projectManagerRef.current || !daw || !user?.id) return;
    
    setIsLoading(true);
    setLoadingMessage('Loading project...');
    
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
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  };

  const handleExport = async (format: 'wav' | 'mp3', quality: string) => {
    if (!audioExporterRef.current || !daw) return;
    
    if (tracks.length === 0 || !tracks.some(t => t.clips.length > 0)) {
      alert('No audio to export. Please add tracks with audio clips first.');
      return;
    }
    
    setIsLoading(true);
    setLoadingMessage('Mixing tracks...');
    
    try {
      // Find the longest duration across all clips
      let maxDuration = 0;
      tracks.forEach(track => {
        track.clips.forEach(clip => {
          const clipEnd = clip.startTime + clip.duration;
          if (clipEnd > maxDuration) maxDuration = clipEnd;
        });
      });
      
      const sampleRate = quality === '96000' ? 96000 : quality === '48000' ? 48000 : 44100;
      const audioContext = daw.getAudioContext();
      
      // Create offline context for rendering
      const offlineContext = new OfflineAudioContext(2, Math.ceil(maxDuration * sampleRate), sampleRate);
      
      setLoadingMessage('Rendering audio...');
      
      // Mix all tracks
      tracks.forEach(track => {
        if (track.muted) return;
        track.clips.forEach(clip => {
          if (clip.buffer) {
            const source = offlineContext.createBufferSource();
            source.buffer = clip.buffer;
            const gainNode = offlineContext.createGain();
            gainNode.gain.value = track.volume;
            source.connect(gainNode);
            gainNode.connect(offlineContext.destination);
            source.start(clip.startTime);
          }
        });
      });
      
      const renderedBuffer = await offlineContext.startRendering();
      
      setLoadingMessage('Encoding file...');
      const bitDepth = format === 'wav' && quality.includes('24') ? 24 : 16;
      
      const result = await audioExporterRef.current.exportAudio(
        renderedBuffer,
        { format, sampleRate, bitDepth },
        `444Radio-Export-${Date.now()}.${format}`
      );
      
      if (result.success && result.blob) {
        audioExporterRef.current.downloadBlob(
          result.blob,
          `444Radio-Export-${Date.now()}.${format}`
        );
        alert('Export complete! Download started.');
      } else {
        alert(`Export failed: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Export error:', error);
      alert('Export failed. See console for details.');
    } finally {
      setShowExportModal(false);
      setIsLoading(false);
      setLoadingMessage('');
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
    if (!snapEnabled) return time;
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
            onClick={() => setSnapEnabled(!snapEnabled)}
            className={`px-2 py-1 text-xs rounded transition-all ${
              snapEnabled ? 'bg-cyan-500 text-black' : 'bg-[#1f1f1f] text-gray-400 hover:bg-[#252525]'
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
            className="px-4 h-10 rounded-lg bg-[#1f1f1f] text-gray-300 hover:bg-[#252525] hover:text-cyan-400 border-2 border-gray-700 hover:border-cyan-500/50 transition-all font-semibold text-sm"
            title="Save project (Cmd+S)"
          >
            💾 Save
          </button>
          <button
            onClick={() => setShowLoadModal(true)}
            className="px-4 h-10 rounded-lg bg-[#1f1f1f] text-gray-300 hover:bg-[#252525] hover:text-cyan-400 border-2 border-gray-700 hover:border-cyan-500/50 transition-all font-semibold text-sm"
          >
            📂 Load
          </button>
          <button
            onClick={() => setShowExportModal(true)}
            className="px-4 h-10 rounded-lg bg-gradient-to-r from-cyan-500 to-cyan-600 text-black hover:from-cyan-400 hover:to-cyan-500 transition-all font-bold text-sm shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50"
          >
            📤 Export
          </button>
        </div>

        {/* View Toggles */}
        <div className="flex gap-2">
          <button
            onClick={() => setShowMixer(!showMixer)}
            className={`px-4 h-10 rounded-lg transition-all font-semibold text-sm border-2 ${
              showMixer
                ? 'bg-gradient-to-r from-cyan-500 to-cyan-600 text-black shadow-lg shadow-cyan-500/30 border-cyan-400'
                : 'bg-[#1f1f1f] text-gray-300 hover:bg-[#252525] hover:text-cyan-400 border-gray-700 hover:border-cyan-500/50'
            }`}
          >
            🎛️ Mixer
          </button>
          <button
            onClick={() => setShowEffects(!showEffects)}
            className={`px-4 h-10 rounded-lg transition-all font-semibold text-sm border-2 opacity-50 cursor-not-allowed bg-[#1f1f1f] text-gray-600 border-gray-800`}
            disabled
            title="Coming soon"
          >
            🎚️ Effects
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Track List */}
        <div className="w-60 bg-[#0f0f0f] border-r border-[#1f1f1f] flex flex-col flex-shrink-0">
          <div className="p-3 border-b border-[#1f1f1f] space-y-2">
            <button
              onClick={addTrack}
              className="w-full py-2.5 bg-gradient-to-r from-cyan-500 to-cyan-600 text-black rounded-lg font-bold text-sm hover:from-cyan-400 hover:to-cyan-500 transition-all shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50"
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
              className="w-full py-2.5 bg-[#1f1f1f] text-cyan-400 border-2 border-cyan-500/30 rounded-lg font-bold text-sm hover:bg-cyan-500/10 hover:border-cyan-500/50 transition-all"
            >
              📁 Upload Audio
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {tracks.length === 0 ? (
              <div className="p-8 text-center">
                <div className="text-5xl mb-4 animate-bounce">🎵</div>
                <div className="text-xl font-bold text-white mb-2">No tracks yet</div>
                <div className="text-sm text-gray-500 mb-4">Start creating your masterpiece</div>
                <div className="text-xs text-cyan-400">💡 Tip: Upload audio or add a new track</div>
              </div>
            ) : (
              tracks.map((track, index) => (
                <div
                  key={track.id}
                  className={`p-3 border-b border-[#1a1a1a] cursor-pointer transition-all duration-150 ${
                    selectedTrackId === track.id
                      ? 'bg-cyan-500/10 border-l-4 border-l-cyan-500'
                      : 'hover:bg-[#141414] border-l-4 border-l-transparent'
                  }`}
                  onClick={() => setSelectedTrackId(track.id)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center text-xs font-bold text-cyan-400 border border-gray-700 shadow-inner">
                        {index + 1}
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedColorTrackId(track.id);
                          setShowColorPicker(true);
                        }}
                        className="w-7 h-7 rounded-lg border-2 border-white/40 hover:ring-2 hover:ring-cyan-400 transition-all shadow-lg hover:scale-110 active:scale-95"
                        style={{ backgroundColor: track.color }}
                        title="Change color"
                      />
                      <div className="text-xl mr-1">
                        {track.type === 'midi' ? '🎹' : '🎤'}
                      </div>
                      <span className="text-sm font-semibold text-white">
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
            className="h-8 bg-[#0f0f0f] border-b border-[#1f1f1f] flex items-center px-2 text-xs text-gray-500 cursor-pointer hover:bg-[#141414] relative overflow-hidden"
            onClick={handleRulerClick}
            title="Click to seek"
          >
            {(() => {
              const totalSeconds = 600;
              const interval = zoom < 20 ? 10 : zoom < 50 ? 5 : zoom < 100 ? 2 : 1;
              const markers: React.ReactElement[] = [];
              for (let sec = 0; sec <= totalSeconds; sec += interval) {
                markers.push(
                  <div key={sec} className="absolute border-l border-[#1f1f1f] h-full flex items-center pl-1" style={{ left: `${sec * zoom}px` }}>
                    {sec}s
                  </div>
                );
              }
              return markers;
            })()}
          </div>

          {/* Track Lanes */}
          <div className="flex-1 relative" 
               onMouseMove={handleTimelineMouseMove}
               onMouseUp={handleTimelineMouseUp}
               onMouseLeave={handleTimelineMouseUp}>
            {/* Playhead Indicator */}
            <div 
              className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-30 shadow-lg shadow-red-500/50 cursor-ew-resize"
              style={{ left: `${playhead * zoom}px` }}
              onMouseDown={handlePlayheadMouseDown}
            >
              <div className="absolute -top-6 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-red-500 text-white text-[10px] font-bold rounded whitespace-nowrap pointer-events-none">
                {formatTime(playhead)}
              </div>
              <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-red-500 pointer-events-none" />
            </div>
            
            {/* Grid Lines (when snap enabled) */}
            {snapEnabled && (
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
              <div className="flex items-center justify-center h-full">
                <div className="text-center p-12 bg-[#0f0f0f] rounded-2xl border-2 border-dashed border-cyan-500/30">
                  <div className="text-6xl mb-6 animate-pulse">🎵</div>
                  <div className="text-2xl font-bold text-white mb-3">Let's Make Music!</div>
                  <div className="text-base text-gray-400 mb-6">Upload audio files or create new tracks to begin</div>
                  <div className="flex gap-3 justify-center">
                    <button
                      onClick={addTrack}
                      className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-cyan-600 text-black font-bold rounded-lg hover:from-cyan-400 hover:to-cyan-500 transition-all shadow-lg shadow-cyan-500/30"
                    >
                      ➕ Add Track
                    </button>
                    <button
                      onClick={() => document.getElementById('audio-upload')?.click()}
                      className="px-6 py-3 bg-[#1f1f1f] text-cyan-400 font-bold rounded-lg hover:bg-[#252525] border-2 border-cyan-500/30 hover:border-cyan-500/50 transition-all"
                    >
                      📁 Upload Audio
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              tracks.map((track, trackIndex) => (
                <div
                  key={track.id}
                  className="h-24 border-b border-[#1f1f1f] relative group hover:bg-[#0f0f0f] flex"
                  onClick={() => setSelectedTrackId(track.id)}
                >
                  {/* Track Header - Fixed Width to Match Sidebar */}
                  <div className="w-60 flex-shrink-0 border-r border-[#1f1f1f]/50 bg-[#0a0a0a]/80 flex items-center px-3 gap-2.5 backdrop-blur-sm">
                    <div className="w-6 h-6 rounded-md bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center text-[11px] font-bold text-cyan-400 border border-gray-700/50 shadow-inner flex-shrink-0">
                      {trackIndex + 1}
                    </div>
                    <div 
                      className="w-5 h-5 rounded-md flex-shrink-0 shadow-lg ring-1 ring-white/20" 
                      style={{ backgroundColor: track.color }}
                    />
                    <span className="text-sm font-bold text-white truncate flex-1 tracking-tight">{track.name}</span>
                    <div className="text-base flex-shrink-0 opacity-70">
                      {track.type === 'midi' ? '🎹' : '🎤'}
                    </div>
                  </div>
                  
                  {/* Track Lane - Scrollable Timeline Area */}
                  <div className="flex-1 relative">
                    <div className="absolute inset-0 flex items-center px-2">
                    {track.clips.length === 0 ? (
                      <div className="text-xs text-gray-700">Empty track - add clips to see waveforms</div>
                    ) : (
                      track.clips.map((clip, clipIndex) => (
                        <div
                          key={clip.id}
                          className={`absolute h-16 rounded-lg overflow-hidden cursor-move transition-all shadow-xl ${
                            selectedClipId === clip.id ? 'ring-4 ring-cyan-400 ring-offset-2 ring-offset-[#0a0a0a] scale-105' : 'hover:scale-102'
                          }`}
                          style={{
                            left: `${clip.startTime * zoom}px`,
                            width: `${clip.duration * zoom}px`,
                            backgroundColor: track.color + '30',
                            border: `3px solid ${selectedClipId === clip.id ? '#00bcd4' : track.color}`,
                            boxShadow: selectedClipId === clip.id ? `0 4px 20px ${track.color}80` : `0 2px 8px rgba(0,0,0,0.3)`
                          }}
                          onClick={(e) => handleClipClick(e, clip.id, track.id)}
                          onMouseDown={(e) => handleClipMouseDown(e, track.id, clip.id, clip.startTime)}
                          title="Drag to move, click to select"
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
                          
                          {/* Gradient Overlay */}
                          <div className="absolute inset-0 bg-gradient-to-b from-black/20 to-transparent pointer-events-none" />
                          
                          {/* Clip Name Overlay */}
                          <div className="absolute top-1 left-2 text-xs font-bold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] bg-black/40 px-2 py-0.5 rounded">
                            {clip.name || track.name}
                          </div>
                          
                          {/* Duration Label */}
                          <div className="absolute bottom-1 right-2 text-[10px] font-bold text-white/80 drop-shadow-lg bg-black/40 px-1.5 py-0.5 rounded">
                            {clip.duration.toFixed(2)}s
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
                </div>
              ))
            )}
          </div>
        </div>

        {/* Mixer Panel */}
        {showMixer && (
          <div className="w-80 bg-[#0f0f0f] border-l border-[#1f1f1f] overflow-y-auto">
            <div className="sticky top-0 bg-[#0f0f0f] border-b border-[#1f1f1f] p-4 z-10">
              <div className="text-sm font-bold text-white flex items-center gap-2">
                <span className="text-xl">🎛️</span>
                <span>Mixer ({tracks.length} tracks)</span>
              </div>
            </div>
            
            {tracks.length === 0 ? (
              <div className="p-8 text-center text-gray-600 text-sm">
                <div className="text-3xl mb-2">🎚️</div>
                <div>No tracks to mix</div>
                <div className="text-xs mt-1">Add tracks to see mixer controls</div>
              </div>
            ) : (
              <div className="p-4 space-y-6">
                {tracks.map((track) => (
                  <div 
                    key={track.id}
                    className={`p-3 rounded-lg border transition-all ${
                      selectedTrackId === track.id 
                        ? 'bg-cyan-500/10 border-cyan-500/50' 
                        : 'bg-[#141414] border-[#1f1f1f] hover:border-[#2f2f2f]'
                    }`}
                  >
                    {/* Track Header */}
                    <div className="flex items-center gap-2 mb-3">
                      <div 
                        className="w-4 h-4 rounded-full border-2 border-white/30" 
                        style={{ backgroundColor: track.color }}
                      />
                      <div className="text-xs font-semibold text-white flex-1">{track.name}</div>
                      <div className="text-[10px] text-gray-600">{track.clips.length} clips</div>
                    </div>
                    
                    {/* Volume Control */}
                    <div className="mb-3">
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-[10px] text-gray-500 uppercase tracking-wider">Volume</label>
                        <span className="text-xs font-bold text-cyan-400">{Math.round(track.volume * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={track.volume * 100}
                        onChange={(e) => updateTrackVolume(track.id, parseInt(e.target.value))}
                        className="w-full h-2 bg-[#1f1f1f] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-cyan-500 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:hover:bg-cyan-400"
                      />
                    </div>
                    
                    {/* Pan Control */}
                    <div className="mb-3">
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-[10px] text-gray-500 uppercase tracking-wider">Pan</label>
                        <span className="text-xs font-bold text-cyan-400">
                          {track.pan === 0 ? 'CENTER' : track.pan < 0 ? `L${Math.abs(Math.round(track.pan * 100))}` : `R${Math.round(track.pan * 100)}`}
                        </span>
                      </div>
                      <input
                        type="range"
                        min="-100"
                        max="100"
                        value={track.pan * 100}
                        onChange={(e) => updateTrackPan(track.id, parseInt(e.target.value))}
                        className="w-full h-2 bg-[#1f1f1f] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-cyan-500 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:hover:bg-cyan-400"
                      />
                    </div>

                    {/* Track Controls */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => toggleMute(track.id)}
                        className={`flex-1 py-1.5 rounded text-[10px] font-bold uppercase tracking-wide transition-all ${
                          track.muted
                            ? 'bg-red-500 text-white shadow-lg shadow-red-500/50'
                            : 'bg-[#1f1f1f] text-gray-400 hover:bg-[#252525] hover:text-white'
                        }`}
                      >
                        {track.muted ? '🔇 M' : 'M'}
                      </button>
                      <button
                        onClick={() => toggleSolo(track.id)}
                        className={`flex-1 py-1.5 rounded text-[10px] font-bold uppercase tracking-wide transition-all ${
                          track.solo
                            ? 'bg-yellow-500 text-black shadow-lg shadow-yellow-500/50'
                            : 'bg-[#1f1f1f] text-gray-400 hover:bg-[#252525] hover:text-white'
                        }`}
                      >
                        {track.solo ? '⭐ S' : 'S'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Status Bar */}
      <footer className="h-8 bg-[#0f0f0f] border-t border-[#1f1f1f] flex items-center px-4 text-xs text-gray-500">
        <div className="flex items-center gap-2">
          <span className="text-cyan-400">🎵</span>
          <span className="font-semibold text-white">{tracks.length}</span>
          <span>track{tracks.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="mx-3 text-gray-700">|</div>
        <div className="flex items-center gap-2">
          <span className="text-cyan-400">🎶</span>
          <span className="font-semibold text-white">{tracks.reduce((sum, t) => sum + t.clips.length, 0)}</span>
          <span>clip{tracks.reduce((sum, t) => sum + t.clips.length, 0) !== 1 ? 's' : ''}</span>
        </div>
        <div className="mx-3 text-gray-700">|</div>
        <div className="flex items-center gap-2">
          <span className="text-cyan-400">⏱️</span>
          <span className="font-semibold text-white">{formatTime(playhead)}</span>
        </div>
        <div className="mx-3 text-gray-700">|</div>
        <div className="flex items-center gap-2">
          <span className="text-cyan-400">🎹</span>
          <span className="font-semibold text-white">{bpm}</span>
          <span>BPM</span>
        </div>
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
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200" onClick={() => setShowShortcuts(false)}>
          <div className="bg-[#0f0f0f]/95 border border-cyan-500/30 rounded-xl p-8 max-w-md shadow-2xl shadow-cyan-500/20 animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-3">
              <span className="text-2xl">⌨️</span>
              <span>Keyboard Shortcuts</span>
            </h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between items-center py-2 px-3 rounded-lg hover:bg-white/5 transition-colors">
                <span className="text-gray-300">Play/Pause</span>
                <kbd className="px-3 py-1.5 bg-[#1f1f1f] border border-cyan-500/30 rounded-md text-cyan-400 font-mono text-xs shadow-lg">Space</kbd>
              </div>
              <div className="flex justify-between items-center py-2 px-3 rounded-lg hover:bg-white/5 transition-colors">
                <span className="text-gray-300">Stop</span>
                <kbd className="px-3 py-1.5 bg-[#1f1f1f] border border-cyan-500/30 rounded-md text-cyan-400 font-mono text-xs shadow-lg">S</kbd>
              </div>
              <div className="flex justify-between items-center py-2 px-3 rounded-lg hover:bg-white/5 transition-colors">
                <span className="text-gray-300">Save</span>
                <kbd className="px-3 py-1.5 bg-[#1f1f1f] border border-cyan-500/30 rounded-md text-cyan-400 font-mono text-xs shadow-lg">Cmd+S</kbd>
              </div>
              <div className="flex justify-between items-center py-2 px-3 rounded-lg hover:bg-white/5 transition-colors">
                <span className="text-gray-300">Undo</span>
                <kbd className="px-3 py-1.5 bg-[#1f1f1f] border border-cyan-500/30 rounded-md text-cyan-400 font-mono text-xs shadow-lg">Cmd+Z</kbd>
              </div>
              <div className="flex justify-between items-center py-2 px-3 rounded-lg hover:bg-white/5 transition-colors">
                <span className="text-gray-300">Split Clip</span>
                <kbd className="px-3 py-1.5 bg-[#1f1f1f] border border-cyan-500/30 rounded-md text-cyan-400 font-mono text-xs shadow-lg">Cmd+E</kbd>
              </div>
              <div className="flex justify-between items-center py-2 px-3 rounded-lg hover:bg-white/5 transition-colors">
                <span className="text-gray-300">Delete</span>
                <kbd className="px-3 py-1.5 bg-[#1f1f1f] border border-cyan-500/30 rounded-md text-cyan-400 font-mono text-xs shadow-lg">Del</kbd>
              </div>
              <div className="flex justify-between items-center py-2 px-3 rounded-lg hover:bg-white/5 transition-colors">
                <span className="text-gray-300">Show Shortcuts</span>
                <kbd className="px-3 py-1.5 bg-[#1f1f1f] border border-cyan-500/30 rounded-md text-cyan-400 font-mono text-xs shadow-lg">?</kbd>
              </div>
            </div>
            <button onClick={() => setShowShortcuts(false)} className="mt-6 w-full py-3 bg-gradient-to-r from-cyan-500 to-cyan-600 text-black font-bold rounded-lg hover:from-cyan-400 hover:to-cyan-500 transition-all shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50">Close</button>
          </div>
        </div>
      )}

      {/* Save Project Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200" onClick={() => { setShowSaveModal(false); setProjectName(''); }}>
          <div className="bg-[#0f0f0f]/95 border border-cyan-500/30 rounded-xl p-8 max-w-md w-full shadow-2xl shadow-cyan-500/20 animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-3">
              <span className="text-2xl">💾</span>
              <span>Save Project</span>
            </h2>
            <input 
              type="text" 
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && projectName.trim()) {
                  handleSaveProject(projectName.trim());
                  setProjectName('');
                }
              }}
              placeholder="Enter project name..." 
              className="w-full px-4 py-3 bg-[#1f1f1f] border border-cyan-500/30 text-white rounded-lg mb-6 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition-all"
              autoFocus
            />
            <div className="flex gap-3">
              <button 
                onClick={() => {
                  if (projectName.trim()) {
                    handleSaveProject(projectName.trim());
                    setProjectName('');
                  }
                }} 
                disabled={!projectName.trim()}
                className="flex-1 py-3 bg-gradient-to-r from-cyan-500 to-cyan-600 text-black font-bold rounded-lg hover:from-cyan-400 hover:to-cyan-500 transition-all shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
              >
                💾 Save Project
              </button>
              <button onClick={() => { setShowSaveModal(false); setProjectName(''); }} className="flex-1 py-3 bg-[#1f1f1f] text-gray-300 border border-gray-700 rounded-lg hover:bg-[#252525] hover:border-gray-600 transition-all font-semibold">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Load Project Modal */}
      {showLoadModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200" onClick={() => setShowLoadModal(false)}>
          <div className="bg-[#0f0f0f]/95 border border-cyan-500/30 rounded-xl p-8 max-w-md w-full shadow-2xl shadow-cyan-500/20 animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-3">
              <span className="text-2xl">📂</span>
              <span>Load Project</span>
            </h2>
            <div className="space-y-3 mb-6 max-h-80 overflow-y-auto">
              {userProjects.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-4xl mb-3">🎵</div>
                  <div className="text-sm text-gray-400">No saved projects yet</div>
                  <div className="text-xs text-cyan-400 mt-2">Save your first project to see it here!</div>
                </div>
              ) : (
                userProjects.map(project => (
                  <div 
                    key={project.id}
                    onClick={() => handleLoadProject(project.id)}
                    className="p-4 bg-[#1f1f1f] border border-cyan-500/20 rounded-lg hover:bg-[#252525] hover:border-cyan-500/50 cursor-pointer transition-all group"
                  >
                    <div className="font-semibold text-white group-hover:text-cyan-400 transition-colors">{project.name}</div>
                    <div className="text-xs text-gray-500 mt-1.5 flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-cyan-500/10 text-cyan-400 rounded">{project.bpm} BPM</span>
                      <span>•</span>
                      <span>{new Date(project.updatedAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
            <button onClick={() => setShowLoadModal(false)} className="w-full py-3 bg-[#1f1f1f] text-gray-300 border border-gray-700 rounded-lg hover:bg-[#252525] hover:border-gray-600 transition-all font-semibold">Cancel</button>
          </div>
        </div>
      )}

      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200" onClick={() => setShowExportModal(false)}>
          <div className="bg-[#0f0f0f]/95 border border-cyan-500/30 rounded-xl p-8 max-w-md w-full shadow-2xl shadow-cyan-500/20 animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-3">
              <span className="text-2xl">📤</span>
              <span>Export Project</span>
            </h2>
            <div className="space-y-4 mb-6">
              <div>
                <label className="text-sm font-semibold text-gray-300 mb-2 block">Audio Format</label>
                <select 
                  value={exportFormat}
                  onChange={(e) => setExportFormat(e.target.value as 'wav' | 'mp3')}
                  className="w-full px-4 py-3 bg-[#1f1f1f] border border-cyan-500/30 text-white rounded-lg focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition-all"
                >
                  <option value="wav">WAV - Lossless</option>
                  <option value="mp3">MP3 - Compressed</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-300 mb-2 block">Sample Rate</label>
                <select 
                  value={exportQuality}
                  onChange={(e) => setExportQuality(e.target.value)}
                  className="w-full px-4 py-3 bg-[#1f1f1f] border border-cyan-500/30 text-white rounded-lg focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition-all"
                >
                  <option value="44100">44.1 kHz (CD Quality)</option>
                  <option value="48000">48 kHz (Professional)</option>
                  <option value="96000">96 kHz (Hi-Res)</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3">
              <button 
                onClick={() => {
                  handleExport(exportFormat, exportQuality);
                }} 
                className="flex-1 py-3 bg-gradient-to-r from-cyan-500 to-cyan-600 text-black font-bold rounded-lg hover:from-cyan-400 hover:to-cyan-500 transition-all shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50"
              >
                📥 Export
              </button>
              <button onClick={() => setShowExportModal(false)} className="flex-1 py-3 bg-[#1f1f1f] text-gray-300 border border-gray-700 rounded-lg hover:bg-[#252525] hover:border-gray-600 transition-all font-semibold">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Track Color Picker Modal */}
      {showColorPicker && selectedColorTrackId && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200" onClick={() => { setShowColorPicker(false); setSelectedColorTrackId(null); }}>
          <div className="bg-[#0f0f0f]/95 border border-cyan-500/30 rounded-xl p-8 shadow-2xl shadow-cyan-500/20 animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-3">
              <span className="text-2xl">🎨</span>
              <span>Choose Track Color</span>
            </h2>
            <div className="grid grid-cols-4 gap-3 mb-6">
              {['#00bcd4', '#ff5722', '#4caf50', '#ffc107', '#9c27b0', '#ff9800', '#e91e63', '#3f51b5'].map(color => (
                <button
                  key={color}
                  onClick={() => handleTrackColorChange(selectedColorTrackId, color)}
                  className="w-14 h-14 rounded-lg hover:ring-4 ring-white/50 transition-all transform hover:scale-110 shadow-lg"
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>
            <button onClick={() => { setShowColorPicker(false); setSelectedColorTrackId(null); }} className="w-full py-3 bg-[#1f1f1f] text-gray-300 border border-gray-700 rounded-lg hover:bg-[#252525] hover:border-gray-600 transition-all font-semibold">Cancel</button>
          </div>
        </div>
      )}
      
      {/* Loading Overlay */}
      {isLoading && <LoadingSpinner message={loadingMessage} />}
    </div>
  );
}
