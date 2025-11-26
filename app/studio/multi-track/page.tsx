'use client';

import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
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
// Waveform cache using IndexedDB
const waveformCache = new Map<string, string>();

async function getCachedWaveform(clipId: string): Promise<string | null> {
  // Check memory cache first
  if (waveformCache.has(clipId)) {
    return waveformCache.get(clipId)!;
  }
  
  // Check IndexedDB
  try {
    const request = indexedDB.open('WaveformCache', 1);
    return new Promise((resolve) => {
      request.onerror = () => resolve(null);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction('waveforms', 'readonly');
        const store = tx.objectStore('waveforms');
        const getRequest = store.get(clipId);
        getRequest.onsuccess = () => {
          const dataUrl = getRequest.result?.dataUrl || null;
          if (dataUrl) waveformCache.set(clipId, dataUrl);
          resolve(dataUrl);
        };
        getRequest.onerror = () => resolve(null);
      };
    });
  } catch {
    return null;
  }
}

async function setCachedWaveform(clipId: string, dataUrl: string) {
  waveformCache.set(clipId, dataUrl);
  try {
    const request = indexedDB.open('WaveformCache', 1);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction('waveforms', 'readwrite');
      const store = tx.objectStore('waveforms');
      store.put({ id: clipId, dataUrl, timestamp: Date.now() });
    };
  } catch (error) {
    console.error('Cache write failed:', error);
  }
}

