'use client';

import { useEffect, useRef, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import createAudioScheduler from '@/lib/audio/AudioScheduler';
import { usePusher } from '@/lib/pusher-client';
import { renderWaveform } from '@/lib/audio/WaveformRenderer';

let scheduler: ReturnType<typeof createAudioScheduler> | null = null;

function getScheduler() {
  if (typeof window !== 'undefined' && !scheduler) {
    scheduler = createAudioScheduler();
  }
  return scheduler;
}

function formatTime(sec = 0) {
  const s = Math.floor(sec % 60).toString().padStart(2, '0');
  const m = Math.floor(sec / 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

interface Clip {
  id: string;
  url: string;
  start: number;
  duration: number;
  waveformRendered?: boolean;
}

interface Track {
  id: string;
  name: string;
  clips: Clip[];
}

interface Marker {
  id: string;
  name: string;
  position: number; // in seconds
}

export default function MultiTrackStudio() {
  const { user } = useUser();
  const pusherChannel = usePusher(user?.id);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playhead, setPlayhead] = useState(0);
  const [zoom, setZoom] = useState(50);
  const [generatingJobs, setGeneratingJobs] = useState<string[]>([]);
  const [markers, setMarkers] = useState<Marker[]>([
    { id: 'm1', name: 'Verse', position: 0 },
    { id: 'm2', name: 'Pre', position: 16 },
    { id: 'm3', name: 'Chorus', position: 24 },
    { id: 'm4', name: 'Break', position: 48 },
    { id: 'm5', name: 'Verse', position: 64 }
  ]);
  const [mutedTracks, setMutedTracks] = useState<Set<string>>(new Set());
  const [soloedTracks, setSoloedTracks] = useState<Set<string>>(new Set());
  const rafRef = useRef<number | undefined>(undefined);
  const lastUpdateRef = useRef<number>(0);

  useEffect(() => {
    if (tracks.length === 0) {
      setTracks([{ id: 't-1', name: 'Track 1', clips: [] }]);
    }
  }, []);

  // Animation loop for playhead updates
  useEffect(() => {
    const sched = getScheduler();
    if (!sched) return;
    
    function loop(ts: number) {
      if (ts - lastUpdateRef.current > 33 && sched) {
        const ph = sched.getPlayhead();
        setPlayhead(ph);
        lastUpdateRef.current = ts;
      }
      rafRef.current = requestAnimationFrame(loop);
    }
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current !== undefined) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  // Listen for Replicate webhook completion events
  useEffect(() => {
    if (!pusherChannel) return;

    const handleJobCompleted = async (data: any) => {
      console.log('🎉 Job completed via webhook:', data);
      
      // Remove from generating list
      setGeneratingJobs(prev => prev.filter(id => id !== data.jobId));
      
      const sched = getScheduler();
      const output = data.output || {};
      const outputKeys = Object.keys(output);
      
      // Check if this is a stem split (multiple audio files)
      if (data.type === 'stem-split' && outputKeys.length > 1) {
        // Create a separate track for each stem
        const stemNames: Record<string, string> = {
          vocals: '🎤 Vocals',
          drums: '🥁 Drums',
          bass: '🎸 Bass',
          other: '🎹 Other',
          stem1: 'Stem 1',
          stem2: 'Stem 2',
          stem3: 'Stem 3',
          stem4: 'Stem 4'
        };
        
        const newTracks: Track[] = [];
        let delay = 0;
        
        for (const [key, url] of Object.entries(output)) {
          if (typeof url === 'string' && url) {
            setTimeout(() => {
              const newTrack: Track = {
                id: 't-' + Date.now() + '-' + key,
                name: stemNames[key] || key,
                clips: [{
                  id: 'c-' + Date.now() + '-' + key,
                  url,
                  start: Math.floor(playhead),
                  duration: 0
                }]
              };
              
              setTracks(prev => [...prev, newTrack]);
              
              // Pre-load the audio buffer
              if (sched) {
                sched.loadBuffer(url).catch(err => console.warn('Failed to load stem:', err));
              }
            }, delay);
            delay += 100; // Stagger track creation
          }
        }
        
        console.log(`✅ Created ${outputKeys.length} stem tracks`);
      } else {
        // Single audio file (music, instrumental, effects, auto-tune)
        const audioUrl = output.audio || output.stem1 || Object.values(output)[0];
        
        if (typeof audioUrl === 'string' && audioUrl) {
          const typeNames: Record<string, string> = {
            'create-song': '🎵 Music',
            'create-beat': '🎹 Instrumental',
            'effects': '🎚️ Effects',
            'auto-tune': '🎤 Auto-tuned'
          };
          
          const newTrack: Track = {
            id: 't-' + Date.now(),
            name: `${typeNames[data.type] || data.type} (${new Date().toLocaleTimeString()})`,
            clips: [{
              id: 'c-' + Date.now(),
              url: audioUrl,
              start: Math.floor(playhead),
              duration: 0
            }]
          };
          
          setTracks(prev => [...prev, newTrack]);
          
          // Pre-load the audio buffer
          if (sched) {
            try {
              await sched.loadBuffer(audioUrl);
              console.log('✅ Auto-loaded generated audio');
            } catch (err) {
              console.warn('Failed to load:', err);
            }
          }
        }
      }
    };

    pusherChannel.bind('job:completed', handleJobCompleted);
    
    return () => {
      pusherChannel?.unbind('job:completed', handleJobCompleted);
    };
  }, [pusherChannel, playhead]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.code === 'KeyS') {
        stop();
      } else if (e.code === 'KeyT') {
        addTrack();
      } else if (e.code === 'KeyM') {
        addMarker();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tracks, isPlaying, playhead]);

  function addTrack() {
    const t = { id: 't-' + Date.now(), name: `Track ${tracks.length + 1}`, clips: [] };
    setTracks(prev => [...prev, t]);
  }

  async function addClipToTrack(trackId: string) {
    const sched = getScheduler();
    if (!sched) return;
    
    const url = prompt('Paste audio URL (http(s)://...) to attach as clip');
    if (!url) return;
    const startStr = prompt('Start position in project (seconds)', String(Math.floor(playhead)));
    const start = parseFloat(startStr || '0') || 0;
    const newClip = { id: 'c-' + Date.now(), url, start, duration: 0 };
    setTracks(prev => prev.map(t => t.id === trackId ? { ...t, clips: [...t.clips, newClip] } : t));
    try {
      await sched.loadBuffer(url);
      console.log('buffer loaded');
    } catch (err) {
      console.warn('buffer load error', err);
      alert('Failed to load audio (CORS or invalid URL). Check console.');
    }
  }

  async function togglePlay() {
    const sched = getScheduler();
    if (!sched) return;
    
    if (!isPlaying) {
      sched.setPlayheadPositionManual(playhead);
      const flatClips = tracks.flatMap(t => t.clips);
      await sched.play(flatClips);
      setIsPlaying(true);
    } else {
      sched.pause();
      setIsPlaying(false);
    }
  }

  function stop() {
    const sched = getScheduler();
    if (!sched) return;
    
    sched.stop();
    setIsPlaying(false);
    setPlayhead(0);
    sched.setPlayheadPositionManual(0);
  }

  function seekTo(seconds: number) {
    const sched = getScheduler();
    if (!sched) return;
    
    sched.seek(seconds, tracks.flatMap(t => t.clips));
    setPlayhead(seconds);
  }

  function toggleMute(trackId: string) {
    setMutedTracks(prev => {
      const next = new Set(prev);
      if (next.has(trackId)) {
        next.delete(trackId);
      } else {
        next.add(trackId);
      }
      return next;
    });
  }

  function toggleSolo(trackId: string) {
    setSoloedTracks(prev => {
      const next = new Set(prev);
      if (next.has(trackId)) {
        next.delete(trackId);
      } else {
        next.add(trackId);
      }
      return next;
    });
  }

  function addMarker() {
    const name = prompt('Marker name (e.g., Verse, Chorus):');
    if (!name) return;
    setMarkers(prev => [...prev, {
      id: 'm-' + Date.now(),
      name,
      position: Math.floor(playhead)
    }]);
  }

  function getTrackColor(index: number): string {
    const colors = [
      '#ff6b6b', // Red/Orange for drums
      '#f39c12', // Orange for loops
      '#f1c40f', // Yellow for percussion
      '#7cb342', // Olive for bass
      '#26a69a', // Teal for keys
      '#42a5f5', // Blue for synths
      '#ab47bc', // Purple for FX
      '#66bb6a', // Green for vocals
    ];
    return colors[index % colors.length];
  }

  // Render waveforms for new clips
  useEffect(() => {
    tracks.forEach(track => {
      track.clips.forEach(clip => {
        if (!clip.waveformRendered) {
          const canvasId = `waveform-${clip.id}`;
          const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
          if (canvas && clip.url) {
            renderWaveform(clip.url, canvas, {
              waveColor: 'rgba(0, 255, 150, 0.6)',
              backgroundColor: 'transparent',
              samples: 500
            }).then(() => {
              // Mark as rendered to avoid re-rendering
              clip.waveformRendered = true;
            }).catch(err => {
              console.warn('Waveform render failed for', clip.url, err);
            });
          }
        }
      });
    });
  }, [tracks]);

  function pxForSeconds(sec: number) {
    return sec * zoom;
  }

  return (
    <div style={{ fontFamily: 'Inter, Arial, sans-serif', height: '100vh', display: 'flex', flexDirection: 'column', background: '#0a0a0a', color: '#e0e0e0' }}>
      {/* Top Toolbar */}
      <header style={{ 
        height: 48, 
        background: '#1a1a1a', 
        borderBottom: '1px solid #2a2a2a',
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        gap: 16
      }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={togglePlay} style={{ 
            padding: '6px 16px', 
            background: isPlaying ? '#ff6b6b' : '#00bcd4', 
            border: 0, 
            color: '#000', 
            borderRadius: 4,
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: 13
          }}>{isPlaying ? '⏸ Pause' : '▶ Play'}</button>
          <button onClick={stop} style={{ 
            padding: '6px 16px', 
            background: '#333', 
            border: 0, 
            color: '#fff', 
            borderRadius: 4,
            cursor: 'pointer',
            fontSize: 13
          }}>⏹ Stop</button>
        </div>
        <div style={{ color: '#00bcd4', fontWeight: 600, fontSize: 14 }}>{formatTime(playhead)}</div>
        <div style={{ flex: 1 }} />
        <div style={{ fontSize: 12, color: '#666' }}>Space = Play • S = Stop • T = Track • M = Marker</div>
      </header>

      <main style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Track List Sidebar (like Logic/FL Studio) */}
        <aside style={{ 
          width: 280, 
          borderRight: '1px solid #2a2a2a', 
          background: '#1a1a1a',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{ 
            padding: '8px 12px', 
            borderBottom: '1px solid #2a2a2a',
            background: '#151515',
            fontSize: 11,
            fontWeight: 600,
            color: '#888',
            display: 'flex',
            justifyContent: 'space-between'
          }}>
            <span>TRACK</span>
            <span>M S R</span>
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {tracks.map((t, idx) => {
              const isMuted = mutedTracks.has(t.id);
              const isSoloed = soloedTracks.has(t.id);
              const trackColor = getTrackColor(idx);
              
              return (
                <div key={t.id} style={{ 
                  padding: '8px 12px',
                  borderBottom: '1px solid #252525',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  background: isSoloed ? 'rgba(0, 188, 212, 0.1)' : 'transparent'
                }}>
                  {/* Track Color Indicator */}
                  <div style={{ 
                    width: 4, 
                    height: 28, 
                    background: trackColor,
                    borderRadius: 2
                  }} />
                  
                  {/* Track Name */}
                  <div style={{ flex: 1, fontSize: 13, color: isMuted ? '#555' : '#ddd' }}>
                    {t.name}
                  </div>
                  
                  {/* M/S/R Buttons */}
                  <button 
                    onClick={() => toggleMute(t.id)}
                    style={{ 
                      width: 24, 
                      height: 24, 
                      background: isMuted ? '#ff6b6b' : '#333',
                      border: 0,
                      borderRadius: 3,
                      cursor: 'pointer',
                      color: isMuted ? '#000' : '#888',
                      fontSize: 11,
                      fontWeight: 600
                    }}
                    title="Mute"
                  >M</button>
                  
                  <button 
                    onClick={() => toggleSolo(t.id)}
                    style={{ 
                      width: 24, 
                      height: 24, 
                      background: isSoloed ? '#00bcd4' : '#333',
                      border: 0,
                      borderRadius: 3,
                      cursor: 'pointer',
                      color: isSoloed ? '#000' : '#888',
                      fontSize: 11,
                      fontWeight: 600
                    }}
                    title="Solo"
                  >S</button>
                  
                  <button 
                    onClick={() => addClipToTrack(t.id)}
                    style={{ 
                      width: 24, 
                      height: 24, 
                      background: '#333',
                      border: 0,
                      borderRadius: 3,
                      cursor: 'pointer',
                      color: '#888',
                      fontSize: 11,
                      fontWeight: 600
                    }}
                    title="Add Clip"
                  >+</button>
                </div>
              );
            })}
          </div>
          
          {/* Add Track Button */}
          <div style={{ padding: 12, borderTop: '1px solid #2a2a2a' }}>
            <button 
              onClick={() => addTrack()}
              style={{ 
                width: '100%', 
                padding: '8px', 
                background: '#00bcd4',
                color: '#000',
                border: 0,
                borderRadius: 4,
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: 13
              }}
            >+ New Track</button>
          </div>
        </aside>

        <section style={{ flex: 1, position: 'relative', overflow: 'auto', background: '#0a0a0a' }}>
          {/* Arrangement Markers Row */}
          <div style={{ 
            height: 32, 
            borderBottom: '1px solid #2a2a2a', 
            background: '#151515',
            position: 'sticky',
            top: 0,
            zIndex: 12,
            display: 'flex'
          }}>
            {markers.map((marker, idx) => {
              const nextMarkerPos = markers[idx + 1]?.position || 120;
              const width = pxForSeconds(nextMarkerPos - marker.position);
              const markerColors = ['#6a5acd', '#4a4a8a', '#5a6a9a', '#4a5a7a'];
              const bgColor = markerColors[idx % markerColors.length];
              
              return (
                <div key={marker.id} style={{ 
                  width: width + 'px',
                  borderRight: '1px solid #000',
                  background: bgColor,
                  display: 'flex',
                  alignItems: 'center',
                  paddingLeft: 8,
                  fontSize: 11,
                  fontWeight: 600,
                  color: '#fff',
                  cursor: 'pointer'
                }}>
                  {marker.name}
                </div>
              );
            })}
          </div>

          {/* Timeline Ruler */}
          <div style={{ 
            height: 28, 
            borderBottom: '1px solid #2a2a2a', 
            background: '#1a1a1a',
            display: 'flex',
            alignItems: 'flex-end',
            position: 'sticky',
            top: 32,
            zIndex: 11
          }}>
            <div style={{ display: 'flex', height: '100%' }}>
              {Array.from({ length: 121 }).map((_, i) => (
                <div key={i} style={{ 
                  width: pxForSeconds(1), 
                  textAlign: 'center', 
                  fontSize: 10, 
                  color: i % 4 === 0 ? '#00bcd4' : '#555',
                  paddingBottom: 4,
                  borderLeft: i % 4 === 0 ? '1px solid #333' : 'none',
                  fontWeight: i % 16 === 0 ? 600 : 400
                }}>
                  {i % 4 === 0 ? i : ''}
                </div>
              ))}
            </div>
          </div>

          {/* Tracks Area */}
          <div style={{ position: 'relative', minHeight: 'calc(100vh - 108px)' }}>
            {tracks.map((t, idx) => {
              const trackColor = getTrackColor(idx);
              const isMuted = mutedTracks.has(t.id);
              const anySoloed = soloedTracks.size > 0;
              const isSoloed = soloedTracks.has(t.id);
              const shouldPlay = !isMuted && (!anySoloed || isSoloed);
              
              return (
                <div key={t.id} style={{ 
                  height: 64, 
                  borderBottom: '1px solid #1a1a1a',
                  position: 'relative',
                  background: idx % 2 === 0 ? '#0f0f0f' : '#0a0a0a'
                }}>
                  {/* Grid Lines */}
                  <div style={{ 
                    position: 'absolute', 
                    inset: 0, 
                    background: 'linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)',
                    backgroundSize: `${pxForSeconds(4)}px 100%`,
                    pointerEvents: 'none'
                  }} />

                  {/* Clips */}
                  <div style={{ position: 'relative', height: '100%', padding: '8px 0' }}>
                    {t.clips.map(c => {
                      const left = pxForSeconds(c.start || 0);
                      const width = pxForSeconds(c.duration && c.duration > 0 ? c.duration : 8);
                      
                      return (
                        <div key={c.id} style={{
                          position: 'absolute',
                          left,
                          top: 8,
                          height: 48,
                          width: Math.max(60, width),
                          background: `linear-gradient(135deg, ${trackColor}dd 0%, ${trackColor}aa 100%)`,
                          border: `1px solid ${trackColor}`,
                          borderRadius: 3,
                          overflow: 'hidden',
                          boxShadow: isMuted ? 'none' : `0 2px 8px ${trackColor}44`,
                          cursor: 'pointer',
                          opacity: shouldPlay ? 1 : 0.3,
                          transition: 'opacity 0.2s'
                        }}>
                          {/* Waveform Canvas */}
                          <canvas 
                            id={`waveform-${c.id}`}
                            style={{ 
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              width: '100%',
                              height: '100%',
                              pointerEvents: 'none',
                              opacity: 0.6
                            }}
                          />
                          
                          {/* Clip Name */}
                          <div style={{ 
                            position: 'absolute',
                            top: 4,
                            left: 6,
                            fontSize: 10, 
                            color: '#000', 
                            fontWeight: 600,
                            textShadow: '0 1px 2px rgba(255,255,255,0.3)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            maxWidth: 'calc(100% - 12px)'
                          }}>
                            {c.url.split('/').pop()?.slice(0, 25) || 'Clip'}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Playhead */}
          <div style={{
            position: 'absolute',
            left: pxForSeconds(playhead),
            top: 60,
            bottom: 0,
            width: 2,
            background: '#00bcd4',
            boxShadow: '0 0 8px #00bcd4',
            transform: 'translateX(-1px)',
            pointerEvents: 'none',
            zIndex: 10
          }}>
            <div style={{
              position: 'absolute',
              top: -8,
              left: -6,
              width: 0,
              height: 0,
              borderLeft: '6px solid transparent',
              borderRight: '6px solid transparent',
              borderTop: '8px solid #00bcd4'
            }} />
          </div>

          {/* Click to Seek */}
          <div style={{ 
            position: 'absolute', 
            left: 0, 
            right: 0, 
            top: 60, 
            bottom: 0,
            cursor: 'crosshair'
          }} onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const seconds = clickX / zoom;
            seekTo(seconds);
          }} />
        </section>

        <aside style={{ 
          width: 320, 
          borderLeft: '1px solid #2a2a2a', 
          background: '#1a1a1a',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column'
        }}>
          {/* Transport Controls */}
          <div style={{ padding: 16, borderBottom: '1px solid #2a2a2a' }}>
            <div style={{ fontSize: 11, color: '#888', marginBottom: 8, fontWeight: 600 }}>TRANSPORT</div>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: '1fr 1fr', 
              gap: 8,
              marginBottom: 12
            }}>
              <button onClick={togglePlay} style={{
                padding: '10px',
                background: isPlaying ? '#ff6b6b' : '#00bcd4',
                border: 0,
                borderRadius: 4,
                cursor: 'pointer',
                color: '#000',
                fontWeight: 600,
                fontSize: 12
              }}>{isPlaying ? '⏸ Pause' : '▶ Play'}</button>
              
              <button onClick={stop} style={{
                padding: '10px',
                background: '#333',
                border: 0,
                borderRadius: 4,
                cursor: 'pointer',
                color: '#fff',
                fontWeight: 600,
                fontSize: 12
              }}>⏹ Stop</button>
            </div>
            
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>Zoom</div>
              <input 
                type="range" 
                min="20" 
                max="200" 
                value={zoom} 
                onChange={(e) => setZoom(Number(e.target.value))} 
                style={{ 
                  width: '100%',
                  accentColor: '#00bcd4'
                }} 
              />
            </div>
          </div>

          {/* AI Generation Tools */}
          <div style={{ flex: 1 }}>
            <div style={{ 
              padding: 16, 
              borderBottom: '1px solid #2a2a2a',
              position: 'sticky',
              top: 0,
              background: '#1a1a1a',
              zIndex: 5
            }}>
              <div style={{ fontSize: 11, color: '#888', fontWeight: 600 }}>🎵 AI GENERATION</div>
            </div>
            
            <div style={{ padding: 16 }}>
            
            {/* Music Generation - 2 credits */}
            <button 
              style={{ width: '100%', marginBottom: 6, padding: '8px', cursor: 'pointer', backgroundColor: '#4a90e2', color: 'white', border: 'none', borderRadius: 4, fontSize: 13 }} 
              onClick={async () => {
                const prompt = window.prompt('Enter music prompt (e.g., "lofi beats with piano")');
                if (!prompt) return;
                
                try {
                  const res = await fetch('/api/studio/generate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                      type: 'create-song',
                      params: { prompt }
                    })
                  });
                  
                  const data = await res.json();
                  if (!res.ok) throw new Error(data.error || 'Generation failed');
                  
                  setGeneratingJobs(prev => [...prev, data.jobId]);
                  console.log('🎵 Music generation started:', data.jobId);
                } catch (err: any) {
                  alert(err.message);
                }
              }}
            >
              🎵 Music (2 credits)
            </button>

            {/* Instrumental Generation - 16 credits */}
            <button 
              style={{ width: '100%', marginBottom: 6, padding: '8px', cursor: 'pointer', backgroundColor: '#8e44ad', color: 'white', border: 'none', borderRadius: 4, fontSize: 13 }} 
              onClick={async () => {
                const prompt = window.prompt('Describe instrumental (e.g., "upbeat electronic synth melody")');
                if (!prompt) return;
                
                try {
                  const res = await fetch('/api/studio/generate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                      type: 'create-beat',
                      params: { prompt }
                    })
                  });
                  
                  const data = await res.json();
                  if (!res.ok) throw new Error(data.error || 'Generation failed');
                  
                  setGeneratingJobs(prev => [...prev, data.jobId]);
                  console.log('🎹 Instrumental generation started:', data.jobId);
                } catch (err: any) {
                  alert(err.message);
                }
              }}
            >
              🎹 Instrumental (16 credits)
            </button>

            {/* Effects Chain - 0.1 credits */}
            <button 
              style={{ width: '100%', marginBottom: 6, padding: '8px', cursor: 'pointer', backgroundColor: '#27ae60', color: 'white', border: 'none', borderRadius: 4, fontSize: 13 }} 
              onClick={async () => {
                const url = window.prompt('Audio URL to apply effects:');
                if (!url) return;
                const effectsDesc = window.prompt('Describe effects (e.g., "add reverb and echo")');
                if (!effectsDesc) return;
                
                try {
                  const res = await fetch('/api/studio/generate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                      type: 'effects',
                      params: { audioUrl: url, effects: effectsDesc }
                    })
                  });
                  
                  const data = await res.json();
                  if (!res.ok) throw new Error(data.error || 'Generation failed');
                  
                  setGeneratingJobs(prev => [...prev, data.jobId]);
                  console.log('🎚️ Effects processing started:', data.jobId);
                } catch (err: any) {
                  alert(err.message);
                }
              }}
            >
              🎚️ Effects Chain (0.1 credits)
            </button>

            {/* Auto-tune - 1 credit */}
            <button 
              style={{ width: '100%', marginBottom: 6, padding: '8px', cursor: 'pointer', backgroundColor: '#e74c3c', color: 'white', border: 'none', borderRadius: 4, fontSize: 13 }} 
              onClick={async () => {
                const url = window.prompt('Audio URL to auto-tune:');
                if (!url) return;
                const scale = window.prompt('Scale (major/minor/chromatic):', 'closest') || 'closest';
                
                try {
                  const res = await fetch('/api/studio/generate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                      type: 'auto-tune',
                      params: { audioUrl: url, scale }
                    })
                  });
                  
                  const data = await res.json();
                  if (!res.ok) throw new Error(data.error || 'Generation failed');
                  
                  setGeneratingJobs(prev => [...prev, data.jobId]);
                  console.log('🎤 Auto-tune started:', data.jobId);
                } catch (err: any) {
                  alert(err.message);
                }
              }}
            >
              🎤 Auto-tune (1 credit)
            </button>

            {/* Stem Splitter - 20 credits */}
            <button 
              style={{ width: '100%', marginBottom: 8, padding: '8px', cursor: 'pointer', backgroundColor: '#f39c12', color: 'white', border: 'none', borderRadius: 4, fontSize: 13 }} 
              onClick={async () => {
                const url = window.prompt('Audio URL to split into stems:');
                if (!url) return;
                
                try {
                  const res = await fetch('/api/studio/generate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                      type: 'stem-split',
                      params: { audioUrl: url }
                    })
                  });
                  
                  const data = await res.json();
                  if (!res.ok) throw new Error(data.error || 'Generation failed');
                  
                  setGeneratingJobs(prev => [...prev, data.jobId]);
                  console.log('🎛️ Stem splitting started:', data.jobId);
                  alert('Stem split started! Each stem will appear as a separate track.');
                } catch (err: any) {
                  alert(err.message);
                }
              }}
            >
              🎛️ Stem Splitter (20 credits)
            </button>

            {generatingJobs.length > 0 && (
              <div style={{ fontSize: 11, color: '#ffa500', marginBottom: 8, padding: 8, background: 'rgba(255, 165, 0, 0.1)', borderRadius: 4 }}>
                ⏳ Generating {generatingJobs.length} job(s)...
              </div>
            )}

            <div style={{ borderTop: '1px solid #2a2a2a', marginTop: 12, paddingTop: 12 }}>
              <button style={{ 
                width: '100%', 
                padding: '10px', 
                cursor: 'pointer', 
                background: '#252525', 
                color: '#00bcd4', 
                border: '1px solid #333', 
                borderRadius: 4, 
                fontSize: 12,
                fontWeight: 600
              }} onClick={async () => {
                const sched = getScheduler();
                if (!sched) return;
                
                const url = prompt('Paste audio URL:');
                if (!url) return;
                const newTrack = { id: 't-' + Date.now(), name: 'Manual ' + (tracks.length + 1), clips: [{ id: 'c-' + Date.now(), url, start: Math.floor(playhead), duration: 0 }] };
                setTracks(prev => [...prev, newTrack]);
                try { await sched.loadBuffer(url); } catch (e) { console.warn(e); }
              }}>
                📎 Add Audio by URL
              </button>
              <div style={{ fontSize: 10, color: '#666', marginTop: 6, textAlign: 'center' }}>For testing with CORS-enabled URLs</div>
            </div>
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}
