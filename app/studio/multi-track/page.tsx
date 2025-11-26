'use client';

import { useEffect, useRef, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import createAudioScheduler from '@/lib/audio/AudioScheduler';
import { usePusher } from '@/lib/pusher-client';

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
}

interface Track {
  id: string;
  name: string;
  clips: Clip[];
}

export default function MultiTrackStudio() {
  const { user } = useUser();
  const pusherChannel = usePusher(user?.id);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playhead, setPlayhead] = useState(0);
  const [zoom, setZoom] = useState(50);
  const [generatingJobs, setGeneratingJobs] = useState<string[]>([]);
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
      
      // Extract audio URL from output
      const audioUrl = data.output?.audio || data.output?.stem1 || Object.values(data.output || {})[0];
      
      if (typeof audioUrl === 'string' && audioUrl) {
        // Create new track with the generated audio
        const newTrack: Track = {
          id: 't-' + Date.now(),
          name: `${data.type || 'Generated'} (${new Date().toLocaleTimeString()})`,
          clips: [{
            id: 'c-' + Date.now(),
            url: audioUrl,
            start: Math.floor(playhead),
            duration: 0
          }]
        };
        
        setTracks(prev => [...prev, newTrack]);
        
        // Pre-load the audio buffer
        const sched = getScheduler();
        if (sched) {
          try {
            await sched.loadBuffer(audioUrl);
            console.log('✅ Auto-loaded generated audio');
          } catch (err) {
            console.warn('Failed to load:', err);
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
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tracks, isPlaying]);

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

  function pxForSeconds(sec: number) {
    return sec * zoom;
  }

  return (
    <div style={{ fontFamily: 'Inter, Arial, sans-serif', height: '100vh', display: 'flex', flexDirection: 'column', background: '#0b0b0b', color: '#fff' }}>
      <header style={{ padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #111' }}>
        <div>
          <h2 style={{ margin: 0 }}>444 Radio — Studio</h2>
          <div style={{ fontSize: 12, opacity: 0.7 }}>Space = Play/Pause • S = Stop • T = New Track</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div>Playhead: <strong>{formatTime(playhead)}</strong></div>
          <button onClick={togglePlay} style={{ padding: '8px 12px', background: '#1db954', border: 0, color: '#000', borderRadius: 6, cursor: 'pointer' }}>{isPlaying ? 'Pause' : 'Play'}</button>
          <button onClick={stop} style={{ padding: '8px 12px', background: '#ff6b6b', border: 0, color: '#000', borderRadius: 6, cursor: 'pointer' }}>Stop</button>
          <button onClick={() => addTrack()} style={{ padding: '8px 12px', background: '#444', border: 0, color: '#fff', borderRadius: 6, cursor: 'pointer' }}>+ Track</button>
        </div>
      </header>

      <main style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <aside style={{ width: 220, borderRight: '1px solid #111', padding: 12, boxSizing: 'border-box', background: '#070707', overflowY: 'auto' }}>
          <div style={{ marginBottom: 8, fontSize: 13, color: '#bbb' }}>Tracks</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {tracks.map(t => (
              <div key={t.id} style={{ padding: 8, background: '#0f0f0f', borderRadius: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>{t.name}</div>
                  <div style={{ fontSize: 12, opacity: 0.7 }}>{t.clips.length} clips</div>
                </div>
                <div style={{ marginTop: 8 }}>
                  <button style={{ padding: '6px 8px', width: '100%', cursor: 'pointer' }} onClick={() => addClipToTrack(t.id)}>+ Clip (URL)</button>
                </div>
              </div>
            ))}
          </div>
        </aside>

        <section style={{ flex: 1, position: 'relative', overflow: 'auto' }}>
          <div style={{ height: 48, borderBottom: '1px solid #111', background: '#080808', display: 'flex', alignItems: 'center', paddingLeft: 8, position: 'sticky', top: 0, zIndex: 10 }}>
            <div style={{ display: 'flex', gap: 0 }}>
              {Array.from({ length: 121 }).map((_, i) => (
                <div key={i} style={{ width: pxForSeconds(1), textAlign: 'center', fontSize: 11, color: '#888', borderRight: '1px solid #0b0b0b' }}>
                  {i % 5 === 0 ? i : ''}
                </div>
              ))}
            </div>
          </div>

          <div style={{ padding: 12 }}>
            {tracks.map((t, idx) => (
              <div key={t.id} style={{ height: 84, marginBottom: 12, background: idx % 2 === 0 ? '#0f0f0f' : '#0b0b0b', borderRadius: 6, padding: 8, position: 'relative' }}>
                <div style={{ position: 'absolute', left: 8, top: 8, fontSize: 12, color: '#ccc' }}>{t.name}</div>

                <div style={{ marginLeft: 120, height: 56, position: 'relative', overflow: 'hidden', borderRadius: 6 }}>
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, rgba(255,255,255,0.01) 1px, transparent 1px)', backgroundSize: `${pxForSeconds(1)}px 100%` }} />

                  {t.clips.map(c => {
                    const left = pxForSeconds(c.start || 0);
                    const width = pxForSeconds(c.duration && c.duration > 0 ? c.duration : 8);
                    return (
                      <div key={c.id} style={{
                        position: 'absolute', left, top: 6, height: 44,
                        width: Math.max(40, width),
                        background: 'linear-gradient(90deg,#00b894,#00d1a6)',
                        borderRadius: 6,
                        display: 'flex',
                        alignItems: 'center',
                        paddingLeft: 8,
                        boxShadow: '0 4px 14px rgba(0,0,0,0.5)',
                        cursor: 'pointer'
                      }}>
                        <div style={{ fontSize: 12, color: '#001' }}>{c.url.split('/').pop()?.slice(0, 12) || 'Clip'}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div style={{
            position: 'absolute',
            left: pxForSeconds(playhead),
            top: 48,
            bottom: 0,
            width: 2,
            background: 'linear-gradient(180deg,#fff,#ff0)',
            transform: 'translateX(-1px)',
            pointerEvents: 'none'
          }} />

          <div style={{ position: 'absolute', left: 0, right: 0, top: 48, bottom: 0 }} onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const seconds = clickX / zoom;
            seekTo(seconds);
          }} />
        </section>

        <aside style={{ width: 300, borderLeft: '1px solid #111', padding: 12, background: '#070707' }}>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 13, color: '#bbb' }}>Controls</div>
            <div style={{ marginTop: 8 }}>{isPlaying ? 'Playing' : 'Stopped'}</div>
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 12, marginBottom: 4 }}>Zoom:</div>
              <input type="range" min="20" max="200" value={zoom} onChange={(e) => setZoom(Number(e.target.value))} style={{ width: '100%' }} />
            </div>
          </div>

          <div>
            <div style={{ fontSize: 13, color: '#bbb', marginBottom: 6 }}>AI Generation</div>
            <button 
              style={{ width: '100%', marginBottom: 8, padding: '8px', cursor: 'pointer', backgroundColor: '#4a90e2', color: 'white', border: 'none', borderRadius: 4 }} 
              onClick={async () => {
                const prompt = window.prompt('Enter music prompt (e.g., "lofi beats with piano")');
                if (!prompt) return;
                
                try {
                  const res = await fetch('/api/studio/generate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                      type: 'music',
                      prompt,
                      model: 'minimax/music-01'
                    })
                  });
                  
                  if (!res.ok) throw new Error('Generation failed');
                  
                  const data = await res.json();
                  setGeneratingJobs(prev => [...prev, data.jobId]);
                  console.log('🎵 Generation started:', data.jobId);
                } catch (err: any) {
                  alert('Generation failed: ' + err.message);
                }
              }}
            >
              🎵 Generate Music with AI
            </button>
            {generatingJobs.length > 0 && (
              <div style={{ fontSize: 11, color: '#ffa500', marginBottom: 8 }}>
                ⏳ Generating {generatingJobs.length} track(s)...
              </div>
            )}
            <button style={{ width: '100%', marginBottom: 8, padding: '8px', cursor: 'pointer' }} onClick={async () => {
              const sched = getScheduler();
              if (!sched) return;
              
              const url = prompt('Paste audio URL (for manual test)');
              if (!url) return;
              const newTrack = { id: 't-' + Date.now(), name: 'Manual ' + (tracks.length + 1), clips: [{ id: 'c-' + Date.now(), url, start: Math.floor(playhead), duration: 0 }] };
              setTracks(prev => [...prev, newTrack]);
              try { await sched.loadBuffer(url); } catch (e) { console.warn(e); }
            }}>+ Add Audio by URL</button>
            <div style={{ fontSize: 12, color: '#999', marginTop: 6 }}>Test with CORS-enabled audio URLs or use AI generation above.</div>
          </div>
        </aside>
      </main>
    </div>
  );
}
