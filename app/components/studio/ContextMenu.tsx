/**
 * Right-Click Context Menu for Audio Tracks
 * AudioMass-style context menu with all operations
 */

'use client';

import React, { useState, useEffect } from 'react';
import {
  Volume2,
  VolumeX,
  Scissors,
  Copy,
  Clipboard,
  Trash2,
  FastForward,
  Rewind,
  RotateCcw,
  Zap,
  Radio,
  Filter,
  Music,
  Mic,
  Speaker,
  Settings,
  Sparkles,
} from 'lucide-react';

export interface ContextMenuItem {
  label: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  shortcut?: string;
  divider?: boolean;
  submenu?: ContextMenuItem[];
}

interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const [submenuOpen, setSubmenuOpen] = useState<number | null>(null);

  useEffect(() => {
    const handleClick = () => onClose();
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('click', handleClick);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('click', handleClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  return (
    <div
      className="fixed z-[9999] bg-gray-900/95 backdrop-blur-xl border border-purple-500/30 rounded-lg shadow-2xl py-2 min-w-[220px]"
      style={{ top: y, left: x }}
      onClick={(e) => e.stopPropagation()}
    >
      {items.map((item, index) => (
        <React.Fragment key={index}>
          {item.divider ? (
            <div className="h-px bg-gray-700 my-2 mx-2" />
          ) : (
            <div
              className="relative px-4 py-2 hover:bg-purple-500/20 cursor-pointer transition-colors flex items-center justify-between gap-3 group"
              onClick={(e) => {
                if (item.submenu) {
                  e.stopPropagation();
                  setSubmenuOpen(submenuOpen === index ? null : index);
                } else if (item.onClick) {
                  item.onClick();
                  onClose();
                }
              }}
              onMouseEnter={() => {
                if (item.submenu) {
                  setSubmenuOpen(index);
                }
              }}
            >
              <div className="flex items-center gap-3 flex-1">
                {item.icon && (
                  <span className="text-purple-400 group-hover:text-purple-300">
                    {item.icon}
                  </span>
                )}
                <span className="text-white text-sm font-medium">
                  {item.label}
                </span>
              </div>
              {item.shortcut && (
                <span className="text-gray-500 text-xs">{item.shortcut}</span>
              )}
              {item.submenu && (
                <span className="text-gray-500">›</span>
              )}

              {/* Submenu */}
              {item.submenu && submenuOpen === index && (
                <div
                  className="absolute left-full top-0 ml-1 bg-gray-900/95 backdrop-blur-xl border border-purple-500/30 rounded-lg shadow-2xl py-2 min-w-[200px]"
                  onClick={(e) => e.stopPropagation()}
                >
                  {item.submenu.map((subitem, subindex) => (
                    <div
                      key={subindex}
                      className="px-4 py-2 hover:bg-purple-500/20 cursor-pointer transition-colors flex items-center gap-3"
                      onClick={() => {
                        if (subitem.onClick) {
                          subitem.onClick();
                          onClose();
                        }
                      }}
                    >
                      {subitem.icon && (
                        <span className="text-purple-400">{subitem.icon}</span>
                      )}
                      <span className="text-white text-sm">{subitem.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

/**
 * Get standard track context menu items
 */
export function getTrackContextMenuItems(callbacks: {
  onCut?: () => void;
  onCopy?: () => void;
  onPaste?: () => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
  onReverse?: () => void;
  onNormalize?: () => void;
  onFadeIn?: () => void;
  onFadeOut?: () => void;
  onGain?: () => void;
  onDelay?: () => void;
  onReverb?: () => void;
  onCompressor?: () => void;
  onDistortion?: () => void;
  onBitcrusher?: () => void;
  onTelephonizer?: () => void;
  onLowPass?: () => void;
  onHighPass?: () => void;
  onSpeedChange?: () => void;
  onVocalRemover?: () => void;
  onStereoWiden?: () => void;
  onExportTrack?: () => void;
}): ContextMenuItem[] {
  return [
    {
      label: 'Cut',
      icon: <Scissors className="w-4 h-4" />,
      onClick: callbacks.onCut || (() => {}),
      shortcut: 'Ctrl+X',
    },
    {
      label: 'Copy',
      icon: <Copy className="w-4 h-4" />,
      onClick: callbacks.onCopy || (() => {}),
      shortcut: 'Ctrl+C',
    },
    {
      label: 'Paste',
      icon: <Clipboard className="w-4 h-4" />,
      onClick: callbacks.onPaste || (() => {}),
      shortcut: 'Ctrl+V',
    },
    {
      label: 'Delete',
      icon: <Trash2 className="w-4 h-4" />,
      onClick: callbacks.onDelete || (() => {}),
      shortcut: 'Del',
    },
    { divider: true } as ContextMenuItem,
    {
      label: 'Duplicate Track',
      icon: <Copy className="w-4 h-4" />,
      onClick: callbacks.onDuplicate || (() => {}),
    },
    {
      label: 'Reverse',
      icon: <RotateCcw className="w-4 h-4" />,
      onClick: callbacks.onReverse || (() => {}),
    },
    { divider: true } as ContextMenuItem,
    {
      label: 'Volume',
      icon: <Volume2 className="w-4 h-4" />,
      submenu: [
        {
          label: 'Normalize',
          onClick: callbacks.onNormalize || (() => {}),
        },
        {
          label: 'Adjust Gain...',
          onClick: callbacks.onGain || (() => {}),
        },
        {
          label: 'Fade In',
          onClick: callbacks.onFadeIn || (() => {}),
        },
        {
          label: 'Fade Out',
          onClick: callbacks.onFadeOut || (() => {}),
        },
      ],
    },
    {
      label: 'Effects',
      icon: <Sparkles className="w-4 h-4" />,
      submenu: [
        {
          label: 'Delay',
          icon: <Rewind className="w-4 h-4" />,
          onClick: callbacks.onDelay || (() => {}),
        },
        {
          label: 'Reverb',
          icon: <Radio className="w-4 h-4" />,
          onClick: callbacks.onReverb || (() => {}),
        },
        {
          label: 'Compressor',
          icon: <Settings className="w-4 h-4" />,
          onClick: callbacks.onCompressor || (() => {}),
        },
        {
          label: 'Distortion',
          icon: <Zap className="w-4 h-4" />,
          onClick: callbacks.onDistortion || (() => {}),
        },
        {
          label: 'Bitcrusher',
          icon: <Music className="w-4 h-4" />,
          onClick: callbacks.onBitcrusher || (() => {}),
        },
        {
          label: 'Telephonizer',
          icon: <Speaker className="w-4 h-4" />,
          onClick: callbacks.onTelephonizer || (() => {}),
        },
      ],
    },
    {
      label: 'Filters',
      icon: <Filter className="w-4 h-4" />,
      submenu: [
        {
          label: 'Low Pass',
          onClick: callbacks.onLowPass || (() => {}),
        },
        {
          label: 'High Pass',
          onClick: callbacks.onHighPass || (() => {}),
        },
      ],
    },
    {
      label: 'Advanced',
      icon: <Settings className="w-4 h-4" />,
      submenu: [
        {
          label: 'Speed Change',
          icon: <FastForward className="w-4 h-4" />,
          onClick: callbacks.onSpeedChange || (() => {}),
        },
        {
          label: 'Vocal Remover',
          icon: <Mic className="w-4 h-4" />,
          onClick: callbacks.onVocalRemover || (() => {}),
        },
        {
          label: 'Stereo Widen',
          icon: <Speaker className="w-4 h-4" />,
          onClick: callbacks.onStereoWiden || (() => {}),
        },
      ],
    },
    { divider: true } as ContextMenuItem,
    {
      label: 'Export Track',
      icon: <Music className="w-4 h-4" />,
      onClick: callbacks.onExportTrack || (() => {}),
    },
  ];
}
