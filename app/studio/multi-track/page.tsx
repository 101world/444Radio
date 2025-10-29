/**
 * Multi-Track Studio Page
 * Logic Pro-inspired multi-track audio editing interface
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import { Upload, Sparkles, Library, Music, Plus } from 'lucide-react';
import { StudioProvider, useStudio } from '@/app/contexts/StudioContext';
import Timeline from '@/app/components/studio/Timeline';
import TransportBar from '@/app/components/studio/TransportBar';
import EffectsRack from '@/app/components/studio/EffectsRack';
import TimelineRuler from '@/app/components/studio/TimelineRuler';
import TrackInspector from '@/app/components/studio/TrackInspector';
import Toolbar from '@/app/components/studio/Toolbar';
import type { ToolType } from '@/app/components/studio/Toolbar';

function StudioContent() {
  const { addTrack, addEmptyTrack, tracks } = useStudio();
  const [showAISidebar, setShowAISidebar] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [activeTool, setActiveTool] = useState<ToolType>('select');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Add 3 empty tracks on mount (AudioMass style)
  useEffect(() => {
    if (tracks.length === 0) {
      addEmptyTrack();
      addEmptyTrack();
      addEmptyTrack();
    }
  }, []); // Run once on mount

  // Handle file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      // Validate audio file
      if (!file.type.startsWith('audio/')) {
        alert(`${file.name} is not an audio file`);
        continue;
      }

      // Create object URL for the file
      const audioUrl = URL.createObjectURL(file);
      const trackName = file.name.replace(/\.[^/.]+$/, ''); // Remove extension
      
      addTrack(trackName, audioUrl);
      console.log(`✅ Added track: ${trackName}`);
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Open file dialog
  const handleBrowseFiles = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="h-screen flex flex-col bg-black">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        multiple
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* Header */}
      <header className="h-16 bg-black border-b border-teal-900/50 flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-teal-700 flex items-center justify-center shadow-lg shadow-teal-500/30">
            <span className="text-white font-bold text-lg">4</span>
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">
              444Radio Studio
            </h1>
            <p className="text-xs text-teal-400">Multi-Track Audio Editor</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Import Audio Button */}
          <button
            onClick={handleBrowseFiles}
            className="px-4 py-2 rounded bg-teal-700 hover:bg-teal-600 text-white font-medium transition-all shadow-lg shadow-teal-500/20 flex items-center gap-2"
          >
            <Upload className="w-4 h-4" />
            Import Audio
          </button>

          {/* AI Generation */}
          <button
            onClick={() => setShowAISidebar(!showAISidebar)}
            className="px-4 py-2 rounded bg-teal-900/30 hover:bg-teal-900/50 text-teal-400 border border-teal-800 transition-colors flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4" />
            AI Generate
          </button>

          {/* Library */}
          <button
            onClick={() => setShowLibrary(!showLibrary)}
            className="px-4 py-2 rounded bg-teal-900/30 hover:bg-teal-900/50 text-teal-400 border border-teal-800 transition-colors flex items-center gap-2"
          >
            <Library className="w-4 h-4" />
            Library
          </button>

          {/* Add Empty Track */}
          <button
            onClick={addEmptyTrack}
            className="px-4 py-2 rounded bg-gray-900 hover:bg-gray-800 text-white border border-teal-900/50 transition-colors flex items-center gap-2"
            title="Add empty track"
          >
            <Plus className="w-4 h-4" />
            Add Track
          </button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
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
