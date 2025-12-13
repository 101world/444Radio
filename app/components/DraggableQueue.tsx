/**
 * Draggable Track Queue Component
 * Task 10: Drag-drop reordering with @dnd-kit
 */
'use client'

import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Play, X } from 'lucide-react'
import { motion } from 'framer-motion'

interface Track {
  id: string
  title: string
  artist?: string
  imageUrl?: string
  duration?: number
}

interface DraggableQueueProps {
  tracks: Track[]
  currentTrackIndex: number
  onReorder: (newTracks: Track[]) => void
  onTrackClick: (track: Track, index: number) => void
  onRemoveTrack: (trackId: string) => void
}

function SortableTrack({ 
  track, 
  index, 
  isPlaying, 
  onTrackClick, 
  onRemove 
}: { 
  track: Track
  index: number
  isPlaying: boolean
  onTrackClick: () => void
  onRemove: () => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: track.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ delay: index * 0.03 }}
      className={`
        flex items-center gap-3 p-3 rounded-xl border transition-all group
        ${isDragging ? 'opacity-50 scale-95 z-50' : 'opacity-100 scale-100'}
        ${isPlaying 
          ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border-cyan-500/50 shadow-lg shadow-cyan-500/20' 
          : 'bg-white/5 border-white/10 hover:border-cyan-500/30 hover:bg-white/10'
        }
      `}
    >
      {/* Drag Handle */}
      <button
        {...attributes}
        {...listeners}
        className="text-gray-500 hover:text-cyan-400 cursor-grab active:cursor-grabbing transition-colors"
      >
        <GripVertical className="w-5 h-5" />
      </button>

      {/* Track Number */}
      <div className={`
        w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold
        ${isPlaying 
          ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white' 
          : 'bg-white/5 text-gray-400'
        }
      `}>
        {isPlaying ? <Play className="w-4 h-4 fill-white" /> : index + 1}
      </div>

      {/* Album Art */}
      {track.imageUrl && (
        <img
          src={track.imageUrl}
          alt={track.title}
          className="w-12 h-12 rounded-lg object-cover"
        />
      )}

      {/* Track Info */}
      <button
        onClick={onTrackClick}
        className="flex-1 text-left min-w-0"
      >
        <div className={`
          font-semibold text-sm truncate
          ${isPlaying ? 'text-cyan-400' : 'text-white'}
        `}>
          {track.title}
        </div>
        {track.artist && (
          <div className="text-xs text-gray-400 truncate">{track.artist}</div>
        )}
      </button>

      {/* Duration */}
      {track.duration && (
        <div className="text-xs text-gray-400 tabular-nums">
          {Math.floor(track.duration / 60)}:{String(Math.floor(track.duration % 60)).padStart(2, '0')}
        </div>
      )}

      {/* Remove Button */}
      <button
        onClick={onRemove}
        className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 transition-all"
      >
        <X className="w-5 h-5" />
      </button>
    </motion.div>
  )
}

export default function DraggableQueue({
  tracks,
  currentTrackIndex,
  onReorder,
  onTrackClick,
  onRemoveTrack,
}: DraggableQueueProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Prevent accidental drags on click
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = tracks.findIndex((t) => t.id === active.id)
      const newIndex = tracks.findIndex((t) => t.id === over.id)

      onReorder(arrayMove(tracks, oldIndex, newIndex))
    }
  }

  if (tracks.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <div className="text-4xl mb-3">🎵</div>
        <div className="text-sm">No tracks in queue</div>
      </div>
    )
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={tracks.map(t => t.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2">
          {tracks.map((track, index) => (
            <SortableTrack
              key={track.id}
              track={track}
              index={index}
              isPlaying={index === currentTrackIndex}
              onTrackClick={() => onTrackClick(track, index)}
              onRemove={() => onRemoveTrack(track.id)}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}
