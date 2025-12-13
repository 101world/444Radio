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
import AnimatedBackground from '@/app/components/AnimatedBackground';
import Tooltip from '@/app/components/Tooltip';
import { toast } from '@/lib/toast';
import { theme, buttonStyles } from '@/lib/design-system';

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
      img.onerror = () => console.warn('[Waveform] Cache image load failed for', clipId);
      img.src = cachedDataUrl;
      return;
    }
  }

  // Render using professional renderer (optimized with RAF)
  requestAnimationFrame(() => {
    const renderer = new ProfessionalWaveformRenderer(canvas, {
      width: canvas.width,
      height: canvas.height,
      backgroundColor: 'transparent',
      waveColor: color,
      progressColor: color + 'CC', // More opaque for better visibility
      showRMS: true,
      showPeaks: true
    });

    const samplesPerPixel = Math.max(1, Math.ceil(audioBuffer.length / canvas.width));
    renderer.generateWaveformData(audioBuffer, samplesPerPixel);
    renderer.render();

    // Cache the result in idle time to avoid blocking main thread
    if (clipId && 'requestIdleCallback' in window) {
      requestIdleCallback(() => {
        try {
          const dataUrl = canvas.toDataURL('image/png');
          setCachedWaveform(clipId, dataUrl);
        } catch (e) {
          console.warn('[Waveform] Cache failed:', e);
        }
      }, { timeout: 2000 });
    }
  });
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
  const [editingTrackId, setEditingTrackId] = useState<string | null>(null);
  const [editingTrackName, setEditingTrackName] = useState<string>('');
  const [userProjects, setUserProjects] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false);
  const [draggedClip, setDraggedClip] = useState<{trackId: string, clipId: string, startX: number, initialStartTime: number} | null>(null);
  const [clipboardClip, setClipboardClip] = useState<{trackId: string, clip: any} | null>(null);
  const [projectName, setProjectName] = useState('');
  const [exportFormat, setExportFormat] = useState<'wav' | 'mp3'>('wav');
  const [exportQuality, setExportQuality] = useState('44100');
  const [showBpmModal, setShowBpmModal] = useState(false);
  const [tempBpm, setTempBpm] = useState(120);
  const [metronomeEnabled, setMetronomeEnabled] = useState(false);
  const [metronomeVolume, setMetronomeVolume] = useState(0.5);
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
  const [bufferPool, setBufferPool] = useState<Map<string, {buffer: AudioBuffer, lastUsed: number}>>(new Map());
  const [memoryPressure, setMemoryPressure] = useState(false);
  const rafRef = useRef<number | undefined>(undefined);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const analyserNodesRef = useRef<Record<string, AnalyserNode>>({});
  const lastRafTime = useRef<number>(0);
  const timelineRef = useRef<HTMLDivElement>(null);
  const playheadRef = useRef<HTMLDivElement>(null);
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
      
      // Cleanup waveform cache and buffer pool
      waveformCache.clear();
      bufferPool.clear();
      
      // Cancel any pending animations
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
      if (autoSaveTimerRef.current) {
        clearInterval(autoSaveTimerRef.current);
      }
    };
  }, [user?.id, waveformCache, bufferPool]);

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

  // Playhead animation - optimized with transform + auto-scroll
  useEffect(() => {
    if (!daw) return;

    const updatePlayhead = (time: number) => {
      setPlayhead(time);
      // Update visual position via transform (no re-render)
      if (playheadRef.current) {
        playheadRef.current.style.transform = `translateX(${time * zoom}px)`;
      }
      
      // Auto-scroll timeline to follow playhead
      if (timelineRef.current && isPlaying) {
        const container = timelineRef.current;
        const playheadPixel = time * zoom;
        const scrollLeft = container.scrollLeft;
        const containerWidth = container.clientWidth;
        
        // Scroll when playhead gets close to right edge (80% of visible area)
        if (playheadPixel > scrollLeft + containerWidth * 0.8) {
          container.scrollLeft = playheadPixel - containerWidth * 0.2; // Keep playhead at 20% from left
        }
        // Scroll back when playhead goes before visible area
        else if (playheadPixel < scrollLeft) {
          container.scrollLeft = playheadPixel - containerWidth * 0.2;
        }
      }
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
      
      // Update visual position via transform
      if (playheadRef.current) {
        playheadRef.current.style.transform = `translateX(${currentPlayhead * zoom}px)`;
      }
      
      // Auto-scroll timeline to follow playhead during playback
      if (timelineRef.current && daw.isPlaying()) {
        const container = timelineRef.current.querySelector('.overflow-auto') as HTMLElement;
        if (container) {
          const playheadPixel = currentPlayhead * zoom;
          const scrollLeft = container.scrollLeft;
          const containerWidth = container.clientWidth;
          
          // Smooth scroll when playhead approaches edge
          if (playheadPixel > scrollLeft + containerWidth * 0.75) {
            container.scrollLeft = playheadPixel - containerWidth * 0.25;
          } else if (playheadPixel < scrollLeft + containerWidth * 0.1) {
            container.scrollLeft = Math.max(0, playheadPixel - containerWidth * 0.25);
          }
        }
      }
      
      // Check loop boundaries
      if (loopEnabled && daw.isPlaying() && currentPlayhead >= loopEnd) {
        daw.seekTo(loopStart);
        setPlayhead(loopStart);
        if (playheadRef.current) {
          playheadRef.current.style.transform = `translateX(${loopStart * zoom}px)`;
        }
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
      if (playheadRef.current) {
        playheadRef.current.style.transform = 'translateX(0px)';
      }
    });

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      daw.off('playheadUpdate', updatePlayhead);
    };
  }, [daw, loopEnabled, loopStart, loopEnd, zoom, isPlaying]);

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
    // Handle playhead dragging - optimized with transform
    if (isDraggingPlayhead && daw) {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const x = e.clientX - rect.left;
      const timeInSeconds = Math.max(0, x / zoom);
      daw.seekTo(timeInSeconds);
      setPlayhead(timeInSeconds);
      // Update visual position immediately
      if (playheadRef.current) {
        playheadRef.current.style.transform = `translateX(${timeInSeconds * zoom}px)`;
      }
    }
    
    // Handle clip dragging - throttled updates for smoothness
    if (draggedClip && daw) {
      const deltaX = e.clientX - draggedClip.startX;
      const deltaTime = deltaX / zoom;
      const rawStartTime = Math.max(0, draggedClip.initialStartTime + deltaTime);
      const newStartTime = snapEnabled ? snapTime(rawStartTime) : rawStartTime;
      
      // Throttle state updates with RAF
      if (!rafRef.current) {
        rafRef.current = requestAnimationFrame(() => {
          const track = tracks.find(t => t.id === draggedClip.trackId);
          const clip = track?.clips.find(c => c.id === draggedClip.clipId);
          if (clip) {
            clip.startTime = newStartTime;
            setTracks([...daw.getTracks()]);
          }
          rafRef.current = undefined;
        });
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
    // Force complete re-render to update grid spacing
    const currentTracks = daw.getTracks();
    setTracks([...currentTracks]);
    console.log('[BPM] Updated to:', newBpm, 'tracks refreshed');
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

  const cleanupUnusedBuffers = useCallback(() => {
    const now = Date.now();
    const BUFFER_TIMEOUT = 5 * 60 * 1000; // 5 minutes
    
    setBufferPool(prev => {
      const newPool = new Map(prev);
      const activeClipIds = new Set<string>();
      
      // Collect active clip IDs
      tracks.forEach(track => {
        track.clips.forEach(clip => activeClipIds.add(clip.id));
      });
      
      // Remove buffers not used in last 5 minutes and not in active clips
      for (const [id, data] of newPool.entries()) {
        if (!activeClipIds.has(id) && now - data.lastUsed > BUFFER_TIMEOUT) {
          newPool.delete(id);
        }
      }
      
      return newPool;
    });
  }, [tracks]);

  const checkMemoryPressure = useCallback(() => {
    // Simple heuristic: check buffer pool size
    const bufferCount = bufferPool.size;
    const threshold = 100; // Maximum 100 buffers in memory
    
    if (bufferCount > threshold) {
      setMemoryPressure(true);
      cleanupUnusedBuffers();
    } else {
      setMemoryPressure(false);
    }
  }, [bufferPool.size, cleanupUnusedBuffers]);

  // Periodic buffer cleanup
  useEffect(() => {
    const interval = setInterval(() => {
      cleanupUnusedBuffers();
      checkMemoryPressure();
    }, 60000); // Every minute
    
    return () => clearInterval(interval);
  }, [cleanupUnusedBuffers, checkMemoryPressure]);

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
    const snappedTime = Math.round(time / beatDuration) * beatDuration;
    return Math.max(0, snappedTime); // Ensure non-negative
  };

  // Mobile detection
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return (
    <div className="h-screen flex flex-col bg-black text-gray-200 overflow-hidden">
      {/* Mobile Warning Modal */}
      {isMobile && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl flex items-center justify-center z-[100] p-6 animate-in fade-in duration-300">
          <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0f0f0f] border-2 border-cyan-500/30 rounded-2xl p-8 max-w-lg shadow-2xl shadow-cyan-500/20 animate-in zoom-in-95 duration-300">
            <div className="text-6xl mb-6 text-center">🖥️</div>
            <h2 className="text-3xl font-bold text-white mb-4 text-center bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
              Desktop Required
            </h2>
            <p className="text-gray-300 mb-6 text-center leading-relaxed">
              The Multi-Track DAW requires a desktop computer for optimal performance. Features like precision editing, multiple tracks, and professional audio processing work best on larger screens.
            </p>
            <div className="space-y-3 mb-6">
              <div className="flex items-center gap-3 text-sm text-gray-400">
                <span className="text-cyan-400 text-lg">✓</span>
                <span>Recommended: 1920x1080 or higher resolution</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-gray-400">
                <span className="text-cyan-400 text-lg">✓</span>
                <span>Keyboard shortcuts for faster workflow</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-gray-400">
                <span className="text-cyan-400 text-lg">✓</span>
                <span>Mouse/trackpad for precise editing</span>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => window.location.href = '/create'}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-cyan-500 to-cyan-600 text-black font-bold rounded-lg hover:from-cyan-400 hover:to-cyan-500 transition-all shadow-lg shadow-cyan-500/30"
              >
                Try Simple Creator
              </button>
              <button
                onClick={() => setIsMobile(false)}
                className="flex-1 px-6 py-3 bg-[#1f1f1f] text-gray-300 font-bold rounded-lg hover:bg-[#252525] border-2 border-gray-700 hover:border-cyan-500/50 transition-all"
              >
                Continue Anyway
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top Toolbar - Enhanced */}
      <header className="h-14 bg-[#0a0a0a] border-b border-cyan-500/20 flex items-center px-4 gap-3 flex-shrink-0">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500 to-cyan-600 flex items-center justify-center shadow-lg shadow-cyan-500/30">
            <span className="text-sm">🎵</span>
          </div>
          <div className="text-sm font-bold text-white">444 STUDIO</div>
        </div>

        {/* Transport Controls */}
        <div className="flex items-center gap-2">
          <Tooltip content="Stop & Rewind" shortcut="S">
            <button
              onClick={() => { stop(); setPlayhead(0); }}
              className="w-10 h-10 bg-gradient-to-br from-[#1a1a1a] to-[#0f0f0f] border border-gray-700 text-gray-300 rounded-lg hover:border-gray-600 hover:text-white transition-all shadow-lg flex items-center justify-center text-lg"
            >
              <span>⏹</span>
            </button>
          </Tooltip>
          
          <Tooltip content={isPlaying ? 'Pause' : 'Play'} shortcut="Space">
            <button
              onClick={togglePlay}
              className={`w-12 h-10 rounded-lg font-bold transition-all shadow-xl flex items-center justify-center text-xl border ${
                isPlaying
                  ? 'bg-gradient-to-r from-cyan-500 to-cyan-600 text-white shadow-cyan-500/50 border-cyan-400'
                  : 'bg-gradient-to-r from-cyan-500/20 to-cyan-600/20 text-cyan-400 border-cyan-500/50 hover:from-cyan-500/30 hover:to-cyan-600/30'
              }`}
            >
              {isPlaying ? '⏸' : '▶'}
            </button>
          </Tooltip>
          
          <Tooltip content={isRecording ? 'Stop Recording' : 'Record'} shortcut="R">
            <button
              onClick={toggleRecording}
              className={`w-10 h-10 rounded-lg transition-all shadow-lg flex items-center justify-center text-xl border ${
                isRecording
                  ? 'bg-red-500 text-white border-red-400 animate-pulse'
                  : 'bg-[#1a1a1a] border-gray-700 text-red-400 hover:bg-red-500/20 hover:border-red-500/50'
              }`}
            >
              <span>●</span>
            </button>
          </Tooltip>
        </div>

        <div className="w-px h-8 bg-gradient-to-b from-transparent via-gray-700 to-transparent" />

        {/* Loop & Metronome */}
        <div className="flex gap-1.5">
          <button
            onClick={() => setLoopEnabled(!loopEnabled)}
            className={`px-3 h-8 rounded-lg transition-all border text-xs font-bold ${
              loopEnabled 
                ? 'bg-cyan-500/30 text-cyan-300 border-cyan-500/50 shadow-lg shadow-cyan-500/20' 
                : 'bg-[#1a1a1a] text-gray-500 border-gray-700 hover:bg-cyan-500/10 hover:text-cyan-400 hover:border-cyan-500/30'
            }`}
          >
            🔁 {loopEnabled ? 'ON' : 'OFF'}
          </button>
          <button
            onClick={() => setMetronomeEnabled(!metronomeEnabled)}
            className={`px-3 h-8 rounded-lg transition-all border text-xs font-bold ${
              metronomeEnabled 
                ? 'bg-cyan-500/30 text-cyan-300 border-cyan-500/50 shadow-lg shadow-cyan-500/20' 
                : 'bg-[#1a1a1a] text-gray-500 border-gray-700 hover:bg-cyan-500/10 hover:text-cyan-400 hover:border-cyan-500/30'
            }`}
            title="Metronome"
          >
            🎯 {metronomeEnabled ? 'ON' : 'OFF'}
          </button>
        </div>

        <div className="w-px h-8 bg-gradient-to-b from-transparent via-gray-700 to-transparent" />

        {/* Time & BPM Display */}
        <div className="flex items-center gap-3 px-4 h-9 bg-black/40 rounded-lg border border-cyan-500/20">
          <div className="text-sm font-mono text-cyan-400 font-bold tracking-wider tabular-nums">{formatTime(playhead)}</div>
          <div className="w-px h-5 bg-cyan-500/30" />
          <button
            onClick={() => {
              setTempBpm(bpm);
              setShowBpmModal(true);
            }}
            className="flex items-center gap-1.5 hover:bg-white/5 px-2 py-1 rounded transition-all"
            title="Click to adjust BPM"
          >
            <span className="text-[10px] text-gray-500 font-semibold uppercase">BPM</span>
            <span className="text-sm text-white font-bold tabular-nums">{bpm}</span>
          </button>
        </div>

        <div className="w-px h-8 bg-gradient-to-b from-transparent via-gray-700 to-transparent" />

        {/* Zoom Controls */}
        <div className="flex items-center gap-2 px-3 h-9 bg-black/40 rounded-lg border border-white/10">
          <span className="text-[9px] text-gray-500 font-bold uppercase">Zoom</span>
          <button
            onClick={() => setZoom(Math.max(5, zoom - 10))}
            className="w-6 h-6 text-xs bg-white/5 hover:bg-white/10 text-gray-400 hover:text-cyan-400 rounded transition-all border border-white/10 hover:border-cyan-500/50 font-bold"
          >
            −
          </button>
          <div className="flex gap-1">
            <button
              onClick={() => setZoom(10)}
              className={`px-2 py-1 text-[10px] rounded transition-all border ${
                zoom === 10 
                  ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/50' 
                  : 'bg-[#1a1a1a] text-gray-400 border-gray-800 hover:bg-[#202020] hover:text-cyan-400'
              }`}
            >
              10x
            </button>
            <button
              onClick={() => setZoom(25)}
              className={`px-2 py-1 text-[10px] rounded transition-all border ${
                zoom === 25 
                  ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/50' 
                  : 'bg-[#1a1a1a] text-gray-400 border-gray-800 hover:bg-[#202020] hover:text-cyan-400'
              }`}
            >
              25x
            </button>
            <button
              onClick={() => setZoom(50)}
              className={`px-2 py-1 text-[10px] rounded transition-all border ${
                zoom === 50 
                  ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/50' 
                  : 'bg-[#1a1a1a] text-gray-400 border-gray-800 hover:bg-[#202020] hover:text-cyan-400'
              }`}
            >
              1:1
            </button>
          </div>
          <button
            onClick={() => setZoom(Math.min(200, zoom + 10))}
            className="w-6 h-6 text-xs bg-white/5 hover:bg-white/10 text-gray-400 hover:text-cyan-400 rounded transition-all border border-white/10 hover:border-cyan-500/50 font-bold"
          >
            +
          </button>
          <button
            onClick={zoomToFit}
            className="px-3 py-1 text-[10px] bg-gradient-to-r from-cyan-500/20 to-cyan-600/20 text-cyan-400 rounded hover:from-cyan-500/30 hover:to-cyan-600/30 transition-all border border-cyan-500/30 font-semibold"
          >
            🎯 Fit
          </button>
        </div>

        <div className="w-px h-8 bg-gradient-to-b from-transparent via-gray-700 to-transparent" />

        {/* Snap Grid */}
        <button
          onClick={() => setSnapEnabled(!snapEnabled)}
          className={`px-3 h-8 rounded-lg transition-all border text-xs font-bold ${
            snapEnabled 
              ? 'bg-cyan-500/30 text-cyan-300 border-cyan-500/50 shadow-lg shadow-cyan-500/20' 
              : 'bg-[#1a1a1a] text-gray-500 border-gray-700 hover:bg-cyan-500/10 hover:text-cyan-400 hover:border-cyan-500/30'
          }`}
        >
          🧲 {snapEnabled ? 'ON' : 'OFF'}
        </button>

        <div className="flex-1" />

        {/* Project Controls */}
        <div className="flex gap-1.5">
          <button
            onClick={() => setShowSaveModal(true)}
            className="px-3 h-9 rounded-lg bg-[#1a1a1a] text-gray-300 hover:bg-[#202020] hover:text-cyan-400 border border-gray-700 hover:border-cyan-500/50 transition-all font-semibold text-xs"
          >
            💾 Save
          </button>
          <button
            onClick={() => setShowLoadModal(true)}
            className="px-3 h-9 rounded-lg bg-[#1a1a1a] text-gray-300 hover:bg-[#202020] hover:text-cyan-400 border border-gray-700 hover:border-cyan-500/50 transition-all font-semibold text-xs"
          >
            📂 Load
          </button>
          <button
            onClick={() => setShowExportModal(true)}
            className="px-3 h-9 rounded-lg bg-gradient-to-r from-cyan-500 to-cyan-600 text-black hover:from-cyan-400 hover:to-cyan-500 transition-all font-bold text-xs shadow-lg shadow-cyan-500/30"
          >
            📤 Export
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Track Sidebar - Enhanced */}
        <div className="w-64 bg-gradient-to-b from-[#0a0a0a] to-[#050505] border-r border-cyan-500/20 flex flex-col flex-shrink-0 shadow-2xl shadow-black/50">
          {/* Track Header */}
          <div className="h-12 px-3 border-b border-cyan-500/10 flex items-center gap-2 bg-[#0a0a0a]">
            <button
              onClick={addTrack}
              className="flex-1 h-8 bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-black rounded-lg transition-all shadow-lg hover:shadow-cyan-500/50 font-semibold text-sm flex items-center justify-center gap-1.5"
            >
              <span>➕</span>
              <span>Track</span>
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
              className="flex-1 h-8 bg-white/5 hover:bg-white/10 text-cyan-400 border border-white/10 hover:border-cyan-500/50 rounded-lg transition-all font-semibold text-sm flex items-center justify-center gap-1.5"
            >
              <span>📁</span>
              <span>Upload</span>
            </button>
          </div>

          {/* Minimal Track List */}
          <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-white/5 scrollbar-track-transparent">
            {tracks.length === 0 ? (
              <div className="flex items-center justify-center h-full p-4">
                <div className="text-center text-gray-600 text-xs">
                  No tracks
                </div>
              </div>
            ) : (
              tracks.map((track, index) => {
                const isTrackActive = isPlaying && !track.muted && track.clips.some(clip => 
                  playhead >= clip.startTime && playhead <= clip.startTime + clip.duration
                );
                
                return (
                <div
                  key={track.id}
                  className={`p-3 border-b border-cyan-500/10 cursor-pointer transition-all ${
                    selectedTrackId === track.id
                      ? 'bg-cyan-500/10 border-l-2 border-l-cyan-500'
                      : 'hover:bg-white/[0.02] border-l-2 border-l-transparent hover:border-l-cyan-500/30'
                  } ${
                    isTrackActive ? 'ring-1 ring-inset ring-cyan-500/30' : ''
                  }`}
                  style={{ minHeight: '88px' }}
                  onClick={() => setSelectedTrackId(track.id)}
                >
                  {/* Track Header */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {/* Track Number */}
                      <div className={`w-6 h-6 rounded flex-shrink-0 flex items-center justify-center text-[10px] font-bold ${
                        isTrackActive 
                          ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/50' 
                          : 'bg-white/5 text-cyan-400 border border-white/10'
                      }`}>
                        {isTrackActive ? '▶' : index + 1}
                      </div>
                      
                      {/* Color Indicator */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedColorTrackId(track.id);
                          setShowColorPicker(true);
                        }}
                        className="w-6 h-6 rounded flex-shrink-0 border-2 border-white/30 hover:border-cyan-500/60 transition-all"
                        style={{ backgroundColor: track.color }}
                      />
                      
                      {/* Track Icon & Name */}
                      <div className="flex items-center gap-1.5 flex-1 min-w-0">
                        <span className="text-sm">{track.type === 'midi' ? '🎹' : '🎤'}</span>
                        {editingTrackId === track.id ? (
                          <input
                            type="text"
                            value={editingTrackName}
                            onChange={(e) => setEditingTrackName(e.target.value)}
                            onBlur={() => {
                              if (editingTrackName.trim()) {
                                daw?.updateTrack(track.id, { name: editingTrackName.trim() });
                                setTracks(daw?.getTracks() || []);
                              }
                              setEditingTrackId(null);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.currentTarget.blur();
                              } else if (e.key === 'Escape') {
                                setEditingTrackId(null);
                              }
                            }}
                            autoFocus
                            className="text-sm font-bold text-white bg-cyan-500/20 border border-cyan-500/50 rounded px-1 py-0.5 flex-1 focus:outline-none focus:ring-1 focus:ring-cyan-400"
                            onClick={(e) => e.stopPropagation()}
                          />
                        ) : (
                          <span 
                            className="text-sm font-bold text-white truncate flex-1 cursor-text hover:text-cyan-400 transition-colors"
                            onDoubleClick={(e) => {
                              e.stopPropagation();
                              setEditingTrackId(track.id);
                              setEditingTrackName(track.name);
                            }}
                          >
                            {track.name}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    {/* Mute/Solo/Delete Buttons */}
                    <div className="flex gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleMute(track.id);
                        }}
                        className={`w-6 h-6 text-[10px] font-bold rounded transition-all ${
                          track.muted
                            ? 'bg-red-500 text-white shadow-lg shadow-red-500/30'
                            : 'bg-[#1a1a1a] text-gray-500 hover:bg-red-500/20 hover:text-red-400'
                        }`}
                      >
                        M
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSolo(track.id);
                        }}
                        className={`w-6 h-6 text-[10px] font-bold rounded transition-all ${
                          track.solo
                            ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/30'
                            : 'bg-[#1a1a1a] text-gray-500 hover:bg-cyan-500/20 hover:text-cyan-400'
                        }`}
                      >
                        S
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteTrack(track.id);
                        }}
                        className="w-6 h-6 text-xs hover:bg-red-500/20 rounded transition-all hover:scale-110"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>

                  {/* Track Info */}
                  <div className="flex items-center gap-2 text-[10px] text-gray-500 mb-1.5">
                    <span className="px-1.5 py-0.5 bg-[#1a1a1a] rounded font-mono uppercase">
                      {track.type}
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="text-cyan-400">{track.clips.length}</span>
                      {track.clips.length === 1 ? 'clip' : 'clips'}
                    </span>
                  </div>

                  {/* Volume Fader */}
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[9px] text-gray-600 font-bold uppercase w-7">Vol</span>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={track.volume * 100}
                      onChange={(e) => {
                        e.stopPropagation();
                        updateTrackVolume(track.id, parseInt(e.target.value));
                      }}
                      className="flex-1 h-1.5 bg-gradient-to-r from-gray-800 to-gray-700 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-gradient-to-br [&::-webkit-slider-thumb]:from-cyan-400 [&::-webkit-slider-thumb]:to-cyan-600 [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:shadow-cyan-500/50"
                      onClick={(e) => e.stopPropagation()}
                    />
                    <span className="text-[9px] text-cyan-400 font-mono font-bold w-8 text-right">
                      {Math.round(track.volume * 100)}
                    </span>
                  </div>

                  {/* Pan Control */}
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] text-gray-600 font-bold uppercase w-7">Pan</span>
                    <input
                      type="range"
                      min="-100"
                      max="100"
                      value={(track.pan || 0) * 100}
                      onChange={(e) => {
                        e.stopPropagation();
                        const pan = parseInt(e.target.value) / 100;
                        daw?.setTrackPan(track.id, pan);
                        setTracks(daw?.getTracks() || []);
                      }}
                      className="flex-1 h-1.5 bg-gradient-to-r from-cyan-900/30 via-gray-800 to-cyan-900/30 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-gradient-to-br [&::-webkit-slider-thumb]:from-cyan-400 [&::-webkit-slider-thumb]:to-cyan-600 [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:shadow-cyan-500/50"
                      onClick={(e) => e.stopPropagation()}
                    />
                    <span className="text-[9px] text-cyan-400 font-mono font-bold w-8 text-right">
                      {(track.pan || 0) === 0 ? 'C' : (track.pan || 0) > 0 ? `R${Math.round((track.pan || 0) * 100)}` : `L${Math.abs(Math.round((track.pan || 0) * 100))}`}
                    </span>
                  </div>
                </div>
                );
              })
            )}
          </div>
        </div>

        {/* Timeline Area */}
        <div className="flex-1 flex flex-col bg-black overflow-hidden" ref={timelineRef}>
          {/* Numbered Bar Ruler - AIODE Style */}
          <div 
            className="h-8 bg-[#111111] border-b border-white/10 cursor-pointer relative flex-shrink-0"
            onClick={handleRulerClick}
          >
            <div className="absolute inset-0 overflow-x-auto overflow-y-hidden scrollbar-none" style={{ width: '100%' }}>
              <div className="relative h-full flex items-center" style={{ width: `${600 * zoom}px` }}>
                {useMemo(() => {
                  const beatDuration = 60 / bpm;
                  const barDuration = beatDuration * 4;
                  const totalDuration = 600;
                  const totalBars = Math.ceil(totalDuration / barDuration);
                  const markers: React.ReactElement[] = [];
                  
                  // Show numbered bars (1, 2, 3, 4...)
                  for (let bar = 0; bar <= totalBars; bar++) {
                    const time = bar * barDuration;
                    if (time > totalDuration) break;
                    
                    markers.push(
                      <div 
                        key={`bar-${bar}`} 
                        className="absolute top-0 h-full flex items-center border-l border-white/20" 
                        style={{ left: `${time * zoom}px` }}
                      >
                        <div className="text-[10px] text-gray-500 font-mono px-2">
                          {bar + 1}
                        </div>
                      </div>
                    );
                  }
                  
                  return markers;
                }, [zoom, bpm])}
              </div>
            </div>
          </div>

          {/* Track Lanes */}
          <div className="flex-1 relative bg-[#080808] overflow-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent" 
               onMouseMove={handleTimelineMouseMove}
               onMouseUp={handleTimelineMouseUp}
               onMouseLeave={handleTimelineMouseUp}>
            {/* Playhead Indicator */}
            <div 
              ref={playheadRef}
              className="absolute top-0 bottom-0 w-[2px] bg-red-500 z-30 shadow-[0_0_8px_rgba(239,68,68,0.6)] cursor-ew-resize will-change-transform"
              style={{ left: 0, transform: `translateX(${playhead * zoom}px)` }}
              onMouseDown={handlePlayheadMouseDown}
            >
              <div className="absolute -top-5 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-red-500 text-white text-[9px] font-bold rounded shadow-lg whitespace-nowrap">
                {formatTime(playhead)}
              </div>
              <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[5px] border-r-[5px] border-t-[5px] border-l-transparent border-r-transparent border-t-red-500" />
            </div>
            
            {/* Beat Grid */}
            {useMemo(() => {
              const beatDuration = 60 / bpm;
              const barDuration = beatDuration * 4;
              const totalDuration = 600;
              const gridLines: React.ReactElement[] = [];
              
              const showBeats = zoom >= 40;
              const showSubdivisions = zoom >= 80;
              
              let lineCount = 0;
              const maxLines = 200;
              
              // Bar lines
              for (let bar = 0; bar <= totalDuration / barDuration && lineCount < maxLines; bar++) {
                const time = bar * barDuration;
                gridLines.push(
                  <div
                    key={`bar-${bar}`}
                    className="absolute top-0 bottom-0 pointer-events-none border-l border-white/20"
                    style={{ left: `${time * zoom}px` }}
                  />
                );
                lineCount++;
              }
              
              // Beat lines
              if (showBeats) {
                for (let beat = 0; beat <= totalDuration / beatDuration && lineCount < maxLines; beat++) {
                  const time = beat * beatDuration;
                  const isBar = Math.abs(time % barDuration) < 0.01;
                  
                  if (!isBar) {
                    gridLines.push(
                      <div
                        key={`beat-${beat}`}
                        className="absolute top-0 bottom-0 pointer-events-none border-l border-white/10"
                        style={{ left: `${time * zoom}px` }}
                      />
                    );
                    lineCount++;
                  }
                }
              }
              
              // Subdivision lines
              if (showSubdivisions && snapEnabled) {
                const subdivisionDuration = beatDuration / 4;
                for (let i = 0; i <= totalDuration / subdivisionDuration && lineCount < maxLines; i++) {
                  const time = i * subdivisionDuration;
                  const isBeat = Math.abs(time % beatDuration) < 0.01;
                  const isBar = Math.abs(time % barDuration) < 0.01;
                  
                  if (!isBeat && !isBar) {
                    gridLines.push(
                      <div
                        key={`sub-${i}`}
                        className="absolute top-0 bottom-0 pointer-events-none border-l border-white/5"
                        style={{ left: `${time * zoom}px` }}
                      />
                    );
                    lineCount++;
                  }
                }
              }
              
              return gridLines;
            }, [zoom, bpm, snapEnabled])}            {/* Second-based grid (for reference at all zoom levels) */}
            {useMemo(() => {
              if (zoom >= 40) return null; // Don't show at high zoom (beats are better)
              
              const gridLines: React.ReactElement[] = [];
              const interval = zoom < 10 ? 60 : zoom < 20 ? 30 : zoom < 40 ? 10 : 5;
              const maxLines = 100;
              
              for (let sec = 0; sec <= 600 && gridLines.length < maxLines; sec += interval) {
                gridLines.push(
                  <div
                    key={`sec-${sec}`}
                    className="absolute top-0 bottom-0 pointer-events-none"
                    style={{
                      left: `${sec * zoom}px`,
                      width: '1px',
                      background: 'rgba(100, 200, 255, 0.12)'
                    }}
                  />
                );
              }
              return gridLines;
            }, [zoom])}
            
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
              tracks.map((track, trackIndex) => {
                const trackHeight = 88;
                const isSelected = selectedTrackId === track.id;
                return (
                <div
                  key={track.id}
                  className={`border-b border-white/5 relative group transition-all ${
                    isSelected ? 'bg-cyan-500/5 border-b-cyan-500/20' : 'hover:bg-white/[0.015]'
                  }`}
                  style={{ height: `${trackHeight}px` }}
                  onClick={() => setSelectedTrackId(track.id)}
                >
                  {/* Track Lane */}
                  <div className="absolute inset-0 flex items-center px-2">
                    {track.clips.length === 0 ? (
                      <div className="text-xs text-gray-600 italic">
                        {isSelected ? '📁 Upload audio or drag files here' : 'Empty track'}
                      </div>
                    ) : (
                      track.clips.map((clip, clipIndex) => (
                        <div
                          key={clip.id}
                          className={`absolute rounded-lg overflow-hidden cursor-move transition-all ${
                            selectedClipId === clip.id 
                              ? 'ring-2 ring-cyan-400 z-20 shadow-xl shadow-cyan-500/30' 
                              : 'hover:ring-1 hover:ring-white/30 shadow-lg'
                          }`}
                          style={{
                            left: `${clip.startTime * zoom}px`,
                            width: `${clip.duration * zoom}px`,
                            height: '72px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            backgroundColor: `${track.color}20`,
                            border: `1px solid ${selectedClipId === clip.id ? '#22d3ee' : track.color}`,
                          }}
                          onClick={(e) => handleClipClick(e, clip.id, track.id)}
                          onMouseDown={(e) => handleClipMouseDown(e, track.id, clip.id, clip.startTime)}
                          title="Drag to move"
                        >
                          {/* Waveform Canvas */}
                          <canvas
                            ref={(canvas) => {
                              if (canvas && clip.buffer) {
                                canvas.width = Math.max(1, clip.duration * zoom);
                                canvas.height = 72;
                                const waveColor = selectedClipId === clip.id ? '#22d3ee' : track.color;
                                renderWaveform(canvas, clip.buffer, waveColor, clip.id);
                              }
                            }}
                            width={Math.max(1, clip.duration * zoom)}
                            height={72}
                            className="absolute inset-0 w-full h-full opacity-80"
                          />
                          <div 
                            className="absolute left-0 top-0 bottom-0 w-3 bg-gradient-to-r from-black/60 to-transparent cursor-ew-resize hover:from-cyan-400/40 hover:w-4 transition-all group/fade"
                            title="Drag to adjust fade in"
                          >
                            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-white/30 rounded-full opacity-0 group-hover/fade:opacity-100 transition-opacity" />
                          </div>
                          
                          <div 
                            className="absolute right-0 top-0 bottom-0 w-3 bg-gradient-to-l from-black/60 to-transparent cursor-ew-resize hover:from-cyan-400/40 hover:w-4 transition-all group/fade"
                            title="Drag to adjust fade out"
                          >
                            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-white/30 rounded-full opacity-0 group-hover/fade:opacity-100 transition-opacity" />
                          </div>
                          
                          {/* Premium Gradient Overlays */}
                          <div className="absolute inset-0 bg-gradient-to-b from-white/5 via-transparent to-black/20 pointer-events-none" />
                          <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />
                          
                          {/* Clip Info Overlay - Better Typography */}
                          <div className="absolute top-1.5 left-2.5 flex items-center gap-2 pointer-events-none">
                            <div className="text-xs font-bold text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)] bg-black/50 backdrop-blur-sm px-2 py-1 rounded-md border border-white/10">
                              {clip.name || track.name}
                            </div>
                          </div>
                          
                          {/* Duration & Position Labels */}
                          <div className="absolute bottom-1.5 right-2.5 flex items-center gap-2 text-[10px] font-mono text-white/90 drop-shadow-lg pointer-events-none">
                            <div className="bg-black/50 backdrop-blur-sm px-1.5 py-0.5 rounded border border-white/10">
                              {formatTime(clip.duration)}
                            </div>
                          </div>
                          
                          {/* Selection Indicator */}
                          {selectedClipId === clip.id && (
                            <div className="absolute inset-0 border-2 border-cyan-400 rounded-xl pointer-events-none animate-pulse" 
                                 style={{ animationDuration: '2s' }} 
                            />
                          )}
                          
                          {/* Clip Actions (show on selected) - Better Positioned */}
                          {selectedClipId === clip.id && (
                            <div className="absolute -top-10 left-1/2 -translate-x-1/2 flex gap-1.5 bg-black/90 backdrop-blur-md px-2 py-1.5 rounded-lg border border-cyan-500/30 shadow-2xl shadow-cyan-500/20 z-30">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSplitClip();
                                }}
                                className="px-2 py-1 text-xs bg-cyan-500/20 hover:bg-cyan-500 text-cyan-400 hover:text-black rounded transition-all font-semibold border border-cyan-500/30"
                                title="Split at playhead (E)"
                              >
                                ✂️ Split
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  // Duplicate clip
                                  if (daw && selectedTrackId) {
                                    const newClip = { ...clip, id: `clip-${Date.now()}`, startTime: clip.startTime + clip.duration };
                                    daw.addClipToTrack(selectedTrackId, newClip);
                                    setTracks([...daw.getTracks()]);
                                  }
                                }}
                                className="px-2 py-1 text-xs bg-purple-500/20 hover:bg-purple-500 text-purple-400 hover:text-black rounded transition-all font-semibold border border-purple-500/30"
                                title="Duplicate clip (D)"
                              >
                                📋 Copy
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteClip();
                                }}
                                className="px-2 py-1 text-xs bg-red-500/20 hover:bg-red-500 text-red-400 hover:text-white rounded transition-all font-semibold border border-red-500/30"
                                title="Delete clip (Del)"
                              >
                                🗑️ Delete
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
              );
            })
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

      {/* Bottom Action Bar - Enhanced */}
      <footer className="h-12 bg-[#0a0a0a] border-t border-cyan-500/20 flex items-center justify-center gap-3 flex-shrink-0">
        <button
          onClick={addTrack}
          className="px-4 h-8 bg-white/5 hover:bg-white/10 text-cyan-400 border border-cyan-500/30 hover:border-cyan-500/50 text-xs rounded transition-all font-semibold"
        >
          + NEW TRACK
        </button>
        <button
          onClick={() => document.getElementById('audio-upload')?.click()}
          className="px-4 h-8 bg-white/5 hover:bg-white/10 text-cyan-400 border border-cyan-500/30 hover:border-cyan-500/50 text-xs rounded transition-all font-semibold"
        >
          📁 IMPORT AUDIO
        </button>
        <button
          onClick={() => setShowSaveModal(true)}
          className="px-4 h-8 bg-white/5 hover:bg-white/10 text-white border border-white/10 hover:border-cyan-500/30 text-xs rounded transition-all"
        >
          💾 SAVE PROJECT
        </button>
        <button
          onClick={() => setShowExportModal(true)}
          className="px-4 h-8 bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-black text-xs font-bold rounded transition-all shadow-lg shadow-cyan-500/30"
        >
          📤 EXPORT
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
      {/* Professional Export Modal - Enhanced */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-50 animate-in fade-in duration-200" onClick={() => setShowExportModal(false)}>
          <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0f0f0f] border-2 border-cyan-500/30 rounded-2xl p-8 max-w-lg w-full shadow-2xl shadow-cyan-500/20 animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-cyan-700 flex items-center justify-center text-2xl">
                📤
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">Export Project</h2>
                <p className="text-sm text-gray-400">Download your masterpiece</p>
              </div>
            </div>
            
            <div className="space-y-5 mb-8">
              {/* Format Selection */}
              <div>
                <label className="text-sm font-bold text-gray-300 mb-3 block uppercase tracking-wide">Audio Format</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setExportFormat('wav')}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      exportFormat === 'wav'
                        ? 'bg-cyan-500/20 border-cyan-500 shadow-lg shadow-cyan-500/20'
                        : 'bg-[#1f1f1f] border-gray-700 hover:border-gray-600'
                    }`}
                  >
                    <div className="text-xl mb-1">🎵</div>
                    <div className="font-bold text-white">WAV</div>
                    <div className="text-xs text-gray-400">Lossless</div>
                  </button>
                  <button
                    onClick={() => setExportFormat('mp3')}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      exportFormat === 'mp3'
                        ? 'bg-cyan-500/20 border-cyan-500 shadow-lg shadow-cyan-500/20'
                        : 'bg-[#1f1f1f] border-gray-700 hover:border-gray-600'
                    }`}
                  >
                    <div className="text-xl mb-1">🎶</div>
                    <div className="font-bold text-white">MP3</div>
                    <div className="text-xs text-gray-400">Compressed</div>
                  </button>
                </div>
              </div>
              
              {/* Quality Selection */}
              <div>
                <label className="text-sm font-bold text-gray-300 mb-3 block uppercase tracking-wide">Sample Rate</label>
                <div className="space-y-2">
                  {[
                    { value: '44100', label: '44.1 kHz', desc: 'CD Quality', icon: '💿' },
                    { value: '48000', label: '48 kHz', desc: 'Professional', icon: '🎚️' },
                    { value: '96000', label: '96 kHz', desc: 'Hi-Resolution', icon: '💎' }
                  ].map(option => (
                    <button
                      key={option.value}
                      onClick={() => setExportQuality(option.value)}
                      className={`w-full p-3 rounded-lg border-2 transition-all flex items-center gap-3 ${
                        exportQuality === option.value
                          ? 'bg-cyan-500/20 border-cyan-500 shadow-lg shadow-cyan-500/20'
                          : 'bg-[#1f1f1f] border-gray-700 hover:border-gray-600'
                      }`}
                    >
                      <span className="text-xl">{option.icon}</span>
                      <div className="flex-1 text-left">
                        <div className="font-bold text-white">{option.label}</div>
                        <div className="text-xs text-gray-400">{option.desc}</div>
                      </div>
                      {exportQuality === option.value && <span className="text-cyan-400">✓</span>}
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Export Info */}
              <div className="p-4 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
                <div className="flex items-center gap-2 text-sm text-cyan-400 mb-2">
                  <span>ℹ️</span>
                  <span className="font-bold">Export Details</span>
                </div>
                <div className="text-xs text-gray-300 space-y-1">
                  <div>• Format: {exportFormat.toUpperCase()}</div>
                  <div>• Quality: {exportQuality === '44100' ? 'CD' : exportQuality === '48000' ? 'Pro' : 'Hi-Res'} ({exportQuality} Hz)</div>
                  <div>• Tracks: {tracks.length} active</div>
                </div>
              </div>
            </div>
            
            <div className="flex gap-3">
              <button 
                onClick={() => {
                  handleExport(exportFormat, exportQuality);
                }} 
                className="flex-1 py-3 bg-gradient-to-r from-cyan-500 to-cyan-600 text-black font-bold rounded-lg hover:from-cyan-400 hover:to-cyan-500 transition-all shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50 hover:scale-105"
              >
                📥 Export Now
              </button>
              <button onClick={() => setShowExportModal(false)} className="px-6 py-3 bg-[#1f1f1f] text-gray-300 border-2 border-gray-700 rounded-lg hover:bg-[#252525] hover:border-gray-600 transition-all font-semibold">
                Cancel
              </button>
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

      {/* BPM Modal */}
      {showBpmModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gradient-to-br from-[#0a0a0a] to-[#1a1a1a] border border-cyan-500/30 rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl shadow-cyan-500/20">
            <h3 className="text-2xl font-bold mb-6 text-cyan-400">Tempo Settings</h3>
            
            {/* BPM Slider */}
            <div className="mb-6">
              <div className="flex justify-between items-center mb-3">
                <label className="text-sm text-gray-400">BPM</label>
                <span className="text-3xl font-bold text-cyan-400 tabular-nums">{tempBpm}</span>
              </div>
              <input
                type="range"
                min="40"
                max="240"
                value={tempBpm}
                onChange={(e) => setTempBpm(parseInt(e.target.value))}
                className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer slider-cyan"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>40</span>
                <span>140</span>
                <span>240</span>
              </div>
            </div>

            {/* Tempo Presets */}
            <div className="mb-6">
              <label className="text-sm text-gray-400 mb-2 block">Quick Presets</label>
              <div className="grid grid-cols-5 gap-2">
                {[60, 90, 120, 140, 160].map(preset => (
                  <button
                    key={preset}
                    onClick={() => setTempBpm(preset)}
                    className={`px-3 py-2 rounded-lg text-sm font-bold transition-all ${
                      tempBpm === preset
                        ? 'bg-cyan-500 text-black'
                        : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-cyan-400 border border-white/10'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            {/* Metronome Settings */}
            <div className="mb-6 p-4 bg-black/40 rounded-lg border border-white/10">
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-semibold text-gray-300">Metronome</label>
                <button
                  onClick={() => setMetronomeEnabled(!metronomeEnabled)}
                  className={`px-4 py-1 rounded-lg text-xs font-bold transition-all ${
                    metronomeEnabled
                      ? 'bg-cyan-500 text-black'
                      : 'bg-white/10 text-gray-400'
                  }`}
                >
                  {metronomeEnabled ? 'ON' : 'OFF'}
                </button>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400">Volume</span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={metronomeVolume}
                  onChange={(e) => setMetronomeVolume(parseFloat(e.target.value))}
                  disabled={!metronomeEnabled}
                  className="flex-1 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer slider-cyan disabled:opacity-30"
                />
                <span className="text-xs text-cyan-400 font-mono w-8">{Math.round(metronomeVolume * 100)}%</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => setShowBpmModal(false)}
                className="flex-1 px-6 py-3 bg-white/5 border border-white/10 text-gray-300 rounded-lg hover:bg-white/10 transition-all font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  updateBpm(tempBpm);
                  setShowBpmModal(false);
                }}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-cyan-500 to-cyan-600 text-black rounded-lg hover:from-cyan-400 hover:to-cyan-500 transition-all font-bold shadow-lg shadow-cyan-500/30"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading Overlay */}
      {isLoading && <LoadingSpinner message={loadingMessage} />}
    </div>
  );
}
