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
import { Upload, Sparkles, Library, Music, Plus, Save, Download, FileAudio, Folder } from 'lucide-react';
import { StudioProvider, useStudio } from '@/app/contexts/StudioContext';
import Timeline from '@/app/components/studio/Timeline';
import TransportBar from '@/app/components/studio/TransportBar';
import EffectsRack from '@/app/components/studio/EffectsRack';
import TimelineRuler from '@/app/components/studio/TimelineRuler';
import TrackInspector from '@/app/components/studio/TrackInspector';
import Toolbar from '@/app/components/studio/Toolbar';
import type { ToolType } from '@/app/components/studio/Toolbar';
import { useUser } from '@clerk/nextjs';

function StudioContent() {
  const { addTrack, addEmptyTrack, tracks, addClipToTrack } = useStudio();
  const { user } = useUser();
  const [showAISidebar, setShowAISidebar] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [activeTool, setActiveTool] = useState<ToolType>('select');
  const [isLoadingLibrary, setIsLoadingLibrary] = useState(false);
  const [libraryTracks, setLibraryTracks] = useState<any[]>([]);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    showNotification('Export audio feature coming soon', 'info');
    // TODO: Implement audio export/mixdown functionality
  }, [showNotification]);

  return (
    <div className="h-screen flex flex-col bg-black relative">
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
      <header className="h-16 bg-gradient-to-r from-black via-teal-950/30 to-black border-b border-teal-900/50 flex items-center justify-between px-6 shrink-0 shadow-lg shadow-teal-500/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-700 to-teal-500 flex items-center justify-center shadow-lg shadow-teal-500/50">
            <span className="text-white font-bold text-lg">4</span>
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">
              444Radio Studio
            </h1>
            <p className="text-xs text-teal-400">Multi-Track Audio Editor • {tracks.length} track{tracks.length !== 1 ? 's' : ''}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Save Project */}
          <button
            onClick={handleSaveProject}
            className="px-3 py-2 rounded bg-gray-900 hover:bg-gray-800 text-gray-400 hover:text-white border border-teal-900/50 transition-all flex items-center gap-2 text-sm"
            title="Save project (coming soon)"
          >
            <Save className="w-4 h-4" />
            <span className="hidden sm:inline">Save</span>
          </button>

          {/* Export Audio */}
          <button
            onClick={handleExportAudio}
            className="px-3 py-2 rounded bg-gray-900 hover:bg-gray-800 text-gray-400 hover:text-white border border-teal-900/50 transition-all flex items-center gap-2 text-sm"
            title="Export audio (coming soon)"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Export</span>
          </button>

          {/* Divider */}
          <div className="w-px h-8 bg-teal-900/50" />

          {/* Import Audio Button */}
          <button
            onClick={handleBrowseFiles}
            className="px-4 py-2 rounded bg-teal-700 hover:bg-teal-600 text-white font-medium transition-all shadow-lg shadow-teal-500/20 flex items-center gap-2"
          >
            <Upload className="w-4 h-4" />
            <span className="hidden sm:inline">Import Audio</span>
          </button>

          {/* AI Generation */}
          <button
            onClick={() => {
              setShowAISidebar(!showAISidebar);
              showNotification('AI generation integration coming soon', 'info');
            }}
            className="px-4 py-2 rounded bg-teal-900/30 hover:bg-teal-900/50 text-teal-400 border border-teal-800 transition-colors flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4" />
            <span className="hidden sm:inline">AI Generate</span>
          </button>

          {/* Library */}
          <button
            onClick={() => setShowLibrary(!showLibrary)}
            className={`px-4 py-2 rounded ${
              showLibrary 
                ? 'bg-teal-700 text-white shadow-lg shadow-teal-500/30' 
                : 'bg-teal-900/30 hover:bg-teal-900/50 text-teal-400 border border-teal-800'
            } transition-all flex items-center gap-2`}
          >
            <Library className="w-4 h-4" />
            <span className="hidden sm:inline">Library</span>
          </button>

          {/* Add Empty Track */}
          <button
            onClick={() => {
              addEmptyTrack();
              showNotification('Empty track added', 'success');
            }}
            className="px-4 py-2 rounded bg-gray-900 hover:bg-gray-800 text-white border border-teal-900/50 transition-colors flex items-center gap-2"
            title="Add empty track"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Add Track</span>
          </button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Timeline */}
        <div className="flex-1 flex flex-col">
          {/* Toolbar */}
          <Toolbar activeTool={activeTool} onToolChange={setActiveTool} />

          {/* Timeline ruler with zoom */}
          <TimelineRuler />

          {/* Timeline - Always show, with empty tracks */}
          <Timeline />
        </div>

        {/* Track Inspector Sidebar */}
        <TrackInspector />

        {/* Library Sidebar */}
        {showLibrary && (
          <div className="absolute right-80 top-0 bottom-0 w-80 bg-gradient-to-b from-gray-900/98 to-gray-800/98 backdrop-blur-xl border-l border-teal-500/30 shadow-2xl shadow-teal-500/20 z-20 flex flex-col">
            {/* Library Header */}
            <div className="h-16 border-b border-teal-500/30 flex items-center justify-between px-4 shrink-0">
              <div className="flex items-center gap-2">
                <Library className="w-5 h-5 text-teal-400" />
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
                  <div className="animate-spin w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full" />
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
                      className="w-full p-3 rounded-lg bg-teal-900/20 hover:bg-teal-900/40 border border-teal-500/30 hover:border-teal-500/50 text-left transition-all group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded bg-teal-700/50 flex items-center justify-center shrink-0 group-hover:bg-teal-600/50 transition-colors">
                          <Music className="w-5 h-5 text-teal-200" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white truncate">
                            {track.title || 'Untitled Track'}
                          </p>
                          <p className="text-xs text-teal-400/60">
                            {new Date(track.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <Plus className="w-5 h-5 text-teal-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Library Footer */}
            <div className="border-t border-teal-500/30 p-4 shrink-0">
              <button
                onClick={loadLibraryTracks}
                disabled={isLoadingLibrary}
                className="w-full px-4 py-2 rounded bg-teal-700 hover:bg-teal-600 disabled:bg-gray-700 disabled:text-gray-500 text-white font-medium transition-all"
              >
                {isLoadingLibrary ? 'Loading...' : 'Refresh Library'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Transport bar */}
      <TransportBar />
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
