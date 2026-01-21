'use client'

import React from 'react'
import { X, Play, Scissors, Copy, Folder } from 'lucide-react'

interface KeyboardHelpModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function KeyboardHelpModal({ isOpen, onClose }: KeyboardHelpModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100]" onClick={onClose}>
      <div className="bg-gradient-to-br from-gray-900 to-gray-950 border border-cyan-500/30 rounded-2xl p-8 max-w-2xl w-full mx-4 shadow-2xl shadow-cyan-500/10" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white flex items-center gap-3">
            <span className="text-3xl">⌨️</span>
            Keyboard Shortcuts
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors text-gray-400 hover:text-white"
          >
            ✕
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Transport Controls */}
          <div>
            <h3 className="text-sm font-bold text-cyan-400 uppercase mb-3 flex items-center gap-2">
              <Play size={14} />
              Transport
            </h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">Play/Pause</span>
                <kbd className="px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs font-mono text-gray-300">Space</kbd>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">Stop</span>
                <kbd className="px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs font-mono text-gray-300">Click Stop</kbd>
              </div>
            </div>
          </div>

          {/* Editing */}
          <div>
            <h3 className="text-sm font-bold text-cyan-400 uppercase mb-3 flex items-center gap-2">
              <Scissors size={14} />
              Editing
            </h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">Split clip at playhead</span>
                <kbd className="px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs font-mono text-gray-300">X</kbd>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">Delete clip</span>
                <kbd className="px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs font-mono text-gray-300">Del / Backspace</kbd>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">Copy clip</span>
                <kbd className="px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs font-mono text-gray-300">Ctrl+C</kbd>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">Paste clip</span>
                <kbd className="px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs font-mono text-gray-300">Ctrl+V</kbd>
              </div>
            </div>
          </div>

          {/* History */}
          <div>
            <h3 className="text-sm font-bold text-cyan-400 uppercase mb-3 flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
              </svg>
              History
            </h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">Undo</span>
                <kbd className="px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs font-mono text-gray-300">Ctrl+Z</kbd>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">Redo</span>
                <kbd className="px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs font-mono text-gray-300">Ctrl+Y</kbd>
              </div>
            </div>
          </div>

          {/* View */}
          <div>
            <h3 className="text-sm font-bold text-cyan-400 uppercase mb-3 flex items-center gap-2">
              <Folder size={14} />
              View
            </h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">Toggle browser</span>
                <kbd className="px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs font-mono text-gray-300">B</kbd>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">Save project</span>
                <kbd className="px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs font-mono text-gray-300">Ctrl+S</kbd>
              </div>
            </div>
          </div>
        </div>

        {/* Mouse Actions */}
        <div className="mt-6 pt-6 border-t border-gray-800">
          <h3 className="text-sm font-bold text-cyan-400 uppercase mb-3">Mouse Actions</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div className="flex items-start gap-2">
              <span className="text-purple-400 font-bold">●</span>
              <div>
                <span className="text-gray-300 font-medium">Purple handles:</span>
                <span className="text-gray-500 block">Drag clip edges to trim</span>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-cyan-400 font-bold">●</span>
              <div>
                <span className="text-gray-300 font-medium">Cyan handles:</span>
                <span className="text-gray-500 block">Adjust fade in/out</span>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-gray-400 font-bold">⊕</span>
              <div>
                <span className="text-gray-300 font-medium">Right-click clip:</span>
                <span className="text-gray-500 block">Context menu</span>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-gray-400 font-bold">↔</span>
              <div>
                <span className="text-gray-300 font-medium">Drag clip:</span>
                <span className="text-gray-500 block">Move in timeline</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 text-center text-xs text-gray-500">
          Press <kbd className="px-1.5 py-0.5 bg-gray-800 border border-gray-700 rounded font-mono text-gray-400">?</kbd> anytime to toggle this help
        </div>
      </div>
    </div>
  )
}
