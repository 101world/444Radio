/**
 * Multi-Track Studio Page
 * Main interface for 444Radio multi-track audio editing
 */

'use client';

import { useState } from 'react';
import { Plus, Sparkles, Library, Download } from 'lucide-react';
import { StudioProvider, useStudio } from '@/app/contexts/StudioContext';
import Timeline from '@/app/components/studio/Timeline';
import TransportBar from '@/app/components/studio/TransportBar';
import EffectsRack from '@/app/components/studio/EffectsRack';

function StudioContent() {
  const { addTrack, tracks } = useStudio();
  const [showAISidebar, setShowAISidebar] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);

  // Demo: Add a track from URL
  const handleAddDemoTrack = () => {
    // Use a public domain audio URL for testing
    const demoUrl = 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3';
    addTrack(`Demo Track ${tracks.length + 1}`, demoUrl);
  };

  return (
    <div className="h-screen flex flex-col bg-black">
      {/* Header */}
      <header className="h-16 bg-gradient-to-r from-purple-900/20 to-pink-900/20 backdrop-blur-xl border-b border-purple-500/30 flex items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center">
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
          {/* Add Track (Demo) */}
          <button
            onClick={handleAddDemoTrack}
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-medium transition-all shadow-lg flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Demo Track
          </button>

          {/* AI Generate */}
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

          {/* Export */}
          <button
            className="px-4 py-2 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 border border-cyan-500/50 transition-colors flex items-center gap-2"
            disabled
            title="Coming soon"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* AI Sidebar (placeholder) */}
        {showAISidebar && (
          <div className="w-80 bg-gradient-to-b from-purple-900/20 to-purple-800/20 backdrop-blur-xl border-r border-purple-500/30 p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-purple-400">AI Generation</h2>
              <button
                onClick={() => setShowAISidebar(false)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            <div className="text-gray-400 text-sm">
              <p className="mb-2">Generate music with AI and add to timeline.</p>
              <p className="text-xs text-gray-500">Coming soon: Full MusicGenerationModal integration</p>
            </div>
          </div>
        )}

        {/* Timeline area */}
        <div className="flex-1 flex flex-col">
          {/* Effects rack */}
          <EffectsRack />

          {/* Timeline */}
          <Timeline />

          {/* Library panel */}
          {showLibrary && (
            <div className="h-48 bg-gradient-to-t from-pink-900/20 to-pink-800/20 backdrop-blur-xl border-t border-pink-500/30 p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-bold text-pink-400">Library</h2>
                <button
                  onClick={() => setShowLibrary(false)}
                  className="text-gray-400 hover:text-white"
                >
                  ✕
                </button>
              </div>
              <div className="text-gray-400 text-sm">
                <p className="mb-2">Drag and drop your tracks from library to timeline.</p>
                <p className="text-xs text-gray-500">Coming soon: Supabase library integration</p>
              </div>
            </div>
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
