/**
 * Multi-Track Studio Page - ENHANCED VERSION
 * Logic Pro-inspired multi-track audio editing interface
 * 
 * Features:
 * - Drag & drop audio files to timeline
 * - Multi-track synchronized playback
 * - Per-track volume, pan, mute, solo controls
 * - AudioMass-style track system with clips
 * - Real-time waveform rendering
 * - Professional transport controls
 * - Track inspector with effects rack
 * - Zoom and timeline navigation
 * 
 * @version 2.0.0
 * @enhanced 2025-01-15
 */

'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Upload, Sparkles, Library, Music, Plus, Save, Download, FileAudio, Folder, HelpCircle, Settings, Volume2, Timer, Hash, Clock, Magnet, Radio, Music2, MousePointer2, Scissors, ZoomIn, Move, Hand, X, Lock, Unlock } from 'lucide-react';
import { StudioProvider, useStudio } from '@/app/contexts/StudioContext';
import Timeline from '@/app/components/studio/Timeline';
import TransportBar from '@/app/components/studio/TransportBar';
import EffectsRack from '@/app/components/studio/EffectsRack';
import TimelineRuler from '@/app/components/studio/TimelineRuler';
import TrackInspector from '@/app/components/studio/TrackInspector';
import BeatGenerationModal from '@/app/components/studio/BeatGenerationModal';
import SongGenerationModal from '@/app/components/studio/SongGenerationModal';
import StemSplitModal from '@/app/components/studio/StemSplitModal';
import ExportModal from '@/app/components/studio/ExportModal';
import ReleaseModal from '@/app/components/studio/ReleaseModal';
import type { ToolType } from '@/app/components/studio/Toolbar';
import { useUser } from '@clerk/nextjs';

