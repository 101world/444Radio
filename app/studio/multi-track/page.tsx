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
import { Upload, Sparkles, Library, Music, Plus, Save, Download, FileAudio, Folder, HelpCircle, Settings, Volume2, Timer, Hash, Clock, Magnet, Radio, Music2, MousePointer2, Scissors, ZoomIn, Move, Hand } from 'lucide-react';
import { StudioProvider, useStudio } from '@/app/contexts/StudioContext';
import Timeline from '@/app/components/studio/Timeline';
import TransportBar from '@/app/components/studio/TransportBar';
import EffectsRack from '@/app/components/studio/EffectsRack';
import TimelineRuler from '@/app/components/studio/TimelineRuler';
import TrackInspector from '@/app/components/studio/TrackInspector';
import BeatGenerationModal from '@/app/components/studio/BeatGenerationModal';
import SongGenerationModal from '@/app/components/studio/SongGenerationModal';
import ExportModal from '@/app/components/studio/ExportModal';
import ReleaseModal from '@/app/components/studio/ReleaseModal';
import type { ToolType } from '@/app/components/studio/Toolbar';
import { useUser } from '@clerk/nextjs';

function StudioContent() {
  const { addTrack, addEmptyTrack, tracks, addClipToTrack, isPlaying, setPlaying, selectedTrackId, removeTrack } = useStudio();
  const { user } = useUser();
  const [showAISidebar, setShowAISidebar] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [activeTool, setActiveTool] = useState<ToolType>('select');
  const [isLoadingLibrary, setIsLoadingLibrary] = useState(false);
  const [libraryTracks, setLibraryTracks] = useState<any[]>([]);
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showReleaseModal, setShowReleaseModal] = useState(false);
  const [savedProjects, setSavedProjects] = useState<Array<{id: string; name: string; timestamp: number; trackCount: number}>>([]);
  const [showProjectMenu, setShowProjectMenu] = useState(false);

  // Show notification helper
  const showNotification = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
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
  }, []); // Run once on mount

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

  // Load library when sidebar opens
  useEffect(() => {
    if (showLibrary && libraryTracks.length === 0) {
      loadLibraryTracks();
    }
  }, [showLibrary, libraryTracks.length, loadLibraryTracks]);

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
        
        addTrack(trackName, audioUrl);
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

      addTrack(trackName, audioUrl);
      showNotification(`Added "${trackName}" to studio`, 'success');
      console.log(`✅ Added library track: ${trackName}`);
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
              addClipToTrack(newTrackId, clipData.audioUrl, clipData.name, clipData.startTime);
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
        const error = await response.json();
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
      throw error;
    }
  }, [showNotification]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Ignore if typing in input
      const tag = (e.target as HTMLElement)?.tagName
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA'
      if (isInput) return

      // Space: play/pause
      if (e.code === 'Space') {
        e.preventDefault()
        setPlaying(!isPlaying)
        return
      }
      // Ctrl+S save
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        handleSaveProject()
        return
      }
      // Ctrl+O open
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'o') {
        e.preventDefault()
        handleBrowseFiles()
        return
      }
      // R restore autosave
      if (!e.ctrlKey && !e.metaKey && e.key.toLowerCase() === 'r') {
        restoreAutosave()
        return
      }
      // Delete: remove selected track
      if (e.key === 'Delete' && selectedTrackId) {
        removeTrack(selectedTrackId)
        showNotification('Track removed', 'success')
        return
      }
      // C: Cursor/Select tool
      if (!e.ctrlKey && !e.metaKey && e.key.toLowerCase() === 'c') {
        setActiveTool('select')
        showNotification('Cursor tool active', 'info')
        return
      }
      // V: Move tool
      if (!e.ctrlKey && !e.metaKey && e.key.toLowerCase() === 'v') {
        setActiveTool('move')
        showNotification('Move tool active', 'info')
        return
      }
      // D: Cut tool (scissors)
      if (!e.ctrlKey && !e.metaKey && e.key.toLowerCase() === 'd') {
        setActiveTool('cut')
        showNotification('Cut tool active', 'info')
        return
      }
      // Z: Zoom tool
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
      // Ctrl+U: Upload/Import files
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'u') {
        e.preventDefault()
        handleBrowseFiles()
        return
      }
      // E: Toggle effects rack
      if (!e.ctrlKey && !e.metaKey && e.key.toLowerCase() === 'e') {
        // Toggle effects via AI sidebar toggle (effects are in AI panel)
        setShowAISidebar(prev => !prev)
        showNotification(showAISidebar ? 'Effects closed' : 'Effects opened', 'info')
        return
      }
      // T: Focus timeline (scroll to top)
      if (!e.ctrlKey && !e.metaKey && e.key.toLowerCase() === 't') {
        window.scrollTo({ top: 0, behavior: 'smooth' })
        showNotification('Timeline focused', 'info')
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
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isPlaying, selectedTrackId, removeTrack, setPlaying, handleSaveProject, restoreAutosave, showNotification, setActiveTool, setShowSongModal, setShowBeatModal, tracks, addTrack, handleBrowseFiles, showAISidebar, setShowAISidebar, showLibrary, setShowLibrary, loadLibraryTracks, setShowShortcuts])

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
        addTrack(name, url)
        added++
      }
    }
    if (added) showNotification(`Added ${added} track${added>1?'s':''} from drop`, 'success')
  }

  return (
    <div 
      className="h-screen flex flex-col bg-black relative"
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
          <div>
            <h1 className="text-lg font-bold text-white">444Radio Studio</h1>
            <input 
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              className="w-36 px-2 py-0.5 text-xs rounded bg-black/30 border border-cyan-900/30 text-cyan-100 placeholder:text-cyan-400/40 focus:outline-none focus:border-cyan-500/60"
              placeholder="Untitled Project"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
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
      <div className="h-12 bg-black border-b border-cyan-900/50 flex items-center px-4 gap-2 shrink-0">
        <span className="text-xs text-cyan-500 font-medium mr-1">Tools:</span>
        
        {/* Selection Tools */}
        <button
          onClick={() => setActiveTool('select')}
          className={`p-2 rounded transition-all ${
            activeTool === 'select'
              ? 'bg-cyan-700 text-white shadow-lg shadow-cyan-500/30'
              : 'bg-gray-900 text-gray-400 hover:bg-gray-800 hover:text-white border border-cyan-900/30'
          }`}
          title="Selection Tool (V)"
        >
          <MousePointer2 className="w-4 h-4" />
        </button>
        
        <button
          onClick={() => setActiveTool('cut')}
          className={`p-2 rounded transition-all ${
            activeTool === 'cut'
              ? 'bg-cyan-700 text-white shadow-lg shadow-cyan-500/30'
              : 'bg-gray-900 text-gray-400 hover:bg-gray-800 hover:text-white border border-cyan-900/30'
          }`}
          title="Cut Tool (C)"
        >
          <Scissors className="w-4 h-4" />
        </button>
        
        <button
          onClick={() => setActiveTool('zoom')}
          className={`p-2 rounded transition-all ${
            activeTool === 'zoom'
              ? 'bg-cyan-700 text-white shadow-lg shadow-cyan-500/30'
              : 'bg-gray-900 text-gray-400 hover:bg-gray-800 hover:text-white border border-cyan-900/30'
          }`}
          title="Zoom Tool (Z)"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        
        <button
          onClick={() => setActiveTool('move')}
          className={`p-2 rounded transition-all ${
            activeTool === 'move'
              ? 'bg-cyan-700 text-white shadow-lg shadow-cyan-500/30'
              : 'bg-gray-900 text-gray-400 hover:bg-gray-800 hover:text-white border border-cyan-900/30'
          }`}
          title="Move Tool (M)"
        >
          <Move className="w-4 h-4" />
        </button>
        
        <button
          onClick={() => setActiveTool('pan')}
          className={`p-2 rounded transition-all ${
            activeTool === 'pan'
              ? 'bg-cyan-700 text-white shadow-lg shadow-cyan-500/30'
              : 'bg-gray-900 text-gray-400 hover:bg-gray-800 hover:text-white border border-cyan-900/30'
          }`}
          title="Pan Tool (H)"
        >
          <Hand className="w-4 h-4" />
        </button>

        <div className="w-px h-8 bg-cyan-900/50 mx-1" />

        {/* Project Controls */}
        <button
          onClick={() => { setSnapEnabled(!snapEnabled); showNotification(`Snap ${!snapEnabled ? 'ON' : 'OFF'}`, 'info') }}
          className={`p-2 rounded transition-all ${snapEnabled ? 'bg-cyan-700 text-white shadow-cyan-500/30 shadow' : 'bg-gray-900 text-gray-400 hover:text-white border border-cyan-900/30'}`}
          title="Snap to grid"
        >
          <Magnet className="w-4 h-4" />
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
          className="px-2 py-1.5 rounded text-xs bg-gray-900 text-gray-300 hover:text-white border border-cyan-900/30 hover:border-cyan-700 transition-all flex items-center gap-1"
          title="Change BPM"
        >
          <Clock className="w-3.5 h-3.5" />
          <span>{bpm}</span>
        </button>

        <button
          onClick={() => { 
            setTimeSig(timeSig === '4/4' ? '3/4' : timeSig === '3/4' ? '6/8' : '4/4'); 
            showNotification(`Time: ${timeSig === '4/4' ? '3/4' : timeSig === '3/4' ? '6/8' : '4/4'}`, 'info');
          }}
          className="px-2 py-1.5 rounded text-xs bg-gray-900 text-gray-300 hover:text-white border border-cyan-900/30 hover:border-cyan-700 transition-all flex items-center gap-1"
          title="Time Signature"
        >
          <Hash className="w-3.5 h-3.5" />
          <span>{timeSig}</span>
        </button>

        <div className="w-px h-8 bg-cyan-900/50 mx-1" />

        {/* File Operations */}
        <button
          onClick={handleSaveProject}
          className="p-2 rounded bg-gray-900 hover:bg-gray-800 text-gray-400 hover:text-white border border-cyan-900/30 hover:border-cyan-700 transition-all"
          title="Save project (Ctrl+S)"
        >
          <Save className="w-4 h-4" />
        </button>

        {/* Projects Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowProjectMenu(!showProjectMenu)}
            className="p-2 rounded bg-gray-900 hover:bg-gray-800 text-gray-400 hover:text-white border border-cyan-900/30 hover:border-cyan-700 transition-all flex items-center gap-1"
            title="Load project"
          >
            <Folder className="w-4 h-4" />
            {savedProjects.length > 0 && (
              <span className="text-xs bg-cyan-600 text-white rounded-full w-4 h-4 flex items-center justify-center">
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
          className="p-2 rounded bg-gray-900 hover:bg-gray-800 text-gray-400 hover:text-white border border-cyan-900/30 hover:border-cyan-700 transition-all"
          title="Export audio"
        >
          <Download className="w-4 h-4" />
        </button>

        <button
          onClick={() => setShowReleaseModal(true)}
          className="p-2 rounded bg-cyan-700 hover:bg-cyan-600 text-white transition-all shadow-lg shadow-cyan-500/20"
          title="Release to Explore/Library"
        >
          <Radio className="w-4 h-4" />
        </button>

        <button
          onClick={handleBrowseFiles}
          className="p-2 rounded bg-cyan-700 hover:bg-cyan-600 text-white transition-all shadow-lg shadow-cyan-500/20"
          title="Import audio"
        >
          <Upload className="w-4 h-4" />
        </button>

        <button
          onClick={() => setShowShortcuts(true)}
          className="p-2 rounded bg-gray-900 hover:bg-gray-800 text-gray-400 hover:text-white border border-cyan-900/30 hover:border-cyan-700 transition-all"
          title="Keyboard shortcuts"
        >
          <HelpCircle className="w-4 h-4" />
        </button>

        <button
          onClick={() => setShowLibrary(!showLibrary)}
          className={`p-2 rounded ${
            showLibrary 
              ? 'bg-cyan-700 text-white shadow-lg shadow-cyan-500/30' 
              : 'bg-gray-900 hover:bg-gray-800 text-gray-400 hover:text-white border border-cyan-900/30'
          } transition-all`}
          title="Library"
        >
          <Library className="w-4 h-4" />
        </button>

        <button
          onClick={() => {
            addEmptyTrack();
            showNotification('Track added', 'success');
          }}
          className="p-2 rounded bg-cyan-700 hover:bg-cyan-600 text-white border border-cyan-900/30 hover:border-cyan-700 transition-colors"
          title="Add track"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Timeline */}
        <div className="flex-1 flex flex-col">
          {/* Timeline ruler with zoom + BPM grid */}
          <TimelineRuler bpm={bpm} timeSig={timeSig} snapEnabled={snapEnabled} />

          {/* Timeline - Always show, with empty tracks */}
          <Timeline snapEnabled={snapEnabled} bpm={bpm} activeTool={activeTool} />
          
          {/* Add Track Button - Always visible below tracks */}
          <div className="px-4 py-3 border-t border-cyan-500/20 bg-black/40">
            <button
              onClick={() => {
                const nextNum = tracks.length + 1;
                addTrack(`Track ${nextNum}`);
                showNotification(`Track ${nextNum} added`, 'success');
              }}
              title="Add new track (Shortcut: +)"
              className="w-full px-4 py-2.5 rounded-lg bg-cyan-700 hover:bg-cyan-600 text-white font-medium transition-all flex items-center justify-center gap-2 group"
            >
              <Plus className="w-5 h-5 group-hover:scale-110 transition-transform" />
              <span>Add Track</span>
            </button>
          </div>
        </div>

        {/* Track Inspector Sidebar */}
        <TrackInspector />

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

            {/* Library Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {isLoadingLibrary ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full" />
                </div>
              ) : libraryTracks.length === 0 ? (
                <div className="text-center text-gray-400 py-12">
                  <FileAudio className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">No tracks in library</p>
                  <p className="text-xs mt-2">Generate music in the Create tab first</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {libraryTracks.map((track) => (
                    <button
                      key={track.id}
                      onClick={() => handleAddFromLibrary(track)}
                      className="w-full p-3 rounded-lg bg-cyan-900/20 hover:bg-cyan-900/40 border border-cyan-500/30 hover:border-cyan-500/50 text-left transition-all group"
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
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Library Footer */}
            <div className="border-t border-cyan-500/30 p-4 shrink-0">
              <button
                onClick={loadLibraryTracks}
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
      <TransportBar />

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
                  <div className="flex items-center justify-between bg-black/40 border border-cyan-900/50 rounded px-3 py-2"><span>Cursor/Select</span><code className="text-cyan-400">C</code></div>
                  <div className="flex items-center justify-between bg-black/40 border border-cyan-900/50 rounded px-3 py-2"><span>Move</span><code className="text-cyan-400">V</code></div>
                  <div className="flex items-center justify-between bg-black/40 border border-cyan-900/50 rounded px-3 py-2"><span>Cut/Split</span><code className="text-cyan-400">D</code></div>
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
                </div>
              </div>
              {/* File Operations */}
              <div>
                <h4 className="text-xs font-bold text-cyan-400 mb-2 uppercase tracking-wide">File Operations</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-cyan-100 text-sm">
                  <div className="flex items-center justify-between bg-black/40 border border-cyan-900/50 rounded px-3 py-2"><span>Save Project</span><code className="text-cyan-400">Ctrl + S</code></div>
                  <div className="flex items-center justify-between bg-black/40 border border-cyan-900/50 rounded px-3 py-2"><span>Open/Import</span><code className="text-cyan-400">Ctrl + O</code></div>
                  <div className="flex items-center justify-between bg-black/40 border border-cyan-900/50 rounded px-3 py-2"><span>Upload Files</span><code className="text-cyan-400">Ctrl + U</code></div>
                  <div className="flex items-center justify-between bg-black/40 border border-cyan-900/50 rounded px-3 py-2"><span>Restore Autosave</span><code className="text-cyan-400">R</code></div>
                </div>
              </div>
              {/* Navigation */}
              <div>
                <h4 className="text-xs font-bold text-cyan-400 mb-2 uppercase tracking-wide">Navigation</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-cyan-100 text-sm">
                  <div className="flex items-center justify-between bg-black/40 border border-cyan-900/50 rounded px-3 py-2"><span>Toggle Effects</span><code className="text-cyan-400">E</code></div>
                  <div className="flex items-center justify-between bg-black/40 border border-cyan-900/50 rounded px-3 py-2"><span>Focus Timeline</span><code className="text-cyan-400">T</code></div>
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