async function renderWaveform(canvas: HTMLCanvasElement, audioBuffer: AudioBuffer, color: string, clipId?: string) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Try cache first
  if (clipId) {
    const cachedDataUrl = await getCachedWaveform(clipId);
    if (cachedDataUrl) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0);
      img.src = cachedDataUrl;
      return;
    }
  }

  // Render using professional renderer
  const renderer = new ProfessionalWaveformRenderer(canvas, {
    width: canvas.width,
    height: canvas.height,
    backgroundColor: 'transparent',
    waveColor: color,
    progressColor: color + '80',
    showRMS: true,
    showPeaks: true
  });

  const samplesPerPixel = Math.ceil(audioBuffer.length / canvas.width);
  renderer.generateWaveformData(audioBuffer, samplesPerPixel);
  renderer.render();

  // Cache the result
  if (clipId) {
    const dataUrl = canvas.toDataURL('image/png');
    setCachedWaveform(clipId, dataUrl);
  }
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
  const [showMiniMap, setShowMiniMap] = useState(true);
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
  const [trackHeights, setTrackHeights] = useState<Record<string, number>>({});
  const [resizingTrack, setResizingTrack] = useState<{id: string, startY: number, startHeight: number} | null>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [vuLevels, setVuLevels] = useState<Record<string, number>>({});
  const [fadingClip, setFadingClip] = useState<{clipId: string, side: 'in' | 'out', startX: number, startValue: number} | null>(null);
  const [marqueeStart, setMarqueeStart] = useState<{x: number, y: number} | null>(null);
  const [marqueeEnd, setMarqueeEnd] = useState<{x: number, y: number} | null>(null);
  const [selectedTracks, setSelectedTracks] = useState<Set<string>>(new Set());
  const [waveformCache, setWaveformCache] = useState<Map<string, ImageData>>(new Map());
  const rafRef = useRef<number | undefined>(undefined);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const analyserNodesRef = useRef<Record<string, AnalyserNode>>({});
  const lastRafTime = useRef<number>(0);
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

    // Initialize IndexedDB for waveform cache
    const initDB = indexedDB.open('WaveformCache', 1);
    initDB.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('waveforms')) {
        const store = db.createObjectStore('waveforms', { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };

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

    const loop = (timestamp: number) => {
      // Throttle to 60fps (16.67ms per frame)
      const elapsed = timestamp - lastRafTime.current;
      if (elapsed < 16.67) {
        rafRef.current = requestAnimationFrame(loop);
        return;
      }
      lastRafTime.current = timestamp;

      const currentPlayhead = daw.getPlayhead();
      setPlayhead(currentPlayhead);
      setIsPlaying(daw.isPlaying());
      
      // Check loop boundaries
      if (loopEnabled && daw.isPlaying() && currentPlayhead >= loopEnd) {
        daw.seekTo(loopStart);
        setPlayhead(loopStart);
      }

      // Update VU meters (throttled to every 2 frames for performance)
      if (daw.isPlaying()) {
        const newVuLevels: Record<string, number> = {};
        tracks.forEach(track => {
          const analyser = analyserNodesRef.current[track.id];
          if (analyser) {
            const dataArray = new Uint8Array(analyser.frequencyBinCount);
            analyser.getByteFrequencyData(dataArray);
            const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
            newVuLevels[track.id] = average / 255; // Normalize to 0-1
          } else {
            newVuLevels[track.id] = 0;
          }
        });
        setVuLevels(newVuLevels);
      } else {
        // Reset VU levels when not playing
        const resetLevels: Record<string, number> = {};
        tracks.forEach(track => { resetLevels[track.id] = 0; });
        setVuLevels(resetLevels);
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

  // Auto-save every 2 minutes
  useEffect(() => {
    if (!daw || !user?.id || tracks.length === 0) return;

    const autoSave = async () => {
      if (isSaving) return;
      
      setIsSaving(true);
      try {
        const projectName = `Auto-save ${new Date().toLocaleString()}`;
        await projectManagerRef.current?.saveProject({
          userId: user.id,
          name: projectName,
          bpm,
          timeSignature: { numerator: 4, denominator: 4 },
          tracks,
          markers: [],
          version: 1
        });
        setLastSaved(new Date());
      } catch (error) {
        console.error('Auto-save failed:', error);
      } finally {
        setIsSaving(false);
      }
    };

    // Auto-save every 2 minutes
    autoSaveTimerRef.current = setInterval(autoSave, 2 * 60 * 1000);

    return () => {
      if (autoSaveTimerRef.current) {
        clearInterval(autoSaveTimerRef.current);
      }
    };
  }, [daw, user?.id, tracks, bpm, isSaving]);

  // Initialize waveform cache database
  useEffect(() => {
    const initDB = async () => {
      try {
        const request = indexedDB.open('WaveformCache', 1);
        request.onerror = () => console.error('Failed to open IndexedDB');
        request.onupgradeneeded = (e) => {
          const db = (e.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains('waveforms')) {
            const store = db.createObjectStore('waveforms', { keyPath: 'id' });
            store.createIndex('timestamp', 'timestamp', { unique: false });
          }
        };
      } catch (error) {
        console.error('IndexedDB initialization failed:', error);
      }
    };
    initDB();
  }, []);

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

  const zoomToFit = () => {
    if (tracks.length === 0) return;
    let maxDuration = 0;
    tracks.forEach(track => {
      track.clips.forEach(clip => {
        const clipEnd = clip.startTime + clip.duration;
        if (clipEnd > maxDuration) maxDuration = clipEnd;
      });
    });
    if (maxDuration > 0 && timelineRef.current) {
      const timelineWidth = timelineRef.current.offsetWidth - 240; // Account for track header
      const idealZoom = Math.floor(timelineWidth / maxDuration);
      setZoom(Math.max(10, Math.min(200, idealZoom)));
    }
  };

  const handleTrackResizeStart = (e: React.MouseEvent, trackId: string) => {
    e.stopPropagation();
    const currentHeight = trackHeights[trackId] || 96;
    setResizingTrack({ id: trackId, startY: e.clientY, startHeight: currentHeight });
  };

  const handleTrackResizeMove = (e: React.MouseEvent) => {
    if (!resizingTrack) return;
    const deltaY = e.clientY - resizingTrack.startY;
    const newHeight = Math.max(60, Math.min(300, resizingTrack.startHeight + deltaY));
    setTrackHeights(prev => ({ ...prev, [resizingTrack.id]: newHeight }));
  };

  const handleTrackResizeEnd = () => {
    setResizingTrack(null);
  };

  const handleFadeStart = (e: React.MouseEvent, clipId: string, side: 'in' | 'out', currentValue: number) => {
    e.stopPropagation();
    setFadingClip({ clipId, side, startX: e.clientX, startValue: currentValue });
  };

  const handleFadeMove = (e: React.MouseEvent) => {
    if (!fadingClip) return;
    const deltaX = e.clientX - fadingClip.startX;
    const deltaTime = deltaX / zoom;
    const newValue = Math.max(0, Math.min(2, fadingClip.startValue + deltaTime));
    
    setTracks(prevTracks => prevTracks.map(track => ({
      ...track,
      clips: track.clips.map(clip => 
        clip.id === fadingClip.clipId
          ? { ...clip, [fadingClip.side === 'in' ? 'fadeIn' : 'fadeOut']: newValue }
          : clip
      )
    })));
  };

  const handleFadeEnd = () => {
    setFadingClip(null);
  };

  const handleMarqueeStart = (e: React.MouseEvent) => {
    if (e.button !== 0 || draggedClip || isDraggingPlayhead) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setMarqueeStart({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    setMarqueeEnd({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const handleMarqueeMove = (e: React.MouseEvent) => {
    if (!marqueeStart) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setMarqueeEnd({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const handleMarqueeEnd = () => {
    if (marqueeStart && marqueeEnd) {
      // Select clips within marquee bounds
      const minX = Math.min(marqueeStart.x, marqueeEnd.x);
      const maxX = Math.max(marqueeStart.x, marqueeEnd.x);
      const minY = Math.min(marqueeStart.y, marqueeEnd.y);
      const maxY = Math.max(marqueeStart.y, marqueeEnd.y);
      
      // Implement multi-select based on bounds
      const selectedTrackIds = new Set<string>();
      tracks.forEach((track, idx) => {
        const trackY = idx * 96; // Track height
        if (trackY >= minY && trackY <= maxY) {
          selectedTrackIds.add(track.id);
        }
      });
      setSelectedTracks(selectedTrackIds);
    }
    setMarqueeStart(null);
    setMarqueeEnd(null);
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
            className="w-10 h-10 bg-gradient-to-br from-[#1f1f1f] to-[#151515] border-2 border-gray-700 text-gray-400 rounded-lg hover:bg-[#252525] hover:border-gray-600 hover:text-gray-300 transition-all shadow-lg flex items-center justify-center text-lg"
            title="Stop (S)"
          >
            ⏹
          </button>
          
          <button
            onClick={togglePlay}
            className={`w-12 h-10 rounded-lg font-bold transition-all shadow-lg flex items-center justify-center text-xl ${
              isPlaying
                ? 'bg-gradient-to-r from-cyan-500 to-cyan-600 text-black shadow-cyan-500/40 hover:from-cyan-400 hover:to-cyan-500'
                : 'bg-gradient-to-r from-green-500 to-green-600 text-black shadow-green-500/40 hover:from-green-400 hover:to-green-500'
            }`}
            title={isPlaying ? 'Pause (Spacebar)' : 'Play (Spacebar)'}
          >
            {isPlaying ? '⏸' : '▶'}
          </button>
          
          <button
            onClick={toggleRecording}
            className={`w-10 h-10 rounded-lg font-bold transition-all shadow-lg flex items-center justify-center text-lg border-2 ${
              isRecording
                ? 'bg-gradient-to-r from-red-500 to-red-600 text-white animate-pulse border-red-400 shadow-red-500/50'
                : 'bg-gradient-to-br from-[#1f1f1f] to-[#151515] border-gray-700 text-red-400 hover:bg-red-500/10 hover:border-red-500/50 hover:text-red-300'
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
        <div className="flex items-center gap-2">
          <button
            onClick={() => setZoom(10)}
            className="px-2 py-1 text-[10px] bg-[#1f1f1f] text-gray-400 rounded hover:bg-[#252525] hover:text-cyan-400 transition-all border border-gray-800"
            title="Zoom out (10px/s)"
          >
            10x
          </button>
          <button
            onClick={() => setZoom(50)}
            className="px-2 py-1 text-[10px] bg-[#1f1f1f] text-gray-400 rounded hover:bg-[#252525] hover:text-cyan-400 transition-all border border-gray-800"
            title="1:1 (50px/s)"
          >
            1:1
          </button>
          <button
            onClick={() => setZoom(100)}
            className="px-2 py-1 text-[10px] bg-[#1f1f1f] text-gray-400 rounded hover:bg-[#252525] hover:text-cyan-400 transition-all border border-gray-800"
            title="Zoom in (100px/s)"
          >
            2x
          </button>
          <button
            onClick={zoomToFit}
            className="px-2 py-1 text-[10px] bg-[#1f1f1f] text-cyan-400 rounded hover:bg-cyan-500/10 hover:text-cyan-300 transition-all border border-cyan-500/30"
            title="Fit all clips to window"
          >
            🖌️ Fit
          </button>
          <div className="w-px h-6 bg-[#2a2a2a]" />
          <span className="text-[10px] text-gray-600">🔍</span>
          <input
            type="range"
            min="10"
            max="200"
            value={zoom}
            onChange={(e) => handleZoomChange(parseInt(e.target.value))}
            className="w-20 h-1"
            title="Timeline zoom"
          />
          <span className="text-cyan-400 font-mono text-xs w-10 text-right">{zoom}</span>
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
            className="h-8 bg-[#0f0f0f] border-b border-[#1f1f1f] cursor-pointer hover:bg-[#141414] relative flex-shrink-0"
            onClick={handleRulerClick}
            title="Click to seek"
          >
            <div className="absolute inset-0 overflow-x-auto overflow-y-hidden" style={{ width: '100%' }}>
              <div className="relative h-full" style={{ width: `${600 * zoom}px` }}>
                {(() => {
                  const totalSeconds = 600;
                  const interval = zoom < 20 ? 10 : zoom < 50 ? 5 : zoom < 100 ? 2 : 1;
                  const markers: React.ReactElement[] = [];
                  for (let sec = 0; sec <= totalSeconds; sec += interval) {
                    markers.push(
                      <div 
                        key={sec} 
                        className="absolute top-0 h-full flex items-center pl-1 text-xs text-gray-500 border-l border-[#1f1f1f]/30" 
                        style={{ left: `${sec * zoom}px` }}
                      >
                        {sec}s
                      </div>
                    );
                  }
                  return markers;
                })()}
              </div>
            </div>
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
            
            {/* Professional Beat Grid Lines - Memoized for Performance */}
            {useMemo(() => {
              const beatDuration = 60 / bpm;
              const barDuration = beatDuration * 4;
              const totalDuration = 600;
              const gridLines: React.ReactElement[] = [];
              
              // Show different grid density based on zoom
              const showBeats = zoom >= 40;
              const showBars = true;
              
              for (let time = 0; time <= totalDuration; time += beatDuration) {
                const isBar = Math.abs(time % barDuration) < 0.01;
                if (isBar || (showBeats && snapEnabled)) {
                  gridLines.push(
                    <div
                      key={`grid-${time}`}
                      className="absolute top-0 bottom-0 pointer-events-none"
                      style={{
                        left: `${time * zoom}px`,
                        width: '1px',
                        background: isBar 
                          ? 'rgba(100, 200, 255, 0.15)' 
                          : 'rgba(100, 200, 255, 0.05)'
                      }}
                    />
                  );
                }
              }
              return gridLines;
            }, [bpm, zoom, snapEnabled])}
            
            {/* Legacy Grid Lines (when snap enabled) */}
            {false && snapEnabled && (
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
              (() => {
                // Virtual scrolling: only render visible tracks
                const TRACK_HEIGHT = 96;
                const containerHeight = timelineRef.current?.clientHeight || 800;
                const visibleCount = Math.ceil(containerHeight / TRACK_HEIGHT) + 2; // +2 for buffer
                const scrollTop = timelineRef.current?.scrollTop || 0;
                const startIndex = Math.max(0, Math.floor(scrollTop / TRACK_HEIGHT) - 1);
                const endIndex = Math.min(tracks.length, startIndex + visibleCount);
                const visibleTracks = tracks.slice(startIndex, endIndex);
                
                return visibleTracks.map((track, idx) => {
                  const trackIndex = startIndex + idx;
                const trackHeight = trackHeights[track.id] || 96;
                const isSelected = selectedTrackId === track.id;
                return (
                <div
                  key={track.id}
                  className="border-b border-[#1f1f1f] relative group hover:bg-[#0f0f0f] flex"
                  style={{ height: `${trackHeight}px` }}
                  onClick={() => setSelectedTrackId(track.id)}
                  onMouseMove={handleTrackResizeMove}
                  onMouseUp={handleTrackResizeEnd}
                  onMouseLeave={handleTrackResizeEnd}
                >
                  {/* Track Header - Minimal Inline */}
                  <div className="w-60 flex-shrink-0 border-r border-[#1f1f1f] bg-[#0a0a0a] flex items-center px-2 gap-2">
                    <div className="w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold text-cyan-400 bg-gray-900">
                      {trackIndex + 1}
                    </div>
                    <div 
                      className="w-3 h-3 rounded" 
                      style={{ backgroundColor: track.color }}
                    />
                    <span 
                      className="text-xs font-medium text-white/90 truncate flex-1" 
                      title={track.name}
                    >
                      {track.name}
                    </span>

                    {/* VU Meter - Compact */}
                    <div className="w-12 h-1 bg-gray-900 rounded-full overflow-hidden">
                      <div 
                        className="h-full transition-all duration-75"
                        style={{ 
                          width: `${(vuLevels[track.id] || 0) * 100}%`,
                          backgroundColor: vuLevels[track.id] > 0.85 ? '#ef4444' : vuLevels[track.id] > 0.6 ? '#eab308' : '#22c55e'
                        }}
                      />
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
                                renderWaveform(canvas, clip.buffer, selectedClipId === clip.id ? '#00bcd4' : track.color, clip.id);
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
                  
                  {/* Track Resize Handle */}
                  <div
                    className="absolute bottom-0 left-0 right-0 h-1 cursor-ns-resize hover:bg-cyan-500/30 active:bg-cyan-500/50 transition-colors z-20 group/resize"
                    onMouseDown={(e) => handleTrackResizeStart(e, track.id)}
                    title="Drag to resize track height"
                  >
                    <div className="absolute inset-x-0 bottom-0 h-px bg-cyan-500/0 group-hover/resize:bg-cyan-500/50 transition-colors" />
                  </div>
                </div>
              );
            });
          })()
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
        <div className="flex items-center gap-4 text-xs">
          <button 
            onClick={() => setShowShortcuts(true)}
            className="hover:text-cyan-400 transition-colors"
            title="Keyboard Shortcuts (Cmd+/)">
            ⌨️ Shortcuts
          </button>
          <button 
            onClick={() => setShowMiniMap(!showMiniMap)}
            className="hover:text-cyan-400 transition-colors"
            title="Toggle Mini-map">
            🗺️ {showMiniMap ? 'Hide' : 'Show'} Map
          </button>
          {isSaving ? (
            <>
              <span className="animate-spin text-cyan-400">⏳</span>
              <span className="text-cyan-400">Saving...</span>
            </>
          ) : lastSaved ? (
            <>
              <span className="text-green-400">✔</span>
              <span className="text-gray-500">Saved {Math.floor((Date.now() - lastSaved.getTime()) / 1000)}s ago</span>
            </>
          ) : null}
        </div>
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
      
      {/* Keyboard Shortcuts Modal */}
      {showShortcuts && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[100]" onClick={() => setShowShortcuts(false)}>
          <div className="bg-[#0f0f0f] border-2 border-cyan-500/30 rounded-2xl p-8 max-w-2xl w-full m-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400">⌨️ Keyboard Shortcuts</h2>
              <button onClick={() => setShowShortcuts(false)} className="text-gray-400 hover:text-white text-2xl">✕</button>
            </div>
            <div className="grid grid-cols-2 gap-6 max-h-[70vh] overflow-y-auto">
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-cyan-400 uppercase tracking-wider mb-2">Playback</h3>
                <div className="flex justify-between"><span className="text-gray-400">Space</span><span className="font-mono text-sm text-white">Play/Pause</span></div>
                <div className="flex justify-between"><span className="text-gray-400">S</span><span className="font-mono text-sm text-white">Stop</span></div>
                <div className="flex justify-between"><span className="text-gray-400">R</span><span className="font-mono text-sm text-white">Record</span></div>
              </div>
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-cyan-400 uppercase tracking-wider mb-2">Editing</h3>
                <div className="flex justify-between"><span className="text-gray-400">Cmd/Ctrl + C</span><span className="font-mono text-sm text-white">Copy Clip</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Cmd/Ctrl + V</span><span className="font-mono text-sm text-white">Paste Clip</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Cmd/Ctrl + X</span><span className="font-mono text-sm text-white">Cut Clip</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Delete</span><span className="font-mono text-sm text-white">Delete Clip</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Cmd/Ctrl + E</span><span className="font-mono text-sm text-white">Split Clip</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Cmd/Ctrl + Z</span><span className="font-mono text-sm text-white">Undo</span></div>
              </div>
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-cyan-400 uppercase tracking-wider mb-2">Project</h3>
                <div className="flex justify-between"><span className="text-gray-400">Cmd/Ctrl + S</span><span className="font-mono text-sm text-white">Save Project</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Cmd/Ctrl + O</span><span className="font-mono text-sm text-white">Open Project</span></div>
              </div>
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-cyan-400 uppercase tracking-wider mb-2">Help</h3>
                <div className="flex justify-between"><span className="text-gray-400">?</span><span className="font-mono text-sm text-white">Show Shortcuts</span></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mini-Map Overview */}
      {showMiniMap && tracks.length > 0 && (
        <div className="fixed bottom-4 right-4 w-64 bg-[#0a0a0a]/95 border border-cyan-500/30 rounded-lg p-3 shadow-2xl backdrop-blur-sm z-50">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-wider">Overview</h3>
            <button onClick={() => setShowMiniMap(false)} className="text-gray-500 hover:text-white text-sm">✕</button>
          </div>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {tracks.map((track, idx) => {
              const totalDuration = Math.max(...track.clips.map(c => c.startTime + c.duration), 30);
              return (
                <div key={track.id} className="flex items-center gap-2 text-xs">
                  <div className="w-3 h-3 rounded" style={{ backgroundColor: track.color }} />
                  <span className="text-gray-400 flex-1 truncate">{track.name}</span>
                  <span className="text-gray-600 font-mono">{track.clips.length}</span>
                </div>
              );
            })}
          </div>
          <div className="mt-3 pt-3 border-t border-gray-800 text-xs text-gray-500">
            <div className="flex justify-between">
              <span>Tracks</span>
              <span className="text-white font-mono">{tracks.length}</span>
            </div>
            <div className="flex justify-between">
              <span>Total Clips</span>
              <span className="text-white font-mono">{tracks.reduce((sum, t) => sum + t.clips.length, 0)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Loading Overlay */}
      {isLoading && <LoadingSpinner message={loadingMessage} />}
    </div>
  );
}
