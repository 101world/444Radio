/**
 * Project Management System
 * Features: save/load, auto-save, version history, templates
 */

import { supabase } from '@/lib/supabase';

export interface Project {
  id: string;
  userId: string;
  name: string;
  bpm: number;
  timeSignature: { numerator: number; denominator: number };
  tracks: any[]; // Full track data
  markers: any[];
  createdAt: string;
  updatedAt: string;
  version: number;
  template?: string;
}

export interface ProjectVersion {
  id: string;
  projectId: string;
  version: number;
  data: any;
  createdAt: string;
  description?: string;
}

export interface ExportPreset {
  name: string;
  format: 'wav' | 'mp3' | 'flac' | 'ogg';
  sampleRate: number;
  bitDepth?: 16 | 24 | 32;
  bitrate?: number; // For lossy formats
  normalize?: boolean;
  dither?: boolean;
}

export class ProjectManager {
  private autoSaveInterval: number | null = null;
  private lastSaveTime = Date.now();
  private isDirty = false;

  /**
   * Save project to database
   */
  async saveProject(project: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const { data, error } = await supabase
        .from('projects')
        .insert({
          user_id: project.userId,
          name: project.name,
          bpm: project.bpm,
          time_signature: project.timeSignature,
          tracks: project.tracks,
          markers: project.markers,
          version: project.version || 1,
          template: project.template
        })
        .select()
        .single();

      if (error) throw error;

      this.isDirty = false;
      this.lastSaveTime = Date.now();
      
      return data.id;
    } catch (error) {
      console.error('Failed to save project:', error);
      throw error;
    }
  }

  /**
   * Update existing project
   */
  async updateProject(projectId: string, updates: Partial<Project>): Promise<void> {
    try {
      // Save version history before updating
      await this.saveVersion(projectId);

      const { error } = await supabase
        .from('projects')
        .update({
          name: updates.name,
          bpm: updates.bpm,
          time_signature: updates.timeSignature,
          tracks: updates.tracks,
          markers: updates.markers,
          version: (updates.version || 1) + 1,
          updated_at: new Date().toISOString()
        })
        .eq('id', projectId);

      if (error) throw error;

      this.isDirty = false;
      this.lastSaveTime = Date.now();
    } catch (error) {
      console.error('Failed to update project:', error);
      throw error;
    }
  }

  /**
   * Load project from database
   */
  async loadProject(projectId: string): Promise<Project> {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();

      if (error) throw error;

      return {
        id: data.id,
        userId: data.user_id,
        name: data.name,
        bpm: data.bpm,
        timeSignature: data.time_signature,
        tracks: data.tracks,
        markers: data.markers,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
        version: data.version,
        template: data.template
      };
    } catch (error) {
      console.error('Failed to load project:', error);
      throw error;
    }
  }

  /**
   * List user projects
   */
  async listProjects(userId: string): Promise<Project[]> {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      return data.map(d => ({
        id: d.id,
        userId: d.user_id,
        name: d.name,
        bpm: d.bpm,
        timeSignature: d.time_signature,
        tracks: d.tracks,
        markers: d.markers,
        createdAt: d.created_at,
        updatedAt: d.updated_at,
        version: d.version,
        template: d.template
      }));
    } catch (error) {
      console.error('Failed to list projects:', error);
      return [];
    }
  }

  /**
   * Delete project
   */
  async deleteProject(projectId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectId);

      if (error) throw error;
    } catch (error) {
      console.error('Failed to delete project:', error);
      throw error;
    }
  }

  /**
   * Save project version for history
   */
  private async saveVersion(projectId: string, description?: string): Promise<void> {
    try {
      const project = await this.loadProject(projectId);

      const { error } = await supabase
        .from('project_versions')
        .insert({
          project_id: projectId,
          version: project.version,
          data: {
            tracks: project.tracks,
            markers: project.markers,
            bpm: project.bpm,
            timeSignature: project.timeSignature
          },
          description
        });

      if (error) throw error;
    } catch (error) {
      console.error('Failed to save version:', error);
    }
  }

  /**
   * Get version history
   */
  async getVersionHistory(projectId: string): Promise<ProjectVersion[]> {
    try {
      const { data, error } = await supabase
        .from('project_versions')
        .select('*')
        .eq('project_id', projectId)
        .order('version', { ascending: false });

      if (error) throw error;

      return data.map(d => ({
        id: d.id,
        projectId: d.project_id,
        version: d.version,
        data: d.data,
        createdAt: d.created_at,
        description: d.description
      }));
    } catch (error) {
      console.error('Failed to get version history:', error);
      return [];
    }
  }

  /**
   * Restore from version
   */
  async restoreVersion(projectId: string, versionId: string): Promise<void> {
    try {
      const { data: version, error: versionError } = await supabase
        .from('project_versions')
        .select('*')
        .eq('id', versionId)
        .single();

      if (versionError) throw versionError;

      await this.updateProject(projectId, {
        tracks: version.data.tracks,
        markers: version.data.markers,
        bpm: version.data.bpm,
        timeSignature: version.data.timeSignature
      });
    } catch (error) {
      console.error('Failed to restore version:', error);
      throw error;
    }
  }

  /**
   * Enable auto-save (every 2 minutes)
   */
  enableAutoSave(projectId: string, getProjectData: () => Partial<Project>): void {
    this.disableAutoSave();

    this.autoSaveInterval = window.setInterval(async () => {
      if (this.isDirty) {
        try {
          const data = getProjectData();
          await this.updateProject(projectId, data);
          console.log('✅ Auto-saved project');
        } catch (error) {
          console.error('Auto-save failed:', error);
        }
      }
    }, 120000); // 2 minutes
  }

  /**
   * Disable auto-save
   */
  disableAutoSave(): void {
    if (this.autoSaveInterval !== null) {
      clearInterval(this.autoSaveInterval);
      this.autoSaveInterval = null;
    }
  }

  /**
   * Mark project as modified
   */
  markDirty(): void {
    this.isDirty = true;
  }

  /**
   * Export stems (individual tracks)
   */
  async exportStems(
    tracks: any[],
    renderTrack: (track: any) => Promise<AudioBuffer>,
    audioBufferToWav: (buffer: AudioBuffer) => Blob
  ): Promise<{ [trackName: string]: Blob }> {
    const stems: { [trackName: string]: Blob } = {};

    for (const track of tracks) {
      const buffer = await renderTrack(track);
      const blob = audioBufferToWav(buffer);
      stems[track.name] = blob;
    }

    return stems;
  }

  /**
   * Create project template
   */
  async saveAsTemplate(projectId: string, templateName: string): Promise<void> {
    try {
      const project = await this.loadProject(projectId);

      const { error } = await supabase
        .from('project_templates')
        .insert({
          user_id: project.userId,
          name: templateName,
          bpm: project.bpm,
          time_signature: project.timeSignature,
          tracks: project.tracks.map(t => ({
            name: t.name,
            volume: t.volume,
            pan: t.pan,
            effects: t.effects
          })),
          markers: project.markers
        });

      if (error) throw error;
    } catch (error) {
      console.error('Failed to save template:', error);
      throw error;
    }
  }

  /**
   * Load from template
   */
  async loadTemplate(templateId: string): Promise<Partial<Project>> {
    try {
      const { data, error } = await supabase
        .from('project_templates')
        .select('*')
        .eq('id', templateId)
        .single();

      if (error) throw error;

      return {
        bpm: data.bpm,
        timeSignature: data.time_signature,
        tracks: data.tracks,
        markers: data.markers,
        template: templateId
      };
    } catch (error) {
      console.error('Failed to load template:', error);
      throw error;
    }
  }

  /**
   * Export presets
   */
  static readonly EXPORT_PRESETS: { [key: string]: ExportPreset } = {
    'wav-24bit': {
      name: 'WAV 24-bit/44.1kHz',
      format: 'wav',
      sampleRate: 44100,
      bitDepth: 24,
      normalize: false,
      dither: true
    },
    'mp3-320': {
      name: 'MP3 320kbps',
      format: 'mp3',
      sampleRate: 44100,
      bitrate: 320,
      normalize: true
    },
    'flac': {
      name: 'FLAC Lossless',
      format: 'flac',
      sampleRate: 44100,
      bitDepth: 24
    },
    'podcast': {
      name: 'Podcast (MP3 128kbps)',
      format: 'mp3',
      sampleRate: 44100,
      bitrate: 128,
      normalize: true
    }
  };
}