function StudioContent() {
  const { addTrack, addEmptyTrack, tracks, addClipToTrack, isPlaying, setPlaying, togglePlayback, selectedTrackId, removeTrack, toggleMute, toggleSolo, undo, redo, canUndo, canRedo, setZoom, setLeftGutterWidth, setTrackHeight, trackHeight, leftGutterWidth } = useStudio();
  const { user } = useUser();
  const [showAISidebar, setShowAISidebar] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [libraryTab, setLibraryTab] = useState<'music' | 'effects'>('music');
  const [activeTool, setActiveTool] = useState<ToolType>('select');
  const [isLoadingLibrary, setIsLoadingLibrary] = useState(false);
  const [libraryTracks, setLibraryTracks] = useState<any[]>([]);
  const [libraryEffects, setLibraryEffects] = useState<any[]>([]);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [projectName, setProjectName] = useState<string>('Untitled Project');
  const [snapEnabled, setSnapEnabled] = useState<boolean>(true);
  const [bpm, setBpm] = useState<number>(120);
  const [timeSig, setTimeSig] = useState<'4/4' | '3/4' | '6/8'>('4/4');
  const [metronomeOn, setMetronomeOn] = useState<boolean>(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [showBeatModal, setShowBeatModal] = useState(false);
  const [showSongModal, setShowSongModal] = useState(false);
  const [showStemModal, setShowStemModal] = useState(false);
  const [stemSplitClip, setStemSplitClip] = useState<{id: string; url: string; name: string} | null>(null);
  const [isSplittingStem, setIsSplittingStem] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const clipsScrollRef = useRef<HTMLDivElement | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showReleaseModal, setShowReleaseModal] = useState(false);
  const [savedProjects, setSavedProjects] = useState<Array<{id: string; name: string; timestamp: number; trackCount: number}>>([]);
  const [showProjectMenu, setShowProjectMenu] = useState(false);
  const [showHeaderProjectMenu, setShowHeaderProjectMenu] = useState(false);
  const [credits, setCredits] = useState<number | null>(null);
  const [playheadLocked, setPlayheadLocked] = useState(true); // Track playhead lock state
  const [seekToEarliestOnPlay, setSeekToEarliestOnPlay] = useState(true);
  const [rememberPreset, setRememberPreset] = useState<boolean>(() => {
    try {
      return localStorage.getItem('studio_layout') === '1080';
    } catch { return false }
  });

  // Show notification helper
  const showNotification = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 2000);
  }, []);

  // Add 3 empty tracks on mount with sequential naming
  useEffect(() => {
    if (tracks.length === 0) {
      addTrack('Track 1');
      addTrack('Track 2');
      addTrack('Track 3');
      console.log('✅ Studio initialized with 3 tracks: Track 1, Track 2, Track 3');
    }
    
    // Load saved projects index
    try {
      const index = JSON.parse(localStorage.getItem('studio_projects_index') || '[]');
      setSavedProjects(index);
    } catch {}

    // Apply saved layout preset if present
    try {
      const stored = localStorage.getItem('studio_layout');
      if (stored === '1080') apply1080Preset();
    } catch {}
    const onLibraryHide = () => setShowLibrary(false);
    window.addEventListener('studio:library-hide', onLibraryHide as EventListener);
    return () => window.removeEventListener('studio:library-hide', onLibraryHide as EventListener);
  }, []); // Run once on mount

  // 1920x1080 layout preset
  const apply1080Preset = useCallback(() => {
    const GUTTER = 240; // left column
    const PRESET_WIDTH = 1920;
    const TIMELINE_DURATION = 300; // seconds
    const containerWidth = Math.max(1, PRESET_WIDTH - GUTTER);
    const pxPerSecond = containerWidth / TIMELINE_DURATION; // px per second
    const desiredZoom = pxPerSecond / 50; // base 50 px/s at 1x
    setLeftGutterWidth(GUTTER);
    setTrackHeight(180);
    setZoom(desiredZoom);
    showNotification('Applied 1920x1080 preset', 'success');
    try {
      if (rememberPreset) localStorage.setItem('studio_layout', '1080');
    } catch {}
  }, [setLeftGutterWidth, setTrackHeight, setZoom, showNotification]);

  // Fetch credits on mount and listen for updates from children
  useEffect(() => {
    const fetchCredits = async () => {
      try {
        const res = await fetch('/api/credits', { method: 'GET' });
        const data = await res.json().catch(() => null);
        if (data && typeof data.credits === 'number') {
          setCredits(data.credits);
        }
      } catch {}
    };
    fetchCredits();

    const onCreditsUpdate = (e: Event) => {
      const detail = (e as CustomEvent).detail as { credits?: number } | undefined;
      if (detail && typeof detail.credits === 'number') setCredits(detail.credits);
      else fetchCredits();
    };
    const onNotify = (e: Event) => {
      const detail = (e as CustomEvent).detail as { message: string; type?: 'success'|'error'|'info' };
      if (detail?.message) showNotification(detail.message, detail.type || 'info');
    };
    window.addEventListener('credits:update', onCreditsUpdate as EventListener);
    window.addEventListener('studio:notify', onNotify as EventListener);
    return () => {
      window.removeEventListener('credits:update', onCreditsUpdate as EventListener);
      window.removeEventListener('studio:notify', onNotify as EventListener);
    };
  }, [showNotification]);

  // Autosave (lightweight) project metadata and basic track refs
  useEffect(() => {
    const payload = {
      projectName,
      bpm,
      timeSig,
      tracks: tracks.map(t => ({ name: t.name, audioUrl: t.audioUrl }))
    }
    try {
      localStorage.setItem('studio_autosave', JSON.stringify(payload))
    } catch {}
  }, [projectName, bpm, timeSig, tracks])

  // Offer restore on first mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem('studio_autosave')
      if (raw) {
        const data = JSON.parse(raw)
        // Only prompt if user has empty fresh session
        if (tracks.length <= 3) {
          setTimeout(() => {
            setNotification({ message: 'Autosaved project found — Press R to restore', type: 'info' })
          }, 400)
        }
      }
    } catch {}
  }, [])

  const restoreAutosave = useCallback(() => {
    try {
      const raw = localStorage.getItem('studio_autosave')
      if (!raw) return showNotification('No autosave found', 'error')
      const data = JSON.parse(raw)
      if (typeof data?.projectName === 'string') setProjectName(data.projectName)
      if (typeof data?.bpm === 'number') setBpm(data.bpm)
      if (data?.timeSig) setTimeSig(data.timeSig)
      // Add tracks
      if (Array.isArray(data?.tracks)) {
        data.tracks.forEach((t: any) => {
          if (t?.audioUrl) addTrack(t.name || 'Restored Track', t.audioUrl)
        })
      }
      showNotification('Project restored', 'success')
    } catch (e) {
      showNotification('Failed to restore project', 'error')
    }
  }, [addTrack, showNotification])

  // Handle Beat generation
  const handleBeatGenerated = useCallback((audioUrl: string, metadata: any) => {
    const trackName = `Beat - ${metadata.prompt.substring(0, 30)}...`;
    if (selectedTrackId) {
      // Add to selected track
      addClipToTrack(selectedTrackId, audioUrl, trackName, 0);
      showNotification('Beat added to selected track', 'success');
    } else if (tracks.length > 0) {
      // Add to first track
      addClipToTrack(tracks[0].id, audioUrl, trackName, 0);
      showNotification('Beat added to Track 1', 'success');
    } else {
      // Create new track
      addTrack(trackName, audioUrl);
      showNotification('Beat added to new track', 'success');
    }
  }, [selectedTrackId, tracks, addClipToTrack, addTrack, showNotification]);

  // Handle Song generation
  const handleSongGenerated = useCallback((audioUrl: string, metadata: any) => {
    const trackName = `Song - ${metadata.prompt.substring(0, 30)}...`;
    if (selectedTrackId) {
      // Add to selected track
      addClipToTrack(selectedTrackId, audioUrl, trackName, 0);
      showNotification('Song added to selected track', 'success');
    } else if (tracks.length > 0) {
      // Add to first track
      addClipToTrack(tracks[0].id, audioUrl, trackName, 0);
      showNotification('Song added to Track 1', 'success');
    } else {
      // Create new track
      addTrack(trackName, audioUrl);
      showNotification('Song added to new track', 'success');
    }
  }, [selectedTrackId, tracks, addClipToTrack, addTrack, showNotification]);

  // Handle Stem Splitting with format selection
  const handleSplitStems = useCallback(async (clipId: string, audioUrl: string, clipName?: string) => {
    // Open modal for format selection
    setStemSplitClip({ id: clipId, url: audioUrl, name: clipName || 'Audio Clip' });
    setShowStemModal(true);
  }, []);

  // Execute stem split with selected format
  const executeStemSplit = useCallback(async (format: 'mp3' | 'wav') => {
    if (!stemSplitClip) return;
    
    setIsSplittingStem(true);
    showNotification(`Splitting stems as ${format.toUpperCase()}... This may take a few moments`, 'info');
    
    try {
      const response = await fetch('/api/studio/split-stems', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          audioUrl: stemSplitClip.url,
          outputFormat: format 
        })
      });

      const data = await response.json();

      if (!data.success) {
        showNotification(data.error || 'Stem splitting failed', 'error');
        return;
      }

      // Create tracks for each stem
      const { stems } = data;
      const stemEntries = Object.entries(stems);
      
      if (stemEntries.length === 0) {
        showNotification('No stems were generated', 'error');
        return;
      }

      // Add each stem as a new track
      for (const [stemName, stemUrl] of stemEntries) {
        const trackName = `${stemName.charAt(0).toUpperCase() + stemName.slice(1)}`;
        addTrack(trackName, stemUrl as string);
      }

      showNotification(`✨ Created ${stemEntries.length} ${format.toUpperCase()} stem tracks`, 'success');
      
      // Dispatch credits update event
      if (data.remainingCredits !== undefined) {
        window.dispatchEvent(new CustomEvent('credits:update', { 
          detail: { credits: data.remainingCredits } 
        }));
      }
      
      // Close modal
      setShowStemModal(false);
      setStemSplitClip(null);
    } catch (error) {
      console.error('Stem splitting error:', error);
      showNotification('Failed to split stems', 'error');
    } finally {
      setIsSplittingStem(false);
    }
  }, [stemSplitClip, addTrack, showNotification]);

  // Load user's library tracks
  const loadLibraryTracks = useCallback(async () => {
    setIsLoadingLibrary(true);
    try {
      const response = await fetch('/api/library/music');
      const data = await response.json();
      
      if (data.success && Array.isArray(data.music)) {
        setLibraryTracks(data.music);
        showNotification(`Loaded ${data.music.length} tracks from library`, 'success');
      } else {
        showNotification('No tracks found in library', 'info');
        setLibraryTracks([]);
      }
    } catch (error) {
      console.error('Failed to load library:', error);
      showNotification('Failed to load library tracks', 'error');
      setLibraryTracks([]);
    } finally {
      setIsLoadingLibrary(false);
    }
  }, [showNotification]);

  // Load user's library effects (generated effects)
  const loadLibraryEffects = useCallback(async () => {
    setIsLoadingLibrary(true);
    try {
      const response = await fetch('/api/library/effects');
      const data = await response.json();
      
      if (data.success && Array.isArray(data.effects)) {
        setLibraryEffects(data.effects);
        showNotification(`Loaded ${data.effects.length} effects from library`, 'success');
      } else {
        showNotification('No effects found in library', 'info');
        setLibraryEffects([]);
      }
    } catch (error) {
      console.error('Failed to load library effects:', error);
      showNotification('Failed to load library effects', 'error');
      setLibraryEffects([]);
    } finally {
      setIsLoadingLibrary(false);
    }
  }, [showNotification]);

  // Load library when sidebar opens
  useEffect(() => {
    if (showLibrary && libraryTab === 'music' && libraryTracks.length === 0) {
      loadLibraryTracks();
    }
    if (showLibrary && libraryTab === 'effects' && libraryEffects.length === 0) {
      loadLibraryEffects();
    }
  }, [showLibrary, libraryTab, libraryTracks.length, libraryEffects.length, loadLibraryTracks, loadLibraryEffects]);

  // Handle file upload from computer
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      // Validate audio file
      if (!file.type.startsWith('audio/')) {
        showNotification(`${file.name} is not an audio file`, 'error');
        errorCount++;
        continue;
      }

      try {
        // Create object URL for the file
        const audioUrl = URL.createObjectURL(file);
        const trackName = file.name.replace(/\.[^/.]+$/, ''); // Remove extension
        // Probe metadata for duration using HTMLMediaElement
        const audio = new Audio(audioUrl);
        const duration = await new Promise<number>((resolve) => {
          audio.onloadedmetadata = () => resolve(audio.duration || 0);
          // Fallback after 2s if metadata doesn't load
          setTimeout(() => resolve(0), 2000);
        });
        addTrack(trackName, audioUrl, undefined, duration || undefined, file);
        successCount++;
        console.log(`✅ Added track: ${trackName}`);
      } catch (error) {
        console.error(`Failed to add ${file.name}:`, error);
        errorCount++;
      }
    }

    // Show summary notification
    if (successCount > 0) {
      showNotification(`Added ${successCount} track${successCount > 1 ? 's' : ''} to studio`, 'success');
    }
    if (errorCount > 0) {
      showNotification(`Failed to add ${errorCount} file${errorCount > 1 ? 's' : ''}`, 'error');
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Add track from library
  const handleAddFromLibrary = useCallback((track: any) => {
    try {
      const trackName = track.title || 'Library Track';
      const audioUrl = track.audio_url;
      
      if (!audioUrl) {
        showNotification('Track has no audio URL', 'error');
        return;
      }

      const newId = addTrack(trackName, audioUrl);
      showNotification(`Added "${trackName}" to studio`, 'success');
      console.log(`✅ Added library track: ${trackName}`);
      // Auto-hide library when added
      setShowLibrary(false);
      try {
        window.dispatchEvent(new CustomEvent('studio:library-hide'));
      } catch {}
    } catch (error) {
      console.error('Failed to add library track:', error);
      showNotification('Failed to add track from library', 'error');
    }
  }, [addTrack, showNotification]);

  // Open file dialog
  const handleBrowseFiles = () => {
    fileInputRef.current?.click();
  };

  // Save current project to localStorage
  const handleSaveProject = useCallback(() => {
    try {
      const projectId = `project_${Date.now()}`;
      const projectData = {
        id: projectId,
        name: projectName || 'Untitled Project',
        timestamp: Date.now(),
        bpm,
        timeSig,
        tracks: tracks.map(t => ({
          id: t.id,
          name: t.name,
          color: t.color,
          volume: t.volume,
          pan: t.pan,
          mute: t.mute,
          solo: t.solo,
          audioUrl: t.audioUrl,
          clips: t.clips.map(c => ({
            id: c.id,
            name: c.name,
            audioUrl: c.audioUrl,
            startTime: c.startTime,
            duration: c.duration,
            offset: c.offset,
          }))
        }))
      };

      // Save to localStorage
      localStorage.setItem(projectId, JSON.stringify(projectData));
      
      // Update projects index
      const existingIndex = JSON.parse(localStorage.getItem('studio_projects_index') || '[]');
      const newIndex = [
        { id: projectId, name: projectData.name, timestamp: projectData.timestamp, trackCount: tracks.length },
        ...existingIndex.filter((p: any) => p.id !== projectId)
      ];
      localStorage.setItem('studio_projects_index', JSON.stringify(newIndex));
      setSavedProjects(newIndex);
      
      showNotification(`Project "${projectData.name}" saved`, 'success');
      console.log('✅ Project saved:', projectId);
    } catch (error) {
      console.error('Save failed:', error);
      showNotification('Failed to save project', 'error');
    }
  }, [projectName, bpm, timeSig, tracks, showNotification]);

  // Load a saved project
  const handleLoadProject = useCallback((projectId: string) => {
    try {
      const raw = localStorage.getItem(projectId);
      if (!raw) {
        showNotification('Project not found', 'error');
        return;
      }

      const projectData = JSON.parse(raw);
      
      // Restore project metadata
      setProjectName(projectData.name || 'Loaded Project');
      setBpm(projectData.bpm || 120);
      setTimeSig(projectData.timeSig || '4/4');
      
      // Clear existing tracks
      tracks.forEach(t => removeTrack(t.id));
      
      // Restore tracks with clips
      if (Array.isArray(projectData.tracks)) {
        projectData.tracks.forEach((trackData: any) => {
          const newTrackId = addTrack(trackData.name || 'Track', trackData.audioUrl);
          
          // Restore clips to track
          if (Array.isArray(trackData.clips)) {
            trackData.clips.forEach((clipData: any) => {
              addClipToTrack(newTrackId, clipData.audioUrl, clipData.name, clipData.startTime, clipData.duration);
            });
          }
        });
      }
      
      setShowProjectMenu(false);
      showNotification(`Project "${projectData.name}" loaded`, 'success');
      console.log('✅ Project loaded:', projectId);
    } catch (error) {
      console.error('Load failed:', error);
      showNotification('Failed to load project', 'error');
    }
  }, [addTrack, addClipToTrack, removeTrack, tracks, setBpm, setTimeSig, showNotification]);

  // Delete a saved project
  const handleDeleteProject = useCallback((projectId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      localStorage.removeItem(projectId);
      const existingIndex = JSON.parse(localStorage.getItem('studio_projects_index') || '[]');
      const newIndex = existingIndex.filter((p: any) => p.id !== projectId);
      localStorage.setItem('studio_projects_index', JSON.stringify(newIndex));
      setSavedProjects(newIndex);
      showNotification('Project deleted', 'success');
    } catch (error) {
      showNotification('Failed to delete project', 'error');
    }
  }, [showNotification]);

  const handleExportAudio = useCallback(() => {
    setShowExportModal(true);
  }, []);

  // Release track to Explore/Library
  const handleRelease = useCallback(async (title: string, audioBlob: Blob) => {
    try {
      const formData = new FormData();
      formData.append('title', title);
      formData.append('type', 'music');
      formData.append('audio', audioBlob, `${title}.wav`);

      const response = await fetch('/api/profile/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Upload failed' }));
        throw new Error(error.error || 'Upload failed');
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Upload failed');
      }

      showNotification(`"${title}" released successfully!`, 'success');
      console.log('✅ Track released:', result.data);
    } catch (error) {
      console.error('Release failed:', error);
      showNotification('Failed to release track: ' + (error instanceof Error ? error.message : 'Unknown error'), 'error');
      // Don't re-throw - allow UI to continue working
    }
  }, [showNotification]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ignore if focused on input fields
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      if (e.key === 'm' || e.key === 'M') {
        if (selectedTrackId) toggleMute(selectedTrackId);
      } else if (e.key === 's' || e.key === 'S') {
        if (selectedTrackId) toggleSolo(selectedTrackId);
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedTrackId) removeTrack(selectedTrackId);
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        // Undo
        e.preventDefault();
        if (canUndo) undo();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'Z'))) {
        e.preventDefault();
        if (canRedo) redo();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedTrackId, toggleMute, toggleSolo, removeTrack, undo, redo, canUndo, canRedo]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Ignore if typing in input
      const tag = (e.target as HTMLElement)?.tagName
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA'
      if (isInput) return

      // Ctrl+Z: Undo
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        undo()
        showNotification('Undo', 'info')
        return
      }
      // Ctrl+Y or Ctrl+Shift+Z: Redo
      if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) {
        e.preventDefault()
        redo()
        showNotification('Redo', 'info')
        return
      }
      // Space: play/pause
      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault()
        togglePlayback()
        return
      }
      // Ctrl+S: save project
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        handleSaveProject()
        return
      }
      // Ctrl+U: Upload/Import files
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'u') {
        e.preventDefault()
        handleBrowseFiles()
        return
      }
      // Delete or Backspace: remove selected track
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedTrackId) {
        e.preventDefault()
        removeTrack(selectedTrackId)
        showNotification('Track removed', 'success')
        return
      }
      // V: cursor/select tool
      if (!e.ctrlKey && !e.metaKey && e.key.toLowerCase() === 'v') {
        setActiveTool('select')
        showNotification('Cursor/Select tool active', 'info')
        return
      }
      // C: cut/split tool
      if (!e.ctrlKey && !e.metaKey && e.key.toLowerCase() === 'c') {
        setActiveTool('cut')
        showNotification('Cut/Split tool active', 'info')
        return
      }
      // D: duplicate selected track
      if (!e.ctrlKey && !e.metaKey && e.key.toLowerCase() === 'd') {
        if (selectedTrackId) {
          const track = tracks.find(t => t.id === selectedTrackId)
          if (track) {
            addTrack(`${track.name} (Copy)`, track.audioUrl || undefined)
            showNotification(`Duplicated "${track.name}"`, 'success')
          }
        } else {
          showNotification('Select a track to duplicate', 'info')
        }
        return
      }
      // Z: zoom tool
      if (!e.ctrlKey && !e.metaKey && e.key.toLowerCase() === 'z') {
        setActiveTool('zoom')
        showNotification('Zoom tool active', 'info')
        return
      }
      // A: Song generation modal
      if (!e.ctrlKey && !e.metaKey && e.key.toLowerCase() === 'a') {
        setShowSongModal(true)
        return
      }
      // B: Beat generation modal
      if (!e.ctrlKey && !e.metaKey && e.key.toLowerCase() === 'b') {
        setShowBeatModal(true)
        return
      }
      // +: Add new track
      if (!e.ctrlKey && !e.metaKey && (e.key === '+' || e.key === '=')) {
        const nextNum = tracks.length + 1
        addTrack(`Track ${nextNum}`)
        showNotification(`Track ${nextNum} added`, 'success')
        return
      }
      // E: Export modal
      if (!e.ctrlKey && !e.metaKey && e.key.toLowerCase() === 'e') {
        setShowExportModal(true)
        return
      }
      // T: Enable/disable selected track
      if (!e.ctrlKey && !e.metaKey && e.key.toLowerCase() === 't') {
        if (selectedTrackId) {
          toggleMute(selectedTrackId)
          const track = tracks.find(t => t.id === selectedTrackId)
          showNotification(`Track "${track?.name}" ${track?.mute ? 'disabled' : 'enabled'}`, 'info')
        } else {
          showNotification('Select a track to enable/disable', 'info')
        }
        return
      }
      // L: Toggle library
      if (!e.ctrlKey && !e.metaKey && e.key.toLowerCase() === 'l') {
        setShowLibrary(prev => !prev)
        if (!showLibrary) loadLibraryTracks()
        return
      }
      // F7: Toggle shortcuts modal
      if (e.key === 'F7') {
        e.preventDefault()
        setShowShortcuts(prev => !prev)
        return
      }
      // R: Speed control (placeholder - full implementation needs rate adjustment)
      if (!e.ctrlKey && !e.metaKey && e.key.toLowerCase() === 'r') {
        showNotification('Speed control: Coming soon', 'info')
        return
      }
    }
    window.addEventListener('keydown', onKey, { capture: true })
    return () => window.removeEventListener('keydown', onKey, { capture: true } as any)
  }, [isPlaying, selectedTrackId, removeTrack, setPlaying, handleSaveProject, restoreAutosave, showNotification, setActiveTool, setShowSongModal, setShowBeatModal, tracks, addTrack, handleBrowseFiles, showAISidebar, setShowAISidebar, showLibrary, setShowLibrary, loadLibraryTracks, setShowShortcuts, toggleMute, setShowExportModal, undo, redo])

  // Drag & drop from desktop
  const handleDragOverRoot = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }
  const handleDragLeaveRoot = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }
  const handleDropRoot = async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const files = Array.from(e.dataTransfer.files || [])
    if (!files.length) return
    let added = 0
    for (const file of files) {
      if (file.type.startsWith('audio/')) {
        const url = URL.createObjectURL(file)
        const name = file.name.replace(/\.[^/.]+$/, '')
        addTrack(name, url, undefined, undefined, file)
        added++
      }
    }
    if (added) showNotification(`Added ${added} track${added>1?'s':''} from drop`, 'success')
  }

  return (
    <div 
      className="min-h-screen max-h-screen flex flex-col bg-black relative overflow-x-hidden overflow-y-hidden"
      onDragOver={handleDragOverRoot}
      onDragLeave={handleDragLeaveRoot}
      onDrop={handleDropRoot}
    >
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        multiple
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* Notification Toast */}
      {notification && (
        <div className="fixed top-4 right-4 z-50 animate-slide-down">
          <div className={`px-6 py-3 rounded-lg shadow-2xl border ${
            notification.type === 'success' ? 'bg-emerald-900/90 border-emerald-500/50 text-emerald-100' :
            notification.type === 'error' ? 'bg-red-900/90 border-red-500/50 text-red-100' :
            'bg-teal-900/90 border-teal-500/50 text-teal-100'
          } backdrop-blur-xl`}>
            <p className="text-sm font-medium">{notification.message}</p>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="h-14 bg-gradient-to-r from-black via-cyan-950/20 to-black border-b border-cyan-900/50 flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-cyan-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-cyan-500/50">
            <span className="text-white font-bold">4</span>
          </div>
          <div className="flex items-center gap-2">
            <div>
              <h1 className="text-lg font-bold text-white">444Radio Studio</h1>
              <input 
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="w-36 px-2 py-0.5 text-xs rounded bg-black/30 border border-cyan-900/30 text-cyan-100 placeholder:text-cyan-400/40 focus:outline-none focus:border-cyan-500/60"
                placeholder="Untitled Project"
              />
            </div>
            {/* Projects dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowHeaderProjectMenu(!showHeaderProjectMenu)}
                className="p-1.5 rounded bg-gray-900 hover:bg-gray-800 text-cyan-400 border border-cyan-900/50 transition-all"
                title="Project menu"
              >
                <Folder className="w-4 h-4" />
              </button>
              {showHeaderProjectMenu && (
                <div className="absolute top-full left-0 mt-2 w-64 bg-gray-900 border border-cyan-500/30 rounded-lg shadow-2xl z-50 max-h-80 overflow-y-auto">
                  <div className="p-2 border-b border-cyan-900/50">
                    <div className="text-xs text-cyan-400 font-semibold mb-2">Saved Projects</div>
                    {savedProjects.length === 0 ? (
                      <div className="text-xs text-gray-500 py-2 text-center">No saved projects</div>
                    ) : (
                      savedProjects.map((proj) => (
                        <div
                          key={proj.id}
                          className="flex items-center justify-between hover:bg-gray-800 rounded px-2 py-1.5 mb-1 group"
                        >
                          <button
                            onClick={() => handleLoadProject(proj.id)}
                            className="flex-1 text-left"
                          >
                            <div className="text-xs text-white font-medium truncate">{proj.name}</div>
                            <div className="text-[10px] text-gray-400">
                              {new Date(proj.timestamp).toLocaleDateString()} · {proj.trackCount} tracks
                            </div>
                          </button>
                          <button
                            onClick={(e) => handleDeleteProject(proj.id, e)}
                            className="p-1 rounded hover:bg-red-500/20 text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="p-2">
                    <button
                      onClick={() => {
                        handleSaveProject();
                        setShowHeaderProjectMenu(false);
                      }}
                      className="w-full px-3 py-1.5 rounded bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-medium transition-all"
                    >
                      Save Current Project
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

          <div className="flex items-center gap-2">
            {/* Credits Badge */}
            <div className="px-3 py-1 rounded-full bg-black/40 border border-cyan-900/50 text-cyan-300 text-xs font-medium select-none" title="Available credits">
              {credits === null ? 'Credits: …' : `Credits: ${credits}`}
            </div>
          {/* Beat Generation */}
          <button
            onClick={() => setShowBeatModal(true)}
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-700 hover:to-cyan-600 text-white font-medium transition-all shadow-lg shadow-cyan-500/30 flex items-center gap-2"
            title="Generate AI Beat - Shortcut: B"
          >
            <Radio className="w-4 h-4" />
            <span className="text-sm">Beat</span>
          </button>

          {/* Song Generation */}
          <button
            onClick={() => setShowSongModal(true)}
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-700 hover:to-cyan-600 text-white font-medium transition-all shadow-lg shadow-cyan-500/30 flex items-center gap-2"
            title="Generate AI Song - Shortcut: A"
          >
            <Music2 className="w-4 h-4" />
            <span className="text-sm">Song</span>
          </button>
        </div>
      </header>

      {/* Unified Toolbar with ALL controls */}
      <div className="h-16 bg-gradient-to-r from-gray-950 via-black to-gray-950 border-b border-teal-900/30 flex items-center px-6 gap-4 shrink-0 shadow-2xl backdrop-blur-xl">
        {/* Selection Tools Group - Enhanced */}
        <div className="flex items-center gap-2 bg-black/60 backdrop-blur-md rounded-xl p-2 border border-teal-500/20 shadow-xl shadow-black/40">
          <button
            onClick={() => setActiveTool('select')}
            className={`p-2.5 rounded-lg transition-all duration-200 ${
              activeTool === 'select'
                ? 'bg-gradient-to-br from-teal-500 to-cyan-600 text-white shadow-2xl shadow-teal-500/50 scale-110'
                : 'text-gray-400 hover:bg-gray-800/80 hover:text-teal-300 hover:scale-105'
            }`}
            title="Selection Tool (V)"
          >
            <MousePointer2 className="w-4 h-4" />
          </button>
          
          <button
            onClick={() => setActiveTool('cut')}
            className={`p-2.5 rounded-lg transition-all duration-200 ${
              activeTool === 'cut'
                ? 'bg-gradient-to-br from-teal-500 to-cyan-600 text-white shadow-2xl shadow-teal-500/50 scale-110'
                : 'text-gray-400 hover:bg-gray-800/80 hover:text-teal-300 hover:scale-105'
            }`}
            title="Cut Tool (C)"
          >
            <Scissors className="w-4 h-4" />
          </button>
          
          <button
            onClick={() => setActiveTool('zoom')}
            className={`p-2.5 rounded-lg transition-all duration-200 ${
              activeTool === 'zoom'
                ? 'bg-gradient-to-br from-teal-500 to-cyan-600 text-white shadow-2xl shadow-teal-500/50 scale-110'
                : 'text-gray-400 hover:bg-gray-800/80 hover:text-teal-300 hover:scale-105'
            }`}
            title="Zoom Tool (Z)"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          
          <button
            onClick={() => setActiveTool('move')}
            className={`p-2.5 rounded-lg transition-all duration-200 ${
              activeTool === 'move'
                ? 'bg-gradient-to-br from-teal-500 to-cyan-600 text-white shadow-2xl shadow-teal-500/50 scale-110'
                : 'text-gray-400 hover:bg-gray-800/80 hover:text-teal-300 hover:scale-105'
            }`}
            title="Move Tool (M)"
          >
            <Move className="w-4 h-4" />
          </button>
          
          <button
            onClick={() => setActiveTool('pan')}
            className={`p-2.5 rounded-lg transition-all duration-200 ${
              activeTool === 'pan'
                ? 'bg-gradient-to-br from-teal-500 to-cyan-600 text-white shadow-2xl shadow-teal-500/50 scale-110'
                : 'text-gray-400 hover:bg-gray-800/80 hover:text-teal-300 hover:scale-105'
            }`}
            title="Pan Tool (H)"
          >
            <Hand className="w-4 h-4" />
          </button>
        </div>

        {/* Project Controls Group - Enhanced */}
        <div className="flex items-center gap-3 bg-black/60 backdrop-blur-md rounded-xl p-2 border border-teal-500/20 shadow-xl shadow-black/40">
          <button
            onClick={() => { setSnapEnabled(!snapEnabled); showNotification(`Snap ${!snapEnabled ? 'ON' : 'OFF'}`, 'info') }}
            className={`px-4 py-2 rounded-lg transition-all duration-200 flex items-center gap-2 ${
              snapEnabled 
                ? 'bg-gradient-to-br from-teal-600/60 to-cyan-600/60 text-teal-200 border border-teal-400/40 shadow-lg shadow-teal-500/30' 
                : 'bg-gray-900/60 text-gray-400 hover:text-teal-300 border border-teal-900/30 hover:border-teal-700/40'
            }`}
            title="Snap to grid"
          >
            <Magnet className="w-4 h-4" />
            <span className="text-xs font-semibold">Snap</span>
          </button>

          <button
            onClick={() => { setPlayheadLocked(!playheadLocked); showNotification(`Playhead ${!playheadLocked ? 'Locked' : 'Unlocked'}`, 'info') }}
            className={`p-2.5 rounded-lg transition-all duration-200 ${
              playheadLocked 
                ? 'bg-gradient-to-br from-teal-600/60 to-cyan-600/60 text-teal-200 border border-teal-400/40 shadow-lg shadow-teal-500/30' 
                : 'bg-gray-900/60 text-gray-400 hover:text-teal-300 border border-teal-900/30 hover:border-teal-700/40'
            }`}
            title={`${playheadLocked ? 'Unlock' : 'Lock'} playhead tracking`}
          >
            {playheadLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
          </button>
        </div>

        <button
          onClick={() => { setSeekToEarliestOnPlay(!seekToEarliestOnPlay); showNotification(`Auto-seek ${!seekToEarliestOnPlay ? 'ON' : 'OFF'} on Play`, 'info') }}
          className={`p-1.5 rounded transition-all ${seekToEarliestOnPlay ? 'bg-cyan-700 text-white shadow-cyan-500/30 shadow' : 'bg-gray-900 text-gray-400 hover:text-white border border-cyan-900/30'}`}
          title={`Toggle auto-seek to earliest clip on Play`}
        >
          <Radio className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={() => {
            const next = !rememberPreset;
            setRememberPreset(next);
            try {
              if (next) localStorage.setItem('studio_layout', '1080');
              else localStorage.removeItem('studio_layout');
            } catch {}
            showNotification(`Remember preset ${next ? 'enabled' : 'disabled'}`, 'info');
          }}
          className={`p-1.5 rounded transition-all ${rememberPreset ? 'bg-cyan-700 text-white shadow-cyan-500/30 shadow' : 'bg-gray-900 text-gray-400 hover:text-white border border-cyan-900/30'}`}
          title={`Remember layout preset`}
        >
          <Save className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={() => { 
            const newBpm = prompt('Enter BPM (60-200):', bpm.toString());
            if (newBpm) {
              const parsed = parseInt(newBpm);
              if (!isNaN(parsed) && parsed >= 60 && parsed <= 200) {
                setBpm(parsed);
                showNotification(`BPM: ${parsed}`, 'info');
              }
            }
          }}
          className="px-1.5 py-1 rounded text-xs bg-gray-900 text-gray-300 hover:text-white border border-cyan-900/30 hover:border-cyan-700 transition-all flex items-center gap-1"
          title="Change BPM"
        >
          <Clock className="w-3 h-3" />
          <span>{bpm}</span>
        </button>

        <button
          onClick={() => { 
            setTimeSig(timeSig === '4/4' ? '3/4' : timeSig === '3/4' ? '6/8' : '4/4'); 
            showNotification(`Time: ${timeSig === '4/4' ? '3/4' : timeSig === '3/4' ? '6/8' : '4/4'}`, 'info');
          }}
          className="px-1.5 py-1 rounded text-xs bg-gray-900 text-gray-300 hover:text-white border border-cyan-900/30 hover:border-cyan-700 transition-all flex items-center gap-1"
          title="Time Signature"
        >
          <Hash className="w-3 h-3" />
          <span>{timeSig}</span>
        </button>

        <div className="w-px h-6 bg-cyan-900/50 mx-0.5" />

        {/* File Operations */}
        <button
          onClick={handleSaveProject}
          className="p-1.5 rounded bg-gray-900 hover:bg-gray-800 text-gray-400 hover:text-white border border-cyan-900/30 hover:border-cyan-700 transition-all"
          title="Save project (Ctrl+S)"
        >
          <Save className="w-3.5 h-3.5" />
        </button>

        {/* Projects Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowProjectMenu(!showProjectMenu)}
            className="p-1.5 rounded bg-gray-900 hover:bg-gray-800 text-gray-400 hover:text-white border border-cyan-900/30 hover:border-cyan-700 transition-all flex items-center gap-1"
            title="Load project"
          >
            <Folder className="w-3.5 h-3.5" />
            {savedProjects.length > 0 && (
              <span className="text-xs bg-cyan-600 text-white rounded-full w-3.5 h-3.5 flex items-center justify-center text-[9px]">
                {savedProjects.length}
              </span>
            )}
          </button>

          {showProjectMenu && (
            <>
              {/* Backdrop to close menu */}
              <div 
                className="fixed inset-0 z-40" 
                onClick={() => setShowProjectMenu(false)}
              />
              
              {/* Dropdown menu */}
              <div className="absolute top-full mt-2 right-0 w-80 bg-gradient-to-b from-black via-cyan-950/60 to-black border border-cyan-500/50 rounded-lg shadow-2xl shadow-cyan-500/20 z-50 max-h-96 overflow-y-auto">
                <div className="p-3 border-b border-cyan-500/30">
                  <h3 className="text-sm font-bold text-white">Saved Projects</h3>
                  <p className="text-xs text-cyan-400/60 mt-0.5">{savedProjects.length} project{savedProjects.length !== 1 ? 's' : ''}</p>
                </div>

                {savedProjects.length === 0 ? (
                  <div className="p-6 text-center">
                    <Folder className="w-10 h-10 text-cyan-700 mx-auto mb-2 opacity-50" />
                    <p className="text-sm text-gray-400">No saved projects</p>
                    <p className="text-xs text-cyan-400/60 mt-1">Press Ctrl+S to save</p>
                  </div>
                ) : (
                  <div className="p-2 space-y-1">
                    {savedProjects.map((project) => (
                      <button
                        key={project.id}
                        onClick={() => handleLoadProject(project.id)}
                        className="w-full p-3 rounded-lg bg-cyan-900/20 hover:bg-cyan-900/40 border border-cyan-500/30 hover:border-cyan-500/50 text-left transition-all group flex items-start gap-3"
                      >
                        <Folder className="w-4 h-4 text-cyan-400 mt-0.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white truncate">
                            {project.name}
                          </p>
                          <p className="text-xs text-cyan-400/60 mt-0.5">
                            {project.trackCount} track{project.trackCount !== 1 ? 's' : ''} • {new Date(project.timestamp).toLocaleString()}
                          </p>
                        </div>
                        <button
                          onClick={(e) => handleDeleteProject(project.id, e)}
                          className="p-1 rounded hover:bg-red-500/20 text-gray-500 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                          title="Delete project"
                        >
                          ×
                        </button>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <button
          onClick={handleExportAudio}
          className="p-1.5 rounded bg-gray-900 hover:bg-gray-800 text-gray-400 hover:text-white border border-cyan-900/30 hover:border-cyan-700 transition-all"
          title="Export audio"
        >
          <Download className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={() => setShowReleaseModal(true)}
          className="p-1.5 rounded bg-cyan-700 hover:bg-cyan-600 text-white transition-all shadow-lg shadow-cyan-500/20"
          title="Release to Explore/Library"
        >
          <Radio className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={handleBrowseFiles}
          className="p-1.5 rounded bg-cyan-700 hover:bg-cyan-600 text-white transition-all shadow-lg shadow-cyan-500/20"
          title="Import audio"
        >
          <Upload className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={() => setShowShortcuts(true)}
          className="p-1.5 rounded bg-gray-900 hover:bg-gray-800 text-gray-400 hover:text-white border border-cyan-900/30 hover:border-cyan-700 transition-all"
          title="Keyboard shortcuts"
        >
          <HelpCircle className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={() => setShowLibrary(!showLibrary)}
          className={`p-1.5 rounded ${
            showLibrary 
              ? 'bg-cyan-700 text-white shadow-lg shadow-cyan-500/30' 
              : 'bg-gray-900 hover:bg-gray-800 text-gray-400 hover:text-white border border-cyan-900/30'
          } transition-all`}
          title="Library"
        >
          <Library className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={() => {
            addEmptyTrack();
            showNotification('Track added', 'success');
          }}
          className="p-1.5 rounded bg-cyan-700 hover:bg-cyan-600 text-white border border-cyan-900/30 hover:border-cyan-700 transition-colors"
          title="Add track"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden relative min-h-0 pb-12">
        {/* Timeline */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Timeline ruler with zoom + BPM grid */}
          <TimelineRuler bpm={bpm} timeSig={timeSig} snapEnabled={snapEnabled} scrollContainerRef={clipsScrollRef} />

          {/* Timeline - Always show, with empty tracks */}
          <Timeline snapEnabled={snapEnabled} bpm={bpm} activeTool={activeTool} playheadLocked={playheadLocked} onSplitStems={handleSplitStems} clipsContainerRef={clipsScrollRef} />
          
          {/* Add Track Button - Always visible below tracks */}
          <div className="px-4 py-2 border-t border-cyan-500/20 bg-black/40 shrink-0">
            <button
              onClick={() => {
                const nextNum = tracks.length + 1;
                addTrack(`Track ${nextNum}`);
                showNotification(`Track ${nextNum} added`, 'success');
              }}
              title="Add new track (Shortcut: +)"
              className="w-full px-4 py-1.5 rounded-lg bg-cyan-700 hover:bg-cyan-600 text-white font-medium transition-all flex items-center justify-center gap-2 group"
            >
              <Plus className="w-4 h-4 group-hover:scale-110 transition-transform" />
              <span>Add Track</span>
            </button>
          </div>
        </div>

        {/* Track Inspector Sidebar - show only when a track is selected */}
        {selectedTrackId ? <TrackInspector /> : null}

        {/* Library Sidebar */}
        {showLibrary && (
          <div className="absolute right-80 top-0 bottom-0 w-80 bg-gradient-to-b from-black/95 via-cyan-950/60 to-black/90 backdrop-blur-xl border-l border-cyan-500/30 shadow-2xl shadow-cyan-500/20 z-20 flex flex-col">
            {/* Library Header */}
            <div className="h-16 border-b border-cyan-500/30 flex items-center justify-between px-4 shrink-0">
              <div className="flex items-center gap-2">
                <Library className="w-5 h-5 text-cyan-400" />
                <h2 className="text-lg font-bold text-white">Your Library</h2>
              </div>
              <button
                onClick={() => setShowLibrary(false)}
                className="p-2 rounded hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
              >
                ×
              </button>
            </div>

            {/* Library Tabs */}
            <div className="flex border-b border-cyan-500/30 shrink-0">
              <button
                onClick={() => setLibraryTab('music')}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-all ${
                  libraryTab === 'music'
                    ? 'text-cyan-400 border-b-2 border-cyan-400 bg-cyan-900/20'
                    : 'text-gray-400 hover:text-white hover:bg-cyan-900/10'
                }`}
              >
                <Music className="w-4 h-4 inline-block mr-2" />
                Music
              </button>
              <button
                onClick={() => setLibraryTab('effects')}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-all ${
                  libraryTab === 'effects'
                    ? 'text-cyan-400 border-b-2 border-cyan-400 bg-cyan-900/20'
                    : 'text-gray-400 hover:text-white hover:bg-cyan-900/10'
                }`}
              >
                <Sparkles className="w-4 h-4 inline-block mr-2" />
                Effects
              </button>
            </div>

            {/* Library Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {isLoadingLibrary ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full" />
                </div>
              ) : libraryTab === 'music' ? (
                libraryTracks.length === 0 ? (
                  <div className="text-center text-gray-400 py-12">
                    <FileAudio className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">No tracks in library</p>
                    <p className="text-xs mt-2">Generate music in the Create tab first</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {libraryTracks.map((track) => (
                      <div
                        key={track.id}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.effectAllowed = 'copy';
                          e.dataTransfer.setData('application/json', JSON.stringify({
                            type: 'library-track',
                            trackData: track
                          }));
                          try {
                            const img = new Image();
                            img.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"></svg>';
                            e.dataTransfer.setDragImage(img, 0, 0);
                          } catch {}
                        }}
                        onClick={() => handleAddFromLibrary(track)}
                        className="w-full p-3 rounded-lg bg-cyan-900/20 hover:bg-cyan-900/40 border border-cyan-500/30 hover:border-cyan-500/50 text-left transition-all group cursor-grab active:cursor-grabbing"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded bg-cyan-700/50 flex items-center justify-center shrink-0 group-hover:bg-cyan-600/50 transition-colors">
                            <Music className="w-5 h-5 text-cyan-200" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white truncate">
                              {track.title || 'Untitled Track'}
                            </p>
                            <p className="text-xs text-cyan-400/60">
                              {new Date(track.created_at).toLocaleDateString()}
                            </p>
                          </div>
                          <Plus className="w-5 h-5 text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </div>
                    ))}
                  </div>
                )
              ) : (
                libraryEffects.length === 0 ? (
                  <div className="text-center text-gray-400 py-12">
                    <Sparkles className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">No effects in library</p>
                    <p className="text-xs mt-2">Generate effects in Track Inspector</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {libraryEffects.map((effect) => (
                      <button
                        key={effect.id}
                        onClick={() => handleAddFromLibrary(effect)}
                        className="w-full p-3 rounded-lg bg-cyan-900/20 hover:bg-cyan-900/40 border border-cyan-500/30 hover:border-cyan-500/50 text-left transition-all group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded bg-purple-700/50 flex items-center justify-center shrink-0 group-hover:bg-purple-600/50 transition-colors">
                            <Sparkles className="w-5 h-5 text-purple-200" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white truncate">
                              {effect.title || 'Generated Effect'}
                            </p>
                            <p className="text-xs text-cyan-400/60">
                              {new Date(effect.created_at).toLocaleDateString()}
                            </p>
                          </div>
                          <Plus className="w-5 h-5 text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </button>
                    ))}
                  </div>
                )
              )}
            </div>

            {/* Library Footer */}
            <div className="border-t border-cyan-500/30 p-4 shrink-0">
              <button
                onClick={libraryTab === 'music' ? loadLibraryTracks : loadLibraryEffects}
                disabled={isLoadingLibrary}
                className="w-full px-4 py-2 rounded bg-cyan-700 hover:bg-cyan-600 disabled:bg-gray-700 disabled:text-gray-500 text-white font-medium transition-all"
              >
                {isLoadingLibrary ? 'Loading...' : 'Refresh Library'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Transport bar */}
      <TransportBar autoSeekOnPlay={seekToEarliestOnPlay} />

      {/* Global drag overlay */}
      {isDragOver && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-40 flex items-center justify-center border-2 border-dashed border-cyan-500">
          <div className="text-center">
            <Upload className="w-10 h-10 text-cyan-400 mx-auto mb-3" />
            <p className="text-cyan-100 font-medium">Drop audio files to import</p>
            <p className="text-cyan-300/60 text-sm mt-1">MP3, WAV, FLAC</p>
          </div>
        </div>
      )}

      {/* Shortcuts modal */}
      {showShortcuts && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className="w-full max-w-2xl bg-gradient-to-b from-black via-cyan-950/60 to-black border border-cyan-800 rounded-2xl p-6 shadow-2xl shadow-cyan-500/20">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-cyan-400" />
                <h3 className="text-lg font-bold text-white">Keyboard Shortcuts</h3>
              </div>
              <button onClick={() => setShowShortcuts(false)} className="px-3 py-1 rounded bg-gray-900 hover:bg-gray-800 text-gray-300 border border-cyan-900/50">Close</button>
            </div>
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {/* Tools */}
              <div>
                <h4 className="text-xs font-bold text-cyan-400 mb-2 uppercase tracking-wide">Tools</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-cyan-100 text-sm">
                  <div className="flex items-center justify-between bg-black/40 border border-cyan-900/50 rounded px-3 py-2"><span>Cursor/Select</span><code className="text-cyan-400">V</code></div>
                  <div className="flex items-center justify-between bg-black/40 border border-cyan-900/50 rounded px-3 py-2"><span>Cut/Split</span><code className="text-cyan-400">C</code></div>
                  <div className="flex items-center justify-between bg-black/40 border border-cyan-900/50 rounded px-3 py-2"><span>Zoom</span><code className="text-cyan-400">Z</code></div>
                </div>
              </div>
              {/* Transport */}
              <div>
                <h4 className="text-xs font-bold text-cyan-400 mb-2 uppercase tracking-wide">Transport</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-cyan-100 text-sm">
                  <div className="flex items-center justify-between bg-black/40 border border-cyan-900/50 rounded px-3 py-2"><span>Play / Pause</span><code className="text-cyan-400">Space</code></div>
                </div>
              </div>
              {/* Generation */}
              <div>
                <h4 className="text-xs font-bold text-cyan-400 mb-2 uppercase tracking-wide">AI Generation</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-cyan-100 text-sm">
                  <div className="flex items-center justify-between bg-black/40 border border-cyan-900/50 rounded px-3 py-2"><span>Generate Song</span><code className="text-cyan-400">A</code></div>
                  <div className="flex items-center justify-between bg-black/40 border border-cyan-900/50 rounded px-3 py-2"><span>Generate Beat</span><code className="text-cyan-400">B</code></div>
                </div>
              </div>
              {/* Track Management */}
              <div>
                <h4 className="text-xs font-bold text-cyan-400 mb-2 uppercase tracking-wide">Track Management</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-cyan-100 text-sm">
                  <div className="flex items-center justify-between bg-black/40 border border-cyan-900/50 rounded px-3 py-2"><span>Add Track</span><code className="text-cyan-400">+</code></div>
                  <div className="flex items-center justify-between bg-black/40 border border-cyan-900/50 rounded px-3 py-2"><span>Delete Track</span><code className="text-cyan-400">Delete</code></div>
                  <div className="flex items-center justify-between bg-black/40 border border-cyan-900/50 rounded px-3 py-2"><span>Duplicate Track</span><code className="text-cyan-400">D</code></div>
                  <div className="flex items-center justify-between bg-black/40 border border-cyan-900/50 rounded px-3 py-2"><span>Enable/Disable Track</span><code className="text-cyan-400">T</code></div>
                </div>
              </div>
              {/* File Operations */}
              <div>
                <h4 className="text-xs font-bold text-cyan-400 mb-2 uppercase tracking-wide">File Operations</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-cyan-100 text-sm">
                  <div className="flex items-center justify-between bg-black/40 border border-cyan-900/50 rounded px-3 py-2"><span>Save Project</span><code className="text-cyan-400">Ctrl + S</code></div>
                  <div className="flex items-center justify-between bg-black/40 border border-cyan-900/50 rounded px-3 py-2"><span>Upload Files</span><code className="text-cyan-400">Ctrl + U</code></div>
                  <div className="flex items-center justify-between bg-black/40 border border-cyan-900/50 rounded px-3 py-2"><span>Export</span><code className="text-cyan-400">E</code></div>
                  <div className="flex items-center justify-between bg-black/40 border border-cyan-900/50 rounded px-3 py-2"><span>Speed Control</span><code className="text-cyan-400">R</code></div>
                </div>
              </div>
              {/* Navigation */}
              <div>
                <h4 className="text-xs font-bold text-cyan-400 mb-2 uppercase tracking-wide">Navigation</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-cyan-100 text-sm">
                  <div className="flex items-center justify-between bg-black/40 border border-cyan-900/50 rounded px-3 py-2"><span>Toggle Library</span><code className="text-cyan-400">L</code></div>
                  <div className="flex items-center justify-between bg-black/40 border border-cyan-900/50 rounded px-3 py-2"><span>Toggle Shortcuts</span><code className="text-cyan-400">F7</code></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Beat Generation Modal */}
      <BeatGenerationModal
        isOpen={showBeatModal}
        onClose={() => setShowBeatModal(false)}
        onGenerate={handleBeatGenerated}
      />

      {/* Song Generation Modal */}
      <SongGenerationModal
        isOpen={showSongModal}
        onClose={() => setShowSongModal(false)}
        onGenerate={handleSongGenerated}
      />

      {/* Stem Split Modal */}
      <StemSplitModal
        isOpen={showStemModal}
        onClose={() => {
          setShowStemModal(false);
          setStemSplitClip(null);
          setIsSplittingStem(false);
        }}
        onSplit={executeStemSplit}
        clipName={stemSplitClip?.name || 'Audio Clip'}
        isProcessing={isSplittingStem}
      />

      {/* Export Modal (stub) */}
      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        onStartExport={(fmt) => {
          showNotification(`Export started (${fmt.toUpperCase()}) — stub`, 'info')
        }}
        projectName={projectName}
        bpm={bpm}
        timeSig={timeSig}
        session={{
          tracks: tracks.map(t => ({
            id: t.id,
            name: t.name,
            color: t.color,
            volume: t.volume,
            pan: t.pan,
            mute: t.mute,
            solo: t.solo,
            clips: t.clips,
          }))
        }}
      />

      {/* Release Modal */}
      <ReleaseModal
        isOpen={showReleaseModal}
        onClose={() => setShowReleaseModal(false)}
        onRelease={handleRelease}
        projectName={projectName}
      />
    </div>
  );
}

export default function MultiTrackStudioPage() {
  return (
    <StudioProvider>
      <StudioContent />
    </StudioProvider>
  );
}
