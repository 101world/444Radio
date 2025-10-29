/**
 * Toolbar - AudioMass-style tool selection
 * Selection tool, cut tool, zoom tool, etc.
 */

'use client';

import { MousePointer2, Scissors, ZoomIn, Move, Hand } from 'lucide-react';
import { useState } from 'react';

export type ToolType = 'select' | 'cut' | 'zoom' | 'move' | 'pan';

interface ToolbarProps {
  activeTool: ToolType;
  onToolChange: (tool: ToolType) => void;
}

export default function Toolbar({ activeTool, onToolChange }: ToolbarProps) {
  const tools: { type: ToolType; icon: React.ReactNode; label: string; shortcut: string }[] = [
    { type: 'select', icon: <MousePointer2 className="w-4 h-4" />, label: 'Selection Tool', shortcut: 'V' },
    { type: 'cut', icon: <Scissors className="w-4 h-4" />, label: 'Cut Tool', shortcut: 'C' },
    { type: 'zoom', icon: <ZoomIn className="w-4 h-4" />, label: 'Zoom Tool', shortcut: 'Z' },
    { type: 'move', icon: <Move className="w-4 h-4" />, label: 'Move Tool', shortcut: 'M' },
    { type: 'pan', icon: <Hand className="w-4 h-4" />, label: 'Pan Tool', shortcut: 'H' },
  ];

  return (
    <div className="h-12 bg-black border-b border-teal-900/50 flex items-center px-4 gap-2">
      <span className="text-xs text-teal-500 font-medium mr-2">Tools:</span>
      {tools.map((tool) => (
        <button
          key={tool.type}
          onClick={() => onToolChange(tool.type)}
          className={`p-2 rounded transition-all ${
            activeTool === tool.type
              ? 'bg-teal-700 text-white shadow-lg shadow-teal-500/30'
              : 'bg-gray-900 text-gray-400 hover:bg-gray-800 hover:text-white border border-teal-900/30'
          }`}
          title={`${tool.label} (${tool.shortcut})`}
        >
          {tool.icon}
        </button>
      ))}
      
      {/* Tool info */}
      <div className="ml-auto text-xs text-teal-500 font-mono">
        {tools.find((t) => t.type === activeTool)?.label}
      </div>
    </div>
  );
}
