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

  // Show notification helper
  const showNotification = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  }, []);

  // Add 3 empty tracks on mount (AudioMass style)
  useEffect(() => {
    if (tracks.length === 0) {
      addEmptyTrack();
      addEmptyTrack();
      addEmptyTrack();
      console.log('✅ Studio initialized with 3 empty tracks');
    }
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

  // Export/Save project (placeholder for future implementation)
  const handleSaveProject = useCallback(() => {
    showNotification('Save project feature coming soon', 'info');
    // TODO: Implement project save/load functionality
  }, [showNotification]);

  const handleExportAudio = useCallback(() => {
    setShowExportModal(true);
  }, []);

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
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isPlaying, selectedTrackId, removeTrack, setPlaying, handleSaveProject])

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
            title="Generate AI Beat - 16 credits"
          >
            <Radio className="w-4 h-4" />
            <span className="text-sm">Beat</span>
          </button>

          {/* Song Generation */}
          <button
            onClick={() => setShowSongModal(true)}
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-700 hover:to-cyan-600 text-white font-medium transition-all shadow-lg shadow-cyan-500/30 flex items-center gap-2"
            title="Generate AI Song - 16 credits"
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
          title="Save project"
        >
          <Save className="w-4 h-4" />
        </button>

        <button
          onClick={handleExportAudio}
          className="p-2 rounded bg-gray-900 hover:bg-gray-800 text-gray-400 hover:text-white border border-cyan-900/30 hover:border-cyan-700 transition-all"
          title="Export audio"
        >
          <Download className="w-4 h-4" />
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-cyan-100 text-sm">
              <div className="flex items-center justify-between bg-black/40 border border-cyan-900/50 rounded px-3 py-2"><span>Play / Pause</span><code className="text-cyan-400">Space</code></div>
              <div className="flex items-center justify-between bg-black/40 border border-cyan-900/50 rounded px-3 py-2"><span>Save Project</span><code className="text-cyan-400">Ctrl + S</code></div>
              <div className="flex items-center justify-between bg-black/40 border border-cyan-900/50 rounded px-3 py-2"><span>Import Audio</span><code className="text-cyan-400">Ctrl + O</code></div>
              <div className="flex items-center justify-between bg-black/40 border border-cyan-900/50 rounded px-3 py-2"><span>Restore Autosave</span><code className="text-cyan-400">R</code></div>
              <div className="flex items-center justify-between bg-black/40 border border-cyan-900/50 rounded px-3 py-2"><span>Delete Track</span><code className="text-cyan-400">Delete</code></div>
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
