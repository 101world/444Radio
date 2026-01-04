'use client'

import { useState, useEffect } from 'react'
import { X, Save, FolderOpen, Trash2, Clock } from 'lucide-react'
import { GlassPanel, GlassButton } from './glass'
import { toast } from '@/lib/toast'

export interface ProjectData {
  id: string
  name: string
  bpm: number
  tracks: any[]
  createdAt: number
  updatedAt: number
  version: string
}

interface ProjectManagerProps {
  isOpen: boolean
  onClose: () => void
  currentProject: ProjectData | null
  onSaveProject: (name: string) => Promise<void>
  onLoadProject: (projectId: string) => Promise<void>
  onDeleteProject: (projectId: string) => Promise<void>
  onNewProject: () => void
}

export default function ProjectManager({
  isOpen,
  onClose,
  currentProject,
  onSaveProject,
  onLoadProject,
  onDeleteProject,
  onNewProject
}: ProjectManagerProps) {
  const [projects, setProjects] = useState<ProjectData[]>([])
  const [projectName, setProjectName] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'save' | 'load'>('save')

  useEffect(() => {
    if (isOpen) {
      loadProjects()
    }
  }, [isOpen])

  useEffect(() => {
    if (currentProject) {
      setProjectName(currentProject.name)
    }
  }, [currentProject])

  const loadProjects = async () => {
    try {
      const db = await openDatabase()
      const transaction = db.transaction(['projects'], 'readonly')
      const store = transaction.objectStore('projects')
      const request = store.getAll()

      request.onsuccess = () => {
        const allProjects = request.result as ProjectData[]
        setProjects(allProjects.sort((a, b) => b.updatedAt - a.updatedAt))
      }

      request.onerror = () => {
        toast.error('Failed to load projects')
      }
    } catch (error) {
      console.error('Error loading projects:', error)
      toast.error('Failed to access project database')
    }
  }

  const openDatabase = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('444RadioProjects', 1)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result)

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        if (!db.objectStoreNames.contains('projects')) {
          const store = db.createObjectStore('projects', { keyPath: 'id' })
          store.createIndex('updatedAt', 'updatedAt', { unique: false })
        }
      }
    })
  }

  const handleSave = async () => {
    if (!projectName.trim()) {
      toast.error('Please enter a project name')
      return
    }

    setIsSaving(true)
    try {
      await onSaveProject(projectName)
      await loadProjects()
      toast.success(`Project "${projectName}" saved!`)
    } catch (error) {
      console.error('Save error:', error)
      toast.error('Failed to save project')
    } finally {
      setIsSaving(false)
    }
  }

  const handleLoad = async (projectId: string) => {
    try {
      await onLoadProject(projectId)
      onClose()
      toast.success('Project loaded!')
    } catch (error) {
      console.error('Load error:', error)
      toast.error('Failed to load project')
    }
  }

  const handleDelete = async (projectId: string, projectName: string) => {
    if (!confirm(`Delete project "${projectName}"?`)) return

    try {
      await onDeleteProject(projectId)
      await loadProjects()
      toast.success('Project deleted')
    } catch (error) {
      console.error('Delete error:', error)
      toast.error('Failed to delete project')
    }
  }

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp)
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-6">
      <GlassPanel blur="xl" glow="cyan" className="w-full max-w-4xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div>
            <h2 className="text-2xl font-bold text-white">Project Manager</h2>
            <div className="text-sm text-gray-400">Save and load your projects</div>
          </div>
          <GlassButton variant="ghost" size="sm" onClick={onClose} icon={<X className="w-5 h-5" />}>
            Close
          </GlassButton>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 px-6 pt-4">
          <button
            onClick={() => setActiveTab('save')}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
              activeTab === 'save'
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/50'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Save className="w-4 h-4 inline mr-2" />
            Save Project
          </button>
          <button
            onClick={() => setActiveTab('load')}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
              activeTab === 'load'
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/50'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <FolderOpen className="w-4 h-4 inline mr-2" />
            Load Project ({projects.length})
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'save' ? (
            <div className="max-w-xl mx-auto space-y-4">
              <div>
                <label className="text-sm text-gray-400 mb-2 block">Project Name</label>
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="Enter project name..."
                  className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-lg text-white outline-none focus:border-cyan-500/50 transition-colors"
                  autoFocus
                />
              </div>

              {currentProject && (
                <div className="bg-black/20 rounded-lg p-4 border border-white/10">
                  <div className="text-xs text-gray-400 mb-2">Current Project Info</div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <div className="text-gray-500">Tracks</div>
                      <div className="text-white font-medium">{currentProject.tracks.length}</div>
                    </div>
                    <div>
                      <div className="text-gray-500">BPM</div>
                      <div className="text-white font-medium">{currentProject.bpm}</div>
                    </div>
                    <div>
                      <div className="text-gray-500">Last Saved</div>
                      <div className="text-white font-medium">
                        {formatDate(currentProject.updatedAt)}
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-500">Version</div>
                      <div className="text-white font-medium">{currentProject.version}</div>
                    </div>
                  </div>
                </div>
              )}

              <GlassButton
                variant="primary"
                onClick={handleSave}
                disabled={isSaving || !projectName.trim()}
                className="w-full"
                icon={<Save className="w-4 h-4" />}
              >
                {isSaving ? 'Saving...' : 'Save Project'}
              </GlassButton>
            </div>
          ) : (
            <div className="space-y-3">
              {projects.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <FolderOpen className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <div className="text-lg font-medium">No projects saved yet</div>
                  <div className="text-sm mt-1">Create your first project to get started</div>
                </div>
              ) : (
                projects.map((project) => (
                  <div
                    key={project.id}
                    className="bg-black/20 rounded-lg p-4 border border-white/10 hover:border-cyan-500/30 transition-all group"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="font-medium text-white text-lg mb-1">{project.name}</div>
                        <div className="flex items-center gap-4 text-xs text-gray-400">
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDate(project.updatedAt)}
                          </div>
                          <div>{project.tracks.length} tracks</div>
                          <div>{project.bpm} BPM</div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <GlassButton
                          variant="secondary"
                          size="sm"
                          onClick={() => handleLoad(project.id)}
                        >
                          Load
                        </GlassButton>
                        <GlassButton
                          variant="danger"
                          size="sm"
                          onClick={() => handleDelete(project.id, project.name)}
                          icon={<Trash2 className="w-3 h-3" />}
                        >
                          {''}
                        </GlassButton>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/10 flex items-center justify-between text-xs text-gray-400">
          <div>Auto-save every 30 seconds when editing</div>
          <div>{projects.length} project{projects.length !== 1 ? 's' : ''} stored locally</div>
        </div>
      </GlassPanel>
    </div>
  )
}
