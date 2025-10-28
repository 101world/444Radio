/**
 * Multi-Track Studio Page
 * Logic Pro-inspired multi-track audio editing interface
 */

'use client';

import { useState, useRef } from 'react';
import { Upload, Sparkles, Library, Music } from 'lucide-react';
import { StudioProvider, useStudio } from '@/app/contexts/StudioContext';
import Timeline from '@/app/components/studio/Timeline';
import TransportBar from '@/app/components/studio/TransportBar';
import EffectsRack from '@/app/components/studio/EffectsRack';

function StudioContent() {
  const { addTrack, tracks } = useStudio();
  const [showAISidebar, setShowAISidebar] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      <header className="h-16 bg-gradient-to-r from-purple-900/20 to-pink-900/20 backdrop-blur-xl border-b border-purple-500/30 flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center shadow-lg">
            <span className="text-white font-bold text-lg">4</span>
          </div>
          <div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              444Radio Studio
            </h1>
            <p className="text-xs text-gray-400">Multi-Track Audio Editor</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Import Audio Button */}
          <button
            onClick={handleBrowseFiles}
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-medium transition-all shadow-lg flex items-center gap-2"
          >
            <Upload className="w-4 h-4" />
            Import Audio
          </button>

          {/* AI Generation */}
          <button
            onClick={() => setShowAISidebar(!showAISidebar)}
            className="px-4 py-2 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 border border-purple-500/50 transition-colors flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4" />
            AI Generate
          </button>

          {/* Library */}
          <button
            onClick={() => setShowLibrary(!showLibrary)}
            className="px-4 py-2 rounded-lg bg-pink-500/20 hover:bg-pink-500/30 text-pink-400 border border-pink-500/50 transition-colors flex items-center gap-2"
          >
            <Library className="w-4 h-4" />
            Library
          </button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Timeline */}
        <div className="flex-1 flex flex-col">
          {/* Effects rack */}
          <EffectsRack />

          {/* Timeline */}
          <Timeline />

          {/* Timeline / Empty state */}
          {tracks.length === 0 ? (
            <div className="flex-1 flex items-center justify-center bg-black/20 backdrop-blur-xl">
              <div className="text-center max-w-md px-6">
                <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-r from-purple-500/20 to-pink-500/20 flex items-center justify-center">
                  <Music className="w-12 h-12 text-purple-400" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-3">
                  Welcome to 444Radio Studio
                </h2>
                <p className="text-gray-400 mb-6">
                  Import audio files to start creating your multi-track masterpiece
                </p>
                <div className="flex flex-col gap-3">
                  <button
                    onClick={handleBrowseFiles}
                    className="px-6 py-3 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-medium transition-all shadow-lg flex items-center justify-center gap-2"
                  >
                    <Upload className="w-5 h-5" />
                    Import Audio Files
                  </button>
                  <button
                    onClick={() => setShowAISidebar(true)}
                    className="px-6 py-3 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 border border-purple-500/50 font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    <Sparkles className="w-5 h-5" />
                    Generate with AI
                  </button>
                  <button
                    onClick={() => setShowLibrary(true)}
                    className="px-6 py-3 rounded-lg bg-pink-500/20 hover:bg-pink-500/30 text-pink-400 border border-pink-500/50 font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    <Library className="w-5 h-5" />
                    Browse Library
                  </button>
                </div>
                <div className="mt-8 pt-8 border-t border-gray-800">
                  <p className="text-xs text-gray-500">
                    <strong>Tip:</strong> Drag & drop audio files anywhere on this page
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <Timeline />
          )}
        </div>
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
